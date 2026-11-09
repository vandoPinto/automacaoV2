const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../../..");
const editor = fs.readFileSync(path.join(projectRoot, "assets/js/editor-componentes.js"), "utf8");
const css = fs.readFileSync(path.join(projectRoot, "assets/css/editor-componentes.css"), "utf8");

test("Inspeção em controles usa o identificador do conteúdo clicável", () => {
  assert.match(editor, /const interactive = target\.closest\("button, a, \[role='button'\]"\)/);
  assert.match(editor, /interactive\?\.querySelector\("\[data-automato-inspect-id\]"\)/);
  assert.match(editor, /const origin = interactiveOrigin \|\| target\.closest/);
});

test("Inspeção destaca o conjunto repetível mais interno do campo localizado", () => {
  assert.match(editor, /function resolveInspectionGroup\(node\)/);
  assert.match(editor, /node\.closest\?\.\("\.visual-part-card"\)/);
  assert.match(editor, /part\?\.closest\("\.visual-button-window-pair, \.visual-structure-set"\)/);
  assert.ok(editor.indexOf("expandIfCollapsed(originMatch)") < editor.indexOf("match = resolveInspectionGroup(originMatch)"),
    "O campo recolhido deve ser expandido antes de destacar o conjunto pai.");
});

test("Uma nova inspeção cancela o destaque e a animação anterior imediatamente", () => {
  assert.match(editor, /function clearInspectHighlight\(\)/);
  assert.match(editor, /window\.clearTimeout\(inspectHighlightTimer\)/);
  assert.match(editor, /getAnimations\?\.\(\)\.forEach\(animation => animation\.cancel\(\)\)/);
  assert.match(editor, /const sequence = clearInspectHighlight\(\)/);
  assert.match(editor, /if \(sequence !== inspectSequence\) return/);
});

test("A localização rola somente a área da Estrutura, sem deslocar campos internos", () => {
  assert.match(editor, /visualRoot\.scrollTo\(\{ top: Math\.max\(0, nextTop\), behavior: "smooth" \}\)/);
  assert.doesNotMatch(editor, /const ancestors = \[\]/);
});

test("Clicar fora da prévia desativa o modo Inspecionar", () => {
  assert.match(editor, /document\.addEventListener\("pointerdown"[\s\S]*?if \(!previewInspectMode\) return/);
  assert.match(editor, /if \(insidePreview \|\| previewInspectButton\?\.contains\(target\)\) return/);
  assert.match(editor, /setPreviewInspectMode\(false\)/);
});

test("O destaque não cria camada ou bloqueio sobre os campos editáveis", () => {
  const rule = css.match(/\.visual-structure-editor \.is-inspect-highlight\s*\{([^}]*)\}/)?.[1] || "";
  assert.ok(rule, "A regra de destaque da Estrutura deve existir.");
  assert.doesNotMatch(rule, /z-index\s*:/);
  assert.doesNotMatch(rule, /pointer-events\s*:\s*none/);
  assert.match(rule, /pointer-events:\s*auto/);
});


test("A recarga da prévia não reativa o Inspetor após o usuário sair do modo", () => {
  assert.match(editor, /if \(previewInspectMode\) previewFrame\.addEventListener\("load", \(\) => \{[\s\S]*?if \(previewInspectMode\) setPreviewInspectMode\(true\)/);
});
