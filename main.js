const DATA_URL = "data/verb-data.json";

/*
  The JSON schema is intentionally data-first:
  every lexical form carries its own metadata, while the tree only encodes
  derivational structure. Rendering is split into two layers:
  1. normalization/transformation helpers for schema-safe data access
  2. D3 rendering for the tree, tooltip, and details panel
*/

const ASPECT_META = {
  imperfective: { label: "Imperfective", color: "var(--aspect-imperfective)" },
  perfective: { label: "Perfective", color: "var(--aspect-perfective)" },
  unspecified: { label: "Unspecified", color: "var(--aspect-unknown)" }
};

const REGISTER_META = {
  vulgar: { label: "Vulgar", color: "var(--register-vulgar)" },
  "very vulgar": { label: "Very vulgar", color: "var(--register-very-vulgar)" },
  unspecified: { label: "Unspecified", color: "var(--register-unspecified)" }
};

const state = {
  root: null,
  selectedId: null,
  index: new Map(),
  resizeFrame: null
};

const ui = {
  legend: document.getElementById("legend"),
  stage: document.getElementById("tree-stage"),
  svg: d3.select("#tree"),
  tooltip: d3.select("#tooltip"),
  detailsTitle: document.getElementById("details-title"),
  detailsSubtitle: document.getElementById("details-subtitle"),
  detailsPanel: document.getElementById("details-panel"),
  expandButton: document.getElementById("expand-all"),
  collapseButton: document.getElementById("collapse-derived")
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  try {
    const rawData = await loadVerbData(DATA_URL);
    const normalizedTree = normalizeVerbTree(rawData);

    state.index = buildDataIndex(normalizedTree);
    state.root = buildHierarchy(normalizedTree);
    state.selectedId = normalizedTree.id;

    renderLegend();
    bindControls();
    installResizeHandling();
    renderSelectedNode(findVisibleNodeById(state.selectedId));
    updateTree(state.root);
  } catch (error) {
    renderLoadError(error);
    console.error(error);
  }
}

async function loadVerbData(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load data from ${url} (${response.status})`);
  }

  return response.json();
}

function normalizeVerbTree(node) {
  const glosses = Array.isArray(node.glosses) ? node.glosses.filter(Boolean) : [];
  const examples = Array.isArray(node.examples)
    ? node.examples.map((example) => ({
        polish: example.polish || "",
        literalEnglish: example.literalEnglish || "",
        naturalEnglish: example.naturalEnglish || ""
      }))
    : [];
  const children = Array.isArray(node.children) ? node.children.map(normalizeVerbTree) : [];

  return {
    id: node.id || slugify(node.lemma || "form"),
    lemma: node.lemma || "Unnamed form",
    root: node.root || "",
    prefix: node.prefix || null,
    aspect: normalizeAspect(node.aspect),
    reflexive: Boolean(node.reflexive),
    register: normalizeRegister(node.register),
    glosses,
    examples,
    notes: node.notes || "",
    conjugation:
      node.conjugation && typeof node.conjugation === "object" && Object.keys(node.conjugation).length > 0
        ? node.conjugation
        : null,
    partnerId: node.partnerId || null,
    derivation: node.derivation || "",
    shortGloss: glosses[0] || "No gloss added yet.",
    children
  };
}

function buildDataIndex(rootData) {
  const index = new Map();

  walkDataTree(rootData, (node) => {
    index.set(node.id, node);
  });

  return index;
}

function buildHierarchy(treeData) {
  const root = d3.hierarchy(treeData);

  walkHierarchy(root, (node) => {
    node._children = node.children || null;
    node.x0 = 0;
    node.y0 = 0;
  });

  return root;
}

function bindControls() {
  ui.expandButton.addEventListener("click", () => {
    setExpansionDepth(Infinity);
    updateTree(state.root);
  });

  ui.collapseButton.addEventListener("click", () => {
    setExpansionDepth(1);
    updateTree(state.root);
  });
}

function installResizeHandling() {
  const scheduleResize = () => {
    if (state.resizeFrame) {
      cancelAnimationFrame(state.resizeFrame);
    }

    state.resizeFrame = requestAnimationFrame(() => {
      state.resizeFrame = null;
      if (state.root) {
        updateTree(state.root);
      }
    });
  };

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(ui.stage);
    return;
  }

  window.addEventListener("resize", scheduleResize);
}

function setExpansionDepth(maxDepth) {
  walkHierarchy(state.root, (node) => {
    if (!node._children) {
      return;
    }

    node.children = node.depth < maxDepth || maxDepth === Infinity ? node._children : null;
  });
}

function updateTree(sourceNode) {
  const treeLayout = d3.tree().nodeSize([62, 240]);
  treeLayout(state.root);

  const visibleNodes = state.root.descendants();
  const visibleLinks = state.root.links();
  const margin = { top: 38, right: 210, bottom: 38, left: 34 };
  const minX = d3.min(visibleNodes, (node) => node.x) || 0;
  const maxX = d3.max(visibleNodes, (node) => node.x) || 0;
  const maxY = d3.max(visibleNodes, (node) => node.y) || 0;
  const stageWidth = Math.max(ui.stage.clientWidth, 780);
  const svgWidth = Math.max(stageWidth, maxY + margin.left + margin.right);
  const svgHeight = maxX - minX + margin.top + margin.bottom;
  const origin = {
    x: sourceNode?.x0 ?? sourceNode?.x ?? state.root.x ?? 0,
    y: sourceNode?.y0 ?? sourceNode?.y ?? state.root.y ?? 0
  };

  ui.svg.attr("width", svgWidth).attr("height", Math.max(svgHeight, 420));

  const canvas = ui.svg
    .selectAll("g.canvas")
    .data([null])
    .join("g")
    .attr("class", "canvas")
    .attr("transform", `translate(${margin.left}, ${margin.top - minX})`);

  const linkLayer = canvas.selectAll("g.links").data([null]).join("g").attr("class", "links");
  const nodeLayer = canvas.selectAll("g.nodes").data([null]).join("g").attr("class", "nodes");
  const linkPathLayer = linkLayer.selectAll("g.link-paths").data([null]).join("g").attr("class", "link-paths");
  const linkLabelLayer = linkLayer.selectAll("g.link-labels").data([null]).join("g").attr("class", "link-labels");

  const link = linkPathLayer.selectAll("path.tree-link").data(visibleLinks, (linkDatum) => linkDatum.target.data.id);

  const linkEnter = link
    .enter()
    .append("path")
    .attr("class", "tree-link")
    .attr("d", () => drawLink({ source: origin, target: origin }));

  link
    .merge(linkEnter)
    .transition()
    .duration(260)
    .attr("d", (linkDatum) => drawLink(linkDatum));

  link
    .exit()
    .transition()
    .duration(220)
    .attr("d", () => drawLink({ source: origin, target: origin }))
    .remove();

  const linkLabel = linkLabelLayer
    .selectAll("g.link-label")
    .data(visibleLinks, (linkDatum) => linkDatum.target.data.id);

  const linkLabelEnter = linkLabel
    .enter()
    .append("g")
    .attr("class", "link-label")
    .attr("transform", () => formatLinkLabelTransform({ source: origin, target: origin }))
    .style("opacity", 0);

  linkLabelEnter.append("rect").attr("class", "link-label-pill");
  linkLabelEnter
    .append("text")
    .attr("class", "link-label-text")
    .attr("text-anchor", "middle")
    .attr("dominant-baseline", "middle");

  const mergedLinkLabel = linkLabel.merge(linkLabelEnter);

  mergedLinkLabel
    .each(function (linkDatum) {
      const group = d3.select(this);
      const text = group.select("text.link-label-text");

      text.text(getLinkOperation(linkDatum.source.data, linkDatum.target.data));

      const bounds = text.node().getBBox();
      group
        .select("rect.link-label-pill")
        .attr("x", bounds.x - 8)
        .attr("y", bounds.y - 4)
        .attr("width", bounds.width + 16)
        .attr("height", bounds.height + 8)
        .attr("rx", 999)
        .attr("ry", 999);
    })
    .transition()
    .duration(260)
    .style("opacity", 1)
    .attr("transform", (linkDatum) => formatLinkLabelTransform(linkDatum));

  linkLabel
    .exit()
    .transition()
    .duration(220)
    .style("opacity", 0)
    .attr("transform", () => formatLinkLabelTransform({ source: origin, target: origin }))
    .remove();

  const node = nodeLayer.selectAll("g.node").data(visibleNodes, (nodeDatum) => nodeDatum.data.id);

  const nodeEnter = node
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", `translate(${origin.y}, ${origin.x})`)
    .attr("tabindex", 0)
    .on("click", handleNodeSelection)
    .on("keydown", (event, nodeDatum) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleNodeSelection(event, nodeDatum);
      }
    })
    .on("mouseenter", showTooltip)
    .on("mousemove", moveTooltip)
    .on("mouseleave", hideTooltip);

  nodeEnter.append("path").attr("class", "node-symbol");
  nodeEnter.append("text").attr("class", "node-label").attr("x", 17).attr("y", 0);

  const mergedNode = node.merge(nodeEnter);

  mergedNode
    .transition()
    .duration(260)
    .attr("transform", (nodeDatum) => `translate(${nodeDatum.y}, ${nodeDatum.x})`);

  mergedNode
    .classed("selected", (nodeDatum) => nodeDatum.data.id === state.selectedId)
    .classed("collapsed", (nodeDatum) => Boolean(nodeDatum._children && !nodeDatum.children));

  mergedNode
    .select("path.node-symbol")
    .attr("d", (nodeDatum) => getNodeSymbol(nodeDatum.data)())
    .attr("fill", (nodeDatum) => getAspectMeta(nodeDatum.data.aspect).color)
    .attr("stroke", (nodeDatum) => getRegisterMeta(nodeDatum.data.register).color);

  mergedNode
    .select("text.node-label")
    .text((nodeDatum) => nodeDatum.data.lemma);

  node
    .exit()
    .transition()
    .duration(220)
    .attr("transform", `translate(${origin.y}, ${origin.x})`)
    .remove();

  visibleNodes.forEach((nodeDatum) => {
    nodeDatum.x0 = nodeDatum.x;
    nodeDatum.y0 = nodeDatum.y;
  });
}

function handleNodeSelection(event, nodeDatum) {
  state.selectedId = nodeDatum.data.id;
  renderSelectedNode(nodeDatum);

  if (nodeDatum._children) {
    nodeDatum.children = nodeDatum.children ? null : nodeDatum._children;
  }

  updateTree(nodeDatum);
}

function renderLegend() {
  const aspectItems = ["imperfective", "perfective"]
    .map((aspect) => {
      const meta = getAspectMeta(aspect);
      return legendItemHtml(`<span class="legend-swatch" style="--swatch: ${meta.color}"></span>${meta.label}`);
    })
    .join("");

  const reflexiveItems = [
    legendItemHtml('<span class="legend-swatch shape-circle stroke-only"></span>Non-reflexive'),
    legendItemHtml('<span class="legend-swatch shape-diamond stroke-only"></span>Reflexive')
  ].join("");

  const registerItems = ["vulgar", "very vulgar"]
    .map((register) => {
      const meta = getRegisterMeta(register);
      return legendItemHtml(`<span class="legend-swatch stroke-only" style="--swatch: ${meta.color}"></span>${meta.label}`);
    })
    .join("");

  ui.legend.innerHTML = [
    `<div class="legend-block"><span class="legend-title">Fill</span><div class="legend-items">${aspectItems}</div></div>`,
    `<div class="legend-block"><span class="legend-title">Shape</span><div class="legend-items">${reflexiveItems}</div></div>`,
    `<div class="legend-block"><span class="legend-title">Stroke</span><div class="legend-items">${registerItems}</div></div>`
  ].join("");
}

function renderSelectedNode(nodeDatum) {
  if (!nodeDatum) {
    return;
  }

  const data = nodeDatum.data;
  const aspectMeta = getAspectMeta(data.aspect);
  const registerMeta = getRegisterMeta(data.register);
  const partnerLemma = data.partnerId && state.index.has(data.partnerId) ? state.index.get(data.partnerId).lemma : null;
  const childList = Array.isArray(data.children) ? data.children : [];

  ui.detailsTitle.innerHTML = formatDetailsTitle(data.lemma, data.prefix);
  ui.detailsSubtitle.textContent = `${aspectMeta.label} • ${data.reflexive ? "Reflexive" : "Non-reflexive"} • ${registerMeta.label}`;

  ui.detailsPanel.innerHTML = `
    <div class="badge-row">
      ${badgeHtml("aspect", aspectMeta.label, aspectMeta.color)}
      ${badgeHtml("", data.reflexive ? "Reflexive" : "Non-reflexive")}
      ${badgeHtml("register", registerMeta.label, registerMeta.color)}
    </div>

    <section class="details-section">
      <h3>Profile</h3>
      <div class="meta-grid">
        ${metaCardHtml("Derivation", data.derivation || "—")}
        ${metaCardHtml("Aspect partner", partnerLemma || "—", !partnerLemma)}
      </div>
    </section>

    <section class="details-section">
      <h3>Glosses</h3>
      ${
        data.glosses.length
          ? `<ul class="gloss-list">${data.glosses.map((gloss) => `<li>${escapeHtml(gloss)}</li>`).join("")}</ul>`
          : '<p class="empty-state">No glosses added yet.</p>'
      }
    </section>

    <section class="details-section">
      <h3>Usage Notes</h3>
      <p class="surface-copy">${escapeHtml(data.notes || "No notes added yet.")}</p>
    </section>

    <section class="details-section">
      <h3>Examples</h3>
      ${
        data.examples.length
          ? `<div class="example-stack">${data.examples.map(renderExampleCard).join("")}</div>`
          : '<p class="empty-state">No examples added yet.</p>'
      }
    </section>

    <section class="details-section">
      <h3>Conjugation</h3>
      ${
        data.conjugation
          ? `<div class="conjugation-grid">${Object.entries(data.conjugation)
              .map(([label, value]) => conjugationCardHtml(label, value))
              .join("")}</div>`
          : '<p class="empty-state">No conjugation metadata added for this form.</p>'
      }
    </section>

    <section class="details-section">
      <h3>Derived Children</h3>
      ${
        childList.length
          ? `<ul class="branch-list">${childList
              .map((child) => `<li><strong>${escapeHtml(child.lemma)}</strong><br>${escapeHtml(child.shortGloss)}</li>`)
              .join("")}</ul>`
          : '<p class="empty-state">Leaf node: no child forms in this sample.</p>'
      }
    </section>
  `;
}

function renderExampleCard(example) {
  return `
    <article class="example-card">
      <strong>${escapeHtml(example.polish)}</strong>
      <p><span class="translation-label">Literal</span><br>${escapeHtml(example.literalEnglish)}</p>
      <p><span class="translation-label">Natural</span><br>${escapeHtml(example.naturalEnglish)}</p>
    </article>
  `;
}

function showTooltip(event, nodeDatum) {
  ui.tooltip.html(
    `<strong>${escapeHtml(nodeDatum.data.lemma)}</strong><span>${escapeHtml(nodeDatum.data.shortGloss)}</span>`
  );
  ui.tooltip.attr("hidden", null);
  moveTooltip(event);
}

function moveTooltip(event) {
  const bounds = ui.stage.getBoundingClientRect();
  const tooltipNode = ui.tooltip.node();
  const tooltipWidth = tooltipNode ? tooltipNode.offsetWidth : 0;
  const tooltipHeight = tooltipNode ? tooltipNode.offsetHeight : 0;
  let left = event.clientX - bounds.left + ui.stage.scrollLeft + 18;
  let top = event.clientY - bounds.top + ui.stage.scrollTop + 18;

  if (left + tooltipWidth > ui.stage.scrollLeft + ui.stage.clientWidth - 12) {
    left -= tooltipWidth + 30;
  }

  if (top + tooltipHeight > ui.stage.scrollTop + ui.stage.clientHeight - 12) {
    top -= tooltipHeight + 30;
  }

  ui.tooltip.style("left", `${Math.max(12, left)}px`).style("top", `${Math.max(12, top)}px`);
}

function hideTooltip() {
  ui.tooltip.attr("hidden", true);
}

function renderLoadError(error) {
  ui.detailsTitle.textContent = "Could not load the explorer";
  ui.detailsSubtitle.textContent = "Run the project from a local server so the browser can fetch the JSON file.";
  ui.detailsPanel.innerHTML = `
    <section class="details-section">
      <h3>Error</h3>
      <p class="empty-state">${escapeHtml(error.message)}</p>
      <p class="empty-state">Suggested command: <code>python3 -m http.server 8000</code></p>
    </section>
  `;
}

function formatDetailsTitle(lemma, prefix) {
  const safeLemma = escapeHtml(lemma);

  if (!prefix) {
    return safeLemma;
  }

  const barePrefix = String(prefix).replace(/-$/, "");

  if (!barePrefix || !lemma.startsWith(barePrefix)) {
    return safeLemma;
  }

  return `<span class="details-title-prefix">${escapeHtml(lemma.slice(0, barePrefix.length))}</span>${escapeHtml(
    lemma.slice(barePrefix.length)
  )}`;
}

function getNodeSymbol(data) {
  return d3
    .symbol()
    .type(data.reflexive ? d3.symbolDiamond : d3.symbolCircle)
    .size(data.reflexive ? 158 : 136);
}

function getAspectMeta(aspect) {
  return ASPECT_META[aspect] || ASPECT_META.unspecified;
}

function getRegisterMeta(register) {
  return REGISTER_META[register] || REGISTER_META.unspecified;
}

function normalizeAspect(aspect) {
  return aspect && ASPECT_META[aspect] ? aspect : "unspecified";
}

function normalizeRegister(register) {
  return register && REGISTER_META[register] ? register : "unspecified";
}

function findVisibleNodeById(id) {
  return state.root ? state.root.descendants().find((node) => node.data.id === id) || null : null;
}

function walkDataTree(node, callback) {
  callback(node);
  (node.children || []).forEach((child) => walkDataTree(child, callback));
}

function walkHierarchy(node, callback) {
  callback(node);
  (node._children || node.children || []).forEach((child) => walkHierarchy(child, callback));
}

function drawLink(linkDatum) {
  const midpoint = (linkDatum.source.y + linkDatum.target.y) / 2;
  return `M${linkDatum.source.y},${linkDatum.source.x}
    C${midpoint},${linkDatum.source.x}
    ${midpoint},${linkDatum.target.x}
    ${linkDatum.target.y},${linkDatum.target.x}`;
}

function formatLinkLabelTransform(linkDatum) {
  const x = linkDatum.source.y + (linkDatum.target.y - linkDatum.source.y) * 0.56;
  const y = linkDatum.source.x + (linkDatum.target.x - linkDatum.source.x) * 0.5 - 12;
  return `translate(${x}, ${y})`;
}

function getLinkOperation(parentData, childData) {
  const operations = [];
  const prefixOperation = getPrefixOperation(parentData, childData);
  const stemShiftOperation = getStemShiftOperation(parentData, childData);
  const reflexiveOperation = getReflexiveOperation(parentData, childData);
  const aspectOperation = getAspectOperation(parentData, childData);

  if (prefixOperation) {
    operations.push(prefixOperation);
  }

  if (stemShiftOperation) {
    operations.push(stemShiftOperation);
  }

  if (reflexiveOperation) {
    operations.push(reflexiveOperation);
  }

  if (aspectOperation) {
    operations.push(aspectOperation);
  }

  if (operations.length) {
    return operations.join(" • ");
  }

  return childData.derivation || "derived form";
}

function getPrefixOperation(parentData, childData) {
  if (!childData.prefix || childData.prefix === parentData.prefix) {
    return null;
  }

  return `${childData.prefix.replace(/-$/, "")}+`;
}

function getStemShiftOperation(parentData, childData) {
  if (parentData.prefix !== childData.prefix) {
    return null;
  }

  const parentLemma = stripReflexiveMarker(parentData.lemma);
  const childLemma = stripReflexiveMarker(childData.lemma);

  if (parentLemma === childLemma) {
    return null;
  }

  const commonPrefixLength = getCommonPrefixLength(parentLemma, childLemma);
  const sourceSuffix = parentLemma.slice(commonPrefixLength);
  const targetSuffix = childLemma.slice(commonPrefixLength);

  if (!sourceSuffix || !targetSuffix || sourceSuffix.length > 6 || targetSuffix.length > 6) {
    return null;
  }

  return `${sourceSuffix}→${targetSuffix}`;
}

function getReflexiveOperation(parentData, childData) {
  if (parentData.reflexive === childData.reflexive) {
    return null;
  }

  return childData.reflexive ? "+ się" : "− się";
}

function getAspectOperation(parentData, childData) {
  if (parentData.aspect === childData.aspect) {
    return null;
  }

  if (parentData.aspect === "imperfective" && childData.aspect === "perfective") {
    return "PFV";
  }

  if (parentData.aspect === "perfective" && childData.aspect === "imperfective") {
    return "IPFV";
  }

  return `${getAspectMeta(parentData.aspect).label}→${getAspectMeta(childData.aspect).label}`;
}

function stripReflexiveMarker(lemma) {
  return String(lemma).replace(/\s+się$/, "");
}

function getCommonPrefixLength(source, target) {
  const limit = Math.min(source.length, target.length);
  let index = 0;

  while (index < limit && source[index] === target[index]) {
    index += 1;
  }

  return index;
}

function badgeHtml(typeClass, label, color) {
  const style = color ? ` style="--badge-color: ${color}"` : "";
  return `<span class="badge ${typeClass}"${style}>${escapeHtml(label)}</span>`;
}

function metaCardHtml(label, value, dimmed = false) {
  return `<div class="meta-card${dimmed ? " is-dimmed" : ""}"><span>${escapeHtml(label)}</span>${escapeHtml(value)}</div>`;
}

function conjugationCardHtml(label, value) {
  return `<div class="conjugation-card"><span>${escapeHtml(prettyLabel(label))}</span>${escapeHtml(value)}</div>`;
}

function legendItemHtml(content) {
  return `<span class="legend-item">${content}</span>`;
}

function prettyLabel(label) {
  return label
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([0-9]+)/g, " $1")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
