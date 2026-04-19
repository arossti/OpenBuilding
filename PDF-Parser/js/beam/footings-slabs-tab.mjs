// footings-slabs-tab.mjs
// First live assembly tab. Loads the BEAM F&S CSV snapshot at tab-wire time,
// parses it via assembly-csv-parser, renders a 3-level picker (group →
// subgroup → material rows), wires select/qty/pct inputs to StateManager,
// computes per-row emissions live, and rolls up per-group + per-tab totals.
//
// Parity-first (session 3 decision): emission factors are derived from the
// committed CSV (BEAM's precomputed NET/GROSS columns), not from
// schema/materials/. That migration comes after BfCA validates functional
// parity on a canonical project.

import { StateManager } from "../shared/state-manager.mjs";
import { parseAssemblyCsv, computeRowEmissions } from "./assembly-csv-parser.mjs";
import { registerProjectToFsBridge, syncProjectToFsBridge } from "./auto-fill.mjs";
import { inferJurisdiction, matchesFilter } from "./jurisdictions.mjs";

const VS = StateManager.VALUE_STATES;
const CSV_PATH = "data/beam/footings-slabs.csv";

let parsed = null;  // { groups, factorCount } once loaded

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function fmtKg(v) {
  if (!v || !isFinite(v)) return "0";
  const n = Math.round(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fieldIds(material) {
  return {
    sel: `fs_${material.hash}_sel`,
    qty: `fs_${material.hash}_qty`,
    pct: `fs_${material.hash}_pct`,
  };
}

function groupCfgId(group) {
  return `fs_${group.code.replace(/\|/g, "_")}_cfg`;
}

// Cold-start contract: no BEAM CSV sample values bleed in as defaults.
// Empty state means empty UI (unchecked, blank qty, blank group config) and
// zero emissions. Use the action-bar Load Sample button to populate the
// DOE Prototype values on demand.
function currentValues(material, group) {
  const f = fieldIds(material);
  const rawSel = StateManager.getValue(f.sel);
  const rawQty = StateManager.getValue(f.qty);
  const rawPct = StateManager.getValue(f.pct);
  const select = rawSel === null ? false : (rawSel === "true" || rawSel === true);
  const qty = StateManager.parseNumeric(rawQty, 0);
  const pct = rawPct === null ? 1 : StateManager.parseNumeric(rawPct, 1);
  const configRatio = groupConfigRatio(group);
  return { select, qty, pct, configRatio };
}

// configRatio = user / BEAM-default. Blank/zero user input means the group
// has no effective contribution → returns 0 so emissions roll up to 0 until
// the user enters a value (or loads the sample). The BEAM default is only
// surfaced as a placeholder + tooltip on the input.
function groupConfigRatio(group) {
  if (!group.config || !group.config.default) return 1;
  const raw = StateManager.getValue(groupCfgId(group));
  if (raw === null || raw === "") return 0;
  const user = StateManager.parseNumeric(raw, 0);
  if (!user) return 0;
  return user / group.config.default;
}

export function renderFootingsSlabsPanel() {
  return `
    <div class="bw-asm-panel" id="bw-fs-panel">
      <div class="bw-asm-header">
        <div class="bw-asm-totals">
          <div class="bw-asm-total-cell">
            <span class="bw-asm-total-label">NET</span>
            <span class="bw-asm-total-value" id="bw-fs-total-net">0</span>
            <span class="bw-asm-total-unit">kgCO2e</span>
          </div>
          <div class="bw-asm-total-cell">
            <span class="bw-asm-total-label">GROSS</span>
            <span class="bw-asm-total-value" id="bw-fs-total-gross">0</span>
            <span class="bw-asm-total-unit">kgCO2e</span>
          </div>
          <div class="bw-asm-total-cell">
            <span class="bw-asm-total-label">STORAGE · SHORT</span>
            <span class="bw-asm-total-value" id="bw-fs-total-stshort">0</span>
            <span class="bw-asm-total-unit">kgCO2</span>
          </div>
          <div class="bw-asm-total-cell">
            <span class="bw-asm-total-label">STORAGE · LONG</span>
            <span class="bw-asm-total-value" id="bw-fs-total-stlong">0</span>
            <span class="bw-asm-total-unit">kgCO2</span>
          </div>
        </div>
        <div class="bw-asm-note" id="bw-fs-load-note">
          Loading Footings &amp; Slabs picker from BEAM snapshot…
        </div>
        <div class="bw-asm-filter-note" id="bw-fs-filter-note" hidden></div>
      </div>
      <div class="bw-asm-body" id="bw-fs-body"></div>
    </div>
  `;
}

function renderBody(parsedData) {
  const parts = [];
  for (const group of parsedData.groups) {
    parts.push(renderGroup(group));
  }
  return parts.join("");
}

function renderGroup(group) {
  const cfgHtml = group.config ? renderGroupConfig(group) : "";
  const subs = group.subgroups.map((s) => renderSubgroup(group, s)).join("");
  const hasMats = group.subgroups.some((s) => s.materials.length > 0);
  // Groups start collapsed so the initial view is an overview of the 16
  // group categories. Clicking the chevron expands a group to show its
  // subgroups and picker rows.
  return `
    <section class="bw-asm-group" data-group-code="${esc(group.code)}">
      <header class="bw-asm-group-header">
        <button class="bw-asm-toggle" type="button" aria-expanded="false" data-toggle-group="${esc(group.code)}">▶</button>
        <h3 class="bw-asm-group-name">${esc(group.name)}</h3>
        ${cfgHtml}
        <span class="bw-asm-group-subtotal">
          <span class="bw-asm-group-subtotal-val" id="bw-fs-sub-${hashOf(group.code)}">0</span>
          <span class="bw-asm-group-subtotal-unit">kgCO2e net</span>
        </span>
      </header>
      <div class="bw-asm-group-body" hidden>
        ${hasMats ? subs : `<p class="bw-asm-empty">No picker rows — Phase 3b will wire custom entries.</p>`}
      </div>
    </section>
  `;
}

function renderGroupConfig(group) {
  const id = groupCfgId(group);
  const current = StateManager.getValue(id);
  const val = current !== null && current !== "" ? esc(current) : "";
  const placeholder = group.config.default !== null ? esc(group.config.default) : "";
  const unitTxt = group.config.unit || "";
  const tip = group.config.default !== null
    ? `BEAM default: ${group.config.default}${unitTxt ? " " + unitTxt : ""}`
    : "";
  const unit = unitTxt ? `<span class="bw-asm-cfg-unit">${esc(unitTxt)}</span>` : "";
  return `
    <label class="bw-asm-cfg" title="${esc(tip)}">
      <span class="bw-asm-cfg-label">${esc(group.config.label)}</span>
      <input type="number" step="0.01" class="bw-input bw-asm-cfg-input" data-field-id="${id}" data-group-code="${esc(group.code)}" value="${val}" placeholder="${placeholder}" />
      ${unit}
    </label>
  `;
}

function jurAttrs(jur) {
  const c = (jur.countries || []).join(",");
  const p = jur.provinces === "CA-wide"
    ? "ca-wide"
    : (Array.isArray(jur.provinces) ? jur.provinces.join(",") : "");
  return `data-jur-countries="${esc(c)}" data-jur-provinces="${esc(p)}"`;
}

function renderSubgroup(group, sub) {
  if (sub.materials.length === 0) return "";
  const subJur = inferJurisdiction(sub.name, "");
  const rows = sub.materials.map((m) => renderMaterialRow(group, sub, m)).join("");
  return `
    <div class="bw-asm-sub" data-sub-code="${esc(sub.code)}" ${jurAttrs(subJur)}>
      <div class="bw-asm-sub-name">${esc(sub.name)}</div>
      <table class="bw-asm-rows">
        <thead>
          <tr>
            <th class="bw-asm-col-sel"></th>
            <th class="bw-asm-col-name">Material</th>
            <th class="bw-asm-col-qty">Qty</th>
            <th class="bw-asm-col-unit">Unit</th>
            <th class="bw-asm-col-pct">%</th>
            <th class="bw-asm-col-net">Net kgCO2e</th>
            <th class="bw-asm-col-foot"></th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

function renderMaterialRow(group, sub, m) {
  const ids = fieldIds(m);
  const vals = currentValues(m, group);
  const netId = `bw-fs-net-${m.hash}`;
  const rowCls = vals.select ? "bw-asm-row bw-asm-row-selected" : "bw-asm-row";
  const footCls = m.footnote.toLowerCase().includes("expired") ? "bw-asm-foot expired" : "bw-asm-foot";
  // Row jurisdiction inherits subgroup signal + adds material-name [bracket]
  // tag if present. Subgroup banner is the primary; material-level overrides
  // refine (e.g. NRMCA rows in a CANADA subgroup get [US & CA] from bracket).
  const rowJur = inferJurisdiction(sub.name, m.name);
  // Render qty blank when 0 so cold-start rows don't visually broadcast "0".
  const qtyDisplay = vals.qty ? esc(vals.qty) : "";
  const pctDisplay = (vals.pct * 100).toFixed(0);
  const noFactor = !m.factors;
  return `
    <tr class="${rowCls}" data-row-hash="${m.hash}" data-group-code="${esc(group.code)}" ${jurAttrs(rowJur)}>
      <td class="bw-asm-col-sel">
        <input type="checkbox" class="bw-asm-sel" data-field-id="${ids.sel}" data-row-hash="${m.hash}" ${vals.select ? "checked" : ""} />
      </td>
      <td class="bw-asm-col-name" title="${esc(m.name)}">${esc(m.name)}</td>
      <td class="bw-asm-col-qty">
        <input type="number" step="0.1" class="bw-input bw-asm-qty bw-asm-qty-readonly" data-field-id="${ids.qty}" data-row-hash="${m.hash}" value="${qtyDisplay}" placeholder="0" readonly title="Set this quantity on the PROJECT tab — assembly-tab quantities are display-only, matching BEAM workbook behavior." />
      </td>
      <td class="bw-asm-col-unit">${esc(m.unit)}</td>
      <td class="bw-asm-col-pct">
        <input type="number" min="0" max="100" step="1" class="bw-input bw-asm-pct" data-field-id="${ids.pct}" data-row-hash="${m.hash}" value="${pctDisplay}" />
        <span class="bw-asm-pct-sign">%</span>
      </td>
      <td class="bw-asm-col-net">
        <span id="${netId}">0</span>${noFactor ? ' <span class="bw-asm-nofactor" title="No emission factor in this CSV — cross-reference from Materials DB pending">–</span>' : ""}
      </td>
      <td class="${footCls}" title="${esc(m.footnote)}">${m.footnote ? esc(truncFoot(m.footnote)) : ""}</td>
    </tr>
  `;
}

function truncFoot(s) {
  if (s.length <= 18) return s;
  return s.slice(0, 16) + "…";
}

function hashOf(groupCode) {
  return groupCode.replace(/\|/g, "_");
}

async function loadCsv() {
  const res = await fetch(CSV_PATH, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load ${CSV_PATH}: HTTP ${res.status}`);
  return await res.text();
}

function recomputeAll() {
  if (!parsed) return;
  let tabNet = 0, tabGross = 0, tabStShort = 0, tabStLong = 0;

  for (const group of parsed.groups) {
    let groupNet = 0;
    for (const sub of group.subgroups) {
      for (const m of sub.materials) {
        const vals = currentValues(m, group);
        const emissions = computeRowEmissions({
          select: vals.select,
          qty: vals.qty,
          pct: vals.pct,
          factors: m.factors,
          configRatio: vals.configRatio,
        });
        const netEl = document.getElementById(`bw-fs-net-${m.hash}`);
        if (netEl) netEl.textContent = fmtKg(emissions.net);
        groupNet += emissions.net;
        tabNet += emissions.net;
        tabGross += emissions.gross;
        tabStShort += emissions.storage_short;
        tabStLong += emissions.storage_long;
      }
    }
    const subEl = document.getElementById(`bw-fs-sub-${hashOf(group.code)}`);
    if (subEl) subEl.textContent = fmtKg(groupNet);
  }

  const totalEls = {
    net: document.getElementById("bw-fs-total-net"),
    gross: document.getElementById("bw-fs-total-gross"),
    stshort: document.getElementById("bw-fs-total-stshort"),
    stlong: document.getElementById("bw-fs-total-stlong"),
  };
  if (totalEls.net) totalEls.net.textContent = fmtKg(tabNet);
  if (totalEls.gross) totalEls.gross.textContent = fmtKg(tabGross);
  if (totalEls.stshort) totalEls.stshort.textContent = fmtKg(tabStShort);
  if (totalEls.stlong) totalEls.stlong.textContent = fmtKg(tabStLong);
}

function updateRowSelectedClass(hash, selected) {
  const row = document.querySelector(`tr[data-row-hash="${hash}"]`);
  if (row) row.classList.toggle("bw-asm-row-selected", selected);
}

function wireInputs(panel) {
  panel.addEventListener("input", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    const fieldId = t.dataset.fieldId;
    if (!fieldId) return;
    // Defensive: qty cells are readonly (matches BEAM gSheet — quantities
    // flow from PROJECT, not from user edits on the assembly tab). Ignore
    // any stray input event on them.
    if (t.classList.contains("bw-asm-qty")) return;

    if (t.type === "checkbox") {
      StateManager.setValue(fieldId, t.checked, VS.USER_MODIFIED);
      updateRowSelectedClass(t.dataset.rowHash, t.checked);
    } else if (t.classList.contains("bw-asm-pct")) {
      // UI shows 0-100; store as decimal 0-1 to match BEAM
      const n = parseFloat(t.value);
      const stored = isNaN(n) ? 1 : Math.max(0, Math.min(100, n)) / 100;
      StateManager.setValue(fieldId, stored, VS.USER_MODIFIED);
    } else {
      StateManager.setValue(fieldId, t.value, VS.USER_MODIFIED);
    }
    recomputeAll();
  });

  panel.addEventListener("click", (e) => {
    // Any click anywhere on the group-header bar toggles expand/collapse —
    // except clicks on the inline config (thickness / R-value / rebar length
    // inputs) which must pass through so the user can type in them.
    const header = e.target.closest(".bw-asm-group-header");
    if (!header) return;
    if (e.target.closest(".bw-asm-cfg")) return;
    const group = header.closest(".bw-asm-group");
    const body = group?.querySelector(".bw-asm-group-body");
    const btn = header.querySelector(".bw-asm-toggle");
    if (!body || !btn) return;
    const open = body.hasAttribute("hidden");
    if (open) body.removeAttribute("hidden"); else body.setAttribute("hidden", "");
    btn.textContent = open ? "▼" : "▶";
    btn.setAttribute("aria-expanded", String(open));
  });
}

// Refresh DOM inputs to match current StateManager values. Cheaper than
// re-rendering the whole panel — useful after reset/sample-load.
function refreshInputsFromState() {
  if (!parsed) return;
  const panel = document.getElementById("bw-fs-panel");
  if (!panel) return;
  for (const group of parsed.groups) {
    if (group.config) {
      const cfgEl = panel.querySelector(`input[data-field-id="${groupCfgId(group)}"]`);
      if (cfgEl) {
        const v = StateManager.getValue(groupCfgId(group));
        cfgEl.value = (v === null || v === "") ? "" : v;
      }
    }
    for (const sub of group.subgroups) {
      for (const m of sub.materials) {
        const f = fieldIds(m);
        const sel = panel.querySelector(`input[data-field-id="${f.sel}"]`);
        const qty = panel.querySelector(`input[data-field-id="${f.qty}"]`);
        const pct = panel.querySelector(`input[data-field-id="${f.pct}"]`);
        const rawSel = StateManager.getValue(f.sel);
        const rawQty = StateManager.getValue(f.qty);
        const rawPct = StateManager.getValue(f.pct);
        if (sel) sel.checked = rawSel === true || rawSel === "true";
        if (qty) qty.value = (rawQty === null || rawQty === "" || Number(rawQty) === 0) ? "" : rawQty;
        if (pct) pct.value = rawPct === null ? "100" : String(Math.round(StateManager.parseNumeric(rawPct, 1) * 100));
        updateRowSelectedClass(m.hash, sel ? sel.checked : false);
      }
    }
  }
  recomputeAll();
}

export function resetFootingsSlabsTab() {
  StateManager.clearByPrefix("fs_");
  // Re-flow PROJECT auto-fill so DERIVED qtys come back after the wipe.
  syncProjectToFsBridge();
  refreshInputsFromState();
}

export function refreshFootingsSlabsTab() {
  refreshInputsFromState();
  applyJurisdictionFilter();
}

// Read jurisdiction data attributes off a DOM element back into the shape
// `matchesFilter` expects.
function readJurAttrs(el) {
  const c = (el.dataset.jurCountries || "").split(",").filter(Boolean);
  const p = el.dataset.jurProvinces || "";
  let provinces = null;
  if (p === "ca-wide") provinces = "CA-wide";
  else if (p) provinces = p.split(",").filter(Boolean);
  return { countries: c.length ? c : null, provinces };
}

// Apply the project_country / project_province_state filter to F&S rows.
// Hidden rows still contribute to subtotals when SELECT'd — filter is purely
// a visibility aid. Subgroups are auto-hidden when every material row in
// them is filtered out, so empty banners don't dangle.
function applyJurisdictionFilter() {
  const panel = document.getElementById("bw-fs-panel");
  if (!panel) return;
  const country = StateManager.getValue("project_country") || "";
  const province = StateManager.getValue("project_province_state") || "";
  let totalRows = 0, hiddenRows = 0;

  for (const row of panel.querySelectorAll("tr.bw-asm-row")) {
    totalRows++;
    const jur = readJurAttrs(row);
    const visible = matchesFilter(jur, country, province);
    row.toggleAttribute("hidden", !visible);
    if (!visible) hiddenRows++;
  }
  // Hide subgroup wrappers when no row inside them is visible.
  for (const sub of panel.querySelectorAll(".bw-asm-sub")) {
    const anyVisible = sub.querySelectorAll("tr.bw-asm-row:not([hidden])").length > 0;
    sub.toggleAttribute("hidden", !anyVisible);
  }

  const note = document.getElementById("bw-fs-filter-note");
  if (note) {
    if (hiddenRows === 0 || !country) {
      note.hidden = true;
      note.textContent = "";
    } else {
      const where = province ? `${country} · ${province}` : country;
      note.hidden = false;
      note.textContent = `${hiddenRows} of ${totalRows} rows hidden by jurisdiction filter (${where}). Change Country/Province on PROJECT to adjust.`;
    }
  }
}

export function refreshFootingsSlabsFilter() {
  applyJurisdictionFilter();
}

// Sample-loader hook. Walks the parsed CSV, writes sample SELECT/qty/pct
// to StateManager as IMPORTED for materials the BEAM workbook flagged as
// selected, and writes inline group-config defaults (THICKNESS, R-VALUE,
// TOTAL REBAR LENGTH). Returns the count of fields written.
export function loadSampleIntoFootingsSlabs() {
  if (!parsed) return 0;
  let n = 0;
  StateManager.muteListeners();
  try {
    for (const group of parsed.groups) {
      if (group.config && group.config.default !== null) {
        StateManager.setValue(groupCfgId(group), group.config.default, VS.IMPORTED);
        n++;
      }
      for (const sub of group.subgroups) {
        for (const m of sub.materials) {
          if (!m.sample_select) continue;
          const f = fieldIds(m);
          StateManager.setValue(f.sel, true, VS.IMPORTED);
          StateManager.setValue(f.qty, m.sample_qty, VS.IMPORTED);
          StateManager.setValue(f.pct, m.sample_pct, VS.IMPORTED);
          n += 3;
        }
      }
    }
  } finally {
    StateManager.unmuteListeners();
  }
  return n;
}

export async function wireFootingsSlabsTab() {
  const panel = document.getElementById("bw-fs-panel");
  if (!panel) return;

  let csv;
  try {
    csv = await loadCsv();
  } catch (err) {
    const note = document.getElementById("bw-fs-load-note");
    if (note) {
      note.textContent = `Could not load ${CSV_PATH}: ${err.message}. Run \`npm run stage:data\` to copy the BEAM CSVs into place.`;
      note.classList.add("bw-asm-error");
    }
    console.error("[footings-slabs-tab]", err);
    return;
  }

  parsed = parseAssemblyCsv(csv);
  console.log(`[footings-slabs-tab] parsed ${parsed.groups.length} groups, ${parsed.factorCount} emission factors`);

  const body = document.getElementById("bw-fs-body");
  if (body) body.innerHTML = renderBody(parsed);

  const note = document.getElementById("bw-fs-load-note");
  if (note) {
    const matCount = parsed.groups.reduce((n, g) => n + g.subgroups.reduce((m, s) => m + s.materials.length, 0), 0);
    note.textContent = `${parsed.groups.length} groups · ${matCount} materials · ${parsed.factorCount} with factors. Phase 3 MVP — parity testing pending.`;
  }

  wireInputs(panel);
  // Wire PROJECT-tab → F&S quantity bridge. Registers listeners on every
  // PROJECT source key (dim_continuous_footings_volume, etc.) and pushes
  // their current values down as DERIVED qty on every matching F&S row.
  registerProjectToFsBridge(parsed);
  // Wire jurisdiction filter — listen to the two PROJECT keys that drive
  // F&S row visibility and re-apply on every change.
  StateManager.addListener("project_country", applyJurisdictionFilter);
  StateManager.addListener("project_province_state", applyJurisdictionFilter);
  applyJurisdictionFilter();
  recomputeAll();
}
