// Objetivos.js
const { carregarTemplate } = require("../../Utils");
/**
 * Renderiza o componente Objetivos
 * @param {string} conteudo - Contedo do componente
 * @returns {Promise<string>} - Template renderizado
 */
module.exports = async function (conteudo) {
    let template = await carregarTemplate("objetivos");
    const imagens = conteudo.match(/<img[\s\S]*?>/gi) || [];
    let conteudoSemImagem = conteudo.replace(/<img[\s\S]*?>/gi, "");
    const textos = conteudoSemImagem.trim();
    const imagensHTML = imagens.join("\n");
    template = template.replace(/{{TEXTOS}}/g, textos)
        .replace(/{{IMAGENS}}/g, imagensHTML)
        .replace(/{{EXTRA}}/g, imagensHTML);
    return template;
};