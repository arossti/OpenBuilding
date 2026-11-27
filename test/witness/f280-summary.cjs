// The F280 calculation summary sheet (schema.md §0, A2 / triage T8; src/core/F280Summary.js, f280-summary.html):
// CSA F280-12 Cl. 7.1 a) asks a report for the input data of Annex D's summary sheet, and Cl. 8.3.2 a) - b) has the
// verification agent review it against Annex D and Table E.1.
//
//   export NODE_PATH=../andy-rnd/node_modules
//   node test/witness/f280-summary.cjs [out dir]     # with an out dir: the sheet's print PDF, by the machine's Chrome
//
// On case 02 with F280 Mode On. What must hold:
//   - the sheet lists Table E.1's 64 fields, numbered 1 to 64 in order, each held, not entered, not carried or not needed;
//   - its values are the sections' own (occupants, the design temperatures, the wall's RSI);
//   - S21's record is per model: a Reference field typed keeps its own text beside the Target's (one left empty
//     takes the Target's, as every Reference input does), and each model's sheet shows its own; a different
//     wall RSI in the Reference shows in the Reference's sheet alone;
//   - no design load moves when the record is filled in (the record enters no calculation);
//   - the saved file brings both models' record back as typed - "496 Fake Street" and "0402-96" whole, which an
//     import cut to their leading number before 2026-11-26;
//   - Copy from Target, All Inputs carries the record to the Reference;
//   - F280 Mode Off hides the record and the button;
//   - the button opens the sheet in its own tab, which draws the 64 fields and has a Print button.
const { webkit, chromium } = require("playwright");
const fs = require("fs");
const URL = process.argv.find((a) => /^https?:/.test(a)) || "http://localhost:8831/objectivepro.html";
const OUT = process.argv.slice(2).find((a) => !/^https?:/.test(a));

let failed = 0;
const check = (what, ok, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail === undefined ? "" : ` | ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`);
};

async function start(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1527, height: 970 }, acceptDownloads: true });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  const started = p.waitForResponse((r) => /src\/template\/case-studies\/.+\.csv/.test(r.url()));
  await p.goto(URL);
  await started;
  await p.waitForTimeout(3500);
  const load = async (file) => {
    await p.evaluate(async (f) => {
      const r = await fetch(`src/template/case-studies/${f}`);
      window.TEUI.FileHandler.processImportedCSV(await r.text(), { replaceNotes: true });
    }, file);
    await p.waitForTimeout(4000);
  };
  const f280 = async (value) => {
    await p.evaluate((v) => {
      const sel = document.querySelector('select[data-field-id="f280_mode"]');
      sel.value = v;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await p.waitForTimeout(2500);
  };
  return { ctx, p, errs, load, f280 };
}

(async () => {
  const b = await webkit.launch();
  const { ctx, p, errs, load, f280 } = await start(b);
  await load("02-residence-sb12-net-zero-f280.csv");
  await f280("On");

  const mode = async (m) => {
    await p.click(m === "reference" ? "#op-model-reference" : "#op-model-target");
    await p.waitForTimeout(1200);
  };
  const sheet = () => p.evaluate(() => window.TEUI.F280Summary.build());
  const byNo = (s) => Object.fromEntries(s.groups.flatMap((g) => g.fields).map((f) => [f.no, f]));
  // as a user: type into the cell and leave it; pick from the dropdown
  const type = (id, text) =>
    p.evaluate(
      ([id, text]) => {
        const td = document.querySelector(`#f280Compliance [data-field-id="${id}"]`);
        td.focus();
        td.textContent = text;
        td.dispatchEvent(new FocusEvent("blur"));
      },
      [id, text]
    );
  const pick = (id, value) =>
    p.evaluate(
      ([id, value]) => {
        const sel = document.querySelector(`#f280Compliance select[data-field-id="${id}"]`);
        sel.value = value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      },
      [id, value]
    );
  const shown = (id) =>
    p.evaluate((id) => {
      const el = document.querySelector(`#f280Compliance select[data-field-id="${id}"]`) || document.querySelector(`#f280Compliance [data-field-id="${id}"]`);
      return el ? (el.tagName === "SELECT" ? el.value : el.textContent.trim()) : null;
    }, id);
  const loads = () =>
    p.evaluate(() => {
      const T = window.TEUI, s = T.ComputationIntegration.getState();
      const ids = [s.getActiveModelId(), T.ComputationIntegration.getRefModelId()];
      return ids.map((id) => ["f280.totalDesignHeatLoss", "f280.totalSensibleHeatGain", "f280.nominalCoolingCapacity"].map((k) => s.getValueForModel(id, k)));
    });

  // ---- the 64 fields ----
  const s0 = await sheet();
  const numbered = s0.groups.flatMap((g) => g.fields).filter((f) => f.no !== null);
  check("Table E.1's 64 fields, numbered 1 to 64 in order", numbered.length === 64 && numbered.every((f, i) => f.no === i + 1), numbered.length);
  const c = s0.counts;
  check("every field is held, not entered, not carried or not needed", c.held + c.blank + c.none + c.unused === 64 && numbered.every((f) => ["held", "blank", "none", "unused"].includes(f.state)), c);
  check("the one field not carried is the interior shading (21)", c.none === 1 && byNo(s0)[21].state === "none");
  check("a field left empty reads not entered, never a made-up value", byNo(s0)[4].state === "blank" && byNo(s0)[4].value === "");

  // ---- the sections' own values ----
  const own = await p.evaluate(() => {
    const T = window.TEUI, s = T.ComputationIntegration.getState(), id = s.getActiveModelId();
    const cell = (f) => document.querySelector(`[data-field-id="${f}"]`)?.textContent.trim();
    return { occupants: cell("d_63"), coldest: s.getValueForModel(id, "climate.temperature.coldest"), hottest: s.getValueForModel(id, "climate.temperature.hottest"), rsi: cell("f_86"), city: T.StateManager.getValue("h_19") };
  });
  check("occupants are S09's", parseFloat(byNo(s0)[22].value) === parseFloat(own.occupants), [byNo(s0)[22].value, own.occupants]);
  check("the design temperatures are S03's", byNo(s0)[24].value === `${own.coldest} °C` && byNo(s0)[27].value === `${own.hottest} °C`, [byNo(s0)[24].value, byNo(s0)[27].value]);
  check("the wall style's RSI is S11's", byNo(s0)[31].value.includes(`RSI ${parseFloat(own.rsi).toFixed(2)}`), [byNo(s0)[31].value, own.rsi]);
  check("the weather location is S03's city", byNo(s0)[12].value.startsWith(own.city), byNo(s0)[12].value);

  // ---- the record, per model ----
  const before = await loads();
  const TARGET = { f280_issued_for: "Doe Construction, Ltd.", f280_proj_num: "0402-96", f280_address: "496 Fake Street", f280_lot: "16", f280_postal: "M6J 2P9", f280_dsgn_phone: "888-555-4321", f280_dsgn_name: "J. Smith", f280_notes: 'Client asked for 24 °C, "as built"' };
  const REFERENCE = { f280_address: "12 Other Road", f280_dsgn_phone: "416 555 0000" };
  for (const [id, v] of Object.entries(TARGET)) await type(id, v);
  await pick("f280_front_facing", "Southwest");
  await pick("f280_facing_assumed", "Yes");
  await mode("reference");
  // an empty Reference input takes the Target's, as every Reference input does (ComputationIntegration
  // populateReferenceModel); a choice has its own default, so it starts as its own
  check("an empty Reference field takes the Target's; a choice starts as its own", (await shown("f280_address")) === TARGET.f280_address && (await shown("f280_front_facing")) === "Not recorded", [await shown("f280_address"), await shown("f280_front_facing")]);
  for (const [id, v] of Object.entries(REFERENCE)) await type(id, v);
  await pick("f280_front_facing", "North");
  // a different wall in the Reference, typed in S11 as a user would
  await p.evaluate(() => {
    const td = document.querySelector('[data-field-id="f_86"]');
    td.focus();
    td.textContent = "4.00";
    td.dispatchEvent(new FocusEvent("blur"));
  });
  await p.waitForTimeout(2000);
  const sRef = await sheet();
  await mode("target");
  const sTgt = await sheet();
  check("the Target's cells show the Target's record again", (await shown("f280_address")) === TARGET.f280_address && (await shown("f280_front_facing")) === "Southwest", [await shown("f280_address"), await shown("f280_front_facing")]);
  check("each model's sheet names its model", sTgt.model === "Target" && sRef.model === "Reference");
  check("the Target's sheet holds the Target's record", byNo(sTgt)[4].value === "496 Fake Street" && byNo(sTgt)[2].value === "0402-96" && byNo(sTgt)[1].value === "Doe Construction, Ltd." && byNo(sTgt)[16].value === "Southwest" && byNo(sTgt)[17].value === "Yes" && byNo(sTgt)[62].value === "888-555-4321" && byNo(sTgt)[56].value === TARGET.f280_notes, [byNo(sTgt)[4].value, byNo(sTgt)[2].value, byNo(sTgt)[16].value]);
  check("the Reference's sheet holds the Reference's", byNo(sRef)[4].value === "12 Other Road" && byNo(sRef)[16].value === "North" && byNo(sRef)[62].value === "416 555 0000" && byNo(sRef)[1].value === TARGET.f280_issued_for, [byNo(sRef)[4].value, byNo(sRef)[16].value, byNo(sRef)[1].value]);
  check("the Reference's wall (RSI 4.00) is in the Reference's sheet alone", byNo(sRef)[31].value.includes("RSI 4.00") && !byNo(sTgt)[31].value.includes("RSI 4.00"), [byNo(sTgt)[31].value, byNo(sRef)[31].value]);
  const after = await loads();
  check("the record moves no design load of the Target", JSON.stringify(before[0]) === JSON.stringify(after[0]), [before[0], after[0]]);

  // ---- save, another project, reload ----
  const [dl] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => window.TEUI.FileHandler.exportToCSV())]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  await load("04-apartment-necb-small.csv");
  check("another project clears the record", (await sheet().then((s) => byNo(s)[4].state)) === "blank");
  await p.evaluate((text) => window.TEUI.FileHandler.processImportedCSV(text, { replaceNotes: true }), csv);
  await p.waitForTimeout(4000);
  const rTgt = await sheet();
  check("the saved file brings the Target's record back as typed", Object.entries({ 1: TARGET.f280_issued_for, 2: "0402-96", 4: "496 Fake Street", 7: "16", 8: "M6J 2P9", 16: "Southwest", 17: "Yes", 56: TARGET.f280_notes, 57: "J. Smith", 62: "888-555-4321" }).every(([n, v]) => byNo(rTgt)[n].value === v), [1, 2, 4, 7, 8, 16, 17, 56, 57, 62].map((n) => byNo(rTgt)[n].value));
  check("and its cells show it", (await shown("f280_address")) === "496 Fake Street" && (await shown("f280_proj_num")) === "0402-96", [await shown("f280_address"), await shown("f280_proj_num")]);
  await mode("reference");
  const rRef = await sheet();
  check("and the Reference's", byNo(rRef)[4].value === "12 Other Road" && byNo(rRef)[16].value === "North" && byNo(rRef)[62].value === "416 555 0000" && byNo(rRef)[31].value.includes("RSI 4.00"), [byNo(rRef)[4].value, byNo(rRef)[16].value, byNo(rRef)[31].value]);
  await mode("target");

  // ---- Copy from Target, All Inputs: the record goes across with everything else ----
  await p.click("#op-reference-menu");
  await p.waitForTimeout(300);
  await p.click("#mirrorAllInputsBtn");
  await p.waitForTimeout(2500);
  await mode("reference");
  const mRef = await sheet();
  check("Copy from Target, All Inputs carries the record to the Reference", byNo(mRef)[4].value === "496 Fake Street" && byNo(mRef)[16].value === "Southwest" && byNo(mRef)[62].value === "888-555-4321", [byNo(mRef)[4].value, byNo(mRef)[16].value, byNo(mRef)[62].value]);
  await mode("target");

  // ---- F280 Mode Off hides it ----
  const visible = () => p.evaluate(() => ["F.0I", "F.41", "F.58"].map((id) => !document.querySelector(`#f280Compliance tr[data-id="${id}"]`).classList.contains("f280-hidden-row")));
  check("F280 Mode On shows the record and the button", (await visible()).every(Boolean), await visible());
  await f280("Off");
  check("F280 Mode Off hides them", (await visible()).every((v) => !v), await visible());
  await f280("On");

  // ---- the button opens the sheet in its own tab ----
  const [tab] = await Promise.all([ctx.waitForEvent("page"), p.evaluate(() => document.getElementById("f280SummaryOpen").click())]);
  await tab.waitForLoadState("load");
  await tab.waitForTimeout(600);
  const drawn = await tab.evaluate(() => ({
    url: location.pathname.split("/").pop(),
    title: document.title,
    numbers: [...document.querySelectorAll(".fs-no")].map((td) => td.textContent).filter(Boolean),
    address: [...document.querySelectorAll(".fs-row")].find((tr) => tr.querySelector(".fs-no")?.textContent === "4")?.querySelector(".fs-value")?.textContent,
    print: !!document.getElementById("fs-print"),
    notCarried: document.querySelectorAll(".fs-tag-none").length,
  }));
  // the numbers drawn cover 1 to 64: a run of unneeded style lines is one row, "32–34"
  const covered = new Set();
  drawn.numbers.forEach((t) => {
    const [a, z] = t.split("–").map(Number);
    for (let n = a; n <= (z || a); n++) covered.add(n);
  });
  check("the button opens f280-summary.html in its own tab", drawn.url === "f280-summary.html", drawn.title);
  check("the tab draws fields 1 to 64", covered.size === 64 && [...covered].every((n) => n >= 1 && n <= 64), covered.size);
  check("the tab shows the model's record, one field not carried, and a Print button", drawn.address === "496 Fake Street" && drawn.notCarried === 1 && drawn.print, drawn);
  check("no page error", errs.length === 0, errs);
  if (OUT) {
    fs.mkdirSync(OUT, { recursive: true });
    await tab.setViewportSize({ width: 1100, height: 1300 });
    await tab.screenshot({ path: `${OUT}/f280-summary-screen.png` });
  }
  await b.close();

  // ---- the print, by the machine's Chrome (the browser's own print path) ----
  if (OUT) {
    const cb = await chromium.launch({ channel: "chrome" });
    const c2 = await start(cb);
    await c2.load("02-residence-sb12-net-zero-f280.csv");
    await c2.f280("On");
    const [t2] = await Promise.all([c2.ctx.waitForEvent("page"), c2.p.evaluate(() => document.getElementById("f280SummaryOpen").click())]);
    await t2.waitForLoadState("load");
    await t2.waitForTimeout(600);
    const pdf = await t2.pdf({ path: `${OUT}/f280-summary.pdf`, preferCSSPageSize: true, printBackground: true });
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    check("the sheet prints (Chrome, the page's own size and margins)", pdf.length > 20000 && pages >= 1, `${pages} pages, ${pdf.length} bytes -> ${OUT}/f280-summary.pdf`);
    await cb.close();
  }

  console.log(failed ? `\n${failed} FAILED` : "\nALL PASS");
  process.exit(failed ? 1 : 0);
})();
