// pdf-bridge-import.mjs
// OBJECTIVE side of the Take Off, Eh! bridge (Trust / Trust + Verify). Reads the
// parser's saved projects from IndexedDB, runs the shared aggregator
// (js/shared/polygon-map.mjs) and writes the results into OBJECTIVE's own
// fields — V3's StateManager on window.TEUI — then recalculates once.
//
// Andy 2026-11-25: "S11, S12, and 'Conditioned Area' as the sum in S02 of all
// interior plan spaces." V3_TARGETS below is that mapping. Windows are not
// written: S11 hosts each window in a wall that faces a direction, and Take
// Off, Eh! records no facing yet (roadmap V4-7).

import * as IDB from "../shared/indexed-db-store.mjs";
import { computeAllDimensions } from "../shared/polygon-map.mjs";

// The geometry parameters the aggregator lifts polygons with, as entered in
// Take Off, Eh!'s sidebar (the project's params).
const PARAM_FIELDS = ["param_wall_height_m", "param_basement_height_m", "param_roof_pitch_deg"];

// OBJECTIVE field ← aggregated dimension. `dim` names a polygon-map
// dimension; `volume` multiplies one by V3's own typical floor-to-floor
// height (S12 g_106).
export const V3_TARGETS = [
  {
    field: "h_15",
    label: "S02 B.3 Conditioned Area (m\u00b2)",
    dim: "project_total_floor_area",
    note: "every interior plan space: foundation + above-grade floor plates"
  },
  { field: "d_85", label: "S11 B.4 Roof (m\u00b2)", dim: "dim_roof_surface_area" },
  {
    field: "d_86",
    label: "S11 B.5 Walls above grade (m\u00b2)",
    dim: "dim_exterior_wall_area",
    note: "net of the windows drawn in them"
  },
  { field: "d_94", label: "S11 B.9 Walls below grade (m\u00b2)", dim: "dim_foundation_wall_area" },
  { field: "d_95", label: "S11 B.10 Slab (m\u00b2)", dim: "dim_foundation_slab_floor_area" },
  {
    field: "d_105",
    label: "S12 B.13 Conditioned volume (m\u00b3)",
    volume: "project_total_floor_area",
    note: "floor plates \u00d7 S12's typical floor-to-floor height"
  }
];

// S11's rows (V3 keys): ten wall rows, forty window rows, twelve door rows.
const sfx = (base, n) =>
  Array.from(
    { length: n },
    (_, i) => base + (i < 26 ? "abcdefghijklmnopqrstuvwxyz"[i] : "a" + "abcdefghijklmnopqrstuvwxyz"[i - 26])
  );
const WALL_ROWS = ["86", ...sfx("87", 9)];

function shoelace(v) {
  let a = 0;
  for (let i = 0; i < v.length; i++) {
    const j = (i + 1) % v.length;
    a += v[i].x * v[j].y - v[j].x * v[i].y;
  }
  return Math.abs(a) / 2;
}

// Walls, windows and doors from every elevation sheet whose facing the user
// confirmed in Take Off, Eh! (page.facing). Each opening is kept on its own —
// ASHRAE 140 shades window by window (Andy 2026-11-25).
export function envelopeByFacing(projectJson) {
  const byFacing = new Map();
  const unconfirmed = [];
  for (const page of (projectJson && projectJson.pages) || []) {
    if (page.classification !== "elevation") continue;
    const upm = page.calibration && page.calibration.pdfUnitsPerMetre;
    const polys = (page.polygons || []).filter((p) => p.closed && p.scope !== "garage");
    if (!polys.length || !upm) continue;
    if (!page.facing) {
      unconfirmed.push(`page ${page.pageNum}${page.sheetTitle ? " (" + page.sheetTitle + ")" : ""}`);
      continue;
    }
    const f = byFacing.get(page.facing) || { facing: page.facing, wall: 0, openings: [] };
    for (const p of polys) {
      const t = p.type || "area";
      if (t === "area" && (!p.component || p.component === "wall_exterior"))
        f.wall += shoelace(p.vertices) / (upm * upm);
      if (t === "window" || t === "door") {
        const xs = p.vertices.map((v) => v.x);
        const ys = p.vertices.map((v) => v.y);
        const w = (Math.max(...xs) - Math.min(...xs)) / upm;
        const h = (Math.max(...ys) - Math.min(...ys)) / upm;
        f.openings.push({ kind: t, label: p.label, w: Number(w.toFixed(3)), h: Number(h.toFixed(3)) });
      }
    }
    byFacing.set(page.facing, f);
  }
  return { facings: [...byFacing.values()].filter((f) => f.wall > 0), unconfirmed };
}

function v3() {
  return window.TEUI || {};
}

function readParams(project) {
  const fromProject = (project && project.projectJson && project.projectJson.params) || {};
  const params = {};
  for (const key of PARAM_FIELDS) {
    if (fromProject[key] != null && fromProject[key] !== "") params[key] = fromProject[key];
  }
  return params;
}

function num(v) {
  const n = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function listProjects() {
  return IDB.listProjects();
}

export async function buildPreview(projectUuid) {
  const project = await IDB.getProject(projectUuid);
  if (!project) throw new Error("project not found: " + projectUuid);
  const params = readParams(project);
  const dims = computeAllDimensions({ projectJson: project.projectJson, params });
  const SM = v3().StateManager;
  const f2f = num(SM?.getValue("g_106"));

  const rows = V3_TARGETS.map((t) => {
    const agg = dims[t.dim || t.volume] || { value: null, contributors: [], warnings: [] };
    let value = agg.value;
    let summary = buildSummary(agg);
    if (t.volume && value != null) {
      if (f2f && f2f > 0) {
        value = value * f2f;
        summary = `${summary} \u00d7 ${f2f} m (S12 floor-to-floor)`;
      } else {
        value = null;
        summary = "S12's typical floor-to-floor height (g_106) is blank";
      }
    }
    const current = SM ? num(SM.getValue(t.field)) : null;
    return {
      dimId: t.field,
      label: t.label,
      current,
      computed: value != null ? Number(value.toFixed(2)) : null,
      summary: t.note ? `${t.label}: ${t.note}. ${summary}` : `${t.label}. ${summary}`,
      contributors: agg.contributors || [],
      warnings: agg.warnings || [],
      hasValue: value != null,
      missingParams: extractMissingParams(agg),
      assemblyPresets: uniquePresets(agg.contributors || [])
    };
  });

  const env = envelopeByFacing(project.projectJson);
  if (env.facings.length) {
    const i86 = rows.findIndex((r) => r.dimId === "d_86");
    if (i86 >= 0) rows.splice(i86, 1);
  }
  const nWin = env.facings.reduce((n, f) => n + f.openings.filter((o) => o.kind === "window").length, 0);
  const nDoor = env.facings.reduce((n, f) => n + f.openings.filter((o) => o.kind === "door").length, 0);
  const wallTotal = env.facings.reduce((a, f) => a + f.wall, 0);
  rows.push({
    dimId: "s11_envelope",
    label: "S11 walls, windows, doors by facing",
    current: null,
    computed: env.facings.length ? Number(wallTotal.toFixed(2)) : null,
    summary:
      (env.facings.length
        ? env.facings
            .map((f) => `${f.facing}: wall ${f.wall.toFixed(2)} m\u00b2, ${f.openings.length} opening(s)`)
            .join(" \u00b7 ") +
          ` \u2014 walls written by facing; ${nWin} window(s) and ${nDoor} door(s) found, not yet written (each will take its own row).`
        : "No elevation sheet has a confirmed facing: set each one in Take Off, Eh!.") +
      (env.unconfirmed.length ? ` Not imported (no facing set): ${env.unconfirmed.join(", ")}.` : ""),
    contributors: [],
    warnings: [],
    hasValue: env.facings.length > 0,
    missingParams: [],
    assemblyPresets: [],
    envelope: env
  });

  return {
    project,
    params,
    rows,
    paramsComplete: PARAM_FIELDS.every((k) => params[k] != null && params[k] !== "")
  };
}

// Writes each chosen row into OBJECTIVE as a user entry (so Reset, back to the
// last loaded project, undoes it), then one full recalculation, as V3's
// importer does after an import.
export async function applyImport(projectUuid, fieldIdsToApply) {
  const preview = await buildPreview(projectUuid);
  const T = v3();
  if (!T.StateManager) throw new Error("OBJECTIVE's engine is not loaded");
  const chosen = new Set(fieldIdsToApply);
  let applied = 0;
  for (const row of preview.rows) {
    if (!chosen.has(row.dimId) || !row.hasValue) continue;
    if (row.dimId === "s11_envelope") applied += writeEnvelope(T.StateManager, row.envelope);
    else {
      T.StateManager.setValue(row.dimId, String(row.computed), "user-modified");
      applied++;
    }
  }
  if (applied && T.Calculator?.calculateAll) T.Calculator.calculateAll();
  return { applied, project: preview.project };
}

function buildSummary(agg) {
  if (!agg.contributors || agg.contributors.length === 0) {
    if (agg.warnings && agg.warnings.length) {
      // Missing-param warnings are actionable (user can type the value); sheet-class
      // hints are background noise. Surface the former when both are present.
      const missing = agg.warnings.find((w) => /required param missing/i.test(w));
      if (missing) return missing;
      return agg.warnings[0];
    }
    return "no polygons feeding this dim";
  }
  if (agg.contributors.length === 1) return agg.contributors[0].summary;
  // Multi-contributor (e.g. interior-footing polylines + slab-perimeter cross-feed
  // both feeding continuous_footings). Keep each contributor visible so the user
  // can see the component breakdown instead of a single collapsed count.
  return agg.contributors.map((c) => c.summary).join(" + ");
}

function extractMissingParams(agg) {
  const missing = new Set();
  for (const w of agg.warnings || []) {
    const m = w.match(/required param missing: (\S+)/);
    if (m) missing.add(m[1]);
  }
  return Array.from(missing);
}

function uniquePresets(contributors) {
  const s = new Set();
  for (const c of contributors) for (const p of c.assembly_presets || []) s.add(p);
  return Array.from(s);
}

// S11 from the confirmed facings: one wall row per facing (gross area; S11
// nets out what it hosts). Openings are NOT written yet: writing hosts and
// W × H into S11's opening rows left the engine's areas stale and the key
// values blank (2026-11-25 witness); the opening path through the graph is
// the next step (schema/schema.md §0). Returns the count written.
function writeEnvelope(SM, env) {
  const set = (id, v) => SM.setValue(id, String(v), "user-modified");
  let n = 0;
  WALL_ROWS.forEach((r) => set(`d_${r}`, 0));
  env.facings.slice(0, WALL_ROWS.length).forEach((f, i) => {
    const wallRow = WALL_ROWS[i];
    set(`c_${wallRow}`, "walls");
    set(`cf_${wallRow}`, f.facing);
    set(`d_${wallRow}`, f.wall.toFixed(2));
    n++;
  });
  return n;
}
