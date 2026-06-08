# Parity B — BEAM CSV ↔ EPD-parser extraction (Pass 1)

_Generated 2026-06-08T17:53:02.638Z by `schema/scripts/csv-pdf-parity.mjs`._

For every BEAM CSV row whose `epd.id` matches a PDF in the folder, this harness parses the PDF and compares the parser's extracted values against the populated BEAM cells per field. Tolerances: numbers ±0.5% + 0.01 absolute floor; strings trim + case-insensitive; units trim + exact. Skipped from the parity %: `A, C, D, E, F, P, AA, AD, AX` (BfCA-internal status flags + structural placeholders, never EPD-derived).

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
- Aggregate cell parity (EPD-comparable columns, populated BEAM cells): **1336/20003** (6.7%)
- Average per-row coverage: **6.5%**

## Per-field match rate (descending)

Sorted by match rate — top fields are reliable extractions; bottom fields are the extractor gaps to chase (and good candidates for Goal-B form expansion).

| col | field | kind | match / populated | rate |
|---|---|---|---:|---:|
| BD | Internal/External Validation | str | 271 / 504 | 53.8% |
| AT | Material Type | str | 148 / 393 | 37.7% |
| AH | Density Units | str | 227 / 615 | 36.9% |
| AY | EPD ID | str | 242 / 671 | 36.1% |
| BC | EPD Program / Operator | str | 119 / 509 | 23.4% |
| AZ | EPD Type | str | 145 / 671 | 21.6% |
| AG | Density | str | 89 / 615 | 14.5% |
| Q | Stated EPD kgCO2e / unit | str | 55 / 671 | 8.2% |
| G | EPD Expiry | str | 23 / 671 | 3.4% |
| J | Manufacturer | str | 14 / 668 | 2.1% |
| BG | EPD PCR Guidelines | str | 3 / 463 | 0.6% |
| B | Display Name | str | 0 / 671 | 0.0% |
| H | Footnote | str | 0 / 247 | 0.0% |
| I | Material | str | 0 / 671 | 0.0% |
| K | Product Brand Name | str | 0 / 613 | 0.0% |
| L | Specifications | str | 0 / 445 | 0.0% |
| M | Notes | str | 0 / 299 | 0.0% |
| N | Countries of Manufacture | str | 0 / 487 | 0.0% |
| O | Markets of Applicability | str | 0 / 665 | 0.0% |
| R | GWP units kgCO2e per | str | 0 / 671 | 0.0% |
| S | GWP kgCO2e/(common unit) | str | 0 / 671 | 0.0% |
| T | Common Unit: kgCO2e / _ | str | 0 / 671 | 0.0% |
| U | Metric Units | str | 0 / 671 | 0.0% |
| V | Imperial Units | str | 0 / 671 | 0.0% |
| W | GWP-bio from EPD | str | 0 / 89 | 0.0% |
| X | Biogenic carbon factor | str | 0 / 127 | 0.0% |
| Y | % Carbon content (kgC/kg) | str | 0 / 113 | 0.0% |
| Z | Biogenic Storage | str | 0 / 84 | 0.0% |
| AB | WWF Storage Factor | str | 0 / 109 | 0.0% |
| AC | Carbon content kgC/unit | str | 0 / 99 | 0.0% |
| AE | Biogenic CO2 full C value | str | 0 / 90 | 0.0% |
| AF | Storage % Reduction | str | 0 / 190 | 0.0% |
| AI | Addn'l factors | str | 0 / 182 | 0.0% |
| AJ | Addn'l factor units | str | 0 / 191 | 0.0% |
| AK | R-value / inch | str | 0 / 130 | 0.0% |
| AL | k, Thermal Conductivity | str | 0 / 113 | 0.0% |
| AM | Moisture content % | str | 0 / 12 | 0.0% |
| AN | Mass (kg) | str | 0 / 6 | 0.0% |
| AO | Length (m) | str | 0 / 56 | 0.0% |
| AP | Width (m) | str | 0 / 56 | 0.0% |
| AQ | Depth (m) | str | 0 / 115 | 0.0% |
| AR | Unit Volume (m3) | str | 0 / 27 | 0.0% |
| AU | Material Subtype | str | 0 / 96 | 0.0% |
| AV | Product Type | str | 0 / 536 | 0.0% |
| AW | Product Subtype | str | 0 / 392 | 0.0% |
| BA | EPD Owner | str | 0 / 515 | 0.0% |
| BB | EPD/LCA Prepared by | str | 0 / 643 | 0.0% |
| BE | EPD Verifying Agent | str | 0 / 503 | 0.0% |
| BF | EPD Standards | str | 0 / 279 | 0.0% |
| BH | LCA Method | str | 0 / 399 | 0.0% |
| BI | EPD LCA Software | str | 0 / 308 | 0.0% |
| BJ | EPD LCI Database | str | 0 / 308 | 0.0% |
| BK | Product Service Life (Years) | str | 0 / 168 | 0.0% |
| BL | Source document URL | str | 0 / 163 | 0.0% |

## Multi-product fan-out (§16.1 Follow-up #4)

Each EPD below maps to >1 BEAM row but the parser emits one record per PDF — spread between min/max row coverage signals product-variant mismatch under the same EPD.

| canonical epd.id | rows | avg coverage | spread |
|---|---:|---:|---:|
| 47895560991021 | 43 | 11.8% | 0.0pp |
| epd352 | 24 | 3.8% | 0.0pp |
| epd10294 | 20 | 0.0% | 0.0pp |
| 47884246341021 | 19 | 7.1% | 0.8pp |
| epd10092 | 18 | 0.0% | 0.0pp |
| epd351 | 18 | 3.8% | 0.0pp |
| epd350 | 18 | 3.8% | 0.1pp |
| epd349 | 18 | 3.8% | 0.0pp |
| epd347 | 18 | 3.8% | 0.0pp |
| epd348 | 15 | 3.8% | 0.0pp |
| epd346 | 12 | 3.8% | 0.0pp |
| 47890927681011 | 10 | 5.9% | 4.3pp |
| epd362 | 9 | 15.2% | 0.0pp |
| 2021m20141 | 9 | 3.3% | 0.3pp |
| 47897933651011 | 9 | 14.3% | 0.0pp |
| 47891035931021 | 7 | 8.7% | 1.0pp |
| scsepd07524 | 6 | 5.3% | 0.0pp |
| 47884246341011 | 5 | 7.7% | 0.0pp |
| 47884246341071 | 5 | 7.6% | 0.6pp |
| 47884246341061 | 5 | 4.1% | 0.6pp |
| 47905509341011 | 5 | 12.0% | 2.9pp |
| epd338 | 4 | 0.0% | 0.0pp |
| 47906780841011 | 4 | 8.2% | 0.5pp |
| epd10786 | 4 | 3.3% | 0.0pp |
| 40298012 | 4 | 9.4% | 0.0pp |
| sp05037 | 4 | 3.6% | 2.9pp |
| epdste20150327ibd1en | 4 | 3.1% | 0.1pp |
| cim20191223001 | 3 | 3.9% | 2.1pp |
| 47884246341031 | 3 | 7.7% | 0.0pp |
| ep397 | 3 | 2.7% | 0.0pp |

## CSV-only canonical `epd.id`s (no PDF found — excluded from parity)

53 EPD IDs in the BEAM CSV have no matching PDF in the folder. Sample (first 30): `47871687091011, 20160601, epd10270, epd206, epd034, epd194, epd195, 47871090181021, notyetpublished, 113452781012, 47887534511051, 47873196881011, , bfcastudytally, bolinsmith2011lcaassessmentofacqtreatedlumberjournalofcleanerproduction, benalonetallca2019, fernandesetallca2019, april2018, arehartetal2020lca, meliaetallca2014, newyorkstatepollutionpreventioninstitutelca2013, fernandesetallca2020, fromicedatabasev3, icev302019, icev302020, 01001, 01002, 01004, 47897969421282, cenia01032024` ….


## Sheets

- `parity-sheet1-beam.csv` — BEAM cell values for scored rows
- `parity-sheet2-pdf.csv` — parser-extracted values (same row order, full A→BL column shape; skipped columns left empty)
- `parity-sheet3-diff.csv` — per-cell `MATCH` / `MISMATCH` / `—` grid + per-row `row_coverage_pct` + `mismatch_detail`