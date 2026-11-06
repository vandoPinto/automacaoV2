const assert = require("assert");
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const botaoJs = require(path.join(raiz, "Componentes/botao/botao.js"));
const botaoHtml = fs.readFileSync(
    path.join(raiz, "Componentes/botao/botao.html"),
    "utf8"
);

// BOTÕES isolado: o ID deve corresponder ao nome produzido pelo gerador.
const isolado = botaoJs.processarPares(
    "<botao>A</botao><janela>Texto A</janela><botao>B</botao><janela>Texto B</janela>",
    "instancia"
);
assert(isolado.botoesHTML.includes('data-audio-id="botoes_a"'));
assert(isolado.botoesHTML.includes('data-audio-id="botoes_b"'));

// BOTÕES dentro de uma janela hierárquica: herda o prefixo recebido.
const aninhado = botaoJs.processarPares(
    "<botao>A</botao><janela>Texto A</janela>",
    "instancia-pai",
    "abas_a"
);
assert(aninhado.botoesHTML.includes('data-audio-id="abas_a_botoes_a"'));

// A chamada usa o ID gravado na própria janela; não recalcula a hierarquia.
assert(botaoHtml.includes('janela.getAttribute("data-audio-id")'));
assert(botaoHtml.includes('dispararEventoAudio("playAudio", { comp: audioId })'));
assert(!botaoHtml.includes('function obterSufixoAudio'));

console.log("✓ BOTÕES atribui data-audio-id às janelas e reproduz pelo ID hierárquico.");
