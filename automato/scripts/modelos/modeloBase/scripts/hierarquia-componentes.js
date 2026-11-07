/* Calcula a profundidade visual sem interferir na lógica dos componentes. */
(function () {
  "use strict";

  var SELETOR = [
    ".sanfona-componente",
    ".abas-componente",
    ".flashcard-componente",
    ".botao-grupo",
    ".hotword-componente",
    ".mini-nav-componente"
  ].join(",");

  function atualizarProfundidades(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;

    var componentes = Array.prototype.slice.call(raiz.querySelectorAll(SELETOR));

    componentes.forEach(function (componente) {
      var profundidade = 0;
      var ancestral = componente.parentElement;

      while (ancestral && ancestral !== document.documentElement) {
        if (ancestral.matches && ancestral.matches(SELETOR)) profundidade++;
        ancestral = ancestral.parentElement;
      }

      var valor = String(Math.min(profundidade, 7));
      componente.setAttribute("data-automato-componente", "");
      if (componente.getAttribute("data-visual-depth") !== valor) {
        componente.setAttribute("data-visual-depth", valor);
      }
    });
  }

  function iniciar() {
    var alvo = document.querySelector("conteudo") || document.body;
    atualizarProfundidades(alvo);

    if (!window.MutationObserver) return;

    var observador = new MutationObserver(function (mutacoes) {
      mutacoes.forEach(function (mutacao) {
        mutacao.addedNodes.forEach(function (no) {
          if (no.nodeType !== 1) return;
          if (no.matches && no.matches(SELETOR)) {
            atualizarProfundidades(no.parentElement || alvo);
          } else if (no.querySelectorAll && no.querySelector(SELETOR)) {
            atualizarProfundidades(no);
          }
        });
      });
    });

    observador.observe(alvo, { childList: true, subtree: true });
    window.__automatoHierarquiaVisualObserver = observador;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();