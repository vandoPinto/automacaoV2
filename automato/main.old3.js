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
const { AtualizarWbtJson } = require("./scripts/AtualizarWbtJson");
const { GerarJsonConfiguracao } = require("./scripts/GerarJsonConfiguracao");
const { parse } = require("node-html-parser");
const path = require("path");
const fs = require("fs/promises");
const os = require("os");
const caminhoWbt = path.resolve(__dirname, "public", "scripts", "json", "wbt.json");
const caminhoApp = path.resolve(__dirname, "public", "scripts", "app.js");

// Diretório base onde as pastas siglaNN serão criadas.
var caminhoBaseSaida;

/**
 * Atualiza o módulo 86 do app.js com o conteúdo atual do wbt.json.
 * Antes de gravar, cria/atualiza a cópia de segurança app.js.bak.
 *
 * @param {string} caminhoJson Caminho do wbt.json.
 * @param {string} caminhoBundle Caminho do app.js compilado.
 */
async function AtualizarModulo86(caminhoJson = caminhoWbt, caminhoBundle = caminhoApp) {
    const dadosWbt = JSON.parse(await fs.readFile(caminhoJson, "utf-8"));
    const appOriginal = await fs.readFile(caminhoBundle, "utf-8");

    // O bundle fornecido contém o módulo 86 imediatamente antes do módulo 87.
    const regexModulo86 = /86: \[function \(require, module, exports\) \{[\s\S]*?(?=\n\s*\}, \{\}\], 87: \[function \(require, module, exports\) \{)/;

    if (!regexModulo86.test(appOriginal)) {
        throw new Error(
            "Não foi possível localizar o módulo 86 seguido do módulo 87 no app.js. Nenhuma alteração foi gravada."
        );
    }

    const moduloNovo = `86: [function (require, module, exports) {\n    module.exports = ${JSON.stringify(dadosWbt)};`;
    const appAtualizado = appOriginal.replace(regexModulo86, moduloNovo);

    await fs.copyFile(caminhoBundle, `${caminhoBundle}.bak`);
    await fs.writeFile(caminhoBundle, appAtualizado, "utf-8");
    console.log("main.js - Módulo 86 atualizado; backup salvo em app.js.bak.");
}


/**
 * Processa o DOCX, extrai os metadados do cabeçalho e gera os arquivos de cada tópico.
 *
 * @param {string} arquivo Caminho do arquivo DOCX de entrada.
 * @returns {Promise<{success: boolean, tabelasEncontradas: number, metadados: object, arquivosCriados: string[]}>}
 * @throws {Error} Erro com etapa e mensagem segura para exibição na interface.
 */
async function executar(arquivo) {
    const tabelas = [];
    const arquivosCriados = [];
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

        // A primeira tabela contém os metadados gerais do documento.
        etapa = "validação do cabeçalho";
        const metadados = CriarCabecalho(parse(tables[0].innerHTML));

        // Cada tabela seguinte representa um tópico. O número do tópico é lido
        // da primeira linha da própria tabela, por exemplo, "Tópico 0".
        for (let index = 1; index < tables.length; index++) {
            const tabela = tables[index];
            tabelas.push(tabela.innerHTML);

            etapa = `processamento do tópico da tabela ${index}`;
            const caminhos = await SelecionarTelas(
                parse(tabela.innerHTML),
                index,
                caminhoBaseSaida,
                metadados
            );

            arquivosCriados.push(...caminhos);
        }

        // Atualiza o arquivo global somente depois que todos os tópicos forem processados.
        etapa = "atualização do wbt.json";
        await AtualizarWbtJson(caminhoWbt, metadados);

        etapa = "geração do JSON de configuração do curso";
        const caminhoJsonConfiguracao = await GerarJsonConfiguracao(metadados);

        etapa = "atualização do módulo 86 do app.js";
        await AtualizarModulo86(caminhoWbt, caminhoApp);

        console.log("main.js - TABELAS ENCONTRADAS:", tables.length);
        console.log("main.js - ARQUIVOS CRIADOS:", arquivosCriados.length);

        return {
            success: true,
            tabelasEncontradas: tables.length,
            metadados,
            arquivosCriados,
            caminhoJsonConfiguracao
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
        // Remove os arquivos temporários extraídos do DOCX. As cópias definitivas
        // já ficam diretamente nas pastas dos tópicos, ao lado dos HTMLs.
        await fs.rm(path.join(os.tmpdir(), `automacao-docx-imagens-${process.pid}`), {
            recursive: true,
            force: true
        });
    }
}

// Saída solicitada: automato/public/images/sis01/sis01_00/...
caminhoBaseSaida = path.resolve(__dirname, "./public/images");

module.exports = { executar, AtualizarModulo86 };

// Permite executar diretamente com node main.js [arquivo.docx].
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
