const { webkit } = require("playwright"); const fs = require("fs");
(async () => {
  const b = await webkit.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  await p.goto("http://localhost:8831/objectivepro.html#transmission"); await p.waitForTimeout(6000);
  const cell = (id) => p.evaluate((id) => { const e = document.querySelector(`[data-field-id="${id}"]`); return e ? e.textContent.trim() : null; }, id);
  const st = async (row, bid) => ({ f: await cell("f_" + row), g: await cell("g_" + row), link: await p.evaluate((r) => window.TEUI.StateManager.getValue("ca_" + r), row), chip: await p.evaluate((bid) => document.querySelector(`tr[data-id="${bid}"] .op-asm-name`)?.textContent || "", bid), linked: await p.evaluate((bid) => document.querySelector(`tr[data-id="${bid}"] td.id-cell`).className, bid) });
  const width = () => p.evaluate(() => { const s = document.getElementById("envelopeTransmissionLosses"); const t = s.querySelector("table"); return { table: Math.round(t.getBoundingClientRect().width), card: Math.round(s.getBoundingClientRect().width), overflow: t.getBoundingClientRect().right > s.getBoundingClientRect().right + 1 }; });
  console.log("before  B.9", JSON.stringify(await st("94", "B.9")), JSON.stringify(await width()));
  const pick = async (bid, name) => {
    await p.click(`tr[data-id="${bid}"] td.id-cell`); await p.waitForTimeout(3500);
    const f = p.frames().find((x) => x.url().includes("assembly-builder"));
    const info = { modal: await p.evaluate(() => !document.getElementById("op-builder-modal").hidden), url: f.url().split("?")[1], sel: await f.evaluate(() => document.querySelector("#asm-list .asm-row.sel .nm").textContent), extras: await f.evaluate(() => [...document.body.children].filter((c) => !c.classList.contains("window") && c.tagName !== "SCRIPT" && c.getClientRects().length).length) };
    if (name) { await f.locator("#asm-list .asm-row", { hasText: name }).first().click(); await p.waitForTimeout(400); }
    info.shown = await f.evaluate(() => ({ sel: document.querySelector("#asm-list .asm-row.sel .nm").textContent, rsi: document.getElementById("f-rsi-eff").textContent, u: document.getElementById("f-u-eff").textContent, eci: document.getElementById("f-eci").textContent }));
    if (bid === "B.9") await p.screenshot({ path: process.argv[2] + "/b2-popup.png" });
    await f.click("#embed-apply"); await p.waitForTimeout(1200);
    info.closed = await p.evaluate(() => document.getElementById("op-builder-modal").hidden);
    return info;
  };
  console.log("open B.9 ", JSON.stringify(await pick("B.9", "R22 8")));
  console.log("after   B.9", JSON.stringify(await st("94", "B.9")), JSON.stringify(await width()));
  console.log("open B.10", JSON.stringify(await pick("B.10", null)));
  console.log("after  B.10", JSON.stringify(await st("95", "B.10")));
  console.log("open B.5 ", JSON.stringify(await pick("B.5", "R36 2x6")));
  console.log("after   B.5", JSON.stringify(await st("86", "B.5")), JSON.stringify(await width()));
  await p.screenshot({ path: process.argv[2] + "/b3-rows.png" });
  // reopen B.9: the row's assembly is the one picked
  await p.click('tr[data-id="B.9"] td.id-cell'); await p.waitForTimeout(3000);
  const f2 = p.frames().find((x) => x.url().includes("assembly-builder"));
  console.log("reopen B.9 →", f2.url().split("?")[1], "| sel:", await f2.evaluate(() => document.querySelector("#asm-list .asm-row.sel .nm").textContent));
  await f2.click("#embed-cancel"); await p.waitForTimeout(400); console.log("cancel closes:", await p.evaluate(() => document.getElementById("op-builder-modal").hidden));
  // save, then type an RSI by hand (the link clears), then load the saved file (the link returns)
  const [dl] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => window.TEUI.FileHandler.exportToCSV())]);
  const csv = fs.readFileSync(await dl.path(), "utf8"); const head = csv.split("\n")[0];
  console.log("saved file carries:", (head.match(/ca_\w+/g) || []).join(" "), "| columns:", head.split(",").length);
  await p.click('[data-field-id="f_94"]'); await p.keyboard.press("Meta+A"); await p.keyboard.type("5.5"); await p.keyboard.press("Tab"); await p.waitForTimeout(800);
  console.log("typed 5.5  ", JSON.stringify(await st("94", "B.9")));
  await p.evaluate((csv) => window.TEUI.FileHandler.processImportedCSV(csv), csv); await p.waitForTimeout(3000);
  console.log("reloaded   ", JSON.stringify(await st("94", "B.9")));
  // a project without assemblies clears them
  await p.evaluate(async () => { const r = await fetch("src/template/case-studies/04-apartment-necb-small.csv"); window.TEUI.FileHandler.processImportedCSV(await r.text(), { replaceNotes: true }); }); await p.waitForTimeout(3000);
  console.log("other case ", JSON.stringify(await st("94", "B.9")), JSON.stringify(await st("86", "B.5")));
  // Reference mode: inert
  await p.click("#op-model-reference"); await p.waitForTimeout(800); await p.click('tr[data-id="B.9"] td.id-cell'); await p.waitForTimeout(500);
  console.log("reference click opens:", await p.evaluate(() => !document.getElementById("op-builder-modal")?.hidden));
  console.log("errors", errs.slice(0, 5)); await b.close();
})();
