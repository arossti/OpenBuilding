// Easy / Expert (docs/workplans/REFERENCE-MODEL-EXPLAINED.md, "Easy and Expert modes"): the pill after Copy from
// Target, the page launching in Easy, the spreadsheet's column letters gone in both views. Easy hides the Cell
// IDs (S11's Builder buttons excepted); Expert shows every ID in one style. Interactive help has its own switch,
// on in Easy and off in Expert until changed. The view is display only: every value, every cell's place and the
// saved file are the same in both. Optional <out>: a folder for screenshots of the button row.
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
  const closed = () => p.evaluate(() => [...document.querySelectorAll(".op-v3-card > .bw-asm-group-body")].filter((x) => x.hidden).length);
  const openAll = async () => {
    for (let i = 0; i < 2 && (await closed()) > 0; i++) {
      await p.click("#op-toggle-all"); // − closes them all, then + opens them all
      await p.waitForTimeout(400);
    }
  };
  // interactive help: the button, V3's manager, and whether a field's popover really opens
  const help = async () => {
    await openAll(); // a launch opens S01 only
    await p.mouse.move(5, 5);
    await p.waitForTimeout(250);
    const field = '#buildingInfo [data-bs-toggle="popover"]';
    await p.locator(field).first().scrollIntoViewIfNeeded();
    await p.locator(field).first().hover();
    await p.waitForTimeout(1100);
    const r = await p.evaluate(() => ({
      pressed: document.getElementById("op-help-toggle").getAttribute("aria-pressed") === "true",
      manager: window.TEUI.TooltipManager.isEnabled(),
      opens: !!document.querySelector(".popover.show"),
      fields: document.querySelectorAll('[data-bs-toggle="popover"]').length
    }));
    await p.mouse.move(5, 5);
    await p.waitForTimeout(400);
    return r;
  };
  const helpIs = (h, on) => h.pressed === on && h.manager === on && h.opens === on;
  // the IDs: which show, and in what style
  const ids = () =>
    p.evaluate(() => {
      const style = (e) => {
        const c = getComputedStyle(e);
        return [c.fontFamily, c.fontSize, c.fontWeight, c.color, c.letterSpacing].join(" | ");
      };
      const all = [...document.querySelectorAll("#beam-main .data-table td.id-cell, #beam-main .data-table .cell-id")].filter(
        (e) => e.textContent.trim() && e.closest("tr").getClientRects().length > 0
      );
      const shown = all.filter((e) => e.getClientRects().length > 0 && parseFloat(getComputedStyle(e).fontSize) > 0);
      const RX = /^[A-Z]{1,3}\.\d+[A-Za-z]?(\.\d+[A-Za-z]?)*$/;
      const unmarked = [...document.querySelectorAll("#beam-main .data-table td:not(.id-cell):not(.cell-id)")]
        .filter((c) => !c.children.length && RX.test(c.textContent.trim()))
        .map((c) => c.textContent.trim());
      return {
        all: all.length,
        beside: document.querySelectorAll("#beam-main .data-table td.cell-id").length,
        leading: document.querySelectorAll("#beam-main .data-table span.cell-id").length,
        shown: shown.length,
        shownNotBuilder: shown.filter((e) => !e.classList.contains("op-asm-btn")).map((e) => e.textContent.trim()),
        builders: all.filter((e) => e.classList.contains("op-asm-btn")).length,
        styles: [...new Set(shown.map(style))],
        rowId: style(document.querySelector('#teuiSummary tr[data-id="T.6.0"] td.id-cell')),
        unmarked
      };
    });
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
  await openAll();
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

  // 2b. Easy: the Cell IDs are hidden, S11's Builder buttons excepted; help is on
  const ie = await ids();
  ok("every ID outside the ID column is marked", ie.unmarked.length === 0 && ie.beside >= 70 && ie.leading >= 33, `${ie.beside} beside a value, ${ie.leading} leading a caption; unmarked: ${ie.unmarked.join(" ")}`);
  ok("Easy hides the Cell IDs", ie.shownNotBuilder.length === 0, `${ie.all} IDs, ${ie.shown} shown; ${ie.shownNotBuilder.slice(0, 6).join(" ")}`);
  ok("Easy keeps S11's Builder buttons", ie.builders > 0 && ie.shown === ie.builders, `${ie.builders} buttons, ${ie.shown} IDs shown`);
  let h = await help();
  ok("help is on in Easy at first", helpIs(h, true), JSON.stringify(h));

  // 3. Expert shows the same page: the view changes no value and moves no cell
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
  ok("every cell keeps its place", easy.shown === expert.shown && easy.cells === expert.cells, `${easy.shown} of ${easy.cells} cells laid out in Easy, ${expert.shown} of ${expert.cells} in Expert`);
  const ix = await ids();
  ok("Expert shows every Cell ID", ix.shown === ix.all && ix.all > 200, `${ix.shown} of ${ix.all}`);
  ok("every ID in one style, the ID column's", ix.styles.length === 1 && ix.styles[0] === ix.rowId, `${ix.styles.length} style(s): ${ix.styles.join(" || ")}`);
  h = await help();
  ok("help is off in Expert at first", helpIs(h, false), JSON.stringify(h));
  await p.click("#op-help-toggle");
  h = await help();
  ok("the Help button turns it on in Expert", helpIs(h, true), JSON.stringify(h));
  await p.click("#op-view-easy");
  await p.waitForTimeout(400);
  await p.click("#op-help-toggle");
  h = await help();
  ok("turned off in Easy: Easy's own setting", helpIs(h, false), JSON.stringify(h));
  await p.click("#op-view-expert");
  await p.waitForTimeout(400);
  h = await help();
  ok("Expert kept its own setting", helpIs(h, true), JSON.stringify(h));
  const stamp = (s) => s.replace(/\d{4}-\d{2}-\d{2}[T ][\d:.]+Z?/g, "<time>");
  ok("the saved file is the same in both views", stamp(easyCsv) === stamp(expertCsv), `${easyCsv.length} characters`);
  const lx = await letters();
  ok("no column letter in any header (Expert)", lx.found.length === 0, lx.found.join("; "));

  // 4. the view is the browser's: it survives a reload and a new project, and it is not in the file
  ok("the view and the help setting are not in the saved file", !/objective4View|objective4Help|op-easy|\bexpert\b/i.test(expertCsv));
  await p.reload();
  await p.waitForTimeout(6000);
  v = await view();
  ok("Expert is remembered across a reload", !v.easy && v.pill && v.active === "expert", JSON.stringify(v));
  h = await help();
  ok("each view's help setting is remembered", helpIs(h, true), JSON.stringify(h));
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

  // 6. print shows the full report whatever the view: in Easy, the IDs are on the printed page
  await p.emulateMedia({ media: "print" });
  const printed = await p.evaluate(() => {
    const size = (sel) => parseFloat(getComputedStyle(document.querySelector(sel)).fontSize);
    return [size('#teuiSummary tr[data-id="T.6.0"] td.id-cell'), size("#teuiSummary td.cell-id"), getComputedStyle(document.querySelector("#beam-main span.cell-id")).display];
  });
  await p.emulateMedia({ media: "screen" });
  ok("print shows the IDs in Easy", v.easy && printed[0] > 0 && printed[1] > 0 && printed[2] !== "none", JSON.stringify(printed));

  ok("no page error", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(fails ? `${fails} FAILED` : "ALL OK");
  await b.close();
  process.exit(fails ? 1 : 0);
})();
