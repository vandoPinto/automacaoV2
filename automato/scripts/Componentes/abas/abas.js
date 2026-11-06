const { carregarTemplate } = require("../../Utils");
const { montarIdAudio } = require("../../ExtrairAudiosComponentes");

/**
 * Componente ABAS independente.
 *
 * Recebe somente a estrutura:
 * <abas>
 *   <aba>Rótulo da aba</aba>
 *   ...
 *   <janela>Conteúdo da aba</janela>
 *   ...
 * </abas>
 *
 * O texto introdutório permanece no fluxo da Tela.
 * Componentes filhos declarados com <componente tipo="..."> são processados
 * previamente pelo ProcessarComponentesAninhados.js.
 */
module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("abas");
    const origem = String(conteudo || "")
        .replace(/&lt;\s*(\/?)\s*(aba|janela)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?)\s*(aba|janela)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?)\s*(aba|janela)\s*&#x3e;/gi, "<$1$2>")
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(aba|janela)>\s*(?:<\/strong>\s*)?<\/p>/gi, "<$1>")
        .replace(/<strong\b[^>]*>\s*<(aba|janela)>\s*<\/strong>/gi, "<$1>");
    const marcadores = [...origem.matchAll(/<(aba|janela)\s*>/gi)];

    const abas = [];
    const janelas = [];

    for (let i = 0; i < marcadores.length; i++) {
        const marcador = marcadores[i];
        const proximo = marcadores[i + 1];
        const fim = proximo ? proximo.index : origem.length;
        const valor = origem.slice(marcador.index + marcador[0].length, fim).trim();

        if (marcador[1].toLowerCase() === "aba") abas.push(valor);
        else janelas.push(valor);
    }

    if (!abas.length) {
        throw new Error("Nenhuma aba foi encontrada no componente.");
    }

    if (abas.length !== janelas.length) {
        throw new Error(
            `A quantidade de abas (${abas.length}) é diferente da quantidade de janelas (${janelas.length}).`
        );
    }

    const contexto = String(opcoes.contexto || `${numeroLicao ?? 0}_${index ?? 0}`)
        .replace(/[^a-zA-Z0-9_-]/g, "_");
    const id = `abas-${contexto}`;

    const botoesHTML = abas.map((aba, indice) => `
        <button
            class="abas-botao${indice === 0 ? " ativo" : ""}"
            type="button"
            id="${id}-botao-${indice + 1}"
            role="tab"
            aria-selected="${indice === 0 ? "true" : "false"}"
            aria-controls="${id}-painel-${indice + 1}"
            data-abas-indice="${indice}">
            ${aba}
        </button>
    `).join("\n");

    const caminhoAudioPai = String(opcoes.prefixoAudio || "")
        .split("_")
        .filter(Boolean);

    const janelasHTML = janelas.map((janela, indice) => `
        <section
            class="abas-painel${indice === 0 ? " ativo" : ""}"
            data-audio-id="${montarIdAudio(caminhoAudioPai, "abas", indice)}"
            id="${id}-painel-${indice + 1}"
            role="tabpanel"
            aria-labelledby="${id}-botao-${indice + 1}"
            ${indice === 0 ? "" : "hidden"}>
            <div class="abas-painel-conteudo">${janela}</div>
        </section>
    `).join("\n");

    return template
        .replace(/{{ID_COMPONENTE}}/g, () => id)
        .replace(/{{BOTOES}}/g, () => botoesHTML)
        .replace(/{{JANELAS}}/g, () => janelasHTML);
};
