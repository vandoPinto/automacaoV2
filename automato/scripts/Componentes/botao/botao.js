// BOTAO.js
// Processa o componente BOTAO e permite HOTWORD dentro do texto, rótulos e janelas.
const { carregarTemplate } = require("../../Utils");
const hotword = require("../hotword/hotword");

function normalizarMarcadores(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?)\s*(botao|hotword|janela)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?)\s*(botao|hotword|janela)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?)\s*(botao|hotword|janela)\s*&#x3e;/gi, "<$1$2>")
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(botao|hotword|janela)>\s*(?:<\/strong>\s*)?<\/p>/gi, "<$1>")
        .replace(/<strong\b[^>]*>\s*<(botao|hotword|janela)>\s*<\/strong>/gi, "<$1>");
}

function textoVisivel(html) {
    return String(html || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
}

function temConteudo(html) {
    return Boolean(textoVisivel(html) || /<(?:img|picture|svg|video|canvas|object|iframe)\b/i.test(String(html || "")));
}

function criarId(numeroLicao, index) {
    const licao = String(numeroLicao ?? "0").replace(/[^a-zA-Z0-9_-]/g, "");
    const tela = String(index ?? "0").replace(/[^a-zA-Z0-9_-]/g, "");
    return `botao-componente-${licao}-${tela}`;
}

/**
 * Identifica marcadores do BOTAO sem confundir a <janela> que pertence
 * a uma HOTWORD. A HOTWORD é processada depois, dentro do trecho completo
 * onde aparece, para que a palavra seja destacada inline como no componente
 * HOTWORD original (e não transformada em um botão independente).
 */
function obterMarcadoresDoBotao(html) {
    const todos = [...html.matchAll(/<(botao|hotword|janela)\s*>/gi)];
    const marcadoresPai = [];

    for (let i = 0; i < todos.length; i++) {
        const atual = todos[i];
        const tipo = atual[1].toLowerCase();

        if (tipo === "hotword") {
            // A primeira <janela> seguinte pertence à HOTWORD e não ao BOTAO.
            const janelaHotword = todos.slice(i + 1).find(m => m[1].toLowerCase() === "janela");
            if (janelaHotword) {
                const indiceJanela = todos.indexOf(janelaHotword);
                // Marca o par HOTWORD + sua janela como conteúdo interno.
                atual._ignorar = true;
                janelaHotword._ignorar = true;
                // Não pula os marcadores intermediários: se houver outro marcador
                // de componente antes da janela, ele continuará sendo analisado.
            }
            continue;
        }

        if (tipo === "janela" && atual._ignorar) continue;
        if (tipo === "botao" || tipo === "janela") marcadoresPai.push(atual);
    }

    return marcadoresPai;
}

async function processarHotwordNoTrecho(trecho, numeroLicao, index, identificador) {
    if (!/<hotword\s*>/i.test(trecho)) return trecho;
    return await hotword(trecho, numeroLicao, `${index}-hotword-${identificador}`);
}

module.exports = async function (conteudo, numeroLicao, index) {
    const template = await carregarTemplate("botao");
    const html = normalizarMarcadores(conteudo);
    const marcadores = obterMarcadoresDoBotao(html);

    let introducao = html;
    const rotulos = [];
    const explicacoes = [];

    if (marcadores.length) {
        introducao = html.slice(0, marcadores[0].index).trim();

        for (let i = 0; i < marcadores.length; i++) {
            const marcador = marcadores[i];
            const inicio = marcador.index + marcador[0].length;
            const proximo = marcadores[i + 1];
            const fim = proximo ? proximo.index : html.length;
            const trecho = html.slice(inicio, fim).trim();

            if (marcador[1].toLowerCase() === "botao") {
                if (temConteudo(trecho)) rotulos.push(trecho);
                else console.warn("BOTAO: foi encontrado um botão sem rótulo.");
            } else if (marcador[1].toLowerCase() === "janela") {
                if (temConteudo(trecho)) explicacoes.push(trecho);
                else console.warn("BOTAO: foi encontrada uma janela sem conteúdo.");
            }
        }
    }

    // Processa HOTWORD no contexto de cada bloco, mantendo a palavra destacada
    // dentro do próprio texto original. A mesma regra vale para janelas do BOTAO.
    introducao = await processarHotwordNoTrecho(introducao, numeroLicao, index, "introducao");

    const rotulosProcessados = await Promise.all(rotulos.map((trecho, i) =>
        processarHotwordNoTrecho(trecho, numeroLicao, index, `rotulo-${i + 1}`)
    ));
    const explicacoesProcessadas = await Promise.all(explicacoes.map((trecho, i) =>
        processarHotwordNoTrecho(trecho, numeroLicao, index, `janela-${i + 1}`)
    ));

    const quantidade = Math.min(rotulosProcessados.length, explicacoesProcessadas.length);
    if (rotulosProcessados.length !== explicacoesProcessadas.length) {
        console.warn(
            `BOTAO: quantidade diferente de marcadores: ${rotulosProcessados.length} botão(ões) e ${explicacoesProcessadas.length} janela(s). ` +
            `Serão gerados ${quantidade} par(es).`
        );
    }

    const itens = Array.from({ length: quantidade }, (_, indice) => ({
        rotulo: rotulosProcessados[indice],
        explicacao: explicacoesProcessadas[indice]
    }));

    const idComponente = criarId(numeroLicao, index);

    const botoesHTML = itens.map((item, indice) => {
        const idJanela = `${idComponente}-janela-${indice + 1}`;
        const classeImagem = /<(?:img|picture|svg)\b/i.test(item.rotulo)
            ? " botao-item-com-imagem"
            : "";

        return `
            <button class="botao-item${classeImagem}" type="button"
                data-botao-alvo="${idJanela}"
                aria-controls="${idJanela}"
                aria-expanded="false">
                ${item.rotulo}
            </button>`;
    }).join("\n");

    const janelasHTML = itens.map((item, indice) => {
        const idJanela = `${idComponente}-janela-${indice + 1}`;
        return `
            <div class="botao-janela" id="${idJanela}" data-botao-janela="${idJanela}"
                role="dialog" aria-modal="true" aria-hidden="true" hidden>
                <div class="botao-janela-conteudo">
                    <button class="botao-fechar" type="button" aria-label="Fechar janela">×</button>
                    <div class="botao-janela-texto">${item.explicacao}</div>
                </div>
            </div>`;
    }).join("\n");

    return template
        .replace(/{{ID_COMPONENTE}}/g, () => idComponente)
        .replace(/{{INTRODUCAO}}/g, () => introducao)
        .replace(/{{BOTOES}}/g, () => botoesHTML)
        .replace(/{{JANELAS}}/g, () => janelasHTML);
};
