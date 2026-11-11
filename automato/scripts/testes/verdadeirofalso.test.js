const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { interpretarTabelasComponentes } = require("../InterpretarTabelasComponentes");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { renderizarPreviewComponente } = require("../EditorPreview");
const componente = require("../Componentes/verdadeirofalso/verdadeirofalso");

const tabela = `
<p>Digite “V” para verdadeiro e “F” para falso.</p>
<table><tbody>
<tr><td colspan="2"><strong>VERDADEIRO OU FALSO</strong></td></tr>
<tr><td>V</td><td><p>O céu é azul?</p></td></tr>
<tr><td>F</td><td>A Terra é plana?</td></tr>
<tr><td colspan="2">Parabéns, é isso mesmo!</td></tr>
<tr><td colspan="2">Tente novamente, você consegue.</td></tr>
</tbody></table>`;

(async () => {
    const convertido = interpretarTabelasComponentes(tabela);
    assert.match(convertido, /<p>Digite “V” para verdadeiro e “F” para falso\.<\/p>/);
    assert.match(convertido, /<componente tipo="verdadeirofalso">/);
    assert.match(convertido, /<alternativa><p>O céu é azul\?<\/p><correta>V/);
    assert.match(convertido, /<alternativa>A Terra é plana\?<correta>F/);
    assert.match(convertido, /<feedcerto>Parabéns, é isso mesmo!/);
    assert.match(convertido, /<feederrado>Tente novamente, você consegue\./);

    const incompleta = tabela.replace("<td>A Terra é plana?</td>", "<td></td>");
    assert.throws(() => interpretarTabelasComponentes(incompleta), /frase da atividade/);
    const semFeedback = tabela.replace("<tr><td colspan=\"2\">Tente novamente, você consegue.</td></tr>", "");
    assert.throws(() => interpretarTabelasComponentes(semFeedback), /duas linhas mescladas/);

    const interno = convertido.match(/<componente tipo="verdadeirofalso">([\s\S]*?)<\/componente>/)[1];
    const html = await processarComponente("verdadeirofalso", interno, 1, 7);
    assert.match(html, /class="vf-componente"/);
    assert.match(html, /data-vf-resposta="V"/);
    assert.match(html, /maxlength="1" style="--vf-largura:/);
    assert.ok(html.indexOf("class=\"vf-resposta\"") < html.indexOf("O céu é azul?"), "o campo aparece à esquerda da frase");
    assert.match(html, />Submeter<\/button>/);
    assert.match(html, /Parabéns, é isso mesmo!/);
    assert.match(html, /Tente novamente, você consegue\./);
    const respostaEmPalavra = await componente("<alternativa>Responda</alternativa><correta>Certo</correta>");
    assert.match(respostaEmPalavra, /maxlength="5"/, "V/F permite avançar no tamanho da resposta definida, mesmo quando for uma palavra");
    assert.equal(componente.normalizarResposta("  v  "), componente.normalizarResposta("V"));
    assert.notEqual(componente.normalizarResposta("e"), componente.normalizarResposta("é"));

    function criarElemento(atributos = {}) {
        const eventos = {};
        const mapaAtributos = new Map(Object.entries(atributos));
        const classes = new Set();
        return {
            value: "",
            hidden: false,
            disabled: false,
            style: {},
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
            disparar(nome, evento = {}) { eventos[nome]?.({ target: this, ...evento }); }
        };
    }

    const respostasUI = ["V", "F", "F"].map(resposta => criarElemento({ "data-vf-resposta": resposta, maxlength: "1" }));
    const acoesUI = criarElemento();
    acoesUI.setAttribute("aria-hidden", "true");
    const botaoUI = criarElemento();
    botaoUI.disabled = true;
    const modalUI = criarElemento({ "aria-hidden": "true" });
    modalUI.hidden = true;
    const feedbackCertoUI = criarElemento();
    const feedbackErradoUI = criarElemento();
    const fecharUI = criarElemento();
    const conteudoModalUI = criarElemento();
    const statusUI = criarElemento();
    const seletores = {
        "[data-vf-acoes]": acoesUI,
        "[data-vf-submeter]": botaoUI,
        "[data-vf-modal]": modalUI,
        "[data-vf-feedback-certo]": feedbackCertoUI,
        "[data-vf-feedback-errado]": feedbackErradoUI,
        "[data-vf-fechar]": fecharUI,
        "[data-vf-modal-conteudo]": conteudoModalUI,
        "[data-vf-status]": statusUI
    };
    const raizUI = {
        atributos: new Map(),
        setAttribute(nome, valor) { this.atributos.set(nome, String(valor)); },
        getAttribute(nome) { return this.atributos.get(nome) || null; },
        querySelectorAll(seletor) {
            const consultas = {
                ".vf-resposta": respostasUI,
                "[data-vf-acoes]": [acoesUI],
                "[data-vf-submeter]": [botaoUI],
                "[data-vf-modal]": [modalUI],
                "[data-vf-feedback-certo]": [feedbackCertoUI],
                "[data-vf-feedback-errado]": [feedbackErradoUI],
                "[data-vf-fechar]": [fecharUI],
                "[data-vf-modal-conteudo]": [conteudoModalUI],
                "[data-vf-status]": [statusUI]
            };
            return consultas[seletor] || [];
        },
        querySelector(seletor) { return seletores[seletor] || null; }
    };
    [acoesUI, botaoUI, modalUI, feedbackCertoUI, feedbackErradoUI, fecharUI, conteudoModalUI, statusUI,
        ...respostasUI].forEach(elemento => {
        elemento.closest = seletor => seletor === ".vf-componente" ? raizUI : null;
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
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script, "O template inclui o script interativo do componente.");
    require("node:vm").runInNewContext(script, {
        document: documento,
        window: { getComputedStyle: () => ({ zIndex: "auto" }) },
        CustomEvent: function (nome, opcoes) { this.type = nome; this.detail = opcoes?.detail; }
    });
    assert.equal(acoesUI.classList.contains("is-visivel"), false, "o espaço do botão fica reservado e o botão oculto até preencher tudo");
    assert.equal(acoesUI.getAttribute("aria-hidden"), "true");
    respostasUI[0].value = "v";
    respostasUI[0].disparar("input");
    assert.equal(documento.activeElement, respostasUI[1], "V/F avança o foco ao completar uma resposta");
    assert.equal(acoesUI.classList.contains("is-visivel"), false);
    respostasUI[1].value = "F";
    respostasUI[2].value = "V";
    respostasUI.forEach(resposta => resposta.disparar("input"));
    assert.equal(acoesUI.classList.contains("is-visivel"), true);
    assert.equal(acoesUI.getAttribute("aria-hidden"), "false");
    botaoUI.disparar("click");
    assert.equal(modalUI.hidden, false);
    assert.equal(feedbackErradoUI.hidden, false, "uma resposta divergente mostra o feedback de erro");
    respostasUI[2].value = "f";
    respostasUI[2].disparar("input");
    assert.equal(modalUI.hidden, true, "a edição fecha o feedback para permitir nova tentativa");
    botaoUI.disparar("click");
    assert.equal(feedbackCertoUI.hidden, false, "respostas iguais, sem diferenciar caixa, mostram o feedback de acerto");
    assert.ok(respostasUI.every(resposta => resposta.disabled), "a atividade trava após o acerto");

    const raizProjeto = path.resolve(__dirname, "../../..");
    const serverSource = fs.readFileSync(path.join(raizProjeto, "server.js"), "utf8");
    const biblioteca = fs.readFileSync(path.join(raizProjeto, "views/biblioteca.ejs"), "utf8");
    const editor = fs.readFileSync(path.join(raizProjeto, "assets/js/editor-visual-structure.js"), "utf8");
    assert.match(serverSource, /slug: 'verdadeirofalso', nome: 'Verdadeiro ou Falso'/);
    assert.match(serverSource, /verdadeirofalso:\s*`<componente/);
    assert.match(serverSource, /verdadeirofalso:\s*\{\s*titulo: "VERDADEIRO OU FALSO"/);
    assert.match(biblioteca, /componente\.slug==='verdadeirofalso'/);
    assert.match(editor, /verdadeirofalso: \["alternativa", "correta", "feedcerto", "feederrado"\]/);
    assert.match(editor, /verdadeirofalso: "Adicionar frase"/);

    const previa = await renderizarPreviewComponente("verdadeirofalso", convertido.slice(convertido.indexOf("<componente")));
    assert.match(previa, /class="vf-componente"/);
    console.log("✓ Verdadeiro ou Falso: tabela convertida, campos comparados sem diferenciar maiúsculas, e preview renderizada.");
})().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
