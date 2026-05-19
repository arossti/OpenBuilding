/**
 * climate-model.mjs — Impulse-response convolution for CCLIMB
 *
 * P0 — placeholder. P1 implements:
 *   - CO₂ Bern carbon-cycle IRF (4-exponential AR6 parameterization)
 *   - CH₄ perturbation lifetime IRF (~11.8 yr AR6)
 *   - RF(t) = ∫₀ᵗ E(τ) · IRF(t − τ) dτ (per-gas convolution)
 *   - ΔT(t) from RF(t) via two-box temperature response (AR6 calibrated)
 *
 * Sources to cite in schema/lookups/ipcc-ar6-irf-params.json (P1):
 *   - IPCC AR6 WG1 Chapter 7 — climate sensitivity + impulse response
 *   - Joos et al. 2013 / AR6 — Bern carbon-cycle coefficients
 *
 * @see CCLIMB-Workplan2.md §4.2 — Climate model design
 * @see CCLIMB-Workplan.md §4.2 — Methodology requirements
 */

/**
 * Compute climate response for a project trajectory vs reference trajectory.
 *
 * @param {Object} pt - Project trajectory inventory (per-module + per-year flows)
 * @param {Object} rt - Reference trajectory (counterfactual emissions over time)
 * @param {Object} opts - { horizonYears: 100, tRefYears: 250 }
 * @returns {Object} - { dCRF_20, dCRF_50, dCRF_100, dCRF_Tref, dT_100, completeness }
 */
export function computeClimateResponse(pt, rt, opts = {}) {
  // P1 implementation goes here. For now, a placeholder that returns zeros
  // so the chart can render structurally even without real math.
  console.warn("[CCLIMB climate-model] P1 not yet implemented — returning zeros");
  return {
    dCRF_20: 0,
    dCRF_50: 0,
    dCRF_100: 0,
    dCRF_Tref: 0,
    dT_100: 0,
    completeness: 0
  };
}

// IRF placeholders for P1:
// export function co2_irf(t) { ... Bern 4-exp ... }
// export function ch4_irf(t) { ... AR6 perturbation lifetime ... }
// export function convolve(emissions, irf, horizon) { ... }
