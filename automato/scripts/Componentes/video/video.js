const { carregarTemplate, resolverArquivoCurso } = require("../../Utils");

let sequenciaInstancias = 0;

function escaparHtml(valor) {
    return String(valor ?? "").replace(/[&<>\"']/g, caractere => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
    })[caractere]);
}

function decodificarHtml(valor) {
    return String(valor || "")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;|&#34;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'");
}

function extrairTextoHtml(html) {
    return decodificarHtml(String(html || "")
        .replace(/<br\b[^>]*>/gi, " ")
        .replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function obterAtributoVideo(atributos, nome) {
    const escape = nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const correspondencia = String(atributos || "").match(new RegExp(`\\b${escape}\\s*=\\s*([\"'])(.*?)\\1`, "i"));
    return correspondencia ? decodificarHtml(correspondencia[2]) : "";
}

function normalizarYouTubeId(fonte) {
    let url;
    try {
        url = new URL(String(fonte || "").trim());
    } catch (_) {
        return "";
    }

    const host = url.hostname.toLowerCase();
    if (!["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(host)) return "";

    let id = "";
    if (host.endsWith("youtu.be")) {
        id = url.pathname.split("/").filter(Boolean)[0] || "";
    } else if (url.pathname === "/watch") {
        id = url.searchParams.get("v") || "";
    } else {
        const partes = url.pathname.split("/").filter(Boolean);
        if (["embed", "shorts", "live"].includes(partes[0])) id = partes[1] || "";
    }

    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
}

function parecePlaceholderYouTube(fonte) {
    const texto = String(fonte || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/\s+/g, " ")
        .trim();
    return /^(?:link\s+(?:do\s+)?youtube|youtube\s+link|cole\s+(?:aqui\s+)?(?:o\s+)?link(?:\s+do\s+youtube)?|insira\s+(?:aqui\s+)?(?:o\s+)?link(?:\s+do\s+youtube)?)\b/.test(texto);
}

function normalizarFonteArquivo(fonte) {
    const valor = String(fonte || "").trim();
    if (!valor) throw new Error("Informe o nome do arquivo enviado para a pasta arquivos.");
    if (/^(?:javascript|data|blob|file):/i.test(valor) || /^\/\//.test(valor)) {
        throw new Error("A fonte do vídeo deve ser um arquivo do curso ou um link seguro do YouTube.");
    }

    if (/^https?:\/\//i.test(valor)) {
        let url;
        try { url = new URL(valor); } catch (_) { throw new Error("O endereço do vídeo não é válido."); }
        if (!/\.(?:mp4|m4v|mov|webm|ogv|ogg)(?:$|[?#])/i.test(`${url.pathname}${url.search}${url.hash}`)) {
            throw new Error("Use o nome de um arquivo de vídeo do curso ou um link do YouTube.");
        }
        return encodeURI(valor);
    }

    return resolverArquivoCurso(valor);
}

function lerItensVideo(conteudo) {
    const origem = String(conteudo || "");
    const regex = /<videoitem\b([^>]*)>([\s\S]*?)<\/videoitem\s*>/gi;
    const itens = [];
    let match;

    while ((match = regex.exec(origem))) {
        const fonte = extrairTextoHtml(match[2]);
        const rotulo = obterAtributoVideo(match[1], "data-rotulo");
        const modoInformado = obterAtributoVideo(match[1], "data-modo").toLowerCase();
        const origemInformada = obterAtributoVideo(match[1], "data-origem").toLowerCase();
        const modo = modoInformado === "modal" || rotulo ? "modal" : "direto";
        const youtubeId = normalizarYouTubeId(fonte);
        const placeholderYoutube = parecePlaceholderYouTube(fonte);
        const origemVideo = youtubeId || placeholderYoutube || origemInformada === "youtube"
            ? "youtube"
            : "arquivo";

        if (!fonte) throw new Error("Cada linha preenchida do componente Vídeo precisa indicar um arquivo ou link.");
        if (origemVideo === "youtube" && !youtubeId && !placeholderYoutube) {
            throw new Error(`O link do YouTube não foi reconhecido: ${fonte}`);
        }

        itens.push({
            modo,
            origem: origemVideo,
            fonte,
            rotulo: rotulo || (modo === "modal" ? `Assistir vídeo ${itens.length + 1}` : "")
        });
    }

    if (!itens.length) throw new Error("Adicione ao menos uma linha de vídeo ao componente.");
    return itens;
}

function criarEmbedYouTube(id, iniciar = false) {
    const parametros = new URLSearchParams({ controls: "1", playsinline: "1", rel: "0" });
    if (iniciar) parametros.set("autoplay", "1");
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${parametros.toString()}`;
}

function criarPlayer(item, idPlayer, modal = false) {
    if (item.origem === "youtube" && parecePlaceholderYouTube(item.fonte)) {
        return `<div class="video-componente-placeholder" role="note"><i class="bi bi-link-45deg" aria-hidden="true"></i><span>Substitua este texto pelo link do YouTube.</span></div>`;
    }

    if (item.origem === "youtube") {
        const id = normalizarYouTubeId(item.fonte);
        if (!id) throw new Error(`O link do YouTube não foi reconhecido: ${item.fonte}`);
        const src = criarEmbedYouTube(id, modal);
        const atributoFonte = modal ? `data-video-src="${escaparHtml(src)}"` : `src="${escaparHtml(src)}"`;
        return `<div class="video-componente-player video-componente-player--youtube"><iframe ${atributoFonte} title="Vídeo do YouTube" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    }

    const src = normalizarFonteArquivo(item.fonte);
    const atributoFonte = modal ? `data-video-src="${escaparHtml(src)}"` : `src="${escaparHtml(src)}"`;
        return `<div class="video-componente-player video-componente-player--arquivo"><video controls playsinline preload="${modal ? "none" : "metadata"}" ${atributoFonte}><p>Seu navegador não consegue reproduzir este vídeo.</p></video><p class="video-componente-erro" data-video-erro hidden>Não foi possível carregar o vídeo. Confira se ele foi enviado para a pasta arquivos do curso.</p></div>`;
}

function criarIdInstancia(numeroLicao, index, opcoes = {}) {
    sequenciaInstancias += 1;
    const contexto = String(opcoes.contexto || `${numeroLicao ?? 0}_${index ?? 0}`)
        .replace(/[^a-zA-Z0-9_-]/g, "-");
    return `video-${contexto}-${sequenciaInstancias}`;
}

function renderizarItens(itens, instancia) {
    const diretos = [];
    const modais = [];

    itens.forEach((item, indice) => {
        if (item.modo === "direto") {
            diretos.push(`<div class="video-componente-item" data-video-item="direto">${criarPlayer(item, `${instancia}-player-${indice + 1}`)}</div>`);
            return;
        }

        const modalId = `${instancia}-modal-${indice + 1}`;
        const player = criarPlayer(item, `${instancia}-player-${indice + 1}`, true);
        modais.push(`
            <button class="video-componente-botao" type="button" data-video-abrir="${modalId}" aria-controls="${modalId}" aria-expanded="false">${escaparHtml(item.rotulo)}</button>
            <div class="video-componente-modal" id="${modalId}" role="dialog" aria-modal="true" aria-label="${escaparHtml(item.rotulo)}" aria-hidden="true" hidden>
                <div class="video-componente-modal-conteudo">
                    <button class="video-componente-fechar" type="button" aria-label="Fechar vídeo">×</button>
                    ${player}
                </div>
            </div>`);
    });

    return { diretos: diretos.join("\n"), modais: modais.join("\n") };
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const itens = lerItensVideo(conteudo);
    const instancia = criarIdInstancia(numeroLicao, index, opcoes);
    const partes = renderizarItens(itens, instancia);
    const template = await carregarTemplate("video");
    return template
        .replace(/{{ID_INSTANCIA}}/g, () => escaparHtml(instancia))
        .replace(/{{PLAYERS_DIRETOS}}/g, () => partes.diretos)
        .replace(/{{BOTOES_E_MODAIS}}/g, () => partes.modais);
};

module.exports.normalizarYouTubeId = normalizarYouTubeId;
module.exports.lerItensVideo = lerItensVideo;
module.exports.normalizarFonteArquivo = normalizarFonteArquivo;
