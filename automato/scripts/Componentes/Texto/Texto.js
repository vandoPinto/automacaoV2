// Texto.js
const { carregarTemplate } = require("../../Utils");
/**
 * Exporta uma função que gera um template HTML para um componente de texto
 * @param {string} conteudo - O conteúdo do componente de texto
 * @param {number} numeroLicao - Número da lição (ex.: 1, 2, 3)
 * @param {number} index - Índice da tela dentro da lição
 * @returns {Promise<string>} - O template HTML gerado
 */
module.exports = async function (conteudo, numeroLicao, index) {

    let template = await carregarTemplate("Apresentacao");


    const imagens = conteudo.match(/<img[\s\S]*?>/gi) || [];
    let conteudoSemImagem = conteudo.replace(/<img[\s\S]*?>/gi, "");
    const textos = conteudoSemImagem.trim();
    const imagensHTML = imagens.join("\n");
    // console.log(textos);

    template = template
        .replace(/{{class}}/g, `licao${numeroLicao}_tela${index}`)
        .replace(/{{TEXTOS}}/g, textos);
    // .replace(/{{IMAGENS}}/g, imagensHTML)
    // .replace(/{{EXTRA}}/g, imagensHTML);
    return template;
};