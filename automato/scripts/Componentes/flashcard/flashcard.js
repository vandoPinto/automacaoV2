// Componente FLASHCARD
// Recebe o HTML produzido pelo Mammoth e monta os cartões no template do componente.

const { carregarTemplate, decodeHTML } = require("../../Utils");

/**
 * Decodifica entidades que podem ter sido escapadas mais de uma vez pelo DOCX/Mammoth.
 * A decodificação é limitada para evitar ciclos com conteúdo malformado.
 */
function decodificar(valor) {
    let resultado = String(valor || "");

    for (let i = 0; i < 3; i++) {
        const anterior = resultado;
        resultado = decodeHTML(resultado);
        if (resultado === anterior) break;
    }

    return resultado;
}

/**
 * Remove marcação HTML apenas para comparação textual.
 * A ordem é importante: primeiro removemos as tags e depois decodificamos entidades,
 * para reconhecer, por exemplo, &lt;frente&gt; dentro de <strong>.
 */
function textoSimples(html) {
    return decodificar(
        String(html || "")
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<[^>]*>/g, " ")
            .replace(/&nbsp;|&#160;/gi, " ")
    ).replace(/\s+/g, " ").trim();
}

/**
 * Identifica marcadores tanto escritos como texto (&lt;frente&gt;) quanto
 * presentes como tags HTML reais (<frente></frente>).
 */
function ehMarcador(bloco, nome) {
    const esperado = new RegExp("^<\\s*\\/?\\s*" + nome + "\\s*\\/?>$", "i");
    const texto = textoSimples(bloco);

    if (esperado.test(texto)) return true;

    // Caso o Word/Mammoth tenha mantido o marcador como elemento customizado.
    return new RegExp("<\\s*" + nome + "\\b[^>]*>", "i").test(String(bloco || ""));
}

/**
 * Divide o HTML em unidades na ordem original, preservando parágrafos completos,
 * imagens e marcadores. Tags de contêiner (como div) são apenas invólucros.
 *
 * O Mammoth normalmente gera parágrafos independentes para as linhas da tabela.
 * Também aceitamos texto e imagens que não estejam dentro de <p>.
 */
function separarBlocos(html) {
    const origem = String(html || "");
    const regex = /<(p|h[1-6]|li)\b[^>]*>[\s\S]*?<\/\1\s*>|<img\b[^>]*\/?>|<\s*(?:frente|verso)\b[^>]*>(?:[\s\S]*?<\/\s*(?:frente|verso)\s*>)?/gi;
    const blocos = [];
    let cursor = 0;
    let match;

    const adicionarTextoSolto = (trecho) => {
        const limpo = String(trecho || "")
            .replace(/<\/?(?:div|section|article|span)\b[^>]*>/gi, "")
            .trim();

        if (limpo && textoSimples(limpo)) blocos.push(limpo);
    };

    while ((match = regex.exec(origem)) !== null) {
        if (match.index > cursor) {
            adicionarTextoSolto(origem.slice(cursor, match.index));
        }

        blocos.push(match[0]);
        cursor = regex.lastIndex;
    }

    if (cursor < origem.length) {
        adicionarTextoSolto(origem.slice(cursor));
    }

    return blocos;
}

function ehInstrucao(texto) {
    return /^(?:passe\s+o\s+mouse|toque|clique)\b/i.test(texto);
}

module.exports = async function (conteudo) {
    const template = await carregarTemplate("flashcard");
    const blocos = separarBlocos(conteudo);

    const introducao = [];
    const cartoes = [];

    let instrucao = "";
    let estado = "introducao";
    let atual = null;

    function finalizarCartao() {
        if (!atual) return;

        // Só gera cartões que tenham algum conteúdo real, sem descartar versos longos.
        if (atual.frente.trim() || atual.verso.trim()) {
            cartoes.push(atual);
        }

        atual = null;
    }

    for (const bloco of blocos) {
        const texto = textoSimples(bloco);

        if (ehMarcador(bloco, "frente")) {
            finalizarCartao();
            atual = { frente: "", verso: "" };
            estado = "frente";
            continue;
        }

        if (ehMarcador(bloco, "verso")) {
            if (atual) estado = "verso";
            continue;
        }

        if (!texto && !/<img\b/i.test(bloco)) continue;

        if (estado === "introducao") {
            if (!instrucao && ehInstrucao(texto)) {
                instrucao = bloco;
            } else {
                introducao.push(bloco);
            }
            continue;
        }

        if (!atual) continue;

        if (estado === "frente") {
            // Mantém a tag <img> original e qualquer conteúdo complementar da frente.
            atual.frente += (atual.frente ? "\n" : "") + bloco;
        } else if (estado === "verso") {
            // Mantém os parágrafos, ênfases, listas e demais marcações do Word.
            atual.verso += (atual.verso ? "\n" : "") + bloco;
        }
    }

    finalizarCartao();

    const cartoesHTML = cartoes.map((cartao, indice) => `
        <div class="flip-box">
            <input
                class="flip-box-toque"
                type="checkbox"
                id="flashcard-toque-${indice + 1}"
                aria-label="Virar cartão ${indice + 1}"
            >
            <div class="flip-box-inner">
                <label class="flip-box-front" for="flashcard-toque-${indice + 1}">
                    ${cartao.frente}
                </label>
                <label class="flip-box-back" for="flashcard-toque-${indice + 1}">
                    ${cartao.verso}
                </label>
            </div>
        </div>
    `).join("\n");

    // Funções de callback evitam que sequências como "$&" no texto sejam
    // interpretadas pelo String.replace como referências especiais.
    return template
        .replace(/{{INTRODUCAO}}/g, () => introducao.join("\n"))
        .replace(/{{INSTRUCAO}}/g, () => instrucao)
        .replace(/{{CARTOES}}/g, () => cartoesHTML);
};
