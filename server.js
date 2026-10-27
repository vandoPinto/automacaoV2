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
  limits: { fileSize: 50 * 1024 * 1024 }, // Limite de 50 MB
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
app.use(express.static(path.resolve(__dirname, "public")));
app.use("/output", express.static(path.resolve(__dirname, "./output")));
app.use("/automato", express.static(path.resolve(__dirname, "./automato")));

// View engine
app.set("view engine", "ejs");

// Rota GET
app.get("/", (req, res) => {
  res.render("index", { haikus });
});


// Gerenciamento de projetos gerados.
const pastaProjetos = path.resolve(__dirname, "automato", "public");
const pastaBackups = path.resolve(__dirname, "backups", "project-manager");
fs.mkdirSync(pastaBackups, { recursive: true });
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
    res.set("Cache-Control", "no-store").json({ projects: projects.sort((a,b)=>a.name.localeCompare(b.name)) });
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
    try { const st = await fs.promises.lstat(candidato); if (st.isFile() && !st.isSymbolicLink()) return candidato; } catch (_) {}
  }
  const encontrados = await arquivosRecursivos(root, [".json"], 3000);
  for (const arquivo of encontrados) {
    if (path.basename(arquivo).toLowerCase() !== "wbt.json") continue;
    try { JSON.parse(await fs.promises.readFile(arquivo, "utf8")); return arquivo; } catch (_) {}
  }
  return null;
}
async function lerMetadadosWbt(root) {
  const arquivo = await localizarWbtJson(root);
  if (!arquivo) return { wbtPath: null, config: {}, unidades: [] };
  try {
    const wbt = JSON.parse(await fs.promises.readFile(arquivo, "utf8"));
    const unidades = (Array.isArray(wbt.oas) ? wbt.oas : []).slice(1).map(u => ({
      nome: String(u.label || u.nome || u.sigla || "Lição sem nome"),
      sigla: String(u.sigla || ""),
      totalTelas: Number(u.numTotalFrames) || (Array.isArray(u.arquivos) ? u.arquivos.reduce((n, a) => n + (Number(a.totalFrames) || 0), 0) : 0)
    }));
    return { wbtPath: arquivo, config: wbt.config || {}, unidades };
  } catch (_) { return { wbtPath: arquivo, config: {}, unidades: [] }; }
}
app.get("/api/projects/:name/lessons", async (req, res) => {
  const name=req.params.name;if(!nomeSeguroProjeto(name))return res.status(400).json({message:"Projeto inválido."});
  try {
    const root=path.resolve(pastaProjetos,name), images=path.join(root,"images");
    const meta = await lerMetadadosWbt(root);
    const entries=await fs.promises.readdir(images,{withFileTypes:true}).catch(()=>[]);
    const lessons=[];
    for(const e of entries){
      if(!e.isDirectory()||e.isSymbolicLink()||["biblioteca","wbtved","wbtsis"].includes(e.name.toLowerCase()))continue;
      const folder=path.join(images,e.name), html=await arquivosRecursivos(folder,[".html"],500);
      if(!html.length)continue;
      const unidade = meta.unidades.find(u => u.sigla.toLowerCase() === e.name.toLowerCase());
      lessons.push({path:`images/${e.name}`, nome:unidade?.nome || e.name, sigla:unidade?.sigla || e.name, count:html.length, totalTelas:unidade?.totalTelas ?? html.length});
    }
    lessons.sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true}));
    res.json({lessons, courseName:meta.config.label || name, wbtPath:meta.wbtPath ? path.relative(root,meta.wbtPath).split(path.sep).join("/") : null});
  }catch(e){res.status(500).json({message:"Não foi possível listar as lições."});}
});
app.delete("/api/projects/:name/lessons", async (req,res)=>{
  const name=req.params.name, rel=req.body?.path;
  if(!nomeSeguroProjeto(name)||typeof rel!=="string"||!/^images\/[a-zA-Z0-9_-]{1,80}$/.test(rel)||["images/biblioteca","images/wbtved","images/wbtsis"].includes(rel.toLowerCase()))return res.status(400).json({message:"Lição inválida."});
  try {
    const root=path.resolve(pastaProjetos,name), target=caminhoDentro(root,rel);
    const st=await fs.promises.lstat(target);
    if(!st.isDirectory()||st.isSymbolicLink())return res.status(400).json({message:"O destino não é uma pasta de lição válida."});
    const backup=path.join(pastaBackups,`${name}-licao-${path.basename(rel)}-${Date.now()}`);
    await fs.promises.cp(target,backup,{recursive:true,dereference:false});
    const meta = await lerMetadadosWbt(root);
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
          await fs.promises.copyFile(meta.wbtPath, meta.wbtPath + `.bak-${Date.now()}`);
          await fs.promises.writeFile(meta.wbtPath, `${JSON.stringify(wbt, null, 4)}\n`, "utf8");
        }
      }
    }
    await fs.promises.rm(target,{recursive:true});
    res.json({message: unidadeRemovida ? "Lição excluída, removida do wbt.json e cópias de segurança criadas." : "Lição excluída e cópia de segurança criada. Não foi encontrada uma unidade correspondente no wbt.json."});
  } catch(e) { console.error("Erro ao excluir lição:",e); res.status(404).json({message:"Não foi possível localizar ou excluir essa lição."}); }
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
    await fs.promises.copyFile(realFile, realFile + `.bak-${Date.now()}`);
    await fs.promises.writeFile(realFile, updated, "utf8");
    res.json({ message: "Cores salvas em styles/estilos-centralizados.css. Uma cópia de segurança foi criada." });
  } catch (e) {
    if (e.code === "ENOENT") return res.status(404).json({ message: "Não foi encontrado styles/estilos-centralizados.css neste curso." });
    res.status(500).json({ message: "Não foi possível salvar as cores." });
  }
});
app.get("/api/projects/:name/files",async(req,res)=>{const name=req.params.name;if(!nomeSeguroProjeto(name))return res.status(400).json({message:"Projeto inválido."});try{const root=path.resolve(pastaProjetos,name),files=await arquivosRecursivos(root,[".html",".css",".js"],800);res.json({files:files.map(f=>({path:path.relative(root,f).split(path.sep).join("/")}))});}catch(e){res.status(500).json({message:"Não foi possível listar os arquivos."});}});
app.get("/api/projects/:name/file",async(req,res)=>{const name=req.params.name,rel=req.query.path;if(!nomeSeguroProjeto(name))return res.status(400).json({message:"Projeto inválido."});try{const root=path.resolve(pastaProjetos,name),target=caminhoDentro(root,rel);const realRoot=await fs.promises.realpath(root),realTarget=await fs.promises.realpath(target);if(!realTarget.startsWith(realRoot+path.sep))return res.status(400).json({message:"Caminho fora do projeto."});if(![".html",".css",".js"].includes(path.extname(target).toLowerCase()))return res.status(400).json({message:"Tipo de arquivo não permitido."});const st=await fs.promises.lstat(target);if(!st.isFile()||st.isSymbolicLink()||st.size>1024*1024)return res.status(400).json({message:"Arquivo inválido ou maior que 1 MB."});res.json({path:rel,content:await fs.promises.readFile(target,"utf8")});}catch(e){res.status(404).json({message:"Arquivo não encontrado ou caminho inválido."});}});
app.put("/api/projects/:name/file",async(req,res)=>{const name=req.params.name,{path:rel,content}=req.body||{};if(!nomeSeguroProjeto(name)||typeof content!=="string"||Buffer.byteLength(content,"utf8")>1024*1024)return res.status(400).json({message:"Conteúdo inválido ou maior que 1 MB."});try{const root=path.resolve(pastaProjetos,name),target=caminhoDentro(root,rel);const realRoot=await fs.promises.realpath(root),realTarget=await fs.promises.realpath(target);if(!realTarget.startsWith(realRoot+path.sep))return res.status(400).json({message:"Caminho fora do projeto."});if(![".html",".css",".js"].includes(path.extname(target).toLowerCase()))return res.status(400).json({message:"Tipo de arquivo não permitido."});const st=await fs.promises.lstat(target);if(!st.isFile()||st.isSymbolicLink())return res.status(400).json({message:"Arquivo inválido."});await fs.promises.copyFile(target,target+`.bak-${Date.now()}`);await fs.promises.writeFile(target,content,"utf8");res.json({message:"Arquivo salvo e cópia de segurança criada."});}catch(e){res.status(404).json({message:"Não foi possível salvar o arquivo."});}});
// A aba Sonorização é apenas uma interface de planejamento por enquanto.
// A integração com a API de geração de MP3 será implementada futuramente.


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

  if (!dados) {
    return res.status(404).json({ message: "Progresso não encontrado." });
  }

  res.set("Cache-Control", "no-store");
  return res.json(dados);
});

// Rota POST: recebe um DOCX local ou baixa o documento a partir de um link do OneDrive.
app.post("/upload", (req, res) => {
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

    const progressId = String(req.body?.progressId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
    const atualizarProgresso = dados => {
      if (progressId) progressoProcessamentos.set(progressId, { ...dados, atualizadoEm: Date.now() });
    };
    atualizarProgresso({ etapa: "Preparando o processamento", percentual: 0, concluido: false });

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

      const ordenados = await Promise.all(arquivosEnviados.map(async (arquivo, indice) => ({
        arquivo, indice, numeroLicao: await identificarNumeroLicao(arquivo)
      })));
      ordenados.sort((a, b) => a.numeroLicao - b.numeroLicao || a.indice - b.indice);

      const resultados = [];
      for (let i = 0; i < ordenados.length; i++) {
        const item = ordenados[i];
        const percentualBase = Math.round((i / Math.max(1, ordenados.length)) * 95);
        atualizarProgresso({ etapa: `Gerando lição ${item.numeroLicao === Number.MAX_SAFE_INTEGER ? (i + 1) : item.numeroLicao} (${i + 1} de ${ordenados.length})`, percentual: percentualBase, concluido: false });
        try {
          const resultado = await executar(item.arquivo.path, dados => atualizarProgresso({
            ...dados,
            etapa: `Lição ${item.numeroLicao === Number.MAX_SAFE_INTEGER ? (i + 1) : item.numeroLicao}: ${dados.etapa || "processando"} (${i + 1} de ${ordenados.length})`,
            percentual: Math.min(99, percentualBase + Math.round((Number(dados.percentual) || 0) / ordenados.length)),
            concluido: false
          }));
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
          resultados.push({ success: false, nomeArquivo: item.arquivo.originalname || path.basename(item.arquivo.path), numeroLicao: item.numeroLicao === Number.MAX_SAFE_INTEGER ? null : item.numeroLicao, message: erro.publicMessage || erro.message });
        }
      }

      const sucessos = resultados.filter(item => item.success);
      atualizarProgresso({ etapa: "Processamento em lote concluído", percentual: 100, concluido: true, success: sucessos.length > 0 });
      if (!sucessos.length) {
        return res.status(500).json({ success: false, message: "Nenhuma lição foi gerada com sucesso.", resultados, errors: resultados.map(item => ({ etapa: item.nomeArquivo, message: item.message })) });
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
          message: erro.publicMessage || (erroDeLink ? erro.message : "Ocorreu um erro inesperado. Verifique o arquivo e tente novamente.")
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
