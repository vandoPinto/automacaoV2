const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao } = require("../ExtrairAudiosComponentes");

const flashcard = `
    <flashcard>
        <frente><p>Frente A</p>
        <verso><p>Verso A</p>

        <frente><p>Frente B</p>
        <verso><p>Verso B</p>
        <botoes>
            <botao><p>Botão 1</p>
            <janela><p>Janela do botão 1.</p>
        </botoes>
        <botoes>
            <botao><p>Botão 2</p>
            <janela><p>Janela do botão 2.</p>
        </botoes>

        <frente><p>Frente C</p>
        <verso><p>Verso C</p>

        <frente><p>Frente D</p>
        <verso><p>Verso D</p>
        <botoes>
            <botao><p>Botão 4</p>
            <janela><p>Janela do botão 4.</p>
        </botoes>

        <frente><p>Frente E</p>
        <verso><p>Verso E</p>
        <botoes>
            <botao><p>Botão 5</p>
            <janela><p>Janela do botão 5.</p>
        </botoes>
    </flashcard>
`;

function ids(html) {
    return [...String(html || "").matchAll(/data-audio-id="([^"]+)"/g)]
        .map(match => match[1]);
}

async function executar() {
    const html = await processarComponente("tela", flashcard, 1, 601);
    const idsHtml = ids(html);
    const esperadosIsolados = [
        "flashcard_a_verso",
        "flashcard_b_verso",
        "flashcard_b_botoes_a",
        "flashcard_b_botoes2_a",
        "flashcard_c_verso",
        "flashcard_d_verso",
        "flashcard_d_botoes_a",
        "flashcard_e_verso",
        "flashcard_e_botoes_a"
    ];

    assert.deepStrictEqual(idsHtml, esperadosIsolados);
    assert(!idsHtml.includes("botoes_a"), "BOTÕES não pode perder o prefixo do FLASHCARD.");

    const entradaAbas = `<abas><aba>Aba A</aba><janela>${flashcard}</janela></abas>`;
    const htmlAbas = await processarComponente("tela", entradaAbas, 1, 602);
    const esperadosAbas = [
        "abas_a",
        "abas_a_flashcard_a_verso",
        "abas_a_flashcard_b_verso",
        "abas_a_flashcard_b_botoes_a",
        "abas_a_flashcard_b_botoes2_a",
        "abas_a_flashcard_c_verso",
        "abas_a_flashcard_d_verso",
        "abas_a_flashcard_d_botoes_a",
        "abas_a_flashcard_e_verso",
        "abas_a_flashcard_e_botoes_a"
    ];
    assert.deepStrictEqual(ids(htmlAbas), esperadosAbas);

    const json = processarRegiao(entradaAbas);
    const idsJson = json.audios.map(audio => audio.nomeSufixo);
    assert.deepStrictEqual(idsJson, esperadosAbas);

    console.log("✓ BOTÕES dentro do FLASHCARD recebem o prefixo do cartão correto.");
    console.log("✓ Grupos repetidos no mesmo verso recebem botoes, botoes2 etc.");
    console.log("✓ BOTÕES dentro de FLASHCARD em ABAS correspondem ao sonorizacao.json.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
