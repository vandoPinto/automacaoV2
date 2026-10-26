/**
 * Gera o JSON de configuração do curso a partir do modelo.
 * Substitui o identificador wbtsis pela sigla lida do DOCX.
 * Se o JSON de destino já existir, preserva-o sem sobrescrever.
 */
const fs = require("fs/promises");
const path = require("path");

async function GerarJsonConfiguracao(metadados, diretorioBase = path.resolve(__dirname, "..", "public", "scripts", "json")) {
    if (!metadados || !metadados.sigla) {
        throw new Error("GerarJsonConfiguracao.js - A sigla do curso não foi informada nos metadados.");
    }

    const sigla = String(metadados.sigla).trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(sigla)) {
        throw new Error("GerarJsonConfiguracao.js - A sigla do curso contém caracteres inválidos.");
    }

    const identificador = `wbt${sigla}`;
    const caminhoModelo = path.resolve(__dirname, "modelos", "wbt-modelo.json");
    const pastaDestino = path.join(diretorioBase, identificador);
    const caminhoDestino = path.join(pastaDestino, `${identificador}.json`);

    // Não substitui um JSON já existente para preservar configurações manuais.
    try {
        await fs.access(caminhoDestino);
        console.log(`GerarJsonConfiguracao.js - JSON já existe; mantido sem alteração: ${caminhoDestino}`);
        return caminhoDestino;
    } catch (erro) {
        if (erro.code !== "ENOENT") throw erro;
    }

    const modelo = JSON.parse(await fs.readFile(caminhoModelo, "utf8"));
    function substituirIdentificador(valor) {
        if (typeof valor === "string") return valor.replace(/wbtsis/gi, identificador);
        if (Array.isArray(valor)) return valor.map(substituirIdentificador);
        if (valor && typeof valor === "object") {
            return Object.fromEntries(Object.entries(valor).map(([chave, item]) => [chave, substituirIdentificador(item)]));
        }
        return valor;
    }

    const configuracao = substituirIdentificador(modelo);
    await fs.mkdir(pastaDestino, { recursive: true });
    // wx evita sobrescrever o arquivo caso ele seja criado entre a verificação e a gravação.
    try {
        await fs.writeFile(caminhoDestino, `${JSON.stringify(configuracao, null, 4)}\n`, { encoding: "utf8", flag: "wx" });
        console.log(`GerarJsonConfiguracao.js - JSON criado: ${caminhoDestino}`);
    } catch (erro) {
        if (erro.code !== "EEXIST") throw erro;
        console.log(`GerarJsonConfiguracao.js - JSON já existe; mantido sem alteração: ${caminhoDestino}`);
    }
    return caminhoDestino;
}

module.exports = { GerarJsonConfiguracao };
