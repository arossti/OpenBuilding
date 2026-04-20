// file-handler.mjs
// Orchestrates import/export for BEAMweb. Supports three file types:
//   - .json  native BEAMweb project save (round-trip)
//   - .xlsx  one-way import from user's BEAM workbook export
//   - .csv   one-way import from BEAM CSV export OR native BEAMweb CSV export
//
// Port reference: OBJECTIVE FileHandler.js (≈900 lines → condensed).
// Key pattern retained: IMPORT QUARANTINE — mute state listeners while
// setting values so cascading calculations don't run on half-loaded state,
// then unmute + trigger one calculateAll() at the end.
//
// Phase 1 stub — wiring and quarantine pattern in place; mapper + calculator
// hooks are placeholders. Fills out as calc modules land in Phase 3+.

import { StateManager } from "./state-manager.mjs";

let mapper = null;
let calculator = null;

function bind({ workbookMapper, calculatorRef } = {}) {
  mapper = workbookMapper || null;
  calculator = calculatorRef || null;
}

function wireButtons({ importBtnId, exportBtnId, fileInputId } = {}) {
  const importBtn = importBtnId && document.getElementById(importBtnId);
  const exportBtn = exportBtnId && document.getElementById(exportBtnId);
  const fileInput = fileInputId && document.getElementById(fileInputId);

  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => {
      fileInput.value = null;
      fileInput.click();
    });
    fileInput.addEventListener("change", handleFileSelect);
  }
  if (exportBtn) {
    exportBtn.addEventListener("click", (e) => {
      e.preventDefault();
      exportJson();
    });
  }
}

async function handleFileSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  const buffer = await file.arrayBuffer();

  try {
    if (ext === "json") {
      const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
      importJson(JSON.parse(text));
    } else if (ext === "csv") {
      const text = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
      importCsv(text);
    } else if (ext === "xlsx" || ext === "xls") {
      if (typeof XLSX === "undefined") throw new Error("SheetJS (xlsx) not loaded");
      const wb = XLSX.read(new Uint8Array(buffer), { type: "array" });
      importWorkbook(wb);
    } else {
      throw new Error(`Unsupported file type: .${ext}`);
    }
  } catch (err) {
    console.error("[FileHandler] import failed:", err);
    showStatus(`Import failed: ${err.message}`, "error");
  }
  event.target.value = null;
}

function withQuarantine(fn) {
  StateManager.muteListeners();
  try {
    fn();
  } finally {
    StateManager.unmuteListeners();
  }
  if (calculator?.calculateAll) calculator.calculateAll();
}

function importJson(data) {
  if (!data || typeof data !== "object") throw new Error("invalid JSON structure");
  withQuarantine(() => {
    for (const [fieldId, value] of Object.entries(data.fields || data)) {
      StateManager.setValue(fieldId, value, StateManager.VALUE_STATES.IMPORTED);
    }
  });
  showStatus(`Imported ${Object.keys(data.fields || data).length} fields from JSON`, "success");
}

function importCsv(csvText) {
  const rows = csvText.split(/\r?\n/).filter((r) => r.trim() !== "");
  if (rows.length < 2) throw new Error("CSV needs header + at least one data row");
  const headers = parseCsvRow(rows[0]).map((h) => h.split(":")[0].trim());
  const values = parseCsvRow(rows[1]);
  if (headers.length !== values.length) {
    throw new Error(`header/value count mismatch (${headers.length} vs ${values.length})`);
  }
  withQuarantine(() => {
    for (let i = 0; i < headers.length; i++) {
      if (headers[i]) StateManager.setValue(headers[i], values[i], StateManager.VALUE_STATES.IMPORTED);
    }
  });
  showStatus(`Imported ${headers.length} fields from CSV`, "success");
}

function importWorkbook(workbook) {
  if (!mapper?.mapWorkbookToState) {
    throw new Error("workbook mapper not bound — call bind({ workbookMapper }) first");
  }
  const mapped = mapper.mapWorkbookToState(workbook);
  if (!mapped || Object.keys(mapped).length === 0) {
    showStatus("workbook contained no mappable data", "warning");
    return;
  }
  withQuarantine(() => {
    for (const [fieldId, value] of Object.entries(mapped)) {
      StateManager.setValue(fieldId, value, StateManager.VALUE_STATES.IMPORTED);
    }
  });
  showStatus(`Imported ${Object.keys(mapped).length} fields from workbook`, "success");
}

function parseCsvRow(row) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function exportJson() {
  const state = StateManager.exportState();
  const payload = {
    format: "beamweb-project",
    version: 1,
    exportedAt: new Date().toISOString(),
    fields: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const name = sanitize(state.project_name || "BEAMweb-project") + ".json";
  triggerDownload(blob, name);
  showStatus("Project exported as JSON", "success");
}

function exportCsv(fieldIds) {
  if (!Array.isArray(fieldIds) || fieldIds.length === 0) {
    throw new Error("exportCsv requires explicit fieldIds list");
  }
  const headers = fieldIds.map(escapeCsv).join(",");
  const values = fieldIds
    .map((id) => {
      const v = StateManager.getValue(id);
      return escapeCsv(v ?? "");
    })
    .join(",");
  const blob = new Blob([headers + "\n" + values + "\n"], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, "BEAMweb-export.csv");
}

function escapeCsv(v) {
  let s = String(v ?? "");
  if (/^-?[\d,]+\.?\d*$/.test(s)) s = s.replace(/,/g, "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sanitize(name) {
  return String(name).replace(/[^a-z0-9_\-.]/gi, "_");
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function showStatus(message, type = "info") {
  const area = document.getElementById("feedback-area");
  if (!area) {
    console.log(`[FileHandler] ${message}`);
    return;
  }
  const colors = { info: "#0dcaf0", success: "#198754", warning: "#ffc107", error: "#dc3545" };
  area.textContent = message;
  area.style.color = colors[type] || colors.info;
  if (type === "info" || type === "success") {
    setTimeout(() => {
      if (area.textContent === message) area.textContent = "";
    }, 5000);
  }
}

export const FileHandler = {
  bind,
  wireButtons,
  importJson,
  importCsv,
  importWorkbook,
  exportJson,
  exportCsv,
  showStatus
};

if (typeof window !== "undefined") {
  window.BEAM = window.BEAM || {};
  window.BEAM.FileHandler = FileHandler;
}
