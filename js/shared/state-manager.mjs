// state-manager.mjs
// Single source of truth for BEAMweb field values. Mirrors OBJECTIVE's
// TEUI.StateManager architecture (dependencies, listeners, dirty tracking,
// localStorage autosave) but simplified — no dual Reference/Target state.
//
// Port reference: OBJECTIVE 4011-StateManager.js (≈1400 lines → condensed)
//
// Extension point for future dual-state (baseline vs improved):
//   - Add `ref_` prefix handling in getValue/setValue
//   - Mirror activeReferenceDataSet + independentReferenceState maps
//   - Keep this stub's single-map API as the Target path
//
// Phase 1 stub — method signatures locked; internals match OBJECTIVE patterns
// but values and registrations are BEAM-specific and land in later phases.

const VALUE_STATES = Object.freeze({
  DEFAULT: "default",
  IMPORTED: "imported",
  USER_MODIFIED: "user-modified",
  CALCULATED: "calculated",
  DERIVED: "derived"
});

const STORAGE_KEY = "BEAM_Calculator_State";
const IMPORTED_KEY = "BEAM_Last_Imported_State";

const fields = new Map();
const dependencies = new Map();
const calculatedFields = new Set();
const dirtyFields = new Set();
const listeners = new Map();

// Parallel map keyed by dim_* / garage_* field ids. Records where a dimension
// value came from when it was not typed by the user: "pdf:<poly_id>" for a
// single-polygon import, "pdf:sum:<id>+<id>" for an aggregated import. Once
// the user overrides, the importer must clear (or set to "user") so the
// provenance badge in the UI stops claiming the value came from PDF-Parser.
// Bridge spec §3.3: persisted in exported JSON as a parallel top-level map.
const dimensionSources = new Map();

let listenersActive = true;
let lastImportedState = {};
let autoSaveTimer = null;

function parseNumeric(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "number") return isNaN(value) ? defaultValue : value;
  if (typeof value !== "string") return defaultValue;
  const cleaned = value
    .replace(/[$£€¥]/g, "")
    .replace(/,/g, "")
    .trim();
  if (cleaned === "" || cleaned.toUpperCase() === "N/A") return defaultValue;
  const n = parseFloat(cleaned);
  return isNaN(n) ? defaultValue : n;
}

function formatNumber(value, formatType = "number-2dp") {
  if (value === null || value === undefined || String(value).trim().toUpperCase() === "N/A") {
    return "N/A";
  }
  if (formatType === "raw") return String(value);
  const n = parseNumeric(value, NaN);
  if (isNaN(n)) return typeof value === "string" && value.trim() !== "" ? value : "0.00";

  if (formatType === "integer") {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0, useGrouping: true });
  }
  const [type, dpPart = ""] = formatType.split("-");
  const useCommas = formatType.includes("comma");
  const dpMatch = dpPart.match(/(\d+)d/);
  const decimals = dpMatch ? parseInt(dpMatch[1], 10) : 2;

  if (type === "percent") {
    return n.toLocaleString(undefined, {
      style: "percent",
      minimumFractionDigits: dpPart ? decimals : 0,
      maximumFractionDigits: dpPart ? decimals : 0
    });
  }
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: useCommas
  });
}

function getValue(fieldId) {
  return fields.has(fieldId) ? fields.get(fieldId).value : null;
}

function getFieldState(fieldId) {
  return fields.has(fieldId) ? fields.get(fieldId).state : null;
}

function setValue(fieldId, value, state = VALUE_STATES.USER_MODIFIED) {
  const existing = fields.get(fieldId);

  if (state === VALUE_STATES.IMPORTED) {
    lastImportedState[fieldId] = value;
  }

  if (existing && existing.value === value && existing.state === state) {
    return false;
  }

  const oldValue = existing ? existing.value : null;
  fields.set(fieldId, { id: fieldId, value, state });

  if (state !== VALUE_STATES.CALCULATED && state !== VALUE_STATES.DERIVED) {
    markDependentsDirty(fieldId);
  }

  notifyListeners(fieldId, value, oldValue, state);

  if (state === VALUE_STATES.USER_MODIFIED || state === VALUE_STATES.IMPORTED) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveState, 1000);
  }
  return true;
}

function registerDependency(sourceId, targetId) {
  if (!dependencies.has(sourceId)) dependencies.set(sourceId, new Set());
  dependencies.get(sourceId).add(targetId);
  calculatedFields.add(targetId);
}

function markDependentsDirty(fieldId, visited = new Set()) {
  if (visited.has(fieldId)) return;
  visited.add(fieldId);
  const deps = dependencies.get(fieldId);
  if (!deps) return;
  for (const dep of deps) {
    dirtyFields.add(dep);
    markDependentsDirty(dep, visited);
  }
}

function getDirtyFields() {
  return [...dirtyFields];
}

function clearDirtyStatus(fieldIds = []) {
  if (fieldIds.length === 0) dirtyFields.clear();
  else fieldIds.forEach((id) => dirtyFields.delete(id));
}

function addListener(fieldId, callback) {
  if (!listeners.has(fieldId)) listeners.set(fieldId, new Set());
  listeners.get(fieldId).add(callback);
}

function removeListener(fieldId, callback) {
  listeners.get(fieldId)?.delete(callback);
}

function notifyListeners(fieldId, newValue, oldValue, state) {
  if (!listenersActive) return;
  const set = listeners.get(fieldId);
  if (!set) return;
  for (const cb of set) {
    try {
      cb(newValue, oldValue, fieldId, state);
    } catch (err) {
      console.error(`[StateManager] listener error for ${fieldId}:`, err);
    }
  }
}

function muteListeners() {
  listenersActive = false;
}
function unmuteListeners() {
  listenersActive = true;
}

function saveState() {
  const state = {};
  for (const [id, field] of fields) {
    if (field.state === VALUE_STATES.USER_MODIFIED || field.state === VALUE_STATES.IMPORTED) {
      state[id] = { value: field.value, state: field.state };
    }
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (Object.keys(lastImportedState).length > 0) {
      localStorage.setItem(IMPORTED_KEY, JSON.stringify(lastImportedState));
    }
  } catch (err) {
    console.error("[StateManager] save failed:", err);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      for (const [id, field] of Object.entries(state)) {
        setValue(id, field.value, field.state);
      }
    }
    const importedRaw = localStorage.getItem(IMPORTED_KEY);
    if (importedRaw) lastImportedState = JSON.parse(importedRaw);
  } catch (err) {
    console.error("[StateManager] load failed:", err);
  }
}

function clear() {
  fields.clear();
  dependencies.clear();
  calculatedFields.clear();
  dirtyFields.clear();
  dimensionSources.clear();
  lastImportedState = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(IMPORTED_KEY);
  } catch (err) {
    console.error("[StateManager] clear failed:", err);
  }
}

function clearByPrefix(prefix) {
  if (!prefix) return 0;
  let removed = 0;
  for (const id of [...fields.keys()]) {
    if (id.startsWith(prefix)) {
      const old = fields.get(id);
      fields.delete(id);
      delete lastImportedState[id];
      dimensionSources.delete(id);
      notifyListeners(id, null, old?.value, "cleared");
      removed++;
    }
  }
  if (removed) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(saveState, 1000);
  }
  return removed;
}

function getDimensionSource(fieldId) {
  return dimensionSources.has(fieldId) ? dimensionSources.get(fieldId) : null;
}

function setDimensionSource(fieldId, src) {
  if (!fieldId) return;
  if (src === null || src === undefined || src === "") {
    dimensionSources.delete(fieldId);
  } else {
    dimensionSources.set(fieldId, String(src));
  }
}

function exportDimensionSources() {
  const out = {};
  for (const [id, src] of dimensionSources) out[id] = src;
  return out;
}

function importDimensionSources(data) {
  if (!data || typeof data !== "object") return;
  for (const [id, src] of Object.entries(data)) {
    setDimensionSource(id, src);
  }
}

// ── Dependency graph export ──────────────────────────────
// Emits a { nodes, links } payload in the shape OBJECTIVE's
// 4011-Dependency.js consumes, so the eventual BEAMweb graph
// renderer can port directly once the migration trigger in
// BEAMweb.md §8 fires. Today this is read by the dormant
// dependency-graph stub to show architecture + any registered
// field edges. Field edges stay sparse until auto-fill.mjs's
// listeners get rewritten as `registerDependency()` calls.
//
// Architectural nodes are fixed (mirrors OBJECTIVE's pattern):
// Foundation = state/storage primitives, Coordination = the
// bridges and orchestration glue, Application = the user-facing
// tabs. Tab nodes map onto BEAM_TABS. Mode argument is reserved
// for the day we add a dual-state (target / reference) view;
// today only "target" is populated.

const ARCHITECTURAL_NODES = [
  {
    id: "FOUNDATION-StateManager",
    group: "Foundation",
    type: "module",
    architecturalLayer: "Foundation",
    label: "StateManager",
    description: "Central state store + dependency registry"
  },
  {
    id: "FOUNDATION-ProjectStore",
    group: "Foundation",
    type: "module",
    architecturalLayer: "Foundation",
    label: "PDF-Parser ProjectStore",
    description: "PDF-Parser polygons + params, IndexedDB backed"
  },
  {
    id: "FOUNDATION-MaterialsIndex",
    group: "Foundation",
    type: "module",
    architecturalLayer: "Foundation",
    label: "Materials Index",
    description: "821-record BfCA material catalogue"
  },
  {
    id: "COORDINATION-PolygonMap",
    group: "Coordination",
    type: "module",
    architecturalLayer: "Coordination",
    label: "polygon-map (bridge aggregator)",
    description: "Component tags \u2192 BEAMweb dims + cross-feeds"
  },
  {
    id: "COORDINATION-PdfBridgeImport",
    group: "Coordination",
    type: "module",
    architecturalLayer: "Coordination",
    label: "pdf-bridge-import",
    description: "BEAMweb-side import flow + preview + apply"
  },
  {
    id: "COORDINATION-AutoFill",
    group: "Coordination",
    type: "module",
    architecturalLayer: "Coordination",
    label: "PROJECT \u2192 F&S auto-fill",
    description: "Per-key listeners that propagate PROJECT edits to F&S rows"
  },
  {
    id: "COORDINATION-FileHandler",
    group: "Coordination",
    type: "module",
    architecturalLayer: "Coordination",
    label: "File handler",
    description: "Project JSON + CSV + XLSX import/export"
  },
  {
    id: "APPLICATION-Intro",
    group: "Application",
    type: "module",
    architecturalLayer: "Application",
    label: "Intro tab"
  },
  {
    id: "APPLICATION-Project",
    group: "Application",
    type: "module",
    architecturalLayer: "Application",
    label: "PROJECT tab",
    description: "Dimension inputs + geometry parameters"
  },
  {
    id: "APPLICATION-FootingsSlabs",
    group: "Application",
    type: "module",
    architecturalLayer: "Application",
    label: "Footings & Slabs tab",
    description: "Phase 3 live consumer of PROJECT"
  },
  {
    id: "APPLICATION-Glossary",
    group: "Application",
    type: "module",
    architecturalLayer: "Application",
    label: "Glossary tab"
  },
  {
    id: "APPLICATION-EnergyGhg",
    group: "Application",
    type: "module",
    architecturalLayer: "Application",
    label: "Energy / GHG reference tab"
  }
];

const ARCHITECTURAL_LINKS = [
  { source: "FOUNDATION-StateManager", target: "COORDINATION-PdfBridgeImport" },
  { source: "FOUNDATION-StateManager", target: "COORDINATION-AutoFill" },
  { source: "FOUNDATION-StateManager", target: "COORDINATION-FileHandler" },
  { source: "FOUNDATION-StateManager", target: "APPLICATION-Project" },
  { source: "FOUNDATION-StateManager", target: "APPLICATION-FootingsSlabs" },
  { source: "FOUNDATION-ProjectStore", target: "COORDINATION-PolygonMap" },
  { source: "FOUNDATION-ProjectStore", target: "COORDINATION-PdfBridgeImport" },
  { source: "FOUNDATION-MaterialsIndex", target: "APPLICATION-FootingsSlabs" },
  { source: "COORDINATION-PolygonMap", target: "COORDINATION-PdfBridgeImport" },
  { source: "COORDINATION-PdfBridgeImport", target: "APPLICATION-Project" },
  { source: "COORDINATION-AutoFill", target: "APPLICATION-FootingsSlabs" },
  { source: "COORDINATION-FileHandler", target: "FOUNDATION-StateManager" },
  { source: "APPLICATION-Project", target: "APPLICATION-FootingsSlabs" }
];

function exportDependencyGraph(options) {
  const opts = options || {};
  const mode = opts.mode || "target";
  const includeArchitectural = opts.includeArchitectural !== false;

  const nodesById = new Map();
  const links = [];

  if (includeArchitectural) {
    for (const node of ARCHITECTURAL_NODES) nodesById.set(node.id, { ...node });
    for (const link of ARCHITECTURAL_LINKS) {
      links.push({ source: link.source, target: link.target, dependencyMode: "architectural" });
    }
  }

  // Field-level edges from the dependencies Map. Empty today for BEAMweb
  // because auto-fill wires PROJECT \u2192 F&S via listeners rather than
  // StateManager.registerDependency. Light-up happens during the §8 migration.
  const emitFieldEdge = (sourceId, targetId, dependencyMode) => {
    if (!nodesById.has(sourceId)) {
      nodesById.set(sourceId, { id: sourceId, type: "field", group: inferFieldGroup(sourceId), dependencyMode });
    }
    if (!nodesById.has(targetId)) {
      nodesById.set(targetId, { id: targetId, type: "field", group: inferFieldGroup(targetId), dependencyMode });
    }
    links.push({ source: sourceId, target: targetId, dependencyMode });
  };

  if (mode === "target" || mode === "both") {
    for (const [sourceId, targetSet] of dependencies) {
      for (const targetId of targetSet) emitFieldEdge(sourceId, targetId, "target");
    }
  }
  if (mode === "reference" || mode === "both") {
    // Reference mode reserved for future dual-state (prefixed ref_ fields).
    // Today BEAMweb has a single state so this path is a no-op; leaving the
    // scaffold so OBJECTIVE-style dual analysis slots in when we need it.
  }

  return {
    nodes: Array.from(nodesById.values()),
    links,
    meta: {
      mode,
      includeArchitectural,
      fieldCount: fields.size,
      registeredDependencies: dependencies.size,
      generatedAt: new Date().toISOString()
    }
  };
}

function inferFieldGroup(fieldId) {
  if (!fieldId) return "Other";
  if (fieldId.startsWith("dim_")) return "PROJECT Dimensions";
  if (fieldId.startsWith("param_")) return "Geometry Parameters";
  if (fieldId.startsWith("garage_")) return "Garage";
  if (fieldId.startsWith("project_")) return "Project Info";
  if (fieldId.startsWith("fs_")) return "Footings & Slabs";
  return "Other";
}

function exportState() {
  const out = {};
  for (const [id, field] of fields) out[id] = field.value;
  return out;
}

function importState(data) {
  for (const [id, value] of Object.entries(data)) {
    setValue(id, value, VALUE_STATES.IMPORTED);
  }
}

function getLastImportedState() {
  return { ...lastImportedState };
}

export const StateManager = {
  VALUE_STATES,
  getValue,
  getFieldState,
  setValue,
  registerDependency,
  markDependentsDirty,
  getDirtyFields,
  clearDirtyStatus,
  addListener,
  removeListener,
  muteListeners,
  unmuteListeners,
  saveState,
  loadState,
  clear,
  clearByPrefix,
  exportState,
  importState,
  getLastImportedState,
  getDimensionSource,
  setDimensionSource,
  exportDimensionSources,
  importDimensionSources,
  exportDependencyGraph,
  parseNumeric,
  formatNumber
};

if (typeof window !== "undefined") {
  window.BEAM = window.BEAM || {};
  window.BEAM.StateManager = StateManager;
  window.BEAM.parseNumeric = parseNumeric;
  window.BEAM.formatNumber = formatNumber;
}
