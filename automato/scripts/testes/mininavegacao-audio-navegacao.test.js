const assert = require("assert");
const fs = require("fs");
const path = require("path");

const templatePath = path.join(__dirname, "../Componentes/mininavegacao/mininavegacao.html");
const template = fs.readFileSync(templatePath, "utf8");

assert.match(template, /const solicitarAudioPainel\s*=\s*\(indice\)\s*=>/);
assert.match(template, /getAttribute\("data-audio-id"\)/);
assert.match(template, /new CustomEvent\("stopAudio"\)/);
assert.match(template, /new CustomEvent\("playAudio",\s*\{\s*detail:\s*\{\s*comp:\s*audioId\s*\}\s*\}\)/);
assert.match(template, /voltar\.addEventListener\("click",\s*\(\)\s*=>\s*ativar\(atual-1,\s*true\)\)/);
assert.match(template, /avancar\.addEventListener\("click",\s*\(\)\s*=>\s*ativar\(atual\+1,\s*true\)\)/);
assert.match(template, /if\(reproduzirAudio\s*&&\s*atual!==anterior\)\s*solicitarAudioPainel\(atual\)/);

console.log("✓ MININAVEGACAO interrompe o áudio anterior e reproduz o áudio do painel ao avançar e voltar.");
