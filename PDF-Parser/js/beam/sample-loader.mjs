// sample-loader.mjs
// Loads a curated BEAMweb sample project into the live state.
//
// A sample is a flat-dict JSON file at data/beam/samples/<slug>.json that
// follows BEAMweb's project-export shape — the same format produced by
// FileHandler.exportJson and parsed by FileHandler.importJson. PROJECT-tab
// fields (project_*, dim_*, garage_*) live in the JSON. Per-assembly-tab
// SELECT/qty/pct values come from the BEAM CSV snapshots already staged
// under data/beam/ — no need to duplicate that data into the sample JSON.
//
// Catalog of available samples below; UI surfacing is a single button today
// (Load Sample), with room for a dropdown when more case-study buildings land.

import { FileHandler } from "../shared/file-handler.mjs";
import { loadSampleIntoFootingsSlabs, refreshFootingsSlabsTab } from "./footings-slabs-tab.mjs";
import { refreshProjectForm } from "./project-tab.mjs";
import { syncProjectToFsBridge } from "./auto-fill.mjs";

export const SAMPLES = {
  "single-family-home": {
    label: "Single-Family Home (DOE Prototype)",
    json: "data/beam/samples/single-family-home.json",
    description: "BEAM workbook reference project — used for parity testing against the gSheet."
  }
};

export async function loadSample(sampleId = "single-family-home") {
  const entry = SAMPLES[sampleId];
  if (!entry) throw new Error(`Unknown sample: ${sampleId}`);

  // 1) Fetch the sample's PROJECT-tab JSON.
  const res = await fetch(entry.json, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to fetch ${entry.json}: HTTP ${res.status}`);
  const data = await res.json();

  // 2) Apply PROJECT keys via FileHandler quarantine (sets state=IMPORTED,
  //    listeners muted while writing, FileHandler unmutes at the end).
  FileHandler.importJson(data);

  // 3) FileHandler quarantine muted listeners during import, so the
  //    auto-fill bridge didn't fire. Manually re-sync now so DERIVED
  //    F&S qtys reflect the freshly imported PROJECT values.
  syncProjectToFsBridge();

  // 4) Apply assembly-tab sample selections from the parsed CSV. SELECT'd
  //    rows get IMPORTED state, which beats the DERIVED qty just written
  //    by the auto-fill bridge — i.e., the BEAM workbook's per-row qty
  //    wins for selected materials, while unselected rows in target
  //    groups still mirror the PROJECT auto-fill value.
  const fsCount = loadSampleIntoFootingsSlabs();

  // 5) Sync visible inputs to the new state.
  refreshProjectForm();
  refreshFootingsSlabsTab();

  return {
    sampleId,
    label: entry.label,
    projectFieldCount: Object.keys(data.fields || data).length,
    fsFieldCount: fsCount
  };
}
