#!/usr/bin/env node
/**
 * Build db-fallbacks.json from the XML source.
 *
 * The XML carries a flat list of ~200 materials × 5 properties (density,
 * thermal conductivity, heat capacity, embodied energy, embodied carbon).
 * This script:
 *   1. parses the XML into a row list
 *   2. maps each row to a canonical material_type label (matching the
 *      labels in schema/lookups/material-type-to-group.json) via the
 *      MATERIAL_TYPE_MAPPING table below
 *   3. groups rows by canonical label, picks a mid-range default per
 *      label, keeps all rows as variants
 *   4. emits schema/lookups/db-fallbacks.json
 *
 * Re-run after editing db-fallbacks.source.xml or the mapping table:
 *   node schema/scripts/build-db-fallbacks.mjs
 *
 * IP note: the XML is a thermal/embodied-property reference set. The
 * rebranded "db-fallbacks" naming intentionally avoids any third-party
 * tool brand. The data values are physical constants, not a copyrighted
 * compilation in the legal sense.
 */

import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const SOURCE_XML = resolve(REPO_ROOT, "schema", "lookups", "db-fallbacks.source.xml");
const OUTPUT_JSON = resolve(REPO_ROOT, "schema", "lookups", "db-fallbacks.json");

// Maps an XML <Material Name="..."> row to a canonical material_type
// label. Labels mirror schema/lookups/material-type-to-group.json keys.
// First match wins. Patterns are case-sensitive substring tests against
// the uppercase XML name as published in the source file.
//
// XML rows that don't match any pattern are listed in the JSON output's
// `_unmapped` array — useful for review when extending the mapping.
//
// The schema's material_type taxonomy is broader than the XML can
// directly populate; canonical labels with no XML coverage (e.g.
// Hardwood, Cellulose, Cross-Laminated Timber, Glulam, LVL) get an
// empty default + variants list and are no-ops at fallback time.
//
// XML groups deliberately skipped (not building products in BfCA's
// scope or not material_types):
//   - AIR GAPS (thermal modeling slot, not a material)
//   - ENVIRONMENT (soil/water/sand for ground-source modeling)
//   - GLASS (glazing assemblies; covered separately by group 08)
const MATERIAL_TYPE_MAPPING = [
  // Wood + wood-based panels
  { match: /^TIMBER\b/, type: "Framing" },
  { match: /^PLYWOOD\b/, type: "Plywood" },
  { match: /^OSB\b/, type: "Sheathing" }, // OSB is a sheathing-grade material in BEAM's taxonomy
  { match: /^MDF BOARD\b/, type: "Wood fiberboard" },
  { match: /^FIBREBOARD\b/, type: "Wood fiberboard" },
  { match: /^MASONITE\b/, type: "Wood fiberboard" },
  { match: /^PARTICLEBOARD\b/, type: "Sheathing" },
  { match: /^CHIPBOARD\b/, type: "Sheathing" },
  { match: /^CEMENT BONDED PARTICLEBOARD\b/, type: "Sheathing" },
  { match: /^IMPREGNATED BOARD\b/, type: "Sheathing" },
  { match: /^ASPHABOARD\b/, type: "Sheathing" },
  { match: /^WOODFIBER\b/, type: "Wood fibre" },
  { match: /^WOOD WOOL \d/, type: "Wood wool board" },
  { match: /^WOOD WOOL\//, type: "Wood wool board" }, // multilayer composites with wood-wool faces
  { match: /^CORKBOARD\b/, type: "Cork" },
  { match: /^CORK\b(?! UNDERLAY| FLOOR)/, type: "Cork" },

  // Concrete + masonry
  { match: /^CONCRETE\b|^REINFORCED CONCRETE/, type: "Concrete" },
  { match: /^AERATED CONCRETE|^AIR-ENT CONCRETE|^GASCONCRETE/, type: "Concrete" },
  { match: /^CORK-CONCRETE/, type: "Concrete" },
  { match: /^CONCRETE BLOCK\b/, type: "Concrete" },
  { match: /^EXPANDED CLAY[- ]?CONCRETE/, type: "Concrete" },
  { match: /^CONCRETE ROOF TILES/, type: "Concrete" },
  { match: /^EXPANDED CLAY/, type: "Leca" },
  { match: /^SOLID BRICK\b/, type: "Brick" },
  { match: /^BURNT CLAY BLOCK/, type: "Clay Brick" },
  { match: /^CLAY ROOF TILES/, type: "Clay Brick" },
  { match: /^CLAY FLOOR TILE/, type: "Clay Brick" },
  { match: /^CERAMIC ROOF TILES/, type: "Ceramic" },

  // Metals
  { match: /^ALUMINUM\b/, type: "Aluminum" },
  { match: /^STEEL\b|^STAINLESS STEEL\b|^CAST IRON\b/, type: "Steel" },

  // Thermal insulation — keep grain
  { match: /^EPS\b|^EXP\.?PLASTICS\b/, type: "EPS Foam" },
  { match: /^XPS\b/, type: "XPS Foam" },
  { match: /^POLYFOAM\b/, type: "Spray polyurethane foam" },
  { match: /^POLYURETANE FOAM\b/, type: "Spray polyurethane foam" },
  { match: /GLASS WOOL\b/, type: "Fiberglass" },
  { match: /MINERAL WOOL\b|^ECOFIBER\b|^ISODRAIN\b|^LOSULL\b/, type: "Mineral wool" },

  // Gypsum + plasters
  { match: /^GYPSUM PLASTERBOARD\b|^GYPSUMBOARD\b/, type: "Gypsum" },
  { match: /^GYPSUM \d|^GYPSUM PLASTER\b|^GYPSUM W\/|^GYPSUM INSULATING/, type: "Gypsum" },
  { match: /^CEMENT W\/ SAND\b/, type: "Cement stucco" },
  { match: /^LIME\b/, type: "Lime" },

  // Solid plastics + finishes
  { match: /^ACRYLIC\b/, type: "Acrylic" },
  { match: /^POLYAMIDE\b(?! W\/ 25%)/, type: "Nylon" },
  { match: /^HIGH DENSITY POLYETHYLENE\b/, type: "HDPE" },
  { match: /^POLYPROPYLENE\b(?! W\/ 25%)/, type: "Polypropylene" },
  { match: /^PVC\b/, type: "Vinyl" },
  { match: /^FLEXIBLE PVC\b/, type: "Vinyl" },
  { match: /^LINOLEUM\b/, type: "Linoleum" },
  { match: /^CARPET\b|^TEXTILE FLOOR\b/, type: "Carpet" },
  { match: /^PLASTIC FLOOR\b/, type: "Luxury vinyl tile" },

  // Stones
  {
    match: /^GRANITE\b|^MARBLE\b|^BASALT\b|^GNEISS\b|^SLATE\b|^SANDSTONE\b|^LIMESTONE\b|^LIMESANDSTONE\b/,
    type: "Stone"
  },
  {
    match: /^ARTIFICIAL STONE\b|^CRYSTALLINE ROCK\b|^POROUS ROCK\b|^SEDIMENTARY ROCK\b|^NATURAL PUMICE\b/,
    type: "Stone"
  },

  // Asphalt + bitumen membrane
  { match: /^ASPHALT\b/, type: "Asphalt Shingle" },
  { match: /^BITUMINOUS\b|^BITUMEN PURE\b/, type: "TPO" } // TPO is the closest schema slot for membrane roofing
];

const SKIP_GROUPS = new Set(["AIR GAPS", "ENVIRONMENT", "GLASS", "RUBBERS", "SEALANTS"]);

// Hand-picked default variant per material_type for cases where the
// median-by-density heuristic lands on the wrong sub-band (e.g. Concrete
// mixes aerated 400-700 kg/m³ rows with structural 1800-2400 kg/m³ rows;
// median pick falls in lightweight when an EPD asking for a default
// almost always wants structural). The XML row Name must exactly match
// one of the variants under the canonical material_type. If the named
// row isn't found, pickDefaultIndex's median heuristic kicks in.
const DEFAULT_OVERRIDES = {
  Concrete: "CONCRETE 3", // 2200 kg/m³ — typical structural ready-mix
  Steel: "STEEL 1", // 7800 kg/m³ — plain carbon (vs stainless)
  Sheathing: "OSB", // 650 kg/m³ — by far the most common sheathing material
  "Wood fiberboard": "FIBREBOARD 3", // 600 kg/m³ — typical interior MDF density
  Gypsum: "GYPSUM PLASTERBOARD", // 900 kg/m³ — ½" board
  Fiberglass: "ELEVATION GLASS WOOL 2" // 23 kg/m³ — typical wall batt
};

// Heuristic: which row from a group is the "default" — a mid-range
// representative. For most groups we pick the row with median density;
// for single-row groups we pick the only row. Falls back to the first
// row if median computation can't tie-break.
function pickDefaultIndex(rows) {
  if (rows.length === 0) return -1;
  if (rows.length === 1) return 0;
  const sorted = rows
    .map((r, i) => ({ idx: i, density: Number(r.Density) || 0 }))
    .sort((a, b) => a.density - b.density);
  // Median index — for an even-count list, take the lower-middle so we
  // don't tilt heavy. For odd-count, the actual median.
  const medianIdx = Math.floor((sorted.length - 1) / 2);
  return sorted[medianIdx].idx;
}

function parseXml(xml) {
  // Tiny purpose-built parser — the source file has a flat
  // <MaterialGroup Name="..."><Material Name="..." attrs/>...
  // structure with no namespaces, no escaping, no nested elements
  // beyond what we need. Avoids pulling a full XML dep for a one-shot
  // build script.
  const groups = [];
  const groupRx = /<MaterialGroup\s+Name="([^"]+)">([\s\S]*?)<\/MaterialGroup>/g;
  const matRx = /<Material\s+([^/]+)\/>/g;
  const attrRx = /(\w+)="([^"]*)"/g;
  let g;
  while ((g = groupRx.exec(xml)) !== null) {
    const groupName = g[1];
    const body = g[2];
    const materials = [];
    let m;
    while ((m = matRx.exec(body)) !== null) {
      const attrs = {};
      let a;
      while ((a = attrRx.exec(m[1])) !== null) attrs[a[1]] = a[2];
      materials.push(attrs);
    }
    groups.push({ name: groupName, materials });
  }
  return groups;
}

function classifyMaterial(name) {
  const upper = name.toUpperCase();
  for (const rule of MATERIAL_TYPE_MAPPING) {
    if (rule.match.test(upper)) return rule.type;
  }
  return null;
}

function rowToVariant(row) {
  return {
    name: row.Name,
    density_kg_m3: Number(row.Density),
    thermal_conductivity_w_mk: Number(row.ThermalConduct),
    heat_capacity_j_kgk: Number(row.HeatCapacity),
    embodied_energy_mj_kg: Number(row.EmbodiedEnergy),
    embodied_carbon_kgco2e_kg: Number(row.EmbodiedCarbon)
  };
}

function rowToDefault(row) {
  // Default block omits the variant `name` so consumers see "this is a
  // generic-default value" rather than "this is the named variant X".
  // The user can always switch to a specific variant via the form.
  const v = rowToVariant(row);
  delete v.name;
  return v;
}

async function main() {
  const xml = await readFile(SOURCE_XML, "utf8");
  const groups = parseXml(xml);

  const defaultsByMaterialType = {};
  const unmapped = [];

  for (const group of groups) {
    if (SKIP_GROUPS.has(group.name)) continue;
    for (const row of group.materials) {
      const materialType = classifyMaterial(row.Name);
      if (!materialType) {
        unmapped.push({ group: group.name, name: row.Name });
        continue;
      }
      if (!defaultsByMaterialType[materialType]) {
        defaultsByMaterialType[materialType] = { default: null, variants: [] };
      }
      defaultsByMaterialType[materialType].variants.push(rowToVariant(row));
    }
  }

  // Pick a default per material_type — overrides table first, median by
  // density as the fallback when no override is named or the override
  // row isn't present in the XML.
  for (const materialType of Object.keys(defaultsByMaterialType)) {
    const entry = defaultsByMaterialType[materialType];
    let defaultIdx = -1;
    const overrideName = DEFAULT_OVERRIDES[materialType];
    if (overrideName) {
      defaultIdx = entry.variants.findIndex((v) => v.name === overrideName);
    }
    if (defaultIdx < 0) defaultIdx = pickDefaultIndex(entry.variants);
    if (defaultIdx >= 0) {
      const sourceRow = entry.variants[defaultIdx];
      entry.default = {
        density_kg_m3: sourceRow.density_kg_m3,
        thermal_conductivity_w_mk: sourceRow.thermal_conductivity_w_mk,
        heat_capacity_j_kgk: sourceRow.heat_capacity_j_kgk,
        embodied_energy_mj_kg: sourceRow.embodied_energy_mj_kg,
        embodied_carbon_kgco2e_kg: sourceRow.embodied_carbon_kgco2e_kg,
        _source_variant: sourceRow.name,
        _selection:
          overrideName && entry.variants.find((v) => v.name === overrideName)
            ? "hand-picked override"
            : "median by density"
      };
    }
  }

  const sourceSha = createHash("sha256").update(xml).digest("hex");

  const output = {
    _note:
      "BfCA db-fallbacks: reference-grade material defaults for fields that aren't typically published in EPDs (density, thermal conductivity, heat capacity, embodied energy, embodied carbon). Used as fallback only when the EPD itself is silent. Every value applied at runtime carries source: 'generic_default' so users see what came from the EPD vs the catalogue. Generated from db-fallbacks.source.xml — re-run schema/scripts/build-db-fallbacks.mjs after editing.",
    _schema_version: 1,
    _source_xml_sha256: sourceSha,
    _generated_at: new Date().toISOString(),
    _attribution:
      "Compiled from a thermal + embodied-properties reference catalogue (XML import). Values are physical material constants; data is reference-grade not product-specific. Per-product accuracy requires an EPD.",
    defaults_by_material_type: defaultsByMaterialType,
    _unmapped: unmapped
  };

  await writeFile(OUTPUT_JSON, JSON.stringify(output, null, 2) + "\n");

  // Summary log
  const mappedCount = Object.keys(defaultsByMaterialType).length;
  const variantCount = Object.values(defaultsByMaterialType).reduce((sum, e) => sum + e.variants.length, 0);
  console.log(`✓ wrote ${OUTPUT_JSON}`);
  console.log(`  ${mappedCount} canonical material_types, ${variantCount} variants total`);
  console.log(`  ${unmapped.length} XML rows unmapped (see _unmapped[] in output)`);
  if (unmapped.length > 0 && process.argv.includes("--verbose")) {
    console.log("  Unmapped rows:");
    for (const u of unmapped) console.log(`    ${u.group} :: ${u.name}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
