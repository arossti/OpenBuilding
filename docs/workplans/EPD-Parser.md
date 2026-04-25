# EPD-Parser — workplan (EPD-Parser.md)

> Browser-native parser for Environmental Product Declaration PDFs. Drops an EPD, extracts the EN 15804+A2 fields that populate the BfCA materials schema, and routes the result into a human-reviewed commit flow — either a fresh database entry or a side-by-side update of an existing one. Sibling app to PDF-Parser. Branch: TBD. Status: planning, scoping 2026-04-24.

---

## 0. Current state (2026-04-24)

**Status:** scoping. No branch yet. Card stubbed on the landing page with a `Planning` badge linking to `epdparser.html` (which 404s until the shell lands).

**Inputs gathered for this plan:**
- PDF-Parser architecture inventory (rendering, text extraction, file-load, persistence, export — all reusable for a text-only sibling).
- BfCA schema inventory ([`schema/material.schema.json`](../../schema/material.schema.json), [`schema/sample.json`](../../schema/sample.json), the eight `schema/materials/*.json` group files, the five `schema/lookups/*.json` enum tables).
- Existing CSV importer ([`schema/scripts/beam-csv-to-json.mjs`](../../schema/scripts/beam-csv-to-json.mjs)) — its normalize helpers are the reference implementation EPD-Parser will share.

**Pending from user:** sample EPD PDFs (any program operator). Parser heuristics — anchor strings, table layouts, indicator name variants — calibrate against real samples; the workplan is deliberately silent on regex specifics until samples land.

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
5. **Defer database write-back.** v1 emits a JSON download of the merged record; the user merges into `schema/materials/*.json` via a separate script (or by hand) on disk. Direct browser-side writes to source-of-truth files isn't safe in a Pages-deployed context, so v1 stays read-only against the schema.

## 3. Architecture

Same shell language as PDF-Parser — toolbar + sidebar + main area — but slimmed down for a text-extraction workflow.

```
┌─ toolbar ───────────────────────────────────────────────────────────────┐
│ [Drop EPD] [Extract] [Match]   page 1/N   zoom  ◇      [Export JSON]    │
├─ sidebar ──────────────────────┬─ viewer ───────────────────────────────┤
│ ┌ Extracted fields ─────────┐ │                                         │
│ │ Manufacturer: Nordic      │ │                                         │
│ │ Product: NorXLam CLT      │ │           rendered EPD page             │
│ │ EPD #: 5960-4998 (CSA)    │ │                                         │
│ │ Valid: 2023-01 → 2028-12  │ │           (read-only, scrollable)       │
│ │ Density: 456 kg/m³        │ │                                         │
│ │ ─────                     │ │                                         │
│ │ GWP-A1A3: 6.22 kgCO₂e/m³  │ │                                         │
│ │   (table, all stages)     │ │                                         │
│ └───────────────────────────┘ │                                         │
│ ┌ Match status ─────────────┐ │                                         │
│ │ ⚠ Match found: lam011     │ │                                         │
│ │   [Review diff]           │ │                                         │
│ └───────────────────────────┘ │                                         │
└────────────────────────────────┴─────────────────────────────────────────┘
```

Sidebar fields are editable — the user can correct any extraction error before commit. Edits propagate live into the candidate JSON shown in the export panel.

## 4. Reusable plumbing

Concrete file paths from the PDF-Parser inventory. Each is reused as-is unless flagged.

| File | Reused for | Notes |
|---|---|---|
| [`js/pdf-loader.mjs`](../../js/pdf-loader.mjs) | PDF load + page render + `getTextContent()` | Wholesale. Drop `getOperatorList()` (vector-geometry only). |
| [`js/canvas-viewer.mjs`](../../js/canvas-viewer.mjs) | Canvas pair + zoom/pan | Strip the polygon-overlay draw callback. |
| [`js/app.mjs:144–193`](../../js/app.mjs) | File-drop + `_loadFile` lifecycle pattern | Copy the pattern, not the file — `app.mjs` is PDF-Parser-specific. |
| [`js/shared/indexed-db-store.mjs`](../../js/shared/indexed-db-store.mjs) | Per-project autosave + restore | Pattern reuse; project shape differs (no pages array, no polygons — instead `epdSourceFile`, `extractedFields`, `matchedRecordId`, `commitDecisions`). |
| [`schema/scripts/beam-csv-to-json.mjs`](../../schema/scripts/beam-csv-to-json.mjs) | `makeId`, `normaliseCountry`, `inferGroupPrefix`, `yearOrSerialToExpiryIso` | **Refactor.** Extract these into a shared module (`schema/scripts/lib/normalize.mjs` for Node + a browser ESM mirror for the parser). One implementation, two consumers. |
| [`schema/scripts/validate.mjs`](../../schema/scripts/validate.mjs) | Live schema validation in the review UI | Already zero-dep. Wrap as ESM, expose `validateRecord(record, schema)` returning `{ok, errors[]}`. |
| [`schema/lookups/material-groups.json`](../../schema/lookups/material-groups.json) | Group-prefix → label mapping | Read at startup. |
| [`schema/lookups/material-type-to-group.json`](../../schema/lookups/material-type-to-group.json) | Material-type → 2-digit prefix | Primary inference. |
| [`schema/lookups/display-name-keywords.json`](../../schema/lookups/display-name-keywords.json) | Display-name → group fallback | Used when material-type lookup misses. |
| [`schema/lookups/country-codes.json`](../../schema/lookups/country-codes.json) | Free-text country → ISO 3166-1 alpha-3 | Manufacturer + provenance. |
| [`schema/lookups/lifecycle-stages.json`](../../schema/lookups/lifecycle-stages.json) | A1–D canonical order + scope presets | Validate stage arrays; understand cradle-to-gate vs cradle-to-grave. |
| [`schema/lookups/typical-elements.json`](../../schema/lookups/typical-elements.json) | Building-element enum + product_subtype overrides | Inferred from the EPD's product description. |

### CSS

No new sections in [`bfcastyles.css`](../../bfcastyles.css). EPD-Parser reuses §5 (PDF-Parser shell), §3 (toolbar primitives), §4 (status chips, table styles, button language), with at most a small EPD-specific subsection if the side-by-side diff view needs custom rules.

### HTML page

`epdparser.html` at repo root, modeled on [`pdfparser.html`](../../pdfparser.html). Add `<html class="theme-dark app-pdfparser app-epdparser">` so existing PDF-Parser rules apply by default; add a narrow `.app-epdparser` override block in `bfcastyles.css` only for fields the geometry UI doesn't have.

### Deploy

[`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml) line 47 — append `epdparser.html` to the `cp` list **only when the page actually exists**, not before.

## 5. Schema mapping

Source: [`schema/material.schema.json`](../../schema/material.schema.json). Reference complete record: [`schema/sample.json`](../../schema/sample.json) (lam011, Nordic CLT — every field populated, every nested impact slot present).

| EPD-PDF section (typical heading) | Schema target |
|---|---|
| Declaration holder / Manufacturer | `manufacturer.name`, `manufacturer.country_code` |
| Product description | `naming.display_name`, `naming.product_brand_name` |
| EPD identification (EPD number, programme operator, dates) | `epd.id`, `epd.program_operator`, `epd.publication_date`, `epd.expiry_date` |
| EPD type (product-specific / industry-average / generic) | `epd.type` (enum: `product_specific` \| `industry_average` \| `generic` \| `beam_average`) |
| Verification statement | `epd.validation.type` (enum: `internal` \| `external` \| `null`) |
| Declared / functional unit | `carbon.stated.per_unit`, `carbon.common.per_functional_unit` |
| Density / mass per declared unit | `physical.density.value_kg_m3` (with `source: "epd"`) |
| LCA results table — GWP total | `impacts.gwp_kgco2e.total.{value, source}` |
| LCA results table — GWP biogenic | `impacts.gwp_bio_kgco2e.total.{value, source}` |
| LCA results table — per-stage values (A1, A2, A3, A1–A3, A4, A5, B1–B7, C1–C4, D) | `impacts.<indicator>.by_stage.<stage>.{value, source}` — emit all 17 stage slots even if null |
| Other indicators (ODP, AP, EP, POCP, ADP, WDP, primary energy NR + R) | `impacts.{ozone_depletion, acidification, eutrophication, smog, abiotic_depletion_fossil, water_consumption, primary_energy_nonrenewable, primary_energy_renewable}.*` |
| Methodology / standards | `methodology.standards[]`, `methodology.lca_method` |
| **PCR (Product Category Rules) reference** | `methodology.pcr_guidelines` — free-text string (e.g. "ULE Structural and architectural wood products, v1.1"). Treated as a **first-class match key** in §6. Two EPDs published under different PCRs (or different PCR versions) are not directly comparable and cannot refresh each other. |
| LCA software | `methodology.lca_software` |
| LCI database (e.g. ecoinvent 3.x) | `methodology.lci_database` |
| Geographic scope / markets | `provenance.countries_of_manufacture[]`, `provenance.markets_of_applicability[]` — also a match key in §6. CA-scope and US-scope EPDs of the same product are **separate records**, never merged. |
| (Derived) group classification | `classification.group_prefix`, `classification.category_slug`, `classification.material_type`, `classification.typical_elements[]` |

**Group classification is inferred, not extracted.** Run `inferGroupPrefix(material_type, display_name)` against [`material-type-to-group.json`](../../schema/lookups/material-type-to-group.json) first, falling back to [`display-name-keywords.json`](../../schema/lookups/display-name-keywords.json). If both miss, the field stays null and the review UI flags it for manual selection.

**No IP-restricted terminology** — `CSI`, `MasterFormat`, `Division`, `MCE²`, `NRCan`, Crown-copyright tool names — appears in the parser, the UI strings, the emitted JSON, or this workplan. Numeric `group_prefix` (`03`, `06`, `09`, `31`, …) is the only classification convention used.

## 6. Match-existing logic

**Default to new entry. Only refresh an existing record when every high-fidelity match key agrees.** EPDs published under different PCRs, different geographic scopes, or by different program operators describe distinct products from the database's perspective, even when the underlying material is "the same" in casual language. The cost of a false-positive merge (silently overwriting a US-scope record with CA-scope numbers) is much higher than the cost of a false-negative (one extra database row).

### Match keys, all required for a refresh

A candidate refresh fires only when **all** of the following match between the incoming EPD and an existing record:

| Key | Source field | Match rule |
|---|---|---|
| Manufacturer | `manufacturer.name` | Normalised exact match (case-fold, strip punctuation, collapse whitespace). |
| EPD identifier | `epd.id` | Exact string match — EPDs are uniquely numbered per program. |
| PCR reference | `methodology.pcr_guidelines` | Exact match including version suffix. **A PCR version bump (v1.1 → v2.0) is treated as a different PCR, hence a different record.** |
| EPD source-document URI | `epd.source_document_url` | Exact match when both records have one. URI is the strongest single signal; if it matches, everything else has to too or the data is corrupt. Field already exists in `material.schema.json`. |
| Geographic scope | `provenance.markets_of_applicability[]` | Set equality. CA ≠ USA ≠ NA-aggregate. Different scope = different record. |
| Program operator | `epd.program_operator` | Exact match. ULE-issued ≠ CSA-issued even when the manufacturer is the same. |

**Anything less than full agreement on every key → new entry.** The review UI does not offer a "force-merge" override; if the user genuinely wants to merge two near-matches, they edit the records by hand outside the parser.

### Algorithm

1. Compute the candidate's match-key tuple `(manufacturer, epd_id, pcr, uri, scope, program)`.
2. Scan the corresponding `schema/materials/<group>.json` for any record whose tuple matches **all six** keys.
3. **Hit** → flag as refresh candidate, route to the side-by-side review UI.
4. **Miss** → flag as new entry, route to the new-entry review UI. (Optional: surface near-matches — same manufacturer + same PCR but different scope, for example — as informational links in the new-entry UI: "this looks related to existing record `lam011` (US-scope); confirm this CA-scope EPD is meant to be a separate record.")

### Review UI — refresh-candidate path

- Two columns side-by-side. Left: existing record. Right: incoming parsed record.
- Each scalar field has a three-way toggle: `keep existing` / `take incoming` / `merge` (where merge is meaningful, e.g. arrays).
- Numeric fields show the delta — e.g. `gwp_kgco2e.total.value: 6.22 → 5.81 (-6.6%)` so the user can sanity-check.
- The `epd.publication_date` and `epd.expiry_date` fields auto-default to "take incoming" since refreshing the EPD is the whole point.
- The `provenance` block records the source EPD filename and parse timestamp regardless of which other fields were taken — audit trail.
- Final commit produces (a) a JSON download of the merged record, and (b) a small audit-log JSON describing every field decision (for a future regression test or trace-back).

### Review UI — new-entry path (the default)

- Single column. All extracted fields shown editable.
- Group classification flagged if `inferGroupPrefix` returned null.
- A "related records" panel surfaces any partial-match records (same manufacturer + same PCR, or same EPD-id with different scope) as read-only links, so the user can spot a configuration error (e.g. they were trying to refresh an existing record but a key didn't match) before committing a duplicate.
- User confirms → fresh `id` minted via `makeId()` → JSON download → done.

## 7. Phases

| Phase | Scope | Exit criterion |
|---|---|---|
| **P0 — Shell** | `epdparser.html` skeleton, `js/epdparser.mjs` ESM entry, drop-zone, status bar, viewer canvas. Reuses [`js/pdf-loader.mjs`](../../js/pdf-loader.mjs) + [`js/canvas-viewer.mjs`](../../js/canvas-viewer.mjs). Add to deploy-pages cp list. | Drop a PDF → it renders in the canvas. No extraction yet. |
| **P1 — Text extraction** | Wire `getTextContent()` per page, render a flat-text panel in the sidebar. | User can confirm against 3+ sample EPDs that the text-layer assumption holds (no scanned-only PDFs in the v1 sample set). |
| **P2 — Field extraction (heuristic v1)** | Anchor-based regex passes against the field groups in §5. Calibrate against the user's sample EPDs, one program operator at a time (CSA first if any of the samples are Canadian; IBU / EPD International / UL Environment as available). Sidebar fields populate as they're extracted. | At least 80% field coverage on the calibration set, with confidence chips for low-certainty extractions. |
| **P3 — Schema mapping + validation** | Pipe extracted fields through the shared normalize module + the browser validator. Show schema errors live. Emit a candidate JSON record. | A complete-shape JSON record validates clean against `material.schema.json` for every calibration sample. |
| **P4 — Match + review UI** | Implement §6 — DB match algorithm + side-by-side diff UI + per-field commit decisions. | Both pathways (new + update) produce a downloadable JSON record + audit log. |
| **P5 — Persist** | JSON download wired up. (No browser-side write to `schema/materials/*` — that's a separate non-browser concern.) | User can ingest a new EPD end-to-end and produce a record they could merge into the database via a separate Node script. |
| **P6 — Refresh queue (DB-driven entry point)** | Second entry point next to drag-drop: a "Refresh queue" view that loads `schema/materials/*.json`, sorts by `epd.expiry_date` (expired records first, expiring-within-12-months next), and for each row offers a "Find refresh" action. The action displays a templated search query (`<manufacturer> <product_brand_name> EPD <expiry_year + 1>`) and direct links to the originating program-operator registries when known (CSA, ULE, EPD International, IBU). The team member runs the actual web search externally — likely with Claude Code's WebSearch / WebFetch tools in a parallel session, since this is an internal-only tool — and pastes the candidate PDF URL back into the parser. The parser fetches and runs the existing P1–P5 pipeline, with the expired record pre-loaded as the candidate refresh target. The §6 strict match still applies: if the new EPD's PCR / scope / program differs, the user is shown the "looks like a new entry, not a refresh" path and the old expired record stays untouched. | Team can clear the expired-record backlog systematically: open the queue, walk down the list, find candidate URLs, parse, review, commit a refresh or a new entry per record. |
| **P7 — Coverage hardening** | OCR fallback (Tesseract.js) for scanned EPDs. Bulk multi-EPD upload. Cross-reference to program-operator online registries (CSA, ULE, EPD International) where public APIs exist — could partially automate the URL-finding step in P6. Optional: in-browser Anthropic API call to auto-suggest refresh URLs (back-office only, never shipped on the public Pages build). | Nice-to-have; gated on real demand once P6 is in regular use. |

## 8. Open questions / pending samples

Decisions deferred until the user shares sample EPDs:

- **Program-operator coverage.** Which EPD programs are highest-priority for the Canadian market? CSA, ULE, EPD International, IBU, ASTM/Inventory of Carbon and Energy — each has a different table layout and naming convention. Calibration order set by what's in the samples.
- **Multilingual EPDs.** Some Canadian EPDs publish in EN and FR side-by-side. Does the parser default to EN-only, or detect and prefer one based on the EPD program?
- **EPD-internal vs external verification.** Programmes label this differently ("verified by", "third-party verification statement", "Type III declaration verified per ISO 14025"). Need samples to land on a robust anchor set.
- **Industry-average treatment.** When `epd.type` parses as `industry_average`, is `manufacturer.name` blank, the trade association name (e.g. "Concrete BC"), or omitted entirely from the schema? Schema allows it nullable; the convention isn't documented yet.
- **Density inference.** EPDs sometimes state mass per declared unit (e.g. "1 m³ of CLT, 456 kg") instead of density directly. Parser needs to compute density when only mass-per-unit is published. Trivial when the unit is m³; less so for "1 m² of XPS at 25 mm thick" — depends on having thickness in scope.
- **PCR-version handling on a refresh.** §6 says a PCR version bump is a new record. That's correct in the strict-LCA sense (different boundaries, possibly different allocation) but may be more conservative than the user wants for minor-version updates (v1.1 → v1.1a errata). Open: do we want a soft-match flag for same-PCR-base, different-revision pairs, surfaced as "candidate refresh — confirm PCR revision is a minor update"?
- **Refresh-queue websearch integration (P6).** Three plausible designs, decision deferred to when P6 is being built. (a) **External, recommended for v1**: parser surfaces a templated search query and registry links; staff runs Claude Code in a parallel session to do the actual search, pastes the candidate URL back. Lowest friction, no API plumbing, fits "this is done internally by the team using Claude." (b) **In-browser API**: parser calls the Anthropic API directly with a tool-use loop to find and short-list candidate URLs; API key supplied at runtime via `localStorage`, never shipped to public Pages. Heavier; only worth it if the workflow gets repeated dozens of times per session. (c) **Hybrid**: parser auto-formulates queries and opens program-operator registry pages in new tabs; user reviews, pastes URLs back. Middle ground.
- **Production deployment of back-office tools.** EPD-Parser, the database viewer, and possibly the dependency manifest are internal maintenance tools that public users shouldn't see. Options when production deployment becomes a concern: (a) GitHub Pages auth-gate via Cloudflare Access or similar; (b) a separate staging Pages build that includes the back-office cards, and a production build that omits them; (c) keep one build but hide the cards behind a query-string flag (e.g. `?dev=1`). Out of scope for v1; flagged so the choice doesn't sneak up on us.

## 9. IP guardrails

(Restated from `CLAUDE.md` because they apply here forever, not just at v1.)

- **Forbidden in code, UI, fetched JSON, served docs:** `CSI`, `MasterFormat`, `Division`, `MCE²`, `NRCan`, Crown-copyright tool names. Numeric 2-digit `group_prefix` (`03`, `06`, `09`, `31`, …) under `classification.group_prefix` is fine and stays.
- **No positioning as a port of MCE² or any NRCan tool.** EPD-Parser is a BfCA original. Schema citations to standards documents (ISO 14025, EN 15804+A2) are factual and stay.
- **Concern is spider-trolls scraping the deployed Pages site.** Anything served (`epdparser.html`, `js/epdparser*.mjs`, JSON it fetches, this workplan once published) is in scope for the rule.

## 10. Out of scope (v1)

- OCR (Tesseract.js fallback) — P6 phase, gated on real demand.
- Direct browser-side writes to `schema/materials/*.json`. Pages is read-only; the commit pathway is JSON download + manual merge or a small Node merge script.
- Scraping EPD-program registries (CSA, IBU, EPD International). Future enhancement; rights vary by program.
- Generating BfCA-internal `beam_id` values for new entries. New IDs come from `makeId(slug)` (random alphanumeric per the existing convention); no semantic meaning baked in.
- Regression test fixtures for the parser. Defer until at least one real EPD sample is in repo (likely under `docs/pdf-samples/epd/` once the user shares).

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
