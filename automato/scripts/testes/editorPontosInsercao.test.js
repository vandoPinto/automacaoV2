const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../../..");
const structure = fs.readFileSync(path.join(projectRoot, "assets/js/editor-visual-structure.js"), "utf8");
const css = fs.readFileSync(path.join(projectRoot, "assets/css/editor-componentes.css"), "utf8");

test("A Tela cria um ponto de inserção antes do primeiro componente e depois dos componentes sem área seguinte", () => {
  assert.match(structure, /function ensureRootTextGaps\(\)[\s\S]*?if \(first\?\.matches\("\.visual-component"\)\)[\s\S]*?root\.insertBefore\(createEmptyTextBlock/);
  assert.match(structure, /if \(!next \|\| next\.matches\("\.visual-component"\)\)[\s\S]*?createEmptyTextBlock/);
  assert.match(structure, /ensureRootTextGaps\(\);/);
});

test("Pontos de inserção vazios não são serializados para o HTML final", () => {
  assert.match(structure, /if \(node\.matches\("\.visual-empty-block"\)\) return ""/);
});

test("O clique em um ponto vazio registra a posição para inserir texto ou componente", () => {
  assert.match(structure, /const textBlock = event\.target\.closest\?\.\("\.visual-text-block"\)/);
  assert.match(structure, /lastRange = range\.cloneRange\(\)/);
  assert.match(structure, /function targetRange\(\)[\s\S]*?lastRange[\s\S]*?return lastRange\.cloneRange\(\)/);
});

test("É possível colar ou arrastar imagens diretamente para um ponto de inserção", () => {
  assert.match(structure, /const target = slot \|\| textBlock/);
  assert.match(structure, /insertImageFile\(file, target, range\)/);
});

test("Os pontos de inserção são discretos, mas continuam clicáveis", () => {
  const rule = css.match(/\.visual-text-block\.visual-empty-block\s*\{([^}]*)\}/)?.[1] || "";
  assert.match(rule, /min-height/);
  assert.match(rule, /cursor:\s*text/);
  assert.match(rule, /background:\s*transparent/);
  assert.doesNotMatch(rule, /display:\s*none/);
});
