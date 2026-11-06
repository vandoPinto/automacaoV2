const assert = require('assert');
const { processarComponente } = require('../ProcessarComponentesAninhados');
const { processarRegiao } = require('../ExtrairAudiosComponentes');

const entrada = `<abas>
<aba>Primeira</aba><janela><p>Painel A</p>
<botoes><botao><p>A1</p><janela><p>Texto A1</p></botoes>
<botoes><botao><p>A2</p><janela><p>Texto A2</p></botoes>
<aba>Segunda</aba><janela><p>Painel B</p>
<botoes><botao><p>B1</p><janela><p>Texto B1</p></botoes>
</abas>`;

(async () => {
  const html = await processarComponente('tela', entrada, 1, 611);
  const idsHtml = [...html.matchAll(/data-audio-id="([^"]+)"/g)].map(x => x[1]);
  const idsJson = processarRegiao(entrada).audios.map(x => x.nomeSufixo);
  const esperados = ['abas_a', 'abas_a_botoes_a', 'abas_a_botoes2_a', 'abas_b', 'abas_b_botoes_a'];
  assert.deepStrictEqual(idsHtml, esperados);
  assert.deepStrictEqual(idsJson, esperados);
  console.log('✓ BOTÕES dentro de ABAS preservam a aba-pai e a numeração dos grupos.');
})().catch(e => { console.error(e); process.exitCode = 1; });
