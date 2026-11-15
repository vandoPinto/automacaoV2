const { carregarTemplate, decodeHTML } = require("../../Utils");

function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>\"']/g, caractere => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[caractere]);
}

function obterAtributo(atributos, nome) {
    const match = String(atributos || "").match(new RegExp(`\\b${nome}\\s*=\\s*([\"'])(.*?)\\1`, "i"));
    return match ? decodeHTML(match[2]) : "";
}

function normalizarTexto(valor) {
    return decodeHTML(String(valor || "")
        .replace(/<br\b[^>]*>/gi, " ")
        .replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function lerImagem(conteudo) {
    const origem = String(conteudo || "");
    const item = origem.match(/<imagemitem\b([^>]*)>([\s\S]*?)<\/imagemitem\s*>/i);
    const atributos = item?.[1] || "";
    const htmlImagens = item ? item[2] : origem;
    const titulo = normalizarTexto(obterAtributo(atributos, "data-titulo"));
    const rodape = normalizarTexto(obterAtributo(atributos, "data-rodape"));
    const tituloId = obterAtributo(atributos, "data-titulo-id");
    const rodapeId = obterAtributo(atributos, "data-rodape-id");
    const imagens = [];

    for (const match of htmlImagens.matchAll(/<img\b([^>]*)>/gi)) {
        const src = obterAtributo(match[0], "src").trim();
        if (!src || /^(?:javascript|vbscript|file|blob):/i.test(src)) continue;
        if (/^data:/i.test(src) && !/^data:image\/(?:png|jpe?g|gif|webp|bmp|svg\+xml);/i.test(src)) continue;
        const alt = obterAtributo(match[1], "alt");
        const inspectId = obterAtributo(match[1], "data-automato-inspect-id");
        const inspectAttribute = /^[\w-]+$/.test(inspectId) ? ` data-automato-inspect-id="${escaparHtml(inspectId)}"` : "";
        imagens.push(`<img src="${escaparHtml(src)}" alt="${escaparHtml(alt)}" loading="eager"${inspectAttribute}>`);
    }

    return { titulo, rodape, tituloId, rodapeId, imagens };
}

module.exports = async function (conteudo) {
    const { titulo, rodape, tituloId, rodapeId, imagens } = lerImagem(conteudo);
    if (!imagens.length) return "";

    const template = await carregarTemplate("imagem");
    const titleInspect = /^[\w-]+$/.test(tituloId) ? ` data-automato-inspect-id="${escaparHtml(tituloId)}"` : "";
    const footerInspect = /^[\w-]+$/.test(rodapeId) ? ` data-automato-inspect-id="${escaparHtml(rodapeId)}"` : "";
    return template
        .replace("{{TITULO}}", titulo ? `<p class="imagem-componente-titulo"${titleInspect}>${escaparHtml(titulo)}</p>` : "")
        .replace("{{IMAGENS}}", imagens.join("\n"))
        .replace("{{RODAPE}}", rodape ? `<p class="imagem-componente-rodape"${footerInspect}>${escaparHtml(rodape)}</p>` : "");
};

module.exports.lerImagem = lerImagem;
