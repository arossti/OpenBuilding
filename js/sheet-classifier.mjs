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
  // No region filter. pdf-loader.mjs stores `x` in PDF user-space without
  // applying the page's rotation transform, so rotated sheets (common from
  // CAD exports) end up with the visual "right side" landing at a small X
  // in our coords. A strict keyword + font-size filter on the full page is
  // more robust than guessing which corner the title block lives in.
  var result = { sheetId: null, sheetTitle: null, scale: null, raw: textItems };

  // First try raw-item match — works on Calgary-style CAD exports that
  // emit the sheet id as a single text item.
  var sheetIdPattern = /^[A-Z]\d+\.\d+$/;
  for (var i = 0; i < textItems.length; i++) {
    var s = textItems[i].str.trim();
    if (sheetIdPattern.test(s)) {
      result.sheetId = s;
      break;
    }
  }
  // Fallback — scan spatial-joined rows for the sheetId pattern embedded
  // in longer strings. Catches per-glyph text (pdfjs v4 on ArchiCad-
  // style CID-font PDFs) where "A2.44" arrives as five separate items
  // "A" + "2" + "." + "4" + "4" and the raw-item loop misses it.
  //
  // Pages often contain multiple sheet-id-shaped strings — section and
  // elevation callouts ("A4.01", "A5.05", etc.) scattered across the
  // drawing. The SHEET'S OWN id is conventionally the largest-font one,
  // sitting alone in the title block. Collect all candidates, then pick
  // the largest fontSize (tie-break on lowest-on-page, since title
  // blocks conventionally live at the bottom-right).
  if (!result.sheetId) {
    var idInRow = /\b([A-Z]\d+\.\d+)\b/;
    var rows = _clusterRows(textItems);
    var candidates = [];
    for (var r = 0; r < rows.length; r++) {
      var m = rows[r].text.match(idInRow);
      if (m) candidates.push({ id: m[1], fontSize: rows[r].fontSize || 0, y: rows[r].y });
    }
    if (candidates.length > 0) {
      candidates.sort(function (a, b) {
        if (Math.abs(a.fontSize - b.fontSize) > 0.5) return b.fontSize - a.fontSize;
        return b.y - a.y;
      });
      result.sheetId = candidates[0].id;
    }
  }

  result.scale = detectScale(textItems);

  // Drawing-type keyword is the sole gate. Row-clustering inside
  // _findDrawingTypeTitle rejoins PDF.js-chunked items ("WEST" + "ELEVATION"
  // on the same baseline) before the regex runs. No match → null →
  // display layer falls through to classification.
  result.sheetTitle = _findDrawingTypeTitle(textItems) || null;

  return result;
}

// Two regexes work together:
//
// _TITLE_EXTRACT_RX matches the drawing-title PHRASE inside a row of text,
// optionally preceded by up to three orientation / level qualifiers. We
// return the matched phrase, not the whole row — so a row like
// "WHITE 6\" FASCIA SCALE: 3/16\"=1'-0\" EAST ELEVATION" yields just
// "EAST ELEVATION". Keeps titles tight; drops noisy callouts that happen
// to share a baseline with the actual title text.
//
// _DRAWING_TYPE_RX is kept for classifySheet() below (which matches on
// the full title string to decide plan/elevation/section/site).
var _DRAWING_TYPE_RX = /\b(plan|elevation|section|site|key[\s-]*plan)\b/i;
// Trailing suffix group (optional) captures section identifiers —
// "A-A", "AA", "AB", "A1", "1-1", "1A" — without grabbing a bare digit
// like the "6" in "UPPER FLOOR PLAN 6 3". Requires at least two
// characters or a hyphen pair, so single-letter / single-digit
// suffixes drop on the floor (user's call: "SECTION" alone is fine).
var _TITLE_EXTRACT_RX =
  /((?:\b(?:north|south|east|west|nw|ne|sw|se|front|rear|left|right|first|second|third|1st|2nd|3rd|ground|main|upper|lower|basement|roof|foundation|floor|storey|story|level|key|site)\b\s+){0,3})\b(plan|elevation|section|site|key[\s-]*plan)\b(?:\s+([A-Z]-[A-Z]|[A-Z]{2}|\d-\d|[A-Z]\d|\d[A-Z]))?/i;

// Row-cluster all text on the page, then extract the cleanest title PHRASE
// from each row using _TITLE_EXTRACT_RX (keyword + optional leading
// orientation/level qualifiers). Returning the extracted phrase — not the
// whole row — trims off unrelated callouts that happen to share a baseline
// with the title, so "WHITE 6\" FASCIA SCALE: 3/16\"=1'-0\" EAST ELEVATION"
// becomes "EAST ELEVATION" and "2/6 SCALE: 3/16\"=1'-0\" UPPER FLOOR PLAN
// 6 3" becomes "UPPER FLOOR PLAN".
function _findDrawingTypeTitle(textItems) {
  if (!textItems || textItems.length === 0) return null;
  var rows = _clusterRows(textItems);

  var extracted = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (/^\d+$/.test(row.text)) continue;
    var m = row.text.match(_TITLE_EXTRACT_RX);
    if (!m) continue;
    var phrase = m[0].replace(/\s+/g, " ").trim();
    if (phrase.length < 4) continue;
    extracted.push({ row: row, phrase: phrase });
  }
  if (extracted.length === 0) return null;

  // Rank by row font size (largest = most title-like). Ties break toward
  // the bottom-right of the page — BfCA title-block convention (large y =
  // visually lower in our top-left coords; large xMax = further right).
  extracted.sort(function (a, b) {
    var fontDiff = (b.row.fontSize || 0) - (a.row.fontSize || 0);
    if (Math.abs(fontDiff) > 0.5) return fontDiff;
    var yDiff = b.row.y - a.row.y;
    if (Math.abs(yDiff) > 5) return yDiff;
    return b.row.xMax - a.row.xMax;
  });
  return extracted[0].phrase;
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
  // Spatial join — insert a space only when the gap between adjacent
  // items exceeds half a character width. Naive " ".join() produces
  // "F O U N D A T I O N P L A N" on pdfjs v4 per-glyph output
  // (ArchiCad exports) and breaks the downstream \bplan\b regex;
  // spatial join preserves real word boundaries while collapsing
  // per-glyph runs back into "FOUNDATION PLAN".
  var text = _spatialJoin(items).replace(/\s+/g, " ").trim();
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
      // Insert a space when items are visibly separated (gap >
      // half-char-width) OR when they overlap by more than 2pt (real
      // overlap = prev.width is bogus or items are distinct — pdfjs v4
      // TJ-advanced text on Calgary emits "FOUNDATION PLAN" with
      // width=179 that visually overlaps the next dim). Sub-pixel
      // overlaps (~-0.02pt ArchiCad kerning) are same-word kerning
      // precision — keep as continuous so per-glyph runs coalesce.
      if (gap > charWidth || gap < -2) {
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
    // ANSI A-series convention (Andy 2026-04-23): A0/A1 general/site,
    // A2/A3 plans, A4 elevations, A5 sections, etc. Extract leading
    // letter + first digit block (e.g. "A2.44" → "A2") and look up
    // 2-char prefix first, 1-char fallback. The old regex
    // `/[\d.]+$/` stripped ALL trailing digits/dots and left just "A",
    // which SHEET_PREFIXES doesn't key on → everything misclassified.
    var prefixMatch = sheetId.match(/^([A-Z]+)(\d*)/);
    var letters = prefixMatch ? prefixMatch[1] : "";
    var firstDigit = prefixMatch && prefixMatch[2] ? prefixMatch[2].charAt(0) : "";
    var twoChar = letters.charAt(0) + firstDigit;
    if (twoChar.length === 2 && SHEET_PREFIXES[twoChar]) return SHEET_PREFIXES[twoChar];
    if (letters && SHEET_PREFIXES[letters.charAt(0)]) return SHEET_PREFIXES[letters.charAt(0)];
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
