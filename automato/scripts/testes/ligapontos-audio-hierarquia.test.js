const assert = require("assert");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao, normalizarMarcadores } = require("../ExtrairAudiosComponentes");
const { GerarJsonAudios } = require("../GerarJsonAudios");

const LP = `<ligapontos>
<opcao>HTML<resposta>Linguagem de marcação.
<opcao>CSS<resposta>Estilização de página.
<feedcerto>Parabéns!<feedErrao>Tente novamente.
</ligapontos>`;

function idsDeFeedback(html) {
    return [...String(html).matchAll(/data-audio-id="([^"]+)"/g)].map(match => match[1]);
}

function idsDeAudio(roteiro) {
    return processarRegiao(normalizarMarcadores(roteiro)).audios.map(item => item.nomeSufixo);
}

(async () => {
    // Componente independente e em tela.
    const tela = await processarComponente("tela", LP, 1, 10);
    assert.deepStrictEqual(idsDeFeedback(tela), ["ligapontos_a", "ligapontos_b"]);
    assert.deepStrictEqual(idsDeAudio(LP), ["ligapontos_a", "ligapontos_b"]);

    // Dentro de ABAS, SANFONA e MININAVEGACAO.
    const casos = [
        {
            tipo: "abas",
            conteudo: `<aba>Conceitos</aba><janela>${LP}</janela>`,
            esperado: ["abas_a_ligapontos_a", "abas_a_ligapontos_b"]
        },
        {
            tipo: "sanfona",
            conteudo: `<botao>Conceitos</botao><janela>${LP}</janela>`,
            esperado: ["sanfona_a_ligapontos_a", "sanfona_a_ligapontos_b"]
        },
        {
            tipo: "mininavegacao",
            conteudo: `<janela>${LP}</janela>`,
            esperado: ["mininavegacao_a_ligapontos_a", "mininavegacao_a_ligapontos_b"]
        }
    ];

    for (const caso of casos) {
        const html = await processarComponente(caso.tipo, caso.conteudo, 1, caso.tipo);
        const ids = idsDeFeedback(html).filter(id => id.includes("ligapontos"));
        assert.deepStrictEqual(ids, caso.esperado, `${caso.tipo}: HTML deve herdar o caminho hierárquico correto`);
        const roteiroCompleto = `<${caso.tipo}>${caso.conteudo}</${caso.tipo}>`;
        const idsJson = idsDeAudio(roteiroCompleto).filter(id => id.includes("ligapontos"));
        assert.deepStrictEqual(ids, idsJson, `${caso.tipo}: HTML e extrator de áudio precisam concordar`);
    }

    // Instâncias irmãs no mesmo nível recebem ordinais estáveis, iguais no
    // HTML e no sonorizacao.json.
    const duasIrmãs = LP + LP;
    const htmlDuasIrmãs = await processarComponente("tela", duasIrmãs, 1, 17);
    const idsDuasIrmãs = idsDeFeedback(htmlDuasIrmãs);
    assert.deepStrictEqual(idsDuasIrmãs, [
        "ligapontos_a", "ligapontos_b", "ligapontos2_a", "ligapontos2_b"
    ]);
    assert.deepStrictEqual(idsDuasIrmãs, idsDeAudio(duasIrmãs));

    // Também funciona no sentido inverso: componentes legados e universais
    // podem receber o Liga Pontos sem conhecer sua estrutura interna.
    const dentroDoBotao = await processarComponente(
        "botao", `<botao>Detalhes</botao><janela>${LP}</janela>`, 1, 18
    );
    assert.deepStrictEqual(
        idsDeFeedback(dentroDoBotao).filter(id => id.includes("ligapontos")),
        ["botoes_a_ligapontos_a", "botoes_a_ligapontos_b"]
    );

    const dentroDoFlashcard = await processarComponente(
        "flashcard", `<frente>Conceitos</frente><verso>${LP}`, 1, 19
    );
    assert.deepStrictEqual(
        idsDeFeedback(dentroDoFlashcard).filter(id => id.includes("ligapontos")),
        ["flashcard_a_ligapontos_a", "flashcard_a_ligapontos_b"]
    );

    const roteiroHotword = `<hotword>HTML<janela>${LP}`;
    const dentroDaHotword = await processarComponente(
        "hotword", `<p>HTML é usado.</p>${roteiroHotword}`, 1, 19
    );
    const idsHotword = idsDeFeedback(dentroDaHotword).filter(id => id.includes("ligapontos"));
    assert.deepStrictEqual(idsHotword, ["hotword_a_ligapontos_a", "hotword_a_ligapontos_b"]);
    assert.deepStrictEqual(idsHotword, idsDeAudio(roteiroHotword).filter(id => id.includes("ligapontos")));

    const wrapperUniversal = await processarComponente(
        "tela", `<componente tipo="ligapontos">${LP.replace(/^<ligapontos>/i, "").replace(/<\/ligapontos>\s*$/i, "")}</componente>`, 1, 19
    );
    assert.deepStrictEqual(
        idsDeFeedback(wrapperUniversal),
        ["ligapontos_a", "ligapontos_b"]
    );

    // Um LIGAPONTOS dentro de outro mantém contextos diferentes por par.
    const aninhado = `<ligapontos>
        <opcao><ligapontos><opcao>Sub A<resposta>Resp A<opcao>Sub B<resposta>Resp B<feedcerto>Sub certo<feedErrao>Sub errado</ligapontos>
        <resposta>Descrição interna.
        <opcao>CSS<resposta>Estilização.
        <feedcerto>Certinho.<feedErrao>Errado.
    </ligapontos>`;
    const htmlAninhado = await processarComponente("tela", aninhado, 1, 20);
    const idsAninhados = idsDeFeedback(htmlAninhado);
    const idsAninhadosJson = idsDeAudio(aninhado);
    assert.deepStrictEqual(idsAninhados, idsAninhadosJson);
    assert(idsAninhados.includes("ligapontos_a_opcao_ligapontos_a"));
    assert(idsAninhados.includes("ligapontos_a_opcao_ligapontos_b"));

    // Um componente universal dentro de uma opção também recebe prefixo próprio.
    const comFilho = `<ligapontos>
        <opcao><componente tipo="hotword"><p>HTML é importante.</p><hotword>HTML</hotword><janela>Explicação de HTML.</janela></componente>
        <resposta>Linguagem de marcação.
        <opcao>CSS<resposta>Estilização.
        <feedcerto>Correto.<feedErrao>Incorreto.
    </ligapontos>`;
    const htmlComFilho = await processarComponente("tela", comFilho, 1, 21);
    assert(htmlComFilho.includes('data-audio-id="ligapontos_a_opcao_hotword_a"'));
    assert(idsDeAudio(comFilho).includes("ligapontos_a_opcao_hotword_a"));

    // O JSON físico contém apenas os dois áudios próprios do Liga Pontos;
    // opções e respostas não viram narração automática.
    const pastaTemporaria = await fs.mkdtemp(path.join(os.tmpdir(), "automato-ligapontos-"));
    try {
        const tabela = `<table><tr><td>1</td><td>${LP}</td></tr></table>`;
        const arquivo = await GerarJsonAudios([tabela], { sigla: "exe", numeroLicao: 1 }, pastaTemporaria);
        const documento = JSON.parse(await fs.readFile(arquivo, "utf8"));
        const audios = documento.audios.exe01;
        const nomes = audios.map(item => item.nome);
        assert(nomes.includes("exe01000ligapontos_a.mp3"));
        assert(nomes.includes("exe01000ligapontos_b.mp3"));
        assert(!audios.some(item => /HTML|Linguagem de marcação|CSS/.test(item.texto)));
    } finally {
        await fs.rm(pastaTemporaria, { recursive: true, force: true });
    }

    console.log("✓ IDs de feedback correspondem ao ExtrairAudios em tela, ABAS, SANFONA e MININAVEGACAO.");
    console.log("✓ Recursividade do LIGAPONTOS preserva áudio de componentes aninhados e internos.");
    console.log("✓ sonorizacao.json gera somente os dois áudios do feedback para a atividade.");
})().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
