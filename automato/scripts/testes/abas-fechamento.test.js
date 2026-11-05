const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");

async function executar() {
    const html = await processarComponente(
        "tela",
        `<p>Introdução que pertence à tela.</p>
        <abas>
            <aba>Primeira aba
            <aba>Segunda aba
            <janela><p>Conteúdo do primeiro painel.</p>
                <componente tipo="botao">
                    <botao>Abrir detalhes</botao>
                    <janela>Detalhes do botão interno.</janela>
                </componente>
            <janela><p>Conteúdo do segundo painel, com texto complementar.</p>
        </abas>
        <p>ESTE TEXTO DEVE CONTINUAR NA TELA, FORA DE ABAS.</p>`,
        1,
        90
    );

    assert(html.includes("Introdução que pertence à tela."));
    assert.strictEqual((html.match(/class="abas-botao/g) || []).length, 2);
    assert.strictEqual((html.match(/class="abas-painel(?: |")/g) || []).length, 2);
    assert(html.includes("Conteúdo do primeiro painel."));
    assert(html.includes("Detalhes do botão interno."));
    assert(html.includes("Conteúdo do segundo painel, com texto complementar."));
    assert(html.includes("ESTE TEXTO DEVE CONTINUAR NA TELA, FORA DE ABAS."));
    assert(!html.includes("</abas>"));

    console.log("✓ ABAS com fechamento explícito gera os painéis corretamente.");
    console.log("✓ BOTÃO aninhado continua funcionando.");
    console.log("✓ Texto posterior a </abas> permanece na Tela.");

    const abasLegadas = await processarComponente(
        "tela",
        `<p>Introdução antiga.</p><abas>
            <aba>Aba antiga 1
            <aba>Aba antiga 2
            <janela>Painel antigo 1
            <janela>Painel antigo 2`,
        1,
        91
    );
    assert.strictEqual((abasLegadas.match(/class="abas-botao/g) || []).length, 2);
    assert(abasLegadas.includes("Painel antigo 2"));
    console.log("✓ ABAS sem fechamento explícito mantém compatibilidade com a sintaxe antiga.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
