// workbook-mapper.mjs
// Maps a BEAM workbook export (.xlsx or .csv, from user's own copy of the
// BEAM Google Sheet) into BEAMweb's flat state object.
//
// Port reference: OBJECTIVE ExcelMapper.js. OBJECTIVE uses a single 100-cell
// mapping against one `REPORT` sheet. BEAMweb is the inverse: ~20 tabs,
// each tab contributing a different slice (project metadata, assembly
// material selections, site conditions). So this mapper dispatches per-tab.
//
// Runtime note: this is NOT how we pull the CANONICAL sheet structure.
// That happens at build time via schema/scripts/fetch-beam-sheet.mjs and
// ships as committed CSVs under docs/csv files from BEAM/. This mapper's
// job is only to ingest USER workbook exports when someone wants to
// migrate an in-progress BEAM workbook project into BEAMweb.
//
// Phase 1 stub: per-tab mapping tables are placeholder empty objects.
// Fills out as each assembly tab gets wired to its BEAMweb calc module
// in Phase 3+ (see BEAMweb.md §6 for phase order).

const SHEET_NAMES = Object.freeze({
  PROJECT: "PROJECT",
  FOOTINGS_SLABS: "Footings & Slabs",
  FOUNDATION_WALLS: "Foundation Walls",
  STRUCTURAL: "Structural Elements",
  EXT_WALLS: "Ext. Walls",
  PARTY_WALLS: "Party Walls",
  CLADDING: "Cladding",
  WINDOWS: "Windows",
  INT_WALLS: "Int. Walls",
  FLOORS: "Floors",
  CEILINGS: "Ceilings",
  ROOF: "Roof",
  GARAGE: "Garage",
  REVIEW: "REVIEW",
  RESULTS: "RESULTS",
});

// Per-tab cell → fieldId mapping. Keys match BEAM tab names above.
// Each value is { cellRef: fieldId } exactly like OBJECTIVE's excelReportInputMapping.
// Stub: populate as each tab's calc module lands.
const TAB_MAPPINGS = Object.freeze({
  [SHEET_NAMES.PROJECT]: {
    // "D3": "project_name",
    // "D5": "construction_year",
    // "D7": "stories_above_grade",
    // ... populate from PROJECT.csv field inventory
  },
  [SHEET_NAMES.FOOTINGS_SLABS]: {
    // Assembly tabs share a structural pattern:
    //   picker rows (material + thickness + area → quantity + kgCO2e subtotal)
    // Mapping will likely be row-ranges per material group, not fixed cells.
    // Approach TBD once first tab ports — see BEAMweb.md §4 for calc model.
  },
  [SHEET_NAMES.FOUNDATION_WALLS]: {},
  [SHEET_NAMES.STRUCTURAL]: {},
  [SHEET_NAMES.EXT_WALLS]: {},
  [SHEET_NAMES.PARTY_WALLS]: {},
  [SHEET_NAMES.CLADDING]: {},
  [SHEET_NAMES.WINDOWS]: {},
  [SHEET_NAMES.INT_WALLS]: {},
  [SHEET_NAMES.FLOORS]: {},
  [SHEET_NAMES.CEILINGS]: {},
  [SHEET_NAMES.ROOF]: {},
  [SHEET_NAMES.GARAGE]: {},
});

function extractCellValue(cell) {
  if (!cell) return null;
  // BEAM's "#NAME?" string sentinels (cross-sheet unit-conversion failures
  // at CSV export time) collapse to null — see BEAMweb.md §4.4.
  if (cell.v === "#NAME?") return null;
  if (cell.t === "n") {
    const hasPercent = (cell.z && cell.z.includes("%")) || (cell.w && cell.w.includes("%"));
    return hasPercent ? cell.v * 100 : cell.v;
  }
  return cell.v;
}

function mapTab(worksheet, mapping) {
  const out = {};
  for (const [cellRef, fieldId] of Object.entries(mapping)) {
    const cell = worksheet[cellRef];
    if (cell === undefined) continue;
    const value = extractCellValue(cell);
    if (value !== null) out[fieldId] = value;
  }
  return out;
}

function mapWorkbookToState(workbook) {
  if (!workbook?.Sheets) return {};
  const state = {};
  let mappedTabs = 0;
  let missingTabs = 0;

  for (const [tabName, mapping] of Object.entries(TAB_MAPPINGS)) {
    if (Object.keys(mapping).length === 0) continue;
    const sheet = workbook.Sheets[tabName];
    if (!sheet) {
      console.warn(`[WorkbookMapper] tab "${tabName}" not found in workbook`);
      missingTabs++;
      continue;
    }
    Object.assign(state, mapTab(sheet, mapping));
    mappedTabs++;
  }

  console.log(`[WorkbookMapper] mapped ${mappedTabs} tabs (${missingTabs} missing), ${Object.keys(state).length} fields`);
  return state;
}

function getSheetNames() {
  return { ...SHEET_NAMES };
}

export const WorkbookMapper = {
  SHEET_NAMES,
  mapWorkbookToState,
  getSheetNames,
};

if (typeof window !== "undefined") {
  window.BEAM = window.BEAM || {};
  window.BEAM.WorkbookMapper = WorkbookMapper;
}
