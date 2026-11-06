const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao } = require("../ExtrairAudiosComponentes");

async function executar() {
    const entrada = `<sanfona>
        <botao>Painel A</botao><janela><p>Texto narrado do painel A.</p></janela>
        <botao>Painel B</botao><janela><p>Texto narrado do painel B.</p></janela>
    </sanfona>`;
    const html = await processarComponente("tela", entrada, 1, 901);
    const idsJson = processarRegiao(entrada).audios.map(item => item.nomeSufixo);

    assert(html.includes('data-audio-id="sanfona_a"'));
    assert(html.includes('data-audio-id="sanfona_b"'));
    assert(idsJson.includes("sanfona_a"));
    assert(idsJson.includes("sanfona_b"));

    const duasSanfonas = `<sanfona><botao>Um</botao><janela><p>Texto um.</p></janela></sanfona>
        <sanfona><botao>Dois</botao><janela><p>Texto dois.</p></janela></sanfona>`;
    const htmlDuasSanfonas = await processarComponente("tela", duasSanfonas, 1, 903);
    const idsDuasSanfonas = processarRegiao(duasSanfonas).audios.map(item => item.nomeSufixo);
    assert(htmlDuasSanfonas.includes('data-audio-id="sanfona_a"'));
    assert(htmlDuasSanfonas.includes('data-audio-id="sanfona2_a"'));
    assert(idsDuasSanfonas.includes("sanfona_a"));
    assert(idsDuasSanfonas.includes("sanfona2_a"));

    const entradaAninhada = `<abas>
        <aba>Guia</aba><janela>
            <sanfona><botao>Interno</botao><janela><p>Texto interno.</p></janela></sanfona>
        </janela>
    </abas>`;
    const htmlAninhado = await processarComponente("tela", entradaAninhada, 1, 902);
    const idsAninhadosJson = processarRegiao(entradaAninhada).audios.map(item => item.nomeSufixo);
    assert(htmlAninhado.includes('data-audio-id="abas_a_sanfona_a"'));
    assert(idsAninhadosJson.includes("abas_a_sanfona_a"));

    const abasComSanfonas = `<abas>
        <aba>A</aba><janela>
            <sanfona><botao>A1</botao><janela><p>Texto A1.</p></janela></sanfona>
            <sanfona><botao>A2</botao><janela><p>Texto A2.</p></janela></sanfona>
        </janela>
        <aba>B</aba><janela>
            <sanfona><botao>B1</botao><janela><p>Texto B1.</p></janela></sanfona>
        </janela>
    </abas>`;
    const htmlAbasSanfonas = await processarComponente("tela", abasComSanfonas, 1, 904);
    const idsAbasSanfonas = processarRegiao(abasComSanfonas).audios.map(item => item.nomeSufixo);
    for (const id of ["abas_a_sanfona_a", "abas_a_sanfona2_a", "abas_b_sanfona_a"]) {
        assert(htmlAbasSanfonas.includes(`data-audio-id="${id}"`), `HTML deve conter ${id}`);
        assert(idsAbasSanfonas.includes(id), `JSON deve conter ${id}`);
    }

    const template = fs.readFileSync(
        path.join(__dirname, "../Componentes/sanfona/sanfona.html"), "utf8"
    );
    const script = template.match(/<script>([\s\S]*?)<\/script>/i)[1]
        .replace(/{{ID_COMPONENTE}}/g, "sanfona-audio-teste");
    const eventosDocumento = [];
    const botoes = [];
    const paineis = new Map();
    let raiz;

    for (let i = 1; i <= 2; i++) {
        const atributos = { "aria-controls": `painel-${i}`, "aria-expanded": "false" };
        const listeners = {};
        botoes.push({
            closest: () => raiz,
            getAttribute: nome => atributos[nome],
            setAttribute: (nome, valor) => { atributos[nome] = valor; },
            addEventListener: (nome, callback) => { listeners[nome] = callback; },
            clicar: () => listeners.click(),
            atributos
        });
        paineis.set(`painel-${i}`, {
            hidden: true,
            getAttribute: nome => nome === "data-audio-id" ? `sanfona_${i === 1 ? "a" : "b"}` : null,
            classList: { add() {}, remove() {} },
            offsetHeight: 0
        });
    }
    raiz = {
        dataset: {},
        querySelectorAll: seletor => seletor === ".sanfona-botao" ? botoes : []
    };
    const documento = {
        getElementById: id => id === "sanfona-audio-teste" ? raiz : paineis.get(id),
        dispatchEvent: evento => eventosDocumento.push(evento)
    };
    class CustomEventMock {
        constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
    }
    vm.runInNewContext(script, {
        document: documento,
        CustomEvent: CustomEventMock,
        window: { matchMedia: () => ({ matches: true }) },
        clearTimeout,
        setTimeout
    });

    botoes[0].clicar();
    assert.deepStrictEqual(eventosDocumento.slice(-2).map(e => e.type), ["stopAudio", "playAudio"]);
    assert.strictEqual(eventosDocumento.at(-1).detail.comp, "sanfona_a");

    botoes[1].clicar();
    assert.strictEqual(eventosDocumento.at(-1).detail.comp, "sanfona_b");

    botoes[1].clicar();
    assert.strictEqual(eventosDocumento.at(-1).type, "stopAudio");

    console.log("✓ SANFONA gera IDs de áudio compatíveis com sonorizacao.json.");
    console.log("✓ SANFONA mantém a hierarquia quando está dentro de ABAS e em painéis repetidos.");
    console.log("✓ Abrir painel interrompe o áudio anterior e reproduz o áudio correspondente.");
    console.log("✓ Fechar painel interrompe a reprodução em andamento.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
