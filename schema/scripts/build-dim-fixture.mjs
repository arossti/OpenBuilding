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

  // Geometry — CTM walk matching js/vector-snap.mjs
  const operatorList = await page.getOperatorList();
  const segments = walkForSegments(operatorList, viewport.transform, OPS);

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

// pdfjs v5 DrawOPS — inline opcodes packed into the constructPath coord buffer.
// Source: node_modules/pdfjs-dist/legacy/build/pdf.mjs (DrawOPS enum).
const DRAW_MOVE_TO = 0;
const DRAW_LINE_TO = 1;
const DRAW_CURVE_TO = 2; // bezier, 6 coords
const DRAW_QUAD_CURVE_TO = 3; // quadratic, 4 coords
const DRAW_CLOSE_PATH = 4;

function walkForSegments(operatorList, vpTx, OPS) {
  const segments = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const ctmStack = [];
  let currentPath = [];
  let curX = 0,
    curY = 0,
    pathStartX = 0,
    pathStartY = 0;

  function mul(m1, m2) {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }
  function tp(x, y) {
    const px = ctm[0] * x + ctm[2] * y + ctm[4];
    const py = ctm[1] * x + ctm[3] * y + ctm[5];
    const cx = vpTx[0] * px + vpTx[2] * py + vpTx[4];
    const cy = vpTx[1] * px + vpTx[3] * py + vpTx[5];
    return { x: cx, y: cy };
  }
  function flush(path) {
    for (let i = 0; i < path.length - 1; i++) {
      segments.push({ x1: path[i].x, y1: path[i].y, x2: path[i + 1].x, y2: path[i + 1].y });
    }
  }

  function handleConstructPathV5(buf) {
    const n = buf.length;
    let j = 0;
    while (j < n) {
      const op = buf[j++];
      if (op === DRAW_MOVE_TO) {
        const p = tp(buf[j++], buf[j++]);
        curX = p.x;
        curY = p.y;
        pathStartX = curX;
        pathStartY = curY;
        if (currentPath.length >= 2) flush(currentPath);
        currentPath = [{ x: curX, y: curY }];
      } else if (op === DRAW_LINE_TO) {
        const p = tp(buf[j++], buf[j++]);
        curX = p.x;
        curY = p.y;
        currentPath.push({ x: curX, y: curY });
      } else if (op === DRAW_CURVE_TO) {
        // cubic bezier — 6 coords, keep only the end point as a straight-line approximation
        const p = tp(buf[j + 4], buf[j + 5]);
        curX = p.x;
        curY = p.y;
        j += 6;
        currentPath.push({ x: curX, y: curY });
      } else if (op === DRAW_QUAD_CURVE_TO) {
        const p = tp(buf[j + 2], buf[j + 3]);
        curX = p.x;
        curY = p.y;
        j += 4;
        currentPath.push({ x: curX, y: curY });
      } else if (op === DRAW_CLOSE_PATH) {
        if (currentPath.length >= 3) {
          currentPath.push({ x: pathStartX, y: pathStartY });
          flush(currentPath);
        }
        currentPath = [];
      } else {
        // Unknown opcode — bail on this path to avoid reading garbage as coords.
        currentPath = [];
        break;
      }
    }
  }

  const fnArray = operatorList.fnArray;
  const argsArray = operatorList.argsArray;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i];

    if (fn === OPS.save) {
      ctmStack.push(ctm.slice());
      continue;
    }
    if (fn === OPS.restore) {
      if (ctmStack.length > 0) ctm = ctmStack.pop();
      continue;
    }
    if (fn === OPS.transform) {
      ctm = mul(ctm, args);
      continue;
    }

    if (fn === OPS.constructPath) {
      // pdfjs v5 packs subpath ops inline into a single coord buffer at args[1][0].
      // args[0] is the trailing paint op (stroke/fill/endPath/...), args[2] is the bbox.
      const trailingPaint = args[0];
      const bufWrap = args[1];
      const buf = bufWrap && bufWrap.length === 1 ? bufWrap[0] : bufWrap;
      if (buf && typeof buf.length === "number") {
        handleConstructPathV5(buf);
      }
      // End of path — if the paint op actually renders, flush any open polyline.
      if (
        trailingPaint === OPS.stroke ||
        trailingPaint === OPS.fill ||
        trailingPaint === OPS.fillStroke ||
        trailingPaint === OPS.eoFill ||
        trailingPaint === OPS.eoFillStroke ||
        trailingPaint === OPS.closeStroke ||
        trailingPaint === OPS.closeFillStroke ||
        trailingPaint === OPS.closeEOFillStroke
      ) {
        if (currentPath.length >= 2) flush(currentPath);
      }
      currentPath = [];
      continue;
    }
  }
  return segments;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
