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
// Per-group source files — fetched in parallel with the index so entries
// carry `material_name` + `is_beam_average` (fields the lean index doesn't
// include). Needed so F&S (and future assembly tabs) can compute "BEAM Avg"
// EPD values client-side from the same-subgroup peer entries.
const GROUP_URLS = [
  "data/schema/materials/03-concrete.json",
  "data/schema/materials/04-masonry.json",
  "data/schema/materials/05-metals.json",
  "data/schema/materials/06-wood.json",
  "data/schema/materials/07-thermal.json",
  "data/schema/materials/08-openings.json",
  "data/schema/materials/09-finishes.json",
  "data/schema/materials/31-earthwork.json"
];

let byId = null; // Map<lowercase id, entry>
let byBeamId = null; // Map<beam_id as-is, entry>
let loadPromise = null;
let loadStats = null; // { count, generatedFromCsvSha256 }

export function loadMaterialsDb() {
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    // Fetch index + every group file in parallel. Per-group files are
    // larger (~100-200KB each uncompressed) but the server gzips them.
    // We need them once at boot for is_beam_average + material_name.
    const [indexRes, ...groupResults] = await Promise.all([
      fetch(INDEX_URL, { cache: "no-cache" }).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${INDEX_URL}: HTTP ${r.status}`);
        return r.json();
      }),
      ...GROUP_URLS.map((url) =>
        fetch(url, { cache: "no-cache" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      )
    ]);

    byId = new Map();
    byBeamId = new Map();

    // Build maps off the lean index first — gives us every entry with
    // the core fields (gwp_kgco2e, functional_unit, display_name).
    for (const entry of indexRes.entries || []) {
      if (entry.id) byId.set(String(entry.id).toLowerCase(), entry);
      if (entry.beam_id) byBeamId.set(String(entry.beam_id), entry);
    }

    // Second pass: enrich each entry with `material_name` + `is_beam_average`
    // extracted from the per-group JSON, mutating the in-memory map entries.
    let enriched = 0;
    for (const group of groupResults) {
      if (!group || !Array.isArray(group.records)) continue;
      for (const r of group.records) {
        const idLower = String(r.id || "").toLowerCase();
        const entry = byId.get(idLower);
        if (!entry) continue;
        entry.material_name = r.naming?.material_name || null;
        entry.is_beam_average = !!(r.status && r.status.is_beam_average);
        enriched++;
      }
    }

    loadStats = {
      count: indexRes.count || (indexRes.entries || []).length,
      sha: indexRes.generated_from_csv_sha256,
      enriched
    };
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
// BEAM-Avg client-side compute.
//
// Some "BEAM Avg" EPDs in the DB have `gwp_kgco2e: null` because the
// BEAM gSheet derives the average on the fly from manufacturer peers
// rather than storing it. This helper mutates the in-memory DB entry
// so subsequent getMaterial() calls see the computed value. Peers are
// supplied by the caller because the grouping rule lives in the
// assembly tab's subgroup structure (BfCA has curated which
// manufacturer EPDs belong in which F&S subgroup — e.g. LEGACY XPS
// vs REDUCED GWP XPS vs modern XPS sit in different subgroups, and
// BEAM-Avg averages only within the current subgroup).
//
// Verified for XPS FOAM BOARD (T01|C08|S08):
//   mean(8.515 + 8.466 + 4.672 + 3.742 + 1.927) / 5 = 5.464 kgCO2e/m²·RSI
//   × RSI(1.761 at default R-10) × 110.4 m² = 1,061.86 kgCO2e
//   BEAM gSheet pre-computed NET for this row = 1,061.84 ✓
export function resolveBeamAverage(entry, peerEntries) {
  if (!entry || !entry.is_beam_average || entry.gwp_kgco2e != null) return false;
  const peers = (peerEntries || []).filter(
    (p) => p && !p.is_beam_average && typeof p.gwp_kgco2e === "number" && isFinite(p.gwp_kgco2e)
  );
  if (peers.length === 0) return false;
  const sum = peers.reduce((s, p) => s + p.gwp_kgco2e, 0);
  entry.gwp_kgco2e = sum / peers.length;
  entry.gwp_kgco2e_source = "beam_avg_computed";
  entry.gwp_kgco2e_peer_count = peers.length;
  return true;
}

// ──────────────────────────────────────────────────────────────────────
// Unit normalisation + qty conversion.
//
// Material functional_unit values observed in the DB:
//   "m", "m of pier length"     → length, treated as "m"
//   "m2", "m²"                  → area
//   "m3", "m³"                  → volume
//   "m2•RSI"                    → area × thermal resistance (insulation)
//   "kg"                        → mass
//
// A row's QUANTITY may be in a different unit than the material's
// functional_unit — the common cases for F&S are:
//   • CONCRETE SLABS / AGGREGATE BASE: row m², material m³, group
//     THICKNESS config converts via thickness in metres.
//   • SUB-SLAB INSULATION: row m², material m²·RSI, group R-VALUE
//     config converts via RSI = imperial_R / 5.678.
//
// Conversion paths supported:
//   row m³ + material m³   → direct (footings concrete, timber piles)
//   row m   + material m   → direct (rebar, piles)
//   row m²  + material m²  → direct (membranes, mesh, barriers)
//   row m²  + material m³  + group THICKNESS → × thickness_in_metres
//   row m²  + material m²·RSI + group R-VALUE → × RSI(R/5.678)
// ──────────────────────────────────────────────────────────────────────

export function normalizeUnit(u) {
  if (!u) return "";
  return String(u)
    .toLowerCase()
    .trim()
    .replace(/²/g, "2")
    .replace(/³/g, "3")
    .replace(/[•·]/g, "*") // BULLET / MIDDLE DOT → "*" so "m2•RSI" → "m2*rsi"
    .replace(/\s.*/, ""); // "m of pier length" → "m"
}

const IN_TO_M = 0.0254;
const FT_TO_M = 0.3048;
// Imperial R-value to RSI conversion. R-1 (h·ft²·°F/Btu) = 0.17611 RSI
// (m²·K/W). Reciprocal commonly cited as 5.678 — what BEAM uses.
const R_TO_RSI = 1 / 5.678;

function configRawNumber(group, getValue) {
  if (!group || !group.config) return null;
  const raw = getValue(`fs_${group.code.replace(/\|/g, "_")}_cfg`);
  const val = raw === null || raw === undefined || raw === "" ? group.config.default : raw;
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (!isFinite(n) || n === 0) return null;
  return n;
}

function configValueInMetres(group, getValue) {
  const n = configRawNumber(group, getValue);
  if (n === null) return null;
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

  // m² row + m³ material — apply group THICKNESS.
  if (ru === "m2" && mu === "m3") {
    if (!group || !group.config) return null;
    if (!/^THICKNESS$/i.test(group.config.label || "")) return null;
    const tMetres = configValueInMetres(group, getValue);
    if (!tMetres) return null;
    return rowQty * tMetres;
  }

  // m² row + m²·RSI material — apply group R-VALUE (imperial R → RSI).
  // SUB-SLAB INSULATION + insulation in future Phase 4 tabs.
  if (ru === "m2" && mu === "m2*rsi") {
    if (!group || !group.config) return null;
    if (!/^R-?VALUE$/i.test(group.config.label || "")) return null;
    const rImperial = configRawNumber(group, getValue);
    if (!rImperial) return null;
    return rowQty * rImperial * R_TO_RSI;
  }

  return null;
}

if (typeof window !== "undefined") {
  window.BEAM = window.BEAM || {};
  window.BEAM.MaterialsDb = {
    loadMaterialsDb,
    getMaterial,
    getLoadStats,
    normalizeUnit,
    convertQtyToMaterialUnit,
    resolveBeamAverage
  };
}
