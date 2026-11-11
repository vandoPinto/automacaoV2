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
        const fechamento = new RegExp(`<\\/${nome}\\s*>\\s*(?:<\\/componente\\s*>\\s*)*$`, "i");
        const valor = origem.slice(inicio, fim)
            .replace(fechamento, "")
            .replace(/(?:<\/(?:componente|opcoes|verdadeirofalso)\s*>\s*)+$/i, "")
            .trim();
        return {
            nome,
            conteudo: valor
        };
    });
}

function normalizarResposta(valor) {
    return String(valor || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&atilde;/gi, "ã")
        .replace(/&aacute;/gi, "á")
        .replace(/&ccedil;/gi, "ç")
        .replace(/&otilde;/gi, "õ")
        .replace(/&uacute;/gi, "ú")
        .replace(/&ecirc;/gi, "ê")
        .replace(/&eacute;/gi, "é")
        .replace(/&iacute;/gi, "í")
        .replace(/&oacute;/gi, "ó")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function prepararConteudoAlternativa(valor) {
    return String(valor || "")
        .trim()
        .replace(/^<p\b[^>]*>/i, "")
        .replace(/<\/p>\s*<p\b[^>]*>/gi, "<br>")
        .replace(/<\/p>\s*$/i, "");
}

function interpretarRoteiro(conteudo) {
    const secoes = extrairMarcadores(conteudo);
    const feedbackCertoInformado = secoes.find(secao => secao.nome === "feedcerto")?.conteudo || "";
    const feedbackErradoInformado = secoes.find(secao => secao.nome === "feederrado")?.conteudo || "";
    const possuiTexto = valor => Boolean(normalizarTextoHtml(valor) || /<(?:img|picture|svg|video|canvas|object|iframe|audio)\b/i.test(valor));
    const feedbackCerto = possuiTexto(feedbackCertoInformado)
        ? feedbackCertoInformado
        : "Correto! Você acertou.";
    const feedbackErrado = possuiTexto(feedbackErradoInformado)
        ? feedbackErradoInformado
        : "Não foi dessa vez. Tente novamente.";
    const alternativas = [];

    for (let indice = 0; indice < secoes.length; indice++) {
        if (secoes[indice].nome !== "alternativa") continue;
        const proximaAlternativa = secoes.findIndex((secao, posicao) =>
            posicao > indice && secao.nome === "alternativa"
        );
        const limite = proximaAlternativa < 0 ? secoes.length : proximaAlternativa;
        const marcadorCorreta = secoes.slice(indice + 1, limite)
            .find(secao => secao.nome === "correta");

        alternativas.push({
            texto: secoes[indice].conteudo,
            correta: normalizarResposta(marcadorCorreta?.conteudo) === "sim"
        });
    }

    return { alternativas, feedbackCerto, feedbackErrado };
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("opcoes");
    const roteiro = interpretarRoteiro(conteudo);
    const caminhoAudio = String(opcoes.prefixoAudio || "").replace(/[^a-zA-Z0-9_-]/g, "").split("_").filter(Boolean);
    const tipoAudio = String(opcoes.tipoAudio || "opcoes").replace(/[^a-zA-Z0-9_-]/g, "");
    const audioCerto = montarIdAudio(caminhoAudio, tipoAudio, 0);
    const audioErrado = montarIdAudio(caminhoAudio, tipoAudio, 1);
    const instancia = Math.random().toString(36).slice(2, 10);
    const idInstancia = `opcoes-instancia-${instancia}`;
    const alternativasHTML = roteiro.alternativas.map((alternativa, indice) => `
        <label class="opcoes-alternativa">
            <input class="opcoes-checkbox" type="checkbox" name="${idInstancia}" value="${indice}"
                data-opcoes-correta="${alternativa.correta}">
            <span class="opcoes-alternativa-texto">${prepararConteudoAlternativa(alternativa.texto)}</span>
        </label>`).join("");

    return template
        .replace(/{{ID_INSTANCIA}}/g, idInstancia)
        .replace(/{{ALTERNATIVAS}}/g, alternativasHTML)
        .replace(/{{FEEDBACK_CERTO}}/g, roteiro.feedbackCerto)
        .replace(/{{FEEDBACK_ERRADO}}/g, roteiro.feedbackErrado)
        .replace(/{{AUDIO_CERTO}}/g, audioCerto)
        .replace(/{{AUDIO_ERRADO}}/g, audioErrado);
};

module.exports.interpretarRoteiro = interpretarRoteiro;
