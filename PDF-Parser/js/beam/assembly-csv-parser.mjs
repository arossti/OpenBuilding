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

export function parseAssemblyCsv(csvText) {
  const rows = parseCsvRows(csvText);
  const groups = [];
  const factorByHash = new Map();  // material hash -> kgCO2e per unit

  let currentGroup = null;
  let currentSubgroup = null;

  // First pass: build the hierarchy + collect sample values
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
          subgroups: [],
        };
        groups.push(currentGroup);
        currentSubgroup = null;
      } else if (depth === 3 && currentGroup) {
        currentSubgroup = {
          code,
          name: aText,
          materials: [],
        };
        currentGroup.subgroups.push(currentSubgroup);
      }
      // depth 1 (T01 alone) is the tab itself — skip silently
    } else if (depth === 4 && currentSubgroup) {
      // Material row
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
        footnote,
      });

      // Collect per-unit factor when the sample has a non-zero base.
      // Same material hash appears in multiple groups (e.g. a concrete mix
      // shows under both CONTINUOUS FOOTINGS and COLUMN PADS); the sample
      // project populates qty on some rows and leaves 0.0 on others.
      // First non-zero row wins — all duplicates share the same EPD factor.
      if (sampleQty > 0 && samplePct > 0 && !factorByHash.has(hash)) {
        factorByHash.set(hash, {
          net_per_unit: netKgco2e / (sampleQty * samplePct),
          gross_per_unit: grossKgco2e / (sampleQty * samplePct),
          storage_short_per_unit: storageShort / (sampleQty * samplePct),
          storage_long_per_unit: storageLong / (sampleQty * samplePct),
        });
      }
    }
  }

  // Second pass: attach factors to every material entry (including the
  // zero-sample rows). A `null` factor means we couldn't derive one from
  // any sample row — keep the row in the picker but compute as 0 until
  // Phase 3b introduces Materials-DB cross-reference.
  for (const g of groups) {
    for (const sub of g.subgroups) {
      for (const m of sub.materials) {
        m.factors = factorByHash.get(m.hash) || null;
      }
    }
  }

  return { groups, factorCount: factorByHash.size };
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
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else { inQuotes = false; }
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
 * Compute live emissions for a picker row given user inputs + base factor.
 * Returns { net, gross, storage_short, storage_long } in kgCO2e.
 * All values 0 when select is false, factors are null, or qty/pct <= 0.
 *
 * configRatio scales emissions for group-header configs (THICKNESS, R-VALUE,
 * TOTAL REBAR LENGTH). Derived from user_config_value / default_config_value.
 * Assumes linear scaling — matches BEAM's formulas for the straightforward
 * cases (more thickness = proportionally more concrete = proportionally more
 * emissions). May need refinement for non-linear cases during parity testing.
 * Defaults to 1.0 when the group has no config or the config default is null.
 */
export function computeRowEmissions({ select, qty, pct, factors, configRatio = 1 }) {
  if (!select || !factors || !(qty > 0) || !(pct > 0)) {
    return { net: 0, gross: 0, storage_short: 0, storage_long: 0 };
  }
  const m = qty * pct * configRatio;
  return {
    net: factors.net_per_unit * m,
    gross: factors.gross_per_unit * m,
    storage_short: factors.storage_short_per_unit * m,
    storage_long: factors.storage_long_per_unit * m,
  };
}
