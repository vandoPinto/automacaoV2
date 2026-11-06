const assert = require("assert");
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const processador = fs.readFileSync(path.join(raiz, "ProcessarComponentesAninhados.js"), "utf8");
const botaoJs = fs.readFileSync(path.join(raiz, "Componentes/botao/botao.js"), "utf8");
const botaoHtml = fs.readFileSync(path.join(raiz, "Componentes/botao/botao.html"), "utf8");

assert(processador.includes('const prefixoAudio = `${tipoPai}_${sufixoPainel}`'));
assert(processador.includes('prefixoAudio'));
assert(botaoJs.includes('.replace(/{{PREFIXO_AUDIO}}/g, () => prefixoAudio)'));
assert(botaoHtml.includes('var prefixoAudio = "{{PREFIXO_AUDIO}}"'));
assert(botaoHtml.includes('(prefixoAudio ? prefixoAudio + "_" : "") + "botoes_" + sufixoAudio'));

console.log("✓ BOTÕES dentro de ABAS/MININAVEGAÇÃO preservam o prefixo hierárquico na chamada de áudio.");
