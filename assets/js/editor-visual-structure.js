/*
 * Estrutura visual do Editor de Componentes do Autômato.
 * Converte os marcadores dos componentes originais em blocos visuais editáveis
 * e serializa novamente para a sintaxe reconhecida pelo processador oficial.
 */
(() => {
  "use strict";

  const COLORS = {
    botoes: "purple", hotword: "blue", abas: "green", flashcard: "teal",
    opcoes: "blue", verdadeirofalso: "teal", forca: "green", jogomemoria: "amber", mininavegacao: "cyan", sanfona: "orange", ligapontos: "pink", relacionarcolunas: "pink", dividir: "cyan", video: "coral", arquivo: "purple", imagem: "indigo", destaque: "rust"
  };
  const LABELS = {
    botoes: "Botões", hotword: "Hotword", abas: "Abas", flashcard: "Flashcard",
    opcoes: "Opções", verdadeirofalso: "Verdadeiro ou Falso", forca: "Forca", jogomemoria: "Jogo da memória", mininavegacao: "Mini navegação", sanfona: "Sanfona", ligapontos: "Liga Pontos", relacionarcolunas: "Relacionar Colunas", dividir: "Dividir", video: "Vídeo", arquivo: "Arquivo", imagem: "Imagem", destaque: "Destaque"
  };
  const WRAPPER_TYPES = Object.keys(LABELS);
  const STRUCTURAL_MARKERS = {
    abas: ["aba", "janela"], flashcard: ["frente", "verso"],
    jogomemoria: ["frente", "carta1", "carta2", "feedback", "feedcerto", "feederrado"],
    mininavegacao: ["janela"], sanfona: ["botao", "janela"],
    ligapontos: ["opcao", "resposta", "feedcerto", "feederrado", "feederrao"],
    relacionarcolunas: ["modo", "opcao", "resposta", "feedcerto", "feederrado"],
    opcoes: ["alternativa", "correta", "feedcerto", "feederrado"],
    verdadeirofalso: ["alternativa", "correta", "feedcerto", "feederrado"],
    forca: ["palavra", "dica", "feedcerto", "feederrado"]
  };
  const MAX_HISTORY = 1000;

  function create(config) {
    const root = config.root;
    const textarea = config.textarea;
    const visualTab = config.visualTab;
    const docxTab = config.docxTab;
    const docxPreview = config.docxPreview || null;
    const examples = config.examples || {};
    const toolbar = config.toolbar || null;
    const beforeVisualMode = typeof config.beforeVisualMode === "function" ? config.beforeVisualMode : () => {};
    const onChange = typeof config.onChange === "function" ? config.onChange : () => {};
    const notify = typeof config.notify === "function" ? config.notify : () => {};
    if (!root || !textarea) return null;

    let mode = "visual";
    let lastRange = null;
    let history = [];
    let historyIndex = -1;
    let historyRestore = false;
    let inputFrame = 0;
    let libraryList = null;
    let selectedImage = null;
    let imageResizeOverlay = null;

    const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);

    function normalizeType(type) {
      return String(type || "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    }

    function findClosing(source, type, from) {
      const token = new RegExp(`<\\/?${type}\\b[^>]*>`, "ig");
      token.lastIndex = from;
      let depth = 1;
      let match;
      while ((match = token.exec(source))) {
        if (/^<\s*\//.test(match[0])) depth--;
        else depth++;
        if (depth === 0) return { start: match.index, end: token.lastIndex };
      }
      return null;
    }

    function findWrapper(source, from = 0) {
      const matcher = /<(dividir|botoes|hotword|abas|flashcard|opcoes|verdadeirofalso|forca|jogomemoria|mininavegacao|sanfona|ligapontos|relacionarcolunas|video|arquivo|imagem|destaque)\b[^>]*>|<componente\b([^>]*)>/ig;
      matcher.lastIndex = from;
      const match = matcher.exec(source);
      if (!match) return null;
      let type = (match[1] || "").toLowerCase();
      let universal = false;
      if (!type && match[2] !== undefined) {
        const tipo = match[2].match(/\btipo\s*=\s*["']([^"']+)["']/i);
        if (tipo) { type = normalizeType(tipo[1]); universal = true; }
      }
      if (!type) return findWrapper(source, matcher.lastIndex);
      if (type === "dividir") {
        const tail = source.slice(matcher.lastIndex);
        const closing = tail.match(/^(\s*)<\/dividir\s*>/i);
        const closeStart = matcher.lastIndex + (closing ? closing[1].length : 0);
        return {
          index: match.index, openEnd: matcher.lastIndex,
          closeStart, closeEnd: closing ? matcher.lastIndex + closing[0].length : matcher.lastIndex,
          type, universal: false, openTag: match[0]
        };
      }
      const closing = findClosing(source, universal ? "componente" : type, matcher.lastIndex);
      if (!closing) return findWrapper(source, matcher.lastIndex);
      return {
        index: match.index, openEnd: matcher.lastIndex,
        closeStart: closing.start, closeEnd: closing.end,
        type, universal, openTag: match[0]
      };
    }

    function createEmptyTextBlock(placeholder = "Continue digitando aqui...") {
      const block = document.createElement("div");
      block.className = "visual-text-block visual-empty-block";
      block.setAttribute("contenteditable", "true");
      block.dataset.placeholder = placeholder;
      block.appendChild(document.createElement("br"));
      return block;
    }

    function appendTextBlock(container, html) {
      if (!String(html || "").trim()) return;
      if (container.lastChild?.nodeType === Node.ELEMENT_NODE && container.lastChild.classList.contains("visual-empty-block")) {
        container.lastChild.remove();
      }
      const block = document.createElement("div");
      block.className = "visual-text-block";
      block.setAttribute("contenteditable", "true");
      block.innerHTML = html;
      container.appendChild(block);
    }

    function parseFlow(source) {
      const html = String(source || "");
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      let wrapper = findWrapper(html, 0);
      while (wrapper) {
        if (wrapper.index > cursor) appendTextBlock(fragment, html.slice(cursor, wrapper.index));
        const body = html.slice(wrapper.openEnd, wrapper.closeStart);
        fragment.appendChild(buildComponent(wrapper.type, body, wrapper.universal));
        fragment.appendChild(createEmptyTextBlock());
        cursor = wrapper.closeEnd;
        wrapper = findWrapper(html, cursor);
      }
      if (cursor < html.length) appendTextBlock(fragment, html.slice(cursor));
      return fragment;
    }

    function makeHeader(type, title, icon = "bi-box") {
      const header = document.createElement("div");
      header.className = "visual-component-header";
      header.setAttribute("draggable", "true");
      header.setAttribute("title", "Arraste para mudar a posição deste componente");
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "visual-component-toggle";
      toggle.dataset.visualAction = "toggle";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", `Expandir ${title}`);
      toggle.innerHTML = '<i class="bi bi-chevron-right" aria-hidden="true"></i>';

      // Atalho de edição/expansão: fica imediatamente ao lado da seta e
      // executa a mesma ação de abrir/recolher o cartão em qualquer componente.
      const editToggle = document.createElement("button");
      editToggle.type = "button";
      editToggle.className = "visual-component-pencil-toggle";
      editToggle.dataset.visualAction = "toggle-pencil";
      editToggle.setAttribute("aria-expanded", "false");
      editToggle.setAttribute("aria-label", `Expandir ${title}`);
      editToggle.setAttribute("title", `Expandir ${title}`);
      editToggle.innerHTML = '<i class="bi bi-pencil" aria-hidden="true"></i>';

      const iconNode = document.createElement("span");
      iconNode.className = "visual-component-icon";
      iconNode.innerHTML = `<i class="bi ${icon}" aria-hidden="true"></i>`;
      const name = document.createElement("strong");
      name.className = "visual-component-name";
      name.textContent = title;
      const badge = document.createElement("span");
      badge.className = "visual-component-badge";
      badge.textContent = "Componente";
      const spacer = document.createElement("span");
      spacer.className = "visual-component-header-spacer";
      const menu = document.createElement("span");
      menu.className = "visual-component-kind";
      menu.textContent = "Objeto";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "visual-component-remove";
      remove.dataset.visualAction = "request-delete";
      remove.setAttribute("aria-label", `Excluir ${title}`);
      remove.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
      const confirm = document.createElement("span");
      confirm.className = "visual-delete-confirm";
      confirm.hidden = true;
      confirm.innerHTML = '<span>Excluir?</span><button type="button" data-visual-action="confirm-delete">Sim</button><button type="button" data-visual-action="cancel-delete">Não</button>';
      header.append(toggle, editToggle, iconNode, name, badge, spacer, menu, remove, confirm);
      return header;
    }

    function makeSlot(label, html = "", extraClass = "") {
      const field = document.createElement("section");
      field.className = `visual-field ${extraClass}`.trim();
      if (label) {
        const labelNode = document.createElement("label");
        labelNode.className = "visual-field-label";
        labelNode.textContent = label;
        field.appendChild(labelNode);
      }
      const slot = document.createElement("div");
      slot.className = "visual-slot";
      if (extraClass.includes("visual-field--botao") || extraClass.includes("visual-field--janela")) {
        slot.classList.add("visual-slot--rich");
        slot.dataset.richContent = "true";
        slot.setAttribute("role", "textbox");
        slot.setAttribute("aria-multiline", "true");
      }
      slot.setAttribute("contenteditable", "true");
      slot.setAttribute("spellcheck", "true");
      const placeholders = {
        "Palavra ou expressão": "Digite aqui a palavra ou expressão...",
        "Janela de explicação": "Digite aqui o texto da janela...",
        "Título da aba": "Digite aqui o título da aba...",
        "Conteúdo da janela": "Digite aqui o conteúdo da janela...",
        "Frente": "Digite aqui o conteúdo da frente...",
        "Verso": "Digite aqui o conteúdo do verso...",
        "Texto do botão": "Digite aqui o nome do botão...",
        "Conteúdo do botão": "Digite aqui o nome do botão...",
        "Nome do botão": "Digite aqui o nome do botão...",
        "Texto da janela": "Digite aqui o texto da janela..."
      };
      slot.dataset.placeholder = placeholders[label] || (label ? `Digite aqui ${label.toLocaleLowerCase("pt-BR")}...` : "Digite o conteúdo aqui...");
      if (/^<p>Botão \d+<\/p>$/i.test(String(html || "").trim()) || /^<p>Digite aqui o texto da janela\.\.\.<\/p>$/i.test(String(html || "").trim())) slot.dataset.clearStarter = "true";
      slot.appendChild(parseFlow(html));
      if (!slot.childNodes.length) slot.appendChild(createEmptyTextBlock("Digite o conteúdo aqui..."));
      field.appendChild(slot);
      return field;
    }

    function createPartCard(marker, title, html, index) {
      const part = document.createElement("section");
      part.className = "visual-part-card";
      part.dataset.visualPart = marker;
      part.dataset.partIndex = String(index || 0);
      part.classList.add("is-collapsed");
      const head = document.createElement("button");
      head.type = "button";
      head.className = "visual-part-header";
      head.dataset.visualAction = "toggle-part";
      head.setAttribute("aria-expanded", "false");
      const icon = document.createElement("i");
      icon.className = "bi bi-chevron-right";
      const label = document.createElement("strong");
      label.textContent = title;
      head.append(icon, label);
      const fieldLabel = marker === "modo"
        ? "A, B, C ou 1, 2, 3"
        : marker === "botao" ? "Nome do botão" : marker === "janela" ? "Texto da janela" : title.replace(/\s+\d+$/, "");
      const slotField = makeSlot(fieldLabel, html, `visual-field--${marker}`);
      if (marker === "modo") {
        const slot = slotField.querySelector(":scope > .visual-slot");
        const normalizedMode = String(html || "")
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const selectedMode = normalizedMode.includes("numero") ? "numero" : "letra";
        slot.hidden = true;
        slot.classList.add("visual-mode-source");
        slot.setAttribute("contenteditable", "false");
        slot.replaceChildren(document.createTextNode(selectedMode));
        const select = document.createElement("select");
        select.className = "visual-mode-select";
        select.setAttribute("aria-label", "A, B, C ou 1, 2, 3");
        select.innerHTML = '<option value="letra">A, B, C</option><option value="numero">1, 2, 3</option>';
        select.value = selectedMode;
        select.addEventListener("change", () => {
          slot.replaceChildren(document.createTextNode(select.value));
          recordHistory();
          onChange();
        });
        slotField.appendChild(select);
      }
      part.append(head, slotField);
      if (marker === "botao") {
        const imageHint = document.createElement("div");
        imageHint.className = "visual-image-placeholder";
        imageHint.setAttribute("contenteditable", "false");
        imageHint.innerHTML = '<i class="bi bi-image" aria-hidden="true"></i><span>Imagem opcional — insira pela barra de ferramentas</span>';
        part.appendChild(imageHint);
      }
      return part;
    }

    function makeSetControls() {
      const controls = document.createElement("div");
      controls.className = "visual-set-controls";
      controls.innerHTML = '<button type="button" data-visual-action="move-set-up" title="Mover conjunto para cima" aria-label="Mover conjunto para cima"><i class="bi bi-arrow-up"></i></button><button type="button" data-visual-action="move-set-down" title="Mover conjunto para baixo" aria-label="Mover conjunto para baixo"><i class="bi bi-arrow-down"></i></button><button type="button" data-visual-action="clone-set" title="Clonar conjunto" aria-label="Clonar conjunto"><i class="bi bi-copy"></i></button><button type="button" data-visual-action="request-delete-set" title="Excluir conjunto" aria-label="Excluir conjunto"><i class="bi bi-trash"></i></button><span class="visual-set-delete-confirm" hidden>Excluir? <button type="button" data-visual-action="confirm-delete-set">Sim</button><button type="button" data-visual-action="cancel-delete-set">Não</button></span>';
      return controls;
    }

    function videoItemFromMarkup(item) {
      const row = document.createElement("section");
      row.className = "visual-structure-set visual-video-set";
      const caption = document.createElement("div");
      caption.className = "visual-pair-caption";
      caption.textContent = "Vídeo";
      row.appendChild(caption);

      const modeField = document.createElement("label");
      modeField.className = "visual-video-option";
      modeField.innerHTML = '<span>Exibição</span>';
      const mode = document.createElement("select");
      mode.className = "visual-video-mode-select form-select form-select-sm";
      mode.setAttribute("aria-label", "Forma de exibição do vídeo");
      mode.innerHTML = '<option value="direto">Player direto na tela</option><option value="modal">Botão que abre um modal</option>';
      mode.value = item.modo === "modal" ? "modal" : "direto";
      modeField.appendChild(mode);

      const originField = document.createElement("label");
      originField.className = "visual-video-option";
      originField.innerHTML = '<span>Origem do vídeo</span>';
      const origin = document.createElement("select");
      origin.className = "visual-video-origin-select form-select form-select-sm";
      origin.setAttribute("aria-label", "Origem do vídeo");
      origin.innerHTML = '<option value="arquivo">Arquivo já enviado ao curso</option><option value="youtube">Link do YouTube</option>';
      origin.value = item.origem === "youtube" ? "youtube" : "arquivo";
      originField.appendChild(origin);

      const options = document.createElement("div");
      options.className = "visual-video-options";
      options.append(modeField, originField);
      row.appendChild(options);

      const labelField = document.createElement("label");
      labelField.className = "visual-field visual-video-label-field";
      const labelTitle = document.createElement("span");
      labelTitle.className = "visual-field-label";
      labelTitle.textContent = "Texto do botão";
      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "visual-video-label-input form-control form-control-sm";
      labelInput.setAttribute("aria-label", "Texto do botão que abre o vídeo");
      labelInput.value = item.rotulo || "";
      labelInput.setAttribute("value", labelInput.value);
      labelField.append(labelTitle, labelInput);
      row.appendChild(labelField);

      const sourceField = makeSlot("Arquivo de vídeo ou link do YouTube", item.fonte || "", "visual-field--video-source");
      const sourceSlot = sourceField.querySelector(":scope > .visual-slot");
      sourceSlot.classList.add("visual-slot--rich");
      sourceSlot.dataset.richContent = "true";
      sourceSlot.setAttribute("role", "textbox");
      sourceSlot.setAttribute("aria-multiline", "true");
      row.appendChild(sourceField);
      row.appendChild(makeSetControls());

      const syncRow = () => {
        const modal = mode.value === "modal";
        labelField.hidden = !modal;
        labelInput.disabled = !modal;
        const sourceLabel = sourceField.querySelector(":scope > .visual-field-label");
        if (sourceLabel) sourceLabel.textContent = origin.value === "youtube" ? "Link do YouTube" : "Nome do arquivo enviado ao curso";
        sourceSlot.dataset.placeholder = origin.value === "youtube"
          ? "Cole aqui o link do YouTube..."
          : "Digite o nome do arquivo; ele será buscado na pasta arquivos/...";
        const emptySource = sourceSlot.querySelector(":scope > .visual-empty-block");
        if (emptySource) emptySource.dataset.placeholder = sourceSlot.dataset.placeholder;
        row.dataset.videoMode = mode.value;
        row.dataset.videoOrigin = origin.value;
      };
      const syncSelectAttribute = select => {
        [...select.options].forEach(option => option.toggleAttribute("selected", option.value === select.value));
      };
      mode.addEventListener("change", () => {
        syncSelectAttribute(mode);
        syncRow();
        recordHistory();
        onChange();
      });
      origin.addEventListener("change", () => {
        syncSelectAttribute(origin);
        syncRow();
        recordHistory();
        onChange();
      });
      syncSelectAttribute(mode);
      syncSelectAttribute(origin);
      syncRow();
      return row;
    }

    function buildImageBody(inner, component) {
      const body = component.querySelector(":scope > .visual-component-body");
      const template = document.createElement("template");
      template.innerHTML = String(inner || "");
      const item = template.content.querySelector("imagemitem");
      const title = item?.getAttribute("data-titulo") || "";
      const footer = item?.getAttribute("data-rodape") || "";
      const images = [...(item || template.content).querySelectorAll("img")]
        .map(image => image.outerHTML)
        .join("");

      const imageField = makeSlot("Imagem", images, "visual-field--image-source");
      const imageSlot = imageField.querySelector(":scope > .visual-slot");
      imageSlot.dataset.placeholder = "Insira ou cole uma imagem aqui...";
      const emptyImage = imageSlot.querySelector(":scope > .visual-empty-block");
      if (emptyImage) emptyImage.dataset.placeholder = imageSlot.dataset.placeholder;
      body.append(
        makeSlot("Título (opcional)", escapeHtml(title), "visual-field--image-title"),
        imageField,
        makeSlot("Rodapé (opcional)", escapeHtml(footer), "visual-field--image-footer")
      );
    }

    function buildDestaqueBody(inner, component) {
      const body = component.querySelector(":scope > .visual-component-body");
      const template = document.createElement("template");
      template.innerHTML = String(inner || "");
      const itens = [...template.content.querySelectorAll("destaqueitem")].map(item => ({
        titulo: item.querySelector("destaquetitulo")?.innerHTML || "",
        conteudo: item.querySelector("destaqueconteudo")?.innerHTML || ""
      }));
      const lista = document.createElement("div");
      lista.className = "visual-destaque-list";
      (itens.length ? itens : [{ titulo: "Atenção", conteudo: "" }]).forEach((item, index) => {
        const grupo = document.createElement("section");
        grupo.className = "visual-structure-set visual-destaque-set";
        grupo.dataset.setIndex = String(index + 1);
        const cabecalho = document.createElement("div");
        cabecalho.className = "visual-pair-caption";
        cabecalho.textContent = `Destaque ${index + 1}`;
        grupo.append(
          cabecalho,
          createPartCard("destaquetitulo", "Título", item.titulo, index + 1),
          createPartCard("destaqueconteudo", "Texto ou imagem", item.conteudo, index + 1),
          makeSetControls()
        );
        lista.appendChild(grupo);
      });
      const adicionar = document.createElement("button");
      adicionar.type = "button";
      adicionar.className = "visual-add-structure-set";
      adicionar.dataset.visualAction = "add-destaque-item";
      adicionar.innerHTML = '<i class="bi bi-plus-circle" aria-hidden="true"></i><span>Adicionar destaque</span>';
      lista.appendChild(adicionar);
      body.appendChild(lista);
    }

    function buildVideoBody(inner, component) {
      const body = component.querySelector(":scope > .visual-component-body");
      const template = document.createElement("template");
      template.innerHTML = String(inner || "");
      const items = [...template.content.querySelectorAll("videoitem")].map(item => ({
        modo: item.getAttribute("data-modo"),
        origem: item.getAttribute("data-origem"),
        rotulo: item.getAttribute("data-rotulo"),
        fonte: item.innerHTML
      }));
      if (!items.length && String(inner || "").trim()) items.push({ modo: "direto", origem: "arquivo", fonte: inner });
      if (!items.length) items.push({ modo: "modal", origem: "arquivo", rotulo: "Assistir vídeo", fonte: "" });
      items.forEach(item => body.appendChild(videoItemFromMarkup(item)));

      const add = document.createElement("button");
      add.type = "button";
      add.className = "visual-add-structure-set";
      add.dataset.visualAction = "add-video-item";
      add.innerHTML = '<i class="bi bi-plus-circle" aria-hidden="true"></i><span>Adicionar vídeo</span>';
      body.appendChild(add);
    }

    function arquivoItemFromMarkup(item) {
      const row = document.createElement("section");
      row.className = "visual-structure-set visual-arquivo-set";
      const caption = document.createElement("div");
      caption.className = "visual-pair-caption";
      caption.textContent = "Arquivo";
      row.appendChild(caption);

      const labelField = document.createElement("label");
      labelField.className = "visual-field visual-arquivo-label-field";
      const labelTitle = document.createElement("span");
      labelTitle.className = "visual-field-label";
      labelTitle.textContent = "Texto do botão";
      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.className = "visual-arquivo-label-input form-control form-control-sm";
      labelInput.setAttribute("aria-label", "Texto do botão do arquivo");
      labelInput.value = item.rotulo || "";
      labelInput.setAttribute("value", labelInput.value);
      labelField.append(labelTitle, labelInput);
      row.appendChild(labelField);

      row.appendChild(makeSlot("Nome do arquivo enviado para a pasta arquivos", item.fonte || "", "visual-field--arquivo-name"));
      row.appendChild(makeSetControls());
      return row;
    }

    function buildArquivoBody(inner, component) {
      const body = component.querySelector(":scope > .visual-component-body");
      const template = document.createElement("template");
      template.innerHTML = String(inner || "");
      const items = [...template.content.querySelectorAll("arquivoitem")].map(item => ({
        rotulo: item.getAttribute("data-rotulo") || "",
        fonte: item.innerHTML
      }));
      if (!items.length && String(inner || "").trim()) items.push({ rotulo: "", fonte: inner });
      if (!items.length) items.push({ rotulo: "", fonte: "" });
      items.forEach(item => body.appendChild(arquivoItemFromMarkup(item)));

      const add = document.createElement("button");
      add.type = "button";
      add.className = "visual-add-structure-set";
      add.dataset.visualAction = "add-arquivo-item";
      add.innerHTML = '<i class="bi bi-plus-circle" aria-hidden="true"></i><span>Adicionar arquivo</span>';
      body.appendChild(add);
    }

    function renumberSets(component) {
      const type = component.dataset.visualComponent;
      const body = component.querySelector(":scope > .visual-component-body");
      if (!body) return;
      if (type === "botoes" || type === "sanfona") {
        const pairs = [...body.querySelectorAll(":scope > .visual-pairs-list > .visual-button-window-pair")];
        pairs.forEach((pair, index) => {
          const number = index + 1;
          pair.dataset.pairIndex = String(number);
          const caption = pair.querySelector(":scope > .visual-pair-caption");
          if (caption) caption.innerHTML = `<span>Conjunto ${number}</span><span>Botão + Janela</span>`;
          pair.querySelectorAll(":scope > .visual-part-card").forEach(part => {
            const marker = part.dataset.visualPart;
            const label = part.querySelector(":scope > .visual-part-header strong");
            if (label) label.textContent = `${marker === "botao" ? "Botão" : "Janela"} ${number}`;
            part.dataset.partIndex = String(number);
          });
        });
      } else {
        const groups = [...body.querySelectorAll(":scope > .visual-structure-set:not([data-set-fixed='true'])")];
        groups.forEach((group, index) => {
          const number = index + 1;
          group.dataset.setIndex = String(number);
          const heading = group.querySelector(":scope > .visual-pair-caption");
          if (heading) heading.textContent = type === "mininavegacao" ? `Janela ${number}` : type === "video" ? `Vídeo ${number}` : type === "arquivo" ? `Arquivo ${number}` : `Conjunto ${number}`;
          group.querySelectorAll(":scope > .visual-part-card").forEach(part => {
            const marker = part.dataset.visualPart;
            const labels = { aba: "Título da aba", janela: "Conteúdo da janela", frente: "Frente", verso: "Verso", carta1: "Carta 1", carta2: "Carta 2", feedback: "Feedback", opcao: "Opção", resposta: "Resposta", alternativa: type === "verdadeirofalso" ? "Frase" : "Alternativa", correta: type === "verdadeirofalso" ? "Resposta esperada" : "Correta? (SIM/NÃO)" };
            const label = part.querySelector(":scope > .visual-part-header strong");
            if (label && marker !== "feedcerto" && marker !== "feederrado") label.textContent = `${labels[marker] || marker} ${number}`;
            part.dataset.partIndex = String(number);
          });
        });
      }
    }

    function scanMarkerSections(source, markers) {
      return findTopLevelMarkers(source, markers).map((marker, index, all) => ({
        marker: marker.marker === "feederrao" ? "feederrado" : marker.marker,
        // Preserva fechamentos de componentes que estejam dentro da janela.
        // parseFlow precisa deles para reconstruir os componentes filhos.
        content: source.slice(marker.end, all[index + 1]?.index ?? source.length)
      }));
    }

    function findTopLevelMarkers(source, markers) {
      const nestedRanges = [];
      const wrapperRegex = /<(botoes|hotword|abas|flashcard|opcoes|verdadeirofalso|forca|jogomemoria|mininavegacao|sanfona|ligapontos|relacionarcolunas)\b[^>]*>|<componente\b[^>]*>/gi;
      let wrapper;
      while ((wrapper = wrapperRegex.exec(source))) {
        const tipoWrapper = /^<componente\b/i.test(wrapper[0]) ? "componente" : wrapper[1].toLowerCase();
        const closing = findClosing(source, tipoWrapper, wrapperRegex.lastIndex);
        if (closing) nestedRanges.push({ start: wrapper.index, end: closing.end });
      }
      const regex = new RegExp(`<(${markers.join("|")})\\s*>`, "gi");
      const found = [];
      let match;
      while ((match = regex.exec(source))) {
        const insideNestedComponent = nestedRanges.some(range =>
          match.index > range.start && match.index < range.end &&
          source.slice(range.start, match.index).match(/<(?:botoes|hotword|abas|flashcard|opcoes|verdadeirofalso|forca|jogomemoria|mininavegacao|sanfona|ligapontos|relacionarcolunas|componente)\b[^>]*>/i)
        );
        // A própria estrutura externa é removida antes desta função ser chamada.
        // Portanto, marcadores dentro de outros componentes aninhados não viram
        // separadores do componente-pai.
        if (!insideNestedComponent) found.push({ marker: match[1].toLowerCase() === "feederrao" ? "feederrado" : match[1].toLowerCase(), index: match.index, end: regex.lastIndex, token: match[0] });
      }
      return found;
    }

    function buildButtonsBody(body, component) {
      const markers = findTopLevelMarkers(body, ["botao", "janela"]);
      const bodyArea = component.querySelector(":scope > .visual-component-body");
      const preamble = markers.length ? body.slice(0, markers[0].index) : body;
      if (preamble.trim()) bodyArea.appendChild(makeSlot("Texto antes dos botões", preamble, "visual-field--preamble"));
      const pairs = document.createElement("div");
      pairs.className = "visual-pairs-list";
      let pairIndex = 0;
      let pending = null;

      const createPair = () => {
        pairIndex++;
        const pair = document.createElement("div");
        pair.className = "visual-button-window-pair";
        pair.dataset.pairIndex = String(pairIndex);
        const caption = document.createElement("div");
        caption.className = "visual-pair-caption";
        caption.innerHTML = `<span>Conjunto ${pairIndex}</span><span>Botão + Janela</span>`;
        pair.appendChild(caption);
        pairs.appendChild(pair);
        return pair;
      };

      const finalizeWindow = (end) => {
        if (!pending || pending.windowStart == null) return;
        const windowHtml = body.slice(pending.windowStart, end)
          .replace(/<\/botoes\s*>/gi, "")
          .trim();
        pending.pair.appendChild(createPartCard("janela", `Janela ${pending.index}`, windowHtml || "<p>Digite aqui o texto da janela...</p>", pending.index));
        pending = null;
      };

      markers.forEach((marker, index) => {
        if (marker.marker === "botao") {
          if (pending) finalizeWindow(marker.index);
          pending = { pair: createPair(), index: pairIndex, buttonStart: marker.end, windowStart: null };
        } else if (marker.marker === "janela") {
          if (!pending) pending = { pair: createPair(), index: pairIndex, buttonStart: null, windowStart: null };
          if (pending.buttonStart != null) {
            const buttonHtml = body.slice(pending.buttonStart, marker.index).trim();
            pending.pair.appendChild(createPartCard("botao", `Botão ${pending.index}`, buttonHtml || `<p>Botão ${pending.index}</p>`, pending.index));
          }
          pending.windowStart = marker.end;
        }
      });
      if (pending) {
        if (pending.buttonStart != null && pending.windowStart == null) {
          const buttonHtml = body.slice(pending.buttonStart).replace(/<\/botoes\s*>/gi, "").trim();
          pending.pair.appendChild(createPartCard("botao", `Botão ${pending.index}`, buttonHtml || `<p>Botão ${pending.index}</p>`, pending.index));
          pending.pair.appendChild(createPartCard("janela", `Janela ${pending.index}`, "<p>Digite aqui o texto da janela...</p>", pending.index));
        } else {
          finalizeWindow(body.length);
        }
      }
      if (!pairIndex) {
        const pair = createPair();
        pair.append(createPartCard("botao", "Botão 1", "<p>Botão 1</p>", 1), createPartCard("janela", "Janela 1", "<p>Digite aqui o texto da janela...</p>", 1));
      }
      pairs.querySelectorAll(":scope > .visual-button-window-pair").forEach(pair => {
        if (!pair.querySelector(":scope > .visual-set-controls")) pair.appendChild(makeSetControls());
      });
      pairs.appendChild(makeAddPairButton());
      bodyArea.appendChild(pairs);
    }

    function makeAddPairButton() {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "visual-add-pair";
      button.dataset.visualAction = "add-pair";
      button.innerHTML = '<i class="bi bi-plus-circle" aria-hidden="true"></i><span>Adicionar Botão e Janela</span>';
      return button;
    }

    function buildComponent(type, inner = "", universal = false) {
      const sourceType = normalizeType(type);
      const slug = sourceType === "botao" ? "botoes" : sourceType;
      const label = LABELS[slug] || (universal ? String(type) : type);
      const component = document.createElement("article");
      component.className = `visual-component visual-component--${COLORS[slug] || "neutral"}`;
      component.dataset.visualComponent = slug;
      component.dataset.sourceType = universal ? sourceType : slug;
      component.dataset.wrapperTag = universal ? "componente" : slug;
      component.setAttribute("contenteditable", "false");
      component.classList.add("is-collapsed");
      component.appendChild(makeHeader(slug, label, ({
        botoes: "bi-ui-checks-grid", hotword: "bi-highlighter", abas: "bi-layout-three-columns",
        flashcard: "bi-card-text", jogomemoria: "bi-grid-3x3-gap", mininavegacao: "bi-signpost-split",
        sanfona: "bi-list-nested", ligapontos: "bi-diagram-3", relacionarcolunas: "bi-arrow-left-right", opcoes: "bi-ui-radios", verdadeirofalso: "bi-input-cursor-text", forca: "bi-alphabet-uppercase", dividir: "bi-layout-split", video: "bi-camera-video", arquivo: "bi-file-earmark-arrow-down", imagem: "bi-image", destaque: "bi-megaphone"
      })[slug] || "bi-box"));
      const body = document.createElement("div");
      body.className = "visual-component-body";
      component.appendChild(body);

      if (slug === "dividir") {
        const note = document.createElement("div");
        note.className = "visual-dividir-note";
        note.innerHTML = '<i class="bi bi-layout-split" aria-hidden="true"></i><span>O conteúdo antes fica à esquerda; o que vem depois fica à direita.</span>';
        body.appendChild(note);
      } else if (slug === "video") {
        buildVideoBody(inner, component);
      } else if (slug === "arquivo") {
        buildArquivoBody(inner, component);
      } else if (slug === "imagem") {
        buildImageBody(inner, component);
      } else if (slug === "destaque") {
        buildDestaqueBody(inner, component);
      } else if (slug === "botoes" || slug === "sanfona") {
        component.dataset.visualComponent = slug;
        buildButtonsBody(inner, component);
      } else if (slug === "hotword") {
        const windowMarker = findTopLevelMarkers(inner, ["janela"])[0];
        let baseText = "";
        let term = "";
        if (universal) {
          const trigger = inner.match(/<hotword\s*>([\s\S]*?)<\/hotword\s*>/i) || inner.match(/<hotword\s*>([\s\S]*?)(?=<janela\s*>)/i);
          baseText = trigger ? inner.slice(0, trigger.index).trim() : "";
          term = trigger ? trigger[1].trim() : "";
        } else {
          // No formato legado de Hotword, a abertura <hotword> é o próprio
          // início do componente; o texto-base fica imediatamente antes dele.
          term = windowMarker ? inner.slice(0, windowMarker.index).trim() : inner.trim();
        }
        const explanation = windowMarker ? inner.slice(windowMarker.end).replace(/<\/hotword\s*>/gi, "").trim() : "";
        body.append(makeSlot("Texto onde a palavra aparece", baseText, "visual-field--hotword-context"));
        body.append(makeSlot("Palavra ou expressão", term, "visual-field--hotword-term"));
        body.append(makeSlot("Janela de explicação", explanation, "visual-field--hotword-window"));
      } else if (STRUCTURAL_MARKERS[slug]) {
        const structureSource = slug === "opcoes"
          ? inner.replace(/<pergunta\s*>[\s\S]*?<\/pergunta\s*>/gi, "")
          : inner;
        const markers = findTopLevelMarkers(structureSource, STRUCTURAL_MARKERS[slug]);
        const sections = scanMarkerSections(structureSource, STRUCTURAL_MARKERS[slug]);
        const preamble = markers.length ? structureSource.slice(0, markers[0].index) : structureSource;
        if (preamble.trim()) body.appendChild(makeSlot("Texto introdutório", preamble, "visual-field--preamble"));
        const partTitles = { aba: "Título da aba", janela: "Conteúdo da janela", frente: "Frente", verso: "Verso", carta1: "Carta 1", carta2: "Carta 2", modo: "Padrão de identificação", opcao: "Opção", resposta: "Resposta", feedback: "Feedback", feedcerto: "Feedback correto", feederrado: "Feedback de erro", palavra: "Palavra secreta", dica: "Dica", botao: "Título do painel", alternativa: slug === "verdadeirofalso" ? "Frase" : "Alternativa", correta: slug === "verdadeirofalso" ? "Resposta esperada" : "Correta? (SIM/NÃO)" };
        const addGroup = (title, entries, index, allowControls = true) => {
          const group = document.createElement("section");
          group.className = "visual-structure-set";
          group.dataset.setIndex = String(index);
          const heading = document.createElement("div");
          heading.className = "visual-pair-caption";
          heading.textContent = title;
          group.appendChild(heading);
          entries.forEach(section => {
            const markerIndex = section.index || index;
            const title = slug === "forca"
              ? (partTitles[section.marker] || section.marker)
              : section.marker === "modo"
              ? partTitles.modo
              : `${partTitles[section.marker] || section.marker} ${markerIndex}`;
            group.appendChild(createPartCard(section.marker, title, section.content, markerIndex));
          });
          if (allowControls) group.appendChild(makeSetControls());
          else group.dataset.setFixed = "true";
          body.appendChild(group);
        };
        const grouped = [];
        if (slug === "abas" || slug === "flashcard") {
          const first = slug === "abas" ? "aba" : "frente";
          const second = slug === "abas" ? "janela" : "verso";
          for (let i = 0; i < sections.length; i += 2) {
            const entries = sections.slice(i, i + 2);
            if (entries.length) grouped.push({ title: `Conjunto ${grouped.length + 1}`, entries });
          }
          grouped.forEach((group, index) => addGroup(group.title, group.entries, index + 1));
        } else if (slug === "jogomemoria") {
          let remaining = [...sections];
          const commonFace = remaining[0]?.marker === "frente" ? remaining.shift() : null;
          if (commonFace) body.appendChild(createPartCard("frente", "Frente comum", commonFace.content, 1));
          for (let i = 0; i < remaining.length; i += 3) {
            const entries = remaining.slice(i, i + 3);
            if (entries.length) addGroup(`Conjunto ${grouped.length + 1}`, entries, grouped.length + 1);
            grouped.push(entries);
          }
        } else if (slug === "mininavegacao") {
          sections.forEach((section, index) => addGroup(`Janela ${index + 1}`, [section], index + 1));
        } else if (slug === "ligapontos") {
          let pairs = [];
          let pair = [];
          const feedbacks = [];
          sections.forEach(section => {
            if (section.marker === "opcao") {
              if (pair.length) pairs.push(pair);
              pair = [section];
            } else if (section.marker === "resposta") {
              pair.push(section); pairs.push(pair); pair = [];
            } else feedbacks.push(section);
          });
          if (pair.length) pairs.push(pair);
          pairs.forEach((entries, index) => addGroup(`Conjunto ${index + 1}`, entries, index + 1));
          if (sections.length) {
            if (!feedbacks.some(item => item.marker === "feedcerto")) feedbacks.push({ marker: "feedcerto", content: "" });
            if (!feedbacks.some(item => item.marker === "feederrado")) feedbacks.push({ marker: "feederrado", content: "" });
          }
          if (feedbacks.length) addGroup("Feedbacks da atividade", feedbacks, 1, false);
        } else if (slug === "relacionarcolunas") {
          const modo = sections.find(section => section.marker === "modo");
          body.appendChild(createPartCard("modo", partTitles.modo, modo?.content || "letra", 1));
          let par = [];
          let numeroPar = 0;
          const feedbacks = [];
          sections.filter(section => section.marker !== "modo").forEach(section => {
            if (section.marker === "opcao") {
              if (par.length) {
                numeroPar += 1;
                addGroup(`Par ${numeroPar}`, par, numeroPar);
              }
              par = [section];
            } else if (section.marker === "resposta") {
              par.push(section);
              numeroPar += 1;
              addGroup(`Par ${numeroPar}`, par, numeroPar);
              par = [];
            } else {
              feedbacks.push(section);
            }
          });
          if (par.length) {
            numeroPar += 1;
            addGroup(`Par ${numeroPar}`, par, numeroPar);
          }
          if (sections.length) {
            if (!feedbacks.some(item => item.marker === "feedcerto")) feedbacks.push({ marker: "feedcerto", content: "" });
            if (!feedbacks.some(item => item.marker === "feederrado")) feedbacks.push({ marker: "feederrado", content: "" });
          }
          if (feedbacks.length) addGroup("Feedbacks da atividade", feedbacks, 1, false);
        } else if (slug === "opcoes") {
          let par = [];
          let numeroAlternativa = 0;
          const feedbacks = [];
          sections.forEach(section => {
            if (section.marker === "alternativa") {
              if (par.length) {
                numeroAlternativa++;
                addGroup(`Alternativa ${numeroAlternativa}`, par, numeroAlternativa);
              }
              par = [section];
            } else if (section.marker === "correta") {
              par.push(section);
              numeroAlternativa++;
              addGroup(`Alternativa ${numeroAlternativa}`, par, numeroAlternativa);
              par = [];
            } else if (section.marker === "feedcerto" || section.marker === "feederrado") feedbacks.push(section);
          });
          if (par.length) {
            numeroAlternativa++;
            addGroup(`Alternativa ${numeroAlternativa}`, par, numeroAlternativa);
          }
          if (sections.length) {
            if (!feedbacks.some(item => item.marker === "feedcerto")) feedbacks.push({ marker: "feedcerto", content: "" });
            if (!feedbacks.some(item => item.marker === "feederrado")) feedbacks.push({ marker: "feederrado", content: "" });
          }
          if (feedbacks.length) addGroup("Feedbacks da atividade", feedbacks, 1, false);
        } else if (slug === "verdadeirofalso") {
          let par = [];
          const feedbacks = [];
          let numeroFrase = 0;
          sections.forEach(section => {
            if (section.marker === "alternativa") {
              if (par.length) {
                numeroFrase++;
                addGroup(`Frase ${numeroFrase}`, par, numeroFrase);
              }
              par = [section];
            } else if (section.marker === "correta") {
              par.push(section);
              numeroFrase++;
              addGroup(`Frase ${numeroFrase}`, par, numeroFrase);
              par = [];
            } else if (section.marker === "feedcerto" || section.marker === "feederrado") {
              feedbacks.push(section);
            }
          });
          if (par.length) {
            numeroFrase++;
            addGroup(`Frase ${numeroFrase}`, par, numeroFrase);
          }
          if (sections.length) {
            if (!feedbacks.some(item => item.marker === "feedcerto")) feedbacks.push({ marker: "feedcerto", content: "" });
            if (!feedbacks.some(item => item.marker === "feederrado")) feedbacks.push({ marker: "feederrado", content: "" });
          }
          if (feedbacks.length) addGroup("Feedbacks da atividade", feedbacks, 1, false);
        } else if (slug === "forca" && sections.length) {
          const campos = ["palavra", "dica"].map(marker =>
            sections.find(section => section.marker === marker) || { marker, content: "" }
          );
          const feedbacks = ["feedcerto", "feederrado"].map(marker =>
            sections.find(section => section.marker === marker) || { marker, content: "" }
          );
          addGroup("Palavra e dica", campos, 1, false);
          addGroup("Feedbacks da atividade", feedbacks, 1, false);
        }
        if (!sections.length) {
          const defaults = {
            abas: [["aba", ""], ["janela", ""]],
            flashcard: [["frente", ""], ["verso", ""]],
            jogomemoria: [["frente", ""], ["carta1", ""], ["carta2", ""], ["feedback", ""]],
            mininavegacao: [["janela", ""], ["janela", ""]],
            ligapontos: [["opcao", ""], ["resposta", ""], ["feedcerto", ""], ["feederrado", ""]],
            relacionarcolunas: [["modo", "letra"], ["opcao", ""], ["resposta", ""], ["feedcerto", ""], ["feederrado", ""]],
            opcoes: [["alternativa", ""], ["correta", "SIM"], ["alternativa", ""], ["correta", "NÃO"], ["feedcerto", ""], ["feederrado", ""]],
            verdadeirofalso: [["alternativa", ""], ["correta", ""], ["feedcerto", ""], ["feederrado", ""]],
            forca: [["palavra", ""], ["dica", ""], ["feedcerto", ""], ["feederrado", ""]]
          };
          const items = defaults[slug] || [];
          if (slug === "jogomemoria") {
            body.appendChild(createPartCard("frente", "Frente comum", "", 1));
            addGroup("Conjunto 1", items.slice(1).map(([marker, content]) => ({ marker, content })), 1);
          } else if (slug === "abas" || slug === "flashcard") {
            addGroup("Conjunto 1", items.map(([marker, content]) => ({ marker, content })), 1);
          } else if (slug === "mininavegacao") {
            items.forEach(([marker, content], index) => addGroup(`Janela ${index + 1}`, [{ marker, content }], index + 1));
          } else if (slug === "ligapontos") {
            addGroup("Conjunto 1", items.slice(0, 2).map(([marker, content]) => ({ marker, content })), 1);
            addGroup("Feedbacks da atividade", items.slice(2).map(([marker, content]) => ({ marker, content })), 1, false);
          } else if (slug === "relacionarcolunas") {
            body.appendChild(createPartCard("modo", partTitles.modo, items[0][1], 1));
            addGroup("Par 1", items.slice(1, 3).map(([marker, content]) => ({ marker, content })), 1);
            addGroup("Feedbacks da atividade", items.slice(3).map(([marker, content]) => ({ marker, content })), 1, false);
          } else if (slug === "opcoes") {
            addGroup("Alternativa 1", items.slice(0, 2).map(([marker, content]) => ({ marker, content })), 1);
            addGroup("Alternativa 2", items.slice(2, 4).map(([marker, content]) => ({ marker, content })), 2);
            addGroup("Feedbacks da atividade", items.slice(4).map(([marker, content]) => ({ marker, content })), 1, false);
          } else if (slug === "verdadeirofalso") {
            addGroup("Frase 1", items.slice(0, 2).map(([marker, content]) => ({ marker, content })), 1);
            addGroup("Feedbacks da atividade", items.slice(2).map(([marker, content]) => ({ marker, content })), 1, false);
          } else if (slug === "forca") {
            addGroup("Palavra e dica", items.slice(0, 2).map(([marker, content]) => ({ marker, content })), 1, false);
            addGroup("Feedbacks da atividade", items.slice(2).map(([marker, content]) => ({ marker, content })), 1, false);
          }
        }
        if (slug !== "forca") {
          const addSet = document.createElement("button");
          addSet.type = "button";
          addSet.className = "visual-add-structure-set";
          addSet.dataset.visualAction = "add-structure-set";
          addSet.dataset.setType = slug;
          addSet.innerHTML = '<i class="bi bi-plus-circle" aria-hidden="true"></i><span>' + ({ abas: "Adicionar aba e janela", flashcard: "Adicionar conjunto de cartas", jogomemoria: "Adicionar par de cartas", mininavegacao: "Adicionar janela", ligapontos: "Adicionar opção e resposta", relacionarcolunas: "Adicionar par", opcoes: "Adicionar alternativa", verdadeirofalso: "Adicionar frase" }[slug] || "Adicionar conjunto") + '</span>';
          body.appendChild(addSet);
        }
      } else {
        body.appendChild(makeSlot("Conteúdo", inner));
      }
      return component;
    }

    function buildFromSource(source) {
      root.replaceChildren(parseFlow(source));
      ensureRootCaretBlock();
      ensureRootTextGaps();
      resetHistory();
    }

    function ensureRootCaretBlock() {
      if (!root.childNodes.length) {
        root.appendChild(createEmptyTextBlock("Digite seu texto aqui ou arraste um componente da Biblioteca..."));
      }
      refreshEmptyState();
    }

    function refreshEmptyState() {
      root.querySelectorAll(".visual-empty-block").forEach(block => {
        const hasContent = (block.textContent || "").trim() || block.querySelector("img, .visual-component");
        if (hasContent) block.classList.remove("visual-empty-block");
      });
      const hasComponent = Boolean(root.querySelector(".visual-component"));
      const hasText = [...root.querySelectorAll(".visual-text-block, .visual-slot")]
        .some(block => (block.textContent || "").trim() || block.querySelector("img"));
      if (!hasComponent && !hasText) {
        let blank = root.querySelector(":scope > .visual-text-block");
        if (!blank) {
          blank = createEmptyTextBlock("Digite seu texto aqui ou arraste um componente da Biblioteca...");
          root.appendChild(blank);
        }
        blank.classList.add("visual-empty-block");
        blank.dataset.placeholder ||= "Digite seu texto aqui ou arraste um componente da Biblioteca...";
      }
      root.classList.toggle("is-empty", !hasComponent && !hasText);
    }

    // Identificadores de origem usados pelo Modo Inspecionar.
    // São atribuídos aos próprios nós do editor durante a serialização e
    // acompanham o HTML até a prévia, sem depender do tipo do componente.
    let serializationInspectIds = null;
    let serializationInspectSequence = 0;

    function inspectOriginId(node) {
      if (!serializationInspectIds) serializationInspectIds = new Set();
      let id = node.getAttribute?.("data-automato-inspect-id") || "";
      if (!id || serializationInspectIds.has(id)) {
        id = `automato-origin-${++serializationInspectSequence}`;
        node.setAttribute?.("data-automato-inspect-id", id);
      }
      serializationInspectIds.add(id);
      return id;
    }

    function wrapInspectOrigin(node, content) {
      const id = inspectOriginId(node);
      return `<div data-automato-inspect-id="${escapeHtml(id)}" style="display:contents">${content}</div>`;
    }

    function serializeChildren(container) {
      const output = [];
      for (const node of [...container.childNodes]) {
        const serialized = serializeNode(node);
        if (serialized !== "") output.push(serialized);
      }
      return output.join("");
    }

    function serializeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue || "");
      if (node.nodeType !== Node.ELEMENT_NODE) return "";
      if (node.matches(".visual-image-resize-overlay")) return "";
      if (node.matches(".visual-component")) {
        const serialized = serializeComponent(node);
        return node.dataset.visualComponent === "dividir" ? serialized : wrapInspectOrigin(node, serialized);
      }
      // Blocos vazios são pontos de inserção exclusivos do Editor.
      // Não fazem parte do conteúdo publicado nem geram parágrafos vazios.
      if (node.matches(".visual-empty-block")) return "";
      if (node.matches(".visual-text-block")) {
        const id = inspectOriginId(node);
        const content = serializeChildren(node);
        const hasBlockChild = [...node.children].some(child =>
          child.matches(".visual-component, div, p, ul, ol, table, blockquote")
        );
        // A TELA organiza texto e imagens a partir dos elementos que recebe
        // no nível raiz. Não envolver o bloco inteiro em uma DIV: isso faria
        // o processador enxergar texto + imagem como um único bloco e
        // impediria a divisão original em .conteudo-item independentes.
        // Quando o bloco contém somente texto/elementos inline, o próprio P
        // que já era gerado recebe a identidade do bloco editável. Assim, até
        // texto digitado diretamente (um nó de texto sem tag) é inspecionável.
        if (!hasBlockChild) {
          return content
            ? `<p data-automato-inspect-id="${escapeHtml(id)}">${content}</p>`
            : content;
        }

        // Se o usuário misturar texto digitado diretamente com blocos HTML
        // (por exemplo, colar conteúdo e continuar digitando antes/depois),
        // nós de texto puros também precisam de um alvo no HTML da prévia.
        // SPAN é inline e não altera a distribuição de blocos da TELA. O ID
        // aponta para o bloco editável original, não para um novo componente.
        return [...node.childNodes].map(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            const texto = child.nodeValue || "";
            if (!texto) return "";
            return `<span data-automato-inspect-id="${escapeHtml(id)}">${escapeHtml(texto)}</span>`;
          }
          return serializeNode(child);
        }).join("");
      }
      if (node.matches(".visual-slot")) return wrapInspectOrigin(node, serializeChildren(node));
      if (node.matches(".visual-part-card")) return serializePart(node);
      if (node.matches(".visual-button-window-pair")) {
        return [...node.querySelectorAll(":scope > .visual-part-card")].map(serializePart).join("");
      }
      if (node.matches(".visual-field")) {
        const slot = node.querySelector(":scope > .visual-slot");
        return slot ? wrapInspectOrigin(slot, serializeChildren(slot)) : "";
      }
      if (node.matches(".visual-component-body, .visual-pairs-list")) return serializeChildren(node);
      if (node.matches(".visual-field-label, .visual-pair-caption, .visual-component-header, .visual-part-header, .visual-add-pair, .visual-add-structure-set, .visual-component-toggle, .visual-set-controls, .visual-image-placeholder, .visual-set-delete-confirm")) return "";
      const tag = node.tagName.toLowerCase();
      if (["script", "style", "button", "input", "textarea", "select"].includes(tag)) return "";
      if (tag === "br") return "<br>";
      const allowed = new Set(["p", "div", "span", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "a", "h1", "h2", "h3", "h4", "blockquote", "table", "thead", "tbody", "tr", "th", "td", "img", "picture", "figure", "figcaption", "iframe", "video", "audio", "source", "pre", "code", "sub", "sup", "mark", "small", "hr", "arquivoitem"]);
      if (!allowed.has(tag)) return serializeChildren(node);
      const attrs = [];
      const sourceOriginId = inspectOriginId(node);
      for (const attribute of [...node.attributes]) {
        const name = attribute.name.toLowerCase();
        if (name.startsWith("on") || name === "contenteditable" || name.startsWith("data-visual-") || name.startsWith("data-editor-")) continue;
        const atributoPadrao = ["id", "src", "alt", "title", "width", "height", "href", "target", "rel", "class", "style", "controls", "autoplay", "loop", "muted", "playsinline", "preload", "poster", "type", "colspan", "rowspan", "scope", "loading", "role", "draggable", "open"].includes(name);
        if (!atributoPadrao && !name.startsWith("data-") && !name.startsWith("aria-")) continue;
        attrs.push(`${name}="${escapeHtml(attribute.value)}"`);
      }
      if (!attrs.some(attribute => attribute.startsWith("data-automato-inspect-id="))) {
        attrs.push(`data-automato-inspect-id="${escapeHtml(sourceOriginId)}"`);
      }
      if (["img", "source"].includes(tag)) return `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}>`;
      return `<${tag}${attrs.length ? ` ${attrs.join(" ")}` : ""}>${serializeChildren(node)}</${tag}>`;
    }

    function serializePart(part) {
      const marker = normalizeType(part.dataset.visualPart);
      const slot = part.querySelector(":scope > .visual-field > .visual-slot");
      return `<${marker}>${wrapInspectOrigin(part, slot ? serializeChildren(slot) : "")}`;
    }

    function serializeComponent(component) {
      const type = normalizeType(component.dataset.visualComponent);
      if (type === "dividir") return "<dividir>";
      const wrapper = component.dataset.wrapperTag || type;
      const body = component.querySelector(":scope > .visual-component-body");
      const isNested = Boolean(component.parentElement?.closest(".visual-component"));
      const useUniversalWrapper = wrapper === "componente" || isNested || type === "forca" || type === "imagem";
      const universalType = type === "botoes"
        ? "botao"
        : normalizeType(component.dataset.sourceType || type);
      let content = "";
      if (type === "botoes" || type === "sanfona") {
        const preamble = body.querySelector(":scope > .visual-field > .visual-slot");
        const pairs = body.querySelector(":scope > .visual-pairs-list");
        if (preamble) content += serializeChildren(preamble);
        if (pairs) {
          pairs.querySelectorAll(":scope > .visual-button-window-pair").forEach(pair => {
            pair.querySelectorAll(":scope > .visual-part-card").forEach(part => { content += serializePart(part); });
          });
        }
      } else if (type === "imagem") {
        const titleSlot = body.querySelector(":scope > .visual-field--image-title > .visual-slot");
        const imageSlot = body.querySelector(":scope > .visual-field--image-source > .visual-slot");
        const footerSlot = body.querySelector(":scope > .visual-field--image-footer > .visual-slot");
        const title = String(titleSlot?.textContent || "").replace(/\s+/g, " ").trim();
        const footer = String(footerSlot?.textContent || "").replace(/\s+/g, " ").trim();
        const titleId = titleSlot ? inspectOriginId(titleSlot) : "";
        const footerId = footerSlot ? inspectOriginId(footerSlot) : "";
        const imageSlots = [titleSlot, imageSlot, footerSlot].filter(Boolean);
        const images = imageSlots.flatMap(slot => [...slot.querySelectorAll("img")])
          .map(image => serializeNode(image));
        content = `<imagemitem data-titulo="${escapeHtml(title)}" data-rodape="${escapeHtml(footer)}" data-titulo-id="${escapeHtml(titleId)}" data-rodape-id="${escapeHtml(footerId)}">${images.join("")}</imagemitem>`;
      } else if (type === "destaque") {
        body.querySelectorAll(":scope > .visual-destaque-list > .visual-destaque-set").forEach(item => {
          const titleSlot = item.querySelector(":scope > .visual-part-card[data-visual-part='destaquetitulo'] > .visual-field > .visual-slot");
          const contentSlot = item.querySelector(":scope > .visual-part-card[data-visual-part='destaqueconteudo'] > .visual-field > .visual-slot");
          content += `<destaqueitem><destaquetitulo>${titleSlot ? wrapInspectOrigin(titleSlot, serializeChildren(titleSlot)) : ""}</destaquetitulo> ` +
            `<destaqueconteudo>${contentSlot ? wrapInspectOrigin(contentSlot, serializeChildren(contentSlot)) : ""}</destaqueconteudo></destaqueitem>`;
        });
      } else if (type === "video") {
        body.querySelectorAll(":scope > .visual-video-set").forEach(item => {
          const mode = item.querySelector(":scope > .visual-video-options .visual-video-mode-select")?.value === "modal" ? "modal" : "direto";
          const origin = item.querySelector(":scope > .visual-video-options .visual-video-origin-select")?.value === "youtube" ? "youtube" : "arquivo";
          const label = mode === "modal"
            ? item.querySelector(":scope > .visual-video-label-field .visual-video-label-input")?.value || ""
            : "";
          const slot = item.querySelector(":scope > .visual-field--video-source > .visual-slot");
          content += `<videoitem data-modo="${mode}" data-origem="${origin}" data-rotulo="${escapeHtml(label)}">${slot ? wrapInspectOrigin(slot, serializeChildren(slot)) : ""}</videoitem>`;
        });
      } else if (type === "arquivo") {
        body.querySelectorAll(":scope > .visual-arquivo-set").forEach(item => {
          const label = item.querySelector(":scope > .visual-arquivo-label-field .visual-arquivo-label-input")?.value || "";
          const slot = item.querySelector(":scope > .visual-field--arquivo-name > .visual-slot");
          content += `<arquivoitem data-rotulo="${escapeHtml(label)}">${slot ? wrapInspectOrigin(slot, serializeChildren(slot)) : ""}</arquivoitem>`;
        });
      } else if (type === "hotword") {
        const fields = [...body.querySelectorAll(":scope > .visual-field > .visual-slot")];
        const closeTrigger = (component.dataset.wrapperTag === "componente" || isNested) ? "</hotword>" : "";
        content = `${fields[0] ? serializeChildren(fields[0]) : ""}<hotword>${fields[1] ? serializeChildren(fields[1]) : ""}${closeTrigger}<janela>${fields[2] ? serializeChildren(fields[2]) : ""}`;
      } else {
        content = serializeChildren(body);
      }
      if (type === "hotword" && !useUniversalWrapper) {
        return `${content}</hotword>`;
      }
      return useUniversalWrapper
        ? `<componente tipo="${escapeHtml(universalType)}">${content}</componente>`
        : `<${wrapper}>${content}</${wrapper}>`;
    }

    function getSource() {
      if (mode !== "visual") return String(textarea.value || "").replace(/\r\n?/g, "");
      const hasComponent = Boolean(root.querySelector(".visual-component"));
      const hasText = [...root.querySelectorAll(".visual-text-block, .visual-slot")]
        .some(block => (block.textContent || "").trim() || block.querySelector("img"));
      if (!hasComponent && !hasText) return "";
      serializationInspectIds = new Set();
      const serialized = serializeChildren(root).trim();
      serializationInspectIds = null;
      return serialized;
    }

    function currentSelectionBookmark() {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount || !root.contains(selection.anchorNode) || !root.contains(selection.focusNode)) return null;
      const pathFor = node => {
        const path = [];
        let current = node;
        while (current && current !== root) {
          const parent = current.parentNode;
          if (!parent) return null;
          path.unshift([...parent.childNodes].indexOf(current));
          current = parent;
        }
        return current === root ? path : null;
      };
      return {
        anchorPath: pathFor(selection.anchorNode), anchorOffset: selection.anchorOffset,
        focusPath: pathFor(selection.focusNode), focusOffset: selection.focusOffset
      };
    }

    function nodeAtPath(path) {
      if (!Array.isArray(path)) return null;
      return path.reduce((node, index) => node?.childNodes?.[index] || null, root);
    }

    function restoreBookmark(bookmark) {
      if (!bookmark) { focusEnd(); return; }
      const anchor = nodeAtPath(bookmark.anchorPath);
      const focus = nodeAtPath(bookmark.focusPath);
      if (!anchor || !focus) { focusEnd(); return; }
      const selection = window.getSelection();
      const range = document.createRange();
      try {
        range.setStart(anchor, Math.min(bookmark.anchorOffset, anchor.nodeType === Node.TEXT_NODE ? anchor.length : anchor.childNodes.length));
        range.setEnd(focus, Math.min(bookmark.focusOffset, focus.nodeType === Node.TEXT_NODE ? focus.length : focus.childNodes.length));
        selection.removeAllRanges();
        selection.addRange(range);
      } catch (_) { focusEnd(); }
    }

    function snapshot() {
      const clone = root.cloneNode(true);
      clone.querySelectorAll(".visual-image-resize-overlay").forEach(node => node.remove());
      return { html: clone.innerHTML, selection: currentSelectionBookmark() };
    }

    function resetHistory() {
      history = [snapshot()];
      historyIndex = 0;
    }

    function recordHistory() {
      if (historyRestore) return;
      const state = snapshot();
      if (history[historyIndex]?.html === state.html) return;
      history = history.slice(0, historyIndex + 1);
      history.push(state);
      if (history.length > MAX_HISTORY) history.shift();
      historyIndex = history.length - 1;
    }

    function restoreHistory(index) {
      if (index < 0 || index >= history.length) return;
      historyRestore = true;
      historyIndex = index;
      root.innerHTML = history[index].html;
      refreshEmptyState();
      if (toolbar?.contains(document.activeElement)) root.focus({ preventScroll: true });
      restoreBookmark(history[index].selection);
      historyRestore = false;
      onChange();
    }

    function flushInputHistory() {
      if (inputFrame) {
        cancelAnimationFrame(inputFrame);
        inputFrame = 0;
      }
      recordHistory();
    }

    function undo() {
      flushInputHistory();
      if (historyIndex > 0) restoreHistory(historyIndex - 1);
    }
    function redo() {
      flushInputHistory();
      if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1);
    }

    function focusEnd(container = root) {
      const range = document.createRange();
      range.selectNodeContents(container);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      container.focus?.();
    }

    function updateToolbarState(range = null) {
      if (!toolbar) return;
      const selection = window.getSelection();
      const activeRange = range || (selection?.rangeCount ? selection.getRangeAt(0) : null);
      const insideEditor = activeRange &&
        root.contains(activeRange.startContainer) &&
        root.contains(activeRange.endContainer);

      let block = null;
      if (insideEditor) {
        const node = activeRange.startContainer.nodeType === Node.ELEMENT_NODE
          ? activeRange.startContainer : activeRange.startContainer.parentElement;
        block = node?.closest?.("h1, h2, h3, p, blockquote, pre, li");
        if (block && !root.contains(block)) block = null;
      }

      toolbar.querySelectorAll("[data-editor-format]").forEach(button => {
        const format = button.dataset.editorFormat;
        let active = false;
        if (insideEditor) {
          if (format === "h1" || format === "h2" || format === "h3") {
            active = block?.tagName?.toLowerCase() === format;
          } else if (format === "bold") {
            try { active = document.queryCommandState("bold"); } catch (_) {}
          } else if (format === "quote") {
            active = Boolean(block?.closest("blockquote"));
          } else if (format === "code") {
            active = Boolean(block?.closest("pre"));
          } else if (format === "superscript" || format === "subscript") {
            try { active = document.queryCommandState(format); } catch (_) {}
          } else if (format === "list") {
            active = Boolean(block?.closest("ul, ol"));
          } else if (format === "link") {
            const node = activeRange.startContainer.nodeType === Node.ELEMENT_NODE
              ? activeRange.startContainer : activeRange.startContainer.parentElement;
            active = Boolean(node?.closest?.("a"));
          }
        }
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
    }

    function rememberSelection() {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (root.contains(range.startContainer) && root.contains(range.endContainer)) {
        lastRange = range.cloneRange();
        updateToolbarState(range);
      } else if (!toolbar?.contains(document.activeElement)) {
        updateToolbarState(null);
      }
    }

    function restoreSelection() {
      const range = targetRange();
      const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer : range.startContainer.parentElement;
      const editable = startElement?.closest?.('[contenteditable="true"]');
      editable?.focus?.({ preventScroll: true });
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      lastRange = range.cloneRange();
      return range;
    }

    function dispatchVisualInput() {
      root.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function formatSelection(format, value = "") {
      const range = restoreSelection();
      if (!range) return false;
      const commands = {
        h1: ["formatBlock", "<h1>"],
        h2: ["formatBlock", "<h2>"],
        h3: ["formatBlock", "<h3>"],
        bold: ["bold", null],
        list: ["insertUnorderedList", null],
        quote: ["formatBlock", "<blockquote>"],
        code: ["formatBlock", "<pre>"],
        superscript: ["superscript", null],
        subscript: ["subscript", null]
      };

      if (format === "link") {
        const url = String(value || "").trim();
        if (!url) return false;
        const safeUrl = /^(https?:|mailto:|tel:)/i.test(url) ? url : `https://${url}`;
        document.execCommand("createLink", false, safeUrl);
        const selection = window.getSelection();
        const node = selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
          ? selection.anchorNode : selection?.anchorNode?.parentElement;
        const anchor = node?.closest?.("a") || range.startContainer.parentElement?.closest?.("a");
        if (anchor) {
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
        }
      } else {
        const command = commands[format];
        if (!command) return false;

        // Clicar novamente no título ativo remove a formatação e retorna o bloco
        // para parágrafo, como no Word.
        if (format === "h1" || format === "h2" || format === "h3") {
          const node = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer : range.startContainer.parentElement;
          const currentBlock = node?.closest?.("h1, h2, h3");
          const currentTag = currentBlock?.tagName?.toLowerCase();
          const targetTag = currentTag === format ? "<p>" : command[1];
          document.execCommand("formatBlock", false, targetTag);
        } else {
          document.execCommand(command[0], false, command[1]);
        }
      }

      rememberSelection();
      updateToolbarState();
      dispatchVisualInput();
      return true;
    }

    function insertImage(dataUrl, alt = "Imagem") {
      if (!/^data:image\/(?:png|jpe?g|gif|webp|bmp|svg\+xml);base64,/i.test(String(dataUrl || ""))) {
        notify("Não foi possível inserir essa imagem.", true);
        return false;
      }
      const range = restoreSelection();
      if (!range) return false;
      range.deleteContents();
      const image = document.createElement("img");
      image.src = dataUrl;
      image.alt = String(alt || "Imagem").replace(/[\r\n]+/g, " ").slice(0, 200);
      image.style.maxWidth = "100%";
      image.style.height = "auto";
      range.insertNode(image);
      range.setStartAfter(image);
      range.collapse(true);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      lastRange = range.cloneRange();
      dispatchVisualInput();
      return true;
    }

    function targetRange() {
      const selection = window.getSelection();
      if (selection?.rangeCount && root.contains(selection.anchorNode) && root.contains(selection.focusNode)) {
        return selection.getRangeAt(0).cloneRange();
      }
      if (lastRange && root.contains(lastRange.startContainer) && root.contains(lastRange.endContainer)) return lastRange.cloneRange();
      const range = document.createRange();
      range.selectNodeContents(root);
      range.collapse(false);
      return range;
    }

    function focusStart(container) {
      const range = document.createRange();
      range.selectNodeContents(container);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      container.focus?.();
    }

    function isFlowTextBlock(node) {
      const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
      const block = element?.closest?.(".visual-text-block");
      return block && (block.parentElement === root || block.parentElement?.matches(".visual-slot")) ? block : null;
    }

    function collectEditableTextNodes(container) {
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        const component = node.parentElement?.closest(".visual-component");
        if (component && container.contains(component)) continue;
        nodes.push(node);
      }
      return nodes;
    }

    function placeCaretAtBlockEdge(block, direction) {
      const range = document.createRange();
      range.selectNodeContents(block);
      range.collapse(direction === "forward");
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      block.focus?.({ preventScroll: true });
      lastRange = range.cloneRange();
    }

    function placeCaretAtTextOffset(block, offset, direction) {
      const textNodes = collectEditableTextNodes(block);
      const range = document.createRange();
      let remaining = Math.max(0, Number(offset) || 0);
      let targetNode = null;
      let targetOffset = 0;

      for (const node of textNodes) {
        if (remaining <= node.length) {
          targetNode = node;
          targetOffset = remaining;
          break;
        }
        remaining -= node.length;
      }

      if (targetNode) {
        range.setStart(targetNode, targetOffset);
        range.collapse(true);
      } else {
        range.selectNodeContents(block);
        range.collapse(direction === "forward");
      }

      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      block.focus?.({ preventScroll: true });
      lastRange = range.cloneRange();
    }

    function adjacentTextBlock(component, direction) {
      let sibling = direction === "backward" ? component.previousElementSibling : component.nextElementSibling;
      while (sibling?.matches(".visual-component")) {
        sibling = direction === "backward" ? sibling.previousElementSibling : sibling.nextElementSibling;
      }
      return sibling?.matches(".visual-text-block") ? sibling : null;
    }

    function textBoundaryOffset(text, direction, event) {
      if (event.metaKey) return direction === "backward" ? 0 : text.length;
      if (event.ctrlKey || event.altKey) {
        if (direction === "backward") {
          let index = text.length;
          while (index > 0 && /\s/.test(text[index - 1])) index--;
          while (index > 0 && !/\s/.test(text[index - 1])) index--;
          return index;
        }
        let index = 0;
        while (index < text.length && /\s/.test(text[index])) index++;
        while (index < text.length && !/\s/.test(text[index])) index++;
        return index;
      }

      if (typeof Intl.Segmenter === "function") {
        const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text);
        if (direction === "backward") {
          let start = 0;
          for (const segment of segments) start = segment.index;
          return start;
        }
        return segments[Symbol.iterator]().next().value?.segment.length || 0;
      }

      if (direction === "backward") {
        const last = text.length - 1;
        return last > 0 && /[\uDC00-\uDFFF]/.test(text[last]) ? last - 1 : last;
      }
      return text.length > 1 && /[\uD800-\uDBFF]/.test(text[0]) ? 2 : 1;
    }

    function deleteTextAtBlockEdge(block, direction, event) {
      const textNodes = collectEditableTextNodes(block);
      const text = textNodes.map(node => node.nodeValue || "").join("");
      if (!text) {
        placeCaretAtBlockEdge(block, direction);
        return false;
      }

      const start = direction === "backward" ? textBoundaryOffset(text, direction, event) : 0;
      const end = direction === "backward" ? text.length : textBoundaryOffset(text, direction, event);
      if (end <= start) {
        placeCaretAtBlockEdge(block, direction);
        return false;
      }

      const parts = [];
      let cursor = 0;
      for (const node of textNodes) {
        const nodeStart = cursor;
        const nodeEnd = nodeStart + node.length;
        const partStart = Math.max(start, nodeStart);
        const partEnd = Math.min(end, nodeEnd);
        if (partEnd > partStart) parts.push({ node, start: partStart - nodeStart, end: partEnd - nodeStart });
        cursor = nodeEnd;
      }

      for (const part of parts.reverse()) {
        if (!part.node.isConnected) continue;
        const range = document.createRange();
        range.setStart(part.node, part.start);
        range.setEnd(part.node, part.end);
        range.deleteContents();
      }

      placeCaretAtTextOffset(block, start, direction);
      dispatchVisualInput();
      return true;
    }

    function offsetsInTextNode(range, node) {
      let start = range.startContainer === node ? range.startOffset : 0;
      let end = range.endContainer === node ? range.endOffset : node.length;
      if (range.startContainer !== node && range.comparePoint(node, 0) > 0) start = node.length;
      if (range.endContainer !== node && range.comparePoint(node, node.length) < 0) end = 0;
      return {
        start,
        end
      };
    }

    function deleteSelectionTextAroundComponents(range, protectedComponents) {
      const parts = [];
      root.querySelectorAll(".visual-text-block").forEach(block => {
        if (protectedComponents.some(component => component.contains(block))) return;
        for (const node of collectEditableTextNodes(block)) {
          if (!range.intersectsNode(node)) continue;
          const offsets = offsetsInTextNode(range, node);
          if (offsets.end > offsets.start) parts.push({ node, ...offsets });
        }
      });

      for (const part of parts.reverse()) {
        if (!part.node.isConnected) continue;
        const textRange = document.createRange();
        textRange.setStart(part.node, part.start);
        textRange.setEnd(part.node, part.end);
        textRange.deleteContents();
      }
      return parts.length > 0;
    }

    function protectComponentsFromKeyboardDelete(event) {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return false;
      const range = selection.getRangeAt(0);
      const direction = event.key === "Backspace" ? "backward" : "forward";

      if (!selection.isCollapsed) {
        const protectedComponents = [...root.querySelectorAll(".visual-component")].filter(component =>
          range.intersectsNode(component) &&
          !(component.contains(range.startContainer) && component.contains(range.endContainer))
        );
        if (!protectedComponents.length) return false;

        event.preventDefault();
        const targetComponent = direction === "backward" ? protectedComponents[0] : protectedComponents[protectedComponents.length - 1];
        const targetBlock = adjacentTextBlock(targetComponent, direction);
        const changed = deleteSelectionTextAroundComponents(range, protectedComponents);
        if (targetBlock) placeCaretAtBlockEdge(targetBlock, direction);
        else placeCaretAtBlockEdge(root, direction);
        if (changed) dispatchVisualInput();
        return true;
      }

      const block = isFlowTextBlock(selection.anchorNode);
      if (!block || !block.contains(selection.anchorNode) || !isCaretAtBlockEdge(block, range, direction)) return false;
      const component = direction === "backward" ? block.previousElementSibling : block.nextElementSibling;
      if (!component?.matches(".visual-component")) return false;

      event.preventDefault();
      const targetBlock = adjacentTextBlock(component, direction);
      if (targetBlock) deleteTextAtBlockEdge(targetBlock, direction, event);
      else placeCaretAtBlockEdge(block, direction);
      return true;
    }

    function isCaretAtBlockEdge(block, range, direction) {
      if (!block.contains(range.startContainer) || !range.collapsed) return false;
      const probe = document.createRange();
      probe.selectNodeContents(block);
      if (direction === "backward") probe.setEnd(range.startContainer, range.startOffset);
      else probe.setStart(range.startContainer, range.startOffset);
      return probe.toString().length === 0;
    }

    function ensureTextAfter(node, container) {
      const parent = node.parentNode;
      if (!parent) return;
      const next = node.nextSibling;
      if (next && next.nodeType === Node.ELEMENT_NODE && next.classList.contains("visual-text-block")) {
        focusStart(next);
        return;
      }
      const blank = createEmptyTextBlock();
      parent.insertBefore(blank, node.nextSibling);
      focusStart(blank);
    }

    // Garante uma área realmente editável entre componentes irmãos na raiz.
    // Margem visual não substitui um bloco no qual o usuário possa posicionar o cursor.
    function ensureRootTextGaps() {
      // Cada componente da raiz precisa ter um ponto de inserção acessível
      // antes e depois. O bloco é contenteditable, mas visualmente discreto;
      // serve para texto, imagem colada/arrastada ou inserção da Biblioteca.
      let first = root.firstElementChild;
      if (first?.matches(".visual-component")) {
        root.insertBefore(createEmptyTextBlock("Clique para inserir conteúdo antes deste componente..."), first);
      }

      let current = root.firstElementChild;
      while (current) {
        if (current.matches(".visual-component")) {
          const next = current.nextElementSibling;
          if (!next || next.matches(".visual-component")) {
            root.insertBefore(createEmptyTextBlock("Clique para inserir conteúdo aqui..."), next || null);
          }
        }
        current = current.nextElementSibling;
      }
    }

    function insertImageFile(file, slot, range) {
      if (!file || !file.type?.startsWith("image/") || !slot) return false;
      const reader = new FileReader();
      reader.onload = () => {
        const image = document.createElement("img");
        image.src = String(reader.result || "");
        image.alt = file.name || "Imagem inserida";
        image.className = "visual-inserted-image";
        const insertion = range && slot.contains(range.startContainer) ? range : document.createRange();
        if (!range || !slot.contains(range.startContainer)) {
          insertion.selectNodeContents(slot);
          insertion.collapse(false);
        }
        insertion.deleteContents();
        insertion.insertNode(image);
        const after = document.createRange();
        after.setStartAfter(image);
        after.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(after);
        recordHistory();
        onChange();
      };
      reader.readAsDataURL(file);
      return true;
    }

    function insertNodeAtRange(node, range) {
      const anchor = range.startContainer.nodeType === Node.ELEMENT_NODE
        ? range.startContainer : range.startContainer.parentElement;
      const textBlock = anchor?.closest(".visual-text-block");
      let inserted = node;

      if (textBlock && textBlock.contains(range.endContainer)) {
        const parent = textBlock.parentNode;
        const beforeRange = range.cloneRange();
        beforeRange.selectNodeContents(textBlock);
        beforeRange.setEnd(range.startContainer, range.startOffset);
        const afterRange = range.cloneRange();
        afterRange.selectNodeContents(textBlock);
        afterRange.setStart(range.endContainer, range.endOffset);
        const beforeFragment = beforeRange.cloneContents();
        const afterFragment = afterRange.cloneContents();
        const hasNodes = fragment => fragment.childNodes.length > 0;
        if (hasNodes(beforeFragment)) {
          const beforeBlock = document.createElement("div");
          beforeBlock.className = "visual-text-block";
          beforeBlock.setAttribute("contenteditable", "true");
          beforeBlock.appendChild(beforeFragment);
          parent.insertBefore(beforeBlock, textBlock);
        }
        parent.insertBefore(node, textBlock);
        if (hasNodes(afterFragment)) {
          const afterBlock = document.createElement("div");
          afterBlock.className = "visual-text-block";
          afterBlock.setAttribute("contenteditable", "true");
          afterBlock.appendChild(afterFragment);
          parent.insertBefore(afterBlock, textBlock.nextSibling);
        }
        textBlock.remove();
      } else {
        range.deleteContents();
        range.insertNode(node);
      }
      ensureTextAfter(node, root);
      ensureRootTextGaps();
      refreshEmptyState();
      recordHistory();
      onChange();
      root.focus();
      const selection = window.getSelection();
      if (selection?.rangeCount) lastRange = selection.getRangeAt(0).cloneRange();
    }

    function parseExample(slug) {
      // Componentes com conjuntos são iniciados pela estrutura padrão do Editor,
      // garantindo agrupamento e controles desde a primeira inserção.
      if (slug === "dividir") return buildComponent("dividir", "");
      if (slug === "hotword") return buildComponent("hotword", "");
      if (["abas", "flashcard", "jogomemoria", "mininavegacao", "ligapontos", "relacionarcolunas", "opcoes", "verdadeirofalso", "forca", "botoes", "botao", "sanfona"].includes(slug)) {
        return buildComponent(slug === "botao" ? "botoes" : slug, "");
      }
      let snippet = examples[slug];
      if (typeof snippet !== "string" || !snippet.trim()) return null;
      if (slug === "hotword") {
        const start = snippet.search(/<hotword\b/i);
        if (start >= 0) snippet = snippet.slice(0, snippet.toLowerCase().lastIndexOf("</hotword>") + 10);
      }
      const fragment = parseFlow(snippet.trim());
      const component = [...fragment.childNodes].find(node => node.nodeType === Node.ELEMENT_NODE && node.matches(".visual-component"));
      return component ? component.cloneNode(true) : buildComponent(slug, "");
    }

    function insertComponent(slug, range = null, message = true) {
      const insertionRange = range || targetRange();
      if (slug === "dividir" && root.querySelector('.visual-component[data-visual-component="dividir"]')) {
        notify("Só é possível inserir um marcador Dividir por Tela.", true);
        return false;
      }
      if (slug === "dividir") {
        const node = insertionRange?.startContainer;
        const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
        if (element?.closest(".visual-component")) {
          notify("Dividir precisa ficar entre os conteúdos da Tela, fora dos componentes.", true);
          return false;
        }
      }
      const node = parseExample(slug);
      if (!node) { notify("Não foi encontrado um exemplo para este componente.", true); return false; }
      insertNodeAtRange(node, insertionRange);
      libraryList?.querySelectorAll("[data-component]").forEach(button => {
        const active = button.dataset.component === slug;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      if (message) notify(`${LABELS[slug] || slug} inserido na estrutura.`);
      return true;
    }

    function insertComponentMarkup(markup, expectedSlug, range = null, message = true) {
      const fragment = parseFlow(String(markup || "").trim());
      const component = [...fragment.childNodes].find(node =>
        node.nodeType === Node.ELEMENT_NODE && node.classList.contains("visual-component")
      );
      if (!component) {
        notify("Não foi possível reconhecer o componente nesta linha do roteiro.", true);
        return false;
      }

      const requestedSlug = normalizeType(expectedSlug);
      const actualSlug = normalizeType(component.dataset.visualComponent);
      const normalizedRequestedSlug = requestedSlug === "botao" ? "botoes" : requestedSlug;
      if (normalizedRequestedSlug && actualSlug !== normalizedRequestedSlug) {
        notify("A linha colada não corresponde ao tipo de componente escolhido.", true);
        return false;
      }

      if (actualSlug === "dividir" && root.querySelector('.visual-component[data-visual-component="dividir"]')) {
        notify("Só é possível inserir um marcador Dividir por Tela.", true);
        return false;
      }

      const anchor = (range || targetRange()).startContainer;
      const anchorElement = anchor.nodeType === Node.ELEMENT_NODE ? anchor : anchor.parentElement;
      if (actualSlug === "dividir" && anchorElement?.closest(".visual-component")) {
        notify("Dividir precisa ficar entre os conteúdos da Tela, fora dos componentes.", true);
        return false;
      }

      insertNodeAtRange(component, range || targetRange());
      libraryList?.querySelectorAll("[data-component]").forEach(button => {
        const active = button.dataset.component === requestedSlug;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      if (message) notify(`${LABELS[actualSlug] || actualSlug} importado para a estrutura visual.`);
      return true;
    }

    function insertContentMarkup(markup, range = null, message = true) {
      const fragment = parseFlow(String(markup || ""));
      [...fragment.childNodes].forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("visual-empty-block")) node.remove();
      });
      const nodes = [...fragment.childNodes];
      if (!nodes.length) return false;

      const hasVisibleContent = container => [...container.childNodes].some(node => {
        if (node.nodeType === Node.TEXT_NODE) return Boolean((node.nodeValue || "").trim());
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        return Boolean((node.textContent || "").trim() || node.matches("img, .visual-component") || node.querySelector("img, .visual-component"));
      });
      const importedHasDivider = nodes.some(node =>
        node.matches?.('.visual-component[data-visual-component="dividir"]') ||
        node.querySelector?.('.visual-component[data-visual-component="dividir"]')
      );
      if (importedHasDivider && root.querySelector(':scope > .visual-component[data-visual-component="dividir"]')) {
        notify("A Tela já tem um componente Dividir. Remova o existente antes de colar outro.", true);
        return false;
      }

      const onlyPlaceholder = !root.querySelector(".visual-component") &&
        [...root.children].every(child => child.matches(".visual-empty-block") || !hasVisibleContent(child));
      let insertionRange = range || targetRange();
      if (onlyPlaceholder) {
        root.replaceChildren();
        insertionRange = document.createRange();
        insertionRange.selectNodeContents(root);
        insertionRange.collapse(false);
      }

      const insertedNodes = [...nodes];
      const lastInserted = insertedNodes[insertedNodes.length - 1];
      const anchor = insertionRange.startContainer.nodeType === Node.ELEMENT_NODE
        ? insertionRange.startContainer : insertionRange.startContainer.parentElement;
      const textBlock = anchor?.closest?.(".visual-text-block");

      if (textBlock && textBlock.contains(insertionRange.startContainer) && textBlock.contains(insertionRange.endContainer)) {
        const beforeRange = insertionRange.cloneRange();
        beforeRange.selectNodeContents(textBlock);
        beforeRange.setEnd(insertionRange.startContainer, insertionRange.startOffset);
        const afterRange = insertionRange.cloneRange();
        afterRange.selectNodeContents(textBlock);
        afterRange.setStart(insertionRange.endContainer, insertionRange.endOffset);
        const beforeFragment = beforeRange.cloneContents();
        const afterFragment = afterRange.cloneContents();
        const parent = textBlock.parentNode;

        if (hasVisibleContent(beforeFragment)) {
          const beforeBlock = document.createElement("div");
          beforeBlock.className = "visual-text-block";
          beforeBlock.setAttribute("contenteditable", "true");
          beforeBlock.appendChild(beforeFragment);
          parent.insertBefore(beforeBlock, textBlock);
        }
        parent.insertBefore(fragment, textBlock);
        if (hasVisibleContent(afterFragment)) {
          const afterBlock = document.createElement("div");
          afterBlock.className = "visual-text-block";
          afterBlock.setAttribute("contenteditable", "true");
          afterBlock.appendChild(afterFragment);
          parent.insertBefore(afterBlock, textBlock.nextSibling);
        }
        textBlock.remove();
      } else {
        insertionRange.deleteContents();
        insertionRange.insertNode(fragment);
      }

      refreshEmptyState();
      ensureRootTextGaps();
      refreshEmptyState();
      const trailingBlock = lastInserted.nextElementSibling?.matches(".visual-text-block")
        ? lastInserted.nextElementSibling
        : lastInserted.matches?.(".visual-text-block") ? lastInserted : null;
      if (trailingBlock) focusEnd(trailingBlock);
      else if (lastInserted.parentNode) {
        const caret = document.createRange();
        caret.setStartAfter(lastInserted);
        caret.collapse(true);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(caret);
        root.focus({ preventScroll: true });
        lastRange = caret.cloneRange();
      }
      recordHistory();
      onChange();
      if (message) notify("Conteúdo do roteiro importado para a estrutura visual.");
      return true;
    }

    function addButtonWindow(component) {
      const pairList = component.querySelector(":scope > .visual-component-body > .visual-pairs-list");
      if (!pairList) return;
      const pairs = [...pairList.querySelectorAll(":scope > .visual-button-window-pair")];
      const index = pairs.length + 1;
      const pair = document.createElement("div");
      pair.className = "visual-button-window-pair";
      pair.dataset.pairIndex = String(index);
      const caption = document.createElement("div");
      caption.className = "visual-pair-caption";
      caption.innerHTML = `<span>Conjunto ${index}</span><span>Botão + Janela</span>`;
      pair.appendChild(caption);
      pair.append(createPartCard("botao", `Botão ${index}`, `<p>Botão ${index}</p>`, index), createPartCard("janela", `Janela ${index}`, "<p>Digite aqui o texto da janela...</p>", index), makeSetControls());
      pairList.insertBefore(pair, pairList.querySelector(".visual-add-pair"));
      const slot = pair.querySelector(".visual-slot");
      recordHistory();
      onChange();
      if (slot) focusEnd(slot);
    }

    function addStructuralSet(component, type) {
      const body = component.querySelector(":scope > .visual-component-body");
      if (!body) return;
      const next = {
        abas: [["aba", "Título da aba"], ["janela", "Conteúdo da janela"]],
        flashcard: [["frente", "Frente"], ["verso", "Verso"]],
        jogomemoria: [["carta1", "Carta 1"], ["carta2", "Carta 2"], ["feedback", "Feedback"]],
        mininavegacao: [["janela", "Janela"]],
        ligapontos: [["opcao", "Opção"], ["resposta", "Resposta"]],
        relacionarcolunas: [["opcao", "Item da primeira coluna"], ["resposta", "Item da segunda coluna"]],
        opcoes: [["alternativa", ""], ["correta", "NÃO"]],
        verdadeirofalso: [["alternativa", "Frase"], ["correta", "Resposta esperada"]]
      }[type];
      if (!next) return;
      const addButton = body.querySelector(":scope > .visual-add-structure-set");
      const current = body.querySelectorAll(":scope > .visual-structure-set:not([data-set-fixed='true'])").length;
      const group = document.createElement("section");
      group.className = "visual-structure-set";
      group.dataset.setIndex = String(current + 1);
      const heading = document.createElement("div");
      heading.className = "visual-pair-caption";
      heading.textContent = type === "mininavegacao" ? `Janela ${current + 1}` : type === "opcoes" ? `Alternativa ${current + 1}` : type === "verdadeirofalso" ? `Frase ${current + 1}` : `Conjunto ${current + 1}`;
      group.appendChild(heading);
      next.forEach(([marker, title]) => group.appendChild(createPartCard(marker, `${title} ${current + 1}`, "", current + 1)));
      group.appendChild(makeSetControls());
      body.insertBefore(group, addButton || null);
      renumberSets(component);
      recordHistory(); onChange();
      const firstSlot = group.querySelector(".visual-slot");
      if (firstSlot) focusEnd(firstSlot);
    }

    function addDestaqueItem(component) {
      const list = component.querySelector(":scope > .visual-component-body > .visual-destaque-list");
      if (!list) return;
      const groups = [...list.querySelectorAll(":scope > .visual-destaque-set")];
      const index = groups.length + 1;
      const group = document.createElement("section");
      group.className = "visual-structure-set visual-destaque-set";
      group.dataset.setIndex = String(index);
      const heading = document.createElement("div");
      heading.className = "visual-pair-caption";
      heading.textContent = `Destaque ${index}`;
      group.append(heading, createPartCard("destaquetitulo", "Título", "", index), createPartCard("destaqueconteudo", "Texto ou imagem", "", index), makeSetControls());
      list.insertBefore(group, list.querySelector(":scope > .visual-add-structure-set"));
      recordHistory(); onChange();
      const firstSlot = group.querySelector(".visual-slot");
      if (firstSlot) focusEnd(firstSlot);
    }

    function syncCollapsedControl(control, collapsed, label) {
      control?.setAttribute("aria-expanded", String(!collapsed));
      if (label) control?.setAttribute("aria-label", `${collapsed ? "Expandir" : "Recolher"} ${label}`);
      const icon = control?.querySelector("i");
      icon?.classList.toggle("bi-chevron-right", collapsed);
      icon?.classList.toggle("bi-chevron-down", !collapsed);
    }

    function syncComponentCollapsedControls(component, collapsed, label) {
      const header = component.querySelector(":scope > .visual-component-header");
      const arrow = header?.querySelector("[data-visual-action='toggle']");
      const pencil = header?.querySelector("[data-visual-action='toggle-pencil']");
      syncCollapsedControl(arrow, collapsed, label);
      pencil?.setAttribute("aria-expanded", String(!collapsed));
      if (label) {
        const actionLabel = `${collapsed ? "Expandir" : "Recolher"} ${label}`;
        pencil?.setAttribute("aria-label", actionLabel);
        pencil?.setAttribute("title", actionLabel);
      }
    }

    function collapseDescendants(component) {
      component.querySelectorAll(".visual-component").forEach(child => {
        child.classList.add("is-collapsed");
        syncComponentCollapsedControls(child, true,
          LABELS[child.dataset.visualComponent] || child.dataset.visualComponent);
      });
      component.querySelectorAll(".visual-part-card").forEach(part => {
        part.classList.add("is-collapsed");
        syncCollapsedControl(part.querySelector(":scope > [data-visual-action='toggle-part']"), true);
      });
    }

    function removeImageResizeOverlay() {
      imageResizeOverlay?.remove();
      imageResizeOverlay = null;
      selectedImage = null;
    }

    function positionImageResizeOverlay() {
      if (!selectedImage?.isConnected || !imageResizeOverlay) return removeImageResizeOverlay();
      const imageRect = selectedImage.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      imageResizeOverlay.style.left = `${imageRect.left - rootRect.left + root.scrollLeft}px`;
      imageResizeOverlay.style.top = `${imageRect.top - rootRect.top + root.scrollTop}px`;
      imageResizeOverlay.style.width = `${imageRect.width}px`;
      imageResizeOverlay.style.height = `${imageRect.height}px`;
    }

    function selectImageForResize(image) {
      if (!image || !root.contains(image)) return removeImageResizeOverlay();
      removeImageResizeOverlay();
      selectedImage = image;
      imageResizeOverlay = document.createElement("div");
      imageResizeOverlay.className = "visual-image-resize-overlay";
      imageResizeOverlay.setAttribute("contenteditable", "false");
      ["nw", "ne", "sw", "se"].forEach(corner => {
        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = `visual-image-resize-handle visual-image-resize-handle--${corner}`;
        handle.dataset.corner = corner;
        handle.setAttribute("aria-label", `Redimensionar imagem pelo canto ${corner}`);
        imageResizeOverlay.appendChild(handle);
      });
      root.appendChild(imageResizeOverlay);
      positionImageResizeOverlay();
    }

    root.addEventListener("pointerdown", event => {
      const handle = event.target.closest(".visual-image-resize-handle");
      if (!handle || !selectedImage) return;
      event.preventDefault();
      event.stopPropagation();
      const image = selectedImage;
      const startX = event.clientX;
      const startY = event.clientY;
      const imageRect = image.getBoundingClientRect();
      const startWidth = imageRect.width;
      const startHeight = imageRect.height;
      const ratio = startHeight / Math.max(1, startWidth);
      const directionX = handle.dataset.corner.includes("w") ? -1 : 1;
      const directionY = handle.dataset.corner.includes("n") ? -1 : 1;
      const pointerId = event.pointerId;
      try { handle.setPointerCapture(pointerId); } catch (_) {}
      const move = moveEvent => {
        const deltaWidth = (moveEvent.clientX - startX) * directionX;
        const deltaHeight = (moveEvent.clientY - startY) * directionY / Math.max(.01, ratio);
        const delta = Math.abs(deltaWidth) >= Math.abs(deltaHeight) ? deltaWidth : deltaHeight;
        const width = Math.max(40, Math.min(1600, startWidth + delta));
        image.style.width = `${Math.round(width)}px`;
        image.style.height = "auto";
        // A altura do slot é natural: ao aumentar a imagem, o conteúdo editável
        // e o cartão do conjunto acompanham a nova altura sem cortar a imagem.
        image.closest(".visual-slot")?.style.setProperty("height", "auto");
        positionImageResizeOverlay();
      };
      const finish = finishEvent => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", finish);
        handle.removeEventListener("pointercancel", finish);
        if (finishEvent.type === "pointerup") { recordHistory(); onChange(); }
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
    });

    root.addEventListener("click", event => {
      if (event.target.closest(".visual-image-resize-overlay")) return;
      const image = event.target.closest("img");
      if (image && root.contains(image)) selectImageForResize(image);
      else if (!event.target.closest(".visual-component-header, .visual-part-header")) removeImageResizeOverlay();
    }, true);
    root.addEventListener("scroll", positionImageResizeOverlay, true);
    window.addEventListener("resize", positionImageResizeOverlay);

    function animateSetReorder(parent, mutate) {
      const cards = [...parent.children].filter(child =>
        child.matches(".visual-button-window-pair, .visual-structure-set:not([data-set-fixed='true'])")
      );
      const before = new Map(cards.map(card => [card, card.getBoundingClientRect()]));
      mutate();
      cards.forEach(card => {
        if (!card.isConnected) return;
        const first = before.get(card);
        const last = card.getBoundingClientRect();
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (!dx && !dy) return;
        card.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: 300, easing: "cubic-bezier(.2,.75,.25,1)" }
        );
      });
    }

    function animateNewSet(card) {
      card.classList.remove("is-newly-cloned");
      void card.offsetWidth;
      card.classList.add("is-newly-cloned");
      card.addEventListener("animationend", () => card.classList.remove("is-newly-cloned"), { once: true });
    }

    function cloneSet(set, component) {
      if (!set || !component) return;
      const parent = set.parentElement;
      let copy = set.cloneNode(true);
      if (component.dataset.visualComponent === "video") {
        copy = videoItemFromMarkup({
          modo: copy.querySelector(".visual-video-mode-select")?.value,
          origem: copy.querySelector(".visual-video-origin-select")?.value,
          rotulo: copy.querySelector(".visual-video-label-input")?.value,
          fonte: copy.querySelector(".visual-field--video-source > .visual-slot")?.innerHTML || ""
        });
      } else if (component.dataset.visualComponent === "arquivo") {
        copy = arquivoItemFromMarkup({
          rotulo: copy.querySelector(".visual-arquivo-label-input")?.value,
          fonte: copy.querySelector(".visual-field--arquivo-name > .visual-slot")?.innerHTML || ""
        });
      }
      copy.querySelectorAll(".visual-set-delete-confirm").forEach(confirm => { confirm.hidden = true; });
      copy.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
      copy.querySelectorAll("[aria-controls]").forEach(node => node.removeAttribute("aria-controls"));
      copy.querySelectorAll(".visual-image-resize-overlay").forEach(node => node.remove());
      copy.classList.remove("is-newly-cloned", "is-reorder-target", "is-being-dragged");
      const controls = copy.querySelector(":scope > .visual-set-controls");
      if (!controls) copy.appendChild(makeSetControls());
      parent.insertBefore(copy, set.nextElementSibling);
      renumberSets(component);
      animateNewSet(copy);
      recordHistory();
      onChange();
      copy.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
      notify("Conjunto clonado.");
    }

    function onVisualClick(event) {
      // Registrar explicitamente o ponto clicado, inclusive quando o bloco
      // está vazio (onde alguns navegadores não atualizam a seleção/caret).
      const textBlock = event.target.closest?.(".visual-text-block.visual-empty-block");
      // Só posiciona o cursor manualmente em espaços vazios. Em blocos que já
      // contêm texto, o navegador controla a seleção nativa; reposicioná-la no
      // evento click apagava o trecho recém-selecionado ao soltar o mouse.
      if (textBlock && root.contains(textBlock) && !event.target.closest("[data-visual-action]")) {
        let range = rangeAtPoint(event);
        if (!range || !textBlock.contains(range.startContainer)) {
          range = document.createRange();
          range.selectNodeContents(textBlock);
          range.collapse(true);
        }
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        textBlock.focus?.();
        lastRange = range.cloneRange();
      }
      const action = event.target.closest("[data-visual-action]");
      if (!action || !root.contains(action)) return;
      const component = action.closest(".visual-component");
      if (["toggle", "toggle-pencil"].includes(action.dataset.visualAction) && component) {
        const collapsed = component.classList.toggle("is-collapsed");
        syncComponentCollapsedControls(component, collapsed,
          LABELS[component.dataset.visualComponent] || component.dataset.visualComponent);
        if (collapsed) collapseDescendants(component);
        recordHistory();
      } else if (action.dataset.visualAction === "toggle-part") {
        const part = action.closest(".visual-part-card");
        if (part) {
          const collapsed = part.classList.toggle("is-collapsed");
          action.setAttribute("aria-expanded", String(!collapsed));
          action.querySelector("i")?.classList.toggle("bi-chevron-right", collapsed);
          action.querySelector("i")?.classList.toggle("bi-chevron-down", !collapsed);
          recordHistory();
        }
      } else if (action.dataset.visualAction === "add-pair" && component) {
        addButtonWindow(component);
      } else if (action.dataset.visualAction === "add-structure-set" && component) {
        addStructuralSet(component, action.dataset.setType);
      } else if (action.dataset.visualAction === "add-video-item" && component) {
        const body = component.querySelector(":scope > .visual-component-body");
        const addButton = body?.querySelector(":scope > .visual-add-structure-set");
        const row = videoItemFromMarkup({ modo: "modal", origem: "arquivo", rotulo: "Assistir vídeo", fonte: "" });
        body?.insertBefore(row, addButton || null);
        renumberSets(component);
        recordHistory(); onChange();
        row.querySelector(".visual-slot")?.focus();
      } else if (action.dataset.visualAction === "add-arquivo-item" && component) {
        const body = component.querySelector(":scope > .visual-component-body");
        const addButton = body?.querySelector(":scope > .visual-add-structure-set");
        const row = arquivoItemFromMarkup({ rotulo: "", fonte: "" });
        body?.insertBefore(row, addButton || null);
        renumberSets(component);
        recordHistory(); onChange();
        row.querySelector(".visual-arquivo-label-input")?.focus();
      } else if (action.dataset.visualAction === "add-destaque-item" && component) {
        addDestaqueItem(component);
      } else if (["move-set-up", "move-set-down", "clone-set", "request-delete-set", "confirm-delete-set", "cancel-delete-set"].includes(action.dataset.visualAction)) {
        const set = action.closest(".visual-structure-set, .visual-button-window-pair");
        if (!set) return;
        if (action.dataset.visualAction === "clone-set") {
          cloneSet(set, component);
        } else if (action.dataset.visualAction === "request-delete-set") {
          const confirm = set.querySelector(":scope > .visual-set-controls .visual-set-delete-confirm");
          if (confirm) confirm.hidden = false;
        } else if (action.dataset.visualAction === "cancel-delete-set") {
          const confirm = action.closest(".visual-set-delete-confirm");
          if (confirm) confirm.hidden = true;
        } else if (action.dataset.visualAction === "confirm-delete-set") {
          const parent = set.parentElement;
          const siblings = [...parent.children].filter(child => child.matches(".visual-button-window-pair") || (child.matches(".visual-structure-set") && child.dataset.setFixed !== "true"));
          if (siblings.length <= 1) {
            notify("Mantenha pelo menos um conjunto neste componente.", true);
            const confirm = set.querySelector(":scope > .visual-set-controls .visual-set-delete-confirm");
            if (confirm) confirm.hidden = true;
            return;
          }
          set.remove();
          if (component) renumberSets(component);
          recordHistory(); onChange();
        } else {
          const parent = set.parentElement;
          let sibling = action.dataset.visualAction === "move-set-up" ? set.previousElementSibling : set.nextElementSibling;
          while (sibling && sibling.dataset.setFixed === "true") {
            sibling = action.dataset.visualAction === "move-set-up" ? sibling.previousElementSibling : sibling.nextElementSibling;
          }
          if (sibling && sibling.matches(".visual-structure-set, .visual-button-window-pair")) {
            animateSetReorder(parent, () => {
              if (action.dataset.visualAction === "move-set-up") parent.insertBefore(set, sibling);
              else parent.insertBefore(sibling, set);
            });
            if (component) renumberSets(component);
            recordHistory(); onChange();
          }
        }
      } else if (action.dataset.visualAction === "request-delete" && component) {
        const confirm = component.querySelector(":scope > .visual-component-header > .visual-delete-confirm");
        if (confirm) { confirm.hidden = false; confirm.querySelector("button")?.focus(); }
      } else if (action.dataset.visualAction === "cancel-delete") {
        const confirm = action.closest(".visual-delete-confirm");
        if (confirm) confirm.hidden = true;
      } else if (action.dataset.visualAction === "confirm-delete" && component) {
        const parent = component.parentElement;
        const next = component.nextElementSibling;
        component.remove();
        if (parent === root && next?.matches(".visual-text-block")) focusStart(next);
        refreshEmptyState(); recordHistory(); onChange();
      }
    }

    function onVisualKeydown(event) {
      const modifier = event.ctrlKey || event.metaKey;

      // Em qualquer componente, Tab percorre os campos editáveis sem passar
      // pelos botões de organização; Shift+Tab percorre a mesma sequência ao contrário.
      if (event.key === "Tab" && !modifier && !event.altKey) {
        const seletorCampo = ".visual-slot[contenteditable='true']:not(.visual-mode-source), input:not([type='hidden']):not(:disabled), textarea:not(:disabled), select:not(:disabled)";
        const campoAtual = event.target.closest?.(seletorCampo);
        const componente = campoAtual?.closest(".visual-component");
        if (componente && !componente.classList.contains("is-collapsed")) {
          const campos = [...componente.querySelectorAll(seletorCampo)].filter(campo =>
            campo.closest(".visual-component") === componente &&
            !campo.closest("[hidden]") &&
            !campo.closest(".visual-component.is-collapsed")
          );
          const indiceAtual = campos.indexOf(campoAtual);
          const proximoCampo = campos[indiceAtual + (event.shiftKey ? -1 : 1)];
          if (indiceAtual >= 0 && proximoCampo) {
            event.preventDefault();
            for (let cartao = proximoCampo.closest(".visual-part-card"); cartao && componente.contains(cartao);) {
              if (cartao.classList.contains("is-collapsed")) {
                cartao.classList.remove("is-collapsed");
                const cabecalho = cartao.querySelector(":scope > .visual-part-header");
                cabecalho?.setAttribute("aria-expanded", "true");
                const icone = cabecalho?.querySelector("i");
                icone?.classList.remove("bi-chevron-right");
                icone?.classList.add("bi-chevron-down");
              }
              cartao = cartao.parentElement?.closest(".visual-part-card");
            }
            proximoCampo.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
            if (proximoCampo.matches(".visual-slot[contenteditable='true']")) focusStart(proximoCampo);
            else proximoCampo.focus();
            return;
          }
        }
      }

      // Quando uma imagem está selecionada (com as alças de redimensionamento
      // visíveis), Delete/Backspace remove somente a imagem. No teclado do Mac,
      // a tecla identificada como Delete costuma chegar ao navegador como Backspace.
      if (["Delete", "Backspace"].includes(event.key) && !modifier && !event.altKey && selectedImage?.isConnected && root.contains(selectedImage)) {
        const activeElement = document.activeElement;
        const focusIsControl = activeElement?.matches?.("input, textarea, select, button, [role='button']");
        if (!focusIsControl) {
          event.preventDefault();
          event.stopPropagation();

          const image = selectedImage;
          const slot = image.closest(".visual-slot");
          const textBlock = image.closest(".visual-text-block");
          removeImageResizeOverlay();
          image.remove();

          // Mantém uma área editável quando a imagem era o único conteúdo
          // do campo ou do bloco de texto.
          if (slot && !slot.textContent.trim() && !slot.querySelector("img, .visual-component")) {
            slot.replaceChildren(createEmptyTextBlock(slot.dataset.placeholder || "Digite o conteúdo aqui..."));
          } else if (textBlock && !textBlock.textContent.trim() && !textBlock.querySelector("img, .visual-component")) {
            textBlock.replaceChildren(document.createElement("br"));
            textBlock.classList.add("visual-empty-block");
            textBlock.dataset.placeholder ||= "Continue digitando aqui...";
          }

          refreshEmptyState();
          recordHistory();
          onChange();
          return;
        }
      }

      // Componentes inseridos na estrutura não são apagados pela tecla Delete.
      // Ao alcançar um componente pela borda de um bloco de texto, reposiciona
      // o cursor no texto do outro lado e aplica a exclusão somente ao texto.
      if (["Delete", "Backspace"].includes(event.key) && protectComponentsFromKeyboardDelete(event)) return;

    }

    function onVisualHistoryShortcut(event) {
      const modifier = event.ctrlKey || event.metaKey;
      if (!modifier || event.altKey || mode !== "visual") return;

      const target = event.target;
      const inEditor = root.contains(target) || toolbar?.contains(target);
      if (!inEditor || target.matches?.("input, textarea, select")) return;

      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      event.stopPropagation();
      flushInputHistory();

      if (key === "y" || event.shiftKey) {
        if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1);
      } else if (historyIndex > 0) {
        restoreHistory(historyIndex - 1);
      }
    }

    function setMode(nextMode) {
      const targetMode = nextMode === "visual" ? "visual" : "docx";
      if (targetMode === mode) return;
      if (mode === "docx" && targetMode === "visual") beforeVisualMode();
      if (mode === "visual") {
        textarea.value = getSource();
      }
      if (targetMode === "visual") {
        buildFromSource(textarea.value);
        root.hidden = false;
        if (docxPreview) docxPreview.hidden = true;
      } else {
        root.hidden = true;
        textarea.hidden = true;
        if (docxPreview) docxPreview.hidden = false;
      }
      textarea.hidden = true;
      mode = targetMode;
      visualTab?.classList.toggle("is-active", mode === "visual");
      docxTab?.classList.toggle("is-active", mode === "docx");
      visualTab?.setAttribute("aria-pressed", String(mode === "visual"));
      docxTab?.setAttribute("aria-pressed", String(mode === "docx"));
      if (toolbar) toolbar.hidden = mode !== "visual";
      onChange();
      if (mode === "visual") root.focus(); else docxTab?.focus();
    }

    function rangeAtPoint(event) {
      if (document.caretRangeFromPoint) return document.caretRangeFromPoint(event.clientX, event.clientY);
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(event.clientX, event.clientY);
        if (pos) { const range = document.createRange(); range.setStart(pos.offsetNode, pos.offset); range.collapse(true); return range; }
      }
      return null;
    }

    root.addEventListener("focusin", event => {
      const slot = event.target.closest?.(".visual-slot");
      if (!slot || slot.dataset.clearStarter !== "true") return;
      slot.dataset.clearStarter = "false";
      slot.replaceChildren(createEmptyTextBlock("Digite o conteúdo aqui..."));
      focusEnd(slot);
    });

    function sanitizePastedHtml(html) {
      const template = document.createElement("template");
      template.innerHTML = String(html || "");
      template.content.querySelectorAll("script, style, link, meta, iframe, object, embed").forEach(node => node.remove());
      const elements = [...template.content.querySelectorAll("*")];
      elements.forEach(element => {
        if (element.tagName.toLowerCase() === "o:p") {
          element.remove();
          return;
        }
        [...element.attributes].forEach(attribute => {
          const name = attribute.name.toLowerCase();
          const value = String(attribute.value || "").trim();
          if (name.startsWith("on") || ((name === "href" || name === "src" || name === "xlink:href") && /^\s*(?:javascript|vbscript):/i.test(value))) {
            element.removeAttribute(attribute.name);
          }
        });
        if (/\bMso[A-Z0-9_-]*/.test(element.getAttribute("class") || "")) element.removeAttribute("class");
        // Mantém formatações semânticas (negrito, itálico, sublinhado, cor etc.),
        // mas impede que a origem imponha família ou tamanho de fonte ao Editor.
        element.removeAttribute("face");
        element.removeAttribute("size");
        const style = element.style;
        const fontStyle = style.fontStyle;
        const fontWeight = style.fontWeight;
        const fontVariant = style.fontVariant;
        style.removeProperty("font-family");
        style.removeProperty("font-size");
        style.removeProperty("font");
        [
          "line-height", "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
          "margin-block", "margin-block-start", "margin-block-end", "padding", "padding-top",
          "padding-right", "padding-bottom", "padding-left", "text-indent", "page-break-before",
          "page-break-after", "break-before", "break-after"
        ].forEach(property => style.removeProperty(property));
        for (let index = style.length - 1; index >= 0; index--) {
          const property = style.item(index);
          if (property.startsWith("mso-") || property.startsWith("-o-")) style.removeProperty(property);
        }
        // Se a origem usou a propriedade abreviada `font`, restaura os
        // atributos de ênfase para não perder negrito/itálico ao removê-la.
        if (fontStyle && fontStyle !== "normal") style.fontStyle = fontStyle;
        if (fontWeight && fontWeight !== "normal") style.fontWeight = fontWeight;
        if (fontVariant && fontVariant !== "normal") style.fontVariant = fontVariant;
        if (!style.length) element.removeAttribute("style");
      });

      // Em HTML copiado do Word, a quebra de linha do próprio código-fonte
      // pode aparecer dentro de um texto inline (inclusive no meio de um
      // trecho em negrito). Como a caixa usa `white-space: pre-wrap`, essa
      // indentação seria exibida como uma quebra de linha real. Enter e
      // Shift+Enter vêm como parágrafos e <br>, que permanecem intactos.
      const textWalker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT);
      let textNode;
      while ((textNode = textWalker.nextNode())) {
        if (textNode.parentElement?.closest("pre")) continue;
        textNode.nodeValue = textNode.nodeValue.replace(/[ \t]*\r?\n[ \t]*/g, " ").replace(/\r/g, " ");
      }

      // Word inclui quebras de formatação entre tags de bloco. Como a caixa do
      // Editor preserva whitespace, remova apenas esses nós de indentação;
      // parágrafos vazios e <br> explícitos continuam sendo quebras reais.
      const blockTags = new Set(["P", "DIV", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE"]);
      const containers = [template.content, ...template.content.querySelectorAll("*")];
      containers.forEach(container => {
        const hasBlockChildren = [...container.children].some(child => blockTags.has(child.tagName));
        [...container.childNodes].forEach(node => {
          if (node.nodeType !== Node.TEXT_NODE || node.nodeValue.trim() || !/[\r\n\t]/.test(node.nodeValue)) return;
          if (hasBlockChildren) node.remove();
          else if (node.previousSibling && node.nextSibling) node.nodeValue = " ";
          else node.remove();
        });
      });
      return template.content;
    }

    function serializeClipboardSelection(range) {
      const fragment = range.cloneContents();
      return serializeChildren(fragment).trim();
    }

    function handleInternalCopy(event, cut = false) {
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) return;
      const range = selection.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      const serialized = serializeClipboardSelection(range);
      if (!serialized) return;
      event.preventDefault();
      event.clipboardData?.setData("text/html", serialized);
      // O formato texto deve conter somente o texto visível, nunca os
      // marcadores HTML dos componentes. O formato HTML mantém a estrutura
      // completa para colagem editável dentro de outra janela.
      const plainText = range.cloneContents().textContent || "";
      event.clipboardData?.setData("text/plain", plainText);
      if (cut) {
        range.deleteContents();
        selection.removeAllRanges();
        root.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteByCut" }));
      }
    }

    root.addEventListener("copy", event => handleInternalCopy(event, false));
    root.addEventListener("cut", event => handleInternalCopy(event, true));

    function insertPastedContent(event, target) {
      const clipboard = event.clipboardData;
      if (!clipboard || !target) return false;
      const html = clipboard.getData("text/html");
      const plain = clipboard.getData("text/plain");
      if (!html && !plain) return false;
      event.preventDefault();
      // A colagem é inserida manualmente no DOM, então registra o estado
      // anterior como início de uma operação única de desfazer/refazer.
      flushInputHistory();
      const selection = window.getSelection();
      let range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      if (!range || !root.contains(range.commonAncestorContainer) || !target.contains(range.commonAncestorContainer)) {
        range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
      }
      range.deleteContents();
      let fragment;
      if (html) {
        // Conteúdo copiado de outra janela do Editor carrega os marcadores
        // oficiais dos componentes. Reconstrói esses marcadores como blocos
        // visuais editáveis, em vez de inserir apenas as tags como HTML cru.
      const hasAutomatoComponents = /<(?:componente|botoes|hotword|abas|flashcard|opcoes|verdadeirofalso|forca|jogomemoria|mininavegacao|sanfona|ligapontos|relacionarcolunas|arquivo)\b/i.test(html);
        if (hasAutomatoComponents) {
          const sanitized = document.createElement("div");
          sanitized.appendChild(sanitizePastedHtml(html));
          fragment = parseFlow(sanitized.innerHTML);
        } else {
          fragment = sanitizePastedHtml(html);
        }
      } else {
        fragment = document.createDocumentFragment();
        String(plain).split(/\r?\n/).forEach((line, index) => {
          if (index) fragment.appendChild(document.createElement("br"));
          fragment.appendChild(document.createTextNode(line));
        });
      }
      const last = fragment.lastChild;
      range.insertNode(fragment);
      if (last) {
        range.setStartAfter(last);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
      // Não depende do requestAnimationFrame do evento `input`: Ctrl/Cmd+Z
      // logo após colar já encontra o conteúdo no histórico.
      recordHistory();
      return true;
    }

    root.addEventListener("paste", event => {
      const slot = event.target.closest?.(".visual-slot--rich");
      const textBlock = event.target.closest?.(".visual-text-block");
      const target = slot || textBlock;
      if (!target) return;
      if (insertPastedContent(event, target)) return;
      // Fallback para navegadores que entregam a imagem como item separado,
      // sem disponibilizar uma representação HTML/textual no clipboard.
      if (!slot) return;
      const items = [...(event.clipboardData?.items || [])];
      const imageItem = items.find(item => item.type?.startsWith("image/"));
      const file = imageItem?.getAsFile();
      if (!file) return;
      event.preventDefault();
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      insertImageFile(file, target, range);
    });

    root.addEventListener("drop", event => {
      const slot = event.target.closest?.(".visual-slot--rich");
      const textBlock = event.target.closest?.(".visual-text-block");
      const target = slot || textBlock;
      const file = [...(event.dataTransfer?.files || [])].find(item => item.type?.startsWith("image/"));
      if (!target || !file) return;
      event.preventDefault();
      event.stopPropagation();
      const range = rangeAtPoint(event);
      insertImageFile(file, target, range);
    }, true);

    root.addEventListener("input", event => {
      const textInput = event.target.closest?.(".visual-video-label-input, .visual-arquivo-label-input");
      if (textInput) textInput.setAttribute("value", textInput.value);
      if (inputFrame) cancelAnimationFrame(inputFrame);
      inputFrame = requestAnimationFrame(() => { inputFrame = 0; refreshEmptyState(); recordHistory(); onChange(); });
    });
    root.addEventListener("click", onVisualClick);
    root.addEventListener("keydown", onVisualKeydown);
    document.addEventListener("keydown", onVisualHistoryShortcut, true);
    root.addEventListener("keyup", rememberSelection);
    root.addEventListener("mouseup", rememberSelection);
    root.addEventListener("focusin", rememberSelection);
    document.addEventListener("selectionchange", rememberSelection);
    toolbar?.addEventListener("focusin", () => updateToolbarState());

    // Componentes já inseridos também podem ser reorganizados pelo cabeçalho.
    // O movimento fica restrito ao mesmo nível hierárquico para não desmontar slots.
    let draggedVisualComponent = null;
    root.addEventListener("dragstart", event => {
      const header = event.target.closest?.(".visual-component-header");
      const component = header?.closest(".visual-component");
      if (!component || !root.contains(component)) return;
      if (event.target.closest("button")) { event.preventDefault(); return; }
      draggedVisualComponent = component;
      component.classList.add("is-being-dragged");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-automato-existing-component", "move");
    });
    root.addEventListener("dragend", () => {
      draggedVisualComponent?.classList.remove("is-being-dragged", "is-reorder-target");
      root.querySelectorAll(".is-reorder-target").forEach(node => node.classList.remove("is-reorder-target"));
      draggedVisualComponent = null;
    });
    function paragraphDropTarget(event) {
      const textBlock = event.target.closest?.(".visual-text-block");
      if (!textBlock || !root.contains(textBlock)) return null;
      const paragraph = event.target.closest?.("p, li, h1, h2, h3, h4, h5, h6, blockquote, pre");
      return paragraph && textBlock.contains(paragraph)
        ? { textBlock, paragraph }
        : { textBlock, paragraph: null };
    }

    function splitTextBlockAtParagraph(textBlock, paragraph, insertAfter, component) {
      const parent = textBlock.parentNode;
      if (!parent || !paragraph || !textBlock.contains(paragraph)) return false;
      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(textBlock);
      beforeRange.setEndBefore(paragraph);
      const afterRange = document.createRange();
      afterRange.selectNodeContents(textBlock);
      afterRange.setStartAfter(paragraph);
      const beforeFragment = beforeRange.cloneContents();
      const afterFragment = afterRange.cloneContents();
      const makeTextBlock = fragment => {
        if (!fragment.childNodes.length) return null;
        const block = document.createElement("div");
        block.className = "visual-text-block";
        block.setAttribute("contenteditable", "true");
        block.appendChild(fragment);
        return block;
      };
      const beforeBlock = makeTextBlock(beforeFragment);
      const afterBlock = makeTextBlock(afterFragment);
      if (insertAfter) {
        const destination = beforeBlock || document.createElement("div");
        destination.classList.add("visual-text-block");
        destination.setAttribute("contenteditable", "true");
        destination.appendChild(paragraph);
        if (!beforeBlock) parent.insertBefore(destination, textBlock);
      } else {
        const destination = afterBlock || document.createElement("div");
        destination.classList.add("visual-text-block");
        destination.setAttribute("contenteditable", "true");
        destination.insertBefore(paragraph, destination.firstChild);
        if (!afterBlock) parent.insertBefore(destination, textBlock.nextSibling);
      }
      if (beforeBlock) parent.insertBefore(beforeBlock, textBlock);
      parent.insertBefore(component, textBlock);
      if (afterBlock) parent.insertBefore(afterBlock, textBlock.nextSibling);
      textBlock.remove();
      return true;
    }

    root.addEventListener("dragover", event => {
      if (event.dataTransfer?.types?.includes("application/x-automato-existing-component") && draggedVisualComponent) {
        const targetComponent = event.target.closest?.(".visual-component");
        const paragraphTarget = paragraphDropTarget(event);
        const target = targetComponent || paragraphTarget?.paragraph || paragraphTarget?.textBlock;
        if (target && target !== draggedVisualComponent && !draggedVisualComponent.contains(target)
          && (targetComponent ? target.parentElement === draggedVisualComponent.parentElement
            : paragraphTarget?.textBlock.parentElement === draggedVisualComponent.parentElement)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          root.querySelectorAll(".is-reorder-target").forEach(node => node.classList.remove("is-reorder-target"));
          target.classList.add("is-reorder-target");
        }
      }
      if (event.dataTransfer?.types?.includes("application/x-automato-component")) {
        event.preventDefault();
        root.classList.add("is-drop-target");
      }
    });
    root.addEventListener("drop", event => {
      if (!draggedVisualComponent || !event.dataTransfer?.types?.includes("application/x-automato-existing-component")) return;
      const targetComponent = event.target.closest?.(".visual-component");
      const paragraphTarget = paragraphDropTarget(event);
      const targetParagraph = !targetComponent ? paragraphTarget?.paragraph : null;
      const targetBlock = !targetComponent && !targetParagraph ? paragraphTarget?.textBlock : null;
      const target = targetComponent || targetParagraph || targetBlock;
      if (!target || target === draggedVisualComponent || draggedVisualComponent.contains(target)) return;
      event.preventDefault();
      event.stopPropagation();
      let moved = false;
      if (targetParagraph && paragraphTarget.textBlock.parentElement === draggedVisualComponent.parentElement) {
        const rect = targetParagraph.getBoundingClientRect();
        const insertAfter = event.clientY > rect.top + rect.height / 2;
        moved = splitTextBlockAtParagraph(paragraphTarget.textBlock, targetParagraph, insertAfter, draggedVisualComponent);
      } else if ((targetComponent || targetBlock) && target.parentElement === draggedVisualComponent.parentElement) {
        const rect = target.getBoundingClientRect();
        const insertAfter = event.clientY > rect.top + rect.height / 2;
        target.parentNode.insertBefore(draggedVisualComponent, insertAfter ? target.nextSibling : target);
        moved = true;
      }
      if (!moved) return;
      draggedVisualComponent.classList.remove("is-being-dragged");
      root.querySelectorAll(".is-reorder-target").forEach(node => node.classList.remove("is-reorder-target"));
      draggedVisualComponent = null;
      refreshEmptyState();
      ensureRootTextGaps();
      recordHistory();
      onChange();
    });

    root.addEventListener("dragover", event => {
      if (event.dataTransfer?.types?.includes("application/x-automato-component")) {
        event.preventDefault();
        root.classList.add("is-drop-target");
      }
    });
    root.addEventListener("dragleave", event => {
      if (!root.contains(event.relatedTarget)) root.classList.remove("is-drop-target");
    });
    root.addEventListener("drop", event => {
      const slug = event.dataTransfer?.getData("application/x-automato-component");
      if (!slug) return;
      event.preventDefault();
      root.classList.remove("is-drop-target");
      let range = rangeAtPoint(event);
      if (range && root.contains(range.startContainer)) {
        const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
          ? range.startContainer : range.startContainer.parentElement;
        const editableSlot = startElement?.closest(".visual-slot, .visual-text-block");
        if (!editableSlot) {
          const owner = startElement?.closest(".visual-component");
          const fallbackSlot = owner?.querySelector(".visual-slot:last-of-type") || root;
          range = document.createRange();
          range.selectNodeContents(fallbackSlot);
          range.collapse(false);
        }
        insertComponent(slug, range);
      } else insertComponent(slug, targetRange());
    });

    root.addEventListener("mousedown", event => {
      const button = event.target.closest("button");
      if (button && !button.matches("[data-visual-action='add-pair'], [data-visual-action='toggle'], [data-visual-action='toggle-pencil'], [data-visual-action='toggle-part'], [data-visual-action^='move-set-'], [data-visual-action$='set']")) event.preventDefault();
    });

    if (toolbar) {
      // Impede que o foco do botão roube a seleção do texto antes do comando.
      toolbar.addEventListener("mousedown", event => {
        if (!event.target.closest("button")) return;
        rememberSelection();
        event.preventDefault();
      });
      toolbar.addEventListener("click", event => {
        const button = event.target.closest("[data-editor-format]");
        if (!button) return;
        const format = button.dataset.editorFormat;
        let value = "";
        if (format === "link") {
          value = window.prompt("Informe a URL do link (ele será aberto em uma nova aba):", "https://");
          if (value === null || !value.trim()) return;
        }
        formatSelection(format, value);
      });
    }

    visualTab?.addEventListener("click", () => setMode("visual"));
    docxTab?.addEventListener("click", () => setMode("docx"));

    function bindLibrary(list) {
      if (!list) return;
      libraryList = list;
      list.querySelectorAll("[data-component]").forEach(button => {
        button.draggable = true;
        button.addEventListener("dragstart", event => {
          event.dataTransfer.setData("application/x-automato-component", button.dataset.component);
          event.dataTransfer.effectAllowed = "copy";
          button.classList.add("is-dragging-component");
        });
        button.addEventListener("dragend", () => button.classList.remove("is-dragging-component"));
        button.addEventListener("mousedown", event => {
          if (mode === "visual") {
            rememberSelection();
            // Não cancela o mousedown dos itens arrastáveis: isso bloquearia
            // o início do drag-and-drop. A seleção anterior fica guardada.
            if (event.button === 0 && !button.draggable) event.preventDefault();
          }
        });
      });
      list.addEventListener("click", event => {
        const button = event.target.closest("[data-component]");
        if (!button) return;
        const slug = button.dataset.component;
        if (mode === "visual") insertComponent(slug, targetRange());
      });
    }

    function onRawInput() { onChange(); }

    buildFromSource(textarea.value || "");
    root.hidden = false;
    textarea.hidden = true;
    visualTab?.classList.add("is-active");
    docxTab?.classList.remove("is-active");
    visualTab?.setAttribute("aria-pressed", "true");
    docxTab?.setAttribute("aria-pressed", "false");

    return {
      getSource, buildFromSource, setMode, insertComponent, insertComponentMarkup, insertContentMarkup, bindLibrary,
      formatSelection, insertImage, rememberSelection,
      getMode: () => mode, undo, redo, focus: () => mode === "visual" ? root.focus() : textarea.focus(),
      onRawInput
    };
  }

  window.AutomatoVisualStructure = { create };
})();
