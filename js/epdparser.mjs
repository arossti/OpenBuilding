/**
 * EPD-Parser — P0 shell
 *
 * Reads an Environmental Product Declaration PDF and renders it to canvas.
 * No field extraction yet (lands in P1). Reuses pdf-loader + canvas-viewer
 * from the PDF-Parser app verbatim. Public namespace: window.EPD.
 */

import * as Loader from "./pdf-loader.mjs";
import * as Viewer from "./canvas-viewer.mjs";
import * as Store from "./shared/indexed-db-store.mjs";
import * as Extract from "./epd/extract.mjs";

var _state = {
  fileName: "",
  pageNum: 1,
  pageCount: 0,
  candidate: null, // { …schema-shape JSON…, populated by form edits }
  saveTimer: null
};

var EDITOR_KEY = "bfca.epd.editor";
var SAVE_DEBOUNCE_MS = 300;

/* ── Form schema config — representative subset of material.schema.json ─
   Each entry binds an input to a dotted schema path. P3 (regex auto-fill)
   populates the same paths from EPD text. Sections render as fieldsets. */

// Section order follows the §5.6 trunk-of-tree taxonomy: classify
// (Group → Type) before identifying (Manufacturer → Provenance) before
// measuring (Identification → Methodology → Physical → Impacts). The
// schema-path bindings on each input are unchanged from the prior order.
var FORM_SECTIONS = [
  {
    title: "1. Group + Type (classify)",
    fields: [
      {
        path: "classification.group_prefix",
        label: "Group",
        type: "select",
        options: [
          ["", "(select)"],
          ["03", "03 — Concrete"],
          ["04", "04 — Masonry"],
          ["05", "05 — Metals"],
          ["06", "06 — Wood"],
          ["07", "07 — Thermal / Insulation"],
          ["08", "08 — Openings"],
          ["09", "09 — Finishes"],
          ["31", "31 — Earthwork"]
        ]
      },
      { path: "classification.material_type", label: "Material type", type: "text" },
      { path: "naming.display_name", label: "Display name", type: "text" },
      { path: "naming.product_brand_name", label: "Product brand name", type: "text" }
    ]
  },
  {
    title: "2. Manufacturer (identify)",
    fields: [
      { path: "manufacturer.name", label: "Manufacturer name", type: "text" },
      { path: "manufacturer.country_code", label: "Country (ISO 3166-1 alpha-3)", type: "text", placeholder: "CAN" }
    ]
  },
  {
    title: "3. Provenance + scope",
    fields: [
      {
        path: "provenance.markets_of_applicability",
        label: "Markets (ISO codes, comma-separated)",
        type: "text",
        placeholder: "CAN, USA",
        asArray: true
      },
      {
        path: "status.visibility",
        label: "Visibility",
        type: "select",
        options: [
          ["public", "Public (default)"],
          ["hidden", "Hidden"],
          ["deprecated", "Deprecated"],
          ["flagged_for_deletion", "Flagged for deletion (soft-delete)"]
        ],
        default: "public"
      }
    ]
  },
  {
    title: "4. EPD identification",
    fields: [
      { path: "epd.id", label: "EPD identifier", type: "text", placeholder: "S-P-10278 or EPD-NIBE-…" },
      {
        path: "epd.program_operator",
        label: "Program operator",
        type: "select",
        options: [
          ["", "(select)"],
          ["UL Environment", "UL Environment"],
          ["ASTM International", "ASTM International"],
          ["CSA Group", "CSA Group"],
          ["NSF International", "NSF International"],
          ["EPD International AB", "EPD International AB"],
          ["IBU", "IBU (Institut Bauen und Umwelt)"],
          ["AWC & CWC", "AWC & CWC"],
          ["Other", "Other"]
        ]
      },
      {
        path: "epd.type",
        label: "EPD type",
        type: "select",
        options: [
          ["", "(select)"],
          ["product_specific", "Product-specific"],
          ["industry_average", "Industry average"],
          ["generic", "Generic"],
          ["beam_average", "BEAM average"]
        ]
      },
      { path: "epd.publication_date", label: "Publication date", type: "date" },
      { path: "epd.expiry_date", label: "Expiry date", type: "date" },
      { path: "epd.source_document_url", label: "Source URI (registry URL)", type: "url" },
      {
        path: "epd.validation.type",
        label: "Validation",
        type: "select",
        options: [
          ["", "(select)"],
          ["external", "External (third-party)"],
          ["internal", "Internal"]
        ]
      }
    ]
  },
  {
    title: "5. Methodology",
    fields: [
      { path: "methodology.pcr_guidelines", label: "PCR (sub-category / Part B)", type: "text" },
      {
        path: "methodology.standards",
        label: "Standards (comma-separated)",
        type: "text",
        placeholder: "ISO 14025, ISO 21930, EN 15804+A2",
        asArray: true
      },
      { path: "methodology.lca_software", label: "LCA software", type: "text" },
      { path: "methodology.lci_database", label: "LCI database", type: "text" }
    ]
  },
  {
    title: "6. Physical + impacts",
    fields: [
      { path: "physical.density.value_kg_m3", label: "Density (kg/m³)", type: "number", step: "0.01" },
      {
        path: "carbon.stated.per_unit",
        label: "Declared / functional unit",
        type: "text",
        placeholder: "1 m³ | 1 m² + thickness | 1 metric ton"
      },
      {
        path: "impacts.gwp_kgco2e.total.value",
        label: "GWP total (kg CO₂e per declared unit)",
        type: "number",
        step: "0.0001"
      }
    ]
  },
  {
    title: "7. Audit (auto-stamped on Capture)",
    fields: [{ path: "_audit.editor", label: "Editor (you)", type: "text", placeholder: "andy@bfca", persisted: true }]
  }
];

/* ── Init ─────────────────────────────────────────────── */

function init() {
  Viewer.init("viewer-container", "pdf-canvas", "overlay-canvas");
  // No overlay annotations in EPD-Parser; the draw callback stays unset (no-op).

  _renderForm();
  _bindFormChange();
  _bindCaptureButton();
  _bindFileInput();
  _bindDragDrop();
  _bindKeyboard();
  _updateStatus();

  // Prime the lookups for Tier 1 group inference (workplan §5.6). Falls
  // back gracefully if the staged data dir doesn't include the lookups
  // (e.g. running pre-stage:data) — extract() just leaves group_prefix
  // null in that case.
  _primeLookups().catch(function (err) {
    console.warn("[EPD-Parser] lookup prime skipped:", err.message);
  });
}

function _primeLookups() {
  return Promise.all([
    fetch("data/schema/lookups/material-type-to-group.json").then(function (r) {
      return r.ok ? r.json() : { map: {} };
    }),
    fetch("data/schema/lookups/display-name-keywords.json").then(function (r) {
      return r.ok ? r.json() : { patterns: [] };
    })
  ]).then(function (results) {
    Extract.setLookups({
      mtMap: (results[0] && results[0].map) || {},
      kwPatterns: (results[1] && results[1].patterns) || []
    });
  });
}

function _bindFileInput() {
  var input = document.getElementById("file-input");
  if (!input) return;
  input.addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (file) loadFile(file);
    e.target.value = ""; // allow re-selecting the same file
  });
}

function _bindDragDrop() {
  var dropZone = document.getElementById("drop-zone");
  if (!dropZone) return;

  ["dragenter", "dragover"].forEach(function (ev) {
    dropZone.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach(function (ev) {
    dropZone.addEventListener(ev, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("dragover");
    });
  });

  dropZone.addEventListener("drop", function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) loadFile(file);
  });
}

function _bindKeyboard() {
  document.addEventListener("keydown", function (e) {
    // Skip when focus is in a form field
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === "ArrowLeft") {
      prevPage();
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      nextPage();
      e.preventDefault();
    } else if (e.key === "f" || e.key === "F") {
      zoomFit();
      e.preventDefault();
    } else if (e.key === "+" || e.key === "=") {
      zoomIn();
      e.preventDefault();
    } else if (e.key === "-" || e.key === "_") {
      zoomOut();
      e.preventDefault();
    }
  });
}

/* ── File load ────────────────────────────────────────── */

function loadFile(file) {
  if (!file) return;
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    console.warn("EPD-Parser: not a PDF —", file.name);
    return;
  }
  _state.fileName = file.name;
  _showLoading("Reading " + file.name + "...");

  var reader = new FileReader();
  reader.onload = function (ev) {
    Loader.loadFromBuffer(ev.target.result)
      .then(function (info) {
        _state.pageCount = info.pageCount;
        _state.pageNum = 1;
        _hideDropZone();
        _showViewer();
        _showTextPanel();
        _showFormPane();
        return Viewer.showPage(1);
      })
      .then(function () {
        _hideLoading();
        return Viewer.zoomFit();
      })
      .then(function () {
        _updateStatus();
        // Restore any prior draft for this filename, OR seed a fresh candidate.
        return _loadDraftOrSeed(file.name);
      })
      .then(function () {
        return _loadPageText(_state.pageNum);
      })
      .catch(function (err) {
        console.error("EPD-Parser: PDF load failed —", err);
        _hideLoading();
      });
  };
  reader.onerror = function () {
    console.error("EPD-Parser: file read failed");
    _hideLoading();
  };
  reader.readAsArrayBuffer(file);
}

/* ── Page navigation ──────────────────────────────────── */

function prevPage() {
  if (!Loader.isLoaded() || _state.pageNum <= 1) return;
  _state.pageNum--;
  Viewer.showPage(_state.pageNum).then(function () {
    _updateStatus();
    _loadPageText(_state.pageNum);
  });
}

function nextPage() {
  if (!Loader.isLoaded() || _state.pageNum >= _state.pageCount) return;
  _state.pageNum++;
  Viewer.showPage(_state.pageNum).then(function () {
    _updateStatus();
    _loadPageText(_state.pageNum);
  });
}

/* ── P1: text extraction ──────────────────────────────── */

// Spatial-join the per-glyph or per-word text items into readable lines.
// Y-tolerance of 3pt groups items into rows; within each row, sort by X.
// Mirrors the consolidateTextItems pattern from PDF-Parser's dim-extract,
// since pdfjs v4 emits per-character items on some CAD/EPD PDFs.
function _itemsToLines(items) {
  if (!items || items.length === 0) return "";
  var sorted = items.slice().sort(function (a, b) {
    return a.y - b.y;
  });
  var lines = [];
  var currentLine = [];
  var currentY = null;
  for (var i = 0; i < sorted.length; i++) {
    var item = sorted[i];
    if (currentY === null || item.y - currentY > 3) {
      if (currentLine.length) lines.push(_flushLine(currentLine));
      currentLine = [item];
      currentY = item.y;
    } else {
      currentLine.push(item);
    }
  }
  if (currentLine.length) lines.push(_flushLine(currentLine));
  return lines.join("\n");
}

function _flushLine(line) {
  line.sort(function (a, b) {
    return a.x - b.x;
  });
  // Insert a single space between adjacent items unless the previous item
  // already ends in whitespace, to avoid double-spacing on already-tokenised PDFs.
  var out = "";
  for (var i = 0; i < line.length; i++) {
    var s = line[i].str;
    if (out.length && !/\s$/.test(out) && !/^\s/.test(s)) out += " ";
    out += s;
  }
  return out;
}

function _loadPageText(pageNum) {
  if (!Loader.isLoaded()) return Promise.resolve();
  return Loader.getTextContent(pageNum)
    .then(function (items) {
      var dump = document.getElementById("epd-text-dump");
      var stats = document.getElementById("epd-text-stats");
      if (dump) dump.textContent = _itemsToLines(items);
      if (stats) stats.textContent = "p" + pageNum + " · " + items.length + " items";
    })
    .catch(function (err) {
      console.error("EPD-Parser: text extraction failed —", err);
    });
}

/* ── Zoom (delegates to canvas-viewer) ────────────────── */

function zoomIn() {
  Viewer.zoomIn();
  _updateStatus();
}
function zoomOut() {
  Viewer.zoomOut();
  _updateStatus();
}
function zoomFit() {
  Viewer.zoomFit().then(_updateStatus);
}

/* ── UI helpers ───────────────────────────────────────── */

function _showLoading(label) {
  var overlay = document.getElementById("loading-overlay");
  var labelEl = document.getElementById("loading-label");
  if (overlay) overlay.style.display = "";
  if (labelEl && label) labelEl.textContent = label;
}

function _hideLoading() {
  var overlay = document.getElementById("loading-overlay");
  if (overlay) overlay.style.display = "none";
}

function _hideDropZone() {
  var dz = document.getElementById("drop-zone");
  if (dz) dz.style.display = "none";
}

function _showViewer() {
  var wrap = document.getElementById("viewer-wrap");
  if (wrap) wrap.style.display = "";
}

function _showTextPanel() {
  var emptyState = document.getElementById("epd-empty-state");
  var textPanel = document.getElementById("epd-text-panel");
  if (emptyState) emptyState.style.display = "none";
  if (textPanel) textPanel.style.display = "";
}

function _updateStatus() {
  var pageLabel = document.getElementById("page-label");
  var fileLabel = document.getElementById("file-label");
  var zoomLabel = document.getElementById("zoom-label");

  if (pageLabel) {
    pageLabel.textContent = _state.pageCount > 0 ? "Page " + _state.pageNum + " / " + _state.pageCount : "";
  }
  if (fileLabel) fileLabel.textContent = _state.fileName || "";
  if (zoomLabel) {
    var z = Viewer.getZoom ? Viewer.getZoom() : 1;
    zoomLabel.textContent = _state.pageCount > 0 ? "Zoom: " + Math.round(z * 100) + "%" : "";
  }
}

/* ── P2: Form pane (schema-driven), auto-save drafts, Capture ───── */

function _renderForm() {
  var form = document.getElementById("epd-form");
  if (!form) return;
  var savedEditor = (typeof localStorage !== "undefined" && localStorage.getItem(EDITOR_KEY)) || "";
  var html = "";
  for (var s = 0; s < FORM_SECTIONS.length; s++) {
    var sec = FORM_SECTIONS[s];
    html += '<fieldset class="epd-form-section"><legend>' + _escapeHtml(sec.title) + "</legend>";
    for (var f = 0; f < sec.fields.length; f++) {
      var fld = sec.fields[f];
      var inputId = "f-" + fld.path.replace(/[^a-z0-9]/gi, "-");
      var defaultVal = fld.path === "_audit.editor" ? savedEditor : fld.default || "";
      html += '<div class="epd-form-row">';
      html += '<label for="' + inputId + '">' + _escapeHtml(fld.label) + "</label>";
      if (fld.type === "select") {
        html += '<select id="' + inputId + '" data-path="' + fld.path + '">';
        for (var o = 0; o < fld.options.length; o++) {
          var opt = fld.options[o];
          var sel = opt[0] === defaultVal ? " selected" : "";
          html += '<option value="' + _escapeHtml(opt[0]) + '"' + sel + ">" + _escapeHtml(opt[1]) + "</option>";
        }
        html += "</select>";
      } else {
        var attrs = "";
        if (fld.placeholder) attrs += ' placeholder="' + _escapeHtml(fld.placeholder) + '"';
        if (fld.step) attrs += ' step="' + fld.step + '"';
        if (fld.asArray) attrs += ' data-as-array="1"';
        var v = defaultVal ? ' value="' + _escapeHtml(String(defaultVal)) + '"' : "";
        html += '<input type="' + fld.type + '" id="' + inputId + '" data-path="' + fld.path + '"' + attrs + v + " />";
      }
      html += "</div>";
    }
    html += "</fieldset>";
  }
  form.innerHTML = html;
}

function _escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Set a nested path on an object: ("a.b.c", obj, "x") → obj.a.b.c = "x" */
function _setPath(obj, path, value) {
  var parts = path.split(".");
  var ref = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    if (ref[parts[i]] == null || typeof ref[parts[i]] !== "object") ref[parts[i]] = {};
    ref = ref[parts[i]];
  }
  ref[parts[parts.length - 1]] = value;
}

function _getPath(obj, path) {
  var parts = path.split(".");
  var ref = obj;
  for (var i = 0; i < parts.length; i++) {
    if (ref == null) return undefined;
    ref = ref[parts[i]];
  }
  return ref;
}

function _bindFormChange() {
  var form = document.getElementById("epd-form");
  if (!form) return;
  form.addEventListener("input", function (ev) {
    var el = ev.target;
    if (!el.dataset || !el.dataset.path) return;
    var raw = el.value;
    var value;
    if (el.type === "number") value = raw === "" ? null : Number(raw);
    else if (el.dataset.asArray)
      value = raw
        .split(",")
        .map(function (s) {
          return s.trim();
        })
        .filter(Boolean);
    else value = raw === "" ? null : raw;

    // Persist editor identity so it survives across sessions
    if (el.dataset.path === "_audit.editor" && typeof localStorage !== "undefined") {
      localStorage.setItem(EDITOR_KEY, raw || "");
    }

    if (!_state.candidate) _state.candidate = {};
    _setPath(_state.candidate, el.dataset.path, value);
    _scheduleSave();
  });
}

function _scheduleSave() {
  if (_state.saveTimer) clearTimeout(_state.saveTimer);
  _state.saveTimer = setTimeout(function () {
    _state.saveTimer = null;
    _saveDraft();
  }, SAVE_DEBOUNCE_MS);
}

function _saveDraft() {
  if (!_state.fileName || !_state.candidate) return Promise.resolve();
  var editor = (typeof localStorage !== "undefined" && localStorage.getItem(EDITOR_KEY)) || "";
  var nowIso = new Date().toISOString();
  // Strip the synthetic _audit field out of the candidate before persisting —
  // it's a UI-only convenience, audit lives in audit_meta.
  var candidate = JSON.parse(JSON.stringify(_state.candidate));
  if (candidate._audit) delete candidate._audit;
  var record = {
    source: "epd-parser",
    source_file: _state.fileName,
    state: "draft",
    target_record_id: null,
    candidate_record: candidate,
    match_outcome: "new", // P3 will set this from the §6 match algorithm
    audit_meta: {
      editor: editor,
      last_edit_at: nowIso,
      action: "epd-parser-extract",
      source: _state.fileName
    }
  };
  return Store.putPending(record)
    .then(function () {
      _setFormStatus("Draft auto-saved · " + _shortTime(nowIso));
    })
    .catch(function (err) {
      console.error("EPD-Parser: draft save failed —", err);
      _setFormStatus("⚠ draft save failed — see console");
    });
}

function _bindCaptureButton() {
  var btn = document.getElementById("epd-capture-btn");
  if (!btn) return;
  btn.addEventListener("click", function () {
    if (!_state.fileName) return;
    btn.disabled = true;
    // Flush any pending debounced save first
    if (_state.saveTimer) {
      clearTimeout(_state.saveTimer);
      _state.saveTimer = null;
    }
    _saveDraft()
      .then(function () {
        return Store.getPending(_state.fileName);
      })
      .then(function (rec) {
        if (!rec) throw new Error("Capture failed: no draft found for " + _state.fileName);
        rec.state = "captured";
        rec.audit_meta = rec.audit_meta || {};
        rec.audit_meta.captured_at = new Date().toISOString();
        return Store.putPending(rec);
      })
      .then(function () {
        _setFormStatus("✓ Captured · ready for Trust / Trust + Verify in Database");
        var link = document.getElementById("epd-open-db-link");
        if (link) link.style.display = "";
        btn.disabled = false;
      })
      .catch(function (err) {
        console.error("EPD-Parser: capture failed —", err);
        _setFormStatus("⚠ capture failed — see console");
        btn.disabled = false;
      });
  });
}

function _loadDraftOrSeed(sourceFile) {
  return Store.getPending(sourceFile)
    .then(function (rec) {
      if (rec && rec.candidate_record) {
        // Existing draft — respect it. User edits always win over re-extraction.
        _state.candidate = rec.candidate_record;
        _populateFormFromCandidate(_state.candidate);
        var status =
          rec.state === "captured"
            ? "✓ Already captured · re-edits will revert to draft"
            : "Draft restored · auto-save active";
        _setFormStatus(status);
        if (rec.state === "captured") {
          var link = document.getElementById("epd-open-db-link");
          if (link) link.style.display = "";
        }
        return;
      }
      // Fresh — run P3 auto-extraction.
      return _runExtraction(sourceFile);
    })
    .catch(function (err) {
      console.warn("EPD-Parser: draft restore skipped —", err);
      _state.candidate = {};
    });
}

/* ── P3: regex auto-fill from PDF text ────────────────────────────── */

function _runExtraction(sourceFile) {
  _setFormStatus("Extracting fields from " + sourceFile + " …");
  var count = Loader.getPageCount();
  var promises = [];
  for (var i = 1; i <= count; i++) promises.push(Loader.getTextContent(i));
  return Promise.all(promises)
    .then(function (perPageItems) {
      var pageTexts = perPageItems.map(_itemsToLines);
      var result = Extract.extract(pageTexts);
      _state.candidate = result.record || {};
      _state.extractFormat = result.format;
      _populateFormFromCandidate(_state.candidate);
      _setFormStatus("Auto-filled " + result.anchorsHit + "/9 anchors · format: " + result.format + " · review + edit");
      return _saveDraft();
    })
    .catch(function (err) {
      console.error("EPD-Parser: extraction failed —", err);
      _setFormStatus("⚠ extraction failed — see console; manual entry still works");
      _state.candidate = {};
    });
}

function _populateFormFromCandidate(candidate) {
  var form = document.getElementById("epd-form");
  if (!form) return;
  var inputs = form.querySelectorAll("[data-path]");
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    var path = el.dataset.path;
    if (path === "_audit.editor") continue; // populated from localStorage
    var v = _getPath(candidate, path);
    if (v == null) {
      el.value = "";
    } else if (Array.isArray(v)) {
      el.value = v.join(", ");
    } else {
      el.value = String(v);
    }
  }
}

function _setFormStatus(text) {
  var el = document.getElementById("epd-form-status");
  if (el) el.textContent = text;
}

function _shortTime(iso) {
  // 2026-04-25T19:42:00Z → 19:42 UTC; keep it terse for the status line
  var m = /T(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : iso;
}

function _showFormPane() {
  var emptyState = document.getElementById("epd-empty-state");
  var form = document.getElementById("epd-form");
  var actions = document.getElementById("epd-form-actions");
  if (emptyState) emptyState.style.display = "none";
  if (form) form.style.display = "";
  if (actions) actions.style.display = "";
}

/* ── Public API (window.EPD.*) ────────────────────────── */

window.EPD = {
  loadFile: loadFile,
  prevPage: prevPage,
  nextPage: nextPage,
  zoomIn: zoomIn,
  zoomOut: zoomOut,
  zoomFit: zoomFit
};

/* ── Bootstrap ────────────────────────────────────────── */

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
