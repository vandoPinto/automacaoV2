const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao } = require("../ExtrairAudiosComponentes");

function ids(html) {
    return [...String(html || "").matchAll(/data-audio-id="([^"]+)"/g)].map(match => match[1]);
}

async function executar() {
    // Flashcard dentro da primeira janela de ABAS, com dois cartões.
    const abas = await processarComponente(
        "tela",
        `<abas>
            <aba>Aba 1</aba>
            <janela>
                <flashcard>
                    <frente><p>Frente A</p>
                    <verso><p>Verso A</p>
                    <frente><p>Frente B</p>
                    <verso><p>Verso B</p>
`,
        1,
        20
    );

    assert.deepStrictEqual(ids(abas), [
        "abas_a",
        "abas_a_flashcard_a_verso",
        "abas_a_flashcard_b_verso"
    ]);

    // Flashcard dentro da primeira janela de MININAVEGACAO.
    const mini = await processarComponente(
        "tela",
        `<mininavegacao>
            <janela>
                <flashcard>
                    <frente><p>Frente</p>
                    <verso><p>Verso</p>
`,
        1,
        21
    );

    assert.deepStrictEqual(ids(mini), [
        "mininavegacao_a",
        "mininavegacao_a_flashcard_a_verso"
    ]);

    // O nome atribuído à janela deve existir com o mesmo nome na extração do JSON.
    const extraido = processarRegiao(
        `<abas><aba>Aba 1</aba><janela>
            <flashcard>
                <frente><p>Frente A</p>
                <verso><p>Verso A</p>
                <frente><p>Frente B</p>
                <verso><p>Verso B</p>
            </flashcard>
        </janela></abas>`
    );
    const nomesJson = extraido.audios.map(audio => audio.nomeSufixo);
    assert(nomesJson.includes("abas_a_flashcard_a_verso"));
    assert(nomesJson.includes("abas_a_flashcard_b_verso"));

    // Nenhuma janela de frente pode receber ID de áudio.
    assert(!/class="flip-box-front[^"]*"[^>]*data-audio-id/.test(abas));
    assert(!/class="flip-box-front[^"]*"[^>]*data-audio-id/.test(mini));

    console.log("✓ FLASHCARD em ABAS recebe IDs hierárquicos iguais aos do JSON");
    console.log("✓ FLASHCARD em MININAVEGACAO recebe ID hierárquico");
    console.log("✓ Somente o verso recebe data-audio-id");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
