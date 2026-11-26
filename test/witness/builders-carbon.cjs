const { webkit } = require("playwright");
(async () => {
  const b = await webkit.launch(); const p = await (await b.newContext({ viewport: { width: 1527, height: 970 } })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  await p.goto("http://localhost:8831/objectivepro.html#transmission"); await p.waitForTimeout(6000);
  const row = () => p.evaluate(() => { const tr = document.querySelector('#emissions tr[data-id="E.3.5"]'); const g = (f) => tr?.querySelector(`[data-op-field="${f}"]`)?.textContent; const c = (id) => document.querySelector(`[data-field-id="${id}"]`).textContent.trim();
    return { exists: !!tr, total: g("asm_carbon_total"), perM2: g("asm_carbon_intensity"), status: g("asm_carbon_status"), i_41: c("i_41"), d_40: c("d_40"), d_39: document.querySelector('[data-field-id="d_39"]')?.value ?? c("d_39") }; });
  const hand = () => p.evaluate(() => { const SM = window.TEUI.StateManager, O = window.TEUI.Openings; const n = (v) => parseFloat(String(v ?? "").replace(/,/g, "")) || 0; let kg = 0; const parts = [];
    for (const o of O.OPAQUE) { const l = JSON.parse(SM.getValue("ca_" + o.s11) || "null"); const hosted = O.ALL.filter((r) => String(SM.getValue("ch_" + r.s11) || "") === String(o.s11)).reduce((s, r) => s + n(SM.getValue("d_" + r.s10)), 0); const net = n(SM.getValue("d_" + o.s11)) - hosted; if (l && net > 0) { kg += l.eci * net; parts.push(`${o.s11}: ${l.eci} × ${net.toFixed(2)}`); } }
    return { parts, MT: (kg / 1000).toFixed(2), perM2: (kg / n(SM.getValue("d_106"))).toFixed(2), d_106: SM.getValue("d_106") }; });
  console.log("launch      ", JSON.stringify(await row()));
  const apply = async (bid, name) => { await p.click(`tr[data-id="${bid}"] td.id-cell`); await p.waitForTimeout(3200); const f = p.frames().find((x) => x.url().includes("-builder")); if (name) { await f.locator(".asm-list .asm-row", { hasText: name }).first().click(); await p.waitForTimeout(400); } await f.click("#embed-apply"); await p.waitForTimeout(1200); };
  await apply("B.10", null); console.log("B.10 applied", JSON.stringify(await row()), JSON.stringify(await hand()));
  await apply("B.5", "R36 2x6"); await apply("B.4", null); console.log("+B.5 +B.4   ", JSON.stringify(await row()), JSON.stringify(await hand()));
  await apply("B.9", "R22 8"); console.log("+B.9 (0 m²) ", JSON.stringify(await row()));
  await p.click('.beam-tab-button[data-tab-id="emissions"]'); await p.waitForTimeout(500); await p.screenshot({ path: process.argv[2] + "/b5.png" });
  // a window hosted in B.5 takes its area off the wall
  await p.evaluate(() => { const SM = window.TEUI.StateManager; SM.setValue("ch_89", "86", "user-modified"); window.TEUI.Calculator.calculateAll(); }); await p.waitForTimeout(1500);
  console.log("window hosted in B.5", JSON.stringify(await row()), JSON.stringify(await hand()));
  await p.click("#op-model-reference"); await p.waitForTimeout(900); console.log("reference   ", JSON.stringify(await row()));
  await p.click("#op-model-target"); await p.waitForTimeout(900); console.log("target again", JSON.stringify(await row()));
  await p.evaluate(async () => { const r = await fetch("src/template/case-studies/04-apartment-necb-small.csv"); window.TEUI.FileHandler.processImportedCSV(await r.text(), { replaceNotes: true }); }); await p.waitForTimeout(3000);
  console.log("other case  ", JSON.stringify(await row()));
  console.log("errors", errs.slice(0, 4)); await b.close();
})();
