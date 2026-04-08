// Saibamais.js
const { carregarTemplate } = require("../../Utils");
/**
 * Converte o conteúdo em HTML para o template de saibamais.
 * 
 * @param {string} conteudo - Conteúdo em HTML a ser convertido.
 * @returns {Promise<string>} - HTML gerado a partir do conteúdo.
 */
module.exports = async function (conteudo) {
    let template = await carregarTemplate("saibamais");
    const imagens = conteudo.match(/<img[\s\S]*?>/gi) || [];
    let conteudoSemImagem = conteudo.replace(/<img[\s\S]*?>/gi, "");
    const textos = conteudoSemImagem.trim();
    const imagensHTML = imagens.join("\n");
    template = template.replace(/{{TEXTOS}}/g, textos)
        .replace(/{{IMAGENS}}/g, imagensHTML)
        .replace(/{{EXTRA}}/g, imagensHTML);
    return template;
};