# 📄 Conversor DOCX → Telas HTML

Este projeto converte arquivos `.docx` estruturados em tabelas em múltiplas telas HTML organizadas por lição.
Também realiza a extração automática de imagens, tratamento de conteúdo e geração de arquivos prontos para uso.

---

## 🚀 Funcionalidades

### ✅ Já implementado

* [x] Leitura de arquivos `.docx`
* [x] Conversão de `.docx` para HTML usando `mammoth`
* [x] Preservação da estrutura de tabelas
* [x] Extração automática de imagens
* [x] Salvamento das imagens em `/output/imagens`
* [x] Ajuste automático dos caminhos das imagens no HTML
* [x] Identificação das tabelas do documento
* [x] Separação entre cabeçalho e lições
* [x] Processamento das linhas (`<tr>`) como telas
* [x] Extração do conteúdo da segunda coluna (`td[1]`)
* [x] Geração automática de arquivos HTML
* [x] Organização das telas por lição em pastas
* [x] Identificação do tipo de tela via `<strong>`
* [x] Log no console com tipo da tela

---

### 🚧 Em desenvolvimento / melhorias futuras

* [ ] Implementar processamento do cabeçalho (`CriarCabecalho`)
* [ ] Criar templates HTML padronizados
* [ ] Interface gráfica (upload de arquivo)
* [ ] CLI interativa (parâmetros via terminal)
* [ ] Exportação para JSON
* [ ] Exportação para PDF
* [ ] Validação automática da estrutura do DOCX
* [ ] Sistema de logs detalhados
* [ ] Tratamento avançado de erros
* [ ] Suporte a múltiplos formatos além de `.docx`

---

## 🚀 Como funciona

### 1. Leitura e Conversão do DOCX

* O arquivo `.docx` é carregado
* Conversão para HTML usando `mammoth`
* Estrutura de tabelas mantida

### 2. Extração de Imagens

* Imagens extraídas automaticamente
* Salvas em:
  /output/imagens

### 3. Identificação das Tabelas

* **Tabela 0** → Cabeçalho
* **Demais tabelas** → Lições

### 4. Processamento das Lições

* Cada `<tr>` representa uma tela
* Primeira linha ignorada
* Conteúdo vem da segunda coluna

### 5. Geração das Telas

/output/telas/licao{numero}/tela{index}.html

### 6. Identificação do Tipo

```html id="j4k29c"
<p><strong>Tipo da Tela</strong></p>
```

---

## 📁 Estrutura de Pastas

/output
/imagens
img_0.png
img_1.jpg

/telas
/licao1
tela1.html
tela2.html

```
/licao2  
  tela1.html  
```

---

## 📦 Instalação

```bash id="7k2m1a"
npm install mammoth node-html-parser
```

---

## ▶️ Uso

```js id="z81c2q"
const caminho = 'seu-arquivo.docx';
```

```bash id="w9x3sd"
node main.js
```

---

## 🧠 Arquitetura do Projeto

### 📌 main.js

* Orquestra o fluxo geral

### 📌 CarregarArquivoDOCX

* DOCX → HTML
* Extração de imagens

### 📌 SelecionarTelas

* Percorre tabelas
* Extrai telas

### 📌 CriarTela

* Gera HTML final

### 📌 CriarCabecalho

* Ainda não implementado

---

## 🔄 Fluxo do Sistema

DOCX
↓
HTML (mammoth)
↓
Extração de Imagens
↓
Leitura das Tabelas
↓
Separação
↓
Processamento
↓
Geração de Telas
↓
Organização

---

## ⚠️ Requisitos do DOCX

* Deve conter tabelas
* Cada tabela = 1 lição
* Cada linha = 1 tela
* Conteúdo na segunda coluna
* Tipo opcional:

```html id="x7m3kl"
<p><strong>Tipo da Tela</strong></p>
```

---

## 📌 Observações

* Voltado para automação de conteúdo educacional
* Ideal para materiais EAD
* Estrutura pronta para escalar

---
