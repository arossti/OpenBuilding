/**
 * feedstock-categories.mjs — Tier 1 sub-categories per CCLIMB §3.2
 *
 * Five Tier 1 sub-categories (A/B/C/D/E in CCLIMB second draft). Tier 2
 * (timber) is deferred to v2.
 *
 * @see CCLIMB-Workplan.md §3.2 (Feedstock Categorization Framework)
 * @see CCLIMB-Workplan2.md §3.5 (axis vocabulary per category) + §11.2 (cat refinement CCOB→CCLIMB)
 */

export const FEEDSTOCK_CATEGORIES = {
  A: {
    label: "Residues / waste streams",
    tier: 1,
    typical_counterfactual: "Near-term atmospheric release (decay / incineration)",
    opportunity_cost: "None",
    rt_default: "RT-A:default_5",
    examples: ["Recycled paper", "Demolition wood", "Sawdust", "Slash", "Agricultural straw", "Food waste"],
    notes: "Diversion does not materially reduce ongoing carbon sink capacity at ecosystem scale."
  },
  B: {
    label: "Short-rotation crops",
    tier: 1,
    typical_counterfactual: "Continued short-cycle biological turnover",
    opportunity_cost: "Minimal",
    rt_default: "RT-A:default_1",
    examples: ["Hemp", "Flax", "Switchgrass", "Algae"],
    notes: "Carbon uptake + release largely reset each harvest cycle."
  },
  C: {
    label: "Perennial regenerative systems",
    tier: 1,
    typical_counterfactual: "Continued uptake with minimal stock loss",
    opportunity_cost: "Minimal",
    rt_default: "RT-A:default_5",
    examples: ["Bamboo", "Coppice", "Fast-growing willow"],
    notes: "Root systems / perennial structures remain intact; continued net carbon uptake independent of harvest."
  },
  D: {
    label: "Harvest without depletion (cork, rubber) — v2",
    tier: 1,
    typical_counterfactual: "Continuous harvest without depletion",
    opportunity_cost: "Minimal",
    rt_default: "RT-A:default_5",
    examples: ["Cork", "Rubber", "Coconut fiber"],
    notes: "v2 of CCLIMB-app — methodology second-draft refinement (split out of original C 'perennial systems')."
  },
  E: {
    label: "Engineered atmospheric uptake",
    tier: 1,
    typical_counterfactual: "CO₂ remains in atmosphere absent engineered incorporation",
    opportunity_cost: "None",
    rt_default: "RT-A:default_5",
    examples: ["Mineralized feedstocks (concrete carbonation)", "Captured-CO₂ polymers", "Biochar from CDR"],
    notes: "Excludes ambient carbonation occurring during service life (per CCLIMB §1.2 scope)."
  }
};

// Tier 2 — deferred to v2 of CCLIMB methodology (long-rotation timber: CLT,
// glulam, LVL, dimension lumber). See §6 of CCLIMB-Workplan2.md.
export const TIER_2_NOTE = {
  label: "Virgin long-rotation timber (Category D in original CCLIMB)",
  status: "Deferred to v2 — pending working-group governance for forest counterfactuals",
  blocking_for: "Most structural mass-timber EPDs (CLT, glulam, LVL, framing lumber)"
};
