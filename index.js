// Importar módulo express
let express = require('express');
// Criar aplicação express
let app = express();
// Importar módulo ejs para templates
let ejs = require('ejs');
// Carregar dados de haikus do arquivo JSON
const haikus = require('./haikus.json');
// Definir porta (variável de ambiente ou porta 3000)
const port = process.env.PORT || 3000;

// Servir arquivos estáticos da pasta public
app.use(express.static('public'))
// Definir EJS como motor de visualização
app.set('view engine', 'ejs');

// Rota GET para página inicial
app.get('/', (req, res) => {
  // Renderizar a view index passando os haikus como dados
  res.render('index', {haikus: haikus});
});

// Iniciar servidor na porta especificada
app.listen(port);