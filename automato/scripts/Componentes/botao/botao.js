// BOTAO.js
// Processa exclusivamente os marcadores próprios do componente BOTAO.
const { carregarTemplate } = require("../../Utils");

function normalizarMarcadores(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?)\s*(botao|janela)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?)\s*(botao|janela)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?)\s*(botao|janela)\s*&#x3e;/gi, "<$1$2>")
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(botao|janela)>\s*(?:<\/strong>\s*)?<\/p>/gi, "<$1>")
        .replace(/<strong\b[^>]*>\s*<(botao|janela)>\s*<\/strong>/gi, "<$1>");
}

function textoVisivel(html) {
    return String(html || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
}

function temConteudo(html) {
    return Boolean(textoVisivel(html) || /<(?:img|picture|svg|video|canvas|object|iframe)\b/i.test(String(html || "")));
}

function criarId(numeroLicao, index) {
    const licao = String(numeroLicao ?? "0").replace(/[^a-zA-Z0-9_-]/g, "");
    const tela = String(index ?? "0").replace(/[^a-zA-Z0-9_-]/g, "");
    return `botao-componente-${licao}-${tela}`;
}

/** Identifica somente os marcadores próprios do BOTAO. */
function obterMarcadoresDoBotao(html) {
    return [...html.matchAll(/<(botao|janela)\s*>/gi)];
}

module.exports = async function (conteudo, numeroLicao, index) {
    const template = await carregarTemplate("botao");
    const html = normalizarMarcadores(conteudo);
    const marcadores = obterMarcadoresDoBotao(html);

    let introducao = html;
    const rotulos = [];
    const explicacoes = [];

    if (marcadores.length) {
        introducao = html.slice(0, marcadores[0].index).trim();

        for (let i = 0; i < marcadores.length; i++) {
            const marcador = marcadores[i];
            const inicio = marcador.index + marcador[0].length;
            const proximo = marcadores[i + 1];
            const fim = proximo ? proximo.index : html.length;
            const trecho = html.slice(inicio, fim).trim();

            if (marcador[1].toLowerCase() === "botao") {
                if (temConteudo(trecho)) rotulos.push(trecho);
                else console.warn("BOTAO: foi encontrado um botão sem rótulo.");
            } else if (marcador[1].toLowerCase() === "janela") {
                if (temConteudo(trecho)) explicacoes.push(trecho);
                else console.warn("BOTAO: foi encontrada uma janela sem conteúdo.");
            }
        }
    }

    const quantidade = Math.min(rotulos.length, explicacoes.length);
    if (rotulos.length !== explicacoes.length) {
        console.warn(
            `BOTAO: quantidade diferente de marcadores: ${rotulos.length} botão(ões) e ${explicacoes.length} janela(s). ` +
            `Serão gerados ${quantidade} par(es).`
        );
    }

    const itens = Array.from({ length: quantidade }, (_, indice) => ({
        rotulo: rotulos[indice],
        explicacao: explicacoes[indice]
    }));

    const idComponente = criarId(numeroLicao, index);

    const botoesHTML = itens.map((item, indice) => {
        const idJanela = `${idComponente}-janela-${indice + 1}`;
        const classeImagem = /<(?:img|picture|svg)\b/i.test(item.rotulo)
            ? " botao-item-com-imagem"
            : "";

        return `
            <button class="botao-item${classeImagem}" type="button"
                data-botao-alvo="${idJanela}"
                aria-controls="${idJanela}"
                aria-expanded="false">
                ${item.rotulo}
            </button>`;
    }).join("\n");

    const janelasHTML = itens.map((item, indice) => {
        const idJanela = `${idComponente}-janela-${indice + 1}`;
        return `
            <div class="botao-janela" id="${idJanela}" data-botao-janela="${idJanela}"
                role="dialog" aria-modal="true" aria-hidden="true" hidden>
                <div class="botao-janela-conteudo">
                    <button class="botao-fechar" type="button" aria-label="Fechar janela">×</button>
                    <div class="botao-janela-texto">${item.explicacao}</div>
                </div>
            </div>`;
    }).join("\n");

    return template
        .replace(/{{ID_COMPONENTE}}/g, () => idComponente)
        .replace(/{{INTRODUCAO}}/g, () => introducao)
        .replace(/{{BOTOES}}/g, () => botoesHTML)
        .replace(/{{JANELAS}}/g, () => janelasHTML);
};
