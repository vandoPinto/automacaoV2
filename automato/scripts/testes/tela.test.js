const assert = require("assert");
const { organizarBlocos } = require("../Componentes/tela/tela");

function tipos(html) {
    return organizarBlocos(html).map(bloco => bloco.tipo);
}

// Imagem antes do texto: ordem preservada e blocos separados.
assert.deepStrictEqual(
    tipos('<p><img src="foto.png"></p><p>Texto depois.</p>'),
    ["imagem", "texto"]
);

// Texto antes da imagem: ordem preservada.
assert.deepStrictEqual(
    tipos('<p>Texto antes.</p><p><img src="foto.png"></p>'),
    ["texto", "imagem"]
);

// Parágrafos consecutivos são agrupados em um único bloco.
const somenteTexto = organizarBlocos("<p>Primeiro.</p><p>Segundo.</p>");
assert.strictEqual(somenteTexto.length, 1);
assert.strictEqual(somenteTexto[0].tipo, "texto");
assert(somenteTexto[0].html.includes("Primeiro."));
assert(somenteTexto[0].html.includes("Segundo."));

// Imagem isolada ocupa bloco integral.
assert.deepStrictEqual(
    tipos('<p><img src="foto.png"></p>'),
    ["imagem"]
);

// Imagem no meio do parágrafo divide o conteúdo sem deixar tags abertas.
const misto = organizarBlocos(
    '<p>Antes <strong>em negrito</strong> <img src="foto.png"> depois <em>em itálico</em>.</p>'
);
assert.deepStrictEqual(misto.map(bloco => bloco.tipo), ["texto", "imagem", "texto"]);
assert(misto[0].html.includes("<strong>em negrito</strong>"));
assert(misto[2].html.includes("<em>em itálico</em>"));
assert(misto[0].html.endsWith("</p>"));
assert(misto[2].html.startsWith("<p"));

// Componentes filhos permanecem no fluxo do parágrafo.
const comFilho = organizarBlocos(
    '<p>Frase antes __HTML_COMPONENTE_FILHO_tela_1_FIM__ e depois.</p>'
);
assert.strictEqual(comFilho.length, 1);
assert(comFilho[0].html.includes("__HTML_COMPONENTE_FILHO_tela_1_FIM__"));

// Parágrafos vazios do DOCX continuam não criando blocos.
assert.deepStrictEqual(tipos("<p> </p><p><br></p><p>&nbsp;</p>"), []);

// Regressão do Editor: a linha vazia do contenteditable é um <div><br></div>.
// Ela separa visualmente dois parágrafos e não pode ser descartada na prévia.
const dicasSeparadas = organizarBlocos(
    '<div>Dica: primeiro texto.</div>' +
    '<div><br></div>' +
    '<div>Dica: segundo texto.</div>'
);
assert.strictEqual(dicasSeparadas.length, 1, "Os parágrafos de texto continuam no mesmo bloco da Tela.");
assert.ok(
    dicasSeparadas[0].html.includes('<div><br></div>'),
    "A linha em branco intencional do Editor deve ser preservada entre os parágrafos."
);
assert.ok(
    dicasSeparadas[0].html.indexOf("primeiro texto.") < dicasSeparadas[0].html.indexOf("<div><br></div>") &&
    dicasSeparadas[0].html.indexOf("<div><br></div>") < dicasSeparadas[0].html.indexOf("segundo texto."),
    "O separador deve permanecer exatamente entre os dois parágrafos."
);

console.log("Todos os testes do componente Tela passaram.");
