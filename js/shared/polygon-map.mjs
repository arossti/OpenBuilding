// polygon-map.mjs
// Shared bridge logic between PDF-Parser polygons and BEAMweb PROJECT
// dimensions. Pure data + pure functions — no DOM, no I/O — so both
// sides can consume without tangling dependencies.
//
// Consumers:
//   - BEAMweb's pdf-bridge-import.mjs uses `computeAllDimensions` to run
//     the full aggregation when the user clicks "Import from PDF-Parser".
//   - Future inline fidelity badges (spec §5.2) call `aggregateOne` for a
//     single dim so the badge can describe what fed it.
//
// Design ref: docs/workplans/PDF-BEAMweb-BRIDGE.md §3.2 (taxonomy),
// §4 (dimension mapping), §6.3 (Phase 4b.2 scope).

// ── Dimension mapping table ──────────────────────────────
// targetDim + targetDimExtras: one source can feed multiple dims
//   (slab_foundation → below-grade + total floor area).
// aggregate: which reduction over the matching polygons.
// requiredSheetClass: filter — polygons whose sheet_class is outside
//   this list are flagged in warnings but still counted for now
//   (validation is non-blocking per spec §3.4).
// multiplyByParam: scale by a param_* value from StateManager.
// multiplyByPitchFactor: scale by 1/cos(param_roof_pitch_deg).
// fallback: secondary path when the primary produces zero polygons.
// Cross-feeds let one polygon drive multiple dims via different geometric
// interpretations (area + perimeter). A slab polygon's area feeds the slab
// dim; the same polygon's perimeter feeds foundation walls and continuous
// footings without the user tracing the outline twice. Each cross-feed
// declares `supersededBy` — component tags that, when present anywhere in
// the project, preempt the implicit path so explicit traces (e.g. a user
// deliberately tagging `exterior_perimeter` or drawing elevation walls)
// remain the authoritative source.
export const COMPONENT_TO_DIMENSION = {
  slab_foundation: {
    type: "area",
    targetDim: "dim_foundation_slab_floor_area",
    targetDimExtras: ["project_below_grade_area", "project_total_floor_area"],
    garageTargetDim: "garage_slab_area",
    aggregate: "sumArea",
    requiredSheetClass: ["plan"],
    crossFeeds: [
      {
        dim: "dim_foundation_wall_area",
        garageDim: "garage_foundation_wall_area",
        aggregate: "sumPerimeter",
        multiplyByParam: "param_basement_height_m",
        supersededBy: ["exterior_perimeter"],
        summaryVerb: "basement-slab perimeter"
      },
      {
        dim: "dim_continuous_footings",
        garageDim: "garage_continuous_footings",
        aggregate: "sumPerimeter",
        multiplyByParams: ["param_footing_height_m", "param_footing_width_m"],
        supersededBy: ["exterior_perimeter"],
        summaryVerb: "basement-slab perimeter"
      }
    ]
  },
  slab_above_grade: {
    type: "area",
    targetDim: "dim_framed_floor_area",
    targetDimExtras: ["dim_finished_ceiling_area", "project_above_grade_area", "project_total_floor_area"],
    garageTargetDim: "garage_slab_area",
    garageTargetDimExtras: ["garage_floor_area_above", "garage_finished_ceiling_area"],
    aggregate: "sumArea",
    requiredSheetClass: ["plan"],
    crossFeeds: [
      {
        dim: "dim_exterior_wall_area",
        garageDim: "garage_exterior_wall_area",
        aggregate: "sumPerimeter",
        multiplyByParam: "param_wall_height_m",
        supersededBy: ["wall_exterior", "exterior_perimeter"],
        summaryVerb: "above-grade slab perimeter"
      }
    ]
  },
  wall_exterior: {
    type: "area",
    targetDim: "dim_exterior_wall_area",
    garageTargetDim: "garage_exterior_wall_area",
    aggregate: "sumNetArea",
    requiredSheetClass: ["elevation"],
    fallback: {
      fromComponent: "exterior_perimeter",
      aggregate: "sumPerimeter",
      multiplyByParam: "param_wall_height_m"
    }
  },
  wall_party: {
    type: "area",
    targetDim: "dim_party_wall_area",
    aggregate: "sumNetArea",
    requiredSheetClass: ["elevation"]
  },
  exterior_perimeter: {
    type: "area",
    targetDim: "dim_foundation_wall_area",
    targetDimExtras: ["dim_continuous_footings"],
    garageTargetDim: "garage_foundation_wall_area",
    garageTargetDimExtras: ["garage_continuous_footings"],
    aggregate: "sumPerimeter",
    requiredSheetClass: ["plan"],
    multiplyByParam: "param_basement_height_m",
    // dim_continuous_footings uses a different formula — volumeFromPerimeter.
    // Handled by a dim-level override below in computeAllDimensions.
    extraParams: ["param_footing_height_m", "param_footing_width_m"]
  },
  roof_plan: {
    type: "area",
    targetDim: "dim_roof_surface_area",
    targetDimExtras: ["dim_roof_cavity_insulation_area"],
    garageTargetDim: "garage_roof_surface_area",
    aggregate: "sumArea",
    requiredSheetClass: ["plan"],
    multiplyByPitchFactor: "param_roof_pitch_deg"
  },
  roof_cavity: {
    type: "area",
    targetDim: "dim_roof_cavity_insulation_area",
    aggregate: "sumArea",
    requiredSheetClass: ["plan"]
  },
  pad_pier: {
    type: "area",
    targetDim: "dim_columns_piers_pads_volume",
    garageTargetDim: "garage_columns_piers_pads_volume",
    aggregate: "sumAreaTimesDepth",
    requiredSheetClass: ["plan"],
    wave: "v2"
  },
  window_opening: {
    type: "window",
    targetDim: "dim_window_area",
    garageTargetDim: "garage_window_area",
    aggregate: "sumArea",
    requiredSheetClass: ["elevation"]
  },
  wall_interior: {
    type: "polyline",
    targetDim: "dim_interior_wall_area",
    garageTargetDim: "garage_partition_wall_area",
    aggregate: "sumLength",
    requiredSheetClass: ["plan"],
    multiplyByParam: "param_wall_height_m"
  },
  footing_interior: {
    type: "polyline",
    targetDim: "dim_continuous_footings",
    aggregate: "sumLength",
    requiredSheetClass: ["plan"],
    multiplyByParam: "param_footing_height_m",
    extraParams: ["param_footing_width_m"]
  }
};

// Inverse lookup — given a dim field, which component tags feed it?
export function componentsForDim(dimId) {
  const hits = [];
  for (const [tag, spec] of Object.entries(COMPONENT_TO_DIMENSION)) {
    const targets = [spec.targetDim, ...(spec.targetDimExtras || [])];
    if (targets.includes(dimId)) hits.push(tag);
  }
  return hits;
}

// ── Aggregation primitives ──────────────────────────────
function sumArea(polys) {
  return polys.reduce((acc, p) => acc + (p.measurement.areaM2 || 0), 0);
}

function sumNetArea(polys) {
  // Children (windows) nested inside each wall polygon net out via mode:net.
  return polys.reduce((acc, p) => {
    let net = p.measurement.areaM2 || 0;
    const kids = p.children || [];
    for (const c of kids) {
      if (c.measurement.areaM2 == null) continue;
      if (c.measurement.mode === "add") net += c.measurement.areaM2;
      else net -= c.measurement.areaM2;
    }
    return acc + net;
  }, 0);
}

function sumLength(polys) {
  return polys.reduce((acc, p) => acc + (p.measurement.lengthM || 0), 0);
}

function sumPerimeter(polys) {
  return polys.reduce((acc, p) => acc + (p.measurement.perimeterM || 0), 0);
}

function sumAreaTimesDepth(polys) {
  return polys.reduce((acc, p) => acc + (p.measurement.areaM2 || 0) * (p.depth_m || 0), 0);
}

const AGGREGATORS = {
  sumArea,
  sumNetArea,
  sumLength,
  sumPerimeter,
  sumAreaTimesDepth
};

function parseParam(params, key, fallback = null) {
  if (!params || params[key] == null || params[key] === "") return fallback;
  const n = parseFloat(params[key]);
  return isNaN(n) ? fallback : n;
}

function pitchFactor(pitchDeg) {
  // 1/cos(θ) lifts a plan area to a surface area. 0° = flat roof = 1.0.
  const rad = (pitchDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  if (cos <= 0.01) return null; // absurd pitch
  return 1 / cos;
}

// ── Polygon flattening ──────────────────────────────────
// Accepts a PDF-Parser project JSON (the shape ProjectStore.toJSON() emits)
// and returns a flat list of { measurement, page, depth_m, component,
// sheet_class, children[] }. Children are the window polygons nested inside
// a wall polygon — attached here so sumNetArea has what it needs.
export function flattenProjectPolygons(projectJson) {
  const flat = [];
  if (!projectJson || !projectJson.pages) return flat;

  for (const page of projectJson.pages) {
    const polys = page.polygons || [];
    // First pass — build records keyed by id.
    const byId = new Map();
    for (const p of polys) {
      const measurement = computeMeasurement(p, page);
      const record = {
        id: p.id,
        label: p.label,
        type: p.type || "area",
        component: p.component || null,
        sheet_id: p.sheet_id || page.sheetId || null,
        sheet_class: p.sheet_class || page.classification || null,
        sheet_title: page.sheetTitle || null,
        pageNum: page.pageNum,
        assembly_preset: p.assembly_preset || null,
        depth_m: p.depth_m || null,
        scope: p.scope === "garage" ? "garage" : "building",
        mode: p.mode || "net",
        measurement,
        children: []
      };
      byId.set(p.id, record);
      flat.push(record);
    }

    // Second pass — attach windows to containing wall polygons.
    const walls = polys.filter((p) => (p.type || "area") === "area" && p.closed);
    const windows = polys.filter((p) => p.type === "window" && p.closed);
    for (const win of windows) {
      const owner = findEnclosingWall(win, walls);
      if (owner) {
        const ownerRecord = byId.get(owner.id);
        const winRecord = byId.get(win.id);
        if (ownerRecord && winRecord) ownerRecord.children.push(winRecord);
      }
    }
  }

  return flat;
}

function computeMeasurement(poly, page) {
  // Replicates polygon-tool.mjs's getMeasurement but from serialized data.
  // Scale lives on the page: page.calibration.pdfUnitsPerMetre. Without
  // calibration the measurement is uncalibrated (null values).
  const calibrated = !!(page.calibration && page.calibration.pdfUnitsPerMetre);
  const upm = calibrated ? page.calibration.pdfUnitsPerMetre : null;
  const type = poly.type || "area";
  const m = { type, mode: poly.mode || "net", calibrated };

  if (type === "polyline") {
    const lenPdf = polylineLength(poly.vertices);
    m.lengthM = upm ? lenPdf / upm : null;
    return m;
  }

  const areaPdf = polygonArea(poly.vertices);
  const perimPdf = polygonPerimeter(poly.vertices);
  m.areaM2 = upm ? areaPdf / (upm * upm) : null;
  m.perimeterM = upm ? perimPdf / upm : null;
  return m;
}

function polygonArea(vertices) {
  if (!vertices || vertices.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    a += vertices[i].x * vertices[j].y;
    a -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(a) / 2;
}

function polygonPerimeter(vertices) {
  if (!vertices || vertices.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < vertices.length - 1; i++) {
    p += dist(vertices[i], vertices[i + 1]);
  }
  // Closed polygons wrap back to the first vertex.
  p += dist(vertices[vertices.length - 1], vertices[0]);
  return p;
}

function polylineLength(vertices) {
  if (!vertices || vertices.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < vertices.length - 1; i++) {
    p += dist(vertices[i], vertices[i + 1]);
  }
  return p;
}

function dist(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function findEnclosingWall(win, walls) {
  // Smallest wall whose bbox contains the window's centroid.
  let best = null;
  let bestArea = Infinity;
  const c = centroid(win.vertices);
  for (const w of walls) {
    if (!pointInPolygon(c, w.vertices)) continue;
    const a = polygonArea(w.vertices);
    if (a < bestArea) {
      bestArea = a;
      best = w;
    }
  }
  return best;
}

function centroid(vertices) {
  let cx = 0;
  let cy = 0;
  for (const v of vertices) {
    cx += v.x;
    cy += v.y;
  }
  return { x: cx / vertices.length, y: cy / vertices.length };
}

function pointInPolygon(pt, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    if (yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ── The aggregator itself ───────────────────────────────
// Runs one component → dim aggregation. Returns:
//   { value, summary, polygons: [{id, label, sheet_id, contribution}],
//     sheets: [unique sheet ids], warnings: [string], usedFallback: bool }
// Value is null when the path can't resolve (missing param, no polygons
// and no fallback).
export function aggregateOne({ flatPolygons, params, component, scope }) {
  const spec = COMPONENT_TO_DIMENSION[component];
  if (!spec) return { value: null, summary: "unknown component", warnings: [`unknown component: ${component}`] };

  // Scope filter: when scope is explicitly provided, only polygons matching
  // that scope (defaulting to "building" on legacy records) contribute. When
  // scope is omitted we keep the pre-M5 behaviour of aggregating every match
  // regardless of scope — used by callers that just want a raw total.
  const scopeMatches = (p) => {
    if (!scope) return true;
    const polyScope = p.scope === "garage" ? "garage" : "building";
    return polyScope === scope;
  };

  const matches = flatPolygons.filter((p) => p.component === component && scopeMatches(p));
  const warnings = [];
  let usedFallback = false;
  let polygons = matches;

  if (matches.length === 0 && spec.fallback) {
    const fbComp = spec.fallback.fromComponent;
    const fbMatches = flatPolygons.filter((p) => p.component === fbComp && scopeMatches(p));
    if (fbMatches.length > 0) {
      usedFallback = true;
      polygons = fbMatches;
    }
  }

  if (polygons.length === 0) {
    return { value: null, summary: "no polygons tagged " + component, polygons: [], sheets: [], warnings };
  }

  const aggregate = usedFallback ? spec.fallback.aggregate : spec.aggregate;
  const reducer = AGGREGATORS[aggregate];
  if (!reducer) {
    warnings.push(`unknown aggregator: ${aggregate}`);
    return { value: null, summary: "invalid aggregator", polygons, sheets: [], warnings };
  }

  let raw = reducer(polygons);

  // Sheet-class validation — non-blocking.
  const required = spec.requiredSheetClass || [];
  for (const poly of polygons) {
    if (required.length && poly.sheet_class && !required.includes(poly.sheet_class)) {
      warnings.push(`${component} on ${poly.sheet_class} sheet ${poly.sheet_id || ""} — expected ${required.join("/")}`);
    }
  }

  const multParam = usedFallback ? spec.fallback.multiplyByParam : spec.multiplyByParam;
  let paramUsed = null;
  if (multParam) {
    const v = parseParam(params, multParam);
    if (v == null) {
      return {
        value: null,
        summary: `needs ${multParam}`,
        polygons,
        sheets: uniqueSheets(polygons),
        warnings: warnings.concat([`required param missing: ${multParam}`])
      };
    }
    raw *= v;
    paramUsed = { name: multParam, value: v };
  }

  if (spec.multiplyByPitchFactor) {
    const pitch = parseParam(params, spec.multiplyByPitchFactor);
    if (pitch == null) {
      return {
        value: null,
        summary: `needs ${spec.multiplyByPitchFactor}`,
        polygons,
        sheets: uniqueSheets(polygons),
        warnings: warnings.concat([`required param missing: ${spec.multiplyByPitchFactor}`])
      };
    }
    const pf = pitchFactor(pitch);
    if (pf == null) {
      return {
        value: null,
        summary: `invalid pitch ${pitch}°`,
        polygons,
        sheets: uniqueSheets(polygons),
        warnings
      };
    }
    raw *= pf;
    paramUsed = { name: spec.multiplyByPitchFactor, value: pitch, pitchFactor: pf };
  }

  const summary = describeSummary(component, polygons, aggregate, paramUsed, usedFallback);
  return {
    value: raw,
    summary,
    polygons: polygons.map((p) => ({
      id: p.id,
      label: p.label,
      sheet_id: p.sheet_id,
      sheet_title: p.sheet_title,
      pageNum: p.pageNum,
      assembly_preset: p.assembly_preset
    })),
    sheets: uniqueSheets(polygons),
    warnings,
    usedFallback,
    component: usedFallback ? spec.fallback.fromComponent : component
  };
}

function uniqueSheets(polygons) {
  return Array.from(new Set(polygons.map((p) => p.sheet_id).filter(Boolean)));
}

function describeSummary(component, polygons, aggregate, paramUsed, usedFallback) {
  const n = polygons.length;
  const noun = n === 1 ? "polygon" : "polygons";
  let base = `${n} ${component.replace(/_/g, " ")} ${noun}`;
  if (paramUsed) base += ` \u00d7 ${paramUsed.name.replace("param_", "")} (${paramUsed.value})`;
  if (usedFallback) base += ` \u2014 fallback path`;
  return base;
}

// ── Full project aggregation ─────────────────────────────
// Returns a map { dimId → { value, summary, contributors[], component, warnings[] } }
// for every dim the bridge can fill. Multi-source dims (e.g. project_total_floor_area
// gets contributions from both slab_foundation AND slab_above_grade) are summed.
// Dims dependent on param values that the user hasn't entered yet come back
// with value=null and a summary explaining what's missing.
export function computeAllDimensions({ projectJson, params }) {
  const flat = flattenProjectPolygons(projectJson);
  const result = {};

  // Two-scope pass: polygons carry scope="building" (default) or "garage"
  // (Q23 option B — reuse the component taxonomy, partition at aggregation
  // time). Building-scoped polygons route to targetDim + targetDimExtras;
  // garage-scoped polygons route to garageTargetDim + garageTargetDimExtras
  // where the spec declares them. Specs without garage fields simply emit
  // no contribution on the garage pass, so legacy consumers stay quiet.
  for (const scope of ["building", "garage"]) {
    const perComponent = {};
    for (const component of Object.keys(COMPONENT_TO_DIMENSION)) {
      const matches = flat.filter((p) => p.component === component && scopeMatches(p, scope));
      if (matches.length === 0 && !COMPONENT_TO_DIMENSION[component].fallback) continue;
      const agg = aggregateOne({ flatPolygons: flat, params, component, scope });
      if (agg.polygons && agg.polygons.length > 0) perComponent[component] = agg;
    }

    for (const [component, agg] of Object.entries(perComponent)) {
      const spec = COMPONENT_TO_DIMENSION[component];
      const dims = targetDimsForScope(spec, scope);
      for (const dimId of dims) {
        if (!result[dimId]) result[dimId] = { value: null, contributors: [], warnings: [] };
        const contribution = computeContribution(dimId, spec, agg, params, component);
        if (contribution.value != null) {
          if (result[dimId].value == null) result[dimId].value = 0;
          result[dimId].value += contribution.value;
          result[dimId].contributors.push({
            component,
            scope,
            value: contribution.value,
            summary: contribution.summary || agg.summary,
            polygons: agg.polygons,
            sheets: agg.sheets,
            assembly_presets: uniquePresets(agg.polygons)
          });
        }
        if (agg.warnings && agg.warnings.length) result[dimId].warnings.push(...agg.warnings);
        if (contribution.warnings && contribution.warnings.length) result[dimId].warnings.push(...contribution.warnings);
      }
    }
  }

  // Cross-feeds are scope-aware too — each feed carries an optional `garageDim`
  // that gets targeted when the feeder polygon is garage-scoped. supersededBy
  // continues to gate the feed on presence of explicit tags (regardless of
  // scope, for now — garage users who trace an explicit exterior_perimeter get
  // the same suppression behaviour as building users).
  const presentComponents = new Set(flat.map((p) => p.component).filter(Boolean));
  runCrossFeeds({ flat, params, result, presentComponents });

  // Fold unfilled dims into the result with null value so the preview UI can
  // render "no polygons feeding this dim yet". Covers both building and
  // garage target dims declared across every spec.
  for (const spec of Object.values(COMPONENT_TO_DIMENSION)) {
    const dims = [
      spec.targetDim,
      ...(spec.targetDimExtras || []),
      spec.garageTargetDim,
      ...(spec.garageTargetDimExtras || [])
    ].filter(Boolean);
    for (const dimId of dims) {
      if (!(dimId in result)) result[dimId] = { value: null, contributors: [], warnings: [] };
    }
    if (spec.crossFeeds) {
      for (const feed of spec.crossFeeds) {
        if (feed.dim && !(feed.dim in result)) result[feed.dim] = { value: null, contributors: [], warnings: [] };
        if (feed.garageDim && !(feed.garageDim in result)) {
          result[feed.garageDim] = { value: null, contributors: [], warnings: [] };
        }
      }
    }
  }

  return result;
}

function scopeMatches(polygon, scope) {
  const polyScope = polygon.scope === "garage" ? "garage" : "building";
  return polyScope === scope;
}

function targetDimsForScope(spec, scope) {
  if (scope === "garage") {
    if (!spec.garageTargetDim) return [];
    return [spec.garageTargetDim, ...(spec.garageTargetDimExtras || [])];
  }
  return [spec.targetDim, ...(spec.targetDimExtras || [])];
}

function runCrossFeeds({ flat, params, result, presentComponents }) {
  for (const [component, spec] of Object.entries(COMPONENT_TO_DIMENSION)) {
    if (!spec.crossFeeds || spec.crossFeeds.length === 0) continue;

    // Partition feeder polygons by scope so building-scoped slab perimeter
    // flows into dim_foundation_wall_area while garage-scoped slab perimeter
    // routes to garage_foundation_wall_area — and supersededBy still gates
    // each pass independently.
    for (const scope of ["building", "garage"]) {
      const matches = flat.filter((p) => p.component === component && scopeMatches(p, scope));
      if (matches.length === 0) continue;

      for (const feed of spec.crossFeeds) {
        const targetDim = scope === "garage" ? feed.garageDim : feed.dim;
        if (!targetDim) continue;

        const supersededBy = Array.isArray(feed.supersededBy)
          ? feed.supersededBy
          : feed.supersededBy
            ? [feed.supersededBy]
            : [];
        const superseded = supersededBy.some((c) => presentComponents.has(c));
        if (superseded) continue;

        const reducer = AGGREGATORS[feed.aggregate];
        if (!reducer) continue;
        let raw = reducer(matches);

        // Apply params — any missing param downgrades the feed to a warning.
        const missingParams = [];
        const paramsUsed = [];
        if (feed.multiplyByParam) {
          const v = parseParam(params, feed.multiplyByParam);
          if (v == null) missingParams.push(feed.multiplyByParam);
          else {
            raw *= v;
            paramsUsed.push({ name: feed.multiplyByParam, value: v });
          }
        }
        if (feed.multiplyByParams) {
          for (const key of feed.multiplyByParams) {
            const v = parseParam(params, key);
            if (v == null) missingParams.push(key);
            else {
              raw *= v;
              paramsUsed.push({ name: key, value: v });
            }
          }
        }

        if (!result[targetDim]) result[targetDim] = { value: null, contributors: [], warnings: [] };
        if (missingParams.length > 0) {
          for (const p of missingParams) result[targetDim].warnings.push(`required param missing: ${p}`);
          continue;
        }

        if (result[targetDim].value == null) result[targetDim].value = 0;
        result[targetDim].value += raw;
        result[targetDim].contributors.push({
          component,
          scope,
          value: raw,
          summary: buildCrossFeedSummary(component, matches.length, feed, paramsUsed),
          polygons: matches.map((p) => ({
            id: p.id,
            label: p.label,
            sheet_id: p.sheet_id,
            sheet_title: p.sheet_title,
            pageNum: p.pageNum,
            assembly_preset: p.assembly_preset
          })),
          sheets: Array.from(new Set(matches.map((p) => p.sheet_id).filter(Boolean))),
          assembly_presets: Array.from(new Set(matches.map((p) => p.assembly_preset).filter(Boolean))),
          isCrossFeed: true
        });
      }
    }
  }
}

function buildCrossFeedSummary(component, n, feed, paramsUsed) {
  const noun = n === 1 ? "polygon" : "polygons";
  const verb = feed.summaryVerb || feed.aggregate;
  const paramStr = paramsUsed.map((p) => `${p.name.replace("param_", "")} (${p.value})`).join(" \u00d7 ");
  let s = `${n} ${component.replace(/_/g, " ")} ${noun} \u2014 ${verb}`;
  if (paramStr) s += ` \u00d7 ${paramStr}`;
  return s;
}

function computeContribution(dimId, spec, agg, params, component) {
  // Most dims take the aggregate value straight through. Overrides handle
  // cases where one component feeds two dims with different formulas.
  // Specifically: exterior_perimeter → dim_foundation_wall_area (perim × H)
  //                                    → dim_continuous_footings (perim × H × W).

  // Base case — the component's primary target dim uses agg.value directly
  // once the aggregator's own multiplyByParam has been applied. Matches both
  // the building target (targetDim) and the garage mirror (garageTargetDim)
  // so scope-routed primary-path values pass straight through.
  if (dimId === spec.targetDim || dimId === spec.garageTargetDim) {
    return { value: agg.value, summary: agg.summary };
  }

  // Extra dim — may need a different formula. The exterior_perimeter
  // continuous-footings override mirrors for garage: same back-out math,
  // different target dim.
  if (
    component === "exterior_perimeter" &&
    (dimId === "dim_continuous_footings" || dimId === "garage_continuous_footings")
  ) {
    // agg.value here is perim × param_basement_height_m from the spec.
    // We want perim × footing_height × footing_width. Back out the mult.
    const basementH = parseParam(params, "param_basement_height_m");
    const footingH = parseParam(params, "param_footing_height_m");
    const footingW = parseParam(params, "param_footing_width_m");
    if (!basementH || !footingH || !footingW) {
      return {
        value: null,
        summary: "needs param_footing_height_m + param_footing_width_m",
        warnings: ["continuous footings need footing dims"]
      };
    }
    const rawPerim = agg.value / basementH;
    return {
      value: rawPerim * footingH * footingW,
      summary: `perimeter × ${footingH}m × ${footingW}m`
    };
  }

  if (component === "footing_interior" && dimId === "dim_continuous_footings") {
    // agg.value here is length × footing_height. Multiply by footing_width.
    const footingW = parseParam(params, "param_footing_width_m");
    if (!footingW) return { value: null, summary: "needs param_footing_width_m" };
    return { value: agg.value * footingW, summary: `length × height × ${footingW}m (width)` };
  }

  if (component === "roof_plan" && dimId === "dim_roof_cavity_insulation_area") {
    // Cavity insulation = plan area (no pitch factor). Back out the pitch.
    const pitch = parseParam(params, "param_roof_pitch_deg");
    const pf = pitch != null ? pitchFactor(pitch) : null;
    if (!pf) return { value: null };
    return { value: agg.value / pf, summary: "roof plan area (no pitch lift)" };
  }

  // Default — pass the value through. Used by project_total_floor_area etc.
  return { value: agg.value, summary: agg.summary };
}

function uniquePresets(polygons) {
  const s = new Set();
  for (const p of polygons) if (p.assembly_preset) s.add(p.assembly_preset);
  return Array.from(s);
}
