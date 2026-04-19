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

function currentValues(material, group) {
  const f = fieldIds(material);
  const rawSel = StateManager.getValue(f.sel);
  const rawQty = StateManager.getValue(f.qty);
  const rawPct = StateManager.getValue(f.pct);
  const select = rawSel === null ? material.sample_select : rawSel === "true" || rawSel === true;
  const qty = StateManager.parseNumeric(rawQty, material.sample_qty);
  const pct = StateManager.parseNumeric(rawPct, material.sample_pct);
  const configRatio = groupConfigRatio(group);
  return { select, qty, pct, configRatio };
}

function groupConfigRatio(group) {
  if (!group.config || group.config.default === null || group.config.default === 0) return 1;
  const current = StateManager.getValue(groupCfgId(group));
  const user = StateManager.parseNumeric(current, group.config.default);
  if (!user || !group.config.default) return 1;
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
  return `
    <section class="bw-asm-group" data-group-code="${esc(group.code)}">
      <header class="bw-asm-group-header">
        <button class="bw-asm-toggle" type="button" aria-expanded="true" data-toggle-group="${esc(group.code)}">▼</button>
        <h3 class="bw-asm-group-name">${esc(group.name)}</h3>
        ${cfgHtml}
        <span class="bw-asm-group-subtotal">
          <span class="bw-asm-group-subtotal-val" id="bw-fs-sub-${hashOf(group.code)}">0</span>
          <span class="bw-asm-group-subtotal-unit">kgCO2e net</span>
        </span>
      </header>
      <div class="bw-asm-group-body">
        ${hasMats ? subs : `<p class="bw-asm-empty">No picker rows — Phase 3b will wire custom entries.</p>`}
      </div>
    </section>
  `;
}

function renderGroupConfig(group) {
  const id = groupCfgId(group);
  const current = StateManager.getValue(id);
  const val = current !== null ? current : (group.config.default !== null ? group.config.default : "");
  const unit = group.config.unit ? `<span class="bw-asm-cfg-unit">${esc(group.config.unit)}</span>` : "";
  return `
    <label class="bw-asm-cfg">
      <span class="bw-asm-cfg-label">${esc(group.config.label)}</span>
      <input type="number" step="0.01" class="bw-input bw-asm-cfg-input" data-field-id="${id}" data-group-code="${esc(group.code)}" value="${esc(val)}" />
      ${unit}
    </label>
  `;
}

function renderSubgroup(group, sub) {
  if (sub.materials.length === 0) return "";
  const rows = sub.materials.map((m) => renderMaterialRow(group, m)).join("");
  return `
    <div class="bw-asm-sub" data-sub-code="${esc(sub.code)}">
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

function renderMaterialRow(group, m) {
  const ids = fieldIds(m);
  const vals = currentValues(m, group);
  const netId = `bw-fs-net-${m.hash}`;
  const rowCls = vals.select ? "bw-asm-row bw-asm-row-selected" : "bw-asm-row";
  const footCls = m.footnote.toLowerCase().includes("expired") ? "bw-asm-foot expired" : "bw-asm-foot";
  const pctDisplay = (vals.pct * 100).toFixed(0);
  const noFactor = !m.factors;
  return `
    <tr class="${rowCls}" data-row-hash="${m.hash}" data-group-code="${esc(group.code)}">
      <td class="bw-asm-col-sel">
        <input type="checkbox" class="bw-asm-sel" data-field-id="${ids.sel}" data-row-hash="${m.hash}" ${vals.select ? "checked" : ""} />
      </td>
      <td class="bw-asm-col-name" title="${esc(m.name)}">${esc(m.name)}</td>
      <td class="bw-asm-col-qty">
        <input type="number" step="0.1" class="bw-input bw-asm-qty" data-field-id="${ids.qty}" data-row-hash="${m.hash}" value="${esc(vals.qty)}" />
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
    const btn = e.target.closest(".bw-asm-toggle");
    if (!btn) return;
    const groupCode = btn.dataset.toggleGroup;
    const body = btn.closest(".bw-asm-group")?.querySelector(".bw-asm-group-body");
    if (!body) return;
    const open = body.hasAttribute("hidden") ? true : false;
    if (open) body.removeAttribute("hidden"); else body.setAttribute("hidden", "");
    btn.textContent = open ? "▼" : "▶";
    btn.setAttribute("aria-expanded", String(open));
  });
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
  recomputeAll();
}
