const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const diretorioComponentes = path.join(__dirname, "../Componentes");

function criarListaEventos() {
    const eventos = [];
    return {
        eventos,
        ouvir(nome, callback) {
            eventos.push({ nome, callback });
        },
        registrar(nome, detalhe = {}) {
            eventos.push({ nome, detalhe });
        },
        limpar() {
            eventos.length = 0;
        }
    };
}

function criarElemento(opcoes = {}) {
    const atributos = { ...(opcoes.atributos || {}) };
    const listeners = {};
    const classes = new Set(opcoes.classes || []);
    const elemento = {
        tagName: opcoes.tagName || "DIV",
        id: opcoes.id || atributos.id || "",
        hidden: opcoes.hidden ?? false,
        disabled: opcoes.disabled ?? false,
        checked: opcoes.checked ?? false,
        tabIndex: opcoes.tabIndex ?? 0,
        clientWidth: opcoes.clientWidth ?? 0,
        clientHeight: opcoes.clientHeight ?? 0,
        offsetHeight: opcoes.offsetHeight ?? 0,
        scrollTop: 0,
        scrollLeft: 0,
        style: {
            setProperty() {},
            cssText: ""
        },
        dataset: opcoes.dataset || {},
        parentNode: opcoes.parentNode || null,
        children: opcoes.children || [],
        childNodes: opcoes.childNodes || [],
        _consultas: opcoes.consultas || {},
        _proprietario: opcoes.proprietario || null,
        _focusou: false,
        classList: {
            contains(nome) { return classes.has(nome); },
            add(...nomes) { nomes.forEach(nome => classes.add(nome)); },
            remove(...nomes) { nomes.forEach(nome => classes.delete(nome)); },
            toggle(nome, forcar) {
                const novo = forcar === undefined ? !classes.has(nome) : !!forcar;
                if (novo) classes.add(nome); else classes.delete(nome);
                return novo;
            }
        },
        get classes() { return [...classes]; },
        getAttribute(nome) {
            if (nome === "id") return elemento.id || atributos[nome] || null;
            return Object.prototype.hasOwnProperty.call(atributos, nome) ? String(atributos[nome]) : null;
        },
        setAttribute(nome, valor) {
            atributos[nome] = String(valor);
            if (nome === "id") elemento.id = String(valor);
        },
        addEventListener(nome, callback) {
            (listeners[nome] ||= []).push(callback);
        },
        dispatch(nome, evento = {}) {
            const evt = {
                type: nome,
                target: elemento,
                preventDefault() { this.defaultPrevented = true; },
                stopPropagation() { this.propagationStopped = true; },
                ...evento
            };
            (listeners[nome] || []).forEach(callback => callback(evt));
            return evt;
        },
        get listeners() { return listeners; },
        focus() { elemento._focusou = true; },
        closest(seletor) {
            if (seletor === ".sanfona-componente" && opcoes.sanfonaProprietario) return opcoes.sanfonaProprietario;
            if (seletor === ".hotword-componente" && opcoes.hotwordProprietario) return opcoes.hotwordProprietario;
            if (seletor === ".abas-componente" && opcoes.abasProprietario) return opcoes.abasProprietario;
            if (seletor === ".mini-nav-componente" && opcoes.miniNavProprietario) return opcoes.miniNavProprietario;
            if (seletor === ".flashcard-componente" && opcoes.flashcardProprietario) return opcoes.flashcardProprietario;
            return opcoes.proprietario || null;
        },
        querySelector(seletor) {
            const valor = elemento._consultas[seletor];
            return typeof valor === "function" ? valor() : (valor || null);
        },
        querySelectorAll(seletor) {
            const valor = elemento._consultas[seletor];
            return typeof valor === "function" ? valor() : (valor || []);
        },
        contains(outro) {
            if (elemento === outro) return true;
            if (opcoes.contem && opcoes.contem.includes(outro)) return true;
            return false;
        },
        matches(seletor) {
            if (seletor === ":hover") return false;
            return (opcoes.matches || []).includes(seletor);
        },
        appendChild(filho) {
            filho.parentNode = elemento;
            elemento.children.push(filho);
            return filho;
        },
        remove() {
            if (elemento.parentNode && elemento.parentNode.children) {
                elemento.parentNode.children = elemento.parentNode.children.filter(item => item !== elemento);
            }
            elemento.parentNode = null;
        },
        replaceChildren(...novos) {
            elemento.children = novos;
            novos.forEach(filho => { filho.parentNode = elemento; });
        },
        cloneNode() { return criarElemento({ classes: [...classes], children: [], consultas: {} }); }
    };
    return elemento;
}

function criarAmbiente(documentoConfig = {}) {
    const eventosAudio = [];
    const ouvintesDocumento = {};
    const corpo = criarElemento({ tagName: "BODY" });
    const documento = {
        body: corpo,
        fonts: null,
        querySelectorAll(seletor) {
            const valor = documentoConfig.querySelectorAll?.(seletor);
            return valor || [];
        },
        getElementById(id) {
            return documentoConfig.getElementById?.(id) || null;
        },
        createElement(tagName) {
            return criarElemento({ tagName: String(tagName).toUpperCase() });
        },
        addEventListener(nome, callback) {
            (ouvintesDocumento[nome] ||= []).push(callback);
        },
        dispatchEvent(evento) {
            eventosAudio.push({ nome: evento.type, detalhe: evento.detail || {} });
            (ouvintesDocumento[evento.type] || []).forEach(callback => callback(evento));
            return true;
        },
        elementFromPoint() { return null; }
    };

    class CustomEventSimulado {
        constructor(type, options = {}) {
            this.type = type;
            this.detail = options.detail || {};
        }
    }

    const janela = {
        innerHeight: 800,
        matchMedia(query) {
            return { matches: query.includes("prefers-reduced-motion") };
        },
        addEventListener() {}
    };

    const contexto = {
        document: documento,
        window: janela,
        CustomEvent: CustomEventSimulado,
        Node: { TEXT_NODE: 3 },
        setTimeout: () => 1,
        clearTimeout() {},
        requestAnimationFrame(callback) { callback(); return 1; },
        cancelAnimationFrame() {},
        addEventListener() {},
        getComputedStyle() {
            return {
                paddingTop: "0px", paddingBottom: "0px",
                paddingLeft: "0px", paddingRight: "0px"
            };
        },
        console
    };
    return { contexto, document: documento, eventosAudio, body: corpo };
}

function scriptDoTemplate(componente, placeholder, valor) {
    const arquivo = path.join(diretorioComponentes, componente, `${componente}.html`);
    const template = fs.readFileSync(arquivo, "utf8");
    const scripts = [...template.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    assert(scripts.length, `Template ${componente} precisa conter script de interação.`);
    return scripts.map(item => placeholder == null
        ? item[1]
        : item[1].replaceAll(placeholder, valor)).join("\n");
}

function executarScript(script, ambiente) {
    vm.runInNewContext(script, ambiente.contexto, { timeout: 1000 });
}

function eventosDoTipo(eventos, tipo) {
    return eventos.filter(evento => evento.nome === tipo);
}

async function testarBotoes() {
    const instancia = "botao-instancia-pai";
    const alvo = "botao-alvo-a";
    const idAudio = "abas_a_sanfona_b_flashcard_a_botoes_a";
    const botao = criarElemento({
        classes: ["botao-item"],
        atributos: { "data-botao-alvo": alvo, "aria-expanded": "false" }
    });
    const janela = criarElemento({
        classes: ["botao-janela"],
        hidden: true,
        atributos: {
            "data-botao-janela": alvo,
            "data-audio-id": idAudio,
            "aria-hidden": "true"
        },
        parentNode: criarElemento({ tagName: "DIV" })
    });
    janela._consultas[".botao-fechar"] = null;
    const ambiente = criarAmbiente({
        querySelectorAll: seletor => seletor === `[data-botao-instancia="${instancia}"]`
            ? [botao, janela] : []
    });

    const script = scriptDoTemplate("botao", "{{ID_INSTANCIA}}", instancia);
    executarScript(script, ambiente);

    botao.dispatch("click");
    assert.strictEqual(janela.hidden, false, "BOTÃO deve abrir a própria janela.");
    assert.strictEqual(botao.getAttribute("aria-expanded"), "true");
    assert(eventosDoTipo(ambiente.eventosAudio, "playAudio").some(item => item.detalhe.comp === idAudio),
        "BOTÃO deve reproduzir o ID hierárquico da sua janela.");

    botao.dispatch("click");
    assert.strictEqual(janela.hidden, true, "Segundo clique deve fechar a janela.");
    assert.strictEqual(botao.getAttribute("aria-expanded"), "false");
    assert(eventosDoTipo(ambiente.eventosAudio, "stopAudio").length >= 2,
        "Fechar BOTÃO deve interromper o áudio.");
}

async function testarHotword() {
    const raiz = criarElemento({ id: "hotword-pai", dataset: {} });
    const id = "hotword-painel-a";
    const gatilho = criarElemento({
        atributos: { "data-hotword-id": id, "aria-expanded": "false" },
        hotwordProprietario: raiz
    });
    const painel = criarElemento({
        id,
        hidden: true,
        atributos: { "data-hotword-painel": id, "data-audio-id": "abas_a_hotword_a", "aria-hidden": "true" },
        hotwordProprietario: raiz,
        parentNode: raiz
    });
    raiz._consultas[".hotword-gatilho"] = [gatilho];
    raiz._consultas[".hotword-janela"] = [painel];
    const ambiente = criarAmbiente({
        getElementById: idRaiz => idRaiz === "hotword-pai" ? raiz : null
    });

    executarScript(scriptDoTemplate("hotword", "{{ID_COMPONENTE}}", "hotword-pai"), ambiente);
    gatilho.dispatch("click");
    assert.strictEqual(painel.hidden, false, "HOTWORD deve abrir sua janela no clique.");
    assert.strictEqual(gatilho.getAttribute("aria-expanded"), "true");
    assert(eventosDoTipo(ambiente.eventosAudio, "playAudio").some(item => item.detalhe.comp === "abas_a_hotword_a"));

    gatilho.dispatch("click");
    assert.strictEqual(painel.hidden, true, "Segundo clique deve fechar a HOTWORD.");
    assert.strictEqual(gatilho.getAttribute("aria-expanded"), "false");
    assert(eventosDoTipo(ambiente.eventosAudio, "stopAudio").length >= 1);
}

async function testarAbasAninhadas() {
    const raizPai = criarElemento({ id: "abas-pai", clientWidth: 0, clientHeight: 0 });
    const raizFilha = criarElemento({ id: "abas-filha", clientWidth: 0, clientHeight: 0 });
    const navPai = criarElemento();
    const areaPai = criarElemento({ clientWidth: 0 });
    const navFilha = criarElemento();
    const areaFilha = criarElemento({ clientWidth: 0 });
    const painelPaiA = criarElemento({
        hidden: true, atributos: { "data-audio-id": "abas-pai_painel_a" },
        abasProprietario: raizPai
    });
    const painelFilhaA = criarElemento({
        hidden: true, atributos: { "data-audio-id": "abas_pai_abas_filha_painel_a" },
        abasProprietario: raizFilha
    });
    const botaoPaiA = criarElemento({ classes: ["abas-botao"], abasProprietario: raizPai });
    const botaoFilhaA = criarElemento({ classes: ["abas-botao"], abasProprietario: raizFilha });
    botaoPaiA.setAttribute("data-audio-teste", "pai");
    botaoFilhaA.setAttribute("data-audio-teste", "filha");
    painelPaiA._consultas[".abas-painel-conteudo"] = null;
    painelFilhaA._consultas[".abas-painel-conteudo"] = null;
    raizPai._consultas[".abas-navegacao"] = navPai;
    raizPai._consultas[".abas-paineis"] = areaPai;
    raizPai._consultas[".abas-botao"] = [botaoPaiA, botaoFilhaA];
    raizPai._consultas[".abas-painel"] = [painelPaiA, painelFilhaA];
    raizPai._consultas["img"] = [];
    raizFilha._consultas[".abas-navegacao"] = navFilha;
    raizFilha._consultas[".abas-paineis"] = areaFilha;
    raizFilha._consultas[".abas-botao"] = [botaoFilhaA];
    raizFilha._consultas[".abas-painel"] = [painelFilhaA];
    raizFilha._consultas["img"] = [];

    const ambiente = criarAmbiente({
        getElementById: id => ({ "abas-pai": raizPai, "abas-filha": raizFilha })[id] || null
    });

    // Antes de iniciar, a instância externa só deve enxergar seus descendentes diretos.
    executarScript(scriptDoTemplate("abas", "{{ID_COMPONENTE}}", "abas-pai"), ambiente);
    assert.strictEqual(botaoFilhaA.listeners.click, undefined,
        "A ABAS pai não pode registrar eventos nos botões da ABAS filha.");

    executarScript(scriptDoTemplate("abas", "{{ID_COMPONENTE}}", "abas-filha"), ambiente);
    botaoFilhaA.dispatch("click");
    const toques = eventosDoTipo(ambiente.eventosAudio, "playAudio");
    assert.strictEqual(toques.length, 1, "A troca de aba interna deve tocar exatamente um áudio.");
    assert.strictEqual(toques[0].detalhe.comp, "abas_pai_abas_filha_painel_a");
    assert.strictEqual(painelFilhaA.hidden, false);
    assert.strictEqual(painelPaiA.hidden, false, "A interação interna não pode alterar o painel ativo da instância pai.");
}

async function testarMiniNavegacaoAninhada() {
    const raizPai = criarElemento({ id: "mini-pai", clientWidth: 0, clientHeight: 0 });
    const raizFilha = criarElemento({ id: "mini-filha", clientWidth: 0, clientHeight: 0 });
    const areaPai = criarElemento({ classes: ["mini-nav-paineis"], clientWidth: 0, miniNavProprietario: raizPai });
    const areaFilha = criarElemento({ classes: ["mini-nav-paineis"], clientWidth: 0, miniNavProprietario: raizFilha });
    const voltarPai = criarElemento({ classes: ["mini-nav-seta", "mini-nav-voltar"], disabled: true, miniNavProprietario: raizPai });
    const avancarPai = criarElemento({ classes: ["mini-nav-seta", "mini-nav-avancar"], miniNavProprietario: raizPai });
    const voltarFilha = criarElemento({ classes: ["mini-nav-seta", "mini-nav-voltar"], disabled: true, miniNavProprietario: raizFilha });
    const avancarFilha = criarElemento({ classes: ["mini-nav-seta", "mini-nav-avancar"], miniNavProprietario: raizFilha });
    const corpoPai = criarElemento({ classes: ["mini-nav-corpo"], children: [voltarPai, areaPai, avancarPai], miniNavProprietario: raizPai });
    const corpoFilha = criarElemento({ classes: ["mini-nav-corpo"], children: [voltarFilha, areaFilha, avancarFilha], miniNavProprietario: raizFilha });
    const painelPai = criarElemento({
        classes: ["mini-nav-painel"], hidden: true, atributos: { "data-audio-id": "mini-pai_janela_a" },
        miniNavProprietario: raizPai
    });
    const painelFilhaA = criarElemento({
        classes: ["mini-nav-painel"], hidden: false, atributos: { "data-audio-id": "mini_pai_mini_filha_janela_a" },
        miniNavProprietario: raizFilha
    });
    const painelFilhaB = criarElemento({
        classes: ["mini-nav-painel"], hidden: true, atributos: { "data-audio-id": "mini_pai_mini_filha_janela_b" },
        miniNavProprietario: raizFilha
    });
    painelPai._consultas[".mini-nav-painel-conteudo"] = null;
    painelFilhaA._consultas[".mini-nav-painel-conteudo"] = null;
    painelFilhaB._consultas[".mini-nav-painel-conteudo"] = null;
    raizPai._consultas[".mini-nav-corpo"] = [corpoPai];
    raizPai._consultas[".mini-nav-paineis"] = [areaPai];
    raizPai._consultas[".mini-nav-voltar"] = [voltarPai];
    raizPai._consultas[".mini-nav-avancar"] = [avancarPai];
    raizPai._consultas[".mini-nav-painel"] = [painelPai, painelFilhaA, painelFilhaB];
    raizPai._consultas["img"] = [];
    raizFilha._consultas[".mini-nav-corpo"] = [corpoFilha];
    raizFilha._consultas[".mini-nav-paineis"] = [areaFilha];
    raizFilha._consultas[".mini-nav-voltar"] = [voltarFilha];
    raizFilha._consultas[".mini-nav-avancar"] = [avancarFilha];
    raizFilha._consultas[".mini-nav-painel"] = [painelFilhaA, painelFilhaB];
    raizFilha._consultas["img"] = [];

    const ambiente = criarAmbiente({
        getElementById: id => ({ "mini-pai": raizPai, "mini-filha": raizFilha })[id] || null
    });
    executarScript(scriptDoTemplate("mininavegacao", "{{ID_COMPONENTE}}", "mini-pai"), ambiente);
    assert.strictEqual(painelFilhaA.hidden, false,
        "A inicialização da MININAVEGACAO pai não pode ocultar a janela ativa da filha.");
    assert.strictEqual(avancarPai.disabled, true,
        "O limite da navegação pai deve considerar somente as próprias janelas.");

    executarScript(scriptDoTemplate("mininavegacao", "{{ID_COMPONENTE}}", "mini-filha"), ambiente);
    avancarFilha.dispatch("click");
    assert.strictEqual(painelFilhaA.hidden, true);
    assert.strictEqual(painelFilhaB.hidden, false);
    assert.strictEqual(avancarFilha.disabled, true);
    const toques = eventosDoTipo(ambiente.eventosAudio, "playAudio");
    assert.strictEqual(toques.length, 1, "Avançar na MININAVEGACAO filha deve tocar um único áudio.");
    assert.strictEqual(toques[0].detalhe.comp, "mini_pai_mini_filha_janela_b");
}

async function testarSanfonaAninhada() {
    const raizPai = criarElemento({ id: "sanfona-pai", dataset: {} });
    const raizFilha = criarElemento({ id: "sanfona-filha", dataset: {} });
    const painelPai = criarElemento({
        hidden: true, atributos: { id: "painel-pai", "data-audio-id": "sanfona_a" },
        consultas: { ".sanfona-conteudo": null }
    });
    const painelFilha = criarElemento({
        hidden: true, atributos: { id: "painel-filha", "data-audio-id": "sanfona_a_sanfona_b" },
        consultas: { ".sanfona-conteudo": null }
    });
    const botaoPai = criarElemento({
        classes: ["sanfona-botao"],
        atributos: { "aria-controls": "painel-pai", "aria-expanded": "false" },
        sanfonaProprietario: raizPai
    });
    const botaoFilha = criarElemento({
        classes: ["sanfona-botao"],
        atributos: { "aria-controls": "painel-filha", "aria-expanded": "false" },
        sanfonaProprietario: raizFilha
    });
    raizPai._consultas[".sanfona-botao"] = [botaoPai, botaoFilha];
    raizFilha._consultas[".sanfona-botao"] = [botaoFilha];
    const ambiente = criarAmbiente({
        getElementById: id => ({
            "sanfona-pai": raizPai,
            "sanfona-filha": raizFilha,
            "painel-pai": painelPai,
            "painel-filha": painelFilha
        })[id] || null
    });

    executarScript(scriptDoTemplate("sanfona", "{{ID_COMPONENTE}}", "sanfona-pai"), ambiente);
    assert.strictEqual(botaoFilha.listeners.click, undefined,
        "A SANFONA pai não pode assumir os eventos da SANFONA filha.");
    executarScript(scriptDoTemplate("sanfona", "{{ID_COMPONENTE}}", "sanfona-filha"), ambiente);

    botaoFilha.dispatch("click");
    assert.strictEqual(painelFilha.hidden, false);
    assert.strictEqual(botaoFilha.getAttribute("aria-expanded"), "true");
    assert(eventosDoTipo(ambiente.eventosAudio, "playAudio").some(item =>
        item.detalhe.comp === "sanfona_a_sanfona_b"));
    assert.strictEqual(painelPai.hidden, true, "Abrir SANFONA filha não deve abrir painel da pai.");
}

async function testarFlashcardAninhado() {
    const raizPai = criarElemento();
    const raizFilha = criarElemento();
    const versoPai = criarElemento({ atributos: { "data-audio-id": "flashcard_a_verso" } });
    const versoFilha = criarElemento({ atributos: { "data-audio-id": "flashcard_a_flashcard_b_verso" } });
    const controlePai = criarElemento({ checked: false });
    const controleFilha = criarElemento({ checked: false });
    const cartaoPai = criarElemento({
        atributos: { "data-audio-inicializado": "false" },
        consultas: { ".flip-box-back": versoPai, ".flip-box-toque": controlePai },
        flashcardProprietario: raizPai
    });
    const cartaoFilha = criarElemento({
        atributos: { "data-audio-inicializado": "false" },
        consultas: { ".flip-box-back": versoFilha, ".flip-box-toque": controleFilha },
        flashcardProprietario: raizFilha
    });
    raizPai._consultas[".flip-box"] = [cartaoPai, cartaoFilha];
    raizFilha._consultas[".flip-box"] = [cartaoFilha];
    const ambiente = criarAmbiente({
        querySelectorAll: seletor => seletor === ".flashcard-componente" ? [raizPai, raizFilha] : []
    });

    executarScript(scriptDoTemplate("flashcard", null, null), ambiente);
    assert.strictEqual(cartaoPai.getAttribute("data-audio-inicializado"), "true");
    assert.strictEqual(cartaoFilha.getAttribute("data-audio-inicializado"), "true");
    controleFilha.checked = true;
    controleFilha.dispatch("change");
    const toques = eventosDoTipo(ambiente.eventosAudio, "playAudio");
    assert.strictEqual(toques.length, 1, "Virar o cartão filho deve tocar somente um áudio.");
    assert.strictEqual(toques[0].detalhe.comp, "flashcard_a_flashcard_b_verso");
    cartaoFilha.dispatch("mouseleave");
    assert(eventosDoTipo(ambiente.eventosAudio, "stopAudio").length >= 1);
}


async function testarBotoesDentroDeAbas() {
    const raizAbas = criarElemento({ id: "abas-com-botao", clientWidth: 0, clientHeight: 0 });
    const navegacao = criarElemento();
    const areaPaineis = criarElemento({ clientWidth: 0 });
    const painelA = criarElemento({
        hidden: true, atributos: { "data-audio-id": "abas_a_painel_a" },
        abasProprietario: raizAbas
    });
    const painelB = criarElemento({
        hidden: true, atributos: { "data-audio-id": "abas_a_painel_b" },
        abasProprietario: raizAbas
    });
    const abaA = criarElemento({ classes: ["abas-botao"], abasProprietario: raizAbas });
    const abaB = criarElemento({ classes: ["abas-botao"], abasProprietario: raizAbas });
    painelA._consultas[".abas-painel-conteudo"] = null;
    painelB._consultas[".abas-painel-conteudo"] = null;
    raizAbas._consultas[".abas-navegacao"] = navegacao;
    raizAbas._consultas[".abas-paineis"] = areaPaineis;
    raizAbas._consultas[".abas-botao"] = [abaA, abaB];
    raizAbas._consultas[".abas-painel"] = [painelA, painelB];
    raizAbas._consultas["img"] = [];

    const instanciaBotao = "botao-dentro-abas";
    const itemBotao = criarElemento({
        classes: ["botao-item"],
        atributos: { "data-botao-alvo": "detalhe", "aria-expanded": "false" }
    });
    const janelaBotao = criarElemento({
        classes: ["botao-janela"],
        hidden: true,
        atributos: {
            "data-botao-janela": "detalhe",
            "data-audio-id": "abas_a_painel_b_botoes_a",
            "aria-hidden": "true"
        },
        parentNode: painelB
    });

    const ambiente = criarAmbiente({
        getElementById: id => id === "abas-com-botao" ? raizAbas : null,
        querySelectorAll: seletor => seletor === `[data-botao-instancia="${instanciaBotao}"]`
            ? [itemBotao, janelaBotao] : []
    });

    executarScript(scriptDoTemplate("abas", "{{ID_COMPONENTE}}", "abas-com-botao"), ambiente);
    executarScript(scriptDoTemplate("botao", "{{ID_INSTANCIA}}", instanciaBotao), ambiente);

    abaB.dispatch("click");
    assert.strictEqual(painelB.hidden, false, "A segunda aba deve abrir antes do botão interno.");
    assert.strictEqual(eventosDoTipo(ambiente.eventosAudio, "playAudio").at(-1).detalhe.comp, "abas_a_painel_b");

    ambiente.eventosAudio.length = 0;
    itemBotao.dispatch("click");
    assert.strictEqual(janelaBotao.hidden, false, "BOTÃO dentro da ABAS deve abrir sua janela.");
    assert.strictEqual(painelB.hidden, false, "Abrir o BOTÃO não pode fechar a aba-pai.");
    assert.strictEqual(eventosDoTipo(ambiente.eventosAudio, "playAudio").length, 1);
    assert.strictEqual(eventosDoTipo(ambiente.eventosAudio, "playAudio")[0].detalhe.comp, "abas_a_painel_b_botoes_a");
}

async function testarHotwordDentroDeSanfona() {
    const raizSanfona = criarElemento({ id: "sanfona-com-hotword", dataset: {} });
    const painelSanfona = criarElemento({
        hidden: true,
        atributos: { id: "painel-sanfona-a", "data-audio-id": "sanfona_a" },
        consultas: { ".sanfona-conteudo": null }
    });
    const botaoSanfona = criarElemento({
        classes: ["sanfona-botao"],
        atributos: { "aria-controls": "painel-sanfona-a", "aria-expanded": "false" },
        sanfonaProprietario: raizSanfona
    });
    raizSanfona._consultas[".sanfona-botao"] = [botaoSanfona];

    const raizHotword = criarElemento({ id: "hotword-na-sanfona", dataset: {} });
    const idHotword = "hotword-painel-interno";
    const gatilhoHotword = criarElemento({
        atributos: { "data-hotword-id": idHotword, "aria-expanded": "false" },
        hotwordProprietario: raizHotword
    });
    const painelHotword = criarElemento({
        id: idHotword,
        hidden: true,
        atributos: {
            "data-hotword-painel": idHotword,
            "data-audio-id": "sanfona_a_hotword_a",
            "aria-hidden": "true"
        },
        hotwordProprietario: raizHotword,
        parentNode: painelSanfona
    });
    raizHotword._consultas[".hotword-gatilho"] = [gatilhoHotword];
    raizHotword._consultas[".hotword-janela"] = [painelHotword];

    const ambiente = criarAmbiente({
        getElementById: id => ({
            "sanfona-com-hotword": raizSanfona,
            "painel-sanfona-a": painelSanfona,
            "hotword-na-sanfona": raizHotword
        })[id] || null
    });

    executarScript(scriptDoTemplate("sanfona", "{{ID_COMPONENTE}}", "sanfona-com-hotword"), ambiente);
    executarScript(scriptDoTemplate("hotword", "{{ID_COMPONENTE}}", "hotword-na-sanfona"), ambiente);

    botaoSanfona.dispatch("click");
    assert.strictEqual(painelSanfona.hidden, false, "A SANFONA deve abrir o painel que contém a HOTWORD.");
    assert.strictEqual(ambiente.eventosAudio.filter(item => item.nome === "playAudio").at(-1).detalhe.comp, "sanfona_a");

    ambiente.eventosAudio.length = 0;
    gatilhoHotword.dispatch("click");
    assert.strictEqual(painelHotword.hidden, false, "A HOTWORD interna deve abrir sua janela.");
    assert.strictEqual(painelSanfona.hidden, false, "Abrir a HOTWORD não pode fechar o painel da SANFONA.");
    assert.strictEqual(eventosDoTipo(ambiente.eventosAudio, "playAudio").length, 1);
    assert.strictEqual(eventosDoTipo(ambiente.eventosAudio, "playAudio")[0].detalhe.comp, "sanfona_a_hotword_a");

    gatilhoHotword.dispatch("click");
    assert.strictEqual(painelHotword.hidden, true);
    assert.strictEqual(painelSanfona.hidden, false);
    assert(eventosDoTipo(ambiente.eventosAudio, "stopAudio").length >= 1);
}

async function executar() {
    await testarBotoes();
    console.log("✓ BOTÕES aninhado abre/fecha sua janela e reproduz/interrompe o áudio correto.");

    await testarHotword();
    console.log("✓ HOTWORD aninhada abre/fecha sua janela e reproduz/interrompe o áudio correto.");

    await testarAbasAninhadas();
    console.log("✓ ABAS filha mantém navegação e áudio isolados da ABAS pai.");

    await testarMiniNavegacaoAninhada();
    console.log("✓ MININAVEGACAO filha mantém painéis e limites isolados da instância pai.");

    await testarSanfonaAninhada();
    console.log("✓ SANFONA filha mantém abertura e áudio isolados da instância pai.");

    await testarFlashcardAninhado();
    console.log("✓ FLASHCARD filho mantém a interação de virar e o áudio do verso.");

    await testarBotoesDentroDeAbas();
    console.log("✓ BOTÕES dentro de ABAS mantém a aba-pai ativa e reproduz o áudio interno.");

    await testarHotwordDentroDeSanfona();
    console.log("✓ HOTWORD dentro de SANFONA mantém o painel-pai aberto e reproduz o áudio interno.");

    console.log("\nTodos os testes de interação aninhada passaram.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
