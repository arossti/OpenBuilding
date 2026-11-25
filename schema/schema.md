# schema/ — the BEAM material catalogue (local only)

**OpenBuilding's plan is [`docs/workplans/OBJECTIVE-V4.md`](../docs/workplans/OBJECTIVE-V4.md)** — OBJECTIVE Pro on
the web (the PC form of OBJECTIVE Pro; the ABCD.EARTH app is its full form).

This folder holds the BEAM material catalogue that `database.html` reads: 821 records in
`materials/*.json` (one file per 2-digit material group) plus `materials/index.json`, validated by
`material.schema.json` (`scripts/validate.mjs`), with enum and inference tables in `lookups/`.

- **It is BfCA's data and never deploys.** It stays in the repo for local reference
  (`npm run stage:data`, then open `/database.html`); `.github/workflows/deploy-pages.yml` does not ship it.
  Andy 2026-11-25: _"We may use some of the BfCA database later but we'd need permission first."_
- **The site's materials are OpenBuilding's own:** the Material Builder (`builders/material-builder.html`),
  published from ABCD.EARTH's material library (`npm run builders:publish`), with cost, images and assemblies.
- The catalogue's original workplan and field specification are in git history:
  `git log -p -- schema/schema.md`.
