const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const TEMPLATE = fs.readFileSync(
    path.join(__dirname, "../Componentes/jogomemoria/jogomemoria.html"),
    "utf8"
);
const SCRIPT = TEMPLATE.match(/<script>([\s\S]*?)<\/script>/i)[1];

class FakeClassList {
    constructor(elemento) { this.elemento = elemento; }
    _itens() { return new Set(String(this.elemento.className || "").split(/\s+/).filter(Boolean)); }
    contains(nome) { return this._itens().has(nome); }
    add(nome) { const s = this._itens(); s.add(nome); this.elemento.className = [...s].join(" "); }
    remove(nome) { const s = this._itens(); s.delete(nome); this.elemento.className = [...s].join(" "); }
    toggle(nome, forcar) {
        const existe = this.contains(nome);
        const adicionar = forcar === undefined ? !existe : Boolean(forcar);
        if (adicionar) this.add(nome); else this.remove(nome);
        return adicionar;
    }
}

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
        this.innerText = "";
        this.style = {};
        this.offsetWidth = 700;
        this.offsetHeight = 400;
        this.clientWidth = 700;
        this.clientHeight = 400;
        this.clientLeft = 0;
        this.clientTop = 0;
        this.rect = { left: 0, top: 40, width: 700, height: 400 };
        this.classList = new FakeClassList(this);
        this._selectors = {};
        this._listas = {};
    }
    setAttribute(nome, valor) { this.attributes[nome] = String(valor); }
    getAttribute(nome) { return Object.prototype.hasOwnProperty.call(this.attributes, nome) ? this.attributes[nome] : null; }
    addEventListener(nome, callback) { (this.listeners[nome] ||= []).push(callback); }
    focus() { this.focused = true; }
    click() {
        if (this.disabled) return;
        (this.listeners.click || []).forEach(callback => callback({ target: this, stopPropagation() {} }));
    }
    dispatch(nome, evento) {
        (this.listeners[nome] || []).forEach(callback => callback({ target: this, preventDefault() {}, ...evento }));
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
    querySelector(seletor) { return this._selectors[seletor] || null; }
    querySelectorAll(seletor) { return this._listas[seletor] || []; }
    closest(seletor) { return seletor === "[data-jogomemoria]" ? this._raiz : null; }
    getClientRects() { return [{}]; }
    getBoundingClientRect() { return { ...this.rect, right: this.rect.left + this.rect.width, bottom: this.rect.top + this.rect.height }; }
}

class FakeCustomEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail || {}; }
}

function criarJogo(id, quantidadePares = 2) {
    const raiz = new FakeElement("jogomemoria-componente", { "data-jogomemoria": "", id });
    const tabuleiro = new FakeElement("jogomemoria-tabuleiro");
    const status = new FakeElement("jogomemoria-status");
    const feedback = new FakeElement("jogomemoria-feedback", { "data-jogomemoria-feedback": "" });
    feedback.hidden = true;
    feedback.setAttribute("aria-hidden", "true");
    const painel = new FakeElement("jogomemoria-feedback-painel");
    const fechar = new FakeElement("jogomemoria-feedback-fechar");
    const mensagens = Array.from({ length: quantidadePares }, (_, indice) =>
        new FakeElement("jogomemoria-feedback-item", {
            "data-jogomemoria-feedback-item": String(indice + 1),
            "data-audio-id": `jogomemoria_${String.fromCharCode(97 + indice)}`
        })
    );
    mensagens.forEach(item => { item.hidden = true; });

    const cartas = [];
    for (let par = 1; par <= quantidadePares; par++) {
        cartas.push(
            new FakeElement("jogomemoria-carta", { "data-jogomemoria-par": String(par), "data-jogomemoria-lado": "1" }),
            new FakeElement("jogomemoria-carta", { "data-jogomemoria-par": String(par), "data-jogomemoria-lado": "2" })
        );
    }
    cartas.forEach((carta, indice) => {
        carta._raiz = raiz;
        const face = new FakeElement("jogomemoria-carta-conteudo");
        face.innerText = `Conteúdo ${indice + 1}`;
        carta._selectors[".jogomemoria-carta-conteudo"] = face;
        tabuleiro.appendChild(carta);
    });
    feedback._selectors["[data-jogomemoria-feedback-painel]"] = painel;
    painel._selectors["[data-jogomemoria-feedback-fechar]"] = fechar;

    raiz._selectors["[data-jogomemoria-tabuleiro]"] = tabuleiro;
    raiz._selectors["[data-jogomemoria-status]"] = status;
    raiz._selectors["[data-jogomemoria-feedback]"] = feedback;
    raiz._selectors["[data-jogomemoria-feedback-painel]"] = painel;
    raiz._selectors["[data-jogomemoria-feedback-fechar]"] = fechar;
    raiz._listas[".jogomemoria-carta"] = cartas;
    raiz._listas["[data-jogomemoria-feedback-item]"] = mensagens;
    raiz.offsetWidth = 700;
    raiz.offsetHeight = 400;
    return { raiz, tabuleiro, status, feedback, painel, fechar, mensagens, cartas };
}

const jogo = criarJogo("jogo-1");
// O print de referência tinha 14 cartas. O esperado é uma grade completa 7 × 2.
const jogoGrade = criarJogo("jogo-grade", 7);
const jogoMobile = criarJogo("jogo-mobile-grade", 7);
jogoMobile.raiz.clientWidth = 650;
jogoMobile.raiz.offsetWidth = 650;
jogoMobile.raiz.rect.width = 650;
jogoMobile.raiz.clientHeight = 900;
jogoMobile.raiz.offsetHeight = 900;
jogoMobile.raiz.rect.height = 900;
jogoGrade.raiz.clientWidth = 1500;
jogoGrade.raiz.offsetWidth = 1500;
jogoGrade.raiz.rect.width = 1500;
const body = new FakeElement("body");
const eventosAudio = [];
const timers = [];
const document = {
    body,
    activeElement: null,
    querySelectorAll(seletor) {
        if (seletor === "[data-jogomemoria]") return [jogo.raiz, jogoGrade.raiz, jogoMobile.raiz];
        if (seletor.indexOf("aria-modal") >= 0) return [jogo.feedback];
        return [];
    },
    addEventListener() {},
    dispatchEvent(evento) { eventosAudio.push(evento); return true; }
};
const eventosJanela = {};
const window = {
    innerWidth: 1500,
    innerHeight: 500,
    addEventListener(nome, callback) { (eventosJanela[nome] ||= []).push(callback); },
    getComputedStyle() { return { display: "block", visibility: "visible", opacity: "1", zIndex: "99999", overflowX: "visible", overflowY: "visible" }; },
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; }
};

vm.runInNewContext(SCRIPT, { document, window, CustomEvent: FakeCustomEvent, Array, Set, Number, Boolean, String });

// O componente move o feedback para fora da árvore do componente-pai.
assert.strictEqual(jogo.feedback.parentElement, body);
assert.strictEqual(jogo.cartas.length, 4);
assert.strictEqual(jogoGrade.cartas.length, 14);
assert(jogoGrade.tabuleiro.style.gridTemplateColumns.includes("repeat(7,"), "no desktop, 14 cartas devem formar 7 colunas e 2 linhas completas");
assert.strictEqual(jogoGrade.tabuleiro.style.gridAutoFlow, "row");
assert(jogoGrade.cartas.every(carta => !carta.style.gridColumnStart), "nenhuma carta deve receber deslocamento individual para completar uma linha parcial");
assert(jogo.tabuleiro.style.gridTemplateColumns.includes("repeat(4,"), "quatro cartas cabem em uma linha quando há largura disponível");
assert(jogo.tabuleiro.style.gridAutoRows.endsWith("px"), "a altura das linhas deve ser calculada dinamicamente");
assert.strictEqual(jogo.tabuleiro.style.justifyContent, "center");

// Ao entrar no mobile, recupera a distribuição flexível anterior para que
// o tabuleiro não force uma divisão exata que deixe as cartas muito pequenas.
window.innerWidth = 700;
window.innerHeight = 1300;
(eventosJanela.resize || []).forEach(callback => callback());
assert(jogoMobile.tabuleiro.style.gridTemplateColumns.includes("repeat(3,"), "no mobile, 14 cartas devem recuperar a distribuição flexível anterior, com mais linhas e cartas maiores");

// O resize recalcula colunas e dimensões para aproveitar uma área mais estreita.
window.innerHeight = 500;
jogo.raiz.clientWidth = 400;
jogo.raiz.offsetWidth = 400;
jogo.raiz.rect.width = 400;
window.innerWidth = 400;
(eventosJanela.resize || []).forEach(callback => callback());
assert(jogo.tabuleiro.style.gridTemplateColumns.includes("repeat(2,"), "em uma largura menor o tabuleiro deve reorganizar as cartas em duas colunas");

// Erro: as duas cartas ficam abertas por um instante e depois voltam para baixo;
// nenhum feedback ou áudio de acerto é disparado.
jogo.cartas[0].click();
const cartaDiferente = jogo.cartas.find(carta => carta.getAttribute("data-jogomemoria-par") === "2");
cartaDiferente.click();
assert(jogo.cartas[0].classList.contains("is-virada"));
assert(cartaDiferente.classList.contains("is-virada"));
assert.strictEqual(jogo.feedback.hidden, true);
assert.strictEqual(eventosAudio.filter(evento => evento.type === "playAudio").length, 0);
assert.strictEqual(timers[0].delay, 900);
timers[0].callback();
assert(!jogo.cartas[0].classList.contains("is-virada"));
assert(!cartaDiferente.classList.contains("is-virada"));

// Acerto: as duas cartas permanecem abertas e o feedback exclusivo daquele par aparece.
const par1 = jogo.cartas.filter(carta => carta.getAttribute("data-jogomemoria-par") === "1");
par1[0].click();
par1[1].click();
assert(par1.every(carta => carta.classList.contains("is-encontrada")));
assert(par1.every(carta => carta.disabled));
assert(par1.every(carta => carta.classList.contains("is-virada")));
assert.strictEqual(jogo.feedback.hidden, true, "feedback de acerto deve aguardar um segundo");
assert.strictEqual(timers[1].delay, 1000, "feedback deve aguardar exatamente 1 segundo após a segunda carta");
timers[1].callback();
assert.strictEqual(jogo.feedback.hidden, false);
assert.strictEqual(jogo.mensagens[0].hidden, false);
assert.strictEqual(jogo.mensagens[1].hidden, true);
assert(eventosAudio.some(evento => evento.type === "playAudio" && evento.detail.comp === "jogomemoria_a"));

jogo.fechar.click();
assert.strictEqual(jogo.feedback.hidden, true);
assert(par1.every(carta => carta.classList.contains("is-encontrada")), "fechar o feedback não pode virar as cartas acertadas");

// O segundo par mostra o segundo feedback, sem reabrir ou alterar o primeiro.
const par2 = jogo.cartas.filter(carta => carta.getAttribute("data-jogomemoria-par") === "2");
par2[0].dispatch("keydown", { key: "Enter" });
par2[1].click();
assert.strictEqual(jogo.feedback.hidden, true, "segundo feedback também deve aguardar um segundo");
assert.strictEqual(timers[2].delay, 1000);
timers[2].callback();
assert.strictEqual(jogo.mensagens[0].hidden, true);
assert.strictEqual(jogo.mensagens[1].hidden, false);
assert(eventosAudio.some(evento => evento.type === "playAudio" && evento.detail.comp === "jogomemoria_b"));

console.log("✓ Erro vira as duas cartas novamente e não apresenta feedback.");
console.log("✓ O tabuleiro ajusta colunas e tamanho das cartas quando a área disponível muda.");
console.log("✓ No desktop, 14 cartas são distribuídas igualmente em 7 colunas por 2 linhas.");
console.log("✓ No mobile, 14 cartas usam a distribuição flexível anterior para manter cartas maiores.");
console.log("✓ Acerto mantém o par aberto, aguarda 1 segundo, exibe o feedback correspondente e dispara seu áudio.");
console.log("✓ O feedback é colocado fora da árvore do componente e não altera pares já encontrados.");
