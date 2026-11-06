const assert = require("assert");
const { processarComponente } = require("../ProcessarComponentesAninhados");
const { processarRegiao } = require("../ExtrairAudiosComponentes");

const entrada = `<mininavegacao>
  <janela><p>Painel A</p>
    <botoes><botao><p>A1</p><janela><p>Texto A1</p></botoes>
    <botoes><botao><p>A2</p><janela><p>Texto A2</p></botoes>
  <janela><p>Painel B</p>
    <botoes><botao><p>B1</p><janela><p>Texto B1</p></botoes>
</mininavegacao>`;

function ids(html) {
  return [...String(html || "").matchAll(/data-audio-id="([^"]+)"/g)].map(match => match[1]);
}

(async () => {
  const html = await processarComponente("tela", entrada, 1, 701);
  const esperados = [
    "mininavegacao_a",
    "mininavegacao_a_botoes_a",
    "mininavegacao_a_botoes2_a",
    "mininavegacao_b",
    "mininavegacao_b_botoes_a"
  ];
  assert.deepStrictEqual(ids(html), esperados);
  assert.deepStrictEqual(
    processarRegiao(entrada).audios.map(audio => audio.nomeSufixo),
    esperados
  );

  const htmlAninhado = await processarComponente(
    "mininavegacao", entrada, 1, 702,
    { prefixoAudio: "abas_a", contexto: "teste-abas-mininavegacao" }
  );
  const esperadosAninhados = [
    "abas_a_mininavegacao_a",
    "abas_a_mininavegacao_a_botoes_a",
    "abas_a_mininavegacao_a_botoes2_a",
    "abas_a_mininavegacao_b",
    "abas_a_mininavegacao_b_botoes_a"
  ];
  assert.deepStrictEqual(ids(htmlAninhado), esperadosAninhados);
  assert.deepStrictEqual(
    processarRegiao(entrada, ["abas", "a"]).audios.map(audio => audio.nomeSufixo),
    esperadosAninhados
  );

  console.log("✓ MININAVEGACAO gera IDs dos painéis e BOTÕES conforme sonorizacao.json.");
  console.log("✓ Grupos repetidos e MININAVEGACAO aninhada preservam a hierarquia.");
})().catch(erro => {
  console.error(erro);
  process.exitCode = 1;
});
