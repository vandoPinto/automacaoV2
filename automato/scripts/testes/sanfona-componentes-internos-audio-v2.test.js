const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const fsPromises = require("fs/promises");
const os = require("os");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao } = require("../ExtrairAudiosComponentes");
const { GerarJsonAudios } = require("../GerarJsonAudios");

// Fixture preservada integralmente do teste baseado no Modelo_Roteiro_AIM.docx.
// A estrutura real da SANFONA, os quatro painéis, os marcadores e os fechamentos
// explícitos não são simplificados para facilitar a validação.
const entrada = `<p>Componente sanfona</p>
<p>Este é um componente de sanfona:</p>
<sanfona>
<botao>Texto introdutório
<janela>
<p>Escreva uma breve explicação sobre o conteúdo que será apresentado nos botões.</p>
<p>hotword (opcional)</p>
<p>Utilize para destacar uma palavra ou expressão no texto introdutório e associá-la a uma janela com conteúdo complementar.</p>
<botoes>
<botao>Botão 1
<janela><p>Texto dentro da janela.</p>
</botoes>
<botao>Botões
<janela>
<p>Insira os botões na ordem em que deseja que apareçam na tela. Você pode adicionar a quantidade necessária.</p>
<hotword>Botões
<janela><p>Mantenha a sequência de botões e janelas. Cada botão precisa ter sua janela correspondente para que a interação funcione corretamente.</p>
</hotword>
<botao>Janelas
<janela>
<p>Insira as janelas após os botões, mantendo a mesma ordem. A primeira janela corresponderá ao primeiro botão, a segunda ao segundo e assim sucessivamente.</p>
<botao>Conteúdo das janelas
<janela>
<p>Dentro de cada janela, insira o texto ou os elementos que deseja apresentar ao aluno. Você também pode utilizar o componente HOTWORD dentro de uma janela.</p>
<flashcard>
<frente>Teste de texto de frente.
<verso>Digite aqui a resposta ou explicação que aparecerá no verso.
<frente>
<verso>Digite aqui a resposta ou explicação que aparecerá no verso.
<botoes>
<botao>Botão dentro flashcard
<janela>Janela do botão de dentro do flash card.
</botoes>
<botoes>
<botao>Botão dentro flashcard
<janela>Janela do botão de dentro do flash card.
</botoes>
<frente>
<verso>Digite aqui a resposta ou explicação que aparecerá no verso testando.
<hotword>testando
<janela>Janela do hotword de dentro do flash card.
</hotword>
<frente>
<verso>Digite aqui a resposta ou explicação que aparecerá no verso.
<botoes>
<botao>Botão dentro flashcard
<janela>Janela do botão de dentro do flash card.
</botoes>
<frente>
<verso>Digite aqui a resposta ou explicação que aparecerá no verso.
<botoes>
<botao>Botão dentro flashcard
<janela>Janela do botão de dentro do flash card.
</botoes>
</flashcard>
</sanfona>
<p>Texto complementar depois da sanfona.</p>`;

function extrairIdsHTML(html) {
    return [...String(html || "").matchAll(/\bdata-audio-id=["']([^"']+)["']/gi)]
        .map(match => match[1]);
}

async function executar() {
    const html = await processarComponente("tela", entrada, 10, 10);
    const idsHTML = extrairIdsHTML(html);
    const idsJSON = processarRegiao(entrada).audios.map(item => item.nomeSufixo);

    // Além de conferir a mesma função usada pelo gerador, gera o arquivo físico
    // sonorizacao.json em uma pasta temporária e compara os nomes dos MP3.
    const pastaTemporaria = await fsPromises.mkdtemp(
        path.join(os.tmpdir(), "automato-sanfona-audio-v2-")
    );
    let idsJSONGerado;
    try {
        const tabela = `<table><tr><td>10</td><td>${entrada}</td></tr></table>`;
        await GerarJsonAudios([tabela], {
            sigla: "aim",
            numeroLicao: 10
        }, pastaTemporaria);

        const caminhoJSON = path.join(pastaTemporaria, "som", "sonorizacao.json");
        const sonorizacao = JSON.parse(await fsPromises.readFile(caminhoJSON, "utf8"));
        idsJSONGerado = sonorizacao.audios.aim10
            .map(item => item.nome)
            .filter(nome => nome !== "aim10000.mp3")
            .map(nome => nome.replace(/^aim10000/, "").replace(/\.mp3$/i, ""));
    } finally {
        await fsPromises.rm(pastaTemporaria, { recursive: true, force: true });
    }

    assert.deepStrictEqual(
        idsHTML,
        idsJSON,
        [
            "A sequência completa de IDs de áudio no HTML deve corresponder exatamente",
            "à sequência extraída para o sonorizacao.json.",
            `HTML: ${JSON.stringify(idsHTML)}`,
            `JSON: ${JSON.stringify(idsJSON)}`
        ].join("\n")
    );

    assert.deepStrictEqual(
        idsHTML,
        idsJSONGerado,
        [
            "Os IDs presentes no HTML devem corresponder aos nomes reais gerados no",
            "arquivo sonorizacao.json.",
            `HTML: ${JSON.stringify(idsHTML)}`,
            `JSON: ${JSON.stringify(idsJSONGerado)}`
        ].join("\n")
    );
    assert.strictEqual(idsHTML.length, 16,
        "O roteiro de referência deve produzir os 16 identificadores de áudio esperados.");
    assert.strictEqual(new Set(idsHTML).size, idsHTML.length,
        "Não pode haver IDs de áudio duplicados no HTML.");
    assert.strictEqual(new Set(idsJSON).size, idsJSON.length,
        "Não pode haver IDs de áudio duplicados na extração JSON.");

    const idsObrigatorios = [
        "sanfona_a",
        "sanfona_a_botoes_a",
        "sanfona_b",
        "sanfona_b_hotword_a",
        "sanfona_c",
        "sanfona_d",
        "sanfona_d_flashcard_a_verso",
        "sanfona_d_flashcard_b_verso",
        "sanfona_d_flashcard_b_botoes_a",
        "sanfona_d_flashcard_b_botoes2_a",
        "sanfona_d_flashcard_c_verso",
        "sanfona_d_flashcard_c_hotword_a",
        "sanfona_d_flashcard_d_verso",
        "sanfona_d_flashcard_d_botoes_a",
        "sanfona_d_flashcard_e_verso",
        "sanfona_d_flashcard_e_botoes_a"
    ];
    for (const id of idsObrigatorios) {
        assert(idsHTML.includes(id), `HTML deve conter o ID hierárquico ${id}.`);
    }

    assert.strictEqual((html.match(/class="sanfona-item"/g) || []).length, 4,
        "A SANFONA deve gerar exatamente quatro painéis, na ordem original.");
    assert(html.includes("Componente sanfona"));
    assert(html.includes("Este é um componente de sanfona:"));
    assert(html.includes("Texto complementar depois da sanfona."),
        "O conteúdo posterior à SANFONA deve permanecer preservado.");
    assert(html.includes('data-audio-id="sanfona_b_hotword_a"'),
        "A HOTWORD do painel B deve carregar o ID hierárquico do painel.");

    const templateHotword = fs.readFileSync(
        path.join(__dirname, "../Componentes/hotword/hotword.html"),
        "utf8"
    );
    const scriptHotword = templateHotword.match(/<script>([\s\S]*?)<\/script>/i);
    assert(scriptHotword, "O template HOTWORD deve conter seu script de interação.");

    // Simula a interação do gatilho para confirmar que o áudio disparado é o
    // ID hierárquico do painel B, e não um ID calculado como se fosse externo.
    const eventosAudio = [];
    const listenersGatilho = {};
    const listenersDocumento = {};
    const atributosGatilho = {
        "data-hotword-id": "hotword-teste-1",
        "aria-expanded": "false"
    };
    const atributosPainel = {
        "data-hotword-painel": "hotword-teste-1",
        "data-audio-id": "sanfona_b_hotword_a",
        "aria-hidden": "true"
    };
    const botaoFechar = { addEventListener() {} };
    const painelHotword = {
        id: "hotword-teste-1",
        hidden: true,
        parentNode: {},
        closest() { return componenteHotword; },
        getAttribute(nome) { return atributosPainel[nome] || null; },
        setAttribute(nome, valor) { atributosPainel[nome] = valor; },
        addEventListener() {},
        querySelector() { return botaoFechar; },
        matches() { return false; },
        contains() { return false; }
    };
    const gatilhoHotword = {
        closest() { return componenteHotword; },
        getAttribute(nome) { return atributosGatilho[nome] || null; },
        setAttribute(nome, valor) { atributosGatilho[nome] = valor; },
        addEventListener(nome, callback) { listenersGatilho[nome] = callback; },
        contains() { return false; },
        matches() { return false; }
    };
    const componenteHotword = {
        dataset: {},
        querySelectorAll(seletor) {
            if (seletor === ".hotword-gatilho") return [gatilhoHotword];
            if (seletor === ".hotword-janela") return [painelHotword];
            return [];
        }
    };
    const documentoMock = {
        body: { appendChild(elemento) { elemento.parentNode = this; } },
        getElementById() { return componenteHotword; },
        addEventListener(nome, callback) { listenersDocumento[nome] = callback; },
        dispatchEvent(evento) { eventosAudio.push(evento); }
    };
    class CustomEventMock {
        constructor(type, options = {}) { this.type = type; this.detail = options.detail || {}; }
    }
    const scriptExecutavel = scriptHotword[1].replace(
        /{{ID_COMPONENTE}}/g,
        "hotword-componente-teste"
    );
    vm.runInNewContext(scriptExecutavel, {
        document: documentoMock,
        window: { matchMedia: () => ({ matches: false }) },
        CustomEvent: CustomEventMock,
        clearTimeout,
        setTimeout
    });

    assert.strictEqual(typeof listenersGatilho.click, "function");
    listenersGatilho.click({ preventDefault() {} });
    assert.deepStrictEqual(eventosAudio.map(evento => evento.type), ["stopAudio", "playAudio"]);
    assert.strictEqual(eventosAudio[1].detail.comp, "sanfona_b_hotword_a");
    assert.strictEqual(painelHotword.hidden, false);

    listenersGatilho.click({ preventDefault() {} });
    assert.strictEqual(eventosAudio.at(-1).type, "stopAudio");
    assert.strictEqual(painelHotword.hidden, true);

    console.log("✓ SANFONA preserva os quatro painéis e o conteúdo do roteiro AIM.");
    console.log("✓ HTML, extração e sonorizacao.json físico possuem os mesmos 16 IDs.");
    console.log("✓ HOTWORD do painel B reproduz sanfona_b_hotword_a.");
    console.log("✓ FLASHCARD e seus BOTÕES/HOTWORD preservam toda a hierarquia.");
    console.log("✓ IDs são exclusivos e o conteúdo posterior à SANFONA é preservado.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
