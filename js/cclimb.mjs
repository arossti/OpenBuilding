/**
 * cclimb.mjs — ESM entry for the CCLIMB module
 *
 * Phase 0 — scaffolding only. Wires the form pane + parallel-coords container
 * but does not yet run the climate calc (P1).
 *
 * Methodology: docs/RMI Work/CCLIMB-Workplan.md
 * Implementation workplan: docs/RMI Work/CCLIMB-Workplan2.md
 */

import { LCA_MODULES, OUTPUT_AXES } from "./cclimb/chart-config.mjs";
import { initParallelCoords } from "./cclimb/parallel-coords.mjs";
import { computeClimateResponse } from "./cclimb/climate-model.mjs";
import { getReferenceTrajectory } from "./cclimb/reference-trajectories.mjs";
import { FEEDSTOCK_CATEGORIES } from "./cclimb/feedstock-categories.mjs";

console.log("[CCLIMB] scaffold loaded. Modules:", LCA_MODULES.length, "axes");

// ── Form binding (placeholder) ────────────────────────────────────────────
//
// In P1, this will read the form inputs, build a candidate record, and
// dispatch to computeClimateResponse() → render via initParallelCoords().

function bindForm() {
  const computeBtn = document.getElementById("cclimb-compute");
  if (!computeBtn) return;
  computeBtn.addEventListener("click", () => {
    console.log("[CCLIMB] compute clicked — P1 will wire this");
    // TODO P1: read form fields, build inventory + RT spec, call computeClimateResponse
  });
}

// ── Chart bootstrap (placeholder) ─────────────────────────────────────────
//
// P0 stubs the container; P1 replaces the placeholder with a real D3 render.

function bootstrapChart() {
  const container = document.getElementById("cclimb-pcg-container");
  if (!container) return;
  // P1: initParallelCoords(container, { modules: LCA_MODULES, outputAxes: OUTPUT_AXES, rt: [], pt: [] });
  console.log(
    "[CCLIMB] chart bootstrap deferred to P1. Axes ready:",
    LCA_MODULES.map((m) => m.id).join(", "),
    "→",
    OUTPUT_AXES.map((a) => a.id).join(", ")
  );
}

document.addEventListener("DOMContentLoaded", () => {
  bindForm();
  bootstrapChart();
});
