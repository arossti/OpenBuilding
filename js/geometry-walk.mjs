/**
 * PDF-Parser — Geometry Walk (pure, version-agnostic)
 *
 * Shared walk over a pdf.js operator list. Produces line segments,
 * endpoints, and closed paths in canvas-space (PDF points, viewport-
 * transformed). Pure: no pdfjs, no DOM, no fetch. Consumers pass in the
 * operator list + viewport transform + OPS constants.
 *
 * Consumed by:
 *   - js/vector-snap.mjs (browser, via lib/pdf.min.mjs @ 4.9.155)
 *   - schema/scripts/build-dim-fixture.mjs (node, via npm pdfjs-dist @ 5.x)
 *
 * Handles both pdfjs 4.x and 5.x constructPath encodings — they differ:
 *
 *   4.x: args[0] = subOps array (OPS.moveTo, OPS.lineTo, ...),
 *        args[1] = flat coords array [x, y, x, y, ...]
 *
 *   5.x: args[0] = trailing paint op (stroke/fill/endPath/...),
 *        args[1] = [coordBuffer] — a single-element wrapper around a
 *        buffer with inline DrawOPS-coded ops:
 *           DrawOPS.moveTo=0, lineTo=1, curveTo=2 (6 coords),
 *           quadraticCurveTo=3 (4 coords), closePath=4
 *
 * Detection: if args[0] is an Array → 4.x, else → 5.x. The two sides of
 * the codebase (browser lib/pdf.min.mjs and npm pdfjs-dist) use different
 * versions as of 2026-04-22; this module's dispatch keeps the walk logic
 * single-sourced while tolerating the skew.
 */

// 5.x DrawOPS inline opcodes.
var DRAW_MOVE_TO = 0;
var DRAW_LINE_TO = 1;
var DRAW_CURVE_TO = 2;
var DRAW_QUAD_CURVE_TO = 3;
var DRAW_CLOSE_PATH = 4;

/**
 * @param {{fnArray, argsArray}} operatorList
 * @param {Array<number>} vpTx  — viewport transform [a,b,c,d,e,f]
 * @param {Object} OPS  — pdfjs OPS constants
 * @returns {{segments, endpoints, closedPaths}}
 */
export function walkOperatorList(operatorList, vpTx, OPS) {
  var state = {
    segments: [],
    closedPaths: [],
    currentPath: [],
    curX: 0,
    curY: 0,
    pathStartX: 0,
    pathStartY: 0,
    ctm: [1, 0, 0, 1, 0, 0],
    ctmStack: []
  };

  function tp(x, y) {
    var ctm = state.ctm;
    var px = ctm[0] * x + ctm[2] * y + ctm[4];
    var py = ctm[1] * x + ctm[3] * y + ctm[5];
    var cx = vpTx[0] * px + vpTx[2] * py + vpTx[4];
    var cy = vpTx[1] * px + vpTx[3] * py + vpTx[5];
    return { x: cx, y: cy };
  }

  function flushPathSegments(path) {
    for (var k = 0; k < path.length - 1; k++) {
      state.segments.push({ x1: path[k].x, y1: path[k].y, x2: path[k + 1].x, y2: path[k + 1].y });
    }
  }

  function multiplyMatrix(m1, m2) {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }

  var fnArray = operatorList.fnArray;
  var argsArray = operatorList.argsArray;
  for (var i = 0; i < fnArray.length; i++) {
    var fn = fnArray[i];
    var args = argsArray[i];

    if (fn === OPS.save) {
      state.ctmStack.push(state.ctm.slice());
      continue;
    }
    if (fn === OPS.restore) {
      if (state.ctmStack.length > 0) state.ctm = state.ctmStack.pop();
      continue;
    }
    if (fn === OPS.transform) {
      state.ctm = multiplyMatrix(state.ctm, args);
      continue;
    }

    if (fn === OPS.constructPath) {
      if (Array.isArray(args[0])) {
        _walkV4ConstructPath(args, state, tp, flushPathSegments, OPS);
      } else {
        _walkV5ConstructPath(args, state, tp, flushPathSegments, OPS);
      }
      continue;
    }

    // Legacy individual operators (pdfjs 3.x or simple PDFs — seldom hit on 4.x+)
    switch (fn) {
      case OPS.moveTo:
        var lmp = tp(args[0], args[1]);
        state.curX = lmp.x;
        state.curY = lmp.y;
        state.pathStartX = state.curX;
        state.pathStartY = state.curY;
        if (state.currentPath.length >= 2) flushPathSegments(state.currentPath);
        state.currentPath = [{ x: state.curX, y: state.curY }];
        break;
      case OPS.lineTo:
        var llp = tp(args[0], args[1]);
        state.currentPath.push({ x: llp.x, y: llp.y });
        state.curX = llp.x;
        state.curY = llp.y;
        break;
      case OPS.rectangle:
        var lr0 = tp(args[0], args[1]),
          lr1 = tp(args[0] + args[2], args[1]),
          lr2 = tp(args[0] + args[2], args[1] + args[3]),
          lr3 = tp(args[0], args[1] + args[3]);
        var rect2 = [lr0, lr1, lr2, lr3];
        state.closedPaths.push(rect2);
        flushPathSegments(rect2.concat([rect2[0]]));
        break;
      case OPS.closePath:
        if (state.currentPath.length >= 3) {
          state.currentPath.push({ x: state.pathStartX, y: state.pathStartY });
          state.closedPaths.push(state.currentPath.slice());
          flushPathSegments(state.currentPath);
        }
        state.currentPath = [];
        break;
      case OPS.stroke:
      case OPS.fill:
      case OPS.fillStroke:
      case OPS.eoFill:
      case OPS.eoFillStroke:
        if (state.currentPath.length >= 2) flushPathSegments(state.currentPath);
        state.currentPath = [];
        break;
    }
  }

  // Deduplicated endpoint list for nearest-endpoint snap.
  var epMap = {};
  for (var si = 0; si < state.segments.length; si++) {
    var seg = state.segments[si];
    var k1 = Math.round(seg.x1) + "," + Math.round(seg.y1);
    var k2 = Math.round(seg.x2) + "," + Math.round(seg.y2);
    if (!epMap[k1]) epMap[k1] = { x: seg.x1, y: seg.y1 };
    if (!epMap[k2]) epMap[k2] = { x: seg.x2, y: seg.y2 };
  }
  var endpoints = [];
  for (var key in epMap) endpoints.push(epMap[key]);

  return { segments: state.segments, endpoints: endpoints, closedPaths: state.closedPaths };
}

// ── pdfjs 4.x branch — subOps array + flat coords ────────────────────
function _walkV4ConstructPath(args, state, tp, flush, OPS) {
  var subOps = args[0];
  var coords = args[1];
  var ci = 0;
  for (var s = 0; s < subOps.length; s++) {
    var subOp = subOps[s];
    if (subOp === OPS.moveTo) {
      var mp = tp(coords[ci++], coords[ci++]);
      state.curX = mp.x;
      state.curY = mp.y;
      state.pathStartX = state.curX;
      state.pathStartY = state.curY;
      if (state.currentPath.length >= 2) flush(state.currentPath);
      state.currentPath = [{ x: state.curX, y: state.curY }];
    } else if (subOp === OPS.lineTo) {
      var lp = tp(coords[ci++], coords[ci++]);
      state.curX = lp.x;
      state.curY = lp.y;
      state.currentPath.push({ x: state.curX, y: state.curY });
    } else if (subOp === OPS.curveTo || subOp === OPS.curveTo2 || subOp === OPS.curveTo3) {
      var nc = subOp === OPS.curveTo ? 6 : 4;
      var cp = tp(coords[ci + nc - 2], coords[ci + nc - 1]);
      state.curX = cp.x;
      state.curY = cp.y;
      ci += nc;
      state.currentPath.push({ x: state.curX, y: state.curY });
    } else if (subOp === OPS.rectangle) {
      var rx = coords[ci++],
        ry = coords[ci++],
        rw = coords[ci++],
        rh = coords[ci++];
      if (state.currentPath.length >= 2) flush(state.currentPath);
      state.currentPath = [];
      var r0 = tp(rx, ry),
        r1 = tp(rx + rw, ry),
        r2 = tp(rx + rw, ry + rh),
        r3 = tp(rx, ry + rh);
      var rect = [r0, r1, r2, r3];
      state.closedPaths.push(rect);
      flush(rect.concat([rect[0]]));
    } else if (subOp === OPS.closePath) {
      if (state.currentPath.length >= 3) {
        state.currentPath.push({ x: state.pathStartX, y: state.pathStartY });
        state.closedPaths.push(state.currentPath.slice());
        flush(state.currentPath);
      }
      state.currentPath = [];
    }
  }
}

// ── pdfjs 5.x branch — trailing paint op + inline DrawOPS buffer ─────
function _walkV5ConstructPath(args, state, tp, flush, OPS) {
  var trailing = args[0];
  var bufWrap = args[1];
  var buf = bufWrap && bufWrap.length === 1 ? bufWrap[0] : bufWrap;
  if (!buf || typeof buf.length !== "number") return;
  var n = buf.length;
  var j = 0;
  while (j < n) {
    var op = buf[j++];
    if (op === DRAW_MOVE_TO) {
      var mp = tp(buf[j++], buf[j++]);
      state.curX = mp.x;
      state.curY = mp.y;
      state.pathStartX = state.curX;
      state.pathStartY = state.curY;
      if (state.currentPath.length >= 2) flush(state.currentPath);
      state.currentPath = [{ x: state.curX, y: state.curY }];
    } else if (op === DRAW_LINE_TO) {
      var lp = tp(buf[j++], buf[j++]);
      state.curX = lp.x;
      state.curY = lp.y;
      state.currentPath.push({ x: state.curX, y: state.curY });
    } else if (op === DRAW_CURVE_TO) {
      var cp = tp(buf[j + 4], buf[j + 5]);
      state.curX = cp.x;
      state.curY = cp.y;
      j += 6;
      state.currentPath.push({ x: state.curX, y: state.curY });
    } else if (op === DRAW_QUAD_CURVE_TO) {
      var qp = tp(buf[j + 2], buf[j + 3]);
      state.curX = qp.x;
      state.curY = qp.y;
      j += 4;
      state.currentPath.push({ x: state.curX, y: state.curY });
    } else if (op === DRAW_CLOSE_PATH) {
      if (state.currentPath.length >= 3) {
        state.currentPath.push({ x: state.pathStartX, y: state.pathStartY });
        state.closedPaths.push(state.currentPath.slice());
        flush(state.currentPath);
      }
      state.currentPath = [];
    } else {
      // Unknown opcode — bail to avoid reading coords out of alignment.
      state.currentPath = [];
      return;
    }
  }
  // Flush on terminal paint op if it actually renders.
  if (
    trailing === OPS.stroke ||
    trailing === OPS.fill ||
    trailing === OPS.fillStroke ||
    trailing === OPS.eoFill ||
    trailing === OPS.eoFillStroke ||
    trailing === OPS.closeStroke ||
    trailing === OPS.closeFillStroke ||
    trailing === OPS.closeEOFillStroke
  ) {
    if (state.currentPath.length >= 2) flush(state.currentPath);
  }
  state.currentPath = [];
}
