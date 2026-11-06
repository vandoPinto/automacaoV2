// BOTAO.js
// Componente independente: transforma marcadores <botao>/<janela> em
// gatilhos e janelas, sem criar uma tela ou um container de layout próprio.
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
    const texto = String(html || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

    return Boolean(texto || /<(?:img|picture|svg|video|canvas|object|iframe)\b/i.test(String(html || "")));
}

function criarId(numeroLicao, index, opcoes = {}) {
    sequenciaInstancias += 1;
    const contexto = String(opcoes.contexto || `${numeroLicao ?? 0}_${index ?? 0}`)
        .replace(/[^a-zA-Z0-9_-]/g, "-");
    return `botao-${contexto}-${sequenciaInstancias}`;
}

/**
 * Processa pares sequenciais:
 * <botao>rótulo</botao><janela>conteúdo</janela>
 *
 * O texto anterior e posterior aos pares permanece exatamente no fluxo
 * original. A janela é associada ao botão imediatamente anterior.
 */
function processarPares(html, idInstancia, prefixoAudio = "") {
    const origem = normalizarMarcadores(html);
    const regex = /<(botao|janela)\s*>/gi;
    const marcadores = [...origem.matchAll(regex)];

    if (!marcadores.length) {
        return { introducao: origem, botoesHTML: "" };
    }

    const introducao = origem.slice(0, marcadores[0].index);
    const rotulos = [];
    const janelas = [];

    // Cada marcador delimita o conteúdo até o próximo marcador estrutural.
    // Essa leitura aceita tanto pares sequenciais BOTAO/JANELA quanto a
    // disposição legada com vários BOTAO seguidos de várias JANELAS.
    for (let i = 0; i < marcadores.length; i++) {
        const marcador = marcadores[i];
        const inicio = marcador.index + marcador[0].length;
        const proximo = marcadores[i + 1];
        const fim = proximo ? proximo.index : origem.length;
        const trecho = origem.slice(inicio, fim);

        if (marcador[1].toLowerCase() === "botao") rotulos.push(trecho);
        else janelas.push(trecho);
    }

    if (rotulos.length !== janelas.length) {
        throw new Error(
            `A quantidade de marcadores <botao> (${rotulos.length}) é diferente da quantidade de <janela> (${janelas.length}).`
        );
    }

    const botoesHTML = rotulos.map((rotulo, indice) => {
        const conteudoJanela = janelas[indice];

        if (!temConteudo(rotulo)) {
            throw new Error(`O botão ${indice + 1} está sem rótulo ou imagem.`);
        }
        if (!temConteudo(conteudoJanela)) {
            throw new Error(`A janela do botão ${indice + 1} está vazia.`);
        }

        const idJanela = `${idInstancia}-janela-${indice + 1}`;
        let numeroAudio = indice + 1;
        let sufixoAudio = "";
        while (numeroAudio > 0) {
            numeroAudio--;
            sufixoAudio = String.fromCharCode(97 + (numeroAudio % 26)) + sufixoAudio;
            numeroAudio = Math.floor(numeroAudio / 26);
        }
        const audioId = `${prefixoAudio ? prefixoAudio + "_" : ""}botoes_${sufixoAudio}`;
        const classeImagem = /<(?:img|picture|svg)\b/i.test(rotulo)
            ? " botao-item-com-imagem"
            : "";

        return `
            <button class="botao-item${classeImagem}" type="button"
                data-botao-instancia="${idInstancia}"
                data-botao-alvo="${idJanela}"
                aria-controls="${idJanela}"
                aria-expanded="false">
                ${rotulo}
            </button>
            <div class="botao-janela" id="${idJanela}"
                data-botao-instancia="${idInstancia}"
                data-botao-janela="${idJanela}"
                data-audio-id="${audioId}"
                role="dialog" aria-modal="true" aria-hidden="true" hidden>
                <div class="botao-janela-conteudo">
                    <button class="botao-fechar" type="button" aria-label="Fechar janela">×</button>
                    <div class="botao-janela-texto">${conteudoJanela}</div>
                </div>
            </div>`;
    }).join("\n");

    const grupoBotoes = `
        <div class="botao-grupo" role="group" aria-label="Opções">
            ${botoesHTML}
        </div>`;

    return {
        introducao: introducao + grupoBotoes,
        botoesHTML: grupoBotoes
    };
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("botao");
    const idInstancia = criarId(numeroLicao, index, opcoes);
    const prefixoAudio = String(opcoes.prefixoAudio || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const resultado = processarPares(conteudo, idInstancia, prefixoAudio);

    return template
        .replace(/{{CONTEUDO}}/g, () => resultado.introducao)
        .replace(/{{ID_INSTANCIA}}/g, () => idInstancia)
        .replace(/{{PREFIXO_AUDIO}}/g, () => prefixoAudio);
};

module.exports.processarPares = processarPares;
