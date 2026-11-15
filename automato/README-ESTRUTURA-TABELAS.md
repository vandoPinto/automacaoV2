# Estrutura das tabelas de componentes

Na primeira linha, coloque o nome do componente (essa célula pode ocupar a largura toda da tabela). A partir da segunda linha, cada linha representa um item. Não crie uma linha extra para nomear as colunas: preencha os campos na ordem descrita abaixo.

Use uma linha por cartão, etapa, painel ou par. Linhas totalmente vazias são ignoradas; linhas parcialmente preenchidas geram uma mensagem de pré-validação com o componente, a tela, a linha e o campo que precisa de ajuste.

## FLASHCARD

- Primeira linha: `FLASHCARD`.
- Cada linha de dados: `Frente do cartão | Verso do cartão`.

Cada linha cria um cartão. O verso mantém o áudio do componente.

## JOGO DA MEMÓRIA

- Primeira linha: `JOGO DA MEMÓRIA`.
- Cada linha de dados: `Carta 1 | Carta 2 correspondente | Feedback do par | Capa comum (opcional)`.

As três primeiras colunas são obrigatórias em cada par. A capa é opcional e, se usada, deve aparecer em apenas uma linha da tabela.

## MINI NAVEGAÇÃO

- Primeira linha: `MINI NAVEGAÇÃO`.
- Cada linha de dados tem uma coluna: `Conteúdo da etapa`.

Cada linha cria uma etapa navegável.

## SANFONA

- Primeira linha: `SANFONA`.
- Cada linha de dados: `Título do painel | Conteúdo do painel`.

Cada linha cria um painel.

## LIGA PONTOS

- Primeira linha: `LIGA PONTOS`.
- Cada linha de dados: `Opção | Resposta correspondente | Feedback de acerto | Feedback de erro`.

As duas primeiras colunas são obrigatórias em cada par. Preencha os dois feedbacks juntos em uma única linha; nas demais linhas, deixe as duas colunas de feedback vazias.

## Componentes já migrados

- **BOTÕES** — coluna 1: nome do botão; coluna 2: conteúdo da janela.
- **HOTWORD** — coluna 1: palavra ou expressão; coluna 2: explicação.
- **ABAS** — coluna 1: título da aba; coluna 2: conteúdo da aba.
