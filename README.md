# BfCA OpenBuilding — Embodied Carbon Assessment Framework

Research, prototyping, and tooling for embodied carbon (EC) assessment in Canadian construction, developed by [Builders for Climate Action](https://www.buildersforclimateaction.org/) (BfCA).

## Live Tools

Five browser-native apps plus a dev dependency manifest, all deployed via GitHub Pages from one directory. Shared dark-chrome design system, shared material database, cross-app navigation.

### Landing — `/`

App directory with cards linking to each tool.

### PDF-Parser — `/pdfparser.html`

Client-side tool for extracting area and volume data from construction document PDFs. Loads a PDF, identifies architectural plans, and lets users measure areas with polygon or rectangle tools — purpose-built for the area/volume inputs needed by BEAM and wbLCA tools.

**Key features:**
- PDF.js 4.x viewer with CAD-style controls (scroll-zoom at cursor, middle-click pan)
- Three-state scale workflow: auto-detect → accept → verify (empirical two-point calibration)
- Polygon + rectangle area measurement with vertex snap to PDF vector geometry
- **Window/opening measurement** — gold-styled window polygons auto-associate with parent walls via ray-casting centroid containment; wall rows show net area
- Expandable measurement panel with gross/net breakdown per wall
- Full-screen summary table across all pages
- Ruler tool with tick marks and dual-unit labels
- Unified undo/redo (polygons + rulers), JSON project save/load/import, CSV export

### EC Matrix — `/matrix.html`

Interactive reference mapping roles, responsibilities, tools, standards, and compliance requirements for EC assessments across Canadian building types, sizes, jurisdictions, and project phases. Aligned to NBC/NECB 2025 Draft.

**Key features:**
- Card view with 6-phase status strip (None → Voluntary → Conditional → Emerging → Mandatory)
- Flow model view (horizontal phase-to-phase with statutory/EC/voluntary tracks)
- Actor lens mode (dims irrelevant phases, highlights selected role's involvement)
- 2025 code updates panel, PT equivalents, standards tooltips, BEM glossary
- Persona quick-filter chips for common role scenarios

### Material Database — `/database.html`

BfCA material catalogue viewer. 821 EPDs across 8 material groups, full EN 15804+A2 per-stage impact scope, sortable + searchable + filterable by group / country / lifecycle stage. Collapsible group sections mirror the assembly-tab structure in BEAMweb.

### BEAMweb — `/beamweb.html`

Browser port of the BEAM embodied-carbon calculator. Phase 3 live: PROJECT metadata + dimension form with source-selectable inputs, plus the first live assembly picker (Footings & Slabs, 16 groups × 658 materials, gSheet parity-validated on every row tested). Reads per-unit GWP factors directly from the same BfCA materials catalogue as the Database viewer. Phases 4+ queued: 11 remaining assembly tabs (Windows → Garage) + REVIEW + RESULTS.

### Dev Dependencies — `/dependencies.html`

Dependency manifest with ESM import-graph drift detector. Not nav-linked — for maintainers.

## Repository Structure

```
at/
├── PDF-Parser/                     Deployed root — GitHub Pages serves from here
│   ├── index.html                  Landing — app directory
│   ├── pdfparser.html              PDF-Parser — area + volume takeoff
│   ├── matrix.html                 EC Matrix — compliance grid
│   ├── database.html               Material Database viewer
│   ├── beamweb.html                BEAMweb — embodied carbon calculator
│   ├── dependencies.html           Dev dependency manifest
│   ├── bfcastyles.css              Single consolidated design system (~5000 lines)
│   ├── js/                         ESM modules (vanilla JS, no build step)
│   │   ├── app.mjs                 PDF-Parser bootstrap
│   │   ├── polygon-tool.mjs        Polygon + window measurement
│   │   ├── scale-manager.mjs       Scale detection + calibration
│   │   ├── pdf-loader.mjs          PDF.js integration
│   │   ├── canvas-viewer.mjs       Viewer transform + render
│   │   ├── vector-snap.mjs         Vertex snap to PDF vectors
│   │   ├── sheet-classifier.mjs    Plan / section / elevation inference
│   │   ├── schedule-parser.mjs     Schedule extraction (in progress)
│   │   ├── project-store.mjs       PDF-Parser project persistence
│   │   ├── config.mjs              App constants
│   │   ├── beamweb.mjs             BEAMweb app entry + tab router
│   │   ├── database.mjs            Database viewer entry
│   │   ├── shared/                 Cross-app utilities
│   │   │   ├── state-manager.mjs   Centralised state + listeners + autosave
│   │   │   ├── file-handler.mjs    Import / export with quarantine
│   │   │   └── html-utils.mjs      HTML escape + helpers
│   │   └── beam/                   BEAMweb-specific modules
│   │       ├── project-tab.mjs, footings-slabs-tab.mjs
│   │       ├── materials-db.mjs    GWP + unit-conversion lookups
│   │       ├── auto-fill.mjs       PROJECT → F&S quantity bridge
│   │       ├── jurisdictions.mjs   Country / province filter
│   │       ├── assembly-csv-parser.mjs  Generic assembly-tab CSV parser
│   │       ├── sample-loader.mjs   Load Sample (DOE Prototype)
│   │       ├── workbook-mapper.mjs Workbook → state mapper (Phase 1 stub)
│   │       ├── reference-data.mjs  Glossary + Energy GHG tables
│   │       └── shared/
│   │           └── formatters.mjs  fmtKg / fmtQty display formatters
│   ├── graphics/                   App logos + iconography
│   ├── lib/                        PDF.js 4.9.155 (local ESM build)
│   └── data/                       Gitignored — staged at dev/deploy time
├── schema/                         Materials database (821 records, EN 15804+A2)
│   ├── material.schema.json        Draft 2020-12 validator
│   ├── materials/                  8 per-group JSON files (03-concrete ... 31-earthwork)
│   ├── lookups/                    Enum + inference tables
│   ├── scripts/                    CSV importer + validator + BEAM sheet fetcher
│   └── schema.md                   Workplan + lineage
├── docs/
│   ├── pdf-parser.md               PDF-Parser workplan + technical docs
│   ├── matrix/                     EC Matrix docs (ARCHITECTURE, TRIAGE, data model)
│   ├── beam-samples/               Sample BEAMweb project JSONs (DOE Prototype)
│   ├── csv files from BEAM/        22 BEAM workbook tab snapshots
│   ├── PDF References/             Vancouver EC guides, NRC reports, code references
│   ├── regulatory (Jacob)/         Legacy regulatory research (archived)
│   ├── ifc (Jacob)/                Legacy IFC exploration
│   └── cost (Jacob)/               Legacy cost-data research
├── CCI-tables-20241121/            CCI construction classification taxonomy
├── BEAMweb.md                      BEAMweb workstream spec + changelog
├── PDF-BEAMweb-BRIDGE.md           Phase 4b cross-app bridge design spec
├── CLEANUP-AUDIT.md                Pre-Phase-4b codebase audit (2026-04-20)
└── CLAUDE.md                       Project instructions for AI-assisted development
```

## Development

All apps load as ES modules and require a local server:

```bash
cd PDF-Parser
npm install          # ESLint + Prettier (one-time)
npm run stage:data   # Copy schema/materials into PDF-Parser/data/ (gitignored) — needed for Database viewer + BEAMweb
npm run serve        # python3 -m http.server 8000 — open http://localhost:8000/
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix (includes Prettier)
npm run format       # Prettier on CSS/HTML/JS
```

## Context

This work is part of the NRCan Codes Accelerator Fund (CAF), with a near-term focus on combined operational and embodied carbon analysis for Part 9 and Part 3 buildings. The four apps are complementary: **EC Matrix** maps *what* EC requirements apply; **PDF-Parser** extracts the *area and volume data*; the **Material Database** is the EPD catalogue those areas multiply against; **BEAMweb** is the calculation surface that ties it all together into a project-level embodied carbon total.

## Scope

**Canada only.** No US codes, ICC, or ASHRAE references unless explicitly referenced by a Canadian standard.

## Collaborators

Maintained by **Andy Thomson** (Thomson Architecture Inc.) in collaboration with BfCA.

## About BfCA

[Builders for Climate Action](https://www.buildersforclimateaction.org/) (BfCA) is a Canadian organization working to reduce carbon emissions in the built environment through research, tools, and education. BfCA develops [BEAM](https://www.buildersforclimateaction.org/beam.html) — an embodied carbon assessment tool for Canadian residential buildings.
