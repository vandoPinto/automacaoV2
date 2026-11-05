/**
 * Processador central de componentes.
 *
 * A sintaxe universal <componente tipo="nome">...</componente> delimita
 * componentes filhos sem expor seus marcadores ao componente pai.
 * Os filhos são processados primeiro, substituídos por tokens opacos durante
 * o processamento do pai e restaurados no HTML final.
 *
 * Marcadores legados continuam sendo interpretados pelos componentes atuais.
 */
const componentes = require("./ComponentesLista");
const { normalizarTipo } = require("./Utils");

const TAG_COMPONENTE = /<\/?componente\b[^>]*>/gi;

/** Reconhece wrappers que o Mammoth preservou como texto escapado do DOCX. */
function normalizarWrappers(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?)\s*componente\b([\s\S]*?)&gt;/gi, (_, barra, atributos) =>
            `<${barra}componente${atributos.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")}>`
        )
        .replace(/&#60;\s*(\/?)\s*componente\b([\s\S]*?)&#62;/gi, (_, barra, atributos) =>
            `<${barra}componente${atributos.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")}>`
        )
        .replace(/&#x3c;\s*(\/?)\s*componente\b([\s\S]*?)&#x3e;/gi, (_, barra, atributos) =>
            `<${barra}componente${atributos.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")}>`
        );
}


/** Normaliza os marcadores antigos que podem vir escapados pelo Mammoth. */
function normalizarMarcadoresLegados(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?)\s*(hotword|botao|janela)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?)\s*(hotword|botao|janela)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?)\s*(hotword|botao|janela)\s*&#x3e;/gi, "<$1$2>")
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(hotword|botao|janela)>\s*(?:<\/strong>\s*)?<\/p>/gi, "<$1>")
        .replace(/<strong\b[^>]*>\s*<(hotword|botao|janela)>\s*<\/strong>/gi, "<$1>");
}

/**
 * Compatibilidade central para HOTWORDs escritas no formato legado dos DOCX.
 * O componente pai recebe apenas um token opaco; a HOTWORD é renderizada pelo
 * seu próprio módulo, sem o componente pai conhecer seus marcadores.
 */
async function protegerHotwordsLegadas(html, numeroLicao, index, contexto) {
    const origem = normalizarMarcadoresLegados(html);
    const marcadores = [...origem.matchAll(/<(hotword|botao|janela)\s*>/gi)];
    if (!marcadores.some(item => item[1].toLowerCase() === "hotword")) {
        return { conteudo: origem, restaurar: valor => valor };
    }

    const substituicoes = [];
    let resultado = "";
    let cursor = 0;

    for (let i = 0; i < marcadores.length; i++) {
        const marcador = marcadores[i];
        if (marcador[1].toLowerCase() !== "hotword" || marcador.index < cursor) continue;

        // A janela imediatamente após HOTWORD pertence à HOTWORD.
        const indiceJanela = marcadores.findIndex((item, indice) =>
            indice > i && item[1].toLowerCase() === "janela"
        );
        if (indiceJanela < 0) continue;

        const marcadorJanela = marcadores[indiceJanela];
        const proximoMarcador = marcadores[indiceJanela + 1];
        const fim = proximoMarcador ? proximoMarcador.index : origem.length;

        // O texto a destacar é o trecho de texto imediatamente anterior ao
        // marcador HOTWORD, limitado pelo último marcador estrutural do pai.
        // Assim, uma HOTWORD na introdução não captura os botões/janelas do
        // BOTAO, e uma HOTWORD dentro de uma janela fica dentro daquela janela.
        const marcadoresEstruturais = marcadores.filter((item, indice) =>
            indice < i &&
            item.index >= cursor &&
            ["botao", "janela"].includes(item[1].toLowerCase())
        );
        const ultimoEstrutural = marcadoresEstruturais[marcadoresEstruturais.length - 1];
        const inicioTrecho = ultimoEstrutural
            ? ultimoEstrutural.index + ultimoEstrutural[0].length
            : cursor;

        resultado += origem.slice(cursor, inicioTrecho);

        const trechoAnterior = origem.slice(inicioTrecho, marcador.index);
        const blocoHotword = origem.slice(marcador.index, fim);
        const entradaHotword = trechoAnterior + blocoHotword;

        const ordem = substituicoes.length + 1;
        const contextoHotword = `${contexto}.hotword-legada-${ordem}`;

        // A própria implementação HOTWORD transforma o texto original e cria
        // sua janela. O modo inline evita que a instância altere o layout do pai.
        const htmlHotword = await processarComponente(
            "hotword",
            entradaHotword,
            numeroLicao,
            contextoHotword,
            { inline: true, contexto: contextoHotword }
        );

        const token = `__HTML_HOTWORD_LEGADA_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
        substituicoes.push({ token, html: htmlHotword });
        resultado += token;
        cursor = fim;
        i = indiceJanela;
    }

    resultado += origem.slice(cursor);
    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) {
                saida = saida.split(item.token).join(item.html);
            }
            return saida;
        }
    };
}

function lerAtributoTipo(tag) {
    const match = tag.match(/\btipo\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    return match ? (match[1] || match[2] || match[3] || "").trim() : "";
}

/**
 * Constrói a árvore dos wrappers universais, respeitando qualquer profundidade.
 * Cada nó mantém as posições originais no HTML, permitindo substituir somente
 * o trecho do componente sem reordenar textos, imagens ou elementos irmãos.
 * A tag <janela> não é um wrapper de componente: ela permanece no conteúdo
 * do componente proprietário e será interpretada pelo próprio componente.
 */
function analisarWrappers(html) {
    const origem = normalizarWrappers(html);
    const pilha = [];
    const nos = [];
    let match;
    TAG_COMPONENTE.lastIndex = 0;

    while ((match = TAG_COMPONENTE.exec(origem)) !== null) {
        const tag = match[0];
        const fechamento = /^<\//.test(tag);
        const autoFechamento = /\/\s*>$/.test(tag);

        if (!fechamento) {
            const tipoOriginal = lerAtributoTipo(tag);
            if (!tipoOriginal) throw new Error(`Wrapper <componente> sem atributo tipo válido na posição ${match.index}.`);
            const no = {
                tipo: normalizarTipo(tipoOriginal), tipoOriginal,
                inicioTag: match.index, fimAbertura: TAG_COMPONENTE.lastIndex,
                filhos: []
            };
            if (pilha.length) pilha[pilha.length - 1].filhos.push(no);
            else nos.push(no);
            if (autoFechamento) {
                no.fimConteudo = no.fimAbertura;
                no.fim = TAG_COMPONENTE.lastIndex;
            } else pilha.push(no);
        } else {
            if (!pilha.length) throw new Error(`Fechamento </componente> sem abertura na posição ${match.index}.`);
            const no = pilha.pop();
            no.fimConteudo = match.index;
            no.fim = TAG_COMPONENTE.lastIndex;
        }
    }

    if (pilha.length) {
        const no = pilha[pilha.length - 1];
        throw new Error(`Componente "${no.tipoOriginal}" sem fechamento </componente>.`);
    }
    return nos;
}

function criarToken(indice, contexto, origem, tokensExistentes = []) {
    const seguro = String(contexto || "tela").replace(/[^a-zA-Z0-9_-]/g, "_");
    const base = `__HTML_COMPONENTE_FILHO_${seguro}_${indice}`;
    let tentativa = 0;
    let token;

    // Evita colisão com texto legítimo do DOCX ou com outro placeholder
    // criado durante o processamento da mesma tela.
    do {
        tentativa += 1;
        token = `${base}_${tentativa}_FIM__`;
    } while (String(origem || "").includes(token) || tokensExistentes.includes(token));

    return token;
}

async function processarFilhos(html, numeroLicao, contexto) {
    const origem = normalizarWrappers(html);
    const nos = analisarWrappers(origem);
    if (!nos.length) return { conteudo: origem, restaurar: valor => valor };

    const substituicoes = [];
    let resultado = "";
    let cursor = 0;

    for (let i = 0; i < nos.length; i++) {
        const no = nos[i];
        resultado += origem.slice(cursor, no.inicioTag);
        const conteudoInterno = origem.slice(no.fimAbertura, no.fimConteudo);
        const contextoFilho = `${contexto}.${i + 1}`;
        const htmlFilho = await processarComponente(
            no.tipo, conteudoInterno, numeroLicao, contextoFilho,
            { contexto: contextoFilho }
        );
        const token = criarToken(
            i + 1,
            contexto,
            origem,
            substituicoes.map(item => item.token)
        );
        substituicoes.push({ token, html: htmlFilho });
        resultado += token;
        cursor = no.fim;
    }
    resultado += origem.slice(cursor);

    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) saida = saida.split(item.token).join(item.html);
            return saida;
        }
    };
}

async function processarComponente(tipo, conteudo, numeroLicao, index, opcoes = {}) {
    const tipoNormalizado = normalizarTipo(String(tipo || ""));
    const componente = componentes[tipoNormalizado];
    if (typeof componente !== "function") {
        throw new Error(`Componente "${tipo}" não está cadastrado em ComponentesLista.js.`);
    }

    const contexto = opcoes.contexto || `${numeroLicao ?? 0}_${index ?? 0}`;
    const filhos = await processarFilhos(conteudo, numeroLicao, contexto);
    // Marcadores legados HOTWORD são isolados aqui, nunca dentro do componente pai.
    const hotwordsLegadas = tipoNormalizado === "hotword"
        ? { conteudo: filhos.conteudo, restaurar: valor => valor }
        : await protegerHotwordsLegadas(
            filhos.conteudo,
            numeroLicao,
            index,
            contexto,
        );

    let html;
    try {
        // Mantém a assinatura histórica: (conteudo, numeroLicao, index).
        html = await componente(hotwordsLegadas.conteudo, numeroLicao, index, opcoes);
    } catch (erro) {
        erro.message = `Componente "${tipoNormalizado}" (${contexto}): ${erro.message}`;
        throw erro;
    }
    if (typeof html !== "string") throw new Error(`O componente "${tipoNormalizado}" não retornou uma string HTML.`);
    return filhos.restaurar(hotwordsLegadas.restaurar(html));
}

function componenteExiste(tipo) {
    return typeof componentes[normalizarTipo(String(tipo || ""))] === "function";
}

module.exports = { processarComponente, analisarWrappers, componenteExiste, normalizarWrappers, normalizarMarcadoresLegados };
