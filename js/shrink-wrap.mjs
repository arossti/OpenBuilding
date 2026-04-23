/**
 * PDF-Parser — Shrink-Wrap (layer-peel classification)
 *
 * Pure module. Given a page's segments + text items + page size, peels
 * sheet-border geometry off the segment list and reports the drawing-
 * area bbox that C5's shrink-wrap sweep will start from.
 *
 *   pageBorder   — any segment with an endpoint within `edgeTolerance`
 *                  pt of a page edge. Sheet borders, margin lines, detail
 *                  frame bars.
 *
 *   drawing      — everything else. Wall geometry, dim lines, title
 *                  block vectors, interior annotations. All classified
 *                  together because position-based titleblock detection
 *                  over-matches on plans where dim callouts extend into
 *                  the TR/BR quadrant (ArchiCad exports especially). C5's
 *                  sweep distinguishes "long parallel orthogonal wall
 *                  segments" from "short fragmented titleblock vectors"
 *                  during the shrink-wrap, so there's no benefit to
 *                  pre-classifying titleblock here — only fragility.
 *
 * Position-based classification (not topology-based) — some CAD exports
 * (ArchiCad 3D flatten) produce a single mega-component containing the
 * sheet border, titleblock, and drawing geometry as one connected graph.
 * A topology-first classifier loses the distinctions; position-first
 * cuts through cleanly.
 *
 * No per-vendor profiles. One universal ruleset. Goal: give the user a
 * good-enough starting polygon they can refine, not a perfect one.
 */

var DEFAULT_EDGE_TOLERANCE = 15;

/**
 * @param {Array} segments   — [{x1,y1,x2,y2}]
 * @param {Array} textItems  — [{str, x, y, width, height}]  (unused in v1, reserved for later)
 * @param {number} pageW
 * @param {number} pageH
 * @param {Object} [opts]
 * @param {number} [opts.edgeTolerance=15]  — pts; a segment with any
 *                 endpoint within this distance of a page edge is
 *                 classified as pageBorder.
 * @returns {{
 *   pageBorderSegments, drawingSegments,
 *   drawingAreaBbox,
 *   summary
 * }}
 */
export function classifyLayers(segments, textItems, pageW, pageH, opts) {
  opts = opts || {};
  var edgeTol = opts.edgeTolerance != null ? opts.edgeTolerance : DEFAULT_EDGE_TOLERANCE;

  var pageBorderSegments = [];
  var drawingSegments = [];

  for (var i = 0; i < segments.length; i++) {
    var s = segments[i];
    var sb = _segBbox(s);
    if (_nearPageEdge(sb, pageW, pageH, edgeTol)) {
      pageBorderSegments.push(s);
    } else {
      drawingSegments.push(s);
    }
  }

  var drawingAreaBbox = null;
  if (drawingSegments.length > 0) {
    drawingAreaBbox = _unionSegBbox(drawingSegments);
  }

  return {
    pageBorderSegments: pageBorderSegments,
    drawingSegments: drawingSegments,
    drawingAreaBbox: drawingAreaBbox,
    summary: {
      total: segments.length,
      pageBorder: pageBorderSegments.length,
      drawing: drawingSegments.length
    }
  };
}

function _segBbox(s) {
  return {
    minX: Math.min(s.x1, s.x2),
    minY: Math.min(s.y1, s.y2),
    maxX: Math.max(s.x1, s.x2),
    maxY: Math.max(s.y1, s.y2)
  };
}

function _nearPageEdge(bbox, pageW, pageH, tol) {
  return bbox.minX < tol || bbox.minY < tol || bbox.maxX > pageW - tol || bbox.maxY > pageH - tol;
}

function _unionSegBbox(segs) {
  var minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    var sMinX = Math.min(s.x1, s.x2),
      sMinY = Math.min(s.y1, s.y2),
      sMaxX = Math.max(s.x1, s.x2),
      sMaxY = Math.max(s.y1, s.y2);
    if (sMinX < minX) minX = sMinX;
    if (sMinY < minY) minY = sMinY;
    if (sMaxX > maxX) maxX = sMaxX;
    if (sMaxY > maxY) maxY = sMaxY;
  }
  return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
}
