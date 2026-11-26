const { executar } = require("./automato/main.js");
const { CarregarArquivoDOCX } = require("./automato/scripts/CarregarArquivoDOCX");
const { CriarCabecalho } = require("./automato/scripts/CriarCabecalho");
const { renderizarPreviewComponente } = require("./automato/scripts/EditorPreview");
const { removerAtualizacaoGlobal } = require("./automato/scripts/RemoverAtualizacaoGlobal");
const { listarModelosDisponiveis } = require("./automato/scripts/ModelosCurso");
const { temasPublicacao, aplicarTemaDeCores } = require("./automato/scripts/PaletasCores");
const { parse } = require("node-html-parser");

// Importar módulos
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const https = require("https");
const { spawn } = require("child_process");

// Criar aplicação
const app = express();

// Armazena o progresso de todos os processamentos ativos.
const progressoProcessamentos = new Map();

// Garantir que a pasta temporária de uploads exista.
const pastaUploads = path.resolve(__dirname, "uploads");
fs.mkdirSync(pastaUploads, { recursive: true });

// Upload
const upload = multer({
  dest: pastaUploads,
  limits: { fileSize: 500 * 1024 * 1024 }, // Limite de 500 MB
  fileFilter: (req, file, callback) => {
    const extensao = path.extname(file.originalname || "").toLowerCase();
    if (extensao !== ".docx") {
      const erro = new Error("Envie um arquivo no formato .docx.");
      erro.name = "ErroValidacaoArquivo";
      return callback(erro);
    }
    callback(null, true);
  }
});
const uploadArquivoCurso = multer({
  dest: pastaUploads,
  limits: { fileSize: 500 * 1024 * 1024 }
});

// Dados mock mantidos para compatibilidade com a página atual.
let haikus = [];
try {
  haikus = require("./haikus.json");
} catch (erro) {
  console.warn("server.js - O arquivo haikus.json não foi carregado:", erro.message);
}

// Porta
const port = process.env.PORT || 3000;
const editorPreviewSecret = process.env.EDITOR_PREVIEW_SECRET || crypto.randomBytes(32).toString("hex");

// Servir arquivos estáticos
app.get("/assets/vendor/jszip.min.js", (req, res, next) => {
  try {
    res.type("application/javascript").sendFile(require.resolve("jszip/dist/jszip.min.js"));
  } catch (erro) {
    next(erro);
  }
});
app.get("/assets/vendor/mammoth.browser.min.js", (req, res, next) => {
  try {
    res.type("application/javascript").sendFile(require.resolve("mammoth/mammoth.browser.min.js"));
  } catch (erro) {
    next(erro);
  }
});
app.use("/assets", express.static(path.resolve(__dirname, "assets")));
app.use("/output", express.static(path.resolve(__dirname, "./output")));
app.use("/automato", express.static(path.resolve(__dirname, "./automato")));

// View engine
app.set("view engine", "ejs");

// Rota GET
app.get("/", async (req, res) => {
  try {
    const modelosDisponiveis = await listarModelosDisponiveis();
    res.render("index", { haikus, modelosDisponiveis });
  } catch (erro) {
    console.error("server.js - Não foi possível carregar os modelos de curso:", erro.message);
    res.render("index", { haikus, modelosDisponiveis: [] });
  }
});

// Gerenciador em uma página própria, sem modal. O link da página inicial abre esta rota em nova aba.
app.get("/gerenciar", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("gerenciar", { haikus });
});

// Biblioteca de componentes e exemplos de preenchimento do roteiro.
const componentesBiblioteca = [
  { slug: 'destaque', nome: 'Destaque', descricao: 'Cria um bloco visual com título e texto ou imagem. Use títulos como Importante, Saiba mais, Atenção, Dica, Curiosidade, Você sabia, Lembre-se ou Para refletir; o conteúdo é narrado junto com o texto da tela ou da janela.', icone: 'bi-megaphone' },
  { slug: 'imagem', nome: 'Imagem', descricao: 'Apresenta uma imagem ampliada no espaço disponível, com título acima e rodapé abaixo. Os dois textos são opcionais.', icone: 'bi-image' },
  { slug: 'dividir', nome: 'Dividir', descricao: 'Divide o conteúdo da Tela neste ponto: o que vem antes fica à esquerda e o que vem depois fica à direita.', icone: 'bi-layout-split' },
  { slug: 'botao', nome: 'Botões', descricao: 'Cria botões interativos que abrem janelas com textos, imagens e outros componentes compatíveis.', icone: 'bi-hand-index-thumb' },
  { slug: 'hotword', nome: 'Hotword', descricao: 'Destaca uma palavra ou expressão no texto e associa a ela uma janela com explicação complementar.', icone: 'bi-highlighter' },
  { slug: 'abas', nome: 'Abas', descricao: 'Organiza conteúdos relacionados em guias selecionáveis, permitindo alternar entre diferentes painéis de informação.', icone: 'bi-layout-three-columns' },
  { slug: 'flashcard', nome: 'Flashcard', descricao: 'Apresenta cartões interativos com frente e verso, permitindo revelar informações complementares.', icone: 'bi-card-text' },
  { slug: 'opcoes', nome: 'Opções', descricao: 'Tabela OPÇÕES: informe as alternativas, marque SIM nas corretas e NÃO nas demais; finalize com os feedbacks de acerto e erro.', icone: 'bi-ui-radios' },
  { slug: 'verdadeirofalso', nome: 'Verdadeiro ou Falso', descricao: 'Apresenta frases com um campo de resposta à esquerda. O estudante digita a resposta esperada em cada campo e recebe o feedback correspondente ao submeter.', icone: 'bi-input-cursor-text' },
  { slug: 'jogomemoria', nome: 'Jogo da Memória', descricao: 'Cria pares de cartas embaralhadas. O estudante vira duas cartas por vez e recebe o feedback específico ao encontrar um par.', icone: 'bi-grid-3x3-gap' },
  { slug: 'mininavegacao', nome: 'Mini navegação', descricao: 'Cria uma navegação auxiliar para orientar o estudante entre partes ou etapas do conteúdo.', icone: 'bi-signpost-split' },
  { slug: 'sanfona', nome: 'Sanfona', descricao: 'Organiza informações em painéis expansíveis, permitindo abrir e fechar cada seção.', icone: 'bi-list-nested' },
  { slug: 'ligapontos', nome: 'Liga Pontos', descricao: 'Permite associar opções a respostas por linhas, com validação e feedbacks personalizados.', icone: 'bi-diagram-3' },
  { slug: 'relacionarcolunas', nome: 'Relacionar Colunas', descricao: 'Apresenta duas colunas de itens relacionados. O estudante digita o identificador correspondente em cada campo e recebe feedback ao submeter.', icone: 'bi-input-cursor-text' },
  { slug: 'forca', nome: 'Forca', descricao: 'Mostra uma palavra oculta no centro e um teclado QWERTY. O estudante escolhe letras para revelar a palavra enquanto o desenho da forca avança a cada erro.', icone: 'bi-alphabet-uppercase' },
  { slug: 'video', nome: 'Vídeo', descricao: 'Exibe arquivo de vídeo ou vídeo do YouTube diretamente na tela ou por um botão que abre um modal com reprodução e controles.', icone: 'bi-camera-video' },
  { slug: 'arquivo', nome: 'Arquivo', descricao: 'Disponibiliza arquivos do curso: formatos visualizáveis abrem em outra aba e os demais são baixados ao clicar.', icone: 'bi-file-earmark-arrow-down' }
];

const exemplosBiblioteca = {
  destaque: `<componente tipo="destaque"><destaqueitem><destaquetitulo>Atenção</destaquetitulo> <destaqueconteudo>Confira os equipamentos de proteção antes de iniciar a atividade.</destaqueconteudo></destaqueitem></componente>`,
  imagem: `<componente tipo="imagem"><imagemitem data-titulo="" data-rodape=""></imagemitem></componente>`,
  dividir: `<dividir>`,
  botao: `<botoes>

<botao>
INTRODUÇÃO

<janela>
Escreva uma breve apresentação explicando o conteúdo dos botões.

<botao>
BOTÃO 1

<janela>
Insira o texto que será apresentado ao clicar no botão.
Pode inserir imagens e outros componentes compatíveis.

<botao>
BOTÃO 2

<janela>
Insira o conteúdo correspondente ao segundo botão.

</botoes>`,
  hotword: `Texto de teste

<hotword>
Texto

<janela>
Insira a explicação complementar que será apresentada quando o estudante selecionar a palavra.

</hotword>`,
  abas: `<abas>

<aba>
TÍTULO DA ABA 1

<aba>
TÍTULO DA ABA 2

<aba>
TÍTULO DA ABA 3

<janela>
Insira o conteúdo correspondente à primeira aba.

<janela>
Insira o conteúdo correspondente à segunda aba.

<janela>
Insira o conteúdo correspondente à terceira aba.

</abas>`,
  flashcard: `<flashcard>

<frente>
Insira o texto, pergunta ou imagem que aparecerá na frente do cartão.

<verso>
Insira a resposta, explicação ou imagem que aparecerá no verso.

<frente>
Insira a frente do segundo cartão.

<verso>
Insira o verso do segundo cartão.

</flashcard>`,
  opcoes: `<componente tipo="opcoes">

<alternativa>Fechar a torneira enquanto escova os dentes.</alternativa>
<correta>SIM</correta>

<alternativa>Deixar a torneira aberta durante toda a escovação.</alternativa>
<correta>NÃO</correta>

<alternativa>Lavar a calçada todos os dias com mangueira.</alternativa>
<correta>SIM</correta>

<feedcerto>Parabéns! Você selecionou todas as atitudes corretas.</feedcerto>
<feederrado>Não foi dessa vez. Revise as alternativas e tente novamente.</feederrado>

</componente>`,
  verdadeirofalso: `<componente tipo="verdadeirofalso">

<alternativa>O céu é azul?</alternativa>
<correta>V</correta>

<alternativa>A Terra é plana?</alternativa>
<correta>F</correta>

<alternativa>Lavar a calçada diariamente com mangueira.</alternativa>
<correta>F</correta>

<feedcerto>Parabéns, é isso mesmo!</feedcerto>
<feederrado>Tente novamente, você consegue.</feederrado>

</componente>`,
  jogomemoria: `<jogomemoria>

<frente>
[Insira uma imagem ou um texto para a frente comum de todas as cartas. Deixe vazio para usar o desenho padrão em CSS.]

<carta1>
Maçã

<carta2>
Fruta vermelha

<feedback>
Muito bem! Você encontrou o par da maçã.

<carta1>
Banana

<carta2>
Fruta amarela

<feedback>
Parabéns! Você encontrou o par da banana.

</jogomemoria>`,
  mininavegacao: `<mininavegacao>

<janela>
Insira o conteúdo da primeira etapa da navegação.

<janela>
Insira o conteúdo da segunda etapa da navegação.

<janela>
Insira o conteúdo da terceira etapa da navegação.

</mininavegacao>`,
  sanfona: `<sanfona>

<botao>
TÍTULO DO PRIMEIRO PAINEL

<janela>
Insira o conteúdo que será exibido ao abrir o primeiro painel.
Pode inserir textos, imagens e outros componentes compatíveis.

<botao>
TÍTULO DO SEGUNDO PAINEL

<janela>
Insira o conteúdo que será exibido ao abrir o segundo painel.

<botao>
TÍTULO DO TERCEIRO PAINEL

<janela>
Insira o conteúdo que será exibido ao abrir o terceiro painel.

</sanfona>`,
  ligapontos: `<ligapontos>

<opcao>
Opção 1
<resposta>
Resposta da opção 1

<opcao>
Opção 2
<resposta>
Resposta da opção 2

<opcao>
Opção 3
<resposta>
Resposta da opção 3

<opcao>
Opção 4
<resposta>
Resposta da opção 4

<opcao>
Opção 5
<resposta>
Resposta da opção 5

<feedcerto>
Parabéns! Você ligou corretamente.

<feedErrao>
Não foi dessa vez, tente novamente.

</ligapontos>`,
  relacionarcolunas: `<componente tipo="relacionarcolunas">

<modo>Letra</modo>

<opcao>Maçã</opcao>
<resposta>Vermelha</resposta>

<opcao>Banana</opcao>
<resposta>Amarela</resposta>

<feedcerto>Parabéns, é isso mesmo!</feedcerto>
<feederrado>Tente novamente, você consegue.</feederrado>

</componente>`,
  forca: `<componente tipo="forca">

<palavra>ABACAXI</palavra>
<dica>Fruta tropical</dica>
<feedcerto>Muito bem! Você descobriu a palavra!</feedcerto>
<feederrado>A palavra era ABACAXI. Tente novamente.</feederrado>

</componente>`,
  video: `<componente tipo="video">

<videoitem data-modo="modal" data-origem="arquivo" data-rotulo="Assistir vídeo">meu-video.mp4</videoitem>

</componente>`,
  arquivo: `<componente tipo="arquivo">

<arquivoitem data-rotulo="Abrir pdf">APOSTILA-EXCEL-AVANCÌ§ADO.pdf</arquivoitem>

</componente>`
};
const estruturasTabelaBiblioteca = {
  destaque: {
    titulo: "DESTAQUE", larguras: [28, 72], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [["Atenção", "Confira os equipamentos de proteção antes de iniciar a atividade."]]
  },
  imagem: {
    titulo: "IMAGEM", larguras: [100], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [["Título da imagem (opcional)"], ["COLE OU INSIRA A IMAGEM AQUI"], ["Rodapé (opcional)"]]
  },
  dividir: {
    titulo: "Dividir", larguras: [100], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.5,
    alinhamentoCabecalho: "center",
    linhas: []
  },
  botao: {
    titulo: "BOTÕES", larguras: [16.15, 83.85], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.5,
    linhas: [["Botao 1", "Texto da janela do botão 1"], ["Botao 2", "Texto da janela do botão 2"]]
  },
  hotword: {
    titulo: "HOTWORD", larguras: [16.15, 83.85], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [["Luz solar", "Energia emitida pelo Sol, essencial para a fotossíntese."], ["", ""], ["", ""]]
  },
  abas: {
    titulo: "ABAS", larguras: [35.83, 64.17], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [["Título da aba 1", "Conteúdo da janela 1"], ["Título da aba 2", "Conteúdo da janela 2"]]
  },
  flashcard: {
    titulo: "FLASHCARD", larguras: [35.98, 64.02], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.5,
    linhas: [
      ["Qual é o papel da clorofila?", "A clorofila capta energia luminosa para a fotossíntese."],
      ["Qual gás a planta absorve?", "A planta absorve dióxido de carbono do ar."], ["", ""]
    ]
  },
  jogomemoria: {
    titulo: "JOGO DA MEMÓRIA", larguras: [20, 24, 34, 22], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.5,
    linhas: [
      ["Fotossíntese", "Produção de glicose com luz", "Par correto: a fotossíntese produz glicose.", "Vire as cartas para encontrar os pares."],
      ["Clorofila", "Pigmento que absorve luz", "Par correto: a clorofila absorve luz.", ""]
    ]
  },
  mininavegacao: {
    titulo: "MINI NAVEGAÇÃO", larguras: [100], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.5,
    linhas: [["Etapa 1: observe a imagem e leia as informações."], ["Etapa 2: avance para conferir o resumo."]]
  },
  sanfona: {
    titulo: "SANFONA", larguras: [25, 75], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.5,
    linhas: [["Etapa 1", "Leia o conceito e consulte o exemplo."], ["Exemplo", "A luz solar fornece energia para a fotossíntese."]]
  },
  ligapontos: {
    titulo: "LIGA PONTOS", larguras: [18, 27, 25, 30], tamanho: 12, tamanhoCabecalho: 12, corBorda: "#d9d9d9", espessuraBorda: 0.625,
    linhas: [
      ["Fotossíntese", "Processo que usa luz para produzir glicose", "Correto! Os conceitos estão ligados.", "Ainda não. Confira o conceito e tente outra ligação."],
      ["Clorofila", "Pigmento que absorve luz", "", ""], ["", "", "", ""]
    ]
  },
  opcoes: {
    titulo: "OPÇÕES", larguras: [84.62, 15.38], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [
      ["Fechar a torneira ao escovar os dentes.", { texto: "SIM", bold: true }],
      ["Deixar a torneira aberta.", { texto: "NÃO", bold: true }],
      ["Lavar a calçada diariamente com mangueira.", { texto: "SIM", bold: true }],
      [{ texto: "Parabéns, é isso mesmo!", colspan: 2 }],
      [{ texto: "Tente novamente, você consegue.", colspan: 2 }]
    ]
  },
  verdadeirofalso: {
    titulo: "VERDADEIRO OU FALSO", larguras: [6, 94], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [
      [{ texto: "V", bold: true }, "O céu é azul?"],
      [{ texto: "F", bold: true }, "A terra é plana?"],
      [{ texto: "F", bold: true }, "Lavar a calçada diariamente com mangueira."],
      [{ texto: "Parabéns, é isso mesmo!", colspan: 2 }],
      [{ texto: "Tente novamente, você consegue.", colspan: 2 }]
    ]
  },
  relacionarcolunas: {
    titulo: "RELACIONAR COLUNAS", larguras: [35.83, 64.17], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [
      ["Maça", "Vermelha"], ["Banana", "Amarelo"],
      [{ texto: "Letra ou número", colspan: 2 }],
      [{ texto: "Parabéns, é isso mesmo!", colspan: 2 }],
      [{ texto: "Tente novamente, você consegue.", colspan: 2 }]
    ]
  },
  forca: {
    titulo: "FORCA", larguras: [100], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [
      ["ABACAXI"], ["Fruta tropical"],
      ["Muito bem! Você descobriu a palavra!"],
      ["A palavra era ABACAXI. Tente novamente."]
    ]
  },
  video: {
    titulo: "VIDEO", larguras: [18, 82], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [
      ["Botao 1", "Nome_do_Video.mov (abre em um modal)"],
      ["Botao 2", "Link do youtube (abre em um modal)"],
      ["", "Nome_do_Video.mov (coloca na tela o player de vídeo com controles)"],
      ["", "Link do youtube (coloca na tela o player de vídeo com controles)"]
    ]
  },
  arquivo: {
    titulo: "ARQUIVO", larguras: [30, 70], tamanho: 12, tamanhoCabecalho: 12, espessuraBorda: 0.75,
    linhas: [["Abrir pdf", "APOSTILA-EXCEL-AVANCÌ§ADO.pdf"], ["", ""]]
  }
};
app.get("/biblioteca", (req, res) => {
  res.render("biblioteca", { componentes: componentesBiblioteca, estruturasTabela: estruturasTabelaBiblioteca });
});

// Editor de código: permite digitar diretamente ou inserir exemplos pela Biblioteca.
// A prévia continua usando o processador e os templates originais do Autômato.
function obterOrigemRequisicao(req) {
  const protocolo = String(req.get("x-forwarded-proto") || req.protocol || "http").split(",")[0].trim();
  const host = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  if (!/^https?$/.test(protocolo) || !host) return "";
  try { return new URL(`${protocolo}://${host}`).origin; } catch (_) { return ""; }
}

function obterConfiguracaoPreviewEditor(req) {
  const origemEditor = obterOrigemRequisicao(req);
  if (!origemEditor) return { previewOrigin: "", previewFrameUrl: "" };

  let origemPreview = String(process.env.EDITOR_PREVIEW_ORIGIN || "").trim();
  if (origemPreview) {
    try {
      const urlPreview = new URL(origemPreview);
      origemPreview = ["http:", "https:"].includes(urlPreview.protocol) ? urlPreview.origin : "";
    } catch (_) { origemPreview = ""; }
  } else {
    const urlEditor = new URL(origemEditor);
    if (["localhost", "127.0.0.1", "::1"].includes(urlEditor.hostname)) {
      urlEditor.hostname = "preview.localhost";
      origemPreview = urlEditor.origin;
    }
  }

  // A origem isolada precisa ser diferente da página do editor; o sandbox
  // libera APIs de mídia somente nesse contexto separado.
  if (!origemPreview || origemPreview === origemEditor) {
    return { previewOrigin: "", previewFrameUrl: "" };
  }

  const assinatura = crypto.createHmac("sha256", editorPreviewSecret).update(origemEditor).digest("hex");
  const urlPreview = new URL("/editor-componentes-preview-frame", origemPreview);
  urlPreview.searchParams.set("origin", origemEditor);
  urlPreview.searchParams.set("sig", assinatura);
  return { previewOrigin: origemPreview, previewFrameUrl: urlPreview.toString() };
}

app.get("/editor-componentes", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("editor-componentes", {
    componentes: componentesBiblioteca,
    exemplos: exemplosBiblioteca,
    estruturasTabela: estruturasTabelaBiblioteca,
    ...obterConfiguracaoPreviewEditor(req)
  });
});

app.get("/editor-componentes-preview-frame", (req, res) => {
  const origemEditor = String(req.query.origin || "");
  const assinaturaRecebida = String(req.query.sig || "");
  const assinaturaEsperada = crypto.createHmac("sha256", editorPreviewSecret).update(origemEditor).digest();
  let assinaturaInformada;
  try { assinaturaInformada = Buffer.from(assinaturaRecebida, "hex"); } catch (_) { assinaturaInformada = Buffer.alloc(0); }

  let origemValida = false;
  try {
    const parsed = new URL(origemEditor);
    origemValida = ["http:", "https:"].includes(parsed.protocol) && parsed.origin === origemEditor;
  } catch (_) { /* origem malformada */ }

  if (!origemValida || assinaturaInformada.length !== assinaturaEsperada.length ||
      !crypto.timingSafeEqual(assinaturaInformada, assinaturaEsperada)) {
    return res.status(403).type("text/plain").send("Pré-visualização inválida.");
  }

  const origemSeguraParaScript = JSON.stringify(origemEditor).replace(/</g, "\\u003c");
  const modoPopup = req.query.popup === "1";
  const barraPopup = modoPopup ? `<header class="preview-toolbar">
  <strong id="preview-title">Pré-visualização</strong>
  <div class="preview-devices" role="group" aria-label="Dispositivo da visualização">
    <button type="button" class="preview-device active" data-device="desktop" aria-pressed="true">Desktop</button>
    <button type="button" class="preview-device" data-device="tablet" aria-pressed="false">Tablet</button>
    <button type="button" class="preview-device" data-device="mobile" aria-pressed="false">Mobile</button>
  </div>
  <button type="button" id="preview-inspect" class="preview-device" aria-pressed="false">Inspecionar</button>
  <button type="button" id="preview-close" class="preview-close">Voltar ao editor</button>
</header>` : "";
  res.set("Cache-Control", "no-store").type("html").send(`<!doctype html>
<html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pré-visualização | Autômato</title>
<style>
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden}body{display:flex;flex-direction:column;background:#e8ede9;color:#2e4438;font:14px Arial,sans-serif}
.preview-toolbar{position:relative;z-index:2;display:flex;align-items:center;gap:12px;min-height:62px;padding:10px 16px;background:#fff;border-bottom:1px solid #dce5de;box-shadow:0 2px 8px #18372a12}
#preview-title{margin-right:auto;font-weight:750}.preview-devices{display:flex;gap:4px;padding:3px;border:1px solid #e3ebe5;border-radius:10px;background:#f5f8f6}
.preview-device,.preview-close{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:8px 12px;border:1px solid transparent;border-radius:7px;background:transparent;color:#68766d;font-weight:700;cursor:pointer;white-space:nowrap}
.preview-device.active{color:#245747;background:#e5f0e9;border-color:#dce9df}.preview-close{border-color:#dce5de;background:#fff;color:#365b46}.preview-close:hover{background:#f1f7f2;border-color:#9bb9a4}
.preview-stage{display:flex;flex:1;min-height:0;align-items:center;justify-content:center;overflow:auto;padding:18px;background-color:#e8ede9;background-image:radial-gradient(#cbd6ce 1px,transparent 1px);background-size:16px 16px}
.preview-device-frame{position:relative;flex:none;overflow:hidden;border-radius:8px;background:#fff;box-shadow:0 5px 22px #18372a20}.preview-content{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
@media(max-width:600px){.preview-toolbar{flex-wrap:wrap;gap:8px}.preview-title{flex-basis:100%}.preview-devices{width:100%}.preview-device{flex:1;padding:8px 4px}.preview-close{flex:0 0 auto}}
</style></head><body>${barraPopup}<main id="preview-stage" class="preview-stage"><div id="preview-device-frame" class="preview-device-frame"><iframe id="preview-content" class="preview-content" title="Conteúdo em pré-visualização"
  sandbox="allow-scripts allow-same-origin" allow="autoplay *; encrypted-media *; fullscreen *; picture-in-picture *"></iframe></div></main><script>
  const origemEditor = ${origemSeguraParaScript};
  const modoPopup = ${JSON.stringify(modoPopup)};
  const editorWindow = modoPopup ? window.opener : window.parent;
  const previewContent = document.getElementById("preview-content");
  const stage = document.getElementById("preview-stage");
  const deviceFrame = document.getElementById("preview-device-frame");
  const deviceSizes = { desktop: [1200, 700], tablet: [820, 1180], mobile: [390, 844] };
  let selectedDevice = "desktop";
  let inspectMode = false;
  function sendToEditor(message) {
    if (modoPopup) {
      if (window.opener && !window.opener.closed) window.opener.postMessage(message, origemEditor);
    } else {
      window.parent.postMessage(message, origemEditor);
    }
  }
  function sendInspectMode() {
    previewContent.contentWindow?.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: inspectMode }, window.location.origin);
  }
  function fitDevice() {
    if (!modoPopup) return;
    const [width,height] = deviceSizes[selectedDevice];
    const scale = Math.max(.1, Math.min((stage.clientWidth - 36) / width, (stage.clientHeight - 36) / height));
    deviceFrame.style.width = Math.round(width * scale) + "px";
    deviceFrame.style.height = Math.round(height * scale) + "px";
    previewContent.style.width = width + "px";
    previewContent.style.height = height + "px";
    previewContent.style.transform = "scale(" + scale + ")";
    previewContent.style.transformOrigin = "top left";
  }
  window.addEventListener("message", event => {
    const veioDoEditor = modoPopup
      ? event.source === window.opener && event.origin === origemEditor
      : event.source === window.parent && event.origin === origemEditor;
    if (veioDoEditor) {
      if (event.data?.type === "AUTOMATO_PREVIEW_RENDER" && typeof event.data.document === "string") {
        previewContent.srcdoc = event.data.document;
        if (modoPopup && typeof event.data.title === "string") {
          document.getElementById("preview-title").textContent = "Pré-visualização — " + event.data.title;
        }
      } else if (event.data?.type === "AUTOMATO_INSPECT_MODE") {
        inspectMode = Boolean(event.data.enabled);
        sendInspectMode();
      }
      return;
    }
    if (event.source === previewContent.contentWindow && event.origin === window.location.origin) sendToEditor(event.data);
  });
  document.documentElement.style.cssText = "width:100%;height:100%;margin:0;overflow:hidden";
  document.body.style.cssText = "width:100%;height:100%;margin:0;overflow:hidden;display:flex;flex-direction:column";
  if (modoPopup) {
    window.addEventListener("resize", fitDevice);
    document.querySelectorAll("[data-device]").forEach(button => button.addEventListener("click", () => {
      selectedDevice = button.dataset.device;
      document.querySelectorAll("[data-device]").forEach(item => {
        const active = item === button;
        item.classList.toggle("active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      fitDevice();
    }));
    document.getElementById("preview-inspect").addEventListener("click", event => {
      inspectMode = !inspectMode;
      event.currentTarget.classList.toggle("active", inspectMode);
      event.currentTarget.setAttribute("aria-pressed", String(inspectMode));
      sendInspectMode();
    });
    document.getElementById("preview-close").addEventListener("click", () => window.close());
    if (window.ResizeObserver) new ResizeObserver(fitDevice).observe(stage);
    fitDevice();
  } else {
    stage.style.cssText = "display:block;width:100%;height:100%;min-height:0;overflow:hidden;padding:0";
    deviceFrame.style.cssText = "position:relative;width:100%;height:100%;overflow:hidden;background:#fff";
    previewContent.style.cssText = "display:block;width:100%;height:100%;margin:0;border:0;background:#fff";
  }
  sendToEditor({ type: "AUTOMATO_PREVIEW_READY" });
</script></body></html>`);
});
app.get("/modelo-roteiro-docx", (req, res) => {
  const modelo = path.resolve(__dirname, "Tabelas_Roteiro.docx");
  res.download(modelo, "Tabelas_Roteiro.docx");
});

// Gerenciamento de projetos gerados.
const pastaProjetos = path.resolve(__dirname, "automato", "public");
// O editor pode enviar imagens em data URI. A rota dedicada aceita até 24 MB,
// sem ampliar o limite das demais rotas JSON da aplicação.
app.use("/api/editor-componentes", express.json({ limit: "24mb" }));
app.use(express.json({ limit: "2mb" }));

app.post("/api/editor-componentes/preview", async (req, res) => {
  try {
    const { slug, source } = req.body || {};
    if (typeof source !== "string") {
      return res.status(400).json({ error: "A estrutura do componente não foi informada." });
    }

    const html = await renderizarPreviewComponente(slug, source);
    res.set("Cache-Control", "no-store").json({ html });
  } catch (erro) {
    res.status(422).json({
      error: erro?.message || "Não foi possível gerar a pré-visualização deste componente."
    });
  }
});

function nomeSeguroProjeto(nome) {
  return typeof nome === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(nome) && nome !== "." && nome !== "..";
}
app.get("/visualizar-curso/:sigla", async (req, res) => {
  const sigla = String(req.params.sigla || "").toLowerCase();
  if (!nomeSeguroProjeto(sigla)) return res.status(400).send("Nome de curso inválido.");
  const index = path.resolve(pastaProjetos, sigla, "index.html");
  try {
    const estatisticas = await fs.promises.lstat(index);
    if (!estatisticas.isFile() || estatisticas.isSymbolicLink()) return res.status(404).send("Curso não encontrado.");
  } catch (_) {
    return res.status(404).send("Curso não encontrado.");
  }
  res.set("Cache-Control", "no-store").render("visualizar-curso", {
    sigla,
    urlCurso: `/automato/public/${encodeURIComponent(sigla)}/index.html`
  });
});
function caminhoDentro(base, relativo) {
  if (typeof relativo !== "string" || !relativo || path.isAbsolute(relativo)) throw new Error("Caminho inválido.");
  const alvo = path.resolve(base, relativo);
  if (alvo !== base && !alvo.startsWith(base + path.sep)) throw new Error("Caminho fora da pasta permitida.");
  return alvo;
}
function nomeSeguroArquivoCurso(nome) {
  return typeof nome === "string" && nome.length > 0 && Buffer.byteLength(nome, "utf8") <= 240 &&
    nome !== "." && nome !== ".." && nome.trim() === nome && !nome.startsWith(".") &&
    !/[\\/\x00-\x1f\x7f]/.test(nome);
}
async function localizarPastaArquivosCurso(nomeCurso, criar = false) {
  const curso = path.join(pastaProjetos, nomeCurso);
  let statCurso;
  try { statCurso = await fs.promises.lstat(curso); }
  catch (erro) {
    if (erro.code === "ENOENT") throw Object.assign(new Error("Curso não encontrado."), { status: 404 });
    throw erro;
  }
  if (!statCurso.isDirectory() || statCurso.isSymbolicLink()) throw Object.assign(new Error("Curso inválido."), { status: 400 });

  const pasta = path.join(curso, "arquivos");
  let statPasta;
  try { statPasta = await fs.promises.lstat(pasta); }
  catch (erro) {
    if (erro.code !== "ENOENT") throw erro;
    if (!criar) return null;
    await fs.promises.mkdir(pasta, { recursive: true });
    statPasta = await fs.promises.lstat(pasta);
  }
  if (!statPasta.isDirectory() || statPasta.isSymbolicLink()) throw Object.assign(new Error("A pasta arquivos do curso é inválida."), { status: 400 });

  const [cursoReal, pastaReal] = await Promise.all([fs.promises.realpath(curso), fs.promises.realpath(pasta)]);
  if (!pastaReal.startsWith(cursoReal + path.sep)) throw Object.assign(new Error("Caminho fora do curso."), { status: 400 });
  return pasta;
}
async function copiarDiretorioSeguro(origem, destino) {
  const estatisticas = await fs.promises.lstat(origem);
  if (!estatisticas.isDirectory() || estatisticas.isSymbolicLink()) throw new Error("A pasta do curso é inválida.");
  await fs.promises.mkdir(destino, { recursive: true });
  const itens = await fs.promises.readdir(origem, { withFileTypes: true });
  for (const item of itens) {
    if (item.isSymbolicLink()) continue;
    const origemItem = path.join(origem, item.name);
    const destinoItem = path.join(destino, item.name);
    if (item.isDirectory()) await copiarDiretorioSeguro(origemItem, destinoItem);
    else if (item.isFile()) await fs.promises.copyFile(origemItem, destinoItem);
  }
}
function criarZip(origem, destino) {
  return new Promise((resolve, reject) => {
    const processo = spawn("zip", ["-q", "-r", destino, ".", "-x", "*.DS_Store", "__MACOSX/*"], { cwd: origem });
    let erro = "";
    processo.stderr.on("data", dados => { erro += dados; });
    processo.once("error", reject);
    processo.once("close", codigo => {
      if (codigo === 0) resolve();
      else reject(new Error(erro.trim() || "Não foi possível gerar o arquivo ZIP."));
    });
  });
}
async function arquivosRecursivos(dir, extensoes, limite = 3000) {
  const saida = [];
  async function visitar(atual) {
    if (saida.length >= limite) return;
    let itens = [];
    try { itens = await fs.promises.readdir(atual, { withFileTypes: true }); } catch (_) { return; }
    for (const item of itens) {
      if (saida.length >= limite) break;
      if (item.name.startsWith(".") || item.name === "node_modules") continue;
      const full = path.join(atual, item.name);
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) await visitar(full);
      else if (item.isFile() && extensoes.includes(path.extname(item.name).toLowerCase())) saida.push(full);
    }
  }
  await visitar(dir);
  return saida;
}
app.get("/api/projects", async (req, res) => {
  try {
    const dirs = await fs.promises.readdir(pastaProjetos, { withFileTypes: true });
    const projects = [];
    for (const entry of dirs) {
      if (!entry.isDirectory() || !nomeSeguroProjeto(entry.name) || entry.name === "audios-gerados") continue;
      const dir = path.join(pastaProjetos, entry.name);
      const index = path.join(dir, "index.html");
      if (!fs.existsSync(index)) continue;
      const files = await arquivosRecursivos(dir, [".html", ".css", ".js", ".json"]);
      const html = files.filter(f => f.endsWith(".html"));
      projects.push({ name: entry.name, files: files.length, lessons: html.length, url: `/automato/public/${encodeURIComponent(entry.name)}/index.html` });
    }
    res.set("Cache-Control", "no-store").json({ projects: projects.sort((a, b) => a.name.localeCompare(b.name)) });
  } catch (e) { res.status(500).json({ message: "Não foi possível listar os projetos." }); }
});
app.delete("/api/projects/:name", async (req, res) => {
  const name = req.params.name;
  if (!nomeSeguroProjeto(name) || name === "audios-gerados") return res.status(400).json({ message: "Nome de projeto inválido." });
  const target = path.resolve(pastaProjetos, name);
  if (!target.startsWith(pastaProjetos + path.sep)) return res.status(400).json({ message: "Caminho inválido." });
  try {
    const st = await fs.promises.lstat(target);
    if (!st.isDirectory() || st.isSymbolicLink() || !fs.existsSync(path.join(target, "index.html"))) return res.status(404).json({ message: "Projeto não encontrado." });
    await fs.promises.rm(target, { recursive: true, force: false });
    res.json({ message: "Curso excluído. Nenhuma cópia de segurança foi criada." });
  } catch (e) { console.error("Erro ao excluir projeto:", e); res.status(500).json({ message: "Não foi possível excluir o projeto. Nenhum arquivo fora da pasta de projetos foi alterado." }); }
});
async function localizarWbtJson(root) {
  const candidatos = [
    path.join(root, "scripts", "json", "wbt.json"),
    path.join(root, "fontes", "wbt.json"),
    path.join(root, "wbt.json")
  ];
  for (const candidato of candidatos) {
    try { const st = await fs.promises.lstat(candidato); if (st.isFile() && !st.isSymbolicLink()) return candidato; } catch (_) { }
  }
  const encontrados = await arquivosRecursivos(root, [".json"], 3000);
  for (const arquivo of encontrados) {
    if (path.basename(arquivo).toLowerCase() !== "wbt.json") continue;
    try { JSON.parse(await fs.promises.readFile(arquivo, "utf8")); return arquivo; } catch (_) { }
  }
  return null;
}
async function lerMetadadosWbt(root) {
  const arquivo = await localizarWbtJson(root);
  if (!arquivo) return { wbtPath: null, config: {}, unidades: [] };
  try {
    const wbt = JSON.parse(await fs.promises.readFile(arquivo, "utf8"));
    const unidades = (Array.isArray(wbt.oas) ? wbt.oas : []).slice(1).map((u, index) => ({
      numeroLicao: index + 1,
      nome: String(u.label || u.nome || u.sigla || "Lição sem nome"),
      sigla: String(u.sigla || ""),
      totalTelas: Number(u.numTotalFrames) || (Array.isArray(u.arquivos) ? u.arquivos.reduce((n, a) => n + (Number(a.totalFrames) || 0), 0) : 0)
    }));
    return { wbtPath: arquivo, config: wbt.config || {}, unidades };
  } catch (_) { return { wbtPath: arquivo, config: {}, unidades: [] }; }
}
app.get("/api/projects/:name/lessons", async (req, res) => {
  const name = req.params.name; if (!nomeSeguroProjeto(name)) return res.status(400).json({ message: "Projeto inválido." });
  try {
    const root = path.resolve(pastaProjetos, name), images = path.join(root, "images");
    const meta = await lerMetadadosWbt(root);
    const entries = await fs.promises.readdir(images, { withFileTypes: true }).catch(() => []);
    const lessons = [];
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink() || e.name.toLowerCase() === "biblioteca" || e.name.toLowerCase() === String(meta.config.principal || "").toLowerCase()) continue;
      const folder = path.join(images, e.name), html = await arquivosRecursivos(folder, [".html"], 500);
      if (!html.length) continue;
      const unidade = meta.unidades.find(u => u.sigla.toLowerCase() === e.name.toLowerCase());
      const numeroPasta = (e.name.match(/(\d+)$/) || [])[1];
      const numeroLicao = unidade?.numeroLicao || (numeroPasta ? Number(numeroPasta) : null);
      lessons.push({ path: `images/${e.name}`, numeroLicao, nome: unidade?.nome || e.name, sigla: unidade?.sigla || e.name, count: html.length, totalTelas: unidade?.totalTelas ?? html.length });
    }
    lessons.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    res.json({ lessons, courseName: meta.config.label || name, wbtPath: meta.wbtPath ? path.relative(root, meta.wbtPath).split(path.sep).join("/") : null });
  } catch (e) { res.status(500).json({ message: "Não foi possível listar as lições." }); }
});
app.delete("/api/projects/:name/lessons", async (req, res) => {
  const name = req.params.name, rel = req.body?.path;
  if (!nomeSeguroProjeto(name) || typeof rel !== "string" || !/^images\/[a-zA-Z0-9_-]{1,80}$/.test(rel) || rel.toLowerCase() === "images/biblioteca") return res.status(400).json({ message: "Lição inválida." });
  try {
    const root = path.resolve(pastaProjetos, name), target = caminhoDentro(root, rel);
    const meta = await lerMetadadosWbt(root);
    if (path.basename(rel).toLowerCase() === String(meta.config.principal || "").toLowerCase()) return res.status(400).json({ message: "Lição inválida." });
    const st = await fs.promises.lstat(target);
    if (!st.isDirectory() || st.isSymbolicLink()) return res.status(400).json({ message: "O destino não é uma pasta de lição válida." });
    let unidadeRemovida = false;
    if (meta.wbtPath) {
      const conteudo = await fs.promises.readFile(meta.wbtPath, "utf8");
      const wbt = JSON.parse(conteudo);
      if (Array.isArray(wbt.oas)) {
        const pastaSigla = path.basename(rel).toLowerCase();
        const antes = wbt.oas.length;
        wbt.oas = wbt.oas.filter((u, i) => i === 0 || String(u.sigla || "").toLowerCase() !== pastaSigla);
        unidadeRemovida = wbt.oas.length !== antes;
        if (unidadeRemovida) {
          await fs.promises.writeFile(meta.wbtPath, `${JSON.stringify(wbt, null, 4)}\n`, "utf8");
        }
      }
    }
    await fs.promises.rm(target, { recursive: true });
    res.json({ message: unidadeRemovida ? "Lição excluída e removida do wbt.json." : "Lição excluída. Não foi encontrada uma unidade correspondente no wbt.json." });
  } catch (e) { console.error("Erro ao excluir lição:", e); res.status(404).json({ message: "Não foi possível localizar ou excluir essa lição." }); }
});
// A edição de cores trabalha exclusivamente no bloco :root do CSS centralizado do curso.
app.get("/api/projects/:name/styles", async (req, res) => {
  const name = req.params.name;
  if (!nomeSeguroProjeto(name)) return res.status(400).json({ message: "Projeto inválido." });
  try {
    const root = path.resolve(pastaProjetos, name);
    const cssFile = caminhoDentro(root, "styles/estilos-centralizados.css");
    const realRoot = await fs.promises.realpath(root);
    const realFile = await fs.promises.realpath(cssFile);
    if (!realFile.startsWith(realRoot + path.sep)) return res.status(400).json({ message: "Caminho CSS inválido." });
    const content = await fs.promises.readFile(realFile, "utf8");
    const rootBlock = content.match(/:root\s*\{([\s\S]*?)\}/i);
    if (!rootBlock) return res.status(422).json({ message: "O arquivo não contém um bloco :root." });
    const variables = [];
    const re = /(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^;{}]+\)|hsla?\([^;{}]+\)|[a-zA-Z]+)\s*;/g;
    let match;
    while ((match = re.exec(rootBlock[1])) !== null) {
      const value = match[2].trim();
      if (/^#[0-9a-fA-F]{3,8}$/.test(value) || /^(rgba?|hsla?)\(/i.test(value) || /^(white|black|transparent|red|green|blue|gray|grey|yellow|orange|purple|pink)$/i.test(value)) {
        variables.push({ name: match[1], value });
      }
    }
    res.json({ file: "styles/estilos-centralizados.css", variables });
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).json({ message: "Não foi encontrado styles/estilos-centralizados.css neste curso." });
    res.status(500).json({ message: "Não foi possível ler o CSS centralizado." });
  }
});
app.put("/api/projects/:name/styles", async (req, res) => {
  const name = req.params.name, vars = req.body?.variables;
  if (!nomeSeguroProjeto(name) || !Array.isArray(vars) || vars.length > 300) return res.status(400).json({ message: "Dados de estilo inválidos." });
  try {
    const root = path.resolve(pastaProjetos, name);
    const cssFile = caminhoDentro(root, "styles/estilos-centralizados.css");
    const realRoot = await fs.promises.realpath(root);
    const realFile = await fs.promises.realpath(cssFile);
    if (!realFile.startsWith(realRoot + path.sep)) return res.status(400).json({ message: "Caminho CSS inválido." });
    let content = await fs.promises.readFile(realFile, "utf8");
    const rootBlock = content.match(/:root\s*\{([\s\S]*?)\}/i);
    if (!rootBlock) return res.status(422).json({ message: "O arquivo não contém um bloco :root." });
    let rootContent = rootBlock[1];
    for (const v of vars) {
      if (!v || !/^--[\w-]+$/.test(v.name) || typeof v.value !== "string" || !/^(#[0-9a-fA-F]{3,8}|rgba?\([^;{}]+\)|hsla?\([^;{}]+\)|[a-zA-Z]+)$/.test(v.value)) continue;
      const escaped = v.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const declaration = new RegExp(`(${escaped}\\s*:\\s*)[^;]+(;?)`, "g");
      rootContent = rootContent.replace(declaration, `$1${v.value}$2`);
    }
    const updated = content.replace(rootBlock[0], rootBlock[0].replace(rootBlock[1], rootContent));
    if (updated === content) return res.status(400).json({ message: "Nenhuma cor foi alterada." });
    await fs.promises.writeFile(realFile, updated, "utf8");
    res.json({ message: "Cores salvas em styles/estilos-centralizados.css." });
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).json({ message: "Não foi encontrado styles/estilos-centralizados.css neste curso." });
    res.status(500).json({ message: "Não foi possível salvar as cores." });
  }
});
app.post("/api/projects/:name/publish", async (req, res) => {
  const name = req.params.name;
  const temaId = req.body?.layout;
  const tema = temasPublicacao[temaId];
  if (!nomeSeguroProjeto(name) || !tema) return res.status(400).json({ message: "Dados de publicação inválidos." });

  let pastaTemporaria;
  try {
    const root = path.resolve(pastaProjetos, name);
    const estatisticas = await fs.promises.lstat(root);
    if (!estatisticas.isDirectory() || estatisticas.isSymbolicLink() || !fs.existsSync(path.join(root, "index.html"))) {
      return res.status(404).json({ message: "Curso não encontrado." });
    }

    pastaTemporaria = await fs.promises.mkdtemp(path.join(pastaUploads, "publicacao-"));
    const cursoPublicado = path.join(pastaTemporaria, "curso");
    await copiarDiretorioSeguro(root, cursoPublicado);
    const indexPublicado = path.join(cursoPublicado, "index.html");
    const htmlPublicado = await fs.promises.readFile(indexPublicado, "utf8");
    const htmlSemAtualizacao = removerAtualizacaoGlobal(htmlPublicado);
    if (htmlSemAtualizacao !== htmlPublicado) {
      await fs.promises.writeFile(indexPublicado, htmlSemAtualizacao, "utf8");
    }

    const configPath = path.join(cursoPublicado, "config.json");
    let config;
    try { config = JSON.parse(await fs.promises.readFile(configPath, "utf8")); }
    catch (_) {
      const erroConfig = new Error("O curso não possui um config.json válido para ativar a comunicação com o Avant.");
      erroConfig.status = 422;
      throw erroConfig;
    }
    config.avant = true;
    await fs.promises.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    const cssPath = path.join(cursoPublicado, "styles", "estilos-centralizados.css");
    let css;
    try { css = await fs.promises.readFile(cssPath, "utf8"); }
    catch (_) {
      const erroCss = new Error("O curso não possui styles/estilos-centralizados.css para aplicar a paleta de cores.");
      erroCss.status = 422;
      throw erroCss;
    }
    await fs.promises.writeFile(cssPath, aplicarTemaDeCores(css, tema.variaveis), "utf8");

    const wbtPath = await localizarWbtJson(cursoPublicado);
    if (wbtPath) {
      try {
        const wbt = JSON.parse(await fs.promises.readFile(wbtPath, "utf8"));
        if (wbt.config && typeof wbt.config === "object") {
          wbt.config.corNavegacao = tema.variaveis["--cor-principal"];
          wbt.config.corTopico = tema.variaveis["--cor-fundo-identidade"];
          wbt.config.corFundo = tema.variaveis["--cor-fundo"];
          await fs.promises.writeFile(wbtPath, `${JSON.stringify(wbt, null, 2)}\n`, "utf8");
        }
      } catch (erro) {
        console.warn("Não foi possível sincronizar as cores no wbt.json da publicação:", erro.message);
      }
    }

    await fs.promises.writeFile(path.join(cursoPublicado, "publicacao-discent.json"), `${JSON.stringify({
      plataforma: "Discent",
      comunicacaoAvant: true,
      tema: { id: temaId, nome: tema.nome },
      geradoEm: new Date().toISOString()
    }, null, 2)}\n`, "utf8");

    const arquivoZip = path.join(pastaTemporaria, `${name}-discent-${temaId}.zip`);
    await criarZip(cursoPublicado, arquivoZip);
    return res.download(arquivoZip, `${name}-discent-${temaId}.zip`, erro => {
      fs.promises.rm(pastaTemporaria, { recursive: true, force: true }).catch(() => { });
      if (erro && !res.headersSent) res.status(500).json({ message: "Não foi possível enviar o arquivo ZIP." });
    });
  } catch (erro) {
    if (pastaTemporaria) fs.promises.rm(pastaTemporaria, { recursive: true, force: true }).catch(() => { });
    console.error("Erro ao publicar curso:", erro);
    return res.status(erro.status || 500).json({ message: erro.status ? erro.message : "Não foi possível gerar o pacote de publicação." });
  }
});
app.get("/api/projects/:name/files", async (req, res) => { const name = req.params.name; if (!nomeSeguroProjeto(name)) return res.status(400).json({ message: "Projeto inválido." }); try { const root = path.resolve(pastaProjetos, name), files = await arquivosRecursivos(root, [".html", ".css", ".js"], 800); res.set("Cache-Control", "no-store").json({ files: files.map(f => ({ path: path.relative(root, f).split(path.sep).join("/") })) }); } catch (e) { res.status(500).json({ message: "Não foi possível listar os arquivos." }); } });
app.get("/api/projects/:name/assets", async (req, res) => {
  const name = req.params.name;
  if (!nomeSeguroProjeto(name)) return res.status(400).json({ message: "Projeto inválido." });
  try {
    const pasta = await localizarPastaArquivosCurso(name);
    if (!pasta) return res.set("Cache-Control", "no-store").json({ files: [] });
    const itens = await fs.promises.readdir(pasta, { withFileTypes: true });
    const files = [];
    for (const item of itens) {
      if (item.name.startsWith(".") || !item.isFile() || item.isSymbolicLink()) continue;
      const target = path.join(pasta, item.name);
      const stat = await fs.promises.lstat(target);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      files.push({
        name: item.name,
        extension: path.extname(item.name).slice(1).toUpperCase(),
        size: stat.size,
        modifiedAt: stat.mtime.toISOString()
      });
    }
    files.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true, sensitivity: "base" }));
    return res.set("Cache-Control", "no-store").json({ files });
  } catch (erro) {
    return res.status(erro.status || 500).json({ message: erro.status ? erro.message : "Não foi possível listar os arquivos do curso." });
  }
});
app.post("/api/projects/:name/assets", (req, res) => {
  const name = req.params.name;
  if (!nomeSeguroProjeto(name)) return res.status(400).json({ message: "Projeto inválido." });
  uploadArquivoCurso.single("file")(req, res, async erroUpload => {
    if (erroUpload) {
      const status = erroUpload.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message = status === 413 ? "O arquivo excede o limite de 500 MB." : "Não foi possível receber o arquivo.";
      return res.status(status).json({ message });
    }
    if (!req.file) return res.status(400).json({ message: "Selecione um arquivo para enviar." });

    let temporario = req.file.path;
    try {
      const filename = String(req.file.originalname || "").trim().replace(/\s+/gu, "-");
      if (!nomeSeguroArquivoCurso(filename)) return res.status(400).json({ message: "O nome do arquivo contém caracteres inválidos ou é muito longo." });
      const pasta = await localizarPastaArquivosCurso(name, true);
      const destino = path.join(pasta, filename);
      let existe = false;
      try {
        const stat = await fs.promises.lstat(destino);
        if (!stat.isFile() || stat.isSymbolicLink()) return res.status(400).json({ message: "Já existe um item incompatível com esse nome." });
        existe = true;
      } catch (erro) {
        if (erro.code !== "ENOENT") throw erro;
      }

      const substituir = req.query.replace === "1";
      if (existe && !substituir) return res.status(409).json({ exists: true, message: `Já existe um arquivo chamado “${filename}”.` });
      if (substituir) {
        await fs.promises.rename(temporario, destino);
        temporario = null;
      } else {
        try {
          await fs.promises.copyFile(temporario, destino, fs.constants.COPYFILE_EXCL);
        } catch (erro) {
          if (erro.code === "EEXIST") return res.status(409).json({ exists: true, message: `Já existe um arquivo chamado “${filename}”.` });
          throw erro;
        }
        await fs.promises.unlink(temporario);
        temporario = null;
      }
      const statFinal = await fs.promises.stat(destino);
      return res.json({
        message: existe ? `Arquivo substituído como “${filename}”.` : `Arquivo enviado como “${filename}”.`,
        file: { name: filename, extension: path.extname(filename).slice(1).toUpperCase(), size: statFinal.size }
      });
    } catch (erro) {
      console.error("Erro ao salvar arquivo do curso:", erro);
      return res.status(erro.status || 500).json({ message: erro.status ? erro.message : "Não foi possível salvar o arquivo no curso." });
    } finally {
      if (temporario) await fs.promises.unlink(temporario).catch(() => {});
    }
  });
});
app.delete("/api/projects/:name/assets/:fileName", async (req, res) => {
  const name = req.params.name;
  const filename = req.params.fileName;
  if (!nomeSeguroProjeto(name)) return res.status(400).json({ message: "Projeto inválido." });
  if (!nomeSeguroArquivoCurso(filename)) return res.status(400).json({ message: "Nome de arquivo inválido." });
  try {
    const pasta = await localizarPastaArquivosCurso(name);
    if (!pasta) return res.status(404).json({ message: "Arquivo não encontrado." });
    const target = path.join(pasta, filename);
    const stat = await fs.promises.lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink()) return res.status(404).json({ message: "Arquivo não encontrado." });
    await fs.promises.unlink(target);
    return res.json({ message: "Arquivo excluído." });
  } catch (erro) {
    return res.status(erro.status || (erro.code === "ENOENT" ? 404 : 500)).json({
      message: erro.status ? erro.message : erro.code === "ENOENT" ? "Arquivo não encontrado." : "Não foi possível excluir o arquivo."
    });
  }
});
app.get("/api/projects/:name/file", async (req, res) => { const name = req.params.name, rel = req.query.path; if (!nomeSeguroProjeto(name)) return res.status(400).json({ message: "Projeto inválido." }); try { const root = path.resolve(pastaProjetos, name), target = caminhoDentro(root, rel); const realRoot = await fs.promises.realpath(root), realTarget = await fs.promises.realpath(target); if (!realTarget.startsWith(realRoot + path.sep)) return res.status(400).json({ message: "Caminho fora do projeto." }); if (![".html", ".css", ".js"].includes(path.extname(target).toLowerCase())) return res.status(400).json({ message: "Tipo de arquivo não permitido." }); const st = await fs.promises.lstat(target); if (!st.isFile() || st.isSymbolicLink() || st.size > 1024 * 1024) return res.status(400).json({ message: "Arquivo inválido ou maior que 1 MB." }); res.json({ path: rel, content: await fs.promises.readFile(target, "utf8") }); } catch (e) { res.status(404).json({ message: "Arquivo não encontrado ou caminho inválido." }); } });
app.put("/api/projects/:name/file", async (req, res) => { const name = req.params.name, { path: rel, content } = req.body || {}; if (!nomeSeguroProjeto(name) || typeof content !== "string" || Buffer.byteLength(content, "utf8") > 1024 * 1024) return res.status(400).json({ message: "Conteúdo inválido ou maior que 1 MB." }); try { const root = path.resolve(pastaProjetos, name), target = caminhoDentro(root, rel); const realRoot = await fs.promises.realpath(root), realTarget = await fs.promises.realpath(target); if (!realTarget.startsWith(realRoot + path.sep)) return res.status(400).json({ message: "Caminho fora do projeto." }); if (![".html", ".css", ".js"].includes(path.extname(target).toLowerCase())) return res.status(400).json({ message: "Tipo de arquivo não permitido." }); const st = await fs.promises.lstat(target); if (!st.isFile() || st.isSymbolicLink()) return res.status(400).json({ message: "Arquivo inválido." }); await fs.promises.writeFile(target, content, "utf8"); res.json({ message: "Arquivo salvo." }); } catch (e) { res.status(404).json({ message: "Não foi possível salvar o arquivo." }); } });
// Sonorização: o navegador sintetiza os áudios com Piper e envia somente os MP3 prontos.
// Além do áudio principal (exe01001.mp3), aceita os identificadores
// dos componentes e janelas (exe01001botoes_a.mp3,
// exe01001mininavegacao_a_botoes_a.mp3 etc.).
function nomeAudioValido(lessonKey, nome) {
  const chaveEscapada = lessonKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${chaveEscapada}\\d{3}[a-z0-9_]*\\.mp3$`, "i").test(nome);
}

app.get("/api/projects/:name/audio-manifest/:lessonKey", async (req, res) => {
  const name = req.params.name;
  const lessonKey = req.params.lessonKey;
  if (!nomeSeguroProjeto(name) || !/^[a-z0-9_-]{1,70}\d{2}$/i.test(lessonKey)) {
    return res.status(400).json({ message: "Curso ou identificação da lição inválida." });
  }
  try {
    const root = path.resolve(pastaProjetos, name);
    const audioJson = caminhoDentro(root, "som/sonorizacao.json");
    const realRoot = await fs.promises.realpath(root);
    const realJson = await fs.promises.realpath(audioJson);
    if (!realJson.startsWith(realRoot + path.sep)) return res.status(400).json({ message: "Caminho inválido." });
    const documento = JSON.parse(await fs.promises.readFile(realJson, "utf8"));
    const audios = documento?.audios?.[lessonKey];
    if (!Array.isArray(audios) || !audios.length) {
      return res.status(404).json({ message: `Não há áudios cadastrados para ${lessonKey} em som/sonorizacao.json.` });
    }
    const validos = audios.map(item => {
      const nome = String(item?.nome || "");
      const texto = String(item?.texto || "").trim();
      if (!nomeAudioValido(lessonKey, nome) || !texto) {
        throw new Error(`Registro inválido no sonorizacao.json: ${nome || "(sem nome)"}.`);
      }
      return { nome, texto };
    });
    res.set("Cache-Control", "no-store").json({ lessonKey, audios: validos });
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).json({ message: "O arquivo som/sonorizacao.json não foi encontrado." });
    if (e instanceof SyntaxError) return res.status(400).json({ message: "O arquivo som/sonorizacao.json contém JSON inválido." });
    res.status(400).json({ message: e.message || "Não foi possível ler a lista de áudios." });
  }
});

app.post("/api/projects/:name/audio/:lessonKey/:fileName",
  express.raw({ type: "audio/mpeg", limit: "25mb" }),
  async (req, res) => {
    const name = req.params.name;
    const lessonKey = req.params.lessonKey;
    const fileName = req.params.fileName;
    if (!nomeSeguroProjeto(name) || !/^[a-z0-9_-]{1,70}\d{2}$/i.test(lessonKey) ||
      !nomeAudioValido(lessonKey, fileName) ||
      !Buffer.isBuffer(req.body) || req.body.length < 100) {
      return res.status(400).json({ message: "Arquivo de áudio ou destino inválido." });
    }
    try {
      const root = path.resolve(pastaProjetos, name);
      const targetDir = caminhoDentro(root, path.join("som", lessonKey));
      await fs.promises.mkdir(targetDir, { recursive: true });
      const realRoot = await fs.promises.realpath(root);
      const realDir = await fs.promises.realpath(targetDir);
      if (!realDir.startsWith(realRoot + path.sep)) return res.status(400).json({ message: "Destino fora da pasta do curso." });
      const target = path.join(realDir, fileName);
      await fs.promises.writeFile(target, req.body);
      res.json({ success: true, file: `som/${lessonKey}/${fileName}`, bytes: req.body.length });
    } catch (e) {
      console.error("Erro ao salvar áudio:", e);
      res.status(500).json({ message: "Não foi possível salvar o MP3 no curso." });
    }
  });

// A síntese ocorre no navegador nesta primeira etapa. A VPS recebe e grava os MP3.


// Baixa um DOCX de um link compartilhado do OneDrive.
// Por segurança, aceita somente hosts Microsoft/OneDrive e limita tamanho/redirecionamentos.
function baixarDocxDoOneDrive(link, destino) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(link);
    } catch (_) {
      return reject(new Error("Informe um link válido do OneDrive."));
    }

    const hostsPermitidos = ["onedrive.live.com", "1drv.ms", "sharepoint.com", "www.sharepoint.com"];
    const hostPermitido = host => hostsPermitidos.some(hostBase => host === hostBase || host.endsWith("." + hostBase));
    if (url.protocol !== "https:" || !hostPermitido(url.hostname)) {
      return reject(new Error("O link precisa ser um endereço HTTPS válido do OneDrive ou SharePoint."));
    }

    // O parâmetro download=1 solicita o arquivo em vez da página de visualização.
    url.searchParams.set("download", "1");

    const baixar = (urlAtual, redirecionamentos = 0) => {
      if (redirecionamentos > 5) return reject(new Error("O link do documento redirecionou muitas vezes."));
      if (!hostPermitido(urlAtual.hostname) || urlAtual.protocol !== "https:") {
        return reject(new Error("O link redirecionou para um endereço não permitido."));
      }

      const requisicao = https.get(urlAtual, { headers: { "User-Agent": "Mozilla/5.0 Automato/1.0" } }, resposta => {
        if ([301, 302, 303, 307, 308].includes(resposta.statusCode)) {
          const localizacao = resposta.headers.location;
          resposta.resume();
          if (!localizacao) return reject(new Error("O OneDrive retornou um redirecionamento inválido."));
          return baixar(new URL(localizacao, urlAtual), redirecionamentos + 1);
        }

        if (resposta.statusCode !== 200) {
          resposta.resume();
          return reject(new Error("Não foi possível baixar o documento. Verifique se o link está acessível e permite visualização ou download."));
        }

        const tipo = String(resposta.headers["content-type"] || "").toLowerCase();
        const tamanhoDeclarado = Number(resposta.headers["content-length"] || 0);
        const limite = 50 * 1024 * 1024;
        if (tamanhoDeclarado > limite) {
          resposta.resume();
          return reject(new Error("O documento ultrapassa o limite de 50 MB."));
        }

        let bytes = 0;
        let primeirosBytes = Buffer.alloc(0);
        const arquivo = fs.createWriteStream(destino);
        resposta.on("data", bloco => {
          bytes += bloco.length;
          if (primeirosBytes.length < 4) primeirosBytes = Buffer.concat([primeirosBytes, bloco]).subarray(0, 4);
          if (bytes > limite) {
            requisicao.destroy(new Error("O documento ultrapassa o limite de 50 MB."));
            resposta.destroy();
            arquivo.destroy();
          }
        });
        resposta.on("error", erro => arquivo.destroy(erro));
        arquivo.on("error", erro => reject(erro));
        arquivo.on("finish", () => {
          // DOCX é um arquivo ZIP e normalmente começa com a assinatura PK.
          if (primeirosBytes.length < 2 || primeirosBytes[0] !== 0x50 || primeirosBytes[1] !== 0x4b || tipo.includes("text/html")) {
            fs.promises.unlink(destino).catch(() => { });
            return reject(new Error("O link não retornou um arquivo DOCX. Verifique as permissões de compartilhamento do OneDrive e use o link do arquivo, não o link de uma página de visualização restrita."));
          }
          resolve(destino);
        });
        resposta.pipe(arquivo);
      });
      requisicao.setTimeout(30000, () => requisicao.destroy(new Error("Tempo limite ao baixar o documento do OneDrive.")));
      requisicao.on("error", erro => {
        fs.promises.unlink(destino).catch(() => { });
        reject(erro);
      });
    };

    baixar(url);
  });
}

// Consulta o progresso do envio e da geração da lição.
app.get("/progresso/:progressId", (req, res) => {
  const dados = progressoProcessamentos.get(req.params.progressId);

  // Durante o início do upload, o processamento pode ainda não ter sido registrado.
  // Retornar um estado inicial evita 404 enquanto a requisição POST está chegando.
  res.set("Cache-Control", "no-store");
  return res.json(dados || {
    etapa: "Aguardando recebimento dos arquivos",
    percentual: 0,
    concluido: false
  });
});

// Rota POST: recebe um DOCX local ou baixa o documento a partir de um link do OneDrive.
app.post("/upload", (req, res) => {
  // O ID vem também na URL para ser registrado antes de o Multer receber os arquivos.
  let progressId = String(req.query.progressId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
  if (progressId) {
    progressoProcessamentos.set(progressId, {
      etapa: "Recebendo arquivos",
      percentual: 0,
      concluido: false,
      atualizadoEm: Date.now()
    });
  }

  upload.array("arquivos", 20)(req, res, async (erroUpload) => {
    if (erroUpload) {
      console.error("server.js - Erro no upload:", erroUpload);
      const mensagem = erroUpload.code === "LIMIT_FILE_SIZE"
        ? "O arquivo ultrapassa o limite de 50 MB."
        : (erroUpload.publicMessage || erroUpload.message || "Não foi possível receber o arquivo.");
      return res.status(400).json({
        success: false,
        message: "Não foi possível enviar o arquivo.",
        errors: [{ etapa: "upload", message: mensagem }]
      });
    }

    // Compatibilidade com clientes antigos que ainda enviam o ID apenas no FormData.
    if (!progressId) {
      progressId = String(req.body?.progressId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
    }
    const modeloSelecionado = String(req.body?.modelo || "modelo1");
    const paletaSelecionada = String(req.body?.paleta || "azul");
    const atualizarProgresso = dados => {
      if (!progressId) return;
      const anterior = progressoProcessamentos.get(progressId);
      const percentualNovo = Number(dados.percentual) || 0;
      // O percentual nunca volta para trás, mesmo ao iniciar o próximo arquivo do lote.
      const percentualSeguro = anterior && !dados.concluido
        ? Math.max(Number(anterior.percentual) || 0, percentualNovo)
        : percentualNovo;
      progressoProcessamentos.set(progressId, {
        ...dados,
        percentual: percentualSeguro,
        atualizadoEm: Date.now()
      });
    };
    atualizarProgresso({
      etapa: "Upload concluído. Preparando os documentos...",
      percentual: 0,
      fase: "processamento",
      concluido: false
    });

    let caminhoDocumento = null;
    let arquivoTemporario = false;
    const arquivosEnviados = Array.isArray(req.files) ? req.files : [];

    try {
      const documentUrl = String(req.body?.documentUrl || "").trim();
      if (arquivosEnviados.length && documentUrl) {
        return res.status(400).json({
          success: false,
          message: "Escolha apenas uma forma de envio.",
          errors: [{ etapa: "validação", message: "Envie um arquivo ou informe um link, não os dois ao mesmo tempo." }]
        });
      }

      if (!arquivosEnviados.length && documentUrl) {
        atualizarProgresso({ etapa: "Baixando documento do OneDrive", percentual: 2, concluido: false });
        caminhoDocumento = path.join(pastaUploads, `onedrive-${Date.now()}-${Math.random().toString(16).slice(2)}.docx`);
        await baixarDocxDoOneDrive(documentUrl, caminhoDocumento);
        arquivoTemporario = true;
      }

      if (!arquivosEnviados.length && !documentUrl) {
        return res.status(400).json({
          success: false,
          message: "Nenhum documento informado.",
          errors: [{ etapa: "validação", message: "Selecione um arquivo DOCX ou informe um link compartilhado do OneDrive." }]
        });
      }

      // O link remoto continua aceitando um único documento. Para arquivos locais,
      // identificar o número da lição pelo cabeçalho e ordenar numericamente antes de gerar.
      if (!arquivosEnviados.length && caminhoDocumento) {
        arquivosEnviados.push({ path: caminhoDocumento, originalname: path.basename(caminhoDocumento) });
      }

      async function identificarNumeroLicao(arquivo) {
        try {
          const html = await CarregarArquivoDOCX(arquivo.path, path.resolve(__dirname, "automato", "public"));
          const tabelas = Array.from(parse(html).children).filter(el => el.tagName === "TABLE");
          if (tabelas.length) {
            const metadados = CriarCabecalho(tabelas[0]);
            if (Number.isFinite(Number(metadados?.numeroLicao))) return Number(metadados.numeroLicao);
          }
        } catch (erro) {
          console.warn(`Não foi possível identificar o número da lição em ${arquivo.originalname}:`, erro.message);
        }
        const encontrado = String(arquivo.originalname || "").match(/(?:li[cç][aã]o|lic|l)[ _.-]*(\d+)/i) || String(arquivo.originalname || "").match(/\b(\d+)\b/);
        return encontrado ? Number(encontrado[1]) : Number.MAX_SAFE_INTEGER;
      }

      // Fase 2: identificar os números das lições em sequência, sem executar conversões em paralelo.
      const ordenados = [];
      for (let indice = 0; indice < arquivosEnviados.length; indice++) {
        const arquivo = arquivosEnviados[indice];
        const percentualIdentificacao = Math.round(((indice + 1) / Math.max(1, arquivosEnviados.length)) * 20);
        atualizarProgresso({
          etapa: `Processando arquivo ${indice + 1} de ${arquivosEnviados.length}: identificando a lição...`,
          percentual: percentualIdentificacao,
          fase: "processamento",
          concluido: false
        });
        ordenados.push({
          arquivo,
          indice,
          numeroLicao: await identificarNumeroLicao(arquivo)
        });
      }
      ordenados.sort((a, b) => a.numeroLicao - b.numeroLicao || a.indice - b.indice);

      const resultados = [];
      for (let i = 0; i < ordenados.length; i++) {
        const item = ordenados[i];
        // A criação das lições ocupa a faixa 20–95% do processamento (após o upload).
        const percentualBase = 20 + Math.round((i / Math.max(1, ordenados.length)) * 75);
        const numeroExibido = item.numeroLicao === Number.MAX_SAFE_INTEGER ? (i + 1) : item.numeroLicao;
        atualizarProgresso({
          etapa: `Processando o arquivo da lição ${numeroExibido} (${i + 1} de ${ordenados.length})...`,
          percentual: percentualBase,
          fase: "processamento",
          concluido: false
        });
        try {
          const resultado = await executar(item.arquivo.path, dados => {
            const percentualLocal = Math.max(0, Math.min(100, Number(dados.percentual) || 0));
            atualizarProgresso({
              ...dados,
              etapa: `${dados.etapa || "Processando arquivo"} — lição ${numeroExibido} (${i + 1} de ${ordenados.length})`,
              percentual: Math.min(95, percentualBase + Math.round((percentualLocal / 100) * (75 / Math.max(1, ordenados.length)))),
              fase: dados.fase || "processamento",
              concluido: false
            });
          }, modeloSelecionado, paletaSelecionada);
          resultados.push({
            success: true,
            nomeArquivo: item.arquivo.originalname || path.basename(item.arquivo.path),
            numeroLicao: resultado?.metadados?.numeroLicao || (item.numeroLicao === Number.MAX_SAFE_INTEGER ? null : item.numeroLicao),
            titulo: resultado?.metadados?.titulo,
            metadados: resultado?.metadados,
            outputUrl: nomeSeguroProjeto(String(resultado?.metadados?.sigla || "").trim().toLowerCase())
              ? `/visualizar-curso/${encodeURIComponent(String(resultado.metadados.sigla).trim().toLowerCase())}`
              : (resultado?.outputUrl || `/automato/public/${String(resultado?.metadados?.sigla || "").trim().toLowerCase()}/index.html`)
          });
        } catch (erro) {
          console.error(`Falha ao gerar ${item.arquivo.originalname}:`, erro);
          resultados.push({
            success: false,
            nomeArquivo: item.arquivo.originalname || path.basename(item.arquivo.path),
            numeroLicao: item.numeroLicao === Number.MAX_SAFE_INTEGER ? null : item.numeroLicao,
            message: erro.publicMessage || `Ocorreu um problema durante ${erro.etapa || "o processamento do documento"}.`,
            detalhe: erro.detalhe || (erro.message !== erro.publicMessage ? erro.message : ""),
            etapa: erro.etapa || "processamento do documento",
            origem: erro.origem || null
          });
        }
      }

      const sucessos = resultados.filter(item => item.success);
      atualizarProgresso({
        etapa: "Criação das lições concluída.",
        percentual: 100,
        fase: "concluido",
        concluido: true,
        success: sucessos.length > 0
      });
      if (!sucessos.length) {
        return res.status(500).json({
          success: false,
          message: "Nenhuma lição foi gerada com sucesso.",
          resultados,
          errors: resultados.map(item => ({
            arquivo: item.nomeArquivo,
            etapa: item.etapa,
            message: item.message,
            detalhe: item.detalhe,
            origem: item.origem
          }))
        });
      }
      const ultima = sucessos[sucessos.length - 1];
      return res.status(200).json({
        success: true,
        totalDocumentos: ordenados.length,
        message: `Processamento concluído: ${sucessos.length} de ${ordenados.length} lição(ões) gerada(s), em ordem numérica.`,
        resultados,
        outputUrl: ultima.outputUrl,
        metadados: ultima.metadados
      });
    } catch (erro) {
      console.error("server.js - Falha no processamento:", erro);
      atualizarProgresso({ etapa: erro.etapa || "Falha no processamento", percentual: 100, concluido: true, success: false, message: erro.publicMessage || erro.message });
      const erroDeLink = Boolean(req.body?.documentUrl) && !arquivosEnviados.length;
      return res.status(erroDeLink ? 400 : 500).json({
        success: false,
        message: erroDeLink ? "Não foi possível obter o documento do link informado." : "Não foi possível processar o documento.",
        errors: [{
          etapa: erroDeLink ? "download do OneDrive" : (erro.etapa || "processamento do documento"),
          message: erro.publicMessage || (erroDeLink ? erro.message : "Ocorreu um erro inesperado."),
          detalhe: erro.detalhe || "",
          origem: erro.origem || null
        }]
      });
    } finally {
      // Remove os arquivos temporários após o processamento, sem mascarar o resultado principal.
      if (progressId) {
        // Mantém o estado final por alguns minutos para a interface poder exibi-lo.
        setTimeout(() => progressoProcessamentos.delete(progressId), 5 * 60 * 1000).unref?.();
      }
      for (const arquivoTemp of [...arquivosEnviados.map(arquivo => arquivo.path), arquivoTemporario ? caminhoDocumento : null].filter(Boolean)) {
        fs.promises.unlink(arquivoTemp).catch(erro => {
          console.warn("server.js - Não foi possível remover o arquivo temporário:", erro.message);
        });
      }
    }
  });
});

// Tratamento de erros inesperados do Express.
app.use((erro, req, res, next) => {
  console.error("server.js - Erro inesperado no servidor:", erro);
  if (res.headersSent) return next(erro);
  res.status(500).json({
    success: false,
    message: "Ocorreu um erro interno no servidor.",
    errors: [{ etapa: "servidor", message: "Tente novamente. Se o problema continuar, consulte o responsável pelo sistema." }]
  });
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
