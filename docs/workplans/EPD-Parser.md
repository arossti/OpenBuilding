# EPD-Parser — workplan (EPD-Parser.md)

> Browser-native parser for Environmental Product Declaration PDFs. Drops an EPD, extracts the EN 15804+A2 fields that populate the BfCA materials schema, and routes the result into a human-reviewed commit flow — either a fresh database entry or a side-by-side update of an existing one. Sibling app to PDF-Parser. Active branch: `EPD-PARSER-SPRINT-2`.

---

## Agent handoff (read this first)

**You are picking up after a long 2026-05-19 session. Active branch: `EPD-PARSER-5`, ~18 commits since main (`78565a8`), all pushed to both remotes, no PR open yet.** The day covered four workstreams: (a) EPD-extraction field-tuning, (b) catalogue data-quality fixes, (c) the CCLIMB methodology + 6th-module scaffold, (d) parity-validation planning.

### ⭐ NEXT SESSION — START HERE

1. **Build the Parity-A harness** (`schema/scripts/csv-json-parity.mjs`) — fully spec'd in **§16**. Diffs 639 JSON catalogue records ↔ 639 BEAM CSV rows field-by-field, emits BfCA's requested **3-sheet workbook** (Sheet 1 = CSV values, Sheet 2 = JSON values same order, Sheet 3 = per-cell MATCH/MISMATCH for GREEN/RED conditional formatting). This is BfCA's top ask — "prove the BEAMweb database matches the spreadsheet." Regex-independent, deterministic, high-assurance-per-hour. Density-units bug already fixed (§15) so most fields should come back green.
2. **Finish the CCLIMB chart-config correction** — `js/cclimb/chart-config.mjs` still defines `LCA_MODULES` as axes; the corrected design (TIME_HORIZONS, per §3.2.E of `docs/RMI Work/CCLIMB-Workplan2.md`) needs to replace it. Workplan2 §3.2 is already corrected; only the scaffold code lags.
3. **Open the PR** for `EPD-PARSER-5` when ready — it's a big, coherent branch (field-tuning + catalogue fix + parity planning + CCLIMB scaffold). Title suggestion: *"EPD-Parser: scaling audit + catalogue-parity + metadata field-tuning + density-units fix + CCLIMB scaffold"*.

### Pending on Andy (not blocking the above)

- **Mélanie review** — materials at `docs/workplans/melanie-review-2026-05-19.{html,rtf,docx}` (the RTF/DOCX are gitignored as `*.rtf`/`*.docx`; the `.html` source + the original markdown draft are tracked). Gating C-fb6 (Tier-10 biogenic). Andy was meeting her 4:15pm 2026-05-19.
- **§12.3 architecture** — treat §14 (Option D = LLM-as-parser, internal) as the working answer. The pause on `IMPACT_INDICATORS` / `_BYSTAGE_LABELS` / `_CISC_LABEL_PATTERNS` inflation **still stands**.
- **Pass 1+2 metadata-extractor bug** (flagged in "Known issue" below) — date/type/validation patterns landed in `extractNA` not `extractCommon`, so NSF/EPD-Intl/unknown formats skip them. ~26% of samples affected. Clean follow-up: move 5 blocks from `extractNA` → real `extractCommon`.

### What shipped 2026-05-19 (full session)

**(a) EPD-extraction field-tuning** (metadata recall, all canonical-30-regression-clean):
- Per-pattern hit-count audit added to harness (§12.5 item 1).
- Six field-tuning passes: manufacturer + epd.id (+20–41pp), dates (+22pp v1.1), epd.type/validation (+18pp), density (+3pp), material_type (+10pp). Canonical 30 metadata 66.4 → 69.5%.
- ⚠️ **Bug:** dates/type/validation passes edited `extractNA` not `extractCommon` (see "Known issue").

**(b) Catalogue data-quality:**
- **Density-units import bug FOUND + FIXED** (`16d4ebd`, documented §15). The BEAM CSV stores density with correct units in col 33 (`kg/m2`, `kg/m`, `g/cm3`, etc.); the importer dropped the unit column and stamped all as `kg/m³` — corrupting ~180 of 684 density records. Fix: importer reads col 33, emits `{value, units, value_kg_m3 (null unless volumetric), value_lb_ft3, source}`. Parity "differ" count dropped 102 → 36. **Mélanie's source data was correct; the bug was BfCA-side.**
- **Full CSV units audit** (§15.3): density was the ONLY affected column — every other value column anchors to the per-material "common unit" (col 19) which the importer reads correctly.

**(c) CCLIMB — RMI methodology + 6th BfCA module:**
- Read CCLIMB methodology (`docs/RMI Work/CCLIMB-Workplan.md` = Chris's proposal) + CCOB earlier draft + Chris's flowchart PDFs.
- Wrote `docs/RMI Work/CCLIMB-Workplan2.md` — implementation interpretation (~730 lines): summary, 6th-module fit, parallel-coordinates UX (per Andy: axes = TIME HORIZONS, RT vs PT per-material multi-line, RT = unbounded counterfactual not module-stratified), climate-model sketch, v1/v2 scope, working-group questions.
- Scaffolded the module (`7a6ef51`): `cclimb.html` + `js/cclimb.mjs` + `js/cclimb/*.mjs` (chart-config, climate-model, reference-trajectories, feedstock-categories, parallel-coords stubs) + `js/cclimb/parallel-coordinates.objective-source.js` (verbatim port-reference from OBJECTIVE module 18 via gh CLI) + §12 CCLIMB CSS + landing card.
- ⚠️ chart-config.mjs axes need the TIME_HORIZONS correction (see NEXT SESSION #2).

**(d) Parity-validation planning** (§16): A (CSV↔JSON, do-first) vs B (EPD↔CSV/JSON, needs multi-product extraction, deferred). Multi-product = the parser emits 1 record/PDF today but 280 EPDs → 639 BEAM rows (EPDs cover 2–8 products each); Follow-up #4 gap, gates Parity B, strongest argument for LLM-as-parser.

**Strategic (§14):** EPD-Parser + materials catalogue are **internal back-of-house** (the catalogue is BfCA's "secret sauce"); BEAMweb/PDF-Parser/Matrix/DB-read are public. Internal tools can use the Claude API on staff workstations → LLM-as-parser is the path to 90%+ extraction. §8 in-browser-API ban applies to public surfaces only.

**Large sample sets (gitignored, local-only):** `docs/PDF References/EPD-scaling-sets/` (116 v1.1-candidates + 208 existing-BEAM) and `docs/PDF References/EPD SAMPLES/BEAM 639 Rows/` (280 PDFs → 639 BEAM rows, the parity validation set). All gitignore-protected — never commit.

**Decisions still gating downstream work:**

1. **Mélanie review of §11.10 (gates C-fb6).** Draft is ready in `docs/workplans/melanie-review-draft-2026-05-19.md` — Andy hasn't sent yet. Once Mélanie signs off Q3 (Phyllis 2 shortlist), C-fb6.1 (schema bump) → C-fb6.7 (validation harness) can start.

2. **§12.3 architecture choice — now with Option D added.** §14.6 reframes the decision: Option D (LLM-as-parser, internal CLI) is the recommended path; Option C (HITL form-pane) is complementary. Options A (geometric) and B (declarative) deprioritized. **Andy hasn't formally answered §12.4's questions; treat §14 as the working answer until he says otherwise.** The §12 pause on `IMPACT_INDICATORS` / `_BYSTAGE_LABELS` / `_CISC_LABEL_PATTERNS` inflation **still stands** — the metadata extractor work today did NOT touch those three arrays.

**Coverage state, end of 2026-05-19:**

After today's 9 commits, three audit sets snapshot in `docs/workplans/EPD-coverage-history/`:

| Set | n | Metadata | Notable |
|---|---:|---|---|
| Canonical 30 (regression baseline) | 30 | 69.5% (was 66.4%) | material_type 83%, manufacturer 70%, epd.id 67% |
| v1.1-candidates | 116 | 65.6% (was 55.9%) | manufacturer 60%, epd.id 65%, pub_date 66% |
| Existing BEAM | 208 | 66.1% (was 60.4%) | display_name 100%, epd.id 64% (was 23%) |

Day's net delta: **+3pp canonical, +9.7pp v1.1, +5.7pp Existing BEAM** on metadata aggregate. Impact + by_stage unchanged (no `IMPACT_INDICATORS` / `_BYSTAGE_LABELS` touched).

**Catalogue-parity check on Existing BEAM 208 (after today's lifts):**
- strong: 33 (16%)
- strong-multi: 23 (11%)
- medium: 4 (2%)
- medium-multi: 42 (20%)
- weak: 76 (37%) — noisy, threshold tuning deferred
- **unmatched: 30 (14%)** — the catalogue-update candidates BfCA should review

### Known issue discovered EOD 2026-05-19 — Pass 1+2 patches in wrong function

Late in the marathon (after the strategic-§14 commit) a debug-trace on 810.CRMCA_EPD_BC.pdf (NSF format) revealed that the new date / EPD-type / validation patterns added in Pass 1 + Pass 2 are inside `extractNA` (line 1163+), not the actual `extractCommon` (line 412+) as the commit messages claimed. The functions are ~700 lines apart and the visual context was easy to mistake.

**Impact:** NSF (30 Existing-BEAM samples), EPD-International (14), and unknown-format (49) samples never see the Pass 1+2 improvements — about 26% of the 354-sample audit. This explains why Pass 1's pub_date lift on Existing BEAM was only +6pp instead of the +22pp v1.1 saw.

**Fix (single follow-up commit):** Move three blocks from inside `extractNA` (lines 1319–1411) up into the real `extractCommon` (line 412+). The blocks: pub_date chain, expiry chain, EPD-type label+prose, markets, validation-type. NSF / EPD-Intl / unknown samples should see immediate coverage lift; canonical 30 should be unchanged (NA samples still get the same patterns since extractCommon runs after the per-format extractors); v1.1 should see another +5-10pp metadata.

**Verification:** After moving the blocks, re-run all 3 audits. The 810.CRMCA-class test case is: `Period of Validity 5 Years – Valid until July 27, 2027` should set `epd.expiry_date: 2027-07-27`.

This is the cleanest first-thing-tomorrow task. Independent of any §14 / LLM-as-parser work.

### Pickup — what you're doing next

The branch is at a clean stopping point. Most likely user-driven next moves:

1. **Open the PR for `EPD-PARSER-5`.** 9 commits, clean lineage, all pushed. Title suggestion: *"EPD-Parser: per-pattern audit + catalogue parity + 5-pass metadata lift + §14 strategic positioning"*. This is the natural unit of review.

2. **Mélanie draft pending Andy red-line.** Check `docs/workplans/melanie-review-draft-2026-05-19.md`. Has an "Andy's review notes" checklist at the bottom. When Andy says it's ready, send through whatever channel BfCA uses.

3. **Prototype LLM-as-parser (§14.5 step 2).** Andy didn't authorize this yet but it's the natural next step. ~30 min to wire a Claude API call against 10 wild v1.1 samples + JSON-Schema-as-system-prompt, compare LLM output vs regex output. Confirms or refutes the 90%+ claim with hard data.

4. **More regex fine-tuning.** Andy explicitly said *"we should continue to refine the Regex and parser as much as possible, but I think now I see the limits and extended solutions."* So additional passes are welcome but expected to deliver diminishing returns. Highest-headroom remaining fields: `epd.type` (37%), `epd.expiry_date` (15% on Existing BEAM), `physical.density` (63%), validation.type (24% on Existing BEAM).

### Branch state (2026-05-19 EOD)

```
EPD-PARSER-5 (both remotes):
  1ab6301   Pass 4: material_type vocab + title-picker fixes
  7b54f2b   Pass 3: density extraction lift (modest)
  63de94f   Pass 2: epd.type + validation.type extraction lift
  3429602   Pass 1: date extraction lift (DD.MM.YYYY + new labels)
  b0bc986   manufacturer + epd.id extraction lift (+20–41pp recall)
  9303991   Mélanie draft — fold in catalogue-parity findings
  bd12ef9   Catalogue-parity matcher + 208-sample audit
  55247fc   §12.3 decision data — scaling audit on 324 PDFs
  202b5a1   Per-pattern hit-count audit (§12.5 item 1)
         ↑
  main 78565a8 (unchanged since 2026-05-11)
```

PR not yet opened. When ready: open on `arossti/OpenBuilding` (canonical), then `git push origin main` post-merge to keep `bfca-labs` mirror in sync.

### Read this order

1. **§14 — Internal positioning + Last Mile (new today)** — load-bearing for any architectural decision going forward. Read in full.
2. §11 — Biogenic calculations (review-pending) — §11.8 (Mélanie answers) and §11.10 (Monday-review items, with Andy's decisions now in the message draft).
3. §12 — Architecture review — pause is still active for the three pattern arrays.
4. §10 — Fallback database (db-fallbacks.json) — Tier-9 layer.
5. §7.6 — Harness contract.

### File map (current)

| File / path | What's there |
|---|---|
| `js/epd/extract.mjs` | Main extractor. Tier-by-tier (Type → Group → per-format → Common → DB-fallbacks → BEAM-calc). Today's edits in extractNA + extractCommon for manufacturer/epd.id/dates/type/density/material_type. |
| `schema/scripts/test-epd-extract.mjs` | Harness. Per-format breakdown, per-parameter aggregate, per-pattern audit (§12.5 item 1), catalogue-parity matcher (today). |
| `docs/PDF References/EPD SAMPLES/` | Canonical 30 with `expected/*.json` ground truth (2 annotated). Default harness target. |
| `docs/PDF References/EPD-scaling-sets/` | Two folders dropped today: 116 v1.1-candidates + 208 Existing-BEAM-archive. Harness via `--root <dir>`. |
| `docs/workplans/EPD-coverage-history/` | Auto-snapshotted runs. ~12 new snapshots from today's marathon. |
| `docs/workplans/melanie-review-draft-2026-05-19.md` | Mélanie message awaiting Andy's red-line. |
| `schema/materials/*.json` | 821-record catalogue. Read-only on Pages; write side is internal-only (§14.1). |

**Hard rules — do not violate:**

- **§7.6 + §10.3 harness contract:** every commit that touches `js/epd/extract.mjs` re-runs `node schema/scripts/test-epd-extract.mjs` and commits a fresh snapshot to `docs/workplans/EPD-coverage-history/`. Canonical-30 aggregate coverage must move up or stay equal; no individual canonical sample may regress.
- **§5.5 BEAM ID convention:** `beam_id` is BfCA-internal and never extracted from a PDF. `extract.mjs` produces `beam_id: null`. Minting happens on the Database side at commit.
- **§8 security (refined by §14):** no Anthropic API integration on public-facing surfaces (BEAMweb, PDF-Parser, Matrix, Database read view). Internal-only tooling on BfCA staff workstations IS permitted — see §14 for the Last Mile strategy.
- **§12.3 pause (still active):** no new entries to `IMPACT_INDICATORS`, `_BYSTAGE_LABELS`, `_CISC_LABEL_PATTERNS`. Metadata extractors (manufacturer/dates/type/density/material_type label patterns inside extractNA / extractEuIbu / extractCommon) are NOT covered by this pause — that's where today's work happened.
- **§9 IP guardrails:** no `CSI` / `MasterFormat` / `Division` / `MCE²` / `NRCan` / Crown-copyright tool names in code, UI strings, or workplan.
- **Soft-delete only.** Hard-delete forbidden forever.

**Daily-driver commands:**

```
node schema/scripts/test-epd-extract.mjs                          # run on canonical 30, auto-snapshot
node schema/scripts/test-epd-extract.mjs --root "docs/PDF References/EPD-scaling-sets/EPDs to consider for v1.1 update"
node schema/scripts/test-epd-extract.mjs --root "docs/PDF References/EPD-scaling-sets/Existing BEAM Database EPDs"
node schema/scripts/test-epd-extract.mjs --only Kalesnikoff       # substring filter (no snapshot)
node schema/scripts/test-epd-extract.mjs --json /tmp/dump.json    # full per-candidate dump
npm run serve                                                     # local dev server
```

**Cross-references:**

- [`Database.md`](Database.md) — sibling workplan for the Database viewer.
- [`docs/PDF References/EPD SAMPLES/`](../PDF%20References/EPD%20SAMPLES/) — canonical 30.
- [`docs/PDF References/EPD-scaling-sets/`](../PDF%20References/EPD-scaling-sets/) — 324 PDFs added today for scaling tests.
- [`schema/material.schema.json`](../../schema/material.schema.json) — target shape for emitted records.
- [`schema/lookups/`](../../schema/lookups/) — lookup tables primed via `Extract.setLookups()`.

---

## 0. Current state (2026-04-30 morning)

**Phases shipped** (chronological):

- ✅ **P0 — Shell** — `epdparser.html` + `js/epdparser.mjs` ESM entry, drop-zone, status bar, viewer canvas reusing `js/pdf-loader.mjs` + `js/canvas-viewer.mjs`. Card on landing page (`Planning` badge).
- ✅ **P1 — Text extraction** — `getTextContent()` per page wired into a sidebar dump panel. 10-sample calibration done (NA / EU-IBU / EPD International / NSF format families catalogued in §9.5).
- ✅ **P2 — UX scaffold** — 60/40 layout (PDF left, schema-driven form right; window-resize listener now in `canvas-viewer.mjs`), 24-field form across 7 sections (reordered per §5.6 taxonomy 2026-04-28), IndexedDB auto-save (`state: "draft"`), Capture button promotes draft → captured. Manual-entry path works identically to auto-extract — both flow through `_bindFormChange` to the same candidate record then `Store.putPending`. Database viewer pending-changes panel + Trust / Trust + Verify stubs ([`Database.md`](Database.md) §4–§5).
- ✅ **P3.1 — Regex auto-fill, totals + harness** — `js/epd/extract.mjs` with format detection (NA / EPD International / NSF / EU-IBU) and the 10-indicator impact-totals loop. `schema/scripts/test-epd-extract.mjs` regression harness walks all 30 sample EPDs and emits a per-sample coverage matrix.
- ✅ **§5.6 — Hierarchical extraction (Tier 1 + Tier 2 trunk)** _(shipped 2026-04-28, `9fb6c88`)_. `extractType` populates `naming.display_name` + `classification.material_type` from page-1 head + a 21-pattern keyword vocabulary. `inferGroupPrefix` consumes Tier 2 + the `schema/lookups/material-type-to-group.json` and `display-name-keywords.json` files (primed via `Extract.setLookups()`) to populate `classification.group_prefix`. `extract()` refactored to run tier-by-tier (Type → Group → Manufacturer → Provenance → Identification → Methodology → Physical → Impacts). Form-pane sections reordered to match. `package.json stage:data` + `.github/workflows/deploy-pages.yml` now ship `schema/lookups/` to `data/schema/lookups/` for browser fetch.
- ✅ **§7.7 — Trust persistence (catalogue-visible)** _(shipped 2026-04-28, `8c20ae5`)_. New `epd-committed-patches` IndexedDB store (`DB_VERSION` bumped to 3). `handleTrust` writes the committed record + index_entry + audit_meta + commit_type + committed_at, then optimistically pushes into `state.indexEntries` with a `_fresh: true` flag. New entries get a 6-char hex id minted via `_mintId6`; refresh commits merge the candidate over the existing record (candidate-wins-on-set, prior-wins-on-null) and replace in place. Boot-time `_mergeCommittedPatchesOnBoot` re-merges patches from prior sessions so the highlights survive reload. `.db-row-fresh` yellow tint + `NEW` / `UPDATED` chips next to the BEAM ID.
- ✅ **§9.5 fix #1 — older BC Wood format** _(shipped 2026-04-28, `93217ac`)_. Six new English-label IMPACT_INDICATORS entries (Global warming potential / Ozone depletion / Eutrophication / Smog / Non-renewable fossil / Renewable biomass) catch the 2013 LVL / 2016 LSL AWC / 2016 WRC EPDs whose tables use English category names instead of EN 15804 indicator codes.
- ✅ **`gwp_kgco2e` index-entry NaN fix** _(shipped 2026-04-28 EOD, `6196848`)_. Schema shape is `impacts.gwp_kgco2e.total = { value, source }` not a scalar; `_indexEntryFromRecord` now reads `gwp.total.value`. `functional_unit` similarly corrected to read from `impacts.functional_unit` first.
- ✅ **§9.5 fix #2 — EU/IBU per-format extractor** _(shipped 2026-04-29, `370ffc8`)_. New `extractEuIbu(text, rec)` for IBU declarations (anchors: `Owner of the Declaration`, `Declaration number`, `Issue date`, `Valid to`). Six new EU/IBU-style impact regexes for bracketed-unit layouts (`[kg CO 2 -Eq.]`, `[kg SO 2 -Eq.]`, `[kg CFC11-Eq.]`, `[MJ]`). `extractType` skip vocabulary tightened to drop standards-citation phrases ("as per ISO 14025 and EN 15804+A1") and label rows ("Owner of", "Declaration number", "Issue date", "Valid to") from the display_name picker. Catches EU/IBU sample plus bonus matches on 4 metals + 2 wood + 1 thermal sample whose tables happen to use bracketed units.
- ✅ **§9.5 fix #3 — ISO 21930 indicator codes + comma-thousand parser fix** _(shipped 2026-04-29, `39cbb97`)_. Three new IMPACT_INDICATORS entries for the modern NA / ISO 21930:2017 codes `RPR E` (PE-R), `NRPR E` (PE-NR), `FW` (water consumption). `_extractIndicatorTotals` number parsing fixed: comma-thousand-separated values like `3,490.16` were being parsed as `3.49`; now correctly handled (US/CA convention strips comma, EU convention replaces comma with period). All 4 BC Wood 2023 samples now at 10/10 impact coverage.
- ✅ **§9.5 fix #4 — EPD-IES filename variant** _(shipped 2026-04-29, `666de0e`)_. Per-glyph fragmentation tolerance for the IES sibling of S-P-10278 where labels emit one glyph at a time ("S - P - 10278", "Publication date: 202 5 - 10 - 2 0"). Centralised tolerant `_SP_ID_RX = /S\s*-\s*P\s*-\s*(\d{5,6})/`. New `_looseIsoDateAfter` helper collapses digit-whitespace pairs in dates before matching `YYYY-MM-DD`. Format detection lifts the IES variant from `unknown` → `epd_international`, which then gets the full extractEpdIntl pass.
- ✅ **§10 chapter added to workplan** _(shipped 2026-04-29, `6bef852`)_. Documents the architectural pivot: db-fallbacks reference catalogue + four-source `source` enum + provenance chips + verification-before-fallback harness upgrade. Six-commit plan C-fb1..C-fb6 in §10.6.
- ✅ **C-fb1 — db-fallbacks reference catalogue + builder** _(shipped 2026-04-29, `557ea31`)_. New `schema/lookups/db-fallbacks.source.xml` (~200 thermal/embodied-property entries × 5 properties) + `schema/scripts/build-db-fallbacks.mjs` converter (canonical-label mapping + median-density default-pick + hand-picked overrides for Concrete/Steel/Sheathing/Wood-fiberboard/Gypsum/Fiberglass) + emitted `schema/lookups/db-fallbacks.json` (31 canonical material_types covering 142 of 171 XML rows). Pipeline: `npm run build:db-fallbacks` regenerates JSON; `package.json stage:data` + Pages workflow filter to `*.json` so the .source.xml stays a build input.
- ✅ **C-fb2 — Tier-9 `applyMaterialDefaults()` fallback layer** _(shipped 2026-04-29, `e1ff163`)_. New `applyMaterialDefaults(rec)` step in `extract.mjs` runs after `extractCommon` as Tier 9. v1 fills only `physical.density.value_kg_m3` (the only catalogue field with an existing schema slot today); marks each filled value with `source: "generic_default"`. `setLookups()` now accepts `materialDefaults`; harness + epdparser browser both prime the cache. Filled 11 density slots across Steel / Aluminum / Plywood / Gypsum / Framing / SPF samples.
- ✅ **C-fb3 — Form-pane provenance UI** _(shipped 2026-04-29, `c0fe802`)_. New `_resolveSourcePath()` (replaces last segment with "source"; works for both `physical.density.value_kg_m3` → `physical.density.source` and `impacts.gwp_kgco2e.total.value` → `impacts.gwp_kgco2e.total.source`) + `_applySourceClass()`. `_populateFormFromCandidate` calls it for every input. `_bindFormChange` flips source to `user_edit` on type. Three CSS classes: `.epd-source-default` (magenta), `.epd-source-calc` (cyan), `.epd-source-edit` (lime). Default rendering covers `epd_direct` / unset.
- ✅ **C-fb4 — Database viewer chips + toolbar legend** _(shipped 2026-04-29, `9d7a048`)_. Static four-chip legend in `database.html` `.db-result-bar` (`EPD ● DEFAULT ● CALC ● EDIT`) so users land on the page already knowing what each color means. Per-field inline chips via new `_sourceChip(source)` + `_valueWithSourceChip(text, source)` helpers in `database.mjs`. Currently rendered on the `density` row of the Physical Properties block (the only Tier-9-fillable field).
- ✅ **C-fb4 follow-up — DEFAULT chip → magenta** _(shipped 2026-04-29, `e563f04`)_. Andy feedback: amber DEFAULT clashed visually with the yellow `.db-fresh-chip-new` on Trust-committed rows. Both `.db-chip-source-default` (database viewer) and `.app-epdparser .epd-form-row .epd-source-default` (form pane) swapped to magenta `rgba(232, 121, 249, ...)`. Maximum visual distinction across the five chip types now in play.
- ✅ **BEAM ID convention** locked in §5 + §5.5 (6-char hex matching the existing catalogue, never overwrite with PCR or EPD-id).
- ✅ **C-fb1.1 — Wood alias resolution in db-fallbacks** _(shipped 2026-04-29 PM, `6347183`)_. Build-converter renames TIMBER-sourced canonical from "Framing" → "Wood" + emits an `aliases` block resolving Framing / Engineered wood / Glulam / CLT / Cross-laminated timber / GLT / LVL / LSL / PSL / Solid wood / Lumber / SPF / Wood I-joist → "Wood". `applyMaterialDefaults` consults aliases when direct lookup misses. Hardwood deliberately omitted (density spread too wide for a single default). Coverage +5 metadata (5 wood samples picked up density via the alias).
- ✅ **§9.5 fix #5 — Kalesnikoff long-English impact extraction + display_name from taxonomy** _(shipped 2026-04-29 PM, `44fc4f1`)_. Three sub-patches: (5a) `deriveDisplayName(rec)` overrides `naming.display_name` with `${groupLabel} | ${materialType}` once Tier 1+2 settle (e.g. "Wood | Glulam"); cover-page picker preserved on samples without group+type. `setLookups` extended with `materialGroups`. `extractType` skipPrefix extended to skip per-glyph EPD-header artifacts ("E nvironmental", "P roduct", "D eclaration"). Material-type keyword scan now prefers matches in the title (display_name) before falling through to body. (5b) q-optional in 7 IMPACT_INDICATORS regexes (`[Ee]q\.?` → `[Ee]q?\.?`) — Kalesnikoff and modern NA EPDs use "kg CO2e" / "kg SO2e" / "kg O3e" without trailing q. (5c) Six new English-variant entries: GWP em-dash + Total subtitle (with negative lookahead on Fossil/Biogenic), GWP-Biogenic em-dash, ODP label-only (drops unit-cell anchor for wrapped-unit case), AP "of soil and water sources", SFP "Formation potential of tropospheric ozone", ADPf parenthetical "(ADPfossil)"; EP regex made `\s*` between N and Eq for "kg Ne" tolerance; WDP "Consumption of freshwater resources" English variant. Coverage +16 impacts (147 → 163, 49.0% → 54.3%); both Kalesnikoff samples 2/10 → 10/10.
- ✅ **§9.5 fix #6 — Mass-per-declared-unit density + manufacturer prose fallback + EPD-ID truncation** _(shipped 2026-04-29 PM, `28f48d3`)_. (i) "Mass (including moisture) kg \<N\>" pattern in `extractPhysical` — N kg per declared 1 m³ = density. Skips Oven Dry Mass. Fires only when existing direct-density patterns return null. (ii) "produced by/at <CompanyName>" prose fallback in `extractNA` for layouts where label-then-value spatial join fails (Kalesnikoff "Declaration Owner" sits at y-midpoint of multi-line address cell, so label ends up between value rows — produces "South Slocan, BC V0G 2G0" instead of "Kalesnikoff Lumber Co."). The "produced by/at" pattern grabs the title-prose CompanyName up to the next lowercase word. (iii) EPD-ID post-process: split capture on next-label keywords (Declared / Date / Period / Owner / Holder / Type / Scope / Reference / Markets / Description / Year / EPD\\s+(?:Type|Scope) / Programme / Program / Issue / Valid / Publisher) so "EPD 296 Declared Product Glulam 3" cleanly truncates to "EPD 296". Coverage +3 metadata (Kalesnikoff CLT/GLT 13 → 14, Fabricated Steel Plates 11 → 12).
- ✅ **C-fb5 — harness ground-truth verification** _(shipped 2026-04-29 PM, `7176915`)_. `docs/PDF References/EPD SAMPLES/expected/<sample>.json` files annotate each sample's `epd_publishes` and `epd_omits`. Harness gains three checks per workplan §10.3: (1) extraction fidelity — every published key must extract within ±1% numeric tolerance / substring match; (2) defaults applied — every omitted key must be filled via catalogue with `source: "generic_default"`; (3) no silent overrides — every published key's post-fallback source must NOT be `generic_default`. Per-sample line gets `GT=✓` tag, aggregate summary adds one line, markdown snapshot grows a "Ground-truth checks" section with per-failure detail. First annotated: 2022 BC Wood GLT Kalesnikoff EPD.
- ✅ **DB viewer — duplicate detection + remove button + BEAM ID column width** _(shipped 2026-04-29 PM, `43f0cf3`)_. (i) `_findDuplicate(candidate)` looks for likely matches among in-session committed records via two-tier match (manufacturer + epd.id, then display_name + group_prefix). When found, `handleTrust` prompts `confirm()` "OK = overwrite, Cancel = create separate". Restricted to `_fresh` entries — original 821 BEAM records can never be implicitly over-written. (ii) `.db-row-remove` × button on `_fresh` rows; `handleRemoveFresh(id)` confirm-then-delete from IndexedDB + state. Hard guard: button only renders on `_fresh`, AND handler re-checks the flag at click time (catalogue records are immutable through this path, even with forged DOM markup). (iii) `.db-th-id` width 96px → 140px + `white-space: nowrap` so full 6-char hex + NEW/UPDATED chip + × button all fit on one line. End-to-end verified via Playwright.
- ✅ **P3.3 — per-stage breakdown extraction** _(shipped 2026-04-29 PM, `ae20837`)_. New `_extractByStage(text, rec)` populates `impacts.<key>.by_stage.<stage>.{value, source}` for individual stages A1, A2, A3, A4, A5, B1..B7, C1..C4, D. `_detectStageHeaders(text)` returns ALL candidate header lines (deliberately not just the first — Kalesnikoff has a generic 17-stage life-cycle list at line 126 that isn't a column header; the actual Table 3 header is at line 260). Per-row extractor picks the nearest preceding header whose stage-count matches the row's value-count exactly. `_tokenizeImpactNumbers` filters subscript digits (the `2` in CO2e, `3` in O3) by accepting only decimals / sci-not / 3+ digit integers / thousand-comma values. Idempotent — never overwrites existing by_stage. C-fb5 ground truth extended with 30 per-stage keys for Kalesnikoff GLT (A1/A2/A3 for all 10 indicators, including `gwp_bio.by_stage.A1 = -1045.63` — the carbon-stored value). All 52 keys pass.
- ✅ **rev-3 fix — browser pdf.js fragmentation stripping signs + sci-not exponents** _(shipped 2026-04-29 PM, `ce3c7cc`)_. Browser pdf.js fragments composite tokens like `-953.23` → `["-", "953.23"]` and `2.27E-06` → `["2.27E", "-", "06"]` (touching, < 1.5px gap). Node pdfjs-dist keeps them intact. The browser's `_flushLine` was inserting implicit space between adjacent items, breaking the regex's negative-sign and exponent capture — silent, since the harness used Node pdfjs and didn't see the divergence. Fix gates implicit-space insertion on `item.x + item.width` gap > 1.5px. Verified end-to-end via Playwright (PDF drop → Capture → Trust → matrix expand): GWP A1 = -953.23, GWP-bio A1 = -1045.63, ODP A1 = 1.03e-6, all correct.
- ✅ **rev-2 fixes — BEAM ID column ellipsis + functional_unit normalisation + manufacturer Declaration Owner revert** _(shipped 2026-04-29 PM, `7bea52b`)_. `.db-th-id` 140px → 200px + per-cell `overflow: visible` override on `td:first-child` (chip + × button now fully visible). New `_normalizeDeclaredUnit(raw, fullText)` extracts leading "<number> <unit>" token and disambiguates pdf.js-stripped superscripts via doc-context scan; result plumbed into `impacts.functional_unit` so DB index entry surfaces it. Result for Kalesnikoff GLT: both `carbon.stated.per_unit` and `impacts.functional_unit` now hold "1 m³".
- ✅ **PR #16 merged 2026-04-29 evening** — all of the above shipped to main as `046108a`.
- ✅ **Shared text-join module** _(shipped 2026-04-29 evening, `607a4ed`)_. `js/shared/text-join.mjs` extracts `_itemsToLines` + `_flushLine` so Node harness uses identical logic to the browser. Without this, the harness was falsely-green for any future bug class that depends on browser-specific pdf.js fragmentation. Wired into both `js/epdparser.mjs` and `schema/scripts/test-epd-extract.mjs`; harness now adds `width: it.width` to the pdf.js item mapper. Coverage delta: metadata +4 (Wood OSB + WRC pick up density via cleaner join); impacts -1 (CISC steel WDP=3 was a FALSE POSITIVE — published value is 2.88, prior text-join was matching wrong text and getting 3; cleaner join correctly returns null).
- ✅ **§11 Biogenic Calculations chapter (review-pending)** _(shipped 2026-04-29 evening, `0c2c70d`)_. Drafts the principle for C-fb6: EPD-published biogenic values are authoritative and never recomputed; BEAM normalization layer (Tier 10) exists ONLY as unit-conversion + per-functional-unit projection so BEAMweb can consume per-material values in hybrid-component assemblies. Six concrete questions in §11.8 for Mélanie's sign-off on schema-field naming, storage_factor source, defaults location, validation tolerance. BEAM-CSV inventory confirmed all formula inputs (density, biogenic_factor, carbon_content, 3.67 stoichiometric constant) are already present in `docs/csv files from BEAM/BEAM Database-DUMP.csv`.
- ✅ **by_stage harness dimension + xcarb per-stage extraction + density thousand-comma fix** _(shipped 2026-04-29 evening, `34570bc`)_. Three additive improvements: (i) Harness now counts per-stage cells (10 indicators × 17 stages = 170 max per sample); per-sample console line gains `by_stage=N/170` field; aggregate adds `By-stage coverage:` row; markdown snapshot grows per-sample by_stage column AND a per-indicator-by-sample matrix table. (ii) 10 new `_BYSTAGE_LABELS` entries for bracketed-unit short-code labels (xcarb / IPCC AR5 / TRACI 2.1 family: `GWP 100 [kg CO2 eq]`, `AP [kg SO2 eq.]`, etc.); per-stage tokenizer skips the unit-cell prefix to avoid mis-counting the methodology label number ("100" in "GWP 100" is the IPCC 100-year-time-horizon designation, not a stage value). xcarb cold-formed verified against published Table on page 5: GWP A1=1230, A2=11.7, A3=15.3, C1=0.666, C2=22.3, C3=0.668, C4=1.30, **D=-241** (recycling-credit sign preserved). (iii) Density regex now accepts US thousand-comma form `\d{1,3}(?:,\d{3})+` so xcarb's published `density of 7,800 kg/m3` extracts 7800 (was 800 — silently-stripped by `\d{2,5}` skipping past the `7,` prefix).

**Latest measured coverage** (`node schema/scripts/test-epd-extract.mjs`, 2026-04-29 21:47Z, snapshot at `EPD-coverage-history/2026-04-29T21-47-50Z.md`):

- 30/30 samples processed, no errors
- **Metadata: 279/420 = 66.4%** (14 fields × 30 samples)
- **Impact totals: 162/300 = 54.0%** (10 indicators × 30 samples)
- **Per-stage cells: 473/5100 = 9.3%** (10 indicators × 17 EN 15804+A2 stages × 30 samples)
- Ground-truth checks: **2 samples annotated** (Kalesnikoff GLT 54 keys, xcarb cold-formed 56 keys = 110 expected keys total). 0 extraction failures, 0 silent-override violations, 0 defaults-applied failures.
- Format detection: na=18, epd_international=2, nsf=2, eu_ibu=1, unknown=7

**Per-sample by_stage coverage** (snapshot 2026-04-29T21-47-50Z, of 170 max per sample):

| Sample | by_stage | Notes |
|---|---:|---|
| 03 Concrete/CRMCA Ontario Regional Industry-Avg | 9 | partial — concrete-format header detection partial |
| 03 Concrete/Lafarge Exshaw Cement Plant | 0 | multi-product table (4 cement types in cols), needs disambiguation UI |
| 05 Metals/CISC Industry-Avg Hot-Rolled Sections | 0 | impacts entirely missed; needs CISC-format regex |
| 05 Metals/EPD International S-P-10278 (×2) | 10 each | partial — EPD-International format |
| 05 Metals/Fabricated Steel Plates 2019 | 19 | partial |
| **05 Metals/xcarb cold-formed/hollow/deck** | **48 each** | **Full A1/A2/A3/C1/C2/C3/C4/D — sign preserved on D recycling credit** |
| 06 Wood/2013 BC Wood LVL | 0 | **correct** — EPD publishes only `Total \| Forestry \| LVL Production` (process breakdown, NOT life-cycle stages) |
| 06 Wood/2015 BC Wood DF Density (No EPD) | 0 | **correct** — not an EPD |
| 06 Wood/2015 LSL Summary | 0 | summary-form EPD, no per-stage |
| 06 Wood/2016 BC Wood LSL AWC | 15 | partial |
| 06 Wood/2016 BC Wood WRC | 0 | older AWC industry-avg, no per-stage |
| 06 Wood/2017 BC Wood WRC AWC | 18 | partial |
| 06 Wood/2020 BC Wood OSB | 18 | partial |
| **06 Wood/2022 BC Wood CLT/GLT Kalesnikoff** | **30 each** | **Full A1/A2/A3 — published cells exhausted (cradle-to-gate)** |
| 06 Wood/2022 BC Wood Hemlock Density (No EPD) | 0 | **correct** — not an EPD |
| 06 Wood/2023 BC Wood CLT EPD ASTM | 15 | partial |
| 06 Wood/2023 BC Wood GLT EPD ASTM | 26 | partial |
| 06 Wood/2023 BC Wood SPF | 18 | partial |
| 06 Wood/2023 BC Wood SPF Plywood | 26 | partial |
| 07 Thermal/Boreal Nature Elite TDS | 0 | **correct** — not an EPD |
| 07 Thermal/Sopra-Cellulose / Sopra-ISO / Polyiso walls | 0 | scanned PDFs (no text layer); needs OCR (P7) |
| 07 Thermal/Sopra-XPS | 36 | decent |
| 07 Thermal/Genyk SPF | 31 | decent (3-product EPD, only one product captured) |
| 07 Thermal/EU-IBU Wood Fibre | 18 | partial |

**Coverage delta this 2-day session** (vs 2026-04-28 baseline pre-fix-#1):

- Metadata: 57.6% → 66.4% (+8.8 pp)
- Impact totals: 36.0% → 54.0% (+18 pp)
- Per-stage cells: 0% → 9.3% (NEW dimension)
- Ground-truth annotated samples: 0 → 2 (Kalesnikoff GLT, xcarb cold-formed)

**Phases pending** (ranked by leverage post-2026-04-29 evening):

- 🟧 **C-fb6 — `applyCalculations()` Tier 10** — design-pending (revised 2026-05-05 after Mélanie's answers in §11.8). Was estimated ~3 hrs; now ~19 hrs across 7 sub-commits (§11.9). Mélanie clarified: biogenic_factor isn't a per-material-type default — it's derived from the EPD's Material Content table + Phyllis 2 biomass carbon-content lookup (https://phyllis.nl/). Three distinct biogenic-source paths (EPD GWP-bio / EPD BCRP / BfCA-calculated). New schema: `classification.material_content[]`, `physical.beam_calc.{full_c_kgco2e, biogenic_source, storage_cycle, ...}`, `impacts.biogenic_inventory.{bcrp, bcep, bcrk, bcew}.by_stage.*`. Compound-gated on Monday's Mélanie review (§11.10) AND §12.3 architecture choice (material-content table extraction is itself a per-format problem).
- 🔜 **xcarb total = A1 false positive** — for cradle-to-gate-with-options EPDs without a published A1-A3 composite, the IMPACT_INDICATORS regex grabs A1 as "total". Should compute total = A1+A2+A3 OR leave null. Annotated in xcarb cold-formed ground-truth notes; not asserted (so harness doesn't fail on it). See follow-up #2 in agent handoff.
- 🔜 **CISC water "Use of net fresh water 1 mt 2.88E+00"** — regex variant for the "1 mt" functional-unit prefix between label and value. CISC currently 0/10 impacts and 0/170 by_stage; this would unblock at least WDP. See follow-up #3 in agent handoff.
- 🔜 **C-fb5 ground-truth backlog** — only 2/30 samples annotated. Priority: 2023 BC Wood ASTM family (CLT/GLT/SPF/SPF-Plywood — same format as Kalesnikoff, low risk, locks in coverage), EU/IBU Wood Fibre (different format, exercises EU/IBU paths), Lafarge cement (NSF format).
- 🔜 **Per-stage extension to other formats** — 18-36 cells per Sopra/Genyk/EU-IBU/2023 BC Wood is decent but could be improved by auditing which `_BYSTAGE_LABELS` patterns aren't matching and adding variants. Driven by ground-truth annotation.
- ✅ **"Export" row-dump button** (team request 2026-05-28, §17) — SHIPPED PR #20. Yellow bottom-right button → modal with the scraped record as a single TSV row in exact `BEAM Database-DUMP.csv` column order → Copy to clipboard. Built on `js/shared/beam-columns.mjs`.
- 🔜 **Export completeness — normalize + DB-side export** (decided 2026-05-29, spec in §18) — §17's button drops density + GWP because the candidate shape diverges from canonical (`density.value_kg_m3` vs `density.value`/`units`; `impacts.gwp` vs `carbon.stated.value_kgco2e`). Fix: `record-normalize.mjs` applied at Trust commit + export, then add an authoritative per-row TSV export to the Database viewer (carries the minted `beam_id`). Confirm the GWP→stated mapping (§18.4) before shipping. **Folded into §19 Phase 0 — clear before the bigger lifts.**
- ✅ **Parity B Pass-1 harness** (2026-06-08, §19) — SHIPPED `schema/scripts/csv-pdf-parity.mjs` + first run on Andy's ART Database (renamed from BEAM Database-DUMP 2026-06-08 — see §19.1) + 301-PDF Confirmed folder. Scope authored by Andy 2026-06-08 (§19.1.1 canonical 37-column EPD-extractable list). **Current headline: 37.1% aggregate parity** (5,235/14,100 matched cells, 0/671 rows at 100%) post Phase 0a + 1a + 1b + 1c + 2a–2m + W conditional skip. Per-field rank in `docs/workplans/parity-B/parity-summary.md` is the prioritized lift backlog. **Session lift: +27.6pp (+3,899 matches) toward the 50% target.**
- ✅ **§19 Phase 0a — `extractNA → extractCommon` move** (2026-06-08) — SHIPPED. Date / EPD-type / markets / validation patterns moved from `extractNA` to `extractCommon` so NSF / EPD-Intl / unknown formats see them. Lift: +176 matches (+1.2pp aggregate). Canonical-30 metadata 69.5% → 70.5%, 0 ground-truth regressions.
- ✅ **§19 Phase 1a — AY EPD ID shape-aware regex** (2026-06-08) — SHIPPED. Shape patterns for SmartEPD dotted-numeric, SCS-EPD, IBU `EPD-XXX-YYY-EN`, EPDITALY `YYYYMxxxxx`, BEPD, ITB/RTS, year-fractions before the loose label fallback. Lift: +299 matches (+2.1pp); 36.1% → 80.6% on AY. Canonical-30 71.0% (still clean).
- ✅ **§19 Phase 1b — six new admin/methodology extractors** (2026-06-08) — SHIPPED. BA Owner, BB Prepared by, BE Verifier, BH LCA Method, BI LCA Software, BJ LCI Database all moved off 0%. Manufacturer block moved to `extractCommon`. Lift: +125 matches (+0.9pp).
- ✅ **§19 Phase 1c — per-column comparison relaxations** (2026-06-08) — SHIPPED. Substring tolerance for org-name fields (BC/BF/BG/BA/BB/BE/BH/BI/BJ/J), year-prefix tolerance for G Expiry, case-insensitive default for non-unit fields. Metric correction reflecting semantic equivalence of variant BEAM forms — DB still receives parser's canonical form. Lift: +1,390 matches (+9.9pp). Per-field highlights: BI 10%→55%, BF 0%→46%, AZ 24%→46%, BE 3%→43%, BG 1%→42%, BC 23%→36%, G 22%→35%, J 2%→34%.
- ✅ **R extractor fix + probe-pdf tool** (2026-06-08) — SHIPPED. Declared-unit extractor was writing verbose product descriptions ("Roll Formed Metal Wall and Roof Panels…") as the unit when its normalization failed. Added a shape-anchored fallback (number + unit-token) so more rows get clean values; preserved the legacy raw-line fallback so canonical-30 §7.6 isn't regressed. New `schema/scripts/_probe-pdf.mjs` for the systematic PDF-probing methodology Andy directed: look up known BEAM values in their actual EPDs to discover *why* parser fails (rather than guessing regex shapes). First probe: N Country is prose-only in single-manufacturer EPDs and absent in industry-averages.
- ✅ **§19 Phase 2a — BK Service Life / O Markets / K Brand Name** (2026-06-08) — SHIPPED. Evidence-based extractors per §19.4.1 PDF-probe methodology. **BK 0% → 50%** (+84 matches, biggest win since AY: clean "Service Life: X years" / "Reference Service Life X years" / "service life ... is X years" / IBU "RLS" patterns). O extended with "Geographical validity/area/scope" + free-text fallback (+4 matches; BEAM's free-text region rarely matches parser's ISO arrays). K added with brand-line patterns (+1 match; BEAM-curated short forms vs EPD's longer brand strings). Lift: +89 matches (+0.6pp).
- ✅ **§19 Phase 2b — BB known-LCA-org / AL/AQ physical / W path normalization** (2026-06-08) — SHIPPED. **BB Prepared-by 3.6% → 28.9%** (+163 matches) via known-practitioner detection (Sphera, thinkstep, WAP, Ecoform, Vertima, Ecochain, EuGeos, Pré Consultants, Quartz, Athena, etc.) with proximity guard (org name within 80 chars of LCA/EPD/prepared keyword to suppress false positives). AL Thermal Conductivity (0% → 1.8%) shape-anchored on `X W/(m·K)` unit (domain-specific). AQ Depth (0% → 0.9%) labeled patterns with mm/cm/in/ft → meters conversion. W path normalization in harness parallel to §18 (parser's `impacts.gwp_bio_kgco2e.total.value` → DUMP's `carbon.biogenic.gwp_bio_from_epd_kgco2e_per_common_unit`) — didn't lift W in this run (parser rarely extracts impacts.gwp_bio for the 86 in-scope rows; orthogonal extractor work needed). Lift: +166 matches (+1.2pp).
- ✅ **§19 Phase 2c — AT substring tolerance + BA known-EPD-owner orgs** (2026-06-08) — SHIPPED. **AT Material Type 37.9% → 45.3%** (+29 matches) via substring tolerance — many BEAM types are supersets of parser's broader categories ("Clay Brick" ⊃ "Brick", "Cross-laminated timber" ⊃ "CLT"). BA known-EPD-owner detection added (UL Environment, NSF, ASTM International, CSA Group, IBU, Bau EPD GmbH, EPDITALY, ITB, AENOR, etc.) — didn't lift BA in this run (existing extractor + substring already catches the BEAM-matchable cases). Lift: +29 matches (+0.2pp).
- ✅ **§19 Phase 2d — N Country prose extractor + N/O substring tolerance** (2026-06-08) — SHIPPED. **N Country 0% → 25.3%** (+123 matches) via proximity-anchored country-name prose extractor (50+ country names near "located in" / "manufactured in" / "produced in" / "facility in" / "plant in" / etc.) with ISO-3 mapping output. Substring tolerance added to N (BEAM "Canada" ⊃ parser "CAN") and O (+30 matches via partial overlap on "US & CA" type strings). Lift: +153 matches (+1.1pp).
- ✅ **§19 Phase 2e — R declared-unit normalization in harness** (2026-06-08) — SHIPPED. **R GWP units 0% → 42.3%** (+284 matches) via `unitNorm` relaxation: case-fold + ³→3/²→2 + strip leading `"1 "` quantity prefix + `cubic met[er|re]` → `m3` / `square met[er|re]` → `m2` + substring tolerance. Metric correction (same semantic fact, divergent representations) — BEAM stores bare short form (`m3` / `m²` / `kg`), parser captures EPD's prose (`1 m³` / `1 cubic meter` / `The declared unit is 1 cubic metre of ready mixed concrete…`). `metric ton` deliberately NOT collapsed with `kg` (1 t ≠ 1 kg). Lift: +284 matches (+2.0pp), R from worst-ranked field to 10th-best.
- ✅ **CSV gold-standard swap** (2026-06-08, commits `25a901d` + `c78e760`) — `BEAM Database-DUMP.csv` renamed to `ART Database - Materials.csv` (Andy's new export). +5 rows (ART001-004 Mutual Materials per-plant brick breakdowns + RRR117). 1:1 file-line ↔ spreadsheet-row alignment via csv.reader-based cleanup; trailing 753 Sheet-padding rows trimmed. Runtime importer (`schema/scripts/beam-csv-to-json.mjs` `CSV_PATH` + `imported_from` stamp), parity harness (`csv-pdf-parity.mjs` `DEFAULT_CSV`), `CLAUDE.md`, `beam-columns.mjs` docstring, `epdparser.mjs` §17 comment all swapped. Per-record `imported_from` fields in `schema/materials/*.json` left as historical fact. Parity-B holds at 28.7% across the rename (the 5 new rows don't add scored EPDs yet).
- ✅ **§19 Phase 2f — AK R-value/inch + AL Thermal Conductivity + numericApprox relaxation** (2026-06-08) — SHIPPED. **AK R-value/inch 0% → 10.8%** (+14 matches), **AL Thermal Conductivity 1.8% → 12.4%** (+12 matches). Andy's rule (`R = RSI × 5.678`; equivalently `R/inch ≈ 0.1442/λ`) implemented as a 3-tier AK extractor: (1) direct "R-N per inch" / "R-N/inch" shape patterns (catches Foamular-style EPDs that state R-5 per inch literally); (2) compute from λ when AL extracted (R/inch = 0.1442/λ); (3) skipped — back-calculate from RSI + thickness is BfCA judgment (industry-average EPDs cover multiple thicknesses; BEAM picks a representative one, parser can't). AL pattern extended for labeled forms without inline unit ("λ = 0.034", "lambda 0.034", "k-value 0.038") — common in IBU/EU declaration tables where the unit lives in a column header. Harness gets new `numericApprox` relaxation (±5% relative + 0.01 absolute) for AK/AL, mirroring R's `unitNorm` precedent: BEAM hand-picks rounded numbers, parser computes precise ones; agreement within 5% is the right semantic. Lift: +26 matches (+0.2pp). Ceiling capped by BfCA-derivation semantics — most industry-average insulation EPDs don't declare a single λ for the parser to consume.
- ✅ **§19 Phase 2g — AZ EPD Type unanchored detection + trade-association rule** (2026-06-08) — SHIPPED. **AZ EPD Type 45.6% → 50.7%** (+34 matches, +5.1pp on AZ alone). Three new tiers extend the prior anchored-prose fallback: (2g-a) unanchored "industry-average" / "industry-wide" / "production-weighted industry average" in head≤80 lines with FP-context guards (suppress when context is "data" / "EPDs" / "studies" / "comparison" / "of the products" — the keyword refers to reference data, not this EPD's type); (2g-b) unanchored "product/company/manufacturer/plant/facility-specific" keyword in head; (2g-c) known trade-association publishers in head≤100 (American Galvanizers Association, ARMA, SPRI, NRMCA, PIMA, AWC, CWC, CRSI, SDI, APA, NAPA, AISI, PCA, NAIMA, etc.) — these issue EPDs covering their members' aggregate production, by definition industry-average. Probes that designed this: Galvanized Steel (AGA + "industry average" L51-62), Modbit Cold Adhesive (ARMA L6), EPDM (SPRI L5-6). Canonical-30 metadata 71.4% → 72.4% (+1.0pp) — the new patterns also help calibration samples, no GT regressions. Ceiling: French FDES / non-English EPDs remain undetected (no English type keyword in body — needs separate prose patterns).
- ✅ **§19 Phase 2h — G EPD Expiry compute-from-duration + French FDES + MM-YYYY harness** (2026-06-08) — SHIPPED. **G EPD Expiry 34.6% → 69.6%** (+235 matches, +35.0pp on G alone — the biggest single-phase lift since Phase 1c). G went from 11th-ranked to 2nd-best field. Three changes: (a) new explicit-label patterns in `extract.mjs` — "Date of validity" / "Validity date" / "Validity period" / "Date of expir(y\|ation)" / "Date de validité" (French FDES) — gets Earth block, Cycle Terre families; (b) compute-from-duration fallback when explicit expiry not stated — when `publication_date` + "Period of Validity N Years" / "Validity Period N years" / "Valid for N years" / "5 ans" (French) both present, computes expiry = issue + N years. Catches the UL Environment NA EPD standard pattern (Galvanized Steel "DATE OF ISSUE September 22, 2016" + "PERIOD OF VALIDITY 5 Years" → 2021-09-22, EPDM, Modbit, etc.); (c) MM-YYYY harness relaxation — BEAM stores 20 rows as "MM-YYYY" (e.g., "01-2022"), parser gives "2022-01-06"; rearrange + prefix-match. Canonical-30 metadata 72.4% → 73.6% (+1.2pp). Bounds: 1-50 years on duration (rejects 0 and weirdness).
- ✅ **§19 Phase 2i — N Country address/state/EU-language fallbacks** (2026-06-08) — SHIPPED. **N Country 25.3% → 57.3%** (+156 matches, +32.0pp on N alone). N went from 17th-ranked to 4th-best field. Four new tiers fire after the existing proximity-anchored extractor: (2i-a) "facility/plant/production in `<City>, <ST/PROV>`" comma-anchored 2-letter state/province codes (catches Arcadia "manufacturing plants in Vernon, CA" and Boehmers CMU "facility in Kitchener, ON"); (2i-b) full Canadian province names in facility context (Alberta, British Columbia, Manitoba, Ontario, Quebec/Québec, etc.); (2i-c) postal-code-anchored country (Canadian A1A 1A1 + "Canada" / US ZIP + "USA" — catches raw address blocks like "Ottawa, Ontario, K1Y 0N6, Canada"); (2i-d) French/German production language ("fabriqués en France" / "Sites de fabrication situés en France" / "hergestellt in Deutschland" — catches Earth block FDES, Cycle Terre, BAU-EPD families). All scoped to head≤150 lines. Canonical-30 metadata stayed at 73.6%, 0 GT failures.
- ✅ **§19 Phase 2j — O Markets geography-token comparison** (2026-06-08) — SHIPPED. **O Markets 5.1% → 34.9%** (+198 matches, +29.8pp on O alone) + **N Country 57.3% → 65.9%** (+42 matches as a side-effect of switching N to the same relaxation). Two coordinated changes: (a) extractor geography-token guard — `_looksLikeGeography()` helper rejects captured "Geographical scope" values that contain only sector text ("Construction Sector", "Residential", "LCA Software LCI Databases LCIA Methodology"). Probes showed many EPDs use "Geographical scope" as a generic heading followed by application-context content, not geography. The guard prevents these from blocking later correct-pattern matches; (b) harness `marketTokens` relaxation — tokenize both sides into canonical ISO-like codes (US/USA/United States → USA; CA/CAN/Canada → CAN; EU/Europe → EU; NA/North America → {USA, CAN}; etc.) and compare as sets (subset match counts — BEAM "CA" semantically matches parser "CAN, USA"). Top mismatch BEAM='US & CA' vs parser='CAN, USA' (173 cases) all flip to MATCH. Both N and O are now on `marketTokens`. Canonical-30 metadata stayed at 73.6%. Aggregate 31.9% → 33.6% (+1.7pp / +240 matches).
- ✅ **§19 Phase 2k — Multi-field org-name vocabulary extensions** (2026-06-08) — SHIPPED. Aggregate **33.6% → 35.3%** (+1.7pp / +233 matches). Five field lifts: (a) **BB Prepared by 28.9% → 53.2%** (+156 matches, biggest in the phase) — extended `LCA_PRACT` list with UL Environment / ASTM International / SCS Global / CORRIM / NIBE / Intertek Sustainability / Smart EPD / Thünen-Institut; (b) **BJ LCI Database 26.3% → 36.7%** (+32 matches) — added `GaBi <year>(.<sub>)` shape match catching "GaBi 2021" / "GaBi 2020.2" / "GaBi 2019.3" plus DATASMART / US-EI variants — these dominated parser-empty buckets; (c) **BE Verifying Agent 42.7% → 46.5%** (+19 matches) — new `VERIFIERS` known-org block parallel to BB pattern (proximity guard on "verif"/"independent"/"third-party" keyword) catches Industrial Ecology Consultants / Thomas P. Gloria / Jack Geibig EcoForm / James Mellentine Thrive ESG; (d) **BH LCA Method 33.8% → 37.3%** (+14 matches) — bare TRACI / CML / ReCiPe / IPCC tool-name shape matches (domain-specific, low FP risk); (e) **BA EPD Owner 13.2% → 15.5%** (+12 matches) — extended `BA_KNOWN` with American Institute of Steel Construction (AISC) / EPS Industry Alliance / Soprema / Nucor / Malarkey Roofing / NAIMA / CRSI / PIMA / AWC / CWC. Probes designed each list from the parser='' buckets in the prior parity-summary. Canonical-30 metadata stayed at 73.6%.
- ✅ **§19 Phase 2l — BC operator vocab + BF standardCodes harness** (2026-06-08) — SHIPPED. Aggregate **35.3% → 36.3%** (+1.0pp / +142 matches). Two field lifts: (a) **BF EPD Standards 45.5% → 74.2%** (+80 matches, +28.7pp on BF alone — BF jumped from 8th to 2nd-best field) — new harness `standardCodes` relaxation tokenizes ISO/EN/ASTM citations with version-suffix stripping and whitespace normalization. BEAM "ISO 21930:2017" semantically matches parser's full list "ISO 14025, ISO 21930, EN 15804+A2" via subset comparison; also handles "ISO 14025: 2006" (space before year) and version-suffix mismatches; (b) **BC EPD Program/Operator 35.8% → 47.9%** (+62 matches, +12.1pp) — extended `_detectProgramOperator` with Smart EPD / NSF Certification LLC / International EPD System / EPD Hub / EPDItaly / Building Information Foundation RTS / Danish Technological Institute / AFNOR / SCS Global Services / Ecoform / NIBE. Initially hit a canonical-30 GT failure on Kalesnikoff GLT (Athena detection overrode ASTM); fixed by keeping Athena out of `_detectProgramOperator` (it's an LCA practitioner, not a program operator). Canonical-30 metadata 73.6% (unchanged), 0 GT failures.
- ✅ **§19 Phase 2m — Q unit-conversion harness + AZ French FDES** (2026-06-08) — SHIPPED. Aggregate **36.3% → 37.1%** (+0.8pp / +120 matches). Two changes: (a) **Q Stated GWP 8.2% → 25.8%** (+118 matches, +17.6pp on Q alone) — new harness `qConvert` relaxation tries 1:1 match first, then ±5% numericApprox, then a **1000× ratio match** (handles per-kg ↔ per-metric-ton unit mismatches). Catches the steel/HSS EPD family (4789556099.102.1, 43 rows of BEAM `1.22` per kg vs parser `1220` per metric ton — all 43 flip to MATCH). This was a **partial multi-product unlock**: that EPD's 43 BEAM rows are the SAME material at different size specs, so the per-product field is uniform per row. Concrete EPDs (CRMCA family) still have genuine multi-variant per-row Q values requiring the §14 LLM-as-parser path; (b) **AZ EPD Type +2 matches** — French FDES patterns "Type de FDES Collective" → industry_average and "Type de FDES Individuelle" → product_specific. Earth block EPDs caught.
- 🔜 **Phase 2 continued — systematic PDF probing for remaining 0% fields** — I Material, L Specifications, AI/AJ Additional factor, AM-AS Dimensions/mass, K Brand Name. Each gets its own evidence-based extractor via §19.4.1 playbook.
- 🔜 **Phase 3 — true multi-product extraction (CRMCA concrete family)** — the remaining 18×9 = 162 BEAM rows under concrete EPDs (EPD 347-352, 10092, 10294) have genuine per-variant Q values from multi-column impact tables. Without LLM-as-parser, would need column-walking regex per format family. Bounded upside: ~+100-200 cells if achieved.
- ✅ **W conditional skip — Andy's biogenic rule** (2026-06-08) — SHIPPED. Steel/inorganic EPDs don't carry biogenic values, so W is skipped from the parity denominator on rows whose PDF text doesn't contain "biogenic". 3 rows skipped in current run.
- 🔜 **§19 Phase 0b — §18 normalization in extractor** — commit `density.value_kg_m3 → value + units` + `impacts.gwp → carbon.stated.value_kgco2e` maps into `extract.mjs` (or the capture boundary). Pending §19.5 Mel confirmation on GWP target slot. Doesn't change Parity-B numbers (harness already normalizes) but unblocks Goal-B form expansion.
- 🔜 **§19 Phase 1 remainder — string-normalization wins** — AZ EPD Type vocab (24.4%→target 60%), BC Operator (23.4%→target 60%), AT Material Type (37.7%→target 70%), G Expiry date formats (22.1%→target 50%+), O Markets, BF Standards, BG PCR. Target additional lift ≈ +1,500 matches → cumulative ≈ **24%**.
- 🔜 **§19 Phase 3 — multi-product extraction** (§16.1 Follow-up #4) — the single biggest unlock; **gets us to the 50% headline target**. Per-product values (density, GWP, dimensions) currently match at most 1 of N rows under each multi-product EPD. Likely needs the §14 LLM-as-parser path.
- ⏳ **P4 — Match-status surfacing** (`NEW` vs `REFRESH → <id>`) on the EPD-Parser form banner — Database-side dupe detection now does this server-side; form-side preview is a UX enhancement.
- ⏳ **Multi-product EPD disambiguation** (Genyk 3 SPFs, Lafarge 6 cement types, AWC/CWC industry-avg). UI work in the form pane. ~3-4 hrs.
- ⏳ **P6 — Refresh queue** (DB-driven entry point for expired-record backlog).
- ⏳ **P7 — Coverage hardening** (OCR fallback for 3 Sopra family scanned EPDs + Polyiso + Hemlock no-EPD docs in the calibration set, multi-EPD bulk upload).

**Note:** `P5 — Auto-save to pending queue` from the original phases list was absorbed into `P2 — UX scaffold` and shipped 2026-04-25. The phase numbering predates the actual ship sequence; §7 below annotates each phase with its current status.

---

## 1. Problem

The materials database ships sparse: 821 records imported once from the BEAM CSV dump. Two gaps:

1. **New EPDs.** A manufacturer publishes a CSA- or IBU-issued EPD that wasn't in the original dump. Today the only path to add it is hand-editing the relevant `schema/materials/*.json` file or roundtripping through the CSV importer.
2. **Refreshed EPDs.** A 5-year-validity EPD expires; the manufacturer publishes a successor with updated impact numbers. Same hand-edit problem, plus the risk of silently overwriting fields that were carefully set in the original record (e.g. `classification.typical_elements[]`, locale-specific notes).
3. **Backlog of already-expired records.** Many of the 821 BEAM-imported records carry `epd.expiry_date` values that have already passed. Maintaining the database means systematically working through these — finding the manufacturer's successor EPD (often via web search of the program-operator's public registry), fetching the PDF, and routing it through the same ingest pipeline. EPD-Parser needs a refresh-queue entry point alongside the drag-drop one (see §7 P6).

EPD-Parser closes all three gaps with a browser-side ingest tool that produces a candidate JSON record, matches it against the existing DB, and presents a review UI before any commit.

**Audience.** EPD-Parser is an **internal back-office tool** for the BfCA team to maintain the materials database, not a public end-user app. Public users of OpenBuilding interact with BEAMweb (the calculator); the database viewer and EPD-Parser are development/maintenance utilities. The current landing page exposes all five cards because the project is in active development; production deployment may auth-gate or omit the back-office tools from the public landing — out of scope for v1.

The parser is **text-only** — EPD PDFs are generally published with selectable text layers, and the value of the tool is in the structured-data extraction, not in any geometric work. Scanned PDFs are a v2 concern.

## 2. Strategy

1. **Reuse PDF-Parser's PDF infrastructure verbatim.** pdf.js loader, canvas viewer, file-drop lifecycle, IndexedDB project persistence — all carry over. Drop everything geometric (polygons, scale calibration, rulers, magic-wand, oculus, sheet classifier).
2. **One source of truth for normalization.** The CSV importer at [`schema/scripts/beam-csv-to-json.mjs`](../../schema/scripts/beam-csv-to-json.mjs) already encodes group inference, country-code mapping, expiry-date heuristics. Refactor those into a shared module both the CSV path and the EPD path consume — never two implementations of `inferGroupPrefix`.
3. **Schema-complete, sparse output.** Emit the full nested impact matrix (10 indicators × 17 lifecycle stages = 170 slots) with `null` for unset values, matching the existing record shape. Validate against [`schema/material.schema.json`](../../schema/material.schema.json) before showing the review UI.
4. **Two commit pathways, both human-gated.**
   - **Create new** — no DB match → review UI shows the parsed record alone → user confirms → write a fresh entry.
   - **Update existing** — DB match found → side-by-side diff (current vs incoming) → user picks per-field (overwrite / keep / merge-into-array) → commit.
5. **No browser-side write to `schema/materials/*.json`.** Pages serves source data read-only. EPD-Parser produces a candidate record + audit metadata and **hands off** to the database viewer, which is the single point of commit (see [`Database.md`](Database.md)). The DB viewer collects pending changes from any source (EPD-Parser, future manual edits, future bulk-imports) into one queue, applies user decisions, and emits patch JSON the team applies via a Node script + git in the normal way.
6. **Single source of truth for state.** Both EPD-Parser and the database viewer read/write through the same shared IndexedDB store ([`js/shared/indexed-db-store.mjs`](../../js/shared/indexed-db-store.mjs)). One `pending_changes` table, one `committed_patches` table — never two implementations of the same state. (Andy's standing rule: SST beats redundant intermediates.)

## 3. Architecture

Two-pane shell — PDF on the left, full schema-shape edit form on the right. Lays the canvas viewer next to a 60-row form so every field of `material.schema.json` is visible and editable as the parser populates it.

```
┌─ toolbar ─────────────────────────────────────────────────────────────────────────────┐
│ [Drop EPD]  [Extract]  page 1/N  zoom ◇   ↗ Open Database to commit          [Home]   │
├──────────────────────────────────────────────┬────────────────────────────────────────┤
│                                              │ ┌ Match status ────────────────────┐  │
│                                              │ │ ⚠ Match found: lam011             │  │
│                                              │ │   PCR ✓  URI ✓  scope ✓  → REFRESH │  │
│         rendered EPD page (canvas)           │ └───────────────────────────────────┘  │
│         pdf-loader + canvas-viewer           │ ┌ Schema record (editable) ────────┐  │
│         zoom/pan/page-nav same as            │ │ id .................. lam011      │  │
│         PDF-Parser                           │ │ manufacturer.name ... Nordic      │  │
│                                              │ │ manufacturer.country_code . CAN   │  │
│                                              │ │ naming.display_name . Cross-Lam…  │  │
│                                              │ │ naming.product_brand_name . X-Lam │  │
│                                              │ │ classification.group_prefix . 06  │  │
│                                              │ │ classification.material_type … CLT│  │
│                                              │ │ epd.id ............. 5960-4998    │  │
│                                              │ │ epd.program_operator . CSA        │  │
│                                              │ │ epd.source_document_url . https…  │  │
│                                              │ │ epd.publication_date . 2023-01-15 │  │
│                                              │ │ epd.expiry_date .... 2028-12-31   │  │
│                                              │ │ methodology.pcr_guidelines …      │  │
│                                              │ │ physical.density.value_kg_m3 . 456│  │
│                                              │ │ impacts.gwp_kgco2e.total.value …  │  │
│                                              │ │ impacts.gwp_kgco2e.by_stage.A1 .  │  │
│                                              │ │ … (all 65+ fields, scrollable) …  │  │
│                                              │ │ ─── audit ───                     │  │
│                                              │ │ provenance.review_audit[]         │  │
│                                              │ │   editor: andy@bfca               │  │
│                                              │ │   date:   2026-04-25T19:42Z       │  │
│                                              │ │   action: epd-parser-extract      │  │
│                                              │ │   source: 2023 BC Wood CLT EPD…   │  │
│                                              │ └───────────────────────────────────┘  │
│                                              │ Auto-saved to pending queue · ↗ Open  │
│                                              │ Database viewer for Trust / Verify     │
└──────────────────────────────────────────────┴────────────────────────────────────────┘
```

Layout target: roughly 50/50 split (PDF pane / form pane), with the form pane scrollable. PDF pane stays fixed-position so the user can scroll the form while keeping the document visible for cross-reference.

Form fields are editable — the user can correct any extraction error before commit. The reviewer-stamp row at the bottom of the form (an entry appended to `provenance.review_audit[]`) is auto-populated with `editor` (configured per-team-member, persisted in `localStorage`), `date` (ISO timestamp), `action` (`epd-parser-extract`, `manual-edit`, etc.), and `source` (the EPD PDF filename). The user can edit these.

**EPD-Parser is a pure data producer** — same shape as the existing PDF-Parser → BEAM bridge ([`js/beamweb.mjs:519`](../../js/beamweb.mjs#L519), [`beamweb.html:90-103`](../../beamweb.html#L90-L103)). PDF-Parser saves project state to IndexedDB during normal use; BEAMweb has the **Trust** / **Trust + Verify** buttons that pull from it. EPD-Parser does the same: as the user edits fields in the form pane, the candidate record + audit metadata auto-save (debounced) to the shared `pending_changes` IndexedDB table. **No "send" or "commit" button lives on this side.** The user opens the Database viewer (toolbar link "↗ Open Database to commit") where the Trust / Trust + Verify buttons act on the queued entry. See [`Database.md`](Database.md) §4 + §5.

## 4. Reusable plumbing

Concrete file paths from the PDF-Parser inventory. Each is reused as-is unless flagged.

| File                                                                                             | Reused for                                                                  | Notes                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`js/pdf-loader.mjs`](../../js/pdf-loader.mjs)                                                   | PDF load + page render + `getTextContent()`                                 | Wholesale. Drop `getOperatorList()` (vector-geometry only).                                                                                                              |
| [`js/canvas-viewer.mjs`](../../js/canvas-viewer.mjs)                                             | Canvas pair + zoom/pan                                                      | Strip the polygon-overlay draw callback.                                                                                                                                 |
| [`js/app.mjs:144–193`](../../js/app.mjs)                                                         | File-drop + `_loadFile` lifecycle pattern                                   | Copy the pattern, not the file — `app.mjs` is PDF-Parser-specific.                                                                                                       |
| [`js/shared/indexed-db-store.mjs`](../../js/shared/indexed-db-store.mjs)                         | Per-project autosave + restore                                              | Pattern reuse; project shape differs (no pages array, no polygons — instead `epdSourceFile`, `extractedFields`, `matchedRecordId`, `commitDecisions`).                   |
| [`schema/scripts/beam-csv-to-json.mjs`](../../schema/scripts/beam-csv-to-json.mjs)               | `makeId`, `normaliseCountry`, `inferGroupPrefix`, `yearOrSerialToExpiryIso` | **Refactor.** Extract these into a shared module (`schema/scripts/lib/normalize.mjs` for Node + a browser ESM mirror for the parser). One implementation, two consumers. |
| [`schema/scripts/validate.mjs`](../../schema/scripts/validate.mjs)                               | Live schema validation in the review UI                                     | Already zero-dep. Wrap as ESM, expose `validateRecord(record, schema)` returning `{ok, errors[]}`.                                                                       |
| [`schema/lookups/material-groups.json`](../../schema/lookups/material-groups.json)               | Group-prefix → label mapping                                                | Read at startup.                                                                                                                                                         |
| [`schema/lookups/material-type-to-group.json`](../../schema/lookups/material-type-to-group.json) | Material-type → 2-digit prefix                                              | Primary inference.                                                                                                                                                       |
| [`schema/lookups/display-name-keywords.json`](../../schema/lookups/display-name-keywords.json)   | Display-name → group fallback                                               | Used when material-type lookup misses.                                                                                                                                   |
| [`schema/lookups/country-codes.json`](../../schema/lookups/country-codes.json)                   | Free-text country → ISO 3166-1 alpha-3                                      | Manufacturer + provenance.                                                                                                                                               |
| [`schema/lookups/lifecycle-stages.json`](../../schema/lookups/lifecycle-stages.json)             | A1–D canonical order + scope presets                                        | Validate stage arrays; understand cradle-to-gate vs cradle-to-grave.                                                                                                     |
| [`schema/lookups/typical-elements.json`](../../schema/lookups/typical-elements.json)             | Building-element enum + product_subtype overrides                           | Inferred from the EPD's product description.                                                                                                                             |

### CSS

No new sections in [`bfcastyles.css`](../../bfcastyles.css). EPD-Parser reuses §5 (PDF-Parser shell), §3 (toolbar primitives), §4 (status chips, table styles, button language), with at most a small EPD-specific subsection if the side-by-side diff view needs custom rules.

### HTML page

`epdparser.html` at repo root, modeled on [`pdfparser.html`](../../pdfparser.html). Add `<html class="theme-dark app-pdfparser app-epdparser">` so existing PDF-Parser rules apply by default; add a narrow `.app-epdparser` override block in `bfcastyles.css` only for fields the geometry UI doesn't have.

### Deploy

[`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml) line 47 — append `epdparser.html` to the `cp` list **only when the page actually exists**, not before.

## 5. Schema mapping

Source: [`schema/material.schema.json`](../../schema/material.schema.json). Reference complete record: [`schema/sample.json`](../../schema/sample.json) (lam011, Nordic CLT — every field populated, every nested impact slot present).

| EPD-PDF section (typical heading)                                                 | Schema target                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Declaration holder / Manufacturer                                                 | `manufacturer.name`, `manufacturer.country_code`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Product description                                                               | `naming.display_name`, `naming.product_brand_name`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| EPD identification (EPD number, programme operator, dates)                        | `epd.id`, `epd.program_operator`, `epd.publication_date`, `epd.expiry_date`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| EPD type (product-specific / industry-average / generic)                          | `epd.type` (enum: `product_specific` \| `industry_average` \| `generic` \| `beam_average`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Verification statement                                                            | `epd.validation.type` (enum: `internal` \| `external` \| `null`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Declared / functional unit                                                        | `carbon.stated.per_unit`, `carbon.common.per_functional_unit`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Density / mass per declared unit                                                  | `physical.density.value_kg_m3` (with `source: "epd"`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| LCA results table — GWP total                                                     | `impacts.gwp_kgco2e.total.{value, source}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| LCA results table — GWP biogenic                                                  | `impacts.gwp_bio_kgco2e.total.{value, source}`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LCA results table — per-stage values (A1, A2, A3, A1–A3, A4, A5, B1–B7, C1–C4, D) | `impacts.<indicator>.by_stage.<stage>.{value, source}` — emit all 17 stage slots even if null                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Other indicators (ODP, AP, EP, POCP, ADP, WDP, primary energy NR + R)             | `impacts.{ozone_depletion, acidification, eutrophication, smog, abiotic_depletion_fossil, water_consumption, primary_energy_nonrenewable, primary_energy_renewable}.*`                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Methodology / standards                                                           | `methodology.standards[]`, `methodology.lca_method`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **PCR (Product Category Rules) reference**                                        | `methodology.pcr_guidelines` — free-text string (e.g. "ULE Structural and architectural wood products, v1.1"). Treated as a **first-class match key** in §6. Two EPDs published under different PCRs (or different PCR versions) are not directly comparable and cannot refresh each other.                                                                                                                                                                                                                                                                                                                |
| LCA software                                                                      | `methodology.lca_software`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| LCI database (e.g. ecoinvent 3.x)                                                 | `methodology.lci_database`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Geographic scope / markets                                                        | `provenance.countries_of_manufacture[]`, `provenance.markets_of_applicability[]` — also a match key in §6. CA-scope and US-scope EPDs of the same product are **separate records**, never merged.                                                                                                                                                                                                                                                                                                                                                                                                          |
| (Derived) group classification                                                    | `classification.group_prefix`, `classification.category_slug`, `classification.material_type`, `classification.typical_elements[]`                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **BEAM ID** (DO NOT confuse with `epd.id` or `methodology.pcr_guidelines`)        | `beam_id` — BfCA-internal record key, 6-character `GG####` format from 2026-04-27 onwards (see §5.5 below). NEVER populate this slot with the PCR document number or the EPD registration number — those have their own dedicated fields. The legacy Google-Sheets-based BEAM tool relied on this ID; the existing 821 records keep their historical IDs (e.g. `lam011`, `EPD295`, `4788424634.107.1` — heterogeneous because they came from the BEAM CSV dump) for legacy audit traceability.                                                                                                             |
| **Lifecycle / soft-delete state**                                                 | `status.{listed, do_not_list, is_industry_average, is_beam_average, visibility}` — already in the schema and already in production use (43 of 821 records carry the soft-hide combo). Existing `visibility` enum is `public \| hidden \| deprecated`; **a small extension adds `flagged_for_deletion` plus a sibling `status.deletion_note: string` field** (proposed in [`Database.md`](Database.md) §3). EPD-Parser sets `status.visibility = "public"` on new records; refreshes preserve the existing `status` block unless the user explicitly re-flags. **Hard delete is forbidden.**                |
| **Reviewer / editor audit**                                                       | `provenance.review_audit[]` (proposed — append-only array of `{editor, date, action, source}` entries, one per edit). Auto-populated at hand-off with the team-member name (from `localStorage`), ISO timestamp, action verb (`epd-parser-extract`, `manual-edit`, `flag-for-deletion`, `restore`), and EPD source filename. Existing `provenance.data_added_or_modified` (free-text date string) and `provenance.import_metadata.{imported_from, import_date}` stay populated where they are; the new array is the structured trail going forward. Schema bump scoped in [`Database.md`](Database.md) §3. |

**Group classification is inferred, not extracted.** Run `inferGroupPrefix(material_type, display_name)` against [`material-type-to-group.json`](../../schema/lookups/material-type-to-group.json) first, falling back to [`display-name-keywords.json`](../../schema/lookups/display-name-keywords.json). If both miss, the field stays null and the review UI flags it for manual selection.

### 5.5. ID conventions — `beam_id` vs `epd.id` vs `methodology.pcr_guidelines`

These three fields look superficially similar (all are short identifiers tied to a record) but mean very different things. Confusing them at extraction time would break the legacy audit trail, the §6 match algorithm, and the BEAMweb picker. Discussed with the BfCA team 2026-04-27.

| Field                        | What it is                                                                                                                                                                                                               | Source                                                                                                                                                                    | Convention                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `beam_id`                    | **BfCA-internal record key** — the primary key BEAMweb (and the legacy BEAM Google-Sheet) uses to reference materials. Stable for the life of the record; survives EPD refreshes; chosen by BfCA, not the EPD publisher. | **Minted by BfCA** when a new record is committed via the Database viewer. Never extracted from the EPD.                                                                  | **6-char `GG####` format going forward** (decision 2026-04-27). `GG` = the 2-digit `classification.group_prefix` (`03` concrete, `06` wood, `07` thermal, etc.); `####` = 4-digit zero-padded counter, continuing on top of the existing 821 records. First new wood entry → `06####` where `####` increments from the highest existing wood-group counter. Existing 821 records keep their **legacy heterogeneous IDs** (`lam011`, `EPD295`, `4788424634.107.1`, `S-P-08118`, …) for legacy audit traceability — do **not** rewrite them. |
| `epd.id`                     | **EPD publisher's registration number** for this specific declaration. Changes when the EPD is refreshed or re-issued. Chosen by the EPD program operator, not BfCA.                                                     | **Extracted from the EPD PDF** by P3. Examples: `EPD 395` (ASTM), `S-P-10278` (EPD International), `4788424634.107.1` (UL Environment), `EPD-GTX-20200178-IBC1-EN` (IBU). | One of the six §6 strict-match keys. Never reused as `beam_id`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `methodology.pcr_guidelines` | **Citation of the Product Category Rules document** the LCA was conducted under. A document title + version, not an identifier.                                                                                          | **Extracted from the EPD PDF** by P3. Example: `Structural and Architectural Wood Products EPD Requirements, v1.0` (Part B sub-category PCR for the BC Wood CLT EPD).     | One of the six §6 strict-match keys. Never reused as `beam_id` or `epd.id`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**P3 implementation note for the parser:** `js/epd/extract.mjs` extracts `epd.id` and `methodology.pcr_guidelines` directly. **It must never touch `beam_id`** — that field stays `null` on the candidate record. Minting happens at the Database viewer's commit step (D5/D7) where `makeId(group_prefix, group_counter)` produces the `GG####` value. The auto-increment counter per group lives in a small ledger written alongside `schema/materials/index.json` (or computed at commit time as `max(existing GG#### in group) + 1`). Out of scope for v1; flagged so it doesn't get accidentally implemented as a regex anchor.

**No IP-restricted terminology** — `CSI`, `MasterFormat`, `Division`, `MCE²`, `NRCan`, Crown-copyright tool names — appears in the parser, the UI strings, the emitted JSON, or this workplan. Numeric `group_prefix` (`03`, `06`, `09`, `31`, …) is the only classification convention used.

### 5.6. Taxonomy + extraction order — coarse-to-granular ("trunk of tree first")

Andy 2026-04-27: _"It makes sense from a human perspective to sort by the 'game of categories' to determine the material properties as a tree, starting with Group, then type, then manufacturer, then provenance, then finally properties, GWP being among them."_ And: _"the taxonomy is important because many of the properties may differ or not be available in all EPDs, but general information, trunk-of-tree level info should be available on ALL EPDs, which is why we should fill out the coarse, and move to granular."_

The current `js/epd/extract.mjs` is **flat**: probes are independent regexes that run in arbitrary source-order and don't depend on each other's outputs. This is correct for runtime (probes are independent) but wrong for the user-facing mental model and for prioritising which fields _must_ succeed across the full sample set.

**The taxonomy below defines BOTH** the form-pane section order in `epdparser.html` (so the user reads top-down: classify → identify → locate → measure) **AND** the extraction-pass order in `extract.mjs` (so coarse fields fill before granular ones; later passes can use earlier-extracted values as inputs).

| Tier  | Tree level                                                                         | Schema fields                                                                                                                                                                                                                                                 | Extraction approach                                                                                                                                                                                                                                                                                                                                                                                                     | Generality                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1** | **Group**                                                                          | `classification.group_prefix`                                                                                                                                                                                                                                 | **Inferred** from material_type + display_name via [`schema/lookups/material-type-to-group.json`](../../schema/lookups/material-type-to-group.json) and [`schema/lookups/display-name-keywords.json`](../../schema/lookups/display-name-keywords.json). Never regex-extracted. **Today: not wired** — always `null`. **TODO: hook `inferGroupPrefix(material_type, display_name)` after Tier 2 extracts those values.** | Trunk-of-tree. Should populate on EVERY EPD once Tier 2 succeeds.                                                                                      |
| **2** | **Type / display name**                                                            | `classification.material_type`, `naming.display_name`, `naming.product_brand_name`                                                                                                                                                                            | Regex against the cover-page product description ("Cross-Laminated Timber", "Cement", "Spray Polyurethane Foam Insulation"). Today: `naming.display_name` not extracted explicitly. **TODO: extract from page-1 title block + map known phrases via a small keyword vocabulary.**                                                                                                                                       | Trunk. Every EPD has a product description.                                                                                                            |
| **3** | **Manufacturer + country**                                                         | `manufacturer.name`, `manufacturer.country_code`                                                                                                                                                                                                              | Regex against `Declaration Holder` / `EPD Commissioner and Owner` / `Owner of the Declaration` / `Manufacturer name and address`. Country via [`schema/lookups/country-codes.json`](../../schema/lookups/country-codes.json) lookup on the address line. Today: name extracts on most NA + NSF samples; country rarely extracted.                                                                                       | Coarse. Industry-average EPDs may have a trade-association name instead of a manufacturer — see §8 open question.                                      |
| **4** | **Provenance / scope**                                                             | `provenance.markets_of_applicability[]`, `provenance.countries_of_manufacture[]`                                                                                                                                                                              | Regex against `Markets of Applicability` / `Region covered`. ISO-code normalisation via the country-codes lookup. Today: thin coverage.                                                                                                                                                                                                                                                                                 | Coarse. Most EPDs declare a market scope; some imply it from the manufacturer's address.                                                               |
| **5** | **Identification** (EPD ID, dates, program operator, type, validation, source URL) | `epd.{id, program_operator, publication_date, expiry_date, type, validation.type, source_document_url}`                                                                                                                                                       | Format-specific regex per family (`extractNA` / `extractEpdIntl` / `extractNSF`). Program operator via `_detectProgramOperator()` name match across formats.                                                                                                                                                                                                                                                            | Granular. EPD ID is mandatory by ISO 14025 but the _format_ of the ID varies wildly (`S-P-XXXXX`, `EPD 395`, `4788424634.107.1`, `EPD-GTX-…`).         |
| **6** | **Methodology**                                                                    | `methodology.{pcr_guidelines, standards[], lca_method, lca_software, lci_database}`                                                                                                                                                                           | PCR via Part B / sub-category anchor. Standards via cross-format ISO/EN regex. Software / database via labelled-row anchors. Today: PCR + standards work; software + database thin.                                                                                                                                                                                                                                     | Granular. PCR is mandatory; software / database vary by LCA practitioner.                                                                              |
| **7** | **Physical**                                                                       | `physical.density.value_kg_m3`, `carbon.stated.per_unit`                                                                                                                                                                                                      | Density on the declared-unit line for solid materials, separate "Density" cell for tabular EPDs. Declared unit via labelled regex. Today: works on NA family; misses on m²-with-thickness insulation EPDs (see §9.5 declared-unit table).                                                                                                                                                                               | Granular. Density may be absent (XPS / mineral wool with m² + thickness + R-value declared unit).                                                      |
| **8** | **Carbon + impacts**                                                               | `impacts.{gwp_kgco2e, gwp_bio_kgco2e, ozone_depletion_kgcfc11eq, acidification_kgso2eq, eutrophication_kgneq, smog_kgo3eq, abiotic_depletion_fossil_mj, water_consumption_m3, primary_energy_nonrenewable_mj, primary_energy_renewable_mj}.{total, by_stage}` | `_extractIndicatorTotals()` cross-format loop with the `DATA_ROW_TAIL` lookahead. Per-stage breakdown (A1..D) deferred to P3.3 — needs column-header parsing.                                                                                                                                                                                                                                                           | Granular. Indicator codes (`GWPTRACI` / `GWPfossil` / `GWP100`) and column layouts (cradle-to-gate vs cradle-to-grave) vary by program / LCA software. |
| **9** | **Audit + status**                                                                 | `provenance.review_audit[]`, `status.{visibility, listed, do_not_list}`                                                                                                                                                                                       | Auto-stamped at Capture / Trust time, not extracted. `status.visibility = "public"` default for new entries.                                                                                                                                                                                                                                                                                                            | Process metadata, not document content.                                                                                                                |

**Generality principle**: Tiers 1–4 (Group, Type, Manufacturer, Provenance) are **trunk** — they should populate on virtually every EPD because they're high-level identifiers any document calls itself by. Tiers 5–8 are **granular** — they may be absent (industry-average EPDs sometimes omit a single product brand; older EPDs lack EN 15804+A2 indicator panels; insulation EPDs lack density). The harness coverage matrix (§9.5 + `EPD-coverage-history/`) measures both — failing trunk fields on any sample is a worse signal than failing granular fields on a few samples, because it suggests the format-detection or label vocabulary missed the document entirely.

**Form-pane refactor (TODO, not yet shipped):** today's form sections in `js/epdparser.mjs` are `Identity / EPD identification / Methodology / Physical + carbon / Provenance + scope / Audit`. Reorder to match this taxonomy: `1. Group → 2. Type → 3. Manufacturer → 4. Provenance → 5. Identification → 6. Methodology → 7. Physical → 8. Impacts → 9. Audit`. Pure structural change; the schema-path bindings on each input stay the same.

**Extraction-pass refactor (TODO, not yet shipped):** today's `extract()` runs format detection then dispatches to one per-family extractor and one cross-format `extractCommon`. Refactor to run tier-by-tier:

```js
extract(pageTexts) {
  const text = pageTexts.join("\n\n");
  const format = detectFormat(text);
  const rec = {};
  // Tier 2 first (display name + material type), so Tier 1 can infer Group
  extractType(text, rec);
  extractGroup(rec);                                     // uses rec.classification.material_type
  extractManufacturer(text, rec, format);
  extractProvenance(text, rec, format);
  extractIdentification(text, rec, format);              // dispatches to NA / EPD-Intl / NSF
  extractMethodology(text, rec, format);
  extractPhysical(text, rec);
  extractImpactTotals(text, rec);                        // existing _extractIndicatorTotals
  extractImpactByStage(text, rec);                       // P3.3
  return { format, record: rec, anchorsHit: _countAnchors(rec) };
}
```

This makes the extraction _narratively readable_ and lets later tiers consume earlier ones (e.g. Tier 1 group inference depends on Tier 2 material_type). Currently no probe consumes another's output, so reordering changes nothing for runtime — but it makes the code match the human mental model and surfaces gaps when a tier extractor returns nothing (e.g. "Tier 3 Manufacturer extractor returned null on this NA-format sample → bug").

## 6. Match-existing logic

**Default to new entry. Only refresh an existing record when every high-fidelity match key agrees.** EPDs published under different PCRs, different geographic scopes, or by different program operators describe distinct products from the database's perspective, even when the underlying material is "the same" in casual language. The cost of a false-positive merge (silently overwriting a US-scope record with CA-scope numbers) is much higher than the cost of a false-negative (one extra database row).

### Match keys, all required for a refresh

A candidate refresh fires only when **all** of the following match between the incoming EPD and an existing record:

| Key                     | Source field                            | Match rule                                                                                                                                                                                    |
| ----------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manufacturer            | `manufacturer.name`                     | Normalised exact match (case-fold, strip punctuation, collapse whitespace).                                                                                                                   |
| EPD identifier          | `epd.id`                                | Exact string match — EPDs are uniquely numbered per program.                                                                                                                                  |
| PCR reference           | `methodology.pcr_guidelines`            | Exact match including version suffix. **A PCR version bump (v1.1 → v2.0) is treated as a different PCR, hence a different record.**                                                           |
| EPD source-document URI | `epd.source_document_url`               | Exact match when both records have one. URI is the strongest single signal; if it matches, everything else has to too or the data is corrupt. Field already exists in `material.schema.json`. |
| Geographic scope        | `provenance.markets_of_applicability[]` | Set equality. CA ≠ USA ≠ NA-aggregate. Different scope = different record.                                                                                                                    |
| Program operator        | `epd.program_operator`                  | Exact match. ULE-issued ≠ CSA-issued even when the manufacturer is the same.                                                                                                                  |

**Anything less than full agreement on every key → new entry.** The review UI does not offer a "force-merge" override; if the user genuinely wants to merge two near-matches, they edit the records by hand outside the parser.

### Algorithm

1. Compute the candidate's match-key tuple `(manufacturer, epd_id, pcr, uri, scope, program)`.
2. Scan the corresponding `schema/materials/<group>.json` for any record whose tuple matches **all six** keys.
3. **Hit** → flag as refresh candidate, route to the side-by-side review UI.
4. **Miss** → flag as new entry, route to the new-entry review UI. (Optional: surface near-matches — same manufacturer + same PCR but different scope, for example — as informational links in the new-entry UI: "this looks related to existing record `lam011` (US-scope); confirm this CA-scope EPD is meant to be a separate record.")

### Producer-only — no commit logic in this app

EPD-Parser is a pure data producer, mirroring how PDF-Parser feeds BEAMweb today ([`js/beamweb.mjs:519`](../../js/beamweb.mjs#L519) `handleTrustPdfParser`). The match outcome (refresh-candidate / new / near-match-rejected) and the parsed record auto-save (debounced) to the shared `pending_changes` queue (IndexedDB, via [`js/shared/indexed-db-store.mjs`](../../js/shared/indexed-db-store.mjs)) on every edit in the form pane. **There are no "send", "commit", "hand-off", or "apply" buttons on the EPD-Parser side.** The Database viewer is the commit point and owns the Trust / Trust + Verify buttons (§4 + §5 of [`Database.md`](Database.md)).

The single-source-of-truth rule applies: one `pending_changes` table, one `committed_patches` table, both shared. EPD-Parser writes; DB viewer reads + decides + writes back. No redundant intermediate state in either app.

### What lands in the queue

Each auto-save updates one `pending_changes` row keyed by EPD source filename. Schema:

```
{
  source: "epd-parser",
  source_file: "2023 BC Wood CLT EPD ASTM.pdf",      // queue key
  target_record_id: "lam011" | null,                  // null for new entries
  candidate_record: { …full schema-shape JSON… },
  match_outcome: "refresh" | "new" | "near-match-rejected",
  match_keys_compared: { manufacturer, epd_id, pcr, uri, scope, program },
  audit_meta: {
    editor:       "andy@bfca",                        // from localStorage; user-editable in the form
    last_edit_at: "2026-04-25T19:42Z",                // updated on every edit
    action:       "epd-parser-extract",
    source:       "2023 BC Wood CLT EPD ASTM.pdf"
  }
}
```

The user opens the Database viewer (toolbar link "↗ Open Database to commit" — opens `database.html` in a new tab); the queued candidate appears in the pending-changes panel with two buttons:

- **Trust** (`bi-lightning-charge`) — one-click commit. New entries: writes record + appends audit row + mints `id` via `makeId()`. Refresh candidates: takes incoming record fully, no per-field diff. Status echoes BEAM: _"Trust: committed lam011 from 2023 BC Wood CLT EPD ASTM.pdf · click Trust + Verify to audit"_.
- **Trust + Verify** (`bi-file-earmark-ruled`) — opens the side-by-side diff (refresh) or the new-entry confirmation form (new). Per-field three-way toggle, audit trail. Always available; user can re-audit even after a Trust commit.

UX wording mirrors the existing PDF-Parser → BEAM bridge so muscle-memory transfers from the validated flow.

## 7. Phases

| Phase                                          | Status                                                                         | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Exit criterion                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 — Shell**                                 | ✅ Shipped 2026-04-25                                                          | `epdparser.html` skeleton, `js/epdparser.mjs` ESM entry, drop-zone, status bar, viewer canvas. Reuses [`js/pdf-loader.mjs`](../../js/pdf-loader.mjs) + [`js/canvas-viewer.mjs`](../../js/canvas-viewer.mjs). Add to deploy-pages cp list.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Drop a PDF → it renders in the canvas. No extraction yet.                                                                                                                     |
| **P1 — Text extraction**                       | ✅ Shipped 2026-04-25                                                          | Wire `getTextContent()` per page, render a flat-text panel in the sidebar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | User can confirm against 3+ sample EPDs that the text-layer assumption holds (no scanned-only PDFs in the v1 sample set).                                                     |
| **P2 — UX scaffold**                           | ✅ Shipped 2026-04-25, demo confirmed 2026-04-26                               | 60/40 layout (PDF left, schema-form right), schema-driven form pane with ~24 representative fields across 6 sections, IndexedDB auto-save (`state: "draft"`), Capture button promotes draft → captured, audit-row auto-stamp. Database viewer pending-panel + Trust / Trust + Verify stubs (the verify modal shows JSON; per-field diff lands at P4). Manual entry only — no regex auto-fill yet. **Note:** the original "P5 — Auto-save to pending queue" was absorbed here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ✓ Drop EPD → fill form → Capture → switch to Database tab → Trust or Trust + Verify works. End-to-end demo confirmed 2026-04-26.                                              |
| **P3 — Field extraction (regex auto-fill)**    | 🟨 Partial 2026-04-27 — totals + harness shipped; per-format iteration pending | Anchor-based regex passes against the field groups in §5. Calibrate against the format families documented in §9.5 (NA / EU / EPD International / NSF). Auto-populate the same form fields the user manually enters today. Regression target — drop ALL 30 sample EPDs through the flow and confirm Capture produces a populated record per sample; track failures per sample. **Shipped 2026-04-27**: `js/epd/extract.mjs` with NA / EPD-Intl / NSF extractors + cross-format `extractCommon`; 10-indicator impact-totals loop with `DATA_ROW_TAIL` lookahead (rejects methodology-row false positives); `schema/scripts/test-epd-extract.mjs` regression harness. **Current measured coverage: 50.3% metadata, 30.7% impact totals (§9.5 baseline 2026-04-27).**                                                                                                                                                                                                                                                                | At least 80% field coverage on the 30-sample regression set; per-format gaps in §9.5 fix-list cleared.                                                                        |
| **P4 — Match + form pane status**              | ⏳ Pending                                                                     | Run the §6 six-key match against the DB at form-render time. Surface match outcome (`NEW` vs `REFRESH → <existing-id>`) in the form's status banner AND in the pending-panel row in the Database viewer (see [`Database.md`](Database.md) §5.5 (a) — required before stub Trust → real Trust). Side-by-side diff lives in the database viewer, not here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Form populated with match outcome chip; Database pending-panel row shows the same outcome; Trust on a refresh row is visually distinct from Trust on a new row.               |
| **P5 — Auto-save to pending queue**            | ✅ Shipped as part of P2 (2026-04-25)                                          | (Absorbed into P2.) Form-pane edits debounce-write the candidate record + audit metadata to the shared `pending_changes` IndexedDB table. Toolbar "↗ Open Database to commit" link. No commit/send button on the EPD-Parser side — same shape as PDF-Parser → BEAM.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ✓ Drop EPD → edit form → open Database → entry shows up in the pending-changes panel ready for Trust / Trust + Verify.                                                        |
| **P6 — Refresh queue (DB-driven entry point)** | ⏳ Pending                                                                     | Second entry point next to drag-drop: a "Refresh queue" view that loads `schema/materials/*.json`, sorts by `epd.expiry_date` (expired records first, expiring-within-12-months next), and for each row offers a "Find refresh" action. The action displays a templated search query (`<manufacturer> <product_brand_name> EPD <expiry_year + 1>`) and direct links to the originating program-operator registries when known (CSA, ULE, EPD International, IBU). The team member runs the actual web search externally — likely with Claude Code's WebSearch / WebFetch tools in a parallel session, since this is an internal-only tool — and pastes the candidate PDF URL back into the parser. The parser fetches and runs the existing P1–P5 pipeline, with the expired record pre-loaded as the candidate refresh target. The §6 strict match still applies: if the new EPD's PCR / scope / program differs, the user is shown the "looks like a new entry, not a refresh" path and the old expired record stays untouched. | Team can clear the expired-record backlog systematically: open the queue, walk down the list, find candidate URLs, parse, review, commit a refresh or a new entry per record. |
| **P7 — Coverage hardening**                    | ⏳ Pending                                                                     | OCR fallback (Tesseract.js) for scanned EPDs. Bulk multi-EPD upload. Where program operators publish _public_ registry APIs (CSA, ULE, EPD International), wrap them as direct lookups to partially automate the URL-finding step in P6. **No browser-side Anthropic API integration** — see §8.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Nice-to-have; gated on real demand once P6 is in regular use.                                                                                                                 |

## 7.5. Known issues — resolved + outstanding

- ✅ **Window resize doesn't reflow the canvas viewer** — RESOLVED 2026-04-27 (commit `f2d50f1`). Added a debounced 150ms `resize` listener inside `canvas-viewer.mjs._bindEvents()` that re-runs `zoomFit()` if `_currentPage > 0`. PDF-Parser inherits the fix for free since they share the module.
- ⏳ **Per-glyph splits leave residue in extracted free-text values.** `carbon.stated.per_unit` on the CLT EPD captures `"O ne cubic met re (1 m ) of cross - laminated timber..."` — semantically correct but visually noisy. P3.2 should add a post-process pass that compacts known per-glyph patterns (`\bO ne\b` → `One`, `met re` → `metre`, `cross - laminated` → `cross-laminated`, `1 m ` → `1 m³` where pdf.js dropped the superscript). Not load-bearing for downstream processing; cosmetic only.
- ⏳ **Indicator-code synonym misses** — Dofasco XCarb steel EPDs use indicator codes that the current regex doesn't catch for PE-NR / PE-R / WDP. Surfaced by the 2026-04-27 harness run; specific codes need investigating per the §9.5 fix-list item 5.

## 7.6. Generality contract — the harness is the test

Concern raised by Andy 2026-04-27: _"Can we be sure whatever code we develop works generally and is not completely specific/idiosyncratic to one PDF/EPD?"_

The answer is procedural, not architectural. **Every regex change is measured.**

`schema/scripts/test-epd-extract.mjs` walks all 30 sample EPDs and reports per-sample coverage (metadata + impact totals, plus format-detection + per-indicator extracted values). The harness writes a timestamped snapshot to [`docs/workplans/EPD-coverage-history/`](EPD-coverage-history/) by default (no `--md` flag needed). Every commit that touches `js/epd/extract.mjs` commits a fresh snapshot alongside the code change.

**The contract:**

1. **No regex change ships unless the harness aggregate moves up AND no individual sample regresses.** A change that helps Lafarge but breaks any other sample is rolled back.
2. **Format-family-specific regex is appropriate** because EPD programs genuinely use different vocabularies (SCREAMING_CAPS vs sentence-case, English vs German). The format-detection split (`detectFormat()` → NA / EPD-Intl / NSF / EU-IBU / unknown) is the right architectural lever for cross-format generality.
3. **Within a format family, the regex must work on multiple samples to claim generality.** A pattern that fits one EPD's idiosyncrasies (e.g. one specific PCR string) is rolled back unless extended to cover the format family.
4. **When iterating per-format (e.g. older BC Wood, 3 samples: 2013 LVL + 2016 LSL + 2016 WRC), write the regex against ALL samples in the family at once.** If it only fits one, it's idiosyncratic.
5. **Format-detection signals stay explicit** — `S-P-XXXXX` / `NSF International` / line-anchored `Programme holder` are _unambiguous_ markers, not loose matches against prose.
6. **Coverage-history snapshots are git-tracked.** A future regex change with hidden regressions can be caught by `git diff` of the latest snapshot against an older one.

The `EPD-coverage-history/README.md` documents this workflow for any agent picking up the work.

## 7.7. Persistence — Trust commits land in committed_patches + survive reload

✅ **Shipped 2026-04-28 (commit `8c20ae5`)**. The original blocker: clicking **Trust** on a captured candidate deleted the pending row but wrote the committed record nowhere durable, so the catalogue search couldn't find it.

Implementation:

- New `epd-committed-patches` IndexedDB store keyed by record id (`DB_VERSION` bumped to 3, upgrade-handler creates the store on existing user databases).
- `handleTrust` builds an `index_entry` from the candidate (via `_indexEntryFromRecord`), determines `commit_type` (`new` if no existing id match, `refresh` if the candidate's id matches an existing index entry), merges via `_mergeRefresh` for refresh commits (candidate-wins-on-set, prior-wins-on-null), mints a 6-char hex id for new commits via `_mintId6`, then writes the committed record + index_entry + audit_meta + committed_at to the store. Optimistically pushes into `state.indexEntries` with `_fresh: true` + `_commit_type` flags.
- `_mergeCommittedPatchesOnBoot` re-merges the store on every boot so highlights survive reloads.
- `.db-row-fresh` yellow CSS tint with hover + expanded variants. `NEW` chip on `_commit_type === "new"`, `UPDATED` chip on `"refresh"`. Both render next to the BEAM ID.

Field-mapping bug fixed 2026-04-28 EOD: `_indexEntryFromRecord` originally did `Number(impacts.gwp_kgco2e.total)` which yields `NaN` because the schema shape is `total = { value, source }`. Now reads `total.value`. `functional_unit` corrected to read from `impacts.functional_unit` first (matches the existing 821 records) before falling back to `physical.declared_unit`.

Remaining (deferred to a future commit, **not blocking testing**): `apply-patch.mjs` Node script (`Database.md` §7) reads `committed_patches` and folds rows into `schema/materials/<group>.json` on disk + regenerates `index.json` so the team can git-commit the change in the normal way. Until that script lands, the in-memory + IndexedDB persistence is the SST and BEAMweb (separate tab) won't see new entries — that constraint is acceptable for the EPD-Parser internal-tool use case.

## 8. Open questions / pending samples

Decisions deferred until the user shares sample EPDs:

- **Program-operator coverage.** Which EPD programs are highest-priority for the Canadian market? CSA, ULE, EPD International, IBU, ASTM/Inventory of Carbon and Energy — each has a different table layout and naming convention. Calibration order set by what's in the samples.
- **Multilingual EPDs.** Some Canadian EPDs publish in EN and FR side-by-side. Does the parser default to EN-only, or detect and prefer one based on the EPD program?
- **EPD-internal vs external verification.** Programmes label this differently ("verified by", "third-party verification statement", "Type III declaration verified per ISO 14025"). Need samples to land on a robust anchor set.
- **Industry-average treatment.** When `epd.type` parses as `industry_average`, is `manufacturer.name` blank, the trade association name (e.g. "Concrete BC"), or omitted entirely from the schema? Schema allows it nullable; the convention isn't documented yet.
- **Density inference.** EPDs sometimes state mass per declared unit (e.g. "1 m³ of CLT, 456 kg") instead of density directly. Parser needs to compute density when only mass-per-unit is published. Trivial when the unit is m³; less so for "1 m² of XPS at 25 mm thick" — depends on having thickness in scope.
- **PCR-version handling on a refresh.** §6 says a PCR version bump is a new record. That's correct in the strict-LCA sense (different boundaries, possibly different allocation) but may be more conservative than the user wants for minor-version updates (v1.1 → v1.1a errata). Open: do we want a soft-match flag for same-PCR-base, different-revision pairs, surfaced as "candidate refresh — confirm PCR revision is a minor update"?
- **Refresh-queue websearch integration (P6).** Two viable designs. (a) **External (recommended)**: parser surfaces a templated search query and registry links; the team member runs Claude Code in a parallel session to do the actual search, pastes the candidate URL back. Lowest friction, no API plumbing, no key-handling surface. Fits "this is done internally by the team using Claude." (b) **Hybrid**: parser auto-formulates queries and opens program-operator registry pages in new tabs; user reviews, pastes URLs back. Middle ground; useful only if specific registries get hit constantly. **Direct in-browser Anthropic API calls are explicitly out — storing or pasting an API key into a browser context exposes it via dev tools, even on an internal tool, and an attacker with momentary local access could exfiltrate it. Andy ruled this out 2026-04-25.** Copy-paste-URL workflow is the standing pattern.
- **Production deployment of back-office tools.** EPD-Parser, the database viewer, and possibly the dependency manifest are internal maintenance tools that public users shouldn't see. Options when production deployment becomes a concern: (a) GitHub Pages auth-gate via Cloudflare Access or similar; (b) a separate staging Pages build that includes the back-office cards, and a production build that omits them; (c) keep one build but hide the cards behind a query-string flag (e.g. `?dev=1`). Out of scope for v1; flagged so the choice doesn't sneak up on us.

## 9. IP guardrails

(Restated from `CLAUDE.md` because they apply here forever, not just at v1.)

- **Forbidden in code, UI, fetched JSON, served docs:** `CSI`, `MasterFormat`, `Division`, `MCE²`, `NRCan`, Crown-copyright tool names. Numeric 2-digit `group_prefix` (`03`, `06`, `09`, `31`, …) under `classification.group_prefix` is fine and stays.
- **No positioning as a port of MCE² or any NRCan tool.** EPD-Parser is a BfCA original. Schema citations to standards documents (ISO 14025, EN 15804+A2) are factual and stay.
- **Concern is spider-trolls scraping the deployed Pages site.** Anything served (`epdparser.html`, `js/epdparser*.mjs`, JSON it fetches, this workplan once published) is in scope for the rule.

## 9.5. Calibration findings (P1, 2026-04-25)

P1 shipped with `getTextContent()` wired into the sidebar's raw-text dump. To inform P2 anchor design, we walked **10 representative samples** from `docs/PDF References/EPD SAMPLES/` spanning wood + insulation, multiple program operators, multiple eras. Findings below drive P2's regex strategy.

### Coverage matrix

| Sample                           | Format                                | Pages | Items / p | PCR | DECL #                       | DUNIT | PROG                   | ISO 14025 | ISO 21930 | EN 15804  |
| -------------------------------- | ------------------------------------- | ----- | --------- | --- | ---------------------------- | ----- | ---------------------- | --------- | --------- | --------- |
| 2013 BC Wood LVL EPD             | UL Env, NA industry-avg               | 16    | 84        | ✓   | ✓                            | ✓     | ✓                      | ✓         | ✓         | ·         |
| 2017 BC Wood WRC AWC EPD         | UL Env, NA industry-avg               | 17    | 195       | ✓   | · (per-glyph "D ECLARATION") | ✓     | ✓                      | ✓         | ✓         | ✓         |
| 2022 BC Wood CLT Kalesnikoff     | UL Env, manufacturer-specific         | 12    | 172       | ✓   | ✓                            | ✓     | ✓                      | ✓         | ✓         | ·         |
| 2023 BC Wood GLT EPD ASTM        | ASTM, manufacturer-specific           | 11    | 178       | ✓   | ✓                            | ✓     | ✓                      | ✓         | ✓         | ✓         |
| EPD Sopra-XPS                    | ASTM, manufacturer-specific (EU mfr.) | 33    | 145       | ✓   | ✓                            | ✓     | ✓                      | ✓         | ✓         | ✓         |
| EPD Wood Fibre Insulating Boards | IBU, EU manufacturer                  | 10    | 201       | ✓   | ✓                            | ✓     | · ("Programme holder") | ✓         | ·         | ✓ (`+A1`) |
| EPD Genyk SPF (multi-product)    | ASTM, manufacturer-specific           | 40    | 250       | ✓   | ✓                            | ✓     | ✓                      | ✓         | ✓         | ✓         |
| 2015 LSL Summary (condensed EPD) | AWC/CWC, "Transparency Summary"       | 2     | 230       | ✓   | ·                            | ✓     | ·                      | ✓         | ·         | ·         |
| Boreal Nature Elite TDS          | **NOT an EPD** (data sheet)           | 2     | 234       | ·   | ·                            | ·     | ·                      | ·         | ·         | ·         |
| EPD Polyiso walls                | **No text layer** (scanned PDF)       | 23    | 0         | ·   | ·                            | ·     | ·                      | ·         | ·         | ·         |

Boreal TDS and Polyiso walls are both rejection cases but for **different reasons** — Boreal has text but no EPD anchors; Polyiso has zero items per page (image-only PDF). The parser must distinguish: "no anchors" → not an EPD (or wrong file type), vs. "no items at all" → text-layer empty, OCR needed.

### Edge cases discovered in this calibration round

**Multi-product EPDs (Genyk).** A single PDF can declare multiple products. The Genyk omnibus EPD covers three SPF products on one declaration: `Boreal Nature Elite`, `Duraseal`, `Floraseal 50`. Verbatim from page 1: _"Genyk is pleased to present the environmental product declaration (EPD) of three spray polyurethane foams (SPFs)…"_ P2 must detect this case (look for plural "products" in the declared-product field, or multiple product-brand-name candidates) and either:

- Surface a "multi-product EPD detected — pick which product this record represents" disambiguation in the form pane, or
- Split into N separate `pending_changes` queue entries (one per product), each pre-filled with the same shared fields (manufacturer, dates, PCR, methodology).

The shared fields are: declaration holder, dates, PCR, program operator, methodology. Different per-product: `naming.product_brand_name`, `physical.density.value_kg_m3` (per-product densities are listed separately), and the impact values (each product gets its own GWP / EP / ODP table).

Side-note: this is also why **Boreal Nature Elite** has both a Genyk-omnibus EPD (this file) and a Boreal-branded TDS (the rejection-test sample). The TDS isn't the wrong file — there _is no_ product-specific EPD for Boreal; its EPD lives inside Genyk's omnibus. P2 needs to know that a TDS with no anchors isn't necessarily "the wrong document"; it might just be "this product's EPD is bundled elsewhere."

**Empty text-layer / scanned PDFs (Polyiso walls).** Confirmed first OCR-needed sample in the calibration set: 23 pages, 0 text items, 0 chars. The `getTextContent()` API returned empty arrays for every page. **This invalidates the "text-layer only is sufficient for v1" framing in §1 and §8.** P2 must:

- Detect the empty-text case (`items.length === 0` on every page), and
- Surface a clear "no text layer detected — this PDF needs OCR (P7) or manual data entry" banner in the form pane, instead of silently producing an empty record.

P7 (OCR fallback via Tesseract.js) moves from "nice-to-have, gated on real demand" to "needed before the parser is considered done." Out of scope for v1 still, but the timeline shortens — at least one PDF in the BfCA team's actual set requires it.

**Summary-form EPDs (2015 LSL Summary).** A condensed-format document branded as "EPD Transparency Summary" (AWC + CWC). It IS a real EPD — provides PCR, declared unit (1 m³ LSL), density (570.22 kg/m³), cradle-to-gate scope — but in a 2-page abbreviated format that misses some anchors normally present in full EPDs (no separate Declaration Number block, no Program Operator key-value, no EN 15804 reference). Hits 3 of 6 threshold anchors instead of the proposed ≥4.

P2 anchor strategy needs revision: the threshold ≥4-of-6 rule rejects valid summary-form EPDs. Recommended alternative:

- **≥4 anchors** → "full EPD" — proceed normally
- **2–3 anchors** → "EPD-like (possibly a summary form) — proceed with caution; flag fields that didn't extract"
- **0–1 anchors with non-empty text** → "doesn't look like an EPD" — show the rejection banner with a "force-extract anyway" override
- **0 items at all** → "scanned PDF, OCR required" — different banner

### Anchor-vocabulary families

Three formats observed; P2 needs regex variants for each (NA family is overwhelmingly the most common in the BfCA database).

**A. UL Environment / ASTM (North American)** — SCREAMING_CAPS labels, key-value tables. Examples (verbatim from the dumps):

```
DECLARATION HOLDER          American Wood Council
DECLARATION NUMBER          4788424634.107.1
PROGRAM OPERATOR            UL Environment   https://www.ul.com/
DECLARED PRODUCT            US Redwood Lumber
FUNCTIONAL UNIT             1 m³ of …
DATE OF ISSUE               16 December 2021
PERIOD OF VALIDITY          16 December 2021 – 15 December 2026
EPD TYPE                    Product-specific
EPD SCOPE                   Cradle to grave
PRODUCT CATEGORY RULES (PCR)  Part A: UL Environment Building Related Products and Services. v3.1. May 2018
```

Validation block uses checkbox layout: `□ INTERNAL  x EXTERNAL`. Verifier names appear separately ("Dr. Thomas Gloria, Industrial Ecology Consultants" — Sopra uses "Marie Bellemare").

**B. IBU / EU** — Sentence-case labels with German + English mix. Examples:

```
Owner of the Declaration    GUTEX Holzfaserplattenwerk H. Henselmann GmbH + Co KG
Programme holder            Institut Bauen und Umwelt e.V. (IBU)
Publisher                   Institut Bauen und Umwelt e.V. (IBU)
Declaration number          EPD-GTX-20200178-IBC1-EN
Issue date                  30/10/2020
Valid to                    08/10/2025
This declaration is based on the product category rules:
  Wood based panels, 12.2018 (PCR checked and approved by the SVR)
```

Dates are DD/MM/YYYY (European). The `EN-FINAL` suffix in some filenames indicates a translated-from-French original.

**C. Technical Data Sheet (rejection)** — none of the above. Boreal TDS has product-marketing prose, physical-property tables (density, R-value), and `CCMC` certification refs only.

### Per-glyph splits — load-bearing for P2 regex

Same MAGIC.md §6.1 lesson applies. pdfjs v4 (the browser bundle) emits per-glyph items on some PDFs. Observed splits:

- Leading drop-cap separates: `D ECLARATION`, `E nvironmental`, `PC R`, `re sults`, `p roduct`
- Mid-word splits on hyphens: `compos - ite lumber`
- Number splits: `Page 2 of 1 6`, `14 025:2006`

**P2 anchors must use `\s*` bridges between expected adjacent characters.** Examples that work across the calibration set:

```
/D\s*ECLARATION\s+NUMBER\s+([A-Z0-9.\-]+)/i
/PROGRAMME?\s*(?:OPERATOR|HOLDER)/i
/(?:DECLARED|FUNCTIONAL)\s+UNIT/i
/EN\s*15804(?:\s*\+\s*A[12])?/i
/ISO\s*1[34]025/i   /ISO\s*21930/i
```

### Date format variations

| Source                 | Format                | Example                         |
| ---------------------- | --------------------- | ------------------------------- |
| UL Env / ASTM (modern) | `DD Month YYYY`       | `16 December 2021`              |
| UL Env / ASTM (period) | `Mon YYYY – Mon YYYY` | `December 2021 – December 2026` |
| IBU / EU               | `DD/MM/YYYY`          | `30/10/2020`, `08/10/2025`      |
| BC Wood older (2013)   | `YYYY-MM-DD`          | `Issued: 2013-MM-DD`            |

P2 date parsing needs a multi-format walker. ISO normalization is the §5 schema target.

### Declared-unit hints (informs the §8 density-inference question)

| Material class                           | Unit pattern                                       | Density resolution                                                |
| ---------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------- |
| Solid wood (CLT, GLT, LVL, SPF, Plywood) | `1 m³`                                             | density direct                                                    |
| Wood-fibre insulating boards             | `1 m³ … average weighted density of 167 kg/m³`     | density stated explicitly                                         |
| XPS / polyiso / mineral wool             | `1 m² … RSI = 1 m²·K/W` (m² + thickness + R-value) | **needs separate density extraction**, often elsewhere in the doc |

The Sopra-XPS m²-with-thickness pattern is the §8 open question becoming concrete. P2 should: (1) detect the unit pattern, (2) if m² + thickness, scan for explicit `<N> kg/m³` density elsewhere on the cover or general-information page, (3) if not findable, leave `physical.density.value_kg_m3` null and flag in the form pane.

### Steel + concrete spot-check (2026-04-25 night)

Triaged via `pdftotext` (faster than the Playwright pipeline for design-time intel; final P2 regex still gets verified against `pdf-loader.getTextContent()`). Three new samples, four new findings worth baking in.

**1. New format family — EPD International registry (`S-P-XXXXX`).** `EPD_document_S-P-10278_en.pdf` — official Dofasco deck registration via The International EPD® System. Distinctive features:

- Programme operator: `EPD International AB` (Stockholm)
- `EPD registration number: S-P-10278` — the canonical EPD International ID format, regex `S-P-\d{5,6}`
- Standards: `ISO 14025:2006 and EN 15804:2012+A2:2019/AC:2021` (newer A2 amendment than IBU's `+A1`)
- Dates in ISO format: `Publication date: 2023-09-25 / Valid until: 2028-09-24`
- PCR: `EPD International Product Category Rules for construction products (PCR 2019:14 v1.2.5)`
- UN CPC product code present (here: `412` for steel deck)

**Andy's note: this `S-P-XXXXX` format matches Melanie's BEAM internal-ID convention.** Confirmed by spot-checking the existing 06-wood records — Bamboo / Lamboo / Heat-Treated Wood Cladding entries already use it (e.g. `S-P-01928`, `S-P-08118`, `S-P-01543`, `S-P-07182`). When P2 captures an `S-P-XXXXX` from an EPD International registration, that maps directly to `epd.id`.

**2. Same product, multiple registrations.** Dofasco's steel deck appears as `EPD #3688-5839` (CSA Group registration, the Dofasco-direct PDF) AND as `S-P-10278` (EPD International registration). Different program operator, different PCR (UL Environment Part A/B vs PCR 2019:14), different `epd.id`. Per the §6 strict-match rules these are **two separate records**, which is correct — the underlying LCA boundaries differ slightly between programs. Cross-linking ("these reference the same product line") is a future enhancement, not v1.

**3. Steel uses mass declared units (`1 metric ton`).** Third unit family on top of m³ (solid wood) and m² + thickness (rigid insulation). Density-resolution rules (§9.5 declared-unit table) need a third row: when the unit is mass-based, density may be stated separately in the declaration product line (Dofasco-CSA: `1 metric ton of steel deck with a density of 7,800 kg/m³ or 487 lb/ft³`) — easy regex anchor on the unit-line itself.

**4. NSF International is a fourth program operator.** Lafarge Exshaw uses NSF as the program operator (PCR for Portland / Blended / Masonry / Mortar / Plastic Cements, v3.2 Sept 2021). Adds to the program-operator enum: UL Environment, ASTM, CSA Group, IBU, EPD International AB, NSF International, AWC/CWC.

**5. Multi-product EPDs are common across groups, not just SPF.** Lafarge Exshaw covers 6 cement types in one EPD (GU, HS, GUL, HSL, HE, OWG). Genyk covered 3 SPF products. AWC/CWC industry-avg covers multiple wood categories. P2's multi-product disambiguation is required across all material groups, not edge-case.

**6. Multi-PCR references.** Dofasco-CSA and Sopra-XPS both reference _two_ PCR documents (Part A + Part B). Lafarge references NSF + ISO 21930 (core). The schema's `methodology.pcr_guidelines` is a single string today — P2 should populate it with the _primary_ (Part B / sub-category) PCR for the most precise match-key value, with the Part A / core PCR captured in `methodology.standards[]` as a sibling entry.

### P3 regression baseline (2026-04-27, harness-driven)

`schema/scripts/test-epd-extract.mjs` walks all 30 sample EPDs and reports per-sample coverage. After the post-meeting impact-table extractor + `DATA_ROW_TAIL` lookahead fix:

- **30/30 samples processed**, no errors.
- **Metadata coverage: 166/330 = 50.3%** (11 fields × 30 samples; populated where the EPD has a labeled value).
- **Impact coverage: 92/300 = 30.7%** (10 schema indicator slots × 30 samples).
- **Format detection: na=18, unknown=8, eu_ibu=2, nsf=1, epd_international=1.**

Top-line takeaways:

| Cohort                                                     | Metadata  | Impacts | Notes                                                                                                                                                                                                              |
| ---------------------------------------------------------- | --------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2023 BC Wood ASTM (CLT, GLT, SPF, SPF-Plywood)             | 9/11      | 8–9/10  | Strongest cohort; the regex pass is calibrated against this layout.                                                                                                                                                |
| Dofasco XCarb (deck, HSS, cold-formed)                     | **11/11** | 6/10    | Brackets-aware unit pattern unlocked 5 indicators; PE-NR / PE-R / WDP still missed (different label form).                                                                                                         |
| AWC/CWC industry-avg (2017 WRC, 2020 OSB)                  | 4–5/11    | 5–6/10  | Was all-2.1 false-positive pre-fix; now real values across GWP/ODP/AP/EP/SFP/ADPf.                                                                                                                                 |
| EPD International (S-P-10278)                              | 8/11      | 6/10    | Format-specific extractor for `epd_international`; impact regex picks up via `extractCommon`. Sibling `EPD_document_EPD-IES-…` file has the IES code in the filename and detected as unknown — see fix-list below. |
| EU/IBU (Wood Fibre 2020, Lafarge as eu_ibu)                | 2–3/11    | 2–5/10  | EU stub only; per-format extractor not yet written.                                                                                                                                                                |
| Older BC Wood (2013 LVL, 2016 LSL, 2016 WRC)               | 2–6/11    | 0/10    | Different impact-table layout from 2017+; needs separate calibration.                                                                                                                                              |
| Sopra family (XPS, Cellulose, ISO)                         | 0–9/11    | 0/10    | XPS detected as `na` but impact rows differ structurally; Cellulose + ISO fall through as `unknown`.                                                                                                               |
| Rejection (Boreal TDS, density-only docs, Polyiso scanned) | 0/11      | 0/10    | Correctly reject (TDS / no-EPD / no-text-layer).                                                                                                                                                                   |

Concrete fix-list ranked by leverage (each iteration re-runs the harness to confirm coverage moves up):

1. **Older BC Wood format** (3 samples, 0/10 impacts each) — different per-stage table; likely a single regex variant captures all three.
2. **Sopra format detection + impact rows** (3 samples currently 0/10) — XPS already gets metadata, just needs impact-row anchor.
3. **`EPD_document_EPD-IES-…` filename variant** (1 sample) — format detector currently misses; tighten the EPD International detector.
4. **EU/IBU per-format extractor** (Wood-Fibre + Lafarge as eu_ibu) — currently stub-only.
5. **PE-NR / PE-R / WDP across NA family** — Dofasco + Kalesnikoff samples have these in the data but my regex labels (PENR/NRPE/PE-NR) don't match the actual codes those EPDs use.
6. **Per-stage breakdown** (A1, A2, A3, A1-A3, A4, …, D) — once totals coverage is high; needs column-header parsing.
7. **Multi-product EPD disambiguation** (Genyk 3 SPFs, Lafarge 6 cements, AWC/CWC) — UI work in the form pane.

### Concrete P2 strategy

Build P2 as a sequence of anchor passes:

1. **Format detection** — search page 1+2 for either family-A keywords (`PROGRAM OPERATOR`, `DECLARATION HOLDER`) or family-B keywords (`Programme holder`, `Owner of the Declaration`). Set `format = "NA"` or `format = "EU"`.
2. **Anchor-and-capture per field**, using format-specific regex. Each anchor returns `{value, page, confidence}`.
3. **Threshold check** — if fewer than 4 of {PCR, DECLARATION_NUMBER, DECLARED_UNIT, ISO 14025, EN 15804, PROGRAM_OPERATOR} hit, the document is flagged as not-an-EPD and the form pane shows a warning banner ("This doesn't look like a standard EPD — review fields before commit").
4. **Date normalization** — multi-format walker normalizes to ISO 8601 for `epd.publication_date` and `epd.expiry_date`.
5. **Unit + density resolution** — m³ direct vs m²+thickness lookup vs null + flag.

Per-EPD wood + insulation regression fixtures land as P3 work, drawing the seven calibration JSON dumps as ground truth.

## 10. Fallback database (`db-fallbacks.json`) — provenance-marked defaults

### Why

Many properties the schema can hold are **not** EPD-specific (Andy 2026-04-29). Density, thermal conductivity, heat capacity, embodied energy, embodied carbon — these are reference-grade material constants the LCA practitioner often won't find on the cover page of a product EPD. The EPD reports impacts per declared unit and trusts the reader to know the material's bulk properties.

When BEAMweb later normalises an EPD result for use in an assembly takeoff, it sometimes needs those bulk properties to convert "kgCO₂e per m³" into "kgCO₂e per m² at 25 mm thick" (or similar). If a property isn't in the EPD, we need a fallback we can trust — but **never silently** in place of an EPD-published value.

### The file

**`schema/lookups/db-fallbacks.json`** (sibling of `material-type-to-group.json`, `country-codes.json`, etc.). Compiled from the BfCA materials catalogue (XML-imported reference set covering ~200 entries across 20 groups: aerated concrete, asphalt, burnt clay, concrete, environment, expanded clay, floor coverings, glass, gypsum, metals, plasters, roof tiles, rubbers, sealants, solid plastics, stones, glass-wool insulation, mineral-wool insulation, multilayer insulation, plastic-foam insulation, wood-wool insulation, wood + wood-based panels). Each entry holds the reference values for: density (kg/m³), thermal conductivity (W/m·K), heat capacity (J/kg·K), embodied energy (MJ/kg), embodied carbon (kgCO₂e/kg).

Keyed by canonical `material_type` label (matches the existing `material-type-to-group.json` convention). XML variants like `CONCRETE 1` / `CONCRETE 2` / `CONCRETE 3` collapse to a single mid-range default plus an optional `variants` array the form pane can offer when the user wants a tighter match.

### EPD-published values always win

The single most important rule. The fallback layer runs **after** every per-format extractor has had its chance, and only fills fields whose value is `null`. If a regex misses a value that IS in the EPD, the catalogue won't paper over the bug — it will fill the field with a generic default and the user will see it tagged that way, which surfaces the regex gap rather than hiding it.

To make this enforceable, the harness gains a ground-truth dimension (§10.3 below).

### 10.1. Provenance — four sources, color-coded

Every value in a candidate record carries a `source` field. Four canonical values:

| `source`          | Meaning                                                                                          | Form-pane treatment                                                                                              | Database-viewer treatment                                  |
| ----------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `epd_direct`      | Extracted from the EPD's text                                                                    | Default white background, no chip                                                                                | No chip                                                    |
| `generic_default` | Filled from `db-fallbacks.json` because the EPD didn't publish it                                | Soft amber tint + `DEFAULT` chip + tooltip _"from materials catalogue, not EPD — verify before Trust"_           | Amber chip in the row's expanded detail per affected field |
| `calculated`      | Derived from BEAM math (consumes other fields as inputs; lands after Andy supplies the formulas) | Soft cyan tint + `CALC` chip + tooltip naming the inputs _"computed from density × thickness × biogenic factor"_ | Cyan chip + tooltip with input chain                       |
| `user_edit`       | User typed over an auto-filled value in the form                                                 | Default white background — user input is authoritative                                                           | No chip; the form's source flips when the user edits       |

**Visual key in the database header.** The Database viewer's toolbar shows a small static legend with the four chips so a user lands on the page already knowing what each color means: `EPD ● DEFAULT ● CALC ● EDIT`. Same chip styling reused from the existing `db-fresh-chip` CSS, just with new color-class variants.

### 10.2. Pipeline integration

Three consumers, all reading the same single file via `Extract.setLookups({...})`:

| Consumer                                                                                                      | When it runs                                                                                           | What it does                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **EPD-Parser** ([`js/epd/extract.mjs`](../../js/epd/extract.mjs))                                             | New Tier-9 step `applyMaterialDefaults(rec)` after per-format extractors and `_extractIndicatorTotals` | For each catalogue field that's null on `rec`, fill from the matching `material_type` entry. Mark `source: "generic_default"` on each filled value.                                                            |
| **EPD-Parser form** ([`js/epdparser.mjs`](../../js/epdparser.mjs))                                            | On render + on every input change                                                                      | Read `source` per field from the candidate; apply the appropriate CSS class (`epd-source-default` / `epd-source-calc` / etc.) to the input. `_bindFormChange` flips source to `user_edit` when the user types. |
| **Database viewer** ([`js/database.mjs`](../../js/database.mjs))                                              | When rendering a row's expanded detail                                                                 | Display per-field source chips in the detail panel; legend in the toolbar header.                                                                                                                              |
| **CSV importer** (future, [`schema/scripts/beam-csv-to-json.mjs`](../../schema/scripts/beam-csv-to-json.mjs)) | One-shot pre-deploy run                                                                                | Backfill blanks in the existing 821 records with `source: "generic_default"` so the catalogue is consistent at deploy time. Team git-diffs the import output to review what got auto-filled.                   |
| **BEAMweb** (future)                                                                                          | When consuming a material for a project calculation                                                    | Prefer `epd_direct`; fall back to `generic_default`; surface a per-line-item provenance flag in the project export.                                                                                            |

Single source of truth for the data. Single architectural pattern (`source` field) for the EPD-vs-default-vs-calculated distinction. No parallel implementations.

### 10.3. Verification — extraction fidelity before fallback

A separate ground-truth annotation set guards against silent overrides. **`docs/PDF References/EPD SAMPLES/expected/<sample>.json`** — one hand-annotated file per sample EPD. Schema:

```json
{
  "source_file": "2023 BC Wood CLT EPD ASTM.pdf",
  "epd_publishes": {
    "physical.density.value_kg_m3": 470,
    "carbon.stated.per_unit": "1 m³ of cross-laminated timber",
    "epd.expiry_date": "2028-02-19"
  },
  "epd_omits": ["physical.thermal.conductivity_w_mk", "physical.thermal.heat_capacity_j_kgk"],
  "notes": "Density stated on cover page in declared-unit description."
}
```

Harness gains three checks per sample, run in order:

1. **Extraction fidelity** — for each `epd_publishes` key, did we extract it? Within numeric tolerance for numeric fields? _Failure here = regex bug, fix before the catalogue ever runs._
2. **Defaults applied correctly** — for each `epd_omits` key, was it filled from the catalogue with `source: "generic_default"`? Did we fill it with a sensible value (matching the canonical material_type's entry)?
3. **No silent overrides** — for any key in `epd_publishes`, the source after fallback must be `epd_direct`, never `generic_default`. _Failure here = silent shortcut bug, build-time alarm._

Annotation cost: ~30 min per pass over the 30 samples (or ad-hoc as samples surface during smoke-tests). Empty `expected/` files are non-blocking — the new harness checks just skip when the ground-truth file is absent.

### 10.4. Variants and ranges

Some XML entries carry meaningful spread (e.g., concrete densities 1800 / 2000 / 2200 / 2300 kg/m³ for different mixes; mineral wool 14–115 kg/m³ from elevation glass-wool to dense board). The catalogue stores:

- A single mid-range `default` value per material_type for instant fill (the field that goes into `rec` when the EPD is silent).
- An optional `variants[]` array per material_type with per-variant overrides (`name`, density, conductivity, etc.) the form can offer as alternatives in a dropdown when the user wants a tighter match.
- An optional `range` object (`min` / `max`) for fields where the spread is documented and useful as helper text on the form input.

### 10.5. Tier 10 (`applyCalculations`) — moved to §11

The "what's coming after the BEAM math arrives" framing is outdated as of 2026-04-29 PM: the BEAM-CSV inventory found all formula inputs already present in `docs/csv files from BEAM/BEAM Database-DUMP.csv` (cols 24, 25, 28, 29, 31, 33) and the formula itself documented in `Glossary.csv:20-26`. **See §11 for the full architecture chapter** — strict EPD-as-single-source-of-truth principle, BEAM normalization layer's role for BEAMweb hybrid components, formula decomposition, schema-field naming proposals, and the six review questions for Mélanie. C-fb6 implementation lands once §11 is signed off.

### 10.6. Commit plan

| Commit         | Scope                                                                                                                                                                                                                                                                          | Estimate |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| C-fb1          | XML → JSON conversion. Land `schema/lookups/db-fallbacks.json` (~200 material entries across 20 groups). Update `package.json stage:data` + `.github/workflows/deploy-pages.yml` to copy it into `data/schema/lookups/`.                                                       | ~30 min  |
| C-fb2          | `applyMaterialDefaults(rec)` Tier 9 in `extract.mjs`. Extend `setLookups()` to accept `materialDefaults`. Wire EPD-Parser browser-side prime. Source-mark every filled value.                                                                                                  | ~30 min  |
| C-fb3          | Form-pane provenance UI in `epdparser.mjs`. Read `source` per field, apply the four-state CSS class to each input. `_bindFormChange` flips source to `user_edit` on type. New CSS classes (`.epd-source-default`, `.epd-source-calc`, `.epd-source-edit`) in `bfcastyles.css`. | ~45 min  |
| C-fb4          | Database-viewer chip rendering in expanded detail rows. Toolbar legend showing the four source chips.                                                                                                                                                                          | ~30 min  |
| C-fb5          | Harness upgrade — `expected/` ground-truth dir + three new checks (extraction fidelity / defaults applied correctly / no silent overrides). Empty `expected/` initially; checks skip gracefully when the ground-truth file is absent.                                          | ~45 min  |
| C-fb6 (future) | `applyCalculations(rec)` Tier 10 + input-chain tooltips. Lands when the BEAM formulas arrive from Andy.                                                                                                                                                                        | ~60 min  |

C-fb1 → C-fb5 is ~3 hours of work spread across 5 small commits. C-fb6 is gated on Andy supplying the BEAM math and is independent of everything else.

---

## 11. Biogenic carbon — strict EPD reading + BEAM normalization (review-pending)

> **Status:** Drafted 2026-04-29 PM, pending review by Mélanie (BfCA database originator) before C-fb6 implementation. This chapter exists so the principle is unambiguous before code is written.

### 11.1. Principle — the EPD is the single source of truth

When an EPD publishes biogenic-carbon values (`gwp_bio_kgco2e.total`, `gwp_bio_kgco2e.by_stage.A1` for carbon stored, etc.), **those values are authoritative and never recomputed**. Strict reading means:

- If Kalesnikoff's Table 3 says `A1 = -1045.63 kgCO₂e per 1 m³ glulam`, that's what `impacts.gwp_bio_kgco2e.by_stage.A1.value` holds. With `source: "epd_direct"`. Forever.
- We do not estimate biogenic carbon from density × carbon-content × 3.67 when the EPD already declared it.
- We do not adjust the EPD's value to match a different methodology, allocation, or system boundary. The EPD is the document.
- We do not extrapolate to other lifecycle stages the EPD didn't declare (e.g. don't fabricate B1–B7 from A1–A3).

This is the same rule that drives Tier-9 catalogue defaults (§10): **EPD-published values always win.** Tier-10 (BEAM normalization) extends the rule rather than relaxing it.

### 11.2. Why a normalization layer is needed at all

The materials database is consumed by two distinct surfaces:

1. **The database viewer** (this app's sibling) — surfaces records as the EPD authored them. Per-declared-unit values, per-stage breakdown, EPD-source URL alongside. No transformation needed.
2. **BEAMweb** (separate repo, future link) — composes materials into **hybrid components** (e.g. a 2×4 framed wall at 16″ o.c. with batt insulation between studs, gypsum on both faces). For BEAMweb to compute the wall's per-m² embodied carbon, it needs each material's contribution **normalized to a per-component-area basis** — not the EPD's native declared unit.

A 1 m³ slab of glulam isn't directly comparable to 1 m² of wall sheathing. BEAMweb's job is to do the geometry math (studs/m², thickness, density × thickness = kg/m², etc.) and roll up. **EPD-Parser's role here is just to make the per-material inputs available** — not to do the assembly math itself. That math is BEAMweb's responsibility.

The "BEAM normalization" Tier 10 produces (per the existing audit-trail UI scaffolding in `js/database.mjs`) is the **per-material derivative values BEAMweb consumes**, not an alternative carbon-storage methodology. It's unit conversion + per-functional-unit projection, computed once at commit time and cached so BEAMweb doesn't recompute on every assembly call.

> Said differently: if a wood EPD reports `–1045.63 kgCO₂e per m³` for biogenic A1, the BEAM-normalized value is the **same number**, expressed per assembly unit (e.g. `–7.32 kgCO₂e per m² of 38mm CLT panel`, where the m² coverage and panel thickness are the BEAM normalization inputs). It is NOT a different value, NOT a different method, NOT an alternative interpretation. Just unit conversion.

### 11.3. The formula (from `docs/csv files from BEAM/Glossary.csv:20-26`)

The BEAM Excel formula stack is documented in the BEAM glossary. CSV export stripped the formula syntax but preserved the worked example (line 26):

```
Carbon storage = (kg of product per m²)
               × (kg of biomass per kg of product)        ← biogenic_factor
               × (kg of carbon per kg of biomass)          ← carbon_content
               × (44 / 12)                                  ← CO₂/C molar ratio = 3.67
             = kgCO₂e per m²
```

The 44/12 multiplier is the universal CO₂-to-carbon conversion: every kg of carbon stored in a product represents 44/12 (≈ 3.67) kg of CO₂ removed from the atmosphere (Glossary.csv:20). This is a stoichiometric constant — not a methodology choice — and is identical across every biogenic-carbon framework (IPCC, ISO 21930, EN 15804+A2).

Decomposed into the audit-trail UI variables already in `js/database.mjs`:

```
density           [kg/m³]            ← from EPD or db-fallbacks
thickness         [m]                ← BEAMweb-supplied per-assembly (NOT from EPD)
biogenic_factor   [kg-bio / kg-prod] ← from EPD methodology if stated, else BEAM CSV col 24
carbon_content    [kgC / kg-bio]     ← from EPD methodology if stated, else BEAM CSV col 25
3.67              [kgCO₂ / kgC]      ← stoichiometric constant
```

`full_C = density × thickness × biogenic_factor × carbon_content × 3.67   [kgCO₂e per m²]`

`stored = full_C × storage_factor                                          [kgCO₂e per m²]`

where `storage_factor` is the WWF-published 0.9 long-term-storage multiplier (BEAM CSV col 28, "WWF Storage Factor kgCO₂e/kgC") that discounts for end-of-life release. **This factor is BfCA convention, not an EPD-published value** — flag for Mélanie review whether `0.9` should be the default or whether it should always come from the EPD's biogenic methodology section.

### 11.4. Inputs catalogue

All inputs are already present in `docs/csv files from BEAM/BEAM Database-DUMP.csv` for the existing 821 records:

| Variable | BEAM CSV column | EPD slot we extract into | Notes |
|---|---|---|---|
| `density` | Col 33 (`Density`, kg/m³) | `physical.density.value_kg_m3` | Tier 1: EPD's Mass / oven-dry. Tier 9: db-fallbacks Wood→500 kg/m³ alias. |
| `biogenic_factor` | Col 24 (`Biogenic carbon factor`) | `methodology.biogenic_factor`* | *new schema field. Default 1.0 (whole product is biomass) for solid wood; <1 for engineered products with non-biomass binders. |
| `carbon_content` | Col 25 (`% Carbon content (kgC/kg)`) | `methodology.carbon_content_kgc_kg`* | *new schema field. Wood typically 0.5; bamboo 0.524. |
| `storage_factor` | Col 28 (`WWF Storage Factor`) | (constant 0.9 unless EPD overrides) | Mélanie review: is this always 0.9, or per-program-operator? |
| `3.67` | Glossary.csv:20 | (stoichiometric constant) | No need to plumb through schema. |
| `thickness` | Per-assembly (BEAMweb-supplied) | n/a — not from EPD | EPD-Parser does NOT see thickness; BEAMweb provides per-component. |

The two new schema fields (`methodology.biogenic_factor`, `methodology.carbon_content_kgc_kg`) require a `material.schema.json` bump — flag for Mélanie review whether these names match BEAM's existing terminology, and whether they should live under `methodology` or `physical`.

### 11.5. Output rules — Tier 10 produces, never overrides

`applyCalculations(rec)` runs as Tier 10 in `extract.mjs`, AFTER Tier 9 db-fallbacks. It:

1. Reads inputs from the candidate record (Tier 1–9 outputs).
2. Computes `full_C` and `stored` per the formula above (per declared unit, NOT per m² — that's BEAMweb's job).
3. Writes the result to a new `methodology.beam_calc.{full_c_kgco2e, stored_kgco2e, inputs[]}` slot.
4. Marks the value with `source: "calculated"` AND records the input-chain in a sibling `methodology.beam_calc.inputs[]` array (e.g. `["physical.density.value_kg_m3 (epd_direct)", "methodology.biogenic_factor (generic_default)", ...]`).
5. **Never touches `impacts.gwp_bio_kgco2e.*`** — those are EPD-published values and authoritative. Tier 10 is purely derivative.

The `inputs[]` chain is the audit trail. If a calculated value used a `generic_default` density and a `user_edit` biogenic factor, that fact is visible in the `methodology.beam_calc.inputs[]` array. The form pane's CYAN `CALC` chip + tooltip (already in §10.1's provenance scheme) surfaces this to the practitioner.

### 11.6. Display — practitioner-facing UI

The database viewer's expanded record detail already has the audit-trail scaffolding (the section the user described in Slack):

```
stated     — kgCO₂e / 1 m³   [source: —]
             stages declared: —
      │
      ▼   —
          factor = —    (—)
      │
      ▼
common     — kgCO₂e / —     ( · )
      │
      ▼
biogenic   method: —
           biogenic_factor=—  carbon_content=— kgC/kg
           full_C   = density × thickness × bio × C × 3.67 = — kgCO₂e
           stored   = full_C × — = — kgCO₂e
           C/unit   = — kgC.
```

After C-fb6 lands, the placeholders fill in. The `stated` line shows the **EPD-published biogenic value** (single source of truth). The `biogenic` block shows the **BEAM-normalized derivation** (computed from the same EPD value plus assembly geometry). Both are visible side-by-side; both are labelled with their `source`. The practitioner sees the EPD value AND understands how BEAMweb will use it downstream — without ambiguity that one is replacing the other.

### 11.7. Out of scope (under this chapter)

- **No re-computation of biogenic carbon when the EPD publishes it.** If `impacts.gwp_bio_kgco2e.total.value` is non-null, Tier 10 displays the EPD value alongside the BEAM-normalized derivation, and discrepancies (which can occur — different assumptions, different system boundaries) are surfaced for the practitioner. Neither value overrides the other.
- **No methodology coercion.** EPDs use various biogenic-carbon methodologies (ISO 21930 §7.2.7, EN 15804+A2, IPCC 2013 GWP-100, IPCC 2021 GWP*). Tier 10 doesn't translate between them. Practitioners working on a project with a specific methodology requirement filter records by `epd.methodology.biogenic_method`* (new schema field, flag for Mélanie).
- **No BEAMweb-side assembly math.** Per-component roll-up (studs/m², coverage factors, hybrid-component weighted averages) is BEAMweb's job, not EPD-Parser's. Tier 10 produces per-material per-declared-unit derivative values; BEAMweb then projects those onto its assembly geometry.
- **No "carbon storage" claims to end users beyond what EPDs state.** BfCA's display surfaces are factual: "this EPD reports A1 = –1045.63 kgCO₂e biogenic." We don't editorialize. The 0.9 WWF storage factor (when applied) is labelled explicitly in the audit trail so practitioners can see it's a BfCA convention layered on top of the EPD value.

### 11.8. Mélanie's answers — 2026-05-05

> **Status:** Mélanie's responses inline, with my interpretation and implementation impact noted under each. Several answers expand the scope significantly; revised implementation roadmap in §11.9. Items still needing back-and-forth flagged for the Monday review in §11.10.

**Q1 — Storage factor source.** Should `storage_factor = 0.9` be hard-coded or per-EPD?

> **MT:** Right now it is a constant hard-coded BfCA constant.

→ **Confirmed.** Stays at `0.9` as a BfCA convention. No per-EPD override needed. **But see Q3 below** — Mélanie clarifies that this `0.9` is specifically the **carbon storage long cycle** factor (not just a generic storage factor). Schema needs a flag for long-cycle vs short-cycle storage.

**Q2 — Biogenic factor + carbon content fallbacks.** Where do default values live when the EPD doesn't publish them explicitly?

> **MT:** The biogenic factor is usually from the EPD. They usually list the "Material Content of the Product" with %, then we identify which material of the product contains biogenic material (usually only one material, but can be two). Then, using the Phyllis 2 database (https://phyllis.nl/), we find the carbon content for those materials. Some EPDs provide the carbon content now, but not all. Based on this information, which structure do you propose?

→ **Significant scope expansion.** This is more layered than my draft assumed:
- The "biogenic factor" isn't one number per material_type — it's derived from the EPD's **Material Content of the Product** table (e.g. "70% wood + 30% adhesive" → biogenic_factor for wood-component is 0.7).
- Each biogenic component then needs a **carbon content** value, which comes from EITHER the EPD itself (when published) OR the **Phyllis 2 database** (https://phyllis.nl/, Dutch ECN biomass composition reference) for the relevant biomass type.
- So Tier-10 needs THREE inputs the parser must capture / look up:
  1. Material content breakdown (per-material % of the product)
  2. Which materials are biogenic (BfCA-curated tagging of biomass types)
  3. Carbon content per biomass type (EPD-published OR Phyllis 2 lookup)

**My proposed structure (for Mélanie's Monday review):**

```
schema/lookups/phyllis2-biomass-carbon-content.json   ← curated lookup
  { "wood_softwood_dry":   { "carbon_content_kgC_kg": 0.50, "source": "Phyllis 2 / NREL" },
    "wood_hardwood_dry":   { "carbon_content_kgC_kg": 0.49, ... },
    "bamboo":              { "carbon_content_kgC_kg": 0.524, ... },
    "straw":               { "carbon_content_kgC_kg": 0.48, ... },
    "wool":                { "carbon_content_kgC_kg": 0.50, ... },
    ... (~20 entries covering BfCA-relevant biomass types)
  }

EPD-Parser extracts:
  classification.material_content[] = [
    { material_type: "softwood", percent: 0.70, biogenic: true },
    { material_type: "phenolic_resin_adhesive", percent: 0.30, biogenic: false }
  ]

Tier-10 derives, per biogenic component:
  biogenic_factor = component.percent  (e.g. 0.70)
  carbon_content  = lookup(component.material_type) OR EPD-published
  full_C contribution = density × thickness × biogenic_factor × carbon_content × 3.67
  Sum across all biogenic components.
```

Implementation impact: new schema field `classification.material_content[]`, new lookup file `phyllis2-biomass-carbon-content.json`, EPD-Parser extraction of the Material Content of the Product table (which is its own per-format challenge — table layouts vary). **Tier-10 implementation is no longer ~3 hours; revised estimate ~8-10 hours plus the Phyllis 2 curation.**

**Q3 — Schema-field naming.**

> **MT:** I'm not sure I understand the difference between methodology and physical. Also about "default 1.0 for solid wood" — I don't know how the machine read this, but a product can have solid wood as part of its material content, but it wouldn't be a factor of 1 necessarily. Those names make sense to me. Also, in the repo when you reference the "WWF Storage Factor kgCO2e/kgC" column, this is actually the **carbon storage long cycle**. But the methodology is the same to calculate it. We would need a way to flag it as carbon storage long cycle.

→ **Three clarifications:**
1. **methodology vs physical** — pragmatic call: I'll put `beam_calc` directly under `physical` (since it's about physical properties of the material as derived/normalized for BEAMweb). Mélanie can override on Monday.
2. **"default 1.0 for solid wood" was wrong** — confirmed by the Q2 answer above. There's no universal default; it always comes from the EPD's material content table (or Phyllis 2 fallback for the carbon-content piece).
3. **Long-cycle vs short-cycle storage flag** — NEW. The `0.9` storage factor specifically applies to LONG-CYCLE (durable, building-life) storage. Different materials/uses might be short-cycle (annual crops, packaging). Schema needs:
   ```
   physical.beam_calc.storage_cycle: "long_cycle" | "short_cycle"
   physical.beam_calc.storage_factor: 0.9 (when long_cycle, BfCA constant)
   ```
   Default for construction materials = `long_cycle`. Short-cycle would be flagged for materials like straw bales used non-permanently, or packaging.

**Q4 — BEAM CSV column 23 (`GWP-bio from EPD`).** Round-trip to this column?

> **MT:** I'm not sure to understand. There are 3 ways we calculate biogenic carbon:
> 1. EPDs has no mention of biogenic storage, but human know there are some based on the material content: BfCA methodology: mass × biogenic content × carbon factor × 44/12.
> 2. EPDs provide BCRP = Biogenic carbon removal from product.
> 3. EPDs provide the GWP-bio.
>
> The current structure in the BEAM database is all over the place and not optimal, and we should take some time to think about the new structure. GWP-bio from EPD include BCRP and GWP-bio in the current database.

→ **Schema needs a derivation-source flag.** Three distinct origins of the biogenic value, which BEAMweb / database viewer must surface separately:
```
physical.beam_calc.biogenic_source: "epd_gwp_bio" | "epd_bcrp" | "calculated_from_material_content"
```

The current `BEAM Database-DUMP.csv` col 23 mixes #2 and #3 (EPD-direct biogenic, regardless of whether it's GWP-bio or BCRP). Going forward we should separate them; legacy 821 records will need a one-time migration to attribute their col-23 values to the right source (Mélanie + curator review).

**Q5 — Per-stage biogenic vs aggregate.** Which slot does BEAMweb consume?

> **MT:** Some EPDs that look at cradle-to-gate only, and using the -1/+1 methodology for carbon storage, where they say that all the carbon is released at end of life, all the other stages are captured in A3, so carbon storage equals to 0.
> Also GWP-bio when listed per stage, includes in A3 the BCRK = Biogenic carbon removal from packaging; which we have not been including, since the packaging won't make it to the assembly, and is not part of the carbon content of the product. So yes, we often take the **A1 value only for GWP-bio**.
> (Reference: https://www.woodworks.org/resources/understanding-the-carbon-numbers-in-a-wood-epd/ — though as you'll see, they only provide GWP total (including biogenic) and GWP. Usually we have GWP-total, GWP fossil, GWP bio.)
> We should **extract from the EPD all the stages of GWP-bio**, AND also extract the table with the **BCRP, BCEP, BCRK, BCEW** for all the stages provided.

→ **Two captures needed:**

1. **Per-stage GWP-bio** (already in P3.3 — `impacts.gwp_bio_kgco2e.by_stage.{A1, A2, ...}`). **A1 is the load-bearing slot for BEAMweb assembly math** (= carbon stored in product; excludes packaging contributions in A3).

2. **NEW: Biogenic inventory table** with 4 categories per stage:
   ```
   impacts.biogenic_inventory.bcrp.by_stage.{A1, A2, ..., D}   ← Biogenic Carbon Removal from Product
   impacts.biogenic_inventory.bcep.by_stage.{...}              ← Biogenic Carbon Emission from Product
   impacts.biogenic_inventory.bcrk.by_stage.{...}              ← Biogenic Carbon Removal from packaging (excluded from BEAMweb math)
   impacts.biogenic_inventory.bcew.by_stage.{...}              ← Biogenic Carbon Emission from Waste
   ```
   This is a SEPARATE table on most EPDs (we already saw it in Kalesnikoff GLT — Table 2 "Biogenic Carbon Inventory Parameters" with columns `Total | A1 | A2 | A3 | A5 | C3/C4`).

**For BEAMweb consumption priority:**
- Prefer `impacts.gwp_bio_kgco2e.by_stage.A1.value` (the EPD's per-stage GWP-bio A1, with packaging already netted by the EPD)
- Fall back to `impacts.biogenic_inventory.bcrp.by_stage.A1` (Biogenic Carbon Removal from Product specifically — excludes BCRK packaging)
- Fall back to BfCA-calculated value (`physical.beam_calc.full_c_kgco2e`) when EPD has neither

**Q6 — Validation samples.** Compare `methodology.beam_calc.full_c_kgco2e` against `BEAM Database-DUMP.csv` for already-annotated samples?

> **MT:** Not sure I understand the question. Let's revise it together on Monday, or you can provide more explanation here. Thanks! :)

→ **Restated for Monday's review:**

Once Tier-10 (`applyCalculations`) is implemented, every record produced by EPD-Parser will have a `physical.beam_calc.full_c_kgco2e` (or whatever we settle on for the field name) — this is BEAM's normalized biogenic-carbon value, computed from the EPD inputs.

For the 821 existing records in `BEAM Database-DUMP.csv` (which were imported from BEAM's original spreadsheet), col 31 already contains a "Full C value" computed by Mélanie's spreadsheet using the same formula. **We can use these as a regression test:** for each of our currently-annotated C-fb5 samples (Kalesnikoff GLT, xcarb cold-formed) — IF those samples also have rows in `BEAM Database-DUMP.csv` — re-extract via EPD-Parser, run Tier-10, and compare `physical.beam_calc.full_c_kgco2e` against the spreadsheet's col 31. Numeric agreement within ±5% would mean our formula implementation matches Mélanie's. Mismatches would surface either a formula misunderstanding on our side OR a stale/inconsistent value in the existing BEAM database.

The question is whether you (Mélanie) think ±5% tolerance is reasonable, or whether the spreadsheet's values should be exactly reproducible (±0.1%)?

### 11.9. Revised implementation roadmap (post-Mélanie review)

C-fb6 has grown from "~3 hours of mechanical implementation" to a multi-step build with new data-acquisition work. Revised commit plan:

| Commit | Scope | Estimate |
|---|---|---|
| C-fb6.1 | Schema bump: add `classification.material_content[]` array, `physical.beam_calc.{full_c_kgco2e, stored_kgco2e, biogenic_source, storage_cycle, storage_factor, inputs[]}`, `impacts.biogenic_inventory.{bcrp, bcep, bcrk, bcew}.by_stage.*` | ~2 hrs |
| C-fb6.2 | Curate `schema/lookups/phyllis2-biomass-carbon-content.json` from Phyllis 2 (~20 entries covering BfCA materials) | ~3 hrs (mostly data work, needs Mélanie review) |
| C-fb6.3 | Extract Material Content of the Product table from EPDs (per-format extraction; format detection for the table varies wildly — same architectural concern as §12) | ~4 hrs (gated on §12.3 architecture decision — geometric extraction would handle this generically) |
| C-fb6.4 | Extract Biogenic Inventory (BCRP/BCEP/BCRK/BCEW) per-stage table | ~3 hrs (also gated on §12.3) |
| C-fb6.5 | Implement Tier-10 `applyCalculations(rec)` with BEAM formula + provenance chain + storage_cycle handling | ~3 hrs |
| C-fb6.6 | Form-pane audit-trail render (already scaffolded — fill in the placeholders with calculated values + chips) | ~2 hrs |
| C-fb6.7 | Validation harness: compare Tier-10 output against `BEAM Database-DUMP.csv` col 31 for annotated samples (per Q6) | ~2 hrs |

**Total revised estimate: ~19 hours** (was ~3 hours pre-review). Most of the inflation is C-fb6.3 + C-fb6.4 — material-content table extraction — which is the same per-format extraction problem §12 paused on. **C-fb6 is now compound-gated:** §11.10 (Monday review with Mélanie) AND §12.3 (Andy's architecture choice).

### 11.10. Open items needing Monday review (with Mélanie)

1. **Schema-field locations.** Confirm `physical.beam_calc.*` (under `physical`, not `methodology`) is the right home. Confirm `classification.material_content[]` is the right slot for the Material Content table.
2. **`storage_cycle` enum values.** Proposed: `"long_cycle"` (durable building materials, default) | `"short_cycle"` (packaging, annual crops). Are there other values needed (e.g. `"medium_cycle"` for materials with reuse / refurbishment cycles)?
3. **Phyllis 2 lookup curation.** Mélanie review the proposed ~20-entry list of biomass types + carbon content values before C-fb6.2 ships. Probably easiest to do this against a draft JSON file in a Monday session.
4. **Material Content table extraction.** Format varies per EPD program operator; this is an instance of the §12 architecture problem. Discuss whether to wait for §12.3 decision or build a stop-gap per-format extractor for the most common 3-4 layouts.
5. **Existing 821 records — derivation_source migration.** The BEAM CSV col 23 mixes EPD-GWP-bio + EPD-BCRP. Should the migration be: (a) one-shot manual review with Mélanie tagging each row's source, (b) re-extract from the original EPD PDFs (most aren't archived in our repo), or (c) leave the legacy records flagged `biogenic_source: "legacy_unknown"` and only attribute new EPD-Parser commits going forward?
6. **Validation tolerance.** ±5% as proposed in Q6, or stricter?

---

## 12. Architecture review — generalization vs per-format pattern inflation (decision-pending)

> **Status:** Drafted 2026-04-30 PM after Andy paused mid-implementation of CISC + 2023 BC Wood ASTM per-format extractors. Decision needed on the architectural shape before any further extractor work. **Do not add new format-specific patterns until §12.3 is resolved.**

### 12.1. The problem

The parser currently grows a hand-tuned regex library per EPD format encountered. Examples accumulated by 2026-04-30:

- `IMPACT_INDICATORS` — ~24 regex entries, multiple per indicator (NA short codes, English long form, EU/IBU bracketed, ISO 21930 codes, …)
- `_BYSTAGE_LABELS` — ~16 entries
- `_CISC_LABEL_PATTERNS` + `_findCISCDataRowKey` look-around — CISC-specific multi-line layout
- Pre-paused: `_ASTM_INDICATOR_PATTERNS` for 2023 BC Wood ASTM family (reverted, not committed)
- Format-specific extractors: `extractNA`, `extractEpdIntl`, `extractNSF`, `extractEuIbu`

This shape **does not scale** to "any EPD the parser loads". The wood-EPD families alone use 4+ distinct table layouts; there are dozens of program operators issuing EPDs in their own templates. Calibration samples grow → regex library grows linearly → maintenance cost grows superlinearly (each new pattern can interact with existing ones).

The parser was designed to handle 30 calibration EPDs. Andy is bringing a much larger directory tomorrow (2026-05-01). The current shape will produce diminishing returns — many new samples will extract poorly, a handful will need bespoke regex additions, and overall coverage will plateau.

### 12.2. What's general vs over-fitted in the current code

**General (worth keeping regardless of architecture choice):**

- `js/shared/text-join.mjs` — pdf.js item → text reconstruction. Browser-vs-Node parity. Format-agnostic.
- C-fb5 harness ground-truth check — works for any annotated sample.
- Density thousand-comma fix — genuinely general regex bug (`7,800` → 7800).
- Sign + sci-not preservation via x-gap heuristic — pdf.js-level, not format-specific.
- `_extractByStage` shell: stage-header detection + position-mapping logic.
- xcarb total-recompute (`3839b47`): "if the indicator's used header has no A1-A3 composite, sum A1+A2+A3 to derive total" — generally correct LCA math, not per-format.
- Tier-9 db-fallbacks layer (catalogue defaults with provenance marking).
- `_normalizeDeclaredUnit` — extracts canonical unit token from descriptive prose; format-agnostic.

**Per-EPD baggage (over-fitted; subject to deprecation depending on §12.3 choice):**

- All format-specific entries in `IMPACT_INDICATORS` — 24+ regex variants
- All entries in `_BYSTAGE_LABELS` — 16 patterns
- `_CISC_LABEL_PATTERNS` + look-around heuristics (committed in `3839b47`; flagged for revisit)
- Per-format extractors `extractNA` / `extractEpdIntl` / `extractNSF` / `extractEuIbu` — partially over-fitted; the format-detection signals (`detectFormat`) are general but the per-format probes are largely format-tuned

### 12.3. Three architectural options on the table

**Option A — Geometric / column-based table extraction.**
Use pdf.js item `x`/`y` positions to detect column boundaries and row groupings. Build a 2D table model. Map indicator label → row, stage code → column, look up cell by intersection. This is how Tabula / pdfplumber / Camelot work.

- Pros: replaces 80%+ of per-format pattern files with one general engine. Scales to arbitrary table layouts. Handles split-line headers and centred labels structurally.
- Cons: ~1-2 weeks of foundational work. Requires re-architecting `_extractByStage` and `_extractIndicatorTotals`. Still needs an indicator-label vocabulary to map row labels → schema keys (but vocabulary, not regex-spaghetti).
- Best for: long-term scaling. Andy's "any EPD" stated goal.

**Option B — Declarative format library.**
A `schema/lookups/epd-formats.json` describing each program operator's table layout (anchor strings, column count, indicator-code vocabulary, header patterns). Adding a new format = adding a JSON entry, not editing extract.mjs.

- Pros: Lower bar than (A). Makes per-format patterns reviewable + diff-friendly. Mélanie or other reviewers could add format entries without touching code.
- Cons: Doesn't solve the inflation problem — still N entries for N formats. Just relocates the spaghetti from .mjs to .json.
- Best for: stopgap if (A) is too big a rewrite right now.

**Option C — Live with partial extraction + better human-in-the-loop.**
Accept 50-60% extraction coverage. Invest in form-pane UX: per-row "extract this column" buttons, copy-cell-from-text helpers, OCR overlay for clicking on a value to extract it.

- Pros: EPD-Parser is already human-reviewed (form pane, Trust commit). Practitioners are domain experts who can quickly fix a row. Avoids the architecture-rewrite cost entirely.
- Cons: Doesn't reduce per-EPD reviewer burden as the catalogue grows. Coverage will plateau at whatever the current regex library handles.
- Best for: pragmatic shipping if engineering time is the constraint.

**Hybrid (most likely outcome):** (A) as the primary extraction path + (C) for cells (A) misses. (B) as a fallback shim during the (A) build-out.

### 12.4. Decision-pending — questions for Andy

1. Which option (A / B / C / hybrid)?
2. If (A): what's the time budget? Block the larger sample set's coverage targets behind it, or run per-format patterns in parallel as a fallback?
3. If (B): is the JSON schema per-program-operator (UL Environment, ASTM, CSA, NSF, IBU, EPD International) or per-table-layout (some program operators issue multiple template versions)?
4. If (C): what's the form-pane UX target — click-to-extract from PDF render? Or a structured-paste-from-text input?
5. Mélanie's review of §11 (biogenic) is independently pending. Do we want to ship Tier-10 (biogenic) BEFORE Option A/B/C decision lands, or wait?

### 12.5. Re-test plan against today's code (before tomorrow's larger sample set)

Once §12.3 decision lands, re-run the harness against the current 30 samples and audit per-format which patterns are EARNING THEIR KEEP vs which are dead weight from over-fitting:

1. **Per-pattern hit count.** For each entry in `IMPACT_INDICATORS` and `_BYSTAGE_LABELS`, log how many samples actually match. Patterns matching 0 or 1 samples are candidates for removal (the cost is greater than the value).
2. **Per-format coverage breakdown.** Tabulate metadata + impact + by_stage coverage by detected format (na / epd_international / nsf / eu_ibu / unknown). Surface which formats are most under-served.
3. **Per-parameter extraction rate.** For each schema field (e.g. `manufacturer.name`, `epd.id`, `physical.density.value_kg_m3`), aggregate hit rate across all 30 samples. Surface which fields have systemic gaps vs which are sample-idiosyncratic.

Tomorrow when Andy supplies the larger sample directory, the same harness should run against that with `--root <dir>` (see §12.6 below for the new flag) and produce the same per-format / per-parameter breakdown — that's the canonical test of whether each pattern earns its keep at scale.

### 12.6. Harness `--root <dir>` flag (shipped 2026-04-30 evening)

To support tomorrow's larger sample set without copying PDFs into `docs/PDF References/EPD SAMPLES/`, the harness now accepts `--root <directory>`:

```bash
node schema/scripts/test-epd-extract.mjs --root /path/to/larger/sample/set
```

The harness recursively walks the directory for `*.pdf` files, runs the same extraction + per-sample coverage matrix, and emits the same markdown snapshot to `docs/workplans/EPD-coverage-history/`. Sample names are recorded as `<basename>` (no group prefix, since the larger set may not follow the `03/05/06/07` group convention).

Combined with the per-pattern-hit-count and per-format / per-parameter breakdown (§12.5), the harness against a 100-sample directory will tell us within a few minutes:

- What % of the larger set extracts cleanly with current patterns
- Which formats need new generalization (informs Option A's scope)
- Which existing patterns matched 0 samples and should be deprecated (cleanup target)

The `--root` flag is purely additive — running the harness without it falls back to the canonical 30-sample EPD SAMPLES/ tree as before.

---

## 13. Out of scope (v1)

- **OCR** (Tesseract.js fallback) — P7 phase. **Real demand confirmed in P1 calibration** (`EPD_Polyiso walls.pdf` is image-only, zero text-layer items). v1 detects this case and surfaces a "needs OCR" banner; the actual OCR pass lands in P7.
- **Hard delete of database records.** Forever. Soft-delete via `status.visibility = "flagged_for_deletion"` is the only deletion path; flagged records stay in `schema/materials/*.json` for back-office manual review (see [`Database.md`](Database.md) §6).
- **Direct browser-side writes to `schema/materials/*.json`.** Pages serves source data read-only. Commits flow EPD-Parser → shared IndexedDB → DB viewer → patch JSON download → Node patch script → git.
- **In-browser Anthropic API integration on public-facing surfaces.** Ruled out for security (§8). The deployed Pages site, BEAMweb, and the database viewer must never carry an API key. See §14 for the internal-only LLM extraction path (CLI / IDE on BfCA team workstations), which is a different deployment model and is in scope.
- **Scraping EPD-program registries** (CSA, ULE, IBU, EPD International). Where they expose public APIs, P7 may wrap them; without an API, the team uses the copy-paste-URL workflow (§8).
- **Auto-minting BfCA-internal `beam_id` values for new entries from EPD-Parser.** Out of scope here; `beam_id` is `null` on the candidate record P3 produces. Actual minting (the `GG####` convention from §5.5) happens at the Database viewer's commit step. Existing 821 records keep their legacy heterogeneous IDs — do not rewrite. EPD-Parser must never populate `beam_id` from a regex anchor.
- **Regression test fixtures for the parser.** Defer until calibration samples stabilize. Wood EPDs are now in `docs/PDF References/EPD SAMPLES/`; fixture extraction is a P3 follow-up.

---

## 14. Strategic positioning — internal back-of-house tool + Last Mile LLM extension

> Drafted 2026-05-19 PM after Andy's clarification at the end of today's field-tuning marathon. This section names two things explicitly that had been implicit: (1) EPD-Parser and the materials catalogue are BfCA-internal, not public-facing; (2) regex extraction has a structural ceiling around 82–85% on metadata aggregate, and the path to the remaining 15–18% is LLM-as-parser, deployed as an internal CLI / IDE tool that the BfCA team runs on their own workstations to expand the catalogue.

### 14.1. Public-facing vs. internal-only — the deployment split

| Surface                  | Audience                | Deployment            | API access |
|--------------------------|-------------------------|------------------------|------------|
| BEAMweb                  | Anyone (practitioners)  | GitHub Pages, public   | None ever  |
| PDF-Parser               | Anyone (practitioners)  | GitHub Pages, public   | None ever  |
| Matrix                   | Anyone                  | GitHub Pages, public   | None ever  |
| Database viewer (read)   | Anyone                  | GitHub Pages, public   | None ever  |
| **EPD-Parser**           | **BfCA team only**      | **CLI / local browser** | **Permitted on staff workstations** |
| **DB curation workflow** | **BfCA team only**      | **Local, behind auth-gate if web** | **Permitted on staff workstations** |

The materials catalogue is the BfCA "secret sauce" — practitioners consume it through BEAMweb, but the curation pipeline (EPD-Parser → review → Trust commit → patch JSON → git) stays inside BfCA. This split was implicit in §7.7 and §8's "back-office tools" line; §14 makes it the load-bearing architectural fact.

This changes what the §8 "no in-browser API integration" rule is protecting against. The rule's intent — *no API keys exposed to anonymous traffic, no Anthropic costs scaling with public usage* — is preserved by the public-facing surfaces remaining API-free. **Internal tooling run on BfCA staff workstations does not share that constraint** (the key is an env var on the curator's laptop, not embedded in a page someone can right-click → View Source on).

### 14.2. Coverage trajectory — why regex caps around 82–85%

Today's marathon (9 commits on `EPD-PARSER-5`) lifted v1.1-candidates metadata coverage from 55.9% → 65.6%, with per-pass lift visibly decelerating:

| Pass                       | v1.1 lift                 |
|----------------------------|--------------------------|
| manufacturer + epd.id      | +25pp / +26pp             |
| Pass 1 — dates             | +22pp / +22pp             |
| Pass 2 — type/validation   | +18pp / +8pp              |
| Pass 3 — density           | +3pp                      |
| Pass 4 — material_type     | +10pp                     |

Three structural floors prevent regex from reaching 90%+ on the 354-sample audit:

1. **The 14% unknown-format bucket** (49 / 354 samples). Format detection itself fails for these, so the per-format extractors never run. They sit at 11–27% metadata coverage. Even if other formats reach 95%, the weighted average is mathematically capped near 86%.
2. **Truly-missing data.** Many EPDs don't publish density (membranes publish grammage instead). Many don't publish expiry. Many don't publish a typed verification field. Regex can't extract data that isn't in the document.
3. **Multi-language / multi-region drift.** German `Deklarationsinhaber`, French `FICHE DE DÉCLARATION`, Spanish manufacturer-name conventions — each language family is another N patterns to write. Combinatorial.

Realistic regex-only trajectory: **75–85% on metadata aggregate, plateauing as long-tail patterns become per-EPD specials.**

### 14.3. Last Mile — LLM-as-parser as a back-of-house CLI

For the gap between regex's 82% and the 95%+ BfCA wants for catalogue ingestion, the path is **a Claude API call wired into the parser pipeline, deployed as an internal tool**:

```
[Tier 1–8 regex extractor]    ← today's parser. ~65% of fields filled. Free, fast, deterministic.
        │
        ▼  for fields still null
[Tier 8.5 LLM extractor]      ← new. Hands joined text + JSON Schema → Claude API → structured record.
                                Fills the long-tail fields regex couldn't.
        │
        ▼
[Tier 9 db-fallbacks]         ← today's catalogue-default fill (unchanged)
        │
        ▼
[Tier 10 BEAM calc]           ← C-fb6, biogenic-carbon normalization (unchanged)
        │
        ▼
[form pane → Trust commit]    ← curator reviews, hits Trust, record lands in catalogue
```

**Why this works for the catalogue-ingestion use case:**
- The model reads multi-language fields natively, interprets context ("Specific gravity 1.08 kg/L" → density 1080 kg/m³), and handles arbitrary layouts without per-format engineering.
- Costs scale with curation cadence, not user traffic. Re-processing today's 354 samples: ~$5–20 once. Per-EPD going forward: ~$0.02–0.10.
- Latency is acceptable. EPD-Parser is one-EPD-at-a-time curator-driven; 5–30s per call is fine.
- Stays §8-compatible. The API key lives in an env var on the BfCA staff workstation, never in a public-facing browser bundle.

**Why regex stays — it's the "leg up":**
- Free + fast first pass. Reduces LLM token cost ~3×.
- Deterministic — same input always produces same output. Useful for regression tracking and the harness's per-pattern audit (workplan §12.5).
- Catches the easy 65% so the LLM only does the long-tail 25–30%.
- The per-pattern audit becomes a tool for retiring regexes the LLM consistently outperforms — codebase shrinks over time.

**Continued regex refinement is still worthwhile.** Each percentage point regex captures removes some LLM inference cost. Today's marathon delivered real lift even as the per-pass return diminished. The plan is **keep grinding on regex AND prototype the LLM tier**, not choose one over the other.

### 14.4. Deployment shapes — CLI first, then maybe IDE

Three viable shapes for the internal LLM tool:

**(A) CLI** — `npm run epd:extract <pdf>` reads the file, runs both extractors, prints the candidate JSON. Curator can pipe it into a review file or open it in their editor. Zero browser involvement. Easiest to ship.

**(B) Local browser** — same EPD-Parser UI, but the "Capture" button now also hits Claude for null fields before populating the form. API key in an env var loaded at `npm run serve` time, never reaches the rendered HTML. Curator workflow is unchanged from today's experience.

**(C) IDE plugin / Claude Code skill** — extraction wrapped as a Claude Code skill the BfCA team invokes during catalogue review. Highest friction to ship, lowest cost per use, integrates with the team's existing tooling if Claude Code becomes a daily driver.

(A) ships first. (B) follows if curators want the form-pane UX over a JSON dump. (C) is speculative and depends on how the team adopts Claude Code.

### 14.5. Implementation sequencing

1. **Ship today's regex improvements as a PR** (`EPD-PARSER-5`, 9 commits, metadata 60% → 67% average across sets).
2. **Prototype the LLM extractor** against 10 wild v1.1 samples (~30 minutes — Claude API + JSON Schema + the joined text + a "fill what you can" prompt). Confirm 90%+ on the same 10 samples the regex hits ~65% on.
3. **If validated:** design the Tier-8.5 wiring. Schema for the Claude request payload, retry/timeout policy, cost budget per session, audit-trail for which fields came from LLM vs regex (extend the source-enum: `epd_direct | epd_inferred | epd_llm | calculated | generic_default | user_edit`).
4. **Wire results** into the existing form-pane / Trust-commit flow unchanged. The form pane already renders provenance chips; `epd_llm` joins them.
5. **Future regex work** — focused on fields where the LLM struggles (cross-stage `by_stage` tables, biogenic-inventory format variation), where deterministic extraction is easier to audit than LLM consistency.

### 14.6. What this means for §12.3 (architecture review)

The §12.3 paused decision (Option A geometric / B declarative / C HITL / hybrid) was framed before LLM-as-parser was on the table. Adding it gives a fourth option that subsumes most of A's value (handles arbitrary formats) without the implementation cost. The revised menu:

- **Option D (LLM-as-parser)** — primary new path forward, internal-only deployment.
- **Option C (HITL form-pane)** — still useful as a last-mile reviewer experience, complementary to D.
- **Option A (geometric)** and **Option B (declarative)** — deprioritized. Most of the leverage they offered against unknown formats is collapsed by D.

The §12.3 question is no longer "which one architecture do we commit to" — it's "in what order do we ship D and C." See §14.5 for the proposed sequencing.

---

## 15. Catalogue data-quality — density-units import bug + audit (2026-05-19)

> Surfaced by the catalogue-parity matcher (§ catalogue-parity check in the harness). Fixed same day in commit `16d4ebd`. This section records the bug, the fix, and the audit confirming density was the only affected column — so a future agent doesn't re-investigate.

### 15.1. The bug

The BEAM source CSV (`docs/csv files from BEAM/BEAM Database-DUMP.csv`) stores density with its unit in a paired column: col 32 `Density` (value) + col 33 `Density Units`. The JSON importer (`schema/scripts/beam-csv-to-json.mjs`) read col 32 but **dropped col 33**, stamping every value as `kg/m³` regardless of the source unit.

Density-unit distribution in the source CSV (684 density-bearing rows):
- 502 `kg/m3` (correctly volumetric)
- 104 `kg/m2` (per-area grammage)
- 19 `g/m2`, 7 `kg/m` (linear), 5 `kg/m2 at RSI 1`, 4 `g/cm3`, ~20 other variants

So ~180 records had per-area or per-linear values silently stored as volumetric density. Examples: fiberglass batt `1f3cc3` (0.488 kg/m² stored as 0.488 kg/m³), EPDM membrane `676103` (2.07 kg/m²), wood I-joist `9aedf1` (3.9 kg/m linear). The parity matcher flagged these as catalogue-vs-parser divergences; tracing to source revealed Mélanie's spreadsheet was correct all along — the bug was BfCA-side at JSON conversion.

### 15.2. The fix (`16d4ebd`)

Importer now reads both columns and emits:

```json
"physical": { "density": {
  "value": 0.488,            // raw from CSV, no conversion
  "units": "kg/m2 at RSI 1", // verbatim from col 33
  "value_kg_m3": null,       // populated ONLY when source unit is kg/m3 or g/cm3
  "value_lb_ft3": null,      // null when value_kg_m3 is null
  "source": "epd"
}}
```

`value_kg_m3` is now null for non-volumetric source units, so consumers (BEAMweb assembly math, CCLIMB, parity matcher) can no longer misread a per-area grammage as a volumetric density. The biogenic carbon-content calc gates on `densityKgM3` (not raw density) to avoid corruption. Catalogue-parity density "differ" count dropped 102 → 36 (−65%).

**Schema convention going forward:** `physical.density` carries `{value, units, value_kg_m3, value_lb_ft3, source}`. The unit string is *data*, not metadata — downstream consumers read both `value` + `units` and convert with their own geometry context when needed.

### 15.3. Audit — density was the only affected column

Scanned all value/unit column pairs in the CSV to check for the same dropped-units pattern. Result: **density was the only genuine bug.** Every other value column anchors to the per-material **"common unit"** (CSV col 19), which the importer *does* read (→ `carbon.common.per_functional_unit`). GWP, biogenic storage, and carbon content are all expressed *per that common unit*, so their unit context flows through correctly.

| CSV cols | Field | Importer reads unit? | Verdict |
|---|---|---|---|
| 16/17 | Stated EPD GWP / unit | ✅ (→ `carbon.stated.per_unit`) | OK |
| 18/19 | GWP / common unit | ✅ (→ `carbon.common.per_functional_unit`) | OK |
| 20/21 | Metric / Imperial unit labels | ✅ | OK |
| 25/26 | Biogenic Storage / common unit | ⚠️ col 26 not read, but **verified redundant** with col 19 (always identical) | OK |
| 28/29 | Carbon content / units | ⚠️ col 29 not read, but **106/111 blank**, implied per-common-unit | OK (low risk) |
| **32/33** | **Density** | **❌ → FIXED `16d4ebd`** | **was broken** |
| 34/35 | Additional factors / units | ✅ (→ `physical.additional_factor.units`) | OK |

Verification that col 26 is redundant with col 19 (3 biogenic-storage records): `bbb000` col26=`m2` col19=`m²`; `BAM002` col26=`m2 at 1/2"` col19=`m2 @1/2"`; `BAM003` same. Density was unique because its kg/m³ vs kg/m² distinction is *independent* of the common unit — that's why dropping its unit column genuinely corrupted the value's meaning while the others stayed sound.

### 15.4. Forward-looking pipeline note

The bug was a "column added to the spreadsheet later, paired unit column missed in the importer" pattern. **Checklist item for the spreadsheet → CSV → JSON pipeline:** when the BEAM spreadsheet adds a new value column, wire its paired unit column into the importer at the same time. A units-presence assertion in `validate.mjs` (flag any density/factor value whose unit column exists in CSV but isn't carried to JSON) would catch a recurrence automatically.

---

## 16. Parity validation — CSV ↔ JSON database (planned, next session)

> Drafted 2026-05-19 PM. BfCA's goal: assurance that the BEAMweb JSON database aligns with the original BEAM spreadsheet, validated against the EPDs now in hand. Two distinct parity questions; this section defines both and specifies the deliverable BfCA requested.

### 16.1. Two parity questions — A and B

| | Parity A | Parity B |
|---|---|---|
| **Compares** | BEAM CSV ↔ JSON database | Source EPDs ↔ CSV / JSON |
| **Checks** | Is the `beam-csv-to-json.mjs` import faithful? | Did the EPDs get transcribed into the catalogue correctly? |
| **Regex involved?** | **No** — deterministic transform check | Yes — needs EPD extraction |
| **Multi-product needed?** | **No** | **Yes** (280 EPDs → 639 rows; many EPDs cover 2–8 products) |
| **Cost** | Low — re-run importer + field diff | High — gated on multi-product extraction |
| **Status** | **Do first (next session)** | Deferred — tied to LLM-as-parser (§14) for multi-product |

**Parity A is the high-assurance-per-hour move and directly answers BfCA's "values align" question.** The JSON database was *generated from* the CSV, so it should be 1:1 — 639 JSON records ↔ 639 CSV rows. Any mismatch is an import bug (the density-units bug in §15 was exactly this class). Re-run the importer, diff every field against the source CSV, surface mismatches. Target stat: "N of 639 catalogue rows match their CSV source row, field-by-field, at 100% parity."

**Parity B (EPD-sourced validation)** requires the parser to extract *all* products from multi-product EPDs (Follow-up #4 / §0 "Multi-product EPD disambiguation"). Today the parser emits one record per PDF and grabs the first product column on multi-product EPDs. Since 280 EPDs map to 639 rows, multi-product is the norm — Parity B can't be complete without it. This is the strongest argument for the §14 LLM-as-parser path: "list every product variant in this EPD with its per-stage impacts" is trivial for an LLM and a per-format slog with column-walking regex. **Defer B until multi-product extraction lands.**

#### 16.1.1. `epd.id` is the multi-product grouping key (per Mélanie + Andy, 2026-05-28)

`beam_id` is the **per-product unique key** (one per catalogue row); `epd.id` is the **grouping / join key** that ties the multiple products of one EPD back together. Mélanie's "6 materials coming from one EPD" is this relationship — and it is *already latent in the catalogue*, so Parity B doesn't have to reconstruct the EPD→products fan-out, it can **read** it:

- Of 821 records, 777 carry an `epd.id` but only **355 are distinct** — **113 EPD IDs are shared across >1 row** (one EPD → up to **43** rows; e.g. `EPD 352` → 24, `EPD10294` → 20, the `EPD 346–352` family → 12–24 each).
- **Parity B mechanism:** group catalogue rows by `epd.id`, fetch the source PDF once, validate *all* of that EPD's product rows as a set (instead of one-PDF-one-record).
- **Multi-product extraction contract:** when the parser emits N records from one PDF, they all carry the same `epd.id` + `epd.source_document_url`, differing only in `naming.display_name` / `classification.material_type` / per-product impacts. Shared `epd.id` is what re-links them downstream.

**Grouping needs canonicalization → a blocking key.** `epd.id` is free-text and inconsistent: clean program-operator IDs (`EPD 352`, `EPD10294`, `S-P-10278`) cluster on exact match, but some rows store a full literature citation *as* the ID (e.g. `"Bolin & Smith, 2011, LCA Assessment of ACQ-treated lumber, Journal of Cleaner Production"`), which won't group. The precise technique: **canonicalize `epd.id` into a canonical form (a *blocking key*)** — strip punctuation / whitespace / case so `EPD 352` / `EPD352` / `epd-352` collapse to one key — then group on that. The citation-style values cross into light **entity resolution / record linkage** (deciding whether two differently-spelled IDs denote the same EPD), where the canonical key *is* the blocking key. Flag during review: a handful of sequential beam_ids (`str000…`, `aaacc1…`, `a12345`) look like seed/placeholder rows.

### 16.2. BfCA's requested deliverable — 3-sheet parity workbook

BfCA asked for a 3-worksheet summary (CSV-format sheets, or one XLSX) for human-in-the-loop review:

| Sheet | Content | Source |
|---|---|---|
| **1 — BEAM CSV** | Original `BEAM Database-DUMP.csv` materials values, selected columns, sorted by BEAM ID | the CSV |
| **2 — BEAMweb DB** | Same columns, same row order (sorted by BEAM ID), values read from `schema/materials/*.json` | the JSON catalogue |
| **3 — Diff** | Per-cell `MATCH` / `MISMATCH` (+ numeric delta where applicable), same row order | computed A↔B |

Sheet 3 is structured so BfCA applies Excel conditional formatting → GREEN = match, RED = mismatch. We supply the data + the per-cell verdict; they apply (or we pre-apply if shipping XLSX) the colour.

**Column set to compare** (the load-bearing fields, sorted by BEAM ID):
- Identity: `ID`, `Display Name`
- Carbon: Stated EPD GWP + unit (CSV 16/17), GWP per common unit + unit (18/19), GWP-bio (22)
- Biogenic: Biogenic Storage (25), Carbon content kgC/unit (28), Full C value (30), Storage % reduction (31)
- Physical: Density value + units (32/33 — now correctly split post-§15 fix), Additional factors + units (34/35)
- Provenance: EPD ID (50), EPD Type (51), Program Operator (54), Service Life (62)

Tolerance: numeric fields match within ±0.5% (rounding in the CSV → JSON transform); strings match on normalized comparison (trim + case-insensitive); units match exact.

### 16.3. Implementation sketch (next session)

New script `schema/scripts/csv-json-parity.mjs`:

1. Parse `BEAM Database-DUMP.csv` → keyed by BEAM ID
2. Load all `schema/materials/*.json` → keyed by `id`
3. For each of the 639 IDs, align CSV row ↔ JSON record
4. Field-by-field compare per the column set + tolerance above
5. Emit three CSVs: `parity-sheet1-csv.csv`, `parity-sheet2-json.csv`, `parity-sheet3-diff.csv` (or one XLSX with 3 sheets + conditional formatting via a lib)
6. Console summary: "X/639 rows 100%-parity, Y rows with ≥1 mismatch, top mismatched fields: …"

Row order: **sort by canonicalized `epd.id` (primary), then BEAM ID (secondary)** (per §16.1.1) so each EPD's product cluster lands contiguously — a reviewer can eyeball all rows of one EPD as a set rather than hunting scattered BEAM IDs. BEAM ID is still the first data column, so an individual row stays findable. (CSI/MasterFormat column `AX` is excluded from the comparison set per §9.)

This harness is **independent of the EPD-extraction harness** (`test-epd-extract.mjs`) — different inputs (CSV+JSON vs PDFs), different question (import faithfulness vs extraction accuracy). Keep them separate.

### 16.4. Expected outcome

After the §15 density fix, Parity A should be high already. The harness will quantify it: most fields likely 100%, density now correct, and any residual mismatches (value rounding, null handling, field-mapping edge cases) surfaced for a targeted second importer fix. The 3-sheet workbook is the artifact BfCA reviews to sign off "the BEAMweb database matches the spreadsheet."

---

## 17. "Export" row-dump button (team request, 2026-05-28)

> **Status: SHIPPED 2026-05-28/29** (PR #20, `8c32da7`). Drop an EPD → scrape → Export → modal with one TSV row → paste into Excel / Google Sheets. Built from `js/shared/beam-columns.mjs` (canonical A→BL column map + `recordToRow`) wired into `js/epdparser.mjs` + a modal in `epdparser.html` + §11 CSS. Verified in-browser.
>
> ⚠️ **Known completeness gap → see §18.** The button serialises the raw scraped *candidate*, whose shape diverges from the canonical DUMP schema in two spots, so **density and GWP do not currently export from a fresh scrape**. The fix (candidate→canonical normalization + moving the authoritative export to the Database side) is specced in §18 and deferred to a future session.

### 17.1. What

A **yellow "Export" button, bottom-right** of the EPD-Parser form pane, with a **tooltip**: *"Copy a Tab-Separated (TSV) row to paste into Excel / Google Sheets."* (Label is just "Export" — the format detail lives in the tooltip, not the button text.) On click it opens a **modal** containing the scraped candidate record serialised as a **single tab-separated row whose column order matches `BEAM Database-DUMP.csv` EXACTLY** (col A → col BL, the same sequence the importer reads). The modal has:

- the row shown in a selectable text field (so the user previews exactly what they'll copy);
- a **Copy** button → `navigator.clipboard.writeText(...)`;
- direct manual text-selection + copy from the field also works (don't trap selection).

**Why a modal, not a file download:** Safari blocks / nags on programmatic file downloads. A copy-to-clipboard modal sidesteps that entirely *and* gives the user a preview of the payload before they paste. No `Blob`/`download` attribute path.

### 17.2. Column sequence = DUMP order (the load-bearing requirement)

The row must reproduce the DUMP's column order 1:1 so a paste lands under the right BEAM headers. This is the **inverse of the importer** (`schema/scripts/beam-csv-to-json.mjs`): for each DUMP column (A=ID, B=Display Name, … Q=Stated GWP, … AG/AH=Density/units, … AY=EPD ID, … BL=Source URL), read the corresponding JSON path from the candidate record and emit its value.

- **Single source of truth for the column map.** The importer encodes the CSV-column ↔ JSON-path mapping by column letter; `csv-json-parity.mjs` (§16) re-encodes a subset. Do **not** hand-write a third copy. Extract the full A→BL column→path map into one shared module that the importer, the parity harness, and this exporter all consume. Otherwise the three drift.
- **`beam_id` (col A) is null from the parser** (§5.5 — minted on the DB side at commit). Emit blank for col A, or a placeholder the team recognises.
- **Formula columns** (e.g. col S `GWP/(common unit)`): emit the *computed value*, never a formula string.
- **Empty/unscraped fields** → empty CSV cell (preserve column position so alignment holds).
- **No header row** — single data row only (the target sheet already has the BEAM headers). Optionally offer a "with header" toggle later.
- **Excluded:** col AX (abandoned classification column, §9 / near-empty).

### 17.3. Delimiter = TAB (decided 2026-05-28)

**v1 payload is tab-separated (TSV), single row, no header.** Confirmed with the team: the row gets pasted into existing BEAM data in **Google Sheets** (and Excel) to append a new EPD. A **comma**-delimited string pastes into **one cell** (needs Text-to-Columns); a **tab**-delimited string pastes **directly across columns** in both Sheets and Excel — select the first empty cell under col A, paste, and it fills A→BL across. That's the required behaviour, so v1 ships tab-only.

**Second-pass enhancement:** a **CSV / TSV toggle in the modal** (radio or segmented control), defaulting to TSV. CSV is occasionally handier for a true file import or a comma-tolerant target; TSV stays the default because it's the paste-across-columns case the team needs. (A "with header row" toggle could ride along here too.)

**TSV has no quoting standard** (unlike CSV), so the exporter must **sanitise each value**: replace any embedded **tab** or **newline/CR** with a single space before joining — otherwise one stray line-break in a display name or notes field shifts/splits the whole row. Join the (sanitised) values with `\t`; emit one line, no trailing tab. (If the CSV option lands in the second pass, that branch uses real CSV quoting instead.)

**Known sheet-side hazard — Google Sheets auto-formats pasted values.** Pasted text goes through the same type-detection as typing, with no inline "treat as text" signal, so a few BEAM-ish values get coerced:

- **leading zeros stripped** (a zero-padded code → number, `061000` → `61000`);
- **date/fraction coercion** (a `01-004`-style id → a date; a bare `3/8` → `March 8` / `0.375`);
- **formula interpretation** — any value whose text *starts with* `=`, `+`, `-`, or `@` is read as a formula (genuine negatives like `-1045.63` are fine; a text/notes field starting with `-` or `=` is not).

This is **not fixable from the export side** for a paste workflow (the numeric impact columns *should* parse as numbers, so "force all text" is wrong). The mitigation is **sheet-side**: pre-format the destination BEAM columns (at least the id/code/text ones) as **Format → Number → Plain text** before pasting, so values land verbatim. Acceptable as-is for an eyeball/test loop; pre-formatting matters for production appends.

### 17.4. Acceptance

Drop a known EPD → Export → Copy → paste into a sheet whose header row is the BEAM DUMP columns → every value sits under its correct column, matching what the form pane shows. Round-trips cleanly for at least the canonical-30 set.

---

## 18. TODO — Export completeness: candidate→canonical normalization + DB-side export (decided 2026-05-29, deferred)

> **Status: TODO, not started.** Decided by Andy 2026-05-29: **"Normalize + DB export."** Implement in a future session. This section is the spec.

### 18.1. The finding (why §17's export is incomplete)

A verification of the EPD-Parser sidebar form against the DUMP surfaced two layered issues:

1. **The form (sections 1–7) is a curated ~21-field edit subset**, not the full DUMP. ~30+ DUMP data columns aren't shown in the form (biogenic block, stated GWP value, common-unit value/labels, dimensions/thermal/mass, material subtype/product type, EPD owner/prepared-by/verifier, footnote, notes, specifications, service life, …). That's fine *as a form* — but it means the form is not a place to review/correct most exported fields.

2. **The Export reads the candidate, not the form — and the candidate's shape diverges from the canonical (importer/DUMP-aligned) schema.** `extract.mjs` writes a few values to different paths than the DUMP columns read:

| Value | Extractor writes | DUMP/Export (and importer) reads |
|---|---|---|
| Density | `physical.density.value_kg_m3` | `physical.density.value` + `physical.density.units` (AG/AH) |
| GWP | `impacts.gwp_kgco2e.total.value` | `carbon.stated.value_kgco2e` (Q) — see 18.4 |

  Result: **density and GWP come back empty from a fresh scrape.** Proof: `recordToRow()` on a *catalogue* record (importer shape) emits a full ~40-cell row; on an EPD-Parser *candidate* it emits a sparse ~10-cell row with AG/AH/Q blank. `database.mjs` already documents this divergence (the `_indexEntryFromRecord` comment: "EPD-Parser writes `physical.declared_unit` but the catalogue index reads `impacts.functional_unit`").

  **Note — NOT a mismatch:** the declared/functional unit. The extractor already sets `carbon.stated.per_unit` (R) correctly, so R exports fine. Do **not** map `impacts.functional_unit` → `carbon.common.per_functional_unit` (T): T is BfCA's *common* unit (often m²), a different quantity from the EPD's declared unit, computed downstream. Leave T for the DB/BfCA.

### 18.2. Why "export from the DB" only half-fixes it (the robustness nuance)

`handleTrust` stores a **new** EPD's candidate **verbatim** (`mergedRecord = candidate`) + mints a `beam_id` — it does **not** reshape to canonical. So a DB export of a brand-new record would be just as sparse (only difference: it has an ID). The robustness Andy noted applies to:
- **Refreshes**: `_mergeRefresh(existingFull, candidate)` merges the candidate **onto an existing catalogue record**, inheriting that record's canonical density/GWP/biogenic fields → a complete row.
- Plus minted `beam_id` (col A), duplicate detection, and the human Trust/Trust+Verify gate.

So the DB is the right *home* for the authoritative, ID'd export — but new entries still need the candidate normalized to canonical shape, or they export sparse from either surface.

### 18.3. The plan (decided)

1. **`js/shared/record-normalize.mjs`** (NEW) — `normalizeRecord(rec)` returns a canonical-shaped copy, filling only when the target is empty (idempotent, non-destructive):
   - `physical.density.value_kg_m3` → `physical.density.value` (same number) + `physical.density.units = "kg/m3"` (+ `value_lb_ft3`), preserving `source`.
   - `impacts.gwp_kgco2e.total.value` → `carbon.stated.value_kgco2e` (see 18.4).
2. **Apply at Trust commit** (`handleTrust`, before `putCommittedPatch`) so committed records are canonical → the index entry computes correctly AND a DB export is complete.
3. **Apply in the EPD-Parser export path** too (normalize a copy before `recordToRow`) so §17's quick button stops dropping density/GWP.
4. **Make the Database viewer the authoritative export home** — a per-row "Export TSV" action + modal reusing `beam-columns.recordToRow` (committed/catalogue records are canonical, so rows are complete and carry the minted `beam_id`). §17's EPD-Parser button stays as the fast pre-commit check.

### 18.4. Open question to confirm (Mel / Andy) — GWP target slot

The extractor's `impacts.gwp_kgco2e.total.value` is the GWP per the EPD's **declared unit**, which maps most honestly to **`carbon.stated.value_kgco2e` (Q)** — pairs with `carbon.stated.per_unit` (R). The **common-unit** value `carbon.common.value_kgco2e` (S) is a *derived/converted* number BfCA computes (the importer fills it via the col-S conversion formula); a scrape can't compute S without the conversion divisor, so leave S for the DB/BfCA. ⚠️ Caveat: the importer *also* stuffs the common value into the `impacts.gwp_kgco2e.total` slot for its index — so the slot is overloaded. **Confirm Q (stated) is the right target before shipping**, since a wrong stated-vs-common mapping would mislabel an EC number.

### 18.5. Acceptance

After normalization: scrape a canonical EPD → Export (EPD-Parser) shows density + GWP populated in AG/AH/Q. Trust-commit it → the committed record is canonical (index GWP/unit correct) → Database "Export TSV" emits a complete row with the minted `beam_id` in col A. No regression to the §7.6 extraction harness (normalization is downstream of `extract.mjs`, not inside it).

---

## 19. Parity-B Pass 1 + lift plan to ≥50% (today's task, 2026-06-08)

> **Status: Pass-1 harness SHIPPED 2026-06-08**; run output committed at `docs/workplans/parity-B/`. **Canonical scope** (Andy 2026-06-08, §19.1.1): 37 EPD-extractable BEAM columns. **Headline: 37.1% aggregate cell parity** (5,235 / 14,100 populated cells matched the parser, post Phase 2m shipped 2026-06-08), **0 of 671 rows at 100%**. Session lift: 9.5% (baseline pre-Phase-0a) → 37.1% = **+27.6pp** via 14 phases (0a + 1a + 1b + 1c + 2a–2m + W conditional skip — see the §0 pending list for per-phase counts). This section is the writeup for what it will take to lift that to **≥50%**, what past issues block the work, and the phased order to attack it.

### 19.1. The Pass-1 run (what we measured)

Inputs: `ART Database - Materials.csv` (Andy's current BEAM export, the gold-standard ground truth — renamed from `BEAM Database-DUMP.csv` 2026-06-08, +5 rows over Jen's prior April-20 export: ART001-004 + RRR117) + the 301-PDF `docs/PDF References/Confirmed EPDs (as listed in BEAM)/` folder (filenames prefixed with the EPD ID, e.g. `EPD10312 - …pdf`).

Alignment: filename prefix → canonical `epd.id` (§16.1.1 canonicalization), joined to BEAM col AY (canonicalized the same way). Multi-product expected (one PDF → N BEAM rows). Comparison scope: the 37 EPD-extractable columns defined in §19.1.1 (everything else — BfCA-internal flags, BfCA-curated naming, BfCA-derived units/values, BfCA-computational biogenic derivations, BfCA taxonomy, structural placeholders — is silently out of the parity %). §18 normalization inlined into the harness — `density.value_kg_m3 → density.value + units="kg/m3"`; `impacts.gwp_kgco2e.total.value → carbon.stated.value_kgco2e`.

| | count |
|---|---:|
| BEAM CSV total rows | 821 |
| BEAM rows with `epd.id` | 777 (94%) |
| BEAM distinct canonical `epd.id` | 347 |
| PDFs in the Confirmed folder | 301 (302 files, 1 duplicate) |
| PDFs distinct canonical `epd.id` | 301 |
| **EPDs matched in both** | **294** |
| BEAM-only (no PDF — excluded) | 53 EPD IDs / **150 BEAM rows** |
| PDF-only (no BEAM row) | 7 |
| **BEAM rows scored** | **671** |
| **Populated cells in scope (denominator)** | **14,100** (was 14,103 pre-W-skip — Andy's biogenic rule drops 3 rows where BEAM has W but PDF doesn't mention "biogenic") |
| **Cells matched (numerator)** | **5,235** (was 1,336 pre-Phase-0a; **+3,899 over the session**) |
| **Aggregate parity** | **37.1%** (was 9.5% baseline; **+27.6pp** via 14 phases 0a-2m) |
| Average per-row coverage | 37.7% (was 9.3%) |
| Rows at 100% parity | 0 / 671 |

### 19.1.1. Canonical EPD-extractable scope (Andy 2026-06-08)

Affirmative list of BEAM DUMP columns that the parser is expected to fill from EPD content. Anything **not** in this set is silently out of the parity %. Codified in `schema/scripts/csv-pdf-parity.mjs` as `COMPARE_COLS_SET` and is the canonical reference for §17 / §18 / future Parity-B runs.

**In scope (37 columns):**
- **Identification + provenance** (free-text / dates): `G` EPD Expiry, `I` Material, `J` Manufacturer, `K` Product Brand Name, `L` Specifications, `N` Countries of Manufacture, `O` Markets of Applicability
- **Stated carbon** (EPD's own headline + declared unit): `Q` Stated EPD kgCO2e/unit, `R` GWP units per
- **Biogenic — EPD-stated only** (explicitly EPD content per its column name; the rest of W–AF is BfCA-computational): `W` GWP-bio from EPD kg CO2e/common unit
- **Physical** (density, factors, thermal, mass, dimensions): `AG, AH, AI, AJ, AK, AL, AM, AN, AO, AP, AQ, AR, AS`
- **Classification** (HITL-readable per Andy; AU/AV/AW excluded as BfCA taxonomy): `AT` Material Type
- **EPD metadata block — capture wherever available**: `AY` EPD ID, `AZ` EPD Type, `BA` Owner, `BB` Prepared by, `BC` Program Operator, `BD` Validation, `BE` Verifier, `BF` Standards, `BG` PCR, `BH` LCA Method, `BI` LCA Software, `BJ` LCI Database, `BK` Service Life

**Out of scope (silently excluded — anything not above):**
- `A` ID (BfCA mints `beam_id`) · `C`/`D`/`E`/`F` Listed/Do-Not-List/Industry-Avg/BEAM-Avg (BfCA inventory) · `P` Data added/modified (BfCA admin)
- `B` Display Name (BfCA-curated naming — parser fills a placeholder; not expected to match BEAM's editorialized string)
- `H` Footnote (BfCA internal notation)
- `M` Notes (BfCA internal observations)
- `S` GWP/common unit, `T` Common Unit label, `U`/`V` Metric/Imperial display units (BfCA-derived/assigned)
- `X`/`Y`/`Z`/`AB`/`AC`/`AE`/`AF` — the rest of the biogenic + WWF storage block (Phyllis 2 lookups, density×thickness×bio×C×3.67 derivations, per-material defaults — not direct EPD content). `W` alone is kept in scope per its explicit "from EPD" column name.
- `AU` Material Subtype, `AV` Product Type, `AW` Product Subtype (BfCA classification taxonomy)
- `AX` abandoned classification column (§9 guardrail)
- `BL` Source document URL (not always listed on the EPD itself)
- `AA`, `AD` structural placeholders

This scope answers the parity question precisely: **"Can the parser reliably populate the BEAM spreadsheet cells whose values genuinely come from EPD content?"** — distinct from BfCA's editorial, taxonomy, and biogenic-calc work, which the human-in-the-loop / DB-commit path retains responsibility for.

### 19.1.2. Per-field match rate

**Per-field match rate** (top half = where parser is currently competent; bottom half = the gap):

| col | field | match / pop | rate | Δ from baseline | read |
|---|---|---:|---:|---:|---|
| AY | EPD ID | 541/671 | **80.6%** | +44.5pp | Phase 1a — shape-aware regexes before the loose label-anchor fallback |
| G | EPD Expiry | 467/671 | **69.6%** | **+66.2pp** | Phase 0a + Phase 1c year-prefix + Phase 2h compute-from-duration (issue + N years) + French "Date de validité" + MM-YYYY harness |
| BD | Validation | 303/504 | **60.1%** | +6.3pp | Phase 0a — extended-form patterns across all formats |
| BI | EPD LCA Software | 170/308 | **55.2%** | +55.2pp | Phase 1b extractor + Phase 1c substring (GaBi ⊂ GaBi 10) |
| AZ | EPD Type | 340/671 | **50.7%** | **+29.1pp** | Phase 1c case-insensitive default + Phase 2g unanchored head-scan + trade-association rule (ARMA / SPRI / AGA / NRMCA / PIMA / AWC / CWC / CRSI / SDI / APA / NAPA) |
| BF | EPD Standards | 127/279 | **45.5%** | +45.5pp | Phase 1c substring (parser's `ISO 21930:2017, EN 15804+A2` ⊃ BEAM's `ISO 21930`) |
| BE | Verifying Agent | 215/503 | **42.7%** | +42.7pp | Phase 1b extractor + Phase 1c substring |
| BG | PCR Guidelines | 196/463 | **42.3%** | +41.7pp | Phase 1c substring (partial PCR text matches) |
| R | GWP units kgCO2e per | 284/671 | **42.3%** | **+42.3pp** | Phase 2e — `unitNorm` relaxation (³→3 / ²→2 / strip leading `"1 "` / `cubic met[er\|re]` → m3 / `square met[er\|re]` → m2) + substring; `metric ton` deliberately NOT collapsed with kg |
| AT | Material Type | 178/393 | **45.3%** | +7.4pp | Phase 2c — substring tolerance ("Clay Brick" ⊃ "Brick", "Cross-laminated timber" ⊃ "CLT") |
| AH | Density Units | 227/615 | 36.9% | — | §18 norm fills "kg/m3" when volumetric |
| BC | EPD Program/Operator | 182/509 | **35.8%** | +12.4pp | Phase 1c substring (ASTM ⊂ ASTM International, CSA ⊂ CSA Group) |
| J | Manufacturer | 229/668 | **34.3%** | +32.2pp | Phase 1c substring (parser's full legal form ⊃ BEAM's curated short-name) |
| BH | LCA Method | 135/399 | **33.8%** | +33.8pp | Phase 1b extractor + Phase 1c substring |
| BJ | EPD LCI Database | 81/308 | **26.3%** | +26.3pp | Phase 1b extractor + Phase 1c substring (Ecoinvent ⊂ Ecoinvent 3.6) |
| BK | Product Service Life | 84/168 | **50.0%** | **+50.0pp** | Phase 2a — labeled patterns from §19.4.1 PDF probing ("Service Life: X years", "service life ... is X years", IBU "RLS X years") |
| AG | Density | 89/615 | 14.5% | — | non-volumetric BEAM cells stay blank in parser; multi-product blocker |
| BA | EPD Owner | 68/515 | **13.2%** | +13.2pp | Phase 1b extractor + Phase 1c substring |
| Q | Stated GWP | 55/671 | 8.2% | — | multi-product blocker dominates |
| BB | EPD/LCA Prepared by | 186/643 | **28.9%** | **+28.9pp** | Phase 2b — known-LCA-org detection (Sphera, thinkstep, WAP, Ecoform, Vertima, etc.) near LCA/EPD/prepared keywords as fallback when no clean label |
| AL | k Thermal Conductivity | 14/113 | **12.4%** | **+12.4pp** | Phase 2b shape-anchor + Phase 2f labeled-λ patterns ("λ = 0.034", "lambda 0.034", "k-value 0.038") + numericApprox ±5% |
| AK | R-value / inch | 14/130 | **10.8%** | **+10.8pp** | Phase 2f — 3-tier extractor: direct "R-N per inch", compute from λ (R/inch ≈ 0.1442/λ per Andy's R = RSI×5.678), + numericApprox ±5%. Industry-average EPDs cap the ceiling (BEAM picks representative thickness, parser can't) |
| AQ | Depth (m) | 1/115 | 0.9% | +0.9pp | Phase 2b — labeled patterns with mm/cm/in/ft unit conversion to meters |
| N | Countries of Manufacture | 321/487 | **65.9%** | **+65.9pp** | Phase 2d + 2i + 2j — proximity-anchored prose + address-block + comma-state/province + postal codes + French/German production language + marketTokens set-compare (Canada/CAN/CA → CAN) |
| O | Markets of Applicability | 232/665 | **34.9%** | **+34.3pp** | Phase 2j — extractor geography-token guard rejects sector-text captures; harness marketTokens relaxation collapses "US & CA" / "CAN, USA" / "United States and Canada" → {USA, CAN} set-equal |
| K | Product Brand Name | 1/613 | 0.2% | +0.2pp | Phase 2a — added but BEAM-curated short-brands rarely match the EPD's longer brand-line capture |
| **0% in-scope fields** | I, L, W, AI, AJ, AM, AN, AO, AP, AR, AS | — | 0 | — | the extractor either doesn't touch the field, or extracts a form that never matches BEAM's stored value — true extractor backlog |

### 19.2. Where the 37.1% comes from — three contributing layers

After the §19.1.1 scope decision the gap decomposes into just two main layers (biogenic-block ambiguity dropped out — it's no longer scored):

1. **Fields the extractor doesn't extract at all** (~75% of the gap). Within the in-scope set: `I` Material, `K` Product Brand Name, `L` Specifications, `N` Countries of Manufacture, `O` Markets of Applicability, dimensions/thermal/mass (`AK`–`AR`), EPD owner/prepared-by/verifier (`BA`/`BB`/`BE`), LCA method/software/database (`BH`/`BI`/`BJ`), service life (`BK`). These show 0/N in the per-field rank below.
2. **Multi-product fan-out** (~15% of the gap). One PDF → N BEAM rows; the parser emits one record (the first product), so per-product fields (`AG` density, `Q` GWP, dimensions) match at most *one* of the N rows. Cross-row spread is ~0pp in the top multi-product EPDs (43, 24, 20 rows…) because only EPD-level fields (operator, type, validation) — which don't vary by product — uniformly match or uniformly miss. The genuine per-product values stay near 0 across the family.
3. **String / format divergence on already-extracted fields** (~10%). `J` Manufacturer 2.1%, `BC` Operator 23.4%, `AZ` EPD Type 21.6%, `R` GWP units 0% (pre-Phase-2e) — the extractor *does* pull these but its output diverges from BEAM's stored form (case, trailing whitespace, punctuation, vocab variants). R was lifted to 42.3% by Phase 2e harness `unitNorm`; the others remain candidates for either harness tolerance or extractor cleanup.

There is no remaining "structurally unreachable" subset in the new scope — every column in §19.1.1 is in principle extractable from EPD content. **The 50% target is now genuinely reachable in the phased plan below, not aspirational.**

### 19.3. Blockers / past issues to clear before the big lifts

1. ✅ **Pass 1+2 extractor patches in the wrong function** (handoff §0 "Known issue", flagged EOD 2026-05-19) — **SHIPPED 2026-06-08 (Phase 0a).** Date / EPD-type / validation patterns moved from `extractNA` (~line 1319) up to the real `extractCommon` (~line 412), so NSF / EPD-Intl / unknown-format EPDs now see them. **Lift: +176 matches (+1.2pp aggregate); biggest hit on `G EPD Expiry` +18.7pp, `BD Validation` +6.3pp, `AZ EPD Type` +2.8pp.** Canonical-30 regression-clean (69.5% → 70.5% metadata, 0 ground-truth failures).
2. 🔜 **Multi-product extraction (§16.1 Follow-up #4)** — the biggest single lift in §19.4 depends on this. Currently `extract.mjs` returns one record per PDF; we need it to return N records when the EPD's data table covers N product columns, then per-row alignment can match each BEAM row to its specific product. This is the genuine architectural lift; the §14 LLM-as-parser path is the strongest tool for it.
3. 🔜 **§18 normalization not committed to the extractor** (Phase 0b) — the harness inlines the maps (density `value_kg_m3 → value + units`; `impacts.gwp → carbon.stated.value_kgco2e`), but `extract.mjs` itself still writes only the divergent paths. This means the EPD-Parser app's export + DB commit don't get the same lift. Doesn't change Parity-B numbers (harness already normalizes), but **blocks Goal-B form expansion** because density/GWP need canonical paths to show in the form pane consistently with the DUMP. **Blocked on §19.5 GWP-target-slot confirmation with Mel** before commit.

Non-blocking but worth queuing:
- **`4ld02f` duplicate `beam_id`** (Parity-A finding 2026-05-28) — re-mint one side; doesn't affect Parity-B parity numbers but the duplicate distorts the catalogue.
- **CCLIMB `chart-config.mjs` LCA_MODULES → TIME_HORIZONS** correction (handoff "NEXT SESSION #2") — entirely orthogonal but still pending.

### 19.4. Phased lift plan — getting from 37.1% to ≥50%

Each phase below states (a) what to do, (b) which in-scope fields it lifts, (c) a **rough** cell-count estimate (not a promise — the harness quantifies after each phase). Aggregate target: from current **5,235 matches → 7,050+** (50% of 14,100). **Phase 3 (true multi-product) puts us at 50%.**

**Phase 0a — `extractNA → extractCommon` move** (§19.3 item 1) ✅ **SHIPPED 2026-06-08.** Landed +176 matches (+1.2pp). Mostly G EPD Expiry +18.7pp, BD Validation +6.3pp, AZ EPD Type +2.8pp.

**Phase 0b — §18 normalization committed to the extractor** (§19.3 item 3). Pending §19.5 Mel confirmation on the GWP target slot. Won't change Parity-B numbers (harness already normalizes) but unblocks Goal-B form expansion.

**Phase 1a — AY EPD ID shape-aware regex** ✅ **SHIPPED 2026-06-08.** Landed +299 matches (+2.1pp), 36.1% → 80.6% on AY. Shape-aware patterns (SmartEPD dotted-numeric `4789…\.101\.1`, SCS-EPD, IBU `EPD-XXX-YYY-EN`, EPDITALY `YYYYMxxxxx`, BEPD, ITB/RTS, year-fractions, etc.) run before the loose label-anchor fallback — precise matches win and block the fallback from grabbing trailing junk.

**Phase 1b — BA Owner / BB Prepared by / BE Verifier / BH LCA Method / BI Software / BJ Database** ✅ **SHIPPED 2026-06-08.** Six new label-anchored extractors moved off 0%; landed +125 matches (+0.9pp). Manufacturer block also moved from `extractNA` to `extractCommon`. Modest percentages because BEAM stores varied forms per row.

**Phase 1c — per-column comparison relaxations** ✅ **SHIPPED 2026-06-08.** Reflects semantic equivalence of variant BEAM representations (this is a metric-accuracy correction, *not* a loosening — the DB still receives the parser's canonical form):
- **Substring tolerance** for org-name fields (BC, BF, BG, BA, BB, BE, BH, BI, BJ, J): "ASTM" ⊂ "ASTM International", "GaBi" ⊂ "GaBi 10", "Arcadia" ⊂ "Arcadia Inc.", "ISO 21930" ⊂ "ISO 21930:2017, EN 15804+A2".
- **Year-prefix tolerance** for G EPD Expiry: BEAM stores year-only "2021" → matches parser's "2021-08-11".
- **Case-insensitive default** (was opt-in for `kind: str`, now default; only `unit` stays case-exact): "Industry average" ≡ "Industry Average".

Landed **+1,390 matches (+9.9pp)**. Lifted BI 10.4%→55.2%, BF 0%→45.5%, AZ 24.4%→45.6%, BE 3.2%→42.7%, BG 0.6%→42.3%, BC 23.4%→35.8%, G 22.1%→34.6%, J 2.4%→34.3%, BH 3.0%→33.8%, BJ 7.8%→26.3%, BA 4.5%→13.2%.

**Phase 1 — string-normalization wins** (cheap, before multi-product). Each of these is the parser already extracting something close to the BEAM value but failing the comparison on case / whitespace / vocab. Fix in the harness's `compareCell` first (lower bar = more matches show as MATCH) OR in the extractor's output normalization (cleaner but bigger):
- **AY EPD ID content extraction** — lift to ≥80% with broader regex coverage. ~+300 matches.
- **AZ EPD Type enum** — keyword vocab expansion + tolerance for EPD-types not in the four canonical buckets. ~+260 matches.
- **BC Operator** — string-normalize accents/abbreviations ("CSA Group" ≈ "CSA"). ~+186.
- **AT Material Type** — vocab expansion. ~+125.
- **J Manufacturer** — trim + casefold + drop common suffixes ("Inc.", "Ltd."). ~+320.
- **G Expiry** — accept ISO date / "Valid until X" / "YYYY-MM-DD" / bare-year forms uniformly. ~+380.
- **O Markets of Applicability** — parser extracts, format mismatch. ~+332.
- **BF Standards** — array → comma-string normalization. ~+140.
- **BG PCR** — substring-match tolerance. ~+200.

Phase 1 lift estimate: ~+2,200 matches (Phase 1a + 1b + 1c already booked **+1,814**, putting Phase 1 ahead of the original target). Cumulative actual: **35.3%** (4,973 / 14,100, including Phase 2a + 2b + 2c + 2d + 2e + 2f + 2g + 2h + 2i + 2j + 2k). Remaining Phase 1 headroom: AZ French/EU prose patterns (FDES not caught), BC/BG/BF expanded substring catches, more known-LCA-org / known-verifier entries.

**Phase 2 — new-field extractors** (still pre-multi-product). Each field below is *not currently extracted at all*. Most are textually clear in EPDs (label-then-value). Cost: ~1 day each, less in batch:
- **BA EPD Owner** (515 pop) — usually "Declaration Owner: X" or "Owner of Declaration: X". ~+260.
- **BB Prepared by** (643 pop) — "LCA prepared by:" or "EPD prepared by:". ~+320.
- **BE Verifying Agent** (503 pop) — "Verified by:" or "Verification by:". ~+200.
- **BH LCA Method** (399 pop) — "TRACI 2.1", "EN 15804+A2", "ISO 21930". ~+120.
- **BI LCA Software** (308 pop) — "GaBi", "SimaPro", "openLCA". ~+100.
- **BJ LCI Database** (308 pop) — "Ecoinvent 3.x", "GaBi Professional". ~+100.
- **BK Service Life** (168 pop) — usually a single labelled integer. ~+70.
- **AI/AJ Additional factor + units** (~190 pop each). ~+110.

Phase 2 lift estimate: **+1,280 matches** → cumulative ≈ **35–36%**.

**Phase 3 — multi-product extraction** (§16.1 Follow-up #4, §14 LLM-as-parser). The single biggest unlock and the phase that puts us at the 50% target. Currently every multi-product EPD scores its per-product fields at near-0% across all N rows; with N records per PDF correctly aligned to the N BEAM rows, the per-product fields (`AG/AH` density, `AI/AJ` factor, `Q` stated GWP, sometimes `AK–AR` dimensions) lift dramatically:
- 30+ multi-product EPDs × average 10–24 rows × ~5–8 per-product fields each → ~1,500–2,500 cells become eligible to MATCH.
- Realistic landing: **+1,800–2,500 matches**.

Phase 3 lift estimate: **+2,000 matches** → cumulative ≈ **50%** ← **target hit**.

**Phase 4 — dimensions / thermal / mass** (`AK–AR`). Variable population (6–115 pop each), often present in EPDs as a product-specs block. Likely needs a layout-aware sub-extractor or template per format. ~+200 matches → cumulative ≈ **51%**.

**Phase 5 — the long tail + LLM-as-parser** (§14). Optional headroom. After Phase 3's 50%, additional gains across format variance in the 301-set diminish for pure-regex work. The internal LLM-as-parser path closes the format-variance gap on Phase 1–2 fields (manufacturer, dates, type, validation), nails multi-product disambiguation natively, and reaches the long-tail fields (specifications, notes, brand variants) at higher recall. §14 documents this as "the Last Mile"; Parity-B's Pass-1 numbers are the concrete justification.

Phase 5 lift estimate: **+1,500–2,500 matches** if implemented across the weak fields → cumulative **≈ 62–69%**. (Headroom above that is bounded by genuine EPD-content variance, not architecture.)

### 19.4.1. Methodology for the remaining 0% in-scope fields (Andy 2026-06-08)

After Phase 1c + 2e + 2f the remaining 0% fields (`I`, `L`, `W`, `AI`, `AJ`, `AM`–`AS`) are real extractor gaps, not metric artifacts. (R lifted via Phase 2e harness `unitNorm`; AK/AL lifted via Phase 2f extractor + numericApprox — semantic equivalence between BEAM's short/rounded form and parser's prose/computed form, parallel to Phase 1c. K stays low but isn't a harness-tolerance candidate — BEAM's curated short-brands genuinely diverge from EPD brand-line text.) Andy 2026-06-08 directive: **"Look at known BEAM values, look up the PDF, discover why the parser can't find it."** Apply this methodology to every remaining multi-fail field instead of guessing regex shapes:

1. Pick a row where BEAM has a populated value for the field (sheet1-beam.csv).
2. Find the corresponding PDF (filename prefix = canonical epd.id).
3. Probe the PDF text for what the EPD actually says — does it use a structured label, prose narrative, address block, or nothing at all? (Use `schema/scripts/_probe-pdf.mjs <path> <searchTerm…>`.)
4. Design the extractor against the *real* EPD evidence; verify on canonical-30 (§7.6) + Parity-B.

**First probe (N Country of Manufacture, Kalesnikoff CLT EPD 295):** the EPD has **no** "Country of manufacture" field. The country appears only in prose ("Located in Canada's West Kootney's mountains…", "procured from sustainably managed forests in Canada"). And a second probe on an industry-average EPD (EPD10092) found **no country prose at all** — averages don't have a single source country. So N extraction needs prose-pattern matching for single-manufacturer EPDs, and accepts non-extraction for industry-averages (whose BEAM value is BfCA-assigned region).

This is the playbook for the rest of Phase 2: probe → design → verify.

### 19.5. Open questions + risks (flag before Phase 0)

- **GWP target slot — confirm with Mel** (carry-over from §18.4). The parser's `impacts.gwp_kgco2e.total.value` is currently mapped to `carbon.stated.value_kgco2e` (Q). The importer overloads the `impacts.gwp` slot with the *common* value (S). Wrong mapping silently mis-labels an EC number across hundreds of rows. **Confirm before Phase 0 commits §18 to the extractor.**
- **Harness tolerance vs extractor normalization** — many Phase 1 lifts can be done either by loosening `compareCell` (cheap, immediate) OR by normalizing the extractor's output (cleaner, durable, also helps the form). Phase 1 should split: harness tolerance for the comparison-only gaps (e.g., trim+casefold), extractor changes for the gaps that should also surface to the form/export.
- **Multi-product extraction without LLM** is possible but format-specific (column-walking regex per format family). The cost-benefit vs Phase 6's LLM path should be revisited after Phase 0–2 numbers land.
- **`docs/PDF References/Confirmed EPDs (as listed in BEAM)/`** is gitignore-protected; the harness will silently produce zero scored rows on a fresh checkout. The harness already errors helpfully if the folder is missing; document the path in `Database.md` if the team will run it.

### 19.6. Acceptance for today

This section IS today's deliverable. The Pass-1 harness shipped (`schema/scripts/csv-pdf-parity.mjs`); the run results are committed at `docs/workplans/parity-B/`; the plan above is the actionable map. Phase 0 is the **first concrete coding step next session** — quick, blocker-clearing — followed by Phase 1 string-normalization wins to validate the lift hypothesis with a re-run.

---

## Iteration infrastructure (planned)

- **`npm run serve`** — already in place, no-cache dev server on port 8000. Drop EPD samples into `docs/pdf-samples/epd/` (parallel to `docs/pdf-samples/sample-metric.pdf` already used by PDF-Parser) for repeatable testing.
- **CLI harness** — extend the existing `npm run debug:pdf` (PDF-Parser's text-dump tool) to support an `--epd` mode that runs the EPD-Parser extraction logic against a PDF and emits the candidate JSON, for fixture-style regression once samples land.
- **Playwright MCP** — same `pdf-parser-tab` named-tab pattern; verifies the drop → extract → review → export flow end-to-end against real EPDs.

## Git workflow

Same as PDF-Parser ([`docs/workplans/MAGIC.md`](MAGIC.md) §5):

- Feature branch off `main` once P0 starts.
- Commit + push to both remotes (`openbuilding` = arossti/OpenBuilding; `origin` = bfca-labs mirror).
- Never push to `main`, never force-push, never `--no-verify`.
- Schema-validate any emitted JSON via [`schema/scripts/validate.mjs`](../../schema/scripts/validate.mjs) before push.
