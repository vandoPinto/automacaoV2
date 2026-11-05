const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");

async function executar() {
    const roteiro = `
        <h2>Componente ABAS</h2>
        <p>Texto de inicialização explicativo para o aluno.</p>
        <abas>
        <aba>Botão da Aba 1
        <aba>Botão da Aba 2
        <aba>Botão da Aba 3
        <aba>Botão da Aba 4
        <janela><p>Texto da janela da aba 1.</p><p><img src="oliveira.png" alt="Ramo de oliveira"></p>
        <janela><p><img src="oliveira.png" alt="Ramo de oliveira"></p><p>Texto da janela da aba 2.</p>
        <janela><p>Somente texto centralizado.</p>
        <janela><p>Janela com texto grande para testar a altura dinâmica e a leitura do conteúdo completo.</p>
    `;

    const htmlTela = await processarComponente("tela", roteiro, 1, 8);

    assert(htmlTela.includes("Texto de inicialização explicativo para o aluno."));
    assert(htmlTela.includes("Componente ABAS"));
    assert.strictEqual((htmlTela.match(/class="abas-botao/g) || []).length, 4);
    assert.strictEqual((htmlTela.match(/class="abas-painel(?: |")/g) || []).length, 4);

    for (let i = 1; i <= 4; i++) {
        assert(htmlTela.includes(`Botão da Aba ${i}`));
        assert(htmlTela.includes(`id="abas-1_8_abas-legada-painel-${i}"`));
    }

    assert(htmlTela.includes("Texto da janela da aba 1."));
    assert(htmlTela.includes("Texto da janela da aba 2."));
    assert(htmlTela.includes("Somente texto centralizado."));
    assert(htmlTela.includes("Janela com texto grande"));
    assert(htmlTela.includes('src="oliveira.png"'));

    // O texto introdutório pertence ao fluxo da Tela; o template ABAS
    // não deve gerar outro bloco ou repetir esse texto.
    const htmlAbas = htmlTela.slice(htmlTela.indexOf('<div class="abas-componente"'));
    assert(!htmlAbas.includes("Texto de inicialização explicativo"));

    console.log("✓ Tela mantém o texto introdutório fora do componente ABAS");
    console.log("✓ ABAS gera quatro botões e quatro janelas na ordem do DOCX");
    console.log("✓ ABAS preserva textos, imagens e conteúdo longo");

    const comFilho = await processarComponente(
        "tela",
        `<p>Introdução.</p><abas>
        <aba>Aba com botão
        <janela>
            <p>Conteúdo antes do botão.</p>
            <componente tipo="botao">
                <botao>Abrir botão interno</botao>
                <janela>Conteúdo do botão interno.</janela>
            </componente>
        `,
        1, 9
    );

    assert(comFilho.includes("Conteúdo antes do botão."));
    assert(comFilho.includes("Abrir botão interno"));
    assert(comFilho.includes("Conteúdo do botão interno."));
    assert(comFilho.includes('class="botao-item'));
    console.log("✓ ABAS aceita componente filho processado pelo mecanismo central");

    const abasDiretas = await processarComponente(
        "abas",
        `<abas><aba>Primeira</aba><aba>Segunda</aba><janela>Painel 1</janela><janela>Painel 2</janela>`,
        2, 10
    );
    assert.strictEqual((abasDiretas.match(/class="abas-botao/g) || []).length, 2);
    assert(abasDiretas.includes("Painel 2"));
    console.log("✓ ABAS também funciona como componente independente");

    await assert.rejects(
        () => processarComponente(
            "tela",
            `<p>Introdução.</p><abas><aba>Uma</aba><aba>Duas</aba><janela>Painel único</janela>`,
            1, 11
        ),
        /quantidade de abas \(2\) é diferente da quantidade de janelas \(1\)/
    );
    console.log("✓ ABAS informa divergência entre quantidade de abas e janelas");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
