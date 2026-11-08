const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const raizProjeto = path.resolve(__dirname, "../../..");
const js = fs.readFileSync(path.join(raizProjeto, "assets/js/editor-componentes.js"), "utf8");

assert.match(js, /function normalizeClipboardFormatting\(root\)/,
  "A cópia precisa normalizar a formatação antes de chegar ao Word.");
assert.match(js, /function makeClipboardClone\(\)[\s\S]*?normalizeClipboardFormatting\(clone\)/,
  "A área de transferência deve usar um clone separado e normalizado.");
assert.match(js, /function getClipboardHtml\(\)[\s\S]*?makeClipboardClone\(\)\.innerHTML/,
  "O HTML rico enviado ao Word deve vir do clone normalizado.");
assert.match(js, /const htmlBody = makeClipboardClone\(\)\.innerHTML/,
  "O fallback de cópia também deve usar o clone normalizado.");
assert.ok(js.includes('const isInlineFormatting = element.tagName === "SPAN";'),
  "Somente spans inline podem converter formatação visual em semântica.");
assert.ok(js.includes('if (isInlineFormatting && /font-weight'),
  "A sanitização da colagem não pode converter o peso do parágrafo inteiro em negrito.");
assert.ok(js.includes('if (isInlineFormatting && /font-weight\\s*:\\s*(bold|[6-9]00)/i.test(style)) semanticTags.push("strong");'),
  "Negrito vindo de um span inline deve ser preservado.");
assert.ok(js.includes('if (isInlineFormatting && /font-style\\s*:\\s*italic/i.test(style)) semanticTags.push("em");'),
  "Itálico de trecho deve ser preservado.");
assert.ok(js.includes('if (isInlineFormatting && /text-decoration(?:-line)?\\s*:[^;]*underline/i.test(style)) semanticTags.push("u");'),
  "Sublinhado de trecho deve ser preservado.");
assert.match(js, /blockTags = "p, div, li, blockquote, h1, h2, h3, h4, h5, h6"/,
  "A cópia deve neutralizar a formatação herdada dos blocos.");
assert.match(js, /font-weight:normal;font-style:normal;color:#000000;background-color:transparent/,
  "Os blocos copiados devem iniciar com peso normal, sem cor/fundo herdados.");
assert.match(js, /name === "color" \|\| name === "bgcolor"/,
  "Cores visuais do editor não podem ser exportadas para o Word.");
assert.match(js, /name === "style" \|\| name === "class"/,
  "Classes e estilos exclusivos da interface não podem ser exportados.");

console.log("✓ Cópia rica usa HTML separado da camada de sintaxe do Editor.");
console.log("✓ Cores e estilos visuais da interface são removidos na cópia.");
console.log("✓ Formatação inline é preservada, sem promover estilos de parágrafo a negrito.");
console.log("✓ Blocos exportados ao Word recebem peso normal por padrão.");
