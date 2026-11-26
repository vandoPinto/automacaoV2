/*
 * Escrita do conteúdo do Editor de Componentes de volta ao DOCX original.
 * Mantém o pacote OOXML existente e substitui somente as linhas de tela que
 * foram alteradas; cabeçalhos, estilos de página e demais partes do arquivo
 * permanecem intactos.
 */
(() => {
  "use strict";

  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const REL = "http://schemas.openxmlformats.org/package/2006/relationships";
  const CT = "http://schemas.openxmlformats.org/package/2006/content-types";
  const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
  const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";
  const XML = "http://www.w3.org/XML/1998/namespace";
  const W_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const W_HYPERLINK_REL = `${W_REL}/hyperlink`;
  const W_IMAGE_REL = `${W_REL}/image`;
  const EMU_PER_INCH = 914400;

  const el = (doc, ns, prefix, name) => doc.createElementNS(ns, `${prefix}:${name}`);
  const setW = (node, name, value) => node.setAttributeNS(W, `w:${name}`, String(value));
  const appendText = (doc, parent, value) => {
    const run = el(doc, W, "w", "r");
    const text = el(doc, W, "w", "t");
    text.setAttributeNS(XML, "xml:space", "preserve");
    text.appendChild(doc.createTextNode(String(value ?? "")));
    run.appendChild(text);
    parent.appendChild(run);
    return run;
  };
  const directChildren = (node, localName) => [...(node?.children || [])].filter(child => child.localName === localName);
  const directRows = table => directChildren(table, "tr");
  const directCells = row => directChildren(row, "tc");
  const directParagraphs = cell => directChildren(cell, "p");
  const textOf = node => [...(node?.getElementsByTagNameNS(W, "t") || [])].map(item => item.textContent || "").join("").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");

  function firstTableCellText(table) {
    const firstRow = directRows(table)[0];
    const cells = directCells(firstRow);
    return cells.map(textOf);
  }

  function findTopicTable(xmlDocument, title) {
    const body = xmlDocument.getElementsByTagNameNS(W, "body")[0];
    const expected = normalize(title);
    return directChildren(body, "tbl").find(table => {
      const header = firstTableCellText(table);
      return header.length >= 2 && normalize(header[1]) === expected;
    }) || null;
  }

  function makeParagraph(doc, text = "") {
    const paragraph = el(doc, W, "w", "p");
    if (text !== "") appendText(doc, paragraph, text);
    return paragraph;
  }

  function runProperties(doc, element, inherited = {}) {
    const style = { ...inherited };
    const tag = String(element?.tagName || "").toLowerCase();
    if (tag === "b" || tag === "strong") style.bold = true;
    if (tag === "i" || tag === "em") style.italic = true;
    if (tag === "u") style.underline = true;
    const inline = String(element?.getAttribute?.("style") || "");
    const weight = inline.match(/font-weight\s*:\s*([^;]+)/i)?.[1]?.trim();
    if (weight && (weight === "bold" || Number.parseInt(weight, 10) >= 600)) style.bold = true;
    if (/font-style\s*:\s*italic/i.test(inline)) style.italic = true;
    if (/text-decoration[^;]*underline/i.test(inline)) style.underline = true;
    const color = inline.match(/(?:^|;)\s*color\s*:\s*(#[\da-f]{3,8}|[\w]+)/i)?.[1];
    if (color) style.color = color;
    const size = inline.match(/font-size\s*:\s*([\d.]+)(pt|px)?/i);
    if (size) style.size = Number(size[1]) * (size[2]?.toLowerCase() === "px" ? 0.75 : 1);
    const family = inline.match(/font-family\s*:\s*([^;]+)/i)?.[1]?.replace(/["']/g, "").trim();
    if (family) style.family = family.split(",")[0].trim();
    if (style.href == null && tag === "a") {
      const href = String(element.getAttribute("href") || "").trim();
      if (/^(?:https?:|mailto:)/i.test(href)) style.href = href;
    }
    return style;
  }

  function createStyledRun(doc, text, style = {}) {
    const run = el(doc, W, "w", "r");
    const props = el(doc, W, "w", "rPr");
    let hasProps = false;
    if (style.bold) { props.appendChild(el(doc, W, "w", "b")); hasProps = true; }
    if (style.italic) { props.appendChild(el(doc, W, "w", "i")); hasProps = true; }
    if (style.underline) {
      const underline = el(doc, W, "w", "u"); setW(underline, "val", "single"); props.appendChild(underline); hasProps = true;
    }
    if (style.color) {
      const color = el(doc, W, "w", "color");
      const normalized = String(style.color).replace(/^#/, "").toLowerCase();
      if (/^[\da-f]{3}$/.test(normalized)) setW(color, "val", normalized.split("").map(ch => ch + ch).join(""));
      else if (/^[\da-f]{6}$/.test(normalized)) setW(color, "val", normalized);
      else if (normalized === "white") setW(color, "val", "FFFFFF");
      else if (normalized === "black") setW(color, "val", "000000");
      else color.setAttributeNS(W, "w:val", "000000");
      props.appendChild(color); hasProps = true;
    }
    if (Number.isFinite(style.size) && style.size > 0) {
      const size = el(doc, W, "w", "sz"); setW(size, "val", Math.round(style.size * 2)); props.appendChild(size); hasProps = true;
    }
    if (style.family) {
      const fonts = el(doc, W, "w", "rFonts");
      setW(fonts, "ascii", style.family); setW(fonts, "hAnsi", style.family); props.appendChild(fonts); hasProps = true;
    }
    if (hasProps) run.appendChild(props);
    const node = el(doc, W, "w", "t");
    node.setAttributeNS(XML, "xml:space", "preserve");
    node.appendChild(doc.createTextNode(String(text ?? "")));
    run.appendChild(node);
    return run;
  }

  function addRelationship(state, target, type, external = true) {
    const rels = state.relationships;
    let id = state.nextRelationshipId++;
    const relationship = rels.createElementNS(REL, "Relationship");
    relationship.setAttribute("Id", `rId${id}`);
    relationship.setAttribute("Type", type);
    relationship.setAttribute("Target", target);
    if (external) relationship.setAttribute("TargetMode", "External");
    rels.documentElement.appendChild(relationship);
    return `rId${id}`;
  }

  function appendStyledText(doc, paragraph, text, style, state) {
    if (style.href) {
      const hyperlink = el(doc, W, "w", "hyperlink");
      hyperlink.setAttributeNS(R, "r:id", addRelationship(state, style.href, W_HYPERLINK_REL));
      hyperlink.appendChild(createStyledRun(doc, text, style));
      paragraph.appendChild(hyperlink);
      return;
    }
    paragraph.appendChild(createStyledRun(doc, text, style));
  }

  async function paragraphFromElement(doc, element, state, baseStyle = {}) {
    const paragraph = makeParagraph(doc);
    const align = element.getAttribute?.("align") || String(element.getAttribute?.("style") || "").match(/text-align\s*:\s*(left|right|center|justify)/i)?.[1];
    let paragraphProps = null;
    if (align) {
      paragraphProps = el(doc, W, "w", "pPr");
      const jc = el(doc, W, "w", "jc");
      setW(jc, "val", align.toLowerCase()); paragraphProps.appendChild(jc); paragraph.appendChild(paragraphProps);
    }
    if (/^h[1-6]$/i.test(element.tagName || "")) {
      paragraphProps = paragraphProps || el(doc, W, "w", "pPr");
      if (!paragraphProps.parentNode) paragraph.appendChild(paragraphProps);
      const styleId = state.headingStyleId(Number(element.tagName.slice(1)));
      if (styleId) {
        const style = el(doc, W, "w", "pStyle");
        setW(style, "val", styleId);
        paragraphProps.insertBefore(style, paragraphProps.firstChild);
      }
    }
    await appendInlineChildren(doc, paragraph, element, state, baseStyle);
    if (!paragraph.childNodes.length || !paragraph.getElementsByTagNameNS(W, "r").length) paragraph.appendChild(el(doc, W, "w", "r"));
    return paragraph;
  }

  async function imageDrawing(doc, image, state) {
    const src = String(image.getAttribute("src") || "");
    let supportedSrc = src;
    let match = supportedSrc.match(/^data:(image\/[\w.+-]+);base64,([\s\S]+)$/i);
    if (!match) return null;
    let mime = match[1].toLowerCase();
    let ext = ({ "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/gif": "gif", "image/bmp": "bmp" })[mime];
    if (!ext && ["image/webp", "image/svg+xml"].includes(mime)) {
      supportedSrc = await convertToPngDataUrl(src);
      match = supportedSrc?.match(/^data:image\/png;base64,([\s\S]+)$/i);
      if (match) { mime = "image/png"; ext = "png"; }
    }
    if (!ext) return null;
    const base64 = (mime === "image/png" && match.length === 2 ? match[1] : match[2]).replace(/\s/g, "");
    const fileName = `${state.imagePrefix}-${state.imageCounter++}.${ext}`;
    const target = `media/${fileName}`;
    state.zip.file(`word/${target}`, base64, { base64: true });
    state.ensureContentType(ext, mime);
    const relationId = addRelationship(state, target, W_IMAGE_REL, false);
    const imageSize = await state.measureImage(supportedSrc);
    const maxWidth = 6.1 * EMU_PER_INCH;
    const maxHeight = 8.2 * EMU_PER_INCH;
    const ratio = Math.min(maxWidth / imageSize.width, maxHeight / imageSize.height, 1);
    const cx = Math.max(1, Math.round(imageSize.width * ratio));
    const cy = Math.max(1, Math.round(imageSize.height * ratio));
    const drawing = el(doc, W, "w", "drawing");
    const inline = el(doc, WP, "wp", "inline");
    ["distT", "distB", "distL", "distR"].forEach(name => inline.setAttribute(name, "0"));
    const extent = el(doc, WP, "wp", "extent"); extent.setAttribute("cx", String(cx)); extent.setAttribute("cy", String(cy));
    const drawingId = state.nextDrawingId++;
    const docPr = el(doc, WP, "wp", "docPr"); docPr.setAttribute("id", String(drawingId)); docPr.setAttribute("name", fileName);
    const frame = el(doc, WP, "wp", "cNvGraphicFramePr");
    const locks = el(doc, A, "a", "graphicFrameLocks"); locks.setAttribute("noChangeAspect", "1"); frame.appendChild(locks);
    const graphic = el(doc, A, "a", "graphic");
    const graphicData = el(doc, A, "a", "graphicData"); graphicData.setAttribute("uri", PIC);
    const picture = el(doc, PIC, "pic", "pic");
    const nonVisual = el(doc, PIC, "pic", "nvPicPr");
    const pictureId = el(doc, PIC, "pic", "cNvPr"); pictureId.setAttribute("id", String(drawingId)); pictureId.setAttribute("name", fileName);
    if (image.getAttribute("alt")) pictureId.setAttribute("descr", image.getAttribute("alt"));
    const pictureProps = el(doc, PIC, "pic", "cNvPicPr");
    nonVisual.append(pictureId, pictureProps);
    const fill = el(doc, PIC, "pic", "blipFill");
    const blip = el(doc, A, "a", "blip"); blip.setAttributeNS(R, "r:embed", relationId); fill.appendChild(blip);
    const stretch = el(doc, A, "a", "stretch"); stretch.appendChild(el(doc, A, "a", "fillRect")); fill.appendChild(stretch);
    const shape = el(doc, PIC, "pic", "spPr");
    const transform = el(doc, A, "a", "xfrm");
    const offset = el(doc, A, "a", "off"); offset.setAttribute("x", "0"); offset.setAttribute("y", "0");
    const shapeExtent = el(doc, A, "a", "ext"); shapeExtent.setAttribute("cx", String(cx)); shapeExtent.setAttribute("cy", String(cy));
    transform.append(offset, shapeExtent);
    const geometry = el(doc, A, "a", "prstGeom"); geometry.setAttribute("prst", "rect"); geometry.appendChild(el(doc, A, "a", "avLst"));
    shape.append(transform, geometry);
    picture.append(nonVisual, fill, shape); graphicData.appendChild(picture); graphic.appendChild(graphicData);
    inline.append(extent, docPr, frame, graphic); drawing.appendChild(inline);
    return drawing;
  }

  function convertToPngDataUrl(src) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = image.naturalWidth || 800;
          canvas.height = image.naturalHeight || 600;
          canvas.getContext("2d").drawImage(image, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch (_) { resolve(""); }
      };
      image.onerror = () => resolve("");
      image.src = src;
    });
  }

  function readImageDimensions(src) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => {
        const width = image.naturalWidth || 800;
        const height = image.naturalHeight || 600;
        resolve({ width: width * 9525, height: height * 9525 });
      };
      image.onerror = () => resolve({ width: 800 * 9525, height: 600 * 9525 });
      image.src = src;
    });
  }

  async function appendInlineChildren(doc, parent, source, state, inherited = {}) {
    for (const child of [...source.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.nodeValue) {
          const parts = child.nodeValue.split(/\r\n?|\n/);
          parts.forEach((part, index) => {
            if (part) appendStyledText(doc, parent, part, inherited, state);
            if (index < parts.length - 1) { const run = el(doc, W, "w", "r"); run.appendChild(el(doc, W, "w", "br")); parent.appendChild(run); }
          });
        }
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = String(child.tagName || "").toLowerCase();
      const style = runProperties(child, inherited);
      if (tag === "br") { const run = el(doc, W, "w", "r"); run.appendChild(el(doc, W, "w", "br")); parent.appendChild(run); continue; }
      if (tag === "img") {
        const drawing = await imageDrawing(doc, child, state);
        if (drawing) { const run = el(doc, W, "w", "r"); run.appendChild(drawing); parent.appendChild(run); }
        else appendStyledText(doc, parent, child.getAttribute("alt") || "[imagem]", style, state);
        continue;
      }
      await appendInlineChildren(doc, parent, child, state, style);
    }
  }

  function styleValue(element, property) {
    const expression = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, "i");
    return String(element?.getAttribute?.("style") || "").match(expression)?.[1]?.trim() || "";
  }

  function setCellShading(doc, cellProperties, element) {
    const raw = element.getAttribute("bgcolor") || styleValue(element, "background-color") || styleValue(element, "background");
    const color = raw.match(/#[\da-f]{3,8}|\b[a-z]{3,20}\b/i)?.[0];
    if (!color || /transparent|none/i.test(color)) return;
    const hex = colorToHex(color);
    if (!hex) return;
    const shading = el(doc, W, "w", "shd"); setW(shading, "val", "clear"); setW(shading, "color", "auto"); setW(shading, "fill", hex);
    cellProperties.appendChild(shading);
  }

  function colorToHex(color) {
    const value = String(color || "").trim().toLowerCase();
    if (/^#[\da-f]{6}$/.test(value)) return value.slice(1).toUpperCase();
    if (/^#[\da-f]{3}$/.test(value)) return value.slice(1).split("").map(ch => ch + ch).join("").toUpperCase();
    const named = { white: "FFFFFF", black: "000000", red: "FF0000", blue: "0000FF", green: "008000", gray: "808080", grey: "808080" };
    return named[value] || "";
  }

  function setCellBorders(doc, cellProperties, color = "7F7F7F") {
    const borders = el(doc, W, "w", "tcBorders");
    for (const side of ["top", "left", "bottom", "right"]) {
      const border = el(doc, W, "w", side); setW(border, "val", "single"); setW(border, "sz", "4"); setW(border, "space", "0"); setW(border, "color", color); borders.appendChild(border);
    }
    cellProperties.appendChild(borders);
  }

  async function appendBlocks(doc, parent, nodes, state) {
    let inlineGroup = [];
    const flushInline = async () => {
      if (!inlineGroup.length) return;
      const paragraph = makeParagraph(doc);
      const wrapper = doc.createElement("div");
      inlineGroup.forEach(node => wrapper.appendChild(node.cloneNode(true)));
      await appendInlineChildren(doc, paragraph, wrapper, state, {});
      parent.appendChild(paragraph);
      inlineGroup = [];
    };
    for (const node of [...nodes]) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.nodeValue?.trim()) inlineGroup.push(node);
        else if (inlineGroup.length) inlineGroup.push(node);
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = String(node.tagName || "").toLowerCase();
      if (["table", "p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "blockquote", "pre"].includes(tag)) {
        await flushInline();
        if (tag === "table") {
          const table = await buildWordTable(doc, node, state);
          // Word expects a paragraph before a nested table when the cell starts with that table.
          // Preserve the empty paragraph that would otherwise be dropped by the HTML editor.
          if (parent.localName === "tc" && parent.lastChild?.localName !== "p") {
            parent.appendChild(makeParagraph(doc));
          } else if (parent.lastChild?.localName === "tbl") {
            parent.appendChild(makeParagraph(doc));
          }
          parent.appendChild(table);
          parent.appendChild(makeParagraph(doc));
        } else if (tag === "ul" || tag === "ol") {
          for (const item of [...node.children].filter(child => child.tagName.toLowerCase() === "li")) {
            const paragraph = makeParagraph(doc);
            const prefix = doc.createTextNode(tag === "ol" ? "1. " : "• ");
            const wrapper = doc.createElement("span"); wrapper.appendChild(prefix); wrapper.append(...[...item.childNodes].map(child => child.cloneNode(true)));
            await appendInlineChildren(doc, paragraph, wrapper, state, {}); parent.appendChild(paragraph);
          }
        } else if (tag === "blockquote" || tag === "pre") {
          parent.appendChild(await paragraphFromElement(doc, node, state, { italic: tag === "blockquote", family: tag === "pre" ? "Courier New" : undefined }));
        } else parent.appendChild(await paragraphFromElement(doc, node, state));
        continue;
      }
      if (tag === "div" || tag === "section" || tag === "figure") {
        const hasBlockChildren = [...node.children].some(child => ["table", "p", "div", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6"].includes(child.tagName.toLowerCase()));
        if (hasBlockChildren) {
          await flushInline();
          await appendBlocks(doc, parent, [...node.childNodes], state);
        } else inlineGroup.push(node);
        continue;
      }
      inlineGroup.push(node);
    }
    await flushInline();
    if (parent.localName === "tc") {
      const hasWordBlock = [...parent.childNodes].some(child =>
        child.nodeType === Node.ELEMENT_NODE && ["p", "tbl"].includes(child.localName)
      );
      if (!hasWordBlock || parent.lastChild?.localName === "tbl") parent.appendChild(makeParagraph(doc));
    } else if (!parent.lastChild || parent.lastChild.localName === "tbl") {
      parent.appendChild(makeParagraph(doc));
    }
  }

  async function buildWordTable(doc, htmlTable, state) {
    const table = el(doc, W, "w", "tbl");
    const properties = el(doc, W, "w", "tblPr");
    const width = el(doc, W, "w", "tblW"); setW(width, "w", "5000"); setW(width, "type", "pct"); properties.appendChild(width);
    const layout = el(doc, W, "w", "tblLayout"); setW(layout, "type", "fixed"); properties.appendChild(layout);
    const borders = el(doc, W, "w", "tblBorders");
    for (const side of ["top", "left", "bottom", "right", "insideH", "insideV"]) {
      const border = el(doc, W, "w", side); setW(border, "val", "single"); setW(border, "sz", "4"); setW(border, "space", "0"); setW(border, "color", "666666"); borders.appendChild(border);
    }
    properties.appendChild(borders); table.appendChild(properties);
    const rows = [...htmlTable.querySelectorAll("tr")].filter(row => row.closest("table") === htmlTable);
    const firstRow = rows[0];
    const firstCells = [...(firstRow?.children || [])].filter(cell => /^(TD|TH)$/.test(cell.tagName));
    const columnTags = [...(htmlTable.querySelector("colgroup")?.children || [])].filter(item => item.tagName === "COL");
    const columnCount = Math.max(1, columnTags.length || Math.max(1, ...rows.map(row => [...row.children].filter(cell => /^(TD|TH)$/.test(cell.tagName)).reduce((sum, cell) => sum + Math.max(1, Number(cell.colSpan) || 1), 0))));
    const grid = el(doc, W, "w", "tblGrid");
    const widths = columnTags.length
      ? columnTags.map(item => percentageWidth(styleValue(item, "width") || item.getAttribute("width"), 9000 / columnCount))
      : Array.from({ length: columnCount }, () => 9000 / columnCount);
    for (const widthValue of widths) { const gridCol = el(doc, W, "w", "gridCol"); setW(gridCol, "w", Math.round(widthValue)); grid.appendChild(gridCol); }
    table.appendChild(grid);
    for (const htmlRow of rows) {
      const row = el(doc, W, "w", "tr");
      let column = 0;
      for (const htmlCell of [...htmlRow.children].filter(cell => /^(TD|TH)$/.test(cell.tagName))) {
        const cell = el(doc, W, "w", "tc");
        const props = el(doc, W, "w", "tcPr");
        const span = Math.max(1, Number(htmlCell.colSpan) || 1);
        const tcWidth = widths.slice(column, column + span).reduce((sum, item) => sum + item, 0) || 9000 / columnCount;
        const cellWidth = el(doc, W, "w", "tcW"); setW(cellWidth, "w", Math.round(tcWidth)); setW(cellWidth, "type", "dxa"); props.appendChild(cellWidth);
        if (span > 1) { const gridSpan = el(doc, W, "w", "gridSpan"); setW(gridSpan, "val", span); props.appendChild(gridSpan); }
        setCellShading(doc, props, htmlCell);
        setCellBorders(doc, props);
        cell.appendChild(props);
        await appendBlocks(doc, cell, [...htmlCell.childNodes], state);
        row.appendChild(cell); column += span;
      }
      table.appendChild(row);
    }
    if (rows.length && firstCells.length) return table;
    const row = el(doc, W, "w", "tr"); const cell = el(doc, W, "w", "tc");
    cell.appendChild(el(doc, W, "w", "tcPr")); cell.appendChild(makeParagraph(doc)); row.appendChild(cell); table.appendChild(row);
    return table;
  }

  function percentageWidth(value, fallback) {
    const numeric = Number.parseFloat(String(value || "").replace("%", ""));
    return Number.isFinite(numeric) && numeric > 0 ? 9000 * numeric / 100 : fallback;
  }

  async function replaceCellContent(doc, cell, html, state) {
    const properties = directChildren(cell, "tcPr")[0] || null;
    for (const child of [...cell.childNodes]) if (child !== properties) cell.removeChild(child);
    const fragment = document.createElement("template");
    fragment.innerHTML = String(html || "");
    await appendBlocks(doc, cell, [...fragment.content.childNodes], state);
  }

  function setCellText(doc, cell, text) {
    const properties = directChildren(cell, "tcPr")[0] || null;
    for (const child of [...cell.childNodes]) if (child !== properties) cell.removeChild(child);
    cell.appendChild(makeParagraph(doc, String(text || "")));
  }

  function imageReader(src) {
    return new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve({ width: (image.naturalWidth || 800) * 9525, height: (image.naturalHeight || 600) * 9525 });
      image.onerror = () => resolve({ width: 800 * 9525, height: 600 * 9525 });
      image.src = src;
    });
  }

  function findHeadingStyleId(stylesDocument, level) {
    if (!stylesDocument) return "";
    const styles = [...stylesDocument.getElementsByTagNameNS(W, "style")]
      .filter(style => style.getAttributeNS(W, "type") === "paragraph");
    const expectedNames = new Set([`heading ${level}`, `titulo ${level}`]);
    const namedStyle = styles.find(style => {
      const name = directChildren(style, "name")[0]?.getAttributeNS(W, "val") || "";
      return expectedNames.has(normalize(name));
    });
    if (namedStyle) return namedStyle.getAttributeNS(W, "styleId") || "";

    const expectedIds = new Set([`heading${level}`, `titulo${level}`]);
    const idStyle = styles.find(style => expectedIds.has(normalize(style.getAttributeNS(W, "styleId"))));
    return idStyle?.getAttributeNS(W, "styleId") || "";
  }

  function normalizeHeadingStyleReferences(xmlDocument, stylesDocument) {
    if (!stylesDocument) return;
    const availableStyleIds = new Set(
      [...stylesDocument.getElementsByTagNameNS(W, "style")]
        .map(style => style.getAttributeNS(W, "styleId"))
        .filter(Boolean)
    );
    for (const styleReference of [...xmlDocument.getElementsByTagNameNS(W, "pStyle")]) {
      const currentId = styleReference.getAttributeNS(W, "val");
      if (!/^Heading([1-6])$/i.test(currentId) || availableStyleIds.has(currentId)) continue;
      const level = Number(currentId.match(/[1-6]$/)?.[0]);
      const replacementId = findHeadingStyleId(stylesDocument, level);
      if (replacementId) setW(styleReference, "val", replacementId);
      else styleReference.parentNode?.removeChild(styleReference);
    }
  }

  function packageState(zip, xmlDocument) {
    const relFile = zip.file("word/_rels/document.xml.rels");
    const typesFile = zip.file("[Content_Types].xml");
    const stylesFile = zip.file("word/styles.xml");
    return Promise.all([
      relFile ? relFile.async("string") : Promise.resolve(`<Relationships xmlns="${REL}"/>`),
      typesFile.async("string"),
      stylesFile ? stylesFile.async("string") : Promise.resolve("")
    ]).then(([relXml, typesXml, stylesXml]) => {
      const parser = new DOMParser();
      const relationships = parser.parseFromString(relXml, "application/xml");
      const contentTypes = parser.parseFromString(typesXml, "application/xml");
      const stylesDocument = stylesXml ? parser.parseFromString(stylesXml, "application/xml") : null;
      if (relationships.querySelector("parsererror") || contentTypes.querySelector("parsererror") || stylesDocument?.querySelector("parsererror")) throw new Error("O pacote DOCX tem relações ou estilos inválidos.");
      const ids = [...relationships.getElementsByTagNameNS(REL, "Relationship")].map(item => Number((item.getAttribute("Id") || "").replace(/^rId/, ""))).filter(Number.isFinite);
      const drawingIds = [...xmlDocument.getElementsByTagNameNS(WP, "docPr")].map(item => Number(item.getAttribute("id"))).filter(Number.isFinite);
      const state = {
        zip, xmlDocument, relationships, contentTypes, stylesDocument,
        nextRelationshipId: Math.max(0, ...ids) + 1,
        imageCounter: Date.now() % 100000,
        imagePrefix: `automato-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        nextDrawingId: Math.max(0, ...drawingIds) + 1,
        headingStyleId(level) { return findHeadingStyleId(stylesDocument, level); },
        measureImage: imageReader,
        ensureContentType(extension, mime) {
          const exists = [...contentTypes.getElementsByTagNameNS(CT, "Default")].some(item => item.getAttribute("Extension").toLowerCase() === extension.toLowerCase());
          if (!exists) {
            const entry = contentTypes.createElementNS(CT, "Default"); entry.setAttribute("Extension", extension); entry.setAttribute("ContentType", mime);
            contentTypes.documentElement.appendChild(entry);
          }
        }
      };
      return state;
    });
  }

  async function writeBack(zip, xmlDocument, topics, renderScreenHtml) {
    const state = await packageState(zip, xmlDocument);
    normalizeHeadingStyleReferences(xmlDocument, state.stylesDocument);
    for (const topic of topics) {
      const hasChanges = topic.screens.some(screen => screen.isNew || screen.source !== screen.originalSource) ||
        topic.originalScreenIds.some(id => !topic.screens.some(screen => screen.id === id));
      if (!hasChanges) continue;
      const table = findTopicTable(xmlDocument, topic.title);
      if (!table) throw new Error(`Não encontrei a tabela do tópico “${topic.title}” no DOCX original.`);
      const allRows = directRows(table);
      const header = allRows[0];
      const existingRows = allRows.slice(1);
      const templateRow = existingRows[0];
      if (!header || !templateRow) throw new Error(`O tópico “${topic.title}” não tem uma linha de tela que possa servir de modelo.`);
      for (const row of existingRows) table.removeChild(row);
      if (!topic.screens.length) throw new Error(`O tópico “${topic.title}” precisa manter pelo menos uma tela.`);
      const finalScreens = topic.screens;
      for (let index = 0; index < finalScreens.length; index++) {
        const screen = finalScreens[index];
        const originalRow = Number.isInteger(screen.wordRowIndex) ? existingRows[screen.wordRowIndex] : null;
        const row = (originalRow || templateRow).cloneNode(true);
        const cells = directCells(row);
        if (cells.length < 2) throw new Error(`A linha de tela ${index + 1} do tópico “${topic.title}” não tem duas colunas.`);
        setCellText(xmlDocument, cells[0], String(index + 1));
        if (screen.isNew || screen.source !== screen.originalSource) {
          const html = await renderScreenHtml(screen.source || "");
          await replaceCellContent(xmlDocument, cells[1], html, state);
        }
        table.appendChild(row);
      }
    }
    zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDocument));
    zip.file("word/_rels/document.xml.rels", new XMLSerializer().serializeToString(state.relationships));
    zip.file("[Content_Types].xml", new XMLSerializer().serializeToString(state.contentTypes));
    return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE", compressionOptions: { level: 6 } });
  }

  window.AutomatoDocxWriteback = { writeBack, directRows, directCells, findTopicTable, normalize, textOf };
})();
