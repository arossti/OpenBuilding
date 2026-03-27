/**
 * PDF-Parser — Vector Geometry Extraction & Snap
 */

import * as Loader from "./pdf-loader.mjs";
import { computeAreaPdf } from "./polygon-tool.mjs";

var _geometry = {};

export function extractGeometry(pageNum) {
  if (_geometry[pageNum]) return Promise.resolve(_geometry[pageNum]);

  return Loader.getOperatorList(pageNum).then(function(ops) {
    var OPS = Loader.getOPS();
    var segments = [], closedPaths = [];
    var currentPath = [];
    var curX = 0, curY = 0, pathStartX = 0, pathStartY = 0;

    for (var i = 0; i < ops.fnArray.length; i++) {
      var fn = ops.fnArray[i], args = ops.argsArray[i];

      switch (fn) {
        case OPS.moveTo:
          curX = args[0]; curY = args[1];
          pathStartX = curX; pathStartY = curY;
          if (currentPath.length >= 2) _addPathSegments(currentPath, segments);
          currentPath = [{ x: curX, y: curY }];
          break;
        case OPS.lineTo:
          currentPath.push({ x: args[0], y: args[1] });
          curX = args[0]; curY = args[1];
          break;
        case OPS.rectangle:
          var rx = args[0], ry = args[1], rw = args[2], rh = args[3];
          var rect = [{ x: rx, y: ry }, { x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh }];
          closedPaths.push(rect);
          _addPathSegments(rect.concat([rect[0]]), segments);
          break;
        case OPS.closePath:
          if (currentPath.length >= 3) {
            currentPath.push({ x: pathStartX, y: pathStartY });
            closedPaths.push(currentPath.slice());
            _addPathSegments(currentPath, segments);
          }
          currentPath = [];
          break;
        case OPS.stroke: case OPS.fill: case OPS.fillStroke: case OPS.eoFill: case OPS.eoFillStroke:
          if (currentPath.length >= 2) _addPathSegments(currentPath, segments);
          currentPath = [];
          break;
      }
    }

    var epMap = {};
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      var k1 = Math.round(seg.x1) + "," + Math.round(seg.y1);
      var k2 = Math.round(seg.x2) + "," + Math.round(seg.y2);
      if (!epMap[k1]) epMap[k1] = { x: seg.x1, y: seg.y1 };
      if (!epMap[k2]) epMap[k2] = { x: seg.x2, y: seg.y2 };
    }
    var endpoints = [];
    for (var key in epMap) endpoints.push(epMap[key]);

    var result = { segments: segments, endpoints: endpoints, closedPaths: closedPaths };
    _geometry[pageNum] = result;
    return result;
  });
}

function _addPathSegments(path, segments) {
  for (var i = 0; i < path.length - 1; i++) {
    segments.push({ x1: path[i].x, y1: path[i].y, x2: path[i + 1].x, y2: path[i + 1].y });
  }
}

/**
 * Find the nearest endpoint to a point.
 * @returns {Object|null} {x, y, distance, type: "endpoint"}
 */
export function findNearestEndpoint(pageNum, pt, radiusPdf) {
  var geo = _geometry[pageNum];
  if (!geo) return null;
  var best = null, bestDist = radiusPdf;
  for (var i = 0; i < geo.endpoints.length; i++) {
    var ep = geo.endpoints[i];
    var d = Math.sqrt(Math.pow(ep.x - pt.x, 2) + Math.pow(ep.y - pt.y, 2));
    if (d < bestDist) { bestDist = d; best = { x: ep.x, y: ep.y, distance: d, type: "endpoint" }; }
  }
  return best;
}

/**
 * Find the nearest point on any line segment.
 * @returns {Object|null} {x, y, distance, type: "line"}
 */
export function findNearestSegmentPoint(pageNum, pt, radiusPdf) {
  var geo = _geometry[pageNum];
  if (!geo) return null;
  var best = null, bestDist = radiusPdf;
  for (var i = 0; i < geo.segments.length; i++) {
    var seg = geo.segments[i];
    var proj = _projectOnSeg(pt, seg);
    if (proj.d < bestDist) {
      bestDist = proj.d;
      best = { x: proj.x, y: proj.y, distance: proj.d, type: "line" };
    }
  }
  return best;
}

function _projectOnSeg(pt, seg) {
  var dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
  var len2 = dx * dx + dy * dy;
  if (len2 === 0) return { x: seg.x1, y: seg.y1, d: Math.sqrt(Math.pow(pt.x - seg.x1, 2) + Math.pow(pt.y - seg.y1, 2)) };
  var t = Math.max(0, Math.min(1, ((pt.x - seg.x1) * dx + (pt.y - seg.y1) * dy) / len2));
  var px = seg.x1 + t * dx, py = seg.y1 + t * dy;
  return { x: px, y: py, d: Math.sqrt(Math.pow(pt.x - px, 2) + Math.pow(pt.y - py, 2)) };
}

/**
 * Find the best snap target: endpoint first (higher priority), then line.
 * @returns {Object|null} {x, y, distance, type: "endpoint"|"line"}
 */
export function findSnap(pageNum, pt, radiusPdf) {
  // Endpoints get priority — check at full radius
  var ep = findNearestEndpoint(pageNum, pt, radiusPdf);
  if (ep) return ep;
  // Fall back to nearest line point at slightly tighter radius
  return findNearestSegmentPoint(pageNum, pt, radiusPdf * 0.7);
}

/**
 * Get all closed paths for outline detection, sorted by area descending.
 * Filters out page-border-sized and tiny paths.
 */
export function getClosedPathsByArea(pageNum, pageWidth, pageHeight) {
  var geo = _geometry[pageNum];
  if (!geo) return [];
  var pageBorderArea = pageWidth * pageHeight;
  var results = [];
  for (var i = 0; i < geo.closedPaths.length; i++) {
    var path = geo.closedPaths[i];
    if (path.length < 4) continue;
    var area = computeAreaPdf(path);
    // Skip page borders (>85% of page) and tiny paths (<0.5% of page)
    if (area > pageBorderArea * 0.85 || area < pageBorderArea * 0.005) continue;
    results.push({ path: path, area: area });
  }
  results.sort(function(a, b) { return b.area - a.area; });
  return results;
}

export function detectOutline(pageNum) {
  return extractGeometry(pageNum).then(function(geo) {
    return Loader.getPageSize(pageNum).then(function(size) {
      var pageBorderArea = size.width * size.height;
      var best = null, bestArea = 0;
      for (var i = 0; i < geo.closedPaths.length; i++) {
        var path = geo.closedPaths[i];
        if (path.length < 4) continue;
        var area = computeAreaPdf(path);
        if (area > pageBorderArea * 0.9 || area < pageBorderArea * 0.01) continue;
        if (area > bestArea) { bestArea = area; best = path; }
      }
      return best;
    });
  });
}

export function reset() { _geometry = {}; }
