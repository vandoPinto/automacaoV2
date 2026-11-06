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

        assert(porNome["exe01000.mp3"], "Deve gerar o áudio principal da tela.");
        assert(porNome["exe01000.mp3"].includes("Texto principal da tela"));
        assert(porNome["exe01000.mp3"].includes("Primeiro botão"));
        assert(porNome["exe01000.mp3"].includes("Texto posterior à tela interativa"));
        assert(!porNome["exe01000.mp3"].includes("Texto da primeira janela de botões"));
        assert(porNome["exe01000botoes_a.mp3"].includes("Texto da primeira janela de botões."));
        assert(porNome["exe01000botoes_a_hotword_a.mp3"].includes("Explicação complementar da palavra."));
        assert.strictEqual(porNome["exe01000botoes_b.mp3"], "Texto da segunda janela de botões.");
        assert.strictEqual(porNome["exe01000mininavegacao_a.mp3"], "Texto da primeira janela da mini navegação. Botão interno");
        assert.strictEqual(porNome["exe01000mininavegacao_a_botoes_a.mp3"], "Texto da janela do botão interno.");
        assert.strictEqual(porNome["exe01000mininavegacao_b.mp3"], "Texto da segunda janela da mini navegação.");
        assert.strictEqual(porNome["exe01000abas_a.mp3"], "Texto da primeira aba.");
        assert.strictEqual(porNome["exe01000abas_b.mp3"], "Texto da segunda aba.");
        assert(!porNome["exe01000flashcard_a_frente.mp3"],
            "A frente do flashcard não deve gerar áudio.");
        assert.strictEqual(porNome["exe01000flashcard_a_verso.mp3"], "Verso do cartão.");
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

        // Regressão da tela de ABAS: rótulos das abas e dos BOTÕES internos
        // não entram na narração da tela nem no áudio da janela pai; frentes
        // de FLASHCARD são visuais e somente os versos são narrados.
        const htmlAbas = `
            <table><tr><td>1</td><td>
                <p>Componente ABAS. Texto de inicialização.</p>
                <abas>
                    <aba>Botão da Aba 1</aba>
                    <aba>Botão da Aba 2</aba>
                    <aba>Botão da Aba 3</aba>
                    <aba>Botão da Aba 4</aba>
                    <aba>Botão da Aba 5</aba>
                    <janela><p>Texto da janela da aba 1.</p></janela>
                    <janela><p>Texto da janela da aba 2.</p></janela>
                    <janela>
                        <p>Somente texto centralizado.</p>
                        <botoes>
                            <botao>Clique aqui para saber mais.</botao>
                            <janela><p>Texto explicativo do clique aqui.</p></janela>
                        </botoes>
                    </janela>
                    <janela>
                        <p>Teste de titulo. Texto longo da aba quatro.</p>
                        <hotword>grande<janela>Texto do hotword.</hotword>
                    </janela>
                    <janela>
                        <p>Aqui vamos colocar um flashcard.</p>
                        <flashcard>
                            <frente><p>Descrição visual da frente 1.</p>
                            <verso><p>Prédios a vista.</p>
                            <frente><p>Descrição visual da frente 2.</p>
                            <verso><p>Uma torre.</p>
                        </flashcard>
                    </janela>
                </abas>
                <p>Conteúdo posterior a abas.</p>
            </td></tr></table>`;

        const pastaAbas = path.join(pasta, "abas");
        await GerarJsonAudios([htmlAbas], {
            sigla: "exe",
            numeroLicao: 1
        }, pastaAbas);
        const jsonAbas = JSON.parse(await fs.readFile(
            path.join(pastaAbas, "som", "sonorizacao.json"), "utf8"
        ));
        const audiosAbas = jsonAbas.audios.exe01;
        const porNomeAbas = Object.fromEntries(
            audiosAbas.map(item => [item.nome, item.texto])
        );

        assert(!porNomeAbas["exe01000.mp3"].includes("Botão da Aba"),
            "Os rótulos das abas não devem aparecer no áudio principal.");
        assert(!porNomeAbas["exe01000.mp3"].includes("Descrição visual da frente"),
            "O conteúdo da frente do flashcard não deve aparecer no áudio principal.");
        assert.strictEqual(
            porNomeAbas["exe01000abas_c.mp3"],
            "Somente texto centralizado."
        );
        assert(!porNomeAbas["exe01000abas_c.mp3"].includes("Clique aqui para saber mais"),
            "O rótulo do botão interno não deve aparecer no áudio da aba.");
        assert.strictEqual(
            porNomeAbas["exe01000abas_c_botoes_a.mp3"],
            "Texto explicativo do clique aqui."
        );
        assert(!porNomeAbas["exe01000abas_e_flashcard_a_frente.mp3"],
            "Não deve ser gerado áudio para a frente do primeiro cartão.");
        assert(!porNomeAbas["exe01000abas_e_flashcard_b_frente.mp3"],
            "Não deve ser gerado áudio para a frente do segundo cartão.");
        assert.strictEqual(
            porNomeAbas["exe01000abas_e_flashcard_a_verso.mp3"],
            "Prédios a vista."
        );
        assert.strictEqual(
            porNomeAbas["exe01000abas_e_flashcard_b_verso.mp3"],
            "Uma torre."
        );

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
        assert(nomesAdicionais.includes("exe02000sanfona_a.mp3"));
        assert(nomesAdicionais.includes("exe02000hotword_a.mp3"));
        assert(nomesAdicionais.includes("exe02000botoes_a.mp3"));
        assert(nomesAdicionais.includes("exe02000botoes2_a.mp3"),
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
