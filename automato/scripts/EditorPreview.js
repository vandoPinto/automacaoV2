/**
 * Renderização isolada da pré-visualização do Editor de Componentes.
 * Reutiliza o mesmo processador e os mesmos templates usados na geração do curso.
 */
const crypto = require("crypto");
const { processarComponente, normalizarMarcadoresLegados } = require("./ProcessarComponentesAninhados");

const COMPONENTES_PREVIEW = new Set([
    "botao",
    "tela",
    "hotword",
    "abas",
    "flashcard",
    "jogomemoria",
    "mininavegacao",
    "sanfona",
    "ligapontos"
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
                const htmlBloco = await renderizarPreviewComponente(tipoBloco, bloco.source);
                const resultado = extrairResultadoTela(htmlBloco);
                if (!resultado) continue;
                estilos.push(...resultado.styles);
                scripts.push(...resultado.scripts);
                conteudos.push(resultado.content);
            }

            if (!conteudos.length) throw new Error("Adicione conteúdo a pelo menos um componente desta tela.");
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

    const fonteNormalizada = normalizarMarcadoresLegados(fonteComQuebras);
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
