/**
 * Renderização isolada da pré-visualização do Editor de Componentes.
 * Reutiliza o mesmo processador e os mesmos templates usados na geração do curso.
 */
const crypto = require("crypto");
const { processarComponente, normalizarMarcadoresLegados } = require("./ProcessarComponentesAninhados");
const interpretarJogoMemoria = require("./Componentes/jogomemoria/jogomemoria").interpretarRoteiro;
const interpretarLigaPontos = require("./Componentes/ligapontos/ligapontos").interpretarRoteiro;
const interpretarForca = require("./Componentes/forca/forca").interpretarRoteiro;

const COMPONENTES_PREVIEW = new Set([
    "botao",
    "tela",
    "hotword",
    "abas",
    "flashcard",
    "opcoes",
    "verdadeirofalso",
    "forca",
    "jogomemoria",
    "mininavegacao",
    "sanfona",
    "ligapontos",
    "relacionarcolunas"
]);



/** Remove recursos ativos que não fazem parte do conteúdo editável do roteiro. */
function sanitizarFonteEditor(valor) {
    return String(valor || "")
        .replace(/<!--([\s\S]*?)-->/g, "")
        .replace(/<(script|style|iframe|object|embed|form|input|button|video|audio)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
        .replace(/<(script|style|iframe|object|embed|form|input|button|video|audio)\b[^>]*\/?\s*>/gi, "")
        .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\s+(?:srcdoc|formaction)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
        .replace(/\b(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}


/** Encontra o fechamento correspondente de uma DIV, ignorando conteúdo de script/style. */
function localizarFechamentoDiv(html, inicioConteudo) {
    const tokens = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?div\b[^>]*>/gi;
    tokens.lastIndex = inicioConteudo;
    let profundidade = 1;
    let token;
    while ((token = tokens.exec(html))) {
        if (/^<\/(?:script|style)/i.test(token[0]) || /^<(?:script|style)/i.test(token[0])) continue;
        if (/^<\/div/i.test(token[0])) profundidade -= 1;
        else profundidade += 1;
        if (profundidade === 0) {
            return { inicio: token.index, fim: tokens.lastIndex };
        }
    }
    return null;
}

/** Separa os blocos editoriais sem confundir DIVs internas dos componentes. */
function extrairBlocosEditor(fonte) {
    const blocos = [];
    const aberturas = /<div\b[^>]*>/gi;
    let abertura;
    while ((abertura = aberturas.exec(fonte))) {
        const atributo = abertura[0].match(/\bdata-editor-component-block\s*=\s*(["'])([^"']+)\1/i);
        if (!atributo) continue;
        const fechamento = localizarFechamentoDiv(fonte, aberturas.lastIndex);
        if (!fechamento) throw new Error("Um bloco de componente da tela não foi fechado corretamente.");
        blocos.push({ slug: atributo[2].trim().toLowerCase(), source: fonte.slice(aberturas.lastIndex, fechamento.inicio) });
        aberturas.lastIndex = fechamento.fim;
    }
    return blocos;
}

/** Extrai a área útil renderizada pela Tela real e seus recursos associados. */
function extrairResultadoTela(html) {
    const abertura = /<div\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\btela-container\b[^"']*\1)[^>]*>/i.exec(html);
    if (!abertura) return null;
    const inicioConteudo = abertura.index + abertura[0].length;
    const fechamento = localizarFechamentoDiv(html, inicioConteudo);
    if (!fechamento) return null;
    const estilos = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi)].map(match => match[0]);
    const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)].map(match => match[0]);
    // Os templates dos componentes podem inserir <style> e <script> dentro
    // da própria .tela-container. Esses recursos são extraídos acima e
    // reinseridos no documento de pré-visualização ao final da composição.
    // Mantê-los também em content duplicaria a execução dos scripts. No caso
    // de BOTÕES, cada clique abriria a janela e a segunda execução a fecharia.
    const content = html.slice(inicioConteudo, fechamento.inicio)
        .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "");

    return {
        content,
        styles: estilos,
        scripts
    };
}

/**
 * Converte quebras digitadas dentro de nós de texto em quebras HTML visíveis.
 *
 * O textarea guarda o código-fonte com LF, mas o navegador colapsa LF em nós
 * de texto quando eles chegam ao HTML. Sem esta etapa, Enter, Enter duplo e
 * Enter triplo acabam parecendo iguais na prévia. Espaços de indentação entre
 * tags são mantidos como formatação do código e não viram quebras visuais.
 */
function preservarQuebrasDeLinhaEmTexto(fonte) {
    const tagsInline = new Set([
        "a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "del",
        "em", "i", "img", "ins", "kbd", "label", "mark", "q", "s", "samp",
        "small", "span", "strong", "sub", "sup", "time", "u", "var"
    ]);
    const tagsComTextoLiteral = new Set(["pre", "textarea", "script", "style"]);
    const tagsVazias = new Set([
        "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"
    ]);
    const partes = String(fonte || "").replace(/\r\n?/g, "\n").split(/(<[^>]+>)/g);
    const pilha = [];
    let ultimaTag = null;

    const analisarTag = token => {
        const match = token.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b/i);
        if (!match) return null;
        return { fechamento: Boolean(match[1]), nome: match[2].toLowerCase() };
    };

    return partes.map((parte, indice) => {
        if (!parte) return parte;
        if (parte.startsWith("<") && parte.endsWith(">")) {
            const tag = analisarTag(parte);
            if (tag) {
                if (tag.fechamento) {
                    const posicao = pilha.lastIndexOf(tag.nome);
                    if (posicao >= 0) pilha.splice(posicao);
                } else if (!tagsVazias.has(tag.nome) && !/\/\s*>$/.test(parte)) {
                    pilha.push(tag.nome);
                }
            }
            ultimaTag = tag;
            return parte;
        }

        if (!parte.includes("\n") || !/\S/.test(parte)) return parte;
        if (pilha.some(tag => tagsComTextoLiteral.has(tag))) return parte;

        const proximaTag = analisarTag(partes[indice + 1] || "");
        let texto = parte;

        // Uma quebra imediatamente após a abertura de um bloco e outra
        // imediatamente antes do fechamento são apenas recuo do código.
        if (ultimaTag && !ultimaTag.fechamento && !tagsInline.has(ultimaTag.nome)) {
            texto = texto.replace(/^[ \t]*\n[ \t]*/, "");
        }
        if (proximaTag && proximaTag.fechamento && !tagsInline.has(proximaTag.nome)) {
            texto = texto.replace(/[ \t]*\n[ \t]*$/, "");
        }

        // Dentro de um parágrafo HTML existente, Enter representa uma quebra
        // de linha. Fora de um <p>, cada Enter cria um parágrafo real; linhas
        // vazias viram parágrafos vazios com <br>, preservando Enters duplos
        // e triplos. Isso também cobre texto digitado depois do fechamento de
        // um componente, que antes acabava concatenado ao texto anterior.
        if (pilha.includes("p")) {
            return texto.replace(/[ \t]*\n[ \t]*/g, "<br>");
        }

        const linhas = texto.replace(/^[ \t]*\n/, "").replace(/\n[ \t]*$/, "").split("\n");
        if (linhas.length <= 1) return texto;
        return linhas.map(linha => {
            const conteudo = linha.trim();
            return conteudo ? `<p>${conteudo}</p>` : "<p><br></p>";
        }).join("");
    }).join("");
}

/** Converte os wrappers antigos das atividades para a sintaxe central da prévia. */
function normalizarWrappersOpcoesEditor(fonte) {
    return String(fonte || "").replace(
        /<(\/?)\s*(opcoes|verdadeirofalso)\b[^>]*>/gi,
        (marcador, fechamento, tipo) => fechamento
            ? "</componente>"
            : `<componente tipo="${tipo.toLowerCase()}">`
    );
}

// Durante a edição, estruturas incompletas ainda são rascunhos válidos.
// A prévia omite somente os campos vazios; o processador do curso continua
// aplicando as validações normalmente.
function erroDeCampoIncompletoNoEditor(slug, erro) {
    const mensagem = String(erro?.message || erro || "");
    const validacoesIncompletas = {
        jogomemoria: [
            /precisa ter pelo menos um par/i,
            /par \d+ está incompleto/i,
            /carta[12] do par \d+ está vazia/i,
            /feedback do par \d+ está vazio/i
        ],
        ligapontos: [
            /nenhuma marcação <opcao> foi encontrada/i,
            /a opção \d+ está vazia/i,
            /a opção \d+ não possui uma <resposta> correspondente/i,
            /a resposta \d+ está vazia/i,
            /a atividade precisa ter pelo menos uma associação/i,
            /quantidade de opções \(\d+\) é diferente da quantidade de respostas \(\d+\)/i,
            /feedback de acerto <feedcerto> está ausente ou vazio/i,
            /feedback de erro <feedErrao> está ausente ou vazio/i
        ],
        forca: [/informe uma palavra com pelo menos uma letra/i]
    };
    return (validacoesIncompletas[slug] || []).some(padrao => padrao.test(mensagem));
}

function possuiConteudoEditado(valor) {
    const origem = String(valor || "").replace(/<!--[\s\S]*?-->/g, " ");
    const texto = origem
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;|&#xA0;|&#8203;|&#xfeff;/gi, " ")
        .replace(/&#(?:x([\da-f]+)|(\d+));/gi, (_, hexadecimal, decimal) => {
            const codigo = Number.parseInt(hexadecimal || decimal, hexadecimal ? 16 : 10);
            return Number.isInteger(codigo) && codigo >= 0 && codigo <= 0x10ffff
                ? String.fromCodePoint(codigo)
                : " ";
        })
        .replace(/&(?:amp|lt|gt|quot|apos|#39);/gi, "x")
        .replace(/[\u200b-\u200d\ufeff]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return Boolean(texto || /<(?:img|picture|svg|video|canvas|object|iframe|audio)\b/i.test(origem));
}

function lerSecoesMarcadas(fonte, marcadores) {
    const regex = new RegExp(`<(${marcadores.join("|")})\\s*>`, "gi");
    const encontrados = [...String(fonte || "").matchAll(regex)];
    return encontrados.map((marcador, indice) => ({
        nome: marcador[1].toLowerCase(),
        inicio: marcador.index,
        inicioConteudo: marcador.index + marcador[0].length,
        fim: encontrados[indice + 1]?.index ?? String(fonte || "").length
    }));
}

function omitirAlternativasVazias(fonte) {
    const origem = String(fonte || "");
    const secoes = lerSecoesMarcadas(origem, ["alternativa", "correta", "feedcerto", "feederrado"]);
    const remover = [];
    let quantidade = 0;

    secoes.forEach((secao, indice) => {
        if (secao.nome !== "alternativa") return;
        const limite = secoes.findIndex((proxima, posicao) =>
            posicao > indice && ["alternativa", "feedcerto", "feederrado"].includes(proxima.nome)
        );
        const fimGrupo = limite < 0 ? secoes.length : limite;
        const correta = secoes.slice(indice + 1, fimGrupo).find(item => item.nome === "correta");
        const fimTexto = correta ? correta.inicio : (secoes[limite]?.inicio ?? origem.length);
        if (possuiConteudoEditado(origem.slice(secao.inicioConteudo, fimTexto))) {
            quantidade++;
            return;
        }
        const secaoCorreta = correta ? secoes.find(item => item === correta) : null;
        remover.push({
            inicio: secao.inicio,
            fim: secaoCorreta?.fim ?? secao.fim
        });
    });

    return { fonte: aplicarRemocoes(origem, remover), quantidade };
}

function omitirParesVaziosRelacionarColunas(fonte) {
    const origem = String(fonte || "");
    const secoes = lerSecoesMarcadas(origem, ["modo", "opcao", "resposta", "feedcerto", "feederrado"]);
    const remover = [];
    let quantidade = 0;

    secoes.forEach((secao, indice) => {
        if (secao.nome !== "opcao") return;
        const limite = secoes.findIndex((proxima, posicao) =>
            posicao > indice && ["opcao", "feedcerto", "feederrado"].includes(proxima.nome)
        );
        const fimGrupo = limite < 0 ? secoes.length : limite;
        const resposta = secoes.slice(indice + 1, fimGrupo).find(item => item.nome === "resposta");
        const textoOpcao = resposta
            ? origem.slice(secao.inicioConteudo, resposta.inicio)
            : origem.slice(secao.inicioConteudo, secoes[limite]?.inicio ?? origem.length);
        const textoResposta = resposta ? origem.slice(resposta.inicioConteudo, resposta.fim) : "";

        if (resposta && possuiConteudoEditado(textoOpcao) && possuiConteudoEditado(textoResposta)) {
            quantidade++;
            return;
        }
        remover.push({ inicio: secao.inicio, fim: resposta?.fim ?? secao.fim });
    });

    return { fonte: aplicarRemocoes(origem, remover), quantidade };
}

function aplicarRemocoes(fonte, intervalos) {
    let resultado = String(fonte || "");
    const externos = intervalos
        .sort((a, b) => a.inicio - b.inicio || b.fim - a.fim)
        .filter((intervalo, indice, todos) => !todos.slice(0, indice).some(anterior =>
            anterior.inicio <= intervalo.inicio && anterior.fim >= intervalo.fim
        ));
    externos.sort((a, b) => b.inicio - a.inicio).forEach(intervalo => {
        resultado = resultado.slice(0, intervalo.inicio) + resultado.slice(intervalo.fim);
    });
    return resultado;
}

// A Estrutura Visual serializa componentes de primeiro nível com os wrappers
// legados. O ramo de blocos data-editor-component-block não vê esses wrappers,
// então localizamos e removemos apenas os rascunhos incompletos antes da TELA
// real processá-los.
function omitirRascunhosIncompletos(fonte) {
    const origem = String(fonte || "");
    const tokens = /<(\/?)\s*(componente|jogomemoria|ligapontos|opcoes|verdadeirofalso|relacionarcolunas|forca)\b([^>]*)>/gi;
    const pilha = [];
    const remover = [];
    const substituir = [];
    let token;

    while ((token = tokens.exec(origem))) {
        const fechamento = Boolean(token[1]);
        const tag = token[2].toLowerCase();
        if (fechamento) {
            let indice = pilha.length - 1;
            while (indice >= 0 && pilha[indice].tag !== tag) indice--;
            if (indice < 0) continue;
            const bloco = pilha[indice];
            pilha.length = indice;
            const conteudo = origem.slice(bloco.inicioConteudo, token.index);
            if (["jogomemoria", "ligapontos"].includes(bloco.tipo)) {
                try {
                    if (bloco.tipo === "jogomemoria") interpretarJogoMemoria(conteudo);
                    else interpretarLigaPontos(conteudo);
                } catch (erro) {
                    if (erroDeCampoIncompletoNoEditor(bloco.tipo, erro)) {
                        remover.push({ inicio: bloco.inicio, fim: tokens.lastIndex });
                    }
                }
            } else if (["opcoes", "verdadeirofalso"].includes(bloco.tipo)) {
                const limpo = omitirAlternativasVazias(conteudo);
                if (!limpo.quantidade) remover.push({ inicio: bloco.inicio, fim: tokens.lastIndex });
                else if (limpo.fonte !== conteudo) substituir.push({ inicio: bloco.inicioConteudo, fim: token.index, valor: limpo.fonte });
            } else if (bloco.tipo === "relacionarcolunas") {
                const limpo = omitirParesVaziosRelacionarColunas(conteudo);
                if (!limpo.quantidade) remover.push({ inicio: bloco.inicio, fim: tokens.lastIndex });
                else if (limpo.fonte !== conteudo) substituir.push({ inicio: bloco.inicioConteudo, fim: token.index, valor: limpo.fonte });
            } else if (bloco.tipo === "forca") {
                try {
                    interpretarForca(conteudo);
                } catch (erro) {
                    if (erroDeCampoIncompletoNoEditor("forca", erro)) {
                        remover.push({ inicio: bloco.inicio, fim: tokens.lastIndex });
                    }
                }
            }
            continue;
        }

        let tipo = tag;
        if (tag === "componente") {
            const atributo = token[3].match(/\btipo\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
            tipo = String(atributo && (atributo[1] || atributo[2] || atributo[3]) || "").toLowerCase();
        }
        pilha.push({ tag, tipo, inicio: token.index, inicioConteudo: tokens.lastIndex });
    }

    if (!remover.length && !substituir.length) return origem;
    let resultado = origem;
    const remocoesExternas = remover
        .sort((a, b) => a.inicio - b.inicio || b.fim - a.fim)
        .filter((intervalo, indice, todos) => !todos.slice(0, indice).some(anterior =>
            anterior.inicio <= intervalo.inicio && anterior.fim >= intervalo.fim
        ));
    const operacoes = [
        ...remocoesExternas.map(intervalo => ({ ...intervalo, valor: "" })),
        ...substituir.filter(intervalo => !remocoesExternas.some(remocao =>
            remocao.inicio <= intervalo.inicio && remocao.fim >= intervalo.fim
        ))
    ].sort((a, b) => b.inicio - a.inicio);
    operacoes.forEach(operacao => {
        resultado = resultado.slice(0, operacao.inicio) + operacao.valor + resultado.slice(operacao.fim);
    });
    return resultado;
}

/**
 * Gera a prévia processando o conteúdo como uma TELA real do Autômato.
 * A TELA é o componente-pai; os componentes do roteiro são resolvidos
 * recursivamente pelo mesmo processador usado em CriarTela.js.
 */
async function renderizarPreviewComponente(slugInformado, fonteInformada) {
    const slug = String(slugInformado || "").trim().toLowerCase();
    if (!COMPONENTES_PREVIEW.has(slug)) {
        throw new Error("O componente solicitado não está disponível para pré-visualização.");
    }

    const fonteSegura = sanitizarFonteEditor(fonteInformada);
    if (!fonteSegura.trim()) {
        throw new Error("Adicione conteúdo à estrutura para visualizar o componente.");
    }

    // Converte LF que fazem parte do conteúdo textual em <br>, preservando
    // as quebras consecutivas. Indentação entre tags continua sendo só código.
    const fonteComQuebras = preservarQuebrasDeLinhaEmTexto(fonteSegura);

    // Cada bloco inserido pela Biblioteca é processado isoladamente pela Tela real.
    // Depois, seus conteúdos são reunidos em uma única tela. Isso evita que as
    // regras de fechamento de um componente interfiram nos marcadores do seguinte.
    if (slug === "tela") {
        const blocos = extrairBlocosEditor(fonteComQuebras);
        if (blocos.length) {
            const estilos = [];
            const scripts = [];
            const conteudos = [];

            for (const bloco of blocos) {
                if (!bloco.source.trim()) continue;
                const tipoBloco = bloco.slug;
                if (!COMPONENTES_PREVIEW.has(tipoBloco) || tipoBloco === "tela") {
                    throw new Error("Um dos blocos da tela possui um tipo de componente inválido.");
                }
                let htmlBloco;
                try {
                    htmlBloco = await renderizarPreviewComponente(tipoBloco, bloco.source);
                } catch (erro) {
                    if (erroDeCampoIncompletoNoEditor(tipoBloco, erro)) continue;
                    throw erro;
                }
                const resultado = extrairResultadoTela(htmlBloco);
                if (!resultado) continue;
                estilos.push(...resultado.styles);
                scripts.push(...resultado.scripts);
                conteudos.push(resultado.content);
            }

            if (!conteudos.length) {
                return `<div class="tela-container licao0_tela1"></div>`;
            }
            // Cada bloco foi renderizado isoladamente para proteger os marcadores
            // internos. Ao reuni-los, a TELA deve aplicar a regra real do curso:
            // um bloco ocupa a área integral; vários blocos são itens irmãos.
            const conteudosTela = conteudos.length > 1
                ? conteudos.map(conteudo => conteudo.replace(
                    /<div\b[^>]*>/i,
                    abertura => abertura.replace(/\bconteudo-item-integral\b/, "")
                ))
                : conteudos;

            return `${estilos.join("\n")}<div class="tela-container licao0_tela1">${conteudosTela.join("\n")}</div>${scripts.join("\n")}`;
        }
    }

    // O Editor ainda pode serializar esses dois componentes com seus wrappers
    // antigos. O processador central reconhece a forma universal <componente
    // tipo="...">; sem esta conversão, eles aparecem como texto na Tela.
    let fonteNormalizada = normalizarMarcadoresLegados(
        normalizarWrappersOpcoesEditor(fonteComQuebras)
    );
    if (slug === "tela") fonteNormalizada = omitirRascunhosIncompletos(fonteNormalizada);
    const contexto = `editor-preview-${crypto.randomUUID()}`;
    // Importante: o conteúdo é processado como filho de uma TELA real, como no DOCX.
    return processarComponente("tela", fonteNormalizada, 0, 1, {
        contexto,
        tipoAudio: slug === "botao" ? "botoes" : slug
    });
}

module.exports = {
    renderizarPreviewComponente,
    sanitizarFonteEditor,
    preservarQuebrasDeLinhaEmTexto,
    COMPONENTES_PREVIEW
};
