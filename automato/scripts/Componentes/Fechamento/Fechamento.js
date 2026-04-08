// Fechamento.js
const { carregarTemplate } = require("../../Utils");
/**
 * Carrega um template HTML pelo nome do componente e substitui
 * placeholders com conteúdo extraído do conteúdo.
 * 
 * @param {string} conteudo - Conteúdo a ser processado.
 * @returns {Promise<string>} - HTML gerado a partir do conteúdo do arquivo.
 */
module.exports = async function (conteudo) {
    let template = await carregarTemplate("fechamento");
    const imagens = conteudo.match(/<img[\s\S]*?>/gi) || [];
    let conteudoSemImagem = conteudo.replace(/<img[\s\S]*?>/gi, "");
    const textos = conteudoSemImagem.trim();
    const imagensHTML = imagens.join("\n");
    template = template.replace(/{{TEXTOS}}/g, textos)
        .replace(/{{IMAGENS}}/g, imagensHTML)
        .replace(/{{EXTRA}}/g, imagensHTML);
    return template;
};