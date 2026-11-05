const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");

async function executar() {
    const entrada = `
        <p>Título da tela.</p>
        <botoes>
            <botao><strong>Texto introdutório</strong></botao>
            <janela>
                <p>Escreva uma breve explicação sobre o conteúdo que será apresentado nos botões.</p>
                <p>hotword (opcional)</p>
                <p>Utilize para destacar uma palavra ou expressão no texto introdutório e associá-la a uma janela com conteúdo complementar.</p>
            </janela>
            <botao><strong>Botões</strong></botao>
            <janela>
                <p>Insira os botões na ordem em que deseja que apareçam na tela.</p>
                <hotword>Botões<janela>Mantenha a sequência de botões e janelas.</hotword>
            </janela>
            <botao><strong>Janelas</strong></botao>
            <janela><p>Insira as janelas após os botões, mantendo a mesma ordem.</p></janela>
            <botao><strong>Conteúdo das janelas</strong></botao>
            <janela><p>Dentro de cada janela, insira o texto ou os elementos.</p></janela>
        </botoes>
        <p>ESTE TEXTO DEVE CONTINUAR NA TELA, FORA DO COMPONENTE BOTOES.</p>
    `;

    const html = await processarComponente("tela", entrada, 1, 501);

    assert.strictEqual((html.match(/class="botao-item/g) || []).length, 4,
        "O grupo deve gerar quatro botões.");
    assert.strictEqual((html.match(/class="botao-janela"/g) || []).length, 4,
        "O grupo deve gerar quatro janelas.");
    assert(html.includes("Texto introdutório"));
    assert(html.includes("Escreva uma breve explicação"));
    assert(html.includes("Mantenha a sequência de botões e janelas."));
    assert(html.includes("ESTE TEXTO DEVE CONTINUAR NA TELA, FORA DO COMPONENTE BOTOES."),
        "O texto depois de </botoes> deve permanecer na Tela.");
    assert(!html.includes("<botoes>") && !html.includes("</botoes>"),
        "Os marcadores estruturais não devem aparecer no HTML final.");
    assert(html.includes('class="hotword-gatilho"'),
        "HOTWORD dentro do grupo de botões deve continuar funcionando.");

    console.log("✓ BOTOES com fechamento explícito gera quatro botões e quatro janelas.");
    console.log("✓ HOTWORD interna é processada normalmente.");
    console.log("✓ Conteúdo posterior a </botoes> permanece na Tela.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
