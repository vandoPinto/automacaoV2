const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao } = require("../ExtrairAudiosComponentes");

function ids(html) {
    return [...String(html || "").matchAll(/data-audio-id="([^"]+)"/g)].map(match => match[1]);
}

async function executar() {
    const roteiro = `<aba>Primeira</aba><aba>Segunda</aba>
        <janela>Painel um</janela><janela>Painel dois</janela>`;
    const html = await processarComponente("abas", roteiro, 1, 1);
    const idsHtml = ids(html);

    assert.deepStrictEqual(idsHtml, ["abas_a", "abas_b"]);
    assert(idsHtml.every(id => /^(?:[a-z0-9]+_)*abas_[a-z]+$/.test(id)));

    const json = processarRegiao(`<abas>${roteiro}</abas>`);
    assert.deepStrictEqual(idsHtml, json.audios.map(audio => audio.nomeSufixo));

    const aninhado = await processarComponente(
        "abas",
        `<aba>Externa</aba><janela>
            <componente tipo="abas">
                <aba>Interna A</aba><aba>Interna B</aba>
                <janela>Painel interno A</janela><janela>Painel interno B</janela>
            </componente>
        </janela>`,
        1,
        2
    );
    assert.deepStrictEqual(ids(aninhado), [
        "abas_a",
        "abas_a_abas_a",
        "abas_a_abas_b"
    ]);

    const aninhadoJson = processarRegiao(
        `<abas><aba>Externa</aba><janela>
            <abas><aba>Interna A</aba><aba>Interna B</aba>
            <janela>Painel interno A</janela><janela>Painel interno B</janela></abas>
        </janela></abas>`
    );
    assert.deepStrictEqual(ids(aninhado), aninhadoJson.audios.map(audio => audio.nomeSufixo));

    const template = fs.readFileSync(
        path.join(__dirname, "../Componentes/abas/abas.html"),
        "utf8"
    );
    assert(template.includes('paineis[indice]?.getAttribute("data-audio-id")'));
    assert(!template.includes('"abas_" + sufixoAba'));

    console.log("✓ ABAS grava data-audio-id em cada janela usando a hierarquia oficial");
    console.log("✓ IDs das janelas correspondem aos nomes gerados para o sonorizacao.json");
    console.log("✓ ABAS aninhado herda o caminho hierárquico completo");
    console.log("✓ A reprodução utiliza o ID da janela, sem reconstruir prefixos");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
