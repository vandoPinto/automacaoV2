const { carregarTemplate } = require("../../Utils");
const { normalizarTextoHtml } = require("../../ValidarTabelasComponentes");
const { montarIdAudio } = require("../../ExtrairAudiosComponentes");

let sequenciaInstancias = 0;

function extrairSecoes(conteudo) {
    const origem = String(conteudo || "")
        .replace(/&lt;\s*(\/?\s*)(palavra|dica|feedcerto|feederrado)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?\s*)(palavra|dica|feedcerto|feederrado)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?\s*)(palavra|dica|feedcerto|feederrado)\s*&#x3e;/gi, "<$1$2>");
    const marcadores = [...origem.matchAll(/<(palavra|dica|feedcerto|feederrado)\s*>/gi)];
    return marcadores.map((marcador, indice) => {
        const nome = marcador[1].toLowerCase();
        const inicio = marcador.index + marcador[0].length;
        const fim = marcadores[indice + 1]?.index ?? origem.length;
        const fechamento = new RegExp(`<\\/${nome}\\s*>(?:\\s*<\\/componente\\s*>)*\\s*$`, "i");
        return {
            nome,
            conteudo: origem.slice(inicio, fim)
                .replace(fechamento, "")
                .replace(/(?:<\/(?:componente|forca)\s*>\s*)+$/i, "")
                .trim()
        };
    });
}

function normalizarLetra(valor) {
    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleUpperCase("pt-BR");
}

function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
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
    const secoes = extrairSecoes(conteudo);
    const primeiro = nome => secoes.find(secao => secao.nome === nome)?.conteudo || "";
    const palavra = normalizarTextoHtml(primeiro("palavra"));
    const letras = Array.from(palavra).filter(caractere => /\p{L}/u.test(caractere));
    if (!palavra || !letras.length) {
        throw new Error("Informe uma palavra com pelo menos uma letra para a atividade de Forca.");
    }

    const feedbackCerto = primeiro("feedcerto");
    const feedbackErrado = primeiro("feederrado");
    return {
        palavra,
        dica: primeiro("dica"),
        feedbackCerto: normalizarTextoHtml(feedbackCerto) ? feedbackCerto : "Muito bem! Você descobriu a palavra!",
        feedbackErrado: normalizarTextoHtml(feedbackErrado) ? feedbackErrado : "A palavra era " + escaparHtml(palavra) + ". Tente novamente."
    };
}

function criarPalavraHtml(palavra) {
    return Array.from(palavra).map(caractere => {
        if (/\p{L}/u.test(caractere)) {
            return `<span class="forca-letra" data-forca-letra="${escaparHtml(normalizarLetra(caractere))}" aria-label="Letra oculta"><span class="forca-traco" aria-hidden="true">_</span><span class="forca-letra-revelada" hidden>${escaparHtml(caractere.toLocaleUpperCase("pt-BR"))}</span></span>`;
        }
        return `<span class="forca-simbolo" aria-hidden="true">${escaparHtml(caractere)}</span>`;
    }).join("");
}

function criarTecladoHtml() {
    return ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"].map(linha =>
        `<div class="forca-teclas-linha" role="group" aria-label="Teclas ${linha.split("").join(", ")}">` +
        Array.from(linha).map(letra =>
            `<button class="forca-tecla" type="button" data-forca-tecla="${letra}" aria-label="Letra ${letra}" aria-pressed="false">${letra}</button>`
        ).join("") +
        `</div>`
    ).join("");
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("forca");
    const dados = interpretarRoteiro(conteudo);
    const caminhoAudio = String(opcoes.prefixoAudio || "").replace(/[^a-zA-Z0-9_-]/g, "").split("_").filter(Boolean);
    const tipoAudio = String(opcoes.tipoAudio || "forca").replace(/[^a-zA-Z0-9_-]/g, "");
    const audioCerto = montarIdAudio(caminhoAudio, tipoAudio, 0);
    const audioErrado = montarIdAudio(caminhoAudio, tipoAudio, 1);
    sequenciaInstancias += 1;
    const idInstancia = `forca-${sequenciaInstancias}-${Math.random().toString(36).slice(2, 8)}`;
    const dica = normalizarTextoHtml(dados.dica)
        ? `<div class="forca-dica"><strong>Dica:</strong> ${prepararConteudo(dados.dica)}</div>`
        : "";

    return template
        .replace(/{{ID_INSTANCIA}}/g, () => idInstancia)
        .replace(/{{PALAVRA}}/g, () => criarPalavraHtml(dados.palavra))
        .replace(/{{DICA}}/g, () => dica)
        .replace(/{{TECLADO}}/g, () => criarTecladoHtml())
        .replace(/{{FEEDBACK_CERTO}}/g, () => dados.feedbackCerto)
        .replace(/{{FEEDBACK_ERRADO}}/g, () => dados.feedbackErrado)
        .replace(/{{AUDIO_CERTO}}/g, () => audioCerto)
        .replace(/{{AUDIO_ERRADO}}/g, () => audioErrado);
};

module.exports.interpretarRoteiro = interpretarRoteiro;
module.exports.normalizarLetra = normalizarLetra;

