# EPD-Parser regression-coverage history

Each file in this directory is a timestamped snapshot of the per-sample
coverage matrix from `schema/scripts/test-epd-extract.mjs`. The harness
walks every PDF in `docs/PDF References/EPD SAMPLES/{03,05,06,07}/`,
runs each through `js/epd/extract.mjs`, and reports which schema fields
were populated.

## Why this exists

When iterating regex extractors, it's easy to over-fit to one EPD's
specific text patterns. Committing the harness output before/after each
fix lets us:

- Confirm aggregate coverage moves up (not just one sample).
- Catch silent regressions (a fix that helps sample X but breaks sample Y).
- Audit per-format progress over time via `git log -p` in this directory.

## How to run

```bash
node schema/scripts/test-epd-extract.mjs
# → writes a new ISO-timestamped snapshot here

node schema/scripts/test-epd-extract.mjs --md /tmp/somewhere.md
# → write somewhere else (one-off debugging)

node schema/scripts/test-epd-extract.mjs --only Lafarge
# → filter to a substring of filenames; doesn't auto-write a snapshot
```

## Reading a snapshot

Top of file: aggregate coverage (metadata X/330, impacts Y/300) plus
format-detection counts.

Per-sample table columns:
- **Format** — what `detectFormat()` returned (na / epd_international / nsf / eu_ibu / unknown).
- **Pages** — PDF page count.
- **Meta** — populated metadata fields out of 11 (manufacturer, EPD id, dates, PCR, standards, declared unit, density, type, validation).
- **Impacts** — populated impact totals out of 10 (the 10 schema indicator slots).
- Then per-indicator columns (GWP, ODP, AP, EP, SFP, ADPf, WDP, PE-NR, PE-R) showing the extracted total or `·` for miss.

## Workflow contract (Andy's standing rule, 2026-04-27)

> No regex change ships unless the harness aggregate moves up AND no
> sample regresses. A change that helps Lafarge but breaks any other
> sample is rolled back.

Every commit that touches `js/epd/extract.mjs` should also commit a
fresh snapshot here. The commit message references the delta
(e.g. *"impact coverage 30.7% → 38.4%, no regressions"*).
