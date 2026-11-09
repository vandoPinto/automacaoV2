const test = require("node:test");
const assert = require("node:assert/strict");
const { renderizarPreviewComponente } = require("../EditorPreview");

const fonteTela = `
<p data-automato-inspect-id="tela-paragrafo">Texto livre diretamente na Tela.</p>
<div data-automato-inspect-id="tela-sanfona" style="display:contents">
  <componente tipo="sanfona">
    <botao><div data-automato-inspect-id="sanfona-titulo">Título da Sanfona</div>
    <janela><div data-automato-inspect-id="sanfona-conteudo">Conteúdo interno da Sanfona.</div>
  </componente>
</div>
<div data-automato-inspect-id="tela-botoes" style="display:contents">
  <componente tipo="botao">
    <botao><div data-automato-inspect-id="botoes-rotulo-1">Botão 1</div>
    <janela><div data-automato-inspect-id="botoes-janela-1">Janela 1</div>
    <botao><div data-automato-inspect-id="botoes-rotulo-2">Botão 2</div>
    <janela><div data-automato-inspect-id="botoes-janela-2">Janela 2</div>
  </componente>
</div>`;

test("Tela mantém a identidade do texto livre sem inserir uma DIV estrutural", async () => {
  const html = await renderizarPreviewComponente("tela", fonteTela);
  assert.match(html, /data-automato-inspect-id="tela-paragrafo"/);
  assert.match(html, /Texto livre diretamente na Tela/);
  assert.doesNotMatch(
    html,
    /<div\b[^>]*data-automato-inspect-id="tela-paragrafo"[^>]*style="display:contents"/i,
    "O texto livre não deve ganhar um contêiner extra que altere a organização da Tela."
  );
});

test("Tela continua dividindo texto e imagem em itens irmãos e mantém os IDs", async () => {
  const fonte = '<p data-automato-inspect-id="texto-tela">Texto antes da imagem.</p>' +
    '<img data-automato-inspect-id="imagem-tela" src="/imagens/exemplo.png" alt="Exemplo">';
  const html = await renderizarPreviewComponente("tela", fonte);

  assert.match(html, /class="conteudo-item[^"]*" data-tipo="texto"/);
  assert.match(html, /class="conteudo-item[^"]*" data-tipo="imagem"/);
  assert.match(html, /data-automato-inspect-id="texto-tela"/);
  assert.match(html, /data-automato-inspect-id="imagem-tela"/);
  assert.equal((html.match(/class="conteudo-item[^"]*" data-tipo="(?:texto|imagem)"/g) || []).length, 2,
    "Texto e imagem devem ser renderizados em dois .conteudo-item independentes.");
});

test("Tela divide imagem inserida no meio do parágrafo sem perder a ordem", async () => {
  const fonte = '<p data-automato-inspect-id="paragrafo-misto">Texto antes <strong>em destaque</strong> ' +
    '<img data-automato-inspect-id="imagem-no-meio" src="/imagens/foto.png" alt="Foto"> texto depois.</p>';
  const html = await renderizarPreviewComponente("tela", fonte);
  const tipos = [...html.matchAll(/class="conteudo-item[^"]*" data-tipo="(texto|imagem)"/g)].map(match => match[1]);

  assert.deepEqual(tipos, ["texto", "imagem", "texto"]);
  assert.match(html, /data-automato-inspect-id="paragrafo-misto"/);
  assert.match(html, /data-automato-inspect-id="imagem-no-meio"/);
  assert.ok(html.indexOf("Texto antes") < html.indexOf("imagem-no-meio"));
  assert.ok(html.indexOf("imagem-no-meio") < html.indexOf("texto depois"));
});

test("Tela preserva identificadores para componentes de tipos diferentes e seus conteúdos", async () => {
  const html = await renderizarPreviewComponente("tela", fonteTela);
  const ids = [
    "tela-sanfona", "sanfona-titulo", "sanfona-conteudo",
    "tela-botoes", "botoes-rotulo-1", "botoes-janela-1",
    "botoes-rotulo-2", "botoes-janela-2"
  ];
  for (const id of ids) {
    assert.equal(
      (html.match(new RegExp(`data-automato-inspect-id="${id}"`, "g")) || []).length,
      1,
      `O identificador ${id} deve aparecer uma única vez na prévia.`
    );
  }
});

test("Tela mantém identificador de imagem para inspeção direta", async () => {
  const source = '<div data-automato-inspect-id="imagem-na-tela" style="display:contents"><img data-automato-inspect-id="imagem-alvo" src="/imagens/exemplo.png" alt="Imagem de exemplo"></div>';
  const html = await renderizarPreviewComponente("tela", source);
  assert.match(html, /data-automato-inspect-id="imagem-na-tela"/);
  assert.match(html, /data-automato-inspect-id="imagem-alvo"/);
});

test("Editor e prévia compartilham o mesmo identificador de origem", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const projectRoot = path.resolve(__dirname, "../../..");
  const serializer = fs.readFileSync(path.join(projectRoot, "assets/js/editor-visual-structure.js"), "utf8");
  const editor = fs.readFileSync(path.join(projectRoot, "assets/js/editor-componentes.js"), "utf8");
  assert.ok(serializer.includes("function wrapInspectOrigin(node, content)"));
  assert.ok(serializer.includes("const id = inspectOriginId(node);"),
    "O bloco de texto editável deve receber uma identidade própria durante a serialização.");
  assert.ok(serializer.includes('<p data-automato-inspect-id="${escapeHtml(id)}">${content}</p>'),
    "O P já gerado para texto digitado diretamente deve carregar a identidade do bloco, sem uma DIV extra.");
  assert.ok(serializer.includes('<span data-automato-inspect-id="${escapeHtml(id)}">${escapeHtml(texto)}</span>'),
    "Nós de texto puros intercalados com blocos HTML devem receber um marcador inline invisível.");
  assert.ok(serializer.includes("data-automato-inspect-id"));
  assert.ok(editor.includes('target.closest("[data-automato-inspect-id]")'));
  assert.ok(editor.includes("originId"));
  assert.ok(editor.includes('node.getAttribute("data-automato-inspect-id") === originId'));
});


test("Texto digitado mantém sua identidade no HTML final da prévia", async () => {
  // Representa o P produzido pelo serializador para o texto digitado
  // diretamente dentro de .visual-text-block (sem tags criadas pelo usuário).
  const html = await renderizarPreviewComponente(
    "tela",
    '<p data-automato-inspect-id="texto-digitado-1">Texto escrito diretamente no editor.</p>'
  );
  assert.match(html, /data-automato-inspect-id="texto-digitado-1"/);
  assert.match(html, /Texto escrito diretamente no editor/);
});

test("Texto colado em vários parágrafos preserva a identidade de cada origem", async () => {
  const html = await renderizarPreviewComponente(
    "tela",
    '<p data-automato-inspect-id="texto-colado-1">Primeiro parágrafo colado.</p>' +
    '<p data-automato-inspect-id="texto-colado-2">Segundo parágrafo colado.</p>'
  );
  assert.match(html, /data-automato-inspect-id="texto-colado-1"/);
  assert.match(html, /data-automato-inspect-id="texto-colado-2"/);
  assert.ok(html.indexOf("Primeiro parágrafo colado") < html.indexOf("Segundo parágrafo colado"));
});

test("Texto livre com marcadores permanece inspecionável antes e depois de componente", async () => {
  const html = await renderizarPreviewComponente(
    "tela",
    '<p data-automato-inspect-id="texto-antes">Texto livre antes.</p>' +
    '<div data-automato-inspect-id="componente-meio" style="display:contents">' +
      '<componente tipo="sanfona"><botao>Título</botao><janela>Conteúdo</janela></componente>' +
    '</div>' +
    '<p data-automato-inspect-id="texto-depois">Texto livre depois.</p>'
  );
  for (const id of ["texto-antes", "componente-meio", "texto-depois"]) {
    assert.match(html, new RegExp(`data-automato-inspect-id="${id}"`));
  }
});

test("Conteúdo da janela de Botões mantém a identidade inspecionável no diálogo aberto", async () => {
  const html = await renderizarPreviewComponente(
    "tela",
    '<componente tipo="botao">' +
      '<botao><p data-automato-inspect-id="botao-rotulo">Abrir janela</p></botao>' +
      '<janela><p data-automato-inspect-id="botao-janela-paragrafo">Texto dentro da janela.</p>' +
      '<p data-automato-inspect-id="botao-janela-segundo">Segundo parágrafo.</p></janela>' +
    '</componente>'
  );
  assert.match(html, /class="botao-janela-texto"[\s\S]*data-automato-inspect-id="botao-janela-paragrafo"/);
  assert.match(html, /data-automato-inspect-id="botao-janela-segundo"/);
  assert.match(html, /role="dialog"/);
});
