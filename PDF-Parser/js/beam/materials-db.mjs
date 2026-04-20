// materials-db.mjs
// Single source of truth for per-material emission factors. Loads the BfCA
// material catalogue (`schema/materials/index.json`, 821 records, staged at
// runtime to `data/schema/materials/`) and exposes lookup + unit-conversion
// helpers consumed by every assembly-tab calc path.
//
// Why this exists: BEAM's gSheet computes per-row emissions as
//   net = qty × pct × per-unit-factor × any-unit-conversion
// where the per-unit factor lives in BEAM's Materials DB (and by extension
// in our schema/materials/index.json). Earlier BEAMweb code derived
// per-unit factors by reverse-engineering them from the assembly CSV's
// pre-computed NET column - that worked when the BEAM sample project had
// non-zero qty for a row, and broke for the rest (METAL PILE / TIMBER PILE
// + REBAR FOR SLABS / COLUMN FOOTINGS). Going direct to the catalogue is
// what BEAM does, and it removes the entire reverse-engineering layer.
//
// Index entry shape (from schema/materials/index.json):
//   { id, beam_id, display_name, category, group_prefix,
//     typical_elements, gwp_kgco2e, functional_unit }
//
// `id` is lowercase hash ("541b20", "9219e5"); `beam_id` preserves the
// workbook's original case ("541b20", "S12345"). Lookups try both so a
// caller can pass either form.

const INDEX_URL = "data/schema/materials/index.json";

let byId = null; // Map<lowercase id, entry>
let byBeamId = null; // Map<beam_id as-is, entry>
let loadPromise = null;
let loadStats = null; // { count, generatedFromCsvSha256 }

export function loadMaterialsDb() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const res = await fetch(INDEX_URL, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Failed to load ${INDEX_URL}: HTTP ${res.status}`);
    const idx = await res.json();
    byId = new Map();
    byBeamId = new Map();
    for (const entry of idx.entries || []) {
      if (entry.id) byId.set(String(entry.id).toLowerCase(), entry);
      if (entry.beam_id) byBeamId.set(String(entry.beam_id), entry);
    }
    loadStats = { count: idx.count || (idx.entries || []).length, sha: idx.generated_from_csv_sha256 };
    return loadStats;
  })();
  return loadPromise;
}

export function getMaterial(hash) {
  if (!hash || !byId) return null;
  return byId.get(String(hash).toLowerCase()) || byBeamId.get(String(hash)) || null;
}

export function getLoadStats() {
  return loadStats;
}

// ──────────────────────────────────────────────────────────────────────
// Unit normalisation + qty conversion.
//
// BEAM uses a few flavours of unit string:
//   "m", "m of pier length"     → length, treated as "m"
//   "m2", "m²"                  → area
//   "m3", "m³"                  → volume
//   "kg"                        → mass
//
// A row's QUANTITY may be in a different unit than the material's
// `functional_unit` — the most common case is CONCRETE SLABS where the
// row is m² and the material EPD is per m³; BEAM converts via the
// group's THICKNESS config.
//
// Conversion paths supported today:
//   row m³ + material m³  → direct (footings concrete, timber piles)
//   row m   + material m  → direct (rebar, piles)
//   row m²  + material m² → direct (insulation per m², membranes, mesh)
//   row m²  + material m³ + group THICKNESS → multiply by thickness in metres
//
// R-VALUE-driven scaling for SUB-SLAB INSULATION is intentionally NOT
// implemented here yet — deferred per design discussion. At default R-VALUE
// the direct m² × per-m² factor matches BEAM; user-modified R-VALUE will
// under-calculate until the BEAM R-value formula is ported.
// ──────────────────────────────────────────────────────────────────────

export function normalizeUnit(u) {
  if (!u) return "";
  return String(u).toLowerCase().trim().replace(/²/g, "2").replace(/³/g, "3").replace(/\s.*/, ""); // "m of pier length" → "m"
}

const IN_TO_M = 0.0254;
const FT_TO_M = 0.3048;

function configValueInMetres(group, getValue) {
  if (!group || !group.config) return null;
  const raw = getValue(`fs_${group.code.replace(/\|/g, "_")}_cfg`);
  const val = raw === null || raw === undefined || raw === "" ? group.config.default : raw;
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (!isFinite(n) || n === 0) return null;
  const u = (group.config.unit || "").toLowerCase();
  if (u === "in") return n * IN_TO_M;
  if (u === "ft") return n * FT_TO_M;
  return n; // assume metres if unit blank or m
}

// Returns the row's qty restated in the material's functional_unit, or
// null when the conversion isn't supported (caller should compute 0).
export function convertQtyToMaterialUnit(rowQty, rowUnit, materialEntry, group, getValue) {
  if (!materialEntry || !(rowQty > 0)) return null;
  const ru = normalizeUnit(rowUnit);
  const mu = normalizeUnit(materialEntry.functional_unit);
  if (!ru || !mu) return null;
  if (ru === mu) return rowQty;

  // m² row + m³ material — apply group THICKNESS (the only conversion
  // currently needed for F&S; will extend as more tabs port).
  if (ru === "m2" && mu === "m3") {
    if (!group || !group.config) return null;
    if (!/^THICKNESS$/i.test(group.config.label || "")) return null;
    const tMetres = configValueInMetres(group, getValue);
    if (!tMetres) return null;
    return rowQty * tMetres;
  }

  return null;
}

if (typeof window !== "undefined") {
  window.BEAM = window.BEAM || {};
  window.BEAM.MaterialsDb = { loadMaterialsDb, getMaterial, getLoadStats, normalizeUnit, convertQtyToMaterialUnit };
}
