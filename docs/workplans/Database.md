# Database (back-office) — workplan (Database.md)

> The materials database viewer is the single point of commit for every mutation to `schema/materials/*.json`. EPD-Parser hands off candidate records via a shared IndexedDB queue; the database viewer surfaces them, runs the side-by-side review, captures per-field decisions, and emits patch JSON the team applies via a Node script + git. Soft-delete only — flagged records stay in the source-of-truth files for back-office manual review. Branch: TBD. Status: scoping 2026-04-25.

---

## 0. Current state (2026-04-25)

**Status:** scoping. No branch yet. Database viewer at [`database.html`](../../database.html) is **read-only** today — sortable, filterable table over 821 records with expandable per-record detail. No commit, replace, or delete UI.

**Soft-hide is already in production but undocumented.** A spot-check of the eight `schema/materials/*.json` files shows 43 records carry the combination `status.do_not_list: true` + `status.listed: false` + `status.visibility: "hidden"`. Whether [`beamweb.html`](../../beamweb.html)'s material picker honors this, and whether [`schema/materials/index.json`](../../schema/materials/index.json) excludes them, is **unaudited** and an early task here (D1 / D2).

**Sibling workplan:** [`EPD-Parser.md`](EPD-Parser.md). EPD-Parser produces; Database commits.

---

## 1. Goal & scope

Make the database viewer the unified commit point for the materials database:

- **Confirm new entry** from the EPD-Parser pending queue
- **Replace existing entry** with a refreshed version, after side-by-side review with per-field commit decisions
- **Flag for deletion** (soft-delete only — never hard delete)
- **Restore** a flagged-for-deletion entry
- **Manual edit** any field on any record (also routes through the same pending-changes queue for an audit trail)
- **Back-office review surface** for flagged-for-deletion records, so manual scrubbing is deliberate, not silent

**Audience:** internal BfCA team only. Public users see only `beamweb.html`. The card on `index.html` linking to `database.html` is dev-mode visibility — production deployment may auth-gate or omit it (see [`EPD-Parser.md`](EPD-Parser.md) §8 on production deployment).

## 2. Single source of truth — state model

The two back-office apps share state via [`js/shared/indexed-db-store.mjs`](../../js/shared/indexed-db-store.mjs). One store, two consumers — never two implementations of the same queue. Tables:

| Table | Writer | Reader | Purpose |
|---|---|---|---|
| `pending_changes` | EPD-Parser, DB-viewer (manual edits) | DB-viewer | Candidate records awaiting commit/reject. Cleared on commit. |
| `committed_patches` | DB-viewer | DB-viewer (export action) | Append-only log of committed decisions. Drives the patch-JSON download (§7). |
| `audit_log` | EPD-Parser, DB-viewer | DB-viewer (back-office review tab) | Optional; mirrors `provenance.review_audit[]` entries with cross-record context (e.g. "user X reviewed 12 records in this session"). |

```
EPD-Parser  ──[loadFile, extract, match, hand-off]──┐
                                                    ▼
                                       ┌─────────────────────────┐
                                       │  pending_changes (DB)   │ ← shared IndexedDB
                                       └─────────────────────────┘
                                                    ▲
DB-viewer  ──[manual edit, flag, restore]───────────┤
                                                    │
                                                    ▼
                                       ┌─────────────────────────┐
                                       │  committed_patches (DB) │
                                       └─────────────────────────┘
                                                    │
                                                    ▼ "Export patch"
                                       ┌─────────────────────────┐
                                       │   patch-NNNN.json       │ ← user downloads
                                       └─────────────────────────┘
                                                    │
                                                    ▼ npm run apply-patch -- patch-NNNN.json
                                       ┌─────────────────────────┐
                                       │ schema/materials/*.json │ ← source of truth
                                       └─────────────────────────┘
                                                    │
                                                    ▼ git commit + push
```

The `pending_changes` payload shape is defined in [`EPD-Parser.md`](EPD-Parser.md) §6 ("What gets handed off"). Manual edits in the DB viewer build the same payload shape so the consume code stays uniform.

## 3. Schema extensions

Three small additions to [`schema/material.schema.json`](../../schema/material.schema.json), all backward-compatible (must validate every existing record without modification).

### 3.1 `status.visibility` enum — add `flagged_for_deletion`

Current enum: `["public", "hidden", "deprecated"]` ([schema/material.schema.json](../../schema/material.schema.json) `status` block). Add `"flagged_for_deletion"` as a fourth value. Records with this visibility are excluded from BEAMweb's picker and `index.json` (D1 + D2 wiring), but stay in the per-group JSON files for back-office review.

### 3.2 `status.deletion_note: string | null`

New nullable string field on the `status` object. Captures *why* the record was flagged + *who* flagged it (free-text — e.g. "Superseded by lam011 refresh — flagged by andy@bfca on 2026-04-25"). Required when `visibility == "flagged_for_deletion"`, otherwise nullable.

### 3.3 `provenance.review_audit[]`

New append-only array of structured audit entries. Each entry:

```jsonc
{
  "editor":  "andy@bfca",          // free-text; team-member identity
  "date":    "2026-04-25T19:42Z",  // ISO 8601
  "action":  "epd-parser-extract", // enum: epd-parser-extract | manual-edit | refresh-replace | flag-for-deletion | restore | other
  "source":  "2023 BC Wood CLT EPD ASTM.pdf", // filename, URL, or null
  "note":    null                  // optional free-text
}
```

Existing fields stay populated:
- `provenance.data_added_or_modified` (free-text date string) — legacy; new mutations don't write this
- `provenance.import_metadata.{imported_from, import_date}` — legacy; written only by the original CSV importer

`review_audit[]` is the canonical audit trail going forward. The CSV importer should also append a `{action: "beam-csv-import", date, source: "BEAM Database-DUMP.csv"}` entry to every record at next bulk re-import (D0 follow-up).

### 3.4 Validation

After the schema bump, run `node schema/scripts/validate.mjs --all` against the existing 821 records. They must all pass with zero errors. If any record fails, the schema bump is wrong, not the data.

## 4. UI changes in `database.html`

The two-button **Trust** / **Trust + Verify** pattern from the existing PDF-Parser → BEAM bridge ([`js/beamweb.mjs:519`](../../js/beamweb.mjs#L519), [`beamweb.html:90-103`](../../beamweb.html#L90-L103)) carries over directly. Same UX shape, same status-message wording, same affordances. Users coming from BEAMweb's PDF-Parser import see an identical flow on the database side.

| Component | Behavior |
|---|---|
| **Toolbar Trust / Trust + Verify pair** (mirrors BEAMweb's pair) | **Trust** (`bi-lightning-charge`) — bulk-commit every entry currently in `pending_changes`, no review modal. Status: *"Trust: committed N records · click Trust + Verify to audit"*. **Trust + Verify** (`bi-file-earmark-ruled`) — open the pending-changes panel and walk each entry through review one by one. Both stay enabled after a Trust apply. |
| **Pending changes panel** (top of viewer, collapsible) | Lists every entry from the `pending_changes` IndexedDB table. Each row gets per-row Trust / Trust + Verify buttons (the toolbar pair acts on the whole queue). Counter badge in the toolbar shows pending count. Clicking Trust + Verify on a refresh row opens the side-by-side diff (§5); on a new-entry row opens the new-entry confirmation form (§6). |
| **Per-row actions menu** (kebab `⋯` on each existing record) | Edit · Replace from EPD · Flag for deletion · Restore (when flagged) · View audit log. Edits route through the same `pending_changes` queue — no direct mutation of the in-memory record list — so the audit trail and patch-export pipeline stay uniform. |
| **Filter chips** (extending current filters) | "Visibility: public / hidden / deprecated / flagged-for-deletion / all" toggle. "Expiry: active / expiring (< 12 mo) / expired / all". |
| **Flagged-for-deletion review tab** | Dedicated view showing only records where `visibility == "flagged_for_deletion"`. Surfaces `status.deletion_note` and the most recent `provenance.review_audit[]` entry. Per-row: Restore · View source-document URL (if any). |
| **Audit log drawer** | Per-record detail view gets a new "Audit log" expansion showing every entry in `provenance.review_audit[]` chronologically — confirms who-did-what-when without needing to grep the JSON files. |
| **Editor identity** | A "Team member" field stored in `localStorage` (e.g. `andy@bfca`). Used to auto-stamp `provenance.review_audit[].editor` on every commit. Editable from a small toolbar settings button. |

No new color palette or component primitives — reuse the existing chip / status-bar / table styles from [`bfcastyles.css`](../../bfcastyles.css) §7 (Database app).

## 5. Trust / Trust + Verify — the two button paths

Modeled directly on the BEAM flow ([`js/beamweb.mjs:519`](../../js/beamweb.mjs#L519) `handleTrustPdfParser`).

### Trust — one-click commit, no review modal

For a queued entry:
- **New entry** (no DB match): write the record to `committed_patches`, mint `id` via `makeId()`, append a `provenance.review_audit[]` row, remove the entry from `pending_changes`, optimistically update the in-memory record list.
- **Refresh candidate** (DB match on all six §6 keys): take the incoming record fully, replace the existing record, append a `provenance.review_audit[]` row, remove from `pending_changes`.
- **Bulk-Trust toolbar action**: same as above, looped across every entry currently in `pending_changes`. Status echoes BEAM exactly: *"Trust: committed N records from M files · click Trust + Verify to audit"*.

Trust skips the diff modal entirely. Since the §6 strict match algorithm already gates refresh candidates (PCR / URI / scope / program all matched), Trust on a refresh candidate is a deliberate "I trust the parser's extraction wholesale" action — appropriate for the team batch-clearing the expired-record backlog.

### Trust + Verify — open the review modal

For a queued entry:
- **New entry**: opens the new-entry confirmation form (§6 below). Single-column, all extracted fields editable. Group classification flagged if `inferGroupPrefix` returned null. Related-records panel surfaces near-matches as read-only links. Commit on user confirm.
- **Refresh candidate**: opens the side-by-side diff. Two columns. Left: existing record from `schema/materials/<group>.json`. Right: incoming candidate from `pending_changes`. Per-field three-way toggle: `keep existing` / `take incoming` / `merge` (arrays only). Numeric delta annotation (`gwp_kgco2e.total.value: 6.22 → 5.81 (-6.6%)`). Match-key reminder banner shows the six-key match summary. Auto-defaults: `epd.publication_date` and `epd.expiry_date` default to "take incoming" since refreshing the EPD is the whole point. Commit on user confirm.

Trust + Verify always appends a fresh `provenance.review_audit[]` row regardless of which fields were taken. Reject removes the entry from `pending_changes` without committing — the EPD PDF stays where it is, the team member can re-process it later.

### Why both buttons stay enabled after a Trust commit

After Trust runs, the entry has moved from `pending_changes` to `committed_patches`. Trust + Verify on the same record (now via the per-row `⋯` menu on the committed record) opens the audit drawer — the user can see exactly what landed and re-edit if anything looks wrong. Same affordance as BEAMweb, where Trust + Verify stays clickable even after a Trust apply.

## 6. Queue lifecycle

`pending_changes` is durable, not session-scoped — entries survive browser refresh and tab close (it's IndexedDB). Lifecycle:

- **Created** by EPD-Parser auto-save on every form-pane edit, or by a manual edit in the Database viewer. Keyed by EPD `source_file` (one row per source PDF; subsequent edits update in place rather than creating duplicates).
- **Updated** as the user continues editing the form pane. The `audit_meta.last_edit_at` timestamp updates on every keystroke (debounced).
- **Committed** when the user clicks Trust or finishes Trust + Verify. Entry moves to `committed_patches`; original row removed from `pending_changes`.
- **Rejected** when the user clicks Reject in the Trust + Verify modal. Entry removed from `pending_changes` without committing — the EPD PDF stays where it is, the team member can drop it back into EPD-Parser later to re-queue.
- **Stale** entries that haven't been committed or rejected after N days could surface a "Pending changes inactive for X days" reminder. Out of scope for v1; flagged.

Both EPD-Parser and the DB viewer subscribe to the IndexedDB store so changes from one app surface in the other within ≤1s without a tab refresh.

## 7. Patch-emit pipeline

Browser cannot write to `schema/materials/*.json` (Pages is read-only at runtime). Two-stage commit:

1. **DB viewer → patch JSON.** Each commit appends an entry to `committed_patches`. A toolbar action "Export patch" downloads `patch-{ISO-date}.json` containing every uncommitted patch. Schema:
   ```jsonc
   {
     "patch_version": "1.0",
     "exported_at":   "2026-04-25T19:42Z",
     "exported_by":   "andy@bfca",
     "operations":    [
       {
         "op":        "replace" | "create" | "flag" | "restore" | "manual-edit",
         "target":    "lam011" | null,                // record id, null for create
         "group":     "06",                            // 2-digit group_prefix
         "record":    { …full schema-shape JSON… },
         "audit":     { …matches review_audit[] entry shape… }
       }
       // …more operations…
     ]
   }
   ```
2. **Node script → schema/materials/*.json.** A new `schema/scripts/apply-patch.mjs` (sibling to [`validate.mjs`](../../schema/scripts/validate.mjs)) reads the patch file, applies each op to the appropriate `schema/materials/<group>.json`, validates the result, and overwrites the file in place.
3. **Team commits the updated files via git** in the normal way.

Why a custom patch format and not RFC 6902 JSON Patch: 6902 captures the diff but doesn't carry editor/date/source metadata cleanly. Our format is one extra wrapper layer that bundles the audit trail with the data change.

## 8. BEAMweb picker filter audit (D1)

Before the schema bump ships, audit how `beamweb.html`'s material picker queries the catalogue today. The picker fetches `schema/materials/index.json` (or per-group files) and renders selectable options. Two questions:

1. **Does it filter by `status.visibility == "public"` today?** If yes, extending the filter to also exclude `flagged_for_deletion` is one line. If no, it's including `hidden` and `deprecated` records that shouldn't be selectable — fix as part of D1.
2. **Does the picker honor `status.do_not_list == true`?** Same question; the existing 43 hidden records may currently be selectable.

The audit produces a one-paragraph finding + the smallest patch that gets the filter right.

## 9. Index.json builder audit (D2)

`schema/materials/index.json` is the lightweight picker catalogue (8 fields per entry). Audit:

1. **Who builds it?** Likely [`schema/scripts/beam-csv-to-json.mjs`](../../schema/scripts/beam-csv-to-json.mjs) currently writes both per-group files and `index.json`. Confirm.
2. **Does it filter by visibility?** If yes, extend. If no, add the filter. Output should include only `visibility == "public"` records.
3. **When is it regenerated?** Currently only on CSV re-import. Once the patch-script (§7) lands, `apply-patch.mjs` should also regenerate `index.json` after applying any `replace` / `create` / `flag` / `restore` op.

## 10. Phases

| Phase | Scope | Exit |
|---|---|---|
| **D0 — Schema bump** | Add `status.visibility = "flagged_for_deletion"`, `status.deletion_note`, `provenance.review_audit[]` (§3). Validate against all 821 records. | `npm run validate` passes for every record file. |
| **D1 — BEAMweb picker filter audit** | Audit + fix per §8. | Picker shows only `visibility == "public"` records. |
| **D2 — Index.json builder audit** | Audit + fix per §9. | `index.json` excludes hidden / deprecated / flagged-for-deletion records. |
| **D3 — Per-row action UI** | Kebab menu + Edit / Replace from EPD / Flag for deletion / Restore actions on each row in `database.html`. Manual edits route through `pending_changes`. | Click any action → entry appears in the pending queue with the right shape. |
| **D4 — Pending-changes queue panel** | Toolbar counter + collapsible top-of-viewer panel listing pending entries. Reads the shared `pending_changes` IndexedDB table written by EPD-Parser. | EPD-Parser hand-off → entry visible in DB-viewer pending panel within ≤1 s. |
| **D5 — Trust / Trust + Verify** | The §5 UIs. Toolbar Trust + per-row Trust for one-click commit (mirrors BEAMweb's `handleTrustPdfParser`). Trust + Verify opens side-by-side diff (refresh) or new-entry form (new). Commit writes to `committed_patches`. | Both pathways produce a valid `committed_patches` row; UX status messages match BEAMweb's wording. |
| **D6 — Flagged-for-deletion review tab** | Dedicated view per §4. Restore action wires through. | Team can review every flagged record and selectively restore. |
| **D7 — Patch export + apply-patch script** | Toolbar "Export patch" downloads `patch-{ISO-date}.json`; new `schema/scripts/apply-patch.mjs` Node script ingests it, applies to `schema/materials/<group>.json`, regenerates `index.json`, validates. | End-to-end: drop EPD → hand off → DB review → commit → export → apply → git commit → records updated. |

## 11. Open questions

- **D0 backward compatibility.** All 821 existing records must validate cleanly under the bumped schema. Any failures = schema bump is wrong. Plan to dry-run validation before merging the schema change.
- **Concurrent edits.** Two team members in two browser tabs editing the same record produce a `pending_changes` race. Out of scope for v1 — flagged. The shared IndexedDB is single-tab-implicit-isolated since each tab has its own IndexedDB (browser per-origin per-profile per-tab? — verify). If tabs *do* share state, the queue needs an "edited-by" lock.
- **Patch script idempotence.** `apply-patch.mjs` should be safe to re-run on the same patch (no-op the second time). Implement via patch-id + a `.applied-patches.txt` ledger committed alongside `schema/materials/`.
- **Auth model.** Today the back-office tools are unprotected on Pages. Production may need auth-gating ([`EPD-Parser.md`](EPD-Parser.md) §8). Out of scope for v1 — flagged.
- **CSV re-import compatibility.** If BEAM publishes a new CSV dump, re-importing today wipes manual edits. The patch ledger from §7/§11 should let `beam-csv-to-json.mjs` re-apply manual patches after the bulk import. Defer the design until a real re-import scenario surfaces.

## 12. IP guardrails

(Same as [`EPD-Parser.md`](EPD-Parser.md) §9.) No `CSI`, `MasterFormat`, `Division`, `MCE²`, `NRCan`, Crown-copyright tool names anywhere in code, UI strings, fetched JSON, or this workplan. Numeric `group_prefix` (`03`, `06`, …) is the only classification convention used.

## 13. Out of scope (v1)

- **Hard delete.** Forever. Soft-delete only via §3.
- **Multi-user concurrent editing.** §11.
- **Auth-gating** the back-office tools.
- **Direct git commits from the browser.** Patches are exported as JSON downloads, applied via Node script, committed in the normal git workflow.
- **In-browser Anthropic API** for any back-office task. Same security rationale as [`EPD-Parser.md`](EPD-Parser.md) §8.

---

## Iteration infrastructure (planned)

- **`npm run serve`** — already in place; the DB viewer is at `database.html` on the same port.
- **`npm run validate`** — invokes `schema/scripts/validate.mjs --all`. Run after any schema bump or patch-apply.
- **`npm run apply-patch -- <patch-file>`** — new (D7). Applies a patch JSON to `schema/materials/`, regenerates `index.json`, validates.
- **Playwright MCP** — same `pdf-parser-tab` named-tab pattern; verifies the EPD-Parser → hand-off → DB-viewer commit flow end-to-end.

## Git workflow

Same as PDF-Parser ([`MAGIC.md`](MAGIC.md) §5) and EPD-Parser:

- Feature branch off `main` once D0 starts.
- Commit + push to both remotes (`openbuilding` = arossti/OpenBuilding; `origin` = bfca-labs mirror).
- Never push to `main`, never force-push, never `--no-verify`.
- Schema bumps validate against all 821 records via `npm run validate` before push.
