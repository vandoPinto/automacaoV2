const { carregarTemplate } = require("../../Utils");
const { normalizarTextoHtml } = require("../../ValidarTabelasComponentes");
const { montarIdAudio } = require("../../ExtrairAudiosComponentes");

function extrairMarcadores(conteudo) {
    const origem = String(conteudo || "");
    const regex = /<(alternativa|correta|feedcerto|feederrado)\s*>/gi;
    const marcadores = [...origem.matchAll(regex)];
    return marcadores.map((marcador, indice) => {
        const nome = marcador[1].toLowerCase();
        const inicio = marcador.index + marcador[0].length;
        const fim = marcadores[indice + 1]?.index ?? origem.length;
        const fechamento = new RegExp(`<\\/${nome}\\s*>(?:\\s*<\\/(?:alternativa|componente)\\s*>)*\\s*$`, "i");
        return {
            nome,
            conteudo: origem.slice(inicio, fim)
                .replace(fechamento, "")
                .replace(/(?:<\/(?:componente|opcoes|verdadeirofalso)\s*>\s*)+$/i, "")
                .trim()
        };
    });
}

function normalizarResposta(valor) {
    return String(valor || "").trim().toLocaleLowerCase("pt-BR");
}

function escaparAtributo(valor) {
    return String(valor || "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[caractere]);
}

function prepararConteudo(valor) {
    return String(valor || "")
        .trim()
        .replace(/^<p\b[^>]*>/i, "")
        .replace(/<\/p>\s*<p\b[^>]*>/gi, "<br>")
        .replace(/<\/p>\s*$/i, "");
}

function interpretarRoteiro(conteudo) {
    const secoes = extrairMarcadores(conteudo);
    const frases = [];

    for (let indice = 0; indice < secoes.length; indice++) {
        if (secoes[indice].nome !== "alternativa") continue;
        const proximaFrase = secoes.findIndex((secao, posicao) =>
            posicao > indice && secao.nome === "alternativa"
        );
        const limite = proximaFrase < 0 ? secoes.length : proximaFrase;
        const resposta = secoes.slice(indice + 1, limite).find(secao => secao.nome === "correta");
        frases.push({
            texto: secoes[indice].conteudo,
            resposta: normalizarTextoHtml(resposta?.conteudo || "")
        });
    }

    const feedbackCertoInformado = secoes.find(secao => secao.nome === "feedcerto")?.conteudo || "";
    const feedbackErradoInformado = secoes.find(secao => secao.nome === "feederrado")?.conteudo || "";
    const possuiTexto = valor => Boolean(normalizarTextoHtml(valor) || /<(?:img|picture|svg|video|canvas|object|iframe|audio)\b/i.test(valor));

    return {
        frases,
        feedbackCerto: possuiTexto(feedbackCertoInformado) ? feedbackCertoInformado : "Parabéns, é isso mesmo!",
        feedbackErrado: possuiTexto(feedbackErradoInformado) ? feedbackErradoInformado : "Tente novamente, você consegue."
    };
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("verdadeirofalso");
    const roteiro = interpretarRoteiro(conteudo);
    const caminhoAudio = String(opcoes.prefixoAudio || "").replace(/[^a-zA-Z0-9_-]/g, "").split("_").filter(Boolean);
    const tipoAudio = String(opcoes.tipoAudio || "verdadeirofalso").replace(/[^a-zA-Z0-9_-]/g, "");
    const audioCerto = montarIdAudio(caminhoAudio, tipoAudio, 0);
    const audioErrado = montarIdAudio(caminhoAudio, tipoAudio, 1);
    const instancia = Math.random().toString(36).slice(2, 10);
    const idInstancia = `verdadeiro-falso-${instancia}`;
    const linhasHTML = roteiro.frases.map((frase, indice) => {
        const resposta = frase.resposta;
        const largura = Math.max(50, Math.min(180, Array.from(resposta).length * 10 + 24));
        const limiteResposta = Math.max(1, resposta.length);
        const textoAcessivel = normalizarTextoHtml(frase.texto) || `frase ${indice + 1}`;
        return `
            <label class="vf-linha">
                <input class="vf-resposta" type="text" inputmode="text" autocomplete="off" autocapitalize="off"
                    spellcheck="false" maxlength="${limiteResposta}" style="--vf-largura:${largura}px"
                    aria-label="Resposta para: ${escaparAtributo(textoAcessivel)}"
                    data-vf-resposta="${escaparAtributo(resposta)}">
                <span class="vf-frase">${prepararConteudo(frase.texto)}</span>
            </label>`;
    }).join("");

    return template
        .replace(/{{ID_INSTANCIA}}/g, () => idInstancia)
        .replace(/{{LINHAS}}/g, () => linhasHTML)
        .replace(/{{FEEDBACK_CERTO}}/g, () => roteiro.feedbackCerto)
        .replace(/{{FEEDBACK_ERRADO}}/g, () => roteiro.feedbackErrado)
        .replace(/{{AUDIO_CERTO}}/g, () => audioCerto)
        .replace(/{{AUDIO_ERRADO}}/g, () => audioErrado);
};

module.exports.interpretarRoteiro = interpretarRoteiro;
module.exports.normalizarResposta = normalizarResposta;
