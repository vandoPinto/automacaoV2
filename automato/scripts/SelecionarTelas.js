/**
 * Processa uma tabela de lição e extrai suas telas, transformando-as em arquivos HTML.
 *
 * Funcionamento:
 * - Recebe o HTML da tabela da lição já parseado
 * - Percorre todas as linhas (<tr>)
 * - Ignora a primeira linha (título da lição)
 * - Para cada linha:
 *   - Extrai a segunda coluna (<td>[1])
 *   - Envia o conteúdo para `CriarTela` para processar e criar o arquivo HTML
 *
 * Responsabilidades:
 * - Processar a tabela em unidades de tela
 * - Delegar a criação de arquivos para outro módulo
 *
 * Parâmetros:
 * @param {HTMLElement} licaoHTML - HTML da tabela da lição
 * @param {number} numeroLicao - Número da lição (ex.: 1, 2, 3)
 * @param {string} caminhoBaseSaida - Caminho base para onde as telas serão salvas
 */

const { parse } = require("node-html-parser");
const path = require("path");
const fs = require("fs/promises");
const { CriarTela } = require("./CriarTela");

/**
 * Processa uma tabela de tópico, identifica os números das telas e cria os HTMLs.
 *
 * Regras:
 * - Considera apenas as linhas da tabela do tópico, ignorando linhas de tabelas aninhadas.
 * - Uma linha inicia uma tela quando a primeira célula contém somente um número.
 * - Linhas seguintes sem número ou com o mesmo número são anexadas à tela atual.
 * - Uma tela é criada uma única vez por número, evitando sobrescrever arquivos.
 * - Gera um JSON para o tópico com um item em "telas" para cada HTML criado.
 *
 * @param {HTMLElement} licaoHTML Tabela HTML de um tópico.
 * @param {number} indiceTabela Índice da tabela no documento.
 * @param {string} caminhoBaseSaida Diretório base de saída.
 * @param {{sigla: string, numeroLicao: number, titulo?: string}} metadados Metadados do cabeçalho.
 * @returns {Promise<string[]>} Caminhos dos arquivos HTML criados. Os metadados também recebem o nome e a quantidade de telas do tópico.
 * @throws {Error} Se não for possível identificar/processar o tópico ou suas telas.
 */
/**
 * Analisa uma tabela de tópico sem criar arquivos. Esta função é compartilhada
 * pela geração das telas e pela pré-validação global do documento, garantindo
 * que ambos percorram exatamente as mesmas telas e preservem a mesma ordem.
 *
 * @returns {{numeroTopico:number,nomeTopicoLabel:string,telas:Array,telasDaSequencia:Array}}
 */
function analisarTopico(licaoHTML, indiceTabela) {
    if (!licaoHTML || typeof licaoHTML.querySelectorAll !== "function") {
        throw new Error(`SelecionarTelas.js - A tabela do tópico ${indiceTabela} não é válida.`);
    }

    // Linhas de tabelas aninhadas pertencem ao conteúdo da célula da tela e
    // nunca devem ser interpretadas como novas telas do roteiro.
    const todasAsLinhas = licaoHTML.querySelectorAll("tr");
    const linhas = todasAsLinhas.filter(linha => {
        let pai = linha.parentNode;
        while (pai && pai !== licaoHTML) {
            if (pai.tagName === "TABLE") return false;
            pai = pai.parentNode;
        }
        return true;
    });

    if (!linhas.length) {
        throw new Error(`SelecionarTelas.js - A tabela ${indiceTabela} não contém linhas.`);
    }

    const celulasCabecalho = linhas[0]
        .querySelectorAll("th, td")
        .map(celula => celula.textContent
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim()
        )
        .filter(Boolean);

    const textoCabecalho = celulasCabecalho.join(" ");
    const numeroTopico = Math.max(0, Number(indiceTabela) - 1);
    let nomeTopicoLabel = celulasCabecalho.length > 1
        ? celulasCabecalho.slice(1).join(" ").trim()
        : textoCabecalho;

    const cabecalhoComNome = nomeTopicoLabel.match(/^t[oó]pico\s*0*\d+\s*[:\-–—|]+\s*(.+)$/i);
    if (cabecalhoComNome) nomeTopicoLabel = cabecalhoComNome[1].trim();
    if (!nomeTopicoLabel) nomeTopicoLabel = `Tópico ${numeroTopico}`;

    const telas = [];
    let telaAtual = null;

    for (let i = 1; i < linhas.length; i++) {
        const celulas = linhas[i].querySelectorAll(":scope > td, :scope > th");
        const celulasLinha = celulas.length
            ? celulas
            : linhas[i].childNodes.filter(no => no.tagName === "TD" || no.tagName === "TH");

        if (celulasLinha.length < 2) continue;

        const textoNumero = celulasLinha[0].textContent
            .replace(/\u00a0/g, " ")
            .trim();
        const matchNumero = textoNumero.match(/^(\d+)$/);
        const conteudoLinha = celulasLinha[1].innerHTML.trim();

        if (matchNumero) {
            const numeroTela = Number(matchNumero[1]);
            if (!telaAtual || telaAtual.numero !== numeroTela) {
                telaAtual = { numero: numeroTela, partes: [] };
                telas.push(telaAtual);
            }
            if (conteudoLinha) telaAtual.partes.push(conteudoLinha);
        } else if (telaAtual && conteudoLinha) {
            telaAtual.partes.push(conteudoLinha);
        }
    }

    if (!telas.length) {
        throw new Error(
            `SelecionarTelas.js - Nenhuma tela numerada foi encontrada no tópico ${numeroTopico}. Confira se a primeira coluna contém somente o número da tela.`
        );
    }

    const indiceUltimaTelaPreenchida = telas.reduce((ultimo, tela, indice) => {
        return tela.partes.join("\\n").trim() ? indice : ultimo;
    }, -1);
    const telasDaSequencia = indiceUltimaTelaPreenchida === -1
        ? []
        : telas.slice(0, indiceUltimaTelaPreenchida + 1);

    // A sequência de telas é validada aqui para que a pré-validação e a geração
    // não interpretem o documento de maneiras diferentes.
    for (let indice = 0; indice < telasDaSequencia.length; indice++) {
        const tela = telasDaSequencia[indice];
        const conteudo = tela.partes.join("\\n").trim();
        if (!conteudo) {
            throw new Error(
                `SelecionarTelas.js - A tela ${tela.numero} do tópico ${numeroTopico} está sem conteúdo.`
            );
        }
        if (indice > 0) {
            const numeroAnterior = telasDaSequencia[indice - 1].numero;
            if (tela.numero !== numeroAnterior + 1) {
                throw new Error(
                    `SelecionarTelas.js - A sequência de telas do tópico ${numeroTopico} está incorreta: era esperada a tela ${numeroAnterior + 1}, mas foi encontrada a tela ${tela.numero}.`
                );
            }
        }
    }

    return { numeroTopico, nomeTopicoLabel, telas, telasDaSequencia };
}

async function SelecionarTelas(licaoHTML, indiceTabela, caminhoBaseSaida, metadados) {
    if (!licaoHTML || typeof licaoHTML.querySelectorAll !== "function") {
        throw new Error(`SelecionarTelas.js - A tabela do tópico ${indiceTabela} não é válida.`);
    }

    if (!metadados || !metadados.sigla || !Number.isInteger(Number(metadados.numeroLicao))) {
        throw new Error("SelecionarTelas.js - Os metadados do cabeçalho não foram informados corretamente.");
    }

    const analiseTopico = analisarTopico(licaoHTML, indiceTabela);
    const { numeroTopico, nomeTopicoLabel, telasDaSequencia } = analiseTopico;

    // Um tópico sem nenhuma tela preenchida é válido e deve ser ignorado.
    if (!telasDaSequencia.length) {
        console.log(`SelecionarTelas.js - Tópico ${numeroTopico} ignorado: todas as telas estão vazias.`);
        return [];
    }

    const caminhosCriados = [];
    const numerosProcessados = new Set();

    for (let indice = 0; indice < telasDaSequencia.length; indice++) {
        const tela = telasDaSequencia[indice];
        const conteudo = tela.partes.join("\\n").trim();

        // A tela e sua numeração já foram analisadas pela função compartilhada
        // analisarTopico, também utilizada pela pré-validação global.
        if (numerosProcessados.has(tela.numero)) continue;
        numerosProcessados.add(tela.numero);

        const caminho = await CriarTela(
            tela.numero,
            tela.numero,
            conteudo,
            caminhoBaseSaida,
            metadados,
            numeroTopico,
            { nomeTopico: nomeTopicoLabel, numeroTopico: numeroTopico + 1 }
        );

        caminhosCriados.push(caminho);
    }

    // Registra o tópico e sua quantidade de telas para atualizar o wbt.json ao final do processamento.
    if (!Array.isArray(metadados.topicos)) metadados.topicos = [];
    const topicoExistente = metadados.topicos.find(item => item.numero === numeroTopico);
    const resumoTopico = { numero: numeroTopico, nome: nomeTopicoLabel, totalFrames: numerosProcessados.size };
    if (topicoExistente) Object.assign(topicoExistente, resumoTopico);
    else metadados.topicos.push(resumoTopico);

    // Gera um JSON por tópico, com exatamente um item para cada tela HTML criada.
    // Exemplo: public/scripts/json/sis01/sis01_00.json
    const sigla = String(metadados.sigla).trim().toLowerCase();
    const numeroLicao = String(Number(metadados.numeroLicao)).padStart(2, "0");
    const siglaNumero = `${sigla}${numeroLicao}`;
    const topicoFormatado = String(numeroTopico).padStart(2, "0");
    const nomeTopico = `${siglaNumero}_${topicoFormatado}`;
    const pastaJson = path.resolve(caminhoBaseSaida, "..", "scripts", "json", siglaNumero);
    const caminhoJson = path.join(pastaJson, `${nomeTopico}.json`);

    const dadosJson = {
        licao: nomeTopico,
        topico: topicoFormatado,
        telas: telasDaSequencia.map(tela => ({
            passo: "1",
            desenhos: [{
                tipo: "img",
                x: "0px",
                y: "0px",
                width: "0px",
                height: "0px",
                nomeInstancia: "MovieClips/transicao_1",
                classe: "transicao_1",
                nome: `${nomeTopico}_${tela.numero}_0`
            }]
        }))
    };

    await fs.mkdir(pastaJson, { recursive: true });
    await fs.writeFile(caminhoJson, `${JSON.stringify(dadosJson, null, 4)}\n`, "utf-8");
    console.log(`SelecionarTelas.js - JSON criado: ${caminhoJson} (${telasDaSequencia.length} telas)`);

    return caminhosCriados;
}

module.exports = { SelecionarTelas, analisarTopico };
