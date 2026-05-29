#!/usr/bin/env node
// csv-json-parity.mjs — Parity A: BEAM CSV (upstream source) ↔ JSON catalogue (derived runtime SST).
//
// Question answered: "Is beam-csv-to-json.mjs's import faithful — do the values in
// schema/materials/*.json still match the source BEAM Database-DUMP.csv, cell by cell?"
//
// The harness reads the source CSV cells INDEPENDENTLY (its own minimal reader, not
// the importer's) and diffs against the committed JSON. That independence is the point:
// an import bug (e.g. the 2026-05-19 density-units bug, where the importer dropped the
// Density-Units column and stamped every value kg/m³) surfaces here as a MISMATCH,
// whereas a "re-run the importer and compare" check would be trivially green.
//
// Deliverable (EPD-Parser.md §16): a 3-sheet workbook as three CSVs —
//   parity-sheet1-csv.csv   selected source-CSV values, one row per aligned record
//   parity-sheet2-json.csv  same columns / same row order, values read from the JSON
//   parity-sheet3-diff.csv  per-cell MATCH / MISMATCH grid (for GREEN/RED conditional
//                           formatting) + a mismatch_detail column with deltas
// Rows are clustered by canonicalized epd.id (primary) then BEAM ID (secondary) so each
// EPD's product set sits contiguously for human review (§16.1.1). BEAM ID is the first
// data column so individual rows stay findable.
//
// Zero-dep, Node ≥18. Independent of the EPD-extraction harness (test-epd-extract.mjs).
//
// Usage:
//   node schema/scripts/csv-json-parity.mjs                 # write sheets to docs/workplans/parity-A/
//   node schema/scripts/csv-json-parity.mjs --out-dir DIR   # custom output dir
//   node schema/scripts/csv-json-parity.mjs --no-write      # console summary only

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(__dirname, "..", "..");
const CSV_PATH = join(REPO_ROOT, "docs", "csv files from BEAM", "BEAM Database-DUMP.csv");
const MATERIALS_DIR = join(SCHEMA_DIR, "materials");

// ---------------------------------------------------------------------------
// Minimal RFC-4180 CSV tokeniser (own copy — keeps this harness decoupled).
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

// Same arithmetic-formula evaluation the importer applies to formula cells
// (e.g. col S `=Q545/11.249`). IFERROR/DUMMYFUNCTION cells → null (not numeric).
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

function rawCell(row, col) {
  const v = row[colToIdx(col)];
  return v === undefined ? "" : v;
}
function readStrCsv(row, col) {
  const v = rawCell(row, col).trim();
  return v === "" ? null : v;
}
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

// EPD-type enum: replicate the importer's keyword mapping on col AZ so the
// derived JSON enum can be compared back to its source string faithfully.
function epdTypeEnumFromRaw(raw) {
  if (!raw) return null;
  const lc = String(raw).toLowerCase();
  if (lc.includes("product")) return "product_specific";
  if (lc.includes("industry")) return "industry_average";
  if (lc.includes("generic")) return "generic";
  if (lc.includes("beam")) return "beam_average"; // matches importer's epdTypeEnum
  return null;
}

// Canonical key for grouping: strip to lowercase alphanumerics so
// "EPD 352" / "EPD352" / "epd-352" collapse to one blocking key (§16.1.1).
function canonicalEpdId(s) {
  if (s === null || s === undefined) return "";
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const path = (r, fn) => { try { return fn(r); } catch { return undefined; } };
const nn = v => (v === undefined || v === "" ? null : v);

// ---------------------------------------------------------------------------
// Comparison column set. CSV column letters are the importer's mapping (the
// authoritative CSV→JSON source); §16.2's 0-based numbers line up with these.
//   basis: verbatim = stored as-is; formula = CSV cell is a formula (eval, round 2dp);
//          derived = JSON value is computed, not a direct copy (mismatch ≠ import bug);
//          enum = JSON stores a mapped enum of the CSV string.
// NOTE: the external classification-code column (AX) is intentionally excluded
// (§9 IP guardrail) and the importer never reads it, so there is nothing to diff.
// ---------------------------------------------------------------------------
const COLUMNS = [
  { key: "beam_id",          label: "ID",                       col: "A",  kind: "id",   basis: "verbatim", json: r => path(r, x => x.external_refs.beam_id) },
  { key: "display_name",     label: "Display Name",             col: "B",  kind: "str",  basis: "verbatim", json: r => path(r, x => x.naming.display_name) },
  { key: "stated_gwp",       label: "Stated kgCO2e/unit",       col: "Q",  kind: "num",  basis: "verbatim", json: r => path(r, x => x.carbon.stated.value_kgco2e) },
  { key: "stated_unit",      label: "GWP units per",            col: "R",  kind: "str",  basis: "verbatim", json: r => path(r, x => x.carbon.stated.per_unit) },
  { key: "gwp_common",       label: "GWP/common unit",          col: "S",  kind: "num",  basis: "formula",  round: 2, json: r => path(r, x => x.carbon.common.value_kgco2e) },
  { key: "common_unit",      label: "Common unit",              col: "T",  kind: "str",  basis: "verbatim", json: r => path(r, x => x.carbon.common.per_functional_unit) },
  { key: "gwp_bio",          label: "GWP-bio from EPD",         col: "W",  kind: "num",  basis: "verbatim", json: r => path(r, x => x.carbon.biogenic.gwp_bio_from_epd_kgco2e_per_common_unit) },
  { key: "bio_storage",      label: "Biogenic Storage",         col: "Z",  kind: "num",  basis: "formula",  round: 2, json: r => path(r, x => x.carbon.biogenic.stored_kgco2e_per_common_unit) },
  { key: "cc_per_unit",      label: "Carbon content kgC/unit",  col: "AC", kind: "num",  basis: "derived",  json: r => path(r, x => x.carbon.biogenic.carbon_content_kgc_per_unit) },
  { key: "full_c",           label: "Full C value",             col: "AE", kind: "num",  basis: "derived",  round: 2, json: r => path(r, x => x.carbon.biogenic.full_carbon_kgco2e_per_common_unit) },
  { key: "storage_pct",      label: "Storage % Reduction",      col: "AF", kind: "num",  basis: "verbatim", json: r => path(r, x => x.carbon.biogenic.storage_retention_pct) },
  { key: "density",          label: "Density",                  col: "AG", kind: "num",  basis: "verbatim", json: r => path(r, x => x.physical.density.value) },
  { key: "density_units",    label: "Density Units",            col: "AH", kind: "unit", basis: "verbatim", json: r => path(r, x => x.physical.density.units) },
  { key: "addn_factor",      label: "Addnl factor",             col: "AI", kind: "num",  basis: "verbatim", json: r => path(r, x => x.physical.additional_factor.value) },
  { key: "addn_units",       label: "Addnl factor units",       col: "AJ", kind: "unit", basis: "verbatim", json: r => path(r, x => x.physical.additional_factor.units) },
  { key: "epd_id",           label: "EPD ID",                   col: "AY", kind: "str",  basis: "verbatim", json: r => path(r, x => x.epd.id) },
  { key: "epd_type",         label: "EPD Type",                 col: "AZ", kind: "enum", basis: "derived",  json: r => path(r, x => x.epd.type), csvNorm: epdTypeEnumFromRaw },
  { key: "program_operator", label: "EPD Program/Operator",     col: "BC", kind: "str",  basis: "verbatim", json: r => path(r, x => x.epd.program_operator) },
  { key: "service_life",     label: "Service Life (yr)",        col: "BK", kind: "num",  basis: "verbatim", json: r => path(r, x => x.epd.product_service_life_years) },
];

function readCsvValue(row, c) {
  if (c.kind === "num") {
    let v = readNumCsv(row, c.col);
    if (v !== null && c.round !== undefined) v = Math.round(v * 10 ** c.round) / 10 ** c.round;
    return v;
  }
  if (c.kind === "enum") return c.csvNorm(readStrCsv(row, c.col));
  return readStrCsv(row, c.col); // id / str / unit
}

// ---------------------------------------------------------------------------
// Cell comparison. Returns { verdict: "MATCH"|"MISMATCH", delta:string|null }.
// num   ±0.5% relative (abs floor 0.01); str  trim + case-insensitive;
// unit/id  trim, exact (case-sensitive); enum  exact.
// ---------------------------------------------------------------------------
function compareCell(c, csvVal, jsonVal) {
  const a = csvVal === undefined ? null : csvVal;
  const b = jsonVal === undefined ? null : jsonVal;
  if (a === null && b === null) return { verdict: "MATCH", delta: null };
  if (a === null || b === null) {
    return { verdict: "MISMATCH", delta: `csv=${fmt(a)} json=${fmt(b)}` };
  }
  if (c.kind === "num") {
    const na = Number(a), nb = Number(b);
    if (!Number.isFinite(na) || !Number.isFinite(nb)) {
      return na === nb ? { verdict: "MATCH", delta: null } : { verdict: "MISMATCH", delta: `csv=${fmt(a)} json=${fmt(b)}` };
    }
    const diff = Math.abs(na - nb);
    const tol = Math.max(0.005 * Math.max(Math.abs(na), Math.abs(nb)), 0.01);
    if (diff <= tol) return { verdict: "MATCH", delta: null };
    const d = nb - na;
    return { verdict: "MISMATCH", delta: `Δ=${d > 0 ? "+" : ""}${round4(d)} (csv=${round4(na)} json=${round4(nb)})` };
  }
  let sa = String(a).trim(), sb = String(b).trim();
  if (c.kind === "str") { sa = sa.toLowerCase(); sb = sb.toLowerCase(); }
  if (sa === sb) return { verdict: "MATCH", delta: null };
  return { verdict: "MISMATCH", delta: `csv=${fmt(a)} json=${fmt(b)}` };
}

function fmt(v) { return v === null ? "∅" : `"${String(v).slice(0, 40)}"`; }
function round4(n) { return Math.round(n * 10000) / 10000; }
function csvEsc(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(header, rows) {
  return [header, ...rows].map(r => r.map(csvEsc).join(",")).join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------
function loadCsvByBeamId() {
  const rows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const header = rows[0];
  if (header[0] !== "ID") { console.error("Unexpected CSV header; first cell:", JSON.stringify(header[0])); process.exit(1); }
  const byId = new Map();                       // id -> row[] (keeps every occurrence)
  let dataRows = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.every(f => !f)) continue;          // blank spacer row
    const id = (row[0] || "").trim();
    if (!id) continue;                          // blank ID
    dataRows++;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(row);
  }
  return { byId, dataRows };
}

function loadJsonByBeamId() {
  const files = readdirSync(MATERIALS_DIR).filter(f => /^[0-9].*\.json$/.test(f));
  const byId = new Map();                       // id -> {rec, file}[]
  let total = 0;
  for (const f of files) {
    const parsed = JSON.parse(readFileSync(join(MATERIALS_DIR, f), "utf8"));
    const recs = Array.isArray(parsed) ? parsed : (parsed.records || []);
    for (const r of recs) {
      total++;
      const bid = r.external_refs && r.external_refs.beam_id;
      if (!bid) continue;
      if (!byId.has(bid)) byId.set(bid, []);
      byId.get(bid).push({ rec: r, file: f });
    }
  }
  return { byId, total };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  let outDir = join(REPO_ROOT, "docs", "workplans", "parity-A");
  let write = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out-dir") outDir = resolve(argv[++i]);
    else if (argv[i] === "--no-write") write = false;
  }

  const { byId: csvById, dataRows } = loadCsvByBeamId();
  const { byId: jsonById, total: jsonTotal } = loadJsonByBeamId();

  // Duplicate beam_ids break the "beam_id is the unique key" assumption — the
  // CSV row ↔ JSON record pairing is ambiguous, so we report them as a distinct
  // finding and exclude them from the clean per-field diff rather than mispair.
  const dupCsv = [...csvById].filter(([, a]) => a.length > 1);
  const dupJson = [...jsonById].filter(([, a]) => a.length > 1);
  const dupIds = new Set([...dupCsv.map(x => x[0]), ...dupJson.map(x => x[0])]);

  const csvIds = new Set(csvById.keys());
  const jsonIds = new Set(jsonById.keys());
  const aligned = [...jsonIds].filter(id => csvIds.has(id) && !dupIds.has(id));
  const csvOnly = [...csvIds].filter(id => !jsonIds.has(id));
  const jsonOnly = [...jsonIds].filter(id => !csvIds.has(id));

  // Build per-record comparison, clustered by canonical epd.id then beam_id.
  const records = aligned.map(id => {
    const row = csvById.get(id)[0];
    const rec = jsonById.get(id)[0].rec;
    const epdIdRaw = readStrCsv(row, "AY") || path(rec, x => x.epd.id) || null;
    const cells = COLUMNS.map(c => {
      const csvVal = readCsvValue(row, c);
      const jsonVal = nn(c.json(rec));
      return { c, csvVal, jsonVal, ...compareCell(c, csvVal, jsonVal) };
    });
    const mismatches = cells.filter(x => x.verdict === "MISMATCH");
    return { id, epdIdRaw, epdKey: canonicalEpdId(epdIdRaw), cells, mismatches };
  });
  records.sort((a, b) => (a.epdKey < b.epdKey ? -1 : a.epdKey > b.epdKey ? 1 : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)));

  // Aggregate stats.
  const fullParity = records.filter(r => r.mismatches.length === 0).length;
  const withMismatch = records.length - fullParity;
  const fieldMiss = {};
  for (const c of COLUMNS) fieldMiss[c.key] = 0;
  for (const r of records) for (const m of r.mismatches) fieldMiss[m.c.key]++;
  const fieldRank = COLUMNS.map(c => ({ label: c.label, key: c.key, basis: c.basis, n: fieldMiss[c.key] }))
    .filter(x => x.n > 0).sort((a, b) => b.n - a.n);

  // Source-fidelity (verbatim/formula/enum) is the true import-bug detector;
  // derived columns (computed, not copied from the CSV) are reported apart so
  // their expected divergence doesn't drown the signal.
  const isDerived = c => c.basis === "derived";
  const fidCols = COLUMNS.filter(c => !isDerived(c));
  const derCols = COLUMNS.filter(isDerived);
  const fidRows = records.filter(r => r.mismatches.every(m => isDerived(m.c))).length;
  const fidCells = records.length * fidCols.length;
  const fidMiss = records.reduce((a, r) => a + r.mismatches.filter(m => !isDerived(m.c)).length, 0);
  const derCells = records.length * derCols.length;
  const derMiss = records.reduce((a, r) => a + r.mismatches.filter(m => isDerived(m.c)).length, 0);

  // Duplicate-collision detail (display names per side) for the report.
  const dupReport = [...dupIds].sort().map(id => ({
    id,
    csv: (csvById.get(id) || []).map(row => readStrCsv(row, "B")),
    json: (jsonById.get(id) || []).map(x => `${x.file}:${path(x.rec, r => r.naming.display_name)}`),
  }));

  // EPD grouping stats.
  const groupSizes = new Map();
  for (const r of records) groupSizes.set(r.epdKey, (groupSizes.get(r.epdKey) || 0) + 1);
  const multiGroups = [...groupSizes.entries()].filter(([k, n]) => k && n > 1).sort((a, b) => b[1] - a[1]);

  // ---- Console summary ----
  const pct = (n, d) => d ? `${(100 * n / d).toFixed(1)}%` : "—";
  const totalCells = records.length * COLUMNS.length;
  const totalMiss = Object.values(fieldMiss).reduce((a, b) => a + b, 0);
  console.log("=== Parity A — BEAM CSV ↔ JSON catalogue ===");
  console.log(`CSV data rows (non-blank ID): ${dataRows}   distinct IDs: ${csvIds.size}`);
  console.log(`JSON records: ${jsonTotal}   distinct beam_ids: ${jsonIds.size}`);
  console.log(`Aligned & compared (excl. dups): ${records.length}   CSV-only: ${csvOnly.length}   JSON-only: ${jsonOnly.length}   duplicate-id collisions: ${dupIds.size}`);
  console.log("");
  console.log(`SOURCE FIDELITY (verbatim/formula/enum — the import-bug detector):`);
  console.log(`  Rows clean: ${fidRows}/${records.length} (${pct(fidRows, records.length)})`);
  console.log(`  Cell parity: ${fidCells - fidMiss}/${fidCells} (${pct(fidCells - fidMiss, fidCells)})`);
  console.log(`DERIVED FIELDS (computed, not copied — divergence expected/informational):`);
  console.log(`  Cell parity: ${derCells - derMiss}/${derCells} (${pct(derCells - derMiss, derCells)})`);
  console.log(`OVERALL cell parity (all columns): ${totalCells - totalMiss}/${totalCells} (${pct(totalCells - totalMiss, totalCells)})`);
  console.log("");
  console.log("Mismatches by field (desc):");
  if (fieldRank.length === 0) console.log("  (none)");
  for (const f of fieldRank) console.log(`  ${String(f.n).padStart(4)}  ${f.label} [${f.basis}]`);
  if (dupReport.length) {
    console.log("\nDUPLICATE beam_id collisions (excluded from diff — beam_id must be unique):");
    for (const d of dupReport) console.log(`  ${d.id}  csv=[${d.csv.map(s => JSON.stringify((s || "").slice(0, 32))).join(", ")}]  json=[${d.json.map(s => JSON.stringify((s || "").slice(0, 40))).join(", ")}]`);
  }
  console.log("");
  console.log(`EPD grouping: ${groupSizes.size} distinct canonical epd.id among aligned; ${multiGroups.length} cover >1 product`);
  for (const [k, n] of multiGroups.slice(0, 8)) console.log(`  ${String(n).padStart(3)}  ${k.slice(0, 40)}`);
  if (csvOnly.length) console.log(`\nCSV-only sample: ${csvOnly.slice(0, 8).join(", ")}${csvOnly.length > 8 ? " …" : ""}`);
  if (jsonOnly.length) console.log(`JSON-only sample: ${jsonOnly.slice(0, 8).join(", ")}${jsonOnly.length > 8 ? " …" : ""}`);

  if (!write) return;

  // ---- Sheets ----
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const labels = COLUMNS.map(c => c.label);
  const sheet1Header = ["beam_id", "epd_id", ...labels];
  const sheet2Header = ["beam_id", "epd_id", ...labels];
  const sheet3Header = ["beam_id", "epd_id", ...labels, "mismatch_detail"];
  const s1 = [], s2 = [], s3 = [];
  for (const r of records) {
    s1.push([r.id, r.epdIdRaw, ...r.cells.map(x => x.csvVal)]);
    s2.push([r.id, r.epdIdRaw, ...r.cells.map(x => x.jsonVal)]);
    const detail = r.mismatches.map(m => `${m.c.label}: ${m.delta || "differ"}`).join(" | ");
    s3.push([r.id, r.epdIdRaw, ...r.cells.map(x => x.verdict), detail]);
  }
  writeFileSync(join(outDir, "parity-sheet1-csv.csv"), toCsv(sheet1Header, s1));
  writeFileSync(join(outDir, "parity-sheet2-json.csv"), toCsv(sheet2Header, s2));
  writeFileSync(join(outDir, "parity-sheet3-diff.csv"), toCsv(sheet3Header, s3));

  // ---- Markdown summary snapshot ----
  const md = [];
  md.push(`# Parity A — BEAM CSV ↔ JSON catalogue\n`);
  md.push(`_Generated ${new Date().toISOString()} by \`schema/scripts/csv-json-parity.mjs\`._\n`);
  md.push(`Compares the upstream source CSV (\`docs/csv files from BEAM/BEAM Database-DUMP.csv\`) against the derived runtime catalogue (\`schema/materials/*.json\`), field-by-field, for every BEAM ID present in both.\n`);
  md.push(`## Coverage\n`);
  md.push(`| | count |`);
  md.push(`|---|---:|`);
  md.push(`| CSV data rows (non-blank ID) | ${dataRows} |`);
  md.push(`| CSV distinct IDs | ${csvIds.size} |`);
  md.push(`| JSON records | ${jsonTotal} |`);
  md.push(`| JSON distinct beam_ids | ${jsonIds.size} |`);
  md.push(`| **Aligned & compared (excl. dups)** | **${records.length}** |`);
  md.push(`| CSV-only (not in catalogue) | ${csvOnly.length} |`);
  md.push(`| JSON-only (not in CSV) | ${jsonOnly.length} |`);
  md.push(`| Duplicate-id collisions (excluded) | ${dupIds.size} |\n`);
  md.push(`## Parity\n`);
  md.push(`**Source fidelity** — verbatim/formula/enum columns; this is the import-bug detector:\n`);
  md.push(`- Rows clean: **${fidRows}/${records.length}** (${pct(fidRows, records.length)})`);
  md.push(`- Cell parity: **${fidCells - fidMiss}/${fidCells}** (${pct(fidCells - fidMiss, fidCells)})\n`);
  md.push(`**Derived fields** — computed, not copied from the CSV; divergence is expected/informational (it is a QA signal of "catalogue's computed value vs the spreadsheet's own stated column", not an import bug):\n`);
  md.push(`- Cell parity: **${derCells - derMiss}/${derCells}** (${pct(derCells - derMiss, derCells)})\n`);
  md.push(`**Overall** (all columns): ${totalCells - totalMiss}/${totalCells} (${pct(totalCells - totalMiss, totalCells)}); ${withMismatch} of ${records.length} rows have ≥1 mismatch.\n`);
  if (dupReport.length) {
    md.push(`## Duplicate beam_id collisions\n`);
    md.push(`These IDs map to >1 material — they break the "beam_id is unique" assumption and are **excluded** from the diff above (the CSV↔JSON pairing is ambiguous). Re-mint one side.\n`);
    md.push(`| beam_id | CSV display names | JSON records |`);
    md.push(`|---|---|---|`);
    for (const d of dupReport) md.push(`| \`${d.id}\` | ${d.csv.map(s => (s || "").replace(/\|/g, "/")).join(" ⟂ ")} | ${d.json.map(s => (s || "").replace(/\|/g, "/")).join(" ⟂ ")} |`);
    md.push("");
  }
  md.push(`## Mismatches by field\n`);
  md.push(`| field | basis | mismatches |`);
  md.push(`|---|---|---:|`);
  if (fieldRank.length === 0) md.push(`| _(none)_ | | 0 |`);
  for (const f of fieldRank) md.push(`| ${f.label} | ${f.basis} | ${f.n} |`);
  md.push(`\n> \`basis\`: **verbatim** = stored as-is (a mismatch = import bug); **formula** = CSV cell is a formula (eval + 2dp round); **derived** = JSON value is computed, not copied (mismatch = derivation differs from the CSV's own column, not necessarily a bug); **enum** = JSON stores a mapped enum of the CSV string.\n`);
  md.push(`## EPD grouping\n`);
  md.push(`${groupSizes.size} distinct canonical \`epd.id\` among aligned rows; ${multiGroups.length} cover >1 product. Top fan-outs:\n`);
  md.push(`| canonical epd.id | products |`);
  md.push(`|---|---:|`);
  for (const [k, n] of multiGroups.slice(0, 12)) md.push(`| ${k.slice(0, 50) || "_(blank)_"} | ${n} |`);
  md.push(`\n## Sheets\n`);
  md.push(`- \`parity-sheet1-csv.csv\` — source-CSV values\n- \`parity-sheet2-json.csv\` — catalogue values (same order)\n- \`parity-sheet3-diff.csv\` — per-cell MATCH/MISMATCH grid (apply conditional formatting: exact text \`MATCH\` → green, \`MISMATCH\` → red) + \`mismatch_detail\`\n`);
  writeFileSync(join(outDir, "parity-summary.md"), md.join("\n"));

  console.log(`\nWrote 3 sheets + parity-summary.md → ${outDir}`);
}

main();
