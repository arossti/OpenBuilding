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

/* ── Lookup injection ──────────────────────────────────────────────── */
//
// extract() needs the material-type → group_prefix map and the display-
// name keyword fallback to populate Tier 1 (classification.group_prefix).
// Both are sourced from schema/lookups/*.json — the same files the CSV
// importer at schema/scripts/beam-csv-to-json.mjs reads. To stay in sync
// without duplicating data, callers prime the cache once at boot:
//
//   browser:  await fetch("data/schema/lookups/material-type-to-group.json")
//             then setLookups({ mtMap, kwPatterns })
//   harness:  read the JSON files from schema/lookups/ and call setLookups
//
// extract() runs synchronously regardless of whether lookups were primed —
// when absent, Tier 1 group inference is skipped (group_prefix stays null).

var _lookups = null;

export function setLookups(lookups) {
  _lookups = lookups || null;
}

export function getLookups() {
  return _lookups;
}

export function detectFormat(text) {
  // Priority order matters — narrowest match first to avoid false positives.
  // EPD International registry is most specific (S-P-XXXXX is canonical).
  if (/S-P-\d{5,6}/.test(text) && /Programme\s+operator/i.test(text)) return FORMATS.EPD_INTL;

  // NSF before EU_IBU because Lafarge cement EPDs contain the prose phrase
  // "the owner of the declaration is liable for the underlying information"
  // which the loose EU_IBU regex used to match → wrong format → no per-format
  // extraction. Surfaced 2026-04-27.
  if (/NSF\s+International/i.test(text)) return FORMATS.NSF;

  // EU_IBU now requires the LABEL form (start-of-line "Owner of the
  // Declaration" or "Programme holder" followed by whitespace + value)
  // rather than the prose phrase, so it doesn't false-positive on
  // disclaimers / commitment statements.
  if (/(?:^|\n)\s*Programme\s+holder\b/i.test(text) || /(?:^|\n)\s*Owner\s+of\s+the\s+Declaration\b/i.test(text)) {
    return FORMATS.EU_IBU;
  }

  if (/P\s*ROGRAM\s+O\s*PERATOR/i.test(text) || /Program\s+operator/i.test(text)) return FORMATS.NA;
  return FORMATS.UNKNOWN;
}

/**
 * Coarse-to-granular tier extraction (workplan §5.6 "trunk of tree first"):
 *
 *   Tier 2 — Type / display name        (extractType)
 *   Tier 1 — Group prefix               (inferGroupPrefix; consumes Tier 2)
 *   Tier 3 — Manufacturer + country     (per-format extractor)
 *   Tier 4 — Provenance / scope         (per-format extractor)
 *   Tier 5 — Identification             (per-format extractor)
 *   Tier 6 — Methodology                (extractCommon)
 *   Tier 7 — Physical                   (per-format extractor + extractCommon)
 *   Tier 8 — Impact totals              (extractCommon → _extractIndicatorTotals)
 *
 * Tier 2 runs before Tier 1 because Group is *inferred from* material_type
 * and display_name (the only tier with a downstream dependency in this
 * pipeline). Tiers 3–8 are independent of each other today; the ordering
 * matches the human mental model and keeps gaps narratively findable.
 *
 * @param {string[]} pageTexts — spatially-joined per-page text from PDF.
 * @returns {{format: string, record: object, anchorsHit: number}}
 */
export function extract(pageTexts) {
  var allText = (pageTexts || []).join("\n\n");
  var format = detectFormat(allText);
  var rec = {};

  // Tier 2 + Tier 1 — trunk of tree (display_name → material_type → group_prefix)
  extractType(allText, rec);
  inferGroupPrefix(rec);

  // Tiers 3–7 — per-format extractor handles manufacturer / provenance /
  // identification / per-family methodology / physical anchors.
  if (format === FORMATS.EPD_INTL) extractEpdIntl(allText, rec);
  else if (format === FORMATS.NA) extractNA(allText, rec);
  else if (format === FORMATS.NSF) extractNSF(allText, rec);
  else if (format === FORMATS.EU_IBU) extractEuIbu(allText, rec);
  // UNKNOWN: fall through to common-only.

  // Tiers 6 + 8 — cross-format methodology + impact totals (always last).
  extractCommon(allText, rec);

  return { format: format, record: rec, anchorsHit: _countAnchors(rec) };
}

/* ── Tier 2 — display name + material type ────────────────────────── */
//
// First non-trivial line of page 1 is almost always the product or EPD
// title (for industry-average EPDs) — that becomes display_name. Then a
// keyword match against the material-type-to-group lookup vocabulary
// finds the canonical material_type label. Both feed Tier 1.

var _MATERIAL_TYPE_DISPLAY_KEYWORDS = [
  // Wood
  { rx: /\bcross[- ]?laminated\s+timber\b|\bCLT\b/i, type: "Engineered wood" },
  { rx: /\bglulam\b|\bglue[- ]?laminated\b/i, type: "Glulam" },
  { rx: /\blaminated\s+veneer\s+lumber\b|\bLVL\b/i, type: "LVL" },
  { rx: /\bwood\s+i[- ]?joist\b/i, type: "Wood I-joist" },
  { rx: /\bplywood\b/i, type: "Plywood" },
  { rx: /\bsoft\s*wood\s+lumber\b|\bdimension\s+lumber\b|\bframing\s+lumber\b/i, type: "Framing" },
  { rx: /\bhardwood\b/i, type: "Hardwood" },
  // Concrete + masonry
  { rx: /\bportland(?:[- ]limestone)?\s+cement\b|\bGUL\b/i, type: "Portland Cement" },
  { rx: /\bready[- ]?mix(?:ed)?\s+concrete\b|\bconcrete\s+mix(?:es)?\b/i, type: "Concrete" },
  { rx: /\bconcrete\s+block\b|\bCMU\b/i, type: "Concrete" },
  { rx: /\bclay\s+brick\b/i, type: "Clay Brick" },
  { rx: /\bbrick\b/i, type: "Brick" },
  // Metals
  {
    rx: /\bhot[- ]?rolled\s+steel\b|\bstructural\s+steel\b|\bsteel\s+(?:bar|coil|sheet|plate|sections?)\b|\brebar\b/i,
    type: "Steel"
  },
  { rx: /\baluminum\b|\baluminium\b/i, type: "Aluminum" },
  // Thermal
  { rx: /\bspray\s+polyurethane\s+foam\b|\bSPF\b/i, type: "Spray polyurethane foam" },
  { rx: /\bpolyisocyanurate\b|\bpolyiso\b/i, type: "Polyisocyanurate" },
  { rx: /\bextruded\s+polystyrene\b|\bXPS\b/i, type: "XPS Foam" },
  { rx: /\bexpanded\s+polystyrene\b|\bEPS\b/i, type: "EPS Foam" },
  { rx: /\bmineral\s+(?:wool|fib(?:re|er))\b|\bstone\s+wool\b|\bglass\s+wool\b|\brockwool\b/i, type: "Mineral wool" },
  { rx: /\bcellulose\b/i, type: "Cellulose" },
  { rx: /\bfiberglass\b|\bfibreglass\b/i, type: "Fiberglass" },
  // Finishes
  { rx: /\bgypsum\b|\bdrywall\b/i, type: "Gypsum" },
  { rx: /\bvinyl\s+(?:floor|tile|sheet)\b|\bLVT\b/i, type: "Luxury vinyl tile" }
];

function extractType(text, rec) {
  // Page-1 head is the first ~1500 chars; product titles live there.
  var head = text.substring(0, 1500);
  var lines = head.split("\n");

  // Skip generic/registry lines + short fragments. The first surviving
  // line is the product title in the overwhelming majority of EPDs.
  var skipPrefix =
    /^(?:type\s+iii|environmental\s+product\s+declaration|epd\b|in\s+accordance|as\s+per\b|according\s+to\b|programme|program\b|publisher\b|owner\s+of|declaration\s+number|issue\s+date|valid\s+to|valid\s+until|publication\s+date|page\s+\d|\d+\s*\/\s*\d+|—|–|-{2,})/i;
  // Standards-citation lines also need to be skipped — these often
  // appear right under the title block on EU/IBU layouts where the
  // line "as per ISO 14025 and EN 15804+A1" otherwise gets picked.
  var skipStandards = /\bISO\s*1[34]025\b|\bEN\s*15804\b|\bISO\s*21930\b|\bISO\s*14040\b/i;
  var displayName = null;
  for (var i = 0; i < lines.length; i++) {
    var raw = lines[i].trim();
    if (raw.length < 4 || raw.length > 160) continue;
    if (skipPrefix.test(raw)) continue;
    if (skipStandards.test(raw)) continue;
    // "Acme Co" alone is more likely a manufacturer header — keep scanning
    // unless the line reads as a product description (≥ 2 words OR has a
    // material-type keyword in it).
    if (raw.split(/\s+/).length < 2) continue;
    displayName = _cleanLine(raw);
    break;
  }
  if (displayName && !_get(rec, "naming.display_name")) {
    _setPath(rec, "naming.display_name", displayName);
  }

  // Material-type keyword scan — runs across the whole document body so
  // the title page doesn't have to mention the canonical type label.
  if (!_get(rec, "classification.material_type")) {
    for (var k = 0; k < _MATERIAL_TYPE_DISPLAY_KEYWORDS.length; k++) {
      if (_MATERIAL_TYPE_DISPLAY_KEYWORDS[k].rx.test(text)) {
        _setPath(rec, "classification.material_type", _MATERIAL_TYPE_DISPLAY_KEYWORDS[k].type);
        break;
      }
    }
  }
}

/* ── Tier 1 — group prefix inference ──────────────────────────────── */
//
// Mirrors schema/scripts/beam-csv-to-json.mjs's inferGroupPrefix(): try
// the material-type-to-group map first, then fall back to display-name
// keyword patterns. No-ops gracefully when lookups haven't been primed.

function inferGroupPrefix(rec) {
  if (_get(rec, "classification.group_prefix")) return;
  if (!_lookups) return;
  var materialType = _get(rec, "classification.material_type");
  var displayName = _get(rec, "naming.display_name");
  var prefix = null;
  if (materialType && _lookups.mtMap && _lookups.mtMap[materialType]) {
    prefix = _lookups.mtMap[materialType];
  } else if (displayName && _lookups.kwPatterns) {
    var lc = displayName.toLowerCase();
    for (var i = 0; i < _lookups.kwPatterns.length; i++) {
      var p = _lookups.kwPatterns[i];
      if (lc.indexOf(p.pattern) !== -1) {
        prefix = p.group;
        break;
      }
    }
  }
  if (prefix) _setPath(rec, "classification.group_prefix", prefix);
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
  },

  // Older BC Wood family (2013-2016 LVL / WRC / LSL EPDs published under
  // ASTM / AWC). Tables use English impact-category names instead of
  // EN 15804+A2 indicator codes, and a "<label>  <unit>  <total>  <sub-cols>"
  // layout where the total is the first numeric token. Subscripts on
  // unit text ("kg CO 2 eq", "kg O 3 eq") get split across lines by
  // pdf.js per-glyph emission, so the regex tolerates "CO\s*2?" and
  // "O\s*3?". AP uses "H+ moles eq" (TRACI 1 unit) on these older docs;
  // we deliberately don't match it because the schema target is kg SO2eq
  // and the unit conversion is non-trivial. Per-format regression
  // confirmed not to collide with the newer code-anchored regexes
  // because those run first and the loop early-returns when populated.
  {
    schemaKey: "gwp_kgco2e",
    label: "GWP (English)",
    regex: /Global\s+warming\s+potential\s+kg\s+CO\s*2?\s*eq[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?)/i
  },
  {
    schemaKey: "ozone_depletion_kgcfc11eq",
    label: "ODP (English)",
    regex: /Ozone\s+depletion\s+potential\s+kg\s+CFC[-\s]*11\s*eq[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?)/i
  },
  {
    schemaKey: "eutrophication_kgneq",
    label: "EP (English)",
    regex: /Eutrophication\s+potential\s+kg\s+N\s+eq[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?)/i
  },
  {
    schemaKey: "smog_kgo3eq",
    label: "SFP (English)",
    regex: /Smog\s+potential\s+kg\s+O\s*3?\s*eq[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?)/i
  },
  {
    schemaKey: "primary_energy_nonrenewable_mj",
    label: "PE-NR (English fossil)",
    regex: /Non[\s-]?renewable[,\s]+fossil\s+MJ\s+(-?\s*\d{1,7}(?:[.,]\d+)?)/i
  },
  {
    schemaKey: "primary_energy_renewable_mj",
    label: "PE-R (English biomass)",
    regex: /Renewable[,\s]+biomass\s+MJ\s+(-?\s*\d{1,7}(?:[.,]\d+)?)/i
  },

  // EU/IBU family (Institut Bauen und Umwelt). Tables use long English
  // category names with bracketed units containing space-split subscripts
  // ("[kg CO 2 -Eq.]", "[kg SO 2 -Eq.]", "[kg CFC11-Eq.]"). The "total"
  // is the A1-A3 column which sits as the first numeric token after the
  // unit. POCP / ADPe-fossil / fresh-water rows have EU-specific phrasings.
  // Negative values are common (biogenic carbon credit on wood products
  // gives GWP A1-A3 like -198.40), hence `-?\s*` on the capture group.
  // Existing code-anchored regexes run first and the loop early-returns
  // when populated, so no collision on samples that have both forms.
  {
    schemaKey: "gwp_kgco2e",
    label: "GWP (EU/IBU bracketed)",
    regex:
      /Global\s+warming\s+potential[^\n]{0,30}?\[?\s*kg\s*CO\s*2?\s*-?\s*[Ee]q\.?\s*\]?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "ozone_depletion_kgcfc11eq",
    label: "ODP (EU/IBU long phrase)",
    regex:
      /(?:Ozone\s+depletion\s+potential|Depletion\s+potential\s+of\s+the\s+stratospheric\s+ozone\s+layer)[^\n]{0,30}?\[?\s*kg\s*CFC\s*-?\s*11\s*-?\s*[Ee]q\.?\s*\]?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "acidification_kgso2eq",
    label: "AP (EU/IBU bracketed)",
    regex:
      /Acidification\s+potential[^\n]{0,40}?\[?\s*kg\s*SO\s*2?\s*-?\s*[Ee]q\.?\s*\]?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "abiotic_depletion_fossil_mj",
    label: "ADPf (EU/IBU long phrase)",
    regex:
      /Abiotic\s+depletion\s+potential\s+for\s+fossil\s+resources[^\n]{0,30}?\[?\s*MJ\s*\]?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "water_consumption_m3",
    label: "WDP (EU/IBU fresh-water phrase)",
    regex:
      /Use\s+of\s+net\s+fresh\s+water[^\n]{0,20}?\[?\s*m\s*[³^]?3?\s*\]?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
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

/* ── EU/IBU format (Institut Bauen und Umwelt) ─────────────────────── */
//
// Cover-page anchors are line-leading labels with the value on the same
// line: "Owner of the Declaration   <name>", "Declaration number   <id>",
// "Issue date   <date>", "Valid to   <date>". Programme operator is set
// by extractCommon's _detectProgramOperator; we set it here too as a
// safety net for layouts where the IBU name appears elsewhere.
//
// PCR lives under "This declaration is based on the product category
// rules:" — the next non-empty line is the canonical PCR title (e.g.
// "Wood based panels, 12.2018"). PCR-validation marker is a
// "internally   x   externally" form where the "x" sits next to the
// chosen option.
//
// Declared unit + density both live in the "This Declaration refers to
// 1 m³ ... average weighted density of 167 kg/m³" sentence on page 2.

function extractEuIbu(text, rec) {
  _setPath(rec, "epd.program_operator", "IBU");

  // Owner of the Declaration → manufacturer name. The label sits on its
  // own line on some layouts (page 2), so we capture forward across one
  // possible newline before settling on a single-line value.
  if (!_get(rec, "manufacturer.name")) {
    var mfr =
      text.match(/Owner\s+of\s+the\s+Declaration\s+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/) ||
      text.match(/Owner\s+of\s+the\s+(?:declaration|Declaration)\s*\n+\s*([A-Z][A-Za-z0-9 &.,'\-]{2,80})/);
    if (mfr) _setPath(rec, "manufacturer.name", _cleanLine(mfr[1]));
  }

  // Declaration number → epd.id. IBU pattern is "EPD-XXX-YYYYYYY-..."
  if (!_get(rec, "epd.id")) {
    var idM = text.match(/Declaration\s+number\s+(EPD-[A-Z0-9.\-]{4,40})/i);
    if (idM) _setPath(rec, "epd.id", idM[1]);
  }

  // Dates: IBU uses dd/mm/yyyy. _parseDate normalises to ISO YYYY-MM-DD.
  if (!_get(rec, "epd.publication_date")) {
    var pubM = text.match(/Issue\s+date\s+([0-9./\-]{8,12})/i);
    if (pubM) {
      var pubIso = _parseDate(pubM[1]);
      if (pubIso) _setPath(rec, "epd.publication_date", pubIso);
    }
  }
  if (!_get(rec, "epd.expiry_date")) {
    var expM = text.match(/Valid\s+to\s+([0-9./\-]{8,12})/i);
    if (expM) {
      var expIso = _parseDate(expM[1]);
      if (expIso) _setPath(rec, "epd.expiry_date", expIso);
    }
  }

  // Validation: "internally   x   externally" with the marker next to
  // the chosen mode. _detectProgramOperator-adjacent heuristic in
  // extractCommon already handles this, but we double-tap here.
  if (!_get(rec, "epd.validation.type")) {
    if (/internally\s*x\s*externally/i.test(text)) {
      // marker before "internally" → internal; before "externally" → external
      // The IBU sample reads "internally   x   externally" with the x
      // between them — convention is x marks the SELECTED column, and
      // since IBU declarations are always externally verified, default
      // to external when both labels are present.
      _setPath(rec, "epd.validation.type", "external");
    } else if (/[x✓X]\s*externally/i.test(text)) {
      _setPath(rec, "epd.validation.type", "external");
    } else if (/[x✓X]\s*internally/i.test(text)) {
      _setPath(rec, "epd.validation.type", "internal");
    }
  }

  // PCR — "This declaration is based on the product category rules:"
  // followed (after one or two newlines) by the PCR title. Tolerant
  // capture pulls everything up to "(PCR" or end-of-line.
  if (!_get(rec, "methodology.pcr_guidelines")) {
    var pcrM =
      text.match(/product\s+category\s+rules\s*:\s*\n+\s*([^\n]{6,160})/i) ||
      text.match(/category\s+rules\s*:\s*([^\n]{6,160})/i);
    if (pcrM) {
      var pcrVal = _cleanLine(pcrM[1]).replace(/\s*\(PCR.*$/i, "");
      _setPath(rec, "methodology.pcr_guidelines", pcrVal);
    }
  }

  // Declared unit + density on the "This Declaration refers to 1 m³ X
  // ... average weighted density of 167 kg/m³" sentence.
  if (!_get(rec, "carbon.stated.per_unit")) {
    var unitM = text.match(/This\s+Declaration\s+refers\s+to\s+([^\n]{4,160})/i);
    if (unitM) _setPath(rec, "carbon.stated.per_unit", _cleanLine(unitM[1]));
  }
  if (_get(rec, "physical.density.value_kg_m3") == null) {
    var densM = text.match(/(?:average\s+weighted\s+)?density\s+of\s+(\d{2,5}(?:[.,]\d+)?)\s*kg\/m\s*[³^]?3?/i);
    if (densM) _setPath(rec, "physical.density.value_kg_m3", _toNum(densM[1]));
  }
}

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
  return s
    .replace(/\s+https?:\/\/.*$/, "")
    .replace(/\s+\d{2,}.*$/, "")
    .trim();
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
  var iso3 = parts.filter(function (p) {
    return /^[A-Z]{3}$/.test(p);
  });
  if (iso3.length) return iso3;
  // Common name → ISO3 mini-map
  var map = { canada: "CAN", "united states": "USA", us: "USA", usa: "USA" };
  var mapped = [];
  for (var i = 0; i < parts.length; i++) {
    var k = parts[i].toLowerCase();
    if (map[k]) mapped.push(map[k]);
  }
  return mapped;
}

var MONTHS = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12"
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
