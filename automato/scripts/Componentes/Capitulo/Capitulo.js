// Capitulo.js
const { carregarTemplate } = require("../../Utils");
/**
 * Exporta uma função que gera um template HTML para um componente de título
 * @param {string} conteudo - O conteúdo do componente de título
 * @returns {Promise<string>} - O template HTML gerado
 */
module.exports = async function (conteudo) {
    let template = await carregarTemplate("capitulo");
    const imagens = conteudo.match(/<img[\s\S]*?>/gi) || [];
    let conteudoSemImagem = conteudo.replace(/<img[\s\S]*?>/gi, "");
    const textos = conteudoSemImagem.trim();
    const imagensHTML = imagens.join("\n");
    template = template.replace(/{{TEXTOS}}/g, textos)
        .replace(/{{IMAGENS}}/g, imagensHTML)
        .replace(/{{EXTRA}}/g, imagensHTML);
    return template;
};