# Componente JOGO DA MEMÓRIA

Atividade de pareamento por cartas. O roteiro pode definir uma única `<frente>` comum a todas as cartas (opcional). Se a tag estiver ausente, o componente desenha a capa padrão com CSS. Cada trio `<carta1>`, `<carta2>` e `<feedback>` acrescenta um par ao jogo. O sistema cria duas cartas por par e embaralha todas juntas.

## Sintaxe oficial do roteiro

```text
<jogomemoria>

<frente>
[Opcional: imagem ou texto que será mostrado na face fechada de todas as cartas.
Se omitir a tag <frente> ou deixá-la vazia, será usada a capa padrão desenhada por CSS.]

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

## Marcadores

- `<jogomemoria>` inicia e encerra a atividade.
- `<frente>` é **opcional** e, quando usada, aparece uma única vez no início. Define a aparência comum de todas as cartas quando estão viradas para baixo. Aceita imagem ou texto. Se a tag estiver ausente ou vazia, o componente desenha uma capa padrão com CSS.
- Cada `<carta1>` inicia um novo par e recebe o conteúdo que será revelado por uma das cartas.
- `<carta2>` recebe o conteúdo que será revelado pela outra carta do mesmo par.
- `<feedback>` recebe a mensagem exclusiva exibida quando aquele par for encontrado. Deve haver exatamente um por par.

A sequência de cada par é `<carta1>`, `<carta2>`, `<feedback>`. Depois do feedback, outro `<carta1>` inicia o próximo par. Não repita `<frente>`. Os marcadores internos não precisam de fechamento explícito. A quantidade é livre: cada trio gera duas cartas.

## Funcionamento

1. Todas as cartas usam a mesma frente e são embaralhadas juntas ao iniciar a atividade.
2. O estudante vira uma carta e depois outra.
3. Se as cartas pertencem ao mesmo par, permanecem abertas e, após 1 segundo, aparece o feedback daquele par.
4. Se pertencem a pares diferentes, voltam para baixo após um breve intervalo, sem feedback de erro.
5. Cada par correto pode ser encontrado apenas uma vez; os pares já encontrados permanecem abertos.

## Hierarquia, responsividade e áudio

- O flip segue o padrão visual e dimensional do FLASHCARD, com virada por clique/toque e teclado.
- Textos revelados ficam centralizados horizontal e verticalmente. Imagens na capa ou no conteúdo revelado ocupam toda a área da carta, com `object-fit: cover`.
- O tabuleiro calcula automaticamente o número de colunas e o tamanho das cartas a partir da quantidade total e da área visível disponível, inclusive em celular e dentro de componentes-pai.
- O feedback é movido para `document.body` e elevado acima das camadas ativas, para não ficar preso atrás de Botões, Abas, Flashcard ou outros componentes-pai.
- Cada feedback produz um áudio individual (`jogomemoria_a`, `jogomemoria_b`, ...), preservando o prefixo hierárquico dos componentes-pai.
- Componentes dentro da capa, de `carta1`, `carta2` ou do feedback continuam sendo processados recursivamente com IDs independentes. Texto e imagens simples das cartas não geram narração automática.
- Instâncias múltiplas são independentes.

## Arquivos

- `jogomemoria.js`: interpreta o roteiro, valida os pares e monta cartas e IDs de áudio.
- `jogomemoria.html`: layout, estilos isolados, animação de virada, embaralhamento e feedback global.
- `README.md`: documentação do roteiro.


## Dimensionamento responsivo

O tabuleiro calcula a melhor quantidade de colunas e o tamanho das cartas com base na quantidade total de cartas e na área visível disponível dentro da tela ou janela-pai. As cartas mantêm a proporção do Flashcard (190 × 280 como dimensão máxima), diminuem proporcionalmente quando necessário e são reorganizadas ao redimensionar a tela ou abrir um componente-pai. A última linha incompleta é centralizada.
