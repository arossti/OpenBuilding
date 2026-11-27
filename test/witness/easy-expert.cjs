// Easy / Expert (docs/workplans/REFERENCE-MODEL-EXPLAINED.md, "Easy and Expert modes"): the pill after Copy from
// Target, the page launching in Easy, the spreadsheet's column letters gone in both views. Easy hides the Cell
// IDs (S11's Builder buttons and S10's opening rows excepted); Expert shows every ID in one style, and no row
// draws its own ID twice. Numbers are right-justified, words left-justified, in both views. Interactive help has its own switch,
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
      title: document.querySelector(".popover.show .popover-header") ? getComputedStyle(document.querySelector(".popover.show .popover-header")).color : "",
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
        // a row that draws its own ID a second time, beside a value or leading a caption
        repeats: [...document.querySelectorAll("#beam-main .data-table tr")]
          .map((tr) => {
            const own = tr.querySelector("td.id-cell")?.textContent.trim();
            return own && [...tr.querySelectorAll("td:not(.id-cell)")].some((c) => !c.children.length && (c.textContent.trim() === own || c.textContent.trim().startsWith(own + " "))) ? own : null;
          })
          .filter(Boolean),
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
      // (a row Easy takes away whole is left out of the count: S03's winter average)
      const cells = [...document.querySelectorAll("#beam-main .data-table td")].filter((c) => !c.closest('#climateCalculations tr[data-id="L.3.3"]'));
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
        named: ["B.1", "S.4", "T.6.10", "B.19.3", "F.27"].filter((i) => ids.includes(i)).join(" "),
        wattsS15: text('#teuiSummary tr[data-id="T.6.10"] td').filter((t) => t === "W").length,
        wattsS21: text("#f280Compliance td").filter((t) => t === "W").length,
        metres: text('#climateCalculations tr[data-id="L.2.4"] td').filter((t) => t === "m").length,
        captions: text("#beam-main .data-table td.section-subheader").filter(Boolean)
      };
    });
  const le = await letters();
  ok("no column letter in any header (Easy)", le.found.length === 0, le.found.join("; "));
  ok("row IDs stay", le.named === "B.1 S.4 T.6.10 B.19.3 F.27", `${le.ids} id cells; found: ${le.named}`);
  ok("units stay (W in S15 and S21, m in S03)", le.wattsS15 === 2 && le.wattsS21 >= 9 && le.metres === 1, JSON.stringify([le.wattsS15, le.wattsS21, le.metres]));
  const kept = ["Prices of Energy", "Options related to Section12", "(°C)", "Reference"].filter((c) => le.captions.includes(c));
  ok("captions with a name or a unit stay", kept.length === 4, `${le.captions.length} header captions; found: ${kept.join(" | ")}`);

  // 2b. Easy: the Cell IDs are hidden, S11's Builder buttons excepted; help is on
  const ie = await ids();
  ok("every ID outside the ID column is marked", ie.unmarked.length === 0 && ie.beside >= 60 && ie.leading >= 25, `${ie.beside} beside a value, ${ie.leading} leading a caption; unmarked: ${ie.unmarked.join(" ")}`);
  ok("no row repeats its own ID", ie.repeats.length === 0, ie.repeats.join(" "));
  const s10 = ie.shownNotBuilder.filter((t) => /^G\.[78]\./.test(t));
  ok("Easy hides the Cell IDs, S10's openings excepted", s10.length === ie.shownNotBuilder.length, `${ie.all} IDs, ${ie.shown} shown; not S10's: ${ie.shownNotBuilder.filter((t) => !s10.includes(t)).slice(0, 6).join(" ")}`);
  ok("Easy keeps S11's Builder buttons and S10's opening IDs", ie.builders > 0 && s10.length >= 6 && ie.shown === ie.builders + s10.length, `${ie.builders} buttons, S10: ${s10.join(" ")}`);
  let h = await help();
  ok("help is on in Easy at first", helpIs(h, true), JSON.stringify(h));
  ok("the popover's title is dark on its pale band", h.title === "rgb(31, 35, 40)", h.title);

  // 2c. accounting style: a number is right-justified, words are left-justified, a caption follows its column
  const al = await p.evaluate(() => {
    const NUM = /^[-−]?\$?\s?[\d,]*\.?\d+\s?%?$/;
    const side = (e) => {
      const a = getComputedStyle(e).textAlign;
      return a === "right" || a === "end" ? "right" : a === "center" ? "center" : "left";
    };
    const numbers = { right: 0, left: 0, center: 0 };
    const off = [];
    document.querySelectorAll("#beam-main .data-table tr").forEach((tr) => {
      if (!tr.getClientRects().length || tr.querySelector("td.section-subheader")) return;
      tr.querySelectorAll("td").forEach((td) => {
        if (td.matches(".id-cell, .cell-id, .col-a, .col-c") || td.querySelector("select, input, button")) return;
        const t = td.textContent.trim();
        // S02's licence number is a typed word that happens to be digits
        if (!NUM.test(t) || td.dataset.fieldId === "i_17") return;
        numbers[side(td)]++;
        if (side(td) !== "right" && off.length < 6) off.push((td.dataset.fieldId || td.closest("tr").dataset.id) + "=" + t);
      });
    });
    const f = (sel) => (document.querySelector(sel) ? side(document.querySelector(sel)) : "none");
    return {
      numbers,
      off,
      projectName: f('#buildingInfo td[data-field-id="h_14"]'),
      certifier: f('#buildingInfo td[data-field-id="i_16"]'),
      s14Caption: f("#tediSummary td.col-d.section-subheader"),
      s11Caption: f("#envelopeTransmissionLosses td.col-k.section-subheader"),
      textCaption: f("#envelopeRadiantGains td.col-e.section-subheader")
    };
  });
  ok("every number is right-justified", al.numbers.right > 400 && al.numbers.left + al.numbers.center === 0, `${JSON.stringify(al.numbers)} ${al.off.join(" ")}`);
  ok("typed words stay left-justified", al.projectName === "left" && al.certifier === "left", `${al.projectName} ${al.certifier}`);
  ok("a caption over numbers is right-justified, over words it is not", al.s14Caption === "right" && al.s11Caption === "right" && al.textCaption !== "right", `${al.s14Caption} ${al.s11Caption} ${al.textCaption}`);

  // 2d. S02's prices of gas, propane, wood and oil show only while S.2 is at Utility Bills, in both views and per
  // model; the price of electricity always shows (S15 and S18 read it at Targeted Use too)
  const prices = () =>
    p.evaluate(() => {
      const shown = (id) => getComputedStyle(document.querySelector(`#buildingInfo td[data-field-id="${id}"]`)).visibility === "visible";
      return {
        use: document.querySelector('#buildingInfo select[data-field-id="d_14"]').value,
        flag: document.documentElement.classList.contains("op-targeted-use"),
        electricity: shown("l_12"),
        fuels: ["l_13", "l_14", "l_15", "l_16"].filter(shown).length,
        gas: document.querySelector('#buildingInfo td[data-field-id="l_13"]').textContent.trim()
      };
    });
  const setUse = async (value) => {
    await p.selectOption('#buildingInfo select[data-field-id="d_14"]', value);
    await p.waitForTimeout(900);
  };
  let pr = await prices();
  const gasPrice = pr.gas;
  ok("Utility Bills: all five prices show", pr.use === "Utility Bills" && !pr.flag && pr.electricity && pr.fuels === 4, JSON.stringify(pr));
  await setUse("Targeted Use");
  pr = await prices();
  ok("Targeted Use: the four fuel prices hide, electricity stays (Easy)", pr.flag && pr.electricity && pr.fuels === 0 && pr.gas === gasPrice, JSON.stringify(pr));
  await p.click("#op-view-expert");
  await p.waitForTimeout(300);
  pr = await prices();
  ok("the same in Expert", pr.flag && pr.electricity && pr.fuels === 0, JSON.stringify(pr));
  await p.click("#op-view-easy");
  await setUse("Utility Bills");
  pr = await prices();
  ok("back at Utility Bills they return, the price as typed", !pr.flag && pr.fuels === 4 && pr.gas === gasPrice, JSON.stringify(pr));
  await p.click("#op-model-reference");
  await p.waitForTimeout(2200);
  pr = await prices();
  ok("the Reference follows its own S.2", pr.use === "Targeted Use" && pr.flag && pr.electricity && pr.fuels === 0, JSON.stringify(pr));
  // the IDs are the rows' own, so the Reference shows the Target's
  const refIds = await ids();
  await p.click("#op-model-target");
  await p.waitForTimeout(2200);
  pr = await prices();
  ok("and the Target its own", pr.use === "Utility Bills" && !pr.flag && pr.fuels === 4, JSON.stringify(pr));

  // 2e. the renumbering of 2026-11-27: one ID, one thing
  const numbered = await p.evaluate(() => {
    const where = {};
    document.querySelectorAll("#beam-main .data-table td.id-cell, #beam-main .data-table .cell-id").forEach((e) => {
      const t = e.textContent.trim().replace(/\.$/, "");
      if (t) (where[t] ||= []).push(e.closest(".section").id + (e.classList.contains("id-cell") ? " row" : ""));
    });
    // the same thing named in two places is not a fault: S05 shows S02's S.4, S04 heads two columns E.1,
    // and S14's note on T.4.1 waits for Andy's wording
    const twice = Object.entries(where).filter(([id, v]) => v.length > 1 && !["S.4", "E.1", "T.4.1"].includes(id)).map(([id, v]) => `${id}: ${v.join(", ")}`);
    const at = (id) => (where[id] || []).join(", ");
    return {
      twice,
      placed: { "G.2": at("G.2"), "G.3": at("G.3"), "T.3": at("T.3"), "T.3.1": at("T.3.1"), "C.1": at("C.1"), "C.2": at("C.2"), "L.2.6": at("L.2.6"), "L.3.4": at("L.3.4"), "M.2.6": at("M.2.6"), "V.1.5": at("V.1.5"), "T.4.8": at("T.4.8"), "T.5.5": at("T.5.5"), "T.6.13": at("T.6.13"), "B.18.5.2": at("B.18.5.2"), "W.6.2": at("W.6.2") },
      gone: ["W.X", "L", "A.1", "TEUI-imp", "Heat Load Imp"].filter((t) => [...document.querySelectorAll("#beam-main .data-table td")].some((c) => c.textContent.trim().replace(/\.$/, "") === t)),
      captions: [...document.querySelectorAll("#teuiSummary td")].filter((c) => c.textContent.trim() === "Peak Heating Imp").length
    };
  });
  ok("no ID names two different things", numbered.twice.length === 0, numbered.twice.join(" | "));
  const pl = numbered.placed;
  ok(
    "the new numbers are where they were put",
    pl["G.2"] === "occupantInternalGains row" && pl["G.3"] === "envelopeRadiantGains row" && pl["T.3"] === "teuiSummary row" && pl["T.3.1"] === "actualTargetEnergy row" &&
      ["C.1", "C.2"].every((k) => pl[k] === "buildingInfo") && ["L.2.6", "L.3.4"].every((k) => pl[k] === "climateCalculations") && ["M.2.6", "V.1.5"].every((k) => pl[k] === "mechanicalLoads") &&
      ["T.4.8", "T.5.5"].every((k) => pl[k] === "tediSummary") && pl["T.6.13"] === "teuiSummary" && pl["B.18.5.2"] === "volumeSurfaceMetrics" && pl["W.6.2"] === "waterUse",
    JSON.stringify(pl)
  );
  ok("the stray IDs and the two wrong captions are gone", numbered.gone.length === 0 && numbered.captions === 1, `${numbered.gone.join(" ")} | Peak Heating Imp ×${numbered.captions}`);
  ok("the Reference shows the same IDs as the Target", refIds.all === ie.all && refIds.beside === ie.beside && refIds.leading === ie.leading, `${refIds.all} / ${ie.all}`);

  // 2f. S03 in Easy: the inputs and the essential values show, the secondary values do not
  const s03 = () =>
    p.evaluate(() => {
      const seen = (id) => {
        const td = document.querySelector(`#climateCalculations td[data-field-id="${id}"]`);
        return !!td && td.getClientRects().length > 0 && getComputedStyle(td).visibility === "visible";
      };
      const inputs = ["d_19", "h_19", "h_20", "h_21", "i_21", "m_19", "l_22", "l_24"];
      const kept = ["j_19", "d_20", "d_21", "d_23", "d_24", "h_23", "h_24", "n_23", "n_24"];
      const secondary = ["e_23", "e_24", "e_25", "i_23", "i_24", "d_22", "h_22", "l_20", "l_21", "d_25", "m_23", "m_24"];
      const captions = [...document.querySelectorAll('#climateCalculations tr[data-id="03-ID"] > td')].filter((c) => c.textContent.trim() && getComputedStyle(c).visibility === "visible").map((c) => c.textContent.trim());
      return { inputs: inputs.filter(seen).length + "/" + inputs.length, kept: kept.filter(seen).length + "/" + kept.length, secondary: secondary.filter(seen).length + "/" + secondary.length, captions: captions.join(" ") };
    });
  let c3 = await s03();
  ok("S03 in Easy: every input and the essential values show", c3.inputs === "8/8" && c3.kept === "9/9", JSON.stringify(c3));
  ok("S03 in Easy: the secondary values and the °F captions do not", c3.secondary === "0/12" && !/°F/.test(c3.captions) && /°C/.test(c3.captions), JSON.stringify(c3));

  // F280 Mode On puts the foundation's inputs in S03: Easy hides none of them, and the winter-average row,
  // which carries the foundation's configuration, comes back
  const f280 = async (mode) => {
    await p.selectOption('#f280Compliance select[data-field-id="f280_mode"]', mode);
    await p.waitForTimeout(1500);
    return p.evaluate(() => {
      const s = document.getElementById("climateCalculations");
      const seen = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility === "visible";
      const inputs = [...s.querySelectorAll("td.user-input, td.dropdown-cell, td.slider-cell")];
      return { inputs: inputs.length, seen: inputs.filter(seen).length, row: s.querySelector('tr[data-id="L.3.3"]').getClientRects().length > 0 };
    });
  };
  const on = await f280("On");
  ok("S03 in Easy with F280 Mode On: no input hidden", on.seen === on.inputs && on.inputs >= 14 && on.row, JSON.stringify(on));
  const off = await f280("Off");
  ok("and Off again: the F280 inputs go, the row with them", off.seen < off.inputs && !off.row, JSON.stringify(off));

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
  c3 = await s03();
  ok("S03 in Expert: all of it shows", c3.inputs === "8/8" && c3.kept === "9/9" && c3.secondary === "12/12" && /°F/.test(c3.captions), JSON.stringify(c3));
  const ix = await ids();
  ok("Expert shows every Cell ID", ix.shown === ix.all && ix.all > 200 && ix.repeats.length === 0, `${ix.shown} of ${ix.all}`);
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
    const vis = (id) => getComputedStyle(document.querySelector(`#climateCalculations td[data-field-id="${id}"]`)).visibility;
    const row = getComputedStyle(document.querySelector('#climateCalculations tr[data-id="L.3.3"]')).display;
    return [size('#teuiSummary tr[data-id="T.6.0"] td.id-cell'), size("#teuiSummary td.cell-id"), getComputedStyle(document.querySelector("#beam-main span.cell-id")).display, vis("e_23"), vis("d_22"), vis("d_25"), row];
  });
  await p.emulateMedia({ media: "screen" });
  ok("print shows the IDs in Easy", v.easy && printed[0] > 0 && printed[1] > 0 && printed[2] !== "none", JSON.stringify(printed));
  ok("print shows S03 whole in Easy", printed[3] === "visible" && printed[4] === "visible" && printed[5] === "visible" && printed[6] !== "none", JSON.stringify(printed.slice(3)));

  ok("no page error", errs.length === 0, errs.slice(0, 3).join(" | "));
  console.log(fails ? `${fails} FAILED` : "ALL OK");
  await b.close();
  process.exit(fails ? 1 : 0);
})();
