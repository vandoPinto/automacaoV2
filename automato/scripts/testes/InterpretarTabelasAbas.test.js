const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
    interpretarTabelasComponentes,
    interpretarTabelaAbas,
    validarTabelasComponentes
} = require("../InterpretarTabelasComponentes");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { GerarJsonAudios } = require("../GerarJsonAudios");

const tabelaAbas = (linhas, extra = "") => `
    <table>
        <tr><td colspan="2"><strong>ABAS</strong></td></tr>
        ${linhas}
        ${extra}
    </table>`;

async function executar() {
    const tabela = tabelaAbas(`
        <tr><td>Título da aba 1</td><td>Conteúdo da janela 1</td></tr>
        <tr><td>Título da aba 2</td><td>Conteúdo da janela 2</td></tr>`);

    const marcadores = interpretarTabelaAbas(tabela);
    assert.equal(
        marcadores,
        "<abas><aba>Título da aba 1<aba>Título da aba 2" +
        "<janela>Conteúdo da janela 1<janela>Conteúdo da janela 2</abas>"
    );

    const tela = `<p>Introdução antes das abas.</p>${tabela}<p>Texto depois das abas.</p>`;
    const convertida = interpretarTabelasComponentes(tela, {
        topico: "Componentes básicos",
        numeroTopico: 1,
        tela: 4
    });
    assert.match(convertida, /Introdução antes das abas\.<\/p>\s*<abas>/);
    assert.match(convertida, /<\/abas>\s*<p>Texto depois das abas\.<\/p>/);
    assert.doesNotMatch(convertida, /<table>/i);

    const html = await processarComponente("tela", convertida, 1, 4);
    assert.equal((html.match(/class="abas-botao/g) || []).length, 2);
    assert.equal((html.match(/class="abas-painel(?: |")/g) || []).length, 2);
    assert.ok(html.includes("Título da aba 1"));
    assert.ok(html.includes("Título da aba 2"));
    assert.ok(html.includes("Conteúdo da janela 1"));
    assert.ok(html.includes("Conteúdo da janela 2"));
    const inicioAbas = html.indexOf('<div class="abas-componente"');
    assert.ok(inicioAbas >= 0, "o HTML deve conter o contêiner do componente ABAS");
    assert.ok(html.indexOf("Introdução antes das abas.") < inicioAbas);
    assert.ok(html.indexOf("Texto depois das abas.") > inicioAbas);

    const tabelaIncompleta = tabelaAbas(`
        <tr><td>Sem conteúdo</td><td></td></tr>
        <tr><td></td><td>Sem título</td></tr>`);
    const erros = validarTabelasComponentes(tabelaIncompleta, {
        topico: "Componentes básicos",
        numeroTopico: 1,
        tela: 4
    });
    assert.equal(erros.length, 2);
    assert.deepEqual(erros.map(erro => erro.numeroLinha), [2, 3]);
    assert.match(erros[0].mensagem, /componente ABAS, linha 2 da tabela\. A aba "Sem conteúdo" está sem conteúdo da aba/);
    assert.match(erros[1].mensagem, /componente ABAS, linha 3 da tabela\. O conteúdo da aba informado \(Sem título\) está sem título da aba/);
    assert.throws(() => interpretarTabelasComponentes(tabelaIncompleta), /Foram encontrados 2 problema\(s\)/);

    const linhaVazia = tabelaAbas(`
        <tr><td>Título da aba</td><td>Painel da aba</td></tr>
        <tr><td></td><td>&nbsp;</td></tr>`);
    assert.equal((interpretarTabelaAbas(linhaVazia).match(/<aba>/g) || []).length, 1);

    const semLinhas = validarTabelasComponentes(tabelaAbas(""), { tela: 4 });
    assert.equal(semLinhas.length, 1);
    assert.match(semLinhas[0].mensagem, /ABAS não possui nenhuma linha de dados válida/);

    const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "automato-abas-tabela-"));
    try {
        const tabelaTopico = `
            <tr><td>Teste</td><td>Componentes básicos</td></tr>
            <tr><td>1</td><td>
                <p>Texto de introdução.</p>
                ${tabela}
            </td></tr>`;
        await GerarJsonAudios([tabelaTopico], {
            sigla: "tst",
            numeroLicao: 1
        }, pasta);

        const json = JSON.parse(await fs.readFile(
            path.join(pasta, "som", "sonorizacao.json"),
            "utf8"
        ));
        const audios = Object.fromEntries(json.audios.tst01.map(audio => [audio.nome, audio.texto]));
        assert.equal(audios["tst01000abas_a.mp3"], "Conteúdo da janela 1");
        assert.equal(audios["tst01000abas_b.mp3"], "Conteúdo da janela 2");
        assert.ok(audios["tst01000.mp3"].includes("Texto de introdução."));
        assert.ok(!audios["tst01000.mp3"].includes("Título da aba 1"));
    } finally {
        await fs.rm(pasta, { recursive: true, force: true });
    }

    console.log("✓ Tabela ABAS gera abas e janelas na ordem das linhas do Word.");
    console.log("✓ Validação centralizada relata títulos ou conteúdos ausentes e ignora linhas vazias.");
    console.log("✓ ABAS preserva o texto vizinho e os IDs de narração das janelas.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
