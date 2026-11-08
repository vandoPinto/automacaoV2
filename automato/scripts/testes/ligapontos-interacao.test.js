const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const componente = require("../Componentes/ligapontos/ligapontos");

const TEMPLATE = fs.readFileSync(
    path.join(__dirname, "../Componentes/ligapontos/ligapontos.html"),
    "utf8"
);
const SCRIPT = TEMPLATE.match(/<script>([\s\S]*?)<\/script>/i)[1];
const DADOS = componente.interpretarRoteiro(`
<opcao>HTML<resposta>Linguagem de marcação.
<opcao>CSS<resposta>Estilização de página.
<opcao>JavaScript<resposta>Linguagem de programação.
<opcao>Node.js<resposta>Ambiente de execução.
<feedcerto>Parabéns!<feedErrao>Tente novamente.
`);

class FakeElement {
    constructor(className = "", attributes = {}) {
        this.nodeType = 1;
        this.className = className;
        this.attributes = { ...attributes };
        this.children = [];
        this.parentElement = null;
        this.listeners = {};
        this.hidden = false;
        this.disabled = false;
        this.textContent = "";
        this._innerHTML = "";
        this.clientWidth = 700;
        this.scrollHeight = 340;
        this.offsetWidth = 700;
        this.offsetHeight = 400;
        this.classList = {
            contains: nome => this.className.split(/\s+/).includes(nome)
        };
    }

    setAttribute(nome, valor) { this.attributes[nome] = String(valor); }
    getAttribute(nome) { return Object.prototype.hasOwnProperty.call(this.attributes, nome) ? this.attributes[nome] : null; }
    addEventListener(nome, callback) {
        if (!this.listeners[nome]) this.listeners[nome] = [];
        this.listeners[nome].push(callback);
    }
    focus() { this.focused = true; }
    click() {
        if (this.disabled) return;
        (this.listeners.click || []).forEach(callback => callback({ target: this }));
    }
    appendChild(filho) {
        if (filho.parentElement) {
            const irmaos = filho.parentElement.children;
            const indice = irmaos.indexOf(filho);
            if (indice >= 0) irmaos.splice(indice, 1);
        }
        this.children.push(filho);
        filho.parentElement = this;
        return filho;
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(valor) {
        this._innerHTML = String(valor);
        if (!this._innerHTML) this.children = [];
    }
    getBoundingClientRect() {
        if (this.attributes["data-ligapontos-lado"] === "opcao") {
            const indice = Number(this.attributes["data-ligapontos-id"]) - 1;
            return { left: 318, top: 24 + indice * 74, width: 34, height: 34 };
        }
        if (this.attributes["data-ligapontos-lado"] === "resposta") {
            const lista = this.parentElement && this.parentElement.parentElement;
            const indice = lista ? lista.children.indexOf(this.parentElement) : 0;
            return { left: 348, top: 24 + indice * 74, width: 34, height: 34 };
        }
        return { left: 0, top: 0, width: 700, height: 340 };
    }
    getClientRects() {
        if (this.classList.contains("ligapontos")) {
            return this.parentElement && this.parentElement.visivel ? [{}] : [];
        }
        return [{}];
    }
    querySelector(seletor) { return this.mapSeletores[seletor] || null; }
    querySelectorAll(seletor) { return this.mapListas[seletor] || []; }
}

class FakeMutationObserver {
    static instancias = [];
    constructor(callback) {
        this.callback = callback;
        FakeMutationObserver.instancias.push(this);
    }
    observe() {}
    disconnect() {}
    disparar() { this.callback([]); }
}

class FakeCustomEvent {
    constructor(type, opcoes = {}) {
        this.type = type;
        this.detail = opcoes.detail || {};
    }
}

function criarAmbiente(id = "lp-runtime") {
    const body = new FakeElement("body");
    body.visivel = true;
    const painel = new FakeElement("painel");
    painel.visivel = true;
    painel.parentElement = body;

    const raiz = new FakeElement("ligapontos", { id });
    raiz.parentElement = painel;
    raiz.offsetWidth = 700;
    raiz.offsetHeight = 400;

    const area = new FakeElement("ligapontos-area");
    const svg = new FakeElement("ligapontos-svg");
    const listaOpcoes = new FakeElement("ligapontos-coluna ligapontos-lista-opcoes");
    const listaRespostas = new FakeElement("ligapontos-coluna ligapontos-lista-respostas");
    const botaoSubmeter = new FakeElement("ligapontos-submeter", { "data-ligapontos-submeter": "" });
    const feedback = new FakeElement("ligapontos-feedback", { "data-ligapontos-feedback": "" });
    const feedbackCerto = new FakeElement("ligapontos-feedback-certo", {
        "data-ligapontos-feedback-certo": "", "data-audio-id": "ligapontos_a"
    });
    const feedbackErrado = new FakeElement("ligapontos-feedback-errado", {
        "data-ligapontos-feedback-errado": "", "data-audio-id": "ligapontos_b"
    });
    const botaoFecharFeedback = new FakeElement("ligapontos-feedback-fechar", {
        "data-ligapontos-feedback-fechar": ""
    });
    const conteudoFeedback = new FakeElement("ligapontos-feedback-conteudo", {
        "data-ligapontos-feedback-conteudo": ""
    });
    const status = new FakeElement("ligapontos-status-acessivel", { "data-ligapontos-status": "" });

    feedback.hidden = true;
    feedbackCerto.hidden = true;
    feedbackErrado.hidden = true;

    const pontosOpcoes = [];
    const pontosRespostas = [];
    const conteudos = [];

    DADOS.pares.forEach(par => {
        const itemOpcao = new FakeElement("ligapontos-item ligapontos-item-opcao");
        const pontoOpcao = new FakeElement("ligapontos-ponto ligapontos-ponto-opcao", {
            "data-ligapontos-lado": "opcao", "data-ligapontos-id": par.id
        });
        listaOpcoes.appendChild(itemOpcao);
        itemOpcao.appendChild(pontoOpcao);
        pontosOpcoes.push(pontoOpcao);
        conteudos.push(new FakeElement("ligapontos-conteudo"));

        const itemResposta = new FakeElement("ligapontos-item ligapontos-item-resposta");
        const pontoResposta = new FakeElement("ligapontos-ponto ligapontos-ponto-resposta", {
            "data-ligapontos-lado": "resposta", "data-ligapontos-id": par.id
        });
        listaRespostas.appendChild(itemResposta);
        itemResposta.appendChild(pontoResposta);
        pontosRespostas.push(pontoResposta);
        conteudos.push(new FakeElement("ligapontos-conteudo"));
    });

    area.appendChild(svg);
    area.appendChild(listaOpcoes);
    area.appendChild(listaRespostas);

    raiz.mapSeletores = {
        "[data-ligapontos-area]": area,
        "[data-ligapontos-svg]": svg,
        ".ligapontos-lista-respostas": listaRespostas,
        "[data-ligapontos-submeter]": botaoSubmeter,
        "[data-ligapontos-feedback]": feedback,
        "[data-ligapontos-feedback-certo]": feedbackCerto,
        "[data-ligapontos-feedback-errado]": feedbackErrado,
        "[data-ligapontos-feedback-fechar]": botaoFecharFeedback,
        "[data-ligapontos-feedback-conteudo]": conteudoFeedback,
        "[data-ligapontos-status]": status
    };
    raiz.mapListas = {
        ".ligapontos-ponto": [...pontosOpcoes, ...pontosRespostas],
        ".ligapontos-conteudo": conteudos
    };

    const eventos = [];
    const documento = {
        body,
        activeElement: null,
        getElementById: procurado => procurado === id ? raiz : null,
        createElementNS: () => new FakeElement("svg-path"),
        dispatchEvent: evento => { eventos.push(evento); return true; },
        addEventListener() {}
    };
    const janela = {
        MutationObserver: FakeMutationObserver,
        getComputedStyle: elemento => ({
            display: elemento.hidden ? "none" : "block",
            visibility: elemento.visivel === false ? "hidden" : "visible",
            opacity: elemento.visivel === false ? "0" : "1"
        }),
        addEventListener() {}
    };
    const math = Object.create(Math);
    math.random = () => 0;

    const contexto = {
        document: documento,
        window: janela,
        CustomEvent: FakeCustomEvent,
        MutationObserver: FakeMutationObserver,
        Math: math,
        console
    };

    vm.runInNewContext(SCRIPT.replace(/{{ID_INSTANCIA}}/g, id), contexto, {
        filename: "ligapontos.template.js"
    });

    return {
        raiz, painel, listaRespostas, pontosOpcoes, pontosRespostas,
        botaoSubmeter, feedback, feedbackCerto, feedbackErrado,
        botaoFecharFeedback, conteudoFeedback, body, svg, eventos, contexto
    };
}

function ligar(ambiente, idOpcao, idResposta) {
    ambiente.pontosOpcoes[idOpcao - 1].click();
    ambiente.pontosRespostas[idResposta - 1].click();
}

const ambiente = criarAmbiente();
const ordemInicial = ambiente.listaRespostas.children.map(item =>
    item.children[0].getAttribute("data-ligapontos-id")
);
assert.deepStrictEqual(ordemInicial, ["2", "3", "4", "1"], "a ordem das respostas deve ser embaralhada na entrada");

// Uma resposta ocupada não pode apagar silenciosamente uma associação existente.
ambiente.pontosOpcoes[0].click();
ambiente.pontosRespostas[0].click();
ambiente.pontosOpcoes[1].click();
ambiente.pontosRespostas[0].click();
assert.strictEqual(ambiente.svg.children.length, 1, "a ligação anterior deve permanecer ao tentar reutilizar uma resposta ocupada");
assert.strictEqual(ambiente.pontosOpcoes[1].getAttribute("aria-pressed"), "true", "a opção continua selecionada para escolher outra resposta");
ambiente.pontosRespostas[1].click();
assert.strictEqual(ambiente.svg.children.length, 2);
ambiente.pontosRespostas[0].click();
assert.strictEqual(ambiente.svg.children.length, 1, "clicar em resposta conectada sem seleção remove somente essa ligação");
const observador = FakeMutationObserver.instancias[FakeMutationObserver.instancias.length - 1];
ambiente.painel.visivel = false;
observador.disparar();
ambiente.painel.visivel = true;
observador.disparar();

// Duas ligações erradas e duas corretas: só as erradas devem ser apagadas.
ligar(ambiente, 1, 2);
ligar(ambiente, 2, 1);
ligar(ambiente, 3, 3);
ligar(ambiente, 4, 4);
assert.strictEqual(ambiente.botaoSubmeter.disabled, false, "o submit habilita quando todos os pares estão conectados");
ambiente.botaoSubmeter.click();
assert.strictEqual(ambiente.feedback.hidden, false);
assert.strictEqual(ambiente.feedbackErrado.hidden, false);
assert.strictEqual(ambiente.feedbackCerto.hidden, true);
assert.strictEqual(ambiente.svg.children.length, 2, "as duas ligações corretas devem permanecer visíveis");
assert.strictEqual(ambiente.botaoSubmeter.disabled, true, "é necessário refazer as ligações removidas");
assert(ambiente.eventos.some(evento => evento.type === "playAudio" && evento.detail.comp === "ligapontos_b"));
assert.strictEqual(ambiente.feedback.parentElement, ambiente.body, "o feedback deve ser levado ao body como a janela do Botões");
ambiente.botaoFecharFeedback.click();
assert.strictEqual(ambiente.feedback.hidden, true, "o botão de fechar deve dispensar o modal de erro");

// Refaz somente os pares que foram removidos e submete novamente.
ligar(ambiente, 1, 1);
ligar(ambiente, 2, 2);
assert.strictEqual(ambiente.botaoSubmeter.disabled, false);
ambiente.botaoSubmeter.click();
assert.strictEqual(ambiente.feedbackCerto.hidden, false);
assert.strictEqual(ambiente.feedbackErrado.hidden, true);
assert.strictEqual(ambiente.botaoSubmeter.disabled, true);
assert(ambiente.eventos.some(evento => evento.type === "playAudio" && evento.detail.comp === "ligapontos_a"));
assert.strictEqual(ambiente.feedback.hidden, false, "o feedback correto também deve abrir a janela central");
ambiente.botaoFecharFeedback.click();
assert.strictEqual(ambiente.feedback.hidden, true);

// Ao sair e entrar no painel outra vez, a atividade é reiniciada e embaralhada.
ambiente.painel.visivel = false;
observador.disparar();
ambiente.painel.visivel = true;
observador.disparar();
assert.strictEqual(ambiente.botaoSubmeter.disabled, true);
assert.strictEqual(ambiente.feedback.hidden, true);
assert.strictEqual(ambiente.svg.children.length, 0);
assert(ambiente.pontosOpcoes.every(ponto => ponto.disabled === false));

console.log("✓ Interação real do script: seleção, embaralhamento, linhas SVG e submissão.");
console.log("✓ No erro, apenas as ligações incorretas são removidas e podem ser refeitas.");
console.log("✓ No acerto, o feedback e o áudio corretos são acionados e a atividade é concluída.");
console.log("✓ Ao reentrar no painel, as respostas são embaralhadas e o estado é reiniciado.");
