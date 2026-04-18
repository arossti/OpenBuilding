# EC Matrix — Architecture Notes

## Project Purpose

Interactive HTML application mapping **roles, responsibilities, tools, standards, and compliance requirements** for embodied carbon (EC) assessments across Canadian building types, sizes, jurisdictions, and project phases. Aligned to **NBC/NECB 2025 Draft**.

**Scope: Canada only.** No US codes, ICC, or ASHRAE references unless they are explicitly referenced by a Canadian standard (e.g., TRACI v2.1, ASHRAE 140-2023 for NECB compliance).

## Architecture

### Deployed as part of the PDF-Parser app

The Matrix was consolidated into the PDF-Parser app on 2026-04-18. The canonical source is now `PDF-Parser/matrix.html` (with extracted `matrix.css`), deployed via GitHub Pages alongside the PDF-Parser tool. Users cross-navigate between the two apps using header buttons.

**Files:**

| File | Purpose |
|---|---|
| `PDF-Parser/matrix.html` | Body, data, and JS (~4,360 lines, ~278 KB) |
| `PDF-Parser/matrix.css` | Light-theme styles (~1,900 lines) |
| `PDF-Parser/bfcastyles.css` | Shared design tokens + dark header (used by both apps) |

**Previous versions:** The history of the step-numbered single-file app (`ec_matrix_step12.html` through `ec_matrix_step15.html`) lives in git history. Prior to consolidation, the app was split inline-CSS per step-numbered file.

### Data Model (JS objects in `<script>`)

| Object | Purpose |
|---|---|
| `STATUS` | 5-level compliance scale: NONE / VOLUNTARY / CONDITIONAL / EMERGING / MANDATORY |
| `ACTORS_LIST` | 13 actor roles with jurisdiction-sensitive regulator labels |
| `EC_TOOLS` | Embodied carbon / wbLCA tools catalogue |
| `ENERGY_TOOLS_P9` / `ENERGY_TOOLS_P3` | Energy modelling tools for Part 9 and Part 3 |
| `STANDARDS` / `STANDARDS_MAP` | Referenced standards with tier (Mandatory/Referenced/Voluntary) |
| `STANDARDS_MAP_BY_ROW` | Per-row standard assignments |
| `EC_COMPLIANCE_FRAMEWORK` | NRC Practitioner's Guide compliance pathways |
| `BEM_GLOSSARY` | Building Energy Modelling tool/term glossary |
| `PERSONA_PRESETS` | Quick-filter persona chips |
| `ROWS` | **Core data** — ~40+ program-context rows, each with 6 phases (p1–p6) |
| `PROJECT_TYPES` / `SIZE_BANDS` / `JURISDICTIONS` | Filter dropdown enumerations |
| `CODE_UPDATES_2025` / `CODE_UPDATES_ROW_MAP` | 2025 code change annotations |
| `PT_EQUIVALENTS` | Provincial/territorial equivalent regulations |
| `ACTOR_LENS_MAP` | Actor lens metadata for the role-based view |

### Six Project Phases

| Phase | Label |
|---|---|
| p1 | Pre-Design / Concept |
| p2 | Design / Permit Submission |
| p3 | Permit Review (AHJ) |
| p4 | Construction |
| p5 | Occupancy / Closeout |
| p6 | Post-Occupancy / Incentives |

### Rendering Pipeline

1. User selects filters in sidebar (Project Type, Building Size, Jurisdiction, Actor/Role)
2. `onFilterChange()` → `filterRows()` → `renderResults()` → `renderRowCard()` per matched row
3. Each card shows: header tags, phase strip (6 colour-coded cells), expandable detail (actors, tools, deliverables, notes), professional requirement notes, PT equivalents, standards strip, code updates panel, source references
4. **Actor Lens** mode dims non-relevant phases, highlights the selected actor's involvement, and shows a "Your Role" banner

### Design System

- **Palette:** Deep forest green accent (`#2a5c3f`), neutral warm greys, 5-colour status scale
- **Typography:** Georgia (headings), Helvetica Neue (body), Courier New (mono/labels)
- **Layout:** Fixed 480px sidebar + fluid main content area

## Key Resources

| File | Content |
|---|---|
| `PDF-Parser/matrix.html` | Current app (body + data + JS) |
| `PDF-Parser/matrix.css` | Current app (light-theme styles) |
| `docs/matrix/ec_matrix_v2.md` | Markdown documentation of the full data model |
| `docs/matrix/TRIAGE.md` | Role/phase refinement Q&A notes |
| `BfCA Resources/Building application flow chart.pdf` | Reference flowchart for building permit process (prescriptive / performance / EnerGuide paths) |
| `BfCA Resources/Embodied Carbon Tool DB Comparison Report (Priopta).pdf` | 227-page NRC-funded tool comparison report |
| `BfCA Resources/Navigating Part 9 Building Codes and Municipal Permitting Frameworks.docx` | Part 9 permitting guidance |
| `BfCA Resources/canada_us_code` | Canadian building code governance structure (Canada section relevant; ignore US section) |
| `BfCA Resources/Vancouver/city-of-vancouver-embodied-carbon-low-rise-residential-part-9-appendix-ii.pdf` | **COV Appendix II** — EC Assessment Guide for Low-Rise Residential (Part 9). Effective Jan 1, 2026. BEAM/MCE2 mandated as primary tools. ECI benchmarks. BfCA-developed methodology. |
| `BfCA Resources/Vancouver/embodied-carbon-vancouver-addendum-national-wblca-practitioners-guide.pdf` | **COV Addendum v1.0** to NRC Practitioner's Guide. Part 3 EC compliance for VBBL s.10.4. ECI = 400 kgCO2e/m². Accepted tools list. ILCs. April 2025. |
| `CCI-tables-20241121/` | CCI construction classification taxonomy (2 Excel files) |

## Conventions

### Versioning
- Changes are tracked via git (feature branches, PRs). Step-numbered files are a legacy convention and no longer used post-consolidation.
- The footer may still show a step number for user reference.

### Code Style
- Vanilla JS (ES5-compatible `var`, `function`, `.forEach`, `.map` — no arrow functions, no `let`/`const`, no template literals)
- Data lives in inline JS objects within `matrix.html` — no external JSON or fetch calls (for now)
- CSS uses custom properties (`:root` vars) and the shared design system in `bfcastyles.css`
- Inline styles used for sidebar reference panels (collapsible accordion pattern)

### Data Integrity
- Every `ROWS` entry must have: `id`, `projectType`, `sizeBand`, `proReq`, `jurisdiction`, `program`, and `phases` (p1–p6)
- Each phase object: `status` (from STATUS enum), `actors` (array of actor codes), `tools` (array of strings), `deliverable` (string), `notes` (string)
- Use `noEC("reason")` helper for phases with no EC activity
- Actor codes must exist in `ACTORS_LIST`
- Standards referenced in `STANDARDS_MAP_BY_ROW` must exist in `STANDARDS`

### When Adding New Rows
1. Add the row object to `ROWS` array
2. Add standards mapping to `STANDARDS_MAP_BY_ROW`
3. Add code updates to `CODE_UPDATES_ROW_MAP` if applicable
4. Add PT equivalents if applicable
5. Ensure all actor codes used are in `ACTORS_LIST`
6. Ensure jurisdiction ID is in `JURISDICTIONS`

## Next Feature: Flow Model View

### Goal
Add a **"Flow Model"** button/toggle that presents the same underlying data as a streamlined flowchart/process view rather than the current card/table layout. The cards are comprehensive but overwhelming — the flow view should simplify navigation by showing the process from any starting point.

### Design Intent
- **Same sidebar** — all existing filters (Project Type, Building Size, Jurisdiction, Actor/Role) remain
- **New toggle** — "Flow Model" button switches the main content area from card view to flow view
- The flow view should present a **decision-tree / process-flow** visualization showing:
  - Sequential phases (p1 → p2 → p3 → p4 → p5 → p6) as connected nodes
  - At each phase node: status indicator, responsible actors, key deliverable
  - Decision points (e.g., prescriptive vs. performance path, permit required vs. not)
  - Branching based on the selected filters
- **Starting points** (entry lenses):
  1. **Project Type** — "I'm building a new Part 9 house, what do I need to do?"
  2. **Building Size** — "My project is Part 3 medium, what's the EC landscape?"
  3. **Jurisdiction** — "I'm in Vancouver, what's required?"
  4. **Actor/Role** — "I'm an Architect, what are my EC touchpoints?" (builds on the successful Actor Lens)

### Reference
- `BfCA Resources/Building application flow chart.pdf` — existing flowchart showing prescriptive / performance / EnerGuide branching. Good structural model for the flow view, but our version needs to overlay EC requirements onto this process.

### Implementation Notes
- Keep it pure CSS/JS/SVG — no external libraries (consistent with current approach)
- Flow nodes should use the existing status colour palette
- Actor lens should work in flow mode too (dim irrelevant nodes, highlight actor's phases)
- Consider a vertical flow (top-to-bottom) with horizontal branching for parallel paths
- Mobile/responsive is secondary — desktop-first like the current app

## Domain Knowledge

### Regulatory Hierarchy (Canada)
1. **Federal** — NRC develops National Model Codes (NBC, NECB); Treasury Board Standard on Embodied Carbon (only current mandatory EC requirement in Canada)
2. **Provincial/Territorial** — Adopt and adapt model codes into binding law (e.g., Ontario OBC + SB-10/SB-12, BC Building Code + Energy Step Code)
3. **Municipal** — Enforce provincial codes; some add EC requirements via development permits (Vancouver ZEB/EC Program, Toronto TGS)

### Building Size Split
- **Part 9** — residential, ≤ 3 storeys, ≤ 600 m². Simpler prescriptive rules. Professional exemption for architects/engineers in most PTs.
- **Part 3** — all larger buildings. Performance-based. AR + PE mandatory from inception.

### EC Status Landscape (2025–26)
- **Mandatory EC:** Federal buildings (Treasury Board Standard + NRC Practitioner's Guide); Vancouver Part 3 (VBBL s.10.4 + COV Addendum v1.0, April 2025); Vancouver Part 9 low-rise residential (ZEB Bulletin Appendix II, Jan 2026 — BEAM/MCE2 mandated as primary tools, BfCA-developed methodology)
- **Emerging EC:** Toronto TGS (Tier 3–4 WLC), BC CleanBC roadmap (Part 3 expected 2–5 years)
- **Voluntary EC:** LEED, CaGBC ZCB-Design v4, Passive House, CMHC MLI Select
- **No EC requirement:** Most provincial codes, most Part 9 paths outside Vancouver, prescriptive compliance paths
