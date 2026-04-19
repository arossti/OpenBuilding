#!/usr/bin/env node
// Pulls BEAM worksheet tabs from the canonical Google Sheet via the gviz/tq
// CSV endpoint. Zero deps (Node 18+ `fetch`). Re-run whenever the sheet
// changes; output goes to docs/csv files from BEAM/<TabName>.csv.
//
// Usage:
//   node schema/scripts/fetch-beam-sheet.mjs             fetch default tab set
//   node schema/scripts/fetch-beam-sheet.mjs Tab1 Tab2   fetch specific tabs

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const SHEET_ID = "1LjOpDTjfGQvvfRGCpDb8KkHcUtHzUC5UbvfV-wXy13g";

const DEFAULT_TABS = [
  "PROJECT",
  "Footings & Slabs",
  "Foundation Walls",
  "Structural Elements",
  "Ext. Walls",
  "Party Walls",
  "Cladding",
  "Windows",
  "Int. Walls",
  "Floors",
  "Ceilings",
  "Roof",
  "Garage",
  "REVIEW",
  "RESULTS",
  "Materials DB",
  "Categories",
  "Materials",
  "Glossary",
  "PROJECT_FIELDS",
  "Settings",
  "Version",
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const OUT_DIR = resolve(REPO_ROOT, "docs/csv files from BEAM");

function endpointFor(tab) {
  const params = new URLSearchParams({ tqx: "out:csv", sheet: tab });
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${params}`;
}

async function fetchTab(tab) {
  const res = await fetch(endpointFor(tab));
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const body = await res.text();
  const head = body.slice(0, 200).trimStart();
  // Sheet not public -> HTML login page. JSONP wrapper -> tqx not honored.
  if (head.startsWith("<")) throw new Error("received HTML (sheet not publicly viewable?)");
  if (head.startsWith("/*") || head.startsWith("google.visualization")) {
    throw new Error("received JSONP wrapper (tqx=out:csv not honored)");
  }
  return body;
}

async function main() {
  const tabs = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TABS;
  await mkdir(OUT_DIR, { recursive: true });
  let ok = 0;
  let fail = 0;
  for (const tab of tabs) {
    try {
      const csv = await fetchTab(tab);
      const lines = csv.split("\n").length;
      await writeFile(resolve(OUT_DIR, `${tab}.csv`), csv, "utf8");
      console.log(`  ✓ ${tab.padEnd(22)} ${lines} lines`);
      ok++;
    } catch (err) {
      console.error(`  ✗ ${tab.padEnd(22)} ${err.message}`);
      fail++;
    }
  }
  console.log(`\n${ok} ok, ${fail} failed → ${OUT_DIR}`);
  if (fail > 0) process.exit(1);
}

main();
