// project-tab.mjs
// PROJECT tab: project metadata + building/garage dimension inputs.
// Mirrors the BEAM workbook PROJECT sheet (see docs/csv files from BEAM/PROJECT.csv).
//
// Three sections:
//   1. Project Information — text/number/dropdown fields
//   2. Building Dimension Inputs — areas and volumes for the main building
//   3. Garage Dimension Inputs — same pattern, scoped to garage
//
// Dropdowns (Country, Province, Building Type, etc.) render as text inputs
// in this first cut; Categories.csv parsing and real <select> wiring lands
// in a follow-up.

import { StateManager } from "../shared/state-manager.mjs";

const VS = StateManager.VALUE_STATES;

const INFO_LEFT = [
  { id: "project_name",             label: "Project Name",                   type: "text", required: true },
  { id: "project_scenario",         label: "Scenario",                       type: "text" },
  { id: "project_beam_version",     label: "BEAM Version",                   type: "text", readonly: true },
  { id: "project_designer",         label: "Designer",                       type: "text" },
  { id: "project_engineer",         label: "Engineer",                       type: "text" },
  { id: "project_builder",          label: "Builder / Developer",            type: "text" },
  { id: "project_development",      label: "Development Project",            type: "text" },
  { id: "project_address",          label: "Address",                        type: "text" },
  { id: "project_city",             label: "City",                           type: "text" },
  { id: "project_country",          label: "Country",                        type: "text" },
  { id: "project_province_state",   label: "Province / State (Can./US only)", type: "text" },
  { id: "project_building_type",    label: "Building Type",                  type: "text" },
  { id: "project_construction_type",label: "Construction Type",              type: "text" },
  { id: "project_dev_stage",        label: "Project Development Stage",      type: "text" },
];

const INFO_RIGHT = [
  { id: "project_construction_year", label: "Construction Year",             type: "number", step: 1 },
  { id: "project_num_bedrooms",      label: "Number of Bedrooms",            type: "number", step: 1 },
  { id: "project_stories_above",     label: "Stories Above Grade",           type: "number", step: 1 },
  { id: "project_total_floor_area",  label: "Total Floor Area",              type: "number", unit: "m²", step: 0.1 },
  { id: "project_above_grade_area",  label: "Above Grade Conditioned Area",  type: "number", unit: "m²", step: 0.1 },
  { id: "project_below_grade_area",  label: "Below Grade Conditioned Area",  type: "number", unit: "m²", step: 0.1 },
];

// Dimension inputs — main building. Order follows PROJECT.csv rows 42-66.
// Entries with `lhw: true` render as three inputs (Length × Height × Width) → computed volume.
const DIMS_BUILDING = [
  { id: "dim_continuous_footings",          label: "CONTINUOUS FOOTINGS VOLUME",   unit: "m³", lhw: true,
    description: "Length × Height × Width of continuous strip footings. Excludes: garage.",
    takeoff: "Continuous (strip) foundation wall footings (exterior and interior)" },
  { id: "dim_columns_piers_pads_volume",    label: "COLUMNS/PIERS & PADS VOLUME",  unit: "m³",
    description: "Total volume of discontinuous foundation elements. Includes: pads/footings, columns/piers/piles. Excludes: garage.",
    takeoff: "Concrete volume for all discontinuous pads/footings and columns/piers (ext. and int.)" },
  { id: "dim_foundation_wall_area",         label: "FOUNDATION WALL AREA",          unit: "m²",
    description: "Total foundation wall surface area (centerline length × height). Includes: basement, party walls. Excludes: openings, garage foundation.",
    takeoff: "Foundation & basement wall insulation (ext. and int.), interior framing, wall cladding and barriers" },
  { id: "dim_foundation_slab_floor_area",   label: "FOUNDATION SLAB/FLOOR AREA",    unit: "m²",
    description: "Total foundation slab surface area. Excludes: garage slab.",
    takeoff: "Aggregate base, sub-slab insulation, slab, barriers and basement flooring" },
  { id: "dim_exterior_wall_area",           label: "EXTERIOR WALL AREA",            unit: "m²",
    description: "Surface area of exterior walls. Includes: gable ends. Excludes: window & door openings, party walls, garage walls.",
    takeoff: "Framing, insulation, sheathing, barriers, exterior cladding, and interior cladding of exterior walls" },
  { id: "dim_window_area",                  label: "WINDOW AREA",                   unit: "m²",
    description: "Area of window frames (preferred) or rough openings. Includes: full glazing area, skylights. Excludes: garage windows.",
    takeoff: "Windows of main building" },
  { id: "dim_party_wall_area",              label: "PARTY WALL AREA",               unit: "m²",
    description: "Wall area that partitions this unit from others. Typical for townhouses & apartment units.",
    takeoff: "Party wall framing, insulation, sheathing, barriers and interior cladding" },
  { id: "dim_interior_wall_area",           label: "INTERIOR WALL AREA",            unit: "m²",
    description: "One side only (centerline) of all interior walls. Includes: interior door area. Excludes: exterior, garage partition and party walls.",
    takeoff: "Interior wall framing and cladding (assumes both sides are finished by default)" },
  { id: "dim_framed_floor_area",            label: "FRAMED FLOOR AREA",             unit: "m²",
    description: "Above grade flooring area. Excludes: basement floor slab and floor openings.",
    takeoff: "Floor framing, subfloor, floor insulation, finish flooring" },
  { id: "dim_finished_ceiling_area",        label: "FINISHED CEILING AREA",         unit: "m²",
    description: "Total finished ceiling area. Includes: basement ceilings. Excludes: garage ceilings.",
    takeoff: "Ceiling cladding" },
  { id: "dim_roof_cavity_insulation_area",  label: "ROOF CAVITY INSULATION AREA",   unit: "m²",
    description: "Total area of roof insulation.",
    takeoff: "Flat or sloped roof cavity insulation, ceiling barriers and membranes" },
  { id: "dim_roof_surface_area",            label: "ROOF SURFACE AREA",             unit: "m²",
    description: "Total roof surface area. Includes: overhangs.",
    takeoff: "Roof framing, decking, barriers & membranes, roofing, and insulation parallel to roof surface" },
  { id: "dim_timber_framing_volume",        label: "TIMBER FRAMING VOLUME",         unit: "m³",
    description: "Total volume of wood in heavy timber posts & beams. Steel is entered in Structural Elements.",
    takeoff: "Mass timber framing elements" },
];

const DIMS_GARAGE = [
  { id: "garage_partition_wall_area",       label: "GARAGE PARTITION WALL AREA",    unit: "m²",
    description: "Wall area that partitions the main building from the garage. Excludes: openings and exterior garage walls.",
    takeoff: "Partition insulation and interior cladding on garage side" },
  { id: "garage_continuous_footings",       label: "GARAGE CONTINUOUS FOOTINGS VOLUME", unit: "m³", lhw: true,
    description: "Length × Height × Width of garage strip footings.",
    takeoff: "Continuous garage foundation wall footings" },
  { id: "garage_columns_piers_pads_volume", label: "GARAGE COLUMNS/PIERS & PADS VOLUME", unit: "m³",
    description: "Total volume of discontinuous foundation elements. Includes: pads/footings, columns/piers/piles.",
    takeoff: "Garage concrete volume for discontinuous pads/footings and columns/piers" },
  { id: "garage_foundation_wall_area",      label: "GARAGE FOUNDATION WALL AREA",   unit: "m²",
    description: "Foundation wall surface area.",
    takeoff: "Garage foundation walls" },
  { id: "garage_slab_area",                 label: "GARAGE SLAB AREA",              unit: "m²",
    description: "Slab surface area.",
    takeoff: "Garage slab, aggregate base" },
  { id: "garage_floor_area_above",          label: "FLOOR AREA ABOVE GARAGE",       unit: "m²",
    description: "Floor area of interior space directly above the garage.",
    takeoff: "Used to compute garage foundation attribution %" },
  { id: "garage_foundation_attribution_pct",label: "GARAGE FOUNDATION ATTRIBUTION %", unit: "%", readonly: true,
    description: "Portion of garage foundation attributed to the garage; the rest is attributed to the main building.",
    takeoff: "Garage footings and foundation walls" },
  { id: "garage_exterior_wall_area",        label: "GARAGE EXTERIOR WALL AREA",     unit: "m²",
    description: "Surface area of exterior garage walls. Includes: gable ends. Excludes: openings, partition walls.",
    takeoff: "Garage exterior wall framing, sheathing, exterior + interior cladding" },
  { id: "garage_window_area",               label: "GARAGE WINDOW AREA",            unit: "m²",
    description: "Area of garage window frames or rough openings.",
    takeoff: "Garage windows" },
  { id: "garage_finished_ceiling_area",     label: "GARAGE FINISHED CEILING AREA",  unit: "m²",
    description: "Garage ceiling area covered by materials.",
    takeoff: "Garage ceiling cladding, insulation parallel to ceiling" },
  { id: "garage_roof_surface_area",         label: "GARAGE ROOF SURFACE AREA",      unit: "m²",
    description: "Garage roof surface area (calculated with roof pitch). Includes: overhangs.",
    takeoff: "Garage roof framing, decking, roofing, insulation parallel to roof surface" },
  { id: "garage_timber_framing_volume",     label: "GARAGE TIMBER FRAMING VOLUME",  unit: "m³",
    description: "Volume of wood for heavy timber structures in garage.",
    takeoff: "Garage mass timber framing elements" },
];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function renderInput(f) {
  const attrs = [
    `type="${f.type || "text"}"`,
    `id="bw-${f.id}"`,
    `data-field-id="${f.id}"`,
    f.readonly ? "readonly" : "",
    f.required ? "required" : "",
    f.step !== undefined ? `step="${f.step}"` : "",
    f.unit === "m²" || f.unit === "m³" ? "inputmode=\"decimal\"" : "",
  ].filter(Boolean).join(" ");
  const unit = f.unit ? `<span class="bw-unit">${esc(f.unit)}</span>` : "";
  return `<div class="bw-input-wrap"><input class="bw-input" ${attrs} />${unit}</div>`;
}

function renderInfoRow(f) {
  return `
    <div class="bw-field bw-field-info">
      <label class="bw-label" for="bw-${f.id}">${esc(f.label)}${f.required ? ' <span class="bw-req">*</span>' : ""}</label>
      ${renderInput(f)}
    </div>
  `;
}

function renderDimRow(f) {
  if (f.lhw) {
    const [lId, hId, wId] = [`${f.id}_length`, `${f.id}_height`, `${f.id}_width`];
    return `
      <tr class="bw-dim-row bw-dim-row-lhw">
        <td class="bw-dim-name">${esc(f.label)}</td>
        <td class="bw-dim-qty">
          <output class="bw-dim-volume" data-field-id="${f.id}_volume" id="bw-${f.id}_volume">0.0</output>
          <span class="bw-unit">${esc(f.unit)}</span>
        </td>
        <td class="bw-dim-lhw" colspan="2">
          <div class="bw-lhw-group">
            <label>L (m) <input type="number" class="bw-input bw-lhw-input" step="0.01" data-field-id="${lId}" id="bw-${lId}" data-volume-parent="${f.id}" /></label>
            <span class="bw-lhw-x">×</span>
            <label>H (m) <input type="number" class="bw-input bw-lhw-input" step="0.01" data-field-id="${hId}" id="bw-${hId}" data-volume-parent="${f.id}" /></label>
            <span class="bw-lhw-x">×</span>
            <label>W (m) <input type="number" class="bw-input bw-lhw-input" step="0.01" data-field-id="${wId}" id="bw-${wId}" data-volume-parent="${f.id}" /></label>
          </div>
          <div class="bw-dim-desc">${esc(f.description)}</div>
          <div class="bw-dim-takeoff">Used for: ${esc(f.takeoff)}</div>
        </td>
      </tr>
    `;
  }
  return `
    <tr class="bw-dim-row">
      <td class="bw-dim-name">${esc(f.label)}</td>
      <td class="bw-dim-qty">
        <input type="number" step="0.1" class="bw-input bw-dim-input" data-field-id="${f.id}" id="bw-${f.id}" ${f.readonly ? "readonly" : ""} />
        <span class="bw-unit">${esc(f.unit)}</span>
      </td>
      <td class="bw-dim-desc-cell" colspan="2">
        <div class="bw-dim-desc">${esc(f.description)}</div>
        <div class="bw-dim-takeoff">Used for: ${esc(f.takeoff)}</div>
      </td>
    </tr>
  `;
}

function renderDimsTable(title, dims) {
  return `
    <h3 class="bw-section-title">${esc(title)}</h3>
    <table class="bw-dims-table">
      <thead>
        <tr>
          <th class="bw-dim-name-col">Dimension</th>
          <th class="bw-dim-qty-col">Quantity</th>
          <th class="bw-dim-desc-col" colspan="2">Description / Take-offs it feeds</th>
        </tr>
      </thead>
      <tbody>
        ${dims.map(renderDimRow).join("")}
      </tbody>
    </table>
  `;
}

export function renderProjectPanel() {
  return `
    <div class="bw-project-panel">
      <section class="bw-project-section bw-project-info">
        <h3 class="bw-section-title">Project Information</h3>
        <div class="bw-info-grid">
          <div class="bw-info-col">${INFO_LEFT.map(renderInfoRow).join("")}</div>
          <div class="bw-info-col">${INFO_RIGHT.map(renderInfoRow).join("")}</div>
        </div>
        <p class="bw-legend">
          <span class="bw-req">*</span> Required for saving projects ·
          Conditioned area fields are required for calculations ·
          Dropdown fields accept free text until Phase 2.1 wires Categories.csv option lists.
        </p>
      </section>

      <section class="bw-project-section bw-project-dims">
        ${renderDimsTable("Building Dimension Inputs (excluding garage)", DIMS_BUILDING)}
      </section>

      <section class="bw-project-section bw-project-garage">
        ${renderDimsTable("Garage Dimension Inputs", DIMS_GARAGE)}
      </section>
    </div>
  `;
}

function allFields() {
  return [...INFO_LEFT, ...INFO_RIGHT, ...DIMS_BUILDING, ...DIMS_GARAGE];
}

function lhwChildIds(parentId) {
  return [`${parentId}_length`, `${parentId}_height`, `${parentId}_width`];
}

function recomputeVolume(parentId) {
  const [lId, hId, wId] = lhwChildIds(parentId);
  const l = StateManager.parseNumeric(StateManager.getValue(lId), 0);
  const h = StateManager.parseNumeric(StateManager.getValue(hId), 0);
  const w = StateManager.parseNumeric(StateManager.getValue(wId), 0);
  const v = Math.round(l * h * w * 10) / 10;
  StateManager.setValue(`${parentId}_volume`, String(v), VS.CALCULATED);
  const out = document.getElementById(`bw-${parentId}_volume`);
  if (out) out.textContent = v.toFixed(1);
}

function populateInputFromState(fieldId) {
  const el = document.getElementById(`bw-${fieldId}`);
  if (!el) return;
  const v = StateManager.getValue(fieldId);
  if (v !== null && v !== undefined) {
    if (el.tagName === "OUTPUT") el.textContent = String(v);
    else el.value = String(v);
  }
}

function lhwParentIds() {
  return [...DIMS_BUILDING, ...DIMS_GARAGE].filter((f) => f.lhw).map((f) => f.id);
}

function refreshProjectInputsFromState() {
  for (const f of allFields()) populateInputFromState(f.id);
  for (const parent of lhwParentIds()) {
    for (const child of lhwChildIds(parent)) populateInputFromState(child);
    recomputeVolume(parent);
  }
}

export function refreshProjectForm() {
  refreshProjectInputsFromState();
}

export function resetProjectTab() {
  StateManager.clearByPrefix("project_");
  StateManager.clearByPrefix("dim_");
  StateManager.clearByPrefix("garage_");
  // Blank every input in the PROJECT panel, then recompute LHW volumes (all 0).
  const panel = document.getElementById("beam-panel-project");
  if (panel) {
    for (const input of panel.querySelectorAll("input.bw-input")) {
      input.value = "";
    }
    for (const out of panel.querySelectorAll("output.bw-dim-volume")) {
      out.textContent = "0.0";
    }
  }
}

export function wireProjectForm() {
  // Cold-start contract: no defaults seeded into state. The form renders blank
  // until the user types or presses Load Sample.
  refreshProjectInputsFromState();

  // Wire inputs — all `.bw-input` inside the PROJECT panel
  const panel = document.getElementById("beam-panel-project");
  if (!panel) return;
  panel.addEventListener("input", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const fieldId = target.dataset.fieldId;
    if (!fieldId) return;
    StateManager.setValue(fieldId, target.value, VS.USER_MODIFIED);
    const parent = target.dataset.volumeParent;
    if (parent) recomputeVolume(parent);
  });
}
