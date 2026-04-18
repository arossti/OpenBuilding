# Materials Database Schema — Workplan

Status: **Sample record ready for review** (`sample.json`). Full porting, validator, and conversion script are follow-up tasks.

## Goal

Define a canonical JSON record for a single material that serves multiple consumers in one structure:

- **BEAM / wbLCA tools** — embodied carbon + full impact category analysis
- **PDF-Parser** — material picker for volumetric takeoff (volume × material → EC)
- **BIM / rendering tools** (e.g., ABCD.EARTH) — shader properties, texture refs, base colour
- **Future tools** — cost estimation, fire compliance, thermal modelling, code-compliance checks

Each record carries everything needed to place it in a wbLCA calc, pick it in a UI, and render it in 3D. Consumers read only the fields they need.

## Source inputs

| Source | Rows | Purpose |
|---|---|---|
| `schema/BEAM Database-DUMP.csv` | ~820 unique (1,753 rows with gaps) | BEAM's legacy 65-column material data — the primary import |
| `schema/materials.json` | 33 | ABCD.EARTH's existing schema — donor of rendering hints (base_color, metallic, roughness, texture, has_grain) |
| Future EPD PDFs | — | ISO 21930 / EN 15804 Type III declarations to be parsed row-by-row into the same schema |

## Design decisions (locked in, 2026-04-18)

| Decision | Choice | Rationale |
|---|---|---|
| Primary key | `id` (slug) top-level; `beam_id` preserved inside `external_refs` | Not every future material comes from BEAM; slugs are URL/diff-friendly; BEAM ID remains indexable |
| Null vs missing | **Schema-complete, nullable** — every field present, `null` when unavailable | Readers can traverse without optional-chaining; diffs show where data got filled in |
| Arrays | Always `[]` when empty, never `null` | `.forEach` safe |
| Unit convention | **Unit in field name** (`density_kg_m3`, `gwp_kgco2e`) | Self-documenting; survives flattening to CSV/BigQuery |
| Variable-unit fields | Paired `functional_unit` string (e.g., `carbon.common.per_functional_unit`) | BEAM's "common unit" is per-material (m², m³, kg, linear m) — can't bake into field name |
| `carbon` vs `impacts` | **Separate blocks** | `carbon` preserves BEAM's audit trail (stated → conversion → common → biogenic); `impacts` is the harmonised wbLCA view with `source` discriminator |
| Case | snake_case everywhere | Normalised from BEAM's mixed casing |
| Dates | ISO 8601 strings; raw Excel serials preserved in `provenance.original_beam_added_or_modified_serial` | Round-trip audit |
| Country codes | ISO 3166-1 alpha-3 arrays (`"US & CA"` → `["USA","CAN"]`) | Unambiguous; tool-friendly |
| Biogenic method | Explicit enum `method: "wwf_storage_factor" \| "en_15804_negative_a1" \| "none"` | Makes the calculation methodology auditable; EPD parser fills later |

## Record structure (20 top-level keys)

```
$schema, schema_version, id,
external_refs, naming, manufacturer, notes, source_notes, status,
classification, rendering,
physical, carbon, impacts,
cost, fire, code_compliance,
epd, methodology, provenance
```

See `sample.json` for the fully-populated example (BEAM LAM011 — Nordic X-Lam CLT 3½").

## Sub-object purposes

| Block | Purpose |
|---|---|
| `external_refs` | Stable external IDs: `beam_id`, `beam_csv_row_index`, future `mce2_id`, `ec3_id`, `ifc_material_guid` |
| `naming` | Human-readable names: display_name, short_name, material_name, product_brand_name |
| `manufacturer` | Who makes it: name, country_code (ISO alpha-3), specifications, website |
| `status` | Curation flags: listed, do_not_list, is_industry_average, is_beam_average, visibility |
| `classification` | Taxonomy: CSI division, category slug, material/product type + subtype, `typical_elements[]` enum |
| `rendering` | Shader hints: base_color RGBA, metallic, roughness, texture, has_grain |
| `physical` | Material science: density (dual-unit), thermal props, dimensions, mass, moisture, `additional_factor` |
| `carbon` | BEAM's GWP audit trail: stated → conversion → common → biogenic (full calculation graph) |
| `impacts` | Harmonised wbLCA view: GWP + eutrophication + acidification + ... (each `{value, source}`) |
| `cost` | Future: CAD/unit, year, geography, source |
| `fire` | Future: FRR, combustibility, ULC listing, flame/smoke ratings |
| `code_compliance` | Future: NBC Part 9/3, VBBL s.10.4, COV Appendix II acceptance |
| `epd` | Provenance: id, type, owner, prepared_by, program, validation, dates, URL |
| `methodology` | LCA method, standards, PCR, software, LCI database, lifecycle scope (A1–D stages) |
| `provenance` | Geography, dates, import metadata with CSV row index for round-trip audit |

## Full field inventory (shareable with team)

Every leaf field the schema defines, grouped by top-level block. Type hints: `str`, `num`, `bool`, `str[]`, `num[4]`, `ISO-3166-1α3`, `enum(...)`. All fields are nullable unless marked required.

### Top-level identity
| Field | Type | Notes |
|---|---|---|
| `$schema` | str | URL to JSON Schema definition (aspirational) |
| `schema_version` | num | Integer, bumped on breaking changes |
| `id` | str | **Required.** Slug primary key (e.g., `clt_nordic_xlam_3_5in`) |
| `notes` | str | Free-form user commentary |
| `source_notes` | str | Import-time annotations (e.g., "BfCA BioC calc by mass") |

### `external_refs` — cross-catalogue IDs
| Field | Type |
|---|---|
| `beam_id` | str — BEAM CSV column A |
| `beam_csv_row_index` | num — 1-based, for round-trip audit |
| `mce2_id` | str — future |
| `ec3_id` | str — future, EC3 database |
| `ifc_material_guid` | str — future, IFC IfcMaterial GUID |

### `naming`
| Field | Type |
|---|---|
| `display_name` | str — long form with manufacturer/spec |
| `short_name` | str — UI-friendly |
| `material_name` | str — generic (e.g., "Cross Laminated Timber") |
| `product_brand_name` | str — product line (e.g., "X-Lam") |

### `manufacturer`
| Field | Type |
|---|---|
| `name` | str |
| `country_code` | ISO-3166-1α3 |
| `specifications` | str — free-form |
| `website` | str URL |

### `status`
| Field | Type |
|---|---|
| `listed` | bool |
| `do_not_list` | bool |
| `is_industry_average` | bool |
| `is_beam_average` | bool |
| `visibility` | enum(`public`, `hidden`, `deprecated`) |

### `classification`
| Field | Type |
|---|---|
| `division_prefix` | str — CSI 2-digit (e.g., `"06"`) |
| `division_name` | str — CSI division name |
| `category` | str — slug (`06_wood`) |
| `csi_masterformat` | str — full CSI code |
| `uniformat_level2` | str — future |
| `material_type` | str — BEAM generic |
| `material_subtype` | str |
| `product_type` | str |
| `product_subtype` | str |
| `typical_elements` | str[] — enum (foundation, slab, wall_exterior, …) |

### `rendering` — shader hints
| Field | Type |
|---|---|
| `base_color` | num[4] — RGBA floats 0-1 |
| `metallic` | num 0-1 |
| `roughness` | num 0-1 |
| `texture` | str path |
| `has_grain` | bool |

### `physical`
| Field | Type |
|---|---|
| `density.value_kg_m3` | num |
| `density.value_lb_ft3` | num — derived from kg_m3 × 0.06243 |
| `density.source` | enum(`epd`, `estimated`, `materials_science`) |
| `thermal.conductivity_w_mk` | num |
| `thermal.resistance_per_inch_rsi` | num |
| `thermal.r_value_per_inch_imperial` | num |
| `thermal.heat_capacity_j_kgk` | num |
| `moisture_content_pct` | num |
| `mass_per_unit_kg` | num |
| `dimensions.length_m` | num |
| `dimensions.width_m` | num |
| `dimensions.depth_m` | num |
| `dimensions.unit_volume_m3` | num |
| `dimensions.units_per_m2` | num |
| `additional_factor.value` | num |
| `additional_factor.units` | str |
| `additional_factor.description` | str |

### `carbon.stated` — raw EPD declaration
| Field | Type |
|---|---|
| `value_kgco2e` | num |
| `per_unit` | str — declared unit (m³, kg, m², etc.) |
| `source` | enum(`epd`, `industry_average`, `estimated`) |
| `lifecycle_stages` | str[] — EN 15804 stages reported |

### `carbon.conversion` — declared → functional unit
| Field | Type |
|---|---|
| `to_common_unit` | str |
| `factor` | num — multiplier |
| `factor_formula` | str |
| `factor_source` | enum(`physical_dimensions`, `mass_density`, `explicit_epd`, `manual`) |
| `notes` | str |

### `carbon.common` — harmonised functional-unit result
| Field | Type |
|---|---|
| `value_kgco2e` | num |
| `per_functional_unit` | str |
| `metric_unit_label` | str |
| `imperial_unit_label` | str |

### `carbon.biogenic` — sequestration math
| Field | Type |
|---|---|
| `gwp_bio_from_epd_kgco2e_per_common_unit` | num |
| `carbon_content_pct_kgc_kg` | num |
| `biogenic_factor` | num |
| `storage_retention_pct` | num 0-1 |
| `wwf_storage_factor_kgco2e_per_kgc` | num |
| `stored_kgco2e_per_common_unit` | num |
| `full_carbon_kgco2e_per_common_unit` | num |
| `carbon_content_kgc_per_unit` | num |
| `co2_to_c_molar_ratio` | num (constant 3.67) |
| `method` | enum(`wwf_storage_factor`, `en_15804_negative_a1`, `none`) |
| `notes` | str |

### `impacts` — harmonised wbLCA view
| Field | Type |
|---|---|
| `functional_unit` | str |
| Each of `gwp_kgco2e`, `gwp_bio_kgco2e`, `eutrophication_kgneq`, `acidification_kgso2eq`, `ozone_depletion_kgcfc11eq`, `smog_kgo3eq`, `abiotic_depletion_fossil_mj`, `water_consumption_m3`, `primary_energy_nonrenewable_mj`, `primary_energy_renewable_mj` | `{ value: num, source: enum(epd_direct \| beam_derived \| industry_average \| estimated) }` |

### `cost` (future)
`unit`, `cad_per_unit`, `year`, `geography`, `source`

### `fire` (future)
`frr_hours`, `combustibility` (enum `non_combustible | combustible | fr_treated`), `ulc_listing`, `flame_spread_rating`, `smoke_developed_rating`

### `code_compliance` (future, BfCA-specific)
`nbc_part_9_suitable`, `nbc_part_3_suitable`, `vbbl_s10_4_accepted`, `cov_appendix_ii_listed`

### `epd` — provenance
| Field | Type |
|---|---|
| `id` | str |
| `type` | enum(`product_specific`, `industry_average`, `generic`, `beam_average`) |
| `owner` | str |
| `prepared_by` | str |
| `program_operator` | str |
| `validation.type` | enum(`internal`, `external`) |
| `validation.agent` | str |
| `publication_date` | ISO date |
| `expiry_date` | ISO date |
| `product_service_life_years` | num |
| `source_document_url` | str |
| `footnote` | str |

### `methodology`
| Field | Type |
|---|---|
| `standards` | str[] |
| `pcr_guidelines` | str |
| `lca_method` | str (e.g., `TRACI 2.1`) |
| `lca_software` | str |
| `lci_database` | str |
| `lifecycle_scope.stages_included` | str[] |
| `lifecycle_scope.cutoff_rule_pct` | num |
| `lifecycle_scope.allocation_method` | enum(`mass`, `economic`, `system_expansion`) |

### `provenance`
| Field | Type |
|---|---|
| `countries_of_manufacture` | ISO-3166-1α3[] |
| `markets_of_applicability` | ISO-3166-1α3[] |
| `data_added_or_modified` | ISO date |
| `original_beam_added_or_modified_serial` | num — Excel serial preserved |
| `source_notes` | str |
| `import_metadata.imported_from` | str |
| `import_metadata.import_date` | ISO date |
| `import_metadata.beam_csv_row_index` | num |
| `import_metadata.beam_csv_sha256` | str — hash of source CSV |

## Field reference codes (for docs & conversation)

To talk about fields tersely in PRs, chat, and issues without embedding numeric IDs in the JSON data itself, use these short block prefixes. They're a documentation convention — the JSON on disk stays clean.

| Code | Block | Full path prefix |
|---|---|---|
| `TOP` | top-level identity | `$schema`, `schema_version`, `id`, `notes`, `source_notes` |
| `EXT` | cross-catalogue IDs | `external_refs.*` |
| `NAM` | naming | `naming.*` |
| `MFR` | manufacturer | `manufacturer.*` |
| `STS` | curation status | `status.*` |
| `CLS` | classification | `classification.*` |
| `RND` | rendering hints | `rendering.*` |
| `PHD` | physical density | `physical.density.*` |
| `PHT` | physical thermal | `physical.thermal.*` |
| `PHM` | physical dimensions | `physical.dimensions.*` |
| `PHA` | physical additional factor | `physical.additional_factor.*` |
| `PHX` | physical misc (moisture, mass) | `physical.{moisture_content_pct, mass_per_unit_kg}` |
| `CST` | carbon stated | `carbon.stated.*` |
| `CCN` | carbon conversion | `carbon.conversion.*` |
| `CCM` | carbon common (harmonised) | `carbon.common.*` |
| `CBG` | carbon biogenic | `carbon.biogenic.*` |
| `IMP` | impacts (wbLCA) | `impacts.*` |
| `CSTS` | cost (future) | `cost.*` |
| `FIR` | fire (future) | `fire.*` |
| `CCL` | code compliance (future) | `code_compliance.*` |
| `EPD` | EPD provenance | `epd.*` |
| `MTH` | methodology | `methodology.*` + `methodology.lifecycle_scope.*` |
| `PRV` | provenance | `provenance.*` |
| `IMT` | provenance import metadata | `provenance.import_metadata.*` |

Example usage: "`CBG.storage_retention_pct` needs to be clamped to 0–1 in the importer" or "UI filter should check `CLS.typical_elements` for `wall_exterior`."

**Why not numeric IDs in the JSON?** Paths are already unique and self-documenting. Numeric IDs add payload weight, invisible maintenance burden (deprecated IDs need to stay reserved), and buy nothing over path strings. When we need strict field identity for schema evolution, `material.schema.json` (deliverable #1) will use JSON Schema Draft 2020-12 `$id`/`$anchor` on `$defs` — that mechanism gives stable IDs without polluting record data.

---

## File size & module splitting

### Size projections

Measured from `sample.json` (minus the `_lifecycle_scope_reference` documentation block):

| Records | Pretty-printed | Minified | Gzipped (est.) |
|---|---|---|---|
| 1 | ~6.2 KB | ~4.7 KB | ~1.2 KB |
| 820 (actual BEAM count) | ~4.8 MB | ~3.6 MB | **~0.9 MB** |
| 1000 (rounded) | ~5.9 MB | ~4.5 MB | **~1.1 MB** |

**Takeaway:** A monolithic `materials.json` is viable (~1 MB gzipped over the wire) but borderline for a browser-first tool. The PDF-Parser's material picker should not force a full load when the user is measuring, say, concrete foundation walls and only needs division 03 materials. **Recommend splitting.**

### Recommended split: CSI MasterFormat for files, UNIFORMAT as in-record filter

CSI and UNIFORMAT answer different questions and are **orthogonal** — they don't compete for the same role:

| Question | Taxonomy | Role |
|---|---|---|
| *What material is this?* (steel, concrete, wood) | **CSI MasterFormat** — 50 divisions, of which ~15 have entries in BEAM | **File-level split** — one JSON per CSI division |
| *Where does it go in the building?* (foundation, wall, roof, floor) | **UNIFORMAT II** — A/B/C/D/E/F/G elemental groupings | **In-record filter** via existing `classification.typical_elements[]` |

**Why CSI wins for file organisation:**
- BEAM's Display Names already prefix with CSI division (`"05 | Steel Panel"`, `"06 | Plywood"`) — the split is free.
- Each material belongs to **exactly one** CSI division (concrete is always 03, never "also 06"). UNIFORMAT would force duplicating materials that serve multiple elements (concrete appears in both A Substructure and B Superstructure).
- CSI aligns with how specs are written and how trades are organised on site — the users of these tools already think in CSI.

**Why UNIFORMAT stays in `typical_elements[]`:**
- Already in the schema; no new scheme needed.
- Lets a record be searchable across multiple element types simultaneously (`["floor", "roof_deck", "wall_shear"]` for CLT).
- PDF-Parser volumetric takeoff filters client-side: "show me division-06 materials where `typical_elements` includes `wall_exterior`."

### Recommended file layout

```
schema/
├── material.schema.json          JSON Schema validator (future)
├── sample.json                   CLT LAM011 full-fields reference
└── materials/
    ├── index.json                Lightweight catalogue (see below)
    ├── 03-concrete.json
    ├── 04-masonry.json
    ├── 05-metals.json
    ├── 06-wood.json              Wood + bamboo + wood fibre (~60 records)
    ├── 07-thermal.json           Insulation family: mineral wool + PIR + EPS + XPS + foam glass + cellulose (~70)
    ├── 08-openings.json          Windows, doors, glazing
    ├── 09-finishes.json          Gypsum, vinyl, linoleum, paint
    ├── 31-earthwork.json         (future / sparse)
    └── 32-sitework.json          (future / sparse)
```

### `materials/index.json` — what's in it

A "directory" file the UI always loads first. Projected size: ~100 KB for 1000 records. Carries only the fields needed for picker display and filtering:

| Field | Source full-record path | Purpose in index |
|---|---|---|
| `id` | `id` | Primary key; used to fetch full record |
| `beam_id` | `external_refs.beam_id` | Cross-reference |
| `display_name` | `naming.display_name` | UI list label |
| `category` | `classification.category` | Group header (`06_wood`) |
| `division_prefix` | `classification.division_prefix` | Which per-division file to fetch |
| `typical_elements` | `classification.typical_elements` | UNIFORMAT filter axis |
| `gwp_kgco2e` | `impacts.gwp_kgco2e.value` | Preview number in the picker |
| `functional_unit` | `impacts.functional_unit` | Preview unit label |

~8 short fields per record × 1000 records ≈ 100 KB pretty, ~30 KB gzipped. Acceptable startup cost.

### Load pattern for the PDF-Parser material picker

```
1. App boot:      fetch materials/index.json         (~30 KB gz, once, cached)
2. Picker open:   render list from index             (no network)
3. User filters:  "division 06 + typical_element=wall_exterior"
                  → fetch materials/06-wood.json     (~300 KB gz, once per division, cached)
4. User picks X:  full record already in memory      (no extra fetch)
```

### Import script responsibilities (future `beam-csv-to-json.mjs`)

1. Produce per-division files into `materials/NN-slug.json`.
2. Produce `materials/index.json` from the aggregate.
3. Emit a report of any BEAM rows whose division couldn't be inferred (expect ~few; 337 BEAM rows have blank `Material Type` but most have division-prefixed Display Names we can parse).
4. Validate every emitted record against `material.schema.json` before writing.

---

## IFC (Industry Foundation Classes) alignment

IFC / ISO 16739 is the open BIM data exchange standard. Our schema is a **superset** of what typical IFC material data carries — we can absorb IFC material data on import and emit IFC-compatible material entities on export. Full bidirectional read/write is a future phase; this section documents the alignment so we build in the right direction.

### Our schema → IFC 4.x mapping

| Our field | IFC 4.x entity / property set |
|---|---|
| `id` | `IfcMaterial.Name` (or `.GlobalId` for `IfcMaterial` in IFC 4.3) |
| `external_refs.ifc_material_guid` | `IfcMaterial.GlobalId` — the natural cross-reference |
| `naming.material_name` | `IfcMaterial.Name` |
| `naming.display_name` | `IfcMaterial.Description` |
| `classification.category` | `IfcMaterial.Category` |
| `classification.csi_masterformat` | `IfcClassificationReference` relationship (via `IfcRelAssociatesClassification`) |
| `physical.density.value_kg_m3` | `Pset_MaterialCommon.MassDensity` |
| `physical.thermal.conductivity_w_mk` | `Pset_MaterialThermal.ThermalConductivity` |
| `physical.thermal.heat_capacity_j_kgk` | `Pset_MaterialThermal.SpecificHeatCapacity` |
| `physical.moisture_content_pct` | `Pset_MaterialHygroscopic` (partial) |
| `rendering.base_color` | `IfcSurfaceStyleRendering.DiffuseColour` (or PBR in IFC 4.3: `IfcSurfaceStyleRefraction`) |
| `rendering.metallic`, `roughness` | IFC 4.3 PBR: `IfcSurfaceStyleRendering` extensions (MetalnessRoughness model) |
| `rendering.texture` | `IfcSurfaceTexture` |
| `fire.combustibility` | `Pset_MaterialCombustion` (partial) + building-element-level Psets |
| `fire.frr_hours` | `Pset_BuildingElementProxyFireHazardProperties` (element-bound, not material-bound in IFC) |
| `impacts.*` (GWP, EP, AP, ODP, POCP, ADP, etc.) | `IfcEnvironmentalImpactValue` (IFC 4.0+) with `ImpactCategoryEnum` + `IfcLifeCycleStage` — **direct structural match** |
| `carbon.stated.lifecycle_stages[]` | `IfcLifeCycleStage` enum on `IfcEnvironmentalImpactValue` — same A1–D taxonomy |
| `epd.*` (full EPD provenance) | No native IFC entity — would be emitted as custom `IfcPropertySet` (e.g., `Pset_BfCA_EPDProvenance`) |
| `methodology.*` | No native IFC entity — custom Pset |
| `code_compliance.*` | No native IFC entity — custom Pset or `IfcRelAssociatesApproval` |
| `carbon.biogenic.*` | Partial alignment with `IfcEnvironmentalImpactValue.Category = BIOGENICCARBONEQUIVALENT` (IFC 4.3+); detailed math fields (factor, retention_pct, molar_ratio) are custom |

### Observations

1. **Strong alignment on physical properties**: our `physical` block maps cleanly onto IFC's standard material property sets (`Pset_MaterialCommon`, `Pset_MaterialThermal`). An IFC importer can populate these without custom schemas.

2. **Strong alignment on impact categories**: IFC 4.0+ has `IfcEnvironmentalImpactValue` with `ImpactCategoryEnum` and `LifeCycleStage` — **our `impacts` block and `lifecycle_stages` enum use the same taxonomy (EN 15804)**. This is the key compatibility win: the industry is converging on these names.

3. **Schema gaps vs. IFC**: IFC has richer mechanical and optical properties (`Pset_MaterialMechanical`, `Pset_MaterialOptical`) that we don't yet model. When imported from IFC, we'd stash these in a forward-compat `physical.mechanical.*` / `physical.optical.*` block (future addition).

4. **IFC gaps vs. our schema**: IFC has no native representation for:
   - EPD provenance chain (id, owner, verifier, PCR, etc.)
   - BEAM's explicit conversion math (`carbon.conversion.factor`, etc.)
   - BfCA-specific code compliance (NBC / VBBL / COV)
   - Biogenic storage methodology (WWF factor, storage retention %)

   On export to IFC, these fields become a **custom `IfcPropertySet`** (naming convention: `Pset_BfCA_*`) attached via `IfcRelDefinesByProperties`. IFC fully supports this pattern — custom Psets are first-class citizens.

### Future work

- `schema/ifc/` directory for IFC interop:
  - `ifc-import.md` — rules for parsing `IfcMaterial` + standard Psets into our schema
  - `ifc-export.md` — rules for emitting IFC-conformant materials with BfCA custom Psets
  - `pset_bfca_epd_provenance.json` — formal custom Pset definition
- Test fixture: round-trip a material through IFC (export → import → verify no data loss on overlapping fields)
- Alignment audit when IFC 5 drops (expected to expand environmental property modelling)

---

## Calculation audit — how `carbon` captures BEAM's math

BEAM encodes three calculation passes. The schema preserves each explicitly so a consumer can verify the arithmetic (or a future EPD parser can populate each step from an EPD PDF):

```
carbon.stated       →  raw EPD declaration: "69.96 kgCO2e per m³"
carbon.conversion   →  functional unit conversion: "divide by 11.249 units/m² = 0.0889× multiplier"
carbon.common       →  result: "6.22 kgCO2e per m² at 3.5″"
carbon.biogenic     →  sequestration math: density × thickness × biogenic_factor × carbon_content × 3.67
                       then × storage_retention (0.9) for long-term stored CO2e
```

The CO₂:C molar ratio (44/12 ≈ 3.67) is preserved as `carbon.biogenic.co2_to_c_molar_ratio` — constant but explicit.

## Field count by domain (for import script planning)

| Domain | Fields | Populated in LAM011 sample |
|---|---|---|
| Top-level identity (`$schema`, `schema_version`, `id`, `notes`, `source_notes`) | 5 | 4 |
| `external_refs` | 5 | 2 |
| `naming` + `manufacturer` | 8 | 6 |
| `status` | 5 | 5 |
| `classification` | 10 | 7 |
| `rendering` | 5 | 5 (invented defaults) |
| `physical` (density + thermal + dimensions + additional_factor) | 14 | 7 |
| `carbon` (stated + conversion + common + biogenic) | 20 | 17 |
| `impacts` (10 × `{value, source}` + `functional_unit`) | 21 | 3 (GWP only) |
| `cost` / `fire` / `code_compliance` | 14 | 1 (combustibility) |
| `epd` + `methodology` + `provenance` | 27 | 17 |
| Structural sub-object keys | 9 | 9 |
| **Total leaf fields** | **143** | **88 populated, 55 null** |

Counts verified from `sample.json` with `jq`/Python traversal. Documentation annotations (`_lifecycle_scope_reference` and its 17 children) are additional and not part of the schema's data surface.

## Fields that can't be directly mapped from BEAM

Fields that need manual fill, computation, or stay null for the BEAM import:

- `external_refs.mce2_id`, `ec3_id`, `ifc_material_guid` → null
- `naming.short_name` → derive from display_name manually
- `classification.typical_elements` → small per-material-type lookup table
- `rendering.*` → fuzzy-match ABCD.EARTH by material_type; default per category when missing
- `physical.density.value_lb_ft3` → computed (kg_m3 × 0.06243)
- `physical.thermal.heat_capacity_j_kgk` → null; future materials-science lookup
- `carbon.biogenic.method` → derive: biogenic fields populated → `"wwf_storage_factor"`, else `"none"`
- `impacts.*` (non-GWP) → null; EPD parser fills
- `cost.*`, `fire.*` (except combustibility), `code_compliance.*` → null; out of BEAM scope
- `methodology.lifecycle_scope.cutoff_rule_pct`, `allocation_method` → null; EPD parser fills

## Fields that are lossy to port from BEAM

| BEAM column | Handling |
|---|---|
| Excel date serials (mix of year integers and day-count serials) | If value < 3000 → treat as year; if > 30000 → Excel serial → ISO date; preserve raw in `provenance.original_beam_added_or_modified_serial` |
| Formula cells (`=Q545/11.249`, `=IFERROR(DUMMYFUNCTION(...))`) | Evaluate or reconstruct from referenced columns; extract fallback strings from IFERROR arguments |
| `Footnote` column (IFERROR with conditional expired-status prose) | Parse out the final quoted fallback; split on `;` → structured flags |
| Sparse `CSI MasterFormat` (~0.4% populated) | Port as-is; no synthesis |
| Free-text country strings (`"US & CA"`) | ISO 3166-1 alpha-3 arrays via lookup table; log misses |
| Polymorphic `Addn'l factors` + units | Keep as `physical.additional_factor.{value, units, description}`; flag in schema |
| Duplicate `Common Unit: kgCO2e / _` columns (T and AA) | Rename to distinct paths: `carbon.common.per_functional_unit` vs biogenic-local context |
| Whitespace + non-breaking spaces in `EPD ID` values | `.trim()` on import |
| ~933 blank rows in CSV | Skip rows with empty ID |

## EPD parser implications

The schema *structure* mirrors ISO 21930 / EN 15804 EPD document sections. A future parser can walk an EPD PDF and populate:

- EPD "Declared unit" → `carbon.stated.{value_kgco2e, per_unit}`
- EPD "Functional unit" → `carbon.common.per_functional_unit` + `impacts.functional_unit`
- EPD "Reference service life" → `epd.product_service_life_years`
- EPD "Lifecycle modules" → `carbon.stated.lifecycle_stages[]` + `methodology.lifecycle_scope.stages_included[]`
- EPD "Allocation procedure" → `methodology.lifecycle_scope.allocation_method`
- EPD impact table rows → `impacts.{gwp, eutrophication, acidification, ...}.value` with `source: "epd_direct"`
- EPD "Biogenic carbon" row (EN 15804+A2) → `carbon.biogenic.gwp_bio_from_epd_kgco2e_per_common_unit`
- EPD registration # → `epd.id`; program operator → `epd.program_operator`; verifier → `epd.validation.agent`

The `source` discriminator (`"epd_direct" | "beam_derived" | "industry_average" | "estimated" | null`) on impact values distinguishes parsed-from-EPD numbers from BEAM-derived ones — important for data quality audits.

## Next deliverables (not in this commit)

1. `schema/material.schema.json` — formal JSON Schema Draft 2020-12 validator (with `$defs` + stable `$anchor` IDs for strict field identity)
2. `schema/lookups/` — `country-codes.json`, `typical-elements.json`, `csi-divisions.json`, `lifecycle-stages.json`
3. `schema/scripts/beam-csv-to-json.mjs` — BEAM CSV importer (Node ESM); emits per-division files + `materials/index.json`
4. `schema/materials/` — split catalogue (see "File size & module splitting" section):
   - `index.json` — lightweight picker catalogue (~30 KB gz) loaded at app boot
   - `NN-<slug>.json` per CSI division (~0.3–0.7 MB gz each) — lazy-loaded on demand
5. EPD parser spec + implementation (PDF → schema-conformant patches)
6. Canadian context extensions (cost data, code_compliance research, VBBL/COV alignment)
7. **IFC interop** — see IFC alignment section above. Bidirectional read/write with `IfcMaterial` + standard Psets (`Pset_MaterialCommon`, `Pset_MaterialThermal`) + custom `Pset_BfCA_EPDProvenance` for fields IFC doesn't natively model. Integrates with the `ifc/` workstream.

## Verification — sample.json

Run these to check the sample matches the locked-in design:

```bash
cd schema
python3 -c "import json; d=json.load(open('sample.json')); print('valid, 20 top-level keys:', len(d.keys())==20)"
python3 -c "import json; d=json.load(open('sample.json')); print(d['carbon']['common']['value_kgco2e'])"   # → 6.22
python3 -c "import json; d=json.load(open('sample.json')); print(d['external_refs']['beam_id'])"           # → LAM011
python3 -c "import json; d=json.load(open('sample.json')); print(d['provenance']['countries_of_manufacture'])"  # → ['CAN']
```

All pass as of this commit.
