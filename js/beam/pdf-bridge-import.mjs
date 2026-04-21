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

// Params the aggregator needs. Pulled live from StateManager so
// re-opening the preview picks up any edits the user made in between.
const PARAM_FIELDS = [
  "param_wall_height_m",
  "param_basement_height_m",
  "param_roof_pitch_deg",
  "param_footing_height_m",
  "param_footing_width_m"
];

function readParams() {
  const params = {};
  for (const key of PARAM_FIELDS) params[key] = StateManager.getValue(key);
  return params;
}

export async function listProjects() {
  return IDB.listProjects();
}

export async function buildPreview(projectUuid) {
  const project = await IDB.getProject(projectUuid);
  if (!project) throw new Error("project not found: " + projectUuid);
  const params = readParams();
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
    for (const row of preview.rows) {
      if (!toApplySet.has(row.dimId) || !row.hasValue) continue;
      StateManager.setValue(row.dimId, String(row.computed), VS.IMPORTED);
      const polyIds = row.contributors.flatMap((c) => (c.polygons || []).map((p) => p.id));
      polyIdsByDim[row.dimId] = polyIds;
      StateManager.setDimensionSource(row.dimId, buildProvenance(projectUuid, polyIds));
      applied++;
    }
  } finally {
    StateManager.unmuteListeners();
  }

  return { applied, polyIdsByDim, project: preview.project };
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
  const polyCount = agg.contributors.reduce((n, c) => n + (c.polygons ? c.polygons.length : 0), 0);
  return `${polyCount} polygons from ${agg.contributors.length} components`;
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
