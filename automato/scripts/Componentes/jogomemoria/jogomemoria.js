// JOGO DA MEMÓRIA
// Uma única <frente> define a capa comum. Cada trio <carta1>/<carta2>/<feedback>
// cria um par independente de cartas e de feedback.
const { carregarTemplate, decodeHTML } = require("../../Utils");
const { montarIdAudio } = require("../../ExtrairAudiosComponentes");

let sequenciaInstancias = 0;

function decodificar(valor) {
    let resultado = String(valor || "");
    for (let i = 0; i < 3; i++) {
        const anterior = resultado;
        resultado = decodeHTML(resultado);
        if (resultado === anterior) break;
    }
    return resultado;
}

function textoSimples(html) {
    return decodificar(String(html || "")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " "))
        .replace(/\s+/g, " ").trim();
}

function normalizarMarcadores(html) {
    const normalizado = String(html || "")
        .replace(/&lt;\s*(\/?\s*)(frente|carta1|carta2|feedback)\s*&gt;/gi, (_, barra, nome) => `<${barra}${nome.toLowerCase()}>`)
        .replace(/&#60;\s*(\/?\s*)(frente|carta1|carta2|feedback)\s*&#62;/gi, (_, barra, nome) => `<${barra}${nome.toLowerCase()}>`)
        .replace(/&#x3c;\s*(\/?\s*)(frente|carta1|carta2|feedback)\s*&#x3e;/gi, (_, barra, nome) => `<${barra}${nome.toLowerCase()}>`)
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(frente|carta1|carta2|feedback)>\s*(?:<\/strong>\s*)?<\/p>/gi, (_, nome) => `<${nome.toLowerCase()}>`)
        .replace(/<strong\b[^>]*>\s*<(frente|carta1|carta2|feedback)>\s*<\/strong>/gi, (_, nome) => `<${nome.toLowerCase()}>`)
        // Os marcadores são delimitadores: os fechamentos internos são opcionais.
        .replace(/<\/\s*(frente|carta1|carta2|feedback)\s*>/gi, "");
    return normalizado;
}

function temConteudo(html) {
    const origem = String(html || "");
    const semComentarios = origem.replace(/<!--[\s\S]*?-->/g, " ");
    const semTokens = semComentarios.replace(/__[A-Z][A-Z0-9_-]*__/gi, "TOKEN_COMPONENTE");
    const texto = textoSimples(semTokens);
    return Boolean(texto || /<(?:img|picture|svg|video|canvas|object|iframe|audio)\b/i.test(origem) || /TOKEN_COMPONENTE/.test(semTokens));
}

function criarId(numeroLicao, index, opcoes = {}) {
    sequenciaInstancias += 1;
    const contexto = String(opcoes.contexto || `${numeroLicao ?? 0}_${index ?? 0}`)
        .replace(/[^a-zA-Z0-9_-]/g, "-");
    return `jogomemoria-${contexto}-${sequenciaInstancias}`;
}

/**
 * Lê o roteiro no formato oficial:
 * <frente>[capa comum]<carta1>...<carta2>...<feedback>...
 * <carta1>...<carta2>...<feedback>...
 * A única <frente> vale para todas as cartas do jogo.
 */
function interpretarRoteiro(html) {
    const origem = normalizarMarcadores(html);
    const regex = /<(frente|carta1|carta2|feedback)\s*>/gi;
    const marcadores = [...origem.matchAll(regex)];

    if (!marcadores.length) {
        throw new Error("O Jogo da Memória precisa ter pelo menos um par: <carta1>, <carta2> e <feedback>. A tag <frente> é opcional.");
    }

    const primeiraTag = marcadores[0][1].toLowerCase();
    const temMarcadorFrente = primeiraTag === "frente";
    const conteudoAnterior = origem.slice(0, marcadores[0].index);
    let capa = "";
    let marcadoresDosPares = marcadores;

    // A tag <frente> é opcional. Quando ausente, a capa padrão será criada
    // pelo CSS. Quando presente, deve aparecer uma única vez no início.
    if (temMarcadorFrente) {
        const proximoMarcador = marcadores[1];
        const capaInicio = marcadores[0].index + marcadores[0][0].length;
        capa = origem.slice(capaInicio, proximoMarcador ? proximoMarcador.index : origem.length).trim();
        marcadoresDosPares = marcadores.slice(1);
    }

    const ordemEsperada = ["carta1", "carta2", "feedback"];
    const pares = [];
    let atual = null;
    let etapa = 0;

    function finalizarPar() {
        if (!atual) return;
        if (etapa !== ordemEsperada.length) {
            const falta = ordemEsperada[etapa] || "feedback";
            throw new Error(`O par ${pares.length + 1} está incompleto: falta o marcador <${falta}>.`);
        }
        if (!temConteudo(atual.carta1)) throw new Error(`A carta1 do par ${pares.length + 1} está vazia.`);
        if (!temConteudo(atual.carta2)) throw new Error(`A carta2 do par ${pares.length + 1} está vazia.`);
        if (!temConteudo(atual.feedback)) throw new Error(`O feedback do par ${pares.length + 1} está vazio.`);
        pares.push({ ...atual, id: String(pares.length + 1) });
        atual = null;
        etapa = 0;
    }

    for (let i = 0; i < marcadoresDosPares.length; i++) {
        const marcador = marcadoresDosPares[i];
        const tipo = marcador[1].toLowerCase();
        const inicio = marcador.index + marcador[0].length;
        const fim = marcadoresDosPares[i + 1]
            ? marcadoresDosPares[i + 1].index
            : origem.length;
        const trecho = origem.slice(inicio, fim).trim();

        const esperado = ordemEsperada[etapa];
        if (tipo !== esperado) {
            if (tipo === "frente") {
                throw new Error("O marcador <frente> é opcional, mas, quando utilizado, deve aparecer apenas uma vez no início do jogo.");
            }
            throw new Error(`No par ${pares.length + 1}, era esperado <${esperado}>, mas foi encontrado <${tipo}>.`);
        }

        if (tipo === "carta1") atual = { carta1: "", carta2: "", feedback: "" };
        atual[tipo] = trecho;
        etapa++;

        if (etapa === ordemEsperada.length) finalizarPar();
    }

    if (atual || etapa !== 0) finalizarPar();
    if (!pares.length) throw new Error("O Jogo da Memória precisa ter pelo menos um par (<carta1>, <carta2> e <feedback>).");

    return { conteudoAnterior, capa, pares, temMarcadorFrente };
}

function escaparAtributo(valor) {
    return String(valor || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("jogomemoria");
    const dados = interpretarRoteiro(conteudo);
    const idInstancia = criarId(numeroLicao, index, opcoes);
    const prefixoAudio = String(opcoes.prefixoAudio || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const tipoAudio = String(opcoes.tipoAudio || "jogomemoria").replace(/[^a-zA-Z0-9_-]/g, "");
    const caminhoAudio = prefixoAudio ? prefixoAudio.split("_").filter(Boolean) : [];

    const cartas = [];
    const feedbacks = [];
    const capaVazia = !temConteudo(dados.capa);
    const capaPossuiImagem = /<(?:img|picture|svg)\b/i.test(dados.capa);
    const capaComum = capaVazia
        ? '<span class="jogomemoria-capa-padrao" aria-hidden="true"><span>✦</span></span>'
        : `<span class="jogomemoria-capa-conteudo ${capaPossuiImagem ? "jogomemoria-capa-imagem" : "jogomemoria-capa-texto"}">${dados.capa}</span>`;

    dados.pares.forEach((par, indice) => {
        const audioFeedback = montarIdAudio(caminhoAudio, tipoAudio, indice);

        [
            { lado: "1", conteudo: par.carta1 },
            { lado: "2", conteudo: par.carta2 }
        ].forEach((carta, indiceCarta) => {
            const possuiImagem = /<(?:img|picture|svg)\b/i.test(carta.conteudo);
            const classeConteudo = possuiImagem ? "jogomemoria-face-imagem" : "jogomemoria-face-texto";
            cartas.push(`
                <div class="jogomemoria-carta" role="button" tabindex="0"
                    data-jogomemoria-par="${par.id}"
                    data-jogomemoria-lado="${carta.lado}"
                    aria-pressed="false"
                    aria-label="Carta ${indice * 2 + indiceCarta + 1}, virada para baixo">
                    <span class="jogomemoria-carta-interior">
                        <span class="jogomemoria-carta-capa ${capaVazia ? "jogomemoria-capa-vazia" : ""}">${capaComum}</span>
                        <span class="jogomemoria-carta-conteudo ${classeConteudo}">${carta.conteudo}</span>
                    </span>
                </div>`);
        });

        feedbacks.push(`
            <div class="jogomemoria-feedback-item" data-jogomemoria-feedback-item="${par.id}"
                data-audio-id="${escaparAtributo(audioFeedback)}" hidden>
                ${par.feedback}
            </div>`);
    });

    return template
        .replace(/{{ID_INSTANCIA}}/g, () => idInstancia)
        .replace(/{{CONTEUDO_ANTERIOR}}/g, () => dados.conteudoAnterior)
        .replace(/{{CARTAS}}/g, () => cartas.join("\n"))
        .replace(/{{FEEDBACKS}}/g, () => feedbacks.join("\n"));
};

module.exports.interpretarRoteiro = interpretarRoteiro;
module.exports.normalizarMarcadores = normalizarMarcadores;
