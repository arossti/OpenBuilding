# BfCA Materials Database — Workplan & Schema Specification

> **This document is the canonical plan AND the design spec AND a cold-start handoff for new agents picking up the work.** Read the Cold-Start section first if you're joining fresh.

---

## 0. Cold-start handoff (read this first)

### Status as of 2026-04-18 (revised, session 2 — Phase 1 complete)

- **Design**: locked in — 20 top-level blocks, **`impacts` expanded to heavy per-stage structure (10 categories × 17 EN 15804+A2 stages, 340 impact slots/record)**, snake_case, schema-complete/nullable
- **Sample record**: current at [`schema/sample.json`](./sample.json) — BEAM `LAM011` (Nordic X-Lam CLT 3½"), `id = "lam011"` (lowercased BEAM ID), `external_refs.beam_id = "LAM011"`
- **Source data**: cleaned & committed at [`docs/csv files from BEAM/BEAM Database-DUMP.csv`](../docs/csv%20files%20from%20BEAM/BEAM%20Database-DUMP.csv) — 826 lines (1 header + 825 data rows), Excel-row ↔ CSV-line alignment verified. (Lives under `docs/` with all other BEAM reference exports; the importer's `CSV_PATH` resolves there.)
- **Formal validator**: [`schema/material.schema.json`](./material.schema.json) — JSON Schema Draft 2020-12, full 20-block coverage with enums and per-stage impact_block `$def`. Zero-dep Node walker at `scripts/validate.mjs`.
- **Importer**: [`schema/scripts/beam-csv-to-json.mjs`](./scripts/beam-csv-to-json.mjs) — single-row + batch modes, RFC-4180 parser, recursive arithmetic formula evaluator, IFERROR fallback extraction, country/CSI/element inference via lookups.
- **Batch output**: [`schema/materials/`](./materials) — 821 records across 8 CSI divisions (03/04/05/06/07/08/09/31), `index.json` picker catalogue, `import-report.json` manual-review flags.
- **Lookups**: [`schema/lookups/`](./lookups) — country-codes, csi-divisions, material-type-to-csi, display-name-keywords, typical-elements, lifecycle-stages.
- **Branch**: `schema` on both remotes (`origin` = bfca-labs/at, `openbuilding` = arossti/OpenBuilding)
- **Last commit at time of writing**: `f82094c` — Phase 1.5 Database viewer + detail-pane clip fix.
- **Phase 1 status**: All technical acceptance criteria met. PR ready to open on `arossti/OpenBuilding`.
- **Phase 1.5 status**: Database viewer shipped — stakeholder-facing tabular browser at `PDF-Parser/database.html`, proves the catalogue consumption pattern and will become live on Pages once the PR merges.
- **Next phase**: Phase 3 (PDF-Parser material picker) is unblocked and recommended next. Phase 2 (EPD PDF parser) waits on a sample EPD PDF from the user.

### Recommended next action

**Phase 1 + 1.5 shipped and merged to `main`.** Active workstream has pivoted to [`BEAMweb.md`](../BEAMweb.md) at repo root — a full JS port of the BEAM (Google Sheets) embodied-carbon calculator that will eventually consume this schema directly. The originally-planned Phase 3 standalone material picker has been folded into BEAMweb as one of its UI components.

**Parity-then-migrate plan (locked 2026-04-18 session 3).** BEAMweb first ships matching the BEAM workbook's per-row emissions values exactly — using the precomputed NET/GROSS columns baked into the Google Sheet, not the full materials JSON DB. This keeps the initial port low-risk: same inputs produce the same outputs, which is the bar the BfCA team needs to clear before endorsing a web replacement for a tool their users already trust.

Once BfCA validates functional parity against the gSheet on a canonical project, BEAMweb switches over to consuming [`schema/materials/`](./materials) directly. That migration is the moment BEAMweb stops being a spreadsheet port and becomes a more capable tool: the 10 impact categories × 17 EN 15804+A2 stages this schema already carries become surfaceable in BEAMweb's REVIEW / RESULTS tabs, even though the BEAM workbook only reports GWP. EPDs authored by the Phase 2 parser flow in the same way. Until parity is validated, the schema stays stable and the DB sits ready but unconnected from the live app.

Schema work resumes when:
- The EPD parser (Phase 2) is ready to populate `impacts.*.by_stage` slots — blocked on a sample EPD PDF from the user.
- BEAMweb clears the parity gate and we wire the DB into its calc engine (Phase 4 in BEAMweb's plan; promotes this schema from "reference" to "runtime consumer").
- IFC interop (Phase 5), Canadian context extensions (Phase 6), or schema PDF deliverable (Phase 7) are prioritised.

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
| `schema/sample.json` | Canonical full-template reference record (LAM011 CLT, schema-complete) |
| `docs/csv files from BEAM/BEAM Database-DUMP.csv` | Cleaned BEAM source data — 826 lines, Excel row = CSV line. Consumed by `schema/scripts/beam-csv-to-json.mjs` (hardcoded `CSV_PATH`). |
| `schema/materials.json` | Pre-existing ABCD.EARTH schema — donor of rendering hints only |
| `schema/material.schema.json` | ✅ JSON Schema Draft 2020-12 validator |
| `schema/lookups/*.json` | ✅ 6 files — country-codes, csi-divisions, material-type-to-csi, display-name-keywords, typical-elements, lifecycle-stages |
| `schema/scripts/beam-csv-to-json.mjs` | ✅ Node ESM importer (single-row + batch modes, formula evaluator, IFERROR extractor) |
| `schema/scripts/validate.mjs` | ✅ Zero-dep Node walker for `material.schema.json` |
| `schema/materials/index.json` | ✅ Lightweight picker catalogue (821 entries × 8 fields, ~290 KB pretty) |
| `schema/materials/NN-<slug>.json` | ✅ Per-CSI-division sparse records (8 files: 03–09, 31) |
| `schema/materials/import-report.json` | ✅ Manual-review flags (unresolved divisions, blank IDs) |
| `PDF-Parser/database.html` | ✅ Phase 1.5 — stakeholder viewer for the full catalogue |
| `PDF-Parser/database.css` | ✅ Database viewer styles (dark theme, extends bfcastyles + pdfparser) |
| `PDF-Parser/js/database.mjs` | ✅ Database viewer logic (sortable table, lazy per-division fetch, expandable detail with full per-stage matrix) |

### Known gotchas / lossy-import hazards

See §6.2 for full table. Headline items:
- **Excel date serials** are mixed with year-integers in the same column. Rule: if `n < 3000` → year; else Excel serial (epoch 1899-12-30).
- **Formula cells** survive in the CSV as literal formula strings (e.g., `=Q545/11.249`, `=IFERROR(DUMMYFUNCTION("..."), "fallback")`). The importer must either evaluate against the referenced columns in the same row or extract the IFERROR fallback string.
- **Country codes** are free-text (`"US & CA"`, `"CAN"`) → must map to ISO 3166-1 alpha-3 arrays.
- **Column AA and AC misplaced values** — BEAM's sheet has some column labels placed in data rows (e.g., LAM011 col AC = `"m2 at 3.5\""` instead of a number). Detect & null.
- **337 rows have blank `Material Type`** — display-name CSI prefixes (`"05 | ..."`) do **not** exist in the cleaned CSV (verified session 2, 0 of 825 rows). Derive division from keyword scan of `Display Name` (e.g., `"Cedar Siding"` → 06, `"Brick, Clay"` → 04, `"Concrete"` → 03). Fallback to `null` with a manual-review flag in the import report.
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
# CSV Excel-row correspondence (source CSV now lives under docs/)
python3 -c "import csv; r=list(csv.reader(open('../docs/csv files from BEAM/BEAM Database-DUMP.csv'))); assert r[1][0]=='2c53be'; assert r[544][0]=='LAM011'; print('OK')"
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
| `docs/csv files from BEAM/BEAM Database-DUMP.csv` | 826 lines / 825 data rows (cleaned) | BEAM's legacy 65-column materials data — primary import. Colocated with the other MCE²/BEAM workbook-tab exports. |
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

### Phase 1 — JSON database port — Complete ✅

**Goal**: Emit the full catalogue as validated per-CSI-division JSON files + a lightweight index. This unblocks all downstream work.

- [x] **`schema/material.schema.json`** — JSON Schema Draft 2020-12 validator with `impact_block` / `impact_value` `$defs`. Relaxed to sparse-aware (scalar leaves optional, structural blocks required, `additionalProperties:false` everywhere; enums/patterns/types enforced).
- [x] **`schema/lookups/country-codes.json`** — 21 BEAM free-text values → ISO 3166-1 alpha-3 arrays (incl. `"US & CA"` → `["USA","CAN"]`, `"EU"`/`"GLB"` retained as scope markers).
- [x] **`schema/lookups/csi-divisions.json`** — 15 MasterFormat 2020 divisions with category slugs.
- [x] **`schema/lookups/material-type-to-csi.json`** — all 90 observed BEAM material types mapped.
- [x] **`schema/lookups/display-name-keywords.json`** — 45 fallback keyword patterns for the 337 blank-material-type rows (no unresolved rows after full scan).
- [x] **`schema/lookups/typical-elements.json`** — enum + `material_type_defaults` + `product_subtype_overrides` (CLT, Glulam, LVL, I-joist, OSB).
- [x] **`schema/lookups/lifecycle-stages.json`** — 17 EN 15804+A2 stages with groups + common-scope shortcuts (cradle_to_gate, cradle_to_grave, cradle_to_cradle).
- [x] **`schema/scripts/beam-csv-to-json.mjs`** — Node ESM importer with RFC-4180 parser, recursive arithmetic formula evaluator (handles the AB=AE*AF chain where AE is itself a formula), IFERROR fallback extraction, Excel-serial-vs-year date heuristic, CSI inference via material_type primary + keyword fallback, density dual-unit, biogenic-method derivation, sparse emission via `prune()` + `normalize()`.
- [x] **`schema/materials/NN-<slug>.json`** — 8 files emitted: `03-concrete.json` (205), `04-masonry.json` (42), `05-metals.json` (93), `06-wood.json` (160), `07-thermal.json` (217), `08-openings.json` (16), `09-finishes.json` (83), `31-earthwork.json` (5). Total 821 records.
- [x] **`schema/materials/index.json`** — 8 fields per entry (id, beam_id, display_name, category, division_prefix, typical_elements, gwp_kgco2e, functional_unit). ~290 KB pretty.
- [x] **Validation**: 822/822 records pass (`node scripts/validate.mjs --all`).
- [x] **Sparse-by-default**: per-record 13 KB → 4 KB (−68%), batch 18 MB → 4.3 MB (−76%), ~1.2 MB gzipped.
- [x] **Deployment gate**: `.github/workflows/deploy-pages.yml` now skips on `bfca-labs/at` (no Pages site), runs only on `arossti/OpenBuilding`.
- [x] **Commit milestone**: PR on `arossti/OpenBuilding` → `main` pending user merge.

### Phase 1.5 — Database viewer — Complete ✅

**Goal**: Interim stakeholder-facing HTML viewer for the full 821-record catalogue so BfCA / NRCan / AIBC can review the schema choices in a real UI before committing further down the pipeline. Lets teams see the empty per-stage slots and understand what the EPD parser (Phase 2) will fill.

- [x] **`PDF-Parser/database.html`** — standalone page, dark theme, reuses `bfcastyles.css` + `pdfparser.css` + new `database.css`. Shared header nav across PDF-Parser / Matrix / Database.
- [x] **Main table**: sortable columns (BEAM ID, Display Name, Division, Material, GWP, functional unit, typical elements), sticky header, live search, division chips with per-division counts, EPD-only toggle.
- [x] **Expanded row detail** (accordion, collapsed by default; Carbon Calc Graph opens by default): Identity & Classification, Manufacturer & Provenance, Physical Properties, Carbon Calc Graph (ASCII flow diagram of BEAM's audit trail), Impacts per-stage matrix, EPD/Methodology/Code Compliance, Raw JSON.
- [x] **Per-stage matrix**: 10 categories × (Total + 17 stages), horizontal scroll, sticky first column + total column, per-cell source tag (beam_derived / epd_direct) for provenance at a glance.
- [x] **Data staging**: `npm run stage:data` in `PDF-Parser/` copies `schema/` outputs into `PDF-Parser/data/schema/`. Pages workflow does the same copy before upload. Staged dir gitignored to avoid doubling ~4 MB of committed data.
- [x] **Local test**: all resources 200 via `npm run serve`; Node syntax clean; 821 entries load.

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

- Prerequisite: Phase 1 complete ✅ (`materials/index.json` is shipped).
- Prior art: Phase 1.5 Database viewer proves the fetch + lazy-load + filter pattern works in a dark-theme module within PDF-Parser.
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
| Primary key | `id = lowercase(beam_id)` top-level; `beam_id` preserved case-exact inside `external_refs` | BEAM IDs are already stable, unique, collision-free. Lowercasing keeps URL/path/JSON-key form consistent; the case-exact BEAM ID stays for spreadsheet legacy lookup. JSON DB is not user-facing — display names are. |
| Null vs missing | **Sparse-by-default for per-material records; schema-complete for the canonical template** — `materials/*.json` records emit only populated fields (null scalars and empty sub-objects dropped). `sample.json` and `material.schema.json` carry the full template structure as the human/machine reference. Consumers use `?.` + nullish coalescing. EPD parser (Phase 2) consults the template to know what fields to probe for, then emits only what it finds. | Per-record size drops ~70% (13 KB → 4 KB), batch 18 MB → 4.3 MB, files become readable. The old "schema-complete everywhere" principle made diffs verbose (`null → value`) and turned per-stage impact blocks into 170-null walls per record. Sparse makes presence semantic: a stage key appears when the EPD reports it. |
| Structural preservation rules | **Arrays always present** (`[]` when empty — preserves `.forEach` safety). **15 top-level object blocks always present** (`{}` when empty — consumers can traverse the outer shape without existence checks). **`impacts.<category>.total` always present as `{value, source}`** (consumers find the aggregate slot by name). **`impacts.<category>.by_stage` always present** (may be empty `{}`). Everything else omittable. | Balances sparsity with safe traversal. Preserves the outer shape that loops expect, trims the inner noise. |
| Arrays | Always `[]` when empty, never `null` | `.forEach` safe |
| Unit convention | **Unit in field name** (`density_kg_m3`, `gwp_kgco2e`) | Self-documenting; survives flattening to CSV/BigQuery |
| Variable-unit fields | Paired `functional_unit` string (e.g., `carbon.common.per_functional_unit`) | BEAM's "common unit" is per-material (m², m³, kg, linear m) — can't bake into field name |
| `carbon` vs `impacts` | **Separate blocks** | `carbon` preserves BEAM's audit trail (stated → conversion → common → biogenic, flat); `impacts` is the harmonised wbLCA view with full ISO per-stage breakdown |
| `impacts` lifecycle scope | **Heavy** — each category carries `total` + `by_stage` object covering all 17 EN 15804+A2 stages (A1–A5, B1–B7, C1–C4, D), every stage a `{value, source}` pair | BEAM.js is a richer app than the BEAM spreadsheet; future EPDs increasingly report A4–D. Schema-complete per-stage slots make EPD parsing a direct table-copy and keep the source discriminator at stage granularity for audit |
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

#### `impacts` — harmonised wbLCA view (heavy, per-stage)
| Field | Type |
|---|---|
| `functional_unit` | str |
| `<category>.total` | `{ value: num, source: enum(epd_direct \| beam_derived \| industry_average \| estimated) }` — aggregate over stages declared in `carbon.stated.lifecycle_stages` |
| `<category>.by_stage.<stage>` | `{ value: num, source: enum(...) }` — one entry per stage in `["A1","A2","A3","A4","A5","B1","B2","B3","B4","B5","B6","B7","C1","C2","C3","C4","D"]` |

Where `<category>` ∈ {`gwp_kgco2e`, `gwp_bio_kgco2e`, `eutrophication_kgneq`, `acidification_kgso2eq`, `ozone_depletion_kgcfc11eq`, `smog_kgo3eq`, `abiotic_depletion_fossil_mj`, `water_consumption_m3`, `primary_energy_nonrenewable_mj`, `primary_energy_renewable_mj`}.

Shape: 10 categories × (1 total + 17 stages) × 2 fields = **340 impact slots** per material record. BEAM imports populate `<category>.total` only; `by_stage` slots stay null until EPD parser (Phase 2) walks the EPD table.

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

#### Size projections (sparse-by-default, schema v1.1)

Measured from committed `materials/*.json` (821 records):

| Metric | Full schema-complete (old) | Sparse (current) | Reduction |
|---|---|---|---|
| Per-record pretty-printed | ~13 KB | ~4 KB | ~68% |
| 821-record batch pretty-printed | 18 MB | 4.3 MB | ~76% |
| `materials/index.json` | 290 KB | 290 KB | 0% (index was always lean) |
| Gzipped batch (estimated) | ~4 MB | ~1.2 MB | ~70% |

Sample.json (the canonical full template) remains schema-complete at ~21 KB because it's documentation, not data.

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
schema/                           As committed in PR
├── material.schema.json          Draft 2020-12 validator (sparse-aware)
├── sample.json                   LAM011 full-template reference (schema-complete)
│   (source CSV moved to docs/csv files from BEAM/BEAM Database-DUMP.csv — see that folder for all BEAM workbook-tab exports)
├── materials.json                ABCD.EARTH donor schema (rendering hints only)
├── schema.md                     This document
├── lookups/                      Enum + inference lookups
│   ├── country-codes.json        21 BEAM free-text → ISO 3166-1 alpha-3 arrays
│   ├── csi-divisions.json        15 MasterFormat 2020 codes + category slugs
│   ├── material-type-to-csi.json 90 BEAM material types → 2-digit CSI prefix
│   ├── display-name-keywords.json 45 fallback patterns (ordered specific-first)
│   ├── typical-elements.json     Enum + material_type defaults + product_subtype overrides
│   └── lifecycle-stages.json     17 EN 15804+A2 stages + common-scope shortcuts
├── scripts/
│   ├── beam-csv-to-json.mjs      Node ESM importer (single-row + batch)
│   └── validate.mjs              Zero-dep JSON Schema walker
└── materials/                    Sparse emitted catalogue (821 records)
    ├── index.json                Picker catalogue (8 fields per entry, ~290 KB)
    ├── import-report.json        Manual-review flags
    ├── 03-concrete.json          205 records (incl. rebar → 03)
    ├── 04-masonry.json            42 records (brick, stone, earth-based)
    ├── 05-metals.json             93 records (steel, aluminum, composite beams)
    ├── 06-wood.json              160 records (CLT, glulam, sheathing, fibre, bamboo)
    ├── 07-thermal.json           217 records (insulation, barriers, roofing, siding)
    ├── 08-openings.json           16 records (double/triple pane, wood+alu frames)
    ├── 09-finishes.json           83 records (gypsum, flooring, carpet, tiles)
    └── 31-earthwork.json           5 records (aggregate, ground screw, ICF webbing)
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
CSV="../docs/csv files from BEAM/BEAM Database-DUMP.csv"
python3 -c "
import csv
r = list(csv.reader(open('$CSV')))
assert r[0][0] == 'ID'
assert r[1][0] == '2c53be'
assert r[544][0] == 'LAM011'
assert r[825][0] == 'XPS002'
print('CSV row alignment ✓')
"
# Raw lines == logical rows (no embedded newlines drift)
python3 -c "
import csv
with open('$CSV') as f: raw = sum(1 for _ in f)
with open('$CSV', newline='') as f: logical = sum(1 for _ in csv.reader(f))
assert raw == logical == 826
print(f'raw=logical={raw} ✓')
"
```

### 7.3 Phase 1 acceptance criteria

- [x] `material.schema.json` validates `sample.json` with zero errors — 1/1 passes
- [x] `scripts/beam-csv-to-json.mjs` processes LAM011 and output diff-matches `sample.json` structurally — 5 documented acceptable diffs (annotations, hand-authored refinements, telemetry)
- [x] Full batch produces 821 records across 8 per-division files (03/04/05/06/07/08/09/31)
- [x] Every emitted record passes JSON Schema validation — 822/822 pass via `node scripts/validate.mjs --all`
- [x] `materials/index.json` has correct shape (8 fields per entry); size is ~290 KB pretty-printed (exceeds the original 150 KB target but acceptable — minify for production delivery if needed)
- [x] Import report identifies all skipped/problem rows by CSV row number
- [ ] Phase 1 PR merges cleanly to `main`; GitHub Pages deploy succeeds — **PR open, user to merge**

### 7.4 Phase 1 verification commands (post-import)

```bash
cd schema

# Full validation: sample.json + every per-division file (822 records)
node scripts/validate.mjs --all

# Single-row regression test: LAM011 round-trip vs sample.json
node scripts/beam-csv-to-json.mjs --row LAM011 --diff

# Batch re-run (should produce identical output to what's committed)
node scripts/beam-csv-to-json.mjs --all --out-dir /tmp/verify-materials

# Compare committed output vs re-run (all records structural match)
diff -r materials /tmp/verify-materials
```

---

## Appendix A1 — Future: project-level calculation graph

**Stub — parked for Phase 4 (BEAM.js app port).**

The per-material schema (this document) captures *intensity* values — kgCO2e per functional unit. A project file needs a *calculation graph* that composes those intensities with quantities to produce a total EC figure:

```
polygon (from PDF-Parser)
   ├─ area_m2                            measured on the drawing
   ├─ depth_m                            user-entered or derived
   ├─ material_ref → materials/XX.json   picked from catalogue
   └─ node type: {wall, floor, roof, opening, …}
        │
        ▼
  volume_m3 = area × depth
        │
        ▼
  mass_kg = volume × density_kg_m3       from material.physical.density
        │
        ▼
  ec_kgco2e = <lookup via material.carbon.common or impacts.gwp_kgco2e.total>
        │
        ▼
  project_total = Σ node.ec + operational + transport + etc.
```

Why a graph (not a flat list):
- **Dependencies propagate** — edit a window polygon's area → net wall area of containing wall updates → wall EC recomputes → project total updates. Same for density, thickness, and material swaps.
- **Provenance chain** — every final number has a traceable lineage back to a polygon, a material record, an EPD. Good for audits, BfCA peer review, and the forthcoming Vancouver QP attestation workflow.
- **What-if analysis** — "swap all studs from #2 SPF to LSL" becomes a single-node substitution; the graph recomputes downstream in O(affected edges).
- **Operational + embodied unification** — the same graph can absorb operational energy results from energy modelling tools and compose them with embodied totals into whole-building lifecycle carbon.

**Prior art to consult** — the team's **OBJECTIVE energy model** app uses a robust dependency graph for operational energy calculations. Before designing the BEAM.js graph, review OBJECTIVE's node model, edge semantics, dirty-flag propagation, and UI conventions. Target: a consistent calc-graph mental model across both tools so a practitioner switching between them doesn't retrain.

**Interop with the material schema** — material records must remain *pure intensity data* (no quantities, no project context). The graph references materials by `id` and multiplies through at evaluation time. Keeping the two concerns separate means:
- Material DB can be versioned independently (new EPDs, corrections, additions)
- A project file is a small JSON of graph nodes + edges + material-id references, not a snapshot of the catalogue
- Two projects using the same material see the same numbers; updating the material cascades to both on next open

Scoping: not a Phase 1 deliverable. Phase 1 ships the intensity-only material records. Phase 3 (PDF-Parser material picker) introduces the first use of material refs in project state. Phase 4 (BEAM.js port) is where the calc graph lands formally.

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

- **2026-04-18 `f82094c`** — Database viewer fix: removed 620px max-height cap on detail pane that clipped the impact matrix at 7 of 10 categories.
- **2026-04-18 `b40ac44`** — Phase 1.5 Database viewer shipped: `PDF-Parser/database.html` + `database.css` + `js/database.mjs`. Sortable + filterable table, expandable row detail with full 10×18 per-stage impact matrix (horizontal scroll), carbon calc graph as ASCII flow diagram, raw JSON inspector. Data staged into `PDF-Parser/data/schema/` via `npm run stage:data` (local) or workflow step (Pages). Nav cross-links added across PDF-Parser / Matrix / Database.
- **2026-04-18 `e66e513`** — CI fix: gated the Pages deploy job to `arossti/OpenBuilding` only (bfca-labs/at is private, no Pages site → 404). Cosmetic failure noise on the private mirror now suppressed.
- **2026-04-18 `009a9c5`** — Sparse-by-default serialization. Per-material records omit null scalar leaves and empty sub-objects. 15 top-level object blocks, `impacts.<category>.total` (as `{value, source}`), `impacts.<category>.by_stage`, and all arrays stay present for safe traversal. Full template structure remains documented in `sample.json` and `material.schema.json`. Size: per-record ~13 KB → ~4 KB, batch 18 MB → 4.3 MB (76% reduction). Validator relaxed (required arrays pruned to structural members only; additionalProperties:false and enums/patterns unchanged); 822/822 records still pass.
- **2026-04-18 `c71ef7d`** — Added `material.schema.json` (JSON Schema Draft 2020-12) and `scripts/validate.mjs` (zero-dep walker).
- **2026-04-18 `6d5a999`** — Phase 1 pipeline shipped: `scripts/beam-csv-to-json.mjs` importer (recursive formula evaluator, IFERROR extractor, CSI inference), 6 lookup files, 821-record batch across 8 CSI divisions, `materials/index.json`, `import-report.json`. `impacts.*` expanded to heavy per-stage structure: each category carries `total` + `by_stage` object over all 17 EN 15804+A2 stages. Top-level `id` changed from display-derived slug to lowercased BEAM ID (`clt_nordic_xlam_3_5in` → `lam011`); `external_refs.beam_id` preserves case-exact. Added Appendix A1 on future project-level calc graph (deferred to Phase 4 / BEAM.js app; defer to OBJECTIVE energy model's graph conventions).
- **2026-04-18 `0489ed5`** — Full workplan + cold-start agent handoff committed.
- **2026-04-18 `0714485`** — BEAM CSV cleaned (truncated trailing 753 garbage rows, flattened embedded newlines). Excel row ↔ CSV line alignment now guaranteed.
- **2026-04-18 `228eafb`** — Initial schema design package committed: `BEAM Database-DUMP.csv`, `materials.json` (ABCD.EARTH donor), `sample.json`, `schema.md` v1.
