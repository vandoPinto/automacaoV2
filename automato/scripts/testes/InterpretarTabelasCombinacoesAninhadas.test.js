const assert = require("node:assert/strict");
const { interpretarTabelasComponentes } = require("../InterpretarTabelasComponentes");
const { processarComponente } = require("../ProcessarComponentesAninhados");

const COMPONENTES = [
    "botoes", "hotword", "abas", "flashcard", "mininavegacao", "sanfona",
    "jogomemoria", "ligapontos", "opcoes", "verdadeirofalso", "relacionarcolunas", "forca"
];
const PARENTS = ["botoes", "hotword", "abas", "flashcard", "mininavegacao", "sanfona"];
const ROTULOS = {
    botoes: "BOTÕES", hotword: "HOTWORD", abas: "ABAS", flashcard: "FLASHCARD",
    mininavegacao: "MINI NAVEGAÇÃO", sanfona: "SANFONA",
    jogomemoria: "JOGO DA MEMÓRIA", ligapontos: "LIGA PONTOS", opcoes: "OPÇÕES",
    verdadeirofalso: "VERDADEIRO OU FALSO", relacionarcolunas: "RELACIONAR COLUNAS", forca: "FORCA"
};
const CLASSES = {
    botoes: "botao-grupo", hotword: "hotword-componente", abas: "abas-componente",
    flashcard: "flashcard-componente", mininavegacao: "mini-nav-componente",
    sanfona: "sanfona-componente", jogomemoria: "jogomemoria-componente",
    ligapontos: "class=\"ligapontos\"", opcoes: "opcoes-componente",
    verdadeirofalso: "vf-componente", relacionarcolunas: "rc-componente", forca: "forca-componente"
};

function table(header, rows, headerCols = 1) {
    const heading = `<tr><td colspan="${headerCols}"><strong>${header}</strong></td></tr>`;
    return `<table><tbody>${heading}${rows.map(row => `<tr>${row.map(cell => `<td>${cell || ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function tabelaFilha(tipo, id) {
    const texto = `Filho ${id}`;
    switch (tipo) {
        case "botoes": return table(ROTULOS[tipo], [["Abrir filho", `Conteúdo de botão ${id}.`]], 2);
        case "hotword": return table(ROTULOS[tipo], [["Encaixe", `Explicação ${id}.`]], 2);
        case "abas": return table(ROTULOS[tipo], [[`Aba ${id}`, `Conteúdo ${id}.`]], 2);
        case "flashcard": return table(ROTULOS[tipo], [[`Frente ${id}`, `Verso ${id}.`]], 2);
        case "mininavegacao": return table(ROTULOS[tipo], [[`Etapa ${id}.`], [`Etapa final ${id}.`]]);
        case "sanfona": return table(ROTULOS[tipo], [[`Painel ${id}`, `Conteúdo ${id}.`]], 2);
        case "jogomemoria": return table(ROTULOS[tipo], [[`Carta ${id}`, `Par ${id}`, `Par correto ${id}.`, ""]], 4);
        case "ligapontos": return table(ROTULOS[tipo], [[`Opção ${id}`, `Resposta ${id}`, `Acerto ${id}.`, `Erro ${id}.`]], 4);
        case "opcoes": return table(ROTULOS[tipo], [
            [`Alternativa certa ${id}`, "SIM"], [`Alternativa errada ${id}`, "NÃO"],
            [`Acerto ${id}.`], [`Erro ${id}.`]
        ], 2);
        case "verdadeirofalso": return table(ROTULOS[tipo], [
            ["V", `Frase ${id}.`], [`Acerto ${id}.`], [`Erro ${id}.`]
        ], 2);
        case "relacionarcolunas": return table(ROTULOS[tipo], [
            [`Item ${id} A`, `Correspondência ${id} A`], [`Item ${id} B`, `Correspondência ${id} B`],
            [`Item ${id} C`, `Correspondência ${id} C`], ["A, B, C"], [`Acerto ${id}.`], [`Erro ${id}.`]
        ], 2);
        case "forca": return table(ROTULOS[tipo], [[`SOL${id}`], [`Dica ${id}.`], [`Acerto ${id}.`], [`Erro ${id}.`]]);
        default: throw new Error(`Componente filho desconhecido: ${tipo}`);
    }
}

function tabelaPai(tipo, filho, id) {
    const tabelaFilhaHtml = tabelaFilha(filho, id);
    const conteudo = `Encaixe ${ROTULOS[filho]}: ${tabelaFilhaHtml}`;
    switch (tipo) {
        case "botoes": return table(ROTULOS[tipo], [[`Abrir ${ROTULOS[filho]}`, conteudo]], 2);
        case "hotword": return `<p>O termo fotossíntese é importante.</p>` + table(ROTULOS[tipo], [["fotossíntese", conteudo]], 2);
        case "abas": return table(ROTULOS[tipo], [[`Aba ${ROTULOS[filho]}`, conteudo]], 2);
        case "flashcard": return table(ROTULOS[tipo], [[`Frente ${ROTULOS[filho]}`, conteudo]], 2);
        case "mininavegacao": return table(ROTULOS[tipo], [[conteudo]]);
        case "sanfona": return table(ROTULOS[tipo], [[`Painel ${ROTULOS[filho]}`, conteudo]], 2);
        default: throw new Error(`Componente pai desconhecido: ${tipo}`);
    }
}

(async function executar() {
    let total = 0;
    for (const pai of PARENTS) {
        for (const filho of COMPONENTES) {
            const origem = tabelaPai(pai, filho, `${pai}-${filho}`);
            const convertida = interpretarTabelasComponentes(origem, { topico: "Matriz", tela: ++total });
            assert.doesNotMatch(convertida, /<table\b/i, `${pai} > ${filho}: não pode sobrar tabela de modelo`);
            assert.match(convertida, new RegExp(`<${pai === "botoes" ? "botoes" : pai}\\b|<componente tipo="${pai}"`, "i"), `${pai} > ${filho}: componente pai deve ser convertido`);

            const html = await processarComponente("tela", convertida, 900, total);
            assert(html.includes(CLASSES[pai]), `${pai} > ${filho}: componente pai não foi renderizado`);
            assert(html.includes(CLASSES[filho]), `${pai} > ${filho}: componente filho não foi renderizado`);
            assert.doesNotMatch(html, /<table\b/i, `${pai} > ${filho}: tabela modelo não pode chegar ao HTML final`);
        }
    }
    assert.equal(total, 72, "A matriz precisa cobrir os 6 pais com área de conteúdo e os 12 componentes filhos.");
    console.log(`✓ ${total} combinações de tabelas aninhadas convertidas e renderizadas (${PARENTS.length} × ${COMPONENTES.length}).`);
})().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
