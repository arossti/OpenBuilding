# OBJECTIVE 4.0 — the roadmap (OpenBuilding.ca)

> **The roadmap for OBJECTIVE 4.0 (OBJECTIVE Pro on the web) and the OpenBuilding.ca tools around it, with the
> cold-start handoff.** Read section 0 first. This document replaces the BEAM materials schema that used to live at
> this path (Andy 2026-11-25: _"our OBJECTIVE workplan replaces the BEAM schema entirely. It will be our roadmap
> document for V4"_); that schema is in git history. Moved here from andy-rnd `docs/OBJECTIVE-V4.md` (andy-rnd keeps
> a pointer) by way of `docs/workplans/`. Sections 3, 4, 7 and 8 are the andy-rnd plan as written; 0, 5, 6 and 9 are new.
>
> The rest of `schema/` is the BEAM material catalogue `database.html` reads: BfCA's data, kept in the repo for local
> use and never deployed (Andy: _"We may use some of the BfCA database later but we'd need permission first."_).

> Andy 2026-11-25: _"V3 is the upgrade with F280. V4 is the bridge to dynamic hourly analysis and ABCD integration
> and ASHRAE 140 compliance."_ and _"My preference is in V4.0, not to offer the complex support of non-oriented walls
> and non-hosted windows."_ This is the plan for him to read before anything is built. Nothing below is built yet
> except what §1 lists.

---

## 0. Cold-start handoff (read this first)

### ▶ START HERE (handoff 2026-11-27, the laptop `M2max`) — written for a cold start after a /clear

**▶ EASY / EXPERT IS LIVE: the stub (PR #37, `1e4d21b`) and its first step (PR #38, branch
`Easy-Cell-IDs-Help`), both merged on Andy's word 2026-11-27, #38 after the nits of his smoke.** "WHAT PR #38
HOLDS" is next below. **The next task: Easy mode section by section, with Andy** marking what is essential in each
(the plan and every ruling: `docs/workplans/REFERENCE-MODEL-EXPLAINED.md`, "Easy and Expert modes, and Guide Me").
That curation is his; an agent does not choose what a section hides. The F280 work below is waiting on other
people: read "WAITING ON OTHERS", check andy-rnd#27 for replies (none by 2026-11-27), and otherwise leave it.

**BUILT, NOT MERGED: PR #44 (branch `V3-Reading-Aids`, to be smoked by Andy).** Stylesheet and witness only.
Andy 2026-11-27, with a picture of V3's S11: _"these features did enhance user comprehension and a visual
overview ... I wanted to consider adding back some of these features in V4 as a usability UX/UI improvement in
both Expert and Easy modes."_ The classes were on the cells all along; 4.0's stylesheet had no rule for them.
`obstyles.css` §8g, in both views and in print:

1. **What the user types or chooses reads in the accent** (V3's blue): typed values, dropdowns and slider
   values are cyan in the Target and red in the Reference, where the accent itself turns. A value not yet typed
   stays dim; a locked one stays ghosted.
2. **Ae sky blue, Ag brown** in S11's "% of Ae & Ag" (`text-air-facing`, `text-ground-facing`). S12 carries no
   such class in V3 or here: nothing coloured there. ❓ Andy: which S12 values should take the two colours?
3. **The dots** before each share of loss or gain in S09, S10 and S11: a high loss red, medium yellow, low
   green; a high usable gain green, a low one red, as V3 had them.
4. **A hairline under every row.** Each cell draws its piece just below itself, so the columns now touch
   (`border-spacing: 0 4px`, the 2 px that stood between them moved inside the cells) and the pieces join.
   - A row cannot draw the line: Safari does not let a table row hold a positioned line (tried; it landed
     against the page).
   - A cell hidden with `visibility` draws no piece, so **Easy now blanks a hidden value's ink**
     (`color: transparent`) instead: the cell and its hairline stay. S02's hidden fuel prices are inputs and
     keep `visibility: hidden` (they must not take the Tab key), so the line stops under them.
   - **Not done: vertical rules** for S13 or other dense sections (Andy: "possibly some verticals"). For S13's
     cleanup.

- A totals row reads a little heavier again (`total-row-text`).
- **S07's Easy cut is RULED** (Andy, "yes and yes"), and #43 merged.
- **Witness:** `test/witness/easy-expert.cjs`, 66 checks. S09 – S12 still fit their cards at 1440, 1512 and
  1728 px wide. Parity not re-run: no file under `src/` changed since #41's 2146 / 2146.
- **PR #45 (branch `Easy-S08`, stacked on #44; merge #44 first): S08 in Easy, PROPOSED by Claude, built for
  Andy's smoke.** Easy keeps the six inputs (radon, CO2, TVOC, the two humidity sliders and their method), the
  guidance limit beside each and the ✓. It does not show the share of the limit (the limit and the ✓ already
  say it) nor the Wood Emissions Offset row (computed from S04's wood; not a measure of the air). Witness: 67
  checks.
- **NEXT: S09 in Easy.**

**LIVE: PR #43 (`1ec227e`, merged on Andy's word 2026-11-27).** Stylesheet and witness only.

- **A rule for every section (Andy 2026-11-27):** _"There is no harm done if inputs are not relevant than
  related outputs would be too, fine to hide."_ Where an input does not apply, what is computed from it need not
  show either. (S15's ∑ Other Energy at Targeted Use is the first case; ruled, display only, no engine change.)
- **S05's Easy cut is RULED** (Andy, "yes").
- **S06 in Easy: nothing to hide.** It holds seven inputs, two subtotals and one unit conversion.
- **S07 in Easy, RULED as proposed.** Easy keeps the six inputs (the method and its
  value, the energy source, the efficiency, the drain water heat recovery), the water used, the hot water's
  energy, the net thermal and electrical demand, the emissions and the ✓. It does not show: the four
  compliance percentages beside the ✓ and their "Ref" caption; COPdhw, which repeats the efficiency slider; the
  two steps between the demand and the drain (Net Demand-Recovered, SHW Wasted); and the row of system losses,
  exhaust and oil demand, which holds no input.
- **Witness:** `test/witness/easy-expert.cjs`, 61 checks. Parity not re-run: no file under `src/` changed since
  #41's 2146 / 2146.

**LIVE: PR #42 (`8cc38d3`, merged on Andy's word 2026-11-27).** Stylesheet and witness only.

- **S04's Actual columns go at Targeted Use in Expert too** (Andy 2026-11-27, "yes"): the rule moved from
  Easy's block to `obstyles.css` §8f, beside S02's fuel prices.
- **S04's Easy cut is RULED** (Andy, "yes"): the derived totals below the fuel table are not shown in Easy.
- **S15's T.7.3 "∑ Other Energy" is not shown at Targeted Use, in both views. The engine is NOT changed.** It
  is `l_141` in S15's row T.7.1: gas bill × gas price + propane bill × its price + wood × its price + oil × its
  price (S04's bills, S02's prices), the yearly cost of the fuels other than electricity as billed. **Nothing
  reads it** (no node depends on `energy.cost.otherFuel`; the heat pump's ROI reads the two electricity costs
  only). Andy said yes to making it zero at Targeted Use and, in the same message, _"I'm wary about calculation
  engine changes without understanding what it refers to"_: so it is hidden where its inputs are hidden, and
  the calculation waits for his word.
- **S05 in Easy, RULED as proposed:** a small section, nearly all headline results.
  Easy drops only the note "(B6 Annual Emissions \* Service Life)" and the four unlabelled compliance
  percentages beside the ✓; the ✓, the two inputs (the typology, the modelled value) and every result stay.
  E.3.5 is the Builders' and is left alone.
- **Witness:** `test/witness/easy-expert.cjs`, 58 checks. Parity not re-run: no file under `src/` changed since
  #41's 2146 / 2146.

**LIVE: PR #41 (`8f684ee`, merged on Andy's word 2026-11-27).** Display only.

- **Two names brought to the Sankey's** (Andy 2026-11-27, "yes to both"):
  - S07's SHW Wasted reads **W.2.W** in its ID cell (it read W.5.3, with "(W.2.W)" only in the caption), as the
    Sankey's "W.2.W SHW Wasted", which draws that value (`j_53`). `markCellId` now takes an ID whose last part is
    a letter alone.
  - S10's first door is **G.7.0** (it read G.7.1), as the Sankey's "G.7.0 Doors" and S11's B.7.0
    (`Openings.js` `s10RowId`, `Section10.js`). ⚠ **Only the first door moved.** Claude had told Andy that all
    of S10's doors would shift down by one; that was wrong: S11's doors run B.7.0, B.7.2, B.7.3 (there is no
    B.7.1), so G.7.2 onward were already in step. Told to him.
  - Left for S13's cleanup: the Sankey's "M.2.1.S Sink" and "M.2.1.D Energy Input".
- **S04 in Easy.**
  - **RULED (Andy 2026-11-26): at Targeted Use the Actual columns are not shown** (the bills, their units,
    Actual Net and the Actual emissions: columns D to G in every row, so the table closes up). The one case
    where Easy hides an input. It follows the model on screen's S.2 (`op-targeted-use`).
    In Expert too since PR #42.
  - **RULED (Andy 2026-11-27, "yes"), as Claude proposed:** Easy keeps the fuel table and its subtotals
    whole (bills, Target, Net, emissions, the emission factors) and does not show what is derived below it:
    Total Net Energy (GJ), Annual Percapita Energy, Primary Energy and its intensity, the nuclear waste
    produced and the PER factor. The nuclear waste FACTOR is an input and stays.
  - ⚠ **Seen, not changed (a calculation):** S15's ∑ Other Energy (`EnergyNodes.js` `energy.cost.otherFuel`)
    multiplies the fuel BILLS by the fuel prices with no test of S.2, so at Targeted Use it still carries
    whatever bills were typed, now that both are out of sight there.
- **LATER, a design refinement of its own (Andy 2026-11-27):** _"we can consider how to collapse empty space
  as a separate design refinement later (ie. collapse empty columns could be an easy rule, collapse empty rows,
  similarly)."_ Where Easy leaves gaps today: S03's Elevation alone on its row; S04's Nuclear Waste alone on
  its row; the columns emptied by hidden values in S03.
- **Witnesses:** `test/witness/easy-expert.cjs` (ALL OK, 54 checks); parity against V3 2146 / 2146 on all 16
  cases; the rest as before.

**LIVE: PR #40 (`e497b7b`, merged on Andy's word 2026-11-27): S03 in Easy** (Andy 2026-11-27, "yes"
to the cut proposed). `obstyles.css` §8e, on screen only, display only:

- **Easy keeps** the seven inputs (Province, City, Current or Future Values, Capacitance and its slider, Days
  Cooling, Elevation, Cooling Override), the Climate Zone, HDD, CDD, the Coldest and Hottest Days and the two
  set-points in °C, and the two ✓.
- **Easy does not show** the °F twins and their captions, the ground-facing degree days, the Summer Night Mean
  and Mean RH, the Winter Average Temp. and the two set-point limits beside the ✓. A cell keeps its place; the
  winter-average row goes whole, unless F280 Mode puts the foundation's configuration on it. With F280 Mode On
  no S03 input is hidden.
- Elevation is left alone on its row (the ground-facing degree days beside it are hidden): for the later pass on
  empty space, above.
- **Witness:** `test/witness/easy-expert.cjs`, 51 checks. Parity was not re-run: nothing but the stylesheet and
  the witness changed since #39's 2146 / 2146.

**LIVE: PR #39 (`c9c91b0`, merged on Andy's word 2026-11-27).** Two things Andy ruled, neither a calculation:

- **One ID, one thing** (Andy: _"I agree with your proposed ID rename/new list, next available numbers"_; the
  IDs are the rows' own, so the Reference shows the Target's). In `src/sections/`:
  - S10's Gains Utilization Factor **G.2 → G.3** (G.2 is S09's Plug/Light/Eqpt. Subtotals and the Sankey's
    "G.2 Plug Light Equipment"; Andy: _"G.2 is a mistake of mine"_). Its "G.3 nGains" caption reads "nGains".
  - S15's TEUI row **T.3.1 / T.3.2 / T.3.3 → T.3**, S01's own row shown again (T.3.1 – T.3.3 are S04's fuels).
  - S03: Summer Mean RH **L.2.2 → L.2.6**; Days Cooling **L.3.3 → L.3.4**.
  - S02: Certifier **A.1 → C.1**, Licence **A.2 → C.2** (A.2 – A.6 are S08's rows); the row that read "L" has
    no ID.
  - S13: Exhaust **M.2.5 → M.2.6**; Summer Boost **V.1.7 → V.1.5**; "M.1.5." loses its full stop.
  - S14: "less Free Cool. & Vent. Exhaust" **T.5.2 → T.4.8**; TELI/TEDI Ratio **T.5.2 → T.5.5** (TELI keeps
    T.5.2). ⚠ The cooling Sankey named the first "T.5.2 CED less Free Cool - VX": renamed with it to T.4.8
    (`Section16C.js`), so one name holds. Found after Andy approved the list; told to him.
  - S15: "Mx. Cool Intsty" **T.6.6 → T.6.13**; the caption "TEUI-imp" beside the peak heating load in BTU/hr
    reads **"Peak Heating Imp"**; "Heat Load Imp", which stood beside the Max. Cooling Load Intensity, is gone.
  - S12: Ae₁₀ Zone **B.18.3 → B.18.5.2**. S07: **"W.X" → W.6.2**.
  - **Still Andy's to word:** S14's note "T.4.1 Includes V.5 Net Vent'l. & T.7.3 CEDI Ae Losses" (there is no
    V.5; T.7.3 is "∑ Other Energy"); and three Sankey names the sections do not use: "G.7.0 Doors" (S10's row
    is G.7.1), "W.2.W SHW Wasted" (S07's ID there is W.5.3), "M.2.1.S Sink" / "M.2.1.D Energy Input" (S13 has
    M.1.4 Sink and M.2.1 Heating System Demand).
- **S02's prices of energy and S.2** (Andy: _"IF S.2 = Utility Bills, show, Else Off in Expert and Easy
  modes"_). While the model on screen has S.2 at Targeted Use, the prices of **gas, propane, wood and oil** are
  not shown, in either view; each model follows its own S.2. `js/objective4.mjs` `syncUse` sets the class
  `op-targeted-use` on `<html>` by the engine's own test (`building.isTargetMode`); `obstyles.css` §8f hides.
  The same class is there for S04's Actual columns when S04 is curated.
  - ⚠ **The price of ELECTRICITY stays visible, against the letter of the ruling.** The engine reads it at
    Targeted Use too: S15's annual cost of electricity, before and after the heat pump (`EnergyNodes.js`
    d_141 = d_135 × l_12, h_141 = d_136 × l_12), hence the ROI, and S18's financials (`pcFinancials.js`). The
    four fuels are read only against their bills (`energy.cost.otherFuel`). Hiding it would leave a live input
    out of reach (the house rule: grey out by the engine's own predicate). **RULED (Andy 2026-11-27): yes,
    electricity stays.**
- **S02 in Easy is otherwise done** (Andy: move on to S03): it holds inputs and one derived value.
- **Witnesses:** `test/witness/easy-expert.cjs` (ALL OK, 45 checks); parity against V3 2146 / 2146 on all 16
  cases; the rest as before.
- **The Sankey names, corrected reading (Andy 2026-11-27):** the Sankey DOES draw "W.2.W SHW Wasted"; it is
  S07's `j_53`. The mismatch is on S07's side: that value's ID cell reads W.5.3 and "(W.2.W)" is only in its
  caption. Likewise "G.7.0 Doors" draws S10's first door row, which S10 numbers G.7.1 (S11's is B.7.0).
  Andy: _"M refers to Mechanical, V to ventilation and T to totals, generally sums."_ The renames wait for him.

**WHAT PR #38 HOLDS** (Andy 2026-11-27, on smoking #37: _"no need to remove the header ids - we should however
hide Cell ID's. In Expert mode, the cell ID's should in fact use the same styling (CSS) ... make all the same as
T.6.0 across all sections please. Also, unlike V3, we have no way to switch On/Off interactive help, let's add
that for Easy mode and Expert mode, On by default in Easy, Off by default in Expert."_):

- **Every Cell ID is marked.** Outside the ID column an ID sat in the body font: 70 beside a value (T.6.1, D.1)
  and 33 leading a caption ("M.1.1 HSPF", "B.18.4 n-Factor"). `FieldManager.js` `markCellId` gives each the
  class `cell-id` as the section renders (a cell alone, or a span around the leading ID); S05's E.3.5, which
  the Builders draw, carries it in `js/objective-builders.mjs`. An ID named inside a sentence is left as text.
- **Expert: one style for every ID,** the ID column's (monospace, 10 px, dim), the header rows' own ids
  included. The header ids stay (ruled).
- **No row draws its own ID twice** (Andy: _"let's be sure like my 3rd screenshot we don't duplicate ID row and
  name"_): seven rows did (B.11, whose name began with it; G.4, B.18.1, B.18.2, B.18.3 in a caption; T.6.4 and
  T.6.8 beside a second value). `markCellId` leaves the repeat undrawn.
  - One ID on two different things: found here, renumbered in PR #39 (above).
- **Easy hides them** (`obstyles.css` §8e, on screen only: print shows them). A hidden ID's cell keeps its
  place and takes no room, so a column of IDs closes up and several sections get shorter.
  - **Not hidden: S11's row IDs that open a Builder** (11 on the default project). They are buttons, and Easy
    never hides an input. **RULED (Andy 2026-11-27): leave the Builders alone for now;** ABCD.EARTH has since
    refined them (the assemblies' IDs among them) and OBJECTIVE's copies are to be updated later, not yet.
  - **Not hidden: S10's opening rows (G.7.x, G.8.x),** Andy's suggestion: without them Easy reads Window,
    Window, Window, and G.8.2 is S11's B.8.2, the same window.
- **Accounting style is back: a number is right-justified, words are left-justified, in both views and in
  print** (Andy 2026-11-27: _"We had a general CSS rul in V3 that text cells left justify and numeric cells
  right justify so number columns line up vertically, accounting style."_). 4.0's stylesheet had dropped V3's
  rule: all 418 values on the default project and all 65 typed numbers were left-justified. Now
  (`obstyles.css` §8b, "Accounting style"): calculated, derived and typed values are right-justified with
  tabular figures; typed words stay left (the project's name, the certifier, the licence number, S21's record);
  a caption follows its column, right over numbers (`FieldManager.js` `markNumberHeads` marks it `num-head`),
  else as its section asked (V3's `align-right` / `text-right` / `align-center` classes, which 4.0 had no rule
  for); a number written into a layout is marked `static-number`.
- **The popover's title is dark** on Bootstrap's pale band (it had the page's light heading colour).
- **Help, the button after the pill** (V3's Help button: the 130 field popovers of `TooltipManager.js`, on
  hover or focus). Each view keeps its own setting, on in Easy and off in Expert until changed, in this browser
  (`objective4Help`); `js/objective4.mjs` `syncHelp` sets V3's one switch to it. The browser's own hover
  captions (the Garage note, a Builder row's name) are not popovers and stay on, as in V3.
- **The button row** still keeps one line down to 1280 px: below 1360 px its gaps close and Help shows its icon
  alone.
- **What wraps, for Andy's smoke** (a cell whose text runs onto a second line; measured in WebKit):
  - at 1728 px wide: only S19 (rows 19.Ae, 19.Ag, 19.1), in both views;
  - at 1512 px: S03 (L.1.1, L.2.1; Expert also L.2.3, L.3.3), S08 (A.5.1, A.6), S13 (M.2.1, V.1.6, V.3.3; Expert
    also M.2.2, V.1.4), S19, and in Expert only S12 (B.16, B.17, B.18.4) and S15 (T.6.8, T.7.1, T.7.4, T.3.1,
    T.8.1). Some captions wrap in S08, S10, S12 and S13;
  - at 1280 px nearly every section wraps, and S11 and S12 scroll sideways.
- **Witnesses:** `test/witness/easy-expert.cjs` (ALL OK, 35 checks; it opens a popover to prove help is on or
  off, emulates print, and counts the numbers by the side they sit on); parity against V3 2146 / 2146 on all 16 cases; `onepage.cjs`, the four
  `builders-*`, `s19-reference`, `host-per-model`, `display-format`, `garage-facing`, `f280-summary` and V3's 8
  Reference specs as before.
- ⚠ **A tenth way `src/` differs from andy-rnd** (the list is further down): `markCellId` and
  `markNumberHeads`.

**WHAT THE STUB IS (PR #37, live)** (Andy 2026-11-26: _"yes, build the stub after #28 merges. We can go section by section and
determine what is essential."_; it changes no calculation):

- **The pill, after Copy from Target: Easy · pill · Expert** (`objectivepro.html`; `js/objective4.mjs`
  `showView` / `syncView`). Cyan at both ends: red belongs to the Reference.
- **Easy is one class, `op-easy` on `<html>`, and nothing else**, so it can change no input, no calculation and no
  saved file. **The page launches in Easy;** the choice is kept in this browser (`localStorage`
  `objective4View`), not in the project file: a reload and New both keep it.
- **The stub hid nothing** (PR #38 hides the Cell IDs). What Easy hides goes in `obstyles.css` §8e, each rule as `html.op-easy <selector>`
  inside `@media screen` (print shows the full report whatever the view). Easy never hides an input, with the one
  exception Andy named (S04's Actual columns while S.2 is at Targeted Use).
- **The spreadsheet's column letters are gone, in both views: 80 captions in 12 sections** (S02, S03, S05 – S09,
  S12 – S15, S19), deleted from each section's header row in `src/sections/`. The rule applied: a header cell
  whose whole caption is its own column's letter. Row IDs stay, and so do one-letter units (W, m).
  - S15's header row held nothing but letters, so it now shows its `15-ID` alone, and S15's rows no longer wrap
    (its last column, which held only "N", takes no width). **RULED (Andy 2026-11-27): the header rows' own
    ids (`02-ID`, `15-ID`, `S19-HEADER`) stay:** _"no need to remove the header ids"_.
- **The button row keeps one line down to about 1260 px** (the pill would have wrapped it at 1280, where "Trust
  - Verify" and "Load Sample" already broke over two lines): a caption no longer wraps, the project's name gives
    way first (240 px down to 90), and narrower than that the rest goes to a second line, where before the last
    button ran off the page.
- **Witnesses:** `test/witness/easy-expert.cjs` (ALL OK, 18 checks: the launch, the pill's place, no column
  letter in either view, 2430 values and the saved file the same in both views, the same 1978 cells shown, the
  view kept across a reload and New, independent of the model on screen); parity against V3 2146 / 2146 on all
  16 cases; `onepage.cjs` (which now skips the launch modal: it had been failing on it since the modal came),
  `display-format.cjs`, `garage-facing.cjs`, `f280-summary.cjs` as before.
- ⚠ **A ninth way `src/` differs from andy-rnd** (the list is further down): the header rows without letters.

**LIVE: `main` after PR #35 (`f646b34`).** The last code is #33 (`d93c99d`: the F280 calculation summary sheet,
#32, with its first page laid out as Figure D.1); #34 and #35 are docs. Deployed to
https://arossti.github.io/OpenBuilding/. Before it: #30 (`ab7c9c2`, the runner and the Garage facing) and #31
(docs). andy-rnd `main` is **`645784e`** (#28, F280-1's ceiling). Andy's word for the night, 2026-11-26: _"you
may PR and merge and self-smoke w/o me"_; that covered #28 and #32 and is not a standing rule.
**To start:** `git checkout main && git pull` here; `git -C ../andy-rnd status` should show `main`, clean, at
`645784e`; cut each task's branch from `main` in the repo it touches.

**Where the F280 claim stands: it cannot be made yet, and two of the reasons are not ours.**

- The operator's run is done and tagged (**`f280-run-2026-11-26` = `dbd20df`**): all 45 of Kieran's case files,
  no calculation changed. 40 of the 45 runs are inside the Cl. 8.4.1 band.
- **Five models are outside, and Cl. 8.4.1 has no allowance for missing one** (Cl. 8.3.9 a) says "each" model):
  - **one is a misprint in the Standard**: the Annex J row for Vancouver 1960s Archetype 2 repeats another
    model's figures. CSA's current copy still prints it;
  - **four are Archetype 3, 1960s and 1980s, low on loss** (Kieran's I19). The Standard prints one ELA10 for
    Archetypes 3 and 4, Kieran entered it, and **NRCan's AIM2.xls run in Excel gives our leakage rates to the
    last digit**, the same for both archetypes. So our AIM-2 is not the cause; what the reference entered for
    the end unit is unknown.
- **RULED (Andy 2026-11-26, "yes, send as written"):** no input and no reference value is adjusted to close a
  gap. The five stand as run, with the findings beside them. An unqualified claim waits for CSA; a qualified
  statement (inside the band on every output but five, each named) is what could honestly be issued today.
- Every figure is private: see "Where the private material is" below. Nothing here quotes the Standard's values.

**WAITING ON OTHERS (check these first next session):**

- **Kieran** (`k1eranth0m`), the verification agent: **openbuilding-ca/andy-rnd#27** (private) holds our reply to
  his note, the report (QO-F280-RUN-01 Rev. B, triage T1 – T13), the results table, the addendum on CSA's
  current copy, the AIM2.xls witness and a draft email to CSA. **#29** in this repo is the public notice, with
  no figures. His to rule: I19; whether to reissue the Archetype 3 and 4 files on the Garage facing; which
  Archetype 1 walls face the garage (I9, needs the plans); his own run of AIM2.xls.
  - **Added 2026-11-27, four notes on andy-rnd#27, none answered yet:** F280-1's summary sheet for his
    Cl. 8.3.2 review, with the interior-shading question; the ceiling height as a question on his I18 ruling;
    the leakage findings, with two questions on Annex G; and a summary of the whole matter written for Andy's
    building-science advisor, whose advice Andy is seeking before anything goes to HVAC-DC, NRCan or CSA.
- **CSA:** Andy has written to CSA's store for the update copy. A firmer email, **drafted for Kieran to send**
  (in #27 and in his note), asks for the erratum, the Archetype 3 inputs, Table 6F and Cl. 8.3.8 b), with a
  reply by 2026-12-03. Its recipient is blank and its escalation paragraph is Andy's and Kieran's to keep.
- **HVAC Designers of Canada is the lead for both open items.** They are the body that verifies software to
  Section 8: https://hvacdc.ca/f280-12-software/ lists eight products "verified by HVAC Designers of Canada as
  meeting the requirements of section 8 of CSA F280-12", first verified October 2023, the work funded by NRCan's
  LEEP team, and the three condition sheets read say "Conditions: None". Eight products cannot have matched a
  misprinted row, so HVAC-DC must hold either a corrected value or a ruling on it, and the same for the end
  unit's inputs. **Andy writes to them himself, in a friendly tone, and only after Kieran's reading** (his words,
  2026-11-27: _"Kieran's reading is vital before we go at this all guns blazing"_). A draft is in the private
  folder (`DRAFT-email-to-HVAC-Designers-of-Canada.md`); nothing is sent. The F280 package that came with the
  Standard (NRCan's method spreadsheets and their test cases) holds no archetype inputs: checked 2026-11-27.
- **I19, a second diagnostic: the highest ceiling (2026-11-27, Andy's question; never an input to adopt).
  Sent to Kieran on andy-rnd#27 as a question on his I18 ruling.** 84 runs on the 16 Archetype 3 and 4 files:
  - **any one height from 6.45 m to 8.03 m puts all 16 inside the band,** loss and gain (the ruled height is
    6.00 m; 8.03 m is the height taken from the basement slab). The band's upper limit is 120 %, so raising the
    middle units with the end units pushes none out;
  - it does not explain the gap: the failing end units equal Annex J at 6.6 – 7.0 m, the middle units of the
    same vintages at 6.1 – 6.3 m, and the two newer vintages are already above it at 6.00 m;
  - the reason it might be legitimate: NRCan's help defines the height "from ground level to the highest
    elevation that house air can rise to ... When the foundation is a walkout basement, ground level is actually
    at the top of the basement floor slab", and both row houses carry garage walls. Kieran's to read in Annex G;
  - not the cause, by the code: the weather station's elevation (AIM-2 takes none; its air density is fixed) and
    the flow exponent as a separate input (it is derived from the ACH50, the volume and the ELA10).
  - Results and the scripts: private folder, `diagnostics/i19-ceiling-height-scan.csv`.
- **I19, a third and fourth diagnostic: leakage by exposed surface, and the printed ELA10s themselves
  (2026-11-27, Andy's question: is the volume-based ACH50, not a surface-based NRL50, at the root of it?).**
  - **Not the cause, though the physics is his.** The Standard gives the end and the middle unit one ACH50, so
    by OBJECTIVE's own air-facing areas the end unit is taken to be about a fifth tighter per m² (its exposed
    area is 1.28 times the middle unit's). Given the middle unit's leakage per m² instead (the same NRL50), the
    four failing end units land 6 to 9 % ABOVE Annex J: inside the band, but as far over as they were under.
    The reference's end unit leaks 6 to 9 % more than its middle unit, not 28 %.
  - **Nothing in the Standard or in AIM-2 scales leakage by surface** (an Explore agent's read of the text
    extract, NRCan's help and implementation notes, and our code): no normalized leakage term anywhere; AIM-2's
    preset types take their ELA from the volume; its house types are Detached and Semi-Detached only, and the
    type changes the ceiling / wall / floor leakage split, nothing else. Annex L.1.2 says the specified ELAs
    were entered in AIM2 and does not say how they were obtained.
  - **OBJECTIVE's surface path works, and the case files bypass it.** A chosen NRL50 becomes AIM-2's ACH50
    through the air-facing area (`VolumeMetricsNodes.js` `airTightness.ach50Target`), so the same NRL50 gives an
    end unit more leakage, when the ELA is left to be derived. A file that types the ACH50 and the ELA10, as the
    Standard's do, goes straight to AIM-2.
  - ⚠ **Found: the Standard's printed ELA10s do not share one ratio to volume.** At one ACH50 and one flow
    exponent, ELA10 / volume must be the same for every house. Across the four archetypes it differs by up to
    3.9 %, and the row houses are the low ones (the same pattern in both typed vintages). With the row houses'
    ELA10 at Archetype 2's ratio, **all eight end and middle units of those vintages are inside the band.**
    A diagnostic, not an input: it says the row houses' ELA10 was derived from another volume or exponent than
    the one specified, and it still does not explain why the end unit sits below the middle one.
  - **Each unit at its own leakage rate, the ELA10 left blank for OBJECTIVE to derive** (Andy's follow-up): the
    1980s models close and the 1960s models do not. The derived ELA10 takes the flow exponent of AIM-2's nearest
    prescribed type, which sits well above the printed ELA10 for the 1980s' ACH50 and barely above it for the
    1960s'.
  - **What the reference behaves as if it used:** the end unit equals Annex J with its ELA10 about 5 to 6 %
    above the printed value, the middle unit with about 1 to 2 %. So the reference's end unit looks 4 to 5 %
    leakier than its middle unit, although the Standard prints one value for both.
  - The scanned NRCan report in the package (Lew 1993, "Evaluation of AIM-2 for HOT2000") is now readable:
    private folder `tools/ocr/` (the macOS text recogniser, a 40-line Swift tool, and its output). It treats
    "a semi-detached or row house" as one class and house type as a matter of the leakage SPLIT only.
  - **All of it went to Kieran on andy-rnd#27, 2026-11-27** (Andy: "yes, send both to Kieran on #27"), with two
    questions: whether the tables Annex L.1.2 cites for the ELAs exist in his copy, and whether Annex G gives
    the row houses another volume for the leakage area.
  - Results and scripts: private folder `diagnostics/` (`i19-same-nrl50-as-middle-unit.csv`,
    `i19-ela-derived-by-objective.csv`, `i19-ela-per-m3-as-archetype-2.csv`, each comment as sent).
- **The N-factor and AIM-2 do not compete in the F280 loads (2026-11-27, Andy's question).** S21's design loss and
  gain take AIM-2's design rates in either F280 Mode (`F280ComplianceNodes.js`); the N-factor (ACH50 / N by
  zone, shielding and storeys, `VolumeMetricsNodes.js`) is read by the ANNUAL figures alone. Where both exist
  they agree in kind: on F280-1 the N-factor's rate is within a tenth of AIM-2's heating-season mean, and both
  are well under AIM-2's design-hour rate, as they should be. Our AIM-2 is NRCan's AIM2.xls to the last digit.
  - ⚠ **One inconsistency found, not changed (a calculation; it belongs to §11):** under F280 Mode On the annual
    HEATING leakage switches to AIM-2's seasonal rate, but the annual COOLING need (ISO 52016,
    `CoolingNodes.js` `leakLs`) still takes the N-factor's flow. No F280 load reads it.

**NEXT, in this order.** What is ruled and what is not: **the order inside B is Andy's ruling** of 2026-11-26.
**A1 and A2 first is ruled too** (Andy 2026-11-26: _"yes, do the F280-1 fix and the verification report
first"_), and both are done. The rest of list A is Claude's recommendation.

A. **What the claim still needs from our side** (the report's triage; none of it waits for CSA):

1. **T1: DONE (andy-rnd #28, `645784e`).** `g_112` = 5.99 m in andy-rnd's own F280-1 and in
   `tools/f280/build_case.py`. The rebuilt file is byte for byte Kieran's `F280-1.csv`; the harness is
   re-recorded and andy-rnd's `docs/f280/README.md` carries the new figures. Left as they are, on purpose: the
   Excel witness `test/fixtures/aim2-workbooks.json` and `test/aim2FromHouse.test.cjs`, where 5.53 is a typed
   input and not the case.
   - ⚠ **Seen on the way, not changed (it is a calculation; ❓ Andy and Kieran):** with S12 B.19.4 left blank,
     the height taken from S11's walls is the tallest wall plus the basement above grade
     (`VolumeMetricsNodes.js`). Where the rim joists are their own row, as in F280-1, that leaves the floor
     structures out: F280-1 would read 5.54 m against the ruled 5.99 m. F280-1 and all 45 of Kieran's files type
     the height, so no result depends on it today.
2. **T8: the first cut is SHIPPED (PR #32);** "WHAT PR #32 SHIPPED" below says what it is. What is left of it:
   - **Kieran's review** (Cl. 8.3.2 a) – b)). **Sent to him 2026-11-27 on andy-rnd#27** (Andy: "yes, send it to
     Kieran on #27"): F280-1's sheet, with the question below. The printed PDFs (6 pages each, Target and
     Reference) and the comment as sent are in the private folder, `QO_run_2026-11-26/reports/`.
   - **The one field the sheet marks "not carried": the interior shading category** (Table E.1 field 21;
     Figure D.1's notes 3 – 4 ask that it be recorded). OBJECTIVE has no such input: a window's summer shading %
     is its one shading input. Giving it one is a calculation change (Table 4's factor), so it belongs with
     §11, after Kieran signs. ❓ Kieran: a divergence to list, or a blocker?
   - S21's record of the building and the designer is empty on F280-1 (an archetype has no address). Andy's
     own name, company and contact go in F.34 – F.58 before a sheet is issued for a real project.
3. **T2:** a build stamp on the page (the footer reads "OBJECTIVE 4.0 dev"; the run is identified by its tag).
4. **T9:** Andy's signed qualification statement as the operator (Cl. 3.1). His.
5. **F280-1's garage walls and headers split out** at their own Annex I values, on the new Garage facing. Waits
   for Kieran's reading of the plans.

B. **THEN, each on its own branch cut from `main` (RULED, Andy 2026-11-26):**

1. **F280 Mode: gains to the heat balance only** (§11 is the plan, read it whole first). It changes the
   calculation engine. The validation review it waited for is done. Nothing of it is built.
2. **The Easy / Expert stub: LIVE (PR #37); the Cell IDs, Help and accounting style: LIVE (PR #38).** The pill after Copy from Target, the page
   launching in Easy, the spreadsheet's column letters gone in both modes, nothing else hidden yet.
   **Then section by section with Andy.** The plan and every ruling:
   `docs/workplans/REFERENCE-MODEL-EXPLAINED.md` Part 2.
3. **An opening's W × H comes across on Apply Selected** (REMAINS 5).
4. The rest of REMAINS 3 – 6, and Andy's list of CSS and UI nits from his smoke (he called it a later arc; the
   list is his, not yet written down).

**The order, RULED (Andy 2026-11-27):** A1 and A2 are done; **the Easy / Expert stub (B2) came next, ahead of
§11 (B1)**, and is built. The stub touches no calculation while the verification is open; §11 changes the engine
and waits for Kieran.

Why A is recommended first: Andy's own statement of the priority, 2026-11-26 (a priority, not a ruling on list A): _"F280 on means, a user gets what F280 requires for the heating and
cooling system peak design loads, that is the critical path today and tomorrow. UI niceties and calculation
futzing can happen after we validate compliance."_

**WHAT PR #32 SHIPPED** (2026-11-26 / 27, merged on Andy's word for the night, smoked by Claude):

- **The F280 calculation summary sheet** (CSA F280-12 Cl. 7.1 a): "a list of the input data contained in the
  Heat loss and gain calculation summary sheet shown in Annex D"; Table E.1 numbers the same fields 1 to 64).
  Andy's shape for it: _"If we make our own version of this form, it should be a popup/modal or open in a new
  tab and use the browser's print functionality, no fancy add-ons"_, _"With the button to produce it in S21"_.
  - **S21 F.0I "Open the sheet"** builds it for the model on screen (`src/core/F280Summary.js` `build()`), leaves
    it in `localStorage` and opens **`f280-summary.html`** in its own tab (`js/f280-summary.mjs` draws it; §11
    of `obstyles.css`). The browser prints it, or saves it as PDF. It calculates nothing.
  - **Every one of the 64 fields is on it**, each as one of: a value with the place it is entered; **"not
    entered"** (ours to hold, left empty); **"not carried"** (one field, the interior shading, with what
    OBJECTIVE holds instead); or "not needed" (the sheet's spare style lines). It never invents a value.
  - The envelope "styles" are S11's rows grouped by construction (the same RSI and the same applied assembly),
    doors by U, windows by U and SHGC. After the 64: the qualification, the further inputs the calculation
    used (AIM-2, BASESIMP, the volume), **the schedule of every envelope row and opening**, the design loads.
  - **Its first page is the summary sheet laid out as Annex D's Figure D.1, one page (PR #33;** Andy 2026-11-27:
    _"Can we mirror the sample report page as CSA formatted it, and then append any extra pages needed so we do
    not diverge so far from what building officials are used to receiving?"_**).** The same thirteen blocks in
    the same places, the same labels, entries in blue, a line left empty where nothing was entered. Each field
    has a `short` line for it (`F280Summary.js`); a group with more styles than the form has lines says so on
    its last line. Everything listed above follows it as **the supplement**, from page 2.
- **S21's record, F.41 – F.58:** the 18 fields the sheet asks for that no other section held (client, address,
  site, lot, postal code, the drawings used, front facing and whether assumed, whether the air tightness is
  assumed, attachments, notes, the designer's address and contact). Per model, saved with the project, in no
  calculation. F280 Mode Off hides them with the rest of S21.
- **Three faults in S21's text fields, fixed** (they predate the sheet; found by its witness):
  - a typed value starting with digits was shown and then stored as a number ("496 Fake Street" → "496.00",
    project no. "0402-96" → "402.00"): `DOMBridge.js` `FORMAT` now holds S21's text fields as `raw`;
  - opening a file read the Target's text as a number the same way: a field flagged `text` is kept as typed
    (`FileHandler.js`, both import passes; `Section21.js` `getFields`);
  - a file without the columns kept the previous project's record: `FileHandler.js` `addedDefaults`.
- **Known and left:** an empty Reference field shows the Target's text (every Reference input does this:
  `ComputationIntegration` `populateReferenceModel`). The print is the one-page sheet plus 4 – 5 sheets of
  supplement, portrait; its `@page` is in the page's own head because `@page` cannot be scoped and OBJECTIVE's
  report is landscape.
- **Witnesses:** `test/witness/f280-summary.cjs` (ALL PASS, 26 checks, and the print PDF by Chrome); Kieran's 45
  files give the tagged results unchanged (35 476 values, only the run's time, commit and branch differ);
  parity against V3 2146 / 2146 on all 16 cases (+18 fields only here: the record); `garage-facing.cjs` and
  `display-format.cjs` as before. With #33 the witness has 29 checks: the form comes first, holds Figure D.1's
  thirteen blocks, and prints alone on one page.
- ⚠ **An eighth way `src/` differs from andy-rnd** (the list is further down): the sheet and the record.

**WHAT PR #30 SHIPPED** (merged on Andy's word after his smoke):

- **The runner, `test/witness/f280-run.cjs`** (its README entry says how to run it). It opens each case file in
  a fresh context as the page's Open does, and records loss and nominal gain with their terms for the Target and
  the Reference, plus an import check. It holds no case input and no reference value.
- **The Garage facing** (Andy: _"we should make these tweaks for garage walls as a new type ... It need not be a
  new row per-se, but a new facing type from the dropdown"_). In S11 it is the small unlabelled dropdown beside
  a wall row's type (N … Avg, **Garage**); roof and floor rows hide it.
  - **Heating: unchanged.** The wall is in the air-facing loss at its own RSI (F280 Cl. 4.3, Cl. 5.2.2 Note 1;
    SB-12 3.1.1.1.(5)).
  - **No solar**, the wall's or through an opening hosted in it (the opening takes the facing, as it takes any
    host's): S10's gain factor (`RadiantGainsNodes.js`), the ISO 52016 irradiation and sky term
    (`CoolingISO52016.js`, `CoolingNodes.js`), F280's design solar (`F280ComplianceNodes.js`).
  - **F280 Table 3:** the wall, and a door hosted in it, take the "interior partitions and fully shaded exterior
    walls and doors" row. A door elsewhere keeps the compass mean, so no existing result moves.
  - The hover is Andy's wording (`Openings.js` `GARAGE_NOTE`): NBC 2020 9.36.2.4.(4) and 9.36.5.10.(4).
    **No RSI is changed**; the Reference's code-minimum RSI is not reduced by NBC's 0.16.
  - S19 draws an opening in a garage wall on no facade (`wombatWindows.js`).
  - **Witnesses:** `test/witness/garage-facing.cjs` (ALL OK, the Table 3 figure by hand); Kieran's 45 files give
    the tagged results unchanged (20 330 figures); parity against V3 2146 / 2146 on all 16 cases.
  - ⚠ **A seventh way `src/` differs from andy-rnd `74bd575`** (the list is further down). andy-rnd does not
    have the facing.
  - On Kieran's Archetype 3 and 4 files, as a diagnostic, it lowers the nominal gain a little and leaves the
    loss alone; all 16 stay inside the band. His files are not reissued on it.

**WHAT THE SESSION ESTABLISHED** (for whoever picks this up; the figures are in the private report):

- **The run.** All 45 files load with no page error and no row missing. The base case reads the loss Kieran's
  own import test gave. All 13 variants are inside the band applied to the change. The V3 page (andy-rnd
  `74bd575`) gives identical figures, 270 of 270.
- **I19.** The gap behaves as air leakage: it appears only where an ELA10 is typed, and raising Archetype 3's
  ELA10 by 5 % closes all four. That is a diagnostic, never an input to adopt.
- **CSA's current copy** is CSA F280:12 (reaffirmed 2025), "Revised October 2025". Its one new Revision History
  entry is the cover, the National Standard of Canada text, the title page and the preface: nothing technical
  after Update No. 3 (March 2023), which is what Andy's own PDF holds. The misprinted row and the shared ELA10
  are printed there as in ours.
- **The Standard is readable by tools after all**, through the CSA OnDemand viewer in Andy's Safari (the PDF
  itself is not). The tool and its README (URIs, page map) are in the private folder, `tools/csa-viewer/`; Andy
  signs in again when the session has expired; captures are deleted after reading.
- **Garage walls in the codes:** F280 as above; SB-12 3.1.1.1.(5) treats the wall to a storage garage as
  exterior; NBC 2020 9.36.2.4.(4) allows 0.16 off the required RSI and 9.36.5.10.(4) gives it no solar.
- **The OBC makes F280 mandatory:** Div. B 9.33.4.1.(1)(b) and 9.33.5.1.(3) (2024 Code); NBC 2020 9.33.5.1.(1).

**Where the private material is: `~/Documents/OpenBuilding/KT F280 Validation Runs/`, ON THE LAPTOP ONLY** (in
no repo, so not on the desktop unless Andy copies it). **On the desktop** (`hostname` = `iByte-M2-Pro`) the
folder, Excel and the CSA session are absent: T1's build and re-record and T8's plan can still be done there,
but T1's comparison with Kieran's file and anything needing the results cannot; say so to Andy, do not guess. **RULED (Andy 2026-11-26, "yes, keep the data out of the
public repo"):** the case files, the Annex J values and every result stay out of this repository and out of its
issues, which are public; anything quoting them goes to andy-rnd (private).

- Kieran's issue: `F280_RTM_r1_2026-11-26.pdf`, `F280_model_specification.md`, `F280_case_inputs/`, and his note
  `Objective 4.0 Requirements Matrix.txt` (our reply, the addendum and the CSA draft are appended to it).
- `QO_run_2026-11-26/`: `QO-F280-RUN-01.md` (**read this first**), `f280-results.csv` / `.json`, `diagnostics/`
  (the I19 scans, the Garage-facing effect, the AIM2.xls witness).
- `tools/csa-viewer/` and `tools/aim2-witness/`, each with a README.

**A deploy that fails on "No artifacts named github-pages":** do not re-run it (the re-run uploads a second
artifact and fails again). Start a fresh run: `gh workflow run deploy-pages.yml --ref main`. Seen on #30's merge.

**How to work here (a cold start needs these):**

- This repo's `CLAUDE.md`: a merge to `main` redeploys Pages, so merge only on Andy's word in the session; one
  branch = one PR. The memory for this work is `~/.claude/projects/-Users-andrewthomson-Documents-OpenBuilding/memory`
  (its `MEMORY.md`), current as of this handoff; it syncs by git, so pull it at the start of a session.
- **Run `hostname` before naming the machine** (`M2max` is the laptop, `iByte-M2-Pro` the desktop). Excel, the
  CSA viewer session and the private F280 folder are on the laptop.
- **Three repos, all under `~/Documents`:** `OpenBuilding/OpenBuilding` (this one: the site); `OpenBuilding/andy-rnd`
  (V3, the parity reference and where Playwright is installed); `ABCD.EARTH` (the Builders' SOURCE,
  `artex-osx/docs/mockups/`: edit a Builder page THERE on a branch, its pre-push gate runs ~5 min, PR to
  `arossti/ARTexplorer-private`, then `npm run builders:publish` here AFTER the commit so `BUILD.json` names it).
- **Serve and test:** `test/witness/README.md` (new today) has the servers, the five probes and what each must
  show. After a big CSS/JS change use a new port: Chrome caches stale modules.
- **The Builder computes, OBJECTIVE receives** (§10.2): never derive an RSI, U or carbon figure from layers here.

**REMAINS** (Andy's numbering of 2026-11-26; 1 and 2 are done on PR #28, the older detail of 2 – 4 is in the
items further down):

1. **REFERENCE / TARGET INDEPENDENCE.** Andy 2026-11-26: _"because of our Ref/Target independence rule, a user can
   and may set a different assembly in the Reference model or the Target as a comparison. Often users will set
   AS-IS values for renovavation models, and then the target model only adds to that, or in other cases we may wish
   to test a high carbon steel or concrete building as the reference model against a Target model that is all mass
   timbe (low carbon) to compare the tow - so be sure we did not block that with reference model reads or locked
   assemblies in S10 or S11."_
   - **✅ THE BUILDERS — BUILT on `Reference-Independence`, to be smoked by Andy** (he asked for it the same day:
     _"Let's fix it now"_). It had been blocked by today's own code, not by V3 (S11's Reference cells are editable).
     Now `js/objective-builders.mjs` reads and writes THE MODEL ON SCREEN (`pre()` / `getM` / `setM`, V3's `ref_`
     prefix): a row's assembly is `ca_<row>` in the Target and `ref_ca_<row>` in the Reference, Apply writes
     `f_` / `g_` or `ref_f_` / `ref_g_`, the row IDs are live in both models, a typed value clears that model's
     link only, and S05's E.3.5 is each model's own tally. Saved and restored for both (`Openings.addedFields`
     lists a row when EITHER model has one; a `ref_` key imports without a field). **Copy from Target**
     (`followMirror`): V3's mirror copies only the fields FieldManager lists, so where it carried the Target's value
     across the Target's assembly follows, and a Reference row whose value is no longer its assembly's forgets it.
     Also changed: an applied RSI is stored at 2 decimals, as the Builder shows it and as V3 stores a typed one.
     Witness `test/witness/builders-reference.cjs`: Target `Wa | R36 2x6` (RSI 5.72, E.3.5 29.92 kgCO2e/m²) against
     Reference `Wa | 203mm Concrete` (0.25, 48.81) on B.5, and a certified window against an aluminium one on
     B.8.1; another project clears both, the saved file returns both, Copy from Target → All Inputs carries the
     Target's across. The other three Builders witnesses and parity (2146 / 2146) still pass.
   - **✅ S19 — BUILT on `Reference-Independence` (2026-11-26 night), to be smoked by Andy.** Andy, same message:
     _"Presently S19 shows whatever in Reference mode as was set in Target, they should maintain independence,
     whatever a user may have changed on the Reference or target side inputs."_ What was wrong (V3's code, so
     andy-rnd has it too): the aspect slider's handler wrote `d_154` whatever the model, so an edit in the
     Reference moved the Target's footprint; Roof type and Windows are not graph inputs, so a model switch left
     the other model's choice showing in the dropdowns; `wombatRender.js` read the Target's Windows show / hide
     for both drawings. Now `Section19.js` writes the model on screen (`onScreenKey`) and `stampOwnControls`
     restamps the two dropdowns on a switch and after each stamp; the drawing itself already solved per model.
     Witness `test/witness/s19-reference.cjs`: the Reference takes a hip roof, aspect 2 and hidden windows; the
     Target keeps its gable, −2 and windows, its SVG identical to the byte; the saved file returns both.
   - **✅ CHECKED, nothing to change:** andy-rnd's `ghostedReference`, `referenceDefaults` and
     `hoverOnScreenModel` specs pass on this page (8 / 8; adapted to its start-up and kept in
     `test/witness/v3-reference/`). S10, S11 and `Openings.js` read through: every state read and write there
     goes through the mode-aware helper or is a deliberate both-models write.
   - **STILL OPEN:** S21 (Andy: _"may show the Reference model vs. Target model, I have not considered that case
     yet"_, ❓ his).
2. **✅ `m_10` "Unavailable" after Trust — FIXED on `Reference-Independence` (2026-11-26 night), to be smoked.**
   - **What it was:** the REFERENCE went Unavailable (`e_10`; `m_10` inherits it). An opening's host (`ch_` + its
     row) left empty in the Reference took the Target's, so Trust's Target-only write hosted the Reference's
     159 m² South window in a wall the Reference holds at 0 m², and that wall had no area left.
   - **The fix:** the host is per model (`TransmissionLossNodes.js`: class C, `copyToReference: false`), as S11's
     dropdown and `Openings.add` already treat it.
   - **Witness** `test/witness/host-per-model.cjs`: after the write the Reference is 190.1 with no hosts, the
     Target 82.8, `m_10` 49 %; the saved file returns each model's hosts; Copy from Target → All Inputs carries
     them across. Parity 2146 / 2146.
   - **Left as it is:** an opening's H (`dh_` + its row) is still class G (the Reference takes the Target's when
     its own is empty); no failure seen.
   - **RULED (Andy 2026-11-26, "yes"):** Trust writes the Target only, and says so: both buttons' hovers, the status line and the Trust + Verify modal's title name the Target model.
   - **Also on this branch (Andy's smoke, 2026-11-26 night):**
     - **A typed number keeps its format across a model switch.** `DOMBridge.stampInputsForMode` stamped the
       stored value raw, so 48 inputs on the default project changed after a switch (S04's bill 132,938.00 →
       132938, a U-value 0.900 → 0.9, $0.1300 → 0.13). It now formats as `stampAll` does.
     - **S21 rounds its mirrored numbers for display** (`Section21.js` `displayText`): a U-value at 3 places,
       any other number at no more than 2. The graph and the saved file keep the full value. So S21's U-values
       and its long decimals no longer match V3's page character for character.
     - Witness `test/witness/display-format.cjs`.
   - **⚠ FOUND, NOT CHANGED — F280 Mode On drops a model's annual electricity** (Andy's Collingwood question).
     The finding, the numbers, Andy's ruling and the plan are §11.
3. **ABCD BUGLIST #266** (item 5): until it is fixed the Assembly Builder here is the 2026-10-22 library, 115
   assemblies, with the old blue accent and month-old baked HFT.
4. **A light mode** (item 6, second tier).
5. **From §10, RULED by Andy 2026-11-26 (_"Yes on 2/3"_), none started:**
   - **YES — isotherms baked for the Section and Opening Builders** (never built; ABCD.EARTH work: a fixture written
     by the app's solver, as `hft-fixture.json` is for assemblies, and an Isothermal View in each page).
   - **YES — an opening's W × H and an SHGC come across with its U** on Apply Selected. The message already carries
     `w_mm` and `h_mm`; they would go to the row's W and H (`dl_`, `dh_`) and its S10 twin's area, as
     `pdf-bridge-import.mjs` `writeEnvelope` does. The Opening Builder computes NO SHGC today: that is ABCD.EARTH
     work first, then S10's SHGC.
   - **NEVER — E.3.5 as E.3.2's source.** Andy: _"E.3.5 should never be chosen as E.3.2's source because
     Typology-based caps are set by Standards like Toronto's TGS4, etc."_ E.3.5 stays a row that nothing reads.
6. **The port's own open items**, §8 and §9.2, unchanged today.

Local servers (they die on reboot): `python3 schema/scripts/nocache-serve.py 8831` here, `node test/static-server.cjs 8791`
in andy-rnd for the V3 page.

**SHIPPED 2026-11-26 (all merged):**

- **PR #30 — F280 validation**: the operator's runner and the Garage facing for S11's wall rows (above).
- **PR #28 — Reference-Independence**: the Builders, S19 and an opening's host wall are each one per model; S01's
  `m_10` no longer reads "Unavailable" after Trust, and Trust names the Target model; a typed number keeps its
  format across a model switch and S21 rounds its mirrored numbers for display; two documents,
  `docs/workplans/REFERENCE-MODEL-EXPLAINED.md` and §11. Detail: REMAINS 1 and 2 below.
- **PR #24 — OnePage**: every section a card in one container, one + / − for all, the sidebar scrolls, the browser
  prints the report (landscape, V3's disclaimer page and footer of logos last); the launch modal and the yellow
  Disclaimer button; only S01 open at launch; a subtitle on every section. Detail: item 1 below.
- **PR #25 — Styling-Tweaks**: the print footer's logos; the Opening Builder on the homepage; the Section Builder's
  plan fills (ABCD.EARTH #1032). Detail: item 2 below.
- **PR #27 — §10 B5**: S05's E.3.5, the embodied carbon of the assemblies applied in S11, in a row of its own
  (running tally, then the sum); `test/witness/` and this handoff.
- **PR #26 — the Builders inside OBJECTIVE, §10 B1–B4**: S11's row IDs open the Assembly Builder (opaque rows) or the
  Opening Builder (doors, windows, skylights) in a popup; Apply Selected writes the row's RSI or U; what was applied
  is saved with the project; the button row's project name is S02's B.2 (ABCD.EARTH #1033, #1034). Detail: §10.

- **PR #22 — the V4 table format** (`obstyles.css` §8b; captions in `src/sections`): a row is one line, an input box a
  fixed 28 px, S11 fits a 1440 px window with its Surface (°C) column in view and its dropdowns grow past that, the
  sidebar's S01–S22 show without scrolling, every header's unit in brackets in its own case, + and − side by side,
  ARTexplorer's sliders and pill toggles (`artex-web/art.css`) in cyan.
- **PR #23 — the Reference Port**: Target · pill · Reference in the button row and a Copy from Target menu
  (`objectivepro.html`, `js/objective4.mjs` `showModel` / `syncModelToggle`, driving V3's `ReferenceToggle.switchMode`);
  the Reference look is `obstyles.css` §8c, all from `body.reference-mode` (the accent below the masthead turns red, a
  band names the model, locked cells are ghosted); S16's Cooling and Show Emissions work in both models; S18's and
  S19's control rows are one line; the Sankey's labels are light. The HUD and Key Values take no marker (they show
  both models, as S18 does).
- **V4-5 — F280-1 hosted** (andy-rnd #26, `74bd575`): §4. The F280 harness and cases stay in andy-rnd.
- ⚠ **`src/` now differs from andy-rnd `5e0b2f0`** in two ways, both to keep if a file is copied over again: the 51
  header captions with bracketed units (`src/sections/*.js`), and `Section16.js` `initializeEventHandlers` wiring once.
  A third since (§10 B3): `ca_<row>` in `src/core/Openings.js` `addedFields` and `src/core/FileHandler.js`.
  A fourth (REMAINS 1): S19's own inputs per model, `src/sections/Section19.js` and `src/core/wombatRender.js`.
  A fifth (REMAINS 2): the host input's class in `src/sections/nodes/TransmissionLossNodes.js`.
  A sixth: display formats, `src/core/ui/DOMBridge.js` `stampInputsForMode` and `src/sections/Section21.js`
  `displayText`.
  A seventh (2026-11-26): the Garage facing, `src/core/Openings.js`, `CoolingISO52016.js`, `wombatWindows.js`,
  `src/sections/Section10.js`, `Section11.js`, `nodes/RadiantGainsNodes.js`, `nodes/CoolingNodes.js`,
  `nodes/F280ComplianceNodes.js`.
  An eighth (2026-11-26): the F280 summary sheet, `src/core/F280Summary.js` (new), `src/sections/Section21.js`
  (F.0I, F.41 – F.58, the `text` flag), `nodes/F280ComplianceNodes.js` (the record's inputs),
  `src/core/FileHandler.js` and `src/core/ui/DOMBridge.js` (text kept as text; the record's defaults).
  A ninth (2026-11-27, the Easy / Expert stub): the header rows of `src/sections/Section02.js`, `03`, `05` – `09`,
  `12` – `15` and `19` without their 80 column-letter captions.
  An eleventh (2026-11-27, PR #39, and #41 for W.2.W and G.7.0): the renumbered IDs and two S15 captions, in
  `Section02.js`, `03`, `07`, `10`, `12` – `15`, `16C.js` and `src/core/Openings.js` `s10RowId`.
  A tenth (2026-11-27): `src/core/FieldManager.js` `markCellId` (the class `cell-id` on a Cell ID outside the ID
  column, a row's repeat of its own ID left undrawn, `static-number`) and `markNumberHeads` (`num-head` on a
  caption over a column of numbers).

**The day's items as they were worked** (✅ = shipped; the unticked ones are REMAINS, above):

1. **ONEPAGE — ✅ PR #24, smoked by Andy.** Andy 2026-11-26: _"each page gets a S18
   title which is then duplicated in the radiused, collapsible header ... We will keep the radiused, collapsible
   headers, add the subheader text to them ... then we can move ALL collapsable header sections into one container
   instead of each one getting its own container. Then it will function like V3, where we can toggle ALL sections
   On/Off with the same +/- button to the far right of the main header, and then the masthead menu will just anchor
   scroll to the relevant section. This will let us use the browser's print function to print all sections, like our
   V3 does, as a formatted report. We lean 100% on the browser's print functions. Nothing fancy."_
   - **What is there:** `js/objective4.mjs` `renderContentShell` builds ONE `.op-onepage` holding 22 cards
     (`sectionCard`: the radiused, collapsible header carries the name and, where `PANEL_SUBTITLES` has one, the
     subtitle; the page title is gone). `#op-toggle-all` at the far right of the button row is − (collapse all) / +
     (expand all), and keeps the section being read at the top. The sidebar's S01–S22 scroll to their card and open
     it (`setActiveTab`); scrolling marks the card at the top (`updateActiveFromScroll`); a page opened at `#section`
     returns to it once the sections above have filled in. Print is `obstyles.css` §8d, one `@media print` block, as
     V3: landscape, 0.25 in margins, ink on white with colour kept, the chrome, buttons, the S01 intro and S20 Notes
     left out, the page scaled 0.8 to the sheet's width.
   - **Witnessed:** parity 2146 / 2146 on all 16 cases (WebKit, this page vs andy-rnd's); S16–S19 activate at full
     width inside the one scroll; the default case prints on 9 landscape Letter pages (Chrome's PDF), and in WebKit's
     print rendering nothing runs off a 1008 px sheet.
   - **After Andy's first look (same day):** S01's introduction moved into `#disclaimerModal` ("Using this
     calculator", V3's modal and its disclaimer text at 4.0), shown on the first launch (`localStorage`
     `objective4DisclaimerSeen`, as V3's `disclaimerSeen`) and from the masthead's yellow Disclaimer button. On
     launch only S01 is open; the sidebar opens a section and it stays open until closed. Every section has a
     subtitle (`PANEL_SUBTITLES`, Claude's wording, Andy's to edit). Print shows every section, open or collapsed
     on screen (Bootstrap's `[hidden]` is `!important`, so the print rule is too). S20 is out of print only.
   - **The printed disclaimer:** V3's `#print-disclaimer-page` and its print rules, copied verbatim from andy-rnd
     (585 words, checked identical), is the report's last page(s); it differs from the modal's text, as in V3.
     The default case prints on 11 landscape pages: 9 of sections, 2 of disclaimer, licence and credits.
   - **The modal is wide** (up to 1280 px, tight spacing) so its whole text shows without scrolling: measured in
     WebKit at 1920×1080 down to 1024×768.
2. **THE OPENING BUILDER on the splash page — ✅ PR #25.** `publish_builders.py` (ABCD.EARTH #1032, merged) has it in `PAGES`: rebuilt from today's seed,
   its six-face witness passing (33 certified sides), `openings.json` in the seed stamp. `builders/opening-builder.html`
   is published and `index.html`'s sixth tile opens it (13 openings).
3. **Reference remainders:** S19's own Reference display; S21 (Andy: _"may show the Reference model vs. Target model,
   I have not considered that case yet"_ — ❓ his); andy-rnd's `ghostedReference`, `referenceDefaults` and
   `hoverOnScreenModel` behaviours checked on this page.
4. **m_10 "Unavailable"** after Trust on a 4-opening fixture: ✅ fixed, REMAINS 2 above.
5. **ABCD BUGLIST #266**, so the Assembly Builder is rebuilt from today's seed.
6. **SECOND TIER — a LIGHT MODE** (Andy 2026-11-26: _"switches the screen to white, and the headers to black/grey like
   the V3 (for familiarity). Dark/Light mode can be another header toggle."_): a second pill in the button row, one
   body class re-pointing the tokens (`tokens.css` neutrals; `obstyles.css` `--bg-*`, `--text*`, `--border`), so §8b /
   §8c follow. Check then: the Sankey's forced-light labels, the input box's sunken fill, the slider track, Reference
   red on white.

7. **THE BUILDERS INSIDE OBJECTIVE — ✅ B1–B4 in PR #26; B5 in PR #27.** The plan and what was built
   are §10.

**What is where:** OBJECTIVE = V3's engine + sections verbatim in `src/` + `climate/` (from andy-rnd `5e0b2f0`);
`js/objective4.mjs` (router, HUD, cards), `js/objective-boot.js` (V3's init.js start-up), `obstyles.css` §8b (V4
styling of V3's markup). Trust = `js/beam/pdf-bridge-import.mjs` (`V3_TARGETS`, `envelopeByFacing`,
`writeEnvelope`). Take Off, Eh! = `js/app.mjs` (Door tool [E], the summary table's Facing + Preset columns).

**Witnesses to re-run after any change** (Playwright, fresh context each): (a) all 16 case studies through Load
Sample vs andy-rnd's V3 page — 2146 / 2146 displayed values each; (b) the Trust fixtures in this file's §0 blocks.
Serve: `python3 schema/scripts/nocache-serve.py <NEW port>` — after big CSS/JS changes use a new port (Chrome
cached stale copies on 8796, Andy saw a narrow page). andy-rnd for comparison: `node test/static-server.cjs 8811`.

**Shipped in PR #21 (earlier the same day)**

- The EC Matrix, EPD-Parser and CCLIMB deleted (pages, code, CSS, docs); BfCA branding → OpenBuilding.ca; the
  BfCA-era workplans deleted (`WORKPLAN-TEMPLATE.md` keeps their format); `bfcastyles.css` → `obstyles.css`.
- Logos as SVG: the OpenBuilding house (`graphics/ob-*.svg`) and OBJECTIVE (`graphics/objective-*.svg`, Quicksand).
- The PDF-Parser → **Take Off, Eh!** (`takeoffeh.html`, code name `TakeOffEh`).
- The BEAM page → **OBJECTIVE 4.0** at **`objectivepro.html`** (was `beamweb.html`); its Introduction describes v4.
- The Builders from ABCD.EARTH in `builders/` (§5.2): Materials and Section Builder from today's seed; Assemblies as
  a snapshot of 2026-10-22 (ABCD BUGLIST #266), which passes the app's own cross-check.
- One set of design tokens for every web page, cyan on the web (§6).
- This plan moved here from andy-rnd (andy-rnd #25 merged, `5e0b2f0`: a pointer there).

**Remaining before a PR**

- The BfCA / NRCan / MCE references (Andy 2026-11-25: _"Yes delete all NRC and BfCA and MCE references, we will not
  use any of that at the end."_): ✅ code, config, CLAUDE.md (rewritten), README, workplans, the Glossary, the three
  `docs/*(Jacob)/` folders; the IndexedDB store renamed `openbuilding` (a one-time migration carries saved Take Off,
  Eh! sessions across). ❓ LEFT: the material catalogue itself (`schema/`, `docs/csv files from BEAM/`), BfCA's data
  — 821 `$schema` links, 264 provenance notes ("BfCA BioC calc by mass"), BfCA ids and names; it feeds `database.html`.
- ABCD BUGLIST #266, so Assemblies is rebuilt from today's seed.

**Next: the port, §9.**

### The plan's status as written (andy-rnd, 2026-11-25)

- **v3** = objective PR #134 at `071f25a`: the live site plus the F280 package, nothing else (#134 was reset there
  2026-11-25 after the hosting had been pushed onto it; Mark told on #134).
- **v4's start** = andy-rnd `main`: S11 hosting (#23, `d12c8d2`) and its polish (#24). Both still let a window sit
  in no wall and a wall face "Average"; v4 takes those away (§2).
- **FROZEN** (Andy 2026-11-25: _"We'll freeze V4 where it is now on RND"_): nothing of V4-1+ is built until he
  reopens it. Its state is andy-rnd #24 (`s11-hosting-polish`), served at http://127.0.0.1:8791 on the laptop.
- **The fastest way in is the PDF-Parser** (Andy 2026-11-25: _"the PDF parser becomes the fastest input method
  available to us"_): see V4-7. **The repos combine** and v4 deploys to GitHub Pages: §4. The OpenBuilding repo's code is Andy's / OpenBuilding's to reuse here.
- **NEXT when reopened:** Andy's porting workplan, then §5's answers, then V4-1.

### What OBJECTIVE 4.0 is

**OBJECTIVE Pro = v4, in two forms:** the ABCD.EARTH app (macOS / Linux, native, the whole engine) and this web
app (for PC users, the concession: a subset). Andy 2026-11-25: _"Pro refers to both the Web App and the Rust app. Pro=V4. The user may use the app in OSX/Linux, but many users are still PC users, and for them we have the web app. It is not expected to do everything the native rust app can, but it is the concession we make."_

Andy 2026-11-25: _"OBJECTIVE pro lives in the ABCD.EARTH desktop app, but this web version extends what the old V3
of OBJECTIVE can do with many shared methods."_ v3 stays the live, static/monthly one-zone modeller on Cloudflare
(objective.openbuilding.ca); v4 is its web successor here, the bridge to hourly analysis, ASHRAE 140 and ABCD.

### What it is NOT

- Not everything the native app does: the hourly engine and real geometry live in the ABCD.EARTH app
  (`artex-osx/docs/architecture discipline/ABCD-OBJECTIVE-PRO.md` in that repo); the web app is Pro's PC
  concession, reached through the shared methods (§6).
- Not a place to curate materials: the Builders here are read-only (Andy 2026-11-25: _"we do not expect a user to
  curate materials, it is too fraught, as EPD and cost sources are required"_).
- Not a second copy of any method (§6).

### Where to pick up next (cold-start one-liner)

**P0 ✅ 2026-11-25 (laptop):** the S01 heads-up display rides the masthead (T.1 / T.2 / T.3 × Reference · Target ·
Actual · %, each cell tagged `data-kv="e_6"` … for the engine to stamp; a click opens S01, which carries the same
table full size); the sidebar is S01–S21 plus **S22 the Glossary** (Andy: _"we should keep the glossary but expand to
include our terms also"_ · _"that can form a new section after 21"_), its 15 OBJECTIVE terms chip-marked for Andy to
correct; every BEAM tab deleted (Footings & Slabs and its helpers, Energy GHG, the xlsx import); Load Sample fills
PROJECT only. Live: S01, S02, S17, S22; the rest show "arrives in P2/P3".
**S01–S21 LIVE ✅ 2026-11-25 (`16babb8`)** (Andy: _"keep adding sections please, as faithful to the values and order
of the V3 format, but styled per V4"_): V3's engine + sections (`src/`, `climate/`, from andy-rnd `5e0b2f0`) load in
V3's order; `js/objective-boot.js` stands in for `init.js`; each S-panel adopts its V3 section; `src/styles.css` is
rethemed by `obstyles.css` §8b. Case 01 gives the full V3 app's key values (190.1 / 93.1 / 93.1 / 49 %). This
replaces P1–P3's piecemeal port (the spike below stays as the record of why the page code matters).
**V4 STYLING + S02 + LOAD SAMPLE ✅ 2026-11-25:** each section in the PROJECT form's card, no grid, full width
(Andy); S02 is V3's S02 alone (Andy: _"Everything below project data and any BEAM defaults can be removed from S02
entirely. S02 assumes the default data in V3's S02."_); Load Sample is V3's modal and loader (Andy: _"loads our Case
Studies exactly as V3 does, with F280 sub-rows"_); Open / Save are V3's CSV import / export; Reset is V3's "back to
the last loaded project". Witness: all 16 case studies, loaded through the modal here and in andy-rnd's V3, give
2146 / 2146 identical displayed values each.
**TRUST → S02 / S11 / S12 ✅ 2026-11-25** (Andy: _"S11, S12, and 'Conditioned Area' as the sum in S02 of all
interior plan spaces"_): `js/beam/pdf-bridge-import.mjs` `V3_TARGETS` — h*15 ← every floor plate (foundation +
above-grade slabs, building scope); d*85 roof (× pitch); d*86 walls above grade (net of their windows); d_94 walls
below grade (perimeter × basement height); d_95 slab; d_105 volume (floor plates × S12's g_106). Written as user
entries, one recalculation; parameters from Take Off, Eh!'s sidebar. Witness (10 × 12 m house, 3 / 2.5 m, 30°):
240 / 138.56 / 34.5 / 110 / 120 / 648, exact. **Windows are not written** — S11 hosts each in a facing wall and Take
Off records no facing yet (V4-7).
**V4-7 STATUS 2026-11-25 late (laptop, Andy at 99 % usage):** ✅ Take Off, Eh! Door tool [E] (orange, door glyph; an
opening like a window). ✅ Facing per elevation sheet (sheet panel dropdown, title as hint, stored `page.facing`).
✅ Trust writes S11's walls by confirmed facing (B.5 / B.87a–i, gross area; witness West 36.00 m², TEUI recomputes).
✅ **Openings written, each in its own row** (Andy: *"calculated individually, row by row, to comply with ASHRAE 140"_;
_"add doors to the Trust process"_): host, W, H, qty on the S11 row; area (W × H) and facing on its S10 twin, as
Section11.js `applyOpeningGeometry` does. Witness: West wall + 2 windows + 1 door, North wall + 1 window → rows
B.7.0 / B.8.1 / B.8.2 hosted in 86, B.8.3 in 87a, areas 1.89 / 1.5 / 1.08 / 1.44, facings West / North.
✅ **FIXED 2026-11-26 night (REMAINS 2 in §0: the host is per model).** As found: on that 4-opening fixture S01's m_10 (Actual vs Target %, the default case is Utility Bills) reads
"Unavailable" though h_10 = 82.8; single-opening and door-only runs give 49 %. Trace before relying on Trust's %.
**✅ SHIPPED 2026-11-26 (PR #23) — the Reference model** (Andy: _"note Reference Model in the workplan so we can port that later tonight"_):
V3's Target / Reference toggle (`src/core/ReferenceToggle.js`, its header button and `body.viewing-reference-inputs`
styles) onto objectivepro.html, the HUD and every section showing Reference values when toggled, and S16's Sankey
following it (below).
**NEXT — V4-7, the facing confirmed IN Take Off, Eh!** (Andy 2026-11-25: _"maybe we let the user verify IN TakeOff -
West Elevation? Confirm..."_). Design: each elevation sheet carries a **Facing** (N / NE / E / SE / S / SW / W / NW),
pre-filled from its title ("WEST ELEVATION" → West) and confirmed or set by the user (FRONT / REAR / LEFT / RIGHT
need it set); stored on the page (`page.facing`). Trust then writes S11 from confirmed sheets only: one wall row per
facing (B.5, B.87a–i: type walls, facing, GROSS area — S11 nets its hosted openings), every window on that sheet
hosted in that row (`ch_`= the row key) with its W × H from the polygon (identical sizes grouped into`dq\_`), all 40
window rows cleared first. A sheet with no confirmed facing is listed in Trust + Verify, never guessed.
**✅ SHIPPED 2026-11-26 (PR #23) — S16 Sankey** (Andy: *"Various buttons on S16 do not reproduce the expected graphs for cooling,
emissions, etc. That will need to get properly ported at some point - and should show reference mode when
reference model is toggled."*): the Cooling / Show Emissions / Energy Balance views, the Reference model's flows,
and dark-legible labels; this page has no Target / Reference toggle yet (V3's ReferenceToggle). Serve:
`python3 schema/scripts/nocache-serve.py 8796` (`npm run stage:data` only for the local Database).

## 1. Goals

1. OBJECTIVE 4.0 on the web: every wall faces somewhere, every window sits in a wall (§4), on the BEAM page's layout.
2. The envelope from drawings: Take Off, Eh! → v4's S11 (V4-7).
3. OpenBuilding.ca's tools on one site, each method kept in one place (§6).

## 2. Reference sources

CSA F280-12 and ASHRAE 140 (the compliance targets); NBC 2025 / NECB; the OBJECTIVE v3 codebase
(openbuilding-ca/objective) and andy-rnd; the ABCD.EARTH seed (materials, prices, assemblies, junctions).

## 3. Already built (andy-rnd #23, #24)

- S11 hosts doors and windows: a wall's + window / + door (a roof's + skylight), the openings listed under it, a −
  per row; W × H × quantity sets the S10 area; the wall's area is net of what it hosts.
- Window overhangs: S10's "Overhang: above / depth" set the summer % by F280 Annex A (the plain shaded fraction);
  F280's peak gain puts only that share back at north's 93 W/m².
- The CSV writes only the opening rows in use.

## 4. What v4 changes (each a PR, in this order)

**V4-1 — every above-grade wall has a facing.** "Average" leaves the wall facing list; a new wall row starts North
and must be turned. Roofs, exposed floors, walls below grade and slabs keep no facing. A wall is what an F280
Table 3 facing and ASHRAE 140's surfaces need.

**V4-2 — every opening sits in a wall (or a skylight in a roof).**

- S11: an opening row exists only under its host. The doors' and windows' own group +/− and the "No host" choice
  go; a wall's + window / + door is the one way in, its row − the one way out.
- S10: a window row's area and orientation are read from S11 (not typable); SHGC, winter % and summer % (by hand,
  or from its overhang) stay in S10. S10 lists the rows under their wall's name ("in B.5.2").
- The wall's net area is what every calculation reads (as now).

**V4-3 — a v3 file opens in v4 without its envelope.** A v3 CSV has walls entered net and windows by orientation
with no wall, and nothing in it says which window is in which wall, so it cannot be converted. v4 imports
everything else (location, occupancy, systems, S12–S18, notes) and leaves S10's and S11's envelope rows empty,
with a banner: _"Envelope from an OBJECTIVE 3 file: enter its walls and windows. Open it in OBJECTIVE 3 to see
it as it was."_ (a link to the live site). Assembly RSIs and U-values: ❓ §5.

**V4-4 — the file says its version.** A v4 CSV carries `objective_version` = 4, so a later v4 opens its own files
whole and only a v3 file takes V4-3's path.

**V4-5 — the cases.** ✅ 2026-11-26 (andy-rnd branch `f280-1-hosted`, where the F280 harness lives): F280-1
re-expressed in V4 form - walls by facing (Table G.1.8 a)), every window and door hosted with W × H × count, each
window's overhang O and drop D, the app's own Annex A on each. It holds Annex J: loss 11 684 W (99.1 %), gain 7362 W
(100.6 %), and the 8.3.8 turns, which now turn the walls and everything hosted in them, read 99.4–102.0 % of
Annex J's change (93.7–95.8 % before). Andy 2026-11-26: _"V3 will just ignore fields it does not have in the .CSV format"_. Other case studies are re-entered from their drawings as Andy has time; until then the Load Sample Projects
list shows only the v4 ones.

**V4-6 — say it is 4.0.** The header and the CSV both read OBJECTIVE 4.0.

**V4-7 — the envelope comes in from the PDF-Parser** (arossti/OpenBuilding `pdfparser.html`). It already measures
walls on the drawings with their windows attached and reports each wall gross and net; its CSV nests the windows
under their wall (`sample csv exports/pdf-parser-measurements.csv`). Two additions there, then one import here:

- the parser's export gains each wall's **facing** (a user picks it per elevation sheet) and each window's **W × H**
  (from the rectangle it already draws; today it exports the area only);
- v4 imports that file into S11: one wall row per wall (facing, area), its windows hosted under it (W × H). A v3
  project's drawings re-measured this way is how an old project reaches v4 (V4-3).
- With the repos combined (§4), the import can read the parser's own data directly; the file stays the contract.

## 5. The site around it

### 5.1 The start page (`index.html`)

| Card              | Page                                     | State                                                           |
| ----------------- | ---------------------------------------- | --------------------------------------------------------------- |
| Take Off, Eh!     | `takeoffeh.html`                         | live (the PDF-Parser renamed)                                   |
| Materials         | `builders/material-builder.html`         | published, read-only                                            |
| Material Database | `database.html`                          | kept for its look until Materials replaces it (Andy)            |
| OBJECTIVE         | `objectivepro.html` (was `beamweb.html`) | v4 Alpha: the BEAM layout, being repurposed as v4's inputs (§9) |
| Assemblies        | `builders/assembly-builder.html`         | published as a snapshot of 2026-10-22 (ABCD BUGLIST #266)       |
| Section Builder   | `builders/section-builder.html`          | published                                                       |

### 5.2 The Builders are build output from ABCD.EARTH

`builders/` is written by ABCD.EARTH `artex-osx/docs/mockups/publish_builders.py --to <this repo>/builders` and is
never edited here. `builders/BUILD.json` stamps the ABCD commit and a hash of each seed file; `--check` reports a
stale copy. A re-seed or a page fix is made in ABCD.EARTH and published again (ABCD-BUILDERS §7.0, ruled 2026-09-15:
_"B sounds like the right shape, a public API would be a gong-show."_).

**The link (Andy 2026-11-25: _"Provided we keep a link so new data from ABCD can feed the web deployment."_)**:
new data in ABCD.EARTH's seed reaches the site by ONE command, run from either repo:

    npm run builders:check      # here: is builders/ behind ABCD's seed? (exit 1 = stale)
    npm run builders:publish    # here: rebuild from ABCD's seed into builders/, then commit builders/

Both call `../../ABCD.EARTH/artex-osx/docs/mockups/publish_builders.py` (the two repos are siblings under the same
paths on both Macs). It publishes from ABCD's CURRENT checkout, so publish from `main` (the stamp names the commit).
A publish also re-seeds ABCD's own Section Builder page in place; commit that there.

## 6. Shared methods — one copy each

Every method lives in ONE place; this table names it and how it reaches the other product. Where a method runs in
two engines (the app's Rust, a page's JavaScript), the app writes its answers to a fixture and the page checks itself
against it, so a drift shows on the page before it ships (that check found ABCD BUGLIST #266).

| Method                                            | Its one copy                                            | Reaches the other product by                                           | Witness                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Material library: λ, ρ, carbon lines, EPD sources | ABCD.EARTH `seed/materials.json`                        | `publish_builders.py` → `builders/`                                    | `BUILD.json` seed hash, `--check`                                                       |
| Price book                                        | ABCD.EARTH `seed/prices.json`                           | the same                                                               | the same                                                                                |
| Assembly fold: RSI, carbon, cost per m²           | ABCD.EARTH Rust (`builders/assemblies.rs`)              | the Assembly Builder page's JavaScript fold                            | the app's fold and HFT fixtures; **#266 open**                                          |
| Cost markup chain (40/40/20)                      | ABCD.EARTH `CostPolicy` (labour 1.0, P&O 0.5, tax 0.13) | the pages' defaults                                                    | the fold fixture (#266 found the 0.2)                                                   |
| Junction sections                                 | ABCD.EARTH `seed/junctions.json`                        | the Section Builder page                                               | ❓ none yet                                                                             |
| F280, BASESIMP, AIM-2, ISO 52016 cooling          | the OBJECTIVE web codebase (v3 and v4 share it, §7.1)   | ported into Pro by ABCD-OBJECTIVE-PRO                                  | Excel-computed fixtures (`test/basesimp.test.cjs`, `aim2.test.cjs`) and the F280 tables |
| Hourly energy balance (8760 h)                    | ABCD.EARTH (ABCD-OBJECTIVE-PRO §4.6)                    | ❓ how v4 reaches it is open                                           | —                                                                                       |
| Envelope takeoff                                  | Take Off, Eh! (this repo)                               | its CSV into v4's S11 (V4-7)                                           | `sample csv exports/takeoffeh-measurements.csv`                                         |
| Design tokens (colours, fonts)                    | ❓ proposed: ABCD.EARTH `docs/mockups/tokens.css`       | published beside the Builders; `obstyles.css` maps its names onto them | —                                                                                       |

## 7. Where things live

### 7.1 What stays shared with v3

The computation graph, every section outside S10/S11, F280, BASESIMP, AIM-2 and the cooling engine are one
codebase. A v3 fix lands on objective `main` and is merged into andy-rnd `main`. v4-only code (§2) never goes to
v3.

### 7.2 Where v4 lives (RULED, Andy 2026-11-25)

_"We will combine the repos so I can deploy all for testing to the remote gh pages site (not the cloudflare site
which will remain the V3 deployment)"_. So:

- **v3** stays on Cloudflare Pages (objective.openbuilding.ca, from the objective repo); nothing about it changes.
- **v4** moves INTO arossti/OpenBuilding with the PDF-Parser and the other OpenBuilding tools, and deploys for
  testing on GitHub Pages (arossti.github.io/OpenBuilding), whose landing page is being repurposed for OpenBuilding's
  tools (a later session; Andy walks the agent through what is deleted).
- That repo is PUBLIC: what moves from andy-rnd becomes public with it (as objective already is).

## 8. Open questions

### Still open (each with a recommendation)

1. ~~The address~~: ruled, §4 (GitHub Pages in arossti/OpenBuilding).
2. **The Reference model's openings.** Today a host is per model (Target and Reference each choose). In v4 the
   Reference is the same building to code minimums, so recommendation: **the Reference's walls and openings are
   the Target's** (geometry mirrored, its RSIs, U-values and SHGCs its own, as "Mirror Geometry" does today).
3. **A v3 file's RSIs and U-values.** Recommendation: kept on the TYPE (the first wall's RSI is offered to every
   new wall, as + copies it today), so a re-entered envelope starts with the old assemblies.
4. **Below-grade walls with windows.** Kept (a walkout basement's windows); recommendation: yes, as now.
5. **What opens first in v4.** Recommendation: F280-1 hosted (V4-5), not a blank page.
6. **The sidebar group names** (§9.2 P0 ②). Recommendation: the seven proposed there.

---

## 9. The port: OBJECTIVE's sections into `objectivepro.html`

Andy 2026-11-25: _"I am personally keep to port the OBJECTIVE v4 RND methods and data into the new dark-mode
[page] … We will keep the 'PROJECT' tab, but the masthead menu and sections will then accord to our S03-S21, where S1
shoudl remain the intro page but will incorporate S01 somehow, and S02 is the Project tab with its current format."_
This reopens v4 (frozen at andy-rnd `main` until now). The source is andy-rnd `main` `5e0b2f0` (`src/sections/`,
`src/core/`, ~24 k lines); the code moves here, it is not linked.

### 9.1 The section map (the sidebar becomes this)

| Tab | OBJECTIVE section                  | andy-rnd lines | Notes                                                                  |
| --- | ---------------------------------- | -------------- | ---------------------------------------------------------------------- |
| S01 | Introduction + **Key Values**      | 789            | the intro page, carrying S01's key values                              |
| S02 | **PROJECT** = Building Information | 1,069          | the current PROJECT tab's format, S02's fields                         |
| S03 | Climate Calculations               | 1,507          |                                                                        |
| S04 | Actual vs. Target Energy & Carbon  | 918            |                                                                        |
| S05 | CO2e Emissions                     | 533            |                                                                        |
| S06 | Renewable Energy                   | 306            |                                                                        |
| S07 | Water Use                          | 736            |                                                                        |
| S08 | Indoor Air Quality                 | 408            |                                                                        |
| S09 | Occupant + Internal Gains          | 1,062          |                                                                        |
| S10 | Radiant Gains                      | 1,491          | windows; V4-2 reads S11                                                |
| S11 | Transmission Losses                | 2,508          | **the envelope: Trust / Trust + Verify's target** (V4-1, V4-2, V4-7)   |
| S12 | Volume and Surface Metrics         | 1,205          | **Trust's second target** (volumes)                                    |
| S13 | Mechanical Loads                   | 1,730          |                                                                        |
| S14 | TEDI & TELI                        | 515            |                                                                        |
| S15 | TEUI                               | 862            |                                                                        |
| S16 | Sankey Diagram                     | 2,067 + 453    |                                                                        |
| S17 | Dependency Graph                   | 27             | already here: the BEAM page's Dependency Graph tab came from OBJECTIVE |
| S18 | Optimize                           | 26             |                                                                        |
| S19 | WOMBAT — 3D Thermal Topology       | 2,059          |                                                                        |
| S20 | Notes & Debug                      | 1,188          |                                                                        |
| S21 | CSA F280 Compliance                | 1,921          |                                                                        |

### 9.2 Phases (recommended)

**RULED (P0's shape):** Andy 2026-11-25: _"We won't use any BEAM legacy pages. Our sections will replace all of BEAMS. We're just keeping the look and feel of the format as the tabbed, moden menus support a better project organizartion. And gives us wider latitude to format sections as full pages, with S01 acting as the overview/review dashboard. That said, in this narrow but wide header band, that is where we might be able to park our S01 head's up display so the 3 main rows show across any page or section that is active. It may well need 200px or so to read properly, that is a design function, but I feel the dashboard is vital for evaluating performance while ANY section is open. Sure, sidebar next"_

- **P0 — the scaffold.**
  1. **The S01 heads-up display** in the masthead band (the strip under the OBJECTIVE logo/title, beside Home ·
     Take Off, Eh! · Database · OBJECTIVE): S01's three main key-value rows, ~200 px tall (a design call), shown
     whatever section is open. S01's own tab is the full overview/review dashboard.
  2. **The sidebar becomes S01–S21**, grouped (proposed, Andy's to rename: Project S01–S02 · Climate & Targets
     S03–S06 · Occupancy & Gains S07–S10 · Envelope S11–S12 · Systems & Results S13–S15 · Outputs S16–S19 · Notes &
     Compliance S20–S21). S02 is the current PROJECT tab in its current format. Each section is a FULL PAGE.
  3. **Every BEAM tab is deleted** (the 12 assembly tabs, REVIEW, RESULTS, Glossary, Energy GHG, and their
     `js/beam/*-tab.mjs`); no legacy group. Keep the look and feel: the tabbed sidebar, the action bar, the dark theme.
     Trust / Trust + Verify keep working (they fill PROJECT today; P2 retargets them).
- **P1 — the engine.** OBJECTIVE's core (the state manager, the dual Target / Reference state, the calculation
  graph) moves in unchanged and runs headless behind the page; the CSV import/export too.
  **Spike 2026-11-25 (laptop), andy-rnd `main` `5e0b2f0`, case 01 Three Feathers Terrace:**
  - The graph runs headless: andy-rnd's 70 core + node scripts (its `index.html` order, no `Section*.js`, no
    `init.js`; ~2.8 MB, 0.8 MB of it `ClimateValues.js`) initialise, and `FileHandler.processImportedCSV` imports
    once `SectionModules.sect20.setNotes` is stubbed (FileHandler calls it for Project Notes).
  - **Reference matches the full app exactly** (e_6 22.7 · e_8 9.7 · e_10 190.1).
  - **Target does not:** h_10 89.4 headless vs 93.1 in the full app (h_6 11.5 vs 11.6, h_8 4.6 vs 4.7). Loading the
    `Section*.js` modules without rendering changes nothing. The inputs that differ are ones the full app derives
    through its page code after an import: `e_12` (sub-type, "Auditorium seating area" vs empty), `d_16` (350 vs
    345.82), `i_63` (3650 vs 4380), `i_49` / `i_50` (1 839 600 vs 58 400) — dropdown cascades and defaults that run in
    the DOM (FileHandler's `syncPostImportUI`, the sections' handlers), not in the graph.
  - The % column (m_6, m_8, m_10) is S01's page code, not the graph (headless gives "0%" / "N/A").
  - **So P1 is: copy the engine in, then find each page-side derivation and move it into the graph (or call it
    headless), until case 01's every value matches the full app; then all 13 cases.** The witness is that diff
    (StateManager `exportState()` of the full app vs headless, after the same CSV), zero non-`ref_` differences.

- **P2 — S11 and S12 first**, in the dark theme: they are what Trust / Trust + Verify fill, so the PDF-mapping tests
  (Andy, the same evening) can aim at real fields. The bridge's mapping (`js/beam/pdf-bridge-import.mjs`, `polygon-map.mjs`)
  learns S11's rows and S12's volumes.
- **Foundations read the Section Builder** (Andy 2026-11-25: _"our Section Builder can inform basement styles per
  F280 requirements (in can read form how a user configures the section builder to determine which
  basement/footing/foundation style we are dealing with."_): the BEAM Footings & Slabs tab is gone; the foundation's
  F280 configuration comes from the section the user builds, not a picker.
- **P3 — the rest**, section by section, each checked against andy-rnd's own tests and case studies (the shared
  computation, §7.1), S01's key values last because they read everything.

### Answered

- **BEAM's tabs: all go, no legacy group; S01 is the dashboard and its HUD rides the masthead.** Andy 2026-11-25: _"We won't use any BEAM legacy pages. Our sections will replace all of BEAMS. We're just keeping the look and feel of the format as the tabbed, moden menus support a better project organizartion. And gives us wider latitude to format sections as full pages, with S01 acting as the overview/review dashboard. That said, in this narrow but wide header band, that is where we might be able to park our S01 head's up display so the 3 main rows show across any page or section that is active. It may well need 200px or so to read properly, that is a design function, but I feel the dashboard is vital for evaluating performance while ANY section is open. Sure, sidebar next"_

- **"Pro" names both.** Andy 2026-11-25: _"Pro refers to both the Web App and the Rust app. Pro=V4. The user may use the app in OSX/Linux, but many users are still PC users, and for them we have the web app. It is not expected to do everything the native rust app can, but it is the concession we make."_ Hence the address `objectivepro.html`.

## 10. The Builders inside OBJECTIVE (branch `Builders-In-OBJECTIVE`)

> Andy 2026-11-26: _"Builders accessible as model popups from within the OBJECTIVE V4 app. We can use the ID fields in
> S11 as buttons, ie. you see where we have B.9 and B.10? Wall Below Grade and Slab Conditioned? Those can become
> buttons and when the Assembly Builder opens there, in the frame I show here in the screenshot without the notes and
> disclaimers surrounding the full HTML, and it will open to the relevant section, so slabs to floors, walls to wall
> exterior, etc."_ · _"When the user then sets 'Apply Selected' for the wall or floor assembly, then the effective
> calculated value then replaces the manually entered one default one for the selected assembly. As a follow-on,
> Windows can do the same thing, but instead they will open the Opening Builder. Further to all of that, embodied
> carbon in S05 can later be calculated from the Sum of the embodied carbon of all assemblies multiplied by their
> area."_

**Status 2026-11-26: B1 – B5 are merged (PRs #26, #27), Andy-smoked. On `Reference-Independence` (not merged) the
Builders work in BOTH models, each row holding one assembly per model (§0 REMAINS 1); where B2 – B5 below say
"inert in Reference mode", "a dash" or 4 decimals, that branch supersedes them.** Andy answered §10.6 (all four as recommended) and said to go on B1.

### 10.1 What is there today (read from the code, 2026-11-26)

- **S11's opaque rows** (`src/sections/Section11.js`, `src/core/Openings.js`): B.4 Roof, B.5 Wall above grade, B.6
  Exposed floor and up to 9 more above grade; B.9 Wall below grade, B.10 Slab and up to 4 more below. Each row's ID
  cell is plain text. Its type is the `c_<row>` dropdown (`roof` · `walls` · `exposedFloor` · `wallsBelowGrade` ·
  `slabOnGrade`). **The RSI (`f_<row>`) is the typed input**; the U-value (`g_<row>`) and R-value follow from it.
- **S11's opening rows** (B.7 doors, B.8 windows, skylights): here the **U-value (`g_<row>`) is the typed input**.
- **The Assembly Builder** (`builders/assembly-builder.html`, published from ABCD.EARTH): the framed tool is one
  `<div class="window">`; the notes (`.notes`) and the cost disclaimer (`.cost-disclaimer`) are its siblings below
  it. The library is grouped by each assembly's name prefix in the house order: `Ra` Roof Exterior · `Rx` · `Fi` ·
  `Wx` · `Wi` · `Wa` Wall Exterior · `Wg` Wall Foundation · `Fa` Floor Exterior · `Fg` Floor on Ground · `Ftg` ·
  `Lg`. For the selected assembly it shows Effective RSI (`#f-rsi-eff`), Effective U (`#f-u-eff`), Embodied Carbon
  Intensity in kgCO2e/m² (`#f-eci`), the biogenic line and the total thickness, by the chosen RSI method (NBC ·
  ISO 6946 · HFT, the last from baked results). It reads no URL parameter and sends no message today.
- **It is a snapshot** (ABCD BUGLIST #266): the page as committed 2026-10-22 with that day's seed, published as
  committed. Its script can still be edited at the source; only a re-seed is blocked.
- **The Opening Builder** (`builders/opening-builder.html`) is rebuilt from today's seed on every publish.
- **S05**: `d_39` chooses the embodied-carbon source; with "Modelled Value" it reads `i_41` (kgCO2e/m²), which is
  typed today.

### 10.2 The design

**One rule: the Builder computes, OBJECTIVE receives.** OBJECTIVE never re-derives an RSI or a carbon figure from
layers; it takes the number the Builder shows, with the assembly's id and name beside it. The Builders stay build
output from ABCD.EARTH (§5.2): everything the Builder pages need is added at their source and published.

**The message.** The Builder runs in an `<iframe>` on the same origin and posts one message to its parent:

    { type: "ob-builder-apply", kind: "assembly" | "opening", id, name, group,
      rsi_eff, u_eff, rsi_method, eci_kgco2e_m2, bio_kgco2e_m2, thickness_mm }

(an opening sends its own values instead: 10.3 B4). OBJECTIVE accepts it only from its own origin.

**Type to group** (which part of the library the Builder opens at):

| S11 type (`c_<row>`)           | Assembly Builder group |
| ------------------------------ | ---------------------- |
| Roof                           | `Ra` Roof Exterior     |
| Wall above grade               | `Wa` Wall Exterior     |
| Exposed floor                  | `Fa` Floor Exterior    |
| Wall below grade (conditioned) | `Wg` Wall Foundation   |
| Slab (conditioned)             | `Fg` Floor on Ground   |

### 10.3 Phases

- **B1 — the Assembly Builder's embed mode — ✅ BUILT** (ABCD.EARTH branch `Assembly-Builder-Embed`, `f3035dbdc`;
  published here in `builders/assembly-builder.html`). `?embed=1` shows the `.window` alone, filling the frame.
  `&group=Wa` opens the library at that group's first assembly; `&pick=<assembly id>` selects one by id. The title
  bar shows **Apply Selected** and **cancel** in place of export / import / cancel / reset. Apply posts, to its own
  origin only:
  `{ type: "ob-builder-apply", kind: "assembly", id, name, group, cls, rsi_eff, u_eff, rsi_method, eci_kgco2e_m2,
bio_kgco2e_m2, thickness_mm, edited }`; cancel posts `{ type: "ob-builder-cancel" }`. Where HFT has no result for
  the assembly nothing is sent and the page says to choose NBC or ISO 6946. Without `?embed` the page is unchanged.
  Witnessed in WebKit through this site: Ra, Wa, Fa, Wg and Fg open at their group with only the palette visible,
  the posted values equal the ones shown, and the standalone page still agrees with the app on all 115 assemblies.
  `window.__embedMessage()` returns what Apply would send, for B3's witness.
- **B2 — the popup and the buttons — ✅ BUILT** (`js/objective-builders.mjs`, started by `objective4.mjs`;
  `obstyles.css` §8e). Each opaque row's ID cell (`td.id-cell`, B.4 … B.10 and the rows + adds) is a button, found by
  delegation; `#op-builder-modal` holds one iframe, `builders/assembly-builder.html?embed=1&group=<by type>` and
  `&pick=<the row's assembly>` when it has one. Esc, the backdrop and the Builder's cancel close it. In Reference
  mode the IDs are inert.
- **B3 — Apply Selected — ✅ BUILT.** The message writes `rsi_eff` (4 decimals) into `f_<row>` as a user entry, then
  one `Calculator.calculateAll()`, as the Trust import does; the row's assembly is `ca_<row>`, one JSON value
  (`id, name, group, method, rsi, eci, bio, t, edited`). The ID turns bold and the name sits beside the type, cut to
  the room the row has so S11's table keeps its width (the full name is the ID's tooltip). An RSI typed by hand
  clears `ca_<row>` (read when the cell is left). **Saved with the project:** `Openings.addedFields` lists `ca_<row>`
  for a row that has one, and `FileHandler` restores it (`isStoredKeyWithoutField`); a project without it clears it.
  - **After Andy's first smoke (same day):** the popup is 1000 px wide and the Builder's embed mode is a fixed
    frame (title bar never scrolls, list and editor scroll on their own, compact sizes, no provenance strip): it
    opens at the top, and a 3-layer slab fits a 970 px window without scrolling. **The button row's project name
    is S02's B.2** (`h_14`): `wireProjectName` in `objective4.mjs` mirrors V3's cell and writes an edit back
    through V3's own handler.
  - ⚠ Two things measured on the way: a typed edit in V3 does NOT notify a `StateManager.addListener` on that field
    (the value and the recalculation are right; only the listener is silent), and WebKit reports the HOST page as
    the `source` of the Builder's cancel message, so `onMessage` checks the origin and that the popup is open, not
    the sender's window.
  - Witnessed in WebKit: B.9 → Wall Foundation, B.10 → Floor on Ground, B.5 → Wall Exterior; after Apply the row's
    RSI and U equal the Builder's (3.84 / 0.260 for `Wg | R22 8" ICF`); reopening returns to the row's assembly;
    the saved CSV carries `ca_86 ca_94 ca_95` and loading it restores them; another project clears them; the
    table's width is unchanged at 1440 px; parity 2146 / 2146 on all 16 cases.
- **B4 — windows, doors and skylights open the Opening Builder — ✅ BUILT.** `opening-builder.html` has the same embed
  mode (ABCD.EARTH `1e2b30ab1`): `?embed=1&group=Window|Door|Skylight&pick=<opening id>`; its Apply posts
  `{ type: "ob-builder-apply", kind: "opening", id, name, cls, uw_computed, ug_computed, uf_computed, uw_certified,
certified_by, w_mm, h_mm, edited }`. In `js/objective-builders.mjs` the door (B.7), window (B.8) and skylight
  (B.8.5) rows' IDs are buttons too; Apply writes the U-value into `g_<row>` (3 decimals) and the row's product
  into `ca_<row>` (`id, name, cls, u, basis, uw_computed, uw_certified, w, h, edited`), saved and restored as an
  assembly's is. **Which U:** the certificate's Uw where the product has one (`basis: "certified"`), else the
  Builder's computed Uw (`"computed"`: its frame is a solid first pass); the ID's tooltip says which. **RULED**, Andy
  2026-11-26: _"Yes Product Uw or if not available our calculated value."_ **Not applied:** the opening's W × H and any SHGC (the Builder computes none); S10 is untouched.
  Witnessed in WebKit: B.8.1 → Window, B.7.0 → Door, B.8.5 → Skylight, each opening unscrolled; EnerSign primus
  writes 0.600 (certified; computed 0.638), a skylight with no certificate its computed 1.394; save, typed U,
  reload and reopen behave; the assembly rows still open the Assembly Builder; parity 2146 / 2146.
- **B5 — S05's embodied carbon from the assemblies — ✅ BUILT** (`js/objective-builders.mjs` `tallyCarbon` /
  `renderCarbon`; branch `S05-Assembly-Carbon`). A row of its own under E.3.4, **E.3.5 "From S11's Assemblies
  (A1-3)"** (Andy 2026-11-26: _"we should consider a new field in S05 that holds this running tally and sum when
  done... so it does not interfere with current behaviour and defaults"_): Σ (assembly carbon intensity × the row's
  NET area, as entered less the openings it hosts) over S11's opaque rows, shown as MT CO2e and as kgCO2e/m² of
  `d_106`, the floor area E.3.3 itself divides by. Beside it: "running tally: n of m opaque rows" while a row in
  use (net area > 0) has no assembly, "sum: all m opaque rows" when every one has. Fossil A1–A3, as the Builder's
  ECI; openings carry no carbon figure and are not in it. **Nothing reads it**: it is not a StateManager field, it
  is not saved (it follows from the rows' saved assemblies), and E.3.4's typed `i_41`, `d_39` and `d_40` are
  untouched. In Reference mode it shows a dash (the assemblies are the Target's).
  Witnessed in WebKit on case 01: slab alone 56.86 MT / 50.29 kgCO2e/m², "1 of 3"; roof + wall + slab 124.62 /
  110.22, "sum: all 3" (26.02 × 1304.07 + 47.965 × 705.27 + 51.648 × 1100.93, over 1130.63 m²); a window hosted in
  the wall takes its 81.14 m² off (120.73 / 106.78); `i_41` 345.82 and `d_40` 390.99 unchanged throughout; another
  project clears it.

### 10.4 Witnesses

- The 2146-value parity probe stays 2146 / 2146 on all 16 cases while no assembly has been applied.
- Playwright: click B.9 → the Builder opens in its frame alone, at Wall Foundation; Apply Selected → `f_94` shows the
  Builder's Effective RSI and `g_94` its U-value; the row shows the assembly's name; a typed RSI clears it.
- The Assembly Builder's own cross-check (115 assemblies against the app's fold fixture) still passes after B1.

### 10.5 Costs and risks, named

- The Assembly Builder is 2.6 MB and the Opening Builder 1.3 MB: each loads once, on the first click, and is cached.
  They are not loaded with OBJECTIVE itself.
- The Assembly Builder is the 2026-10-22 snapshot until ABCD BUGLIST #266 is fixed: the values applied are that
  library's (115 assemblies), and its baked HFT results are a month older than the app's.
- A row's assembly is saved in the project's CSV as `ca_<row>`, a column only for a row that has one.

### 10.6 Answered (Andy 2026-11-26: yes to all four)

1. **The saved project keeps each row's assembly** (id, name, method), as added fields in the 4.0 file; an older file
   opens with none.
2. **Below grade, the Builder's Effective RSI of the assembly alone** is applied; OBJECTIVE adds the ground as it does
   today.
3. **An assembly the user edited in the Builder may be applied**: the message carries what the page shows (`edited:
true`) and the row's name is marked "edited".
4. **B5's partial sum** is shown with the count of rows it covers, in its own new S05 field (10.3 B5), so the typed
   `i_41` and today's defaults are untouched.

## 11. F280 Mode: gains to the heat balance only (PLAN, nothing built; waits for the F280 validation review, §0)

Written 2026-11-26 night. Andy: _"ok, now fix step 2: gains to heat balance only"_ and _"We should spell this out
in our workplan first"_, _"before we make any changes ot the calculation engine"_.

### 11.1 What an F280 case file is

Each Part 9 case study comes as two files, and they hold two different References.

- **The regular file** (`02-residence-sb12-net-zero.csv`): the Reference is the code-minimum building.
- **The F280 variant** (`…-f280.csv`): the Reference is the Target's own house (same walls, roof, windows,
  airtightness and equipment) with F280 Mode On. Andy: _"we were using it to compare the Reference (F280) to our
  Target models, NOT an F280+OBC Mininmum value, so the insulation values remain high, airthightness high"_.

So the Reference's S01 TEUI falls in two steps between the two files. Only step 2 is a fault.

| Case              | Regular file (code minimum) | F280 file, Mode Off (= the Target) | F280 file, Mode On | Actual |
| ----------------- | --------------------------- | ---------------------------------- | ------------------ | ------ |
| 02 Collingwood    | 179.5                       | 103.4                              | 84.7               | 103.5  |
| 03 PHI Classic    | 296.0                       | 57.1                               | 57.3               | 56.3   |
| 10 SB-12 Duplex   | 188.4                       | 13.2                               | −11.8              | 14.8   |
| 12 PHI Low Energy | 181.3                       | 63.4                               | 46.6               | 57.8   |

### 11.2 The fault (step 2)

Under F280 Mode On, S09 holds F280's internal gains (`window.TEUI.F280Gains`; `InternalGainsNodes.js` `f280On`):
people at 70 W each (Cl. 6.2.4), plug loads at the larger of 4 W/m² or 800 W (Cl. 6.2.5), lighting 0 in effect
and equipment 0 (both are inside the plug figure).

In OBJECTIVE one S09 density is two things: the heat the load gives the room, and the electricity it uses. So the
annual model also stops billing the lighting and equipment electricity, and bills the plug loads at F280's
figure. F280 is a sizing standard; it gives no annual consumption.

The Reference's own change, Mode Off → On, in kWh/m² (run on the page 2026-11-26):

| Case              | Lighting | Equipment | Plug loads | Heating | Cooling | Net   |
| ----------------- | -------- | --------- | ---------- | ------- | ------- | ----- |
| 02 Collingwood    | −6.6     | −13.1     | −4.4       | +6.4    | −1.1    | −18.8 |
| 10 SB-12 Duplex   | −6.6     | −13.1     | −4.4       | +2.7    | −3.7    | −25.1 |
| 12 PHI Low Energy | −6.6     | −13.1     | +4.0       | +4.5    | −5.7    | −16.8 |
| 03 PHI Classic    | −6.6     | −13.1     | +13.9      | +6.0    | 0       | +0.2  |

The first three columns are electricity that goes missing or appears. Heating and Cooling are the real effect of
F280's gains on the heat balance, with F280's ground and infiltration methods inside Heating (between −3.9 and
+1.8). PHI Classic hides the fault: it is small, so the 800 W floor is 5.3 W/m² against its own 2.1.

### 11.3 The ruling

Andy 2026-11-26: _"yes, gains to the heat balance only, keep S09's electricity"_. Under F280 Mode On:

- **The heat balance uses F280's gains**, as now: the annual heating and cooling balance, and S21's design loads.
- **The electricity billed is OBJECTIVE's**: lighting, equipment and plug loads at the densities S09 holds with
  the mode Off.

### 11.4 What changes in the engine

Today (`src/sections/nodes/InternalGainsNodes.js`):

- Four nodes take F280's figure under On: `internal.plugLoadDensity` (`d_65`), `internal.equipmentDensity`
  (`d_67`), `internal.lightingDensity.inEffect`, `internal.occupants.wattsPerPerson` (`g_64`).
- The annual nodes `internal.plugLoads.annual` (`h_65`), `internal.lighting.annual` (`h_66`) and
  `internal.equipment.annual` (`h_67`) are computed from those densities.
- `energy.plugLoads.subtotal` (`h_70`) sums the three, and feeds BOTH `energy.total.targeted` (electricity) and
  `internal.heatingGains` (`i_71`) and the usable gains (heat).

The change: each load gets two annual figures where it has one.

1. **Electricity**: from the density with the mode ignored. `energy.total.targeted` reads this sum.
2. **Gain**: from the density in effect (F280's under On). The heating gains, the cooling balance and the gain
   percentages read this sum.

With the mode Off the two are the same number, so no result moves for any model at Off.

To read in the code before building (not yet read): every node that depends on `energy.plugLoads.subtotal` or on
one of the three annual nodes, sorted into "electricity" or "gain"; what `cooling.iso52016` reads for its internal
gains; the S04 / S15 rows that show the plug subtotal.

### 11.5 What must come out

Estimates from §11.2's table (the electricity columns put back). The build confirms them by running.

| Case              | Reference, Mode On, today | Expected after | Target (= Mode Off) |
| ----------------- | ------------------------- | -------------- | ------------------- |
| 02 Collingwood    | 84.7                      | about 108.8    | 103.4               |
| 10 SB-12 Duplex   | −11.8                     | about 12.3     | 13.2                |
| 12 PHI Low Energy | 46.6                      | about 62.3     | 63.4                |
| 03 PHI Classic    | 57.3                      | about 63.1     | 57.1                |

Witnesses to write with it:

- For each of the four F280 files, the Reference's `energy.plugLoads.subtotal` electricity is the same with its
  mode Off and On, and its TEUI moves only by the Heating and Cooling columns.
- Every model at Mode Off is unchanged: the 12 regular case files, and the Target of the four F280 files.
- S21's design heat loss and nominal cooling capacity are unchanged in all four.
- **Parity against V3 will no longer match on the four F280 files' Reference values**, by design (V3 has the
  fault). `test/witness/parity.cjs` then needs those values listed as expected differences, each with its
  number, never a blanket skip.

### 11.6 Open, Andy's

1. **What S09 shows under Mode On — RULED (Andy 2026-11-26, "yes"):** the density cells keep showing F280's
   gains (they are the gains in effect); the kWh/yr column shows electricity at S09's own densities, and its
   hover under On says so: "electricity at S09's own densities; gains follow F280".
2. **PHI Classic rises to about 63**, above its Target's 57.1, because F280's 800 W of plug gain is less heat
   than the 6.6 W/m² the house has with the mode Off. That is the ruling working as written; noted so it is not
   a surprise.
3. The Duplex's Actual (14.8) and Target (13.2) are far below the other cases'. Not looked into.

## Appendix — Changelog

- 2026-11-25: P0 shipped on `ob-landing-cleanup` (HUD, S01–S22 sidebar, BEAM tabs deleted, Glossary = S22).

| Date       | Commit                        | Change                                                                                |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| 2026-11-25 | andy-rnd `7870a44`, `0684e43` | the plan written in andy-rnd (§3, §4, §7, §8)                                         |
| 2026-11-25 | `99d5a70`                     | moved here; §0, §5 and §6 added                                                       |
| 2026-11-25 | `0a318bb`                     | §0 shipped / remaining; `objectivepro.html`; Assemblies published; §9 the port        |
| 2026-11-25 | `62cb91a`                     | ruled: Pro = v4, the Rust app and the web app                                         |
| 2026-11-25 | this commit                   | ruled: no BEAM legacy; S01 dashboard + masthead HUD; P0 rewritten; cold-start handoff |
