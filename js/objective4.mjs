/**
 * OBJECTIVE 4.0 (objectivepro.html) — app entry + section router.
 *
 * The sidebar is OBJECTIVE's S01–S21 plus S22 the Glossary
 * (docs/workplans/OBJECTIVE-V4.md §9). Live: S01 Key Values, S02 PROJECT,
 * S17 Dependency Graph, S22 Glossary; the rest arrive in the port (P2: S11,
 * S12; P3: the others). The S01 heads-up display rides the masthead on every
 * section. The BEAM calculator's tabs are gone (Andy 2026-11-25: no legacy).
 *
 * Code names (objective4.mjs, js/beam/, window.BEAM) stay until the port.
 */

import { GLOSSARY } from "./beam/reference-data.mjs";
import { StateManager } from "./shared/state-manager.mjs";
import { esc as escapeHtml } from "./shared/html-utils.mjs";
import { renderProjectPanel, wireProjectForm, resetProjectTab, refreshProjectForm } from "./beam/project-tab.mjs";
import { loadSample, SAMPLES } from "./beam/sample-loader.mjs";
import * as PdfBridge from "./beam/pdf-bridge-import.mjs";

// ──────────────────────────────────────────────────────────────────────
// Section definitions — OBJECTIVE's S01–S21 (OBJECTIVE-V4.md §9.1), plus
// S22 the Glossary. Grouped for the sidebar; `v3` names the V3 section
// (#id in objectivepro.html's #op-v3-sections) each panel adopts at boot.
// ──────────────────────────────────────────────────────────────────────
const BEAM_TABS = [
  {
    group: "Project",
    tabs: [
      { id: "introduction", num: 1, label: "Key Values", v3: "keyValues" },
      { id: "project", num: 2, label: "PROJECT", v3: "buildingInfo" }
    ]
  },
  {
    group: "Climate & Targets",
    tabs: [
      { id: "climate", num: 3, label: "Climate Calculations", v3: "climateCalculations" },
      { id: "actual-target", num: 4, label: "Actual vs. Target Energy & Carbon", v3: "actualTargetEnergy" },
      { id: "emissions", num: 5, label: "CO2e Emissions", v3: "emissions" },
      { id: "renewables", num: 6, label: "Renewable Energy", v3: "onSiteEnergy" }
    ]
  },
  {
    group: "Occupancy & Gains",
    tabs: [
      { id: "water", num: 7, label: "Water Use", v3: "waterUse" },
      { id: "iaq", num: 8, label: "Indoor Air Quality", v3: "indoorAirQuality" },
      { id: "occupant-gains", num: 9, label: "Occupant + Internal Gains", v3: "occupantInternalGains" },
      { id: "radiant-gains", num: 10, label: "Radiant Gains", v3: "envelopeRadiantGains" }
    ]
  },
  {
    group: "Envelope",
    tabs: [
      { id: "transmission", num: 11, label: "Transmission Losses", v3: "envelopeTransmissionLosses" },
      { id: "volume-surface", num: 12, label: "Volume and Surface Metrics", v3: "volumeSurfaceMetrics" }
    ]
  },
  {
    group: "Systems & Results",
    tabs: [
      { id: "mechanical", num: 13, label: "Mechanical Loads", v3: "mechanicalLoads" },
      { id: "tedi-teli", num: 14, label: "TEDI & TELI", v3: "tediSummary" },
      { id: "teui", num: 15, label: "TEUI", v3: "teuiSummary" }
    ]
  },
  {
    group: "Outputs",
    tabs: [
      { id: "sankey", num: 16, label: "Sankey Diagram", v3: "sankeyDiagram" },
      { id: "dependency-graph", num: 17, label: "Dependency Graph", v3: "dependencyDiagram" },
      { id: "optimize", num: 18, label: "Optimize", v3: "parallelCoordinates" },
      { id: "wombat", num: 19, label: "WOMBAT — 3D Thermal Topology", v3: "wombat" }
    ]
  },
  {
    group: "Notes & Compliance",
    tabs: [
      { id: "notes", num: 20, label: "Notes & Debug", v3: "notes" },
      { id: "f280", num: 21, label: "CSA F280 Compliance", v3: "f280Compliance" }
    ]
  },
  {
    group: "Reference",
    tabs: [{ id: "glossary", num: 22, label: "Glossary" }]
  }
];

const FLAT_TABS = BEAM_TABS.flatMap((g) => g.tabs);
const DEFAULT_TAB = "introduction";

// ──────────────────────────────────────────────────────────────────────
// App state — minimal for now
// ──────────────────────────────────────────────────────────────────────
const state = {
  activeTab: DEFAULT_TAB
};

// ──────────────────────────────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────────────────────────────
function boot() {
  StateManager.loadState();
  renderSidebar();
  renderContentShell();
  renderHud(); // after the panels: S01 holds the full table
  wireActionBar();
  wireImportModal();
  wireKeyboard();
  wireGlossarySearch();
  wireProjectForm();
  setActiveTab(readInitialTabFromHash() || DEFAULT_TAB);
}

function wireGlossarySearch() {
  const input = document.getElementById("beam-glossary-search");
  const body = document.getElementById("beam-glossary-body");
  const count = document.getElementById("beam-glossary-count");
  if (!input || !body || !count) return;
  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    for (const tr of body.children) {
      const idx = Number(tr.dataset.glossaryIdx);
      const t = GLOSSARY[idx];
      const hay = [t.abbr, t.full, t.desc].filter(Boolean).join(" ").toLowerCase();
      const match = !q || hay.includes(q);
      tr.style.display = match ? "" : "none";
      if (match) shown++;
    }
    count.textContent = q ? `${shown} of ${GLOSSARY.length} terms` : `${GLOSSARY.length} terms`;
  });
}

// ──────────────────────────────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────────────────────────────
function renderSidebar() {
  const sb = document.getElementById("beam-sidebar");
  const frag = document.createDocumentFragment();
  for (const group of BEAM_TABS) {
    const hdr = document.createElement("div");
    hdr.className = "beam-tab-group-header";
    hdr.textContent = group.group;
    frag.appendChild(hdr);
    for (const tab of group.tabs) {
      const btn = document.createElement("button");
      btn.className = "beam-tab-button";
      btn.dataset.tabId = tab.id;
      btn.innerHTML = `<span class="beam-tab-num">S${pad2(tab.num)}</span>${escapeHtml(tab.label)}`;
      btn.title = `S${pad2(tab.num)} · ${tab.label}`;
      btn.addEventListener("click", () => setActiveTab(tab.id));
      frag.appendChild(btn);
    }
  }
  sb.replaceChildren(frag);
}

// ──────────────────────────────────────────────────────────────────────
// Content — render one panel per tab. Hidden until activated.
// ──────────────────────────────────────────────────────────────────────
function renderContentShell() {
  const content = document.getElementById("beam-content");
  const frag = document.createDocumentFragment();
  for (const tab of FLAT_TABS) {
    const panel = document.createElement("div");
    panel.className = "beam-tab-panel";
    panel.id = `beam-panel-${tab.id}`;
    panel.innerHTML = renderPanelBody(tab);
    // Adopt the V3 section (FieldManager renders into its .section-content on
    // DOMContentLoaded, which this module runs before).
    // V3's section goes first, under the panel header (S01: above the intro;
    // S02: above the PROJECT form).
    const v3 = tab.v3 && document.getElementById(tab.v3);
    if (v3) panel.querySelector(".beam-panel-header").after(v3Card(tab, v3));
    frag.appendChild(panel);
  }
  content.replaceChildren(frag);
  document.getElementById("op-v3-sections")?.remove();
}

// A V3 section in the V4 card the PROJECT form uses (.bw-asm-group): a
// collapsible header naming the section, V3's table as the body.
function v3Card(tab, v3) {
  const card = document.createElement("section");
  card.className = "bw-asm-group op-v3-card";
  card.innerHTML = `
    <header class="bw-asm-group-header">
      <button class="bw-asm-toggle" type="button" aria-expanded="true">\u25BC</button>
      <h3 class="bw-asm-group-name">S${pad2(tab.num)} ${escapeHtml(tab.label)}</h3>
    </header>
    <div class="bw-asm-group-body"></div>`;
  card.querySelector(".bw-asm-group-body").appendChild(v3);
  card.querySelector(".bw-asm-group-header").addEventListener("click", () => {
    const body = card.querySelector(".bw-asm-group-body");
    const btn = card.querySelector(".bw-asm-toggle");
    body.hidden = !body.hidden;
    btn.textContent = body.hidden ? "\u25B6" : "\u25BC";
    btn.setAttribute("aria-expanded", String(!body.hidden));
  });
  return card;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function renderPanelBody(tab) {
  const body = PANEL_BODIES[tab.id] || "";
  return `
    <div class="beam-panel-header">
      <h2 class="beam-panel-title">S${pad2(tab.num)} · ${escapeHtml(tab.label)}</h2>
      <div class="beam-panel-subtitle">${escapeHtml(PANEL_SUBTITLES[tab.id] || "")}</div>
    </div>
    ${body}
  `;
}

// Per-tab subtitle and body overrides. Stubs where calcs aren't implemented yet;
// real content replaces these per phase.
const PANEL_SUBTITLES = {
  introduction: "The overview: Lifetime Carbon, Annual Carbon and TEUI, Reference · Target · Actual",
  project: "Building information · main-building and garage dimensions",
  transmission: "The envelope: walls by facing, their hosted windows and doors, roofs and their skylights",
  "volume-surface": "Volumes, surface areas and their ratios",
  glossary: `${GLOSSARY.length} terms: OBJECTIVE's own and the building-science vocabulary`
};

const PANEL_BODIES = {
  project: renderProjectPanel(),
  introduction: `
    <div class="beam-tbd bw-intro">
      <img src="graphics/objective-logo.svg" alt="OBJECTIVE" class="bw-intro-logo" />
      <p class="bw-intro-tagline">the targeted energy use intensity tool</p>
      <h3>OBJECTIVE 4.0</h3>
      <p class="bw-intro-lede">
        The bridge from OBJECTIVE's annual energy model to dynamic hourly analysis, ASHRAE 140 compliance and the
        ABCD.EARTH building model.
      </p>

      <h3>What 4.0 changes</h3>
      <ul class="bw-intro-list">
        <li>Every above-grade wall faces a direction.</li>
        <li>Every window and door sits in a wall, and every skylight in a roof; an opening's area is its width × height.</li>
        <li>Window overhangs set summer shading by CSA F280 Annex A.</li>
        <li>The envelope can come straight from <a href="takeoffeh.html" class="db-kv-link">Take Off, Eh!</a>: each wall with its facing, each window with its width and height.</li>
        <li>Files say their version, so a 4.0 project always reopens whole.</li>
      </ul>

      <h3>Status: in development</h3>
      <p>
        OBJECTIVE's sections are coming across one by one into the sidebar (S01–S21), each as a full page;
        the key values above, and in the band at the top of every section, fill in once the engine arrives.
        OBJECTIVE 3 stays live at
        <a href="https://objective.openbuilding.ca" class="db-kv-link" target="_blank" rel="noopener">objective.openbuilding.ca</a>.
      </p>
      <p>
        Companion tools: <a href="takeoffeh.html" class="db-kv-link">Take Off, Eh!</a> (area takeoff),
        <a href="builders/material-builder.html" class="db-kv-link">Materials</a>,
        <a href="index.html" class="db-kv-link">all OpenBuilding.ca tools</a>.
      </p>
    </div>
  `,
  glossary: renderGlossaryPanel()
};

function renderGlossaryPanel() {
  // Full-term column only shown when distinct from the abbr. Inline search field
  // filters rows on abbr / full / description.
  const rows = GLOSSARY.map((t, i) => {
    const showFull = t.full && t.full !== t.abbr ? `<span class="beam-ref-dim">${escapeHtml(t.full)}</span>` : "";
    return `<tr data-glossary-idx="${i}">
      <td class="beam-ref-term"><strong>${escapeHtml(t.abbr)}</strong>${t.source ? ` <span class="op-gl-src">${escapeHtml(t.source)}</span>` : ""}${showFull ? "<br>" + showFull : ""}</td>
      <td class="beam-ref-desc">${escapeHtml(t.desc) || '<span class="beam-ref-dim">—</span>'}</td>
    </tr>`;
  }).join("");
  return `
    <div class="beam-ref-pane">
      <div class="beam-ref-controls">
        <div class="beam-ref-search-wrap">
          <i class="bi bi-search beam-ref-search-icon"></i>
          <input type="search" id="beam-glossary-search" placeholder="Search terms, abbreviations, descriptions…" autocomplete="off" spellcheck="false" />
        </div>
        <span id="beam-glossary-count" class="beam-ref-count">${GLOSSARY.length} terms</span>
      </div>
      <table class="beam-ref-table beam-glossary-table">
        <thead>
          <tr>
            <th style="width: 240px">Term</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody id="beam-glossary-body">${rows}</tbody>
      </table>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────────
// S01 heads-up display — the three key-value rows, in the masthead on every
// section (Andy 2026-11-25). Values arrive with the engine (P1); each cell
// names its OBJECTIVE field (data-kv) so the engine stamps it.
// ──────────────────────────────────────────────────────────────────────
const KEY_VALUE_ROWS = [
  {
    id: "T.1",
    label: "Lifetime Carbon",
    unit: "kgCO2e/m\u00b2 · service life",
    ref: "e_6",
    target: "h_6",
    actual: "k_6",
    pct: "m_6"
  },
  {
    id: "T.2",
    label: "Annual Carbon",
    unit: "kgCO2e/m\u00b2/yr",
    ref: "e_8",
    target: "h_8",
    actual: "k_8",
    pct: "m_8"
  },
  { id: "T.3", label: "TEUI", unit: "kWh/m\u00b2/yr", ref: "e_10", target: "h_10", actual: "k_10", pct: "m_10" }
];

function keyValuesTable(cls) {
  const cell = (f) => `<td class="num"><span data-kv="${f}">\u2014</span></td>`;
  const rows = KEY_VALUE_ROWS.map(
    (r) => `<tr>
      <th scope="row"><span class="op-kv-id">${r.id}</span>${escapeHtml(r.label)}<span class="op-kv-unit">${escapeHtml(r.unit)}</span></th>
      ${cell(r.ref)}${cell(r.target)}${cell(r.actual)}${cell(r.pct)}
    </tr>`
  ).join("");
  return `<table class="${cls}">
    <thead><tr><th></th><th class="num">Reference</th><th class="num">Target</th><th class="num">Actual</th><th class="num">%</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// Each HUD cell mirrors V3's own Key Values section (#keyValues, now in S01):
// the same field, as V3 displays it. The engine writes the StateManager without
// notifying listeners and DOMBridge stamps the DOM, so the DOM is the signal.
function stampHudFromEngine() {
  const source = document.getElementById("keyValues");
  if (!source) return;
  const stamp = () => {
    for (const el of document.querySelectorAll("#op-hud [data-kv]")) {
      const v3 = source.querySelector(`[data-field-id="${el.dataset.kv}"]`);
      const text = v3 ? v3.textContent.trim() : "";
      el.textContent = text || "\u2014";
      if (v3?.dataset.status) el.dataset.status = v3.dataset.status;
    }
  };
  new window.MutationObserver(stamp).observe(source, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true
  });
  stamp();
}

function renderHud() {
  const hud = document.getElementById("op-hud");
  if (!hud) return;
  hud.innerHTML = keyValuesTable("op-kv-table op-kv-hud");
  hud.title = "S01 Key Values · the values arrive with the engine (port P1)";
  hud.addEventListener("click", () => setActiveTab("introduction"));
  stampHudFromEngine();
}

// ──────────────────────────────────────────────────────────────────────
// Tab routing
// ──────────────────────────────────────────────────────────────────────
function setActiveTab(tabId) {
  if (!FLAT_TABS.some((t) => t.id === tabId)) tabId = DEFAULT_TAB;
  state.activeTab = tabId;
  for (const btn of document.querySelectorAll(".beam-tab-button")) {
    btn.classList.toggle("active", btn.dataset.tabId === tabId);
  }
  for (const panel of document.querySelectorAll(".beam-tab-panel")) {
    panel.classList.toggle("active", panel.id === `beam-panel-${tabId}`);
  }
  if (location.hash !== `#${tabId}`) {
    history.replaceState(null, "", `#${tabId}`);
  }
  document.getElementById("beam-content").scrollTop = 0;
}
function readInitialTabFromHash() {
  const id = (location.hash || "").replace(/^#/, "");
  return id && FLAT_TABS.some((t) => t.id === id) ? id : null;
}
function wireKeyboard() {
  window.addEventListener("hashchange", () => setActiveTab(readInitialTabFromHash() || state.activeTab));
}

// ──────────────────────────────────────────────────────────────────────
// Action bar — New / Open / Save / Import / Load Sample / Reset Tab.
// ──────────────────────────────────────────────────────────────────────
const TAB_RESETTERS = {
  project: { label: "PROJECT", fn: resetProjectTab }
};

function handleResetActiveTab() {
  const tab = state.activeTab;
  const entry = TAB_RESETTERS[tab];
  if (!entry) {
    setStatus("Reset arrives with this section in the port.", "busy");
    setTimeout(() => setStatus(READY_MSG, "ready"), 3000);
    return;
  }
  const ok = window.confirm(
    `Reset "${entry.label}" to a blank state?\n\n` +
      `This clears only the inputs on this tab. Other tabs, Take Off, Eh! polygon data, and any saved project file are preserved.`
  );
  if (!ok) return;
  entry.fn();
  setStatus(`"${entry.label}" reset to blank state.`, "ready");
  setTimeout(() => setStatus(READY_MSG, "ready"), 3000);
}

function handleNewProject() {
  const ok = window.confirm(
    "Start a fresh project?\n\n" +
      "This clears all inputs across every tab. Use Save first if you want to keep the current project."
  );
  if (!ok) return;
  StateManager.clear();
  // Reload to re-render every tab from blank state without further wiring.
  location.reload();
}

async function handleLoadSample() {
  // Single sample today; widen to a dropdown when more case-study buildings land.
  const sampleId = "single-family-home";
  const entry = SAMPLES[sampleId];
  const ok = window.confirm(
    `Load "${entry.label}"?\n\n` +
      `This fills PROJECT with the sample's dimensions. ` +
      `Existing inputs in those fields will be overwritten — Save first if you want to keep your work.`
  );
  if (!ok) return;
  setStatus(`Loading sample: ${entry.label}…`, "busy");
  try {
    const result = await loadSample(sampleId);
    setStatus(`Loaded "${result.label}" · ${result.projectFieldCount} PROJECT fields.`, "ready");
  } catch (err) {
    console.error("[load-sample]", err);
    setStatus(
      `Load Sample failed: ${err.message}. Run \`npm run stage:data\` to copy sample JSON into data/.`,
      "error"
    );
  }
}

function wireActionBar() {
  const handlers = {
    "beam-new-project": handleNewProject,
    "beam-open-project": () => notImplemented("Open project JSON — file-handler import wiring lands next."),
    "beam-save-project": () => notImplemented("Save project JSON — file-handler export wiring lands next."),
    "beam-import-takeoffeh": handleImportTakeOffEh,
    "beam-trust-takeoffeh": handleTrustTakeOffEh,
    "beam-load-sample": handleLoadSample,
    "beam-reset": handleResetActiveTab
  };
  for (const [id, fn] of Object.entries(handlers)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }
}
const READY_MSG = "Ready · OBJECTIVE 4.0 scaffold · S01, S02, S17, S22 live; the rest arrive in the port";
function notImplemented(msg) {
  setStatus(`not yet implemented · ${msg}`, "busy");
  setTimeout(() => setStatus(READY_MSG, "ready"), 3500);
}

// ──────────────────────────────────────────────────────────────────────
// TakeOffEh import modal
// ──────────────────────────────────────────────────────────────────────
// Reads saved TakeOffEh projects from IndexedDB, runs the bridge aggregator
// against the user's current param_* values, and previews the proposed
// changes in a modal. Only rows the user checks are written on Apply.

const importModalState = {
  projects: [],
  activeUuid: null,
  preview: null
};

async function handleImportTakeOffEh() {
  openImportModal();
  try {
    importModalState.projects = await PdfBridge.listProjects();
  } catch (err) {
    console.error("[BEAMweb] failed to read TakeOffEh projects:", err);
    renderImportEmpty(
      "Could not read saved Take Off, Eh! projects from IndexedDB. Open the Take Off, Eh! tab, load a PDF, then try again."
    );
    return;
  }
  if (importModalState.projects.length === 0) {
    renderImportEmpty(
      "No Take Off, Eh! projects found. Open the Take Off, Eh! tab, load a drawing, tag some polygons, then return here."
    );
    return;
  }
  importModalState.activeUuid = importModalState.projects[0].uuid;
  await refreshImportPreview();
}

// Trust: one-click bulk apply of every computable dim from the most
// recently saved TakeOffEh project. Skips the review modal entirely.
// Trust + Verify (the modal) stays available anytime — users can always
// re-open it to audit what landed.
async function handleTrustTakeOffEh() {
  let projects;
  try {
    projects = await PdfBridge.listProjects();
  } catch (err) {
    console.error("[BEAMweb] Trust: failed to read TakeOffEh projects:", err);
    setStatus("Trust: could not read Take Off, Eh! sessions from IndexedDB.", "error");
    return;
  }
  if (projects.length === 0) {
    setStatus("Trust: no saved Take Off, Eh! session found. Use Take Off, Eh! first.", "error");
    return;
  }
  const project = projects[0];
  let preview;
  try {
    preview = await PdfBridge.buildPreview(project.uuid);
  } catch (err) {
    console.error("[BEAMweb] Trust: preview failed:", err);
    setStatus(`Trust: preview failed · ${err.message}`, "error");
    return;
  }
  const dimIds = preview.rows.filter((r) => r.hasValue).map((r) => r.dimId);
  if (dimIds.length === 0) {
    setStatus(
      "Trust: no computable dimensions in the latest Take Off, Eh! session. Tag polygons there first.",
      "error"
    );
    return;
  }
  try {
    const result = await PdfBridge.applyImport(project.uuid, dimIds);
    setStatus(
      `Trust: imported ${result.applied} dimension${result.applied === 1 ? "" : "s"} from ${escapeHtml(project.pdfFileName)} · click Trust + Verify to review`,
      "ready"
    );
    refreshProjectForm();
  } catch (err) {
    console.error("[BEAMweb] Trust apply failed:", err);
    setStatus(`Trust: apply failed · ${err.message}`, "error");
  }
}

function openImportModal() {
  document.getElementById("bw-pdf-import-backdrop").classList.add("visible");
  document.getElementById("bw-pdf-import-modal").classList.add("visible");
  document.getElementById("bw-pdf-import-apply").disabled = true;
  document.getElementById("bw-pdf-import-hint").textContent = "";
  document.getElementById("bw-pdf-import-body").innerHTML =
    '<p class="bw-pdf-import-empty">Loading saved Take Off, Eh! projects\u2026</p>';
}

function closeImportModal() {
  document.getElementById("bw-pdf-import-backdrop").classList.remove("visible");
  document.getElementById("bw-pdf-import-modal").classList.remove("visible");
  importModalState.projects = [];
  importModalState.activeUuid = null;
  importModalState.preview = null;
}

function renderImportEmpty(msg) {
  document.getElementById("bw-pdf-import-body").innerHTML = `<p class="bw-pdf-import-empty">${escapeHtml(msg)}</p>`;
  document.getElementById("bw-pdf-import-apply").disabled = true;
}

async function refreshImportPreview() {
  const body = document.getElementById("bw-pdf-import-body");
  body.innerHTML = '<p class="bw-pdf-import-empty">Computing dimensions\u2026</p>';
  const preview = await PdfBridge.buildPreview(importModalState.activeUuid);
  importModalState.preview = preview;
  body.innerHTML = renderImportBody(preview);
  wireImportBody();
}

function renderImportBody(preview) {
  const { project, rows, paramsComplete } = preview;
  const picker = renderImportPicker(project.uuid);
  const paramWarn = paramsComplete
    ? ""
    : '<div class="bw-pdf-import-warn">One or more geometry parameters are blank on PROJECT. Dimensions depending on those params cannot import until they are filled in — open PROJECT → Geometry Parameters.</div>';

  const hasApplicable = rows.some((r) => r.hasValue);
  if (!hasApplicable) {
    return (
      picker +
      paramWarn +
      '<p class="bw-pdf-import-empty">No polygons in this project carry component tags that map to BEAMweb dimensions yet. Tag polygons in Take Off, Eh! (foundation slab, exterior wall, interior polyline, etc.) and try again.</p>'
    );
  }

  const tableRows = rows.map(renderImportRow).join("");
  return `
    ${picker}
    ${paramWarn}
    <table class="bw-pdf-import-table">
      <thead>
        <tr>
          <th style="width:24px;"><input type="checkbox" id="bw-pdf-import-all" checked /></th>
          <th>Dimension</th>
          <th class="num">Current</th>
          <th class="num">Computed</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

function renderImportPicker(activeUuid) {
  if (importModalState.projects.length <= 1) {
    const p = importModalState.projects[0];
    return `<div class="bw-pdf-import-picker"><label>Project</label><span>${escapeHtml(p.pdfFileName)} \u00b7 saved ${formatRelativeTime(p.updatedAt)}</span></div>`;
  }
  const options = importModalState.projects
    .map((p) => {
      const sel = p.uuid === activeUuid ? " selected" : "";
      return `<option value="${p.uuid}"${sel}>${escapeHtml(p.pdfFileName)} \u00b7 ${formatRelativeTime(p.updatedAt)}</option>`;
    })
    .join("");
  return `<div class="bw-pdf-import-picker"><label>Project</label><select id="bw-pdf-import-project">${options}</select></div>`;
}

function renderImportRow(row) {
  const currentStr = row.current != null ? Number(row.current).toFixed(2) : "\u2014";
  const computedStr = row.hasValue ? Number(row.computed).toFixed(2) : "\u2014";
  const deltaClass =
    row.hasValue && row.current != null && Number(row.current) !== row.computed ? "delta overwrite" : "delta";
  const checked = row.hasValue ? "checked" : "";
  const disabled = row.hasValue ? "" : "disabled";
  const skipped = row.hasValue ? "" : "skipped";

  let sourceHtml = `<div class="bw-pdf-import-summary">${escapeHtml(row.summary)}</div>`;
  const sheets = collectSheets(row.contributors);
  if (sheets.length) sourceHtml += `<div class="bw-pdf-import-sheets">sheets: ${renderSheetLinks(sheets)}</div>`;
  if (row.assemblyPresets && row.assemblyPresets.length)
    sourceHtml += `<div class="bw-pdf-import-sheets">preset: ${escapeHtml(row.assemblyPresets.join(", "))}</div>`;
  if (row.missingParams && row.missingParams.length)
    sourceHtml += `<div class="bw-pdf-import-warn-inline">missing: ${escapeHtml(row.missingParams.join(", "))}</div>`;

  return `
    <tr class="${skipped}" data-dim-id="${row.dimId}">
      <td><input type="checkbox" class="bw-pdf-import-row-cb" ${checked} ${disabled} data-dim-id="${row.dimId}" /></td>
      <td><span class="bw-pdf-import-dim">${escapeHtml(row.dimId)}</span></td>
      <td class="num">${currentStr}</td>
      <td class="num ${deltaClass}">${computedStr}</td>
      <td>${sourceHtml}</td>
    </tr>
  `;
}

function collectSheets(contributors) {
  const s = new Set();
  for (const c of contributors) for (const sh of c.sheets || []) s.add(sh);
  return Array.from(s);
}

// Render sheet IDs as deep links into the TakeOffEh app. target="takeoffeh-tab"
// is a named browsing-context so the same Parser tab gets navigated and focused
// when the user clicks multiple sheet refs — avoids a new tab per click.
// Parser reads #sheet=X on load and on hashchange; see _applySheetHash in app.mjs.
function renderSheetLinks(sheets) {
  return sheets
    .map((s) => {
      const encoded = encodeURIComponent(s);
      return `<a href="takeoffeh.html#sheet=${encoded}" target="takeoffeh-tab" class="bw-sheet-link">${escapeHtml(s)}</a>`;
    })
    .join(", ");
}

function formatRelativeTime(iso) {
  if (!iso) return "just now";
  const d = new Date(iso);
  const now = Date.now();
  const deltaMin = Math.round((now - d.getTime()) / 60000);
  if (deltaMin < 1) return "just now";
  if (deltaMin < 60) return `${deltaMin}m ago`;
  if (deltaMin < 1440) return `${Math.round(deltaMin / 60)}h ago`;
  return d.toLocaleString();
}

function wireImportBody() {
  const projectSel = document.getElementById("bw-pdf-import-project");
  if (projectSel) {
    projectSel.addEventListener("change", (e) => {
      importModalState.activeUuid = e.target.value;
      refreshImportPreview();
    });
  }

  const allCb = document.getElementById("bw-pdf-import-all");
  if (allCb) {
    allCb.addEventListener("change", () => {
      const rows = document.querySelectorAll(".bw-pdf-import-row-cb:not(:disabled)");
      for (const cb of rows) cb.checked = allCb.checked;
      updateApplyButton();
    });
  }

  const rowCbs = document.querySelectorAll(".bw-pdf-import-row-cb");
  for (const cb of rowCbs) cb.addEventListener("change", updateApplyButton);
  updateApplyButton();
}

function updateApplyButton() {
  const applyBtn = document.getElementById("bw-pdf-import-apply");
  const hint = document.getElementById("bw-pdf-import-hint");
  const checked = document.querySelectorAll(".bw-pdf-import-row-cb:checked");
  applyBtn.disabled = checked.length === 0;
  hint.textContent = checked.length ? `${checked.length} dimension${checked.length === 1 ? "" : "s"} selected` : "";
}

async function applyImportSelection() {
  const checked = document.querySelectorAll(".bw-pdf-import-row-cb:checked");
  const dimIds = Array.from(checked).map((cb) => cb.dataset.dimId);
  if (dimIds.length === 0) return;
  try {
    const result = await PdfBridge.applyImport(importModalState.activeUuid, dimIds);
    setStatus(
      `Imported ${result.applied} dimension${result.applied === 1 ? "" : "s"} from Take Off, Eh! · ${escapeHtml(result.project.pdfFileName)}`,
      "ready"
    );
    closeImportModal();
    // Refresh the PROJECT tab so the new values render in their inputs AND
    // LHW fields recompute their _volume (as CALCULATED).
    refreshProjectForm();
  } catch (err) {
    console.error("[BEAMweb] TakeOffEh import failed:", err);
    setStatus(`Take Off, Eh! import failed: ${err.message}`, "error");
  }
}

function wireImportModal() {
  document.getElementById("bw-pdf-import-close").addEventListener("click", closeImportModal);
  document.getElementById("bw-pdf-import-cancel").addEventListener("click", closeImportModal);
  document.getElementById("bw-pdf-import-backdrop").addEventListener("click", closeImportModal);
  document.getElementById("bw-pdf-import-apply").addEventListener("click", applyImportSelection);
}

// ──────────────────────────────────────────────────────────────────────
// Status helpers
// ──────────────────────────────────────────────────────────────────────
function setStatus(msg, kind) {
  const el = document.getElementById("beam-status-msg");
  if (!el) return;
  el.textContent = msg;
  el.className = kind === "busy" ? "status-busy" : kind === "error" ? "status-error" : "status-ready";
}

// ──────────────────────────────────────────────────────────────────────
// Global for debugging: window.BEAM.*
// Mirrors OBJECTIVE's window.TEUI.* namespace so algorithms port cleanly.
// ──────────────────────────────────────────────────────────────────────
window.BEAM = {
  state,
  setActiveTab,
  TABS: BEAM_TABS,
  FLAT_TABS,
  version: "0.0.1-alpha"
};

// ──────────────────────────────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
