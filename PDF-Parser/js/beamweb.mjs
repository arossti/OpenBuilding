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

// ──────────────────────────────────────────────────────────────────────
// Tab definitions
// Grouped for sidebar display; order is the BEAM workbook order.
// Each tab declares which phase unlocks its implementation.
// ──────────────────────────────────────────────────────────────────────
const BEAM_TABS = [
  { group: "Project",       tabs: [
    { id: "introduction",       num: 1,  label: "Introduction",        phase: 0 },
    { id: "project",            num: 2,  label: "PROJECT",             phase: 2 },
  ]},
  { group: "Below-grade",   tabs: [
    { id: "footings-slabs",     num: 3,  label: "Footings & Slabs",    phase: 3 },
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
  renderSidebar();
  renderContentShell();
  wireActionBar();
  wireKeyboard();
  setActiveTab(readInitialTabFromHash() || DEFAULT_TAB);
  loadMaterialIndex();
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
  project: "Project meta, HOT2000 energy import, total-area inputs, derived summary",
  "footings-slabs": "Foundation concrete, aggregate, sub-slab insulation, vapour barriers",
  "foundation-walls": "Concrete / ICF / earth-based foundation walls + insulation",
  "structural-elements": "Steel, heavy timber, framing lumber — posts, beams, joists",
  "exterior-walls": "Framing, sheathing, cavity + continuous insulation, WRB",
  "party-walls": "Fire- + acoustic-separation walls between dwellings",
  cladding: "Exterior finishes — brick, fibre cement, siding, stucco",
  windows: "Double + triple pane glazing units",
  "interior-walls": "Framing, drywall, interior finishes (cladding doubled per MCE²)",
  floors: "Floor framing, subfloor, cavity insulation, flooring finishes",
  ceilings: "Ceiling framing + cladding",
  roof: "Roof framing, decking, roof insulation, roofing membrane",
  garage: "Garage components — MCE² excludes these from whole-building totals",
  review: "Inputs sanity-check · area/volume reconciliation · warnings",
  results: "Project EC total · per-component breakdown · operational + embodied summary",
  glossary: "Terms, standards references, methodology notes",
};

const PANEL_BODIES = {
  introduction: `
    <div class="beam-tbd" style="text-align: left; padding: 28px 32px;">
      <h3 style="text-align:center">Welcome to BEAMweb</h3>
      <p style="text-align:center; font-size: 13px; margin: 8px 0 18px 0;">
        A browser port of the BEAM / MCE² embodied carbon calculator, built for Canadian projects.
      </p>

      <h3 style="margin-top: 20px">How it works</h3>
      <ul>
        <li>Enter your project meta and areas on the <strong>PROJECT</strong> tab — or import them from an MCE²/BEAM workbook or a PDF-Parser project.</li>
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
  glossary: `
    <div class="beam-tbd">
      <div class="beam-tbd-icon"><i class="bi bi-book"></i></div>
      <h3>Glossary — Phase 0 stub</h3>
      <p>
        BEAM workbook Glossary will be ported here once Andy exports the tab to CSV.
        In the meantime, see <code>schema/lookups/lifecycle-stages.json</code> for EN 15804+A2 stage definitions
        and <a href="database.html" class="db-kv-link">Database</a> viewer for per-material EPD provenance.
      </p>
    </div>
  `,
};

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
        See <a href="https://github.com/arossti/OpenBuilding/blob/main/BEAMweb.md#2-reference-source--the-beam-and-mce²-spreadsheets" class="db-kv-link" target="_blank" rel="noopener">BEAMweb.md §2</a>.
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
// Action bar — New / Open / Save / Import — all stubbed until Phase 1
// ──────────────────────────────────────────────────────────────────────
function wireActionBar() {
  const handlers = {
    "beam-new-project":     () => notImplemented("New project — needs state-manager (Phase 1)."),
    "beam-open-project":    () => notImplemented("Open project JSON — needs file-handler (Phase 1)."),
    "beam-save-project":    () => notImplemented("Save project JSON — needs file-handler (Phase 1)."),
    "beam-import-xlsx":     () => notImplemented("Import xlsx — needs excel-mapper (Phase 6; SheetJS already loaded)."),
    "beam-import-pdf-parser":() => notImplemented("Import PDF-Parser project — needs polygon→assembly mapping (Phase 8)."),
  };
  for (const [id, fn] of Object.entries(handlers)) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }
}
function notImplemented(msg) {
  setStatus(`not yet implemented · ${msg}`, "busy");
  setTimeout(() => setStatus("Shell ready · no calc engine yet · phase 0", "ready"), 3500);
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
