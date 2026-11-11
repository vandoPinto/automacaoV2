const assert = require("node:assert/strict");
const {
    interpretarTabelasComponentes,
    validarTabelasComponentes
} = require("../InterpretarTabelasComponentes");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao, normalizarMarcadores } = require("../ExtrairAudiosComponentes");

const contexto = { topico: "Revisão", numeroTopico: 3, tela: 7 };

function tabela(cabecalho, linhas, colunas = 1) {
    const span = colunas > 1 ? ` colspan="${colunas}"` : "";
    return `<table><tr><td${span}>${cabecalho}</td></tr>${linhas}</table>`;
}

const casos = [
    {
        chave: "flashcard",
        nome: "FLASHCARD",
        tabela: tabela("Flashcard",
            `<tr><td><p>Frente um</p></td><td><p>Verso um.</p></td></tr>` +
            `<tr><td>Frente dois</td><td><p>Verso dois.</p></td></tr>`, 2),
        marcadores: /<flashcard><frente><p>Frente um<\/p><verso><p>Verso um\.<\/p><frente>Frente dois<verso><p>Verso dois\.<\/p><\/flashcard>/,
        classe: "flashcard-componente",
        audio: "Verso um"
    },
    {
        chave: "jogomemoria",
        nome: "JOGO DA MEMÓRIA",
        tabela: tabela("Jogo da memória",
            `<tr><td>Maçã</td><td>Fruta vermelha</td><td>Par da maçã.</td><td>Capa do jogo</td></tr>` +
            `<tr><td>Banana</td><td>Fruta amarela</td><td>Par da banana.</td><td></td></tr>`, 4),
        marcadores: /<jogomemoria><frente>Capa do jogo<carta1>Maçã<carta2>Fruta vermelha<feedback>Par da maçã\.<carta1>Banana<carta2>Fruta amarela<feedback>Par da banana\.<\/jogomemoria>/,
        classe: "jogomemoria-componente",
        audio: "Par da maçã"
    },
    {
        chave: "mininavegacao",
        nome: "MINI NAVEGAÇÃO",
        tabela: tabela("Mini navegação",
            `<tr><td><p>Etapa um.</p></td></tr><tr><td><p>Etapa dois.</p></td></tr>`),
        marcadores: /<mininavegacao><janela><p>Etapa um\.<\/p><janela><p>Etapa dois\.<\/p><\/mininavegacao>/,
        classe: "mini-nav-componente",
        audio: "Etapa um"
    },
    {
        chave: "sanfona",
        nome: "SANFONA",
        tabela: tabela("Sanfona",
            `<tr><td>Painel um</td><td><p>Conteúdo um.</p></td></tr>` +
            `<tr><td>Painel dois</td><td><p>Conteúdo dois.</p></td></tr>`, 2),
        marcadores: /<sanfona><botao>Painel um<janela><p>Conteúdo um\.<\/p><botao>Painel dois<janela><p>Conteúdo dois\.<\/p><\/sanfona>/,
        classe: "sanfona-componente",
        audio: "Conteúdo um"
    },
    {
        chave: "ligapontos",
        nome: "LIGA PONTOS",
        tabela: tabela("Liga pontos",
            `<tr><td>HTML</td><td>Linguagem de marcação</td><td><p>Muito bem.</p></td><td><p>Tente novamente.</p></td></tr>` +
            `<tr><td>CSS</td><td>Estilos visuais</td><td></td><td></td></tr>`, 4),
        marcadores: /<ligapontos><opcao>HTML<resposta>Linguagem de marcação<opcao>CSS<resposta>Estilos visuais<feedcerto><p>Muito bem\.<\/p><feederrado><p>Tente novamente\.<\/p><\/ligapontos>/,
        classe: "ligapontos-item-opcao",
        audio: "Muito bem"
    }
];

async function executar() {
    for (const [indice, caso] of casos.entries()) {
        const entrada = `<p>Antes de ${caso.nome}.</p>${caso.tabela}<p>Depois de ${caso.nome}.</p>`;
        const convertida = interpretarTabelasComponentes(entrada, contexto);

        assert.match(convertida, caso.marcadores, `${caso.nome}: estrutura de marcadores`);
        assert.ok(convertida.indexOf(`Antes de ${caso.nome}.`) < convertida.indexOf(`<${caso.chave}>`));
        assert.ok(convertida.indexOf(`<${caso.chave}>`) < convertida.indexOf(`Depois de ${caso.nome}.`));

        const html = await processarComponente("tela", convertida, 1, indice + 30);
        assert.ok(html.includes(caso.classe), `${caso.nome}: o componente legado deve renderizar`);
        assert.ok(html.includes(`Depois de ${caso.nome}.`), `${caso.nome}: preservar o texto posterior`);
        assert.ok(!html.includes(`<${caso.chave}>`), `${caso.nome}: não deixar o marcador no HTML final`);

        const estruturaAudio = processarRegiao(normalizarMarcadores(convertida));
        assert.ok(
            estruturaAudio.audios.some(item => item.texto.includes(caso.audio)),
            `${caso.nome}: manter texto de áudio associado ao componente`
        );
    }

    const flashcardIncompleto = tabela("Flashcard", `<tr><td>Frente</td><td></td></tr>`, 2);
    assert.throws(
        () => interpretarTabelasComponentes(flashcardIncompleto, contexto),
        erro => erro.name === "ErroValidacaoTabelas" &&
            erro.message.includes("tópico 3 (\"Revisão\")") &&
            erro.message.includes("tela 7") &&
            erro.message.includes("conteúdo do verso")
    );

    const jogoComCapaDuplicada = tabela("Jogo da memória",
        `<tr><td>A</td><td>B</td><td>Par A.</td><td>Capa 1</td></tr>` +
        `<tr><td>C</td><td>D</td><td>Par B.</td><td>Capa 2</td></tr>`, 4);
    assert.ok(
        validarTabelasComponentes(jogoComCapaDuplicada, contexto)
            .some(erro => erro.mensagem.includes("só pode ser preenchida em uma linha")),
        "a capa comum do JOGO DA MEMÓRIA deve ser única"
    );

    const ligaPontosComFeedbackParcial = tabela("Liga pontos",
        `<tr><td>Opção</td><td>Resposta</td><td>Acerto</td><td></td></tr>`, 4);
    assert.ok(
        validarTabelasComponentes(ligaPontosComFeedbackParcial, contexto)
            .some(erro => erro.camposAusentes.some(campo => campo.chave === "feedbackErrado")),
        "LIGA PONTOS deve avisar qual feedback está faltando"
    );

    const ligaPontosSemFeedback = tabela("Liga pontos",
        `<tr><td>Opção</td><td>Resposta</td><td></td><td></td></tr>`, 4);
    assert.ok(
        validarTabelasComponentes(ligaPontosSemFeedback, contexto)
            .some(erro => erro.mensagem.includes("feedbacks de acerto e de erro juntos")),
        "LIGA PONTOS deve exigir os dois feedbacks globais"
    );

    const ligaPontosComFeedbackDuplicado = tabela("Liga pontos",
        `<tr><td>A</td><td>Resposta A</td><td>Acerto A</td><td>Erro A</td></tr>` +
        `<tr><td>B</td><td>Resposta B</td><td>Acerto B</td><td>Erro B</td></tr>`, 4);
    assert.ok(
        validarTabelasComponentes(ligaPontosComFeedbackDuplicado, contexto)
            .some(erro => erro.mensagem.includes("valores repetidos precisam ser removidos")),
        "os feedbacks globais de LIGA PONTOS só podem aparecer uma vez"
    );

    console.log("✓ FLASHCARD, JOGO DA MEMÓRIA, MINI NAVEGAÇÃO, SANFONA e LIGA PONTOS: conversão, renderização e áudio.");
    console.log("✓ Erros de campos obrigatórios e regras entre linhas são detalhados pela validação central.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
