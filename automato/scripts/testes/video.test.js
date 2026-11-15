const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { interpretarTabelasComponentes } = require("../InterpretarTabelasComponentes");
const interpretarVideo = require("../Componentes/video/video");
const { normalizarFonteArquivo } = interpretarVideo;
const { processarComponente } = require("../ProcessarComponentesAninhados");

async function executar() {
  const tabela = `
    <table>
      <tr><td colspan="2">VÍDEO</td></tr>
      <tr><td>Assistir arquivo</td><td>aula 01.mp4 (abre em um modal)</td></tr>
      <tr><td>Assistir YouTube</td><td><a href="https://youtu.be/M7lc1UVf-VE">Link do YouTube (abre em um modal)</a></td></tr>
      <tr><td></td><td>extra.webm (coloca na tela o player de vídeo com controles)</td></tr>
      <tr><td></td><td>https://www.youtube.com/watch?v=M7lc1UVf-VE (coloca na tela o player de vídeo com controles)</td></tr>
    </table>`;

  const convertido = interpretarTabelasComponentes(tabela);
  assert.match(convertido, /<componente tipo="video">/);
  assert.equal((convertido.match(/<videoitem\b/g) || []).length, 4);
  assert.match(convertido, /data-modo="modal" data-origem="arquivo" data-rotulo="Assistir arquivo">aula 01\.mp4<\/videoitem>/);
  assert.match(convertido, /data-modo="modal" data-origem="youtube" data-rotulo="Assistir YouTube">https:\/\/youtu\.be\/M7lc1UVf-VE<\/videoitem>/);
  assert.match(convertido, /data-modo="direto" data-origem="arquivo" data-rotulo="">extra\.webm<\/videoitem>/);
  assert.match(convertido, /data-modo="direto" data-origem="youtube" data-rotulo="">https:\/\/www\.youtube\.com\/watch\?v=M7lc1UVf-VE<\/videoitem>/);

  const html = await interpretarVideo(convertido, 1, 1, { contexto: "teste-video" });
  assert.equal((html.match(/<video controls playsinline/g) || []).length, 2, "arquivo direto e modal usam controles nativos");
  assert.equal((html.match(/<iframe/g) || []).length, 2, "YouTube direto e modal geram iframe");
  assert.match(html, /data-video-src="arquivos\/aula%2001\.mp4"/);
  assert.match(html, /youtube-nocookie\.com\/embed\/M7lc1UVf-VE\?controls=1[^\"]*autoplay=1/);
  assert.match(html, /<video controls playsinline preload="metadata" src="arquivos\/extra\.webm">/);
  assert.match(html, /pagehide/);
  assert.match(html, /currentTime = 0/);
  assert.match(html, /new MutationObserver/);
  assert.match(html, /modais\.forEach\(function \(modal\) \{ modal\.remove\(\); \}\)/);
  assert.match(html, /data-video-abrir/);
  assert.match(html, /object-fit: contain/);
  assert.match(html, /100dvh/);

  const regraDimensionamentoDireto = html.match(/\/\* Só o player colocado diretamente[\s\S]*?\n    }\n\n    \.video-componente-erro/);
  assert.ok(regraDimensionamentoDireto, "O player direto deve ter uma regra própria para a Tela.");
  assert.match(regraDimensionamentoDireto[0], /\.tela-container \.conteudo-item/);
  assert.doesNotMatch(regraDimensionamentoDireto[0], /(?<!\.tela-container )\.video-componente-item\[data-video-item="direto"\] \.video-componente-player/,
    "O redimensionamento da Tela não pode vazar para janelas com componentes aninhados.");

  const templateBotao = fs.readFileSync(path.join(__dirname, "../Componentes/botao/botao.html"), "utf8");
  assert.match(templateBotao, /\.botao-janela-conteudo:has\(\.video-componente\)/,
    "Janelas de botão devem dimensionar e centralizar players aninhados.");
  assert.match(templateBotao, /\.botao-janela-texto:has\(\.video-componente\) \.video-componente/);

  const telaGerada = await processarComponente("tela", convertido, 1, 2);
  assert.match(telaGerada, /video-componente-player/);
  assert.match(telaGerada, /data-video-abrir/);
  assert.match(telaGerada, /youtube-nocookie\.com\/embed\/M7lc1UVf-VE/);
  assert.equal(normalizarFonteArquivo("user guide.mp4"), "arquivos/user%20guide.mp4");
  assert.equal(normalizarFonteArquivo("arquivos/user guide.mp4"), "arquivos/user%20guide.mp4");
  assert.equal(normalizarFonteArquivo("videos/user guide.mp4"), "arquivos/user%20guide.mp4", "caminho antigo videos/ deve apontar para a nova pasta");
  assert.throws(() => normalizarFonteArquivo("../fora.mp4"), /pasta arquivos/);
  const arquivoDeExemplo = path.resolve(__dirname, "../../public/exe", decodeURIComponent(normalizarFonteArquivo("user-guide.mp4")));
  assert.ok(fs.existsSync(arquivoDeExemplo), "o caminho normalizado encontra um arquivo de vídeo real da pasta arquivos do curso");

  const template = fs.readFileSync(path.join(__dirname, "../Componentes/video/video.html"), "utf8");
  const script = template.match(/<script>([\s\S]*?)<\/script>/i)?.[1];
  assert.ok(script, "O template do componente deve conter a lógica de reprodução.");
  assert.doesNotThrow(() => new Function(script), "O script do template precisa estar sintaticamente válido.");

  console.log("✓ Tabela VÍDEO reconhece fonte, modo e rótulo para as quatro combinações.");
  console.log("✓ Player direto e modal geram controles, autoplay no modal e parada ao fechar/navegar.");
}

executar().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
