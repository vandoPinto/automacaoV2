(() => {
  const grid = document.getElementById("componentGrid");
  const search = document.getElementById("componentSearch");
  const empty = document.getElementById("emptySearch");
  const feedback = document.getElementById("copyFeedback");
  const transfer = window.AutomatoComponentTableTransfer;

  function mostrarFeedback(mensagem, sucesso = true) {
    if (!feedback) return;
    feedback.textContent = mensagem;
    feedback.classList.toggle("copy-feedback--error", !sucesso);
    feedback.classList.add("show");
    window.clearTimeout(mostrarFeedback.timer);
    mostrarFeedback.timer = window.setTimeout(() => {
      feedback.classList.remove("show", "copy-feedback--error");
    }, 2200);
  }

  search?.addEventListener("input", () => {
    const term = search.value.trim().toLocaleLowerCase("pt-BR");
    let visible = 0;
    grid?.querySelectorAll(".component-column").forEach(card => {
      const show = (card.dataset.search || "").includes(term);
      card.hidden = !show;
      if (show) visible++;
    });
    if (empty) empty.hidden = visible !== 0;
  });

  grid?.addEventListener("click", async event => {
    const button = event.target.closest(".copy-component");
    if (!button) return;

    const slug = button.dataset.component;
    const tableExample = window.componentTableExamples?.[slug];
    if (!tableExample || !tableExample.titulo || !Array.isArray(tableExample.linhas)) {
      mostrarFeedback("Exemplo não encontrado para este componente.", false);
      return;
    }

    const original = button.innerHTML;
    button.disabled = true;

    try {
      const textoCopiado = transfer.criarTextoTabela(tableExample);
      const html = transfer.criarTabelaFormatada(tableExample, slug);
      await transfer.copiarHtmlFormatado(html, textoCopiado);
      mostrarFeedback("Tabela copiada. Cole no Word para manter a formatação.");
      button.innerHTML = '<i class="bi bi-check2 me-2"></i>Copiado';
    } catch (error) {
      console.error("Erro ao copiar estrutura:", error);
      mostrarFeedback("Não foi possível copiar. Verifique a permissão do navegador.", false);
      button.innerHTML = original;
    } finally {
      window.setTimeout(() => {
        button.disabled = false;
        button.innerHTML = original;
      }, 1800);
    }
  });
})();
