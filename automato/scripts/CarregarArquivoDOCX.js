/**
 * Responsável por converter um arquivo .docx em HTML e extrair suas imagens.
 *
 * Funcionalidades:
 * - Utiliza a biblioteca `mammoth` para conversão DOCX → HTML
 * - Extrai imagens embutidas no documento (base64)
 * - Salva imagens automaticamente no diretório de saída
 * - Ajusta os caminhos das imagens no HTML gerado
 *
 * Fluxo:
 * 1. Verifica/cria diretório base de saída
 * 2. Durante a conversão:
 *    - Lê imagens do DOCX
 *    - Converte para buffer
 *    - Salva no disco
 * 3. Retorna o HTML final com caminhos ajustados
 *
 * Padrões utilizados:
 * - Nomeação sequencial de imagens (img_0, img_1, ...)
 * - Criação automática de diretórios
 *
 * Parâmetros:
 * @param {string} caminho - Caminho do arquivo .docx
 * @param {string} caminhoBaseSaida - Diretório base de saída
 *
 * Retorno:
 * @returns {Promise<string>} HTML convertido
 *
 * Observação:
 * - Esta função é a base do pipeline de processamento
 */

const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

async function CarregarArquivoDOCX(caminho, caminhoBaseSaida) {

    const pastaSaida = caminhoBaseSaida;

    if (!fs.existsSync(pastaSaida)) {
        fs.mkdirSync(pastaSaida, { recursive: true });
    }

    let contadorImagem = 0;

    const options = {
        convertImage: mammoth.images.inline(async function (element) {
            const buffer = await element.read("base64");
            const ext = element.contentType.split("/")[1];
            const nomeImagem = `img_${contadorImagem++}.${ext}`;

            const pastaImagens = path.join(pastaSaida, "imagens");

            if (!fs.existsSync(pastaImagens)) {
                fs.mkdirSync(pastaImagens, { recursive: true });
            }

            const caminhoImagem = path.join(pastaImagens, nomeImagem);

            fs.writeFileSync(caminhoImagem, Buffer.from(buffer, "base64"));

            return {
                src: `./imagens/${nomeImagem}` // caminho correto no HTML
                // src: `../../imagens/${nomeImagem}` // caminho correto no HTML
            };
        })
    };

    const result = await mammoth.convertToHtml({ path: caminho }, options);

    return result.value;
}

module.exports = { CarregarArquivoDOCX };