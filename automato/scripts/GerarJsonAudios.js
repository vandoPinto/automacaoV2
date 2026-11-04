const fs = require("fs/promises");
const path = require("path");

function decodificarEntidades(texto) {
    return String(texto || "")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&amp;/gi, "&")
        .replace(/&#(\d+);/g, (_, codigo) => String.fromCodePoint(Number(codigo)))
        .replace(/&#x([\da-f]+);/gi, (_, codigo) => String.fromCodePoint(parseInt(codigo, 16)));
}

/** Remove marcações do roteiro. */
function limpar(texto) {
    let resultado = decodificarEntidades(texto);

    resultado = resultado
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/(p|div|li|tr|h[1-6]|section|article)\s*>/gi, "\n")
        .replace(/<(p|div|li|tr|h[1-6]|section|article)\b[^>]*>/gi, "")
        .replace(/<[^>]*>/g, "");

    return resultado
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map(linha => linha.replace(/[\t ]+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim();
}

/**
 * Prepara o texto para narração no Piper.
 * Transforma quebras de linha em pontos finais quando necessário.
 * Preserva pontuações existentes e evita pontos duplicados.
 */
function prepararTextoAudio(texto) {
    const linhas = String(texto || "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map(linha => linha.replace(/[\t ]+/g, " ").trim())
        .filter(Boolean);

    const partes = [];

    for (const linha of linhas) {
        if (partes.length === 0) {
            partes.push(linha);
            continue;
        }

        const anterior = partes[partes.length - 1];

        if (/[.!?…;:]["'’”»)}\]]*$/.test(anterior)) {
            partes.push(linha);
        } else {
            partes[partes.length - 1] =
                anterior.replace(/\s+$/, "") + ".";

            partes.push(linha);
        }
    }

    return partes.join(" ").replace(/\s+/g, " ").trim();
}

function extrairInteracoes(conteudo) {
    const ocorrencias = [];

    for (const tag of ["Importante", "Saiba mais"]) {
        const regex = new RegExp(
            `<${tag}\\s*>([\\s\\S]*?)<${tag}\\s*>`,
            "gi"
        );

        for (const match of conteudo.matchAll(regex)) {
            const texto = prepararTextoAudio(limpar(match[1]));

            if (texto) {
                ocorrencias.push({
                    inicio: match.index,
                    fim: match.index + match[0].length,
                    texto
                });
            }
        }
    }

    ocorrencias.sort((a, b) => a.inicio - b.inicio);

    let textoPrincipal = conteudo;

    for (const item of [...ocorrencias].sort(
        (a, b) => b.inicio - a.inicio
    )) {
        textoPrincipal =
            textoPrincipal.slice(0, item.inicio) +
            " " +
            textoPrincipal.slice(item.fim);
    }

    return {
        textoPrincipal: prepararTextoAudio(limpar(textoPrincipal)),
        interacoes: ocorrencias.map(item => item.texto)
    };
}

/**
 * Gera/atualiza a sonorização da lição:
 * <pastaCurso>/som/sonorizacao.json
 *
 * A numeração das telas é contínua entre os tópicos.
 * Somente a lição atual é substituída.
 */
async function GerarJsonAudios(tabelas, metadados, pastaCurso) {
    const sigla = String(metadados.sigla || "")
        .trim()
        .toLowerCase();

    const numero = Number(metadados.numeroLicao);

    if (
        !/^[a-z0-9_-]+$/.test(sigla) ||
        !Number.isInteger(numero) ||
        numero < 0
    ) {
        throw new Error(
            "Sigla ou número da lição inválido para gerar o JSON de áudios."
        );
    }

    const chaveLicao =
        `${sigla}${String(numero).padStart(2, "0")}`;

    const audios = [];
    let contadorTela = 0;

    for (const html of tabelas) {
        const trs = [
            ...String(html).matchAll(
                /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
            )
        ];

        let telaAtual = null;
        const telasDoTopico = [];

        // Agrupa linhas de continuação da mesma tela.
        for (const tr of trs) {
            const tds = [
                ...tr[1].matchAll(
                    /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi
                )
            ];

            if (tds.length < 2) continue;

            const valorPrimeiraCelula = limpar(tds[0][1]);
            const matchNumero = valorPrimeiraCelula.match(/^(\d+)$/);
            const conteudoLinha = tds[1][1];

            if (matchNumero) {
                const numeroLocal = Number(matchNumero[1]);

                if (
                    !telaAtual ||
                    telaAtual.numeroLocal !== numeroLocal
                ) {
                    telaAtual = {
                        numeroLocal,
                        indiceGlobal: contadorTela++,
                        partes: []
                    };

                    telasDoTopico.push(telaAtual);
                }

                if (conteudoLinha.trim()) {
                    telaAtual.partes.push(conteudoLinha);
                }

            } else if (telaAtual && conteudoLinha.trim()) {
                telaAtual.partes.push(conteudoLinha);
            }
        }

        for (const tela of telasDoTopico) {
            const indice = String(tela.indiceGlobal).padStart(3, "0");

            const conteudo = tela.partes.join("\n");

            const { textoPrincipal, interacoes } =
                extrairInteracoes(conteudo);

            if (textoPrincipal) {
                audios.push({
                    nome: `${chaveLicao}${indice}.mp3`,
                    texto: textoPrincipal
                });
            }

            interacoes.forEach((texto, i) => {
                audios.push({
                    nome: `${chaveLicao}${indice}${String.fromCharCode(97 + i)}.mp3`,
                    texto
                });
            });
        }
    }

    const pastaSom = path.join(pastaCurso, "som");
    const destino = path.join(pastaSom, "sonorizacao.json");

    await fs.mkdir(pastaSom, { recursive: true });

    let documento = { audios: {} };

    try {
        const existente = JSON.parse(
            await fs.readFile(destino, "utf8")
        );

        if (
            !existente ||
            typeof existente !== "object" ||
            Array.isArray(existente)
        ) {
            throw new Error(
                "O arquivo sonorizacao.json existente não possui um objeto JSON válido."
            );
        }

        documento = existente;

        if (
            !documento.audios ||
            typeof documento.audios !== "object" ||
            Array.isArray(documento.audios)
        ) {
            documento.audios = {};
        }

    } catch (erro) {
        if (erro.code !== "ENOENT") {
            if (erro instanceof SyntaxError) {
                throw new Error(
                    `Não foi possível atualizar ${destino}: o JSON existente está inválido. O arquivo original foi preservado.`
                );
            }

            throw erro;
        }
    }

    // Substitui apenas a lição atual.
    documento.audios[chaveLicao] = audios;

    await fs.writeFile(
        destino,
        JSON.stringify(documento, null, 2) + "\n",
        "utf8"
    );

    return destino;
}

module.exports = {
    GerarJsonAudios,
    limpar
};