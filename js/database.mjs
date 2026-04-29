/**
 * BfCA Material Database viewer.
 *
 * Fetches the sparse catalogue at data/schema/materials/index.json (staged via
 * `npm run stage:data` locally or the Pages deploy workflow). Renders a sortable
 * filterable table; lazy-loads per-group full records when a row is expanded.
 *
 * Tone mirrors the rest of PDF-Parser: vanilla JS, no framework, no build step.
 */

/* eslint-disable no-undef */

import { esc as escapeHtml } from "./shared/html-utils.mjs";
import * as Store from "./shared/indexed-db-store.mjs";

const DATA_BASE = "data/schema";
const INDEX_URL = `${DATA_BASE}/materials/index.json`;
const GROUP_FILE = (prefix) => `${DATA_BASE}/materials/${groupSlug(prefix)}`;

const GROUPS = {
  "03": { label: "Concrete", file: "03-concrete.json" },
  "04": { label: "Masonry", file: "04-masonry.json" },
  "05": { label: "Metals", file: "05-metals.json" },
  "06": { label: "Wood", file: "06-wood.json" },
  "07": { label: "Thermal", file: "07-thermal.json" },
  "08": { label: "Openings", file: "08-openings.json" },
  "09": { label: "Finishes", file: "09-finishes.json" },
  31: { label: "Earthwork", file: "31-earthwork.json" }
};
function groupSlug(prefix) {
  return (GROUPS[prefix] && GROUPS[prefix].file) || null;
}

const ALL_STAGES = [
  "A1",
  "A2",
  "A3",
  "A4",
  "A5",
  "B1",
  "B2",
  "B3",
  "B4",
  "B5",
  "B6",
  "B7",
  "C1",
  "C2",
  "C3",
  "C4",
  "D"
];
const STAGE_GROUPS = [
  { group: "Product (A1–A3)", stages: ["A1", "A2", "A3"] },
  { group: "Construction", stages: ["A4", "A5"] },
  { group: "Use — in-service", stages: ["B1", "B2", "B3", "B4", "B5"] },
  { group: "Use — operational", stages: ["B6", "B7"] },
  { group: "End of life", stages: ["C1", "C2", "C3", "C4"] },
  { group: "Beyond", stages: ["D"] }
];
const IMPACT_CATEGORIES = [
  { key: "gwp_kgco2e", label: "GWP", unit: "kgCO₂e" },
  { key: "gwp_bio_kgco2e", label: "GWP-bio", unit: "kgCO₂e" },
  { key: "eutrophication_kgneq", label: "Eutrophication", unit: "kgN eq" },
  { key: "acidification_kgso2eq", label: "Acidification", unit: "kgSO₂ eq" },
  { key: "ozone_depletion_kgcfc11eq", label: "Ozone depletion", unit: "kgCFC-11 eq" },
  { key: "smog_kgo3eq", label: "Smog", unit: "kgO₃ eq" },
  { key: "abiotic_depletion_fossil_mj", label: "Abiotic depl. (foss)", unit: "MJ" },
  { key: "water_consumption_m3", label: "Water consumption", unit: "m³" },
  { key: "primary_energy_nonrenewable_mj", label: "Primary E (non-ren)", unit: "MJ" },
  { key: "primary_energy_renewable_mj", label: "Primary E (renew)", unit: "MJ" }
];

// ────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────
const state = {
  indexEntries: [], // all entries from index.json
  groupCache: new Map(), // group_prefix → records[] (lazy)
  recordCache: new Map(), // id → full record (from per-group file)
  view: [], // filtered + sorted entries
  activeGroups: new Set(),
  search: "",
  epdOnly: false,
  sortKey: "display_name",
  sortDir: "asc",
  expanded: new Set(), // ids of rows expanded
  expandedGroups: new Set() // group_prefix values expanded in grouped (no-filter) view
};

// ────────────────────────────────────────────────────────────
// Boot
// ────────────────────────────────────────────────────────────
async function boot() {
  setStatus("Loading catalogue…", "busy");
  try {
    const res = await fetch(INDEX_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`index.json: ${res.status}`);
    const idx = await res.json();
    state.indexEntries = idx.entries || [];

    // Merge any Trust-committed patches from prior sessions back into the
    // in-memory catalogue. They survive reloads as fresh-highlighted rows
    // until the team runs apply-patch.mjs (Database.md §7) and clears the
    // committed-patches store.
    await _mergeCommittedPatchesOnBoot();

    document.getElementById("db-source-note").textContent =
      `source: ${idx.count} records · sha ${short(idx.generated_from_csv_sha256)}`;
    renderGroupChips();
    wireControls();
    applyFilters();
    setStatus("Ready.", "ready");
    // EPD-Parser pending-changes queue (workplan Database.md §4–§5).
    // Non-blocking — failure here doesn't break catalogue browsing.
    refreshPendingPanel().catch((err) => console.warn("[DB] pending-panel skipped:", err));
    wireVerifyModal();
  } catch (err) {
    console.error(err);
    setStatus(`Failed to load catalogue: ${err.message}`, "error");
    document.getElementById("db-rows").innerHTML =
      `<tr><td colspan="8" class="db-empty-state">Failed to load <code>${INDEX_URL}</code>.<br><br>If you are running locally, make sure you ran <code>npm run stage:data</code> in the <code>PDF-Parser/</code> directory.</td></tr>`;
  }
}

// ────────────────────────────────────────────────────────────
// Controls
// ────────────────────────────────────────────────────────────
function wireControls() {
  const search = document.getElementById("db-search");
  const clear = document.getElementById("db-clear-search");
  search.addEventListener(
    "input",
    debounce(() => {
      state.search = search.value.trim().toLowerCase();
      clear.hidden = state.search.length === 0;
      applyFilters();
    }, 120)
  );
  clear.addEventListener("click", () => {
    search.value = "";
    state.search = "";
    clear.hidden = true;
    applyFilters();
    search.focus();
  });

  document.getElementById("db-epd-only").addEventListener("change", (e) => {
    state.epdOnly = e.target.checked;
    applyFilters();
  });

  document.getElementById("db-expand-toggle").addEventListener("click", () => {
    // Toggle between overview (all groups collapsed, all row details closed)
    // and fully-expanded (all group sections open, row details left as-is).
    const anyExpanded = state.expandedGroups.size > 0 || state.expanded.size > 0;
    if (anyExpanded) {
      state.expanded.clear();
      state.expandedGroups.clear();
    } else {
      // Expand every group that has rows in the current view
      const prefixes = new Set();
      for (const e of state.view) prefixes.add(e.group_prefix || "??");
      state.expandedGroups = prefixes;
    }
    updateExpandToggleLabel();
    renderRows();
  });

  const thead = document.querySelector("#db-table thead");
  thead.addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort]");
    if (!th) return;
    const key = th.dataset.sort;
    if (state.sortKey === key) {
      state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    } else {
      state.sortKey = key;
      state.sortDir = key === "gwp_kgco2e" ? "desc" : "asc";
    }
    applyFilters();
  });

  document.getElementById("db-rows").addEventListener("click", (e) => {
    const groupHeader = e.target.closest(".db-group-header");
    if (groupHeader) {
      toggleGroup(groupHeader.dataset.group);
      return;
    }
    const row = e.target.closest(".db-row-main");
    if (!row) return;
    toggleExpand(row.dataset.id);
  });
}

function toggleGroup(prefix) {
  if (state.expandedGroups.has(prefix)) state.expandedGroups.delete(prefix);
  else state.expandedGroups.add(prefix);
  updateExpandToggleLabel();
  renderRows();
}

function updateExpandToggleLabel() {
  const label = document.getElementById("db-expand-toggle-label");
  const icon = document.getElementById("db-expand-toggle-icon");
  if (!label || !icon) return;
  const anyExpanded = state.expandedGroups.size > 0 || state.expanded.size > 0;
  label.textContent = anyExpanded ? "Collapse all" : "Expand all";
  icon.className = anyExpanded ? "bi bi-chevron-bar-contract" : "bi bi-chevron-bar-expand";
}

function renderGroupChips() {
  const counts = new Map();
  for (const e of state.indexEntries) {
    const d = e.group_prefix || "??";
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  const container = document.getElementById("db-groups-chips");
  // Preserve the "Groups" label; remove anything else
  [...container.querySelectorAll(".db-chip")].forEach((n) => n.remove());
  const sorted = [...counts.keys()].sort();
  for (const prefix of sorted) {
    const btn = document.createElement("button");
    btn.className = "db-chip";
    btn.dataset.group = prefix;
    const name = (GROUPS[prefix] && GROUPS[prefix].label) || "Unclassified";
    btn.innerHTML = `${prefix} ${escapeHtml(name.split(",")[0])}<span class="db-chip-count">${counts.get(prefix)}</span>`;
    btn.title = name;
    btn.addEventListener("click", () => {
      if (state.activeGroups.has(prefix)) {
        state.activeGroups.delete(prefix);
        btn.classList.remove("active");
      } else {
        state.activeGroups.add(prefix);
        btn.classList.add("active");
      }
      applyFilters();
    });
    container.appendChild(btn);
  }
}

// ────────────────────────────────────────────────────────────
// Filtering + sorting
// ────────────────────────────────────────────────────────────
function applyFilters() {
  const q = state.search;
  state.view = state.indexEntries.filter((e) => {
    if (state.activeGroups.size > 0 && !state.activeGroups.has(e.group_prefix)) return false;
    if (state.epdOnly) {
      // index doesn't carry epd.type — fall back to beam_id prefix heuristic.
      // beam_id starting with uppercase letters = product-specific BEAM codes;
      // mixed-case short hex ids are the BEAM-average / industry-average set.
      if (/^[a-z0-9]{6,}$/.test(e.beam_id || "")) return false;
    }
    if (q) {
      const hay = [e.display_name, e.beam_id, e.category].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const key = state.sortKey;
  const dir = state.sortDir === "asc" ? 1 : -1;
  state.view.sort((a, b) => {
    let av = a[key];
    let bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls last
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
  });

  // Update sort indicators
  for (const th of document.querySelectorAll("#db-table thead th[data-sort]")) {
    th.classList.remove("sorted-asc", "sorted-desc");
    if (th.dataset.sort === key) th.classList.add(dir === 1 ? "sorted-asc" : "sorted-desc");
  }

  document.getElementById("db-result-count").textContent =
    `${state.view.length.toLocaleString()} of ${state.indexEntries.length.toLocaleString()} materials`;
  document.getElementById("db-count-label").textContent = `${state.indexEntries.length} materials`;
  renderRows();
}

// ────────────────────────────────────────────────────────────
// Rendering — main table
// ────────────────────────────────────────────────────────────
function renderRows() {
  const tbody = document.getElementById("db-rows");
  updateExpandToggleLabel();
  if (state.view.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="db-empty-state">No materials match the current filters.<br>Try clearing the search box or removing group chips.</td></tr>`;
    return;
  }
  // When the user is searching or has chip filters active, flatten the list
  // — matching results surface immediately instead of hiding behind section
  // chrome. When just browsing, render as collapsible group sections so the
  // initial view is an 8-group overview.
  const filterActive = state.search.length > 0 || state.activeGroups.size > 0;
  const frag = document.createDocumentFragment();
  if (filterActive) {
    for (const e of state.view) {
      frag.appendChild(renderMainRow(e));
      if (state.expanded.has(e.id)) frag.appendChild(renderDetailRow(e));
    }
  } else {
    // Group-by-prefix, render each as a collapsible section
    const byGroup = new Map();
    for (const e of state.view) {
      const prefix = e.group_prefix || "??";
      if (!byGroup.has(prefix)) byGroup.set(prefix, []);
      byGroup.get(prefix).push(e);
    }
    const sortedPrefixes = [...byGroup.keys()].sort();
    for (const prefix of sortedPrefixes) {
      const materials = byGroup.get(prefix);
      const expanded = state.expandedGroups.has(prefix);
      frag.appendChild(renderGroupHeaderRow(prefix, materials.length, expanded));
      if (expanded) {
        for (const e of materials) {
          const tr = renderMainRow(e);
          tr.dataset.group = prefix;
          frag.appendChild(tr);
          if (state.expanded.has(e.id)) {
            const det = renderDetailRow(e);
            det.dataset.group = prefix;
            frag.appendChild(det);
          }
        }
      }
    }
  }
  tbody.replaceChildren(frag);
}

function renderGroupHeaderRow(prefix, count, expanded) {
  const tr = document.createElement("tr");
  tr.className = "db-group-header" + (expanded ? " expanded" : "");
  tr.dataset.group = prefix;
  const name = (GROUPS[prefix] && GROUPS[prefix].label) || "Unclassified";
  // Banner is an inner div so it can take margin + border-radius independently
  // of the enclosing td (which can't easily escape the table layout box).
  tr.innerHTML = `
    <td colspan="8" class="db-group-header-cell">
      <div class="db-group-bar">
        <span class="db-group-caret">${expanded ? "▼" : "▶"}</span>
        <span class="db-group-code">${escapeHtml(prefix)}</span>
        <span class="db-group-name">${escapeHtml(name)}</span>
        <span class="db-group-count">${count.toLocaleString()}</span>
      </div>
    </td>
  `;
  return tr;
}

function renderMainRow(e) {
  const tr = document.createElement("tr");
  tr.className = "db-row-main";
  tr.dataset.id = e.id;
  if (state.expanded.has(e.id)) tr.classList.add("expanded");
  if (e._fresh) tr.classList.add("db-row-fresh");

  const freshChip = e._fresh
    ? ` <span class="db-fresh-chip db-fresh-chip-${e._commit_type === "refresh" ? "refresh" : "new"}">${e._commit_type === "refresh" ? "UPDATED" : "NEW"}</span>`
    : "";

  tr.innerHTML = `
    <td title="${escapeAttr(e.beam_id || "")}"><code>${escapeHtml(e.beam_id || "—")}</code>${freshChip}</td>
    <td title="${escapeAttr(e.display_name || "")}">${escapeHtml(e.display_name || "—")}</td>
    <td><span class="db-div-tag">${escapeHtml(e.group_prefix || "—")}</span></td>
    <td>${escapeHtml(prettyCategory(e.category))}</td>
    <td class="num">${formatGwp(e.gwp_kgco2e)}</td>
    <td>${escapeHtml(e.functional_unit || "—")}</td>
    <td class="db-elements-cell">${renderTypicalElementsInline(e.typical_elements)}</td>
    <td class="db-th-caret"><i class="bi bi-chevron-right db-caret"></i></td>
  `;
  return tr;
}

function renderTypicalElementsInline(arr) {
  if (!arr || arr.length === 0) return '<span class="db-empty">—</span>';
  const shown = arr.slice(0, 3).map(escapeHtml).join(", ");
  const more = arr.length > 3 ? ` +${arr.length - 3}` : "";
  return `${shown}${more}`;
}
function prettyCategory(category) {
  if (!category) return "—";
  return category.replace(/^\d\d_/, "").replace(/_/g, " ");
}
function formatGwp(v) {
  if (v == null) return '<span class="db-empty">—</span>';
  if (v >= 100) return v.toFixed(0);
  if (v >= 10) return v.toFixed(1);
  return v.toFixed(2);
}

// ────────────────────────────────────────────────────────────
// Expand / collapse and full-record fetch
// ────────────────────────────────────────────────────────────
async function toggleExpand(id) {
  if (state.expanded.has(id)) {
    state.expanded.delete(id);
    renderRows();
    return;
  }
  state.expanded.add(id);
  // Optimistic render with "loading" in the detail row
  renderRows();
  try {
    await loadFullRecord(id);
    renderRows(); // re-render with real detail
  } catch (err) {
    console.error(err);
    setStatus(`Failed to load record ${id}: ${err.message}`, "error");
  }
}

async function loadFullRecord(id) {
  if (state.recordCache.has(id)) return state.recordCache.get(id);
  const entry = state.indexEntries.find((e) => e.id === id);
  if (!entry) throw new Error(`unknown id ${id}`);
  const prefix = entry.group_prefix;
  if (!state.groupCache.has(prefix)) {
    const fileName = groupSlug(prefix);
    if (!fileName) throw new Error(`no file mapping for group ${prefix}`);
    setStatus(`Loading ${fileName}…`, "busy");
    const res = await fetch(`${DATA_BASE}/materials/${fileName}`, { cache: "force-cache" });
    if (!res.ok) throw new Error(`${fileName}: ${res.status}`);
    const doc = await res.json();
    state.groupCache.set(prefix, doc.records || []);
    for (const r of doc.records || []) state.recordCache.set(r.id, r);
    setStatus("Ready.", "ready");
  }
  return state.recordCache.get(id);
}

// ────────────────────────────────────────────────────────────
// Rendering — detail sub-row
// ────────────────────────────────────────────────────────────
function renderDetailRow(entry) {
  const tr = document.createElement("tr");
  tr.className = "db-detail-row";
  const td = document.createElement("td");
  td.colSpan = 8;
  const pane = document.createElement("div");
  pane.className = "db-detail-pane";

  const full = state.recordCache.get(entry.id);
  if (!full) {
    pane.innerHTML = `<div class="db-loading-cell"><i class="bi bi-hourglass-split"></i> Loading full record…</div>`;
  } else {
    pane.appendChild(section("Identity & Classification", [], identityBlock(full)));
    pane.appendChild(section("Manufacturer & Provenance", [], provenanceBlock(full)));
    pane.appendChild(section("Physical Properties", [], physicalBlock(full)));
    pane.appendChild(section("Carbon Calc Graph (BEAM audit trail)", ["open-default"], carbonGraphBlock(full)));
    pane.appendChild(section("Impacts — Full ISO per-stage matrix", [], impactMatrixBlock(full)));
    pane.appendChild(section("EPD, Methodology, Code Compliance", [], epdMethodBlock(full)));
    pane.appendChild(section("Raw JSON", [], rawJsonBlock(full)));
  }
  td.appendChild(pane);
  tr.appendChild(td);
  return tr;
}

function section(title, mods, contentEl) {
  const box = document.createElement("div");
  box.className = "db-section";
  if (mods.includes("open-default")) box.classList.add("open");
  const header = document.createElement("div");
  header.className = "db-section-header";
  header.innerHTML = `<span class="db-section-caret">▶</span><span class="db-section-title">${escapeHtml(title)}</span>`;
  header.addEventListener("click", () => box.classList.toggle("open"));
  const body = document.createElement("div");
  body.className = "db-section-body";
  body.appendChild(contentEl);
  box.append(header, body);
  return box;
}

// Key-value grid helper
function kv(pairs) {
  const dl = document.createElement("dl");
  dl.className = "db-kv-grid";
  for (const [label, value] of pairs) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    if (value === null || value === undefined || value === "") {
      dd.innerHTML = `<span class="db-kv-null">—</span>`;
    } else if (value instanceof Node) {
      dd.appendChild(value);
    } else {
      dd.textContent = String(value);
    }
    dl.append(dt, dd);
  }
  return dl;
}

function identityBlock(r) {
  const cls = r.classification || {};
  const rnd = r.rendering || {};
  const box = document.createElement("div");

  const elList = document.createElement("div");
  elList.className = "db-tag-list";
  for (const e of cls.typical_elements || []) {
    const t = document.createElement("span");
    t.className = "db-tag";
    t.textContent = e;
    elList.appendChild(t);
  }
  if (elList.childElementCount === 0) elList.innerHTML = `<span class="db-kv-null">—</span>`;

  const swatch = document.createElement("span");
  if (Array.isArray(rnd.base_color)) {
    const [r0, g0, b0, a0] = rnd.base_color;
    const rgba = `rgba(${Math.round(r0 * 255)},${Math.round(g0 * 255)},${Math.round(b0 * 255)},${a0 ?? 1})`;
    swatch.innerHTML = `<span class="db-swatch" style="background:${rgba}"></span>${rgba}`;
  } else {
    swatch.innerHTML = `<span class="db-kv-null">—</span>`;
  }

  box.appendChild(
    kv([
      ["id", r.id],
      ["beam_id", (r.external_refs || {}).beam_id],
      ["display_name", (r.naming || {}).display_name],
      ["material_name", (r.naming || {}).material_name],
      ["product_brand_name", (r.naming || {}).product_brand_name],
      ["group", cls.group_prefix || null],
      ["material_type", cls.material_type],
      ["product_type", cls.product_type],
      ["product_subtype", cls.product_subtype],
      ["typical_elements", elList],
      ["rendering.color", swatch],
      ["rendering.grain", rnd.has_grain ? "yes" : rnd.has_grain === false ? "no" : null]
    ])
  );
  return box;
}

function provenanceBlock(r) {
  const m = r.manufacturer || {};
  const p = r.provenance || {};
  const s = r.status || {};
  const box = document.createElement("div");

  const countries = (list) => {
    if (!list || list.length === 0) return "—";
    return list.join(", ");
  };
  const statusTags = ["listed", "do_not_list", "is_industry_average", "is_beam_average"]
    .filter((k) => s[k])
    .map((k) => `<span class="db-tag">${k}</span>`)
    .join("");
  const statusEl = document.createElement("span");
  statusEl.innerHTML = `${statusTags || '<span class="db-kv-null">—</span>'} <span class="db-tag">visibility: ${escapeHtml(s.visibility || "—")}</span>`;

  const link = m.website
    ? (() => {
        const a = document.createElement("a");
        a.className = "db-kv-link";
        a.href = m.website;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = m.website;
        return a;
      })()
    : null;

  box.appendChild(
    kv([
      ["manufacturer", m.name],
      ["country_code", m.country_code],
      ["specifications", m.specifications],
      ["website", link],
      ["countries_of_manufacture", countries(p.countries_of_manufacture)],
      ["markets_of_applicability", countries(p.markets_of_applicability)],
      ["data_added_or_modified", p.data_added_or_modified],
      ["status flags", statusEl],
      ["source_notes", r.source_notes],
      ["notes", r.notes]
    ])
  );
  return box;
}

function physicalBlock(r) {
  const phy = r.physical || {};
  const d = phy.density || {};
  const th = phy.thermal || {};
  const dim = phy.dimensions || {};
  const af = phy.additional_factor || {};
  const box = document.createElement("div");
  box.appendChild(
    kv([
      ["density", _valueWithSourceChip(fmtDualDensity(d), d.source)],
      ["thermal.conductivity (W/mK)", th.conductivity_w_mk],
      ["thermal.r_value/inch (imp)", th.r_value_per_inch_imperial],
      ["thermal.heat_capacity (J/kgK)", th.heat_capacity_j_kgk],
      ["moisture_content_pct", phy.moisture_content_pct],
      ["mass_per_unit_kg", phy.mass_per_unit_kg],
      ["dimensions.length_m", dim.length_m],
      ["dimensions.width_m", dim.width_m],
      ["dimensions.depth_m", dim.depth_m],
      ["dimensions.units_per_m2", dim.units_per_m2],
      ["additional_factor", af.value != null ? `${af.value} ${af.units || ""}`.trim() : null],
      ["additional_factor.description", af.description]
    ])
  );
  return box;
}

/* §10.1 provenance helpers ──────────────────────────────────────────
   _sourceChip(source) builds a small inline span with the per-source
   class. Returns null for unknown / null source so callers can opt out.
   _valueWithSourceChip(text, source) returns either:
     - the text alone (when source is null / unknown / "epd_direct")
     - a Node containing the text + a trailing chip (otherwise)
   The kv() helper handles either return type — strings render as-is,
   Nodes get appended via dd.appendChild(value). */
function _sourceChip(source) {
  if (!source || source === "epd_direct") return null;
  const cls =
    source === "generic_default"
      ? "db-chip-source-default"
      : source === "calculated"
        ? "db-chip-source-calc"
        : source === "user_edit"
          ? "db-chip-source-edit"
          : null;
  if (!cls) return null;
  const chip = document.createElement("span");
  chip.className = cls;
  chip.textContent = source === "generic_default" ? "DEFAULT" : source === "calculated" ? "CALC" : "EDIT";
  chip.style.marginLeft = "6px";
  return chip;
}
function _valueWithSourceChip(text, source) {
  const chip = _sourceChip(source);
  if (text == null || text === "") return null;
  if (!chip) return text;
  const wrap = document.createElement("span");
  wrap.appendChild(document.createTextNode(String(text)));
  wrap.appendChild(chip);
  return wrap;
}

function fmtDualDensity(d) {
  if (d.value_kg_m3 == null && d.value_lb_ft3 == null) return null;
  const kg = d.value_kg_m3 != null ? `${d.value_kg_m3} kg/m³` : "—";
  const lb = d.value_lb_ft3 != null ? `${d.value_lb_ft3} lb/ft³` : "—";
  return `${kg}   (${lb})`;
}

function carbonGraphBlock(r) {
  const c = r.carbon || {};
  const st = c.stated || {};
  const cv = c.conversion || {};
  const cm = c.common || {};
  const bg = c.biogenic || {};
  const wrap = document.createElement("div");

  const flow = document.createElement("div");
  flow.style.fontFamily = "var(--font-mono)";
  flow.style.fontSize = "11px";
  flow.style.lineHeight = "1.7";
  flow.style.whiteSpace = "pre";
  flow.style.color = "var(--text)";
  flow.style.padding = "8px 10px";
  flow.style.background = "var(--bg)";
  flow.style.border = "1px solid var(--border)";
  flow.style.borderRadius = "4px";
  flow.style.marginBottom = "10px";
  flow.textContent = `stated     ${fmtOr(st.value_kgco2e, "—")} kgCO₂e / ${st.per_unit || "?"}   [source: ${st.source || "—"}]
             stages declared: ${(st.lifecycle_stages || []).join(", ") || "—"}
      │
      ▼   ${cv.factor_formula || "—"}
          factor = ${fmtOr(cv.factor, "—")}    (${cv.factor_source || "—"})
      │
      ▼
common     ${fmtOr(cm.value_kgco2e, "—")} kgCO₂e / ${cm.per_functional_unit || "—"}     (${cm.metric_unit_label || ""} · ${cm.imperial_unit_label || ""})
      │
      ▼
biogenic   method: ${bg.method || "—"}
           biogenic_factor=${fmtOr(bg.biogenic_factor, "—")}  carbon_content=${fmtOr(bg.carbon_content_pct_kgc_kg, "—")} kgC/kg
           full_C   = density × thickness × bio × C × 3.67 = ${fmtOr(bg.full_carbon_kgco2e_per_common_unit, "—")} kgCO₂e
           stored   = full_C × ${fmtOr(bg.storage_retention_pct, "—")} = ${fmtOr(bg.stored_kgco2e_per_common_unit, "—")} kgCO₂e
           C/unit   = ${fmtOr(bg.carbon_content_kgc_per_unit, "—")} kgC`;
  wrap.appendChild(flow);

  wrap.appendChild(
    kv([
      ["conversion.notes", cv.notes],
      ["biogenic.notes", bg.notes]
    ])
  );
  return wrap;
}
function fmtOr(v, dash) {
  return v == null ? dash : v;
}

function impactMatrixBlock(r) {
  const impacts = r.impacts || {};
  const box = document.createElement("div");

  const meta = document.createElement("div");
  meta.style.fontSize = "10px";
  meta.style.color = "var(--text-dim)";
  meta.style.marginBottom = "6px";
  meta.textContent = `functional_unit: ${impacts.functional_unit || "—"}   ·   scroll right to see all 17 EN 15804+A2 stages`;
  box.appendChild(meta);

  const scroll = document.createElement("div");
  scroll.className = "db-impact-scroll";
  const table = document.createElement("table");
  table.className = "db-impact-matrix";

  // Header — two rows: group labels + stage codes
  const thead = document.createElement("thead");
  const rGroup = document.createElement("tr");
  rGroup.innerHTML = `<th class="im-cat" rowspan="2">Category</th><th class="im-total" rowspan="2">Total</th>`;
  for (const grp of STAGE_GROUPS) {
    const th = document.createElement("th");
    th.colSpan = grp.stages.length;
    th.className = "im-stage-group";
    th.textContent = grp.group;
    rGroup.appendChild(th);
  }
  const rStages = document.createElement("tr");
  for (const s of ALL_STAGES) {
    const th = document.createElement("th");
    th.textContent = s;
    rStages.appendChild(th);
  }
  thead.append(rGroup, rStages);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const cat of IMPACT_CATEGORIES) {
    const block = impacts[cat.key] || { total: { value: null, source: null }, by_stage: {} };
    const tr = document.createElement("tr");
    const tdCat = document.createElement("td");
    tdCat.className = "im-cat";
    tdCat.innerHTML = `<div>${escapeHtml(cat.label)}</div><div style="font-size:9px;color:var(--text-dim);font-family:var(--font-mono)">${escapeHtml(cat.unit)}</div>`;
    tr.appendChild(tdCat);

    const tdTotal = document.createElement("td");
    tdTotal.className = "im-total";
    const tv = block.total && block.total.value;
    const ts = block.total && block.total.source;
    tdTotal.innerHTML =
      tv == null
        ? `<span class="im-null">—</span>`
        : `${fmtNum(tv)}<span class="im-src im-src-${ts || ""}">${escapeHtml(ts || "")}</span>`;
    tr.appendChild(tdTotal);

    for (const s of ALL_STAGES) {
      const slot = (block.by_stage || {})[s];
      const td = document.createElement("td");
      td.className = "im-stage" + (!slot || slot.value == null ? " im-null" : "");
      if (slot && slot.value != null) {
        td.innerHTML = `${fmtNum(slot.value)}<span class="im-src im-src-${slot.source || ""}">${escapeHtml(slot.source || "")}</span>`;
      } else {
        td.innerHTML = `<span>—</span>`;
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  scroll.appendChild(table);
  box.appendChild(scroll);
  return box;
}

function fmtNum(n) {
  if (typeof n !== "number") return String(n);
  if (n === 0) return "0";
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(2);
  if (abs >= 0.01) return n.toFixed(3);
  return n.toExponential(2);
}

function epdMethodBlock(r) {
  const epd = r.epd || {};
  const met = r.methodology || {};
  const cc = r.code_compliance || {};
  const fire = r.fire || {};
  const box = document.createElement("div");

  const epdLink = epd.source_document_url
    ? (() => {
        const a = document.createElement("a");
        a.className = "db-kv-link";
        a.href = epd.source_document_url;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Open EPD document";
        return a;
      })()
    : null;
  const validation = epd.validation || {};

  const standards = document.createElement("div");
  standards.className = "db-tag-list";
  for (const s of met.standards || []) {
    const t = document.createElement("span");
    t.className = "db-tag";
    t.textContent = s;
    standards.appendChild(t);
  }
  if (standards.childElementCount === 0) standards.innerHTML = `<span class="db-kv-null">—</span>`;

  const stages = document.createElement("div");
  stages.className = "db-tag-list";
  for (const s of (met.lifecycle_scope || {}).stages_included || []) {
    const t = document.createElement("span");
    t.className = "db-tag";
    t.textContent = s;
    stages.appendChild(t);
  }
  if (stages.childElementCount === 0) stages.innerHTML = `<span class="db-kv-null">—</span>`;

  box.appendChild(
    kv([
      ["epd.id", epd.id],
      ["epd.type", epd.type],
      ["epd.owner", epd.owner],
      ["epd.prepared_by", epd.prepared_by],
      ["epd.program_operator", epd.program_operator],
      ["epd.validation", `${validation.type || "—"} · ${validation.agent || "—"}`],
      ["epd.expiry_date", epd.expiry_date],
      ["epd.service_life_yr", epd.product_service_life_years],
      ["epd.source", epdLink],
      ["epd.footnote", epd.footnote],
      ["—", ""],
      ["methodology.standards", standards],
      ["methodology.pcr_guidelines", met.pcr_guidelines],
      ["methodology.lca_method", met.lca_method],
      ["methodology.lca_software", met.lca_software],
      ["methodology.lci_database", met.lci_database],
      ["lifecycle_scope.stages", stages],
      ["lifecycle_scope.cutoff_pct", (met.lifecycle_scope || {}).cutoff_rule_pct],
      ["lifecycle_scope.allocation", (met.lifecycle_scope || {}).allocation_method],
      ["—", ""],
      ["fire.combustibility", fire.combustibility],
      ["fire.frr_hours", fire.frr_hours],
      ["fire.ulc_listing", fire.ulc_listing],
      ["code_compliance.nbc_part_9_suitable", boolOrNull(cc.nbc_part_9_suitable)],
      ["code_compliance.nbc_part_3_suitable", boolOrNull(cc.nbc_part_3_suitable)],
      ["code_compliance.vbbl_s10_4_accepted", boolOrNull(cc.vbbl_s10_4_accepted)],
      ["code_compliance.cov_appendix_ii_listed", boolOrNull(cc.cov_appendix_ii_listed)]
    ])
  );
  return box;
}
function boolOrNull(v) {
  return v === true ? "yes" : v === false ? "no" : null;
}

function rawJsonBlock(r) {
  const pre = document.createElement("pre");
  pre.style.fontFamily = "var(--font-mono)";
  pre.style.fontSize = "10px";
  pre.style.lineHeight = "1.4";
  pre.style.color = "var(--text)";
  pre.style.background = "var(--bg)";
  pre.style.border = "1px solid var(--border)";
  pre.style.borderRadius = "4px";
  pre.style.padding = "10px";
  pre.style.maxHeight = "280px";
  pre.style.overflow = "auto";
  pre.style.whiteSpace = "pre";
  pre.textContent = JSON.stringify(r, null, 2);
  const wrap = document.createElement("div");
  wrap.appendChild(pre);
  return wrap;
}

// ────────────────────────────────────────────────────────────
// Util
// ────────────────────────────────────────────────────────────
function setStatus(msg, kind) {
  const el = document.getElementById("db-status-message");
  if (!el) return;
  el.textContent = msg;
  el.className = kind === "busy" ? "status-busy" : kind === "error" ? "status-error" : "status-ready";
}
function debounce(fn, ms) {
  let t;
  return function (...a) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, a), ms);
  };
}
function short(sha) {
  return sha ? sha.slice(0, 10) : "—";
}
function escapeAttr(s) {
  return escapeHtml(s);
}

// ────────────────────────────────────────────────────────────
// EPD-Parser pending-changes panel (Database.md §4–§5)
// ────────────────────────────────────────────────────────────
async function refreshPendingPanel() {
  const panel = document.getElementById("db-pending-panel");
  const rows = document.getElementById("db-pending-rows");
  const count = document.getElementById("db-pending-count");
  if (!panel || !rows) return;
  const captured = await Store.listCapturedPending();
  if (captured.length === 0) {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "";
  count.textContent = String(captured.length);
  rows.innerHTML = captured.map(renderPendingRow).join("");
  // Wire per-row buttons
  rows.querySelectorAll(".db-pending-trust").forEach((btn) => {
    btn.addEventListener("click", () => handleTrust(btn.dataset.sourceFile));
  });
  rows.querySelectorAll(".db-pending-verify").forEach((btn) => {
    btn.addEventListener("click", () => openVerifyModal(btn.dataset.sourceFile));
  });
  rows.querySelectorAll(".db-pending-discard").forEach((btn) => {
    btn.addEventListener("click", () => handleDiscard(btn.dataset.sourceFile));
  });
}

function renderPendingRow(rec) {
  const cand = rec.candidate_record || {};
  const display = (cand.naming && cand.naming.display_name) || "(unnamed)";
  const mfr = (cand.manufacturer && cand.manufacturer.name) || "—";
  const epdId = (cand.epd && cand.epd.id) || "—";
  const grp = (cand.classification && cand.classification.group_prefix) || "—";
  const editor = (rec.audit_meta && rec.audit_meta.editor) || "—";
  const captured = (rec.audit_meta && rec.audit_meta.captured_at) || "";
  return `
    <div class="db-pending-row">
      <div class="db-pending-row-meta">
        <div class="db-pending-row-name">${escapeHtml(display)}</div>
        <div class="db-pending-row-sub">
          <span class="db-pending-grp">grp ${escapeHtml(grp)}</span>
          <span>·</span>
          <span>${escapeHtml(mfr)}</span>
          <span>·</span>
          <span>EPD: ${escapeHtml(epdId)}</span>
        </div>
        <div class="db-pending-row-source">
          <i class="bi bi-file-earmark-pdf"></i> ${escapeHtml(rec.source_file)}
          · ${escapeHtml(editor)} · ${escapeHtml(captured ? captured.slice(0, 16).replace("T", " ") : "")}
        </div>
      </div>
      <div class="db-pending-row-actions">
        <button type="button" class="db-pending-trust" data-source-file="${escapeAttr(rec.source_file)}" title="Trust: one-click commit, no review modal">
          <i class="bi bi-lightning-charge"></i> Trust
        </button>
        <button type="button" class="db-pending-verify" data-source-file="${escapeAttr(rec.source_file)}" title="Trust + Verify: open the review modal">
          <i class="bi bi-file-earmark-ruled"></i> Trust + Verify
        </button>
        <button type="button" class="db-pending-discard" data-source-file="${escapeAttr(rec.source_file)}" title="Discard this captured row">
          <i class="bi bi-trash3"></i>
        </button>
      </div>
    </div>
  `;
}

async function handleTrust(sourceFile) {
  const rec = await Store.getPending(sourceFile);
  if (!rec) {
    setStatus(`Trust: no pending row for ${sourceFile}`, "error");
    return;
  }

  const candidate = rec.candidate_record || {};

  // Decide commit type by checking whether the candidate's id matches an
  // existing index entry. New EPDs without an id assigned by the parser
  // get a fresh 6-char hex id minted here (matches the existing catalogue
  // convention; team can rename via patch later if needed).
  let mergedRecord = candidate;
  let commitType = "new";
  if (candidate.id) {
    const existing = state.indexEntries.find((e) => e.id === candidate.id);
    if (existing) {
      const existingFull = state.recordCache.get(candidate.id) || null;
      mergedRecord = _mergeRefresh(existingFull, candidate);
      commitType = "refresh";
    }
  }
  if (!mergedRecord.id) mergedRecord.id = _mintId6();
  if (!mergedRecord.beam_id) mergedRecord.beam_id = mergedRecord.id;

  const indexEntry = _indexEntryFromRecord(mergedRecord);
  if (!indexEntry.id) {
    setStatus(`Trust: cannot commit — record is missing required fields`, "error");
    return;
  }

  await Store.putCommittedPatch({
    id: indexEntry.id,
    record: mergedRecord,
    index_entry: indexEntry,
    commit_type: commitType,
    source_file: sourceFile,
    audit_meta: rec.audit_meta || null,
    committed_at: new Date().toISOString()
  });

  // Optimistic in-memory insert so the new record appears in search /
  // group filters without a reload. The _fresh flag drives the yellow
  // highlight in the row renderer.
  _mergeIndexEntryIntoState(indexEntry, commitType);
  state.recordCache.set(indexEntry.id, mergedRecord);

  await Store.deletePending(sourceFile);
  applyFilters();
  await refreshPendingPanel();

  const display = indexEntry.display_name || sourceFile;
  const verb = commitType === "refresh" ? "refreshed" : "committed";
  setStatus(
    `Trust: ${verb} ${display} (${indexEntry.beam_id}) · find it in the catalogue · click Trust + Verify to audit`,
    "ready"
  );
}

/**
 * Build an index-shape entry from a full material record. Mirrors the
 * field set produced by schema/scripts/beam-csv-to-json.mjs's index step.
 *
 * Schema shapes that bit us:
 *   impacts.gwp_kgco2e.total = { value, source }   (NOT a scalar)
 *   impacts.functional_unit                        (NOT physical.declared_unit)
 * EPD-Parser writes physical.declared_unit but the catalogue index
 * historically reads impacts.functional_unit; preserve both in the form
 * (Phase 4 form-pane refactor) but read either path here.
 */
function _indexEntryFromRecord(rec) {
  const r = rec || {};
  const cls = r.classification || {};
  const naming = r.naming || {};
  const impacts = r.impacts || {};
  const physical = r.physical || {};
  const gwpTotal = (impacts.gwp_kgco2e && impacts.gwp_kgco2e.total) || {};
  const gwpVal = gwpTotal && typeof gwpTotal.value === "number" ? gwpTotal.value : null;
  const prefix = cls.group_prefix || null;
  const groupMeta = prefix && GROUPS[prefix] ? GROUPS[prefix] : null;
  return {
    id: r.id || null,
    beam_id: r.beam_id || r.id || null,
    display_name: naming.display_name || naming.product_brand_name || "—",
    category: cls.category || (groupMeta ? `${prefix}_${groupMeta.label.toLowerCase()}` : null),
    group_prefix: prefix,
    typical_elements: cls.typical_elements || [],
    gwp_kgco2e: gwpVal,
    functional_unit: impacts.functional_unit || physical.declared_unit || physical.functional_unit || null
  };
}

/**
 * Merge a fresh candidate over an existing record for a refresh commit.
 * Candidate values overwrite when set; null/undefined candidate values
 * preserve the prior record's content. Arrays in the candidate replace
 * arrays in the prior record (no element-wise merge — the EPD is the
 * source of truth for its own scope/elements/etc.).
 */
function _mergeRefresh(prior, candidate) {
  if (!prior) return candidate;
  const out = JSON.parse(JSON.stringify(prior));
  for (const k of Object.keys(candidate || {})) {
    const v = candidate[k];
    if (v == null) continue;
    if (typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] && !Array.isArray(out[k])) {
      out[k] = _mergeRefresh(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Insert or replace an index entry in state.indexEntries, marking it
 * fresh for the highlight CSS + chip. Refresh commits replace the
 * existing entry in place (so order doesn't churn); new commits append.
 */
function _mergeIndexEntryIntoState(indexEntry, commitType) {
  const idx = state.indexEntries.findIndex((e) => e.id === indexEntry.id);
  const annotated = Object.assign({}, indexEntry, { _fresh: true, _commit_type: commitType });
  if (idx >= 0) {
    state.indexEntries[idx] = annotated;
  } else {
    state.indexEntries.push(annotated);
  }
}

/**
 * Boot-time hook: pull any persisted committed_patches from IndexedDB
 * and merge them into state.indexEntries + state.recordCache. Runs once
 * during boot, after the JSON-fetched catalogue loads. Soft-fails if the
 * IndexedDB store isn't available so catalogue browsing always works.
 */
async function _mergeCommittedPatchesOnBoot() {
  let patches = [];
  try {
    patches = await Store.listCommittedPatches();
  } catch (err) {
    console.warn("[DB] committed_patches read skipped:", err);
    return;
  }
  for (const p of patches) {
    if (!p || !p.id || !p.index_entry) continue;
    state.recordCache.set(p.id, p.record || null);
    _mergeIndexEntryIntoState(p.index_entry, p.commit_type || "new");
  }
}

/**
 * Mint a 6-char lowercase hex id matching the existing catalogue
 * convention (e.g. "6ab68b"). Collision-checks against the in-memory
 * index — collisions are vanishingly rare at 24 bits but cheap to skip.
 */
function _mintId6() {
  for (let attempt = 0; attempt < 16; attempt++) {
    const id = Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0");
    if (!state.indexEntries.some((e) => e.id === id)) return id;
  }
  // Fall back to timestamp-derived id if 16 random tries collided.
  return Date.now().toString(16).slice(-6);
}

async function handleDiscard(sourceFile) {
  await Store.deletePending(sourceFile);
  await refreshPendingPanel();
  setStatus(`Discarded pending row for ${sourceFile}`, "ready");
}

// ────────────────────────────────────────────────────────────
// Trust + Verify modal (stub — shows candidate JSON; P3 replaces with diff)
// ────────────────────────────────────────────────────────────
let _verifyActiveSource = null;

function wireVerifyModal() {
  const close = document.getElementById("db-verify-close");
  const cancel = document.getElementById("db-verify-cancel");
  const commit = document.getElementById("db-verify-commit");
  const backdrop = document.getElementById("db-verify-backdrop");
  if (close) close.addEventListener("click", closeVerifyModal);
  if (cancel) cancel.addEventListener("click", closeVerifyModal);
  if (backdrop) backdrop.addEventListener("click", closeVerifyModal);
  if (commit)
    commit.addEventListener("click", () => {
      if (!_verifyActiveSource) return;
      handleTrust(_verifyActiveSource).then(closeVerifyModal);
    });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && _verifyActiveSource) closeVerifyModal();
  });
}

async function openVerifyModal(sourceFile) {
  const rec = await Store.getPending(sourceFile);
  if (!rec) return;
  _verifyActiveSource = sourceFile;
  document.getElementById("db-verify-source").textContent = sourceFile;
  document.getElementById("db-verify-outcome").textContent = rec.match_outcome || "new";
  document.getElementById("db-verify-editor").textContent = (rec.audit_meta && rec.audit_meta.editor) || "—";
  document.getElementById("db-verify-captured").textContent = (rec.audit_meta && rec.audit_meta.captured_at) || "—";
  document.getElementById("db-verify-json").textContent = JSON.stringify(rec.candidate_record, null, 2);
  document.getElementById("db-verify-backdrop").style.display = "";
  document.getElementById("db-verify-modal").style.display = "";
}

function closeVerifyModal() {
  _verifyActiveSource = null;
  document.getElementById("db-verify-backdrop").style.display = "none";
  document.getElementById("db-verify-modal").style.display = "none";
}

// ────────────────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────────────────
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
