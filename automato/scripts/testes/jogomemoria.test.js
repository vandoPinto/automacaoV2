const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const jogoMemoria = require("../Componentes/jogomemoria/jogomemoria");
const TEMPLATE = fs.readFileSync(
    path.join(__dirname, "../Componentes/jogomemoria/jogomemoria.html"),
    "utf8"
);

const ROTEIRO = `<jogomemoria>
<frente>
<carta1>
Maçã
<carta2>
Fruta vermelha
<feedback>
Muito bem! Você encontrou o par da maçã.
<carta1>
Banana
<carta2>
Fruta amarela
<feedback>
Parabéns! Você encontrou o par da banana.
</jogomemoria>`;

(async () => {
    const conteudo = ROTEIRO.replace(/^\s*<jogomemoria>/i, "").replace(/<\/jogomemoria>\s*$/i, "");
    const dados = jogoMemoria.interpretarRoteiro(conteudo);
    assert.strictEqual(dados.pares.length, 2, "cada trio carta1/carta2/feedback deve criar um par");
    assert.strictEqual(dados.capa, "", "frente vazia deve ser aceita para usar a capa CSS");
    assert.strictEqual(dados.pares[0].carta1.trim(), "Maçã");
    assert.strictEqual(dados.pares[0].carta2.trim(), "Fruta vermelha");
    assert(dados.pares[0].feedback.includes("par da maçã"));

    const comCapaComum = jogoMemoria.interpretarRoteiro(`
        <frente><img src="capa-comum.png" alt="Capa">
        <carta1>Maçã
        <carta2>Fruta vermelha
        <feedback>Par da maçã.
        <carta1>Banana
        <carta2>Fruta amarela
        <feedback>Par da banana.
    `);
    assert.strictEqual(comCapaComum.pares.length, 2);
    assert(comCapaComum.capa.includes("capa-comum.png"), "a única frente deve ser preservada como capa comum");

    const html = await processarComponente("jogomemoria", conteudo, 1, 1);
    assert.strictEqual((html.match(/class="jogomemoria-carta"/g) || []).length, 4, "dois pares devem gerar quatro cartas");
    assert.strictEqual((html.match(/data-jogomemoria-par="1"/g) || []).length, 2);
    assert.strictEqual((html.match(/data-jogomemoria-par="2"/g) || []).length, 2);
    assert(html.includes('data-audio-id="jogomemoria_a"'));
    assert(html.includes('data-audio-id="jogomemoria_b"'));
    assert(html.includes("Muito bem! Você encontrou o par da maçã."));
    assert(html.includes("Parabéns! Você encontrou o par da banana."));
    assert(html.includes("jogomemoria-capa-padrao"), "capa vazia deve receber o desenho CSS padrão");
    assert(!/{{[A-Z_]+}}/.test(html), "todos os placeholders do template devem ser substituídos");

    const comImagem = jogoMemoria.interpretarRoteiro(`
        <frente><img src="capa.png" alt="Verso">
        <carta1><img src="maca.png" alt="Maçã">
        <carta2>Fruta vermelha
        <feedback>Acertou!
    `);
    assert(/<img/i.test(comImagem.capa));
    assert(/<img/i.test(comImagem.pares[0].carta1));

    const semFrente = jogoMemoria.interpretarRoteiro(`
        <carta1>Maçã
        <carta2><img src="fruta-vermelha.png" alt="Fruta vermelha">
        <feedback>Par encontrado.
        <carta1><img src="banana.png" alt="Banana">
        <carta2>Fruta amarela
        <feedback>Outro par.
    `);
    assert.strictEqual(semFrente.capa, "", "sem <frente>, a capa deve ficar vazia para receber o desenho CSS");
    assert.strictEqual(semFrente.temMarcadorFrente, false);
    assert.strictEqual(semFrente.pares.length, 2);
    const htmlSemFrente = await processarComponente("jogomemoria", `
        <carta1>Maçã
        <carta2><img src="fruta-vermelha.png" alt="Fruta vermelha">
        <feedback>Par encontrado.
        <carta1><img src="banana.png" alt="Banana">
        <carta2>Fruta amarela
        <feedback>Outro par.
    `, 1, 3);
    assert.strictEqual((htmlSemFrente.match(/class="jogomemoria-carta"/g) || []).length, 4);
    assert(htmlSemFrente.includes("jogomemoria-capa-padrao"), "ausência de <frente> deve gerar a capa CSS padrão");
    assert(htmlSemFrente.includes("jogomemoria-face-imagem"), "imagens reveladas devem receber o estilo de imagem em tela cheia");

    const frenteComImagemHtml = await processarComponente("jogomemoria", `
        <frente><img src="capa-comum.png" alt="Capa">
        <carta1>Maçã
        <carta2>Fruta vermelha
        <feedback>Par encontrado.
    `, 1, 4);
    assert(frenteComImagemHtml.includes("jogomemoria-capa-imagem"), "capa com imagem deve usar o estilo de imagem em tela cheia");

    const docxLike = `<p>&lt;jogomemoria&gt;</p>
        <p>&lt;frente&gt;</p><p>CAPA COMUM</p>
        <p>&lt;carta1&gt;</p><p>Gato</p>
        <p>&lt;carta2&gt;</p><p>Animal doméstico</p>
        <p>&lt;feedback&gt;</p><p>Você encontrou o par!</p>
        <p>&lt;carta1&gt;</p><p>Cachorro</p>
        <p>&lt;carta2&gt;</p><p>Animal doméstico que late</p>
        <p>&lt;feedback&gt;</p><p>Muito bem!</p>
        <p>&lt;/jogomemoria&gt;</p>`;
    const htmlDocx = await processarComponente("tela", docxLike, 1, 2);
    assert.strictEqual((htmlDocx.match(/class="jogomemoria-carta"/g) || []).length, 4);
    assert(htmlDocx.includes("Animal doméstico que late"));
    assert((htmlDocx.match(/CAPA COMUM/g) || []).length >= 2,
        "a capa comum deve ser usada nas quatro cartas");

    const docxLikeSemFrente = `<p>&lt;jogomemoria&gt;</p>
        <p>&lt;carta1&gt;</p><p>Gato</p>
        <p>&lt;carta2&gt;</p><p>Animal doméstico</p>
        <p>&lt;feedback&gt;</p><p>Você encontrou o par!</p>
        <p>&lt;carta1&gt;</p><p>Cachorro</p>
        <p>&lt;carta2&gt;</p><p>Animal doméstico que late</p>
        <p>&lt;feedback&gt;</p><p>Muito bem!</p>
        <p>&lt;/jogomemoria&gt;</p>`;
    const htmlDocxSemFrente = await processarComponente("tela", docxLikeSemFrente, 1, 5);
    assert.strictEqual((htmlDocxSemFrente.match(/class="jogomemoria-carta"/g) || []).length, 4);
    assert(htmlDocxSemFrente.includes("jogomemoria-capa-padrao"),
        "o roteiro DOCX sem <frente> deve gerar a capa CSS padrão");

    assert.throws(
        () => jogoMemoria.interpretarRoteiro("<frente><carta1>A<carta2>B"),
        /falta o marcador <feedback>/i,
        "deve exigir feedback para cada par"
    );
    assert.throws(
        () => jogoMemoria.interpretarRoteiro("<frente><carta2>B<carta1>A<feedback>C"),
        /era esperado <carta1>/i,
        "deve validar a ordem dos marcadores"
    );
    assert.throws(
        () => jogoMemoria.interpretarRoteiro("<frente><carta1>A<carta2><feedback>C"),
        /carta2 do par 1 está vazia/i,
        "deve rejeitar carta sem conteúdo"
    );
    assert.throws(
        () => jogoMemoria.interpretarRoteiro("<frente>capa<carta1>A<carta2>B<feedback>C<frente>segunda capa<carta1>D<carta2>E<feedback>F"),
        /frente.*apenas uma vez/i,
        "deve rejeitar uma segunda frente"
    );

    assert(TEMPLATE.includes(".jogomemoria-capa-vazia"), "a capa CSS precisa existir");
    assert(TEMPLATE.includes("calcularLayoutCartas"), "o tabuleiro deve calcular o tamanho de acordo com a quantidade de cartas");
    assert(TEMPLATE.includes("ResizeObserver"), "o layout deve recalcular quando o componente-pai for aberto ou redimensionado");
    assert(TEMPLATE.includes(".jogomemoria-capa-imagem img"), "imagem da capa deve preencher toda a carta");
    assert(TEMPLATE.includes(".jogomemoria-face-imagem img"), "imagem revelada deve preencher toda a carta");
    assert(TEMPLATE.includes("align-items: center;") && TEMPLATE.includes("justify-content: center;"), "texto revelado deve ficar centralizado");
    assert(TEMPLATE.includes("document.body.appendChild(feedback)"), "o feedback precisa usar uma camada global fora dos pais");
    assert(TEMPLATE.includes(".jogomemoria-carta.is-virada"), "o template precisa controlar a virada por estado");
    assert(TEMPLATE.includes("window.setTimeout"), "pares incorretos devem voltar a ficar virados para baixo");

    console.log("✓ JOGO DA MEMÓRIA interpreta uma capa global e pares repetidos carta1/carta2/feedback.");
    console.log("✓ Aceita tag <frente> opcional: ausência gera capa CSS, e imagem na capa/conteúdo ocupa toda a carta.");
    console.log("✓ Valida ordem e conteúdo dos marcadores e preserva a camada global de feedback.");
})().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
