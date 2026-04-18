# BEAMweb — JS port of BEAM / MCE² for the web

> **Workplan + design spec + cold-start handoff for the BEAMweb workstream.** Read section 0 first if you are joining fresh. Sections marked **TBD — user input** are intentionally empty and wait for Andy to describe the source of truth (MCE² workbook tabs and their calc formulas).

---

## 0. Cold-start handoff (read this first)

### Status as of 2026-04-18 (revised, session 2)

- **New workstream.** Branch `beamweb` on both remotes. Doc + CSV reference material seeded; no code yet.
- **Pivot from Phase 3 (standalone material picker).** The picker would have been orphaned from the real consumer. Instead, we build the full app and the picker lands inside it (as inline toggle rows per assembly tab, not a free-text modal — see §2.3).
- **Parent repo dependencies already in place:**
  - BEAM materials catalogue shipped — `schema/materials/*.json`, `schema/materials/index.json` (see [`schema/schema.md`](./schema/schema.md))
  - PDF-Parser exists for area extraction from construction drawings — Summary Table already shows all Key Areas per sheet (volumes coming in Step 10) (see `PDF-Parser/`)
  - Database viewer at [`PDF-Parser/database.html`](./PDF-Parser/database.html) proves the catalogue fetch/render pattern
  - Matrix app at [`PDF-Parser/matrix.html`](./PDF-Parser/matrix.html) proves the multi-app nav shell
- **Reference CSVs in the repo** — [`docs/csv files from BEAM/`](./docs/csv%20files%20from%20BEAM/) contains 5 MCE² (Nov 2023) tab exports: User Input Sheet (269 rows), Footings and Slabs (1260 rows), Foundation Walls (1283 rows), Energy GHG (37 rows), Glossary (56 rows). These confirm the assembly-tab pattern (see §2.3). Full BEAM workbook CSV exports with formulas are pending from Andy (he has the unlocked original).
- **Nav-btn label**: `BEAM` in the shared header (not `BEAMweb`). The `BEAMweb` name stays internal for code/docs to differentiate from the spreadsheet family.

### What BEAMweb is

A browser app that replaces the **MCE² (Material Carbon Emissions Estimator)** and the BEAM (google sheets) spreadsheet applications. Same methodology, same outputs when driven by identical inputs, but:

- Runs in the browser, no Excel required
- Consumes the new BEAM materials JSON database (full ISO 21930 / EN 15804+A2 per-stage impact scope, not just GWP)
- Accepts three input modalities for quantities:
  1. **Manual entry** — user types areas, thicknesses, etc. (mirrors MCE² workbook)
  2. **Excel import** — read an existing MCE² file into state (reuse file-handling patterns from **OBJECTIVE**, ask Andy for that ExcelMapper file when it is time - this comes from Andy's team's energy model app)
  3. **PDF-Parser integration** — polygons measured on drawings flow directly as component areas (PDF Parser already fully functional, and creates summary table of all Key Areas if not yet volumes)
- Persists projects as JSON (shared format with PDF-Parser so one project file covers both tools) - FileHandler needed for Import/Export and full StateManager.js for proper persistence and browser local storage use.
- Deploys alongside PDF-Parser / Matrix / Database on GitHub Pages
- New menu button beside Matrix/Database/BEAM (where BEAM is new button).

### What BEAMweb is NOT

- Not a new calculation *methodology*. BEAM/MCE² is the source of truth; BEAMweb is a port, and is meant to be visually and functionally similar to the spreadsheet tools users know and love.
- Not a material catalogue rewrite. Consumes `schema/materials/` as-is.
- Not tied to Excel. Excel import is a *convenience*, not a dependency. Projects live as JSON. There is no planned excel *export* - this is intended as a one-way convenience only to assist users with transition from the legacy format
- Not a replacement for OBJECTIVE. Operational energy (HOT2000) integration is scoped similarly to MCE² — import/accept, don't re-model.

### Name rationale

**BEAMweb** differentiates this implementation from the BEAM/MCE² spreadsheet families. Used consistently as the product name in UI, docs, and cross-app navigation. Internal code modules can use `beamweb` as the prefix (e.g., `beamweb.html`, `js/beamweb.mjs`, `beamweb.css`).

### Git workflow (same as schema workstream)

1. Feature branch `beamweb` (current). Commit + push to **both** remotes after every meaningful change.
2. When ready to deploy: PR on `arossti/OpenBuilding` → user merges → GitHub Pages auto-deploys from `main`.
3. Never push to `main` directly. Never force-push. Never skip hooks.
4. Commit messages via `git commit --file=- <<'MSG'` heredocs. Avoid apostrophes in messages.

---

## 1. Goals

1. Produce the same EC totals as MCE² for the same inputs (regression-test against a reference MCE² workbook).
2. Extend output with the full per-stage impact breakdown the new JSON database supports (once EPD parser fills `impacts.*.by_stage`).
3. Let a practitioner get to a total without leaving the browser: drawings → areas → materials → EC.
4. Keep the three input modalities as equal citizens so a practitioner can mix them on one project (some manual, some from PDF, some from imported Excel).
5. Consider a calculation graph for transparent user-auditable review of calculation dependencies and smart sequencing of dynamic totals updates.

---

## 2. Reference source — the BEAM and MCE² spreadsheets

**Source of truth: BEAM** (Google Sheets, unlocked, full formulas). **Reference only: MCE²** (Excel, Nov 2023 NRCan release, locked). BEAM is newer and contains all the calc logic; MCE² is a derivative we already have CSVs for and use to sketch the general pattern. Once Andy exports BEAM tabs to CSV with formulas, those become the port's source of truth.

### 2.1 Tab list — authoritative (BEAM)

The following list is what BEAMweb emulates. Order and names follow the BEAM workbook exactly:

1. `Introduction`
2. `PROJECT` — primary project intake (meta, HOT2000 import, energy, derived totals, unit conversions)
3. `Footings & Slabs`
4. `Foundation Walls`
5. `Structural Elements`
6. `Exterior Walls`
7. `Party Walls`
8. `Cladding`
9. `Windows`
10. `Interior Walls`
11. `Floors`
12. `Ceilings`
13. `Roof`
14. `Garage`
15. `REVIEW`
16. `RESULTS`
17. `Glossary`
18. `Energy GHG` — not in BEAM today; optional add (province-by-province grid intensities). Decide during Phase 3.

Tab classification (first pass — confirm when BEAM CSVs arrive):
- **User-intake tabs**: `Introduction`, `PROJECT`, all assembly tabs (`Footings & Slabs` → `Garage`)
- **Derived / read-only**: `REVIEW`, `RESULTS`
- **Reference / lookup**: `Glossary`, `Energy GHG`

MCE² diverges with extra tabs not in BEAM: `Cover_Couverture`, `License`, `USER INPUT SHEET` (= BEAM's `PROJECT`), `Ext. Wall Systems`, `User Defined`, `SCENARIOS`. These are **not ports targets** unless BEAM adopts them later.

For each assembly tab, when populating §4, capture:
- Purpose (what does this tab represent in the EC model?)
- User inputs (quantities, section-level config like R-value / thickness / spacing)
- Materials referenced (inline list per tab — see §2.3)
- Output that feeds the project total
- Andy: each tab generally follows a similar structure; samples on request.

### 2.2 PROJECT tab — observed fields (from MCE² screenshot; BEAM equivalent expected similar)

Header:
- Import project data from HOT2000 (operational energy source)
- Project information: Address, Province, City, Postal code, Building Type, Storeys, Year Built, Heated Floor Area (above + below grade, m²), Heating Degree Days, File ID / name, Evaluation date
- Energy consumption: Elec. kWh/yr, N. Gas m³/yr, Propane L/yr, Oil L/yr, Wood kg/yr; Elec. generation (on-site)
- Derived: Operational Emissions (tonnes CO₂e / yr and t CO₂e / 30 yrs), Material Emissions (tonnes CO₂e and kg CO₂e / m²)

Project Dimensions (area / volume inputs):
- Footings, Pads & Piers — volume m³ (length × depth × width helper)
- Foundation wall area (m²)
- Foundation slab / floor area (m²)
- Exterior wall area (m²)
- Window area (m²)
- Interior wall area (m²) — cladding doubled client-side note in workbook
- Framed floor area (m²)
- Ceiling area (m²)
- Roofing area (m²)
- Roof insulation area (m²)
- Heavy timber elements (m³) — volume calculator widget: m × mm × mm → m³
- Party wall area (m²)
- (off-screen: garage items mentioned in workbook legend)

Unit conversion widget (top-right):
- Volume: m³ ↔ ft³
- Area: m² ↔ ft²
- Length: m ↔ ft

### 2.3 Assembly-tab pattern (confirmed from MCE² CSVs — BEAM expected similar)

**This is the architectural cornerstone** — the picker isn't a modal; it's inline toggle rows in every tab.

Observed shape from `docs/csv files from BEAM/Footings and Slabs.csv` (1260 rows) and `Foundation Walls.csv` (1283 rows):

```
SECTION N ➜ COMPONENT MATERIALS FOR <ASSEMBLY NAME>

INSTRUCTIONS: …

Table header row:
  CATEGORY | MATERIAL | QUANTITY | % | SELECT | NET kgCO2e EMISSIONS |
  SELECTED MATERIAL kgCO2e CONTENT | kgCO2e EMISSIONS

Sub-category header:              e.g. "CRUSHED STONE BASE"
Section-level config row:         e.g. THICKNESS = ___ in = 0.00 m
Sub-sub-category:                 e.g. "AGGREGATE"
Descriptive note:                 e.g. "If you do not know ..."

One row per candidate material:   (many rows — MCE² Foundation Walls has ~1000)
  Aggregate / Kangley Rock / … / Avg construction aggregate
    quantity=0.0 m²   %=100%   SELECT=☐   net=0   content=0   emissions=0

… next sub-category with its own section-level config row …
… tab subtotal at top of the MATERIAL kgCO2e column …
```

**Key properties:**
1. Each tab **pre-curates** the subset of BEAM materials relevant to that assembly. Users don't browse all 821; the tab only lists the ones BEAM/NRCan curated for, e.g., "materials you might use in a footing".
2. User enters QUANTITY in the assembly's unit (m², m³) and flips SELECT=1 on each material they want in the build.
3. Shared section config (THICKNESS, R-value, framing spacing, etc.) sits at the top of each sub-category and feeds the per-row calc.
4. `%` column lets user mix multiple materials within a category (e.g., 60% Cedar + 40% Pine in siding).
5. Expired-EPD rows are flagged with the word "Expired YYYY" in a trailing column (visible in both MCE² CSVs). BEAMweb already has `epd.expiry_date` from the JSON DB — surface this as a visual warning on the row.
6. The tab subtotal at the top of the kgCO2e column rolls up into the project total shown on the PROJECT tab.

**Implications for BEAMweb:**
- Per-tab material list is a **subset selector** applied to `schema/materials/index.json`. Simplest implementation: each tab's JS module declares which BEAM `material_type` values + `product_subtype` values + explicit `beam_id` overrides belong to it. When the BEAM CSVs arrive, this mapping is extracted directly from the CSV rows.
- The "picker" UI that was going to be Phase 3 becomes: filter the tab's row list client-side (optional search box on the tab), not a modal.
- Material DB stays the single source of truth; assembly tabs only reference by `id`.
- Section-level config (thickness, R-value) becomes **per-sub-category state** in the project JSON — one level above per-row state.

---

## 3. Input modalities

### 3.1 Manual entry

- Mirror the MCE² form layout (tabs, input fields, formatting).
- Inputs validated on blur, totals recomputed live.
- Blank / null fields are allowed; the model just doesn't count them toward the total.

### 3.2 Excel import — reuse OBJECTIVE patterns

- Expected: `.xlsx` files matching the MCE² template.
- Reader walks a known sheet+cell map and populates project state.
- Pattern borrowed from OBJECTIVE. **TBD — Andy to point at specific modules** (or lift them once BEAMweb has a home on disk).
- Fallback behaviour for mismatched templates (different versions, user-edited sheet names) — **TBD** (warn and skip? reject? best-effort fill?).

### 3.3 PDF-Parser polygon integration

- PDF-Parser exports polygon measurements as JSON with area_m2 (already built) + depth_m (Step 10 volumetric takeoff, in progress).
- Each polygon optionally carries a material reference by `id` (what Phase 3 of the schema plan was going to deliver — now lands inside BEAMweb).
- BEAMweb maps polygons to MCE² components. E.g.:
  - All polygons tagged `wall_exterior` → sum into `Exterior wall area`
  - All polygons tagged `roof` → sum into `Roofing area`
  - Heavy timber volumes are added directly (polygon area × depth)
- Mapping rule is authored once in BEAMweb — **TBD** if this is a per-polygon tag at measurement time in PDF-Parser, or inferred by BEAMweb at import time.

---

## 4. Calculation approach — partial (confirmed from MCE² CSVs, pending BEAM formulas)

### 4.1 What we know from MCE² CSVs

The per-row calc in each assembly tab follows this shape (inferred from column headers; exact formulas await BEAM export):

```
per row (one candidate material):
  SELECTED kgCO2e CONTENT  =  material.carbon.common.value_kgco2e
                              × section_config (e.g. thickness, R-value)
                              × row.%                (user-entered mix ratio)

  NET kgCO2e EMISSIONS     =  SELECTED × SELECT flag (0 or 1)
                              × row.QUANTITY (m² or m³)

  displayed kgCO2e         =  NET × any component-specific multiplier
                              (e.g. interior wall cladding ×2 per MCE² note)

section subtotal           =  Σ displayed kgCO2e across all rows in the tab
project material total     =  Σ subtotals across all assembly tabs
```

The column labels in MCE² confirm this chain:
- `SELECTED MATERIAL kgCO2e CONTENT` — per-functional-unit intensity, after section-config multipliers
- `NET kgCO2e EMISSIONS` — per-row result after QUANTITY and SELECT
- `kgCO2e EMISSIONS` — final column, likely after any tab-level conditional rules

### 4.2 Open items awaiting BEAM CSVs

- Exact formulas per column (we know the *shape*; we need the *multipliers*).
- How section-config (thickness, R-value, framing spacing) composes with the material's native `functional_unit` (e.g. "m² at 3.5 inch" for CLT — does BEAM scale to user-entered thickness or expect the functional unit to match?).
- The `kgCO2e EMISSIONS` → `NET kgCO2e EMISSIONS` transformation on a few tabs (interior wall cladding doubling is mentioned in MCE² hints).
- Any lookup-chain dependencies between tabs (e.g. does `Exterior Walls` pull summary rows from `Cladding`?).
- The `REVIEW` / `RESULTS` tab formulas that aggregate everything.
- Garage exclusion rule — MCE² says "Exclude any garage quantities" on the user input sheet; need to see if BEAM handles this via a switch, a separate tab, or guidance only.

### 4.3 Port approach

Once BEAM CSVs with formulas land:
1. Extract the per-tab curated material list (rows with a `material` column populated) — emit as `PDF-Parser/js/beamweb/tabs/<tab>-materials.json` (cross-ref by `beam_id` to `schema/materials/index.json`).
2. Extract the per-row formula for `SELECTED kgCO2e CONTENT`, `NET kgCO2e EMISSIONS`, etc. — port to a pure JS function per tab in `calc.mjs`.
3. Extract section-config defaults from the workbook — wire as placeholders in the tab's form.
4. Regression-test each tab with canonical input against the BEAM workbook output.

### 4.4 Calculation graph consideration (goal 5)

Since the graph is goal 5, design the calc layer as pure functions with declared inputs so a future dependency-graph wrapper can replay them in topological order. Concretely:

```js
// each calc function declares what it reads and what it produces
function ftg_slabs_row(row, section_config, material) {
  // inputs → outputs, no hidden state
  return { selected_kgco2e_content, net_kgco2e_emissions, ... };
}
```

A thin graph layer on top later tracks `row → section → tab → project` dependencies and only recomputes what changed. Defers to OBJECTIVE's graph conventions when that comes in — see [`schema/schema.md`](./schema/schema.md#appendix-a1--future-project-level-calculation-graph) Appendix A1 stub.

---

## 5. Architecture sketch (decisions locked in session 2)

Mirroring PDF-Parser + Database viewer conventions for BEAMweb's own code, with OBJECTIVE-inspired shared infra:

- **Tech stack**: vanilla JS **ES modules** (matches PDF-Parser / Database). Bootstrap 5.1.3 CSS+JS loaded only by BEAMweb (for modals / dropdowns / tabs — matches OBJECTIVE's UX). SheetJS (`xlsx@0.18.5`) loaded as a classic `<script>` tag since it attaches to `window.XLSX`. No build step.
- **Namespace**: `window.BEAM.*` (mirrors OBJECTIVE's `window.TEUI.*` so algorithms port directly).
- **Dependency manifest**: [`PDF-Parser/dependencies.html`](./PDF-Parser/dependencies.html) — central registry of every CDN + version pin + per-app usage matrix. Live load probes. Not nav-linked (dev-only).
- **OBJECTIVE reuse strategy**: Architecture patterns (3-tier reset, dual-state Target/Reference, section modules, `data-render-section`, `saveStateAndNavigate` cross-app nav) ported by reading OBJECTIVE's code. Files NOT copied verbatim — rewritten as ESM under `PDF-Parser/js/beam/` with matching API shape so convergence stays cheap.
- **File layout** (proposed):
  ```
  BEAMweb/                          or PDF-Parser/beamweb.html + sibling assets
  ├── beamweb.html                  Shell page with tab nav + assembly sub-pages
  ├── beamweb.css                   Dark theme, extends bfcastyles + pdfparser
  ├── js/
  │   ├── beamweb.mjs               App entry, boot, router
  │   ├── state.mjs                 Project state + change events
  │   ├── calc.mjs                  Pure calc functions, one per component
  │   ├── excel.mjs                 xlsx reader/writer (OBJECTIVE-derived)
  │   ├── tabs/
  │   │   ├── user-input.mjs
  │   │   ├── footings-slabs.mjs
  │   │   ├── foundation-walls.mjs
  │   │   └── ...                   one per MCE² assembly tab
  │   └── material-picker.mjs       modal/panel, reuses schema/materials/
  └── data/ or fetch from ../schema/materials/
  ```
- **Shared infra to extract** (user flagged: "We will need to update/enhance or create a filehandler and statemanager files, which I do not think we have explicitly created yet"):
  - `shared/filehandler.mjs` — open/save/import JSON + xlsx; used by both PDF-Parser and BEAMweb
  - `shared/statemanager.mjs` — project state, change events, undo (?). Both apps can read each other's project JSON.

### 5.1 Project file shape (draft)

A single JSON project file carries everything. Cross-app shape so PDF-Parser and BEAMweb edit the same file.

```json
{
  "$schema": "https://bfca.ca/schemas/project-v1.json",
  "schema_version": 1,
  "id": "project-slug-or-uuid",
  "created_at": "ISO date",
  "modified_at": "ISO date",
  "meta": {
    "address": "...", "province": "...", "building_type": "...",
    "heated_floor_area_m2_above_grade": 120,
    "heated_floor_area_m2_below_grade": 80,
    "heating_degree_days": 4500,
    "year_built": 2026
  },
  "energy": {
    "source": "hot2000 | manual",
    "electricity_kwh_yr": 0,
    "nat_gas_m3_yr": 0,
    "propane_l_yr": 0,
    "oil_l_yr": 0,
    "wood_kg_yr": 0,
    "elec_generation_kwh_yr": 0
  },
  "components": {
    "footings_pads_piers": { "volume_m3": 0, "material_ref": "lam011", ... },
    "foundation_wall":     { "area_m2": 0, ... },
    "exterior_wall":       { "area_m2": 0, "assembly_ref": "...", ... },
    "windows":             { "area_m2": 0 },
    "interior_wall":       { "area_m2": 0 },
    "framed_floor":        { "area_m2": 0 },
    "ceiling":             { "area_m2": 0 },
    "roofing":             { "area_m2": 0 },
    "roof_insulation":     { "area_m2": 0 },
    "heavy_timber":        { "volume_m3": 0 },
    "party_wall":          { "area_m2": 0 }
  },
  "assemblies": {
    "ext_wall_systems": [ /* array of assembly templates the user defined */ ]
  },
  "pdf_parser": {
    "polygons": [ /* direct import from PDF-Parser; used to populate components.*.area_m2 */ ],
    "linked_file": "path/to/original.pdf"
  },
  "results": {
    "material_emissions_kgco2e": 0,
    "operational_emissions_kgco2e_yr": 0,
    "operational_emissions_kgco2e_30yr": 0,
    "material_emissions_kgco2e_per_m2_hfa": 0,
    "by_component": { /* component → kgCO2e breakdown */ }
  }
}
```

Everything here is **a strawman** — revise freely once section 4 is filled in.

---

## 6. Phase breakdown (revised)

Small, independently-shippable slices:

1. **Phase 0 — Design lock-in + shared dependency manifest + shell stub** (current). Document tabs and pattern (mostly done), build the dependency manifest page (see `PDF-Parser/dependencies.html`), scaffold `beamweb.html` with the 17 BEAM tabs in a sidebar + stubbed tab pages. No calc, no state — just navigation shell + nav-btn wired across existing apps.
2. **Phase 1 — Shared infra**. `shared/filehandler.mjs` (JSON open/save/import, localStorage persistence) + `shared/statemanager.mjs` (project state + change events, dirty-flag propagation for the eventual calc graph). Both consumed by PDF-Parser (refactor) and BEAMweb (fresh).
3. **Phase 2 — PROJECT tab**. Meta, energy fields, dimension fields, derived totals shell (no per-tab calcs yet — totals just sum whatever tabs produce). Unit conversion widget.
4. **Phase 3 — First assembly tab end-to-end**. Candidate: `Footings & Slabs` (simplest geometry) or `Exterior Walls` (most representative — lots of shared infra). Pick after BEAM CSVs arrive. This phase establishes the per-row calc pattern, regression-tests against BEAM workbook output with a canonical project, and locks the per-tab module shape.
5. **Phase 4 — Remaining assembly tabs in parallel**. Each follows the Phase 3 pattern. 15 tabs × ~1 day each → 3 weeks of focused work.
6. **Phase 5 — REVIEW + RESULTS + reports**. Aggregation tabs, print view, CSV export of results (not export back to Excel — one-way only per §0).
7. **Phase 6 — Excel import (reuse OBJECTIVE ExcelMapper)**. Read an MCE² or BEAM workbook into the project state. Round-trip test: import, export to JSON, re-open, numbers match within rounding tolerance.
8. **Phase 7 — HOT2000 `.h2k` import**. Manual entry works from Phase 2; HOT2000 file import added here if feasible.
9. **Phase 8 — PDF-Parser integration**. Polygon → assembly tab mapping UI. Shared project JSON. Live area totals.
10. **Phase 9 — Calculation graph layer** (goal 5). Pure calc functions from Phases 3–5 wrapped in a dependency graph for topological replay on change. OBJECTIVE graph conventions consulted.

---

## 7. Open questions (revised status)

### Answered or partly answered

- ✅ **Q1 (tab inventory)** — use the BEAM list, 17 tabs + Energy GHG optional (see §2.1).
- 🟡 **Q2 (user-facing vs derived vs lookup)** — first-pass classification in §2.1 (user intake = Introduction/PROJECT/assembly tabs; derived = REVIEW/RESULTS; lookup = Glossary/Energy GHG). Confirm when BEAM CSVs arrive.
- 🟡 **Q4 (material reference encoding)** — assembly tabs pre-curate a subset of BEAM materials as inline rows (see §2.3). Likely resolved by `beam_id` once CSVs come with formulas; confirm.
- 🟡 **Q5 (per-m² vs mass-based)** — MCE² column labels indicate per-functional-unit intensity × section-config × quantity (see §4.1). Confirm formulas from BEAM.
- ✅ **Q9 (Excel import scope)** — `.xlsx` only (Excel import is a one-way convenience for transition from legacy; no export planned — §0 NOT list).
- ✅ **Q15 (tab UX)** — mirror the spreadsheet visually and functionally, "so users know and love it" (per §0 edit). Tab sidebar + per-tab pages.
- ✅ **Q17 (Pages site)** — yes, same Pages site; `beamweb.html` deploys alongside existing apps.
- ✅ **Q18 (nav-btn)** — yes, labelled `BEAM` in the shared nav (not `BEAMweb`).

### Still open

**Calculation (blocked on BEAM CSV exports):**
- Q3: Hidden/locked sheets in BEAM? (Andy has unlocked version — probably no issue.)
- Q6: Waste factors — baked into material records, applied at component level, or both?
- Q7: Garage-exclusion rule — separate tab (per BEAM tab list: `Garage` is its own tab), switch, or guidance?
- Q7a **NEW** — Section-config unit normalisation: when a material's `functional_unit` is "m² at 3.5 inch" (CLT), does BEAM scale when the user enters a different thickness, or does it expect the functional unit to match the section config?
- Q7b **NEW** — Multi-tab lookup chains (does `Exterior Walls` pull summary rows from `Cladding`?).

**Input modalities:**
- Q8: OBJECTIVE file-io modules to reuse — Andy will provide ExcelMapper when it is time (per §0 edit). Not needed until Phase 5.
- Q10: HOT2000 `.h2k` parsing — is there a library, or a fixed subset to parse? How deep does the spreadsheet integrate today?

**Integration:**
- Q11: Polygon → component mapping — assigned in PDF-Parser at measurement time (polygon carries `component: "wall_exterior"`), or inferred in BEAMweb from `typical_elements`?
- Q12: Can two projects share polygons (cross-project material reuse), or is each project self-contained?
- Q13: Does BEAMweb need read access to a completed BEAM workbook (full operational+material), or only MCE²-equivalent subset?

**App location:**
- Q14: On disk — sibling of PDF-Parser as `PDF-Parser/beamweb.html` (simplest, same Pages bundle, reuses bfcastyles + pdfparser CSS)? Or new top-level `BEAMweb/` directory? **Leaning toward co-locating in `PDF-Parser/`** unless you want a clean split. Answer before stub lands.

**Units:**
- Q16: Units — user-selectable metric/imperial toggle (MCE² has both widgets), or metric primary with on-row conversion?

---

## 8. Relationship to sibling workstreams

| Workstream | How BEAMweb uses it | How BEAMweb affects it |
|---|---|---|
| **schema/** (materials JSON DB) | Read-only consumer. `materials/index.json` for the picker; lazy-fetches per-division files for full records. | None direct; may surface new fields BEAMweb needs, which get added to the schema and `sample.json`. |
| **PDF-Parser** | Reads polygon → area / volume data from a shared project JSON. | Will need polygons to carry a material reference + component tag. That's shared work — land it in PDF-Parser's Step 10. |
| **Database viewer** | Could become the picker UI inside BEAMweb (reused as a modal). | No change. |
| **Matrix** | Independent. Linked from the shared nav only. | No change. |
| **OBJECTIVE** | Lift file-handling patterns (xlsx read/write). | None — we only borrow conventions. |
| **EPD PDF parser** (Phase 2 of schema) | When it lands, it fills `impacts.*.by_stage` on material records. BEAMweb will auto-get per-stage totals. | No direct coupling. |

---

## Appendix — Branch + repo state at spin-up

- Branch: `beamweb` on both remotes (commit `8321204`, same tip as `main`)
- No code yet — this document only
- Sibling apps all on `main`: PDF-Parser, Matrix, Database viewer; shipped and deployed

---

## Appendix — Changelog

- **2026-04-18 (session 2)** — Doc revised after Andy's review. Tab list resolved (BEAM authoritative, 17 tabs + Energy GHG optional); nav-btn label set to `BEAM`. Section 2.3 added — assembly-tab pattern discovered from MCE² CSVs in `docs/csv files from BEAM/` (inline material toggle rows per tab, pre-curated subset of the 821-material DB, per-row SELECT+QUANTITY+%, section-level config like thickness/R-value). Section 4 populated with calc shape inferred from MCE² column labels; exact formulas await BEAM CSV exports from Andy's unlocked workbook. Section 7 open-questions re-triaged with answers/partials. Phase breakdown revised (10 phases). Goal 5 added — calculation graph consideration.
- **2026-04-18 (session 1)** — BEAMweb workstream spun up. Document seeded with scaffold + open questions. Schema Phase 3 (standalone material picker) explicitly subsumed: the picker becomes inline toggles inside BEAMweb assembly tabs rather than a PDF-Parser feature.
