# OpenBuilding.ca — browser tools for Canadian buildings

> Rewritten 2026-11-25 after the landing-page cleanup (the EC Matrix, EPD-Parser and CCLIMB deleted; BEAM's tabs
> replaced by OBJECTIVE 4.0's sections). Andy reviews it; what follows is the code as it stands.

## Project Purpose

Browser-native tools by OpenBuilding.ca: **OBJECTIVE 4.0** (the targeted energy use intensity tool, the PC form of
OBJECTIVE Pro), **Take Off, Eh!** (area and volume takeoff from drawings), the material **Database**, and the
**Builders** published from ABCD.EARTH. One design system, one dependency manifest, deployed to GitHub Pages.

**Scope: Canada.** US codes only where a Canadian standard references them (e.g. ASHRAE 140 for NECB, CSA F280).

**The live plan is [`docs/workplans/OBJECTIVE-V4.md`](docs/workplans/OBJECTIVE-V4.md)** — its §0 is the cold-start
handoff. New workplans start from `docs/workplans/WORKPLAN-TEMPLATE.md`.

## Working rules

- **A push to `main` redeploys Pages.** Work on a branch; merge only on Andy's word in the session.
- Serve locally: `npm run stage:data` once (copies runtime data into the gitignored `data/`), then
  `python3 schema/scripts/nocache-serve.py <port>`. A plain `python3 -m http.server` lets the browser keep stale modules.
- Lint and format the web code: `npm run lint`, `npx prettier --write <files you changed>` (run `npm install` once
  per clone). Format only the files you touch; a repo-wide `npm run format` rewrites unrelated files.
- The Builders (`builders/`) are build output from ABCD.EARTH: `npm run builders:check` / `npm run builders:publish`.
  Never edit them here.

## Architecture

### Pages — one repo, deployed by `.github/workflows/deploy-pages.yml`

The workflow stages a clean `_site/` (HTML, CSS, `js/`, `graphics/`, `lib/`, `builders/`, runtime data) and uploads it.

| URL | File | Role |
|---|---|---|
| `/` | `index.html` | Landing page / tools directory |
| `/objectivepro.html` | `objectivepro.html` | OBJECTIVE 4.0: sidebar S01–S21 + S22 Glossary, the S01 key values in the masthead |
| `/takeoffeh.html` | `takeoffeh.html` | Take Off, Eh! — area + volume takeoff from drawings |
| (local only) | `database.html` | The BEAM material catalogue viewer (821 records, BfCA data): kept in the repo, never deployed |
| `/builders/*.html` | `builders/` | Material, Section and Assembly Builders (published from ABCD.EARTH) |
| `/dependencies.html` | `dependencies.html` | Dev dependency manifest (not nav-linked) |

### Styling — one file plus the shared tokens

`obstyles.css` holds every page's styles, scoped by html class (`app-takeoffeh`, `app-database`, `app-beamweb` for
OBJECTIVE, `app-deps`, `app-landing`) under `§N  APP: name` banners. `builders/tokens.css` (published from ABCD.EARTH) is the one set of design tokens
shared with the Builders (cyan on the web). No per-app `.css` files.

### JS — ES modules, no build

- `js/*.mjs` — Take Off, Eh! core + per-page entries (`app.mjs`, `objective4.mjs` = OBJECTIVE's router, `database.mjs`, …)
- `js/beam/*.mjs` — OBJECTIVE's modules (`project-tab.mjs` = S02, `pdf-bridge-import.mjs` = Trust / Trust + Verify,
  `reference-data.mjs` = the Glossary, `dependency-graph*.mjs` = S17). The `beam` code names stay until the port.
- `js/shared/*.mjs` — cross-page utilities (`state-manager.mjs`, `file-handler.mjs`, `indexed-db-store.mjs`, …)
- Global namespace: `window.BEAM.*` (to become OBJECTIVE's `window.TEUI.*` in the port).

### Data — the material catalogue

- `schema/materials/*.json` (8 files, 821 records, one per 2-digit material group) + `index.json` (picker catalogue)
- `schema/material.schema.json` — Draft 2020-12 validator; `schema/scripts/validate.mjs` after any schema change
- `schema/lookups/*.json` — enum + inference tables
- Runtime: staged into `data/schema/` (Pages workflow, or `npm run stage:data` locally).

The catalogue, `docs/csv files from BEAM/` (the BEAM workbook's tab exports) and `docs/beam-samples/` are BfCA's
data: kept in the repo, **never deployed** (Andy 2026-11-25: *"We may use some of the BfCA database later but we'd need
permission first."*). The site's materials are the Material Builder's, published from ABCD.EARTH.
