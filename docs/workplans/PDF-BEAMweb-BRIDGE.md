# PDF-Parser ↔ BEAMweb Bridge — workplan + design spec

> **Cross-app bridge: PDF-Parser polygons → BEAMweb PROJECT dimensions.** This is the Phase 4b detailed spec scoped in [BEAMweb.md §6](./BEAMweb.md) + [§7 Q19](./BEAMweb.md). Read BEAMweb.md §0, §5.1, and §7 Q19 first for the parent-workstream context (state model, flat-dict project JSON, source precedence).
>
> **Status:** draft, pre-implementation. Opened 2026-04-20. Pending Andy's takeoff-strategy map (in progress as of writing). Expect revisions before any code lands.

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

### What the bridge does

A user draws polygons in PDF-Parser across plan views, elevations, and (future) sections. Each polygon carries a `component` tag picked at measurement time. The bridge aggregates matching polygons across sheets and flows derived values into BEAMweb PROJECT dimension fields via `StateManager.setValue(fieldId, value, VALUE_STATES.DERIVED)`, with the per-dim source set to `pdf-parser`. User manual edits (USER_MODIFIED) override; the selector can be toggled to re-flow on demand.

Some dimensions derive directly from polygons (slab area = Σ plan polygons tagged `slab_foundation`). Some need a project-level parameter the user enters manually on PROJECT (e.g., `param_wall_height_m` converts perimeter/polyline length into wall area). Some need Step 10's per-polygon depth (pad/pier volumes). A few stay manual forever (timber framing volume — not a takeoff concept).

### What the bridge does NOT do

- **No HOT2000 parsing.** Operational energy is [BEAMweb.md Phase 7](./BEAMweb.md)'s problem.
- **No schedule parsing.** Window schedules stay manual unless drawn on elevation sheets.
- **No timber takeoff.** Heavy timber elements are discrete line items, not a drawing-takeoff product. Belong on Structural Elements tab, not summed on PROJECT. See §1 Non-goals.
- **No cross-project polygon sharing** (see BEAMweb.md §7 Q12).

### Where to pick up next (cold-start one-liner)

1. Verify Andy's takeoff-strategy map has been integrated (may change the component enum in §3).
2. Land Phase 0 (numbered UI labels per §5.3) — trivial, standalone, no dependencies.
3. Confirm PDF-Parser Step 10 status. If not started, coordinate taxonomy decisions in §3 before touching polygon schema.
4. Build `js/shared/polygon-map.mjs` per §3.2 — pure data + aggregation helpers. Ships with a unit test against a hand-authored polygon fixture.
5. Add `param_*` fields to PROJECT per §2.5 — new section in `project-tab.mjs` or contextual inline.
6. Wire source selector UI per §5.1. End-to-end test against the DOE Prototype sample project.

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
  "sheet_class": "elevation"
}
```

**New fields:**
- `component` — enum value from §3.2, picked at measurement time
- `depth_m` — optional, null by default; populated for `pad_pier` type via a measurement-dialog input
- `sheet_id` — denormalized from parent sheet for bridge convenience (saves a lookup)
- `sheet_class` — denormalized from [`sheet-classifier.mjs`](../../js/sheet-classifier.mjs)

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

---

## 6. Sequencing / phases

### 6.1 Phase 4b.0 — Zero-dep standalone (land anytime)

- **Numbered labels** (§5.3) — one label-string change per field in `project-tab.mjs`. No behavior impact, no risk. Can ship as a standalone commit.

### 6.2 Phase 4b.1 — Foundation (PDF-Parser Step 10 minimal + PROJECT params)

**PDF-Parser side:**
- Add `component`, `sheet_id`, `sheet_class` fields to the polygon schema in [`project-store.mjs`](../../js/project-store.mjs).
- Add polyline (`type: polyline`) support to [`polygon-tool.mjs`](../../js/polygon-tool.mjs) + red stroke styling.
- Add component tag dropdown to the measurement panel.
- Denormalize sheet metadata onto polygons at save time.

**BEAMweb side:**
- Add `param_*` fields to [`project-tab.mjs`](../../js/beam/project-tab.mjs) in a new "Geometry Parameters" subsection.
- Extend StateManager with `getDimensionSource` / `setDimensionSource` + the new `dimension_sources` JSON key.

No bridge yet. Foundation only.

### 6.3 Phase 4b.2 — Bridge + selector (MVP)

- Build [`js/shared/polygon-map.mjs`](../../js/shared/polygon-map.mjs) with `COMPONENT_TO_DIMENSION` lookup + `aggregateFromPolygons(polygons, params, dimId)` helper. Pure data + pure function — testable in isolation.
- Wire the bridge to listen for PDF-Parser polygon-change events (extending the existing PROJECT → F&S auto-fill pattern from [`auto-fill.mjs`](../../js/beam/auto-fill.mjs)).
- Build the source-selector widget (`js/beam/source-selector.mjs` new) — renders per-dim pill, handles toggle + confirm dialog, fires bridge re-run.
- Build the fidelity badge renderer — inline caption under each dim.
- v1 dim coverage:
  - ✅ slab-based: `project_total_floor_area`, `project_above_grade_area`, `project_below_grade_area`, `dim_foundation_slab_floor_area`, `dim_framed_floor_area`, `dim_finished_ceiling_area`
  - ✅ elevation-based walls + windows: `dim_exterior_wall_area`, `dim_party_wall_area`, `dim_window_area`
  - ✅ param-multiplied: `dim_continuous_footings_volume`, `dim_foundation_wall_area`, `dim_interior_wall_area`, `dim_roof_surface_area`
  - ✅ flat-roof: `dim_roof_cavity_insulation_area`

Ships ~16 of 18 building dims + 3 info quantities + most garage dims. **~60% of PROJECT quantitative inputs auto-derived on day one.**

### 6.4 Phase 4b.3 — Step 10 depth

- Add `depth_m` to polygon schema + UI input on measurement panel.
- Unlock: `dim_columns_piers_pads_volume`, `garage_columns_piers_pads_volume`.
- Unlock variant: per-polygon footing cross-section override (if a user wants to tag a non-constant section).

### 6.5 Phase 4b.4 — Polish

- Cross-app deep links from fidelity badge sheet refs (§5.2 click-through).
- Polygon-placement validation rules per §3.4 — non-blocking warnings.
- Bulk "Use PDF-Parser for all connected dims" action on the PROJECT header.
- Pitched-roof cavity handling (Q22 resolved).

### 6.6 Never (decided non-goals)

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

- **Q20 — Caching last-computed values.** Should the fidelity badge cache the last-computed value + timestamp, so switching sources doesn't force a re-run every time? Light — doable in v1 as `{value, computed_at, summary}` per dim, or defer to polish phase.
- **Q21 — Auto-re-run on polygon change.** When the user draws/edits a polygon in PDF-Parser while a PROJECT dim is set to `pdf-parser` source, does the bridge auto-re-run, or does the user have to manually toggle / confirm? **MVP proposal:** auto-re-run with a subtle banner on PROJECT ("PDF-Parser updated — 3 dims refreshed") for the first few seconds after change. Prevents stale data without nagging dialogs. Debounced ~500ms.
- **Q22 — Roof cavity vs roof surface.** In residential, cavity insulation area ≠ pitched roof surface area. Flat roof: cavity ≈ plan area. Pitched roof: cavity ≈ plan area (above-ceiling insulation, not following the rafters); surface > plan area (pitch factor). Can a single `roof_plan` polygon feed both dims with different derivations? **Proposal:** yes. `roof_plan` → `dim_roof_cavity_insulation_area` direct + `dim_roof_surface_area` × pitch. Add a `roof_cavity_override` tag for when the user wants to draw a different shape (e.g., cathedral ceiling).
- **Q23 — Garage polygon tagging.** Option A: duplicate component tags with `garage_` prefix (`slab_garage`, `wall_garage_exterior`, etc.). Option B: polygons carry a `scope: "building" | "garage"` boolean and reuse building-side component tags. **Leaning B** — cleaner enum, less duplication, lets a user tag `scope: garage` retroactively without re-tagging. Compile-time check in the bridge: a polygon with `scope: garage` routes to `garage_*` target dims instead of `dim_*`.
- **Q24 — Multi-storey wall-height handling.** `param_wall_height_m` is a single scalar. Multi-storey buildings have per-storey heights. MVP assumes a single weighted wall height (user computes externally). **Future:** add `param_wall_height_storey_1`, `_storey_2`, ... with a `stories_above_grade`-driven renderer. Deferred past v1.
- **Q25 — Party/Demising wall naming in code.** Field stays `dim_party_wall_area` in code + project JSON (BEAM gSheet compatibility), UI label shows "Party / Demising Wall Area" per Andy's 2026-04-20 call. Non-breaking.
- **Q26 — PDF-Parser Step 10 ownership.** Who writes Step 10 — is it part of this Phase 4b scope or a separate PDF-Parser workstream that Phase 4b consumes? **Proposal:** the polygon-schema changes in §3.3 + the polyline tool + the component dropdown live in a new PDF-Parser session branch (`pdfparser-step10` or similar) and land via their own PR before Phase 4b.2 starts. Phase 4b.2 assumes they're available.

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
