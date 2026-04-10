/**
 * Responsável por criar uma tela HTML a partir do conteúdo extraído de um documento.
 *
 * Funcionalidades:
 * - Identifica o tipo de tela a partir do conteúdo (<p><strong>Tipo</strong></p>)
 * - Normaliza o tipo para corresponder aos componentes cadastrados
 * - Remove a linha de tipo do conteúdo antes de processar
 * - Seleciona o componente correspondente ao tipo e processa o HTML
 * - Cria o diretório de saída automaticamente, se necessário
 * - Salva a tela processada como arquivo HTML
 *
 * Fluxo:
 * 1. Determina o nome da tela (ex.: "Tela 1")
 * 2. Busca o tipo de tela no conteúdo usando regex
 *    - Se encontrado, decodifica HTML e normaliza o tipo
 *    - Se não encontrado, usa "texto" como padrão
 * 3. Remove a linha de tipo do conteúdo
 * 4. Seleciona o componente correspondente ao tipo normalizado
 * 5. Processa o conteúdo via componente (substituindo placeholders no template)
 * 6. Cria o diretório de saída (./telas/licaoX) se não existir
 * 7. Salva o arquivo HTML final no diretório de saída
 *
 * Parâmetros:
 * @param {number} numeroLicao - Número da lição (ex.: 1, 2, 3)
 * @param {number} index - Índice da tela dentro da lição
 * @param {string} conteudo - Conteúdo HTML da tela (extraído do DOCX)
 * @param {string} caminhoBaseSaida - Diretório base onde as telas serão salvas
 *
 * Retorno:
 * @returns {Promise<void>} - Não retorna valor; salva o HTML diretamente no disco
 *
 * Observações:
 * - Se o tipo da tela não estiver cadastrado, o componente "texto" será usado
 * - Erros de processamento do componente ou escrita em disco são logados no console
 * - Este módulo depende de:
 *     - Componentes cadastrados em ComponentesLista.js
 *     - Funções utilitárias decodeHTML e normalizarTipo
 */


const path = require("path");
const fs = require("fs/promises");
const componentes = require("./ComponentesLista");
const { decodeHTML, normalizarTipo } = require("./Utils");

async function CriarTela(numeroLicao, index, conteudo, caminhoBaseSaida) {
    const nomeTela = `Tela ${index}`;
    const regexTipo = /<p><strong>(.*?)<\/strong><\/p>/i;
    const matchTipo = conteudo.match(regexTipo);

    let tipoNormalizado = "texto"; // padrão
    if (matchTipo) {
        let tipoTela = decodeHTML(matchTipo[1].trim()).replace(/[<>]/g, "");
        tipoNormalizado = normalizarTipo(tipoTela);
        console.log(`criarTela.js - ✅ Lição ${numeroLicao} - ${nomeTela} - Tipo: ${tipoTela}`);
    } else {
        console.log(`criarTela.js - ⚠️ ${nomeTela} sem tipo identificado`);
    }

    // Remover linha de tipo do conteúdo
    conteudo = conteudo.replace(regexTipo, "");

    // Encontrar componente e processar
    const componente = componentes[tipoNormalizado] || componentes["texto"];

    console.log('CriarTela.js - Tipo normalizado pedido', tipoNormalizado);
    let htmlFinal;
    try {
        htmlFinal = await componente(conteudo, numeroLicao, index);
    } catch (erro) {
        console.error(`❌ Erro ao processar componente ${tipoNormalizado}:`, erro);
        htmlFinal = conteudo;
    }

    // Criar pasta e salvar arquivo
    try {
        const pastaSaida = path.join(caminhoBaseSaida);
        // const pastaSaida = path.join(caminhoBaseSaida, "licao", "topico" + numeroLicao);
        await fs.mkdir(pastaSaida, { recursive: true });

        const caminhoTela = path.join(pastaSaida, `tela-${index}.html`);
        await fs.writeFile(caminhoTela, htmlFinal, "utf-8");
    } catch (erro) {
        console.error(`❌ Erro ao criar ${nomeTela}:`, erro);
    }
}

module.exports = { CriarTela };