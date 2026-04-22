/**
 * PDF-Parser — Sheet Classification
 */

import * as Loader from "./pdf-loader.mjs";
import { SCALE_PATTERNS, SHEET_PREFIXES, CLASS, METRIC_SCALES, IMPERIAL_SCALES } from "./config.mjs";

// All known scale ratios for validation
var KNOWN_RATIOS = {};
METRIC_SCALES.forEach(function (s) {
  KNOWN_RATIOS[s.ratio] = true;
});
IMPERIAL_SCALES.forEach(function (s) {
  KNOWN_RATIOS[s.ratio] = true;
});

export function parseTitleBlock(textItems, pageWidth, pageHeight) {
  // Title blocks occupy the right-hand strip of the sheet and typically
  // span full height (general notes at top, sheet-number at bottom). No
  // y constraint — noise filtering downstream rejects irrelevant strip
  // content (revision labels, issued-for tables, address fields, etc).
  var tbItems = textItems.filter(function (item) {
    return item.x > pageWidth * 0.65;
  });

  var result = { sheetId: null, sheetTitle: null, scale: null, raw: tbItems };

  var sheetIdPattern = /^[A-Z]\d+\.\d+$/;
  for (var i = 0; i < tbItems.length; i++) {
    var s = tbItems[i].str.trim();
    if (sheetIdPattern.test(s)) {
      result.sheetId = s;
      break;
    }
  }

  result.scale = detectScale(textItems);

  // Strict triage — the title MUST contain a primary drawing-type keyword.
  // tbItems are clustered into rows inside _findDrawingTypeTitle so text
  // that PDF.js splits into multiple items ("WEST" + "ELEVATION" on the
  // same baseline) rejoins before the keyword check runs. If no row
  // contains a drawing-type keyword, sheetTitle stays null and the display
  // layer falls through to classification — better "Page 11 — Other" than
  // a hallucinated guess.
  result.sheetTitle = _findDrawingTypeTitle(tbItems) || null;

  return result;
}

// Required keyword on the title anchor. Scoped to the four drawing types
// BfCA actually cares about: plans, sections, elevations, site / key plan.
// Levels + orientations (north/south/basement/ground/first/second) don't
// anchor on their own but ride along as siblings via _stackTitle when they
// share font size and proximity with the anchor.
var _DRAWING_TYPE_RX = /\b(plan|elevation|section|site|key[\s-]*plan)\b/i;

// Cluster tbItems into rows by Y position, then search joined row text for
// the drawing-type keyword. Row-based search handles PDF.js chunking — a
// title like "WEST ELEVATION" rendered as ["WEST", "ELEVATION"] (two items
// at the same baseline) joins back to "WEST ELEVATION" before the regex
// runs. Handles multi-line titles by pulling adjacent same-font rows.
function _findDrawingTypeTitle(tbItems) {
  if (!tbItems || tbItems.length === 0) return null;
  var rows = _clusterRows(tbItems);

  // Rows whose joined text contains a drawing-type keyword.
  var typed = rows.filter(function (r) {
    if (r.text.length < 4 || r.text.length >= 80) return false;
    return _DRAWING_TYPE_RX.test(r.text);
  });
  if (typed.length === 0) return null;

  // Rank: largest font wins; tie-break toward the bottom-right of the title
  // block (visually lower = higher y in our top-left coord system; further
  // right = higher x). Matches the BfCA title-block convention Andy flagged.
  typed.sort(function (a, b) {
    var fontDiff = (b.fontSize || 0) - (a.fontSize || 0);
    if (Math.abs(fontDiff) > 0.5) return fontDiff;
    var yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    return b.xMax - a.xMax;
  });
  var anchor = typed[0];

  // Pull adjacent rows at the same font size for multi-line titles
  // ("North Elevation" / "Right Side"). Siblings must sit within ~2.5x
  // font height vertically AND horizontally overlap or share a centerline.
  var fontTol = Math.max(1.0, anchor.fontSize * 0.1);
  var lineGap = anchor.fontSize ? anchor.fontSize * 2.5 : 40;
  var anchorMid = (anchor.xMin + anchor.xMax) / 2;
  var alignTol = Math.max(40, anchor.fontSize * 3);

  var stack = rows.filter(function (r) {
    if (r === anchor) return true;
    if (Math.abs(r.fontSize - anchor.fontSize) > fontTol) return false;
    var dy = Math.abs(r.y - anchor.y);
    if (dy === 0 || dy > lineGap) return false;
    var rMid = (r.xMin + r.xMax) / 2;
    var overlap = r.xMin < anchor.xMax && r.xMax > anchor.xMin;
    var centered = Math.abs(rMid - anchorMid) < alignTol;
    return overlap || centered;
  });
  stack.sort(function (a, b) {
    return a.y - b.y;
  });

  var title = stack
    .map(function (r) {
      return r.text;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (title.length > 100) return anchor.text;
  return title;
}

// Row clustering — items whose y values fall within the same bucket share
// a line. Bucket size scales with the row's font size so small-font lines
// aren't merged with large-font titles.
function _clusterRows(items) {
  if (!items.length) return [];
  var sorted = items.slice().sort(function (a, b) {
    if (Math.abs(a.y - b.y) > 2) return a.y - b.y;
    return a.x - b.x;
  });
  var rows = [];
  var bucket = [sorted[0]];
  for (var i = 1; i < sorted.length; i++) {
    var curr = sorted[i];
    var last = bucket[bucket.length - 1];
    var tol = Math.max(3, (last.fontSize || 12) * 0.3);
    if (Math.abs(curr.y - last.y) <= tol) {
      bucket.push(curr);
    } else {
      rows.push(_finalizeRow(bucket));
      bucket = [curr];
    }
  }
  if (bucket.length) rows.push(_finalizeRow(bucket));
  return rows;
}

function _finalizeRow(items) {
  items.sort(function (a, b) {
    return a.x - b.x;
  });
  var text = items
    .map(function (i) {
      return i.str;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  var fontSize = items.reduce(function (m, i) {
    return Math.max(m, i.fontSize || 0);
  }, 0);
  var xMin = items.reduce(function (m, i) {
    return Math.min(m, i.x);
  }, Infinity);
  var xMax = items.reduce(function (m, i) {
    return Math.max(m, i.x + (i.width || 0));
  }, -Infinity);
  return {
    text: text,
    fontSize: fontSize,
    y: items[0].y,
    xMin: xMin,
    xMax: xMax,
    items: items
  };
}

// Reject common title-block noise — revision lines, dates, signatures,
// authored-by notes, "page N of M", scale text. Catches the values that
// slipped through the length filter in the old picker.
/**
 * Join text items spatially — only insert a space when items are
 * far enough apart. This prevents "48" split across two items
 * from becoming "4 8".
 */
function _spatialJoin(textItems) {
  if (textItems.length === 0) return "";

  // Sort by Y (row), then X (column)
  var sorted = textItems.slice().sort(function (a, b) {
    if (Math.abs(a.y - b.y) > 3) return a.y - b.y;
    return a.x - b.x;
  });

  var parts = [sorted[0].str];
  for (var i = 1; i < sorted.length; i++) {
    var prev = sorted[i - 1];
    var curr = sorted[i];
    // Different line? Insert space.
    if (Math.abs(curr.y - prev.y) > 3) {
      parts.push(" ");
    } else {
      // Same line — check horizontal gap
      var prevRight = prev.x + (prev.width || 0);
      var gap = curr.x - prevRight;
      var charWidth = prev.fontSize ? prev.fontSize * 0.5 : 4;
      // Only add space if gap is more than ~half a character width
      if (gap > charWidth) {
        parts.push(" ");
      }
    }
    parts.push(curr.str);
  }
  return parts.join("");
}

export function detectScale(textItems) {
  var allText = _spatialJoin(textItems);

  var bestResult = null;

  for (var i = 0; i < SCALE_PATTERNS.length; i++) {
    var pat = SCALE_PATTERNS[i];
    // Find ALL matches, not just the first
    var regex = new RegExp(pat.regex.source, pat.regex.flags + (pat.regex.flags.indexOf("g") >= 0 ? "" : "g"));
    var match;
    while ((match = regex.exec(allText)) !== null) {
      var ratio = pat.extract(match);
      if (ratio === null) {
        // NTS match
        return { ratio: null, type: "nts", source: "auto", raw: match[0] };
      }
      // Prefer known common scales
      if (KNOWN_RATIOS[ratio]) {
        return { ratio: ratio, type: pat.type, source: "auto", raw: match[0] };
      }
      // Store first match as fallback
      if (!bestResult) {
        bestResult = { ratio: ratio, type: pat.type, source: "auto", raw: match[0] };
      }
    }
  }

  // If we found a ratio but it's not in the known list, check if
  // appending common suffixes makes it known (e.g., 4 → 48)
  if (bestResult && !KNOWN_RATIOS[bestResult.ratio]) {
    var r = bestResult.ratio;
    // Try common completions
    for (var suffix = 0; suffix <= 9; suffix++) {
      var candidate = parseInt("" + r + suffix, 10);
      if (KNOWN_RATIOS[candidate]) {
        console.log("[SheetClassifier] Corrected scale 1:" + r + " → 1:" + candidate + " (known scale match)");
        bestResult.ratio = candidate;
        bestResult.raw = "1:" + candidate;
        break;
      }
    }
  }

  return bestResult;
}

export function classifySheet(sheetId, sheetTitle) {
  var title = (sheetTitle || "").toLowerCase();

  if (/\bplan\b/.test(title) && /\b(foundation|main|upper|floor|level|ground|basement)\b/.test(title))
    return CLASS.PLAN;
  if (/\broof\s+plan\b/.test(title)) return CLASS.PLAN;
  if (/\bsite\s+plan\b/.test(title)) return CLASS.SITE;
  if (/\bsection/.test(title)) return CLASS.SECTION;
  if (/\belevation/.test(title)) return CLASS.ELEVATION;
  if (/\bschedule/.test(title)) return CLASS.SCHEDULE;
  if (/\bdetail/.test(title)) return CLASS.DETAIL;
  if (/\bnotes?\b/.test(title)) return CLASS.GENERAL;
  if (/\bframing\b/.test(title)) return CLASS.STRUCTURAL;
  if (/\bassembl/.test(title)) return CLASS.GENERAL;
  if (/\b3d\b|\bview/.test(title)) return CLASS.OTHER;

  if (sheetId) {
    var prefix = sheetId.replace(/[\d.]+$/, "");
    if (SHEET_PREFIXES[prefix.substring(0, 2)]) return SHEET_PREFIXES[prefix.substring(0, 2)];
    if (SHEET_PREFIXES[prefix.substring(0, 1)]) return SHEET_PREFIXES[prefix.substring(0, 1)];
  }

  return CLASS.OTHER;
}

export function classifyAll() {
  var pageCount = Loader.getPageCount();
  var promises = [];
  for (var p = 1; p <= pageCount; p++) {
    promises.push(_classifyPage(p));
  }
  return Promise.all(promises);
}

function _classifyPage(pageNum) {
  return Promise.all([Loader.getTextContent(pageNum), Loader.getPageSize(pageNum)]).then(function (results) {
    var textItems = results[0];
    var size = results[1];
    var tb = parseTitleBlock(textItems, size.width, size.height);
    var cls = classifySheet(tb.sheetId, tb.sheetTitle);
    return { pageNum: pageNum, sheetId: tb.sheetId, sheetTitle: tb.sheetTitle, scale: tb.scale, classification: cls };
  });
}
