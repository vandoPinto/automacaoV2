const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");

async function executar() {
    const html = await processarComponente("tela", `
      <h2>Mini Navegação</h2>
      <p>Texto introdutório.</p>
      <mininavegacao>
        <janela><p>Primeira janela com texto.</p><p><img src="um.png"></p>
        <janela><p><img src="dois.png"></p><p>Segunda janela.</p>
        <janela><p>Terceira janela com componente.</p>
          <componente tipo="botao">
            <botao>Abrir conteúdo</botao><janela>Conteúdo do botão interno</janela>
          </componente>
      `, 1, 9);

    assert(html.includes("Texto introdutório."));
    assert(html.includes("mini-nav-componente"));
    assert.strictEqual((html.match(/class="mini-nav-painel"/g) || []).length, 3);
    assert(html.includes("Primeira janela com texto."));
    assert(html.includes('src="um.png"'));
    assert(html.includes('src="dois.png"'));
    assert(html.includes("Abrir conteúdo"));
    assert(html.includes("Conteúdo do botão interno"));
    assert(html.includes('aria-label="Janela anterior"'));
    assert(html.includes('aria-label="Próxima janela"'));
    console.log("✓ MININAVEGACAO legado gera três janelas e mantém conteúdo e imagens");
    console.log("✓ MININAVEGACAO processa BOTAO interno pelo fluxo recursivo central");
}

async function testarMarcadoresLegadosAninhados() {
    // Reproduz a estrutura real do DOCX: <janela> abre cada painel e o
    // próximo <janela> (ou </mininavegacao>) encerra implicitamente o anterior.
    // As janelas internas de BOTOES e HOTWORD também não usam </janela>.
    const roteiro = `
      <h2>Mini Navegação</h2>
      <p>Texto de inicialização.</p>
      <mininavegacao>
        <janela>
          <p>Janela um com imagem.</p>
          <img src="um.png">
        <janela>
          <img src="dois.png">
          <p>Janela dois com imagem.</p>
        <janela>
          <p>Somente texto centralizado.</p>
          <botoes>
            <botao>Clique aqui para saber mais.</botao>
            <janela>Texto explicativo do clique aqui.
          </botoes>
        <janela>
          <h2>Teste de título</h2>
          <p>Texto longo da quarta janela com a palavra grande.</p>
          <hotword>grande
            <janela>Texto do hotword.
          </hotword>
        <janela>
          <p>Aqui vamos colocar um flashcard.</p>
          <flashcard>
            <p>&lt;frente&gt;</p>
            <p>Arranha-céus mostrados de baixo para cima</p>
            <p>&lt;verso&gt;</p>
            <p>Prédios a vista.</p>
            <p>&lt;frente&gt;</p>
            <p>Ponte Golden Gate no nevoeiro</p>
            <p>&lt;verso&gt;</p>
            <p>Uma torre.</p>
          </flashcard>
      </mininavegacao>
      <p>Texto posterior à Mini Navegação.</p>
    `;
    assert(!roteiro.includes("</janela>"), "O cenário de teste deve usar a sintaxe real do DOCX.");
    const html = await processarComponente("tela", roteiro, 1, 9);

    assert.strictEqual((html.match(/class="mini-nav-painel"/g) || []).length, 5,
        "Somente as cinco janelas principais devem virar painéis da Mini Navegação.");
    assert(html.includes("Clique aqui para saber mais."));
    assert(html.includes("Texto explicativo do clique aqui."));
    assert(html.includes("Texto do hotword."));
    assert(html.includes("Arranha-céus mostrados de baixo para cima"));
    assert(html.includes("Prédios a vista."));
    assert(html.includes("Ponte Golden Gate no nevoeiro"));
    assert(html.includes("Uma torre."));
    assert(html.includes("Texto posterior à Mini Navegação."));
    console.log("✓ MININAVEGACAO reproduz o DOCX legado sem </janela>, com BOTOES, HOTWORD e FLASHCARD aninhados");
}


async function testarFechamentoExplicito() {
    const html = await processarComponente("tela", `
      <h2>Antes da mini navegação</h2>
      <mininavegacao>
        <janela><p>Conteúdo da primeira janela.</p></janela>
        <janela><p>Conteúdo da segunda janela.</p></janela>
      </mininavegacao>
      <p>Este parágrafo pertence à tela, depois da mini navegação.</p>
    `, 1, 10);

    assert.strictEqual((html.match(/class="mini-nav-painel"/g) || []).length, 2,
        "Somente as janelas delimitadas devem pertencer à Mini Navegação.");
    assert(html.includes("Conteúdo da primeira janela."));
    assert(html.includes("Conteúdo da segunda janela."));
    assert(html.includes("Este parágrafo pertence à tela, depois da mini navegação."),
        "O conteúdo após </mininavegacao> deve permanecer na Tela.");
    assert(!html.includes("</mininavegacao>"), "O marcador de fechamento não deve vazar para o HTML final.");
    console.log("✓ MININAVEGACAO respeita </mininavegacao> e preserva o conteúdo posterior na Tela");
}

async function testarLayoutMobileConsolidado() {
    const fs = require("fs");
    const path = require("path");
    const template = fs.readFileSync(
        path.join(__dirname, "../Componentes/mininavegacao/mininavegacao.html"),
        "utf8"
    );
    const estilo = template.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || "";

    assert.strictEqual((estilo.match(/@media\s*\(max-width:\s*768px\)/g) || []).length, 1,
        "O CSS mobile deve ter apenas um bloco de regras consolidado.");
    assert(estilo.includes("height: var(--mini-nav-altura-painel, 360px)"),
        "A área dos painéis deve manter altura fixa no mobile.");
    assert(estilo.includes("overflow-y: auto !important"),
        "O painel mobile deve permitir rolagem interna.");
    assert(estilo.includes("justify-content: flex-start"),
        "O conteúdo mobile deve iniciar pelo topo para não cortar o começo do texto.");
    assert(template.includes("filho.querySelectorAll(\"img\")"),
        "O processamento deve localizar imagens dentro de wrappers do DOCX.");
    assert(estilo.length > 0 && template.includes("filho.matches(seletorComponente)"),
        "A raiz de um componente interativo, como FLASHCARD, deve ser preservada durante a reorganização.");
    assert(template.includes("filho.querySelector(seletorComponente)"),
        "Componentes interativos aninhados também devem ser preservados.");
    console.log("✓ MININAVEGACAO mantém CSS mobile consolidado, altura fixa e conteúdo no topo");
}

executar()
    .then(testarFechamentoExplicito)
    .then(testarMarcadoresLegadosAninhados)
    .then(testarLayoutMobileConsolidado)
    .catch(erro => { console.error(erro); process.exitCode = 1; });
