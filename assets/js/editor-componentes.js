(() => {
  "use strict";

  const editor = document.getElementById("componentSourceEditor");
  const preview = document.getElementById("editorPreview");
  const previewFrame = document.getElementById("editorPreviewFrame");
  const previewPlaceholder = document.getElementById("editorPreviewPlaceholder");
  const previewInspectButton = document.getElementById("editorPreviewInspect");
  let previewInspectMode = false;
  let inspectHighlightTimer = null;
  let inspectHighlightNode = null;
  let inspectSequence = 0;
  const sourceCount = document.getElementById("editorSourceCount");
  const componentList = document.getElementById("editorComponentList");
  const searchInput = document.getElementById("editorComponentSearch");
  const editorLayout = document.querySelector(".editor-layout");
  const editorSidebar = document.getElementById("editorSidebar");
  const sidebarSplitter = document.getElementById("editorSidebarSplitter");
  const examples = window.editorComponentExamples || {};
  const toast = document.getElementById("editorToast");
  const screenList = document.getElementById("editorScreenList");
  const addScreenButton = document.getElementById("editorAddScreen");
  const columns = document.getElementById("editorColumns");
  const structurePanel = document.getElementById("editorStructurePanel");
  const columnsSplitter = document.getElementById("editorColumnsSplitter");
  const heightResizer = document.getElementById("editorHeightResizer");
  const largePreview = document.getElementById("editorLargePreview");
  const largePreviewStage = document.getElementById("editorLargePreviewStage");
  const largePreviewDevice = document.getElementById("editorLargePreviewDevice");
  const openLargePreviewButton = document.getElementById("editorOpenLargePreview");
  const openExternalPreviewButton = document.getElementById("editorOpenExternalPreview");
  const closeLargePreviewButton = document.getElementById("editorCloseLargePreview");
  const previewRestoreButton = document.getElementById("editorPreviewRestore");
  const largePreviewDeviceButtons = [...document.querySelectorAll("[data-preview-device]")];
  const visualRoot = document.getElementById("visualStructureEditor");
  const editorTextToolbar = document.getElementById("editorTextToolbar");
  const editorInsertImageButton = document.getElementById("editorInsertImage");
  const editorImageInput = document.getElementById("editorImageInput");
  const visualModeButton = document.getElementById("editorVisualMode");
  const codeModeButton = document.getElementById("editorCodeMode");
  let visualStructure = null;

  if (!editor || !preview || !previewFrame || !screenList) return;

  const screens = [
    { id: "screen-1", title: "Tela 1", source: "" },
    { id: "screen-2", title: "Tela 2", source: "" }
  ];
  let activeScreenId = "screen-1";
  let screenSequence = 2;
  let toastTimer = null;
  let previewTimer = null;
  let previewAbortController = null;
  let previewSequence = 0;
  let largePreviewDeviceMode = "desktop";
  let largePreviewScaleFrame = 0;
  let lateralPreviewScaleFrame = 0;
  let previewFrameHome = null;
  let externalPreviewWindow = null;
  let externalPreviewChannel = null;
  let externalPreviewCloseCheck = null;
  let externalPreviewToken = null;

  const DESKTOP_PREVIEW_WIDTH = 1200;
  const DESKTOP_PREVIEW_HEIGHT = 700;
  const PREVIEW_DEVICE_SIZES = Object.freeze({
    desktop: { width: 1200, height: 700, label: "Desktop" },
    tablet: { width: 820, height: 1180, label: "Tablet" },
    mobile: { width: 390, height: 844, label: "Mobile" }
  });

  function showToast(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible", "is-error"), 2800);
  }

  function getCurrentScreen() {
    return screens.find(screen => screen.id === activeScreenId) || screens[0];
  }

  function getSource() {
    return visualStructure ? visualStructure.getSource() : String(editor.value || "").replace(/\r\n?/g, "");
  }

  function updateCount() {
    const source = getSource();
    if (sourceCount) {
      const lines = source ? source.split("\n").length : 0;
      sourceCount.textContent = `${source.length.toLocaleString("pt-BR")} caracteres${lines ? ` · ${lines} linhas` : ""}`;
    }
  }

  function saveCurrentScreen() {
    const screen = getCurrentScreen();
    if (!screen) return;
    screen.source = getSource();
    renderScreenTabs();
  }

  function componentLabel(source) {
    const component = String(source || "").match(/<\s*componente\b[^>]*\btipo\s*=\s*["']([^"']+)["']/i);
    const legacy = String(source || "").match(/<\s*(botoes|botao|hotword|abas|flashcard|opcoes|verdadeirofalso|forca|jogomemoria|mininavegacao|sanfona|ligapontos|relacionarcolunas)\b/i);
    const type = (component?.[1] || legacy?.[1] || "").toLowerCase();
    const labels = {
      botoes: "Botões", botao: "Botões", hotword: "Hotword", abas: "Abas",
      flashcard: "Flashcard", opcoes: "Opções", verdadeirofalso: "Verdadeiro ou Falso", forca: "Forca", jogomemoria: "Jogo da memória", mininavegacao: "Mini navegação",
      sanfona: "Sanfona", ligapontos: "Liga-pontos", relacionarcolunas: "Relacionar Colunas"
    };
    return labels[type] || "Código HTML";
  }

  function sourceSample(source) {
    const text = String(source || "")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 78) || "Código do componente";
  }

  function buildScreenThumbnail(screen) {
    const wrapper = document.createElement("div");
    wrapper.className = `editor-screen-card-wrap${screen.id === activeScreenId ? " is-active" : ""}`;
    wrapper.dataset.screenWrapperId = screen.id;

    const card = document.createElement("button");
    card.type = "button";
    card.className = "editor-screen-card";
    card.dataset.screenId = screen.id;
    card.setAttribute("role", "tab");
    card.setAttribute("aria-selected", String(screen.id === activeScreenId));
    card.setAttribute("aria-label", `${screen.title}${screen.source.trim() ? ", contém código" : ", vazia"}`);

    const mini = document.createElement("span");
    mini.className = `editor-screen-thumbnail${screen.source.trim() ? "" : " is-empty"}`;

    if (!screen.source.trim()) {
      const empty = document.createElement("span");
      empty.className = "editor-screen-thumbnail-empty";
      empty.textContent = "Tela vazia";
      mini.appendChild(empty);
    } else {
      const type = document.createElement("span");
      type.className = "editor-screen-mini-type editor-screen-mini-type--generic";
      type.textContent = componentLabel(screen.source);
      mini.appendChild(type);

      const sample = document.createElement("span");
      sample.className = "editor-screen-mini-content";
      sample.textContent = sourceSample(screen.source);
      mini.appendChild(sample);
    }

    const caption = document.createElement("span");
    caption.className = "editor-screen-caption";
    caption.textContent = screen.title;
    card.append(mini, caption);
    wrapper.appendChild(card);

    if (screens.length > 1) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "editor-screen-delete";
      deleteButton.dataset.deleteScreenId = screen.id;
      deleteButton.setAttribute("aria-label", `Excluir ${screen.title}`);
      deleteButton.title = `Excluir ${screen.title}`;
      deleteButton.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
      wrapper.appendChild(deleteButton);
    }

    return wrapper;
  }

  function renderScreenTabs() {
    screenList.replaceChildren(...screens.map(buildScreenThumbnail));
  }

  function loadScreen(screenId, skipSaveCurrent = false) {
    if (!skipSaveCurrent) saveCurrentScreen();
    const screen = screens.find(item => item.id === screenId);
    if (!screen) return;

    activeScreenId = screen.id;
    editor.value = screen.source || "";
    visualStructure?.buildFromSource(editor.value);
    updateCount();
    renderScreenTabs();
    updatePreview();
  }

  function addScreen() {
    saveCurrentScreen();
    screenSequence += 1;
    const screen = { id: `screen-${screenSequence}`, title: `Tela ${screenSequence}`, source: "" };
    screens.push(screen);
    loadScreen(screen.id, true);
    visualStructure?.focus();
  }

  function deleteScreen(screenId) {
    if (screens.length <= 1) {
      showToast("O Editor precisa manter pelo menos uma tela.", true);
      return;
    }

    const index = screens.findIndex(screen => screen.id === screenId);
    if (index < 0) return;
    const screen = screens[index];
    if (!window.confirm(`Deseja excluir ${screen.title}? Todo o código dessa tela será perdido.`)) return;

    saveCurrentScreen();
    const wasActive = screen.id === activeScreenId;
    screens.splice(index, 1);
    if (wasActive) {
      const nextScreen = screens[Math.min(index, screens.length - 1)] || screens[0];
      loadScreen(nextScreen.id, true);
    } else {
      renderScreenTabs();
    }
    showToast(`${screen.title} foi excluída.`);
  }

  function normalizeInspectText(value) { return String(value || "").replace(/\s+/g, " ").trim(); }

  function inspectNodeText(node) {
    return normalizeInspectText(node?.innerText || node?.textContent || node?.alt || "");
  }

  function clearInspectHighlight() {
    inspectSequence += 1;
    window.clearTimeout(inspectHighlightTimer);
    inspectHighlightTimer = null;

    if (inspectHighlightNode) {
      inspectHighlightNode.getAnimations?.().forEach(animation => animation.cancel());
      inspectHighlightNode.classList.remove("is-inspect-highlight");
      inspectHighlightNode = null;
    }

    // Limpa também qualquer classe residual deixada por uma inspeção anterior.
    visualRoot?.querySelectorAll(".is-inspect-highlight").forEach(node => {
      node.getAnimations?.().forEach(animation => animation.cancel());
      node.classList.remove("is-inspect-highlight");
    });
    return inspectSequence;
  }

  function resolveInspectionGroup(node) {
    if (!node) return null;

    // Um campo pertencente a um conjunto repetível deve destacar o conjunto
    // mais interno, e não apenas uma janela ou o componente inteiro.
    const part = node.closest?.(".visual-part-card");
    const group = part?.closest(".visual-button-window-pair, .visual-structure-set");
    return group && visualRoot?.contains(group) ? group : node;
  }

  function locateInspectedElement(data, sequence = inspectSequence) {
    if (!visualRoot || !data) return;

    // Primeiro, usa a identidade serializada no próprio conteúdo da TELA.
    // Isso distingue texto livre da Tela de textos semelhantes dentro de
    // componentes filhos, sem depender de nomes, rótulos ou tipos específicos.
    const originId = String(data.originId || "").trim();
    let match = null;
    if (originId) {
      match = [...visualRoot.querySelectorAll("[data-automato-inspect-id]")]
        .find(node => node.getAttribute("data-automato-inspect-id") === originId) || null;
    }

    // Compatibilidade com prévias antigas/Modo Código, que ainda não carregam
    // o identificador de origem. Só aceita correspondência textual inequívoca.
    if (!match) {
      const wanted = normalizeInspectText(data.text);
      const chain = Array.isArray(data.chain) ? data.chain : [];
      const targetInfo = chain[chain.length - 1] || { tag: data.tag, text: wanted, alt: data.alt };
      const selectors = ".visual-text-block, .visual-slot, .visual-part-card, .visual-component, .visual-structure-set, .visual-button-window-pair, p, li, h1, h2, h3, h4, h5, h6, blockquote, pre, img";
      const candidates = [...visualRoot.querySelectorAll(selectors)];
      const isImage = targetInfo.tag === "img" || data.tag === "img" || data.alt || data.src;

      if (isImage) {
        const assetKey = value => {
          try { return decodeURIComponent(new URL(value, window.location.href).pathname).toLowerCase(); }
          catch (_) { return String(value || "").split(/[?#]/)[0].toLowerCase(); }
        };
        const srcKey = assetKey(data.src || targetInfo.src);
        if (srcKey) match = candidates.find(node => node.tagName === "IMG" && assetKey(node.getAttribute("src") || node.src) === srcKey) || null;
        if (!match && data.alt) match = candidates.find(node => node.tagName === "IMG" && node.alt === data.alt) || null;
      } else if (wanted) {
        const exact = candidates.filter(node =>
          /^(P|LI|H[1-6]|BLOCKQUOTE|PRE)$/.test(node.tagName) &&
          inspectNodeText(node) === wanted
        );
        if (exact.length === 1) match = exact[0];
      }
    }

    if (!match) {
      showToast("Não foi possível identificar a origem exata desse elemento na estrutura.", true);
      return;
    }

    const originMatch = match;

    // Cada inspeção começa com a Estrutura limpa: recolhe todos os componentes
    // e campos que estavam abertos. Em seguida, reabre somente o caminho entre
    // a raiz e a origem clicada, evitando deixar outros conjuntos expandidos.
    const setComponentCollapsed = (node, collapsed) => {
      if (!node?.classList?.contains("visual-component")) return;
      node.classList.toggle("is-collapsed", collapsed);
      const toggle = node.querySelector(":scope > .visual-component-header [data-visual-action='toggle']");
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-label", `${collapsed ? "Expandir" : "Recolher"} componente`);
        toggle.querySelector("i")?.classList.toggle("bi-chevron-right", collapsed);
        toggle.querySelector("i")?.classList.toggle("bi-chevron-down", !collapsed);
      }
    };
    const setPartCollapsed = (node, collapsed) => {
      if (!node?.classList?.contains("visual-part-card")) return;
      node.classList.toggle("is-collapsed", collapsed);
      const toggle = node.querySelector(":scope > .visual-part-header [data-visual-action='toggle-part']");
      if (toggle) {
        toggle.setAttribute("aria-expanded", String(!collapsed));
        toggle.setAttribute("aria-label", `${collapsed ? "Expandir" : "Recolher"} campo`);
        toggle.querySelector("i")?.classList.toggle("bi-chevron-right", collapsed);
        toggle.querySelector("i")?.classList.toggle("bi-chevron-down", !collapsed);
      }
    };

    visualRoot.querySelectorAll(".visual-component").forEach(node => setComponentCollapsed(node, true));
    visualRoot.querySelectorAll(".visual-part-card").forEach(node => setPartCollapsed(node, true));

    // O caminho é reaberto do elemento de origem até a raiz. O campo exato
    // permanece acessível mesmo quando o destaque visual é elevado ao grupo.
    const path = [];
    let ancestor = originMatch;
    while (ancestor && ancestor !== visualRoot) {
      path.push(ancestor);
      ancestor = ancestor.parentElement;
    }
    path.reverse().forEach(node => {
      setComponentCollapsed(node, false);
      setPartCollapsed(node, false);
    });

    match = resolveInspectionGroup(originMatch);

    // A Estrutura é o único contêiner de rolagem usado pela localização.
    // Não rolamos slots/campos internos, pois isso pode atrapalhar a edição.
    const targetRect = match.getBoundingClientRect();
    const containerRect = visualRoot.getBoundingClientRect();
    const topInset = 18;
    const availableHeight = Math.max(0, visualRoot.clientHeight - topInset * 2);
    const targetHeight = Math.min(targetRect.height, availableHeight);
    const nextTop = visualRoot.scrollTop + targetRect.top - containerRect.top -
      (visualRoot.clientHeight - targetHeight) / 2;
    visualRoot.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });

    // O destaque é apenas visual; não cria camada sobre os campos editáveis.
    inspectHighlightNode = match;
    void match.offsetWidth;
    match.classList.add("is-inspect-highlight");
    inspectHighlightTimer = window.setTimeout(() => {
      if (sequence !== inspectSequence) return;
      match.getAnimations?.().forEach(animation => animation.cancel());
      match.classList.remove("is-inspect-highlight");
      if (inspectHighlightNode === match) inspectHighlightNode = null;
      inspectHighlightTimer = null;
    }, 3600);
  }

  window.addEventListener("message", event => {
    if (event.data?.type === "AUTOMATO_EXTERNAL_INSPECT_TARGET" && event.data.target) {
      const sequence = clearInspectHighlight();
      locateInspectedElement(event.data.target, sequence);
      return;
    }
    if (event.source !== previewFrame?.contentWindow || event.data?.type !== "AUTOMATO_INSPECT_TARGET") return;
    const sequence = clearInspectHighlight();
    locateInspectedElement(event.data, sequence);
  });

  function setPreviewInspectMode(enabled) {
    previewInspectMode = Boolean(enabled);
    previewInspectButton?.classList.toggle("is-active", previewInspectMode);
    previewInspectButton?.setAttribute("aria-pressed", String(previewInspectMode));
    previewFrame?.contentWindow?.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: previewInspectMode }, "*");
    if (previewInspectButton) previewInspectButton.title = previewInspectMode ? "Clique em um elemento da prévia para localizá-lo na estrutura" : "Inspecionar elemento na estrutura de conteúdo";
  }
  previewInspectButton?.addEventListener("click", () => setPreviewInspectMode(!previewInspectMode));

  // Ao sair da área da prévia, encerra o modo para devolver imediatamente
  // os cliques à Estrutura, Biblioteca e demais controles do Editor.
  document.addEventListener("pointerdown", event => {
    if (!previewInspectMode) return;
    const target = event.target;
    const insidePreview = preview?.contains(target) || largePreviewDevice?.contains(target);
    if (insidePreview || previewInspectButton?.contains(target)) return;
    setPreviewInspectMode(false);
  }, true);

  function createPreviewDocument(componentHtml) {
    const base = "/automato/scripts/modelos/modeloBase/";
    return `<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pré-visualização do componente</title>
  <link rel="stylesheet" href="${base}styles/main.css">
  <link rel="stylesheet" href="${base}styles/janela.css">
  <link rel="stylesheet" href="${base}styles/estilos-centralizados.css">
  <link rel="stylesheet" href="${base}styles/hierarquia-componentes.css">
  <link rel="stylesheet" href="${base}styles/mobile-ajustes.css">
  <link rel="stylesheet" href="${base}styles/desktop-ajustes.css">
  <style>
    html, body { width:100%; height:100%; min-height:0; margin:0; padding:0; }
    body { height:100%; min-height:0; padding:24px; box-sizing:border-box; overflow:hidden; background:#fff; }
    #print-target { position:relative !important; inset:auto !important; display:block; width:100% !important; height:100% !important; min-height:0 !important; margin:0; padding:0; overflow:hidden !important; transform:none !important; }
    stage { position:relative !important; inset:auto !important; display:block; left:0 !important; top:0 !important; width:100% !important; height:100% !important; min-height:0 !important; margin:0; padding:0 !important; transform:none !important; overflow:hidden !important; }
    stage > conteudo { position:relative !important; inset:auto !important; display:block; left:0 !important; top:0 !important; width:100% !important; height:100% !important; min-height:0 !important; margin:0; padding:0 !important; overflow:hidden !important; }
    stage > conteudo > licao { position:relative !important; inset:auto !important; display:block; width:100% !important; height:100% !important; min-height:0 !important; max-height:100% !important; margin:0; padding:0; overflow:hidden !important; }
  </style>
</head>
<body class="desktop">
  <main id="print-target"><stage><conteudo><licao class="licao0">${componentHtml}</licao></conteudo></stage></main>
  <script src="${base}scripts/hierarquia-componentes.js"><\/script>
  <script>
    let inspectEnabled = false;
    window.addEventListener("message", event => {
      if (event.data?.type === "AUTOMATO_INSPECT_MODE") inspectEnabled = Boolean(event.data.enabled);
    });
    document.addEventListener("click", event => {
      if (!inspectEnabled) return;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target || target === document.body) return;

      // Alguns componentes (notadamente Botões) movem suas janelas para
      // document.body depois de renderizadas. Isso é intencional: evita que
      // transformações/overflow de componentes ancestrais recortem o modal.
      // Por isso, a superfície inspecionável não se limita a #print-target:
      // qualquer janela acessível por semântica de diálogo ou marcada como
      // portal da prévia também pertence ao conteúdo desta prévia.
      const inspectionSurface = target.closest(
        "#print-target, [role='dialog'], [aria-modal='true'], [aria-modal='false'], [data-automato-preview-portal]"
      );
      if (!inspectionSurface) return;

      event.preventDefault(); event.stopPropagation();
      const text = (target.innerText || target.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1200);
      // Em controles cujo espaço clicável é maior que o texto (por exemplo,
      // o botão de um painel), usa primeiro o identificador do conteúdo
      // interno. Assim, clicar na borda ou no ícone mantém a origem do campo.
      // Prioriza sempre o identificador mais próximo do ponto clicado.
      // Em janelas de BOTÕES, também permite clicar no fundo/área vazia do
      // diálogo: nesse caso usa a identidade do conteúdo daquela janela.
      const directOrigin = target.closest("[data-automato-inspect-id]");
      const dialog = target.closest(
        "[role='dialog'], [aria-modal='true'], [aria-modal='false'], [data-automato-preview-portal]"
      );
      const dialogOrigin = dialog?.querySelector("[data-automato-inspect-id]");
      const interactive = target.closest("button, a, [role='button']");
      const interactiveOrigin = interactive?.querySelector("[data-automato-inspect-id]");
      const origin = directOrigin || (dialog && dialogOrigin) || interactiveOrigin;
      const originId = origin?.getAttribute("data-automato-inspect-id") || "";
      const chain = []; let node = target;
      while (node && node !== document.body) { chain.unshift({ tag: node.tagName?.toLowerCase(), text: (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 1200), alt: node.getAttribute?.("alt") || "", src: node.getAttribute?.("src") || "", cls: typeof node.className === "string" ? node.className : "" }); node = node.parentElement; }
      parent.postMessage({ type: "AUTOMATO_INSPECT_TARGET", originId, text, tag: target.tagName?.toLowerCase(), alt: target.getAttribute("alt") || "", src: target.getAttribute("src") || "", chain }, "*");
    }, true);
  <\/script>
</body>
</html>`;
  }

  function createPreviewMessageDocument(message) {
    const safeMessage = String(message || "Não foi possível processar o código.")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    return `<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      *{box-sizing:border-box}body{margin:0;padding:28px;background:#fff;font:14px Arial,sans-serif;color:#435348}
      .message{max-width:620px;margin:28px auto;padding:20px 22px;border:1px solid #ead9a6;border-left:4px solid #c79a35;border-radius:10px;background:#fffaf0;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
      strong{display:block;margin-bottom:6px;color:#70571f;font-size:15px}
    </style></head><body><div class="message"><strong>Pré-visualização indisponível</strong>${safeMessage}</div></body></html>`;
  }

  function setPlaceholder(empty, message) {
    if (!previewPlaceholder) return;
    previewPlaceholder.hidden = !empty;
    if (!empty) return;
    const text = previewPlaceholder.querySelector("span:last-child");
    if (text) text.textContent = message || "Adicione um texto ou componente para visualizar o resultado.";
  }

  function publishExternalPreview(srcdoc) {
    if (!externalPreviewWindow || externalPreviewWindow.closed) return;
    try {
      const message = { type: "render", srcdoc: String(srcdoc || createPreviewMessageDocument("Adicione um texto ou componente para visualizar o resultado.")) };
      if (externalPreviewChannel) externalPreviewChannel.postMessage(message);
      else externalPreviewWindow.postMessage(message, "*");
    } catch (_) { /* a aba pode estar encerrando */ }
  }

  function restorePreviewPanel() {
    window.clearInterval(externalPreviewCloseCheck);
    externalPreviewCloseCheck = null;
    if (externalPreviewChannel) {
      try { externalPreviewChannel.close(); } catch (_) { /* canal já encerrado */ }
    }
    externalPreviewChannel = null;
    externalPreviewWindow = null;
    externalPreviewToken = null;
    columns?.classList.remove("is-preview-detached");
    if (previewRestoreButton) previewRestoreButton.hidden = true;
    scheduleLateralPreviewViewportSync();
  }

  function openExternalPreview() {
    if (externalPreviewWindow && !externalPreviewWindow.closed) {
      externalPreviewWindow.focus();
      return;
    }

    const confirmed = window.confirm(
      "A pré-visualização será aberta em uma nova aba. Você poderá continuar editando o conteúdo nesta página, e a nova aba será atualizada automaticamente. Deseja continuar?"
    );
    if (!confirmed) return;

    // A abertura ocorre diretamente no clique para não ser bloqueada pelo navegador.
    const popup = window.open("about:blank", "automatoPreviewWindow");
    if (!popup) {
      showToast("O navegador bloqueou a nova aba. Permita pop-ups para o Autômato.", true);
      return;
    }

    externalPreviewWindow = popup;
    externalPreviewToken = `automato-preview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if ("BroadcastChannel" in window) {
      externalPreviewChannel = new BroadcastChannel(externalPreviewToken);
      externalPreviewChannel.onmessage = event => {
        if (event.data?.type === "closed") {
          restorePreviewPanel();
          return;
        }
        if (event.data?.type === "inspect-target" && event.data.target) {
          const sequence = clearInspectHighlight();
          locateInspectedElement(event.data.target, sequence);
        }
      };
    }

    const doc = popup.document;
    doc.open();
    doc.write(`<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pré-visualização | Autômato</title></head><body></body></html>`);
    doc.close();
    doc.body.style.cssText = "margin:0;min-height:100vh;display:flex;flex-direction:column;background:#e8ede9;font:14px Arial,sans-serif;color:#2e4438";

    const style = doc.createElement("style");
    style.textContent = `*{box-sizing:border-box}.preview-toolbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;min-height:62px;padding:10px 16px;background:#fff;border-bottom:1px solid #dce5de;box-shadow:0 2px 8px #18372a12}.preview-title{margin-right:auto;font-weight:750}.preview-devices{display:flex;gap:4px;padding:3px;border:1px solid #e3ebe5;border-radius:10px;background:#f5f8f6}.preview-device{display:flex;align-items:center;gap:6px;padding:8px 12px;border:1px solid transparent;border-radius:7px;background:transparent;color:#68766d;font-weight:700;cursor:pointer}.preview-device.active{color:#245747;background:#e5f0e9;border-color:#dce9df}.preview-stage{display:flex;flex:1;min-height:0;align-items:center;justify-content:center;overflow:auto;padding:18px;background-color:#e8ede9;background-image:radial-gradient(#cbd6ce 1px,transparent 1px);background-size:16px 16px}.preview-device-frame{position:relative;flex:none;overflow:hidden;border-radius:8px;background:#fff;box-shadow:0 5px 22px #18372a20}.preview-content{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}@media(max-width:600px){.preview-toolbar{flex-wrap:wrap;gap:8px}.preview-title{flex-basis:100%}.preview-devices{width:100%}.preview-device{flex:1;justify-content:center;padding:8px 4px}}`;
    style.textContent += ".preview-close{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:8px 13px;border:1px solid #dce5de;border-radius:8px;background:#fff;color:#365b46;font-weight:700;cursor:pointer;white-space:nowrap}.preview-close:hover{background:#f1f7f2;border-color:#9bb9a4}@media(max-width:600px){.preview-close{flex:0 0 auto}}";
    doc.head.appendChild(style);

    const toolbar = doc.createElement("header");
    toolbar.className = "preview-toolbar";
    const title = doc.createElement("strong");
    title.className = "preview-title";
    title.textContent = `Pré-visualização — ${getCurrentScreen()?.title || "Tela"}`;
    const controls = doc.createElement("div");
    controls.className = "preview-devices";
    controls.setAttribute("role", "group");
    controls.setAttribute("aria-label", "Dispositivo da visualização");
    const inspectButton = doc.createElement("button");
    inspectButton.type = "button";
    inspectButton.className = "preview-device";
    inspectButton.textContent = "Inspecionar";
    inspectButton.setAttribute("aria-pressed", "false");
    inspectButton.title = "Ativar inspeção para localizar o elemento na estrutura do editor";
    let popupInspectMode = false;
    inspectButton.addEventListener("click", () => {
      popupInspectMode = !popupInspectMode;
      inspectButton.classList.toggle("active", popupInspectMode);
      inspectButton.setAttribute("aria-pressed", String(popupInspectMode));
      inspectButton.title = popupInspectMode
        ? "Clique em um elemento da prévia para localizá-lo na estrutura do editor"
        : "Ativar inspeção para localizar o elemento na estrutura do editor";
      frame.contentWindow?.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: popupInspectMode }, "*");
    });
    const closeButton = doc.createElement("button");
    closeButton.type = "button";
    closeButton.className = "preview-close";
    closeButton.textContent = "Voltar ao editor";
    closeButton.title = "Fechar esta aba e voltar para o editor";
    closeButton.addEventListener("click", () => {
      try { window.focus(); } catch (_) { /* foco controlado pelo navegador */ }
      popup.close();
    });
    const stage = doc.createElement("main");
    stage.className = "preview-stage";
    const deviceFrame = doc.createElement("div");
    deviceFrame.className = "preview-device-frame";
    const frame = doc.createElement("iframe");
    frame.className = "preview-content";
    frame.title = "Conteúdo em pré-visualização";
    frame.setAttribute("sandbox", "allow-scripts");
    deviceFrame.appendChild(frame);
    stage.appendChild(deviceFrame);
    toolbar.append(title, controls, inspectButton, closeButton);
    doc.body.append(toolbar, stage);

    let selectedDevice = "desktop";
    const sizes = { desktop: [1200, 700], tablet: [820, 1180], mobile: [390, 844] };
    function fitDevice() {
      const [width, height] = sizes[selectedDevice];
      const availableWidth = Math.max(1, stage.clientWidth - 36);
      const availableHeight = Math.max(1, stage.clientHeight - 36);
      const scale = Math.max(.1, Math.min(availableWidth / width, availableHeight / height));
      deviceFrame.style.width = `${Math.round(width * scale)}px`;
      deviceFrame.style.height = `${Math.round(height * scale)}px`;
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
      frame.style.transform = `scale(${scale})`;
      frame.style.transformOrigin = "top left";
      frame.style.width = `${width}px`;
      frame.style.height = `${height}px`;
      frame.style.transform = `scale(${scale})`;
      frame.style.position = "absolute";
      frame.style.left = "0";
      frame.style.top = "0";
    }
    Object.entries({ desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" }).forEach(([key, label]) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = `preview-device${key === selectedDevice ? " active" : ""}`;
      button.textContent = label;
      button.setAttribute("aria-pressed", String(key === selectedDevice));
      button.addEventListener("click", () => {
        selectedDevice = key;
        controls.querySelectorAll("button").forEach(item => {
          const active = item === button;
          item.classList.toggle("active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        fitDevice();
      });
      controls.appendChild(button);
    });
    popup.addEventListener("resize", fitDevice);
    if (popup.ResizeObserver) new popup.ResizeObserver(fitDevice).observe(stage);
    frame.srcdoc = previewFrame.srcdoc || createPreviewMessageDocument("Adicione um texto ou componente para visualizar o resultado.");
    frame.addEventListener("load", () => {
      frame.contentWindow?.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: popupInspectMode }, "*");
    });
    fitDevice();

    let popupPreviewChannel = null;
    popup.addEventListener("message", event => {
      if (event.source !== frame.contentWindow || event.data?.type !== "AUTOMATO_INSPECT_TARGET") return;
      if (popupPreviewChannel) {
        popupPreviewChannel.postMessage({ type: "inspect-target", target: event.data });
      } else {
        window.postMessage({ type: "AUTOMATO_EXTERNAL_INSPECT_TARGET", target: event.data }, "*");
      }
    });
    if (externalPreviewToken && "BroadcastChannel" in popup) {
      popupPreviewChannel = new popup.BroadcastChannel(externalPreviewToken);
      popupPreviewChannel.onmessage = event => {
        if (event.data?.type === "render") frame.srcdoc = event.data.srcdoc;
      };
    } else {
      popup.addEventListener("message", event => {
        if (event.source === window && event.data?.type === "render") frame.srcdoc = event.data.srcdoc;
      });
    }
    popup.addEventListener("beforeunload", () => {
      try { popupPreviewChannel?.postMessage({ type: "closed" }); } catch (_) { /* janela encerrando */ }
      try { popupPreviewChannel?.close(); } catch (_) { /* canal já encerrado */ }
      try { window.focus(); } catch (_) { /* foco controlado pelo navegador */ }
    });

    columns?.classList.add("is-preview-detached");
    if (previewRestoreButton) previewRestoreButton.hidden = false;
    externalPreviewCloseCheck = window.setInterval(() => {
      if (!externalPreviewWindow || externalPreviewWindow.closed) restorePreviewPanel();
    }, 500);
    popup.focus();
    window.clearTimeout(previewTimer);
    renderRealPreview();
  }

  function updatePreview() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(renderRealPreview, 380);
  }

  async function renderRealPreview() {
    const source = getSource();
    const sequence = ++previewSequence;

    if (previewAbortController) previewAbortController.abort();
    previewAbortController = new AbortController();

    if (!source.trim()) {
      const modalOpen = Boolean(largePreview && !largePreview.hidden);
      previewFrame.hidden = !modalOpen;
      if (modalOpen) {
        previewFrame.srcdoc = createPreviewMessageDocument("Adicione um texto ou componente para visualizar o resultado.");
      } else {
        previewFrame.removeAttribute("srcdoc");
      }
      setPlaceholder(true, "Adicione um texto ou componente para visualizar o resultado.");
      publishExternalPreview(createPreviewMessageDocument("Adicione um texto ou componente para visualizar o resultado."));
      return;
    }

    setPlaceholder(false);
    try {
      const response = await fetch("/api/editor-componentes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "tela", source }),
        signal: previewAbortController.signal
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Não foi possível gerar a pré-visualização.");
      if (sequence !== previewSequence) return;

      previewFrame.srcdoc = createPreviewDocument(result.html || "");
      publishExternalPreview(previewFrame.srcdoc);
      previewFrame.hidden = false;
      if (previewInspectMode) previewFrame.addEventListener("load", () => {
        // O usuário pode sair do modo enquanto o documento da prévia carrega.
        // Só reativa no iframe se o modo ainda estiver ativo nesse momento.
        if (previewInspectMode) setPreviewInspectMode(true);
      }, { once: true });
      scheduleLateralPreviewViewportSync();
    } catch (error) {
      if (error.name === "AbortError" || sequence !== previewSequence) return;
      previewFrame.srcdoc = createPreviewMessageDocument(error.message || "Verifique o código digitado.");
      publishExternalPreview(previewFrame.srcdoc);
      previewFrame.hidden = false;
      scheduleLateralPreviewViewportSync();
    }
  }

  // A estrutura visual é a área principal. O textarea permanece disponível
  // como modo alternativo para consultar ou editar o HTML bruto.
  visualStructure = window.AutomatoVisualStructure?.create({
    root: visualRoot,
    textarea: editor,
    toolbar: editorTextToolbar,
    visualTab: visualModeButton,
    codeTab: codeModeButton,
    examples,
    notify: showToast,
    onChange: () => {
      updateCount();
      saveCurrentScreen();
      updatePreview();
    }
  }) || null;
  visualStructure?.bindLibrary(componentList);

  editorInsertImageButton?.addEventListener("click", () => {
    visualStructure?.rememberSelection();
    editorImageInput?.click();
  });

  editorImageInput?.addEventListener("change", () => {
    const file = editorImageInput.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Selecione um arquivo de imagem.", true);
      editorImageInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        visualStructure?.insertImage(reader.result, file.name.replace(/\\.[^.]+$/, "") || "Imagem");
      } else {
        showToast("Não foi possível ler a imagem selecionada.", true);
      }
      editorImageInput.value = "";
    };
    reader.onerror = () => {
      showToast("Não foi possível ler a imagem selecionada.", true);
      editorImageInput.value = "";
    };
    reader.readAsDataURL(file);
  });

  // No editor de código, Enter mantém a indentação da linha anterior.
  // Shift+Enter cria uma nova linha sem copiar a indentação; ambos preservam
  // a seleção e a posição do cursor nativamente pelo próprio textarea.
  function insertTextAtSelection(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.setRangeText(text, start, end, "end");
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  editor.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) {
        insertTextAtSelection("\n");
        return;
      }
      const value = editor.value;
      const cursor = editor.selectionStart;
      const lineStart = value.lastIndexOf("\n", cursor - 1) + 1;
      const currentLine = value.slice(lineStart, cursor);
      const indent = (currentLine.match(/^[\t ]*/) || [""])[0];
      insertTextAtSelection(`\n${indent}`);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      insertTextAtSelection("  ");
    }
  });

  editor.addEventListener("input", () => {
    if (visualStructure?.getMode() === "visual") return;
    updateCount();
    saveCurrentScreen();
    updatePreview();
  });

  // A Biblioteca permanece disponível como atalho: insere o exemplo do
  // componente no ponto do cursor, mas o conteúdo continua sendo texto/código
  // puro e pode ser alterado livremente. Não cria wrappers artificiais.
  function insertComponentExample(slug) {
    const example = examples[slug];
    if (typeof example !== "string" || !example.trim()) {
      showToast("Não foi encontrado um exemplo para este componente.", true);
      return;
    }

    const value = editor.value;
    const start = Number.isInteger(editor.selectionStart) ? editor.selectionStart : value.length;
    const end = Number.isInteger(editor.selectionEnd) ? editor.selectionEnd : start;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const prefix = before.trim() && !before.endsWith("\n") ? "\n\n" : "";
    const suffix = after.trim() && !after.startsWith("\n") ? "\n\n" : "";
    const snippet = example.replace(/\r\n?/g, "\n").trim();
    const insertion = `${prefix}${snippet}${suffix}`;

    editor.setRangeText(insertion, start, end, "end");
    editor.focus();
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    if (componentList) {
      componentList.querySelectorAll("[data-component]").forEach(button => {
        const active = button.dataset.component === slug;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }
    showToast(`Código de ${slug} inserido. Você pode editá-lo livremente.`);
  }

  const componentTooltip = document.createElement("div");
  componentTooltip.className = "editor-component-tooltip";
  componentTooltip.setAttribute("role", "tooltip");
  componentTooltip.hidden = true;
  document.body.append(componentTooltip);
  let componentTooltipTarget = null;

  function hideComponentTooltip() {
    componentTooltipTarget = null;
    componentTooltip.hidden = true;
  }

  function showComponentTooltip(button) {
    if (!editorLayout?.classList.contains("is-sidebar-compact")) {
      hideComponentTooltip();
      return;
    }
    const label = button?.dataset.componentLabel;
    if (!label) return hideComponentTooltip();

    componentTooltipTarget = button;
    const rect = button.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return hideComponentTooltip();
    componentTooltip.textContent = label;
    componentTooltip.hidden = false;
    const tooltipWidth = componentTooltip.getBoundingClientRect().width;
    const placeOnLeft = rect.right + 8 + tooltipWidth > window.innerWidth - 8;
    componentTooltip.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    componentTooltip.style.left = `${Math.round(placeOnLeft ? rect.left - 8 : rect.right + 8)}px`;
    componentTooltip.style.transform = placeOnLeft
      ? "translate(-100%, -50%)"
      : "translateY(-50%)";
  }

  componentList?.addEventListener("pointerover", event => {
    const button = event.target.closest("[data-component]");
    if (!button || (event.relatedTarget && button.contains(event.relatedTarget))) return;
    showComponentTooltip(button);
  });

  componentList?.addEventListener("pointerout", event => {
    const button = event.target.closest("[data-component]");
    if (button && (!event.relatedTarget || !button.contains(event.relatedTarget))) {
      hideComponentTooltip();
    }
  });

  componentList?.addEventListener("focusin", event => {
    showComponentTooltip(event.target.closest("[data-component]"));
  });

  componentList?.addEventListener("focusout", hideComponentTooltip);
  componentList?.addEventListener("scroll", () => {
    if (componentTooltipTarget) showComponentTooltip(componentTooltipTarget);
  }, { passive: true });

  componentList?.addEventListener("click", event => {
    const button = event.target.closest("[data-component]");
    if (!button) return;
    if (visualStructure?.getMode() === "visual") return;
    insertComponentExample(button.dataset.component);
  });

  searchInput?.addEventListener("input", () => {
    const term = searchInput.value.trim().toLocaleLowerCase("pt-BR");
    let visible = 0;
    componentList?.querySelectorAll("[data-component]").forEach(button => {
      const matches = (button.dataset.search || "").includes(term);
      button.hidden = !matches;
      if (matches) visible++;
    });
    const empty = document.getElementById("editorSidebarEmpty");
    if (empty) empty.hidden = visible !== 0;
  });

  document.querySelector("[data-editor-filter=\"all\"]")?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    componentList?.querySelectorAll("[data-component]").forEach(button => { button.hidden = false; });
    const empty = document.getElementById("editorSidebarEmpty");
    if (empty) empty.hidden = true;
  });

  // Redimensionamento da Biblioteca no Desktop; em telas menores a coluna
  // passa automaticamente para o fluxo vertical definido no CSS responsivo.
  if (editorLayout && editorSidebar && sidebarSplitter) {
    const sidebarStorageKey = "automato.editor-componentes.sidebar-width.v1";
    const readSidebarWidth = () => {
      try {
        const saved = Number(window.localStorage.getItem(sidebarStorageKey));
        return Number.isFinite(saved) && saved >= 70 ? saved : null;
      } catch (_) { return null; }
    };
    const SIDEBAR_MIN_WIDTH = 78;
    const SIDEBAR_MAX_WIDTH = 460;
    const SIDEBAR_COMPACT_THRESHOLD = 148;

    const updateSidebarCompactMode = width => {
      // No Desktop, quando a Biblioteca fica estreita, conserva somente os ícones.
      // Em Tablet/Mobile, a Biblioteca permanece no layout expandido e responsivo.
      const isDesktop = window.matchMedia("(min-width: 992px)").matches;
      editorLayout.classList.toggle(
        "is-sidebar-compact",
        isDesktop && width <= SIDEBAR_COMPACT_THRESHOLD
      );
    };

    const setSidebarWidth = width => {
      const max = Math.max(SIDEBAR_MIN_WIDTH, editorLayout.clientWidth - 430);
      const clamped = Math.round(Math.min(
        Math.max(width, SIDEBAR_MIN_WIDTH),
        Math.min(SIDEBAR_MAX_WIDTH, max)
      ));
      editorLayout.style.setProperty("--editor-sidebar-width", `${clamped}px`);
      sidebarSplitter.setAttribute("aria-valuemin", String(SIDEBAR_MIN_WIDTH));
      sidebarSplitter.setAttribute("aria-valuemax", String(Math.min(SIDEBAR_MAX_WIDTH, max)));
      sidebarSplitter.setAttribute("aria-valuenow", String(clamped));
      updateSidebarCompactMode(clamped);
      return clamped;
    };
    const savedWidth = readSidebarWidth();
    const initialWidth = savedWidth || editorSidebar.getBoundingClientRect().width || 260;
    setSidebarWidth(initialWidth);
    window.addEventListener("resize", () => {
      const currentWidth = Number.parseFloat(
        window.getComputedStyle(editorLayout).getPropertyValue("--editor-sidebar-width")
      ) || editorSidebar.getBoundingClientRect().width;
      updateSidebarCompactMode(currentWidth);
    });
    sidebarSplitter.addEventListener("pointerdown", event => {
      if (event.button !== 0 || window.getComputedStyle(sidebarSplitter).display === "none") return;
      event.preventDefault();
      const pointerId = event.pointerId;
      const startX = event.clientX;
      const startWidth = editorSidebar.getBoundingClientRect().width;
      let finalWidth = startWidth;
      sidebarSplitter.classList.add("is-dragging");
      document.body.classList.add("is-resizing-editor");
      try { sidebarSplitter.setPointerCapture(pointerId); } catch (_) {}
      const move = moveEvent => {
        if (moveEvent.pointerId === pointerId) finalWidth = setSidebarWidth(startWidth + moveEvent.clientX - startX);
      };
      const finish = endEvent => {
        if (endEvent && endEvent.pointerId !== pointerId) return;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        sidebarSplitter.classList.remove("is-dragging");
        document.body.classList.remove("is-resizing-editor");
        try { window.localStorage.setItem(sidebarStorageKey, String(finalWidth)); } catch (_) {}
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    });
    sidebarSplitter.addEventListener("keydown", event => {
      const step = event.shiftKey ? 40 : 20;
      const current = editorSidebar.getBoundingClientRect().width;
      let next = current;
      if (event.key === "ArrowLeft") next -= step;
      else if (event.key === "ArrowRight") next += step;
      else return;
      event.preventDefault();
      const width = setSidebarWidth(next);
      try { window.localStorage.setItem(sidebarStorageKey, String(width)); } catch (_) {}
    });
  }

  screenList.addEventListener("click", event => {
    const deleteButton = event.target.closest("[data-delete-screen-id]");
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();
      deleteScreen(deleteButton.dataset.deleteScreenId);
      return;
    }
    const button = event.target.closest("[data-screen-id]");
    if (button) loadScreen(button.dataset.screenId);
  });
  addScreenButton?.addEventListener("click", addScreen);

  // Divisor entre código e pré-visualização. Mantém a largura escolhida no navegador.
  const layoutPreferenceKey = "automato.editor-componentes.code-layout.v2";
  let savedStructureWidth = null;
  try {
    const saved = JSON.parse(window.localStorage.getItem(layoutPreferenceKey) || "{}");
    savedStructureWidth = Number.isFinite(saved.structureWidth) ? saved.structureWidth : null;
  } catch (_) {
    savedStructureWidth = null;
  }

  function splitterVisible() {
    return Boolean(columnsSplitter && window.getComputedStyle(columnsSplitter).display !== "none");
  }

  function getStructureLimits() {
    const min = 320;
    const max = Math.max(min, columns.clientWidth - columnsSplitter.offsetWidth - 320);
    return { min, max };
  }

  function applyStructureWidth(value) {
    const limits = getStructureLimits();
    const width = Math.round(Math.min(Math.max(value, limits.min), limits.max));
    columns.style.setProperty("--editor-structure-width", `${width}px`);
    columnsSplitter.setAttribute("aria-valuemin", String(limits.min));
    columnsSplitter.setAttribute("aria-valuemax", String(limits.max));
    columnsSplitter.setAttribute("aria-valuenow", String(width));
    return width;
  }

  function saveStructureWidth(width) {
    savedStructureWidth = width;
    try { window.localStorage.setItem(layoutPreferenceKey, JSON.stringify({ structureWidth: width })); } catch (_) { /* armazenamento local opcional */ }
  }

  function restoreStructureWidth() {
    if (!splitterVisible()) return;
    const current = structurePanel.getBoundingClientRect().width;
    // Padrão visual solicitado: editor com aproximadamente 36,5% e prévia
    // com 63,5% da área útil, mantendo qualquer largura salva pelo usuário.
    const defaultWidth = Math.round((columns.clientWidth - columnsSplitter.offsetWidth) * 0.365);
    applyStructureWidth(Number.isFinite(savedStructureWidth) ? savedStructureWidth : defaultWidth || current);
  }

  columnsSplitter?.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !splitterVisible()) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = structurePanel.getBoundingClientRect().width;
    let finalWidth = startWidth;
    columnsSplitter.classList.add("is-dragging");
    document.body.classList.add("is-resizing-editor");
    try { columnsSplitter.setPointerCapture(pointerId); } catch (_) { /* sem captura */ }

    const onMove = moveEvent => {
      if (moveEvent.pointerId === pointerId) finalWidth = applyStructureWidth(startWidth + moveEvent.clientX - startX);
    };
    const onEnd = endEvent => {
      if (endEvent && endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      columnsSplitter.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-editor");
      saveStructureWidth(finalWidth);
      try { if (columnsSplitter.hasPointerCapture(pointerId)) columnsSplitter.releasePointerCapture(pointerId); } catch (_) { /* já liberado */ }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  });

  columnsSplitter?.addEventListener("keydown", event => {
    if (!splitterVisible()) return;
    const step = event.shiftKey ? 50 : 20;
    let width = structurePanel.getBoundingClientRect().width;
    if (event.key === "ArrowLeft") width -= step;
    else if (event.key === "ArrowRight") width += step;
    else if (event.key === "Home") width = getStructureLimits().min;
    else if (event.key === "End") width = getStructureLimits().max;
    else return;
    event.preventDefault();
    saveStructureWidth(applyStructureWidth(width));
  });

  // Controle independente para aumentar a altura conjunta dos painéis de código e prévia.
  const heightPreferenceKey = "automato.editor-componentes.code-height.v1";
  const MIN_COLUMNS_HEIGHT = 420;
  const MAX_COLUMNS_HEIGHT = 1100;
  let savedColumnsHeight = null;
  try {
    const saved = Number(window.localStorage.getItem(heightPreferenceKey));
    if (Number.isFinite(saved) && saved >= MIN_COLUMNS_HEIGHT) savedColumnsHeight = saved;
  } catch (_) { /* armazenamento local opcional */ }

  function heightResizerVisible() {
    return Boolean(heightResizer && window.matchMedia("(min-width: 992px)").matches);
  }

  function applyColumnsHeight(value) {
    const height = Math.round(Math.min(Math.max(value, MIN_COLUMNS_HEIGHT), MAX_COLUMNS_HEIGHT));
    columns.style.height = `${height}px`;
    heightResizer?.setAttribute("aria-valuenow", String(height));
    return height;
  }

  if (columns && heightResizerVisible()) {
    const initialHeight = savedColumnsHeight || columns.getBoundingClientRect().height || 620;
    applyColumnsHeight(initialHeight);
  }

  function syncSidebarHeight() {
    if (!editorLayout || !editorSidebar || !columns) return;
    if (!window.matchMedia("(min-width: 992px)").matches) {
      editorLayout.style.removeProperty("--editor-sidebar-height");
      return;
    }
    let height;
    if (editorLayout.classList.contains("is-sidebar-compact")) {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const stickyTop = 16;
      const sidebarTop = Math.max(stickyTop, editorSidebar.getBoundingClientRect().top);
      height = Math.round(Math.max(180, viewportHeight - sidebarTop - stickyTop));
    } else {
      height = Math.round(columns.getBoundingClientRect().height);
    }
    if (height > 0 && editorLayout.style.getPropertyValue("--editor-sidebar-height") !== `${height}px`) {
      editorLayout.style.setProperty("--editor-sidebar-height", `${height}px`);
    }
  }

  syncSidebarHeight();
  if (columns && "ResizeObserver" in window) {
    const sidebarHeightObserver = new ResizeObserver(syncSidebarHeight);
    sidebarHeightObserver.observe(columns);
  }
  window.addEventListener("resize", syncSidebarHeight);
  window.addEventListener("scroll", syncSidebarHeight, { passive: true });

  window.addEventListener("resize", () => {
    if (!columns) return;
    if (heightResizerVisible()) {
      const current = columns.getBoundingClientRect().height;
      applyColumnsHeight(savedColumnsHeight || current || 620);
    } else {
      columns.style.removeProperty("height");
    }
  });

  heightResizer?.addEventListener("pointerdown", event => {
    if (event.button !== 0 || !heightResizerVisible()) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const startY = event.clientY;
    const startHeight = columns.getBoundingClientRect().height;
    let finalHeight = startHeight;
    heightResizer.classList.add("is-dragging");
    document.body.classList.add("is-resizing-editor-height");
    try { heightResizer.setPointerCapture(pointerId); } catch (_) { /* captura opcional */ }
    const onMove = moveEvent => {
      if (moveEvent.pointerId === pointerId) finalHeight = applyColumnsHeight(startHeight + moveEvent.clientY - startY);
    };
    const onEnd = endEvent => {
      if (endEvent && endEvent.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
      heightResizer.classList.remove("is-dragging");
      document.body.classList.remove("is-resizing-editor-height");
      try { window.localStorage.setItem(heightPreferenceKey, String(finalHeight)); } catch (_) { /* armazenamento local opcional */ }
      try { if (heightResizer.hasPointerCapture(pointerId)) heightResizer.releasePointerCapture(pointerId); } catch (_) { /* já liberado */ }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  });

  heightResizer?.addEventListener("keydown", event => {
    if (!heightResizerVisible()) return;
    const step = event.shiftKey ? 80 : 30;
    let height = columns.getBoundingClientRect().height;
    if (event.key === "ArrowUp") height -= step;
    else if (event.key === "ArrowDown") height += step;
    else if (event.key === "Home") height = MIN_COLUMNS_HEIGHT;
    else if (event.key === "End") height = MAX_COLUMNS_HEIGHT;
    else return;
    event.preventDefault();
    const applied = applyColumnsHeight(height);
    try { window.localStorage.setItem(heightPreferenceKey, String(applied)); } catch (_) { /* armazenamento local opcional */ }
  });

  // Documento de pré-visualização ampliada reutiliza o mesmo iframe da lateral.
  function mountPreviewFrameInLargeModal() {
    if (!previewFrame || !largePreviewDevice || previewFrame.parentElement === largePreviewDevice) return;
    previewFrameHome = {
      parent: previewFrame.parentElement,
      nextSibling: previewFrame.nextSibling,
      style: previewFrame.getAttribute("style"),
      title: previewFrame.title,
      hidden: previewFrame.hidden
    };
    largePreviewDevice.appendChild(previewFrame);
    previewFrame.title = "Pré-visualização do código em Desktop";
    previewFrame.hidden = false;
  }

  function restorePreviewFrameToCanvas() {
    if (!previewFrame || !previewFrameHome) return;
    const home = previewFrameHome;
    if (home.parent) {
      const anchor = home.nextSibling && home.nextSibling.parentNode === home.parent ? home.nextSibling : null;
      home.parent.insertBefore(previewFrame, anchor);
    }
    if (home.style === null) previewFrame.removeAttribute("style");
    else previewFrame.setAttribute("style", home.style);
    previewFrame.title = home.title || "Pré-visualização real do componente";
    previewFrame.hidden = !getSource().trim();
    if (!getSource().trim()) previewFrame.removeAttribute("srcdoc");
    setPlaceholder(!getSource().trim());
    previewFrameHome = null;
    scheduleLateralPreviewViewportSync();
  }

  function getPreviewStageSpace() {
    if (!largePreviewStage) return { width: 0, height: 0 };
    const style = window.getComputedStyle(largePreviewStage);
    return {
      width: Math.max(0, largePreviewStage.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)),
      height: Math.max(0, largePreviewStage.clientHeight - (parseFloat(style.paddingTop) || 0) - (parseFloat(style.paddingBottom) || 0))
    };
  }

  function syncLargePreviewViewport() {
    if (!largePreview || largePreview.hidden || !largePreviewStage || !largePreviewDevice || !previewFrame || previewFrame.parentElement !== largePreviewDevice) return;
    const available = getPreviewStageSpace();
    if (available.width < 1 || available.height < 1) return;
    const selected = PREVIEW_DEVICE_SIZES[largePreviewDeviceMode] || PREVIEW_DEVICE_SIZES.desktop;
    const scale = Math.max(0.1, Math.min(available.width / selected.width, available.height / selected.height));
    const renderedWidth = Math.round(selected.width * scale);
    const renderedHeight = Math.round(selected.height * scale);

    largePreviewDevice.style.width = `${renderedWidth}px`;
    largePreviewDevice.style.height = `${renderedHeight}px`;
    largePreviewDevice.style.boxSizing = "border-box";
    Object.assign(previewFrame.style, {
      position: "absolute", display: "block", flex: "none", left: "0", top: "0",
      width: `${selected.width}px`, height: `${selected.height}px`, minWidth: "0", minHeight: "0",
      maxWidth: "none", transformOrigin: "top left", transform: `scale(${scale})`
    });
  }

  function scheduleLargePreviewViewportSync() {
    if (largePreviewScaleFrame) window.cancelAnimationFrame(largePreviewScaleFrame);
    largePreviewScaleFrame = window.requestAnimationFrame(() => {
      largePreviewScaleFrame = 0;
      syncLargePreviewViewport();
    });
  }

  function syncLateralPreviewViewport() {
    if (!preview || !previewFrame || previewFrame.parentElement !== preview || previewFrame.hidden) return;
    const width = preview.clientWidth;
    const height = preview.clientHeight;
    if (width < 1 || height < 1) return;
    const scale = Math.max(0.1, Math.min(width / DESKTOP_PREVIEW_WIDTH, height / DESKTOP_PREVIEW_HEIGHT));
    Object.assign(previewFrame.style, {
      position: "absolute",
      left: `${Math.round((width - DESKTOP_PREVIEW_WIDTH * scale) / 2)}px`,
      top: `${Math.round((height - DESKTOP_PREVIEW_HEIGHT * scale) / 2)}px`,
      width: `${DESKTOP_PREVIEW_WIDTH}px`, height: `${DESKTOP_PREVIEW_HEIGHT}px`,
      minWidth: "0", minHeight: "0", maxWidth: "none", flex: "none",
      transformOrigin: "top left", transform: `scale(${scale})`
    });
  }

  function scheduleLateralPreviewViewportSync() {
    if (lateralPreviewScaleFrame) window.cancelAnimationFrame(lateralPreviewScaleFrame);
    lateralPreviewScaleFrame = window.requestAnimationFrame(() => {
      lateralPreviewScaleFrame = 0;
      syncLateralPreviewViewport();
    });
  }

  function setLargePreviewDevice(device = "desktop") {
    if (!largePreviewStage || !largePreviewDevice) return;
    largePreviewDeviceMode = Object.prototype.hasOwnProperty.call(PREVIEW_DEVICE_SIZES, device) ? device : "desktop";
    largePreviewStage.dataset.device = largePreviewDeviceMode;
    largePreviewDevice.dataset.device = largePreviewDeviceMode;
    largePreviewDeviceButtons.forEach(button => {
      const active = button.dataset.previewDevice === largePreviewDeviceMode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    previewFrame.title = `Pré-visualização do código em ${PREVIEW_DEVICE_SIZES[largePreviewDeviceMode].label}`;
    scheduleLargePreviewViewportSync();
  }

  function openLargePreview() {
    if (!largePreview || !largePreviewDevice || !previewFrame) return;
    saveCurrentScreen();
    const title = document.getElementById("editorLargePreviewTitle");
    if (title) title.textContent = `Visualização ampliada — ${getCurrentScreen()?.title || "Tela"}`;
    largePreview.hidden = false;
    largePreview.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-large-preview");
    mountPreviewFrameInLargeModal();
    setLargePreviewDevice("desktop");
    window.clearTimeout(previewTimer);
    renderRealPreview();
    scheduleLargePreviewViewportSync();
    closeLargePreviewButton?.focus();
  }

  function closeLargePreview() {
    if (!largePreview) return;
    largePreview.hidden = true;
    largePreview.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-large-preview");
    restorePreviewFrameToCanvas();
    openLargePreviewButton?.focus();
  }

  // Mantém o botão original para abrir a pré-visualização ampliada em wireframe.
  openLargePreviewButton?.addEventListener("click", openLargePreview);
  // O novo botão abre a mesma prévia sincronizada em uma aba independente.
  openExternalPreviewButton?.addEventListener("click", openExternalPreview);
  previewRestoreButton?.addEventListener("click", () => {
    if (externalPreviewWindow && !externalPreviewWindow.closed) externalPreviewWindow.focus();
  });
  closeLargePreviewButton?.addEventListener("click", closeLargePreview);
  largePreviewDeviceButtons.forEach(button => {
    button.addEventListener("click", () => setLargePreviewDevice(button.dataset.previewDevice));
  });
  largePreview?.addEventListener("click", event => {
    if (event.target === largePreview) closeLargePreview();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && largePreview && !largePreview.hidden) closeLargePreview();
  });

  window.addEventListener("resize", () => {
    restoreStructureWidth();
    scheduleLargePreviewViewportSync();
    scheduleLateralPreviewViewportSync();
  });
  if (window.ResizeObserver) {
    if (largePreviewStage) {
      const largeObserver = new ResizeObserver(scheduleLargePreviewViewportSync);
      largeObserver.observe(largePreviewStage);
    }
    if (preview) {
      const lateralObserver = new ResizeObserver(scheduleLateralPreviewViewportSync);
      lateralObserver.observe(preview);
    }
  }

  // Inicia com duas telas vazias; a primeira recebe o foco para digitação.
  renderScreenTabs();
  loadScreen("screen-1", true);
  window.requestAnimationFrame(restoreStructureWidth);
})();
