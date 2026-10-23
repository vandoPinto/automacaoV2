/**
 * Atualiza o arquivo global wbt.json com os metadados do curso e da lição processada.
 *
 * Regras:
 * - Preserva as configurações existentes, alterando apenas os campos derivados do curso.
 * - Mantém o primeiro objeto de "oas" (Convenções) e seus dados, alterando somente sua sigla.
 * - Cria ou substitui a unidade correspondente à lição, identificada pela sigla do curso e número da lição.
 * - Preserva todas as demais unidades já cadastradas.
 * - Registra os tópicos extraídos do DOCX, sempre com tipoNavegacao "misto".
 * - Calcula totalFrames por tópico e numTotalFrames por unidade.
 *
 * @param {string} caminhoWbt Caminho completo do arquivo wbt.json existente.
 * @param {{curso: string, sigla: string, numeroLicao: number, titulo: string, topicos: Array<{numero: number, nome: string, totalFrames: number}>}} metadados Dados extraídos do DOCX.
 * @returns {Promise<object>} Conteúdo atualizado do wbt.json.
 */
const fs = require("fs/promises");

async function AtualizarWbtJson(caminhoWbt, metadados) {
    if (!caminhoWbt) throw new Error("AtualizarWbtJson.js - O caminho do wbt.json não foi informado.");
    if (!metadados || !metadados.curso || !metadados.sigla || !metadados.titulo) {
        throw new Error("AtualizarWbtJson.js - Os metadados do curso e da lição estão incompletos.");
    }

    let wbt;
    try {
        wbt = JSON.parse(await fs.readFile(caminhoWbt, "utf-8"));
    } catch (erro) {
        throw new Error(`AtualizarWbtJson.js - Não foi possível ler o wbt.json existente (${caminhoWbt}): ${erro.message}`);
    }

    if (!wbt.config || !Array.isArray(wbt.oas) || !wbt.oas[0]) {
        throw new Error("AtualizarWbtJson.js - O wbt.json não contém config e o objeto oas[0] de Convenções. O arquivo não será recriado automaticamente para evitar perda de dados.");
    }

    const siglaCurso = String(metadados.sigla).trim().toLowerCase();
    const numeroLicao = Number(metadados.numeroLicao);
    if (!Number.isInteger(numeroLicao) || numeroLicao < 0) {
        throw new Error("AtualizarWbtJson.js - O número da lição é inválido.");
    }

    const siglaUnidade = `${siglaCurso}${String(numeroLicao).padStart(2, "0")}`;
    const convencoes = wbt.oas[0];

    // Atualiza somente os campos globais derivados do curso.
    wbt.config.label = String(metadados.curso).trim();
    wbt.config.siglafla = siglaCurso;
    wbt.config.principal = `wbt${siglaCurso}`;
    wbt.config.convencoes = `${siglaCurso}00`;

    // Convenções é mantida como primeiro item; só sua sigla muda.
    convencoes.sigla = `${siglaCurso}00`;

    const topicos = Array.isArray(metadados.topicos) ? metadados.topicos : [];
    const arquivos = topicos
        .slice()
        .sort((a, b) => a.numero - b.numero)
        .map(topico => ({
            nome: String(topico.nome || `Tópico ${topico.numero}`).trim(),
            sigla: `_${String(Number(topico.numero)).padStart(2, "0")}`,
            tipoNavegacao: "misto",
            demo: false,
            moldura: "",
            navegacao: "",
            totalFrames: Number(topico.totalFrames) || 0
        }));

    const unidade = {
        label: String(metadados.titulo).trim(),
        sigla: siglaUnidade,
        teste: true,
        arquivos,
        numTotalFrames: arquivos.reduce((total, arquivo) => total + arquivo.totalFrames, 0)
    };

    const indiceExistente = wbt.oas.findIndex((item, indice) => indice > 0 && item.sigla === siglaUnidade);
    if (indiceExistente >= 0) {
        wbt.oas[indiceExistente] = unidade;
    } else {
        wbt.oas.push(unidade);
    }

    await fs.writeFile(caminhoWbt, `${JSON.stringify(wbt, null, 4)}\n`, "utf-8");
    console.log(`AtualizarWbtJson.js - wbt.json atualizado: ${caminhoWbt}`);
    return wbt;
}

module.exports = { AtualizarWbtJson };
