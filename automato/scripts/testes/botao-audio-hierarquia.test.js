const assert = require("assert");
const fs = require("fs");
const path = require("path");

const raiz = path.join(__dirname, "..");
const processador = fs.readFileSync(path.join(raiz, "ProcessarComponentesAninhados.js"), "utf8");
const botaoJsSource = fs.readFileSync(path.join(raiz, "Componentes/botao/botao.js"), "utf8");
const botaoJs = require(path.join(raiz, "Componentes/botao/botao.js"));
const { montarIdAudio, processarRegiao } = require(path.join(raiz, "ExtrairAudiosComponentes.js"));
assert.strictEqual(montarIdAudio(["abas", "a"], "botoes", 0), "abas_a_botoes_a");
assert.strictEqual(montarIdAudio([], "botoes", 26), "botoes_aa");
const json = processarRegiao("<abas><aba>A</aba><janela><botoes><botao>Um</botao><janela>Conteúdo 1</janela><botao>Dois</botao><janela>Conteúdo 2</janela></botoes></janela></abas>");
assert(json.audios.some(item => item.nomeSufixo === "abas_a_botoes_a"));
assert(json.audios.some(item => item.nomeSufixo === "abas_a_botoes_b"));
const botaoHtml = fs.readFileSync(path.join(raiz, "Componentes/botao/botao.html"), "utf8");

assert(processador.includes("const prefixoAudio = montarIdAudio("));
assert(processador.includes('prefixoAudio'));
assert(botaoJsSource.includes('data-audio-id="${audioId}"'));
assert(botaoHtml.includes('janela.getAttribute("data-audio-id")'));
assert(botaoHtml.includes('dispararEventoAudio("playAudio", { comp: audioId })'));
assert(!botaoHtml.includes('sufixoAudio'));

const html = botaoJs.processarPares(
    "<botao>Primeiro</botao><janela>Conteúdo 1</janela><botao>Segundo</botao><janela>Conteúdo 2</janela>",
    "teste",
    "abas_a"
);
assert(html.botoesHTML.includes('data-audio-id="abas_a_botoes_a"'));
assert(html.botoesHTML.includes('data-audio-id="abas_a_botoes_b"'));

const isolado = botaoJs.processarPares(
    "<botao>Único</botao><janela>Conteúdo</janela>",
    "teste-isolado"
);
assert(isolado.botoesHTML.includes('data-audio-id="botoes_a"'));

console.log("✓ BOTÕES recebe o prefixo central, grava data-audio-id nas janelas e reproduz pelo ID.");
