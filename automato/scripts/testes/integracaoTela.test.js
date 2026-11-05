const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");

function ids(html) {
    return [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
}

async function executar() {
    const html = await processarComponente(
        "tela",
        [
            '<p>Introdução: o conceito de autonomia é importante.</p>',
            '<componente tipo="hotword">',
            '<p>O conceito de autonomia é importante.</p>',
            '<hotword>autonomia</hotword>',
            '<janela>Definição de autonomia.</janela>',
            '</componente>',
            '<p>Texto intermediário preservado.</p>',
            '<componente tipo="botao">',
            '<p><botao>Consultar detalhes</botao><janela>Detalhes do conteúdo.</janela></p>',
            '</componente>'
        ].join(""),
        3,
        5
    );

    assert(html.includes('class="tela-container'));
    assert(html.includes('class="hotword-gatilho"'));
    assert(html.includes('Definição de autonomia.'));
    assert(html.includes('class="botao-item"'));
    assert(html.includes('class="botao-janela"'));
    assert(html.includes('Detalhes do conteúdo.'));
    assert(
        html.indexOf("Introdução:") < html.indexOf("hotword-gatilho") &&
        html.indexOf("hotword-gatilho") < html.indexOf("Texto intermediário preservado.") &&
        html.indexOf("Texto intermediário preservado.") < html.indexOf("botao-item"),
        "Tela deve preservar a ordem dos elementos e componentes."
    );
    assert.deepStrictEqual(
        ids(html).filter((id, i, all) => all.indexOf(id) !== i),
        [],
        "Os IDs de Hotword e Botão devem ser exclusivos na mesma Tela."
    );

    const aninhado = await processarComponente(
        "tela",
        '<componente tipo="hotword">' +
            '<p>O termo aprendizagem aparece aqui.</p>' +
            '<hotword>aprendizagem</hotword>' +
            '<janela><p>Explicação.</p>' +
                '<componente tipo="botao"><botao>Ver exemplo</botao><janela>Exemplo interno.</janela></componente>' +
            '</janela>' +
        '</componente>',
        3,
        6
    );

    assert(aninhado.includes("Explicação."));
    assert(aninhado.includes("Exemplo interno."));
    assert(aninhado.includes('class="botao-item"'));
    assert(aninhado.includes('class="hotword-gatilho"'));
    assert.deepStrictEqual(
        ids(aninhado).filter((id, i, all) => all.indexOf(id) !== i),
        [],
        "IDs devem continuar exclusivos quando há componentes aninhados."
    );

    console.log("✓ Integração da Tela com Hotword e Botão via wrappers universais");
    console.log("✓ Ordem original preservada entre texto e componentes");
    console.log("✓ Componentes aninhados em janela continuam funcionando");
    console.log("✓ IDs exclusivos entre componentes da mesma Tela");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
