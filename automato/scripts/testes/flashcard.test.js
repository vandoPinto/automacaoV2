const assert = require("assert");
const fs = require("fs");
const path = require("path");
const flashcard = require("../Componentes/flashcard/flashcard");

async function executar() {
    const html = await flashcard(
        '<p>Introdução da atividade.</p>' +
        '<p>&lt;frente&gt;</p>' +
        '<p>Texto de frente para centralizar.</p>' +
        '<p>&lt;verso&gt;</p>' +
        '<p>Resposta do cartão.</p>' +
        '<p>&lt;frente&gt;</p>' +
        '<img src="imagem-teste.jpg" alt="Imagem" />' +
        '<p>&lt;verso&gt;</p>' +
        '<p>Verso com imagem na frente.</p>',
        1,
        6
    );

    assert(html.includes('class="flip-box-front flip-box-front-texto"'),
        "Frente textual deve receber classe específica.");
    assert(html.includes('class="flip-box-front flip-box-front-imagem"'),
        "Frente com imagem deve manter classe própria.");
    assert(html.includes("Introdução da atividade."), "O conteúdo anterior deve ser preservado no fluxo externo.");
    assert(html.indexOf("Introdução da atividade.") < html.indexOf('<div class="flashcard-componente">'),
        "O conteúdo anterior não pode ser renderizado dentro do FLASHCARD.");
    assert(!html.includes("flashcard-introducao") && !html.includes("flashcard-instrucao"),
        "O FLASHCARD não pode criar seções de introdução ou instrução.");
    assert(html.includes("Texto de frente para centralizar."));
    assert(html.includes('src="imagem-teste.jpg"'));
    assert(html.includes('data-audio-id="flashcard_a_verso"'));
    assert(html.includes('data-audio-id="flashcard_b_verso"'));
    assert(!/class="flip-box-front[^"]*"[^>]*data-audio-id/.test(html),
        "A frente do Flashcard não deve receber ID de áudio.");

    const templatePath = path.join(__dirname, "../Componentes/flashcard/flashcard.html");
    const template = fs.readFileSync(templatePath, "utf8");
    assert(template.includes(".flip-box-front-texto"));
    assert(template.includes("padding: 18px;"));
    assert(template.includes("text-align: center;"));
    assert(template.includes("align-items: center;"));
    assert(template.includes(".flip-box-front-imagem"));

    console.log("✓ Frente textual do Flashcard recebe centralização e espaçamento interno");
    console.log("✓ Frente com imagem mantém classe e estilo próprios");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
