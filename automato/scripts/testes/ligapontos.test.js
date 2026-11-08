const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const ligapontos = require("../Componentes/ligapontos/ligapontos");
const TEMPLATE = require("fs").readFileSync(
    require("path").join(__dirname, "../Componentes/ligapontos/ligapontos.html"),
    "utf8"
);

const ROTEIRO = `
<ligapontos>
<opcao>
HTML
<resposta>
Linguagem de marcação.
<opcao>
CSS
<resposta>
Estilização de página.
<opcao>
javascript
<resposta>
Linguagem de programação.
<opcao>
Node.js
<resposta>
Ambiente de execução Javascript.
<feedcerto>
Parabéns! Você ligou corretamente.
<feedErrao>
Não foi dessa vez, tente novamente.
</ligapontos>`;

(async () => {
    const conteudo = ROTEIRO
        .replace(/^\s*<ligapontos>/i, "")
        .replace(/<\/ligapontos>\s*$/i, "");

    const dados = ligapontos.interpretarRoteiro(conteudo);
    assert.strictEqual(dados.pares.length, 4, "deve interpretar os quatro pares do roteiro");
    assert.strictEqual(dados.pares[0].opcao.trim(), "HTML");
    assert.strictEqual(dados.pares[0].resposta.trim(), "Linguagem de marcação.");
    assert.strictEqual(dados.pares[3].opcao.trim(), "Node.js");
    assert(dados.feedbackCerto.includes("Parabéns!"));
    assert(dados.feedbackErrado.includes("Não foi dessa vez"));

    const html = await processarComponente("ligapontos", conteudo, 1, 1);
    assert.strictEqual((html.match(/data-ligapontos-lado="opcao"/g) || []).length, 4);
    assert.strictEqual((html.match(/data-ligapontos-lado="resposta"/g) || []).length, 4);
    assert(html.includes('data-audio-id="ligapontos_a"'));
    assert(html.includes('data-audio-id="ligapontos_b"'));
    assert(html.includes("Parabéns! Você ligou corretamente."));
    assert(html.includes("Não foi dessa vez, tente novamente."));
    assert(html.includes("Submeter respostas"));
    assert(html.includes('aria-label="Selecionar opção: HTML"'));
    assert(!/{{[A-Z_]+}}/.test(html), "todos os marcadores do template devem ser preenchidos");
    assert(!html.includes("Tentar novamente"));
    assert.strictEqual((html.match(/class=\"ligapontos-submeter\"/g) || []).length, 1, "deve existir apenas um botão de submissão");

    assert(TEMPLATE.includes("--ligapontos-linha: #3d78a8"), "as linhas devem usar a cor fixa definida no componente");
    assert(TEMPLATE.includes("text-align: left"), "as opções devem alinhar o texto à esquerda");
    assert(TEMPLATE.includes("text-align: right"), "as respostas devem alinhar o texto à direita");
    assert(TEMPLATE.includes("background: rgba(0, 0, 0, .72)"), "o feedback deve usar a sobreposição escura da janela do Botões");
    assert(TEMPLATE.includes("ligapontos-feedback-conteudo"), "o feedback deve usar o painel da janela central");
    assert(TEMPLATE.includes("background: var(--cor-principal)"), "o botão e o painel de feedback devem usar a cor padrão do sistema");
    assert(TEMPLATE.includes("@media (min-width: 601px) and (max-width: 900px)"), "o CSS deve contemplar tablet");
    assert(TEMPLATE.includes("@media (max-width: 600px)"), "o CSS deve contemplar mobile");
    assert(TEMPLATE.includes("touch-action: manipulation"), "os pontos devem aceitar toque de forma adequada");

    const escaped = ligapontos.interpretarRoteiro(
        "&lt;opcao&gt;A&lt;resposta&gt;Resposta A&lt;opcao&gt;B&lt;resposta&gt;Resposta B" +
        "&lt;feedbackcerto&gt;Certo&lt;feedbackerrado&gt;Errado"
    );
    assert.strictEqual(escaped.pares.length, 2);
    assert.strictEqual(escaped.feedbackErrado.trim(), "Errado");

    // Simula a estrutura que o Mammoth normalmente entrega quando cada
    // marcador do roteiro está isolado em um parágrafo do DOCX.
    const docxLike = `<p>&lt;ligapontos&gt;</p>
        <p>&lt;opcao&gt;</p><p>HTML</p>
        <p>&lt;resposta&gt;</p><p>Linguagem de marcação.</p>
        <p>&lt;opcao&gt;</p><p>CSS</p>
        <p>&lt;resposta&gt;</p><p>Estilização de página.</p>
        <p>&lt;feedcerto&gt;</p><p>Acertou.</p>
        <p>&lt;feedErrao&gt;</p><p>Tente novamente.</p>
        <p>&lt;/ligapontos&gt;</p>`;
    const htmlDocxLike = await processarComponente("tela", docxLike, 1, 3);
    assert.strictEqual((htmlDocxLike.match(/data-ligapontos-lado="opcao"/g) || []).length, 2);
    assert(htmlDocxLike.includes("Linguagem de marcação."));
    assert(htmlDocxLike.includes('data-audio-id="ligapontos_a"'));
    assert(htmlDocxLike.includes('data-audio-id="ligapontos_b"'));

    assert.throws(
        () => ligapontos.interpretarRoteiro("<opcao>A<resposta>R<opcao>B<feedcerto>C<feedErrao>E"),
        /não possui uma <resposta>/i,
        "deve informar par sem resposta"
    );
    assert.throws(
        () => ligapontos.interpretarRoteiro("<opcao>A<resposta>R<feedcerto>C"),
        /feedback de erro/i,
        "deve exigir os dois feedbacks"
    );

    const comDuasInstancias = await processarComponente(
        "tela",
        ROTEIRO + ROTEIRO,
        1,
        2
    );
    assert.strictEqual((comDuasInstancias.match(/class="ligapontos"/g) || []).length, 2);
    assert(comDuasInstancias.includes('data-audio-id="ligapontos_a"'));
    assert(comDuasInstancias.includes('data-audio-id="ligapontos2_a"'));

    console.log("✓ LIGAPONTOS interpreta o roteiro AIM, cria pares, feedbacks e IDs exclusivos.");
    console.log("✓ LIGAPONTOS aceita marcadores escapados e valida estruturas incompletas.");
    console.log("✓ Duas instâncias independentes podem coexistir na mesma Tela.");
})().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
