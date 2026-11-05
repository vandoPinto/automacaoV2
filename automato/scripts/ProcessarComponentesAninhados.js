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

const TAG_COMPONENTE = /<\/?componente\b[^>]*>/gi;

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
    return String(html || "")
        .replace(/&lt;\s*(\/?)\s*(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?)\s*(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?)\s*(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao)\s*&#x3e;/gi, "<$1$2>")
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao)>\s*(?:<\/strong>\s*)?<\/p>/gi, "<$1>")
        .replace(/<strong\b[^>]*>\s*<(hotword|botoes|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao)>\s*<\/strong>/gi, "<$1>");
}

/**
 * Compatibilidade central para HOTWORDs escritas no formato legado dos DOCX.
 * O componente pai recebe apenas um token opaco; a HOTWORD é renderizada pelo
 * seu próprio módulo, sem o componente pai conhecer seus marcadores.
 */
async function protegerHotwordsLegadas(html, numeroLicao, index, contexto) {
    const origem = normalizarMarcadoresLegados(html);
    const marcadores = [...origem.matchAll(/<(\/?)(hotword|botao|janela|flashcard|frente|verso|abas|aba|mininavegacao)\s*>/gi)];
    if (!marcadores.some(item => !item[1] && item[2].toLowerCase() === "hotword")) {
        return { conteudo: origem, restaurar: valor => valor };
    }

    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    let ordem = 0;

    for (let i = 0; i < marcadores.length; i++) {
        const marcador = marcadores[i];
        if (marcador[1] || marcador[2].toLowerCase() !== "hotword" || marcador.index < cursor) continue;

        const fechamentoExplicito = marcadores.find((item, indice) =>
            indice > i && item[1] === "/" && item[2].toLowerCase() === "hotword"
        );
        const indiceJanela = marcadores.findIndex((item, indice) =>
            indice > i && !item[1] && item[2].toLowerCase() === "janela" &&
            (!fechamentoExplicito || item.index < fechamentoExplicito.index)
        );
        if (indiceJanela < 0) continue;

        const marcadorJanela = marcadores[indiceJanela];
        // Com fechamento explícito, o HOTWORD termina exatamente em </hotword>.
        // Sem ele, preservamos o limite legado: próximo marcador estrutural.
        const proximoMarcador = fechamentoExplicito
            ? fechamentoExplicito
            : marcadores.slice(indiceJanela + 1).find(item => !item[1]);
        const fim = proximoMarcador ? proximoMarcador.index : origem.length;
        const fimBloco = fechamentoExplicito
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
        const htmlHotword = await processarComponente(
            "hotword", entradaHotword, numeroLicao, contextoHotword,
            { inline: true, contexto: contextoHotword }
        );

        const token = `__HTML_HOTWORD_LEGADA_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
        substituicoes.push({ token, html: htmlHotword });
        resultado += token;
        cursor = fechamentoExplicito ? fimBloco : (proximoMarcador ? fim : origem.length);
        if (fechamentoExplicito) i = marcadores.indexOf(fechamentoExplicito);
        else i = indiceJanela;
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
async function protegerBotoesComFechamento(html, numeroLicao, index, contexto) {
    const origem = normalizarMarcadoresLegados(html);
    const abertura = /<botoes\s*>/i;
    const fechamento = /<\/botoes\s*>/i;
    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    let ordem = 0;
    let restante = origem;

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
        const htmlBotoes = await processarComponente(
            "botao", conteudoBotoes, numeroLicao, index,
            { contexto: contextoBotoes, legadoNaTela: true }
        );
        const token = `__HTML_BOTOES_FECHAMENTO_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
        substituicoes.push({ token, html: htmlBotoes });
        resultado += token;
        restante = restante.slice(fim.index + fim[0].length);
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

async function protegerBotoesLegados(html, numeroLicao, index, contexto, limitarAoConteudoDaFace = false) {
    const origem = normalizarMarcadoresLegados(html);
    if (/<botoes\s*>/i.test(origem)) {
        return protegerBotoesComFechamento(origem, numeroLicao, index, contexto);
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

    const htmlBotao = await processarComponente(
        "botao",
        fragmentoBotao,
        numeroLicao,
        index,
        { contexto: contextoBotao, legadoNaTela: true }
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
async function protegerBotoesLegadosEmAbas(html, numeroLicao, index, contexto) {
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
        const htmlBotao = await processarComponente(
            "botao",
            fragmentoBotao,
            numeroLicao,
            index,
            { contexto: contextoBotao, legadoNaTela: true }
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
 * Extrai FLASHCARDs legados que aparecem dentro das janelas do ABAS.
 *
 * O limite do Flashcard é a próxima janela/aba principal do ABAS. Janelas
 * internas de BOTAO são ignoradas como limite, pois pertencem ao próprio
 * Flashcard. O conteúdo é processado pelo componente FLASHCARD normal.
 */
async function protegerFlashcardsLegadosEmAbas(html, numeroLicao, index, contexto) {
    const origem = normalizarMarcadoresLegados(html);
    const marcadorFlashcard = /<flashcard\s*>/gi;
    const substituicoes = [];
    let resultado = "";
    let cursor = 0;
    let marcador;
    let ordem = 0;

    while ((marcador = marcadorFlashcard.exec(origem)) !== null) {
        if (marcador.index < cursor) continue;

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

        const fim = limite ? limite.index : origem.length;
        resultado += origem.slice(cursor, marcador.index);

        ordem += 1;
        const fragmento = origem.slice(marcador.index + marcador[0].length, fim);
        const contextoFlashcard = `${contexto}.flashcard-legado-${ordem}`;
        const htmlFlashcard = await processarComponente(
            "flashcard",
            fragmento,
            numeroLicao,
            index,
            { contexto: contextoFlashcard, legadoNaTela: true }
        );

        const token = `__HTML_FLASHCARD_ABAS_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}_${ordem}__`;
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
 * Compatibilidade com <mininavegacao> legado em DOCX.
 * A extração mantém o texto anterior na Tela e delega as janelas ao componente.
 */
async function protegerMiniNavegacaoLegada(html, numeroLicao, index, contexto) {
    const origem = normalizarMarcadoresLegados(html);
    const marcador = /<mininavegacao\s*>/i.exec(origem);
    if (!marcador) return { conteudo: origem, restaurar: valor => valor };

    const prefixo = origem.slice(0, marcador.index);
    const fragmento = origem.slice(marcador.index);
    const htmlComponente = await processarComponente(
        "mininavegacao", fragmento, numeroLicao, index,
        { contexto: `${contexto}.mininavegacao-legada` }
    );
    const token = `__HTML_MININAVEGACAO_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}__`;
    return {
        conteudo: prefixo + token,
        restaurar(valor) {
            return String(valor || "").split(token).join(htmlComponente);
        }
    };
}

async function protegerAbasLegadas(html, numeroLicao, index, contexto) {
    const origem = normalizarMarcadoresLegados(html);
    const marcador = /<abas\s*>/i.exec(origem);

    if (!marcador) {
        return { conteudo: origem, restaurar: valor => valor };
    }

    const prefixo = origem.slice(0, marcador.index);
    const fragmento = origem.slice(marcador.index);
    const contextoAbas = `${contexto}.abas-legada`;

    const htmlAbas = await processarComponente(
        "abas",
        fragmento,
        numeroLicao,
        index,
        { contexto: contextoAbas }
    );

    const token = `__HTML_ABAS_LEGADA_${String(contexto).replace(/[^a-zA-Z0-9_-]/g, "_")}__`;
    return {
        conteudo: prefixo + token,
        restaurar(valor) {
            return String(valor || "").split(token).join(htmlAbas);
        }
    };
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
    const prefixo = origem.slice(0, inicio);
    const fragmento = origem
        .slice(inicio + marcador[0].length)
        .replace(/<\/flashcard\s*>/gi, "");

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
        conteudo: prefixo + token,
        restaurar(valor) {
            return String(valor || "").split(token).join(htmlFlashcard);
        }
    };
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

async function processarFilhos(html, numeroLicao, contexto) {
    const origem = normalizarWrappers(html);
    const nos = analisarWrappers(origem);
    if (!nos.length) return { conteudo: origem, restaurar: valor => valor };

    const substituicoes = [];
    let resultado = "";
    let cursor = 0;

    for (let i = 0; i < nos.length; i++) {
        const no = nos[i];
        resultado += origem.slice(cursor, no.inicioTag);
        const conteudoInterno = origem.slice(no.fimAbertura, no.fimConteudo);
        const contextoFilho = `${contexto}.${i + 1}`;
        const htmlFilho = await processarComponente(
            no.tipo, conteudoInterno, numeroLicao, contextoFilho,
            { contexto: contextoFilho }
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
    const filhos = await processarFilhos(conteudo, numeroLicao, contexto);

    // Extrai ABAS da Tela antes dos adaptadores legados, pois <janela>
    // também delimita os painéis do componente.
    const miniNavegacaoLegada = tipoNormalizado === "tela"
        ? await protegerMiniNavegacaoLegada(filhos.conteudo, numeroLicao, index, contexto)
        : { conteudo: filhos.conteudo, restaurar: valor => valor };

    const abasLegadas = tipoNormalizado === "tela"
        ? await protegerAbasLegadas(miniNavegacaoLegada.conteudo, numeroLicao, index, contexto)
        : { conteudo: miniNavegacaoLegada.conteudo, restaurar: valor => valor };

    const hotwordsLegadas = ["hotword"].includes(tipoNormalizado)
        ? { conteudo: abasLegadas.conteudo, restaurar: valor => valor }
        : await protegerHotwordsLegadas(
            abasLegadas.conteudo,
            numeroLicao,
            index,
            contexto,
        );

    // Primeiro isolamos o Flashcard legado na Tela. Isso impede que um
    // <botao> existente dentro de uma face seja capturado como se pertencesse
    // diretamente à Tela e consumisse todo o restante do conteúdo.
    const flashcardsLegados = tipoNormalizado === "tela"
        ? await protegerFlashcardsLegados(
            hotwordsLegadas.conteudo,
            numeroLicao,
            index,
            contexto
        )
        : ["abas", "mininavegacao"].includes(tipoNormalizado)
            ? await protegerFlashcardsLegadosEmAbas(
                hotwordsLegadas.conteudo,
                numeroLicao,
                index,
                contexto
            )
            : { conteudo: hotwordsLegadas.conteudo, restaurar: valor => valor };

    // Marcadores BOTAO/JANELA legados são delegados ao componente BOTAO em
    // qualquer componente-pai. O próprio BOTAO não reprocessa seus marcadores,
    // evitando recursão sobre a mesma estrutura. Assim, Flashcard, janelas e
    // demais componentes podem conter botões sem regras específicas por par.
    const botoesLegados = !["botao", "hotword"].includes(tipoNormalizado) && /<botoes\s*>/i.test(flashcardsLegados.conteudo)
        ? await protegerBotoesComFechamento(
            flashcardsLegados.conteudo,
            numeroLicao,
            index,
            contexto
        )
        : ["abas", "mininavegacao"].includes(tipoNormalizado)
            ? await protegerBotoesLegadosEmAbas(
                flashcardsLegados.conteudo,
                numeroLicao,
                index,
                contexto
            )
            : !["botao", "hotword"].includes(tipoNormalizado)
                ? await protegerBotoesLegados(
                    flashcardsLegados.conteudo,
                    numeroLicao,
                    index,
                    contexto,
                    tipoNormalizado === "flashcard"
                )
                : { conteudo: flashcardsLegados.conteudo, restaurar: valor => valor };

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
        hotwordsLegadas.restaurar(
            flashcardsLegados.restaurar(
                botoesLegados.restaurar(
                    abasLegadas.restaurar(
                miniNavegacaoLegada.restaurar(html)
            )
                )
            )
        )
    );
}

function componenteExiste(tipo) {
    return typeof componentes[normalizarTipo(String(tipo || ""))] === "function";
}

module.exports = { processarComponente, analisarWrappers, componenteExiste, normalizarWrappers, normalizarMarcadoresLegados };
