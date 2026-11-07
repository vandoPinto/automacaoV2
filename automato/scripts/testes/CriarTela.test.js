const assert = require("assert");
const { identificarTipagem } = require("../CriarTela");

// Texto normal no início não é tipagem e deve permanecer integral.
const textoComum = "<p>Digite aqui a resposta ou explicação.</p><p>Segundo parágrafo.</p>";
const resultadoTexto = identificarTipagem(textoComum);
assert.strictEqual(resultadoTexto.tipo, "tela");
assert.strictEqual(resultadoTexto.tipagemEncontrada, false);
assert.strictEqual(resultadoTexto.conteudo, textoComum);

// Imagem no primeiro parágrafo não pode ser interpretada como tipagem.
const imagemPrimeiro = '<p><img alt="Vaca no pasto" src="vaca.jpeg"></p><p>Texto depois.</p>';
const resultadoImagem = identificarTipagem(imagemPrimeiro);
assert.strictEqual(resultadoImagem.tipo, "tela");
assert.strictEqual(resultadoImagem.tipagemEncontrada, false);
assert.strictEqual(resultadoImagem.conteudo, imagemPrimeiro);

// Tipagem explícita em negrito é reconhecida e removida.
const tipoNegrito = "<p><strong>FLASHCARD</strong></p><p>Frente do cartão.</p>";
const resultadoNegrito = identificarTipagem(tipoNegrito);
assert.strictEqual(resultadoNegrito.tipo, "flashcard");
assert.strictEqual(resultadoNegrito.tipagemEncontrada, true);
assert.strictEqual(resultadoNegrito.conteudo, "<p>Frente do cartão.</p>");

// Tipagem explícita sem negrito também é reconhecida.
const tipoSimples = "<p>HOTWORD</p><p>Palavra de destaque.</p>";
const resultadoSimples = identificarTipagem(tipoSimples);
assert.strictEqual(resultadoSimples.tipo, "hotword");
assert.strictEqual(resultadoSimples.tipagemEncontrada, true);

// A tipagem antiga TEXTO é mantida como alias para o novo componente TELA.
const tipoAntigo = identificarTipagem("<p><b>TeXtO</b></p><p>Conteúdo.</p>");
assert.strictEqual(tipoAntigo.tipo, "tela");
assert.strictEqual(tipoAntigo.tipagemEncontrada, true);
assert.strictEqual(tipoAntigo.conteudo, "<p>Conteúdo.</p>");

// Uma frase que contém o nome de um componente não é tipagem.
const frase = "<p>O flashcard apresenta uma pergunta.</p>";
const resultadoFrase = identificarTipagem(frase);
assert.strictEqual(resultadoFrase.tipagemEncontrada, false);
assert.strictEqual(resultadoFrase.conteudo, frase);

// Uma tipagem desconhecida não pode ser removida.
const desconhecido = "<p>COMPONENTE_INEXISTENTE</p><p>Conteúdo.</p>";
const resultadoDesconhecido = identificarTipagem(desconhecido);
assert.strictEqual(resultadoDesconhecido.tipo, "tela");
assert.strictEqual(resultadoDesconhecido.tipagemEncontrada, false);
assert.strictEqual(resultadoDesconhecido.conteudo, desconhecido);

console.log("Todos os testes de identificação de tipagem passaram.");


// Componentes que contêm apenas outros componentes não possuem narração própria.
// O HTML não deve manter data-audio-id nesses containers, pois não existe MP3
// correspondente no sonorizacao.json. O ID do componente interno com texto deve
// permanecer e coincidir com a extração central.
(async () => {
    const { processarComponente } = require("../ProcessarComponentesAninhados");
    const { processarRegiao, normalizarMarcadores } = require("../ExtrairAudiosComponentes");
    const { limpar } = require("../GerarJsonAudios");
    const { sincronizarIdsAudioHTML } = require("../CriarTela");

    const roteiroAninhado = `
        <componente tipo="mininavegacao">
            <janela>
                <componente tipo="abas">
                    <aba>Detalhes</aba>
                    <janela>
                        <componente tipo="sanfona">
                            <botao>Ver detalhes</botao>
                            <janela><p>Texto da SANFONA com narração.</p></janela>
                        </componente>
                    </janela>
                </componente>
            </janela>
        </componente>
    `;

    const htmlGerado = await processarComponente("tela", roteiroAninhado, 1, 1);
    const htmlSincronizado = sincronizarIdsAudioHTML(htmlGerado, roteiroAninhado);
    const idsHTML = [...htmlSincronizado.matchAll(/\bdata-audio-id=["']([^"']+)["']/gi)]
        .map(match => match[1]);
    const idsJSON = processarRegiao(normalizarMarcadores(roteiroAninhado)).audios
        .filter(item => limpar(item.texto))
        .map(item => item.nomeSufixo);

    assert.deepStrictEqual(idsHTML, idsJSON);
    assert.deepStrictEqual(idsHTML, ["mininavegacao_a_abas_a_sanfona_a"]);

    console.log("IDs HTML sem narração foram omitidos; os IDs com narração correspondem ao extrator.");
})().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
