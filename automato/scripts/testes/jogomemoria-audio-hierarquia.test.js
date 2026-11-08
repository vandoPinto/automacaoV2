const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao, normalizarMarcadores } = require("../ExtrairAudiosComponentes");
const { GerarJsonAudios } = require("../GerarJsonAudios");

const CONTEUDO = `<frente>CAPA COMUM<carta1>Maçã<carta2>Fruta vermelha<feedback>Par da maçã encontrado.
<carta1>Banana<carta2>Fruta amarela<feedback>Par da banana encontrado.`;
const JM = `<jogomemoria>${CONTEUDO}</jogomemoria>`;

function idsNoHtml(html) {
    return [...String(html).matchAll(/data-audio-id="([^"]+)"/g)]
        .map(match => match[1]).filter(id => id.includes("jogomemoria"));
}
function idsNoJson(roteiro) {
    return processarRegiao(normalizarMarcadores(roteiro)).audios.map(item => item.nomeSufixo);
}
function idsDoJogo(ids) {
    return ids.filter(id => id.includes("jogomemoria"));
}

(async () => {
    const htmlDireto = await processarComponente("tela", JM, 1, 10);
    assert.deepStrictEqual(idsNoHtml(htmlDireto), ["jogomemoria_a", "jogomemoria_b"]);
    assert.deepStrictEqual(idsNoHtml(htmlDireto), idsNoJson(JM));


    const wrapperUniversal = `<componente tipo="jogomemoria">${CONTEUDO}</componente>`;
    const htmlWrapper = await processarComponente("tela", wrapperUniversal, 1, 11);
    assert.deepStrictEqual(idsNoHtml(htmlWrapper), ["jogomemoria_a", "jogomemoria_b"]);

    const dentroDoBotao = `<botoes><botao>Abrir jogo</botao><janela>${JM}</janela></botoes>`;
    const htmlBotao = await processarComponente("tela", dentroDoBotao, 1, 12);
    assert.deepStrictEqual(idsNoHtml(htmlBotao), [
        "botoes_a_jogomemoria_a", "botoes_a_jogomemoria_b"
    ]);
    assert.deepStrictEqual(idsNoHtml(htmlBotao), idsDoJogo(idsNoJson(dentroDoBotao)));

    const dentroDoFlashcard = `<flashcard><frente>Atividade</frente><verso>${JM}`;
    const htmlFlashcard = await processarComponente("tela", dentroDoFlashcard, 1, 13);
    assert.deepStrictEqual(idsNoHtml(htmlFlashcard), [
        "flashcard_a_jogomemoria_a", "flashcard_a_jogomemoria_b"
    ]);
    assert.deepStrictEqual(idsNoHtml(htmlFlashcard), idsDoJogo(idsNoJson(dentroDoFlashcard)));

    const lp = `<componente tipo="ligapontos"><opcao>HTML<resposta>Linguagem<opcao>CSS<resposta>Estilo<feedcerto>Certo<feederrado>Errado</componente>`;
    const comFilho = `<jogomemoria><frente>CAPA COMUM<carta1>${lp}<carta2>Fruta vermelha<feedback>Par da maçã encontrado.<carta1>Banana<carta2>Fruta amarela<feedback>Par da banana encontrado.</jogomemoria>`;
    const htmlFilho = await processarComponente("tela", comFilho, 1, 14);
    const idsFilhoHtml = idsNoHtml(htmlFilho);
    const idsFilhoJson = idsNoJson(comFilho);
    assert.deepStrictEqual(idsFilhoHtml, idsFilhoJson);
    assert(idsFilhoHtml.includes("jogomemoria_a_carta1_ligapontos_a"));
    assert(idsFilhoHtml.includes("jogomemoria_a_carta1_ligapontos_b"));
    assert(idsFilhoHtml.includes("jogomemoria_a"));
    assert(idsFilhoHtml.includes("jogomemoria_b"));

    const duasInstancias = JM + JM;
    const htmlDuas = await processarComponente("tela", duasInstancias, 1, 15);
    assert.deepStrictEqual(idsNoHtml(htmlDuas), [
        "jogomemoria_a", "jogomemoria_b", "jogomemoria2_a", "jogomemoria2_b"
    ]);
    assert.deepStrictEqual(idsNoHtml(htmlDuas), idsNoJson(duasInstancias));

    const pasta = await fs.mkdtemp(path.join(os.tmpdir(), "automato-jogomemoria-"));
    try {
        const tabela = `<table><tr><td>1</td><td>${JM}</td></tr></table>`;
        const arquivo = await GerarJsonAudios([tabela], { sigla: "exe", numeroLicao: 1 }, pasta);
        const documento = JSON.parse(await fs.readFile(arquivo, "utf8"));
        const nomes = documento.audios.exe01.map(item => item.nome);
        assert(nomes.includes("exe01000jogomemoria_a.mp3"));
        assert(nomes.includes("exe01000jogomemoria_b.mp3"));
        assert(!documento.audios.exe01.some(item => /Maçã|Fruta vermelha|Banana|Fruta amarela/.test(item.texto)));
    } finally {
        await fs.rm(pasta, { recursive: true, force: true });
    }

    console.log("✓ IDs dos feedbacks do Jogo da Memória coincidem com o ExtrairAudios.");
    console.log("✓ Hierarquia validada em Tela, Botões, Flashcard, wrapper universal e múltiplas instâncias.");
    console.log("✓ Componentes dentro das cartas preservam a recursividade e seus próprios IDs de áudio.");
    console.log("✓ sonorizacao.json contém um áudio por feedback e não narra o conteúdo das cartas.");
})().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
