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

// Wall-candidate detection tuning (C5). CAD convention: walls are drawn
// as two parallel strokes offset by the wall thickness. For building
// plans at common scales, wall thickness 0.3-0.5m (per Andy 2026-04-22)
// maps to 5-30pt on page at scales 1:48 to 1:100. Wider windows let
// thicker partition walls and older CAD pen-widths through.
// Tuning for wall-like parallel-pair detection. Initial values (30 / 3-35
// / 15) produced loose bboxes on both fixtures (p9 polygon extended
// below the actual building by ~60pt, p4 by ~400pt) because short
// dim-bracket ticks + titleblock cells + detail-callout rectangles all
// satisfy the "two short parallel segments" signature. Tighter bounds:
//   - min length 50pt rejects dim brackets (typically <30pt between ticks)
//   - parallel offset max 25pt rejects titleblock cells (typically 40pt+)
//   - overlap min 40pt rejects dim strings (wall partners share most of
//     their length; dim brackets share only a few pt at the tick region)
var WALL_MIN_SEGMENT_LENGTH = 50;
var WALL_PARALLEL_MIN_OFFSET = 3;
var WALL_PARALLEL_MAX_OFFSET = 25;
var WALL_OVERLAP_MIN = 40;

// Cluster wall-candidate positions within this many pt when surfacing
// them to C7's edge-scrub UI. Raw wall-segment positions include partner
// strokes (inner + outer face of every wall drawn as two parallels), so
// every real wall produces two closely-spaced candidates; 5pt coalesces
// partner-pair duplicates and tick-mark noise without collapsing real
// distinct walls (minimum partition-wall spacing in practice > 10pt).
var WALL_CANDIDATE_CLUSTER_RADIUS = 5;

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

/**
 * Shrink-wrap building detection (C5, orthogonal only).
 *
 * Given drawing segments (pre-classified by classifyLayers) + the
 * drawing-area bbox, find a 4-vertex orthogonal rectangle that bounds
 * the building's wall geometry.
 *
 * Algorithm:
 *   1. Filter segments to long orthogonal ones (|dx| or |dy| > 30pt,
 *      the other ≈ 0).
 *   2. Keep only segments that have a parallel partner within wall-
 *      thickness range (3-35pt) and meaningful overlap (≥15pt) — this
 *      is the "CAD wall double-line" signature. Single-stroke dim lines,
 *      room labels, and single strokes without a partner drop out.
 *   3. Bbox of the survivors = the building outline (outer wall faces
 *      on plans; C7 will add inner / middle / outer snap by choosing
 *      the inward parallel partner).
 *
 * Returns null if no wall-like segments were found (probably not a
 * proper drawing sheet, or scanned raster — caller should fall back to
 * the closed-polygon detector).
 *
 * @param {Array} drawingSegments — from classifyLayers().drawingSegments
 * @param {Object} drawingAreaBbox — from classifyLayers().drawingAreaBbox
 * @param {Object} [opts]
 * @returns {{
 *   polygon, bbox,
 *   wallHorizCount, wallVertCount,
 *   wallVertPositions, wallHorizPositions,
 *   reason
 * } | null}
 *
 * wallVertPositions / wallHorizPositions are the perpendicular coords
 * (x for vertical walls, y for horizontal walls) of detected wall-pair
 * clusters, sorted ascending and clustered within 5pt. C7's edge-scrub
 * UI uses these as snap detents: dragging a vertical polygon edge snaps
 * through wallVertPositions; a horizontal edge through wallHorizPositions.
 */
export function shrinkWrapBuilding(drawingSegments, drawingAreaBbox, opts) {
  opts = opts || {};
  var minLen = opts.minSegmentLength || WALL_MIN_SEGMENT_LENGTH;
  var pMin = opts.parallelMinOffset || WALL_PARALLEL_MIN_OFFSET;
  var pMax = opts.parallelMaxOffset || WALL_PARALLEL_MAX_OFFSET;
  var overlapMin = opts.overlapMin || WALL_OVERLAP_MIN;

  if (!drawingSegments || drawingSegments.length === 0) return null;
  if (!drawingAreaBbox) return null;

  var horizSegs = [];
  var vertSegs = [];

  for (var i = 0; i < drawingSegments.length; i++) {
    var s = drawingSegments[i];
    var dx = s.x2 - s.x1;
    var dy = s.y2 - s.y1;
    var absDx = Math.abs(dx);
    var absDy = Math.abs(dy);
    if (absDy < 0.5 && absDx >= minLen) {
      horizSegs.push({
        x1: Math.min(s.x1, s.x2),
        x2: Math.max(s.x1, s.x2),
        y: s.y1,
        length: absDx
      });
    } else if (absDx < 0.5 && absDy >= minLen) {
      vertSegs.push({
        y1: Math.min(s.y1, s.y2),
        y2: Math.max(s.y1, s.y2),
        x: s.x1,
        length: absDy
      });
    }
  }

  var wallHoriz = _filterWithParallel(horizSegs, "y", "x1", "x2", pMin, pMax, overlapMin);
  var wallVert = _filterWithParallel(vertSegs, "x", "y1", "y2", pMin, pMax, overlapMin);

  if (wallHoriz.length === 0 || wallVert.length === 0) {
    return {
      polygon: null,
      bbox: null,
      wallHorizCount: wallHoriz.length,
      wallVertCount: wallVert.length,
      reason:
        wallHoriz.length === 0 && wallVert.length === 0
          ? "no wall-like horizontal or vertical segments (no parallel pairs found)"
          : wallHoriz.length === 0
            ? "no wall-like horizontal segments"
            : "no wall-like vertical segments"
    };
  }

  // 5-95 percentile of wall positions per axis, not min/max. Rejects the
  // stray outlier parallel pairs that hide at page margins (dim-extension
  // strips, titleblock dividers, detail-callout rectangles) without
  // over-trimming the real wall cluster. Clipped to drawingAreaBbox so
  // extreme outliers can't push the bbox past the drawing area.
  var extX = _trimmedExtent(wallVert, "x");
  var extY = _trimmedExtent(wallHoriz, "y");
  var minX = Math.max(extX.lo, drawingAreaBbox.minX);
  var maxX = Math.min(extX.hi, drawingAreaBbox.maxX);
  var minY = Math.max(extY.lo, drawingAreaBbox.minY);
  var maxY = Math.min(extY.hi, drawingAreaBbox.maxY);

  if (maxX <= minX || maxY <= minY) {
    return {
      polygon: null,
      bbox: null,
      wallHorizCount: wallHoriz.length,
      wallVertCount: wallVert.length,
      reason: "degenerate bbox after clipping"
    };
  }

  var polygon = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY }
  ];

  var wallVertPositions = _clusterPositions(wallVert, "x", WALL_CANDIDATE_CLUSTER_RADIUS);
  var wallHorizPositions = _clusterPositions(wallHoriz, "y", WALL_CANDIDATE_CLUSTER_RADIUS);

  return {
    polygon: polygon,
    bbox: { minX: minX, minY: minY, maxX: maxX, maxY: maxY },
    wallHorizCount: wallHoriz.length,
    wallVertCount: wallVert.length,
    wallVertPositions: wallVertPositions,
    wallHorizPositions: wallHorizPositions,
    reason: null
  };
}

/**
 * Collapse perpendicular-axis values (x of vertical walls, y of
 * horizontal walls) into a sorted deduped list. Values within
 * `clusterRadius` pt of each other collapse to their mean — partner
 * strokes of the same wall (inner + outer face) + duplicate segments
 * from the same stroke would otherwise show up as two adjacent detents
 * that feel sticky under a drag.
 */
function _clusterPositions(segs, axisVal, clusterRadius) {
  if (!segs || segs.length === 0) return [];
  var vals = segs
    .map(function (s) {
      return s[axisVal];
    })
    .slice()
    .sort(function (a, b) {
      return a - b;
    });

  var out = [];
  var clusterStart = vals[0];
  var sum = vals[0];
  var n = 1;
  for (var i = 1; i < vals.length; i++) {
    if (vals[i] - clusterStart <= clusterRadius) {
      sum += vals[i];
      n += 1;
    } else {
      out.push(sum / n);
      clusterStart = vals[i];
      sum = vals[i];
      n = 1;
    }
  }
  out.push(sum / n);
  return out;
}

/**
 * Keep segments that have at least one parallel partner within
 * [pMin, pMax] perpendicular offset AND ≥ overlapMin along the shared
 * axis. axisVal is the perpendicular coordinate; rangeStart / rangeEnd
 * are the coordinate keys along the shared axis.
 */
function _filterWithParallel(segs, axisVal, rangeStart, rangeEnd, pMin, pMax, overlapMin) {
  var kept = [];
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    for (var j = 0; j < segs.length; j++) {
      if (i === j) continue;
      var o = segs[j];
      var off = Math.abs(o[axisVal] - s[axisVal]);
      if (off < pMin || off > pMax) continue;
      var overlap = Math.min(s[rangeEnd], o[rangeEnd]) - Math.max(s[rangeStart], o[rangeStart]);
      if (overlap >= overlapMin) {
        kept.push(s);
        break;
      }
    }
  }
  return kept;
}

/**
 * 5th / 95th percentile of values on an axis — trims the stray outer
 * outliers (dim-strip extensions at the page margins) without killing
 * legitimate wall clusters. If the input has fewer than 4 values, fall
 * back to min/max to avoid over-trimming.
 */
function _trimmedExtent(segs, axisVal) {
  if (segs.length < 4) {
    var lo = Infinity,
      hi = -Infinity;
    for (var k = 0; k < segs.length; k++) {
      var v = segs[k][axisVal];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    return { lo: lo, hi: hi };
  }
  var values = segs.map(function (s) {
    return s[axisVal];
  });
  values.sort(function (a, b) {
    return a - b;
  });
  var loIdx = Math.floor(values.length * 0.05);
  var hiIdx = Math.ceil(values.length * 0.95) - 1;
  return { lo: values[loIdx], hi: values[hiIdx] };
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
