const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao } = require("../ExtrairAudiosComponentes");

// Reprodução da estrutura da Tabela 2, linha 12, do Modelo_Roteiro_AIM.docx.
// A ordem dos marcadores e os fechamentos explícitos foram preservados.
const entrada = `<sanfona>
<botao>Texto introdutório
<janela>
<p>Escreva uma breve explicação sobre o conteúdo que será apresentado nos botões.</p>
<p>hotword (opcional)</p>
<p>Utilize para destacar uma palavra ou expressão no texto introdutório e associá-la a uma janela com conteúdo complementar.</p>
<botoes>
<botao>Botão 1
<janela><p>Texto dentro da janela.</p>
</botoes>
<botao>Botões
<janela>
<p>Insira os botões na ordem em que deseja que apareçam na tela. Você pode adicionar a quantidade necessária.</p>
<hotword>Botões
<janela><p>Mantenha a sequência de botões e janelas. Cada botão precisa ter sua janela correspondente para que a interação funcione corretamente.</p>
</hotword>
<botao>Janelas
<janela>
<p>Insira as janelas após os botões, mantendo a mesma ordem. A primeira janela corresponderá ao primeiro botão, a segunda ao segundo e assim sucessivamente.</p>
<botao>Conteúdo das janelas
<janela>
<p>Dentro de cada janela, insira o texto ou os elementos que deseja apresentar ao aluno. Você também pode utilizar o componente HOTWORD dentro de uma janela.</p>
<flashcard>
<frente>Teste de texto de frente.
<verso>Digite aqui a resposta ou explicação que aparecerá no verso.
<frente>
<verso>Digite aqui a resposta ou explicação que aparecerá no verso.
<botoes>
<botao>Botão dentro flashcard
<janela>Janela do botão de dentro do flash card.
</botoes>
<botoes>
<botao>Botão dentro flashcard
<janela>Janela do botão de dentro do flash card.
</botoes>
<frente>
<verso>Digite aqui a resposta ou explicação que aparecerá no verso testando.
<hotword>testando
<janela>Janela do hotword de dentro do flash card.
</hotword>
<frente>
<verso>Digite aqui a resposta ou explicação que aparecerá no verso.
<botoes>
<botao>Botão dentro flashcard
<janela>Janela do botão de dentro do flash card.
</botoes>
<frente>
<verso>Digite aqui a resposta ou explicação que aparecerá no verso.
<botoes>
<botao>Botão dentro flashcard
<janela>Janela do botão de dentro do flash card.
</botoes>
</flashcard>
</sanfona>
<p>Texto complementar depois da sanfona.</p>`;

async function executar() {
    const html = await processarComponente("tela", entrada, 10, 10);
    const idsJson = processarRegiao(entrada).audios.map(item => item.nomeSufixo);

    // Quatro painéis da SANFONA, mantendo seus IDs por ordem.
    for (const id of ["sanfona_a", "sanfona_b", "sanfona_c", "sanfona_d"]) {
        assert(html.includes(`data-audio-id="${id}"`), `HTML deve conter data-audio-id=${id}`);
        assert(idsJson.includes(id), `sonorizacao.json deve conter ${id}; encontrados: ${idsJson.join(", ")}`);
    }

    // Componentes internos e seus caminhos hierárquicos.
    const idsInternos = [
        "sanfona_a_botoes_a",
        "sanfona_b_hotword_a",
        "sanfona_d_flashcard_a_verso",
        "sanfona_d_flashcard_b_verso",
        "sanfona_d_flashcard_b_botoes_a",
        "sanfona_d_flashcard_b_botoes2_a",
        "sanfona_d_flashcard_c_verso",
        "sanfona_d_flashcard_c_hotword_a",
        "sanfona_d_flashcard_d_verso",
        "sanfona_d_flashcard_d_botoes_a",
        "sanfona_d_flashcard_e_verso",
        "sanfona_d_flashcard_e_botoes_a"
    ];
    for (const id of idsInternos) {
        assert(html.includes(`data-audio-id="${id}"`), `HTML deve conter data-audio-id=${id}`);
        assert(idsJson.includes(id), `sonorizacao.json deve conter ${id}; encontrados: ${idsJson.join(", ")}`);
    }

    assert((html.match(/class="sanfona-item"/g) || []).length === 4,
        "A SANFONA deve gerar exatamente quatro painéis");
    assert(html.includes("Texto complementar depois da sanfona."),
        "O conteúdo posterior deve permanecer fora da SANFONA");
    assert((html.match(/data-audio-id=/g) || []).length === new Set(
        [...html.matchAll(/data-audio-id="([^"]+)"/g)].map(m => m[1])
    ).size, "Os IDs de áudio do HTML devem ser exclusivos");

    console.log("✓ Roteiro real: SANFONA gera quatro painéis na ordem original.");
    console.log("✓ BOTÕES, HOTWORD e FLASHCARD permanecem aninhados nos painéis corretos.");
    console.log("✓ IDs hierárquicos do HTML correspondem aos IDs extraídos para sonorizacao.json.");
    console.log("✓ Texto posterior à SANFONA é preservado.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
