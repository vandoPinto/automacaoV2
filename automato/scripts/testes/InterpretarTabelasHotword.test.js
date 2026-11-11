const assert = require("node:assert/strict");
const {
  interpretarTabelasComponentes,
  interpretarTabelaHotword
} = require("../InterpretarTabelasComponentes");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { CriarTela } = require("../CriarTela");
const { GerarJsonAudios } = require("../GerarJsonAudios");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function executar() {
  const tabela = `
    <table>
      <tr><td colspan="2">HOTWORD</td></tr>
      <tr><td>Luz solar</td><td><p>Energia emitida pelo Sol.</p></td></tr>
      <tr><td>Agricultura familiar</td><td><p>Forma de produção agrícola baseada no trabalho da família.</p></td></tr>
    </table>`;

  const marcadores = interpretarTabelaHotword(tabela);
  assert.match(marcadores, /<hotword>Luz solar<janela><p>Energia emitida pelo Sol\.<\/p>/);
  assert.match(marcadores, /<hotword>Agricultura familiar<janela><p>Forma de produção agrícola baseada no trabalho da família\.<\/p>/);

  const tela = `
    <p>A <strong>luz solar</strong> é essencial para a fotossíntese. A <em>agricultura familiar</em> tem grande importância.</p>
    ${tabela}
    <p>Este texto posterior à tabela deve continuar visível na tela.</p>`;

  const convertida = interpretarTabelasComponentes(tela);
  assert.match(convertida, /^\s*<componente tipo="hotword">/);
  assert.match(convertida, /<hotword>Luz solar<janela>/);
  assert.match(convertida, /<hotword>Agricultura familiar<janela>/);
  assert.match(convertida, /<\/componente>\s*<p>Este texto posterior à tabela deve continuar visível na tela\.<\/p>$/);
  assert.doesNotMatch(convertida, /<table>/i);

  const html = await processarComponente("tela", convertida, 1, 31);
  assert.equal((html.match(/class="hotword-gatilho"/g) || []).length, 2,
    "as duas expressões, incluindo a expressão com duas palavras, devem virar gatilhos");
  assert.equal((html.match(/class="hotword-janela"/g) || []).length, 2,
    "cada expressão deve gerar sua própria janela");
  assert.ok(html.includes("Energia emitida pelo Sol."));
  assert.ok(html.includes("Forma de produção agrícola baseada no trabalho da família."));
  assert.ok(html.includes("Este texto posterior à tabela deve continuar visível na tela."));
  assert.ok(
    html.indexOf("</div>") < html.indexOf("Este texto posterior à tabela deve continuar visível na tela."),
    "o texto posterior deve ficar fora do componente HOTWORD"
  );

  const pastaSaida = await fs.mkdtemp(path.join(os.tmpdir(), "automato-hotword-tela-"));
  try {
    const caminhoTela = await CriarTela(
      1,
      3,
      tela,
      pastaSaida,
      { sigla: "tst", numeroLicao: 1 },
      0
    );
    const htmlTela = await fs.readFile(caminhoTela, "utf8");
    assert.equal((htmlTela.match(/class="hotword-gatilho"/g) || []).length, 2,
      "CriarTela deve gerar os gatilhos de ambas as expressões");
    assert.ok(htmlTela.includes("Este texto posterior à tabela deve continuar visível na tela."));
    assert.ok(htmlTela.includes('data-audio-id="hotword_a"'));
    assert.ok(htmlTela.includes('data-audio-id="hotword_b"'));
  } finally {
    await fs.rm(pastaSaida, { recursive: true, force: true });
  }

  const tabelaComum = "<table><tr><td>Nome</td><td>Descrição</td></tr></table>";
  assert.equal(interpretarTabelasComponentes(tabelaComum), tabelaComum,
    "tabelas sem cabeçalho HOTWORD devem permanecer intactas");

  assert.throws(
    () => interpretarTabelaHotword("<table><tr><td>HOTWORD</td></tr><tr><td>Termo</td></tr></table>"),
    /cada linha precisa ter/
  );

  const pastaTemporaria = await fs.mkdtemp(path.join(os.tmpdir(), "automato-hotword-tabela-"));
  try {
    const tabelaTopico = `
      <tr><td>Teste</td><td>Componentes básicos</td></tr>
      <tr>
        <td>1</td>
        <td>
          <p>O uso da luz solar é essencial. A agricultura familiar é importante.</p>
          ${tabela}
          <p>Texto posterior preservado.</p>
        </td>
      </tr>`;
    await GerarJsonAudios([tabelaTopico], { sigla: "tst", numeroLicao: 1 }, pastaTemporaria);
    const jsonAudio = JSON.parse(await fs.readFile(
      path.join(pastaTemporaria, "som", "sonorizacao.json"), "utf8"
    ));
    const audiosGerados = jsonAudio.audios.tst01;
    const nomes = audiosGerados.map(item => item.nome);
    assert.ok(nomes.includes("tst01000hotword_a.mp3"),
      "a primeira expressão precisa receber o ID de áudio hotword_a");
    assert.ok(nomes.includes("tst01000hotword_b.mp3"),
      "a segunda expressão precisa receber o ID de áudio hotword_b");
    assert.ok(audiosGerados.find(item => item.nome === "tst01000hotword_a.mp3").texto.includes("Energia emitida pelo Sol."));
    assert.ok(audiosGerados.find(item => item.nome === "tst01000hotword_b.mp3").texto.includes("Forma de produção agrícola"));
    assert.ok(audiosGerados.find(item => item.nome === "tst01000.mp3").texto.includes("Texto posterior preservado."));
  } finally {
    await fs.rm(pastaTemporaria, { recursive: true, force: true });
  }

  console.log("✓ Tabela HOTWORD é identificada pelo cabeçalho.");
  console.log("✓ Palavra e expressão de várias palavras são convertidas corretamente.");
  console.log("✓ Cada expressão gera seu gatilho e sua janela no HTML.");
  console.log("✓ O texto posterior à tabela permanece fora da HOTWORD.");
  console.log("✓ Tabelas comuns permanecem intactas e linhas incompletas são validadas.");
  console.log("✓ Sonorização gera IDs independentes para cada linha da tabela HOTWORD.");
  console.log("✓ CriarTela converte a tabela HOTWORD em gatilhos, janelas e IDs de áudio.");
}

executar().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
