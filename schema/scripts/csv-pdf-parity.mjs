#!/usr/bin/env node
// csv-pdf-parity.mjs — Parity B (Pass 1): BEAM CSV ↔ EPD-parser extraction.
//
// Question answered: "Of the fields the BEAM spreadsheet has populated for each
// row, how many does the EPD parser extract correctly from the source PDF?"
// The CSV is ground truth; the parser is under test.
//
// Alignment is by EPD ID, taken from the PDF filename prefix (everything
// before " - "). Same canonicalization as §16.1.1 — strip to lowercase
// alphanumerics, then group. Multiple BEAM rows can share an EPD ID
// (multi-product fan-out per §16.1 Follow-up #4); we parse each PDF once
// and compare its single record against every BEAM row sharing that ID.
// Partial-mismatch within a multi-product family is expected data, not failure.
//
// §18 normalization is INLINED here (not committed to extract.mjs):
//   physical.density.value_kg_m3 → physical.density.value + units = "kg/m3"
//   impacts.gwp_kgco2e.total.value → carbon.stated.value_kgco2e
// so density and GWP slot to the canonical DUMP paths for comparison.
//
// Output (mirrors Parity A's shape):
//   parity-sheet1-beam.csv    BEAM cells (rows that matched a PDF)
//   parity-sheet2-pdf.csv     parser-extracted cells, same row order
//   parity-sheet3-diff.csv    per-cell MATCH / MISMATCH + mismatch_detail
//   parity-summary.md         headline numbers
//
// Usage:
//   node schema/scripts/csv-pdf-parity.mjs
//   node schema/scripts/csv-pdf-parity.mjs --csv <path> --pdf-root <dir>
//   node schema/scripts/csv-pdf-parity.mjs --only <substring>         # filter EPDs by substring of canonical id
//   node schema/scripts/csv-pdf-parity.mjs --no-write                 # console summary only

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, basename } from "node:path";

import { BEAM_COLUMNS, cellValue, getPath } from "../../js/shared/beam-columns.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = resolve(__dirname, "..");
const REPO_ROOT  = resolve(__dirname, "..", "..");
const DEFAULT_CSV = join(REPO_ROOT, "docs", "csv files from BEAM", "ART Database - Materials.csv");
const DEFAULT_PDF_ROOT = join(REPO_ROOT, "docs", "PDF References", "Confirmed EPDs (as listed in BEAM)");
const DEFAULT_OUT_DIR = join(REPO_ROOT, "docs", "workplans", "parity-B");
const LOOKUPS_DIR = join(SCHEMA_DIR, "lookups");
const EXTRACT_MJS = join(REPO_ROOT, "js", "epd", "extract.mjs");

// Positive "EPD-extractable" column list — the canonical scope for Parity B,
// authored by Andy 2026-06-08 (§19). Anything NOT in this set is silently out
// of the parity %: BfCA-internal (A, C–F, M, P), BfCA-curated naming (B),
// BfCA-derived units/values (S, T, U, V, AC, AF), BfCA-computational biogenic
// block (W, X, Y, Z, AB, AE), BfCA taxonomy (AU, AV, AW), internal footnote
// (H), and structural placeholders (AA, AD, AX). The harness still emits
// every DUMP column in the output sheets so column positions stay aligned
// with the BEAM spreadsheet; the COMPARE_COLS_SET only governs the parity %.
const COMPARE_COLS_SET = new Set([
  // Identification + provenance (free-text / dates, EPD-derivable)
  "G",  // EPD Expiry
  "I",  // Material
  "J",  // Manufacturer
  "K",  // Product Brand Name
  "L",  // Specifications
  "N",  // Countries of Manufacture
  "O",  // Markets of Applicability
  // Stated carbon (EPD's own headline number + declared unit)
  "Q",  // Stated EPD kgCO2e / unit
  "R",  // GWP units kgCO2e per
  // Biogenic — only the column that is EXPLICITLY EPD-stated (per its name).
  // X/Y/Z/AB/AC/AE/AF stay out: BfCA reference lookups + per-material defaults
  // + derivations from inputs, not directly EPD-stated values.
  "W",  // GWP-bio from EPD kg CO2e / common unit
  // Physical (density, factors, thermal, mass, dimensions)
  "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS",
  // Classification (HITL-readable per Andy; AU/AV/AW excluded — BfCA taxonomy)
  "AT",
  // EPD metadata block — capture wherever available (Andy 2026-06-08):
  //   AY EPD ID · AZ EPD Type · BA Owner · BB Prepared by · BC Program Operator ·
  //   BD Validation · BE Verifier · BF Standards · BG PCR · BH LCA Method ·
  //   BI LCA Software · BJ LCI Database · BK Service Life
  // BL Source document URL excluded — not always listed on the EPD itself.
  "AY", "AZ", "BA", "BB", "BC", "BD", "BE", "BF", "BG", "BH", "BI", "BJ", "BK"
]);

// ---------------------------------------------------------------------------
// Minimal CSV tokeniser + cell readers (parity with csv-json-parity.mjs).
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (rows.length && rows[rows.length - 1].every(f => f === "")) rows.pop();
  return rows;
}
function colToIdx(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
function evalArithmeticFormula(formula, row, depth = 0) {
  if (depth > 8) return null;
  let expr = formula.startsWith("=") ? formula.slice(1) : formula;
  if (!/^[A-Z0-9.()*/+\-\s]+$/.test(expr)) return null;
  expr = expr.replace(/([A-Z]+)(\d+)/g, (_m, letters) => {
    const v = row[colToIdx(letters)];
    if (v === undefined || v === "") return "0";
    const s = String(v).trim();
    if (s.startsWith("=")) {
      const inner = evalArithmeticFormula(s, row, depth + 1);
      return Number.isFinite(inner) ? String(inner) : "0";
    }
    const n = Number(s);
    return Number.isFinite(n) ? String(n) : "0";
  });
  try {
    const val = Function(`"use strict"; return (${expr});`)();
    return Number.isFinite(val) ? val : null;
  } catch { return null; }
}
function rawCell(row, col) { const v = row[colToIdx(col)]; return v === undefined ? "" : v; }
function readStrCsv(row, col) { const v = rawCell(row, col).trim(); return v === "" ? null : v; }
function readNumCsv(row, col) {
  const v = rawCell(row, col).trim();
  if (v === "") return null;
  if (v.startsWith("=")) {
    if (v.includes("IFERROR") || v.includes("DUMMYFUNCTION")) return null;
    return evalArithmeticFormula(v, row);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// EPD-ID canonicalization (§16.1.1) — used both for CSV col AY and PDF filename.
// ---------------------------------------------------------------------------
function canonicalEpdId(s) {
  if (s === null || s === undefined) return "";
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// PDF filename → EPD ID. Convention: "<EPD ID> - <title>.pdf".
// Strip the ".pdf" extension, split on the first " - " (space-hyphen-space),
// return the prefix. Examples:
//   "EPD10312 - 5_8-TR-FG-C-Gypsum-Panel.pdf"     → "EPD10312"
//   "SCS-EPD-07526 - SCS-EPD_RedBuilt_OpenWeb.pdf" → "SCS-EPD-07526"
//   "4789410886.101.1 - nafa_epd.pdf"             → "4789410886.101.1"
function epdIdFromFilename(filename) {
  const stem = filename.replace(/\.pdf$/i, "");
  const idx = stem.indexOf(" - ");
  return idx > 0 ? stem.substring(0, idx).trim() : stem.trim();
}

// CSV col reader for the "what BEAM has populated" check. Mirrors the cellValue
// formatter on the parser side: arrays/booleans handled, num/str/unit kinds
// preserve type for comparison.
function readBeamCell(row, c) {
  if (c.kind === "num") {
    let v = readNumCsv(row, c.col);
    if (v !== null && c.round !== undefined) v = Math.round(v * 10 ** c.round) / 10 ** c.round;
    return v;
  }
  return readStrCsv(row, c.col);
}

// ---------------------------------------------------------------------------
// §18 in-harness normalization. Fills the canonical DUMP-aligned paths from
// the extractor's divergent ones when the canonical slot is empty. Idempotent,
// non-destructive (only fills when the target is null/undefined).
//
// Density: extractor writes physical.density.value_kg_m3; DUMP reads
//   physical.density.value + .units (AG/AH). Map kg/m³ → value + "kg/m3".
// GWP:     extractor writes impacts.gwp_kgco2e.total.value (per declared unit);
//   DUMP reads carbon.stated.value_kgco2e (Q). Same semantic = per declared
//   unit. carbon.common.value_kgco2e (S) is BfCA-converted; the parser can't
//   produce S without the conversion divisor — leave S empty.
// ---------------------------------------------------------------------------
function normalizeForDumpCompare(rec) {
  if (!rec) return rec;
  const r = JSON.parse(JSON.stringify(rec));
  const phy = r.physical = r.physical || {};
  const dens = phy.density = phy.density || {};
  if (dens.value_kg_m3 != null && dens.value == null) {
    dens.value = dens.value_kg_m3;
    if (!dens.units) dens.units = "kg/m3";
    if (dens.value_lb_ft3 == null) dens.value_lb_ft3 = Math.round(dens.value_kg_m3 * 0.06243 * 100) / 100;
  }
  const imp = r.impacts || {};
  const gwpVal = imp.gwp_kgco2e && imp.gwp_kgco2e.total && imp.gwp_kgco2e.total.value;
  const carbon = r.carbon = r.carbon || {};
  const stated = carbon.stated = carbon.stated || {};
  if (gwpVal != null && stated.value_kgco2e == null) stated.value_kgco2e = gwpVal;
  // W GWP-bio from EPD — parallel to GWP mapping above. Parser writes
  // impacts.gwp_bio_kgco2e.total.value (per declared unit); DUMP reads
  // carbon.biogenic.gwp_bio_from_epd_kgco2e_per_common_unit. Map them.
  const gwpBioVal = imp.gwp_bio_kgco2e && imp.gwp_bio_kgco2e.total && imp.gwp_bio_kgco2e.total.value;
  const biogenic = carbon.biogenic = carbon.biogenic || {};
  if (gwpBioVal != null && biogenic.gwp_bio_from_epd_kgco2e_per_common_unit == null) {
    biogenic.gwp_bio_from_epd_kgco2e_per_common_unit = gwpBioVal;
  }
  return r;
}

// ---------------------------------------------------------------------------
// Per-column comparison relaxations (Andy 2026-06-08 directive: the metric
// should reflect semantic match, not penalize parser for BEAM's variable
// representations of the same value). These do NOT loosen what gets into
// the DB — they correct the parity METRIC for known-equivalent forms:
//   substring : either side a substring of the other after trim+casefold
//               (BC operator: "ASTM" ≡ "ASTM International")
//   yearPrefix: BEAM = "YYYY" + parser starts "YYYY-…" → match
//               (BEAM stores year-only expiry; parser has full ISO date)
// ---------------------------------------------------------------------------
const RELAXED_BY_COL = {
  G:  "yearPrefix",  // EPD Expiry — BEAM has year-only, parser has full date
  BC: "substring",   // Program Operator — BEAM "ASTM" ⊂ parser "ASTM International"
  BF: "substring",   // Standards — BEAM stores one citation, parser may have a list
  BG: "substring",   // PCR — BEAM and parser may have different framing of same PCR
  BA: "substring",   // EPD Owner — same org under variants
  BB: "substring",   // Prepared by — same org under variants
  BE: "substring",   // Verifier — same org under variants
  BH: "substring",   // LCA Method — substring tolerance on method names
  BI: "substring",   // LCA Software — same tool with/without version
  BJ: "substring",   // LCI Database — same DB with/without version
  J:  "substring",   // Manufacturer — short name ⊂ full legal name
  AT: "substring",   // Material Type — "Clay Brick" ⊃ "Brick", "Cross-laminated timber" ⊃ "CLT"
  N:  "substring",   // Countries of Manufacture — "Canada" ⊃ "CAN", "USA" ⊃ "US"
  O:  "substring",   // Markets — "US & CA" partial overlap with parser's ISO arrays
  R:  "unitNorm",    // GWP units per — BEAM "m3"/"m²"/"kg" vs parser "1 m³"/"1 cubic meter"
  AK: "numericApprox", // R-value/inch — BEAM rounds to 1-2dp; parser computes from λ (R/inch ≈ 0.1442/λ)
  AL: "numericApprox"  // Thermal conductivity W/(mK) — BEAM rounds; EPDs vary in precision
};

// Normalize a declared-unit string for comparison: case-fold, fold ³→3 / ²→2,
// strip a leading "1 " / "1.0 " quantity prefix, and rewrite English unit prose
// to the short BEAM form (cubic meter → m3, square metre → m2). Keep
// "metric ton" as-is (not the same as kg — 1 t = 1000 kg, so collapsing would
// generate false matches between BEAM "kg" and parser "1 metric ton").
function normalizeUnitForCompare(s) {
  if (s === null || s === undefined) return "";
  let x = String(s).trim().toLowerCase();
  x = x.replace(/³/g, "3").replace(/²/g, "2");
  x = x.replace(/^1(?:\.0+)?\s+/, "");
  x = x.replace(/cubic\s+met(?:re|er)s?/g, "m3");
  x = x.replace(/square\s+met(?:re|er)s?/g, "m2");
  x = x.replace(/metric\s+tonnes?|metric\s+tons?|tonnes?/g, "metric ton");
  x = x.replace(/\s+/g, " ").trim();
  return x;
}

// ---------------------------------------------------------------------------
// Cell comparison: ±0.5% relative + 0.01 absolute floor for numbers; trim +
// case-insensitive for strings; trim + case-insensitive for enums (Andy
// 2026-06-08 — semantic categories shouldn't differ by case); trim + exact
// for units/ids. Per-column `relaxed` hints layered on top of base equality.
// ---------------------------------------------------------------------------
function compareCell(c, csvVal, pdfVal) {
  const a = csvVal === undefined ? null : csvVal;
  const b = pdfVal === undefined ? null : pdfVal;
  if (a === null && b === null) return { verdict: "MATCH", delta: null };
  if (a === null || b === null) return { verdict: "MISMATCH", delta: `beam=${fmt(a)} pdf=${fmt(b)}` };
  if (c.kind === "num") {
    const na = Number(a), nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) {
      return na === nb ? { verdict: "MATCH", delta: null } : { verdict: "MISMATCH", delta: `beam=${fmt(a)} pdf=${fmt(b)}` };
    }
    const diff = Math.abs(na - nb);
    const tol = Math.max(0.005 * Math.max(Math.abs(na), Math.abs(nb)), 0.01);
    if (diff <= tol) return { verdict: "MATCH", delta: null };
    const d = nb - na;
    return { verdict: "MISMATCH", delta: `Δ=${d > 0 ? "+" : ""}${round4(d)} (beam=${round4(na)} pdf=${round4(nb)})` };
  }
  let sa = String(a).trim(), sb = String(b).trim();
  // Case-insensitive by default (str, enum, derived/unkeyed) — semantic
  // categories shouldn't differ by case. Only "unit" stays case-exact
  // ("kg/m2" ≠ "KG/M2" is a real meaning difference for units).
  if (c.kind !== "unit") {
    sa = sa.toLowerCase();
    sb = sb.toLowerCase();
  }
  if (sa === sb) return { verdict: "MATCH", delta: null };

  // Per-column relaxations (semantic equivalence, not loosening).
  const relaxed = RELAXED_BY_COL[c.col];
  if (relaxed === "substring" && sa.length >= 2 && sb.length >= 2) {
    // Already case-folded above for str; do it explicitly for unit/id too
    const la = sa.toLowerCase(), lb = sb.toLowerCase();
    if (la.includes(lb) || lb.includes(la)) {
      return { verdict: "MATCH", delta: null };
    }
  }
  if (relaxed === "yearPrefix") {
    // BEAM commonly stores "YYYY" or "YYYY-MM" for expiry; parser stores
    // full ISO. Accept if BEAM is a year/year-month prefix of parser's date,
    // or vice versa (the rarer case).
    const ya = /^\d{4}(-\d{2})?$/.exec(sa);
    const yb = /^\d{4}(-\d{2})?$/.exec(sb);
    if (ya && sb.startsWith(sa)) return { verdict: "MATCH", delta: null };
    if (yb && sa.startsWith(sb)) return { verdict: "MATCH", delta: null };
  }
  if (relaxed === "unitNorm") {
    // Declared/functional unit string. BEAM stores the bare short form ("m3",
    // "m²", "kg"); parser captures the EPD's prose ("1 m³", "1 cubic meter",
    // "The declared unit is 1 cubic metre of ready mixed concrete…"). Same
    // semantic fact — fold to a common form, then substring-tolerate.
    const ua = normalizeUnitForCompare(sa);
    const ub = normalizeUnitForCompare(sb);
    if (ua.length >= 2 && ub.length >= 2 && (ua === ub || ua.includes(ub) || ub.includes(ua))) {
      return { verdict: "MATCH", delta: null };
    }
  }
  if (relaxed === "numericApprox") {
    // Number stored as string; accept ±5% relative + 0.01 absolute floor.
    // For AK/AL the BEAM value is hand-picked (industry-average thickness,
    // rounded to 1-2dp) while the parser computes from λ — exact string
    // match is unrealistic but agreement within 5% is the right semantic.
    const na = parseFloat(sa);
    const nb = parseFloat(sb);
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      const tol = Math.max(0.05 * Math.max(Math.abs(na), Math.abs(nb)), 0.01);
      if (Math.abs(na - nb) <= tol) return { verdict: "MATCH", delta: null };
    }
  }
  return { verdict: "MISMATCH", delta: `beam=${fmt(a)} pdf=${fmt(b)}` };
}
function fmt(v) { return v === null ? "∅" : `"${String(v).slice(0, 40)}"`; }
function round4(n) { return Math.round(n * 10000) / 10000; }
function csvEsc(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsvOut(header, rows) { return [header, ...rows].map(r => r.map(csvEsc).join(",")).join("\n") + "\n"; }

// ---------------------------------------------------------------------------
// CSV loader — group rows by canonical EPD ID.
// ---------------------------------------------------------------------------
async function loadCsvByEpdId(csvPath) {
  const text = await readFile(csvPath, "utf8");
  const rows = parseCsv(text);
  if (rows[0][0] !== "ID") { console.error("Unexpected CSV header; first cell:", JSON.stringify(rows[0][0])); process.exit(1); }
  const byEpdId = new Map();   // canonical-id → [{beamId, row}]
  let totalRows = 0, withEpdId = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(f => !f)) continue;
    const beamId = (row[0] || "").trim();
    if (!beamId) continue;
    totalRows++;
    const epdIdRaw = readStrCsv(row, "AY");
    if (!epdIdRaw) continue;
    withEpdId++;
    const key = canonicalEpdId(epdIdRaw);
    if (!byEpdId.has(key)) byEpdId.set(key, []);
    byEpdId.get(key).push({ beamId, epdIdRaw, row });
  }
  return { byEpdId, totalRows, withEpdId };
}

// ---------------------------------------------------------------------------
// PDF folder loader — group files by canonical EPD ID (from filename prefix).
// ---------------------------------------------------------------------------
async function loadPdfsByEpdId(pdfRoot) {
  if (!existsSync(pdfRoot)) {
    console.error("PDF root not found:", pdfRoot);
    process.exit(1);
  }
  const all = await readdir(pdfRoot);
  const pdfs = all.filter(f => /\.pdf$/i.test(f)).sort();
  const byEpdId = new Map();
  for (const f of pdfs) {
    const raw = epdIdFromFilename(f);
    const key = canonicalEpdId(raw);
    if (!key) continue;
    if (!byEpdId.has(key)) byEpdId.set(key, []);
    byEpdId.get(key).push({ filename: f, rawId: raw, path: join(pdfRoot, f) });
  }
  return { byEpdId, fileCount: pdfs.length };
}

// ---------------------------------------------------------------------------
// PDF parsing (mirrors test-epd-extract.mjs).
// ---------------------------------------------------------------------------
async function loadPdfjs() { return await import("pdfjs-dist/legacy/build/pdf.mjs"); }
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
      return { str: it.str, x: tx[4], y: viewport.height - tx[5], width: it.width };
    });
    pageTexts.push(spatialJoinLines(items));
  }
  await doc.destroy();
  return { pageTexts, pageCount: doc.numPages };
}

async function primeExtract(Extract) {
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
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { csv: DEFAULT_CSV, pdfRoot: DEFAULT_PDF_ROOT, outDir: DEFAULT_OUT_DIR, write: true, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--csv") a.csv = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--pdf-root") a.pdfRoot = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--out-dir") a.outDir = resolve(process.cwd(), argv[++i]);
    else if (argv[i] === "--no-write") a.write = false;
    else if (argv[i] === "--only") a.only = argv[++i].toLowerCase();
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("=== Parity B — BEAM CSV ↔ EPD-parser extraction ===");
  console.log(`CSV:       ${args.csv}`);
  console.log(`PDF root:  ${args.pdfRoot}`);

  const { byEpdId: csvByEpd, totalRows, withEpdId } = await loadCsvByEpdId(args.csv);
  const { byEpdId: pdfByEpd, fileCount } = await loadPdfsByEpdId(args.pdfRoot);

  console.log(`CSV rows: ${totalRows}   with epd.id: ${withEpdId}   distinct canonical epd.ids: ${csvByEpd.size}`);
  console.log(`PDFs:     ${fileCount}   distinct canonical epd.ids: ${pdfByEpd.size}`);

  // Intersection: EPD IDs we can actually score (have both a CSV row and a PDF).
  const matchedKeys = [...csvByEpd.keys()].filter(k => pdfByEpd.has(k));
  const csvOnly = [...csvByEpd.keys()].filter(k => !pdfByEpd.has(k));
  const pdfOnly = [...pdfByEpd.keys()].filter(k => !csvByEpd.has(k));
  const scoredKeys = args.only ? matchedKeys.filter(k => k.includes(args.only)) : matchedKeys;
  console.log(`Matched (in both): ${matchedKeys.length} EPD IDs   CSV-only: ${csvOnly.length}   PDF-only: ${pdfOnly.length}`);
  if (args.only) console.log(`--only filter: ${scoredKeys.length} EPDs match "${args.only}"`);

  const beamRowsCovered = scoredKeys.reduce((a, k) => a + csvByEpd.get(k).length, 0);
  const beamRowsExcluded = totalRows - beamRowsCovered;
  console.log(`BEAM rows in scope (sum across matched EPDs): ${beamRowsCovered}   excluded (no PDF): ${beamRowsExcluded}`);
  if (scoredKeys.length === 0) { console.error("Nothing to compare. Bailing."); process.exit(1); }

  // Parse each matched PDF once, cache the normalized record by canonical id.
  // If multiple PDFs share an id (rare, but possible: e.g., a renamed copy),
  // we take the first; the rest log a warning but don't fail the run.
  console.log("\nParsing PDFs (one per EPD ID)…");
  const pdfjs = await loadPdfjs();
  const Extract = await import(EXTRACT_MJS);
  await primeExtract(Extract);

  const recordByEpd = new Map();  // canonical-id → { rec, biogenicEligible }
  const parseErrors = [];          // {key, file, err}
  let parsed = 0;
  for (const key of scoredKeys) {
    const entry = pdfByEpd.get(key)[0];
    if (pdfByEpd.get(key).length > 1) {
      console.warn(`  ⚠ multiple PDFs for canonical id "${key}" — using first: ${entry.filename}`);
    }
    parsed++;
    if (parsed % 25 === 0 || parsed === scoredKeys.length) {
      process.stdout.write(`  ${parsed}/${scoredKeys.length}\r`);
    }
    let extracted, result;
    try {
      extracted = await extractFromPdf(pdfjs, entry.path);
      result = Extract.extract(extracted.pageTexts);
    } catch (err) {
      parseErrors.push({ key, file: entry.filename, err: err.message });
      continue;
    }
    // Andy's W rule (2026-06-08): the "biogenic" word in the EPD is the
    // tell — steel/inorganic products won't carry a biogenic value, so
    // expecting parser to find W for them is wrong. Mark each EPD's
    // biogenic eligibility off the raw text and gate W comparison on it.
    const fullText = (extracted.pageTexts || []).join("\n");
    const biogenicEligible = /\bbiogenic\b/i.test(fullText);
    recordByEpd.set(key, { rec: normalizeForDumpCompare(result.record || {}), biogenicEligible });
  }
  console.log(`\nParsed: ${parsed - parseErrors.length} ok, ${parseErrors.length} failed`);

  // Per-row comparison. Iterate BEAM rows under each matched EPD ID; the
  // parser's single record compares against every BEAM row sharing that ID
  // (multi-product: rows under the same EPD will have different per-product
  // values; mismatches there are expected and reported as such).
  const COMPARE_COLS = BEAM_COLUMNS.filter(c => COMPARE_COLS_SET.has(c.col) && (c.path || c.get));
  const rowResults = [];     // per (beam_id, key) — used for sheet output and aggregates
  // Keyed by `c.col` (the spreadsheet letter) because BEAM_COLUMNS doesn't
  // carry a per-field id; `c.col` is unique across the descriptor list.
  const fieldMatchCount = {}; const fieldPopCount = {};
  for (const c of COMPARE_COLS) { fieldMatchCount[c.col] = 0; fieldPopCount[c.col] = 0; }
  let wSkipped = 0; // count of W cells skipped per Andy's biogenic rule

  for (const key of scoredKeys) {
    const cached = recordByEpd.get(key);
    if (!cached) continue; // parse failed
    const rec = cached.rec;
    const biogenicEligible = cached.biogenicEligible;
    const beamRows = csvByEpd.get(key);
    for (const { beamId, epdIdRaw, row } of beamRows) {
      const cells = COMPARE_COLS.map(c => {
        const csvVal = readBeamCell(row, c);
        const pdfVal = c.get ? c.get(rec) : (() => {
          const v = getPath(rec, c.path);
          if (Array.isArray(v)) return v.join(", ");
          return v == null ? null : v;
        })();
        const csvPopulated = csvVal !== null && csvVal !== undefined && csvVal !== "";
        // Andy's W rule: if BEAM has W populated but the EPD text doesn't
        // mention "biogenic", the row isn't biogenic-eligible — skip W from
        // the denominator (don't count as miss, don't count as match).
        if (c.col === "W" && csvPopulated && !biogenicEligible) {
          wSkipped++;
          return { c, csvVal, pdfVal, populated: false, verdict: "MATCH", delta: null, skipped: true };
        }
        const cmp = compareCell(c, csvVal, pdfVal);
        if (csvPopulated) {
          fieldPopCount[c.col]++;
          if (cmp.verdict === "MATCH") fieldMatchCount[c.col]++;
        }
        return { c, csvVal, pdfVal, populated: csvPopulated, ...cmp };
      });
      const populated = cells.filter(x => x.populated);
      const matched = populated.filter(x => x.verdict === "MATCH").length;
      const coverage = populated.length > 0 ? matched / populated.length : 1;
      rowResults.push({ key, beamId, epdIdRaw, row, cells, populatedCount: populated.length, matchedCount: matched, coverage });
    }
  }

  // ---- Aggregate stats ----
  const totalScoredRows = rowResults.length;
  const perfectRows = rowResults.filter(r => r.populatedCount > 0 && r.matchedCount === r.populatedCount).length;
  const totalPopulated = rowResults.reduce((a, r) => a + r.populatedCount, 0);
  const totalMatched = rowResults.reduce((a, r) => a + r.matchedCount, 0);
  const avgCoverage = totalScoredRows > 0 ? rowResults.reduce((a, r) => a + r.coverage, 0) / totalScoredRows : 0;

  const fieldRank = COMPARE_COLS.map(c => ({
    col: c.col, label: c.label, kind: c.kind || "str",
    pop: fieldPopCount[c.col], match: fieldMatchCount[c.col],
    rate: fieldPopCount[c.col] > 0 ? fieldMatchCount[c.col] / fieldPopCount[c.col] : null
  })).filter(x => x.pop > 0).sort((a, b) => (b.rate || 0) - (a.rate || 0));

  // Per-EPD product fan-out — surfaces the multi-product gap.
  const epdFanOut = new Map();
  for (const r of rowResults) {
    if (!epdFanOut.has(r.key)) epdFanOut.set(r.key, []);
    epdFanOut.get(r.key).push(r);
  }
  const multiProductEpds = [...epdFanOut.entries()].filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({
      key,
      n: rows.length,
      avg: rows.reduce((a, r) => a + r.coverage, 0) / rows.length,
      spread: Math.max(...rows.map(r => r.coverage)) - Math.min(...rows.map(r => r.coverage))
    }))
    .sort((a, b) => b.n - a.n);

  // ---- Console summary ----
  const pct = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : "—";
  console.log("");
  console.log(`Scored BEAM rows: ${totalScoredRows} (across ${scoredKeys.length} matched EPD IDs)`);
  console.log(`Rows at 100% parity:    ${perfectRows}/${totalScoredRows} (${pct(perfectRows, totalScoredRows)})`);
  console.log(`Aggregate cell parity:  ${totalMatched}/${totalPopulated} (${pct(totalMatched, totalPopulated)})  [populated BEAM cells, EPD-comparable columns only]`);
  if (wSkipped > 0) console.log(`  (W skipped on ${wSkipped} rows where the EPD text doesn't mention "biogenic" — Andy 2026-06-08)`);
  console.log(`Average per-row coverage: ${(avgCoverage * 100).toFixed(1)}%`);
  console.log("");
  console.log("Per-field match rate (desc), among populated BEAM cells:");
  for (const f of fieldRank) {
    console.log(`  ${(f.rate * 100).toFixed(1).padStart(5)}%  ${String(f.match).padStart(4)}/${String(f.pop).padEnd(4)}  ${f.col.padEnd(3)} ${f.label} [${f.kind}]`);
  }
  if (multiProductEpds.length) {
    console.log(`\nMulti-product EPDs (one PDF → >1 BEAM row) — coverage spread signals multi-product gap:`);
    for (const m of multiProductEpds.slice(0, 10)) {
      console.log(`  ${String(m.n).padStart(3)} rows  avg ${(m.avg * 100).toFixed(1)}%  spread ${(m.spread * 100).toFixed(1)}pp  ${m.key.slice(0, 40)}`);
    }
  }
  if (parseErrors.length) {
    console.log(`\nParse errors (${parseErrors.length}):`);
    for (const e of parseErrors.slice(0, 8)) console.log(`  ${e.file}  →  ${e.err.slice(0, 60)}`);
  }
  if (csvOnly.length) console.log(`\nCSV-only canonical epd.ids (no PDF, sample 8): ${csvOnly.slice(0, 8).join(", ")}${csvOnly.length > 8 ? " …" : ""}`);
  if (pdfOnly.length) console.log(`PDF-only canonical epd.ids (no BEAM row, sample 8): ${pdfOnly.slice(0, 8).join(", ")}${pdfOnly.length > 8 ? " …" : ""}`);

  if (!args.write) return;

  // ---- Sheets + summary ----
  if (!existsSync(args.outDir)) await mkdir(args.outDir, { recursive: true });

  // Sheets include ALL BEAM_COLUMNS so column positions match the DUMP
  // (skipped columns just appear empty). Diff-sheet cells for skipped
  // columns are "—" so reviewers don't misread them as MISMATCH.
  const ALL_LABELS = BEAM_COLUMNS.map(c => c.label);
  const sheet1Header = ["beam_id", "epd_id_raw", ...ALL_LABELS];
  const sheet2Header = ["beam_id", "epd_id_raw", ...ALL_LABELS];
  const sheet3Header = ["beam_id", "epd_id_raw", ...ALL_LABELS, "row_coverage_pct", "mismatch_detail"];
  const s1 = [], s2 = [], s3 = [];
  // Sort by canonical epd.id then beam_id so multi-product clusters land together.
  rowResults.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : (a.beamId < b.beamId ? -1 : 1)));
  for (const r of rowResults) {
    const cached = recordByEpd.get(r.key);
    const rec = cached ? cached.rec : {};
    const beamRow = BEAM_COLUMNS.map(c => {
      if (!COMPARE_COLS_SET.has(c.col) || (!c.path && !c.get)) return "";
      return readBeamCell(r.row, c);
    });
    const pdfRow = BEAM_COLUMNS.map(c => {
      if (!COMPARE_COLS_SET.has(c.col) || (!c.path && !c.get)) return "";
      return cellValue(rec, c);
    });
    s1.push([r.beamId, r.epdIdRaw, ...beamRow]);
    s2.push([r.beamId, r.epdIdRaw, ...pdfRow]);

    // Build per-column verdict, including skipped placeholders as "—"
    const verdicts = BEAM_COLUMNS.map(c => {
      if (!COMPARE_COLS_SET.has(c.col) || (!c.path && !c.get)) return "—";
      const cellRes = r.cells.find(x => x.c.col === c.col);
      if (!cellRes) return "—";
      if (!cellRes.populated) return "—";
      return cellRes.verdict;
    });
    const detail = r.cells.filter(x => x.populated && x.verdict === "MISMATCH")
      .map(m => `${m.c.label}: ${m.delta || "differ"}`).join(" | ");
    s3.push([r.beamId, r.epdIdRaw, ...verdicts, `${(r.coverage * 100).toFixed(1)}%`, detail]);
  }
  await writeFile(join(args.outDir, "parity-sheet1-beam.csv"), toCsvOut(sheet1Header, s1));
  await writeFile(join(args.outDir, "parity-sheet2-pdf.csv"), toCsvOut(sheet2Header, s2));
  await writeFile(join(args.outDir, "parity-sheet3-diff.csv"), toCsvOut(sheet3Header, s3));

  // ---- Markdown summary ----
  const md = [];
  md.push(`# Parity B — BEAM CSV ↔ EPD-parser extraction (Pass 1)\n`);
  md.push(`_Generated ${new Date().toISOString()} by \`schema/scripts/csv-pdf-parity.mjs\`._\n`);
  md.push(`For every BEAM CSV row whose \`epd.id\` matches a PDF in the folder, this harness parses the PDF and compares the parser's extracted values against the populated BEAM cells per field. Tolerances: numbers ±0.5% + 0.01 absolute floor; strings trim + case-insensitive; units trim + exact. **Scoring scope** (Andy 2026-06-08, §19): only the EPD-extractable columns are in the parity %. Counted: \`${[...COMPARE_COLS_SET].join(", ")}\`. Out-of-scope (BfCA-internal flags, BfCA-derived units/values, BfCA-computational biogenic block, BfCA taxonomy, internal notation, structural placeholders): everything else.\n`);
  md.push(`## Coverage\n`);
  md.push(`| | count |`);
  md.push(`|---|---:|`);
  md.push(`| CSV total rows | ${totalRows} |`);
  md.push(`| CSV rows with \`epd.id\` | ${withEpdId} |`);
  md.push(`| CSV distinct canonical \`epd.id\` | ${csvByEpd.size} |`);
  md.push(`| PDFs in folder | ${fileCount} |`);
  md.push(`| PDFs distinct canonical \`epd.id\` | ${pdfByEpd.size} |`);
  md.push(`| **EPDs matched in both** | **${matchedKeys.length}** |`);
  md.push(`| **BEAM rows scored** | **${totalScoredRows}** |`);
  md.push(`| BEAM rows excluded (no PDF) | ${beamRowsExcluded} |`);
  md.push(`| PDF-only (no BEAM row) | ${pdfOnly.length} |`);
  md.push(`| Parse errors | ${parseErrors.length} |\n`);
  md.push(`## Parity\n`);
  md.push(`- Rows at **100% parity**: **${perfectRows}/${totalScoredRows}** (${pct(perfectRows, totalScoredRows)})`);
  md.push(`- Aggregate cell parity (EPD-comparable columns, populated BEAM cells): **${totalMatched}/${totalPopulated}** (${pct(totalMatched, totalPopulated)})`);
  md.push(`- Average per-row coverage: **${(avgCoverage * 100).toFixed(1)}%**\n`);
  md.push(`## Per-field match rate (descending)\n`);
  md.push(`Sorted by match rate — top fields are reliable extractions; bottom fields are the extractor gaps to chase (and good candidates for Goal-B form expansion).\n`);
  md.push(`| col | field | kind | match / populated | rate |`);
  md.push(`|---|---|---|---:|---:|`);
  for (const f of fieldRank) md.push(`| ${f.col} | ${f.label} | ${f.kind} | ${f.match} / ${f.pop} | ${pct(f.match, f.pop)} |`);
  if (multiProductEpds.length) {
    md.push(`\n## Multi-product fan-out (§16.1 Follow-up #4)\n`);
    md.push(`Each EPD below maps to >1 BEAM row but the parser emits one record per PDF — spread between min/max row coverage signals product-variant mismatch under the same EPD.\n`);
    md.push(`| canonical epd.id | rows | avg coverage | spread |`);
    md.push(`|---|---:|---:|---:|`);
    for (const m of multiProductEpds.slice(0, 30)) md.push(`| ${m.key} | ${m.n} | ${(m.avg * 100).toFixed(1)}% | ${(m.spread * 100).toFixed(1)}pp |`);
  }
  if (parseErrors.length) {
    md.push(`\n## Parse errors (${parseErrors.length})\n`);
    md.push(`| file | error |`);
    md.push(`|---|---|`);
    for (const e of parseErrors) md.push(`| ${e.file} | ${e.err.replace(/\|/g, "/").slice(0, 80)} |`);
  }
  if (csvOnly.length) {
    md.push(`\n## CSV-only canonical \`epd.id\`s (no PDF found — excluded from parity)\n`);
    md.push(`${csvOnly.length} EPD IDs in the BEAM CSV have no matching PDF in the folder. Sample (first 30): \`${csvOnly.slice(0, 30).join(", ")}\`${csvOnly.length > 30 ? " …" : ""}.\n`);
  }
  md.push(`\n## Sheets\n`);
  md.push(`- \`parity-sheet1-beam.csv\` — BEAM cell values for scored rows`);
  md.push(`- \`parity-sheet2-pdf.csv\` — parser-extracted values (same row order, full A→BL column shape; skipped columns left empty)`);
  md.push(`- \`parity-sheet3-diff.csv\` — per-cell \`MATCH\` / \`MISMATCH\` / \`—\` grid + per-row \`row_coverage_pct\` + \`mismatch_detail\``);

  await writeFile(join(args.outDir, "parity-summary.md"), md.join("\n"));
  console.log(`\nWrote 3 sheets + parity-summary.md → ${args.outDir}`);
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
