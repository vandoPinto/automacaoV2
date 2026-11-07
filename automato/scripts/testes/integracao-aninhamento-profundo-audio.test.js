const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const {
    processarRegiao,
    normalizarMarcadores
} = require("../ExtrairAudiosComponentes");

function extrairIdsHTML(html) {
    return [...String(html || "").matchAll(/\bdata-audio-id=["']([^"']+)["']/gi)]
        .map(match => match[1]);
}

function extrairIdsJSON(roteiro) {
    return processarRegiao(normalizarMarcadores(roteiro)).audios
        .map(audio => audio.nomeSufixo);
}

function validarIds(nome, html, roteiro, idHierarquicoObrigatorio) {
    const idsHTML = extrairIdsHTML(html);
    const idsJSON = extrairIdsJSON(roteiro);
    const duplicados = idsHTML.filter((id, indice) => idsHTML.indexOf(id) !== indice);

    assert(idsHTML.length > 0, `${nome}: o HTML não gerou identificadores de áudio.`);
    assert.deepStrictEqual(
        idsHTML,
        idsJSON,
        `${nome}: IDs do HTML divergentes dos IDs extraídos para o sonorizacao.json.\nHTML: ${idsHTML.join(", ")}\nJSON: ${idsJSON.join(", " )}`
    );
    assert.deepStrictEqual(duplicados, [], `${nome}: existem IDs duplicados no HTML.`);
    assert(
        idsHTML.includes(idHierarquicoObrigatorio),
        `${nome}: não foi encontrado o identificador que comprova a cadeia hierárquica ${idHierarquicoObrigatorio}.`
    );

    console.log(`✓ ${nome}: ${idsHTML.length} IDs correspondentes, sem duplicidade; cadeia ${idHierarquicoObrigatorio}.`);
}

const miniAbasSanfona = `
<componente tipo="mininavegacao">
    <janela>
        <p>Introdução da primeira janela da MININAVEGACAO.</p>
        <componente tipo="abas">
            <aba>Primeira aba</aba>
            <janela>
                <p>Conteúdo da primeira aba.</p>
                <componente tipo="sanfona">
                    <botao>Painel A</botao>
                    <janela><p>Conteúdo do painel A.</p></janela>
                    <botao>Painel B</botao>
                    <janela><p>Conteúdo do painel B.</p></janela>
                </componente>
            </janela>
            <aba>Segunda aba</aba>
            <janela><p>Conteúdo da segunda aba.</p></janela>
        </componente>
    </janela>
    <janela><p>Segunda janela da MININAVEGACAO.</p></janela>
</componente>`;

const abasMiniSanfona = `
<componente tipo="abas">
    <aba>Aba principal</aba>
    <janela>
        <p>Conteúdo da aba principal.</p>
        <componente tipo="mininavegacao">
            <janela>
                <p>Primeira janela interna.</p>
                <componente tipo="sanfona">
                    <botao>Painel interno A</botao>
                    <janela><p>Texto do painel interno A.</p></janela>
                    <botao>Painel interno B</botao>
                    <janela><p>Texto do painel interno B.</p></janela>
                </componente>
            </janela>
            <janela><p>Segunda janela interna.</p></janela>
        </componente>
    </janela>
    <aba>Outra aba</aba>
    <janela><p>Conteúdo da outra aba.</p></janela>
</componente>`;

const sanfonaMiniAbas = `
<componente tipo="sanfona">
    <botao>Painel externo A</botao>
    <janela>
        <p>Conteúdo do painel externo.</p>
        <componente tipo="mininavegacao">
            <janela>
                <p>Janela da MININAVEGACAO.</p>
                <componente tipo="abas">
                    <aba>Aba aninhada</aba>
                    <janela><p>Conteúdo da aba aninhada.</p></janela>
                </componente>
            </janela>
            <janela><p>Outra janela da MININAVEGACAO.</p></janela>
        </componente>
    </janela>
    <botao>Painel externo B</botao>
    <janela><p>Segundo conteúdo do painel externo.</p></janela>
</componente>`;

const miniAbasSanfonaFlashcard = `
<componente tipo="mininavegacao">
    <janela>
        <componente tipo="abas">
            <aba>Aba com conteúdo aninhado</aba>
            <janela>
                <componente tipo="sanfona">
                    <botao>Painel com FLASHCARD</botao>
                    <janela>
                        <componente tipo="flashcard">
                            <frente><p>Frente do cartão A.</p>
                            <verso>
                                <p>O termo autonomia aparece aqui.</p>
                                <componente tipo="hotword">
                                    <p>O termo autonomia aparece aqui.</p>
                                    <hotword>autonomia</hotword>
                                    <janela><p>Explicação da HOTWORD no verso.</p></janela>
                                </componente>
                                <componente tipo="botao">
                                    <botao>Ver explicação adicional</botao>
                                    <janela><p>Conteúdo do BOTÃO no verso.</p></janela>
                                </componente>
                            <frente><p>Frente do cartão B.</p>
                            <verso><p>Verso do cartão B.</p>
                        </componente>
                    </janela>
                </componente>
            </janela>
        </componente>
    </janela>
</componente>`;

const abasSanfonaFlashcardBotaoHotword = `
<componente tipo="abas">
    <aba>Integração profunda</aba>
    <janela>
        <componente tipo="sanfona">
            <botao>Painel com cartão</botao>
            <janela>
                <componente tipo="flashcard">
                    <frente><p>Frente do cartão.</p>
                    <verso>
                        <p>Conteúdo narrado do verso.</p>
                        <componente tipo="botao">
                            <botao>Detalhes</botao>
                            <janela>
                                <p>Texto com o termo independente.</p>
                                <componente tipo="hotword">
                                    <p>Texto com o termo independente.</p>
                                    <hotword>independente</hotword>
                                    <janela><p>Explicação da HOTWORD em nível profundo.</p></janela>
                                </componente>
                            </janela>
                        </componente>
                </componente>
            </janela>
        </componente>
    </janela>
</componente>`;

async function executar() {
    const casos = [
        ["MININAVEGACAO > ABAS > SANFONA", miniAbasSanfona, "mininavegacao_a_abas_a_sanfona_b"],
        ["ABAS > MININAVEGACAO > SANFONA", abasMiniSanfona, "abas_a_mininavegacao_a_sanfona_b"],
        ["SANFONA > MININAVEGACAO > ABAS", sanfonaMiniAbas, "sanfona_a_mininavegacao_a_abas_a"],
        ["MININAVEGACAO > ABAS > SANFONA > FLASHCARD com HOTWORD e BOTAO", miniAbasSanfonaFlashcard, "mininavegacao_a_abas_a_sanfona_a_flashcard_a_hotword_a"],
        ["ABAS > SANFONA > FLASHCARD > BOTAO > HOTWORD", abasSanfonaFlashcardBotaoHotword, "abas_a_sanfona_a_flashcard_a_botoes_a_hotword_a"]
    ];

    for (let i = 0; i < casos.length; i++) {
        const [nome, roteiro, idHierarquicoObrigatorio] = casos[i];
        const html = await processarComponente("tela", roteiro, 1, 900 + i);
        validarIds(nome, html, roteiro, idHierarquicoObrigatorio);
    }

    console.log("\nTodos os cenários de aninhamento profundo passaram.");
}

executar().catch(erro => {
    console.error("\nFalha no teste de integração profunda:");
    console.error(erro.stack || erro);
    process.exitCode = 1;
});
