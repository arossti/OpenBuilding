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
  DERIVED: "derived",
});

const STORAGE_KEY = "BEAM_Calculator_State";
const IMPORTED_KEY = "BEAM_Last_Imported_State";

const fields = new Map();
const dependencies = new Map();
const calculatedFields = new Set();
const dirtyFields = new Set();
const listeners = new Map();

let listenersActive = true;
let lastImportedState = {};
let autoSaveTimer = null;

function parseNumeric(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "number") return isNaN(value) ? defaultValue : value;
  if (typeof value !== "string") return defaultValue;
  const cleaned = value.replace(/[$£€¥]/g, "").replace(/,/g, "").trim();
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
      maximumFractionDigits: dpPart ? decimals : 0,
    });
  }
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: useCommas,
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
    try { cb(newValue, oldValue, fieldId, state); }
    catch (err) { console.error(`[StateManager] listener error for ${fieldId}:`, err); }
  }
}

function muteListeners() { listenersActive = false; }
function unmuteListeners() { listenersActive = true; }

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
  parseNumeric,
  formatNumber,
};

if (typeof window !== "undefined") {
  window.BEAM = window.BEAM || {};
  window.BEAM.StateManager = StateManager;
  window.BEAM.parseNumeric = parseNumeric;
  window.BEAM.formatNumber = formatNumber;
}
