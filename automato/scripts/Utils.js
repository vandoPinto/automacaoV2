/**
 * Utilitários para processamento de templates e normalização de conteúdo.
 *
 * Funcionalidades:
 * - carregarTemplate: lê e cacheia arquivos HTML de templates específicos de cada componente
 * - decodeHTML: converte entidades HTML para caracteres normais
 * - normalizarTipo: padroniza strings de tipo para identificação de componentes
 *
 * Detalhes das funções:
 * 1. carregarTemplate(nome)
 *    - Lê o template HTML do componente correspondente ao nome passado
 *    - Cada componente possui sua própria pasta com o template dentro
 *      Exemplo: Componentes/Texto/Texto.html
 *    - Armazena em cache para evitar leituras repetidas do disco
 *    - Retorna o conteúdo do template como string
 *
 * 2. decodeHTML(str)
 *    - Substitui entidades HTML (&lt;, &gt;, &amp;, &quot;, &#39;) por seus caracteres equivalentes
 *    - Útil para processar conteúdos extraídos de DOCX ou HTML
 *
 * 3. normalizarTipo(tipo)
 *    - Transforma o tipo em minúsculas
 *    - Remove espaços e traços
 *    - Permite mapear tipos variados para chaves consistentes de componentes
 *
 * Padrões e observações:
 * - Templates devem estar na pasta do próprio componente dentro de ./Componentes
 * - Cache de templates melhora performance evitando leituras repetidas do disco
 * - Normalização de tipo garante compatibilidade com a lista de componentes cadastrados
 *
 * Exemplo de uso:
 * const { carregarTemplate, decodeHTML, normalizarTipo } = require('./Utils');
 * const html = await carregarTemplate('Texto');
 * const tipo = normalizarTipo('Texto Importante');
 * const conteudo = decodeHTML('&lt;p&gt;Olá&lt;/p&gt;');
 *
 * Exportações:
 * module.exports = { carregarTemplate, decodeHTML, normalizarTipo }
 */

const path = require("path");
const fs = require("fs/promises");

const templatesCache = {};

/**
 * Carrega um template HTML pelo nome do componente.
 * @param {string} nome - Nome do componente (ex.: 'Texto', 'Apresentacao')
 * @returns {Promise<string>} Conteúdo do template HTML
 */
async function carregarTemplate(nome) {
    if (!templatesCache[nome]) {
        // Busca o template dentro da pasta do próprio componente
        const caminho = path.join(__dirname, "Componentes", nome, nome + ".html");
        console.log(nome);
        console.log(`Util.js - Carregando template: ${caminho}`);


        templatesCache[nome] = await fs.readFile(caminho, "utf-8");
    }
    return templatesCache[nome];
}

/**
 * Converte entidades HTML (&lt;, &gt;, &amp;, &quot;, &#39;) em caracteres normais
 * @param {string} str
 * @returns {string}
 */
function decodeHTML(str) {
    return str
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

/**
 * Normaliza o tipo de componente:
 * - converte para minúsculas
 * - remove espaços
 * - remove traços
 * @param {string} tipo
 * @returns {string}
 */
function normalizarTipo(tipo) {
    return tipo
        .toLowerCase()
        .replace(/\s/g, "")
        .replace(/-/g, "");
}

module.exports = { carregarTemplate, decodeHTML, normalizarTipo };