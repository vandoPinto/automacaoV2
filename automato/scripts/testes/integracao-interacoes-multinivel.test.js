const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const diretorioComponentes = path.join(__dirname, "../Componentes");

function correspondeSeletor(elemento, seletor) {
    if (!seletor) return false;
    if (seletor === "*") return true;
    if (seletor.includes(",")) {
        return seletor.split(",").some(parte => correspondeSeletor(elemento, parte.trim()));
    }
    if (seletor.startsWith(".")) return elemento.classList.contains(seletor.slice(1));
    if (seletor.startsWith("#")) return elemento.id === seletor.slice(1);
    const atributo = seletor.match(/^\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/);
    if (atributo) {
        const valor = elemento.getAttribute(atributo[1]);
        return atributo[2] === undefined ? valor !== null : valor === atributo[2];
    }
    return elemento.tagName.toLowerCase() === seletor.toLowerCase();
}

function criarElemento(opcoes = {}) {
    const atributos = { ...(opcoes.atributos || {}) };
    const listeners = {};
    const classes = new Set(opcoes.classes || []);
    const estilo = {
        cssText: "",
        setProperty() {}
    };
    const elemento = {
        tagName: String(opcoes.tagName || "DIV").toUpperCase(),
        id: opcoes.id || atributos.id || "",
        hidden: opcoes.hidden ?? false,
        disabled: opcoes.disabled ?? false,
        checked: opcoes.checked ?? false,
        tabIndex: opcoes.tabIndex ?? 0,
        clientWidth: opcoes.clientWidth ?? 0,
        clientHeight: opcoes.clientHeight ?? 0,
        offsetHeight: opcoes.offsetHeight ?? 0,
        scrollHeight: opcoes.scrollHeight ?? 0,
        scrollTop: 0,
        scrollLeft: 0,
        style: estilo,
        dataset: opcoes.dataset || {},
        parentNode: null,
        ownerDocument: null,
        children: [],
        childNodes: [],
        _consultas: opcoes.consultas || {},
        _listeners: listeners,
        _texto: opcoes.textContent || "",
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
        get textContent() {
            return elemento._texto + elemento.children.map(filho => filho.textContent || "").join("");
        },
        set textContent(valor) {
            elemento._texto = String(valor ?? "");
            elemento.replaceChildren();
        },
        getAttribute(nome) {
            if (nome === "id") return elemento.id || atributos.id || null;
            if (nome === "class") return [...classes].join(" ") || null;
            return Object.prototype.hasOwnProperty.call(atributos, nome)
                ? String(atributos[nome]) : null;
        },
        setAttribute(nome, valor) {
            atributos[nome] = String(valor);
            if (nome === "id") elemento.id = String(valor);
            if (nome === "class") {
                classes.clear();
                String(valor).split(/\s+/).filter(Boolean).forEach(classe => classes.add(classe));
            }
        },
        addEventListener(nome, callback) {
            (listeners[nome] ||= []).push(callback);
        },
        dispatch(nome, dados = {}) {
            const evento = {
                type: nome,
                target: elemento,
                currentTarget: null,
                defaultPrevented: false,
                propagationStopped: false,
                preventDefault() { this.defaultPrevented = true; },
                stopPropagation() { this.propagationStopped = true; },
                ...dados
            };
            let atual = elemento;
            while (atual && !evento.propagationStopped) {
                evento.currentTarget = atual;
                (atual._listeners?.[nome] || []).forEach(callback => callback(evento));
                atual = atual.parentNode;
            }
            if (!evento.propagationStopped && elemento.ownerDocument) {
                elemento.ownerDocument.dispatchEvent(evento);
            }
            return evento;
        },
        get listeners() { return listeners; },
        focus() { elemento._focado = true; },
        closest(seletor) {
            let atual = elemento;
            while (atual) {
                if (correspondeSeletor(atual, seletor)) return atual;
                atual = atual.parentNode;
            }
            return null;
        },
        matches(seletor) {
            if (seletor === ":hover") return false;
            return correspondeSeletor(elemento, seletor);
        },
        querySelectorAll(seletor) {
            if (Object.prototype.hasOwnProperty.call(elemento._consultas, seletor)) {
                const valor = elemento._consultas[seletor];
                return typeof valor === "function" ? valor() : (valor || []);
            }
            const encontrados = [];
            const visitar = no => {
                (no.children || []).forEach(filho => {
                    if (correspondeSeletor(filho, seletor)) encontrados.push(filho);
                    visitar(filho);
                });
            };
            visitar(elemento);
            return encontrados;
        },
        querySelector(seletor) {
            if (Object.prototype.hasOwnProperty.call(elemento._consultas, seletor)) {
                const valor = elemento._consultas[seletor];
                return typeof valor === "function" ? valor() : (Array.isArray(valor) ? valor[0] || null : valor || null);
            }
            return elemento.querySelectorAll(seletor)[0] || null;
        },
        contains(outro) {
            let atual = outro;
            while (atual) {
                if (atual === elemento) return true;
                atual = atual.parentNode;
            }
            return false;
        },
        appendChild(filho) {
            if (filho.parentNode) {
                filho.parentNode.children = filho.parentNode.children.filter(item => item !== filho);
                filho.parentNode.childNodes = filho.parentNode.childNodes.filter(item => item !== filho);
            }
            filho.parentNode = elemento;
            filho.ownerDocument = elemento.ownerDocument;
            elemento.children.push(filho);
            elemento.childNodes.push(filho);
            const propagarDocumento = no => {
                no.ownerDocument = elemento.ownerDocument;
                no.children.forEach(propagarDocumento);
            };
            propagarDocumento(filho);
            return filho;
        },
        insertBefore(filho, referencia) {
            if (!referencia) return elemento.appendChild(filho);
            if (filho.parentNode) {
                filho.parentNode.children = filho.parentNode.children.filter(item => item !== filho);
                filho.parentNode.childNodes = filho.parentNode.childNodes.filter(item => item !== filho);
            }
            const indice = elemento.children.indexOf(referencia);
            filho.parentNode = elemento;
            filho.ownerDocument = elemento.ownerDocument;
            elemento.children.splice(indice < 0 ? elemento.children.length : indice, 0, filho);
            elemento.childNodes.splice(indice < 0 ? elemento.childNodes.length : indice, 0, filho);
            return filho;
        },
        replaceChildren(...novos) {
            elemento.children = [];
            elemento.childNodes = [];
            novos.forEach(filho => elemento.appendChild(filho));
        },
        remove() {
            if (elemento.parentNode) {
                elemento.parentNode.children = elemento.parentNode.children.filter(item => item !== elemento);
                elemento.parentNode.childNodes = elemento.parentNode.childNodes.filter(item => item !== elemento);
            }
            elemento.parentNode = null;
        },
        cloneNode() {
            return criarElemento({ tagName: elemento.tagName, classes: [...classes], textContent: elemento._texto });
        }
    };

    if (opcoes.parentNode) opcoes.parentNode.appendChild(elemento);
    return elemento;
}

function criarAmbiente() {
    const eventos = [];
    const ouvintesDocumento = {};
    const corpo = criarElemento({ tagName: "BODY" });
    const documento = {
        body: corpo,
        fonts: null,
        querySelectorAll(seletor) { return corpo.querySelectorAll(seletor); },
        getElementById(id) {
            if (corpo.id === id) return corpo;
            return corpo.querySelectorAll("*").find(item => item.id === id) || null;
        },
        createElement(tagName) { return criarElemento({ tagName }); },
        addEventListener(nome, callback) { (ouvintesDocumento[nome] ||= []).push(callback); },
        dispatchEvent(evento) {
            if (evento.type === "playAudio" || evento.type === "stopAudio") {
                eventos.push({ nome: evento.type, detalhe: evento.detail || {} });
            }
            (ouvintesDocumento[evento.type] || []).forEach(callback => callback(evento));
            return true;
        },
        elementFromPoint() { return null; }
    };
    corpo.ownerDocument = documento;

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
    return { contexto, document: documento, eventos, body: corpo };
}

function adicionar(pai, filho) {
    pai.appendChild(filho);
    return filho;
}

function scriptDoTemplate(componente, placeholder, valor) {
    const arquivo = path.join(diretorioComponentes, componente, `${componente}.html`);
    const template = fs.readFileSync(arquivo, "utf8");
    const scripts = [...template.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
    assert(scripts.length, `Template ${componente} precisa conter script de interação.`);
    return scripts.map(item => placeholder == null ? item[1] : item[1].replaceAll(placeholder, valor)).join("\n");
}

function executarScript(componente, placeholder, id, ambiente) {
    vm.runInNewContext(scriptDoTemplate(componente, placeholder, id), ambiente.contexto, { timeout: 1000 });
}

function tocar(eventos) {
    return eventos.filter(evento => evento.nome === "playAudio").map(evento => evento.detalhe.comp);
}

function montarMiniNav(id, idsAudio, ambiente, conteudoFilho) {
    const raiz = adicionar(ambiente.body, criarElemento({ id, classes: ["mini-nav-componente"] }));
    const corpo = adicionar(raiz, criarElemento({ classes: ["mini-nav-corpo"] }));
    const voltar = adicionar(corpo, criarElemento({ classes: ["mini-nav-seta", "mini-nav-voltar"], disabled: true }));
    const area = adicionar(corpo, criarElemento({ classes: ["mini-nav-paineis"] }));
    const avancar = adicionar(corpo, criarElemento({ classes: ["mini-nav-seta", "mini-nav-avancar"] }));
    const paineis = idsAudio.map((audioId, indice) => {
        const painel = adicionar(area, criarElemento({
            classes: ["mini-nav-painel"], hidden: indice !== 0,
            atributos: { "data-audio-id": audioId }
        }));
        const conteudo = adicionar(painel, criarElemento({ classes: ["mini-nav-painel-conteudo"] }));
        if (indice === 0 && conteudoFilho) adicionar(conteudo, conteudoFilho);
        return painel;
    });
    return { raiz, area, voltar, avancar, paineis };
}

function montarAbas(id, idsAudio, ambiente, conteudoFilho) {
    const raiz = adicionar(ambiente.body, criarElemento({ id, classes: ["abas-componente"] }));
    adicionar(raiz, criarElemento({ classes: ["abas-navegacao"] }));
    const area = adicionar(raiz, criarElemento({ classes: ["abas-paineis"] }));
    const botoes = [];
    const paineis = idsAudio.map((audioId, indice) => {
        const botao = adicionar(raiz, criarElemento({ classes: ["abas-botao"] }));
        botoes.push(botao);
        const painel = adicionar(area, criarElemento({
            classes: ["abas-painel"], hidden: indice !== 0,
            atributos: { "data-audio-id": audioId }
        }));
        const conteudo = adicionar(painel, criarElemento({ classes: ["abas-painel-conteudo"] }));
        if (indice === 0 && conteudoFilho) adicionar(conteudo, conteudoFilho);
        return painel;
    });
    raiz.clientWidth = 0;
    area.clientWidth = 0;
    return { raiz, area, botoes, paineis };
}

function montarSanfona(id, idsAudio, ambiente, conteudoFilho) {
    const raiz = adicionar(ambiente.body, criarElemento({ id, classes: ["sanfona-componente"], dataset: {} }));
    const botoes = [];
    const paineis = idsAudio.map((audioId, indice) => {
        const painelId = `${id}-painel-${indice + 1}`;
        const botao = adicionar(raiz, criarElemento({
            classes: ["sanfona-botao"],
            atributos: { "aria-controls": painelId, "aria-expanded": "false" }
        }));
        botoes.push(botao);
        const painel = adicionar(raiz, criarElemento({
            id: painelId, classes: ["sanfona-conteudo"], hidden: true,
            atributos: { "data-audio-id": audioId }
        }));
        if (indice === 0 && conteudoFilho) adicionar(painel, conteudoFilho);
        return painel;
    });
    return { raiz, botoes, paineis };
}

function montarFlashcard(idAudioVerso, ambiente, conteudoFilho) {
    const raiz = adicionar(ambiente.body, criarElemento({ classes: ["flashcard-componente"] }));
    const lista = adicionar(raiz, criarElemento({ classes: ["flashcard-lista"] }));
    const cartao = adicionar(lista, criarElemento({ classes: ["flip-box"], atributos: { "data-audio-inicializado": "false" } }));
    const controle = adicionar(cartao, criarElemento({ classes: ["flip-box-toque"], checked: false }));
    const frente = adicionar(cartao, criarElemento({ classes: ["flip-box-front"] }));
    const verso = adicionar(cartao, criarElemento({ classes: ["flip-box-back"], atributos: { "data-audio-id": idAudioVerso } }));
    if (conteudoFilho) adicionar(verso, conteudoFilho);
    return { raiz, cartao, controle, frente, verso };
}

function montarBotoes(instancia, idAudio, ambiente, conteudoFilho) {
    const item = adicionar(ambiente.body, criarElemento({
        classes: ["botao-item"],
        atributos: { "data-botao-instancia": instancia, "data-botao-alvo": `${instancia}-alvo`, "aria-expanded": "false" }
    }));
    const janela = adicionar(ambiente.body, criarElemento({
        classes: ["botao-janela"], hidden: true,
        atributos: { "data-botao-instancia": instancia, "data-botao-janela": `${instancia}-alvo`, "data-audio-id": idAudio, "aria-hidden": "true" }
    }));
    if (conteudoFilho) adicionar(janela, conteudoFilho);
    return { item, janela };
}

function montarHotword(id, idAudio, ambiente) {
    const raiz = adicionar(ambiente.body, criarElemento({ id, classes: ["hotword-componente"], dataset: {} }));
    const gatilho = adicionar(raiz, criarElemento({ classes: ["hotword-gatilho"], atributos: { "data-hotword-id": `${id}-painel`, "aria-expanded": "false" } }));
    const painel = adicionar(raiz, criarElemento({
        id: `${id}-painel`, classes: ["hotword-janela"], hidden: true,
        atributos: { "data-hotword-painel": `${id}-painel`, "data-audio-id": idAudio, "aria-hidden": "true" }
    }));
    return { raiz, gatilho, painel };
}

async function testarCadeiaSeisNiveis() {
    const ambiente = criarAmbiente();

    const hotword = montarHotword(
        "hotword-n6",
        "mininavegacao_a_abas_a_sanfona_a_flashcard_a_botoes_a_hotword_a",
        ambiente
    );
    const botoes = montarBotoes(
        "botoes-n5",
        "mininavegacao_a_abas_a_sanfona_a_flashcard_a_botoes_a",
        ambiente,
        hotword.raiz
    );
    const flashcard = montarFlashcard(
        "mininavegacao_a_abas_a_sanfona_a_flashcard_a_verso",
        ambiente,
        botoes.item
    );
    // Antes da inicialização, a janela fica no verso. O script real dos BOTÕES
    // deve portá-la para o body sem perder a árvore lógica de seus descendentes.
    adicionar(flashcard.verso, botoes.janela);
    const sanfona = montarSanfona(
        "sanfona-n3",
        ["mininavegacao_a_abas_a_sanfona_a", "mininavegacao_a_abas_a_sanfona_b"],
        ambiente,
        flashcard.raiz
    );
    const abas = montarAbas(
        "abas-n2",
        ["mininavegacao_a_abas_a", "mininavegacao_a_abas_b"],
        ambiente,
        sanfona.raiz
    );
    const mini = montarMiniNav(
        "mini-n1",
        ["mininavegacao_a", "mininavegacao_b"],
        ambiente,
        abas.raiz
    );

    // A ordem de inicialização segue a árvore: primeiro pai, depois filhos.
    executarScript("mininavegacao", "{{ID_COMPONENTE}}", "mini-n1", ambiente);
    executarScript("abas", "{{ID_COMPONENTE}}", "abas-n2", ambiente);
    executarScript("sanfona", "{{ID_COMPONENTE}}", "sanfona-n3", ambiente);
    executarScript("flashcard", null, null, ambiente);
    executarScript("botao", "{{ID_INSTANCIA}}", "botoes-n5", ambiente);
    assert.strictEqual(botoes.janela.parentNode, ambiente.body,
        "A janela dos BOTÕES deve ser portada sem perder seus descendentes.");
    executarScript("hotword", "{{ID_COMPONENTE}}", "hotword-n6", ambiente);
    assert.strictEqual(hotword.painel.parentNode, ambiente.body,
        "A janela da HOTWORD deve ser portada sem perder sua instância.");

    mini.avancar.dispatch("click");
    assert.strictEqual(mini.paineis[1].hidden, false, "MININAVEGACAO deve avançar para seu segundo painel.");
    assert.strictEqual(mini.paineis[0].hidden, true);
    mini.voltar.dispatch("click");
    assert.strictEqual(mini.paineis[0].hidden, false, "MININAVEGACAO deve retornar ao painel que contém a árvore.");

    abas.botoes[1].dispatch("click");
    assert.strictEqual(abas.paineis[1].hidden, false, "ABAS deve alternar para a segunda aba.");
    abas.botoes[0].dispatch("click");
    assert.strictEqual(abas.paineis[0].hidden, false, "ABAS deve retornar à aba que contém a SANFONA.");

    ambiente.eventos.length = 0;
    sanfona.botoes[0].dispatch("click");
    assert.strictEqual(sanfona.paineis[0].hidden, false, "SANFONA deve abrir o painel que contém o FLASHCARD.");
    flashcard.controle.checked = true;
    flashcard.controle.dispatch("change");
    assert.strictEqual(flashcard.controle.checked, true, "FLASHCARD deve permanecer virado para o verso.");
    botoes.item.dispatch("click");
    assert.strictEqual(botoes.janela.hidden, false, "BOTÕES deve abrir a janela interna.");
    hotword.gatilho.dispatch("click");
    assert.strictEqual(hotword.painel.hidden, false, "HOTWORD deve abrir a própria janela.");

    // Um componente profundo não pode fechar, ocultar ou desativar seus ancestrais.
    assert.strictEqual(mini.paineis[0].hidden, false, "HOTWORD não pode fechar o painel da MININAVEGACAO.");
    assert.strictEqual(abas.paineis[0].hidden, false, "HOTWORD não pode trocar a aba-pai.");
    assert.strictEqual(sanfona.paineis[0].hidden, false, "HOTWORD não pode fechar o painel da SANFONA.");
    assert.strictEqual(botoes.janela.hidden, false, "HOTWORD não pode fechar a janela dos BOTÕES.");
    assert.strictEqual(flashcard.controle.checked, true, "HOTWORD não pode desvirar o FLASHCARD.");

    const idsTocados = tocar(ambiente.eventos);
    assert.deepStrictEqual(idsTocados, [
        "mininavegacao_a_abas_a_sanfona_a",
        "mininavegacao_a_abas_a_sanfona_a_flashcard_a_verso",
        "mininavegacao_a_abas_a_sanfona_a_flashcard_a_botoes_a",
        "mininavegacao_a_abas_a_sanfona_a_flashcard_a_botoes_a_hotword_a"
    ], "A cadeia de seis níveis deve reproduzir o ID do componente acionado em cada etapa.");

    // Navegar no ancestral fecha o overlay HOTWORD por clique externo, mas não
    // deve destruir o estado da janela de BOTÕES, do cartão ou da SANFONA.
    mini.avancar.dispatch("click");
    assert.strictEqual(mini.paineis[1].hidden, false);
    assert.strictEqual(hotword.painel.hidden, true, "Clique externo deve fechar a HOTWORD aberta.");
    assert.strictEqual(botoes.janela.hidden, false, "Navegar na MININAVEGACAO não pode fechar a janela dos BOTÕES.");
    assert.strictEqual(flashcard.controle.checked, true, "Navegar no ancestral não pode desvirar o cartão.");
    assert.strictEqual(sanfona.paineis[0].hidden, false, "Navegar no ancestral não pode fechar a SANFONA.");
    mini.voltar.dispatch("click");
    assert.strictEqual(mini.paineis[0].hidden, false);

    hotword.gatilho.dispatch("click");
    assert.strictEqual(hotword.painel.hidden, false, "HOTWORD deve abrir novamente ao retornar à árvore.");
    hotword.gatilho.dispatch("click");
    assert.strictEqual(hotword.painel.hidden, true, "HOTWORD deve fechar no segundo clique.");
    assert.strictEqual(botoes.janela.hidden, false, "Fechar HOTWORD não pode fechar BOTÕES.");

    botoes.item.dispatch("click");
    assert.strictEqual(botoes.janela.hidden, true, "BOTÕES deve fechar sua janela.");
    assert.strictEqual(sanfona.paineis[0].hidden, false, "Fechar BOTÕES não pode fechar SANFONA.");

    flashcard.controle.checked = false;
    flashcard.controle.dispatch("change");
    assert.strictEqual(flashcard.controle.checked, false, "FLASHCARD deve retornar à frente.");
    assert.strictEqual(sanfona.paineis[0].hidden, false, "Virar o cartão não pode fechar SANFONA.");

    sanfona.botoes[0].dispatch("click");
    assert.strictEqual(sanfona.paineis[0].hidden, true, "SANFONA deve fechar seu próprio painel.");
    assert.strictEqual(abas.paineis[0].hidden, false, "Fechar SANFONA não pode trocar a aba-pai.");
    assert.strictEqual(mini.paineis[0].hidden, false, "Fechar SANFONA não pode trocar o painel da MININAVEGACAO.");
}

async function testarCadeiaQuatroNiveis() {
    const ambiente = criarAmbiente();
    const hotword = montarHotword("hotword-4", "sanfona_a_flashcard_a_botoes_a_hotword_a", ambiente);
    const botoes = montarBotoes("botoes-4", "sanfona_a_flashcard_a_botoes_a", ambiente, hotword.raiz);
    const flashcard = montarFlashcard("sanfona_a_flashcard_a_verso", ambiente, botoes.item);
    adicionar(flashcard.verso, botoes.janela);
    const sanfona = montarSanfona("sanfona-4", ["sanfona_a"], ambiente, flashcard.raiz);

    executarScript("sanfona", "{{ID_COMPONENTE}}", "sanfona-4", ambiente);
    executarScript("flashcard", null, null, ambiente);
    executarScript("botao", "{{ID_INSTANCIA}}", "botoes-4", ambiente);
    assert.strictEqual(botoes.janela.parentNode, ambiente.body);
    executarScript("hotword", "{{ID_COMPONENTE}}", "hotword-4", ambiente);
    assert.strictEqual(hotword.painel.parentNode, ambiente.body);

    sanfona.botoes[0].dispatch("click");
    flashcard.controle.checked = true;
    flashcard.controle.dispatch("change");
    botoes.item.dispatch("click");
    hotword.gatilho.dispatch("click");

    assert.strictEqual(sanfona.paineis[0].hidden, false);
    assert.strictEqual(flashcard.controle.checked, true);
    assert.strictEqual(botoes.janela.hidden, false);
    assert.strictEqual(hotword.painel.hidden, false);
    assert.deepStrictEqual(tocar(ambiente.eventos), [
        "sanfona_a",
        "sanfona_a_flashcard_a_verso",
        "sanfona_a_flashcard_a_botoes_a",
        "sanfona_a_flashcard_a_botoes_a_hotword_a"
    ]);

    // Fechar o componente mais profundo deve preservar os três níveis superiores.
    hotword.gatilho.dispatch("click");
    assert.strictEqual(hotword.painel.hidden, true);
    assert.strictEqual(botoes.janela.hidden, false);
    assert.strictEqual(sanfona.paineis[0].hidden, false);
    assert.strictEqual(flashcard.controle.checked, true);
}

async function executar() {
    await testarCadeiaSeisNiveis();
    console.log("✓ MININAVEGACAO > ABAS > SANFONA > FLASHCARD > BOTÕES > HOTWORD: seis níveis interagem sem interferência entre ancestrais.");

    await testarCadeiaQuatroNiveis();
    console.log("✓ SANFONA > FLASHCARD > BOTÕES > HOTWORD: quatro níveis preservam estados e IDs de áudio.");

    console.log("\nTodos os testes de interação em múltiplos níveis passaram.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
