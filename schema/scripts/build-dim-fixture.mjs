#!/usr/bin/env node
/**
 * Build a test fixture for dim-extract / layer-peel from a single PDF page.
 *
 * Writes { pageNum, pageWidth, pageHeight, declaredScale, textItems, segments }
 * to test/fixtures/dim-extract/<name>.json so the fixture test runner can
 * exercise js/dim-extract.mjs against real PDF output without a browser.
 *
 * Usage:
 *   node schema/scripts/build-dim-fixture.mjs <pdf> <page> <name>
 *
 * Example:
 *   node schema/scripts/build-dim-fixture.mjs docs/sample.pdf 9 p9-foundation-imperial
 *
 * NOTE — duplicates the CTM walk from js/vector-snap.mjs. Intentional for now:
 * the browser-side walk imports pdf-loader.mjs (browser-only). When task C4
 * needs the walk from node, refactor both into js/geometry-walk.mjs as a
 * shared pure function and delete the duplication here.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { walkOperatorList } from "../../js/geometry-walk.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const FIXTURE_DIR = resolve(REPO_ROOT, "test", "fixtures", "dim-extract");

function usage() {
  console.error("usage: build-dim-fixture.mjs <pdf> <page> <name>");
  process.exit(2);
}

async function main() {
  const [pdfArg, pageArg, nameArg] = process.argv.slice(2);
  if (!pdfArg || !pageArg || !nameArg) usage();
  const pageNum = parseInt(pageArg, 10);
  if (!Number.isFinite(pageNum) || pageNum < 1) usage();

  const pdfPath = resolve(REPO_ROOT, pdfArg);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const OPS = pdfjs.OPS;
  const pdfjsRoot = resolve(REPO_ROOT, "node_modules", "pdfjs-dist");
  const buf = await readFile(pdfPath);

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    standardFontDataUrl: pdfjsRoot + "/standard_fonts/"
  }).promise;

  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  // Text items — harness-shape, y flipped so origin is top-left
  const content = await page.getTextContent();
  const textItems = content.items.map((item) => {
    const tx = item.transform;
    return {
      str: item.str,
      x: tx[4],
      y: pageHeight - tx[5],
      width: item.width,
      height: item.height,
      fontName: item.fontName || "",
      fontSize: Math.abs(tx[3])
    };
  });

  // Classifier output (declared scale + classification)
  const cls = await import("../../js/sheet-classifier.mjs");
  const titleBlock = cls.parseTitleBlock(textItems, pageWidth, pageHeight);
  const scale = cls.detectScale(textItems);
  const classification = cls.classifySheet(titleBlock.sheetId, titleBlock.sheetTitle);

  // Geometry — CTM walk shared with js/vector-snap.mjs via js/geometry-walk.mjs.
  const operatorList = await page.getOperatorList();
  const walk = walkOperatorList(operatorList, viewport.transform, OPS);
  const segments = walk.segments;

  const fixture = {
    pdf: pdfArg,
    pageNum,
    pageWidth,
    pageHeight,
    sheetId: titleBlock.sheetId,
    sheetTitle: titleBlock.sheetTitle,
    classification,
    declaredScale: scale,
    textItems,
    segments
  };

  await mkdir(FIXTURE_DIR, { recursive: true });
  const outPath = resolve(FIXTURE_DIR, `${nameArg}.json`);
  await writeFile(outPath, JSON.stringify(fixture, null, 2));
  console.error(
    `wrote ${outPath}  (${textItems.length} text items, ${segments.length} segments, classification=${classification}, scale=${(scale && scale.raw) || "—"})`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
