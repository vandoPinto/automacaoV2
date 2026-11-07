const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao, normalizarMarcadores } = require("../ExtrairAudiosComponentes");

const TIPOS = ["botao", "hotword", "abas", "mininavegacao", "sanfona", "flashcard"];

function criarComponenteLegado(tipo, chave) {
    switch (tipo) {
        case "botao":
            return `<botoes><botao>Rótulo filho ${chave}<janela><p>CHILD_${chave}</p></botoes>`;
        case "hotword":
            return `<p>TERM_${chave} aparece neste texto.</p><hotword>TERM_${chave}<janela><p>CHILD_${chave}</p></hotword>`;
        case "abas":
            return `<abas><aba>Aba filha ${chave}<janela><p>CHILD_${chave}</p></abas>`;
        case "mininavegacao":
            return `<mininavegacao><janela><p>CHILD_${chave}</p></mininavegacao>`;
        case "sanfona":
            return `<sanfona><botao>Painel filho ${chave}<janela><p>CHILD_${chave}</p></sanfona>`;
        case "flashcard":
            return `<flashcard><p>&lt;frente&gt;</p><p>Frente filha ${chave}</p><p>&lt;verso&gt;</p><p>CHILD_${chave}</p></flashcard>`;
        default:
            throw new Error(`Tipo legado não reconhecido: ${tipo}`);
    }
}

function criarComponenteUniversal(tipo, chave) {
    switch (tipo) {
        case "botao":
            return `<componente tipo="botao"><botao>Rótulo filho ${chave}<janela><p>CHILD_${chave}</p></componente>`;
        case "hotword":
            return `<componente tipo="hotword"><p>TERM_${chave} aparece neste texto.</p><hotword>TERM_${chave}<janela><p>CHILD_${chave}</p></componente>`;
        case "abas":
            return `<componente tipo="abas"><aba>Aba filha ${chave}<janela><p>CHILD_${chave}</p></componente>`;
        case "mininavegacao":
            return `<componente tipo="mininavegacao"><janela><p>CHILD_${chave}</p></componente>`;
        case "sanfona":
            return `<componente tipo="sanfona"><botao>Painel filho ${chave}<janela><p>CHILD_${chave}</p></componente>`;
        case "flashcard":
            return `<componente tipo="flashcard"><p>&lt;frente&gt;</p><p>Frente filha ${chave}</p><p>&lt;verso&gt;</p><p>CHILD_${chave}</p></componente>`;
        default:
            throw new Error(`Tipo universal não reconhecido: ${tipo}`);
    }
}

function envolverComponenteUniversalPai(tipo, filho, chave) {
    switch (tipo) {
        case "botao":
            return `<componente tipo="botao"><botao>Rótulo pai ${chave}<janela>${filho}</componente>`;
        case "hotword":
            return `<componente tipo="hotword"><p>TERM_PAI_${chave} aparece neste texto.</p><hotword>TERM_PAI_${chave}<janela>${filho}</componente>`;
        case "abas":
            return `<componente tipo="abas"><aba>Aba pai ${chave}<janela>${filho}</componente>`;
        case "mininavegacao":
            return `<componente tipo="mininavegacao"><janela>${filho}</componente>`;
        case "sanfona":
            return `<componente tipo="sanfona"><botao>Painel pai ${chave}<janela>${filho}</componente>`;
        case "flashcard":
            return `<componente tipo="flashcard"><p>&lt;frente&gt;</p><p>Frente pai ${chave}</p><p>&lt;verso&gt;</p>${filho}</componente>`;
        default:
            throw new Error(`Tipo universal pai não reconhecido: ${tipo}`);
    }
}

function envolverComponenteLegadoPai(tipo, filho, chave) {
    switch (tipo) {
        case "botao":
            return `<botoes><botao>Rótulo pai ${chave}<janela>${filho}</botoes>`;
        case "hotword":
            return `<p>TERM_PAI_${chave} aparece neste texto.</p><hotword>TERM_PAI_${chave}<janela>${filho}</hotword>`;
        case "abas":
            return `<abas><aba>Aba pai ${chave}<janela>${filho}</abas>`;
        case "mininavegacao":
            return `<mininavegacao><janela>${filho}</mininavegacao>`;
        case "sanfona":
            return `<sanfona><botao>Painel pai ${chave}<janela>${filho}</sanfona>`;
        case "flashcard":
            return `<flashcard><p>&lt;frente&gt;</p><p>Frente pai ${chave}</p><p>&lt;verso&gt;</p>${filho}</flashcard>`;
        default:
            throw new Error(`Tipo legado pai não reconhecido: ${tipo}`);
    }
}

function extrairIdsHTML(html) {
    return [...String(html).matchAll(/\bdata-audio-id=["']([^"']+)["']/gi)].map(match => match[1]);
}

function extrairIdsJSON(roteiro) {
    return processarRegiao(normalizarMarcadores(roteiro)).audios.map(audio => audio.nomeSufixo);
}

async function validarCenario(tipoPai, tipoFilho, direcao, roteiro, chave) {
    const html = await processarComponente("tela", roteiro, 1, `compatibilidade-${direcao}-${chave}`);
    const idsHTML = extrairIdsHTML(html);
    const idsJSON = extrairIdsJSON(roteiro);
    const marcadorConteudoFilho = `CHILD_${chave}`;

    assert.strictEqual(
        html.split(marcadorConteudoFilho).length - 1,
        1,
        `${direcao}: o conteúdo do filho ${tipoFilho} precisa aparecer exatamente uma vez em ${tipoPai}.`
    );
    assert(idsHTML.length > 0, `${direcao}: o cenário ${tipoPai} > ${tipoFilho} precisa gerar IDs no HTML.`);
    assert.deepStrictEqual(
        idsHTML,
        idsJSON,
        `${direcao}: os IDs do HTML e do sonorizacao.json divergem em ${tipoPai} > ${tipoFilho}.`
    );
    assert.strictEqual(
        new Set(idsHTML).size,
        idsHTML.length,
        `${direcao}: foram encontrados IDs duplicados em ${tipoPai} > ${tipoFilho}.`
    );
}

(async () => {
    let cenarios = 0;
    let legadoDentroDeWrapper = 0;
    let wrapperDentroDeLegado = 0;

    // Cruzamento completo entre tipos diferentes, nas duas direções:
    // wrapper pai com filho legado e pai legado com filho universal.
    for (const tipoPai of TIPOS) {
        for (const tipoFilho of TIPOS) {
            if (tipoPai === tipoFilho) continue;
            const chave = `${tipoPai}_${tipoFilho}`;

            const filhoLegado = criarComponenteLegado(tipoFilho, chave);
            await validarCenario(
                tipoPai,
                tipoFilho,
                "LEGADO_DENTRO_DE_WRAPPER",
                envolverComponenteUniversalPai(tipoPai, filhoLegado, chave),
                chave
            );
            cenarios += 1;
            legadoDentroDeWrapper += 1;

            const filhoUniversal = criarComponenteUniversal(tipoFilho, chave);
            await validarCenario(
                tipoPai,
                tipoFilho,
                "WRAPPER_DENTRO_DE_LEGADO",
                envolverComponenteLegadoPai(tipoPai, filhoUniversal, chave),
                chave
            );
            cenarios += 1;
            wrapperDentroDeLegado += 1;
        }
    }

    // Também validamos o mesmo tipo aninhado. A direção wrapper dentro de legado
    // é inequívoca para todos os tipos. Na direção inversa, HOTWORD usa o mesmo
    // marcador para gatilho e janela; por isso o filho deve ser universal.
    for (const tipo of TIPOS) {
        const chave = `mesmo_tipo_${tipo}`;
        const filhoUniversal = criarComponenteUniversal(tipo, chave);
        await validarCenario(
            tipo,
            tipo,
            "WRAPPER_DENTRO_DE_LEGADO",
            envolverComponenteLegadoPai(tipo, filhoUniversal, chave),
            chave
        );
        cenarios += 1;
        wrapperDentroDeLegado += 1;

        if (tipo !== "hotword") {
            const filhoLegado = criarComponenteLegado(tipo, chave);
            await validarCenario(
                tipo,
                tipo,
                "LEGADO_DENTRO_DE_WRAPPER",
                envolverComponenteUniversalPai(tipo, filhoLegado, chave),
                chave
            );
            cenarios += 1;
            legadoDentroDeWrapper += 1;
        }
    }

    console.log(`✓ ${cenarios} cenários de compatibilidade legado × wrapper aprovados.`);
    console.log(`✓ ${legadoDentroDeWrapper} cenários: componente legado dentro de wrapper universal.`);
    console.log(`✓ ${wrapperDentroDeLegado} cenários: wrapper universal dentro de componente legado.`);
    console.log("✓ HTML e sonorizacao.json apresentaram os mesmos IDs, na mesma ordem e sem duplicidade.");
    console.log("✓ Conteúdos filhos foram preservados exatamente uma vez.");
})().catch(erro => {
    console.error("Falha no teste de compatibilidade legado × wrappers:", erro);
    process.exitCode = 1;
});
