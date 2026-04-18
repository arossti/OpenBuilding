# Materials Database Schema — Workplan

> Stub — to be fleshed out after today's discussion.

## Goal

Define a JSON schema for the BfCA materials database. The schema must be extensible to hold embodied carbon data **plus** a full wbLCA impact category set, cost per unit, fire ratings, thermal properties, and source/vendor metadata.

## First deliverable

Port ~1,000 material reference rows from the BEAM Excel spreadsheet into a validated JSON file, suitable for consumption by:

- PDF-Parser volumetric takeoff (volume × material → EC)
- BEAM (embodied carbon assessment)
- Future wbLCA tooling (multi-impact analysis)

## Key design principle — extensibility

Even if the initial import only populates a subset of fields (e.g., GWP, density), the schema must reserve structured locations for:

- **Cost:** CAD per unit (m³, m², kg, unit)
- **Fire ratings:** FRR, ULC listings, combustibility
- **wbLCA impact categories:**
  - Global Warming Potential (GWP) — kg CO₂e
  - Eutrophication — kg N eq
  - Acidification — kg SO₂ eq
  - Ozone depletion — kg CFC-11 eq
  - Smog formation — kg O₃ eq
  - Primary energy demand — MJ
  - Water consumption — m³
  - TRACI v2.1 categories
- **Physical properties:** density, R-value, thermal mass
- **Source metadata:** EPD reference, publication date, geography, manufacturer

## Open questions (to discuss)

- Flat schema vs. nested by category group?
- Single `materials.json` or split by category (concrete, wood, steel, insulation)?
- ID strategy: slug, UUID, or stable string key?
- Versioning approach for schema evolution?
- Where does the file live? (`schema/materials.json`, `schema/categories/*.json`, ...)
- CSV-to-JSON conversion: one-time script or repeatable build step?
- Validation: JSON Schema Draft-07, custom validator, or both?

## Workflow

1. User shares BEAM Excel export as CSV (with formulas preserved)
2. Inspect CSV column structure + data relationships
3. Design JSON schema with extensibility hooks for future fields
4. Build conversion script (CSV → validated JSON)
5. Validate sample, commit generated JSON + schema + script
6. Document usage from PDF-Parser and BEAM consumers
