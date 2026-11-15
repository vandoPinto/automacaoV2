const { carregarTemplate, decodeHTML } = require("../../Utils");

function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>\"']/g, caractere => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[caractere]);
}

function textoSimples(valor) {
    return decodeHTML(String(valor || "")
        .replace(/<br\b[^>]*>/gi, " ")
        .replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function lerItens(conteudo) {
    const itens = [];
    const regex = /<destaqueitem\b[^>]*>([\s\S]*?)<\/destaqueitem\s*>/gi;
    let match;

    while ((match = regex.exec(String(conteudo || "")))) {
        const bloco = match[1];
        const titulo = bloco.match(/<destaquetitulo\b[^>]*>([\s\S]*?)<\/destaquetitulo\s*>/i)?.[1] || "";
        const corpo = bloco.match(/<destaqueconteudo\b[^>]*>([\s\S]*?)<\/destaqueconteudo\s*>/i)?.[1] || "";
        if (!textoSimples(titulo) || !String(corpo).trim()) continue;
        itens.push({ titulo: textoSimples(titulo), corpo: String(corpo).trim() });
    }

    return itens;
}

module.exports = async function (conteudo) {
    const template = await carregarTemplate("destaque");
    const itens = lerItens(conteudo);
    const htmlItens = itens.map(({ titulo, corpo }) =>
        `<aside class="destaque-componente-item" role="note"><p class="destaque-componente-titulo">${escaparHtml(titulo)}</p>` +
        `<div class="destaque-componente-conteudo">${corpo}</div></aside>`
    ).join("\n");

    return template.replace("{{ITENS}}", htmlItens);
};

module.exports.lerItens = lerItens;
