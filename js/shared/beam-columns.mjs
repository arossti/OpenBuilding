/**
 * beam-columns.mjs — canonical ART Database - Materials.csv column map (A → BL).
 *
 * Single source of truth for the BEAM column ORDER and the material-record
 * field each column corresponds to. Used by the EPD-Parser "Export" row dump
 * (js/epdparser.mjs) to serialise a scraped candidate record as one delimited
 * row whose column order matches the BEAM spreadsheet EXACTLY, so the team can
 * paste it into the sheet (Google Sheets / Excel) to append a new EPD. See
 * docs/workplans/EPD-Parser.md §17.
 *
 * The importer (schema/scripts/beam-csv-to-json.mjs) is the historical origin
 * of this CSV-column ↔ JSON-path mapping; this module mirrors it for the
 * reverse direction. Keep the two in sync — if a BEAM column or its target
 * path changes in the importer, change it here too. (Migrating the importer +
 * parity harness to consume THIS module is a documented follow-up.)
 *
 * EVERY BEAM column A→BL appears here in order — including columns the importer
 * ignores (the AA/AD common-unit repeats and the excluded classification
 * column AX). They emit as empty cells so a pasted row stays aligned under the
 * BEAM headers; dropping them would shift every later column left by one.
 */

// "EPD Type" — inverse of the importer's statedSource → epd.type enum mapping.
function _epdTypeLabel(rec) {
  var t = rec && rec.epd && rec.epd.type;
  if (t === "product_specific") return "Product-specific";
  if (t === "industry_average") return "Industry Average";
  if (t === "generic") return "Generic";
  if (t === "beam_average") return "BEAM Average";
  return null;
}

// "Internal/External Validation" — inverse of epd.validation.type.
function _validationLabel(rec) {
  var v = rec && rec.epd && rec.epd.validation && rec.epd.validation.type;
  if (v === "external") return "External";
  if (v === "internal") return "Internal";
  return null;
}

// Ordered column descriptors. `path` = dot path into the record; `kind: "bool"`
// formats true/false as TRUE/FALSE; `get` overrides `path` for derived values;
// `path: null` = structural placeholder (emit empty to hold the column slot).
export var BEAM_COLUMNS = [
  { col: "A",  label: "ID",                           path: "external_refs.beam_id" },
  { col: "B",  label: "Display Name",                 path: "naming.display_name" },
  { col: "C",  label: "Listed",                       path: "status.listed", kind: "bool" },
  { col: "D",  label: "Do Not List",                  path: "status.do_not_list", kind: "bool" },
  { col: "E",  label: "Industry Avg",                 path: "status.is_industry_average", kind: "bool" },
  { col: "F",  label: "BEAM Avg",                     path: "status.is_beam_average", kind: "bool" },
  { col: "G",  label: "EPD Expiry",                   path: "epd.expiry_date" },
  { col: "H",  label: "Footnote",                     path: "source_notes" },
  { col: "I",  label: "Material",                     path: "naming.material_name" },
  { col: "J",  label: "Manufacturer",                 path: "manufacturer.name" },
  { col: "K",  label: "Product Brand Name",           path: "naming.product_brand_name" },
  { col: "L",  label: "Specifications",               path: "manufacturer.specifications" },
  { col: "M",  label: "Notes",                        path: "notes" },
  { col: "N",  label: "Countries of Manufacture",     path: "provenance.countries_of_manufacture" },
  { col: "O",  label: "Markets of Applicability",     path: "provenance.markets_of_applicability" },
  { col: "P",  label: "Data added or modified",       path: "provenance.data_added_or_modified" },
  { col: "Q",  label: "Stated EPD kgCO2e / unit",     path: "carbon.stated.value_kgco2e" },
  { col: "R",  label: "GWP units kgCO2e per",         path: "carbon.stated.per_unit" },
  { col: "S",  label: "GWP kgCO2e/(common unit)",     path: "carbon.common.value_kgco2e" },
  { col: "T",  label: "Common Unit: kgCO2e / _",      path: "carbon.common.per_functional_unit" },
  { col: "U",  label: "Metric Units",                 path: "carbon.common.metric_unit_label" },
  { col: "V",  label: "Imperial Units",               path: "carbon.common.imperial_unit_label" },
  { col: "W",  label: "GWP-bio from EPD",             path: "carbon.biogenic.gwp_bio_from_epd_kgco2e_per_common_unit" },
  { col: "X",  label: "Biogenic carbon factor",       path: "carbon.biogenic.biogenic_factor" },
  { col: "Y",  label: "% Carbon content (kgC/kg)",    path: "carbon.biogenic.carbon_content_pct_kgc_kg" },
  { col: "Z",  label: "Biogenic Storage",             path: "carbon.biogenic.stored_kgco2e_per_common_unit" },
  { col: "AA", label: "(common-unit repeat)",         path: null },
  { col: "AB", label: "WWF Storage Factor",           path: "carbon.biogenic.wwf_storage_factor_kgco2e_per_kgc" },
  { col: "AC", label: "Carbon content kgC/unit",      path: "carbon.biogenic.carbon_content_kgc_per_unit" },
  { col: "AD", label: "(units kgC repeat)",           path: null },
  { col: "AE", label: "Biogenic CO2 full C value",    path: "carbon.biogenic.full_carbon_kgco2e_per_common_unit" },
  { col: "AF", label: "Storage % Reduction",          path: "carbon.biogenic.storage_retention_pct" },
  { col: "AG", label: "Density",                      path: "physical.density.value" },
  { col: "AH", label: "Density Units",                path: "physical.density.units" },
  { col: "AI", label: "Addn'l factors",               path: "physical.additional_factor.value" },
  { col: "AJ", label: "Addn'l factor units",          path: "physical.additional_factor.units" },
  { col: "AK", label: "R-value / inch",               path: "physical.thermal.r_value_per_inch_imperial" },
  { col: "AL", label: "k, Thermal Conductivity",      path: "physical.thermal.conductivity_w_mk" },
  { col: "AM", label: "Moisture content %",           path: "physical.moisture_content_pct" },
  { col: "AN", label: "Mass (kg)",                    path: "physical.mass_per_unit_kg" },
  { col: "AO", label: "Length (m)",                   path: "physical.dimensions.length_m" },
  { col: "AP", label: "Width (m)",                    path: "physical.dimensions.width_m" },
  { col: "AQ", label: "Depth (m)",                    path: "physical.dimensions.depth_m" },
  { col: "AR", label: "Unit Volume (m3)",             path: "physical.dimensions.unit_volume_m3" },
  { col: "AS", label: "Units/m2",                     path: "physical.dimensions.units_per_m2" },
  { col: "AT", label: "Material Type",                path: "classification.material_type" },
  { col: "AU", label: "Material Subtype",             path: "classification.material_subtype" },
  { col: "AV", label: "Product Type",                 path: "classification.product_type" },
  { col: "AW", label: "Product Subtype",              path: "classification.product_subtype" },
  { col: "AX", label: "(classification code — excluded §9)", path: null },
  { col: "AY", label: "EPD ID",                       path: "epd.id" },
  { col: "AZ", label: "EPD Type",                     get: _epdTypeLabel },
  { col: "BA", label: "EPD Owner",                    path: "epd.owner" },
  { col: "BB", label: "EPD/LCA Prepared by",          path: "epd.prepared_by" },
  { col: "BC", label: "EPD Program / Operator",       path: "epd.program_operator" },
  { col: "BD", label: "Internal/External Validation", get: _validationLabel },
  { col: "BE", label: "EPD Verifying Agent",          path: "epd.validation.agent" },
  { col: "BF", label: "EPD Standards",                path: "methodology.standards" },
  { col: "BG", label: "EPD PCR Guidelines",           path: "methodology.pcr_guidelines" },
  { col: "BH", label: "LCA Method",                   path: "methodology.lca_method" },
  { col: "BI", label: "EPD LCA Software",             path: "methodology.lca_software" },
  { col: "BJ", label: "EPD LCI Database",             path: "methodology.lci_database" },
  { col: "BK", label: "Product Service Life (Years)", path: "epd.product_service_life_years" },
  { col: "BL", label: "Source document URL",          path: "epd.source_document_url" }
];

export function getPath(obj, path) {
  if (!path) return undefined;
  var parts = path.split(".");
  var ref = obj;
  for (var i = 0; i < parts.length; i++) {
    if (ref == null) return undefined;
    ref = ref[parts[i]];
  }
  return ref;
}

function _scalar(v) {
  if (v === null || v === undefined) return "";
  if (v === true) return "TRUE";
  if (v === false) return "FALSE";
  return String(v);
}

// One column's value as a cell string. Arrays → comma-joined; bool → TRUE/FALSE;
// null/undefined/missing → "".
export function cellValue(record, c) {
  var v = c.get ? c.get(record) : getPath(record, c.path);
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(_scalar).join(", ");
  if (c.kind === "bool") return v === true ? "TRUE" : v === false ? "FALSE" : "";
  return _scalar(v);
}

// TSV has no quoting standard, so collapse any embedded tab/newline to a space —
// otherwise one stray line-break in a name/notes field would split the row.
function _sanitize(s) {
  return String(s).replace(/[\t\r\n]+/g, " ");
}

// Build a single TAB-separated row from a record, in exact DUMP column order
// (A→BL). One line, no trailing tab. Pastes across columns in Sheets/Excel.
export function recordToRow(record) {
  var cells = [];
  for (var i = 0; i < BEAM_COLUMNS.length; i++) {
    cells.push(_sanitize(cellValue(record, BEAM_COLUMNS[i])));
  }
  return cells.join("\t");
}
