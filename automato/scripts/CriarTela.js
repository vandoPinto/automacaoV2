/**
 * Responsável por criar uma tela HTML a partir do conteúdo extraído de um documento.
 *
 * Funcionalidades:
 * - Identifica o tipo de tela a partir do conteúdo (<p><strong>Tipo</strong></p>)
 * - Normaliza o tipo para corresponder aos componentes cadastrados
 * - Remove a linha de tipo do conteúdo antes de processar
 * - Seleciona o componente correspondente ao tipo e processa o HTML
 * - Cria pastas usando a sigla e o número da lição extraídos do cabeçalho
 * - Organiza os arquivos por tópico e número da tela
 * - Copia para a pasta do tópico as imagens utilizadas pelo HTML
 * - Ajusta os caminhos das imagens para serem relativos ao próprio HTML
 * - Propaga erros de processamento e gravação para o fluxo principal
 *
 * Fluxo:
 * 1. Determina o nome da tela (ex.: "Tela 1")
 * 2. Busca o tipo de tela no conteúdo usando regex
 *    - Se encontrado, decodifica HTML e normaliza o tipo
 *    - Se não encontrado, usa "texto" como padrão
 * 3. Remove a linha de tipo do conteúdo
 * 4. Seleciona o componente correspondente ao tipo normalizado
 * 5. Processa o conteúdo via componente (substituindo placeholders no template)
 * 6. Cria a estrutura <sigla><lição>/<sigla><lição>_<tópico>
 * 7. Copia as imagens referenciadas para a pasta do tópico
 * 8. Ajusta os caminhos das imagens e salva o HTML como <sigla><lição>_<tópico>_<tela>.html
 *
 * Parâmetros:
 * @param {number} numeroLicao - Número da lição (ex.: 1, 2, 3)
 * @param {number} index - Índice da tela dentro da lição
 * @param {string} conteudo - Conteúdo HTML da tela (extraído do DOCX)
 * @param {string} caminhoBaseSaida - Diretório base onde as telas serão salvas
 * @param {{sigla: string, numeroLicao: number, titulo?: string}} metadados - Metadados do cabeçalho
 * @param {number} numeroTopico - Número do tópico, começando em 0
 *
 * Retorno:
 * @returns {Promise<string>} - Caminho completo do arquivo HTML criado
 *
 * Observações:
 * - Se o tipo da tela não estiver cadastrado, o componente "texto" será usado
 * - Erros de processamento e escrita em disco são propagados para o chamador
 * - Este módulo depende de:
 *     - Componentes cadastrados em ComponentesLista.js
 *     - Funções utilitárias decodeHTML e normalizarTipo
 */


const path = require("path");
const os = require("os");
const fs = require("fs/promises");
const componentes = require("./ComponentesLista");
const { decodeHTML, normalizarTipo } = require("./Utils");

/**
 * Cria uma tela HTML e salva no diretório correspondente à lição e ao tópico.
 * Exemplo: sis01/sis01_00/sis01_00_1.html
 */
async function CriarTela(
    numeroLicao,
    index,
    conteudo,
    caminhoBaseSaida,
    metadados = {},
    numeroTopico = 0
) {
    const nomeTela = `Tela ${index}`;

    if (!conteudo || typeof conteudo !== "string") {
        throw new Error(`CriarTela.js - O conteúdo da ${nomeTela} não foi informado ou não é válido.`);
    }
    if (!caminhoBaseSaida) {
        throw new Error("CriarTela.js - O caminho base de saída não foi informado.");
    }

    const sigla = String(metadados.sigla || "").trim().toLowerCase();
    const numeroLicaoCabecalho = Number(metadados.numeroLicao);
    const topico = Number(numeroTopico);
    const numeroTela = Number(index);

    if (!sigla) {
        throw new Error("CriarTela.js - A sigla não foi informada nos metadados do cabeçalho.");
    }
    if (!Number.isInteger(numeroLicaoCabecalho) || numeroLicaoCabecalho < 0) {
        throw new Error("CriarTela.js - O número da lição nos metadados é inválido.");
    }
    if (!Number.isInteger(topico) || topico < 0) {
        throw new Error(`CriarTela.js - O número do tópico "${numeroTopico}" é inválido.`);
    }
    if (!Number.isInteger(numeroTela) || numeroTela < 1) {
        throw new Error(`CriarTela.js - O número da tela "${index}" é inválido.`);
    }

    const siglaNumero = `${sigla}${String(numeroLicaoCabecalho).padStart(2, "0")}`;
    const topicoFormatado = String(topico).padStart(2, "0");
    const nomePastaTopico = `${siglaNumero}_${topicoFormatado}`;
    const nomeArquivo = `${nomePastaTopico}_${numeroTela}.html`;

    const regexTipo = /<p><strong>(.*?)<\/strong><\/p>/i;
    const matchTipo = conteudo.match(regexTipo);
    let tipoNormalizado = "texto";

    if (matchTipo) {
        const tipoTela = decodeHTML(matchTipo[1].trim()).replace(/[<>]/g, "");
        tipoNormalizado = normalizarTipo(tipoTela);
        console.log(`CriarTela.js - Lição ${numeroLicaoCabecalho} - Tópico ${topicoFormatado} - ${nomeTela} - Tipo: ${tipoTela}`);
    } else {
        console.log(`CriarTela.js - ⚠️ ${nomeTela} sem tipo identificado; usando "texto".`);
    }

    conteudo = conteudo.replace(regexTipo, "");
    const componente = componentes[tipoNormalizado] || componentes["texto"];
    let htmlFinal;

    try {
        // Mantém a assinatura atual dos componentes.
        htmlFinal = await componente(conteudo, numeroLicao, index);
    } catch (erro) {
        console.error(`CriarTela.js - Erro ao processar o componente "${tipoNormalizado}":`, erro);
        throw new Error(`Não foi possível processar a tela ${index} do tópico ${topicoFormatado}: ${erro.message || erro}`);
    }

    try {
        const pastaSaida = path.join(caminhoBaseSaida, siglaNumero, nomePastaTopico);
        await fs.mkdir(pastaSaida, { recursive: true });
        // Copia para a pasta do tópico as imagens referenciadas pelo HTML.
        // As imagens extraídas ficam temporariamente fora da pasta pública.
        // Depois de copiar, o HTML usa apenas o nome do arquivo, pois a imagem
        // fica ao lado dos arquivos HTML.
        const regexImagem = /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi;
        const imagensEncontradas = [...htmlFinal.matchAll(regexImagem)];

        for (const imagem of imagensEncontradas) {
            const srcOriginal = imagem[3].replace(/&amp;/g, "&").trim();

            // Ignora URLs externas e data URIs; só processa imagens locais.
            if (/^(?:https?:)?\/\//i.test(srcOriginal) || /^data:/i.test(srcOriginal)) {
                continue;
            }

            const nomeImagem = path.basename(srcOriginal.split(/[?#]/)[0]);
            if (!nomeImagem || nomeImagem === "." || nomeImagem === path.sep) {
                continue;
            }

            const origemImagem = path.join(os.tmpdir(), `automacao-docx-imagens-${process.pid}`, nomeImagem);
            const destinoImagem = path.join(pastaSaida, nomeImagem);

            try {
                await fs.copyFile(origemImagem, destinoImagem);
                const tagOriginal = imagem[0];

                // caminhoBaseSaida deve apontar para a pasta public/images.
                // A raiz pública será a pasta imediatamente acima dela.
                const raizPublica = path.dirname(path.resolve(caminhoBaseSaida));

                const caminhoRelativo = path
                    .relative(raizPublica, destinoImagem)
                    .split(path.sep)
                    .join("/");

                const tagAtualizada = tagOriginal.replace(
                    imagem[3],
                    caminhoRelativo
                );

                htmlFinal = htmlFinal.replace(tagOriginal, tagAtualizada);
            } catch (erroImagem) {
                // Pode ser uma imagem externa à extração do DOCX; não interrompe a tela.
                console.warn(
                    `CriarTela.js - ⚠️ Não foi possível copiar a imagem "${nomeImagem}" para ${pastaSaida}:`,
                    erroImagem.message
                );
            }
        }

        const caminhoTela = path.join(pastaSaida, nomeArquivo);
        await fs.writeFile(caminhoTela, htmlFinal, "utf-8");
        console.log(`CriarTela.js - ✅ Arquivo criado: ${caminhoTela}`);
        return caminhoTela;
    } catch (erro) {
        console.error(`CriarTela.js - Erro ao salvar ${nomeArquivo}:`, erro);
        throw new Error(`Não foi possível salvar o arquivo ${nomeArquivo}: ${erro.message || erro}`);
    }
}

module.exports = { CriarTela };
