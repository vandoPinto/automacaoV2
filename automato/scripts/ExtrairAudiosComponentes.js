const COMPONENTES = {
    botoes: { marcadores: ["botao", "janela"], janelas: ["janela"], limites: ["botao", "janela"] },
    abas: { marcadores: ["aba", "janela"], janelas: ["janela"], limites: ["janela"] },
    mininavegacao: { marcadores: ["janela"], janelas: ["janela"], limites: ["janela"] },
    sanfona: { marcadores: ["botao", "janela"], janelas: ["janela"], limites: ["botao", "janela"] },
    hotword: { marcadores: ["hotword", "janela"], janelas: ["janela"], limites: ["hotword", "janela"] },
    flashcard: { marcadores: ["frente", "verso"], janelas: ["verso"], limites: ["frente", "verso"] },
    ligapontos: {
        marcadores: ["opcao", "resposta", "feedcerto", "feederrado"],
        janelas: ["feedcerto", "feederrado"],
        limites: ["opcao", "resposta", "feedcerto", "feederrado"]
    }
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
        const tagNormalizada = reconhecido && tipo === "hotword" ? "componente-hotword" : tipo;
        pilha.push(reconhecido ? tagNormalizada : null);
        return reconhecido ? `<${tagNormalizada}>` : tag;
    });
}

function normalizarMarcadores(html) {
    let valor = normalizarWrappers(String(html || ""));
    valor = valor.replace(/&lt;\s*(\/?)\s*(botoes|abas|mininavegacao|sanfona|flashcard|hotword|ligapontos)\s*&gt;/gi, "<$1$2>");
    valor = valor.replace(/&#60;\s*(\/?)\s*(botoes|abas|mininavegacao|sanfona|flashcard|hotword|ligapontos)\s*&#62;/gi, "<$1$2>");
    valor = valor.replace(/&#x3c;\s*(\/?)\s*(botoes|abas|mininavegacao|sanfona|flashcard|hotword|ligapontos)\s*&#x3e;/gi, "<$1$2>");
    valor = valor.replace(/&lt;\s*(\/?)\s*(botao|aba|janela|frente|verso|hotword|opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado)\s*&gt;/gi, "<$1$2>");
    valor = valor.replace(/&#60;\s*(\/?)\s*(botao|aba|janela|frente|verso|hotword|opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado)\s*&#62;/gi, "<$1$2>");
    valor = valor.replace(/&#x3c;\s*(\/?)\s*(botao|aba|janela|frente|verso|hotword|opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado)\s*&#x3e;/gi, "<$1$2>");
    valor = valor.replace(/<\/\s*feedbackcerto\s*>/gi, "</feedcerto>")
        .replace(/<\/\s*(?:feedErrao|feedbackerrado)\s*>/gi, "</feederrado>")
        .replace(/<\s*feedbackcerto\s*>/gi, "<feedcerto>")
        .replace(/<\s*(?:feedErrao|feedbackerrado)\s*>/gi, "<feederrado>");
    return valor.replace(
        /<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(\/?)\s*(botoes|abas|mininavegacao|sanfona|flashcard|hotword|botao|aba|janela|frente|verso|ligapontos|opcao|resposta|feedcerto|feederrado)\s*>\s*(?:<\/strong>\s*)?<\/p>/gi,
        "<$1$2>"
    ).replace(/<\/\s*(opcao|resposta)\s*>/gi, "");
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
    // O wrapper universal de HOTWORD usa uma tag auxiliar para não colidir
    // com o marcador legado <hotword>. Ele também precisa ser reconhecido como
    // bloco-filho para que suas <janela> internas não sejam contadas pelo pai.
    const wrappersHotword = localizarWrappersHotword(origem);

    // Tudo o que estiver dentro do wrapper universal HOTWORD pertence ao seu
    // conteúdo de janela. Não pode ser tratado como irmão na região externa:
    // será extraído recursivamente quando a janela for percorrida.
    for (let i = blocos.length - 1; i >= 0; i--) {
        if (wrappersHotword.some(wrapper =>
            blocos[i].inicio > wrapper.inicio && blocos[i].inicio < wrapper.fim
        )) {
            blocos.splice(i, 1);
        }
    }

    for (const wrapper of wrappersHotword) {
        const estaDentroDeBlocoLegado = blocos.some(bloco =>
            wrapper.inicio > bloco.inicio && wrapper.inicio < bloco.fim
        );
        if (!estaDentroDeBlocoLegado) blocos.push(wrapper);
    }

    return blocos.sort((a, b) => a.inicio - b.inicio);
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
            indice: tipo === "flashcard"
                ? Math.max(0, indiceCartao)
                : tipo === "ligapontos"
                    ? (marcador.tipo === "feedcerto" ? 0 : 1)
                    : janelas.length,
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
function resolverPrefixoAudioJanela(conteudoPai, tipoPai, posicaoFilho, caminhoPai = [], tipoAudioPai = "") {
    // O processador visual usa "botao" como nome do componente, enquanto a
    // hierarquia de áudio e os marcadores do roteiro usam "botoes". Resolve
    // aliases aqui, na fronteira central, para que qualquer filho receba o
    // mesmo caminho independentemente do nome usado pelo processador pai.
    const aliasesAudio = { botao: "botoes" };
    const tipoInformado = String(tipoPai || "").toLowerCase();
    const tipo = aliasesAudio[tipoInformado] || tipoInformado;
    if (!COMPONENTES[tipo]) return "";

    const origemOriginal = String(conteudoPai || "");
    const posicaoOriginal = Math.max(0, Number(posicaoFilho) || 0);
    let origem = normalizarMarcadores(origemOriginal);
    // normalizarMarcadores pode remover parágrafos que contêm marcadores
    // isolados e transformar wrappers universais em tags de componente. Como
    // a posição do filho veio do texto original, convertemos o prefixo até ela
    // separadamente para manter a posição alinhada com a origem normalizada.
    let posicao = normalizarMarcadores(origemOriginal.slice(0, posicaoOriginal)).length;

    // O processador legado pode encaminhar o próprio marcador de abertura
    // junto com o conteúdo. O gerador recursivo trabalha com o conteúdo interno.
    const aberturaRaiz = new RegExp(`^\\s*<${tipo}\\s*>`, "i").exec(origem);
    if (aberturaRaiz) {
        origem = origem.slice(aberturaRaiz[0].length);
        posicao -= aberturaRaiz[0].length;
    }

    if (tipo === "hotword") {
        const regexHotword = /<\/?hotword\s*>|<janela\s*>/gi;
        let profundidade = 0;
        let janelaAtual = null;
        let indiceJanela = 0;
        let match;
        while ((match = regexHotword.exec(origem)) !== null) {
            const token = match[0];
            if (token.startsWith("</")) {
                if (profundidade > 0) profundidade--;
                if (profundidade === 0) {
                    if (janelaAtual && posicao >= janelaAtual.inicio && posicao < match.index) {
                        return montarIdAudio(caminhoPai, tipoAudioPai || tipo, indiceJanela);
                    }
                    janelaAtual = null;
                    indiceJanela++;
                }
            } else if (/^<janela/i.test(token)) {
                if (profundidade === 1 && !janelaAtual) janelaAtual = { inicio: regexHotword.lastIndex };
            } else {
                profundidade++;
                if (profundidade === 1) janelaAtual = null;
            }
        }
        if (janelaAtual && posicao >= janelaAtual.inicio) {
            return montarIdAudio(caminhoPai, tipoAudioPai || tipo, indiceJanela);
        }
    }

    const { janelas, marcadores } = extrairJanelas(origem, tipo);
    const indice = janelas.findIndex(janela =>
        posicao >= janela.inicio && posicao < janela.fim
    );

    if (indice >= 0) {
        // O nome do segmento pode conter o ordinal da instância irmã (por exemplo,
        // botoes2, flashcard3 ou ligapontos2). A extração estrutural continua usando
        // o tipo-base, mas o ID preserva o segmento da instância atual.
        return montarIdAudio(caminhoPai, tipoAudioPai || tipo, janelas[indice].indice);
    }

    // Opções e respostas não geram narração própria. Mesmo assim, componentes
    // interativos dentro desses blocos precisam receber um caminho estável e
    // exclusivo, para que seus próprios áudios continuem funcionando.
    if (tipo === "ligapontos") {
        const marcadoresPares = marcadores.filter(marcador =>
            marcador.tipo === "opcao" || marcador.tipo === "resposta"
        );
        const ocorrencias = { opcao: 0, resposta: 0 };
        for (let i = 0; i < marcadoresPares.length; i++) {
            const marcador = marcadoresPares[i];
            const fim = marcadoresPares[i + 1]
                ? marcadoresPares[i + 1].inicio
                : origem.length;
            if (posicao >= marcador.fimAbertura && posicao < fim) {
                const indicePar = ocorrencias[marcador.tipo]++;
                return montarIdAudio(
                    caminhoPai,
                    tipoAudioPai || tipo,
                    indicePar,
                    marcador.tipo
                );
            }
            ocorrencias[marcador.tipo]++;
        }
    }

    // Conteúdo anterior aos primeiros marcadores de BOTÕES/FLASHCARD não
    // pertence ao componente. Filhos encontrados antes do primeiro marcador
    // permanecem no caminho do pai, sem receber um segmento artificial.
    if (["botoes", "flashcard"].includes(tipo)) {
        const primeiroMarcador = marcadores.find(marcador =>
            tipo === "botoes" ? marcador.tipo === "botao" : marcador.tipo === "frente"
        );
        const fimConteudoExterno = primeiroMarcador ? primeiroMarcador.inicio : origem.length;
        if (posicao < fimConteudoExterno) {
            return caminhoPai.filter(Boolean).join("_");
        }
    }

    // Na HOTWORD, o texto anterior ao marcador é o contexto usado para
    // localizar a expressão que será destacada. Ele continua pertencendo à HOTWORD.
    if (tipo === "hotword") {
        const primeiroMarcador = marcadores.find(marcador => marcador.tipo === "hotword");
        const fimTextoGatilho = primeiroMarcador ? primeiroMarcador.inicio : origem.length;
        if (posicao < fimTextoGatilho) {
            return [...caminhoPai, tipoAudioPai || tipo].filter(Boolean).join("_");
        }
    }

    // As duas faces do FLASHCARD pertencem ao mesmo cartão. Somente o VERSO
    // produz a narração própria do cartão, mas componentes interativos dentro
    // da FRENTE também precisam herdar o caminho daquele cartão para gerar seus
    // próprios IDs de áudio. Assim, a face visual não vira áudio por si só.
    if (tipo === "flashcard") {
        let indiceCartao = -1;
        for (let i = 0; i < marcadores.length; i++) {
            const marcador = marcadores[i];
            if (marcador.tipo === "frente") indiceCartao++;
            if (marcador.tipo !== "frente") continue;

            const proximo = marcadores[i + 1];
            const fim = proximo ? proximo.inicio : origem.length;
            if (posicao >= marcador.fimAbertura && posicao < fim) {
                return montarIdAudio(
                    caminhoPai,
                    tipoAudioPai || tipo,
                    Math.max(0, indiceCartao)
                );
            }
        }
    }

    return "";
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

function localizarWrappersHotword(html) {
    const origem = String(html || "");
    const regex = /<\/?componente-hotword\s*>/gi;
    const pilha = [];
    const blocos = [];
    let match;

    while ((match = regex.exec(origem)) !== null) {
        if (match[0].startsWith("</")) {
            const abertura = pilha.pop();
            if (!abertura) continue;
            blocos.push({
                tipo: "hotword",
                tagNome: "componente-hotword",
                wrapperHotword: true,
                inicio: abertura.index,
                inicioConteudo: abertura.fimAbertura,
                fimConteudo: match.index,
                fim: regex.lastIndex,
                possuiFechamento: true
            });
        } else {
            pilha.push({ index: match.index, fimAbertura: regex.lastIndex });
        }
    }

    // Wrappers malformados não devem criar blocos fictícios; a validação do
    // processador central emitirá o diagnóstico correspondente.
    return blocos.sort((a, b) => a.inicio - b.inicio);
}

/**
 * Interpreta os marcadores HOTWORD internos a um wrapper universal.
 * Nesse caso, <hotword> é o marcador do gatilho, não um segundo componente.
 * A janela termina no fechamento explícito da própria HOTWORD. Componentes
 * encontrados dentro da explicação serão processados recursivamente depois.
 */
function extrairJanelasHotwordWrapper(conteudo) {
    const origem = String(conteudo || "");
    const regex = /<\/?(hotword|janela)\s*>/gi;
    const tokens = [...origem.matchAll(regex)].map(match => ({
        nome: match[1].toLowerCase(),
        fechamento: match[0].startsWith("</"),
        inicio: match.index,
        fim: match.index + match[0].length
    }));
    const marcadores = [];
    const janelas = [];
    let indiceJanela = 0;
    let cursorToken = 0;

    function encontrarFechamentoBalanceado(posicaoInicial, tipo) {
        let profundidade = 1;
        for (let i = posicaoInicial + 1; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.nome !== tipo) continue;
            if (token.fechamento) profundidade--;
            else profundidade++;
            if (profundidade === 0) return i;
        }
        return -1;
    }

    for (let i = 0; i < tokens.length; i++) {
        if (i < cursorToken) continue;
        const aberturaHotword = tokens[i];
        if (aberturaHotword.nome !== "hotword" || aberturaHotword.fechamento) continue;

        let indiceAberturaJanela = -1;
        for (let j = i + 1; j < tokens.length; j++) {
            if (tokens[j].nome === "janela" && !tokens[j].fechamento) {
                indiceAberturaJanela = j;
                break;
            }
            if (tokens[j].nome === "hotword" && !tokens[j].fechamento) break;
        }
        if (indiceAberturaJanela < 0) continue;

        const fechamentoHotwordAntesDaJanela = tokens.findIndex((token, indice) =>
            indice > i && indice < indiceAberturaJanela &&
            token.nome === "hotword" && token.fechamento
        );
        const fechamentoJanelaAntesDoHotword = tokens.findIndex((token, indice) =>
            indice > indiceAberturaJanela && token.nome === "janela" && token.fechamento
        );

        let indiceFechamento;
        let fimJanela;
        if (fechamentoHotwordAntesDaJanela >= 0) {
            // Forma legada: <hotword>termo</hotword><janela>explicação</janela>
            // A janela pode não ter fechamento explícito; nesse caso ocupa o
            // restante do escopo recebido.
            indiceFechamento = encontrarFechamentoBalanceado(indiceAberturaJanela, "janela");
            fimJanela = indiceFechamento >= 0 ? tokens[indiceFechamento].inicio : origem.length;
        } else {
            // Forma AIM: <hotword>termo<janela>explicação</hotword>
            indiceFechamento = encontrarFechamentoBalanceado(i, "hotword");
            fimJanela = indiceFechamento >= 0 ? tokens[indiceFechamento].inicio : origem.length;
        }

        marcadores.push({
            tipo: "hotword",
            inicio: aberturaHotword.inicio,
            fimAbertura: aberturaHotword.fim
        });
        marcadores.push({
            tipo: "janela",
            inicio: tokens[indiceAberturaJanela].inicio,
            fimAbertura: tokens[indiceAberturaJanela].fim
        });
        janelas.push({
            tipo: "janela",
            indice: indiceJanela,
            inicio: tokens[indiceAberturaJanela].fim,
            fim: fimJanela,
            conteudo: origem.slice(tokens[indiceAberturaJanela].fim, fimJanela)
        });
        indiceJanela++;

        // Não reinterpreta como irmãs as HOTWORDs que estão dentro da janela;
        // elas serão encontradas pela chamada recursiva em seu próprio conteúdo.
        if (indiceFechamento >= 0) cursorToken = indiceFechamento + 1;
        else cursorToken = tokens.length;
    }

    return { janelas, marcadores };
}

/**
 * Percorre componentes e janelas recursivamente.
 * Os segmentos do caminho identificam componente + posição da janela.
 * Componentes repetidos no mesmo nível recebem um ordinal para evitar colisões.
 */
function processarRegiao(html, caminho = [], estado = null) {
    // Compartilha os ordinais entre recursões que pertençam ao mesmo caminho.
    // Isso é necessário, por exemplo, quando um mesmo tipo de componente aparece
    // na FRENTE e no VERSO do mesmo cartão: ambos são filhos de flashcard_a.
    const contextoProcessamento = estado || { ocorrenciasPorCaminhoETipo: new Map() };
    const origem = String(html || "");
    const blocos = localizarBlocos(origem);
    if (!blocos.length) return { textoLimpo: origem, audios: [] };

    const audios = [];
    const substituicoes = [];

    for (const bloco of blocos) {
        const chaveOcorrencia = `${caminho.join("_")}\u0000${bloco.tipo}`;
        const ordinal = (contextoProcessamento.ocorrenciasPorCaminhoETipo.get(chaveOcorrencia) || 0) + 1;
        contextoProcessamento.ocorrenciasPorCaminhoETipo.set(chaveOcorrencia, ordinal);
        const segmentoComponente = bloco.tipo + (ordinal > 1 ? ordinal : "");
        const caminhoComponente = [...caminho, segmentoComponente];
        const conteudoComponente = origem.slice(bloco.inicioConteudo, bloco.fimConteudo);
        const { janelas, marcadores } = bloco.wrapperHotword
            ? extrairJanelasHotwordWrapper(conteudoComponente)
            : extrairJanelas(conteudoComponente, bloco.tipo);
        const substituicoesJanelas = [];
        const audiosComponente = [];

        // O conteúdo antes dos marcadores de BOTÕES/FLASHCARD permanece no
        // fluxo do pai. Na HOTWORD, o texto anterior é o contexto de busca do
        // gatilho e continua pertencendo ao próprio componente.
        if (["botoes", "flashcard", "hotword", "ligapontos"].includes(bloco.tipo) && marcadores.length) {
            const conteudoAnterior = conteudoComponente.slice(0, marcadores[0].inicio);
            const caminhoAnterior = bloco.tipo === "hotword" ? caminhoComponente : caminho;
            const resultadoAnterior = processarRegiao(conteudoAnterior, caminhoAnterior, contextoProcessamento);
            audiosComponente.push(...resultadoAnterior.audios);
        }

        if (bloco.tipo === "ligapontos") {
            // O texto das opções/respostas não recebe áudio automático. Porém,
            // os componentes que estiverem dentro desses blocos continuam
            // sendo percorridos para que seus áudios próprios sejam preservados.
            const ocorrencias = { opcao: 0, resposta: 0 };
            for (let i = 0; i < marcadores.length; i++) {
                const marcador = marcadores[i];
                if (marcador.tipo !== "opcao" && marcador.tipo !== "resposta") continue;
                const proximo = marcadores[i + 1];
                const fim = proximo ? proximo.inicio : conteudoComponente.length;
                const indicePar = ocorrencias[marcador.tipo]++;
                const conteudoPar = conteudoComponente.slice(marcador.fimAbertura, fim);
                const resultadoPar = processarRegiao(conteudoPar, [
                    ...caminhoComponente,
                    letra(indicePar),
                    marcador.tipo
                ], contextoProcessamento);
                audiosComponente.push(...resultadoPar.audios);
            }

            // Os únicos áudios próprios do LIGAPONTOS são os dois feedbacks.
            // O índice é fixo por tipo, para coincidir com data-audio-id mesmo
            // se os marcadores forem reorganizados no roteiro.
            janelas.forEach(janela => {
                const indiceJanela = janela.indice;
                const resultadoFeedback = processarRegiao(janela.conteudo, [
                    ...caminhoComponente,
                    letra(indiceJanela)
                ], contextoProcessamento);
                if (resultadoFeedback.textoLimpo) {
                    audiosComponente.push({
                        nomeSufixo: montarIdAudio(caminho, segmentoComponente, indiceJanela),
                        texto: resultadoFeedback.textoLimpo
                    });
                }
                audiosComponente.push(...resultadoFeedback.audios);
            });
        } else if (bloco.tipo === "flashcard") {
            // Componentes na FRENTE são interativos e precisam ter seus próprios
            // áudios, mas o texto da frente não deve virar narração do cartão.
            // Percorremos as duas faces em ordem documental e só criamos o áudio
            // do cartão para o conteúdo do VERSO.
            let indiceCartao = -1;
            for (let i = 0; i < marcadores.length; i++) {
                const marcador = marcadores[i];
                if (marcador.tipo === "frente") indiceCartao++;
                if (marcador.tipo !== "frente" && marcador.tipo !== "verso") continue;

                const proximo = marcadores[i + 1];
                const fim = proximo ? proximo.inicio : conteudoComponente.length;
                const conteudoFace = conteudoComponente.slice(marcador.fimAbertura, fim);
                const indiceFace = Math.max(0, indiceCartao);
                const resultadoFace = processarRegiao(conteudoFace, [
                    ...caminhoComponente,
                    letra(indiceFace)
                ], contextoProcessamento);

                if (marcador.tipo === "verso" && resultadoFace.textoLimpo) {
                    audiosComponente.push({
                        nomeSufixo: montarIdAudio(caminho, segmentoComponente, indiceFace, "verso"),
                        texto: resultadoFace.textoLimpo
                    });
                }
                // Na FRENTE, preservamos apenas os áudios dos componentes filhos;
                // o texto visual da face continua fora do sonorizacao.json.
                audiosComponente.push(...resultadoFace.audios);
            }
        } else {
            janelas.forEach((janela, indice) => {
                const indiceJanela = janela.indice ?? indice;
                const resultadoFilho = processarRegiao(janela.conteudo, [
                    ...caminhoComponente,
                    letra(indiceJanela)
                ], contextoProcessamento);
                const textoJanela = bloco.tipo === "abas"
                    ? removerRotulosBotoesInternos(resultadoFilho.textoLimpo)
                    : resultadoFilho.textoLimpo;

                if (textoJanela) {
                    audiosComponente.push({
                        nomeSufixo: montarIdAudio(caminho, segmentoComponente, indiceJanela),
                        texto: textoJanela
                    });
                }
                audiosComponente.push(...resultadoFilho.audios);
            });
        }

        if (bloco.tipo !== "ligapontos") {
            janelas.forEach(janela => {
                substituicoesJanelas.push({
                    inicio: janela.inicio,
                    fim: janela.fim,
                    valor: ""
                });
            });
        }

        // Rótulos/pares de LIGAPONTOS são controles visuais, não conteúdo
        // narrável. Removemos opções, respostas e os dois feedbacks do áudio
        // principal; o feedback recebe seu próprio arquivo hierárquico.
        const substituicoesEstruturais = bloco.tipo === "ligapontos"
            ? marcadores.map((marcador, indice) => ({
                inicio: marcador.inicio,
                fim: marcadores[indice + 1] ? marcadores[indice + 1].inicio : conteudoComponente.length,
                valor: ""
            }))
            : [...substituicoesJanelas];

        // Rótulos de <aba> são controles visuais, não conteúdo narrável.
        // As janelas já foram extraídas acima; removemos também os rótulos.
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
            (bloco.possuiFechamento ? `</${bloco.tagNome || bloco.tipo}>` : "");

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
