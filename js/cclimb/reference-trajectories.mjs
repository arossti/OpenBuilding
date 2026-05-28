/**
 * reference-trajectories.mjs — RT-A defaults + RT-B custom
 *
 * Per CCLIMB §4.1 (Climate Interpretation – Reference Trajectory):
 *
 *   RT-A (Near-Term Emission, default for Tier 1):
 *     E_RT(t) = C₀ · k · e^(−k·t),  where k = 1 / τ, τ within 5 yr (or 10 yr)
 *
 *   RT-B (Custom):
 *     E_RT(t) = 0                              for t < t_d
 *     E_RT(t) = C₀ · k · e^(−k·(t − t_d))      for t ≥ t_d
 *
 * @see CCLIMB-Workplan2.md §3.5 — Per-category input requirements (axis vocabulary)
 */

import { DEFAULT_TIER1_HORIZON_YEARS } from "./chart-config.mjs";

// RT-A archetype parameters. The "default" string identifiers correspond to
// the workflow diagram values: −1/+1, −5/+5. Custom is RT-B.
export const RT_A_ARCHETYPES = {
  default_1: {
    label: "RT-A: −1/+1 default",
    growth_years: 1,
    decay_years: 1,
    notes: "Annual-cycle counterfactual (Category B short-rotation crops, fastest return)"
  },
  default_5: {
    label: "RT-A: −5/+5 default",
    growth_years: 5,
    decay_years: 5,
    notes: "Within-5-year horizon (Category A waste / B perennial residues — CCLIMB v2 default)"
  }
  // Other defaults pending working-group decisions (see §7.1 of CCLIMB-Workplan2.md)
};

/**
 * Compute a reference trajectory's per-year emission series.
 *
 * @param {string} type - "RT-A" or "RT-B"
 * @param {Object} params - { archetype: "default_5" } for RT-A, or
 *                          { growth_years: N, decay_years: M } for RT-B
 * @param {number} C0 - Initial carbon stock (kgCO2e equivalent)
 * @param {number} horizonYears - Number of years to compute (typically t_ref)
 * @returns {Array<number>} Per-year emission series [year 0, year 1, ...]
 */
export function getReferenceTrajectory(type, params, C0, horizonYears) {
  if (type === "RT-A") {
    const arch = RT_A_ARCHETYPES[params.archetype || "default_5"];
    const tau = arch.decay_years;
    const k = 1 / tau;
    return Array.from({ length: horizonYears + 1 }, (_, t) => C0 * k * Math.exp(-k * t));
  }
  if (type === "RT-B") {
    const t_d = params.growth_years || 0;
    const tau = params.decay_years || DEFAULT_TIER1_HORIZON_YEARS;
    const k = 1 / tau;
    return Array.from({ length: horizonYears + 1 }, (_, t) =>
      t < t_d ? 0 : C0 * k * Math.exp(-k * (t - t_d))
    );
  }
  throw new Error(`[CCLIMB reference-trajectories] Unknown RT type: ${type}`);
}
