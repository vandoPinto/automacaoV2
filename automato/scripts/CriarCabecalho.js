
/**
 * Responsável por processar o conteúdo do cabeçalho do documento.
 *
 * Entrada:
 * - HTML da primeira tabela do DOCX (já parseado)
 *
 * Objetivo:
 * - Extrair metadados relevantes do documento, como:
 *   - Nome da lição
 *   - Sigla do curso ou sistema
 *   - Número da lição
 *   - Informações estruturais
 *
 * Funcionalidades:
 * - Extrai os metadados do cabeçalho do DOCX
 * - Preserva a separação entre as células da tabela
 * - Normaliza a sigla para letras maiúsculas
 * - Converte o número da lição para valor numérico
 * - Identifica o nome completo da lição
 * - Retorna os dados estruturados para os demais módulos
 * - Valida a existência dos campos obrigatórios
 *
 * Fluxo:
 * 1. Recebe o HTML do cabeçalho
 * 2. Extrai o texto preservando a separação das células
 * 3. Identifica a sigla, o número e o nome da lição
 * 4. Valida os dados encontrados
 * 5. Retorna os metadados extraídos
 *
 * Possíveis evoluções:
 * - Gerar arquivos JSON (ex: wbtsis.json)
 * - Criar configuração global do curso
 * - Integrar os metadados à geração de pastas e arquivos HTML
 *
 * @param {HTMLElement|string} licaoHTML - HTML do cabeçalho
 * @returns {{sigla: string, numeroLicao: number, titulo: string}}
 *          Metadados extraídos do cabeçalho
 * @throws {Error} Caso os campos obrigatórios não sejam encontrados
 */

function CriarCabecalho(licaoHTML) {
    if (!licaoHTML) {
        throw new Error(
            "CriarCabecalho.js - O conteúdo do cabeçalho não foi informado."
        );
    }

    // 1. Extrair o texto preservando a separação entre células.
    let texto = "";
    let celulas = [];

    if (typeof licaoHTML === "string") {
        texto = licaoHTML
            .replace(/<\/(?:td|th|tr|p|div)>/gi, " | ")
            .replace(/<[^>]*>/g, " ");
    } else {
        // Quando o objeto possui a API do node-html-parser.
        if (typeof licaoHTML.querySelectorAll === "function") {
            celulas = licaoHTML
                .querySelectorAll("td, th")
                .map(celula =>
                    celula.textContent
                        .replace(/&nbsp;|&#160;/gi, " ")
                        .replace(/\s+/g, " ")
                        .trim()
                )
                .filter(Boolean);
        }

        texto = licaoHTML.textContent || "";

        // Alternativa: preservar as células a partir do HTML original.
        if (celulas.length === 0 && typeof licaoHTML.toString === "function") {
            texto = licaoHTML.toString()
                .replace(/<\/(?:td|th|tr|p|div)>/gi, " | ")
                .replace(/<[^>]*>/g, " ");
        }
    }

    // Normalizar entidades HTML e espaços.
    texto = texto
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();

    // 2. Procurar valores diretamente nas células.
    function obterValorDaCelula(rotuloRegex) {
        const indice = celulas.findIndex(celula =>
            rotuloRegex.test(celula)
        );

        if (indice === -1) {
            return "";
        }

        // O valor pode estar na mesma célula do rótulo.
        const mesmaCelula = celulas[indice]
            .replace(rotuloRegex, "")
            .replace(/^\s*[:\-]?\s*/, "")
            .trim();

        if (mesmaCelula) {
            return mesmaCelula;
        }

        // Caso contrário, procurar o valor na próxima célula.
        return celulas[indice + 1] || "";
    }

    const regexNome = /^Nome\s+Li[cç][aã]o\s*:?\s*$/i;
    const regexSigla = /^Sigla\s*:?\s*$/i;
    const regexNumero = /^N[uú]mero\s+li[cç][aã]o\s*:?\s*$/i;

    let titulo = obterValorDaCelula(regexNome);
    let sigla = obterValorDaCelula(regexSigla);
    let numero = obterValorDaCelula(regexNumero);

    // 3. Alternativa para quando o HTML não preservar as células.
    // O título termina antes do campo Sigla.
    if (!titulo) {
        const resultadoTitulo = texto.match(
            /Nome\s+Li[cç][aã]o\s*:?\s*(.*?)\s*(?:\|\s*)?Sigla\s*:/i
        );

        if (resultadoTitulo) {
            titulo = resultadoTitulo[1].trim();
        }
    }

    // Captura somente a sigla, sem incorporar "Autor".
    if (!sigla) {
        const resultadoSigla = texto.match(
            /Sigla\s*:\s*([A-Z0-9_-]+)/i
        );

        if (resultadoSigla) {
            sigla = resultadoSigla[1];
        }
    }

    if (!numero) {
        const resultadoNumero = texto.match(
            /N[uú]mero\s+li[cç][aã]o\s*:\s*(\d+)/i
        );

        if (resultadoNumero) {
            numero = resultadoNumero[1];
        }
    }

    // Limpar os valores extraídos.
    titulo = titulo.trim();
    sigla = sigla.trim().split(/\s+/)[0].toUpperCase();

    const numeroLicao = Number(
        (numero.match(/\d+/) || [])[0]
    );

    // 4. Validar todos os campos obrigatórios.
    const pendencias = [];

    if (!titulo) {
        pendencias.push(
            "Nome Lição: não informado ou não identificado no cabeçalho."
        );
    }

    if (!sigla) {
        pendencias.push(
            "Sigla: não informada ou não identificada no cabeçalho."
        );
    }

    if (
        !numero ||
        !Number.isInteger(numeroLicao) ||
        numeroLicao < 0
    ) {
        pendencias.push(
            "Número lição: não informado ou inválido."
        );
    }

    // 5. Exibir todas as pendências de uma só vez.
    if (pendencias.length > 0) {
        const mensagem = [
            "Não foi possível processar o cabeçalho do documento.",
            "",
            "Informações que precisam ser corrigidas:",
            ...pendencias.map(
                (pendencia, indice) =>
                    `${indice + 1}. ${pendencia}`
            ),
            "",
            "Corrija o cabeçalho do arquivo Word e tente novamente."
        ].join("\n");

        const erro = new Error(mensagem);
        erro.name = "ErroValidacaoCabecalho";

        throw erro;
    }

    // 6. Retornar os metadados somente se estiverem válidos.
    const metadados = {
        sigla,
        numeroLicao,
        titulo
    };

    console.log("CriarCabecalho.js - Metadados extraídos:");
    console.log("Sigla:", metadados.sigla);
    console.log("Número da lição:", metadados.numeroLicao);
    console.log("Nome da lição:", metadados.titulo);

    return metadados;
}

module.exports = { CriarCabecalho };
