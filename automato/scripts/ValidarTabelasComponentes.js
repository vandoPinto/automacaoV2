/**
 * Camada central de validação para componentes representados por tabelas.
 *
 * Para cadastrar um novo componente baseado em tabela, adicione sua definição
 * em DEFINICOES_TABELAS. A validação dos campos, das linhas vazias e das
 * quantidades permitidas permanece nesta camada compartilhada.
 */

function decodificarEntidades(texto) {
    const entidades = {
        nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
        atilde: "ã", aacute: "á", acirc: "â", agrave: "à", auml: "ä",
        etilde: "ẽ", eacute: "é", ecirc: "ê", euml: "ë",
        iacute: "í", icirc: "î", iuml: "ï",
        otilde: "õ", oacute: "ó", ocirc: "ô", ouml: "ö",
        uacute: "ú", ucirc: "û", uuml: "ü", ccedil: "ç",
        Atilde: "Ã", Aacute: "Á", Acirc: "Â", Agrave: "À", Auml: "Ä",
        Eacute: "É", Ecirc: "Ê", Iacute: "Í", Otilde: "Õ", Oacute: "Ó",
        Ocirc: "Ô", Uacute: "Ú", Ccedil: "Ç"
    };

    return String(texto || "").replace(/&(#x[\da-f]+|#\d+|[a-z][a-z\d]+);/gi, (entidade, codigo) => {
        if (codigo[0] === "#") {
            const hexadecimal = codigo[1]?.toLowerCase() === "x";
            const numero = Number.parseInt(codigo.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
            return Number.isFinite(numero) ? String.fromCodePoint(numero) : entidade;
        }
        return Object.prototype.hasOwnProperty.call(entidades, codigo) ? entidades[codigo] : entidade;
    });
}

function normalizarTextoHtml(html) {
    return decodificarEntidades(String(html || "")
        .replace(/<!--([\s\S]*?)-->/g, " ")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
        .replace(/<[^>]*>/g, " "))
        .replace(/\s+/g, " ")
        .trim();
}

function temConteudo(html) {
    return Boolean(
        normalizarTextoHtml(html) ||
        /<(?:img|picture|svg|video|canvas|object|iframe|audio)\b/i.test(String(html || ""))
    );
}

function normalizarIdentificador(texto) {
    return normalizarTextoHtml(texto)
        .replace(/\s+/g, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

/**
 * Definições declarativas dos componentes migrados para tabelas.
 *
 * campos: ordem esperada das células de cada linha de dados.
 * maxTabelasPorTela: limite estrutural opcional por tela.
 */
const DEFINICOES_TABELAS = Object.freeze({
    botoes: Object.freeze({
        chave: "botoes",
        nome: "BOTÕES",
        cabecalho: "botoes",
        campos: Object.freeze([
            Object.freeze({ chave: "nome", descricao: "nome do botão" }),
            Object.freeze({ chave: "janela", descricao: "conteúdo da janela" })
        ]),
        minLinhasPreenchidas: 1
    }),
    hotword: Object.freeze({
        chave: "hotword",
        nome: "HOTWORD",
        cabecalho: "hotword",
        campos: Object.freeze([
            Object.freeze({ chave: "expressao", descricao: "palavra ou expressão" }),
            Object.freeze({ chave: "explicacao", descricao: "explicação da expressão" })
        ]),
        minLinhasPreenchidas: 1
    }),
    abas: Object.freeze({
        chave: "abas",
        nome: "ABAS",
        cabecalho: "abas",
        campos: Object.freeze([
            Object.freeze({ chave: "rotulo", descricao: "título da aba" }),
            Object.freeze({ chave: "janela", descricao: "conteúdo da aba" })
        ]),
        minLinhasPreenchidas: 1
    }),
    flashcard: Object.freeze({
        chave: "flashcard",
        nome: "FLASHCARD",
        cabecalho: "flashcard",
        campos: Object.freeze([
            Object.freeze({ chave: "frente", descricao: "conteúdo da frente" }),
            Object.freeze({ chave: "verso", descricao: "conteúdo do verso" })
        ]),
        minLinhasPreenchidas: 1
    }),
    mininavegacao: Object.freeze({
        chave: "mininavegacao",
        nome: "MINI NAVEGAÇÃO",
        cabecalho: "mininavegação",
        campos: Object.freeze([
            Object.freeze({ chave: "janela", descricao: "conteúdo da etapa" })
        ]),
        minLinhasPreenchidas: 1
    }),
    sanfona: Object.freeze({
        chave: "sanfona",
        nome: "SANFONA",
        cabecalho: "sanfona",
        campos: Object.freeze([
            Object.freeze({ chave: "titulo", descricao: "título do painel" }),
            Object.freeze({ chave: "janela", descricao: "conteúdo do painel" })
        ]),
        minLinhasPreenchidas: 1
    }),
    jogomemoria: Object.freeze({
        chave: "jogomemoria",
        nome: "JOGO DA MEMÓRIA",
        cabecalho: "jogo da memória",
        campos: Object.freeze([
            Object.freeze({ chave: "carta1", descricao: "conteúdo da carta 1" }),
            Object.freeze({ chave: "carta2", descricao: "conteúdo da carta 2" }),
            Object.freeze({ chave: "feedback", descricao: "feedback do par" }),
            Object.freeze({ chave: "capa", descricao: "capa comum", obrigatorio: false, unicoPorTabela: true })
        ]),
        minLinhasPreenchidas: 1
    }),
    ligapontos: Object.freeze({
        chave: "ligapontos",
        nome: "LIGA PONTOS",
        cabecalho: "liga pontos",
        campos: Object.freeze([
            Object.freeze({ chave: "opcao", descricao: "opção" }),
            Object.freeze({ chave: "resposta", descricao: "resposta correspondente" }),
            Object.freeze({ chave: "feedbackCerto", descricao: "feedback de acerto", obrigatorio: false }),
            Object.freeze({ chave: "feedbackErrado", descricao: "feedback de erro", obrigatorio: false })
        ]),
        gruposLinha: Object.freeze([
            Object.freeze({ indices: Object.freeze([2, 3]) })
        ]),
        gruposTabela: Object.freeze([
            Object.freeze({
                indices: Object.freeze([2, 3]),
                quantidadeMinima: 1,
                quantidadeMaxima: 1,
                descricao: "os feedbacks de acerto e de erro juntos em uma única linha"
            })
        ]),
        minLinhasPreenchidas: 1
    }),
    opcoes: Object.freeze({
        chave: "opcoes",
        nome: "OPÇÕES",
        cabecalho: "opcoes",
        campos: Object.freeze([
            Object.freeze({ chave: "pergunta", descricao: "enunciado da questão", obrigatorio: false, unicoPorTabela: true }),
            Object.freeze({ chave: "alternativa", descricao: "texto da alternativa" }),
            Object.freeze({ chave: "correta", descricao: "marcação SIM ou NÃO da alternativa", valoresAceitos: Object.freeze(["sim", "nao"]) })
        ]),
        regrasValorTabela: Object.freeze([
            Object.freeze({
                indiceCampo: 2,
                valor: "sim",
                quantidadeMinima: 1,
                descricao: "marque SIM nas alternativas corretas e NÃO nas demais"
            })
        ]),
        minLinhasPreenchidas: 2
    }),
    verdadeirofalso: Object.freeze({
        chave: "verdadeirofalso",
        nome: "VERDADEIRO OU FALSO",
        cabecalho: "verdadeiro ou falso",
        aliasesCabecalho: Object.freeze(["v ou f", "v/f"]),
        campos: Object.freeze([
            Object.freeze({ chave: "resposta", descricao: "resposta esperada" }),
            Object.freeze({ chave: "frase", descricao: "frase da atividade" })
        ]),
        minLinhasPreenchidas: 1
    }),
    relacionarcolunas: Object.freeze({
        chave: "relacionarcolunas",
        nome: "RELACIONAR COLUNAS",
        cabecalho: "relacionar colunas",
        aliasesCabecalho: Object.freeze(["relacionar coluna"]),
        campos: Object.freeze([
            Object.freeze({ chave: "opcao", descricao: "item da primeira coluna" }),
            Object.freeze({ chave: "resposta", descricao: "item correspondente da segunda coluna" })
        ]),
        minLinhasPreenchidas: 1
    }),
    forca: Object.freeze({
        chave: "forca",
        nome: "FORCA",
        cabecalho: "forca",
        campos: Object.freeze([
            Object.freeze({ chave: "palavra", descricao: "palavra secreta" })
        ]),
        minLinhasPreenchidas: 1
    })
});

function obterDefinicaoTabela(chaveOuNome) {
    const identificador = normalizarIdentificador(chaveOuNome);
    return Object.values(DEFINICOES_TABELAS).find(definicao =>
        normalizarIdentificador(definicao.chave) === identificador ||
        normalizarIdentificador(definicao.nome) === identificador ||
        normalizarIdentificador(definicao.cabecalho) === identificador ||
        (definicao.aliasesCabecalho || []).some(alias => normalizarIdentificador(alias) === identificador)
    ) || null;
}

function identificarDefinicaoPorCabecalho(celulasCabecalho) {
    const valores = Array.isArray(celulasCabecalho) ? celulasCabecalho : [celulasCabecalho];
    const cabecalhos = valores.map(normalizarIdentificador);

    return Object.values(DEFINICOES_TABELAS).find(definicao =>
        cabecalhos.includes(normalizarIdentificador(definicao.cabecalho)) ||
        (definicao.aliasesCabecalho || []).some(alias => cabecalhos.includes(normalizarIdentificador(alias)))
    ) || null;
}

function textoIdentificador(html) {
    return normalizarTextoHtml(html).replace(/\s+/g, " ").trim();
}

function montarContexto(contexto = {}) {
    const topico = String(contexto.topico || contexto.nomeTopico || "Tópico não identificado").trim();
    const numeroTopicoInformado = contexto.numeroTopico;
    const numeroTopico = numeroTopicoInformado !== undefined &&
        numeroTopicoInformado !== null &&
        numeroTopicoInformado !== "" &&
        Number.isInteger(Number(numeroTopicoInformado))
        ? Number(numeroTopicoInformado)
        : null;
    const tela = contexto.tela === undefined || contexto.tela === null || contexto.tela === ""
        ? "tela não identificada"
        : `tela ${contexto.tela}`;
    return { topico, numeroTopico, tela };
}

function montarLocalizacao(contexto = {}) {
    const { topico, numeroTopico, tela } = montarContexto(contexto);
    if (numeroTopico !== null) {
        const nomeTopico = topico === "Tópico não identificado" ? "" : ` ("${topico}")`;
        return `a ${tela}, tópico ${numeroTopico}${nomeTopico}`;
    }
    return `o tópico "${topico}", ${tela}`;
}

function montarMensagemErro({ definicao, numeroLinha, camposAusentes = [], celulas, contexto, tipo = "campo" }) {
    const identificadorCampo = celulas?.[0] ? textoIdentificador(celulas[0]) : "";
    const segundoCampo = celulas?.[1] ? textoIdentificador(celulas[1]) : "";
    let referencia = "";

    if (definicao.chave === "botoes" && identificadorCampo) {
        referencia = ` O botão "${identificadorCampo}"`;
    } else if (definicao.chave === "hotword" && identificadorCampo) {
        referencia = ` A expressão "${identificadorCampo}"`;
    } else if (definicao.chave === "botoes" && segundoCampo) {
        referencia = ` O conteúdo informado (${segundoCampo})`;
    } else if (definicao.chave === "hotword" && segundoCampo) {
        referencia = ` A explicação informada (${segundoCampo})`;
    } else if (definicao.chave === "abas" && identificadorCampo) {
        referencia = ` A aba "${identificadorCampo}"`;
    } else if (definicao.chave === "abas" && segundoCampo) {
        referencia = ` O conteúdo da aba informado (${segundoCampo})`;
    } else if (definicao.chave === "flashcard" && identificadorCampo) {
        referencia = ` A frente do cartão (${identificadorCampo})`;
    } else if (definicao.chave === "flashcard" && segundoCampo) {
        referencia = ` O verso do cartão (${segundoCampo})`;
    } else if (definicao.chave === "sanfona" && identificadorCampo) {
        referencia = ` O painel "${identificadorCampo}"`;
    } else if (definicao.chave === "sanfona" && segundoCampo) {
        referencia = ` O conteúdo do painel informado (${segundoCampo})`;
    } else if (definicao.chave === "jogomemoria" && identificadorCampo) {
        referencia = ` A carta 1 do par (${identificadorCampo})`;
    } else if (definicao.chave === "jogomemoria" && segundoCampo) {
        referencia = ` A carta 2 do par (${segundoCampo})`;
    } else if (definicao.chave === "ligapontos" && identificadorCampo) {
        referencia = ` A opção "${identificadorCampo}"`;
    } else if (definicao.chave === "ligapontos" && segundoCampo) {
        referencia = ` A resposta informada (${segundoCampo})`;
    } else if (definicao.chave === "relacionarcolunas" && identificadorCampo) {
        referencia = ` O item "${identificadorCampo}"`;
    } else if (definicao.chave === "relacionarcolunas" && segundoCampo) {
        referencia = ` A correspondência informada (${segundoCampo})`;
    } else if (definicao.chave === "opcoes" && identificadorCampo) {
        referencia = ` A questão (${identificadorCampo})`;
    } else if (definicao.chave === "opcoes" && segundoCampo) {
        referencia = ` A alternativa informada (${segundoCampo})`;
    }

    const localizacao = montarLocalizacao(contexto);
    const campos = camposAusentes.map(campo => campo.descricao);
    const descricaoCampo = campos.length === 1
        ? campos[0]
        : `${campos.slice(0, -1).join(", ")} e ${campos[campos.length - 1]}`;
    const localLinha = numeroLinha ? `, linha ${numeroLinha} da tabela` : "";

    if (tipo === "minimo") {
        if ((definicao.minLinhasPreenchidas || 0) > 1) {
            return `Não foi possível processar ${localizacao}: a tabela do componente ${definicao.nome} precisa conter pelo menos ${definicao.minLinhasPreenchidas} linhas de dados válidas. Preencha todas as alternativas ou remova a tabela do documento Word.`;
        }
        return `Não foi possível processar ${localizacao}: a tabela do componente ${definicao.nome} não possui nenhuma linha de dados válida. Preencha ao menos uma linha com todos os campos ou remova a tabela do documento Word.`;
    }

    return `Não foi possível processar ${localizacao}: componente ${definicao.nome}${localLinha}.${referencia} está sem ${descricaoCampo}. Preencha o campo indicado ou remova essa linha da tabela no documento Word; cada linha precisa ter todos os campos obrigatórios preenchidos.`;
}

/**
 * Valida as linhas de dados de um componente de tabela.
 * Linhas completamente vazias são ignoradas; linhas parcialmente preenchidas
 * geram erros. Linhas válidas são devolvidas para o interpretador.
 */
function validarLinhasTabelaComponente(chaveOuNome, linhas, contexto = {}) {
    const definicao = typeof chaveOuNome === "object" && chaveOuNome
        ? chaveOuNome
        : obterDefinicaoTabela(chaveOuNome);

    if (!definicao) {
        throw new Error(`Não existe definição de validação para o componente de tabela "${chaveOuNome}".`);
    }

    const erros = [];
    const linhasValidas = [];
    let quantidadePreenchida = 0;
    const lista = Array.isArray(linhas) ? linhas : [];

    lista.forEach((celulasOriginais, indice) => {
        const celulas = Array.isArray(celulasOriginais) ? celulasOriginais : [];
        const preenchimentos = definicao.campos.map((_, indiceCampo) =>
            temConteudo(celulas[indiceCampo] || "")
        );

        // Uma linha inteiramente vazia é permitida e não interrompe a leitura.
        if (!preenchimentos.some(Boolean)) return;

        const indicesAusentes = new Set(definicao.campos
            .map((campo, indiceCampo) =>
                campo.obrigatorio !== false && !preenchimentos[indiceCampo]
                    ? indiceCampo
                    : null
            )
            .filter(indiceCampo => indiceCampo !== null));

        for (const grupo of definicao.gruposLinha || []) {
            const algumPreenchido = grupo.indices.some(indiceCampo => preenchimentos[indiceCampo]);
            if (!algumPreenchido) continue;
            grupo.indices.forEach(indiceCampo => {
                if (!preenchimentos[indiceCampo]) indicesAusentes.add(indiceCampo);
            });
        }

        const camposAusentes = [...indicesAusentes].map(indiceCampo => definicao.campos[indiceCampo]);
        if (camposAusentes.length) {
            const numeroLinha = indice + 2; // linha 1 é o cabeçalho da tabela
            const contextoMontado = montarContexto(contexto);
            erros.push({
                componente: definicao.nome,
                chaveComponente: definicao.chave,
                numeroLinha,
                camposAusentes,
                mensagem: montarMensagemErro({
                    definicao,
                    numeroLinha,
                    camposAusentes,
                    celulas,
                    contexto
                }),
                topico: contextoMontado.topico,
                numeroTopico: contextoMontado.numeroTopico,
                tela: contexto.tela ?? null
            });
            return;
        }

        const campoComValorInvalido = definicao.campos.find((campo, indiceCampo) => {
            if (!campo.valoresAceitos || !preenchimentos[indiceCampo]) return false;
            const valor = normalizarIdentificador(celulas[indiceCampo]);
            return !campo.valoresAceitos.some(aceito => normalizarIdentificador(aceito) === valor);
        });
        if (campoComValorInvalido) {
            const indiceCampo = definicao.campos.indexOf(campoComValorInvalido);
            const numeroLinha = indice + 2;
            const valoresAceitos = campoComValorInvalido.valoresAceitos
                .map(valor => valor.toUpperCase() === "NAO" ? "NÃO" : valor.toUpperCase())
                .join(" ou ");
            erros.push(criarErroRegraTabela(
                definicao,
                contexto,
                numeroLinha,
                `A coluna "${campoComValorInvalido.descricao}" aceita somente ${valoresAceitos}; o valor informado foi "${textoIdentificador(celulas[indiceCampo])}".`
            ));
            return;
        }

        quantidadePreenchida += 1;
        linhasValidas.push({ celulas, numeroLinha: indice + 2 });
    });

    if (
        quantidadePreenchida < (definicao.minLinhasPreenchidas || 0) &&
        erros.length === 0
    ) {
        const contextoMontado = montarContexto(contexto);
        erros.push({
            componente: definicao.nome,
            chaveComponente: definicao.chave,
            numeroLinha: null,
            camposAusentes: [],
            mensagem: montarMensagemErro({ definicao, contexto, tipo: "minimo" }),
            topico: contextoMontado.topico,
            numeroTopico: contextoMontado.numeroTopico,
            tela: contexto.tela ?? null
        });
    }

    // Alguns valores opcionais (por exemplo, a capa comum do JOGO DA MEMÓRIA)
    // só podem ser declarados uma vez na tabela.
    for (const [indiceCampo, campo] of definicao.campos.entries()) {
        if (!campo.unicoPorTabela) continue;
        const ocorrencias = linhasValidas.filter(({ celulas }) =>
            temConteudo(celulas[indiceCampo] || "")
        );
        for (const ocorrenciaDuplicada of ocorrencias.slice(1)) {
            erros.push(criarErroRegraTabela(
                definicao,
                contexto,
                ocorrenciaDuplicada.numeroLinha,
                `A coluna "${campo.descricao}" só pode ser preenchida em uma linha da tabela.`
            ));
        }
    }

    // Regras entre colunas permanecem na camada central. O interpretador só
    // recebe as linhas depois que cada grupo estrutural estiver válido.
    for (const grupo of definicao.gruposTabela || []) {
        const ocorrencias = linhasValidas.filter(({ celulas }) =>
            grupo.indices.every(indiceCampo => temConteudo(celulas[indiceCampo] || ""))
        );
        const ocorrenciasParciais = lista.some(celulasOriginais => {
            const celulas = Array.isArray(celulasOriginais) ? celulasOriginais : [];
            const preenchidos = grupo.indices.filter(indiceCampo =>
                temConteudo(celulas[indiceCampo] || "")
            ).length;
            return preenchidos > 0 && preenchidos < grupo.indices.length;
        });

        if (ocorrencias.length < grupo.quantidadeMinima && !ocorrenciasParciais) {
            erros.push(criarErroRegraTabela(
                definicao,
                contexto,
                null,
                `A tabela do componente ${definicao.nome} precisa conter ${grupo.descricao}.`
            ));
        }

        if (Number.isInteger(grupo.quantidadeMaxima) && ocorrencias.length > grupo.quantidadeMaxima) {
            for (const duplicada of ocorrencias.slice(grupo.quantidadeMaxima)) {
                erros.push(criarErroRegraTabela(
                    definicao,
                    contexto,
                    duplicada.numeroLinha,
                    `A tabela do componente ${definicao.nome} deve informar ${grupo.descricao}; os valores repetidos precisam ser removidos.`
                ));
            }
        }
    }

    // Regras de valores semânticos (por exemplo, ao menos uma alternativa correta)
    // também ficam centralizadas. São avaliadas quando os campos das linhas
    // estão válidos, para não ocultar os erros de preenchimento mais precisos.
    if (!erros.length) {
        for (const regra of definicao.regrasValorTabela || []) {
            const ocorrencias = linhasValidas.filter(({ celulas }) =>
                normalizarIdentificador(celulas[regra.indiceCampo] || "") ===
                normalizarIdentificador(regra.valor)
            );
            if (ocorrencias.length < regra.quantidadeMinima || ocorrencias.length > regra.quantidadeMaxima) {
                erros.push(criarErroRegraTabela(definicao, contexto, null, `Na tabela do componente ${definicao.nome}, ${regra.descricao}.`));
            }
        }
    }

    return { erros, linhasValidas };
}

/**
 * Lê as duas estruturas aceitas por OPÇÕES. O formato atual usa duas colunas
 * para alternativas e duas linhas mescladas no fim para os feedbacks; o
 * formato anterior, com três colunas, continua aceito.
 */
function validarLinhasTabelaOpcoes(linhas, contexto = {}) {
    const lista = Array.isArray(linhas) ? linhas : [];
    const formatoDuasColunas = lista.some(celulas =>
        Array.isArray(celulas) && (
            celulas.length === 2 ||
            (celulas.length === 1 && temConteudo(celulas[0] || ""))
        )
    );

    if (!formatoDuasColunas) {
        return {
            ...validarLinhasTabelaComponente("opcoes", lista, contexto),
            formatoDuasColunas: false,
            feedbackCerto: "",
            feedbackErrado: ""
        };
    }

    const linhasAlternativas = [];
    const linhasFeedback = [];
    const errosEstruturais = [];
    const definicao = obterDefinicaoTabela("opcoes");

    lista.forEach((celulasOriginais, indice) => {
        const celulas = Array.isArray(celulasOriginais) ? celulasOriginais : [];
        if (!celulas.some(celula => temConteudo(celula || ""))) return;

        if (celulas.length === 1) {
            linhasFeedback.push(celulas[0]);
            return;
        }

        if (celulas.length === 2) {
            linhasAlternativas.push(["", celulas[0] || "", celulas[1] || ""]);
            return;
        }

        errosEstruturais.push(criarErroRegraTabela(
            definicao,
            contexto,
            indice + 2,
            "A estrutura atual de OPÇÕES usa duas colunas para as alternativas e linhas mescladas para os feedbacks."
        ));
    });

    const validacaoAlternativas = validarLinhasTabelaComponente(
        definicao,
        linhasAlternativas,
        contexto
    );

    if (linhasFeedback.length !== 2) {
        errosEstruturais.push(criarErroRegraTabela(
            definicao,
            contexto,
            null,
            "Inclua duas linhas mescladas após as alternativas: primeiro o feedback de acerto e depois o feedback de erro."
        ));
    }

    return {
        erros: [...validacaoAlternativas.erros, ...errosEstruturais],
        linhasValidas: validacaoAlternativas.linhasValidas,
        formatoDuasColunas: true,
        feedbackCerto: linhasFeedback[0] || "",
        feedbackErrado: linhasFeedback[1] || ""
    };
}

/** A tabela tem resposta/frase em cada linha e duas linhas mescladas de feedback no fim. */
function validarLinhasTabelaVerdadeiroFalso(linhas, contexto = {}) {
    const lista = Array.isArray(linhas) ? linhas : [];
    const definicao = obterDefinicaoTabela("verdadeirofalso");
    const linhasDados = [];
    const linhasFeedback = [];
    const errosEstruturais = [];
    let encontrouFeedback = false;

    lista.forEach((celulasOriginais, indice) => {
        const celulas = Array.isArray(celulasOriginais) ? celulasOriginais : [];
        if (!celulas.some(celula => temConteudo(celula || ""))) {
            linhasDados.push([]);
            return;
        }

        if (celulas.length === 1) {
            encontrouFeedback = true;
            linhasFeedback.push(celulas[0]);
            linhasDados.push([]); // preserva o número de linha do documento para os erros abaixo
            return;
        }

        if (celulas.length === 2) {
            if (encontrouFeedback) {
                errosEstruturais.push(criarErroRegraTabela(
                    definicao,
                    contexto,
                    indice + 2,
                    "As linhas de feedback precisam ficar no fim da tabela, depois das frases e respostas."
                ));
            }
            linhasDados.push(celulas);
            return;
        }

        linhasDados.push([]);
        errosEstruturais.push(criarErroRegraTabela(
            definicao,
            contexto,
            indice + 2,
            "A tabela VERDADEIRO OU FALSO usa duas colunas para resposta esperada e frase, e linhas mescladas para os feedbacks."
        ));
    });

    if (linhasFeedback.length !== 2) {
        errosEstruturais.push(criarErroRegraTabela(
            definicao,
            contexto,
            null,
            "Inclua duas linhas mescladas depois das frases: primeiro o feedback de acerto e depois o feedback de erro."
        ));
    }

    const validacaoDados = validarLinhasTabelaComponente(definicao, linhasDados, contexto);
    return {
        erros: [...validacaoDados.erros, ...errosEstruturais],
        linhasValidas: validacaoDados.linhasValidas,
        feedbackCerto: linhasFeedback[0] || "",
        feedbackErrado: linhasFeedback[1] || ""
    };
}

/**
 * A tabela possui pares em duas colunas, uma linha mesclada para escolher
 * LETRA/NÚMERO e, ao final, os feedbacks de acerto e erro.
 */
function validarLinhasTabelaRelacionarColunas(linhas, contexto = {}) {
    const lista = Array.isArray(linhas) ? linhas : [];
    const definicao = obterDefinicaoTabela("relacionarcolunas");
    const linhasDados = [];
    const linhasUnicas = [];
    const errosEstruturais = [];
    let encontrouConfiguracao = false;
    let encontrouFeedback = false;
    let modo = "letra";

    lista.forEach((celulasOriginais, indice) => {
        const celulas = Array.isArray(celulasOriginais) ? celulasOriginais : [];
        if (!celulas.some(celula => temConteudo(celula || ""))) {
            linhasDados.push([]);
            return;
        }

        if (celulas.length === 2) {
            if (encontrouConfiguracao || encontrouFeedback) {
                errosEstruturais.push(criarErroRegraTabela(
                    definicao,
                    contexto,
                    indice + 2,
                    "Os pares precisam vir antes da escolha do formato e dos feedbacks."
                ));
            }
            linhasDados.push(celulas);
            return;
        }

        if (celulas.length !== 1) {
            linhasDados.push([]);
            errosEstruturais.push(criarErroRegraTabela(
                definicao,
                contexto,
                indice + 2,
                "A tabela RELACIONAR COLUNAS usa duas colunas para os pares e linhas mescladas para formato e feedbacks."
            ));
            return;
        }

        const valor = normalizarIdentificador(celulas[0] || "");
        const modoReconhecido = /^(letra|letras|numero|numeros|letraounumero|letraounumeros|a,b,c|1,2,3|a,b,cou1,2,3)$/.test(valor);
        if (!encontrouConfiguracao && !encontrouFeedback && modoReconhecido) {
            encontrouConfiguracao = true;
            modo = /^(numero|numeros|1,2,3)$/.test(valor) ? "numero" : "letra";
            linhasUnicas.push({ tipo: "modo", valor: celulas[0], numeroLinha: indice + 2 });
            linhasDados.push([]);
            return;
        }

        encontrouFeedback = true;
        linhasUnicas.push({ tipo: "feedback", valor: celulas[0], numeroLinha: indice + 2 });
        linhasDados.push([]);
    });

    if (!encontrouConfiguracao) {
        errosEstruturais.push(criarErroRegraTabela(
            definicao,
            contexto,
            null,
            "Inclua uma linha mesclada com A, B, C ou 1, 2, 3 antes dos dois feedbacks."
        ));
    }

    const feedbacks = linhasUnicas.filter(linha => linha.tipo === "feedback");
    if (feedbacks.length !== 2) {
        errosEstruturais.push(criarErroRegraTabela(
            definicao,
            contexto,
            null,
            "Inclua duas linhas mescladas depois dos pares: primeiro o feedback de acerto e depois o feedback de erro."
        ));
    }

    const validacaoDados = validarLinhasTabelaComponente(definicao, linhasDados, contexto);
    return {
        erros: [...validacaoDados.erros, ...errosEstruturais],
        linhasValidas: validacaoDados.linhasValidas,
        modo,
        feedbackCerto: feedbacks[0]?.valor || "",
        feedbackErrado: feedbacks[1]?.valor || ""
    };
}

/** A tabela FORCA usa quatro linhas mescladas: palavra, dica e dois feedbacks. */
function validarLinhasTabelaForca(linhas, contexto = {}) {
    const lista = Array.isArray(linhas) ? linhas : [];
    const definicao = obterDefinicaoTabela("forca");
    const erros = [];
    const papeis = ["palavra secreta", "dica", "feedback de acerto", "feedback de erro"];
    const registros = [...lista];
    while (registros.length && !(registros[registros.length - 1] || []).some(celula => temConteudo(celula || ""))) {
        registros.pop();
    }

    if (registros.length < papeis.length) {
        erros.push(criarErroRegraTabela(
            definicao,
            contexto,
            null,
            "A tabela FORCA precisa ter quatro linhas mescladas, nesta ordem: palavra, dica, feedback de acerto e feedback de erro."
        ));
    }

    registros.forEach((celulasOriginais, indice) => {
        const celulas = Array.isArray(celulasOriginais) ? celulasOriginais : [];
        if (indice >= papeis.length) {
            if (!celulas.some(celula => temConteudo(celula || ""))) return;
            erros.push(criarErroRegraTabela(
                definicao,
                contexto,
                indice + 2,
                "Depois das quatro linhas da atividade, remova as linhas extras preenchidas."
            ));
            return;
        }
        if (celulas.length !== 1) {
            erros.push(criarErroRegraTabela(
                definicao,
                contexto,
                indice + 2,
                `A linha de ${papeis[indice]} precisa estar mesclada em uma única célula.`
            ));
            return;
        }
        if (indice !== 1 && !temConteudo(celulas[0] || "")) {
            erros.push(criarErroRegraTabela(
                definicao,
                contexto,
                indice + 2,
                `Preencha a linha de ${papeis[indice]}.`
            ));
        }
    });

    // A dica pode ficar vazia, mas a linha deve permanecer no segundo lugar
    // para que a leitura das linhas de feedback não fique ambígua.
    const primeiraLinha = Array.isArray(registros[0]) ? registros[0] : [];
    const palavra = primeiraLinha[0] || "";
    if (temConteudo(palavra) && !/[\p{L}]/u.test(normalizarTextoHtml(palavra))) {
        erros.push(criarErroRegraTabela(definicao, contexto, 2, "A palavra secreta precisa conter ao menos uma letra."));
    }

    return {
        erros,
        palavra,
        dica: Array.isArray(registros[1]) ? registros[1][0] || "" : "",
        feedbackCerto: Array.isArray(registros[2]) ? registros[2][0] || "" : "",
        feedbackErrado: Array.isArray(registros[3]) ? registros[3][0] || "" : ""
    };
}

function criarErroRegraTabela(definicao, contexto, numeroLinha, detalhe) {
    const contextoMontado = montarContexto(contexto);
    const localizacao = montarLocalizacao(contexto);
    const localLinha = numeroLinha ? `, linha ${numeroLinha} da tabela` : "";
    const mensagem = `Não foi possível processar ${localizacao}: componente ${definicao.nome}${localLinha}. ${detalhe} Corrija a tabela no documento Word.`;

    return {
        componente: definicao.nome,
        chaveComponente: definicao.chave,
        numeroLinha: numeroLinha ?? null,
        camposAusentes: [],
        mensagem,
        topico: contextoMontado.topico,
        numeroTopico: contextoMontado.numeroTopico,
        tela: contexto.tela ?? null
    };
}

/**
 * Valida uma restrição de quantidade definida pelo cadastro do componente.
 * Também centraliza regras estruturais que não pertencem ao interpretador.
 */
function validarQuantidadeTabelasPorTela(chaveOuNome, quantidade, contexto = {}) {
    const definicao = typeof chaveOuNome === "object" && chaveOuNome
        ? chaveOuNome
        : obterDefinicaoTabela(chaveOuNome);

    if (!definicao || !Number.isInteger(definicao.maxTabelasPorTela)) return [];
    if (quantidade <= definicao.maxTabelasPorTela) return [];

    const contextoMontado = montarContexto(contexto);
    const localizacao = montarLocalizacao(contexto);
    return [{
        componente: definicao.nome,
        chaveComponente: definicao.chave,
        numeroLinha: null,
        camposAusentes: [],
        topico: contextoMontado.topico,
        numeroTopico: contextoMontado.numeroTopico,
        tela: contexto.tela ?? null,
        mensagem: `Não foi possível processar ${localizacao}: foram encontradas ${quantidade} tabelas do componente ${definicao.nome} na mesma tela, mas o limite permitido é ${definicao.maxTabelasPorTela}. Reúna os registros em uma única tabela no documento Word.`
    }];
}

function criarErroValidacaoTabelas(erros) {
    const lista = Array.isArray(erros) ? erros : [];
    if (!lista.length) return null;

    const mensagens = lista.map((erro, indice) => `${indice + 1}. ${erro.mensagem}`);
    const mensagem = `Foram encontrados ${lista.length} problema(s) nas tabelas de componentes:\n${mensagens.join("\n")}`;
    const erro = new Error(mensagem);
    erro.name = "ErroValidacaoTabelas";
    erro.publicMessage = mensagem;
    erro.erros = lista;
    return erro;
}

module.exports = {
    DEFINICOES_TABELAS,
    decodificarEntidades,
    normalizarTextoHtml,
    temConteudo,
    normalizarIdentificador,
    obterDefinicaoTabela,
    identificarDefinicaoPorCabecalho,
    validarLinhasTabelaComponente,
    validarLinhasTabelaOpcoes,
    validarLinhasTabelaVerdadeiroFalso,
    validarLinhasTabelaRelacionarColunas,
    validarLinhasTabelaForca,
    validarQuantidadeTabelasPorTela,
    criarErroValidacaoTabelas
};
