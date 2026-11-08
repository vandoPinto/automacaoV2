(() => {
  const grid = document.getElementById("componentGrid");
  const search = document.getElementById("componentSearch");
  const empty = document.getElementById("emptySearch");
  const feedback = document.getElementById("copyFeedback");

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

  async function copiarTexto(texto) {
    // A Clipboard API exige contexto seguro (HTTPS ou localhost) e permissão.
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }

    // Fallback para navegadores/contextos sem Clipboard API.
    const area = document.createElement("textarea");
    area.value = texto;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "0";
    area.style.left = "-9999px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.focus();
    area.select();
    area.setSelectionRange(0, area.value.length);

    let sucesso = false;
    try {
      sucesso = document.execCommand("copy");
    } finally {
      area.remove();
    }
    if (!sucesso) throw new Error("O navegador bloqueou a cópia.");
    return true;
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
    const example = window.componentExamples?.[slug];
    if (typeof example !== "string" || !example.trim()) {
      mostrarFeedback("Exemplo não encontrado para este componente.", false);
      return;
    }

    // Preserva quebras de linha do exemplo cadastrado no servidor.
    const texto = example.replace(/\\n/g, "\n").trim() + "\n";
    const original = button.innerHTML;
    button.disabled = true;

    try {
      await copiarTexto(texto);
      mostrarFeedback("Estrutura copiada para a área de transferência!");
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
