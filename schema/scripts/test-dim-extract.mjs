#!/usr/bin/env node
/**
 * Fixture test runner for js/dim-extract.mjs.
 *
 * Loads each JSON under test/fixtures/dim-extract/, runs the primitive,
 * and asserts known-good callouts. Exit 0 on pass, 1 on any failure.
 *
 * Invoke via `npm run test:dim-extract` or directly with node.
 */

import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { extractDimensions } from "../../js/dim-extract.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const FIXTURE_DIR = resolve(REPO_ROOT, "test", "fixtures", "dim-extract");

// Expected callouts per fixture. Each entry asserts a known dim shows up
// in the callouts list with a matching valueMeters (within 1%).
const EXPECTATIONS = {
  "p9-foundation-imperial": {
    minPaired: 10,
    minConfidence: 0.5,
    declaredRatio: 64, // 3/16"=1'-0"
    mustInclude: [
      { text: /24'-0"/, meters: 7.3152 }, // 24 ft
      { text: /29'-4"/, meters: 8.9408 }, // 29' 4"
      { text: /26'-4"/, meters: 8.0264 }, // 26' 4"
      { text: /17'-11.*3\/4"?/, meters: 5.48005 }, // 17' 11 3/4" — fraction merge must fire
      { text: /4'-0"/, meters: 1.2192 }
    ]
  },
  "p4-foundation-metric": {
    minPaired: 15,
    minConfidence: 0.5,
    declaredRatio: 48,
    mustInclude: [
      { text: /17,068\.8/, meters: 17.0688 },
      { text: /2,901\.6/, meters: 2.9016 },
      { text: /3,054\.7/, meters: 3.0547 },
      { text: /11,912\.6/, meters: 11.9126 }
    ]
  }
};

function fmt(n, d) {
  return typeof n === "number" && isFinite(n) ? n.toFixed(d) : "—";
}

async function runFixture(fixturePath) {
  const name = basename(fixturePath, ".json");
  const raw = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(raw);
  const exp = EXPECTATIONS[name];

  const result = extractDimensions(fixture.textItems, fixture.segments, {
    declaredScale: fixture.declaredScale
  });

  const failures = [];
  const pass = (label) => console.log(`  ✓ ${label}`);
  const fail = (label) => {
    console.log(`  ✗ ${label}`);
    failures.push(label);
  };

  console.log(`\n=== ${name} ===`);
  console.log(
    `  raw=${fixture.textItems.length}  merged=${result.textItemsMerged}  pairs=${result.callouts.length}  unpaired=${result.unpaired.length}`
  );
  console.log(
    `  declaredPdfUnitsPerMetre=${fmt(result.declaredPdfUnitsPerMetre, 3)}  impliedMedian=${fmt(result.impliedPdfUnitsPerMetreMedian, 3)}  agreement=${fmt(result.scaleAgreement, 4)}`
  );
  console.log(`  sample pairings:`);
  for (const p of result.callouts.slice(0, 8)) {
    console.log(
      `    "${p.text}"  →  ${fmt(p.valueMeters, 3)}m  seg.len=${fmt(p.segment.length, 1)}  conf=${fmt(p.confidence, 2)}  impliedPPM=${fmt(p.impliedPdfUnitsPerMetre, 2)}`
    );
  }

  if (!exp) return { name, failures: [`no expectations defined`] };

  if (result.callouts.length >= exp.minPaired) pass(`paired ≥ ${exp.minPaired}`);
  else fail(`paired ${result.callouts.length} < ${exp.minPaired}`);

  if (fixture.declaredScale && fixture.declaredScale.ratio === exp.declaredRatio) {
    pass(`declared ratio = ${exp.declaredRatio}`);
  } else {
    fail(`declared ratio ${(fixture.declaredScale || {}).ratio} !== ${exp.declaredRatio}`);
  }

  // Scale-agreement check (declared vs implied): should be within 3%
  if (result.scaleAgreement !== null) {
    if (result.scaleAgreement > 0.97) pass(`scaleAgreement ${fmt(result.scaleAgreement, 4)} > 0.97`);
    else fail(`scaleAgreement ${fmt(result.scaleAgreement, 4)} ≤ 0.97`);
  }

  for (const want of exp.mustInclude) {
    const hit = result.callouts.find(
      (p) => want.text.test(p.text) && Math.abs(p.valueMeters - want.meters) / want.meters < 0.01
    );
    if (hit) pass(`includes ${want.text} ≈ ${want.meters}m  (got "${hit.text}", conf=${fmt(hit.confidence, 2)})`);
    else {
      // Was it at least parsed (perhaps unpaired)?
      const parsedOnly = [...result.callouts, ...result.unpaired].find(
        (p) => want.text.test(p.text) && Math.abs(p.valueMeters - want.meters) / want.meters < 0.01
      );
      const status = parsedOnly ? `parsed but unpaired` : `not even parsed`;
      fail(`includes ${want.text} ≈ ${want.meters}m — ${status}`);
    }
  }

  return { name, failures };
}

async function main() {
  const entries = await readdir(FIXTURE_DIR);
  const fixtures = entries.filter((n) => n.endsWith(".json")).sort();
  if (fixtures.length === 0) {
    console.error(`no fixtures in ${FIXTURE_DIR}`);
    process.exit(2);
  }
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
