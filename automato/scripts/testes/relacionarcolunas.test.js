const assert = require("assert");
const { interpretarTabelasComponentes, validarTabelasComponentes } = require("../InterpretarTabelasComponentes");
const relacionarColunas = require("../Componentes/relacionarcolunas/relacionarcolunas");
const { renderizarPreviewComponente } = require("../EditorPreview");

const tabela = (identificadores = "A, B, C ou 1, 2, 3") => `<table><tbody>
<tr><td colspan="2"><strong>RELACIONAR COLUNAS</strong></td></tr>
<tr><td>Maçã</td><td>Vermelha</td></tr>
<tr><td>Banana</td><td>Amarelo</td></tr>
<tr><td colspan="2">${identificadores}</td></tr>
<tr><td colspan="2">Parabéns, é isso mesmo!</td></tr>
<tr><td colspan="2">Tente novamente, você consegue.</td></tr>
</tbody></table>`;

async function run() {
    assert.deepStrictEqual(validarTabelasComponentes(tabela()), []);
    const convertido = interpretarTabelasComponentes(tabela());
    assert.match(convertido, /<componente tipo="relacionarcolunas"><modo>letra<\/modo>/);
    assert.match(convertido, /<opcao>Maçã<resposta>Vermelha/);
    assert.match(convertido, /<feedcerto>Parabéns, é isso mesmo!<\/feedcerto>/);

    const fonte = `<modo>letra</modo><opcao>Maçã<resposta>Vermelha<opcao>Banana<resposta>Amarelo<feedcerto>Acertou!<feederrado>Tente de novo.</feederrado>`;
    const dadosLetras = relacionarColunas.interpretarRoteiro(fonte);
    assert.deepStrictEqual(dadosLetras.pares.map(par => par.identificador), ["A", "B"]);
    assert.equal(relacionarColunas.normalizarModo("NÚMERO"), "numero");
    assert.equal(relacionarColunas.criarLetra(26), "AA");

    const numeroSource = fonte.replace("<modo>letra", "<modo>numero");
    assert.deepStrictEqual(relacionarColunas.interpretarRoteiro(numeroSource).pares.map(par => par.identificador), ["1", "2"]);

    const originalRandom = Math.random;
    let htmlEmbaralhadoA;
    let htmlEmbaralhadoB;
    try {
        Math.random = () => 0;
        htmlEmbaralhadoA = await relacionarColunas(fonte);
        Math.random = () => 0.999999;
        htmlEmbaralhadoB = await relacionarColunas(fonte);
    } finally {
        Math.random = originalRandom;
    }
    const ordem = html => [...html.matchAll(/data-rc-resposta="([A-Z0-9]+)"/g)].map(match => match[1]);
    assert.deepStrictEqual(ordem(htmlEmbaralhadoA), ["B", "A"]);
    assert.deepStrictEqual(ordem(htmlEmbaralhadoB), ["A", "B"]);
    assert.match(htmlEmbaralhadoA, /data-rc-acoes aria-hidden="true"/);
    assert.match(htmlEmbaralhadoA, /\.rc-acoes[\s\S]*?min-height: 46px[\s\S]*?visibility: hidden[\s\S]*?opacity: 0/);
    assert.match(htmlEmbaralhadoA, /data-rc-submeter disabled>Submeter<\/button>/);
    assert.match(htmlEmbaralhadoA, /role="dialog" aria-modal="true"/);
    assert.match(htmlEmbaralhadoA, /maxlength="1"/);

    function criarElemento(atributos = {}) {
        const eventos = {};
        const mapaAtributos = new Map(Object.entries(atributos));
        const classes = new Set();
        return {
            value: "",
            hidden: false,
            disabled: false,
            parentElement: null,
            classList: {
                add(nome) { classes.add(nome); },
                remove(nome) { classes.delete(nome); },
                contains(nome) { return classes.has(nome); }
            },
            addEventListener(nome, callback) { eventos[nome] = callback; },
            setAttribute(nome, valor) { mapaAtributos.set(nome, String(valor)); },
            getAttribute(nome) { return mapaAtributos.get(nome) || null; },
            focus() { documento.activeElement = this; },
            select() { this.selecionado = true; },
            disparar(nome, evento = {}) { eventos[nome]?.({ target: this, ...evento }); }
        };
    }

    const entradasUI = [...htmlEmbaralhadoA.matchAll(/<input class="rc-input"[^>]*maxlength="(\d+)"[^>]*data-rc-resposta="([A-Z0-9]+)"/g)]
        .map(([, maxlength, resposta]) => criarElemento({ maxlength, "data-rc-resposta": resposta }));
    const acoesUI = criarElemento();
    acoesUI.setAttribute("aria-hidden", "true");
    const botaoUI = criarElemento();
    const modalUI = criarElemento({ "aria-hidden": "true" });
    modalUI.hidden = true;
    const feedbackCertoUI = criarElemento();
    const feedbackErradoUI = criarElemento();
    const fecharUI = criarElemento();
    const conteudoModalUI = criarElemento();
    const seletores = {
        "[data-rc-acoes]": acoesUI,
        "[data-rc-submeter]": botaoUI,
        "[data-rc-modal]": modalUI,
        "[data-rc-feedback-certo]": feedbackCertoUI,
        "[data-rc-feedback-errado]": feedbackErradoUI,
        "[data-rc-fechar]": fecharUI,
        "[data-rc-modal-conteudo]": conteudoModalUI
    };
    const raizUI = {
        atributos: new Map(),
        setAttribute(nome, valor) { this.atributos.set(nome, String(valor)); },
        getAttribute(nome) { return this.atributos.get(nome) || null; },
        querySelectorAll(seletor) {
            const consultas = {
                "[data-rc-resposta]": entradasUI,
                "[data-rc-acoes]": [acoesUI],
                "[data-rc-submeter]": [botaoUI],
                "[data-rc-modal]": [modalUI],
                "[data-rc-feedback-certo]": [feedbackCertoUI],
                "[data-rc-feedback-errado]": [feedbackErradoUI],
                "[data-rc-fechar]": [fecharUI],
                "[data-rc-modal-conteudo]": [conteudoModalUI]
            };
            return consultas[seletor] || [];
        },
        querySelector(seletor) { return seletores[seletor] || null; }
    };
    [acoesUI, botaoUI, modalUI, feedbackCertoUI, feedbackErradoUI, fecharUI, conteudoModalUI,
        ...entradasUI].forEach(elemento => {
        elemento.closest = seletor => seletor === ".rc-componente" ? raizUI : null;
    });
    const corpoUI = { appendChild(elemento) { elemento.parentElement = this; } };
    const documento = {
        activeElement: null,
        body: corpoUI,
        getElementById() { return raizUI; },
        querySelectorAll() { return []; },
        addEventListener() {},
        dispatchEvent() {}
    };
    const script = htmlEmbaralhadoA.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    require("node:vm").runInNewContext(script, {
        document: documento,
        window: { getComputedStyle: () => ({ zIndex: "auto" }) },
        CustomEvent: function (nome, opcoes) { this.type = nome; this.detail = opcoes?.detail; }
    });
    entradasUI[0].value = entradasUI[0].getAttribute("data-rc-resposta");
    entradasUI[0].disparar("input");
    assert.equal(documento.activeElement, entradasUI[1], "Relacionar Colunas avança o foco ao completar a resposta");
    assert.equal(acoesUI.classList.contains("is-visivel"), false, "o botão continua oculto enquanto falta preencher um campo");
    entradasUI[1].value = entradasUI[1].getAttribute("data-rc-resposta");
    entradasUI[1].disparar("input");
    assert.equal(acoesUI.classList.contains("is-visivel"), true, "o botão aparece quando todos os campos são preenchidos");
    assert.equal(acoesUI.getAttribute("aria-hidden"), "false");

    const preview = await renderizarPreviewComponente("relacionarcolunas", `<componente tipo="relacionarcolunas">${fonte}</componente>`);
    assert.match(preview, /class="rc-componente"/);
    assert.match(preview, /data-rc-input="1"/);
    console.log("Relacionar Colunas: tabela, modos, embaralhamento e prévia verificados.");
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
