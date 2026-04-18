# IFC

Research into parsing IFC (Industry Foundation Classes) building models to extract assembly and material data for import into a future version of BEAM. The goal is to enable builders to bring existing building information models directly into BEAM for embodied carbon analysis.

## Contents

- **`Highland_Haven.ifc`** — Reference IFC building model for testing and development. Will be managed with DVC (not tracked in git).
- **`2025.06.12 _ 2.0 Durospan.ifc.zip`** — Compressed reference IFC model for a Durospan structure. Will be managed with DVC (not tracked in git).
- **`NRC Assemblies.pdf`** — Reference document from research mapping embodied carbon metrics to building assemblies and visualizing the resulting data. This approach is a candidate for adaptation into BEAM's assembly-level carbon analysis.

## Relationship to BEAM

BEAM currently relies on manual data entry and HOT2000 file import for building geometry and materials. IFC integration would provide a direct path from BIM (Building Information Modeling) authoring tools into BEAM, reducing manual effort and enabling richer assembly-level carbon analysis.
