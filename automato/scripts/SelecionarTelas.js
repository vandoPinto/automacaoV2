/**
 * Processa uma tabela de lição e extrai suas telas, transformando-as em arquivos HTML.
 *
 * Funcionamento:
 * - Recebe o HTML da tabela da lição já parseado
 * - Percorre todas as linhas (<tr>)
 * - Ignora a primeira linha (título da lição)
 * - Para cada linha:
 *   - Extrai a segunda coluna (<td>[1])
 *   - Envia o conteúdo para `CriarTela` para processar e criar o arquivo HTML
 *
 * Responsabilidades:
 * - Processar a tabela em unidades de tela
 * - Delegar a criação de arquivos para outro módulo
 *
 * Parâmetros:
 * @param {HTMLElement} licaoHTML - HTML da tabela da lição
 * @param {number} numeroLicao - Número da lição (ex.: 1, 2, 3)
 * @param {string} caminhoBaseSaida - Caminho base para onde as telas serão salvas
 */

const { parse } = require("node-html-parser");
const { CriarTela } = require("./CriarTela");

function SelecionarTelas(licaoHTML, numeroLicao, caminhoBaseSaida) {

    // Seleciona todas as linhas da tabela, ignorando as que estão dentro de outras tabelas por que sao tabelas de telas
    const trs = licaoHTML.querySelectorAll("tr:not(tr table tr)");


    // transforma em array de strings (HTML)
    const linhas = trs.map(tr => tr.toString()); // ou tr.outerHTML

    //A primeira linha é o título da lição, as demais são os conteúdos
    linhas.forEach((element, index) => {
        if (index != 0) {
            let coluna = parse(element).querySelectorAll("td")[1].innerHTML;
            CriarTela(numeroLicao, index, coluna, caminhoBaseSaida);
        }
    });

    return linhas;
}

module.exports = { SelecionarTelas };

