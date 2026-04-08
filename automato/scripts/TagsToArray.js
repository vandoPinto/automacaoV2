//Esse codigo vai receber uma string com tags HTML e vai separar os parágrafos, titulos, subtitulos,  e os itens de uma lista em  arrays diferentes. 
// Para isso, ele vai usar expressões regulares para extrair os parágrafos e os itens de lista separadamente. 
// O resultado final vai ser um template HTML onde os parágrafos e os itens de lista vão ser inseridos nos lugares corretos.

//onde tiver <titulo> vai ser criado um array de titulos, onde tiver <subtitulo> vai ser criado um array de subtitulos, 
// onde tiver <p> vai ser criado um array de parágrafos e onde tiver <li> vai ser criado um array de itens de lista.

// O código também vai remover as tags HTML dos parágrafos e dos itens de lista para que o conteúdo fique mais limpo. 

// O objetivo é extrair esses elementos do conteúdo e retornalos em arrays separados para que possam ser usados em um template HTML de forma mais organizada e estruturada.


/**
 * Função que recebe uma string com tags HTML e separa os parágrafos, títulos, subtitulos e os itens de uma lista em arrays diferentes.
 * 
 * @param {string} conteudo - string com tags HTML
 * @returns {object} objeto com arrays de parágrafos, títulos, subtitulos e itens de lista
 */
function TagsToArray(conteudo) {
    const paragrafos = conteudo.match(/<p>(.*?)\s*<\/p>/gi) || [];
    const titulos = conteudo.match(/<titulo>(.*?)\s*<\/titulo>/gi) || [];
    const subtitulos = conteudo.match(/<subtitulo>(.*?)\s*<\/subtitulo>/gi) || [];
    const itensDeLista = conteudo.match(/<li>(.*?)\s*<\/li>/gi) || [];

    const paragrafosSemTags = paragrafos.map(paragrafo => paragrafo.replace(/<p>|<\/p>/g, ""));
    const titulosSemTags = titulos.map(titulo => titulo.replace(/<titulo>|<\/titulo>/g, ""));
    const subtitulosSemTags = subtitulos.map(subtitulo => subtitulo.replace(/<subtitulo>|<\/subtitulo>/g, ""));
    const itensDeListaSemTags = itensDeLista.map(item => item.replace(/<li>|<\/li>/g, ""));

    return {
        paragrafos: paragrafosSemTags,
        titulos: titulosSemTags,
        subtitulos: subtitulosSemTags,
        itensDeLista: itensDeListaSemTags
    };
}

module.exports = TagsToArray;