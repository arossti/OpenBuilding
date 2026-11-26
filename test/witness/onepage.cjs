const { chromium, webkit } = require("playwright");
const S = process.argv[2], URL = "http://localhost:8831/objectivepro.html";
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto(URL); await p.waitForTimeout(5000);
  await p.screenshot({ path: `${S}/a-top.png` });
  const info = async (label) => console.log(label, JSON.stringify(await p.evaluate(() => ({
    hash: location.hash, active: document.querySelector(".beam-tab-button.active")?.dataset.tabId,
    cards: document.querySelectorAll(".op-onepage > .op-v3-card").length,
    scrollTop: Math.round(document.getElementById("beam-content").scrollTop),
    scrollH: document.getElementById("beam-content").scrollHeight,
    open: [...document.querySelectorAll(".op-v3-card > .bw-asm-group-body")].filter((x) => !x.hidden).length,
    btn: document.getElementById("op-toggle-all").textContent.trim() }))));
  await info("boot");
  await p.click('.beam-tab-button[data-tab-id="transmission"]'); await p.waitForTimeout(400);
  await info("click S11"); await p.screenshot({ path: `${S}/b-s11.png` });
  await p.mouse.move(800, 500); await p.mouse.wheel(0, 2500); await p.waitForTimeout(500);
  await info("wheel +2500");
  await p.click("#op-toggle-all"); await p.waitForTimeout(300); await info("collapse all"); await p.screenshot({ path: `${S}/c-collapsed.png` });
  await p.click('.beam-tab-button[data-tab-id="teui"]'); await p.waitForTimeout(300); await info("click S15 while collapsed");
  await p.click("#op-toggle-all"); await p.waitForTimeout(200); await info("toggle (one open -> collapse)");
  await p.click("#op-toggle-all"); await p.waitForTimeout(300); await info("expand all");
  await p.click("#op-model-reference"); await p.waitForTimeout(800);
  await p.click('.beam-tab-button[data-tab-id="volume-surface"]'); await p.waitForTimeout(400); await info("reference, S12"); await p.screenshot({ path: `${S}/d-ref-s12.png` });
  await p.click("#op-model-target"); await p.waitForTimeout(500);
  const pdf = await p.pdf({ path: `${S}/print-chromium.pdf`, format: "Letter", printBackground: false });
  console.log("pdf bytes", pdf.length);
  await p.emulateMedia({ media: "print" }); await p.setViewportSize({ width: 816, height: 1056 });
  await p.screenshot({ path: `${S}/e-print-top.png` });
  console.log("errors", errs.slice(0, 6));
  await b.close();
  // deep link + print look in WebKit
  const w = await webkit.launch(); const wp = await (await w.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  await wp.goto(URL + "#mechanical"); await wp.waitForTimeout(5000);
  console.log("webkit deep link", JSON.stringify(await wp.evaluate(() => ({ active: document.querySelector(".beam-tab-button.active")?.dataset.tabId,
    top: Math.round(document.getElementById("beam-panel-mechanical").getBoundingClientRect().top - document.getElementById("beam-content").getBoundingClientRect().top) }))));
  await wp.screenshot({ path: `${S}/f-webkit-s13.png` });
  await wp.emulateMedia({ media: "print" }); await wp.setViewportSize({ width: 816, height: 1056 });
  await wp.screenshot({ path: `${S}/g-webkit-print.png`, fullPage: true });
  await w.close();
})();
