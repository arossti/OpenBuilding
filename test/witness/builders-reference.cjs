// Reference / Target independence for the Builders (schema.md §0, §10): a row takes one assembly per model.
const { webkit } = require("playwright"); const fs = require("fs");
(async () => {
  const b = await webkit.launch(); const p = await (await b.newContext({ viewport: { width: 1527, height: 970 }, acceptDownloads: true })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  await p.goto("http://localhost:8831/objectivepro.html#transmission"); await p.waitForTimeout(6000);
  const st = () => p.evaluate(() => { const SM = window.TEUI.StateManager; const c = (id) => document.querySelector(`[data-field-id="${id}"]`)?.textContent.trim(); const n = (k) => { try { return JSON.parse(SM.getValue(k) || "null")?.name || ""; } catch { return "?"; } };
    const tr = document.querySelector('#emissions tr[data-id="E.3.5"]'); const g = (f) => tr?.querySelector(`[data-op-field="${f}"]`)?.textContent;
    return { mode: window.TEUI.ReferenceToggle.getCurrentMode(), shown: { f_86: c("f_86"), g_86: c("g_86"), chip86: document.querySelector('tr[data-id="B.5"] .op-asm-name')?.textContent || "", g_89: c("g_89") }, state: { f_86: SM.getValue("f_86"), ref_f_86: SM.getValue("ref_f_86"), ca_86: n("ca_86"), ref_ca_86: n("ref_ca_86"), g_89: SM.getValue("g_89"), ref_g_89: SM.getValue("ref_g_89"), ca_89: n("ca_89"), ref_ca_89: n("ref_ca_89") }, e35: [g("asm_carbon_total"), g("asm_carbon_intensity"), g("asm_carbon_status")], i_41: c("i_41") }; });
  const apply = async (bid, name) => { await p.click(`tr[data-id="${bid}"] td.id-cell`); await p.waitForTimeout(3300); const f = p.frames().find((x) => x.url().includes("-builder")); const url = f.url().split("?")[1]; if (name) { await f.locator(".asm-list .asm-row", { hasText: name }).first().click(); await p.waitForTimeout(400); } await f.click("#embed-apply"); await p.waitForTimeout(1300); return url; };
  const mode = async (m) => { await p.click(m === "reference" ? "#op-model-reference" : "#op-model-target"); await p.waitForTimeout(1000); };
  console.log("TARGET: B.5 ← R36 2x6 (timber), B.8.1 ← EnerSign:", await apply("B.5", "R36 2x6"), await apply("B.8.1", "EnerSign | primus Tilt"));
  console.log(JSON.stringify(await st()));
  await mode("reference"); console.log("REFERENCE, before:", JSON.stringify(await st()));
  console.log("REFERENCE: B.5 ← 203mm Concrete, B.8.1 ← EPAL Fixed:", await apply("B.5", "203mm Concrete"), await apply("B.8.1", "EPAL | Fixed"));
  console.log(JSON.stringify(await st()));
  await p.screenshot({ path: process.argv[2] + "/ref-rows.png" });
  await mode("target"); console.log("TARGET again:", JSON.stringify(await st()));
  const [dl] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => window.TEUI.FileHandler.exportToCSV())]); const csv = fs.readFileSync(await dl.path(), "utf8");
  // another project clears both, then the saved file brings both back
  await p.evaluate(async () => { const r = await fetch("src/template/case-studies/04-apartment-necb-small.csv"); window.TEUI.FileHandler.processImportedCSV(await r.text(), { replaceNotes: true }); }); await p.waitForTimeout(3000);
  console.log("other project:", JSON.stringify((await st()).state));
  await p.evaluate((csv) => window.TEUI.FileHandler.processImportedCSV(csv), csv); await p.waitForTimeout(3000);
  console.log("saved file reloaded (Target):", JSON.stringify(await st()));
  await mode("reference"); console.log("saved file reloaded (Reference):", JSON.stringify(await st()));
  console.log("reopen in Reference →", await (async () => { await p.click('tr[data-id="B.5"] td.id-cell'); await p.waitForTimeout(3000); const f = p.frames().find((x) => x.url().includes("-builder")); const r = f.url().split("?")[1] + " | sel: " + (await f.evaluate(() => document.querySelector(".asm-list .asm-row.sel .nm").textContent)); await f.click("#embed-cancel"); await p.waitForTimeout(400); return r; })());
  // a U typed in the Reference clears the Reference's product only
  await p.click('[data-field-id="g_89"]'); await p.keyboard.press("Meta+A"); await p.keyboard.type("2.2"); await p.keyboard.press("Tab"); await p.waitForTimeout(800);
  console.log("typed 2.2 in Reference:", JSON.stringify((await st()).state));
  // Copy from Target → All Inputs: the Target's assemblies go across with its values
  await mode("target"); await p.click("#op-reference-menu"); await p.waitForTimeout(300); await p.click("#mirrorAllInputsBtn"); await p.waitForTimeout(2500);
  console.log("after Copy from Target, All Inputs:", JSON.stringify((await st()).state));
  console.log("errors", errs.slice(0, 5)); await b.close();
})();
