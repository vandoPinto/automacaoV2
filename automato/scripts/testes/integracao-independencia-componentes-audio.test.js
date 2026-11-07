const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const {
    processarRegiao,
    normalizarMarcadores
} = require("../ExtrairAudiosComponentes");

const TIPOS = [
    "sanfona",
    "abas",
    "mininavegacao",
    "flashcard",
    "botao",
    "hotword"
];

const MARCACAO_HTML = {
    sanfona: /class="sanfona-item"/g,
    abas: /class="abas-componente"/g,
    mininavegacao: /class="mini-nav-componente"/g,
    flashcard: /class="flashcard-componente"/g,
    botao: /class="botao-item"/g,
    hotword: /class="hotword-gatilho"/g
};

function criarComponente(tipo, conteudoInterno, token) {
    const textoInterno = `<p>CONTEUDO_${token}</p>${conteudoInterno}`;

    switch (tipo) {
        case "sanfona":
            return {
                html: `<componente tipo="sanfona"><botao>PAINEL_${token}</botao><janela>${textoInterno}</janela></componente>`,
                marcador: `PAINEL_${token}`
            };
        case "abas":
            return {
                html: `<componente tipo="abas"><aba>ABA_${token}</aba><janela>${textoInterno}</janela></componente>`,
                marcador: `ABA_${token}`
            };
        case "mininavegacao":
            return {
                html: `<componente tipo="mininavegacao"><janela>${textoInterno}</janela></componente>`,
                marcador: `CONTEUDO_${token}`
            };
        case "flashcard":
            return {
                html: `<componente tipo="flashcard"><p>&lt;frente&gt;</p><p>FRENTE_${token}</p><p>&lt;verso&gt;</p>${textoInterno}</componente>`,
                marcador: `FRENTE_${token}`
            };
        case "botao":
            return {
                html: `<componente tipo="botao"><botao>BOTAO_${token}</botao><janela>${textoInterno}</janela></componente>`,
                marcador: `BOTAO_${token}`
            };
        case "hotword":
            return {
                html: `<componente tipo="hotword"><p>O termo TERMO_${token} é importante.</p><hotword>TERMO_${token}</hotword><janela>${textoInterno}</janela></componente>`,
                marcador: `TERMO_${token}`
            };
        default:
            throw new Error(`Tipo de componente não previsto no teste: ${tipo}`);
    }
}

function criarComponenteComDuasJanelas(tipo, primeira, segunda) {
    switch (tipo) {
        case "sanfona":
            return `<componente tipo="sanfona"><botao>Painel A</botao><janela>${primeira}</janela><botao>Painel B</botao><janela>${segunda}</janela></componente>`;
        case "abas":
            return `<componente tipo="abas"><aba>Aba A</aba><janela>${primeira}</janela><aba>Aba B</aba><janela>${segunda}</janela></componente>`;
        case "mininavegacao":
            return `<componente tipo="mininavegacao"><janela>${primeira}</janela><janela>${segunda}</janela></componente>`;
        case "flashcard":
            return `<componente tipo="flashcard"><p>&lt;frente&gt;</p><p>Frente A</p><p>&lt;verso&gt;</p>${primeira}<p>&lt;frente&gt;</p><p>Frente B</p><p>&lt;verso&gt;</p>${segunda}</componente>`;
        case "botao":
            return `<componente tipo="botao"><botao>Botão A</botao><janela>${primeira}</janela><botao>Botão B</botao><janela>${segunda}</janela></componente>`;
        default:
            throw new Error(`O componente ${tipo} não possui duas janelas independentes neste formato de teste.`);
    }
}

function extrairIdsHTML(html) {
    return [...String(html || "").matchAll(/\bdata-audio-id=["']([^"']+)["']/gi)]
        .map(match => match[1]);
}

function extrairIdsJSON(roteiro) {
    return processarRegiao(normalizarMarcadores(roteiro)).audios
        .map(audio => audio.nomeSufixo);
}

function contar(html, regex) {
    return [...String(html || "").matchAll(regex)].length;
}

async function validarCaso(nome, roteiro, ocorrenciasEsperadas, quantidadeIdsEsperada) {
    const html = await processarComponente("tela", roteiro, 1, `independencia-${nome}`);
    const idsHTML = extrairIdsHTML(html);
    const idsJSON = extrairIdsJSON(roteiro);

    assert.deepStrictEqual(
        idsHTML,
        idsJSON,
        `${nome}: HTML e JSON divergiram.\nHTML: ${idsHTML.join(", ")}\nJSON: ${idsJSON.join(", ")}`
    );
    assert.deepStrictEqual(
        idsHTML.filter((id, indice) => idsHTML.indexOf(id) !== indice),
        [],
        `${nome}: há identificadores duplicados no HTML.`
    );
    assert.deepStrictEqual(
        idsJSON.filter((id, indice) => idsJSON.indexOf(id) !== indice),
        [],
        `${nome}: há identificadores duplicados no JSON.`
    );

    if (Number.isInteger(quantidadeIdsEsperada)) {
        assert.strictEqual(
            idsHTML.length,
            quantidadeIdsEsperada,
            `${nome}: quantidade inesperada de IDs no HTML.`
        );
    }

    for (const [tipo, quantidade] of Object.entries(ocorrenciasEsperadas)) {
        assert.strictEqual(
            contar(html, MARCACAO_HTML[tipo]),
            quantidade,
            `${nome}: o componente ${tipo.toUpperCase()} não foi preservado ${quantidade} vez(es) no HTML.`
        );
    }

    assert(
        html.includes("FIM_FORA_DOS_COMPONENTES"),
        `${nome}: o conteúdo posterior aos componentes foi perdido.`
    );

    return idsHTML.length;
}

function criarFlashcardLegado(token) {
    return `<flashcard><p>&lt;frente&gt;</p><p>FRENTE_LEGADA_${token}</p><p>&lt;verso&gt;</p><p>VERSO_LEGADO_${token}</p></flashcard>`;
}

function permutacoes(valores) {
    if (valores.length <= 1) return [valores];
    const resultado = [];
    for (let i = 0; i < valores.length; i++) {
        const atual = valores[i];
        const restantes = valores.filter((_, indice) => indice !== i);
        for (const sufixo of permutacoes(restantes)) {
            resultado.push([atual, ...sufixo]);
        }
    }
    return resultado;
}

async function executar() {
    let quantidadeCasos = 0;
    let quantidadeIds = 0;

    // 1. Todos os pares ordenados, incluindo cada componente dentro de si mesmo.
    for (const pai of TIPOS) {
        for (const filho of TIPOS) {
            const componenteFilho = criarComponente(filho, "<p>FOLHA_DO_PAR_${pai}_${filho}</p>", `PAR_${pai}_${filho}`);
            const componentePai = criarComponente(pai, componenteFilho.html, `PAI_${pai}_${filho}`);
            const roteiro = `${componentePai.html}<p>FIM_FORA_DOS_COMPONENTES</p>`;
            quantidadeIds += await validarCaso(
                `PAR_${pai}_${filho}`,
                roteiro,
                { [pai]: 1, [filho]: (pai === filho ? 2 : 1) },
                2
            );
            quantidadeCasos++;
        }
    }

    // 2. Todas as cadeias ordenadas de três níveis, permitindo tipos repetidos.
    for (const primeiro of TIPOS) {
        for (const segundo of TIPOS) {
            for (const terceiro of TIPOS) {
                const terceiraCamada = criarComponente(terceiro, "<p>FOLHA_DE_TRES_NIVEIS</p>", `N3_${primeiro}_${segundo}_${terceiro}`);
                const segundaCamada = criarComponente(segundo, terceiraCamada.html, `N2_${primeiro}_${segundo}_${terceiro}`);
                const primeiraCamada = criarComponente(primeiro, segundaCamada.html, `N1_${primeiro}_${segundo}_${terceiro}`);
                const roteiro = `${primeiraCamada.html}<p>FIM_FORA_DOS_COMPONENTES</p>`;
                const ocorrencias = {};
                for (const tipo of [primeiro, segundo, terceiro]) ocorrencias[tipo] = (ocorrencias[tipo] || 0) + 1;
                quantidadeIds += await validarCaso(
                    `TRES_NIVEIS_${quantidadeCasos + 1}`,
                    roteiro,
                    ocorrencias,
                    3
                );
                quantidadeCasos++;
            }
        }
    }

    // 3. As 720 ordens possíveis dos seis componentes em uma cadeia de seis níveis.
    for (const cadeia of permutacoes(TIPOS)) {
        let conteudo = "<p>FOLHA_DA_CADEIA_COMPLETA</p>";
        const ocorrencias = {};
        for (let indice = cadeia.length - 1; indice >= 0; indice--) {
            const tipo = cadeia[indice];
            const componente = criarComponente(tipo, conteudo, `NIVEL_${indice}_${cadeia.join("_")}`);
            conteudo = componente.html;
            ocorrencias[tipo] = 1;
        }
        const roteiro = `${conteudo}<p>FIM_FORA_DOS_COMPONENTES</p>`;
        quantidadeIds += await validarCaso(
            `CADEIA_SEIS_NIVEIS_${quantidadeCasos + 1}`,
            roteiro,
            ocorrencias,
            6
        );
        quantidadeCasos++;
    }

    // 4. Dois irmãos do mesmo tipo dentro da mesma janela, para todos os pares pai/filho.
    for (const pai of TIPOS) {
        for (const filho of TIPOS) {
            const filhoA = criarComponente(filho, "<p>CONTEUDO_DO_IRMAO_A</p>", `IRMAO_A_${pai}_${filho}`);
            const filhoB = criarComponente(filho, "<p>CONTEUDO_DO_IRMAO_B</p>", `IRMAO_B_${pai}_${filho}`);
            const componentePai = criarComponente(pai, filhoA.html + filhoB.html, `PAI_IRMAOS_${pai}_${filho}`);
            const roteiro = `${componentePai.html}<p>FIM_FORA_DOS_COMPONENTES</p>`;
            quantidadeIds += await validarCaso(
                `IRMAOS_MESMA_JANELA_${pai}_${filho}`,
                roteiro,
                { [pai]: 1, [filho]: (pai === filho ? 3 : 2) },
                3
            );
            quantidadeCasos++;
        }
    }

    // 5. Irmãos do mesmo tipo em janelas diferentes: o ordinal deve reiniciar por janela.
    for (const pai of ["sanfona", "abas", "mininavegacao", "flashcard", "botao"]) {
        for (const filho of TIPOS) {
            const filhoA = criarComponente(filho, "<p>JANELA_UM</p>", `JANELA_A_${pai}_${filho}`);
            const filhoB = criarComponente(filho, "<p>JANELA_DOIS</p>", `JANELA_B_${pai}_${filho}`);
            const componentePai = criarComponenteComDuasJanelas(pai, filhoA.html, filhoB.html);
            const roteiro = `${componentePai}<p>FIM_FORA_DOS_COMPONENTES</p>`;
            const ocorrencias = {
                sanfona: 0,
                abas: 0,
                mininavegacao: 0,
                flashcard: 0,
                botao: 0,
                hotword: 0
            };
            ocorrencias[pai] = ["sanfona", "botao"].includes(pai) ? 2 : 1;
            ocorrencias[filho] += 2;
            quantidadeIds += await validarCaso(
                `IRMAOS_JANELAS_SEPARADAS_${pai}_${filho}`,
                roteiro,
                ocorrencias,
                4
            );
            quantidadeCasos++;
        }
    }

    // 6. Compatibilidade dos FLASHCARDs legados repetidos dentro de qualquer
    // container-pai. O segundo cartão independente deve receber flashcard2.
    for (const pai of ["sanfona", "abas", "mininavegacao", "botao", "hotword"]) {
        const cardsLegados =
            criarFlashcardLegado(`A_${pai}`) + criarFlashcardLegado(`B_${pai}`);
        const componentePai = criarComponente(pai, cardsLegados, `PAI_FLASHCARD_LEGADO_${pai}`);
        const roteiro = `${componentePai.html}<p>FIM_FORA_DOS_COMPONENTES</p>`;
        quantidadeIds += await validarCaso(
            `FLASHCARDS_LEGADOS_IRMAOS_${pai}`,
            roteiro,
            { [pai]: 1, flashcard: 2 },
            3
        );
        quantidadeCasos++;
    }

    // 7. Todos os seis tipos como irmãos no mesmo contexto, em cada componente-pai.
    for (const pai of TIPOS) {
        const filhos = TIPOS.map((filho, indice) =>
            criarComponente(filho, `<p>FILHO_MISTO_${indice}</p>`, `MISTO_${pai}_${filho}`).html
        ).join("");
        const componentePai = criarComponente(pai, filhos, `PAI_MISTO_${pai}`);
        const roteiro = `${componentePai.html}<p>FIM_FORA_DOS_COMPONENTES</p>`;
        const ocorrencias = Object.fromEntries(TIPOS.map(tipo => [tipo, 1]));
        ocorrencias[pai] += 1;
        quantidadeIds += await validarCaso(
            `SEIS_TIPOS_IRMAOS_${pai}`,
            roteiro,
            ocorrencias,
            7
        );
        quantidadeCasos++;
    }

    // 8. Componentes irmãos diretamente na Tela, incluindo duas instâncias de cada tipo.
    const filhosDaTela = TIPOS.flatMap(tipo => [1, 2].map(ordinal =>
        criarComponente(tipo, `<p>IRMAO_DE_TELA_${tipo}_${ordinal}</p>`, `TELA_${tipo}_${ordinal}`).html
    )).join("");
    const roteiroTela = `${filhosDaTela}<p>FIM_FORA_DOS_COMPONENTES</p>`;
    quantidadeIds += await validarCaso(
        "DOIS_DE_CADA_TIPO_DIRETAMENTE_NA_TELA",
        roteiroTela,
        Object.fromEntries(TIPOS.map(tipo => [tipo, 2])),
        TIPOS.length * 2
    );
    quantidadeCasos++;

    console.log(`✓ ${quantidadeCasos} cenários de independência e hierarquia aprovados.`);
    console.log(`✓ ${quantidadeIds} identificadores conferidos entre HTML e sonorizacao.json.`);
    console.log("✓ Pares, cadeias com tipos repetidos, todas as 720 ordens de seis níveis e componentes irmãos validados.");
    console.log("✓ IDs exclusivos, componentes preservados e conteúdo posterior mantido.");
}

executar().catch(erro => {
    console.error("\nFalha no teste geral de independência dos componentes:");
    console.error(erro.stack || erro);
    process.exitCode = 1;
});
