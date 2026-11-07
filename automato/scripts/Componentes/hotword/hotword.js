// HOTWORD.js
// Componente independente: recebe seu texto, os marcadores <hotword>/<janela>
// e devolve o gatilho com sua própria janela. Componentes filhos são tratados
// previamente pelo ProcessarComponentesAninhados.js.
const { carregarTemplate, decodeHTML } = require("../../Utils");
const { montarIdAudio } = require("../../ExtrairAudiosComponentes");

function normalizarMarcadores(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?)\s*(hotword|janela)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?)\s*(hotword|janela)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?)\s*(hotword|janela)\s*&#x3e;/gi, "<$1$2>")
        .replace(
            /<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<hotword>\s*(?:<\/strong>\s*)?<\/p>/gi,
            "<hotword>"
        )
        .replace(
            /<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<janela>\s*(?:<\/strong>\s*)?<\/p>/gi,
            "<janela>"
        )
        .replace(/<strong\b[^>]*>\s*<hotword>\s*<\/strong>/gi, "<hotword>")
        .replace(/<strong\b[^>]*>\s*<janela>\s*<\/strong>/gi, "<janela>");
}

function escaparRegExp(valor) {
    return valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textoVisivel(html) {
    return decodeHTML(String(html || "").replace(/<[^>]*>/g, ""))
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Destaca uma ocorrência no texto, sem alterar tags ou formatações HTML. */
function destacarPrimeiraOcorrencia(html, palavra, id) {
    const partes = String(html || "").split(/(<[^>]+>)/g);
    const busca = new RegExp(escaparRegExp(palavra), "i");

    for (let i = 0; i < partes.length; i++) {
        if (i % 2 !== 0) continue;

        const correspondencia = partes[i].match(busca);
        if (!correspondencia) continue;

        const inicio = correspondencia.index;
        const original = correspondencia[0];

        partes[i] =
            partes[i].slice(0, inicio) +
            `<span class="hotword-gatilho" role="button" tabindex="0" aria-expanded="false" aria-controls="${id}" data-hotword-id="${id}">${original}</span>` +
            partes[i].slice(inicio + original.length);

        return { html: partes.join(""), encontrado: true };
    }

    return { html, encontrado: false };
}

function limparTitulo(html) {
    return String(html || "")
        .replace(/<\/?p\b[^>]*>/gi, " ")
        .trim();
}

function normalizarIdentificador(valor) {
    return String(valor ?? "0").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function criarId(numeroLicao, index, ordem, contexto) {
    const identidade = contexto || `${numeroLicao ?? "0"}-${index ?? "0"}`;
    return `hotword-${normalizarIdentificador(identidade)}-${ordem}`;
}

/**
 * Cria o gatilho na posição marcada pelo DOCX.
 * Quando o rótulo veio em um parágrafo próprio, mantém esse parágrafo;
 * quando veio no meio de uma frase, mantém o gatilho inline.
 */
function criarGatilhoNoMarcador(tituloHTML, id) {
    const titulo = String(tituloHTML || "").trim();
    const paragrafo = titulo.match(/^(\s*<p\b[^>]*>)([\s\S]*?)(<\/p\s*>\s*)$/i);

    if (paragrafo) {
        return `${paragrafo[1]}<span class="hotword-gatilho" role="button" tabindex="0" aria-expanded="false" aria-controls="${id}" data-hotword-id="${id}">${paragrafo[2]}</span>${paragrafo[3]}`;
    }

    return `<span class="hotword-gatilho" role="button" tabindex="0" aria-expanded="false" aria-controls="${id}" data-hotword-id="${id}">${titulo}</span>`;
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("hotword");
    const html = normalizarMarcadores(conteudo);

    const marcadores = [...html.matchAll(/<(hotword|janela)\s*>/gi)];
    let textos = html;
    const janelas = [];

    // Comportamento padrão: a expressão indicada entre <hotword> e <janela>
    // é procurada no texto anterior. A primeira ocorrência vira o gatilho.
    if (marcadores.length) {
        textos = html.slice(0, marcadores[0].index).trim();

        for (let i = 0; i < marcadores.length; i++) {
            const marcadorHotword = marcadores[i];
            if (marcadorHotword[1].toLowerCase() !== "hotword") continue;

            const marcadorJanela = marcadores[i + 1];
            if (!marcadorJanela || marcadorJanela[1].toLowerCase() !== "janela") {
                console.warn("HOTWORD: marcador <hotword> sem o marcador <janela> correspondente.");
                continue;
            }

            const tituloHTML = limparTitulo(
                html.slice(
                    marcadorHotword.index + marcadorHotword[0].length,
                    marcadorJanela.index
                )
            );
            const proximoMarcador = marcadores[i + 2];
            const explicacao = html.slice(
                marcadorJanela.index + marcadorJanela[0].length,
                proximoMarcador ? proximoMarcador.index : html.length
            ).trim();
            const tituloTexto = textoVisivel(tituloHTML);

            if (!tituloTexto) {
                console.warn("HOTWORD: foi encontrada uma sequência sem título.");
                i++;
                continue;
            }

            const id = criarId(numeroLicao, index, janelas.length + 1, opcoes.contexto);
            const resultado = destacarPrimeiraOcorrencia(textos, tituloTexto, id);

            if (!resultado.encontrado) {
                console.warn(`HOTWORD: a expressão "${tituloTexto}" não foi encontrada no texto anterior.`);
                i++;
                continue;
            }

            textos = resultado.html;
            janelas.push({ id, titulo: tituloHTML, explicacao });
            i++;
        }
    }

    const caminhoAudio = String(opcoes.prefixoAudio || "")
        .split("_")
        .filter(Boolean);
    const tipoAudioHotword = opcoes.tipoAudio || opcoes.tipoAudioHotword || "hotword";
    const janelasHTML = janelas.map(({ id, titulo, explicacao }, indice) => {
        const audioId = montarIdAudio(caminhoAudio, tipoAudioHotword, indice);
        return `
        <div class="hotword-janela" id="${id}" data-hotword-painel="${id}"
            data-audio-id="${audioId}"
            role="dialog" aria-modal="false" aria-hidden="true" hidden>
            <button class="hotword-fechar" type="button" aria-label="Fechar janela">×</button>
            <div class="hotword-titulo">${titulo}</div>
            <div class="hotword-explicacao">${explicacao}</div>
        </div>
    `;
    }).join("\n");

    const contexto = opcoes.contexto || `${numeroLicao ?? "0"}-${index ?? "0"}`;
    const idComponente = `hotword-componente-${normalizarIdentificador(contexto)}`;
    const classe = `licao${normalizarIdentificador(numeroLicao)}_tela${normalizarIdentificador(index)}`;

    return template
        .replace(/{{ID_COMPONENTE}}/g, () => idComponente)
        .replace(/{{MODO}}/g, () => opcoes.inline ? "hotword-componente-inline" : "")
        // HOTWORD não cria mais o container genérico usado pela estrutura antiga.
        .replace(/{{CLASSE_CONTAINER}}/g, "")
        .replace(/{{CLASS}}/g, () => classe)
        .replace(/{{TEXTOS}}/g, () => textos)
        .replace(/{{JANELAS}}/g, () => janelasHTML);
};
