const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao } = require("../ExtrairAudiosComponentes");

async function executar() {
    const entrada = `<sanfona>
        <botao>Texto introdutório</botao>
        <janela>
            <p>Escreva uma breve explicação sobre o conteúdo que será apresentado nos botões.</p>
            <botoes><botao>Botão 1</botao><janela><p>Texto dentro da janela.</p></janela></botoes>
        </janela>
        <botao>Botões</botao>
        <janela>
            <p>Insira os botões na ordem em que deseja que apareçam na tela. Você pode adicionar a quantidade necessária.</p>
            <hotword>botões<janela><p>Mantenha a sequência de botões e janelas. Cada botão precisa ter sua janela correspondente para que a interação funcione corretamente.</p></janela></hotword>
        </janela>
    </sanfona>`;

    const html = await processarComponente("tela", entrada, 10, 10);
    const idsJson = processarRegiao(entrada).audios.map(item => item.nomeSufixo);

    for (const id of ["sanfona_a", "sanfona_a_botoes_a", "sanfona_b", "sanfona_b_hotword_a"]) {
        assert(html.includes(`data-audio-id="${id}"`), `HTML deve conter data-audio-id=${id}`);
        assert(idsJson.includes(id), `sonorizacao.json deve conter ${id}; encontrados: ${idsJson.join(", ")}`);
    }

    const hotword = require("../Componentes/hotword/hotword");
    const htmlHotword = await hotword(
        `<p>Insira os botões.</p><hotword>botões<janela><p>Explicação.</p></janela></hotword>`,
        10,
        10,
        { contexto: "teste-hotword", prefixoAudio: "sanfona_b", tipoAudioHotword: "hotword" }
    );
    assert(htmlHotword.includes('data-audio-id="sanfona_b_hotword_a"'));

    const templateHotword = fs.readFileSync(
        path.join(__dirname, "../Componentes/hotword/hotword.html"), "utf8"
    );
    assert(templateHotword.includes('dispararEventoAudio("playAudio", { comp: audioId })'));
    assert(templateHotword.includes('dispararEventoAudio("stopAudio")'));

    console.log("✓ BOTÕES dentro de SANFONA herdam o prefixo do painel.");
    console.log("✓ HOTWORD dentro de SANFONA recebe ID hierárquico e reproduz/interrompe o áudio.");
    console.log("✓ IDs do HTML correspondem aos IDs extraídos para sonorizacao.json.");
}

executar().catch(erro => {
    console.error(erro);
    process.exitCode = 1;
});
