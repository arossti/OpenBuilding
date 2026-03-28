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
var _measureMethod = "polygon";   // "polygon" or "rectangle"
var _calibPoint1 = null;
var _rectStart = null;            // first corner for bounding rectangle
var _rectCurrent = null;          // live cursor position for rubber-band preview
var _snapTarget = null;           // current snap indicator {x, y, type}

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
  Viewer.setDrawCallback(function(ctx, pageNum) {
    PolygonTool.draw(ctx, pageNum);
    _drawRectPreview(ctx);
    _drawSnapIndicator(ctx);
  });
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
  var hitRadius = 10 / (Viewer.getZoom() * (150 / 72));  // ~10 screen pixels → PDF units

  // Priority 1: Click near an existing vertex — start drag
  var hit = PolygonTool.hitTestVertex(_currentPage, pt, hitRadius);
  if (hit && !PolygonTool.isDrawing()) {
    PolygonTool.startDrag(_currentPage, hit.polyIdx, hit.vertIdx);
    Viewer.onOverlayMouseMove(_handleDragMove);
    _bindDragEnd();
    var wrap = document.getElementById("viewer-wrap");
    if (wrap) wrap.style.cursor = "move";
    return;
  }

  // Priority 2: Click near an edge — insert vertex and start dragging it
  var edgeHit = PolygonTool.hitTestEdge(_currentPage, pt, hitRadius);
  if (edgeHit && !PolygonTool.isDrawing()) {
    var newIdx = PolygonTool.insertVertex(_currentPage, edgeHit.polyIdx, edgeHit.edgeIdx, edgeHit.point);
    if (newIdx >= 0) {
      PolygonTool.startDrag(_currentPage, edgeHit.polyIdx, newIdx);
      Viewer.onOverlayMouseMove(_handleDragMove);
      _bindDragEnd();
      Viewer.requestRedraw();
      var wrap2 = document.getElementById("viewer-wrap");
      if (wrap2) wrap2.style.cursor = "move";
      return;
    }
  }

  // Snap to drawing geometry (endpoints and lines)
  var snapRadius = 12 / (Viewer.getZoom() * (150 / 72));
  var snap = VectorSnap.findSnap(_currentPage, pt, snapRadius);
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
      var mergeRadius = 10 / (Viewer.getZoom() * (150 / 72));  // ~10 screen pixels
      var merged = PolygonTool.endDrag(mergeRadius);
      if (merged) setStatus("Vertices merged", "ready");
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

function setMeasureMethod(method) {
  _measureMethod = method;
  _rectStart = null;  // reset any in-progress rectangle
  document.getElementById("measure-method").value = method;
}

function _handleMeasureClick(pt) {
  // Warn if no confirmed scale
  if (!ScaleManager.isCalibrated(_currentPage) && !PolygonTool.isDrawing() && !_rectStart) {
    setStatus("No confirmed scale. Press S to set scale first, or measurements will be uncalibrated.", "error");
  }

  if (_measureMethod === "rectangle") {
    _handleRectangleClick(pt);
  } else {
    _handlePolygonClick(pt);
  }
}

function _handlePolygonClick(pt) {
  if (!PolygonTool.isDrawing()) {
    PolygonTool.startPolygon(_currentPage);
    PolygonTool.addVertex(pt);
    setStatus("Click vertices... close near first point to finish", "busy");
  } else {
    if (PolygonTool.isNearFirstVertex(pt, 12)) {
      PolygonTool.closePolygon();
      _onPolygonComplete();
    } else {
      PolygonTool.addVertex(pt);
    }
  }
  Viewer.requestRedraw();
}

function _handleRectangleClick(pt) {
  if (!_rectStart) {
    _rectStart = pt;
    setStatus("Click opposite corner to complete rectangle", "busy");
  } else {
    // Create a 4-vertex polygon from the two diagonal corners
    var x1 = _rectStart.x, y1 = _rectStart.y;
    var x2 = pt.x, y2 = pt.y;
    PolygonTool.startPolygon(_currentPage);
    PolygonTool.addVertex({ x: x1, y: y1 });
    PolygonTool.addVertex({ x: x2, y: y1 });
    PolygonTool.addVertex({ x: x2, y: y2 });
    PolygonTool.addVertex({ x: x1, y: y2 });
    PolygonTool.closePolygon();
    _rectStart = null;
    _rectCurrent = null;
    _onPolygonComplete();
  }
  Viewer.requestRedraw();
}

function _onPolygonComplete() {
  setStatus("Area measured" + (ScaleManager.isCalibrated(_currentPage) ? "" : " (uncalibrated)"), "ready");
  _refreshMeasurements();
  ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
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
  var pt = Viewer.eventToPdfCoords(e);
  var hitRadius = 10 / (Viewer.getZoom() * (150 / 72));
  var snapRadius = 12 / (Viewer.getZoom() * (150 / 72));

  // Track snap target for visual indicator (during measure/calibrate modes)
  var prevSnap = _snapTarget;
  _snapTarget = null;
  if (_currentTool === "measure" || _currentTool === "calibrate") {
    _snapTarget = VectorSnap.findSnap(_currentPage, pt, snapRadius);
  }

  // Rubber-band rectangle preview
  if (_rectStart && _currentTool === "measure" && _measureMethod === "rectangle") {
    _rectCurrent = _snapTarget ? { x: _snapTarget.x, y: _snapTarget.y } : pt;
    Viewer.requestRedraw();
    return;
  }

  // Redraw if snap state changed (to show/hide indicator)
  if (_snapTarget !== prevSnap) Viewer.requestRedraw();

  // Show contextual cursor when hovering near draggable geometry
  var wrap = document.getElementById("viewer-wrap");
  if (!PolygonTool.isDrawing() && !_rectStart) {
    var vertHit = PolygonTool.hitTestVertex(_currentPage, pt, hitRadius);
    if (vertHit) {
      if (wrap) wrap.style.cursor = "move";
      return;
    }
    var edgeHit = PolygonTool.hitTestEdge(_currentPage, pt, hitRadius);
    if (edgeHit) {
      if (wrap) wrap.style.cursor = "cell";
      return;
    }
  }
  var cursorMap = { measure: "crosshair", calibrate: "crosshair", navigate: "default" };
  if (wrap) wrap.style.cursor = cursorMap[_currentTool] || "default";
}

function _drawSnapIndicator(ctx) {
  if (!_snapTarget) return;
  var p = Viewer.pdfToCanvas(_snapTarget);
  ctx.save();

  if (_snapTarget.type === "endpoint") {
    // Square indicator for endpoint snap
    ctx.strokeStyle = "#ff0";
    ctx.lineWidth = 2;
    var s = 8;
    ctx.strokeRect(p.x - s, p.y - s, s * 2, s * 2);
    // Crosshair
    ctx.beginPath();
    ctx.moveTo(p.x - s - 3, p.y); ctx.lineTo(p.x + s + 3, p.y);
    ctx.moveTo(p.x, p.y - s - 3); ctx.lineTo(p.x, p.y + s + 3);
    ctx.stroke();
  } else {
    // X indicator for line snap
    ctx.strokeStyle = "#0f0";
    ctx.lineWidth = 2;
    var r = 6;
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y - r); ctx.lineTo(p.x + r, p.y + r);
    ctx.moveTo(p.x + r, p.y - r); ctx.lineTo(p.x - r, p.y + r);
    ctx.stroke();
    // Circle
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function _drawRectPreview(ctx) {
  if (!_rectStart || !_rectCurrent) return;
  var p1 = Viewer.pdfToCanvas(_rectStart);
  var p2 = Viewer.pdfToCanvas(_rectCurrent);
  var x = Math.min(p1.x, p2.x);
  var y = Math.min(p1.y, p2.y);
  var w = Math.abs(p2.x - p1.x);
  var h = Math.abs(p2.y - p1.y);

  ctx.save();
  ctx.strokeStyle = "#00e5ff";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.fillStyle = "rgba(0, 229, 255, 0.08)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  // Show live dimensions if calibrated
  if (ScaleManager.isCalibrated(_currentPage)) {
    var dx = Math.abs(_rectCurrent.x - _rectStart.x);
    var dy = Math.abs(_rectCurrent.y - _rectStart.y);
    var widthM = ScaleManager.pdfToMetres(_currentPage, dx);
    var heightM = ScaleManager.pdfToMetres(_currentPage, dy);
    var areaM2 = widthM * heightM;
    if (areaM2 > 0.01) {
      var label = areaM2.toFixed(1) + " m\u00B2";
      ctx.setLineDash([]);
      ctx.font = "bold 18px Helvetica Neue, sans-serif";
      var tw = ctx.measureText(label).width;
      var cx = x + w / 2;
      var cy = y + h / 2;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.beginPath();
      ctx.roundRect(cx - tw / 2 - 8, cy - 12, tw + 16, 26, 4);
      ctx.fill();
      ctx.fillStyle = "#00e5ff";
      ctx.textAlign = "center";
      ctx.fillText(label, cx, cy + 7);
    }
  }

  ctx.restore();
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
        // Cascade: cancel the most immediate in-progress action
        // 1. Scale panel open? Close it.
        if (document.getElementById("scale-panel").classList.contains("visible")) {
          closeScalePanel();
          setStatus("Scale panel closed", "ready");
          break;
        }
        // 2. Rectangle in progress? Cancel it.
        if (_rectStart) {
          _rectStart = null;
          _rectCurrent = null;
          Viewer.requestRedraw();
          setStatus("Rectangle cancelled", "ready");
          break;
        }
        // 3. Polygon being drawn? Delete the in-progress polygon.
        if (PolygonTool.isDrawing()) {
          PolygonTool.deleteLastPolygon(_currentPage);
          Viewer.requestRedraw();
          setStatus("Polygon cancelled", "ready");
          break;
        }
        // 4. Calibration first-point set? Cancel it.
        if (_calibPoint1) {
          _calibPoint1 = null;
          _pendingRatio = null;
          setStatus("Calibration cancelled", "ready");
          setTool("navigate");
          break;
        }
        // 5. If in a tool mode, return to navigate
        if (_currentTool !== "navigate") {
          setTool("navigate");
          setStatus("", "ready");
          break;
        }
        break;
      case "Delete": case "Backspace":
        // Delete last polygon on current page
        if (!PolygonTool.isDrawing()) {
          PolygonTool.deleteLastPolygon(_currentPage);
          _refreshMeasurements();
          Viewer.requestRedraw();
          setStatus("Polygon deleted", "ready");
        }
        break;
      case "d": autoDetect(); break;
      case "s": openScalePanel(); break;
      case "m": setTool("measure"); break;
      case "r":
        setMeasureMethod(_measureMethod === "polygon" ? "rectangle" : "polygon");
        setTool("measure");
        setStatus("Measure: " + _measureMethod, "ready");
        break;
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
    html += "<tr><td class='label-cell' data-poly-idx='" + i + "' title='Click to rename'>" + m.label + "</td>";
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

  // Bind click-to-rename on label cells
  var labelCells = els.measurePanel.querySelectorAll(".label-cell");
  for (var lc = 0; lc < labelCells.length; lc++) {
    labelCells[lc].addEventListener("click", function(e) {
      _startLabelEdit(this, parseInt(this.dataset.polyIdx, 10));
    });
  }
}

function _startLabelEdit(cell, polyIdx) {
  var currentLabel = cell.textContent;
  var input = document.createElement("input");
  input.type = "text";
  input.value = currentLabel;
  input.className = "label-edit-input";
  input.style.width = "100%";
  cell.textContent = "";
  cell.appendChild(input);
  input.focus();
  input.select();

  function commit() {
    var newLabel = input.value.trim() || currentLabel;
    PolygonTool.renamePolygon(_currentPage, polyIdx, newLabel);
    ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
    Viewer.requestRedraw();
    _refreshMeasurements();
  }

  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    if (e.key === "Escape") { e.preventDefault(); _refreshMeasurements(); }
  });
  input.addEventListener("blur", commit);
}

/* ── Status bar ───────────────────────────────────────── */

function setStatus(msg, type) {
  els.statusBar.textContent = msg;
  els.statusBar.className = "status-bar" + (type ? " status-" + type : "");
}

/* ── Auto-detect building outline ──────────────────────── */

var _detectCandidates = [];  // cached candidates from last detect
var _detectIndex = 0;        // which candidate we're showing

function autoDetect() {
  if (!Loader.isLoaded()) return;

  // If we already scanned this page, cycle through candidates or bail
  if (_detectCandidates._page === _currentPage) {
    if (_detectCandidates.length > 0) {
      _detectIndex = (_detectIndex + 1) % _detectCandidates.length;
      _placeDetectedOutline(_detectCandidates[_detectIndex], _detectIndex, _detectCandidates.length);
    } else {
      setStatus("No vector geometry on this page. This may be a scanned/raster PDF — use manual measurement (M/R).", "error");
    }
    return;
  }

  setStatus("Scanning vector geometry...", "busy");

  VectorSnap.extractGeometry(_currentPage).then(function(geo) {
    return Loader.getPageSize(_currentPage).then(function(size) {
      var candidates = VectorSnap.getClosedPathsByArea(_currentPage, size.width, size.height);
      candidates._page = _currentPage;
      _detectCandidates = candidates;
      _detectIndex = 0;

      // Log diagnostics
      console.log("[Auto-detect] Page " + _currentPage + ": " +
        geo.segments.length + " line segments, " +
        geo.endpoints.length + " endpoints, " +
        geo.closedPaths.length + " closed paths total, " +
        candidates.length + " candidates (filtered by area)");

      if (candidates.length > 0) {
        for (var i = 0; i < Math.min(candidates.length, 5); i++) {
          var areaM2 = ScaleManager.pdfAreaToM2(_currentPage, candidates[i].area);
          console.log("  Candidate " + (i + 1) + ": " + candidates[i].path.length + " vertices, " +
            (areaM2 ? areaM2.toFixed(1) + " m²" : "uncalibrated"));
        }
        _placeDetectedOutline(candidates[0], 0, candidates.length);
      } else if (geo.segments.length === 0) {
        // No vector geometry at all — likely a scanned/raster PDF
        setStatus("No vector data found — this appears to be a scanned/raster PDF. Use manual measurement (M or R).", "error");
        console.log("[Auto-detect] Page has zero vector geometry. This is a raster/scanned PDF.");
      } else {
        setStatus("No closed outlines found (" + geo.segments.length + " line segments, but no closed shapes). Use manual measurement (M or R).", "error");
        console.log("[Auto-detect] " + geo.segments.length + " segments, " +
          geo.closedPaths.length + " closed paths (likely hatching/fills). " +
          "Building walls drawn as individual segments, not closed polylines.");
      }
    });
  });
}

function _placeDetectedOutline(candidate, idx, total) {
  // Remove the previous detected polygon if cycling
  var polys = PolygonTool.getPolygons(_currentPage);
  for (var i = polys.length - 1; i >= 0; i--) {
    if (polys[i].label && polys[i].label.indexOf("Detected") === 0) {
      PolygonTool.deletePolygon(_currentPage, i);
      break;
    }
  }

  var verts = candidate.path;
  console.log("[Auto-detect] Placing polygon with " + verts.length + " vertices:");
  console.log("  First vertex: (" + verts[0].x.toFixed(1) + ", " + verts[0].y.toFixed(1) + ")");
  if (verts.length > 1) console.log("  Last vertex: (" + verts[verts.length-1].x.toFixed(1) + ", " + verts[verts.length-1].y.toFixed(1) + ")");

  // Log what pdfToCanvas would produce for the first vertex
  var testCanvas = Viewer.pdfToCanvas(verts[0]);
  console.log("  First vertex in canvas px: (" + testCanvas.x.toFixed(1) + ", " + testCanvas.y.toFixed(1) + ")");
  console.log("  Canvas size: " + document.getElementById("pdf-canvas").width + "x" + document.getElementById("pdf-canvas").height);

  PolygonTool.startPolygon(_currentPage, "Detected " + (idx + 1) + "/" + total);
  for (var j = 0; j < verts.length; j++) {
    PolygonTool.addVertex({ x: verts[j].x, y: verts[j].y });
  }
  PolygonTool.closePolygon();

  _refreshMeasurements();
  ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
  Viewer.requestRedraw();

  var areaM2 = ScaleManager.pdfAreaToM2(_currentPage, candidate.area);
  var areaStr = areaM2 !== null ? (areaM2.toFixed(1) + " m\u00B2") : "(uncalibrated)";
  var hint = total > 1 ? " Press D again to cycle (" + (idx + 1) + "/" + total + ")." : "";
  setStatus("Outline: " + areaStr + ", " + verts.length + " vertices." + hint, "ready");
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
  setScaleSystem: setScaleSystem, acceptScale: acceptScale, verifyScale: verifyScale,
  // Measure method
  setMeasureMethod: setMeasureMethod,
  // Auto-detect
  autoDetect: autoDetect
};

/* ── Boot ─────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", init);
