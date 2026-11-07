const assert = require("assert");
const fs = require("fs");
const path = require("path");

const hotwordHTML = fs.readFileSync(
    path.join(__dirname, "../Componentes/hotword/hotword.html"),
    "utf8"
);
const botaoHTML = fs.readFileSync(
    path.join(__dirname, "../Componentes/botao/botao.html"),
    "utf8"
);

assert.match(
    hotwordHTML,
    /document\.addEventListener\("keydown",\s*function\s*\(evento\)\s*\{[\s\S]*?evento\.stopImmediatePropagation\(\);[\s\S]*?\},\s*true\);/
);
assert.match(
    hotwordHTML,
    /painel\.getClientRects\(\)\.length\s*>\s*0/
);
assert.match(botaoHTML, /document\.addEventListener\("keydown"[\s\S]*?evento\.key\s*===\s*"Escape"/);

console.log("HOTWORD intercepta Escape em captura somente quando seu painel está visível.");
