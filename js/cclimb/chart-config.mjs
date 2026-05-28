/**
 * chart-config.mjs — Parallel-coordinates axis definitions for CCLIMB
 *
 * One axis per EN 15804+A2 life-cycle module (PT inventory + RT counterfactual),
 * then a divider, then output axes (calculated ΔCRF / ΔT / Completeness).
 *
 * Per Andy's 2026-05-19 clarification: "each axis is an ISO scoped carbon
 * division — A1, A2, A3, etc." Phase grouping is visual (banded backgrounds)
 * rather than per-axis label noise.
 */

// EN 15804+A2 life-cycle modules. Each becomes one editable axis on the chart.
// Module ID, label, phase grouping (for visual banding), and unit.
export const LCA_MODULES = [
  // Product stage
  { id: "A1", label: "A1 Raw materials", phase: "product", unit: "kgCO2e" },
  { id: "A2", label: "A2 Transport", phase: "product", unit: "kgCO2e" },
  { id: "A3", label: "A3 Manufacturing", phase: "product", unit: "kgCO2e" },
  // Construction stage
  { id: "A4", label: "A4 Transport to site", phase: "construction", unit: "kgCO2e" },
  { id: "A5", label: "A5 Install / waste", phase: "construction", unit: "kgCO2e" },
  // Use stage
  { id: "B1", label: "B1 Use", phase: "use", unit: "kgCO2e" },
  { id: "B2", label: "B2 Maintenance", phase: "use", unit: "kgCO2e" },
  { id: "B3", label: "B3 Repair", phase: "use", unit: "kgCO2e" },
  { id: "B4", label: "B4 Replacement", phase: "use", unit: "kgCO2e" },
  { id: "B5", label: "B5 Refurbishment", phase: "use", unit: "kgCO2e" },
  { id: "B6", label: "B6 Operational energy", phase: "use", unit: "kgCO2e" },
  { id: "B7", label: "B7 Operational water", phase: "use", unit: "kgCO2e" },
  // End-of-life stage
  { id: "C1", label: "C1 Demolition", phase: "eol", unit: "kgCO2e" },
  { id: "C2", label: "C2 Transport (EOL)", phase: "eol", unit: "kgCO2e" },
  { id: "C3", label: "C3 Waste processing", phase: "eol", unit: "kgCO2e" },
  { id: "C4", label: "C4 Disposal", phase: "eol", unit: "kgCO2e" },
  // Beyond system boundary
  { id: "D", label: "D Reuse / recovery credit", phase: "beyond", unit: "kgCO2e" }
];

// Calculated output axes (climate-response domain, not inventory domain).
// Practitioner cannot drag these — they're outputs of the IRF convolution.
export const OUTPUT_AXES = [
  { id: "dCRF_20", label: "ΔCRF(20y)", phase: "response", unit: "W·m⁻²·yr", calculated: true },
  { id: "dCRF_50", label: "ΔCRF(50y)", phase: "response", unit: "W·m⁻²·yr", calculated: true },
  { id: "dCRF_100", label: "ΔCRF(100y)", phase: "response", unit: "W·m⁻²·yr", calculated: true },
  { id: "dCRF_Tref", label: "ΔCRF(T_ref)", phase: "response", unit: "W·m⁻²·yr", calculated: true },
  { id: "dT_100", label: "ΔT(100y)", phase: "response", unit: "°C·yr", calculated: true },
  { id: "C_100", label: "Completeness(100)", phase: "response", unit: "—", calculated: true }
];

// Phase grouping for visual banding behind axis labels.
export const PHASE_BANDS = {
  product: { label: "Product stage (A1–A3)", color: "rgba(34, 139, 34, 0.12)" },
  construction: { label: "Construction (A4–A5)", color: "rgba(255, 165, 0, 0.12)" },
  use: { label: "Use stage (B1–B7)", color: "rgba(70, 130, 180, 0.12)" },
  eol: { label: "End of life (C1–C4)", color: "rgba(178, 34, 34, 0.12)" },
  beyond: { label: "Beyond (D)", color: "rgba(128, 128, 128, 0.12)" },
  response: { label: "Climate response (calculated)", color: "rgba(40, 40, 40, 0.18)" }
};

// Provisional T_ref per CCLIMB §5 ("provisionally ~250 years"). Configurable
// until working-group finalizes (see §7.2 of CCLIMB-Workplan2.md).
export const DEFAULT_T_REF_YEARS = 250;

// Default Tier 1 horizon. CCOB had 10 yr; CCLIMB second draft has both 5 and 10.
// (See §7.1 + §11.3 of CCLIMB-Workplan2.md — working-group decision in flight.)
export const DEFAULT_TIER1_HORIZON_YEARS = 5;
