# Autômato — versão experimental de tabelas

Esta cópia é independente do Autômato original. Use-a para validar o novo formato de componentes representados por tabelas no Word.

## Componentes implementados por tabela

### BOTÕES
- Identifica uma tabela cujo cabeçalho é `Botões`.
- Cada linha posterior contém o rótulo do botão na primeira célula e o conteúdo da janela na segunda.
- Converte os dados para um bloco delimitado `<botoes>...</botoes>`, preservando o restante do conteúdo da tela.
- O texto antes, entre e depois de uma ou mais tabelas de Botões permanece na ordem original.

### HOTWORD
- Identifica uma tabela cujo cabeçalho é `HOTWORD`.
- Cada linha posterior contém uma palavra ou expressão na primeira célula e o conteúdo da janela na segunda.
- Aceita expressões com mais de uma palavra, como `Luz solar` e `Agricultura familiar`.
- A tabela é convertida em um wrapper universal HOTWORD que recebe o texto anterior para localizar as expressões.
- O conteúdo posterior à tabela permanece fora do componente e visível na tela.
- Cada linha gera um ID de áudio próprio (`hotword_a`, `hotword_b` etc.) e entra na geração da sonorização.

**Orientação de preenchimento:** coloque o texto que contém as palavras/expressões antes da tabela HOTWORD na mesma tela. O componente atual destaca a primeira ocorrência de cada expressão nesse texto.


## Validação centralizada das tabelas

As tabelas de componentes passam por uma camada compartilhada em `scripts/ValidarTabelasComponentes.js`. As regras de preenchimento não devem ser reimplementadas dentro dos interpretadores dos componentes. Para adicionar um componente por tabela, sua definição de cabeçalho e campos obrigatórios deve ser cadastrada em `DEFINICOES_TABELAS`; o interpretador específico fica responsável somente por converter os dados válidos para o formato interno do componente.

Antes de preparar a pasta do curso, remover arquivos anteriores ou gerar qualquer tela, `main.js` chama `scripts/ValidarDocumentoTabelas.js`. A pré-validação percorre todos os tópicos e todas as telas, reúne os erros e interrompe o processamento sem apagar a saída existente. A extração dos tópicos e telas é compartilhada com `SelecionarTelas.js`.

Cada erro informa tópico, tela, componente, linha da tabela e campo ausente. Linhas inteiramente vazias são ignoradas; linhas parcialmente preenchidas impedem a geração.

## Documento Word incluído

O ZIP contém somente um arquivo DOCX: `Tabelas_Roteiro.docx`. Ele inclui:
- tabelas BOTÕES para regressão;
- tabela HOTWORD na linha 3;
- uma frase demonstrativa antes da tabela, com as expressões `luz solar` e `agricultura familiar`, para que os gatilhos possam ser visualizados no teste.

A rota `/modelo-roteiro-docx` da versão experimental entrega esse mesmo arquivo de teste.

## Fluxo de processamento

- `CriarTela.js` converte as tabelas internas de componentes antes de gerar o HTML da tela.
- `SelecionarTelas.js` considera somente as linhas da tabela externa do tópico; linhas internas não viram telas adicionais.
- `GerarJsonAudios.js` também reconhece as tabelas internas ao extrair a sonorização, sem contar suas linhas como novas telas.
- Tabelas que não possuem cabeçalho conhecido continuam preservadas como conteúdo normal.

## Testes automatizados

Dentro da pasta `automato`, execute:

```bash
npm install
npm test
```

Testes focados:

```bash
node scripts/testes/InterpretarTabelasComponentes.test.js
node scripts/testes/InterpretarTabelasHotword.test.js
node scripts/testes/ValidarTabelasComponentes.test.js
node scripts/testes/hotword.test.js
node scripts/testes/GerarJsonAudios.test.js
```

Os testes cobrem reconhecimento de cabeçalho, expressões de uma e várias palavras, gatilhos e janelas, preservação de texto anterior/intermediário/posterior, IDs de áudio independentes, os 12 cenários de validação central, agregação de erros entre tópicos/telas, ordem da pré-validação e compatibilidade dos componentes antigos baseados em tags.

## Isolamento

Esta é uma cópia experimental. O projeto Autômato original não é substituído nem alterado.
