function removerAtualizacaoGlobal(html) {
  return String(html || "")
    .replace(/^[\t ]*<link\b(?=[^>]*\bhref\s*=\s*["']\/assets\/css\/atualizacao-global\.css["'])[^>]*\/?>(?:[\t ]*\r?\n|[\t ]*$)/gim, "")
    .replace(/^[\t ]*<script\b(?=[^>]*\bsrc\s*=\s*["']\/assets\/js\/atualizacao-global\.js["'])[^>]*>\s*<\/script\s*>(?:[\t ]*\r?\n|[\t ]*$)/gim, "")
    .replace(/\s+data-atualizacao-janela\s*=\s*(["'])curso\1/gi, "");
}

module.exports = { removerAtualizacaoGlobal };
