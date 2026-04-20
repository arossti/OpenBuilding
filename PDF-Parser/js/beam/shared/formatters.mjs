// formatters.mjs
// BEAMweb-side display formatters. Shared so every Phase 4 assembly tab
// (Windows, Ceilings, Structural Elements, ... Garage) consumes the same
// rounding contract as Footings & Slabs — state holds full precision,
// display rounds to the convention below. Emissions as integers to match
// BEAM gSheet; quantities at 2dp to preserve readability without exposing
// float noise.

// Integer kgCO2e for emissions displays. Empty / non-finite / zero render
// as "0" rather than "0 kgCO2e · null" quirks. Uses locale thousands
// separator (1,234) so the UI reads naturally.
export function fmtKg(v) {
  if (!v || !isFinite(v)) return "0";
  const n = Math.round(v);
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// 2dp for quantities (areas / volumes / lengths). Empty / null / zero
// render as "" so cold-start rows stay visually blank instead of reading
// "0.00" on every material. State always holds full precision; only
// display rounds.
export function fmtQty(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!isFinite(n) || n === 0) return "";
  return n.toFixed(2);
}
