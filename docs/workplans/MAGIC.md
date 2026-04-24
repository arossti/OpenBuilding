# PDF-Parser Magic-Wand Polish — workplan (MAGIC.md)

> Polish pass on the PDF-Parser magic-wand (auto-detect) path. Adds dimension-string calibration with declared-vs-detected scale cross-check and a shrink-wrap building-outline detector that replaces the current "closed-polygon only" heuristic. Branch: `Magic-Wand-Oculus` (successor to merged PRs #12 + #13). Started 2026-04-22.

---

## 0. Cold-start handoff

### Status as of 2026-04-24 (session 4 — Oculus shipped + relocated; C7c retired; C7e is what's actually next)

**Successor agent: read this block first.** Active branch: `Magic-Wand-Oculus`, tip **`6f134b3`**. Three commits since `main` at `cf28d11` (PR #13):

- `21fb77d` — C7d Oculus core (tightenOneStep API + canvas-drawn glyph + "O" keybind + click hit-test)
- `0f6f207` — Refactor: Oculus moved from canvas-floating glyph to top toolbar button. Andy feedback: floating glyph collided with vertex handles when polygon shrank, and broke the toolbar pattern set by Auto-Calibrate / Auto-Detect.
- `6f134b3` — Icon fix: `bi-aperture` was blank in bootstrap-icons 1.11.3 (not in that release); swapped to `bi-arrows-angle-contract` — the universal "shrink/contract" glyph.

#### What's shipped on the Oculus path (C7d)

- **`tightenOneStep(pageNum, polyIdx)`** in [`js/polygon-tool.mjs`](../../js/polygon-tool.mjs). For each orthogonal edge: find next candidate inward from centroid, apply as one undo-captured batch. Returns `{edgesMoved, edgesSkipped, reason}`. Skips diagonals + already-innermost edges + polygons without `_shrinkCandidates`.
- **`findDetectedPolyIdx(pageNum)`** locates the page's first auto-detected polygon (the one with candidates) for keyboard-shortcut targeting.
- **`tightenOculus()`** wrapper in [`js/app.mjs`](../../js/app.mjs) drives both the toolbar button (`PP.tightenOculus()`) and the `O` keybind, with status-bar feedback.
- **Toolbar button** in [`pdfparser.html`](../../pdfparser.html) sits right after Auto-Detect (D) using `bi-arrows-angle-contract`. Static location, no canvas overlap.

Verified on docs/sample.pdf p9 FOUNDATION: polygon (120.5, 19.5)–(638, 594.3) tightens to (141.2, 40.1)–(560, 582.4) on first press, (188, 65.4)–(542.9, 570.9) on second, exact match to predicted candidate detents. Cmd+Z reverses each step. Zero console errors.

#### Design pivot: C7c retired (Andy 2026-04-24)

Original C7c spec was the ArchiCad-style popup distinguishing edge-click ("Drag edge / Insert vertex") from vertex-click ("Drag point / Delete vertex"). After C7d landed, Andy reviewed and decided to drop C7c entirely:

- **Delete-vertex is not needed.** Dragging a vertex onto its neighbor already merges them via the existing `endDrag` merge logic — fully covers the "remove this vertex" use case.
- **Insert-vertex via Alt-click is sufficient** (`5d6f8db` stopgap is now permanent UX). The popup adds discovery overhead without delivering new capability.

The Alt-click + drag-merge combo is the agreed permanent edge-edit vocabulary. No popup work needed.

#### What's actually next: C7e — expand mirror (sibling of Oculus)

Andy's real ask behind the original C7c brief was **bidirectional offset**: tighten OR loosen the detected polygon by one detent. C7d covers "tighten." The mirror is missing:

- **C7e — `loosenOneStep`** mirror in `polygon-tool.mjs`: for each orthogonal edge, find next candidate **outward** from centroid; apply as one undo-captured batch. Exact mirror of `tightenOneStep`, ~10 LOC.
- **Toolbar button** right after the Oculus, using `bi-arrows-angle-expand` (the mirror "fullscreen / expand" glyph; verified present in bootstrap-icons 1.11.3). No keybind needed — adjacent toolbar buttons read as paired controls (contract / expand, like media-player rewind / fast-forward).
- **Why not Cmd+Z**: undo only reverses the most recent action. C7e covers the case where Auto-Detect placed the polygon slightly inside the real outline and the user wants to expand from current state without undoing prior tag / preset / scope assignments.

Estimate: ~10 minutes. Self-contained, no UI surface beyond the new toolbar button. Pickup point on this branch.

#### Remaining items after C7e

- **C6** non-orthogonal refinement (gables / 45°): still parked. Edge-drag + Alt-click insert-vertex covers known cases.
- **C8** elevation outermost + eave-crop: still parked. p5 already performs well without outermost-only tweak.
- **C7c popup**: retired (above).

#### Branch state reference

```
main                            cf28d11   PR #13 merged
└── Magic-Wand-Oculus  (active)
    ├── 21fb77d  C7d Oculus core (canvas glyph + keybind)
    ├── 0f6f207  Oculus → toolbar
    └── 6f134b3  Icon fix (← tip)
```

### Status as of 2026-04-23 (session 3 — C7a+b + Alt opt-out shipped; paused before C7c/d for BfCA demo)

**Successor agent: read this block first.** Andy is presenting this state to BfCA, so the branch is parked here intentionally. Resume with C7c (popup) or C7d (oculus) — see bottom of this block. §0 sub-sections below are historical detail.

- **Active branch**: `Magic-Wand-Polish-2`, tip **`5d6f8db`**. Three code commits since `main` at `85fa550` (PR #12):
  - `81d3358` — AT-1/2/3 auto-tag (session 2 PM)
  - `bafaaa7` — C7a + C7b edge-scrub (per-edge drag + snap to wall-candidate detents)
  - `5d6f8db` — C7 Alt-click opt-out (Option/Alt bypasses edge-drag → legacy insert-vertex)
- **Dev server**: `npm run serve` on port 8000 (no-cache).

#### C7a + C7b — shipped at `bafaaa7`

**What works now.** On an Auto-Detected polygon:

- Hover a vertical orthogonal edge → cursor is `ew-resize` (↔). Drag it → both endpoints of that edge slide in x together; release snaps to the nearest `wallVertPositions` detent.
- Hover a horizontal orthogonal edge → cursor is `ns-resize` (↕). Same behavior on y.
- Hover a vertex → `move` cursor, classic vertex drag still works.
- Hover anywhere the edge-drag affordance doesn't apply (hand-drawn polygon, non-orthogonal edge, or Alt held) → `cell` cursor → click inserts a vertex.
- Snap is **unconditional** — the edge always settles on the nearest detent when you release. Matches Andy's "scrub through candidates" language. Between-detent placement is explicitly an insert-vertex operation.

**Implementation landmarks:**

- `shrinkWrapBuilding` in [`js/shrink-wrap.mjs`](../../js/shrink-wrap.mjs) now returns `wallVertPositions` (x-coords) + `wallHorizPositions` (y-coords), clustered within 5pt. Clustering collapses partner-stroke duplicates (inner + outer face of the same wall) but preserves distinct walls ≥10pt apart.
- [`js/polygon-tool.mjs`](../../js/polygon-tool.mjs) polygon record gains `_shrinkCandidates: {vert, horiz}`. New API: `edgeOrientation`, `setShrinkCandidates`, `getShrinkCandidates`, `startEdgeDrag / moveEdgeDrag / endEdgeDrag`, `isEdgeDragging`. Undo captures edge drags.
- [`js/app.mjs`](../../js/app.mjs) `_placeDetectedOutline` threads the arrays onto the polygon via `setShrinkCandidates`. `_handleOverlayClick` picks edge-drag vs insert-vertex based on orientation × candidates × `altKey`. `_handleOverlayMouseMove` mirrors the decision in the hover cursor.
- Also fixed a latent bug in `loadPolygons` where `scope` wasn't round-tripping through save/load (garage polygons came back as "building").

**Verified via Playwright on docs/sample.pdf:**

| Sheet | Candidates attached | Edge-drag behavior |
|---|---|---|
| p9 FOUNDATION PLAN | 15V / 34H detents | Left edge x=120.5 drag to 135 → snap to 141.2; top edge y=19.5 drag to 55 → snap to 65.4; undo returns to origin |
| p5 EAST ELEVATION | 21V / 48H detents | Polygon placed with `wall_exterior` + `wood_2x6` preset, candidates attached |
| hand-drawn polygon | null (graceful) | Edge-drag API no-ops gracefully; click router correctly falls through to insert-vertex |

Zero console errors across the session.

#### Alt-click opt-out — shipped at `5d6f8db`

Edge-drag with unconditional snap left no path to insert a vertex on an orthogonal edge of a detected polygon — Andy hit this on a floor plan where the wall has a small jog (garage-door recess) that needed a new vertex, not a whole-edge nudge.

Fix: holding Option/Alt during edge-click bypasses the edge-drag branch and falls through to `insertVertex` + vertex-drag. Hover cursor mirrors the modifier — `cell` when Alt is held over an otherwise edge-drag-capable edge, so the mode is visible before clicking.

Stopgap until **C7c** surfaces both actions via a popup. Documenting as shipped because the modifier is usable in the interim; revisit when the popup lands.

#### C7c + C7d — parked for next session

Remaining C7 surface (not blocking the BfCA demo):

- **C7c — ArchiCad-style popup** (~1–1.5 hr). On edge-click → "Drag edge" (default) + "Insert vertex". On vertex-click → "Drag point" (default) + "Delete vertex". Replaces the Alt-modifier with something discoverable; also closes the one real functional gap (no way to *delete* a vertex today — user has to drag-merge onto a neighbor).
- **C7d — Oculus "tighten one step inward" button** (~30 min). Single control that snaps all 4 edges to the next inner detent simultaneously. Scope: button, not slider (Andy's default). Positioned near the polygon centroid label. Self-contained, no existing UI to modify.

C6 (non-orthogonal refinement) and C8 (elevation outermost + eave-crop) remain on hold/deferred — edge-scrub + insert-vertex covers the common cases; revisit if real failures surface.

#### Post-session branch state reference

```
main                                   85fa550   PR #12 merged
└── Magic-Wand-Polish-2  (active)
    ├── a0c81b4  MAGIC.md AT prereq notes
    ├── 81d3358  AT-1/2/3 auto-tag
    ├── f491e5a  MAGIC.md session-2 PM handoff
    ├── bafaaa7  C7a+b edge-scrub
    └── 5d6f8db  C7 Alt-click opt-out  (← tip)
```

### Status as of 2026-04-23 (session 2 PM EOD — AT-1/2/3 shipped; paused before C7)

**Historical:** kept for context on AT-1/2/3 design + verification. Superseded by the session-3 block above for current branch state.

- **Active branch**: `Magic-Wand-Polish-2`, tip **`81d3358`**. Two commits since `main` at `85fa550` (merged PR #12):
  - `a0c81b4` — MAGIC.md: AT-1/2/3 prerequisites documented
  - `81d3358` — AT-1/2/3 shipped (auto-tag on successful Auto-Detect)
- **`main`** is at `85fa550` — PR #12 merged. `origin/main` mirrored.
- **Dev server** is expected to be running on port 8000 (Andy asked to leave it up for the session). If not: `npm run serve` in the repo root.

#### AT-1 / AT-2 / AT-3 — shipped 2026-04-23 PM at `81d3358`

One cohesive commit to [`js/app.mjs`](../../js/app.mjs). Behavior changes to `_placeDetectedOutline()`:

- **AT-1**: After polygon placement, `setTool("measure")` switches the active tool from navigate → polygon-edit mode so the user lands in the right context to refine.
- **AT-2**: New `_autoTagFromPage(pageNum, textItems)` helper maps classification + title + page-text to `{component, scope, preset}`:
  - `plan` + foundation title → `slab_foundation`
  - `plan` + roof title → `roof_plan`
  - `plan` + main/upper/lower/basement/ground/floor title → `slab_above_grade`
  - `elevation` → `wall_exterior` + AT-3 preset
  - `/\bgarage\b/i` in title OR anywhere in page-text → `scope = "garage"`
- **AT-3**: `wall_exterior` polygons get `assembly_preset = "wood_2x6"` by default.
- Status bar now appends the applied tag: `"Outline: 108.2 m², 4 vertices. tagged wall_exterior · wood_2x6."`

**Signature change**: `_placeDetectedOutline(candidate, idx, total, textItems)` — the `textItems` arg is threaded through from `autoDetect()`'s `Promise.all` results. Two call sites (shrink-wrap success path + closed-polygon fallback) both pass it.

**Verified via Playwright** on both fixtures. All classifications below work as expected unless noted:

| Sheet | Classification | Component | Scope | Preset |
|---|---|---|---|---|
| Calgary p9 FOUNDATION | plan | slab_foundation | building | — |
| Calgary p10 MAIN FLOOR | plan | slab_above_grade | building | — |
| Calgary p12 ROOF | plan | roof_plan | building | — |
| Calgary p5 EAST ELEV | elevation | wall_exterior | building | wood_2x6 |
| Calgary p25 garage elev | elevation | wall_exterior | **building** ← LIMITATION | wood_2x6 |
| Calgary p26 garage plan+section | section | — (C4 gate blocks) | — | — |
| ArchiCad p4 A2.43 | plan | slab_foundation | building | — |
| ArchiCad p5 A2.44 CD Main | plan | **— (title noise)** | building | — |
| ArchiCad p6 A2.45 | plan | slab_above_grade | building | — |
| ArchiCad p8 Elevation | elevation | wall_exterior | building | wood_2x6 |

#### Known limitations (not bugs — design)

1. **Calgary p25 garage-elevation sheet.** Blank title block + zero "garage" text anywhere on the page. Auto-tag outputs `wall_exterior` but scope stays `building`. User manually sets scope=garage via Summary Table scope dropdown. Confirmed by Andy 2026-04-23 PM — no realistic text signal to detect this.
2. **ArchiCad A2.44 CD Main Level** has noisy title text (regex captures "Site Ad" from unrelated title-block labels). Component stays null — user picks from dropdown. Correct behavior; better than guessing wrong.
3. **Attached-garage PDFs** where the main-floor plan has a "GARAGE" room label would trigger scope=garage via page-text scan. Acceptable false-positive: user overrides via Summary Table. pdfjs v4's per-glyph fragmentation coincidentally masks this on ArchiCad so the false-positive isn't observed today — but a word-level-text-emitting attached-garage PDF would see it.

#### C7 planning snapshot (historical — C7a+b shipped in session 3; see top block)

C7 was redesigned per Andy 2026-04-22 away from the original "inner/middle/outer buttons" spec (§3e). Replaced with per-edge drag handles + ArchiCad-style popup + oculus button, sliced into C7a / C7b / C7c / C7d. C7a+b shipped in session 3 with the following decisions locked in:

- **Snap cluster radius** — cluster within 5pt.
- **Oculus shape** — button (discrete one-step).
- **Handle glyph** — OS-native resize cursors (`ew-resize` on vertical edges, `ns-resize` on horizontal) per Andy 2026-04-23 refinement; skips drawn handle-glyphs in favor of cursor affordance.

#### Post-merge branch state reference

```
main                                   85fa550   PR #12 merged
└── Magic-Wand-Polish-2  (active)
    ├── a0c81b4  MAGIC.md AT prereq notes
    └── 81d3358  AT-1/2/3 auto-tag (← tip)
```

### Status as of 2026-04-23 (session 2 PM — PR #12 merged; on Magic-Wand-Polish-2)

- **[PR #12 merged](https://github.com/arossti/OpenBuilding/pull/12)** as commit `85fa550` on `main`. 21 commits from `3360f42` ancestor. Branch `Magic-Wand-Polish` deleted on both remotes + locally.
- **Active branch**: `Magic-Wand-Polish-2`, off `main` at `85fa550`. No commits yet — next code lands from AT-1/2/3 onward (auto-tag prerequisites for C7).

#### Auto-tag prerequisites (Andy 2026-04-23 PM) — AT-1 / AT-2 / AT-3

Auto-Detect currently places a polygon but leaves it untagged — user has to manually set component-tag, assembly-preset, and scope before the BEAMweb bridge can use it. **Before C7's edge-scrub refinement lands**, auto-populate these from what the classifier already knows so the user gets a polygon that's "ready to import" on first click. Keeps the loop between Auto-Detect and BEAMweb bridge tight; C7 becomes optional refinement polish, not mandatory prep.

**AT-1 — Tool-mode switch on successful detect.**
After `autoDetect()` places the polygon, switch the active tool from "navigate" to polygon-edit mode so the user lands in the right context to refine (once C7 drag handles ship) or to click-adjust vertices today. Avoids the "I pressed D, something happened, now what?" disorientation. One `setTool("measure")` or similar call at the tail of `_placeDetectedOutline()`.

**AT-2 — Auto-tag from sheet classification + title keywords.**
`classifySheet()` + the title text already determine what the polygon represents on the current page. Wire the mapping in [`js/app.mjs`](../../js/app.mjs) after `_placeDetectedOutline()` places the polygon:

| Sheet classification | Title keyword match | Component tag | Scope |
|---|---|---|---|
| `plan` | `/\bfoundation\b/i` | `slab_foundation` | building (default) |
| `plan` | `/\broof\b/i` | `roof_plan` | building |
| `plan` | `/\bmain\|upper\|lower\|basement\b/i` | `slab_above_grade` | building |
| `plan` | `/\bgarage\b/i` | `slab_above_grade` | **garage** |
| `elevation` | (any) | `wall_exterior` | building (default) |
| `elevation` | `/\bgarage\b/i` | `wall_exterior` | **garage** |

Garage detection extends both the plan + elevation paths — the scope flag (`building` | `garage`) differentiates, not a separate tag. Matches the Q23 per-polygon scope field shipped in PR #11 (`944c720`).

If no keyword matches (e.g. generic "floor plan" with no qualifier), leave the tag unset and surface the usual dropdown for manual tagging. Don't guess with low confidence.

**AT-3 — Default assembly preset = Wood 2×6 for exterior-wall polygons.**
On elevation sheets where `wall_exterior` fires, set `assembly_preset: "wood_2x6"` by default. Matches the BfCA target user (single-family wood-framed new construction); user can swap via the existing `#assembly-preset` dropdown (values: wood_2x4, wood_2x6, wood_2x8, wood_2x10, steel_stud, icf, concrete_block, other). Plan-view tags get no preset by default — presets are a wall-assembly concept, not a slab/roof concept.

**Why do this before C7.** Once AT-1/2/3 are in, a user's workflow is: (a) load PDF, (b) Auto-Calibrate on a plan sheet, (c) Auto-Detect → polygon appears tagged + scoped + presetted, ready for BEAMweb bridge import. That's the "something close they can adjust" line Andy drew 2026-04-22 — we're completing it before adding more UI surface. C7's edge-scrub then refines the polygon's SHAPE, but the polygon's SEMANTICS are already correct by default.

**Commit plan for AT:**

| Commit | Scope |
|---|---|
| AT-1 | Tool-mode switch post-detect (1-line fix + Playwright verify) |
| AT-2 | Classification → tag + scope mapping in autoDetect; extend sheet-classifier garage-title detection if needed |
| AT-3 | Wood-2×6 default for elevation-derived polygons; verify Summary Table inline Tag + Preset selects reflect the auto-set values |

Stitch all three into one cohesive commit if the diff stays small; split if any of them surfaces ambiguity.

### Status as of 2026-04-23 (session 2 AM — PR #12 opened; cleanup pass)

- **[PR #12](https://github.com/arossti/OpenBuilding/pull/12)** — `PDF-Parser: Auto-Calibrate + shrink-wrap Auto-Detect (MAGIC C1-C5)` — branch `Magic-Wand-Polish` → `main`. Tip `e0b5ae9`. 19 commits since `3360f42`.
- **Session-2 AM commits** (on top of session-1 EOD at `6257323`):
  - `62a4659` — Regression fix: `sheet-classifier._spatialJoin` via `_finalizeRow` for per-glyph text. First ArchiCad autoCalibrate/autoDetect hard-fail caught by Andy EOD session 1.
  - `b456674` — Regression fix: spatial-join ±2pt dead zone. Calgary bogus-width overlap (-14pt) + ArchiCad sub-pixel kerning overlap (-0.02pt) share sign but are distinct signals; single "gap < 0" rule conflated them.
  - `5621a85` — Classifier fix: sheetId extraction for per-glyph PDFs + ANSI A-series prefix mapping. ArchiCad A2.44 "CD Main Level" (no "plan" keyword in title) was misclassifying as "other" via two compounding bugs: (1) per-glyph text breaks whole-string sheetId regex; (2) prefix stripping of "A2.44" yielded "A" not "A2". Fix adds row-scan fallback (pick largest-fontSize sheetId candidate, beating the callout references scattered across the drawing) + rewrites prefix extraction via `^([A-Z]+)(\d*)`.
  - `fab1974` — Pre-merge cleanup: `npm run lint` + `npm run format` pass. Added `indexedDB` + `crypto` to eslint browser globals (3 errors → 0). Prettier auto-formatted 12 files (whitespace / multi-line-expression layout only, no behavior changes). Test state: dim-extract + layer-peel fixtures ALL PASS; Playwright p9 Calgary + ArchiCad metric smoke clean.
  - `e0b5ae9` — Matrix: removed stray `</body>` tag at line 508 that was closing the body BEFORE the 3,850-line script block. Pre-existing structural bug that prettier's HTML parser rejected (browsers silently tolerated). 2-line deletion, zero behavior change. Full prettier reformat of matrix.html produces an 11k-line diff — deferred to a dedicated commit post-merge.
- **Verification sweep (ArchiCad metric + Calgary imperial) after all fixes:**
  - Calgary p9 FOUNDATION PLAN: PLAN, Auto-Cal 19 callouts (1:64, 100% agreement), Auto-Detect 151.6 m²
  - ArchiCad p4 A2.43: PLAN, Auto-Cal 35 callouts (1:48), Auto-Detect 458.3 m²
  - ArchiCad p5 A2.44 CD Main Level: PLAN (was "other" — fixed in `5621a85`), Auto-Cal 53 callouts (1:50), Auto-Detect 612.8 m²
  - ArchiCad p6 A2.45 Main Floor Plan: PLAN, Auto-Cal 21 callouts (1:50), Auto-Detect 613.6 m²
  - Site / section / other sheets correctly bail with the C4 scope-gate status message.
- **Pick up post-merge** with C7 edge-scrub UI. Wall-candidate positions are computed by `shrinkWrapBuilding` in [`js/shrink-wrap.mjs`](../../js/shrink-wrap.mjs); need to: (a) expose them on the returned polygon record, (b) add per-edge drag handles that snap through them, (c) add an oculus "tighten-all" control. Andy's ArchiCad popup screenshots (2026-04-23 morning chat) set the UX template — distinguishing edge-click (drag edge / insert vertex) from vertex-click (drag point / delete). Existing polygon-edit paths in [`js/polygon-tool.mjs`](../../js/polygon-tool.mjs) cover most of the plumbing.

### Status as of 2026-04-23 (session 1 EOD — C1–C5 shipped; C7 redesigned)

- **Active branch**: `Magic-Wand-Polish`. Nine commits since `main` at `3360f42`:
  - `9ff2d02`  — workplan (this doc)
  - `77e713f`  — C1 `npm run serve` no-cache
  - `088d6ad`  — C2a fixture builder + imperial + metric fixtures
  - `2ab1a69`  — C2b dim-extract primitive + `npm run test:dim-extract`
  - `115da64`  — `js/geometry-walk.mjs` shared module (pdfjs 4.x/5.x agnostic)
  - `8dc534d`  — C3 Auto-Calibrate button + scale cross-check
  - `5bd02b4`  — C3-fix `consolidateTextItems` (pdfjs v4 per-glyph text)
  - `d323e1f`  — C4 layer-peel classifier + sheet-scope filter + `npm run test:layer-peel`
  - `d9ed664`  — C5 orthogonal shrink-wrap wired into Auto-Detect
- **Shipped tasks:** C1 dev-loop, C2 primitive + tests, C3 auto-calibrate + cross-check, C4 layer-peel + scope gate, C5 shrink-wrap MVP.
- **Playwright-verified** on `docs/sample.pdf` (imperial Calgary DP/BP) and `docs/pdf-samples/sample-metric.pdf` (ArchiCad metric):
  - Auto-Calibrate confirms 1:64 scale on p9 foundation plan (21 dim callouts, 100% agreement vs declared).
  - Auto-Calibrate confirms 1:48 on ArchiCad p4 (35 callouts, 100% agreement).
  - Auto-Calibrate confirms 1:50 on ArchiCad p6 (53 callouts, 100% agreement).
  - Auto-Detect produces a 4-vertex polygon on plan + elevation sheets; bails cleanly on site / section / other.
- **Real-world feedback (Andy 2026-04-22 EOD, on docs/sample.pdf p5, p10, p11):** "Good start, we often get at least one line correct." Polygon consistently contains the building but is ~20–40% loose on average. East Elevation (p5) reads cleanest — close fit. Floor plans (p10, p11) are looser: porches get wrapped in, and dim-extension strips still bleed into the wall-candidate list despite the 5-95 percentile trim.

#### Andy's design pivot — interactive edge scrub (C7 redesign)

Rather than keep tuning auto-detection thresholds toward a perfect polygon, offer **OSX-style `<|>` drag handles on each polygon edge** that scrub through the wall-candidate positions C5's `shrinkWrapBuilding()` already computes. Candidates exist in the `wallVert` / `wallHoriz` arrays; the UI is the new work. Two modes sketched:

- **Per-edge handles** — drag one edge inward/outward; snaps to the next wall-candidate position in that direction. Individual edges tuned independently.
- **Oculus mode** — one control that closes all four edges inward simultaneously (iris diaphragm metaphor) for users who want to pull tight uniformly.

This collapses the earlier C7 spec (inner/middle/outer buttons — see §3e below) into a more flexible direct-manipulation UX, and sidesteps the need for **C6 non-orthogonal refinement** until a concrete failure case surfaces that edge-scrub can't handle (e.g. gables). Both C6 and the button-based C7 are on hold.

**Pick up 2026-04-23 AM** with edge-scrub UI design + implementation. Keep the current shrink-wrap output as the initial polygon; drag handles refine. Existing polygon-edit paths in `js/polygon-tool.mjs` likely cover most of the plumbing.

#### Lessons for the successor agent (2026-04-22)

The landmines hit this session and the patterns that worked — read before touching C7.

**pdfjs version handling is the #1 trap.** The browser vendors `lib/pdf.min.mjs` @ **4.9.155**; npm `pdfjs-dist` @ **5.6.205** is used by node scripts. Two observable differences:

1. **`constructPath` encoding.** v4: `args[0]=subOps array`, `args[1]=flat coords`. v5: `args[0]=trailing paint op`, `args[1]=[coord buffer with inline DrawOPS codes]`. Handled in [`js/geometry-walk.mjs`](../../js/geometry-walk.mjs) with runtime `Array.isArray(args[0])` dispatch. Don't break this — both sides depend on it.
2. **Text-item granularity.** v4 emits **per-character** text items on many CAD PDFs (ArchiCad with CID fonts is the canonical offender — 3939 items on p4 vs 316 on v5). v5 coalesces into words. **Every textItems consumer needs spatial-join consolidation.** Patched twice this session: `5bd02b4` added `consolidateTextItems` to `dim-extract`, `62a4659` swapped `_finalizeRow`'s `" ".join()` for `_spatialJoin()` in `sheet-classifier`. **Any future textItems consumer will hit this.** Fix-forward candidate: factor consolidation into `pdf-loader.getTextContent()` so it's free for all downstream code.

**Test fixtures are v5-based and hide v4-specific bugs.** `schema/scripts/build-dim-fixture.mjs` runs on npm pdfjs (v5), produces word-level text. `npm run test:dim-extract` and `npm run test:layer-peel` passed all green while the browser was hard-failing on ArchiCad. **Playwright MCP against real PDFs is the only safety net for the v4 fragmentation class of bugs.** Smoke-test BOTH `docs/sample.pdf` AND `docs/pdf-samples/sample-metric.pdf` after any textItems-touching change.

**Shrink-wrap tuning history** (so C7 doesn't re-fight ghosts):
- Loose thresholds (30pt min / 3-35pt offset / 15pt overlap / min-max bbox) → bboxes 60–90% of page. Too loose.
- Chain-rejection via component BFS on parallel-partner graph → **catastrophically aggressive** on p9 (bbox collapsed to 2.5%). Legitimate walls connect through shared overlap with dim-strip parallels; rejecting chains kills walls too.
- Winner: **50pt min / 3-25pt offset / 40pt overlap + 5-95 percentile trim of wall positions**, clipped to drawingAreaBbox. Still 20–40% loose on floor plans (porches + dim-extension strips bleed in). Edge-scrub (C7) is the design answer — stop tuning thresholds, let the user drag.

**Layer-peel kept deliberately minimal.** Original spec had 5 classes (pageBorder / titleblock / dimensionGroup / textBlock / drawing). The titleblock-corner detection was too fragile — dim callouts extending into the TR quadrant confounded the corner-cluster signal on p4. Shipped **2 classes (pageBorder / drawing)** via position-based classification (not topology). ArchiCad's 3D-flatten exports connect everything into one mega-component, so topology-first classification is a trap. **Position-first cuts cleanly.**

**CAD conventions that informed the tuning** (so future tweaks have the mental model):
- Walls 0.3–0.5 m thick, drawn as 2 parallel strokes (per Andy 2026-04-22).
- Dim-extension strips are 3+ parallel strokes spaced ~18–25 pt on p9. Look like walls to naive filters.
- ArchiCad 3D-flatten: sheet border + titleblock + drawing are one connected graph.
- Title blocks vary by office convention — TR (ArchiCad default), but Calgary DP/BP sample has title text in TL. Don't hardcode corner.
- Section sheets: **ruler-only**, no fill capture (F2F / F2C heights). Wand disabled per C4 scope gate.
- Plan sheets: **inner face default** (BEAM takeoff convention). Elevation sheets: **outermost default**.

**Verification discipline that paid off.** Every commit passed at minimum `npm run test:dim-extract` + `npm run test:layer-peel` + a Playwright smoke on one real PDF before push. The ArchiCad regression that landed after C4 was caught at commit time by a Playwright run against the metric sample — would have been invisible to fixture tests alone.

**Loose assertions beat over-tuned ones.** `test:layer-peel` asserts `drawingAreaBbox inside page`, `drawing segs ≥ 500`, not exact coordinates. Catches real breakage without locking in threshold values that change when rules tune. Extend this pattern for shrink-wrap-polygon assertions if/when they land.

**File-encoding gotchas when editing .mjs source:**
- `m²` in the source is literally `m²` (6 ASCII chars forming an escape sequence), not the Unicode glyph. Edit tool's `old_string` must match the escape form, not the rendered char.
- Box-drawing `─` in comment headers IS raw UTF-8 (3 bytes U+2500). So `/* ── ... */` literal char matches.
- Rule of thumb: `od -c <file>` or `grep` to verify byte-level content before crafting `old_string` with any non-ASCII character.

**Git / commit discipline locked in:**
- Two remotes, both pushed after every meaningful change: `openbuilding` (arossti/OpenBuilding — PRs land here), `origin` (bfca-labs/at — mirror).
- Never push to `main`, never force-push, never `--no-verify`.
- Commit messages via `git commit -F /tmp/msg.txt` — the heredoc-quoting gremlin bites on em-dashes and similar.
- Every commit: Playwright smoke + relevant fixture tests BEFORE push, per the "tests before commits" rule.

**When algo-perfection is hard, pivot to direct manipulation.** The C7 redesign (scrub handles + oculus replacing inner/middle/outer buttons) is the design pattern here. Shrink-wrap's `wallVert` / `wallHoriz` position arrays are already the candidate set — UI to let the user sweep through them is less work than more threshold tuning, and more predictable for the user.

### Status as of 2026-04-22 (session 1 — planning)

- **Branch**: `Magic-Wand-Polish`, off `main` at `3360f42` (post-PR-#11 handoff commit). No code yet — this doc is the plan; commits land from C1 onward.
- **Upstream bridge work is done** (PR #11 merged 2026-04-22). This branch returns to the PDF-Parser polish pass that the bridge work displaced in the prior session.
- **What this polish does:** replace the current bi-magic detector (closed-polygon only, which fails on most real CAD output) with a two-track improvement — (1) calibration from detected dimension strings, with cross-check against the declared title-block scale; (2) shrink-wrap building-outline detection that handles CAD's "walls as parallel strokes, no filled interior" convention via a layer-peel + inner/middle/outer snap model borrowed from ArchiCAD's Zone tool.

### What the current wand does

- [`js/vector-snap.mjs`](../../js/vector-snap.mjs) extracts geometry, sorts closed paths by area via `getClosedPathsByArea`, picks the largest non-page-border one in `detectOutline`.
- Fails on CAD plans where walls are drawn as two parallel strokes with no closure — nothing registers as a "closed polygon," so nothing gets picked.

### What this workstream builds

1. Dev-loop upgrade: `npm run serve` → no-cache Python subclass (one-commit opener).
2. Dimension-string extraction primitive + auto-calibration button + declared-vs-detected scale cross-check.
3. Top-down shrink-wrap building detection with layer peel, inner/middle/outer snap, orthogonal + non-orthogonal passes, elevation outermost with eave-crop.

### Iteration loop

- **Primary:** [`schema/scripts/debug-pdf-extract.mjs`](../../schema/scripts/debug-pdf-extract.mjs) CLI harness against [`docs/sample.pdf`](../sample.pdf) (Calgary DP/BP, p9 FOUNDATION PLAN is the canonical test sheet, p5 EAST ELEVATION is the canonical elevation).
- **UI-facing:** Playwright MCP (tab `pdf-parser-tab`) against the no-cache server on port 8000.
- **CLI fixture tests** under `test/fixtures/` for pure primitives (dim-extract, layer-peel classifier).

---

## 1. Problem

The bi-magic auto-detector only picks up closed polygons. Real CAD drawings:

- Draw walls as two parallel strokes — no filled interior, nothing "closed."
- Emit open quads on wall ends where the draftsperson didn't close the corner.
- Scatter the page with text, dimension callouts, sheet borders, title blocks, detail boxes — all closed polygons but not the target.

Additionally, the current calibration flow requires the user to click two points on a known dimension string. Users have the scale printed on the sheet already (e.g. `3/16"=1'-0"` on sample.pdf plans — detected by `sheet-classifier.detectScale`), but that scale is **theoretical** — if the user saved a 22×34 ANSI D sheet as 11×17 for cheap printing, the declared scale is no longer correct. Calibration must cross-check detected dims against the declared scale and prefer the detected value when they diverge.

---

## 2. Strategy — top-down shrink-wrap

The prior handoff framed this as bottom-up segment clustering + flood-fill. Andy's 2026-04-22 direction is top-down:

1. **All sheets are rectangular.** Plans/elevations are inset from sheet edges by some margin.
2. **Most buildings are orthogonal.** 45° walls and gables are the special case, handled in a second pass.
3. **Imagine a rectangle sweeping inward from the page boundary.** It encounters layers in this order:
   a. Sheet border, title-block edges — reject.
   b. Dimension lines, text annotations, notes — reject.
   c. Closed polygons that are text callouts or detail boxes — reject.
   d. The building outline — accept. Tell: bordered by strokes or hatch fill, no text inside.
4. **Offer the user three snap modes** — inner / middle / outer — matching ArchiCAD's Zone tool. CAD walls are typically two parallel strokes; the three snaps correspond to interior face / centerline / exterior face.
5. **Inner is the default on plans** (matches BEAM's interior-dimension takeoff convention). Outer is the default on elevations (matches exterior wall area).

### Scope limits

- Wand runs only on sheets classified as `plan` or `elevation` by [`sheet-classifier.mjs`](../../js/sheet-classifier.mjs). Sections get ruler-tool only (no fill capture — sections are used to measure F2F / F2C heights). Sites, details, title sheets: wand disabled.
- Multi-tag polygons and cross-feeds stay out of scope; this is pure geometry detection.

---

## 3. Tasks

### Task 1 — `npm run serve` no-cache upgrade  [C1]

**What.** New `schema/scripts/nocache-serve.py` — Python `http.server` subclass that sends `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` on every response. `package.json` `"serve"` invokes it on port 8000.

**Why.** The default `python3 -m http.server` caches `.mjs` aggressively during rapid iteration. Playwright / browser-driven testing reads stale code across reloads. Prior session used a `/tmp/` version; commit into the repo so the fix is durable and any future agent gets it automatically.

**Verify.** `curl -I http://localhost:8000/pdfparser.html` shows `Cache-Control: no-store, ...`.

**Out of scope.** Anything else.

---

### Task 2 — Dim-string + auto-cal + scale cross-check  [C2–C3]

Three things shipped across two commits (one primitive, one wiring).

#### 2a — Primitive `js/dim-extract.mjs`  [C2]

```
extractDimensions(textItems, segments) → [{text, valueMeters, segment, confidence}]
```

**Regex coverage v1:**
- Imperial feet-inches: `25'-6"`, `25'-6 1/2"`, `25' 6"`, `25'`, `6"`, `0'-6"`
- Metric: `3200mm`, `3.2m`; bare `3200` only when paired segment length matches detected scale within 5%
- Fractional inches parsed (`½`, `¼`, `⅛`, `¾` Unicode; also `1/2`, `1/4`, `3/8`, `3/4` ASCII)
- Mixed imperial-metric or rounded decimals in weird formats: skip v1, flag as future work

**Storage:** metres canonical (per BEAMweb §9 convention). Source text preserved for display.

**Pairing rule:** for each dim string, pick the nearest segment where
- segment is (nearly) perpendicular to the text's baseline rotation,
- text centroid lies within the segment bbox ± font-height in the segment-normal direction,
- segment length × plausible scale window ≈ parsed dim value (filters misattribution to random nearby segments).

**Confidence score:** higher when the dim string is bracketed by tick marks (dimension-line arrowheads), when multiple dim strings land on parallel segments with consistent scale factor, when the pairing passes all three rules above.

**Testing:** fixture JSON at `test/fixtures/dim-extract/p9-foundation.json` (produced by `npm run debug:pdf -- docs/sample.pdf --page 9 --what text --out ...`). Tiny CLI runner asserts a known count of extracted dims + known-good pairings on three canonical dimensions.

#### 2b — Auto-calibrate button  [C3]

Wire `extractDimensions` into [`scale-manager.mjs`](../../js/scale-manager.mjs). Add an "Auto-calibrate" toolbar button next to the existing 2-point calibrate. Click → run `extractDimensions` → pick the highest-confidence horizontal dim with the longest paired segment → compute `pdfUnitsPerMetre` → set it via the existing StateManager/scale pipeline. **No auto-run on page-load** (too surprising for MVP).

#### 2c — Scale cross-check  [C3]

When both `sheet-classifier.detectScale` (declared) and `extractDimensions` produce values, compare the implied `pdfUnitsPerMetre` from each dim pair against the declared scale.

- Agreement within 3% → "✓ scale confirmed (3/16\"=1'-0\")" badge near the scale display.
- Divergence >3% → warning banner: "Declared scale is 3/16\"=1'-0\" but the dimension at X measures Y in this PDF — the drawing may have been printed at a different size. [Use detected scale] [Keep declared]."

This is the core value of calibration — not the click-shortcut, but the truth-vs-theoretical check. Addresses the ANSI D → 11×17 rescale case explicitly.

---

### Task 3 — Shrink-wrap building detection  [C4–C8]

Five commits, each independently revertable.

#### 3a — Sheet scope filter + wand button gating  [C4]

A thin wrapper in the wand code path checks `classifySheet()` before enabling the wand. Enabled on `plan` and `elevation`. Disabled elsewhere with tooltip "Not a drawing sheet — use the ruler tool for F2F/F2C heights or the polygon tool for manual area."

#### 3b — Layer-peel classifier  [C4]

New module `js/shrink-wrap.mjs` exporting

```
classifyLayers(closedPaths, segments, textItems) → {
  pageBorder, titleblock, dimensionGroups, drawingExtent, buildingCandidates
}
```

**Classification rules** — derived empirically from p9/p10 in a recon step that precedes C4 (the `npm run debug:pdf --page 9 --what all` dump). Tentative rules before recon:

- `pageBorder`: >90% of page area, near page edges (existing filter in `getClosedPathsByArea`).
- `titleblock`: <20% of page area, touches one corner of the page, contains a high density of text items.
- `dimensionGroup`: small clusters of short perpendicular strokes (tick marks) + text with a dim-regex match.
- `drawingExtent`: medium-to-large rectangle containing geometry; may not exist on every sheet.
- `buildingCandidate`: central, no text items inside, bordered by stroked segments or has fill on its interior.

Exact thresholds codified after the recon step.

#### 3c — Orthogonal shrink-wrap  [C5]

Start with the bounding rectangle of all non-filtered geometry (drawingExtent if present, else page-minus-titleblock-minus-margin). Shrink each of the four edges inward until it first contacts a `buildingCandidate` stroke. Output: 4-vertex orthogonal bounding polygon of the building.

Wire into the existing wand button path so clicking the wand on a plan sheet produces this polygon instead of the largest-closed-polygon fallback.

#### 3d — Non-orthogonal refinement  [C6]

Walk the orthogonal polygon's edges. For each edge, sample along its length and cast perpendicular rays inward. If a ray hits a stroke before reaching the orthogonal edge, that corner has a cut (gable, 45° notch, bay window). Insert vertices at ray-hit points and re-shrink.

Convergence via Ramer-Douglas-Peucker style simplification to avoid jitter from stroke imprecision. Tolerance tunable; default ~5 mm in real-world units (post-calibration).

#### 3e — Inner/middle/outer snap  [C7]

Once the building polygon is detected, scan perpendicular to each edge for parallel strokes within **wall thickness 0.3–0.5 m** (per Andy 2026-04-22). If parallels found → three buttons active, **Inner default**. No parallels → single snap, buttons disabled with tooltip "Single-line wall — only one snap available."

Toolbar overlay on the polygon displaying current snap mode. Drag-polygon-edge for manual offset reuses existing [`polygon-tool.mjs`](../../js/polygon-tool.mjs) edit paths.

**State:** snap mode persisted per polygon as `snap_mode: "inner" | "middle" | "outer"` on the polygon record.

#### 3f — Elevation outermost + eave-crop  [C8]

Same layer-peel + shrink-wrap on elevation sheets, but always return the outermost contact (no inner/middle/outer — elevation walls are usually single hatched regions).

**Eave-crop stretch.** Detect a horizontal stroke near the top of the building polygon that spans ≥70% of the polygon width — likely the eave line. Offer "Crop at eave" button that clips the polygon at that horizontal, removing the roof from the wall area. User can toggle back to full height. Encodes the "below the roof wall area" concept Andy named.

---

## 4. Commit plan

| Commit | Scope | Status | SHA |
|---|---|---|---|
| C1 | `npm run serve` no-cache | ✅ shipped 2026-04-22 | `77e713f` |
| C2 | dim-extract primitive + fixture test | ✅ shipped 2026-04-22 | `088d6ad` + `2ab1a69` |
| — | `js/geometry-walk.mjs` pdfjs v4/v5 dispatch (supports C2+) | ✅ shipped 2026-04-22 | `115da64` |
| C3 | auto-calibrate button + scale cross-check | ✅ shipped 2026-04-22 | `8dc534d` + `5bd02b4` (v4 consolidation fix) |
| C4 | scope filter + layer-peel classifier | ✅ shipped 2026-04-22 | `d323e1f` |
| C5 | orthogonal shrink-wrap wired to wand | ✅ shipped 2026-04-22 | `d9ed664` |
| — | Regression: sheet-classifier spatial-join (per-glyph fix round 1) | ✅ shipped 2026-04-22 | `62a4659` |
| — | Regression: spatial-join ±2pt dead zone (Calgary + ArchiCad both) | ✅ shipped 2026-04-23 | `b456674` |
| — | Classifier: sheetId row-scan + ANSI A-series prefix mapping | ✅ shipped 2026-04-23 | `5621a85` |
| — | Pre-merge cleanup: eslint globals + prettier sweep | ✅ shipped 2026-04-23 | `fab1974` |
| — | Matrix: stray `</body>` tag fix (prettier parse error) | ✅ shipped 2026-04-23 | `e0b5ae9` |
| — | **PR #12 merged to `main`** | ✅ 2026-04-23 PM | `85fa550` |
| AT-1/2/3 | Auto-tag polygon: tool-mode switch + classification → tag/scope + wood_2x6 default | ✅ shipped 2026-04-23 PM | `81d3358` |
| C7a + C7b | Edge-scrub drag handles: expose wall-candidate arrays + per-edge drag + unconditional snap to detent; ew-resize / ns-resize cursor vocab | ✅ shipped 2026-04-23 | `bafaaa7` |
| — | Alt-click opt-out: Option/Alt bypasses edge-drag into legacy insert-vertex (now permanent UX, not a stopgap) | ✅ shipped 2026-04-23 | `5d6f8db` |
| — | **PR #13 merged to `main`** | ✅ 2026-04-23 | `cf28d11` |
| C7d | Oculus "tighten one step inward" — `tightenOneStep` API + "O" keybind + canvas glyph (later relocated) | ✅ shipped 2026-04-24 | `21fb77d` |
| — | Oculus → toolbar button (drop floating glyph; Andy feedback: glyph collided with vertex handles on small polygons) | ✅ shipped 2026-04-24 | `0f6f207` |
| — | Icon fix: `bi-aperture` → `bi-arrows-angle-contract` (former missing in bootstrap-icons 1.11.3) | ✅ shipped 2026-04-24 | `6f134b3` |
| C7c | ~~ArchiCad-style popup: edge-click + vertex-click action menus~~ | ❌ retired 2026-04-24 — drag-merge + Alt-click cover the gaps; no popup needed |
| C7e | Loosen-one-step mirror of Oculus: `loosenOneStep` API + sibling toolbar button (`bi-arrows-angle-expand`) for one-detent outward offset | 🔜 next session — ~10 min, self-contained |
| C6 | non-orthogonal refinement | 🅿️ on hold — edge-scrub + Alt-click insert-vertex covers known cases |
| C8 | elevation outermost + eave-crop | ⏳ deferred — p5 shrink-wrap already performs well |

Each commit: end-to-end assertion before push, per the "tests before commits" rule. Push to both remotes (`openbuilding`, `origin`) after every commit.

---

## 5. Resolved questions (as of 2026-04-22 — kickoff)

1. **Ordering vs the handoff's "smallest first":** ship the shared primitive (Task 2a) before the narrow auto-cal (Task 2b), because the primitive is the harder part. — **Agreed.**
2. **Auto-calibration trigger:** explicit button, not auto-run on page-load. — **Agreed (Q1 = button).**
3. **Units in dim-extract output:** metric canonical. — **Confirmed (Q2, matches BEAMweb §9).**
4. **Non-orthogonal refinement (C6):** build now, not deferred. — **Confirmed (Q3).**
5. **Wall-thickness range for parallel-stroke detection:** 0.3–0.5 m. — **Confirmed (Q4).**
6. **Workplan doc location:** new `docs/workplans/MAGIC.md` file, not appended to `PDF-BEAMweb-BRIDGE.md`. — **Confirmed (Q5).**
7. **Verification approach:** standard build/test/commit per commit; CLI harness for primitives, Playwright MCP for UI; iterate freely to repair/debug. — **Confirmed (Q6).**

## 6. Open / deferred

- **Multi-page batch calibration.** If one sheet's calibration suggests a global print-scaling mismatch, should it offer to re-calibrate the whole PDF? Out of scope for C3; add if a user hits it.
- **Symbol recognition** (doors, windows, stairs as CAD blocks) — explicitly out of scope, per handoff.
- **Polyline wall-run reconstruction** (stroked double-line wall → centerline polyline) — the shrink-wrap's parallel-stroke detection surfaces the data; rendering it as a separate polyline is a Phase 4b.5 item gated on BEAMweb assembly-tab consumers.
- **Mixed imperial-metric dim strings** in dim-extract — flagged in 2a as v2 work.
- **Scale disagreement three-way modal** — C3's disagreement path currently uses `window.confirm` for OK=detected / Cancel=declared. A dedicated panel with inline reference-dim preview would read better; add when a real ANSI D → 11×17 rescaled fixture surfaces.
- **Shrink-wrap threshold tuning** — the 5-95 percentile trim + 50 pt / 3-25 pt / 40 pt thresholds were tuned on p9 + p4. Edge-scrub (new C7) reduces the need for perfect auto-detection, but the underlying thresholds may still want tightening based on real-world feedback. Tune when the scrub UI surfaces specific failure modes.
- **Legacy closed-polygon detector retirement** — `VectorSnap.getClosedPathsByArea` still runs as a silent fallback when shrink-wrap returns null. Per Andy 2026-04-22 "decide if it has a place or we retire it." Retire when shrink-wrap has proven reliable across a wider PDF sample set.
- **v4-simulated fixture for dim-extract** — would regression-test the `consolidateTextItems` path landed in `5bd02b4`. Generate by post-processing the v5 fixture to shatter each text item into per-character fragments. Not blocking; Playwright + real ArchiCad PDF cover it today.

---

## 7. Iteration infrastructure (reference)

- **`npm run debug:pdf -- <pdf> --page N --what all --out /tmp/foo.json`** — harness CLI, dumps text items + operator list + classifier output. Primary iteration loop for text-side and geometry-side primitives.
- **`npm run serve`** (post-C1) — no-cache dev server on port 8000. Required for reliable Playwright runs.
- **Playwright MCP** at user scope, named tab `pdf-parser-tab`. Use for DOM-level verification.
- **Sample PDF:** [`docs/sample.pdf`](../sample.pdf), 26 pages, Calgary DP/BP. Canonical plan sheet: p9 (FOUNDATION PLAN, scale `3/16"=1'-0"`). Canonical elevation: p5 (EAST ELEVATION). Classifier output from 2026-04-22 recon confirms p9–p12 + p14–p16 are plans, p5–p8 + p25 elevations, p13 + p17 + p20 + p26 sections, p3 + p4 site, rest other.

---

## 8. Git workflow

Same as the BEAMweb / bridge workstreams:

- Commit + push to both remotes (`openbuilding`, `origin`) after every meaningful change.
- Never push to `main`, never force-push, never `--no-verify`.
- Commit messages via `git commit -F /tmp/msg.txt` (the heredoc-quoting gremlin bites otherwise).
- End of branch: PR on `arossti/OpenBuilding`, Andy merges, delete branch on both remotes.
