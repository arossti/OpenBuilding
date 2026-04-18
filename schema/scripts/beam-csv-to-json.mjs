#!/usr/bin/env node
// BEAM CSV → material JSON importer. Node ESM, zero deps.
//
// Usage:
//   node beam-csv-to-json.mjs --row LAM011               stdout JSON for one row
//   node beam-csv-to-json.mjs --row LAM011 --out FILE    write single record
//   node beam-csv-to-json.mjs --diff                     compare --row LAM011 output to sample.json (structural)
//   node beam-csv-to-json.mjs --all --out-dir materials  batch all 825 → per-CSI-division files + index.json
//
// Pipeline per row:
//   1. RFC-4180 CSV tokenise (quoted fields, escaped quotes, embedded newlines already flattened in source)
//   2. Parse raw → evaluate formulas against the same row → canonicalise types → build record
//   3. Fill derived fields (id slug, CSI division, lifecycle scope, biogenic method, rendering defaults)
//   4. Always emit the full schema-complete shape (340 impact slots + every other null)
//
// Design intent:
//   - Pure data transform. No network, no dep. Node ≥18 assumed (readFileSync, URL).
//   - Reproducible: running twice on the same CSV produces byte-identical output.
//   - Auditable: every non-null field traces to a BEAM column (documented in schema.md §5.1) or
//     an explicit derivation rule below.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = resolve(__dirname, "..");
const CSV_PATH = join(SCHEMA_DIR, "BEAM Database-DUMP.csv");

// ---------------------------------------------------------------------------
// CSV tokeniser (RFC 4180, minimal). Source CSV has no embedded newlines
// inside fields (verified; cleaned in commit 0714485), so we can split lines first.
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  // Trim trailing fully-empty row (terminal newline artefact)
  if (rows.length && rows[rows.length - 1].every(f => f === "")) rows.pop();
  return rows;
}

// ---------------------------------------------------------------------------
// Column letter ↔ index helpers
// ---------------------------------------------------------------------------
function colToIdx(letters) {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

// ---------------------------------------------------------------------------
// Formula evaluator. Only arithmetic on same-row cell refs is allowed.
// Patterns observed in BEAM CSV:
//   =Q545/11.249                              → division by constant
//   =AE545*AF545                              → 2-operand multiplication
//   =(AG545*AI545)*X545*Y545*3.67             → nested product
//   =IFERROR(@__xludf.DUMMYFUNCTION("..."), "fallback")   → pull the fallback literal
// ---------------------------------------------------------------------------
function extractIferrorFallback(formula) {
  // Trailing quoted argument to IFERROR — use a tail scan for the final `, "…"`
  // that terminates with `)` at end of string, tolerating escaped quotes.
  const m = formula.match(/,\s*"((?:[^"\\]|\\.)*)"\s*\)\s*$/);
  return m ? m[1] : null;
}

function evalArithmeticFormula(formula, row, depth = 0) {
  if (depth > 8) return null;
  let expr = formula.startsWith("=") ? formula.slice(1) : formula;
  if (!/^[A-Z0-9.()*\/+\-\s]+$/.test(expr)) return null;
  expr = expr.replace(/([A-Z]+)(\d+)/g, (_m, letters) => {
    const idx = colToIdx(letters);
    const v = row[idx];
    if (v === undefined || v === "") return "0";
    const s = String(v).trim();
    if (s.startsWith("=")) {
      const inner = evalArithmeticFormula(s, row, depth + 1);
      return Number.isFinite(inner) ? String(inner) : "0";
    }
    const n = Number(s);
    return Number.isFinite(n) ? String(n) : "0";
  });
  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${expr});`)();
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Field readers with type coercion and known-dirty-value handling
// ---------------------------------------------------------------------------
function readRaw(row, col) {
  const v = row[colToIdx(col)];
  return v === undefined ? "" : v;
}
function readStr(row, col) {
  const v = readRaw(row, col).trim();
  return v === "" ? null : v;
}
function readNum(row, col) {
  const v = readRaw(row, col).trim();
  if (v === "") return null;
  if (v.startsWith("=")) {
    // Formula — evaluate or give up
    if (v.includes("IFERROR") || v.includes("DUMMYFUNCTION")) return null;
    return evalArithmeticFormula(v, row);
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function readBool(row, col) {
  const v = readRaw(row, col).trim().toUpperCase();
  if (v === "TRUE") return true;
  if (v === "FALSE") return false;
  return null;
}

// ---------------------------------------------------------------------------
// Excel date serial → ISO date. Excel epoch is 1899-12-30 (Google Sheets + modern Excel).
// Heuristic: values < 3000 are interpreted as year integers (EPD expiry column uses that).
// ---------------------------------------------------------------------------
function excelSerialToIso(serial) {
  if (!Number.isFinite(serial) || serial < 30000) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + Math.round(serial) * 86400000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function yearOrSerialToExpiryIso(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 3000) return `${Math.round(n)}-12-31`;
  return excelSerialToIso(n);
}

// ---------------------------------------------------------------------------
// Slug: lowercase the BEAM ID. Preserve case-exact separately in external_refs.
// ---------------------------------------------------------------------------
function makeId(beamId) {
  return beamId.toLowerCase();
}

// ---------------------------------------------------------------------------
// Country-code lookup. Unmapped values go to a reporter and null-out.
// ---------------------------------------------------------------------------
function normaliseCountry(raw, lookup, warnings, context) {
  if (!raw) return [];
  const s = raw.trim();
  if (!s) return [];
  const hit = lookup.map[s];
  if (hit) return hit;
  warnings.push({ kind: "unmapped_country", context, value: s });
  return [];
}

// ---------------------------------------------------------------------------
// CSI division inference: material_type → division, then display-name keyword fallback.
// ---------------------------------------------------------------------------
function inferDivisionPrefix(materialType, displayName, mtLookup, kwLookup, warnings, context) {
  if (materialType && mtLookup.map[materialType]) return mtLookup.map[materialType];
  if (displayName) {
    const lc = displayName.toLowerCase();
    for (const p of kwLookup.patterns) if (lc.includes(p.pattern)) return p.division;
  }
  warnings.push({ kind: "unresolved_division", context, material_type: materialType, display_name: displayName });
  return null;
}

// ---------------------------------------------------------------------------
// typical_elements default from material_type
// ---------------------------------------------------------------------------
function inferTypicalElements(materialType, productSubtype, elementsLookup) {
  if (productSubtype && elementsLookup.product_subtype_overrides?.[productSubtype]) {
    return [...elementsLookup.product_subtype_overrides[productSubtype]];
  }
  if (materialType && elementsLookup.material_type_defaults[materialType]) {
    return [...elementsLookup.material_type_defaults[materialType]];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Empty impact block with all 17 stages
// ---------------------------------------------------------------------------
const ALL_STAGES = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "C1", "C2", "C3", "C4", "D"];
function emptyImpactBlock() {
  // Sparse-by-default: by_stage starts empty; only populated stages appear.
  // `total` keeps its {value, source} shape so consumers can find the aggregate
  // slot by name whether or not it is populated.
  return { total: { value: null, source: null }, by_stage: {} };
}
function addStageValue(block, stage, value, source) {
  if (value === null || value === undefined) return;
  block.by_stage[stage] = { value, source };
}

// ---------------------------------------------------------------------------
// Rendering defaults per CSI division. First-pass placeholders; will be refined
// later by ABCD.EARTH fuzzy match (Phase 1.x polish) and per-material-type override.
// ---------------------------------------------------------------------------
const RENDERING_DEFAULTS = {
  "03": { base_color: [0.72, 0.71, 0.69, 1.0], metallic: 0.0,  roughness: 0.85, texture: null, has_grain: false },
  "04": { base_color: [0.70, 0.45, 0.35, 1.0], metallic: 0.0,  roughness: 0.80, texture: null, has_grain: false },
  "05": { base_color: [0.75, 0.77, 0.80, 1.0], metallic: 0.85, roughness: 0.35, texture: null, has_grain: false },
  "06": { base_color: [0.82, 0.68, 0.44, 1.0], metallic: 0.0,  roughness: 0.78, texture: null, has_grain: true  },
  "07": { base_color: [0.88, 0.85, 0.80, 1.0], metallic: 0.0,  roughness: 0.90, texture: null, has_grain: false },
  "08": { base_color: [0.60, 0.75, 0.85, 0.6], metallic: 0.0,  roughness: 0.10, texture: null, has_grain: false },
  "09": { base_color: [0.90, 0.88, 0.84, 1.0], metallic: 0.0,  roughness: 0.70, texture: null, has_grain: false },
  "31": { base_color: [0.55, 0.50, 0.45, 1.0], metallic: 0.0,  roughness: 0.95, texture: null, has_grain: false },
  "32": { base_color: [0.55, 0.55, 0.55, 1.0], metallic: 0.0,  roughness: 0.90, texture: null, has_grain: false }
};
function defaultRenderingForDivision(prefix) {
  const d = RENDERING_DEFAULTS[prefix] || RENDERING_DEFAULTS["09"];
  return { ...d, base_color: [...d.base_color] };
}

// ---------------------------------------------------------------------------
// Fire combustibility default per CSI division (first-pass heuristic; Phase 6 refines)
// ---------------------------------------------------------------------------
function defaultCombustibility(prefix, materialType) {
  const nonComb = new Set(["03", "04", "31", "32"]);
  const comb    = new Set(["06"]);
  if (materialType === "Steel" || materialType === "Aluminum" || materialType === "Metal" || materialType === "Ground screw") return "non_combustible";
  if (nonComb.has(prefix)) return "non_combustible";
  if (comb.has(prefix)) return "combustible";
  return null;
}

// ---------------------------------------------------------------------------
// Standards split (comma-separated in BEAM cell)
// ---------------------------------------------------------------------------
function splitStandards(raw) {
  if (!raw) return [];
  return raw.split(/[,;]\s*/).map(s => s.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Build one record from one CSV row
// ---------------------------------------------------------------------------
function buildRecord({ row, rowIndex, lookups, warnings, csvSha256 }) {
  const w = (kind, extra = {}) => warnings.push({ kind, row: rowIndex, beam_id: readStr(row, "A"), ...extra });

  // --- Identity -----------------------------------------------------------
  const beamId = readStr(row, "A");
  if (!beamId) { w("blank_id"); return null; }
  const displayName = readStr(row, "B");

  // --- Classification (division first; drives defaults downstream) --------
  const materialType = readStr(row, "AT");
  const divisionPrefix = inferDivisionPrefix(materialType, displayName, lookups.mt, lookups.kw, warnings, { row: rowIndex, beamId });
  const divisionMeta = divisionPrefix ? lookups.csi.divisions[divisionPrefix] : null;

  // --- carbon.stated ------------------------------------------------------
  const statedValue = readNum(row, "Q");
  const statedPerUnit = readStr(row, "R");
  const statedSource = readStr(row, "AZ"); // "Product-specific" / "Industry Average" etc — derive `source` enum
  let epdTypeEnum = null;
  if (statedSource) {
    const lc = statedSource.toLowerCase();
    if (lc.includes("product")) epdTypeEnum = "product_specific";
    else if (lc.includes("industry")) epdTypeEnum = "industry_average";
    else if (lc.includes("generic")) epdTypeEnum = "generic";
    else if (lc.includes("beam")) epdTypeEnum = "beam_average";
  }
  const carbonStatedSourceEnum = epdTypeEnum === "industry_average" ? "industry_average"
    : epdTypeEnum === "beam_average" ? "industry_average"
    : statedValue !== null ? "epd"
    : null;

  // --- carbon.conversion: parse col S formula (e.g. =Q545/11.249) ---------
  const commonValueRaw = readRaw(row, "S").trim();
  let commonValue = null;
  let conversionDivisor = null; // "11.249" from =Q545/11.249
  if (commonValueRaw.startsWith("=")) {
    const m = commonValueRaw.match(/=\s*[A-Z]+\d+\s*\/\s*([0-9.]+)\s*$/);
    if (m) conversionDivisor = parseFloat(m[1]);
    const v = evalArithmeticFormula(commonValueRaw, row);
    commonValue = v !== null ? Math.round(v * 100) / 100 : null;
  } else if (commonValueRaw !== "") {
    const n = Number(commonValueRaw);
    if (Number.isFinite(n)) commonValue = Math.round(n * 100) / 100;
  }
  const conversionFactor = conversionDivisor ? Math.round((1 / conversionDivisor) * 1000000) / 1000000 : null;

  // --- carbon.biogenic: AE = full-C formula, AB = AE*AF ------------------
  const biogenicFullRaw = readRaw(row, "AE").trim();
  const biogenicFullEval = biogenicFullRaw.startsWith("=") ? evalArithmeticFormula(biogenicFullRaw, row) : (biogenicFullRaw ? Number(biogenicFullRaw) : null);
  const biogenicFull = biogenicFullEval !== null && Number.isFinite(biogenicFullEval) ? Math.round(biogenicFullEval * 100) / 100 : null;
  const biogenicStoredRaw = readRaw(row, "AB").trim();
  const biogenicStoredEval = biogenicStoredRaw.startsWith("=") ? evalArithmeticFormula(biogenicStoredRaw, row) : (biogenicStoredRaw ? Number(biogenicStoredRaw) : null);
  const biogenicStored = biogenicStoredEval !== null && Number.isFinite(biogenicStoredEval) ? Math.round(biogenicStoredEval * 100) / 100 : null;
  const density = readNum(row, "AG");
  const addnFactor = readNum(row, "AI");
  const biogenicFactor = readNum(row, "X");
  const carbonContent = readNum(row, "Y");
  const storageRetention = readNum(row, "AF");
  // carbon_content_kgc_per_unit = density × thickness × biogenicFactor × carbonContent (no CO2/C ratio)
  let carbonContentKgcPerUnit = null;
  if (density !== null && addnFactor !== null && biogenicFactor !== null && carbonContent !== null) {
    carbonContentKgcPerUnit = Math.round(density * addnFactor * biogenicFactor * carbonContent * 100) / 100;
  }
  const biogenicMethod = (biogenicFactor !== null && carbonContent !== null) ? "wwf_storage_factor" : "none";

  // --- Column AC: known dirty (label leaks into data); null if non-numeric ---
  const rawAC = readRaw(row, "AC").trim();
  if (rawAC && Number.isNaN(Number(rawAC))) {
    // Expected — the LAM011 case ("m2 at 3.5\"") is a BEAM sheet bug. Not a warning, just a drop.
  }

  // --- Footnote: extract IFERROR fallback literal -----------------------------
  const footnoteRaw = readRaw(row, "H");
  const footnote = footnoteRaw.startsWith("=") ? extractIferrorFallback(footnoteRaw) : (footnoteRaw.trim() || null);

  // --- Dates ----------------------------------------------------------------
  const dataModSerial = readNum(row, "P");
  const dataModIso = dataModSerial !== null ? excelSerialToIso(dataModSerial) : null;
  const epdExpiry = yearOrSerialToExpiryIso(readRaw(row, "G"));

  // --- Classification continued (typical_elements, csi_masterformat) ------
  const productSubtype = readStr(row, "AW");
  const typicalElements = inferTypicalElements(materialType, productSubtype, lookups.el);
  const csiMasterformat = readStr(row, "AX");

  // --- Status flags -------------------------------------------------------
  const listed = readBool(row, "C");
  const doNotList = readBool(row, "D");
  const isIndustry = readBool(row, "E");
  const isBeam = readBool(row, "F");
  const visibility = doNotList === true ? "hidden" : "public";

  // --- lifecycle_stages: default cradle-to-gate when EPD-backed and no per-stage data is present
  // (BEAM cols don't declare scope; most EPDs behind the BEAM rows are A1-A3. Flagged for Phase 2 refinement.)
  const defaultLifecycleStages = statedValue !== null ? ["A1", "A2", "A3"] : [];

  // --- Construct record ---------------------------------------------------
  const record = {
    "$schema": "https://bfca.ca/schemas/material-v1.json",
    "schema_version": 1,
    "id": makeId(beamId),

    "external_refs": {
      "beam_id": beamId,
      "beam_csv_row_index": rowIndex,
      "mce2_id": null,
      "ec3_id": null,
      "ifc_material_guid": null
    },

    "naming": {
      "display_name": displayName,
      "short_name": null,
      "material_name": readStr(row, "I"),
      "product_brand_name": readStr(row, "K")
    },

    "manufacturer": {
      "name": readStr(row, "J"),
      "country_code": (() => {
        const list = normaliseCountry(readStr(row, "N"), lookups.cc, warnings, { row: rowIndex, beamId, col: "N" });
        return list.length === 1 ? list[0] : (list[0] || null);
      })(),
      "specifications": readStr(row, "L"),
      "website": null
    },

    "notes": readStr(row, "M"),
    "source_notes": footnote,

    "status": {
      "listed": listed === true,
      "do_not_list": doNotList === true,
      "is_industry_average": isIndustry === true,
      "is_beam_average": isBeam === true,
      "visibility": visibility
    },

    "classification": {
      "division_prefix": divisionPrefix,
      "division_name": divisionMeta ? divisionMeta.name : null,
      "category": divisionMeta ? divisionMeta.category_slug : null,
      "csi_masterformat": csiMasterformat,
      "uniformat_level2": null,
      "material_type": materialType,
      "material_subtype": readStr(row, "AU"),
      "product_type": readStr(row, "AV"),
      "product_subtype": readStr(row, "AW"),
      "typical_elements": typicalElements
    },

    "rendering": divisionPrefix ? defaultRenderingForDivision(divisionPrefix) : { base_color: [0.5, 0.5, 0.5, 1.0], metallic: 0.0, roughness: 0.8, texture: null, has_grain: false },

    "physical": {
      "density": {
        "value_kg_m3": density,
        "value_lb_ft3": density !== null ? Math.round(density * 0.06243 * 100) / 100 : null,
        "source": density !== null ? "epd" : null
      },
      "thermal": {
        "conductivity_w_mk": readNum(row, "AL"),
        "resistance_per_inch_rsi": null,
        "r_value_per_inch_imperial": readNum(row, "AK"),
        "heat_capacity_j_kgk": null
      },
      "moisture_content_pct": readNum(row, "AM"),
      "mass_per_unit_kg": readNum(row, "AN"),
      "dimensions": {
        "length_m": readNum(row, "AO"),
        "width_m": readNum(row, "AP"),
        "depth_m": (() => {
          const explicit = readNum(row, "AQ");
          if (explicit !== null) return explicit;
          const afUnits = readStr(row, "AJ") || "";
          if (/thickness/i.test(afUnits) && /\bm\b/i.test(afUnits)) return addnFactor;
          return null;
        })(),
        "unit_volume_m3": readNum(row, "AR"),
        "units_per_m2": conversionDivisor !== null ? conversionDivisor : readNum(row, "AS")
      },
      "additional_factor": {
        "value": addnFactor,
        "units": readStr(row, "AJ"),
        "description": addnFactor !== null && readStr(row, "AJ") ? `Nominal ${addnFactor} ${readStr(row, "AJ")}` : null
      }
    },

    "carbon": {
      "stated": {
        "value_kgco2e": statedValue,
        "per_unit": statedPerUnit,
        "source": carbonStatedSourceEnum,
        "lifecycle_stages": defaultLifecycleStages
      },
      "conversion": {
        "to_common_unit": readStr(row, "T"),
        "factor": conversionFactor,
        "factor_formula": conversionDivisor !== null ? `stated_per_${(statedPerUnit || "unit").toLowerCase().replace(/[^a-z0-9]+/g, "_")} / units_per_m2` : null,
        "factor_source": conversionDivisor !== null ? "physical_dimensions" : null,
        "notes": conversionDivisor !== null ? `${statedPerUnit || "unit"} → ${readStr(row, "T") || "common"} via ${conversionDivisor} units/m²` : null
      },
      "common": {
        "value_kgco2e": commonValue,
        "per_functional_unit": readStr(row, "T"),
        "metric_unit_label": readStr(row, "U"),
        "imperial_unit_label": readStr(row, "V")
      },
      "biogenic": {
        "gwp_bio_from_epd_kgco2e_per_common_unit": readNum(row, "W"),
        "carbon_content_pct_kgc_kg": carbonContent,
        "biogenic_factor": biogenicFactor,
        "storage_retention_pct": storageRetention,
        "wwf_storage_factor_kgco2e_per_kgc": biogenicStored,
        "stored_kgco2e_per_common_unit": biogenicStored,
        "full_carbon_kgco2e_per_common_unit": biogenicFull,
        "carbon_content_kgc_per_unit": carbonContentKgcPerUnit,
        "co2_to_c_molar_ratio": biogenicMethod === "wwf_storage_factor" ? 3.67 : null,
        "method": biogenicMethod,
        "notes": biogenicMethod === "wwf_storage_factor" ? "full_C = density × thickness × biogenic_factor × carbon_content × 3.67; stored = full_C × storage_retention" : null
      }
    },

    "impacts": (() => {
      const out = {
        "functional_unit": readStr(row, "T"),
        "gwp_kgco2e": emptyImpactBlock(),
        "gwp_bio_kgco2e": emptyImpactBlock(),
        "eutrophication_kgneq": emptyImpactBlock(),
        "acidification_kgso2eq": emptyImpactBlock(),
        "ozone_depletion_kgcfc11eq": emptyImpactBlock(),
        "smog_kgo3eq": emptyImpactBlock(),
        "abiotic_depletion_fossil_mj": emptyImpactBlock(),
        "water_consumption_m3": emptyImpactBlock(),
        "primary_energy_nonrenewable_mj": emptyImpactBlock(),
        "primary_energy_renewable_mj": emptyImpactBlock()
      };
      if (commonValue !== null) {
        out.gwp_kgco2e.total = { value: commonValue, source: "beam_derived" };
      }
      return out;
    })(),

    "cost": { "unit": null, "cad_per_unit": null, "year": null, "geography": null, "source": null },

    "fire": {
      "frr_hours": null,
      "combustibility": defaultCombustibility(divisionPrefix, materialType),
      "ulc_listing": null,
      "flame_spread_rating": null,
      "smoke_developed_rating": null
    },

    "code_compliance": {
      "nbc_part_9_suitable": null,
      "nbc_part_3_suitable": null,
      "vbbl_s10_4_accepted": null,
      "cov_appendix_ii_listed": null
    },

    "epd": {
      "id": readStr(row, "AY"),
      "type": epdTypeEnum,
      "owner": readStr(row, "BA"),
      "prepared_by": readStr(row, "BB"),
      "program_operator": readStr(row, "BC"),
      "validation": {
        "type": (() => {
          const v = (readStr(row, "BD") || "").toLowerCase();
          if (v.includes("external")) return "external";
          if (v.includes("internal")) return "internal";
          return null;
        })(),
        "agent": readStr(row, "BE")
      },
      "publication_date": null,
      "expiry_date": epdExpiry,
      "product_service_life_years": readNum(row, "BK"),
      "source_document_url": readStr(row, "BL"),
      "footnote": footnote
    },

    "methodology": {
      "standards": splitStandards(readStr(row, "BF")),
      "pcr_guidelines": readStr(row, "BG"),
      "lca_method": readStr(row, "BH"),
      "lca_software": readStr(row, "BI"),
      "lci_database": readStr(row, "BJ"),
      "lifecycle_scope": {
        "stages_included": defaultLifecycleStages,
        "cutoff_rule_pct": null,
        "allocation_method": null
      }
    },

    "provenance": {
      "countries_of_manufacture": normaliseCountry(readStr(row, "N"), lookups.cc, warnings, { row: rowIndex, beamId, col: "N" }),
      "markets_of_applicability": normaliseCountry(readStr(row, "O"), lookups.cc, warnings, { row: rowIndex, beamId, col: "O" }),
      "data_added_or_modified": dataModIso,
      "original_beam_added_or_modified_serial": dataModSerial,
      "source_notes": null,
      "import_metadata": {
        "imported_from": "BEAM Database-DUMP.csv",
        "import_date": new Date().toISOString().slice(0, 10),
        "beam_csv_row_index": rowIndex,
        "beam_csv_sha256": csvSha256
      }
    }
  };

  return record;
}

// ---------------------------------------------------------------------------
// Sparse-by-default serialization. Full template structure lives in sample.json
// (human reference) and material.schema.json (formal validator). Per-material
// records only carry populated fields. Rules:
//   - Null scalar leaves are dropped (readers use `?.` + nullish coalescing).
//   - Arrays are kept as-is (including empty `[]` — preserves .forEach safety).
//   - `impacts.<category>.total` keeps its {value, source} shape even when both
//     are null — consumers find the aggregate slot by name. `by_stage` contains
//     only populated stage slots.
//   - Empty sub-objects elsewhere collapse away.
//   - After prune, normalize() guarantees the 15 top-level object blocks exist
//     and all 10 impact categories are present (as empty skeletons if needed).
// ---------------------------------------------------------------------------
const TOP_LEVEL_OBJECT_KEYS = [
  "external_refs", "naming", "manufacturer", "status", "classification",
  "rendering", "physical", "carbon", "impacts", "cost", "fire",
  "code_compliance", "epd", "methodology", "provenance"
];
const IMPACT_CATEGORIES = [
  "gwp_kgco2e", "gwp_bio_kgco2e", "eutrophication_kgneq", "acidification_kgso2eq",
  "ozone_depletion_kgcfc11eq", "smog_kgo3eq", "abiotic_depletion_fossil_mj",
  "water_consumption_m3", "primary_energy_nonrenewable_mj", "primary_energy_renewable_mj"
];

function prune(value, path = "$") {
  // Fixed-shape preservation: impacts.<cat>.total stays {value, source}
  if (/^\$\.impacts\.[^.]+\.total$/.test(path)) return value;

  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value !== "object") return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    const pruned = prune(v, `${path}.${k}`);
    if (pruned === undefined) continue;
    out[k] = pruned;
  }

  // Preserve empty `by_stage` objects (explicit "no per-stage data")
  const isByStage = /^\$\.impacts\.[^.]+\.by_stage$/.test(path);
  if (Object.keys(out).length === 0 && !isByStage) return undefined;
  return out;
}

function normalize(record) {
  // Guarantee outer shape so consumers can traverse without optional chaining
  // on the first level. Missing object blocks become `{}` (2 chars vs ~50+ null
  // fields). Impact categories get the minimum {total, by_stage} skeleton.
  for (const k of TOP_LEVEL_OBJECT_KEYS) if (!(k in record)) record[k] = {};
  if (!record.impacts || typeof record.impacts !== "object") record.impacts = {};
  for (const cat of IMPACT_CATEGORIES) {
    if (!(cat in record.impacts)) {
      record.impacts[cat] = { total: { value: null, source: null }, by_stage: {} };
    }
  }
  return record;
}

// ---------------------------------------------------------------------------
// Lookup loader
// ---------------------------------------------------------------------------
function loadLookups() {
  const read = p => JSON.parse(readFileSync(join(SCHEMA_DIR, "lookups", p), "utf8"));
  return {
    cc: read("country-codes.json"),
    csi: read("csi-divisions.json"),
    mt: read("material-type-to-csi.json"),
    el: read("typical-elements.json"),
    kw: read("display-name-keywords.json"),
    ls: read("lifecycle-stages.json")
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { row: null, all: false, out: null, outDir: null, diff: false };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--row") a.row = argv[++i];
    else if (t === "--all") a.all = true;
    else if (t === "--out") a.out = argv[++i];
    else if (t === "--out-dir") a.outDir = argv[++i];
    else if (t === "--diff") a.diff = true;
  }
  return a;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const csvText = readFileSync(CSV_PATH, "utf8");
  const csvSha256 = createHash("sha256").update(csvText).digest("hex");
  const rows = parseCsv(csvText);
  const header = rows[0];
  if (header[0] !== "ID") {
    console.error("Unexpected header; first cell:", JSON.stringify(header[0]));
    process.exit(1);
  }
  const lookups = loadLookups();
  const warnings = [];

  if (args.row) {
    // Find row by BEAM ID (exact match, case-sensitive)
    let idx = -1;
    for (let i = 1; i < rows.length; i++) if (rows[i][0] === args.row) { idx = i; break; }
    if (idx < 0) { console.error(`Row not found: ${args.row}`); process.exit(2); }
    const full = buildRecord({ row: rows[idx], rowIndex: idx + 1, lookups, warnings, csvSha256 });
    if (!full) { console.error("Record build failed"); process.exit(3); }
    const rec = normalize(prune(full));
    const json = JSON.stringify(rec, null, 2);
    if (args.out) {
      writeFileSync(args.out, json + "\n");
      console.error(`Wrote ${args.out}`);
    } else {
      process.stdout.write(json + "\n");
    }
    if (warnings.length) console.error(`\n${warnings.length} warning(s):`, warnings);
    if (args.diff) {
      const sample = JSON.parse(readFileSync(join(SCHEMA_DIR, "sample.json"), "utf8"));
      const diffs = structuralDiff(rec, sample);
      if (diffs.length === 0) console.error("\nSTRUCTURAL MATCH ✓");
      else {
        console.error(`\n${diffs.length} structural diff(s):`);
        for (const d of diffs) console.error(" ", d);
      }
      process.exit(diffs.length ? 1 : 0);
    }
    return;
  }

  if (args.all) {
    const outDir = args.outDir || join(SCHEMA_DIR, "materials");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const byDivision = new Map();
    const indexEntries = [];
    let built = 0, skipped = 0;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].every(f => !f)) { skipped++; continue; } // blank row preserved
      const full = buildRecord({ row: rows[i], rowIndex: i + 1, lookups, warnings, csvSha256 });
      if (!full) { skipped++; continue; }
      const rec = normalize(prune(full));
      built++;
      const div = rec.classification.division_prefix || "zz";
      const slug = lookups.csi.divisions[div]?.category_slug || `${div}_unclassified`;
      if (!byDivision.has(div)) byDivision.set(div, { slug, records: [] });
      byDivision.get(div).records.push(rec);
      indexEntries.push({
        id: rec.id,
        beam_id: rec.external_refs.beam_id,
        display_name: rec.naming.display_name,
        category: rec.classification.category,
        division_prefix: rec.classification.division_prefix,
        typical_elements: rec.classification.typical_elements,
        gwp_kgco2e: rec.impacts.gwp_kgco2e.total.value,
        functional_unit: rec.impacts.functional_unit
      });
    }
    for (const [div, { slug, records }] of [...byDivision.entries()].sort()) {
      const filename = `${div}-${slug.replace(/^\d\d_/, "")}.json`;
      writeFileSync(join(outDir, filename), JSON.stringify({ division: div, count: records.length, records }, null, 2) + "\n");
    }
    writeFileSync(join(outDir, "index.json"), JSON.stringify({ count: indexEntries.length, generated_from_csv_sha256: csvSha256, entries: indexEntries }, null, 2) + "\n");
    console.error(`built=${built} skipped=${skipped} divisions=${byDivision.size} warnings=${warnings.length}`);
    if (warnings.length) {
      const reportPath = join(outDir, "import-report.json");
      writeFileSync(reportPath, JSON.stringify({ warnings }, null, 2) + "\n");
      console.error(`report: ${reportPath}`);
    }
    return;
  }

  console.error("Usage: beam-csv-to-json.mjs --row <BEAM_ID> [--out FILE] [--diff]");
  console.error("       beam-csv-to-json.mjs --all [--out-dir DIR]");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Structural diff — compare keys (shape) only, not values. Reports paths where
// the two objects disagree on {present, missing, type}.
// ---------------------------------------------------------------------------
function structuralDiff(a, b, path = "$") {
  const diffs = [];
  const typeOf = v => v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
  const ta = typeOf(a), tb = typeOf(b);
  if (ta !== tb) { diffs.push(`${path}: type(${ta}) vs type(${tb})`); return diffs; }
  if (ta === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (!(k in a)) diffs.push(`${path}.${k}: missing in importer output`);
      else if (!(k in b)) diffs.push(`${path}.${k}: missing in sample.json (sample fallen behind?)`);
      else diffs.push(...structuralDiff(a[k], b[k], `${path}.${k}`));
    }
  }
  // Don't compare array contents structurally — shape is what matters for regression
  return diffs;
}

main();
