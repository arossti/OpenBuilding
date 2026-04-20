// assembly-csv-parser.mjs
// Parses a BEAM assembly-tab CSV (fetched via schema/scripts/fetch-beam-sheet.py)
// into a nested picker config. One parser covers all 12 assembly tabs —
// column layout and group-code conventions are consistent across them.
//
// Column layout on every assembly tab (verified against F&S xlsx export):
//   A/0   group/subgroup name   (blank on material rows)
//   B/1   material description  (blank on banner rows)
//   C/2   quantity  (material row) OR config label  (banner row with inline config)
//   D/3   unit      (material row) OR config default value (banner row)
//   E/4   percentage as decimal (0.0-1.0 = 0%-100%) OR config unit (banner)
//   F/5   -- (blank)
//   G/6   SELECT flag ("True"/"False")
//   H/7   NET EMISSIONS kgCO2e (sample-project precomputed)
//   I/8   GROSS EMISSIONS kgCO2e
//   J/9   STORAGE Short Cycle kgCO2
//   K/10  STORAGE Long Cycle kgCO2
//   L/11  SELECT Long Cycle flag
//   M/12  FOOTNOTE (e.g. "Expired 2024", "BfCA BioC calc by mass")
//   N/13  group identifier code (T<tab>|C<cat>|S<sub>|<hash>)
//
// Group-code hierarchy by pipe-segment depth:
//   1 (T01)                       tab itself — skip
//   2 (T01|C06)                   top-level group
//   3 (T01|C06|S04)               sub-category
//   4 (T01|C06|S04|43fe24)        individual material row

const CODE_RE = /^T\d+(\|[^|]+)*$/;

// Convert a BEAM code path (e.g. "T01|C01|S04|43fe24" for a material row, or
// "T01|C06" for a group banner) into a CSS-safe identifier suffix used by
// every consumer of the parser as the unique key for state slots, DOM IDs,
// and data attributes. Accepts either a string code or a {code} object so
// callers can pass a material/group/subgroup directly.
//
// Hash-only keys are NOT unique — the same material EPD appears in several
// F&S groups (e.g. a concrete mix shows under CONTINUOUS FOOTINGS, COLUMN
// PADS, and SLABS). All consumers MUST go through this helper so adding a
// new assembly tab can't accidentally re-introduce the cross-talk bug.
export function codeToDomKey(codeOrObj) {
  const code = typeof codeOrObj === "string" ? codeOrObj : codeOrObj && codeOrObj.code;
  if (!code) return "";
  return code.replace(/\|/g, "_");
}

export function parseAssemblyCsv(csvText) {
  const rows = parseCsvRows(csvText);
  const groups = [];

  let currentGroup = null;
  let currentSubgroup = null;

  for (const row of rows) {
    const code = (row[13] || "").trim();
    if (!CODE_RE.test(code)) continue;

    const depth = code.split("|").length;
    const aText = (row[0] || "").trim();

    if (aText) {
      // Banner row
      if (depth === 2) {
        currentGroup = {
          code,
          name: aText,
          config: extractInlineConfig(row),
          subgroups: []
        };
        groups.push(currentGroup);
        currentSubgroup = null;
      } else if (depth === 3 && currentGroup) {
        currentSubgroup = {
          code,
          name: aText,
          materials: []
        };
        currentGroup.subgroups.push(currentSubgroup);
      }
      // depth 1 (T01 alone) is the tab itself — skip silently
    } else if (depth === 4 && currentSubgroup) {
      // Material row. The CSV's pre-computed NET/GROSS columns are kept
      // as `sample_*` for the Load Sample fixture (UI selects + qty defaults)
      // but are NOT consumed for factor derivation — per-unit factors are
      // looked up at calc time from materials-db.mjs (single source of
      // truth: schema/materials/index.json).
      const hash = code.split("|").pop();
      const name = (row[1] || "").trim();
      const sampleQty = parseNum(row[2]);
      const unit = (row[3] || "").trim();
      const samplePct = parseNum(row[4], 1);
      const sampleSelect = (row[6] || "").trim().toLowerCase() === "true";
      const netKgco2e = parseNum(row[7]);
      const grossKgco2e = parseNum(row[8]);
      const storageShort = parseNum(row[9]);
      const storageLong = parseNum(row[10]);
      const footnote = (row[12] || "").trim();

      currentSubgroup.materials.push({
        code,
        hash,
        name,
        unit,
        sample_qty: sampleQty,
        sample_pct: samplePct,
        sample_select: sampleSelect,
        sample_net: netKgco2e,
        sample_gross: grossKgco2e,
        sample_storage_short: storageShort,
        sample_storage_long: storageLong,
        footnote
      });
    }
  }

  return { groups };
}

function extractInlineConfig(row) {
  // Banner with inline config fills cols C/D/E: label, default, optional unit.
  // Default may be blank (e.g., REBAR groups where the sample project only
  // filled length for CONTINUOUS FOOTINGS; others expect user input).
  const label = (row[2] || "").trim();
  const rawDefault = (row[3] || "").trim();
  const unit = (row[4] || "").trim();
  if (!label) return null;
  const defaultNum = rawDefault === "" ? null : parseNum(rawDefault, null);
  return { label, default: defaultNum, unit };
}

function parseNum(v, fallback = 0) {
  if (v === undefined || v === null) return fallback;
  const s = String(v).replace(/,/g, "").trim();
  if (s === "") return fallback;
  const n = parseFloat(s);
  return isNaN(n) ? fallback : n;
}

// RFC-4180-ish CSV parser. Handles quoted fields, escaped quotes (""),
// embedded newlines inside quoted cells. Not a full validator; fits BEAM's
// export shape without pulling in a dependency.
function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\r") {
        // skip; let \n handle line end
      } else if (ch === "\n") {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Compute live emissions for a picker row. Caller resolves the per-unit GWP
 * factor from materials-db.mjs and converts the row qty into the material's
 * functional_unit (via convertQtyToMaterialUnit). This function is just the
 * final multiply.
 *
 *   net = qtyInMaterialUnit × pct × gwp_per_unit
 *
 * Returns 0 across the board when select is false, gwp is missing, or
 * qty/pct ≤ 0. GROSS, STORAGE Short, STORAGE Long are placeholders matching
 * NET for non-biogenic materials — biogenic carbon handling lands when
 * the materials-db starts surfacing per-stage EN 15804+A2 data.
 */
export function computeRowEmissions({ select, qtyInMaterialUnit, pct, gwp }) {
  if (!select || !gwp || !(qtyInMaterialUnit > 0) || !(pct > 0)) {
    return { net: 0, gross: 0, storage_short: 0, storage_long: 0 };
  }
  const m = qtyInMaterialUnit * pct;
  const net = m * gwp;
  return { net, gross: net, storage_short: 0, storage_long: 0 };
}
