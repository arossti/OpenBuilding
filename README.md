# OpenBuilding.ca — Browser Tools for Canadian Buildings

Research, prototyping, and tooling for Canadian buildings: PDF takeoff, a material database, and OBJECTIVE, by OpenBuilding.ca.

## Live Tools

Five browser-native apps plus a dev dependency manifest, all deployed via GitHub Pages from one directory. Shared dark-chrome design system, shared material database, cross-app navigation.

### Landing — `/`

App directory with cards linking to each tool.

### TakeOffEh — `/takeoffeh.html`

Client-side tool for extracting area and volume data from construction document PDFs. Loads a PDF, identifies architectural plans, and lets users measure areas with polygon or rectangle tools — purpose-built for the area/volume inputs needed by OBJECTIVE and wbLCA tools.

**Key features:**

- PDF.js 4.x viewer with CAD-style controls (scroll-zoom at cursor, middle-click pan)
- Three-state scale workflow: auto-detect → accept → verify (empirical two-point calibration)
- Polygon + rectangle area measurement with vertex snap to PDF vector geometry
- **Window/opening measurement** — gold-styled window polygons auto-associate with parent walls via ray-casting centroid containment; wall rows show net area
- Expandable measurement panel with gross/net breakdown per wall
- Full-screen summary table across all pages
- Ruler tool with tick marks and dual-unit labels
- Unified undo/redo (polygons + rulers), JSON project save/load/import, CSV export

### Material Database — `/database.html`

OpenBuilding.ca material catalogue viewer. 821 EPDs across 8 material groups, full EN 15804+A2 per-stage impact scope, sortable + searchable + filterable by group / country / lifecycle stage. Collapsible sections by material group.

### OBJECTIVE 4.0 — `/objectivepro.html`

The targeted energy use intensity tool, OBJECTIVE Pro's PC form. OBJECTIVE's sections S01–S21 are being ported in as
full pages (plan: `docs/workplans/OBJECTIVE-V4.md`); S01's key values (Lifetime Carbon, Annual Carbon, TEUI) ride the
masthead on every section, and S22 is the Glossary. Take Off, Eh! feeds it through Trust / Trust + Verify.
OBJECTIVE 3 stays live at objective.openbuilding.ca.

### Dev Dependencies — `/dependencies.html`

Dependency manifest with ESM import-graph drift detector. Not nav-linked — for maintainers.

## Repository Structure

Flat layout — the repo root is the deployed site. The Pages workflow stages a clean `_site/` from these files and uploads that as the artifact.

```
OpenBuilding/
├── index.html                       Landing — app directory
├── takeoffeh.html                   TakeOffEh — area + volume takeoff
├── database.html                    Material Database viewer
├── objectivepro.html                OBJECTIVE 4.0
├── dependencies.html                Dev dependency manifest
├── obstyles.css                   Single consolidated design system (~5000 lines)
├── js/                              ESM modules (vanilla JS, no build step)
│   ├── app.mjs                      TakeOffEh bootstrap
│   ├── polygon-tool.mjs             Polygon + window measurement
│   ├── scale-manager.mjs            Scale detection + calibration
│   ├── pdf-loader.mjs               PDF.js integration
│   ├── canvas-viewer.mjs            Viewer transform + render
│   ├── vector-snap.mjs              Vertex snap to PDF vectors
│   ├── sheet-classifier.mjs         Plan / section / elevation inference
│   ├── schedule-parser.mjs          Schedule extraction (in progress)
│   ├── project-store.mjs            TakeOffEh project persistence
│   ├── config.mjs                   App constants
│   ├── objective4.mjs                  OBJECTIVE entry + section router (S01–S22, the key-values HUD)
│   ├── database.mjs                 Database viewer entry
│   ├── shared/                      Cross-app utilities
│   │   ├── state-manager.mjs        Centralised state + listeners + autosave
│   │   ├── file-handler.mjs         Import / export with quarantine
│   │   └── html-utils.mjs           HTML escape + helpers
│   └── beam/                        OBJECTIVE's modules (code name kept until the port)
│       ├── project-tab.mjs          S02 PROJECT
│       ├── pdf-bridge-import.mjs    Trust / Trust + Verify from Take Off, Eh!
│       ├── jurisdictions.mjs        Country / province filter
│       ├── sample-loader.mjs        Load Sample (fills PROJECT)
│       ├── reference-data.mjs       S22 Glossary
│       └── dependency-graph*.mjs    S17 Dependency Graph
├── graphics/                        App logos + iconography
├── lib/                             PDF.js 4.9.155 (local ESM build)
├── data/                            Gitignored — staged at dev/deploy time
├── schema/                          Material catalogue source-of-truth (821 records, EN 15804+A2)
│   ├── material.schema.json         Draft 2020-12 validator
│   ├── materials/                   8 per-group JSON files (03-concrete ... 31-earthwork)
│   ├── lookups/                     Enum + inference tables
│   ├── scripts/                     CSV importer + validator
│   └── schema.md                    What the catalogue is (local only); points at OBJECTIVE-V4.md
├── docs/
│   ├── sample.pdf                   TakeOffEh dev fixture (generic name; swapped for a better drawing set at release)
│   ├── pdf-samples/                 Larger sample PDFs for parser testing (gitignored)
│   ├── beam-samples/                Load Sample's project JSON (DOE Prototype)
│   ├── csv files from BEAM/         22 BEAM workbook tab snapshots
│   ├── PDF References/              Code references (local PDFs, not committed)
│   ├── workplans/                   Living workstream specs
│   │   ├── OBJECTIVE-V4.md          OBJECTIVE 4.0's plan (§0 = the handoff)
│   │   ├── PDF-BEAMweb-BRIDGE.md    Take Off, Eh! → OBJECTIVE bridge design spec
│   │   ├── MAGIC.md                 Take Off, Eh! magic-wand workplan
│   │   └── WORKPLAN-TEMPLATE.md     Template for a new workplan
│   └── completed/                   Shipped workplans kept briefly for reference, then bulk-deleted
│       └── takeoffeh.md            TakeOffEh workplan (Steps 1–10 + PDF-Bridge phases all shipped)
├── CCI-tables-20241121/             CCI construction classification taxonomy
├── package.json                     npm tooling (ESLint + Prettier) + stage:data
├── eslint.config.mjs, .prettierrc, .prettierignore
├── .github/workflows/deploy-pages.yml   Pages artifact staging + deploy
├── README.md                        This file
└── CLAUDE.md                        Project instructions for AI-assisted development
```

## Development

All apps load as ES modules and require a local server:

```bash
npm install          # ESLint + Prettier (one-time)
npm run stage:data   # Copy schema/materials + BEAM CSVs + sample projects into data/ (gitignored) — needed for the Database viewer + OBJECTIVE
npm run serve        # python3 -m http.server 8000 — open http://localhost:8000/
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix (includes Prettier)
npm run format       # Prettier on CSS/HTML/JS
```

## Context

The tools are complementary: **Take Off, Eh!** extracts the _area and volume data_ from drawings; **OBJECTIVE** turns
the envelope and systems into energy and carbon; the **Material Database** and the **Builders** hold the materials and
assemblies those areas multiply against. The native ABCD.EARTH app is OBJECTIVE Pro's full form.

## Scope

**Canada only.** No US codes, ICC, or ASHRAE references unless explicitly referenced by a Canadian standard.

## Maintainer

Maintained by **Andy Thomson** (Thomson Architecture Inc.) for OpenBuilding.ca.
