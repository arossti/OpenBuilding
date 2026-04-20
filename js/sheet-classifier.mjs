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
  var tbItems = textItems.filter(function (item) {
    return item.x > pageWidth * 0.65 && item.y > pageHeight * 0.75;
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

  var titleCandidates = tbItems.filter(function (item) {
    var s = item.str.trim();
    return s.length > 3 && s.length < 60 && !sheetIdPattern.test(s) && !/^\d+$/.test(s);
  });
  if (titleCandidates.length > 0) {
    titleCandidates.sort(function (a, b) {
      return a.y - b.y;
    });
    result.sheetTitle = titleCandidates[titleCandidates.length - 1].str.trim();
  }

  return result;
}

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
