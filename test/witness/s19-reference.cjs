// S19 (WOMBAT) draws the model on screen (schema.md §0 REMAINS 1): its own inputs are one per model.
// Reference takes a hip roof, aspect 2 and hidden windows; the Target must keep its gable, -2 and windows.
const { webkit } = require("playwright");
const fs = require("fs");
(async () => {
  const out = process.argv[2];
  const b = await webkit.launch();
  const p = await (await b.newContext({ viewport: { width: 1527, height: 970 }, acceptDownloads: true })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  await p.goto("http://localhost:8831/objectivepro.html#wombat");
  await p.waitForTimeout(7000);
  const st = () =>
    p.evaluate(() => {
      const SM = window.TEUI.StateManager;
      const q = (s) => document.querySelector(s);
      const state = {};
      ["d_154", "d_159", "d_160"].forEach((i) => (state[i] = [SM.getValue(i), SM.getValue("ref_" + i)]));
      const svg = q("#wombat-svg");
      const s = svg ? svg.innerHTML : "";
      let h = 0;
      for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return {
        mode: window.TEUI.ReferenceToggle.getCurrentMode(),
        state,
        shown: {
          aspect: q('#wombat [data-field-id="d_154"] input[type="range"]')?.value,
          caption: q('#wombat [data-field-id="d_154"] .slider-value')?.textContent,
          roof: q('#wombat select[data-dropdown-id="dd_d_159"]')?.value,
          windows: q('#wombat select[data-dropdown-id="dd_d_160"]')?.value,
          L: q('#wombat [data-field-id="h_155"]')?.textContent.trim(),
          W: q('#wombat [data-field-id="h_157"]')?.textContent.trim()
        },
        title: [...(svg?.querySelectorAll("text") || [])].map((t) => t.textContent).find((t) => /WOMBAT/.test(t)),
        svgHash: h
      };
    });
  const mode = async (m) => {
    await p.click(m === "reference" ? "#op-model-reference" : "#op-model-target");
    await p.waitForTimeout(1200);
  };
  const log = async (l) => {
    const s = await st();
    console.log(l, JSON.stringify(s));
    return s;
  };
  await p.click("#wombat-activate-btn");
  await p.waitForTimeout(1200);
  const t0 = await log("TARGET, start:");
  await mode("reference");
  await p.selectOption('#wombat select[data-dropdown-id="dd_d_159"]', "multiplanar");
  await p.waitForTimeout(800);
  await p.selectOption('#wombat select[data-dropdown-id="dd_d_160"]', "hide");
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const r = document.querySelector('[data-field-id="d_154"] input[type="range"]');
    r.value = "2";
    r.dispatchEvent(new Event("input", { bubbles: true }));
    r.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await p.waitForTimeout(1000);
  const r1 = await log("REFERENCE, hip + aspect 2 + windows hidden:");
  if (out) await p.screenshot({ path: out + "/s19-reference.png" });
  await mode("target");
  const t1 = await log("TARGET, after the Reference's edits:");
  if (out) await p.screenshot({ path: out + "/s19-target.png" });
  console.log(
    "target drawing unchanged:",
    t0.svgHash === t1.svgHash,
    "| target controls unchanged:",
    JSON.stringify(t0.shown) === JSON.stringify(t1.shown)
  );
  // the saved file brings both back
  const [dl] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => window.TEUI.FileHandler.exportToCSV())]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  await p.evaluate(async () => {
    const r = await fetch("src/template/case-studies/04-apartment-necb-small.csv");
    window.TEUI.FileHandler.processImportedCSV(await r.text(), { replaceNotes: true });
  });
  await p.waitForTimeout(3000);
  console.log("other project:", JSON.stringify((await st()).state));
  await p.evaluate((csv) => window.TEUI.FileHandler.processImportedCSV(csv), csv);
  await p.waitForTimeout(3000);
  await p.click("#wombat-activate-btn");
  await p.waitForTimeout(1200);
  const t2 = await log("saved file reloaded (Target):");
  await mode("reference");
  const r2 = await log("saved file reloaded (Reference):");
  console.log("reload returns both drawings:", t2.svgHash === t0.svgHash, r2.svgHash === r1.svgHash);
  console.log("errors", errs.slice(0, 5));
  await b.close();
})();
