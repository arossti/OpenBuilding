# Regulatory

Research and tooling for understanding Canadian Part 9 building code requirements as they relate to embodied carbon compliance. This workstream is led by Andy Thomson and focuses on mapping the regulatory landscape that BEAM will need to support.

## Contents

### `matrix/`

Interactive tool mapping roles, responsibilities, tools, standards, and compliance requirements for embodied carbon assessments across Canadian building types, sizes, jurisdictions, and project phases.

- **`ec_matrix_step15.html`** — Current version of the EC matrix app. A self-contained single-file HTML application (no dependencies, opens directly in a browser). Aligned to NBC/NECB 2025 Draft.
- **`ec_matrix_v2.md`** — Comprehensive markdown documentation of the full data model powering the matrix app.
- **`CLAUDE.md`** — Detailed project documentation including architecture notes, data model definitions, design system specifications, conventions, and next feature proposals. See this file for technical and development guidance.

### `background/`

Reference documentation provided by BfCA to guide Andy's research into regulatory areas outside of energy modeling — specifically zoning, structural/safety codes, and municipal enforcement for Part 9 buildings.

- **`Navigating Part 9 Building Codes and Municipal Permitting Frameworks.md`** — Research directives covering provincial/territorial enforcement variances, zoning and Green Development Standards, alternative material approval processes, and renovation triggers for existing buildings.
- **`Building application flow chart.pdf`** — Visual flowchart of the building permit application process, showing prescriptive, performance, and EnerGuide compliance pathways.

## Relationship to BEAM

The EC matrix tool and supporting research will inform how BEAM presents compliance requirements to users — helping builders, energy advisors, and building officials understand what embodied carbon obligations apply to their specific project context (jurisdiction, building type, size, and phase).
