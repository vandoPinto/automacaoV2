const { executar } = require("./automato/main.js");

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
app.use('/automato', express.static(path.resolve(__dirname, './automato')));

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

    // Executa processamento do script executar em ./automato/main.js
    const caminhoFinal = await (async () => {
      try {
        return await executar(caminhoArquivo);
      } catch (erro) {
        console.error(erro);
        throw new Error('Erro ao processar arquivo');
      }
    })();

    // ✅ Retorna link correto
    res.send(`
      Arquivo processado com sucesso! <br><br>
      <a href="/automato/aulafuncional/index.html" target="_blank">
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