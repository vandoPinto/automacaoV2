// Texto.js
const { carregarTemplate } = require("../../Utils");

/**
 * Gera o HTML do componente de texto, preservando a ordem original
 * entre blocos de texto e imagens recebidos do DOCX.
 *
 * @param {string} conteudo
 * @param {number} numeroLicao
 * @param {number} index
 * @returns {Promise<string>}
 */
module.exports = async function (conteudo, numeroLicao, index) {
    let template = await carregarTemplate("texto");

    // Divide o conteúdo mantendo as imagens na posição em que aparecem.
    const partes = String(conteudo || "").split(/(<img\b[\s\S]*?>)/gi);
    const blocos = [];

    for (const parte of partes) {
        if (!parte || !parte.trim()) continue;

        if (/^<img\b/i.test(parte.trim())) {
            blocos.push({
                tipo: "imagem",
                html: parte.trim()
            });
        } else {
            blocos.push({
                tipo: "texto",
                html: parte.trim()
            });
        }
    }

    const possuiMultiplosBlocos = blocos.length > 1;

    const conteudoHTML = blocos.map((bloco, indice) => {
        const classeLargura = possuiMultiplosBlocos
            ? "conteudo-item"
            : "conteudo-item conteudo-item-integral";

        const classeAnimacao = bloco.tipo === "imagem"
            ? "animated fadeIn"
            : "animated backInLeft";

        return `<div class="${classeLargura} ${classeAnimacao}" data-tipo="${bloco.tipo}">${bloco.html}</div>`;
    }).join("\n");

    template = template
        .replace(/{{CONTEUDO}}/g, conteudoHTML)
        .replace(/{{class}}/g, `licao${numeroLicao}_tela${index}`);

    return template;
};
