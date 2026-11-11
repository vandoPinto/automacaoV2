const { carregarTemplate } = require("../../Utils");
const { normalizarTextoHtml } = require("../../ValidarTabelasComponentes");
const { montarIdAudio } = require("../../ExtrairAudiosComponentes");

let sequenciaInstancias = 0;

function normalizarMarcadores(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?\s*)(modo|opcao|resposta|feedcerto|feederrado|feedbackcerto|feedbackerrado)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?\s*)(modo|opcao|resposta|feedcerto|feederrado|feedbackcerto|feedbackerrado)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?\s*)(modo|opcao|resposta|feedcerto|feederrado|feedbackcerto|feedbackerrado)\s*&#x3e;/gi, "<$1$2>")
        .replace(/<(\/?\s*)feedbackcerto\s*>/gi, "<$1feedcerto>")
        .replace(/<(\/?\s*)feedbackerrado\s*>/gi, "<$1feederrado>")
        .replace(/<\/(modo|opcao|resposta|feedcerto|feederrado)\s*>/gi, "");
}

function extrairSecoes(conteudo) {
    const origem = normalizarMarcadores(conteudo);
    const regex = /<(modo|opcao|resposta|feedcerto|feederrado)\s*>/gi;
    const marcadores = [...origem.matchAll(regex)];
    return marcadores.map((marcador, indice) => {
        const inicio = marcador.index + marcador[0].length;
        const fim = marcadores[indice + 1]?.index ?? origem.length;
        return {
            nome: marcador[1].toLowerCase(),
            conteudo: origem.slice(inicio, fim)
                .replace(/(?:<\/(?:componente|relacionarcolunas)\s*>\s*)+$/i, "")
                .trim()
        };
    });
}

function normalizarModo(valor) {
    const modo = normalizarTextoHtml(valor)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/\s+/g, " ")
        .trim();
    if (/^numero(?:s)?$/.test(modo)) return "numero";
    if (/^(?:letra(?:s)?|letra ou numero(?:s)?)$/.test(modo)) return "letra";
    throw new Error("O formato dos identificadores deve ser LETRA ou NÚMERO.");
}

function interpretarRoteiro(conteudo) {
    const secoes = extrairSecoes(conteudo);
    const pares = [];
    let modo = "letra";
    let encontrouModo = false;
    let opcaoPendente = null;
    let feedbackCerto = "";
    let feedbackErrado = "";
    let iniciouFeedback = false;

    for (const secao of secoes) {
        if (secao.nome === "modo") {
            if (encontrouModo) throw new Error("Informe apenas um formato para os identificadores.");
            modo = normalizarModo(secao.conteudo);
            encontrouModo = true;
            continue;
        }

        if (secao.nome === "opcao") {
            if (iniciouFeedback) throw new Error("Os pares precisam aparecer antes dos feedbacks.");
            if (opcaoPendente) throw new Error("Há um item sem resposta correspondente.");
            if (!normalizarTextoHtml(secao.conteudo)) throw new Error(`O item ${pares.length + 1} da primeira coluna está vazio.`);
            opcaoPendente = secao.conteudo;
            continue;
        }

        if (secao.nome === "resposta") {
            if (iniciouFeedback) throw new Error("Os pares precisam aparecer antes dos feedbacks.");
            if (!opcaoPendente) throw new Error("Há uma resposta sem o item correspondente da primeira coluna.");
            if (!normalizarTextoHtml(secao.conteudo)) throw new Error(`A resposta ${pares.length + 1} da segunda coluna está vazia.`);
            pares.push({ opcao: opcaoPendente, resposta: secao.conteudo });
            opcaoPendente = null;
            continue;
        }

        iniciouFeedback = true;
        if (opcaoPendente) throw new Error("O último item da primeira coluna está sem resposta correspondente.");
        if (secao.nome === "feedcerto") {
            if (feedbackCerto) throw new Error("Informe apenas um feedback de acerto.");
            feedbackCerto = secao.conteudo;
        } else {
            if (feedbackErrado) throw new Error("Informe apenas um feedback de erro.");
            feedbackErrado = secao.conteudo;
        }
    }

    if (opcaoPendente) throw new Error("O último item da primeira coluna está sem resposta correspondente.");
    if (!encontrouModo) throw new Error("Informe o formato dos identificadores: LETRA ou NÚMERO.");
    if (!pares.length) throw new Error("A atividade precisa ter pelo menos um par de itens.");

    return {
        modo,
        pares: pares.map((par, indice) => ({ ...par, identificador: modo === "numero" ? String(indice + 1) : criarLetra(indice) })),
        feedbackCerto: normalizarTextoHtml(feedbackCerto) ? feedbackCerto : "Parabéns, é isso mesmo!",
        feedbackErrado: normalizarTextoHtml(feedbackErrado) ? feedbackErrado : "Tente novamente, você consegue."
    };
}

function criarLetra(indice) {
    let numero = indice + 1;
    let resultado = "";
    while (numero > 0) {
        numero -= 1;
        resultado = String.fromCharCode(65 + (numero % 26)) + resultado;
        numero = Math.floor(numero / 26);
    }
    return resultado;
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

function embaralhar(pares) {
    const resultado = [...pares];
    for (let indice = resultado.length - 1; indice > 0; indice--) {
        const destino = Math.floor(Math.random() * (indice + 1));
        [resultado[indice], resultado[destino]] = [resultado[destino], resultado[indice]];
    }
    return resultado;
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("relacionarcolunas");
    const dados = interpretarRoteiro(conteudo);
    const caminhoAudio = String(opcoes.prefixoAudio || "").replace(/[^a-zA-Z0-9_-]/g, "").split("_").filter(Boolean);
    const tipoAudio = String(opcoes.tipoAudio || "relacionarcolunas").replace(/[^a-zA-Z0-9_-]/g, "");
    const audioCerto = montarIdAudio(caminhoAudio, tipoAudio, 0);
    const audioErrado = montarIdAudio(caminhoAudio, tipoAudio, 1);
    sequenciaInstancias += 1;
    const idInstancia = `relacionar-colunas-${sequenciaInstancias}-${Math.random().toString(36).slice(2, 8)}`;

    const itensEsquerda = dados.pares.map(par => `
        <div class="rc-item rc-item-origem" role="listitem" aria-label="${escaparAtributo(`${par.identificador}: ${normalizarTextoHtml(par.opcao)}`)}">
            <span class="rc-identificador" aria-hidden="true">${par.identificador}</span>
            <span class="rc-conteudo">${prepararConteudo(par.opcao)}</span>
        </div>`).join("");

    const itensDireita = embaralhar(dados.pares).map((par, indice) => `
        <label class="rc-item rc-item-resposta" role="listitem">
            <input class="rc-input" type="text" inputmode="${dados.modo === "numero" ? "numeric" : "text"}"
                maxlength="${par.identificador.length}" autocomplete="off" autocapitalize="characters"
                spellcheck="false" aria-label="Identificador correspondente a ${escaparAtributo(normalizarTextoHtml(par.resposta))}"
                data-rc-resposta="${escaparAtributo(par.identificador)}" data-rc-input="${indice + 1}">
            <span class="rc-conteudo">${prepararConteudo(par.resposta)}</span>
        </label>`).join("");

    return template
        .replace(/{{ID_INSTANCIA}}/g, () => idInstancia)
        .replace(/{{ITENS_ESQUERDA}}/g, () => itensEsquerda)
        .replace(/{{ITENS_DIREITA}}/g, () => itensDireita)
        .replace(/{{FEEDBACK_CERTO}}/g, () => dados.feedbackCerto)
        .replace(/{{FEEDBACK_ERRADO}}/g, () => dados.feedbackErrado)
        .replace(/{{AUDIO_CERTO}}/g, () => audioCerto)
        .replace(/{{AUDIO_ERRADO}}/g, () => audioErrado);
};

module.exports.interpretarRoteiro = interpretarRoteiro;
module.exports.normalizarModo = normalizarModo;
module.exports.criarLetra = criarLetra;
module.exports.embaralhar = embaralhar;
