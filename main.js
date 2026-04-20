const DATA_URL = "data/verb-data.json";

/*
  Schema and rendering stay intentionally separate:
  1. normalization/indexing helpers make the verb-family JSON safe to query
  2. UI renderers turn the selected branch into a mobile drill-down explorer

  This branch removes the D3 tree entirely in favor of a touch-first tree menu.
  The same JSON can still support other verb families later.
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
  parentIndex: new Map(),
  prefixPopoverKey: null,
  treeOpen: false,
  expandedTreeIds: new Set()
};

const ui = {
  treeToggle: document.getElementById("tree-toggle"),
  branchTitle: document.getElementById("branch-title"),
  navigatorSurface: document.querySelector(".navigator-surface"),
  treeOverlay: document.getElementById("tree-overlay"),
  treeOverlayBackdrop: document.getElementById("tree-overlay-backdrop"),
  treeOverlayTitle: document.getElementById("tree-overlay-title"),
  treePath: document.getElementById("tree-path"),
  treeClose: document.getElementById("tree-close"),
  branchList: document.getElementById("branch-list"),
  detailsHeader: document.querySelector(".details-header"),
  detailsSubtitle: document.getElementById("details-subtitle"),
  prefixPopover: document.getElementById("prefix-popover"),
  detailsPanel: document.getElementById("details-panel")
};

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  try {
    const rawData = await loadVerbData(DATA_URL);
    const normalizedTree = normalizeVerbTree(rawData);

    state.root = normalizedTree;
    state.selectedId = normalizedTree.id;
    state.index = buildDataIndex(normalizedTree);
    state.parentIndex = buildParentIndex(normalizedTree);

    bindControls();
    bindPrefixPopover();
    renderApp();
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

function buildParentIndex(rootData) {
  const parentIndex = new Map();

  walkDataTree(rootData, (node) => {
    (node.children || []).forEach((child) => {
      parentIndex.set(child.id, node.id);
    });
  });

  return parentIndex;
}

function bindControls() {
  ui.treeToggle.addEventListener("click", toggleTreeView);
  ui.treeClose.addEventListener("click", closeTreeView);
  ui.treeOverlayBackdrop.addEventListener("click", closeTreeView);

  ui.branchList.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-toggle-id]");

    if (toggle) {
      event.preventDefault();
      toggleTreeNode(toggle.dataset.toggleId);
      return;
    }

    const branchNode = event.target.closest("[data-select-id]");

    if (!branchNode) {
      return;
    }

    const branchId = branchNode.dataset.selectId;
    if (branchId) {
      selectBranch(branchId);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.treeOpen) {
      closeTreeView();
    }
  });
}

function bindPrefixPopover() {
  ui.navigatorSurface.addEventListener("click", (event) => {
    const prefixNode = event.target.closest(".branch-title-prefix.is-interactive");

    if (!prefixNode || !ui.navigatorSurface.contains(prefixNode)) {
      if (!event.target.closest(".prefix-popover")) {
        hidePrefixPopover();
      }
      return;
    }

    event.preventDefault();
    togglePrefixPopover(prefixNode);
  });

  ui.navigatorSurface.addEventListener("keydown", (event) => {
    const prefixNode = event.target.closest(".branch-title-prefix.is-interactive");

    if (!prefixNode || !ui.navigatorSurface.contains(prefixNode)) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      togglePrefixPopover(prefixNode);
    }

    if (event.key === "Escape") {
      hidePrefixPopover();
    }
  });

  document.addEventListener("click", (event) => {
    if (!ui.navigatorSurface.contains(event.target)) {
      hidePrefixPopover();
    }
  });
}

function renderApp() {
  renderNavigator();
  renderSelectedNode(state.index.get(state.selectedId));
}

function renderNavigator() {
  const selected = state.index.get(state.selectedId);

  if (!selected) {
    return;
  }

  ui.branchTitle.innerHTML = formatBranchTitle(selected.lemma, selected.prefix);
  ui.treeOverlayTitle.textContent = `Variations of ${state.root.lemma}`;
  ui.treePath.textContent = getPath(state.selectedId)
    .map((node) => node.lemma)
    .join(" / ");
  ui.treeToggle.setAttribute("aria-expanded", String(state.treeOpen));
  ui.treeOverlay.hidden = !state.treeOpen;
  ui.treeOverlayBackdrop.hidden = !state.treeOpen;
  document.body.classList.toggle("tree-view-open", state.treeOpen);

  renderTreeMenu();
}

function renderTreeMenu() {
  const rootChildren = Array.isArray(state.root?.children) ? state.root.children : [];

  ui.branchList.innerHTML = `
    <div class="tree-root-row${state.selectedId === state.root.id ? " is-selected" : ""}">
      <button class="tree-root-select" type="button" data-select-id="${escapeHtml(state.root.id)}">
        ${formatTreeWord(state.root)}
      </button>
    </div>
    ${
      rootChildren.length
        ? `<ul class="tree-level tree-level-root">${renderTreeLevel(rootChildren, state.root, 1)}</ul>`
        : `<div class="branch-empty"><span class="branch-empty-mark">—</span><p>No variations in this sample.</p></div>`
    }
  `;
}

function renderTreeLevel(nodes, parentNode, depth) {
  return nodes.map((node) => renderTreeNode(node, parentNode, depth)).join("");
}

function renderTreeNode(node, parentNode, depth) {
  const hasChildren = Array.isArray(node.children) && node.children.length > 0;
  const isExpanded = state.expandedTreeIds.has(node.id);
  const isSelected = node.id === state.selectedId;
  const operation = getLinkOperation(parentNode, node);

  return `
    <li class="tree-node${isSelected ? " is-selected" : ""}" style="--tree-depth: ${depth}">
      <div class="tree-node-row">
        ${
          hasChildren
            ? `<button
                class="tree-node-toggle${isExpanded ? " is-expanded" : ""}"
                type="button"
                data-toggle-id="${escapeHtml(node.id)}"
                aria-expanded="${isExpanded ? "true" : "false"}"
                aria-label="${isExpanded ? "Collapse" : "Expand"} ${escapeHtml(node.lemma)}"
              >
                <span aria-hidden="true">▸</span>
              </button>`
            : '<span class="tree-node-spacer" aria-hidden="true"></span>'
        }
        <button class="tree-node-select" type="button" data-select-id="${escapeHtml(node.id)}">
          <span class="tree-node-label">${formatTreeWord(node)}</span>
          <span class="tree-node-operation">${escapeHtml(operation)}</span>
        </button>
      </div>
      ${
        hasChildren
          ? `<div class="tree-children"${isExpanded ? "" : " hidden"}>
              <ul class="tree-level">${renderTreeLevel(node.children, node, depth + 1)}</ul>
            </div>`
          : ""
      }
    </li>
  `;
}

function toggleTreeView() {
  if (state.treeOpen) {
    closeTreeView();
    return;
  }

  openTreeView();
}

function openTreeView() {
  state.treeOpen = true;
  expandPathTo(state.selectedId);
  renderNavigator();
}

function closeTreeView() {
  if (!state.treeOpen) {
    return;
  }

  state.treeOpen = false;
  renderNavigator();
}

function toggleTreeNode(nodeId) {
  if (!nodeId) {
    return;
  }

  if (state.expandedTreeIds.has(nodeId)) {
    state.expandedTreeIds.delete(nodeId);
  } else {
    state.expandedTreeIds.add(nodeId);
  }

  renderNavigator();
}

function expandPathTo(nodeId) {
  let cursor = nodeId;

  while (cursor) {
    const parentId = state.parentIndex.get(cursor);

    if (!parentId) {
      break;
    }

    if (parentId !== state.root.id) {
      state.expandedTreeIds.add(parentId);
    }

    cursor = parentId;
  }
}

function selectBranch(branchId, options = {}) {
  const target = state.index.get(branchId);

  if (!target) {
    return;
  }

  state.selectedId = branchId;
  expandPathTo(branchId);
  if (options.closeTree !== false) {
    state.treeOpen = false;
  }
  hidePrefixPopover();
  renderApp();

  if (!options.preserveScroll) {
    ui.detailsHeader.scrollIntoView({ block: "start", behavior: "smooth" });
  }
}

function renderSelectedNode(data) {
  if (!data) {
    return;
  }

  const aspectMeta = getAspectMeta(data.aspect);
  const registerMeta = getRegisterMeta(data.register);
  const partnerLemma = data.partnerId && state.index.has(data.partnerId) ? state.index.get(data.partnerId).lemma : null;
  const childList = Array.isArray(data.children) ? data.children : [];

  hidePrefixPopover();
  ui.detailsSubtitle.innerHTML = `${formatDetailsTitle(data.lemma, data.prefix)}<span class="details-subtitle-meta"> · ${escapeHtml(
    aspectMeta.label
  )} • ${data.reflexive ? "Reflexive" : "Non-reflexive"} • ${escapeHtml(registerMeta.label)}</span>`;

  ui.detailsPanel.innerHTML = `
    <div class="badge-row">
      ${aspectBadgeHtml(aspectMeta)}
      ${badgeHtml("", data.reflexive ? "Reflexive" : "Non-reflexive")}
      ${badgeHtml("register", registerMeta.label, registerMeta.color)}
    </div>

    <section class="details-section">
      ${
        data.glosses.length
          ? `<ul class="gloss-list">${data.glosses.map((gloss) => `<li>${escapeHtml(gloss)}</li>`).join("")}</ul>`
          : '<p class="empty-state">No glosses added yet.</p>'
      }
    </section>

    <section class="details-section">
      <h3>Profile</h3>
      <div class="meta-grid">
        ${metaCardHtml("Derivation", data.derivation || "—")}
        ${metaCardHtml("Aspect partner", partnerLemma || "—", !partnerLemma)}
      </div>
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
          ? `<ul class="branch-children-list">${childList
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

function renderLoadError(error) {
  state.treeOpen = false;
  ui.branchTitle.textContent = "Could not load the explorer";
  ui.treeOverlayTitle.textContent = "Load error";
  ui.treePath.textContent = "Run the project from a local server so the browser can fetch the JSON file.";
  ui.treeToggle.setAttribute("aria-expanded", "false");
  ui.treeOverlay.hidden = false;
  ui.treeOverlayBackdrop.hidden = true;
  document.body.classList.remove("tree-view-open");
  ui.branchList.innerHTML = `
    <div class="branch-empty">
      <span class="branch-empty-mark">!</span>
      <p>${escapeHtml(error.message)}</p>
    </div>
  `;
  ui.detailsSubtitle.textContent = "JSON could not be fetched.";
  ui.detailsPanel.innerHTML = `
    <section class="details-section">
      <h3>Suggested command</h3>
      <p class="empty-state"><code>python3 -m http.server 8000</code></p>
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

  return `<button
    class="details-title-prefix is-interactive"
    type="button"
    data-prefix-key="${escapeHtml(prefixGuide.key)}"
    data-prefix-token="${escapeHtml(prefixGuide.label)}"
    aria-label="Show prefix note for ${escapeHtml(prefixGuide.label)}"
  >${prefixText}</button>${suffixText}`;
}

function formatBranchTitle(lemma, prefix) {
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
    return `<span class="branch-title-prefix">${prefixText}</span>${suffixText}`;
  }

  return `<button
    class="branch-title-prefix is-interactive"
    type="button"
    data-prefix-key="${escapeHtml(prefixGuide.key)}"
    data-prefix-token="${escapeHtml(prefixGuide.label)}"
    aria-label="Show prefix note for ${escapeHtml(prefixGuide.label)}"
  >${prefixText}</button>${suffixText}`;
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

function togglePrefixPopover(prefixNode) {
  const prefixKey = prefixNode.dataset.prefixKey;

  if (!prefixKey) {
    return;
  }

  if (state.prefixPopoverKey === prefixKey && !ui.prefixPopover.hidden) {
    hidePrefixPopover();
    return;
  }

  showPrefixPopover(prefixNode);
}

function showPrefixPopover(prefixNode) {
  const prefixKey = prefixNode.dataset.prefixKey;
  const prefixGuide = prefixKey ? PREFIX_GUIDE[prefixKey] : null;

  if (!prefixGuide) {
    hidePrefixPopover();
    return;
  }

  state.prefixPopoverKey = prefixKey;
  ui.prefixPopover.innerHTML = renderPrefixPopover(prefixGuide);
  ui.prefixPopover.hidden = false;
  positionPrefixPopover(prefixNode);
}

function hidePrefixPopover() {
  state.prefixPopoverKey = null;
  ui.prefixPopover.hidden = true;
  ui.prefixPopover.innerHTML = "";
}

function positionPrefixPopover(prefixNode) {
  const headerRect = ui.navigatorSurface.getBoundingClientRect();
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

function formatTreeWord(node) {
  const lemma = String(node.lemma || "");
  const baseLemma = stripReflexiveMarker(lemma);
  const reflexiveMarker = lemma.slice(baseLemma.length);
  const prefixToken = node.prefix ? String(node.prefix).replace(/-$/, "") : "";
  const parts = [];
  let cursor = 0;

  if (prefixToken && baseLemma.startsWith(prefixToken)) {
    parts.push(`<span class="tree-word-prefix">${escapeHtml(baseLemma.slice(0, prefixToken.length))}</span>`);
    cursor = prefixToken.length;
  }

  const remaining = baseLemma.slice(cursor);
  const rootToken = node.root && remaining.startsWith(node.root) ? node.root : "";

  if (rootToken) {
    parts.push(`<span class="tree-word-root">${escapeHtml(rootToken)}</span>`);
    cursor += rootToken.length;
  }

  const suffixToken = baseLemma.slice(cursor);

  if (suffixToken) {
    parts.push(`<span class="tree-word-suffix">${escapeHtml(suffixToken)}</span>`);
  }

  if (reflexiveMarker) {
    parts.push(`<span class="tree-word-suffix tree-word-suffix-reflexive">${escapeHtml(reflexiveMarker)}</span>`);
  }

  return parts.length ? parts.join("") : escapeHtml(lemma);
}

function getPath(nodeId) {
  const path = [];
  let cursor = nodeId;

  while (cursor) {
    const node = state.index.get(cursor);
    if (!node) {
      break;
    }
    path.unshift(node);
    cursor = state.parentIndex.get(cursor) || null;
  }

  return path;
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

function walkDataTree(node, callback) {
  callback(node);
  (node.children || []).forEach((child) => walkDataTree(child, callback));
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
