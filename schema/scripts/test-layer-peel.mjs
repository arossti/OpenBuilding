#!/usr/bin/env node
/**
 * Fixture test + diagnostic runner for js/shrink-wrap.mjs classifyLayers().
 *
 * Prints a per-fixture summary (readable by eye during iteration), then
 * asserts a small set of sanity checks — drawingAreaBbox inside the page,
 * drawing-segment count > 0, page-border count >= 0. The regression
 * contract is deliberately loose: layer-peel is "starting rectangle for
 * C5" not "definitive building outline", so loose bounds catch breakage
 * without locking in over-tuned thresholds.
 *
 *   npm run test:layer-peel
 */

import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyLayers } from "../../js/shrink-wrap.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const FIXTURE_DIR = resolve(REPO_ROOT, "test", "fixtures", "dim-extract");

const EXPECTATIONS = {
  "p9-foundation-imperial": {
    minDrawingSegs: 500,
    // No sheet border drawn on the Calgary sample — 0 pageBorder is expected.
    expectPageBorderSegs: 0,
    maxDrawingAreaPct: 0.95
  },
  "p4-foundation-metric": {
    minDrawingSegs: 5000,
    // ArchiCad draws a continuous sheet border — expect meaningful count.
    minPageBorderSegs: 100,
    maxDrawingAreaPct: 0.95
  }
};

async function runFixture(fixturePath) {
  const name = basename(fixturePath, ".json");
  const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
  const result = classifyLayers(
    fixture.segments,
    fixture.textItems,
    fixture.pageWidth,
    fixture.pageHeight
  );

  const pageArea = fixture.pageWidth * fixture.pageHeight;
  const dab = result.drawingAreaBbox;
  const pct = (v) => ((v / pageArea) * 100).toFixed(1) + "%";

  console.log(`\n=============================================================================`);
  console.log(
    `${name}  (${fixture.pageWidth}x${fixture.pageHeight}  cls=${fixture.classification}  scale=${(fixture.declaredScale || {}).raw || "-"})`
  );
  console.log(`=============================================================================`);
  console.log(`  input:          ${fixture.segments.length} segments, ${fixture.textItems.length} text items`);
  console.log();
  console.log(`  pageBorder:     ${result.summary.pageBorder} segs`);
  console.log(`  drawing:        ${result.summary.drawing} segs`);
  let dabArea = 0;
  let dabPct = 0;
  if (dab) {
    dabArea = (dab.maxX - dab.minX) * (dab.maxY - dab.minY);
    dabPct = dabArea / pageArea;
    console.log(
      `                  bbox (${dab.minX.toFixed(0)},${dab.minY.toFixed(0)})-(${dab.maxX.toFixed(0)},${dab.maxY.toFixed(0)})  ` +
        `= ${dabArea.toFixed(0)} pt² (${pct(dabArea)})`
    );
  }

  const exp = EXPECTATIONS[name];
  const failures = [];
  const pass = (label) => console.log(`  ✓ ${label}`);
  const fail = (label) => {
    console.log(`  ✗ ${label}`);
    failures.push(label);
  };

  if (exp) {
    if (result.summary.drawing >= exp.minDrawingSegs) pass(`drawing ≥ ${exp.minDrawingSegs}`);
    else fail(`drawing ${result.summary.drawing} < ${exp.minDrawingSegs}`);

    if (exp.expectPageBorderSegs === 0) {
      if (result.summary.pageBorder === 0) pass(`pageBorder = 0 (no sheet edge in this PDF)`);
      else fail(`pageBorder ${result.summary.pageBorder} ≠ 0`);
    } else if (exp.minPageBorderSegs != null) {
      if (result.summary.pageBorder >= exp.minPageBorderSegs) pass(`pageBorder ≥ ${exp.minPageBorderSegs}`);
      else fail(`pageBorder ${result.summary.pageBorder} < ${exp.minPageBorderSegs}`);
    }

    if (dab) {
      if (dab.minX >= 0 && dab.minY >= 0 && dab.maxX <= fixture.pageWidth && dab.maxY <= fixture.pageHeight)
        pass(`drawingAreaBbox inside page`);
      else fail(`drawingAreaBbox exceeds page: (${dab.minX},${dab.minY})-(${dab.maxX},${dab.maxY})`);

      if (dabPct <= exp.maxDrawingAreaPct) pass(`drawingAreaBbox ≤ ${(exp.maxDrawingAreaPct * 100).toFixed(0)}% of page`);
      else fail(`drawingAreaBbox ${(dabPct * 100).toFixed(1)}% > ${(exp.maxDrawingAreaPct * 100).toFixed(0)}%`);
    } else {
      fail(`drawingAreaBbox is null`);
    }
  }

  console.log();
  console.log(`  → shrink-wrap (C5) starts its sweep from drawingAreaBbox above.`);
  return { name, failures };
}

async function main() {
  const entries = await readdir(FIXTURE_DIR);
  const fixtures = entries.filter((n) => n.endsWith(".json")).sort();
  let totalFailures = 0;
  for (const name of fixtures) {
    const res = await runFixture(resolve(FIXTURE_DIR, name));
    totalFailures += res.failures.length;
  }
  console.log();
  if (totalFailures === 0) {
    console.log(`ALL PASS (${fixtures.length} fixtures)`);
    process.exit(0);
  } else {
    console.log(`FAIL — ${totalFailures} assertion(s) across ${fixtures.length} fixtures`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
