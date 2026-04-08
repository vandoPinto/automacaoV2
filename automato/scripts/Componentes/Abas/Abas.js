// Abas.js
const { carregarTemplate } = require("../../Utils");
const TagsToArray = require("../../TagsToArray");
/**
 * Exporta uma função que gera um template HTML para um componente de abas
 * @param {string} conteudo - O conteúdo do componente de abas
 * @returns {Promise<string>} - O template HTML gerado
 */
module.exports = async function (conteudo) {
    // console.log(conteudo);

    let template = await carregarTemplate("abas");
    const imagens = conteudo.match(/<img[\s\S]*?>/gi) || [];
    let conteudoSemImagem = conteudo.replace(/<img[\s\S]*?>/gi, "");
    const textos = conteudoSemImagem.trim();

    const paragrafos = textos.replace(/<[^>]+>/g, '').trim().split('\n').filter(p => p !== '');
    const itensLista = textos.replace(/<li[\s\S]*>/gi, '').replace(/<\/li>/gi, '').trim().split('\n').filter(p => p !== '');
    // console.log('Abas - > ', TagsToArray(textos));

    const imagensHTML = imagens.join("\n");
    template = template.replace(/{{TEXTOS}}/g, textos)
        .replace(/{{paragrafo}}/g, paragrafos.join("\n"))

    const itensHTML = itensLista.map(i => `<li>${i.replace(/<[^>]+>/g, '').replace(/<\/li>/g, '')}</li>`).join("\n");
    template = template.replace(/{{itensLista}}/g, itensHTML);
    return template;
};


{/* <p>O cuidado à pessoa idosa deve considerar tanto as limitações biológicas quanto a preservação da autonomia, da funcionalidade e da participação social. </p>
<ol>
    <li>Na Atenção Básica, esse compromisso foi fortalecido com o Pacto pela Vida (2006), que reconheceu a saúde da pessoa idosa como prioridade, enfatizando a promoção do envelhecimento ativo e da qualidade de vida.</li>
    <li>Ao falar das características físicas do envelhecimento, é fundamental retomar um ponto central: o corpo não envelhece sozinho. As mudanças corporais estão diretamente relacionadas aos aspectos psicológicos, sociais, econômicos, culturais, ambientais e às condições de saúde construídas ao longo da vida, reforçando a necessidade de um olhar integral sobre a pessoa idosa.</li>
    <li>Envelhecimento físico, funcional e social acontecem de forma integrada.</li>
    <li>O envelhecimento biológico é um processo complexo, cumulativo e progressivo, marcado por transformações nos tecidos corporais. Para compreender essas mudanças, o profissional de saúde precisa reconhecer como órgãos, tecidos e células se organizam e funcionam ao longo da vida.</li>
</ol> */}