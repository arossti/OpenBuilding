/**
 * EPD-Parser — P0 shell
 *
 * Reads an Environmental Product Declaration PDF and renders it to canvas.
 * No field extraction yet (lands in P1). Reuses pdf-loader + canvas-viewer
 * from the PDF-Parser app verbatim. Public namespace: window.EPD.
 */

import * as Loader from "./pdf-loader.mjs";
import * as Viewer from "./canvas-viewer.mjs";

var _state = {
  fileName: "",
  pageNum: 1,
  pageCount: 0
};

/* ── Init ─────────────────────────────────────────────── */

function init() {
  Viewer.init("viewer-container", "pdf-canvas", "overlay-canvas");
  // No overlay annotations in EPD-Parser; the draw callback stays unset (no-op).

  _bindFileInput();
  _bindDragDrop();
  _bindKeyboard();
  _updateStatus();
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
        return Viewer.showPage(1);
      })
      .then(function () {
        _hideLoading();
        return Viewer.zoomFit();
      })
      .then(function () {
        _updateStatus();
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
