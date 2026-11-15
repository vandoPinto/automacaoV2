const { carregarTemplate } = require("../../Utils");

/**
 * Encontra o fim de uma tag HTML, respeitando aspas nos atributos.
 * Isso evita interromper a leitura quando um atributo contém ">".
 */
function encontrarFimTag(html, inicio) {
    let aspas = null;

    for (let i = inicio + 1; i < html.length; i++) {
        const caractere = html[i];

        if (aspas) {
            if (caractere === aspas) aspas = null;
            continue;
        }

        if (caractere === '"' || caractere === "'") {
            aspas = caractere;
        } else if (caractere === ">") {
            return i + 1;
        }
    }

    return html.length;
}

/** Divide o fragmento em tokens sem modificar o HTML original. */
function tokenizarHTML(html) {
    const tokens = [];
    let cursor = 0;

    while (cursor < html.length) {
        const inicio = html.indexOf("<", cursor);

        if (inicio === -1) {
            tokens.push(html.slice(cursor));
            break;
        }

        if (inicio > cursor) tokens.push(html.slice(cursor, inicio));

        if (html.startsWith("<!--", inicio)) {
            const fimComentario = html.indexOf("-->", inicio + 4);
            const fim = fimComentario === -1 ? html.length : fimComentario + 3;
            tokens.push(html.slice(inicio, fim));
            cursor = fim;
            continue;
        }

        const fimTag = encontrarFimTag(html, inicio);
        tokens.push(html.slice(inicio, fimTag));
        cursor = fimTag;
    }

    return tokens;
}

const TAGS_VOID = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
]);

function identificarTag(token) {
    const match = token.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b/i);
    if (!match) return null;

    return {
        fechamento: Boolean(match[1]),
        nome: match[2].toLowerCase(),
        autoFechamento: /\/\s*>$/.test(token)
    };
}

/**
 * Separa somente elementos que estão no nível raiz do fragmento.
 * Assim, parágrafos completos nunca são cortados no meio de suas tags.
 */
function separarElementosRaiz(html) {
    const tokens = tokenizarHTML(html);
    const elementos = [];
    let pilha = [];
    let inicioElemento = -1;
    let textoRaiz = "";

    const adicionarTexto = () => {
        if (textoRaiz.trim()) elementos.push({ tipo: "texto", html: textoRaiz });
        textoRaiz = "";
    };

    for (const token of tokens) {
        const tag = identificarTag(token);

        if (!tag) {
            if (pilha.length) {
                // O texto pertence ao elemento raiz que está sendo acumulado.
                if (inicioElemento >= 0) {
                    elementos[elementos.length - 1].html += token;
                } else {
                    textoRaiz += token;
                }
            } else {
                textoRaiz += token;
            }
            continue;
        }

        if (!pilha.length && !tag.fechamento) {
            adicionarTexto();
            inicioElemento = elementos.length;
            elementos.push({ tipo: "elemento", html: token });
            if (!tag.autoFechamento && !TAGS_VOID.has(tag.nome)) pilha.push(tag.nome);
            else inicioElemento = -1;
            continue;
        }

        if (inicioElemento >= 0) {
            elementos[inicioElemento].html += token;
        } else if (!tag.fechamento) {
            // Tags isoladas no nível raiz, como <img>.
            adicionarTexto();
            elementos.push({ tipo: "elemento", html: token });
        }

        if (pilha.length) {
            if (tag.fechamento) {
                const indice = pilha.lastIndexOf(tag.nome);
                if (indice >= 0) pilha = pilha.slice(0, indice);
                if (!pilha.length) inicioElemento = -1;
            } else if (!tag.autoFechamento && !TAGS_VOID.has(tag.nome)) {
                pilha.push(tag.nome);
            }
        }
    }

    adicionarTexto();
    return elementos;
}

/**
 * Divide um parágrafo que contém imagem e texto, fechando e reabrindo
 * as formatações inline ao redor da imagem. A sequência original é mantida.
 */
function separarConteudoParagrafo(conteudo) {
    const tokens = tokenizarHTML(conteudo);
    const partes = [];
    const pilha = [];
    let atual = "";

    const fecharFormatacoes = () =>
        [...pilha].reverse().map(tag => `</${tag}>`).join("");

    const reabrirFormatacoes = () =>
        pilha.map(item => item.abertura).join("");

    const adicionarTexto = () => {
        if (atual.replace(/<[^>]*>/g, "").trim()) {
            partes.push({ tipo: "texto", html: atual });
        }
        atual = "";
    };

    for (const token of tokens) {
        const tag = identificarTag(token);

        if (tag && !tag.fechamento && tag.nome === "img") {
            atual += fecharFormatacoes();
            adicionarTexto();
            partes.push({ tipo: "imagem", html: token });
            atual = reabrirFormatacoes();
            continue;
        }

        atual += token;

        if (!tag) continue;

        if (tag.fechamento) {
            const indice = pilha.map(item => item.nome).lastIndexOf(tag.nome);
            if (indice >= 0) pilha.splice(indice, 1);
        } else if (!tag.autoFechamento && !TAGS_VOID.has(tag.nome)) {
            pilha.push({ nome: tag.nome, abertura: token });
        }
    }

    adicionarTexto();
    return partes;
}

function possuiConteudoVisivel(html) {
    const semTokens = String(html || "")
        .replace(/__HTML_COMPONENTE_FILHO_[\s\S]*?__|__HTML_HOTWORD_LEGADA_[\s\S]*?__/g, "x");
    const semTags = semTokens
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;|&#160;/gi, " ")
        .trim();

    // O contenteditable do Editor representa uma linha em branco intencional
    // como <div><br></div>. Ela não contém texto, mas é um separador visual
    // entre parágrafos e precisa sobreviver à montagem da pré-visualização.
    // Parágrafos vazios vindos do DOCX permanecem sujeitos à regra histórica.
    const separadorVisualDoEditor =
        /^<div\b[^>]*>[\s\S]*<\/div>$/i.test(String(html || "").trim()) &&
        /<br\b/i.test(html) &&
        !semTags;

    return Boolean(
        semTags ||
        /<img\b/i.test(html) ||
        /__HTML_(?:COMPONENTE_FILHO|HOTWORD_LEGADA)_/i.test(html) ||
        separadorVisualDoEditor
    );
}

/**
 * Monta a sequência semântica da tela:
 * - parágrafos consecutivos são agrupados em um único bloco de texto;
 * - imagens são blocos independentes;
 * - componentes aninhados permanecem como tokens no fluxo do texto;
 * - a ordem recebida é preservada.
 */
function organizarBlocos(conteudo) {
    const elementos = separarElementosRaiz(String(conteudo || ""));
    const blocos = [];

    const adicionarTexto = html => {
        if (!possuiConteudoVisivel(html)) return;

        const ultimo = blocos[blocos.length - 1];
        if (ultimo && ultimo.tipo === "texto") {
            ultimo.html += html;
        } else {
            blocos.push({ tipo: "texto", html });
        }
    };

    for (const elemento of elementos) {
        if (elemento.tipo === "texto") {
            adicionarTexto(elemento.html);
            continue;
        }

        const html = elemento.html.trim();
        if (!html) continue;

        const tagRaiz = identificarTag(html);

        if (tagRaiz?.nome === "img") {
            blocos.push({ tipo: "imagem", html });
            continue;
        }

        const paragrafo = html.match(/^<p\b([^>]*)>([\s\S]*)<\/p\s*>$/i);
        if (paragrafo && /<img\b/i.test(paragrafo[2])) {
            const abertura = `<p${paragrafo[1]}>`;
            const fechamento = "</p>";
            const partes = separarConteudoParagrafo(paragrafo[2]);

            for (const parte of partes) {
                if (parte.tipo === "imagem") {
                    blocos.push(parte);
                } else {
                    adicionarTexto(`${abertura}${parte.html}${fechamento}`);
                }
            }
            continue;
        }

        if (paragrafo) {
            adicionarTexto(html);
        } else {
            // Outros elementos (listas, tabelas, divs etc.) são preservados
            // integralmente para não alterar estruturas que o Texto não controla.
            adicionarTexto(html);
        }
    }

    return blocos;
}

/**
 * Divide o roteiro no marcador <dividir>. O marcador só altera a composição
 * visual da Tela; o conteúdo permanece na ordem em que foi escrito.
 */
function separarColunas(conteudo) {
    const tokens = tokenizarHTML(String(conteudo || ""));
    const colunas = [""];
    const pilha = [];
    let encontrouDividir = false;

    for (const token of tokens) {
        const tag = identificarTag(token);

        // DIVIDIR é um marcador vazio de nível raiz. A pilha evita interpretar
        // por engano uma tag com o mesmo nome dentro de outro bloco.
        if (tag?.nome === "dividir" && pilha.length === 0) {
            if (!tag.fechamento) {
                if (!encontrouDividir) {
                    colunas.push("");
                    encontrouDividir = true;
                }
            }
            continue;
        }

        colunas[colunas.length - 1] += token;
        if (!tag) continue;

        if (tag.fechamento) {
            const indice = pilha.lastIndexOf(tag.nome);
            if (indice >= 0) pilha.splice(indice, 1);
        } else if (!tag.autoFechamento && !TAGS_VOID.has(tag.nome)) {
            pilha.push(tag.nome);
        }
    }

    return { encontrouDividir, colunas };
}

function renderizarBlocos(blocos) {
    return blocos.map(bloco => {
        const classeAnimacao = bloco.tipo === "imagem"
            ? "animated fadeIn"
            : "animated backInLeft";

        return `<div class="conteudo-item conteudo-item-integral ${classeAnimacao}" data-tipo="${bloco.tipo}">${bloco.html}</div>`;
    }).join("\n");
}

function extrairTextoVisivel(html) {
    return String(html || "")
        .replace(/__HTML_(?:COMPONENTE_FILHO|HOTWORD_LEGADA)_[\s\S]*?__/g, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<(?:style|script)\b[^>]*>[\s\S]*?<\/(?:style|script)\s*>/gi, " ")
        .replace(/<br\b[^>]*>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&(?:amp|lt|gt|quot|apos);/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Gera o HTML do componente de texto preservando a ordem do DOCX.
 *
 * @param {string} conteudo HTML recebido após o processamento dos componentes filhos.
 * @param {number} numeroLicao Número da lição.
 * @param {number} index Número da tela.
 * @returns {Promise<string>}
 */
module.exports = async function (conteudo, numeroLicao, index) {
    let template = await carregarTemplate("tela");
    // Templates de componentes são blocos HTML, nunca filhos de <p>.
    // Remove apenas os parágrafos artificiais que envolvem style/script.
    const conteudoNormalizado = String(conteudo || "")
        .replace(/<p(?:\s[^>]*)?>\s*(?:<br\s*\/?>\s*)*(?=<(?:style|script)\b)/gi, "")
        .replace(/(<\/(?:style|script)>)(?:\s*<br\s*\/?>)*\s*<\/p>/gi, "$1");
    const divisao = separarColunas(conteudoNormalizado);
    const blocosFluxo = divisao.encontrouDividir ? [] : organizarBlocos(conteudoNormalizado);
    const possuiTextoGrande = blocosFluxo.some(bloco =>
        bloco.tipo === "texto" && extrairTextoVisivel(bloco.html).length > 320
    );
    const conteudoHTML = divisao.encontrouDividir
        ? `<div class="tela-colunas"><section class="tela-coluna tela-coluna-esquerda">${renderizarBlocos(organizarBlocos(divisao.colunas[0]))}</section><section class="tela-coluna tela-coluna-direita">${renderizarBlocos(organizarBlocos(divisao.colunas[1]))}</section></div>`
        : `<div class="tela-fluxo${possuiTextoGrande ? " tela-fluxo-largo" : ""}">${renderizarBlocos(blocosFluxo)}</div>`;

    template = template
        .replace(/{{CONTEUDO}}/g, conteudoHTML)
        .replace(/{{class}}/g, `licao${numeroLicao}_tela${index}`);

    return template;
};

module.exports.organizarBlocos = organizarBlocos;
module.exports.separarColunas = separarColunas;
