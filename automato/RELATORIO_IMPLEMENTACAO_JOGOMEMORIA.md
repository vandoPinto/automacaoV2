# Relatório de implementação — JOGO DA MEMÓRIA

## Base utilizada

Implementação realizada sobre o ZIP mais recente enviado pelo usuário. FLASHCARD e LIGAPONTOS foram preservados; o visual e a animação de carta do FLASHCARD serviram de referência.

## Sintaxe oficial do roteiro

O componente aceita uma única `<frente>` opcional para definir a face fechada comum a todas as cartas. Se a tag não aparecer, usa uma capa padrão desenhada com CSS. Depois da frente (se houver), cada trio `<carta1>`, `<carta2>` e `<feedback>` representa um par:

```text
<jogomemoria>

<frente>
[Imagem ou texto comum a todas as cartas; vazio usa a capa CSS.]

<carta1>
Maçã

<carta2>
Fruta vermelha

<feedback>
Muito bem! Você encontrou o par da maçã.

<carta1>
Banana

<carta2>
Fruta amarela

<feedback>
Parabéns! Você encontrou o par da banana.

</jogomemoria>
```

A frente é opcional. Quando utilizada, aparece uma única vez no início. Cada par exige exatamente os marcadores `<carta1>`, `<carta2>` e `<feedback>`, nessa ordem. Uma segunda `<frente>` é rejeitada com mensagem explicativa. Os marcadores internos não precisam de fechamento explícito.

## Comportamento

- Cada par gera duas cartas; a quantidade é definida pelo número de trios no roteiro.
- Todas as cartas compartilham a mesma capa. A tag `<frente>` pode conter texto ou imagem; se for omitida ou ficar vazia, o componente cria a capa com CSS.
- Na capa, imagens ocupam toda a superfície da carta. Nas faces reveladas, imagens também preenchem a área inteira e textos ficam centralizados horizontal e verticalmente.
- Todas as cartas são embaralhadas juntas.
- Ao encontrar um par, as duas cartas permanecem abertas e bloqueadas; o feedback correspondente aparece após 1 segundo.
- Se as cartas forem diferentes, ambas voltam para baixo depois de um breve intervalo, sem mensagem de erro.
- Pares já encontrados permanecem abertos e não podem ser selecionados novamente.
- O tabuleiro recalcula colunas e dimensões com base na quantidade de cartas e no espaço visível entre os limites da tela/contêiner-pai; as cartas reduzem mantendo a proporção do Flashcard.
- A última linha incompleta é centralizada, e o cálculo é refeito em redimensionamentos e quando um componente-pai é aberto.

## Hierarquia e áudio

- O feedback é movido para `document.body` e elevado acima das camadas ativas, independentemente do contexto de empilhamento e do overflow dos componentes-pai.
- Cada feedback gera um ID individual (`jogomemoria_a`, `jogomemoria_b` etc.) e mantém o prefixo hierárquico dos componentes-pai.
- Conteúdos internos de `<carta1>`, `<carta2>` e `<feedback>` continuam passando pelo processamento recursivo com IDs próprios. A capa global aceita texto/imagem, conforme a especificação do componente.
- O texto simples das cartas não entra na narração automática; somente os feedbacks recebem áudio próprio.
- Instâncias múltiplas são independentes.

## Biblioteca

O exemplo da Biblioteca foi atualizado para mostrar uma única `<frente>` e pares repetidos, cada um com seu próprio feedback.

## Arquivos principais

- `automato/scripts/Componentes/jogomemoria/jogomemoria.js`
- `automato/scripts/Componentes/jogomemoria/jogomemoria.html`
- `automato/scripts/Componentes/jogomemoria/README.md`
- `automato/scripts/ExtrairAudiosComponentes.js`
- `automato/scripts/testes/jogomemoria*.test.js`
- `server.js` (exemplo da Biblioteca)

## Validação

O comando `npm run test:jogomemoria` passou após a mudança de sintaxe. Em seguida, a suíte completa `npm test` terminou com sucesso, incluindo:

- leitura do novo formato com uma capa global opcional e vários pares, inclusive marcadores escapados no DOCX;
- ausência da tag `<frente>` com geração automática da capa CSS;
- frente com imagem ocupando a carta inteira, conteúdo imagem ocupando a face inteira e texto centralizado;
- atraso de 1 segundo entre a abertura da segunda carta correta e a apresentação do feedback individual;
- cálculo de colunas e dimensões das cartas, com recálculo ao redimensionar a área disponível;
- validação da ordem dos marcadores e rejeição de uma segunda `<frente>`;
- correspondência entre IDs de áudio no HTML e no `sonorizacao.json`;
- hierarquia em Tela, Botões, Flashcard, wrappers universais e múltiplas instâncias;
- preservação da interação de acerto/erro, da camada global do feedback e do intervalo de 1 segundo;
- testes de regressão dos demais componentes, incluindo Flashcard e Liga Pontos.

A interação foi validada em DOM simulado e a suíte Node.js completa passou. Não foi realizada inspeção visual em navegador real nesta sessão.
