const DATA_URL = "data/verb-data.json";

/*
  The JSON schema is intentionally data-first:
  every lexical form carries its own metadata, while the tree only encodes
  derivational structure. Rendering is split into two layers:
  1. normalization/transformation helpers for schema-safe data access
  2. D3 rendering for the tree, tooltip, and details panel
*/

const ASPECT_META = {
  imperfective: { label: "Imperfective", fillState: "hollow" },
  perfective: { label: "Perfective", fillState: "solid" },
  unspecified: { label: "Unspecified", fillState: "soft" }
};

const REGISTER_META = {
  vulgar: { label: "Vulgar", color: "var(--register-vulgar)" },
  "very vulgar": { label: "Very vulgar", color: "var(--register-very-vulgar)" },
  unspecified: { label: "Unspecified", color: "var(--register-unspecified)" }
};

/*
  Prefix notes are kept separate from the verb-family data so the same
  linguistic guide can be reused across different families in the future.
*/
const PREFIX_GUIDE = {
  "do-": {
    label: "do-",
    coreIdea: "reaching a limit / endpoint",
    pfvEffect: "completion up to a boundary",
    outcomes: ["finish", "add to completion"],
    exampleLemma: "dopisać",
    exampleGloss: "finish writing / add"
  },
  "na-": {
    label: "na-",
    coreIdea: "accumulation / surface coverage",
    pfvEffect: "reaching a sufficient or excessive amount",
    outcomes: ["pile up", "do a lot", "saturate"],
    exampleLemma: "napisać",
    exampleGloss: "write to completion"
  },
  "po-": {
    label: "po-",
    coreIdea: "distributed / bounded small quantity",
    pfvEffect: "delimited action for a bit or in small amounts",
    outcomes: ["do briefly", "do here and there"],
    exampleLemma: "popisać",
    exampleGloss: "write a bit"
  },
  "prze-": {
    label: "prze-",
    coreIdea: "through / across / excess",
    pfvEffect: "crossing a threshold",
    outcomes: ["overdo", "redo", "transfer"],
    exampleLemma: "przepisać",
    exampleGloss: "copy / rewrite"
  },
  "przy-": {
    label: "przy-",
    coreIdea: "toward / attachment",
    pfvEffect: "contact or slight addition",
    outcomes: ["attach", "approach", "do slightly"],
    exampleLemma: "przykręcić",
    exampleGloss: "fasten / tighten"
  },
  "roz-": {
    label: "roz-",
    coreIdea: "apart / dispersal",
    pfvEffect: "result = separation",
    outcomes: ["split", "scatter", "intensify to destruction"],
    exampleLemma: "rozbić",
    exampleGloss: "smash apart"
  },
  "s-/z-": {
    label: "s- / z-",
    coreIdea: "downward / together / completion",
    pfvEffect: "resultative completion",
    outcomes: ["remove", "finish", "bring down"],
    exampleLemma: "zrobić",
    exampleGloss: "do / make (complete)"
  },
  "u-": {
    label: "u-",
    coreIdea: "away / removal / downward",
    pfvEffect: "reduction or detachment",
    outcomes: ["cut off", "diminish", "manage to"],
    exampleLemma: "uciąć",
    exampleGloss: "cut off"
  },
  "w-": {
    label: "w-",
    coreIdea: "inward / into",
    pfvEffect: "entering a bounded space",
    outcomes: ["insert", "get into", "embed"],
    exampleLemma: "włożyć",
    exampleGloss: "put in"
  },
  "wy-": {
    label: "wy-",
    coreIdea: "outward / out of",
    pfvEffect: "exit from a space / full extraction",
    outcomes: ["remove", "extract", "do exhaustively"],
    exampleLemma: "wyjąć",
    exampleGloss: "take out"
  },
  "za-": {
    label: "za-",
    coreIdea: "behind / start / covering",
    pfvEffect: "boundary crossing or onset",
    outcomes: ["start", "block", "cover", "go too far"],
    exampleLemma: "zacząć",
    exampleGloss: "begin"
  },
  "od-": {
    label: "od-",
    coreIdea: "away / back",
    pfvEffect: "separation or reversal",
    outcomes: ["undo", "return", "detach"],
    exampleLemma: "oddać",
    exampleGloss: "give back"
  },
  "o-": {
    label: "o-",
    coreIdea: "around / about / affecting a surface",
    pfvEffect: "affecting the target fully or peripherally",
    outcomes: ["cover", "surround", "scold metaphorically"],
    exampleLemma: "omalować",
    exampleGloss: "paint around"
  },
  "pod-": {
    label: "pod-",
    coreIdea: "under / slightly",
    pfvEffect: "partial or subordinate action",
    outcomes: ["do slightly", "sneak under"],
    exampleLemma: "podgrzać",
    exampleGloss: "warm up a bit"
  },
  "nad-": {
    label: "nad-",
    coreIdea: "over / above",
    pfvEffect: "excess or superiority",
    outcomes: ["overdo", "surpass"],
    exampleLemma: "nadpisać",
    exampleGloss: "overwrite"
  },
  "ob-": {
    label: "ob-",
    coreIdea: "around / encircling",
    pfvEffect: "action around an object",
    outcomes: ["surround", "cover fully"],
    exampleLemma: "objechać",
    exampleGloss: "go around"
  }
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
  detailsHeader: document.querySelector(".details-header"),
  detailsTitle: document.getElementById("details-title"),
  detailsSubtitle: document.getElementById("details-subtitle"),
  prefixPopover: document.getElementById("prefix-popover"),
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
    bindPrefixPopover();
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

function bindPrefixPopover() {
  ui.detailsHeader.addEventListener("pointerover", (event) => {
    const prefixNode = event.target.closest(".details-title-prefix.is-interactive");

    if (!prefixNode || !ui.detailsHeader.contains(prefixNode)) {
      return;
    }

    showPrefixPopover(prefixNode);
  });

  ui.detailsHeader.addEventListener("pointerout", (event) => {
    const prefixNode = event.target.closest(".details-title-prefix.is-interactive");

    if (!prefixNode || !ui.detailsHeader.contains(prefixNode)) {
      return;
    }

    if (event.relatedTarget && prefixNode.contains(event.relatedTarget)) {
      return;
    }

    hidePrefixPopover();
  });

  ui.detailsHeader.addEventListener("focusin", (event) => {
    const prefixNode = event.target.closest(".details-title-prefix.is-interactive");

    if (!prefixNode || !ui.detailsHeader.contains(prefixNode)) {
      return;
    }

    showPrefixPopover(prefixNode);
  });

  ui.detailsHeader.addEventListener("focusout", (event) => {
    const prefixNode = event.target.closest(".details-title-prefix.is-interactive");

    if (!prefixNode || !ui.detailsHeader.contains(prefixNode)) {
      return;
    }

    if (event.relatedTarget && prefixNode.contains(event.relatedTarget)) {
      return;
    }

    hidePrefixPopover();
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
    .attr("fill", (nodeDatum) => getAspectFill(nodeDatum.data))
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
      return legendItemHtml(`<span class="legend-swatch ${getAspectSwatchClass(meta.fillState)}"></span>${meta.label}`);
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
    `<div class="legend-block"><span class="legend-title">Colour</span><div class="legend-items">${registerItems}</div></div>`
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

  hidePrefixPopover();
  ui.detailsTitle.innerHTML = formatDetailsTitle(data.lemma, data.prefix);
  ui.detailsSubtitle.textContent = `${aspectMeta.label} • ${data.reflexive ? "Reflexive" : "Non-reflexive"} • ${registerMeta.label}`;

  ui.detailsPanel.innerHTML = `
    <div class="badge-row">
      ${aspectBadgeHtml(aspectMeta)}
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

    <section class="details-section${childList.length ? "" : " empty-section"}">
      <h3>Derived Children</h3>
      ${
        childList.length
          ? `<ul class="branch-list">${childList
              .map((child) => `<li><strong>${escapeHtml(child.lemma)}</strong><br>${escapeHtml(child.shortGloss)}</li>`)
              .join("")}</ul>`
          : '<p class="empty-state">—</p>'
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
  hidePrefixPopover();
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

  const prefixGuide = getPrefixGuide(prefix);
  const prefixText = escapeHtml(lemma.slice(0, barePrefix.length));
  const suffixText = escapeHtml(lemma.slice(barePrefix.length));

  if (!prefixGuide) {
    return `<span class="details-title-prefix">${prefixText}</span>${suffixText}`;
  }

  return `<span
    class="details-title-prefix is-interactive"
    tabindex="0"
    data-prefix-key="${escapeHtml(prefixGuide.key)}"
    data-prefix-token="${escapeHtml(prefixGuide.label)}"
  >${prefixText}</span>${suffixText}`;
}

function getPrefixGuide(prefix) {
  const key = normalizePrefixGuideKey(prefix);
  const guide = PREFIX_GUIDE[key];

  if (!guide) {
    return null;
  }

  return { key, ...guide };
}

function normalizePrefixGuideKey(prefix) {
  if (!prefix) {
    return "";
  }

  if (prefix === "s-" || prefix === "z-") {
    return "s-/z-";
  }

  return prefix;
}

function showPrefixPopover(prefixNode) {
  const prefixKey = prefixNode.dataset.prefixKey;
  const prefixGuide = prefixKey ? PREFIX_GUIDE[prefixKey] : null;

  if (!prefixGuide) {
    hidePrefixPopover();
    return;
  }

  ui.prefixPopover.innerHTML = renderPrefixPopover(prefixGuide);
  ui.prefixPopover.hidden = false;
  positionPrefixPopover(prefixNode);
}

function hidePrefixPopover() {
  ui.prefixPopover.hidden = true;
  ui.prefixPopover.innerHTML = "";
}

function positionPrefixPopover(prefixNode) {
  const headerRect = ui.detailsHeader.getBoundingClientRect();
  const prefixRect = prefixNode.getBoundingClientRect();
  const popoverNode = ui.prefixPopover;
  const verticalOffset = 12;

  popoverNode.style.left = "0px";
  popoverNode.style.top = `${prefixRect.bottom - headerRect.top + verticalOffset}px`;

  const popoverRect = popoverNode.getBoundingClientRect();
  const availableWidth = headerRect.width - popoverRect.width;
  const anchoredLeft = prefixRect.left - headerRect.left;
  const clampedLeft = clamp(anchoredLeft, 0, Math.max(0, availableWidth));

  popoverNode.style.left = `${clampedLeft}px`;
}

function renderPrefixPopover(prefixGuide) {
  return `
    <div class="prefix-popover-kicker">Prefix lens</div>
    <div class="prefix-popover-head">
      <span class="prefix-popover-chip">${escapeHtml(prefixGuide.label)}</span>
      <p>${escapeHtml(prefixGuide.coreIdea)}</p>
    </div>
    <dl class="prefix-popover-grid">
      <div class="prefix-popover-row">
        <dt>PFV effect</dt>
        <dd>${escapeHtml(prefixGuide.pfvEffect)}</dd>
      </div>
      <div class="prefix-popover-row">
        <dt>Common outcomes</dt>
        <dd class="prefix-popover-tags">${prefixGuide.outcomes.map(renderPrefixOutcomeTag).join("")}</dd>
      </div>
      <div class="prefix-popover-row">
        <dt>Example</dt>
        <dd><strong>${escapeHtml(prefixGuide.exampleLemma)}</strong> → ${escapeHtml(prefixGuide.exampleGloss)}</dd>
      </div>
    </dl>
  `;
}

function renderPrefixOutcomeTag(outcome) {
  return `<span class="prefix-popover-tag">${escapeHtml(outcome)}</span>`;
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

function getAspectFill(data) {
  const aspectMeta = getAspectMeta(data.aspect);
  const registerMeta = getRegisterMeta(data.register);

  if (aspectMeta.fillState === "solid") {
    return registerMeta.color;
  }

  if (aspectMeta.fillState === "soft") {
    return "color-mix(in srgb, var(--surface-strong) 42%, transparent)";
  }

  return "transparent";
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

function aspectBadgeHtml(aspectMeta) {
  const variantClass = `aspect-${aspectMeta.fillState}`;
  return `<span class="badge aspect ${variantClass}">${escapeHtml(aspectMeta.label)}</span>`;
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

function getAspectSwatchClass(fillState) {
  return `fill-${fillState}`;
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
