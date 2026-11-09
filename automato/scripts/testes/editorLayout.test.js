const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../../..");
const html = fs.readFileSync(path.join(root, "views/editor-componentes.ejs"), "utf8");
const css = fs.readFileSync(path.join(root, "assets/css/editor-componentes.css"), "utf8");
const js = fs.readFileSync(path.join(root, "assets/js/editor-componentes.js"), "utf8");
const visualJs = fs.readFileSync(path.join(root, "assets/js/editor-visual-structure.js"), "utf8");

// O editor mantém a estrutura visual e oferece formatação rica em uma barra fixa.
assert.match(html, /<textarea[^>]*id="componentSourceEditor"/);
assert.match(html, /id="editorPreviewFrame"[^>]*sandbox="allow-scripts"/);
assert.match(html, /id="editorScreenList"[^>]*role="tablist"/);
assert.match(html, /id="editorAddScreen"/);
assert.match(html, /id="editorColumnsSplitter"/);
assert.match(html, /id="editorOpenLargePreview"/);
assert.match(html, /id="editorComponentList"/);
assert.match(html, /id="editorComponentSearch"/);
assert.match(html, /id="editorSidebarSplitter"/);
assert.match(html, /id="editorTextToolbar"[^>]*role="toolbar"/);
assert.match(html, /data-editor-format="h1"/);
assert.match(html, /data-editor-format="h2"/);
assert.match(html, /data-editor-format="h3"/);
assert.match(html, /data-editor-format="bold"/);
assert.match(html, /id="editorInsertImage"/);
assert.match(html, /id="editorImageInput"[^>]*accept="image\/\*"/);
assert.match(html, /data-editor-format="link"/);
assert.match(html, /data-editor-format="list"/);
assert.match(html, /data-editor-format="quote"/);
assert.match(html, /data-editor-format="code"/);
assert.match(html, /data-editor-format="superscript"/);
assert.match(html, /data-editor-format="subscript"/);
assert.match(html, /contenteditable="true"/);
assert.match(html, /editor-toolbar/);
assert.match(html, /window\.editorComponentExamples/);
assert.match(html, /window\.editorComponentCatalog/);

// Sem syntax highlighting, formatação rica ou cópia para Word; a Biblioteca permanece disponível.
assert.doesNotMatch(js, /colorizeEditor|editor-syntax|copyCurrentContent|execCommand\("bold"/);
assert.match(js, /function insertComponentExample/);
assert.match(js, /componentList\?\.addEventListener\("click"/);
assert.match(js, /searchInput\?\.addEventListener\("input"/);
assert.match(js, /editorInsertImageButton\?\.addEventListener\("click"/);
assert.match(js, /editorImageInput\?\.addEventListener\("change"/);
assert.match(js, /visualStructure\?\.insertImage\(reader\.result/);
assert.match(js, /body: JSON\.stringify\(\{ slug: "tela", source \}\)/);
assert.match(js, /editor\.value = screen\.source/);
assert.match(js, /screen\.source = getSource\(\)/);
assert.match(visualJs, /function formatSelection\(format, value = ""\)/);
assert.match(visualJs, /function insertImage\(dataUrl, alt = "Imagem"\)/);
assert.match(visualJs, /anchor\.target = "_blank"/);
assert.match(visualJs, /anchor\.rel = "noopener noreferrer"/);
assert.match(visualJs, /toolbar\.addEventListener\("mousedown"/);
assert.match(visualJs, /if \(!event\.target\.closest\("button"\)\) return;[\s\S]*?event\.preventDefault\(\)/);
assert.match(visualJs, /closest\?\.\("\.visual-text-block\.visual-empty-block"\)/);
assert.match(visualJs, /formatSelection, insertImage, rememberSelection/);

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

console.log("✓ Barra de formatação rica presente, com seleção preservada e formatação semântica.");
console.log("✓ Código digitado é enviado diretamente ao processador oficial de Tela.");
console.log("✓ Imagens são inseridas no cursor e os controles da barra preservam a seleção.");
console.log("✓ Telas independentes, redimensionamento e pré-visualização ampliada preservados.");
