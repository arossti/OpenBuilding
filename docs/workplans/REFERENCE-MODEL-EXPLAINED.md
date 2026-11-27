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
