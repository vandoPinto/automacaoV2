/**
 * Executa a pré-validação de todas as tabelas de componentes do DOCX.
 *
 * Não cria, remove ou modifica arquivos. Reutiliza analisarTopico(), que também
 * é usado pela geração, para validar exatamente as mesmas telas que serão
 * processadas posteriormente.
 */

const { validarTabelasComponentes } = require("./InterpretarTabelasComponentes");
const { criarErroValidacaoTabelas } = require("./ValidarTabelasComponentes");

/**
 * Valida uma lista de tópicos já separados em telas. Esta função pura também
 * permite testar a agregação dos erros sem depender do parser do DOCX.
 */
function validarTelasDocumento(topicos) {
    const erros = [];
    let telasAnalisadas = 0;
    const listaTopicos = Array.isArray(topicos) ? topicos : [];

    for (const topico of listaTopicos) {
        const nomeTopico = topico.nomeTopico || topico.nome || "Tópico não identificado";
        const telas = Array.isArray(topico.telas) ? topico.telas : [];

        for (const tela of telas) {
            const conteudo = Array.isArray(tela.partes)
                ? tela.partes.join("\\n").trim()
                : String(tela.conteudo || "").trim();
            if (!conteudo) continue;

            telasAnalisadas += 1;
            erros.push(...validarTabelasComponentes(conteudo, {
                topico: nomeTopico,
                numeroTopico: topico.numeroTopico,
                tela: tela.numero
            }));
        }
    }

    const erro = criarErroValidacaoTabelas(erros);
    if (erro) throw erro;

    return {
        topicosAnalisados: listaTopicos.length,
        telasAnalisadas,
        erros
    };
}

/**
 * Converte as tabelas externas em tópicos/telas e delega a verificação de
 * campos à mesma validação central usada pelo interpretador.
 */
function validarDocumentoTabelas(tabelas) {
    if (!Array.isArray(tabelas) || tabelas.length < 2) {
        return { topicosAnalisados: 0, telasAnalisadas: 0, erros: [] };
    }

    // Carregamento tardio mantém a função pura testável sem reinstalar o parser.
    const { parse } = require("node-html-parser");
    const { analisarTopico } = require("./SelecionarTelas");
    const topicos = [];

    // A primeira tabela é o cabeçalho do documento. As demais representam tópicos.
    for (let indice = 1; indice < tabelas.length; indice++) {
        const tabelaTopico = tabelas[indice];
        const analise = analisarTopico(parse(tabelaTopico.innerHTML), indice);
        topicos.push({
            nomeTopico: analise.nomeTopicoLabel,
            // Para quem preenche o DOCX, a primeira tabela de tópico é o tópico 1.
            // O índice interno de geração permanece baseado em zero.
            numeroTopico: indice,
            telas: analise.telasDaSequencia
        });
    }

    return validarTelasDocumento(topicos);
}

module.exports = { validarDocumentoTabelas, validarTelasDocumento };
