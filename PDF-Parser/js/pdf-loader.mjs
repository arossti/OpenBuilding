/**
 * PDF-Parser — PDF Loading & Page Rendering
 * Wraps PDF.js 4.x ESM API.
 */

import * as pdfjsLib from "../lib/pdf.min.mjs";
import { DEFAULT_DPI, THUMB_WIDTH } from "./config.mjs";

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.mjs";

var _doc = null;
var _pages = [];
var _pageCount = 0;

export function loadFromBuffer(buffer) {
  var loadingTask = pdfjsLib.getDocument({ data: buffer });
  return loadingTask.promise.then(function (doc) {
    _doc = doc;
    _pageCount = doc.numPages;
    _pages = new Array(_pageCount + 1);
    return { pageCount: _pageCount };
  });
}

export function getPage(pageNum) {
  if (_pages[pageNum]) return Promise.resolve(_pages[pageNum]);
  return _doc.getPage(pageNum).then(function (page) {
    _pages[pageNum] = page;
    return page;
  });
}

var _currentRenderTask = null;

export function renderPage(pageNum, canvas, dpi) {
  dpi = dpi || DEFAULT_DPI;
  // Cancel any in-progress render to avoid "Cannot use same canvas" error
  if (_currentRenderTask) {
    _currentRenderTask.cancel();
    _currentRenderTask = null;
  }
  return getPage(pageNum).then(function (page) {
    var viewport = page.getViewport({ scale: dpi / 72 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    var ctx = canvas.getContext("2d");
    var task = page.render({ canvasContext: ctx, viewport: viewport });
    _currentRenderTask = task;
    return task.promise
      .then(function () {
        _currentRenderTask = null;
        return { width: viewport.width, height: viewport.height, viewport: viewport };
      })
      .catch(function (err) {
        _currentRenderTask = null;
        if (err && err.name === "RenderingCancelledException") return null;
        throw err;
      });
  });
}

export function renderThumbnail(pageNum, canvas, maxWidth) {
  maxWidth = maxWidth || THUMB_WIDTH;
  return getPage(pageNum).then(function (page) {
    var baseViewport = page.getViewport({ scale: 1 });
    var thumbScale = maxWidth / baseViewport.width;
    var viewport = page.getViewport({ scale: thumbScale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    var ctx = canvas.getContext("2d");
    return page.render({ canvasContext: ctx, viewport: viewport }).promise;
  });
}

export function getTextContent(pageNum) {
  return getPage(pageNum).then(function (page) {
    return page.getTextContent().then(function (content) {
      var viewport = page.getViewport({ scale: 1 });
      return content.items.map(function (item) {
        var tx = item.transform;
        return {
          str: item.str,
          x: tx[4],
          y: viewport.height - tx[5],
          width: item.width,
          height: item.height,
          fontName: item.fontName || "",
          fontSize: Math.abs(tx[3])
        };
      });
    });
  });
}

export function getOperatorList(pageNum) {
  return getPage(pageNum).then(function (page) {
    return page.getOperatorList();
  });
}

/**
 * Get the viewport transform matrix for a page at scale 1.
 * This transforms PDF user-space coordinates → canvas coordinates.
 * Returns [a, b, c, d, e, f] (standard 2D affine transform).
 */
export function getViewportTransform(pageNum) {
  return getPage(pageNum).then(function (page) {
    var vp = page.getViewport({ scale: 1 });
    return vp.transform; // [scaleX, skewY, skewX, scaleY, translateX, translateY]
  });
}

export function getPageSize(pageNum) {
  return getPage(pageNum).then(function (page) {
    var vp = page.getViewport({ scale: 1 });
    return { width: vp.width, height: vp.height };
  });
}

export function getOPS() {
  return pdfjsLib.OPS;
}

export function reset() {
  if (_doc) _doc.destroy();
  _doc = null;
  _pages = [];
  _pageCount = 0;
}

export function getPageCount() {
  return _pageCount;
}
export function isLoaded() {
  return _doc !== null;
}
