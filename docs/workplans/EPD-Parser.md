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
| **Lifecycle / soft-delete state** | `status.{listed, do_not_list, is_industry_average, is_beam_average, visibility}` — already in the schema and already in production use (43 of 821 records carry the soft-hide combo). Existing `visibility` enum is `public \| hidden \| deprecated`; **a small extension adds `flagged_for_deletion` plus a sibling `status.deletion_note: string` field** (proposed in [`Database.md`](Database.md) §3). EPD-Parser sets `status.visibility = "public"` on new records; refreshes preserve the existing `status` block unless the user explicitly re-flags. **Hard delete is forbidden.** |
| **Reviewer / editor audit** | `provenance.review_audit[]` (proposed — append-only array of `{editor, date, action, source}` entries, one per edit). Auto-populated at hand-off with the team-member name (from `localStorage`), ISO timestamp, action verb (`epd-parser-extract`, `manual-edit`, `flag-for-deletion`, `restore`), and EPD source filename. Existing `provenance.data_added_or_modified` (free-text date string) and `provenance.import_metadata.{imported_from, import_date}` stay populated where they are; the new array is the structured trail going forward. Schema bump scoped in [`Database.md`](Database.md) §3. |

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

- **Trust** (`bi-lightning-charge`) — one-click commit. New entries: writes record + appends audit row + mints `id` via `makeId()`. Refresh candidates: takes incoming record fully, no per-field diff. Status echoes BEAM: *"Trust: committed lam011 from 2023 BC Wood CLT EPD ASTM.pdf · click Trust + Verify to audit"*.
- **Trust + Verify** (`bi-file-earmark-ruled`) — opens the side-by-side diff (refresh) or the new-entry confirmation form (new). Per-field three-way toggle, audit trail. Always available; user can re-audit even after a Trust commit.

UX wording mirrors the existing PDF-Parser → BEAM bridge so muscle-memory transfers from the validated flow.

## 7. Phases

| Phase | Scope | Exit criterion |
|---|---|---|
| **P0 — Shell** | `epdparser.html` skeleton, `js/epdparser.mjs` ESM entry, drop-zone, status bar, viewer canvas. Reuses [`js/pdf-loader.mjs`](../../js/pdf-loader.mjs) + [`js/canvas-viewer.mjs`](../../js/canvas-viewer.mjs). Add to deploy-pages cp list. | Drop a PDF → it renders in the canvas. No extraction yet. |
| **P1 — Text extraction** | Wire `getTextContent()` per page, render a flat-text panel in the sidebar. | User can confirm against 3+ sample EPDs that the text-layer assumption holds (no scanned-only PDFs in the v1 sample set). |
| **P2 — Field extraction (heuristic v1)** | Anchor-based regex passes against the field groups in §5. Calibrate against the user's sample EPDs, one program operator at a time (CSA first if any of the samples are Canadian; IBU / EPD International / UL Environment as available). Sidebar fields populate as they're extracted. | At least 80% field coverage on the calibration set, with confidence chips for low-certainty extractions. |
| **P3 — Schema mapping + validation** | Pipe extracted fields through the shared normalize module + the browser validator. Show schema errors live. Emit a candidate JSON record. | A complete-shape JSON record validates clean against `material.schema.json` for every calibration sample. |
| **P4 — Match + form pane** | Render the editable schema-shape form on the right pane (per §3 mockup). Run the §6 six-key match against the DB. Surface match outcome in the form's status banner. Auto-stamp a `provenance.review_audit[]` entry. **Side-by-side diff lives in the database viewer**, not here — see [`Database.md`](Database.md) §5. | Form populated, match outcome surfaced, audit entry stamped. |
| **P5 — Auto-save to pending queue** | Form-pane edits debounce-write the candidate record + audit metadata to the shared `pending_changes` IndexedDB table. Toolbar gets an "↗ Open Database to commit" navigation link that opens `database.html` (where the Trust / Trust + Verify buttons live). No commit/send button on this side — same shape as PDF-Parser → BEAM. JSON download stays available as a fallback for external-review cases. | Drop an EPD → edit form → open Database → entry shows up in the pending-changes panel ready for Trust / Trust + Verify. |
| **P6 — Refresh queue (DB-driven entry point)** | Second entry point next to drag-drop: a "Refresh queue" view that loads `schema/materials/*.json`, sorts by `epd.expiry_date` (expired records first, expiring-within-12-months next), and for each row offers a "Find refresh" action. The action displays a templated search query (`<manufacturer> <product_brand_name> EPD <expiry_year + 1>`) and direct links to the originating program-operator registries when known (CSA, ULE, EPD International, IBU). The team member runs the actual web search externally — likely with Claude Code's WebSearch / WebFetch tools in a parallel session, since this is an internal-only tool — and pastes the candidate PDF URL back into the parser. The parser fetches and runs the existing P1–P5 pipeline, with the expired record pre-loaded as the candidate refresh target. The §6 strict match still applies: if the new EPD's PCR / scope / program differs, the user is shown the "looks like a new entry, not a refresh" path and the old expired record stays untouched. | Team can clear the expired-record backlog systematically: open the queue, walk down the list, find candidate URLs, parse, review, commit a refresh or a new entry per record. |
| **P7 — Coverage hardening** | OCR fallback (Tesseract.js) for scanned EPDs. Bulk multi-EPD upload. Where program operators publish *public* registry APIs (CSA, ULE, EPD International), wrap them as direct lookups to partially automate the URL-finding step in P6. **No browser-side Anthropic API integration** — see §8. | Nice-to-have; gated on real demand once P6 is in regular use. |

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

| Sample | Format | Pages | Items / p | PCR | DECL # | DUNIT | PROG | ISO 14025 | ISO 21930 | EN 15804 |
|---|---|---|---|---|---|---|---|---|---|---|
| 2013 BC Wood LVL EPD | UL Env, NA industry-avg | 16 | 84 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · |
| 2017 BC Wood WRC AWC EPD | UL Env, NA industry-avg | 17 | 195 | ✓ | · (per-glyph "D ECLARATION") | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2022 BC Wood CLT Kalesnikoff | UL Env, manufacturer-specific | 12 | 172 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · |
| 2023 BC Wood GLT EPD ASTM | ASTM, manufacturer-specific | 11 | 178 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| EPD Sopra-XPS | ASTM, manufacturer-specific (EU mfr.) | 33 | 145 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| EPD Wood Fibre Insulating Boards | IBU, EU manufacturer | 10 | 201 | ✓ | ✓ | ✓ | · ("Programme holder") | ✓ | · | ✓ (`+A1`) |
| EPD Genyk SPF (multi-product) | ASTM, manufacturer-specific | 40 | 250 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 2015 LSL Summary (condensed EPD) | AWC/CWC, "Transparency Summary" | 2 | 230 | ✓ | · | ✓ | · | ✓ | · | · |
| Boreal Nature Elite TDS | **NOT an EPD** (data sheet) | 2 | 234 | · | · | · | · | · | · | · |
| EPD Polyiso walls | **No text layer** (scanned PDF) | 23 | 0 | · | · | · | · | · | · | · |

Boreal TDS and Polyiso walls are both rejection cases but for **different reasons** — Boreal has text but no EPD anchors; Polyiso has zero items per page (image-only PDF). The parser must distinguish: "no anchors" → not an EPD (or wrong file type), vs. "no items at all" → text-layer empty, OCR needed.

### Edge cases discovered in this calibration round

**Multi-product EPDs (Genyk).** A single PDF can declare multiple products. The Genyk omnibus EPD covers three SPF products on one declaration: `Boreal Nature Elite`, `Duraseal`, `Floraseal 50`. Verbatim from page 1: *"Genyk is pleased to present the environmental product declaration (EPD) of three spray polyurethane foams (SPFs)…"* P2 must detect this case (look for plural "products" in the declared-product field, or multiple product-brand-name candidates) and either:
- Surface a "multi-product EPD detected — pick which product this record represents" disambiguation in the form pane, or
- Split into N separate `pending_changes` queue entries (one per product), each pre-filled with the same shared fields (manufacturer, dates, PCR, methodology).

The shared fields are: declaration holder, dates, PCR, program operator, methodology. Different per-product: `naming.product_brand_name`, `physical.density.value_kg_m3` (per-product densities are listed separately), and the impact values (each product gets its own GWP / EP / ODP table).

Side-note: this is also why **Boreal Nature Elite** has both a Genyk-omnibus EPD (this file) and a Boreal-branded TDS (the rejection-test sample). The TDS isn't the wrong file — there *is no* product-specific EPD for Boreal; its EPD lives inside Genyk's omnibus. P2 needs to know that a TDS with no anchors isn't necessarily "the wrong document"; it might just be "this product's EPD is bundled elsewhere."

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

| Source | Format | Example |
|---|---|---|
| UL Env / ASTM (modern) | `DD Month YYYY` | `16 December 2021` |
| UL Env / ASTM (period) | `Mon YYYY – Mon YYYY` | `December 2021 – December 2026` |
| IBU / EU | `DD/MM/YYYY` | `30/10/2020`, `08/10/2025` |
| BC Wood older (2013) | `YYYY-MM-DD` | `Issued: 2013-MM-DD` |

P2 date parsing needs a multi-format walker. ISO normalization is the §5 schema target.

### Declared-unit hints (informs the §8 density-inference question)

| Material class | Unit pattern | Density resolution |
|---|---|---|
| Solid wood (CLT, GLT, LVL, SPF, Plywood) | `1 m³` | density direct |
| Wood-fibre insulating boards | `1 m³ … average weighted density of 167 kg/m³` | density stated explicitly |
| XPS / polyiso / mineral wool | `1 m² … RSI = 1 m²·K/W` (m² + thickness + R-value) | **needs separate density extraction**, often elsewhere in the doc |

The Sopra-XPS m²-with-thickness pattern is the §8 open question becoming concrete. P2 should: (1) detect the unit pattern, (2) if m² + thickness, scan for explicit `<N> kg/m³` density elsewhere on the cover or general-information page, (3) if not findable, leave `physical.density.value_kg_m3` null and flag in the form pane.

### Concrete P2 strategy

Build P2 as a sequence of anchor passes:

1. **Format detection** — search page 1+2 for either family-A keywords (`PROGRAM OPERATOR`, `DECLARATION HOLDER`) or family-B keywords (`Programme holder`, `Owner of the Declaration`). Set `format = "NA"` or `format = "EU"`.
2. **Anchor-and-capture per field**, using format-specific regex. Each anchor returns `{value, page, confidence}`.
3. **Threshold check** — if fewer than 4 of {PCR, DECLARATION_NUMBER, DECLARED_UNIT, ISO 14025, EN 15804, PROGRAM_OPERATOR} hit, the document is flagged as not-an-EPD and the form pane shows a warning banner ("This doesn't look like a standard EPD — review fields before commit").
4. **Date normalization** — multi-format walker normalizes to ISO 8601 for `epd.publication_date` and `epd.expiry_date`.
5. **Unit + density resolution** — m³ direct vs m²+thickness lookup vs null + flag.

Per-EPD wood + insulation regression fixtures land as P3 work, drawing the seven calibration JSON dumps as ground truth.

## 10. Out of scope (v1)

- **OCR** (Tesseract.js fallback) — P7 phase. **Real demand confirmed in P1 calibration** (`EPD_Polyiso walls.pdf` is image-only, zero text-layer items). v1 detects this case and surfaces a "needs OCR" banner; the actual OCR pass lands in P7.
- **Hard delete of database records.** Forever. Soft-delete via `status.visibility = "flagged_for_deletion"` is the only deletion path; flagged records stay in `schema/materials/*.json` for back-office manual review (see [`Database.md`](Database.md) §6).
- **Direct browser-side writes to `schema/materials/*.json`.** Pages serves source data read-only. Commits flow EPD-Parser → shared IndexedDB → DB viewer → patch JSON download → Node patch script → git.
- **In-browser Anthropic API integration.** Ruled out for security (§8).
- **Scraping EPD-program registries** (CSA, ULE, IBU, EPD International). Where they expose public APIs, P7 may wrap them; without an API, the team uses the copy-paste-URL workflow (§8).
- **Generating BfCA-internal `beam_id` values for new entries.** New IDs come from `makeId(slug)` (random alphanumeric per the existing convention); no semantic meaning baked in.
- **Regression test fixtures for the parser.** Defer until calibration samples stabilize. Wood EPDs are now in `docs/PDF References/EPD SAMPLES/`; fixture extraction is a P3 follow-up.

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
