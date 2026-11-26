const { webkit } = require("playwright"); const fs = require("fs");
(async () => {
  const b = await webkit.launch(); const p = await (await b.newContext({ viewport: { width: 1527, height: 970 }, acceptDownloads: true })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  await p.goto("http://localhost:8831/objectivepro.html#transmission"); await p.waitForTimeout(6000);
  const st = (row, bid) => p.evaluate(([row, bid]) => ({ g: document.querySelector(`[data-field-id="g_${row}"]`)?.textContent.trim(), link: window.TEUI.StateManager.getValue("ca_" + row), chip: document.querySelector(`tr[data-id="${bid}"] .op-asm-name`)?.textContent || "", idClass: document.querySelector(`tr[data-id="${bid}"] td.id-cell`)?.className, title: document.querySelector(`tr[data-id="${bid}"] td.id-cell`)?.title }), [row, bid]);
  const width = () => p.evaluate(() => { const s = document.getElementById("envelopeTransmissionLosses"); const t = s.querySelector("table"); return Math.round(t.getBoundingClientRect().right - s.getBoundingClientRect().right); });
  console.log("before B.8.1", JSON.stringify(await st("89", "B.8.1")));
  const pick = async (bid, name) => {
    await p.click(`tr[data-id="${bid}"] td.id-cell`); await p.waitForTimeout(3500);
    const f = p.frames().find((x) => x.url().includes("opening-builder"));
    if (!f) return { noFrame: p.frames().map((x) => x.url().slice(-60)) };
    const info = { url: f.url().split("?")[1], sel: await f.evaluate(() => document.querySelector("#list .asm-row.sel .nm").textContent), extras: await f.evaluate(() => [...document.body.children].filter((c) => !c.classList.contains("window") && c.tagName !== "SCRIPT" && c.getClientRects().length).length), docScroll: await f.evaluate(() => Math.round(scrollY)) };
    if (name) { await f.locator("#list .asm-row", { hasText: name }).first().click(); await p.waitForTimeout(500); }
    info.shown = await f.evaluate(() => ({ sel: document.querySelector("#list .asm-row.sel .nm").textContent, uw: document.getElementById("f-uw").textContent, cert: document.getElementById("f-cert-uw").textContent }));
    if (bid === "B.8.1") await p.screenshot({ path: process.argv[2] + "/b4-popup.png" });
    await f.click("#embed-apply"); await p.waitForTimeout(1200);
    info.closed = await p.evaluate(() => document.getElementById("op-builder-modal").hidden);
    return info;
  };
  console.log("open B.8.1 ", JSON.stringify(await pick("B.8.1", "EnerSign | primus Tilt")));
  console.log("after B.8.1", JSON.stringify(await st("89", "B.8.1")), "| overflow px:", await width());
  console.log("open B.7.0 ", JSON.stringify(await pick("B.7.0", null)));
  console.log("after B.7.0", JSON.stringify(await st("88", "B.7.0")));
  console.log("open B.8.5 ", JSON.stringify(await pick("B.8.5", null)));
  console.log("after B.8.5", JSON.stringify(await st("93", "B.8.5")));
  console.log("open B.8.2 ", JSON.stringify(await pick("B.8.2", "EPAL | Fixed")));
  console.log("after B.8.2", JSON.stringify(await st("90", "B.8.2")));
  await p.screenshot({ path: process.argv[2] + "/b4-rows.png" });
  const [dl] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => window.TEUI.FileHandler.exportToCSV())]);
  const csv = fs.readFileSync(await dl.path(), "utf8"); console.log("saved file carries:", (csv.split("\n")[0].match(/ca_\w+/g) || []).join(" "));
  await p.click('[data-field-id="g_89"]'); await p.keyboard.press("Meta+A"); await p.keyboard.type("1.1"); await p.keyboard.press("Tab"); await p.waitForTimeout(800);
  console.log("typed 1.1   ", JSON.stringify(await st("89", "B.8.1")));
  await p.evaluate((csv) => window.TEUI.FileHandler.processImportedCSV(csv), csv); await p.waitForTimeout(3000);
  console.log("reloaded    ", JSON.stringify(await st("89", "B.8.1")));
  await p.click('tr[data-id="B.8.1"] td.id-cell'); await p.waitForTimeout(3000);
  const f2 = p.frames().find((x) => x.url().includes("opening-builder"));
  console.log("reopen →", f2.url().split("?")[1], "| sel:", await f2.evaluate(() => document.querySelector("#list .asm-row.sel .nm").textContent));
  await f2.click("#embed-cancel"); await p.waitForTimeout(400);
  // the assembly rows still work beside it
  await p.click('tr[data-id="B.9"] td.id-cell'); await p.waitForTimeout(3000);
  console.log("B.9 opens:", p.frames().find((x) => x.url().includes("-builder"))?.url().split("/").pop());
  console.log("errors", errs.slice(0, 5)); await b.close();
})();
