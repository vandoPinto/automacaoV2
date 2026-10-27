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
 * - A saída é isolada por curso em `public/<sigla>`
 *
 * Melhorias futuras:
 * - Entrada dinâmica de arquivo (CLI ou interface)
 * - Pipeline configurável
 * - Logs estruturados
 */

const { CarregarArquivoDOCX } = require("./scripts/CarregarArquivoDOCX");
const { CriarCabecalho } = require("./scripts/CriarCabecalho");
const { SelecionarTelas } = require("./scripts/SelecionarTelas");
const { AtualizarWbtJson } = require("./scripts/AtualizarWbtJson");
const { parse } = require("node-html-parser");
const path = require("path");
const fs = require("fs/promises");
const os = require("os");

var caminhoBaseSaida;

/**
 * Processa o DOCX e gera os arquivos de cada tópico.
 * @param {string} arquivo Caminho do arquivo DOCX de entrada.
 * @param {(dados: {etapa: string, percentual: number, fase: string}) => void} onProgress
 *        Callback opcional para comunicar o progresso.
 */
async function executar(arquivo, onProgress = () => { }) {
    const tabelas = [];
    const arquivosCriados = [];
    let etapa = "leitura do arquivo DOCX";

    const reportar = (mensagem, percentual, fase) => {
        try {
            onProgress({ etapa: mensagem, percentual, fase });
        } catch (erroCallback) {
            // Um erro na atualização visual não deve interromper a geração da lição.
            console.warn("main.js - Não foi possível atualizar o progresso:", erroCallback.message);
        }
    };

    try {
        if (!arquivo) {
            const erro = new Error("Selecione um arquivo DOCX para iniciar o processamento.");
            erro.name = "ErroValidacaoArquivo";
            erro.publicMessage = erro.message;
            throw erro;
        }

        etapa = "leitura do arquivo DOCX";
        reportar("Processando arquivo DOCX e extraindo seu conteúdo...", 2, "processamento");
        const html = await CarregarArquivoDOCX(arquivo, caminhoBaseSaida);

        etapa = "leitura das tabelas do documento";
        reportar("Arquivo lido. Analisando a estrutura e as tabelas...", 12, "processamento");
        const root = parse(html);
        const tables = Array.from(root.children).filter(el => el.tagName === "TABLE");

        if (tables.length === 0) {
            const erro = new Error(
                "Não foram encontradas tabelas no documento. Verifique se o arquivo DOCX segue o modelo esperado."
            );
            erro.name = "ErroEstruturaDocumento";
            erro.publicMessage = erro.message;
            throw erro;
        }
        if (tables.length < 2) {
            const erro = new Error("O documento não contém tabelas de tópicos com telas para processar.");
            erro.name = "ErroEstruturaDocumento";
            erro.publicMessage = erro.message;
            throw erro;
        }

        etapa = "validação do cabeçalho";
        reportar("Validando o cabeçalho e os dados da lição...", 20, "processamento");
        const metadados = CriarCabecalho(parse(tables[0].innerHTML));

        const totalTopicos = tables.length - 1;
        reportar(`Iniciando a criação das lições e telas (${totalTopicos} tópico(s))...`, 25, "criacao");

        for (let index = 1; index < tables.length; index++) {
            const tabela = tables[index];
            tabelas.push(tabela.innerHTML);
            const numeroTopico = index;
            const percentualInicio = 25 + Math.round(((index - 1) / totalTopicos) * 65);
            const percentualFim = 25 + Math.round((index / totalTopicos) * 65);

            etapa = `processamento do tópico da tabela ${index}`;
            reportar(
                `Criando telas do tópico ${numeroTopico} (${index} de ${totalTopicos})...`,
                percentualInicio,
                "criacao"
            );

            const caminhos = await SelecionarTelas(
                parse(tabela.innerHTML),
                index,
                caminhoBaseSaida,
                metadados
            );
            arquivosCriados.push(...caminhos);

            reportar(
                `Tópico ${numeroTopico} concluído: ${caminhos.length} arquivo(s) criado(s) (${index} de ${totalTopicos}).`,
                percentualFim,
                "criacao"
            );
        }

        etapa = "atualização do wbt.json";
        reportar("Finalizando a lição e atualizando o índice de navegação...", 95, "finalizacao");
        const caminhoWbt = path.resolve(caminhoBaseSaida, "..", "scripts", "json", "wbt.json");
        await AtualizarWbtJson(caminhoWbt, metadados);

        reportar("Lição criada com sucesso.", 100, "concluido");
        console.log("main.js - TABELAS ENCONTRADAS:", tables.length);
        console.log("main.js - ARQUIVOS CRIADOS:", arquivosCriados.length);

        return {
            success: true,
            tabelasEncontradas: tables.length,
            metadados,
            arquivosCriados
        };
    } catch (erroOriginal) {
        const erro = erroOriginal instanceof Error ? erroOriginal : new Error(String(erroOriginal));
        if (!erro.publicMessage) {
            if ([
                "ErroValidacaoCabecalho",
                "ErroValidacaoArquivo",
                "ErroEstruturaDocumento"
            ].includes(erro.name)) {
                erro.publicMessage = erro.message;
            } else {
                erro.publicMessage = `Ocorreu um problema durante ${etapa}. Verifique se o arquivo está correto e tente novamente.`;
            }
        }
        erro.etapa = erro.etapa || etapa;
        console.error(`main.js - Erro durante ${erro.etapa}:`, erro);
        throw erro;
    } finally {
        await fs.rm(path.join(os.tmpdir(), `automacao-docx-imagens-${process.pid}`), {
            recursive: true,
            force: true
        });
    }
}

caminhoBaseSaida = path.resolve(__dirname, "./public/images");

module.exports = { executar };

if (require.main === module) {
    const caminhoArquivo = process.argv[2] || "./SIS.docx";
    executar(caminhoArquivo)
        .then(resultado => {
            console.log("Processamento finalizado com sucesso.");
            console.log("Tabelas encontradas:", resultado.tabelasEncontradas);
            console.log("Arquivos criados:", resultado.arquivosCriados.length);
        })
        .catch(erro => {
            console.error("Erro:", erro.publicMessage || erro.message);
            process.exitCode = 1;
        });
}
