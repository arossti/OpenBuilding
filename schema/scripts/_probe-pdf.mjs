import { readFile } from "node:fs/promises";
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const TextJoin = await import("../../js/shared/text-join.mjs").catch(() => import("/Users/andrewthomson/Library/Mobile Documents/com~apple~CloudDocs/Documents/Documents - iMac Pro/[T] iCLOUD STUDIO/[T] Active Projects/2026.004 BfCA CAF/js/shared/text-join.mjs"));
const join = TextJoin.itemsToLines;
const pdfPath = process.argv[2];
const data = new Uint8Array(await readFile(pdfPath));
const doc = await pdfjs.getDocument({ data }).promise;
const allLines = [];
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const vp = page.getViewport({ scale: 1 });
  const ct = await page.getTextContent();
  const items = ct.items.map((it) => ({ str: it.str, x: it.transform[4], y: vp.height - it.transform[5], width: it.width }));
  allLines.push(join(items));
}
const allText = allLines.join("\n\n");
console.log("Pages:", doc.numPages, "Lines (joined):", allText.split("\n").length);
// Search for country indicators
const SEARCHES = process.argv.slice(3);
if (SEARCHES.length === 0) {
  console.log("\n(no search terms — showing lines 1-60)");
  allText.split("\n").slice(0, 60).forEach((l, i) => console.log(`${String(i + 1).padStart(3)}: ${l.slice(0, 140)}`));
} else {
  const lines = allText.split("\n");
  for (const term of SEARCHES) {
    const rx = new RegExp(term, "i");
    console.log(`\n=== matches for /${term}/i ===`);
    let hits = 0;
    for (let i = 0; i < lines.length; i++) {
      if (rx.test(lines[i])) {
        console.log(`  L${String(i + 1).padStart(4)}: ${lines[i].slice(0, 160)}`);
        if (++hits >= 12) { console.log("  …(more matches truncated)"); break; }
      }
    }
    if (hits === 0) console.log("  (none)");
  }
}
await doc.destroy();
