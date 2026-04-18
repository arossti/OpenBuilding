# BEAMweb — JS port of BEAM / MCE² for the web

> **Workplan + design spec + cold-start handoff for the BEAMweb workstream.** Read section 0 first if you are joining fresh. Sections marked **TBD — user input** are intentionally empty and wait for Andy to describe the source of truth (MCE² workbook tabs and their calc formulas).

---

## 0. Cold-start handoff (read this first)

### Status as of 2026-04-18

- **New workstream.** Branch `beamweb` on both remotes. Empty — this document is the only artefact so far.
- **Pivot from Phase 3 (standalone material picker).** The picker would have been orphaned from the real consumer. Instead, we build the full app and the picker lands inside it.
- **Parent repo dependencies already in place:**
  - BEAM materials catalogue shipped — `schema/materials/*.json`, `schema/materials/index.json` (see [`schema/schema.md`](./schema/schema.md))
  - PDF-Parser exists for area extraction from construction drawings (see `PDF-Parser/`)
  - Database viewer at [`PDF-Parser/database.html`](./PDF-Parser/database.html) proves the catalogue fetch/render pattern
  - Matrix app at [`PDF-Parser/matrix.html`](./PDF-Parser/matrix.html) proves the multi-app nav shell

### What BEAMweb is

A browser app that replaces the **MCE² (Material Carbon Emissions Estimator)** spreadsheet. Same methodology, same outputs when driven by identical inputs, but:

- Runs in the browser, no Excel required
- Consumes the new BEAM materials JSON database (full ISO 21930 / EN 15804+A2 per-stage impact scope, not just GWP)
- Accepts three input modalities for quantities:
  1. **Manual entry** — user types areas, thicknesses, etc. (mirrors MCE² workbook)
  2. **Excel import** — read an existing MCE² file into state (reuse file-handling patterns from **OBJECTIVE**, the team's energy model app)
  3. **PDF-Parser integration** — polygons measured on drawings flow directly as component areas
- Persists projects as JSON (shared format with PDF-Parser so one project file covers both tools)
- Deploys alongside PDF-Parser / Matrix / Database on GitHub Pages

### What BEAMweb is NOT

- Not a new calculation methodology. BEAM/MCE² is the source of truth; BEAMweb is a port.
- Not a material catalogue rewrite. Consumes `schema/materials/` as-is.
- Not tied to Excel. Excel import is a *convenience*, not a dependency. Projects live as JSON.
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

---

## 2. Reference source — the MCE² spreadsheet

**File in team's possession.** Latest version: November 2023 NRCan-branded workbook. Ingested by eye; the formulas are the spec.

### 2.1 Tab list — USER INPUT REQUIRED

**TBD — Andy to enumerate all tabs from the workbook.**

Visible in the screenshot (first-page bottom row), partial list:
- `Cover_Couverture`
- `License`
- `Introduction`
- `USER INPUT SHEET` — primary project entry
- `Footings & Slabs`
- `Foundation Walls`
- `Structural Elements`
- `Ext. Walls`
- `Ext. Wall Systems`
- `Party Walls`

Still to enumerate: interior walls, framed floor, ceiling, roofing, roof insulation, windows, doors, heavy timber, energy GHG, any hidden calc tabs, any assembly-template tabs the user can switch between.

For each tab, when populating section 4 below, note:
- Purpose (what does this tab represent in the EC model?)
- Inputs the user provides
- Materials referenced (by material_type or explicit BEAM ID)
- Output that feeds the project total

### 2.2 USER INPUT SHEET — observed fields (from screenshot)

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
- Volume: m³ ↔ pi/ft³
- Area: m² ↔ pi/ft²
- Length: m ↔ ft

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

## 4. Calculation approach — TBD, USER INPUT REQUIRED

**Andy to fill this section in after the nap.** Short prose is fine; the gist is:

> areas × material DB values → sum of embodied carbon

but the formulas on each assembly tab matter for the port. Things to capture per component:

- What areas/volumes feed this component?
- Which materials are looked up, and how (by BEAM ID? by material_type? user-selected from picker?)
- Which field on the material record is the multiplier? (`carbon.common.value_kgco2e` per `functional_unit`, or a derived per-m² value, or mass × `impacts.gwp_kgco2e.total.value`)
- Any component-specific multipliers / waste factors?
- Any conditional rules (if performance path A, use X; if prescriptive, use Y)?

Once section 4 is drafted, we lift each row into a testable function (one per component) that the UI wires into.

---

## 5. Architecture sketch (draft)

Mirroring PDF-Parser + Database viewer conventions:

- **Tech stack**: vanilla JS ESM, no framework, no build step. Local dev via `npm run serve` (python3 http.server).
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

## 6. Phase breakdown (proposed)

Small, independently-shippable slices:

1. **Phase 0 — Design lock-in** (THIS DOC). User fills sections 2, 4, 3.2 (OBJECTIVE pointer). TBD markers resolved.
2. **Phase 1 — Shell + state + material picker reuse**. `beamweb.html` scaffold, tab nav, state manager skeleton, project JSON read/write (JSON only, no Excel yet). Material picker modal invoked from a component field. Regression-test: open a blank project, add one material to one component, compute one-term EC.
3. **Phase 2 — USER INPUT SHEET + one assembly tab**. Typically Exterior Walls (highest LOE / representative). Port its formulas one-for-one from MCE². Regression-test against MCE² with hand-entered numbers.
4. **Phase 3 — All remaining assembly tabs**. Parallel-ports, each with a regression fixture.
5. **Phase 4 — HOT2000 / operational energy**. Manual entry fields first; HOT2000 `.h2k` file import later if feasible.
6. **Phase 5 — Excel import (reuse OBJECTIVE)**. Read an MCE² workbook into the project state. Round-trip test: export to JSON, re-open, numbers match.
7. **Phase 6 — PDF-Parser integration**. Polygon → component mapping UI. Project JSON shared.
8. **Phase 7 — Reports + deploy**. Print view, CSV export, PDF report. Pages deploy.

---

## 7. Open questions (collect here, resolve before coding)

**Tab inventory:**
- Q1: Full list of tabs in MCE² Nov 2023 workbook. TBD — Andy.
- Q2: Which tabs are user-facing, which are calc engine / lookup?
- Q3: Any hidden sheets or locked-formula sheets?

**Calculation:**
- Q4: How are material references encoded on each tab — by BEAM ID, by material_type string, or by a locked assembly template?
- Q5: Is the per-m² GWP looked up directly, or is there a mass-based path (area × thickness × density × per-kg GWP) used for some components?
- Q6: Waste factors — are they baked into material records, applied at component level, or both?
- Q7: How does the spreadsheet handle the garage-exclusion rule (section says "Exclude any garage quantities") — a separate column, a switch, or guidance only?

**Input modalities:**
- Q8: OBJECTIVE file-io module(s) to reuse — path and version please.
- Q9: Excel import — `.xlsx` only, or support legacy `.xls` too?
- Q10: HOT2000 `.h2k` file format — is there a library, or do we parse a fixed subset? How much does the spreadsheet use today?

**Integration:**
- Q11: Polygon → component mapping — assigned in PDF-Parser at measurement time, or in BEAMweb at import time?
- Q12: Can two projects share polygons (cross-project material reuse), or is each project self-contained?
- Q13: Does BEAMweb need read access to a completed BEAM project too (BEAM.xlsx workbook that has operational too), or only MCE² which is the materials-only sheet?

**App location + UX:**
- Q14: Where on disk — `BEAMweb/` at root? `PDF-Parser/beamweb.html`? Its own sibling repo?
- Q15: Tab UX — mirror the spreadsheet literally, or reorganize for web (e.g., a single scrolling project page with collapsible component sections)?
- Q16: Units — user-selectable metric/imperial toggle, or metric-only with display conversion?

**Deployment:**
- Q17: Same Pages site (`arossti.github.io/OpenBuilding/beamweb.html`)?
- Q18: Nav-btn wired into the shared header on PDF-Parser / Matrix / Database?

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

- **2026-04-18** — BEAMweb workstream spun up. This document seeded with scaffold + open questions. Schema Phase 3 (standalone material picker) explicitly subsumed: the picker becomes a component inside BEAMweb rather than its own PDF-Parser feature. Awaiting Andy's input on sections 2 (tabs) and 4 (calc approach) before coding begins.
