# PDF-Parser Magic-Wand Polish — workplan (MAGIC.md)

> Polish pass on the PDF-Parser magic-wand (auto-detect) path. Dimension-string calibration with declared-vs-detected scale cross-check, shrink-wrap building-outline detection that handles CAD's "walls as parallel strokes" convention, interactive edge-scrub refinement, and bidirectional Oculus offset. Branch: `Magic-Wand-Oculus` (successor to merged PR #12 + PR #13). Started 2026-04-22.

---

## 0. Current state (2026-04-24 EOD)

### Active branch

`Magic-Wand-Oculus`, tip **`38b2d37`**. Five commits since `main` at `cf28d11` (PR #13 merged):

- `21fb77d` — C7d Oculus core (`tightenOneStep` + "O" keybind + canvas glyph)
- `0f6f207` — Oculus relocated from floating canvas glyph to top toolbar button
- `6f134b3` — Icon fix: `bi-aperture` was blank in bootstrap-icons 1.11.3, swapped to `bi-arrows-angle-contract`
- `9f00e16` — MAGIC.md session-4 handoff
- `38b2d37` — C7e expand mirror: `loosenOneStep` + sibling toolbar button (`bi-arrows-angle-expand`)

### User-facing workflow (everything shipped)

1. **Auto-Calibrate (`A`)** on a plan or elevation sheet. Dim-extract scans `textItems` + segments for dimension callouts, cross-checks against declared title-block scale, confirms (✓) or warns (⚠) on divergence, applies detected scale.
2. **Auto-Detect (`D`)**. Layer-peel separates page-border chaff from drawing segments. Shrink-wrap filters orthogonal wall-pair parallels, takes 5–95 percentile bbox, clips to drawing area. Places a 4-vertex orthogonal polygon, auto-tags from sheet classification + title/page text (`slab_foundation` / `slab_above_grade` / `roof_plan` / `wall_exterior`), assigns scope (`building` | `garage`), and defaults exterior walls to `wood_2x6` assembly preset. Switches active tool to `measure` so refinement is one click away.
3. **Refine** via three mechanisms, all undo-captured:
   - **Per-edge drag** — hover a vertical orthogonal edge (`ew-resize` cursor) or horizontal (`ns-resize`), drag. On release the edge snaps to the nearest wall-candidate detent. For between-detent placement: Option/Alt-click the edge → inserts a vertex at the click point and drags it freely.
   - **Oculus contract / expand** (toolbar buttons + `O` shortcut for contract). Steps every orthogonal edge one detent inward (contract) or outward (expand) simultaneously. For the "polygon is uniformly off by one wall" case.
   - **Vertex drag** — grab any vertex, move it. Drop onto a neighbor to merge (effectively delete the vertex).
4. **Summary Table** carries tag / preset / scope forward to the BEAMweb bridge.

### Architecture landmarks

- [`js/shrink-wrap.mjs`](../../js/shrink-wrap.mjs) — `classifyLayers`, `shrinkWrapBuilding`. Returns `wallVertPositions` / `wallHorizPositions` (clustered within 5pt) alongside the polygon.
- [`js/dim-extract.mjs`](../../js/dim-extract.mjs) — `extractDimensions`. Regex coverage for imperial feet-inches + metric mm/m + unicode/ascii fractions. Pairs each dim to the nearest perpendicular segment, scores confidence.
- [`js/polygon-tool.mjs`](../../js/polygon-tool.mjs) — polygon record holds `_shrinkCandidates` when placed by Auto-Detect. Edge-drag API: `edgeOrientation`, `startEdgeDrag` / `moveEdgeDrag` / `endEdgeDrag`. Oculus: `_offsetOneStep(direction)` shared helper, `tightenOneStep` / `loosenOneStep` wrappers. `findDetectedPolyIdx` locates the page's auto-detected polygon.
- [`js/sheet-classifier.mjs`](../../js/sheet-classifier.mjs) — classifies each page as `plan` / `elevation` / `section` / `site` / `other`. Used by the scope gate and by AT auto-tag.
- [`js/app.mjs`](../../js/app.mjs) — `autoDetect` / `_placeDetectedOutline` / `_autoTagFromPage` wire it all together. `_offsetOculus(direction)` wraps tighten/loosen with status-bar feedback.
- [`pdfparser.html`](../../pdfparser.html) — toolbar buttons: Auto-Cal (`bi-stars`, `A`), Auto-Detect (`bi-magic`, `D`), Oculus contract (`bi-arrows-angle-contract`, `O`), Oculus expand (`bi-arrows-angle-expand`, no keybind).

### What remains

| Item | Why |
|---|---|
| **C6 — non-orthogonal refinement** (gables, 45° cuts) | 🅿️ on hold. Edge-drag + Alt-click insert-vertex covers known cases. Revisit if a real failure surfaces. |
| **C8 — elevation outermost + eave-crop** | ⏳ deferred. p5 shrink-wrap already performs well. Eave-crop is a roof-subtraction nicety; add when a user hits the need. |
| **v4-simulated dim-extract fixture** | ⏳ deferred. Would regression-test the per-glyph `consolidateTextItems` path. Playwright + real ArchiCad PDF cover it today. |
| **Legacy closed-polygon detector retirement** | ⏳ deferred. `VectorSnap.getClosedPathsByArea` still runs as silent fallback when shrink-wrap returns null. Retire when shrink-wrap proves reliable across a wider sample set. |
| **Multi-page batch calibration** | ⏳ deferred. Re-calibrate the whole PDF when one sheet suggests a global print-scaling mismatch. Add if a user hits it. |
| **Scale-disagreement three-way modal** | ⏳ deferred. C3 uses `window.confirm` today; a dedicated panel with inline reference-dim preview would read better. Add when a real ANSI D → 11×17 rescaled fixture surfaces. |
| **Shrink-wrap threshold tuning** | ⏳ deferred. Thresholds tuned on p9 + p4. Edge-scrub reduces the pressure for perfect auto-detection. Tune when a real-world failure surfaces. |
| **Polyline wall-run reconstruction** (stroked double-line → centerline polyline) | ⏳ deferred. Shrink-wrap surfaces the data; rendering it as a polyline is a Phase 4b.5 item gated on BEAMweb assembly-tab consumers. |
| **Mixed imperial-metric dim strings** | ⏳ deferred. Flagged as v2 in the dim-extract spec. |
| **Symbol recognition** (doors, windows, stairs as CAD blocks) | ❌ out of scope, per the original handoff. |

### Retired design ideas (so they don't re-surface)

- **Inner / middle / outer snap buttons** (original C7 spec). Superseded 2026-04-22 by edge-scrub + Oculus. Direct manipulation beat a three-state snap mode for the same underlying candidate positions.
- **ArchiCad-style popup (C7c)**. Retired 2026-04-24. The combination of drag-merge (implicit delete-vertex), Alt-click (insert-vertex), and Oculus contract/expand (bulk offset) already covers every gap the popup was meant to fill. No discoverability overhead needed.

---

## 1. Problem (why this workstream exists)

The previous auto-detector only picked up closed polygons. Real CAD drawings:

- Draw walls as two parallel strokes — no filled interior, nothing "closed."
- Emit open quads on wall ends where the draftsperson didn't close the corner.
- Scatter the page with text, dimension callouts, sheet borders, title blocks, detail boxes — all closed polygons but not the target.

The original calibration flow also required two clicks on a known dimension string. Users have the scale printed on the sheet (e.g. `3/16"=1'-0"`), but that scale is theoretical — if a 22×34 ANSI D sheet was printed at 11×17, the declared scale is stale. Calibration must cross-check.

## 2. Strategy — top-down shrink-wrap + interactive refinement

1. **All sheets are rectangular.** Plans / elevations are inset from sheet edges by some margin.
2. **Most buildings are orthogonal.** 45° walls and gables are the special case; handled (if ever) in a separate pass.
3. **A rectangle sweeps inward from the drawing bbox**, rejecting page-border chaff, dim callouts, text annotations, and closed polygons that are text callouts or detail boxes. It lands on the building outline (wall pairs).
4. **The detected polygon is the starting point, not the final answer.** The user refines via edge-drag, Alt-click-to-insert-vertex, and Oculus contract/expand — all snapping through the same wall-candidate positions shrink-wrap computed internally.
5. **Wand runs on `plan` and `elevation` sheets only.** Sections get the ruler tool (F2F/F2C heights). Sites, titles, details: wand disabled with an explanatory status message.

---

## 3. Commit history

| Commit | Scope | SHA |
|---|---|---|
| C1 | `npm run serve` no-cache | `77e713f` |
| C2 | dim-extract primitive + fixture test | `088d6ad` + `2ab1a69` |
| — | `js/geometry-walk.mjs` pdfjs v4/v5 dispatch | `115da64` |
| C3 | auto-calibrate button + scale cross-check | `8dc534d` + `5bd02b4` (v4 consolidation fix) |
| C4 | scope filter + layer-peel classifier | `d323e1f` |
| C5 | orthogonal shrink-wrap wired to wand | `d9ed664` |
| — | Regression: sheet-classifier spatial-join (per-glyph fix round 1) | `62a4659` |
| — | Regression: spatial-join ±2pt dead zone (Calgary + ArchiCad) | `b456674` |
| — | Classifier: sheetId row-scan + ANSI A-series prefix mapping | `5621a85` |
| — | Pre-merge cleanup: eslint globals + prettier sweep | `fab1974` |
| — | Matrix: stray `</body>` tag fix | `e0b5ae9` |
| — | **PR #12 merged to `main`** | `85fa550` |
| AT-1/2/3 | Auto-tag polygon: tool-mode switch + classification → tag/scope + wood_2x6 default | `81d3358` |
| C7a + C7b | Edge-scrub drag handles: expose wall-candidate arrays + per-edge drag + snap-to-detent | `bafaaa7` |
| — | Option/Alt-click opt-out: bypass edge-drag into insert-vertex | `5d6f8db` |
| — | **PR #13 merged to `main`** | `cf28d11` |
| C7d | Oculus contract: `tightenOneStep` + "O" keybind + canvas glyph | `21fb77d` |
| — | Oculus → toolbar button (drop floating glyph) | `0f6f207` |
| — | Icon fix: `bi-aperture` → `bi-arrows-angle-contract` | `6f134b3` |
| C7e | Oculus expand: `loosenOneStep` mirror + sibling toolbar button | `38b2d37` |

Every commit passes `npm run test:layer-peel` + `npm run test:dim-extract` + a Playwright smoke on at least one real PDF before push. Push to both remotes (`openbuilding`, `origin`).

---

## 4. Iteration infrastructure

- **`npm run debug:pdf -- <pdf> --page N --what all --out /tmp/foo.json`** — CLI harness. Dumps text items + operator list + classifier output. Primary loop for text-side and geometry-side primitives.
- **`npm run serve`** — no-cache dev server on port 8000. Required for reliable Playwright runs.
- **Playwright MCP** at user scope, named tab `pdf-parser-tab`. DOM-level verification.
- **Sample PDFs**:
  - [`docs/sample.pdf`](../sample.pdf) — 26 pages, Calgary DP/BP (imperial). Canonical plan: p9 (FOUNDATION PLAN, `3/16"=1'-0"`). Canonical elevation: p5 (EAST ELEVATION). Classifier output confirms p9–p12 + p14–p16 are plans, p5–p8 + p25 are elevations, p13 + p17 + p20 + p26 are sections, p3 + p4 are site, rest other.
  - [`docs/pdf-samples/sample-metric.pdf`](../pdf-samples/sample-metric.pdf) — ArchiCad metric. Canonical plan: p4 (A2.43, 1:48) and p6 (A2.45, 1:50). Catches pdfjs v4 per-glyph text fragmentation bugs that v5-based fixture tests miss.

## 5. Git workflow

- Commit + push to both remotes (`openbuilding` = arossti/OpenBuilding; `origin` = bfca-labs/at mirror) after every meaningful change.
- Never push to `main`, never force-push, never `--no-verify`.
- Commit messages via `git commit -F /tmp/msg.txt` (heredoc-quoting bites on em-dashes).
- End of branch: PR on `arossti/OpenBuilding`, Andy merges, delete branch on both remotes.

---

## 6. Lessons for the successor agent

Carry-over knowledge that's still load-bearing. Read before touching anything in the PDF-Parser path.

**pdfjs version handling is the #1 trap.** The browser vendors `lib/pdf.min.mjs` @ **4.9.155**; npm `pdfjs-dist` @ **5.6.205** is used by node scripts. Two observable differences:

1. **`constructPath` encoding.** v4: `args[0]=subOps array`, `args[1]=flat coords`. v5: `args[0]=trailing paint op`, `args[1]=[coord buffer with inline DrawOPS codes]`. Handled in [`js/geometry-walk.mjs`](../../js/geometry-walk.mjs) with runtime `Array.isArray(args[0])` dispatch.
2. **Text-item granularity.** v4 emits **per-character** text items on many CAD PDFs (ArchiCad with CID fonts is the canonical offender — 3939 items on p4 vs 316 on v5). v5 coalesces into words. **Every `textItems` consumer needs spatial-join consolidation.** Patched twice: `5bd02b4` added `consolidateTextItems` to `dim-extract`, `62a4659` swapped `_finalizeRow`'s `" ".join()` for `_spatialJoin()` in `sheet-classifier`. Any future `textItems` consumer will hit this. Fix-forward candidate: factor consolidation into `pdf-loader.getTextContent()` so it's free for all downstream code.

**Test fixtures are v5-based and hide v4-specific bugs.** `schema/scripts/build-dim-fixture.mjs` runs on npm pdfjs (v5), produces word-level text. `npm run test:dim-extract` and `npm run test:layer-peel` passed all green while the browser was hard-failing on ArchiCad. **Playwright MCP against real PDFs is the only safety net for the v4 fragmentation class of bugs.** Smoke-test BOTH `docs/sample.pdf` AND `docs/pdf-samples/sample-metric.pdf` after any `textItems`-touching change.

**Shrink-wrap tuning history** (so we don't re-fight ghosts):

- Loose thresholds (30pt min / 3-35pt offset / 15pt overlap / min-max bbox) → bboxes 60–90% of page. Too loose.
- Chain-rejection via component BFS on parallel-partner graph → catastrophically aggressive on p9 (bbox collapsed to 2.5%). Legitimate walls connect through shared overlap with dim-strip parallels; rejecting chains kills walls too.
- Winner: **50pt min / 3-25pt offset / 40pt overlap + 5-95 percentile trim of wall positions**, clipped to drawingAreaBbox. Still 20–40% loose on floor plans (porches + dim-extension strips bleed in). The edge-scrub + Oculus UI is the design answer — stop tuning thresholds, let the user refine.

**Layer-peel kept deliberately minimal.** Original spec had 5 classes (pageBorder / titleblock / dimensionGroup / textBlock / drawing). Titleblock-corner detection was too fragile — dim callouts extending into the TR quadrant confounded the corner-cluster signal on ArchiCad p4. Shipped **2 classes (pageBorder / drawing)** via position-based classification (not topology). ArchiCad's 3D-flatten exports connect everything into one mega-component, so topology-first classification is a trap. **Position-first cuts cleanly.**

**CAD conventions that informed tuning** (mental model for future tweaks):

- Walls 0.3–0.5 m thick, drawn as 2 parallel strokes.
- Dim-extension strips are 3+ parallel strokes spaced ~18–25 pt on p9. Look like walls to naive filters.
- ArchiCad 3D-flatten: sheet border + titleblock + drawing are one connected graph.
- Title blocks vary by office convention — TR (ArchiCad default), but Calgary DP/BP has title text in TL. Don't hardcode corner.
- Section sheets: ruler-only, no fill capture. Wand disabled per C4 scope gate.

**Verification discipline that paid off.** Every commit passes at minimum `npm run test:dim-extract` + `npm run test:layer-peel` + a Playwright smoke on one real PDF before push. The ArchiCad regression after C4 was caught at commit time by a Playwright run against the metric sample — invisible to fixture tests alone.

**Loose assertions beat over-tuned ones.** `test:layer-peel` asserts `drawingAreaBbox inside page`, `drawing segs ≥ 500`, not exact coordinates. Catches real breakage without locking in threshold values that change when rules tune. Extend this pattern for shrink-wrap-polygon assertions if they land.

**File-encoding gotchas when editing `.mjs` source:**

- `m²` in the source is literally `m²` (6 ASCII chars forming an escape sequence), not the Unicode glyph. Edit tool's `old_string` must match the escape form, not the rendered char.
- Box-drawing `─` in comment headers IS raw UTF-8 (3 bytes U+2500). So `/* ── ... */` literal char matches.
- Rule of thumb: `od -c <file>` or `grep` to verify byte-level content before crafting `old_string` with any non-ASCII character.

**Git / commit discipline locked in:**

- Two remotes, both pushed after every meaningful change.
- Never push to `main`, never force-push, never `--no-verify`.
- Commit messages via `git commit -F /tmp/msg.txt` — heredoc quoting bites on em-dashes.
- Every commit: fixture tests + Playwright smoke BEFORE push.

**When algo-perfection is hard, pivot to direct manipulation.** The C7 redesign (edge-scrub + Oculus replacing inner/middle/outer buttons) is the design pattern here. Shrink-wrap's `wallVertPositions` / `wallHorizPositions` arrays are already the candidate set — UI that lets the user sweep through them is less work than more threshold tuning, and more predictable for the user.
