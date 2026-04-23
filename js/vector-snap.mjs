/**
 * PDF-Parser — Vector Geometry Extraction & Snap
 */

import * as Loader from "./pdf-loader.mjs";
import { computeAreaPdf } from "./polygon-tool.mjs";
import { walkOperatorList } from "./geometry-walk.mjs";

var _geometry = {};

export function extractGeometry(pageNum) {
  if (_geometry[pageNum]) return Promise.resolve(_geometry[pageNum]);

  return Promise.all([Loader.getOperatorList(pageNum), Loader.getViewportTransform(pageNum)]).then(function (results) {
    var ops = results[0];
    var vpTx = results[1]; // viewport transform [a,b,c,d,e,f]
    var OPS = Loader.getOPS();

    // Diagnostic log — fires once per session so the operator frequency
    // is available when debugging a wand failure on an unfamiliar PDF.
    if (!_geometry._logged) {
      _geometry._logged = true;
      var fnCounts = {};
      for (var d = 0; d < ops.fnArray.length; d++) {
        fnCounts[ops.fnArray[d]] = (fnCounts[ops.fnArray[d]] || 0) + 1;
      }
      console.log(
        "[VectorSnap] OPS constants:",
        JSON.stringify({
          moveTo: OPS.moveTo,
          lineTo: OPS.lineTo,
          rectangle: OPS.rectangle,
          closePath: OPS.closePath,
          stroke: OPS.stroke,
          fill: OPS.fill,
          constructPath: OPS.constructPath,
          save: OPS.save,
          restore: OPS.restore,
          transform: OPS.transform
        })
      );
      console.log("[VectorSnap] Operator frequency on page " + pageNum + ":", JSON.stringify(fnCounts));
      console.log("[VectorSnap] Total operators:", ops.fnArray.length);
    }

    var result = walkOperatorList(ops, vpTx, OPS);
    _geometry[pageNum] = result;
    return result;
  });
}

/**
 * Find the nearest endpoint to a point.
 * @returns {Object|null} {x, y, distance, type: "endpoint"}
 */
export function findNearestEndpoint(pageNum, pt, radiusPdf) {
  var geo = _geometry[pageNum];
  if (!geo) return null;
  var best = null,
    bestDist = radiusPdf;
  for (var i = 0; i < geo.endpoints.length; i++) {
    var ep = geo.endpoints[i];
    var d = Math.sqrt(Math.pow(ep.x - pt.x, 2) + Math.pow(ep.y - pt.y, 2));
    if (d < bestDist) {
      bestDist = d;
      best = { x: ep.x, y: ep.y, distance: d, type: "endpoint" };
    }
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
  var best = null,
    bestDist = radiusPdf;
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
  var dx = seg.x2 - seg.x1,
    dy = seg.y2 - seg.y1;
  var len2 = dx * dx + dy * dy;
  if (len2 === 0)
    return { x: seg.x1, y: seg.y1, d: Math.sqrt(Math.pow(pt.x - seg.x1, 2) + Math.pow(pt.y - seg.y1, 2)) };
  var t = Math.max(0, Math.min(1, ((pt.x - seg.x1) * dx + (pt.y - seg.y1) * dy) / len2));
  var px = seg.x1 + t * dx,
    py = seg.y1 + t * dy;
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
  var tooSmall = 0,
    tooBig = 0,
    tooFew = 0;

  for (var i = 0; i < geo.closedPaths.length; i++) {
    var path = geo.closedPaths[i];
    if (path.length < 4) {
      tooFew++;
      continue;
    }
    var area = computeAreaPdf(path);
    // Skip page borders (>95% of page) and very tiny paths (<0.1% of page)
    if (area > pageBorderArea * 0.95) {
      tooBig++;
      continue;
    }
    if (area < pageBorderArea * 0.001) {
      tooSmall++;
      continue;
    }
    results.push({ path: path, area: area });
  }

  console.log(
    "[VectorSnap] Closed path filter: " +
      geo.closedPaths.length +
      " total, " +
      tooFew +
      " too few verts, " +
      tooSmall +
      " too small (<0.1%), " +
      tooBig +
      " too big (>95%), " +
      results.length +
      " candidates passed." +
      " Page area: " +
      pageBorderArea.toFixed(0) +
      " pts²"
  );

  // Log top 5 areas for debugging
  results.sort(function (a, b) {
    return b.area - a.area;
  });
  for (var j = 0; j < Math.min(5, results.length); j++) {
    console.log(
      "  Candidate " +
        (j + 1) +
        ": " +
        results[j].path.length +
        " verts, area=" +
        results[j].area.toFixed(1) +
        " pts² (" +
        ((results[j].area / pageBorderArea) * 100).toFixed(2) +
        "% of page)"
    );
  }

  return results;
}

export function detectOutline(pageNum) {
  return extractGeometry(pageNum).then(function (geo) {
    return Loader.getPageSize(pageNum).then(function (size) {
      var pageBorderArea = size.width * size.height;
      var best = null,
        bestArea = 0;
      for (var i = 0; i < geo.closedPaths.length; i++) {
        var path = geo.closedPaths[i];
        if (path.length < 4) continue;
        var area = computeAreaPdf(path);
        if (area > pageBorderArea * 0.9 || area < pageBorderArea * 0.01) continue;
        if (area > bestArea) {
          bestArea = area;
          best = path;
        }
      }
      return best;
    });
  });
}

export function reset() {
  _geometry = {};
}
export function clearPage(pageNum) {
  delete _geometry[pageNum];
}
