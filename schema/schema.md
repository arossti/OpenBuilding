# BfCA Materials Database — Workplan & Schema Specification

> **This document is the canonical plan AND the design spec AND a cold-start handoff for new agents picking up the work.** Read the Cold-Start section first if you're joining fresh.

---

## 0. Cold-start handoff (read this first)

### Status as of 2026-04-18

- **Design**: locked in — 20 top-level blocks, 143 leaf fields, snake_case, schema-complete/nullable
- **Sample record**: complete at [`schema/sample.json`](./sample.json) — BEAM `LAM011` (Nordic X-Lam CLT 3½")
- **Source data**: cleaned & committed at [`schema/BEAM Database-DUMP.csv`](./BEAM%20Database-DUMP.csv) — 826 lines (1 header + 825 data rows), Excel-row ↔ CSV-line alignment verified
- **Branch**: `schema` on both remotes (`origin` = bfca-labs/at, `openbuilding` = arossti/OpenBuilding)
- **Last commit at time of writing**: `0714485` — CSV cleanup
- **Current phase**: About to enter **Phase 1** (BEAM CSV → JSON database port). See §3.

### Recommended next action

**Phase 1, Task 1.6**: Write `scripts/beam-csv-to-json.mjs` and port the single LAM011 row as a regression target — the script's output must match `sample.json` byte-for-byte (or at least structurally, modulo insignificant whitespace). Once LAM011 round-trips, extend to all 825 rows.

### Project context (required reading)

Memory files at `/Users/andrewthomson/.claude/projects/<path-hash>/memory/MEMORY.md` carry:
- Scope: **Canada only.** No US codes/ICC/ASHRAE unless explicitly referenced by a Canadian standard (e.g., TRACI 2.1).
- Always surface **BEAM** and **MCE²** as tools when discussing EC/wbLCA assessments.
- User is a senior architect (Andy Thomson, Thomson Architecture Inc.) — be terse, opinionated, and correct.
- Collaborator: Jacob Racusin (BfCA) — his initial-commit folders are at `docs/*(Jacob)/` and are stale reference material.

### Git workflow (strict)

1. Work on a feature branch (currently `schema`).
2. Commit + push to **both** remotes every time:
   ```bash
   git push origin <branch> && git push openbuilding <branch>
   ```
3. When ready to deploy: PR on `arossti/OpenBuilding` → user merges → GitHub Pages auto-deploys from `main`.
4. After merge: rebase local `main`, delete feature branch both sides (`git push <remote> --delete <branch>`), prune, create next feature branch.
5. Commit messages via heredoc; avoid apostrophes in messages (break bash heredocs). Prefer `--file=-` with a `<<'MSG'` block when message contains special chars.
6. **Never** push to `main` directly. **Never** force-push. **Never** skip hooks.

### Critical file inventory

| Path | Purpose |
|---|---|
| `schema/schema.md` | **This file.** Workplan + design spec + agent handoff |
| `schema/sample.json` | Canonical reference record (LAM011 CLT, 143 fields, 88 populated) |
| `schema/BEAM Database-DUMP.csv` | Cleaned BEAM source data — 826 lines, Excel row = CSV line |
| `schema/materials.json` | Pre-existing ABCD.EARTH schema — donor of rendering hints only |
| `schema/material.schema.json` | **To create (Phase 1.1).** JSON Schema Draft 2020-12 validator |
| `schema/lookups/*.json` | **To create (Phase 1.2-1.4).** Enum lookups for country/CSI/elements |
| `schema/scripts/beam-csv-to-json.mjs` | **To create (Phase 1.5).** Node ESM importer |
| `schema/materials/index.json` | **To create (Phase 1.8).** Lightweight picker catalogue |
| `schema/materials/NN-<slug>.json` | **To create (Phase 1.7).** Per-CSI-division record files |

### Known gotchas / lossy-import hazards

See §6.2 for full table. Headline items:
- **Excel date serials** are mixed with year-integers in the same column. Rule: if `n < 3000` → year; else Excel serial (epoch 1899-12-30).
- **Formula cells** survive in the CSV as literal formula strings (e.g., `=Q545/11.249`, `=IFERROR(DUMMYFUNCTION("..."), "fallback")`). The importer must either evaluate against the referenced columns in the same row or extract the IFERROR fallback string.
- **Country codes** are free-text (`"US & CA"`, `"CAN"`) → must map to ISO 3166-1 alpha-3 arrays.
- **Column AA and AC misplaced values** — BEAM's sheet has some column labels placed in data rows (e.g., LAM011 col AC = `"m2 at 3.5\""` instead of a number). Detect & null.
- **337 rows have blank `Material Type`** — infer division from Display Name prefix (`"05 | ..."`) or leave for manual classification.
- **LAM011 canonical test values**: Stated EPD = 69.96 kgCO2e/m³, density = 456 kg/m³, thickness = 0.09 m, units/m² = 11.249, biogenic factor = 0.9897, carbon content = 0.5, storage retention = 0.9. Common GWP = 6.22 kgCO2e per m² at 3.5".

### Don'ts

- Don't rename top-level schema blocks without updating `sample.json`, the Full Field Inventory (§5.1), and the IFC alignment table (§5.4) in the same commit.
- Don't embed numeric field IDs in the JSON data (use path strings + short block codes from §5.2).
- Don't add comments (`//`) to `sample.json` — strict JSON only. Use `_prefixed` sibling fields for annotations.
- Don't commit large binaries — `*.pdf`, `*.docx`, `*.xlsx` are gitignored except `PDF-Parser/sample.pdf`.
- Don't add `Co-Authored-By: Claude Sonnet` — use the model tag shown in the active environment (currently Opus 4.7).

### Verification commands (quick sanity checks)

```bash
cd schema
# sample.json structurally valid
python3 -c "import json; d=json.load(open('sample.json')); assert len(d.keys())==20; print('OK')"
# carbon math reconciles
python3 -c "import json; d=json.load(open('sample.json')); assert d['carbon']['common']['value_kgco2e']==6.22; print('OK')"
# CSV Excel-row correspondence
python3 -c "import csv; r=list(csv.reader(open('BEAM Database-DUMP.csv'))); assert r[1][0]=='2c53be'; assert r[544][0]=='LAM011'; print('OK')"
```

---

## 1. Goal

Define a canonical JSON record for a single material that serves multiple consumers in one structure:

- **BEAM / wbLCA tools** — embodied carbon + full impact category analysis
- **PDF-Parser** — material picker for volumetric takeoff (volume × material → EC)
- **BIM / rendering tools** (e.g., ABCD.EARTH) — shader properties, texture refs, base colour
- **Future tools** — cost estimation, fire compliance, thermal modelling, code-compliance checks

Each record carries everything needed to place it in a wbLCA calc, pick it in a UI, and render it in 3D. Consumers read only the fields they need.

### 1.1 Source inputs

| Source | Rows / size | Purpose |
|---|---|---|
| `schema/BEAM Database-DUMP.csv` | 826 lines / 825 data rows (cleaned) | BEAM's legacy 65-column materials data — primary import |
| `schema/materials.json` | 33 records | ABCD.EARTH's existing schema — donor of rendering hints (base_color, metallic, roughness, texture, has_grain) |
| Future EPD PDFs | — | ISO 21930 / EN 15804 Type III declarations — Phase 2 target |

---

## 2. Phase plan

Priority ordering. Each phase is independently valuable; later phases depend on earlier ones in the ways noted.

### Phase 0 — Complete ✅

- [x] Schema design locked in (20 blocks, 143 leaf fields)
- [x] Design decisions documented with rationale (§4.1)
- [x] Canonical sample record hand-authored (`sample.json` — LAM011)
- [x] BEAM CSV cleaned (trailing garbage removed, embedded newlines flattened, Excel row alignment)
- [x] Full field inventory documented (§5.1)
- [x] Field reference codes adopted (§5.2)
- [x] File size projected & module splitting strategy decided (§6.1)
- [x] IFC alignment mapped (§5.4)
- [x] `docs/`, `schema/`, workstream consolidation complete (see parent repo)

### Phase 1 — JSON database port (NEXT)

**Goal**: Emit the full catalogue as validated per-CSI-division JSON files + a lightweight index. This unblocks all downstream work.

1. **`schema/material.schema.json`** — formal JSON Schema Draft 2020-12 validator with `$defs` + stable `$anchor` IDs for each block. Enforces enums for `status.visibility`, `carbon.biogenic.method`, `classification.typical_elements`, `impacts.*.source`, etc.
2. **`schema/lookups/country-codes.json`** — `"US & CA"` → `["USA","CAN"]`, `"CAN"` → `["CAN"]`, etc. Populate from real BEAM values first; flag unmappable entries.
3. **`schema/lookups/csi-divisions.json`** — 2-digit prefix → division_name (`"03"` → `"Concrete"`, `"06"` → `"Wood, Plastics, and Composites"`).
4. **`schema/lookups/typical-elements.json`** — enum list (foundation, slab, wall_exterior, wall_interior, wall_shear, roof, roof_deck, floor, structural_frame, beam, column, joist, stud, sheathing, cladding, siding, trim, flooring, ceiling, window, door, insulation_cavity, insulation_continuous, vapour_barrier, air_barrier, membrane, finish, fastener). Also a small `material_type → default_typical_elements[]` lookup for auto-population.
5. **`schema/lookups/lifecycle-stages.json`** — enum A1, A2, A3, A4, A5, B1, B2, B3, B4, B5, B6, B7, C1, C2, C3, C4, D with short descriptions (see `sample.json` `_lifecycle_scope_reference` for the structure).
6. **`schema/scripts/beam-csv-to-json.mjs`** — Node ESM importer. Single-row mode first (LAM011 → must diff-match `sample.json`). Then batch. Handles:
   - Excel date serial conversion (see §0 gotchas)
   - Formula cell evaluation: in-row reference resolution (e.g., `=Q545/11.249` → lookup column Q in same row / 11.249); IFERROR fallback extraction
   - Country code normalisation via lookup
   - CSI division inference from Display Name prefix where `Material Type` is blank
   - Biogenic method derivation (populated biogenic fields → `"wwf_storage_factor"`)
   - Density dual-unit computation (kg_m3 × 0.06243 → lb_ft3)
   - Slug generation for `id` from `display_name` (deterministic)
7. **`schema/materials/NN-<slug>.json`** — emit one file per CSI division (`03-concrete.json`, `04-masonry.json`, `05-metals.json`, `06-wood.json`, `07-thermal.json`, `08-openings.json`, `09-finishes.json`, etc.).
8. **`schema/materials/index.json`** — emit lightweight picker catalogue (see §6.1 for schema). One entry per full record with 8 fields for UI display + filtering.
9. **Validation**: every emitted record must pass `material.schema.json`. Script exits non-zero if any record fails. Include a run report: rows skipped, rows with inferred division, rows needing manual review.
10. **Commit milestone**: Phase 1 merge to `main` triggers the next branch (`material-picker` or similar).

**Estimated effort**: 1-2 days of focused work. Task 1.6 (the script) is the long pole.

### Phase 2 — EPD PDF parser

**Goal**: Build a parser that ingests ISO 21930 / EN 15804 Type III EPD PDFs and emits schema-conformant records or patches to existing records.

- Prerequisite: Phase 1 complete (need real records to diff new EPD data against).
- Prerequisite: User shares a sample EPD PDF (pending as of 2026-04-18 afternoon).
- Approach: reuse PDF.js from `PDF-Parser/lib/` for PDF rendering and text extraction.
- Section mapping already documented in §5.5 — EPD "Declared unit" → `carbon.stated.{value_kgco2e, per_unit}`, etc.
- Output: JSON patch (new record, or diff against existing) with `source: "epd_direct"` on every impact value.
- Human-in-the-loop: low-confidence fields flagged for manual review before merge.

### Phase 3 — PDF-Parser material picker

**Goal**: Wire the materials database into the PDF-Parser so users can associate measured polygons with materials for volumetric takeoff.

- Prerequisite: Phase 1 complete (need `materials/index.json`).
- Integrates with the existing PDF-Parser Volumetric Takeoff feature (Step 10 in `docs/pdf-parser.md`).
- Tasks:
  - Fetch `materials/index.json` at PDF-Parser boot
  - Material picker UI — CSI division filter + `typical_elements` filter + full-text search over `display_name`
  - On selection: lazy-fetch the relevant `materials/NN-*.json` and store the full record in the project state
  - Extend PDF-Parser project JSON export to include material references per polygon
  - Compute EC: polygon area (m²) × depth (m) → volume (m³) × density (kg/m³) × GWP (kgCO2e/kg) = kgCO2e
  - Display per-material subtotal and project total in the Summary Table modal

### Phase 4 — BEAM app port

**Goal**: Port BEAM's Excel-based calculation engine to a JS web app sharing infrastructure with PDF-Parser.

- Prerequisite: Phase 1 complete. Phase 3 recommended (establishes integration pattern).
- User flagged: "We will need to update/enhance or create a filehandler and statemanager files, which I do not think we have explicitly created yet."
- Sub-phases:
  - **4a. Shared infra**: Create `shared/filehandler.mjs` and `shared/statemanager.mjs` used by both PDF-Parser and BEAM app. Project files are JSON, same format both apps can read. PDF-Parser project JSON extends BEAM project JSON (materials map + polygon area/depth refs).
  - **4b. Material picker UI**: reuse from Phase 3.
  - **4c. BEAM calc engine**: port the operational + embodied carbon calculations from BEAM's Excel model. Requires domain study of BEAM v3.
  - **4d. Integrated UI**: web app that can load a saved PDF-Parser project AND a saved BEAM project and run the calcs end-to-end.

### Phase 5 — IFC interop

**Goal**: Bidirectional IfcMaterial read/write. See §5.4 for full field mapping.

- `schema/ifc/ifc-import.md` — rules for parsing `IfcMaterial` + standard Psets (`Pset_MaterialCommon`, `Pset_MaterialThermal`) into our schema.
- `schema/ifc/ifc-export.md` — rules for emitting IFC-conformant materials + custom `Pset_BfCA_EPDProvenance` for fields IFC doesn't natively model.
- `schema/ifc/pset_bfca_epd_provenance.json` — formal custom Pset definition.
- Integrates with the `ifc/` workstream (currently archived as `docs/ifc (Jacob)/` pending work resumption).
- Test fixture: round-trip a material through IFC (export → import → verify no data loss on overlapping fields).

### Phase 6 — Canadian context extensions

**Goal**: Populate the `cost`, `fire`, `code_compliance` blocks with Canadian data.

- Cost per unit (CAD/m³, CAD/m², CAD/kg, CAD/unit) — requires external data source (RSMeans Canada, Altus Group, BCA indices).
- Fire ratings: FRR hours, combustibility (NBC Part 3.1.5), ULC listings, flame/smoke per CAN/ULC-S102.
- NBC Part 9 / Part 3 suitability: manual review per material type.
- VBBL s.10.4 + COV Appendix II: cross-reference with BfCA/COV documentation.

### Phase 7 — Team PDF deliverable

**Goal**: Render `schema.md` as a stakeholder-shareable PDF with tree diagram and full field list.

- Low effort, can run anytime: `pandoc schema.md -o schema.pdf --toc --pdf-engine=xelatex`
- Consider adding a Mermaid tree diagram of the 20-block structure for visual impact.
- Low priority relative to Phases 1-4; parallel track for team comms.

---

## 3. Design decisions (locked in 2026-04-18)

| Decision | Choice | Rationale |
|---|---|---|
| Primary key | `id` (slug) top-level; `beam_id` preserved inside `external_refs` | Not every future material comes from BEAM; slugs are URL/diff-friendly; BEAM ID remains indexable |
| Null vs missing | **Schema-complete, nullable** — every field present, `null` when unavailable | Readers can traverse without optional-chaining; diffs show where data got filled in |
| Arrays | Always `[]` when empty, never `null` | `.forEach` safe |
| Unit convention | **Unit in field name** (`density_kg_m3`, `gwp_kgco2e`) | Self-documenting; survives flattening to CSV/BigQuery |
| Variable-unit fields | Paired `functional_unit` string (e.g., `carbon.common.per_functional_unit`) | BEAM's "common unit" is per-material (m², m³, kg, linear m) — can't bake into field name |
| `carbon` vs `impacts` | **Separate blocks** | `carbon` preserves BEAM's audit trail (stated → conversion → common → biogenic); `impacts` is the harmonised wbLCA view with `source` discriminator |
| Case | snake_case everywhere | Normalised from BEAM's mixed casing |
| Dates | ISO 8601 strings; raw Excel serials preserved in `provenance.original_beam_added_or_modified_serial` | Round-trip audit |
| Country codes | ISO 3166-1 alpha-3 arrays (`"US & CA"` → `["USA","CAN"]`) | Unambiguous; tool-friendly |
| Biogenic method | Explicit enum `method: "wwf_storage_factor" \| "en_15804_negative_a1" \| "none"` | Makes the calculation methodology auditable; EPD parser fills later |

### 3.1 Record structure (20 top-level keys)

```
$schema, schema_version, id,
external_refs, naming, manufacturer, notes, source_notes, status,
classification, rendering,
physical, carbon, impacts,
cost, fire, code_compliance,
epd, methodology, provenance
```

See [`sample.json`](./sample.json) for the fully-populated example (BEAM LAM011 — Nordic X-Lam CLT 3½").

### 3.2 Sub-object purposes

| Block | Purpose |
|---|---|
| `external_refs` | Stable external IDs: `beam_id`, `beam_csv_row_index`, future `mce2_id`, `ec3_id`, `ifc_material_guid` |
| `naming` | Human-readable names: display_name, short_name, material_name, product_brand_name |
| `manufacturer` | Who makes it: name, country_code (ISO alpha-3), specifications, website |
| `status` | Curation flags: listed, do_not_list, is_industry_average, is_beam_average, visibility |
| `classification` | Taxonomy: CSI division, category slug, material/product type + subtype, `typical_elements[]` enum |
| `rendering` | Shader hints: base_color RGBA, metallic, roughness, texture, has_grain |
| `physical` | Material science: density (dual-unit), thermal props, dimensions, mass, moisture, `additional_factor` |
| `carbon` | BEAM's GWP audit trail: stated → conversion → common → biogenic (full calculation graph) |
| `impacts` | Harmonised wbLCA view: GWP + eutrophication + acidification + ... (each `{value, source}`) |
| `cost` | Future: CAD/unit, year, geography, source |
| `fire` | Future: FRR, combustibility, ULC listing, flame/smoke ratings |
| `code_compliance` | Future: NBC Part 9/3, VBBL s.10.4, COV Appendix II acceptance |
| `epd` | Provenance: id, type, owner, prepared_by, program, validation, dates, URL |
| `methodology` | LCA method, standards, PCR, software, LCI database, lifecycle scope (A1–D stages) |
| `provenance` | Geography, dates, import metadata with CSV row index for round-trip audit |

---

## 4. Calculation audit — how `carbon` captures BEAM's math

BEAM encodes three calculation passes. The schema preserves each explicitly so a consumer can verify the arithmetic (or a future EPD parser can populate each step from an EPD PDF):

```
carbon.stated       →  raw EPD declaration: "69.96 kgCO2e per m³"
carbon.conversion   →  functional unit conversion: "divide by 11.249 units/m² = 0.0889× multiplier"
carbon.common       →  result: "6.22 kgCO2e per m² at 3.5″"
carbon.biogenic     →  sequestration math: density × thickness × biogenic_factor × carbon_content × 3.67
                       then × storage_retention (0.9) for long-term stored CO2e
```

The CO₂:C molar ratio (44/12 ≈ 3.67) is preserved as `carbon.biogenic.co2_to_c_molar_ratio` — constant but explicit.

### 4.1 Worked example (LAM011 — use as Phase 1 importer test target)

| Step | Value | Source |
|---|---|---|
| `carbon.stated.value_kgco2e` | `69.96` | BEAM col Q (Stated EPD kgCO2e / unit) |
| `carbon.stated.per_unit` | `"m3"` | BEAM col R |
| Units/m² (internal) | `11.249` | BEAM col S formula `=Q545/11.249` (derived from 3.5" thickness: 1/0.0889) |
| `carbon.conversion.factor` | `0.088897` | = 1 / 11.249 |
| `carbon.common.value_kgco2e` | `6.22` | = 69.96 / 11.249 |
| `carbon.common.per_functional_unit` | `"m2 at 3.5\""` | BEAM col T |
| Density | `456 kg/m³` | BEAM col AG |
| Thickness | `0.09 m` | BEAM col AI (3.5" rounded) |
| Biogenic factor | `0.9897` | BEAM col X |
| Carbon content | `0.5` kgC/kg | BEAM col Y |
| Storage retention | `0.9` | BEAM col AF |
| `carbon.biogenic.full_carbon_kgco2e_per_common_unit` | `74.53` | = 456 × 0.09 × 0.9897 × 0.5 × 3.67 |
| `carbon.biogenic.stored_kgco2e_per_common_unit` | `67.08` | = 74.53 × 0.9 |
| `carbon.biogenic.carbon_content_kgc_per_unit` | `20.31` | = 456 × 0.09 × 0.9897 × 0.5 (without CO2/C ratio) |

---

## 5. Specification reference

### 5.1 Full field inventory (shareable with team)

Every leaf field the schema defines, grouped by top-level block. Type hints: `str`, `num`, `bool`, `str[]`, `num[4]`, `ISO-3166-1α3`, `enum(...)`. All fields are nullable unless marked required.

#### Top-level identity
| Field | Type | Notes |
|---|---|---|
| `$schema` | str | URL to JSON Schema definition (aspirational) |
| `schema_version` | num | Integer, bumped on breaking changes |
| `id` | str | **Required.** Slug primary key (e.g., `clt_nordic_xlam_3_5in`) |
| `notes` | str | Free-form user commentary |
| `source_notes` | str | Import-time annotations (e.g., "BfCA BioC calc by mass") |

#### `external_refs` — cross-catalogue IDs
| Field | Type |
|---|---|
| `beam_id` | str — BEAM CSV column A |
| `beam_csv_row_index` | num — 1-based, for round-trip audit |
| `mce2_id` | str — future |
| `ec3_id` | str — future, EC3 database |
| `ifc_material_guid` | str — future, IFC IfcMaterial GUID |

#### `naming`
| Field | Type |
|---|---|
| `display_name` | str — long form with manufacturer/spec |
| `short_name` | str — UI-friendly |
| `material_name` | str — generic (e.g., "Cross Laminated Timber") |
| `product_brand_name` | str — product line (e.g., "X-Lam") |

#### `manufacturer`
| Field | Type |
|---|---|
| `name` | str |
| `country_code` | ISO-3166-1α3 |
| `specifications` | str — free-form |
| `website` | str URL |

#### `status`
| Field | Type |
|---|---|
| `listed` | bool |
| `do_not_list` | bool |
| `is_industry_average` | bool |
| `is_beam_average` | bool |
| `visibility` | enum(`public`, `hidden`, `deprecated`) |

#### `classification`
| Field | Type |
|---|---|
| `division_prefix` | str — CSI 2-digit (e.g., `"06"`) |
| `division_name` | str — CSI division name |
| `category` | str — slug (`06_wood`) |
| `csi_masterformat` | str — full CSI code |
| `uniformat_level2` | str — future |
| `material_type` | str — BEAM generic |
| `material_subtype` | str |
| `product_type` | str |
| `product_subtype` | str |
| `typical_elements` | str[] — enum (foundation, slab, wall_exterior, …) |

#### `rendering` — shader hints
| Field | Type |
|---|---|
| `base_color` | num[4] — RGBA floats 0-1 |
| `metallic` | num 0-1 |
| `roughness` | num 0-1 |
| `texture` | str path |
| `has_grain` | bool |

#### `physical`
| Field | Type |
|---|---|
| `density.value_kg_m3` | num |
| `density.value_lb_ft3` | num — derived from kg_m3 × 0.06243 |
| `density.source` | enum(`epd`, `estimated`, `materials_science`) |
| `thermal.conductivity_w_mk` | num |
| `thermal.resistance_per_inch_rsi` | num |
| `thermal.r_value_per_inch_imperial` | num |
| `thermal.heat_capacity_j_kgk` | num |
| `moisture_content_pct` | num |
| `mass_per_unit_kg` | num |
| `dimensions.length_m` | num |
| `dimensions.width_m` | num |
| `dimensions.depth_m` | num |
| `dimensions.unit_volume_m3` | num |
| `dimensions.units_per_m2` | num |
| `additional_factor.value` | num |
| `additional_factor.units` | str |
| `additional_factor.description` | str |

#### `carbon.stated` — raw EPD declaration
| Field | Type |
|---|---|
| `value_kgco2e` | num |
| `per_unit` | str — declared unit (m³, kg, m², etc.) |
| `source` | enum(`epd`, `industry_average`, `estimated`) |
| `lifecycle_stages` | str[] — EN 15804 stages reported |

#### `carbon.conversion` — declared → functional unit
| Field | Type |
|---|---|
| `to_common_unit` | str |
| `factor` | num — multiplier |
| `factor_formula` | str |
| `factor_source` | enum(`physical_dimensions`, `mass_density`, `explicit_epd`, `manual`) |
| `notes` | str |

#### `carbon.common` — harmonised functional-unit result
| Field | Type |
|---|---|
| `value_kgco2e` | num |
| `per_functional_unit` | str |
| `metric_unit_label` | str |
| `imperial_unit_label` | str |

#### `carbon.biogenic` — sequestration math
| Field | Type |
|---|---|
| `gwp_bio_from_epd_kgco2e_per_common_unit` | num |
| `carbon_content_pct_kgc_kg` | num |
| `biogenic_factor` | num |
| `storage_retention_pct` | num 0-1 |
| `wwf_storage_factor_kgco2e_per_kgc` | num |
| `stored_kgco2e_per_common_unit` | num |
| `full_carbon_kgco2e_per_common_unit` | num |
| `carbon_content_kgc_per_unit` | num |
| `co2_to_c_molar_ratio` | num (constant 3.67) |
| `method` | enum(`wwf_storage_factor`, `en_15804_negative_a1`, `none`) |
| `notes` | str |

#### `impacts` — harmonised wbLCA view
| Field | Type |
|---|---|
| `functional_unit` | str |
| Each of `gwp_kgco2e`, `gwp_bio_kgco2e`, `eutrophication_kgneq`, `acidification_kgso2eq`, `ozone_depletion_kgcfc11eq`, `smog_kgo3eq`, `abiotic_depletion_fossil_mj`, `water_consumption_m3`, `primary_energy_nonrenewable_mj`, `primary_energy_renewable_mj` | `{ value: num, source: enum(epd_direct \| beam_derived \| industry_average \| estimated) }` |

#### `cost` (future)
`unit`, `cad_per_unit`, `year`, `geography`, `source`

#### `fire` (future)
`frr_hours`, `combustibility` (enum `non_combustible | combustible | fr_treated`), `ulc_listing`, `flame_spread_rating`, `smoke_developed_rating`

#### `code_compliance` (future, BfCA-specific)
`nbc_part_9_suitable`, `nbc_part_3_suitable`, `vbbl_s10_4_accepted`, `cov_appendix_ii_listed`

#### `epd` — provenance
| Field | Type |
|---|---|
| `id` | str |
| `type` | enum(`product_specific`, `industry_average`, `generic`, `beam_average`) |
| `owner` | str |
| `prepared_by` | str |
| `program_operator` | str |
| `validation.type` | enum(`internal`, `external`) |
| `validation.agent` | str |
| `publication_date` | ISO date |
| `expiry_date` | ISO date |
| `product_service_life_years` | num |
| `source_document_url` | str |
| `footnote` | str |

#### `methodology`
| Field | Type |
|---|---|
| `standards` | str[] |
| `pcr_guidelines` | str |
| `lca_method` | str (e.g., `TRACI 2.1`) |
| `lca_software` | str |
| `lci_database` | str |
| `lifecycle_scope.stages_included` | str[] |
| `lifecycle_scope.cutoff_rule_pct` | num |
| `lifecycle_scope.allocation_method` | enum(`mass`, `economic`, `system_expansion`) |

#### `provenance`
| Field | Type |
|---|---|
| `countries_of_manufacture` | ISO-3166-1α3[] |
| `markets_of_applicability` | ISO-3166-1α3[] |
| `data_added_or_modified` | ISO date |
| `original_beam_added_or_modified_serial` | num — Excel serial preserved |
| `source_notes` | str |
| `import_metadata.imported_from` | str |
| `import_metadata.import_date` | ISO date |
| `import_metadata.beam_csv_row_index` | num |
| `import_metadata.beam_csv_sha256` | str — hash of source CSV |

### 5.2 Field reference codes (for docs & conversation)

To talk about fields tersely in PRs, chat, and issues without embedding numeric IDs in the JSON itself, use these short block prefixes. Documentation convention only — the JSON on disk stays clean.

| Code | Block | Full path prefix |
|---|---|---|
| `TOP` | top-level identity | `$schema`, `schema_version`, `id`, `notes`, `source_notes` |
| `EXT` | cross-catalogue IDs | `external_refs.*` |
| `NAM` | naming | `naming.*` |
| `MFR` | manufacturer | `manufacturer.*` |
| `STS` | curation status | `status.*` |
| `CLS` | classification | `classification.*` |
| `RND` | rendering hints | `rendering.*` |
| `PHD` | physical density | `physical.density.*` |
| `PHT` | physical thermal | `physical.thermal.*` |
| `PHM` | physical dimensions | `physical.dimensions.*` |
| `PHA` | physical additional factor | `physical.additional_factor.*` |
| `PHX` | physical misc (moisture, mass) | `physical.{moisture_content_pct, mass_per_unit_kg}` |
| `CST` | carbon stated | `carbon.stated.*` |
| `CCN` | carbon conversion | `carbon.conversion.*` |
| `CCM` | carbon common (harmonised) | `carbon.common.*` |
| `CBG` | carbon biogenic | `carbon.biogenic.*` |
| `IMP` | impacts (wbLCA) | `impacts.*` |
| `CSTS` | cost (future) | `cost.*` |
| `FIR` | fire (future) | `fire.*` |
| `CCL` | code compliance (future) | `code_compliance.*` |
| `EPD` | EPD provenance | `epd.*` |
| `MTH` | methodology | `methodology.*` + `methodology.lifecycle_scope.*` |
| `PRV` | provenance | `provenance.*` |
| `IMT` | provenance import metadata | `provenance.import_metadata.*` |

Example usage: "`CBG.storage_retention_pct` needs to be clamped to 0–1 in the importer" or "UI filter should check `CLS.typical_elements` for `wall_exterior`."

### 5.3 Field count by domain

| Domain | Fields | Populated in LAM011 sample |
|---|---|---|
| Top-level identity (`$schema`, `schema_version`, `id`, `notes`, `source_notes`) | 5 | 4 |
| `external_refs` | 5 | 2 |
| `naming` + `manufacturer` | 8 | 6 |
| `status` | 5 | 5 |
| `classification` | 10 | 7 |
| `rendering` | 5 | 5 (invented defaults) |
| `physical` (density + thermal + dimensions + additional_factor) | 14 | 7 |
| `carbon` (stated + conversion + common + biogenic) | 20 | 17 |
| `impacts` (10 × `{value, source}` + `functional_unit`) | 21 | 3 (GWP only) |
| `cost` / `fire` / `code_compliance` | 14 | 1 (combustibility) |
| `epd` + `methodology` + `provenance` | 27 | 17 |
| Structural sub-object keys | 9 | 9 |
| **Total leaf fields** | **143** | **88 populated, 55 null** |

### 5.4 IFC (Industry Foundation Classes) alignment

IFC / ISO 16739 is the open BIM data exchange standard. Our schema is a **superset** of typical IFC material data — we can absorb IFC on import and emit IFC-compatible material entities on export. Phase 5 delivers this.

#### Our schema → IFC 4.x mapping

| Our field | IFC 4.x entity / property set |
|---|---|
| `id` | `IfcMaterial.Name` (or `.GlobalId` for `IfcMaterial` in IFC 4.3) |
| `external_refs.ifc_material_guid` | `IfcMaterial.GlobalId` — the natural cross-reference |
| `naming.material_name` | `IfcMaterial.Name` |
| `naming.display_name` | `IfcMaterial.Description` |
| `classification.category` | `IfcMaterial.Category` |
| `classification.csi_masterformat` | `IfcClassificationReference` relationship (via `IfcRelAssociatesClassification`) |
| `physical.density.value_kg_m3` | `Pset_MaterialCommon.MassDensity` |
| `physical.thermal.conductivity_w_mk` | `Pset_MaterialThermal.ThermalConductivity` |
| `physical.thermal.heat_capacity_j_kgk` | `Pset_MaterialThermal.SpecificHeatCapacity` |
| `physical.moisture_content_pct` | `Pset_MaterialHygroscopic` (partial) |
| `rendering.base_color` | `IfcSurfaceStyleRendering.DiffuseColour` (or PBR in IFC 4.3) |
| `rendering.metallic`, `roughness` | IFC 4.3 PBR: `IfcSurfaceStyleRendering` extensions (MetalnessRoughness model) |
| `rendering.texture` | `IfcSurfaceTexture` |
| `fire.combustibility` | `Pset_MaterialCombustion` (partial) + building-element-level Psets |
| `fire.frr_hours` | `Pset_BuildingElementProxyFireHazardProperties` (element-bound, not material-bound in IFC) |
| `impacts.*` (GWP, EP, AP, ODP, POCP, ADP, etc.) | `IfcEnvironmentalImpactValue` (IFC 4.0+) with `ImpactCategoryEnum` + `IfcLifeCycleStage` — **direct structural match** |
| `carbon.stated.lifecycle_stages[]` | `IfcLifeCycleStage` enum on `IfcEnvironmentalImpactValue` — same A1–D taxonomy |
| `epd.*` (full EPD provenance) | No native IFC entity — emitted as custom `IfcPropertySet` (e.g., `Pset_BfCA_EPDProvenance`) |
| `methodology.*` | No native IFC entity — custom Pset |
| `code_compliance.*` | No native IFC entity — custom Pset or `IfcRelAssociatesApproval` |
| `carbon.biogenic.*` | Partial alignment with `IfcEnvironmentalImpactValue.Category = BIOGENICCARBONEQUIVALENT` (IFC 4.3+); detailed math fields are custom |

#### Observations

1. **Strong alignment on physical properties**: `physical` block maps cleanly onto IFC's standard Psets. An IFC importer can populate these without custom schemas.
2. **Strong alignment on impact categories**: IFC 4.0+ `IfcEnvironmentalImpactValue` with `ImpactCategoryEnum` and `LifeCycleStage` uses the same EN 15804 taxonomy as our `impacts` block and `lifecycle_stages` enum. The industry is converging on these names.
3. **Schema gaps vs. IFC**: IFC has richer mechanical and optical properties (`Pset_MaterialMechanical`, `Pset_MaterialOptical`) that we don't yet model. When imported from IFC, stash in forward-compat `physical.mechanical.*` / `physical.optical.*` blocks.
4. **IFC gaps vs. our schema**: IFC has no native representation for EPD provenance chain, BEAM's explicit conversion math, BfCA-specific code compliance, or detailed biogenic storage methodology. On export these become custom `Pset_BfCA_*` property sets attached via `IfcRelDefinesByProperties`.

### 5.5 EPD parser implications

The schema *structure* mirrors ISO 21930 / EN 15804 EPD document sections. Phase 2 parser walks an EPD PDF and populates:

- EPD "Declared unit" → `carbon.stated.{value_kgco2e, per_unit}`
- EPD "Functional unit" → `carbon.common.per_functional_unit` + `impacts.functional_unit`
- EPD "Reference service life" → `epd.product_service_life_years`
- EPD "Lifecycle modules" → `carbon.stated.lifecycle_stages[]` + `methodology.lifecycle_scope.stages_included[]`
- EPD "Allocation procedure" → `methodology.lifecycle_scope.allocation_method`
- EPD impact table rows → `impacts.{gwp, eutrophication, acidification, ...}.value` with `source: "epd_direct"`
- EPD "Biogenic carbon" row (EN 15804+A2) → `carbon.biogenic.gwp_bio_from_epd_kgco2e_per_common_unit`
- EPD registration # → `epd.id`; program operator → `epd.program_operator`; verifier → `epd.validation.agent`

The `source` discriminator (`"epd_direct" | "beam_derived" | "industry_average" | "estimated" | null`) on impact values distinguishes parsed-from-EPD numbers from BEAM-derived ones — important for data quality audits.

---

## 6. Implementation guidance

### 6.1 File size & module splitting

#### Size projections

Measured from `sample.json`:

| Records | Pretty-printed | Minified | Gzipped (est.) |
|---|---|---|---|
| 1 | ~6.2 KB | ~4.7 KB | ~1.2 KB |
| 820 (actual BEAM count) | ~4.8 MB | ~3.6 MB | **~0.9 MB** |
| 1000 (rounded) | ~5.9 MB | ~4.5 MB | **~1.1 MB** |

#### Split strategy: CSI MasterFormat for files, UNIFORMAT as in-record filter

| Question | Taxonomy | Role |
|---|---|---|
| *What material is this?* (steel, concrete, wood) | **CSI MasterFormat** — 50 divisions, ~15 have entries in BEAM | **File-level split** — one JSON per CSI division |
| *Where does it go in the building?* (foundation, wall, roof, floor) | **UNIFORMAT II** — A/B/C/D/E/F/G elemental groupings | **In-record filter** via existing `classification.typical_elements[]` |

**Why CSI wins for file organisation:**
- BEAM's Display Names already prefix with CSI division (`"05 | Steel Panel"`, `"06 | Plywood"`) — the split is free.
- Each material belongs to **exactly one** CSI division (concrete is always 03, never "also 06"). UNIFORMAT would force duplicating materials.
- CSI aligns with how specs are written and how trades are organised on site.

**Why UNIFORMAT stays in `typical_elements[]`:**
- Already in the schema; no new scheme needed.
- A record can be searchable across multiple element types simultaneously (`["floor", "roof_deck", "wall_shear"]` for CLT).
- Clients filter client-side: "show me division-06 materials where `typical_elements` includes `wall_exterior`."

#### Recommended file layout

```
schema/
├── material.schema.json          JSON Schema validator (Phase 1.1)
├── sample.json                   CLT LAM011 full-fields reference
├── lookups/                      Phase 1.2-1.5 enums
│   ├── country-codes.json
│   ├── csi-divisions.json
│   ├── typical-elements.json
│   └── lifecycle-stages.json
├── scripts/
│   └── beam-csv-to-json.mjs      Phase 1.6 importer
└── materials/                    Phase 1.7-1.8 output
    ├── index.json                Lightweight picker catalogue
    ├── 03-concrete.json
    ├── 04-masonry.json
    ├── 05-metals.json
    ├── 06-wood.json              Wood + bamboo + wood fibre (~60 records)
    ├── 07-thermal.json           Insulation family (~70 records)
    ├── 08-openings.json          Windows, doors, glazing
    ├── 09-finishes.json          Gypsum, vinyl, linoleum, paint
    ├── 31-earthwork.json         (future / sparse)
    └── 32-sitework.json          (future / sparse)
```

#### `materials/index.json` — what's in it

Projected size: ~100 KB for 1000 records. 8 fields per record for picker display and filtering:

| Field | Source full-record path | Purpose in index |
|---|---|---|
| `id` | `id` | Primary key; used to fetch full record |
| `beam_id` | `external_refs.beam_id` | Cross-reference |
| `display_name` | `naming.display_name` | UI list label |
| `category` | `classification.category` | Group header (`06_wood`) |
| `division_prefix` | `classification.division_prefix` | Which per-division file to fetch |
| `typical_elements` | `classification.typical_elements` | UNIFORMAT filter axis |
| `gwp_kgco2e` | `impacts.gwp_kgco2e.value` | Preview number in the picker |
| `functional_unit` | `impacts.functional_unit` | Preview unit label |

#### Load pattern for the PDF-Parser material picker

```
1. App boot:      fetch materials/index.json         (~30 KB gz, once, cached)
2. Picker open:   render list from index             (no network)
3. User filters:  "division 06 + typical_element=wall_exterior"
                  → fetch materials/06-wood.json     (~300 KB gz, once per division, cached)
4. User picks X:  full record already in memory      (no extra fetch)
```

### 6.2 Fields that can't be mapped from BEAM

Null at import time; fill manually or in later phases:

- `external_refs.mce2_id`, `ec3_id`, `ifc_material_guid` → null
- `naming.short_name` → derive from display_name manually
- `classification.typical_elements` → small per-material-type lookup table (Phase 1.4)
- `rendering.*` → fuzzy-match ABCD.EARTH by material_type; default per category when missing
- `physical.density.value_lb_ft3` → computed (kg_m3 × 0.06243)
- `physical.thermal.heat_capacity_j_kgk` → null; future materials-science lookup
- `carbon.biogenic.method` → derive: biogenic fields populated → `"wwf_storage_factor"`, else `"none"`
- `impacts.*` (non-GWP) → null; EPD parser (Phase 2) fills
- `cost.*`, `fire.*` (except combustibility), `code_compliance.*` → null; Phase 6 fills
- `methodology.lifecycle_scope.cutoff_rule_pct`, `allocation_method` → null; EPD parser (Phase 2) fills

### 6.3 Fields that are lossy to port from BEAM

| BEAM column | Handling |
|---|---|
| Excel date serials (mix of year integers and day-count serials) | If value < 3000 → treat as year; if > 30000 → Excel serial → ISO date; preserve raw in `provenance.original_beam_added_or_modified_serial` |
| Formula cells (`=Q545/11.249`, `=IFERROR(DUMMYFUNCTION(...))`) | Evaluate or reconstruct from referenced columns; extract fallback strings from IFERROR arguments |
| `Footnote` column (IFERROR with conditional expired-status prose) | Parse out the final quoted fallback; split on `;` → structured flags |
| Sparse `CSI MasterFormat` (~0.4% populated) | Port as-is; no synthesis. Infer `division_prefix` from Display Name instead |
| Free-text country strings (`"US & CA"`) | ISO 3166-1 alpha-3 arrays via lookup table (Phase 1.2); log misses |
| Polymorphic `Addn'l factors` + units | Keep as `physical.additional_factor.{value, units, description}`; flag in schema |
| Duplicate `Common Unit: kgCO2e / _` columns (T and AA) | Rename to distinct paths: `carbon.common.per_functional_unit` vs biogenic-local context |
| Whitespace + non-breaking spaces in `EPD ID` values | `.trim()` on import |
| Blank `Material Type` (337 rows) | Infer from Display Name prefix (`"05 | ..."`) or leave for manual review |

---

## 7. Verification

### 7.1 sample.json regression checks

```bash
cd schema
python3 -c "import json; d=json.load(open('sample.json')); assert len(d.keys())==20; print('20 top-level keys ✓')"
python3 -c "import json; d=json.load(open('sample.json')); assert d['carbon']['common']['value_kgco2e']==6.22; print('carbon.common.value_kgco2e=6.22 ✓')"
python3 -c "import json; d=json.load(open('sample.json')); assert d['external_refs']['beam_id']=='LAM011'; print('beam_id=LAM011 ✓')"
python3 -c "import json; d=json.load(open('sample.json')); assert d['provenance']['countries_of_manufacture']==['CAN']; print('ISO alpha-3 ✓')"
```

### 7.2 CSV integrity checks

```bash
cd schema
# Row 1 is header, row 2 is '2c53be', row 545 is LAM011, row 826 is XPS002
python3 -c "
import csv
r = list(csv.reader(open('BEAM Database-DUMP.csv')))
assert r[0][0] == 'ID'
assert r[1][0] == '2c53be'
assert r[544][0] == 'LAM011'
assert r[825][0] == 'XPS002'
print('CSV row alignment ✓')
"
# Raw lines == logical rows (no embedded newlines drift)
python3 -c "
import csv
with open('BEAM Database-DUMP.csv') as f: raw = sum(1 for _ in f)
with open('BEAM Database-DUMP.csv', newline='') as f: logical = sum(1 for _ in csv.reader(f))
assert raw == logical == 826
print(f'raw=logical={raw} ✓')
"
```

### 7.3 Phase 1 acceptance criteria

- [ ] `material.schema.json` validates `sample.json` with zero errors
- [ ] `scripts/beam-csv-to-json.mjs` processes LAM011 and output diff-matches `sample.json` structurally
- [ ] Full batch produces ~825 records across 10-15 per-division files
- [ ] Every emitted record passes JSON Schema validation
- [ ] `materials/index.json` has correct shape (8 fields per entry) and size (<150 KB)
- [ ] Import report identifies all skipped/problem rows by CSV row number
- [ ] Phase 1 PR merges cleanly to `main`; GitHub Pages deploy succeeds

---

## Appendix A — Key values to memorise

| | |
|---|---|
| LAM011 CSV row | `545` |
| LAM011 Stated EPD | `69.96 kgCO2e/m³` |
| LAM011 density | `456 kg/m³` |
| LAM011 thickness | `0.09 m` (3.5") |
| LAM011 units/m² | `11.249` |
| LAM011 conversion factor | `1/11.249 ≈ 0.0889` |
| LAM011 biogenic factor | `0.9897` |
| LAM011 carbon content | `0.5 kgC/kg` |
| LAM011 storage retention | `0.9` |
| LAM011 common GWP | `6.22 kgCO2e per m² at 3.5"` |
| LAM011 full biogenic C | `74.53 kgCO2e` per common unit |
| LAM011 stored biogenic C | `67.08 kgCO2e` per common unit |
| CO2:C molar ratio | `3.67` (= 44/12) |
| First data row | Excel row 2, `2c53be` (Aggregate / NRMCA) |
| Last data row | Excel row 826, `XPS002` |
| Internal blank rows | 424, 425, 427, 428 (preserved per BEAM source) |

## Appendix B — Changelog

- **2026-04-18 `0714485`** — BEAM CSV cleaned (truncated trailing 753 garbage rows, flattened embedded newlines). Excel row ↔ CSV line alignment now guaranteed.
- **2026-04-18 `228eafb`** — Initial schema design package committed: `BEAM Database-DUMP.csv`, `materials.json` (ABCD.EARTH donor), `sample.json`, `schema.md` v1.
