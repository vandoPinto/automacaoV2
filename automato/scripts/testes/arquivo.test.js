const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { interpretarTabelasComponentes, interpretarTabelaArquivo } = require("../InterpretarTabelasComponentes");
const componenteArquivo = require("../Componentes/arquivo/arquivo");
const { resolverArquivoCurso } = require("../Utils");
const { processarComponente } = require("../ProcessarComponentesAninhados");

async function executar() {
    const nomePdf = "APOSTILA-EXCEL-AVANCÌ§ADO.pdf";
    const tabelaPdf = `<table><tr><td colspan="2">ARQUIVO</td></tr><tr><td>Abrir pdf</td><td>${nomePdf}</td></tr></table>`;

    const marcadores = interpretarTabelasComponentes(tabelaPdf);
    assert.match(marcadores, /<componente tipo="arquivo"><arquivoitem data-rotulo="Abrir pdf">APOSTILA-EXCEL-AVANCÌ§ADO\.pdf<\/arquivoitem><\/componente>/,
        "A tabela ARQUIVO deve produzir um marcador para cada botão e nome de arquivo.");

    const nomeUrl = resolverArquivoCurso(nomePdf);
    assert.equal(decodeURIComponent(nomeUrl), `arquivos/${nomePdf}`,
        "O nome do PDF com caracteres acentuados deve continuar íntegro após codificação da URL.");
    const arquivoDeTeste = path.resolve(__dirname, "../../public/exe", decodeURIComponent(nomeUrl));
    assert.ok(fs.existsSync(arquivoDeTeste), "O PDF indicado na Tela 12 existe na pasta arquivos do curso.");

    const htmlPdf = await componenteArquivo(marcadores.replace(/^<componente tipo="arquivo">|<\/componente>$/g, ""));
    assert.match(htmlPdf, /href="arquivos\/APOSTILA-EXCEL-AVANC%C3%8C%C2%A7ADO\.pdf"/i);
    assert.match(htmlPdf, /target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(htmlPdf, /<a\b[^>]*\sdownload(?:=|\s|>)/i,
        "PDFs devem abrir no navegador sem forçar download.");

    const docx = await componenteArquivo('<arquivoitem data-rotulo="Abrir documento">roteiro.docx</arquivoitem>');
    assert.match(docx, /href="arquivos\/roteiro\.docx"[^>]*download="roteiro\.docx"/i,
        "Formatos sem visualização nativa devem solicitar download.");
    assert.match(docx, /target="_blank" rel="noopener noreferrer"/);
    assert.equal(componenteArquivo.arquivoPodeVisualizar("apostila.pdf"), true);
    assert.equal(componenteArquivo.arquivoPodeVisualizar("foto.webp"), true);
    assert.equal(componenteArquivo.arquivoPodeVisualizar("roteiro.docx"), false);
    assert.equal(componenteArquivo.arquivoPodeVisualizar("pacote.zip"), false);

    const tabelaIncompleta = "<table><tr><td>ARQUIVO</td><td></td></tr><tr><td>Abrir</td><td></td></tr></table>";
    assert.throws(() => interpretarTabelaArquivo(tabelaIncompleta), /nome do arquivo enviado para a pasta arquivos/,
        "A tabela deve exigir o nome do arquivo para cada botão.");

    const telaGerada = await processarComponente("tela", marcadores, 1, 12);
    assert.match(telaGerada, /arquivo-componente-botao/,
        "O processador real de Tela deve renderizar o componente Arquivo.");
    assert.match(telaGerada, /APOSTILA-EXCEL-AVANC%C3%8C%C2%A7ADO\.pdf/i,
        "O processador deve preservar o caminho codificado do PDF no link da Tela.");

    console.log("✓ Tabela ARQUIVO vira botões, preserva o PDF de exemplo e gera links de nova aba.");
    console.log("✓ PDF abre para visualização; DOCX e formatos não visualizáveis forçam download.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
