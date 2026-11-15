const { carregarTemplate, resolverArquivoCurso, decodeHTML } = require("../../Utils");

const EXTENSOES_VISUALIZAVEIS = new Set([
    "pdf",
    "apng", "avif", "bmp", "gif", "jpg", "jpeg", "png", "webp",
    "mp3", "m4a", "aac", "oga", "ogg", "wav",
    "mp4", "m4v", "mov", "webm", "ogv",
    "txt", "csv", "json", "xml"
]);

function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>\"']/g, caractere => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[caractere]);
}

function obterAtributo(atributos, nome) {
    const nomeSeguro = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const encontrado = String(atributos || "").match(new RegExp(`\\b${nomeSeguro}\\s*=\\s*([\"'])(.*?)\\1`, "i"));
    return encontrado ? decodeHTML(encontrado[2]) : "";
}

function normalizarTexto(valor) {
    return decodeHTML(String(valor || "")
        .replace(/<br\b[^>]*>/gi, " ")
        .replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function obterExtensao(nome) {
    const nomeDecodificado = decodeHTML(String(nome || "").trim());
    const semCaminho = nomeDecodificado.split(/[\\/]/).pop() || "";
    const ponto = semCaminho.lastIndexOf(".");
    return ponto < 0 ? "" : semCaminho.slice(ponto + 1).toLowerCase();
}

function arquivoPodeVisualizar(nome) {
    return EXTENSOES_VISUALIZAVEIS.has(obterExtensao(nome));
}

function lerItens(conteudo) {
    const origem = String(conteudo || "");
    const itens = [];
    const regex = /<arquivoitem\b([^>]*)>([\s\S]*?)<\/arquivoitem\s*>/gi;
    let item;

    while ((item = regex.exec(origem))) {
        const rotulo = normalizarTexto(obterAtributo(item[1], "data-rotulo"));
        const nomeArquivo = normalizarTexto(item[2]);
        if (rotulo && nomeArquivo) itens.push({ rotulo, nomeArquivo });
    }

    return itens;
}

function renderizarItem(item) {
    const caminho = resolverArquivoCurso(item.nomeArquivo);
    const nome = escaparHtml(item.nomeArquivo);
    const rotulo = escaparHtml(item.rotulo);
    const extensao = obterExtensao(item.nomeArquivo);
    const download = arquivoPodeVisualizar(item.nomeArquivo)
        ? ""
        : ` download="${nome}"`;
    const icone = arquivoPodeVisualizar(item.nomeArquivo)
        ? (extensao === "pdf" ? "bi-file-earmark-pdf" : "bi-file-earmark-text")
        : "bi-download";

    return `<a class="arquivo-componente-botao" href="${escaparHtml(caminho)}" target="_blank" rel="noopener noreferrer"${download}><i class="bi ${icone}" aria-hidden="true"></i><span>${rotulo}</span></a>`;
}

module.exports = async function (conteudo) {
    const template = await carregarTemplate("arquivo");
    const itens = lerItens(conteudo);
    const htmlItens = itens.length
        ? itens.map(renderizarItem).join("\n")
        : '<span class="arquivo-componente-vazio">Adicione um arquivo para disponibilizar ao aluno.</span>';

    return template.replace("{{ITENS}}", htmlItens);
};

module.exports.arquivoPodeVisualizar = arquivoPodeVisualizar;
module.exports.obterExtensao = obterExtensao;
module.exports.lerItens = lerItens;
