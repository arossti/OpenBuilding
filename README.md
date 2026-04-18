# BfCA CAF — Embodied Carbon Assessment Framework

Research, prototyping, and tooling for embodied carbon (EC) assessment in Canadian construction, developed under the NRCan Codes Accelerator Fund (CAF) in collaboration with [Builders for Climate Action](https://www.buildersforclimateaction.org/) (BfCA).

## Live Tools

Both tools are deployed via GitHub Pages and share a unified dark-chrome design system with cross-navigation.

### PDF-Parser — Construction Document Area Extraction

Client-side tool for extracting area and volume data from construction document PDFs. Loads a PDF, identifies architectural plans, and lets users measure areas with polygon or rectangle tools — purpose-built for the area/volume inputs needed by BEAM, MCE2, and wbLCA tools.

**Key features:**
- PDF.js 4.x viewer with CAD-style controls (scroll-zoom at cursor, middle-click pan)
- Three-state scale workflow: auto-detect → accept → verify (empirical two-point calibration)
- Polygon + rectangle area measurement with vertex snap to PDF vector geometry
- **Window/opening measurement** — gold-styled window polygons auto-associate with parent walls via ray-casting centroid containment; wall rows show net area
- Expandable measurement panel with gross/net breakdown per wall
- Full-screen summary table across all pages
- Ruler tool with tick marks and dual-unit labels
- Unified undo/redo (polygons + rulers), JSON project save/load/import, CSV export

### EC Matrix — Canadian Embodied Carbon Compliance Matrix

Interactive reference mapping roles, responsibilities, tools, standards, and compliance requirements for EC assessments across Canadian building types, sizes, jurisdictions, and project phases. Aligned to NBC/NECB 2025 Draft.

**Key features:**
- Card view with 6-phase status strip (None → Voluntary → Conditional → Emerging → Mandatory)
- Flow model view (horizontal phase-to-phase with statutory/EC/voluntary tracks)
- Actor lens mode (dims irrelevant phases, highlights selected role's involvement)
- 2025 code updates panel, PT equivalents, standards tooltips, BEM glossary
- Persona quick-filter chips for common role scenarios

## Repository Structure

```
at/
├── PDF-Parser/          Area extraction tool + EC Matrix app
│   ├── index.html       PDF-Parser app (dark theme)
│   ├── matrix.html      EC Matrix app (light theme, with Part 9/Part 3 splash)
│   ├── bfcastyles.css   Shared design system
│   ├── pdfparser.css    PDF-Parser styles
│   ├── matrix.css       EC Matrix styles
│   ├── js/              10 ESM modules (vanilla JS)
│   └── lib/             PDF.js 4.9.155 (local ESM build)
├── docs/                App documentation + reference materials
│   ├── pdf-parser.md    PDF-Parser workplan + technical docs
│   ├── matrix/          EC Matrix docs (ARCHITECTURE, TRIAGE, data model)
│   └── PDF References/  Vancouver EC guides, NRC reports, code references
├── regulatory/          Canadian Part 9 building code compliance research
├── ifc/                 IFC building model import exploration
├── cost/                Cost data integration research
├── CCI-tables/          CCI construction classification taxonomy
└── CLAUDE.md            Project instructions for AI-assisted development
```

## Development

PDF-Parser requires a local server for ESM module imports:

```bash
cd PDF-Parser
npm install          # ESLint + Prettier (one-time)
npm run serve        # python3 -m http.server 8000
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix (includes Prettier)
npm run format       # Prettier on CSS/HTML/JS
```

Matrix App (`ec_matrix_step15.html`) opens directly in a browser — no server needed.

## Context

This work is part of the NRCan Codes Accelerator Fund (CAF), with a near-term focus on combined operational and embodied carbon analysis for Part 9 and Part 3 buildings. The PDF-Parser and EC Matrix are complementary tools: the Matrix maps *what* EC requirements apply; the Parser extracts the *area and volume data* needed to run the assessment.

## Scope

**Canada only.** No US codes, ICC, or ASHRAE references unless explicitly referenced by a Canadian standard.

## Collaborators

Maintained by **Andy Thomson** (Thomson Architecture Inc.) in collaboration with BfCA.

## About BfCA

[Builders for Climate Action](https://www.buildersforclimateaction.org/) (BfCA) is a Canadian organization working to reduce carbon emissions in the built environment through research, tools, and education. BfCA develops [BEAM](https://www.buildersforclimateaction.org/beam.html) — an embodied carbon assessment tool for Canadian residential buildings.
