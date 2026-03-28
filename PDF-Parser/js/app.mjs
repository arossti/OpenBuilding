/**
 * PDF-Parser — Application Controller
 * Main entry point. Wires all modules together.
 */

import {
  VERSION,
  SNAP_RADIUS_PX,
  METRIC_SCALES,
  IMPERIAL_SCALES,
  AREA_EDGE,
  AREA_FILL,
  WIN_EDGE,
  WIN_FILL
} from "./config.mjs";
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
var _measureMethod = "rectangle"; // "polygon" or "rectangle"
var _windowMode = "net"; // "net" or "add"
var _calibPoint1 = null;
var _rectStart = null; // first corner for bounding rectangle
var _rectCurrent = null; // live cursor position for rubber-band preview
var _snapTarget = null; // current snap indicator {x, y, type}
var _rulerStart = null; // first point for ruler/calibrate rubber-band
var _rulerCurrent = null; // live cursor position for ruler preview

// Persistent ruler lines per page: _rulers[pageNum] = [{p1, p2, label, lengthM}, ...]
var _rulers = {};
var _nextRulerId = 1;

/* ── Boot ─────────────────────────────────────────────── */

function init() {
  console.log("[PDF-Parser] Booting v" + VERSION);

  els.fileInput = document.getElementById("file-input");
  els.dropZone = document.getElementById("drop-zone");
  els.viewerWrap = document.getElementById("viewer-wrap");
  els.thumbStrip = document.getElementById("thumb-strip");
  els.sheetInfo = document.getElementById("sheet-info");
  els.measurePanel = document.getElementById("measure-panel");
  els.statusBar = document.getElementById("status-bar");
  els.zoomLabel = document.getElementById("zoom-label");
  els.scaleLabel = document.getElementById("scale-label");
  els.pageLabel = document.getElementById("page-label");
  els.toolBtns = document.querySelectorAll(".tool-btn");

  Viewer.init("viewer-container", "pdf-canvas", "overlay-canvas");
  Viewer.setDrawCallback(function (ctx, pageNum) {
    PolygonTool.draw(ctx, pageNum);
    _drawRulers(ctx, pageNum);
    _drawRulerPreview(ctx);
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
  els.fileInput.addEventListener("change", function (e) {
    if (e.target.files.length > 0) _loadFile(e.target.files[0]);
  });
  els.dropZone.addEventListener("dragover", function (e) {
    e.preventDefault();
    els.dropZone.classList.add("drag-over");
  });
  els.dropZone.addEventListener("dragleave", function () {
    els.dropZone.classList.remove("drag-over");
  });
  els.dropZone.addEventListener("drop", function (e) {
    e.preventDefault();
    els.dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0) _loadFile(e.dataTransfer.files[0]);
  });
}

function _loadFile(file) {
  if (file.type !== "application/pdf") {
    setStatus("Error: not a PDF file", "error");
    return;
  }
  setStatus("Loading " + file.name + "...", "busy");
  var reader = new FileReader();
  reader.onload = function (e) {
    loadPdf(e.target.result, file.name);
  };
  reader.readAsArrayBuffer(file);
}

function loadSample() {
  setStatus("Loading sample PDF...", "busy");
  fetch("sample.pdf")
    .then(function (resp) {
      if (!resp.ok) throw new Error("Could not fetch sample.pdf (" + resp.status + ")");
      return resp.arrayBuffer();
    })
    .then(function (buffer) {
      loadPdf(buffer, "Calgary-DP-BP-new-home-sample-drawings.pdf");
    })
    .catch(function (err) {
      setStatus("Error: " + err.message, "error");
    });
}

function loadPdf(buffer, fileName) {
  console.log("[PDF-Parser] Loading:", fileName, "(" + (buffer.byteLength / 1048576).toFixed(1) + " MB)");

  Loader.reset();
  PolygonTool.reset();
  ScaleManager.reset();
  VectorSnap.reset();
  ProjectStore.reset();

  var loadingOverlay = document.getElementById("loading-overlay");
  var loadingBar = document.getElementById("loading-bar-fill");
  var loadingLabel = document.getElementById("loading-label");

  Loader.loadFromBuffer(buffer)
    .then(function (result) {
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

          return SheetClassifier.classifyAll().then(function (results) {
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
            ScheduleParser.findRoomScheduleInDocument().then(function (schedData) {
              if (schedData) {
                ProjectStore.setRoomSchedule(schedData.rooms);
                console.log(
                  "[PDF-Parser] Room schedule on page",
                  schedData.pageNum,
                  "—",
                  schedData.rooms.length,
                  "rooms"
                );
              }
            });
          });
        }

        // Update progress
        var pct = Math.round((p / total) * 100);
        loadingBar.style.width = pct + "%";
        loadingLabel.textContent = "Reading page " + p + " / " + total;

        var canvas = els.thumbStrip.querySelectorAll(".thumb-canvas")[p - 1];
        return Loader.renderThumbnail(p, canvas, 120).then(function () {
          return renderNext(p + 1);
        });
      }

      return renderNext(1);
    })
    .catch(function (err) {
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

  Viewer.showPage(pageNum).then(function (result) {
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

    // Auto-prompt scale panel on unscaled pages
    var scaleState = ScaleManager.getState(pageNum);
    if (scaleState === "none" || scaleState === "pending") {
      // Small delay so the page renders visibly first
      setTimeout(function () {
        openScalePanel(true);
      }, 350);
    }
  });
}

function nextPage() {
  goToPage(_currentPage + 1);
}
function prevPage() {
  goToPage(_currentPage - 1);
}

/* ── Overlay click handling ───────────────────────────── */

/* ── Scale Confirmation Panel ─────────────────────────── */

var _scaleSystem = "metric"; // "metric" or "imperial"
var _pendingRatio = null; // ratio selected in the Check Scale panel

function openScalePanel(autoPrompt) {
  if (!Loader.isLoaded()) return;
  var cal = ScaleManager.getCalibration(_currentPage);
  var detectedRatio = cal ? cal.ratio : null;
  var detectedLabel = cal ? cal.ratioLabel : null;

  // Dynamic title: guided prompt for unscaled pages, standard for manual S-key
  var titleEl = document.getElementById("scale-panel-title");
  if (autoPrompt) {
    titleEl.textContent = "Set or Accept Scale for This Page";
  } else {
    titleEl.textContent = "Check Scale";
  }

  // Auto-detect metric vs imperial from the detected label or ratio
  if (detectedRatio) {
    var inferredSystem = _inferScaleSystem(detectedRatio, detectedLabel);
    if (inferredSystem !== _scaleSystem) {
      setScaleSystem(inferredSystem);
    }
  }

  // Show detection info
  var detEl = document.getElementById("scale-detected");
  if (detectedRatio) {
    detEl.innerHTML =
      "Detected: <strong>" + (detectedLabel || "1:" + detectedRatio) + "</strong> (from title block text)";
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

/* ── Scale Feedback Dialogue ────────────────────────── */

var _scaleFeedbackCallback = null;

/**
 * Show a feedback/instruction dialogue after scale accept or verify.
 * @param {string} icon - emoji or text icon
 * @param {string} title - heading text
 * @param {string} bodyHtml - HTML body content
 * @param {string} titleColor - CSS colour for the title
 * @param {boolean} showRemember - show "Don't show again" checkbox
 * @param {Function} [onOk] - callback when OK is clicked (after closing)
 */
function _showScaleFeedback(icon, title, bodyHtml, titleColor, showRemember, onOk) {
  document.getElementById("scale-feedback-icon").textContent = icon;
  var titleEl = document.getElementById("scale-feedback-title");
  titleEl.textContent = title;
  titleEl.style.color = titleColor || "var(--text)";
  document.getElementById("scale-feedback-body").innerHTML = bodyHtml;

  var rememberWrap = document.getElementById("scale-feedback-remember-wrap");
  var rememberCheck = document.getElementById("scale-feedback-remember");
  rememberWrap.style.display = showRemember ? "flex" : "none";
  rememberCheck.checked = false;

  _scaleFeedbackCallback = onOk || null;

  document.getElementById("scale-feedback-backdrop").classList.add("visible");
  document.getElementById("scale-feedback-panel").classList.add("visible");
}

function closeScaleFeedback() {
  document.getElementById("scale-feedback-backdrop").classList.remove("visible");
  document.getElementById("scale-feedback-panel").classList.remove("visible");

  // Save "don't show again" preference if checked
  var rememberCheck = document.getElementById("scale-feedback-remember");
  if (rememberCheck.checked) {
    try {
      localStorage.setItem("pp_skip_calibrate_hint", "1");
    } catch (e) {
      /* ignore */
    }
  }

  // Fire callback (e.g., enter calibration mode)
  if (_scaleFeedbackCallback) {
    var cb = _scaleFeedbackCallback;
    _scaleFeedbackCallback = null;
    cb();
  }
}

function setScaleSystem(system) {
  _scaleSystem = system;
  document.getElementById("scale-toggle-metric").classList.toggle("active", system === "metric");
  document.getElementById("scale-toggle-imperial").classList.toggle("active", system === "imperial");

  var cal = ScaleManager.getCalibration(_currentPage);
  _populateScaleDropdown(cal ? cal.ratio : null);
}

/**
 * Infer metric vs imperial from detected ratio and label text.
 * Imperial labels contain " or ' characters (e.g., 3/16"=1'-0").
 * Imperial-only ratios: 12, 16, 32, 64, 96, 128, 192.
 * Metric-only ratios: 1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 1000.
 * Shared: 48 (both lists) — fall back to label text.
 */
function _inferScaleSystem(ratio, label) {
  // Label text is most reliable — imperial labels have inch/foot marks
  if (label && (/["']/.test(label) || /\/\d+"/.test(label))) return "imperial";

  // Imperial-only ratios (not in metric list)
  var imperialOnly = { 12: 1, 16: 1, 32: 1, 64: 1, 96: 1, 128: 1, 192: 1 };
  if (imperialOnly[ratio]) return "imperial";

  // Everything else is metric (including 48 without imperial label)
  return "metric";
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

  // Show "Accepted but not Verified" feedback
  _showScaleFeedback(
    "\u2713", // checkmark icon
    "Scale Accepted (Provisional)",
    "Scale 1:" +
      ratio +
      " is set for this page. Area measurements will work, but for highest accuracy you can verify by calibrating against a known dimension.<br><br>Press <b>C</b> at any time to calibrate.",
    "#e9c46a", // gold title colour
    false // no "don't show again" for accept
  );
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

  // Check if user has opted out of the calibration instruction
  var skipHint = false;
  try {
    skipHint = localStorage.getItem("pp_skip_calibrate_hint") === "1";
  } catch (e) {
    /* ignore */
  }

  if (skipHint) {
    // Go straight to calibration mode
    setTool("calibrate");
    setStatus("Click two endpoints of a known dimension to verify 1:" + ratio, "busy");
  } else {
    // Show instruction dialogue first
    _showScaleFeedback(
      "\u{1F4CF}", // ruler icon
      "Calibrate: Verify Scale",
      "Click any <b>two points</b> on the drawing where you know the real-world distance (e.g., a dimension line, a door width, a grid spacing).<br><br>You\u2019ll be asked to enter the distance after clicking both points.",
      "var(--accent-lit)", // green title
      true, // show "don't show again" checkbox
      function () {
        // Callback when OK is clicked
        setTool("calibrate");
        setStatus("Click two endpoints of a known dimension to verify 1:" + ratio, "busy");
      }
    );
  }
}

/* ── Overlay click handling ───────────────────────────── */

function _handleOverlayClick(e) {
  var pt = Viewer.eventToPdfCoords(e);
  var hitRadius = 10 / (Viewer.getZoom() * (150 / 72)); // ~10 screen pixels → PDF units

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
  else if (_currentTool === "window") _handleWindowClick(pt);
  else if (_currentTool === "calibrate") _handleCalibrateClick(pt);
  else if (_currentTool === "ruler") _handleRulerClick(pt);
}

function _handleDragMove(e) {
  if (!PolygonTool.isDragging()) return;
  var pt = Viewer.eventToPdfCoords(e);
  // Snap during vertex drag
  var snapRadius = 12 / (Viewer.getZoom() * (150 / 72));
  var snap = VectorSnap.findSnap(_currentPage, pt, snapRadius);
  _snapTarget = snap;
  if (snap) pt = { x: snap.x, y: snap.y };
  PolygonTool.moveDrag(pt);
  Viewer.requestRedraw();
}

function _bindDragEnd() {
  function onUp() {
    window.removeEventListener("mouseup", onUp);
    if (PolygonTool.isDragging()) {
      var mergeRadius = 10 / (Viewer.getZoom() * (150 / 72));
      var merged = PolygonTool.endDrag(mergeRadius);
      if (merged) setStatus("Vertices merged", "ready");
      _snapTarget = null; // clear snap indicator
      Viewer.onOverlayMouseMove(_handleOverlayMouseMove);
      var wrap = document.getElementById("viewer-wrap");
      var cursorMap = {
        measure: "crosshair",
        window: "crosshair",
        calibrate: "crosshair",
        ruler: "crosshair",
        navigate: "default"
      };
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
  _rectStart = null; // reset any in-progress rectangle
  document.getElementById("measure-method").value = method;
}

function setWindowMode(mode) {
  _windowMode = mode;
  document.getElementById("window-mode").value = mode;
}

/* ── Generic polygon/rectangle handlers (shared by Measure + Window) ── */

function _handleGenericPolygonClick(pt, opts) {
  if (!PolygonTool.isDrawing()) {
    PolygonTool.startPolygon(_currentPage, null, opts);
    PolygonTool.addVertex(pt);
    setStatus("Click vertices... close near first point to finish", "busy");
  } else {
    if (PolygonTool.isNearFirstVertex(pt, 12)) {
      PolygonTool.closePolygon();
      _onPolygonComplete(opts);
    } else {
      PolygonTool.addVertex(pt);
    }
  }
  Viewer.requestRedraw();
}

function _handleGenericRectangleClick(pt, opts) {
  if (!_rectStart) {
    _rectStart = pt;
    setStatus("Click opposite corner to complete rectangle", "busy");
  } else {
    var x1 = _rectStart.x,
      y1 = _rectStart.y;
    var x2 = pt.x,
      y2 = pt.y;
    PolygonTool.startPolygon(_currentPage, null, opts);
    PolygonTool.addVertex({ x: x1, y: y1 });
    PolygonTool.addVertex({ x: x2, y: y1 });
    PolygonTool.addVertex({ x: x2, y: y2 });
    PolygonTool.addVertex({ x: x1, y: y2 });
    PolygonTool.closePolygon();
    _rectStart = null;
    _rectCurrent = null;
    _onPolygonComplete(opts);
  }
  Viewer.requestRedraw();
}

function _handleMeasureClick(pt) {
  if (!ScaleManager.isCalibrated(_currentPage) && !PolygonTool.isDrawing() && !_rectStart) {
    setStatus("No confirmed scale. Press S to set scale first, or measurements will be uncalibrated.", "error");
  }
  var opts = { type: "area" };
  if (_measureMethod === "rectangle") {
    _handleGenericRectangleClick(pt, opts);
  } else {
    _handleGenericPolygonClick(pt, opts);
  }
}

function _handleWindowClick(pt) {
  if (!ScaleManager.isCalibrated(_currentPage) && !PolygonTool.isDrawing() && !_rectStart) {
    setStatus("No confirmed scale. Press S to set scale first, or measurements will be uncalibrated.", "error");
  }
  var opts = { type: "window", mode: _windowMode };
  if (_measureMethod === "rectangle") {
    _handleGenericRectangleClick(pt, opts);
  } else {
    _handleGenericPolygonClick(pt, opts);
  }
}

function _onPolygonComplete(opts) {
  var isWindow = opts && opts.type === "window";
  setStatus(
    (isWindow ? "Window" : "Area") + " measured" + (ScaleManager.isCalibrated(_currentPage) ? "" : " (uncalibrated)"),
    "ready"
  );
  _refreshMeasurements();
  ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
}

function _handleCalibrateClick(pt) {
  if (!_calibPoint1) {
    _calibPoint1 = pt;
    _rulerStart = pt; // show rubber-band
    setStatus("Click second point of the dimension...", "busy");
  } else {
    _rulerStart = null;
    _rulerCurrent = null; // clear rubber-band
    var hint = _pendingRatio ? " (at 1:" + _pendingRatio + ")" : "";
    var input = prompt(
      "Enter the real-world distance between the two points" +
        hint +
        "\n\nExamples: '10.5 m', '35 ft', '8500 mm', '39-1 ft'"
    );
    if (input) {
      var parsed = _parseDistanceInput(input);
      if (parsed) {
        var meta = _pendingRatio
          ? { ratio: _pendingRatio, source: "check-scale", raw: "1:" + _pendingRatio }
          : { source: "manual" };
        ScaleManager.calibrate(_currentPage, _calibPoint1, pt, parsed.value, parsed.unit, meta);

        var badgeText = _pendingRatio ? "1:" + _pendingRatio : "calibrated";
        setStatus("Scale verified: " + badgeText + " (" + parsed.value + " " + parsed.unit + ")", "ready");

        ProjectStore.saveCalibration(_currentPage, ScaleManager.getCalibration(_currentPage));
        _updateSheetInfo(ProjectStore.getPage(_currentPage));
        _updateScaleLabel();
        _refreshMeasurements();
        Viewer.requestRedraw();

        // Show "Scale Verified!" confirmation
        _showScaleFeedback(
          "\u2713",
          "Scale Verified!",
          "Scale <b>" +
            badgeText +
            "</b> has been empirically calibrated using your reference dimension (" +
            parsed.value +
            " " +
            parsed.unit +
            ").<br><br>All area measurements on this page now use the verified scale.",
          "var(--accent-lit)",
          false
        );
      } else {
        setStatus("Could not parse. Use: '10.5 m', '35 ft', '8500 mm'", "error");
      }
    }
    _calibPoint1 = null;
    _pendingRatio = null;
    Viewer.requestRedraw();
    setTool("navigate");
  }
}

/* ── Ruler tool ───────────────────────────────────────── */

function _handleRulerClick(pt) {
  if (!_rulerStart) {
    _rulerStart = pt;
    setStatus("Click second point to complete ruler measurement", "busy");
  } else {
    // Create persistent ruler line
    var p1 = _rulerStart;
    var p2 = pt;
    var dx = p2.x - p1.x,
      dy = p2.y - p1.y;
    var pdfLen = Math.sqrt(dx * dx + dy * dy);
    var lengthM = ScaleManager.pdfToMetres(_currentPage, pdfLen);

    if (!_rulers[_currentPage]) _rulers[_currentPage] = [];
    _rulers[_currentPage].push({
      id: "ruler_" + _nextRulerId++,
      p1: p1,
      p2: p2,
      pdfLength: pdfLen,
      lengthM: lengthM
    });

    _rulerStart = null;
    _rulerCurrent = null;

    var lenStr =
      lengthM !== null
        ? lengthM.toFixed(2) + " m / " + (lengthM * 3.28084).toFixed(2) + " ft"
        : pdfLen.toFixed(1) + " (uncalibrated)";
    setStatus("Ruler: " + lenStr, "ready");
    Viewer.requestRedraw();
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
    var unitMap = { m: "m", mm: "mm", ft: "ft", feet: "ft", in: "in", inches: "in", metres: "m", meters: "m" };
    return { value: parseFloat(m[1]), unit: unitMap[m[2].toLowerCase()] || "m" };
  }

  // "19.55" — bare number, no unit. Assume the unit system from the scale panel toggle.
  m = str.match(/^([\d.]+)$/);
  if (m) {
    // If value > 100, likely mm. If < 100, likely metres or feet.
    var val = parseFloat(m[1]);
    var guessUnit = _scaleSystem === "imperial" ? "ft" : val > 100 ? "mm" : "m";
    return { value: val, unit: guessUnit };
  }

  return null;
}

function _handleOverlayMouseMove(e) {
  var pt = Viewer.eventToPdfCoords(e);
  var hitRadius = 10 / (Viewer.getZoom() * (150 / 72));
  var snapRadius = 12 / (Viewer.getZoom() * (150 / 72));

  // Track snap target for visual indicator
  var prevSnap = _snapTarget;
  _snapTarget = null;
  if (
    _currentTool === "measure" ||
    _currentTool === "window" ||
    _currentTool === "calibrate" ||
    _currentTool === "ruler"
  ) {
    _snapTarget = VectorSnap.findSnap(_currentPage, pt, snapRadius);
  }

  // Rubber-band for ruler / calibrate
  if (_rulerStart && (_currentTool === "ruler" || _currentTool === "calibrate")) {
    _rulerCurrent = _snapTarget ? { x: _snapTarget.x, y: _snapTarget.y } : pt;
    Viewer.requestRedraw();
    return;
  }

  // Rubber-band rectangle preview
  if (_rectStart && (_currentTool === "measure" || _currentTool === "window") && _measureMethod === "rectangle") {
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
  var cursorMap = {
    measure: "crosshair",
    window: "crosshair",
    calibrate: "crosshair",
    ruler: "crosshair",
    navigate: "default"
  };
  if (wrap) wrap.style.cursor = cursorMap[_currentTool] || "default";
}

/* ── Ruler drawing ─────────────────────────────────────── */

function _drawRulerLine(ctx, p1, p2, lengthM, color, showTicks) {
  var a = Viewer.pdfToCanvas(p1);
  var b = Viewer.pdfToCanvas(p2);
  var dx = b.x - a.x,
    dy = b.y - a.y;
  var len = Math.sqrt(dx * dx + dy * dy);
  if (len < 2) return;

  // Unit vector along the line and perpendicular
  var ux = dx / len,
    uy = dy / len;
  var px = -uy,
    py = ux; // perpendicular

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.fillStyle = color;

  // Main line
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  // End caps (small perpendicular lines)
  var capLen = 8;
  ctx.beginPath();
  ctx.moveTo(a.x + px * capLen, a.y + py * capLen);
  ctx.lineTo(a.x - px * capLen, a.y - py * capLen);
  ctx.moveTo(b.x + px * capLen, b.y + py * capLen);
  ctx.lineTo(b.x - px * capLen, b.y - py * capLen);
  ctx.stroke();

  // Tick marks
  if (showTicks && lengthM !== null && lengthM > 0) {
    // Determine tick interval based on scale system
    var isImperial = _scaleSystem === "imperial";
    var tickM = isImperial ? 0.3048 : 1.0; // 1 foot or 1 metre
    if (lengthM / tickM > 50) tickM *= 5; // avoid too many ticks
    if (lengthM / tickM > 50) tickM *= 2;
    if (lengthM / tickM < 3) tickM /= 2;

    var tickCount = Math.floor(lengthM / tickM);
    var tickLen = 5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var t = 1; t <= tickCount; t++) {
      var frac = (t * tickM) / lengthM;
      var tx = a.x + dx * frac;
      var ty = a.y + dy * frac;
      ctx.moveTo(tx + px * tickLen, ty + py * tickLen);
      ctx.lineTo(tx - px * tickLen, ty - py * tickLen);
    }
    ctx.stroke();
  }

  // Label at midpoint
  var mx = (a.x + b.x) / 2;
  var my = (a.y + b.y) / 2;
  var labelText = "";
  if (lengthM !== null) {
    var isImp = _scaleSystem === "imperial";
    if (isImp) {
      var totalFt = lengthM * 3.28084;
      var feet = Math.floor(totalFt);
      var inches = Math.round((totalFt - feet) * 12);
      if (inches === 12) {
        feet++;
        inches = 0;
      }
      labelText = feet + "'-" + inches + '"';
    } else {
      labelText = lengthM < 1 ? (lengthM * 1000).toFixed(0) + " mm" : lengthM.toFixed(2) + " m";
    }
  }

  if (labelText) {
    // Offset label to one side of the line
    var labelOffset = 14;
    var lx = mx + px * labelOffset;
    var ly = my + py * labelOffset;

    ctx.font = "bold 14px Helvetica Neue, sans-serif";
    var tw = ctx.measureText(labelText).width;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.beginPath();
    ctx.roundRect(lx - tw / 2 - 6, ly - 10, tw + 12, 22, 4);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.fillText(labelText, lx, ly + 5);
  }

  ctx.restore();
}

/** Draw persistent ruler lines for a page. */
function _drawRulers(ctx, pageNum) {
  var rulers = _rulers[pageNum] || [];
  for (var i = 0; i < rulers.length; i++) {
    var r = rulers[i];
    _drawRulerLine(ctx, r.p1, r.p2, r.lengthM, "#ffd700", true);
  }
}

/** Draw the rubber-band preview while placing a ruler or calibrating. */
function _drawRulerPreview(ctx) {
  if (!_rulerStart || !_rulerCurrent) return;
  var pdfLen = Math.sqrt(Math.pow(_rulerCurrent.x - _rulerStart.x, 2) + Math.pow(_rulerCurrent.y - _rulerStart.y, 2));
  var lengthM = ScaleManager.pdfToMetres(_currentPage, pdfLen);
  var color = _currentTool === "ruler" ? "#ffd700" : "#ff8c00"; // gold for ruler, orange for calibrate
  _drawRulerLine(ctx, _rulerStart, _rulerCurrent, lengthM, color, true);
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
    ctx.moveTo(p.x - s - 3, p.y);
    ctx.lineTo(p.x + s + 3, p.y);
    ctx.moveTo(p.x, p.y - s - 3);
    ctx.lineTo(p.x, p.y + s + 3);
    ctx.stroke();
  } else {
    // X indicator for line snap
    ctx.strokeStyle = "#0f0";
    ctx.lineWidth = 2;
    var r = 6;
    ctx.beginPath();
    ctx.moveTo(p.x - r, p.y - r);
    ctx.lineTo(p.x + r, p.y + r);
    ctx.moveTo(p.x + r, p.y - r);
    ctx.lineTo(p.x - r, p.y + r);
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

  var isWin = _currentTool === "window";
  var edgeCol = isWin ? WIN_EDGE : AREA_EDGE;
  var fillCol = isWin ? WIN_FILL : AREA_FILL;

  ctx.save();
  ctx.strokeStyle = edgeCol;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.fillStyle = fillCol;
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
      ctx.fillStyle = edgeCol;
      ctx.textAlign = "center";
      ctx.fillText(label, cx, cy + 7);
    }
  }

  ctx.restore();
}

/* ── Toolbar ──────────────────────────────────────────── */

function _bindToolbar() {
  for (var i = 0; i < els.toolBtns.length; i++) {
    els.toolBtns[i].addEventListener("click", function () {
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
  var cursorMap = {
    measure: "crosshair",
    window: "crosshair",
    calibrate: "crosshair",
    ruler: "crosshair",
    navigate: "default"
  };
  var wrap = document.getElementById("viewer-wrap");
  if (wrap) wrap.style.cursor = cursorMap[tool] || "default";
}

/* ── Keyboard ─────────────────────────────────────────── */

function _bindKeyboard() {
  document.addEventListener("keydown", function (e) {
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
        // 0. Scale feedback dialogue open? Close it.
        if (document.getElementById("scale-feedback-panel").classList.contains("visible")) {
          closeScaleFeedback();
          break;
        }
        // 1. Scale panel open? Close it.
        if (document.getElementById("scale-panel").classList.contains("visible")) {
          closeScalePanel();
          setStatus("Scale panel closed", "ready");
          break;
        }
        // 2. Ruler in progress? Cancel it.
        if (_rulerStart) {
          _rulerStart = null;
          _rulerCurrent = null;
          Viewer.requestRedraw();
          setStatus("Ruler cancelled", "ready");
          break;
        }
        // 3. Rectangle in progress? Cancel it.
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
      case "Delete":
      case "Backspace":
        // Delete last ruler if in ruler mode, otherwise last polygon
        if (_currentTool === "ruler" && _rulers[_currentPage] && _rulers[_currentPage].length > 0) {
          _rulers[_currentPage].pop();
          Viewer.requestRedraw();
          setStatus("Ruler deleted", "ready");
          break;
        }
        if (!PolygonTool.isDrawing()) {
          PolygonTool.deleteLastPolygon(_currentPage);
          _refreshMeasurements();
          Viewer.requestRedraw();
          setStatus("Polygon deleted", "ready");
        }
        break;
      case "d":
        autoDetect();
        break;
      case "l":
        setTool("ruler");
        break;
      case "s":
        openScalePanel();
        break;
      case "m":
        setTool("measure");
        break;
      case "w":
        setTool("window");
        break;
      case "r":
        setMeasureMethod(_measureMethod === "polygon" ? "rectangle" : "polygon");
        setTool("measure");
        setStatus("Measure: " + _measureMethod, "ready");
        break;
      case "c":
        setTool("calibrate");
        break;
      case "v":
        setTool("navigate");
        break;
      case "f":
        Viewer.zoomFit();
        break;
      case "ArrowRight":
      case "PageDown":
        e.preventDefault();
        nextPage();
        break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault();
        prevPage();
        break;
      case "+":
      case "=":
        Viewer.zoomIn();
        break;
      case "-":
        Viewer.zoomOut();
        break;
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
    wrapper.addEventListener("click", function () {
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
      lbl.textContent = cr.sheetId || "Page " + cr.pageNum;
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
  if (!pageData) {
    els.sheetInfo.innerHTML = "";
    return;
  }
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
  _updateMeasurements();
}

function _updateMeasurements() {
  var assoc = PolygonTool.buildAssociationMap(_currentPage);
  var walls = assoc.walls;
  var orphans = assoc.orphanWindows;

  if (walls.length === 0 && orphans.length === 0) {
    els.measurePanel.innerHTML =
      "<p class='empty'>No measurements on this page.<br><span style='font-size:10px;color:var(--text-dim);'>Press <b>M</b> to measure areas, <b>W</b> for windows.</span></p>";
    return;
  }

  var hasScale =
    (walls.length > 0 && walls[0].measurement.calibrated) || (orphans.length > 0 && orphans[0].measurement.calibrated);
  var html = "";
  var netTotalM2 = 0,
    netTotalFt2 = 0;

  // ── Wall / Area rows ──
  if (walls.length > 0) {
    html += "<div class='measure-header'>Areas</div>";
    html += "<table><thead><tr><th>Label</th>";
    if (hasScale) {
      html += "<th>m\u00B2</th><th>ft\u00B2</th>";
    } else {
      html += "<th colspan='2' style='color:var(--gold);font-size:10px;'>No scale \u2014 press S</th>";
    }
    html += "<th></th></tr></thead><tbody>";

    for (var a = 0; a < walls.length; a++) {
      var wall = walls[a];
      var wm = wall.measurement;
      var hasChildren = wall.children.length > 0;

      // Compute net area for this wall
      var wallNetM2 = wm.areaM2;
      var wallNetFt2 = wm.areaFt2;
      if (hasChildren && wm.areaM2 !== null) {
        for (var ci = 0; ci < wall.children.length; ci++) {
          var ch = wall.children[ci].measurement;
          if (ch.areaM2 !== null) {
            if (ch.mode !== "add") {
              wallNetM2 -= ch.areaM2;
              wallNetFt2 -= ch.areaFt2;
            } else {
              wallNetM2 += ch.areaM2;
              wallNetFt2 += ch.areaFt2;
            }
          }
        }
      }

      // Wall row — shows net area if it has children, gross otherwise
      var chevron = hasChildren
        ? "<span class='wall-toggle' data-wall-idx='" + a + "' data-expanded='0'>\u25B6</span> "
        : "";
      var netSuffix = hasChildren ? " <span class='net-label'>net</span>" : "";
      html +=
        "<tr><td class='label-cell' data-poly-idx='" +
        wall.polyIdx +
        "' title='Click to rename'>" +
        chevron +
        wm.label +
        netSuffix +
        "</td>";
      if (hasScale && wallNetM2 !== null) {
        html += "<td class='num'>" + wallNetM2.toFixed(2) + "</td>";
        html += "<td class='num'>" + wallNetFt2.toFixed(2) + "</td>";
        netTotalM2 += wallNetM2;
        netTotalFt2 += wallNetFt2;
      } else {
        html += "<td class='num' colspan='2'>\u2014</td>";
      }
      html += "<td class='del-cell' data-poly-idx='" + wall.polyIdx + "' title='Delete'>\u00D7</td></tr>";

      // Detail rows (hidden by default): gross + child windows
      if (hasChildren) {
        html +=
          "<tr class='detail-row' data-parent='" +
          a +
          "'><td style='padding-left:18px;font-size:10px;color:var(--text-dim);'>Gross</td>";
        if (hasScale && wm.areaM2 !== null) {
          html += "<td class='num' style='font-size:10px;color:var(--text-dim);'>" + wm.areaM2.toFixed(2) + "</td>";
          html += "<td class='num' style='font-size:10px;color:var(--text-dim);'>" + wm.areaFt2.toFixed(2) + "</td>";
        } else {
          html += "<td colspan='2'></td>";
        }
        html += "<td></td></tr>";

        for (var cj = 0; cj < wall.children.length; cj++) {
          var child = wall.children[cj];
          var cm = child.measurement;
          var cPrefix = cm.mode !== "add" ? "\u2212" : "+";
          html += "<tr class='detail-row' data-parent='" + a + "' style='color:" + WIN_EDGE + ";'>";
          html +=
            "<td class='label-cell' data-poly-idx='" +
            child.polyIdx +
            "' style='padding-left:18px;font-size:10px;' title='Click to rename'>" +
            cPrefix +
            " " +
            cm.label +
            "</td>";
          if (hasScale && cm.areaM2 !== null) {
            html += "<td class='num' style='font-size:10px;'>" + cPrefix + cm.areaM2.toFixed(2) + "</td>";
            html += "<td class='num' style='font-size:10px;'>" + cPrefix + cm.areaFt2.toFixed(2) + "</td>";
          } else {
            html += "<td colspan='2'></td>";
          }
          html +=
            "<td class='del-cell' data-poly-idx='" +
            child.polyIdx +
            "' title='Delete' style='font-size:10px;'>\u00D7</td></tr>";
        }
      }
    }

    // Net total row
    if (hasScale && walls.length > 1) {
      html += "<tr class='total-row'><td><strong>Net Total</strong></td>";
      html += "<td class='num'><strong>" + netTotalM2.toFixed(2) + "</strong></td>";
      html += "<td class='num'><strong>" + netTotalFt2.toFixed(2) + "</strong></td><td></td></tr>";
    }
    html += "</tbody></table>";
  }

  // ── Orphan windows (not inside any wall) ──
  if (orphans.length > 0) {
    html += "<div class='measure-header' style='margin-top:8px;color:" + WIN_EDGE + ";'>Unassociated Windows</div>";
    html += "<table><tbody>";
    for (var o = 0; o < orphans.length; o++) {
      var om = orphans[o].measurement;
      var oPrefix = om.mode !== "add" ? "\u2212" : "+";
      html += "<tr style='color:" + WIN_EDGE + ";'>";
      html +=
        "<td class='label-cell' data-poly-idx='" +
        orphans[o].polyIdx +
        "' title='Click to rename'>" +
        om.label +
        "</td>";
      if (hasScale && om.areaM2 !== null) {
        html += "<td class='num'>" + oPrefix + om.areaM2.toFixed(2) + "</td>";
        html += "<td class='num'>" + oPrefix + om.areaFt2.toFixed(2) + "</td>";
      } else {
        html += "<td class='num' colspan='2'>\u2014</td>";
      }
      html += "<td class='del-cell' data-poly-idx='" + orphans[o].polyIdx + "' title='Delete'>\u00D7</td></tr>";
    }
    html += "</tbody></table>";
  }

  // Undo hint
  html += "<div class='measure-hint'>";
  html += "<span class='key-hint'>\u2318Z</span> Undo &nbsp;";
  html += "<span class='key-hint'>Del</span> Delete last &nbsp;";
  html += "<span class='key-hint'>Esc</span> Cancel";
  html += "</div>";

  els.measurePanel.innerHTML = html;

  // Bind expand/collapse toggles
  var toggles = els.measurePanel.querySelectorAll(".wall-toggle");
  for (var t = 0; t < toggles.length; t++) {
    toggles[t].addEventListener("click", function (e) {
      e.stopPropagation(); // don't trigger label edit
      var wallIdx = this.dataset.wallIdx;
      var expanded = this.dataset.expanded === "1";
      this.dataset.expanded = expanded ? "0" : "1";
      this.textContent = expanded ? "\u25B6" : "\u25BC";
      var details = els.measurePanel.querySelectorAll(".detail-row[data-parent='" + wallIdx + "']");
      for (var d = 0; d < details.length; d++) {
        details[d].style.display = expanded ? "none" : "table-row";
      }
    });
  }

  // Bind click-to-rename on label cells
  var labelCells = els.measurePanel.querySelectorAll(".label-cell");
  for (var lc = 0; lc < labelCells.length; lc++) {
    labelCells[lc].addEventListener("click", function (e) {
      _startLabelEdit(this, parseInt(this.dataset.polyIdx, 10));
    });
  }

  // Bind delete buttons
  var delCells = els.measurePanel.querySelectorAll(".del-cell");
  for (var dc = 0; dc < delCells.length; dc++) {
    delCells[dc].addEventListener("click", function (e) {
      var idx = parseInt(this.dataset.polyIdx, 10);
      PolygonTool.deletePolygon(_currentPage, idx);
      ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
      _refreshMeasurements();
      Viewer.requestRedraw();
      setStatus("Measurement deleted", "ready");
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

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      _refreshMeasurements();
    }
  });
  input.addEventListener("blur", commit);
}

/* ── Status bar ───────────────────────────────────────── */

function setStatus(msg, type) {
  els.statusBar.textContent = msg;
  els.statusBar.className = "status-bar" + (type ? " status-" + type : "");
}

/* ── Auto-detect building outline ──────────────────────── */

var _detectCandidates = []; // cached candidates from last detect
var _detectIndex = 0; // which candidate we're showing

function autoDetect() {
  if (!Loader.isLoaded()) return;

  // If we already scanned this page, cycle through candidates or bail
  if (_detectCandidates._page === _currentPage) {
    if (_detectCandidates.length > 0) {
      _detectIndex = (_detectIndex + 1) % _detectCandidates.length;
      _placeDetectedOutline(_detectCandidates[_detectIndex], _detectIndex, _detectCandidates.length);
    } else {
      setStatus(
        "No vector geometry on this page. This may be a scanned/raster PDF — use manual measurement (M/R).",
        "error"
      );
    }
    return;
  }

  setStatus("Scanning vector geometry...", "busy");

  VectorSnap.extractGeometry(_currentPage).then(function (geo) {
    return Loader.getPageSize(_currentPage).then(function (size) {
      var candidates = VectorSnap.getClosedPathsByArea(_currentPage, size.width, size.height);
      candidates._page = _currentPage;
      _detectCandidates = candidates;
      _detectIndex = 0;

      // Log diagnostics
      console.log(
        "[Auto-detect] Page " +
          _currentPage +
          ": " +
          geo.segments.length +
          " line segments, " +
          geo.endpoints.length +
          " endpoints, " +
          geo.closedPaths.length +
          " closed paths total, " +
          candidates.length +
          " candidates (filtered by area)"
      );

      if (candidates.length > 0) {
        for (var i = 0; i < Math.min(candidates.length, 5); i++) {
          var areaM2 = ScaleManager.pdfAreaToM2(_currentPage, candidates[i].area);
          console.log(
            "  Candidate " +
              (i + 1) +
              ": " +
              candidates[i].path.length +
              " vertices, " +
              (areaM2 ? areaM2.toFixed(1) + " m²" : "uncalibrated")
          );
        }
        _placeDetectedOutline(candidates[0], 0, candidates.length);
      } else if (geo.segments.length === 0) {
        // No vector geometry at all — likely a scanned/raster PDF
        setStatus(
          "No vector data found — this appears to be a scanned/raster PDF. Use manual measurement (M or R).",
          "error"
        );
        console.log("[Auto-detect] Page has zero vector geometry. This is a raster/scanned PDF.");
      } else {
        setStatus(
          "No closed outlines found (" +
            geo.segments.length +
            " line segments, but no closed shapes). Use manual measurement (M or R).",
          "error"
        );
        console.log(
          "[Auto-detect] " +
            geo.segments.length +
            " segments, " +
            geo.closedPaths.length +
            " closed paths (likely hatching/fills). " +
            "Building walls drawn as individual segments, not closed polylines."
        );
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
  if (verts.length > 1)
    console.log(
      "  Last vertex: (" + verts[verts.length - 1].x.toFixed(1) + ", " + verts[verts.length - 1].y.toFixed(1) + ")"
    );

  // Log what pdfToCanvas would produce for the first vertex
  var testCanvas = Viewer.pdfToCanvas(verts[0]);
  console.log("  First vertex in canvas px: (" + testCanvas.x.toFixed(1) + ", " + testCanvas.y.toFixed(1) + ")");
  console.log(
    "  Canvas size: " + document.getElementById("pdf-canvas").width + "x" + document.getElementById("pdf-canvas").height
  );

  PolygonTool.startPolygon(_currentPage, "Detected " + (idx + 1) + "/" + total);
  for (var j = 0; j < verts.length; j++) {
    PolygonTool.addVertex({ x: verts[j].x, y: verts[j].y });
  }
  PolygonTool.closePolygon();

  _refreshMeasurements();
  ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
  Viewer.requestRedraw();

  var areaM2 = ScaleManager.pdfAreaToM2(_currentPage, candidate.area);
  var areaStr = areaM2 !== null ? areaM2.toFixed(1) + " m\u00B2" : "(uncalibrated)";
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
  goToPage: goToPage,
  nextPage: nextPage,
  prevPage: prevPage,
  zoomIn: function () {
    Viewer.zoomIn();
  },
  zoomOut: function () {
    Viewer.zoomOut();
  },
  zoomFit: function () {
    Viewer.zoomFit();
  },
  exportCSV: exportCSV,
  exportJSON: exportJSON,
  // Scale panel
  openScalePanel: openScalePanel,
  closeScalePanel: closeScalePanel,
  setScaleSystem: setScaleSystem,
  acceptScale: acceptScale,
  verifyScale: verifyScale,
  closeScaleFeedback: closeScaleFeedback,
  // Measure method
  setMeasureMethod: setMeasureMethod,
  setWindowMode: setWindowMode,
  // Auto-detect
  autoDetect: autoDetect,
  // Sample
  loadSample: loadSample
};

/* ── Boot ─────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", init);
