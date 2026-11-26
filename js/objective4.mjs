/**
 * OBJECTIVE 4.0 (objectivepro.html) — app entry + section router.
 *
 * The sidebar is OBJECTIVE's S01–S21 plus S22 the Glossary
 * (schema/schema.md §9). Live: S01 Key Values, S02 PROJECT,
 * S17 Dependency Graph, S22 Glossary; the rest arrive in the port (P2: S11,
 * S12; P3: the others). The S01 heads-up display rides the masthead on every
 * section. The BEAM calculator's tabs are gone (Andy 2026-11-25: no legacy).
 *
 * Code names (objective4.mjs, js/beam/, window.BEAM) stay until the port.
 */

import { GLOSSARY } from "./beam/reference-data.mjs";
import { StateManager } from "./shared/state-manager.mjs";
import { esc as escapeHtml } from "./shared/html-utils.mjs";
import * as PdfBridge from "./beam/pdf-bridge-import.mjs";

// ──────────────────────────────────────────────────────────────────────
// Section definitions — OBJECTIVE's S01–S21 (schema/schema.md §9.1), plus
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
  // On launch only S01 is open (Andy 2026-11-26); the sidebar opens a section, and it stays open until closed.
  for (const card of document.querySelectorAll(".op-v3-card")) setCardOpen(card, card.dataset.tabId === DEFAULT_TAB);
  syncToggleAll();
  setActiveTab(readInitialTabFromHash() || DEFAULT_TAB);
  showDisclaimerOnFirstLaunch();
}

// "Using this calculator" (V3's disclaimer modal): shown on the first launch, and from the masthead's
// yellow Disclaimer button after that.
const DISCLAIMER_SEEN = "objective4DisclaimerSeen";
function showDisclaimerOnFirstLaunch() {
  const el = document.getElementById("disclaimerModal");
  if (!el || !window.bootstrap) return;
  el.addEventListener("hidden.bs.modal", () => localStorage.setItem(DISCLAIMER_SEEN, "true"));
  if (!localStorage.getItem(DISCLAIMER_SEEN)) new window.bootstrap.Modal(el).show();
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
// Content — ONE page: every section is a card in one container, all present
// (Andy 2026-11-26, as V3: the sidebar scrolls to a card, one + / − in the
// button row opens or closes them all, and the browser's Print prints the lot).
// ──────────────────────────────────────────────────────────────────────
function renderContentShell() {
  const content = document.getElementById("beam-content");
  const page = document.createElement("div");
  page.className = "op-onepage";
  for (const tab of FLAT_TABS) page.appendChild(sectionCard(tab));
  content.replaceChildren(page);
  document.getElementById("op-v3-sections")?.remove();
}

// A section's card (.bw-asm-group, the PROJECT form's): a radiused, collapsible
// header carrying the section's name and its subtitle, and a body holding V3's
// section (FieldManager renders into its .section-content on DOMContentLoaded,
// which this module runs before) and then anything of the page's own.
function sectionCard(tab) {
  const card = document.createElement("section");
  card.className = "bw-asm-group op-v3-card";
  card.id = `beam-panel-${tab.id}`;
  card.dataset.tabId = tab.id;
  const sub = PANEL_SUBTITLES[tab.id];
  card.innerHTML = `
    <header class="bw-asm-group-header">
      <button class="bw-asm-toggle" type="button" aria-expanded="true">\u25BC</button>
      <h3 class="bw-asm-group-name">S${pad2(tab.num)} ${escapeHtml(tab.label)}</h3>
      ${sub ? `<span class="op-card-subtitle">${escapeHtml(sub)}</span>` : ""}
    </header>
    <div class="bw-asm-group-body">${PANEL_BODIES[tab.id] || ""}</div>`;
  const v3 = tab.v3 && document.getElementById(tab.v3);
  if (v3) card.querySelector(".bw-asm-group-body").prepend(v3);
  card.querySelector(".bw-asm-group-header").addEventListener("click", () => {
    setCardOpen(card, card.querySelector(".bw-asm-group-body").hidden);
    syncToggleAll();
  });
  return card;
}

function setCardOpen(card, open) {
  const body = card.querySelector(".bw-asm-group-body");
  const btn = card.querySelector(".bw-asm-toggle");
  body.hidden = !open;
  btn.textContent = open ? "\u25BC" : "\u25B6";
  btn.setAttribute("aria-expanded", String(open));
}

// The + / − at the far right of the button row: − closes every card, + opens them all.
function anyCardOpen() {
  return [...document.querySelectorAll(".op-v3-card > .bw-asm-group-body")].some((b) => !b.hidden);
}
function syncToggleAll() {
  const btn = document.getElementById("op-toggle-all");
  if (!btn) return;
  const open = anyCardOpen();
  btn.textContent = open ? "\u2212" : "+";
  btn.title = open ? "Collapse every section" : "Expand every section";
  btn.setAttribute("aria-expanded", String(open));
}
function toggleAllCards() {
  const open = !anyCardOpen();
  for (const card of document.querySelectorAll(".op-v3-card")) setCardOpen(card, open);
  syncToggleAll();
  scrollToCard(state.activeTab); // the section being read stays at the top
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Per-section subtitle (shown in the card's header, beside the name) and the page's own body, under V3's.
const PANEL_SUBTITLES = {
  introduction: "The overview: Lifetime Carbon, Annual Carbon and TEUI, Reference · Target · Actual",
  project: "Building information: occupancy, standards, service life, energy prices and project data",
  climate: "The weather station, degree days, design temperatures and the ground",
  "actual-target": "Utility bills against the Target, by fuel: energy, emissions and primary energy",
  emissions: "Operational carbon (B6) each year and over the service life; embodied carbon (A1-3)",
  renewables: "Photovoltaics, wind, offsite renewables and the loads kept out of the TEUI",
  water: "Water use, hot water demand, its system and drain water heat recovery",
  iaq: "Radon, CO2, TVOC and indoor humidity against guidance limits",
  "occupant-gains": "Occupants, plug, lighting and equipment loads, and the heat they give off",
  "radiant-gains": "Solar gains through each window and door: orientation, SHGC and shading",
  transmission: "The envelope: walls by facing, their hosted windows and doors, roofs and their skylights",
  "volume-surface": "Volumes, surface areas and their ratios",
  mechanical: "Heating, cooling and ventilation systems, their efficiencies and their loads",
  "tedi-teli": "Thermal energy demand and loss intensities, heating and cooling",
  teui: "Total energy use: the TEUI, peak loads, energy cost and the reduction from Reference",
  sankey: "Where the energy goes: the building's flows as a diagram",
  "dependency-graph": "Which value depends on which: every field and its links",
  optimize: "The paths between the Reference and Target configurations",
  wombat: "The building's thermal topology, drawn in 3D",
  notes: "Project notes and the QC report",
  f280: "Residential heat loss and heat gain to CSA F280, with the designer's certification",
  glossary: `${GLOSSARY.length} terms: OBJECTIVE's own and the building-science vocabulary`
};

const PANEL_BODIES = {
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
// Section routing — the sidebar's S01–S22 are anchors into the one page: a
// click opens the card and scrolls to it; scrolling marks the card at the top.
// ──────────────────────────────────────────────────────────────────────
let spyQuietUntil = 0; // a jump's own scroll events do not re-mark the sidebar
let pendingAnchor = null; // the #section the page was opened at, until the page has filled in above it

function markActive(tabId) {
  if (state.activeTab === tabId && document.querySelector(".beam-tab-button.active")) return;
  state.activeTab = tabId;
  for (const btn of document.querySelectorAll(".beam-tab-button")) {
    const on = btn.dataset.tabId === tabId;
    btn.classList.toggle("active", on);
    if (on) btn.scrollIntoView({ block: "nearest" });
  }
  if (location.hash !== `#${tabId}`) {
    history.replaceState(null, "", `#${tabId}`);
  }
}
function setActiveTab(tabId) {
  if (!FLAT_TABS.some((t) => t.id === tabId)) tabId = DEFAULT_TAB;
  const card = document.getElementById(`beam-panel-${tabId}`);
  if (card.querySelector(".bw-asm-group-body").hidden) {
    setCardOpen(card, true);
    syncToggleAll();
  }
  scrollToCard(tabId);
  markActive(tabId);
}
function scrollToCard(tabId) {
  spyQuietUntil = Date.now() + 200;
  if (tabId === DEFAULT_TAB) document.getElementById("beam-content").scrollTop = 0;
  else document.getElementById(`beam-panel-${tabId}`).scrollIntoView({ block: "start" });
}
// The active section is the last card whose top has reached the top of the pane.
function updateActiveFromScroll() {
  if (Date.now() < spyQuietUntil || pendingAnchor) return;
  const content = document.getElementById("beam-content");
  const line = content.getBoundingClientRect().top + 60;
  let current = DEFAULT_TAB;
  for (const card of content.querySelectorAll(".op-v3-card")) {
    if (card.getBoundingClientRect().top > line) break;
    current = card.dataset.tabId;
  }
  markActive(current);
}
function readInitialTabFromHash() {
  const id = (location.hash || "").replace(/^#/, "");
  return id && FLAT_TABS.some((t) => t.id === id) ? id : null;
}
function wireKeyboard() {
  window.addEventListener("hashchange", () => setActiveTab(readInitialTabFromHash() || state.activeTab));
  const content = document.getElementById("beam-content");
  let queued = false;
  content.addEventListener(
    "scroll",
    () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        updateActiveFromScroll();
      });
    },
    { passive: true }
  );
  // A page opened at #section: the sections above it fill in after boot (V3's renders, then the default
  // case), so return to the anchor once they have, unless the reader has moved on.
  const opened = readInitialTabFromHash();
  if (opened && opened !== DEFAULT_TAB) {
    pendingAnchor = opened;
    const release = () => (pendingAnchor = null);
    for (const ev of ["wheel", "touchmove", "keydown", "pointerdown"]) {
      document.addEventListener(ev, release, { passive: true, once: true });
    }
    for (const ms of [800, 2600]) {
      setTimeout(() => {
        if (pendingAnchor) scrollToCard(pendingAnchor);
        if (ms === 2600) release();
      }, ms);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────
// Action bar. Open, Save and Load Sample are V3's: FileHandler wires
// #import-data-btn / #excel-file-input / #export-data-btn, and fills
// #sampleProjectModal's list with OBJECTIVE's case studies.
// ──────────────────────────────────────────────────────────────────────
// Reset returns every value to the last project loaded or imported (V3's
// "Reset Imported", StateManager.revertToLastImportedState).
// The model on screen (the Reference Port): V3's ReferenceToggle switches every section, the engine restamps
// the values and the inputs; the body's .reference-mode class (set there) carries the whole Reference look.
function showModel(mode) {
  const RT = window.TEUI && window.TEUI.ReferenceToggle;
  if (!RT || !RT.switchMode) return;
  RT.switchMode(mode);
  syncModelToggle();
}
function syncModelToggle() {
  const RT = window.TEUI && window.TEUI.ReferenceToggle;
  const mode = RT && RT.getCurrentMode ? RT.getCurrentMode() : "target";
  const pill = document.getElementById("op-model-switch");
  if (pill) pill.checked = mode === "reference";
  document.querySelectorAll(".op-model-label").forEach((l) => l.classList.toggle("active", l.dataset.model === mode));
}

function handleReset() {
  const SM = window.TEUI?.StateManager;
  if (!SM?.revertToLastImportedState) return;
  if (!window.confirm("Return every value to the last project you loaded or imported?")) return;
  SM.revertToLastImportedState();
  setStatus("Values returned to the last loaded project.", "ready");
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

function wireActionBar() {
  const handlers = {
    "beam-new-project": handleNewProject,
    "beam-import-takeoffeh": handleImportTakeOffEh,
    "beam-trust-takeoffeh": handleTrustTakeOffEh,
    "beam-reset": handleReset,
    "op-toggle-all": toggleAllCards,
    "op-model-target": () => showModel("target"),
    "op-model-reference": () => showModel("reference")
  };
  for (const [id, fn] of Object.entries(handlers)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }
  const pill = document.getElementById("op-model-switch");
  if (pill) pill.addEventListener("change", () => showModel(pill.checked ? "reference" : "target"));
  // V3's own switches (S01's Key Values toggle, a file import) change the mode too: follow the body's class
  syncModelToggle();
  new window.MutationObserver(syncModelToggle).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}
const READY_MSG = "Ready · OBJECTIVE 4.0";

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

// Trust: one-click apply of every computable OBJECTIVE field (S02's
// Conditioned Area, S11's envelope areas, S12's volume — PdfBridge.V3_TARGETS)
// from the most recently saved Take Off, Eh! project. Skips the review modal entirely.
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
      "Trust: nothing to import from the latest Take Off, Eh! session. Tag its floor plans, roof, walls and foundation there first.",
      "error"
    );
    return;
  }
  try {
    const result = await PdfBridge.applyImport(project.uuid, dimIds);
    setStatus(
      `Trust: ${result.applied} value${result.applied === 1 ? "" : "s"} into S02 / S11 / S12 from ${escapeHtml(project.pdfFileName)} · Trust + Verify to review`,
      "ready"
    );
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
    : '<div class="bw-pdf-import-warn">One or more geometry parameters (wall height, basement height, roof pitch) are blank in Take Off, Eh!. Rows that need them cannot import until they are entered in its sidebar.</div>';

  const hasApplicable = rows.some((r) => r.hasValue);
  if (!hasApplicable) {
    return (
      picker +
      paramWarn +
      '<p class="bw-pdf-import-empty">Nothing in this project maps to OBJECTIVE yet. Tag its floor plans (foundation / above-grade slab), roof plan, exterior walls and perimeter in Take Off, Eh! and try again.</p>'
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
      <td><span class="bw-pdf-import-dim">${escapeHtml(row.label || row.dimId)}</span></td>
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
      `Imported ${result.applied} value${result.applied === 1 ? "" : "s"} into S02 / S11 / S12 from Take Off, Eh! · ${escapeHtml(result.project.pdfFileName)}`,
      "ready"
    );
    closeImportModal();
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
