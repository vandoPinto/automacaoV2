const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");

function contar(html, expressao) {
    return (html.match(expressao) || []).length;
}

async function executar() {
    const html = await processarComponente(
        "tela",
        '<p>Atividade de flashcard</p><p>Este é um texto de explicação, para o aluno conseguir fazer a atividade.</p>' +
        '<p>&lt;flashcard&gt;</p><p>&lt;frente&gt;</p><p>Frente do cartão 1</p>' +
        '<p>&lt;verso&gt;</p><p>Resposta do cartão 1.</p><p>&lt;botoes&gt;</p>' +
        '<p>&lt;botao&gt;</p><p>Botão dentro flashcard</p><p>&lt;janela&gt;</p>' +
        '<p>Janela do botão de dentro do flashcard.</p><p>&lt;/botoes&gt;</p>' +
        '<p>&lt;frente&gt;</p><p>Frente do cartão 2</p><p>&lt;verso&gt;</p>' +
        '<p>Resposta do cartão 2 testando.</p><p>&lt;hotword&gt;</p><p>testando</p>' +
        '<p>&lt;janela&gt;</p><p>Janela da hotword de dentro do flashcard.</p><p>&lt;/hotword&gt;</p>' +
        '<p>&lt;frente&gt;</p><p>Frente do cartão 3</p><p>&lt;verso&gt;</p><p>Resposta 3.</p>' +
        '<p>&lt;frente&gt;</p><p>Frente do cartão 4</p><p>&lt;verso&gt;</p><p>Resposta 4.</p>' +
        '<p>&lt;frente&gt;</p><p>Frente do cartão 5</p><p>&lt;verso&gt;</p><p>Resposta 5.</p>' +
        '<p>&lt;/flashcard&gt;</p><p>ESTE TEXTO DEVE CONTINUAR NA TELA, FORA DO FLASHCARD.</p>',
        1,
        64
    );

    assert.strictEqual(contar(html, /class="flip-box"/g), 5,
        "O Flashcard deve conter exatamente os cinco cartões anteriores ao fechamento.");
    assert.strictEqual(contar(html, /class="botao-item/g), 1,
        "O botão interno deve continuar funcionando.");
    assert.strictEqual(contar(html, /class="hotword-gatilho"/g), 1,
        "A HOTWORD interna deve continuar funcionando.");
    assert(html.includes("Janela do botão de dentro do flashcard."));
    assert(html.includes("Janela da hotword de dentro do flashcard."));
    assert(html.includes("ESTE TEXTO DEVE CONTINUAR NA TELA, FORA DO FLASHCARD."),
        "O texto posterior ao fechamento deve permanecer na Tela.");
    assert(!html.includes("&lt;/flashcard&gt;"));

    console.log("✓ FLASHCARD com fechamento explícito preserva os cinco cartões.");
    console.log("✓ BOTAO e HOTWORD internos continuam funcionando.");
    console.log("✓ Conteúdo posterior a </flashcard> permanece fora do componente.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
