// LIGAPONTOS.js
// Atividade de associação entre opções e respostas, integrada ao processador
// recursivo e ao mecanismo hierárquico de sonorização do Automato.
const { carregarTemplate } = require("../../Utils");
const { montarIdAudio } = require("../../ExtrairAudiosComponentes");

let sequenciaInstancias = 0;

function normalizarMarcadores(html) {
    return String(html || "")
        .replace(/&lt;\s*(\/?\s*)(opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado)\s*&gt;/gi, (_, barra, nome) => `<${barra}${normalizarNomeMarcador(nome)}>`) 
        .replace(/&#60;\s*(\/?\s*)(opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado)\s*&#62;/gi, (_, barra, nome) => `<${barra}${normalizarNomeMarcador(nome)}>`)
        .replace(/&#x3c;\s*(\/?\s*)(opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado)\s*&#x3e;/gi, (_, barra, nome) => `<${barra}${normalizarNomeMarcador(nome)}>`)
        .replace(/<p\b[^>]*>\s*(?:<strong\b[^>]*>\s*)?<(opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado)>\s*(?:<\/strong>\s*)?<\/p>/gi, (_, nome) => `<${normalizarNomeMarcador(nome)}>`)
        .replace(/<strong\b[^>]*>\s*<(opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado)>\s*<\/strong>/gi, (_, nome) => `<${normalizarNomeMarcador(nome)}>`)
        .replace(/<(\/?\s*)feedbackcerto\s*>/gi, "<$1feedcerto>")
        .replace(/<(\/?\s*)(?:feedErrao|feederrado|feedbackerrado)\s*>/gi, "<$1feederrado>")
        // Os marcadores estruturais são delimitadores, não elementos HTML com
        // conteúdo interno. Fechamentos opcionais do Word são removidos.
        .replace(/<\/\s*(opcao|resposta|feedcerto|feedErrao|feederrado|feedbackcerto|feedbackerrado)\s*>/gi, "");
}

function normalizarNomeMarcador(nome) {
    const normalizado = String(nome || "").toLowerCase();
    if (normalizado === "feedbackcerto") return "feedcerto";
    if (["feederrado", "feederrao", "feedbackerrado"].includes(normalizado)) return "feederrado";
    return normalizado;
}

function temConteudo(html) {
    const origem = String(html || "");
    const texto = origem
        .replace(/<!--([\s\S]*?)-->/g, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

    return Boolean(texto || /<(?:img|picture|svg|video|canvas|object|iframe|audio)\b/i.test(origem));
}

function textoAcessivel(html, fallback) {
    const texto = String(html || "")
        // Tokens temporários são restaurados como HTML recursivo depois que o
        // componente é montado. Não os repetimos no aria-label, pois isso faria
        // o processador restaurar o mesmo componente duas vezes.
        .replace(/__[A-Z][A-Z0-9_-]*__/gi, " ")
        .replace(/<img\b[^>]*\balt\s*=\s*(["'])(.*?)\1[^>]*>/gi, " $2 ")
        .replace(/<br\s*\/?\s*>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
    return texto || fallback;
}

function escaparAtributo(valor) {
    return String(valor || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function criarId(numeroLicao, index, opcoes = {}) {
    sequenciaInstancias += 1;
    const contexto = String(opcoes.contexto || `${numeroLicao ?? 0}_${index ?? 0}`)
        .replace(/[^a-zA-Z0-9_-]/g, "-");
    return `ligapontos-${contexto}-${sequenciaInstancias}`;
}

/**
 * Converte a sequência de marcadores do roteiro em pares e feedbacks.
 * Formato aceito: <opcao>...</opcao><resposta>...</resposta> repetidamente,
 * seguido por <feedcerto>...</feedcerto> e <feederrado>...</feederrado>.
 * Os fechamentos internos são opcionais, como nos roteiros AIM existentes.
 */
function interpretarRoteiro(html) {
    const origem = normalizarMarcadores(html);
    const regex = /<(opcao|resposta|feedcerto|feederrado)\s*>/gi;
    const marcadores = [...origem.matchAll(regex)];

    if (!marcadores.length) {
        throw new Error("Nenhuma marcação <opcao> foi encontrada dentro de <ligapontos>.");
    }

    const conteudoAnterior = origem.slice(0, marcadores[0].index);
    const opcoes = [];
    const respostas = [];
    let feedbackCerto = "";
    let feedbackErrado = "";
    let aguardandoResposta = false;
    let iniciouFeedback = false;

    for (let i = 0; i < marcadores.length; i++) {
        const marcador = marcadores[i];
        const proximo = marcadores[i + 1];
        const inicio = marcador.index + marcador[0].length;
        const fim = proximo ? proximo.index : origem.length;
        const trecho = origem.slice(inicio, fim).trim();
        const tipo = marcador[1].toLowerCase();

        if (tipo === "opcao") {
            if (iniciouFeedback) {
                throw new Error("As opções e respostas devem aparecer antes dos feedbacks.");
            }
            if (aguardandoResposta) {
                throw new Error(`A opção ${opcoes.length} não possui uma <resposta> correspondente antes da próxima <opcao>.`);
            }
            if (!temConteudo(trecho)) {
                throw new Error(`A opção ${opcoes.length + 1} está vazia.`);
            }
            opcoes.push(trecho);
            aguardandoResposta = true;
            continue;
        }

        if (tipo === "resposta") {
            if (iniciouFeedback) {
                throw new Error("As opções e respostas devem aparecer antes dos feedbacks.");
            }
            if (!aguardandoResposta) {
                throw new Error("Foi encontrada uma <resposta> sem a opção correspondente.");
            }
            if (!temConteudo(trecho)) {
                throw new Error(`A resposta ${respostas.length + 1} está vazia.`);
            }
            respostas.push(trecho);
            aguardandoResposta = false;
            continue;
        }

        iniciouFeedback = true;
        if (aguardandoResposta) {
            throw new Error(`A opção ${opcoes.length} não possui uma <resposta> correspondente.`);
        }
        if (tipo === "feedcerto") {
            if (feedbackCerto) throw new Error("Foi informado mais de um marcador <feedcerto>.");
            feedbackCerto = trecho;
        } else {
            if (feedbackErrado) throw new Error("Foi informado mais de um marcador <feederrado>.");
            feedbackErrado = trecho;
        }
    }

    if (aguardandoResposta) {
        throw new Error(`A opção ${opcoes.length} não possui uma <resposta> correspondente.`);
    }
    if (!opcoes.length) throw new Error("A atividade precisa ter pelo menos uma associação.");
    if (opcoes.length !== respostas.length) {
        throw new Error(`A quantidade de opções (${opcoes.length}) é diferente da quantidade de respostas (${respostas.length}).`);
    }
    if (!temConteudo(feedbackCerto)) throw new Error("O feedback de acerto <feedcerto> está ausente ou vazio.");
    if (!temConteudo(feedbackErrado)) throw new Error("O feedback de erro <feedErrao> está ausente ou vazio.");

    return {
        conteudoAnterior,
        pares: opcoes.map((opcao, indice) => ({
            id: String(indice + 1),
            opcao,
            resposta: respostas[indice]
        })),
        feedbackCerto,
        feedbackErrado
    };
}

module.exports = async function (conteudo, numeroLicao, index, opcoes = {}) {
    const template = await carregarTemplate("ligapontos");
    const idInstancia = criarId(numeroLicao, index, opcoes);
    const prefixoAudio = String(opcoes.prefixoAudio || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const tipoAudio = String(opcoes.tipoAudio || "ligapontos").replace(/[^a-zA-Z0-9_-]/g, "");
    const dados = interpretarRoteiro(conteudo);
    const caminhoAudio = prefixoAudio ? prefixoAudio.split("_").filter(Boolean) : [];
    const audioCerto = montarIdAudio(caminhoAudio, tipoAudio, 0);
    const audioErrado = montarIdAudio(caminhoAudio, tipoAudio, 1);

    const htmlOpcoes = dados.pares.map(par => `
        <div class="ligapontos-item ligapontos-item-opcao" data-ligapontos-opcao="${par.id}">
            <div class="ligapontos-conteudo">${par.opcao}</div>
            <button class="ligapontos-ponto ligapontos-ponto-opcao" type="button"
                data-ligapontos-lado="opcao" data-ligapontos-id="${par.id}"
                aria-label="${escaparAtributo(`Selecionar opção: ${textoAcessivel(par.opcao, `opção ${par.id}`)}`)}" aria-pressed="false"></button>
        </div>`).join("\n");

    const htmlRespostas = dados.pares.map(par => `
        <div class="ligapontos-item ligapontos-item-resposta" data-ligapontos-resposta="${par.id}">
            <button class="ligapontos-ponto ligapontos-ponto-resposta" type="button"
                data-ligapontos-lado="resposta" data-ligapontos-id="${par.id}"
                aria-label="${escaparAtributo(`Selecionar resposta: ${textoAcessivel(par.resposta, `resposta ${par.id}`)}`)}" aria-pressed="false"></button>
            <div class="ligapontos-conteudo">${par.resposta}</div>
        </div>`).join("\n");

    return template
        .replace(/{{ID_INSTANCIA}}/g, () => idInstancia)
        .replace(/{{CONTEUDO_ANTERIOR}}/g, () => dados.conteudoAnterior)
        .replace(/{{OPCOES}}/g, () => htmlOpcoes)
        .replace(/{{RESPOSTAS}}/g, () => htmlRespostas)
        .replace(/{{FEEDBACK_CERTO}}/g, () => dados.feedbackCerto)
        .replace(/{{FEEDBACK_ERRADO}}/g, () => dados.feedbackErrado)
        .replace(/{{AUDIO_CERTO}}/g, () => audioCerto)
        .replace(/{{AUDIO_ERRADO}}/g, () => audioErrado);
};

module.exports.interpretarRoteiro = interpretarRoteiro;
module.exports.normalizarMarcadores = normalizarMarcadores;
