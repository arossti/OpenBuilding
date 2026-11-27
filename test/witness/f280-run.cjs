// CSA F280-12 Cl. 8.2: the qualified operator's run of the verification agent's case files on OBJECTIVE 4.0.
//
//   export NODE_PATH=../andy-rnd/node_modules
//   node test/witness/f280-run.cjs <case inputs dir> <out dir> [--url <page>] [--annexj <fixture.json>]
//                                  [--only <regex on case id>] [--jobs <n>]
//
// <case inputs dir> holds the verification agent's run_list.csv and case_files/. It, <out dir> and the Annex J
// fixture are PRIVATE (they carry values derived from CSA F280-12) and live outside this public repository:
// this script holds no case input and no Annex J value, only how to run a file and what to read.
//
// Each case file is opened in a fresh browser context, as the page's own Open does (FileHandler
// .processImportedCSV), after the page's start-up load of its default case has finished. The run then reads,
// for the Target and for the Reference model:
//   loss = f280.totalDesignHeatLoss (W), Cl. 5.2.7, and its terms (above grade, BASESIMP, air leakage, ventilation);
//   gain = f280.s15.nominalHeatGain (W) = the sensible sum (Cl. 6.2.9) x LM (Cl. 6.3.1), and its terms.
// In a variant file the Reference row is the base case, so one run gives base and variant together.
// It also checks the import itself: every field of the file against what the page then holds, and every
// door / window row in use against its host wall and its overhang's Annex A shading.
// Output: <out dir>/f280-results.json (everything) and f280-results.csv (one line per run).
const { webkit } = require("playwright");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const URL = opt("url", "http://localhost:8831/objectivepro.html");
const ANNEXJ = opt("annexj", null);
const ONLY = opt("only", null);
const JOBS = parseInt(opt("jobs", "3"), 10);
const [IN_DIR, OUT_DIR] = args;
if (!IN_DIR || !OUT_DIR) {
  console.error("usage: node test/witness/f280-run.cjs <case inputs dir> <out dir> [--url] [--annexj] [--only] [--jobs]");
  process.exit(2);
}

// ---- CSV -----------------------------------------------------------------------------------------------------
function parseLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}
const csvRows = (text) =>
  text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.length)
    .map(parseLine);
const quote = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
function table(file) {
  const [head, ...rows] = csvRows(fs.readFileSync(file, "utf8"));
  return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}
// A case file: the header's field ids, the Target row and the Reference row
function caseFile(text) {
  const [head, target, reference] = csvRows(text);
  const ids = head.map((h) => h.split(":")[0].trim());
  return { ids, target, reference };
}

// ---- Cl. 8.4.1's band, as the verification agent's matrix states it, on signed values ----------------------
function band(result, expected, b) {
  const lo = Math.min(b.low_fraction * expected, expected - b.absolute_W);
  const hi = Math.max(b.high_fraction * expected, expected + b.absolute_W);
  return {
    expected_W: expected,
    percent: expected ? +((100 * result) / expected).toFixed(1) : null,
    pass: result >= lo && result <= hi,
    margin_W: +Math.min(result - lo, hi - result).toFixed(1)
  };
}

// ---- what a run reads (in the page) ------------------------------------------------------------------------
const READ = () => {
  const T = window.TEUI;
  const state = T.ComputationIntegration.getState();
  const SM = T.StateManager;
  // the Target is the active model; the Reference is the one the engine types "reference" (LegacyAdapter.js)
  const ids = { target: state.getActiveModelId(), reference: (state.getAllModels().find((m) => m.modelType === "reference") || {}).id };
  const model = (which) => {
    const id = ids[which];
    const raw = (k) => state.getValueForModel(id, k);
    const num = (k) => {
      const v = raw(k);
      return v === "Unavailable" ? "Unavailable" : parseFloat(v);
    };
    const pre = which === "reference" ? "ref_" : "";
    const bs = raw("ground.basesimp") || {};
    const aim2 = raw("airTightness.aim2") || {};
    const weather = (T.F280Weather.lookup(raw("climate.location.province"), raw("climate.location.city")) || {});
    const G = T.F280Gains;
    const area = num("building.conditionedFloorArea");
    const dTh = num("climate.heating.obcSetpoint") - num("climate.temperature.coldest");
    const airUA = num("envelope.airFacing.uValue") * num("envelope.airFacing.area");
    const rows = {};
    for (const o of T.Openings.ALL) {
      const a = parseFloat(raw(`radiantGains.row${o.s10}.area`));
      if (!(a > 0)) continue;
      const facing = raw(`radiantGains.row${o.s10}.orientation`);
      const depth = parseFloat(raw(`radiantGains.row${o.s10}.overhangDepth`)) || 0;
      const above = parseFloat(raw(`radiantGains.row${o.s10}.overhangAbove`)) || 0;
      const height = parseFloat(raw(`transmissionLoss.${o.id}.height`)) || 0;
      const host = SM.getValue(`${pre}ch_${o.s11}`) || "";
      rows[o.s10] = {
        kind: o.kind,
        facing,
        area: a,
        u: parseFloat(raw(`transmissionLoss.${o.id}.uValue`)),
        shgc: parseFloat(raw(`radiantGains.row${o.s10}.shgc`)) || 0,
        summerShading: parseFloat(raw(`radiantGains.row${o.s10}.summerShading`)) || 0,
        depth,
        above,
        height,
        fromOverhang:
          o.kind !== "door" && depth > 0
            ? T.Openings.overhangShading({ facing, lat: weather.lat, depth, above, windowHeight: height })
            : null,
        host,
        hostType: host ? SM.getValue(`${pre}c_${host}`) : null,
        hostFacing: host ? SM.getValue(`${pre}cf_${host}`) : null
      };
    }
    const opaque = T.Openings.ABOVE.map((o) => ({
      row: o.s11,
      type: raw(`transmissionLoss.${o.id}.type`) || o.type,
      facing: raw(`transmissionLoss.${o.id}.facing`) || "",
      area: parseFloat(raw(`transmissionLoss.${o.id}.area`)) || 0,
      u: parseFloat(raw(`transmissionLoss.${o.id}.uValue`)) || 0
    })).filter((r) => r.area > 0);
    return {
      loss_W: num("f280.totalDesignHeatLoss"),
      loss_terms_W: {
        envelope: num("f280.peakEnvelopeHeatLoss"),
        above_grade: bs.error ? "Unavailable" : airUA * Math.max(0, dTh),
        basesimp: bs.error ? "Unavailable" : bs.heatingLoad,
        air_leakage: num("f280.peakInfiltrationHeatLoss"),
        ventilation: num("f280.peakVentilationHeatLoss")
      },
      sensible_gain_W: num("f280.totalSensibleHeatGain"),
      latent_multiplier: num("f280.s15.latentMultiplier"),
      gain_W: num("f280.s15.nominalHeatGain"),
      gain_terms_W: {
        enclosure: 1000 * num("energy.peakCooling.enclosureKw"),
        internal: Math.max(G.laeWPerM2 * area, G.laeMinW),
        occupants: G.personW * num("occupancy.occupants"),
        solar: num("f280.peakSolarHeatGain"),
        opaque_solar_correction: num("f280.opaqueSolarCorrection"),
        air_leakage: num("f280.peakInfiltrationHeatGain"),
        ventilation: num("f280.peakVentilationHeatGain")
      },
      conditions: {
        f280_mode: raw("f280.mode"),
        province: raw("climate.location.province"),
        city: raw("climate.location.city"),
        heating_design_C: num("climate.temperature.coldest"),
        heating_setpoint_C: num("climate.heating.obcSetpoint"),
        cooling_design_C: num("climate.temperature.hottest"),
        cooling_setpoint_C: num("climate.cooling.setpoint"),
        f280_latitude: weather.lat,
        f280_summer_range_C: weather.summerRange,
        floor_area_m2: area,
        volume_m3: num("volume.conditioned"),
        occupants: num("occupancy.occupants"),
        ventilation_Ls: num("ventilation.volumetricRate"),
        hrv_efficiency_pct: num("mechanical.ventilation.efficiency"),
        atre_pct: num("mechanical.ventilation.atre"),
        thermal_bridge_penalty_pct: num("transmissionLoss.thermalBridgePenalty"),
        air_facing_UA_W_per_K: airUA,
        air_facing_area_m2: num("envelope.airFacing.area")
      },
      aim2: {
        error: aim2.error || null,
        tightness: raw("aim2.tightness"),
        ela_cm2: num("aim2.ela"),
        highest_ceiling_m: num("aim2.ceilingHeight"),
        heating_ach: aim2.design ? aim2.design.heating.natural : null,
        cooling_ach: aim2.design ? aim2.design.cooling.natural : null
      },
      basesimp: {
        error: bs.error || null,
        configuration: raw("ground.basesimp.configuration"),
        depth_m: num("ground.basesimp.depth"),
        exposed_perimeter_m: num("ground.basesimp.exposedPerimeter"),
        slab_area_m2: parseFloat(raw("transmissionLoss.slabOnGrade.area")),
        heating_load_W: bs.heatingLoad ?? null
      },
      opaque,
      rows,
      iso52016: !!raw("cooling.iso52016")
    };
  };
  return {
    project: SM.getValue("h_14"),
    target: model("target"),
    reference: model("reference")
  };
};

// every field of the file against what the page holds after the import
const ECHO = ({ ids, target, reference }) => {
  const SM = window.TEUI.StateManager;
  const same = (a, b) => {
    const x = String(a ?? "").trim();
    const y = String(b ?? "").trim();
    if (x === y) return true;
    const nx = Number(x.replace(/,/g, ""));
    const ny = Number(y.replace(/,/g, ""));
    return x !== "" && y !== "" && Number.isFinite(nx) && Number.isFinite(ny) && Math.abs(nx - ny) <= 1e-9 * Math.max(1, Math.abs(nx));
  };
  const diffs = [];
  ids.forEach((id, i) => {
    if (i === 0 && !/^[a-z]+_\w+$/.test(id)) return;
    const t = SM.getValue(id);
    const r = SM.getValue("ref_" + id);
    if (!same(target[i], t)) diffs.push({ model: "target", field: id, file: target[i], page: t ?? null });
    if (reference && !same(reference[i], r)) diffs.push({ model: "reference", field: id, file: reference[i], page: r ?? null });
  });
  return diffs;
};

// every door / window row in use: in a wall, facing as its wall, shaded as its overhang says
function hostChecks(rows) {
  const notes = [];
  for (const [r, row] of Object.entries(rows)) {
    if (!row.host) {
      if (row.facing !== "Average") notes.push(`row ${r} (${row.kind}, ${row.facing}): no host wall`);
      continue;
    }
    if (row.hostType !== "walls") notes.push(`row ${r}: hosted in ${row.host}, a ${row.hostType}`);
    if (row.facing !== row.hostFacing) notes.push(`row ${r}: faces ${row.facing}, its wall ${row.host} faces ${row.hostFacing}`);
    if (row.fromOverhang !== null && Math.abs(row.summerShading - row.fromOverhang) > 0.005)
      notes.push(`row ${r}: summer shading ${row.summerShading} %, its overhang gives ${row.fromOverhang.toFixed(2)} % (Annex A, ${row.facing})`);
  }
  return notes;
}

async function runCase(browser, run, text) {
  const file = caseFile(text);
  const want = (f) => file.target[file.ids.indexOf(f)];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.addInitScript(() => localStorage.setItem("objective4DisclaimerSeen", "true"));
  // the page loads its default case 1.5 s after start (js/objective-boot.js): let it land first
  const defaultCase = page.waitForResponse((r) => /src\/template\/case-studies\/.+\.csv/.test(r.url()), { timeout: 60000 });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(
    () => window.TEUI?.ComputationIntegration?.isInitialized?.() && window.TEUI?.FileHandler?.processImportedCSV,
    null,
    { timeout: 60000 }
  );
  await defaultCase;
  const settle = async (isOurs) => {
    let last = null;
    let same = 0;
    let snap = null;
    for (let i = 0; i < 200; i++) {
      await page.waitForTimeout(150);
      snap = await page.evaluate(READ);
      const key = JSON.stringify([snap.project, snap.target.loss_W, snap.target.gain_W, snap.reference.loss_W, snap.reference.gain_W]);
      same = key === last ? same + 1 : 0;
      last = key;
      if (same >= 6 && isOurs(snap)) return snap;
    }
    throw new Error(`${run.case_id}: the figures never settled (the page shows "${snap && snap.project}")`);
  };
  const started = await settle((s) => s.project !== want("h_14"));
  await page.evaluate((csv) => window.TEUI.FileHandler.processImportedCSV(csv), text);
  const slab = parseFloat(want("d_95"));
  const snap = await settle(
    (s) => s.project === want("h_14") && s.target.iso52016 && Math.abs(s.target.basesimp.slab_area_m2 - slab) < 1e-6
  );
  const echo = await page.evaluate(ECHO, file);
  await ctx.close();
  const inUse = (row) =>
    Object.keys(snap.target.rows)
      .concat(Object.keys(snap.reference.rows))
      .filter((r, i, a) => a.indexOf(r) === i)
      .filter((r) => file.ids.includes(`d_${r}`) && parseFloat(row[file.ids.indexOf(`d_${r}`)]) > 0).length;
  const fileRows = (row) => file.ids.filter((id) => /^d_7[3-8][a-z]*$/.test(id) && parseFloat(row[file.ids.indexOf(id)]) > 0).length;
  return {
    ...run,
    sha256: crypto.createHash("sha256").update(text).digest("hex"),
    started_on: started.project,
    project: snap.project,
    target: snap.target,
    reference: snap.reference,
    import: {
      fields_in_file: file.ids.length,
      fields_differing: echo,
      opening_rows_in_file: { target: fileRows(file.target), reference: file.reference ? fileRows(file.reference) : null },
      opening_rows_on_page: { target: Object.keys(snap.target.rows).length, reference: Object.keys(snap.reference.rows).length },
      opening_rows_matched: { target: inUse(file.target) },
      host_notes: { target: hostChecks(snap.target.rows), reference: hostChecks(snap.reference.rows) },
      page_errors: errors
    }
  };
}

(async () => {
  const git = (c) => {
    try {
      return execSync(`git ${c}`, { cwd: path.join(__dirname, "..", ".."), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch (e) {
      return null;
    }
  };
  let runs = table(path.join(IN_DIR, "run_list.csv"));
  if (ONLY) runs = runs.filter((r) => new RegExp(ONLY).test(r.case_id));
  const fixture = ANNEXJ ? JSON.parse(fs.readFileSync(ANNEXJ, "utf8")) : null;
  const browser = await webkit.launch();
  const done = [];
  const queue = runs.map((r, i) => [i, r]);
  await Promise.all(
    Array.from({ length: Math.max(1, JOBS) }, async () => {
      while (queue.length) {
        const [i, run] = queue.shift();
        const text = fs.readFileSync(path.join(IN_DIR, run.case_file), "utf8");
        try {
          done[i] = await runCase(browser, run, text);
        } catch (e) {
          done[i] = { ...run, failed: String(e && e.message ? e.message : e) };
        }
        const d = done[i];
        console.log(
          d.failed
            ? `${run.order} ${run.case_id}: FAILED ${d.failed}`
            : `${run.order} ${run.case_id}: loss ${d.target.loss_W} W · gain ${typeof d.target.gain_W === "number" ? d.target.gain_W.toFixed(1) : d.target.gain_W} W` +
                ` · ${d.import.fields_differing.length} field(s) differ · ${d.import.host_notes.target.length} host note(s)` +
                (d.import.page_errors.length ? ` · ${d.import.page_errors.length} page error(s)` : "")
        );
      }
    })
  );
  const version = browser.version();
  await browser.close();

  // the comparison each run_list row asks for: a total, or the change from the base case
  const base = done.find((d) => d && !d.failed && d.compared_as === "total" && /base case/.test(d.variant));
  for (const d of done) {
    if (!d || d.failed) continue;
    const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    d.result = { loss_W: num(d.target.loss_W), gain_W: num(d.target.gain_W) };
    if (d.compared_as !== "total") {
      // the base case from the SAME run (the file's Reference row), and from the base case's own run
      d.change = {
        from_reference_row: {
          loss_W: num(d.target.loss_W) - num(d.reference.loss_W),
          gain_W: num(d.target.gain_W) - num(d.reference.gain_W)
        },
        from_base_run: base
          ? { loss_W: num(d.target.loss_W) - num(base.target.loss_W), gain_W: num(d.target.gain_W) - num(base.target.gain_W) }
          : null
      };
    }
    if (!fixture) continue;
    const b = fixture.band_8_4_1;
    if (d.compared_as === "total") {
      const m = /^A(\d) \/ (.+?) \/ (.+)$/.exec(d.model);
      const exp =
        m &&
        fixture.location_and_vintage_8_3_9.find(
          (x) => x.archetype === +m[1] && x.location === m[3] && x.vintage.toLowerCase() === m[2].toLowerCase()
        );
      d.annex_j = exp
        ? { loss: band(d.result.loss_W, exp.loss_W, b), gain: band(d.result.gain_W, exp.gain_W, b) }
        : { unmatched: d.model };
    } else {
      const clause = d.clause.replace(/\)$/, "").replace(/^(8\.3\.8) b$/, "$1");
      const ofClause = fixture.variants_on_base_case.filter((x) => x.clause === clause);
      const exact = ofClause.filter((x) => x.variant === d.variant);
      const exp = exact.length ? exact : ofClause.filter((x) => x.variant.startsWith(d.variant));
      d.annex_j = exp.length ? {} : { unmatched: `${d.clause} ${d.variant}` };
      for (const x of exp) {
        // Annex J prints the changes with no consistent sign; the matrix compares the signed physical change
        // (variant − base), so the printed magnitude takes our change's direction
        const ours = d.change.from_reference_row[`${x.quantity}_W`];
        const signed = Math.abs(x.expected_change_W) * (ours < 0 ? -1 : 1);
        d.annex_j[x.quantity] = { printed_W: x.expected_change_W, ...band(ours, signed, b) };
      }
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const meta = {
    what: "CSA F280-12 Cl. 8.2: the qualified operator's run of the verification agent's case files",
    run_at: new Date().toISOString(),
    software: "OBJECTIVE 4.0 (objectivepro.html)",
    repository: git("config --get remote.origin.url"),
    commit: git("rev-parse HEAD"),
    branch: git("rev-parse --abbrev-ref HEAD"),
    tag: git("describe --tags --exact-match"),
    working_tree_changes: (git("status --porcelain --untracked-files=no") || "").split("\n").filter(Boolean),
    page: URL,
    browser: `WebKit ${version} (Playwright)`,
    case_inputs: path.resolve(IN_DIR),
    annex_j_fixture: ANNEXJ ? path.resolve(ANNEXJ) : null,
    gain_is: "f280.s15.nominalHeatGain = the sensible sum (Cl. 6.2.9) x the latent multiplier (Cl. 6.3.1)"
  };
  fs.writeFileSync(path.join(OUT_DIR, "f280-results.json"), JSON.stringify({ meta, runs: done }, null, 1) + "\n");

  const r0 = (v) => (typeof v === "number" && Number.isFinite(v) ? String(Math.round(v)) : v === null || v === undefined ? "" : String(v));
  const head = [
    "order", "case_id", "clause", "model", "variant", "compared_as",
    "loss_W", "gain_W", "sensible_gain_W", "latent_multiplier",
    "loss_above_grade_W", "loss_basesimp_W", "loss_air_leakage_W", "loss_ventilation_W",
    "gain_enclosure_W", "gain_internal_W", "gain_occupants_W", "gain_solar_W", "gain_opaque_solar_correction_W",
    "gain_air_leakage_W", "gain_ventilation_W",
    "base_loss_W", "base_gain_W", "loss_change_W", "gain_change_W",
    "annex_j_loss_W", "loss_pct", "loss_pass", "loss_margin_W", "annex_j_gain_W", "gain_pct", "gain_pass", "gain_margin_W",
    "fields_differing", "host_notes", "page_errors", "sha256"
  ];
  const lines = [head.join(",")];
  for (const d of done) {
    if (!d) continue;
    if (d.failed) {
      lines.push([d.order, d.case_id, d.clause, d.model, d.variant, d.compared_as, `FAILED: ${d.failed}`].map(quote).join(","));
      continue;
    }
    const t = d.target;
    const change = d.change ? d.change.from_reference_row : null;
    const aj = d.annex_j || {};
    const cmp = (q) => (aj[q] ? [aj[q].expected_W, aj[q].percent, aj[q].pass, aj[q].margin_W] : ["", "", "", ""]);
    lines.push(
      [
        d.order, d.case_id, d.clause, d.model, d.variant, d.compared_as,
        r0(t.loss_W), r0(t.gain_W), r0(t.sensible_gain_W), t.latent_multiplier,
        r0(t.loss_terms_W.above_grade), r0(t.loss_terms_W.basesimp), r0(t.loss_terms_W.air_leakage), r0(t.loss_terms_W.ventilation),
        r0(t.gain_terms_W.enclosure), r0(t.gain_terms_W.internal), r0(t.gain_terms_W.occupants), r0(t.gain_terms_W.solar),
        r0(t.gain_terms_W.opaque_solar_correction), r0(t.gain_terms_W.air_leakage), r0(t.gain_terms_W.ventilation),
        change ? r0(d.reference.loss_W) : "", change ? r0(d.reference.gain_W) : "",
        change ? r0(change.loss_W) : "", change ? r0(change.gain_W) : "",
        ...cmp("loss"), ...cmp("gain"),
        d.import.fields_differing.length, d.import.host_notes.target.length, d.import.page_errors.length, d.sha256
      ]
        .map(quote)
        .join(",")
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, "f280-results.csv"), lines.join("\n") + "\n");
  const failed = done.filter((d) => d && d.failed).length;
  console.log(`${done.filter(Boolean).length} run(s), ${failed} failed → ${path.join(OUT_DIR, "f280-results.json")}`);
  console.log(`commit ${meta.commit}${meta.working_tree_changes.length ? " + uncommitted changes" : ""}`);
  process.exit(failed ? 1 : 0);
})();
