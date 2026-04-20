# Cleanup Audit — pre-Phase-4b, pre-PR-to-main

> **Status:** forensic research, read-only. No code changed. Review + prioritise before I execute.
> **Opened:** 2026-04-20, post-session-6. Last cleanup pass: commit `7d602e7` (session 5).
> **Branch:** `beamweb-tabs-2`, tip `45cff79`.

---

## TL;DR

**The codebase is in better shape than expected.** Session 5's cleanup held; session 6 didn't introduce drift. StateManager centralisation is correct — the Vatican is intact. Most of the audit is **"nothing to fix"** confirmation.

**Three real action items surface, totaling ~2½ hours of work:**

1. **Georgia → Helvetica sans** (~10 min) — one token change, propagates everywhere, matches your explicit preference.
2. **Pre-Phase-4 helper extraction** (~20 min) — lift `esc()` + number formatters into shared modules *before* Phase 4 copies them 11×.
3. **CSS consolidation** (~120 min) — 5 concrete duplication hotspots across app sections, ~250 lines recoverable. Good moment to land before Phase 4b adds new surface area.

Everything else is either clean, intentionally stubbed, or flagged as out-of-scope gap. Full breakdown below.

---

## Good-news findings (no action needed)

### StateManager = the Vatican, intact

`js/shared/state-manager.mjs` is imported by **every** BEAMweb module that touches state (`beamweb.mjs`, `project-tab.mjs`, `footings-slabs-tab.mjs`, `auto-fill.mjs`, `file-handler.mjs`). No parallel state store, no app-local shims bypassing it.

**PDF-Parser's `project-store.mjs` is a separate concern by design** — it holds polygon geometry (vertices, sheet_id, closed flags), not BEAMweb PROJECT field values. The two-store model is what Phase 4b.2's bridge will connect: `project-store` polygon change → bridge aggregates → `StateManager.setValue()` for dimension values.

So: **one StateManager; PDF-Parser has its own shrine for geometry-specific state; the bridge is how they talk.** Already the architecture you described. Zero consolidation work needed.

### State-key provenance is already implicit

Sampled 30+ `setValue()` / `getValue()` calls. All keys are semantically namespaced by domain prefix already:
- `project_*` — PROJECT tab info
- `dim_*` / `param_*` — PROJECT dimensions + (future) parameters
- `fs_<code>_*` — F&S row-level state (`sel`, `qty`, `pct`), code-prefixed so hash collisions can't happen
- `garage_*` — garage dim scope

No collision risk, no ambiguity about what owns a key. The Phase 4b `dimension_sources` map will live as a parallel sibling to `fields` in the project JSON (per `PDF-BEAMweb-BRIDGE.md` §2.1), not via inline prefixing — preserves backwards compatibility with existing project files. **No migration needed.**

### StateManager API surface is healthy

18 exported methods. 15 are actively used. The three "unused" methods (`registerDependency`, `getDirtyFields`, `clearDirtyStatus`) are **dormant prep for Phase 3+ calculation cascades** — intentional stubs, not dead code. Method names are clear, no overlap, no confusion.

Adding `getDimensionSource()` / `setDimensionSource()` for Phase 4b.2 will slot in cleanly. No surgery required.

### Zero TODO / FIXME / XXX / HACK comments

Across `js/**`, `schema/**`, `docs/**` — none. All deferred work is captured in `BEAMweb.md` and `PDF-BEAMweb-BRIDGE.md` with explicit Q-numbers (Q19–Q26). Clean separation of "code concerns" from "design concerns."

### Zero docstring drift

Sampled 6 BEAMweb modules' top-15 lines. All accurate to current state. Session 5's `7d602e7` cleanup scrubbed stale "Phase 0 shell" / "MCE²" / "CSI" references; nothing has re-crept in since.

### No unused imports

Spot-checked 5 modules (`assembly-csv-parser`, `footings-slabs-tab`, `project-tab`, `auto-fill`, `jurisdictions`). Every import is consumed. Every export has at least one caller.

### "Phase 1 stub" / "placeholder" labels — all accurate

5 occurrences across `state-manager.mjs`, `file-handler.mjs`, `workbook-mapper.mjs`, `reference-data.mjs`, `footings-slabs-tab.mjs`. Every one describes a real in-flight item, not a stale label. Leave as-is.

---

## Action items (prioritised)

### 1. Georgia → Helvetica sans for headings + heavy text (~10 min)

**Your explicit ask: no serifs on bolded sections.** Currently `--font-head: "Georgia", "Times New Roman", serif` at [`bfcastyles.css:63`](../../bfcastyles.css#L63), applied via `font-family: var(--font-head)` in 14 contexts across Matrix + BEAMweb (tab labels, group names, section titles, part-splash headers, card titles).

**Fix:** one-line token change — `--font-head: "Helvetica Neue", Helvetica, Arial, sans-serif`. Propagates via the token everywhere. Zero inline `font-family: Georgia` usages to track down.

**Risk:** very low. Visual regression test across all 5 apps (landing, pdfparser, matrix, database, beamweb) takes ~5 min.

**Alternative you may want:** introduce a new token `--font-ui-heavy` if we want a distinct heavy-weight sans (e.g. `"Inter", "Helvetica Neue", sans-serif` with font-weight 700) for UI headings, separate from body text. Slightly more deliberate but adds a dependency. I'd start with the minimal swap.

### 2. Pre-Phase-4 helper extraction (~20 min)

Phase 4 will copy the F&S tab template 11 times. Before it does, lift three helpers into shared modules so they get consumed, not duplicated.

**Targets:**

| Helper | Currently lives in | Move to | Payoff |
|---|---|---|---|
| `esc()` HTML escape | `footings-slabs-tab.mjs:33` + `project-tab.mjs:293` (identical) | `js/beam/shared/html-utils.mjs` (new) | Used 20+ times per module; 11× duplication avoided |
| `fmtKg()`, `fmtQty()` number formatters | `footings-slabs-tab.mjs:40–49` | `js/beam/shared/formatters.mjs` (new) | Every Phase 4 tab will need these |
| `renderCollapsibleSection()` | `project-tab.mjs` (session 6 addition) | `js/beam/shared/ui-components.mjs` (new) | PDF-BEAMweb-BRIDGE.md §5 uses it for params section + source selector |

**Risk:** low — pure function extraction with no behaviour change. Run the app after to confirm F&S + PROJECT still render identically.

### 3. CSS consolidation (~120 min)

Current total: **5,028 lines** ([`bfcastyles.css`](../../bfcastyles.css); CLAUDE.md says ~4100, **doc is stale** — worth updating the claim). Target per CLAUDE.md: ~1,500 lines. We're ~3.4× the target.

**Size breakdown by app-section banner:**

| Section | Lines | Notes |
|---|---|---|
| §1 Foundation (reset + tokens + header) | 106 | Lean. |
| §4 Dark theme + baseline | 889 | Token declarations + layout skeleton (mostly unavoidable). |
| §5 PDF-Parser | 1,013 | Viewer, toolbar, polygon panel, scale UI, summary table. Domain-specific. |
| **§6 Matrix** | **1,885** | **Largest.** Card layout + actor lens + flow-view prep + status / phase strips. |
| §7 Database | 711 | Search, table, filters, collapsible rows. |
| §8 BEAMweb | 984 | Tab layout + assembly picker + PROJECT form + action bar. |
| §9 Landing | 177 | Lean. |
| §10 Deps | 252 | Dep manifest table. |

**Five consolidation hotspots** (estimated line savings in parens):

1. **Status / phase bars** (~60 lines) — `.c-none`, `.c-vol`, `.c-cond`, `.c-emerg`, `.c-mand` tokens exist at §2, but the visual styles are re-applied in §6 (Matrix cards) + §8 (BEAMweb assembly status bars). Extract a `.status-pill-{level}` utility at foundation level.
2. **Data tables** (~80 lines) — §6 Matrix and §7 Database both style tables (borders, hover, zebra). Extract `.data-table` + `.data-table-row` utilities.
3. **Form inputs + dropdowns** (~50 lines) — §8 BEAMweb picker inputs, §7 Database search inputs, §5 PDF-Parser scale input all repeat similar input styling. Consolidate `.bw-input` / `.bw-dropdown` at foundation.
4. **Collapsible / expandable sections** (~40 lines) — Implemented 4× across §5, §6, §7, §8. Extract `.expandable-section` + `.toggle-button` utilities.
5. **Scrollbar + scroll-shadow patterns** (~25 lines) — Repeated in viewer + database list + BEAMweb panels. Define `.scrollable-panel` once.

**Total estimated savings: ~255 lines** (~5% reduction, ~5% step toward 1,500 target).

**Risk:** medium — each consolidation touches multiple apps. Visual regression test across all 5 apps required. Best tackled as a dedicated sub-session rather than bundled with other work.

**Phase 4b note:** doing this *before* the source-selector UI + fidelity badge + polyline tool land means those new surfaces can consume the shared utilities directly, preventing further growth. That's the strongest argument for doing it pre-Phase-4b.

---

## Lower-priority items (optional, ~15 min total)

### Console noise — 1–2 drops

[`shared/file-handler.mjs:202`](../../js/shared/file-handler.mjs#L202) has a generic verbose log. Drop or gate behind a debug flag. Everything else (30 total `console.*` calls) is intentional diagnostic instrumentation — lifecycle events, PDF-parse debug traces, fail-fast error signalling. Keep.

### CLAUDE.md CSS size claim is stale

CLAUDE.md says `bfcastyles.css` is "~4100 lines" — actual is 5,028. Update during the CSS consolidation pass so the claim matches reality.

---

## Gaps — flag, don't fix

### Test coverage — zero tests beyond the schema validator

No `.test.js` / `.spec.js` in the codebase. `schema/scripts/validate.mjs` is the only test-adjacent artifact (zero-dep walker for material JSON).

**Not a priority to fix now.** This is a training/demo tool, not production-critical code. Flag for consideration post-Phase-4b. A minimum useful addition would be a single fixture-based test for `polygon-map.mjs` (Phase 4b.2's bridge) — that's where regressions would quietly corrupt user numbers, and it's the natural first test to write.

### Hot reload during local dev

No file watcher; users must manually refresh the browser after edits. Low friction today (one user, small team). Worth revisiting if the team grows or session tempo increases. `vite` or `esbuild --watch` would drop in cleanly.

### PDF-Parser polygon schema migration

When Step 10 adds `component` / `depth_m` / `sheet_id` / `sheet_class` to the polygon record, projects saved before Step 10 will lack those fields. Bridge should treat missing fields as "untagged" and surface them in the fidelity badge ("3 polygons · 0 tagged") so the user knows to re-tag, rather than silently skip. Document in Phase 4b.2 cold-start.

---

## Recommended 3-hour plan

If we're doing the audit execution pre-PR:

1. **Font swap** (~10 min) — do first. Quick win. User-visible.
2. **Helper extraction** (~20 min) — do before any Phase 4 tab ports.
3. **CSS consolidation** (~120 min) — standalone sub-session. Visually regression-test across all 5 apps.
4. **Console noise + CLAUDE.md size claim** (~15 min) — bundle with the CSS session.

**Total: ~2h 45m.** Leaves buffer for unexpected friction. After this lands → PR from `beamweb-tabs-2` → main with session 5 + 6 + spec + cleanup all together.

If 3 hours is too much for this session, **the single highest-value hit is the font swap + helper extraction (30 min combined)** — landing those unblocks Phase 4b's UI primitives and honours the explicit no-serif preference. CSS consolidation can defer to a dedicated session without blocking Phase 4b.

---

*Report complete. Pending your review + prioritisation.*

---

## Execution status (post-review, 2026-04-20)

Andy green-lit all three priorities: font swap, helper extraction, CSS consolidation. Executed:

- ✅ **Font swap** — commit `1c81f16`. `--font-head` token flipped to Helvetica Neue sans-serif stack. No hardcoded Georgia refs found in the codebase; one-line token change propagated via the cascade to all 14 heading / heavy-text contexts.
- ✅ **Helper extraction** — commit `70fe24e`. `esc()` consolidated from four near-identical copies (two `esc` in beam/*, two `escapeHtml` in shell modules) into `js/shared/html-utils.mjs`. `fmtKg` / `fmtQty` moved from `footings-slabs-tab.mjs` to `js/beam/shared/formatters.mjs` before Phase 4 tab ports would duplicate them. Shell modules import with alias (`esc as escapeHtml`) so call sites stay terse. `renderCollapsibleSection` NOT extracted — F&S `renderGroup` and PROJECT's version differ meaningfully (subtotal + inline config handling); extraction deferred until Phase 4 makes the right abstraction concrete.
- ✅ **CSS consolidation 1/5 — status-palette duplication** — commit `3e6df8b`. `.pip-*`, `.badge-*`, `.phase-*`, `.flow-status-*` had the identical 5-level colour-pair body duplicated across 4 rule blocks. Collapsed into one 5-selector compound block at the earliest occurrence, reference-comments at the other three sites. `bfcastyles.css` dropped from 5028 to 5000 lines. Visual output identical.
- ❌ **CSS consolidation 2-5/5 — skipped after verification.** Audit overestimated the duplication in hotspots 2-5:
  - **Data tables (#2)**: 8 tables across 5 apps share `width: 100%; border-collapse: collapse` but diverge legitimately on font-size, thead styles, borders, hover behaviour because they serve different UI purposes (sortable db-table vs sticky summary vs assembly picker). Forcing consolidation would have hurt readability without reducing maintenance burden.
  - **Form inputs (#3)**: `.bw-input` (BEAMweb), `#measure-method` / `#window-mode` (toolbar), `#scale-select` (modal), `#db-search` (search-icon-embedded) all have different parent contexts that drive different padding / bg-token / font-size choices. Each is contextually correct.
  - **Collapsible / expandable (#4)**: `.wall-toggle`, `.scale-toggle`, `.pt-equiv-toggle`, `.code-updates-toggle`, `.view-toggle`, `.db-toggle`, `.bw-asm-toggle` encode 7 different UX concepts with different rotation / icon / sizing. No genuine shared primitive.
  - **Scrollable panels (#5)**: Similar story — scroll context varies by host (PDF viewer vs database list vs BEAMweb tab body) in ways that resist clean extraction.

The pragmatic rule emerging: **CSS consolidation only helps when the rules would actually change in lockstep over time.** The status palette qualifies (compliance levels are a single concept across Matrix). The others are convergent-looking but divergent-changing.

Net cleanup impact:
- Font token: 1 token, 14 sites propagate
- Helpers: -4 function duplicates across 4 files
- CSS: -28 lines of genuine duplication eliminated
- CLAUDE.md: stale ~4100 line count corrected to ~5000

Test coverage gap, hot-reload absence, polygon schema migration — all flagged in §"Gaps" above, remain open, deferred past Phase 4b per the original audit recommendation.

