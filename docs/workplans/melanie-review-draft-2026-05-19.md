---
status: DRAFT — for Andy's review before sending
intended recipient: Mélanie Tessier
purpose: confirm §11.10 open items so EPD-Parser C-fb6 (Tier-10 biogenic) can ship
context: follow-up to Mélanie's 2026-05-05 answers (workplan EPD-Parser.md §11.8)
---

# Draft message — biogenic methodology follow-up

Hi Mélanie,

Thank you again for your 2026-05-05 answers on the biogenic-carbon flow — they substantially expanded our understanding of the BfCA methodology and meaningfully revised the scope of C-fb6 (the Tier-10 calculations layer that lands BEAM-normalized biogenic values into the parser output).

We've worked through the six remaining items in §11.10 and have working answers for most of them. The structure below is "here's what we're going with — please flag anything that doesn't match your model." For Q3 (the Phyllis 2 lookup) we've drafted a starter shortlist; your red-line on that is the gating item before C-fb6.2 ships.

---

## Q1 — Schema field locations  · going with `methodology.beam_calc.*`

The Tier-10 calculation output lives under `methodology.beam_calc.*`:

```
methodology.beam_calc.full_c_kgco2e          [number]   — calculated full biogenic carbon (per declared unit)
methodology.beam_calc.stored_kgco2e          [number]   — full_C × storage_factor
methodology.beam_calc.biogenic_source        [enum]     — "epd_gwp_bio" | "epd_bcrp" | "calculated_from_material_content"
methodology.beam_calc.storage_cycle          [enum]     — "long_cycle" | "short_cycle"  (see Q2)
methodology.beam_calc.storage_factor         [number]   — 0.9 by convention when long_cycle; 0 when not applicable
methodology.beam_calc.inputs[]               [array]    — provenance chain (e.g. "physical.density.value_kg_m3 (epd_direct)")
```

Material Content (the table where EPDs list "70% wood + 30% adhesive" etc., per your Q2 answer) lives separately under `classification.material_content[]`.

Reasoning: methodology houses the policy choices (`biogenic_source`, `storage_cycle`, `storage_factor`); the calc outputs derive from those choices. Physical houses the raw measurable inputs (density today; thickness eventually, but BEAMweb provides that — not EPD-Parser). In the form pane, the audit-trail UI explicitly draws an arrow from `physical.density` → `methodology.beam_calc.full_c_kgco2e` so the dependency is visible across the two sections.

## Q2 — `storage_cycle` enum  · `"long_cycle" | "short_cycle"`, one open future item

Final enum: `"long_cycle" | "short_cycle"`.

We dropped the `"none"` option we'd considered — a numeric `storage_factor: 0` says the same thing without a string sentinel, and one less enum value to maintain.

**Open future item** (not blocking C-fb6): **medium_cycle as a project-level pro-rating mechanism.** Andy raised the case of a building designed for 100-year service life that's demolished after 10 years — the long-cycle storage credit should be pro-rated to reflect actual rather than design service life. This isn't a per-material property (the material's biology is the same regardless of how it's used downstream); it's a project-level override. We'll spec that separately and don't expect to need it for C-fb6. For now every biogenic material defaults to `long_cycle` and the per-project pro-rating logic comes later.  `// flag if you think this needs a per-material slot rather than a project-level override`

## Q3 — Phyllis 2 lookup  · draft below, please red-line

We've drafted a starter shortlist of ~20 biomass types we expect to encounter in BfCA materials. **The carbon-content values are guesses from common LCA defaults**, not from direct Phyllis 2 lookups — happy to anchor each to a specific Phyllis 2 record ID once you've reviewed the categories. Storage-cycle assignments assume default in-building use; the asterisks call out the ones we're least sure about.

| # | material_type key            | C content (kgC/kg dry) | storage_cycle | notes / questions for you                                            |
|---|------------------------------|------------------------:|---------------|-----------------------------------------------------------------------|
| 1 | `softwood_solid`             | 0.50                    | long_cycle    | Pine / spruce / fir / SPF — solid dimension lumber baseline.          |
| 2 | `hardwood_solid`             | 0.49                    | long_cycle    | Oak / maple / birch / etc. `// is 0.49 right, or should it match 0.50?` |
| 3 | `softwood_engineered_wood`   | 0.48                    | long_cycle    | Glulam / CLT / GLT — solid wood diluted slightly by adhesive content. `// what % adhesive do you typically assume?` |
| 4 | `LVL`                        | 0.48                    | long_cycle    | Veneer + phenolic adhesive.                                            |
| 5 | `LSL_PSL`                    | 0.48                    | long_cycle    | Strands + adhesive.                                                    |
| 6 | `plywood`                    | 0.48                    | long_cycle    | Veneer + adhesive.                                                     |
| 7 | `OSB`                        | 0.48                    | long_cycle    | Strands + adhesive.                                                    |
| 8 | `wood_fiberboard`            | 0.48                    | long_cycle    | MDF / hardboard / wood-fibre insulation panels.                        |
| 9 | `bamboo`                     | 0.524                   | long_cycle    | Your figure from Q3.                                                   |
| 10 | `cellulose_insulation`      | 0.45                    | long_cycle    | Treated recycled paper feedstock — lower C due to ash + flame retardants. `// confirm 0.45?` |
| 11 | `straw`                     | 0.48                    | long_cycle    | Wheat / oat in straw-bale construction. Long-cycle when in-wall.       |
| 12 | `hemp_fiber`                | 0.48                    | long_cycle    | Insulation panels; also fiber input to hempcrete.                      |
| 13 | `hempcrete`                 | 0.20                    | long_cycle    | Composite: hemp fiber + lime binder. Lower effective C due to dilution. `// best guess — would value a real number from your records` |
| 14 | `cork`                      | 0.55                    | long_cycle    | Cork-board insulation. Higher C content (oak-bark suberin).            |
| 15 | `sheep_wool_insulation`     | 0.50                    | long_cycle    | Wool batt insulation.                                                  |
| 16 | `cotton_insulation`         | 0.43                    | long_cycle    | Recycled denim batt.                                                   |
| 17 | `flax`                      | 0.48                    | long_cycle    | Insulation panels; less common in North America.                       |
| 18 | `coir`                      | 0.48                    | long_cycle    | Coconut-husk insulation.                                               |
| 19 | `jute`                      | 0.48                    | long_cycle    | Included for completeness; rare in N.A. construction.                  |
| 20 | `bagasse`                   | 0.48                    | short_cycle   | Sugar-cane residue — packaging / temporary boards. `// long if it's structural, short if temporary — your call` |

**Open questions for you:**
- Are any material categories missing that BfCA encounters regularly?
- Are there any you'd remove as unrealistic for the Canadian construction context?
- Do you want me to pull specific Phyllis 2 record IDs to anchor each row, or would BfCA-curated round numbers (like above) suit better?

## Q5 — Legacy 821-record migration  · `legacy_unknown` flag, your timeline

For the existing 821 records, `biogenic_source` defaults to `"legacy_unknown"`. From now on, every new EPD-Parser commit attributes `biogenic_source` correctly based on what the original EPD published — explicit `gwp_bio` per stage, `BCRP` from the biogenic-inventory table, or `calculated_from_material_content` when no biogenic value is published.

For the legacy 821, we propose:
- **No bulk re-attribution required from you.** The legacy_unknown tag is honest about state — practitioners querying the catalogue will see that those records' biogenic_source is unattributed.
- **When you have time**, we can set up a side workflow where you flag entries in small batches (10 at a time, say) and we apply the attribution. No pressure on timeline.
- Records where the original EPD is archived in the repo can be auto-attributed by re-running the parser; the others stay `legacy_unknown` until source recovery makes attribution possible.

### Helpful side-effect — the parser surfaces records that may benefit from review

While running EPD-Parser against the 208-EPD archive BfCA shared with us today, we also wired a "catalogue parity" check that matches each extracted record against the 821-row catalogue and diffs the safely-comparable fields (group prefix, material type, manufacturer, density, EPD id). The intent was to verify the parser's fidelity against authoritative values, but it had a useful by-product: it surfaced a handful of catalogue rows whose density values appear to be in different units than the rest. For example:

- `mpa000` (Aluminum panels) — catalogue density `2.07 kg/m³` (aluminum is ~2700 kg/m³; looks like a per-area panel weight got stored in the volumetric slot)
- `1f3cc3` (CertainTeed fiberglass batt) — catalogue density `0.488 kg/m³` (fiberglass batt is typically 10–30 kg/m³; looks like a lb/ft³ value stored without unit conversion)

These aren't errors per se — more like inheritance from the original BEAM-spreadsheet → JSON import where some columns blurred imperial/metric or per-area/per-volume conventions. The parser now provides a clean way to flag these for review.

We can produce two lists for you:

1. **Historic** — every catalogue row where the existing-archive EPD-Parser run diverges from the catalogued value by a unit-conversion-shaped factor (≥10× difference in density, for instance). These are likely unit-misencoded and worth a quick review.
2. **Go-forward** — every new EPD-Parser commit will report parity status against the catalogue in the snapshot, so any future drift gets flagged the same way.

Happy to ship the historic list as a markdown table for you to red-line whenever it's convenient. Independent of C-fb6 timeline — useful housekeeping that the tooling does almost for free now that the matcher exists.

## Q6 — Validation tolerance  · two-tier ±0.1% / ±5%

Two distinct tolerance bars for two distinct tests:

| Test                    | Tolerance | What it measures                                                                  |
|-------------------------|-----------|-----------------------------------------------------------------------------------|
| **Formula unit-test**   | ±0.1%     | Given identical synthetic inputs on both sides, do we produce the same full_C as your spreadsheet? Catches formula bugs. |
| **End-to-end pipeline** | ±5%       | EPD-Parser-extracted inputs → Tier-10 calc → compared against your BEAM CSV col 31 ("Full C value"). Tolerates legitimate input variance (parser extracts 482 kg/m³ where you typed 480) without false-flagging. |

Both passing = formula and pipeline integrity.

`// is ±5% too loose for your liking? If so we can tighten — happy to go ±3% on the pipeline if you'd prefer.`

**A small empirical note** from the 208-sample parity run: where the parser and catalogue both have a non-null density value AND the catalogue's units look correct, the values agree within 5% on essentially every check. The headline 8% match rate we measured today is dragged down by the unit-encoding issues described in Q5, not by formula or parser drift. So if your spreadsheet's col 31 values are unit-clean, ±5% is likely a comfortable bar in practice. We'll know more once C-fb6 lands and we can re-run the comparison on `methodology.beam_calc.full_c_kgco2e` directly.

## Q4 — Material Content table extraction  · deferred

This depends on a separate architecture decision Andy is working through (parser-wide — how to handle per-format table extraction generically rather than as a regex per program operator). Once that lands, Material Content extraction follows as a parameterization of the chosen architecture. We'll loop you back when there's something concrete to review.

---

## Practical next steps

1. **You review the Phyllis 2 draft (Q3).** Even if all you do is "yes / no / swap row 13" we can publish v1 and iterate.
2. **C-fb6 begins** once Q3 lands. Estimated ~10 hours of work spread across schema bump, Phyllis 2 JSON, Tier-10 formula implementation, audit-trail UI render, and validation harness.
3. **Legacy migration kicks off whenever you want.** Independent of C-fb6.
4. **Unit-review list (optional, anytime).** We can ship a tabular list of the ~10–20 catalogue rows whose density values currently look unit-misencoded. You red-line which ones need correcting; we patch and re-snapshot. Zero pressure on timeline — useful housekeeping that the parity matcher does almost for free.

Whenever you have time for a 30-minute call (or just async on this doc), let's pick it up.

Thanks Mélanie — the depth of your 2026-05-05 answers is exactly what we needed to keep this on a sound methodological footing rather than improvising.

—Andy

---

## Andy's review notes

Use this section before sending. Things to look at:

- [ ] Q1 — methodology.beam_calc.* — flag if you want different naming
- [ ] Q2 — long/short only; medium deferred. Do you want medium added now anyway, in case the pro-rating spec comes sooner?
- [ ] Q3 — Phyllis 2 table — anything obviously wrong? Bagasse should be long_cycle if it's structural in the BfCA catalogue (e.g. bagasse-panel sheathing) — flip to long_cycle if so.
- [ ] Q5 — legacy_unknown phrasing — is "no bulk re-attribution required from you" too soft? You said off-record that it's her mess to unravel; this draft is the polite version.
- [ ] Q5 unit-mismatch note — the new "helpful side-effect" paragraph reframes the catalogue-side density issues as housekeeping the parser surfaces, not a complaint. Check the tone reads as a service offer.
- [ ] Q6 — ±5% tolerance — happy with two-tier? The empirical note now backs the choice with parity-run data.
- [ ] Practical step 4 (unit-review list) — should this be opt-in or auto-ship?
- [ ] Tone — is it too "we" / too formal / too business-y?
- [ ] Signature — "Andy" or different?
