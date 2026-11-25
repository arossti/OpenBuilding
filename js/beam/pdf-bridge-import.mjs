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
    T.StateManager.setValue(row.dimId, String(row.computed), "user-modified");
    applied++;
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
