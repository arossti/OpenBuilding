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

  // Candidate titles — plausible drawing-name strings. Length / numeric /
  // sheet-id guards only. Noise ("Revisions:", "Issued For:", signatures,
  // dates) is filtered structurally downstream: nothing becomes a title
  // unless it (a) contains a drawing-type keyword AS ANCHOR or
  // (b) shares font size + adjacency with one that does. Anything else
  // stays on the bench.
  var titleCandidates = tbItems.filter(function (item) {
    var s = item.str.trim();
    if (s.length <= 3 || s.length >= 60) return false;
    if (sheetIdPattern.test(s)) return false;
    if (/^\d+$/.test(s)) return false;
    return true;
  });

  // Strict triage — the title MUST contain a primary drawing-type keyword.
  // If no candidate contains one, sheetTitle stays null and the display
  // layer falls through to classification ("Plan"/"Other") or the page
  // number. Per Andy: better to show "Page 11 — Other" than to guess and
  // land on "Revisions:" or some other stray label.
  result.sheetTitle = _findDrawingTypeTitle(titleCandidates) || null;

  return result;
}

// Required keyword on the title anchor. Scoped to the four drawing types
// BfCA actually cares about: plans, sections, elevations, site / key plan.
// Levels + orientations (north/south/basement/ground/first/second) don't
// anchor on their own but ride along as siblings via _stackTitle when they
// share font size and proximity with the anchor.
var _DRAWING_TYPE_RX = /\b(plan|elevation|section|site|key[\s-]*plan)\b/i;

function _findDrawingTypeTitle(titleCandidates) {
  if (titleCandidates.length === 0) return null;
  var typed = titleCandidates.filter(function (item) {
    return _DRAWING_TYPE_RX.test(item.str);
  });
  if (typed.length === 0) return null;
  typed.sort(function (a, b) {
    return (b.fontSize || 0) - (a.fontSize || 0);
  });
  return _stackTitle(typed[0], titleCandidates);
}

// Assemble the full title around a keyword-anchor: pull same-font candidates
// on the same row (e.g. "WEST" next to "ELEVATION") plus vertically adjacent
// rows ("North Elevation" + "Right Side"). Siblings must match font size and
// either overlap horizontally or share a centerline with the anchor.
function _stackTitle(anchor, allCandidates) {
  var anchorFont = anchor.fontSize || 0;
  var fontTol = Math.max(1.0, anchorFont * 0.1);
  var rowYTol = Math.max(3, anchorFont * 0.3);
  var lineGap = anchorFont ? anchorFont * 2.2 : 30;
  var alignTol = Math.max(40, anchorFont * 3);
  var anchorCenter = anchor.x + (anchor.width || 0) / 2;
  var anchorRight = anchor.x + (anchor.width || 0);

  var siblings = allCandidates.filter(function (item) {
    if (item === anchor) return false;
    if (Math.abs((item.fontSize || 0) - anchorFont) > fontTol) return false;
    var dy = item.y - anchor.y;
    if (Math.abs(dy) < rowYTol) return true; // same row
    if (Math.abs(dy) > lineGap) return false; // too far vertically
    var itemCenter = item.x + (item.width || 0) / 2;
    var itemRight = item.x + (item.width || 0);
    var overlap = item.x < anchorRight && itemRight > anchor.x;
    var centered = Math.abs(itemCenter - anchorCenter) < alignTol;
    return overlap || centered;
  });

  var group = [anchor].concat(siblings);
  group.sort(function (a, b) {
    if (Math.abs(a.y - b.y) > rowYTol) return a.y - b.y;
    return a.x - b.x;
  });

  var text = group
    .map(function (i) {
      return i.str.trim();
    })
    .filter(Boolean)
    .join(" ")
    .trim();
  if (text.length > 100) return anchor.str.trim();
  return text;
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
