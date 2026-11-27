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
      const RX = /^[A-Z]{1,3}\.\d+[A-Za-z]?(\.(\d+[A-Za-z]?|[A-Z]))*$/;
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
      // (a row Easy takes away whole is left out of the count: S03's winter average, S04's derived totals)
      const gone = '#climateCalculations tr[data-id="L.3.3"], #actualTargetEnergy tr:is([data-id="T.3.7"], [data-id="T.3.8"], [data-id="T.3.9"]), #waterUse tr[data-id="W.6.1"], #indoorAirQuality tr[data-id="A.6"]';
      const cells = [...document.querySelectorAll("#beam-main .data-table td")].filter((c) => !c.closest(gone));
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

  // V3's reading aids (checked in 2g, and in the Reference below): inputs in the accent, Ae / Ag in their
  // colours, the dots, a hairline under each row
  const aids = () =>
    p.evaluate(() => {
      const col = (sel, pseudo) => {
        const e = document.querySelector(sel);
        if (!e) return "none";
        const c = getComputedStyle(e, pseudo);
        return pseudo ? c.backgroundColor : c.color;
      };
      const rows = [...document.querySelectorAll("#envelopeTransmissionLosses .data-table > tbody > tr")].filter((t) => t.getClientRects().length);
      return {
        typed: col('#buildingInfo td[data-field-id="h_15"]'),
        chosen: col('#buildingInfo select[data-field-id="d_12"]'),
        calculated: col('#teuiSummary td[data-field-id="d_135"]'),
        air: col("#envelopeTransmissionLosses td.text-air-facing"),
        ground: col("#envelopeTransmissionLosses td.text-ground-facing"),
        lossHigh: col("#envelopeTransmissionLosses td.loss-high", "::before"),
        lossLow: col("#envelopeTransmissionLosses td.loss-low", "::before"),
        gainHigh: col("#beam-main td.gain-high", "::before"),
        gainLow: col("#beam-main td.gain-low", "::before"),
        medium: col("#beam-main td.gain-medium, #beam-main td.loss-medium", "::before"),
        // every cell of a row draws its piece of the line, and the columns touch
        ruled: rows.every((t) => [...t.children].every((c) => /1px 0px 0px/.test(getComputedStyle(c).boxShadow))),
        spacing: getComputedStyle(document.querySelector("#envelopeTransmissionLosses .data-table")).borderSpacing
      };
    });
  const CYAN = "rgb(34, 211, 238)";
  const RED = "rgb(239, 68, 68)";
  const GREEN = "rgb(34, 197, 94)";
  let ra;

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
  // S04: what shows of the bills, the Target's columns, the factors and the derived totals
  const s04 = () =>
    p.evaluate(() => {
      const seen = (id) => {
        const td = document.querySelector(`#actualTargetEnergy td[data-field-id="${id}"]`);
        return !!td && td.getClientRects().length > 0 && getComputedStyle(td).visibility === "visible" && !/, 0\)$/.test(getComputedStyle(td).color);
      };
      const n = (ids) => ids.filter(seen).length + "/" + ids.length;
      return {
        bills: n(["d_27", "d_28", "d_29", "d_30", "d_31"]),
        actual: n(["f_27", "g_27", "f_32", "g_32"]),
        target: n(["h_27", "j_27", "k_27", "j_32", "k_32"]),
        factors: n(["l_28", "l_29", "l_30", "l_31", "l_33"]),
        derived: n(["d_33", "h_33", "d_34", "f_34", "h_34", "j_34", "l_34", "d_35", "f_35", "j_35", "l_35", "f_36", "j_36"]),
        captions: [...document.querySelectorAll('#actualTargetEnergy tr[data-id="04-ID"] > td')].filter((c) => c.getClientRects().length).map((c) => c.textContent.trim().split(/\s/)[0]).join(" ")
      };
    });
  let c4 = await s04();
  ok("S04 in Easy at Utility Bills: the fuel table whole, the derived totals not shown", c4.bills === "5/5" && c4.actual === "4/4" && c4.target === "5/5" && c4.factors === "5/5" && c4.derived === "0/13", JSON.stringify(c4));

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
  c4 = await s04();
  ok("S04 in Easy at Targeted Use: no Actual column, the Target's and the factors stay", c4.bills === "0/5" && c4.actual === "0/4" && c4.target === "5/5" && c4.factors === "5/5" && !/ACTUAL/.test(c4.captions) && /TARGET/.test(c4.captions), JSON.stringify(c4));
  await p.click("#op-view-expert");
  await p.waitForTimeout(300);
  c4 = await s04();
  // (of the 13 derived values, those in the Actual columns go with them)
  ok("S04 in Expert at Targeted Use: no Actual column either, the rest shows", c4.bills === "0/5" && c4.actual === "0/4" && c4.target === "5/5" && c4.factors === "5/5" && !/ACTUAL/.test(c4.captions) && parseInt(c4.derived) >= 7, JSON.stringify(c4));
  const other = () => p.evaluate(() => !/, 0\)$/.test(getComputedStyle(document.querySelector('#teuiSummary td[data-field-id="l_141"]')).color));
  ok("S15's ∑ Other Energy is not shown at Targeted Use", (await other()) === false);
  await p.click("#op-view-easy");
  await p.waitForTimeout(300);
  ra = await aids();
  ok("in the Reference a typed or chosen value is red, as the accent is", ra.typed === "rgb(255, 138, 138)" && ra.chosen === "rgb(255, 138, 138)", JSON.stringify([ra.typed, ra.chosen]));
  // the IDs are the rows' own, so the Reference shows the Target's
  const refIds = await ids();
  await p.click("#op-model-target");
  await p.waitForTimeout(2200);
  pr = await prices();
  ok("and the Target its own", pr.use === "Utility Bills" && !pr.flag && pr.fuels === 4, JSON.stringify(pr));
  ok("S15's ∑ Other Energy shows at Utility Bills", (await other()) === true);

  // S05 in Easy: the note and the bare compliance percentages go, the ✓ and everything else stay
  const s05 = () =>
    p.evaluate(() => {
      const seen = (sel) => {
        const td = document.querySelector("#emissions " + sel);
        return !!td && td.getClientRects().length > 0 && getComputedStyle(td).visibility === "visible" && !/, 0\)$/.test(getComputedStyle(td).color);
      };
      const f = (id) => `td[data-field-id="${id}"]`;
      const n = (ids) => ids.filter((id) => seen(f(id))).length + "/" + ids.length;
      return { inputs: n(["d_39", "i_41"]), results: n(["d_38", "g_38", "i_38", "i_39", "d_40", "i_40", "d_41"]), marks: n(["n_38", "n_39", "n_40", "n_41"]), percents: n(["m_38", "m_39", "m_40", "m_41"]), note: seen('tr[data-id="E.1.2"] > td.col-j') };
    });
  // S06 holds inputs and subtotals: Easy hides none of it. S07: the inputs and the results show, the steps
  // between do not
  const s0607 = () =>
    p.evaluate(() => {
      const seen = (sec, id) => {
        const td = document.querySelector(`#${sec} td[data-field-id="${id}"]`);
        return !!td && td.getClientRects().length > 0 && getComputedStyle(td).visibility === "visible" && !/, 0\)$/.test(getComputedStyle(td).color);
      };
      const n = (sec, ids) => ids.filter((id) => seen(sec, id)).length + "/" + ids.length;
      return {
        s06: n("onSiteEnergy", ["d_43", "i_43", "m_43", "d_44", "i_44", "d_45", "i_45", "k_45", "d_46", "i_46"]),
        inputs: n("waterUse", ["d_49", "e_49", "e_50", "d_51", "d_52", "d_53"]),
        results: n("waterUse", ["h_49", "i_49", "k_49", "h_50", "i_50", "j_50", "e_51", "j_51", "k_51", "e_53"]),
        marks: n("waterUse", ["n_49", "n_50", "n_52", "n_53"]),
        steps: n("waterUse", ["m_49", "m_50", "m_52", "m_53", "e_52", "j_52", "j_53", "d_54", "j_54", "k_54"]),
        s08inputs: n("indoorAirQuality", ["d_56", "d_57", "d_58", "d_59", "g_59", "i_59"]),
        s08kept: n("indoorAirQuality", ["k_56", "k_57", "k_58", "k_59", "n_56", "n_57", "n_58", "n_59"]),
        s08gone: n("indoorAirQuality", ["m_56", "m_57", "m_58", "m_59", "d_60"])
      };
    });
  let c7 = await s0607();
  ok("S06 in Easy: all of it shows", c7.s06 === "10/10", c7.s06);
  ok("S07 in Easy: inputs, results and ✓ show; the steps between do not", c7.inputs === "6/6" && c7.results === "10/10" && c7.marks === "4/4" && c7.steps === "0/10", JSON.stringify(c7));

  ok("S08 in Easy: inputs, limits and ✓ show; the shares of the limit and the wood offset do not", c7.s08inputs === "6/6" && c7.s08kept === "8/8" && c7.s08gone === "0/5", JSON.stringify([c7.s08inputs, c7.s08kept, c7.s08gone]));

  let c5 = await s05();
  ok("S05 in Easy: inputs, results and ✓ show; the note and the bare percentages do not", c5.inputs === "2/2" && c5.results === "7/7" && c5.marks === "4/4" && c5.percents === "0/4" && !c5.note, JSON.stringify(c5));

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
      placed: { "G.2": at("G.2"), "G.3": at("G.3"), "T.3": at("T.3"), "T.3.1": at("T.3.1"), "C.1": at("C.1"), "C.2": at("C.2"), "L.2.6": at("L.2.6"), "L.3.4": at("L.3.4"), "M.2.6": at("M.2.6"), "V.1.5": at("V.1.5"), "T.4.8": at("T.4.8"), "T.5.5": at("T.5.5"), "T.6.13": at("T.6.13"), "B.18.5.2": at("B.18.5.2"), "W.6.2": at("W.6.2"), "W.2.W": at("W.2.W"), "W.5.3": at("W.5.3"), "G.7.0": at("G.7.0"), "G.7.1": at("G.7.1"), "B.7.0": at("B.7.0") },
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
      ["T.4.8", "T.5.5"].every((k) => pl[k] === "tediSummary") && pl["T.6.13"] === "teuiSummary" && pl["B.18.5.2"] === "volumeSurfaceMetrics" && pl["W.6.2"] === "waterUse" &&
      // as the Sankey names them: SHW Wasted is W.2.W, the first door G.7.0 beside S11's B.7.0
      pl["W.2.W"] === "waterUse" && pl["W.5.3"] === "" && pl["G.7.0"] === "envelopeRadiantGains row" && pl["G.7.1"] === "" && pl["B.7.0"] === "envelopeTransmissionLosses row",
    JSON.stringify(pl)
  );
  ok("the stray IDs and the two wrong captions are gone", numbered.gone.length === 0 && numbered.captions === 1, `${numbered.gone.join(" ")} | Peak Heating Imp ×${numbered.captions}`);
  ok("the Reference shows the same IDs as the Target", refIds.all === ie.all && refIds.beside === ie.beside && refIds.leading === ie.leading, `${refIds.all} / ${ie.all}`);

  // 2f. S03 in Easy: the inputs and the essential values show, the secondary values do not
  const s03 = () =>
    p.evaluate(() => {
      const seen = (id) => {
        const td = document.querySelector(`#climateCalculations td[data-field-id="${id}"]`);
        return !!td && td.getClientRects().length > 0 && getComputedStyle(td).visibility === "visible" && !/, 0\)$/.test(getComputedStyle(td).color);
      };
      const inputs = ["d_19", "h_19", "h_20", "h_21", "i_21", "m_19", "l_22", "l_24"];
      const kept = ["j_19", "d_20", "d_21", "d_23", "d_24", "h_23", "h_24", "n_23", "n_24"];
      const secondary = ["e_23", "e_24", "e_25", "i_23", "i_24", "d_22", "h_22", "l_20", "l_21", "d_25", "m_23", "m_24"];
      const captions = [...document.querySelectorAll('#climateCalculations tr[data-id="03-ID"] > td')].filter((c) => c.textContent.trim() && !/, 0\)$/.test(getComputedStyle(c).color)).map((c) => c.textContent.trim());
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

  // 2g. V3's reading aids, in the Target (the Reference's were read above)
  ra = await aids();
  ok("a typed or chosen value is cyan in the Target, a calculated one is not", ra.typed === CYAN && ra.chosen === CYAN && ra.calculated !== CYAN, JSON.stringify([ra.typed, ra.chosen, ra.calculated]));
  ok("Ae is sky blue and Ag brown in S11", ra.air === "rgb(125, 211, 252)" && ra.ground === "rgb(208, 154, 99)", `${ra.air} ${ra.ground}`);
  ok("the dots: a high loss red, a low loss green; a high gain green, a low gain red; medium yellow", ra.lossHigh === RED && ra.lossLow === GREEN && ra.gainHigh === GREEN && ra.gainLow === RED && ra.medium === "rgb(250, 204, 21)", JSON.stringify([ra.lossHigh, ra.lossLow, ra.gainHigh, ra.gainLow, ra.medium]));
  ok("a hairline under every row, unbroken", ra.ruled && /^0px/.test(ra.spacing), `${ra.ruled} ${ra.spacing}`);

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
  c7 = await s0607();
  ok("S07 and S08 in Expert: all of it shows", c7.steps === "10/10" && c7.inputs === "6/6" && c7.s06 === "10/10" && c7.s08gone === "5/5" && c7.s08kept === "8/8", JSON.stringify(c7));
  c5 = await s05();
  ok("S05 in Expert: all of it shows", c5.percents === "4/4" && c5.note && c5.marks === "4/4", JSON.stringify(c5));
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
    const vis = (id) => (/, 0\)$/.test(getComputedStyle(document.querySelector(`#climateCalculations td[data-field-id="${id}"]`)).color) ? "blank" : "visible");
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
