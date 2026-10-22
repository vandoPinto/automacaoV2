/**
 * Arquivo principal responsável por orquestrar todo o fluxo de processamento do sistema.
 *
 * Fluxo executado:
 * 1. Lê um arquivo .docx a partir de um caminho definido.
 * 2. Converte o conteúdo do DOCX para HTML utilizando a função `CarregarArquivoDOCX`.
 * 3. Realiza o parse do HTML com `node-html-parser`.
 * 4. Extrai todas as tabelas presentes no documento.
 * 5. Direciona o processamento:
 *    - Primeira tabela → Cabeçalho (`CriarCabecalho`)
 *    - Demais tabelas → Lições (`SelecionarTelas`)
 * 6. Retorna o resultado do processamento ou propaga um erro estruturado para a aplicação web.
 *
 * Estrutura de dados:
 * - Cada tabela representa uma unidade lógica:
 *   [0] → Cabeçalho
 *   [1..n] → Lições
 *
 * Responsabilidades:
 * - Controlar o fluxo da aplicação
 * - Delegar processamento para módulos específicos
 * - Centralizar e registrar erros
 * - Disponibilizar mensagens de erro compreensíveis para a interface
 *
 * Observações:
 * - O sistema está preparado para expansão (JSON, templates, áudio, etc.)
 * - O caminho base de saída é definido pela variável `caminhoBaseSaida`
 *
 * Melhorias futuras:
 * - Entrada dinâmica de arquivo (CLI ou interface)
 * - Pipeline configurável
 * - Logs estruturados
 */

const { CarregarArquivoDOCX } = require("./scripts/CarregarArquivoDOCX");
const { CriarCabecalho } = require("./scripts/CriarCabecalho");
const { SelecionarTelas } = require("./scripts/SelecionarTelas");
const { parse } = require("node-html-parser");
const path = require("path");

// Criar forma de receber o arquivo sem ser por linha de comando, por exemplo, arrastando o arquivo para o terminal ou usando um prompt de seleção de arquivo.
// const arquivo = './PSI_promoçao da saude da pessoa idosa_v1_AIM_liçao1_DI.docx';
var caminhoBaseSaida; // = path.resolve(__dirname, "./output");

/**
 * Processa o arquivo DOCX e propaga erros para quem chamou a função.
 * @param {string} arquivo Caminho do arquivo DOCX de entrada.
 * @returns {Promise<{success: boolean, tabelasEncontradas: number, metadados: object}>}
 * @throws {Error} Erro com etapa e mensagem segura para exibição na interface.
 */
async function executar(arquivo) {
    let tabelas = [];
    let etapa = "leitura do arquivo DOCX";

    try {
        if (!arquivo) {
            const erro = new Error("Selecione um arquivo DOCX para iniciar o processamento.");
            erro.name = "ErroValidacaoArquivo";
            erro.publicMessage = erro.message;
            throw erro;
        }

        const html = await CarregarArquivoDOCX(arquivo, caminhoBaseSaida);

        etapa = "leitura das tabelas do documento";
        const root = parse(html);
        const tables = Array.from(root.children)
            .filter(el => el.tagName === "TABLE");

        if (tables.length === 0) {
            const erro = new Error(
                "Não foram encontradas tabelas no documento. Verifique se o arquivo DOCX segue o modelo esperado."
            );
            erro.name = "ErroEstruturaDocumento";
            erro.publicMessage = erro.message;
            throw erro;
        }

        let metadados = null;

        for (let index = 0; index < tables.length; index++) {
            const tabela = tables[index];
            tabelas.push(tabela.innerHTML);

            if (index === 0) {
                etapa = "validação do cabeçalho";
                metadados = CriarCabecalho(parse(tabela.innerHTML));
                // Funções futuras: criar JSON de configuração, módulo principal e biblioteca.
            } else {
                etapa = `criação das telas da tabela ${index}`;
                // Processa as telas da lição, com o número da tabela e o caminho base de saída.
                await SelecionarTelas(parse(tabela.innerHTML), index, caminhoBaseSaida);
                // Funções futuras: templates, JSON de lições, roteiro de som, áudio e minificação.
            }
        }

        console.log("main.js - TABELAS ENCONTRADAS:", tabelas.length);
        return {
            success: true,
            tabelasEncontradas: tabelas.length,
            metadados
        };
    } catch (erroOriginal) {
        const erro = erroOriginal instanceof Error
            ? erroOriginal
            : new Error(String(erroOriginal));

        // Preserva erros de validação com instruções úteis; erros inesperados recebem uma mensagem segura.
        if (!erro.publicMessage) {
            if (erro.name === "ErroValidacaoCabecalho" || erro.name === "ErroValidacaoArquivo" || erro.name === "ErroEstruturaDocumento") {
                erro.publicMessage = erro.message;
            } else {
                erro.publicMessage = `Ocorreu um problema durante ${etapa}. Verifique se o arquivo está correto e tente novamente.`;
            }
        }

        erro.etapa = erro.etapa || etapa;
        console.error(`main.js - Erro durante ${erro.etapa}:`, erro);
        throw erro;
    }
}

// caminhoBaseSaida = path.resolve(__dirname, "../output");
caminhoBaseSaida = path.resolve(__dirname, "./Teste");
module.exports = { executar };

// Permite executar diretamente com node main.js.
if (require.main === module) {
    const caminhoArquivo = process.argv[2] || "./SIS.docx";

    executar(caminhoArquivo)
        .then(resultado => {
            console.log("Processamento finalizado com sucesso.");
            console.log("Tabelas encontradas:", resultado.tabelasEncontradas);
        })
        .catch(erro => {
            console.error("Erro:", erro.publicMessage || erro.message);
            process.exitCode = 1;
        });
}
