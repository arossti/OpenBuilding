// A typed number keeps its display format across a model switch (132,938.00, never 132938), and S21 shows
// its mirrored numbers rounded (a U-value at 3 places, never 0.14947683109118085). schema.md §0.
const { webkit } = require("playwright");
(async () => {
  const b = await webkit.launch();
  const p = await (await b.newContext({ viewport: { width: 1527, height: 970 } })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  await p.goto("http://localhost:8831/objectivepro.html");
  await p.waitForTimeout(7000);
  const snap = () =>
    p.evaluate(() => {
      const o = {};
      document.querySelectorAll("[data-field-id]").forEach((el) => {
        if (el.querySelector("select,input") || el.tagName === "SELECT" || el.tagName === "INPUT") return;
        o[el.getAttribute("data-field-id")] = el.textContent.trim();
      });
      return o;
    });
  const mode = async (m) => {
    await p.click(m === "reference" ? "#op-model-reference" : "#op-model-target");
    await p.waitForTimeout(1500);
  };
  const diff = (a, c) =>
    Object.keys(a)
      .filter((k) => k in c && a[k] !== c[k])
      .map((k) => `${k}: ${a[k]} → ${c[k]}`);
  const long = (s) =>
    Object.keys(s)
      .filter((k) => /\d\.\d{5,}/.test(s[k]))
      .map((k) => `${k}: ${s[k]}`);
  for (const file of [null, "03-residence-phi-classic-f280.csv"]) {
    if (file) {
      await p.evaluate(async (c) => {
        const r = await fetch("src/template/case-studies/" + c);
        window.TEUI.FileHandler.processImportedCSV(await r.text(), { replaceNotes: true });
      }, file);
      await p.waitForTimeout(3500);
    }
    const t0 = await snap();
    await mode("reference");
    const r0 = await snap();
    await mode("target");
    const t1 = await snap();
    await mode("reference");
    const r1 = await snap();
    await mode("target");
    const dt = diff(t0, t1);
    const dr = diff(r0, r1);
    console.log(
      file || "default project",
      "| Target changed by a round trip:",
      dt.length,
      "| Reference:",
      dr.length,
      dt.concat(dr).slice(0, 5).join("; ")
    );
    console.log(
      "  S04 bill:",
      t1.d_27,
      "| long decimals shown:",
      long(t1).concat(long(r1)).length,
      long(t1).slice(0, 3).join("; ")
    );
    console.log(
      "  S21 wall U:",
      t1["f280.envelope.wallsAbove.uValue"],
      "| window U:",
      t1["f280.envelope.windowNorth.uValue"]
    );
  }
  console.log("errors", errs.slice(0, 5));
  await b.close();
})();
