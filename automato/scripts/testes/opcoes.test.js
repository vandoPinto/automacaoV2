const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { interpretarTabelasComponentes } = require("../InterpretarTabelasComponentes");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { renderizarPreviewComponente } = require("../EditorPreview");

const contexto = { nomeTopico: "Água e sustentabilidade", numeroTopico: 2, tela: 6 };

function tabelaOpcoes(linhas) {
    const dados = linhas.map(linha =>
        `<tr>${linha.map(valor => `<td>${valor || ""}</td>`).join("")}</tr>`
    ).join("");
    return `<table><tr><td colspan="3">Opções</td></tr>${dados}</table>`;
}

function tabelaOpcoesDuasColunas(alternativas, feedbackCerto, feedbackErrado) {
    const dados = alternativas.map(([texto, correta]) =>
        `<tr><td><p>${texto}</p></td><td><p>${correta}</p></td></tr>`
    ).join("");
    return `<table><tr><td colspan="2"><p>OPÇÕES</p></td></tr>${dados}` +
        `<tr><td colspan="2"><p>${feedbackCerto}</p></td></tr>` +
        `<tr><td colspan="2"><p>${feedbackErrado}</p></td></tr></table>`;
}

function criarNoFake(documento) {
    const classes = new Set();
    const atributos = new Map();
    const eventos = {};
    return {
        disabled: false,
        checked: false,
        hidden: false,
        textContent: "",
        style: {},
        parentElement: null,
        nextElementSibling: null,
        classList: {
            add(...nomes) { nomes.forEach(nome => classes.add(nome)); },
            remove(...nomes) { nomes.forEach(nome => classes.delete(nome)); },
            contains(nome) { return classes.has(nome); }
        },
        addEventListener(nome, callback) { eventos[nome] = callback; },
        setAttribute(nome, valor) { atributos.set(nome, String(valor)); },
        getAttribute(nome) { return atributos.get(nome) || null; },
        focus() { documento.activeElement = this; },
        disparar(nome, evento = {}) { eventos[nome]?.(evento); },
        classes
    };
}

async function executar() {
    const tabela = tabelaOpcoesDuasColunas([
        ["Fechar a torneira ao escovar os dentes.", "SIM"],
        ["Deixar a torneira aberta.", "NÃO"],
        ["Lavar a calçada diariamente com mangueira.", "SIM"]
    ], "Parabéns, é isso mesmo!", "Tente novamente.");

    const convertida = interpretarTabelasComponentes(
        `<p>Qual atitude economiza água?</p>${tabela}<p>Depois.</p>`, contexto
    );
    assert.match(convertida, /<p>Qual atitude economiza água\?<\/p><componente tipo="opcoes"><alternativa>/);
    assert.match(convertida, /<correta>SIM<alternativa>/);
    assert.match(convertida, /<correta>SIM[\s\S]*?<feedcerto><p>Parabéns, é isso mesmo!<\/p><\/feedcerto><feederrado><p>Tente novamente\.<\/p><\/feederrado><\/componente>/);
    assert.match(convertida, /<componente tipo="opcoes">[\s\S]*?<\/componente><p>Depois\.<\/p>/);
    assert.equal((convertida.match(/Qual atitude economiza água\?/g) || []).length, 1);

    const html = await processarComponente("tela", convertida, 1, 6);
    assert.match(html, /class="opcoes-componente"/);
    assert.match(html, /type="checkbox"/);
    assert.match(html, /aria-label="Alternativas"/);
    assert.match(html, />Submeter<\/button>/);
    assert.doesNotMatch(html, /opcoes-pergunta|opcoes-instrucao/);
    assert.equal((html.match(/Qual atitude economiza água\?/g) || []).length, 1,
        "o enunciado escrito fora da tabela deve continuar visível uma única vez");
    assert.match(html, /data-opcoes-correta="true"/);
    assert.match(html, /role="dialog" aria-modal="true"/);
    assert.match(html, /Parabéns, é isso mesmo!/);
    assert.match(html, /Tente novamente\./);
    assert.doesNotMatch(html, /<\/componente>/);
    assert.match(html, /class="opcoes-acoes" data-opcoes-acoes aria-hidden="true"/);
    assert.match(html, /\.opcoes-acoes[\s\S]*?min-height: 46px[\s\S]*?visibility: hidden[\s\S]*?opacity: 0/);
    assert.doesNotMatch(html, /\.opcoes-acoes\s*\{[^}]*display:\s*none/);
    assert.equal((html.match(/class="opcoes-checkbox"/g) || []).length, 3);

    assert.throws(
        () => interpretarTabelasComponentes(tabelaOpcoes([
            ["<p>Pergunta</p>", "<p>Alternativa A</p>", "<p>Talvez</p>"],
            ["", "<p>Alternativa B</p>", "<p>NÃO</p>"]
        ]), contexto),
        erro => erro.message.includes("OPÇÕES") && erro.message.includes("SIM ou NÃO") && erro.message.includes("linha 2")
    );

    const multiplasCorretas = interpretarTabelasComponentes(tabelaOpcoesDuasColunas([
        ["Alternativa A", "SIM"],
        ["Alternativa B", "NÃO"],
        ["Alternativa C", "SIM"]
    ], "Acertou.", "Tente novamente."), contexto);
    assert.match(multiplasCorretas, /<correta>SIM[\s\S]*<correta>SIM/);

    assert.throws(
        () => interpretarTabelasComponentes(tabelaOpcoes([
            ["<p>Pergunta</p>", "<p>Única alternativa</p>", "<p>SIM</p>"]
        ]), contexto),
        /pelo menos 2 linhas de dados válidas/
    );

    const exemploServidor = fs.readFileSync(require.resolve("../../../server.js"), "utf8");
    assert.match(exemploServidor, /slug: 'opcoes', nome: 'Opções'/);
    const exemplo = exemploServidor.match(/opcoes: `([\s\S]*?)`/);
    assert.ok(exemplo, "O exemplo da Biblioteca deve estar cadastrado para o editor.");
    const preview = await renderizarPreviewComponente("opcoes", exemplo[1]);
    assert.match(preview, /class="opcoes-componente"/);
    assert.match(preview, /type="checkbox"/);
    assert.match(preview, />Submeter<\/button>/);
    assert.doesNotMatch(preview, /opcoes-instrucao|Qual destas ações ajuda a economizar água/);
    assert.match(preview, /Parabéns! Você selecionou todas as atitudes corretas\./);

    const script = preview.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, "A prévia deve incluir o comportamento interativo do componente.");
    const documento = {
        activeElement: null,
        ouvintes: {},
        body: {
            appendChild(elemento) {
                elemento.parentElement = this;
                elemento.nextElementSibling = null;
            }
        },
        addEventListener(nome, callback) { this.ouvintes[nome] = callback; },
        dispatchEvent(evento) { this.ouvintes[evento.type]?.(evento); },
        querySelectorAll() { return [modal]; },
        getElementById() { return raiz; }
    };
    const errada = criarNoFake(documento);
    const correta1 = criarNoFake(documento);
    const correta2 = criarNoFake(documento);
    const itemErrado = criarNoFake(documento);
    const itemCorreto1 = criarNoFake(documento);
    const itemCorreto2 = criarNoFake(documento);
    errada.getAttribute = nome => nome === "data-opcoes-correta" ? "false" : null;
    correta1.getAttribute = nome => nome === "data-opcoes-correta" ? "true" : null;
    correta2.getAttribute = nome => nome === "data-opcoes-correta" ? "true" : null;
    errada.closest = () => itemErrado;
    correta1.closest = () => itemCorreto1;
    correta2.closest = () => itemCorreto2;
    const botaoSubmeter = criarNoFake(documento);
    botaoSubmeter.disabled = true;
    const acoes = criarNoFake(documento);
    acoes.setAttribute("aria-hidden", "true");
    const modal = criarNoFake(documento);
    modal.hidden = true;
    const feedbackCerto = criarNoFake(documento);
    feedbackCerto.hidden = true;
    const feedbackErrado = criarNoFake(documento);
    feedbackErrado.hidden = true;
    const botaoFechar = criarNoFake(documento);
    const conteudoFeedback = criarNoFake(documento);
    const status = criarNoFake(documento);
    const raizAtributos = new Map();
    const raiz = {
        getAttribute(nome) { return raizAtributos.get(nome) || null; },
        setAttribute(nome, valor) { raizAtributos.set(nome, valor); },
        querySelectorAll(seletor) {
            const consultas = {
                ".opcoes-checkbox": [errada, correta1, correta2],
                "[data-opcoes-submeter]": [botaoSubmeter],
                "[data-opcoes-acoes]": [acoes],
                "[data-opcoes-feedback]": [modal],
                "[data-opcoes-feedback-certo]": [feedbackCerto],
                "[data-opcoes-feedback-errado]": [feedbackErrado],
                "[data-opcoes-feedback-fechar]": [botaoFechar],
                "[data-opcoes-feedback-conteudo]": [conteudoFeedback],
                "[data-opcoes-status]": [status]
            };
            return consultas[seletor] || [];
        },
        querySelector(seletor) {
            const seletores = {
                "[data-opcoes-submeter]": botaoSubmeter,
                "[data-opcoes-acoes]": acoes,
                "[data-opcoes-feedback]": modal,
                "[data-opcoes-feedback-certo]": feedbackCerto,
                "[data-opcoes-feedback-errado]": feedbackErrado,
                "[data-opcoes-feedback-fechar]": botaoFechar,
                "[data-opcoes-feedback-conteudo]": conteudoFeedback,
                "[data-opcoes-status]": status
            };
            return seletores[seletor] || null;
        }
    };
    [errada, correta1, correta2, botaoSubmeter, acoes, modal, feedbackCerto, feedbackErrado,
        botaoFechar, conteudoFeedback, status].forEach(elemento => {
        elemento.closest = seletor => seletor === ".opcoes-componente" ? raiz : null;
    });
    errada.closest = seletor => seletor === ".opcoes-alternativa" ? itemErrado : (seletor === ".opcoes-componente" ? raiz : null);
    correta1.closest = seletor => seletor === ".opcoes-alternativa" ? itemCorreto1 : (seletor === ".opcoes-componente" ? raiz : null);
    correta2.closest = seletor => seletor === ".opcoes-alternativa" ? itemCorreto2 : (seletor === ".opcoes-componente" ? raiz : null);
    vm.runInNewContext(script, {
        document: documento,
        window: { getComputedStyle() { return { zIndex: "0" }; } },
        CustomEvent: class CustomEventSimulado {
            constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
        }
    });

    correta1.checked = true;
    correta1.disparar("change");
    assert.equal(acoes.classes.has("is-visivel"), true);
    assert.equal(acoes.getAttribute("aria-hidden"), "false");
    assert.equal(botaoSubmeter.disabled, false);
    botaoSubmeter.disparar("click");
    assert.equal(modal.hidden, false);
    assert.equal(feedbackErrado.hidden, false);
    assert.ok(itemCorreto1.classList.contains("is-correta"));
    botaoFechar.disparar("click");
    assert.equal(modal.hidden, true);

    correta2.checked = true;
    correta2.disparar("change");
    botaoSubmeter.disparar("click");
    assert.equal(modal.hidden, false);
    assert.equal(feedbackCerto.hidden, false);
    assert.ok(itemCorreto1.classList.contains("is-correta"));
    assert.ok(itemCorreto2.classList.contains("is-correta"));
    assert.equal(errada.disabled, true);
    assert.equal(correta1.disabled, true);
    assert.equal(correta2.disabled, true);
    documento.ouvintes.keydown({ key: "Escape" });
    assert.equal(modal.hidden, true);

    console.log("✓ OPÇÕES: layout de seleção, submissão e modal de feedback verificados.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
