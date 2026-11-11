const assert = require("node:assert/strict");
const { interpretarTabelasComponentes } = require("../InterpretarTabelasComponentes");

const entrada = `
<p>Título da tela.</p>
<table>
  <tr><td>1</td><td>
    <p>Texto antes do componente.</p>
    <table>
      <tr><td colspan="2">Botões</td></tr>
      <tr><td>Iniciar</td><td><p>Texto da janela inicial.</p></td></tr>
      <tr><td>Sobre</td><td><p>Informações sobre o curso.</p></td></tr>
    </table>
    <p>Texto depois do componente.</p>
  </td></tr>
</table>`;

const saida = interpretarTabelasComponentes(entrada);
assert.match(saida, /<botoes><botao>Iniciar<\/botao><janela><p>Texto da janela inicial\.<\/p><\/janela><botao>Sobre<\/botao><janela><p>Informações sobre o curso\.<\/p><\/janela><\/botoes>/);
assert.match(saida, /<p>Texto antes do componente\.<\/p>\s*<botoes>/);
assert.match(saida, /<\/botoes>\s*<p>Texto depois do componente\.<\/p>/);
assert.doesNotMatch(saida, /<table>\s*<tr><td colspan="2">Botões/);

const tabelaComum = "<table><tr><td>Nome</td><td>Descrição</td></tr></table>";
assert.equal(interpretarTabelasComponentes(tabelaComum), tabelaComum);

assert.throws(
  () => interpretarTabelasComponentes("<table><tr><td>Botões</td></tr><tr><td>Iniciar</td></tr></table>"),
  /cada linha precisa ter/
);

console.log("✓ Tabela-modelo BOTÕES convertida para marcadores internos.");
console.log("✓ Tabelas comuns preservadas.");
console.log("✓ Linhas incompletas geram mensagem de validação.");

const duasTabelas = `
<p>Começo.</p>
<table><tr><td>Botões</td></tr><tr><td>A</td><td><p>Janela A</p></td></tr></table>
<p>Texto entre componentes.</p>
<table><tr><td>Botões</td></tr><tr><td>B</td><td><p>Janela B</p></td></tr></table>
<p>Fim.</p>`;
const duasSaidas = interpretarTabelasComponentes(duasTabelas);
assert.match(duasSaidas, /Começo\.<\/p>\s*<botoes>[\s\S]*?<\/botoes>\s*<p>Texto entre componentes\.<\/p>\s*<botoes>[\s\S]*?<\/botoes>\s*<p>Fim\.<\/p>/);

console.log("✓ Texto antes e depois do componente permanece no fluxo da tela.");
console.log("✓ Duas tabelas de Botões na mesma tela preservam a ordem e o texto intermediário.");

(async () => {
  const { processarComponente } = require("../ProcessarComponentesAninhados");
  const tela = `
    <p>Título da tela.</p>
    <p>Texto antes da tabela.</p>
    <table>
      <tr><td>Botões</td></tr>
      <tr><td>Iniciar</td><td><p>Conteúdo da janela inicial.</p></td></tr>
      <tr><td>Sobre</td><td><p>Informações do projeto.</p></td></tr>
    </table>
    <p>Este texto deve continuar aparecendo depois dos botões.</p>`;

  const telaConvertida = interpretarTabelasComponentes(tela);
  const htmlGerado = await processarComponente("tela", telaConvertida, 1, 1);
  const posicaoFimScript = htmlGerado.lastIndexOf("</script>");
  const posicaoTextoPosterior = htmlGerado.indexOf("Este texto deve continuar aparecendo depois dos botões.");

  assert.ok(htmlGerado.includes("Título da tela."), "o título precisa ser preservado");
  assert.ok(htmlGerado.includes("botao-item"), "o componente Botões precisa ser renderizado");
  assert.ok(posicaoFimScript >= 0, "o script do componente Botões precisa ser renderizado");
  assert.ok(posicaoTextoPosterior > posicaoFimScript,
    "o texto posterior deve permanecer depois do HTML do componente, fora da última janela");

  console.log("✓ Integração Tela + Botões preserva texto posterior fora da janela do último botão.");
})().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});

(async () => {
  const { processarComponente } = require("../ProcessarComponentesAninhados");
  const telaComDoisComponentes = `
    <p>Início da tela.</p>
    <table><tr><td>Botões</td></tr><tr><td>Primeiro</td><td><p>Janela do primeiro.</p></td></tr></table>
    <p>Texto entre as duas tabelas.</p>
    <table><tr><td>Botões</td></tr><tr><td>Segundo</td><td><p>Janela do segundo.</p></td></tr></table>
    <p>Final da tela.</p>`;
  const convertida = interpretarTabelasComponentes(telaComDoisComponentes);
  const htmlGerado = await processarComponente("tela", convertida, 1, 2);
  const ocorrencias = (htmlGerado.match(/class="botao-grupo"/g) || []).length;
  assert.equal(ocorrencias, 2, "os dois grupos de botões precisam ser renderizados independentemente");
  assert.ok(htmlGerado.includes("Texto entre as duas tabelas."), "o texto intermediário precisa ser preservado");
  assert.ok(htmlGerado.includes("Final da tela."), "o texto após a última tabela precisa ser preservado");
  assert.ok(htmlGerado.includes("Início da tela."), "o texto anterior à primeira tabela precisa ser preservado");
  console.log("✓ Duas tabelas de Botões são renderizadas como grupos independentes, sem consumir textos vizinhos.");
})().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
