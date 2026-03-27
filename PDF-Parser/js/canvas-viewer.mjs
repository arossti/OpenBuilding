/**
 * PDF-Parser — Canvas Viewer
 * Two-canvas architecture: PDF render layer + interactive overlay.
 */

import * as Loader from "./pdf-loader.mjs";
import { DEFAULT_DPI } from "./config.mjs";
// Loader also used by zoomFit for page dimensions

var _pdfCanvas = null, _overlay = null, _container = null, _wrap = null;
var _currentPage = 0, _zoom = 1.0;
var _panX = 0, _panY = 0, _isPanning = false, _panStartX = 0, _panStartY = 0;
var _viewport = null, _renderDpi = DEFAULT_DPI;
var _onOverlayClick = null, _onOverlayMouseMove = null;
var _drawOverlayFn = null;
// Marquee zoom state
var _isMarquee = false, _marqueeMode = false;
var _marqueeStart = null, _marqueeEnd = null;

export function init(containerId, pdfCanvasId, overlayCanvasId) {
  _container = document.getElementById(containerId);
  _pdfCanvas = document.getElementById(pdfCanvasId);
  _overlay   = document.getElementById(overlayCanvasId);
  _wrap      = document.getElementById("viewer-wrap");
  _bindEvents();
}

export function setMarqueeMode(on) { _marqueeMode = on; }

export function showPage(pageNum) {
  _currentPage = pageNum;
  return Loader.renderPage(pageNum, _pdfCanvas, _renderDpi * _zoom).then(function(result) {
    if (!result) return null;  // render was cancelled
    _viewport = result.viewport;
    _syncOverlaySize();
    _redrawOverlay();
    return result;
  });
}

function _syncOverlaySize() {
  _overlay.width  = _pdfCanvas.width;
  _overlay.height = _pdfCanvas.height;
  _overlay.style.width  = _pdfCanvas.width + "px";
  _overlay.style.height = _pdfCanvas.height + "px";
}

export function eventToPdfCoords(e) {
  var rect = _overlay.getBoundingClientRect();
  var canvasX = (e.clientX - rect.left) * (_overlay.width / rect.width);
  var canvasY = (e.clientY - rect.top)  * (_overlay.height / rect.height);
  var scale = (_renderDpi * _zoom) / 72;
  return { x: canvasX / scale, y: canvasY / scale };
}

export function pdfToCanvas(pt) {
  var scale = (_renderDpi * _zoom) / 72;
  return { x: pt.x * scale, y: pt.y * scale };
}

export function getOverlayCtx() { return _overlay.getContext("2d"); }

export function setDrawCallback(fn) { _drawOverlayFn = fn; }

function _redrawOverlay() {
  var ctx = _overlay.getContext("2d");
  ctx.clearRect(0, 0, _overlay.width, _overlay.height);
  if (_drawOverlayFn) _drawOverlayFn(ctx, _currentPage);
}

export function requestRedraw() { _redrawOverlay(); }

export function zoomIn()  { setZoom(_zoom * 1.25); }
export function zoomOut() { setZoom(_zoom / 1.25); }

export function zoomFit() {
  if (!_currentPage) { setZoom(1.0); return; }
  // Calculate zoom to fit the page in the visible viewport area
  var wrap = document.getElementById("viewer-wrap");
  if (!wrap) { setZoom(1.0); return; }
  var availW = wrap.clientWidth - 32;   // padding
  var availH = wrap.clientHeight - 32;

  Loader.getPageSize(_currentPage).then(function(size) {
    // size is in PDF points; at zoom=1 we render at _renderDpi/72 scale
    var basePixelW = size.width * (_renderDpi / 72);
    var basePixelH = size.height * (_renderDpi / 72);
    var fitZoom = Math.min(availW / basePixelW, availH / basePixelH);
    setZoom(fitZoom);
  });
}

var _zoomTimer = null;

export function setZoom(z) {
  _zoom = Math.max(0.25, Math.min(z, 5.0));
  // Debounce rapid zoom (scroll wheel) — wait 80ms before re-rendering
  if (_zoomTimer) clearTimeout(_zoomTimer);
  _zoomTimer = setTimeout(function() {
    _zoomTimer = null;
    if (_currentPage > 0) showPage(_currentPage);
  }, 80);
}

export function getZoom() { return _zoom; }

function _bindEvents() {
  _container.addEventListener("wheel", function(e) {
    e.preventDefault();
    if (e.deltaY < 0) zoomIn(); else zoomOut();
  }, { passive: false });

  _overlay.addEventListener("mousedown", function(e) {
    // Pan: middle-click or ctrl+click
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      _isPanning = true;
      _panStartX = e.clientX - _panX;
      _panStartY = e.clientY - _panY;
      e.preventDefault();
      return;
    }
    // Marquee zoom: Z tool mode
    if (_marqueeMode && e.button === 0) {
      _isMarquee = true;
      var rect = _overlay.getBoundingClientRect();
      _marqueeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      _marqueeEnd = _marqueeStart;
      e.preventDefault();
      return;
    }
    if (_onOverlayClick) _onOverlayClick(e);
  });

  _overlay.addEventListener("mousemove", function(e) {
    if (_isPanning) {
      _panX = e.clientX - _panStartX;
      _panY = e.clientY - _panStartY;
      _container.style.transform = "translate(" + _panX + "px," + _panY + "px)";
      return;
    }
    if (_isMarquee) {
      var rect = _overlay.getBoundingClientRect();
      _marqueeEnd = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      _redrawOverlay();
      // Draw marquee rectangle
      var ctx = _overlay.getContext("2d");
      ctx.save();
      ctx.strokeStyle = "#3a7c5f";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.fillStyle = "rgba(42, 92, 63, 0.15)";
      var mx = Math.min(_marqueeStart.x, _marqueeEnd.x);
      var my = Math.min(_marqueeStart.y, _marqueeEnd.y);
      var mw = Math.abs(_marqueeEnd.x - _marqueeStart.x);
      var mh = Math.abs(_marqueeEnd.y - _marqueeStart.y);
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeRect(mx, my, mw, mh);
      ctx.restore();
      return;
    }
    if (_onOverlayMouseMove) _onOverlayMouseMove(e);
  });

  window.addEventListener("mouseup", function(e) {
    if (_isMarquee && _marqueeStart && _marqueeEnd) {
      _isMarquee = false;
      var mw = Math.abs(_marqueeEnd.x - _marqueeStart.x);
      var mh = Math.abs(_marqueeEnd.y - _marqueeStart.y);
      if (mw > 20 && mh > 20 && _wrap) {
        // Calculate zoom to fit the marquee area into the viewport
        var availW = _wrap.clientWidth - 32;
        var availH = _wrap.clientHeight - 32;
        var zoomX = availW / mw;
        var zoomY = availH / mh;
        var newZoom = _zoom * Math.min(zoomX, zoomY);
        setZoom(newZoom);
      }
      _marqueeStart = null;
      _marqueeEnd = null;
      _redrawOverlay();
      return;
    }
    _isPanning = false;
  });
}

export function onOverlayClick(fn)     { _onOverlayClick = fn; }
export function onOverlayMouseMove(fn) { _onOverlayMouseMove = fn; }
export function getCurrentPage()       { return _currentPage; }
