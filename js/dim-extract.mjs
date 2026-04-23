/**
 * PDF-Parser — Dimension-String Extraction
 *
 * Parses dimension callouts from a page's text items, pairs each callout
 * with its annotated line segment, and scores the pairing so the wand /
 * scale-manager can pick the highest-confidence dim for auto-calibration
 * or flag declared-vs-detected-scale disagreement.
 *
 * Canonical storage is metres. Source text preserved for display.
 *
 * Supports:
 *   - Imperial feet-inches: 25'-6", 25'-6 1/2", 25' 6", 25', 6", 0'-6"
 *   - Fractional inches rendered as split numerator/denominator text items
 *     (ArchiCad / AutoCAD stack the fraction; we merge via a pre-pass).
 *   - Metric: 3200mm, 3.2m, 2,000, 2,000.4, 2000, 2000.4. Bare numbers
 *     without a unit are accepted only when a segment pairing confirms
 *     the implied scale.
 *
 * Module is pure — no pdfjs, no DOM. Consumes plain text-item + segment
 * data so it runs identically under the browser and the node fixture
 * test runner.
 */

// Foot / inch glyphs we accept (ASCII + Unicode primes).
var FOOT_CHARS = "'′";
var INCH_CHARS = '"″';

var IMPERIAL_RX = new RegExp(
  "^(?:(\\d+)\\s*[" + FOOT_CHARS + "])?\\s*-?\\s*" + "(?:(\\d+)(?:\\s+(\\d+)/(\\d+))?\\s*[" + INCH_CHARS + "]?)?\\s*$"
);

var METRIC_RX = /^(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(mm|m)?$/i;

var PLAUSIBLE_MIN_METRES = 0.05;
var PLAUSIBLE_MAX_METRES = 100;

/**
 * Parse an imperial feet-inches string.
 * @param {string} str
 * @returns {{valueMeters, feet, inches, frac, source} | null}
 */
export function parseImperial(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (s.length === 0) return null;
  // Fast reject: must contain at least one foot or inch glyph.
  if (!new RegExp("[" + FOOT_CHARS + INCH_CHARS + "]").test(s)) return null;
  var m = IMPERIAL_RX.exec(s);
  if (!m) return null;
  var fStr = m[1];
  var iStr = m[2];
  var nStr = m[3];
  var dStr = m[4];
  if (!fStr && !iStr) return null;
  var feet = fStr ? parseInt(fStr, 10) : 0;
  var inches = iStr ? parseInt(iStr, 10) : 0;
  var frac = 0;
  if (nStr && dStr) {
    var num = parseInt(nStr, 10);
    var den = parseInt(dStr, 10);
    if (den > 0) frac = num / den;
  }
  var totalInches = feet * 12 + inches + frac;
  if (totalInches <= 0) return null;
  var valueMeters = totalInches * 0.0254;
  if (valueMeters < PLAUSIBLE_MIN_METRES || valueMeters > PLAUSIBLE_MAX_METRES) return null;
  return { valueMeters: valueMeters, feet: feet, inches: inches, frac: frac, source: s };
}

/**
 * Parse a metric string.  Bare numbers are accepted; unit inference:
 *   - explicit "m"  → metres
 *   - explicit "mm" → millimetres
 *   - bare number < 30 with a decimal → metres (survey / metric-drawn-in-m)
 *   - bare number otherwise → millimetres (building-plan default)
 * @param {string} str
 * @returns {{valueMeters, unitInferred, source} | null}
 */
export function parseMetric(str) {
  if (typeof str !== "string") return null;
  var s = str.trim();
  if (s.length === 0) return null;
  var m = METRIC_RX.exec(s);
  if (!m) return null;
  var numStr = m[1];
  var unit = m[2] ? m[2].toLowerCase() : null;
  // Strip thousands separators
  var clean = numStr.replace(/,/g, "");
  var num = parseFloat(clean);
  if (!isFinite(num) || num <= 0) return null;
  var valueMeters;
  var unitInferred;
  if (unit === "m") {
    valueMeters = num;
    unitInferred = "m";
  } else if (unit === "mm") {
    valueMeters = num / 1000;
    unitInferred = "mm";
  } else {
    // No explicit unit — infer.
    if (num < 30 && /\./.test(clean)) {
      valueMeters = num;
      unitInferred = "m_inferred";
    } else {
      valueMeters = num / 1000;
      unitInferred = "mm_inferred";
    }
  }
  if (valueMeters < PLAUSIBLE_MIN_METRES || valueMeters > PLAUSIBLE_MAX_METRES) return null;
  return { valueMeters: valueMeters, unitInferred: unitInferred, source: s };
}

/**
 * Pre-pass: join horizontally-adjacent same-row text items into single
 * strings. pdfjs 4.x emits per-glyph text items on many CAD PDFs (every
 * character arrives as its own fragment with width ~3pt), which breaks
 * the whole-string regex below — "2,901.6" arrives as seven items:
 * "2", ",", "9", "0", "1", ".", "6". pdfjs 5.x already coalesces into
 * words so this pass is idempotent there (gaps between words exceed the
 * half-char-width threshold so nothing merges).
 *
 * Merge rule: same y (within max(3pt, 0.3 * fontHeight)) AND the gap
 * between prev.right and curr.left is <= half the character width. No
 * space insertion — any actual whitespace in the source is preserved
 * because it arrives as its own (possibly zero-width) item.
 *
 * Returns a new text-item array. Input is not mutated.
 *
 * @param {Array} textItems
 * @returns {Array}
 */
export function consolidateTextItems(textItems) {
  if (!Array.isArray(textItems) || textItems.length === 0) return textItems || [];

  var sorted = textItems.slice().sort(function (a, b) {
    if (Math.abs(a.y - b.y) > 3) return a.y - b.y;
    return a.x - b.x;
  });

  var out = [];
  var curr = null;
  for (var i = 0; i < sorted.length; i++) {
    var t = sorted[i];
    if (!curr) {
      curr = _cloneItem(t);
      continue;
    }
    var charSize = curr.height || curr.fontSize || 5;
    // Tight row tolerance — stacked fraction pairs (e.g. "17'-11 3/4""
    // renders the numerator and denominator with y-offset ~3pt). A looser
    // tolerance swallows those into a single consolidated item and the
    // fraction-merge pass misses them. 1pt floor handles sub-pixel baseline
    // jitter on v4's per-glyph text items, which share an exact y.
    var rowTol = Math.max(1, charSize * 0.15);
    var sameRow = Math.abs(t.y - curr.y) <= rowTol;
    var prevRight = curr.x + (curr.width || 0);
    var gap = t.x - prevRight;
    var charW = charSize * 0.5;
    if (sameRow && gap <= charW) {
      curr.str = curr.str + (t.str || "");
      curr.width = t.x + (t.width || 0) - curr.x;
      if ((t.height || 0) > (curr.height || 0)) curr.height = t.height;
      if ((t.fontSize || 0) > (curr.fontSize || 0)) curr.fontSize = t.fontSize;
    } else {
      if ((curr.str || "").length > 0) out.push(curr);
      curr = _cloneItem(t);
    }
  }
  if (curr && (curr.str || "").length > 0) out.push(curr);
  return out;
}

function _cloneItem(t) {
  return {
    str: t.str || "",
    x: t.x,
    y: t.y,
    width: t.width || 0,
    height: t.height || 0,
    fontName: t.fontName || "",
    fontSize: t.fontSize || 0
  };
}

/**
 * Pre-pass: merge split numerator/denominator fraction pairs back into
 * their predecessor dim item. CAD renders `17'-11 3/4"` as three text
 * items ("17'-11" + "3 " + "4") with the numerator slightly above and
 * the denominator slightly below the dim baseline.
 *
 * Returns a new text-item array. Input is not mutated.
 *
 * @param {Array} textItems
 * @returns {Array}
 */
export function mergeFractionItems(textItems) {
  if (!Array.isArray(textItems) || textItems.length === 0) return textItems || [];

  // Detect fraction pairs — two tiny digit-only items, horizontally close,
  // with the second 2-8 pt below the first (y grows downward in our coord
  // convention). Collect as {numIdx, denIdx}.
  var used = {};
  var pairs = [];
  for (var i = 0; i < textItems.length; i++) {
    if (used[i]) continue;
    var a = textItems[i];
    if (!/^\d{1,2}\s*$/.test((a.str || "").trim())) continue;
    for (var j = 0; j < textItems.length; j++) {
      if (i === j || used[j]) continue;
      var b = textItems[j];
      if (!/^\d{1,2}\s*$/.test((b.str || "").trim())) continue;
      var dy = b.y - a.y;
      if (dy < 2 || dy > 8) continue;
      var dx = Math.abs(b.x - a.x);
      if (dx > 5) continue;
      pairs.push({ numIdx: i, denIdx: j });
      used[i] = true;
      used[j] = true;
      break;
    }
  }

  if (pairs.length === 0) return textItems.slice();

  // For each pair, find a predecessor dim-like item to the left, same row.
  // Merge fraction into predecessor's str.
  var mergeInto = {}; // itemIdx → {numIdx, denIdx}
  for (var p = 0; p < pairs.length; p++) {
    var pair = pairs[p];
    var num = textItems[pair.numIdx];
    var den = textItems[pair.denIdx];
    var fracYMid = (num.y + den.y) / 2;
    var predIdx = -1;
    var predGap = Infinity;
    for (var k = 0; k < textItems.length; k++) {
      if (used[k] || mergeInto[k]) continue;
      var pre = textItems[k];
      var rowTol = Math.max(4, (pre.height || 5) * 0.8);
      if (Math.abs(fracYMid - pre.y) > rowTol) continue;
      var preRight = pre.x + (pre.width || 0);
      var gap = num.x - preRight;
      if (gap < -2 || gap > 8) continue;
      if (gap < predGap) {
        predGap = gap;
        predIdx = k;
      }
    }
    if (predIdx >= 0) mergeInto[predIdx] = pair;
  }

  var out = [];
  for (var m2 = 0; m2 < textItems.length; m2++) {
    if (used[m2]) continue;
    var item = textItems[m2];
    var merge = mergeInto[m2];
    if (!merge) {
      out.push(item);
      continue;
    }
    var num2 = textItems[merge.numIdx];
    var den2 = textItems[merge.denIdx];
    var fracStr = num2.str.trim() + "/" + den2.str.trim();
    // Splice the fraction before any trailing inch glyph; otherwise append.
    var closing = new RegExp("(.*?)([" + INCH_CHARS + "])\\s*$").exec(item.str);
    var newStr;
    if (closing) {
      newStr = closing[1].replace(/\s+$/, "") + " " + fracStr + closing[2];
    } else {
      newStr = item.str.replace(/\s+$/, "") + " " + fracStr + '"';
    }
    out.push({
      str: newStr,
      x: item.x,
      y: item.y,
      width: (item.width || 0) + (num2.width || 0) + (den2.width || 0) + 2,
      height: item.height,
      fontName: item.fontName,
      fontSize: item.fontSize,
      merged: true
    });
  }
  return out;
}

/**
 * Convert a declared-scale object (from sheet-classifier.detectScale) to
 * pdfUnitsPerMetre. Mirrors the math in scale-manager.accept().
 *
 * @param {{ratio: number|null}} declaredScale
 * @returns {number|null} pdfUnitsPerMetre, or null if scale is NTS / missing
 */
export function scaleToPdfUnitsPerMetre(declaredScale) {
  if (!declaredScale || !declaredScale.ratio) return null;
  var mmPerPdfUnit = 25.4 / 72;
  var realMPerPdfUnit = (mmPerPdfUnit * declaredScale.ratio) / 1000;
  if (realMPerPdfUnit <= 0) return null;
  return 1 / realMPerPdfUnit;
}

/**
 * Classify a segment as horizontal, vertical, or diagonal, with length.
 */
function segmentGeometry(seg) {
  var dx = seg.x2 - seg.x1;
  var dy = seg.y2 - seg.y1;
  var length = Math.sqrt(dx * dx + dy * dy);
  var absDx = Math.abs(dx),
    absDy = Math.abs(dy);
  var orientation;
  if (absDy < 0.5 && absDx > 1) orientation = "horizontal";
  else if (absDx < 0.5 && absDy > 1) orientation = "vertical";
  else orientation = "diagonal";
  return { length: length, orientation: orientation, dx: dx, dy: dy };
}

/**
 * Distance from point (px, py) to the segment bbox.
 */
function pointToSegmentBox(px, py, seg) {
  var xMin = Math.min(seg.x1, seg.x2);
  var xMax = Math.max(seg.x1, seg.x2);
  var yMin = Math.min(seg.y1, seg.y2);
  var yMax = Math.max(seg.y1, seg.y2);
  var dxClamp = px < xMin ? xMin - px : px > xMax ? px - xMax : 0;
  var dyClamp = py < yMin ? yMin - py : py > yMax ? py - yMax : 0;
  return Math.sqrt(dxClamp * dxClamp + dyClamp * dyClamp);
}

/**
 * Pair a single dim callout with its best-fit segment under the given
 * pdfUnitsPerMetre hypothesis. The callout gets scored on:
 *   - length match: |expectedLen - segLen| / expectedLen
 *   - proximity: distance from text centroid to segment bbox
 *   - orientation: horizontal/vertical segments preferred over diagonals
 *
 * @returns {{segment, confidence, impliedPdfUnitsPerMetre} | null}
 */
function pairCalloutToSegment(callout, segments, pdfUnitsPerMetre, opts) {
  var textCx = (callout.x || 0) + (callout.width || 0) / 2;
  var textCy = (callout.y || 0) + (callout.height || 0) / 2;
  var expectedLen = pdfUnitsPerMetre ? callout.valueMeters * pdfUnitsPerMetre : null;
  var lengthWindow = opts && opts.lengthWindow ? opts.lengthWindow : 0.08;
  // Length match is the primary selector (only same-length segments survive
  // the 8% window). Proximity is a tie-break that prevents a same-length
  // segment on the far side of the page from winning over the real one.
  // 500 pt is ~7" on an 11x8.5 sheet — plenty for dims written off the
  // drawing area (running dim strings above/below the building) while
  // still rejecting cross-page false positives.
  var proximityBudget = opts && opts.proximityBudget ? opts.proximityBudget : 500;

  var best = null;
  var bestScore = -Infinity;

  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    var geo = segmentGeometry(seg);
    if (geo.length < 10) continue;
    if (geo.orientation === "diagonal") continue;

    // Length match (only when we have an expected length)
    var lenScore = 1;
    var implied = callout.valueMeters > 0 ? geo.length / callout.valueMeters : null;
    if (expectedLen) {
      var err = Math.abs(geo.length - expectedLen) / expectedLen;
      if (err > lengthWindow) continue;
      lenScore = 1 - err / lengthWindow;
    }

    // Proximity — text should be within a reasonable distance of the segment
    var dist = pointToSegmentBox(textCx, textCy, seg);
    if (dist > proximityBudget) continue;
    var proxScore = 1 - dist / proximityBudget;

    var score = 0.6 * lenScore + 0.4 * proxScore;
    if (score > bestScore) {
      bestScore = score;
      best = {
        segment: { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2, length: geo.length, orientation: geo.orientation },
        confidence: score,
        impliedPdfUnitsPerMetre: implied
      };
    }
  }
  return best;
}

/**
 * Extract dimension callouts from a page.
 *
 * @param {Array} textItems  — page text items ({str, x, y, width, height, ...})
 * @param {Array} segments   — extracted line segments ({x1, y1, x2, y2})
 * @param {Object} [opts]
 * @param {Object} [opts.declaredScale]  — from sheet-classifier.detectScale
 * @param {number} [opts.lengthWindow=0.08]  — length match tolerance (fraction)
 * @param {number} [opts.proximityBudget=120]  — max distance callout→segment (pdf pts)
 * @returns {{callouts, scaleHint, impliedScaleMedian, perCalloutReport}}
 */
export function extractDimensions(textItems, segments, opts) {
  opts = opts || {};
  var declared = opts.declaredScale || null;
  var declaredPpm = scaleToPdfUnitsPerMetre(declared);

  // Consolidate per-glyph fragments (pdfjs 4.x on CAD PDFs) into words
  // before anything else runs. Idempotent on already-consolidated input
  // (pdfjs 5.x / PDFs that emit word-level text items).
  var consolidated = consolidateTextItems(textItems);
  var merged = mergeFractionItems(consolidated);

  // Pass 1: parse every text item; keep successful parses with source and position.
  var raw = [];
  for (var i = 0; i < merged.length; i++) {
    var item = merged[i];
    var imp = parseImperial(item.str);
    var met = !imp ? parseMetric(item.str) : null;
    var parsed = imp || met;
    if (!parsed) continue;
    raw.push({
      text: item.str,
      valueMeters: parsed.valueMeters,
      format: imp ? "imperial" : "metric",
      parsed: parsed,
      x: item.x,
      y: item.y,
      width: item.width || 0,
      height: item.height || 0,
      merged: item.merged === true
    });
  }

  // Pass 2: pair each callout with its best segment, under the declared
  // scale if known; otherwise retry with each candidate's own implied
  // scale and lock to the cluster median at the end.
  var pairings = [];
  var unpaired = [];
  for (var j = 0; j < raw.length; j++) {
    var c = raw[j];
    var pair = pairCalloutToSegment(c, segments, declaredPpm, opts);
    if (pair) {
      pairings.push({
        text: c.text,
        valueMeters: c.valueMeters,
        format: c.format,
        textX: c.x,
        textY: c.y,
        segment: pair.segment,
        confidence: pair.confidence,
        impliedPdfUnitsPerMetre: pair.impliedPdfUnitsPerMetre,
        merged: c.merged
      });
    } else {
      unpaired.push({ text: c.text, valueMeters: c.valueMeters, format: c.format });
    }
  }

  // Median of implied scales from high-confidence pairings.
  var implied = pairings
    .filter(function (p) {
      return p.confidence > 0.5 && p.impliedPdfUnitsPerMetre && isFinite(p.impliedPdfUnitsPerMetre);
    })
    .map(function (p) {
      return p.impliedPdfUnitsPerMetre;
    })
    .sort(function (a, b) {
      return a - b;
    });
  var impliedMedian = implied.length ? implied[Math.floor(implied.length / 2)] : null;

  return {
    callouts: pairings,
    unpaired: unpaired,
    declaredPdfUnitsPerMetre: declaredPpm,
    impliedPdfUnitsPerMetreMedian: impliedMedian,
    scaleAgreement: declaredPpm && impliedMedian ? 1 - Math.abs(declaredPpm - impliedMedian) / declaredPpm : null,
    textItemsMerged: merged.length,
    textItemsRaw: textItems.length
  };
}
