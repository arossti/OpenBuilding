/**
 * BEAMweb — app entry + tab router.
 *
 * Phase 0 shell. No calc engine, no live state — just the app frame with
 * all 17 BEAM tabs stubbed. Future phases wire up:
 *   - Phase 1: state-manager.mjs + file-handler.mjs (3-tier reset, localStorage)
 *   - Phase 2: PROJECT tab form + unit converter
 *   - Phase 3: first assembly tab with real material DB fetch + per-row calc
 *   - ...
 *
 * Design: BEAMweb code is ESM (matches PDF-Parser conventions). Vendor JS
 * (Bootstrap, SheetJS) loads as classic script tags on the window. OBJECTIVE
 * patterns (3-tier reset, dual-state, data-render-section) are ported by API
 * shape; no files are copied verbatim.
 */

/* eslint-disable no-undef */

import { ENERGY_GHG, GLOSSARY } from "./beam/reference-data.mjs";
import { StateManager } from "./shared/state-manager.mjs";
import { renderProjectPanel, wireProjectForm, resetProjectTab } from "./beam/project-tab.mjs";
import { renderFootingsSlabsPanel, wireFootingsSlabsTab, resetFootingsSlabsTab } from "./beam/footings-slabs-tab.mjs";
import { loadSample, SAMPLES } from "./beam/sample-loader.mjs";

// ──────────────────────────────────────────────────────────────────────
// Tab definitions
// Grouped for sidebar display; order is the BEAM workbook order.
// Each tab declares which phase unlocks its implementation.
// ──────────────────────────────────────────────────────────────────────
const BEAM_TABS = [
  { group: "Project",       tabs: [
    { id: "introduction",       num: 1,  label: "Introduction",        phase: 0 },
    { id: "project",            num: 2,  label: "PROJECT",             phase: 0 },
  ]},
  { group: "Below-grade",   tabs: [
    { id: "footings-slabs",     num: 3,  label: "Footings & Slabs",    phase: 0 },
    { id: "foundation-walls",   num: 4,  label: "Foundation Walls",    phase: 4 },
  ]},
  { group: "Structure",     tabs: [
    { id: "structural-elements",num: 5,  label: "Structural Elements", phase: 4 },
    { id: "exterior-walls",     num: 6,  label: "Exterior Walls",      phase: 4 },
    { id: "party-walls",        num: 7,  label: "Party Walls",         phase: 4 },
    { id: "cladding",           num: 8,  label: "Cladding",            phase: 4 },
    { id: "windows",            num: 9,  label: "Windows",             phase: 4 },
    { id: "interior-walls",     num: 10, label: "Interior Walls",      phase: 4 },
    { id: "floors",             num: 11, label: "Floors",              phase: 4 },
    { id: "ceilings",           num: 12, label: "Ceilings",            phase: 4 },
    { id: "roof",               num: 13, label: "Roof",                phase: 4 },
    { id: "garage",             num: 14, label: "Garage",              phase: 4 },
  ]},
  { group: "Review + Outputs", tabs: [
    { id: "review",             num: 15, label: "REVIEW",              phase: 5 },
    { id: "results",            num: 16, label: "RESULTS",             phase: 5 },
    { id: "glossary",           num: 17, label: "Glossary",            phase: 0 },
  ]},
  { group: "Reference", tabs: [
    // Not in BEAM; BEAMweb adds it as informational reference.
    { id: "energy-ghg",         num: 18, label: "Energy GHG",          phase: 0 },
  ]},
];

const FLAT_TABS = BEAM_TABS.flatMap(g => g.tabs);
const DEFAULT_TAB = "introduction";

// ──────────────────────────────────────────────────────────────────────
// App state — minimal for now
// ──────────────────────────────────────────────────────────────────────
const state = {
  activeTab: DEFAULT_TAB,
  materialCount: null,       // set when index.json loads
  materialIndex: null,       // full index.json payload (lazy)
};

// ──────────────────────────────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────────────────────────────
function boot() {
  StateManager.loadState();
  renderSidebar();
  renderContentShell();
  wireActionBar();
  wireKeyboard();
  wireGlossarySearch();
  wireProjectForm();
  wireFootingsSlabsTab();  // fires async fetch for data/beam/footings-slabs.csv
  setActiveTab(readInitialTabFromHash() || DEFAULT_TAB);
  loadMaterialIndex();
}

function wireGlossarySearch() {
  const input = document.getElementById("beam-glossary-search");
  const body  = document.getElementById("beam-glossary-body");
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
      btn.innerHTML = `<span class="beam-tab-num">${String(tab.num).padStart(2, "0")}</span>${escapeHtml(tab.label)}`;
      btn.title = `Tab ${tab.num} — unlocks in Phase ${tab.phase}`;
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
    frag.appendChild(panel);
  }
  content.replaceChildren(frag);
}

function renderPanelBody(tab) {
  const phaseCls = tab.phase === 0 ? "ready" : (tab.phase === 2 ? "next" : "");
  const phaseLabel = tab.phase === 0 ? "Phase 0 · shell" : `Unlocks Phase ${tab.phase}`;
  const body = PANEL_BODIES[tab.id] || defaultStub(tab);
  return `
    <div class="beam-panel-header">
      <h2 class="beam-panel-title">
        Tab ${String(tab.num).padStart(2, "0")} · ${escapeHtml(tab.label)}
        <span class="beam-panel-phase ${phaseCls}">${phaseLabel}</span>
      </h2>
      <div class="beam-panel-subtitle">${escapeHtml(PANEL_SUBTITLES[tab.id] || "Assembly tab — curated material list per BEAM methodology.")}</div>
    </div>
    ${body}
  `;
}

// Per-tab subtitle and body overrides. Stubs where calcs aren't implemented yet;
// real content replaces these per phase.
const PANEL_SUBTITLES = {
  introduction: "How BEAMweb works · methodology reference · disclaimer",
  project: "Project metadata · main-building and garage dimensions · feeds every assembly tab",
  "footings-slabs": "Concrete footings · pads & piers · slabs · rebar · sub-slab insulation · basement flooring",
  "foundation-walls": "Concrete / ICF / earth-based foundation walls + insulation",
  "structural-elements": "Steel, heavy timber, framing lumber — posts, beams, joists",
  "exterior-walls": "Framing, sheathing, cavity + continuous insulation, WRB",
  "party-walls": "Fire- + acoustic-separation walls between dwellings",
  cladding: "Exterior finishes — brick, fibre cement, siding, stucco",
  windows: "Double + triple pane glazing units",
  "interior-walls": "Framing, drywall, interior finishes (cladding doubled for both faces)",
  floors: "Floor framing, subfloor, cavity insulation, flooring finishes",
  ceilings: "Ceiling framing + cladding",
  roof: "Roof framing, decking, roof insulation, roofing membrane",
  garage: "Garage components — excluded from whole-building totals by default",
  review: "Inputs sanity-check · area/volume reconciliation · warnings",
  results: "Project EC total · per-component breakdown · operational + embodied summary",
  glossary: `${GLOSSARY.length} terms and definitions from the BEAM workbook`,
  "energy-ghg": `Province-by-province GHG intensities for operational energy (reference only)`,
};

const PANEL_BODIES = {
  project: renderProjectPanel(),
  "footings-slabs": renderFootingsSlabsPanel(),
  introduction: `
    <div class="beam-tbd" style="text-align: left; padding: 28px 32px;">
      <img src="graphics/beam-logo.png" alt="BEAM" class="bw-intro-logo" />
      <h3 style="text-align:center">Welcome to BEAMweb</h3>
      <p style="text-align:center; font-size: 13px; margin: 8px 0 18px 0;">
        A browser port of the BEAM embodied carbon calculator, built for Canadian projects.
      </p>

      <h3 style="margin-top: 20px">How it works</h3>
      <ul>
        <li>Enter your project meta and areas on the <strong>PROJECT</strong> tab — or import them from a BEAM workbook or a PDF-Parser project.</li>
        <li>For each assembly tab (Footings &amp; Slabs through Garage), select the materials you used and the quantities.</li>
        <li>Material emissions come from the <a href="database.html" class="db-kv-link">BfCA material database</a> — 821 records, full EN 15804+A2 per-stage scope.</li>
        <li>Review the totals on <strong>REVIEW</strong> + <strong>RESULTS</strong>. Print to PDF for a project report.</li>
      </ul>

      <h3 style="margin-top: 20px">Status — Phase 0 shell only</h3>
      <p style="margin:6px 0">
        This is the navigation shell. Tabs are stubbed. Calc engine, state management, and file I/O land in Phases 1–3.
      </p>
      <p style="margin:6px 0">
        See <a href="https://github.com/arossti/OpenBuilding/blob/main/BEAMweb.md" class="db-kv-link" target="_blank" rel="noopener">BEAMweb.md</a> for the workplan and open questions.
      </p>
      <p style="margin:6px 0">
        Data source: <a href="database.html" class="db-kv-link">BfCA Material Database</a>.
        Companion apps: <a href="pdfparser.html" class="db-kv-link">PDF-Parser</a> (area takeoff),
        <a href="matrix.html" class="db-kv-link">EC Matrix</a> (regulatory compliance),
        <a href="index.html" class="db-kv-link">app directory</a>,
        <a href="dependencies.html" class="db-kv-link">dependency manifest</a> (dev).
      </p>
    </div>
  `,
  glossary: renderGlossaryPanel(),
  "energy-ghg": renderEnergyGhgPanel(),
};

function renderGlossaryPanel() {
  // Full-term column only shown when distinct from the abbr. Inline search field
  // filters rows on abbr / full / description.
  const rows = GLOSSARY.map((t, i) => {
    const showFull = t.full && t.full !== t.abbr ? `<span class="beam-ref-dim">${escapeHtml(t.full)}</span>` : "";
    return `<tr data-glossary-idx="${i}">
      <td class="beam-ref-term"><strong>${escapeHtml(t.abbr)}</strong>${showFull ? "<br>" + showFull : ""}</td>
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

function renderEnergyGhgPanel() {
  const rows = ENERGY_GHG.factors.map(f => `
    <tr>
      <td class="beam-ref-term">${escapeHtml(f.province)}</td>
      <td class="num">${formatFactor(f.electricity_kgco2e_per_kwh)}</td>
      <td class="num">${formatFactor(f.natural_gas_kgco2e_per_m3)}</td>
      <td class="num">${formatFactor(f.oil_kgco2e_per_l)}</td>
      <td class="num">${formatFactor(f.propane_kgco2e_per_l)}</td>
      <td class="num">${formatFactor(f.wood_kgco2e_per_kg)}</td>
    </tr>
  `).join("");
  return `
    <div class="beam-ref-pane">
      <div class="beam-ref-intro">
        <p>
          Province-by-province GHG intensity factors for operational energy sources. BEAMweb multiplies these against
          your PROJECT-tab energy inputs to compute operational emissions; per-fuel values are shown here for transparency.
        </p>
        <p class="beam-ref-dim">
          This tab is informational reference only. When the Phase 1 state manager lands, projects will be able to override any cell here to use a newer Canadian grid-intensity figure.
        </p>
      </div>
      <table class="beam-ref-table">
        <thead>
          <tr>
            <th style="width: 220px">Province / Territory</th>
            <th class="num" title="Electricity · ${escapeHtml(ENERGY_GHG.units.electricity)}">Electricity</th>
            <th class="num" title="Natural Gas · ${escapeHtml(ENERGY_GHG.units.natural_gas)}">Natural Gas</th>
            <th class="num" title="Oil · ${escapeHtml(ENERGY_GHG.units.oil)}">Oil</th>
            <th class="num" title="Propane · ${escapeHtml(ENERGY_GHG.units.propane)}">Propane</th>
            <th class="num" title="Wood · ${escapeHtml(ENERGY_GHG.units.wood)}">Wood</th>
          </tr>
          <tr class="beam-ref-subhead">
            <th></th>
            <th class="num">${escapeHtml(ENERGY_GHG.units.electricity)}</th>
            <th class="num">${escapeHtml(ENERGY_GHG.units.natural_gas)}</th>
            <th class="num">${escapeHtml(ENERGY_GHG.units.oil)}</th>
            <th class="num">${escapeHtml(ENERGY_GHG.units.propane)}</th>
            <th class="num">${escapeHtml(ENERGY_GHG.units.wood)}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="beam-ref-footer">Source: ${escapeHtml(ENERGY_GHG.source)}.</p>
    </div>
  `;
}

function formatFactor(v) {
  if (v == null) return '<span class="beam-ref-dim">—</span>';
  if (v === 0) return "0";
  // Use exponential for very small, fixed for normal range
  if (Math.abs(v) < 0.0001) return v.toExponential(2);
  return v.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function defaultStub(tab) {
  return `
    <div class="beam-tbd">
      <div class="beam-tbd-icon"><i class="bi bi-hourglass-split"></i></div>
      <h3>Implementation pending · Phase ${tab.phase}</h3>
      <p>This tab follows the standard BEAM assembly-tab pattern:</p>
      <ul>
        <li>Pre-curated candidate material list (subset of the <a href="database.html" class="db-kv-link">BfCA material database</a>)</li>
        <li>User toggles <code>SELECT</code> and enters <code>QUANTITY</code> per row</li>
        <li>Section-level config (thickness, R-value, framing spacing) above each sub-category</li>
        <li>Per-row net kgCO2e emissions computed from <code>material.carbon.common.value_kgco2e × quantity × %</code></li>
        <li>Tab subtotal rolls into project total on <code>RESULTS</code></li>
      </ul>
      <p style="margin-top: 14px;">
        Awaiting BEAM CSV exports (with formulas) from the unlocked workbook.
        See <a href="https://github.com/arossti/OpenBuilding/blob/main/BEAMweb.md#2-reference-source--the-beam-spreadsheet" class="db-kv-link" target="_blank" rel="noopener">BEAMweb.md §2</a>.
      </p>
    </div>
  `;
}

// ──────────────────────────────────────────────────────────────────────
// Tab routing
// ──────────────────────────────────────────────────────────────────────
function setActiveTab(tabId) {
  if (!FLAT_TABS.some(t => t.id === tabId)) tabId = DEFAULT_TAB;
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
  return id && FLAT_TABS.some(t => t.id === id) ? id : null;
}
function wireKeyboard() {
  window.addEventListener("hashchange", () => setActiveTab(readInitialTabFromHash() || state.activeTab));
}

// ──────────────────────────────────────────────────────────────────────
// Action bar — New / Open / Save / Import / Load Sample / Reset Tab.
// ──────────────────────────────────────────────────────────────────────
const TAB_RESETTERS = {
  "project":        { label: "PROJECT",            fn: resetProjectTab },
  "footings-slabs": { label: "Footings & Slabs",   fn: resetFootingsSlabsTab },
};

function handleResetActiveTab() {
  const tab = state.activeTab;
  const entry = TAB_RESETTERS[tab];
  if (!entry) {
    setStatus(`Reset not yet wired for "${tab}" tab — coming with Phase 4.`, "busy");
    setTimeout(() => setStatus("Shell ready · cold-start blank state · Phase 3", "ready"), 3000);
    return;
  }
  const ok = window.confirm(
    `Reset "${entry.label}" to a blank state?\n\n` +
    `This clears only the inputs on this tab. Other tabs, PDF-Parser polygon data, and any saved project file are preserved.`
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
    `This populates PROJECT and assembly tabs with the BEAM workbook reference values. ` +
    `Existing inputs in those fields will be overwritten — Save first if you want to keep your work.`
  );
  if (!ok) return;
  setStatus(`Loading sample: ${entry.label}…`, "busy");
  try {
    const result = await loadSample(sampleId);
    setStatus(
      `Loaded "${result.label}" · ${result.projectFieldCount} PROJECT fields · ${result.fsFieldCount} F&S sample writes.`,
      "ready"
    );
  } catch (err) {
    console.error("[load-sample]", err);
    setStatus(
      `Load Sample failed: ${err.message}. Run \`npm run stage:data\` to copy sample JSON into PDF-Parser/data/.`,
      "error"
    );
  }
}

function wireActionBar() {
  const handlers = {
    "beam-new-project":      handleNewProject,
    "beam-open-project":     () => notImplemented("Open project JSON — file-handler import wiring lands next."),
    "beam-save-project":     () => notImplemented("Save project JSON — file-handler export wiring lands next."),
    "beam-import-xlsx":      () => notImplemented("Import xlsx — needs excel-mapper (Phase 6; SheetJS already loaded)."),
    "beam-import-pdf-parser":() => notImplemented("Import PDF-Parser project — needs polygon→assembly mapping (Phase 8)."),
    "beam-load-sample":      handleLoadSample,
    "beam-reset":            handleResetActiveTab,
  };
  for (const [id, fn] of Object.entries(handlers)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }
}
const READY_MSG = "Ready · cold-start blank state · Phase 3 (Footings & Slabs live)";
function notImplemented(msg) {
  setStatus(`not yet implemented · ${msg}`, "busy");
  setTimeout(() => setStatus(READY_MSG, "ready"), 3500);
}

// ──────────────────────────────────────────────────────────────────────
// Material DB probe — confirm the catalogue is reachable.
// Full fetch + caching lands in Phase 3 when assembly tabs consume it.
// ──────────────────────────────────────────────────────────────────────
async function loadMaterialIndex() {
  const url = "data/schema/materials/index.json";
  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`${res.status}`);
    const idx = await res.json();
    state.materialCount = idx.count;
    state.materialIndex = idx;
    document.getElementById("beam-material-count").textContent =
      `${idx.count.toLocaleString()}-material`;
    document.getElementById("beam-material-source").textContent =
      `materials: ${idx.count} records · sha ${short(idx.generated_from_csv_sha256)}`;
  } catch (err) {
    console.warn("BEAMweb: material index unreachable:", err);
    document.getElementById("beam-material-source").textContent =
      `materials: index.json unreachable · run 'npm run stage:data' locally`;
    setStatus("Material catalogue not staged — run `npm run stage:data` in PDF-Parser/", "error");
  }
}
function short(sha) { return sha ? sha.slice(0, 10) : "—"; }

// ──────────────────────────────────────────────────────────────────────
// Status helpers
// ──────────────────────────────────────────────────────────────────────
function setStatus(msg, kind) {
  const el = document.getElementById("beam-status-msg");
  if (!el) return;
  el.textContent = msg;
  el.className = kind === "busy"  ? "status-busy"
               : kind === "error" ? "status-error"
               : "status-ready";
}

function escapeHtml(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
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
  version: "0.0.1-alpha",
};

// ──────────────────────────────────────────────────────────────────────
// Start
// ──────────────────────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
