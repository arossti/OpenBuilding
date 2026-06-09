# Parity B — BEAM CSV ↔ EPD-parser extraction (Pass 1)

_Generated 2026-06-08T23:49:11.372Z by `schema/scripts/csv-pdf-parity.mjs`._

For every BEAM CSV row whose `epd.id` matches a PDF in the folder, this harness parses the PDF and compares the parser's extracted values against the populated BEAM cells per field. Tolerances: numbers ±0.5% + 0.01 absolute floor; strings trim + case-insensitive; units trim + exact. **Scoring scope** (Andy 2026-06-08, §19): only the EPD-extractable columns are in the parity %. Counted: `G, I, J, K, L, N, O, Q, R, W, AG, AH, AI, AJ, AK, AL, AM, AN, AO, AP, AQ, AR, AS, AT, AY, AZ, BA, BB, BC, BD, BE, BF, BG, BH, BI, BJ, BK`. Out-of-scope (BfCA-internal flags, BfCA-derived units/values, BfCA-computational biogenic block, BfCA taxonomy, internal notation, structural placeholders): everything else.

## Coverage

| | count |
|---|---:|
| CSV total rows | 825 |
| CSV rows with `epd.id` | 781 |
| CSV distinct canonical `epd.id` | 349 |
| PDFs in folder | 302 |
| PDFs distinct canonical `epd.id` | 301 |
| **EPDs matched in both** | **294** |
| **BEAM rows scored** | **671** |
| BEAM rows excluded (no PDF) | 154 |
| PDF-only (no BEAM row) | 7 |
| Parse errors | 0 |

## Parity

- Rows at **100% parity**: **0/671** (0.0%)
- Aggregate cell parity (EPD-comparable columns, populated BEAM cells): **4973/14100** (35.3%)
- Average per-row coverage: **35.8%**

## Per-field match rate (descending)

Sorted by match rate — top fields are reliable extractions; bottom fields are the extractor gaps to chase (and good candidates for Goal-B form expansion).

| col | field | kind | match / populated | rate |
|---|---|---|---:|---:|
| AY | EPD ID | str | 541 / 671 | 80.6% |
| G | EPD Expiry | str | 467 / 671 | 69.6% |
| N | Countries of Manufacture | str | 321 / 487 | 65.9% |
| BD | Internal/External Validation | str | 303 / 504 | 60.1% |
| BI | EPD LCA Software | str | 170 / 308 | 55.2% |
| BB | EPD/LCA Prepared by | str | 342 / 643 | 53.2% |
| AZ | EPD Type | str | 340 / 671 | 50.7% |
| BK | Product Service Life (Years) | str | 84 / 168 | 50.0% |
| BE | EPD Verifying Agent | str | 234 / 503 | 46.5% |
| BF | EPD Standards | str | 127 / 279 | 45.5% |
| AT | Material Type | str | 178 / 393 | 45.3% |
| BG | EPD PCR Guidelines | str | 196 / 463 | 42.3% |
| R | GWP units kgCO2e per | str | 284 / 671 | 42.3% |
| BH | LCA Method | str | 149 / 399 | 37.3% |
| AH | Density Units | str | 227 / 615 | 36.9% |
| BJ | EPD LCI Database | str | 113 / 308 | 36.7% |
| BC | EPD Program / Operator | str | 182 / 509 | 35.8% |
| O | Markets of Applicability | str | 232 / 665 | 34.9% |
| J | Manufacturer | str | 229 / 668 | 34.3% |
| BA | EPD Owner | str | 80 / 515 | 15.5% |
| AG | Density | str | 89 / 615 | 14.5% |
| AL | k, Thermal Conductivity | str | 14 / 113 | 12.4% |
| AK | R-value / inch | str | 14 / 130 | 10.8% |
| Q | Stated EPD kgCO2e / unit | str | 55 / 671 | 8.2% |
| AQ | Depth (m) | str | 1 / 115 | 0.9% |
| K | Product Brand Name | str | 1 / 613 | 0.2% |
| I | Material | str | 0 / 671 | 0.0% |
| L | Specifications | str | 0 / 445 | 0.0% |
| W | GWP-bio from EPD | str | 0 / 86 | 0.0% |
| AI | Addn'l factors | str | 0 / 182 | 0.0% |
| AJ | Addn'l factor units | str | 0 / 191 | 0.0% |
| AM | Moisture content % | str | 0 / 12 | 0.0% |
| AN | Mass (kg) | str | 0 / 6 | 0.0% |
| AO | Length (m) | str | 0 / 56 | 0.0% |
| AP | Width (m) | str | 0 / 56 | 0.0% |
| AR | Unit Volume (m3) | str | 0 / 27 | 0.0% |

## Multi-product fan-out (§16.1 Follow-up #4)

Each EPD below maps to >1 BEAM row but the parser emits one record per PDF — spread between min/max row coverage signals product-variant mismatch under the same EPD.

| canonical epd.id | rows | avg coverage | spread |
|---|---:|---:|---:|
| 47895560991021 | 43 | 38.7% | 11.5pp |
| epd352 | 24 | 42.1% | 0.0pp |
| epd10294 | 20 | 41.7% | 0.0pp |
| 47884246341021 | 19 | 52.3% | 7.1pp |
| epd10092 | 18 | 33.3% | 0.0pp |
| epd351 | 18 | 42.1% | 0.0pp |
| epd350 | 18 | 42.0% | 2.1pp |
| epd349 | 18 | 42.1% | 0.0pp |
| epd347 | 18 | 42.1% | 0.0pp |
| epd348 | 15 | 47.4% | 0.0pp |
| epd346 | 12 | 42.1% | 0.0pp |
| 47890927681011 | 10 | 24.3% | 9.6pp |
| epd362 | 9 | 52.0% | 0.0pp |
| 2021m20141 | 9 | 36.2% | 1.6pp |
| 47897933651011 | 9 | 45.5% | 0.0pp |
| 47891035931021 | 7 | 39.5% | 0.9pp |
| scsepd07524 | 6 | 37.5% | 0.0pp |
| 47884246341011 | 5 | 57.1% | 0.0pp |
| 47884246341071 | 5 | 52.4% | 8.3pp |
| 47884246341061 | 5 | 39.1% | 4.3pp |
| 47905509341011 | 5 | 43.1% | 3.8pp |
| epd338 | 4 | 19.6% | 3.6pp |
| 47906780841011 | 4 | 39.6% | 6.5pp |
| epd10786 | 4 | 28.3% | 8.7pp |
| 40298012 | 4 | 28.0% | 0.0pp |
| sp05037 | 4 | 35.6% | 3.8pp |
| epdste20150327ibd1en | 4 | 17.4% | 6.4pp |
| cim20191223001 | 3 | 18.4% | 12.9pp |
| 47884246341031 | 3 | 57.1% | 0.0pp |
| ep397 | 3 | 23.1% | 0.0pp |

## CSV-only canonical `epd.id`s (no PDF found — excluded from parity)

55 EPD IDs in the BEAM CSV have no matching PDF in the folder. Sample (first 30): `47871687091011, 20160601, epd10270, epd206, epd034, epd194, epd195, 47871090181021, notyetpublished, 113452781012, 47887534511051, 47873196881011, , bfcastudytally, bolinsmith2011lcaassessmentofacqtreatedlumberjournalofcleanerproduction, benalonetallca2019, fernandesetallca2019, april2018, arehartetal2020lca, meliaetallca2014, newyorkstatepollutionpreventioninstitutelca2013, fernandesetallca2020, fromicedatabasev3, icev302019, icev302020, epd540, epd539, 01001, 01002, 01004` ….


## Sheets

- `parity-sheet1-beam.csv` — BEAM cell values for scored rows
- `parity-sheet2-pdf.csv` — parser-extracted values (same row order, full A→BL column shape; skipped columns left empty)
- `parity-sheet3-diff.csv` — per-cell `MATCH` / `MISMATCH` / `—` grid + per-row `row_coverage_pct` + `mismatch_detail`