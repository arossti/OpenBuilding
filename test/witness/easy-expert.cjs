// The Easy / Expert stub (docs/workplans/REFERENCE-MODEL-EXPLAINED.md, "Easy and Expert modes"): the pill after
// Copy from Target, the page launching in Easy, the spreadsheet's column letters gone in both views, and nothing
// else hidden yet. The view is display only: every value, every shown cell and the saved file are the same in
// both. Optional <out>: a folder for screenshots of the button row.
const { webkit } = require("playwright");
const fs = require("fs");
const out = process.argv[2];
const URL = process.env.OBJ_URL || "http://localhost:8831/objectivepro.html";
(async () => {
  const b = await webkit.launch();
  const p = await (await b.newContext({ viewport: { width: 1527, height: 970 }, acceptDownloads: true })).newPage();
  const errs = [];
  let fails = 0;
  const ok = (name, pass, note = "") => {
    if (!pass) fails++;
    console.log(pass ? "ok  " : "FAIL", name, note);
  };
  p.on("pageerror", (e) => errs.push(String(e)));
  p.on("dialog", (d) => d.accept());
  // no view is stored: this is a first launch
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  await p.goto(URL);
  await p.waitForTimeout(7000);

  const view = () =>
    p.evaluate(() => ({
      easy: document.documentElement.classList.contains("op-easy"),
      pill: document.getElementById("op-view-switch").checked,
      active: [...document.querySelectorAll(".op-view-label.active")].map((l) => l.dataset.view).join(","),
      stored: localStorage.getItem("objective4View"),
      model: document.body.classList.contains("reference-mode") ? "reference" : "target"
    }));
  // every value on the page, typed or calculated, and how many cells are shown
  const snap = () =>
    p.evaluate(() => {
      const values = {};
      document.querySelectorAll("#beam-main [data-field-id]").forEach((el) => {
        const id = el.getAttribute("data-field-id") + (el.tagName === "TD" ? "" : ":" + el.tagName);
        values[id] = el.tagName === "SELECT" || el.tagName === "INPUT" ? el.value : el.textContent.trim();
      });
      const cells = [...document.querySelectorAll("#beam-main .data-table td")];
      return { values, cells: cells.length, shown: cells.filter((c) => c.getClientRects().length > 0).length };
    });
  const save = async () => {
    const [dl] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => window.TEUI.FileHandler.exportToCSV())]);
    return fs.readFileSync(await dl.path(), "utf8");
  };
  const same = (a, c) => Object.keys({ ...a, ...c }).filter((k) => a[k] !== c[k]);

  // 1. the launch
  let v = await view();
  ok("launches in Easy", v.easy && !v.pill && v.active === "easy", JSON.stringify(v));
  const place = await p.evaluate(() => {
    const t = document.querySelector(".op-view-toggle");
    return {
      afterCopy: !!t.previousElementSibling?.querySelector("#op-reference-menu"),
      inRow: t.parentElement.id,
      labels: [...t.querySelectorAll("button")].map((x) => x.textContent.trim()).join(" · ")
    };
  });
  ok("the pill follows Copy from Target", place.afterCopy && place.inRow === "beam-action-bar", JSON.stringify(place));

  // open every section, so "shown" counts each section's cells
  const closed = () => p.evaluate(() => [...document.querySelectorAll(".op-v3-card > .bw-asm-group-body")].filter((x) => x.hidden).length);
  for (let i = 0; i < 2 && (await closed()) > 0; i++) {
    await p.click("#op-toggle-all"); // − closes them all, then + opens them all
    await p.waitForTimeout(400);
  }
  ok("every section open for the count", (await closed()) === 0);

  // 2. the column letters: no header cell's whole caption is its own column's letter; row IDs and units stay
  const letters = () =>
    p.evaluate(() => {
      const found = [];
      const text = (sel) => [...document.querySelectorAll(sel)].map((c) => c.textContent.trim());
      document.querySelectorAll("#beam-main .data-table td").forEach((td) => {
        const col = (td.className.match(/\bcol-([a-z])\b/) || [])[1];
        const t = td.textContent.trim();
        if (col && col !== "b" && t.length === 1 && t.toLowerCase() === col && t === t.toUpperCase()) {
          found.push(td.closest(".section")?.id + " " + t);
        }
      });
      const ids = text("#beam-main .data-table td.id-cell");
      return {
        found,
        ids: ids.length,
        named: ["B.1", "L", "T.6.10", "B.19.3", "F.27"].filter((i) => ids.includes(i)).join(" "),
        wattsS15: text('#teuiSummary tr[data-id="T.6.10"] td').filter((t) => t === "W").length,
        wattsS21: text("#f280Compliance td").filter((t) => t === "W").length,
        metres: text('#climateCalculations tr[data-id="L.2.4"] td').filter((t) => t === "m").length,
        captions: text("#beam-main .data-table td.section-subheader").filter(Boolean)
      };
    });
  const le = await letters();
  ok("no column letter in any header (Easy)", le.found.length === 0, le.found.join("; "));
  ok("row IDs stay", le.named === "B.1 L T.6.10 B.19.3 F.27", `${le.ids} id cells; found: ${le.named}`);
  ok("units stay (W in S15 and S21, m in S03)", le.wattsS15 === 2 && le.wattsS21 >= 9 && le.metres === 1, JSON.stringify([le.wattsS15, le.wattsS21, le.metres]));
  const kept = ["Prices of Energy", "Options related to Section12", "(°C)", "Reference"].filter((c) => le.captions.includes(c));
  ok("captions with a name or a unit stay", kept.length === 4, `${le.captions.length} header captions; found: ${kept.join(" | ")}`);

  // 3. Expert shows the same page: the view changes no value and hides nothing yet
  const easy = await snap();
  const easyCsv = await save();
  if (out) await (await p.$("#beam-action-bar")).screenshot({ path: `${out}/easy-expert-row-easy.png` });
  await p.click("#op-view-switch");
  await p.waitForTimeout(600);
  v = await view();
  ok("the pill switches to Expert", !v.easy && v.pill && v.active === "expert" && v.stored === "expert", JSON.stringify(v));
  const expert = await snap();
  const expertCsv = await save();
  if (out) await (await p.$("#beam-action-bar")).screenshot({ path: `${out}/easy-expert-row-expert.png` });
  const dv = same(easy.values, expert.values);
  ok("every value the same in both views", dv.length === 0, `${Object.keys(easy.values).length} values; differ: ${dv.slice(0, 5).join(" ")}`);
  ok("nothing hidden yet", easy.shown === expert.shown && easy.cells === expert.cells, `${easy.shown} of ${easy.cells} cells shown in Easy, ${expert.shown} of ${expert.cells} in Expert`);
  const stamp = (s) => s.replace(/\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?/g, "<time>");
  ok("the saved file is the same in both views", stamp(easyCsv) === stamp(expertCsv), `${easyCsv.length} characters`);
  const lx = await letters();
  ok("no column letter in any header (Expert)", lx.found.length === 0, lx.found.join("; "));

  // 4. the view is the browser's: it survives a reload and a new project, and it is not in the file
  ok("the view is not in the saved file", !/objective4View|op-easy|\bexpert\b/i.test(expertCsv));
  await p.reload();
  await p.waitForTimeout(6000);
  v = await view();
  ok("Expert is remembered across a reload", !v.easy && v.pill && v.active === "expert", JSON.stringify(v));
  await p.click("#beam-new-project"); // confirms, clears the project, reloads
  await p.waitForTimeout(6500);
  v = await view();
  ok("a new project keeps the view", !v.easy && v.stored === "expert", JSON.stringify(v));

  // 5. the view and the model on screen are independent
  await p.click("#op-model-reference");
  await p.waitForTimeout(1500);
  await p.click("#op-view-easy");
  await p.waitForTimeout(400);
  v = await view();
  ok("Easy in the Reference model: the model stays", v.easy && v.active === "easy" && v.model === "reference", JSON.stringify(v));
  if (out) await (await p.$("#beam-action-bar")).screenshot({ path: `${out}/easy-expert-row-reference.png` });
  await p.click("#op-model-target");
  await p.waitForTimeout(1500);
  v = await view();
  ok("back to the Target: the view stays", v.easy && v.model === "target", JSON.stringify(v));

  ok("no page error", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(fails ? `${fails} FAILED` : "ALL OK");
  await b.close();
  process.exit(fails ? 1 : 0);
})();
