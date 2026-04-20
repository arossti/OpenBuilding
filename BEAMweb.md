# BEAMweb — JS port of BEAM for the web

> **Workplan + design spec + cold-start handoff for the BEAMweb workstream.** Read section 0 first if you are joining fresh. Sections marked **TBD — user input** are intentionally empty and wait for Andy to describe the source of truth (BEAM workbook tabs and their calc formulas).

---

## 0. Cold-start handoff (read this first)

### Status as of 2026-04-20 (session 6 — F&S shop-by-GWP per-row display, PROJECT collapsibles + real dropdowns, Intro centring, footnote two-tone split)

- **Session 6 on `beamweb-tabs-2`** — two commits of cosmetic / UX polish on top of the session-5 parity work. Everything architectural stays locked (flat-dict project JSON, materials-DB as single GWP source, m²·RSI R-VALUE conversion, client-side BEAM-Avg compute, per-tab Reset, read-only assembly qty cells, jurisdiction filter). Tip at `6d15584`.
  - **Session 6 polish pass** (`7901a09`). F&S now displays the computed GWP on **every** candidate row, not just the selected one — users can shop for a lower-EC material at a glance without toggling checkboxes. Subtotals and tab totals stay gated by actual selection via `computeRowEmissions({select: vals.select, ...})`; only the display path calls it with `select: true` for the "potential NET". Selected-row QTY now reads cyan (`--accent-lit`) to match the group-subtotal colour, so the active pick reads instantly. PROJECT tab Info / Building Dimensions / Garage Dimensions wrapped in the same collapsible header chrome (`.bw-asm-group` / `-header` / `-toggle`) F&S groups use — cyan chevron, Info default-open, Dimensions + Garage default-collapsed. Building Type / Construction Type / Project Development Stage switched from free-text inputs to real `<select>` dropdowns (18 + 6 + 9 options, order matches BEAM gSheet validation lists, no cross-field dependencies — purely informational). Intro tab centre-aligned via a new `.bw-intro` class; bullets dropped from the How-it-works list so the text reads as a single composed block. Stale "Phase 2.1 wires Categories.csv" legend trimmed.
  - **Footnote two-tone split** (`6d15584`). The BEAM CSVs and the BfCA materials DB fuse two signals into the footnote column with a `;` separator — e.g. `Expired 2025; BfCA BioC calc by mass` (BfCA computed biogenic carbon from mass because the source EPD did not report it). The old `truncFoot` hard-sliced at 16 chars, rendering "Expired 2025; Bf…" — garbled and uninterpretable. Replaced with `renderFootnote` which splits at the first `;` and routes each half to its own span: primary status tag (purple via `.bw-asm-foot-primary.expired`) + dim-grey suffix for the BfCA annotation. Full text stays in the TD `title` attr for hover. `white-space: nowrap` so the column auto-widens to fit. The BioC-by-mass suffix appears on biogenic-EPD rows across 5 of 8 material groups (concrete, metals, wood, thermal, finishes). Same commit confirmed the purple-expired rule finally renders (previous CSS was scoped to `.bw-asm-col-foot` — the TH class — while the TD renders as `.bw-asm-foot`; the re-targeting lives in `7901a09`'s CSS cleanup).
  - **Per-row NET only, by design (not oversight)**. BEAMs gSheet carries four per-row value columns (NET / GROSS / STORAGE Short / STORAGE Long); BEAMweb currently shows NET per row and rolls up all four to the tab-header dashboard. `computeRowEmissions` keeps all four dimensions internally. Rationale: until the materials DB surfaces per-stage EN 15804+A2 data, GROSS == NET and STORAGE Short == STORAGE Long == 0 for every non-biogenic material — three columns of redundant / zero ink across ~80% of rows. The 4-column per-row grid returns when per-stage data lands (Phase 4 dependency, not dropped); biogenic assemblies (Structural Elements / Floors / Walls when timber-framed) get the most value from the per-row view once biogenic sequestration is computable. Reversible at any time — ~10 lines in [`footings-slabs-tab.mjs`](./PDF-Parser/js/beam/footings-slabs-tab.mjs) + a CSS grid widening — if the BfCA team wants exact visual parity with BEAMs now, at the cost of horizontal sprawl today.
- **Session 5 on `beamweb-tabs-2`** — 12 commits spanning foundational fixes, parity-validation math fixes, a jurisdiction filter, the architecture pivot to `schema/materials/index.json` as the calc-time GWP source, and the R-VALUE + BEAM-Avg work that closed the last technical gap. F&S now matches BEAM gSheet to the integer kgCO2e on every row tested across CONCRETE / REBAR / PILES / SUB-SLAB INSULATION (XPS / EPS / Mineral Wool, including BEAM-Avg entries). No more deferred technical items.
  - **Cold-start + action bar** (`0c10b78`, `8dee661`). Cold load = blank UI = zero emissions. `currentValues()` no longer falls back to `material.sample_*`. Tilt button removed (OBJECTIVE force-recompute BEAMweb does not need), Reset is per-tab, New is full-reset-and-reload. F&S qty cells are `readonly` — quantities flow from PROJECT only, matching BEAM's protected-cell behaviour. SELECT / % / group-header configs stay editable.
  - **Auto-fill bridge + Load Sample** (`0d93225`, `b826cfa`, `89f7f14`). [`js/beam/auto-fill.mjs`](./PDF-Parser/js/beam/auto-fill.mjs) listens on PROJECT `dim_*` keys and pushes DERIVED qty to every row in mapped F&S groups. Precedence: only USER_MODIFIED stays sticky; DERIVED overrides IMPORTED / CALCULATED / null. [`js/beam/sample-loader.mjs`](./PDF-Parser/js/beam/sample-loader.mjs) fetches a flat-dict sample JSON, imports via FileHandler quarantine, then re-syncs the auto-fill + TOTAL-config bridges and refreshes visible panels. First sample at [`docs/beam-samples/single-family-home.json`](./docs/beam-samples/single-family-home.json) (DOE Prototype values, 43 fields).
  - **Jurisdiction filter + cascading dropdowns** (`267fac0`). PROJECT Country / Province/State become cascading selects via new [`js/beam/jurisdictions.mjs`](./PDF-Parser/js/beam/jurisdictions.mjs). F&S rows carry `data-jur-countries` / `data-jur-provinces` attributes derived from subgroup banner tags (`– CANADA`, `– N.AMERICA`, `– US BAR SIZES`) and material-name [bracket] tags. Row-level filter applies on initial render + every PROJECT select change. Banner above F&S reports the hidden-row count. Canada supports province-level filtering (CRMCA / ABQ / Concrete BC / Ontario Concrete RMCAO / etc. → province list); USA is country-level only (BEAM concrete EPDs aren't state-tagged).
  - **Parity math fixes** (`9845a4d`, `94ab492`, `10f63b9`, `c52f927`). Four distinct bugs found via parity testing:
    - Per-row state keys qualified by full code path (`T01_C01_S04_43fe24` not just `43fe24`) — stopped same-hash concrete rows in CONTINUOUS FOOTINGS / COLUMN PADS / SLABS from sharing a single StateManager slot.
    - Per-row factor derivation (later refined to `(hash, unit)` cross-share) — stopped the per-m³ concrete factor from leaking into per-m²-at-6"-thickness slab rows (was giving 30,866 instead of 4,704).
    - Full-precision volume in state with rounded display — CONTINUOUS FOOTINGS NRMCA row now reads 2,506 (not 2,516) because `recomputeVolume` no longer rounds 8.965492 → 9.0 before the bridge sees it.
    - Group-config → row-qty bridge for "TOTAL ..." configs (METAL PILE TOTAL LENGTH, TIMBER PILE TOTAL VOLUME, REBAR TOTAL REBAR LENGTH) — mirrors PROJECT auto-fill pattern but intra-tab, so the config value populates every row in the group.
  - **Cleanup audit** (`7d602e7`). Prettier + eslint ran across the codebase (615 formatting warnings auto-fixed, 8 eslint errors resolved via new browser globals, 0 errors remaining). Stale "Phase 0 shell" labels purged from panel pills, status bar, file docstrings, tab definitions. Helper consolidation: single `codeToDomKey()` in [`assembly-csv-parser.mjs`](./PDF-Parser/js/beam/assembly-csv-parser.mjs) replaces the inlined regex that used to live in both F&S and auto-fill (the bug class that took down the PROJECT→F&S bridge when keys changed shape). 2dp display formatter for every quantity cell.
  - **Materials-DB migration — single source of truth** (`8bee3f4`). Earlier BEAMweb code reverse-engineered per-unit factors from the assembly CSV's pre-computed NET column. New architecture: [`js/beam/materials-db.mjs`](./PDF-Parser/js/beam/materials-db.mjs) fetches `schema/materials/index.json` once, exposes `getMaterial(hash)` + `convertQtyToMaterialUnit(rowQty, rowUnit, dbEntry, group, getValue)`. F&S `recomputeAll` → DB lookup → unit conversion (m² row × THICKNESS → m³ for concrete factor) → `computeRowEmissions({select, qtyInMaterialUnit, pct, gwp})`. Factor derivation layer deleted from the parser. Unblocked METAL PILE (Helical pier @ 10m = 176 ✓), TIMBER PILE (Wood/SPF @ 12m³ = 757 ✓), REBAR FOR SLABS / COLUMN FOOTINGS. Architecture now matches what BEAM's gSheet does internally.
  - **R-VALUE conversion + BEAM-Avg client-side compute** (`85fd233`). Last technical parity gap closed. Insulation EPDs in the BfCA DB carry `functional_unit: "m2•RSI"` (kgCO2e per m² per RSI), so what looked like an R-VALUE scaling problem is actually a unit conversion problem the materials-db converter handles cleanly: when the row is m² and the material is m²·RSI, multiply by RSI = imperial_R / 5.678 (the constant BEAM uses). Linear `configRatio` proxy on R-VALUE deleted; `groupConfigRatio` collapsed to `return 1` since every scaling config in F&S today flows through the unit converter or the config-qty bridge. For "BEAM Avg" entries with `gwp_kgco2e: null` in the DB (BEAM derives these on the fly from manufacturer peers): `materials-db.mjs` now also fetches the 8 per-group JSONs in parallel at boot to surface `is_beam_average` + `material_name` fields the lean index does not include; F&S `wireFootingsSlabsTab` runs a `resolveBeamAverage(entry, peers)` pass between parse and render, walking each subgroup and mutating BEAM-Avg DB entries with the arithmetic mean of same-subgroup peers' GWP. The BfCA team has already curated which manufacturer EPDs sit in which F&S subgroup (LEGACY XPS / REDUCED GWP XPS / modern XPS in separate subgroups), so same-subgroup-peer-mean is the right rule. Verified across 13 SUB-SLAB INSULATION rows: XPS BEAM-Avg (`a94mfe`) = 1,062 ✓, EPS Type IX = 842 ✓, Mineral wool NAIMA = 1,326 ✓, etc.
  - **State plumbing additions**: `StateManager.clearByPrefix(prefix)` for per-tab Reset; `StateManager.getFieldState(fieldId)` for provenance checks. Flat `{ format, version, fields: { field_id: value } }` project-file shape locked in §5.1 (nested strawman retired).
- **Phase 0 shipped + merged** via PR #6 (`cd89b37`, 2026-04-18 session 2). App shell live at [`PDF-Parser/beamweb.html`](./PDF-Parser/beamweb.html) with 18 tabs, Glossary + Energy GHG populated with real data, reference-data module, action bar wired to stubs.
- **Phases 1-3 shipped + merged** via PR #7 (`c7a2dcc`, 2026-04-19). Phase 1 shared infra (state-manager / file-handler / workbook-mapper), Phase 2 PROJECT tab, Phase 3 Footings & Slabs assembly picker, Database viewer group-section view, BEAM xlsx fetch script + 22 CSV snapshots — all on `main`.
- **Phase 1 stubs landed** (session 3, `26daac0`). Three ESM modules: [`js/shared/state-manager.mjs`](./PDF-Parser/js/shared/state-manager.mjs) (field map, dependencies, listeners, localStorage autosave), [`js/shared/file-handler.mjs`](./PDF-Parser/js/shared/file-handler.mjs) (.json / .csv / .xlsx import + .json export, quarantine pattern), [`js/beam/workbook-mapper.mjs`](./PDF-Parser/js/beam/workbook-mapper.mjs) (user-workbook → state mapper, per-tab dispatch). Stub-level — method signatures locked, per-tab mapping tables fill in as assembly tabs port. Exposes `window.BEAM.StateManager`, `.FileHandler`, `.WorkbookMapper`.
- **Phase 2 PROJECT tab live** (session 3, `c98cc93`). [`js/beam/project-tab.mjs`](./PDF-Parser/js/beam/project-tab.mjs) renders the three-section form (Project Information + Building Dimension Inputs + Garage Dimension Inputs), ~40 fields, L×H×W → computed volume for continuous footings, StateManager-backed persistence. Dropdowns still render as free-text inputs (Categories.csv option-list parsing is next up).
- **Phase 3 Footings & Slabs tab live** (session 4, `aa33913` + polish `0ffaedb`, `4e1614b`). First live assembly picker. Two new modules: [`js/beam/assembly-csv-parser.mjs`](./PDF-Parser/js/beam/assembly-csv-parser.mjs) (generic parser for any assembly-tab CSV — banner rows vs material rows via column A + group-code depth, inline group-header config extraction from columns C/D/E, per-material emission-factor derivation from the first non-zero sample row per hash) and [`js/beam/footings-slabs-tab.mjs`](./PDF-Parser/js/beam/footings-slabs-tab.mjs) (consumes parser; 16 groups × 658 materials, 276 with derived EPD factors). Group-header configs editable inline (THICKNESS, R-VALUE, TOTAL REBAR LENGTH); linear `configRatio = user / default` scaling applied to emissions. Per-row select/qty/pct editable, StateManager persistence + localStorage autosave, group subtotals + tab totals (NET / GROSS / STORAGE Short / STORAGE Long) live. Default view: all groups collapsed for overview; click anywhere on a group-header bar to toggle (inline config inputs pass through without triggering collapse). CSV staged into `PDF-Parser/data/beam/` via extended `npm run stage:data` + Pages workflow step.
- **Database viewer: group-section view** (session 4, `4e1614b`). Mirrors F&S hierarchy — collapsible group banners when browsing (8 sections, all collapsed on first load = compact overview); automatically flattens to the old flat sorted list when the user searches or picks a group chip so results surface without section chrome in the way. Dedicated `Expand all / Collapse all` toggle button (re-purposed from the old Collapse button). `Division` → `Groups` UI rename applied to the filter label, element IDs, and function names (Matrix's legitimate "VBBL Division B" regulatory reference untouched per IP rules).
- **Active branch**: `beamweb-tabs-2` on both remotes (`origin` = bfca-labs/at, `openbuilding` = arossti/OpenBuilding). Created off `main` after PR #7 merge. Work on a new branch per phase; never push to `main`.
- **Ecosystem restructured** (session 2) — landing page at `PDF-Parser/index.html`; PDF-Parser app renamed to `pdfparser.html`; single-file CSS (`bfcastyles.css`, ~4100 lines, section/app scoped); cyan accent; dependency manifest with drift detector at `dependencies.html`; BEAM nav-btn added across all apps.
- **IP neutralisation applied** (session 2 commit `8d730ab`) — see the "IP rules" block below. Code and served data are CSI/MCE²-free; Matrix intentionally retains regulatory-program references (legitimate citations).
- **Parent repo dependencies in place:**
  - BEAM materials catalogue — 821 sparse records, 8 material groups, full EN 15804+A2 per-stage scope ([`schema/materials/`](./schema/materials))
  - PDF-Parser — area takeoff, Summary Table with Key Areas per sheet, volumetric in Step 10
  - Database viewer — proves the catalogue fetch/render + lazy-per-group pattern
  - Matrix — proves multi-app nav shell
- **BEAM sheet snapshot + fetch script** (session 3, `6b234b3` → `3ea823e`). First try used `schema/scripts/fetch-beam-sheet.mjs` against the Google Sheets `gviz` CSV endpoint, 22 tab snapshots under [`docs/csv files from BEAM/`](./docs/csv%20files%20from%20BEAM/). **Late-session discovery**: gviz silently truncates every tab at the last contiguous data block. Footings & Slabs has 749 rows in the sheet; gviz returned 317 (58% missing). Foundation Walls, Ext. Walls, Party Walls, Garage, REVIEW, Materials DB, Settings all lost 40-93% of their content. Replaced with [`schema/scripts/fetch-beam-sheet.py`](./schema/scripts/fetch-beam-sheet.py) using `/export?format=xlsx` + openpyxl (`data_only=True` for cached formula values). All 22 CSVs re-fetched and committed at full depth. BEAM sheet stays locked down; the xlsx endpoint works with viewer-shareable access when a re-fetch is needed.
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
  1. **Manual entry** — user types areas, thicknesses, etc. (mirrors the BEAM workbook)
  2. **Excel import** — read an existing BEAM workbook file into state (file-handling patterns shared from OBJECTIVE in session 3; workbook-mapper stub landed, per-tab mapping tables fill in as each assembly tab ports)
  3. **PDF-Parser integration** — polygons measured on drawings flow directly as component areas (PDF Parser already fully functional, and creates summary table of all Key Areas if not yet volumes)
- Persists projects as JSON (shared format with PDF-Parser so one project file covers both tools) - FileHandler needed for Import/Export and full StateManager.js for proper persistence and browser local storage use.
- Deploys alongside PDF-Parser / Matrix / Database on GitHub Pages
- New menu button beside Matrix/Database/BEAM (where BEAM is new button).

### What BEAMweb is NOT

- Not a new calculation *methodology*. BEAM is the source of truth; BEAMweb is a port, and is meant to be visually and functionally similar to the spreadsheet tools users know and love.
- Not a material catalogue rewrite. Consumes `schema/materials/` as-is.
- Not tied to Excel. Excel import is a *convenience*, not a dependency. Projects live as JSON. There is no planned excel *export* — this is intended as a one-way convenience only to assist users with transition from the legacy format
- Not a replacement for OBJECTIVE. Operational energy integration is scoped the same way: import/accept, don't re-model. See §10 — we hook into OBJECTIVE rather than parse HOT2000 directly.

### Name rationale

**BEAMweb** differentiates this implementation from the **BEAMs** spreadsheet family. Used consistently as the product name in UI, docs, and cross-app navigation. Internal code modules can use `beamweb` as the prefix (e.g., `beamweb.html`, `js/beamweb.mjs`, `beamweb.css`).

### Git workflow (same as schema workstream)

1. Feature branch per phase (currently `beamweb-tabs-2`). Commit + push to **both** remotes after every meaningful change.
2. When ready to deploy: PR on `arossti/OpenBuilding` → user merges → GitHub Pages auto-deploys from `main`.
3. After merge: fast-forward local `main`, push `main` to the `origin` mirror (`git push origin main`), delete the feature branch on both remotes (`git push origin --delete <branch> && git push openbuilding --delete <branch>`), delete the local branch, create the next feature branch.
4. Never push to `main` directly. Never force-push. Never skip hooks.
5. Commit messages via `git commit --file=- <<'MSG'` heredocs. Avoid apostrophes in messages.

### Where to pick up next (cold-start one-liner)

1. `cd PDF-Parser && npm run stage:data` — copies `schema/materials/`, `docs/csv files from BEAM/Footings & Slabs.csv`, and `docs/beam-samples/*.json` into `PDF-Parser/data/` (gitignored; regenerate each session).
2. `npm run serve`, open `http://localhost:8000/beamweb.html` — F&S cold-starts blank. PROJECT Country / Province dropdowns are cascading; F&S rows filter by jurisdiction automatically once Country is picked.
3. Click **Load Sample** to populate the DOE Prototype project. F&S totals + per-row NET should match the BEAM gSheet integer-for-integer — parity validated as of `8bee3f4`.
4. **Reset Tab** clears only the active tab (Other tabs and PDF-Parser polygon cache preserved). After F&S Reset, the PROJECT auto-fill + group-config qty bridges re-sync so DERIVED qtys re-flow.
5. **Calc data source**: F&S reads per-unit GWP factors from the BfCA materials DB (`data/schema/materials/index.json` + the 8 per-group JSONs) via [`js/beam/materials-db.mjs`](./PDF-Parser/js/beam/materials-db.mjs). `getMaterial(hash)` returns the catalogue entry (id, beam_id, gwp_kgco2e, functional_unit, material_name, is_beam_average); `convertQtyToMaterialUnit(...)` handles unit mismatch — currently (m² row + m³ material via group THICKNESS) for concrete and (m² row + m²·RSI material via group R-VALUE → RSI = R/5.678) for insulation. Same catalogue Database viewer serves. "BEAM Avg" entries have null GWP in the DB; F&S `wireFootingsSlabsTab` resolves them via `resolveBeamAverage(entry, peers)` from same-subgroup peer averages before render.
6. Phase 4 queue: see §6 — 11 assembly tabs, smallest-first (Windows → Garage). Each follows the F&S template: copy [`footings-slabs-tab.mjs`](./PDF-Parser/js/beam/footings-slabs-tab.mjs), reuse the generic `assembly-csv-parser.mjs` + `materials-db.mjs`, add the tab's groups to `PROJECT_TO_FS_GROUPS` in [`auto-fill.mjs`](./PDF-Parser/js/beam/auto-fill.mjs) where applicable (rename to `PROJECT_TO_ASM_GROUPS` once it covers more than just F&S). Same `materials-db.mjs` serves Phase 4 unchanged; new unit conversions (e.g. mass↔volume via density for some Phase 4 EPDs) extend `convertQtyToMaterialUnit` as encountered.
7. Remaining cross-cut items: `js/shared/units.mjs` for the metric/imperial toggle. (Session 6 landed PROJECT Building Type / Construction Type / Project Development Stage as real selects; R-VALUE + BEAM-Avg both shipped in `85fd233`.)
8. **Session 7 kick-off**: session 6 closed the F&S visibility polish — shop-by-GWP per-row display, PROJECT collapsibles + dropdowns, Intro centring, footnote two-tone split. Next scope Andy has named: **Building Dimensions data-source selector on PROJECT** — a per-dimension picker for where the value comes from (Imported via file / PDF-Parser polygons / Manual entry), with precedence semantics that respect the existing `StateManager.VALUE_STATES` model and a cross-app reactive wire from PDF-Parser → PROJECT. Requires (a) PDF-Parser to finalise the `component` tag taxonomy on polygons at measurement time per §7 Q11 (and possibly extend to a richer dimension-map so a polygon doesn't just know it's a "wall_exterior" but can target a specific PROJECT field), (b) a shared bridge module (likely under `js/shared/`) that carries tagged areas across the apps the way `auto-fill.mjs` carries PROJECT → F&S, (c) PROJECT-side UI affordance per dimension row. Bigger lift than any single Phase 4 assembly tab — touches three apps + the StateManager precedence contract. See §7 Q19 (new). Phase 4 tabs can still pick up smallest-first in parallel if we want to shard the work. Architectural lock from sessions 4–5 stands: flat-dict project JSON (§5.1), materials-DB as single GWP source, m²·RSI R-VALUE conversion, client-side BEAM-Avg compute, per-tab Reset, read-only assembly qty cells, per-row NET only (4-column grid deferred to per-stage EN 15804+A2 rollout — see §0 session-6 status). Don't regress.

---

## 1. Goals

1. Produce the same EC totals as the BEAM workbook for the same inputs (regression-test against the unlocked BEAM Google Sheet that Andy maintains).
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

One row per candidate material:   (many rows — Foundation Walls sheet has ~1000)
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

### 2.3.1 Verified structure (session 3, F&S xlsx export `3ea823e`)

With the full 749-row Footings & Slabs CSV in hand (vs. 317 from gviz), the banner-row conventions are concrete:

- **Banner row (group or sub-group header)**: text in column A, rest of material columns blank. Example: `"CONCRETE SLABS","",...`. The picker parser detects banner rows by checking column A for text; material-picker rows have an empty column A and the material description in column B.
- **Inline group-level config on banner rows** — when a banner carries a config, it uses columns C/D/E: `C = label`, `D = numeric default`, `E = unit`. Example: `"CONCRETE SLABS","","THICKNESS","6.0","in",…`. Multiple distinct configs exist across one tab; Footings & Slabs has six:
  - `CONCRETE SLABS` → THICKNESS 6.0 in
  - `SUB-SLAB INSULATION` → R-VALUE 10.0 (no unit)
  - `REBAR FOR CONTINUOUS FOOTINGS` → TOTAL REBAR LENGTH 84.7 m
  - `REBAR FOR COLUMN FOOTINGS, PADS & PIERS` → TOTAL REBAR LENGTH (blank)
  - `REBAR FOR SLABS` → TOTAL REBAR LENGTH (blank)
  - `AGGREGATE BASE` → THICKNESS 6.0 in
- **Group identifier codes** — every banner and material row carries an identifier in the last column: `T<NN>|C<NN>|S<NN>|<hash>`. `T01` = Footings & Slabs tab, `C06` = CONCRETE SLABS category, etc. These are stable across edits and are the natural key for picker state persistence.
- **Mixed units within one tab** — concrete/insulation thickness in **inches**, rebar length in **metres**. The unit string in column E is authoritative per-group; BEAMweb must not normalize it away. Per §9, storage stays metric, display uses whatever the user's toggle says — the group's declared unit is just the label format BEAM uses internally.

The assembly-csv-parser (Phase 3) should recognize this shape and expose each banner's config as a group-scoped state field, keyed by the group identifier code.

---

## 3. Input modalities

### 3.1 Manual entry

- Mirror the BEAM workbook form layout (tabs, input fields, formatting).
- Inputs validated on blur, totals recomputed live.
- Blank / null fields are allowed; the model just doesn't count them toward the total.

### 3.2 Excel import — reuse OBJECTIVE patterns

- Expected: `.xlsx` files matching the BEAM workbook template.
- Reader walks a known sheet+cell map and populates project state.
- Pattern borrowed from OBJECTIVE (ExcelMapper + FileHandler + StateManager patterns shared by Andy in session 3). Ported by API shape, not copied verbatim — see `js/shared/state-manager.mjs`, `js/shared/file-handler.mjs`, `js/beam/workbook-mapper.mjs` (Phase 1 stubs; per-tab mapping tables fill in as each assembly tab ports).
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
                              (e.g. interior wall cladding ×2 to account for both faces)

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

**Scope note (session 3, `3ea823e`)** — the committed CSVs under [`docs/csv files from BEAM/`](./docs/csv%20files%20from%20BEAM/) are now generated via `/export?format=xlsx` + openpyxl with `data_only=True`. That reads the workbook's cached formula values (Google evaluates on its side), so `#NAME?` does not appear in these exports under normal conditions. The hazard path stays scaffolded in the runtime workbook-mapper for the user-upload case: a practitioner importing their own BEAM xlsx may have stale caches or an environment that didn't fully resolve cross-sheet functions before save.

### 4.5 Calculation graph consideration (goal 5)

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
  │   │   └── ...                   one per BEAM assembly tab
  │   └── material-picker.mjs       modal/panel, reuses schema/materials/
  └── data/ or fetch from ../schema/materials/
  ```
- **Shared infra to extract** (user flagged: "We will need to update/enhance or create a filehandler and statemanager files, which I do not think we have explicitly created yet"):
  - `shared/filehandler.mjs` — open/save/import JSON + xlsx; used by both PDF-Parser and BEAMweb
  - `shared/statemanager.mjs` — project state, change events, undo (?). Both apps can read each other's project JSON.

### 5.1 Project file shape (locked, session 5)

Flat dict of `field_id → value` keyed exactly by the same StateManager field IDs the UI binds to. Mirrors the OBJECTIVE convention (DOM-id-as-row-header, value-as-row-body) so the same shape works as JSON, CSV, or a flat key/value store. The earlier nested strawman (`meta.address`, `components.foundation_wall.area_m2`, `pdf_parser.polygons`, `results.by_component`) is retired — too many mapping layers between the UI and the file, and field-id collisions across tabs become invisible. The flat shape eliminates both problems.

```json
{
  "format": "beamweb-project",
  "version": 1,
  "label": "Optional human label — sample projects use this; user saves omit it",
  "fields": {
    "project_name": "Sample Project DOE Prototype",
    "project_country": "United States",
    "project_total_floor_area": 221.0,

    "dim_continuous_footings_length": 42.37,
    "dim_continuous_footings_height": 0.46,
    "dim_continuous_footings_width": 0.46,
    "dim_foundation_slab_floor_area": 110.4,
    "dim_exterior_wall_area": 187.8,
    "dim_window_area": 33.1,

    "fs_T01_C06_cfg": 6.0,
    "fs_a3b91f_sel": true,
    "fs_a3b91f_qty": 110.4,
    "fs_a3b91f_pct": 1.0
  }
}
```

**Properties:**
- `format` + `version` are header sentinels for the loader.
- `fields` is the only data block. Keys are the exact StateManager field IDs (`project_*`, `dim_*`, `garage_*`, `fs_*`, future `fw_*` for foundation walls, `ext_*` for exterior walls, etc.).
- `FileHandler.exportJson` emits this shape verbatim from `StateManager.exportState()`.
- `FileHandler.importJson` accepts either a `{ fields: {...} }` envelope or a bare `{ field_id: value }` dict.
- Symmetry between user-saved projects and curated samples — both go through the same parser. No special casing.

**Sample projects** live at `docs/beam-samples/<slug>.json` (committed) and stage to `PDF-Parser/data/beam/samples/` for runtime fetch. First sample: `single-family-home.json` (DOE Prototype) — used as the parity-test fixture against the BEAM gSheet. Architected for many: when OBJECTIVE-style 12 case-study buildings land, each is one JSON in this directory plus one entry in `SAMPLES` in `js/beam/sample-loader.mjs`.

**Cross-app convergence (PDF-Parser polygon → BEAMweb)** is now expressed via the same flat-dict format. PDF-Parser's polygon export → flat keys like `polygon_<id>_area_m2`, `polygon_<id>_component`. BEAMweb's PDF-Parser import handler reads those keys and maps them to `dim_*` keys via the same auto-fill mechanism that bridges PROJECT → assembly tabs. Wires up in Phase 8.

---

## 6. Phase breakdown (revised)

Small, independently-shippable slices:

1. **Phase 0 — Design lock-in + shared dependency manifest + shell stub** ✅ (session 2, merged via PR #6). Dependency manifest at [`PDF-Parser/dependencies.html`](./PDF-Parser/dependencies.html); shell at [`beamweb.html`](./PDF-Parser/beamweb.html) with 18 tabs + stubs; Glossary + Energy GHG populated with real content; nav-btn wired across all apps.
2. **Phase 1 — Shared infra** 🟡 (session 3, stubs landed). `js/shared/state-manager.mjs` + `js/shared/file-handler.mjs` + `js/beam/workbook-mapper.mjs` committed as Phase-1 stubs with full API surfaces. Still pending: `js/shared/units.mjs` (§9 conversions — metric canonical, imperial display), PDF-Parser refactor to consume the shared infra, flesh out per-tab mapping tables in workbook-mapper as assembly tabs port.
3. **Phase 2 — PROJECT tab** 🟡 (session 3, partial). PROJECT form shipped ([`js/beam/project-tab.mjs`](./PDF-Parser/js/beam/project-tab.mjs)) with ~40 fields, L×H×W → computed volume, StateManager persistence. Still pending: dropdown option lists from `Categories.csv`, metric/imperial toggle (needs `units.mjs` from Phase 1), Filter Concrete action, PDF-Parser JSON import button. Derived-totals shell is trivial once assembly tabs start producing numbers.
4. **Phase 3 — First assembly tab end-to-end** ✅ (session 4, `aa33913` → `4e1614b`). `Footings & Slabs` shipped — all 16 groups × 658 materials, 276 with derived EPD factors, group-header configs (THICKNESS / R-VALUE / TOTAL REBAR LENGTH) editable, linear configRatio scaling, per-row + per-group + per-tab subtotals live, collapsed-by-default overview. Parser + tab-renderer pair is now the template for Phase 4. Parity testing against the BEAM workbook (canonical DOE Prototype project) is the next validation step — expected to surface refinements to the linear scaling assumption in `computeRowEmissions`.
5. **Phase 4 — Remaining 11 assembly tabs** 🟡 (queue as of 2026-04-19). Each follows the F&S template via the same `assembly-csv-parser.mjs` + a per-tab module. Ordered smallest→largest to shake out column-shape variants on simple tabs first:
   - `Windows` (62 rows)
   - `Ceilings` (79)
   - `Structural Elements` (115 — different units within one tab: m³ for timber, m for wide-flange steel)
   - `Interior Walls` (154)
   - `Cladding` (161)
   - `Floors` (288)
   - `Roof` (329)
   - `Party Walls` (842)
   - `Exterior Walls` (860)
   - `Foundation Walls` (967)
   - `Garage` (2288 — largest; last, because it may teach us something novel and shouldn't hold up the simpler ports)
   Each tab module is ~200–280 lines following F&S; expect ~30–60 min per simple tab, ~2 hours for the outliers (Structural Elements' mixed units, Garage's volume). Also coming: PROJECT-tab → F&S quantity auto-fill (cross-tab wire, shipped session 5 via `auto-fill.mjs`), `shared/units.mjs` for the metric/imperial toggle. (Categories.csv dropdown option lists for PROJECT Building Type / Construction Type / Project Development Stage shipped session 6 in `7901a09`.)

   **Deferred — 4-column per-row grid**. BEAMs gSheet shows NET / GROSS / STORAGE Short / STORAGE Long as four per-row value columns; BEAMweb currently shows NET per row only and rolls up the other three to the tab-header dashboard tiles. `computeRowEmissions` keeps all four dimensions in the return shape, so restoring the grid is ~10 lines of render + CSS. Restoring is blocked on need, not capability: for non-biogenic materials (concrete / steel / masonry / insulation — ~80% of F&S rows) GROSS == NET and STORAGE cols == 0, so the per-row grid would be redundant ink today. Once the materials DB surfaces per-stage EN 15804+A2 data, biogenic assemblies (timber-framed Structural Elements / Floors / Walls) will have legitimately diverging GROSS / STORAGE values and the per-row grid carries real information — that is the trigger to restore. Reversible at any time if the BfCA team wants exact visual parity with BEAMs sooner.

   **Phase 4b — Building Dimensions data-source selector** (new scope, 2026-04-20). Per-dimension picker on PROJECT letting the user pick the source for each area / volume: **Imported** (from a BEAM workbook / JSON project load — Phase 6's ExcelMapper pathway), **PDF-Parser** (tagged polygons flow through a shared bridge module, reactive to re-measurement), or **Manual entry** (today's default — user types a number). Scope spans three apps:
   - **PDF-Parser side**: finalise the polygon `component` taxonomy so a polygon doesn't just carry `wall_exterior` but targets a specific PROJECT dimension field (e.g. `dim_exterior_wall_area`) with the right units and aggregation rule (summed over all matching polygons in the project). May require the PDF-Parser UI to expose a "target field" picker at measurement time alongside the existing component tag. See §7 Q11.
   - **Shared bridge**: a `js/shared/project-dimensions-bridge.mjs` (working name) module that watches PDF-Parser polygon state and publishes tagged area / volume totals to BEAMweb's StateManager in the same DERIVED / USER_MODIFIED precedence model `auto-fill.mjs` uses for PROJECT → F&S. Cross-app reactivity: when the user re-measures a polygon, the PROJECT dimension updates; when the user types over the PROJECT dimension, USER_MODIFIED wins.
   - **PROJECT tab UI**: per-dimension source pill (three-way toggle) with visual state — grey when not connected, cyan when active, source badge ("Imported" / "PDF-Parser · 3 polygons" / "Manual"). Reset per dimension to clear and pick a new source.

   Bigger lift than any single Phase 4 assembly tab — expect 1–2 sessions, most of it in the PDF-Parser tagging taxonomy + the bridge module. Phase 4 assembly tabs and Phase 4b can run in parallel if we want to shard the work. See §7 Q19 (new).
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
- 🟡 **Q5 (per-m² vs mass-based)** — reference-CSV column labels indicate per-functional-unit intensity × section-config × quantity (see §4.1). Confirm formulas from BEAM CSV export.
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
- Q13: Does BEAMweb need read access to a completed BEAM workbook (full operational + material scope), or only the material-emissions subset?
- **Q19 (new, Phase 4b — data-source selector design)**: (a) Precedence when two sources are active — if the user has both an Imported value from a loaded BEAM workbook AND a PDF-Parser polygon tagged to the same dimension, who wins? Proposal: the last-touched source is DERIVED; only explicit Manual type-in sets USER_MODIFIED. (b) Aggregation rule — when multiple polygons share the same target dimension (say three exterior-wall polygons feeding `dim_exterior_wall_area`), does the bridge sum, take the max, or is ambiguity the user's problem to avoid via tagging discipline? Likely: sum, with a UI affordance showing "3 polygons → 482 m²" so the user can audit. (c) Does the PDF-Parser tagging taxonomy map 1:1 to PROJECT dimensions, or is there a many-to-one fan-in (e.g. multiple polygon-types summing into one dimension) or one-to-many fan-out? (d) Reset semantics — when the user clears a dimension's source, do downstream rows (F&S qtys that auto-filled from it) clear too, or stay sticky? Likely: clear DERIVED downstream, keep USER_MODIFIED. (e) Does a project JSON persist the source selection per dimension (so a reopen restores the "this came from PDF-Parser" state), or does it only persist the final value? Likely: persist the source enum alongside the value, since future reimports of the polygon set need to know which dimensions to refresh vs leave alone.

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
3. **Manual entry fallback** — when no OBJECTIVE project is attached, the PROJECT tab energy fields accept manual kWh / m³ / L / kg inputs (parallels the BEAM workbook today).

What BEAMweb needs from OBJECTIVE for operational energy (provisional):
- Heated floor area, heating degree days, province (already part of both models)
- Annual consumption: electricity (kWh), natural gas (m³), propane (L), oil (L), wood (kg)
- On-site generation (kWh)
- Optionally: TEUI / TEDI targets for side-by-side presentation on REVIEW

BEAMweb applies the Energy GHG factors (tab 18) to produce operational emissions, not OBJECTIVE. OBJECTIVE owns *modelling*; BEAMweb owns *carbon accounting*.

**Sequencing** — design the integration during Phase 7 (previously HOT2000 import); sooner if OBJECTIVE's file format is nailed down. Needs a deeper design conversation with Mark / OBJECTIVE team.

---

## 11. Relationship to sibling workstreams

| Workstream | How BEAMweb uses it | How BEAMweb affects it |
|---|---|---|
| **schema/** (materials JSON DB) | Read-only consumer. `materials/index.json` for the picker; lazy-fetches per-division files for full records. | None direct; may surface new fields BEAMweb needs, which get added to the schema and `sample.json`. |
| **PDF-Parser** | Reads polygon → area / volume data from a shared project JSON. | Will need polygons to carry a material reference + component tag. That's shared work — land it in PDF-Parser's Step 10. |
| **Database viewer** | Could become the picker UI inside BEAMweb (reused as a modal). | No change. |
| **Matrix** | Independent. Linked from the shared nav only. | No change. |
| **OBJECTIVE** | Lift file-handling patterns (xlsx read/write) in Phase 6. In Phase 7, **runtime integration**: OBJECTIVE supplies operational energy inputs (TEUI/TEDI, fuel consumption) via shared project JSON or `saveStateAndNavigate`-style cross-app nav. Replaces HOT2000 direct-parse (Q10 parked). See §10. | Shared project-file format converges with OBJECTIVE's. If OBJECTIVE bumps its schema, BEAMweb's file-handler has to track. Needs design conversation with Mark / OBJECTIVE team before Phase 7 code starts. |
| **EPD PDF parser** (Phase 2 of schema) | When it lands, it fills `impacts.*.by_stage` on material records. BEAMweb will auto-get per-stage totals. | No direct coupling. |

---

## Appendix — Branch + repo state

- `main` sits at `c7a2dcc` (PR #7, "BEAMweb: Phase 1 shared infra + Phase 2 PROJECT + Phase 3 Footings & Slabs", merged 2026-04-19). All Phase 4+ work lives on the feature branch until next merge.
- Active feature branch: `beamweb-tabs-2` on both remotes. Tip as of end of session 6: `6d15584`. 14 commits since PR #7: the session-5 parity work (`0c10b78` → `85fd233`, 12 commits) plus two session-6 polish commits (`7901a09` session-6 polish pass + `6d15584` footnote two-tone split). **F&S is fully parity-validated against the BEAM workbook on every row tested across CONCRETE / REBAR / PILES / SUB-SLAB INSULATION (XPS / EPS / Mineral Wool, including BEAM-Avg).** Session-6 work is entirely cosmetic / UX — no math or architectural changes.
- Sibling apps all on `main`: PDF-Parser, Matrix, Database viewer, BEAMweb Phase 3 (F&S), Landing, Deps manifest — shipped and deployed at `arossti.github.io/OpenBuilding/`. `beamweb-tabs-2` is PR-ready whenever we merge; likely holds for a few Phase 4 tabs first.

---

## Appendix — Changelog

- **2026-04-20 (session 6)** — F&S visibility polish + PROJECT ergonomics + Intro composition + footnote split. Two commits on `beamweb-tabs-2`:
  - `7901a09` — Session 6 polish pass. (a) F&S potential GWP on every row: the display path calls `computeRowEmissions({select: true, ...})` so users can shop by EC; subtotals / tab totals still use `select: vals.select` so only real picks contribute to the rollup. (b) Selected-row QTY turns cyan via `.bw-asm-row-selected .bw-asm-qty-readonly { color: var(--accent-lit) }`. (c) PROJECT Info / Building Dimensions / Garage Dimensions wrapped in the F&S collapsible chrome (new `renderCollapsibleSection` helper + click handler in `wireProjectForm`); Info default-open, Dimensions + Garage default-collapsed with cyan `▶` chevron. `.bw-project-section` emptied — now a semantic marker only since `.bw-asm-group` provides the card chrome. (d) PROJECT Building Type (18 options), Construction Type (6), Project Development Stage (9) switched from free-text inputs to real `<select>` dropdowns via the existing `renderSelect` path; no cross-field deps. Stale "Phase 2.1 wires Categories.csv" legend trimmed. (e) Intro tab centre-aligned via new `.bw-intro` class — outer wrapper `text-align: center`, per-element inline overrides removed, bullets dropped from the How-it-works list so the text reads as a single composed block. (f) Expired footnote re-scoped from `.bw-asm-col-foot.expired` (TH class, dead CSS) to the rendered TD class; grey base rule added. (Purple actually renders now — it never did before.)
  - `6d15584` — Footnote two-tone split. The BEAM CSVs and the BfCA materials DB fuse two signals into the footnote column with a `;` separator — e.g. `Expired 2025; BfCA BioC calc by mass` (BfCA computed biogenic carbon from mass because the source EPD did not report it). The old `truncFoot` hard-sliced at 16 chars, rendering "Expired 2025; Bf…" — garbled. Replaced with `renderFootnote` splitting at the first `;`: primary status tag routed to `.bw-asm-foot-primary` (purple on the `.expired` modifier), suffix routed to `.bw-asm-foot-sub` (dim grey, opacity 0.85). Full text stays in the TD `title` attr for hover. `.bw-asm-foot` gets `white-space: nowrap` so the column auto-widens. Suffix verified across 5 of 8 material groups (concrete / metals / wood / thermal / finishes); same `BfCA BioC calc by mass` suffix every time.
  - **Design call recorded: per-row NET only, 4-column grid deferred** (not shipped — explicit decision). BEAMs gSheet has four per-row columns (NET / GROSS / STORAGE Short / STORAGE Long); BEAMweb today shows NET per row + all four rolled up to the tab-header dashboard. `computeRowEmissions` return shape already carries all four values so restoring is trivial. Rationale: for non-biogenic materials (~80% of F&S) GROSS == NET and STORAGE cols == 0, so the per-row grid would be redundant ink. Trigger to restore: materials DB surfacing per-stage EN 15804+A2 data (then biogenic assemblies get real GROSS / STORAGE divergence). See §6 Phase 4 "Deferred — 4-column per-row grid". Reversible immediately if the BfCA team wants BEAMs visual parity sooner.
  - **Phase 4b scoped, not started** — Building Dimensions data-source selector. Per-dimension picker on PROJECT for Imported / PDF-Parser / Manual sources, with a shared bridge from PDF-Parser polygons to BEAMweb StateManager. Spans three apps. See §6 Phase 4b entry + §7 Q19 for the open design questions.
  - Companion doc edit: Andy's "BEAM" → "BEAMs" disambiguation in §0 Name rationale (distinguishes the BEAMs spreadsheet family from the BEAMweb port).
- **2026-04-19 (session 5)** — F&S parity-validated against BEAM gSheet; calc path rewritten to read factors from the BfCA materials DB. Eleven commits on `beamweb-tabs-2`:
  - `0c10b78` — Cold-start + action-bar foundational fix. `currentValues()` drops sample-bleed fallback. Tilt button removed (OBJECTIVE force-recompute not needed). Reset is per-tab via `TAB_RESETTERS` with confirm modal. New wired to full `StateManager.clear()` + reload. New `StateManager.clearByPrefix(prefix)` helper.
  - `0d93225` — Auto-fill bridge + Load Sample. `js/beam/auto-fill.mjs` listens on PROJECT `dim_*` keys, pushes DERIVED qty to mapped F&S groups. `js/beam/sample-loader.mjs` fetches flat-dict JSON, imports via FileHandler quarantine, re-syncs bridge. First sample at `docs/beam-samples/single-family-home.json` (43 fields). §5.1 retired nested strawman for flat `{ format, version, fields }`. `StateManager.getFieldState()` exposed for provenance checks.
  - `255de83` — `BEAMweb.md` session 5 doc update (first pass, covering commits through `0d93225`).
  - `b826cfa` — Auto-fill precedence fix. Only USER_MODIFIED is sticky; bridge overrides IMPORTED / DERIVED / CALCULATED so PROJECT changes flow to rows that sample-load touched.
  - `8dee661` — F&S qty cells `readonly` (matches BEAM gSheet protected-cell behaviour). Quantities flow from PROJECT only; SELECT / % / group configs stay editable. New `.bw-asm-qty-readonly` styling.
  - `267fac0` — Jurisdiction filter + cascading PROJECT dropdowns. New `js/beam/jurisdictions.mjs` (COUNTRIES, CA_PROVINCES, US_STATES, `inferJurisdiction`, `matchesFilter`). PROJECT Country / Province/State are now selects with country-driven cascade. F&S rows carry `data-jur-*` attributes; `applyJurisdictionFilter()` hides non-matching rows + dangling subgroup wrappers. Banner reports hidden-row count. BEAM-Avg concrete providers (CRMCA) match every CA province; province-specific (Concrete BC / ABQ / Ontario Concrete RMCAO / Atlantic) filter accordingly. USA is country-level only.
  - `9845a4d` — Per-row state keys qualified by full code path (`T01_C01_S04_43fe24` not hash alone) + complete PROJECT→F&S group mapping audit. Fixes the hash-collision bug where same EPD in multiple groups shared state — the 8.965492 leak from CONTINUOUS FOOTINGS into COLUMN PADS. `PROJECT_TO_FS_GROUPS` adds four missing slab-area groups (EARTHEN, MESH, BARRIERS, BASEMENT FLOORING); removes TIMBER PILE (has its own TOTAL VOLUME group config). `findGroup` trims whitespace on both sides.
  - `94ab492` — Per-row factor derivation (unit-mismatch fix). The old first-non-zero-per-hash strategy let a per-m³ concrete factor leak into per-m²-at-6"-slab rows (giving 30,866 instead of 4,704). Each row now derives its own factor from its own sample data. Later refined to (hash, unit) cross-share in `c52f927`.
  - `89f7f14` — Auto-fill bridge rekey. The bridge was writing to old hash-only keys (`fs_43fe24_qty`) after F&S switched to full-code-path keys, so DERIVED writes landed on orphaned state slots. Only one row per group was being populated (the sample IMPORTED one); all others stayed 0. Fixed: bridge now uses the same key shape as F&S.
  - `10f63b9` — Full-precision volume storage with rounded display. `recomputeVolume` no longer pre-rounds 8.965492 → 9.0 before the bridge sees it. CONTINUOUS FOOTINGS NRMCA row now reads 2,506 instead of 2,516 (matches BEAM exactly). Display stays at 2dp via `fmtQty()` / `v.toFixed(2)`.
  - `7d602e7` — Architectural cleanup (audit). Prettier ran across the codebase (615 warnings auto-fixed). Eslint config: added missing browser globals (TextDecoder, HTMLInputElement, XLSX, clearTimeout, location, history). Stale "Phase 0 shell" labels purged from HTML subtitle, status bar, panel pills, file docstrings. Tab phase numbers corrected (PROJECT 0→2, F&S 0→3). Panel pill reads "Phase N · live" for shipped tabs vs "Unlocks Phase N" for queued. Helper consolidation: `codeToDomKey()` extracted into [`assembly-csv-parser.mjs`](./PDF-Parser/js/beam/assembly-csv-parser.mjs) so F&S + auto-fill can't drift apart on key shape — this was the bug class behind the rekey miss above. 2dp quantity display everywhere.
  - `c52f927` — Group-config → row-qty bridge for "TOTAL ..." configs + (hash, unit) factor sharing. `propagateConfigToRowQty(group)` writes DERIVED qty to all rows when METAL PILE TOTAL LENGTH / TIMBER PILE TOTAL VOLUME / REBAR TOTAL REBAR LENGTH changes. `groupConfigRatio` returns 1 for TOTAL configs. Parser cross-share restored but keyed by (hash, unit) — concrete's per-m³ and per-m² factors stay distinct.
  - `8bee3f4` — Materials-DB as single source of truth. The sample-derived factor approach (reverse-engineering from the assembly CSV's pre-computed NET column) is deleted. New [`js/beam/materials-db.mjs`](./PDF-Parser/js/beam/materials-db.mjs) loads `schema/materials/index.json` (the same catalogue Database viewer uses). `getMaterial(hash)` returns the full entry; `convertQtyToMaterialUnit(rowQty, rowUnit, dbEntry, group, getValue)` handles unit mismatch (m² row + m³ material via group THICKNESS). Parser simplified: no factors, no cross-share, just structure + sample UI state. `computeRowEmissions({select, qtyInMaterialUnit, pct, gwp})` is now pure math. Parity verified: FOOTINGS Concrete 2501-3000 NRMCA = 2,792 ✓, SLABS Concrete 0-2500 NRMCA = 4,704 ✓, METAL PILE Helical pier @ 10m = 176 ✓, METAL PILE Krinner E140x1600 @ 10m = 442 ✓, METAL PILE AGS IM4516 @ 10m = 412 ✓, TIMBER PILE Wood/SPF @ 12m³ = 757 ✓. `groupConfigRatio` now returns 1 for THICKNESS too (unit converter handles it); R-VALUE left as linear configRatio proxy (resolved in `85fd233`).
  - `910ebb1` — BEAMweb.md session 5 doc refresh (first full update covering commits through `8bee3f4`).
  - `85fd233` — R-VALUE via m²·RSI unit conversion + client-side BEAM-Avg compute. Last technical parity gap closed. Insulation EPDs in the BfCA DB carry `functional_unit: "m2•RSI"` (kgCO2e per m² per RSI) — the R-VALUE config converts via RSI = imperial_R / 5.678, not a linear scaling ratio. `convertQtyToMaterialUnit` handles the new (m² row + m²·RSI material) path; `normalizeUnit` maps "•" / "·" → "*". `groupConfigRatio` collapsed to `return 1` (every scaling config in F&S now flows through the unit converter or the config-qty bridge). For "BEAM Avg" entries with null GWP: `loadMaterialsDb` now also fetches the 8 per-group JSONs in parallel so entries gain `is_beam_average` + `material_name` fields. New `resolveBeamAverage(entry, peers)` helper averages peer GWPs and mutates the DB entry in-place. F&S runs it between parse and render across every subgroup. Verified across 13 SUB-SLAB INSULATION rows: XPS BEAM-Avg (`a94mfe`) = 1,062 ✓, EPS Type IX = 842 ✓, Mineral wool NAIMA = 1,326 ✓, SOPREMA = 375 ✓, legacy HFC-filled XPS = 11,822 ✓. User-modified R scales correctly (R-20 → ~2,123 on XPS BEAM-Avg, linear in R as expected from the m²·RSI unit model). **F&S parity with BEAM gSheet is now complete.** No remaining technical parity work.
- **2026-04-19 (session 4)** — Phase 3 shipped + Database viewer restructured. Three commits on `beamweb-tabs`:
  - `aa33913` — First live assembly picker. New `js/beam/assembly-csv-parser.mjs` (generic, covers all 12 assembly tabs) + `js/beam/footings-slabs-tab.mjs` (consumes parser, renders 16 groups × 658 materials, 276 with derived EPD factors). Group-header configs editable inline with linear `configRatio` scaling; per-row select/qty/pct wired to StateManager with localStorage autosave; group + tab subtotals compute live. CSV staged into `PDF-Parser/data/beam/` via extended `stage:data` npm script and Pages workflow step; staged copy gitignored.
  - `0ffaedb` — F&S polish: groups collapsed by default on first load (overview view first), sticky-header gap fix so scrolled picker rows don't peek through above the totals strip (bleed sticky header into `#beam-content` padding via negative margins + `top: -20px`). Database viewer `Division` → `Groups` rename (filter label, element IDs, function names; Matrix's legitimate "VBBL Division B" regulatory citation untouched).
  - `4e1614b` — Broader interaction + Database restructure. F&S: entire group-header bar is now clickable for expand/collapse with inline config inputs passing through via a `.bw-asm-cfg` guard in the click handler. BEAM app logo added to the Introduction tab (`bw-intro-logo`, 180px, centered). Database viewer restructured to mirror F&S: collapsible group sections when browsing (8 collapsed sections on first load); automatically flattens to the old flat sorted list when search or chip filter is active. Old Collapse button repurposed as `db-expand-toggle` with live-updated "Expand all" ↔ "Collapse all" label. Group-section banners styled with 16px page-edge padding + rounded corners + cyan hover state to echo BEAMweb's assembly-tab visuals.
  **Phase 4 queue locked**: 11 remaining assembly tabs (Windows 62 → Garage 2288), ordered smallest-first; template pattern is now the F&S pair. Open items for parity: linear configRatio scaling is a first guess for thickness / R-value / rebar-length relationships; mismatches vs the BEAM workbook will tell us where the formula needs refinement. Material-DB cross-reference for zero-sample materials (TIMBER PILES, custom EPDs) deferred to a follow-up after parity validation.
- **2026-04-18 (session 3, late-stage fix `3ea823e`)** — gviz→xlsx switch. Andy caught that the Footings & Slabs tab has 749 rows in the sheet but our committed CSV was 317 (58% missing). The `gviz/tq?tqx=out:csv` endpoint silently truncates at the last contiguous data block — any visual gap in the sheet ends the export. Across every assembly tab with a picker, gviz was dropping 40-93% of the data. Replaced the `.mjs` gviz fetcher with `schema/scripts/fetch-beam-sheet.py` using `/export?format=xlsx` + openpyxl (`data_only=True` reads cached formula values). All 22 CSVs re-fetched at full depth. Net +5,428 lines of real data. §2.3.1 added documenting the verified banner-row structure (six distinct inline configs just on F&S: CONCRETE SLABS/THICKNESS, SUB-SLAB INSULATION/R-VALUE, three REBAR/TOTAL REBAR LENGTH, AGGREGATE BASE/THICKNESS). §4.4 updated noting `#NAME?` hazard is scoped to runtime xlsx ingest, not to the committed CSVs. Big catch — Phase 3 built against the old truncated F&S would have missed slabs, sub-slab insulation, rebar, mesh, piles, and aggregate base.
- **2026-04-18 (session 3)** — Phase 1 shared-infra stubs + Phase 2 PROJECT tab shipped. Six commits on `beamweb-tabs`: `94edfbf` (link flip + first CSV batch, later superseded), `6b234b3` (BEAM gviz fetch script + 22 canonical CSV snapshots, ~94% smaller than the Excel round-trip — later proven truncated; see follow-up entry above), `26daac0` (state-manager + file-handler + workbook-mapper stubs, ESM, no dual-state, `window.BEAM.*` namespace), `afef962` (BEAM app logo added to BEAMweb header only; `color-scheme: dark` CSS token override), `c98cc93` (PROJECT tab live — three-section form, ~40 fields, L×H×W volume compute, StateManager-backed persistence, localStorage autosave), `2e31f19` (theme-dark `color-scheme` + `accent-color` tokens — native spinner arrows render visible instead of near-black). **Parity-then-migrate decision recorded:** BEAMweb first ships matching the BEAM workbook's precomputed per-row emissions values; once the BfCA team validates functional parity against the Google Sheet on a canonical project, BEAMweb migrates to consuming `schema/materials/` directly (unlocks the 10 impact categories × 17 EN 15804+A2 stages the schema already carries). See [`schema/schema.md`](./schema/schema.md) §0 for the schema-side record of this plan.
- **2026-04-18 (session 2, wrap-up)** — Added §4.4 documenting the `#NAME?` CSV-import hazard: BEAM workbook uses cross-sheet functions for unit conversion (sf/sm, ft/m, cf/cm, lb/kg); when those don't resolve in the exporting environment the CSV drops `#NAME?` into the cell. Importer should treat as soft-null sentinel, infer unit from column context, log to import report, never propagate into project JSON. Updated §0 status to reflect Phase 0 shipped and added explicit IP rules block referencing `CLAUDE.md`.
- **2026-04-18 (session 2, IP neutralisation)** — Precautionary scrub to defuse copyright-troll scraping of the Pages site. Removed `CSI`/`MasterFormat`/`Division` terminology from all code and served data; renamed `division_prefix` → `group_prefix`; dropped `division_name`, `csi_masterformat`, `uniformat_level2` fields. Removed MCE²/NRCan/Crown references from user-facing copy. Matrix left alone (regulatory-program citations are legitimate). Material DB regenerated (822/822 validates). See commit `8d730ab`.
- **2026-04-18 (session 2, Q11/Q16/Q10 resolved)** — Polygon → component mapping locked in: tag at measurement time in PDF-Parser (user knows the context when placing the polygon). Units contract locked in: metric canonical in storage, imperial at display time only, per-user toggle persisted in localStorage; new §9 documents a planned `PDF-Parser/js/shared/units.mjs` for Phase 1. HOT2000 direct-parse parked indefinitely (may never happen); replaced by Phase 7 OBJECTIVE integration for operational energy — new §10 sketches the direction. Phase breakdown + relationships updated accordingly.
- **2026-04-18 (session 2, ref tabs)** — Glossary + Energy GHG tabs ship as Phase 0 informational. 48 glossary terms (abbr / full / description, with live search) and 13-province × 5-fuel-factor Energy GHG table live at `PDF-Parser/js/beam/reference-data.mjs`. CSVs at `docs/csv files from BEAM/{Glossary,Energy GHG}.csv` now redundant and safe to delete. Q14 (app location) marked resolved: shipping at `PDF-Parser/beamweb.html` + `js/beamweb.mjs` + `js/beam/reference-data.mjs`.
- **2026-04-18 (session 2)** — Doc revised after Andy's review. Tab list resolved (BEAM authoritative, 17 tabs + Energy GHG optional); nav-btn label set to `BEAM`. Section 2.3 added — assembly-tab pattern discovered from MCE² CSVs in `docs/csv files from BEAM/` (inline material toggle rows per tab, pre-curated subset of the 821-material DB, per-row SELECT+QUANTITY+%, section-level config like thickness/R-value). Section 4 populated with calc shape inferred from MCE² column labels; exact formulas await BEAM CSV exports from Andy's unlocked workbook. Section 7 open-questions re-triaged with answers/partials. Phase breakdown revised (10 phases). Goal 5 added — calculation graph consideration.
- **2026-04-18 (session 1)** — BEAMweb workstream spun up. Document seeded with scaffold + open questions. Schema Phase 3 (standalone material picker) explicitly subsumed: the picker becomes inline toggles inside BEAMweb assembly tabs rather than a PDF-Parser feature.
