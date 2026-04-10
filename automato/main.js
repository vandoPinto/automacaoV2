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
 *
 * Estrutura de dados:
 * - Cada tabela representa uma unidade lógica:
 *   [0] → Cabeçalho
 *   [1..n] → Lições
 *
 * Responsabilidades:
 * - Controlar o fluxo da aplicação
 * - Delegar processamento para módulos específicos
 * - Centralizar tratamento de erro
 *
 * Observações:
 * - O sistema está preparado para expansão (JSON, templates, áudio, etc.)
 * - Atualmente o arquivo de entrada é fixo (hardcoded)
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

//Criar forma de receber o arquivo sem ser por linha de comando, por exemplo, arrastando o arquivo para o terminal ou usando um prompt de seleção de arquivo
// const arquivo = './PSI_promoçao da saude da pessoa idosa_v1_AIM_liçao1_DI.docx';
var caminhoBaseSaida;// = path.resolve(__dirname, "./output");

async function executar(arquivo) {
    // Array para armazenar as tabelas encontradas
    //tabelas[0] - Cabeçalho
    //tabelas[1] - Licão 1
    //tabelas[2] - Licão 2
    let tabelas = [];

    try {
        const html = await CarregarArquivoDOCX(arquivo, caminhoBaseSaida);

        // Faz o parse do HTML
        const root = parse(html);

        // Seleciona todas as tabelas, exceto as que est o dentro de outras tabelas
        const tables = Array.from(root.children)
            .filter(el => el.tagName === "TABLE");

        tables.forEach((tabela, index) => {
            // console.log('vando main.js - Tabelas encontradas:' + index + ` ` + tabela.innerHTML);
            tabelas.push(tabela.innerHTML); // conteúdo interno
            // se quiser a tabela completa:
            // tabelas.push(tabela.toString());

            //A primeira tabela é o cabeçalho, as demais são os topicos das lições
            //modificar futuramente para receber do cabecalho o numero da licao e refletir na funcao selecionarTelas, 
            // para criar as pastas de saida das telas de acordo com o numero da licao, por exemplo, licao1/topico1, licao1/topico2, etc
            if (index == 0) {
                CriarCabecalho(parse(tabela.innerHTML));
                //funcoes para serem implementadas posteriormente:
                //criar json de configuracao - wbtsis.json
                //Criar json de modulo princial - wbtsis.json
                //Criar json de biblioteca - biblioteca.json

            } else {
                // Processa as telas da lição recebe o conteúdo da tabela, o número da lição e 
                // o caminho base de saída onde vão ser salvas as telas
                SelecionarTelas(parse(tabela.innerHTML), index, caminhoBaseSaida);

                //funcoes para serem implementadas posteriormente:
                //Criar templates de tela e atividades
                //Criar json de licoes - sis01_00.json sis01_01.json ... / sis02_01.json sis02_02.json ...
                //criar roteiro de som
                //Criar som
                //minimificar arquivos

            }
        });
        console.log("main.js - TABELAS ENCONTRADAS:\n", tabelas.length);
    } catch (erro) {
        console.error("main.js - ❌ Erro:", erro);
    }
}


// executar();
caminhoBaseSaida = path.resolve(__dirname, "../output");
module.exports = { executar };

// 👇 Permite rodar direto com node main.js
if (require.main === module) {
    const caminhoArquivo = './PSI_promoçao da saude da pessoa idosa_v1_AIM_liçao1_DI.docx';

    if (!caminhoArquivo) {
        console.log("❌ Informe o caminho do arquivo:");
        console.log("Ex: node main.js arquivo.docx");
        process.exit(1);
    }
    caminhoBaseSaida = path.resolve(__dirname, "./aulafuncional");
    // caminhoBaseSaida = path.resolve(__dirname, "./output");

    executar(caminhoArquivo)
        .then(() => console.log("✅ Finalizado"))
        .catch(err => console.error("❌ Erro:", err));
}