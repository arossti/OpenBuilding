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

  // Candidate titles — plausible drawing-name strings. Rejects numeric-only,
  // too-short/too-long, the sheet-id pattern, and noise like revision dates.
  var titleCandidates = tbItems.filter(function (item) {
    var s = item.str.trim();
    if (s.length <= 3 || s.length >= 60) return false;
    if (sheetIdPattern.test(s)) return false;
    if (/^\d+$/.test(s)) return false;
    return !_looksLikeTitleNoise(s);
  });

  // Three-tier title picker (best → fallback):
  //   1. Labelled title ("Sheet Name: FLOOR PLAN") — highest-signal match.
  //   2. Largest font among candidates — drawing titles are usually the
  //      most prominent text in a title block.
  //   3. Bottom-most candidate — legacy fallback.
  var title = _findLabelledTitle(tbItems);
  if (!title && titleCandidates.length > 0) {
    title = _findLargestFontTitle(titleCandidates);
  }
  if (!title && titleCandidates.length > 0) {
    titleCandidates.sort(function (a, b) {
      return a.y - b.y;
    });
    title = titleCandidates[titleCandidates.length - 1].str.trim();
  }
  result.sheetTitle = title || null;

  return result;
}

// Regexes for known title-block labels. Matches the whole item when the
// label appears alone ("Sheet Name:"), and also handles inline forms where
// the label and value share one text item ("Sheet Name: FLOOR PLAN").
var _TITLE_LABEL_PATTERNS = [
  /^(?:sheet|drawing|dwg)\s+(?:name|title)\s*:?\s*$/i,
  /^title\s*:?\s*$/i,
  /^name\s*:?\s*$/i
];
var _TITLE_INLINE_PATTERN = /^(?:sheet|drawing|dwg)\s+(?:name|title)\s*:\s*(.+)$/i;

function _findLabelledTitle(tbItems) {
  // Pass 1 — inline form: one item contains both "Sheet Name:" and the title.
  for (var i = 0; i < tbItems.length; i++) {
    var s = tbItems[i].str.trim();
    var m = s.match(_TITLE_INLINE_PATTERN);
    if (m && m[1]) {
      var val = m[1].trim();
      if (val.length >= 3 && val.length < 60 && !_looksLikeTitleNoise(val)) return val;
    }
  }

  // Pass 2 — split form: a label item + a nearby value. "Nearby" means the
  // closest item that's either to the right on the same row or directly
  // below the label, within a loose bounding region.
  for (var j = 0; j < tbItems.length; j++) {
    var labelItem = tbItems[j];
    var labelText = labelItem.str.trim();
    if (!_TITLE_LABEL_PATTERNS.some(function (p) { return p.test(labelText); })) continue;

    var best = null;
    var bestDist = Infinity;
    var labelRight = labelItem.x + (labelItem.width || 0);

    for (var k = 0; k < tbItems.length; k++) {
      if (k === j) continue;
      var item = tbItems[k];
      var text = item.str.trim();
      if (text.length < 3 || text.length >= 60) continue;
      if (_TITLE_LABEL_PATTERNS.some(function (p) { return p.test(text); })) continue;
      if (_looksLikeTitleNoise(text)) continue;

      var sameRow = Math.abs(item.y - labelItem.y) < 5;
      var rightOfLabel = item.x >= labelRight - 2;
      var directlyBelow = item.y > labelItem.y && item.y - labelItem.y < 25;
      if (!((sameRow && rightOfLabel) || directlyBelow)) continue;

      var dx = item.x - labelItem.x;
      var dy = item.y - labelItem.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = text;
      }
    }
    if (best) return best;
  }

  return null;
}

// Drawing titles often span multiple lines at the same font size (e.g.
// "North Elevation" / "Right Side"). Pick the largest font, collect every
// candidate at that size, group them into rows (items sharing a Y bucket),
// then group adjacent rows into vertical stacks when they overlap
// horizontally. Pick the longest stack and join in reading order.
function _findLargestFontTitle(titleCandidates) {
  if (titleCandidates.length === 0) return null;

  var byFont = titleCandidates.slice().sort(function (a, b) {
    return (b.fontSize || 0) - (a.fontSize || 0);
  });
  var maxFont = byFont[0].fontSize || 0;
  if (maxFont === 0) return byFont[0].str.trim();

  var fontTol = 1.0;
  var topFontItems = byFont.filter(function (item) {
    return Math.abs((item.fontSize || 0) - maxFont) <= fontTol;
  });
  if (topFontItems.length === 1) return topFontItems[0].str.trim();

  // Row clustering — items with Y values inside the same bucket share a line.
  var rowYTol = Math.max(3, maxFont * 0.3);
  var rows = [];
  topFontItems.forEach(function (item) {
    var host = null;
    for (var r = 0; r < rows.length; r++) {
      if (Math.abs(rows[r].y - item.y) <= rowYTol) {
        host = rows[r];
        break;
      }
    }
    if (host) {
      host.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  });

  rows.forEach(function (row) {
    row.items.sort(function (a, b) {
      return a.x - b.x;
    });
    row.text = row.items
      .map(function (i) {
        return i.str.trim();
      })
      .filter(Boolean)
      .join(" ");
    row.xMin = Math.min.apply(
      null,
      row.items.map(function (i) {
        return i.x;
      })
    );
    row.xMax = Math.max.apply(
      null,
      row.items.map(function (i) {
        return i.x + (i.width || 0);
      })
    );
  });
  rows.sort(function (a, b) {
    return a.y - b.y;
  });

  // Stack rows that are vertically adjacent (within ~2× font height) AND
  // horizontally overlap or share a centerline — catches left-aligned and
  // centered title layouts.
  var lineHeightCap = maxFont * 2.2;
  var stacks = [];
  rows.forEach(function (row) {
    for (var s = 0; s < stacks.length; s++) {
      var stack = stacks[s];
      var last = stack[stack.length - 1];
      var gap = row.y - last.y;
      if (gap <= 0 || gap > lineHeightCap) continue;
      var overlap = row.xMin < last.xMax && row.xMax > last.xMin;
      var lastCenter = (last.xMin + last.xMax) / 2;
      var rowCenter = (row.xMin + row.xMax) / 2;
      var centered = Math.abs(rowCenter - lastCenter) < Math.max(30, maxFont * 2);
      if (overlap || centered) {
        stack.push(row);
        return;
      }
    }
    stacks.push([row]);
  });

  // Prefer the stack with the most rows; break ties on total character count.
  var bestStack = stacks.reduce(function (best, current) {
    if (!best) return current;
    if (current.length > best.length) return current;
    if (current.length === best.length) {
      var curChars = current.reduce(function (n, r) {
        return n + r.text.length;
      }, 0);
      var bestChars = best.reduce(function (n, r) {
        return n + r.text.length;
      }, 0);
      return curChars > bestChars ? current : best;
    }
    return best;
  }, null);
  if (!bestStack) return null;

  var titleText = bestStack
    .map(function (r) {
      return r.text;
    })
    .filter(Boolean)
    .join(" ")
    .trim();

  // Safety net — multi-line stacks shouldn't exceed a reasonable title length.
  // If the join runs long (e.g. stack accidentally merged a signature line),
  // fall back to the top-most row.
  if (titleText.length > 100) return bestStack[0].text;
  return titleText;
}

// Reject common title-block noise — revision lines, dates, signatures,
// authored-by notes, "page N of M", scale text. Catches the values that
// slipped through the length filter in the old picker.
function _looksLikeTitleNoise(s) {
  if (/\brev(ision|\.)?\b/i.test(s)) return true;
  if (/\b(issued|drawn|checked|approved)\b/i.test(s)) return true;
  if (/\bscale\b/i.test(s)) return true;
  if (/^\s*page\s+\d/i.test(s)) return true;
  if (/\d{4}[-\/.]\d{1,2}[-\/.]\d{1,2}/.test(s)) return true; // YYYY-MM-DD
  if (/\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}/.test(s)) return true; // DD-MM-YY
  if (/^\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\w*\s+\d{1,2}/i.test(s)) return true;
  if (/\b(OAA|OAQ|OAO|MRAIC|FRAIC|P\.?Eng)\b/.test(s)) return true; // professional signature suffixes
  return false;
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
