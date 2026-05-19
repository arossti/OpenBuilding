# CCLIMB — BfCA implementation workplan

> Companion to [`CCLIMB-Workplan.md`](CCLIMB-Workplan.md) (Chris's methodology proposal, translated from Word). This document interprets the proposal as a 6th BfCA module, sleeves it into the existing BEAMweb / PDF-Parser / Matrix / Database / EPD-Parser ecosystem, and sketches the visualization + implementation strategy.
>
> **Drafted 2026-05-19 PM in prep for Andy's 3pm working-group call.** Subject to revision as the working-group decisions in §1.5 land.

---

## 1. Summary of the CCLIMB proposal

CCLIMB (Carbon & Climate Impact Model for Materials and Buildings) is a **time-explicit dynamic-LCA (dLCA) methodology** that interprets the climate impact of biogenic-carbon-storing building products *not* as a single CO₂e number, but as a **time-series of radiative forcing and temperature change** over a chosen horizon.

The fundamental claim: GWP100-style accounting collapses uptake and release into a single mass-balance figure, losing the timing information that's load-bearing for atmospheric concentration trajectories. Storing carbon for 50, 100, or 250 years before re-emission is *not* climate-neutral — it shifts the radiative forcing curve, and that shift is measurable.

### 1.1. The math chain

```
Emissions (per year)  →  Atmospheric concentration  →  Radiative forcing  →  Temperature
       E(t)                       C(t)                       RF(t)               ΔT(t)
```

Driven by an **Impulse Response Function (IRF)** convolution:

```
RF(t) = ∫₀ᵗ E(τ) · IRF(t − τ) dτ
```

The climate response to a *project* (`PT`) is then compared to a *reference trajectory* (`RT`) representing the counterfactual:

```
ΔRF(t) = RF_project(t) − RF_RT(t)        [Tier 1, timing-driven]
ΔRF(t) = RF_RT(t) − RF_project(t)        [Tier 2, stock-based — v2]
```

### 1.2. Inputs (per product)

| Input | Source | Notes |
|---|---|---|
| A1 carbon content / GWP-bio | EPD module A1 | Negative emission at Year 0 |
| A3 carbon flows | EPD module A3 | Processing-stage emissions |
| A5 install-waste emissions | EPD module A5 | Routed via Incineration / Landfill (EPA WARM decay rates) |
| C4 end-of-life carbon | EPD module C4 | At Year = product lifespan |
| Feedstock category | User-selected (A/B/C/D/E) | Determines RT defaults |
| Reference trajectory | User-selected (RT-A defaults or RT-B custom) | RT-A: –1/+1, –5/+5, or other defaults. RT-B: custom growth + decay |
| Product lifespan | EPD or user-supplied | Year of EOL onset |
| EOL mix | EPD or user-supplied | Incineration % / Landfill % / Recycle % / Reuse % |

### 1.3. Outputs

| Output | Unit | Reporting |
|---|---|---|
| Instantaneous radiative forcing `RF(t)` | W/m² | Plot (per gas + total) |
| Integrated radiative forcing `∫₀ᴴ ΔRF(t)dt` | W·m⁻²·year | Table at 20, 50, 100, T_ref |
| Temperature response `ΔT(t)` | K | Plot |
| Integrated temperature response `∫₀ᴴ ΔT(t)dt` | °C·year | Table at horizons |
| **ΔCRF(100y)** | W·m⁻²·year | **The headline EPD-reportable metric** — comparable in *logic* to GWP100 but explicitly *not* CO₂e |
| Completeness `C(H)` | dimensionless | Fraction of full impact captured at horizon H, relative to `T_ref` (~250 yr) |
| Residual `1 – C(H)` | dimensionless | Counterpart |
| Direction of effect | cooling / warming | Qualitative |

### 1.4. Feedstock categories (Tier 1 — v1 scope)

| Cat | Source | Examples | Opportunity cost |
|---|---|---|---|
| A | Residues / waste / recycling streams | Straw, slash, sawdust, recycled wood/paper, sewage | None |
| B | Purpose-grown short-rotation crops | Hemp, flax, switchgrass, algae | Minimal |
| C | Perennial regenerative primary products | Bamboo, cork, rubber, coconut, fast-growing wood crops | Minimal |
| **D** | **Timber (all species)** | **All long-rotation woody biomass** | **Significant → deferred to Tier 2 / v2** |
| E | Engineered atmospheric uptake | Mineralized feedstocks, captured-CO₂ polymers | None |

Category D is critical because it's *most* of the structural mass-timber market (CLT, GLT, glulam, LVL). v1 defers it pending forest-counterfactual governance.

### 1.5. Working-group decisions still open (per §Next Steps in [CCLIMB-Workplan.md](CCLIMB-Workplan.md))

1. Gross vs. net carbon storage treatment (or both)
2. Final material categorization (Tier 1 sub-categories)
3. Reference trajectory governance for Tier 2 (timber)
4. Climate model selection (which IRF, which carbon-cycle model)
5. T_ref calibration (~250 yr provisional)
6. Governance model for companion documents

### 1.6. Inconsistencies / red flags worth flagging at the call

- **5-yr vs 10-yr horizon mention** (lines 143–144 of CCLIMB-Workplan.md): "5-year horizon" used for Tier 1 categorization in one sentence, "10-year horizon" in the immediately following sentence. Working group needs to land on one number.
- **`[N.1]` reviewer-comment anchors** sprinkled through the Word→MD translation lost their attached comment bodies. If those reviewer notes need to inform the final document, they need to be re-captured.
- **A.4.4 says ΔCRF computed over 100 years** but elsewhere T_ref is described as ~250 yr. The relationship between "the 100-yr GWP-comparable headline" and the "full T_ref completeness" needs an unambiguous statement.

---

## 2. Why this fits as the 6th BEAM module

### 2.1. Current ecosystem

BfCA OpenBuilding currently ships five apps from one repo, deployed via GitHub Pages:

| URL | Audience | Function |
|---|---|---|
| `/` | Anyone | Landing page / app directory |
| `/pdfparser.html` | Anyone (practitioners) | PDF takeoff |
| `/matrix.html` | Anyone | Regulatory compliance grid |
| `/database.html` | Anyone (read-only) | Materials catalogue viewer |
| `/beamweb.html` | Anyone (practitioners) | Embodied carbon calculator |
| `/epdparser.html` | **BfCA team only** | Catalogue ingestion (see EPD-Parser.md §14) |

CCLIMB slots in naturally as `/cclimb.html` — a sixth module sharing the same design system, same deployment pipeline, same materials catalogue.

### 2.2. Public-facing positioning

Unlike EPD-Parser (which is back-of-house BfCA tooling per EPD-Parser.md §14), **CCLIMB is public-facing**. The methodology is openly published, the inputs come from any LCA/EPD, and the intended audience is the broad LCA community — practitioners, designers, building owners, policy analysts (per §1.2 of CCLIMB-Workplan.md).

This makes CCLIMB the *third* public-facing analytical tool alongside BEAMweb (carbon calculator) and Matrix (regulatory compliance):

| Module | Audience | Reads from catalogue? | Writes to catalogue? |
|---|---|---|---|
| BEAMweb | Public | Yes | No |
| Matrix | Public | No (uses inline regulatory data) | No |
| **CCLIMB** | **Public** | **Yes (optional)** | **No** |
| EPD-Parser | Internal | Yes | Yes (curators only) |

The catalogue read is optional because CCLIMB's standalone mode lets users enter EPD inventory data manually for products *not* in the BfCA catalogue.

### 2.3. Two operating modes

**Standalone mode** (default for non-BfCA users):
- User enters product carbon inventory directly (A1, A3, A5, C4 carbon flows)
- User picks feedstock category + RT + lifespan + EOL mix
- CCLIMB computes climate response, displays parallel-coordinates RT vs PT chart, exports report
- No catalogue dependency

**BEAM-connected mode** (default for BfCA users + anyone using the catalogue):
- User picks a product from the materials catalogue (`schema/materials/*.json`)
- Inventory fields pre-populate from the catalogue's `impacts.*` + `physical.*` + (once Tier-10 lands) `methodology.beam_calc.*`
- User adjusts service life, RT choice, EOL mix interactively
- Whole-building roll-up (Step 9 of the flowchart) pulls a BEAMweb-exported product list

These are the same UI; the BEAM-connected mode just pre-fills the form-pane fields.

### 2.4. What CCLIMB depends on / borrows from BfCA

| Dependency | From | Notes |
|---|---|---|
| Materials catalogue read | `schema/materials/*.json` via Pages | Already public; no schema change needed for read-only use |
| `methodology.beam_calc.full_c_kgco2e` per material | EPD-Parser C-fb6 (pending) | Optional input to CCLIMB's PT trajectory. CCLIMB can compute its own if absent. |
| Design system | `bfcastyles.css` | Add `§N CCLIMB:` banner per the consolidation convention (see CLAUDE.md "Styling") |
| Landing card | `index.html` | One new card with `Planning` / `Beta` / `Live` badge progression |
| Schema lookups | `schema/lookups/material-groups.json`, `lifecycle-stages.json` | EN 15804+A2 module enumeration |
| `js/shared/state-manager.mjs`, `js/shared/file-handler.mjs` | Cross-app utilities | For IndexedDB persistence, drag-drop EPD imports |

CCLIMB does *not* need: format-specific PDF parsers (its inventory comes from already-parsed EPDs or manual entry), browser-side Anthropic API integration (no LLM in scope for v1), or write access to the catalogue.

---

## 3. Visualization — parallel coordinates as the central UI

The OBJECTIVE-tool screenshot is the load-bearing analogy. **The same UX paradigm Andy uses for energy modeling — Reference (red) vs. Target (blue) across many axes — maps directly to CCLIMB's RT vs. PT comparison.**

### 3.1. Why parallel coordinates fit CCLIMB

CCLIMB outputs many time-and-horizon-stratified numbers per product (RF at 20/50/100/T_ref, ΔT at the same, completeness, direction). Comparing PT to RT means comparing two curves through those axes. Single-axis bar charts force users to pick one horizon; multi-panel small-multiples scale poorly. **Parallel coordinates is the natural shape: each axis is an output dimension, each line is a scenario, RT and PT are two lines.**

The OBJECTIVE pattern adds another layer that fits CCLIMB perfectly:
- **Input axes are draggable sliders** (in OBJECTIVE: SHW%, ACH50, WWR, etc.; in CCLIMB: service lifespan, RT growth/decay, EOL mix %)
- **Output axes are calculated** (in OBJECTIVE: TEUI, TEDI, GHGI; in CCLIMB: ΔCRF(20/50/100/T_ref), Completeness(100), Direction)
- **Dragging an input axis recomputes the output curve in real time**

That's the central interaction: practitioner pulls service life from 35 → 100 years, watches the blue (PT) curve shift left of red (RT), watches ΔCRF(100) become more negative (cooling effect), watches completeness rise toward 1.0.

### 3.2. Axis layout for CCLIMB — one axis per LCA module

**Clarified by Andy 2026-05-19:** *"Each axis on the PC graph would be an ISO scoped carbon division, i.e. A1, A2, A3, etc."*

This is the right framing because LCA practitioners already think in module terms. Putting one axis per EN 15804+A2 module aligns the chart directly with the way EPDs are read, and the way BEAMweb / EPD-Parser stratify data internally. The OBJECTIVE pattern (each axis = one engineering metric) maps cleanly: in CCLIMB, each axis = one life-cycle module.

Draft axis order (left to right):

```
PRODUCT STAGE  │  CONSTRUCTION  │      USE STAGE       │     END OF LIFE     │ BEYOND │ CLIMATE RESPONSE (calculated)
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  A1   A2   A3 │    A4    A5    │ B1 B2 B3 B4 B5 B6 B7 │   C1   C2   C3   C4 │   D    │ ΔCRF(100)  ΔT(100)  C(100)
 kgCO2e per module                                                              kgCO2e   Wm⁻²·yr      °C·yr   —
```

Per-axis interpretation:
- **A1** = raw material extraction (often negative for biogenic — carbon-uptake during feedstock growth)
- **A2** = transport from extraction to manufacturing
- **A3** = manufacturing-stage process emissions
- **A4** = transport to site
- **A5** = installation-stage emissions (incl. install-waste decay routed via WARM)
- **B1–B7** = use-stage (operational + maintenance + replacement); typically near-zero for most carbon-storing materials, B4 replacement carries new A+C of the replacement product
- **C1–C4** = end-of-life (demolition + transport + waste processing + disposal/release)
- **D** = beyond-system-boundary credits (recycling potential, energy recovery)
- **Climate response axes** (right side, calculated only) = ΔCRF(100), ΔT(100), Completeness — collapsed time-explicit response

Red line (RT) and blue line (PT) trace through every module axis. **The gap between red and blue at each axis = the per-module carbon flow attributable to the project relative to the counterfactual.** That's a far richer comparison than a single GWP100 number can deliver — at a glance the practitioner sees which modules drive the climate benefit.

Phase grouping happens via banded backgrounds behind the axes (Product / Construction / Use / EOL / Beyond / Response), so the eye reads the EN 15804 phase boundaries without needing axis-label noise.

### 3.3. Inputs vs calculated axes

OBJECTIVE distinguishes input (editable, blue dot) vs calculated (small dot) per its legend. CCLIMB inherits that convention:

| Axis category | Editable / calculated | Notes |
|---|---|---|
| A1, A3, A5 carbon flows | **Editable** for standalone mode; **pre-filled & editable** for catalogue mode | These are the EPD-supplied module inventories |
| B4 (replacement) | **Editable** | Models a service-life shortfall — user drags B4 up to simulate early replacement |
| C1–C4 EOL emissions | **Editable** but derived from EOL mix (Incineration / Landfill / Recycle / Reuse %) and decay rates | Sliders for EOL mix sit *under* the axes, drive the C-module values |
| D credits | **Editable** | Reuse / recycle credit estimates from EPD or user input |
| ΔCRF(100), ΔT(100), Completeness | **Calculated only** | Output of the IRF convolution; tiny dots, no drag |

**Service life** lives in the form pane *next to* the chart (not as an axis), because it affects WHICH year each module's flow lands in — that's a time-shift parameter rather than a per-module magnitude.

### 3.4. Service life as a chart-driving parameter (separate from axes)

The lifespan input doesn't deserve its own axis — instead it drives the temporal placement of each module's flow in the underlying convolution. UI sketch:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Product:  [Dropdown: Glulam beam ▼]    Lifespan: [75] yr   T_ref: [250] yr │
│                                                                              │
│  Feedstock category: [C — Perennial regenerative ▼]                          │
│  Reference Trajectory: [RT-A: –5/+5 default ▼]  or [RT-B custom: g=5 d=5 yr] │
│  End-of-life mix:  Inc [10]%  Landfill [60]%  Recycle [20]%  Reuse [10]%     │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Parallel-coordinates chart — one axis per A1..D + climate response]        │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  Reference (RT) / Project (PT) / Δ / Direction / Completeness rows           │
└──────────────────────────────────────────────────────────────────────────────┘
```

Dragging the lifespan number from 75 → 25 re-runs the climate calc: the B4-onwards carbon flows shift to earlier years, the IRF convolution sees the EOL release sooner, ΔCRF(100) becomes less negative, the blue line on the climate-response axes moves toward the red line. **Visible, immediate, intuitive.** This is the "demolished after 10 years" pro-rating question I raised earlier — handled natively by the chart.

### 3.5. Per-category input requirements (axis vocabulary)

Folding in **Table from CCOB §6 (p.12–13)** — what each feedstock category requires as input. This drives which axes are *editable* for each feedstock the user selects, and which axes get defaulted from RT-A archetypes.

| Cat | Required PT inputs (axis values user enters or pre-fills from EPD) | Required RT inputs (red-line counterfactual) | Documented additionally |
|---|---|---|---|
| **A** Residues / Waste | Biogenic carbon entering product (A1); timing of carbon retention (lifespan); EOL release profile (decay / combustion / landfill) | Counterfactual near-term atmospheric release profile absent product use | Decay assumptions; sensitivity analysis if timing materially affects results |
| **B** Short-rotation crops | Carbon incorporated; product retention duration; EOL release profile | Continued short-cycle biological turnover profile absent product use | Regrowth cycle length; LULUC excluded unless explicitly in inventory |
| **C** Perennial regenerative | Same as B | Multi-year regrowth trajectory with standing carbon stock maintained | Harvest cycle duration; explicit statement that harvest does not materially reduce standing stocks |
| **D** Virgin long-rotation timber *(v2)* | Same | Forest counterfactual trajectory per Timber Tier framework (Tier 1 Commodity / Tier 2 Managed Regional / Tier 3 Stand-Specific) | Tier level disclosed; explicit counterfactual documentation |
| **E** Engineered atmospheric uptake | Atmospheric CO₂ incorporated; timing of incorporation; durability / stability / decay profile | Baseline: CO₂ remains in atmosphere absent engineered incorporation | Permanence + durability assumptions documented; opportunity cost modeled only if land displacement |

UI mapping: when the user picks a feedstock category in the form pane, the chart's editable-axis set updates accordingly. E.g. picking **A — Residues** enables A1 + A5 + C4 (decay timing) axes, defaults the RT line to RT-A's exponential-decay archetype with the documented k constant. Picking **C — Perennial** enables A1 + B (replacement) + harvest cycle, defaults the RT to "continuous uptake with minimal stock loss." This category-driven UI prevents the user from filling in axes that don't apply to their product type and reduces the chance of methodology mis-application.

### 3.6. The CCOB calculation-workflow diagram as a chart precedent

CCOB Workplan p.14 has a horizontal calculation-workflow diagram showing the module flow:

```
[Photosynthetic CO₂ removal]  [Biogenic harvest residues]  [Biogenic mfg residues]  [Construction residues]  [Waste incineration / other EOL]
       A1                              A2                          A3                       A5                          C4
   (negative)                      (positive)                  (positive)                (positive)            (positive or negative for D credit)
```

with colored arrows (green = removal, red = emission) on each module. **This is essentially the parallel-coordinates axis layout in a static form.** CCLIMB-app's interactive version replaces the static arrow widths with draggable axis points: practitioner sees the same horizontal module flow they already understand from CCOB documentation, but each point is a value they can adjust to test sensitivity. The continuity with the methodology's own diagram is a UX gift — practitioners don't need to learn a new visualization language.

### 3.7. Whole-building roll-up

For Step 9 of Chris's flowchart (whole-building view), the same parallel-coordinates chart aggregates across products. Two presentations to consider:

**(a) Sum-of-products** — one PT line that's the sum of all products' module flows. RT line is the sum of all products' reference trajectories. Same chart, same axis layout, just bigger numbers. Cleanest.

**(b) Stacked-product overlay** — each product gets its own faint line, the bold blue line is the total. Useful for spotting which products contribute most to the climate response.

Likely answer is **(a) for v1** with a sortable per-product table beneath (which product contributes how much to each module). (b) as a v2 toggle if practitioners ask for it.

### 3.5. Below-the-chart numerical table (OBJECTIVE-style)

OBJECTIVE shows Reference / Target / Δ / %Δ / Ref Cost / Target Cost / Target Savings rows below the chart. CCLIMB's analog:

| Row | Content |
|---|---|
| **Reference (RT)** | Per-axis red value |
| **Project (PT)** | Per-axis blue value |
| **Δ** | Per-axis numeric difference |
| **%Δ** | Per-axis percentage |
| **Direction** | cooling (negative ΔCRF) / warming (positive) per horizon |
| **Completeness** | Per output horizon (only meaningful on output axes) |

"Cost" doesn't translate to CCLIMB — there's no money axis. But "direction of effect" and "completeness" both fit the same row-summary slot.

---

## 4. Implementation sketch

### 4.1. File map

```
cclimb.html                                        — entry point
js/cclimb.mjs                                      — ESM entry, wires the chart + form
js/cclimb/
  ├── climate-model.mjs                            — IRF + temperature convolution math
  ├── reference-trajectories.mjs                   — RT-A defaults, RT-B parameterization
  ├── feedstock-categories.mjs                     — Tier 1 sub-cat A/B/C/E + Tier 2 stub
  ├── parallel-coords.mjs                          — Andy's D3 PCG widget (ported from OBJECTIVE)
  ├── chart-config.mjs                             — axis definitions, scales, banding zones
  ├── form-bindings.mjs                            — slider ↔ chart sync, debounce
  └── exporter.mjs                                 — markdown / JSON / image report generation
js/shared/state-manager.mjs                        — existing; CCLIMB reuses for IndexedDB persistence
js/shared/file-handler.mjs                         — existing; for drag-drop EPD JSON imports
bfcastyles.css                                     — append §N CCLIMB section
schema/lookups/cclimb-rt-defaults.json             — RT-A archetype parameters per feedstock cat
schema/lookups/ipcc-ar6-irf-params.json            — AR6 IRF parameters (CO₂ Bern coefficients, CH₄ lifetime, etc.)
docs/workplans/CCLIMB.md                           — workplan (this doc, moved when implementation starts)
```

### 4.2. Climate model — IRF in JS

CCLIMB requires an impulse-response function for at least CO₂ and CH₄ (per §6.4 of CCLIMB-Workplan.md), calibrated to IPCC AR6 (§6.3). Two viable approaches:

**(a) Implement directly in JS.** The Bern carbon-cycle model is 4 exponentials with documented coefficients. CH₄ is a single perturbation lifetime (~11.8 years). N₂O similar. ~100 lines of JS total. Pros: zero runtime dependency, easy to audit, fits BfCA's "no build tools, no framework" convention. Cons: needs careful citation of AR6 coefficient sources.

**(b) Wrap an external library.** FaIR (Finite Amplitude Impulse-Response) is the academic standard but Python. JS ports exist (e.g., simplified versions in some climate-viz libraries). Pros: pre-validated. Cons: adds dependency, may not be Pages-deployable as ES modules.

**Recommendation: (a) for v1.** Document the AR6 parameter sources in `schema/lookups/ipcc-ar6-irf-params.json` so the climate model is auditable. The math is well-known and the BfCA team can verify it against published tables.

### 4.3. Reusing the OBJECTIVE PCG codebase

Andy has the D3 parallel-coordinates widget ready. Migration plan:

1. **Copy as-is** into `js/cclimb/parallel-coords.mjs`. ES-module wrap if it isn't already.
2. **Replace axis definitions.** OBJECTIVE's 14 axes (SHW%, DWHR%, etc.) → CCLIMB's input + output axes.
3. **Hook the value-binding callbacks.** OBJECTIVE recomputes TEUI/GHGI when user drags an input axis; CCLIMB recomputes ΔCRF(t) at each horizon when user drags lifespan / RT / EOL.
4. **Style harmonization.** Apply BfCA palette + section banner so the chart matches BEAMweb / EPD-Parser visual identity.
5. **Below-chart table.** OBJECTIVE's Δ / %Δ / Ref Cost / Target Cost rows translate to CCLIMB's RT / PT / Δ / Direction / Completeness rows.

The brushing / selection interactions OBJECTIVE already provides (per the screenshot's "Restore Baseline", "Decarbonize", "Optimize" buttons) map cleanly onto CCLIMB equivalents:

| OBJECTIVE button | CCLIMB equivalent |
|---|---|
| Refresh Graph | Recompute (after a non-axis change like switching feedstock category) |
| Restore Baseline | Reset PT inputs to match RT defaults |
| **Decarbonize** | Snap EOL mix to 100% Reuse + Recycle (maximally climate-favorable EOL) |
| **Optimize** | Find the lifespan/EOL combo that maximizes |ΔCRF(100)| |
| **Super Optimize** | Includes RT-B custom growth + decay tuning |
| **PassivHaus-ify** | (does not translate — energy-specific) — could be replaced by **Mass-timber-ify** (assume Cat C / D feedstock with conservative RT) |

### 4.4. State management + persistence

Reuse `js/shared/state-manager.mjs` for IndexedDB persistence. Schema:

```js
// CCLIMB IndexedDB store: "cclimb-scenarios"
{
  id: "scenario-uuid",
  created_at: "2026-05-19T15:00:00Z",
  product: {
    catalogue_id: "<beam_id or null if standalone>",
    display_name: "Glulam beam",
    inventory: { A1: -1000, A3: 5, A5: 1.5, C4: 1000 },  // kgCO2e
    feedstock_cat: "D",
    lifespan_years: 75,
    eol_mix: { incineration: 0.1, landfill: 0.7, recycle: 0.2, reuse: 0.0 }
  },
  reference_trajectory: {
    type: "RT-A",
    archetype: "default_5",   // -5/+5
    growth_years: 5,
    decay_years: 5
  },
  result: {
    delta_crf_20: -800,    // W·m⁻²·year, computed
    delta_crf_50: -1100,
    delta_crf_100: -950,
    delta_crf_full: -200,
    completeness_100: 0.78,
    direction_100: "cooling"
  }
}
```

### 4.5. Whole-building roll-up (Step 9)

The flowchart's Step 9 is the integration point with BEAMweb. Practitioner exports a building's product manifest from BEAMweb (or the materials catalogue), CCLIMB consumes the list, runs the climate calc per product, sums the trajectories, displays a single whole-building parallel-coordinates view.

Implementation: a `import-beam-building.mjs` module that takes a BEAMweb-exported JSON file (product list + quantities) and feeds the per-product CCLIMB calc. Same chart UI, just with the building total as the "Project" line.

### 4.6. Reporting + export

The CCLIMB Annex (Appendix A.5 of CCLIMB-Workplan.md) requires a structured reporting table (Counterfactual definition, ΔCRF(100y), climate response pattern, etc.) accompanied by the required interpretation statement. CCLIMB-app generates this as:

- **Markdown export** — fits into EPD supplementary annex
- **PDF export** — for client deliverables (uses pdf.js render path, or just the browser print)
- **JSON export** — for downstream consumers (BEAMweb, future audit tools)

---

## 5. Module integration mechanics — sleeving into BEAM

Following the same pattern as PDF-Parser, Matrix, etc.:

### 5.1. Landing card

Add to `index.html`:

```html
<a class="app-card" href="cclimb.html">
  <div class="app-card-icon">📈</div>
  <h3>CCLIMB</h3>
  <p>Time-explicit climate impact for carbon-storing building products. Compares project trajectory to reference, reports radiative forcing and temperature change.</p>
  <span class="app-card-badge badge-planning">Planning</span>
</a>
```

Badge progression: `Planning` → `Alpha` → `Beta` → `Live`.

### 5.2. Pages deployment

`.github/workflows/deploy-pages.yml` already stages `*.html` + `js/` + `bfcastyles.css` + schema JSON into `_site/`. CCLIMB inherits the deployment without workflow changes — drop the files in place, push, the next build picks them up.

### 5.3. Styling — append to bfcastyles.css

Per the BfCA convention ([CLAUDE.md "Styling"](../../CLAUDE.md)), all styles consolidate into `bfcastyles.css`. Add a new section banner:

```css
/* ═══════════════════════════════════════════════════════════════════════ */
/* §11  APP: CCLIMB                                                       */
/* ═══════════════════════════════════════════════════════════════════════ */

.app-cclimb .pcg-axis-input { /* draggable input axes */ }
.app-cclimb .pcg-axis-output { /* calculated output axes */ }
.app-cclimb .pcg-line-rt { stroke: var(--col-reference, #c0392b); }
.app-cclimb .pcg-line-pt { stroke: var(--col-target, #2980b9); }
/* ...phase-banding zones, summary-row table, etc. */
```

HTML class: `<html class="theme-dark app-cclimb">`.

### 5.4. IP guardrails (forever)

Per [CLAUDE.md](../../CLAUDE.md) IP rules:
- **No `CSI` / `MasterFormat` / `Division` / `MCE²` / `NRCan` / Crown-copyright tool names** in code, UI strings, fetched JSON, or served doc files.
- Schema citations (`ISO 14025`, `EN 15804+A2`, `ISO 21930`, IPCC AR6 chapter references) are factual and stay.
- CCLIMB UI text uses neutral wording — "feedstock category" not "raw-material classification," "reference trajectory" not "counterfactual baseline," etc.

---

## 6. v1 scope (what ships first)

| In v1 | Deferred to v2 |
|---|---|
| Tier 1 feedstocks (categories A, B, C, E) | Tier 2 (timber / Category D) with forest counterfactuals |
| RT-A defaults + RT-B custom (single product) | Multi-product RT governance (mixed feedstock products) |
| Standalone manual-entry mode | BEAMweb building-manifest import |
| Parallel-coordinates UI for single product | Whole-building roll-up (Step 9) |
| ΔCRF at 20/50/100/T_ref + ΔT | Sensitivity / scenario analysis (alternative IPCC SSPs) |
| AR6-calibrated CO₂ + CH₄ IRF | N₂O, sulphate, CFC-11 (per §6.4 *may* but not *shall*) |
| Markdown + JSON export | PDF export with embedded plots |

v1 ships the methodology faithfully for the *bulk* of carbon-storing building product types (residues, short-rotation crops, perennials, engineered uptake). Mass timber waits on the working group's Tier 2 decisions.

---

## 7. Open questions for the 3pm call

1. **Working-group adoption of the IRF model.** Is there a preferred climate model (FaIR? OSCAR? Bern reduced-complexity?) the methodology will mandate, or is "AR6-consistent" sufficient and tools choose?
2. **T_ref calibration.** Is ~250 years the final number, or pending?
3. **Tier 2 timeline.** Is Category D / timber going to be in v2 of the methodology, and on roughly what horizon?
4. **EPD requirements.** Does the methodology contemplate eventual mandatory inclusion in EN 15804+A2 / ISO 21930, or remains a supplementary annex forever?
5. **Calculator certification.** §6 lists Calculator requirements but no certification process. Is there a plan for vetting which engines comply? (Direct relevance to BfCA shipping CCLIMB-app as a public tool.)
6. **Connection to GWP-bio in EPDs today.** Many EPDs publish `GWP-bio per stage A1/A2/A3...` (workplan §11). How does CCLIMB's `A1 carbon storage` input relate to / replace / augment that? Same number, different framing, or genuinely different?
7. **Default decay rates.** §3 references "US EPA WARM model" for landfill/incineration. Is that the working-group consensus, or a placeholder for a future Canada-context source?

---

## 8. Connection to BfCA's existing biogenic-carbon work

The EPD-Parser's Tier-10 (C-fb6, pending Mélanie review per [`EPD-Parser.md`](../workplans/EPD-Parser.md) §11) computes `methodology.beam_calc.full_c_kgco2e` — a *static* per-product biogenic carbon value. **CCLIMB consumes that value as its A1 input.** The pipeline:

```
EPD PDF
  │
  ▼  EPD-Parser (regex + LLM Tier 8.5 per §14)
JSON record in schema/materials/
  │
  ▼  Tier 9 — db-fallbacks + Tier 10 — BEAM normalization
methodology.beam_calc.full_c_kgco2e + methodology.beam_calc.storage_factor
  │
  ▼  CCLIMB-app reads from catalogue
Per-product time-explicit climate response (ΔCRF / ΔT trajectory)
  │
  ▼  BEAMweb whole-building integration (v2)
Building-scale ΔCRF for a project
```

The `storage_cycle` enum from the §11.10 Mélanie draft (`long_cycle | short_cycle | future medium_cycle`) becomes informational once CCLIMB lands — CCLIMB doesn't need the enum because product lifespan + EOL mix renders a continuous storage curve. Mélanie's discrete categorization stays useful as a *human-readable* summary chip in the Database viewer, but the load-bearing math moves to CCLIMB.

The medium_cycle / pro-rating question Andy raised (building demolished early) is **automatically handled by CCLIMB**: change the lifespan input from 100 years to 10, the climate calc recomputes, the parallel-coordinates chart updates, the new ΔCRF(100) shows the (likely much smaller) climate benefit.

---

## 9. Implementation sequencing

| Phase | Scope | Estimate |
|---|---|---|
| **P0 — Shell** | `cclimb.html` + ESM entry, drop-zone for manual EPD input, basic form pane | 1–2 days |
| **P1 — Climate model** | IRF math (CO₂ Bern + CH₄), JSON parameter table, unit tests against published AR6 values | 2–3 days |
| **P2 — Reference trajectories** | RT-A defaults (–1/+1, –5/+5, custom growth/decay), RT-B parameterized form | 1 day |
| **P3 — Parallel-coordinates UI** | Port Andy's D3 widget, axis definitions, RT/PT line binding, slider interactions | 2–3 days |
| **P4 — Output table + reporting** | Below-chart numerical table, markdown export with required interpretation statement | 1 day |
| **P5 — Catalogue integration** | "Pick a product from BfCA catalogue" mode pre-fills inventory | 1 day |
| **P6 — BEAMweb integration (deferred)** | Building-manifest import + whole-building roll-up | v2 |

Estimated 8–11 days for v1 alpha. Most of the cost is climate-model implementation + UI integration. The methodology itself doesn't require new research — the IPCC AR6 parameters are tabulated, the IRF math is well-documented.

---

## 10. Cross-references

- [`CCLIMB-Workplan.md`](CCLIMB-Workplan.md) — Chris's methodology proposal (Word→MD translation). Authoritative on the methodology; this doc is the implementation interpretation.
- [`Workflow diagram steps.pdf`](Workflow%20diagram%20steps.pdf) + [`Workflow diagram steps-1.pdf`](Workflow%20diagram%20steps-1.pdf) — Chris's flowchart for the 9-step user workflow + PT-minus-RT climate calc visualization.
- [`../workplans/EPD-Parser.md`](../workplans/EPD-Parser.md) §11 (Biogenic Calculations) + §14 (Internal positioning + Last Mile LLM) — the EPD-Parser pipeline that feeds CCLIMB's inventory input.
- [`../workplans/Database.md`](../workplans/Database.md) — sibling workplan for the catalogue viewer (CCLIMB's data dependency).
- [`../../CLAUDE.md`](../../CLAUDE.md) — repo-wide conventions (IP guardrails, styling, ecosystem layout).

---

## 11. Methodology evolution — CCOB → CCLIMB

The CCOB first draft (Feb 26, 2023) and the CCLIMB second draft (April 26, 2023) share most of the methodology, but several decisions evolved between them. Worth knowing at the working-group call so the conversation distinguishes "what's settled" from "what's still moving."

### 11.1. Document scope expanded

- **CCOB** = *Carbon Climate Overlay for Buildings* — framed as an "overlay" sitting alongside LCA, focused on buildings.
- **CCLIMB** = *Carbon & Climate Impact Model for Materials and Buildings* — promoted from "overlay" to "model" + explicitly covering both materials and buildings (consistent with EPD-level + WBLCA-level applicability).

The name change signals broader ambition + clearer methodological standing in the LCA community.

### 11.2. Feedstock categorization refined (4 → 5)

CCOB had four Tier 1 sub-categories: A (Waste), B (Short-rotation), C (Perennial), D (Engineered Atmospheric Uptake).

CCLIMB second draft has five: **C "Perennial systems" was split into C (Perennial regenerative — bamboo, coppice) and a new D "Harvest without depletion" (cork, rubber)**, and the original D became **E (Engineered Atmospheric Uptake)**.

The refinement matters because cork and rubber have *different* counterfactuals than bamboo (no harvest-cycle reset; continuous accumulation absent harvest). CCLIMB-app should respect the five-category structure not the original four.

### 11.3. Tier 1 horizon: 10 yr → 5 yr (in flight)

CCOB used a **10-year horizon** consistently as the Tier 1 categorization criterion. CCLIMB second draft has **both 5-year (in some places) and 10-year (in others)** — the working group has been tightening 10 → 5 but didn't fully sweep the doc.

This is a real working-group decision in flight, not a translation typo. CCLIMB-app v1 should support both as a configurable parameter until the working group settles.

### 11.4. Calculator requirements formalized

CCOB §6 was a short bullet list of calculator-model criteria (IPCC alignment, transparency, CO₂ + CH₄ tracking, LCA-scale suitability, open source).

CCLIMB §6 (now spanning ~30 lines and 10 sub-sections) formalizes this into a Calculator Requirements specification covering: scope and role, scientific basis (AR6 chain), climate system parameters (ECS / TCR), gas coverage, input requirements, temporal treatment, output requirements, transparency, consistency, scenario treatment.

**Implication for BfCA's CCLIMB-app:** the app is itself a "climate calculation engine" per CCLIMB §6.1, and the requirements there are not aspirational — they're how the methodology defines a *compliant* calculator. v1 must meet §6.1–§6.9 minimum or the working group won't recognize CCLIMB-app as a valid implementation.

### 11.5. Appendix A — EPD annex framing (CCLIMB-only addition)

CCOB did not have a formal EPD-annex specification. CCLIMB's Appendix A is *the* mechanism by which CCLIMB results live in EPDs without conflicting with declared GWP100 values:

- **Supplementary information only** — never inside the core environmental impact tables.
- **Shall not** be used to adjust, offset, or reinterpret declared GWP.
- **ΔCRF(100y)** is the EPD-reportable headline, with the explicit "comparable in logic to GWP100 but NOT a CO₂e value" framing.
- Required interpretation statement must accompany every reported result.

The CCLIMB-app's export pipeline (§4.6 above) needs to emit reports that conform to Appendix A — the supplementary section title, the required interpretation statement, the counterfactual-definition disclosure, etc.

### 11.6. Climate-response metric split

CCOB had a single `ΔCR(t)` (climate response) metric. CCLIMB split this into:

- `ΔRF(t)` — radiative forcing response (instantaneous)
- `∫ΔRF(t)dt` — integrated / cumulative radiative forcing (the GWP100-comparable form)
- `ΔT(t)` — temperature change response

The split gives practitioners more granular reporting + makes the comparison to GWP100 cleaner. Both axes are reportable.

### 11.7. RT-Low / RT-High demoted to appendix

CCOB §5.1.2–§5.1.3 had RT-Low (optimistic bound) and RT-High (conservative bound) as primary RT archetypes alongside RT-A and RT-B.

CCLIMB second draft kept RT-Low / RT-High in the methodology but moved them to "Draft Reference Trajectories for Tier 2" appendix, since Tier 2 (timber) is deferred to v2. RT-A and RT-B are the only Tier 1 archetypes in v1 of the methodology.

CCLIMB-app v1 only needs to ship RT-A + RT-B. When Tier 2 lands, RT-Low / RT-High come back as the bracket pair for timber counterfactuals.

---

## 12. Interpretation neutrality — load-bearing design principle

CCOB §11 (carried forward as CCLIMB's design ethos): *"CCOB does not declare materials 'good' or 'bad.' Instead, it reports whether building use delays or accelerates atmospheric return relative to each reference trajectory, and how that timing translates into radiative forcing and temperature response over time. Climate benefit or disbenefit exists only relative to a defined reference trajectory and is determined solely by the time-explicit comparison of trajectories. (Rationale: Reinforces 'let results speak' neutrality.)"*

This is non-negotiable for the BfCA CCLIMB-app:

- **No ranking** of materials, no "best to worst" lists, no green-checkmark / red-X scoring.
- **No recommendations** ("you should choose CLT over concrete") — the app only reports the time-explicit comparison.
- **No defaults that imply judgment** — when the user picks RT-B custom, no auto-fill that biases toward "favorable" counterfactual assumptions.
- **Three semantic layers in the output panel** (also from CCOB §9 Reporting requirements):
  - **Carbon storage (state)** — how much carbon is in the product at any given time. *Factual.*
  - **Delayed emissions (mechanism)** — what's been deferred from atmosphere vs counterfactual. *Mechanistic.*
  - **Climate benefit or disbenefit (conditional interpretation)** — the ΔCRF(100y) value with the explicit "relative to specified RT" caveat. *Interpretive.*

The output panel should visually separate these three layers so practitioners can't accidentally read the state value as a benefit claim. Likely UI: three rows, three different colors, three explicit labels.

### 12.1. What this rules out for the app

- A "decarbonize my building" optimizer that picks materials. CCLIMB-app does not optimize — it reports.
- A "score" or "grade" assigned to a product based on its ΔCRF. The methodology is intentionally bound to relative comparison against an explicit RT; an absolute score would force a hidden RT.
- A leaderboard / catalogue ranking by ΔCRF — same reason.

### 12.2. What this enables

- A practitioner brings their *own* RT-B custom inputs (regional regrowth rates, project-specific lifespans), and the app *shows them the result*. The practitioner — not the app — assigns "benefit" or "disbenefit" meaning.
- Side-by-side scenario comparison (two PT lines, one RT line) — the practitioner sees how different lifespan assumptions move the climate response, and reports both as alternative scenarios.

---

## 13. Outstanding from Andy before P0 starts

- [ ] **Working-group decisions** from the 3pm call — particularly which IRF model is mandated and whether T_ref locks at 250 yr.
- [ ] **OBJECTIVE D3 codebase** — Andy's existing parallel-coordinates implementation. Where it lives, what its current axis API looks like, what state-management it expects.
- [ ] **Climate model source citations** — confirm the AR6 chapter / table numbers we'll cite in `ipcc-ar6-irf-params.json`. Working group input welcome on which AR6 ranges are the "right" baselines.
- [ ] **First worked example** — §7.1 of CCLIMB-Workplan.md mentions Interface / Meta / Arup contributions. If a specific product is going to be the v1 calibration case, name it now so P1 implementation can ground-truth against it.
- [ ] **Tier 2 / timber positioning** — does BfCA ship CCLIMB v1 without timber support (clean methodology fit, but excludes ~50% of structural-wood EPDs), or does BfCA propose a *separate* Category D handling that the working group can vet against the eventual v2?
