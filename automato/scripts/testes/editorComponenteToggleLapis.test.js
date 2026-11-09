const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../../..");
const structure = fs.readFileSync(
  path.join(projectRoot, "assets/js/editor-visual-structure.js"),
  "utf8"
);
const css = fs.readFileSync(
  path.join(projectRoot, "assets/css/editor-componentes.css"),
  "utf8"
);

test("Todos os cartões de componente recebem o botão de lápis ao lado da seta", () => {
  assert.match(structure, /function makeHeader\(type, title, icon = "bi-box"\)/);
  assert.match(structure, /editToggle\.className = "visual-component-pencil-toggle"/);
  assert.match(structure, /editToggle\.dataset\.visualAction = "toggle-pencil"/);
  assert.match(structure, /bi bi-pencil/);
  assert.match(structure, /header\.append\(toggle, editToggle, iconNode/);
  assert.match(structure, /makeHeader\(slug, label, \(\{/);
});

test("O botão de lápis executa a mesma expansão e recolhimento da seta", () => {
  assert.match(structure, /\["toggle", "toggle-pencil"\]\.includes\(action\.dataset\.visualAction\)/);
  assert.match(structure, /syncComponentCollapsedControls\(component, collapsed/);
});

test("Seta e lápis mantêm estado acessível sincronizado", () => {
  assert.match(structure, /pencil\?\.setAttribute\("aria-expanded", String\(!collapsed\)\)/);
  assert.match(structure, /pencil\?\.setAttribute\("aria-label", actionLabel\)/);
  assert.match(structure, /syncComponentCollapsedControls\(child, true/);
});

test("O clique nos dois controles não é bloqueado pelo manipulador de mouse", () => {
  assert.match(structure, /data-visual-action='toggle-pencil'/);
});

test("O botão de lápis tem estilo e indicação visual de foco", () => {
  assert.match(css, /\.visual-component-pencil-toggle\s*\{[^}]*cursor:\s*pointer/s);
  assert.match(css, /\.visual-component-pencil-toggle:hover/);
  assert.match(css, /\.visual-component-pencil-toggle:focus-visible/);
});
