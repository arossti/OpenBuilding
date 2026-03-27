/**
 * PDF-Parser — Sheet Classification
 */

import * as Loader from "./pdf-loader.mjs";
import { SCALE_PATTERNS, SHEET_PREFIXES, CLASS } from "./config.mjs";

export function parseTitleBlock(textItems, pageWidth, pageHeight) {
  var tbItems = textItems.filter(function(item) {
    return item.x > pageWidth * 0.65 && item.y > pageHeight * 0.75;
  });

  var result = { sheetId: null, sheetTitle: null, scale: null, raw: tbItems };

  var sheetIdPattern = /^[A-Z]\d+\.\d+$/;
  for (var i = 0; i < tbItems.length; i++) {
    var s = tbItems[i].str.trim();
    if (sheetIdPattern.test(s)) { result.sheetId = s; break; }
  }

  result.scale = detectScale(textItems);

  var titleCandidates = tbItems.filter(function(item) {
    var s = item.str.trim();
    return s.length > 3 && s.length < 60 && !sheetIdPattern.test(s) && !/^\d+$/.test(s);
  });
  if (titleCandidates.length > 0) {
    titleCandidates.sort(function(a, b) { return a.y - b.y; });
    result.sheetTitle = titleCandidates[titleCandidates.length - 1].str.trim();
  }

  return result;
}

export function detectScale(textItems) {
  var allText = textItems.map(function(item) { return item.str; }).join(" ");
  for (var i = 0; i < SCALE_PATTERNS.length; i++) {
    var pat = SCALE_PATTERNS[i];
    var match = allText.match(pat.regex);
    if (match) {
      return { ratio: pat.extract(match), type: pat.type, source: "auto", raw: match[0] };
    }
  }
  return null;
}

export function classifySheet(sheetId, sheetTitle) {
  var title = (sheetTitle || "").toLowerCase();

  if (/\bplan\b/.test(title) && /\b(foundation|main|upper|floor|level|ground|basement)\b/.test(title)) return CLASS.PLAN;
  if (/\broof\s+plan\b/.test(title))     return CLASS.PLAN;
  if (/\bsite\s+plan\b/.test(title))     return CLASS.SITE;
  if (/\bsection/.test(title))           return CLASS.SECTION;
  if (/\belevation/.test(title))         return CLASS.ELEVATION;
  if (/\bschedule/.test(title))          return CLASS.SCHEDULE;
  if (/\bdetail/.test(title))            return CLASS.DETAIL;
  if (/\bnotes?\b/.test(title))          return CLASS.GENERAL;
  if (/\bframing\b/.test(title))         return CLASS.STRUCTURAL;
  if (/\bassembl/.test(title))           return CLASS.GENERAL;
  if (/\b3d\b|\bview/.test(title))       return CLASS.OTHER;

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
  return Promise.all([
    Loader.getTextContent(pageNum),
    Loader.getPageSize(pageNum)
  ]).then(function(results) {
    var textItems = results[0];
    var size = results[1];
    var tb = parseTitleBlock(textItems, size.width, size.height);
    var cls = classifySheet(tb.sheetId, tb.sheetTitle);
    return { pageNum: pageNum, sheetId: tb.sheetId, sheetTitle: tb.sheetTitle, scale: tb.scale, classification: cls };
  });
}
