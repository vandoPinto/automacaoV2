(() => {
  "use strict";

  const CORES_CABECALHO = {
    destaque: "#9a3412",
    imagem: "#4f46e5",
    dividir: "#000000",
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
    forca: "#315f4c",
    video: "#c2414b",
    arquivo: "#7c3aed"
  };

  const escaparHtml = valor => String(valor ?? "").replace(/[&<>\"']/g, caractere => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[caractere]);

  function normalizarCelula(celula) {
    return typeof celula === "string" ? { texto: celula } : (celula || { texto: "" });
  }

  function conteudoTextoCelula(celula) {
    const valor = normalizarCelula(celula);
    if (valor.texto != null) return String(valor.texto);
    if (!valor.html) return "";
    const area = document.createElement("div");
    area.innerHTML = String(valor.html);
    return area.textContent || "";
  }

  function criarTabelaFormatada(estrutura, slug) {
    const larguras = estrutura.larguras || [];
    const totalColunas = larguras.length || 1;
    const cor = CORES_CABECALHO[slug] || "#64748b";
    const tamanho = Number(estrutura.tamanho) || 9;
    const tamanhoCabecalho = Number(estrutura.tamanhoCabecalho) || tamanho;
    const corBorda = estrutura.corBorda || "#000000";
    const espessuraBorda = Number(estrutura.espessuraBorda) || 0.5;
    const estiloTabela = `width:100%;border-collapse:collapse;table-layout:fixed;border:${espessuraBorda}pt solid ${corBorda};font-family:'Times New Roman',serif;font-size:${tamanho}pt;color:#000000;mso-table-lspace:0pt;mso-table-rspace:0pt;`;
    const estiloCelula = `border:${espessuraBorda}pt solid ${corBorda};padding:3pt 4pt;vertical-align:middle;font-family:'Times New Roman',serif;font-size:${tamanho}pt;color:#000000;`;
    const colunas = larguras.map(largura => `<col style="width:${Number(largura)}%;">`).join("");
    const alinhamentoCabecalho = slug === "dividir" ? "center" : (estrutura.alinhamentoCabecalho || "left");
    const tituloCabecalho = escaparHtml(estrutura.titulo);
    const cabecalho = slug === "dividir"
      ? `<tr bgcolor="${cor}" style="background:${cor};background-color:${cor};"><td colspan="${totalColunas}" align="center" valign="middle" bgcolor="${cor}" style="${estiloCelula}background:${cor};background-color:${cor};mso-shading:fill ${cor};color:#ffffff;font-size:${tamanhoCabecalho}pt;font-weight:bold;text-align:center;"><p class="MsoNormal" align="center" style="margin:0;mso-para-margin:0cm;text-align:center;mso-line-height-alt:12pt;"><span style="color:#ffffff;font-size:${tamanhoCabecalho}pt;font-weight:bold;">${tituloCabecalho}</span></p></td></tr>`
      : `<tr bgcolor="${cor}" style="background:${cor};background-color:${cor};"><td colspan="${totalColunas}" align="${alinhamentoCabecalho}" valign="middle" bgcolor="${cor}" style="${estiloCelula}background:${cor};background-color:${cor};mso-shading:fill ${cor};color:#ffffff;font-size:${tamanhoCabecalho}pt;font-weight:bold;text-align:${alinhamentoCabecalho};">${tituloCabecalho}</td></tr>`;
    const linhaComplementarDividir = slug === "dividir"
      ? `<tr bgcolor="${cor}" style="background:${cor};background-color:${cor};"><td colspan="${totalColunas}" height="1" bgcolor="${cor}" style="border:${espessuraBorda}pt solid ${corBorda};height:1pt;line-height:1pt;padding:0;background:${cor};background-color:${cor};mso-shading:fill ${cor};font-size:1pt;">&nbsp;</td></tr>`
      : "";
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
        const conteudo = celula.html != null
          ? String(celula.html)
          : (celula.texto ? escaparHtml(celula.texto) : "&nbsp;");
        return `<td${atributoColspan} style="${estiloCelula}${estiloLargura}${estiloPeso}">${conteudo}</td>`;
      }).join("");
      return `<tr>${celulas}</tr>`;
    }).join("");

    return `<table border="1" cellpadding="0" cellspacing="0" style="${estiloTabela}"><colgroup>${colunas}</colgroup><tbody>${cabecalho}${linhaComplementarDividir}${linhas}</tbody></table>`;
  }

  function criarTextoTabela(estrutura) {
    const linhas = [estrutura.titulo || ""];
    (estrutura.linhas || []).forEach(linha => {
      linhas.push(linha.map(celula => conteudoTextoCelula(celula)).join("\t"));
    });
    return linhas.join("\n");
  }

  async function copiarHtmlFormatado(html, textoCopiado) {
    if (navigator.clipboard?.write && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([new window.ClipboardItem({
          "text/html": new window.Blob([html], { type: "text/html" }),
          "text/plain": new window.Blob([textoCopiado], { type: "text/plain" })
        })]);
        return;
      } catch (_) {
        // Continua pelo caminho de seleção e cópia do navegador.
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
      throw new Error("O navegador não permite selecionar o conteúdo para cópia.");
    }
    const intervalosOriginais = [];
    for (let indice = 0; indice < selecao.rangeCount; indice++) intervalosOriginais.push(selecao.getRangeAt(indice).cloneRange());
    let copiou = false;
    try {
      const intervalo = document.createRange();
      intervalo.selectNodeContents(area);
      selecao.removeAllRanges();
      selecao.addRange(intervalo);
      copiou = document.execCommand("copy");
    } finally {
      selecao.removeAllRanges();
      intervalosOriginais.forEach(intervalo => selecao.addRange(intervalo));
      area.remove();
    }
    if (!copiou) throw new Error("O navegador não conseguiu copiar o conteúdo formatado.");
  }

  window.AutomatoComponentTableTransfer = Object.freeze({
    coresCabecalho: Object.freeze({ ...CORES_CABECALHO }),
    escaparHtml,
    criarTabelaFormatada,
    criarTextoTabela,
    copiarHtmlFormatado
  });
})();
