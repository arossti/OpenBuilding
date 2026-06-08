# Parity B — BEAM CSV ↔ EPD-parser extraction (Pass 1)

_Generated 2026-06-08T20:32:53.289Z by `schema/scripts/csv-pdf-parity.mjs`._

For every BEAM CSV row whose `epd.id` matches a PDF in the folder, this harness parses the PDF and compares the parser's extracted values against the populated BEAM cells per field. Tolerances: numbers ±0.5% + 0.01 absolute floor; strings trim + case-insensitive; units trim + exact. **Scoring scope** (Andy 2026-06-08, §19): only the EPD-extractable columns are in the parity %. Counted: `G, I, J, K, L, N, O, Q, R, W, AG, AH, AI, AJ, AK, AL, AM, AN, AO, AP, AQ, AR, AS, AT, AY, AZ, BA, BB, BC, BD, BE, BF, BG, BH, BI, BJ, BK`. Out-of-scope (BfCA-internal flags, BfCA-derived units/values, BfCA-computational biogenic block, BfCA taxonomy, internal notation, structural placeholders): everything else.

## Coverage

| | count |
|---|---:|
| CSV total rows | 821 |
| CSV rows with `epd.id` | 777 |
| CSV distinct canonical `epd.id` | 347 |
| PDFs in folder | 302 |
| PDFs distinct canonical `epd.id` | 301 |
| **EPDs matched in both** | **294** |
| **BEAM rows scored** | **671** |
| BEAM rows excluded (no PDF) | 150 |
| PDF-only (no BEAM row) | 7 |
| Parse errors | 0 |

## Parity

- Rows at **100% parity**: **0/671** (0.0%)
- Aggregate cell parity (EPD-comparable columns, populated BEAM cells): **3612/14100** (25.6%)
- Average per-row coverage: **25.5%**

## Per-field match rate (descending)

Sorted by match rate — top fields are reliable extractions; bottom fields are the extractor gaps to chase (and good candidates for Goal-B form expansion).

| col | field | kind | match / populated | rate |
|---|---|---|---:|---:|
| AY | EPD ID | str | 541 / 671 | 80.6% |
| BD | Internal/External Validation | str | 303 / 504 | 60.1% |
| BI | EPD LCA Software | str | 170 / 308 | 55.2% |
| BK | Product Service Life (Years) | str | 84 / 168 | 50.0% |
| AZ | EPD Type | str | 306 / 671 | 45.6% |
| BF | EPD Standards | str | 127 / 279 | 45.5% |
| AT | Material Type | str | 178 / 393 | 45.3% |
| BE | EPD Verifying Agent | str | 215 / 503 | 42.7% |
| BG | EPD PCR Guidelines | str | 196 / 463 | 42.3% |
| AH | Density Units | str | 227 / 615 | 36.9% |
| BC | EPD Program / Operator | str | 182 / 509 | 35.8% |
| G | EPD Expiry | str | 232 / 671 | 34.6% |
| J | Manufacturer | str | 229 / 668 | 34.3% |
| BH | LCA Method | str | 135 / 399 | 33.8% |
| BB | EPD/LCA Prepared by | str | 186 / 643 | 28.9% |
| BJ | EPD LCI Database | str | 81 / 308 | 26.3% |
| AG | Density | str | 89 / 615 | 14.5% |
| BA | EPD Owner | str | 68 / 515 | 13.2% |
| Q | Stated EPD kgCO2e / unit | str | 55 / 671 | 8.2% |
| AL | k, Thermal Conductivity | str | 2 / 113 | 1.8% |
| AQ | Depth (m) | str | 1 / 115 | 0.9% |
| O | Markets of Applicability | str | 4 / 665 | 0.6% |
| K | Product Brand Name | str | 1 / 613 | 0.2% |
| I | Material | str | 0 / 671 | 0.0% |
| L | Specifications | str | 0 / 445 | 0.0% |
| N | Countries of Manufacture | str | 0 / 487 | 0.0% |
| R | GWP units kgCO2e per | str | 0 / 671 | 0.0% |
| W | GWP-bio from EPD | str | 0 / 86 | 0.0% |
| AI | Addn'l factors | str | 0 / 182 | 0.0% |
| AJ | Addn'l factor units | str | 0 / 191 | 0.0% |
| AK | R-value / inch | str | 0 / 130 | 0.0% |
| AM | Moisture content % | str | 0 / 12 | 0.0% |
| AN | Mass (kg) | str | 0 / 6 | 0.0% |
| AO | Length (m) | str | 0 / 56 | 0.0% |
| AP | Width (m) | str | 0 / 56 | 0.0% |
| AR | Unit Volume (m3) | str | 0 / 27 | 0.0% |

## Multi-product fan-out (§16.1 Follow-up #4)

Each EPD below maps to >1 BEAM row but the parser emits one record per PDF — spread between min/max row coverage signals product-variant mismatch under the same EPD.

| canonical epd.id | rows | avg coverage | spread |
|---|---:|---:|---:|
| 47895560991021 | 43 | 23.3% | 7.7pp |
| epd352 | 24 | 31.6% | 0.0pp |
| epd10294 | 20 | 25.0% | 0.0pp |
| 47884246341021 | 19 | 26.1% | 3.6pp |
| epd10092 | 18 | 16.7% | 0.0pp |
| epd351 | 18 | 31.6% | 0.0pp |
| epd350 | 18 | 31.5% | 1.6pp |
| epd349 | 18 | 31.6% | 0.0pp |
| epd347 | 18 | 31.6% | 0.0pp |
| epd348 | 15 | 36.8% | 0.0pp |
| epd346 | 12 | 31.6% | 0.0pp |
| 47890927681011 | 10 | 24.3% | 9.6pp |
| epd362 | 9 | 36.0% | 0.0pp |
| 2021m20141 | 9 | 31.7% | 1.4pp |
| 47897933651011 | 9 | 22.7% | 0.0pp |
| 47891035931021 | 7 | 26.9% | 1.9pp |
| scsepd07524 | 6 | 33.3% | 0.0pp |
| 47884246341011 | 5 | 28.6% | 0.0pp |
| 47884246341071 | 5 | 22.5% | 3.6pp |
| 47884246341061 | 5 | 20.3% | 1.4pp |
| 47905509341011 | 5 | 27.7% | 3.8pp |
| epd338 | 4 | 12.5% | 3.6pp |
| 47906780841011 | 4 | 24.6% | 1.8pp |
| epd10786 | 4 | 15.2% | 8.7pp |
| 40298012 | 4 | 28.0% | 0.0pp |
| sp05037 | 4 | 24.0% | 3.8pp |
| epdste20150327ibd1en | 4 | 10.7% | 0.6pp |
| cim20191223001 | 3 | 13.7% | 10.0pp |
| 47884246341031 | 3 | 28.6% | 0.0pp |
| ep397 | 3 | 15.4% | 0.0pp |

## CSV-only canonical `epd.id`s (no PDF found — excluded from parity)

53 EPD IDs in the BEAM CSV have no matching PDF in the folder. Sample (first 30): `47871687091011, 20160601, epd10270, epd206, epd034, epd194, epd195, 47871090181021, notyetpublished, 113452781012, 47887534511051, 47873196881011, , bfcastudytally, bolinsmith2011lcaassessmentofacqtreatedlumberjournalofcleanerproduction, benalonetallca2019, fernandesetallca2019, april2018, arehartetal2020lca, meliaetallca2014, newyorkstatepollutionpreventioninstitutelca2013, fernandesetallca2020, fromicedatabasev3, icev302019, icev302020, 01001, 01002, 01004, 47897969421282, cenia01032024` ….


## Sheets

- `parity-sheet1-beam.csv` — BEAM cell values for scored rows
- `parity-sheet2-pdf.csv` — parser-extracted values (same row order, full A→BL column shape; skipped columns left empty)
- `parity-sheet3-diff.csv` — per-cell `MATCH` / `MISMATCH` / `—` grid + per-row `row_coverage_pct` + `mismatch_detail`