# PDF-Parser — Construction Document Area & Volume Extraction Tool

## Purpose

A vanilla JavaScript single-file HTML application that reads uploaded construction document PDFs, identifies architectural plans and sections, extracts area and volume information, and presents results for user confirmation — similar to how TurboScan identifies page edges and lets the user adjust control points.

**Phase 1 goal:** Reliable area extraction from floor plans with user-confirmed boundaries.
**Future goal:** Full BOM (bill of materials) capture from schedules, assemblies, and annotations.

---

## Reference Analysis: B-Frame Residence CD Set

The reference document (`2024.09.09 _ Issued for Permit (B-Frame 4.4 M&K).pdf`) is a 33-page Part 9 residential CD set by Thomson Architecture Inc. Key observations that inform the parser design:

| Feature | Detail | Implication |
|---|---|---|
| PDF type | Vector (CAD-exported), not scanned | Can extract line geometry + text directly — no OCR needed for this class of document |
| Scale notation | "Scale: 1:48" in title block of each plan sheet | Auto-detect via text search; confirm with user |
| Grid system | Lettered rows (A–G), numbered columns (1–2, CL) | Grid intersections = reference anchors for coordinate system |
| Dimension strings | Imperial (e.g., 39'-1", 8'-5 1/2") on plans | Parse for cross-check against computed areas |
| Room schedule | Tabulated on A2.44 — room names, areas in m², $/m² | Direct extraction target; validates computed areas |
| Sheet index | Cover sheet A0.01 lists all sheets by category | Parse to classify sheets (plans vs. sections vs. elevations vs. details) |
| Title block | Consistent position (bottom-right), contains sheet ID, title, scale, revision | Reliable anchor for sheet classification |
| Levels | Foundation (-1), Main (0), Upper (1), Roof | Section heights between levels give volume |
| Building sections | Sheets A5.01–A5.05 show vertical cuts with heights | Extract floor-to-floor heights for volume calculation |
| Construction assemblies | Sheet A0.07 — wall/floor/roof assembly sections with layer thicknesses | Future BOM: material layers per assembly type |
| Energy performance | Sheet A0.10 — thermal blocks with areas and volumes already computed | Cross-validation data (GFA = 263.25 m², volume = 1029.30 m³) |
| OBC Matrix | Sheet A0.09 — building area 225.18m², GCA tables | Another cross-validation source |

---

## Architecture

### Multi-file HTML app with local JS modules

- `index.html` — main shell (CSS + HTML + `<script>` tags)
- `js/` — 10 vanilla JS modules loaded via `<script>` tags (no ES modules, no build step)
- `lib/` — PDF.js 3.11.174 UMD build (local copy, no CDN dependency)
- `docs/` — workplan and documentation
- `PDF resources/` — reference PDFs (not tracked in git)
- Opens directly from `file://` protocol — no server required for development

### PDF.js Version Strategy

Currently using **PDF.js 3.11.174** (UMD/legacy build) for `file://` compatibility. The modern v4.x+ ESM build offers real advantages for large construction PDFs (38MB+):
- **OffscreenCanvas** — renders in a Web Worker, keeps UI thread smooth during page loads
- **Structured clone transfers** — faster worker ↔ main thread data passing
- **Active security patches** — 3.x is end-of-life
- **Better CMap/font handling** — matters for CAD-exported PDFs with custom fonts

**Plan:** Stay on 3.11 UMD for early builds. When a local dev server is introduced (even `python3 -m http.server 8000`), swap to v4.x with `<script type="module">` — a 15-minute change. No urgency.

### Core Libraries

| Library | Purpose | Source |
|---|---|---|
| **PDF.js 3.11** | Render PDF pages to canvas; extract text content + vector operators | `lib/pdf.min.js` (local UMD) |
| **Canvas 2D API** | Annotation overlay — user draws/adjusts area polygons | Native browser |
| **Shoelace formula** | Compute polygon area from vertices | ~10 lines of JS |

No Fabric.js, Konva.js, or other canvas abstraction needed for v1. Raw Canvas 2D is sufficient.

### JS Module Structure

All modules attach to the `PP` (PDF-Parser) global namespace. Load order matters.

| File | Module | Purpose |
|---|---|---|
| `js/config.js` | `PP.*` | Constants, scale patterns, colour palette, unit conversion |
| `js/pdf-loader.js` | `PP.Loader` | FileReader → PDF.js, page rendering, text/vector extraction |
| `js/sheet-classifier.js` | `PP.SheetClassifier` | Title block parsing, sheet type classification |
| `js/scale-manager.js` | `PP.ScaleManager` | Auto-detect scale + manual 2-point calibration |
| `js/canvas-viewer.js` | `PP.CanvasViewer` | Two-canvas (PDF + overlay), pan/zoom, coord transforms |
| `js/polygon-tool.js` | `PP.PolygonTool` | Click-to-trace polygons, shoelace area, vertex drag |
| `js/vector-snap.js` | `PP.VectorSnap` | PDF operator stream parsing, snap-to-line, outline detection |
| `js/schedule-parser.js` | `PP.ScheduleParser` | Text clustering into tables, room schedule extraction |
| `js/project-store.js` | `PP.ProjectStore` | Data model, save/load JSON, export CSV |
| `js/ui.js` | `PP.UI` | Sidebar, thumbnails, panels, keyboard shortcuts, status bar |
| `js/app.js` | `PP.App` | Main controller, wires modules, DOMContentLoaded boot |

---

## Feature Roadmap

### Phase 1 — Area Extraction (MVP)

The minimum viable tool: load a PDF, identify plans, extract/confirm areas.

#### 1.1 PDF Loading & Page Navigation
- File input (`<input type="file">`) — drag-and-drop support
- PDF.js renders each page to a `<canvas>` at configurable DPI (default 150 for performance, 300 for measurement)
- Page thumbnails in sidebar for navigation
- Pan (click-drag) and zoom (scroll wheel / pinch) on main canvas

#### 1.2 Sheet Classification
- Parse title block text from each page (PDF.js `page.getTextContent()`)
- Extract: sheet number (e.g., "A2.44"), sheet title (e.g., "CD Main Level"), scale (e.g., "1:48")
- Classify sheets by prefix convention:
  - `A0.*` = General info, notes, schedules
  - `A1.*` = Site plans
  - `A2.4*` = Construction document plans (the measurement targets)
  - `A2.4*` presentation vs CD distinguished by title
  - `A4.*` = Elevations
  - `A5.*` = Sections
  - `S*` = Structural
- Surface classification to user: "We found 4 floor plans, 5 sections, 3 elevations"
- User can override classification (e.g., mark a sheet as "plan" or "not a plan")

#### 1.3 Scale Confirmation Workflow

**Design principle:** Never silently apply a scale. The user must confirm before area values are trusted. Wrong scale = wrong area = useless data.

**Why not auto-apply scale from title block text?**
- PDF coordinate units vary by authoring tool (points, mm, cm, custom). There is no reliable way to know from metadata alone.
- A sheet may contain multiple drawings at different scales (e.g., a 1:48 floor plan + a 1:24 detail + a NTS key plan).
- A regex match on "1:48" doesn't tell us which drawing it belongs to, or whether the PDF unit system makes the math valid.
- The only reliable calibration is **empirical**: measure something known in PDF coordinates and compare to its stated real-world value.

**User flow — "Check Scale" button:**

1. User navigates to a page and clicks **Check Scale** (or presses `S`).
2. App scans the page for scale evidence:
   - **Scale text** — regex search for "Scale: 1:48", "1/4" = 1'-0"", etc. Returns all matches with their positions on the page.
   - **Scale bar** — look for horizontal lines near small numeric text (e.g., "0", "2", "4", "6m"). Measure line length in PDF units, parse the label → gives empirical pdfUnitsPerMetre.
   - **Dimension strings** — find dimension annotations (e.g., "39'-1"") and their associated leader lines → another empirical source.
3. App presents a **Scale Confirmation Panel** (modal or sidebar panel):

   ```
   ┌─────────────────────────────────────────────┐
   │  Scale — A2.44 CD Main Level                │
   │                                              │
   │  Detected: 1:48 (from title block)           │
   │                                              │
   │  ┌──────────────────────────────┐            │
   │  │ 1:48                       ▼ │  ← dropdown│
   │  └──────────────────────────────┘            │
   │                                              │
   │  ○ Metric    ● Imperial                      │
   │                                              │
   │  [ Accept ]                                  │
   │                                              │
   │  — or —                                      │
   │  [ Calibrate manually ] (two-point tool)     │
   └─────────────────────────────────────────────┘
   ```

4. **Dropdown contents — Metric scales:**

   | Label | Ratio |
   |---|---|
   | 1:10 | 10 |
   | 1:20 | 20 |
   | 1:25 | 25 |
   | 1:48 | 48 |
   | 1:50 | 50 |
   | 1:75 | 75 |
   | 1:100 | 100 |
   | 1:125 | 125 |
   | 1:150 | 150 |
   | 1:200 | 200 |

5. **Dropdown contents — Imperial scales (with metric equivalent):**

   | Label | Equivalent ratio |
   |---|---|
   | 1" = 1' (1:12) | 12 |
   | 3/4" = 1' (1:16) | 16 |
   | 1/2" = 1' (1:24) | 24 |
   | 3/8" = 1' (1:32) | 32 |
   | 1/4" = 1' (1:48) | 48 |
   | 3/16" = 1' (1:64) | 64 |
   | 1/8" = 1' (1:96) | 96 |
   | 1/16" = 1' (1:192) | 192 |

6. On **Accept**, the app performs an empirical calibration:
   - Takes the selected scale ratio
   - Finds a known reference on the page (scale bar or dimension string)
   - Computes `pdfUnitsPerMetre` empirically from that reference
   - If no reference found, falls back to two-point manual calibration ("Click two endpoints of a known dimension")
   - Stores the calibration per page

7. **Multi-viewport pages:**
   - If multiple scale texts are detected at different positions, show them all in a list
   - "This sheet has 2 scales: 1:48 (main plan), 1:24 (detail). Select the scale for your measurement area."
   - Future: auto-associate polygons with the nearest viewport's scale

8. **Scale badge:**
   - Once confirmed, the sheet info panel shows a green "1:48 ✓" badge
   - Unconfirmed pages show an amber "1:48 ?" badge
   - Pages with no scale detected show "No scale"

**Calibration priority (most reliable first):**

| Priority | Method | Reliability | Notes |
|---|---|---|---|
| 1 | Manual two-point (C tool) | Highest | User measures a known dimension directly. Zero assumptions. |
| 2 | Scale bar detection | High | Empirical: measures the bar in PDF units, reads the label. No unit system assumptions. |
| 3 | Dimension string cross-ref | High | Empirical: measures the leader line in PDF units, parses the dimension text. |
| 4 | User-confirmed ratio | Medium | User selects from dropdown. Still needs a reference measurement to convert ratio → pdfUnitsPerMetre. |
| 5 | Title block text (auto) | Low | Informational only — pre-selects the dropdown. Never used directly for area math. |

**Fallback for ratio-only (no empirical reference):**

If the user confirms a ratio (e.g., 1:48) but we can't find a scale bar or dimension string to calibrate empirically, the app prompts:

> "Please click two endpoints of a known dimension to confirm the scale."

This ensures we always have an empirical pdfUnitsPerMetre, never a theoretical one.

#### 1.4 Area Measurement — User-Guided Polygon
- User clicks to place vertices on the plan, tracing the building perimeter or room boundary
- Polygon closes on double-click or clicking near the first point
- **Snap assist:** Detect nearby vector line endpoints/intersections from PDF geometry (PDF.js operator stream) and snap cursor to them
- Live area readout updates as vertices are placed (shoelace formula × scale factor)
- Vertex handles are draggable for adjustment (TurboScan's "move points to confirm edges" pattern)
- Support for:
  - Multiple polygons per page (rooms, zones, gross area)
  - Named polygons (user labels: "Main Floor GCA", "Garage", "Office")
  - Polygon subtraction (e.g., gross area minus voids/atriums)

#### 1.5 Auto-Detect Building Outline (Assisted)
- Parse PDF vector paths on plan sheets — look for closed polylines that form rectangular/near-rectangular boundaries
- Heuristic: the largest closed path that isn't the page border or title block border is likely the building footprint
- Present detected outline to user as a pre-placed polygon with adjustable vertices
- User confirms, adjusts, or discards and traces manually
- This is not ML-based room detection (that's Phase 3) — just geometric heuristic on vector data

#### 1.6 Room Schedule Extraction
- On sheets containing tabular text (detected via text position clustering), extract room schedule data:
  - Room number, name, area
- Cross-reference against user-measured polygons
- Display comparison: "Schedule says Office = 27.80 m²; your polygon = 28.1 m² (1.1% variance)"

#### 1.7 Results Panel
- Summary table: sheet, polygon name, area (m² and ft²), perimeter
- Export to CSV
- Print-friendly summary view

---

### Phase 2 — Volume Calculation

Extend area extraction into 3D by combining plan areas with section heights.

#### 2.1 Section Analysis
- On classified section sheets (A5.*), detect horizontal datum lines (floor levels)
- Extract floor-to-floor heights from dimension strings or level annotations
- User can manually set heights per level if auto-detection fails

#### 2.2 Volume Assembly
- For each floor plan polygon, multiply area × floor-to-floor height = volume per storey
- Sum storeys = gross building volume
- Handle: cathedral ceilings, double-height spaces (flag from section analysis), sloped roofs
- Sloped roof volume: detect roof pitch from sections, compute triangular prism volume above top floor

#### 2.3 Cross-Validation
- Compare computed volume against energy model data if present (e.g., A0.10 shows 1029.30 m³)
- Compare computed GFA against OBC Matrix data (e.g., A0.09 shows 225.18 m²)
- Surface discrepancies to user with percentage variance

---

### Phase 3 — Smart Detection (Future)

AI/ML-assisted room and element detection. Requires either a server-side component or WebAssembly ML inference.

#### 3.1 Room Boundary Detection
- Semantic segmentation of floor plan images to identify individual rooms
- Wall detection via line thickness + continuity analysis
- Door/window detection for wall segmentation
- Output: auto-generated room polygons with suggested labels

#### 3.2 Element Counting
- Detect and count: doors, windows, plumbing fixtures, electrical panels
- Classify by type where possible (e.g., interior door vs. exterior door)

#### 3.3 Assembly Matching
- Link detected walls/floors/roofs to construction assembly types (from A0.07)
- Per-element material takeoff based on assembly layer definitions

---

### Phase 4 — BOM Extraction (Future)

Full bill of materials from the complete CD set.

#### 4.1 Schedule Parsing
- Extract all tabular data: door schedule (A8.01), window schedule (A8.02), room finish schedule (A8.05)
- Parse column headers, row data, and cross-references

#### 4.2 Specification Matching
- Link schedule items to specification sections (e.g., "06 00 00 Wood Framing")
- Extract material types, quantities, dimensions from spec notes

#### 4.3 Quantity Takeoff
- Combine: room areas × finish schedule = material quantities per room
- Wall linear footage × assembly layers = material quantities per wall type
- Export as structured BOM (CSV/JSON) compatible with estimating tools

---

## Technical Design

### PDF Vector Geometry Extraction

PDF.js exposes the operator stream via `page.getOperatorList()`. Key operators for geometry:

| Operator | Meaning |
|---|---|
| `moveTo` (m) | Start a new subpath |
| `lineTo` (l) | Straight line segment |
| `curveTo` (c) | Bezier curve |
| `closePath` (h) | Close current subpath |
| `rectangle` (re) | Rectangle shorthand |
| `stroke` (S) | Stroke current path |
| `fill` (f) | Fill current path |

**Strategy:** Reconstruct vector paths from the operator stream, transform by the page's CTM (current transformation matrix), and build a spatial index of line segments. Use this for:
- Snap-to-line cursor behaviour
- Auto-detect closed polygons (building outlines)
- Wall thickness detection (parallel line pairs)

### Text Extraction & Parsing

`page.getTextContent()` returns text items with position, font, and transform data. Use for:
- Title block parsing (sheet number, title, scale) — text near bottom-right of page
- Dimension string parsing — regex patterns: `\d+'-\d+"`, `\d+\.\d+\s*m`, `\d+\s*mm`
- Room labels — text inside closed polygons
- Schedule table extraction — cluster text items by Y-coordinate into rows, X-coordinate into columns

### Scale Conversion

```
realWorldDistance = pixelDistance × (1 / scale) × (unitConversion)

Example for 1:48 metric:
  1 drawing unit = 48 real units
  PDF coordinates are in points (1/72 inch)
  At 150 DPI render: 1 PDF point = 150/72 = 2.083 pixels

  pixelsPerMetre = (DPI / 72) × (1000 / scale)
  At 150 DPI, 1:48: pixelsPerMetre = (150/72) × (1000/48) = 43.4 px/m
```

### Two-Canvas Architecture

```
<div id="viewer" style="position: relative;">
  <!-- Layer 1: PDF render (read-only, re-rendered on zoom) -->
  <canvas id="pdf-canvas"></canvas>

  <!-- Layer 2: Annotation overlay (user interaction, polygons, measurements) -->
  <canvas id="overlay-canvas" style="position: absolute; top: 0; left: 0;"></canvas>
</div>
```

- PDF canvas: rendered by PDF.js at current zoom level
- Overlay canvas: same dimensions, transparent background, handles all mouse events
- On zoom/pan: both canvases transform in sync
- Polygon vertices stored in PDF coordinate space (not pixel space) so they survive zoom changes

### Data Model

```javascript
var project = {
  fileName: "",
  pages: [
    {
      pageNum: 1,
      sheetId: "A2.44",
      sheetTitle: "CD Main Level",
      classification: "plan",       // plan | section | elevation | schedule | general | detail
      scale: { ratio: 48, unit: "mm", source: "auto" },  // source: auto | manual
      calibration: { pixelsPerUnit: 43.4, unit: "m" },
      polygons: [
        {
          id: "poly_001",
          label: "Main Floor GCA",
          vertices: [ {x: 120, y: 340}, {x: 890, y: 340}, ... ],  // PDF coords
          area: 257.53,       // m2
          perimeter: 68.2,    // m
          confirmed: true
        }
      ],
      heights: null   // populated for sections: { levels: [{name: "Foundation", elevation: 0}, ...] }
    }
  ],
  volumes: [
    { level: "Main", area: 257.53, height: 3.05, volume: 785.5 }
  ],
  scheduleData: {
    rooms: [ { num: 100, name: "Hallway", area: 14.58 }, ... ]
  }
};
```

### State Persistence

- Save/load project state as JSON (download/upload or `localStorage`)
- No server round-trips — everything client-side

---

## Competitive Landscape

| Tool | Auto-Detect | Scale | Area | Volume | BOM | Client-Side | Open Source |
|---|---|---|---|---|---|---|---|
| **Togal.AI** | Full AI | Manual | Yes | No | Via integrations | No (cloud) | No |
| **Bluebeam Revu** | No | Manual + calibrate | Yes | Yes | Manual assembly | No (desktop) | No |
| **PlanSwift** | Partial | Manual | Yes | Yes | Yes (assemblies) | No (desktop) | No |
| **EasyTakeoffs** | No | Auto + manual | Yes | No | No | Yes (browser) | No |
| **pdf-takeoff** (GitHub) | No | Manual | Basic | No | No | Yes | Yes (MIT) |
| **ProTakeoff** (GitHub) | No | Manual | Yes | No | Partial | No (Tauri) | Yes (MIT) |
| **PDF-Parser (ours)** | Heuristic (v1), ML (v3) | Auto + manual | Yes | Yes (v2) | Yes (v4) | Yes | Yes |

**Our differentiator:** Purpose-built for Canadian residential construction documents. Understands OBC Part 9 conventions, NBC sheet numbering, metric/imperial dual units, and integrates with BfCA's embodied carbon workflow. Not trying to be a general-purpose takeoff tool — focused on the area/volume data needed for EC calculations (BEAM, MCE2, wbLCA tools).

---

## Implementation Plan

### Step 1 — Skeleton + PDF Loading ✅ (2026-03-27)
- [x] Multi-file HTML app: `index.html` + 10 ESM modules (`.mjs`) + `serve.sh`
- [x] PDF.js 4.9.155 ESM build in `lib/`
- [x] Local dev server via `python3 -m http.server 8000`
- [x] File upload (browse + drag-and-drop) via FileReader API
- [x] Two-canvas viewer (PDF layer + overlay)
- [x] Page thumbnails in sidebar, click to navigate
- [x] Sheet classification (title block parsing, sheet ID, type tags)
- [x] Dark UI with toolbar, sidebar, status bar
- [x] Polygon measurement tool (click-to-trace, shoelace area, close near first vertex)
- [x] Area labels on polygons (dark pill overlay with m² or "uncalibrated")
- [x] Measurement panel in sidebar with running total
- [x] Undo/redo stack (50 levels, Cmd+Z / Cmd+Shift+Z)
- [x] CSV export of measurements
- [x] JSON project save/load with calibration data

### Step 2 — Scale Confirmation Workflow ✅ (2026-03-27)
- [x] "Check Scale" button (S key) — triggers scale detection + confirmation panel
- [x] Scale confirmation panel: detected scale pre-selected in dropdown, metric/imperial toggle
- [x] Common scale dropdowns (metric 1:10–1:200, imperial 1"=1' through 3/16"=1')
- [x] **Three-state scale model:** Pending (auto, grey ?) → Accepted (provisional, yellow ✓) → Verified (empirical, green ✓)
- [x] Accept enables area math immediately (theoretical conversion, validated to ~0.03% accuracy)
- [x] Verify = empirical two-point calibration (gold standard)
- [x] Flexible dimension input parser (19-6 1/2, 19.55', 8500 mm, bare numbers, etc.)
- [x] Calibration persisted to ProjectStore (included in JSON export)
- [x] Spatial-aware text joining for scale detection (fixes "1:4" → "1:48" split-text bug)
- [x] Known-ratio validation + digit-completion heuristic
- [ ] Multi-viewport awareness: detect multiple scales per page (future)
- [ ] Scale bar auto-detection from vector geometry (future)

### Step 3 — CAD-Style Viewer Controls ✅ (2026-03-27)
- [x] **Scroll-wheel zoom centered on cursor** (like AutoCAD/Bluebeam)
- [x] **Middle-mouse-button pan** (drag to pan, no modifier needed)
- [x] Ctrl+left-click pan (trackpad fallback)
- [x] CSS transform-based zoom/pan (no re-render on zoom — instant)
- [x] Infinite workspace — no scroll boundaries, can zoom to any corner
- [x] F key fits page to viewport
- [x] +/- buttons retained as accessibility fallback
- [x] Render cancellation prevents "Cannot use same canvas" crash on rapid zoom
- [x] Zoom debounce (80ms) for scroll wheel
- [x] Auto-fit on page navigation

### Step 4 — Visual Polish & Interaction ✅ (2026-03-27)
- [x] Cyan polygon edges (3px) and vertex handles — visible on any drawing background
- [x] Large label pills (26px title, 24px area) — white title + cyan area on dark background
- [x] Subtle area fill (8% opacity cyan)
- [x] **Vertex dragging** — click and drag any vertex on a closed polygon to adjust
- [x] Hover cursor changes to "move" near draggable vertices
- [x] Drag saves undo state, recalculates area, persists to ProjectStore
- [x] Loading progress bar: "Reading page 1/30..." with visual fill bar
- [ ] Vertex handle sizing relative to zoom level (future)

### Step 5 — Measurement Methods & Area Management (NEXT)

Expand the measure tool from polygon-only to multiple methods, and add area naming/merging.

#### 5.1 Measurement Method Dropdown
The M (Measure) tool gets a method selector — either in the toolbar or as a floating dropdown near the cursor:

| Method | Interaction | Use case |
|---|---|---|
| **Polygon** (default) | Click vertices, close near first point | Complex shapes, irregular rooms |
| **Bounding Rectangle** | Click start corner, click opposite corner | Fast orthogonal areas — most rooms, floor plates |

- **Bounding Rectangle** creates a 4-vertex polygon from just 2 clicks (diagonally opposite corners)
- The resulting polygon is editable — user can drag vertices to adjust after creation
- Rectangle edges align to the page axes (orthogonal) — no rotation for v1

#### 5.2 Area Renaming
Default label "Area 1", "Area 2" etc. should be user-editable:

- **Click label pill** on the drawing → inline text input appears, user types new name, Enter to confirm
- **Click label in sidebar** measurement table → same inline edit
- Whichever is easier to implement first; both should update the same underlying label
- Common names: "Main Level", "Upper Level", "Garage", "South Elevation", "Foundation"
- Name persists to ProjectStore and appears in CSV/JSON export

#### 5.3 Area Merging / Healing
When multiple polygons partially overlap on the same page:

- **"Merge overlapping"** toggle/button — computes the union of all overlapping polygons into a single combined polygon
- Use case: user traces a main floor and a bump-out separately, wants the total combined area
- Implementation: detect polygon intersection, compute union outline, replace overlapping polygons with merged result
- Display merged area as a single entry in the measurement panel with summed label
- Non-overlapping polygons remain separate
- This is a **nice-to-have** for v1 — the running total in the sidebar already gives the combined area. True geometric union is complex. Consider a simpler approach first: a "Group" function that logically combines selected polygons under one label while keeping them visually separate, and shows their sum as the group total.

### Step 6 — Vector Snap & Outline Detection
- [ ] PDF operator stream parsing for line geometry
- [ ] Spatial index of line segments
- [ ] Cursor snap to nearby endpoints/intersections
- [ ] Heuristic building outline detection
- [ ] User confirm/adjust workflow ("Does this look correct?" with adjustable vertices)

### Step 7 — Schedule Extraction & Cross-Validation
- [ ] Text clustering into table rows/columns
- [ ] Room schedule parser
- [ ] Cross-validation: "Schedule says Office = 27.80 m²; your polygon = 28.1 m² (1.1% variance)"

### Step 8 — Section Analysis & Volume (Phase 2)
- [ ] Level detection on section sheets
- [ ] Floor-to-floor height extraction
- [ ] Volume = area × height per storey
- [ ] Cross-validation against energy model data (A0.10)

### Step 9 — Polish & Export
- [ ] Print-friendly summary view
- [ ] Improved project save/load (restore polygons + calibrations from JSON)
- [ ] Error handling and edge cases
- [ ] Testing against multiple CD sets (different firms, scales, formats)

---

## Known Bugs / Resolved

| # | Status | Description | Resolution |
|---|---|---|---|
| 1 | **FIXED** | Area values wildly wrong (1.22 m² for a ~200 m² house) | Three-state scale model: Accept (theoretical, ~0.03% accurate) + Verify (empirical). |
| 2 | **FIXED** | Marquee zoom broken — wrong location | Removed; replaced with cursor-centered scroll-wheel zoom (Step 3). |
| 3 | **FIXED** | Black background / "polygon in space" after zoom | CSS transform zoom/pan — no re-render on zoom (Step 3). |
| 4 | **FIXED** | "Cannot use same canvas" crash on rapid scroll-wheel zoom | Render cancellation + 80ms debounce. |
| 5 | **FIXED** | Polygon label (red text) hard to read over red-tinted area fills | Cyan edges/labels, large dark-background pills (Step 4). |
| 6 | **FIXED** | Scale detection reads "1:4" instead of "1:48" | Spatial text joining + known-ratio validation + digit completion. |
| 7 | **FIXED** | No way to adjust polygon vertices after closing | Vertex dragging with hit-testing, undo support. |
| 8 | **Cosmetic** | `favicon.ico` 404 on every page load | Harmless; browser auto-requests. Could add a favicon. |
| 9 | **Cosmetic** | `TT: undefined function: 32` warning from PDF.js | CAD font hinting opcode; no impact on rendering or text extraction. |

---

## File Structure

```
PDF-Parser/
├── index.html              ← main app shell (CSS + HTML)
├── serve.sh                ← dev server launcher (python3 http.server)
├── lib/
│   ├── pdf.min.mjs         ← PDF.js 4.9.155 ESM (349 KB)
│   └── pdf.worker.min.mjs  ← PDF.js web worker (1.3 MB)
├── js/
│   ├── config.mjs          ← constants, scale patterns, colours
│   ├── pdf-loader.mjs      ← PDF.js wrapper
│   ├── sheet-classifier.mjs ← title block / sheet type
│   ├── scale-manager.mjs   ← scale detection + calibration
│   ├── canvas-viewer.mjs   ← two-canvas + pan/zoom + marquee
│   ├── polygon-tool.mjs    ← polygon measurement + undo/redo
│   ├── vector-snap.mjs     ← vector geometry + snap
│   ├── schedule-parser.mjs ← table extraction
│   ├── project-store.mjs   ← data model + export
│   └── app.mjs             ← main controller + UI
├── docs/
│   └── PDF-Parser.md       ← this workplan
├── logs/                   ← debug logs (git-ignored)
└── PDF resources/          ← reference PDFs (git-ignored)
```

Version tracking is via git commits, not step-numbered files.

---

## Open Questions

1. **Scanned PDFs:** The reference set is vector (CAD-exported). Many CD sets from smaller firms or municipal archives are scanned raster images. Should Phase 1 support raster, or vector-only?
   - Recommendation: Vector-only for Phase 1. Raster requires OCR (Tesseract.js) and line detection (Hough transform) — significant added complexity.

2. **Multi-building sites:** Part 3 projects may have multiple buildings. Support in Phase 1?
   - Recommendation: No — Phase 1 assumes single building. Multi-building is a Phase 2+ concern.

3. **Integration with EC tools:** Should PDF-Parser output feed directly into BEAM/MCE2 input formats?
   - Recommendation: Yes, as a Phase 4 feature. For now, CSV export is sufficient.