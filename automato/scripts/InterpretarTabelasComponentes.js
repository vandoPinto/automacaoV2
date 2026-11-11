/**
 * Interpreta modelos de componentes representados por tabelas no roteiro.
 *
 * A validação de preenchimento é delegada exclusivamente a
 * ValidarTabelasComponentes.js. Este módulo fica responsável por reconhecer a
 * tabela e convertê-la para os marcadores internos dos componentes existentes.
 */

const {
    identificarDefinicaoPorCabecalho,
    validarLinhasTabelaComponente,
    validarLinhasTabelaOpcoes,
    validarLinhasTabelaVerdadeiroFalso,
    validarLinhasTabelaRelacionarColunas,
    validarLinhasTabelaForca,
    validarQuantidadeTabelasPorTela,
    criarErroValidacaoTabelas,
    normalizarIdentificador,
    temConteudo
} = require("./ValidarTabelasComponentes");

/**
 * Extrai apenas as linhas e células pertencentes diretamente à tabela informada.
 * Linhas de tabelas aninhadas são ignoradas, mas seu HTML permanece na célula pai.
 */
function extrairLinhasDiretas(htmlTabela) {
    const html = String(htmlTabela || "");
    const regex = /<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b[^>]*>/gi;
    const linhas = [];
    const profundidadeAlvo = /^\s*<table\b/i.test(html) ? 1 : 0;
    let profundidadeTabela = 0;
    let linhaAtual = null;
    let inicioCelula = null;
    let match;

    while ((match = regex.exec(html))) {
        const token = match[0];
        const tag = match[1]?.toLowerCase();
        if (!tag) continue;

        const fechamento = /^<\s*\//.test(token);
        const autoFechamento = /\/\s*>$/.test(token);

        if (tag === "table") {
            if (fechamento) profundidadeTabela = Math.max(0, profundidadeTabela - 1);
            else profundidadeTabela += 1;
            continue;
        }

        if (profundidadeTabela !== profundidadeAlvo) continue;

        if (tag === "tr") {
            if (!fechamento) {
                linhaAtual = { celulas: [] };
                inicioCelula = null;
            } else if (linhaAtual) {
                linhas.push(linhaAtual.celulas);
                linhaAtual = null;
                inicioCelula = null;
            }
            continue;
        }

        if (!linhaAtual || !["td", "th"].includes(tag)) continue;

        if (!fechamento && !autoFechamento && inicioCelula === null) {
            inicioCelula = { tag, inicio: regex.lastIndex };
        } else if (fechamento && inicioCelula && inicioCelula.tag === tag) {
            linhaAtual.celulas.push(html.slice(inicioCelula.inicio, match.index));
            inicioCelula = null;
        }
    }

    return linhas;
}

/** Localiza todos os blocos TABLE, incluindo tabelas aninhadas, por offsets. */
function localizarTabelas(html) {
    const origem = String(html || "");
    const regex = /<!--[\s\S]*?-->|<\/?table\b[^>]*>/gi;
    const pilha = [];
    const blocos = [];
    let match;

    while ((match = regex.exec(origem))) {
        if (!/^<\/?table\b/i.test(match[0])) continue;
        if (/^<\s*\//.test(match[0])) {
            const inicio = pilha.pop();
            if (inicio !== undefined) blocos.push({ inicio, fim: regex.lastIndex });
        } else {
            pilha.push(match.index);
        }
    }

    return blocos.sort((a, b) => a.inicio - b.inicio || b.fim - a.fim);
}

function analisarTabelaComponente(htmlTabela) {
    const linhas = extrairLinhasDiretas(htmlTabela);
    if (linhas.length < 1) return null;

    const definicao = identificarDefinicaoPorCabecalho(linhas[0]);
    if (!definicao) return null;

    return { definicao, linhas };
}

function validarTabelaReconhecida(analise, contexto = {}) {
    if (analise.definicao.chave === "opcoes") {
        return validarLinhasTabelaOpcoes(analise.linhas.slice(1), contexto);
    }
    if (analise.definicao.chave === "verdadeirofalso") {
        return validarLinhasTabelaVerdadeiroFalso(analise.linhas.slice(1), contexto);
    }
    if (analise.definicao.chave === "relacionarcolunas") {
        return validarLinhasTabelaRelacionarColunas(analise.linhas.slice(1), contexto);
    }
    if (analise.definicao.chave === "forca") {
        return validarLinhasTabelaForca(analise.linhas.slice(1), contexto);
    }

    return validarLinhasTabelaComponente(
        analise.definicao,
        analise.linhas.slice(1),
        contexto
    );
}

/**
 * Executa as validações centrais de todas as tabelas de componentes de uma tela.
 * Retorna todas as ocorrências inválidas sem interromper no primeiro erro.
 */
function validarTabelasComponentes(html, contexto = {}) {
    const origem = String(html || "");
    const blocos = localizarTabelas(origem);
    const erros = [];
    const quantidades = new Map();

    function visitar(no, dentroDeComponente = false) {
        const analise = analisarTabelaComponente(origem.slice(no.inicio, no.fim));
        const eComponente = Boolean(analise);

        if (analise) {
            const { definicao } = analise;
            // Limites por tela valem para componentes no nível da tela. Tabelas
            // dentro de uma área de conteúdo pertencem ao componente pai e não
            // devem consumir o limite reservado ao uso independente.
            if (!dentroDeComponente) {
                quantidades.set(definicao.chave, (quantidades.get(definicao.chave) || 0) + 1);
            }
            erros.push(...validarTabelaReconhecida(analise, contexto).erros);
        }

        for (const filho of no.filhos) {
            visitar(filho, dentroDeComponente || eComponente);
        }
    }

    montarArvoreTabelas(blocos).forEach(no => visitar(no));

    for (const [chave, quantidade] of quantidades) {
        erros.push(...validarQuantidadeTabelasPorTela(chave, quantidade, contexto));
    }

    return erros;
}

function interpretarTabelaBotoes(htmlTabela, contexto = {}) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise || analise.definicao.chave !== "botoes") return null;

    const validacao = validarTabelaReconhecida(analise, contexto);
    const erro = criarErroValidacaoTabelas(validacao.erros);
    if (erro) throw erro;

    const pares = validacao.linhasValidas.map(({ celulas }) => ({
        rotulo: (celulas[0] || "").trim(),
        janela: (celulas[1] || "").trim()
    }));

    const paresHTML = pares
        .map(par => `<botao>${par.rotulo}</botao><janela>${par.janela}</janela>`)
        .join("");

    // Wrapper indispensável para impedir que o adaptador de BOTÕES absorva o
    // texto que aparece depois da tabela.
    return `<botoes>${paresHTML}</botoes>`;
}

/**
 * Interpreta a tabela HOTWORD. A primeira coluna contém palavra/expressão e a
 * segunda a explicação exibida na janela.
 */
function interpretarTabelaHotword(htmlTabela, contexto = {}) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise || analise.definicao.chave !== "hotword") return null;

    const validacao = validarTabelaReconhecida(analise, contexto);
    const erro = criarErroValidacaoTabelas(validacao.erros);
    if (erro) throw erro;

    return validacao.linhasValidas
        .map(({ celulas }) =>
            `<hotword>${(celulas[0] || "").trim()}<janela>${(celulas[1] || "").trim()}</hotword>`
        )
        .join("");
}

/**
 * Interpreta cada linha da tabela ABAS como um par título/conteúdo e reutiliza
 * o componente existente, que continua responsável pela apresentação e pelas
 * interações das abas.
 */
function interpretarTabelaAbas(htmlTabela, contexto = {}) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise || analise.definicao.chave !== "abas") return null;

    const validacao = validarTabelaReconhecida(analise, contexto);
    const erro = criarErroValidacaoTabelas(validacao.erros);
    if (erro) throw erro;

    const pares = validacao.linhasValidas.map(({ celulas }) => ({
        rotulo: (celulas[0] || "").trim(),
        janela: (celulas[1] || "").trim()
    }));

    // O componente ABAS e o extrator de áudios legados esperam primeiro todos
    // os marcadores <aba> e depois todos os marcadores <janela>. Os índices
    // pareados preservam a correspondência entre as duas colunas da tabela.
    const rotulos = pares.map(par => `<aba>${par.rotulo}`).join("");
    const janelas = pares.map(par => `<janela>${par.janela}`).join("");
    return `<abas>${rotulos}${janelas}</abas>`;
}

/**
 * Converte cada linha da tabela FLASHCARD em um cartão frente/verso. Os
 * marcadores ficam no formato legado para reaproveitar a renderização, a
 * interação de virar o cartão e a extração de áudio já existentes.
 */
function interpretarTabelaFlashcard(htmlTabela, contexto = {}) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise || analise.definicao.chave !== "flashcard") return null;

    const validacao = validarTabelaReconhecida(analise, contexto);
    const erro = criarErroValidacaoTabelas(validacao.erros);
    if (erro) throw erro;

    const cartoes = validacao.linhasValidas.map(({ celulas }) =>
        `<frente>${(celulas[0] || "").trim()}<verso>${(celulas[1] || "").trim()}`
    ).join("");

    return `<flashcard>${cartoes}</flashcard>`;
}

function validarEObterLinhas(htmlTabela, chave, contexto) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise || analise.definicao.chave !== chave) return null;

    const validacao = validarTabelaReconhecida(analise, contexto);
    const erro = criarErroValidacaoTabelas(validacao.erros);
    if (erro) throw erro;
    return validacao.linhasValidas;
}

/** Cada linha da MINI NAVEGAÇÃO representa uma etapa/painel. */
function interpretarTabelaMiniNavegacao(htmlTabela, contexto = {}) {
    const linhas = validarEObterLinhas(htmlTabela, "mininavegacao", contexto);
    if (linhas === null) return null;

    const janelas = linhas.map(({ celulas }) => `<janela>${(celulas[0] || "").trim()}`).join("");
    return `<mininavegacao>${janelas}</mininavegacao>`;
}

/** Cada linha da SANFONA define o título e o conteúdo de um painel. */
function interpretarTabelaSanfona(htmlTabela, contexto = {}) {
    const linhas = validarEObterLinhas(htmlTabela, "sanfona", contexto);
    if (linhas === null) return null;

    const paineis = linhas.map(({ celulas }) =>
        `<botao>${(celulas[0] || "").trim()}<janela>${(celulas[1] || "").trim()}`
    ).join("");
    return `<sanfona>${paineis}</sanfona>`;
}

/** Cada linha do JOGO DA MEMÓRIA define duas cartas e o feedback do par. */
function interpretarTabelaJogoMemoria(htmlTabela, contexto = {}) {
    const linhas = validarEObterLinhas(htmlTabela, "jogomemoria", contexto);
    if (linhas === null) return null;

    const capa = linhas.find(({ celulas }) => String(celulas[3] || "").trim())?.celulas[3];
    const marcadorCapa = capa ? `<frente>${String(capa).trim()}` : "";
    const pares = linhas.map(({ celulas }) =>
        `<carta1>${(celulas[0] || "").trim()}<carta2>${(celulas[1] || "").trim()}<feedback>${(celulas[2] || "").trim()}`
    ).join("");

    return `<jogomemoria>${marcadorCapa}${pares}</jogomemoria>`;
}

/** Pares ocupam as duas primeiras colunas; os feedbacks globais ficam juntos em uma linha. */
function interpretarTabelaLigaPontos(htmlTabela, contexto = {}) {
    const linhas = validarEObterLinhas(htmlTabela, "ligapontos", contexto);
    if (linhas === null) return null;

    const linhaFeedback = linhas.find(({ celulas }) =>
        String(celulas[2] || "").trim() && String(celulas[3] || "").trim()
    );
    const pares = linhas.map(({ celulas }) =>
        `<opcao>${(celulas[0] || "").trim()}<resposta>${(celulas[1] || "").trim()}`
    ).join("");

    return `<ligapontos>${pares}<feedcerto>${String(linhaFeedback?.celulas[2] || "").trim()}` +
        `<feederrado>${String(linhaFeedback?.celulas[3] || "").trim()}</ligapontos>`;
}

/** Cada tabela OPÇÕES descreve alternativas e feedbacks; o enunciado permanece como texto fora do componente. */
function interpretarTabelaOpcoes(htmlTabela, contexto = {}) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise || analise.definicao.chave !== "opcoes") return null;

    const validacao = validarTabelaReconhecida(analise, contexto);
    const erro = criarErroValidacaoTabelas(validacao.erros);
    if (erro) throw erro;

    const alternativas = validacao.linhasValidas.map(({ celulas }) => {
        const texto = String(celulas[1] || "").trim();
        const correta = normalizarIdentificador(celulas[2]) === "sim" ? "SIM" : "NÃO";
        return `<alternativa>${texto}<correta>${correta}`;
    }).join("");
    const feedbackCerto = validacao.feedbackCerto || "Correto! Você acertou.";
    const feedbackErrado = validacao.feedbackErrado || "Não foi dessa vez. Tente novamente.";

    return `<componente tipo="opcoes">${alternativas}` +
        `<feedcerto>${String(feedbackCerto).trim()}</feedcerto>` +
        `<feederrado>${String(feedbackErrado).trim()}</feederrado></componente>`;
}

/** Converte as colunas resposta/frase e os dois feedbacks em marcadores do componente. */
function interpretarTabelaVerdadeiroFalso(htmlTabela, contexto = {}) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise || analise.definicao.chave !== "verdadeirofalso") return null;

    const validacao = validarTabelaReconhecida(analise, contexto);
    const erro = criarErroValidacaoTabelas(validacao.erros);
    if (erro) throw erro;

    const frases = validacao.linhasValidas.map(({ celulas }) =>
        `<alternativa>${String(celulas[1] || "").trim()}<correta>${String(celulas[0] || "").trim()}</correta></alternativa>`
    ).join("");
    const feedbackCerto = String(validacao.feedbackCerto || "Parabéns, é isso mesmo!").trim();
    const feedbackErrado = String(validacao.feedbackErrado || "Tente novamente, você consegue.").trim();

    return `<componente tipo="verdadeirofalso">${frases}` +
        `<feedcerto>${feedbackCerto}</feedcerto><feederrado>${feedbackErrado}</feederrado></componente>`;
}

/** Converte pares, formato dos identificadores e feedbacks da tabela RELACIONAR COLUNAS. */
function interpretarTabelaRelacionarColunas(htmlTabela, contexto = {}) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise || analise.definicao.chave !== "relacionarcolunas") return null;

    const validacao = validarLinhasTabelaRelacionarColunas(analise.linhas.slice(1), contexto);
    const erro = criarErroValidacaoTabelas(validacao.erros);
    if (erro) throw erro;

    const pares = validacao.linhasValidas.map(({ celulas }) =>
        `<opcao>${String(celulas[0] || "").trim()}<resposta>${String(celulas[1] || "").trim()}`
    ).join("");
    const feedbackCerto = String(validacao.feedbackCerto || "Parabéns, é isso mesmo!").trim();
    const feedbackErrado = String(validacao.feedbackErrado || "Tente novamente, você consegue.").trim();

    return `<componente tipo="relacionarcolunas"><modo>${validacao.modo}</modo>${pares}` +
        `<feedcerto>${feedbackCerto}</feedcerto><feederrado>${feedbackErrado}</feederrado></componente>`;
}

/** Converte as quatro linhas mescladas da tabela FORCA em dados do jogo. */
function interpretarTabelaForca(htmlTabela, contexto = {}) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise || analise.definicao.chave !== "forca") return null;

    const validacao = validarLinhasTabelaForca(analise.linhas.slice(1), contexto);
    const erro = criarErroValidacaoTabelas(validacao.erros);
    if (erro) throw erro;

    return `<componente tipo="forca"><palavra>${String(validacao.palavra || "").trim()}</palavra>` +
        `<dica>${String(validacao.dica || "").trim()}</dica>` +
        `<feedcerto>${String(validacao.feedbackCerto || "Muito bem! Você descobriu a palavra!").trim()}</feedcerto>` +
        `<feederrado>${String(validacao.feedbackErrado || "Tente novamente, você consegue.").trim()}</feederrado></componente>`;
}

function interpretarTabelaReconhecida(htmlTabela, contexto = {}) {
    const analise = analisarTabelaComponente(htmlTabela);
    if (!analise) return null;

    const interpretadores = {
        botoes: interpretarTabelaBotoes,
        hotword: interpretarTabelaHotword,
        abas: interpretarTabelaAbas,
        flashcard: interpretarTabelaFlashcard,
        mininavegacao: interpretarTabelaMiniNavegacao,
        sanfona: interpretarTabelaSanfona,
        jogomemoria: interpretarTabelaJogoMemoria,
        ligapontos: interpretarTabelaLigaPontos,
        verdadeirofalso: interpretarTabelaVerdadeiroFalso,
        forca: interpretarTabelaForca,
        relacionarcolunas: interpretarTabelaRelacionarColunas,
        opcoes: interpretarTabelaOpcoes
    };
    const interpretar = interpretadores[analise.definicao.chave];
    if (!interpretar) return null;

    const marcadores = interpretar(htmlTabela, contexto);
    return marcadores === null
        ? null
        : { chave: analise.definicao.chave, marcadores };
}

/** Organiza os offsets em uma árvore para reconstruir as tabelas de dentro para fora. */
function montarArvoreTabelas(blocos) {
    const raizes = [];
    const pilha = [];

    for (const bloco of blocos) {
        const no = { ...bloco, filhos: [] };
        while (pilha.length && no.inicio >= pilha[pilha.length - 1].fim) pilha.pop();
        if (pilha.length) pilha[pilha.length - 1].filhos.push(no);
        else raizes.push(no);
        pilha.push(no);
    }

    return raizes;
}

function interpretarTabelasComponentes(html, contexto = {}) {
    const origem = String(html || "");
    const errosValidacao = validarTabelasComponentes(origem, contexto);
    const erroValidacao = criarErroValidacaoTabelas(errosValidacao);
    if (erroValidacao) throw erroValidacao;

    const arvores = montarArvoreTabelas(localizarTabelas(origem));
    const hotwordsDeNivelRaiz = [];
    let sequenciaToken = 0;

    function transformarNo(no, dentroDeComponente) {
        const htmlOriginal = origem.slice(no.inicio, no.fim);
        const analiseOriginal = analisarTabelaComponente(htmlOriginal);
        const eComponenteReconhecido = Boolean(analiseOriginal);
        let tabelaReconstruida = "";
        let cursor = no.inicio;

        for (const filho of no.filhos) {
            tabelaReconstruida += origem.slice(cursor, filho.inicio);
            tabelaReconstruida += transformarNo(
                filho,
                dentroDeComponente || eComponenteReconhecido
            );
            cursor = filho.fim;
        }
        tabelaReconstruida += origem.slice(cursor, no.fim);

        const componente = interpretarTabelaReconhecida(tabelaReconstruida, contexto);
        if (!componente) return tabelaReconstruida;

        if (componente.chave === "hotword") {
            // HOTWORD em uma janela herda o escopo do componente que a contém.
            // No nível da tela, preserva o comportamento legado que envolve o
            // texto anterior à tabela junto com as expressões e explicações.
            if (dentroDeComponente) return componente.marcadores;

            sequenciaToken += 1;
            const token = `__AUTOMATO_TABELA_HOTWORD_${sequenciaToken}__`;
            hotwordsDeNivelRaiz.push({ token, marcadores: componente.marcadores });
            return token;
        }

        return componente.marcadores;
    }

    let resultado = "";
    let cursor = 0;
    for (const raiz of arvores) {
        resultado += origem.slice(cursor, raiz.inicio);
        resultado += transformarNo(raiz, false);
        cursor = raiz.fim;
    }
    resultado += origem.slice(cursor);

    // Cada tabela HOTWORD de nível raiz fica associada ao texto que aparece
    // desde a tabela anterior. Assim, várias tabelas na mesma tela preservam
    // seus contextos e cada instância destaca apenas a expressão correspondente.
    if (hotwordsDeNivelRaiz.length) {
        let cursorHotword = 0;
        let resultadoComHotwords = "";

        for (const hotword of hotwordsDeNivelRaiz) {
            const posicaoHotword = resultado.indexOf(hotword.token, cursorHotword);
            if (posicaoHotword < 0) continue;

            const textoAnterior = resultado.slice(cursorHotword, posicaoHotword);
            resultadoComHotwords +=
                `<componente tipo="hotword">${textoAnterior}${hotword.marcadores}</componente>`;
            cursorHotword = posicaoHotword + hotword.token.length;
        }

        resultado = resultadoComHotwords + resultado.slice(cursorHotword);
    }

    return resultado;
}

module.exports = {
    interpretarTabelasComponentes,
    interpretarTabelaBotoes,
    interpretarTabelaHotword,
    interpretarTabelaAbas,
    interpretarTabelaFlashcard,
    interpretarTabelaMiniNavegacao,
    interpretarTabelaSanfona,
    interpretarTabelaJogoMemoria,
    interpretarTabelaLigaPontos,
    interpretarTabelaOpcoes,
    interpretarTabelaVerdadeiroFalso,
    interpretarTabelaRelacionarColunas,
    interpretarTabelaForca,
    validarTabelasComponentes,
    analisarTabelaComponente,
    localizarTabelas,
    extrairLinhasDiretas
};
