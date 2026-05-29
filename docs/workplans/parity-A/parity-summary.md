# Parity A — BEAM CSV ↔ JSON catalogue

_Generated 2026-05-28T19:53:50.924Z by `schema/scripts/csv-json-parity.mjs`._

Compares the upstream source CSV (`docs/csv files from BEAM/BEAM Database-DUMP.csv`) against the derived runtime catalogue (`schema/materials/*.json`), field-by-field, for every BEAM ID present in both.

## Coverage

| | count |
|---|---:|
| CSV data rows (non-blank ID) | 821 |
| CSV distinct IDs | 820 |
| JSON records | 821 |
| JSON distinct beam_ids | 820 |
| **Aligned & compared (excl. dups)** | **819** |
| CSV-only (not in catalogue) | 0 |
| JSON-only (not in CSV) | 0 |
| Duplicate-id collisions (excluded) | 1 |

## Parity

**Source fidelity** — verbatim/formula/enum columns; this is the import-bug detector:

- Rows clean: **819/819** (100.0%)
- Cell parity: **13104/13104** (100.0%)

**Derived fields** — computed, not copied from the CSV; divergence is expected/informational (it is a QA signal of "catalogue's computed value vs the spreadsheet's own stated column", not an import bug):

- Cell parity: **2300/2457** (93.6%)

**Overall** (all columns): 15404/15561 (99.0%); 130 of 819 rows have ≥1 mismatch.

## Duplicate beam_id collisions

These IDs map to >1 material — they break the "beam_id is unique" assumption and are **excluded** from the diff above (the CSV↔JSON pairing is ambiguous). Re-mint one side.

| beam_id | CSV display names | JSON records |
|---|---|---|
| `4ld02f` | Mineral wool batt / [BEAM Avg] ⟂ Wood / SPF / 3/8" boards / AWC & CWC [Industry Avg / US & CA] | 06-wood.json:Wood / SPF / 3/8" boards / AWC & CWC [Industry Avg / US & CA] ⟂ 07-thermal.json:Mineral wool batt / [BEAM Avg] |

## Mismatches by field

| field | basis | mismatches |
|---|---|---:|
| Carbon content kgC/unit | derived | 96 |
| Full C value | derived | 61 |

> `basis`: **verbatim** = stored as-is (a mismatch = import bug); **formula** = CSV cell is a formula (eval + 2dp round); **derived** = JSON value is computed, not copied (mismatch = derivation differs from the CSV's own column, not necessarily a bug); **enum** = JSON stores a mapped enum of the CSV string.

## EPD grouping

354 distinct canonical `epd.id` among aligned rows; 115 cover >1 product. Top fan-outs:

| canonical epd.id | products |
|---|---:|
| 47895560991021 | 43 |
| epd352 | 24 |
| epd10294 | 20 |
| 47884246341021 | 18 |
| epd10092 | 18 |
| epd347 | 18 |
| epd349 | 18 |
| epd350 | 18 |
| epd351 | 18 |
| epd348 | 15 |
| 47897529011011 | 12 |
| epd346 | 12 |

## Sheets

- `parity-sheet1-csv.csv` — source-CSV values
- `parity-sheet2-json.csv` — catalogue values (same order)
- `parity-sheet3-diff.csv` — per-cell MATCH/MISMATCH grid (apply conditional formatting: exact text `MATCH` → green, `MISMATCH` → red) + `mismatch_detail`
