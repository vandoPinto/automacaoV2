const { executar } = require("./automato/main.js");
const { CarregarArquivoDOCX } = require("./automato/scripts/CarregarArquivoDOCX");
const { CriarCabecalho } = require("./automato/scripts/CriarCabecalho");
const { parse } = require("node-html-parser");

// Importar módulos
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const https = require("https");

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

// Dados mock mantidos para compatibilidade com a página atual.
let haikus = [];
try {
  haikus = require("./haikus.json");
} catch (erro) {
  console.warn("server.js - O arquivo haikus.json não foi carregado:", erro.message);
}

// Porta
const port = process.env.PORT || 3000;

// Servir arquivos estáticos
app.use("/assets", express.static(path.resolve(__dirname, "assets")));
app.use("/output", express.static(path.resolve(__dirname, "./output")));
app.use("/automato", express.static(path.resolve(__dirname, "./automato")));

// View engine
app.set("view engine", "ejs");

// Rota GET
app.get("/", (req, res) => {
  res.render("index", { haikus });
});

// Gerenciador em uma página própria, sem modal. O link da página inicial abre esta rota em nova aba.
app.get("/gerenciar", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.render("gerenciar", { haikus });
});

// Biblioteca de componentes e exemplos de preenchimento do roteiro.
const componentesBiblioteca = [
  { slug: 'abas', nome: 'Abas', descricao: 'Organiza conteúdos relacionados em guias selecionáveis, permitindo alternar entre diferentes painéis de informação.', icone: 'bi-layout-three-columns' },
  { slug: 'apresentacao', nome: 'Apresentação', descricao: 'Tela de apresentação da lição, utilizada para introduzir o conteúdo e contextualizar o tema.', icone: 'bi-easel2' },
  { slug: 'audio', nome: 'Áudio', descricao: 'Apresenta conteúdo de áudio associado ao texto e/ou às imagens incluídas no componente.', icone: 'bi-volume-up' },
  { slug: 'botao', nome: 'Botão', descricao: 'Cria botões interativos que abrem janelas com textos ou imagens. Pode conter vários botões e janelas.', icone: 'bi-hand-index-thumb' },
  { slug: 'botaotela', nome: 'Botão de tela', descricao: 'Apresenta conteúdo em formato de botão/tela, podendo reunir texto e imagens.', icone: 'bi-window' },
  { slug: 'capitulo', nome: 'Capítulo', descricao: 'Marca a abertura ou identificação de um capítulo dentro da sequência da aula.', icone: 'bi-bookmark' },
  { slug: 'exercitando', nome: 'Exercitando', descricao: 'Apresenta uma atividade de exercício para estimular a aplicação ou a verificação do conteúdo estudado.', icone: 'bi-pencil-square' },
  { slug: 'fechamento', nome: 'Fechamento', descricao: 'Tela de encerramento da lição, utilizada para retomar ou concluir o conteúdo.', icone: 'bi-flag' },
  { slug: 'flashcard', nome: 'Flashcard', descricao: 'Apresenta cartões interativos com frente e verso, permitindo revelar informações complementares.', icone: 'bi-card-text' },
  { slug: 'hotword', nome: 'Hotword', descricao: 'Destaca uma palavra ou expressão no texto e associa a ela uma janela com explicação complementar.', icone: 'bi-highlighter' },
  { slug: 'importante', nome: 'Importante', descricao: 'Destaca uma informação que merece atenção especial durante a leitura.', icone: 'bi-exclamation-triangle' },
  { slug: 'introducao', nome: 'Introdução', descricao: 'Apresenta o tema e prepara o estudante para o conteúdo da lição.', icone: 'bi-door-open' },
  { slug: 'mininavegacao', nome: 'Mini navegação', descricao: 'Cria uma navegação auxiliar para orientar o estudante entre partes ou etapas do conteúdo.', icone: 'bi-signpost-split' },
  { slug: 'objetivos', nome: 'Objetivos', descricao: 'Apresenta os objetivos de aprendizagem que orientam a lição.', icone: 'bi-bullseye' },
  { slug: 'saibamais', nome: 'Saiba mais', descricao: 'Oferece informações ou referências complementares para aprofundar o assunto.', icone: 'bi-lightbulb' },
  { slug: 'texto', nome: 'Texto', descricao: 'Exibe conteúdo textual da lição, preservando a estrutura e a formatação do documento.', icone: 'bi-text-paragraph' },
  { slug: 'textocomimagem', nome: 'Texto com imagem', descricao: 'Combina texto e imagens em uma mesma apresentação de conteúdo.', icone: 'bi-card-image' }
];
const exemplosBiblioteca = {
  abas: "<ABAS>\\n<aba>\\nTítulo da primeira aba\\nConteúdo da primeira aba.\\n</aba>\\n<aba>\\nTítulo da segunda aba\\nConteúdo da segunda aba.\\n</aba>\\n</componente>",
  apresentacao: "<apresentacao>\\nDigite aqui o texto de apresentação da lição.\\n</abas>",
  audio: "<AUDIO>\\nDigite aqui o texto relacionado ao áudio e insira a imagem, se houver.\\n</apresentacao>",
  botao: "<BOTAO>\nAqui você vai inserir o texto introdutório. A quantidade de botões e janelas é livre. Organize os botões na sequência em que deseja que apareçam. As janelas devem seguir a mesma ordem dos respectivos botões.\n\n<botao>\nAqui você vai inserir o texto do botão ou uma imagem.\n\n<janela>\nAqui você vai inserir o conteúdo que será exibido quando o usuário clicar no botão.\n",
  botaotela: "<BOTAOTELA>\\nDigite aqui o texto que será apresentado no botão/tela.\\n</audio>",
  capitulo: "<CAPITULO>\\nDigite aqui o título do capítulo.\\n</botaotela>",
  exercitando: "<EXERCITANDO>\\nDigite aqui o enunciado da atividade e as orientações para o estudante.\\n</capitulo>",
  fechamento: "<FECHAMENTO>\\nDigite aqui o texto de encerramento da lição.\\n</exercitando>",
  flashcard: "<FLASHCARD>\\n<frente>\\nInsira uma imagem ou digite aqui o texto ou pergunta que ficará na frente do cartão.\\n<verso>\\nDigite aqui a resposta ou explicação que aparecerá no verso.",
  hotword: "<HOTWORD>\\nDigite aqui o texto principal.\\n\\n<hotword>\\nDigite aqui a palavra ou expressão que será destacada no texto.\\n\\n<janela>\\nDigite aqui a explicação que será exibida ao selecionar a palavra.\\n",
  importante: "<IMPORTANTE>\\nDigite aqui a informação que deve receive destaque.\\n</flashcard>",
  introducao: "<INTRODUCAO>\\nDigite aqui o texto introdutório da lição.\\n</importante>",
  mininavegacao: "<MININAVEGACAO>\\nDigite aqui os itens ou orientações da mini navegação.\\n</introducao>",
  objetivos: "<OBJETIVOS>\\nDigite aqui os objetivos de aprendizagem da lição.\\n</mininavegacao>",
  saibamais: "<SAIBAMAIS>\\nDigite aqui o conteúdo complementar ou a referência para aprofundamento.\\n</objetivos>",
  texto: "<TEXTO>\\nDigite aqui o texto da tela.\\n</saibamais>",
  textocomimagem: "<TEXTOCOMIMAGEM>\\nDigite aqui o texto e insira a imagem no ponto em que ela deverá aparecer.\\n</texto>"
};
app.get("/biblioteca", (req, res) => {
  res.render("biblioteca", { componentes: componentesBiblioteca, exemplos: exemplosBiblioteca });
});
app.get("/modelo-roteiro-docx", (req, res) => {
  const modelo = path.resolve(__dirname, "downloads", "modelo-roteiro-aim.docx");
  res.download(modelo, "Modelo_Roteiro_AIM.docx");
});

// Gerenciamento de projetos gerados.
const pastaProjetos = path.resolve(__dirname, "automato", "public");
app.use(express.json({ limit: "2mb" }));

function nomeSeguroProjeto(nome) {
  return typeof nome === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(nome) && nome !== "." && nome !== "..";
}
function caminhoDentro(base, relativo) {
  if (typeof relativo !== "string" || !relativo || path.isAbsolute(relativo)) throw new Error("Caminho inválido.");
  const alvo = path.resolve(base, relativo);
  if (alvo !== base && !alvo.startsWith(base + path.sep)) throw new Error("Caminho fora da pasta permitida.");
  return alvo;
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
app.get("/api/projects/:name/files", async (req, res) => { const name = req.params.name; if (!nomeSeguroProjeto(name)) return res.status(400).json({ message: "Projeto inválido." }); try { const root = path.resolve(pastaProjetos, name), files = await arquivosRecursivos(root, [".html", ".css", ".js"], 800); res.set("Cache-Control", "no-store").json({ files: files.map(f => ({ path: path.relative(root, f).split(path.sep).join("/") })) }); } catch (e) { res.status(500).json({ message: "Não foi possível listar os arquivos." }); } });
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
          });
          resultados.push({
            success: true,
            nomeArquivo: item.arquivo.originalname || path.basename(item.arquivo.path),
            numeroLicao: resultado?.metadados?.numeroLicao || (item.numeroLicao === Number.MAX_SAFE_INTEGER ? null : item.numeroLicao),
            titulo: resultado?.metadados?.titulo,
            metadados: resultado?.metadados,
            outputUrl: resultado?.outputUrl || `/automato/public/${String(resultado?.metadados?.sigla || "").trim().toLowerCase()}/index.html`
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
