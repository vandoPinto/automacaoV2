const assert = require("assert");
const { processarComponente, analisarWrappers } = require("../ProcessarComponentesAninhados");

function contar(html, expressao) {
    return (html.match(expressao) || []).length;
}

function idsDuplicados(html) {
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    return ids.filter((id, indice) => ids.indexOf(id) !== indice);
}

async function executar() {
    // A árvore central deve manter filhos e irmãos nas posições originais.
    const arvore = analisarWrappers(
        '<p>Antes</p><componente tipo="botao"><p>Pai</p><componente tipo="hotword">Filho</componente></componente><componente tipo="flashcard">Irmão</componente>'
    );
    assert.strictEqual(arvore.length, 2, "Deve reconhecer dois componentes irmãos.");
    assert.strictEqual(arvore[0].tipo, "botao");
    assert.strictEqual(arvore[0].filhos.length, 1, "O componente interno deve pertencer ao pai.");
    assert.strictEqual(arvore[0].filhos[0].tipo, "hotword");
    assert.strictEqual(arvore[1].tipo, "flashcard");
    console.log("✓ Árvore central reconhece hierarquia e componentes irmãos");

    const telaComFilho = await processarComponente(
        "tela",
        '<p>Antes do botão.</p><componente tipo="botao"><p>Introdução do botão.</p><botao>Abrir</botao><janela>Janela do botão.</janela></componente><p>Depois do botão.</p>',
        1, 5
    );
    const posAntes = telaComFilho.indexOf("Antes do botão.");
    const posBotao = telaComFilho.indexOf('class="botao-item"');
    const posDepois = telaComFilho.indexOf("Depois do botão.");
    assert(posAntes >= 0 && posBotao > posAntes && posDepois > posBotao);
    assert(telaComFilho.includes("Janela do botão."));
    console.log("✓ Tela processa componente filho sem perder a ordem original");

    const hotword = await processarComponente("hotword", "<p>O termo autonomia aparece.</p><hotword>autonomia</hotword><janela>Explicação.</janela>", 2, 1);
    assert(hotword.includes("hotword-gatilho") && hotword.includes("Explicação."));
    console.log("✓ HOTWORD isolada");

    const hotwordSemCorrespondencia = await processarComponente(
        "hotword",
        "<p>Texto sem a expressão indicada.</p><hotword>ausente</hotword><janela>Explicação.</janela>",
        2, 101
    );
    assert.strictEqual(contar(hotwordSemCorrespondencia, /class="hotword-gatilho"/g), 0);
    console.log("✓ HOTWORD não cria gatilho artificial quando a expressão não existe");


    const botao = await processarComponente("botao", "<p>Introdução.</p><botao>Detalhes</botao><janela>Texto.</janela>", 2, 2);
    assert.strictEqual(contar(botao, /class="botao-item/g), 1);
    assert.strictEqual(contar(botao, /class="botao-janela"/g), 1);
    assert(!botao.includes('class="tela botao-componente"'), "BOTAO não deve criar container de tela.");
    assert(botao.includes('<p>Introdução.</p>'), "A introdução deve permanecer no fluxo do conteúdo.");
    console.log("✓ BOTAO independente com um botão e sem criar tela própria");

    const hotwordLegada = await processarComponente(
        "botao",
        "<p>Texto com autonomia.</p><hotword>autonomia</hotword><janela>Explicação antiga.</janela><botao>Abrir</botao><janela>Janela do botão.</janela>",
        2, 22
    );
    assert(hotwordLegada.includes("Explicação antiga."));
    assert(hotwordLegada.includes("Janela do botão."));
    assert.strictEqual(contar(hotwordLegada, /class="botao-item/g), 1);
    console.log("✓ Compatibilidade com HOTWORD legada dentro do BOTAO");

    const varios = await processarComponente("botao", "<p>Introdução.</p><botao>Um</botao><botao>Dois</botao><botao>Três</botao><janela>Janela um</janela><janela>Janela dois</janela><janela>Janela três</janela>", 2, 3);
    assert.strictEqual(contar(varios, /class="botao-item/g), 3);
    assert.strictEqual(contar(varios, /class="botao-janela"/g), 3);
    console.log("✓ BOTAO com vários pares");

    const botaoInline = await processarComponente(
        "tela",
        '<p>Texto antes <componente tipo="botao"><botao>Detalhes</botao><janela>Conteúdo do modal.</janela></componente> texto depois.</p>',
        2, 31
    );
    assert(botaoInline.indexOf("Texto antes") < botaoInline.indexOf('class="botao-item"'));
    assert(botaoInline.indexOf('class="botao-item"') < botaoInline.indexOf("texto depois."));
    assert(!botaoInline.includes('class="tela botao-componente"'));
    console.log("✓ BOTAO permanece no fluxo da tela sem criar bloco de layout próprio");

    const formatado = await processarComponente("botao", "<p><strong>Negrito</strong> <em>itálico</em> <img src=\"imagem.png\"></p><botao><img src=\"icone.png\" alt=\"Ícone\"></botao><janela>Descrição.</janela>", 2, 4);
    assert(formatado.includes("<strong>Negrito</strong>") && formatado.includes("<em>itálico</em>"));
    assert(formatado.includes("src=\"imagem.png\"") && formatado.includes("src=\"icone.png\""));
    console.log("✓ Formatação e imagens preservadas");

    const noTexto = await processarComponente("botao", "<p>Texto <componente tipo=\"hotword\"><p>biológicas</p><hotword>biológicas</hotword><janela>Conceito biológico.</janela></componente> principal.</p><botao>Abrir</botao><janela>Janela pai.</janela>", 2, 5);
    assert(noTexto.includes("hotword-gatilho") && noTexto.includes("Conceito biológico.") && noTexto.includes("Janela pai."));
    console.log("✓ HOTWORD aninhada no texto do BOTAO");

    const naJanela = await processarComponente("botao", "<p>Texto.</p><botao>Ver</botao><janela>Definição: <componente tipo=\"hotword\"><p>termo</p><hotword>termo</hotword><janela>Definição interna.</janela></componente></janela>", 2, 6);
    assert(naJanela.includes("Definição interna.") && naJanela.includes("hotword-gatilho"));
    console.log("✓ HOTWORD aninhada na janela do BOTAO");

    const profundo = await processarComponente("botao", "<p>Raiz</p><componente tipo=\"botao\"><p>Filho</p><componente tipo=\"hotword\"><p>termo</p><hotword>termo</hotword><janela>Definição profunda.</janela></componente><botao>Filho botão</botao><janela>Filho janela.</janela></componente><botao>Raiz botão</botao><janela>Raiz janela.</janela>", 2, 7);
    assert(profundo.includes("Definição profunda.") && profundo.includes("Filho janela.") && profundo.includes("Raiz janela."));
    console.log("✓ Aninhamento em três níveis");

    const textoLongo = "Conteúdo longo ".repeat(80);
    const flashcard = await processarComponente("flashcard", `<p><frente></frente></p><p>Frente</p><p><verso></verso></p><p>${textoLongo}</p>`, 2, 8);
    assert(flashcard.includes(textoLongo) && flashcard.includes("flashcard-toque-8-1"));
    console.log("✓ FLASHCARD com conteúdo longo e ID contextual");

    const flashcardComHotword = await processarComponente(
        "flashcard",
        "<p><frente></frente></p><p>Frente</p><p><verso></verso></p><p>Conceito: " +
        "<componente tipo=\"hotword\"><p>memória</p><hotword>memória</hotword><janela>Definição de memória.</janela></componente></p>",
        2, 81
    );
    assert(flashcardComHotword.includes("Definição de memória."));
    assert(flashcardComHotword.includes("hotword-gatilho"));
    console.log("✓ HOTWORD dentro do FLASHCARD");

    // Linha 6 do exemplo DOCX: a marcação legada <flashcard> aparece dentro
    // de uma Tela, após o texto introdutório, sem exigir alteração no documento.
    const flashcardNaTela = await processarComponente(
        "tela",
        '<p>Atividade de flashcard</p><p>Este é um texto de explicação para o aluno.</p>' +
        '<p>&lt;flashcard&gt;</p><p>&lt;frente&gt;</p><p><img src="frente.png" alt="Frente"></p>' +
        '<p>&lt;verso&gt;</p><p>Resposta ou explicação do verso.</p>',
        1, 6
    );
    assert(flashcardNaTela.includes('class="flashcard-componente"'));
    assert(!flashcardNaTela.includes('class="tela flashcard-componente"'));
    assert(flashcardNaTela.includes('src="frente.png"'));
    assert(flashcardNaTela.includes('Resposta ou explicação do verso.'));
    assert(flashcardNaTela.includes('Atividade de flashcard'));
    assert(flashcardNaTela.includes('flashcard-toque-6-1'));
    console.log("✓ FLASHCARD legado da linha 6 integrado dentro da Tela");

    // Regressão relatada no teste real: HOTWORD legada dentro do verso do
    // FLASHCARD deve destacar a expressão anterior sem consumir a estrutura do cartão.
    const flashcardComHotwordLegadaNoVerso = await processarComponente(
        "tela",
        '<p>Atividade de flashcard</p><p>Este é um texto de explicação, para o aluno conseguir fazer a atividade.</p>' +
        '<p>&lt;flashcard&gt;</p><p>&lt;frente&gt;</p><p>Close de um ramo de oliveira em um pôr do sol</p>' +
        '<p>&lt;verso&gt;</p><p>Digite aqui a resposta ou explicação que aparecerá no verso.</p>' +
        '<p>&lt;hotword&gt;</p><p>Digite </p><p>&lt;janela&gt;</p><p>Texto de hotword digite.</p>',
        1, 62
    );
    assert(flashcardComHotwordLegadaNoVerso.includes('class="flashcard-componente"'));
    assert(flashcardComHotwordLegadaNoVerso.includes('class="hotword-gatilho"'));
    assert(flashcardComHotwordLegadaNoVerso.includes('Texto de hotword digite.'));
    assert(flashcardComHotwordLegadaNoVerso.includes('>Digite</span> aqui a resposta'), 'A expressão deve virar gatilho e o restante do verso deve permanecer.');
    assert(flashcardComHotwordLegadaNoVerso.includes('flashcard-toque-62-1'));
    assert(!flashcardComHotwordLegadaNoVerso.includes('&lt;hotword&gt;'));
    console.log("✓ HOTWORD legada dentro do verso do FLASHCARD preserva cartão e janela");

    // Regressão do roteiro real: várias faces sequenciais, com BOTAO/JANELA
    // e HOTWORD/JANELA dentro de versos diferentes. O botão não pode absorver
    // os cartões seguintes, e os dois recursos devem continuar interativos.
    const flashcardComVariosCartoesEInteracoes = await processarComponente(
        "tela",
        '<p>Atividade de flashcard</p><p>Texto introdutório.</p><p>&lt;flashcard&gt;</p>' +
        '<p>&lt;frente&gt;</p><p>Frente do cartão 1</p><p>&lt;verso&gt;</p>' +
        '<p>Resposta do cartão 1.</p><p>&lt;botao&gt;</p><p>Botão dentro flashcard</p>' +
        '<p>&lt;janela&gt;</p><p>Janela do botão de dentro do flashcard.</p>' +
        '<p>&lt;frente&gt;</p><p>Frente do cartão 2</p><p>&lt;verso&gt;</p>' +
        '<p>Resposta do cartão 2 testando.</p><p>&lt;hotword&gt;</p><p>testando</p>' +
        '<p>&lt;janela&gt;</p><p>Janela da hotword de dentro do flashcard.</p>' +
        '<p>&lt;frente&gt;</p><p>Frente do cartão 3</p><p>&lt;verso&gt;</p><p>Resposta 3.</p>' +
        '<p>&lt;frente&gt;</p><p>Frente do cartão 4</p><p>&lt;verso&gt;</p><p>Resposta 4.</p>' +
        '<p>&lt;frente&gt;</p><p>Frente do cartão 5</p><p>&lt;verso&gt;</p><p>Resposta 5.</p>',
        1, 63
    );
    assert.strictEqual(contar(flashcardComVariosCartoesEInteracoes, /class="flip-box"/g), 5,
        "Deve gerar os cinco cartões, sem absorver os seguintes na janela do botão.");
    assert.strictEqual(contar(flashcardComVariosCartoesEInteracoes, /class="botao-item/g), 1);
    assert.strictEqual(contar(flashcardComVariosCartoesEInteracoes, /class="botao-janela"/g), 1);
    assert.strictEqual(contar(flashcardComVariosCartoesEInteracoes, /class="hotword-gatilho"/g), 1);
    assert(flashcardComVariosCartoesEInteracoes.includes("Janela do botão de dentro do flashcard."));
    assert(flashcardComVariosCartoesEInteracoes.includes("Janela da hotword de dentro do flashcard."));
    assert(flashcardComVariosCartoesEInteracoes.includes("Frente do cartão 5"));
    assert.deepStrictEqual(idsDuplicados(flashcardComVariosCartoesEInteracoes), []);
    console.log("✓ FLASHCARD com cinco cartões, BOTAO e HOTWORD internos preserva todas as faces e interações");

    const flashcardComponenteAninhado = await processarComponente(
        "tela",
        '<p>Introdução.</p><p><flashcard></p><p><frente></p>' +
        '<p><componente tipo="hotword"><p>termo</p><hotword>termo</hotword><janela>Definição interna da frente.</janela></componente></p>' +
        '<p><verso></p><p>Resposta do cartão.</p>',
        1, 61
    );
    assert(flashcardComponenteAninhado.includes('hotword-gatilho'));
    assert(flashcardComponenteAninhado.includes('Definição interna da frente.'));
    assert(flashcardComponenteAninhado.includes('Resposta do cartão.'));
    assert(flashcardComponenteAninhado.includes('flashcard-toque-61-1'));
    console.log("✓ Componente aninhado dentro da frente do FLASHCARD via processador central");

    const abasComBotao = await processarComponente(
        "abas",
        "<p>Introdução <componente tipo=\"botao\"><p>Texto do botão</p><botao>Abrir</botao><janela>Conteúdo do botão.</janela></componente></p>",
        2, 82
    );
    assert(abasComBotao.includes("Conteúdo do botão."));
    assert(abasComBotao.includes("class=\"botao-item\""));
    console.log("✓ BOTAO dentro de ABAS");


    // Regressão: HOTWORD legada deve destacar a palavra no texto que já existe
    // e não pode ser contabilizada como botão/janela do BOTAO pai.
    const telaComHotwords = await processarComponente(
        "botao",
        `<p>O cuidado à pessoa idosa deve considerar tanto as limitações <strong>biológicas</strong> quanto a preservação da autonomia, da funcionalidade e da participação social.</p>
        <hotword>biológicas</hotword><janela>Aqui vai o texto da hotword biológicas</janela>
        <botao>Botão 1</botao><botao>Botão 2</botao><botao>Botão 3</botao><botao>Botão 4</botao>
        <janela>Na Atenção Básica, esse compromisso foi fortalecido com o Pacto pela Vida (2006).</janela>
        <janela>Ao falar das características físicas do envelhecimento, é fundamental retomar um ponto central.</janela>
        <janela>Envelhecimento físico, <strong>funcional</strong> e social acontecem de forma integrada.</janela>
        <hotword>funcional</hotword><janela>Aqui vai o texto da hotword funcional</janela>
        <janela>O envelhecimento biológico é um processo complexo, cumulativo e progressivo.</janela>`,
        2, 17
    );
    assert.strictEqual(contar(telaComHotwords, /class="botao-item/g), 4);
    assert.strictEqual(contar(telaComHotwords, /class="botao-janela"/g), 4);
    assert.strictEqual(contar(telaComHotwords, /class="hotword-gatilho"/g), 2);
    assert.strictEqual(contar(telaComHotwords, /class="hotword-janela"/g), 2);
    assert(telaComHotwords.includes("Aqui vai o texto da hotword biológicas"));
    assert(telaComHotwords.includes("Aqui vai o texto da hotword funcional"));
    assert(telaComHotwords.includes('<strong><span class="hotword-gatilho"'));
    assert.deepStrictEqual(idsDuplicados(telaComHotwords), []);
    console.log("✓ HOTWORDs no texto e em janela do BOTAO sem criar botões extras");

    const instancias = await processarComponente("botao", "<componente tipo=\"botao\"><botao>Interno</botao><janela>Dentro</janela></componente><botao>Externo</botao><janela>Fora</janela>", 2, 9);
    assert.deepStrictEqual(idsDuplicados(instancias), []);
    console.log("✓ IDs únicos entre instâncias");

    // Conteúdo da janela é opaco para o processador: somente wrappers
    // universais <componente> são processados recursivamente.
    const janelaGenerica = await processarComponente(
        "botao",
        '<botao>Abrir</botao><janela><p>Conteúdo da janela.</p><componente tipo="hotword"><p>termo</p><hotword>termo</hotword><janela>Definição interna.</janela></componente></janela>',
        2, 91
    );
    assert(janelaGenerica.includes("Conteúdo da janela."));
    assert(janelaGenerica.includes("Definição interna."));
    assert(janelaGenerica.includes("hotword-gatilho"));
    console.log("✓ Janela genérica preserva conteúdo e permite componentes aninhados");

    const tokenColisao = await processarComponente(
        "botao",
        '<p>__HTML_COMPONENTE_FILHO_2_92_1_1_FIM__</p><componente tipo="botao"><botao>Interno</botao><janela>Interna</janela></componente><botao>Externo</botao><janela>Externa</janela>',
        2, 92
    );
    assert(tokenColisao.includes("__HTML_COMPONENTE_FILHO_2_92_1_1_FIM__"));
    assert(tokenColisao.includes("Interna") && tokenColisao.includes("Externa"));
    console.log("✓ Placeholders não colidem com texto original do DOCX");

    assert.throws(() => analisarWrappers("<componente tipo=\"botao\"><p>Sem fechamento</p>"), /sem fechamento/);
    assert.throws(() => analisarWrappers("</componente>"), /sem abertura/);
    assert.throws(() => analisarWrappers("<componente><p>Sem tipo</p></componente>"), /tipo válido/);
    const escapado = await processarComponente(
        "botao",
        "&lt;componente tipo=&quot;hotword&quot;&gt;<p>termo</p><hotword>termo</hotword><janela>Definição escapada.</janela>&lt;/componente&gt;<botao>Abrir</botao><janela>Janela.</janela>",
        2, 10
    );
    assert(escapado.includes("Definição escapada.") && escapado.includes("hotword-gatilho"));
    console.log("✓ Wrappers escapados pelo DOCX");
    console.log("✓ Validação de wrappers malformados");
    console.log("\nTodos os testes de integração passaram.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
