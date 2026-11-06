const { carregarTemplate } = require("../../Utils");
const { montarIdAudio } = require("../../ExtrairAudiosComponentes");

/**
 * Componente MININAVEGACAO: uma janela visível por vez, controlada por setas.
 * Os filhos universais são processados previamente pelo processador central.
 */
module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("mininavegacao");
    const origem = String(conteudo || "")
        .replace(/&lt;\s*(\/?)\s*janela\s*&gt;/gi, "<$1janela>")
        .replace(/&#60;\s*(\/?)\s*janela\s*&#62;/gi, "<$1janela>")
        .replace(/&#x3c;\s*(\/?)\s*janela\s*&#x3e;/gi, "<$1janela>")
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<janela>\s*(?:<\/strong>\s*)?<\/p>/gi, "<janela>")
        .replace(/<strong\b[^>]*>\s*<janela>\s*<\/strong>/gi, "<janela>");

    const marcadores = [...origem.matchAll(/<janela\s*>/gi)];
    const janelas = marcadores.map((marcador, i) => {
        const inicio = marcador.index + marcador[0].length;
        const fim = marcadores[i + 1]?.index ?? origem.length;
        return origem.slice(inicio, fim).trim();
    }).filter((janela, i) => marcadores[i]);

    if (!janelas.length) throw new Error("Nenhuma janela foi encontrada no componente MININAVEGACAO.");

    const contexto = String(opcoes.contexto || `${numeroLicao ?? 0}_${index ?? 0}`)
        .replace(/[^a-zA-Z0-9_-]/g, "_");
    const id = `mininavegacao-${contexto}`;
    const caminhoAudioPai = String(opcoes.prefixoAudio || "")
        .split("_")
        .filter(Boolean);
    const htmlJanelas = janelas.map((janela, indice) => `
      <section class="mini-nav-painel" data-audio-id="${montarIdAudio(caminhoAudioPai, "mininavegacao", indice)}" id="${id}-painel-${indice + 1}" ${indice ? "hidden" : ""}>
        <div class="mini-nav-painel-conteudo">${janela}</div>
      </section>
    `).join("\n");

    return template
        .replace(/{{ID_COMPONENTE}}/g, () => id)
        .replace(/{{JANELAS}}/g, () => htmlJanelas);
};
