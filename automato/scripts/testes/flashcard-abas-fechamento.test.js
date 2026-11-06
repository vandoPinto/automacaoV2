const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");

async function executar() {
    const html = await processarComponente(
        "tela",
        `<p>Texto inicial.</p><abas>
        <aba>Aba 1
        <janela><p>Conteúdo da aba.</p>
            <flashcard>
            <frente><p>Frente 1</p>
            <verso><p>Verso 1</p>
            <frente><p>Frente 2</p>
            <verso><p>Verso 2</p>
            </flashcard>`,
        1, 8
    );

    assert.strictEqual((html.match(/class="flip-box"/g) || []).length, 2);
    assert(html.includes("Frente 1"));
    assert(html.includes("Verso 1"));
    assert(html.includes("Frente 2"));
    assert(html.includes("Verso 2"));
    console.log("✓ FLASHCARD com fechamento explícito é processado dentro de ABAS");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
