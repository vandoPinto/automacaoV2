const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { GerarJsonAudios } = require("../GerarJsonAudios");
const { processarRegiao, normalizarMarcadores } = require("../ExtrairAudiosComponentes");

async function executar() {
    const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "automato-audios-"));
    try {
        const html = `
            <table><tr><td>1</td><td>
                <p>Texto principal da tela.</p>
                <botoes>
                    <botao>Primeiro botão</botao>
                    <janela><p>Texto da primeira janela de botões.</p>
                        <hotword>palavra<janela>Explicação complementar da palavra.</hotword>
                    </janela>
                    <botao>Segundo botão</botao>
                    <janela><p>Texto da segunda janela de botões.</p></janela>
                </botoes>
                <mininavegacao>
                    <janela>
                        <p>Texto da primeira janela da mini navegação.</p>
                        <botoes>
                            <botao>Botão interno</botao>
                            <janela><p>Texto da janela do botão interno.</p></janela>
                        </botoes>
                    <janela><p>Texto da segunda janela da mini navegação.</p>
                </mininavegacao>
                <abas>
                    <aba>Primeira aba</aba><aba>Segunda aba</aba>
                    <janela><p>Texto da primeira aba.</p></janela>
                    <janela><p>Texto da segunda aba.</p></janela>
                </abas>
                <flashcard>
                    <frente><p>Frente do cartão.</p>
                    <verso><p>Verso do cartão.</p>
                </flashcard>
                <p>Texto posterior à tela interativa.</p>
            </td></tr></table>`;

        await GerarJsonAudios([html], {
            sigla: "exe",
            numeroLicao: 1
        }, pasta);

        const arquivo = path.join(pasta, "som", "sonorizacao.json");
        const json = JSON.parse(await fs.readFile(arquivo, "utf8"));
        const audios = json.audios.exe01;
        const porNome = Object.fromEntries(audios.map(item => [item.nome, item.texto]));

        assert(porNome["exe01001.mp3"], "Deve gerar o áudio principal da tela.");
        assert(porNome["exe01001.mp3"].includes("Texto principal da tela"));
        assert(porNome["exe01001.mp3"].includes("Primeiro botão"));
        assert(porNome["exe01001.mp3"].includes("Texto posterior à tela interativa"));
        assert(!porNome["exe01001.mp3"].includes("Texto da primeira janela de botões"));
        assert(porNome["exe01001botoes_a.mp3"].includes("Texto da primeira janela de botões."));
        assert(porNome["exe01001botoes_a_hotword_a.mp3"].includes("Explicação complementar da palavra."));
        assert.strictEqual(porNome["exe01001botoes_b.mp3"], "Texto da segunda janela de botões.");
        assert.strictEqual(porNome["exe01001mininavegacao_a.mp3"], "Texto da primeira janela da mini navegação. Botão interno");
        assert.strictEqual(porNome["exe01001mininavegacao_a_botoes_a.mp3"], "Texto da janela do botão interno.");
        assert.strictEqual(porNome["exe01001mininavegacao_b.mp3"], "Texto da segunda janela da mini navegação.");
        assert.strictEqual(porNome["exe01001abas_a.mp3"], "Texto da primeira aba.");
        assert.strictEqual(porNome["exe01001abas_b.mp3"], "Texto da segunda aba.");
        assert.strictEqual(porNome["exe01001flashcard_a_frente.mp3"], "Frente do cartão.");
        assert.strictEqual(porNome["exe01001flashcard_a_verso.mp3"], "Verso do cartão.");
        const wrappers = `
            <componente tipo="mininavegacao">
                <janela>
                    Texto da janela do wrapper.
                    <componente tipo="botao">
                        <botao>Botão universal</botao>
                        <janela>Conteúdo do botão universal.</janela>
                    </componente>
                <janela>Segunda janela do wrapper.
            </componente>`;
        const resultadoWrappers = processarRegiao(normalizarMarcadores(wrappers));
        assert(resultadoWrappers.audios.some(item =>
            item.nomeSufixo === "mininavegacao_a" &&
            item.texto.includes("Texto da janela do wrapper")
        ));
        assert(resultadoWrappers.audios.some(item =>
            item.nomeSufixo === "mininavegacao_a_botoes_a" &&
            item.texto.includes("Conteúdo do botão universal")
        ));
        assert(resultadoWrappers.audios.some(item =>
            item.nomeSufixo === "mininavegacao_b" &&
            item.texto.includes("Segunda janela do wrapper")
        ));

        const htmlAdicional = `
            <table><tr><td>1</td><td>
                <p>Texto de outra tela.</p>
                <sanfona>
                    <botao>Painel</botao><janela>Texto do painel da sanfona.</janela>
                </sanfona>
                <hotword>termo destacado<janela>Explicação da hotword.</hotword>
                <botoes>
                    <botao>Grupo um</botao><janela>Janela do grupo um.</janela>
                </botoes>
                <botoes>
                    <botao>Grupo dois</botao><janela>Janela do grupo dois.</janela>
                </botoes>
            </td></tr></table>`;
        const pastaAdicional = path.join(pasta, "adicional");
        await GerarJsonAudios([htmlAdicional], {
            sigla: "exe",
            numeroLicao: 2
        }, pastaAdicional);
        const jsonAdicional = JSON.parse(await fs.readFile(
            path.join(pastaAdicional, "som", "sonorizacao.json"), "utf8"
        ));
        const nomesAdicionais = jsonAdicional.audios.exe02.map(item => item.nome);
        assert(nomesAdicionais.includes("exe02001sanfona_a.mp3"));
        assert(nomesAdicionais.includes("exe02001hotword_a.mp3"));
        assert(nomesAdicionais.includes("exe02001botoes_a.mp3"));
        assert(nomesAdicionais.includes("exe02001botoes2_a.mp3"),
            "Componentes do mesmo tipo no mesmo nível precisam de nomes exclusivos.");
        console.log("GerarJsonAudios.test.js - Todos os testes passaram.");
    } finally {
        await fs.rm(pasta, { recursive: true, force: true });
    }
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
