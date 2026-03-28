/**
 * PDF-Parser — Polygon Measurement Tool
 */

import * as Viewer from "./canvas-viewer.mjs";
import * as ScaleManager from "./scale-manager.mjs";
import { POLY_COLORS, DEFAULT_DPI, M2_TO_FT2, AREA_EDGE, AREA_FILL, WIN_EDGE, WIN_FILL } from "./config.mjs";

var _polygons = {};
var _activePolyId = null, _activePage = 0;
var _colorIdx = 0, _nextId = 1, _nextWinId = 1;
var _undoStack = [];   // snapshots for undo
var _redoStack = [];

function _pushUndo(pageNum) {
  var polys = _polygons[pageNum] || [];
  _undoStack.push({
    pageNum: pageNum,
    snapshot: JSON.parse(JSON.stringify(polys))
  });
  _redoStack = [];  // clear redo on new action
  if (_undoStack.length > 50) _undoStack.shift();
}

export function undo() {
  if (_undoStack.length === 0) return false;
  var entry = _undoStack.pop();
  // Save current state to redo
  _redoStack.push({
    pageNum: entry.pageNum,
    snapshot: JSON.parse(JSON.stringify(_polygons[entry.pageNum] || []))
  });
  _polygons[entry.pageNum] = entry.snapshot;
  _activePolyId = null;
  return entry.pageNum;
}

export function redo() {
  if (_redoStack.length === 0) return false;
  var entry = _redoStack.pop();
  _undoStack.push({
    pageNum: entry.pageNum,
    snapshot: JSON.parse(JSON.stringify(_polygons[entry.pageNum] || []))
  });
  _polygons[entry.pageNum] = entry.snapshot;
  _activePolyId = null;
  return entry.pageNum;
}

export function canUndo() { return _undoStack.length > 0; }
export function canRedo() { return _redoStack.length > 0; }

export function startPolygon(pageNum, label, opts) {
  if (!_polygons[pageNum]) _polygons[pageNum] = [];
  _pushUndo(pageNum);
  var type = (opts && opts.type) || "area";
  var mode = (opts && opts.mode) || "net";
  var defaultLabel = type === "window"
    ? "Window " + (_nextWinId++)
    : "Area " + (_nextId++);
  // Keep counters in sync — only increment the relevant one
  if (type !== "window") { /* _nextId already incremented */ }
  var id = (type === "window" ? "win_" : "poly_") + Date.now();
  _polygons[pageNum].push({
    id: id, label: label || defaultLabel,
    vertices: [], closed: false,
    type: type, mode: mode,
    color: POLY_COLORS[_colorIdx % POLY_COLORS.length],
    _pageNum: pageNum
  });
  _colorIdx++;
  _activePolyId = id;
  _activePage = pageNum;
  return id;
}

export function addVertex(pt) {
  var poly = _getActivePoly();
  if (!poly || poly.closed) return;
  poly.vertices.push({ x: pt.x, y: pt.y });
}

export function closePolygon() {
  var poly = _getActivePoly();
  if (!poly || poly.vertices.length < 3) return;
  poly.closed = true;
  _activePolyId = null;
}

export function isNearFirstVertex(pt, thresholdPx) {
  var poly = _getActivePoly();
  if (!poly || poly.vertices.length < 3) return false;
  var first = poly.vertices[0];
  var scale = (DEFAULT_DPI * Viewer.getZoom()) / 72;
  var threshPdf = thresholdPx / scale;
  var dx = pt.x - first.x, dy = pt.y - first.y;
  return Math.sqrt(dx * dx + dy * dy) < threshPdf;
}

export function computeAreaPdf(vertices) {
  var n = vertices.length;
  if (n < 3) return 0;
  var area = 0;
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area) / 2;
}

export function computePerimeterPdf(vertices, closed) {
  var perim = 0;
  for (var i = 0; i < vertices.length - 1; i++) {
    var dx = vertices[i + 1].x - vertices[i].x;
    var dy = vertices[i + 1].y - vertices[i].y;
    perim += Math.sqrt(dx * dx + dy * dy);
  }
  if (closed && vertices.length > 2) {
    var dx2 = vertices[0].x - vertices[vertices.length - 1].x;
    var dy2 = vertices[0].y - vertices[vertices.length - 1].y;
    perim += Math.sqrt(dx2 * dx2 + dy2 * dy2);
  }
  return perim;
}

export function getMeasurement(pageNum, polyIdx) {
  var polys = _polygons[pageNum];
  if (!polys || !polys[polyIdx]) return null;
  var poly = polys[polyIdx];
  if (!poly.closed) return null;
  var areaPdf  = computeAreaPdf(poly.vertices);
  var perimPdf = computePerimeterPdf(poly.vertices, true);
  var areaM2   = ScaleManager.pdfAreaToM2(pageNum, areaPdf);
  var perimM   = ScaleManager.pdfToMetres(pageNum, perimPdf);
  var calibrated = ScaleManager.isCalibrated(pageNum);
  return {
    id: poly.id, label: poly.label,
    type: poly.type || "area", mode: poly.mode || "net",
    areaM2: areaM2, areaFt2: areaM2 !== null ? areaM2 * M2_TO_FT2 : null,
    perimeterM: perimM, vertexCount: poly.vertices.length,
    areaPdf: areaPdf, perimPdf: perimPdf, calibrated: calibrated
  };
}

export function getAllMeasurements(pageNum) {
  var polys = _polygons[pageNum] || [];
  var results = [];
  for (var i = 0; i < polys.length; i++) {
    var m = getMeasurement(pageNum, i);
    if (m) results.push(m);
  }
  return results;
}

export function draw(ctx, pageNum) {
  var polys = _polygons[pageNum] || [];
  for (var i = 0; i < polys.length; i++) _drawPoly(ctx, polys[i]);
}

function _drawPoly(ctx, poly) {
  var verts = poly.vertices;
  if (verts.length === 0) return;

  ctx.save();

  // Edge colour: cyan for areas, gold for windows
  var isWindow = (poly.type === "window");
  var edgeColor = isWindow ? WIN_EDGE : AREA_EDGE;
  var fillColor = isWindow ? WIN_FILL : AREA_FILL;
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 3;

  ctx.beginPath();
  var p0 = Viewer.pdfToCanvas(verts[0]);
  ctx.moveTo(p0.x, p0.y);
  for (var i = 1; i < verts.length; i++) {
    var pi = Viewer.pdfToCanvas(verts[i]);
    ctx.lineTo(pi.x, pi.y);
  }
  if (poly.closed) {
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  ctx.stroke();

  // Vertex handles
  for (var j = 0; j < verts.length; j++) {
    var pj = Viewer.pdfToCanvas(verts[j]);
    ctx.beginPath();
    ctx.arc(pj.x, pj.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = (j === 0 && !poly.closed && verts.length >= 3) ? "#00ff00" : edgeColor;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (poly.closed && verts.length > 0) {
    var cx = 0, cy = 0;
    for (var k = 0; k < verts.length; k++) { cx += verts[k].x; cy += verts[k].y; }
    var center = Viewer.pdfToCanvas({ x: cx / verts.length, y: cy / verts.length });

    // Compute area text for the label — show both m² and ft²
    var areaPdf = computeAreaPdf(verts);
    var areaM2 = ScaleManager.pdfAreaToM2(poly._pageNum || 0, areaPdf);
    var line2 = "", line3 = "";
    if (areaM2 !== null) {
      var areaFt2 = areaM2 * M2_TO_FT2;
      line2 = areaM2.toFixed(1) + " m\u00B2";
      line3 = areaFt2.toFixed(1) + " ft\u00B2";
    } else {
      line2 = "(uncalibrated)";
    }

    // Background pill — large, high-contrast, 3 lines
    var line1 = poly.label;
    ctx.font = "bold 24px Helvetica Neue, sans-serif";
    var w1 = ctx.measureText(line1).width;
    ctx.font = "20px Helvetica Neue, sans-serif";
    var w2 = ctx.measureText(line2).width;
    var w3 = line3 ? ctx.measureText(line3).width : 0;
    var maxW = Math.max(w1, w2, w3);
    var pillW = maxW + 20;
    var pillH = line3 ? 80 : 58;
    var pillTop = center.y - pillH / 2 - 2;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.beginPath();
    ctx.roundRect(center.x - pillW / 2, pillTop, pillW, pillH, 6);
    ctx.fill();

    // Line 1: label — white
    ctx.font = "bold 24px Helvetica Neue, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    var y1 = pillTop + 22;
    ctx.fillText(line1, center.x, y1);

    // Line 2: metric area — cyan for areas, gold for windows
    ctx.font = "20px Helvetica Neue, sans-serif";
    ctx.fillStyle = isWindow ? WIN_EDGE : AREA_EDGE;
    var y2 = y1 + 24;
    ctx.fillText(line2, center.x, y2);

    // Line 3: imperial area — lighter variant
    if (line3) {
      ctx.fillStyle = isWindow ? "rgba(255, 215, 0, 0.65)" : "rgba(0, 229, 255, 0.65)";
      var y3 = y2 + 22;
      ctx.fillText(line3, center.x, y3);
    }
  }

  ctx.restore();
}

export function deletePolygon(pageNum, polyIdx) {
  var polys = _polygons[pageNum];
  if (polys && polys[polyIdx]) {
    _pushUndo(pageNum);
    polys.splice(polyIdx, 1);
  }
}

export function deleteLastPolygon(pageNum) {
  var polys = _polygons[pageNum];
  if (polys && polys.length > 0) {
    _pushUndo(pageNum);
    polys.pop();
    _activePolyId = null;
  }
}

export function renamePolygon(pageNum, polyIdx, newLabel) {
  var polys = _polygons[pageNum];
  if (polys && polys[polyIdx]) polys[polyIdx].label = newLabel;
}

export function getPolygons(pageNum) { return _polygons[pageNum] || []; }
export function isDrawing() { return _activePolyId !== null; }

/* ── Vertex dragging ──────────────────────────────────── */

var _dragState = null;  // { pageNum, polyIdx, vertIdx }

/**
 * Hit-test: find a vertex near the given PDF coordinate.
 * @param {number} pageNum
 * @param {Object} pt — {x, y} in PDF coords
 * @param {number} radiusPdf — search radius in PDF points
 * @returns {Object|null} — { polyIdx, vertIdx, poly } or null
 */
export function hitTestVertex(pageNum, pt, radiusPdf) {
  var polys = _polygons[pageNum] || [];
  for (var i = 0; i < polys.length; i++) {
    if (!polys[i].closed) continue;
    var verts = polys[i].vertices;
    for (var j = 0; j < verts.length; j++) {
      var dx = verts[j].x - pt.x;
      var dy = verts[j].y - pt.y;
      if (Math.sqrt(dx * dx + dy * dy) < radiusPdf) {
        return { polyIdx: i, vertIdx: j, poly: polys[i] };
      }
    }
  }
  return null;
}

/**
 * Hit-test: find an edge near the given PDF coordinate.
 * Returns the edge (defined by the index of its first vertex) and
 * the closest point on that edge.
 * @param {number} pageNum
 * @param {Object} pt — {x, y} in PDF coords
 * @param {number} radiusPdf — search radius in PDF points
 * @returns {Object|null} — { polyIdx, edgeIdx, point: {x,y} } or null
 */
export function hitTestEdge(pageNum, pt, radiusPdf) {
  var polys = _polygons[pageNum] || [];
  var best = null;
  var bestDist = radiusPdf;

  for (var i = 0; i < polys.length; i++) {
    if (!polys[i].closed) continue;
    var verts = polys[i].vertices;
    var n = verts.length;
    for (var j = 0; j < n; j++) {
      var k = (j + 1) % n;
      var proj = _projectPointOnSegment(pt, verts[j], verts[k]);
      if (proj.distance < bestDist) {
        bestDist = proj.distance;
        best = { polyIdx: i, edgeIdx: j, point: { x: proj.x, y: proj.y } };
      }
    }
  }
  return best;
}

function _projectPointOnSegment(pt, a, b) {
  var dx = b.x - a.x, dy = b.y - a.y;
  var len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    var d = Math.sqrt(Math.pow(pt.x - a.x, 2) + Math.pow(pt.y - a.y, 2));
    return { x: a.x, y: a.y, distance: d };
  }
  var t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
  var px = a.x + t * dx, py = a.y + t * dy;
  return { x: px, y: py, distance: Math.sqrt(Math.pow(pt.x - px, 2) + Math.pow(pt.y - py, 2)) };
}

/**
 * Insert a new vertex on an edge of a closed polygon.
 * @param {number} pageNum
 * @param {number} polyIdx
 * @param {number} edgeIdx — index of the first vertex of the edge
 * @param {Object} pt — {x, y} position for the new vertex
 * @returns {number} — the index of the newly inserted vertex
 */
export function insertVertex(pageNum, polyIdx, edgeIdx, pt) {
  var polys = _polygons[pageNum];
  if (!polys || !polys[polyIdx]) return -1;
  _pushUndo(pageNum);
  var insertIdx = edgeIdx + 1;
  polys[polyIdx].vertices.splice(insertIdx, 0, { x: pt.x, y: pt.y });
  return insertIdx;
}

/**
 * Start dragging a vertex. Saves undo state.
 */
export function startDrag(pageNum, polyIdx, vertIdx) {
  _pushUndo(pageNum);
  _dragState = { pageNum: pageNum, polyIdx: polyIdx, vertIdx: vertIdx };
}

/**
 * Move the dragged vertex to a new position.
 */
export function moveDrag(pt) {
  if (!_dragState) return;
  var polys = _polygons[_dragState.pageNum];
  if (!polys || !polys[_dragState.polyIdx]) return;
  polys[_dragState.polyIdx].vertices[_dragState.vertIdx] = { x: pt.x, y: pt.y };
}

/**
 * End the drag. If the dragged vertex is near another vertex on the
 * same polygon, merge them (remove the dragged vertex).
 * @param {number} mergeRadiusPdf — distance threshold for merge
 * @returns {boolean} — true if a merge occurred
 */
export function endDrag(mergeRadiusPdf) {
  if (!_dragState) return false;
  mergeRadiusPdf = mergeRadiusPdf || 5;

  var polys = _polygons[_dragState.pageNum];
  var poly = polys && polys[_dragState.polyIdx];
  var merged = false;

  if (poly && poly.vertices.length > 3) {
    var dragVert = poly.vertices[_dragState.vertIdx];
    var n = poly.vertices.length;

    for (var i = 0; i < n; i++) {
      if (i === _dragState.vertIdx) continue;
      var other = poly.vertices[i];
      var dx = dragVert.x - other.x;
      var dy = dragVert.y - other.y;
      if (Math.sqrt(dx * dx + dy * dy) < mergeRadiusPdf) {
        // Remove the dragged vertex — it collapses onto the other one
        poly.vertices.splice(_dragState.vertIdx, 1);
        merged = true;
        break;
      }
    }
  }

  _dragState = null;
  return merged;
}

export function isDragging() { return _dragState !== null; }

function _getActivePoly() {
  if (!_activePolyId) return null;
  var polys = _polygons[_activePage] || [];
  for (var i = 0; i < polys.length; i++) {
    if (polys[i].id === _activePolyId) return polys[i];
  }
  return null;
}

export function reset() {
  _polygons = {};
  _activePolyId = null;
  _colorIdx = 0;
  _nextId = 1;
  _undoStack = [];
  _redoStack = [];
}
