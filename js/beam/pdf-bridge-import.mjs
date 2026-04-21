// pdf-bridge-import.mjs
// BEAMweb side of the PDF-Parser bridge. Reads the parser's saved
// projects from IndexedDB, runs the shared aggregator against the
// user's current param_* values, and writes resolved dimension values
// into StateManager with provenance tracked via dimension_sources.
//
// UI flow (see modal in beamweb.html):
//   1. User clicks "Import PDF-Parser" → openImportModal()
//   2. Modal lists saved parser projects; user picks one
//   3. buildPreview(uuid) aggregates; modal renders a diff table
//      (current StateManager value vs new value per dim)
//   4. User toggles which rows to apply, clicks Apply
//   5. applyImport(projectUuid, selectedDimIds) writes to StateManager

import { StateManager } from "../shared/state-manager.mjs";
import * as IDB from "../shared/indexed-db-store.mjs";
import { computeAllDimensions, COMPONENT_TO_DIMENSION } from "../shared/polygon-map.mjs";

const VS = StateManager.VALUE_STATES;

// Params the aggregator needs. Resolved with StateManager as primary source
// (BEAMweb PROJECT → Geometry Parameters — user's authoritative values) and
// the Parser-side project.params as fallback (entered in the Parser sidebar
// before ever opening BEAMweb). Either side can seed the bridge.
const PARAM_FIELDS = [
  "param_wall_height_m",
  "param_basement_height_m",
  "param_roof_pitch_deg",
  "param_footing_height_m",
  "param_footing_width_m"
];

// Dims that render as L × H × W inputs on PROJECT. Their storage keys are
// `${id}_length` / `${id}_height` / `${id}_width`; `${id}_volume` is CALCULATED
// from the three children via recomputeVolume. Writing the parent id directly
// would land in a key nothing reads, so decompose on apply: volume ÷ (H × W)
// = length, then push H + W from the params. recomputeVolume fires after
// refreshProjectForm and notifies the auto-fill listener that flows the
// volume downstream to F&S.
const LHW_DIMS = {
  dim_continuous_footings: {
    heightParam: "param_footing_height_m",
    widthParam: "param_footing_width_m"
  },
  garage_continuous_footings: {
    heightParam: "param_footing_height_m",
    widthParam: "param_footing_width_m"
  }
};

function readParams(project) {
  const params = {};
  const fromProject = (project && project.projectJson && project.projectJson.params) || {};
  for (const key of PARAM_FIELDS) {
    const fromState = StateManager.getValue(key);
    if (fromState != null && fromState !== "") {
      params[key] = fromState;
    } else if (fromProject[key] != null && fromProject[key] !== "") {
      params[key] = fromProject[key];
    }
  }
  return params;
}

export async function listProjects() {
  return IDB.listProjects();
}

export async function buildPreview(projectUuid) {
  const project = await IDB.getProject(projectUuid);
  if (!project) throw new Error("project not found: " + projectUuid);
  const params = readParams(project);
  const dims = computeAllDimensions({ projectJson: project.projectJson, params });

  // Pair each computed dim with its current StateManager value so the UI
  // can show "before → after" and highlight deltas.
  const rows = [];
  for (const [dimId, agg] of Object.entries(dims)) {
    const current = StateManager.getValue(dimId);
    const hasNew = agg.value != null;
    rows.push({
      dimId,
      current: current != null && current !== "" ? current : null,
      computed: hasNew ? roundForDisplay(agg.value, dimId) : null,
      summary: buildSummary(agg),
      contributors: agg.contributors || [],
      warnings: agg.warnings || [],
      hasValue: hasNew,
      missingParams: extractMissingParams(agg),
      assemblyPresets: uniquePresets(agg.contributors || [])
    });
  }

  // Sort deterministic — put rows with computed values first so the user
  // sees the actionable stuff on top.
  rows.sort((a, b) => {
    if (a.hasValue !== b.hasValue) return a.hasValue ? -1 : 1;
    return a.dimId.localeCompare(b.dimId);
  });

  return {
    project,
    params,
    rows,
    paramsComplete: PARAM_FIELDS.every((k) => params[k] != null && params[k] !== "")
  };
}

export async function applyImport(projectUuid, dimIdsToApply) {
  const preview = await buildPreview(projectUuid);
  const toApplySet = new Set(dimIdsToApply);
  let applied = 0;
  const polyIdsByDim = {};

  StateManager.muteListeners();
  try {
    // Propagate any Parser-side params into StateManager when BEAMweb's own
    // values are blank. Keeps PROJECT → Geometry Parameters in sync with the
    // Parser sidebar without forcing the user to re-type values.
    const parserParams = (preview.project.projectJson && preview.project.projectJson.params) || {};
    for (const key of PARAM_FIELDS) {
      const current = StateManager.getValue(key);
      if ((current == null || current === "") && parserParams[key] != null && parserParams[key] !== "") {
        StateManager.setValue(key, String(parserParams[key]), VS.IMPORTED);
        StateManager.setDimensionSource(key, "pdf:param");
      }
    }

    for (const row of preview.rows) {
      if (!toApplySet.has(row.dimId) || !row.hasValue) continue;
      const polyIds = row.contributors.flatMap((c) => (c.polygons || []).map((p) => p.id));
      writeDimValue(row, preview.params);
      polyIdsByDim[row.dimId] = polyIds;
      StateManager.setDimensionSource(row.dimId, buildProvenance(projectUuid, polyIds));
      applied++;
    }
  } finally {
    StateManager.unmuteListeners();
  }

  return { applied, polyIdsByDim, project: preview.project };
}

function writeDimValue(row, params) {
  const lhw = LHW_DIMS[row.dimId];
  if (!lhw) {
    StateManager.setValue(row.dimId, String(row.computed), VS.IMPORTED);
    return;
  }
  const H = Number(params[lhw.heightParam]);
  const W = Number(params[lhw.widthParam]);
  if (!Number.isFinite(H) || H <= 0 || !Number.isFinite(W) || W <= 0) {
    // Params missing — fall back to writing the computed volume directly.
    // recomputeVolume will zero it out on next refresh, but at least the row
    // persists in state and we have a paper trail. In practice this branch
    // should not fire because the preview already guards on missing params.
    StateManager.setValue(`${row.dimId}_volume`, String(row.computed), VS.IMPORTED);
    return;
  }
  const length = row.computed / (H * W);
  StateManager.setValue(`${row.dimId}_length`, String(Number(length.toFixed(4))), VS.IMPORTED);
  StateManager.setValue(`${row.dimId}_height`, String(H), VS.IMPORTED);
  StateManager.setValue(`${row.dimId}_width`, String(W), VS.IMPORTED);
}

function buildProvenance(projectUuid, polyIds) {
  if (!polyIds || polyIds.length === 0) return "pdf";
  if (polyIds.length === 1) return `pdf:${polyIds[0]}`;
  return `pdf:sum:${polyIds.join("+")}`;
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

function roundForDisplay(value, dimId) {
  // Volumes to 3 decimal places, everything else to 2.
  const isVolume = /volume|continuous_footings|columns_piers/.test(dimId);
  const d = isVolume ? 3 : 2;
  return Number(value.toFixed(d));
}
