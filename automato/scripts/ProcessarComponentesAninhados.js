/**
 * Protege componentes filhos antes que o componente pai interprete seus
 * próprios marcadores. Isso evita, por exemplo, que o <janela> da HOTWORD
 * seja confundido com uma janela do BOTAO.
 *
 * A estrutura de marcadores do DOCX não usa tags de fechamento. Por isso,
 * cada componente filho precisa ter sua regra de delimitação registrada aqui.
 */
const hotword = require("./Componentes/hotword/hotword");

function normalizarMarcadores(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?)\s*(hotword|botao|janela)\s*&gt;/gi, "<$1$2>")
        .replace(/&#60;\s*(\/?)\s*(hotword|botao|janela)\s*&#62;/gi, "<$1$2>")
        .replace(/&#x3c;\s*(\/?)\s*(hotword|botao|janela)\s*&#x3e;/gi, "<$1$2>")
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(hotword|botao|janela)>\s*(?:<\/strong>\s*)?<\/p>/gi, "<$1>")
        .replace(/<strong\b[^>]*>\s*<(hotword|botao|janela)>\s*<\/strong>/gi, "<$1>");
}

/**
 * Extrai blocos HOTWORD aninhados e os substitui por tokens temporários.
 * Convenção atual: <hotword> título <janela> explicação [próximo marcador].
 */
async function protegerHotwords(html, numeroLicao, index) {
    const origem = normalizarMarcadores(html);
    const regex = /<(hotword|botao|janela)\s*>/gi;
    const marcadores = [...origem.matchAll(regex)];
    const blocos = [];
    let resultado = "";
    let cursor = 0;

    for (let i = 0; i < marcadores.length; i++) {
        const marcador = marcadores[i];
        if (marcador[1].toLowerCase() !== "hotword") continue;

        const marcadorJanela = marcadores.slice(i + 1).find(m => m[1].toLowerCase() === "janela");
        if (!marcadorJanela) continue;

        const indiceJanela = marcadores.indexOf(marcadorJanela);
        const proximo = marcadores[indiceJanela + 1];
        const fim = proximo ? proximo.index : origem.length;
        const inicio = marcador.index;

        // Não reprocessa blocos já incluídos em outro bloco protegido.
        if (inicio < cursor) continue;

        resultado += origem.slice(cursor, inicio);
        const token = `__COMPONENTE_ANINHADO_${blocos.length}_${String(numeroLicao)}_${String(index)}__`;
        const fonte = origem.slice(inicio, fim);
        const renderizado = await hotword(fonte, numeroLicao, `${index}-nested-${blocos.length + 1}`);
        blocos.push({ token, html: renderizado });
        resultado += token;
        cursor = fim;
        i = indiceJanela;
    }

    resultado += origem.slice(cursor);

    return {
        conteudo: resultado,
        restaurar: (trecho) => {
            let saida = String(trecho || "");
            for (const bloco of blocos) {
                saida = saida.split(bloco.token).join(bloco.html);
            }
            return saida;
        }
    };
}

module.exports = { protegerHotwords };
