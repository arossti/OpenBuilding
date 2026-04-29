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

// Per-glyph fragmentation tolerance for the canonical S-P-XXXXX id.
// The EPD-IES filename variant of S-P-10278 emits the label as
// "S - P - 10278" (each glyph as its own text item with spaces between),
// which the strict /S-P-\d/ pattern misses. The tolerant form matches
// either spelling and is reused everywhere we look for an S-P id.
var _SP_ID_RX = /S\s*-\s*P\s*-\s*(\d{5,6})/;

export function detectFormat(text) {
  // Priority order matters — narrowest match first to avoid false positives.
  // EPD International registry is most specific (S-P-XXXXX is canonical).
  if (_SP_ID_RX.test(text) && /Programme\s+operator/i.test(text)) return FORMATS.EPD_INTL;

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
  // Override display_name with `${groupLabel} | ${materialType}` once Tier 1
  // settles. Cover-page picker output is preserved on samples where group +
  // type can't both be inferred (no regression on unknown-format docs).
  deriveDisplayName(rec);

  // Tiers 3–7 — per-format extractor handles manufacturer / provenance /
  // identification / per-family methodology / physical anchors.
  if (format === FORMATS.EPD_INTL) extractEpdIntl(allText, rec);
  else if (format === FORMATS.NA) extractNA(allText, rec);
  else if (format === FORMATS.NSF) extractNSF(allText, rec);
  else if (format === FORMATS.EU_IBU) extractEuIbu(allText, rec);
  // UNKNOWN: fall through to common-only.

  // Tiers 6 + 8 — cross-format methodology + impact totals.
  extractCommon(allText, rec);

  // Tier 9 — fallback fill from db-fallbacks.json for fields the EPD
  // didn't publish. Only runs if the lookups were primed AND the
  // candidate already has a classification.material_type. Source-marks
  // every filled value as "generic_default" so the form pane can
  // distinguish EPD-derived from catalogue-derived.
  applyMaterialDefaults(rec);

  return { format: format, record: rec, anchorsHit: _countAnchors(rec) };
}

/* ── Tier 9 — fallback fill from db-fallbacks ─────────────────────── */
//
// The EPD wins where it published a value. This step only fills slots
// that the per-format extractors left null. v1 only fills
// physical.density.value_kg_m3 (the only catalogue field that maps to
// an existing schema slot today). Thermal conductivity, heat capacity,
// embodied energy, and embodied carbon stay in the catalogue ready for
// future schema extension; this function is the place to wire them
// when those slots get added.
//
// Source-marking convention: when this function fills a value, it also
// writes `<path>.source = "generic_default"` next to the value. Other
// possible source values: "epd_direct" (existing extractors should set
// this; retrofit pending), "calculated" (Tier 10, future BEAM math),
// "user_edit" (form bindings flip this when the user types).

function applyMaterialDefaults(rec) {
  if (!_lookups || !_lookups.materialDefaults) return;
  var materialType = _get(rec, "classification.material_type");
  if (!materialType) return;

  var defaults = _lookups.materialDefaults.defaults_by_material_type;
  var aliases = _lookups.materialDefaults.aliases || {};
  // Resolve via alias table when the material_type doesn't key directly.
  // Glulam / CLT / LVL / Engineered wood etc. all alias to "Wood".
  var key = defaults && defaults[materialType] ? materialType : aliases[materialType];
  var entry = key && defaults ? defaults[key] : null;
  if (!entry || !entry.default) return;
  var d = entry.default;

  // physical.density — the only catalogue field with a current schema slot.
  if (_get(rec, "physical.density.value_kg_m3") == null && d.density_kg_m3 != null) {
    _setPath(rec, "physical.density.value_kg_m3", d.density_kg_m3);
    _setPath(rec, "physical.density.source", "generic_default");
  }
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
  // Per-glyph drop-cap fragments ("E nvironmental", "P roduct",
  // "D eclaration") need explicit alternations because pdf.js often
  // splits "Environmental Product Declaration" cover-page headers into
  // three separate one-letter-then-rest lines, each of which would
  // otherwise pass the picker as a 2-word title candidate.
  var skipPrefix =
    /^(?:type\s+iii|e\s*nvironmental(?:\s+p\s*roduct\s+d\s*eclaration)?|p\s*roduct\s*$|d\s*eclaration\s*$|environmental\s+product\s+declaration|epd\b|in\s+accordance|as\s+per\b|according\s+to\b|programme|program\b|publisher\b|owner\s+of|declaration\s+number|issue\s+date|valid\s+to|valid\s+until|publication\s+date|page\s+\d|\d+\s*\/\s*\d+|—|–|-{2,})/i;
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

  // Material-type keyword scan — prefer matches in the cover-page title
  // (display_name) first, since titles say what the EPD is about; the
  // body often references related materials in comparison text (e.g. a
  // Glulam EPD's intro comparing to CLT). Without this, first-match-wins
  // against the body would mis-label GLT as "Engineered wood" because
  // CLT happens to come first in the keyword list. Fall through to the
  // full body when no title keyword hits, preserving today's behavior
  // for samples with generic / non-product cover-page lines.
  if (!_get(rec, "classification.material_type")) {
    var titleMatched = false;
    if (displayName) {
      for (var k = 0; k < _MATERIAL_TYPE_DISPLAY_KEYWORDS.length; k++) {
        if (_MATERIAL_TYPE_DISPLAY_KEYWORDS[k].rx.test(displayName)) {
          _setPath(rec, "classification.material_type", _MATERIAL_TYPE_DISPLAY_KEYWORDS[k].type);
          titleMatched = true;
          break;
        }
      }
    }
    if (!titleMatched) {
      for (var b = 0; b < _MATERIAL_TYPE_DISPLAY_KEYWORDS.length; b++) {
        if (_MATERIAL_TYPE_DISPLAY_KEYWORDS[b].rx.test(text)) {
          _setPath(rec, "classification.material_type", _MATERIAL_TYPE_DISPLAY_KEYWORDS[b].type);
          break;
        }
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

/* ── Display name derivation — taxonomy-driven ────────────────────── */
//
// Cover-page picker (extractType) often grabs boilerplate ("Environmental
// Product Declaration", per-glyph "E nvironmental") because EPD title
// blocks are inconsistent. Once Tier 1 settles a group_prefix and Tier 2
// settles a material_type, we have enough structured info to compose a
// clean display name like "Wood | Glulam" or "Concrete | Portland Cement".
//
// Override only fires when both inputs are present AND material-groups
// lookup is primed; otherwise the cover-page output is left in place so
// unknown-format samples don't regress on coverage.

function deriveDisplayName(rec) {
  if (!_lookups || !_lookups.materialGroups) return;
  var prefix = _get(rec, "classification.group_prefix");
  var materialType = _get(rec, "classification.material_type");
  if (!prefix || !materialType) return;
  var groups = _lookups.materialGroups.groups || _lookups.materialGroups;
  var entry = groups && groups[prefix];
  var label = entry && entry.label;
  if (!label) return;
  _setPath(rec, "naming.display_name", label + " | " + materialType);
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

// Per-glyph fragmentation tolerance for ISO dates. The EPD-IES filename
// variant emits dates as "202 5 - 10 - 2 0" — every digit gets its own
// text item. Pre-process by removing whitespace between adjacent digits
// (so "202 5" → "2025"), then run a loose YYYY-MM-DD match. Falls back
// to null if the window doesn't contain a date-shaped sequence.
function _looseIsoDateAfter(text, labelPattern) {
  var m = labelPattern.exec(text);
  if (!m) return null;
  var window = text.substring(m.index + m[0].length, m.index + m[0].length + 60);
  // Collapse any whitespace between digits so "202 5" → "2025" and
  // "2 0" → "20". Repeat once because /(\d)\s+(\d)/g only collapses one
  // pair per overlap on the first pass.
  var collapsed = window;
  for (var pass = 0; pass < 4; pass++) {
    var next = collapsed.replace(/(\d)\s+(\d)/g, "$1$2");
    if (next === collapsed) break;
    collapsed = next;
  }
  // Also collapse spaces around the dashes inside dates ("2025 - 10 - 20").
  collapsed = collapsed.replace(/(\d)\s*-\s*(\d)/g, "$1-$2");
  var iso = collapsed.match(/(\d{4}-\d{1,2}-\d{1,2})/);
  if (!iso) return null;
  var parts = iso[1].split("-");
  return parts[0] + "-" + _pad2(parts[1]) + "-" + _pad2(parts[2]);
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
  // Tolerant match (_SP_ID_RX) for the EPD-IES filename variant where
  // per-glyph emission lands the label as "S - P - 10278".
  if (!_get(rec, "epd.id")) {
    var spMatch = text.match(_SP_ID_RX);
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

  // P3.3 — per-stage breakdown. Detects the stage-header column sequence
  // (cradle-to-gate "A1-A3 A1 A2 A3" or cradle-to-grave "A1-A3 A1 A2 A3
  // A4 A5 B1..D"), finds each indicator row by long-form English label,
  // tokenises numeric values, and maps them into impacts.<key>.by_stage.
  // Independent of total extraction — a row whose total is captured but
  // whose by_stage cells are unfilled is a partial pass, not a regression.
  _extractByStage(text, rec);
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
    // Tolerates optional "– Total" / "- Total" em-dash/hyphen subtitle
    // (Kalesnikoff format) and excludes Fossil/Biogenic rows via
    // negative lookahead so they don't match the gwp_kgco2e (total) slot.
    // q optional because Kalesnikoff uses "kg CO2e" without `q`.
    regex:
      /Global\s+warming\s+potential(?!\s*[–—-]\s*(?:Fossil|Biogenic))(?:\s*[–—-]\s*Total)?\s+kg\s+CO\s*2?\s*[Ee]q?\.?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "gwp_bio_kgco2e",
    label: "GWP-Biogenic (English em-dash)",
    // Kalesnikoff biogenic-row variant. Total = 0 by construction
    // (sequestration A1 + emission A3 net to zero) but capturing the
    // total preserves intent. Per-stage A1 = -1045.63 lands in P3.3.
    regex:
      /Global\s+warming\s+potential\s*[–—-]\s*Bio(?:genic)?\s+kg\s+CO\s*2?\s*[Ee]q?\.?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "ozone_depletion_kgcfc11eq",
    label: "ODP (English)",
    regex: /Ozone\s+depletion\s+potential\s+kg\s+CFC[-\s]*11\s*[Ee]q?\.?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "ozone_depletion_kgcfc11eq",
    label: "ODP (English label-only — wrapped unit)",
    // Kalesnikoff format puts the "kg" / "CFC11e" unit fragments on
    // separate text-extraction lines from the data row. Drop the
    // unit-cell anchor; capture the next sci-not number after the
    // label. Schema slot name encodes the unit, so no semantic loss.
    // [\s\S] used (not [^\n]) so the regex can cross the wrapped-unit
    // line. Window capped at 200 chars to avoid grabbing values from
    // a different indicator's row.
    regex:
      /Depletion\s+potential\s+of\s+the\s+stratospheric\s+ozone\s+layer[\s\S]{0,200}?(\d+(?:\.\d+)?[Ee][-+]?\d+)/i
  },
  {
    schemaKey: "eutrophication_kgneq",
    label: "EP (English)",
    // \s* between N and Eq tolerates Kalesnikoff "kg Ne" (no space
    // between N and e) AND older "kg N eq" (single space).
    regex: /Eutrophication\s+potential\s+kg\s+N\s*[Ee]q?\.?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "water_consumption_m3",
    label: "WDP (English Consumption of freshwater)",
    // Kalesnikoff "Consumption of freshwater resources m3 0.37".
    regex:
      /Consumption\s+of\s+(?:freshwater|fresh\s+water)\s+resources\s+m\s*[³^]?3?\s+(-?\s*\d{1,5}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "acidification_kgso2eq",
    label: "AP (English long phrase)",
    // Kalesnikoff "Acidification potential of soil and water sources".
    regex:
      /Acidification\s+potential(?:\s+of\s+soil\s+and\s+water\s+sources)?\s+kg\s+SO\s*2?\s*[Ee]q?\.?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "smog_kgo3eq",
    label: "SFP (English Smog potential)",
    regex: /Smog\s+potential\s+kg\s+O\s*3?\s*[Ee]q?\.?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "smog_kgo3eq",
    label: "SFP (English Formation potential)",
    // Kalesnikoff "Formation potential of tropospheric ozone".
    regex:
      /Formation\s+potential\s+of\s+tropospheric\s+ozone\s+kg\s+O\s*3?\s*[Ee]q?\.?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "abiotic_depletion_fossil_mj",
    label: "ADPf (English parenthetical)",
    // Kalesnikoff "Abiotic depletion potential (ADPfossil) MJ, NCV".
    regex:
      /Abiotic\s+depletion\s+potential\s*\(\s*ADP[\s_]?fossil\s*\)\s+MJ[^\n]{0,12}?\s+(-?\s*\d{1,7}(?:[.,]\d+)?)/i
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
      /Global\s+warming\s+potential[^\n]{0,30}?\[?\s*kg\s*CO\s*2?\s*-?\s*[Ee]q?\.?\s*\]?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "ozone_depletion_kgcfc11eq",
    label: "ODP (EU/IBU long phrase)",
    regex:
      /(?:Ozone\s+depletion\s+potential|Depletion\s+potential\s+of\s+the\s+stratospheric\s+ozone\s+layer)[^\n]{0,30}?\[?\s*kg\s*CFC\s*-?\s*11\s*-?\s*[Ee]q?\.?\s*\]?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
  },
  {
    schemaKey: "acidification_kgso2eq",
    label: "AP (EU/IBU bracketed)",
    regex:
      /Acidification\s+potential[^\n]{0,40}?\[?\s*kg\s*SO\s*2?\s*-?\s*[Ee]q?\.?\s*\]?[^\n]*?\s+(-?\s*\d{1,7}(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/i
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
  },

  // Modern NA / ISO 21930 family. Wood + steel EPDs that follow the
  // ACLCA / ISO 21930:2017 indicator convention use abbreviation codes
  // RPR E (renewable primary energy as energy carrier), NRPR E
  // (non-renewable primary energy as energy carrier), and FW (fresh
  // water) — typically with comma-thousand-separated values like
  // "3,490.16" and the unit on the same line ("[MJ, LHV]" or "[m 3 ]").
  // FW often has its value on the NEXT line in the spatially-joined
  // text because pdf.js per-glyph emission splits unit + value;
  // \s+ tolerance handles that. Number capture allows comma-thousand
  // groups; the parser strips them.
  {
    schemaKey: "primary_energy_renewable_mj",
    label: "PE-R (RPR E / ISO 21930)",
    regex:
      /\bRPR\s*[Ee]\b[^\n]{0,30}?\[?\s*MJ\b[^\n]{0,16}?\s+(-?\s*\d{1,3}(?:,\d{3})*(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/
  },
  {
    schemaKey: "primary_energy_nonrenewable_mj",
    label: "PE-NR (NRPR E / ISO 21930)",
    regex:
      /\bNRPR\s*[Ee]\b[^\n]{0,30}?\[?\s*MJ\b[^\n]{0,16}?\s+(-?\s*\d{1,3}(?:,\d{3})*(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/
  },
  {
    schemaKey: "water_consumption_m3",
    label: "WDP (FW / ISO 21930)",
    regex: /\bFW\b\s*\[?\s*m\s*[³^]?3?\s*\]?\s+(-?\s*\d{1,3}(?:,\d{3})*(?:[.,]\d+)?(?:E\s*[-+]?\s*\d+)?)/
  }
];

function _extractIndicatorTotals(text, rec) {
  for (var i = 0; i < IMPACT_INDICATORS.length; i++) {
    var ind = IMPACT_INDICATORS[i];
    if (_get(rec, "impacts." + ind.schemaKey + ".total.value") != null) continue;
    var m = text.match(ind.regex);
    if (!m) continue;
    var raw = m[1].replace(/\s+/g, "");
    // Number parsing handles three conventions:
    //   "3,490.16"  US/CA — comma is thousand-separator → strip
    //   "3.490,16"  EU      — period is thousand-separator → unsupported here
    //   "3,50"      EU      — comma is decimal → replace with period
    //   "3338.45"   US/CA   — no separator → as-is
    //   "1.23E+03"  scientific → as-is (E was lowercased? no, regex is case-insensitive)
    var num;
    if (raw.indexOf(".") >= 0 && raw.indexOf(",") >= 0) {
      // Both present — comma is thousand-separator (US/CA wood + steel EPDs)
      num = parseFloat(raw.replace(/,/g, ""));
    } else {
      // Only one or neither — single comma → decimal
      num = parseFloat(raw.replace(",", "."));
    }
    if (isNaN(num)) continue;
    _setPath(rec, "impacts." + ind.schemaKey + ".total.value", num);
    _setPath(rec, "impacts." + ind.schemaKey + ".total.source", "epd_direct");
  }
}

/* ── P3.3 — per-stage breakdown ────────────────────────────────────── */
//
// Detects the stage-header column sequence in the impact table (typically
// "Unit | A1-A3 | A1 | A2 | A3" for cradle-to-gate or the full
// "A1-A3 | A1..A3 | A4 | A5 | B1..B7 | C1..C4 | D" for cradle-to-grave),
// then for each indicator row finds the line, tokenises numeric values
// (filtering out subscript digits like the `2` in `kg CO2e`), and maps
// them positionally into impacts.<key>.by_stage.<stage>.{value, source}.
//
// Independent of total extraction (Tier 8). A row whose total is captured
// but whose by_stage cells are unfilled is a partial pass. The schema's
// by_stage stages are A1 / A2 / A3 / A4 / A5 / B1..B7 / C1..C4 / D —
// 17 individual stages, NOT including A1-A3 (that's the total slot).

// Long-form English label patterns per indicator schema key. These are
// the labels EPDs actually use in tabular impact rows; reuses the same
// vocabulary as the IMPACT_INDICATORS regexes for English forms but
// strips the unit + value parts so the regex matches the row prefix.
var _BYSTAGE_LABELS = [
  // GWP fossil/total — guards against matching the Fossil/Biogenic
  // sub-rows by negative lookahead, same pattern as fix #5.
  {
    rx: /Global\s+warming\s+potential(?!\s*[–—-]\s*(?:Fossil|Biogenic))(?:\s*[–—-]\s*Total)?\b/i,
    key: "gwp_kgco2e"
  },
  {
    rx: /Global\s+warming\s+potential\s*[–—-]\s*Bio(?:genic)?\b/i,
    key: "gwp_bio_kgco2e"
  },
  {
    rx: /(?:Depletion\s+potential\s+of\s+the\s+stratospheric\s+ozone\s+layer|Ozone\s+depletion\s+potential)\b/i,
    key: "ozone_depletion_kgcfc11eq"
  },
  {
    rx: /Acidification\s+potential(?:\s+of\s+soil\s+and\s+water\s+sources)?\b/i,
    key: "acidification_kgso2eq"
  },
  { rx: /Eutrophication\s+potential\b/i, key: "eutrophication_kgneq" },
  {
    rx: /(?:Formation\s+potential\s+of\s+tropospheric\s+ozone|Smog\s+potential|Photochemical\s+ozone\s+formation)\b/i,
    key: "smog_kgo3eq"
  },
  {
    // No trailing \b — first alternative ends with ")" which is a
    // non-word char, so \b at that position would never match.
    rx: /Abiotic\s+depletion\s+potential\s*(?:\(\s*ADP[\s_]?fossil\s*\)|for\s+fossil\s+resources\b)/i,
    key: "abiotic_depletion_fossil_mj"
  },
  {
    rx: /(?:Consumption\s+of\s+(?:freshwater|fresh\s+water)\s+resources|Use\s+of\s+net\s+fresh\s+water)\b/i,
    key: "water_consumption_m3"
  },
  {
    rx: /Non[\s-]?renewable\s+primary\s+energy\s+used\s+as\s+energy\b/i,
    key: "primary_energy_nonrenewable_mj"
  },
  {
    rx: /Renewable\s+primary\s+energy\s+used\s+as\s+energy\b/i,
    key: "primary_energy_renewable_mj"
  }
];

// Stage-header detector. Returns ALL candidate header lines (any line
// with ≥3 stage codes), with their line indices. The per-row extractor
// then picks the nearest preceding header for each indicator row,
// preferring one whose stage-count matches the row's value-count. This
// distinguishes Table 3 (main impacts, 4 cols "A1-A3 A1 A2 A3") from
// Table 2 (biogenic inventory, 6 cols "A1 A2 A3 A5 C3 C4") AND from
// the generic life-cycle-stages list ("A1 A2 A3 A4 A5 B1..D") that
// appears earlier in the methodology section but isn't a column
// header.
function _detectStageHeaders(text) {
  var lines = text.split("\n");
  var stageRx = /\b(?:A1\s*[–—-]?\s*A3|A[1-5]|B[1-7]|C[1-4]|D)\b/g;
  var headers = [];
  for (var i = 0; i < lines.length; i++) {
    var matches = lines[i].match(stageRx);
    if (!matches || matches.length < 3) continue;
    var cleaned = [];
    for (var j = 0; j < matches.length; j++) {
      var s = matches[j].replace(/\s+/g, "").toUpperCase();
      if (s === "A1A3") s = "A1-A3";
      cleaned.push(s);
    }
    headers.push({ lineIdx: i, stages: cleaned });
  }
  return headers;
}

// Number-token tokeniser that rejects single-digit integers (likely
// subscripts like the 2 in CO2 or the 3 in O3). Accepts:
//   - decimal-bearing values: 124.50, -1045.63, 0.93, 0.07
//   - scientific notation:    2.27E-06
//   - 3+ digit integers:      1230, 18200
//   - thousand-comma values:  3,490.16
// Reject:
//   - bare 1-2 digit integers: 2, 11, 96 (subscripts and column widths)
function _tokenizeImpactNumbers(line) {
  var rx = /-?\d+\.\d+(?:[eE][-+]?\d+)?|-?\d{3,}(?:,\d{3})*(?:\.\d+)?(?:[eE][-+]?\d+)?|-?\d+[eE][-+]?\d+/g;
  var out = [];
  var m;
  while ((m = rx.exec(line)) !== null) {
    var raw = m[0];
    var n;
    if (raw.indexOf(".") >= 0 && raw.indexOf(",") >= 0) n = parseFloat(raw.replace(/,/g, ""));
    else n = parseFloat(raw.replace(",", "."));
    if (!isNaN(n)) out.push(n);
  }
  return out;
}

function _extractByStage(text, rec) {
  var headers = _detectStageHeaders(text);
  if (headers.length === 0) return;
  var lines = text.split("\n");
  // Build a quick index of header line numbers so we can skip the
  // header rows themselves when scanning for indicator rows.
  var headerLineSet = {};
  for (var h = 0; h < headers.length; h++) headerLineSet[headers[h].lineIdx] = true;

  for (var i = 0; i < lines.length; i++) {
    if (headerLineSet[i]) continue;
    var line = lines[i];
    for (var j = 0; j < _BYSTAGE_LABELS.length; j++) {
      var lm = _BYSTAGE_LABELS[j];
      if (!lm.rx.test(line)) continue;
      var nums = _tokenizeImpactNumbers(line);
      if (nums.length === 0) break;

      // Pick the nearest preceding header. Prefer a header whose
      // stage-count matches the row's value-count exactly (best signal
      // it's the right table for this row); fall back to the most
      // recent preceding header otherwise. This handles the Kalesnikoff
      // case where a generic 17-stage life-cycle list appears in the
      // methodology section (line ~126) but the actual Table 3 header
      // (line ~260) sits much closer to the data rows.
      var stages = null;
      for (var p = headers.length - 1; p >= 0; p--) {
        if (headers[p].lineIdx > i) continue;
        if (headers[p].stages.length === nums.length) {
          stages = headers[p].stages;
          break;
        }
      }
      if (!stages) {
        for (var q = headers.length - 1; q >= 0; q--) {
          if (headers[q].lineIdx > i) continue;
          stages = headers[q].stages;
          break;
        }
      }
      if (!stages) break;

      // Map numbers to stages by position. "A1-A3" is the total slot
      // (already populated by Tier 8) — skip; the rest map to individual
      // by_stage entries. Stages with no positional value stay null.
      for (var k = 0; k < stages.length && k < nums.length; k++) {
        var st = stages[k];
        if (st === "A1-A3") continue;
        if (_get(rec, "impacts." + lm.key + ".by_stage." + st + ".value") != null) continue;
        _setPath(rec, "impacts." + lm.key + ".by_stage." + st + ".value", nums[k]);
        _setPath(rec, "impacts." + lm.key + ".by_stage." + st + ".source", "epd_direct");
      }
      break; // line matched one indicator; don't try the rest
    }
  }
}

/* ── NA family: UL Environment / ASTM / CSA Group ──────────────────── */

function extractNA(text, rec) {
  // Manufacturer / Declaration Holder.
  // NB on Kalesnikoff: their "Declaration Owner" cell uses a multi-line
  // value (Co. / street / city / tagline) with the label visually
  // y-centered between rows. After spatial join, the label ends up
  // BETWEEN value rows, so any label-then-value regex against this
  // layout captures the city/postal line instead of the company name.
  // The "produced (?:by|at)" prose fallback below handles this case.
  var mfr =
    text.match(/D\s*ECLARATION\s+H\s*OLDER\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/) ||
    text.match(/Manufacturer\s+name(?:\s+and\s+address)?\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/) ||
    text.match(/EPD\s+Commissioner\s+(?:and\s+)?Owner\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/i) ||
    text.match(/Declaration\s+holder\s*[:\s]+([A-Z][A-Za-z0-9 &.,'\-]{2,80})/i);
  if (mfr) _setPath(rec, "manufacturer.name", _cleanLine(mfr[1]));

  // Title-prose fallback for layouts where spatial join breaks the
  // label-then-value relationship. Cover-page titles commonly read
  // "EPD for X produced by/at <CompanyName>", and the company name is
  // followed by lowercase words ("in", "for", "'s facility") which the
  // capital-letter chain naturally stops on.
  if (!_get(rec, "manufacturer.name")) {
    var prodBy = text.match(/produced\s+(?:by|at)\s+([A-Z][A-Za-z]+(?:'\w+)?(?:\s+[A-Z][A-Za-z]+){0,2})/);
    if (prodBy) _setPath(rec, "manufacturer.name", _cleanLine(prodBy[1]));
  }

  // EPD ID / Declaration Number — allow embedded spaces in the value
  // (e.g. "EPD 395") and per-glyph drop-cap split on the label.
  // Post-process strips trailing label-like content that pdf.js may
  // have joined into the same line (e.g. "EPD 296 Declared Product
  // Glulam 3" → "EPD 296"). EPD IDs are 1-2 tokens of alphanumeric +
  // dashes/dots; anything after a known next-label word is column-bleed.
  var epdId =
    text.match(/D\s*eclaration\s+N\s*umber\s*[#:\s]+([A-Z][A-Z0-9.\-#\s]{2,38}\d[A-Z0-9.\-#]{0,10})/i) ||
    text.match(/EPD\s+(?:Registration\s+)?Number\s*[#:\s]+([A-Z0-9][A-Z0-9.\-#\s]{2,38}\d[A-Z0-9.\-#]{0,10})/i);
  if (epdId) {
    var idRaw = epdId[1].split(
      /\s+(?=(?:Declared|Date|Period|Unit|Owner|Holder|Type|Scope|Reference|Markets|Description|Year|EPD\s+Type|EPD\s+Scope|Programme|Program|Issue|Valid|Publisher))/i
    )[0];
    _setPath(rec, "epd.id", idRaw.replace(/^#/, "").replace(/\s+/g, " ").trim());
  }

  // Program operator — detect by known name (more robust than label-anchored
  // for tabular layouts where "Program Operator" appears on its own line).
  var po = _detectProgramOperator(text);
  if (po) _setPath(rec, "epd.program_operator", po);

  // Declared / functional unit + density (often on the same line)
  var unit =
    text.match(/(?:DECLARED|FUNCTIONAL)\s+(?:PRODUCT\s*&\s*)?UNIT\s*[:\s]+([^\n\r]{6,200})/i) ||
    text.match(/Declared\s+unit\s*[:\s]+([^\n\r]{6,200})/i);
  if (unit) {
    var rawUnitLine = _cleanLine(unit[1]);
    // Normalise to "<number> <unit>" — strip descriptive prose ("of glulam
    // produced at..."). Use full doc context to disambiguate "1 m" (pdf.js
    // strips superscripts on some EPDs) → "1 m³" / "1 m²" by scanning for
    // the same unit elsewhere in the doc.
    var cleanUnit = _normalizeDeclaredUnit(rawUnitLine, text);
    _setPath(rec, "carbon.stated.per_unit", cleanUnit || rawUnitLine);
    // Plumb the cleaned unit into impacts.functional_unit so the
    // database viewer's index entry surfaces it (Database.md
    // _indexEntryFromRecord reads impacts.functional_unit first).
    if (cleanUnit) _setPath(rec, "impacts.functional_unit", cleanUnit);
    var dInLine = unit[1].match(/(\d{2,5}(?:[.,]\d+)?)\s*kg\/m\s*[³^]?3?/);
    if (dInLine) _setPath(rec, "physical.density.value_kg_m3", _toNum(dInLine[1]));
  }
  if (_get(rec, "physical.density.value_kg_m3") == null) {
    var d = text.match(/density\s*(?:of\s+)?(\d{2,5}(?:[.,]\d+)?)\s*kg\/m\s*[³^]?3?/i);
    if (d) _setPath(rec, "physical.density.value_kg_m3", _toNum(d[1]));
  }
  // Wood EPD product-properties table form: "Mass (including moisture)
  // kg <N>" where <N> is mass per the declared unit. For declared unit
  // = 1 m³ (the dominant solid-wood case), N kg per m³ = density.
  // Skip "Oven Dry Mass" — special-case for biogenic-carbon math, not
  // the construction-as-installed density practitioners need. Only
  // fires when no density extracted yet, so the existing direct-density
  // patterns still win where present.
  if (_get(rec, "physical.density.value_kg_m3") == null) {
    var massPerUnit = text.match(/Mass\s*\(\s*including\s+moisture\s*\)\s+kg\s+(\d{2,5}(?:[.,]\d+)?)/i);
    if (massPerUnit) _setPath(rec, "physical.density.value_kg_m3", _toNum(massPerUnit[1]));
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
  // S-P-XXXXX is the canonical ID; tolerant match handles the EPD-IES
  // filename variant where per-glyph emission produces "S - P - 10278".
  var sp = text.match(_SP_ID_RX);
  if (sp) _setPath(rec, "epd.id", "S-P-" + sp[1]);

  _setPath(rec, "epd.program_operator", "EPD International AB");

  // Dates in ISO format. The EPD-IES variant per-glyph-fragments the
  // date itself ("202 5 - 10 - 2 0"), so we capture a 60-char window
  // after each label, collapse digit-space-digit pairs, then run a
  // loose date pattern. Falls back to the strict pattern for the
  // typical EPD International layout.
  if (!_get(rec, "epd.publication_date")) {
    var pubLoose = _looseIsoDateAfter(text, /Publication\s+date\s*:?/i);
    if (pubLoose) _setPath(rec, "epd.publication_date", pubLoose);
  }
  if (!_get(rec, "epd.expiry_date")) {
    var expLoose = _looseIsoDateAfter(text, /Valid\s+until\s*:?/i);
    if (expLoose) _setPath(rec, "epd.expiry_date", expLoose);
  }

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

// Normalise a declared-unit phrase to a short canonical token like
// "1 m³", "1 m²", "1 metric ton", or "1 kg". Drops descriptive prose
// ("1 m of glulam produced at Kalesnikoff's facility..." → "1 m³").
//
// pdf.js strips superscripts on some EPDs, so "1 m" with no ³/² is
// ambiguous between cubic and square meters. Disambiguate by scanning
// the full doc for "m3" / "m^3" / "m³" or "m2" / "m^2" / "m²" patterns
// that appear near declared-unit context (Table captions, density
// expressions). Falls back to "1 m" when neither pattern is found.
//
// Returns null if the input has no leading "<number> <unit>" token to
// extract — caller should keep the raw value in that case.
function _normalizeDeclaredUnit(raw, fullText) {
  if (!raw) return null;
  // Match leading "<number> <unit>" — accept m / m² / m³ / metric ton /
  // tonne / kg / kilogram / liter / litre. \b after the unit token so
  // "metric tons" matches as a whole, not "metric ton" + "s".
  var m = raw.match(
    /^(\d+(?:[.,]\d+)?)\s*(m³|m²|m\^?3|m\^?2|m|metric\s+tons?|tonnes?|kgs?|kilograms?|liters?|litres?)\b/i
  );
  if (!m) return null;
  var num = m[1].replace(",", ".");
  var unit = m[2].toLowerCase().replace(/\s+/g, " ").replace(/\^/g, "");
  // Disambiguate bare "m" via doc context.
  if (unit === "m") {
    if (/\bm³|\bm\s*\^?\s*3\b|\b1\s*m3\b|cubic\s+m(?:eter|etre)/i.test(fullText)) unit = "m³";
    else if (/\bm²|\bm\s*\^?\s*2\b|\b1\s*m2\b|square\s+m(?:eter|etre)/i.test(fullText)) unit = "m²";
    // else stay as "m" — ambiguous
  } else if (unit === "m3") unit = "m³";
  else if (unit === "m2") unit = "m²";
  else if (/^metric\s+tons?$|^tonnes?$/.test(unit)) unit = "metric ton";
  else if (/^kgs?$/.test(unit)) unit = "kg";
  else if (/^kilograms?$/.test(unit)) unit = "kg";
  else if (/^liters?$|^litres?$/.test(unit)) unit = "L";
  return num + " " + unit;
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
