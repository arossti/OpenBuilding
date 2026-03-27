/**
 * PDF-Parser — Canvas Viewer (CAD-style controls)
 *
 * Architecture:
 *   - #viewer-wrap: viewport (clips content, receives wheel/mouse events)
 *   - #viewer-container: transformed layer (CSS scale + translate for zoom/pan)
 *     - #pdf-canvas: PDF render at a fixed high DPI
 *     - #overlay-canvas: annotation layer (polygons, measurements)
 *
 * Zoom/pan is pure CSS transform — no re-render on zoom.
 * PDF is rendered once per page at a fixed resolution, then scaled via CSS.
 * Re-render only when changing pages or when user requests high-res (future).
 *
 * Controls:
 *   - Scroll wheel: zoom centered on cursor
 *   - Middle-mouse drag: pan
 *   - F key / Fit button: fit page to viewport
 */

import * as Loader from "./pdf-loader.mjs";
import { DEFAULT_DPI } from "./config.mjs";

var _pdfCanvas = null, _overlay = null, _container = null, _wrap = null;
var _currentPage = 0;
var _renderDpi = 150;          // fixed render resolution — high enough for detail
var _viewport = null;

// Transform state (applied as CSS transform on _container)
var _scale = 1.0;              // visual zoom (CSS scale)
var _panX = 0, _panY = 0;     // translation in screen pixels

// Interaction state
var _isPanning = false;
var _panStartMouseX = 0, _panStartMouseY = 0;
var _panStartX = 0, _panStartY = 0;

// Callbacks
var _onOverlayClick = null, _onOverlayMouseMove = null;
var _drawOverlayFn = null;

/* ── Init ─────────────────────────────────────────────── */

export function init(containerId, pdfCanvasId, overlayCanvasId) {
  _container = document.getElementById(containerId);
  _pdfCanvas = document.getElementById(pdfCanvasId);
  _overlay   = document.getElementById(overlayCanvasId);
  _wrap      = document.getElementById("viewer-wrap");
  _bindEvents();
}

/* ── Page rendering ───────────────────────────────────── */

export function showPage(pageNum) {
  _currentPage = pageNum;
  return Loader.renderPage(pageNum, _pdfCanvas, _renderDpi).then(function(result) {
    if (!result) return null;
    _viewport = result.viewport;
    _syncOverlaySize();
    _applyTransform();
    _redrawOverlay();
    return result;
  });
}

function _syncOverlaySize() {
  _overlay.width  = _pdfCanvas.width;
  _overlay.height = _pdfCanvas.height;
  // Overlay must exactly cover the PDF canvas — no explicit CSS size needed
  // since both are inside the same positioned container
}

/* ── Transform (zoom + pan via CSS) ───────────────────── */

function _applyTransform() {
  // transform-origin is top-left; we translate then scale
  _container.style.transform =
    "translate(" + _panX + "px, " + _panY + "px) scale(" + _scale + ")";
}

/**
 * Zoom centered on a screen-space point (cursor position).
 * @param {number} newScale
 * @param {number} screenX — cursor X relative to _wrap
 * @param {number} screenY — cursor Y relative to _wrap
 */
function _zoomAtPoint(newScale, screenX, screenY) {
  newScale = Math.max(0.1, Math.min(newScale, 10.0));
  var ratio = newScale / _scale;

  // The point under the cursor should stay fixed.
  // Before zoom: screenPt = containerPt * _scale + _panX
  // After zoom:  screenPt = containerPt * newScale + newPanX
  // So: newPanX = screenPt - (screenPt - _panX) * ratio
  _panX = screenX - (screenX - _panX) * ratio;
  _panY = screenY - (screenY - _panY) * ratio;
  _scale = newScale;
  _applyTransform();
}

/* ── Public zoom/pan API ──────────────────────────────── */

export function zoomIn() {
  var cx = _wrap ? _wrap.clientWidth / 2 : 400;
  var cy = _wrap ? _wrap.clientHeight / 2 : 300;
  _zoomAtPoint(_scale * 1.25, cx, cy);
}

export function zoomOut() {
  var cx = _wrap ? _wrap.clientWidth / 2 : 400;
  var cy = _wrap ? _wrap.clientHeight / 2 : 300;
  _zoomAtPoint(_scale / 1.25, cx, cy);
}

export function zoomFit() {
  if (!_currentPage) return Promise.resolve();
  return Loader.getPageSize(_currentPage).then(function(size) {
    if (!_wrap) return;
    var canvasW = size.width * (_renderDpi / 72);
    var canvasH = size.height * (_renderDpi / 72);
    var availW = _wrap.clientWidth;
    var availH = _wrap.clientHeight;
    var fitScale = Math.min(availW / canvasW, availH / canvasH) * 0.95; // 5% margin
    _scale = fitScale;
    // Center the page
    _panX = (availW - canvasW * _scale) / 2;
    _panY = (availH - canvasH * _scale) / 2;
    _applyTransform();
  });
}

export function setZoom(z) {
  var cx = _wrap ? _wrap.clientWidth / 2 : 400;
  var cy = _wrap ? _wrap.clientHeight / 2 : 300;
  _zoomAtPoint(z, cx, cy);
}

export function getZoom() { return _scale; }

/* ── Coordinate conversion ────────────────────────────── */

/**
 * Convert a mouse event to PDF coordinate space.
 */
export function eventToPdfCoords(e) {
  var rect = _container.getBoundingClientRect();
  // Mouse position relative to the container's top-left, accounting for CSS scale
  var containerX = (e.clientX - rect.left) / _scale;
  var containerY = (e.clientY - rect.top) / _scale;
  // Container pixels → PDF points
  var pdfScale = _renderDpi / 72;
  return { x: containerX / pdfScale, y: containerY / pdfScale };
}

/**
 * Convert PDF coordinates to canvas pixel coordinates (for drawing on overlay).
 */
export function pdfToCanvas(pt) {
  var pdfScale = _renderDpi / 72;
  return { x: pt.x * pdfScale, y: pt.y * pdfScale };
}

export function getOverlayCtx() { return _overlay.getContext("2d"); }
export function setDrawCallback(fn) { _drawOverlayFn = fn; }

function _redrawOverlay() {
  var ctx = _overlay.getContext("2d");
  ctx.clearRect(0, 0, _overlay.width, _overlay.height);
  if (_drawOverlayFn) _drawOverlayFn(ctx, _currentPage);
}

export function requestRedraw() { _redrawOverlay(); }

/* ── Event binding ────────────────────────────────────── */

function _bindEvents() {
  // ── Scroll wheel: zoom centered on cursor ──
  _wrap.addEventListener("wheel", function(e) {
    e.preventDefault();
    var rect = _wrap.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;
    var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    _zoomAtPoint(_scale * factor, mouseX, mouseY);
  }, { passive: false });

  // ── Mouse down ──
  _wrap.addEventListener("mousedown", function(e) {
    // Middle-click pan (button 2 is right-click, button 1 is middle)
    if (e.button === 1) {
      e.preventDefault();
      _startPan(e);
      return;
    }
    // Left-click: forward to tool handler, unless ctrl held (pan)
    if (e.button === 0 && e.ctrlKey) {
      e.preventDefault();
      _startPan(e);
      return;
    }
    if (e.button === 0 && _onOverlayClick) {
      _onOverlayClick(e);
    }
  });

  // ── Mouse move ──
  _wrap.addEventListener("mousemove", function(e) {
    if (_isPanning) {
      _panX = _panStartX + (e.clientX - _panStartMouseX);
      _panY = _panStartY + (e.clientY - _panStartMouseY);
      _applyTransform();
      return;
    }
    if (_onOverlayMouseMove) _onOverlayMouseMove(e);
  });

  // ── Mouse up ──
  window.addEventListener("mouseup", function(e) {
    if (_isPanning) {
      _isPanning = false;
      _wrap.style.cursor = "";
    }
  });

  // Prevent middle-click auto-scroll (browser default)
  _wrap.addEventListener("auxclick", function(e) {
    if (e.button === 1) e.preventDefault();
  });
}

function _startPan(e) {
  _isPanning = true;
  _panStartMouseX = e.clientX;
  _panStartMouseY = e.clientY;
  _panStartX = _panX;
  _panStartY = _panY;
  _wrap.style.cursor = "grabbing";
}

/* ── Public callbacks ─────────────────────────────────── */

export function onOverlayClick(fn)     { _onOverlayClick = fn; }
export function onOverlayMouseMove(fn) { _onOverlayMouseMove = fn; }
export function getCurrentPage()       { return _currentPage; }

// Legacy — no-op, marquee removed
export function setMarqueeMode(on) {}
