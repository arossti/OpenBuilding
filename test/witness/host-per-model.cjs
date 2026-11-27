// An opening's host is per model (schema.md §0 REMAINS 2: S01 m_10 "Unavailable" after Trust).
// Trust's 4-opening write (West wall + 2 windows + 1 door, North wall + 1 window) goes to the Target as
// pdf-bridge-import.mjs writeEnvelope does it; the Reference keeps its own walls, hosts nothing, and computes.
const { webkit } = require("playwright");
const fs = require("fs");
(async () => {
  const b = await webkit.launch();
  const p = await (await b.newContext({ viewport: { width: 1527, height: 970 }, acceptDownloads: true })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  await p.goto("http://localhost:8831/objectivepro.html");
  await p.waitForTimeout(7000);
  const st = () =>
    p.evaluate(() => {
      const SM = window.TEUI.StateManager;
      const kv = {};
      ["e_10", "h_10", "m_10"].forEach((f) => (kv[f] = document.querySelector(`[data-field-id="${f}"]`)?.textContent));
      const hosts = { target: [], reference: [] };
      for (const o of window.TEUI.Openings.ALL) {
        if (SM.getValue("ch_" + o.s11)) hosts.target.push(o.id + "→" + SM.getValue("ch_" + o.s11));
        if (SM.getValue("ref_ch_" + o.s11)) hosts.reference.push(o.id + "→" + SM.getValue("ref_ch_" + o.s11));
      }
      return { kv, walls: ["86", "87a"].map((w) => [SM.getValue("d_" + w), SM.getValue("ref_d_" + w)]), hosts };
    });
  const log = async (l) => console.log(l, JSON.stringify(await st()));
  await log("before:");
  await p.evaluate(() => {
    const env = {
      facings: [
        {
          facing: "West",
          wall: 36,
          openings: [
            { kind: "window", w: 1.5, h: 1.0 },
            { kind: "window", w: 1.2, h: 0.9 },
            { kind: "door", w: 0.9, h: 2.1 }
          ]
        },
        { facing: "North", wall: 30, openings: [{ kind: "window", w: 1.2, h: 1.2 }] }
      ]
    };
    const SM = window.TEUI.StateManager;
    const WALL_ROWS = ["86", ...Array.from({ length: 9 }, (_, i) => "87" + String.fromCharCode(97 + i))];
    const set = (id, v) => SM.setValue(id, String(v), "user-modified");
    const OPEN = window.TEUI.Openings.ALL;
    WALL_ROWS.forEach((r) => set(`d_${r}`, 0));
    for (const o of OPEN) {
      set(`ch_${o.s11}`, "");
      set(`dl_${o.s11}`, "");
      set(`dh_${o.s11}`, "");
      set(`dq_${o.s11}`, 1);
      set(`d_${o.s10}`, 0);
    }
    const free = { window: OPEN.filter((o) => o.kind === "window"), door: OPEN.filter((o) => o.kind === "door") };
    env.facings.forEach((f, i) => {
      const wallRow = WALL_ROWS[i];
      set(`c_${wallRow}`, "walls");
      set(`cf_${wallRow}`, f.facing);
      set(`d_${wallRow}`, f.wall.toFixed(2));
      for (const op of f.openings) {
        const o = free[op.kind].shift();
        set(`ch_${o.s11}`, wallRow);
        set(`dl_${o.s11}`, op.w);
        set(`dh_${o.s11}`, op.h);
        set(`dq_${o.s11}`, 1);
        set(`d_${o.s10}`, +(op.w * op.h).toFixed(4));
        set(`e_${o.s10}`, f.facing);
      }
    });
    window.TEUI.Calculator.calculateAll();
  });
  await p.waitForTimeout(2500);
  await log("after Trust's write (Target only):");
  // the saved file returns each model's hosts
  const [dl] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => window.TEUI.FileHandler.exportToCSV())]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  await p.evaluate(async () => {
    const r = await fetch("src/template/case-studies/04-apartment-necb-small.csv");
    window.TEUI.FileHandler.processImportedCSV(await r.text(), { replaceNotes: true });
  });
  await p.waitForTimeout(3000);
  await p.evaluate((csv) => window.TEUI.FileHandler.processImportedCSV(csv), csv);
  await p.waitForTimeout(3000);
  await log("saved file reloaded:");
  // Copy from Target → All Inputs: the Reference becomes the Target's twin, hosts and all
  await p.click("#op-reference-menu");
  await p.waitForTimeout(300);
  await p.click("#mirrorAllInputsBtn");
  await p.waitForTimeout(2500);
  await log("after Copy from Target, All Inputs:");
  console.log("errors", errs.slice(0, 5));
  await b.close();
})();
