/**
 * EPD-Parser P3 — text → schema-shape candidate record.
 *
 * Format-aware regex extraction. Caller passes in spatially-joined text
 * (one string per PDF page); extract() detects format family and
 * dispatches to the appropriate per-family extractor, returning a
 * candidate record matching the subset of material.schema.json that
 * P2's form pane exposes.
 *
 * Scope today: NA family (UL Environment / ASTM / CSA Group) and EPD
 * International registry (S-P-XXXXX). EU/IBU and NSF families fall
 * through to extractCommon() which still pulls ISO standards + the
 * S-P-XXXXX pattern but skips the per-family anchors. Per-family
 * extractors land in P3.1.
 *
 * Per-glyph drop-cap split tolerance: pdf.js v4 sometimes emits "D
 * ECLARATION" instead of "DECLARATION" (the leading drop-cap glyph
 * lands as a separate text item). Anchors use \s* between expected
 * adjacent chars where this is observed.
 */

export var FORMATS = {
  EPD_INTL: "epd_international",
  NA: "na",
  EU_IBU: "eu_ibu",
  NSF: "nsf",
  UNKNOWN: "unknown"
};

export function detectFormat(text) {
  if (/S-P-\d{5,6}/.test(text) && /Programme\s+operator/i.test(text)) return FORMATS.EPD_INTL;
  if (/Programme\s+holder/i.test(text) || /Owner\s+of\s+the\s+Declaration/i.test(text)) return FORMATS.EU_IBU;
  if (/NSF\s+International/i.test(text)) return FORMATS.NSF;
  if (/P\s*ROGRAM\s+O\s*PERATOR/i.test(text) || /Program\s+operator/i.test(text)) return FORMATS.NA;
  return FORMATS.UNKNOWN;
}

/**
 * @param {string[]} pageTexts — spatially-joined per-page text from PDF.
 * @returns {{format: string, record: object, anchorsHit: number}}
 */
export function extract(pageTexts) {
  var allText = (pageTexts || []).join("\n\n");
  var format = detectFormat(allText);
  var rec = {};
  if (format === FORMATS.EPD_INTL) extractEpdIntl(allText, rec);
  else if (format === FORMATS.NA) extractNA(allText, rec);
  else if (format === FORMATS.NSF) extractNSF(allText, rec);
  // EU_IBU + UNKNOWN: fall through to common-only for now
  extractCommon(allText, rec);
  return { format: format, record: rec, anchorsHit: _countAnchors(rec) };
}

/* ── Cross-format anchors (always run last; first-set wins) ────────── */

// Known program operators — easier to detect by name than by label-then-value
// since tabular EPD layouts often put the label on its own line away from the
// value column. List ordered by specificity (longer/more-distinctive first).
function _detectProgramOperator(text) {
  if (/EPD\s+International\s+AB/i.test(text)) return "EPD International AB";
  if (/Institut\s+Bauen\s+und\s+Umwelt|IBU\s*–|\bIBU\b/.test(text)) return "IBU";
  if (/NSF\s+International/i.test(text)) return "NSF International";
  if (/CSA\s+Group/i.test(text)) return "CSA Group";
  if (/ASTM\s+International/i.test(text)) return "ASTM International";
  if (/UL\s+Environment/i.test(text)) return "UL Environment";
  if (/American\s+Wood\s+Council|AWC\s*&?\s*CWC|Canadian\s+Wood\s+Council/i.test(text)) return "AWC & CWC";
  return null;
}

// Find a date in the 200-char window AFTER a label match. More robust than
// trying to capture the value in a single regex when EPDs spread label and
// value across multiple lines.
function _findDateAfterLabel(text, labelPattern) {
  var m = labelPattern.exec(text);
  if (!m) return null;
  var window = text.substring(m.index + m[0].length, m.index + m[0].length + 200);
  return _parseDate(window);
}

// Find a free-text value after a label (for things like manufacturer / PCR).
function _findStringAfterLabel(text, labelPattern, maxLen) {
  var m = labelPattern.exec(text);
  if (!m) return null;
  var rest = text.substring(m.index + m[0].length);
  // Take up to N chars, stop at newline or label-like uppercase run
  var win = rest.substring(0, maxLen || 200);
  var firstLine = win.split(/\n/, 1)[0];
  return _cleanLine(firstLine);
}

function extractCommon(text, rec) {
  // Standards — collect any of the canonical citations.
  var standards = [];
  var seen = {};
  var stdPatterns = [
    /ISO\s*1[34]025(?::20\d{2})?/i,
    /ISO\s*21930(?::20\d{2})?/i,
    /EN\s*15804(?:\+A[12])?(?:(?::20\d{2})|(?:\/AC[:0-9\-]*))?/i,
    /ISO\s*14040(?:\/4{1,2})?/i,
    /CAN\/CSA-?\s*ISO\s*1[34]025/i
  ];
  for (var i = 0; i < stdPatterns.length; i++) {
    var m = text.match(stdPatterns[i]);
    if (m) {
      var v = _cleanLine(m[0]);
      if (!seen[v]) {
        standards.push(v);
        seen[v] = true;
      }
    }
  }
  if (standards.length && !_get(rec, "methodology.standards")) {
    _setPath(rec, "methodology.standards", standards);
  }

  // S-P-XXXXX — the EPD International ID. If we're in NA format and the
  // doc references both an internal (e.g. CSA #3688-5839) and an EPD
  // International (S-P-XXXXX) ID, we prefer the EPD-Intl one because it
  // matches the BEAM internal-ID convention Melanie established.
  if (!_get(rec, "epd.id")) {
    var spMatch = text.match(/S-P-(\d{5,6})/);
    if (spMatch) _setPath(rec, "epd.id", "S-P-" + spMatch[1]);
  }

  // Validation marker — checkbox layout common across NA + EPD-Intl
  if (!_get(rec, "epd.validation.type")) {
    if (/[x✓]\s*EXTERNAL/i.test(text) || /External\s+verification/i.test(text)) {
      _setPath(rec, "epd.validation.type", "external");
    } else if (/[x✓]\s*INTERNAL/i.test(text) || /Internal\s+verification/i.test(text)) {
      _setPath(rec, "epd.validation.type", "internal");
    }
  }

  // Program operator — last-resort detection if format-specific extractor
  // didn't set one (covers UNKNOWN format and EU_IBU which doesn't have its
  // own extractor yet).
  if (!_get(rec, "epd.program_operator")) {
    var po = _detectProgramOperator(text);
    if (po) _setPath(rec, "epd.program_operator", po);
  }

  // Impact-table totals — populate impacts.<indicator>.total.{value, source}
  // for every indicator in the schema we can find on the impact table.
  _extractIndicatorTotals(text, rec);
}

/* ── Impact-table parsing — per-indicator totals ──────────────────── */
//
// Each EPD has one or more impact-table rows of the shape:
//   <INDICATOR_CODE>  <UNIT>  <total or A1-A3>  <A1>  <A2>  <A3>  ...
// The first numeric token after the unit is the total (cradle-to-gate
// EPDs) or A1 (cradle-to-grave; we'll handle column-header parsing in
// the per-stage P3.2 work). For now: capture the first number → total.
//
// Indicator-code synonyms vary by program operator and LCIA method:
//   GWP, GWPTRACI, GWP100, GWPgwp100, GWPfossil, GWP-fossil, GWP-total
//   GWPBIO, GWP-bio, GWP-biogenic
//   ODP, ODPTRACI                       (kg CFC-11 eq)
//   AP, APTRACI, AP-AE                  (kg SO2 eq, mol H+ eq)
//   EP, EPTRACI, EP-AE                  (kg N eq, kg PO4-3 eq)
//   POCP, SFP, SFPTRACI                 (kg O3 eq, kg NMVOC eq)
//   ADPf, ADPfossil, ADP-NRf, FFD       (MJ NCV)
//   WDP, WaterDP                        (m³ or kg)
//   PENR, NRPE, PE-NR                   (MJ)
//   PER, RPE, PE-R                      (MJ)

// Trailing-context lookahead: after the captured number, require either
// (a) another numeric token (the per-stage breakdown that always follows
// the total in a real data row), or (b) end-of-line. This rejects
// methodology rows like "GWP TRACI kg CO2 eq TRACI 2.1 V1.02" where the
// value 2.1 is followed by "V1.02" rather than another number — the
// false-positive bug surfaced on 2017 WRC + 2020 OSB by the regression
// harness 2026-04-27.
var DATA_ROW_TAIL = "(?=\\s+-?\\s*\\d|\\s*[\\]\\)]|\\s*$)";

var IMPACT_INDICATORS = [
  // GWP fossil / total — comes BEFORE the biogenic regex so the more
  // specific "BIO" alternation doesn't grab the fossil row.
  {
    schemaKey: "gwp_kgco2e",
    label: "GWP-fossil/total",
    regex: new RegExp(
      "(?:^|\\n|\\s)GWP(?:TRACI|100|gwp100|fossil|[-\\s–]+(?:fossil|total))?(?!BIO|[-\\s–]*bio)[^\\n\\r]{0,18}?\\s+\\[?\\s*kg\\s*CO\\s*2?\\s*e(?:q|qv)?\\b[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,5}(?:[.,]\\d+)?(?:E\\s*[-+]?\\s*\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  },
  {
    schemaKey: "gwp_bio_kgco2e",
    label: "GWP-biogenic",
    regex: new RegExp(
      "(?:^|\\n|\\s)GWP(?:BIO|[-\\s–]+bio(?:genic)?)[^\\n\\r]{0,12}?\\s+\\[?\\s*kg\\s*CO\\s*2?\\s*e(?:q|qv)?\\b[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,5}(?:[.,]\\d+)?(?:E\\s*[-+]?\\s*\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  },
  {
    schemaKey: "ozone_depletion_kgcfc11eq",
    label: "ODP",
    regex: new RegExp(
      "(?:^|\\n|\\s)ODP[A-Z]{0,8}\\b[^\\n\\r]{0,18}?\\s+\\[?\\s*kg\\s*CFC[-\\s]*11\\s*e(?:q|qv)?[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,5}(?:[.,]\\d+)?(?:E\\s*[-+]?\\s*\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  },
  {
    schemaKey: "acidification_kgso2eq",
    label: "AP",
    regex: new RegExp(
      "(?:^|\\n|\\s)AP[A-Z]{0,8}\\b[^\\n\\r]{0,18}?\\s+\\[?\\s*kg\\s*SO\\s*2?\\s*e(?:q|qv)?[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,5}(?:[.,]\\d+)?(?:E\\s*[-+]?\\s*\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  },
  {
    schemaKey: "eutrophication_kgneq",
    label: "EP",
    regex: new RegExp(
      "(?:^|\\n|\\s)EP[A-Z]{0,8}\\b[^\\n\\r]{0,18}?\\s+\\[?\\s*kg\\s*N\\s*e(?:q|qv)?[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,5}(?:[.,]\\d+)?(?:E\\s*[-+]?\\s*\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  },
  {
    schemaKey: "smog_kgo3eq",
    label: "POCP/SFP",
    regex: new RegExp(
      "(?:^|\\n|\\s)(?:SFP|POCP)[A-Z]{0,8}\\b[^\\n\\r]{0,18}?\\s+\\[?\\s*kg\\s*O\\s*3?\\s*e(?:q|qv)?[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,5}(?:[.,]\\d+)?(?:E\\s*[-+]?\\s*\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  },
  {
    schemaKey: "abiotic_depletion_fossil_mj",
    label: "ADP-fossil",
    regex: new RegExp(
      "(?:^|\\n|\\s)(?:ADPf|ADP[\\s-]*fossil|ADP[\\s-]*NRf|FFD)\\b[^\\n\\r]{0,40}?\\[?\\s*MJ\\b[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,7}(?:[.,]\\d+)?(?:E\\s*[-+]?\\s*\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  },
  {
    schemaKey: "water_consumption_m3",
    label: "WDP",
    regex: new RegExp(
      "(?:^|\\n|\\s)(?:WDP|Water[\\s-]*DP)\\b[^\\n\\r]{0,30}?\\[?\\s*(?:m\\s*3?|m³|kg)\\b[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,5}(?:[.,]\\d+)?(?:E\\s*[-+]?\\s*\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  },
  {
    schemaKey: "primary_energy_nonrenewable_mj",
    label: "PE-NR",
    regex: new RegExp(
      "(?:^|\\n|\\s)(?:PENR\\b|NRPE\\b|PE[\\s-]?NR\\b|Non[\\s-]?renewable\\s+primary\\s+energy)\\b[^\\n\\r]{0,40}?\\[?\\s*MJ\\b[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,7}(?:[.,]\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  },
  {
    schemaKey: "primary_energy_renewable_mj",
    label: "PE-R",
    regex: new RegExp(
      "(?:^|\\n|\\s)(?:PER\\b|RPE\\b|PE[\\s-]?R\\b(?!T)|Renewable\\s+primary\\s+energy)\\b[^\\n\\r]{0,40}?\\[?\\s*MJ\\b[^\\n\\r]{0,12}?\\s+(-?\\s*\\d{1,7}(?:[.,]\\d+)?)" +
        DATA_ROW_TAIL,
      "i"
    )
  }
];

function _extractIndicatorTotals(text, rec) {
  for (var i = 0; i < IMPACT_INDICATORS.length; i++) {
    var ind = IMPACT_INDICATORS[i];
    if (_get(rec, "impacts." + ind.schemaKey + ".total.value") != null) continue;
    var m = text.match(ind.regex);
    if (!m) continue;
    var raw = m[1].replace(/\s+/g, "");
    var num = parseFloat(raw.replace(",", "."));
    if (isNaN(num)) continue;
    _setPath(rec, "impacts." + ind.schemaKey + ".total.value", num);
    _setPath(rec, "impacts." + ind.schemaKey + ".total.source", "epd_direct");
  }
}

/* ── NA family: UL Environment / ASTM / CSA Group ──────────────────── */

function extractNA(text, rec) {
  // Manufacturer / Declaration Holder.
  var mfr =
    text.match(/D\s*ECLARATION\s+H\s*OLDER\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/) ||
    text.match(/Manufacturer\s+name(?:\s+and\s+address)?\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/) ||
    text.match(/EPD\s+Commissioner\s+(?:and\s+)?Owner\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/i) ||
    text.match(/Declaration\s+holder\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/i);
  if (mfr) _setPath(rec, "manufacturer.name", _cleanLine(mfr[1]));

  // EPD ID / Declaration Number — allow embedded spaces in the value
  // (e.g. "EPD 395") and per-glyph drop-cap split on the label.
  var epdId =
    text.match(/D\s*eclaration\s+N\s*umber\s*[#:\s]+([A-Z][A-Z0-9.\-#\s]{2,38}\d[A-Z0-9.\-#]{0,10})/i) ||
    text.match(/EPD\s+(?:Registration\s+)?Number\s*[#:\s]+([A-Z0-9][A-Z0-9.\-#\s]{2,38}\d[A-Z0-9.\-#]{0,10})/i);
  if (epdId) _setPath(rec, "epd.id", epdId[1].replace(/^#/, "").replace(/\s+/g, " ").trim());

  // Program operator — detect by known name (more robust than label-anchored
  // for tabular layouts where "Program Operator" appears on its own line).
  var po = _detectProgramOperator(text);
  if (po) _setPath(rec, "epd.program_operator", po);

  // Declared / functional unit + density (often on the same line)
  var unit =
    text.match(/(?:DECLARED|FUNCTIONAL)\s+(?:PRODUCT\s*&\s*)?UNIT\s*[:\s]+([^\n\r]{6,200})/i) ||
    text.match(/Declared\s+unit\s*[:\s]+([^\n\r]{6,200})/i);
  if (unit) {
    _setPath(rec, "carbon.stated.per_unit", _cleanLine(unit[1]));
    var dInLine = unit[1].match(/(\d{2,5}(?:[.,]\d+)?)\s*kg\/m\s*[³^]?3?/);
    if (dInLine) _setPath(rec, "physical.density.value_kg_m3", _toNum(dInLine[1]));
  }
  if (_get(rec, "physical.density.value_kg_m3") == null) {
    var d = text.match(/density\s*(?:of\s+)?(\d{2,5}(?:[.,]\d+)?)\s*kg\/m\s*[³^]?3?/i);
    if (d) _setPath(rec, "physical.density.value_kg_m3", _toNum(d[1]));
  }

  // PCR — target the Part B (sub-category) reference specifically, with
  // per-glyph "Pa rt B" tolerance. Falls back to a labeled capture for
  // formats that don't split into Part A/B.
  var partB = text.match(/Pa\s*rt\s+B\s*:?\s*([^\n\r\[]{8,200})/i);
  if (partB) {
    _setPath(rec, "methodology.pcr_guidelines", _cleanLine(partB[1]));
  } else {
    var pcrLine =
      text.match(/Reference\s+PCR(?:\s+and\s+version\s+number)?\s*[:\s]+([^\n\r\[]{8,200})/i) ||
      text.match(/Product\s+Category\s+Rules?\s*\(?PCR\)?\s*[:\s]+([^\n\r\[]{8,200})/i);
    if (pcrLine) _setPath(rec, "methodology.pcr_guidelines", _cleanLine(pcrLine[1]));
  }

  // Publication date — label-then-window
  var pubIso =
    _findDateAfterLabel(text, /Date\s+of\s+Issue\s*(?:&\s*Validity\s+Period)?/i) ||
    _findDateAfterLabel(text, /Publication\s+date/i) ||
    _findDateAfterLabel(text, /Issue\s+date/i);
  if (pubIso) _setPath(rec, "epd.publication_date", pubIso);

  // Expiry / validity
  var expIso =
    _findDateAfterLabel(text, /Period\s+of\s+validity/i) ||
    _findDateAfterLabel(text, /Valid\s+until/i) ||
    _findDateAfterLabel(text, /Valid\s+to/i) ||
    _findDateAfterLabel(text, /Expiry\s+date/i);
  if (expIso) _setPath(rec, "epd.expiry_date", expIso);

  // EPD type
  var typ = text.match(/EPD\s+type\s*[:\s]+([^\n\r]{4,40})/i);
  if (typ) {
    var t = typ[1].toLowerCase();
    if (/product[-\s]*specific/.test(t)) _setPath(rec, "epd.type", "product_specific");
    else if (/industry[-\s]*average/.test(t)) _setPath(rec, "epd.type", "industry_average");
    else if (/generic/.test(t)) _setPath(rec, "epd.type", "generic");
  }

  // Markets of applicability
  var mkts =
    text.match(/Markets\s+of\s+applicability\s*[:\s]+([^\n\r]{2,80})/i) ||
    text.match(/Region\s+covered\s*[:\s]+([^\n\r]{2,80})/i);
  if (mkts) {
    var arr = _splitToCodes(mkts[1]);
    if (arr.length) _setPath(rec, "provenance.markets_of_applicability", arr);
  }
}

/* ── EPD International registry format (S-P-XXXXX) ─────────────────── */

function extractEpdIntl(text, rec) {
  // S-P-XXXXX is the canonical ID
  var sp = text.match(/S-P-(\d{5,6})/);
  if (sp) _setPath(rec, "epd.id", "S-P-" + sp[1]);

  _setPath(rec, "epd.program_operator", "EPD International AB");

  // Dates in ISO format (typical for this registry)
  var pub = text.match(/Publication\s+date\s*:\s*(\d{4}-\d{2}-\d{2})/i);
  if (pub) _setPath(rec, "epd.publication_date", pub[1]);
  var exp = text.match(/Valid\s+until\s*:\s*(\d{4}-\d{2}-\d{2})/i);
  if (exp) _setPath(rec, "epd.expiry_date", exp[1]);

  // Manufacturer ("from <MFR>" or "Owner of the Declaration: <MFR>")
  var mfr =
    text.match(/from\s+\n?\s*([A-Z][A-Za-z0-9 &.,'\-]{2,80})/) ||
    text.match(/Owner\s+of\s+the\s+Declaration\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/);
  if (mfr) _setPath(rec, "manufacturer.name", _cleanLine(mfr[1]));

  // Functional / declared unit
  var unit = text.match(/Functional\s+unit\s*\/\s*declared\s+unit\s*[:\s]+([^\n\r]{4,200})/i);
  if (unit) _setPath(rec, "carbon.stated.per_unit", _cleanLine(unit[1]));

  // PCR (EPD International convention is "Product Category Rules (PCR):")
  var pcr =
    text.match(/Product\s+Category\s+Rules?\s*\(PCR\)\s*:\s*([^\n\r]{8,300})/i) ||
    text.match(/PCR\s+\d{4}:\d+\s+v\d[\d.]*/i);
  if (pcr) _setPath(rec, "methodology.pcr_guidelines", _cleanLine(pcr[0]));
}

/* ── NSF format (cement, Lafarge etc.) ─────────────────────────────── */

function extractNSF(text, rec) {
  _setPath(rec, "epd.program_operator", "NSF International");

  var mfr = text.match(/EPD\s+Commissioner\s+(?:and\s+)?Owner\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/);
  if (mfr) _setPath(rec, "manufacturer.name", _cleanLine(mfr[1]));

  var unit = text.match(/Declared\s+Unit\s*[:\s]+([^\n\r]{4,200})/i);
  if (unit) _setPath(rec, "carbon.stated.per_unit", _cleanLine(unit[1]));

  var pcr = text.match(/Product\s+Category\s+Rules?\s*\(?PCR\)?\s*[:\s]+([^\n\r]{8,300})/i);
  if (pcr) _setPath(rec, "methodology.pcr_guidelines", _cleanLine(pcr[1]));

  var pubDate = text.match(/Date\s+of\s+Issue(?:\s*&\s*Validity\s*Period)?\s*[:\s]+([^\n\r]{4,80})/i);
  if (pubDate) {
    var iso = _parseDate(pubDate[1]);
    if (iso) _setPath(rec, "epd.publication_date", iso);
  }
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function _normaliseProgramOperator(s) {
  // Strip URL fragments & addresses that the regex tail catches
  return s.replace(/\s+https?:\/\/.*$/, "").replace(/\s+\d{2,}.*$/, "").trim();
}

function _setPath(obj, path, value) {
  var parts = path.split(".");
  var ref = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    if (ref[parts[i]] == null) ref[parts[i]] = {};
    ref = ref[parts[i]];
  }
  ref[parts[parts.length - 1]] = value;
}

function _get(obj, path) {
  var parts = path.split(".");
  var ref = obj;
  for (var i = 0; i < parts.length; i++) {
    if (ref == null) return undefined;
    ref = ref[parts[i]];
  }
  return ref;
}

function _cleanLine(s) {
  return String(s == null ? "" : s)
    .replace(/\s+/g, " ")
    .trim();
}

function _toNum(s) {
  return parseFloat(String(s).replace(",", "."));
}

function _splitToCodes(s) {
  // "CAN, USA" / "Canada, United States" / "North America"
  var raw = _cleanLine(s);
  if (/north\s+america/i.test(raw)) return ["CAN", "USA"];
  if (/europe/i.test(raw) && !/eastern|western/i.test(raw)) return ["EUR"];
  // Try comma-split, keep tokens that look like ISO-3 codes
  var parts = raw.split(/[,;]+/).map(_cleanLine).filter(Boolean);
  var iso3 = parts.filter(function (p) { return /^[A-Z]{3}$/.test(p); });
  if (iso3.length) return iso3;
  // Common name → ISO3 mini-map
  var map = { canada: "CAN", "united states": "USA", "us": "USA", usa: "USA" };
  var mapped = [];
  for (var i = 0; i < parts.length; i++) {
    var k = parts[i].toLowerCase();
    if (map[k]) mapped.push(map[k]);
  }
  return mapped;
}

var MONTHS = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12"
};

function _parseDate(s) {
  if (!s) return null;
  var str = String(s);

  // ISO already
  var iso = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];

  // DD/MM/YYYY (European)
  var eu = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (eu) return eu[3] + "-" + _pad2(eu[2]) + "-" + _pad2(eu[1]);

  // "DD Month YYYY" — tolerate weird whitespace around the comma
  var en = str.match(/(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})/);
  if (en) {
    var m = MONTHS[en[2].toLowerCase().slice(0, 3)];
    if (m) return en[3] + "-" + m + "-" + _pad2(en[1]);
  }

  // "Month DD, YYYY" — pdf.js sometimes emits "February   20 , 2023"
  // (extra spaces before/after the comma), so allow `\s*,?\s*` between
  // the day and year rather than requiring a tight ", ".
  var enUS = str.match(/([A-Za-z]+)\s+(\d{1,2})\s*,?\s*(\d{4})/);
  if (enUS) {
    var m2 = MONTHS[enUS[1].toLowerCase().slice(0, 3)];
    if (m2) return enUS[3] + "-" + m2 + "-" + _pad2(enUS[2]);
  }

  // "Month YYYY" only — no day, set to first
  var enMon = str.match(/^\s*([A-Za-z]+)\s+(\d{4})/);
  if (enMon) {
    var m3 = MONTHS[enMon[1].toLowerCase().slice(0, 3)];
    if (m3) return enMon[2] + "-" + m3 + "-01";
  }

  return null;
}

function _pad2(s) {
  s = String(s);
  return s.length < 2 ? "0" + s : s;
}

function _countAnchors(rec) {
  var paths = [
    "manufacturer.name",
    "epd.id",
    "epd.program_operator",
    "epd.publication_date",
    "epd.expiry_date",
    "carbon.stated.per_unit",
    "methodology.pcr_guidelines",
    "methodology.standards",
    "physical.density.value_kg_m3"
  ];
  var n = 0;
  for (var i = 0; i < paths.length; i++) {
    var v = _get(rec, paths[i]);
    if (v != null && (typeof v !== "object" || (Array.isArray(v) && v.length))) n++;
  }
  return n;
}
