# The Reference model: what it is, and how to start a project with it

This page is two things. Part 1 is guidance for users, and the draft of a blog post for OpenBuilding.ca. Part 2
is the workplan for building what Part 1 proposes.

Status: written 2026-11-26; the direction was agreed by Andy the same day. Nothing in "The proposal" is built
yet. "What OBJECTIVE does today" describes OBJECTIVE 4.0 as it stands.

# Part 1 — for users

## The short version

OBJECTIVE holds two buildings at once. The **Target** is the building you are designing. The **Reference** is
the building you compare it to. Every result on the screen (energy, carbon, cost) is shown for both, side by
side, with the difference between them.

The Reference is a complete model of its own. It is not a list of code minimums bolted to your design. You can
change anything in it without touching the Target, and the other way round.

That freedom is the most useful thing about OBJECTIVE, and it is also what new users find hardest. This page
explains why the two models are separate, and proposes one question at the start of a project that makes the
choice plain.

## Why the two models are separate

Because "what am I comparing against?" has more than one right answer.

1. **A renovation.** The Reference is the building as it stands today, with its real utility bills. The Target
   starts as a copy of it, then adds area, better walls, better windows, new equipment. The difference is what
   the renovation buys.
2. **The same building, built to code.** The Reference has the Target's shape and size, with the minimum
   assemblies and equipment a code or standard allows. This is the classic compliance comparison. It also
   answers questions like "steel and concrete against mass timber" for the same floor plan.
3. **The same building somewhere else.** A retailer with a store in Toronto, and bills for it, sets Toronto as
   the Reference and tries Kamloops as the Target. The difference is the climate.
4. **A check against a standard's own method.** In our F280 case studies the Reference holds every input CSA
   F280 would assume, and the Target models the same house the OBJECTIVE way.

No single rule for "what the Reference should hold" serves all four. So OBJECTIVE has no such rule. A value
you have set in one model is never overwritten by the other, which also means they can never fight over it.

## What confuses people

- **"I typed my areas into the Target. Why didn't the Reference follow?"** Because it is a separate building.
  Until you copy your geometry across, the Reference is still the sample project's building, and the comparison
  is between two different buildings.
- **Drift.** A project is never empty: you start from a finished sample and change what differs. That is on
  purpose. An empty model gives wrong answers until every field is filled, and that is a common complaint about
  other energy modelling tools. The cost is that the Reference keeps the sample's values until you update it,
  and nothing on screen tells you the two models have drifted apart.
- **The copy is easy to miss.** It lives in a small menu beside the Reference button.

## What OBJECTIVE does today

OBJECTIVE 4.0 replaces version 3. It opens any version 3 file; the project can stay as it was or be made more
detailed. What follows is 4.0.

- A new session opens on a finished sample project. Load Sample offers the other case studies.
- The Target / Reference switch shows either model. Every input can be edited in either.
- **Copy from Target** (the menu beside Reference) copies one way, Target to Reference, in three strengths:
  - **Geometry**: areas, volumes and layout. The Reference keeps its own assemblies, windows and equipment.
  - **Geometry + Code**: the same, then the chosen standard's minimum values are written over the Reference.
    This is use 2 above, and the most common.
  - **All Inputs**: an exact twin of the Target. Only the Reference's building standard is left alone.
- A code value in the Reference is a starting value, not a lock. You can type over it.
- An input left blank in the Reference is filled from the Target. An input that holds a value is left alone.
- There is no copy the other way (Reference to Target), no "start from zero", and no notice when the two
  models differ in shape.

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

## Open questions

1. Is A the right default for a new project, or should nothing be chosen until the user answers?
2. For A, is "geometry" the same list the Geometry copy uses today, or should climate and occupancy follow too?
3. In B, do the Reference's utility bills stay with the Reference only, or does the Target start with them as
   its "actual" figures?
4. Does "start from zero" empty the climate location as well, or keep it?
5. Should the choice be saved in the project file, so a reopened project still says what its Reference is?

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
- Andy 2026-11-26: _"V4 is replacing V3, so we shoudl not be looking backwards imho. V4 can import any V3 file
  and become more detailed or stay the same."_ This plan is for 4.0 only.
