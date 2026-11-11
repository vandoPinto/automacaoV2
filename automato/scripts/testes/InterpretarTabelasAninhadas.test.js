const assert = require("node:assert/strict");
const { interpretarTabelasComponentes } = require("../InterpretarTabelasComponentes");
const { processarComponente } = require("../ProcessarComponentesAninhados");

const tabelaForca = `
  <table>
    <tr><td><p><strong>FORCA</strong></p></td></tr>
    <tr><td><p>ABACAXI</p></td></tr>
    <tr><td><p>Fruta tropical</p></td></tr>
    <tr><td><p>Muito bem! Você descobriu a palavra!</p></td></tr>
    <tr><td><p>A palavra era ABACAXI. Tente novamente.</p></td></tr>
  </table>`;

function tabelaBotoes(janelas) {
  return `
    <table>
      <tr><td colspan="2"><p><strong>BOTÕES</strong></p></td></tr>
      ${janelas.map(({ rotulo, conteudo }) =>
        `<tr><td><p>${rotulo}</p></td><td>${conteudo}</td></tr>`
      ).join("\n")}
    </table>`;
}

function tabelaMiniNavegacao(janelas) {
  return `
    <table>
      <tr><td><p><strong>MINI NAVEGAÇÃO</strong></p></td></tr>
      ${janelas.map(conteudo => `<tr><td>${conteudo}</td></tr>`).join("\n")}
    </table>`;
}

function tabelaHotword(termo) {
  return `<table><tr><td colspan="2"><strong>HOTWORD</strong></td></tr>` +
    `<tr><td>${termo}</td><td>Explicação de ${termo}.</td></tr></table>`;
}

async function verificarMiniNavegacaoComForcaEBotoes() {
  const tela = `<p>Teste de componentes aninhados.</p>${tabelaMiniNavegacao([
    tabelaForca,
    tabelaBotoes([
      { rotulo: "Botão 1", conteudo: "Conteúdo do primeiro botão." },
      { rotulo: "Botão 2", conteudo: "Conteúdo do segundo botão." }
    ])
  ])}`;

  const convertida = interpretarTabelasComponentes(tela, { topico: "Teste", tela: 10 });
  assert.doesNotMatch(convertida, /<table\b/i, "as tabelas de componente filhas devem ser convertidas primeiro");
  assert.match(convertida, /<mininavegacao><janela><componente tipo="forca">/);
  assert.match(convertida, /<janela><botoes><botao><p>Botão 1<\/p><\/botao>/);

  const html = await processarComponente("tela", convertida, 1, 10);
  assert.match(html, /class="mini-nav-componente"/);
  assert.match(html, /class="forca-componente"/);
  assert.match(html, /class="botao-grupo"/);
  assert.doesNotMatch(html, /<table\b/i, "nenhuma tabela-modelo deve aparecer crua no curso gerado");
}

async function verificarAninhamentoRecursivoEmTresNiveis() {
  const miniNavegacaoInterna = tabelaMiniNavegacao([
    `<p>Etapa interna.</p>${tabelaForca}`
  ]);
  const botoes = tabelaBotoes([
    { rotulo: "Abrir etapa", conteudo: miniNavegacaoInterna }
  ]);
  const tela = tabelaMiniNavegacao([
    `<p>Etapa externa.</p>${botoes}`
  ]);

  const convertida = interpretarTabelasComponentes(tela, { topico: "Teste", tela: 11 });
  assert.doesNotMatch(convertida, /<table\b/i);
  assert.match(convertida, /<mininavegacao><janela>[\s\S]*?<botoes>/);
  assert.match(convertida, /<janela><mininavegacao><janela>[\s\S]*?<componente tipo="forca">/);

  const html = await processarComponente("tela", convertida, 1, 11);
  assert.equal((html.match(/class="mini-nav-componente"/g) || []).length, 2);
  assert.equal((html.match(/class="forca-componente"/g) || []).length, 1);
  assert.match(html, /class="botao-grupo"/);
  assert.doesNotMatch(html, /<table\b/i);
}

function verificarHotwordsFilhasNaoConsomemLimiteDaTela() {
  const abas = `<table><tr><td colspan="2"><strong>ABAS</strong></td></tr>` +
    `<tr><td>Conceitos</td><td>fotossíntese e clorofila: ${tabelaHotword("fotossíntese")} ${tabelaHotword("clorofila")}</td></tr></table>`;
  const convertida = interpretarTabelasComponentes(abas, { topico: "Teste", tela: 12 });
  assert.doesNotMatch(convertida, /<table\b/i);
  assert.match(convertida, /<abas>[\s\S]*?<hotword>fotossíntese<janela>/);
  assert.match(convertida, /<hotword>clorofila<janela>/);
  assert.deepEqual(interpretarTabelasComponentes(abas).match(/<hotword>/g), ["<hotword>", "<hotword>"]);

  const duasHotwordsDeRaiz = `${tabelaHotword("fotossíntese")}${tabelaHotword("clorofila")}`;
  const hotwordsDeRaizConvertidas = interpretarTabelasComponentes(
    `<p>fotossíntese.</p>${tabelaHotword("fotossíntese")}<p>clorofila.</p>${tabelaHotword("clorofila")}`,
    { topico: "Teste", tela: 13 }
  );
  assert.equal((hotwordsDeRaizConvertidas.match(/<componente tipo="hotword">/g) || []).length, 2);
  assert.match(hotwordsDeRaizConvertidas, /<componente tipo="hotword"><p>fotossíntese\.<\/p><hotword>fotossíntese/);
  assert.match(hotwordsDeRaizConvertidas, /<componente tipo="hotword"><p>clorofila\.<\/p><hotword>clorofila/);
  assert.doesNotMatch(hotwordsDeRaizConvertidas, /__AUTOMATO_TABELA_HOTWORD_/);
}

Promise.all([
  verificarMiniNavegacaoComForcaEBotoes(),
  verificarAninhamentoRecursivoEmTresNiveis(),
  Promise.resolve().then(verificarHotwordsFilhasNaoConsomemLimiteDaTela)
]).then(() => {
  console.log("✓ MINI NAVEGAÇÃO converte FORCA e BOTÕES dentro das janelas.");
  console.log("✓ Tabelas de componentes são processadas recursivamente em três níveis.");
  console.log("✓ HOTWORDs dentro de componentes não consomem o limite de HOTWORDs da tela.");
}).catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
