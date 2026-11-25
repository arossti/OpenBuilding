# TakeOffEh ↔ BEAMweb Bridge — workplan + design spec

> **Cross-app bridge: TakeOffEh polygons → BEAMweb PROJECT dimensions.** This is the Phase 4b detailed spec scoped in [BEAMweb.md §6](./BEAMweb.md) + [§7 Q19](./BEAMweb.md). Read BEAMweb.md §0, §5.1, and §7 Q19 first for the parent-workstream context (state model, flat-dict project JSON, source precedence).
>
> **Status:** Phase 4b.2 (bridge MVP) shipped on `PDF-Bridge` branch, 2026-04-21. End-to-end flow working: Parser persists to IndexedDB, BEAMweb reads + aggregates, "Import from TakeOffEh" modal previews and writes dims. See [§0 Shipped update](#shipped-update--2026-04-21) for the commit list and architectural deltas from the original spec.

---

## 0. Cold-start handoff (read this first)

### Status as of 2026-04-20 (design spec, pre-implementation)

- Design agreed in principle with Andy 2026-04-20 around: (a) per-dim source selector with auto-sync + active-pull semantics, (b) generic component tags + lookup-table translation to dim fields, (c) polyline tool for linear features (interior walls, interior footings) in red, (d) elevation-drawn exterior walls with windows netted as the preferred path for above-grade wall areas, (e) numbered UI labels on quantitative PROJECT inputs, (f) fidelity badge with sheet references, (g) wizard mode shelved.
- **No code yet.** Implementation sequenced in §6.
- **Dependency chain:**
  1. TakeOffEh Step 10 (component taxonomy + polyline type + red stroke + sheet denorm)
  2. BEAMweb PROJECT "geometry parameters" concept (new `param_*` fields)
  3. Shared bridge module `js/shared/polygon-map.mjs`
  4. Source selector UI + fidelity badge on each PROJECT dim row
  5. Numbered labels pass (trivial, can land anytime)
- **Current reality.** TakeOffEh polygons carry `{id, label, vertices, closed, type: area|window, mode: net|add}` per [`polygon-tool.mjs`](../../js/polygon-tool.mjs). No component tag. No depth. `volumes[]` stub exists in [`project-store.mjs`](../../js/project-store.mjs) but empty. Sheet classification (plan/section/elevation) is tracked via [`sheet-classifier.mjs`](../../js/sheet-classifier.mjs) but semantically inert — doesn't influence measurement semantics. See BEAMweb.md §0 Phase 4b entry for audit findings.

### Shipped update — 2026-04-22 (PR #11 merged)

Phase 4b is now **~95% shipped**. PR #11 (merge commit `49c35b4`) closed out the five bridge-UX milestones plus two long-standing polygon-edit bugs and built the dev-harness infrastructure for the next Polish pass. All items in the prior-session "What's NOT shipped yet" list except sheet-class validation banners and the source-selector widget (the latter explicitly replaced by the Trust / Trust + Verify button pair — see M1) are now on `main`.

**Active branch:** `Magic-Wand-Polish` (fresh off `main` after PR #11 merge). Future agents: `git checkout Magic-Wand-Polish` to continue; `git log main..HEAD` = empty until work lands.

**Testing status:** Every milestone was Playwright-verified against seeded IndexedDB fixtures **before commit** (per Andy's "tests before commits" directive). PR #11's test plan ran end-to-end on merge day, all checks passed. No post-merge regressions flagged.

**Commits on PR #11 (merged to `main` as `49c35b4`, in order):**

| Commit | Scope |
|---|---|
| `be1ba92` | CLI debug harness at `schema/scripts/debug-pdf-extract.mjs` + `pdfjs-dist` devDep + `npm run debug:pdf` + `.gitignore` for `.playwright-mcp/` |
| `4f9b820` | Favicons linked on all 6 apps (silences `/favicon.ico` 404) |
| `403b8c9` | Ruler click no longer edits polygon edges (broadens the polyline-tool guard to cover ruler) |
| `07dd8a0` | Calibrate click no longer edits polygon edges (symmetric fix) |
| `990ae94` | **M1** — Trust + Trust + Verify split (one-click bulk, modal always available post-import) |
| `4631169` | **M2** — Sheet deep-links (`takeoffeh.html#sheet=A-101` + `target="takeoffeh-tab"` named window so successive clicks reuse the same Parser tab, not spawn a new one per click) |
| `a8e5045` | **M3** — Fidelity badge under every imported PROJECT dim + param (JSON envelope, clickable sheet refs, auto-clears on USER_MODIFIED) |
| `a539c79` | **M4** — `depth_m` per polygon + Summary Table inline input + `dim_columns_piers_pads_volume` aggregator (Phase 4b.3 done) |
| `944c720` | **M5** — Q23 garage scope: per-polygon `scope` field ("building" \| "garage"), two-pass scope-partitioned aggregator, 8 specs extended with `garageTargetDim` / `garageDim` counterparts |
| `804882f` | Docs: `docs/takeoffeh.md` → `docs/completed/takeoffeh.md` (new `completed/` folder convention) |
| `cf8552f` | Docs: `docs/pdf-resources/` → `docs/pdf-samples/` (ends the visual collision with `docs/PDF References/`) |
| `5b10897` | TakeOffEh: restore path skips zero-byte PDF blobs + drops the orphan record (fixes `InvalidPDFException` on boot) |

---

### Shipped update — 2026-04-21 (PR #1 through the pre-PR-#11 state)

Phase 4b.0 through 4b.2 shipped on `PDF-Bridge` (merged to `main` as PR #1, 2026-04-21). Follow-on work continued on `PDF-Bridge-2` — F&S flow fix + §8 planning note + dependency-graph stub. PR #2 (`e15fe8f`) rolled those into `main`.

**Testing status (historical):** PR #1 merged based on the test checklist in its body, **without explicit verification runs**. Andy flagged a post-merge regression that became `85dd39d` (F&S did not flow from imported PROJECT values); verified by Andy in-tab afterward. Second-round testing of the full Import → Apply → F&S loop landed on `PDF-Bridge-2`. Multi-tag extension (see Q31) was the next round of tagging work — re-tested and confirmed working on 2026-04-22; Q31 now largely resolved (see §7).

**Commits on `PDF-Bridge` (merged to `main`, in order):**

| Commit | Scope |
|---|---|
| `f93217d` | Phase 4b.0 — numbered labels on 30 quantitative PROJECT inputs |
| `529e297` | Phase 4b.1 — TakeOffEh polygon schema + polyline type + component-tag picker |
| `f07181b` | Phase 4b.1 — BEAMweb `param_*` fields + `dimension_sources` map |
| `cd0b2a2` | Summary Table + CSV: Type + Tag columns on every row |
| `5e9e22d` | Summary Table + CSV: Preset column |
| `f907888` | IndexedDB autosave + cross-session restore in TakeOffEh |
| `74f6108` | `target="_blank"` on inter-app nav (side-by-side tab workflow) |
| `9efed2d` | Phase 4b.2 — bridge aggregator (`polygon-map.mjs`) + BEAMweb import modal |
| `2e8c31d` | 0.00→— fix; sheet-title fallback to classification; inline Tag + Preset selects |
| `3367bf8` | TakeOffEh sidebar Geometry Parameters panel + bridge fallback to Parser params |
| `f4e590d` | Cross-feeds: one polygon serves multiple dims (slab area + slab perimeter) |
| `a49d02d` | Polyline-tool hit-test guard + workplan doc update |

**Commits on `PDF-Bridge-2` (in-flight, not yet merged, in order):**

| Commit | Scope |
|---|---|
| `85dd39d` | Post-import flow fix: `syncProjectToFsBridge()` + LHW decomposition so F&S picks up imported values |
| `101b6e9` | BEAMweb.md §8 — planning note for eventual dependency-graph migration (listener → graph) |
| `e492cad` | Dependency Graph stub: StateManager.exportDependencyGraph + new tab 19 + OBJECTIVE-shape scaffolding |

**Architectural deltas from the original spec:**

- **Cross-tab persistence via IndexedDB** was not in the original spec. Added to solve the "reload PDF every time you switch apps" problem. Stores full project JSON + PDF blob keyed by uuid. Doubles as the cross-tab bus — BEAMweb reads TakeOffEh's saved projects directly from the same origin's DB, no BroadcastChannel or postMessage needed.
- **Multi-tab workflow (`target="_blank"`)** replaces the implicit single-tab assumption. Each app lives in its own tab so the Parser can stay alive with a loaded PDF while BEAMweb pulls takeoffs next door.
- **Parser-side Geometry Parameters panel.** The original spec put `param_*` inputs only on BEAMweb's PROJECT tab. Shipped mirror on the Parser sidebar so drawing-adjacent scalars (wall height, roof pitch, footing dims) can be entered without context-switching. Values write to `project.params` in IndexedDB; BEAMweb reads them as a fallback when its own StateManager params are blank.
- **Cross-feeds**, new: one polygon feeds multiple dims. `slab_foundation` polygon's area → foundation slab + below-grade + total floor; same polygon's perimeter → foundation wall (× basement height) + continuous footings (× H × W). `slab_above_grade` polygon's perimeter is a fallback for exterior wall area when no elevation walls are drawn. Explicit tags (`exterior_perimeter`, `wall_exterior`) supersede implicit cross-feeds when present. See §3.6.
- **Manual Import button instead of auto-reflow.** Original spec (§2.2, §2.4, Q21) described a "source selector pill per dim" with auto-reflow on polygon change. Shipped: a single "Import from TakeOffEh" button in BEAMweb's action bar that opens a preview modal with per-dim checkboxes. User explicitly applies selected rows. Simpler, predictable, no dialogs asking to overwrite USER_MODIFIED values mid-session. Per-dim source pills can still land later if the single-button model proves limiting.
- **Inline Tag + Preset re-editing.** Summary Table rows now render Tag and Preset as `<select>` cells that re-classify a polygon in place. User-friendlier than "pick polygon on the plan to edit its tag."

**What's shipped since the 2026-04-21 entry (all on `main` via PR #11):**

- ✅ **Fidelity badge** on PROJECT dims + params (commit `a8e5045`) — JSON envelope provenance, clickable sheet refs, auto-clears on USER_MODIFIED.
- ✅ **Clickable sheet deep-links** (commit `4631169`) — `takeoffeh.html#sheet=X` protocol + `target="takeoffeh-tab"` named window for no-tab-mania.
- ✅ **`depth_m` + pad/pier volume** (commit `a539c79`) — Phase 4b.3 complete.
- ✅ **Cross-app bulk action** (commit `990ae94`) — Trust button = one-click bulk import; Trust + Verify = the existing modal, available anytime.
- ✅ **Q23 garage scope** (commit `944c720`) — per-polygon scope boolean, scope-aware aggregator, 8 specs extended with `garageTargetDim` / `garageDim`.

**What's still not shipped (deferred or out-of-scope for the bridge workstream):**

- **Source selector widget per dim** (§5.1) — explicitly replaced by the Trust / Trust + Verify button pair. Only revisit if users ask for per-dim granularity beyond "apply this import and stop."
- **Auto-re-run on polygon change** (Q21) — replaced by the explicit Trust button. User-triggered, not event-driven.
- **Sheet-class validation banners on offending polygons** (§3.4) — low-value cosmetic; warnings still surface in the Import preview only.
- **Draw-time scope picker** (new 2026-04-22) — today scope is set post-hoc via the Summary Table inline select. A toolbar scope toggle next to the component-tag dropdown would let users set scope at draw time. Small UX follow-up.
- **Assembly-preset wire-through to Phase 4 tabs** (§6.6 Phase 4b.5) — presets persist on polygons but no assembly tab consumes them yet. Gated on BEAMweb Phase 4 assembly-tab ports, not on the bridge.

### What the bridge does

A user draws polygons in TakeOffEh across plan views, elevations, and (future) sections. Each polygon carries a `component` tag picked at measurement time. The bridge aggregates matching polygons across sheets and flows derived values into BEAMweb PROJECT dimension fields via `StateManager.setValue(fieldId, value, VALUE_STATES.DERIVED)`, with the per-dim source set to `takeoffeh`. User manual edits (USER_MODIFIED) override; the selector can be toggled to re-flow on demand.

Some dimensions derive directly from polygons (slab area = Σ plan polygons tagged `slab_foundation`). Some need a project-level parameter the user enters manually on PROJECT (e.g., `param_wall_height_m` converts perimeter/polyline length into wall area). Some need Step 10's per-polygon depth (pad/pier volumes). A few stay manual forever (timber framing volume — not a takeoff concept).

### What the bridge does NOT do

- **No HOT2000 parsing.** Operational energy is [BEAMweb.md Phase 7](./BEAMweb.md)'s problem.
- **No schedule parsing.** Window schedules stay manual unless drawn on elevation sheets.
- **No timber takeoff.** Heavy timber elements are discrete line items, not a drawing-takeoff product. Belong on Structural Elements tab, not summed on PROJECT. See §1 Non-goals.
- **No cross-project polygon sharing** (see BEAMweb.md §7 Q12).

### Where to pick up next (cold-start one-liner, 2026-04-22)

PR #11 is merged (`main` at `49c35b4`). Active branch is **`Magic-Wand-Polish`** — branched clean off post-merge `main`, empty of commits. **Bridge work is substantially done**; the branch exists to return to the TakeOffEh **Magic-Wand auto-detect polish pass** that was the original intent before bridge work consumed the prior session. See the handoff prompt that spawned this session for Magic-Wand-specific context.

Remaining bridge-concern items are all either data-tasks, gated on other work, or low-priority UX polish:

1. **Q31 multi-tag extension** — cross-feeds confirmed working on re-test 2026-04-22; resolved. Only item left is the UX sub-item (b) in §7 Q31: retroactive multi-tag chips in the Summary Table. Add when a real-world case surfaces that the implicit cross-feed can't express.
2. **Q27 upstream BEAM + materials-DB refresh** — re-fetch the current Google Sheet URLs, diff the generations, flag row changes. Standalone session worth, ideally before the release push.
3. **Draw-time scope picker** — toolbar scope toggle at measurement time alongside the component-tag dropdown. ~50 lines. Low priority; Summary Table inline select already handles the re-scope case.
4. **Phase 4b.5 assembly-preset wire-through** — gated on Phase 4 BEAMweb assembly-tab ports. Presets persist on polygons today but downstream is a no-op until those tabs land. Check in on BEAMweb progress before picking this up.
5. **Sheet-class validation banners on offending polygons** (§3.4) — lowest priority; warnings already surface in the Import preview.

For the actual **Magic-Wand Polish** direction (what `Magic-Wand-Polish` the branch is for), see [`BEAMweb.md §12`](./BEAMweb.md) for the dev-tooling context + the handoff prompt for specific targets (open-quad clustering, auto-calibration, dimension-string extraction).

---

## 1. Goals

1. **Automate what's automatable.** A user should produce most of PROJECT's 13+ Building Dimension inputs from TakeOffEh polygons + a short list of project-level parameters, without re-entering numbers.
2. **Be honest about the 2D→3D gap.** Dimensions that can't be derived (timber volume, roof surface without pitch, etc.) show "Manual" as the source clearly — no silent defaults, no guessed values.
3. **Allow clean swapping between sources.** Per-dim picker for Imported / TakeOffEh / Manual. Re-flow on demand.
4. **Preserve user edits.** USER_MODIFIED stays sticky; source re-selection shows a confirmation before overriding.
5. **Stay within the flat-dict project JSON contract** ([BEAMweb.md §5.1](./BEAMweb.md)). Add fields, don't restructure.
6. **Leverage sheet classification as a semantic signal.** Sheet class informs which derivation path fires (elevation-drawn wall_exterior → surface area direct; plan-drawn exterior_perimeter → × param_wall_height_m fallback).

### Non-goals

- Perfect round-tripping of every BEAM workbook dimension.
- Non-polygonal measurement workflows (dimension strings, annotations — TakeOffEh doesn't produce them).
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
| `takeoffeh` | Value came from the bridge aggregating tagged polygons | Cyan pill, "TakeOffEh · {detail}" |
| `manual` | User typed it | Amber pill, "Manual" |

Source lives in a new StateManager map, **distinct from the existing `VALUE_STATES` enum**. VALUE_STATES remains the precedence authority (tracks the provenance of a single write — DERIVED vs USER_MODIFIED vs IMPORTED vs CALCULATED). Source is the user's declared preference for where this dim should get its value from. They inform each other but play different roles.

**New StateManager API:**

```js
StateManager.getDimensionSource(fieldId)       // "unset" | "imported" | "takeoffeh" | "manual"
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
    "dim_foundation_slab_floor_area": "takeoffeh",
    "param_wall_height_m": "manual"
  }
}
```

### 2.2 Dual-purpose source selector

The per-dim source toggle is both display + action:

- **Reading** — reflects whichever source last wrote the value. Auto-syncs:
  - User types in the input → selector flips to Manual
  - Load Sample fires → selector flips to Imported (for every dim the sample touches)
  - TakeOffEh polygon change fires → selector stays TakeOffEh (if already set) or does nothing (if on Manual/Imported)
- **Writing** — picking a source *triggers a re-flow from that source*:
  - `takeoffeh` → bridge pulls current polygon state, overwrites dim (after confirm if USER_MODIFIED)
  - `imported` → if a loaded project JSON has a value, re-apply; else no-op
  - `manual` → unlocks the input; value stays where it was; next keystroke writes
  - `unset` → clears the dim value + source state

This "last-touched source wins" precedence ([Q19a resolved](./BEAMweb.md)) keeps the single-user flow natural: whatever action wrote the value last is the source.

### 2.3 Reset semantics

- **Reset Tab** (existing action on PROJECT) clears all dim values + sets all dim sources → `unset`.
- Reset does NOT touch:
  - TakeOffEh polygon state (lives in the TakeOffEh app's own StateManager scope / project-store)
  - Last-loaded workbook quarantine
- User re-selects `takeoffeh` or `imported` after Reset → data flows back in fresh. This is how a user can "rollback PROJECT edits without losing the drawing work."

### 2.4 Cross-app state flow

```
[ TakeOffEh polygons ]        ← drawn by user with sheet class + component tag
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
- Explicit user action (source toggle → `takeoffeh`, bulk "Use TakeOffEh for all" action)
- TakeOffEh polygon change event (debounced ~500ms)
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

**Key property**: parameters are always `manual` source only — no takeoff path. They render as **required inputs when any dependent dim is sourced from TakeOffEh polyline/perimeter**. Blank param + perimeter polygon = bridge emits a "needs `param_wall_height_m`" fidelity badge instead of a value, making the missing input obvious rather than silently defaulting to 0.

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

Sheet denormalization makes polygon records self-contained — the bridge doesn't need to reach back into TakeOffEh's sheet map at aggregation time.

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

Validation surfaces as a subtle banner in the TakeOffEh UI next to the offending polygon, plus a "X polygons have placement issues" banner on the PROJECT source-selector if unresolved. Non-blocking — user can ignore.

### 3.5 Fallback visibility (Andy's ask)

When the bridge falls back from a preferred path to a secondary path, the fidelity badge shows it explicitly:

- Preferred (elevations present): `TakeOffEh · 4 elevation polygons · A-301, A-302, A-303, A-304`
- Fallback (elevations absent, plan perimeter used): `TakeOffEh · plan perimeter × param_wall_height_m · A-101 · ⚠ elevations preferred`

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
│ 9. FOUNDATION SLAB/FLOOR AREA      │ 110.40   │ m² │ [▾ TakeOffEh · 1 plan]      │
└────────────────────────────────────┴──────────┴────┴──────────────────────────────┘
```

Pill colour + text by state:
- `unset` — grey pill, "Select Source"
- `imported` — blue pill, "Imported"
- `takeoffeh` — cyan pill, "TakeOffEh · {summary}"
- `manual` — amber pill, "Manual"

Dropdown entries: all four states, with current marked. Picking a state that requires re-flow (e.g., takeoffeh) and that would overwrite USER_MODIFIED fires a small confirm dialog ("This will overwrite your manual edit — continue?").

### 5.2 Fidelity badge

Secondary caption under the dim input when source is `takeoffeh`, listing what fired.

Examples:
- `TakeOffEh · 4 elevation polygons · A-301, A-302, A-303, A-304`
- `TakeOffEh · plan perimeter × 2.7m (wall height param) · A-101 · ⚠ elevations preferred`
- `TakeOffEh · Σ 12 pad polygons · A-101`
- `TakeOffEh · needs param_wall_height_m`

**Sheet refs are clickable** (Andy's ask — #9 refinement): click `A-301` → opens TakeOffEh to that sheet in a new tab / the other app window. Cross-app deep link via URL fragment: `takeoffeh.html#sheet=A-301`.

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

### 5.4 Polyline tool button (TakeOffEh)

New button next to the area-polygon tool in the TakeOffEh toolbar. Red stroke. Shortcut: `l` (for length).

**Label:** "Trace Length"
**Tooltip:** "For interior walls, interior footings, and other linear features. Draws open polylines, measures length only."

Implementation: extend [`polygon-tool.mjs`](../../js/polygon-tool.mjs) to accept `type: polyline`; reuse the vertex-drawing logic; skip closure; label measurement output "length" (m/ft) instead of "perimeter".

### 5.5 Component tag picker (TakeOffEh)

On polygon creation/edit, a "Tag" dropdown appears in the measurement panel.

- Options filtered by current polygon type (area/window/polyline) + current sheet class (plan/elevation/section) per §3.4.
- Auto-defaults to the most-likely tag based on context. E.g., closed polygon on an elevation sheet → defaults to `wall_exterior`. User can override from the dropdown.
- The tag is required before the bridge can pick the polygon up — untagged polygons show a subtle "tag required" hint but don't block drawing.

### 5.6 Wall-height param prompt ergonomics

When the user draws a polyline tagged `wall_interior` or a closed polygon tagged `exterior_perimeter`, and `param_wall_height_m` is blank on PROJECT, the TakeOffEh sidebar shows an inline prompt: "Set Wall Height on PROJECT tab" (with a click-through link). Non-blocking — user can draw freely and fill the param later.

### 5.7 Assembly-preset picker on wall polylines (2026-04-20)

**Problem being solved.** BEAM gSheet's current workflow populates every candidate material in a wall-assembly picker (framing + sheathing + cladding + insulation + barriers + interior finish), each at 0% by default. The user then manually tunes percentages across dozens of rows to describe a single wall assembly. This is a known pain point — same assembly typed repeatedly across projects.

**The preset.** When the user draws a wall polyline (`type: polyline`, `component: wall_interior`) or a perimeter polygon (`type: area`, `component: exterior_perimeter`), the TakeOffEh measurement panel shows a second dropdown below the component tag: **Assembly preset**. Values (v1 catalogue — to be validated, see Q30):

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

**Default seeding.** Each preset maps to a small table: `{ row_hash → percent }` applied on the assembly tab's first render when the dimension is sourced from `takeoffeh` and the row isn't USER_MODIFIED. Values stay editable — the preset is a seed, not a lock.

Example (illustrative — actual values to be validated; see Q30):
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

**Preset catalogue location.** Proposed: a new file `js/shared/assembly-presets.mjs` (or similar) exports `ASSEMBLY_PRESETS`, a data table mapping preset IDs → display label + the default row-seed table. Lives in `js/shared/` because both TakeOffEh (picker UI) and BEAMweb (assembly tabs) consume it.

**Scope implication.** This is a non-trivial addition that interacts with Phase 4 (the actual Interior Walls / Exterior Walls / Party Walls assembly tabs — none of which have ported yet). Until those tabs port, the preset is metadata on the polyline that nothing downstream consumes. Sequenced in §6.3 (carried on polygons Phase 4b.1) + §6 new Phase 4b.5 (wire to assembly tabs once they port).

---

## 6. Sequencing / phases

### 6.1 Phase 4b.0 — Zero-dep standalone (**✅ shipped** on `PDF-Bridge` commit `f93217d`, 2026-04-20)

- **Numbered labels** (§5.3) — one label-string change per field in `project-tab.mjs`. No behavior impact, no risk. Shipped as a standalone commit alongside the Q25 Party → Party / Demising label update.

### 6.2 Phase 4b.1 — Foundation (TakeOffEh Step 10 minimal + PROJECT params) (**✅ shipped** 2026-04-20)

**TakeOffEh side (commit `529e297`):**
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
- ✅ Import from TakeOffEh modal: project picker when multiple sessions, param-missing warning banner, per-dim checkbox table showing current vs computed, source column with contributing polygons + sheets + assembly presets + warnings. Apply writes through and refreshes PROJECT tab. (commit `9efed2d`)
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
- Bulk "Use TakeOffEh for all connected dims" action on the PROJECT header.
- Pitched-roof cavity handling (Q22 resolved).

### 6.6 Phase 4b.5 — Assembly-preset wire-through (2026-04-20)

- `js/shared/assembly-presets.mjs` (new): `ASSEMBLY_PRESETS` catalogue — preset ID → display label + default `{ row_hash → percent }` seed table. Preset list per §5.7 (subject to Q30 refinement).
- TakeOffEh measurement panel: second dropdown on `wall_interior` / `exterior_perimeter` polylines — "Assembly preset" (persists to polygon `assembly_preset` field per §3.3).
- Bridge passes `assembly_preset` through to the downstream Phase 4 assembly tab (Interior Walls / Exterior Walls / Party Walls) when those ship. Assembly tab seeds row percentages from the preset on first render — editable, not locked.
- **Gated on:** the actual Phase 4 assembly tab ports (Interior Walls, Exterior Walls, Party Walls — §6 Phase 4 queue in BEAMweb.md). Until then, the preset is captured on the polygon but downstream is a no-op. Metadata-only in the interim is fine — preserves user intent for when tabs port.

### 6.7 Never (decided non-goals)

- Timber framing volume from polygons (see §1 Non-goals).
- HOT2000 operational energy (BEAMweb.md §10).
- Point-type polygons (use small area polygons instead).
- Wizard mode with animated arrows (shelved 2026-04-20).

---

## 7. Open questions

Carrying forward from BEAMweb.md §7 Q19 with updates:

- ✅ **Q19a (precedence)** — resolved: last-touched source wins; USER_MODIFIED is sticky; explicit source toggle overrides with confirm.
- ✅ **Q19b (aggregation)** — resolved: sum, with fidelity badge showing "N polygons · total" so user can audit.
- ✅ **Q19c (taxonomy mapping)** — resolved: generic component tags + lookup table (§3.2 + §4).
- ✅ **Q19d (reset semantics)** — resolved: §2.3 — Reset Tab clears PROJECT, preserves TakeOffEh polygon state, user re-selects source to re-flow.
- ✅ **Q19e (JSON persistence)** — resolved: yes, `dimension_sources` map alongside `fields` in the project JSON.

### New questions opened by this spec

- ✅ **Q20 — Caching last-computed values.** Moot in the current manual-Import model — preview always runs fresh. Re-opens if auto-reflow returns.
- ✅ **Q21 — Auto-re-run on polygon change.** Replaced by explicit Import button in BEAMweb action bar. User-triggered, not event-driven. Revisit if users report friction with manual trigger.
- ✅ **Q22 — Roof cavity vs roof surface.** Shipped per proposal — one `roof_plan` polygon feeds both `dim_roof_cavity_insulation_area` (direct plan area, pitch backed out) and `dim_roof_surface_area` (plan × pitch factor). `roof_cavity_override` tag available for cathedral ceilings. See `computeContribution` in [polygon-map.mjs](../../js/shared/polygon-map.mjs).
- ✅ **Q23 — Garage polygon tagging (resolved 2026-04-22).** Shipped per option B: polygon schema gains `scope: "building" | "garage"` (default "building"), orthogonal to `component`. Aggregator runs two scope-partitioned passes — building-scoped polygons route to `targetDim` / `targetDimExtras`, garage-scoped polygons route to `garageTargetDim` / `garageTargetDimExtras`. Specs extended on: `slab_foundation`, `slab_above_grade`, `wall_exterior`, `exterior_perimeter`, `roof_plan`, `pad_pier`, `window_opening`, `wall_interior`. Cross-feeds carry a `garageDim` so a garage-scoped slab's perimeter flows into `garage_foundation_wall_area` + `garage_continuous_footings` the same way a building-scoped slab's does for the dim_* counterparts. Summary Table UI: new "Scope" column between Tag and Preset with an inline Building / Garage select. Polygon user doesn't retag for garage — they keep the same `slab_foundation` / `wall_exterior` / etc. tag and flip Scope.
- **Q24 — Multi-storey wall-height handling.** Still open / deferred.
- **Q31 — Multi-tag extension (Andy, 2026-04-21; largely resolved 2026-04-22).** Cross-feeds (§3.6) let one polygon drive multiple dims via area + perimeter, with `supersededBy` resolving priority. On re-test 2026-04-22 Andy confirmed the existing cross-feed path is working — the earlier concern traced to selecting a non-cross-fed tag on the polygon under test (`slab_foundation` fans out to foundation-wall + continuous-footings; `slab_above_grade` and `exterior_perimeter` fan out differently). No plumbing gap. Remaining items are data + UX, not mechanism:
  - (a) **Which additional tag combinations?** Candidates to queue if they come up — `roof_plan` perimeter feeding fascia/soffit length, `floor_area` (non-`slab_above_grade`) area feeding a generic finished area, `exterior_perimeter` perimeter feeding additional envelope dims. Add each as a fresh `COMPONENT_TO_DIMENSION[component].crossFeeds[]` entry; no structural code changes.
  - (b) **Retroactive multi-tag assignment in the Summary Table (new, Andy 2026-04-22).** Today the Summary Table lets a user inline re-pick a polygon's component Tag (single select) and assembly preset (single select). When a polygon legitimately serves multiple roles (e.g. a user wants a slab that explicitly tags foundation-slab AND exterior-perimeter, overriding the implicit cross-feed), the single Tag cell can't express that. Ask: add an **add/remove tag chip UI** to the Tag cell so a polygon can carry a primary tag plus N explicit secondary tags — mirroring the inline polyline re-tag pattern shipped in `2e8c31d` but multi-valued. The aggregator already handles multiple contributors per dim; polygon schema would need `component` → `components[]` (or keep `component` as primary + new `secondary_components[]`). Gated on whether real-world users actually hit a case the implicit cross-feed can't express — add when the need surfaces, not prospectively.
  - (c) **Supersedes semantics.** Each new cross-feed declares its own `supersededBy` list so user-explicit tags always win. Review the lattice at the same time — if tag A supersedes B and B supersedes C, is A→C implicit? Currently no; the mapping is flat. Formalise if/when users want transitive supersedes.
  - (d) **UI impact for (a) only.** None on the Parser side — the Import preview already renders multiple contributors per dim. (b) above is a larger Parser UX change.
- ✅ **Q25 — Party/Demising wall naming in code.** Shipped. Field ID `dim_party_wall_area`, UI label "Party / Demising Wall Area".
- ✅ **Q26 — TakeOffEh Step 10 ownership.** Resolved as part of Phase 4b.1 scope (single branch, single PR). Polygon schema + polyline + component dropdown shipped in commit `529e297`.

## Appendix — implementation sketch

### `js/shared/polygon-map.mjs` (new)

```js
// Single source of truth for component → dimension mappings.
// Lives in js/shared/ because BEAMweb and TakeOffEh both consume it.

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
  // Used by the bulk "Use TakeOffEh for all" action.
}
```

### `js/beam/source-selector.mjs` (new)

```js
// Renders the per-dim source pill + dropdown.
// Listens for StateManager dimension-source changes; re-renders on change.
// Fires bridge.refreshDimension(dimId) when user picks takeoffeh.

export function renderSourcePill(dimId) { /* ... */ }
export function wireSourceSelector(panel) { /* ... */ }
```

### `project-tab.mjs` (modifications)

- Add `PARAMETERS` field-def array + a new `renderCollapsibleSection("params", "Geometry Parameters", ...)` section, between Building and Garage.
- Prepend numbered labels per §5.3.
- Render source pill alongside each dim input via `renderSourcePill(f.id)` in `renderDimRow` / `renderInfoRow`.

### `polygon-tool.mjs` (modifications, TakeOffEh Step 10)

- Add `type: polyline` branch to drawing logic — vertex collection unchanged, closure skipped, stroke red.
- Add component tag dropdown to measurement panel, options filtered by current type + sheet class.
- Add optional depth input for `pad_pier` (Step 10b).
- Persist new fields (`component`, `sheet_id`, `sheet_class`, `depth_m`) to project store.

### `project-store.mjs` (modifications, TakeOffEh)

- Polygon schema extended with new fields.
- Denormalize sheet metadata at save.
- Export a polygon-change event that the cross-app bridge subscribes to.

---

*End of draft workplan. Ready for Andy's review — expect revisions once his takeoff-strategy map lands.*
