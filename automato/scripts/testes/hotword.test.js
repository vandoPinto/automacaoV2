const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");

function ids(html) {
    return [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
}

async function executar() {
    // Representa a linha 5: o rótulo indicado no marcador deve ser procurado
    // no texto anterior, e a ocorrência encontrada vira o gatilho inline.
    const linha5 = await processarComponente(
        "tela",
        '<p>Aqui você vai colocar o seu texto introdutório. A quantidade de botões e janelas não tem limites definidos.</p>' +
        '<p><strong><hotword></strong></p>' +
        '<p>Aqui</p>' +
        '<p><strong><janela></strong></p>' +
        '<p>Texto hotword aqui.</p>' +
        '<p><strong><botao></strong></p>' +
        '<p>Aqui você vai colocar o texto do botão ou uma imagem.</p>' +
        '<p><strong><janela></strong></p>' +
        '<p>Aqui você vai colocar o texto que vai aparecer ao clicar no botão.</p>',
        1, 5
    );

    assert(/class="[^"]*hotword-componente/.test(linha5));
    assert(linha5.includes('class="hotword-gatilho"'));
    assert(
        linha5.includes('<p><span class="hotword-gatilho"') &&
        linha5.includes('</span> você vai colocar o seu texto introdutório'),
        "A primeira ocorrência de 'Aqui' no parágrafo anterior deve virar o gatilho inline."
    );
    assert(
        !linha5.includes("<p>Aqui</p>"),
        "O rótulo usado como referência não deve ser exibido como um gatilho separado."
    );
    assert(linha5.includes("Texto hotword aqui."));
    assert(
        linha5.indexOf('class="hotword-gatilho"') < linha5.indexOf("texto introdutório") &&
        linha5.indexOf("texto introdutório") < linha5.indexOf("Texto hotword aqui.") &&
        linha5.indexOf("Texto hotword aqui.") < linha5.indexOf('class="botao-item"'),
        "O texto anterior, o gatilho inline, a janela e o Botão processado devem manter a ordem."
    );
    assert(linha5.includes("Aqui você vai colocar o texto do botão ou uma imagem."),
        "O rótulo do Botão deve permanecer intacto.");
    assert(linha5.includes("Aqui você vai colocar o texto que vai aparecer ao clicar no botão."),
        "O conteúdo da janela do Botão deve permanecer intacto.");
    assert(!linha5.includes('class="tela botao-componente"'),
        "O Botão não deve criar uma tela independente.");
    assert.strictEqual((linha5.match(/class="botao-item/g) || []).length, 1,
        "A linha 5 deve gerar exatamente um gatilho de Botão.");
    assert.strictEqual((linha5.match(/class="botao-janela"/g) || []).length, 1,
        "A linha 5 deve gerar exatamente uma janela para o Botão.");
    assert(!/class="container\s+hotword-componente/.test(linha5),
        "Hotword não deve criar o container genérico da arquitetura antiga.");
    console.log("✓ Linha 5: Hotword gera seu gatilho e janela e preserva o conteúdo do Botão");

    const variosBotoesNaTela = await processarComponente(
        "tela",
        '<p>Escolha uma opção:</p>' +
        '<botao>Opção A</botao><botao>Opção B</botao>' +
        '<janela>Conteúdo A</janela><janela>Conteúdo B</janela>',
        1, 61
    );
    assert.strictEqual((variosBotoesNaTela.match(/class="botao-item/g) || []).length, 2);
    assert.strictEqual((variosBotoesNaTela.match(/class="botao-janela"/g) || []).length, 2);
    assert(variosBotoesNaTela.includes("Conteúdo A") && variosBotoesNaTela.includes("Conteúdo B"));
    console.log("✓ Dois botões independentes e suas janelas dentro da mesma Tela");

    const varias = await processarComponente(
        "tela",
        '<componente tipo="hotword"><p>O termo autonomia é importante.</p><hotword>autonomia</hotword><janela>Definição de autonomia.</janela></componente>' +
        '<componente tipo="hotword"><p>A funcionalidade deve ser preservada.</p><hotword>funcionalidade</hotword><janela>Definição de funcionalidade.</janela></componente>',
        1, 6
    );

    assert.strictEqual((varias.match(/class="hotword-gatilho"/g) || []).length, 2);
    assert.strictEqual((varias.match(/class="hotword-janela"/g) || []).length, 2);
    const idsDuplicados = ids(varias).filter((id, indice, lista) => lista.indexOf(id) !== indice);
    assert.deepStrictEqual(idsDuplicados, [], "Instâncias diferentes devem ter IDs exclusivos.");
    console.log("✓ Duas Hotwords independentes na mesma Tela possuem IDs exclusivos");

    const hotwordComFilho = await processarComponente(
        "hotword",
        '<p>O termo autonomia aparece no conteúdo.</p>' +
        '<hotword>autonomia</hotword>' +
        '<janela><p>Conteúdo da janela.</p>' +
        '<componente tipo="botao"><p>Ação disponível.</p><botao>Ver detalhes</botao><janela>Detalhes internos do botão.</janela></componente>' +
        '</janela>',
        1, 7
    );

    assert(hotwordComFilho.includes("Conteúdo da janela."));
    assert(hotwordComFilho.includes("Detalhes internos do botão."));
    assert(hotwordComFilho.includes('class="botao-item"'));
    assert(hotwordComFilho.includes("hotword-gatilho"));
    console.log("✓ Hotword aceita outro componente dentro da sua janela");

    console.log("\nTodos os testes da nova Hotword passaram.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
