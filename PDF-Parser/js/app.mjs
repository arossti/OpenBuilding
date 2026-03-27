/**
 * PDF-Parser — Application Controller
 * Main entry point. Wires all modules together.
 */

import { VERSION, SNAP_RADIUS_PX, METRIC_SCALES, IMPERIAL_SCALES } from "./config.mjs";
import * as Loader from "./pdf-loader.mjs";
import * as SheetClassifier from "./sheet-classifier.mjs";
import * as ScaleManager from "./scale-manager.mjs";
import * as Viewer from "./canvas-viewer.mjs";
import * as PolygonTool from "./polygon-tool.mjs";
import * as VectorSnap from "./vector-snap.mjs";
import * as ScheduleParser from "./schedule-parser.mjs";
import * as ProjectStore from "./project-store.mjs";

/* ── DOM refs ─────────────────────────────────────────── */

var els = {};
var _currentPage = 0;
var _currentTool = "navigate";
var _calibPoint1 = null;

/* ── Boot ─────────────────────────────────────────────── */

function init() {
  console.log("[PDF-Parser] Booting v" + VERSION);

  els.fileInput    = document.getElementById("file-input");
  els.dropZone     = document.getElementById("drop-zone");
  els.viewerWrap   = document.getElementById("viewer-wrap");
  els.thumbStrip   = document.getElementById("thumb-strip");
  els.sheetInfo    = document.getElementById("sheet-info");
  els.measurePanel = document.getElementById("measure-panel");
  els.statusBar    = document.getElementById("status-bar");
  els.zoomLabel    = document.getElementById("zoom-label");
  els.scaleLabel   = document.getElementById("scale-label");
  els.pageLabel    = document.getElementById("page-label");
  els.toolBtns     = document.querySelectorAll(".tool-btn");

  Viewer.init("viewer-container", "pdf-canvas", "overlay-canvas");
  Viewer.setDrawCallback(function(ctx, pageNum) { PolygonTool.draw(ctx, pageNum); });
  Viewer.onOverlayClick(_handleOverlayClick);
  Viewer.onOverlayMouseMove(_handleOverlayMouseMove);

  _bindFileInput();
  _bindToolbar();
  _bindKeyboard();

  setStatus("Ready — drop a PDF or click Browse", "ready");
  console.log("[PDF-Parser] Ready");
}

/* ── File loading ─────────────────────────────────────── */

function _bindFileInput() {
  els.fileInput.addEventListener("change", function(e) {
    if (e.target.files.length > 0) _loadFile(e.target.files[0]);
  });
  els.dropZone.addEventListener("dragover", function(e) {
    e.preventDefault(); els.dropZone.classList.add("drag-over");
  });
  els.dropZone.addEventListener("dragleave", function() {
    els.dropZone.classList.remove("drag-over");
  });
  els.dropZone.addEventListener("drop", function(e) {
    e.preventDefault(); els.dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0) _loadFile(e.dataTransfer.files[0]);
  });
}

function _loadFile(file) {
  if (file.type !== "application/pdf") {
    setStatus("Error: not a PDF file", "error"); return;
  }
  setStatus("Loading " + file.name + "...", "busy");
  var reader = new FileReader();
  reader.onload = function(e) { loadPdf(e.target.result, file.name); };
  reader.readAsArrayBuffer(file);
}

function loadPdf(buffer, fileName) {
  console.log("[PDF-Parser] Loading:", fileName, "(" + (buffer.byteLength / 1048576).toFixed(1) + " MB)");

  Loader.reset(); PolygonTool.reset(); ScaleManager.reset(); VectorSnap.reset(); ProjectStore.reset();

  var loadingOverlay = document.getElementById("loading-overlay");
  var loadingBar     = document.getElementById("loading-bar-fill");
  var loadingLabel   = document.getElementById("loading-label");

  Loader.loadFromBuffer(buffer).then(function(result) {
    console.log("[PDF-Parser] Loaded:", result.pageCount, "pages");
    ProjectStore.initFromPdf(fileName, result.pageCount);

    // Show loading overlay, hide drop zone
    els.dropZone.style.display = "none";
    loadingOverlay.style.display = "";

    var total = result.pageCount;

    // Build thumbnail placeholders
    _buildThumbnailPlaceholders(total);

    // Render thumbnails one by one with progress bar
    function renderNext(p) {
      if (p > total) {
        // All done — classify sheets, then show first page
        loadingLabel.textContent = "Classifying sheets...";
        loadingBar.style.width = "100%";

        return SheetClassifier.classifyAll().then(function(results) {
          ProjectStore.setClassifications(results);
          _updateThumbnailLabels(results);

          var planCount = 0;
          for (var i = 0; i < results.length; i++) {
            if (results[i].scale && results[i].scale.ratio) {
              ScaleManager.setPending(results[i].pageNum, results[i].scale.ratio, results[i].scale.raw);
            }
            if (results[i].classification === "plan") planCount++;
          }

          // Hide loading, show viewer
          loadingOverlay.style.display = "none";
          els.viewerWrap.style.display = "";

          setStatus("Found " + planCount + " plan sheets. Press S to confirm scale.", "ready");
          goToPage(1);

          // Background: find room schedule
          ScheduleParser.findRoomScheduleInDocument().then(function(schedData) {
            if (schedData) {
              ProjectStore.setRoomSchedule(schedData.rooms);
              console.log("[PDF-Parser] Room schedule on page", schedData.pageNum, "—", schedData.rooms.length, "rooms");
            }
          });
        });
      }

      // Update progress
      var pct = Math.round((p / total) * 100);
      loadingBar.style.width = pct + "%";
      loadingLabel.textContent = "Reading page " + p + " / " + total;

      var canvas = els.thumbStrip.querySelectorAll(".thumb-canvas")[p - 1];
      return Loader.renderThumbnail(p, canvas, 120).then(function() {
        return renderNext(p + 1);
      });
    }

    return renderNext(1);
  }).catch(function(err) {
    setStatus("Error loading PDF: " + err.message, "error");
    loadingOverlay.style.display = "none";
    console.error(err);
  });
}

/* ── Navigation ───────────────────────────────────────── */

function goToPage(pageNum) {
  var pageCount = Loader.getPageCount();
  if (pageNum < 1 || pageNum > pageCount) return;
  _currentPage = pageNum;

  Viewer.showPage(pageNum).then(function(result) {
    if (!result) return;
    // Fit page to viewport on navigation
    Viewer.zoomFit();
    _highlightThumb(pageNum);
    els.pageLabel.textContent = "Page " + pageNum + " / " + pageCount;
    els.zoomLabel.textContent = Math.round(Viewer.getZoom() * 100) + "%";

    var pageData = ProjectStore.getPage(pageNum);
    _updateSheetInfo(pageData);
    _updateScaleLabel();
    _updateMeasurements(PolygonTool.getAllMeasurements(pageNum));

    VectorSnap.extractGeometry(pageNum);
  });
}

function nextPage() { goToPage(_currentPage + 1); }
function prevPage() { goToPage(_currentPage - 1); }

/* ── Overlay click handling ───────────────────────────── */

/* ── Scale Confirmation Panel ─────────────────────────── */

var _scaleSystem = "metric";   // "metric" or "imperial"
var _pendingRatio = null;      // ratio selected in the Check Scale panel

function openScalePanel() {
  if (!Loader.isLoaded()) return;
  var cal = ScaleManager.getCalibration(_currentPage);
  var detectedRatio = cal ? cal.ratio : null;
  var detectedLabel = cal ? cal.ratioLabel : null;

  // Show detection info
  var detEl = document.getElementById("scale-detected");
  if (detectedRatio) {
    detEl.innerHTML = "Detected: <strong>" + (detectedLabel || "1:" + detectedRatio) + "</strong> (from title block text)";
  } else {
    detEl.innerHTML = "No scale detected on this page.";
  }

  // Populate dropdown with current system
  _populateScaleDropdown(detectedRatio);

  // Show panel
  document.getElementById("scale-backdrop").classList.add("visible");
  document.getElementById("scale-panel").classList.add("visible");
}

function closeScalePanel() {
  document.getElementById("scale-backdrop").classList.remove("visible");
  document.getElementById("scale-panel").classList.remove("visible");
}

function setScaleSystem(system) {
  _scaleSystem = system;
  document.getElementById("scale-toggle-metric").classList.toggle("active", system === "metric");
  document.getElementById("scale-toggle-imperial").classList.toggle("active", system === "imperial");

  var cal = ScaleManager.getCalibration(_currentPage);
  _populateScaleDropdown(cal ? cal.ratio : null);
}

function _populateScaleDropdown(preselect) {
  var sel = document.getElementById("scale-select");
  var scales = _scaleSystem === "metric" ? METRIC_SCALES : IMPERIAL_SCALES;
  sel.innerHTML = '<option value="">— Select scale —</option>';
  for (var i = 0; i < scales.length; i++) {
    var opt = document.createElement("option");
    opt.value = scales[i].ratio;
    opt.textContent = scales[i].label;
    if (preselect && scales[i].ratio === preselect) opt.selected = true;
    sel.appendChild(opt);
  }
}

/** Accept scale provisionally — enables area math immediately. */
function acceptScale() {
  var sel = document.getElementById("scale-select");
  var ratio = parseInt(sel.value, 10);
  if (!ratio) {
    setStatus("Please select a scale from the dropdown", "error");
    return;
  }
  ScaleManager.accept(_currentPage, ratio);
  ProjectStore.saveCalibration(_currentPage, ScaleManager.getCalibration(_currentPage));
  closeScalePanel();

  _updateSheetInfo(ProjectStore.getPage(_currentPage));
  _updateScaleLabel();
  _refreshMeasurements();
  Viewer.requestRedraw();

  setStatus("Scale 1:" + ratio + " accepted. You can now measure. Press C to verify with calibration.", "ready");
}

/** Accept + immediately enter calibration mode for empirical verification. */
function verifyScale() {
  var sel = document.getElementById("scale-select");
  var ratio = parseInt(sel.value, 10);
  if (!ratio) {
    setStatus("Please select a scale from the dropdown", "error");
    return;
  }
  _pendingRatio = ratio;
  closeScalePanel();

  setTool("calibrate");
  setStatus("Click two endpoints of a known dimension to verify 1:" + ratio, "busy");
}

/* ── Overlay click handling ───────────────────────────── */

function _handleOverlayClick(e) {
  var pt = Viewer.eventToPdfCoords(e);

  // Check if clicking near an existing vertex — start drag regardless of tool
  var hitRadius = 10 / (Viewer.getZoom() * (150 / 72));  // ~10 screen pixels → PDF units
  var hit = PolygonTool.hitTestVertex(_currentPage, pt, hitRadius);
  if (hit && !PolygonTool.isDrawing()) {
    PolygonTool.startDrag(_currentPage, hit.polyIdx, hit.vertIdx);
    Viewer.onOverlayMouseMove(_handleDragMove);
    _bindDragEnd();
    var wrap = document.getElementById("viewer-wrap");
    if (wrap) wrap.style.cursor = "move";
    return;
  }

  var snap = VectorSnap.findNearestEndpoint(_currentPage, pt, SNAP_RADIUS_PX);
  if (snap) pt = { x: snap.x, y: snap.y };

  if (_currentTool === "measure") _handleMeasureClick(pt);
  else if (_currentTool === "calibrate") _handleCalibrateClick(pt);
}

function _handleDragMove(e) {
  if (!PolygonTool.isDragging()) return;
  var pt = Viewer.eventToPdfCoords(e);
  PolygonTool.moveDrag(pt);
  Viewer.requestRedraw();
}

function _bindDragEnd() {
  function onUp() {
    window.removeEventListener("mouseup", onUp);
    if (PolygonTool.isDragging()) {
      PolygonTool.endDrag();
      // Restore normal mousemove handler
      Viewer.onOverlayMouseMove(_handleOverlayMouseMove);
      var wrap = document.getElementById("viewer-wrap");
      var cursorMap = { measure: "crosshair", calibrate: "crosshair", navigate: "default" };
      if (wrap) wrap.style.cursor = cursorMap[_currentTool] || "default";
      // Update measurements and save
      _refreshMeasurements();
      ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
      Viewer.requestRedraw();
    }
  }
  window.addEventListener("mouseup", onUp);
}

function _handleMeasureClick(pt) {
  // Warn if no confirmed scale
  if (!ScaleManager.isCalibrated(_currentPage) && !PolygonTool.isDrawing()) {
    setStatus("No confirmed scale. Press S to set scale first, or measurements will be uncalibrated.", "error");
  }

  if (!PolygonTool.isDrawing()) {
    PolygonTool.startPolygon(_currentPage);
    PolygonTool.addVertex(pt);
  } else {
    if (PolygonTool.isNearFirstVertex(pt, 12)) {
      PolygonTool.closePolygon();
      setStatus("Polygon closed" + (ScaleManager.isCalibrated(_currentPage) ? "" : " (uncalibrated)"), "ready");
      _refreshMeasurements();
      ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
    } else {
      PolygonTool.addVertex(pt);
    }
  }
  Viewer.requestRedraw();
}

function _handleCalibrateClick(pt) {
  if (!_calibPoint1) {
    _calibPoint1 = pt;
    setStatus("Click second point of the dimension...", "busy");
  } else {
    // Ask for the real-world distance
    var hint = _pendingRatio ? " (at 1:" + _pendingRatio + ")" : "";
    var input = prompt("Enter the real-world distance between the two points" + hint + "\n\nExamples: '10.5 m', '35 ft', '8500 mm', '39-1 ft'");
    if (input) {
      var parsed = _parseDistanceInput(input);
      if (parsed) {
        var meta = _pendingRatio ? { ratio: _pendingRatio, source: "check-scale", raw: "1:" + _pendingRatio } : { source: "manual" };
        ScaleManager.calibrate(_currentPage, _calibPoint1, pt, parsed.value, parsed.unit, meta);

        var badgeText = _pendingRatio ? "1:" + _pendingRatio : "calibrated";
        setStatus("Scale verified: " + badgeText + " (" + parsed.value + " " + parsed.unit + ")", "ready");

        // Persist calibration to project store
        ProjectStore.saveCalibration(_currentPage, ScaleManager.getCalibration(_currentPage));

        // Update sheet info with confirmed badge
        _updateSheetInfo(ProjectStore.getPage(_currentPage));
        _updateScaleLabel();

        // Re-calculate any existing measurements on this page
        _refreshMeasurements();
        Viewer.requestRedraw();
      } else {
        setStatus("Could not parse. Use: '10.5 m', '35 ft', '8500 mm'", "error");
      }
    }
    _calibPoint1 = null;
    _pendingRatio = null;
    setTool("navigate");
  }
}

function _parseDistanceInput(str) {
  str = str.trim();

  // ── Feet-inches patterns (return decimal feet) ──

  // "19'-6 1/2"" or "19'-6 1/2" or "19-6 1/2" — feet, inches, fraction
  var m = str.match(/^(\d+)[''\-]\s*(\d+)\s+(\d+)\/(\d+)\s*[""']?\s*(?:ft|feet)?$/i);
  if (m) return { value: parseInt(m[1]) + (parseInt(m[2]) + parseInt(m[3]) / parseInt(m[4])) / 12, unit: "ft" };

  // "19'-6.5"" or "19-6.5" — feet, decimal inches
  m = str.match(/^(\d+)[''\-]\s*(\d+(?:\.\d+)?)\s*[""']?\s*(?:ft|feet)?$/i);
  if (m) return { value: parseInt(m[1]) + parseFloat(m[2]) / 12, unit: "ft" };

  // "19 6 1/2" — feet inches fraction (space separated)
  m = str.match(/^(\d+)\s+(\d+)\s+(\d+)\/(\d+)\s*(?:ft|feet)?$/i);
  if (m) return { value: parseInt(m[1]) + (parseInt(m[2]) + parseInt(m[3]) / parseInt(m[4])) / 12, unit: "ft" };

  // "19 6.5" — feet decimal-inches (space separated, no unit)
  m = str.match(/^(\d+)\s+(\d+(?:\.\d+)?)\s*(?:ft|feet)?$/i);
  if (m && parseFloat(m[2]) < 12) return { value: parseInt(m[1]) + parseFloat(m[2]) / 12, unit: "ft" };

  // ── Simple number + unit ──

  // "19.55'" or "19.55 ft" or "19.55ft" — decimal feet
  m = str.match(/^([\d.]+)\s*['']?\s*(ft|feet)\s*$/i);
  if (m) return { value: parseFloat(m[1]), unit: "ft" };

  // "19.55'" — just an apostrophe means feet
  m = str.match(/^([\d.]+)\s*['']\s*$/);
  if (m) return { value: parseFloat(m[1]), unit: "ft" };

  // "6.5"" or '6.5"' — just a quote means inches
  m = str.match(/^([\d.]+)\s*[""]?\s*(in|inches|")\s*$/i);
  if (m) return { value: parseFloat(m[1]), unit: "in" };

  // "10.5 m" or "8500 mm" or "35 ft" — number + explicit unit
  m = str.match(/^([\d.]+)\s*(m|mm|ft|feet|in|inches|metres|meters)\s*$/i);
  if (m) {
    var unitMap = { m: "m", mm: "mm", ft: "ft", feet: "ft", "in": "in", inches: "in", metres: "m", meters: "m" };
    return { value: parseFloat(m[1]), unit: unitMap[m[2].toLowerCase()] || "m" };
  }

  // "19.55" — bare number, no unit. Assume the unit system from the scale panel toggle.
  m = str.match(/^([\d.]+)$/);
  if (m) {
    // If value > 100, likely mm. If < 100, likely metres or feet.
    var val = parseFloat(m[1]);
    var guessUnit = _scaleSystem === "imperial" ? "ft" : (val > 100 ? "mm" : "m");
    return { value: val, unit: guessUnit };
  }

  return null;
}

function _handleOverlayMouseMove(e) {
  // Show move cursor when hovering near a draggable vertex
  var pt = Viewer.eventToPdfCoords(e);
  var hitRadius = 10 / (Viewer.getZoom() * (150 / 72));
  var hit = PolygonTool.hitTestVertex(_currentPage, pt, hitRadius);
  var wrap = document.getElementById("viewer-wrap");
  if (hit && !PolygonTool.isDrawing()) {
    if (wrap) wrap.style.cursor = "move";
  } else {
    var cursorMap = { measure: "crosshair", calibrate: "crosshair", navigate: "default" };
    if (wrap) wrap.style.cursor = cursorMap[_currentTool] || "default";
  }
}

/* ── Toolbar ──────────────────────────────────────────── */

function _bindToolbar() {
  for (var i = 0; i < els.toolBtns.length; i++) {
    els.toolBtns[i].addEventListener("click", function() {
      setTool(this.dataset.tool);
    });
  }
}

function setTool(tool) {
  _currentTool = tool;
  for (var i = 0; i < els.toolBtns.length; i++) {
    els.toolBtns[i].classList.toggle("active", els.toolBtns[i].dataset.tool === tool);
  }
  var viewer = document.getElementById("viewer-container");
  var cursorMap = { measure: "crosshair", calibrate: "crosshair", navigate: "default" };
  var wrap = document.getElementById("viewer-wrap");
  if (wrap) wrap.style.cursor = cursorMap[tool] || "default";
}

/* ── Keyboard ─────────────────────────────────────────── */

function _bindKeyboard() {
  document.addEventListener("keydown", function(e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    // Undo: Cmd+Z / Ctrl+Z
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      var pg = PolygonTool.undo();
      if (pg !== false) {
        _refreshMeasurements();
        Viewer.requestRedraw();
        setStatus("Undo", "ready");
      }
      return;
    }
    // Redo: Cmd+Shift+Z / Ctrl+Shift+Z
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      var pg2 = PolygonTool.redo();
      if (pg2 !== false) {
        _refreshMeasurements();
        Viewer.requestRedraw();
        setStatus("Redo", "ready");
      }
      return;
    }

    switch (e.key) {
      case "Escape":
        if (PolygonTool.isDrawing()) {
          // Cancel in-progress polygon — delete it
          PolygonTool.deleteLastPolygon(_currentPage);
          Viewer.requestRedraw();
          setStatus("Polygon cancelled", "ready");
        }
        setTool("navigate"); break;
      case "Delete": case "Backspace":
        // Delete last polygon on current page
        if (!PolygonTool.isDrawing()) {
          PolygonTool.deleteLastPolygon(_currentPage);
          _refreshMeasurements();
          Viewer.requestRedraw();
          setStatus("Polygon deleted", "ready");
        }
        break;
      case "s": openScalePanel(); break;
      case "m": setTool("measure"); break;
      case "c": setTool("calibrate"); break;
      case "v": setTool("navigate"); break;
      case "f": Viewer.zoomFit(); break;
      case "ArrowRight": case "PageDown": e.preventDefault(); nextPage(); break;
      case "ArrowLeft":  case "PageUp":   e.preventDefault(); prevPage(); break;
      case "+": case "=": Viewer.zoomIn(); break;
      case "-": Viewer.zoomOut(); break;
    }
  });
}

/* ── Thumbnails ───────────────────────────────────────── */

function _buildThumbnailPlaceholders(pageCount) {
  els.thumbStrip.innerHTML = "";
  for (var p = 1; p <= pageCount; p++) {
    var wrapper = document.createElement("div");
    wrapper.className = "thumb-wrapper";
    wrapper.dataset.page = p;
    var canvas = document.createElement("canvas");
    canvas.className = "thumb-canvas";
    canvas.width = 120;
    canvas.height = 85;
    var label = document.createElement("span");
    label.className = "thumb-label";
    label.textContent = "Page " + p;
    wrapper.appendChild(canvas);
    wrapper.appendChild(label);
    els.thumbStrip.appendChild(wrapper);
    wrapper.addEventListener("click", function() {
      goToPage(parseInt(this.dataset.page, 10));
    });
  }
}

function _updateThumbnailLabels(classResults) {
  var wrappers = els.thumbStrip.querySelectorAll(".thumb-wrapper");
  for (var i = 0; i < classResults.length; i++) {
    var cr = classResults[i];
    if (wrappers[cr.pageNum - 1]) {
      var lbl = wrappers[cr.pageNum - 1].querySelector(".thumb-label");
      lbl.textContent = cr.sheetId || ("Page " + cr.pageNum);
      lbl.title = cr.sheetTitle || "";
    }
  }
}

function _highlightThumb(pageNum) {
  var wrappers = els.thumbStrip.querySelectorAll(".thumb-wrapper");
  for (var i = 0; i < wrappers.length; i++) {
    wrappers[i].classList.toggle("active", parseInt(wrappers[i].dataset.page, 10) === pageNum);
  }
}

/* ── Info panels ──────────────────────────────────────── */

function _updateSheetInfo(pageData) {
  if (!pageData) { els.sheetInfo.innerHTML = ""; return; }
  var html = "<strong>" + (pageData.sheetId || "\u2014") + "</strong>";
  html += " <span class='sheet-class tag-" + pageData.classification + "'>" + pageData.classification + "</span>";
  if (pageData.sheetTitle) html += "<br>" + pageData.sheetTitle;

  // Scale badge — three states
  var pageNum = pageData.pageNum;
  var scaleState = ScaleManager.getState(pageNum);
  var ratioLabel = ScaleManager.getRatioLabel(pageNum) || "";

  if (scaleState === "verified") {
    html += "<br><span class='scale-badge scale-verified'>" + ratioLabel + " \u2713</span>";
  } else if (scaleState === "accepted") {
    html += "<br><span class='scale-badge scale-accepted'>" + ratioLabel + " \u2713</span>";
    html += " <span style='font-size:10px;color:var(--text-dim);'>C to verify</span>";
  } else if (scaleState === "pending") {
    html += "<br><span class='scale-badge scale-pending'>" + ratioLabel + " ?</span>";
    html += " <span style='font-size:10px;color:var(--text-dim);'>Press S</span>";
  } else {
    html += "<br><span class='scale-badge scale-none'>No scale</span>";
  }

  // Legacy: show raw detection if present
  if (pageData.scale) {
  }
  els.sheetInfo.innerHTML = html;
}

function _updateScaleLabel() {
  var state = ScaleManager.getState(_currentPage);
  var label = ScaleManager.getRatioLabel(_currentPage) || "";

  if (state === "verified") {
    els.scaleLabel.textContent = label + " \u2713 verified";
    els.scaleLabel.style.color = "var(--accent-lit)";
  } else if (state === "accepted") {
    els.scaleLabel.textContent = label + " \u2713";
    els.scaleLabel.style.color = "#e9c46a";
  } else if (state === "pending") {
    els.scaleLabel.textContent = label + " ?";
    els.scaleLabel.style.color = "#888";
  } else {
    els.scaleLabel.textContent = "No scale";
    els.scaleLabel.style.color = "";
  }
}

function _refreshMeasurements() {
  _updateMeasurements(PolygonTool.getAllMeasurements(_currentPage));
}

function _updateMeasurements(measurements) {
  if (!measurements || measurements.length === 0) {
    els.measurePanel.innerHTML = "<p class='empty'>No measurements on this page.<br><span style='font-size:10px;color:var(--text-dim);'>Press <b>M</b> then click to trace an area.</span></p>";
    return;
  }

  var hasScale = measurements[0].calibrated;
  var html = "<div class='measure-header'>Measurements — this page</div>";
  html += "<table><thead><tr><th>Label</th>";
  if (hasScale) {
    html += "<th>m\u00B2</th><th>ft\u00B2</th>";
  } else {
    html += "<th colspan='2' style='color:var(--gold);font-size:10px;'>No scale — press C to calibrate</th>";
  }
  html += "</tr></thead><tbody>";

  var totalM2 = 0, totalFt2 = 0;

  for (var i = 0; i < measurements.length; i++) {
    var m = measurements[i];
    html += "<tr><td>" + m.label + "</td>";
    if (hasScale && m.areaM2 !== null) {
      html += "<td class='num'>" + m.areaM2.toFixed(2) + "</td>";
      html += "<td class='num'>" + m.areaFt2.toFixed(2) + "</td>";
      totalM2 += m.areaM2;
      totalFt2 += m.areaFt2;
    } else {
      html += "<td class='num' colspan='2'>\u2014</td>";
    }
    html += "</tr>";
  }

  // Running total
  if (hasScale && measurements.length > 1) {
    html += "<tr class='total-row'><td><strong>Total</strong></td>";
    html += "<td class='num'><strong>" + totalM2.toFixed(2) + "</strong></td>";
    html += "<td class='num'><strong>" + totalFt2.toFixed(2) + "</strong></td></tr>";
  }

  html += "</tbody></table>";

  // Undo hint
  html += "<div class='measure-hint'>";
  html += "<span class='key-hint'>\u2318Z</span> Undo &nbsp;";
  html += "<span class='key-hint'>Del</span> Delete last &nbsp;";
  html += "<span class='key-hint'>Esc</span> Cancel";
  html += "</div>";

  els.measurePanel.innerHTML = html;
}

/* ── Status bar ───────────────────────────────────────── */

function setStatus(msg, type) {
  els.statusBar.textContent = msg;
  els.statusBar.className = "status-bar" + (type ? " status-" + type : "");
}

/* ── Export ────────────────────────────────────────────── */

function exportCSV() {
  ProjectStore.download(ProjectStore.measurementsToCSV(), "pdf-parser-measurements.csv", "text/csv");
}

function exportJSON() {
  ProjectStore.download(ProjectStore.toJSON(), "pdf-parser-project.json", "application/json");
}

/* ── Public API (exposed to HTML onclick handlers) ────── */

window.PP = {
  goToPage: goToPage, nextPage: nextPage, prevPage: prevPage,
  zoomIn: function() { Viewer.zoomIn(); }, zoomOut: function() { Viewer.zoomOut(); }, zoomFit: function() { Viewer.zoomFit(); },
  exportCSV: exportCSV, exportJSON: exportJSON,
  // Scale panel
  openScalePanel: openScalePanel, closeScalePanel: closeScalePanel,
  setScaleSystem: setScaleSystem, acceptScale: acceptScale, verifyScale: verifyScale
};

/* ── Boot ─────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", init);
