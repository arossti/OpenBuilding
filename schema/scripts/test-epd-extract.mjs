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
const EXTRACT_MJS = join(REPO_ROOT, "js", "epd", "extract.mjs");
const LOOKUPS_DIR = join(REPO_ROOT, "schema", "lookups");
const COVERAGE_HISTORY_DIR = join(REPO_ROOT, "docs", "workplans", "EPD-coverage-history");

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

function parseArgs(argv) {
  const args = { json: null, md: null, only: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") args.json = argv[++i];
    else if (a === "--md") args.md = argv[++i];
    else if (a === "--only") args.only = argv[++i];
  }
  return args;
}

async function loadPdfjs() {
  return await import("pdfjs-dist/legacy/build/pdf.mjs");
}

function spatialJoinLines(items) {
  if (!items || items.length === 0) return "";
  const sorted = items.slice().sort((a, b) => a.y - b.y);
  const lines = [];
  let curr = [];
  let cy = null;
  for (const it of sorted) {
    if (cy === null || it.y - cy > 3) {
      if (curr.length) {
        curr.sort((a, b) => a.x - b.x);
        lines.push(curr.map((c) => c.str).join(" "));
      }
      curr = [it];
      cy = it.y;
    } else {
      curr.push(it);
    }
  }
  if (curr.length) {
    curr.sort((a, b) => a.x - b.x);
    lines.push(curr.map((c) => c.str).join(" "));
  }
  return lines.join("\n");
}

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
        y: viewport.height - tx[5]
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
  for (const k of IMPACT_KEYS) {
    const v = getPath(rec, "impacts." + k + ".total.value");
    impacts[k] = v != null ? v : null;
    if (v != null) impactHit++;
  }
  return { metaHit, metaTotal: METADATA_FIELDS.length, impactHit, impactTotal: IMPACT_KEYS.length, meta, impacts };
}

function fmtPct(n, d) {
  if (d === 0) return "0/0";
  return `${n}/${d}`;
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
  Extract.setLookups({
    mtMap: mt.map || {},
    kwPatterns: kw.patterns || [],
    materialDefaults: md
  });

  const pdfs = await walkPdfs(SAMPLES_ROOT);
  if (pdfs.length === 0) {
    console.error("No PDFs found under:", SAMPLES_ROOT);
    process.exit(1);
  }

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

    const summary = summarizeRecord(result.record);
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
      record: result.record
    });
    console.log(
      `✓ ${group}/${file.padEnd(60)}  fmt=${result.format.padEnd(20)}  meta=${fmtPct(summary.metaHit, summary.metaTotal)}  impacts=${fmtPct(summary.impactHit, summary.impactTotal)}  pages=${extracted.pageCount}`
    );
  }

  // ── Aggregate ───────────────────────────────────────
  const ok = results.filter((r) => !r.error);
  const totalMeta = ok.reduce((a, r) => a + r.metaHit, 0);
  const totalMetaPossible = ok.length * METADATA_FIELDS.length;
  const totalImpact = ok.reduce((a, r) => a + r.impactHit, 0);
  const totalImpactPossible = ok.length * IMPACT_KEYS.length;
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
    `Formats: ${Object.entries(formatCounts)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`
  );

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
      `Samples: ${ok.length} · metadata: ${totalMeta}/${totalMetaPossible} (${((100 * totalMeta) / totalMetaPossible).toFixed(1)}%) · impacts: ${totalImpact}/${totalImpactPossible} (${((100 * totalImpact) / totalImpactPossible).toFixed(1)}%)`
    );
    lines.push("");
    lines.push("## Per-sample coverage");
    lines.push("");
    lines.push("| Sample | Format | Pages | Meta | Impacts | GWP | ODP | AP | EP | SFP | ADPf | WDP | PE-NR | PE-R |");
    lines.push("|---|---|---:|---:|---:|---|---|---|---|---|---|---|---|---|");
    for (const r of results) {
      if (r.error) {
        lines.push(`| ${r.group}/${r.file} | (error: ${r.error}) | — | — | — | | | | | | | | | |`);
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
      lines.push(
        `| ${r.group}/${r.file} | ${r.format} | ${r.pages} | ${r.metaHit}/${METADATA_FIELDS.length} | ${r.impactHit}/${IMPACT_KEYS.length} | ${cell(i.gwp_kgco2e)} | ${cell(i.ozone_depletion_kgcfc11eq)} | ${cell(i.acidification_kgso2eq)} | ${cell(i.eutrophication_kgneq)} | ${cell(i.smog_kgo3eq)} | ${cell(i.abiotic_depletion_fossil_mj)} | ${cell(i.water_consumption_m3)} | ${cell(i.primary_energy_nonrenewable_mj)} | ${cell(i.primary_energy_renewable_mj)} |`
      );
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
