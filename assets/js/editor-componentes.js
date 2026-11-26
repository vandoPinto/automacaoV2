(() => {
  "use strict";

  const editor = document.getElementById("componentSourceEditor");
  const preview = document.getElementById("editorPreview");
  const previewFrame = document.getElementById("editorPreviewFrame");
  const previewPlaceholder = document.getElementById("editorPreviewPlaceholder");
  const previewOrigin = previewFrame?.dataset.previewOrigin || "";
  const previewFrameUrl = previewFrame?.dataset.previewUrl || "";
  const isolatedPreviewEnabled = Boolean(previewOrigin && previewFrameUrl);
  let previewFrameReady = false;
  let currentPreviewDocument = "";
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
  const componentTables = window.editorComponentTables || {};
  const tableTransfer = window.AutomatoComponentTableTransfer;
  const toast = document.getElementById("editorToast");
  const screenList = document.getElementById("editorScreenList");
  const addScreenButton = document.getElementById("editorAddScreen");
  const lessonLoadButton = document.getElementById("editorLoadLesson");
  const lessonSaveButton = document.getElementById("editorSaveLesson");
  const lessonFileInput = document.getElementById("editorLessonFileInput");
  const lessonFileLabel = document.getElementById("editorLessonFile");
  const lessonSaveState = document.getElementById("editorLessonSaveState");
  const lessonTopicsElement = document.getElementById("editorLessonTopics");
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
  const docxModeButton = document.getElementById("editorDocxMode");
  const docxPreview = document.getElementById("editorDocxPreview");
  const docxContent = document.getElementById("editorDocxContent");
  const docxCopyButton = document.getElementById("editorCopyDocxStructure");
  let docxDraftDirty = false;
  let visualStructure = null;

  if (!editor || !preview || !previewFrame || !screenList) return;

  function setPreviewFrameDocument(documentHtml) {
    currentPreviewDocument = String(documentHtml || "");
    if (isolatedPreviewEnabled) {
      if (previewFrameReady) {
        previewFrame.contentWindow?.postMessage({
          type: "AUTOMATO_PREVIEW_RENDER",
          document: currentPreviewDocument
        }, previewOrigin);
      }
      return;
    }
    previewFrame.srcdoc = currentPreviewDocument;
  }

  let screens = [
    { id: "screen-1", title: "Tela 1", source: "" },
    { id: "screen-2", title: "Tela 2", source: "" }
  ];
  let activeScreenId = "screen-1";
  let screenSequence = 2;
  let loadedLessonDocx = null;
  let lessonTopics = [];
  let activeLessonTopic = null;
  let toastTimer = null;
  let previewTimer = null;
  let previewAbortController = null;
  let previewSequence = 0;
  let largePreviewDeviceMode = "desktop";
  let largePreviewScaleFrame = 0;
  let lateralPreviewScaleFrame = 0;
  let previewFrameHome = null;
  let externalPreviewWindow = null;
  let externalPreviewFrame = null;
  let externalPreviewCloseCheck = null;
  let externalPreviewReady = false;
  let externalPreviewMessageHandler = null;
  let screenThumbnailObserver = null;

  const DESKTOP_PREVIEW_WIDTH = 1200;
  const DESKTOP_PREVIEW_HEIGHT = 700;
  const PREVIEW_DEVICE_SIZES = Object.freeze({
    desktop: { width: 1200, height: 700, label: "Desktop" },
    tablet: { width: 820, height: 1180, label: "Tablet" },
    mobile: { width: 390, height: 844, label: "Mobile" }
  });

  function showToast(message, isError = false, isWarning = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle("is-error", isError);
    toast.classList.toggle("is-warning", isWarning && !isError);
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible", "is-error", "is-warning"), 2800);
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

  const DOCX_COMPONENT_TAGS = new Set([
    "dividir", "botoes", "botao", "hotword", "abas", "flashcard", "opcoes",
    "verdadeirofalso", "jogomemoria", "mininavegacao", "sanfona", "ligapontos",
    "relacionarcolunas", "forca", "video", "arquivo", "imagem", "destaque"
  ]);
  const DOCX_TAGS_PERMITIDAS = new Set([
    "p", "div", "span", "strong", "b", "em", "i", "u", "s", "del", "ul", "ol", "li",
    "a", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "sub", "sup",
    "mark", "small", "br", "hr", "img", "picture", "figure", "figcaption"
  ]);

  const docxEscape = value => tableTransfer?.escaparHtml
    ? tableTransfer.escaparHtml(value)
    : String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);

  function getDocxComponentSlug(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return "";
    if (element.classList?.contains("visual-component")) return String(element.dataset.visualComponent || "").toLowerCase();
    const tag = String(element.tagName || "").toLowerCase();
    if (tag === "componente") return String(element.getAttribute("tipo") || "").toLowerCase();
    return DOCX_COMPONENT_TAGS.has(tag) ? (tag === "botoes" ? "botao" : tag) : "";
  }

  function docxSlot(component, selector) {
    return component.querySelector(`:scope > .visual-component-body ${selector} > .visual-slot`);
  }

  function docxPartSlot(part) {
    return part?.querySelector(":scope > .visual-field > .visual-slot") || null;
  }

  function docxCellFromSlot(slot) {
    if (!slot) return { texto: "" };
    const html = [...slot.childNodes].map(node => serializeDocxNode(node)).join("").trim();
    const texto = String(slot.innerText ?? slot.textContent ?? "").replace(/\s+/g, " ").trim();
    return html ? { html, texto } : { texto };
  }

  function docxDirectPart(group, marker) {
    return [...(group?.children || [])].find(child => child.matches?.(`.visual-part-card[data-visual-part="${marker}"]`)) || null;
  }

  function docxDirectGroups(component) {
    const body = component.querySelector(":scope > .visual-component-body");
    return [...(body?.children || [])].filter(child => child.classList?.contains("visual-structure-set"));
  }

  function docxComponentPreamble(component) {
    const body = component.querySelector(":scope > .visual-component-body");
    const slot = body?.querySelector(":scope > .visual-field--preamble > .visual-slot, :scope > .visual-field--hotword-context > .visual-slot");
    return slot ? [...slot.childNodes].map(node => serializeDocxNode(node)).join("").trim() : "";
  }

  function buildDocxComponentData(component) {
    const type = getDocxComponentSlug(component);
    const schemaSlug = type === "botoes" ? "botao" : type;
    const modelo = componentTables[schemaSlug];
    if (!modelo || !Array.isArray(modelo.linhas)) return null;
    const body = component.querySelector(":scope > .visual-component-body");
    let linhas = [];
    const pares = (group, first, second) => [
      docxCellFromSlot(docxPartSlot(docxDirectPart(group, first))),
      docxCellFromSlot(docxPartSlot(docxDirectPart(group, second)))
    ];
    if (type === "dividir") {
      linhas = [];
    } else if (type === "imagem") {
      linhas = [
        [docxCellFromSlot(docxSlot(component, ".visual-field--image-title"))],
        [docxCellFromSlot(docxSlot(component, ".visual-field--image-source"))],
        [docxCellFromSlot(docxSlot(component, ".visual-field--image-footer"))]
      ];
    } else if (type === "destaque") {
      const grupos = [...(body?.querySelectorAll(":scope > .visual-destaque-list > .visual-destaque-set") || [])];
      linhas = grupos.map(group => [
        docxCellFromSlot(group.querySelector(":scope > .visual-part-card[data-visual-part='destaquetitulo'] > .visual-field > .visual-slot")),
        docxCellFromSlot(group.querySelector(":scope > .visual-part-card[data-visual-part='destaqueconteudo'] > .visual-field > .visual-slot"))
      ]);
    } else if (type === "botao" || type === "botoes" || type === "sanfona") {
      const pairsList = body?.querySelector(":scope > .visual-pairs-list");
      const pairs = [...(pairsList?.querySelectorAll(":scope > .visual-button-window-pair") || [])];
      linhas = pairs.map(group => pares(group, "botao", "janela"));
    } else if (type === "hotword") {
      linhas = [[docxCellFromSlot(docxSlot(component, ".visual-field--hotword-term")), docxCellFromSlot(docxSlot(component, ".visual-field--hotword-window"))]];
    } else if (type === "abas") {
      linhas = docxDirectGroups(component).map(group => pares(group, "aba", "janela"));
    } else if (type === "flashcard") {
      linhas = docxDirectGroups(component).map(group => pares(group, "frente", "verso"));
    } else if (type === "jogomemoria") {
      const capa = docxCellFromSlot(docxPartSlot(body?.querySelector(":scope > .visual-part-card[data-visual-part='frente']")));
      linhas = docxDirectGroups(component).map((group, index) => [
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "carta1"))),
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "carta2"))),
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "feedback"))),
        index === 0 ? capa : ""
      ]);
    } else if (type === "mininavegacao") {
      linhas = docxDirectGroups(component).map(group => [docxCellFromSlot(docxPartSlot(docxDirectPart(group, "janela")))]);
    } else if (type === "opcoes") {
      const groups = docxDirectGroups(component);
      linhas = groups.filter(group => !group.dataset.setFixed).map(group => [
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "alternativa"))),
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "correta")))
      ]);
      const feedback = groups.find(group => group.dataset.setFixed);
      linhas.push([{ texto: docxCellFromSlot(docxPartSlot(docxDirectPart(feedback, "feedcerto"))).texto || "", colspan: 2 }]);
      linhas.push([{ texto: docxCellFromSlot(docxPartSlot(docxDirectPart(feedback, "feederrado"))).texto || "", colspan: 2 }]);
    } else if (type === "verdadeirofalso") {
      const groups = docxDirectGroups(component);
      linhas = groups.filter(group => !group.dataset.setFixed).map(group => [
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "correta"))),
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "alternativa")))
      ]);
      const feedback = groups.find(group => group.dataset.setFixed);
      linhas.push([{ texto: docxCellFromSlot(docxPartSlot(docxDirectPart(feedback, "feedcerto"))).texto || "", colspan: 2 }]);
      linhas.push([{ texto: docxCellFromSlot(docxPartSlot(docxDirectPart(feedback, "feederrado"))).texto || "", colspan: 2 }]);
    } else if (type === "ligapontos") {
      const groups = docxDirectGroups(component);
      const pairsGroups = groups.filter(group => !group.dataset.setFixed);
      const feedback = groups.find(group => group.dataset.setFixed);
      const certo = docxCellFromSlot(docxPartSlot(docxDirectPart(feedback, "feedcerto")));
      const errado = docxCellFromSlot(docxPartSlot(docxDirectPart(feedback, "feederrado")));
      linhas = pairsGroups.map((group, index) => [
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "opcao"))),
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "resposta"))),
        index === 0 ? certo : "",
        index === 0 ? errado : ""
      ]);
    } else if (type === "relacionarcolunas") {
      const groups = docxDirectGroups(component);
      const pairsGroups = groups.filter(group => !group.dataset.setFixed);
      const feedback = groups.find(group => group.dataset.setFixed);
      linhas = pairsGroups.map(group => [
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "opcao"))),
        docxCellFromSlot(docxPartSlot(docxDirectPart(group, "resposta")))
      ]);
      const modoCard = body?.querySelector(":scope > .visual-part-card[data-visual-part='modo']");
      const modo = docxPartSlot(modoCard)?.textContent.trim() || "letra";
      linhas.push([{ texto: modo, colspan: 2 }]);
      linhas.push([{ texto: docxCellFromSlot(docxPartSlot(docxDirectPart(feedback, "feedcerto"))).texto || "", colspan: 2 }]);
      linhas.push([{ texto: docxCellFromSlot(docxPartSlot(docxDirectPart(feedback, "feederrado"))).texto || "", colspan: 2 }]);
    } else if (type === "forca") {
      const groups = docxDirectGroups(component);
      const fields = groups.flatMap(group => [...group.children].filter(child => child.classList?.contains("visual-part-card")));
      const byMarker = marker => {
        const part = fields.find(item => item.dataset.visualPart === marker);
        return docxCellFromSlot(docxPartSlot(part));
      };
      linhas = [[byMarker("palavra")], [byMarker("dica")], [byMarker("feedcerto")], [byMarker("feederrado")]];
    } else if (type === "video") {
      const items = [...(body?.querySelectorAll(":scope > .visual-video-set") || [])];
      linhas = items.map(item => {
        const mode = item.querySelector(":scope > .visual-video-options .visual-video-mode-select")?.value === "modal" ? "modal" : "direto";
        const label = item.querySelector(":scope > .visual-video-label-field .visual-video-label-input")?.value || "";
        const slot = item.querySelector(":scope > .visual-field--video-source > .visual-slot");
        const source = String(slot?.innerText ?? slot?.textContent ?? "").replace(/\s+/g, " ").trim();
        const suffix = mode === "modal" ? " (abre em um modal)" : " (coloca na tela o player de vídeo com controles)";
        return [mode === "modal" ? label : "", source ? `${source}${suffix}` : ""];
      });
    } else if (type === "arquivo") {
      const items = [...(body?.querySelectorAll(":scope > .visual-arquivo-set") || [])];
      linhas = items.map(item => [
        item.querySelector(":scope > .visual-arquivo-label-field .visual-arquivo-label-input")?.value || "",
        docxCellFromSlot(item.querySelector(":scope > .visual-field--arquivo-name > .visual-slot"))
      ]);
    }

    const preambulo = docxComponentPreamble(component);
    return {
      slug: schemaSlug,
      tipo: type,
      preambulo,
      tabela: { ...modelo, linhas }
    };
  }

  function serializeDocxNode(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return docxEscape(node.nodeValue || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    if (node.classList?.contains("visual-empty-block") || node.classList?.contains("visual-image-placeholder") ||
        node.classList?.contains("visual-component-header") || node.classList?.contains("visual-part-header") ||
        node.matches?.("button, input, textarea, select, script, style, .visual-set-controls, .visual-add-pair, .visual-add-structure-set")) return "";
    if (node.classList?.contains("visual-component")) return renderDocxComponent(node);
    if (node.classList?.contains("visual-text-block") || node.classList?.contains("visual-slot")) {
      const content = [...node.childNodes].map(child => serializeDocxNode(child)).join("");
      return content && !/<(?:p|div|h[1-6]|ul|ol|blockquote|table)\b/i.test(content) ? `<p>${content}</p>` : content;
    }

    const tag = String(node.tagName || "").toLowerCase();
    if (tag === "div" && node.getAttribute("style")?.replace(/\s/g, "").includes("display:contents")) {
      return [...node.childNodes].map(child => serializeDocxNode(child)).join("");
    }
    if (!DOCX_TAGS_PERMITIDAS.has(tag)) return [...node.childNodes].map(child => serializeDocxNode(child)).join("");

    const attributes = [];
    for (const name of ["href", "src", "alt", "title", "width", "height", "colspan", "rowspan", "target", "rel"]) {
      const value = node.getAttribute(name);
      if (value == null) continue;
      if (name === "href" || name === "src") {
        const normalized = value.trim();
        if (/^\s*javascript:/i.test(normalized) || /^\s*data:(?!image\/)/i.test(normalized)) continue;
      }
      attributes.push(`${name}="${docxEscape(value)}"`);
    }
    if (tag === "a" && node.getAttribute("target") === "_blank" && !node.getAttribute("rel")) attributes.push('rel="noopener noreferrer"');
    const serializedAttributes = attributes.length ? ` ${attributes.join(" ")}` : "";
    if (tag === "img") return `<img${serializedAttributes}>`;
    return `<${tag}${serializedAttributes}>${[...node.childNodes].map(child => serializeDocxNode(child)).join("")}</${tag}>`;
  }

  function renderDocxComponent(component) {
    const data = buildDocxComponentData(component);
    if (!data || !tableTransfer) return "";
    const tableHtml = tableTransfer.criarTabelaFormatada(data.tabela, data.slug);
    return `<div class="editor-docx-component" data-componente="${docxEscape(data.tipo)}">${data.preambulo ? `<div class="editor-docx-flow-block">${data.preambulo}</div>` : ""}${tableHtml}</div>`;
  }

  function docxStructureHtml(root) {
    if (!root) return "";
    const output = [];
    for (const node of [...root.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE) {
        if ((node.nodeValue || "").trim()) output.push(`<p class="editor-docx-flow-block">${docxEscape(node.nodeValue.trim())}</p>`);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE || node.classList.contains("visual-empty-block")) continue;
      if (node.classList.contains("visual-component")) {
        output.push(renderDocxComponent(node));
        continue;
      }
      const html = serializeDocxNode(node).trim();
      if (html) output.push(`<div class="editor-docx-flow-block">${html}</div>`);
    }
    return output.join("");
  }

  function renderDocxStructure() {
    if (!docxContent || !docxCopyButton || !visualRoot) return;
    if (docxDraftDirty && visualStructure?.getMode() === "docx") return;
    const html = docxStructureHtml(visualRoot);
    if (html) {
      docxContent.innerHTML = html;
      docxContent.classList.remove("is-empty");
      docxCopyButton.disabled = false;
    } else {
      docxContent.replaceChildren();
      docxContent.classList.add("is-empty");
      docxCopyButton.disabled = true;
    }
  }

  function renderSourceAsDocxHtml(source) {
    const temporaryRoot = document.createElement("div");
    const temporaryTextarea = document.createElement("textarea");
    temporaryTextarea.value = String(source || "");
    const temporaryStructure = window.AutomatoVisualStructure?.create({
      root: temporaryRoot,
      textarea: temporaryTextarea,
      examples,
      notify: () => {},
      onChange: () => {}
    });
    temporaryStructure?.buildFromSource(temporaryTextarea.value);
    return docxStructureHtml(temporaryRoot);
  }

  function normalizeDocxImportText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200b\ufeff]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  }

  const DOCX_IMPORT_TAGS = new Set([
    "p", "div", "span", "strong", "b", "em", "i", "u", "s", "del", "ul", "ol", "li",
    "a", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "sub", "sup",
    "mark", "small", "br", "hr", "img", "picture", "figure", "figcaption"
  ]);
  const DOCX_DRAFT_TAGS = new Set([
    ...DOCX_IMPORT_TAGS, "table", "thead", "tbody", "tfoot", "tr", "td", "th", "colgroup", "col"
  ]);
  const DOCX_DRAFT_STYLE_PROPERTIES = new Set([
    "color", "background-color", "font-size", "font-weight", "font-style", "font-family", "text-decoration",
    "text-align", "vertical-align", "width", "min-width", "max-width", "height", "border", "border-color",
    "border-width", "border-style", "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "white-space", "list-style-type"
  ]);

  function directDocxTableRows(table) {
    return [...table.querySelectorAll("tr")].filter(row => row.closest("table") === table);
  }

  function textWithoutNestedDocxTables(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("table").forEach(table => table.remove());
    return String(clone.textContent || "").replace(/\u00a0/g, " ").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function detectDocxImportTableType(table) {
    for (const row of directDocxTableRows(table)) {
      const cells = [...row.children].filter(cell => /^(TD|TH)$/.test(cell.tagName));
      if (!cells.length) continue;
      const heading = normalizeDocxImportText(cells.map(textWithoutNestedDocxTables).join(" "));
      const match = Object.entries(componentTables).find(([, model]) => normalizeDocxImportText(model?.titulo) === heading);
      if (match) return match[0];
    }
    return "";
  }

  function importCellFromElement(cell) {
    const texto = textWithoutNestedDocxTables(cell);
    const html = [...cell.childNodes].map(serializeDocxImportNode).join("").trim();
    return { html, texto, colspan: Math.max(1, Number(cell.colSpan) || 1) };
  }

  function importRowsFromDocxTable(table) {
    return directDocxTableRows(table)
      .map(row => {
        const cells = [...row.children].filter(cell => /^(TD|TH)$/.test(cell.tagName)).map(importCellFromElement);
        return { cells, isHeader: [...row.children].some(cell => cell.tagName === "TH") };
      })
      .filter(row => row.cells.length > 0);
  }

  function serializeDocxLayoutTable(table) {
    return directDocxTableRows(table).map(row => {
      const cells = [...row.children].filter(cell => /^(TD|TH)$/.test(cell.tagName));
      return cells.map(cell => [...cell.childNodes].map(serializeDocxImportNode).join("").trim()).filter(Boolean).join(" ");
    }).filter(Boolean).join("<br>");
  }

  function safeDocxImportAttribute(element, name) {
    const value = element.getAttribute(name);
    if (value == null) return "";
    const normalized = value.trim();
    if (["href", "src"].includes(name) && /^(?:javascript|vbscript):/i.test(normalized)) return "";
    if (name === "src" && /^data:/i.test(normalized) && !/^data:image\/(?:png|jpe?g|gif|webp|bmp|svg\+xml);/i.test(normalized)) return "";
    if (name === "href" && /^data:/i.test(normalized)) return "";
    return `${name}="${docxEscape(value)}"`;
  }

  function serializeDocxImportNode(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return docxEscape(node.nodeValue || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = String(node.tagName || "").toLowerCase();
    if (["script", "style", "link", "meta", "iframe", "object", "embed", "form", "input", "button"].includes(tag)) return "";

    if (tag === "table") {
      const slug = detectDocxImportTableType(node);
      if (slug) {
        const rows = getDocxImportRows(slug, importRowsFromDocxTable(node));
        const result = buildDocxImportMarkup(slug, rows);
        return result.markup || [...node.childNodes].map(serializeDocxImportNode).join("");
      }
      // Tabelas de layout do Word são desembrulhadas; tabelas reconhecidas
      // como componentes são convertidas acima e mantêm sua hierarquia.
      return serializeDocxLayoutTable(node);
    }

    if (tag === "div") return [...node.childNodes].map(serializeDocxImportNode).join("");
    if (!DOCX_IMPORT_TAGS.has(tag)) return [...node.childNodes].map(serializeDocxImportNode).join("");
    const children = [...node.childNodes].map(serializeDocxImportNode).join("");
    const attributes = [];
    for (const name of ["href", "src", "alt", "title", "width", "height", "colspan", "rowspan", "target", "rel"]) {
      const attribute = safeDocxImportAttribute(node, name);
      if (attribute) attributes.push(attribute);
    }
    if (tag === "a" && node.getAttribute("target") === "_blank" && !node.getAttribute("rel")) attributes.push('rel="noopener noreferrer"');

    let content = children;
    if (tag === "span") {
      const style = String(node.getAttribute("style") || "").toLowerCase();
      if (/font-weight\s*:\s*(?:bold|[6-9]00)/.test(style) || /mso-bidi-font-weight\s*:\s*bold/.test(style)) content = `<strong>${content}</strong>`;
      if (/font-style\s*:\s*italic/.test(style)) content = `<em>${content}</em>`;
      if (/text-decoration[^;]*underline/.test(style)) content = `<u>${content}</u>`;
    }
    if (tag === "img") return `<img${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
    return `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>${content}</${tag}>`;
  }

  function parseDocxImportHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    template.content.querySelectorAll("script, style, link, meta, iframe, object, embed, form, input, button").forEach(node => node.remove());
    const markup = [...template.content.childNodes].map(serializeDocxImportNode).join("").trim();
    return { markup };
  }

  function lessonHeaderLabel(table) {
    const firstRow = directDocxTableRows(table)[0];
    const firstCell = [...(firstRow?.children || [])].find(cell => /^(TD|TH)$/.test(cell.tagName));
    return normalizeDocxImportText(textWithoutNestedDocxTables(firstCell || document.createElement("td")));
  }

  function extractLessonTopics(html, xmlDocument) {
    const parsed = new DOMParser().parseFromString(String(html || ""), "text/html");
    const topLevelTables = [...parsed.querySelectorAll("table")].filter(table => !table.parentElement?.closest("table"));
    const topics = [];
    let sequence = 0;
    for (const table of topLevelTables) {
      const rows = directDocxTableRows(table);
      if (rows.length < 2) continue;
      const headingCells = [...(rows[0].children || [])].filter(cell => /^(TD|TH)$/.test(cell.tagName));
      if (headingCells.length < 2) continue;
      const label = lessonHeaderLabel(table);
      if (!/^(?:telas?|teste|topico|licao|aula)\b/i.test(label)) continue;
      const title = textWithoutNestedDocxTables(headingCells[1]);
      if (!title) continue;
      const xmlTable = window.AutomatoDocxWriteback?.findTopicTable(xmlDocument, title);
      if (!xmlTable) continue;
      const topicIndex = sequence++;
      const screensForTopic = rows.slice(1).map((row, index) => {
        const cells = [...(row.children || [])].filter(cell => /^(TD|TH)$/.test(cell.tagName));
        const number = textWithoutNestedDocxTables(cells[0]) || String(index + 1);
        const contentHtml = cells[1]?.innerHTML || cells[0]?.innerHTML || "";
        const source = parseDocxImportHtml(contentHtml).markup;
        return {
          id: `lesson-${topicIndex}-screen-${index + 1}`,
          title: `Tela ${number}`,
          source,
          originalSource: source,
          wordRowIndex: index,
          isNew: false
        };
      });
      if (!screensForTopic.length) continue;
      const topic = {
        id: `lesson-topic-${topicIndex}`,
        title,
        screens: screensForTopic,
        originalScreenIds: screensForTopic.map(screen => screen.id)
      };
      topics.push(topic);
    }
    return topics;
  }

  function renderLessonTopicButtons() {
    if (!lessonTopicsElement) return;
    lessonTopicsElement.replaceChildren();
    lessonTopicsElement.hidden = !lessonTopics.length;
    lessonTopics.forEach((topic, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `editor-topic-button${topic === activeLessonTopic ? " is-active" : ""}`;
      button.dataset.lessonTopicId = topic.id;
      button.setAttribute("aria-pressed", String(topic === activeLessonTopic));
      button.innerHTML = `<span>Tópico ${index + 1} — ${docxEscape(topic.title)}</span><small>${topic.screens.length} ${topic.screens.length === 1 ? "tela" : "telas"}</small>`;
      button.title = `Abrir tópico ${index + 1}: ${topic.title}`;
      lessonTopicsElement.appendChild(button);
    });
  }

  function prepareLessonFileInput() {
    lessonFileInput?.click();
  }

  async function readLessonFile(file, handle = null) {
    if (!file || !/\.docx$/i.test(file.name || "")) {
      showToast("Escolha um documento Word no formato DOCX.", true);
      return;
    }
    if ((loadedLessonDocx && hasUnsavedLessonChanges()) || screens.some(screen => screen.source.trim())) {
      const shouldReplace = window.confirm("Carregar outra lição vai substituir o conteúdo aberto no editor. Deseja continuar?");
      if (!shouldReplace) return;
    }
    lessonLoadButton.disabled = true;
    lessonSaveButton.disabled = true;
    if (lessonSaveState) lessonSaveState.textContent = "Lendo documento…";
    try {
      if (!window.JSZip || !window.mammoth || !window.AutomatoDocxWriteback) {
        throw new Error("Os recursos para ler e salvar DOCX não foram carregados. Atualize a página e tente novamente.");
      }
      const bytes = await file.arrayBuffer();
      const zip = await window.JSZip.loadAsync(bytes);
      const documentPart = zip.file("word/document.xml");
      if (!documentPart) throw new Error("Este arquivo não contém um documento Word válido.");
      const xmlText = await documentPart.async("string");
      const xmlDocument = new DOMParser().parseFromString(xmlText, "application/xml");
      if (xmlDocument.querySelector("parsererror")) throw new Error("Não foi possível ler a estrutura interna do DOCX.");
      const converted = await window.mammoth.convertToHtml({ arrayBuffer: bytes }, {
        convertImage: window.mammoth.images.inline(image => image.read("base64").then(base64 => ({ src: `data:${image.contentType};base64,${base64}` })))
      });
      const parsedTopics = extractLessonTopics(converted.value, xmlDocument);
      if (!parsedTopics.length) throw new Error("Não encontrei tópicos com telas neste DOCX. Confira se o roteiro usa tabelas de tópico com a coluna Tela.");
      loadedLessonDocx = { handle, fileName: file.name, savedBlob: file, zip, xmlDocument };
      lessonTopics = parsedTopics;
      activeLessonTopic = lessonTopics[0];
      screens = activeLessonTopic.screens;
      screenSequence = nextLessonScreenNumber(screens) - 1;
      activeScreenId = screens[0].id;
      lessonFileLabel.textContent = file.name;
      lessonFileLabel.title = file.name;
      renderLessonTopicButtons();
      renderScreenTabs();
      loadScreen(activeScreenId, true);
      updateLessonSaveState();
      const avisoEstilos = converted.messages?.length
        ? ` Alguns estilos do Word podem ter sido simplificados (${converted.messages.length} ${converted.messages.length === 1 ? "aviso" : "avisos"}).`
        : "";
      showToast(`${lessonTopics.length} ${lessonTopics.length === 1 ? "tópico carregado" : "tópicos carregados"}.${avisoEstilos}`, false, Boolean(converted.messages?.length));
    } catch (error) {
      console.error("Não foi possível abrir a lição DOCX:", error);
      if (lessonSaveState) lessonSaveState.textContent = "";
      showToast(error.message || "Não foi possível abrir este documento Word.", true);
    } finally {
      lessonLoadButton.disabled = false;
      lessonFileInput.value = "";
      updateLessonSaveState();
    }
  }

  async function openLessonDocx() {
    if (typeof window.showOpenFilePicker === "function") {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [{ description: "Documento Word", accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] } }]
        });
        await readLessonFile(await handle.getFile(), handle);
      } catch (error) {
        if (error?.name !== "AbortError") showToast(error.message || "Não foi possível abrir o documento selecionado.", true);
      }
      return;
    }
    prepareLessonFileInput();
  }

  function setSavedLessonBaseline() {
    lessonTopics.forEach(topic => {
      topic.screens.forEach((screen, index) => {
        screen.wordRowIndex = index;
        screen.originalSource = screen.source;
        screen.isNew = false;
        screen.title = `Tela ${index + 1}`;
      });
      topic.originalScreenIds = topic.screens.map(screen => screen.id);
    });
    screenSequence = nextLessonScreenNumber(screens) - 1;
  }

  async function saveLoadedLesson() {
    if (!loadedLessonDocx || !hasUnsavedLessonChanges()) return;
    saveCurrentScreen();
    lessonSaveButton.disabled = true;
    lessonSaveButton.classList.add("is-saving");
    if (lessonSaveState) lessonSaveState.textContent = "Salvando documento…";
    try {
      if (loadedLessonDocx.handle) {
        const permissionRequest = loadedLessonDocx.handle.requestPermission || loadedLessonDocx.handle.queryPermission;
        const permission = permissionRequest
          ? await permissionRequest.call(loadedLessonDocx.handle, { mode: "readwrite" })
          : "denied";
        if (permission !== "granted") throw new Error("O navegador não autorizou a gravação neste documento. Reabra o arquivo e conceda acesso para salvar.");
      }
      const zip = await window.JSZip.loadAsync(await loadedLessonDocx.savedBlob.arrayBuffer());
      const xmlText = await zip.file("word/document.xml").async("string");
      const xmlDocument = new DOMParser().parseFromString(xmlText, "application/xml");
      const blob = await window.AutomatoDocxWriteback.writeBack(zip, xmlDocument, lessonTopics, renderSourceAsDocxHtml);
      if (loadedLessonDocx.handle) {
        const writable = await loadedLessonDocx.handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        const baseName = loadedLessonDocx.fileName.replace(/\.docx$/i, "");
        link.download = `${baseName}-atualizado.docx`;
        document.body.appendChild(link); link.click(); link.remove();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      }
      loadedLessonDocx.savedBlob = blob;
      loadedLessonDocx.zip = zip;
      loadedLessonDocx.xmlDocument = xmlDocument;
      setSavedLessonBaseline();
      renderLessonTopicButtons();
      renderScreenTabs();
      updateLessonSaveState();
      showToast(loadedLessonDocx.handle ? "Alterações salvas no mesmo DOCX." : "Documento atualizado. Salve a cópia baixada no lugar do original.");
    } catch (error) {
      console.error("Não foi possível salvar a lição DOCX:", error);
      showToast(error.message || "Não foi possível salvar o documento Word.", true);
      updateLessonSaveState();
    } finally {
      lessonSaveButton.classList.remove("is-saving");
      lessonSaveButton.disabled = !hasUnsavedLessonChanges();
    }
  }

  function clipboardImageFiles(clipboard) {
    return [...(clipboard?.items || [])]
      .filter(item => item.type?.startsWith("image/"))
      .map(item => item.getAsFile?.())
      .filter(Boolean);
  }

  function readImageAsDataUrl(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  function attachClipboardImages(markup, imageSources) {
    let nextImage = 0;
    let foundImage = false;
    const output = String(markup || "").replace(/<img\b[^>]*>/gi, tag => {
      foundImage = true;
      const image = imageSources[nextImage++];
      const src = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
      const needsLocalImage = !src || /^(?:file:|cid:|ms-word:)/i.test(src[2]);
      if (!needsLocalImage || !image) return tag;
      return src
        ? tag.replace(src[0], `src="${docxEscape(image)}"`)
        : tag.replace(/>$/, ` src="${docxEscape(image)}">`);
    });
    if (!foundImage && imageSources.length) {
      return `${output}${imageSources.map(image => `<img src="${docxEscape(image)}" alt="Imagem colada do roteiro">`).join("")}`;
    }
    return output;
  }

  function sanitizeDocxDraftStyle(styleText) {
    return String(styleText || "").split(";").map(declaration => {
      const separator = declaration.indexOf(":");
      if (separator < 1) return "";
      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      if (!DOCX_DRAFT_STYLE_PROPERTIES.has(property) || !value || /url\s*\(|expression\s*\(|javascript:|@import/i.test(value)) return "";
      return `${property}: ${value}`;
    }).filter(Boolean).join("; ");
  }

  function safeDocxDraftAttributes(element) {
    const attributes = [];
    for (const name of ["href", "src", "alt", "title", "width", "height", "colspan", "rowspan", "target", "rel", "scope", "align", "valign", "border", "cellpadding", "cellspacing", "bgcolor"]) {
      const attribute = safeDocxImportAttribute(element, name);
      if (attribute) attributes.push(attribute);
    }
    const style = sanitizeDocxDraftStyle(element.getAttribute("style"));
    if (style) attributes.push(`style="${docxEscape(style)}"`);
    if (element.tagName.toLowerCase() === "a" && element.getAttribute("target") === "_blank" && !element.getAttribute("rel")) {
      attributes.push('rel="noopener noreferrer"');
    }
    return attributes;
  }

  function serializeDocxDraftNode(node) {
    if (node.nodeType === Node.TEXT_NODE) return docxEscape(node.nodeValue || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const tag = String(node.tagName || "").toLowerCase();
    if (["script", "style", "link", "meta", "iframe", "object", "embed", "form", "input", "button", "textarea", "select"].includes(tag)) return "";
    const children = [...node.childNodes].map(serializeDocxDraftNode).join("");
    if (!DOCX_DRAFT_TAGS.has(tag)) return children;
    const attributes = safeDocxDraftAttributes(node);
    if (["img", "br", "hr", "col"].includes(tag)) return `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>`;
    return `<${tag}${attributes.length ? ` ${attributes.join(" ")}` : ""}>${children}</${tag}>`;
  }

  function sanitizeDocxDraftHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    const serialized = [...template.content.childNodes].map(serializeDocxDraftNode).join("");
    return serialized.trim();
  }

  function hasDocxContent() {
    return Boolean(docxContent && ((docxContent.textContent || "").trim() || docxContent.querySelector("img, table")));
  }

  function updateDocxDraftState() {
    if (visualStructure?.getMode() !== "docx") return;
    docxDraftDirty = true;
    docxContent?.classList.toggle("is-empty", !hasDocxContent());
    if (docxCopyButton) docxCopyButton.disabled = !hasDocxContent();
    updateLessonSaveState();
  }

  function commitDocxDraftToSource() {
    if (!docxDraftDirty || !docxContent) return;
    editor.value = parseDocxImportHtml(docxContent.innerHTML).markup;
    docxDraftDirty = false;
    updateLessonSaveState();
  }

  function insertDocxDraftHtml(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    const fragment = template.content;
    const selection = window.getSelection();
    let range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    if (!range || !docxContent?.contains(range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(docxContent);
      range.collapse(false);
    }
    selection?.removeAllRanges();
    selection?.addRange(range);
    docxContent.focus({ preventScroll: true });
    try {
      if (document.execCommand("insertHTML", false, html)) {
        updateDocxDraftState();
        return;
      }
    } catch (_) {}
    range.deleteContents();
    const last = fragment.lastChild;
    range.insertNode(fragment);
    if (last) {
      range.setStartAfter(last);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    docxContent?.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
  }

  function parseDocxImportPlainText(text) {
    return String(text || "")
      .replace(/\u0000/g, "")
      .split(/\r\n?|\n/)
      .filter(line => line.trim())
      .map(line => ({
        isHeader: false,
        cells: line.split("\t").map(value => ({ html: "", texto: value.trim(), colspan: 1 }))
      }));
  }

  function getDocxImportRows(slug, sourceRows) {
    const model = componentTables[slug];
    const title = normalizeDocxImportText(model?.titulo);
    return sourceRows.filter(row => {
      if (row.isHeader) return false;
      if (title && normalizeDocxImportText(row.cells.map(cell => cell.texto).join(" ")) === title) return false;
      if (slug === "imagem") return true;
      return row.cells.some(cell => cell.texto || cell.html);
    });
  }

  function detectDocxImportType(rows) {
    for (const row of rows) {
      const heading = normalizeDocxImportText(row.cells.map(cell => cell.texto).join(" "));
      if (!heading) continue;
      const match = Object.entries(componentTables).find(([, model]) => normalizeDocxImportText(model?.titulo) === heading);
      if (match) return match[0];
    }
    return "";
  }

  function inferDocxImportType(rows) {
    const data = rows.filter(row => !row.isHeader && row.cells.some(cell => cell.texto || cell.html));
    const flattenedText = data.flatMap(row => row.cells.map(cell => cell.texto)).join(" ");
    const normalize = normalizeDocxImportText(flattenedText);
    if (data.length > 0 && data.length <= 3 && data.every(row => row.cells.length === 1) && data.some(row => /<img\b/i.test(row.cells[0].html || ""))) return "imagem";
    if (/(?:youtube\.com|youtu\.be|abre em um modal|player de video com controles)/i.test(normalize)) return "video";
    if (data.some(row => /^(?:v|f)$/i.test(docxImportCellText(docxImportCell(row, 0))) && row.cells.length >= 2)) return "verdadeirofalso";
    if (data.some(row => /^(?:sim|nao)$/i.test(normalizeDocxImportText(docxImportCellText(docxImportCell(row, 1)))) && row.cells.length >= 2)) return "opcoes";
    if (/(?:letra ou numero|a, b, c|1, 2, 3)/i.test(normalize)) return "relacionarcolunas";

    if (data.length === 1 && data[0].cells.length >= 4) {
      const lastCells = normalizeDocxImportText(`${data[0].cells[2]?.texto || ""} ${data[0].cells[3]?.texto || ""}`);
      if (/(par correto|vire as cartas|encontre os pares)/.test(lastCells)) return "jogomemoria";
      if (/(correto!|ligacao|ligue os pontos|a associacao)/.test(lastCells)) return "ligapontos";
    }

    const documentExtension = /\.(?:pdf|docx?|xlsx?|pptx?|zip|csv|txt|odt|ods|odp)$/i;
    const videoExtension = /\.(?:mp4|mov|m4v|webm|avi|mkv)$/i;
    if (data.some(row => row.cells.some(cell => documentExtension.test(cell.texto)))) return "arquivo";
    if (data.some(row => row.cells.some(cell => videoExtension.test(cell.texto)))) return "video";
    if (data.length >= 2 && data.every(row => row.cells.length === 1) && data.some(row => /^(?:etapa|passo)\s*\d+/i.test(row.cells[0].texto))) return "mininavegacao";
    if (data.length === 4 && data.every(row => row.cells.length === 1)) return "forca";
    if (data.length === 1 && data[0].cells.length >= 2 && /^bot[aã]o\s*\d+/i.test(data[0].cells[0].texto)) return "botao";
    if (data.length === 1 && data[0].cells.length >= 2 && /^etapa\s*\d+/i.test(data[0].cells[0].texto)) return "sanfona";
    if (data.length === 1 && data[0].cells.length >= 2 && /^t[ií]tulo da aba\s*\d+/i.test(data[0].cells[0].texto)) return "abas";
    if (data.length === 1 && data[0].cells.length >= 2 && /^(?:frente|qual [eé]|o que [eé])/i.test(data[0].cells[0].texto)) return "flashcard";
    return "";
  }

  function isMergedImportRow(row) {
    return row.cells.length === 1 && row.cells[0].colspan > 1;
  }

  function isSingleFieldImportRow(row, rows) {
    if (row.cells.length !== 1) return false;
    return isMergedImportRow(row) || rows.length === 1 || rows.filter(item => item.cells.length === 1).length > 1;
  }

  function docxImportCell(row, index) {
    return row?.cells?.[index] || { html: "", texto: "", colspan: 1 };
  }

  function docxImportCellMarkup(cell) {
    return cell?.html || docxEscape(cell?.texto || "");
  }

  function docxImportCellText(cell) {
    return String(cell?.texto || "").trim();
  }

  function docxImportMarker(name, content) {
    return `<${name}>${content || ""}</${name}>`;
  }

  function buildDocxImportMarkup(slug, rows) {
    if (slug === "dividir") return rows.length
      ? { error: "O marcador Dividir não tem campos. Copie o cabeçalho Dividir para criar esse marcador." }
      : { markup: "<dividir>", error: "" };
    if (!rows.length) return { error: "Não encontrei uma linha com conteúdo. Copie uma linha da tabela do Word e tente novamente." };
    if (slug === "hotword" && rows.length > 1) return { error: "O Hotword usa uma linha por componente. Cole apenas uma linha." };

    let inner = "";
    if (slug === "imagem") {
      const cells = rows.map(row => docxImportCell(row, 0));
      const images = cells.flatMap(cell => [...String(cell.html || "").matchAll(/<img\b[^>]*>/gi)].map(match => match[0]));
      const title = cells.length ? docxImportCellText(cells[0]) : "";
      let footerIndex = -1;
      for (let index = 1; index < cells.length; index++) {
        if (docxImportCellText(cells[index])) footerIndex = index;
      }
      const footer = footerIndex >= 0 ? docxImportCellText(cells[footerIndex]) : "";
      inner = `<imagemitem data-titulo="${docxEscape(title)}" data-rodape="${docxEscape(footer)}">${images.join("")}</imagemitem>`;
      return { markup: `<componente tipo="imagem">${inner}</componente>` };
    }
    if (slug === "destaque") {
      inner = rows.map(row =>
        `<destaqueitem><destaquetitulo>${docxImportCellMarkup(docxImportCell(row, 0))}</destaquetitulo> ` +
        `<destaqueconteudo>${docxImportCellMarkup(docxImportCell(row, 1))}</destaqueconteudo></destaqueitem>`
      ).join("");
      return { markup: `<componente tipo="destaque">${inner}</componente>` };
    }
    if (["botao", "sanfona"].includes(slug)) {
      inner = rows.map(row => `${docxImportMarker("botao", docxImportCellMarkup(docxImportCell(row, 0)))}${docxImportMarker("janela", docxImportCellMarkup(docxImportCell(row, 1)))}`).join("");
      return { markup: `<${slug === "botao" ? "botoes" : "sanfona"}>${inner}</${slug === "botao" ? "botoes" : "sanfona"}>` };
    }
    if (slug === "hotword") {
      const row = rows[0];
      inner = `${docxImportMarker("hotword", docxImportCellMarkup(docxImportCell(row, 0)))}${docxImportMarker("janela", docxImportCellMarkup(docxImportCell(row, 1)))}`;
      return { markup: `<componente tipo="hotword">${inner}</componente>` };
    }
    if (slug === "abas" || slug === "flashcard") {
      const first = slug === "abas" ? "aba" : "frente";
      const second = slug === "abas" ? "janela" : "verso";
      inner = rows.map(row => `${docxImportMarker(first, docxImportCellMarkup(docxImportCell(row, 0)))}${docxImportMarker(second, docxImportCellMarkup(docxImportCell(row, 1)))}`).join("");
      return { markup: `<${slug}>${inner}</${slug}>` };
    }
    if (slug === "jogomemoria") {
      inner = rows.map((row, index) => `${index === 0 && docxImportCellMarkup(docxImportCell(row, 3)) ? docxImportMarker("frente", docxImportCellMarkup(docxImportCell(row, 3))) : ""}${docxImportMarker("carta1", docxImportCellMarkup(docxImportCell(row, 0)))}${docxImportMarker("carta2", docxImportCellMarkup(docxImportCell(row, 1)))}${docxImportMarker("feedback", docxImportCellMarkup(docxImportCell(row, 2)))}`).join("");
      return { markup: `<jogomemoria>${inner}</jogomemoria>` };
    }
    if (slug === "mininavegacao") {
      inner = rows.map(row => docxImportMarker("janela", docxImportCellMarkup(docxImportCell(row, 0)))).join("");
      return { markup: `<mininavegacao>${inner}</mininavegacao>` };
    }
    if (["opcoes", "verdadeirofalso"].includes(slug)) {
      const fieldRows = rows.filter(row => isSingleFieldImportRow(row, rows));
      let fieldIndex = 0;
      inner = rows.map(row => {
        if (isSingleFieldImportRow(row, rows)) {
          const marker = fieldIndex === 0 ? "feedcerto" : "feederrado";
          fieldIndex++;
          return docxImportMarker(marker, docxImportCellMarkup(docxImportCell(row, 0)));
        }
        const first = docxImportCellMarkup(docxImportCell(row, 0));
        const second = docxImportCellMarkup(docxImportCell(row, 1));
        return slug === "opcoes"
          ? `${docxImportMarker("alternativa", first)}${docxImportMarker("correta", second)}`
          : `${docxImportMarker("correta", first)}${docxImportMarker("alternativa", second)}`;
      }).join("");
      return { markup: `<${slug}>${inner}</${slug}>` };
    }
    if (slug === "ligapontos") {
      const pares = [];
      const feedbackCerto = [];
      const feedbackErrado = [];
      rows.forEach(row => {
        const opcao = docxImportCell(row, 0);
        const resposta = docxImportCell(row, 1);
        if (opcao.texto || opcao.html || resposta.texto || resposta.html) {
          pares.push(
            `${docxImportMarker("opcao", docxImportCellMarkup(opcao))}${docxImportMarker("resposta", docxImportCellMarkup(resposta))}`
          );
        }
        const certo = docxImportCell(row, 2);
        const errado = docxImportCell(row, 3);
        if (certo.texto || certo.html) feedbackCerto.push(docxImportCellMarkup(certo));
        if (errado.texto || errado.html) feedbackErrado.push(docxImportCellMarkup(errado));
      });
      // A tabela Word permite colocar os dois feedbacks na mesma linha de um
      // par. A atividade espera todos os pares antes dos marcadores de feedback.
      inner = pares.join("");
      if (feedbackCerto.length) inner += docxImportMarker("feedcerto", feedbackCerto.join("<br>"));
      if (feedbackErrado.length) inner += docxImportMarker("feederrado", feedbackErrado.join("<br>"));
      return { markup: `<ligapontos>${inner}</ligapontos>` };
    }
    if (slug === "relacionarcolunas") {
      const fieldRows = rows.filter(row => isSingleFieldImportRow(row, rows));
      let fieldIndex = 0;
      inner = rows.map(row => {
        if (isSingleFieldImportRow(row, rows)) {
          let marker = fieldRows.length >= 3 ? ["modo", "feedcerto", "feederrado"][fieldIndex] : ["feedcerto", "feederrado"][fieldIndex];
          const rowText = normalizeDocxImportText(docxImportCellText(docxImportCell(row, 0)));
          if (fieldRows.length === 1 && /(?:letra|numero|a, b, c|1, 2, 3)/.test(rowText)) marker = "modo";
          fieldIndex++;
          return docxImportMarker(marker || "feedcerto", docxImportCellMarkup(docxImportCell(row, 0)));
        }
        return `${docxImportMarker("opcao", docxImportCellMarkup(docxImportCell(row, 0)))}${docxImportMarker("resposta", docxImportCellMarkup(docxImportCell(row, 1)))}`;
      }).join("");
      return { markup: `<relacionarcolunas>${inner}</relacionarcolunas>` };
    }
    if (slug === "forca") {
      const markers = ["palavra", "dica", "feedcerto", "feederrado"];
      inner = rows.map((row, index) => docxImportMarker(rows.length === 1 ? "palavra" : (markers[index] || "palavra"), docxImportCellMarkup(docxImportCell(row, 0)))).join("");
      return { markup: `<componente tipo="forca">${inner}</componente>` };
    }
    if (slug === "video") {
      const items = rows.map(row => {
        const label = docxImportCellText(docxImportCell(row, 0));
        let source = docxImportCellText(docxImportCell(row, 1));
        const suffix = source.match(/\s*\((abre em um modal|coloca na tela o player de v[ií]deo com controles)\)\s*$/i);
        const modal = suffix ? /modal/i.test(suffix[1]) : Boolean(label);
        if (suffix) source = source.slice(0, suffix.index).trim();
        const origem = /(?:youtube\.com|youtu\.be)/i.test(source) ? "youtube" : "arquivo";
        return `<videoitem data-modo="${modal ? "modal" : "direto"}" data-origem="${origem}" data-rotulo="${docxEscape(label)}">${docxEscape(source)}</videoitem>`;
      }).join("");
      return { markup: `<video>${items}</video>` };
    }
    if (slug === "arquivo") {
      inner = rows.map(row => `<arquivoitem data-rotulo="${docxEscape(docxImportCellText(docxImportCell(row, 0)))}">${docxEscape(docxImportCellText(docxImportCell(row, 1)))}</arquivoitem>`).join("");
      return { markup: `<arquivo>${inner}</arquivo>` };
    }
    return { error: "Este componente ainda não tem um formato de importação de linha configurado." };
  }

  function importDocxClipboard(event) {
    if (!docxContent?.contains(event.target) || visualStructure?.getMode() !== "docx") return;
    const clipboard = event.clipboardData;
    if (!clipboard) return;
    const imageFiles = clipboardImageFiles(clipboard);
    const clipboardHtml = clipboard.getData("text/html") || "";
    const plainText = clipboard.getData("text/plain") || "";
    let draftHtml = sanitizeDocxDraftHtml(clipboardHtml);
    if (!draftHtml && plainText) {
      const lines = plainText.replace(/\u0000/g, "").split(/\r\n?|\n/);
      if (lines.some(line => line.includes("\t"))) {
        draftHtml = `<table><tbody>${lines.filter(line => line.trim()).map(line => `<tr>${line.split("\t").map(cell => `<td>${docxEscape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      } else {
        draftHtml = lines.map(line => line.trim() ? `<p>${docxEscape(line)}</p>` : "<p><br></p>").join("");
      }
    }
    if (!draftHtml.trim() && !imageFiles.length) return;
    event.preventDefault();
    Promise.all(imageFiles.map(readImageAsDataUrl)).then(imageSources => {
      draftHtml = attachClipboardImages(draftHtml, imageSources.filter(Boolean));
      if (!draftHtml.trim()) return;
      insertDocxDraftHtml(draftHtml);
      showToast("Conteúdo colado. Edite aqui ou clique em Estrutura visual para organizar os componentes.");
    });
  }

  docxContent?.addEventListener("click", () => docxContent.focus({ preventScroll: true }));
  docxContent?.addEventListener("paste", importDocxClipboard);
  docxContent?.addEventListener("input", updateDocxDraftState);

  docxCopyButton?.addEventListener("click", async () => {
    if (!docxContent || !tableTransfer || docxCopyButton.disabled) return;
    const original = docxCopyButton.innerHTML;
    docxCopyButton.disabled = true;
    try {
      await tableTransfer.copiarHtmlFormatado(docxContent.innerHTML, docxContent.innerText || docxContent.textContent || "");
      docxCopyButton.innerHTML = '<i class="bi bi-check2" aria-hidden="true"></i><span>Copiado</span>';
      showToast("Estrutura copiada. Cole no Word para manter as tabelas e a formatação.");
    } catch (error) {
      console.error("Não foi possível copiar a estrutura DOCX:", error);
      showToast("Não foi possível copiar. Verifique a permissão do navegador.", true);
    } finally {
      window.setTimeout(() => {
        docxCopyButton.innerHTML = original;
        docxCopyButton.disabled = !hasDocxContent();
      }, 1800);
    }
  });

  function saveCurrentScreen() {
    const screen = getCurrentScreen();
    if (!screen) return;
    commitDocxDraftToSource();
    screen.source = getSource();
    if (activeLessonTopic) activeLessonTopic.screens = screens;
    renderScreenTabs(screen.id);
    updateLessonSaveState();
  }

  function topicHasUnsavedChanges(topic) {
    if (!topic) return false;
    const changedScreens = topic.screens.some(screen => screen.isNew || screen.source !== screen.originalSource);
    const removedScreens = topic.originalScreenIds.some(id => !topic.screens.some(screen => screen.id === id));
    return changedScreens || removedScreens;
  }

  function hasUnsavedLessonChanges() {
    return Boolean(loadedLessonDocx && (docxDraftDirty || lessonTopics.some(topicHasUnsavedChanges)));
  }

  function updateLessonSaveState() {
    if (!lessonSaveButton) return;
    const dirty = hasUnsavedLessonChanges();
    lessonSaveButton.disabled = !loadedLessonDocx || !dirty;
    lessonSaveState?.classList.toggle("is-dirty", dirty);
    if (lessonSaveState) lessonSaveState.textContent = dirty ? "Há alterações não salvas" : (loadedLessonDocx ? "Documento salvo" : "");
  }

  function componentLabel(source) {
    const component = String(source || "").match(/<\s*componente\b[^>]*\btipo\s*=\s*["']([^"']+)["']/i);
    const legacy = String(source || "").match(/<\s*(dividir|botoes|botao|hotword|abas|flashcard|opcoes|verdadeirofalso|forca|jogomemoria|mininavegacao|sanfona|ligapontos|relacionarcolunas|video|arquivo|imagem)\b/i);
    const type = (component?.[1] || legacy?.[1] || "").toLowerCase();
    const labels = {
      botoes: "Botões", botao: "Botões", hotword: "Hotword", abas: "Abas",
      flashcard: "Flashcard", opcoes: "Opções", verdadeirofalso: "Verdadeiro ou Falso", forca: "Forca", jogomemoria: "Jogo da memória", mininavegacao: "Mini navegação",
      sanfona: "Sanfona", ligapontos: "Liga-pontos", relacionarcolunas: "Relacionar Colunas", dividir: "Dividir", video: "Vídeo", arquivo: "Arquivo", imagem: "Imagem"
    };
    return labels[type] || "Conteúdo";
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
    return text.slice(0, 78) || "Conteúdo do componente";
  }

  function buildScreenThumbnail(screen) {
    const wrapper = document.createElement("div");
    wrapper.className = `editor-screen-card-wrap${screen.id === activeScreenId ? " is-active" : ""}`;
    wrapper.dataset.screenWrapperId = screen.id;
    wrapper.__screenSource = String(screen.source || "");

    const hasContent = Boolean(String(screen.source || "").trim());
    const mini = document.createElement("div");
    mini.className = `editor-screen-thumbnail${hasContent ? "" : " is-empty"}`;
    mini.setAttribute("aria-hidden", "true");

    if (!hasContent) {
      const empty = document.createElement("span");
      empty.className = "editor-screen-thumbnail-empty";
      empty.textContent = "Tela vazia";
      mini.appendChild(empty);
    } else {
      const loading = document.createElement("span");
      loading.className = "editor-screen-thumbnail-loading";
      loading.textContent = "Preparando prévia…";
      mini.appendChild(loading);
      mini.__previewScreen = screen;
      mini.__previewSource = String(screen.source || "");
    }

    const card = document.createElement("button");
    card.type = "button";
    card.className = "editor-screen-card";
    card.dataset.screenId = screen.id;
    card.setAttribute("role", "tab");
    card.setAttribute("aria-selected", String(screen.id === activeScreenId));
    card.setAttribute("aria-label", `${screen.title}${hasContent ? ", contém conteúdo" : ", vazia"}`);
    card.title = `Abrir ${screen.title}`;

    const caption = document.createElement("span");
    caption.className = "editor-screen-caption";
    caption.textContent = screen.title;
    wrapper.append(mini, card, caption);

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

  async function renderScreenThumbnailPreview(screen, thumbnail) {
    const source = String(screen?.source || "");
    if (!source.trim() || !thumbnail?.isConnected || thumbnail.__previewSource !== source) return;
    thumbnail.dataset.previewState = "loading";

    try {
      const response = await fetch("/api/editor-componentes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "tela", source })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Prévia indisponível.");
      if (!thumbnail.isConnected || screen.source !== source || thumbnail.__previewSource !== source) return;

      const frame = document.createElement("iframe");
      frame.className = "editor-screen-thumbnail-frame";
      frame.title = `Prévia visual de ${screen.title}`;
      frame.tabIndex = -1;
      frame.setAttribute("aria-hidden", "true");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.width = String(DESKTOP_PREVIEW_WIDTH);
      frame.height = String(DESKTOP_PREVIEW_HEIGHT);
      frame.srcdoc = createPreviewDocument(result.html || "");
      thumbnail.replaceChildren(frame);
      thumbnail.dataset.previewState = "rendered";
      resizeScreenThumbnailFrame(thumbnail);
    } catch (error) {
      if (!thumbnail.isConnected || screen.source !== source || thumbnail.__previewSource !== source) return;
      console.warn(`Não foi possível montar a miniatura de ${screen.title}:`, error);
      const fallback = document.createElement("div");
      fallback.className = "editor-screen-thumbnail-error";
      const type = document.createElement("strong");
      type.textContent = `Prévia parcial · ${componentLabel(source)}`;
      const sample = document.createElement("span");
      sample.textContent = sourceSample(source) || "Conteúdo desta tela";
      fallback.append(type, sample);
      thumbnail.replaceChildren(fallback);
      thumbnail.dataset.previewState = "partial";
    }
  }

  function queueScreenThumbnailPreview(screen, thumbnail) {
    if (!thumbnail?.__previewScreen || thumbnail.dataset.previewState) return;
    thumbnail.dataset.previewState = "waiting";
    if (screenThumbnailObserver) screenThumbnailObserver.observe(thumbnail);
    else void renderScreenThumbnailPreview(screen, thumbnail);
  }

  function resizeScreenThumbnailFrame(thumbnail) {
    const frame = thumbnail?.querySelector(".editor-screen-thumbnail-frame");
    if (!frame || !thumbnail.clientWidth) return;
    frame.style.transform = `scale(${thumbnail.clientWidth / DESKTOP_PREVIEW_WIDTH})`;
  }

  function renderScreenTabs(previewScreenId = "") {
    const existing = new Map([...screenList.children].map(wrapper => [wrapper.dataset.screenWrapperId, wrapper]));
    const wrappersNeedingPreview = [];
    const desired = screens.map(screen => {
      let wrapper = existing.get(screen.id);
      if (!wrapper || wrapper.__screenSource !== String(screen.source || "")) {
        if (wrapper) screenThumbnailObserver?.unobserve(wrapper.querySelector(".editor-screen-thumbnail"));
        wrapper = buildScreenThumbnail(screen);
        wrappersNeedingPreview.push(wrapper);
      }
      wrapper.__screenSource = String(screen.source || "");
      wrapper.classList.toggle("is-active", screen.id === activeScreenId);
      const card = wrapper.querySelector("[data-screen-id]");
      card?.setAttribute("aria-selected", String(screen.id === activeScreenId));
      return wrapper;
    });

    desired.forEach((wrapper, index) => {
      const current = screenList.children[index];
      if (current !== wrapper) screenList.insertBefore(wrapper, current || null);
    });
    // Selecting a screen must not rebuild every thumbnail. Only queue a new
    // or edited screen, plus the one explicitly opened by the user.
    const previewTargets = new Set(wrappersNeedingPreview);
    if (previewScreenId) {
      const selected = desired.find(wrapper => wrapper.dataset.screenWrapperId === previewScreenId);
      if (selected) previewTargets.add(selected);
    }
    previewTargets.forEach(wrapper => {
      const thumbnail = wrapper.querySelector(".editor-screen-thumbnail");
      queueScreenThumbnailPreview(thumbnail?.__previewScreen, thumbnail);
    });
    while (screenList.children.length > desired.length) {
      const stale = screenList.lastElementChild;
      screenThumbnailObserver?.unobserve(stale?.querySelector(".editor-screen-thumbnail"));
      stale?.remove();
    }
  }

  screenThumbnailObserver = "IntersectionObserver" in window
    ? new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          screenThumbnailObserver.unobserve(entry.target);
          const screen = entry.target.__previewScreen;
          if (screen) void renderScreenThumbnailPreview(screen, entry.target);
        });
      }, { root: screenList, rootMargin: "0px 120px", threshold: 0.01 })
    : null;

  window.addEventListener("resize", () => {
    screenList.querySelectorAll(".editor-screen-thumbnail").forEach(resizeScreenThumbnailFrame);
  }, { passive: true });

  function loadScreen(screenId, skipSaveCurrent = false) {
    if (!skipSaveCurrent) saveCurrentScreen();
    const screen = screens.find(item => item.id === screenId);
    if (!screen) return;

    activeScreenId = screen.id;
    editor.value = screen.source || "";
    visualStructure?.buildFromSource(editor.value);
    updateCount();
    renderScreenTabs(screen.id);
    updatePreview();
  }

  function loadLessonTopic(topicId) {
    const topic = lessonTopics.find(item => item.id === topicId);
    if (!topic || topic === activeLessonTopic) return;
    saveCurrentScreen();
    if (activeLessonTopic) activeLessonTopic.screens = screens;
    activeLessonTopic = topic;
    screens = topic.screens;
    screenSequence = nextLessonScreenNumber(screens) - 1;
    activeScreenId = screens[0]?.id || "";
    renderLessonTopicButtons();
    if (activeScreenId) loadScreen(activeScreenId, true);
    else {
      screenSequence = 0;
      addScreen();
    }
    updateLessonSaveState();
  }

  function nextLessonScreenNumber(topicScreens = screens) {
    return Math.max(0, ...topicScreens.map(screen => Number(String(screen.title || "").match(/\d+/)?.[0]) || 0)) + 1;
  }

  function addScreen() {
    saveCurrentScreen();
    screenSequence += 1;
    const prefix = activeLessonTopic ? `${activeLessonTopic.id}-screen` : "screen";
    const screen = {
      id: `${prefix}-${screenSequence}`,
      title: `Tela ${screenSequence}`,
      source: "",
      originalSource: "",
      wordRowIndex: null,
      isNew: Boolean(activeLessonTopic)
    };
    screens.push(screen);
    if (activeLessonTopic) activeLessonTopic.screens = screens;
    loadScreen(screen.id, true);
    visualStructure?.focus();
    updateLessonSaveState();
  }

  function deleteScreen(screenId) {
    if (screens.length <= 1) {
      showToast("O Editor precisa manter pelo menos uma tela.", true);
      return;
    }

    const index = screens.findIndex(screen => screen.id === screenId);
    if (index < 0) return;
    const screen = screens[index];
    if (!window.confirm(`Deseja excluir ${screen.title}? Todo o conteúdo dessa tela será perdido.`)) return;

    saveCurrentScreen();
    const wasActive = screen.id === activeScreenId;
    screens.splice(index, 1);
    if (wasActive) {
      const nextScreen = screens[Math.min(index, screens.length - 1)] || screens[0];
      loadScreen(nextScreen.id, true);
    } else {
      renderScreenTabs();
    }
    if (activeLessonTopic) activeLessonTopic.screens = screens;
    updateLessonSaveState();
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
    if (event.source !== previewFrame?.contentWindow) return;
    if (isolatedPreviewEnabled && event.origin !== previewOrigin) return;
    if (event.data?.type === "AUTOMATO_PREVIEW_READY") {
      previewFrameReady = true;
      setPreviewFrameDocument(currentPreviewDocument || createPreviewMessageDocument("Adicione um texto ou componente para visualizar o resultado."));
      return;
    }
    if (event.data?.type === "AUTOMATO_PREVIEW_CONTENT_READY") {
      previewFrame.contentWindow?.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: previewInspectMode }, isolatedPreviewEnabled ? previewOrigin : "*");
      return;
    }
    if (event.data?.type !== "AUTOMATO_INSPECT_TARGET") return;
    const sequence = clearInspectHighlight();
    locateInspectedElement(event.data, sequence);
  });

  function setPreviewInspectMode(enabled) {
    previewInspectMode = Boolean(enabled);
    previewInspectButton?.classList.toggle("is-active", previewInspectMode);
    previewInspectButton?.setAttribute("aria-pressed", String(previewInspectMode));
    previewFrame?.contentWindow?.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: previewInspectMode }, isolatedPreviewEnabled ? previewOrigin : "*");
    if (externalPreviewFrame) externalPreviewFrame.contentWindow?.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: previewInspectMode }, "*");
    else if (externalPreviewWindow && !externalPreviewWindow.closed && externalPreviewReady) {
      externalPreviewWindow.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: previewInspectMode }, previewOrigin);
    }
    if (previewInspectButton) previewInspectButton.title = previewInspectMode ? "Passe o mouse para destacar e clique para localizar na estrutura" : "Inspecionar elemento na estrutura de conteúdo";
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
    body.automato-inspect-mode, body.automato-inspect-mode * { cursor:crosshair !important; }
    [data-automato-inspect-hover] { outline:3px solid #f0a51b !important; outline-offset:3px !important; }
    .editor-preview-component-fallback { display:block; width:100%; min-height:88px; max-height:156px; box-sizing:border-box; overflow:hidden; padding:12px 16px; border:1px dashed #9eafa4; border-radius:12px; background:#f5f8f6; color:#34463d; }
    .editor-preview-component-fallback-label { display:block; color:#52715f; font-size:12px; font-weight:700; }
    .editor-preview-component-fallback p { display:-webkit-box; margin:6px 0 0; overflow:hidden; font-size:14px; line-height:1.4; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
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
    let inspectHoverNode = null;
    const clearInspectHover = () => {
      inspectHoverNode?.removeAttribute("data-automato-inspect-hover");
      inspectHoverNode = null;
    };
    const getInspectionSurface = target => target.closest(
      "#print-target, [role='dialog'], [aria-modal='true'], [aria-modal='false'], [data-automato-preview-portal]"
    );
    const getInspectOrigin = target => {
      const directOrigin = target.closest("[data-automato-inspect-id]");
      const dialog = target.closest(
        "[role='dialog'], [aria-modal='true'], [aria-modal='false'], [data-automato-preview-portal]"
      );
      const dialogOrigin = dialog?.querySelector("[data-automato-inspect-id]");
      const interactive = target.closest("button, a, [role='button']");
      const interactiveOrigin = interactive?.querySelector("[data-automato-inspect-id]");
      return directOrigin || (dialog && dialogOrigin) || interactiveOrigin;
    };
    window.addEventListener("message", event => {
      if (event.data?.type !== "AUTOMATO_INSPECT_MODE") return;
      inspectEnabled = Boolean(event.data.enabled);
      document.body.classList.toggle("automato-inspect-mode", inspectEnabled);
      if (!inspectEnabled) clearInspectHover();
    });
    document.addEventListener("pointermove", event => {
      if (!inspectEnabled) return;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      if (!target || target === document.body || !getInspectionSurface(target)) {
        clearInspectHover();
        return;
      }
      const origin = getInspectOrigin(target);
      // Origem serializada em display:contents não possui caixa visual. Nesse
      // caso, destacamos o elemento visível sob o cursor, mantendo a seleção
      // estrutural original para o clique.
      const candidate = origin?.getClientRects?.().length ? origin : target;
      if (candidate === inspectHoverNode) return;
      clearInspectHover();
      candidate.setAttribute("data-automato-inspect-hover", "true");
      inspectHoverNode = candidate;
    }, true);
    document.addEventListener("pointerout", event => {
      if (inspectEnabled && (!event.relatedTarget || !document.documentElement.contains(event.relatedTarget))) {
        clearInspectHover();
      }
    }, true);
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
    parent.postMessage({ type: "AUTOMATO_PREVIEW_CONTENT_READY" }, "*");
  <\/script>
</body>
</html>`;
  }

  function createPreviewMessageDocument(message) {
    const safeMessage = String(message || "Não foi possível processar o conteúdo.")
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
    const documentHtml = String(srcdoc || createPreviewMessageDocument("Adicione um texto ou componente para visualizar o resultado."));
    if (externalPreviewFrame) {
      externalPreviewFrame.srcdoc = documentHtml;
      return;
    }
    if (!externalPreviewWindow || externalPreviewWindow.closed || !externalPreviewReady) return;
    try {
      externalPreviewWindow.postMessage({
        type: "AUTOMATO_PREVIEW_RENDER",
        document: documentHtml,
        title: getCurrentScreen()?.title || "Tela"
      }, previewOrigin);
    } catch (_) { /* a aba pode estar encerrando */ }
  }

  function restorePreviewPanel() {
    window.clearInterval(externalPreviewCloseCheck);
    externalPreviewCloseCheck = null;
    if (externalPreviewMessageHandler) window.removeEventListener("message", externalPreviewMessageHandler);
    externalPreviewMessageHandler = null;
    externalPreviewFrame = null;
    externalPreviewWindow = null;
    externalPreviewReady = false;
    columns?.classList.remove("is-preview-detached");
    if (previewRestoreButton) previewRestoreButton.hidden = true;
    scheduleLateralPreviewViewportSync();
  }

  function openExternalPreview() {
    if (externalPreviewWindow && !externalPreviewWindow.closed) {
      externalPreviewWindow.focus();
      return;
    }

    // A página vai direto para a origem isolada. Abrir primeiro em about:blank
    // pode dar à janela uma origem opaca e impedir a comunicação segura.
    let popupUrl = "about:blank";
    if (isolatedPreviewEnabled) {
      const url = new URL(previewFrameUrl);
      url.searchParams.set("popup", "1");
      popupUrl = url.toString();
    }
    const popup = window.open(popupUrl, "automatoPreviewWindow");
    if (!popup) {
      showToast("O navegador bloqueou a nova aba. Permita pop-ups para o Autômato.", true);
      return;
    }

    externalPreviewWindow = popup;
    externalPreviewReady = false;
    if (isolatedPreviewEnabled) {
      externalPreviewMessageHandler = event => {
        if (event.source !== popup || event.origin !== previewOrigin) return;
        if (event.data?.type === "AUTOMATO_PREVIEW_READY") {
          externalPreviewReady = true;
          publishExternalPreview(currentPreviewDocument || createPreviewMessageDocument("Adicione um texto ou componente para visualizar o resultado."));
          if (previewInspectMode) popup.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: true }, previewOrigin);
          return;
        }
        if (event.data?.type === "AUTOMATO_PREVIEW_CONTENT_READY") {
          if (previewInspectMode) popup.postMessage({ type: "AUTOMATO_INSPECT_MODE", enabled: true }, previewOrigin);
          return;
        }
        if (event.data?.type === "AUTOMATO_INSPECT_TARGET") {
          const sequence = clearInspectHighlight();
          locateInspectedElement(event.data, sequence);
        }
      };
      window.addEventListener("message", externalPreviewMessageHandler);
    } else {
      const doc = popup.document;
      doc.open();
      doc.write("<!doctype html><html lang=\"pt-br\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Pré-visualização | Autômato</title></head><body style=\"margin:0\"></body></html>");
      doc.close();
      const frame = doc.createElement("iframe");
      frame.title = "Conteúdo em pré-visualização";
      frame.setAttribute("sandbox", "allow-scripts");
      frame.setAttribute("allow", "autoplay *; encrypted-media *; fullscreen *; picture-in-picture *");
      frame.style.cssText = "display:block;width:100vw;height:100vh;border:0";
      doc.body.appendChild(frame);
      externalPreviewFrame = frame;
    }

    columns?.classList.add("is-preview-detached");
    if (previewRestoreButton) previewRestoreButton.hidden = false;
    externalPreviewCloseCheck = window.setInterval(() => {
      if (!externalPreviewWindow || externalPreviewWindow.closed) restorePreviewPanel();
    }, 500);
    window.clearTimeout(previewTimer);
    renderRealPreview();
  }

  function updatePreview() {
    try {
      renderDocxStructure();
    } catch (error) {
      console.error("Não foi possível preparar a estrutura DOCX:", error);
      if (docxContent) docxContent.innerHTML = '<div class="editor-docx-empty">Não foi possível montar a estrutura DOCX. Revise os campos do componente.</div>';
      if (docxCopyButton) docxCopyButton.disabled = true;
    }
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
      const emptyDocument = createPreviewMessageDocument("Adicione um texto ou componente para visualizar o resultado.");
      setPreviewFrameDocument(emptyDocument);
      setPlaceholder(true, "Adicione um texto ou componente para visualizar o resultado.");
      publishExternalPreview(emptyDocument);
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

      const documentHtml = createPreviewDocument(result.html || "");
      setPreviewFrameDocument(documentHtml);
      publishExternalPreview(documentHtml);
      previewFrame.hidden = false;
      if (previewInspectMode) previewFrame.addEventListener("load", () => {
        // O usuário pode sair do modo enquanto o documento da prévia carrega.
        // Só reativa no iframe se o modo ainda estiver ativo nesse momento.
        if (previewInspectMode) setPreviewInspectMode(true);
      }, { once: true });
      scheduleLateralPreviewViewportSync();
    } catch (error) {
      if (error.name === "AbortError" || sequence !== previewSequence) return;
      const errorDocument = createPreviewMessageDocument(error.message || "Verifique o conteúdo da estrutura.");
      setPreviewFrameDocument(errorDocument);
      publishExternalPreview(errorDocument);
      previewFrame.hidden = false;
      scheduleLateralPreviewViewportSync();
    }
  }

  // A estrutura visual é a área principal. Estrutura DOCX usa os mesmos
  // modelos da Biblioteca e os preenche com os valores da tela atual.
  visualStructure = window.AutomatoVisualStructure?.create({
    root: visualRoot,
    textarea: editor,
    toolbar: editorTextToolbar,
    visualTab: visualModeButton,
    docxTab: docxModeButton,
    docxPreview,
    examples,
    notify: showToast,
    beforeVisualMode: commitDocxDraftToSource,
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

  // Ao abrir a Biblioteca lateral durante a prévia DOCX, volta à estrutura
  // visual antes que o componente seja inserido.
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
    showToast("Componente inserido na estrutura. Você pode editá-lo livremente.");
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
    if (visualStructure?.getMode() === "docx") {
      visualStructure.setMode("visual");
      return;
    }
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
  lessonLoadButton?.addEventListener("click", openLessonDocx);
  lessonSaveButton?.addEventListener("click", saveLoadedLesson);
  lessonFileInput?.addEventListener("change", () => {
    const file = lessonFileInput.files?.[0];
    if (file) readLessonFile(file, null);
  });
  lessonTopicsElement?.addEventListener("click", event => {
    const button = event.target.closest("[data-lesson-topic-id]");
    if (button) loadLessonTopic(button.dataset.lessonTopicId);
  });
  window.addEventListener("beforeunload", event => {
    if (!hasUnsavedLessonChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  // Divisor entre estrutura e pré-visualização. Mantém a largura escolhida no navegador.
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

  // Controle independente para aumentar a altura conjunta da estrutura e da prévia.
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
    previewFrame.title = "Pré-visualização do conteúdo em Desktop";
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
    previewFrame.title = `Pré-visualização do conteúdo em ${PREVIEW_DEVICE_SIZES[largePreviewDeviceMode].label}`;
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
  if (isolatedPreviewEnabled) {
    // `allow-same-origin` só é seguro aqui porque a prévia vem de uma origem
    // diferente da página do editor (por exemplo, preview.localhost).
    previewFrame.setAttribute("sandbox", "allow-scripts allow-same-origin");
    previewFrame.src = previewFrameUrl;
  }
  renderScreenTabs();
  loadScreen("screen-1", true);
  window.requestAnimationFrame(restoreStructureWidth);
})();
