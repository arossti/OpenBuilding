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

### 3.2. Axis layout — CORRECTED 2026-05-19 PM mid-call

> **Important semantic correction from Andy mid-call:** *"The Reference Trajectory is not 'another material' — but what would happen if that feedstock DID NOT flow into a construction material, such as burning sugarcane stock instead of turning it into structural panels. So Reference is unmitigated material flow, and Project Trajectory is what happens when that material becomes a carbon sequestering building material. So scoped phases for vertical axes may not make as much sense."*
>
> The earlier draft (LCA modules A1, A2, A3 ... as axes) treated RT and PT as if they could both be stratified by EN 15804 module. But **RT does not have an A1/A3/A5** — RT is an *unbounded counterfactual atmospheric flow over time*, not a module-stratified inventory. PT *is* stratified by EN 15804 module (because the project commits carbon at specific module events: A1 at Year 0, A5 at Year 0, C4 at Year = lifespan). But the comparison RT-vs-PT happens in the **time domain**, not the module domain.

### 3.2.A. Corrected axis layout — TIME HORIZONS as axes

Each axis = a time horizon (Year 0, Year 5, Year 20, Year 50, Year 100, Year T_ref ≈ 250). Each axis value = the **cumulative atmospheric carbon emission** at that horizon (in kgCO₂e or per-functional-unit equivalent).

```
   Y0     Y5     Y20    Y50    Y100   Y250(Tref)  │  dCRF(100)  dT(100)  Completeness(100)  Direction
   ───────────────────────────────────────────────────────────────────────────────────────────────────
   ●──────●──────●──────●──────●──────●           │   value     value    value              cooling
       (red — Reference Trajectory)              │
   ●──────●──────●──────●──────●──────●           │   value     value    value              cooling
       (blue, shaded — Project Trajectory)        │
```

Per-axis interpretation:
- **Y0** = cumulative emission to atmosphere *at installation* (negative for RT if feedstock was just harvested but not yet released; negative for PT since A1 deposits carbon into the building)
- **Y5** = cumulative emission *5 years post-installation*. For RT-A default_5 trajectory, this is roughly where the feedstock would have fully decayed under counterfactual. For PT, this is still mostly storage.
- **Y20, Y50** = the meaningful storage-benefit horizons (RT has fully released; PT still holds)
- **Y100** = the GWP100-comparable horizon; ΔCRF(100) is the EPD-reportable headline
- **Y250 (T_ref)** = full reference completeness — by this year the PT has also fully released its carbon (typically, for non-permanent storage)

Per-line interpretation:
- **Red line (RT — per material)** traces the counterfactual cumulative emission through time. For an RT-A default_5 archetype, by Year 5 the line crosses the initial carbon stock (full release).
- **Blue line, shaded (PT — per material)** traces the project's cumulative emission through time. For a glulam beam with 75-year lifespan, the curve stays *much lower* than RT through Year 0–75, then jumps at Year 75 + decay tail.

**The shaded area between blue and red is the climate benefit** at each horizon. Lower blue = more atmospheric carbon avoided at that point in time. The chart at-a-glance shows where the storage benefit is largest and when the post-EOL "catch-up" happens.

### 3.2.B. The output axes (right side, calculated)

After the time-horizon axes, divider, then climate-response output axes:

| Axis | Unit | Computed from |
|---|---|---|
| **ΔCRF(100)** | W·m⁻²·year | ∫₀¹⁰⁰ ΔRF(t) dt — the GWP100-comparable EPD-reportable |
| **ΔT(100)** | °C·year | ∫₀¹⁰⁰ ΔT(t) dt — practitioner-friendly headline |
| **Completeness(100)** | — | C(100) = ΔT(100) / ΔT(T_ref) |
| **Direction** | — | cooling (negative ΔCRF) / warming (positive) |

Per-material RT vs PT lines populate the time-horizon axes; the output axes show building-level totals at the rightmost end.

### 3.2.C. What still works from the earlier (rejected) module-based design

- **Multi-component stratification** (N red + N blue lines, one pair per material). Still correct — each material gets its own RT vs PT trajectory pair traced through time. See §3.4.5.
- **Phase grouping via banded backgrounds**. Still useful, but for the TIME axes now: "First decade" / "20–50 yr" / "Use period" / "Beyond completeness" colored bands behind axis labels.
- **Per-component summary table beneath the chart**. Unchanged.

### 3.2.D. Where the EN 15804 module structure DOES live in the UI

PT's module-stratified inventory (A1, A3, A5, B4, C4) is still load-bearing — that's the data feeding into the curve. It lives in the **form pane** (left side of the screen):

```
┌──────────────────────────────────────────────────┐
│  Product: Glulam beam                            │
│                                                  │
│  Inventory (kgCO₂e per declared unit):           │
│    A1:  -1000   (feedstock carbon)               │
│    A3:     50   (manufacturing)                  │
│    A5:     15   (install waste)                  │
│    B4:      0   (no replacement)                 │
│    C4:    +1000 (EOL release at Year 75)         │
│                                                  │
│  Feedstock:    [C — Perennial regenerative ▼]    │
│  Lifespan:     [75] years                        │
│  RT:           [RT-A: −5/+5 ▼]                   │
│  EOL mix:      Inc[10] LF[60] Rec[20] Reuse[10]  │
└──────────────────────────────────────────────────┘
```

The form pane is the *module-domain* input; the chart is the *time-domain* output. They're synchronized — change a module value, the PT curve in the chart updates.

### 3.2.E. Scaffold-code revision needed

The Phase-0 scaffold committed in `7a6ef51` (file `js/cclimb/chart-config.mjs`) defines `LCA_MODULES` as axes. That's the now-superseded design and gets revised in the next commit. The new shape:

```js
// chart-config.mjs (revised)
export const TIME_HORIZONS = [
  { id: "Y0",    label: "Year 0",    years: 0,   phase: "install" },
  { id: "Y5",    label: "Year 5",    years: 5,   phase: "early" },
  { id: "Y20",   label: "Year 20",   years: 20,  phase: "service" },
  { id: "Y50",   label: "Year 50",   years: 50,  phase: "service" },
  { id: "Y100",  label: "Year 100",  years: 100, phase: "gwp_comparison" },
  { id: "YTref", label: "Year 250",  years: 250, phase: "full" }
];

export const OUTPUT_AXES = [
  { id: "dCRF_100", label: "ΔCRF(100)", unit: "W·m⁻²·yr", calculated: true },
  { id: "dT_100",   label: "ΔT(100)",   unit: "°C·yr",    calculated: true },
  { id: "C_100",    label: "Completeness(100)", unit: "—", calculated: true },
  { id: "direction", label: "Direction", unit: "—", calculated: true }
];
```

The PT-inventory form-pane fields (A1, A3, A5, B4, C4, lifespan, EOL mix) move to `js/cclimb/inventory-form.mjs` (NEW, P0.5) where they belong as form bindings rather than chart axes.

### 3.2.F. Original (rejected) module-based axis design — kept for historical reference

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

### 3.4.5. Multi-component stratification — N red lines + N blue lines

**Refined by Andy 2026-05-19 PM (mid-prep):** the chart isn't *one* red line vs *one* blue line per building. It's **N red lines + N blue lines**, where N = the number of material components in the building (flooring, structural frame, roofing, cladding, surface coatings, insulation, glazing, etc.). Each component gets its own RT/PT pair.

The "game" the practitioner is playing becomes intuitive at a glance:

- **N red lines** trace the Reference Trajectory for each component (what would happen to that material's carbon under its counterfactual)
- **N blue lines (shaded with semi-transparent fill beneath)** trace the Project Trajectory for each component (what actually happens given the design choices)
- **Visual goal: pull every blue line below its corresponding red line at every life-cycle module axis.** The shaded fill between blue line and red line is the per-component climate benefit.
- Components where blue is *above* red are the design problems — the practitioner can immediately see *which* materials are dragging the building's climate response in the wrong direction.

Sample reading: a building with CLT structural frame + cork flooring + spray-foam insulation + steel cladding. The CLT and cork blue lines sit comfortably below their reds (carbon-storing perennials with long lifespans + good EOL). Spray-foam blue sits on top of red (no storage, fossil-derived). Steel cladding blue sits at red (no biogenic component). The chart shows at-a-glance: structural choice is doing the heavy lifting; spray-foam is the design's climate liability; cladding is neutral.

```
       A1   A2   A3   A4   A5   B4   C1   C2   C3   C4   D    │  ΔCRF(100) ΔT(100) Completeness
       ───────────────────────────────────────────────────────────────────────────────────────
      ●╲                                              ╱●     │
       ╲╲─────────────●────                        ╱╱╱        │   ← CLT structural (red RT)
        ╲▓●─────●──────▓▓▓▓▓▓▓▓▓▓▓▓▓▓●────●─────●▓▓●          │   ← CLT structural (blue PT, shaded)
                                                              │
      ●─────●─────●─────●─────●─────●─────●─────●─────●       │   ← Spray-foam (red RT, flat at zero benefit)
      ●╱╱╱╱●╱╱╱╱●╱╱╱╱●╱╱╱╱●╱╱╱╱●╱╱╱╱●╱╱╱╱●╱╱╱╱●╱╱╱╱●          │   ← Spray-foam (blue PT, above red = liability)
                                                              │
       (etc., one pair per component)                         │
       ───────────────────────────────────────────────────────────────────────────────────────
       (summary row: building-level totals at each output axis)
```

Sub-totals per component live in the row strip beneath the chart, with a final row for the **building-level total ΔT(100) in °C·year** — the headline number for the building, accumulated across all component trajectories.

### 3.4.6. Metric on the building-level total — °C·year vs. W·m⁻²·year

Andy asked: *"total impacts in terms of °C temperature change... unless I am mistaken."* The mapping:

| Metric | Unit | What it represents | When to use as the headline |
|---|---|---|---|
| **Cumulative Temperature Response** ∫ΔT(t)dt | **°C·year** | Integral of temperature change vs time. *Intuitive for practitioners* — directly speaks to "how much warming we caused over the period." | **The practitioner-friendly headline.** Recommended as the primary big-number on the bottom summary row. |
| **Cumulative Radiative Forcing** ∫ΔRF(t)dt | W·m⁻²·year | Integral of radiative forcing vs time. *Rigorous methodology-aligned headline* — what CCLIMB §4.2.1 and Appendix A specify as the GWP100-comparable metric. | The reportable headline in EPDs and methodology-compliant outputs. Used in tables, not the at-a-glance display. |

So **both metrics show up**, but their roles are different:
- Big bold number at the top right of the chart (°C·year) — what the practitioner *feels*.
- Small precise number in the export table (W·m⁻²·year as ΔCRF(100y)) — what the EPD annex *requires*.

Both are computed; both are exportable; the dashboard shows °C as the love-at-first-sight metric, W·m⁻²·year as the rigorous companion. Per CCLIMB §4.2.3 + Critical Note in §5.2.4, neither value can be reported in CO₂e terms or used as a carbon credit / offset.

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

## 7. Questions for the working-group call

These are framed for direct discussion, not just internal flags. Order roughly by how load-bearing the answers are for BfCA's CCLIMB-app implementation.

### 7.1. Climate model — mandated or implementer's choice?

CCLIMB §6.2 specifies "AR6-consistent" impulse-response or emulator-based models, but doesn't mandate a specific one. Different calculators implementing different IRFs (Bern reduced-complexity vs FaIR vs OSCAR vs Joos et al. 2013) will produce *different* ΔCRF and ΔT values for the same input inventory.

**Question for the group:**
- Will the methodology eventually mandate a specific IRF (which one, and on what timeline)?
- Or stay implementer-choice but require disclosure (calculator declares which model + parameters)?
- Without convergence, ΔCRF(100y) values reported across calculators won't be comparable. Is that an acceptable v1 state?

### 7.2. T_ref calibration — 250 years final or pending?

CCLIMB §5 marks T_ref ≈ 250 years as "provisional." Completeness C(H) is computed relative to T_ref, so the number is load-bearing — a different T_ref shifts every reported completeness.

**Question for the group:**
- What's the path to finalizing T_ref? Working group vote? Literature alignment? Specific scientific reference?
- Should CCLIMB-app expose T_ref as a configurable parameter pending finalization, or lock it at 250 yr and re-release when the working group settles?

### 7.3. Tier 2 / Category D (timber) timeline

CCLIMB v1 defers timber to v2. But timber (CLT, glulam, LVL, dimension lumber) is *most* of the structural-mass-timber EPD market and one of the biggest carbon-storage stories in modern construction. Without Tier 2 support, CCLIMB v1 covers maybe half the materials practitioners care most about.

**Question for the group:**
- Is there a target timeline for Tier 2?
- Is BfCA welcome to propose an interim Tier 2 treatment that the working group can vet against the eventual final spec?
- For products with *combined* feedstocks (e.g. wood-cement composites — Cat A or C residue + Cat D timber), how does v1 handle them? §4 "Combined Feedstocks" says classify each independently; does that mean the timber portion gets *excluded* from CCLIMB analysis until v2?

### 7.4. Calculator certification process

CCLIMB §6 lists Calculator Requirements (scope, scientific basis, gas coverage, temporal treatment, transparency, etc.) but doesn't specify *how* a calculator's compliance is verified or by *whom*. If BfCA ships CCLIMB-app as a public tool, on what basis does a practitioner trust that it computes correctly?

**Question for the group:**
- Is there a planned governance / certification body?
- Will there be a reference test-suite (input → expected output) that calculators can self-verify against?
- For now, what's the disclosure expectation — "this app implements CCLIMB methodology v1.0 with documented deviations: X, Y, Z"?

### 7.5. EPD-annex normative status

Appendix A defines CCLIMB results as "supplementary information only" — outside the core ISO 14025 / EN 15804+A2 indicator tables. Practitioners reading an EPD might miss it; PCRs may not yet have a slot for it.

**Question for the group:**
- Is there a path toward CCLIMB ΔCRF(100y) becoming a *normative* indicator in some PCRs (especially for biogenic-carbon-rich product families)?
- For early adopters (BfCA, Vancouver building requirements, etc.) who want CCLIMB-style time-explicit reporting alongside GWP100, what's the formal sanctioning mechanism short of methodology adoption by an SDO?

### 7.6. Connection to existing GWP-biogenic reporting in EPDs

Many EPDs today already publish per-stage `GWP-bio` (carbon dioxide-equivalent biogenic emissions per LCA module A1, A2, A3, etc. — see [`../workplans/EPD-Parser.md`](../workplans/EPD-Parser.md) §11 and Mélanie's 2026-05-05 answers). This is the inventory data CCLIMB ingests as Step 1 inputs.

**Question for the group:**
- Is the GWP-bio per-stage already in EPDs *the same number* CCLIMB ingests as A1/A3/etc. carbon flow, or are there definitional differences (BCRP vs GWP-bio vs material-content-derived calculations)?
- For products with multiple biogenic components, how does CCLIMB handle the per-component allocation? (Tied to the §3.4.5 multi-line stratification question — does the methodology require per-feedstock breakdown, or only per-product aggregate?)

### 7.7. Default decay rates — US EPA WARM or future Canada-context

CCLIMB §3 references "US EPA WARM model" for landfill / incineration decay rates. For Canadian projects (where BfCA operates and where Vancouver's mandatory EC programs apply), is there a planned Canadian-context source?

**Question for the group:**
- Is WARM the working-group consensus default, or a placeholder?
- For the BfCA CCLIMB-app shipping to Canadian practitioners, can we configure WARM as a default but allow user-supplied Canadian decay rates (e.g. from CMHC, ECCC, NRCan studies) as overrides?

### 7.8. Multi-component visualization sanction

(BfCA-specific design proposal, not a methodology question — but worth raising for working-group reaction.)

The BfCA CCLIMB-app proposes a **per-component stratified parallel-coordinates chart** — N red lines (one per material component) + N shaded-blue lines (one per material component) — for whole-building analysis (see §3.4.5). This visualizes per-component climate response across all LCA modules, with building-level totals as a summary row.

**Question for the group:**
- Does the methodology say anything about per-component vs aggregate reporting at the building scale (Step 9 of the workflow)?
- Is per-component disclosure *required*, *optional*, or *out of scope* at the WBLCA reporting level?
- Concern with per-component reporting: it could be interpreted as ranking materials ("CLT good, spray-foam bad") which Appendix A §A.6 explicitly prohibits. **But** showing per-component results in a *neutral comparison frame* (every component compared to its own RT) avoids ranking — each line is just "this material's climate response relative to its own counterfactual." Is the working group comfortable with that framing?

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
