// every [data-field-id] on this page vs andy-rnd's V3 page, all 16 cases
const { webkit: chromium } = require("playwright");
const fs = require("fs");
const OURS = process.argv[2], V3 = process.argv[3];
const cases = fs.readdirSync("src/template/case-studies").filter((f) => f.endsWith(".csv")).sort();
async function read(browser, url, file) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  await page.evaluate(async (f) => {
    const r = await fetch(`src/template/case-studies/${f}`);
    window.TEUI.FileHandler.processImportedCSV(await r.text(), { replaceNotes: true });
  }, file);
  await page.waitForTimeout(4500);
  const vals = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll("[data-field-id]")) {
      const id = el.dataset.fieldId;
      const ctl = el.matches("input,select") ? el : el.querySelector("input,select");
      const v = ctl ? (ctl.type === "checkbox" ? String(ctl.checked) : ctl.value) : el.textContent.trim();
      if (!(id in out)) out[id] = v;
    }
    return out;
  });
  await ctx.close();
  return { vals, errors };
}
(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  const run = async (file) => {
    const [a, b] = await Promise.all([read(browser, OURS, file), read(browser, V3, file)]);
    const ids = Object.keys(b.vals);
    const diff = ids.filter((id) => a.vals[id] !== b.vals[id]);
    const extra = Object.keys(a.vals).filter((id) => !(id in b.vals));
    if (diff.length || a.errors.length) bad++;
    console.log(`${file}: ${ids.length - diff.length} / ${ids.length}` + (extra.length ? ` (+${extra.length} only here)` : "") +
      (diff.length ? `  DIFF ${diff.slice(0, 8).map((id) => `${id}: ${a.vals[id]} vs ${b.vals[id]}`).join("; ")}` : "") +
      (a.errors.length ? `  ERRORS ${a.errors.slice(0, 3).join(" | ")}` : ""));
  };
  const q = [...cases];
  await Promise.all([0, 1, 2].map(async () => { while (q.length) await run(q.shift()); }));
  await browser.close();
  console.log(bad ? `FAILED: ${bad} case(s)` : "ALL MATCH");
})();
