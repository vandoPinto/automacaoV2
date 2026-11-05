const { carregarTemplate } = require("../../Utils");

let sequenciaInstancias = 0;

function normalizarMarcadores(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?)\s*(botao|janela)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?)\s*(botao|janela)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?)\s*(botao|janela)\s*&#x3e;/gi, "<$1$2>")
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(botao|janela)>\s*(?:<\/strong>\s*)?<\/p>/gi, "<$1>")
        .replace(/<strong\b[^>]*>\s*<(botao|janela)>\s*<\/strong>/gi, "<$1>");
}

function temConteudo(html) {
    const valor = String(html || "");
    const texto = valor
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

    return Boolean(texto || /<(?:img|picture|svg|video|canvas|object|iframe)\b/i.test(valor));
}

function criarId(numeroLicao, index, opcoes = {}) {
    sequenciaInstancias += 1;
    const contexto = String(opcoes.contexto || `${numeroLicao ?? 0}_${index ?? 0}`)
        .replace(/[^a-zA-Z0-9_-]/g, "-");
    return `sanfona-${contexto}-${sequenciaInstancias}`;
}

/**
 * Converte os marcadores sequenciais <botao>/<janela> em painéis de sanfona.
 * O primeiro marcador define o título e a janela seguinte define seu conteúdo.
 */
function processarPares(html, idInstancia) {
    const origem = normalizarMarcadores(html);
    const regex = /<(botao|janela)\s*>/gi;
    const marcadores = [...origem.matchAll(regex)];

    if (!marcadores.length) {
        throw new Error("Nenhum painel foi encontrado no componente SANFONA.");
    }

    const rotulos = [];
    const janelas = [];

    for (let i = 0; i < marcadores.length; i++) {
        const marcador = marcadores[i];
        const inicio = marcador.index + marcador[0].length;
        const proximo = marcadores[i + 1];
        const fim = proximo ? proximo.index : origem.length;
        const trecho = origem.slice(inicio, fim).trim();

        if (marcador[1].toLowerCase() === "botao") rotulos.push(trecho);
        else janelas.push(trecho);
    }

    if (rotulos.length !== janelas.length) {
        throw new Error(
            `A quantidade de marcadores <botao> (${rotulos.length}) é diferente da quantidade de <janela> (${janelas.length}) na SANFONA.`
        );
    }

    const paineisHTML = rotulos.map((rotulo, indice) => {
        const conteudo = janelas[indice];

        if (!temConteudo(rotulo)) {
            throw new Error(`O título do painel ${indice + 1} da SANFONA está vazio.`);
        }
        if (!temConteudo(conteudo)) {
            throw new Error(`O conteúdo do painel ${indice + 1} da SANFONA está vazio.`);
        }

        const idBotao = `${idInstancia}-botao-${indice + 1}`;
        const idPainel = `${idInstancia}-painel-${indice + 1}`;

        return `
            <section class="sanfona-item">
                <h3 class="sanfona-cabecalho">
                    <button
                        class="sanfona-botao"
                        type="button"
                        id="${idBotao}"
                        aria-expanded="false"
                        aria-controls="${idPainel}">
                        <span class="sanfona-titulo">${rotulo}</span>
                        <span class="sanfona-icone" aria-hidden="true"></span>
                    </button>
                </h3>
                <div
                    class="sanfona-painel"
                    id="${idPainel}"
                    role="region"
                    aria-labelledby="${idBotao}"
                    hidden>
                    <div class="sanfona-conteudo">${conteudo}</div>
                </div>
            </section>`;
    }).join("\n");

    return { paineisHTML };
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("sanfona");
    const idInstancia = criarId(numeroLicao, index, opcoes);
    const resultado = processarPares(conteudo, idInstancia);

    return template
        .replace(/{{ID_COMPONENTE}}/g, () => idInstancia)
        .replace(/{{PAINEIS}}/g, () => resultado.paineisHTML);
};

module.exports.processarPares = processarPares;
