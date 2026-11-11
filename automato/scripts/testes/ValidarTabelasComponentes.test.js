const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
    interpretarTabelasComponentes,
    interpretarTabelaBotoes,
    interpretarTabelaHotword
} = require("../InterpretarTabelasComponentes");
const { validarTelasDocumento } = require("../ValidarDocumentoTabelas");
const { processarComponente } = require("../ProcessarComponentesAninhados");

const contexto = { topico: "Introdução à agricultura", numeroTopico: 2, tela: 5 };

function tabelaBotoes(linhas) {
    return `<table><tr><td colspan="2">BOTÕES</td></tr>${linhas}</table>`;
}

function tabelaHotword(linhas) {
    return `<table><tr><td colspan="2">HOTWORD</td></tr>${linhas}</table>`;
}

function tela(numero, conteudo) {
    return { numero, partes: [conteudo] };
}

async function executar() {
    // 1. BOTÕES com os dois campos preenchidos.
    const botoesValidos = tabelaBotoes(
        `<tr><td>Botão 1</td><td><p>Janela 1</p></td></tr>` +
        `<tr><td>Botão 2</td><td><p>Janela 2</p></td></tr>`
    );
    assert.match(interpretarTabelaBotoes(botoesValidos, contexto), /<botao>Botão 1<\/botao><janela><p>Janela 1/);

    // 2. BOTÕES com uma linha totalmente vazia: a linha é ignorada.
    const botoesComLinhaVazia = tabelaBotoes(
        `<tr><td>Botão 1</td><td><p>Janela 1</p></td></tr>` +
        `<tr><td></td><td><p>&nbsp;</p></td></tr>` +
        `<tr><td>Botão 2</td><td><p>Janela 2</p></td></tr>`
    );
    const botoesSemLinhaVazia = interpretarTabelaBotoes(botoesComLinhaVazia, contexto);
    assert.equal((botoesSemLinhaVazia.match(/<botao>/g) || []).length, 2);

    // 3. BOTÕES com somente o nome preenchido.
    assert.throws(
        () => interpretarTabelaBotoes(tabelaBotoes(`<tr><td>Botão 3</td><td></td></tr>`), contexto),
        erro => erro.message.includes('tópico 2 ("Introdução à agricultura")') &&
            erro.message.includes("tela 5") && erro.message.includes("BOTÕES") &&
            erro.message.includes("linha 2") && erro.message.includes("Botão 3") &&
            erro.message.includes("conteúdo da janela")
    );

    // 4. BOTÕES com somente o conteúdo da janela preenchido.
    assert.throws(
        () => interpretarTabelaBotoes(tabelaBotoes(`<tr><td></td><td><p>Janela sem nome</p></td></tr>`), contexto),
        /nome do botão/
    );

    // 5. HOTWORD com os dois campos preenchidos.
    const hotwordValida = tabelaHotword(
        `<tr><td>Luz solar</td><td><p>Energia do Sol.</p></td></tr>`
    );
    assert.match(interpretarTabelaHotword(hotwordValida, contexto), /<hotword>Luz solar<janela><p>Energia do Sol/);

    // 6. HOTWORD com uma linha totalmente vazia: a linha é ignorada.
    const hotwordComLinhaVazia = tabelaHotword(
        `<tr><td>Luz solar</td><td><p>Energia do Sol.</p></td></tr>` +
        `<tr><td></td><td></td></tr>` +
        `<tr><td>Solo</td><td><p>Camada superficial da Terra.</p></td></tr>`
    );
    assert.equal((interpretarTabelaHotword(hotwordComLinhaVazia, contexto).match(/<hotword>/g) || []).length, 2);

    // 7. HOTWORD com somente a expressão preenchida.
    assert.throws(
        () => interpretarTabelaHotword(tabelaHotword(`<tr><td>Agricultura familiar</td><td></td></tr>`), contexto),
        erro => erro.message.includes("HOTWORD") && erro.message.includes("tela 5") &&
            erro.message.includes("linha 2") && erro.message.includes("explicação da expressão")
    );

    // 8. HOTWORD com somente a explicação preenchida.
    assert.throws(
        () => interpretarTabelaHotword(tabelaHotword(`<tr><td></td><td><p>Explicação sem termo</p></td></tr>`), contexto),
        /palavra ou expressão/
    );

    // 9. Mais de uma linha incompleta na mesma tabela: todos os erros são reunidos.
    const tabelaComVariosErros = tabelaBotoes(
        `<tr><td>Botão A</td><td></td></tr>` +
        `<tr><td></td><td><p>Janela B</p></td></tr>` +
        `<tr><td>Botão C</td><td></td></tr>`
    );
    const errosDaTabela = require("../InterpretarTabelasComponentes")
        .validarTabelasComponentes(tabelaComVariosErros, contexto);
    assert.equal(errosDaTabela.length, 3);
    assert.deepEqual(errosDaTabela.map(erro => erro.numeroLinha), [2, 3, 4]);

    // 10. Erros em componentes de tópicos e telas diferentes são apresentados juntos.
    const topicos = [
        {
            nomeTopico: "Introdução",
            numeroTopico: 1,
            telas: [
                tela(1, `<p>Texto inicial</p>${tabelaBotoes(`<tr><td>Avançar</td><td></td></tr>`)}`),
                tela(2, `<p>Continuação</p>`)
            ]
        },
        {
            nomeTopico: "Conceitos",
            numeroTopico: 2,
            telas: [
                tela(1, `<p>Texto</p>`),
                tela(2, `${tabelaHotword(`<tr><td>Solo fértil</td><td></td></tr>`)}`)
            ]
        }
    ];
    assert.throws(
        () => validarTelasDocumento(topicos),
        erro => erro.name === "ErroValidacaoTabelas" &&
            erro.erros.length === 2 &&
            erro.message.includes('tela 1, tópico 1 ("Introdução")') &&
            erro.message.includes('tela 2, tópico 2 ("Conceitos")')
    );

    // HOTWORD pode aparecer em mais de uma tabela na mesma tela.
    const duasHotwords = `<p>Texto</p>${hotwordValida}${hotwordValida}`;
    assert.equal(
        require("../InterpretarTabelasComponentes").validarTabelasComponentes(duasHotwords, contexto).length,
        0
    );

    // 11. Conteúdo anterior, intermediário e posterior às tabelas permanece na ordem original.
    const conteudoComTabelas =
        `<p>Antes da primeira tabela.</p>${botoesValidos}` +
        `<p>Entre as tabelas.</p>${hotwordValida}<p>Depois da última tabela.</p>`;
    const convertido = interpretarTabelasComponentes(conteudoComTabelas, contexto);
    const posicoes = [
        convertido.indexOf("Antes da primeira tabela."),
        convertido.indexOf("<botoes>"),
        convertido.indexOf("Entre as tabelas."),
        convertido.indexOf("<hotword>Luz solar"),
        convertido.indexOf("Depois da última tabela.")
    ];
    assert.ok(posicoes.every(posicao => posicao >= 0));
    assert.deepEqual(posicoes, [...posicoes].sort((a, b) => a - b));

    // A pré-validação global deve ocorrer antes da preparação e da exclusão de saídas anteriores.
    const mainSource = fs.readFileSync(path.join(__dirname, "../../main.js"), "utf8");
    const posicaoPreValidacao = mainSource.indexOf("validarDocumentoTabelas(tables)");
    const posicaoPreparacao = mainSource.indexOf("await prepararPastaCurso(metadados)");
    const posicaoExclusao = mainSource.indexOf("await fs.rm(path.join(caminhoBaseSaida, siglaNumeroLicao)");
    assert.ok(posicaoPreValidacao >= 0, "main.js deve executar a pré-validação global");
    assert.ok(posicaoPreValidacao < posicaoPreparacao, "a validação deve ocorrer antes da preparação de pastas");
    assert.ok(posicaoPreValidacao < posicaoExclusao, "a validação deve ocorrer antes de apagar saídas existentes");

    // 12. Componentes antigos definidos por tags continuam passando pelo fluxo legado.
    const legado = `<p>Texto legado.</p><botoes><botao>Continuar</botao><janela><p>Janela antiga.</p></janela></botoes>`;
    assert.equal(interpretarTabelasComponentes(legado, contexto), legado);
    const htmlLegado = await processarComponente("tela", legado, 1, 1);
    assert.ok(htmlLegado.includes("botao-item"));
    assert.ok(htmlLegado.includes("Janela antiga."));

    console.log("✓ 12 cenários de validação central e compatibilidade executados.");
    console.log("✓ Todos os campos incompletos são contextualizados por tópico, tela, componente e linha.");
    console.log("✓ A pré-validação reúne erros de diferentes tópicos antes da geração.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
