#!/usr/bin/env node
/**
 * PDF-Parser debug harness.
 *
 * Dumps the raw signals the browser app sees so algorithm iteration can
 * happen against actual extracted data instead of screenshot round-trips.
 *
 * Usage:
 *   node schema/scripts/debug-pdf-extract.mjs <pdf> [--page N] [--what text|geometry|classifier|all] [--out file.json]
 *
 * Default --what is "text"; use "all" to dump everything.
 * Default page is "all"; pass --page 3 to narrow.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

function parseArgs(argv) {
  const args = { pdf: null, page: null, what: "text", out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--page") args.page = parseInt(argv[++i], 10);
    else if (a === "--what") args.what = argv[++i];
    else if (a === "--out") args.out = argv[++i];
    else if (!args.pdf) args.pdf = a;
  }
  if (!args.pdf) {
    console.error("usage: debug-pdf-extract.mjs <pdf> [--page N] [--what text|geometry|classifier|all] [--out file.json]");
    process.exit(2);
  }
  return args;
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs;
}

async function extractPage(page, what) {
  const viewport = page.getViewport({ scale: 1 });
  const out = { pageNum: page.pageNumber, width: viewport.width, height: viewport.height };

  if (what === "text" || what === "classifier" || what === "all") {
    const content = await page.getTextContent();
    out.textItems = content.items.map((item) => {
      const tx = item.transform;
      return {
        str: item.str,
        x: tx[4],
        y: viewport.height - tx[5],
        width: item.width,
        height: item.height,
        fontName: item.fontName || "",
        fontSize: Math.abs(tx[3])
      };
    });
  }

  if (what === "geometry" || what === "all") {
    const ops = await page.getOperatorList();
    out.operatorList = {
      fnCount: ops.fnArray.length,
      fnArray: Array.from(ops.fnArray),
      argsArray: ops.argsArray.map((args) => {
        if (!args) return args;
        return args.map((a) => {
          if (a && typeof a === "object" && "length" in a && typeof a.length === "number" && !Array.isArray(a)) {
            return Array.from(a);
          }
          return a;
        });
      })
    };
  }

  return out;
}

async function runClassifier(pageDump) {
  const cls = await import("../../js/sheet-classifier.mjs").catch((e) => {
    return { __importError: e.message };
  });
  if (cls.__importError) {
    return { error: "classifier import failed (expected — Loader module is browser-only): " + cls.__importError };
  }
  const titleBlock = cls.parseTitleBlock(pageDump.textItems, pageDump.width, pageDump.height);
  const scale = cls.detectScale(pageDump.textItems);
  const classification = cls.classifySheet(titleBlock.sheetId, titleBlock.sheetTitle);
  return {
    sheetId: titleBlock.sheetId,
    sheetTitle: titleBlock.sheetTitle,
    scale,
    classification
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pdfPath = resolve(REPO_ROOT, args.pdf);
  const buf = await readFile(pdfPath);

  const pdfjs = await loadPdfjs();
  const pdfjsRoot = resolve(REPO_ROOT, "node_modules", "pdfjs-dist");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    standardFontDataUrl: pdfjsRoot + "/standard_fonts/"
  }).promise;

  const result = { pdf: args.pdf, pageCount: doc.numPages, what: args.what, pages: [] };

  const pageNums = args.page ? [args.page] : Array.from({ length: doc.numPages }, (_, i) => i + 1);
  for (const n of pageNums) {
    const page = await doc.getPage(n);
    const dump = await extractPage(page, args.what);
    if (args.what === "classifier" || args.what === "all") {
      dump.classifier = await runClassifier(dump);
    }
    result.pages.push(dump);
  }

  const json = JSON.stringify(result, null, 2);
  if (args.out) {
    await writeFile(resolve(REPO_ROOT, args.out), json);
    console.error(`wrote ${args.out} (${result.pages.length} page${result.pages.length === 1 ? "" : "s"})`);
  } else {
    process.stdout.write(json + "\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
