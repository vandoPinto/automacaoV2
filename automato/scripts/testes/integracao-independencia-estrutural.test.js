const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao, normalizarMarcadores } = require("../ExtrairAudiosComponentes");

const TIPOS = ["sanfona", "abas", "mininavegacao", "flashcard", "botao", "hotword"];

function criarFilho(tipo, token) {
    const inicio = `CHILD_BEGIN_${token}`;
    const fim = `CHILD_END_${token}`;
    let html;

    switch (tipo) {
        case "sanfona":
            html = `<componente tipo="sanfona"><botao>PAINEL_${token}</botao><janela><p>${inicio}</p><p>CONTEUDO_${token}</p><p>${fim}</p></janela></componente>`;
            break;
        case "abas":
            html = `<componente tipo="abas"><aba>ABA_${token}</aba><janela><p>${inicio}</p><p>CONTEUDO_${token}</p><p>${fim}</p></janela></componente>`;
            break;
        case "mininavegacao":
            html = `<componente tipo="mininavegacao"><janela><p>${inicio}</p><p>CONTEUDO_${token}</p><p>${fim}</p></janela></componente>`;
            break;
        case "flashcard":
            html = `<componente tipo="flashcard"><p>&lt;frente&gt;</p><p>FRENTE_${token}</p><p>&lt;verso&gt;</p><p>${inicio}</p><p>CONTEUDO_${token}</p><p>${fim}</p></componente>`;
            break;
        case "botao":
            html = `<componente tipo="botao"><botao>BOTAO_${token}</botao><janela><p>${inicio}</p><p>CONTEUDO_${token}</p><p>${fim}</p></janela></componente>`;
            break;
        case "hotword":
            html = `<componente tipo="hotword"><p>TERMO_${token} aparece no texto.</p><hotword>TERMO_${token}</hotword><janela><p>${inicio}</p><p>CONTEUDO_${token}</p><p>${fim}</p></janela></componente>`;
            break;
        default:
            throw new Error(`Componente não previsto: ${tipo}`);
    }

    return { html, inicio, fim, conteudo: `CONTEUDO_${token}` };
}

function criarPaiComFilho(tipoPai, filho, token) {
    const antes = `PARENT_BEGIN_${token}`;
    const depois = `PARENT_END_${token}`;
    const conteudo = `<p>${antes}</p>${filho.html}<p>${depois}</p>`;
    let html;
    let regiao;

    switch (tipoPai) {
        case "sanfona":
            html = `<componente tipo="sanfona"><botao>PAINEL_${token}</botao><janela>${conteudo}</janela></componente>`;
            regiao = "sanfona-conteudo";
            break;
        case "abas":
            html = `<componente tipo="abas"><aba>ABA_${token}</aba><janela>${conteudo}</janela></componente>`;
            regiao = "abas-painel-conteudo";
            break;
        case "mininavegacao":
            html = `<componente tipo="mininavegacao"><janela>${conteudo}</janela></componente>`;
            regiao = "mini-nav-painel-conteudo";
            break;
        case "flashcard":
            html = `<componente tipo="flashcard"><p>&lt;frente&gt;</p><p>FRENTE_${token}</p><p>&lt;verso&gt;</p>${conteudo}</componente>`;
            regiao = "flip-box-back";
            break;
        case "botao":
            html = `<componente tipo="botao"><botao>BOTAO_${token}</botao><janela>${conteudo}</janela></componente>`;
            regiao = "botao-janela-texto";
            break;
        case "hotword":
            html = `<componente tipo="hotword"><p>O termo CHAVE_${token} está explicado aqui.</p><hotword>CHAVE_${token}</hotword><janela>${conteudo}</janela></componente>`;
            regiao = "hotword-explicacao";
            break;
        default:
            throw new Error(`Componente-pai não previsto: ${tipoPai}`);
    }

    return { html, antes, depois, regiao };
}

function idsHTML(html) {
    return [...String(html || "").matchAll(/\bdata-audio-id=["']([^"']+)["']/gi)].map(match => match[1]);
}

function idsJSON(roteiro) {
    return processarRegiao(normalizarMarcadores(roteiro)).audios.map(audio => audio.nomeSufixo);
}

function contar(html, texto) {
    return String(html || "").split(texto).length - 1;
}

async function validarParEstrutural(pai, filho, numero) {
    const token = `PAR_${numero}_${pai}_${filho}`;
    const componenteFilho = criarFilho(filho, token);
    const componentePai = criarPaiComFilho(pai, componenteFilho, token);
    const roteiro = `<p>FORA_ANTES_${token}</p>${componentePai.html}<p>FORA_DEPOIS_${token}</p>`;
    const html = await processarComponente("tela", roteiro, 1, `estrutural-par-${numero}`);
    const audioHTML = idsHTML(html);
    const audioJSON = idsJSON(roteiro);

    assert.deepStrictEqual(audioHTML, audioJSON,
        `${pai} > ${filho}: IDs do HTML e JSON divergiram.\nHTML: ${audioHTML}\nJSON: ${audioJSON}`);
    assert.strictEqual(new Set(audioHTML).size, audioHTML.length,
        `${pai} > ${filho}: há IDs duplicados.`);

    for (const marcador of [
        `FORA_ANTES_${token}`, componentePai.antes, componenteFilho.inicio,
        componenteFilho.conteudo, componenteFilho.fim, componentePai.depois,
        `FORA_DEPOIS_${token}`
    ]) {
        assert.strictEqual(contar(html, marcador), 1,
            `${pai} > ${filho}: conteúdo ${marcador} não foi preservado exatamente uma vez.`);
    }

    const inicioRegiao = html.indexOf(`class="${componentePai.regiao}"`);
    const inicioPai = html.indexOf(componentePai.antes);
    const inicioFilho = html.indexOf(componenteFilho.inicio);
    const fimFilho = html.indexOf(componenteFilho.fim);
    const fimPai = html.indexOf(componentePai.depois);
    assert(inicioRegiao >= 0 && inicioRegiao < inicioPai &&
        inicioPai < inicioFilho && inicioFilho < fimFilho && fimFilho < fimPai,
        `${pai} > ${filho}: o filho saiu da região de conteúdo do pai ou a ordem foi alterada.`);

    assert(!/__HTML_(?:COMPONENTE_FILHO|HOTWORD_LEGADA|BOTAO_LEGADO|FLASHCARD_COMPONENTE)_[\s\S]*?__/.test(html),
        `${pai} > ${filho}: um token interno não foi restaurado.`);
}

async function validarFilhoNasFacesFlashcard(tipoFilho, numero) {
    const token = `FACES_${numero}_${tipoFilho}`;
    const filhoFrente = criarFilho(tipoFilho, `${token}_FRENTE`);
    const filhoVerso = criarFilho(tipoFilho, `${token}_VERSO`);
    const roteiro = `<componente tipo="flashcard">
        <p>&lt;frente&gt;</p><p>FRENTE_DO_CARTAO_${token}</p>${filhoFrente.html}
        <p>&lt;verso&gt;</p><p>VERSO_DO_CARTAO_${token}</p>${filhoVerso.html}
    </componente>`;
    const html = await processarComponente("tela", roteiro, 1, `estrutural-faces-${numero}`);
    const audioHTML = idsHTML(html);
    const audioJSON = idsJSON(roteiro);

    assert.deepStrictEqual(audioHTML, audioJSON,
        `FLASHCARD (frente/verso) > ${tipoFilho}: IDs divergiram.\nHTML: ${audioHTML}\nJSON: ${audioJSON}`);
    assert.strictEqual(new Set(audioHTML).size, audioHTML.length,
        `FLASHCARD > ${tipoFilho}: há IDs duplicados entre as faces.`);

    for (const marcador of [
        `FRENTE_DO_CARTAO_${token}`, `VERSO_DO_CARTAO_${token}`,
        filhoFrente.inicio, filhoFrente.conteudo, filhoFrente.fim,
        filhoVerso.inicio, filhoVerso.conteudo, filhoVerso.fim
    ]) {
        assert.strictEqual(contar(html, marcador), 1,
            `FLASHCARD > ${tipoFilho}: conteúdo ${marcador} foi perdido ou duplicado.`);
    }

    const idsFilho = audioHTML.filter(id => id !== `flashcard_a_verso`);
    assert(idsFilho.every(id => id.startsWith("flashcard_a_")),
        `FLASHCARD > ${tipoFilho}: um filho não herdou o identificador do cartão.`);

    const posicaoInicioFrente = html.indexOf('class="flip-box-front');
    // Usa o ID do verso do cartão externo para não confundir o verso de um
    // FLASHCARD filho que esteja aninhado na frente do cartão-pai.
    const posicaoFimFrente = html.indexOf('data-audio-id="flashcard_a_verso"');
    assert(posicaoInicioFrente >= 0 && posicaoFimFrente > posicaoInicioFrente,
        "FLASHCARD: as duas faces não foram produzidas na ordem esperada.");
    assert(html.indexOf(filhoFrente.inicio) > posicaoInicioFrente &&
        html.indexOf(filhoFrente.fim) < posicaoFimFrente,
        `FLASHCARD > ${tipoFilho}: o filho da FRENTE não permaneceu na face frontal.`);
    assert(html.indexOf(filhoVerso.inicio) > posicaoFimFrente,
        `FLASHCARD > ${tipoFilho}: o filho do VERSO não permaneceu na face posterior.`);

    const dadosJSON = processarRegiao(normalizarMarcadores(roteiro)).audios;
    const audioDoCartao = dadosJSON.find(audio => audio.nomeSufixo === "flashcard_a_verso");
    assert(audioDoCartao && !audioDoCartao.texto.includes(`FRENTE_DO_CARTAO_${token}`),
        "O texto visual da FRENTE foi incluído indevidamente na narração própria do cartão.");
}

async function validarConteudoAnteriorAosMarcadores() {
    const textoFlashcard = "Clique no cartão para visualizar a resposta.";
    const roteiroFlashcard = `<componente tipo="flashcard"><p>${textoFlashcard}</p><p>&lt;frente&gt;</p><p>Frente correta.</p><p>&lt;verso&gt;</p><p>Verso correto.</p></componente>`;
    const htmlFlashcard = await processarComponente("tela", roteiroFlashcard, 1, "estrutural-conteudo-externo-flashcard");
    const posTextoFlashcard = htmlFlashcard.indexOf(textoFlashcard);
    const posContainerFlashcard = htmlFlashcard.indexOf('<div class="flashcard-componente">');

    assert(posTextoFlashcard >= 0 && posContainerFlashcard > posTextoFlashcard,
        "O conteúdo anterior ao primeiro <frente> deve permanecer no fluxo externo, antes do FLASHCARD.");
    assert(!htmlFlashcard.includes("flashcard-introducao") && !htmlFlashcard.includes("flashcard-instrucao"),
        "O FLASHCARD não pode criar seções de introdução ou instrução.");
    assert.deepStrictEqual(idsHTML(htmlFlashcard), idsJSON(roteiroFlashcard),
        "O conteúdo externo do FLASHCARD alterou a correspondência HTML/JSON.");

    const textoBotao = "Texto externo antes do primeiro botão.";
    const roteiroBotao = `<componente tipo="botao"><p>${textoBotao}</p><botao>Abrir</botao><janela>Conteúdo da janela.</janela></componente>`;
    const htmlBotao = await processarComponente("tela", roteiroBotao, 1, "estrutural-conteudo-externo-botao");
    const posTextoBotao = htmlBotao.indexOf(textoBotao);
    const posGrupoBotao = htmlBotao.indexOf('<div class="botao-grupo"');

    assert(posTextoBotao >= 0 && posGrupoBotao > posTextoBotao,
        "O conteúdo anterior ao primeiro <botao> deve permanecer fora do grupo de BOTÕES.");
    assert(!htmlBotao.includes("botao-introducao"),
        "BOTÕES não pode criar uma seção especial de introdução.");
    assert.deepStrictEqual(idsHTML(htmlBotao), idsJSON(roteiroBotao),
        "O conteúdo externo de BOTÕES alterou a correspondência HTML/JSON.");

    // Se um wrapper universal aparecer antes do primeiro marcador, ele é
    // preservado no fluxo externo e recebe ordinal de irmão no nível do pai.
    const filhoBotao = `<componente tipo="botao"><botao>Botão externo</botao><janela>Janela externa.</janela></componente>`;
    const roteiroBotaoComFilhoExterno = `<componente tipo="botao"><p>Antes do grupo.</p>${filhoBotao}<botao>Botão do grupo</botao><janela>Janela do grupo.</janela></componente>`;
    const htmlBotaoComFilhoExterno = await processarComponente("tela", roteiroBotaoComFilhoExterno, 1, "estrutural-botao-filho-externo");
    assert.deepStrictEqual(idsHTML(htmlBotaoComFilhoExterno), ["botoes2_a", "botoes_a"],
        "O BOTÃO irmão externo deve manter seu ID próprio antes do grupo do pai.");
    assert.deepStrictEqual(idsJSON(roteiroBotaoComFilhoExterno), ["botoes2_a", "botoes_a"],
        "A extração JSON deve numerar o BOTÃO externo e o grupo-pai na mesma ordem.");

    const filhoFlashcard = `<componente tipo="flashcard"><p>&lt;frente&gt;</p><p>Frente do cartão externo.</p><p>&lt;verso&gt;</p><p>Verso do cartão externo.</p></componente>`;
    const roteiroFlashcardComFilhoExterno = `<componente tipo="flashcard"><p>Conteúdo anterior ao primeiro cartão.</p>${filhoFlashcard}<p>&lt;frente&gt;</p><p>Frente do cartão principal.</p><p>&lt;verso&gt;</p><p>Verso do cartão principal.</p></componente>`;
    const htmlFlashcardComFilhoExterno = await processarComponente("tela", roteiroFlashcardComFilhoExterno, 1, "estrutural-flashcard-filho-externo");
    assert.deepStrictEqual(idsHTML(htmlFlashcardComFilhoExterno), ["flashcard2_a_verso", "flashcard_a_verso"],
        "O FLASHCARD irmão externo deve manter seu ID próprio antes do cartão-pai.");
    assert.deepStrictEqual(idsJSON(roteiroFlashcardComFilhoExterno), ["flashcard2_a_verso", "flashcard_a_verso"],
        "A extração JSON deve numerar o FLASHCARD externo e o cartão-pai na mesma ordem.");
}

async function executar() {
    let casos = 0;

    // Todos os componentes como filhos de todos os componentes, dentro da área
    // principal de conteúdo do pai: 6 x 6 = 36 combinações estruturais.
    for (const pai of TIPOS) {
        for (const filho of TIPOS) {
            await validarParEstrutural(pai, filho, casos + 1);
            casos++;
        }
    }

    // Todos os seis tipos de componente inseridos tanto na FRENTE quanto no VERSO
    // do FLASHCARD. O mesmo tipo aparece nas duas faces para validar os ordinais.
    for (const filho of TIPOS) {
        await validarFilhoNasFacesFlashcard(filho, casos + 1);
        casos++;
    }

    // O que vem antes do primeiro marcador fica no fluxo do pai; não vira
    // seção interna de FLASHCARD ou BOTÕES.
    await validarConteudoAnteriorAosMarcadores();
    casos += 4;

    console.log(`✓ ${casos} cenários estruturais passaram.`);
    console.log("✓ Os 36 pares preservaram conteúdo, ordem, região-pai e correspondência HTML/JSON.");
    console.log("✓ Os seis tipos funcionam na FRENTE e no VERSO do FLASHCARD, com IDs hierárquicos exclusivos.");
    console.log("✓ Conteúdos anteriores aos marcadores permanecem no fluxo externo, sem seções artificiais.");
    console.log("✓ Filhos nessa região são tratados como irmãos externos, com ordinais HTML/JSON correspondentes.");
    console.log("✓ FLASHCARD não cria introdução/instrução e BOTÕES contém somente grupo de botões/janelas.");
}

executar().catch(erro => {
    console.error("Falha no teste de independência estrutural:", erro);
    process.exitCode = 1;
});
