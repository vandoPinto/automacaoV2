# Automação de geração de cursos HTML a partir de documentos DOCX

## 1. Sobre o projeto

Este projeto automatiza parte da criação de conteúdos educacionais em HTML a partir de documentos do Microsoft Word (`.docx`). O documento de entrada deve seguir a estrutura esperada pelo processo, especialmente a organização do cabeçalho e do conteúdo em tabelas.

A aplicação possui uma interface web para enviar um arquivo DOCX ou informar um link compartilhado do OneDrive/SharePoint. O servidor recebe o documento, executa o processamento e devolve à interface o resultado, incluindo informações extraídas do cabeçalho, como a sigla do curso e o número da lição, quando identificados.

O processamento converte o DOCX para HTML, interpreta as tabelas e utiliza módulos especializados para identificar os metadados, selecionar os componentes e gerar os arquivos HTML e JSON necessários ao curso.

> **Importante:** a estrutura e o conteúdo do DOCX influenciam diretamente o resultado. Use um documento baseado no modelo esperado pelo projeto e confira os arquivos gerados antes de publicá-los.

## 2. Objetivos

- Receber documentos DOCX pela interface web.
- Permitir o envio de um arquivo local ou o uso de um link compatível do OneDrive/SharePoint.
- Converter o conteúdo do Word para HTML para processamento.
- Extrair metadados do cabeçalho, incluindo nome da lição, sigla, número da lição e título, conforme os campos reconhecidos pelo código.
- Interpretar as tabelas do documento e encaminhar o conteúdo para os módulos responsáveis pela geração das telas.
- Gerar arquivos HTML e arquivos de configuração JSON para o curso.
- Organizar a saída por sigla do curso, evitando misturar os arquivos de cursos diferentes.
- Exibir mensagens de sucesso ou de erro na interface.

## 3. Tecnologias utilizadas

- **Node.js** — execução do servidor e dos scripts de automação.
- **Express** — servidor HTTP e rotas da aplicação.
- **Multer** — recebimento de arquivos enviados pela interface.
- **EJS** — renderização da página web, quando utilizada pela configuração do servidor.
- **Mammoth** — conversão de DOCX para HTML.
- **node-html-parser** — leitura e interpretação do HTML convertido.
- **HTML, CSS e JavaScript** — interface e conteúdo educacional gerado.
- **JSON** — metadados e configurações utilizadas pelo conteúdo.

As dependências devem ser conferidas nos arquivos JavaScript do projeto. Se o repositório tiver um `package.json`, use-o como referência oficial para instalar as dependências e executar os scripts.

## 4. Organização geral dos arquivos

A organização pode variar conforme a versão do projeto. Na versão que utiliza o servidor web e a pasta `automato`, os caminhos principais são semelhantes a estes:

```text
projeto/
├── server.js                      # Servidor web e rota de envio do documento
├── views/                         # Modelos da interface EJS, se usados
│   └── index.ejs                  # Página de envio/processamento
├── public/                        # Arquivos estáticos da aplicação web
├── uploads/                       # Arquivos recebidos temporariamente
├── output/                        # Saídas auxiliares, se utilizadas
└── automato/
    ├── main.js                    # Coordena o fluxo de processamento
    ├── public/                    # Cursos e arquivos HTML gerados
    └── scripts/
        ├── CarregarArquivoDOCX.js  # Converte DOCX para HTML
        ├── CriarCabecalho.js       # Extrai os metadados do cabeçalho
        ├── SelecionarTelas.js      # Identifica e encaminha o conteúdo das telas
        ├── CriarTela.js            # Gera arquivos de tela HTML
        ├── ComponentesLista.js     # Lista/apoia a identificação dos componentes
        ├── TagsToArray.js           # Apoio ao tratamento de tags
        ├── Utils.js                 # Funções utilitárias
        ├── AtualizarWbtJson.js      # Atualiza dados JSON do WBT
        ├── GerarJsonConfiguracao.js # Gera configurações JSON
        ├── GerenciarConfiguracaoWbt.js # Gerencia configuração por curso
        ├── Componentes/             # Templates e scripts dos componentes
        └── modelos/
            ├── modeloBase/          # Base completa do curso
            ├── wbtmodelo/           # Modelos de telas HTML
            └── wbt-modelo.json      # Modelo de configuração JSON
```

Os nomes e a presença de alguns arquivos dependem da versão. Para confirmar a estrutura real, consulte o diretório do projeto e o conteúdo dos arquivos de configuração.

### Responsabilidade dos arquivos principais

| Arquivo/pasta | Responsabilidade |
|---|---|
| `server.js` | Disponibiliza a interface, recebe o documento, chama a função de processamento e devolve a resposta para a página. |
| `automato/main.js` | Coordena as etapas da automação e integra os módulos especializados. |
| `CarregarArquivoDOCX.js` | Lê o DOCX e converte o conteúdo para HTML. |
| `CriarCabecalho.js` | Extrai os metadados necessários para identificar o curso e a lição. |
| `SelecionarTelas.js` | Analisa o conteúdo das tabelas e direciona a criação das telas. |
| `CriarTela.js` | Monta e grava os arquivos HTML com base nos modelos e componentes. |
| `Componentes/` | Guarda os templates HTML e scripts dos componentes educacionais. |
| `modelos/modeloBase/` | Contém a estrutura base do curso, com arquivos e recursos necessários à execução. |
| `modelos/wbtmodelo/` | Contém os modelos de telas usados na geração. |
| `AtualizarWbtJson.js` e módulos de configuração | Atualizam ou criam os arquivos JSON de configuração do curso. |
| `automato/public/` | Destino dos cursos gerados e dos arquivos que serão servidos como conteúdo estático. |

## 5. Requisitos

Antes de executar o projeto, verifique se o ambiente possui:

1. **Node.js e npm** instalados.
2. Todos os arquivos do projeto, incluindo os modelos, componentes e recursos usados pelos cursos.
3. As dependências Node.js necessárias instaladas.
4. Um documento DOCX estruturado de acordo com o modelo de entrada.
5. Permissão de leitura e gravação nas pastas de saída e na pasta temporária de uploads.

Para conferir as versões instaladas:

```bash
node --version
npm --version
```

Não exclua ou renomeie as pastas de modelos sem revisar os caminhos usados pelo código. A automação depende delas para gerar os arquivos finais.

## 6. Instalação

### 6.1. Entrar na pasta do projeto

No Terminal, navegue até a pasta que contém o `server.js`:

```bash
cd /caminho/para/o/projeto
```

Substitua `/caminho/para/o/projeto` pelo caminho real do seu projeto.

### 6.2. Instalar dependências

Se o projeto já possuir `package.json` e `package-lock.json`, instale as dependências declaradas:

```bash
npm install
```

Se não houver `package.json`, não execute `npm install` esperando que ele descubra automaticamente as dependências. Primeiro confira os `require(...)` usados em `server.js`, `automato/main.js` e nos módulos chamados por eles. O servidor e o processador utilizam bibliotecas como Express, Multer, EJS, Mammoth e node-html-parser; outras dependências podem existir conforme a versão.

## 7. Como executar a aplicação

Na pasta em que está o `server.js`, execute:

```bash
node server.js
```

Se a inicialização ocorrer normalmente, o servidor informa no Terminal o endereço local. Na configuração padrão, a porta é `3000`, portanto abra no navegador:

```text
http://localhost:3000
```

Se a porta estiver ocupada, encerre o processo que a utiliza ou configure outra porta por meio da variável de ambiente `PORT`, caso a versão do servidor dê suporte a essa configuração.

Para interromper o servidor, volte ao Terminal e pressione `Ctrl + C`.

## 8. Como processar um documento

1. Inicie o servidor Node.js.
2. Abra a interface no navegador.
3. Escolha **uma** das formas de entrada: selecione um arquivo `.docx` local ou informe um link compartilhado compatível do OneDrive/SharePoint.
4. Se usar um link, confirme que ele está acessível e que permite baixar o documento.
5. Envie o documento e aguarde o processamento.
6. Leia a mensagem apresentada pela interface.
7. Quando houver um link de saída, abra-o para verificar o conteúdo gerado.
8. Confira os arquivos e a estrutura do curso antes de disponibilizar o material aos alunos.

A versão do servidor documentada limita o upload a **50 MB** e aceita arquivos com extensão `.docx`. O link remoto precisa usar HTTPS e um domínio reconhecido pelo código como OneDrive/SharePoint. Links que exigem autenticação adicional ou que não permitem download podem falhar.

### Mensagem de sucesso

A interface apresenta uma mensagem de conclusão após o processamento. Na versão atualizada do servidor, a mensagem também pode informar o número da lição obtido dos metadados do documento. Esse número depende de o campo correspondente estar presente e ser reconhecido no cabeçalho do DOCX.

## 9. Como o DOCX é interpretado

O fluxo de processamento segue, em linhas gerais, estas etapas:

1. O servidor recebe o arquivo enviado ou baixa o documento de um link compatível.
2. `main.js` chama `CarregarArquivoDOCX.js` para converter o documento em HTML.
3. O HTML convertido é interpretado com `node-html-parser`.
4. O processo identifica as tabelas do documento.
5. A primeira tabela é tratada como cabeçalho e enviada para `CriarCabecalho.js`.
6. As demais tabelas são encaminhadas ao processo de seleção e criação das telas.
7. Os componentes e modelos apropriados são usados para gerar os arquivos HTML.
8. Os módulos de configuração criam ou atualizam os JSON necessários ao curso.
9. O resultado é retornado ao servidor, que responde à interface.

O código espera encontrar tabelas e campos com uma estrutura específica. Se o DOCX tiver tabelas ausentes, campos escritos de outra forma ou uma organização muito diferente do modelo esperado, o processamento pode falhar ou gerar conteúdo incompleto.

## 10. Metadados do cabeçalho

O módulo de cabeçalho foi desenvolvido para extrair campos como:

- **Nome da lição** — nome descritivo da lição.
- **Sigla** — identificador do curso/sistema, usado para organizar a saída.
- **Número da lição** — número que identifica a lição no curso.
- **Título** — título do roteiro ou documento.

Os campos precisam estar presentes e compatíveis com os padrões reconhecidos pelo código. Para evitar falhas, não altere os rótulos do cabeçalho sem revisar as expressões de extração em `CriarCabecalho.js`.

## 11. Organização da saída por curso

A saída é planejada para separar os cursos pela sigla extraída do documento. Por exemplo, um curso cuja sigla seja `sis` pode ser armazenado em uma pasta como:

```text
automato/public/sis/
```

O conteúdo dessa pasta pode incluir a página inicial do curso, HTMLs das telas, JSONs, imagens, SVGs, áudio e outros recursos necessários à navegação.

### Cuidados com a geração

- Preserve a pasta `modeloBase` e os demais modelos usados pela automação.
- Não edite diretamente os arquivos de modelo para corrigir apenas uma saída específica, a menos que a intenção seja alterar todas as futuras gerações.
- Antes de gerar novamente um curso existente, faça backup dos arquivos que não podem ser substituídos.
- Confira se a geração atualiza o JSON específico do curso e se os links de saída apontam para a pasta correta.
- Teste o curso no navegador para detectar caminhos quebrados de imagens, SVGs, áudio, scripts ou páginas HTML.

O comportamento exato ao encontrar uma pasta de curso existente depende da versão do `main.js` e dos módulos de geração. Verifique esse comportamento no código antes de executar em uma pasta que contenha alterações manuais importantes.

## 12. Tratamento de erros e diagnóstico

Quando o processamento falhar, comece pelo Terminal em que o servidor está rodando. Os logs normalmente ajudam a identificar a etapa que apresentou problema.

| Sintoma | O que verificar |
|---|---|
| A página não abre | Confirme se o servidor iniciou, se a porta está correta e se não existe outro processo ocupando a porta. |
| O envio do arquivo falha | Confira se o arquivo é `.docx`, se tem menos de 50 MB e se o campo correto foi enviado. |
| O link do OneDrive não funciona | Verifique se o link é HTTPS, se pertence a um domínio permitido e se permite baixar o arquivo sem etapas adicionais de autenticação. |
| Não foram encontradas tabelas | Abra o DOCX e confira se o conteúdo está organizado em tabelas compatíveis com o modelo esperado. |
| A sigla ou o número da lição não aparece | Confira os rótulos e valores no cabeçalho e as expressões de extração de `CriarCabecalho.js`. |
| Uma tela não é gerada | Verifique a tabela correspondente, os nomes de componentes, os templates e os logs de `SelecionarTelas.js` e `CriarTela.js`. |
| JSON ausente ou incorreto | Revise os módulos de geração/atualização de JSON e os metadados extraídos. |
| Imagem, SVG ou áudio não carrega | Confira se o recurso foi copiado para a saída e se o caminho referenciado no HTML está correto. |
| Erro `Cannot find module` | Instale a dependência ausente e confira se o comando foi executado na pasta correta. |
| Erro de permissão ao gravar | Confira as permissões das pastas de saída e temporárias. |

### Boas práticas para investigar

1. Guarde o erro completo do Terminal, incluindo a primeira mensagem e a pilha de chamadas.
2. Identifique qual arquivo JavaScript aparece no erro.
3. Confirme se o caminho citado existe.
4. Teste com uma cópia do DOCX, não com o único original.
5. Compare os arquivos gerados com os modelos originais.
6. Faça uma alteração por vez e execute novamente o processo.

## 13. Segurança e manutenção

- Não envie documentos confidenciais para links públicos. Use somente links autorizados e apropriados para o conteúdo.
- Não publique a pasta `uploads/` como conteúdo público. Ela deve ser usada para arquivos temporários.
- A aplicação deve validar os arquivos de entrada e limitar o tamanho do upload.
- Evite colocar senhas, tokens ou links privados em arquivos versionados.
- Faça backup antes de alterar `app.js`, JSONs de configuração, modelos ou conteúdo de um curso já publicado.
- Não remova arquivos `.bak` sem confirmar que não são necessários para recuperação.
- Após modificar o código, teste primeiro com uma cópia de um documento de exemplo.

## 14. Controle de versão

Antes de enviar alterações ao Git, confira o que será incluído:

```bash
git status
```

Arquivos gerados, documentos DOCX grandes, áudios, imagens e outros recursos podem aumentar bastante o tamanho do repositório. Inclua apenas o que for necessário para o projeto e siga as regras de versionamento da equipe.

## 15. Checklist antes de publicar um curso

- [ ] O DOCX segue o modelo esperado.
- [ ] O cabeçalho contém nome, sigla e número da lição nos campos reconhecidos.
- [ ] O processamento terminou sem erros.
- [ ] A pasta de saída corresponde à sigla correta.
- [ ] Os arquivos HTML e JSON foram gerados ou atualizados corretamente.
- [ ] As imagens, SVGs, áudios, scripts e demais recursos carregam.
- [ ] Os links de navegação entre telas funcionam.
- [ ] O curso foi aberto e testado no navegador.
- [ ] Foi feito backup antes de substituir conteúdo existente.

## 16. Limitações e observações

Este README descreve a arquitetura e o fluxo identificados nos arquivos do projeto. Os comandos exatos de inicialização, a lista completa de dependências e alguns detalhes de geração podem variar entre versões. Quando houver divergência, dê prioridade ao `package.json` (se existir) e ao código que está efetivamente instalado no projeto.

O processamento de um documento real deve ser testado antes de considerar a automação validada para produção. A verificação de sintaxe dos arquivos JavaScript, isoladamente, não garante que todas as etapas de geração funcionem com qualquer DOCX.

## 17. Resumo rápido

```bash
# 1. Entre na pasta do projeto
cd /caminho/para/o/projeto

# 2. Instale as dependências, se o projeto possuir package.json
npm install

# 3. Inicie o servidor
node server.js

# 4. Abra no navegador
# http://localhost:3000
```

Envie um DOCX válido ou um link compatível, aguarde a conclusão e revise o curso gerado antes de publicá-lo.
