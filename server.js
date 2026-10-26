const { executar } = require("./automato/main.js");

// Importar módulos
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const https = require("https");

// Criar aplicação
const app = express();

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

// Rota POST: recebe um DOCX local ou baixa o documento a partir de um link do OneDrive.
app.post("/upload", (req, res) => {
  upload.single("arquivo")(req, res, async (erroUpload) => {
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

    let caminhoDocumento = req.file?.path;
    let arquivoTemporario = false;

    try {
      const documentUrl = String(req.body?.documentUrl || "").trim();
      if (caminhoDocumento && documentUrl) {
        return res.status(400).json({
          success: false,
          message: "Escolha apenas uma forma de envio.",
          errors: [{ etapa: "validação", message: "Envie um arquivo ou informe um link, não os dois ao mesmo tempo." }]
        });
      }

      if (!caminhoDocumento && documentUrl) {
        caminhoDocumento = path.join(pastaUploads, `onedrive-${Date.now()}-${Math.random().toString(16).slice(2)}.docx`);
        await baixarDocxDoOneDrive(documentUrl, caminhoDocumento);
        arquivoTemporario = true;
      }

      if (!caminhoDocumento) {
        return res.status(400).json({
          success: false,
          message: "Nenhum documento informado.",
          errors: [{ etapa: "validação", message: "Selecione um arquivo DOCX ou informe um link compartilhado do OneDrive." }]
        });
      }

      const resultado = await executar(caminhoDocumento);

      return res.status(200).json({
        success: true,
        message: "Arquivo processado com sucesso!",
        tabelasEncontradas: resultado?.tabelasEncontradas,
        metadados: resultado?.metadados,
        outputUrl: resultado?.outputUrl || `/automato/public/${String(resultado?.metadados?.sigla || "").trim().toLowerCase()}/index.html`
      });
    } catch (erro) {
      console.error("server.js - Falha no processamento:", erro);
      const erroDeLink = Boolean(req.body?.documentUrl) && !req.file;
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
      for (const arquivoTemp of [req.file?.path, arquivoTemporario ? caminhoDocumento : null].filter(Boolean)) {
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
