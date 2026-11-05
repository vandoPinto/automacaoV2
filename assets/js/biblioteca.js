
(() => {
  const grid = document.getElementById("componentGrid");
  const search = document.getElementById("componentSearch");
  const empty = document.getElementById("emptySearch");
  const feedback = document.getElementById("copyFeedback");

  search?.addEventListener("input", () => {
    const term = search.value.trim().toLocaleLowerCase("pt-BR");
    let visible = 0;
    grid.querySelectorAll(".component-column").forEach(card => {
      const show = card.dataset.search.includes(term);
      card.hidden = !show;
      if (show) visible++;
    });
    empty.hidden = visible !== 0;
  });

  grid?.addEventListener("click", async event => {
    const button = event.target.closest(".copy-component");
    if (!button) return;
    const slug = button.dataset.component;
    const example = window.componentExamples?.[slug];
    if (!example) return;
    try {
      await navigator.clipboard.writeText(example.replace(/\\n/g, "\n"));
      feedback.classList.add("show");
      button.innerHTML = '<i class="bi bi-check2 me-2"></i>Copiado';
      window.setTimeout(() => {
        feedback.classList.remove("show");
        button.innerHTML = '<i class="bi bi-clipboard me-2"></i>Copiar estrutura';
      }, 1800);
    } catch (error) {
      const area = document.createElement("textarea");
      area.value = example.replace(/\\n/g, "\n");
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      if (copied) {
        feedback.classList.add("show");
        window.setTimeout(() => feedback.classList.remove("show"), 1800);
      } else {
        alert("Não foi possível copiar automaticamente. Tente novamente pelo navegador.");
      }
    }
  });
})();
