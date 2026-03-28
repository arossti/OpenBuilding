/**
 * PDF-Parser — Vector Geometry Extraction & Snap
 */

import * as Loader from "./pdf-loader.mjs";
import { computeAreaPdf } from "./polygon-tool.mjs";

var _geometry = {};

export function extractGeometry(pageNum) {
  if (_geometry[pageNum]) return Promise.resolve(_geometry[pageNum]);

  return Promise.all([
    Loader.getOperatorList(pageNum),
    Loader.getViewportTransform(pageNum),
    Loader.getPageSize(pageNum)
  ]).then(function(results) {
    var ops = results[0];
    var vpTx = results[1];  // [a, b, c, d, e, f]
    var pageSize = results[2];

    // Log the viewport transform for debugging
    if (!_geometry._txLogged) {
      _geometry._txLogged = true;
      console.log("[VectorSnap] Viewport transform:", JSON.stringify(vpTx));
      console.log("[VectorSnap] Page size:", pageSize.width + "x" + pageSize.height);
    }

    // The viewport transform converts PDF user-space → rendered canvas space.
    // For a standard page: [1, 0, 0, -1, 0, pageHeight] (scale 1, flip Y, translate)
    // For rotated or offset pages this will differ.
    //
    // However, getOperatorList returns coords in the page's content stream space,
    // which may already include page-level transforms. PDF.js's canvas renderer
    // applies the viewport transform during rendering.
    //
    // For our purposes: apply the viewport transform to get canvas-space coords
    // that match what eventToPdfCoords returns (which divides canvas pixels by renderScale).
    function tp(x, y) {
      // Apply viewport transform then divide by 1 (scale=1 viewport)
      // This gives us coordinates in PDF points as seen on the rendered canvas
      var cx = vpTx[0] * x + vpTx[2] * y + vpTx[4];
      var cy = vpTx[1] * x + vpTx[3] * y + vpTx[5];
      return { x: cx, y: cy };
    }
    var OPS = Loader.getOPS();

    // Diagnostic: log what OPS constants we're using and what's in the stream
    if (!_geometry._logged) {
      _geometry._logged = true;
      var fnCounts = {};
      for (var d = 0; d < ops.fnArray.length; d++) {
        fnCounts[ops.fnArray[d]] = (fnCounts[ops.fnArray[d]] || 0) + 1;
      }
      console.log("[VectorSnap] OPS constants:", JSON.stringify({
        moveTo: OPS.moveTo, lineTo: OPS.lineTo, rectangle: OPS.rectangle,
        closePath: OPS.closePath, stroke: OPS.stroke, fill: OPS.fill,
        constructPath: OPS.constructPath
      }));
      console.log("[VectorSnap] Operator frequency on page " + pageNum + ":", JSON.stringify(fnCounts));
      console.log("[VectorSnap] Total operators:", ops.fnArray.length);
    }

    var segments = [], closedPaths = [];
    var currentPath = [];
    var curX = 0, curY = 0, pathStartX = 0, pathStartY = 0;

    for (var i = 0; i < ops.fnArray.length; i++) {
      var fn = ops.fnArray[i], args = ops.argsArray[i];

      // PDF.js 4.x batches path ops into constructPath
      if (fn === OPS.constructPath) {
        // args[0] = array of sub-op codes, args[1] = array of coordinates
        var subOps = args[0];
        var coords = args[1];
        var ci = 0;  // coordinate index

        for (var s = 0; s < subOps.length; s++) {
          var subOp = subOps[s];

          if (subOp === OPS.moveTo) {
            var mp = tp(coords[ci++], coords[ci++]);
            curX = mp.x; curY = mp.y;
            pathStartX = curX; pathStartY = curY;
            if (currentPath.length >= 2) _addPathSegments(currentPath, segments);
            currentPath = [{ x: curX, y: curY }];
          } else if (subOp === OPS.lineTo) {
            var lp = tp(coords[ci++], coords[ci++]);
            curX = lp.x; curY = lp.y;
            currentPath.push({ x: curX, y: curY });
          } else if (subOp === OPS.curveTo || subOp === OPS.curveTo2 || subOp === OPS.curveTo3) {
            var numCoords = (subOp === OPS.curveTo) ? 6 : 4;
            var cp = tp(coords[ci + numCoords - 2], coords[ci + numCoords - 1]);
            curX = cp.x; curY = cp.y;
            ci += numCoords;
            currentPath.push({ x: curX, y: curY });
          } else if (subOp === OPS.rectangle) {
            var rawX = coords[ci++], rawY = coords[ci++], rawW = coords[ci++], rawH = coords[ci++];
            if (currentPath.length >= 2) _addPathSegments(currentPath, segments);
            currentPath = [];
            var r0 = tp(rawX, rawY), r1 = tp(rawX + rawW, rawY);
            var r2 = tp(rawX + rawW, rawY + rawH), r3 = tp(rawX, rawY + rawH);
            var rect = [r0, r1, r2, r3];
            closedPaths.push(rect);
            _addPathSegments(rect.concat([rect[0]]), segments);
          } else if (subOp === OPS.closePath) {
            if (currentPath.length >= 3) {
              currentPath.push({ x: pathStartX, y: pathStartY });
              closedPaths.push(currentPath.slice());
              _addPathSegments(currentPath, segments);
            }
            currentPath = [];
          }
        }
        continue;
      }

      // Legacy individual operators (PDF.js 3.x or simple PDFs)
      switch (fn) {
        case OPS.moveTo:
          var lmp = tp(args[0], args[1]);
          curX = lmp.x; curY = lmp.y;
          pathStartX = curX; pathStartY = curY;
          if (currentPath.length >= 2) _addPathSegments(currentPath, segments);
          currentPath = [{ x: curX, y: curY }];
          break;
        case OPS.lineTo:
          var llp = tp(args[0], args[1]);
          currentPath.push({ x: llp.x, y: llp.y });
          curX = llp.x; curY = llp.y;
          break;
        case OPS.rectangle:
          var lr0 = tp(args[0], args[1]), lr1 = tp(args[0] + args[2], args[1]);
          var lr2 = tp(args[0] + args[2], args[1] + args[3]), lr3 = tp(args[0], args[1] + args[3]);
          var rect2 = [lr0, lr1, lr2, lr3];
          closedPaths.push(rect2);
          _addPathSegments(rect2.concat([rect2[0]]), segments);
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
export function clearPage(pageNum) { delete _geometry[pageNum]; }
