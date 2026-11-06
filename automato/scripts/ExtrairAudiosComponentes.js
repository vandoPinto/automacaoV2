const COMPONENTES = {
    botoes: { marcadores: ["botao", "janela"], janelas: ["janela"], limites: ["botao", "janela"] },
    abas: { marcadores: ["aba", "janela"], janelas: ["janela"], limites: ["janela"] },
    mininavegacao: { marcadores: ["janela"], janelas: ["janela"], limites: ["janela"] },
    sanfona: { marcadores: ["botao", "janela"], janelas: ["janela"], limites: ["botao", "janela"] },
    hotword: { marcadores: ["hotword", "janela"], janelas: ["janela"], limites: ["hotword", "janela"] },
    flashcard: { marcadores: ["frente", "verso"], janelas: ["verso"], limites: ["frente", "verso"] }
};

const TAG_COMPONENTE = Object.keys(COMPONENTES).sort((a, b) => b.length - a.length).join("|");

function normalizarWrappers(html) {
    let valor = String(html || "")
        .replace(/&lt;\s*(\/?)\s*componente\b([\s\S]*?)&gt;/gi, (_, barra, atributos) =>
            `<${barra}componente${atributos.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")}>`
        )
        .replace(/&#60;\s*(\/?)\s*componente\b([\s\S]*?)&#62;/gi, (_, barra, atributos) =>
            `<${barra}componente${atributos.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")}>`
        )
        .replace(/&#x3c;\s*(\/?)\s*componente\b([\s\S]*?)&#x3e;/gi, (_, barra, atributos) =>
            `<${barra}componente${atributos.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")}>`
        );

    const pilha = [];
    const aliases = { botao: "botoes" };
    return valor.replace(/<\/?componente\b[^>]*>/gi, tag => {
        if (/^<\//.test(tag)) {
            const tipo = pilha.pop();
            return tipo ? `</${tipo}>` : tag;
        }

        const atributo = tag.match(/\btipo\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
        const tipoOriginal = atributo && (atributo[1] || atributo[2] || atributo[3] || "").toLowerCase();
        const tipo = aliases[tipoOriginal] || tipoOriginal;
        const reconhecido = Boolean(tipo && COMPONENTES[tipo]);
        pilha.push(reconhecido ? tipo : null);
        return reconhecido ? `<${tipo}>` : tag;
    });
}

function normalizarMarcadores(html) {
    let valor = normalizarWrappers(String(html || ""));
    valor = valor.replace(/&lt;\s*(\/?)\s*(botoes|abas|mininavegacao|sanfona|flashcard|hotword)\s*&gt;/gi, "<$1$2>");
    valor = valor.replace(/&#60;\s*(\/?)\s*(botoes|abas|mininavegacao|sanfona|flashcard|hotword)\s*&#62;/gi, "<$1$2>");
    valor = valor.replace(/&#x3c;\s*(\/?)\s*(botoes|abas|mininavegacao|sanfona|flashcard|hotword)\s*&#x3e;/gi, "<$1$2>");
    valor = valor.replace(/&lt;\s*(\/?)\s*(botao|aba|janela|frente|verso|hotword)\s*&gt;/gi, "<$1$2>");
    valor = valor.replace(/&#60;\s*(\/?)\s*(botao|aba|janela|frente|verso|hotword)\s*&#62;/gi, "<$1$2>");
    valor = valor.replace(/&#x3c;\s*(\/?)\s*(botao|aba|janela|frente|verso|hotword)\s*&#x3e;/gi, "<$1$2>");
    return valor.replace(
        /<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(\/?)\s*(botoes|abas|mininavegacao|sanfona|flashcard|hotword|botao|aba|janela|frente|verso)\s*>\s*(?:<\/strong>\s*)?<\/p>/gi,
        "<$1$2>"
    );
}

function letra(indice) {
    let n = indice + 1;
    let saida = "";
    while (n > 0) {
        n--;
        saida = String.fromCharCode(97 + (n % 26)) + saida;
        n = Math.floor(n / 26);
    }
    return saida;
}

/** Identificador único compartilhado entre o JSON e as janelas HTML. */
function montarIdAudio(caminho, tipo, indiceJanela, face = "") {
    const segmentos = [...caminho, tipo, letra(indiceJanela)];
    if (face) segmentos.push(face);
    return segmentos.join("_");
}

function localizarBlocos(html) {
    const origem = String(html || "");
    const regexAbertura = new RegExp(`<(${TAG_COMPONENTE})\\s*>`, "gi");
    const blocos = [];
    let match;
    while ((match = regexAbertura.exec(origem)) !== null) {
        const tipo = match[1].toLowerCase();
        const regexMarcadores = new RegExp(`<\\/?${tipo}\\s*>`, "gi");
        regexMarcadores.lastIndex = regexAbertura.lastIndex;
        let profundidade = 1;
        let marcador;
        let fim = origem.length;
        let possuiFechamento = false;
        while ((marcador = regexMarcadores.exec(origem)) !== null) {
            if (marcador[0].startsWith("</")) profundidade--;
            else profundidade++;
            if (profundidade === 0) {
                fim = regexMarcadores.lastIndex;
                possuiFechamento = true;
                break;
            }
        }
        blocos.push({
            tipo,
            inicio: match.index,
            inicioConteudo: regexAbertura.lastIndex,
            fim,
            fimConteudo: possuiFechamento ? marcador.index : fim,
            possuiFechamento
        });
        regexAbertura.lastIndex = fim;
    }
    return blocos;
}

function localizarMarcadoresDiretos(conteudo, tipo) {
    const blocosFilhos = localizarBlocos(conteudo);
    const regex = new RegExp(`<(${COMPONENTES[tipo].marcadores.join("|")})\\s*>`, "gi");
    const marcadores = [];
    let match;
    while ((match = regex.exec(conteudo)) !== null) {
        const dentroDeFilho = blocosFilhos.some(b => match.index >= b.inicio && match.index < b.fim);
        if (!dentroDeFilho) {
            marcadores.push({
                tipo: match[1].toLowerCase(),
                inicio: match.index,
                fimAbertura: regex.lastIndex
            });
        }
    }
    return { marcadores, blocosFilhos };
}

function extrairJanelas(conteudo, tipo) {
    const { marcadores, blocosFilhos } = localizarMarcadoresDiretos(conteudo, tipo);
    const configuracao = COMPONENTES[tipo];
    const janelas = [];
    let indiceCartao = -1;

    for (let i = 0; i < marcadores.length; i++) {
        const marcador = marcadores[i];
        if (tipo === "flashcard" && marcador.tipo === "frente") {
            indiceCartao++;
        }
        if (!configuracao.janelas.includes(marcador.tipo)) continue;

        let fim = conteudo.length;
        for (let j = i + 1; j < marcadores.length; j++) {
            if (configuracao.limites.includes(marcadores[j].tipo)) {
                fim = marcadores[j].inicio;
                break;
            }
        }

        // O fechamento explícito do componente é o limite real da última janela.
        janelas.push({
            tipo: marcador.tipo,
            indice: tipo === "flashcard" ? Math.max(0, indiceCartao) : janelas.length,
            inicio: marcador.fimAbertura,
            fim,
            conteudo: conteudo.slice(marcador.fimAbertura, fim)
        });
    }

    return { janelas, blocosFilhos, marcadores };
}

/**
 * Resolve o prefixo hierárquico da janela-pai que contém um componente filho.
 * Usa a mesma extração de janelas e a mesma conversão de índices do gerador JSON.
 */
function resolverPrefixoAudioJanela(conteudoPai, tipoPai, posicaoFilho, caminhoPai = []) {
    const tipo = String(tipoPai || "").toLowerCase();
    if (!COMPONENTES[tipo]) return "";

    let origem = normalizarMarcadores(String(conteudoPai || ""));
    let posicao = Number(posicaoFilho) || 0;

    // O processador legado pode encaminhar o próprio marcador de abertura
    // junto com o conteúdo. O gerador recursivo trabalha com o conteúdo interno.
    const aberturaRaiz = new RegExp(`^\\s*<${tipo}\\s*>`, "i").exec(origem);
    if (aberturaRaiz) {
        origem = origem.slice(aberturaRaiz[0].length);
        posicao -= aberturaRaiz[0].length;
    }

    const { janelas } = extrairJanelas(origem, tipo);
    const indice = janelas.findIndex(janela =>
        posicao >= janela.inicio && posicao < janela.fim
    );

    if (indice < 0) return "";
    return montarIdAudio(caminhoPai, tipo, janelas[indice].indice);
}

function inserirSubstituicoes(origem, substituicoes) {
    let resultado = origem;
    for (const item of [...substituicoes].sort((a, b) => b.inicio - a.inicio)) {
        resultado = resultado.slice(0, item.inicio) + item.valor + resultado.slice(item.fim);
    }
    return resultado;
}

/**
 * Remove os rótulos dos botões internos do texto narrado pela janela de ABAS.
 * O conteúdo das janelas desses botões continua sendo extraído recursivamente
 * e recebe seu próprio áudio hierárquico.
 */
function removerRotulosBotoesInternos(html) {
    return String(html || "").replace(
        /<botao\b[^>]*>[\s\S]*?(?=<janela\b)/gi,
        ""
    );
}

/**
 * Percorre componentes e janelas recursivamente.
 * Os segmentos do caminho identificam componente + posição da janela.
 * Componentes repetidos no mesmo nível recebem um ordinal para evitar colisões.
 */
function processarRegiao(html, caminho = []) {
    const origem = String(html || "");
    const blocos = localizarBlocos(origem);
    if (!blocos.length) return { textoLimpo: origem, audios: [] };

    const audios = [];
    const substituicoes = [];
    const ocorrencias = {};

    for (const bloco of blocos) {
        const ordinal = (ocorrencias[bloco.tipo] || 0) + 1;
        ocorrencias[bloco.tipo] = ordinal;
        const segmentoComponente = bloco.tipo + (ordinal > 1 ? ordinal : "");
        const caminhoComponente = [...caminho, segmentoComponente];
        const conteudoComponente = origem.slice(bloco.inicioConteudo, bloco.fimConteudo);
        const { janelas, marcadores } = extrairJanelas(conteudoComponente, bloco.tipo);
        const substituicoesJanelas = [];
        const audiosComponente = [];

        janelas.forEach((janela, indice) => {
            const indiceJanela = janela.indice ?? indice;
            const resultadoFilho = processarRegiao(janela.conteudo, [
                ...caminhoComponente,
                letra(indiceJanela)
            ]);
            const textoJanela = bloco.tipo === "abas"
                ? removerRotulosBotoesInternos(resultadoFilho.textoLimpo)
                : resultadoFilho.textoLimpo;

            if (textoJanela) {
                audiosComponente.push({
                    nomeSufixo: montarIdAudio(caminho, segmentoComponente, indiceJanela,
                        bloco.tipo === "flashcard" ? janela.tipo : ""),
                    texto: textoJanela
                });
            }
            audiosComponente.push(...resultadoFilho.audios);

            substituicoesJanelas.push({
                inicio: janela.inicio,
                fim: janela.fim,
                valor: ""
            });
        });

        // Rótulos de <aba> são controles visuais, não conteúdo narrável.
        // As janelas já foram extraídas acima; removemos também os rótulos
        // para que não vazem para o áudio principal da tela.
        const substituicoesEstruturais = [...substituicoesJanelas];

        if (bloco.tipo === "abas") {
            for (let i = 0; i < marcadores.length; i++) {
                const marcador = marcadores[i];
                if (marcador.tipo !== "aba") continue;
                const proximo = marcadores[i + 1];
                substituicoesEstruturais.push({
                    inicio: marcador.inicio,
                    fim: proximo ? proximo.inicio : conteudoComponente.length,
                    valor: ""
                });
            }
        }

        // A frente do FLASHCARD é visual. Somente o conteúdo de <verso>
        // deve gerar narração; a frente é removida inclusive do áudio principal.
        if (bloco.tipo === "flashcard") {
            for (let i = 0; i < marcadores.length; i++) {
                const marcador = marcadores[i];
                if (marcador.tipo !== "frente") continue;
                const proximo = marcadores[i + 1];
                substituicoesEstruturais.push({
                    inicio: marcador.inicio,
                    fim: proximo ? proximo.inicio : conteudoComponente.length,
                    valor: ""
                });
            }
        }

        const conteudoSemJanelas = inserirSubstituicoes(
            conteudoComponente,
            substituicoesEstruturais
        );
        const blocoLimpo = origem.slice(bloco.inicio, bloco.inicioConteudo) +
            conteudoSemJanelas +
            (bloco.possuiFechamento ? `</${bloco.tipo}>` : "");

        substituicoes.push({
            inicio: bloco.inicio,
            fim: bloco.fim,
            valor: blocoLimpo
        });
        audios.push(...audiosComponente);
    }

    return {
        textoLimpo: inserirSubstituicoes(origem, substituicoes),
        audios
    };
}

module.exports = {
    processarRegiao,
    localizarBlocos,
    letra,
    montarIdAudio,
    resolverPrefixoAudioJanela,
    normalizarMarcadores,
    normalizarWrappers
};
