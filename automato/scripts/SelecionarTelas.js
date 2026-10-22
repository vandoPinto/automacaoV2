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

/**
 * Processa uma tabela de tópico, identifica os números das telas e cria os HTMLs.
 *
 * Regras:
 * - Considera apenas as linhas da tabela do tópico, ignorando linhas de tabelas aninhadas.
 * - Uma linha inicia uma tela quando a primeira célula contém somente um número.
 * - Linhas seguintes sem número ou com o mesmo número são anexadas à tela atual.
 * - Uma tela é criada uma única vez por número, evitando sobrescrever arquivos.
 *
 * @param {HTMLElement} licaoHTML Tabela HTML de um tópico.
 * @param {number} indiceTabela Índice da tabela no documento.
 * @param {string} caminhoBaseSaida Diretório base de saída.
 * @param {{sigla: string, numeroLicao: number, titulo?: string}} metadados Metadados do cabeçalho.
 * @returns {Promise<string[]>} Caminhos dos arquivos criados.
 * @throws {Error} Se não for possível identificar/processar o tópico ou suas telas.
 */
async function SelecionarTelas(licaoHTML, indiceTabela, caminhoBaseSaida, metadados) {
    if (!licaoHTML || typeof licaoHTML.querySelectorAll !== "function") {
        throw new Error(`SelecionarTelas.js - A tabela do tópico ${indiceTabela} não é válida.`);
    }

    if (!metadados || !metadados.sigla || !Number.isInteger(Number(metadados.numeroLicao))) {
        throw new Error("SelecionarTelas.js - Os metadados do cabeçalho não foram informados corretamente.");
    }

    // Evita processar <tr> pertencentes a tabelas internas do conteúdo de uma tela.
    const todasAsLinhas = licaoHTML.querySelectorAll("tr");
    const linhas = todasAsLinhas.filter(linha => {
        let pai = linha.parentNode;
        while (pai && pai !== licaoHTML) {
            if (pai.tagName === "TABLE") return false;
            pai = pai.parentNode;
        }
        return true;
    });

    if (!linhas.length) {
        throw new Error(`SelecionarTelas.js - A tabela ${indiceTabela} não contém linhas.`);
    }

    const textoCabecalho = linhas[0]
        .querySelectorAll("th, td")
        .map(celula => celula.textContent.trim())
        .join(" ");

    const matchTopico = textoCabecalho.match(/t[oó]pico\s*0*(\d+)/i);
    if (!matchTopico) {
        throw new Error(
            `SelecionarTelas.js - Não foi possível identificar o número do tópico no cabeçalho da tabela ${indiceTabela}.`
        );
    }

    const numeroTopico = Number(matchTopico[1]);
    const telas = [];
    let telaAtual = null;

    // Ignora a primeira linha, que identifica as colunas "Tela" e "Tópico N".
    for (let i = 1; i < linhas.length; i++) {
        const celulas = linhas[i].querySelectorAll(":scope > td, :scope > th");

        // Algumas versões do node-html-parser não aceitam :scope. Se não encontrar,
        // utiliza as células da linha, mantendo a filtragem de tabelas aninhadas.
        const celulasLinha = celulas.length
            ? celulas
            : linhas[i].childNodes.filter(no =>
                no.tagName === "TD" || no.tagName === "TH"
            );

        if (celulasLinha.length < 2) continue;

        const textoNumero = celulasLinha[0].textContent
            .replace(/\u00a0/g, " ")
            .trim();

        // Importante: aceitar somente uma célula que contenha exclusivamente um número.
        // Não usar /\d+/ isoladamente, pois isso encontra números no texto ou em componentes.
        const matchNumero = textoNumero.match(/^(\d+)$/);
        const conteudoLinha = celulasLinha[1].innerHTML.trim();

        if (matchNumero) {
            const numeroTela = Number(matchNumero[1]);

            if (!telaAtual || telaAtual.numero !== numeroTela) {
                telaAtual = { numero: numeroTela, partes: [] };
                telas.push(telaAtual);
            }

            if (conteudoLinha) telaAtual.partes.push(conteudoLinha);
        } else {
            // Linha de continuação: incorpora o conteúdo à tela corrente.
            // Linhas sem número antes da primeira tela são metadados/estrutura do tópico
            // e não devem gerar arquivos duplicados.
            if (telaAtual && conteudoLinha) {
                telaAtual.partes.push(conteudoLinha);
            }
        }
    }

    if (!telas.length) {
        throw new Error(
            `SelecionarTelas.js - Nenhuma tela numerada foi encontrada no tópico ${numeroTopico}. Confira se a primeira coluna contém somente o número da tela.`
        );
    }

    const caminhosCriados = [];
    const numerosProcessados = new Set();

    for (const tela of telas) {
        if (numerosProcessados.has(tela.numero)) continue;
        numerosProcessados.add(tela.numero);

        const conteudo = tela.partes.join("\n");
        if (!conteudo.trim()) {
            throw new Error(
                `SelecionarTelas.js - A tela ${tela.numero} do tópico ${numeroTopico} está sem conteúdo.`
            );
        }

        const caminho = await CriarTela(
            tela.numero,
            tela.numero,
            conteudo,
            caminhoBaseSaida,
            metadados,
            numeroTopico
        );

        caminhosCriados.push(caminho);
    }

    return caminhosCriados;
}

module.exports = { SelecionarTelas };
