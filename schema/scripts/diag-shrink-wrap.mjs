#!/usr/bin/env node
/**
 * Diagnostic runner for js/shrink-wrap.mjs shrinkWrapBuilding().
 *
 * Prints the detected building bbox per fixture + a count of wall
 * candidates on each axis. Meant for eyeball review during the C5
 * iteration, not for regression. Once polygons are visually confirmed
 * in Playwright, we can bake in assertions similar to test-layer-peel.
 *
 *   node schema/scripts/diag-shrink-wrap.mjs
 */

import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { classifyLayers, shrinkWrapBuilding } from "../../js/shrink-wrap.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const FIXTURE_DIR = resolve(REPO_ROOT, "test", "fixtures", "dim-extract");

async function runFixture(fixturePath) {
  const name = basename(fixturePath, ".json");
  const fx = JSON.parse(await readFile(fixturePath, "utf8"));
  const layers = classifyLayers(fx.segments, fx.textItems, fx.pageWidth, fx.pageHeight);
  const wrap = shrinkWrapBuilding(layers.drawingSegments, layers.drawingAreaBbox);

  const pageArea = fx.pageWidth * fx.pageHeight;
  const pct = (v) => ((v / pageArea) * 100).toFixed(1) + "%";

  console.log(`\n======================================================================`);
  console.log(`${name}  (${fx.pageWidth}x${fx.pageHeight}  scale=${(fx.declaredScale || {}).raw || "-"})`);
  console.log(`======================================================================`);
  console.log(`  layer-peel:     ${layers.summary.drawing} drawing segs`);
  if (!wrap || !wrap.polygon) {
    console.log(`  shrink-wrap:    FAILED — ${wrap ? wrap.reason : "null result"}`);
    console.log(`                  wall candidates: H=${wrap ? wrap.wallHorizCount : 0}, V=${wrap ? wrap.wallVertCount : 0}`);
    return;
  }

  const bb = wrap.bbox;
  const bbArea = (bb.maxX - bb.minX) * (bb.maxY - bb.minY);
  console.log(`  shrink-wrap:    ✓ detected`);
  console.log(`                  wall candidates: H=${wrap.wallHorizCount}, V=${wrap.wallVertCount}`);
  console.log(
    `                  bbox (${bb.minX.toFixed(0)},${bb.minY.toFixed(0)})-(${bb.maxX.toFixed(0)},${bb.maxY.toFixed(0)})  ` +
      `= ${bbArea.toFixed(0)} pt² (${pct(bbArea)})`
  );
  console.log(`                  polygon (${wrap.polygon.length} vertices):`);
  for (const v of wrap.polygon) {
    console.log(`                     (${v.x.toFixed(1)}, ${v.y.toFixed(1)})`);
  }

  // Compare to the prior drawing-area bbox to show how much the
  // shrink-wrap tightened.
  const dab = layers.drawingAreaBbox;
  if (dab) {
    const dabArea = (dab.maxX - dab.minX) * (dab.maxY - dab.minY);
    const tightenRatio = ((1 - bbArea / dabArea) * 100).toFixed(1);
    console.log(
      `                  tightened from drawingAreaBbox ${pct(dabArea)} → ${pct(bbArea)} (${tightenRatio}% smaller)`
    );
  }
}

async function main() {
  const entries = await readdir(FIXTURE_DIR);
  const fixtures = entries.filter((n) => n.endsWith(".json")).sort();
  for (const name of fixtures) {
    await runFixture(resolve(FIXTURE_DIR, name));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
