/**
 * PDF-Parser — Polygon Measurement Tool
 */

import * as Viewer from "./canvas-viewer.mjs";
import * as ScaleManager from "./scale-manager.mjs";
import { POLY_COLORS, DEFAULT_DPI, M2_TO_FT2, AREA_EDGE, AREA_FILL, WIN_EDGE, WIN_FILL, POLYLINE_EDGE } from "./config.mjs";

var _polygons = {};
var _activePolyId = null,
  _activePage = 0;
var _colorIdx = 0,
  _nextId = 1,
  _nextWinId = 1,
  _nextLineId = 1;
var _undoStack = []; // snapshots for undo
var _redoStack = [];
var _onUndoPushCallback = null;

/** Register a callback invoked whenever polygon undo state is pushed. */
export function onUndoPush(fn) {
  _onUndoPushCallback = fn;
}

function _pushUndo(pageNum) {
  var polys = _polygons[pageNum] || [];
  _undoStack.push({
    pageNum: pageNum,
    snapshot: JSON.parse(JSON.stringify(polys))
  });
  _redoStack = []; // clear redo on new action
  if (_undoStack.length > 50) _undoStack.shift();
  if (_onUndoPushCallback) _onUndoPushCallback();
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

export function canUndo() {
  return _undoStack.length > 0;
}
export function canRedo() {
  return _redoStack.length > 0;
}

export function startPolygon(pageNum, label, opts) {
  if (!_polygons[pageNum]) _polygons[pageNum] = [];
  _pushUndo(pageNum);
  opts = opts || {};
  var type = opts.type || "area";
  var mode = opts.mode || "net";
  var defaultLabel, id;
  if (type === "window") {
    defaultLabel = "Window " + _nextWinId++;
    id = "win_" + Date.now();
  } else if (type === "polyline") {
    defaultLabel = "Line " + _nextLineId++;
    id = "line_" + Date.now();
  } else {
    defaultLabel = "Area " + _nextId++;
    id = "poly_" + Date.now();
  }
  _polygons[pageNum].push({
    id: id,
    label: label || defaultLabel,
    vertices: [],
    closed: false,
    type: type,
    mode: mode,
    color: POLY_COLORS[_colorIdx % POLY_COLORS.length],
    // Phase 4b.1 — bridge fields (null when not classified)
    component: opts.component || null,
    depth_m: opts.depth_m != null ? opts.depth_m : null,
    sheet_id: opts.sheet_id || null,
    sheet_class: opts.sheet_class || null,
    assembly_preset: opts.assembly_preset || null,
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
  if (!poly) return;
  // Polylines "finalize" at ≥2 vertices; closed flag means "done drawing",
  // not geometrically closed. Areas/windows need ≥3 to form a polygon.
  var minVerts = poly.type === "polyline" ? 2 : 3;
  if (poly.vertices.length < minVerts) return;
  poly.closed = true;
  _activePolyId = null;
}

export function isNearFirstVertex(pt, thresholdPx) {
  var poly = _getActivePoly();
  if (!poly || poly.vertices.length < 3) return false;
  var first = poly.vertices[0];
  var scale = (DEFAULT_DPI * Viewer.getZoom()) / 72;
  var threshPdf = thresholdPx / scale;
  var dx = pt.x - first.x,
    dy = pt.y - first.y;
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

/**
 * Ray-casting point-in-polygon test.
 */
export function pointInPolygon(pt, vertices) {
  var inside = false;
  for (var i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    var xi = vertices[i].x,
      yi = vertices[i].y;
    var xj = vertices[j].x,
      yj = vertices[j].y;
    if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Arithmetic-mean centroid of a polygon.
 */
export function centroid(vertices) {
  var cx = 0,
    cy = 0;
  for (var i = 0; i < vertices.length; i++) {
    cx += vertices[i].x;
    cy += vertices[i].y;
  }
  return { x: cx / vertices.length, y: cy / vertices.length };
}

/**
 * Build wall-to-window association map for a page.
 * Windows are assigned to the smallest wall polygon whose boundary
 * contains the window's centroid. Unmatched windows are orphans.
 */
export function buildAssociationMap(pageNum) {
  var polys = _polygons[pageNum] || [];
  var walls = [],
    windowEntries = [];

  // Partition closed polygons — polyIdx is the raw array index for delete/rename.
  // Polylines are linear features (no area), so they don't participate in the
  // wall/window association.
  for (var i = 0; i < polys.length; i++) {
    if (!polys[i].closed) continue;
    if (polys[i].type === "polyline") continue;
    var m = getMeasurement(pageNum, i);
    if (!m) continue;
    var entry = { measurement: m, polyIdx: i, vertices: polys[i].vertices };
    if (polys[i].type === "window") {
      windowEntries.push(entry);
    } else {
      entry.children = [];
      walls.push(entry);
    }
  }

  var orphanWindows = [];

  for (var w = 0; w < windowEntries.length; w++) {
    var win = windowEntries[w];
    var winCenter = centroid(win.vertices);
    var bestWall = null;
    var bestArea = Infinity;

    for (var a = 0; a < walls.length; a++) {
      if (pointInPolygon(winCenter, walls[a].vertices)) {
        var wallArea = walls[a].measurement.areaPdf || Infinity;
        if (wallArea < bestArea) {
          bestArea = wallArea;
          bestWall = walls[a];
        }
      }
    }

    if (bestWall) {
      bestWall.children.push({ measurement: win.measurement, polyIdx: win.polyIdx });
    } else {
      orphanWindows.push({ measurement: win.measurement, polyIdx: win.polyIdx });
    }
  }

  return { walls: walls, orphanWindows: orphanWindows };
}

export function getMeasurement(pageNum, polyIdx) {
  var polys = _polygons[pageNum];
  if (!polys || !polys[polyIdx]) return null;
  var poly = polys[polyIdx];
  if (!poly.closed) return null;
  var calibrated = ScaleManager.isCalibrated(pageNum);

  // Shared bridge fields — null when the polygon has not been classified.
  var bridge = {
    component: poly.component || null,
    depth_m: poly.depth_m != null ? poly.depth_m : null,
    sheet_id: poly.sheet_id || null,
    sheet_class: poly.sheet_class || null,
    assembly_preset: poly.assembly_preset || null
  };

  if (poly.type === "polyline") {
    // Polylines are linear — length only, no area.
    var lenPdf = computePerimeterPdf(poly.vertices, false);
    var lenM = ScaleManager.pdfToMetres(pageNum, lenPdf);
    return {
      id: poly.id,
      label: poly.label,
      type: "polyline",
      mode: poly.mode || "net",
      lengthM: lenM,
      lengthFt: lenM !== null ? lenM / 0.3048 : null,
      vertexCount: poly.vertices.length,
      perimPdf: lenPdf,
      calibrated: calibrated,
      component: bridge.component,
      depth_m: bridge.depth_m,
      sheet_id: bridge.sheet_id,
      sheet_class: bridge.sheet_class,
      assembly_preset: bridge.assembly_preset
    };
  }

  var areaPdf = computeAreaPdf(poly.vertices);
  var perimPdf = computePerimeterPdf(poly.vertices, true);
  var areaM2 = ScaleManager.pdfAreaToM2(pageNum, areaPdf);
  var perimM = ScaleManager.pdfToMetres(pageNum, perimPdf);
  return {
    id: poly.id,
    label: poly.label,
    type: poly.type || "area",
    mode: poly.mode || "net",
    areaM2: areaM2,
    areaFt2: areaM2 !== null ? areaM2 * M2_TO_FT2 : null,
    perimeterM: perimM,
    vertexCount: poly.vertices.length,
    areaPdf: areaPdf,
    perimPdf: perimPdf,
    calibrated: calibrated,
    component: bridge.component,
    depth_m: bridge.depth_m,
    sheet_id: bridge.sheet_id,
    sheet_class: bridge.sheet_class,
    assembly_preset: bridge.assembly_preset
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

var _netAreaCache = {}; // populated per draw cycle, keyed by polygon id

export function draw(ctx, pageNum) {
  var polys = _polygons[pageNum] || [];

  // Build net-area cache for walls with child windows
  _netAreaCache = {};
  var assoc = buildAssociationMap(pageNum);
  for (var w = 0; w < assoc.walls.length; w++) {
    var wall = assoc.walls[w];
    if (wall.children.length > 0 && wall.measurement.areaM2 !== null) {
      var netM2 = wall.measurement.areaM2;
      var netFt2 = wall.measurement.areaFt2;
      for (var c = 0; c < wall.children.length; c++) {
        var child = wall.children[c];
        if (child.measurement.areaM2 !== null) {
          if (child.measurement.mode !== "add") {
            netM2 -= child.measurement.areaM2;
            netFt2 -= child.measurement.areaFt2;
          } else {
            netM2 += child.measurement.areaM2;
            netFt2 += child.measurement.areaFt2;
          }
        }
      }
      _netAreaCache[wall.measurement.id] = { netM2: netM2, netFt2: netFt2 };
    }
  }

  for (var i = 0; i < polys.length; i++) _drawPoly(ctx, polys[i]);
}

function _drawPoly(ctx, poly) {
  var verts = poly.vertices;
  if (verts.length === 0) return;

  ctx.save();

  // Edge colour: cyan for areas, gold for windows, red for polylines (no fill).
  var isWindow = poly.type === "window";
  var isPolyline = poly.type === "polyline";
  var edgeColor = isPolyline ? POLYLINE_EDGE : isWindow ? WIN_EDGE : AREA_EDGE;
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
  // Polylines never geometrically close or fill — they are linear features.
  if (poly.closed && !isPolyline) {
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
    ctx.fillStyle = j === 0 && !poly.closed && verts.length >= 3 ? "#00ff00" : edgeColor;
    ctx.fill();
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (poly.closed && verts.length > 0) {
    var cx = 0,
      cy = 0;
    for (var k = 0; k < verts.length; k++) {
      cx += verts[k].x;
      cy += verts[k].y;
    }
    var center = Viewer.pdfToCanvas({ x: cx / verts.length, y: cy / verts.length });

    // Measurement text — walls with children show net area; polylines show length.
    var line2 = "",
      line3 = "";
    if (isPolyline) {
      var lenPdf = computePerimeterPdf(verts, false);
      var lenM = ScaleManager.pdfToMetres(poly._pageNum || 0, lenPdf);
      if (lenM !== null) {
        line2 = lenM.toFixed(2) + " m";
        line3 = (lenM / 0.3048).toFixed(2) + " ft";
      } else {
        line2 = "(uncalibrated)";
      }
    } else {
      var areaPdf = computeAreaPdf(verts);
      var areaM2 = ScaleManager.pdfAreaToM2(poly._pageNum || 0, areaPdf);
      var netOverride = _netAreaCache[poly.id];
      if (areaM2 !== null) {
        var displayM2 = netOverride && !isWindow ? netOverride.netM2 : areaM2;
        var displayFt2 = netOverride && !isWindow ? netOverride.netFt2 : areaM2 * M2_TO_FT2;
        line2 = displayM2.toFixed(1) + " m\u00B2" + (netOverride && !isWindow ? " net" : "");
        line3 = displayFt2.toFixed(1) + " ft\u00B2";
      } else {
        line2 = "(uncalibrated)";
      }
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

    // Line 2: metric measurement — cyan for areas, gold for windows, red for polylines.
    ctx.font = "20px Helvetica Neue, sans-serif";
    ctx.fillStyle = isPolyline ? POLYLINE_EDGE : isWindow ? WIN_EDGE : AREA_EDGE;
    var y2 = y1 + 24;
    ctx.fillText(line2, center.x, y2);

    // Line 3: imperial measurement — lighter variant.
    if (line3) {
      ctx.fillStyle = isPolyline ? "rgba(230, 57, 70, 0.65)" : isWindow ? "rgba(255, 215, 0, 0.65)" : "rgba(0, 229, 255, 0.65)";
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

// Mutate the bridge-relevant metadata on an existing polygon. Used by the
// inline Tag / Preset selects in the sidebar + Summary Table so a user can
// re-classify a polygon without re-drawing it.
export function setComponent(pageNum, polyIdx, component) {
  var polys = _polygons[pageNum];
  if (!polys || !polys[polyIdx]) return;
  polys[polyIdx].component = component || null;
  // Preset only makes sense for wall-ish components; clear it if the new tag
  // doesn't carry an assembly concept, so stale presets don't silently ride
  // along after a re-classification.
  if (!_componentCarriesPreset(component)) polys[polyIdx].assembly_preset = null;
}

export function setAssemblyPreset(pageNum, polyIdx, preset) {
  var polys = _polygons[pageNum];
  if (!polys || !polys[polyIdx]) return;
  polys[polyIdx].assembly_preset = preset || null;
}

// Per-polygon depth (m). Currently meaningful only for `pad_pier` polygons,
// where it multiplies the plan area into a volume via the sumAreaTimesDepth
// aggregator in polygon-map.mjs. Stored as a Number (not string) so the
// aggregator can read directly; null when unset.
export function setDepth(pageNum, polyIdx, depth_m) {
  var polys = _polygons[pageNum];
  if (!polys || !polys[polyIdx]) return;
  if (depth_m === null || depth_m === undefined || depth_m === "") {
    polys[polyIdx].depth_m = null;
    return;
  }
  var n = Number(depth_m);
  polys[polyIdx].depth_m = isFinite(n) && n > 0 ? n : null;
}

// Component tags whose aggregator consumes `depth_m`. Only `pad_pier` today
// (plan-area × depth → volume). Extending this set tomorrow means adding a
// depth-consuming aggregator path in polygon-map.mjs, not just listing the
// tag here.
var _DEPTH_BEARING_COMPONENTS = {
  pad_pier: true
};

export function componentCarriesDepth(component) {
  return !!(component && _DEPTH_BEARING_COMPONENTS[component]);
}

var _ASSEMBLY_BEARING_COMPONENTS = {
  wall_exterior: true,
  wall_party: true,
  wall_interior: true,
  exterior_perimeter: true
};

export function componentCarriesPreset(component) {
  return _componentCarriesPreset(component);
}

function _componentCarriesPreset(component) {
  return !!(component && _ASSEMBLY_BEARING_COMPONENTS[component]);
}

export function getPolygons(pageNum) {
  return _polygons[pageNum] || [];
}
export function isDrawing() {
  return _activePolyId !== null;
}

/* ── Vertex dragging ──────────────────────────────────── */

var _dragState = null; // { pageNum, polyIdx, vertIdx }

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
  var dx = b.x - a.x,
    dy = b.y - a.y;
  var len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    var d = Math.sqrt(Math.pow(pt.x - a.x, 2) + Math.pow(pt.y - a.y, 2));
    return { x: a.x, y: a.y, distance: d };
  }
  var t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2));
  var px = a.x + t * dx,
    py = a.y + t * dy;
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

export function isDragging() {
  return _dragState !== null;
}

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
  _nextWinId = 1;
  _nextLineId = 1;
  _undoStack = [];
  _redoStack = [];
}

/**
 * Load polygons from a saved project (import).
 * Replaces current polygons for the given page and resets counters.
 */
export function loadPolygons(pageNum, polygons) {
  _polygons[pageNum] = (polygons || []).map(function (p) {
    return {
      id: p.id || "poly_" + Date.now(),
      label: p.label || "Area",
      vertices: p.vertices || [],
      closed: p.closed !== false,
      type: p.type || "area",
      mode: p.mode || "net",
      color: POLY_COLORS[_colorIdx++ % POLY_COLORS.length],
      component: p.component || null,
      depth_m: p.depth_m != null ? p.depth_m : null,
      sheet_id: p.sheet_id || null,
      sheet_class: p.sheet_class || null,
      assembly_preset: p.assembly_preset || null,
      _pageNum: pageNum
    };
  });
  // Update counters to avoid ID collisions
  var areaCount = 0,
    winCount = 0,
    lineCount = 0;
  for (var i = 0; i < _polygons[pageNum].length; i++) {
    var t = _polygons[pageNum][i].type;
    if (t === "window") winCount++;
    else if (t === "polyline") lineCount++;
    else areaCount++;
  }
  if (areaCount >= _nextId) _nextId = areaCount + 1;
  if (winCount >= _nextWinId) _nextWinId = winCount + 1;
  if (lineCount >= _nextLineId) _nextLineId = lineCount + 1;
}
