# PDF-Parser ↔ BEAMweb Bridge — workplan + design spec

> **Cross-app bridge: PDF-Parser polygons → BEAMweb PROJECT dimensions.** This is the Phase 4b detailed spec scoped in [BEAMweb.md §6](./BEAMweb.md) + [§7 Q19](./BEAMweb.md). Read BEAMweb.md §0, §5.1, and §7 Q19 first for the parent-workstream context (state model, flat-dict project JSON, source precedence).
>
> **Status:** Phase 4b.2 (bridge MVP) shipped on `PDF-Bridge` branch, 2026-04-21. End-to-end flow working: Parser persists to IndexedDB, BEAMweb reads + aggregates, "Import from PDF-Parser" modal previews and writes dims. See [§0 Shipped update](#shipped-update--2026-04-21) for the commit list and architectural deltas from the original spec.

---

## 0. Cold-start handoff (read this first)

### Status as of 2026-04-20 (design spec, pre-implementation)

- Design agreed in principle with Andy 2026-04-20 around: (a) per-dim source selector with auto-sync + active-pull semantics, (b) generic component tags + lookup-table translation to dim fields, (c) polyline tool for linear features (interior walls, interior footings) in red, (d) elevation-drawn exterior walls with windows netted as the preferred path for above-grade wall areas, (e) numbered UI labels on quantitative PROJECT inputs, (f) fidelity badge with sheet references, (g) wizard mode shelved (training path via BfCA).
- **No code yet.** Implementation sequenced in §6.
- **Dependency chain:**
  1. PDF-Parser Step 10 (component taxonomy + polyline type + red stroke + sheet denorm)
  2. BEAMweb PROJECT "geometry parameters" concept (new `param_*` fields)
  3. Shared bridge module `js/shared/polygon-map.mjs`
  4. Source selector UI + fidelity badge on each PROJECT dim row
  5. Numbered labels pass (trivial, can land anytime)
- **Current reality.** PDF-Parser polygons carry `{id, label, vertices, closed, type: area|window, mode: net|add}` per [`polygon-tool.mjs`](../../js/polygon-tool.mjs). No component tag. No depth. `volumes[]` stub exists in [`project-store.mjs`](../../js/project-store.mjs) but empty. Sheet classification (plan/section/elevation) is tracked via [`sheet-classifier.mjs`](../../js/sheet-classifier.mjs) but semantically inert — doesn't influence measurement semantics. See BEAMweb.md §0 Phase 4b entry for audit findings.

### Team feedback — 2026-04-20

Four items from the BfCA team meeting threaded into the spec. Summary + where each one lives:

1. **Stale BEAM workbook + materials DB sources.** The 22 BEAM tab CSVs committed session 3 (`3ea823e`) were fetched from an older workbook URL. Current authoritative URLs are the Google Sheets in the `external-links` footnote below. Refresh pass pending. See §7 **Q27**.
2. **"EPD Only" filter on Database viewer narrows 821 → 380.** Melanie flagged concern: all 821 entries were informed by EPDs per her review of the import, so the 380 filter number reads like there's missing EPD provenance on ~440 rows. Investigation item — likely a mis-labelled filter criterion (filtering something narrower than "has EPD data"), not a data gap. See §7 **Q28**.
3. **Biogenic status flags showing `method: none`.** Database viewer's detail pane reads `biogenic_factor=—  carbon_content=— kgC/kg  full_C = — kgCO2e  stored = — kgCO2e` for rows where biogenic carbon is expected (wood, biogenic insulation). Either a data gap (likely resolved by Q27 refresh), a UI rendering bug (reading the wrong field), or an onboarding-friction gap (Melanie may not have seen where biogenic lands in the schema yet). See §7 **Q29**.
4. **Assembly-preset picker on wall polylines.** Current workflow (BEAM gSheet-style) requires the user to manually tune percentages across framing + cladding + insulation after the picker populates rows. Melanie's ask: when the user draws a wall polyline (red), offer an assembly preset — "Wood 2×4", "Wood 2×6", "Steel stud", etc. — which seeds the downstream F&S-style assembly tab with sensible default percentages the user can still tune. This is a meaningful UX + data addition. See §3.2 (polyline components extended), §5.7 (new preset UX), §6.3 (sequencing), and §7 **Q30** (open design questions).

**External links (non-gitignored — live-only references):**
- BEAMs workbook: `https://docs.google.com/spreadsheets/d/1LjOpDTjfGQvvfRGCpDb8KkHcUtHzUC5UbvfV-wXy13g/edit?gid=175800287#gid=175800287`
- BfCA Materials DB: `https://docs.google.com/spreadsheets/d/1-gd2iH7UIoDuEt7gIC35PbgJf2sO5go9IwjkSxue-UA/edit?gid=170425505#gid=170425505`

Record kept here (not in app code) because these are source URLs for upstream refresh, not runtime fetches. When Q27 refresh lands, the committed CSVs in `docs/csv files from BEAM/` and the JSONs in `schema/materials/` update from these sources.

### Shipped update — 2026-04-21

Phase 4b.0 through 4b.2 shipped on `PDF-Bridge` (merged to `main` as PR #1, 2026-04-21). Follow-on work continues on `PDF-Bridge-2` — F&S flow fix + §8 planning note + dependency-graph stub.

**Active branch:** `PDF-Bridge-2` (based on `main` after PR #1 merge). Future agents: `git checkout PDF-Bridge-2` to continue; `git log main..HEAD` to see work since the merge.

**Testing status:** PR #1 merged based on the test checklist in its body, **without explicit verification runs**. Andy flagged a post-merge regression that became `85dd39d` (F&S did not flow from imported PROJECT values); verified by Andy in-tab afterward. Second-round testing of the full Import → Apply → F&S loop on `PDF-Bridge-2` is in progress as of end-of-session 2026-04-21. Multi-tag extension (see Q31) is the next round of tagging work.

**Commits on `PDF-Bridge` (merged to `main`, in order):**

| Commit | Scope |
|---|---|
| `f93217d` | Phase 4b.0 — numbered labels on 30 quantitative PROJECT inputs |
| `529e297` | Phase 4b.1 — PDF-Parser polygon schema + polyline type + component-tag picker |
| `f07181b` | Phase 4b.1 — BEAMweb `param_*` fields + `dimension_sources` map |
| `cd0b2a2` | Summary Table + CSV: Type + Tag columns on every row |
| `5e9e22d` | Summary Table + CSV: Preset column |
| `f907888` | IndexedDB autosave + cross-session restore in PDF-Parser |
| `74f6108` | `target="_blank"` on inter-app nav (side-by-side tab workflow) |
| `9efed2d` | Phase 4b.2 — bridge aggregator (`polygon-map.mjs`) + BEAMweb import modal |
| `2e8c31d` | 0.00→— fix; sheet-title fallback to classification; inline Tag + Preset selects |
| `3367bf8` | PDF-Parser sidebar Geometry Parameters panel + bridge fallback to Parser params |
| `f4e590d` | Cross-feeds: one polygon serves multiple dims (slab area + slab perimeter) |
| `a49d02d` | Polyline-tool hit-test guard + workplan doc update |

**Commits on `PDF-Bridge-2` (in-flight, not yet merged, in order):**

| Commit | Scope |
|---|---|
| `85dd39d` | Post-import flow fix: `syncProjectToFsBridge()` + LHW decomposition so F&S picks up imported values |
| `101b6e9` | BEAMweb.md §8 — planning note for eventual dependency-graph migration (listener → graph) |
| `e492cad` | Dependency Graph stub: StateManager.exportDependencyGraph + new tab 19 + OBJECTIVE-shape scaffolding |

**Architectural deltas from the original spec:**

- **Cross-tab persistence via IndexedDB** was not in the original spec. Added to solve the "reload PDF every time you switch apps" problem. Stores full project JSON + PDF blob keyed by uuid. Doubles as the cross-tab bus — BEAMweb reads PDF-Parser's saved projects directly from the same origin's DB, no BroadcastChannel or postMessage needed.
- **Multi-tab workflow (`target="_blank"`)** replaces the implicit single-tab assumption. Each app lives in its own tab so the Parser can stay alive with a loaded PDF while BEAMweb pulls takeoffs next door.
- **Parser-side Geometry Parameters panel.** The original spec put `param_*` inputs only on BEAMweb's PROJECT tab. Shipped mirror on the Parser sidebar so drawing-adjacent scalars (wall height, roof pitch, footing dims) can be entered without context-switching. Values write to `project.params` in IndexedDB; BEAMweb reads them as a fallback when its own StateManager params are blank.
- **Cross-feeds**, new: one polygon feeds multiple dims. `slab_foundation` polygon's area → foundation slab + below-grade + total floor; same polygon's perimeter → foundation wall (× basement height) + continuous footings (× H × W). `slab_above_grade` polygon's perimeter is a fallback for exterior wall area when no elevation walls are drawn. Explicit tags (`exterior_perimeter`, `wall_exterior`) supersede implicit cross-feeds when present. See §3.6.
- **Manual Import button instead of auto-reflow.** Original spec (§2.2, §2.4, Q21) described a "source selector pill per dim" with auto-reflow on polygon change. Shipped: a single "Import from PDF-Parser" button in BEAMweb's action bar that opens a preview modal with per-dim checkboxes. User explicitly applies selected rows. Simpler, predictable, no dialogs asking to overwrite USER_MODIFIED values mid-session. Per-dim source pills can still land later if the single-button model proves limiting.
- **Inline Tag + Preset re-editing.** Summary Table rows now render Tag and Preset as `<select>` cells that re-classify a polygon in place. User-friendlier than "pick polygon on the plan to edit its tag."

**What's NOT shipped yet (still pending):**

- **Source selector widget** (§5.1) — replaced for now by the global Import button. Revisit if users want per-dim source control beyond "apply this import and stop."
- **Fidelity badge inline under each dim input on PROJECT** (§5.2). Import modal's "Source" column covers this during import; PROJECT tab does not yet annotate imported values.
- **Auto-re-run on polygon change** (Q21) — explicit Import-button workflow instead.
- **Sheet-class validation banners on offending polygons** (§3.4). Warnings surface in the Import preview only, not inline in the Parser UI.
- **Clickable sheet refs / deep links** from fidelity text to the Parser at a specific sheet (§5.2 end). Trivial to wire once we add the URL-fragment protocol.
- **`depth_m` field + column/pad volume** (§6.4 / Phase 4b.3).
- **Cross-app bulk "Use PDF-Parser for all" action** (§6.5 Phase 4b.4).
- **Assembly-preset wire-through to Phase 4 tabs** (§6.6 Phase 4b.5) — presets persist on polygons but no assembly tab consumes them yet.

### What the bridge does

A user draws polygons in PDF-Parser across plan views, elevations, and (future) sections. Each polygon carries a `component` tag picked at measurement time. The bridge aggregates matching polygons across sheets and flows derived values into BEAMweb PROJECT dimension fields via `StateManager.setValue(fieldId, value, VALUE_STATES.DERIVED)`, with the per-dim source set to `pdf-parser`. User manual edits (USER_MODIFIED) override; the selector can be toggled to re-flow on demand.

Some dimensions derive directly from polygons (slab area = Σ plan polygons tagged `slab_foundation`). Some need a project-level parameter the user enters manually on PROJECT (e.g., `param_wall_height_m` converts perimeter/polyline length into wall area). Some need Step 10's per-polygon depth (pad/pier volumes). A few stay manual forever (timber framing volume — not a takeoff concept).

### What the bridge does NOT do

- **No HOT2000 parsing.** Operational energy is [BEAMweb.md Phase 7](./BEAMweb.md)'s problem.
- **No schedule parsing.** Window schedules stay manual unless drawn on elevation sheets.
- **No timber takeoff.** Heavy timber elements are discrete line items, not a drawing-takeoff product. Belong on Structural Elements tab, not summed on PROJECT. See §1 Non-goals.
- **No cross-project polygon sharing** (see BEAMweb.md §7 Q12).

### Where to pick up next (cold-start one-liner)

`PDF-Bridge` is merged to `main` (PR #1). Active branch is `PDF-Bridge-2` with three commits in flight (see the table above). Next agent: `git checkout PDF-Bridge-2`, read §7 Q31 for Andy's latest ask, skim the PR #1 test plan to see what's been verified so far. Natural follow-ups in priority order:

1. **Multi-tag extension (Q31)** — Andy's next-round tagging work. Collect the specific tag→dim mappings he wants added, extend `COMPONENT_TO_DIMENSION.crossFeeds` entries in [polygon-map.mjs](../../js/shared/polygon-map.mjs). No structural code changes.
2. **Phase 4b.3 — `depth_m` + pad/pier volume** (§6.4). Schema field on polygons + UI input + aggregator path. ~200 lines, self-contained.
3. **Fidelity badge on PROJECT dim inputs** (§5.2) — render the `dimension_sources` string under each imported dim's input so provenance is visible without opening the Import modal. ~100 lines in [project-tab.mjs](../../js/beam/project-tab.mjs).
4. **Clickable sheet deep-link** — `pdfparser.html#sheet=A-301` URL fragment protocol. ~80 lines both sides.
5. **Bulk "Use PDF-Parser for all" action** — one-click variant of the Import modal that applies every computable dim. ~40 lines on top of existing `applyImport`.
6. **Garage scope boolean (Q23)** — unlocks all garage dim mappings.
7. **Phase 4b.4 polish** + **Phase 4b.5 assembly-preset wire-through** (gated on Phase 4 assembly tabs porting).

---

## 1. Goals

1. **Automate what's automatable.** A user should produce most of PROJECT's 13+ Building Dimension inputs from PDF-Parser polygons + a short list of project-level parameters, without re-entering numbers.
2. **Be honest about the 2D→3D gap.** Dimensions that can't be derived (timber volume, roof surface without pitch, etc.) show "Manual" as the source clearly — no silent defaults, no guessed values.
3. **Allow clean swapping between sources.** Per-dim picker for Imported / PDF-Parser / Manual. Re-flow on demand.
4. **Preserve user edits.** USER_MODIFIED stays sticky; source re-selection shows a confirmation before overriding.
5. **Stay within the flat-dict project JSON contract** ([BEAMweb.md §5.1](./BEAMweb.md)). Add fields, don't restructure.
6. **Leverage sheet classification as a semantic signal.** Sheet class informs which derivation path fires (elevation-drawn wall_exterior → surface area direct; plan-drawn exterior_perimeter → × param_wall_height_m fallback).

### Non-goals

- Perfect round-tripping of every BEAM workbook dimension.
- Non-polygonal measurement workflows (dimension strings, annotations — PDF-Parser doesn't produce them).
- Multi-building projects (one project = one building, per the existing app-wide assumption).
- Timber framing volume from drawings — it's a discrete-element tally, not a takeoff. Stays manual or lands as line items on the Structural Elements assembly tab.

---

## 2. Architectural model

### 2.1 Source enum + per-dim source state

Four source states per PROJECT dimension:

| State | Meaning | UI appearance |
|---|---|---|
| `unset` | Cold-start or post-Reset — no value + no source declared | Grey pill, "Select Source" |
| `imported` | Value came from Load Sample or a workbook import | Blue pill, "Imported" |
| `pdf-parser` | Value came from the bridge aggregating tagged polygons | Cyan pill, "PDF-Parser · {detail}" |
| `manual` | User typed it | Amber pill, "Manual" |

Source lives in a new StateManager map, **distinct from the existing `VALUE_STATES` enum**. VALUE_STATES remains the precedence authority (tracks the provenance of a single write — DERIVED vs USER_MODIFIED vs IMPORTED vs CALCULATED). Source is the user's declared preference for where this dim should get its value from. They inform each other but play different roles.

**New StateManager API:**

```js
StateManager.getDimensionSource(fieldId)       // "unset" | "imported" | "pdf-parser" | "manual"
StateManager.setDimensionSource(fieldId, src)  // sets + fires "source-change" event
```

Source + value persist together in the project JSON via a parallel map:

```json
{
  "format": "beamweb-project-v1",
  "version": "1.0",
  "fields": {
    "dim_foundation_slab_floor_area": "110.4",
    "param_wall_height_m": "2.7"
  },
  "dimension_sources": {
    "dim_foundation_slab_floor_area": "pdf-parser",
    "param_wall_height_m": "manual"
  }
}
```

### 2.2 Dual-purpose source selector

The per-dim source toggle is both display + action:

- **Reading** — reflects whichever source last wrote the value. Auto-syncs:
  - User types in the input → selector flips to Manual
  - Load Sample fires → selector flips to Imported (for every dim the sample touches)
  - PDF-Parser polygon change fires → selector stays PDF-Parser (if already set) or does nothing (if on Manual/Imported)
- **Writing** — picking a source *triggers a re-flow from that source*:
  - `pdf-parser` → bridge pulls current polygon state, overwrites dim (after confirm if USER_MODIFIED)
  - `imported` → if a loaded project JSON has a value, re-apply; else no-op
  - `manual` → unlocks the input; value stays where it was; next keystroke writes
  - `unset` → clears the dim value + source state

This "last-touched source wins" precedence ([Q19a resolved](./BEAMweb.md)) keeps the single-user flow natural: whatever action wrote the value last is the source.

### 2.3 Reset semantics

- **Reset Tab** (existing action on PROJECT) clears all dim values + sets all dim sources → `unset`.
- Reset does NOT touch:
  - PDF-Parser polygon state (lives in the PDF-Parser app's own StateManager scope / project-store)
  - Last-loaded workbook quarantine
- User re-selects `pdf-parser` or `imported` after Reset → data flows back in fresh. This is how a user can "rollback PROJECT edits without losing the drawing work."

### 2.4 Cross-app state flow

```
[ PDF-Parser polygons ]        ← drawn by user with sheet class + component tag
         │
         ▼  polygon-change event
[ js/shared/polygon-map.mjs ]  ← aggregates by component tag, applies params, emits dim values
         │
         ▼  StateManager.setValue(dimId, value, VALUE_STATES.DERIVED)
[ BEAMweb StateManager ]
         │
         ▼
[ PROJECT tab UI renders + auto-fill.mjs flows to F&S + Phase 4 tabs ]
```

Bridge runs on:
- Explicit user action (source toggle → `pdf-parser`, bulk "Use PDF-Parser for all" action)
- PDF-Parser polygon change event (debounced ~500ms)
- Parameter change event (user edits `param_wall_height_m` → re-derives any dim that multiplies by it)

Bridge does NOT run on:
- Every keystroke (debounced)
- Values flagged USER_MODIFIED, without user confirm

### 2.5 Project-level parameters — new concept

Some dimensions need a value that no polygon can provide. These get new `param_*` fields on PROJECT, rendered in a new subsection (proposal: "Geometry Parameters", sits between Building Dimensions and Garage Dimensions).

**MVP parameter set:**

| Param field ID | Label | Unit | Feeds which dim(s) |
|---|---|---|---|
| `param_wall_height_m` | Wall Height | m | exterior_wall_area, interior_wall_area, party_wall_area |
| `param_basement_height_m` | Basement Wall Height | m | foundation_wall_area |
| `param_roof_pitch_deg` | Roof Pitch | deg | roof_surface_area (pitch factor = 1/cos(θ)) |
| `param_footing_height_m` | Continuous Footing Height | m | continuous_footings_volume |
| `param_footing_width_m` | Continuous Footing Width | m | continuous_footings_volume |

**Key property**: parameters are always `manual` source only — no takeoff path. They render as **required inputs when any dependent dim is sourced from PDF-Parser polyline/perimeter**. Blank param + perimeter polygon = bridge emits a "needs `param_wall_height_m`" fidelity badge instead of a value, making the missing input obvious rather than silently defaulting to 0.

---

## 3. Polygon taxonomy — Step 10 extension

### 3.1 Polygon type enum (extended)

Current: `type: area | window`. Extend to:

- `area` — closed polygon, computes area. Unchanged behavior. **Cyan** stroke.
- `window` — closed polygon inside an `area` polygon, nets out via `mode: net`. Unchanged. **Yellow** stroke.
- **`polyline`** (NEW, Step 10) — unclosed polyline, computes length only. **Red** stroke. Used for interior walls + interior footings that can't be derived from an enclosing area polygon's perimeter.
- **`point`** (NEW, Step 10b deferred) — single-vertex marker for columns/piers locations. Deferred — for MVP, individual pads are tagged as small `area` polygons at the pad footprint, using Step 10's `depth_m` for per-pad depth.

### 3.2 Component tag enum (v1)

Picked from a dropdown at measurement time, filtered by polygon type + sheet class.

**Closed polygons on plan sheets** (`type: area`, cyan):
- `slab_foundation` — below-grade slab / basement floor
- `slab_above_grade` — above-grade framed floor footprint
- `ceiling_override` — only if user wants to draw it separately; MVP derives from `slab_above_grade` automatically (Andy's 3-for-1 insight)
- `pad_pier` — discrete column/pad footprint (one polygon per element)
- `exterior_perimeter` — exterior wall centerline traced as a closed polygon, used as **fallback** when elevations aren't available (perimeter × `param_wall_height_m`)
- `roof_plan` — roof footprint in plan view (converted to surface area via `param_roof_pitch_deg`)
- `roof_cavity` — roof cavity insulation area (flat roofs ≈ plan area; sloped will need handling — see Q22 in §7)

**Closed polygons on elevation sheets** (`type: area`, cyan; **preferred path for above-grade walls**):
- `wall_exterior` — exterior wall surface per elevation. Net of windows automatically via `mode: net` window polygons drawn inside.
- `wall_party` — shared / party / demising wall surface
- `window` (`type: window`, yellow) — drawn inside a wall polygon; nets out the enclosing area

**Unclosed polylines on plan sheets** (`type: polyline`, red):
- `wall_interior` — interior partition centerline; Σ length × `param_wall_height_m` = interior wall area
- `footing_interior` — interior footing beneath a load-bearing wall; Σ length × `param_footing_height_m` × `param_footing_width_m` = volume

Polyline polygons tagged `wall_interior` (and, by extension, any perimeter polygon tagged `exterior_perimeter` that feeds a wall area) carry an additional **`assembly_preset`** attribute. Picked at measurement time alongside the component tag. See §5.7 for the UX; §7 Q30 for the open design questions (preset catalogue, percentages source of truth, multi-preset-per-dimension semantics).

**Section-sheet components** (deferred to v2) — most section-derived values are covered by project parameters for v1.

### 3.3 Polygon metadata additions (Step 10 schema)

```json
{
  "id": "poly_...",
  "label": "...",
  "vertices": [...],
  "closed": true,
  "type": "area",
  "mode": "net",
  "component": "wall_exterior",
  "depth_m": null,
  "sheet_id": "A-301",
  "sheet_class": "elevation",
  "assembly_preset": null
}
```

**New fields:**
- `component` — enum value from §3.2, picked at measurement time
- `depth_m` — optional, null by default; populated for `pad_pier` type via a measurement-dialog input
- `sheet_id` — denormalized from parent sheet for bridge convenience (saves a lookup)
- `sheet_class` — denormalized from [`sheet-classifier.mjs`](../../js/sheet-classifier.mjs)
- `assembly_preset` — optional, null by default; populated for `wall_interior` / `wall_exterior` / `exterior_perimeter` / `wall_party` when the user picks a preset from §5.7 (`wood_2x4`, `wood_2x6`, `steel_stud_3_5`, etc.). Seeds the Phase 4 assembly tab's picker-row percentages; user can still tune.

Sheet denormalization makes polygon records self-contained — the bridge doesn't need to reach back into PDF-Parser's sheet map at aggregation time.

### 3.4 Sheet-class awareness (finally semantic)

The bridge uses `sheet_class` to pick the right derivation path and to validate polygon placement:

| Polygon combination | Bridge behavior |
|---|---|
| `wall_exterior` on `elevation` sheet | Preferred path — direct surface area |
| `wall_exterior` on `plan` sheet | Flag error ("draw exterior walls on elevations, or use `exterior_perimeter` + `param_wall_height_m` fallback") |
| `exterior_perimeter` on `plan` sheet | Valid fallback; multiplies by `param_wall_height_m` |
| `window` on `plan` sheet | Flag error ("windows must be drawn on elevations") |
| `slab_foundation` on `elevation` or `section` sheet | Flag error |
| `wall_interior` polyline on `elevation` | Flag error (polylines only on plans for v1) |
| `roof_plan` on plan sheet | Valid |

Validation surfaces as a subtle banner in the PDF-Parser UI next to the offending polygon, plus a "X polygons have placement issues" banner on the PROJECT source-selector if unresolved. Non-blocking — user can ignore.

### 3.5 Fallback visibility (Andy's ask)

When the bridge falls back from a preferred path to a secondary path, the fidelity badge shows it explicitly:

- Preferred (elevations present): `PDF-Parser · 4 elevation polygons · A-301, A-302, A-303, A-304`
- Fallback (elevations absent, plan perimeter used): `PDF-Parser · plan perimeter × param_wall_height_m · A-101 · ⚠ elevations preferred`

The `⚠ elevations preferred` inline warning makes the fallback visible, not silent.

### 3.6 Cross-feeds: one polygon feeds multiple dims (added 2026-04-21)

A plan-view polygon carries two geometric quantities that both describe useful things: its **area** (the slab / floor surface) and its **perimeter** (the slab / floor edge — which is also the foundation wall footprint, the continuous footing run, and the above-grade exterior wall run depending on which floor it's on). Requiring the user to trace the same outline twice (once as `slab_foundation`, once as `exterior_perimeter`) is redundant.

The aggregator encodes implicit cross-feeds on the area-polygon tags:

| Source tag | Area feeds | Perimeter cross-feeds | Superseded by |
|---|---|---|---|
| `slab_foundation` | `dim_foundation_slab_floor_area`, `project_below_grade_area`, `project_total_floor_area` | `dim_foundation_wall_area` × `param_basement_height_m` + `dim_continuous_footings` × `param_footing_height_m` × `param_footing_width_m` | explicit `exterior_perimeter` polygon |
| `slab_above_grade` | `dim_framed_floor_area`, `dim_finished_ceiling_area`, `project_above_grade_area`, `project_total_floor_area` | `dim_exterior_wall_area` × `param_wall_height_m` *(fallback only — secondary path)* | explicit `wall_exterior` (on elevation) **or** explicit `exterior_perimeter` polygon |

The `supersededBy` list names the tags that, when present anywhere in the project, preempt the implicit cross-feed. Explicit traces always win — a user who took the trouble to draw a separate `exterior_perimeter` polygon intended it to be authoritative. Primary contributions (e.g. `footing_interior` polylines into `dim_continuous_footings`) sum independently of the cross-feed suppression logic.

Cross-feed contributions are attached to their dim with `isCrossFeed: true` and a descriptive summary string ("1 slab foundation polygon — basement-slab perimeter × basement_height_m (2.4)") so the Import preview distinguishes them from primary contributions in the source column.

---

## 4. Dimension mapping table

Columns:
- **# (UI)**: numbered label per §5.3
- **Dim field ID**: BEAMweb-side identifier
- **Primary source**: component tag(s) the bridge reads
- **Formula**: how the bridge derives the value
- **Param(s)**: project-level param(s) the user must enter
- **Fallback**: alternate path if primary source is empty
- **Wave**: v1 MVP / v2 Step 10-depth / Manual-only

*Numbers from §5.3. Some fields in Project Info (1–2) aren't quantity dims but counted for continuity.*

| # | Dim field ID | Primary source | Formula | Param | Fallback | Wave |
|---|---|---|---|---|---|---|
| 1 | — | Number of Bedrooms (info) | — | — | — | Manual |
| 2 | — | Stories Above Grade (info) | — | — | — | Manual |
| 3 | `project_total_floor_area` | slab_above_grade + slab_foundation | Σ area | — | — | v1 |
| 4 | `project_above_grade_area` | slab_above_grade | Σ area | — | — | v1 |
| 5 | `project_below_grade_area` | slab_foundation | Σ area | — | — | v1 |
| 6 | `dim_continuous_footings_volume` | exterior_perimeter | perim × H × W | `param_footing_height_m`, `param_footing_width_m` | — | v1 |
| 7 | `dim_columns_piers_pads_volume` | pad_pier | Σ (area × depth_m) | — | — | **v2** (needs Step 10 depth) |
| 8 | `dim_foundation_wall_area` | exterior_perimeter | perim × H | `param_basement_height_m` | — | v1 |
| 9 | `dim_foundation_slab_floor_area` | slab_foundation | Σ area | — | — | v1 |
| 10 | `dim_exterior_wall_area` | wall_exterior (elevation) | Σ net area | — | exterior_perimeter × `param_wall_height_m` | v1 |
| 11 | `dim_window_area` | window (elevation) | Σ area | — | — | v1 |
| 12 | `dim_party_wall_area` | wall_party (elevation) | Σ net area | — | (interior polyline × param) | v1 |
| 13 | `dim_interior_wall_area` | wall_interior polyline | Σ length × H | `param_wall_height_m` | — | v1 |
| 14 | `dim_framed_floor_area` | slab_above_grade | Σ area | — | — | v1 |
| 15 | `dim_finished_ceiling_area` | slab_above_grade (reused) | Σ area | — | `ceiling_override` polygon if user draws one | v1 |
| 16 | `dim_roof_cavity_insulation_area` | roof_cavity | Σ area | — | — | v1 (flat); v2 (pitched — see Q22) |
| 17 | `dim_roof_surface_area` | roof_plan | Σ area × 1/cos(pitch) | `param_roof_pitch_deg` | — | v1 |
| 18 | `dim_timber_framing_volume` | — | — | — | — | **Manual forever** (not a takeoff) |
| 19 | `garage_partition_wall_area` | wall_interior (garage-tagged polyline) | Σ length × H | `param_wall_height_m` | — | v1 |
| 20 | `garage_continuous_footings` | exterior_perimeter (garage-tagged) | perim × H × W | params | — | v1 |
| … | (garage dims continue, same patterns as building side) | | | | | |

**Open Q23 (see §7):** garage polygons — do they get their own component tags (`slab_garage`, `wall_garage_exterior`), or do polygons carry a `scope: "building" | "garage"` boolean + reuse building-side tags? Leaning boolean — fewer enum values, clearer model.

---

## 5. UX specs

### 5.1 Source selector widget

One per dim row on PROJECT. Compact pill group at the right of the input. Renders current source; clicking opens a dropdown to change.

```
┌────────────────────────────────────┬──────────┬────┬──────────────────────────────┐
│ 9. FOUNDATION SLAB/FLOOR AREA      │ 110.40   │ m² │ [▾ PDF-Parser · 1 plan]      │
└────────────────────────────────────┴──────────┴────┴──────────────────────────────┘
```

Pill colour + text by state:
- `unset` — grey pill, "Select Source"
- `imported` — blue pill, "Imported"
- `pdf-parser` — cyan pill, "PDF-Parser · {summary}"
- `manual` — amber pill, "Manual"

Dropdown entries: all four states, with current marked. Picking a state that requires re-flow (e.g., pdf-parser) and that would overwrite USER_MODIFIED fires a small confirm dialog ("This will overwrite your manual edit — continue?").

### 5.2 Fidelity badge

Secondary caption under the dim input when source is `pdf-parser`, listing what fired.

Examples:
- `PDF-Parser · 4 elevation polygons · A-301, A-302, A-303, A-304`
- `PDF-Parser · plan perimeter × 2.7m (wall height param) · A-101 · ⚠ elevations preferred`
- `PDF-Parser · Σ 12 pad polygons · A-101`
- `PDF-Parser · needs param_wall_height_m`

**Sheet refs are clickable** (Andy's ask — #9 refinement): click `A-301` → opens PDF-Parser to that sheet in a new tab / the other app window. Cross-app deep link via URL fragment: `pdfparser.html#sheet=A-301`.

### 5.3 Numbered labels (display only, no field ID change)

Prepend `{N}. ` to the label of each quantitative field on PROJECT. Field IDs stay stable across all of this.

Numbering order (starts at **Number of Bedrooms** per Andy, skips Construction Year):

**Project Information — right column:**
1. Number of Bedrooms
2. Stories Above Grade
3. Total Floor Area
4. Above Grade Conditioned Area
5. Below Grade Conditioned Area

**Building Dimension Inputs:**
6. Continuous Footings Volume
7. Columns/Piers & Pads Volume
8. Foundation Wall Area
9. Foundation Slab/Floor Area
10. Exterior Wall Area
11. Window Area
12. Party / Demising Wall Area
13. Interior Wall Area
14. Framed Floor Area
15. Finished Ceiling Area
16. Roof Cavity Insulation Area
17. Roof Surface Area
18. Timber Framing Volume

**Garage Dimension Inputs:**
19. Garage Partition Wall Area
20. Garage Continuous Footings Volume
21. Garage Columns/Piers & Pads Volume
22. Garage Foundation Wall Area
23. Garage Slab Area
24. Floor Area Above Garage
25. Garage Foundation Attribution %
26. Garage Exterior Wall Area
27. Garage Window Area
28. Garage Finished Ceiling Area
29. Garage Roof Surface Area
30. Garage Timber Framing Volume

Construction Year + Project Name / Address / Country / Province / Building Type etc. stay unnumbered (not quantitative).

**Total: 30 numbered quantitative inputs.** Now visible at a glance = "how many things we need to count or get from the Parser."

### 5.4 Polyline tool button (PDF-Parser)

New button next to the area-polygon tool in the PDF-Parser toolbar. Red stroke. Shortcut: `l` (for length).

**Label:** "Trace Length"
**Tooltip:** "For interior walls, interior footings, and other linear features. Draws open polylines, measures length only."

Implementation: extend [`polygon-tool.mjs`](../../js/polygon-tool.mjs) to accept `type: polyline`; reuse the vertex-drawing logic; skip closure; label measurement output "length" (m/ft) instead of "perimeter".

### 5.5 Component tag picker (PDF-Parser)

On polygon creation/edit, a "Tag" dropdown appears in the measurement panel.

- Options filtered by current polygon type (area/window/polyline) + current sheet class (plan/elevation/section) per §3.4.
- Auto-defaults to the most-likely tag based on context. E.g., closed polygon on an elevation sheet → defaults to `wall_exterior`. User can override from the dropdown.
- The tag is required before the bridge can pick the polygon up — untagged polygons show a subtle "tag required" hint but don't block drawing.

### 5.6 Wall-height param prompt ergonomics

When the user draws a polyline tagged `wall_interior` or a closed polygon tagged `exterior_perimeter`, and `param_wall_height_m` is blank on PROJECT, the PDF-Parser sidebar shows an inline prompt: "Set Wall Height on PROJECT tab" (with a click-through link). Non-blocking — user can draw freely and fill the param later.

### 5.7 Assembly-preset picker on wall polylines (meeting 2026-04-20, Melanie)

**Problem being solved.** BEAM gSheet's current workflow populates every candidate material in a wall-assembly picker (framing + sheathing + cladding + insulation + barriers + interior finish), each at 0% by default. The user then manually tunes percentages across dozens of rows to describe a single wall assembly. This is a known pain point — same assembly typed repeatedly across projects.

**The preset.** When the user draws a wall polyline (`type: polyline`, `component: wall_interior`) or a perimeter polygon (`type: area`, `component: exterior_perimeter`), the PDF-Parser measurement panel shows a second dropdown below the component tag: **Assembly preset**. Values (v1 catalogue — subject to BfCA team validation, see Q30):

- Wood 2×4 @ 16" o.c. (light framing)
- Wood 2×6 @ 16" o.c. (medium framing)
- Wood 2×8 @ 16" o.c. (heavy framing)
- Steel stud 3-5/8"
- Steel stud 6"
- CMU 8" (concrete masonry unit)
- ICF 6" (insulated concrete form)
- Other / custom (user handles percentages manually, as today)

The preset is carried on the polygon record (`assembly_preset` field per §3.3). When the bridge runs, it:
1. Derives the dimension value (length × height → m² as before).
2. **Passes the preset name through to the downstream assembly tab** (Interior Walls, Exterior Walls, Party Walls when those Phase 4 tabs port) so the picker rows open with sensible defaults rather than every row at 0%.

**Default seeding.** Each preset maps to a small table: `{ row_hash → percent }` applied on the assembly tab's first render when the dimension is sourced from `pdf-parser` and the row isn't USER_MODIFIED. Values stay editable — the preset is a seed, not a lock.

Example (illustrative — actual values need Melanie's sign-off; see Q30):
```
wood_2x4_16oc:
  - SPF dimension lumber 2x4 → ~12% by volume share
  - Drywall 1/2" (interior) → 100% (one side)
  - Batt insulation R-13 → 100% (cavity fill)
  - Vapour barrier → 100%
  - Framing connectors → auto (depth implicit)
```

**Multi-preset per dimension.** If a user draws three polylines (`wall_interior`) with different presets (e.g. two walls are 2×4, one is 2×6), the bridge routes each polyline to its own F&S-style row group. The `dim_interior_wall_area` total still sums across all polylines, but the assembly tab renders multiple pre-populated groups — one per distinct preset.

**Why this lives on the polyline, not on the PROJECT tab.** Wall assemblies in residential construction vary by location (exterior walls one build-up, party walls another, interior walls yet another). Per-polygon tagging is finer-grained than per-dimension and matches how drawings actually describe assemblies.

**Preset catalogue location.** Proposed: a new file `js/shared/assembly-presets.mjs` (or similar) exports `ASSEMBLY_PRESETS`, a data table mapping preset IDs → display label + the default row-seed table. Lives in `js/shared/` because both PDF-Parser (picker UI) and BEAMweb (assembly tabs) consume it.

**Scope implication.** This is a non-trivial addition that interacts with Phase 4 (the actual Interior Walls / Exterior Walls / Party Walls assembly tabs — none of which have ported yet). Until those tabs port, the preset is metadata on the polyline that nothing downstream consumes. Sequenced in §6.3 (carried on polygons Phase 4b.1) + §6 new Phase 4b.5 (wire to assembly tabs once they port).

---

## 6. Sequencing / phases

### 6.1 Phase 4b.0 — Zero-dep standalone (**✅ shipped** on `PDF-Bridge` commit `f93217d`, 2026-04-20)

- **Numbered labels** (§5.3) — one label-string change per field in `project-tab.mjs`. No behavior impact, no risk. Shipped as a standalone commit alongside the Q25 Party → Party / Demising label update.

### 6.2 Phase 4b.1 — Foundation (PDF-Parser Step 10 minimal + PROJECT params) (**✅ shipped** 2026-04-20)

**PDF-Parser side (commit `529e297`):**
- ✅ Added `component`, `depth_m`, `sheet_id`, `sheet_class`, `assembly_preset` fields to the polygon schema in [`project-store.mjs`](../../js/project-store.mjs).
- ✅ Added polyline (`type: polyline`) support to [`polygon-tool.mjs`](../../js/polygon-tool.mjs) with red stroke + length-only measurement + Enter-to-finalize flow.
- ✅ Added component tag dropdown to the toolbar, context-switched per tool. Assembly preset dropdown appears for wall-type components.
- ✅ Denormalized sheet metadata onto polygons at save time.

**BEAMweb side (commit `f07181b`):**
- ✅ Added `param_*` fields to [`project-tab.mjs`](../../js/beam/project-tab.mjs) in a new "Geometry Parameters" collapsible section.
- ✅ Extended StateManager with `getDimensionSource` / `setDimensionSource` + `exportDimensionSources` / `importDimensionSources`. File handler round-trips the new `dimension_sources` top-level key in exported JSON.

### 6.3 Phase 4b.2 — Bridge + Import modal (MVP) (**✅ shipped** 2026-04-20 → 2026-04-21)

- ✅ Built [`js/shared/polygon-map.mjs`](../../js/shared/polygon-map.mjs) with `COMPONENT_TO_DIMENSION` lookup + `aggregateOne` + `computeAllDimensions` + cross-feed support + pitch-factor helpers. Pure data + pure functions; consumed by both sides of the bridge. (commits `9efed2d`, `f4e590d`)
- ✅ Cross-tab persistence via IndexedDB (`js/shared/indexed-db-store.mjs`), ProjectStore autosave, auto-restore on Parser init. (commit `f907888`)
- ✅ `target="_blank"` on cross-app nav so apps stay alive in separate tabs. (commit `74f6108`)
- ✅ Built [`js/beam/pdf-bridge-import.mjs`](../../js/beam/pdf-bridge-import.mjs) — reads Parser projects from IndexedDB, runs aggregator, returns preview with diff rows, applies selected rows via `StateManager.setValue` + `setDimensionSource`. (commit `9efed2d`)
- ✅ Import from PDF-Parser modal: project picker when multiple sessions, param-missing warning banner, per-dim checkbox table showing current vs computed, source column with contributing polygons + sheets + assembly presets + warnings. Apply writes through and refreshes PROJECT tab. (commit `9efed2d`)
- ✅ Display fixes: `0.00→—` when required param missing, classification fallback for junk sheet titles, inline Tag + Preset selects in Summary Table. (commit `2e8c31d`)
- ✅ Parser-side Geometry Parameters panel in sidebar; bridge reads Parser params as fallback when StateManager is blank; Apply back-fills StateManager from Parser params. (commit `3367bf8`)
- ✅ Cross-feeds: implicit perimeter derivations so a single slab polygon feeds foundation wall + continuous footings alongside the slab area it was drawn for. Supersedes-logic preserves user's explicit traces. (commit `f4e590d`)
- v1 dim coverage shipped:
  - ✅ slab-based: `project_total_floor_area`, `project_above_grade_area`, `project_below_grade_area`, `dim_foundation_slab_floor_area`, `dim_framed_floor_area`, `dim_finished_ceiling_area`
  - ✅ elevation-based walls + windows: `dim_exterior_wall_area`, `dim_party_wall_area`, `dim_window_area`
  - ✅ param-multiplied: `dim_continuous_footings`, `dim_foundation_wall_area`, `dim_interior_wall_area`, `dim_roof_surface_area`
  - ✅ flat-roof: `dim_roof_cavity_insulation_area`

**~16 of 18 building dims + 3 info quantities auto-derivable. Garage dims deferred pending Q23 resolution.**

Deferred from the original Phase 4b.2 scope (re-sequenced into polish or later phases):
- Source selector widget (§5.1) — see Shipped update in §0.
- Fidelity badge inline under each dim (§5.2).
- Auto-re-run on polygon-change event (Q21) — replaced by Import-button workflow.

### 6.4 Phase 4b.3 — Step 10 depth

- Add `depth_m` to polygon schema + UI input on measurement panel.
- Unlock: `dim_columns_piers_pads_volume`, `garage_columns_piers_pads_volume`.
- Unlock variant: per-polygon footing cross-section override (if a user wants to tag a non-constant section).

### 6.5 Phase 4b.4 — Polish

- Cross-app deep links from fidelity badge sheet refs (§5.2 click-through).
- Polygon-placement validation rules per §3.4 — non-blocking warnings.
- Bulk "Use PDF-Parser for all connected dims" action on the PROJECT header.
- Pitched-roof cavity handling (Q22 resolved).

### 6.6 Phase 4b.5 — Assembly-preset wire-through (meeting 2026-04-20, Melanie)

- `js/shared/assembly-presets.mjs` (new): `ASSEMBLY_PRESETS` catalogue — preset ID → display label + default `{ row_hash → percent }` seed table. Preset list per §5.7 (subject to Q30 refinement).
- PDF-Parser measurement panel: second dropdown on `wall_interior` / `exterior_perimeter` polylines — "Assembly preset" (persists to polygon `assembly_preset` field per §3.3).
- Bridge passes `assembly_preset` through to the downstream Phase 4 assembly tab (Interior Walls / Exterior Walls / Party Walls) when those ship. Assembly tab seeds row percentages from the preset on first render — editable, not locked.
- **Gated on:** the actual Phase 4 assembly tab ports (Interior Walls, Exterior Walls, Party Walls — §6 Phase 4 queue in BEAMweb.md). Until then, the preset is captured on the polygon but downstream is a no-op. Metadata-only in the interim is fine — preserves user intent for when tabs port.

### 6.7 Never (decided non-goals)

- Timber framing volume from polygons (see §1 Non-goals).
- HOT2000 operational energy (BEAMweb.md §10).
- Point-type polygons (use small area polygons instead).
- Wizard mode with animated arrows (BfCA training path — shelved 2026-04-20).

---

## 7. Open questions

Carrying forward from BEAMweb.md §7 Q19 with updates:

- ✅ **Q19a (precedence)** — resolved: last-touched source wins; USER_MODIFIED is sticky; explicit source toggle overrides with confirm.
- ✅ **Q19b (aggregation)** — resolved: sum, with fidelity badge showing "N polygons · total" so user can audit.
- ✅ **Q19c (taxonomy mapping)** — resolved: generic component tags + lookup table (§3.2 + §4).
- ✅ **Q19d (reset semantics)** — resolved: §2.3 — Reset Tab clears PROJECT, preserves PDF-Parser polygon state, user re-selects source to re-flow.
- ✅ **Q19e (JSON persistence)** — resolved: yes, `dimension_sources` map alongside `fields` in the project JSON.

### New questions opened by this spec

- ✅ **Q20 — Caching last-computed values.** Moot in the current manual-Import model — preview always runs fresh. Re-opens if auto-reflow returns.
- ✅ **Q21 — Auto-re-run on polygon change.** Replaced by explicit Import button in BEAMweb action bar. User-triggered, not event-driven. Revisit if users report friction with manual trigger.
- ✅ **Q22 — Roof cavity vs roof surface.** Shipped per proposal — one `roof_plan` polygon feeds both `dim_roof_cavity_insulation_area` (direct plan area, pitch backed out) and `dim_roof_surface_area` (plan × pitch factor). `roof_cavity_override` tag available for cathedral ceilings. See `computeContribution` in [polygon-map.mjs](../../js/shared/polygon-map.mjs).
- **Q23 — Garage polygon tagging.** Still open. Leaning B (scope boolean + reuse building tags). Not blocking the building-side flow; garage dims will wire in when a user asks for them.
- **Q24 — Multi-storey wall-height handling.** Still open / deferred.
- **Q31 — Multi-tag extension (Andy, 2026-04-21).** Cross-feeds (§3.6) let one polygon drive multiple dims via area + perimeter, with `supersededBy` resolving priority. Andy flagged during the F&S testing round that more tag→dim mappings deserve the same treatment. Specific items to queue:
  - (a) **Which additional tag combinations?** Andy to enumerate — candidates include `roof_plan` perimeter feeding fascia/soffit length, `floor_area` (non-`slab_above_grade`) area feeding a generic finished area, `exterior_perimeter` perimeter feeding additional envelope dims.
  - (b) **Extension pattern.** Each new mapping adds either a fresh entry in `COMPONENT_TO_DIMENSION[component].crossFeeds[]` (if it's a secondary feed off an existing tag) or a new `COMPONENT_TO_DIMENSION` component with its own primary targetDim plus crossFeeds. No structural changes to `polygon-map.mjs` — the runCrossFeeds pass already handles arbitrary new entries.
  - (c) **Supersedes semantics.** Each new cross-feed declares its own `supersededBy` list so user-explicit tags always win. Review the lattice at the same time — if tag A supersedes B and B supersedes C, is A→C implicit? Currently no; the mapping is flat. Formalise if/when users want transitive supersedes.
  - (d) **UI impact.** None on the Parser side. The Import preview already renders multiple contributors per dim with joined summaries — adding more cross-feeds just makes those summaries richer.
- ✅ **Q25 — Party/Demising wall naming in code.** Shipped. Field ID `dim_party_wall_area`, UI label "Party / Demising Wall Area".
- ✅ **Q26 — PDF-Parser Step 10 ownership.** Resolved as part of Phase 4b.1 scope (single branch, single PR). Polygon schema + polyline + component dropdown shipped in commit `529e297`.

### Opened by BfCA team meeting (2026-04-20)

- **Q27 — Upstream BEAM + materials DB refresh.** The 22 BEAM tab CSVs in `docs/csv files from BEAM/` and the 821-record `schema/materials/` catalogue were both built from an older workbook URL (session 3, `3ea823e`). Team confirmed the current authoritative sources are:
  - BEAMs workbook: `https://docs.google.com/spreadsheets/d/1LjOpDTjfGQvvfRGCpDb8KkHcUtHzUC5UbvfV-wXy13g/edit?gid=175800287#gid=175800287`
  - BfCA materials DB: `https://docs.google.com/spreadsheets/d/1-gd2iH7UIoDuEt7gIC35PbgJf2sO5go9IwjkSxue-UA/edit?gid=170425505#gid=170425505`

  **Proposal:** run a refresh pass as its own focused branch — re-fetch via `schema/scripts/fetch-beam-sheet.py` against the new workbook URL, re-run the importer against the new DB sheet, re-validate, diff the two generations, flag any rows that changed shape or disappeared. The existing F&S parity tests (commit `8bee3f4`) should still pass against the refreshed data — any numerical shifts are meaningful signals that real-world EPD values moved, not regression. Scope ~1 session. Best sequenced **before Phase 4b.2 lands** so the bridge builds against current data.

- **Q28 — "EPD Only" filter on the Database viewer filters 821 → 380.** Melanie flagged concern in the meeting: by her recollection, every one of the 821 records was informed by an underlying EPD — so a filter narrowing to 380 reads like ~440 rows are being mis-labelled as non-EPD.

  **Investigation finding (2026-04-20, post-Q27):** the filter is **heuristic**, not a principled field check. See [`js/database.mjs:238`](../../js/database.mjs#L238):

  ```js
  if (state.epdOnly) {
    // index doesn't carry epd.type — fall back to beam_id prefix heuristic.
    // beam_id starting with uppercase letters = product-specific BEAM codes;
    // mixed-case short hex ids are the BEAM-average / industry-average set.
    if (/^[a-z0-9]{6,}$/.test(e.beam_id || "")) return false;
  }
  ```

  The filter excludes rows whose `beam_id` is ≥6 lowercase-hex chars (auto-generated IDs for industry / BEAM-average entries). The 380 visible = rows with uppercase/mixed-case beam_ids = **product-specific EPD rows**. The 440 excluded = industry / BEAM-average rows.

  So the filter is actually "exclude averages", not "show rows with EPD data" — both hypotheses in the original Q28 framing were wrong. **Two fix paths for Melanie to choose:**
  1. **Relabel** the checkbox to match what it does — "Product EPDs only" or "Exclude Industry & BEAM Averages."
  2. **Make it principled** — add `epd.type` (or a derived `is_product_specific` boolean) to `schema/materials/index.json` and check that instead of the beam_id regex. Heuristics drift; principled fields don't. This is a small index-generator change in `schema/scripts/beam-csv-to-json.mjs`.

  Recommend path 2, but path 1 is a one-line relabel that immediately de-confuses the UI.

- **Q29 — Biogenic status flags reading `method: none` on rows that should carry biogenic carbon.** Database viewer's detail pane shows `biogenic_factor=—  carbon_content=— kgC/kg  full_C = — kgCO2e  stored = — kgCO2e` on wood / biogenic-insulation rows where non-zero values are expected.

  **Investigation finding (2026-04-20, post-Q27):** it's **two issues compounded**, not one.

  *Wood records split across two method states* (per fresh `06-wood.json` after Q27):
  - 94 of 160 wood records: `method: "wwf_storage_factor"` with populated `biogenic_factor`, `carbon_content_pct_kgc_kg`, `storage_retention_pct`, `carbon_content_kgc_per_unit` inputs.
  - 66 of 160 wood records: `method: "none"`. Either intentionally non-biogenic (treated timber where the claim is waived) or curation-in-progress — Melanie's call per-row.

  *The Database viewer detail pane ([`js/database.mjs:637-641`](../../js/database.mjs#L637-L641)) reads fields that don't exist in the source data*:

  ```js
  biogenic   method: ${bg.method || "—"}
             biogenic_factor=${fmtOr(bg.biogenic_factor, "—")}  carbon_content=${fmtOr(bg.carbon_content_pct_kgc_kg, "—")} kgC/kg
             full_C   = density × thickness × bio × C × 3.67 = ${fmtOr(bg.full_carbon_kgco2e_per_common_unit, "—")} kgCO₂e
             stored   = full_C × ${fmtOr(bg.storage_retention_pct, "—")} = ${fmtOr(bg.stored_kgco2e_per_common_unit, "—")} kgCO₂e
             C/unit   = ${fmtOr(bg.carbon_content_kgc_per_unit, "—")} kgC
  ```

  The fields `bg.full_carbon_kgco2e_per_common_unit` and `bg.stored_kgco2e_per_common_unit` **don't exist on any record** — the formula is described in `biogenic.notes` text but never computed and stored. So even on the 94 fully-populated wood rows, the `full_C` and `stored` lines render as `—`.

  **Resolution (2026-04-20, after Andy's paste of the BAM002 sheet row):** it was actually **an importer bug, not a source-sheet gap and not a viewer bug**. The BfCA Materials DB sheet DOES carry the stored value — column Z ("Biogenic Storage kgCO₂e/(common unit)") = 12.97 on BAM002. But `schema/scripts/beam-csv-to-json.mjs` at line 316 read **column AB** ("WWF Storage Factor kgCO₂e/kgC" — a different per-kgC factor) thinking it was the stored value. Column AB is blank on BAM002 (and most other rows), so the importer wrote `stored_kgco2e_per_common_unit: null` on every row where the sheet actually had the value in column Z.

  **Fix shipped:** importer now reads **column Z** for `stored_kgco2e_per_common_unit`, and reads AB separately into a newly-populated `wwf_storage_factor_kgco2e_per_kgc` field. Also added a small derivation: when AE (full_C) is blank but Z and AF (storage_retention) are present, compute `full_C = stored / storage_retention` so the per-record block stays internally consistent. Commit carries the importer fix + regenerated `schema/materials/*.json`.

  **Post-fix coverage:** 40 of 160 wood records + 41 of 217 thermal records now carry populated `stored_kgco2e_per_common_unit` (previously zero). 129 records across all 8 groups carry populated `wwf_storage_factor_kgco2e_per_kgc` (the separate column AB). BAM002 specifically: `stored_kgco2e_per_common_unit: 12.97`, `full_carbon_kgco2e_per_common_unit: 14.41`, matching the expected formula output.

  **Residual question for Melanie** (still worth asking — narrower than the original): the 66 wood rows + 192 thermal rows that show `method: none` in the source data — are those intentionally non-biogenic (treated wood products, mineral insulation, etc.) or curation-in-progress?

  **Second residual — column canonicalisation (2026-04-20, surfaced by Andy's sheet-screenshot):** a scan of rows 429-448 in the refreshed DB shows the biogenic-block columns aren't used consistently across rows. Examples:
  - `HTW000` (Heat Treated Wood / Abodo / Vulcan 20mm): Z blank, AB=18.1665, AE=20.185. Note that 20.185 × 0.9 (storage retention) ≈ 18.17 — so AB on this row plausibly holds the *stored* value despite the header labelling it "WWF Storage Factor kgCO₂e/kgC". HTW002 and HTW003 same pattern.
  - `HWF000` (HempWood): Z=5.37 populated AND AB=9.72 populated — different numbers, different semantics unclear.
  - `7d79df` (Hempcrete Cast in-situ / IsoHemp): Z=10.22 AND AE=10.22 — same value in both columns.
  - Column AA (common unit label) reads `m2` / `m²` / `m2 RSI` / `m2•RSI` / blank across adjacent rows with no stable convention.

  These look like working-notes patterns — values landed in whichever column was convenient at data-entry time, not a broken schema. Chasing this with importer heuristics (try Z, fall back to AE × retention, or AB if units look right) would bake our current row-by-row mind-reading into code and silently drift on every future refresh. The fix belongs source-side: canonicalise what goes in each column so refreshes land cleanly.

  **Ask for Melanie:** a pass over the biogenic columns (X, Y, Z, AA, AB, AC, AD, AE, AF) to enforce a single convention per column per row. Proposed canonical form:
  - **Z** = `stored` value in kgCO₂e per common unit (always)
  - **AA** = common-unit label — pick one exact format (e.g. `m²·RSI`) and apply consistently
  - **AB** = WWF storage factor in kgCO₂e per kgC (if tracked; otherwise blank)
  - **AE** = full-C value in kgCO₂e per common unit (if the sheet tracks it; otherwise leave blank and let the importer derive `full_C = stored / storage_retention` as it does today)
  - **X / Y / AF** = biogenic factor, % C content, storage retention — seem consistent already, just spot-check
  - Rows where only AB or AE carries a value (like HTW00X) should get their values migrated into Z / AE as appropriate, and whichever column isn't the "single source of truth" for a given row should be left blank

  The 21 wood + ~170 thermal rows that still come through null-on-`stored` after our fix will mostly populate automatically once the columns are canonicalised. No BEAMweb code change is required for this cleanup — it's purely a BfCA source-sheet hygiene pass.

- **Q30 — Assembly-preset design questions.** Item 4 from the 2026-04-20 meeting, threaded into §3.2 + §5.7 + §6.6 Phase 4b.5. Open sub-questions:
  - (a) **Preset catalogue.** Initial list proposed in §5.7 (Wood 2×4 / 2×6 / 2×8, Steel stud 3-5/8 / 6, CMU 8, ICF 6, Other). Is this the right set? Canadian-residential-focused, so what's missing? SIP panels? Passive House wall types? TJI floor joists (different takeoff entirely — belongs to floors, not walls)?
  - (b) **Default percentages source of truth.** Does BfCA already have an authoritative table mapping assembly → default material mix (e.g. "Wood 2×4 @ 16" o.c." → SPF 12% by volume + drywall 100% one side + batt R-13 100% cavity + vapour barrier 100%)? If yes, grab it; if no, needs a BfCA-side exercise to codify the defaults before we can wire them.
  - (c) **Multi-preset per dimension.** If user draws three `wall_interior` polylines with different presets, does the resulting Interior Walls assembly tab render three separate picker groups (one per preset) or flatten into a single group with weighted averages? **Proposal:** three separate groups is more faithful to the data and easier to audit; flattening only in the dim total.
  - (d) **Override the preset after drawing.** Should the user be able to change a polyline's preset later without re-drawing? **Proposal:** yes — same picker accessible via polygon-edit panel. Preset change triggers re-seed on the assembly tab (with USER_MODIFIED rows sticky, as always).
  - (e) **Exterior walls.** Do exterior walls get presets too (Wood 2×4 + cladding-type combo), or are they manual-tuned given their higher variability? **Lean:** same preset mechanism, larger catalogue — but that multiplies the preset list by cladding type. Maybe two dropdowns for exterior: "framing preset" + "cladding preset"? Design call needed.

### Draft ask for Melanie — EPD provenance semantics (Q28 + Q29 consolidated)

Ready-to-paste message. Pairs the two open concerns (EPD-Only filter narrowing 821 → 380, and 34 of 36 BEAM-Avg rows carrying `null` in `carbon.stated.value_kgco2e`) into one ask because both probe the same underlying question: what does "this row has an EPD" actually mean in the BfCA source sheet?

> **Hi Melanie — two questions on the Materials DB schema that we'd love your steer on before we code around them.**
>
> **1. EPD-Only filter (Database viewer).** When we tick the "EPD Only" checkbox, the list narrows from 821 to 380 entries. You mentioned in the meeting that every row in the catalogue was informed by an EPD during BfCA's curation, so this 380 number feels too low. Can you help us distinguish:
>   - Does "informed by an EPD" mean the row has its own underlying EPD document (direct provenance — the 380), OR is the 821 inclusive of rows that were *derived* from EPDs (industry averages, BEAM-Avg rows computed from a peer set, extrapolations for related products)?
>   - If the 440 delta is "EPD-derived" rows, the filter is correct but the label is misleading — we'd relabel it to "Direct EPD only" or similar. If instead you expect those 440 rows to carry a direct EPD reference the filter is missing, that points at either a data gap (source sheet) or a code gap (filter checks the wrong field).
>
> **2. BEAM-Avg rows with null values.** After regenerating from the current DB sheet, 34 of 36 rows flagged as `is_beam_average: true` carry `null` in their stored GWP field. Two rows (XPS BEAM-Avg and one concrete BEAM-Avg) have numeric values populated; the other 34 stay null.
>
>   Runtime we handle this — BEAMweb has a `resolveBeamAverage()` helper that computes the mean of same-subgroup peer GWPs at boot when the stored value is null, so all 36 rows end up with usable numbers. But the data question is:
>   - Is the expectation that a BEAM-Average row has its averaged numeric pre-computed and saved on the row, OR that it stays null and gets computed on demand by consumers?
>   - If "pre-computed and saved" is the intent, are the 34 currently-null rows a curation-in-progress gap (you're working through them manually), or is there a formula column in the sheet that should be filling those in automatically and isn't?
>   - ~~Related: the Database viewer's detail pane shows `biogenic method: none`, `biogenic_factor: —`, `carbon_content: — kgC/kg`, `full_C: — kgCO2e`, `stored: — kgCO2e` on wood and biogenic-insulation rows where we'd expect non-zero values.~~ **Partly resolved 2026-04-20 as an importer bug** — the BfCA Materials DB sheet had the stored value in column Z all along; our importer was reading column AB (WWF Storage Factor) by mistake. Fix shipped; 81 wood + thermal records now carry populated `stored` values. Two narrower residuals for you:
>
>     (a) On the 66 wood + 192 thermal rows that explicitly show `method: none` in the sheet, is that intentional (treated wood, mineral insulation, etc.) or curation-in-progress?
>
>     (b) **The bigger one — column canonicalisation.** Spot-checking rows 429-448 in the refreshed DB (Heat Treated Wood, HempWood, Hempcrete) shows the biogenic-block columns aren't used the same way across rows. Some rows have `stored` in Z as documented; some have it in AB (where the header actually says "WWF Storage Factor kgCO₂e/kgC"); some have the same value in both Z and AE; column AA (common-unit label) alternates between `m2`, `m²`, `m2 RSI`, and `m2•RSI`. We can't fix this in the importer without guessing — "try Z first, else AE × retention, else AB if the units look right" would bake our current row-by-row mind-reading into code and silently drift on every future refresh. Could you do a pass over the biogenic columns to enforce a single convention per column per row? Proposed canonical: **Z** = stored kgCO₂e per common unit; **AA** = one consistent common-unit label (pick one e.g. `m²·RSI`); **AB** = WWF storage factor kgCO₂e per kgC (or blank); **AE** = full-C kgCO₂e per common unit (or blank — the importer derives it from stored/retention when blank). Once that pass lands, the remaining 21 wood + ~170 thermal rows that currently come through null on `stored` should mostly populate themselves via the next refresh, no code change needed on our end.
>
> Your answer on (1) tells us how to relabel the filter (or whether we have a bug to fix). Your answer on (2) tells us whether BEAMweb should keep computing averages client-side as a permanent fallback, treat them as a temporary stopgap, or rip the code path out and rely on pre-populated values. Thanks!

Andy to relay; answer will drive follow-up commits on Q28 + Q29.

---

## Appendix — implementation sketch

### `js/shared/polygon-map.mjs` (new)

```js
// Single source of truth for component → dimension mappings.
// Lives in js/shared/ because BEAMweb and PDF-Parser both consume it.

export const COMPONENT_TO_DIMENSION = {
  slab_foundation: {
    targetDim: "dim_foundation_slab_floor_area",
    targetDimExtras: ["project_below_grade_area", "project_total_floor_area"],
    aggregate: "sumArea",
    requiredSheetClass: ["plan"],
    requiredParams: []
  },
  slab_above_grade: {
    targetDim: "dim_framed_floor_area",
    targetDimExtras: [
      "dim_finished_ceiling_area",
      "project_above_grade_area",
      "project_total_floor_area"
    ],
    aggregate: "sumArea",
    requiredSheetClass: ["plan"],
    requiredParams: []
  },
  wall_exterior: {
    targetDim: "dim_exterior_wall_area",
    aggregate: "sumNetArea",
    requiredSheetClass: ["elevation"],
    requiredParams: [],
    fallback: {
      fromComponent: "exterior_perimeter",
      aggregate: "sumPerimeter",
      requiredSheetClass: ["plan"],
      multiplyByParam: "param_wall_height_m"
    }
  },
  wall_interior: {
    targetDim: "dim_interior_wall_area",
    aggregate: "sumLength",
    requiredSheetClass: ["plan"],
    requiredParams: ["param_wall_height_m"],
    multiplyByParam: "param_wall_height_m"
  },
  pad_pier: {
    targetDim: "dim_columns_piers_pads_volume",
    aggregate: "sumAreaTimesDepth",
    requiredSheetClass: ["plan"],
    requiredParams: [],
    wave: "v2" // needs Step 10 depth
  },
  roof_plan: {
    targetDim: "dim_roof_surface_area",
    targetDimExtras: ["dim_roof_cavity_insulation_area"],
    aggregate: "sumArea",
    requiredSheetClass: ["plan"],
    requiredParams: [],
    multiplyByPitchFactor: "param_roof_pitch_deg"
  }
  // ... full table
};

export function aggregateFromPolygons({ polygons, params, targetDimId, scope = "building" }) {
  // Walk COMPONENT_TO_DIMENSION, find entries targeting targetDimId.
  // Filter polygons by matching component + sheet_class + scope.
  // Apply aggregate (sumArea | sumLength | sumPerimeter | sumAreaTimesDepth).
  // Multiply by params if required.
  // If primary path yields 0 polygons AND fallback exists, try fallback.
  // Return { value, fidelity: { summary, sheets, warnings } }.
}

export function computeAllDimensions({ polygons, params }) {
  // Loop every target dim, call aggregateFromPolygons, return flat map.
  // Used by the bulk "Use PDF-Parser for all" action.
}
```

### `js/beam/source-selector.mjs` (new)

```js
// Renders the per-dim source pill + dropdown.
// Listens for StateManager dimension-source changes; re-renders on change.
// Fires bridge.refreshDimension(dimId) when user picks pdf-parser.

export function renderSourcePill(dimId) { /* ... */ }
export function wireSourceSelector(panel) { /* ... */ }
```

### `project-tab.mjs` (modifications)

- Add `PARAMETERS` field-def array + a new `renderCollapsibleSection("params", "Geometry Parameters", ...)` section, between Building and Garage.
- Prepend numbered labels per §5.3.
- Render source pill alongside each dim input via `renderSourcePill(f.id)` in `renderDimRow` / `renderInfoRow`.

### `polygon-tool.mjs` (modifications, PDF-Parser Step 10)

- Add `type: polyline` branch to drawing logic — vertex collection unchanged, closure skipped, stroke red.
- Add component tag dropdown to measurement panel, options filtered by current type + sheet class.
- Add optional depth input for `pad_pier` (Step 10b).
- Persist new fields (`component`, `sheet_id`, `sheet_class`, `depth_m`) to project store.

### `project-store.mjs` (modifications, PDF-Parser)

- Polygon schema extended with new fields.
- Denormalize sheet metadata at save.
- Export a polygon-change event that the cross-app bridge subscribes to.

---

*End of draft workplan. Ready for Andy's review — expect revisions once his takeoff-strategy map lands.*
