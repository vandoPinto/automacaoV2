(() => {
  const grid = document.getElementById("componentGrid");
  const search = document.getElementById("componentSearch");
  const empty = document.getElementById("emptySearch");
  const feedback = document.getElementById("copyFeedback");
  const CORES_CABECALHO_EDITOR = {
    botao: "#7c3aed",
    hotword: "#2674d9",
    abas: "#239447",
    flashcard: "#078b8d",
    opcoes: "#2674d9",
    verdadeirofalso: "#078b8d",
    jogomemoria: "#bd7a08",
    mininavegacao: "#0786a8",
    sanfona: "#d46a16",
    ligapontos: "#d63384",
    relacionarcolunas: "#d63384",
    forca: "#315f4c"
  };

  const escaparHtml = valor => String(valor ?? "").replace(/[&<>\"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[caractere]);

  function normalizarCelula(celula) {
    return typeof celula === "string" ? { texto: celula } : (celula || { texto: "" });
  }

  function criarTabelaFormatada(estrutura, slug) {
    const larguras = estrutura.larguras || [];
    const totalColunas = larguras.length || 1;
    const cor = CORES_CABECALHO_EDITOR[slug] || "#64748b";
    const tamanho = Number(estrutura.tamanho) || 9;
    const tamanhoCabecalho = Number(estrutura.tamanhoCabecalho) || tamanho;
    const corBorda = estrutura.corBorda || "#000000";
    const espessuraBorda = Number(estrutura.espessuraBorda) || 0.5;
    const estiloTabela = `width:100%;border-collapse:collapse;table-layout:fixed;border:${espessuraBorda}pt solid ${corBorda};font-family:'Times New Roman',serif;font-size:${tamanho}pt;color:#000000;mso-table-lspace:0pt;mso-table-rspace:0pt;`;
    const estiloCelula = `border:${espessuraBorda}pt solid ${corBorda};padding:3pt 4pt;vertical-align:middle;font-family:'Times New Roman',serif;font-size:${tamanho}pt;color:#000000;`;
    const colunas = larguras.map(largura => `<col style="width:${Number(largura)}%;">`).join("");
    const cabecalho = `<tr><td colspan="${totalColunas}" bgcolor="${cor}" style="${estiloCelula}background-color:${cor};color:#ffffff;font-size:${tamanhoCabecalho}pt;font-weight:bold;">${escaparHtml(estrutura.titulo)}</td></tr>`;
    const linhas = (estrutura.linhas || []).map(linha => {
      let indiceColuna = 0;
      const celulas = linha.map(valor => {
        const celula = normalizarCelula(valor);
        const colspan = Math.max(1, Math.min(totalColunas - indiceColuna, Number(celula.colspan) || 1));
        const largura = larguras.slice(indiceColuna, indiceColuna + colspan).reduce((soma, item) => soma + Number(item || 0), 0);
        indiceColuna += colspan;
        const atributoColspan = colspan > 1 ? ` colspan="${colspan}"` : "";
        const estiloLargura = largura ? `width:${largura}%;` : "";
        const estiloPeso = celula.bold ? "font-weight:bold;" : "";
        const conteudo = celula.texto ? escaparHtml(celula.texto) : "&nbsp;";
        return `<td${atributoColspan} style="${estiloCelula}${estiloLargura}${estiloPeso}">${conteudo}</td>`;
      }).join("");
      return `<tr>${celulas}</tr>`;
    }).join("");

    return `<table border="1" cellpadding="0" cellspacing="0" style="${estiloTabela}"><colgroup>${colunas}</colgroup><tbody>${cabecalho}${linhas}</tbody></table>`;
  }

  function criarTextoTabela(estrutura) {
    const linhas = [estrutura.titulo || ""];
    (estrutura.linhas || []).forEach(linha => {
      linhas.push(linha.map(valor => normalizarCelula(valor).texto || "").join("\t"));
    });
    return linhas.join("\n");
  }

  async function copiarTabelaFormatada(html, textoCopiado) {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new window.ClipboardItem({
          "text/html": new window.Blob([html], { type: "text/html" }),
          "text/plain": new window.Blob([textoCopiado], { type: "text/plain" })
        })]);
        return;
      } catch (_) {
        // Tenta o mesmo caminho de cópia de uma tabela renderizada no navegador.
      }
    }

    const area = document.createElement("div");
    area.setAttribute("aria-hidden", "true");
    area.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;opacity:.01;pointer-events:none;";
    area.innerHTML = html;
    document.body.appendChild(area);

    const selecao = window.getSelection();
    if (!selecao) {
      area.remove();
      throw new Error("O navegador não permite selecionar a tabela para cópia.");
    }
    const intervalosOriginais = [];
    if (selecao) {
      for (let indice = 0; indice < selecao.rangeCount; indice++) intervalosOriginais.push(selecao.getRangeAt(indice).cloneRange());
    }
    let copiou = false;
    try {
      const intervalo = document.createRange();
      intervalo.selectNodeContents(area.querySelector("table"));
      selecao.removeAllRanges();
      selecao.addRange(intervalo);
      copiou = document.execCommand("copy");
    } finally {
      selecao?.removeAllRanges();
      intervalosOriginais.forEach(intervalo => selecao?.addRange(intervalo));
      area.remove();
    }
    if (!copiou) throw new Error("O navegador não conseguiu copiar a tabela formatada.");
  }

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
      const textoCopiado = criarTextoTabela(tableExample);
      const html = criarTabelaFormatada(tableExample, slug);
      await copiarTabelaFormatada(html, textoCopiado);
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
