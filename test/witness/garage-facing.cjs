// A wall to an attached garage: the "Garage" facing (schema.md §0, 2026-11-26; src/core/Openings.js GARAGE).
//
//   export NODE_PATH=../andy-rnd/node_modules
//   node test/witness/garage-facing.cjs
//
// On case 02 (F280 file) the Target takes a West wall (B.87a, 20 m², RSI 3) with a 2 x 1.5 m window and a
// 0.9 x 2.1 m door hosted in it. The wall's facing then goes West -> Garage through S11's own dropdown.
// What must hold:
//   - the F280 design heat loss does not move (CSA F280-12 Cl. 4.3: the garage is at the outdoor temperature);
//   - the window and the door take the wall's facing, and the window's solar goes to zero in all three
//     places it is counted: F280's design solar (Cl. 6.2.2.1), S10's annual gain, the ISO 52016 cooling;
//   - F280's solar correction on the wall and the door becomes Table 3's shaded row, by hand;
//   - the facing dropdown's hover is the NBC note; the Reference model does not move;
//   - the saved file brings the facing back.
const { webkit } = require("playwright");
const fs = require("fs");
const URL = process.argv[2] || "http://localhost:8831/objectivepro.html";

(async () => {
  const b = await webkit.launch();
  const p = await (await b.newContext({ viewport: { width: 1527, height: 970 }, acceptDownloads: true })).newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  const started = p.waitForResponse((r) => /src\/template\/case-studies\/.+\.csv/.test(r.url()));
  await p.goto(URL);
  await started;
  await p.waitForTimeout(3500);
  const load = (file) =>
    p.evaluate(async (f) => {
      const r = await fetch(`src/template/case-studies/${f}`);
      window.TEUI.FileHandler.processImportedCSV(await r.text(), { replaceNotes: true });
    }, file);
  await load("02-residence-sb12-net-zero-f280.csv");
  await p.waitForTimeout(4000);

  const read = () =>
    p.evaluate(() => {
      const T = window.TEUI;
      const s = T.ComputationIntegration.getState();
      const SM = T.StateManager;
      const ids = { target: s.getActiveModelId(), reference: (s.getAllModels().find((m) => m.modelType === "reference") || {}).id };
      const of = (which) => {
        const g = (k) => s.getValueForModel(ids[which], k);
        const n = (k) => parseFloat(g(k));
        const iso = g("cooling.iso52016") || { rows: {} };
        const O = T.Openings;
        const w = O.ALL.find((o) => o.s10 === "77");
        const d = O.ALL.find((o) => o.s10 === "73a");
        const wall = O.ABOVE.find((o) => o.s11 === "87a");
        return {
          loss: n("f280.totalDesignHeatLoss"),
          sensible: n("f280.totalSensibleHeatGain"),
          solar: n("f280.peakSolarHeatGain"),
          sc: n("f280.opaqueSolarCorrection"),
          dtdc: n("climate.temperature.hottest") - n("climate.cooling.setpoint"),
          tb: n("transmissionLoss.thermalBridgePenalty"),
          range: (T.F280Weather.lookup(g("climate.location.province"), g("climate.location.city")) || {}).summerRange,
          wall: { facing: g(`transmissionLoss.${wall.id}.facing`), area: n(`transmissionLoss.${wall.id}.area`), u: n(`transmissionLoss.${wall.id}.uValue`) },
          window: { facing: g("radiantGains.row77.orientation"), area: n("radiantGains.row77.area"), shgc: n("radiantGains.row77.shgc"), shade: n("radiantGains.row77.summerShading"),
            gainFactor: n("radiantGains.row77.gainFactor"), heatingGain: n("radiantGains.row77.heatingGain"), iso: iso.rows.glazing77, u: n(`transmissionLoss.${w.id}.uValue`) },
          door: { facing: g("radiantGains.row73a.orientation"), area: n(`transmissionLoss.${d.id}.area`), u: n(`transmissionLoss.${d.id}.uValue`) },
          // the wall's own solar, month by month (its row in iso.rows also carries its conduction)
          isoWall: ((iso.months || {}).none || []).reduce((sum, mo) => sum + ((mo.gain || {})[`opaque:${wall.id}`] || 0), 0),
          isoWallRow: iso.rows[wall.id],
          irradiationGarage: T.CoolingISO52016.irradiation({}, "Garage", 6),
          cooling: iso.sensible
        };
      };
      const sel = document.querySelector('select[data-field-id="cf_87a"]');
      return { target: of("target"), reference: of("reference"), hover: sel && sel.title, shown: sel && sel.value, s10: (document.querySelector('select[data-field-id="e_77"]') || {}).value, stored: SM.getValue("cf_87a"), refStored: SM.getValue("ref_cf_87a") };
    });
  const facing = async (value) => {
    await p.evaluate((v) => {
      const sel = document.querySelector('select[data-field-id="cf_87a"]');
      sel.value = v;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
    await p.waitForTimeout(2500);
  };

  // the wall, its window and its door, in the Target
  await p.evaluate(() => {
    const SM = window.TEUI.StateManager;
    const O = window.TEUI.Openings;
    const set = (id, v) => SM.setValue(id, String(v), "user-modified");
    const w = O.ALL.find((o) => o.s10 === "77");
    const d = O.ALL.find((o) => o.s10 === "73a");
    set("c_87a", "walls");
    set("d_87a", 20);
    set("f_87a", 3);
    [[w, 2, 1.5], [d, 0.9, 2.1]].forEach(([o, W, H]) => {
      set(`ch_${o.s11}`, "87a");
      set(`dl_${o.s11}`, W);
      set(`dh_${o.s11}`, H);
      set(`dq_${o.s11}`, 1);
      set(`d_${o.s10}`, W * H);
    });
    set("f_77", 0.5);
    set("g_77", 0);
    set("h_77", 0);
    set(`g_${w.s11}`, 1.4);
    set(`g_${d.s11}`, 1.2);
    window.TEUI.Calculator.calculateAll();
  });
  await facing("West");
  const west = await read();
  await facing("Garage");
  const garage = await read();

  let bad = 0;
  const check = (what, ok, detail) => {
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail !== undefined ? `: ${detail}` : ""}`);
  };
  const near = (a, x, tol = 1e-6) => Math.abs(a - x) <= tol;
  const W = west.target;
  const G = garage.target;
  console.log(`West:   loss ${W.loss} W · solar ${W.solar.toFixed(1)} · correction ${W.sc.toFixed(2)} · window ${JSON.stringify(W.window)}`);
  console.log(`Garage: loss ${G.loss} W · solar ${G.solar.toFixed(1)} · correction ${G.sc.toFixed(2)} · window ${JSON.stringify(G.window)}`);
  check("the wall is stored as Garage, the Reference's is not", garage.stored === "Garage" && garage.refStored !== "Garage", `${garage.stored} / ${garage.refStored}`);
  check("the F280 design heat loss does not move", G.loss === W.loss, `${W.loss} → ${G.loss} W`);
  check("the hosted window and door face Garage", G.window.facing === "Garage" && G.door.facing === "Garage" && garage.s10 === "Garage", `${G.window.facing}, ${G.door.facing}, S10 shows ${garage.s10}`);
  // Cl. 6.2.2.1 by hand: West's 285 W/m2 on the window, no shading, then nothing
  const windowSolar = W.window.area * W.window.shgc * 285 * (1 - W.window.shade / 100);
  check("F280 design solar: the window's West share goes", near(W.solar - G.solar, windowSolar), `${(W.solar - G.solar).toFixed(3)} W, by hand ${windowSolar.toFixed(3)}`);
  check("S10's annual gain factor and heating gain are 0", G.window.gainFactor === 0 && G.window.heatingGain === 0 && W.window.heatingGain > 0, `${W.window.heatingGain.toFixed(1)} → ${G.window.heatingGain}`);
  check("ISO 52016 cooling: no solar through the window or on the wall", G.window.iso === 0 && G.isoWall === 0 && W.window.iso > 0 && W.isoWall > 0 && G.irradiationGarage === 0 && G.isoWallRow < W.isoWallRow,
    `window ${W.window.iso.toFixed(1)} → ${G.window.iso} kWh; the wall's solar ${W.isoWall.toFixed(2)} → ${G.isoWall}; its row ${W.isoWallRow.toFixed(2)} → ${G.isoWallRow.toFixed(2)} kWh`);
  // Table 3 by hand: West +1.7 / −1.1, the compass mean for a door, the shaded row −3.3 / −6.1
  const col = W.range <= 14 ? 0 : 1;
  const tb = 1 + W.tb / 100;
  const sc = (v) => Math.max(0, W.dtdc + v) - Math.max(0, W.dtdc);
  const mean = [[-3.8, -6.7], [-0.6, -3.3], [1.7, -1.1], [0.6, -2.2], [-2.2, -5.0], [0.6, -2.2], [1.7, -1.1], [-0.6, -3.3]].reduce((a, v) => a + v[col], 0) / 8;
  const byHand =
    W.wall.area * W.wall.u * tb * (sc([-3.3, -6.1][col]) - sc([1.7, -1.1][col])) +
    W.door.area * W.door.u * tb * (sc([-3.3, -6.1][col]) - sc(mean));
  check("F280 Table 3: the wall and its door take the shaded row", near(G.sc - W.sc, byHand, 1e-6), `${(G.sc - W.sc).toFixed(4)} W, by hand ${byHand.toFixed(4)} (DTDc ${W.dtdc}, range column ${col})`);
  check("the sensible gain moves by those two and nothing else", near(G.sensible - W.sensible, -windowSolar + byHand, 1e-6), `${(G.sensible - W.sensible).toFixed(3)} W`);
  check("the hover is the NBC note", /^NBC 2020 9\.36\.2\.4\.\(4\): the required RSI "is permitted to be reduced by 0\.16 \(m²·K\)\/W"; 9\.36\.5\.10\.\(4\) gives such assemblies a solar heat gain coefficient of 0\.$/.test(garage.hover), garage.hover);
  check("a compass facing keeps the old hover", /^Wall facing/.test(west.hover), west.hover);
  check("the Reference model does not move", JSON.stringify(west.reference) === JSON.stringify(garage.reference));

  // the saved file returns it
  const [dl] = await Promise.all([p.waitForEvent("download"), p.evaluate(() => window.TEUI.FileHandler.exportToCSV())]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  await load("04-apartment-necb-small.csv");
  await p.waitForTimeout(3000);
  const other = await read();
  check("another project clears it", other.stored !== "Garage", String(other.stored));
  await p.evaluate((c) => window.TEUI.FileHandler.processImportedCSV(c), csv);
  await p.waitForTimeout(4000);
  const back = await read();
  check("the saved file brings the facing and the figures back", back.stored === "Garage" && back.shown === "Garage" && back.target.window.facing === "Garage" && near(back.target.sensible, G.sensible, 1e-6) && back.target.loss === G.loss,
    `${back.stored}, sensible ${back.target.sensible.toFixed(3)} vs ${G.sensible.toFixed(3)}`);
  check("no page error", errs.length === 0, errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? `FAILED: ${bad} check(s)` : "ALL OK");
  process.exit(bad ? 1 : 0);
})();
