/**
 * Copia os HTMLs genéricos de scripts/modelos/wbtmodelo para a pasta do curso.
 * Os modelos originais permanecem intactos. Somente as cópias recebem o prefixo
 * wbt + sigla lida do DOCX. Arquivos de mesmo nome no destino são sobrescritos.
 */
const fs = require("fs/promises");
const path = require("path");

async function GerenciarConfiguracaoWbt(
    metadados,
    diretorioImagens = path.resolve(__dirname, "..", "public", "images"),
    diretorioModelos = path.resolve(__dirname, "modelos", "wbtmodelo")
) {
    if (!metadados || !metadados.sigla) {
        throw new Error("GerenciarConfiguracaoWbt.js - Sigla não encontrada nos metadados do DOCX.");
    }

    const sigla = String(metadados.sigla).trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(sigla)) {
        throw new Error("GerenciarConfiguracaoWbt.js - A sigla contém caracteres inválidos.");
    }

    const identificador = `wbt${sigla}`;
    const destino = path.join(diretorioImagens, identificador, identificador);

    let itens;
    try {
        itens = await fs.readdir(diretorioModelos, { withFileTypes: true });
    } catch (erro) {
        if (erro.code === "ENOENT") {
            throw new Error(`GerenciarConfiguracaoWbt.js - A pasta de modelos não foi encontrada: ${diretorioModelos}`);
        }
        throw erro;
    }

    const modelosHtml = itens.filter(item =>
        item.isFile() && path.extname(item.name).toLowerCase() === ".html"
    );

    if (modelosHtml.length === 0) {
        throw new Error(`GerenciarConfiguracaoWbt.js - Nenhum arquivo HTML foi encontrado em: ${diretorioModelos}`);
    }

    await fs.mkdir(destino, { recursive: true });
    const arquivosCopiados = [];

    for (const item of modelosHtml) {
        // Exemplo: modelo_1_0.html -> wbtabc_1_0.html
        const nomeDestino = item.name.replace(/^modelo(?=_)/i, identificador);
        const caminhoOrigem = path.join(diretorioModelos, item.name);
        const caminhoDestino = path.join(destino, nomeDestino);

        // Sobrescreve somente a cópia no destino; o arquivo de modelo não é alterado.
        await fs.copyFile(caminhoOrigem, caminhoDestino);
        arquivosCopiados.push(caminhoDestino);
    }

    console.log(
        `GerenciarConfiguracaoWbt.js - ${arquivosCopiados.length} HTML(s) copiado(s) para ${destino}`
    );

    return {
        alterado: arquivosCopiados.length > 0,
        origem: diretorioModelos,
        destino,
        arquivosCopiados
    };
}

module.exports = { GerenciarConfiguracaoWbt };
