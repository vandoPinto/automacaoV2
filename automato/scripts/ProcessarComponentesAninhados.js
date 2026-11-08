/**
 * Processador central de componentes.
 *
 * A sintaxe universal <componente tipo="nome">...</componente> delimita
 * componentes filhos sem expor seus marcadores ao componente pai.
 * Os filhos são processados primeiro, substituídos por tokens opacos durante
 * o processamento do pai e restaurados no HTML final.
 *
 * Marcadores legados continuam sendo interpretados pelos componentes atuais.
 */
const componentes = require("./ComponentesLista");
const { normalizarTipo } = require("./Utils");
const { montarIdAudio, letra, resolverPrefixoAudioJanela, localizarBlocos } = require("./ExtrairAudiosComponentes");

const TAG_COMPONENTE = /<\/?componente\b[^>]*>/gi;
const ALIASES_TIPO_AUDIO = { botao: "botoes" };
const TIPOS_COM_AUDIO = new Set([
    "abas", "mininavegacao", "sanfona", "flashcard", "botao", "hotword", "ligapontos", "jogomemoria"
]);

/** Retorna o nome canônico usado pelo extrator de áudio para cada componente. */
function obterTipoAudioBase(tipo) {
    const normalizado = normalizarTipo(String(tipo || ""));
    if (!TIPOS_COM_AUDIO.has(normalizado)) return "";
    return ALIASES_TIPO_AUDIO[normalizado] || normalizado;
}

/**
 * Indica se o filho está no conteúdo anterior ao primeiro marcador que inicia
 * a estrutura visual válida de BOTÕES ou FLASHCARD. Essa região é externa ao
 * componente e, portanto, seus filhos herdam o caminho do pai.
 */
function estaAntesDaEstruturaDoComponente(origem, tipoPai, posicaoFilho) {
    const tipoAudio = obterTipoAudioBase(tipoPai);
    if (!["botoes", "flashcard"].includes(tipoAudio)) return false;

    const marcadorInicial = tipoAudio === "botoes" ? "botao" : "frente";
    const origemNormalizada = normalizarMarcadoresLegados(origem);
    const posicaoNormalizada = normalizarMarcadoresLegados(origem.slice(0, posicaoFilho)).length;
    const blocosFilhos = localizarBlocos(origemNormalizada);
    const regex = new RegExp(`<${marcadorInicial}\\s*>`, "gi");
    let marcador;

    while ((marcador = regex.exec(origemNormalizada)) !== null) {
        const estaDentroDeFilho = blocosFilhos.some(bloco =>
            marcador.index >= bloco.inicio && marcador.index < bloco.fim
        );
        if (!estaDentroDeFilho) return posicaoNormalizada < marcador.index;
    }

    return true;
}

/** Recupera o ordinal já atribuído ao componente-pai pelo nível anterior. */
function obterOrdinalTipoAudio(tipoAudio, tipoBase) {
    const valor = String(tipoAudio || tipoBase || "");
    const correspondencia = valor.match(new RegExp(`^${tipoBase}(\\d*)$`));
    return correspondencia ? Number(correspondencia[1] || 1) : 1;
}

/** Reconhece wrappers que o Mammoth preservou como texto escapado do DOCX. */
function normalizarWrappers(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?)\s*componente\b([\s\S]*?)&gt;/gi, (_, barra, atributos) =>
            `<${barra}componente${atributos.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")}>`
        )
        .replace(/&#60;\s*(\/?)\s*componente\b([\s\S]*?)&#62;/gi, (_, barra, atributos) =>
            `<${barra}componente${atributos.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")}>`
        )
        .replace(/&#x3c;\s*(\/?)\s*componente\b([\s\S]*?)&#x3e;/gi, (_, barra, atributos) =>
            `<${barra}componente${atributos.replace(/&quot;|&#34;|&#x22;/gi, '"').replace(/&#39;|&#x27;|&apos;/gi, "'")}>`
        );
}


/** Normaliza os marcadores antigos que podem vir escapados pelo Mammoth. */
function normalizarMarcadoresLegados(html) {
    let origem = String(html || "")
        .replace(/&lt;\s*(\/?)\s*(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao|sanfona|ligapontos|jogomemoria|opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado|carta1|carta2|feedback)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?)\s*(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao|sanfona|ligapontos|jogomemoria|opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado|carta1|carta2|feedback)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?)\s*(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao|sanfona|ligapontos|jogomemoria|opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado|carta1|carta2|feedback)\s*&#x3e;/gi, "<$1$2>")
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao|sanfona|ligapontos|jogomemoria|opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado|carta1|carta2|feedback)>\s*(?:<\/strong>\s*)?<\/p>/gi, "<$1>")
        .replace(/<strong\b[^>]*>\s*<(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao|sanfona|ligapontos|jogomemoria|opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado|carta1|carta2|feedback)>\s*<\/strong>/gi, "<$1>");

    // Mantém compatibilidade com o nome usado no roteiro enviado: <feedErrao>.
    // Também aceita as formas mais extensas como aliases, sem exigir alteração
    // nos documentos que já estiverem escritos.
    origem = origem
        .replace(/<(\/?\s*)feedbackcerto\s*>/gi, "<$1feedcerto>")
        .replace(/<(\/?\s*)(?:feedErrao|feederrado|feedbackerrado)\s*>/gi, "<$1feederrado>")
        .replace(/<\/\s*(opcao|resposta)\s*>/gi, "");
    return origem;
}

/**
 * Compatibilidade central para HOTWORDs escritas no formato legado dos DOCX.
 * O componente pai recebe apenas um token opaco; a HOTWORD é renderizada pelo
 * seu próprio módulo, sem o componente pai conhecer seus marcadores.
 */
async function protegerHotwordsLegadas(
    html, numeroLicao, index, contexto, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarMarcadoresLegados(html);
    const marcadores = [...origem.matchAll(/<(\/)?(hotword|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao)\s*>/gi)];
    if (!marcadores.some(item => !item[1] && item[2].toLowerCase() === "hotword")) {
        return { conteudo: origem, restaurar: valor => valor };
    }

    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    let ordem = 0;
    const caminhoPai = prefixoAudioPai ? String(prefixoAudioPai).split("_").filter(Boolean) : [];
    const blocosExternos = localizarBlocos(origem);

    for (let i = 0; i < marcadores.length; i++) {
        const marcador = marcadores[i];
        if (marcador[1] || marcador[2].toLowerCase() !== "hotword" || marcador.index < cursor) continue;
        const dentroDeOutroComponente = blocosExternos.some(bloco =>
            marcador.index > bloco.inicio && marcador.index < bloco.fim
        );
        if (dentroDeOutroComponente) continue;

        const fechamentoExplicito = marcadores.find((item, indice) =>
            indice > i && item[1] && item[2].toLowerCase() === "hotword"
        );
        // Nos roteiros AIM existem duas formas válidas de posicionar o
        // fechamento legado: </hotword> pode vir depois da janela (forma
        // tradicional) ou imediatamente após o termo, antes de <janela>.
        // Em ambos os casos, a janela explicativa pertence à HOTWORD e não
        // pode ser contabilizada como painel do ABAS/MININAVEGACAO.
        let indiceJanela = marcadores.findIndex((item, indice) =>
            indice > i && !item[1] && item[2].toLowerCase() === "janela" &&
            (!fechamentoExplicito || item.index < fechamentoExplicito.index)
        );
        const janelaDepoisDoFechamento = indiceJanela < 0 && Boolean(fechamentoExplicito) && String(tipoPai).toLowerCase() === "abas";
        if (janelaDepoisDoFechamento) {
            indiceJanela = marcadores.findIndex((item, indice) =>
                indice > marcadores.indexOf(fechamentoExplicito) &&
                !item[1] && item[2].toLowerCase() === "janela"
            );
        }
        if (indiceJanela < 0) continue;

        const proximoMarcador = marcadores.slice(indiceJanela + 1).find(item => !item[1]);
        // Se a HOTWORD tem fechamento explícito depois da JANELA, todo o
        // conteúdo da explicação pertence a ela, inclusive componentes
        // aninhados (por exemplo, <botoes> com seus próprios <botao>/<janela>).
        const fechamentoAposJanela = fechamentoExplicito &&
            fechamentoExplicito.index > marcadores[indiceJanela].index;
        const fim = fechamentoAposJanela
            ? fechamentoExplicito.index
            : proximoMarcador ? proximoMarcador.index : origem.length;
        const fimBloco = janelaDepoisDoFechamento
            ? fim
            : fechamentoExplicito
                ? fechamentoExplicito.index + fechamentoExplicito[0].length
                : fim;

        const marcadoresEstruturais = marcadores.filter((item, indice) =>
            indice < i && !item[1] && item.index >= cursor &&
            ["botao", "janela", "flashcard", "frente", "verso"].includes(item[2].toLowerCase())
        );
        const ultimoEstrutural = marcadoresEstruturais[marcadoresEstruturais.length - 1];
        const inicioTrecho = ultimoEstrutural
            ? ultimoEstrutural.index + ultimoEstrutural[0].length
            : cursor;

        resultado += origem.slice(cursor, inicioTrecho);
        const trechoAnterior = origem.slice(inicioTrecho, marcador.index);
        let blocoHotword = origem.slice(marcador.index, fim);
        blocoHotword = blocoHotword.replace(/<\/hotword\s*>/gi, "");
        const entradaHotword = trechoAnterior + blocoHotword;

        ordem += 1;
        const contextoHotword = `${contexto}.hotword-legada-${ordem}`;
        const prefixoAudioHotword = resolverPrefixoAudioJanela(
            origem, tipoPai, marcador.index, caminhoPai, tipoAudioPai
        );
        const hotwordsAnteriores = marcadores.slice(0, i).filter(item =>
            !item[1] && item[2].toLowerCase() === "hotword" &&
            resolverPrefixoAudioJanela(origem, tipoPai, item.index, caminhoPai, tipoAudioPai) === prefixoAudioHotword
        ).length;
        const tipoAudioHotword = hotwordsAnteriores ? `hotword${hotwordsAnteriores + 1}` : "hotword";
        const htmlHotword = await processarComponente(
            "hotword", entradaHotword, numeroLicao, contextoHotword,
            {
                inline: true,
                contexto: contextoHotword,
                tipoAudioHotword,
                ...(prefixoAudioHotword ? { prefixoAudio: prefixoAudioHotword } : {})
            }
        );

        const token = `__HTML_HOTWORD_LEGADA_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
        substituicoes.push({ token, html: htmlHotword });
        resultado += token;
        cursor = fimBloco;
        if (fechamentoExplicito && !janelaDepoisDoFechamento) {
            i = marcadores.indexOf(fechamentoExplicito);
        } else {
            i = indiceJanela;
        }
    }

    resultado += origem.slice(cursor);
    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) saida = saida.split(item.token).join(item.html);
            return saida;
        }
    };
}

/**
 * Compatibilidade da marcação direta <botao>/<janela> no conteúdo da Tela.
 * O trecho é delegado ao componente BOTAO; a Tela não interpreta rótulos,
 * janelas ou eventos. Wrappers universais já foram processados antes daqui.
 */
function resolverDadosAudioGrupoBotoes(
    origem, posicao, tipoPai, prefixoAudioPai = "", tipoAudioPai = ""
) {
    const tipo = String(tipoPai || "").toLowerCase();
    const caminhoPai = prefixoAudioPai ? String(prefixoAudioPai).split("_").filter(Boolean) : [];
    // O prefixo é resolvido para qualquer tipo de pai, inclusive BOTAO e
    // HOTWORD. A hierarquia não deve depender de uma lista de combinações.
    const prefixoAudio = resolverPrefixoAudioJanela(origem, tipo, posicao, caminhoPai, tipoAudioPai);

    // Conta apenas grupos pertencentes à mesma janela-pai. Não usa o último
    // <janela>, pois BOTÕES também possuem janelas internas.
    const anteriores = [...origem.matchAll(/<botoes\s*>/gi)]
        .filter(marcador => marcador.index < posicao);
    const ordinal = anteriores.filter(marcador =>
        resolverPrefixoAudioJanela(origem, tipo, marcador.index, caminhoPai, tipoAudioPai) === prefixoAudio
    ).length + 1;

    return {
        prefixoAudio,
        tipoAudio: ordinal > 1 ? `botoes${ordinal}` : "botoes"
    };
}

async function protegerBotoesComFechamento(
    html, numeroLicao, index, contexto, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarMarcadoresLegados(html);
    const abertura = /<botoes\s*>/i;
    const fechamento = /<\/botoes\s*>/i;
    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    let ordem = 0;
    let restante = origem;
    let deslocamentoOrigem = 0;

    while (true) {
        const inicio = abertura.exec(restante);
        if (!inicio) break;

        const depoisAbertura = inicio.index + inicio[0].length;
        fechamento.lastIndex = depoisAbertura;
        const fim = fechamento.exec(restante);
        if (!fim) {
            throw new Error("O componente BOTOES foi iniciado, mas não possui o fechamento </botoes>.");
        }

        resultado += restante.slice(0, inicio.index);
        const conteudoBotoes = restante.slice(depoisAbertura, fim.index);
        ordem += 1;
        const contextoBotoes = `${contexto}.botoes-${ordem}`;
        const dadosAudio = resolverDadosAudioGrupoBotoes(
            origem,
            deslocamentoOrigem + inicio.index,
            tipoPai,
            prefixoAudioPai,
            tipoAudioPai
        );
        const htmlBotoes = await processarComponente(
            "botao", conteudoBotoes, numeroLicao, index,
            {
                contexto: contextoBotoes,
                legadoNaTela: true,
                ...(dadosAudio.prefixoAudio ? { prefixoAudio: dadosAudio.prefixoAudio } : {}),
                tipoAudio: dadosAudio.tipoAudio
            }
        );
        const token = `__HTML_BOTOES_FECHAMENTO_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
        substituicoes.push({ token, html: htmlBotoes });
        resultado += token;
        const avancar = fim.index + fim[0].length;
        restante = restante.slice(avancar);
        deslocamentoOrigem += avancar;
    }

    resultado += restante;
    if (!ordem) return { conteudo: origem, restaurar: valor => valor };

    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) saida = saida.split(item.token).join(item.html);
            return saida;
        }
    };
}

/**
 * Extrai blocos legados <ligapontos>...</ligapontos> em qualquer posição da
 * hierarquia. O conteúdo é delegado ao próprio componente; o pai recebe um
 * token opaco e não interpreta as opções, respostas ou feedbacks internos.
 */
/**
 * Isola blocos legados <jogomemoria>...</jogomemoria> antes que os marcadores
 * internos sejam interpretados por um componente-pai. A atividade é processada
 * recursivamente e recebe o prefixo hierárquico resolvido pelo extrator central.
 */
async function protegerJogoMemoriaLegado(
    html, numeroLicao, index, contexto, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarMarcadoresLegados(html);
    const origemParaLocalizar = String(tipoPai || "").toLowerCase() === "hotword"
        ? origem.replace(/<hotword\s*>/i, marcador => " ".repeat(marcador.length))
        : origem;
    const blocos = localizarBlocos(origemParaLocalizar).filter(bloco => bloco.tipo === "jogomemoria");
    if (!blocos.length) return { conteudo: origem, restaurar: valor => valor };

    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    const caminhoPai = prefixoAudioPai ? String(prefixoAudioPai).split("_").filter(Boolean) : [];
    const ocorrenciasPorPrefixo = new Map();

    for (const bloco of blocos) {
        if (!bloco.possuiFechamento) {
            throw new Error("O componente JOGO DA MEMÓRIA foi iniciado, mas não possui o fechamento </jogomemoria>.");
        }

        resultado += origem.slice(cursor, bloco.inicio);
        const prefixoAudio = resolverPrefixoAudioJanela(
            origem, tipoPai, bloco.inicio, caminhoPai, tipoAudioPai
        );
        const escopo = prefixoAudio || "__raiz__";
        const ordinal = (ocorrenciasPorPrefixo.get(escopo) || 0) + 1;
        ocorrenciasPorPrefixo.set(escopo, ordinal);
        const tipoAudio = `jogomemoria${ordinal > 1 ? ordinal : ""}`;
        const contextoFilho = `${contexto}.jogomemoria-${ordinal}`;
        const conteudo = origem.slice(bloco.inicioConteudo, bloco.fimConteudo);

        const htmlJogoMemoria = await processarComponente(
            "jogomemoria", conteudo, numeroLicao, index,
            {
                contexto: contextoFilho,
                legadoNaTela: true,
                ...(prefixoAudio ? { prefixoAudio } : {}),
                tipoAudio
            }
        );

        const token = criarToken(
            ordinal,
            contexto,
            origem,
            substituicoes.map(item => item.token)
        );
        substituicoes.push({ token, html: htmlJogoMemoria });
        resultado += token;
        cursor = bloco.fim;
    }

    resultado += origem.slice(cursor);
    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) saida = saida.split(item.token).join(item.html);
            return saida;
        }
    };
}

async function protegerLigaPontosLegados(
    html, numeroLicao, index, contexto, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarMarcadoresLegados(html);
    // Dentro da própria HOTWORD, <hotword> é um marcador de gatilho, não um
    // contêiner que deve esconder o conteúdo da janela. Mascara somente o
    // primeiro gatilho (preservando os offsets) para localizar LIGAPONTOS e
    // continuar respeitando outros componentes que estejam acima dele.
    const origemParaLocalizar = String(tipoPai || "").toLowerCase() === "hotword"
        ? origem.replace(/<hotword\s*>/i, marcador => " ".repeat(marcador.length))
        : origem;
    const blocos = localizarBlocos(origemParaLocalizar).filter(bloco => bloco.tipo === "ligapontos");
    if (!blocos.length) return { conteudo: origem, restaurar: valor => valor };

    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    const caminhoPai = prefixoAudioPai ? String(prefixoAudioPai).split("_").filter(Boolean) : [];
    const ocorrenciasPorPrefixo = new Map();

    for (const bloco of blocos) {
        if (!bloco.possuiFechamento) {
            throw new Error("O componente LIGAPONTOS foi iniciado, mas não possui o fechamento </ligapontos>.");
        }

        resultado += origem.slice(cursor, bloco.inicio);
        const prefixoAudio = resolverPrefixoAudioJanela(
            origem, tipoPai, bloco.inicio, caminhoPai, tipoAudioPai
        );
        const escopo = prefixoAudio || "__raiz__";
        const ordinal = (ocorrenciasPorPrefixo.get(escopo) || 0) + 1;
        ocorrenciasPorPrefixo.set(escopo, ordinal);
        const tipoAudio = `ligapontos${ordinal > 1 ? ordinal : ""}`;
        const contextoFilho = `${contexto}.ligapontos-${ordinal}`;
        const conteudo = origem.slice(bloco.inicioConteudo, bloco.fimConteudo);

        const htmlLigaPontos = await processarComponente(
            "ligapontos", conteudo, numeroLicao, index,
            {
                contexto: contextoFilho,
                legadoNaTela: true,
                ...(prefixoAudio ? { prefixoAudio } : {}),
                tipoAudio
            }
        );

        const token = criarToken(
            ordinal,
            contexto,
            origem,
            substituicoes.map(item => item.token)
        );
        substituicoes.push({ token, html: htmlLigaPontos });
        resultado += token;
        cursor = bloco.fim;
    }

    resultado += origem.slice(cursor);
    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) saida = saida.split(item.token).join(item.html);
            return saida;
        }
    };
}

async function protegerBotoesLegados(
    html, numeroLicao, index, contexto, limitarAoConteudoDaFace = false,
    tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarMarcadoresLegados(html);
    if (/<botoes\s*>/i.test(origem)) {
        return protegerBotoesComFechamento(
            origem, numeroLicao, index, contexto, tipoPai, prefixoAudioPai, tipoAudioPai
        );
    }
    const marcadorBotao = /<botao\s*>/i.exec(origem);
    if (!marcadorBotao) {
        return { conteudo: origem, restaurar: valor => valor };
    }

    const inicio = marcadorBotao.index;
    // Dentro de um Flashcard, o par BOTAO/JANELA termina antes da próxima
    // face. Sem esse limite, o parser do Botão absorve os cartões seguintes.
    const proximaFace = limitarAoConteudoDaFace
        ? /<(?:frente|verso)\s*>/i.exec(origem.slice(inicio + marcadorBotao[0].length))
        : null;
    const fim = proximaFace
        ? inicio + marcadorBotao[0].length + proximaFace.index
        : origem.length;
    const fragmentoBotao = origem.slice(inicio, fim);
    const sufixo = origem.slice(fim);
    const contextoBotao = `${contexto}.botao-legado`;

    const dadosAudio = resolverDadosAudioGrupoBotoes(
        origem,
        inicio,
        tipoPai,
        prefixoAudioPai,
        tipoAudioPai
    );
    const htmlBotao = await processarComponente(
        "botao",
        fragmentoBotao,
        numeroLicao,
        index,
        {
            contexto: contextoBotao,
            legadoNaTela: true,
            ...(dadosAudio.prefixoAudio ? { prefixoAudio: dadosAudio.prefixoAudio } : {}),
            tipoAudio: dadosAudio.tipoAudio
        }
    );

    const token = `__HTML_BOTAO_LEGADO_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}__`;
    return {
        conteudo: origem.slice(0, inicio) + token + sufixo,
        restaurar(valor) {
            return String(valor || "").split(token).join(htmlBotao);
        }
    };
}

/**
 * Processa marcações legadas de BOTAO que aparecem dentro de um painel ABAS.
 *
 * Em ABAS, cada botão possui sua própria <janela>. Esse par precisa ser
 * isolado antes de o componente ABAS contar as janelas principais; caso
 * contrário, a janela do botão é confundida com uma nova aba.
 *
 * A HOTWORD já é extraída antes desta etapa. Wrappers universais também já
 * foram processados por processarFilhos. Assim, o componente BOTAO recebe
 * somente o seu bloco e o processamento continua centralizado.
 */
async function protegerBotoesLegadosEmAbas(
    html, numeroLicao, index, contexto, prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarMarcadoresLegados(html);
    const marcadorBotao = /<botao\s*>/gi;
    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    let marcador;
    let ordem = 0;

    while ((marcador = marcadorBotao.exec(origem)) !== null) {
        if (marcador.index < cursor) continue;

        const buscaJanela = /<janela\s*>/gi;
        buscaJanela.lastIndex = marcadorBotao.lastIndex;
        const marcadorJanela = buscaJanela.exec(origem);

        if (!marcadorJanela) {
            throw new Error("Foi encontrado um <botao> dentro de ABAS sem a respectiva <janela>.");
        }

        // O bloco do botão termina no próximo marcador estrutural depois
        // da janela dele. Essa próxima janela, quando existir, pertence ao
        // painel seguinte do ABAS; outro botão inicia um novo bloco interno.
        const buscaLimite = /<(?:aba|janela|botao|hotword)\s*>/gi;
        buscaLimite.lastIndex = buscaJanela.lastIndex;
        const limite = buscaLimite.exec(origem);
        const fim = limite ? limite.index : origem.length;

        resultado += origem.slice(cursor, marcador.index);

        ordem += 1;
        const fragmentoBotao = origem.slice(marcador.index, fim);
        const contextoBotao = `${contexto}.botao-legado-${ordem}`;

        // Descobre a aba/painel ao qual este BOTÃO pertence. A primeira
        // <janela> depois de cada <botao> é a janela interna do próprio botão;
        // as demais <janela> delimitam os painéis do componente-pai.
        let janelasDePainel = 0;
        let aguardandoJanelaDoBotao = false;
        const marcadoresAnteriores = /<(botao|janela)\s*>/gi;
        const trechoAnterior = origem.slice(0, marcador.index);
        let marcadorAnterior;
        while ((marcadorAnterior = marcadoresAnteriores.exec(trechoAnterior)) !== null) {
            const tipoMarcador = marcadorAnterior[1].toLowerCase();
            if (tipoMarcador === "botao") {
                aguardandoJanelaDoBotao = true;
            } else if (aguardandoJanelaDoBotao) {
                aguardandoJanelaDoBotao = false;
            } else {
                janelasDePainel += 1;
            }
        }

        const tipoPai = String(contexto).includes("mininavegacao")
            ? "mininavegacao"
            : "abas";
        // O mesmo montador de IDs usado por ExtrairAudiosComponentes.js.
        // O índice do painel é zero-based; a primeira janela corresponde a "a".
        const caminhoAudioPai = prefixoAudioPai
            ? String(prefixoAudioPai).split("_").filter(Boolean)
            : [];
        const prefixoAudio = montarIdAudio(
            caminhoAudioPai,
            tipoAudioPai || tipoPai,
            Math.max(0, janelasDePainel - 1)
        );

        const htmlBotao = await processarComponente(
            "botao",
            fragmentoBotao,
            numeroLicao,
            index,
            {
                contexto: contextoBotao,
                legadoNaTela: true,
                prefixoAudio,
                tipoAudio: "botoes"
            }
        );

        const token = `__HTML_BOTAO_ABAS_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
        substituicoes.push({ token, html: htmlBotao });
        resultado += token;
        cursor = fim;

        // A próxima busca começa depois do bloco já isolado.
        marcadorBotao.lastIndex = fim;
    }

    resultado += origem.slice(cursor);

    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) {
                saida = saida.split(item.token).join(item.html);
            }
            return saida;
        }
    };
}


/**
 * Extrai FLASHCARDs legados de qualquer componente-pai.
 *
 * A identificação do painel pai é resolvida pelo mesmo extrator usado no JSON.
 * Fechamentos explícitos delimitam o bloco completo; quando o roteiro legado
 * omite </flashcard>, os marcadores de navegação do pai delimitam o conteúdo.
 * O FLASHCARD é processado recursivamente antes dos adaptadores de HOTWORD e
 * BOTÕES do pai, impedindo que seus descendentes sejam capturados no nível errado.
 */
async function protegerFlashcardsLegadosEmComponentes(
    html, numeroLicao, index, contexto, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarMarcadoresLegados(html);
    const marcadorFlashcard = /<flashcard\s*>/gi;
    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    let marcador;
    let ordem = 0;
    const ocorrenciasFlashcardsPorJanela = new Map();
    const blocosExternos = localizarBlocos(origem).filter(bloco =>
        !(normalizarTipo(String(tipoPai || "")) === "hotword" && bloco.tipo === "hotword")
    );

    while ((marcador = marcadorFlashcard.exec(origem)) !== null) {
        if (marcador.index < cursor) continue;
        const dentroDeOutroComponente = blocosExternos.some(bloco =>
            marcador.index > bloco.inicio && marcador.index < bloco.fim
        );
        if (dentroDeOutroComponente) continue;

        const buscaLimite = /<(aba|janela|botao|hotword)\s*>/gi;
        buscaLimite.lastIndex = marcadorFlashcard.lastIndex;

        let limite = null;
        let marcadorEstrutural;

        while ((marcadorEstrutural = buscaLimite.exec(origem)) !== null) {
            const tipo = marcadorEstrutural[1].toLowerCase();

            if (tipo === "aba") {
                limite = marcadorEstrutural;
                break;
            }

            if (tipo === "botao" || tipo === "hotword") {
                // A próxima janela pertence ao componente interativo interno.
                const buscaJanelaInterna = /<janela\s*>/gi;
                buscaJanelaInterna.lastIndex = buscaLimite.lastIndex;
                const janelaInterna = buscaJanelaInterna.exec(origem);

                if (janelaInterna) {
                    buscaLimite.lastIndex = buscaJanelaInterna.lastIndex;
                    continue;
                }

                limite = marcadorEstrutural;
                break;
            }

            // Uma janela sem BOTAO/HOTWORD pendente é a próxima aba principal.
            limite = marcadorEstrutural;
            break;
        }

        const fechamentoFlashcard = /<\/flashcard\s*>/gi;
        fechamentoFlashcard.lastIndex = marcadorFlashcard.lastIndex;
        const fechamentoExplicito = fechamentoFlashcard.exec(origem);
        const fimEstrutural = limite ? limite.index : origem.length;
        const possuiFechamento = fechamentoExplicito && fechamentoExplicito.index < fimEstrutural;
        const fimConteudo = possuiFechamento ? fechamentoExplicito.index : fimEstrutural;
        const fim = possuiFechamento
            ? fechamentoExplicito.index + fechamentoExplicito[0].length
            : fimEstrutural;
        resultado += origem.slice(cursor, marcador.index);

        ordem += 1;
        const fragmento = origem.slice(marcadorFlashcard.lastIndex, fimConteudo);
        const contextoFlashcard = `${contexto}.flashcard-legado-${ordem}`;
        const prefixoAudio = resolverPrefixoAudioJanela(
            origem,
            tipoPai,
            marcador.index,
            prefixoAudioPai ? prefixoAudioPai.split("_") : [],
            tipoAudioPai
        );
        const escopoAudio = prefixoAudio || "";
        const ordinalAudio = (ocorrenciasFlashcardsPorJanela.get(escopoAudio) || 0) + 1;
        ocorrenciasFlashcardsPorJanela.set(escopoAudio, ordinalAudio);
        const tipoAudioFlashcard = `flashcard${ordinalAudio > 1 ? ordinalAudio : ""}`;
        const htmlFlashcard = await processarComponente(
            "flashcard",
            fragmento,
            numeroLicao,
            index,
            {
                contexto: contextoFlashcard,
                legadoNaTela: true,
                prefixoAudio,
                tipoAudio: tipoAudioFlashcard
            }
        );

        const token = `__HTML_FLASHCARD_COMPONENTE_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
        substituicoes.push({ token, html: htmlFlashcard });
        resultado += token;
        cursor = fim;
        marcadorFlashcard.lastIndex = fim;
    }

    resultado += origem.slice(cursor);

    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) {
                saida = saida.split(item.token).join(item.html);
            }
            return saida;
        }
    };
}

/**
 * Compatibilidade da marcação direta <abas> utilizada nos roteiros DOCX.
 * O conteúdo anterior a <abas> permanece na Tela; somente os marcadores
 * <aba>/<janela> são encaminhados ao componente ABAS.
 *
 * A extração ocorre antes dos adaptadores legados de HOTWORD e BOTAO porque
 * <janela> também delimita os painéis. Dentro de ABAS, os adaptadores centrais
 * isolam as janelas internas de HOTWORD e BOTAO antes da contagem dos painéis;
 * wrappers universais continuam sendo processados recursivamente acima.
 */
/**
 * Extrai SANFONAS delimitadas explicitamente em qualquer componente-pai.
 * O bloco é delegado ao componente SANFONA; o conteúdo posterior permanece
 * no fluxo do pai. O scanner por profundidade também permite sanfonas aninhadas.
 */
async function protegerSanfonasLegadas(
    html, numeroLicao, index, contexto, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarMarcadoresLegados(html);
    const abertura = /<sanfona\s*>/gi;
    const substituicoes = [];
    const blocosExternos = localizarBlocos(origem).filter(bloco =>
        !(normalizarTipo(String(tipoPai || "")) === "hotword" && bloco.tipo === "hotword")
    );
    let resultado = "";
    let cursor = 0;
    let ordem = 0;
    let inicio;

    while ((inicio = abertura.exec(origem)) !== null) {
        if (inicio.index < cursor) continue;
        const estaDentroDeOutroComponente = blocosExternos.some(bloco =>
            inicio.index > bloco.inicio && inicio.index < bloco.fim &&
            !(bloco.tipo === String(tipoPai || "").toLowerCase() && bloco.inicio === 0)
        );
        // Deixa componentes descendentes para o processador do respectivo pai.
        // Isso preserva o prefixo de áudio de ABAS, FLASHCARD e outros containers.
        if (estaDentroDeOutroComponente) continue;

        let profundidade = 1;
        let busca = inicio.index + inicio[0].length;
        let fim = null;
        const marcadores = /<\/?sanfona\s*>/gi;
        marcadores.lastIndex = busca;
        let marcador;

        while ((marcador = marcadores.exec(origem)) !== null) {
            if (marcador[0].startsWith("</")) profundidade--;
            else profundidade++;

            if (profundidade === 0) {
                fim = marcador;
                break;
            }
        }

        if (!fim) {
            throw new Error("O componente SANFONA foi iniciado, mas não possui o fechamento </sanfona>.");
        }

        resultado += origem.slice(cursor, inicio.index);
        const fragmento = origem.slice(inicio.index + inicio[0].length, fim.index);
        ordem += 1;
        const contextoSanfona = `${contexto}.sanfona-${ordem}`;
        const caminhoAudioPai = prefixoAudioPai
            ? String(prefixoAudioPai).split("_").filter(Boolean)
            : [];
        const prefixoAudioSanfona = resolverPrefixoAudioJanela(
            origem, tipoPai, inicio.index, caminhoAudioPai, tipoAudioPai
        );
        const ocorrenciasNoMesmoPainel = [...origem.slice(0, inicio.index).matchAll(/<sanfona\s*>/gi)]
            .filter(marcador => resolverPrefixoAudioJanela(
                origem, tipoPai, marcador.index, caminhoAudioPai, tipoAudioPai
            ) === prefixoAudioSanfona).length;
        const tipoAudioSanfona = `sanfona${ocorrenciasNoMesmoPainel ? ocorrenciasNoMesmoPainel + 1 : ""}`;
        const htmlSanfona = await processarComponente(
            "sanfona", fragmento, numeroLicao, index,
            {
                contexto: contextoSanfona,
                tipoAudioSanfona,
                ...(prefixoAudioSanfona ? { prefixoAudio: prefixoAudioSanfona } : {})
            }
        );

        const token = `__HTML_SANFONA_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
        substituicoes.push({ token, html: htmlSanfona });
        resultado += token;
        cursor = fim.index + fim[0].length;
        abertura.lastIndex = cursor;
    }

    resultado += origem.slice(cursor);
    if (!ordem) return { conteudo: origem, restaurar: valor => valor };

    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) {
                saida = saida.split(item.token).join(item.html);
            }
            return saida;
        }
    };
}

/**
 * Compatibilidade com <mininavegacao> legado em DOCX.
 * A extração mantém o texto anterior na Tela e delega as janelas ao componente.
 */
function resolverDadosAudioComponenteLegado(
    origem, tipo, posicao, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const caminhoAudioPai = prefixoAudioPai
        ? String(prefixoAudioPai).split("_").filter(Boolean)
        : [];
    const prefixoAudio = resolverPrefixoAudioJanela(
        origem, tipoPai, posicao, caminhoAudioPai, tipoAudioPai
    );
    const regex = new RegExp(`<${tipo}\\s*>`, "gi");
    const anteriores = [...origem.matchAll(regex)].filter(marcador =>
        marcador.index < posicao && resolverPrefixoAudioJanela(
            origem, tipoPai, marcador.index, caminhoAudioPai, tipoAudioPai
        ) === prefixoAudio
    );
    const ordinal = anteriores.length + 1;

    return {
        prefixoAudio,
        tipoAudio: `${tipo}${ordinal > 1 ? ordinal : ""}`
    };
}

/**
 * Processa um container legado ABAS/MININAVEGACAO em qualquer componente-pai.
 * O wrapper é removido e somente os marcadores próprios do componente são
 * encaminhados ao processador. Componentes descendentes serão processados
 * recursivamente dentro do contexto da janela do pai.
 */
async function protegerContainerNavegacaoLegado(
    html, numeroLicao, index, contexto, tipo, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarMarcadoresLegados(html);
    const abertura = new RegExp(`<${tipo}\\s*>`, "gi");
    const fechamento = new RegExp(`<\\/${tipo}\\s*>`, "gi");
    const tipoPaiNormalizado = normalizarTipo(String(tipoPai || ""));
    const primeiraPosicaoConteudo = origem.search(/\S/);
    const todosBlocosOrigem = localizarBlocos(origem);
    const blocoRaizProprio = todosBlocosOrigem.find(bloco =>
        bloco.tipo === tipo && bloco.inicio === primeiraPosicaoConteudo && tipoPaiNormalizado === tipo
    );
    const blocosExternos = todosBlocosOrigem.filter(bloco =>
        bloco !== blocoRaizProprio &&
        !(tipoPaiNormalizado === "hotword" && bloco.tipo === "hotword")
    );
    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    let ordem = 0;
    let inicio;

    while ((inicio = abertura.exec(origem)) !== null) {
        if (inicio.index < cursor) continue;
        if (blocoRaizProprio && inicio.index === blocoRaizProprio.inicio) continue;

        const dentroDeOutroComponente = blocosExternos.some(bloco =>
            inicio.index > bloco.inicio && inicio.index < bloco.fim
        );
        if (dentroDeOutroComponente) continue;

        let profundidade = 1;
        fechamento.lastIndex = abertura.lastIndex;
        let fimFechamento = null;
        let marcadorFechamento;
        const regexMarcadores = new RegExp(`<\\/?${tipo}\\s*>`, "gi");
        regexMarcadores.lastIndex = abertura.lastIndex;
        while ((marcadorFechamento = regexMarcadores.exec(origem)) !== null) {
            if (marcadorFechamento[0].startsWith("</")) profundidade--;
            else profundidade++;
            if (profundidade === 0) {
                fimFechamento = marcadorFechamento;
                break;
            }
        }

        // A sintaxe legada sem fechamento continua válida: nesse caso, o
        // componente ocupa o restante do escopo que recebeu do pai.
        const fimConteudo = fimFechamento ? fimFechamento.index : origem.length;
        const fimBloco = fimFechamento
            ? fimFechamento.index + fimFechamento[0].length
            : origem.length;
        const conteudoInterno = origem.slice(abertura.lastIndex, fimConteudo);
        const dadosAudio = resolverDadosAudioComponenteLegado(
            origem, tipo, inicio.index, tipoPai, prefixoAudioPai, tipoAudioPai
        );

        ordem += 1;
        const contextoFilho = `${contexto}.${tipo}-legada${ordem > 1 ? `-${ordem}` : ""}`;
        const htmlFilho = await processarComponente(
            tipo,
            conteudoInterno,
            numeroLicao,
            index,
            {
                contexto: contextoFilho,
                ...(dadosAudio.prefixoAudio ? { prefixoAudio: dadosAudio.prefixoAudio } : {}),
                tipoAudio: dadosAudio.tipoAudio
            }
        );

        resultado += origem.slice(cursor, inicio.index);
        const token = `__HTML_${tipo.toUpperCase()}_LEGADO_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
        substituicoes.push({ token, html: htmlFilho });
        resultado += token;
        cursor = fimBloco;
        abertura.lastIndex = fimBloco;
    }

    resultado += origem.slice(cursor);
    if (!ordem) return { conteudo: origem, restaurar: valor => valor };

    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) saida = saida.split(item.token).join(item.html);
            return saida;
        }
    };
}

async function protegerMiniNavegacaoLegada(
    html, numeroLicao, index, contexto, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    return protegerContainerNavegacaoLegado(
        html, numeroLicao, index, contexto, "mininavegacao", tipoPai, prefixoAudioPai, tipoAudioPai
    );
}

async function protegerAbasLegadas(
    html, numeroLicao, index, contexto, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    return protegerContainerNavegacaoLegado(
        html, numeroLicao, index, contexto, "abas", tipoPai, prefixoAudioPai, tipoAudioPai
    );
}

/**
 * Compatibilidade da marcação direta <flashcard> utilizada nos roteiros DOCX.
 * Como essa marcação não possui fechamento no roteiro, o conteúdo após ela
 * pertence ao Flashcard até o fim da tela. O componente recebe esse fragmento
 * e continua delegando seus filhos ao processamento recursivo central.
 */
async function protegerFlashcardsLegados(html, numeroLicao, index, contexto) {
    const origem = normalizarMarcadoresLegados(html);
    const marcador = /<flashcard\s*>/i.exec(origem);
    if (!marcador) {
        return { conteudo: origem, restaurar: valor => valor };
    }

    const inicio = marcador.index;
    const inicioConteudo = inicio + marcador[0].length;
    const prefixo = origem.slice(0, inicio);

    // Quando existe fechamento explícito, somente o conteúdo até </flashcard>
    // pertence ao componente. O restante permanece no fluxo da Tela/pai.
    // Sem fechamento, mantemos o comportamento legado (até o fim do conteúdo).
    const fechamento = /<\/flashcard\s*>/i.exec(origem.slice(inicioConteudo));
    const fimConteudo = fechamento
        ? inicioConteudo + fechamento.index
        : origem.length;
    const fragmento = origem.slice(inicioConteudo, fimConteudo);
    const sufixo = fechamento
        ? origem.slice(fimConteudo + fechamento[0].length)
        : "";

    const contextoFlashcard = `${contexto}.flashcard-legado`;
    const htmlFlashcard = await processarComponente(
        "flashcard",
        fragmento,
        numeroLicao,
        index,
        { contexto: contextoFlashcard, legadoNaTela: true }
    );

    const token = `__HTML_FLASHCARD_LEGADO_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}__`;
    return {
        conteudo: prefixo + token + sufixo,
        restaurar(valor) {
            return String(valor || "").split(token).join(htmlFlashcard);
        }
    };
}

/**
 * Validação central dos marcadores legados dos componentes.
 *
 * Os roteiros antigos usam alguns marcadores como delimitadores implícitos
 * (por exemplo, <aba>, <frente> e <janela>). Por isso, não exigimos um
 * fechamento literal para todos eles. Entretanto, todo fechamento explícito
 * precisa ter uma abertura correspondente; e os grupos SANFONA/BOTOES,
 * cuja sintaxe é obrigatoriamente pareada, são validados integralmente.
 */
function validarMarcadoresComponentes(html, contexto = "conteúdo") {
    const origem = normalizarMarcadoresLegados(normalizarWrappers(html));
    const nomes = ["hotword", "botoes", "botao", "janela", "flashcard", "frente", "verso", "abas", "aba", "mininavegacao", "sanfona", "ligapontos", "jogomemoria", "opcao", "resposta", "feedcerto", "feederrado", "carta1", "carta2", "feedback"];
    const regex = new RegExp(`<\\/?(${nomes.join("|")})\\s*>`, "gi");
    const aberturas = Object.fromEntries(nomes.map(nome => [nome, 0]));
    const fechamentos = Object.fromEntries(nomes.map(nome => [nome, 0]));
    let marcador;

    while ((marcador = regex.exec(origem)) !== null) {
        const nome = marcador[1].toLowerCase();
        if (marcador[0].startsWith("</")) {
            fechamentos[nome]++;
            if (fechamentos[nome] > aberturas[nome]) {
                throw new Error(`Fechamento </${nome}> sem abertura correspondente em ${contexto} (posição ${marcador.index}).`);
            }
        } else {
            aberturas[nome]++;
        }
    }

    // Estes grupos exigem fechamento explícito no formato aceito pelo
    // Automato. Os demais preservam a compatibilidade histórica.
    for (const nome of ["botoes", "sanfona", "ligapontos", "jogomemoria"]) {
        if (aberturas[nome] > fechamentos[nome]) {
            throw new Error(`O componente ${nome.toUpperCase()} foi iniciado, mas não possui o fechamento </${nome}> em ${contexto}.`);
        }
    }

    return true;
}

function lerAtributoTipo(tag) {
    const match = tag.match(/\btipo\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    return match ? (match[1] || match[2] || match[3] || "").trim() : "";
}

/**
 * Constrói a árvore dos wrappers universais, respeitando qualquer profundidade.
 * Cada nó mantém as posições originais no HTML, permitindo substituir somente
 * o trecho do componente sem reordenar textos, imagens ou elementos irmãos.
 * A tag <janela> não é um wrapper de componente: ela permanece no conteúdo
 * do componente proprietário e será interpretada pelo próprio componente.
 */
function analisarWrappers(html) {
    const origem = normalizarWrappers(html);
    const pilha = [];
    const nos = [];
    let match;
    TAG_COMPONENTE.lastIndex = 0;

    while ((match = TAG_COMPONENTE.exec(origem)) !== null) {
        const tag = match[0];
        const fechamento = /^<\//.test(tag);
        const autoFechamento = /\/\s*>$/.test(tag);

        if (!fechamento) {
            const tipoOriginal = lerAtributoTipo(tag);
            if (!tipoOriginal) throw new Error(`Wrapper <componente> sem atributo tipo válido na posição ${match.index}.`);
            const no = {
                tipo: normalizarTipo(tipoOriginal), tipoOriginal,
                inicioTag: match.index, fimAbertura: TAG_COMPONENTE.lastIndex,
                filhos: []
            };
            if (pilha.length) pilha[pilha.length - 1].filhos.push(no);
            else nos.push(no);
            if (autoFechamento) {
                no.fimConteudo = no.fimAbertura;
                no.fim = TAG_COMPONENTE.lastIndex;
            } else pilha.push(no);
        } else {
            if (!pilha.length) throw new Error(`Fechamento </componente> sem abertura na posição ${match.index}.`);
            const no = pilha.pop();
            no.fimConteudo = match.index;
            no.fim = TAG_COMPONENTE.lastIndex;
        }
    }

    if (pilha.length) {
        const no = pilha[pilha.length - 1];
        throw new Error(`Componente "${no.tipoOriginal}" sem fechamento </componente>.`);
    }
    return nos;
}

function criarToken(indice, contexto, origem, tokensExistentes = []) {
    const seguro = String(contexto || "tela").replace(/[^a-zA-Z0-9_-]/g, "_");
    const base = `__HTML_COMPONENTE_FILHO_${seguro}_${indice}`;
    let tentativa = 0;
    let token;

    // Evita colisão com texto legítimo do DOCX ou com outro placeholder
    // criado durante o processamento da mesma tela.
    do {
        tentativa += 1;
        token = `${base}_${tentativa}_FIM__`;
    } while (String(origem || "").includes(token) || tokensExistentes.includes(token));

    return token;
}

async function processarFilhos(
    html, numeroLicao, contexto, tipoPai = "", prefixoAudioPai = "", tipoAudioPai = ""
) {
    const origem = normalizarWrappers(html);
    const origemMarcadores = normalizarMarcadoresLegados(origem);
    const nos = analisarWrappers(origem);
    if (!nos.length) return { conteudo: origem, restaurar: valor => valor };

    // Wrappers universais encontrados dentro de um componente legado precisam
    // ser processados somente depois que o adaptador isolar esse componente.
    // Caso contrário, o filho seria processado como filho direto da TELA e
    // perderia o prefixo do pai legado. O caso HOTWORD é tratado como conteúdo
    // próprio do componente quando o chamador já está processando uma HOTWORD.
    const tipoPaiNormalizado = normalizarTipo(String(tipoPai || ""));
    const primeiraPosicaoConteudo = origemMarcadores.search(/\S/);
    const blocosLegados = localizarBlocos(origemMarcadores).filter(bloco =>
        !(tipoPaiNormalizado === "hotword" && bloco.tipo === "hotword") &&
        !(bloco.tipo === tipoPaiNormalizado && bloco.inicio === primeiraPosicaoConteudo)
    );

    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    const ocorrenciasPorJanelaETipo = new Map();

    for (let i = 0; i < nos.length; i++) {
        const no = nos[i];
        resultado += origem.slice(cursor, no.inicioTag);
        const posicaoNormalizada = normalizarMarcadoresLegados(
            origem.slice(0, no.inicioTag)
        ).length;
        const estaDentroDeLegado = blocosLegados.some(bloco =>
            posicaoNormalizada > bloco.inicio && posicaoNormalizada < bloco.fim
        );

        if (estaDentroDeLegado) {
            // Mantém o wrapper intacto. O componente legado que o contém será
            // isolado abaixo e, na chamada recursiva, este filho será processado
            // com o contexto correto da janela/fase correspondente.
            resultado += origem.slice(no.inicioTag, no.fim);
            cursor = no.fim;
            continue;
        }

        const conteudoInterno = origem.slice(no.fimAbertura, no.fimConteudo);
        const contextoFilho = `${contexto}.${i + 1}`;
        // Resolve a janela-pai pela mesma extração usada na geração do JSON.
        // Assim, qualquer componente filho recebe o caminho hierárquico completo,
        // sem cálculos particulares em cada template.
        const prefixoAudioFilho = resolverPrefixoAudioJanela(
            origem,
            tipoPai,
            no.inicioTag,
            prefixoAudioPai ? String(prefixoAudioPai).split("_") : [],
            tipoAudioPai
        );

        // O extrator do JSON numera componentes irmãos do mesmo tipo dentro
        // da mesma janela (flashcard, flashcard2; botoes, botoes2 etc.). O HTML
        // recebe o mesmo segmento. A contagem é isolada por janela: irmãos em
        // painéis diferentes reiniciam a numeração.
        const tipoAudioBase = obterTipoAudioBase(no.tipo);
        let tipoAudioFilho = "";
        if (tipoAudioBase) {
            const escopo = `${prefixoAudioFilho}\u0000${tipoAudioBase}`;
            // O pai BOTÕES/FLASHCARD já ocupa uma ocorrência no mesmo nível.
            // Um filho localizado antes do primeiro marcador válido está fora
            // do pai e recebe o ordinal seguinte quando for do mesmo tipo.
            if (estaAntesDaEstruturaDoComponente(origem, tipoPai, no.inicioTag)) {
                const tipoAudioBasePai = obterTipoAudioBase(tipoPai);
                if (tipoAudioBase === tipoAudioBasePai) {
                    const ordinalPai = obterOrdinalTipoAudio(tipoAudioPai, tipoAudioBasePai);
                    ocorrenciasPorJanelaETipo.set(
                        escopo,
                        Math.max(ocorrenciasPorJanelaETipo.get(escopo) || 0, ordinalPai)
                    );
                }
            }
            const ordinal = (ocorrenciasPorJanelaETipo.get(escopo) || 0) + 1;
            ocorrenciasPorJanelaETipo.set(escopo, ordinal);
            tipoAudioFilho = `${tipoAudioBase}${ordinal > 1 ? ordinal : ""}`;
        }

        const htmlFilho = await processarComponente(
            no.tipo, conteudoInterno, numeroLicao, contextoFilho,
            {
                contexto: contextoFilho,
                ...(prefixoAudioFilho ? { prefixoAudio: prefixoAudioFilho } : {}),
                ...(tipoAudioFilho ? { tipoAudio: tipoAudioFilho } : {})
            }
        );
        const token = criarToken(
            i + 1,
            contexto,
            origem,
            substituicoes.map(item => item.token)
        );
        substituicoes.push({ token, html: htmlFilho });
        resultado += token;
        cursor = no.fim;
    }
    resultado += origem.slice(cursor);

    return {
        conteudo: resultado,
        restaurar(valor) {
            let saida = String(valor || "");
            for (const item of substituicoes) saida = saida.split(item.token).join(item.html);
            return saida;
        }
    };
}

async function processarComponente(tipo, conteudo, numeroLicao, index, opcoes = {}) {
    const tipoNormalizado = normalizarTipo(String(tipo || ""));
    const componente = componentes[tipoNormalizado];
    if (typeof componente !== "function") {
        throw new Error(`Componente "${tipo}" não está cadastrado em ComponentesLista.js.`);
    }

    const contexto = opcoes.contexto || `${numeroLicao ?? 0}_${index ?? 0}`;
    const tipoAudioPai = opcoes.tipoAudio || obterTipoAudioBase(tipoNormalizado);
    validarMarcadoresComponentes(conteudo, `componente "${tipoNormalizado}" (${contexto})`);
    const filhos = await processarFilhos(
        conteudo, numeroLicao, contexto, tipoNormalizado, opcoes.prefixoAudio || "", tipoAudioPai
    );

    // JOGO DA MEMÓRIA é isolado antes dos adaptadores legados. Assim, seus
    // marcadores <frente>/<carta1>/<carta2>/<feedback> nunca vazam para o pai.
    const jogoMemoriaLegado = await protegerJogoMemoriaLegado(
        filhos.conteudo, numeroLicao, index, contexto, tipoNormalizado,
        opcoes.prefixoAudio || "", tipoAudioPai
    );

    // LIGAPONTOS é extraído antes dos adaptadores legados de navegação. Assim,
    // seus marcadores internos nunca são confundidos com marcadores do pai.
    const ligaPontosLegados = await protegerLigaPontosLegados(
        jogoMemoriaLegado.conteudo, numeroLicao, index, contexto, tipoNormalizado,
        opcoes.prefixoAudio || "", tipoAudioPai
    );

    // SANFONA é delimitada explicitamente e pode aparecer dentro de qualquer
    // componente-pai. Extraímos o bloco antes de interpretar os marcadores
    // legados <botao>/<janela> para que eles pertençam à própria SANFONA.
    const sanfonasLegadas = await protegerSanfonasLegadas(
        ligaPontosLegados.conteudo, numeroLicao, index, contexto, tipoNormalizado, opcoes.prefixoAudio || "", tipoAudioPai
    );

    // Extrai ABAS da Tela antes dos adaptadores legados, pois <janela>
    // também delimita os painéis do componente.
    const miniNavegacaoLegada = await protegerMiniNavegacaoLegada(
        sanfonasLegadas.conteudo,
        numeroLicao,
        index,
        contexto,
        tipoNormalizado,
        opcoes.prefixoAudio || "",
        tipoAudioPai
    );

    const abasLegadas = await protegerAbasLegadas(
        miniNavegacaoLegada.conteudo,
        numeroLicao,
        index,
        contexto,
        tipoNormalizado,
        opcoes.prefixoAudio || "",
        tipoAudioPai
    );

    // Primeiro isolamos FLASHCARDs legados em qualquer componente-pai.
    // Assim, HOTWORDs e BOTÕES internos são processados no contexto do próprio
    // FLASHCARD, e não capturados por um ancestral como se fossem irmãos dele.
    const flashcardsLegadas = tipoNormalizado === "tela"
        ? await protegerFlashcardsLegados(
            abasLegadas.conteudo,
            numeroLicao,
            index,
            contexto
        )
        : await protegerFlashcardsLegadosEmComponentes(
            abasLegadas.conteudo,
            numeroLicao,
            index,
            contexto,
            tipoNormalizado,
            opcoes.prefixoAudio || "",
            tipoAudioPai
        );

    // Só depois dos componentes-filho tratados, interpretamos as HOTWORDs que
    // pertencem diretamente ao conteúdo atual. O contexto recebido é o do pai
    // imediato, sem atravessar FLASHCARDs já isolados.
    const hotwordsLegadas = ["hotword"].includes(tipoNormalizado)
        ? { conteudo: flashcardsLegadas.conteudo, restaurar: valor => valor }
        : await protegerHotwordsLegadas(
            flashcardsLegadas.conteudo,
            numeroLicao,
            index,
            contexto,
            tipoNormalizado,
            opcoes.prefixoAudio || "",
            tipoAudioPai
        );

    // Grupos explícitos <botoes> são delegados ao componente BOTAO em qualquer
    // componente-pai. SANFONA reserva <botao>/<janela> para seus próprios painéis;
    // por isso esses marcadores não são interpretados novamente como BOTAO.
    const botoesLegados = /<botoes\s*>/i.test(hotwordsLegadas.conteudo)
        ? await protegerBotoesComFechamento(
            hotwordsLegadas.conteudo,
            numeroLicao,
            index,
            contexto,
            tipoNormalizado,
            opcoes.prefixoAudio || "",
            tipoAudioPai
        )
        : ["abas", "mininavegacao"].includes(tipoNormalizado)
            ? await protegerBotoesLegadosEmAbas(
                hotwordsLegadas.conteudo,
                numeroLicao,
                index,
                contexto,
                opcoes.prefixoAudio || "",
                tipoAudioPai
            )
            : !["botao", "sanfona"].includes(tipoNormalizado)
                ? await protegerBotoesLegados(
                    hotwordsLegadas.conteudo,
                    numeroLicao,
                    index,
                    contexto,
                    tipoNormalizado === "flashcard",
                    tipoNormalizado,
                    opcoes.prefixoAudio || "",
                    tipoAudioPai
                )
                : { conteudo: hotwordsLegadas.conteudo, restaurar: valor => valor };

    let html;
    try {
        // Mantém a assinatura histórica: (conteudo, numeroLicao, index).
        html = await componente(botoesLegados.conteudo, numeroLicao, index, opcoes);
    } catch (erro) {
        erro.message = `Componente "${tipoNormalizado}" (${contexto}): ${erro.message}`;
        throw erro;
    }
    if (typeof html !== "string") throw new Error(`O componente "${tipoNormalizado}" não retornou uma string HTML.`);
    return filhos.restaurar(
        jogoMemoriaLegado.restaurar(
            ligaPontosLegados.restaurar(
                sanfonasLegadas.restaurar(
                flashcardsLegadas.restaurar(
                    hotwordsLegadas.restaurar(
                        botoesLegados.restaurar(
                            abasLegadas.restaurar(
                                miniNavegacaoLegada.restaurar(html)
                            )
                        )
                    )
                )
            )
        )
    ));
}

function componenteExiste(tipo) {
    return typeof componentes[normalizarTipo(String(tipo || ""))] === "function";
}

module.exports = { processarComponente, analisarWrappers, validarMarcadoresComponentes, componenteExiste, normalizarWrappers, normalizarMarcadoresLegados };
