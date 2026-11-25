# OBJECTIVE 4.0 — the web workplan (OpenBuilding.ca)

> **Workplan + cold-start handoff for OBJECTIVE 4.0 on the web and the OpenBuilding.ca tools around it.** Read
> section 0 first. Moved here from andy-rnd `docs/OBJECTIVE-V4.md` on 2026-11-25 (Andy: yes); andy-rnd keeps a
> pointer. Its sections 3, 4, 7 and 8 are that plan as written; sections 0, 5 and 6 are new.

> Andy 2026-11-25: *"V3 is the upgrade with F280. V4 is the bridge to dynamic hourly analysis and ABCD integration
> and ASHRAE 140 compliance."* and *"My preference is in V4.0, not to offer the complex support of non-oriented walls
> and non-hosted windows."* This is the plan for him to read before anything is built. Nothing below is built yet
> except what §1 lists.

---

## 0. Cold-start handoff (read this first)

### Status as of 2026-11-25 evening (branch `ob-landing-cleanup`, pushed, no PR)

No deploy until the pieces are in place (Andy: *"No deploy intil we have all of our pieces in place, we can just
commit-push until then. So no PR yet until it is cleaned of BfCA references."*). Only a push to `main` redeploys Pages.

**Shipped on the branch**
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
- The BfCA references left in data and docs: the BEAM material data (`schema/`, `docs/csv files from BEAM/`,
  `schema/schema.md`), retired when Materials replaces the Database; the README's history sections.
- The repo's CLAUDE.md rewrite, with Andy.
- ABCD BUGLIST #266, so Assemblies is rebuilt from today's seed.

**Next: the port, §9.**

### The plan's status as written (andy-rnd, 2026-11-25)

- **v3** = objective PR #134 at `071f25a`: the live site plus the F280 package, nothing else (#134 was reset there
  2026-11-25 after the hosting had been pushed onto it; Mark told on #134).
- **v4's start** = andy-rnd `main`: S11 hosting (#23, `d12c8d2`) and its polish (#24). Both still let a window sit
  in no wall and a wall face "Average"; v4 takes those away (§2).
- **FROZEN** (Andy 2026-11-25: *"We'll freeze V4 where it is now on RND"*): nothing of V4-1+ is built until he
  reopens it. Its state is andy-rnd #24 (`s11-hosting-polish`), served at http://127.0.0.1:8791 on the laptop.
- **The fastest way in is the PDF-Parser** (Andy 2026-11-25: *"the PDF parser becomes the fastest input method
  available to us"*): see V4-7. **The repos combine** and v4 deploys to GitHub Pages: §4. The OpenBuilding repo's code is Andy's / OpenBuilding's to reuse here.
- **NEXT when reopened:** Andy's porting workplan, then §5's answers, then V4-1.

### What OBJECTIVE 4.0 is

Andy 2026-11-25: *"OBJECTIVE pro lives in the ABCD.EARTH desktop app, but this web version extends what the old V3
of OBJECTIVE can do with many shared methods."* v3 stays the live, static/monthly one-zone modeller on Cloudflare
(objective.openbuilding.ca); v4 is its web successor here, the bridge to hourly analysis, ASHRAE 140 and ABCD.

### What it is NOT

- Not the hourly engine or real geometry: those live in the ABCD.EARTH app
  (`artex-osx/docs/architecture discipline/ABCD-OBJECTIVE-PRO.md` in that repo). ⚠ Andy named this page's address
  `objectivepro` (2026-11-25: *"it should not be called beamweb in the URI, but OBJECTIVEpro"*), while that doc calls
  the desktop app OBJECTIVE Pro: ❓ one name or two (§8).
- Not a place to curate materials: the Builders here are read-only (Andy 2026-11-25: *"we do not expect a user to
  curate materials, it is too fraught, as EPD and cost sources are required"*).
- Not a second copy of any method (§6).

### Where to pick up next (cold-start one-liner)

§9.2 P0: the sidebar becomes S01–S21 on `objectivepro.html`; then S11 and S12 first, for the Trust mapping tests.

---

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
with a banner: *"Envelope from an OBJECTIVE 3 file: enter its walls and windows. Open it in OBJECTIVE 3 to see
it as it was."* (a link to the live site). Assembly RSIs and U-values: ❓ §5.

**V4-4 — the file says its version.** A v4 CSV carries `objective_version` = 4, so a later v4 opens its own files
whole and only a v3 file takes V4-3's path.

**V4-5 — the cases.** F280-1 re-expressed with its windows hosted and their overhangs (the old phase D): it must
hold `test/f280-results.json` (±1 W; the folded slider equals the plain fraction plus the north credit, so it
can). Other case studies are re-entered from their drawings as Andy has time; until then the Load Sample Projects
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

| Card | Page | State |
|---|---|---|
| Take Off, Eh! | `takeoffeh.html` | live (the PDF-Parser renamed) |
| Materials | `builders/material-builder.html` | published, read-only |
| Material Database | `database.html` | kept for its look until Materials replaces it (Andy) |
| OBJECTIVE | `objectivepro.html` (was `beamweb.html`) | v4 Alpha: the BEAM layout, being repurposed as v4's inputs (§9) |
| Assemblies | `builders/assembly-builder.html` | published as a snapshot of 2026-10-22 (ABCD BUGLIST #266) |
| Section Builder | `builders/section-builder.html` | published |

### 5.2 The Builders are build output from ABCD.EARTH

`builders/` is written by ABCD.EARTH `artex-osx/docs/mockups/publish_builders.py --to <this repo>/builders` and is
never edited here. `builders/BUILD.json` stamps the ABCD commit and a hash of each seed file; `--check` reports a
stale copy. A re-seed or a page fix is made in ABCD.EARTH and published again (ABCD-BUILDERS §7.0, ruled 2026-09-15:
*"B sounds like the right shape, a public API would be a gong-show."*).

**The link (Andy 2026-11-25: *"Provided we keep a link so new data from ABCD can feed the web deployment."*)**:
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

| Method | Its one copy | Reaches the other product by | Witness |
|---|---|---|---|
| Material library: λ, ρ, carbon lines, EPD sources | ABCD.EARTH `seed/materials.json` | `publish_builders.py` → `builders/` | `BUILD.json` seed hash, `--check` |
| Price book | ABCD.EARTH `seed/prices.json` | the same | the same |
| Assembly fold: RSI, carbon, cost per m² | ABCD.EARTH Rust (`builders/assemblies.rs`) | the Assembly Builder page's JavaScript fold | the app's fold and HFT fixtures; **#266 open** |
| Cost markup chain (40/40/20) | ABCD.EARTH `CostPolicy` (labour 1.0, P&O 0.5, tax 0.13) | the pages' defaults | the fold fixture (#266 found the 0.2) |
| Junction sections | ABCD.EARTH `seed/junctions.json` | the Section Builder page | ❓ none yet |
| F280, BASESIMP, AIM-2, ISO 52016 cooling | the OBJECTIVE web codebase (v3 and v4 share it, §7.1) | ported into Pro by ABCD-OBJECTIVE-PRO | Excel-computed fixtures (`test/basesimp.test.cjs`, `aim2.test.cjs`) and the F280 tables |
| Hourly energy balance (8760 h) | ABCD.EARTH (ABCD-OBJECTIVE-PRO §4.6) | ❓ how v4 reaches it is open | — |
| Envelope takeoff | Take Off, Eh! (this repo) | its CSV into v4's S11 (V4-7) | `sample csv exports/takeoffeh-measurements.csv` |
| Design tokens (colours, fonts) | ❓ proposed: ABCD.EARTH `docs/mockups/tokens.css` | published beside the Builders; `obstyles.css` maps its names onto them | — |

## 7. Where things live

### 7.1 What stays shared with v3

The computation graph, every section outside S10/S11, F280, BASESIMP, AIM-2 and the cooling engine are one
codebase. A v3 fix lands on objective `main` and is merged into andy-rnd `main`. v4-only code (§2) never goes to
v3.

### 7.2 Where v4 lives (RULED, Andy 2026-11-25)

*"We will combine the repos so I can deploy all for testing to the remote gh pages site (not the cloudflare site
which will remain the V3 deployment)"*. So:
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
6. **One name or two: OBJECTIVE Pro.** The web page's address is `objectivepro.html` (Andy 2026-11-25), and
   ABCD-OBJECTIVE-PRO calls the desktop app OBJECTIVE Pro. Recommendation: say which is "Pro" before either is
   public; the page title says OBJECTIVE 4.0 meanwhile.
7. **BEAM's own tabs during the port** (the 12 assembly tabs, REVIEW, RESULTS, Glossary, Energy GHG).
   Recommendation: fold them into a "BEAM (legacy)" group at P0 and delete each once a section replaces its job.

---

## 9. The port: OBJECTIVE's sections into `objectivepro.html`

Andy 2026-11-25: *"I am personally keep to port the OBJECTIVE v4 RND methods and data into the new dark-mode
[page] … We will keep the 'PROJECT' tab, but the masthead menu and sections will then accord to our S03-S21, where S1
shoudl remain the intro page but will incorporate S01 somehow, and S02 is the Project tab with its current format."*
This reopens v4 (frozen at andy-rnd `main` until now). The source is andy-rnd `main` `5e0b2f0` (`src/sections/`,
`src/core/`, ~24 k lines); the code moves here, it is not linked.

### 9.1 The section map (the sidebar becomes this)

| Tab | OBJECTIVE section | andy-rnd lines | Notes |
|---|---|---|---|
| S01 | Introduction + **Key Values** | 789 | the intro page, carrying S01's key values |
| S02 | **PROJECT** = Building Information | 1,069 | the current PROJECT tab's format, S02's fields |
| S03 | Climate Calculations | 1,507 | |
| S04 | Actual vs. Target Energy & Carbon | 918 | |
| S05 | CO2e Emissions | 533 | |
| S06 | Renewable Energy | 306 | |
| S07 | Water Use | 736 | |
| S08 | Indoor Air Quality | 408 | |
| S09 | Occupant + Internal Gains | 1,062 | |
| S10 | Radiant Gains | 1,491 | windows; V4-2 reads S11 |
| S11 | Transmission Losses | 2,508 | **the envelope: Trust / Trust + Verify's target** (V4-1, V4-2, V4-7) |
| S12 | Volume and Surface Metrics | 1,205 | **Trust's second target** (volumes) |
| S13 | Mechanical Loads | 1,730 | |
| S14 | TEDI & TELI | 515 | |
| S15 | TEUI | 862 | |
| S16 | Sankey Diagram | 2,067 + 453 | |
| S17 | Dependency Graph | 27 | already here: the BEAM page's Dependency Graph tab came from OBJECTIVE |
| S18 | Optimize | 26 | |
| S19 | WOMBAT — 3D Thermal Topology | 2,059 | |
| S20 | Notes & Debug | 1,188 | |
| S21 | CSA F280 Compliance | 1,921 | |

### 9.2 Phases (recommended)

- **P0 — the scaffold.** The sidebar becomes S01–S21 (grouped; the group names are Andy's), S02 keeps the PROJECT
  tab, each new tab a placeholder naming its section. BEAM's assembly, review and reference tabs fold into a
  "BEAM (legacy)" group until the sections replace them. Trust / Trust + Verify keep working on PROJECT.
- **P1 — the engine.** OBJECTIVE's core (the state manager, the dual Target / Reference state, the calculation
  graph) moves in unchanged and runs headless behind the page; the CSV import/export too.
- **P2 — S11 and S12 first**, in the dark theme: they are what Trust / Trust + Verify fill, so the PDF-mapping tests
  (Andy, the same evening) can aim at real fields. The bridge's mapping (`js/beam/pdf-bridge-import.mjs`, `polygon-map.mjs`)
  learns S11's rows and S12's volumes.
- **P3 — the rest**, section by section, each checked against andy-rnd's own tests and case studies (the shared
  computation, §7.1), S01's key values last because they read everything.

## Appendix — Changelog

| Date | Commit | Change |
|---|---|---|
| 2026-11-25 | andy-rnd `7870a44`, `0684e43` | the plan written in andy-rnd (§3, §4, §7, §8) |
| 2026-11-25 | `99d5a70` | moved here; §0, §5 and §6 added |
| 2026-11-25 | this commit | §0 shipped / remaining; `objectivepro.html`; Assemblies published; §9 the port |
