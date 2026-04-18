# BEAMweb — JS port of BEAM for the web

> **Workplan + design spec + cold-start handoff for the BEAMweb workstream.** Read section 0 first if you are joining fresh. Sections marked **TBD — user input** are intentionally empty and wait for Andy to describe the source of truth (MCE² workbook tabs and their calc formulas).

---

## 0. Cold-start handoff (read this first)

### Status as of 2026-04-18 (end of session 2)

- **Phase 0 shipped.** Branch `beamweb` on both remotes, 10 commits ahead of `main`. App shell live at [`PDF-Parser/beamweb.html`](./PDF-Parser/beamweb.html) with 18 tabs, Glossary + Energy GHG populated with real data, reference-data module, action bar wired to stubs.
- **Ecosystem restructured** — landing page at `PDF-Parser/index.html`; PDF-Parser app renamed to `pdfparser.html`; single-file CSS (`bfcastyles.css`, ~4100 lines, section/app scoped); cyan accent; dependency manifest with drift detector at `dependencies.html`; BEAM nav-btn added across all apps.
- **IP neutralisation applied** (session 2 commit `8d730ab`) — see the "IP rules" block below. Code and served data are CSI/MCE²-free; Matrix intentionally retains regulatory-program references (legitimate citations).
- **Parent repo dependencies in place:**
  - BEAM materials catalogue — 821 sparse records, 8 material groups, full EN 15804+A2 per-stage scope ([`schema/materials/`](./schema/materials))
  - PDF-Parser — area takeoff, Summary Table with Key Areas per sheet, volumetric in Step 10
  - Database viewer — proves the catalogue fetch/render + lazy-per-group pattern
  - Matrix — proves multi-app nav shell
- **Reference CSVs** — [`docs/csv files from BEAM/`](./docs/csv%20files%20from%20BEAM/) holds informal workbook-tab exports. Full BEAM workbook CSV exports with formulas pending from Andy. **Known hazard: `#NAME?` in unit cells** — see §4.4.
- **Nav-btn label** — `BEAM` in the shared header (not `BEAMweb`). `BEAMweb` is internal only.

### IP rules (enforced 2026-04-18)

- **Do not** introduce `CSI`, `MasterFormat`, or "Division(s)" terminology in any code served by Pages or any data file fetched by an app. The numeric 2-digit prefix convention stays (`03`, `06`, etc.) under the field name `group_prefix`.
- **Do not** position BEAMweb as a port of MCE² or any NRCan / Crown-copyright tool. BEAMweb ports BEAM (BfCA-owned). Historical MCE² references are allowed in this doc's changelog as factual record only.
- **Matrix is the exception** — it's a regulatory-compliance tool that legitimately cites NRCan, EnerGuide, HOT2000, ENERGY STAR, etc. as the programs it documents.
- See `CLAUDE.md` at repo root for the canonical IP rules a future agent should follow.

### What BEAMweb is

A browser app that replaces the BEAM (Google Sheets) embodied carbon spreadsheet. Same methodology, same outputs when driven by identical inputs, but:

- Runs in the browser, no Excel required
- Consumes the new BEAM materials JSON database (full ISO 21930 / EN 15804+A2 per-stage impact scope, not just GWP)
- Accepts three input modalities for quantities:
  1. **Manual entry** — user types areas, thicknesses, etc. (mirrors MCE² workbook)
  2. **Excel import** — read an existing BEAM workbook file into state (reuse file-handling patterns from **OBJECTIVE**, ask Andy for that ExcelMapper file when it is time - this comes from Andy's team's energy model app)
  3. **PDF-Parser integration** — polygons measured on drawings flow directly as component areas (PDF Parser already fully functional, and creates summary table of all Key Areas if not yet volumes)
- Persists projects as JSON (shared format with PDF-Parser so one project file covers both tools) - FileHandler needed for Import/Export and full StateManager.js for proper persistence and browser local storage use.
- Deploys alongside PDF-Parser / Matrix / Database on GitHub Pages
- New menu button beside Matrix/Database/BEAM (where BEAM is new button).

### What BEAMweb is NOT

- Not a new calculation *methodology*. BEAM is the source of truth; BEAMweb is a port, and is meant to be visually and functionally similar to the spreadsheet tools users know and love.
- Not a material catalogue rewrite. Consumes `schema/materials/` as-is.
- Not tied to Excel. Excel import is a *convenience*, not a dependency. Projects live as JSON. There is no planned excel *export* — this is intended as a one-way convenience only to assist users with transition from the legacy format
- Not a replacement for OBJECTIVE. Operational energy (HOT2000) integration is scoped similarly to MCE² — import/accept, don't re-model.

### Name rationale

**BEAMweb** differentiates this implementation from the BEAM spreadsheet family. Used consistently as the product name in UI, docs, and cross-app navigation. Internal code modules can use `beamweb` as the prefix (e.g., `beamweb.html`, `js/beamweb.mjs`, `beamweb.css`).

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

## 2. Reference source — the BEAM spreadsheet

**Source of truth: BEAM** (Google Sheets, unlocked, full formulas). BEAM contains all the calc logic; BEAMweb ports it tab-for-tab once Andy exports the tabs to CSV with formulas.

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
18. `Energy GHG` — not in BEAM; BEAMweb adds it as informational reference. **Shipped in Phase 0** as a read-only table; live at [`beamweb.html#energy-ghg`](./PDF-Parser/beamweb.html#energy-ghg). 13 provinces × 5 fuel factors, sourced from `PDF-Parser/js/beam/reference-data.mjs`.

Tab classification (first pass — confirm when BEAM CSVs arrive):
- **User-intake tabs**: `Introduction`, `PROJECT`, all assembly tabs (`Footings & Slabs` → `Garage`)
- **Derived / read-only**: `REVIEW`, `RESULTS`
- **Reference / lookup**: `Glossary`, `Energy GHG`

Extra tabs from older BEAM-derivative spreadsheets (cover pages, licence, separate user-input sheets, scenario planners) are **not port targets** unless BEAM itself adopts them later.

For each assembly tab, when populating §4, capture:
- Purpose (what does this tab represent in the EC model?)
- User inputs (quantities, section-level config like R-value / thickness / spacing)
- Materials referenced (inline list per tab — see §2.3)
- Output that feeds the project total
- Andy: each tab generally follows a similar structure; samples on request.

### 2.2 PROJECT tab — observed fields (BEAM layout, confirmed when CSVs arrive)

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

### 2.3 Assembly-tab pattern (expected BEAM layout, verified against informal references)

**This is the architectural cornerstone** — the picker isn't a modal; it's inline toggle rows in every tab.

Observed shape from informal references (footings + foundation walls sheets, ~1200 rows each):

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
5. Expired-EPD rows are flagged with the word "Expired YYYY" in a trailing column. BEAMweb already has `epd.expiry_date` from the JSON DB — surface this as a visual warning on the row.
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

- Expected: `.xlsx` files matching the BEAM workbook template.
- Reader walks a known sheet+cell map and populates project state.
- Pattern borrowed from OBJECTIVE. **TBD — Andy to point at specific modules** (or lift them once BEAMweb has a home on disk).
- Fallback behaviour for mismatched templates (different versions, user-edited sheet names) — **TBD** (warn and skip? reject? best-effort fill?).

### 3.3 PDF-Parser polygon integration

- PDF-Parser exports polygon measurements as JSON with area_m2 (already built) + depth_m (Step 10 volumetric takeoff, in progress).
- Each polygon optionally carries a material reference by `id` (what Phase 3 of the schema plan was going to deliver — now lands inside BEAMweb).
- BEAMweb maps polygons to BEAM components. E.g.:
  - All polygons tagged `wall_exterior` → sum into `Exterior wall area`
  - All polygons tagged `roof` → sum into `Roofing area`
  - Heavy timber volumes are added directly (polygon area × depth)
- Mapping rule is authored once in BEAMweb — **TBD** if this is a per-polygon tag at measurement time in PDF-Parser, or inferred by BEAMweb at import time.

---

## 4. Calculation approach — partial (inferred from reference sheets, pending BEAM formula export)

### 4.1 What we know so far

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

The assembly-tab column labels confirm this chain:
- `SELECTED MATERIAL kgCO2e CONTENT` — per-functional-unit intensity, after section-config multipliers
- `NET kgCO2e EMISSIONS` — per-row result after QUANTITY and SELECT
- `kgCO2e EMISSIONS` — final column, likely after any tab-level conditional rules

### 4.2 Open items awaiting BEAM CSV export

- Exact formulas per column (we know the *shape*; we need the *multipliers*).
- How section-config (thickness, R-value, framing spacing) composes with the material's native `functional_unit` (e.g. "m² at 3.5 inch" for CLT — does BEAM scale to user-entered thickness or expect the functional unit to match?).
- The `kgCO2e EMISSIONS` → `NET kgCO2e EMISSIONS` transformation on a few tabs (interior wall cladding is doubled to account for both faces).
- Any lookup-chain dependencies between tabs (e.g. does `Exterior Walls` pull summary rows from `Cladding`?).
- The `REVIEW` / `RESULTS` tab formulas that aggregate everything.
- Garage exclusion rule — reference guidance says to exclude garage quantities from whole-building totals; confirm BEAM handles this via a switch, a separate tab, or guidance only.

### 4.3 Port approach

Once BEAM CSVs with formulas land:
1. Extract the per-tab curated material list (rows with a `material` column populated) — emit as `PDF-Parser/js/beam/tabs/<tab>-materials.json` (cross-ref by `beam_id` to `schema/materials/index.json`).
2. Extract the per-row formula for `SELECTED kgCO2e CONTENT`, `NET kgCO2e EMISSIONS`, etc. — port to a pure JS function per tab in `calc.mjs`.
3. Extract section-config defaults from the workbook — wire as placeholders in the tab's form.
4. Regression-test each tab with canonical input against the BEAM workbook output.

### 4.4 Known CSV-import hazard: `#NAME?` in unit cells

The BEAM workbook uses cross-sheet custom functions to convert unit strings (e.g. "sf" ↔ "sm", "ft" ↔ "m") between imperial/metric display states. When those functions are not resolved by the exporting environment, the CSV drops `#NAME?` into the cell instead of the proper unit token. The importer must:

1. **Detect `#NAME?`** as a known-bad token; do not treat as a literal label.
2. **Infer the unit from context**: the column itself declares the unit family (area ↔ sf/sm, volume ↔ cf/cm, length ↔ ft/m, mass ↔ lb/kg). When the cell content is `#NAME?`, fall back to the column's canonical metric form and log a warning in the import report rather than failing the row.
3. **Do not propagate** `#NAME?` into any BEAMweb project JSON or DB record. Metric is canonical (see §9); if the import can't recover the unit, mark the field null and raise a row warning.

This pattern is common enough in the reference CSVs that the importer should treat `#NAME?` as a soft-null sentinel, not a hard parse error.

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

1. **Phase 0 — Design lock-in + shared dependency manifest + shell stub** ✅. Document tabs and pattern, build the dependency manifest page ([`PDF-Parser/dependencies.html`](./PDF-Parser/dependencies.html)), scaffold [`beamweb.html`](./PDF-Parser/beamweb.html) with the 18 BEAM tabs in a sidebar + stubbed tab pages. Glossary + Energy GHG tabs ship with real content. No calc, no state — navigation shell + nav-btn wired across existing apps.
2. **Phase 1 — Shared infra**. `PDF-Parser/js/shared/filehandler.mjs` (JSON open/save/import, localStorage persistence) + `PDF-Parser/js/shared/statemanager.mjs` (project state + change events, dirty-flag propagation for the eventual calc graph) + `PDF-Parser/js/shared/units.mjs` (§9 conversions; metric canonical, imperial display). All three consumed by PDF-Parser (refactor) and BEAMweb (fresh).
3. **Phase 2 — PROJECT tab**. Meta, energy fields, dimension fields, derived totals shell (no per-tab calcs yet — totals just sum whatever tabs produce). Metric/imperial toggle in header wires into the units module.
4. **Phase 3 — First assembly tab end-to-end**. Candidate: `Footings & Slabs` (simplest geometry) or `Exterior Walls` (most representative — lots of shared infra). Pick after BEAM CSVs arrive. Establishes the per-row calc pattern, regression-tests against BEAM workbook output with a canonical project, locks the per-tab module shape.
5. **Phase 4 — Remaining assembly tabs in parallel**. Each follows the Phase 3 pattern. 13 assembly tabs × ~1 day each → ~3 weeks of focused work.
6. **Phase 5 — REVIEW + RESULTS + reports**. Aggregation tabs, print view, CSV export of results (not export back to Excel — one-way only per §0).
7. **Phase 6 — Excel import (reuse OBJECTIVE ExcelMapper)**. Read a BEAM workbook into the project state. Round-trip test: import, export to JSON, re-open, numbers match within rounding tolerance.
8. **Phase 7 — OBJECTIVE integration for operational energy** (see §10). Shared project file or cross-app nav pattern brings TEUI/TEDI + fuel consumption from OBJECTIVE into BEAMweb's PROJECT tab. HOT2000 direct-parse indefinitely deferred.
9. **Phase 8 — PDF-Parser integration**. Polygons carry a `component` tag set at measurement time (see §7 Q11); BEAMweb reads them into assembly tabs. Shared project JSON. Live area totals.
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
- Q7a — Section-config unit normalisation: when a material's `functional_unit` is "m² at 3.5 inch" (CLT), does BEAM scale when the user enters a different thickness, or does it expect the functional unit to match the section config?
- Q7b — Multi-tab lookup chains (does `Exterior Walls` pull summary rows from `Cladding`?).

**Integration:**
- Q12: Can two projects share polygons (cross-project material reuse), or is each project self-contained?
- Q13: Does BEAMweb need read access to a completed BEAM workbook (full operational+material), or only MCE²-equivalent subset?

### Answered

- ✅ **Q1, Q9, Q14, Q15, Q17, Q18** (tab list, Excel scope, app location, tab UX, Pages site, nav-btn) — resolved above / upthread.
- ✅ **Q8 (OBJECTIVE file-io)** — Andy will provide ExcelMapper when Phase 6 starts.
- ✅ **Q10 (HOT2000 `.h2k`)** — **parked indefinitely.** BEAMweb will integrate with OBJECTIVE for operational energy before it parses HOT2000 directly. See §10 below for the OBJECTIVE integration direction.
- ✅ **Q11 (polygon → component mapping)** — tagged at measurement time in PDF-Parser. The user has the drawing open and the context is fresh when they place a polygon; PDF-Parser adds a `component` attribute to each polygon ("wall_exterior", "roof", "footing", etc.) which BEAMweb reads on import. This is a PDF-Parser Step 10 change; BEAMweb just consumes it.
- ✅ **Q16 (units)** — metric foundation, display-time conversion, per-user toggle. See §9 below.
- ✅ **Reference tabs shipped** — Glossary (48 terms, live search) + Energy GHG (13 provinces × 5 fuel factors) are Phase 0 deliverables in `PDF-Parser/js/beam/reference-data.mjs`.

---

## 9. Units — metric canonical, imperial display layer

**Storage contract** — every numeric field in every project JSON is stored in metric (m, m², m³, kg, kgCO2e). There is no imperial mirror in the serialized file. Consumers that want imperial compute it at display time.

**User preference** — a metric/imperial toggle lives in the header (like the BEAM workbook's unit widget in the top-right of PROJECT), persisted in `localStorage` per-user (survives across projects). Default: metric.

**Why**: Canadian practice splits along the Part 9 / Part 3 line. Part 3 AHJs, reviewers, commercial builders: overwhelmingly metric. Part 9 builders + Energy Advisors: often still imperial on paper. Both need to be first-class, but the model itself should never have two sources of truth for any quantity. Storage in metric keeps the calc engine simple and deterministic; display-only imperial keeps the UX familiar for Part 9 workflows.

**Shared utility — planned as `PDF-Parser/js/shared/units.mjs`**

One small ES module used by PDF-Parser, BEAMweb, and any future app:

```js
// Canonical conversions. Metric is the base; imperial is one-way display.
export const UNITS = {
  length: { m: 1, ft: 0.3048, in: 0.0254 },
  area:   { m2: 1, ft2: 0.09290304 },
  volume: { m3: 1, ft3: 0.028316846592 },
  mass:   { kg: 1, lb: 0.45359237 },
};

export function fmt(metricValue, kind, displayUnit) {
  // metricValue × conversion → display string with locale-aware rounding
}

export function parseUserInput(text, kind, userUnit) {
  // "12 ft" → 3.6576 (metric). Rejects ambiguous input.
}
```

- **Read-only from the calc engine**. Calc never sees imperial.
- **PDF-Parser reconciliation**: PDF-Parser today auto-detects metric/imperial from the drawing for calibration. When the polygon is saved to JSON, convert-to-metric at write time. Reading a polygon from project JSON? Always metric. Displaying the polygon's label on the drawing? Convert to user's display preference.
- **Lands in Phase 1** alongside `shared/filehandler.mjs` and `shared/statemanager.mjs` — state manager needs unit semantics when hydrating project state.

**Edge case** — materials' `functional_unit` strings (e.g., `"m2 at 3.5\""`) are mixed-unit by design and stay as literal strings. `shared/units.mjs` does not try to parse them.

---

## 10. Operational energy — OBJECTIVE integration (not HOT2000)

**Q10 replacement direction.** HOT2000 `.h2k` parsing parked indefinitely. Instead, BEAMweb's operational-emissions inputs come from OBJECTIVE (the team's existing energy-modelling app) either via:

1. **Shared project JSON** — OBJECTIVE saves a project file that BEAMweb can open (or a subset of). Same `shared/filehandler.mjs` + `shared/statemanager.mjs` scaffold that BEAMweb uses.
2. **Cross-app nav with state preservation** — adapt OBJECTIVE's `saveStateAndNavigate()` pattern so clicking from OBJECTIVE into BEAMweb (or reverse) carries the shared meta + energy consumption forward.
3. **Manual entry fallback** — when no OBJECTIVE project is attached, the PROJECT tab energy fields accept manual kWh / m³ / L / kg inputs (parallels MCE² today).

What BEAMweb needs from OBJECTIVE for operational energy (provisional):
- Heated floor area, heating degree days, province (already part of both models)
- Annual consumption: electricity (kWh), natural gas (m³), propane (L), oil (L), wood (kg)
- On-site generation (kWh)
- Optionally: TEUI / TEDI targets for side-by-side presentation on REVIEW

BEAMweb applies the Energy GHG factors (tab 18) to produce operational emissions, not OBJECTIVE. OBJECTIVE owns *modelling*; BEAMweb owns *carbon accounting*.

**Sequencing** — design the integration during Phase 7 (previously HOT2000 import); sooner if OBJECTIVE's file format is nailed down. Needs a deeper design conversation with Mark / OBJECTIVE team.

---

## 8. Relationship to sibling workstreams

| Workstream | How BEAMweb uses it | How BEAMweb affects it |
|---|---|---|
| **schema/** (materials JSON DB) | Read-only consumer. `materials/index.json` for the picker; lazy-fetches per-division files for full records. | None direct; may surface new fields BEAMweb needs, which get added to the schema and `sample.json`. |
| **PDF-Parser** | Reads polygon → area / volume data from a shared project JSON. | Will need polygons to carry a material reference + component tag. That's shared work — land it in PDF-Parser's Step 10. |
| **Database viewer** | Could become the picker UI inside BEAMweb (reused as a modal). | No change. |
| **Matrix** | Independent. Linked from the shared nav only. | No change. |
| **OBJECTIVE** | Lift file-handling patterns (xlsx read/write) in Phase 6. In Phase 7, **runtime integration**: OBJECTIVE supplies operational energy inputs (TEUI/TEDI, fuel consumption) via shared project JSON or `saveStateAndNavigate`-style cross-app nav. Replaces HOT2000 direct-parse (Q10 parked). See §10. | Shared project-file format converges with OBJECTIVE's. If OBJECTIVE bumps its schema, BEAMweb's file-handler has to track. Needs design conversation with Mark / OBJECTIVE team before Phase 7 code starts. |
| **EPD PDF parser** (Phase 2 of schema) | When it lands, it fills `impacts.*.by_stage` on material records. BEAMweb will auto-get per-stage totals. | No direct coupling. |

---

## Appendix — Branch + repo state at spin-up

- Branch: `beamweb` on both remotes (commit `8321204`, same tip as `main`)
- No code yet — this document only
- Sibling apps all on `main`: PDF-Parser, Matrix, Database viewer; shipped and deployed

---

## Appendix — Changelog

- **2026-04-18 (session 2, wrap-up)** — Added §4.4 documenting the `#NAME?` CSV-import hazard: BEAM workbook uses cross-sheet functions for unit conversion (sf/sm, ft/m, cf/cm, lb/kg); when those don't resolve in the exporting environment the CSV drops `#NAME?` into the cell. Importer should treat as soft-null sentinel, infer unit from column context, log to import report, never propagate into project JSON. Updated §0 status to reflect Phase 0 shipped and added explicit IP rules block referencing `CLAUDE.md`.
- **2026-04-18 (session 2, IP neutralisation)** — Precautionary scrub to defuse copyright-troll scraping of the Pages site. Removed `CSI`/`MasterFormat`/`Division` terminology from all code and served data; renamed `division_prefix` → `group_prefix`; dropped `division_name`, `csi_masterformat`, `uniformat_level2` fields. Removed MCE²/NRCan/Crown references from user-facing copy. Matrix left alone (regulatory-program citations are legitimate). Material DB regenerated (822/822 validates). See commit `8d730ab`.
- **2026-04-18 (session 2, Q11/Q16/Q10 resolved)** — Polygon → component mapping locked in: tag at measurement time in PDF-Parser (user knows the context when placing the polygon). Units contract locked in: metric canonical in storage, imperial at display time only, per-user toggle persisted in localStorage; new §9 documents a planned `PDF-Parser/js/shared/units.mjs` for Phase 1. HOT2000 direct-parse parked indefinitely (may never happen); replaced by Phase 7 OBJECTIVE integration for operational energy — new §10 sketches the direction. Phase breakdown + relationships updated accordingly.
- **2026-04-18 (session 2, ref tabs)** — Glossary + Energy GHG tabs ship as Phase 0 informational. 48 glossary terms (abbr / full / description, with live search) and 13-province × 5-fuel-factor Energy GHG table live at `PDF-Parser/js/beam/reference-data.mjs`. CSVs at `docs/csv files from BEAM/{Glossary,Energy GHG}.csv` now redundant and safe to delete. Q14 (app location) marked resolved: shipping at `PDF-Parser/beamweb.html` + `js/beamweb.mjs` + `js/beam/reference-data.mjs`.
- **2026-04-18 (session 2)** — Doc revised after Andy's review. Tab list resolved (BEAM authoritative, 17 tabs + Energy GHG optional); nav-btn label set to `BEAM`. Section 2.3 added — assembly-tab pattern discovered from MCE² CSVs in `docs/csv files from BEAM/` (inline material toggle rows per tab, pre-curated subset of the 821-material DB, per-row SELECT+QUANTITY+%, section-level config like thickness/R-value). Section 4 populated with calc shape inferred from MCE² column labels; exact formulas await BEAM CSV exports from Andy's unlocked workbook. Section 7 open-questions re-triaged with answers/partials. Phase breakdown revised (10 phases). Goal 5 added — calculation graph consideration.
- **2026-04-18 (session 1)** — BEAMweb workstream spun up. Document seeded with scaffold + open questions. Schema Phase 3 (standalone material picker) explicitly subsumed: the picker becomes inline toggles inside BEAMweb assembly tabs rather than a PDF-Parser feature.
