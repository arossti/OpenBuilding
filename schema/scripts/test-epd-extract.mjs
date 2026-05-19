#!/usr/bin/env node
/**
 * EPD-Parser regression harness.
 *
 * Walks every PDF in docs/PDF References/EPD SAMPLES/{03,05,06,07}/,
 * runs each through the same spatial-join + js/epd/extract.mjs pipeline
 * the browser uses, and emits a per-sample coverage matrix:
 *   - metadata fields populated (manufacturer, EPD id, dates, PCR, …)
 *   - impact indicators populated (10 schema slots)
 *   - format detected
 *
 * Usage:
 *   node schema/scripts/test-epd-extract.mjs                       # writes a timestamped snapshot
 *                                                                   # to docs/workplans/EPD-coverage-history/
 *   node schema/scripts/test-epd-extract.mjs --md out.md            # explicit md path
 *   node schema/scripts/test-epd-extract.mjs --json out.json        # full-candidate JSON dump
 *   node schema/scripts/test-epd-extract.mjs --only Lafarge         # substring-filter samples
 *
 * The default-path behavior writes to a tracked directory so every
 * regex change can be git-diff'd against prior runs — Andy 2026-04-27
 * wants the harness output committed alongside code so coverage
 * progress (or regressions) are auditable.
 */

import { readdir, readFile, writeFile, stat, mkdir } from "node:fs/promises";
import { resolve, dirname, join, basename, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SAMPLES_ROOT = join(REPO_ROOT, "docs", "PDF References", "EPD SAMPLES");
const EXPECTED_ROOT = join(SAMPLES_ROOT, "expected");
const EXTRACT_MJS = join(REPO_ROOT, "js", "epd", "extract.mjs");
const LOOKUPS_DIR = join(REPO_ROOT, "schema", "lookups");
const MATERIALS_DIR = join(REPO_ROOT, "schema", "materials");
const COVERAGE_HISTORY_DIR = join(REPO_ROOT, "docs", "workplans", "EPD-coverage-history");

// Numeric tolerance for ground-truth extraction-fidelity check
// (workplan §10.3). 1% relative + 1e-12 absolute (latter handles
// near-zero values like net biogenic GWP = 0).
const GT_NUMERIC_TOLERANCE = 0.01;
const GT_NUMERIC_ABS_FLOOR = 1e-12;

// Trunk-of-tree fields (workplan §5.6) front-load so per-format
// regressions on Tier 1/2 surface as a single drop in the aggregate %.
const METADATA_FIELDS = [
  "classification.group_prefix",
  "classification.material_type",
  "naming.display_name",
  "manufacturer.name",
  "epd.id",
  "epd.program_operator",
  "epd.publication_date",
  "epd.expiry_date",
  "epd.type",
  "epd.validation.type",
  "carbon.stated.per_unit",
  "physical.density.value_kg_m3",
  "methodology.pcr_guidelines",
  "methodology.standards"
];

const IMPACT_KEYS = [
  "gwp_kgco2e",
  "gwp_bio_kgco2e",
  "ozone_depletion_kgcfc11eq",
  "acidification_kgso2eq",
  "eutrophication_kgneq",
  "smog_kgo3eq",
  "abiotic_depletion_fossil_mj",
  "water_consumption_m3",
  "primary_energy_nonrenewable_mj",
  "primary_energy_renewable_mj"
];

/* ── Catalogue parity check ─────────────────────────────────────────── */
//
// Match each extracted candidate against the 821 records in
// schema/materials/*.json and report:
//   - Match category (strong / multi / medium / weak / unmatched)
//   - Field-by-field diff on safely-comparable fields
//
// Why some fields are unsafe to diff today: the catalogue's
// `impacts.<key>.total.value` is BEAM-normalized (per-common-unit,
// `source: "beam_derived"`), while the parser writes per-declared-unit
// values into the same path with `source: "epd_direct"`. Direct
// comparison would produce false-positive divergences. Once Tier-10
// (C-fb6) normalizes parser output via methodology.beam_calc, the
// impact comparisons can be added.
//
// Today's safe fields: density (unit-independent), manufacturer,
// display_name (string proximity), classification (group + material
// type), epd.id (substring match for heterogeneous formats).

const STOP_TOKENS = new Set([
  "the", "and", "for", "with", "epd", "epd's", "product", "products",
  "declaration", "environmental", "to", "of", "in", "on", "by", "an", "a",
  "is", "are", "as", "or", "from", "no"
]);

function _normalize(s) {
  return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function _tokens(s) {
  return _normalize(s)
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_TOKENS.has(t));
}

async function loadCatalogue() {
  const out = [];
  const files = await readdir(MATERIALS_DIR);
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    if (f === "index.json" || f === "import-report.json") continue;
    const raw = await readFile(join(MATERIALS_DIR, f), "utf8");
    const data = JSON.parse(raw);
    const records = data.records || data;
    for (const r of records) out.push(r);
  }
  return out;
}

// Score-based ranker. The thresholds (80 / 50 / 30) are empirical —
// tunable from the snapshot's distribution.
function matchCandidate(candidate, catalogue) {
  const cd = {
    displayTokens: _tokens(candidate.naming && candidate.naming.display_name),
    group: candidate.classification && candidate.classification.group_prefix,
    material: _normalize(candidate.classification && candidate.classification.material_type),
    manufacturer: _normalize(candidate.manufacturer && candidate.manufacturer.name),
    epdId: _normalize(candidate.epd && candidate.epd.id)
  };

  const ranked = [];
  for (const rec of catalogue) {
    const rd = {
      displayTokens: _tokens(rec.naming && rec.naming.display_name),
      group: rec.classification && rec.classification.group_prefix,
      material: _normalize(rec.classification && rec.classification.material_type),
      manufacturer: _normalize(rec.manufacturer && rec.manufacturer.name),
      epdId: _normalize(rec.epd && rec.epd.id),
      isIndustryAvg: rec.status && rec.status.is_industry_average === true
    };

    let score = 0;
    const reasons = [];

    // STRONG signals — manufacturer + epd.id substring overlap.
    // epd.id requires 5+ chars on both sides so we don't false-match
    // single-digit citation snippets like "2011".
    if (cd.epdId && rd.epdId && cd.epdId.length > 5 && rd.epdId.length > 5) {
      if (rd.epdId.includes(cd.epdId) || cd.epdId.includes(rd.epdId)) {
        score += 80;
        reasons.push("epd.id");
      }
    }
    if (cd.manufacturer && rd.manufacturer && cd.manufacturer.length > 3) {
      if (rd.manufacturer.includes(cd.manufacturer) || cd.manufacturer.includes(rd.manufacturer)) {
        score += 40;
        reasons.push("mfr");
      }
    }

    // MEDIUM — display_name token overlap (Jaccard-ish, asymmetric).
    if (cd.displayTokens.length && rd.displayTokens.length) {
      let shared = 0;
      for (const t of cd.displayTokens) if (rd.displayTokens.includes(t)) shared++;
      const overlap = shared / cd.displayTokens.length;
      if (overlap >= 0.5) {
        score += Math.round(40 * overlap);
        reasons.push(`disp(${shared}/${cd.displayTokens.length})`);
      }
    }

    // WEAK — classification anchors. Same-group bonus, cross-group small penalty.
    if (cd.group && cd.group === rd.group) {
      score += 10;
      reasons.push("group");
    } else if (cd.group && rd.group && cd.group !== rd.group) {
      score -= 5;
    }
    if (cd.material && cd.material === rd.material) {
      score += 10;
      reasons.push("mat");
    }

    if (score > 0) {
      ranked.push({
        id: rec.id,
        score,
        reasons,
        isIndustryAvg: rd.isIndustryAvg,
        displayName: (rec.naming && rec.naming.display_name) || "—"
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function classifyMatch(ranked) {
  if (ranked.length === 0) return { category: "unmatched", topScore: 0, matches: [] };
  const top = ranked[0];
  // 1:N detection — cluster matches within 10 points of the top score.
  // Same EPD producing multiple catalogue rows (e.g. bamboo plywood
  // 1/2" + 3/4" both reference the same SmartEPD id) lands here.
  const cluster = ranked.filter((m) => m.score >= top.score - 10);
  if (top.score >= 80) {
    return { category: cluster.length > 1 ? "strong-multi" : "strong", topScore: top.score, matches: cluster };
  }
  if (top.score >= 50) {
    return { category: cluster.length > 1 ? "medium-multi" : "medium", topScore: top.score, matches: cluster };
  }
  if (top.score >= 30) {
    return { category: "weak", topScore: top.score, matches: [top] };
  }
  return { category: "unmatched", topScore: top.score, matches: [] };
}

// Field-by-field diff between a candidate and ONE catalogue record.
// Returns an array of { path, status: "match"|"differ"|"one-null"|"both-null", candidate, catalogue }.
function fieldDiff(candidate, rec) {
  const out = [];
  const compare = (path, comparator) => {
    const cVal = getPath(candidate, path);
    const rVal = getPath(rec, path);
    if (cVal == null && rVal == null) {
      out.push({ path, status: "both-null", candidate: null, catalogue: null });
      return;
    }
    if (cVal == null || rVal == null) {
      out.push({ path, status: "one-null", candidate: cVal == null ? null : cVal, catalogue: rVal == null ? null : rVal });
      return;
    }
    out.push({ path, status: comparator(cVal, rVal) ? "match" : "differ", candidate: cVal, catalogue: rVal });
  };

  const strEq = (a, b) => _normalize(a) === _normalize(b);
  const strContains = (a, b) => {
    const na = _normalize(a);
    const nb = _normalize(b);
    if (!na || !nb) return false;
    return na.includes(nb) || nb.includes(na);
  };
  const numWithin5pct = (a, b) => {
    if (typeof a !== "number" || typeof b !== "number") return false;
    if (b === 0 && a === 0) return true;
    const denom = Math.max(Math.abs(b), 1e-12);
    return Math.abs(a - b) / denom <= 0.05;
  };

  compare("classification.group_prefix", strEq);
  compare("classification.material_type", strEq);
  compare("manufacturer.name", strContains);
  compare("physical.density.value_kg_m3", numWithin5pct);
  compare("epd.id", strContains);
  // NOT comparing impacts.* — see header comment.

  return out;
}

function parseArgs(argv) {
  const args = { json: null, md: null, only: null, root: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = argv[++i];
    else if (a === "--md") args.md = argv[++i];
    else if (a === "--only") args.only = argv[++i];
    else if (a === "--root") args.root = argv[++i];
  }
  return args;
}

async function loadPdfjs() {
  return await import("pdfjs-dist/legacy/build/pdf.mjs");
}

// Spatial join + implicit-space heuristic shared with the browser
// (js/shared/text-join.mjs). Same logic in both surfaces means any
// regex bug that depends on browser-specific pdf.js fragmentation
// (rev-3's sign-stripping was exactly that) gets caught by this
// harness immediately, instead of staying falsely green until a
// human notices.
const TextJoin = await import("../../js/shared/text-join.mjs");
const spatialJoinLines = TextJoin.itemsToLines;

async function extractFromPdf(pdfjs, pdfPath) {
  const data = new Uint8Array(await readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const pageTexts = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.map((it) => {
      const tx = it.transform;
      return {
        str: it.str,
        x: tx[4],
        y: viewport.height - tx[5],
        width: it.width
      };
    });
    pageTexts.push(spatialJoinLines(items));
  }
  await doc.destroy();
  return { pageTexts, pageCount: doc.numPages };
}

function getPath(obj, path) {
  const parts = path.split(".");
  let r = obj;
  for (const p of parts) {
    if (r == null) return undefined;
    r = r[p];
  }
  return r;
}

function isPopulated(v) {
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

// Map a value-path (e.g. "physical.density.value_kg_m3" or
// "impacts.gwp_kgco2e.total.value") to its parallel source-path by
// replacing the last segment with "source". Mirrors
// _resolveSourcePath() in js/epdparser.mjs.
function sourcePathForValue(valuePath) {
  const idx = valuePath.lastIndexOf(".");
  if (idx < 0) return "source";
  return valuePath.substring(0, idx) + ".source";
}

// Numeric ±tolerance comparison. Numbers within 1% relative OR
// 1e-12 absolute (the latter catches near-zero published values
// like Net Biogenic GWP = 0.00).
function numericMatch(extracted, expected) {
  if (typeof extracted !== "number" || typeof expected !== "number") return false;
  if (!isFinite(extracted) || !isFinite(expected)) return false;
  const absDiff = Math.abs(extracted - expected);
  if (absDiff <= GT_NUMERIC_ABS_FLOOR) return true;
  const denom = Math.max(Math.abs(expected), GT_NUMERIC_ABS_FLOOR);
  return absDiff / denom <= GT_NUMERIC_TOLERANCE;
}

// String-match for ground truth. Substring (case-insensitive) so
// minor whitespace / per-glyph residue doesn't trip the check.
function stringMatch(extracted, expected) {
  if (typeof extracted !== "string" || typeof expected !== "string") return false;
  return extracted.toLowerCase().includes(expected.toLowerCase());
}

// Three ground-truth checks per workplan §10.3:
//   1. extraction fidelity — every key the EPD publishes must extract
//   2. defaults applied   — every key the EPD omits must be filled from
//                            the catalogue with source: "generic_default"
//   3. no silent overrides — every key the EPD publishes must NOT carry
//                             source: "generic_default" after fallback
function evaluateGroundTruth(record, expected) {
  const result = {
    extractionFailures: [],
    silentOverrides: [],
    defaultsAppliedFailures: [],
    publishedCount: 0,
    omittedCount: 0
  };
  if (!expected) return result;

  const publishes = expected.epd_publishes || {};
  const omits = expected.epd_omits || [];

  // Check 1 — extraction fidelity
  for (const path of Object.keys(publishes)) {
    result.publishedCount++;
    const expectedVal = publishes[path];
    const extractedVal = getPath(record, path);
    let ok = false;
    if (extractedVal == null) ok = false;
    else if (typeof expectedVal === "number") ok = numericMatch(extractedVal, expectedVal);
    else if (typeof expectedVal === "string") ok = stringMatch(String(extractedVal), expectedVal);
    else ok = extractedVal === expectedVal;
    if (!ok) {
      result.extractionFailures.push({
        path,
        expected: expectedVal,
        extracted: extractedVal == null ? null : extractedVal
      });
    }
  }

  // Check 2 — defaults applied (only meaningful for catalogue-fillable
  // fields; today that's just physical.density.value_kg_m3 plus
  // anything else applyMaterialDefaults grows to handle).
  for (const path of omits) {
    result.omittedCount++;
    const filled = getPath(record, path);
    const sourceP = sourcePathForValue(path);
    const source = getPath(record, sourceP);
    if (filled == null || source !== "generic_default") {
      result.defaultsAppliedFailures.push({ path, filled, source });
    }
  }

  // Check 3 — no silent overrides. For any key the EPD publishes, the
  // post-fallback source must NOT be "generic_default" — i.e. the
  // catalogue must not be papering over a regex bug.
  for (const path of Object.keys(publishes)) {
    const sourceP = sourcePathForValue(path);
    const source = getPath(record, sourceP);
    if (source === "generic_default") {
      result.silentOverrides.push({ path, expected: publishes[path], extracted: getPath(record, path) });
    }
  }

  return result;
}

async function loadExpected(samplePdfFile) {
  const expectedPath = join(EXPECTED_ROOT, samplePdfFile.replace(/\.pdf$/i, ".json"));
  try {
    const raw = await readFile(expectedPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null; // unannotated samples skip gracefully
    throw err;
  }
}

async function walkPdfs(root) {
  const out = [];
  async function rec(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isDirectory()) await rec(full);
      else if (e.isFile() && /\.pdf$/i.test(e.name)) out.push(full);
    }
  }
  try {
    await rec(root);
  } catch (err) {
    console.error("Could not walk:", root, err.message);
  }
  return out.sort();
}

// EN 15804+A2 lifecycle stages — schema slots for impacts.<key>.by_stage.<stage>
// (NOT including the A1-A3 composite, which is impacts.<key>.total.value).
const ALL_STAGES = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "C1", "C2", "C3", "C4", "D"];

function summarizeRecord(rec) {
  const meta = {};
  let metaHit = 0;
  for (const path of METADATA_FIELDS) {
    const v = getPath(rec, path);
    meta[path] = isPopulated(v) ? v : null;
    if (isPopulated(v)) metaHit++;
  }
  const impacts = {};
  let impactHit = 0;
  let byStageHit = 0;
  // Per-indicator by_stage population — counts non-null cells across the
  // 17 EN 15804+A2 stages. Surfaces P3.3 coverage as a separate dimension
  // from impact totals (a sample with all 10 totals + zero by_stage cells
  // is a real gap; e.g. a per-format extractor that only catches the A1-A3
  // total column and leaves the rest unparsed).
  const byStagePerIndicator = {};
  for (const k of IMPACT_KEYS) {
    const v = getPath(rec, "impacts." + k + ".total.value");
    impacts[k] = v != null ? v : null;
    if (v != null) impactHit++;
    let perIndCount = 0;
    for (const s of ALL_STAGES) {
      const sv = getPath(rec, "impacts." + k + ".by_stage." + s + ".value");
      if (sv != null) {
        byStageHit++;
        perIndCount++;
      }
    }
    byStagePerIndicator[k] = perIndCount;
  }
  return {
    metaHit, metaTotal: METADATA_FIELDS.length,
    impactHit, impactTotal: IMPACT_KEYS.length,
    byStageHit, byStageTotal: IMPACT_KEYS.length * ALL_STAGES.length,
    byStagePerIndicator,
    meta, impacts
  };
}

function fmtPct(n, d) {
  if (d === 0) return "0/0";
  return `${n}/${d}`;
}

// Synthesise a short human-readable label from a regex source so the
// per-pattern audit table is readable. Strips escape backslashes /
// whitespace tokens, truncates with ellipsis.
function shortRxLabel(rx, maxLen) {
  if (!rx || !rx.source) return "?";
  let s = rx.source
    .replace(/\\s\+/g, " ")
    .replace(/\\s\*/g, "")
    .replace(/\\s/g, " ")
    .replace(/\\b/g, "")
    .replace(/\\\./g, ".")
    .replace(/\(\?:/g, "(")
    .replace(/\\n|\\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > maxLen) s = s.substring(0, maxLen - 1) + "…";
  return s;
}

// Per-pattern hit tally (workplan §12.5 item 1). Mirrors production
// semantics: IMPACT_INDICATORS are matched against the whole joined
// text (same as _extractIndicatorTotals); _BYSTAGE_LABELS and
// _CISC_LABEL_PATTERNS are tested per-line (same as _extractByStage /
// _findCISCDataRowKey). A pattern with 0 hits across the full sample
// set is a deprecation candidate.
function tallyWholeText(allText, patternArr, getRx, hits) {
  for (let i = 0; i < patternArr.length; i++) {
    const rx = getRx(patternArr[i]);
    if (!rx) continue;
    if (rx.test(allText)) hits[i]++;
  }
}

function tallyPerLine(allText, patternArr, getRx, hits) {
  const lines = allText.split("\n");
  for (let i = 0; i < patternArr.length; i++) {
    const rx = getRx(patternArr[i]);
    if (!rx) continue;
    let matched = false;
    for (let l = 0; l < lines.length; l++) {
      if (rx.test(lines[l])) {
        matched = true;
        break;
      }
    }
    if (matched) hits[i]++;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pdfjs = await loadPdfjs();
  const Extract = await import(EXTRACT_MJS);

  // Prime the lookups so Tier 1 group inference + Tier 9 material-default
  // fallback can run. Source-of-truth is schema/lookups/ — same files the
  // CSV importer reads.
  const mt = JSON.parse(await readFile(join(LOOKUPS_DIR, "material-type-to-group.json"), "utf8"));
  const kw = JSON.parse(await readFile(join(LOOKUPS_DIR, "display-name-keywords.json"), "utf8"));
  const md = JSON.parse(await readFile(join(LOOKUPS_DIR, "db-fallbacks.json"), "utf8"));
  const mg = JSON.parse(await readFile(join(LOOKUPS_DIR, "material-groups.json"), "utf8"));
  Extract.setLookups({
    mtMap: mt.map || {},
    kwPatterns: kw.patterns || [],
    materialDefaults: md,
    materialGroups: mg
  });

  // --root <dir> overrides the default 30-sample EPD SAMPLES tree.
  // Used to point the harness at a larger external sample directory
  // for scaling tests (workplan §12.6). Resolved against CWD to
  // accept both absolute paths and paths relative to the user's
  // current working directory.
  const sampleRoot = args.root ? resolve(process.cwd(), args.root) : SAMPLES_ROOT;
  const pdfs = await walkPdfs(sampleRoot);
  if (pdfs.length === 0) {
    console.error("No PDFs found under:", sampleRoot);
    process.exit(1);
  }
  if (args.root) {
    console.log(`Using --root ${sampleRoot} (${pdfs.length} PDFs)`);
  }

  // Per-pattern hit-count audit (workplan §12.5 item 1). Counters
  // sized to each pattern array; bumped once per sample where the
  // regex fires (mirrors production semantics — see tallyWholeText /
  // tallyPerLine). Patterns with 0 hits across the full set surface
  // as deprecation candidates in the snapshot.
  const impactHits = new Array(Extract.IMPACT_INDICATORS.length).fill(0);
  const byStageLabelHits = new Array(Extract._BYSTAGE_LABELS.length).fill(0);
  const ciscHits = new Array(Extract._CISC_LABEL_PATTERNS.length).fill(0);

  // Catalogue parity (§11.10 follow-up — verifies extracted records
  // against the 821-record schema/materials/ catalogue). Loaded once
  // per harness run; matcher runs per-sample after extraction.
  const catalogue = await loadCatalogue();
  console.log(`Loaded ${catalogue.length} catalogue records for parity check.`);

  const results = [];
  for (const pdfPath of pdfs) {
    const rel = relative(REPO_ROOT, pdfPath);
    const group = basename(dirname(pdfPath));
    const file = basename(pdfPath);
    if (args.only && !file.toLowerCase().includes(args.only.toLowerCase())) continue;

    let extracted;
    try {
      extracted = await extractFromPdf(pdfjs, pdfPath);
    } catch (err) {
      results.push({ group, file, error: err.message });
      console.error(`✗ ${file}  failed: ${err.message}`);
      continue;
    }

    let result;
    try {
      result = Extract.extract(extracted.pageTexts);
    } catch (err) {
      results.push({ group, file, pages: extracted.pageCount, error: "extract: " + err.message });
      console.error(`✗ ${file}  extract failed: ${err.message}`);
      continue;
    }

    // Per-pattern audit: re-join page texts the same way extract()
    // does (page-pair separator "\n\n") so the regexes see identical
    // input to production.
    const allText = (extracted.pageTexts || []).join("\n\n");
    tallyWholeText(allText, Extract.IMPACT_INDICATORS, (e) => e.regex, impactHits);
    tallyPerLine(allText, Extract._BYSTAGE_LABELS, (e) => e.rx, byStageLabelHits);
    tallyPerLine(allText, Extract._CISC_LABEL_PATTERNS, (e) => e.rx, ciscHits);

    const summary = summarizeRecord(result.record);
    const expected = await loadExpected(file);
    const gt = evaluateGroundTruth(result.record, expected);

    // Catalogue parity — match candidate against the 821-record catalogue
    // and field-diff against the top match (if any). For unmatched
    // samples, parity = null and the snapshot tags them as candidates
    // for new entries.
    const ranked = matchCandidate(result.record, catalogue);
    const classification = classifyMatch(ranked);
    const parity =
      classification.matches.length > 0
        ? {
            category: classification.category,
            topScore: classification.topScore,
            matches: classification.matches.slice(0, 5),
            diff: fieldDiff(result.record, catalogue.find((r) => r.id === classification.matches[0].id))
          }
        : { category: "unmatched", topScore: classification.topScore, matches: [], diff: [] };

    results.push({
      group,
      file,
      pages: extracted.pageCount,
      format: result.format,
      anchorsHit: result.anchorsHit,
      meta: summary.meta,
      impacts: summary.impacts,
      metaHit: summary.metaHit,
      impactHit: summary.impactHit,
      byStageHit: summary.byStageHit,
      byStageTotal: summary.byStageTotal,
      byStagePerIndicator: summary.byStagePerIndicator,
      record: result.record,
      expected,
      groundTruth: gt,
      parity
    });
    const gtTag = expected
      ? gt.extractionFailures.length === 0 && gt.silentOverrides.length === 0 && gt.defaultsAppliedFailures.length === 0
        ? "  GT=✓"
        : `  GT=✗ ext:${gt.extractionFailures.length} silent:${gt.silentOverrides.length} dflt:${gt.defaultsAppliedFailures.length}`
      : "";
    const parityTag =
      parity.category === "unmatched"
        ? "  cat=—"
        : `  cat=${parity.category}(${parity.topScore})`;
    console.log(
      `✓ ${group}/${file.padEnd(60)}  fmt=${result.format.padEnd(20)}  meta=${fmtPct(summary.metaHit, summary.metaTotal)}  impacts=${fmtPct(summary.impactHit, summary.impactTotal)}  by_stage=${fmtPct(summary.byStageHit, summary.byStageTotal)}  pages=${extracted.pageCount}${gtTag}${parityTag}`
    );
  }

  // ── Aggregate ───────────────────────────────────────
  const ok = results.filter((r) => !r.error);
  const totalMeta = ok.reduce((a, r) => a + r.metaHit, 0);
  const totalMetaPossible = ok.length * METADATA_FIELDS.length;
  const totalImpact = ok.reduce((a, r) => a + r.impactHit, 0);
  const totalImpactPossible = ok.length * IMPACT_KEYS.length;
  const totalByStage = ok.reduce((a, r) => a + (r.byStageHit || 0), 0);
  const totalByStagePossible = ok.length * IMPACT_KEYS.length * ALL_STAGES.length;
  const formatCounts = {};
  for (const r of ok) formatCounts[r.format] = (formatCounts[r.format] || 0) + 1;

  console.log("");
  console.log("─".repeat(80));
  console.log(`Samples processed: ${ok.length} / ${results.length}`);
  console.log(
    `Metadata coverage: ${totalMeta} / ${totalMetaPossible}  (${((100 * totalMeta) / totalMetaPossible).toFixed(1)}%)`
  );
  console.log(
    `Impact coverage:   ${totalImpact} / ${totalImpactPossible}  (${((100 * totalImpact) / totalImpactPossible).toFixed(1)}%)`
  );
  console.log(
    `By-stage coverage: ${totalByStage} / ${totalByStagePossible}  (${((100 * totalByStage) / totalByStagePossible).toFixed(1)}%) — 10 indicators × ${ALL_STAGES.length} stages × ${ok.length} samples`
  );
  console.log(
    `Formats: ${Object.entries(formatCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`
  );

  // ── Per-format breakdown (workplan §12.5) ───────────
  // Tabulate metadata + impact + by_stage coverage by detected format.
  // Surfaces which formats are most under-served — informs the §12.3
  // architectural choice (geometric vs declarative vs HITL).
  const formatBreakdown = {};
  for (const r of ok) {
    if (!formatBreakdown[r.format]) {
      formatBreakdown[r.format] = { count: 0, meta: 0, metaMax: 0, impact: 0, impactMax: 0, byStage: 0, byStageMax: 0 };
    }
    const fb = formatBreakdown[r.format];
    fb.count++;
    fb.meta += r.metaHit;
    fb.metaMax += METADATA_FIELDS.length;
    fb.impact += r.impactHit;
    fb.impactMax += IMPACT_KEYS.length;
    fb.byStage += r.byStageHit || 0;
    fb.byStageMax += IMPACT_KEYS.length * ALL_STAGES.length;
  }
  console.log("");
  console.log("Per-format breakdown:");
  for (const fmt of Object.keys(formatBreakdown).sort()) {
    const fb = formatBreakdown[fmt];
    const mPct = ((100 * fb.meta) / fb.metaMax).toFixed(1);
    const iPct = ((100 * fb.impact) / fb.impactMax).toFixed(1);
    const bPct = ((100 * fb.byStage) / fb.byStageMax).toFixed(1);
    console.log(`  ${fmt.padEnd(20)} n=${fb.count.toString().padStart(3)}  meta=${mPct}%  impact=${iPct}%  by_stage=${bPct}%`);
  }

  // ── Per-parameter aggregate hit-rate (workplan §12.5) ───
  // Surfaces which schema fields have systemic gaps vs sample-
  // idiosyncratic gaps. A field with low hit-rate across many formats
  // suggests a generalization opportunity; low hit-rate concentrated
  // in one format suggests a per-format extractor needs work (or the
  // EPD genuinely doesn't publish that field).
  const paramHits = {};
  for (const f of METADATA_FIELDS) paramHits[f] = 0;
  for (const k of IMPACT_KEYS) paramHits["impacts." + k + ".total.value"] = 0;
  for (const r of ok) {
    for (const f of METADATA_FIELDS) {
      if (r.meta[f] != null) paramHits[f]++;
    }
    for (const k of IMPACT_KEYS) {
      if (r.impacts[k] != null) paramHits["impacts." + k + ".total.value"]++;
    }
  }
  console.log("");
  console.log("Per-parameter aggregate hit-rate (across", ok.length, "samples):");
  const sortedParams = Object.entries(paramHits).sort((a, b) => b[1] - a[1]);
  for (const [path, hits] of sortedParams) {
    const pct = ((100 * hits) / ok.length).toFixed(0);
    console.log(`  ${path.padEnd(50)} ${hits.toString().padStart(3)}/${ok.length}  (${pct}%)`);
  }

  // ── Per-pattern hit count (workplan §12.5 item 1) ───
  // For each entry in IMPACT_INDICATORS / _BYSTAGE_LABELS /
  // _CISC_LABEL_PATTERNS, report how many samples the regex fires on.
  // Patterns with 0 hits are deprecation candidates; patterns with 1
  // hit are also candidates if the matched sample's coverage is
  // already strong from another regex. This is the data input to the
  // §12.3 architecture decision — geometric/declarative/HITL choice
  // becomes cheaper to evaluate when we can name the dead weight.
  function printPatternAudit(title, patternArr, hits, getRx, getLabel) {
    console.log("");
    console.log(`Per-pattern hit count — ${title} (${patternArr.length} patterns × ${ok.length} samples):`);
    for (let i = 0; i < patternArr.length; i++) {
      const hit = hits[i];
      const pct = ok.length ? ((100 * hit) / ok.length).toFixed(0) : "0";
      const tag = hit === 0 ? "  DEAD" : "";
      const label = getLabel(patternArr[i], i) || shortRxLabel(getRx(patternArr[i]), 56);
      console.log(`  [${String(i).padStart(2, "0")}] ${label.padEnd(58)} hits=${String(hit).padStart(3)}/${ok.length}  (${pct}%)${tag}`);
    }
  }
  printPatternAudit(
    "IMPACT_INDICATORS",
    Extract.IMPACT_INDICATORS,
    impactHits,
    (e) => e.regex,
    (e) => (e.schemaKey ? `${e.schemaKey} — ${e.label || ""}`.trim() : null)
  );
  printPatternAudit(
    "_BYSTAGE_LABELS",
    Extract._BYSTAGE_LABELS,
    byStageLabelHits,
    (e) => e.rx,
    (e) => e.key
  );
  printPatternAudit(
    "_CISC_LABEL_PATTERNS",
    Extract._CISC_LABEL_PATTERNS,
    ciscHits,
    (e) => e.rx,
    (e) => e.key
  );

  // ── Catalogue parity (§11.10 follow-up) ──────────────
  // Distribution of match category + field-diff aggregate. Unmatched
  // samples are candidates for new catalogue entries; matched ones
  // give us extraction-fidelity signal against authoritative values
  // (limited to safely-comparable fields today — impact values still
  // pending Tier-10 unit normalization).
  const parityCounts = {};
  const parityFieldStats = {};
  const PARITY_FIELDS = [
    "classification.group_prefix",
    "classification.material_type",
    "manufacturer.name",
    "physical.density.value_kg_m3",
    "epd.id"
  ];
  for (const p of PARITY_FIELDS) parityFieldStats[p] = { match: 0, differ: 0, oneNull: 0, bothNull: 0 };
  for (const r of ok) {
    const cat = r.parity.category;
    parityCounts[cat] = (parityCounts[cat] || 0) + 1;
    if (r.parity.category !== "unmatched") {
      for (const d of r.parity.diff) {
        const stat = parityFieldStats[d.path];
        if (!stat) continue;
        if (d.status === "match") stat.match++;
        else if (d.status === "differ") stat.differ++;
        else if (d.status === "one-null") stat.oneNull++;
        else if (d.status === "both-null") stat.bothNull++;
      }
    }
  }
  console.log("");
  console.log(`Catalogue parity check (${ok.length} candidates × ${catalogue.length} catalogue records):`);
  const CAT_ORDER = ["strong", "strong-multi", "medium", "medium-multi", "weak", "unmatched"];
  for (const cat of CAT_ORDER) {
    const n = parityCounts[cat] || 0;
    const pct = ok.length ? ((100 * n) / ok.length).toFixed(0) : "0";
    console.log(`  ${cat.padEnd(14)} ${String(n).padStart(4)}/${ok.length}  (${pct}%)`);
  }
  console.log("");
  console.log(`Field-diff on matched samples (excluding unmatched):`);
  for (const p of PARITY_FIELDS) {
    const s = parityFieldStats[p];
    const totalNonNull = s.match + s.differ + s.oneNull;
    const matchPct = totalNonNull ? ((100 * s.match) / totalNonNull).toFixed(0) : "—";
    console.log(`  ${p.padEnd(50)} match=${s.match}  differ=${s.differ}  one-null=${s.oneNull}  both-null=${s.bothNull}  (${matchPct}%)`);
  }

  // ── Ground-truth aggregate (workplan §10.3) ─────────
  const annotated = ok.filter((r) => r.expected);
  const totalExtractFailures = annotated.reduce((a, r) => a + r.groundTruth.extractionFailures.length, 0);
  const totalSilentOverrides = annotated.reduce((a, r) => a + r.groundTruth.silentOverrides.length, 0);
  const totalDefaultsFailures = annotated.reduce((a, r) => a + r.groundTruth.defaultsAppliedFailures.length, 0);
  console.log(
    `Ground-truth checks: ${annotated.length} sample${annotated.length === 1 ? "" : "s"} annotated, ${totalExtractFailures} extraction failures, ${totalSilentOverrides} silent-override violations, ${totalDefaultsFailures} defaults-applied failures`
  );
  // Print individual failures so they're actionable when CI surfaces them
  for (const r of annotated) {
    const gt = r.groundTruth;
    if (gt.extractionFailures.length || gt.silentOverrides.length || gt.defaultsAppliedFailures.length) {
      console.log(`  ${r.group}/${r.file}:`);
      for (const f of gt.extractionFailures) {
        console.log(`    ✗ extraction: ${f.path}  expected=${JSON.stringify(f.expected)}  extracted=${JSON.stringify(f.extracted)}`);
      }
      for (const f of gt.silentOverrides) {
        console.log(`    ✗ silent override: ${f.path}  EPD publishes ${JSON.stringify(f.expected)} but record source=generic_default (regex bug masked by catalogue)`);
      }
      for (const f of gt.defaultsAppliedFailures) {
        console.log(`    ✗ defaults applied: ${f.path}  expected catalogue fill, got value=${JSON.stringify(f.filled)} source=${JSON.stringify(f.source)}`);
      }
    }
  }

  // ── Markdown coverage table ─────────────────────────
  // Default behavior: if no --md path was given, write a timestamped
  // snapshot to the tracked coverage-history dir so every harness run
  // is auditable via git diff (Andy 2026-04-27).
  if (!args.md && !args.json && !args.only) {
    await mkdir(COVERAGE_HISTORY_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/:/g, "-").replace(/\..*/, "Z");
    args.md = join(COVERAGE_HISTORY_DIR, stamp + ".md");
  }
  if (args.md) {
    const lines = [];
    lines.push("# EPD-Parser regression coverage matrix");
    lines.push("");
    lines.push(`Run: ${new Date().toISOString()}`);
    lines.push(
      `Samples: ${ok.length} · metadata: ${totalMeta}/${totalMetaPossible} (${((100 * totalMeta) / totalMetaPossible).toFixed(1)}%) · impacts: ${totalImpact}/${totalImpactPossible} (${((100 * totalImpact) / totalImpactPossible).toFixed(1)}%) · by_stage: ${totalByStage}/${totalByStagePossible} (${((100 * totalByStage) / totalByStagePossible).toFixed(1)}%)`
    );
    lines.push("");
    lines.push("## Per-sample coverage");
    lines.push("");
    lines.push("| Sample | Format | Pages | Meta | Impacts | by_stage | GWP | ODP | AP | EP | SFP | ADPf | WDP | PE-NR | PE-R |");
    lines.push("|---|---|---:|---:|---:|---:|---|---|---|---|---|---|---|---|---|");
    for (const r of results) {
      if (r.error) {
        lines.push(`| ${r.group}/${r.file} | (error: ${r.error}) | — | — | — | — | | | | | | | | | |`);
        continue;
      }
      const i = r.impacts;
      const cell = (v) =>
        v == null
          ? "·"
          : v.toExponential
            ? Math.abs(v) < 0.01 || Math.abs(v) > 99999
              ? v.toExponential(2)
              : String(v)
            : "·";
      const bsTotal = IMPACT_KEYS.length * ALL_STAGES.length;
      lines.push(
        `| ${r.group}/${r.file} | ${r.format} | ${r.pages} | ${r.metaHit}/${METADATA_FIELDS.length} | ${r.impactHit}/${IMPACT_KEYS.length} | ${r.byStageHit || 0}/${bsTotal} | ${cell(i.gwp_kgco2e)} | ${cell(i.ozone_depletion_kgcfc11eq)} | ${cell(i.acidification_kgso2eq)} | ${cell(i.eutrophication_kgneq)} | ${cell(i.smog_kgo3eq)} | ${cell(i.abiotic_depletion_fossil_mj)} | ${cell(i.water_consumption_m3)} | ${cell(i.primary_energy_nonrenewable_mj)} | ${cell(i.primary_energy_renewable_mj)} |`
      );
    }
    // Per-indicator by_stage coverage breakdown — exposes WHICH indicator
    // rows are missing per-stage data for each sample. Drives the per-format
    // gap fixing in §11.4 and beyond.
    lines.push("");
    lines.push("## Per-stage matrix population (by indicator × sample)");
    lines.push("");
    lines.push("Each cell = number of populated stage cells out of 17 (A1, A2, A3, A4, A5, B1..B7, C1..C4, D).");
    lines.push("");
    lines.push("| Sample | GWP | GWP-bio | ODP | AP | EP | SFP | ADPf | WDP | PE-NR | PE-R |");
    lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const r of results) {
      if (r.error || !r.byStagePerIndicator) continue;
      const bs = r.byStagePerIndicator;
      const bsCell = (n) => (n > 0 ? `${n}` : "·");
      lines.push(
        `| ${r.group}/${r.file} | ${bsCell(bs.gwp_kgco2e)} | ${bsCell(bs.gwp_bio_kgco2e)} | ${bsCell(bs.ozone_depletion_kgcfc11eq)} | ${bsCell(bs.acidification_kgso2eq)} | ${bsCell(bs.eutrophication_kgneq)} | ${bsCell(bs.smog_kgo3eq)} | ${bsCell(bs.abiotic_depletion_fossil_mj)} | ${bsCell(bs.water_consumption_m3)} | ${bsCell(bs.primary_energy_nonrenewable_mj)} | ${bsCell(bs.primary_energy_renewable_mj)} |`
      );
    }
    // Per-pattern hit count (workplan §12.5 item 1). Identifies dead-
    // weight regexes that are candidates for deprecation in the §12.3
    // architecture review. A pattern matching 0 samples earned nothing
    // for its maintenance cost; 1 sample is also a candidate when the
    // matched sample's coverage is already strong from another regex.
    function mdPatternAudit(title, patternArr, hits, getRx, getLabel) {
      lines.push("");
      lines.push(`## Per-pattern hit count — ${title}`);
      lines.push("");
      lines.push(`${patternArr.length} patterns × ${ok.length} samples. \`DEAD\` = 0 hits, deprecation candidate.`);
      lines.push("");
      lines.push("| # | Key / label | Hits | % | Status |");
      lines.push("|---:|---|---:|---:|---|");
      for (let i = 0; i < patternArr.length; i++) {
        const hit = hits[i];
        const pct = ok.length ? ((100 * hit) / ok.length).toFixed(0) : "0";
        const tag = hit === 0 ? "DEAD" : hit === 1 ? "thin" : "";
        const label = getLabel(patternArr[i], i) || shortRxLabel(getRx(patternArr[i]), 56);
        lines.push(`| ${i} | ${label.replace(/\|/g, "\\|")} | ${hit}/${ok.length} | ${pct}% | ${tag} |`);
      }
    }
    mdPatternAudit(
      "IMPACT_INDICATORS",
      Extract.IMPACT_INDICATORS,
      impactHits,
      (e) => e.regex,
      (e) => (e.schemaKey ? `\`${e.schemaKey}\` — ${e.label || ""}`.trim() : null)
    );
    mdPatternAudit(
      "_BYSTAGE_LABELS",
      Extract._BYSTAGE_LABELS,
      byStageLabelHits,
      (e) => e.rx,
      (e) => (e.key ? `\`${e.key}\`` : null)
    );
    mdPatternAudit(
      "_CISC_LABEL_PATTERNS",
      Extract._CISC_LABEL_PATTERNS,
      ciscHits,
      (e) => e.rx,
      (e) => (e.key ? `\`${e.key}\`` : null)
    );

    // Catalogue parity (§11.10 follow-up) — aggregate distribution
    // + per-field diff + per-sample top-match listing. Sample listing
    // helps Andy/Mélanie spot-check that the matcher is making sensible
    // assignments before we trust the divergence signal at scale.
    lines.push("");
    lines.push("## Catalogue parity check");
    lines.push("");
    lines.push(`${ok.length} candidates × ${catalogue.length} catalogue records.`);
    lines.push("");
    lines.push("| Category | Count | % |");
    lines.push("|---|---:|---:|");
    for (const cat of CAT_ORDER) {
      const n = parityCounts[cat] || 0;
      const pct = ok.length ? ((100 * n) / ok.length).toFixed(0) : "0";
      lines.push(`| ${cat} | ${n}/${ok.length} | ${pct}% |`);
    }
    lines.push("");
    lines.push("### Field diff on matched samples");
    lines.push("");
    lines.push("Impact values (`impacts.*`) deliberately excluded — catalogue stores BEAM-normalized values; parser stores per-declared-unit values. Comparison would false-positive until Tier-10 (C-fb6) normalizes parser output.");
    lines.push("");
    lines.push("| Field | Match | Differ | One-null | Both-null | Match% (excl. both-null) |");
    lines.push("|---|---:|---:|---:|---:|---:|");
    for (const p of PARITY_FIELDS) {
      const s = parityFieldStats[p];
      const totalNonNull = s.match + s.differ + s.oneNull;
      const matchPct = totalNonNull ? ((100 * s.match) / totalNonNull).toFixed(0) + "%" : "—";
      lines.push(`| \`${p}\` | ${s.match} | ${s.differ} | ${s.oneNull} | ${s.bothNull} | ${matchPct} |`);
    }
    lines.push("");
    lines.push("### Per-sample top match");
    lines.push("");
    lines.push("| Sample | Category | Score | Catalogue id | Catalogue display_name | Reasons |");
    lines.push("|---|---|---:|---|---|---|");
    for (const r of results) {
      if (r.error || !r.parity) continue;
      const p = r.parity;
      if (p.category === "unmatched") {
        lines.push(`| ${r.group}/${r.file} | unmatched | ${p.topScore || 0} | — | — | — |`);
      } else {
        const top = p.matches[0];
        const reasons = top.reasons.join(", ");
        const multi = p.matches.length > 1 ? ` (+${p.matches.length - 1} more)` : "";
        const dispEsc = String(top.displayName).replace(/\|/g, "\\|");
        lines.push(`| ${r.group}/${r.file} | ${p.category} | ${top.score} | \`${top.id}\`${multi} | ${dispEsc} | ${reasons} |`);
      }
    }
    // Per-sample divergence detail — only for samples with at least one "differ".
    const divergent = results.filter((r) => !r.error && r.parity && r.parity.diff.some((d) => d.status === "differ"));
    if (divergent.length) {
      lines.push("");
      lines.push("### Divergence detail (matched samples with at least one differing field)");
      lines.push("");
      for (const r of divergent) {
        const diffs = r.parity.diff.filter((d) => d.status === "differ");
        if (!diffs.length) continue;
        lines.push(`**${r.group}/${r.file}** (top: \`${r.parity.matches[0].id}\` — ${r.parity.matches[0].displayName}):`);
        for (const d of diffs) {
          lines.push(`- \`${d.path}\` — candidate \`${JSON.stringify(d.candidate)}\` vs catalogue \`${JSON.stringify(d.catalogue)}\``);
        }
        lines.push("");
      }
    }

    // Ground-truth section appended only when at least one sample is
    // annotated. Empty expected/ dir = no section, no clutter.
    if (annotated.length) {
      lines.push("");
      lines.push("## Ground-truth checks (workplan §10.3)");
      lines.push("");
      lines.push(
        `${annotated.length} sample${annotated.length === 1 ? "" : "s"} annotated · ${totalExtractFailures} extraction failures · ${totalSilentOverrides} silent-override violations · ${totalDefaultsFailures} defaults-applied failures`
      );
      lines.push("");
      lines.push("| Sample | Published keys | Omitted keys | Extraction ✗ | Silent overrides ✗ | Defaults applied ✗ |");
      lines.push("|---|---:|---:|---:|---:|---:|");
      for (const r of annotated) {
        const gt = r.groundTruth;
        lines.push(
          `| ${r.group}/${r.file} | ${gt.publishedCount} | ${gt.omittedCount} | ${gt.extractionFailures.length} | ${gt.silentOverrides.length} | ${gt.defaultsAppliedFailures.length} |`
        );
      }
      // Per-failure detail block, so coverage-history snapshots are
      // actionable as standalone diffs (no need to re-run harness to see
      // what failed at a given SHA).
      for (const r of annotated) {
        const gt = r.groundTruth;
        if (gt.extractionFailures.length || gt.silentOverrides.length || gt.defaultsAppliedFailures.length) {
          lines.push("");
          lines.push(`### Failures — ${r.group}/${r.file}`);
          lines.push("");
          for (const f of gt.extractionFailures) {
            lines.push(`- **extraction**: \`${f.path}\` expected \`${JSON.stringify(f.expected)}\`, extracted \`${JSON.stringify(f.extracted)}\``);
          }
          for (const f of gt.silentOverrides) {
            lines.push(`- **silent override**: \`${f.path}\` EPD publishes \`${JSON.stringify(f.expected)}\` but record source=\`generic_default\` (catalogue masking a regex bug)`);
          }
          for (const f of gt.defaultsAppliedFailures) {
            lines.push(`- **defaults applied**: \`${f.path}\` expected catalogue fill, got value=\`${JSON.stringify(f.filled)}\` source=\`${JSON.stringify(f.source)}\``);
          }
        }
      }
    }
    await writeFile(args.md, lines.join("\n") + "\n");
    console.log(`Markdown coverage written to ${args.md}`);
  }

  if (args.json) {
    await writeFile(args.json, JSON.stringify(results, null, 2));
    console.log(`Full per-sample dump written to ${args.json}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
