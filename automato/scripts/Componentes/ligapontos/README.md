# Componente LIGAPONTOS

Atividade de associação entre itens de duas colunas. O componente lê o roteiro AIM, monta as duas colunas, embaralha a coluna das respostas e permite ao estudante ligar os pares por clique/toque ou teclado.

## Sintaxe no roteiro

```html
<ligapontos>

<opcao>
HTML
<resposta>
Linguagem de marcação.

<opcao>
CSS
<resposta>
Estilização de página.

<opcao>
JavaScript
<resposta>
Linguagem de programação.

<feedcerto>
Parabéns! Você ligou corretamente.

<feedErrao>
Não foi dessa vez, tente novamente.

</ligapontos>
```

Cada `<opcao>` deve ser seguida pela sua `<resposta>`. A quantidade de opções e respostas deve ser igual. Os dois feedbacks são obrigatórios. O conteúdo antes da primeira opção é mantido como introdução opcional.

O nome `<feedErrao>` é aceito exatamente como aparece no roteiro fornecido. Também são aceitos `<feederrado>`, `<feedbackcerto>` e `<feedbackerrado>` como aliases.

## Funcionamento

- A coluna da esquerda preserva a ordem do roteiro.
- A coluna da direita é embaralhada ao entrar na atividade.
- O estudante seleciona um ponto da esquerda e depois o ponto correspondente da direita.
- O botão **Submeter respostas** só é habilitado quando todas as opções estiverem ligadas.
- No erro, somente as ligações incorretas são removidas; as corretas permanecem.
- No acerto, o feedback definido no roteiro é exibido e a atividade é concluída.
- Ao sair e entrar novamente em uma aba/painel que contenha a atividade, as respostas são embaralhadas novamente e o estado é reiniciado.
- As opções são exibidas como texto simples, alinhadas à esquerda; as respostas são exibidas como texto simples, alinhadas à direita. Não há caixas, bordas ou fundos individuais nos itens.
- Os pontos permanecem nas laterais internas das colunas, próximos ao vão central, para que as linhas conectem os pares sem atravessar os textos.
- O botão de submissão usa `var(--cor-principal)`, a cor padrão do sistema e o padrão visual dos botões do Automato.
- Os feedbacks abrem em uma janela central com sobreposição escura, painel na cor principal, texto branco centralizado e botão de fechar, seguindo o estilo da janela do componente BOTÕES. A janela pode ser fechada pelo botão ×, pelo fundo externo ou pela tecla Esc.
- O layout é fluido no desktop, ajusta espaçamentos no tablet e reduz controles/espacamentos no mobile.

## Áudio

A atividade gera áudio exclusivamente para os feedbacks:

- `ligapontos_a`: `<feedcerto>`
- `ligapontos_b`: `<feedErrao>`

Quando aninhado, o prefixo hierárquico do pai é preservado (por exemplo, `abas_a_ligapontos_a`). Opções e respostas não geram narração automática. Componentes interativos colocados dentro desses blocos continuam recebendo seus próprios IDs hierárquicos.

## Arquivos

- `ligapontos.js`: interpretação do roteiro e geração da marcação HTML.
- `ligapontos.html`: estrutura visual, CSS isolado e lógica de interação.
- `README.md`: documentação de uso.

## Limitações conhecidas

A marcação segue o modelo de delimitadores do Automato: `<opcao>`, `<resposta>` e os feedbacks iniciam seus respectivos trechos; seus fechamentos são opcionais. O fechamento `</ligapontos>` é obrigatório.


### Disposição visual das colunas

- As opções ficam na coluna esquerda, com o texto alinhado à direita e o ponto de conexão imediatamente depois do texto.
- As respostas ficam na coluna direita, com o texto alinhado à esquerda e o ponto de conexão imediatamente antes do texto.
- O espaço entre as colunas é ampliado em desktop e tablet para oferecer uma área central maior às linhas.
- O espaçamento vertical entre os itens foi reduzido.
- Em mobile, o vão central é reduzido proporcionalmente para evitar rolagem horizontal.
- O botão de submissão e a janela de feedback permanecem sem alterações.


### Tipografia

- Textos das opções e respostas utilizam 16px, acompanhando o tamanho-base do sistema em desktop, tablet e mobile.
- O texto do botão de submissão também utiliza 16px.
