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
import { extractDimensions } from "./dim-extract.mjs";
import { classifyLayers, shrinkWrapBuilding } from "./shrink-wrap.mjs";
import * as ScheduleParser from "./schedule-parser.mjs";
import * as ProjectStore from "./project-store.mjs";
import * as IDBStore from "./shared/indexed-db-store.mjs";

/* ── DOM refs ─────────────────────────────────────────── */

var els = {};
var _currentPage = 0;
var _currentTool = "navigate";
var _measureMethod = "rectangle"; // "polygon" or "rectangle"
var _windowMode = "net"; // "net" or "add"
// Phase 4b.1 — bridge metadata selected at draw time. Stamped onto each
// new polygon's record via opts in startPolygon. Null when not classified.
var _componentTag = null;
var _assemblyPreset = null;
var _calibPoint1 = null;
var _rectStart = null; // first corner for bounding rectangle
var _rectCurrent = null; // live cursor position for rubber-band preview
var _snapTarget = null; // current snap indicator {x, y, type}
var _rulerStart = null; // first point for ruler/calibrate rubber-band
var _rulerCurrent = null; // live cursor position for ruler preview

// Persistent ruler lines per page: _rulers[pageNum] = [{p1, p2, pdfLength, lengthM}, ...]
var _rulers = {};
var _nextRulerId = 1;

// Ruler undo/redo
var _rulerUndoStack = [];
var _rulerRedoStack = [];

function _pushRulerUndo(pageNum) {
  var rulers = _rulers[pageNum] || [];
  _rulerUndoStack.push({ pageNum: pageNum, snapshot: JSON.parse(JSON.stringify(rulers)) });
  _rulerRedoStack = [];
  if (_rulerUndoStack.length > 50) _rulerUndoStack.shift();
}

function _undoRuler() {
  if (_rulerUndoStack.length === 0) return false;
  var entry = _rulerUndoStack.pop();
  _rulerRedoStack.push({ pageNum: entry.pageNum, snapshot: JSON.parse(JSON.stringify(_rulers[entry.pageNum] || [])) });
  _rulers[entry.pageNum] = entry.snapshot;
  return entry.pageNum;
}

function _redoRuler() {
  if (_rulerRedoStack.length === 0) return false;
  var entry = _rulerRedoStack.pop();
  _rulerUndoStack.push({ pageNum: entry.pageNum, snapshot: JSON.parse(JSON.stringify(_rulers[entry.pageNum] || [])) });
  _rulers[entry.pageNum] = entry.snapshot;
  return entry.pageNum;
}

// Unified undo history — tracks order of polygon vs ruler actions
var _undoOrder = []; // "polygon" | "ruler"
var _redoOrder = [];

/* ── Boot ─────────────────────────────────────────────── */

function init() {
  console.log("[PDF-Parser] Booting v" + VERSION);

  els.fileInput = document.getElementById("file-input");
  els.dropZone = document.getElementById("drop-zone");
  els.viewerWrap = document.getElementById("viewer-wrap");
  els.thumbStrip = document.getElementById("thumb-strip");
  els.sheetInfo = document.getElementById("sheet-info");
  els.measurePanel = document.getElementById("measure-panel");
  els.paramsPanel = document.getElementById("params-panel");
  els.statusBar = document.getElementById("status-bar");
  els.zoomLabel = document.getElementById("zoom-label");
  els.scaleLabel = document.getElementById("scale-label");
  els.pageLabel = document.getElementById("page-label");
  els.toolBtns = document.querySelectorAll(".tool-btn");

  Viewer.init("viewer-container", "pdf-canvas", "overlay-canvas");

  // Sheet deep-link: listen for hash changes so the same Parser tab can be
  // re-targeted by successive BEAMweb sheet clicks (target="pdf-parser-tab").
  window.addEventListener("hashchange", function () {
    _applySheetHash();
  });
  Viewer.setDrawCallback(function (ctx, pageNum) {
    PolygonTool.draw(ctx, pageNum);
    _drawRulers(ctx, pageNum);
    _drawRulerPreview(ctx);
    _drawRectPreview(ctx);
    _drawSnapIndicator(ctx);
  });
  Viewer.onOverlayClick(_handleOverlayClick);
  Viewer.onOverlayMouseMove(_handleOverlayMouseMove);

  // Track polygon undo pushes in the unified undo order
  PolygonTool.onUndoPush(function () {
    _undoOrder.push("polygon");
    _redoOrder = [];
  });

  _bindFileInput();
  _bindJsonImport();
  _bindToolbar();
  _bindKeyboard();

  // Sync the component-tag select with the starting tool (navigate ⇒ hidden).
  _rebuildComponentTagSelect();
  _renderParamsPanel();

  setStatus("Ready — drop a PDF or click Browse", "ready");
  console.log("[PDF-Parser] Ready");

  // Attempt to restore the most recent session from IndexedDB. Silent no-op
  // if nothing is persisted yet. Status message updates on success.
  _tryRestoreLastSession().then(function (restored) {
    if (!restored) return;
    console.log("[PDF-Parser] Restore initiated from IndexedDB");
  });
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
  // Source lives at docs/sample.pdf; staged into data/sample.pdf by
  // `npm run stage:data` locally and by the Pages deploy workflow.
  fetch("data/sample.pdf")
    .then(function (resp) {
      if (!resp.ok)
        throw new Error(
          "Could not fetch sample.pdf (" + resp.status + "). Run `npm run stage:data` to copy the fixture into data/."
        );
      return resp.arrayBuffer();
    })
    .then(function (buffer) {
      loadPdf(buffer, "Calgary-DP-BP-new-home-sample-drawings.pdf");
    })
    .catch(function (err) {
      setStatus("Error: " + err.message, "error");
    });
}

function loadPdf(buffer, fileName, opts) {
  opts = opts || {};
  console.log("[PDF-Parser] Loading:", fileName, "(" + (buffer.byteLength / 1048576).toFixed(1) + " MB)");

  Loader.reset();
  PolygonTool.reset();
  ScaleManager.reset();
  VectorSnap.reset();
  ProjectStore.reset();
  _rulers = {};
  _rulerUndoStack = [];
  _rulerRedoStack = [];
  _undoOrder = [];
  _redoOrder = [];
  _nextRulerId = 1;

  var loadingOverlay = document.getElementById("loading-overlay");
  var loadingBar = document.getElementById("loading-bar-fill");
  var loadingLabel = document.getElementById("loading-label");

  Loader.loadFromBuffer(buffer)
    .then(function (result) {
      console.log("[PDF-Parser] Loaded:", result.pageCount, "pages");
      ProjectStore.initFromPdf(fileName, result.pageCount);
      // Persist PDF bytes for cross-session restore — skipped in the restore
      // path since the bytes are already in IndexedDB.
      if (!opts.skipBlobPersist) {
        var pdfBlob = new Blob([buffer], { type: "application/pdf" });
        ProjectStore.setPdfBytes(pdfBlob).catch(function (err) {
          console.warn("[PDF-Parser] PDF blob persistence failed:", err);
        });
      }

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

            // Restore path — overlay the saved project on top of the fresh
            // init + classify that just ran. restoreProject replaces the
            // ProjectStore payload; _hydrateFromProjectData also loads
            // polygons, calibrations, and rulers into the live modules.
            var restored = null;
            if (opts.restoreData) {
              restored = _hydrateFromProjectData(opts.restoreData, result.pageCount);
              _updateThumbnailLabels(
                ProjectStore.getProject().pages.map(function (p) {
                  return { pageNum: p.pageNum, sheetId: p.sheetId, sheetTitle: p.sheetTitle };
                })
              );
            }

            // Hide loading, show viewer
            loadingOverlay.style.display = "none";
            els.viewerWrap.style.display = "";

            if (restored) {
              setStatus(
                "Session restored — " +
                  restored.areas +
                  " areas, " +
                  restored.windows +
                  " windows, " +
                  restored.rulers +
                  " rulers",
                "ready"
              );
            } else {
              setStatus("Found " + planCount + " plan sheets. Press S to confirm scale.", "ready");
            }
            // Refresh the geometry-params panel so restored project.params
            // populate (or fresh inits clear) the sidebar inputs.
            _renderParamsPanel();
            // If the URL was opened with #sheet=X, jump to that sheet.
            // Otherwise start on page 1. Hashchange listener (wired in init)
            // handles subsequent mid-session navigation.
            if (!_applySheetHash()) goToPage(1);

            // Re-enable autosave after the restore dust has settled.
            if (opts.restoreData) ProjectStore.resumeAutosave();

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
      if (opts.restoreData) ProjectStore.resumeAutosave();
    });
}

// Auto-restore the most-recently-touched session from IndexedDB. Returns a
// Promise<boolean> — true if a restore was kicked off, false if nothing to
// restore (or restore was declined). Restore reuses loadPdf's render pipeline
// so calibrations, classifications, and polygons all flow through the same
// code path the JSON importer already exercises.
function _tryRestoreLastSession() {
  return IDBStore.listProjects()
    .then(function (projects) {
      if (!projects || projects.length === 0) return false;
      var latest = projects[0];
      if (!latest.projectJson || !latest.projectJson.pages) return false;
      return IDBStore.getPdfBytes(latest.uuid).then(function (blob) {
        // Missing or zero-byte blob = corrupt / never-persisted state. Don't
        // hand pdfjs an empty buffer (it throws InvalidPDFException and the
        // console lights up on every boot). Silently skip and drop the
        // orphan record so we don't retry it next session.
        if (!blob || blob.size === 0) {
          if (blob && blob.size === 0) {
            IDBStore.deleteProject(latest.uuid).catch(function () {
              /* best-effort cleanup */
            });
          }
          return false;
        }
        setStatus("Restoring " + latest.pdfFileName + "\u2026", "busy");
        ProjectStore.pauseAutosave();
        return blob.arrayBuffer().then(function (buffer) {
          loadPdf(buffer, latest.pdfFileName, {
            skipBlobPersist: true,
            restoreData: latest.projectJson
          });
          return true;
        });
      });
    })
    .catch(function (err) {
      console.warn("[PDF-Parser] restore failed:", err);
      return false;
    });
}

/* ── Navigation ───────────────────────────────────────── */

/**
 * Find the first page whose sheetId matches. Returns pageNum or null.
 * Used by the sheet-deep-link protocol (#sheet=A-301 URL fragment).
 */
function _findPageBySheetId(sheetId) {
  var project = ProjectStore.getProject();
  if (!project || !project.pages) return null;
  for (var i = 0; i < project.pages.length; i++) {
    if (project.pages[i].sheetId === sheetId) {
      return project.pages[i].pageNum;
    }
  }
  return null;
}

/**
 * Read the URL hash. If it encodes #sheet=X, jump to the page whose
 * sheetId matches. Returns true if we navigated, false if the hash was
 * absent or did not resolve. BEAMweb's Import modal + fidelity badges
 * emit these links with target="pdf-parser-tab" so subsequent clicks
 * reuse the same Parser tab rather than spawning new ones.
 */
function _applySheetHash() {
  var hash = (window.location.hash || "").replace(/^#/, "");
  if (!hash) return false;
  var m = /(?:^|&)sheet=([^&]+)/.exec(hash);
  if (!m) return false;
  var targetSheet = decodeURIComponent(m[1]);
  var pageNum = _findPageBySheetId(targetSheet);
  if (!pageNum) {
    setStatus('Sheet "' + targetSheet + '" not found in the loaded drawing set.', "error");
    return false;
  }
  goToPage(pageNum);
  setStatus("Jumped to sheet " + targetSheet + " (page " + pageNum + ").", "ready");
  return true;
}

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

  // Tools that own their click: don't hijack to edit an adjacent polygon.
  // Polyline so interior walls drawn up to a slab edge don't drag/insert
  // vertices on the slab. Ruler so a ruler endpoint landing inside a
  // polygon edge's hit zone plants the endpoint instead of mutating the
  // polygon. Calibrate for the same reason — a user who calibrates after
  // areas have been drawn (rare but real) shouldn't modify geometry.
  var skipsPolygonEdit = _currentTool === "polyline" || _currentTool === "ruler" || _currentTool === "calibrate";

  // Priority 1: Click near an existing vertex — start drag
  var hit = PolygonTool.hitTestVertex(_currentPage, pt, hitRadius);
  if (hit && !PolygonTool.isDrawing() && !skipsPolygonEdit) {
    PolygonTool.startDrag(_currentPage, hit.polyIdx, hit.vertIdx);
    Viewer.onOverlayMouseMove(_handleDragMove);
    _bindDragEnd();
    var wrap = document.getElementById("viewer-wrap");
    if (wrap) wrap.style.cursor = "move";
    return;
  }

  // Priority 2: Click near an edge.
  //  - If the polygon carries shrink-wrap candidates AND the edge is
  //    orthogonal AND the user is NOT holding Option/Alt, drag the whole
  //    edge perpendicular to itself; release snaps to the nearest wall-
  //    candidate detent (C7b).
  //  - Option/Alt-click is the explicit opt-out: falls through to the
  //    legacy insert-vertex path. Needed when the user wants to capture
  //    a jog in the wall rather than nudge the whole edge. C7c will
  //    surface this via an ArchiCad-style popup instead of a modifier.
  //  - Non-orthogonal edges and hand-drawn polygons always use the
  //    insert-vertex path.
  var edgeHit = PolygonTool.hitTestEdge(_currentPage, pt, hitRadius);
  if (edgeHit && !PolygonTool.isDrawing() && !skipsPolygonEdit) {
    var polysForEdge = PolygonTool.getPolygons(_currentPage);
    var edgePoly = polysForEdge[edgeHit.polyIdx];
    var orient = PolygonTool.edgeOrientation(edgePoly, edgeHit.edgeIdx);
    var hasCandidates = !!(edgePoly && edgePoly._shrinkCandidates);
    if (orient && hasCandidates && !e.altKey) {
      if (PolygonTool.startEdgeDrag(_currentPage, edgeHit.polyIdx, edgeHit.edgeIdx)) {
        Viewer.onOverlayMouseMove(_handleDragMove);
        _bindDragEnd();
        Viewer.requestRedraw();
        var wrap3 = document.getElementById("viewer-wrap");
        if (wrap3) wrap3.style.cursor = orient === "horizontal" ? "ns-resize" : "ew-resize";
        return;
      }
    }
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
  else if (_currentTool === "polyline") _handlePolylineClick(pt);
  else if (_currentTool === "calibrate") _handleCalibrateClick(pt);
  else if (_currentTool === "ruler") _handleRulerClick(pt);
}

function _handleDragMove(e) {
  var pt = Viewer.eventToPdfCoords(e);

  if (PolygonTool.isEdgeDragging()) {
    // Edge drag has no vector-snap overlay — it follows the pointer
    // freely and snaps to wall-candidate detents on release only.
    PolygonTool.moveEdgeDrag(pt);
    Viewer.requestRedraw();
    return;
  }

  if (!PolygonTool.isDragging()) return;
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
    var wrap = document.getElementById("viewer-wrap");
    var cursorMap = {
      measure: "crosshair",
      window: "crosshair",
      calibrate: "crosshair",
      ruler: "crosshair",
      navigate: "default"
    };

    if (PolygonTool.isEdgeDragging()) {
      var snap = PolygonTool.endEdgeDrag();
      setStatus(snap.snapped ? "Edge snapped to wall candidate." : "Edge moved.", "ready");
      _snapTarget = null;
      Viewer.onOverlayMouseMove(_handleOverlayMouseMove);
      if (wrap) wrap.style.cursor = cursorMap[_currentTool] || "default";
      _refreshMeasurements();
      ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
      Viewer.requestRedraw();
      return;
    }

    if (PolygonTool.isDragging()) {
      var mergeRadius = 10 / (Viewer.getZoom() * (150 / 72));
      var merged = PolygonTool.endDrag(mergeRadius);
      if (merged) setStatus("Vertices merged", "ready");
      _snapTarget = null; // clear snap indicator
      Viewer.onOverlayMouseMove(_handleOverlayMouseMove);
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

/* ── Phase 4b.1 — Component tag + assembly preset ────── */

// Options per tool — aligned to the bridge spec component taxonomy
// (docs/workplans/PDF-BEAMweb-BRIDGE.md §3.2). Tags drive which BEAMweb
// dim fields a polygon feeds via js/shared/polygon-map.mjs.
var COMPONENT_OPTIONS = {
  measure: [
    { value: "", label: "(no tag)" },
    // Elevation sheets — surface-area tags
    { value: "wall_exterior", label: "Wall — exterior (elevation)" },
    { value: "wall_party", label: "Wall — party / demising (elevation)" },
    // Plan sheets — area tags
    { value: "slab_foundation", label: "Slab — foundation (plan)" },
    { value: "slab_above_grade", label: "Slab — above-grade (plan)" },
    { value: "exterior_perimeter", label: "Exterior perimeter (plan)" },
    { value: "pad_pier", label: "Pad / pier (plan)" },
    { value: "roof_plan", label: "Roof — plan area" },
    { value: "roof_cavity", label: "Roof cavity insulation (plan)" },
    // Informational — not mapped to a BEAMweb dim
    { value: "footprint", label: "Building footprint (reference)" },
    { value: "site_area", label: "Site area (reference)" },
    { value: "building_envelope", label: "Building envelope (reference)" }
  ],
  polyline: [
    { value: "", label: "(no tag)" },
    { value: "wall_interior", label: "Wall — interior" },
    { value: "footing_interior", label: "Footing — interior" }
  ]
};

// Component tags where an assembly preset is meaningful — wall assemblies
// carry cladding + insulation + framing mixes that seed the downstream
// BEAMweb Phase 4 assembly tabs. Slabs, roofs, and footings take their
// material spec from the consuming tab, not from the polygon.
var ASSEMBLY_COMPONENTS = {
  wall_exterior: true,
  wall_party: true,
  wall_interior: true,
  exterior_perimeter: true
};

// Geometry parameters — scalars that lift polygon measurements into BEAMweb
// dimensions (wall height × perimeter → area, etc.). Field IDs match the
// param_* names on BEAMweb's PROJECT tab so the values round-trip via the
// bridge. Stored on the Parser's project.params in IndexedDB.
var GEOMETRY_PARAMS = [
  { id: "param_wall_height_m", label: "Wall Height", unit: "m", step: 0.01 },
  { id: "param_basement_height_m", label: "Basement Height", unit: "m", step: 0.01 },
  { id: "param_roof_pitch_deg", label: "Roof Pitch", unit: "\u00b0", step: 0.5 },
  { id: "param_footing_height_m", label: "Footing Height", unit: "m", step: 0.01 },
  { id: "param_footing_width_m", label: "Footing Width", unit: "m", step: 0.01 }
];

// Render the Geometry Parameters panel in the sidebar. Values persist via
// ProjectStore.setParam → project.params → IndexedDB (where BEAMweb picks
// them up as a fallback when its own StateManager param_* are blank).
function _renderParamsPanel() {
  if (!els.paramsPanel) return;
  var html = '<div class="pdf-params-header">Geometry Parameters</div>';
  html +=
    '<div class="pdf-params-hint">Fed to BEAMweb on import \u2014 lifts perimeters \u2192 areas + areas \u2192 volumes.</div>';
  html += '<div class="pdf-params-rows">';
  for (var i = 0; i < GEOMETRY_PARAMS.length; i++) {
    var p = GEOMETRY_PARAMS[i];
    var current = ProjectStore.getParam(p.id);
    var val = current != null ? current : "";
    html +=
      '<div class="pdf-params-row">' +
      '<label class="pdf-params-label" for="pdf-param-' +
      p.id +
      '">' +
      p.label +
      "</label>" +
      '<input class="pdf-params-input" id="pdf-param-' +
      p.id +
      '" type="number" step="' +
      p.step +
      '" value="' +
      val +
      '" data-param-key="' +
      p.id +
      '" />' +
      '<span class="pdf-params-unit">' +
      p.unit +
      "</span>" +
      "</div>";
  }
  html += "</div>";
  els.paramsPanel.innerHTML = html;

  var inputs = els.paramsPanel.querySelectorAll(".pdf-params-input");
  for (var j = 0; j < inputs.length; j++) {
    inputs[j].addEventListener("change", function () {
      ProjectStore.setParam(this.dataset.paramKey, this.value);
    });
  }
}

function _rebuildComponentTagSelect() {
  var sel = document.getElementById("component-tag");
  if (!sel) return;
  var opts = COMPONENT_OPTIONS[_currentTool];
  if (!opts) {
    sel.style.display = "none";
    document.getElementById("assembly-preset").style.display = "none";
    return;
  }
  sel.style.display = "";
  sel.innerHTML = "";
  for (var i = 0; i < opts.length; i++) {
    var o = document.createElement("option");
    o.value = opts[i].value;
    o.textContent = opts[i].label;
    sel.appendChild(o);
  }
  // Preserve the user's selection if still valid under the new tool.
  var keep = false;
  for (var j = 0; j < opts.length; j++) {
    if (opts[j].value === _componentTag) {
      keep = true;
      break;
    }
  }
  if (!keep) _componentTag = null;
  sel.value = _componentTag || "";
  _updateAssemblyPresetVisibility();
}

function _updateAssemblyPresetVisibility() {
  var presetSel = document.getElementById("assembly-preset");
  if (!presetSel) return;
  presetSel.style.display = _componentTag && ASSEMBLY_COMPONENTS[_componentTag] ? "" : "none";
}

function setComponentTag(value) {
  _componentTag = value || null;
  _updateAssemblyPresetVisibility();
}

function setAssemblyPreset(value) {
  _assemblyPreset = value || null;
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
  var opts = { type: "area", component: _componentTag, assembly_preset: _assemblyPreset };
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
  // Window tool auto-tags as window_opening — the component picker is scoped
  // to measure/polyline tools where classification is ambiguous.
  var opts = { type: "window", mode: _windowMode, component: "window_opening" };
  if (_measureMethod === "rectangle") {
    _handleGenericRectangleClick(pt, opts);
  } else {
    _handleGenericPolygonClick(pt, opts);
  }
}

function _handlePolylineClick(pt) {
  if (!ScaleManager.isCalibrated(_currentPage) && !PolygonTool.isDrawing()) {
    setStatus("No confirmed scale. Press S to set scale first, or measurements will be uncalibrated.", "error");
  }
  var opts = { type: "polyline", component: _componentTag, assembly_preset: _assemblyPreset };
  // Polylines are open paths — reuse polygon-click flow but closePolygon()
  // terminates at the double-click (enter key) rather than snapping to first vertex.
  if (!PolygonTool.isDrawing()) {
    PolygonTool.startPolygon(_currentPage, null, opts);
    PolygonTool.addVertex(pt);
    setStatus("Click vertices... press Enter or double-click to finish", "busy");
  } else {
    PolygonTool.addVertex(pt);
  }
  Viewer.requestRedraw();
}

function _onPolygonComplete(opts) {
  var type = opts && opts.type;
  var label = type === "window" ? "Window" : type === "polyline" ? "Polyline" : "Area";
  setStatus(label + " measured" + (ScaleManager.isCalibrated(_currentPage) ? "" : " (uncalibrated)"), "ready");
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
    _pushRulerUndo(_currentPage);
    _undoOrder.push("ruler");
    _redoOrder = [];
    _rulers[_currentPage].push({
      id: "ruler_" + _nextRulerId++,
      p1: p1,
      p2: p2,
      pdfLength: pdfLen,
      lengthM: lengthM
    });

    _rulerStart = null;
    _rulerCurrent = null;

    ProjectStore.saveRulers(_currentPage, _rulers[_currentPage]);

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

  // Show contextual cursor when hovering near draggable geometry — but not
  // while the polyline tool is active, since that tool ignores drag-edit
  // hit-tests (see _handleOverlayClick). Showing the move/cell cursor there
  // would mislead the user.
  //
  // Cursor vocabulary (C7a):
  //   move      — over a vertex (drag vertex)
  //   ew-resize — over a vertical orthogonal edge of a shrink-wrap polygon (edge-drag, x-axis)
  //   ns-resize — over a horizontal orthogonal edge of a shrink-wrap polygon (edge-drag, y-axis)
  //   cell      — over any edge without an edge-drag affordance, or when
  //               Option/Alt is held (explicit opt-out into insert-vertex mode)
  var altHeld = !!(e && e.altKey);
  var wrap = document.getElementById("viewer-wrap");
  if (!PolygonTool.isDrawing() && !_rectStart && _currentTool !== "polyline") {
    var vertHit = PolygonTool.hitTestVertex(_currentPage, pt, hitRadius);
    if (vertHit) {
      if (wrap) wrap.style.cursor = "move";
      return;
    }
    var edgeHit = PolygonTool.hitTestEdge(_currentPage, pt, hitRadius);
    if (edgeHit) {
      var polysForHover = PolygonTool.getPolygons(_currentPage);
      var hoverPoly = polysForHover[edgeHit.polyIdx];
      var hoverOrient = PolygonTool.edgeOrientation(hoverPoly, edgeHit.edgeIdx);
      var hoverHasCands = !!(hoverPoly && hoverPoly._shrinkCandidates);
      if (hoverOrient && hoverHasCands && !altHeld) {
        if (wrap) wrap.style.cursor = hoverOrient === "horizontal" ? "ns-resize" : "ew-resize";
      } else if (wrap) {
        wrap.style.cursor = "cell";
      }
      return;
    }
  }
  var cursorMap = {
    measure: "crosshair",
    window: "crosshair",
    polyline: "crosshair",
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
    polyline: "crosshair",
    calibrate: "crosshair",
    ruler: "crosshair",
    navigate: "default"
  };
  var wrap = document.getElementById("viewer-wrap");
  if (wrap) wrap.style.cursor = cursorMap[tool] || "default";
  // Repopulate the component-tag options for the new tool (measure vs polyline
  // have different taxonomies; other tools hide the selects entirely).
  _rebuildComponentTagSelect();
}

/* ── Keyboard ─────────────────────────────────────────── */

function _bindKeyboard() {
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    // Undo: Cmd+Z / Ctrl+Z — unified polygon + ruler undo
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      if (_undoOrder.length > 0) {
        var lastType = _undoOrder.pop();
        _redoOrder.push(lastType);
        if (lastType === "ruler") {
          var rulerPg = _undoRuler();
          if (rulerPg !== false) ProjectStore.saveRulers(rulerPg, _rulers[rulerPg] || []);
          Viewer.requestRedraw();
          setStatus("Undo ruler", "ready");
        } else {
          PolygonTool.undo();
          _refreshMeasurements();
          Viewer.requestRedraw();
          setStatus("Undo", "ready");
        }
      }
      return;
    }
    // Redo: Cmd+Shift+Z / Ctrl+Shift+Z — unified
    if ((e.metaKey || e.ctrlKey) && e.key === "z" && e.shiftKey) {
      e.preventDefault();
      if (_redoOrder.length > 0) {
        var lastType2 = _redoOrder.pop();
        _undoOrder.push(lastType2);
        if (lastType2 === "ruler") {
          var redoPg = _redoRuler();
          if (redoPg !== false) ProjectStore.saveRulers(redoPg, _rulers[redoPg] || []);
          Viewer.requestRedraw();
          setStatus("Redo ruler", "ready");
        } else {
          PolygonTool.redo();
          _refreshMeasurements();
          Viewer.requestRedraw();
          setStatus("Redo", "ready");
        }
      }
      return;
    }

    switch (e.key) {
      case "Enter":
        // Finalize in-progress polyline. Polylines don't auto-close on
        // first-vertex snap like polygons, so they need an explicit end key.
        if (PolygonTool.isDrawing() && _currentTool === "polyline") {
          PolygonTool.closePolygon();
          _onPolygonComplete({ type: "polyline" });
          Viewer.requestRedraw();
        }
        break;
      case "Escape":
        // Cascade: cancel the most immediate in-progress action
        // 0a. Summary table open? Close it.
        if (document.getElementById("summary-panel").classList.contains("visible")) {
          closeSummaryTable();
          break;
        }
        // 0b. Scale feedback dialogue open? Close it.
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
        // Shift+Delete: clear all rulers on current page
        if (e.shiftKey && _rulers[_currentPage] && _rulers[_currentPage].length > 0) {
          _pushRulerUndo(_currentPage);
          _undoOrder.push("ruler");
          _redoOrder = [];
          var count = _rulers[_currentPage].length;
          _rulers[_currentPage] = [];
          ProjectStore.saveRulers(_currentPage, []);
          Viewer.requestRedraw();
          setStatus(count + " ruler" + (count > 1 ? "s" : "") + " cleared", "ready");
          break;
        }
        // Delete last ruler if in ruler mode, otherwise last polygon
        if (_currentTool === "ruler" && _rulers[_currentPage] && _rulers[_currentPage].length > 0) {
          _pushRulerUndo(_currentPage);
          _undoOrder.push("ruler");
          _redoOrder = [];
          _rulers[_currentPage].pop();
          ProjectStore.saveRulers(_currentPage, _rulers[_currentPage]);
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
      case "a":
        autoCalibrate();
        break;
      case "o":
        tightenOculus();
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
      case "p":
        setTool("polyline");
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

  // Polylines — collected separately since they have length-only measurements.
  var allMeas = PolygonTool.getAllMeasurements(_currentPage);
  var polylines = [];
  var allPolys = PolygonTool.getPolygons(_currentPage);
  for (var pi = 0; pi < allMeas.length; pi++) {
    if (allMeas[pi].type === "polyline") {
      // Find the raw array index for delete/rename wiring.
      for (var pj = 0; pj < allPolys.length; pj++) {
        if (allPolys[pj].id === allMeas[pi].id) {
          polylines.push({ measurement: allMeas[pi], polyIdx: pj });
          break;
        }
      }
    }
  }

  if (walls.length === 0 && orphans.length === 0 && polylines.length === 0) {
    els.measurePanel.innerHTML =
      "<p class='empty'>No measurements on this page.<br><span style='font-size:10px;color:var(--text-dim);'>Press <b>M</b> to measure areas, <b>W</b> for windows, <b>P</b> for polylines.</span></p>";
    return;
  }

  var hasScale =
    (walls.length > 0 && walls[0].measurement.calibrated) ||
    (orphans.length > 0 && orphans[0].measurement.calibrated) ||
    (polylines.length > 0 && polylines[0].measurement.calibrated);
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

  // ── Polylines (linear features — interior walls, interior footings) ──
  if (polylines.length > 0) {
    html += "<div class='measure-header' style='margin-top:8px;color:#e63946;'>Polylines</div>";
    html += "<table><thead><tr><th>Label</th>";
    if (hasScale) {
      html += "<th>m</th><th>ft</th>";
    } else {
      html += "<th colspan='2' style='color:var(--gold);font-size:10px;'>No scale</th>";
    }
    html += "<th></th></tr></thead><tbody>";
    for (var pk = 0; pk < polylines.length; pk++) {
      var pm = polylines[pk].measurement;
      html += "<tr style='color:#e63946;'>";
      html +=
        "<td class='label-cell' data-poly-idx='" +
        polylines[pk].polyIdx +
        "' title='Click to rename'>" +
        pm.label +
        "</td>";
      if (hasScale && pm.lengthM !== null) {
        html += "<td class='num'>" + pm.lengthM.toFixed(2) + "</td>";
        html += "<td class='num'>" + pm.lengthFt.toFixed(2) + "</td>";
      } else {
        html += "<td class='num' colspan='2'>\u2014</td>";
      }
      html += "<td class='del-cell' data-poly-idx='" + polylines[pk].polyIdx + "' title='Delete'>\u00D7</td></tr>";
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

// MAGIC.md C4 — sheet-scope filter. Wand (autoDetect) and
// auto-calibrate only run on sheets classified as plan or elevation.
// Sections use the ruler tool for F2F / F2C heights (no fill capture).
// Sites / details / title sheets: manual measurement only.
function _requireDrawingSheet(pageNum, actionLabel) {
  var page = ProjectStore.getPage(pageNum);
  var cls = page && page.classification;
  if (cls === "plan" || cls === "elevation") return true;
  var msg;
  if (cls === "section") {
    msg =
      actionLabel +
      " is disabled on section sheets — use the ruler (L) for F2F / F2C heights, or draw polygons manually (M).";
  } else if (cls === "site") {
    msg = actionLabel + " is disabled on site plans — use manual measurement (M or R).";
  } else {
    msg =
      actionLabel +
      ' runs on plan or elevation sheets only (this sheet is classified as "' +
      (cls || "other") +
      '"). Use manual measurement (M or R) instead.';
  }
  setStatus(msg, "error");
  return false;
}

function autoDetect() {
  if (!Loader.isLoaded()) return;
  if (!_requireDrawingSheet(_currentPage, "Auto-Detect")) return;

  setStatus("Finding building outline...", "busy");
  var pageNum = _currentPage;

  Promise.all([Loader.getTextContent(pageNum), VectorSnap.extractGeometry(pageNum), Loader.getPageSize(pageNum)]).then(
    function (results) {
      var textItems = results[0];
      var geo = results[1];
      var size = results[2];

      // Raster PDF with no vector geometry — bail early.
      if (geo.segments.length === 0) {
        setStatus(
          "No vector data found — this appears to be a scanned/raster PDF. Use manual measurement (M or R).",
          "error"
        );
        console.log("[Auto-detect] Page has zero vector geometry. Raster/scanned PDF.");
        return;
      }

      // Layer-peel (C4): separate sheet-border chaff from drawing geometry.
      var layers = classifyLayers(geo.segments, textItems, size.width, size.height);

      // Shrink-wrap (C5): find the building outline via parallel-pair wall
      // detection + 5-95 percentile trimming of wall positions.
      var wrap = shrinkWrapBuilding(layers.drawingSegments, layers.drawingAreaBbox);

      console.log(
        "[Auto-detect] Page " +
          pageNum +
          ": " +
          geo.segments.length +
          " segments, layer-peel → " +
          layers.summary.drawing +
          " drawing / " +
          layers.summary.pageBorder +
          " pageBorder, shrink-wrap → " +
          (wrap && wrap.polygon
            ? wrap.wallHorizCount + "H + " + wrap.wallVertCount + "V walls, 4-vertex polygon"
            : "FAILED (" + (wrap ? wrap.reason : "null") + ")")
      );

      if (wrap && wrap.polygon) {
        var polyArea = _polygonArea(wrap.polygon);
        var shrinkCandidates = {
          vert: wrap.wallVertPositions || [],
          horiz: wrap.wallHorizPositions || []
        };
        _placeDetectedOutline(
          { path: wrap.polygon, area: polyArea, shrinkCandidates: shrinkCandidates },
          0,
          1,
          textItems
        );
        return;
      }

      // Fallback — legacy closed-polygon detector (kept until shrink-wrap
      // proves itself in real use; then retire per MAGIC.md C5 discussion).
      var candidates = VectorSnap.getClosedPathsByArea(pageNum, size.width, size.height);
      if (candidates.length > 0) {
        _placeDetectedOutline(candidates[0], 0, 1, textItems);
        setStatus(
          "Shrink-wrap did not find wall pairs (" +
            (wrap ? wrap.reason : "no drawing segments") +
            "). Fell back to first closed-polygon candidate.",
          "ready"
        );
        return;
      }

      setStatus(
        "No building outline detected on this page. " +
          (wrap && wrap.reason ? "Shrink-wrap: " + wrap.reason + ". " : "") +
          "Use manual measurement (M or R).",
        "error"
      );
    }
  );
}

/**
 * C7d — Oculus: tighten the detected polygon on the current page one
 * step inward. Each orthogonal edge moves to its next candidate detent
 * toward the centroid; non-orthogonal edges and already-innermost edges
 * stay put. Runs on the first polygon that carries shrink-wrap
 * candidates (i.e. the Auto-Detect polygon).
 */
function tightenOculus() {
  if (!Loader.isLoaded()) return;
  var idx = PolygonTool.findDetectedPolyIdx(_currentPage);
  if (idx < 0) {
    setStatus("No Auto-Detect polygon on this page — press D to detect first.", "error");
    return;
  }
  var result = PolygonTool.tightenOneStep(_currentPage, idx);
  if (result.edgesMoved === 0) {
    setStatus("Oculus: nothing to tighten" + (result.reason ? " — " + result.reason : "") + ".", "ready");
    return;
  }
  _refreshMeasurements();
  ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
  Viewer.requestRedraw();
  var noun = result.edgesMoved === 1 ? "edge" : "edges";
  var tail = result.edgesSkipped > 0 ? " (" + result.edgesSkipped + " already at innermost)" : "";
  setStatus("Oculus: tightened " + result.edgesMoved + " " + noun + " inward one detent" + tail + ".", "ready");
}

function _polygonArea(pts) {
  var a = 0;
  for (var i = 0; i < pts.length; i++) {
    var p0 = pts[i];
    var p1 = pts[(i + 1) % pts.length];
    a += p0.x * p1.y - p1.x * p0.y;
  }
  return Math.abs(a) / 2;
}

function _placeDetectedOutline(candidate, idx, total, textItems) {
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

  // AT-2 / AT-3: auto-tag the placed polygon from the sheet's classification
  // + title keywords. Slab / roof / wall component tag + building/garage
  // scope + a wood-2x6 default preset for exterior walls. Fills in what
  // Andy calls "automated polygon data" so a user can click Auto-Detect
  // and immediately hand the result to the BEAMweb bridge without
  // additional manual tagging.
  var polysNow = PolygonTool.getPolygons(_currentPage);
  var newPolyIdx = polysNow.length - 1;
  var autoTag = _autoTagFromPage(_currentPage, textItems);
  if (newPolyIdx >= 0 && autoTag.component) {
    PolygonTool.setComponent(_currentPage, newPolyIdx, autoTag.component);
    if (autoTag.scope === "garage") {
      PolygonTool.setScope(_currentPage, newPolyIdx, "garage");
    }
    if (autoTag.preset) {
      PolygonTool.setAssemblyPreset(_currentPage, newPolyIdx, autoTag.preset);
    }
  }

  // C7 — attach wall-candidate arrays so subsequent edge-drag interactions
  // can snap through the shrink-wrap detents. Only present when the
  // polygon came from the shrink-wrap path (not the closed-polygon
  // fallback), so hand-edited polygons keep their legacy click-to-insert
  // behavior.
  if (newPolyIdx >= 0 && candidate.shrinkCandidates) {
    PolygonTool.setShrinkCandidates(_currentPage, newPolyIdx, candidate.shrinkCandidates);
  }

  _refreshMeasurements();
  ProjectStore.savePolygons(_currentPage, PolygonTool.getPolygons(_currentPage));
  Viewer.requestRedraw();

  // AT-1: switch to polygon-edit ("measure") mode so the user is in the
  // right context to refine the polygon — drag vertices today, drag edges
  // once C7 ships. Avoids the "D pressed, polygon appeared, now what?"
  // disorientation.
  setTool("measure");

  var areaM2 = ScaleManager.pdfAreaToM2(_currentPage, candidate.area);
  var areaStr = areaM2 !== null ? areaM2.toFixed(1) + " m\u00B2" : "(uncalibrated)";
  var hint = total > 1 ? " Press D again to cycle (" + (idx + 1) + "/" + total + ")." : "";
  var tagStr = "";
  if (autoTag && autoTag.component) {
    tagStr = " tagged " + autoTag.component;
    if (autoTag.scope === "garage") tagStr += " (garage)";
    if (autoTag.preset) tagStr += " · " + autoTag.preset;
    tagStr += ".";
  }
  setStatus("Outline: " + areaStr + ", " + verts.length + " vertices." + tagStr + hint, "ready");
}

/**
 * AT-2: derive the polygon's component tag + scope + assembly preset
 * from the page's sheet classification and title + page-text keywords.
 * Returns a `{component, scope, preset}` triple; any field may be null /
 * "building" default when classification doesn't resolve a specific value.
 *
 * Mapping table (MAGIC.md §0 AT prerequisites):
 *   plan + foundation       → slab_foundation,    building|garage, no preset
 *   plan + roof             → roof_plan,          building|garage, no preset
 *   plan + main/upper/...   → slab_above_grade,   building|garage, no preset
 *   elevation               → wall_exterior,      building|garage, wood_2x6
 *   "garage" text on page   → scope = "garage" regardless of classification
 *   anything else           → no auto-tag; user picks manually.
 *
 * Garage detection scans the FULL page text (not just the truncated
 * title) because title-blocks on garage sheets are frequently blank in
 * Calgary-style sample sets — the garage keyword only shows up as a
 * drawing caption ("GARAGE FLOOR PLAN") or callout ("GARAGE SLAB").
 * Trade-off: attached-garage PDFs (where the main-floor plan has a
 * "GARAGE" room label INSIDE the drawing) will also flip scope to
 * garage, which is wrong for the house polygon — user can manually
 * override via the Summary Table scope dropdown. Opt for auto-correct-
 * most-cases over miss-all-garages.
 */
function _autoTagFromPage(pageNum, textItems) {
  var page = ProjectStore.getPage(pageNum);
  if (!page) return { component: null, scope: "building", preset: null };
  var cls = page.classification;
  var title = (page.sheetTitle || "").toLowerCase();
  var isGarage = /\bgarage\b/.test(title) || _pageTextContainsGarage(textItems);
  var scope = isGarage ? "garage" : "building";

  if (cls === "plan") {
    if (/\bfoundation\b/.test(title)) return { component: "slab_foundation", scope: scope, preset: null };
    if (/\broof\b/.test(title)) return { component: "roof_plan", scope: scope, preset: null };
    if (/\b(main|upper|lower|basement|ground|floor)\b/.test(title) || isGarage) {
      return { component: "slab_above_grade", scope: scope, preset: null };
    }
  } else if (cls === "elevation") {
    return { component: "wall_exterior", scope: scope, preset: "wood_2x6" };
  }
  return { component: null, scope: scope, preset: null };
}

function _pageTextContainsGarage(textItems) {
  if (!textItems || !textItems.length) return false;
  for (var i = 0; i < textItems.length; i++) {
    if (/\bgarage\b/i.test(textItems[i].str || "")) return true;
  }
  return false;
}

/* ── Auto-calibrate from dimension strings (MAGIC C3) ───── */

// A declared scale and a detected scale agree if implied pdfUnitsPerMetre
// match within 3% — the threshold below which page-to-paper rescaling
// (ANSI D saved as 11x17 for printing) is usually not an issue.
var _SCALE_AGREEMENT_TOLERANCE = 0.03;

function autoCalibrate() {
  if (!Loader.isLoaded()) return;
  if (!_requireDrawingSheet(_currentPage, "Auto-Calibrate")) return;
  var pageNum = _currentPage;
  setStatus("Scanning text + geometry for dimension callouts...", "busy");

  Promise.all([Loader.getTextContent(pageNum), VectorSnap.extractGeometry(pageNum)]).then(function (results) {
    var textItems = results[0];
    var geo = results[1];
    var declaredCal = ScaleManager.getCalibration(pageNum);
    var declaredScale =
      declaredCal && declaredCal.ratio
        ? { ratio: declaredCal.ratio, raw: declaredCal.ratioLabel }
        : SheetClassifier.detectScale(textItems);

    var result = extractDimensions(textItems, geo.segments, { declaredScale: declaredScale });

    console.log(
      "[Auto-cal] Page " +
        pageNum +
        ": " +
        result.callouts.length +
        " paired callouts (" +
        result.unpaired.length +
        " parsed but unpaired), " +
        "declaredPPM=" +
        (result.declaredPdfUnitsPerMetre ? result.declaredPdfUnitsPerMetre.toFixed(2) : "?") +
        ", impliedMedian=" +
        (result.impliedPdfUnitsPerMetreMedian ? result.impliedPdfUnitsPerMetreMedian.toFixed(2) : "?") +
        ", agreement=" +
        (result.scaleAgreement !== null ? (result.scaleAgreement * 100).toFixed(2) + "%" : "?")
    );

    if (result.callouts.length === 0) {
      setStatus(
        "No dimension callouts paired to segments. " +
          (result.unpaired.length > 0
            ? result.unpaired.length + " dims parsed but none matched a segment length."
            : "No dim-shaped text found.") +
          " Try manual calibrate (C) instead.",
        "error"
      );
      _showScaleFeedback(
        "⚠️",
        "No Auto-Calibration Candidates",
        "Could not find a dimension string paired to a matching line segment on this page.<br><br>" +
          (result.unpaired.length > 0
            ? "<b>" +
              result.unpaired.length +
              "</b> dimension strings were parsed from the text, but none matched a segment length within the scale-agreement tolerance. The drawing may use curved leaders or the declared scale may be wildly off.<br><br>"
            : "No dimension strings were found in the page text.<br><br>") +
          "Press <b>C</b> to calibrate manually by clicking two points on a known dimension.",
        "#e9c46a",
        false
      );
      return;
    }

    // Pick the highest-confidence callout with a horizontal segment +
    // longest paired length. Horizontal building widths are the most
    // reliable real-world reference; longer segments give the smallest
    // relative error from pixel quantization.
    var sorted = result.callouts.slice().sort(function (a, b) {
      var aH = a.segment.orientation === "horizontal" ? 1 : 0;
      var bH = b.segment.orientation === "horizontal" ? 1 : 0;
      if (aH !== bH) return bH - aH;
      var scoreDiff = b.confidence - a.confidence;
      if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
      return b.segment.length - a.segment.length;
    });
    var best = sorted[0];
    var detectedPPM = best.impliedPdfUnitsPerMetre;
    if (!isFinite(detectedPPM) || detectedPPM <= 0) {
      setStatus("Auto-calibrate found a candidate but failed to compute scale.", "error");
      return;
    }

    var declaredPPM = result.declaredPdfUnitsPerMetre;
    var hasDeclared = declaredPPM && isFinite(declaredPPM);
    var agreement = hasDeclared ? 1 - Math.abs(detectedPPM - declaredPPM) / declaredPPM : null;
    var disagree = hasDeclared && agreement !== null && agreement < 1 - _SCALE_AGREEMENT_TOLERANCE;

    var detectedRatio = _ppmToRatio(detectedPPM);
    var detectedLabel = "1:" + detectedRatio;

    if (hasDeclared && !disagree) {
      ScaleManager.calibrateFromDimension(pageNum, declaredPPM, {
        ratio: (declaredCal && declaredCal.ratio) || _ppmToRatio(declaredPPM),
        ratioLabel:
          (declaredCal && declaredCal.ratioLabel) ||
          (declaredScale && declaredScale.raw) ||
          "1:" + _ppmToRatio(declaredPPM),
        dimText: best.text,
        dimMeters: best.valueMeters,
        segmentLength: best.segment.length
      });
      ProjectStore.saveCalibration(pageNum, ScaleManager.getCalibration(pageNum));
      closeScalePanel();
      _updateSheetInfo(ProjectStore.getPage(pageNum));
      _updateScaleLabel();
      _refreshMeasurements();
      Viewer.requestRedraw();
      setStatus(
        "Scale confirmed by auto-calibrate: " +
          ((declaredCal && declaredCal.ratioLabel) || "1:" + _ppmToRatio(declaredPPM)) +
          " (from " +
          result.callouts.length +
          " dim callouts)",
        "ready"
      );
      _showScaleFeedback(
        "✓✓",
        "Scale Confirmed",
        "Declared scale <b>" +
          ((declaredCal && declaredCal.ratioLabel) || declaredScale.raw) +
          "</b> is within " +
          ((1 - agreement) * 100).toFixed(1) +
          "% of the detected scale from " +
          result.callouts.length +
          " dimension callouts on this page.<br><br>" +
          'Reference: "<b>' +
          best.text +
          '</b>" = ' +
          best.valueMeters.toFixed(3) +
          "m on a " +
          best.segment.length.toFixed(0) +
          "pt segment.<br><br>" +
          "Page is now marked <b>VERIFIED</b> — area measurements use this scale.",
        "var(--accent-lit)",
        false
      );
      return;
    }

    if (disagree) {
      _showScaleDisagreement(pageNum, {
        declaredLabel: (declaredCal && declaredCal.ratioLabel) || declaredScale.raw,
        declaredRatio: (declaredCal && declaredCal.ratio) || _ppmToRatio(declaredPPM),
        declaredPPM: declaredPPM,
        detectedRatio: detectedRatio,
        detectedLabel: detectedLabel,
        detectedPPM: detectedPPM,
        bestText: best.text,
        bestMeters: best.valueMeters,
        bestSegmentLength: best.segment.length,
        calloutCount: result.callouts.length,
        disagreementPct: (1 - agreement) * 100
      });
      return;
    }

    // No declared scale — land detected directly.
    ScaleManager.calibrateFromDimension(pageNum, detectedPPM, {
      ratio: detectedRatio,
      ratioLabel: detectedLabel,
      dimText: best.text,
      dimMeters: best.valueMeters,
      segmentLength: best.segment.length
    });
    ProjectStore.saveCalibration(pageNum, ScaleManager.getCalibration(pageNum));
    closeScalePanel();
    _updateSheetInfo(ProjectStore.getPage(pageNum));
    _updateScaleLabel();
    _refreshMeasurements();
    Viewer.requestRedraw();
    setStatus("Auto-calibrated: " + detectedLabel + " from " + result.callouts.length + " dim callouts", "ready");
    _showScaleFeedback(
      "✨",
      "Auto-Calibrated",
      "Detected <b>" +
        detectedLabel +
        "</b> from " +
        result.callouts.length +
        " dimension callouts on this page.<br><br>" +
        'Reference: "<b>' +
        best.text +
        '</b>" = ' +
        best.valueMeters.toFixed(3) +
        "m on a " +
        best.segment.length.toFixed(0) +
        "pt segment.<br><br>" +
        "Page is now marked <b>VERIFIED</b>.",
      "var(--accent-lit)",
      false
    );
  });
}

// Disagreement modal — MVP uses window.confirm because the existing
// _showScaleFeedback widget is single-action (OK). A dedicated 3-way
// panel is a UX follow-up.
function _showScaleDisagreement(pageNum, info) {
  var msg =
    "Scale mismatch detected.\n\n" +
    "Declared scale: " +
    info.declaredLabel +
    " (~" +
    info.declaredPPM.toFixed(1) +
    " units/m)\n" +
    "Detected from dims: " +
    info.detectedLabel +
    " (~" +
    info.detectedPPM.toFixed(1) +
    " units/m)\n" +
    'Reference: "' +
    info.bestText +
    '" = ' +
    info.bestMeters.toFixed(3) +
    "m on " +
    info.bestSegmentLength.toFixed(0) +
    "pt (" +
    info.calloutCount +
    " dims total)\n" +
    "Disagreement: " +
    info.disagreementPct.toFixed(1) +
    "%\n\n" +
    "The PDF may have been printed at a different size than drawn.\n\n" +
    "OK = use DETECTED scale, Cancel = keep DECLARED scale.";
  var useDetected = window.confirm(msg);
  if (useDetected) {
    ScaleManager.calibrateFromDimension(pageNum, info.detectedPPM, {
      ratio: info.detectedRatio,
      ratioLabel: info.detectedLabel,
      dimText: info.bestText,
      dimMeters: info.bestMeters,
      segmentLength: info.bestSegmentLength
    });
    ProjectStore.saveCalibration(pageNum, ScaleManager.getCalibration(pageNum));
    closeScalePanel();
    _updateSheetInfo(ProjectStore.getPage(pageNum));
    _updateScaleLabel();
    _refreshMeasurements();
    Viewer.requestRedraw();
    setStatus(
      "Using detected scale " +
        info.detectedLabel +
        " (declared was " +
        info.declaredLabel +
        ", " +
        info.disagreementPct.toFixed(1) +
        "% off)",
      "ready"
    );
  } else {
    setStatus(
      "Keeping declared scale " + info.declaredLabel + " (auto-detect suggested " + info.detectedLabel + ")",
      "ready"
    );
  }
}

// Inverse of ScaleManager.accept(): given pdfUnitsPerMetre, return the
// nearest integer 1:N ratio. mmPerPdfUnit = 25.4/72, so
// ratio = (72 * 1000) / (25.4 * ppm).
function _ppmToRatio(ppm) {
  if (!ppm || !isFinite(ppm) || ppm <= 0) return null;
  var r = (72 * 1000) / (25.4 * ppm);
  return Math.round(r);
}

/* ── Summary Table Modal ──────────────────────────────── */

function openSummaryTable() {
  if (!Loader.isLoaded()) return;
  _renderSummaryTable();
  document.getElementById("summary-backdrop").classList.add("visible");
  document.getElementById("summary-panel").classList.add("visible");
}

function closeSummaryTable() {
  document.getElementById("summary-backdrop").classList.remove("visible");
  document.getElementById("summary-panel").classList.remove("visible");
}

// Pick a reliable descriptor for a sheet header. The title-block scan in
// sheet-classifier.mjs is best-effort and regularly picks up disclaimer /
// general-notes body text when the title block is missing or atypical — so
// only show sheetTitle if it's short and doesn't look like a sentence. In
// every other case, fall back to the deterministic classification
// ("Plan", "Elevation", etc.).
function _buildSheetTail(page) {
  var classification = page.classification ? _capitalize(page.classification) : "";
  var title = (page.sheetTitle || "").trim();
  // 80-char cap leaves headroom for multi-line stacks like
  // "FOUNDATION PLAN — Continuous Footings Layout". Sentence-prefix filter
  // still rejects prose that slips under the length limit.
  var looksLikeBodyText =
    title.length > 80 || /^(this|the following|all\s|general\s+notes|notes?:|drawings?\s)/i.test(title);
  if (title && !looksLikeBodyText) return " \u2014 " + title;
  if (classification) return " \u2014 " + classification;
  return "";
}

function _capitalize(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Assembly-preset option set. Mirrors the toolbar select in pdfparser.html —
// kept inline here so re-classifying from the Summary Table doesn't require
// fishing the option list out of the DOM.
var ASSEMBLY_PRESET_OPTIONS = [
  { value: "", label: "(no preset)" },
  { value: "wood_2x4", label: "Wood 2x4" },
  { value: "wood_2x6", label: "Wood 2x6" },
  { value: "wood_2x8", label: "Wood 2x8" },
  { value: "wood_2x10", label: "Wood 2x10" },
  { value: "steel_stud", label: "Steel stud" },
  { value: "icf", label: "ICF" },
  { value: "concrete_block", label: "Concrete block" },
  { value: "other", label: "Other" }
];

function _renderTagSelect(polyType, polyIdx, pageNum, currentValue, small) {
  if (polyType === "window") {
    // Windows are auto-tagged; keep static.
    var sizeAttr = small ? " style='font-size:10px;'" : "";
    return "<td class='tag-cell'" + sizeAttr + ">" + (currentValue || "window_opening") + "</td>";
  }
  var toolKey = polyType === "polyline" ? "polyline" : "measure";
  var opts = COMPONENT_OPTIONS[toolKey] || [];
  var html = "<td class='tag-cell'" + (small ? " style='font-size:10px;'" : "") + ">";
  html +=
    "<select class='summary-tag-select bw-inline-select' data-poly-idx='" +
    polyIdx +
    "' data-page-num='" +
    pageNum +
    "'>";
  for (var i = 0; i < opts.length; i++) {
    var sel = opts[i].value === (currentValue || "") ? " selected" : "";
    html += "<option value='" + opts[i].value + "'" + sel + ">" + opts[i].label + "</option>";
  }
  html += "</select></td>";
  return html;
}

// Per-polygon scope: "building" (default) or "garage". Orthogonal to the
// component tag — a slab_foundation polygon with scope="garage" flows to
// garage_slab_area while the same tag with scope="building" flows to
// dim_foundation_slab_floor_area. See polygon-map.mjs targetDimsForScope.
function _renderScopeSelect(polyIdx, pageNum, currentScope, small) {
  var sizeAttr = small ? " style='font-size:10px;'" : "";
  var html = "<td class='scope-cell'" + sizeAttr + ">";
  html +=
    "<select class='summary-scope-select bw-inline-select' data-poly-idx='" +
    polyIdx +
    "' data-page-num='" +
    pageNum +
    "'>";
  var scope = currentScope === "garage" ? "garage" : "building";
  html += "<option value='building'" + (scope === "building" ? " selected" : "") + ">Building</option>";
  html += "<option value='garage'" + (scope === "garage" ? " selected" : "") + ">Garage</option>";
  html += "</select></td>";
  return html;
}

// Per-polygon depth input, rendered only for components whose aggregator
// consumes depth (today: pad_pier plan-area * depth -> volume). Other tags
// render an em-dash so the column reads as "not applicable" rather than "zero".
function _renderDepthInput(component, polyIdx, pageNum, currentDepth, small) {
  var sizeAttr = small ? " style='font-size:10px;'" : "";
  if (!PolygonTool.componentCarriesDepth(component)) {
    return "<td class='depth-cell'" + sizeAttr + ">—</td>";
  }
  var val = currentDepth != null && isFinite(Number(currentDepth)) ? String(currentDepth) : "";
  var html = "<td class='depth-cell'" + sizeAttr + ">";
  html +=
    "<input type='number' step='0.01' min='0' class='summary-depth-input bw-inline-input' " +
    "data-poly-idx='" +
    polyIdx +
    "' data-page-num='" +
    pageNum +
    "' " +
    "value='" +
    val +
    "' placeholder='m' />";
  html += "</td>";
  return html;
}

function _renderPresetSelect(component, polyIdx, pageNum, currentPreset, small) {
  var sizeAttr = small ? " style='font-size:10px;'" : "";
  if (!PolygonTool.componentCarriesPreset(component)) {
    return "<td class='preset-cell'" + sizeAttr + ">\u2014</td>";
  }
  var html = "<td class='preset-cell'" + sizeAttr + ">";
  html +=
    "<select class='summary-preset-select bw-inline-select' data-poly-idx='" +
    polyIdx +
    "' data-page-num='" +
    pageNum +
    "'>";
  for (var i = 0; i < ASSEMBLY_PRESET_OPTIONS.length; i++) {
    var sel = ASSEMBLY_PRESET_OPTIONS[i].value === (currentPreset || "") ? " selected" : "";
    html +=
      "<option value='" +
      ASSEMBLY_PRESET_OPTIONS[i].value +
      "'" +
      sel +
      ">" +
      ASSEMBLY_PRESET_OPTIONS[i].label +
      "</option>";
  }
  html += "</select></td>";
  return html;
}

function _renderSummaryTable() {
  var project = ProjectStore.getProject();
  var html = "<table><thead><tr>";
  html += "<th>Sheet</th><th>Label</th>";
  html += "<th>Type</th><th>Tag</th><th>Scope</th><th>Preset</th>";
  html += "<th>Gross m\u00B2</th><th>Net m\u00B2</th>";
  html += "<th>Gross ft\u00B2</th><th>Net ft\u00B2</th>";
  html += "<th>Depth m</th>";
  html += "<th>Length / Perim m</th><th></th>";
  html += "</tr></thead><tbody>";

  var grandGrossM2 = 0,
    grandNetM2 = 0,
    grandGrossFt2 = 0,
    grandNetFt2 = 0;
  var hasAnyData = false;
  var toggleIdx = 0;

  for (var p = 0; p < project.pages.length; p++) {
    var page = project.pages[p];
    var pageNum = page.pageNum;
    var assoc = PolygonTool.buildAssociationMap(pageNum);
    // Polylines are linear features — collected separately since they don't
    // associate with walls/windows and carry length instead of area.
    var allMeas = PolygonTool.getAllMeasurements(pageNum);
    var allPolys = PolygonTool.getPolygons(pageNum);
    var polylines = [];
    for (var mi = 0; mi < allMeas.length; mi++) {
      if (allMeas[mi].type !== "polyline") continue;
      for (var mj = 0; mj < allPolys.length; mj++) {
        if (allPolys[mj].id === allMeas[mi].id) {
          polylines.push({ measurement: allMeas[mi], polyIdx: mj });
          break;
        }
      }
    }
    if (assoc.walls.length === 0 && assoc.orphanWindows.length === 0 && polylines.length === 0) continue;

    var sheetLabel = page.sheetId || "Page " + pageNum;
    var tail = _buildSheetTail(page);
    hasAnyData = true;

    // Sheet header row
    html += "<tr class='summary-sheet-row'><td colspan='13'>" + sheetLabel + tail + "</td></tr>";

    var pageGrossM2 = 0,
      pageNetM2 = 0,
      pageGrossFt2 = 0,
      pageNetFt2 = 0;

    // Wall rows
    for (var w = 0; w < assoc.walls.length; w++) {
      var wall = assoc.walls[w];
      var wm = wall.measurement;
      var hasChildren = wall.children.length > 0;

      // Compute net
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

      if (wm.areaM2 !== null) {
        pageGrossM2 += wm.areaM2;
        pageGrossFt2 += wm.areaFt2;
        pageNetM2 += wallNetM2;
        pageNetFt2 += wallNetFt2;
      }

      // Wall row
      var chevron = hasChildren
        ? "<span class='wall-toggle' data-wall-idx='st" + toggleIdx + "' data-expanded='0'>\u25B6</span> "
        : "";
      var netSuffix = hasChildren ? " <span class='net-label'>net</span>" : "";
      html += "<tr>";
      html += "<td></td>";
      html +=
        "<td class='label-cell' data-poly-idx='" +
        wall.polyIdx +
        "' data-page-num='" +
        pageNum +
        "' title='Click to rename'>" +
        chevron +
        wm.label +
        netSuffix +
        "</td>";
      html += "<td class='type-cell'>area</td>";
      html += _renderTagSelect("area", wall.polyIdx, pageNum, wm.component, false);
      html += _renderScopeSelect(wall.polyIdx, pageNum, wm.scope, false);
      html += _renderPresetSelect(wm.component, wall.polyIdx, pageNum, wm.assembly_preset, false);
      if (wm.areaM2 !== null) {
        html += "<td class='num'>" + wm.areaM2.toFixed(2) + "</td>";
        html += "<td class='num'>" + wallNetM2.toFixed(2) + "</td>";
        html += "<td class='num'>" + wm.areaFt2.toFixed(2) + "</td>";
        html += "<td class='num'>" + wallNetFt2.toFixed(2) + "</td>";
      } else {
        html += "<td class='num' colspan='4'>\u2014</td>";
      }
      html += _renderDepthInput(wm.component, wall.polyIdx, pageNum, wm.depth_m, false);
      html += "<td class='num'>" + (wm.perimeterM !== null ? wm.perimeterM.toFixed(2) : "") + "</td>";
      html +=
        "<td class='del-cell' data-poly-idx='" +
        wall.polyIdx +
        "' data-page-num='" +
        pageNum +
        "' title='Delete'>\u00D7</td>";
      html += "</tr>";

      // Detail rows (children)
      if (hasChildren) {
        for (var cj = 0; cj < wall.children.length; cj++) {
          var child = wall.children[cj];
          var cm = child.measurement;
          var cPrefix = cm.mode !== "add" ? "\u2212" : "+";
          html += "<tr class='detail-row' data-parent='st" + toggleIdx + "' style='color:" + WIN_EDGE + ";'>";
          html += "<td></td>";
          html +=
            "<td class='label-cell' data-poly-idx='" +
            child.polyIdx +
            "' data-page-num='" +
            pageNum +
            "' style='padding-left:24px;font-size:10px;' title='Click to rename'>" +
            cPrefix +
            " " +
            cm.label +
            "</td>";
          html += "<td class='type-cell' style='font-size:10px;'>window</td>";
          html += _renderTagSelect("window", child.polyIdx, pageNum, cm.component, true);
          html += _renderScopeSelect(child.polyIdx, pageNum, cm.scope, true);
          html += _renderPresetSelect(cm.component, child.polyIdx, pageNum, cm.assembly_preset, true);
          if (cm.areaM2 !== null) {
            html += "<td class='num' style='font-size:10px;'>" + cPrefix + cm.areaM2.toFixed(2) + "</td>";
            html += "<td class='num' style='font-size:10px;'></td>";
            html += "<td class='num' style='font-size:10px;'>" + cPrefix + cm.areaFt2.toFixed(2) + "</td>";
            html += "<td class='num' style='font-size:10px;'></td>";
          } else {
            html += "<td colspan='4'></td>";
          }
          html += _renderDepthInput(cm.component, child.polyIdx, pageNum, cm.depth_m, true);
          html +=
            "<td class='num' style='font-size:10px;'>" +
            (cm.perimeterM !== null ? cm.perimeterM.toFixed(2) : "") +
            "</td>";
          html +=
            "<td class='del-cell' data-poly-idx='" +
            child.polyIdx +
            "' data-page-num='" +
            pageNum +
            "' title='Delete' style='font-size:10px;'>\u00D7</td>";
          html += "</tr>";
        }
        toggleIdx++;
      }
    }

    // Orphan windows
    for (var o = 0; o < assoc.orphanWindows.length; o++) {
      var om = assoc.orphanWindows[o].measurement;
      var oPrefix = om.mode !== "add" ? "\u2212" : "+";
      html += "<tr style='color:" + WIN_EDGE + ";'>";
      html += "<td></td>";
      html +=
        "<td class='label-cell' data-poly-idx='" +
        assoc.orphanWindows[o].polyIdx +
        "' data-page-num='" +
        pageNum +
        "' title='Click to rename'>" +
        om.label +
        " (unassociated)</td>";
      html += "<td class='type-cell'>window</td>";
      html += _renderTagSelect("window", assoc.orphanWindows[o].polyIdx, pageNum, om.component, false);
      html += _renderScopeSelect(assoc.orphanWindows[o].polyIdx, pageNum, om.scope, false);
      html += _renderPresetSelect(om.component, assoc.orphanWindows[o].polyIdx, pageNum, om.assembly_preset, false);
      if (om.areaM2 !== null) {
        html += "<td class='num'>" + oPrefix + om.areaM2.toFixed(2) + "</td><td class='num'></td>";
        html += "<td class='num'>" + oPrefix + om.areaFt2.toFixed(2) + "</td><td class='num'></td>";
      } else {
        html += "<td colspan='4'>\u2014</td>";
      }
      html += _renderDepthInput(om.component, assoc.orphanWindows[o].polyIdx, pageNum, om.depth_m, false);
      html += "<td class='num'>" + (om.perimeterM !== null ? om.perimeterM.toFixed(2) : "") + "</td>";
      html +=
        "<td class='del-cell' data-poly-idx='" +
        assoc.orphanWindows[o].polyIdx +
        "' data-page-num='" +
        pageNum +
        "' title='Delete'>\u00D7</td>";
      html += "</tr>";
    }

    // Polyline rows — linear features (interior walls, interior footings).
    // Length goes in the shared "Length / Perim m" column; area columns blank.
    for (var pk = 0; pk < polylines.length; pk++) {
      var ple = polylines[pk];
      var pm = ple.measurement;
      html += "<tr style='color:#e63946;'>";
      html += "<td></td>";
      html +=
        "<td class='label-cell' data-poly-idx='" +
        ple.polyIdx +
        "' data-page-num='" +
        pageNum +
        "' title='Click to rename'>" +
        pm.label +
        "</td>";
      html += "<td class='type-cell'>polyline</td>";
      html += _renderTagSelect("polyline", ple.polyIdx, pageNum, pm.component, false);
      html += _renderScopeSelect(ple.polyIdx, pageNum, pm.scope, false);
      html += _renderPresetSelect(pm.component, ple.polyIdx, pageNum, pm.assembly_preset, false);
      html += "<td class='num' colspan='4'>\u2014</td>";
      html += _renderDepthInput(pm.component, ple.polyIdx, pageNum, pm.depth_m, false);
      html += "<td class='num'>" + (pm.lengthM !== null ? pm.lengthM.toFixed(2) : "") + "</td>";
      html +=
        "<td class='del-cell' data-poly-idx='" +
        ple.polyIdx +
        "' data-page-num='" +
        pageNum +
        "' title='Delete'>\u00D7</td>";
      html += "</tr>";
    }

    // Page subtotal — only meaningful when the page has area measurements.
    if (assoc.walls.length > 1 || assoc.orphanWindows.length > 0) {
      html += "<tr class='summary-total-row'><td></td><td>" + sheetLabel + " Total</td>";
      html += "<td colspan='4'></td>";
      html += "<td class='num'>" + pageGrossM2.toFixed(2) + "</td>";
      html += "<td class='num'>" + pageNetM2.toFixed(2) + "</td>";
      html += "<td class='num'>" + pageGrossFt2.toFixed(2) + "</td>";
      html += "<td class='num'>" + pageNetFt2.toFixed(2) + "</td>";
      html += "<td colspan='3'></td></tr>";
    }

    grandGrossM2 += pageGrossM2;
    grandNetM2 += pageNetM2;
    grandGrossFt2 += pageGrossFt2;
    grandNetFt2 += pageNetFt2;
  }

  // Grand total
  if (hasAnyData) {
    html += "<tr class='summary-grand-total'><td></td><td>Grand Total</td>";
    html += "<td colspan='4'></td>";
    html += "<td class='num'>" + grandGrossM2.toFixed(2) + "</td>";
    html += "<td class='num'>" + grandNetM2.toFixed(2) + "</td>";
    html += "<td class='num'>" + grandGrossFt2.toFixed(2) + "</td>";
    html += "<td class='num'>" + grandNetFt2.toFixed(2) + "</td>";
    html += "<td colspan='3'></td></tr>";
  }

  html += "</tbody></table>";

  if (!hasAnyData) {
    html =
      "<p class='empty' style='padding:2rem;text-align:center;'>No measurements yet. Press <b>M</b> to measure areas.</p>";
  }

  document.getElementById("summary-content").innerHTML = html;

  // Bind chevron toggles
  var panel = document.getElementById("summary-content");
  var toggles = panel.querySelectorAll(".wall-toggle");
  for (var t = 0; t < toggles.length; t++) {
    toggles[t].addEventListener("click", function (e) {
      e.stopPropagation();
      var wallIdx = this.dataset.wallIdx;
      var expanded = this.dataset.expanded === "1";
      this.dataset.expanded = expanded ? "0" : "1";
      this.textContent = expanded ? "\u25B6" : "\u25BC";
      var details = panel.querySelectorAll(".detail-row[data-parent='" + wallIdx + "']");
      for (var d = 0; d < details.length; d++) {
        details[d].style.display = expanded ? "none" : "table-row";
      }
    });
  }

  // Bind label rename
  var labelCells = panel.querySelectorAll(".label-cell");
  for (var lc = 0; lc < labelCells.length; lc++) {
    labelCells[lc].addEventListener("click", function (e) {
      var polyIdx = parseInt(this.dataset.polyIdx, 10);
      var pageNum = parseInt(this.dataset.pageNum, 10);
      _startSummaryLabelEdit(this, pageNum, polyIdx);
    });
  }

  // Bind delete buttons
  var delCells = panel.querySelectorAll(".del-cell");
  for (var dc = 0; dc < delCells.length; dc++) {
    delCells[dc].addEventListener("click", function (e) {
      var idx = parseInt(this.dataset.polyIdx, 10);
      var pg = parseInt(this.dataset.pageNum, 10);
      PolygonTool.deletePolygon(pg, idx);
      ProjectStore.savePolygons(pg, PolygonTool.getPolygons(pg));
      _renderSummaryTable();
      if (pg === _currentPage) {
        _refreshMeasurements();
        Viewer.requestRedraw();
      }
      setStatus("Measurement deleted", "ready");
    });
  }

  // Bind inline Tag + Preset selects — changing either one re-classifies
  // the polygon, persists via savePolygons, and re-renders the table (so
  // the preset column visibility updates when Tag toggles in/out of a
  // wall-type component).
  var tagSelects = panel.querySelectorAll(".summary-tag-select");
  for (var ts = 0; ts < tagSelects.length; ts++) {
    tagSelects[ts].addEventListener("change", function () {
      var idx = parseInt(this.dataset.polyIdx, 10);
      var pg = parseInt(this.dataset.pageNum, 10);
      PolygonTool.setComponent(pg, idx, this.value);
      ProjectStore.savePolygons(pg, PolygonTool.getPolygons(pg));
      _renderSummaryTable();
      if (pg === _currentPage) _refreshMeasurements();
      setStatus("Tag updated", "ready");
    });
  }

  var presetSelects = panel.querySelectorAll(".summary-preset-select");
  for (var ps = 0; ps < presetSelects.length; ps++) {
    presetSelects[ps].addEventListener("change", function () {
      var idx = parseInt(this.dataset.polyIdx, 10);
      var pg = parseInt(this.dataset.pageNum, 10);
      PolygonTool.setAssemblyPreset(pg, idx, this.value);
      ProjectStore.savePolygons(pg, PolygonTool.getPolygons(pg));
      setStatus("Preset updated", "ready");
    });
  }

  // Scope selects — flipping to "garage" reroutes a polygon's contribution
  // to the garage_* dim counterpart via polygon-map's two-scope aggregator.
  // No re-render needed: only the polygon record changes, visible columns
  // (Tag/Preset/Depth) are unaffected.
  var scopeSelects = panel.querySelectorAll(".summary-scope-select");
  for (var ss = 0; ss < scopeSelects.length; ss++) {
    scopeSelects[ss].addEventListener("change", function () {
      var idx = parseInt(this.dataset.polyIdx, 10);
      var pg = parseInt(this.dataset.pageNum, 10);
      PolygonTool.setScope(pg, idx, this.value);
      ProjectStore.savePolygons(pg, PolygonTool.getPolygons(pg));
      setStatus("Scope updated: " + this.value, "ready");
    });
  }

  // Depth inputs — meaningful for pad_pier (plan-area * depth -> volume).
  // Use `change` (not `input`) so partial typing doesn't thrash the save
  // pipeline; the value commits when the field loses focus or Enter is pressed.
  var depthInputs = panel.querySelectorAll(".summary-depth-input");
  for (var di = 0; di < depthInputs.length; di++) {
    depthInputs[di].addEventListener("change", function () {
      var idx = parseInt(this.dataset.polyIdx, 10);
      var pg = parseInt(this.dataset.pageNum, 10);
      PolygonTool.setDepth(pg, idx, this.value);
      ProjectStore.savePolygons(pg, PolygonTool.getPolygons(pg));
      setStatus("Depth updated", "ready");
    });
  }
}

function _startSummaryLabelEdit(cell, pageNum, polyIdx) {
  var currentLabel = cell.textContent
    .replace(/^[\u25B6\u25BC]\s*/, "")
    .replace(/\s*net$/, "")
    .trim();
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
    PolygonTool.renamePolygon(pageNum, polyIdx, newLabel);
    ProjectStore.savePolygons(pageNum, PolygonTool.getPolygons(pageNum));
    if (pageNum === _currentPage) {
      Viewer.requestRedraw();
      _refreshMeasurements();
    }
    _renderSummaryTable();
  }

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      _renderSummaryTable();
    }
  });
  input.addEventListener("blur", commit);
}

/* ── Export ────────────────────────────────────────────── */

function exportCSV() {
  ProjectStore.download(ProjectStore.measurementsToCSV(), "pdf-parser-measurements.csv", "text/csv");
}

function exportJSON() {
  ProjectStore.download(ProjectStore.toJSON(), "pdf-parser-project.json", "application/json");
}

/* ── JSON Import ──────────────────────────────────────── */

function _bindJsonImport() {
  var jsonInput = document.getElementById("json-input");
  if (jsonInput) {
    jsonInput.addEventListener("change", function (e) {
      if (e.target.files.length > 0) _importJsonFile(e.target.files[0]);
      e.target.value = ""; // reset so same file can be re-imported
    });
  }
}

// Hydrate live modules (PolygonTool, ScaleManager, ruler state) from a
// persisted project JSON. Used by both JSON import and IndexedDB restore.
// Caller is responsible for having loaded the PDF first (polyline rendering
// needs an active page / scale calibration).
function _hydrateFromProjectData(data, pdfPageCount) {
  ProjectStore.restoreProject(data);

  var areaCount = 0,
    winCount = 0,
    rulerCount = 0;
  var maxPage = Math.min(data.pageCount, pdfPageCount);

  for (var i = 0; i < maxPage; i++) {
    var page = data.pages[i];
    var pageNum = page.pageNum || i + 1;
    if (page.polygons && page.polygons.length > 0) {
      PolygonTool.loadPolygons(pageNum, page.polygons);
      for (var pi = 0; pi < page.polygons.length; pi++) {
        if (page.polygons[pi].type === "window") winCount++;
        else areaCount++;
      }
    }
    if (page.calibration) ScaleManager.restoreCalibration(pageNum, page.calibration);
    if (page.rulers && page.rulers.length > 0) {
      _rulers[pageNum] = page.rulers.slice();
      rulerCount += page.rulers.length;
    }
  }

  _rulerUndoStack = [];
  _rulerRedoStack = [];
  _undoOrder = [];
  _redoOrder = [];

  return { areas: areaCount, windows: winCount, rulers: rulerCount };
}

function _importJsonFile(file) {
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var data = JSON.parse(e.target.result);
    } catch (err) {
      setStatus("Import failed: invalid JSON file", "error");
      return;
    }

    if (!data.pages || !data.pageCount) {
      setStatus("Import failed: not a PDF-Parser project file", "error");
      return;
    }

    if (!Loader.isLoaded()) {
      setStatus("Load the PDF first, then import measurements", "error");
      return;
    }

    var pdfPageCount = Loader.getPageCount();
    if (data.pageCount !== pdfPageCount) {
      var proceed = confirm(
        "Project has " +
          data.pageCount +
          " pages but the loaded PDF has " +
          pdfPageCount +
          " pages.\n\nImport anyway? (measurements will be applied to matching page numbers)"
      );
      if (!proceed) return;
    }

    var counts = _hydrateFromProjectData(data, pdfPageCount);
    var areaCount = counts.areas;
    var winCount = counts.windows;
    var rulerCount = counts.rulers;

    // Refresh current page display
    var pageData = ProjectStore.getPage(_currentPage);
    _updateSheetInfo(pageData);
    _updateScaleLabel();
    _refreshMeasurements();
    Viewer.requestRedraw();

    setStatus(
      "Imported: " +
        areaCount +
        " areas, " +
        winCount +
        " windows, " +
        rulerCount +
        " rulers from " +
        (data.fileName || "project"),
      "ready"
    );
  };
  reader.readAsText(file);
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
  // Phase 4b.1 — component tag + assembly preset
  setComponentTag: setComponentTag,
  setAssemblyPreset: setAssemblyPreset,
  // Auto-detect
  autoDetect: autoDetect,
  // Auto-calibrate (MAGIC C3)
  autoCalibrate: autoCalibrate,
  // C7d oculus — tighten all edges one step inward
  tightenOculus: tightenOculus,
  // Summary table
  openSummaryTable: openSummaryTable,
  closeSummaryTable: closeSummaryTable,
  // Sample
  loadSample: loadSample
};

/* ── Boot ─────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", init);
