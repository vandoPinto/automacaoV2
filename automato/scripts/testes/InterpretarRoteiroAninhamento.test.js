const assert = require("node:assert/strict");
const path = require("node:path");
const mammoth = require("mammoth");
const { parse } = require("node-html-parser");
const { interpretarTabelasComponentes } = require("../InterpretarTabelasComponentes");
const { processarComponente } = require("../ProcessarComponentesAninhados");

const arquivoRoteiro = path.resolve(__dirname, "../../../Roteiro_Teste_Aninhamento_Componentes.docx");
const COMPONENTES = [
    "botoes", "hotword", "abas", "flashcard", "mininavegacao", "sanfona",
    "jogomemoria", "ligapontos", "opcoes", "verdadeirofalso", "relacionarcolunas", "forca"
];
const PARENTS = ["botoes", "hotword", "abas", "flashcard", "mininavegacao", "sanfona"];
const CLASSES = {
    botoes: "botao-grupo", hotword: "hotword-componente", abas: "abas-componente",
    flashcard: "flashcard-componente", mininavegacao: "mini-nav-componente",
    sanfona: "sanfona-componente", jogomemoria: "jogomemoria-componente",
    ligapontos: "ligapontos", opcoes: "opcoes-componente", verdadeirofalso: "vf-componente",
    relacionarcolunas: "rc-componente", forca: "forca-componente"
};

function elementosDiretos(no) {
    return (no.childNodes || []).filter(filho => filho.nodeType === 1);
}
function linhasDiretas(tabela) {
    const filhos = elementosDiretos(tabela);
    const corpo = filhos.find(filho => filho.tagName === "TBODY");
    return (corpo ? elementosDiretos(corpo) : filhos).filter(filho => filho.tagName === "TR");
}
function celulasDiretas(linha) {
    return elementosDiretos(linha).filter(filho => filho.tagName === "TD" || filho.tagName === "TH");
}

(async function executar() {
    const convertidoDocx = await mammoth.convertToHtml({ path: arquivoRoteiro });
    const raiz = parse(convertidoDocx.value);
    const tabelaRoteiro = raiz.querySelectorAll("table").find(tabela => {
        const primeira = celulasDiretas(linhasDiretas(tabela)[0] || {})[0];
        return primeira?.textContent.trim() === "Tela";
    });
    assert.ok(tabelaRoteiro, "O DOCX deve manter a tabela principal de telas.");

    const linhas = linhasDiretas(tabelaRoteiro);
    assert.equal(linhas.length, 45, "O roteiro deve preservar as 20 telas e acrescentar 24 telas de matriz.");
    let casos = 0;
    let cursor = 21;
    for (const pai of PARENTS) {
        for (let grupo = 0; grupo < 4; grupo += 1) {
            const linha = linhas[cursor];
            const celulas = celulasDiretas(linha);
            assert.equal(celulas[0].textContent.trim(), String(cursor), `Tela ${cursor} deve manter a numeração.`);
            const htmlFonte = celulas[1].innerHTML;
            const convertida = interpretarTabelasComponentes(htmlFonte, { topico: "Matriz de aninhamento", tela: cursor });
            assert.doesNotMatch(convertida, /<table\b/i, `Tela ${cursor}: a interpretação deve eliminar as tabelas-modelo.`);
            const html = await processarComponente("tela", convertida, 900, cursor);
            assert(html.includes(CLASSES[pai]), `Tela ${cursor}: o componente-pai ${pai} precisa ser renderizado.`);
            const filhosDoGrupo = COMPONENTES.slice(grupo * 3, grupo * 3 + 3);
            for (const filho of filhosDoGrupo) {
                assert(html.includes(CLASSES[filho]), `Tela ${cursor}: o componente-filho ${filho} precisa ser renderizado.`);
            }
            assert.doesNotMatch(html, /<table\b/i, `Tela ${cursor}: nenhuma tabela-modelo deve sobrar no HTML final.`);
            casos += filhosDoGrupo.length;
            cursor += 1;
        }
    }
    assert.equal(cursor, 45);
    assert.equal(casos, 72, "O DOCX real deve passar pelas 72 combinações da matriz.");
    console.log(`✓ DOCX real do roteiro: ${casos} combinações extraídas do Word, interpretadas e renderizadas.`);
})().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
