// Importar módulos
const express = require('express');
const path = require('path');
const multer = require('multer');
const ejs = require('ejs');

// Criar aplicação
const app = express();

// Upload
const upload = multer({ dest: 'uploads/' });
const output = multer({ dest: 'output/' });

// Dados mock
const haikus = require('./haikus.json');

// Porta
const port = process.env.PORT || 3000;

// Servir arquivos estáticos
app.use(express.static('public'));

// ✅ Servir a pasta correta de saída
app.use('/output', express.static(path.resolve(__dirname, './output')));

// View engine
app.set('view engine', 'ejs');

// Rota GET
app.get('/', (req, res) => {
  res.render('index', { haikus });
});

// Rota POST upload
app.post('/upload', upload.single('arquivo'), async (req, res) => {
  try {
    // ✅ Validação
    if (!req.file) {
      return res.status(400).send('Nenhum arquivo enviado');
    }

    const caminhoArquivo = req.file.path;

    // ✅ Executa processamento
    const caminhoFinal = await executar(caminhoArquivo);

    // ✅ Retorna link correto
    res.send(`
      Arquivo processado com sucesso! <br><br>
      <a href="/output/licao/topico1/tela1.html" target="_blank">
        Ver arquivo gerado
      </a>
  `);

  } catch (erro) {
    console.error(erro);
    res.status(500).send('Erro ao processar arquivo');
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});


// ================== PROCESSAMENTO ==================

const { CarregarArquivoDOCX } = require("./automato/scripts/CarregarArquivoDOCX");
const { CriarCabecalho } = require("./automato/scripts/CriarCabecalho");
const { SelecionarTelas } = require("./automato/scripts/SelecionarTelas");
const { parse } = require("node-html-parser");

// Caminho base de saída
const caminhoBaseSaida = path.resolve(__dirname, "./output");

async function executar(arquivo) {
  let tabelas = [];

  try {
    const html = await CarregarArquivoDOCX(arquivo, caminhoBaseSaida);

    const root = parse(html);

    const tables = Array.from(root.children)
      .filter(el => el.tagName === "TABLE");

    let ultimoArquivoGerado = null;

    tables.forEach((tabela, index) => {
      tabelas.push(tabela.innerHTML);

      if (index === 0) {
        CriarCabecalho(parse(tabela.innerHTML));
      } else {
        // 🔥 IMPORTANTE:
        // Ajuste sua função SelecionarTelas para retornar o caminho do arquivo gerado
        const caminhoGerado = SelecionarTelas(
          parse(tabela.innerHTML),
          index,
          caminhoBaseSaida
        );

        // guarda o último (ou você pode guardar todos depois)
        if (caminhoGerado) {
          ultimoArquivoGerado = caminhoGerado;
        }
      }
    });

    console.log("TABELAS ENCONTRADAS:", tabelas.length);

    // ✅ retorno dinâmico
    return ultimoArquivoGerado || 'licao/topico1/tela22.html';

  } catch (erro) {
    console.error("❌ Erro:", erro);
    throw erro;
  }
}