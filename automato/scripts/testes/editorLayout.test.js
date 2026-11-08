const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const html = fs.readFileSync(path.join(root, "views/editor-componentes.ejs"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/css/editor-componentes.css"), "utf8");
const js = fs.readFileSync(path.join(root, "assets/js/editor-componentes.js"), "utf8");

// O editor deve receber código como texto puro, sem a interface antiga de blocos.
assert.match(html, /<textarea[^>]*id="componentSourceEditor"/);
assert.match(html, /id="editorPreviewFrame"[^>]*sandbox="allow-scripts"/);
assert.match(html, /id="editorScreenList"[^>]*role="tablist"/);
assert.match(html, /id="editorAddScreen"/);
assert.match(html, /id="editorColumnsSplitter"/);
assert.match(html, /id="editorOpenLargePreview"/);
assert.match(html, /id="editorComponentList"/);
assert.match(html, /id="editorComponentSearch"/);
assert.match(html, /id="editorSidebarSplitter"/);
assert.doesNotMatch(html, /editorCopyCode|editorInsertImage|data-editor-command/);
assert.doesNotMatch(html, /contenteditable="true"|editor-toolbar|editor-copy-explanation/);
assert.match(html, /window\.editorComponentExamples/);
assert.match(html, /window\.editorComponentCatalog/);

// Sem syntax highlighting, formatação rica ou cópia para Word; a Biblioteca permanece disponível.
assert.doesNotMatch(js, /colorizeEditor|editor-syntax|copyCurrentContent|execCommand\("bold"/);
assert.match(js, /function insertComponentExample/);
assert.match(js, /componentList\?\.addEventListener\("click"/);
assert.match(js, /searchInput\?\.addEventListener\("input"/);
assert.doesNotMatch(js, /editorCopyCode|editorInsertImage/);
assert.match(js, /body: JSON\.stringify\(\{ slug: "tela", source \}\)/);
assert.match(js, /editor\.value = screen\.source/);
assert.match(js, /screen\.source = getSource\(\)/);
assert.match(js, /editor\.addEventListener\("input"/);
assert.match(js, /setTimeout\(renderRealPreview, 380\)/);
assert.match(js, /editor\.setRangeText\(text, start, end, "end"\)/);
assert.match(js, /if \(event\.shiftKey\)/);
assert.match(js, /const indent = \(currentLine\.match/);

// Telas, redimensionamento e preview ampliado continuam disponíveis.
assert.match(js, /screen-1[\s\S]*?screen-2/);
assert.match(js, /function addScreen/);
assert.match(js, /function deleteScreen/);
assert.match(js, /screens\.length <= 1/);
assert.match(js, /function syncLargePreviewViewport/);
assert.match(js, /function mountPreviewFrameInLargeModal/);
assert.match(js, /function restorePreviewFrameToCanvas/);
assert.match(js, /desktop: \{ width: 1200, height: 700, label: "Desktop" \}/);
assert.match(js, /tablet: \{ width: 820, height: 1180, label: "Tablet" \}/);
assert.match(js, /mobile: \{ width: 390, height: 844, label: "Mobile" \}/);
assert.match(css, /\.editor-layout-code\s*\{[\s\S]*?display:\s*grid/);
assert.match(css, /textarea\.editor-source\s*\{[\s\S]*?white-space:\s*pre/);
assert.match(css, /\.editor-layout-code \.editor-structure-panel\s*\{[\s\S]*?height:\s*430px/);

console.log("✓ Editor de código puro com Biblioteca e inserção de exemplos preservadas; sem realce sintático, formatação ou cópia para Word.");
console.log("✓ Código digitado é enviado diretamente ao processador oficial de Tela.");
console.log("✓ Enter, Shift+Enter, indentação e posição do cursor tratados no textarea.");
console.log("✓ Telas independentes, redimensionamento e pré-visualização ampliada preservados.");
