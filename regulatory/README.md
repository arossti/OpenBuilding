# Regulatory

Research and tooling for understanding Canadian Part 9 building code requirements as they relate to embodied carbon compliance. This workstream is led by Andy Thomson and focuses on mapping the regulatory landscape that BEAM will need to support.

## Contents

### `background/`

Reference documentation provided by BfCA to guide Andy's research into regulatory areas outside of energy modeling — specifically zoning, structural/safety codes, and municipal enforcement for Part 9 buildings.

- **`Navigating Part 9 Building Codes and Municipal Permitting Frameworks.md`** — Research directives covering provincial/territorial enforcement variances, zoning and Green Development Standards, alternative material approval processes, and renovation triggers for existing buildings.
- **`Building application flow chart.pdf`** — Visual flowchart of the building permit application process, showing prescriptive, performance, and EnerGuide compliance pathways.

## EC Matrix tool

The EC Matrix (interactive compliance tool) was consolidated into the PDF-Parser app on 2026-04-18. It now lives at:

- **`PDF-Parser/matrix.html`** — current Matrix app
- **`PDF-Parser/matrix.css`** — light-theme styles
- **`docs/matrix/`** — data model, architecture, and triage docs

Users navigate between the PDF-Parser and Matrix using header buttons in either app.

## Relationship to BEAM

The EC matrix tool and supporting research will inform how BEAM presents compliance requirements to users — helping builders, energy advisors, and building officials understand what embodied carbon obligations apply to their specific project context (jurisdiction, building type, size, and phase).
