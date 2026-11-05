// HOTWORD.js
// Interpreta o conteúdo do Word e gera palavras interativas com suas respectivas janelas.
const { carregarTemplate, decodeHTML } = require("../../Utils");

/**
 * Converte apenas os marcadores do componente para tags reconhecíveis,
 * sem decodificar desnecessariamente o restante do HTML recebido do Mammoth.
 */
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

function escaparHTML(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function textoVisivel(html) {
    return decodeHTML(String(html || "").replace(/<[^>]*>/g, ""))
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Substitui a primeira ocorrência da palavra em um nó de texto,
 * preservando as tags HTML e a formatação do documento.
 */
function destacarPrimeiraOcorrencia(html, palavra, id) {
    const partes = String(html || "").split(/(<[^>]+>)/g);
    const busca = new RegExp(escaparRegExp(palavra), "i");

    for (let i = 0; i < partes.length; i++) {
        // Os índices ímpares são tags HTML; não devem ser alterados.
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
        .replace(/^\s+|\s+$/g, "");
}

function criarId(numeroLicao, index, ordem) {
    const parteLicao = String(numeroLicao ?? "0").replace(/[^a-zA-Z0-9_-]/g, "");
    const parteTela = String(index ?? "0").replace(/[^a-zA-Z0-9_-]/g, "");
    return `hotword-${parteLicao}-${parteTela}-${ordem}`;
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    let template = await carregarTemplate("hotword");
    const html = normalizarMarcadores(conteudo);

    const marcadores = [...html.matchAll(/<(hotword|janela)\s*>/gi)];
    let textos = html;
    const janelas = [];

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
                html.slice(marcadorHotword.index + marcadorHotword[0].length, marcadorJanela.index)
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

            const id = criarId(numeroLicao, index, janelas.length + 1);
            const resultado = destacarPrimeiraOcorrencia(textos, tituloTexto, id);
            textos = resultado.html;

            // HOTWORD sempre utiliza uma ocorrência existente no texto.
            // Não cria um gatilho/botão artificial quando a palavra não é encontrada.
            if (!resultado.encontrado) {
                console.warn(`HOTWORD: a expressão "${tituloTexto}" não foi encontrada no texto original.`);
                i++;
                continue;
            }

            janelas.push({
                id,
                titulo: tituloHTML,
                explicacao
            });

            i++;
        }
    }

    const janelasHTML = janelas.map(({ id, titulo, explicacao }) => `
        <div class="hotword-janela" id="${id}" data-hotword-painel="${id}" role="dialog" aria-modal="false" aria-hidden="true" hidden>
            <button class="hotword-fechar" type="button" aria-label="Fechar janela">×</button>
            <div class="hotword-titulo">${titulo}</div>
            <div class="hotword-explicacao">${explicacao}</div>
        </div>
    `).join("\n");

    const classe = `licao${String(numeroLicao ?? "").replace(/[^a-zA-Z0-9_-]/g, "")}_tela${String(index ?? "").replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const idComponente = `hotword-componente-${String(numeroLicao ?? "0").replace(/[^a-zA-Z0-9_-]/g, "")}-${String(index ?? "0").replace(/[^a-zA-Z0-9_-]/g, "")}`;

    template = template
        .replace(/{{ID_COMPONENTE}}/g, () => idComponente)
        .replace(/{{MODO}}/g, () => opcoes.inline ? "hotword-componente-inline" : "")
        .replace(/{{CLASSE_CONTAINER}}/g, () => opcoes.inline ? "" : "container")
        .replace(/{{CLASS}}/g, () => classe)
        .replace(/{{TEXTOS}}/g, () => textos)
        .replace(/{{JANELAS}}/g, () => janelasHTML);

    return template;
};
