# The Reference model: what it is, and how to start a project with it

This page is two things. Part 1 is guidance for users, and the draft of a blog post for OpenBuilding.ca. Part 2
is the workplan for building what Part 1 proposes.

Status: written 2026-11-26; the direction was agreed by Andy the same day. Nothing in "The proposal" is built
yet. "What OBJECTIVE does today" describes OBJECTIVE 4.0 as it stands.

# Part 1 — for users

## The short version

OBJECTIVE holds two complete building descriptions at once.

The **Target** is the building you are designing.
The **Reference** is the building you compare it to.

Every Energy or Carbon or Cost total is shown in the dashboard at the top of the screen, with differences between
both models always visible. All model inputs are held in two separate but linked workspaces, Target/Reference, which a user can toggle between at any time.

The Reference is a complete model of its own. It is not a list of code minimums merely bolted to your design. You can
change _anything_ in it without touching the Target, such as location, or building area, or window types, and vice versa.

That freedom is the most useful thing about OBJECTIVE, and it is also what new users find hardest to understand.
This page explains _why_ the two models are separate, and proposes one new question for the user at the start of an OBJECTIVE V4 project that makes the choice plain.

## Why the two models are separate

Because "what am I comparing against?" has more than one right answer.

1. **A Renovation.** The Reference is the building as it stands today, with its real utility bills. The Target
   starts as a copy of it, then adds area, better walls, better windows, new equipment. The difference is what
   the renovation buys.
2. **The same building, built only to code.** The Reference has the Target's shape and size, with the minimum
   assemblies and equipment a code or standard allows. This is the classic compliance comparison, and it is what
   the experts call "the worst building I can legally build". It also answers questions of comparison such as a
   high-carbon steel and concrete building against a high-performance mass-timber building, as just one example,
   where both share the same floor plan.
3. **The same building somewhere else.** A retailer with a store in Toronto, and the utility bills for it, sets Toronto as the Reference and tries Kamloops, their new branch store, as the Target. The difference is _only_ the climate, but it could _also_ compare the BC Building Code against the Ontario Building Code version of the same building.
4. **A check against a standard's own method.** In our F280 case studies the Reference holds every input CSA
   F280 would assume, and the Target models the same house the OBJECTIVE way. The third column, 'Actual' - shows how close either one are to the reality of utility bills, with the differences weather and schedule variations produce all in the mix. (we've found with our methodology, the three columns are closer than with any other methods)

No single rule for "what the Reference should hold" serves all four modelling scenarios. So OBJECTIVE has no such rule. A value you have set in one model is never overwritten by the other, which also means they can never fight over it.

## What confuses people

- **"I typed my areas into the Target. Why didn't the Reference follow?"** Because it is a separate building.
  Until you copy your geometry across (ie. The North Wall Area, The Conditioned Slab Area, etc), the Reference is still the sample project's building, and the comparison is between two different buildings.
- **Drift.** Our app defaults are never empty: we find that starting from a finished sample that is similar (Load Sample Project) and change what differs is the much faster approach. We do this on purpose. An empty model gives only wrong answers until every field is filled, and that is a common complaint about
  other energy modelling tools. Our approach may still give you wrong answers, but they are going to be _less wrong_ because we always assume _some value_ rather than _no value_. The cost of this approach is that the Reference keeps the sample's values until you update it, and nothing on screen tells you the two models have drifted apart.
- **The feature to copy values over is easy to miss.** It lives in a small dropdown menu beside the Reference button.

## What OBJECTIVE does today

OBJECTIVE 4.0 replaces version 3. It opens any version 3 file; the project can stay as it was or be made more
detailed. What follows is what version 4.0 can do.

- A new session opens on a finished sample project. Load Sample offers the other case studies.
- The Target / Reference switch shows either model. Every input can be edited in either.
- **Copy from Target** (the menu beside Reference) copies one way, Target to Reference, in three strengths:
  - **Geometry**: areas, volumes and layout. The Reference keeps its own assemblies, windows and equipment.
  - **Geometry + Code**: the same, then the chosen standard's minimum values are written over the Reference.
    This is use 2 above, and the most common.
  - **All Inputs**: an exact twin of the Target. Only the Reference's building standard is left alone.
- A code value in the Reference is a starting value, not a lock. You can type over it. Users in the USA and the EU have had to do this in order to use OBJECTIVE for their own National codes.
- An input left blank in the Reference is filled from the Target. An input that holds a value is left alone.
- There is no copy the other way (Reference to Target), no "start from zero", and no notice when the two
  models differ in shape. (we will add this so we can delete this clause).

## The proposal: ask one question at the start

When a project is started, OBJECTIVE asks: **"What is your Reference?"** The answer does the right copy for you
and tells you, in a sentence, what the Reference now is. It can be changed later from the same menu.

### A. My building, built to code (the default)

For new buildings. As you enter the Target's geometry, the Reference takes the same geometry. Its assemblies
and equipment stay at the standard's minimums. In today's terms: "Geometry + Code", kept up to date for you
instead of clicked once.

The rule that keeps the models from fighting: the copy only ever runs one way (Target to Reference), only for
geometry, and only while this choice is on. A value you type into the Reference yourself is yours and is not
overwritten.

### B. The building as it stands (a renovation)

You model the existing building first, in the Reference, with its bills. Then **Copy from Reference** makes the
Target its twin, and you improve the Target from there. After that one copy the two models are independent.

This needs the one thing missing today: a copy from Reference to Target.

### C. A different building or place

The two models are fully independent, as they are now. For the two-city comparison, the standard-method check,
or any case where the Reference is not your building.

### D. Start from zero

Both models are emptied. For users who want nothing they did not enter. The page says plainly that results
will read as unavailable until the required inputs are in.

## Two smaller changes that help whatever is chosen

- **Say what the Reference is.** A line under the Reference button, always visible: "Reference: your building
  at OBC SB-12 minimums", "Reference: the existing building", "Reference: an independent model".
- **Show drift.** When the Reference's geometry differs from the Target's and the choice is A, a small marker
  on the Reference button says so ("geometry differs in 6 fields") and offers the copy. Nothing is copied
  until you ask.

# Part 2 — the workplan

## In what order

1. The line that says what the Reference is, and the drift marker. No change to any calculation. This alone
   answers "why didn't the Reference follow?".
2. Copy from Reference (to the Target), so the renovation path exists.
3. The question at the start of a project, doing the copies that exist by then (B, C, and A as a one-time
   "Geometry + Code").
4. Start from zero.
5. A's live geometry copy, last, because it is the only step where one model writes to the other without a
   click. It should not ship until the drift marker has shown whether people still need it.

## Answered (Andy 2026-11-26, written into this file)

1. **Is A the default, or is nothing chosen until the user answers?** A is the default. The question is asked
   only when the user picks **Guide Me**: _"if the user chooses 'Guide Me' as an option, they we can offer a
   quick modal questionaire that sets the method"_.
2. **What does A's "geometry" carry?** The Geometry copy's list, and _"climate and occupancy can follow. But
   occupancy might use F280 or OBC standards, so we should check."_ To check before building: which standard
   sets the Reference's occupancy in each case.
3. **Utility bills.** _"Utility Bills are absolute. They have no relation or impact on Target or Reference
   calculations. They are entered in S04 only when a user has them."_ Two things follow:
   - With S.2 at Targeted Use, hide S04's Actual Energy, Actual Net and Actual Emissions columns, _"otherwise a
     user might think they need to enter something there"_.
   - With S.2 at Utility Bills, the project is either complete (the bills are the model's final validation) or a
     renovation, and then the bills are entered on the Reference side, not the Target's.
4. **Start from zero** clears everything, the location included.

## Still open

- Is the choice saved in the project file? Andy: _"not sure. We don't want to box a user in. But they may wish
  to save a partially completed model."_ Claude's recommendation: save it as a label only. It names what the
  Reference is when the file reopens and locks nothing; the user changes it from the same menu.

## Utility bills and S.2 (Andy 2026-11-26)

- **Bills stay per model, not shared.** Andy: _"not shared bills, in the case of a reference model that is the
  base case for a renovation, and the Target carries the post renovation utility bills, which should match
  target if the use designed carefully."_ So in a renovation the Reference holds the bills from before, and the
  Target the bills from after.
- **Today S01's Actual column reads the Target's bills only**, on both sides (run on the page: a bill of
  500,000 typed on the Reference side left Actual at 93.1).
- **A feature to consider, renovations only: two Actuals in S01**, one from each model's bills. Andy: _"it might
  be an idea to add a new feature in S01 that shows 2 actuals, depending on the type of project we have (only
  renos would show this)."_ It hangs on the Guide Me answer "B. The building as it stands". Not scheduled.
- **S.2 (Targeted Use / Utility Bills) is already one per model.** Run on the page: changed on the Target's
  side it left the Reference's, and the other way round. Actual follows the Target's S.2 only.
- **The hide rule, then:** S04's Actual columns hide in Easy mode when the model on screen is at Targeted Use.
  They can show on one side and hide on the other.

## Easy and Expert modes, and Guide Me (Andy 2026-11-26)

Andy: _"Users, both technical experts and novices alike are overwhelmed by the screens full of numbers and walls
of text."_ The Reference question above is one case of a wider one, so it is planned with it.

- **A pill after Copy from Target: Easy / Expert.** Expert is the full page as it is now. In Easy mode _"just
  inputs and the most essential data is visible per section"_.
- **Guide Me** is the wizard: a short set of questions in a modal at the start of a project. "What is your
  Reference?" is its first.
- **The spreadsheet's column letters go** (the L, M, N, O in the headers), in both modes. Andy: _"We can lose all
  of them."_ and _"I agree the cruft can be cleaned out for Expert and Easy."_ Row IDs (B.5, T.6.10) stay: hovers, messages and this roadmap name rows by them.

How it is built (Andy 2026-11-26: _"yes, build the stub after #28 merges. We can go section by section and
determine what is essential."_):

1. **Easy mode is display only.** One class on the page hides things; no input, no calculation and no saved
   file changes with the mode. Parity against the case studies is then unaffected by construction.
2. **Easy mode never hides an input, with one exception.** Andy: _"The ONLY inputs that can hide are Utility
   Bill Actual Columns IF the user has selected 'Targeted Use'."_ Everything else it hides is a calculated
   column, an intermediate value or explanatory text.
3. **The stub first, on its own branch after PR #28 merges:** the pill, the class, the column letters gone, and
   nothing else hidden yet. Then one section at a time, Andy marking what is essential in each (22 sections;
   this curation is the real cost).
4. **The page launches in Easy** (Andy: _"And yes, launch in Easy."_). The mode is remembered in the browser,
   not in the project file.
5. **Print** shows the full report whatever the mode, unless Andy rules otherwise.

The column letters are the section headers' cells whose whole caption is one letter (S10 to S15 have 26 of
them: N, L, I, G, F, E, M, K, J, H, D). Captions that carry a unit or a name stay.

**The stub is live (2026-11-27, PR #37, merged on Andy's word).** What it holds:

- The pill after Copy from Target, Easy · pill · Expert. Easy is the class `op-easy` on `<html>`; the choice is
  kept in the browser as `objective4View`. The page launches in Easy. Nothing is hidden yet.
- **Where the next step goes:** `obstyles.css` §8e. Each thing Easy hides is one rule, `html.op-easy <selector>`,
  inside `@media screen`, so print keeps the full report.
- The column letters, counted on the page: **80 in 12 sections** (S02, S03, S05 to S09, S12 to S15, S19), not
  the 26 estimated above. The rule applied: a header cell whose whole caption is its own column's letter. They
  are deleted from the section definitions (`src/sections/`), so they are gone in both views and in print.
  One-letter units (W, m) and row IDs stay.
- **Ruled (Andy 2026-11-27): the header rows' own ids (`02-ID`, `15-ID`, `S19-HEADER`) stay.** _"no need to
  remove the header ids"_.
- The witness: `test/witness/easy-expert.cjs`. It must keep passing as sections are curated; each thing Easy
  hides gets a check of its own there.

**The first thing Easy hides: the Cell IDs (2026-11-27, PR #38, merged on Andy's word after his nits).** Andy: _"we should however hide Cell ID's. In Expert mode, the cell ID's should in fact use the same
styling (CSS) ... make all the same as T.6.0 across all sections please."_

- A Cell ID is the ID column's cell, an ID beside its value (T.6.1) or an ID leading a caption ("M.1.1 HSPF").
  The renderer marks the last two with the class `cell-id` (`FieldManager.js` `markCellId`).
- Expert shows all of them in the ID column's style. Easy hides them on screen; print shows them.
- **Two exceptions stay in Easy.** S11's row IDs that open a Builder: they are buttons, and rule 2 above says
  Easy never hides an input (Andy 2026-11-27: leave the Builders alone for now; ABCD.EARTH's refinements come
  later). And S10's opening rows (G.7.x, G.8.x), so a window keeps its number in both sections (Andy: _"to
  maintain a visual correlation between unique windows and their ID's"_).
- No row draws its own ID twice (Andy: _"we don't duplicate ID row and name"_).
- **Both views: accounting style.** A number is right-justified, words are left-justified, a caption follows
  its column (Andy 2026-11-27; V3's rule, which 4.0's stylesheet had dropped). `obstyles.css` §8b.

**S02 (2026-11-27, PR #39).** It holds inputs and one derived value, so Easy hides nothing there. One rule
came of it, for both views (Andy: _"IF S.2 = Utility Bills, show, Else Off in Expert and Easy modes"_): the
prices of gas, propane, wood and oil show only while the model on screen has S.2 at Utility Bills. The price of
electricity stays, because the engine reads it at Targeted Use too (S15's annual cost, S18's financials); that
exception is Claude's and waits for Andy's word. The class is `op-targeted-use` on `<html>`
(`js/objective4.mjs` `syncUse`), ready for S04's Actual columns.

**S03 (2026-11-27, PR #40).** Andy said yes to the cut proposed. Easy keeps the seven inputs, the Climate Zone,
HDD, CDD, the Coldest and Hottest Days and the two set-points in °C, and the two ✓. It does not show the °F
twins, the ground-facing degree days, the Summer Night Mean and Mean RH, the Winter Average Temp. and the two
set-point limits. With F280 Mode On the foundation's inputs all show.

**S04 (2026-11-27, PR #41).** The ruled rule is wired: at Targeted Use the Actual columns (D to G) are not
shown in Easy. Claude's proposed cut is built with it for Andy's smoke: Easy keeps the fuel table and its
subtotals and does not show the derived totals below (net energy in GJ, per-capita energy, primary energy and
its intensity, nuclear waste produced, the PER factor). Andy ruled yes to that cut, and yes to the Actual
columns going in Expert too (PR #42).

**S05 (2026-11-27, PR #42).** Proposed and built for Andy's smoke: Easy drops only the explanatory note and the
four unlabelled compliance percentages beside the ✓. Everything else in S05 is an input or a headline result.

**Later, its own pass (Andy 2026-11-27):** collapsing the empty columns and rows that hiding leaves.

**How a section is curated, as it has gone:** Claude lists the section's inputs and its calculated values with
a recommended cut; Andy rules; the rules go in `obstyles.css` §8e and each gets a check in the witness.

**Interactive help (PR #38).** Andy: _"unlike V3, we have no way to switch On/Off interactive help, let's add
that for Easy mode and Expert mode, On by default in Easy, Off by default in Expert."_

- The Help button after the pill switches V3's field popovers. Each view keeps its own setting, in the browser
  (`objective4Help`), not in the project file.

In the build order above, this stub comes before step 1: the line that says what the Reference is and the
drift marker are new things on screen, and they should be designed for Easy mode from the start.

## What the engine does today (found 2026-11-26)

These are the facts the build has to respect. Each was run on the page, not read from comments.

- **An opening's host wall is per model** since PR #28. Before, a host left empty in the Reference took the
  Target's, and the Reference could end with a window hosted in a wall too small for it.
- **Copy from Target carries hosts in all three strengths** (Geometry, Geometry + Code, All Inputs), with the
  areas. So choice A's copy brings the Target's openings across whole.
- **A blank Reference input takes the Target's value** at the next full recalculation (a wall area emptied in
  the Reference came back as the Target's 400). Two consequences:
  - "Start from zero" (D) must write zeros, never blanks, or the Reference refills from the Target.
  - Any input where blank is itself a meaningful value needs the host's treatment (`copyToReference: false`).
    An opening's H (`dh_` + its row) is one still to do.
- **There is no copy from Reference to Target.** Choice B needs it built; it is the mirror of Copy from Target's
  All Inputs.

## Rulings

- Andy 2026-11-26, on the direction of this page: _"I agree with your direction."_
- Andy 2026-11-26, on Easy / Expert and the wizard: _"We might consider doing this sooner than later."_
- Andy 2026-11-26: _"V4 is replacing V3, so we shoudl not be looking backwards imho. V4 can import any V3 file
  and become more detailed or stay the same."_ This plan is for 4.0 only.
