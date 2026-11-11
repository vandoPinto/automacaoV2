const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const {
    renderizarPreviewComponente,
    sanitizarFonteEditor,
    preservarQuebrasDeLinhaEmTexto
} = require("../EditorPreview");

function carregarExemplosBiblioteca() {
    const caminhoServidor = path.resolve(__dirname, "../../../server.js");
    const fonteServidor = fs.readFileSync(caminhoServidor, "utf8");
    const inicio = fonteServidor.indexOf("const exemplosBiblioteca = {");
    assert.notStrictEqual(inicio, -1, "Os exemplos oficiais da Biblioteca devem existir no server.js.");
    const fim = fonteServidor.indexOf("\n};", inicio);
    assert.notStrictEqual(fim, -1, "O objeto de exemplos da Biblioteca deve estar fechado.");

    const bloco = fonteServidor.slice(inicio, fim + 3)
        .replace("const exemplosBiblioteca =", "exemplosBiblioteca =");
    const contexto = {};
    vm.createContext(contexto);
    vm.runInContext(bloco, contexto);
    return contexto.exemplosBiblioteca;
}

(async () => {
    const exemplos = carregarExemplosBiblioteca();
    const esperados = [
        "botao", "hotword", "abas", "flashcard",
        "opcoes", "verdadeirofalso", "jogomemoria", "mininavegacao", "sanfona", "ligapontos", "forca",
        "relacionarcolunas"
    ];

    assert.deepStrictEqual(Object.keys(exemplos).sort(), esperados.slice().sort());

    for (const slug of esperados) {
        const html = await renderizarPreviewComponente(slug, exemplos[slug]);
        assert.ok(html.includes("<style"), `${slug}: o template real deve fornecer CSS.`);
        assert.ok(html.includes("<script"), `${slug}: o template real deve fornecer JavaScript.`);
        assert.ok(html.includes("tela-container"), `${slug}: a saída deve usar o template real de TELA.`);
        assert.ok(html.includes("conteudo-item-integral"), `${slug}: o componente deve ocupar o bloco integral da TELA.`);
        assert.ok(html.length > 1000, `${slug}: a saída renderizada não pode estar vazia.`);
        console.log(`✓ ${slug}: template oficial renderizado (${html.length} caracteres).`);
    }

    const telaComVariosComponentes = `<div data-editor-component-block="botao">${exemplos.botao}</div><div data-editor-component-block="hotword">${exemplos.hotword}</div>`;
    const htmlTelaComposta = await renderizarPreviewComponente("tela", telaComVariosComponentes);
    assert.ok(htmlTelaComposta.includes("tela-container"), "A tela com múltiplos componentes deve usar o template real de Tela.");
    assert.equal(
        (htmlTelaComposta.match(/var instanciaId = \"botao-/g) || []).length,
        1,
        "O script de interação de BOTÕES deve aparecer uma única vez por componente na pré-visualização composta."
    );
    assert.equal(
        (htmlTelaComposta.match(/class=\"botao-item/g) || []).length,
        3,
        "Os três gatilhos de BOTÕES devem continuar presentes na tela composta."
    );
    assert.ok(htmlTelaComposta.length > 1500, "A tela composta deve renderizar conteúdo dos componentes adicionados.");
    assert.ok((htmlTelaComposta.match(/class="conteudo-item/g) || []).length >= 2, "Os dois componentes devem aparecer dentro da mesma área de Tela.");
    assert.ok(!/class="conteudo-item[^"]*conteudo-item-integral/.test(htmlTelaComposta), "Blocos irmãos devem usar a distribuição Desktop normal da Tela, não largura integral comprimida.");
    console.log("✓ Tela com mais de um componente usa os wrappers irmãos do layout Desktop real.");

    // O novo editor envia o código digitado diretamente, sem DIVs internos
    // data-editor-component-block nem inserção automática pela Biblioteca.
    const codigoDigitadoDireto = `
      <componente tipo="botao">
        <p><botao>Consultar detalhes</botao><janela>Detalhes digitados diretamente no Editor.</janela></p>
      </componente>
    `;
    const previewCodigoDireto = await renderizarPreviewComponente("tela", codigoDigitadoDireto);
    assert.ok(previewCodigoDireto.includes('class="botao-item"'), "O código digitado diretamente deve renderizar o componente BOTÃO original.");
    assert.ok(previewCodigoDireto.includes("Detalhes digitados diretamente no Editor."), "O texto digitado diretamente deve chegar à pré-visualização.");
    assert.ok(!previewCodigoDireto.includes("data-editor-component-block"), "A nova estrutura não deve depender de wrappers internos do Editor.");

    const codigoComEnters = `<componente tipo="botao">
      <p>Primeira linha
      Segunda linha

      Terceira linha


      Quarta linha</p>
      <botao>Consultar detalhes</botao><janela>Detalhes.</janela>
    </componente>`;
    const previewComEnters = await renderizarPreviewComponente("tela", codigoComEnters);
    assert.ok(
        previewComEnters.includes("Primeira linha<br>Segunda linha<br><br>Terceira linha<br><br><br>Quarta linha"),
        "A prévia real deve manter um, dois e três Enters no texto digitado dentro do componente."
    );
    console.log("✓ Prévia real mantém Enters simples, duplos e triplos dentro do conteúdo do componente.");
    console.log("✓ Código digitado diretamente é processado sem marcadores internos do Editor.");

    const telaBotoesFlashcard = `<div data-editor-component-block="botao">${exemplos.botao}</div><div data-editor-component-block="flashcard">${exemplos.flashcard}</div>`;
    const htmlBotoesFlashcard = await renderizarPreviewComponente("tela", telaBotoesFlashcard);
    const wrappersBotoesFlashcard = [...htmlBotoesFlashcard.matchAll(/<div class="conteudo-item[^>]*>/g)].map(match => match[0]);
    assert.equal(wrappersBotoesFlashcard.length, 2, "Botões e Flashcard devem ser dois itens irmãos na mesma Tela.");
    assert.ok(wrappersBotoesFlashcard.every(wrapper => !wrapper.includes("conteudo-item-integral")), "Botões e Flashcard devem seguir a distribuição Desktop de dois blocos.");

    const telaComAbas = await renderizarPreviewComponente("abas", exemplos.abas);
    assert.ok(telaComAbas.includes(".abas-componente"), "ABAS deve manter seus estilos reais na TELA.");
    assert.ok(telaComAbas.includes("conteudo-item-integral"), "Um componente isolado deve ocupar a área integral da TELA.");


    // Regressão: cadeia profunda MININAVEGAÇÃO > ABAS > SANFONA >
    // FLASHCARD > BOTÕES > HOTWORD, com introdução antes da navegação.
    // Os marcadores FRENTE/VERSO são delimitadores sequenciais do roteiro,
    // portanto não recebem fechamento HTML explícito.
    const roteiroProfundo = `
      <p><strong>TESTE 1 — WRAPPERS UNIVERSAIS EM SEIS NÍVEIS</strong></p>
      <p><em>INSTRUÇÃO DE TESTE: avance e retorne na MININAVEGAÇÃO; alterne as ABAS; abra os dois painéis da SANFONA; vire os dois cartões; abra o BOTÃO e a HOTWORD dentro do primeiro cartão.</em></p>
      <p>Este roteiro verifica a cadeia MININAVEGAÇÃO &gt; ABAS &gt; SANFONA &gt; FLASHCARD &gt; BOTÕES &gt; HOTWORD.</p>
      <componente tipo="mininavegacao">
        <janela>
          <componente tipo="abas">
            <aba>Conteúdo principal</aba>
            <janela>
              <componente tipo="sanfona">
                <botao>Painel 1 — Cartões e explicações</botao>
                <janela>
                  <componente tipo="flashcard">
                    <frente>O que significa autonomia?
                    <verso>Autonomia é a capacidade de tomar decisões e agir com independência.
                      <componente tipo="botao">
                        <botao>Ver explicação complementar</botao>
                        <janela>O termo autonomia aparece nesta explicação. Abra a HOTWORD para consultar o conceito.
                          <componente tipo="hotword">
                            O termo autonomia aparece nesta explicação.
                            <hotword>autonomia</hotword>
                            <janela>Autonomia é a capacidade de decidir e agir com liberdade e responsabilidade.
                          </componente>
                        </janela>
                      </componente>
                    <frente>Por que a participação é importante?
                    <verso>A participação permite que diferentes pessoas contribuam para as decisões coletivas.
                  </componente>
                </janela>
                <botao>Painel 2 — Conteúdo adicional</botao>
                <janela>Este é o segundo painel da SANFONA. Abra-o e depois retorne ao primeiro.
                  <componente tipo="botao">
                    <botao>Abrir informação do painel 2</botao>
                    <janela>BOTÃO filho dentro do segundo painel da SANFONA.</janela>
                  </componente>
                </janela>
              </componente>
            </janela>
            <aba>Segunda aba</aba>
            <janela>Conteúdo da segunda aba. A primeira aba deve deixar de ficar selecionada.
              <componente tipo="hotword">
                A palavra participação é importante para este exemplo.
                <hotword>participação</hotword>
                <janela>Participação é o envolvimento ativo em uma atividade ou decisão.</janela>
              </componente>
            </janela>
          </componente>
        </janela>
        <janela>Segunda etapa da MININAVEGAÇÃO. Avance para cá e depois use Voltar para retornar à primeira etapa.
          <componente tipo="sanfona">
            <botao>Painel da segunda etapa A</botao>
            <janela>Conteúdo do painel A na segunda etapa.</janela>
            <botao>Painel da segunda etapa B</botao>
            <janela>Conteúdo do painel B na segunda etapa.</janela>
          </componente>
        </janela>
      </componente>
      <p>Fim do TESTE 1.</p>`;
    const htmlRoteiroProfundo = await renderizarPreviewComponente("tela", roteiroProfundo);
    for (const [marcador, descricao] of [
        ['class="mini-nav-componente"', "MININAVEGAÇÃO"],
        ['class="abas-componente"', "ABAS"],
        ['class="sanfona-componente"', "SANFONA"],
        ['class="flashcard-componente"', "FLASHCARD"],
        ['Ver explicação complementar', "BOTÃO dentro do FLASHCARD"],
        ['class="hotword-gatilho"', "HOTWORD aninhada"]
    ]) {
        assert.ok(htmlRoteiroProfundo.includes(marcador), `${descricao} deve permanecer na renderização profunda.`);
    }
    assert.equal((htmlRoteiroProfundo.match(/class="mini-nav-painel"/g) || []).length, 2,
        "As duas etapas da MININAVEGAÇÃO devem ser preservadas.");
    assert.equal((htmlRoteiroProfundo.match(/class="abas-painel(?:\s|\")/g) || []).length, 2,
        "As duas abas devem ser preservadas.");
    assert.equal((htmlRoteiroProfundo.match(/class="sanfona-item"/g) || []).length, 4,
        "Os dois painéis da primeira etapa e os dois da segunda devem ser preservados.");
    assert.equal((htmlRoteiroProfundo.match(/class="flip-box"/g) || []).length, 2,
        "Os dois cartões do FLASHCARD devem ser preservados.");
    assert.ok(htmlRoteiroProfundo.includes("Abrir informação do painel 2"),
        "O botão aninhado no segundo painel deve continuar presente.");
    console.log("✓ Roteiro de seis níveis mantém MININAVEGAÇÃO, ABAS, SANFONA, dois FLASHCARDS, BOTÕES e HOTWORD.");

    // Regressão: o Editor usa <div><br></div> para representar uma linha
    // vazia entre dois parágrafos. O fluxo completo da prévia deve preservá-la.
    const blocoComParagrafosSeparados =
        '<div data-editor-component-block="sanfona">' +
            '<div>Dica: primeiro parágrafo.</div>' +
            '<div><br></div>' +
            '<div>Dica: segundo parágrafo.</div>' +
            '<botao>Painel de teste</botao><janela>Conteúdo do painel.</janela>' +
        '</div>';
    const htmlParagrafosSeparados = await renderizarPreviewComponente("tela", blocoComParagrafosSeparados);
    const posPrimeiraDica = htmlParagrafosSeparados.indexOf("Dica: primeiro parágrafo.");
    const posSeparador = htmlParagrafosSeparados.indexOf("<div><br></div>");
    const posSegundaDica = htmlParagrafosSeparados.indexOf("Dica: segundo parágrafo.");
    assert.ok(posPrimeiraDica >= 0 && posSeparador > posPrimeiraDica && posSegundaDica > posSeparador,
        "A pré-visualização deve manter a linha em branco entre dois parágrafos de texto.");

    const paragrafosComLinhaVazia = await renderizarPreviewComponente(
        "tela",
        '<p>Primeiro parágrafo.</p><div data-editor-blank-line="true"><br></div><p>Segundo parágrafo.</p>'
    );
    assert.ok(
        /<p>Primeiro parágrafo\.<\/p>\s*<div[^>]*data-editor-blank-line="true"[^>]*>\s*<br\s*\/?>\s*<\/div>\s*<p>Segundo parágrafo\.<\/p>/i.test(paragrafosComLinhaVazia),
        "A pré-visualização deve preservar a linha vazia do Editor entre dois parágrafos."
    );
    console.log("✓ Pré-visualização preserva parágrafos e linhas vazias criados por Enters consecutivos.");

    // Regressão: LF digitados como texto livre devem gerar parágrafos reais;
    // dentro de um <p> existente, Shift+Enter/Enter continuam como <br>.
    const textoComEnter = preservarQuebrasDeLinhaEmTexto('<div>Primeira linha\nSegunda linha</div>');
    assert.equal(textoComEnter, '<div><p>Primeira linha</p><p>Segunda linha</p></div>',
        "Um Enter em texto livre deve iniciar um novo parágrafo.");
    const textoComDoisEnters = preservarQuebrasDeLinhaEmTexto('<div>Primeira linha\n\nSegunda linha</div>');
    assert.equal(textoComDoisEnters, '<div><p>Primeira linha</p><p><br></p><p>Segunda linha</p></div>',
        "Dois Enters devem preservar uma linha vazia entre os parágrafos.");
    const textoComTresEnters = preservarQuebrasDeLinhaEmTexto('<div>Primeira linha\n\n\nSegunda linha</div>');
    assert.equal(textoComTresEnters, '<div><p>Primeira linha</p><p><br></p><p><br></p><p>Segunda linha</p></div>',
        "Três Enters devem preservar duas linhas vazias entre os parágrafos.");
    const textoAposComponente = preservarQuebrasDeLinhaEmTexto('</botoes>\nDica final\n\nteste 1\nteste 2\n\nteste 3');
    assert.equal(textoAposComponente, '</botoes><p>Dica final</p><p><br></p><p>teste 1</p><p>teste 2</p><p><br></p><p>teste 3</p>',
        "Texto livre após o fechamento do componente deve gerar parágrafos separados, sem concatenar linhas.");
    const textoIndentado = preservarQuebrasDeLinhaEmTexto('<div>\n  Texto com recuo\n</div>');
    assert.equal(textoIndentado, '<div>Texto com recuo</div>',
        "A indentação de código ao redor do conteúdo não deve criar linhas extras.");
    const textoComInline = preservarQuebrasDeLinhaEmTexto('<p>Primeiro\n<strong>segundo</strong>\nterceiro</p>');
    assert.equal(textoComInline, '<p>Primeiro<br><strong>segundo</strong><br>terceiro</p>',
        "Quebras entre elementos inline devem permanecer no mesmo fluxo textual.");
    const codigoLiteral = preservarQuebrasDeLinhaEmTexto('<pre>linha 1\n  linha 2</pre>');
    assert.equal(codigoLiteral, '<pre>linha 1\n  linha 2</pre>',
        "Blocos pre formatados devem manter suas quebras literais.");
    console.log("✓ Um, dois e três Enters são preservados como quebras visíveis, sem afetar indentação ou HTML inline.");

    const conteudoRico = '<p><strong>Negrito</strong> e <em>itálico</em></p>' +
        '<img src="data:image/png;base64,AAAA" onerror="alert(1)" alt="figura">' +
        '<script>alert("não executar")</script>';
    const seguro = sanitizarFonteEditor(conteudoRico);
    assert.ok(seguro.includes("<strong>Negrito</strong>"));
    assert.ok(seguro.includes("<em>itálico</em>"));
    assert.ok(seguro.includes('src="data:image/png;base64,AAAA"'));
    assert.ok(!/onerror\s*=/i.test(seguro));
    assert.ok(!/<script\b/i.test(seguro));

    await assert.rejects(
        () => renderizarPreviewComponente("nao-existe", "<p>teste</p>"),
        /não está disponível/i
    );

    console.log("✓ Sanitização preserva formatação e imagens, removendo scripts e eventos do conteúdo.");
    console.log("✓ Componente não autorizado é recusado.");
    console.log(`\nTeste de pré-visualização real concluído: ${esperados.length} componentes aprovados.`);
})().catch(erro => {
    console.error("Falha no teste de pré-visualização real:", erro);
    process.exitCode = 1;
});
