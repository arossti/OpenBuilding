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

### ▶ START HERE (handoff 2026-11-26 evening, laptop) — written for a cold start after a /clear

**LIVE: `main` `7507a70` (PR #23), deployed to https://arossti.github.io/OpenBuilding/.** **This branch is `OnePage`**
(Andy named it), cut from that `main`: the one page is built (below), Andy smoked it 2026-11-26 and gave the word
to merge it as PR #24. The next arc is PENDING 2, on a fresh branch from `main`.
Local servers (they die on reboot): `python3 schema/scripts/nocache-serve.py 8822` here, `node test/static-server.cjs 8791`
in andy-rnd for the V3 page.

**SHIPPED 2026-11-26 (all merged):**

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

**PENDING, in order:**

1. **ONEPAGE — ✅ PR #24, smoked by Andy.** Andy 2026-11-26: *"each page gets a S18
   title which is then duplicated in the radiused, collapsible header ... We will keep the radiused, collapsible
   headers, add the subheader text to them ... then we can move ALL collapsable header sections into one container
   instead of each one getting its own container. Then it will function like V3, where we can toggle ALL sections
   On/Off with the same +/- button to the far right of the main header, and then the masthead menu will just anchor
   scroll to the relevant section. This will let us use the browser's print function to print all sections, like our
   V3 does, as a formatted report. We lean 100% on the browser's print functions. Nothing fancy."*
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
2. **THE OPENING BUILDER on the splash page.** `index.html`'s last tile slot (bottom right, beside Section Builder) is
   empty: add the Opening Builder from ABCD.EARTH (`artex-osx/docs/mockups/opening-builder.html`) through
   `publish_builders.py` (add it to `PAGES`, or to `SNAPSHOTS` if it cannot be rebuilt from today's seed; its cost
   disclaimer is an older copy than the shared one — Andy's to settle), then `npm run builders:publish` and a tile
   like the other Builders'.
3. **Reference remainders:** S19's own Reference display; S21 (Andy: *"may show the Reference model vs. Target model,
   I have not considered that case yet"* — ❓ his); andy-rnd's `ghostedReference`, `referenceDefaults` and
   `hoverOnScreenModel` behaviours checked on this page.
4. **m_10 "Unavailable"** after Trust on a 4-opening fixture (block below, ⚠ OPEN).
5. **ABCD BUGLIST #266**, so the Assembly Builder is rebuilt from today's seed.
6. **SECOND TIER — a LIGHT MODE** (Andy 2026-11-26: *"switches the screen to white, and the headers to black/grey like
   the V3 (for familiarity). Dark/Light mode can be another header toggle."*): a second pill in the button row, one
   body class re-pointing the tokens (`tokens.css` neutrals; `obstyles.css` `--bg-*`, `--text*`, `--border`), so §8b /
   §8c follow. Check then: the Sankey's forced-light labels, the input box's sunken fill, the slider track, Reference
   red on white.

7. **THE BUILDERS INSIDE OBJECTIVE** (branch `Builders-In-OBJECTIVE`, Andy 2026-11-26): the Assembly Builder as a popup from
   S11's row IDs, Apply Selected writing the row's RSI; then the Opening Builder for windows; then S05's embodied
   carbon. **The plan is §10; nothing of it is built.** Start at B1 (ABCD.EARTH's page), after §10.6's questions.

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
⚠ **OPEN:** on that 4-opening fixture S01's m_10 (Actual vs Target %, the default case is Utility Bills) reads
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
Annex J's change (93.7–95.8 % before). Andy 2026-11-26: *"V3 will just ignore fields it does not have in the .CSV format"*. Other case studies are re-entered from their drawings as Andy has time; until then the Load Sample Projects
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

Nothing in this section is built. It is the plan for Andy to read; the phases are each a commit or a PR, in order.

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

| S11 type (`c_<row>`)            | Assembly Builder group  |
| ------------------------------- | ----------------------- |
| Roof                            | `Ra` Roof Exterior      |
| Wall above grade                | `Wa` Wall Exterior      |
| Exposed floor                   | `Fa` Floor Exterior     |
| Wall below grade (conditioned)  | `Wg` Wall Foundation    |
| Slab (conditioned)              | `Fg` Floor on Ground    |

### 10.3 Phases

- **B1 — the Assembly Builder's embed mode (ABCD.EARTH, then publish).** `?embed=1` shows the `.window` alone, filling
  the frame: no intro, no notes, no disclaimer. `&group=Wa` opens the library scrolled to that group, its first
  assembly selected; `&pick=<assembly id>` selects one by id (the row's current assembly, when it has one). In embed
  mode the title bar gains **Apply Selected**, which posts the message above for the selected assembly as the page
  shows it (its RSI method included), and **cancel** closes the popup. Outside embed mode the page is unchanged.
- **B2 — the popup and the buttons (this repo).** A new `js/objective-builders.mjs`, so V3's `src/` stays verbatim:
  one modal holding the iframe, sized to the window. Each opaque row's ID cell (B.4, B.5, B.9, B.10 and the added
  rows) becomes a button, by delegation on S11's table, that opens the Builder at the row's group.
- **B3 — Apply Selected.** The message writes `rsi_eff` into the row's `f_<row>` as a user edit (through V3's
  StateManager, so the graph recomputes U, heat loss and the rest), and the row remembers its assembly (id, name,
  method, carbon intensity) and shows the name beside its type. Typing an RSI by hand afterwards clears the link:
  the typed value wins. In Reference mode the buttons are inert, as the cells are.
- **B4 — windows, doors and skylights open the Opening Builder.** The same embed mode and message in
  `opening-builder.html`; the opening rows' ID cells (B.7, B.8) become buttons; Apply writes the U-value (`g_<row>`).
  What else an opening should carry across (SHGC to S10, width × height) is read from that page before this is built.
- **B5 — S05's embodied carbon from the assemblies.** Σ (assembly carbon intensity × the row's area) over S11's rows,
  divided by the conditioned area, offered as S05's Modelled Value (`i_41`). Later, by Andy's word.

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
- A row's assembly is a new thing for a project file to hold. Until 10.6 ❓1 is answered it lives for the session only.

### 10.6 Open questions (each with a recommendation)

1. ❓ **Does the saved project keep each row's assembly** (id, name, method)? Recommended: yes, as added fields in the
   4.0 file (§4's version stamp exists for this); an older file opens with none.
2. ❓ **Which value for below grade?** S11's B.9 and B.10 take an RSI and OBJECTIVE applies the ground itself.
   Recommended: the Builder's Effective RSI of the assembly alone, no ground added in the Builder.
3. ❓ **An assembly the user edited in the Builder** (it keeps edits in the browser): may it be applied? Recommended:
   yes, the message carries what the page shows; the row's name is marked "edited".
4. ❓ **B5's partial sum**: when some rows have no assembly. Recommended: show the sum with the count of rows it
   covers, and leave `i_41` typed until every opaque row has one.

## Appendix — Changelog

- 2026-11-25: P0 shipped on `ob-landing-cleanup` (HUD, S01–S22 sidebar, BEAM tabs deleted, Glossary = S22).

| Date       | Commit                        | Change                                                                                |
| ---------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| 2026-11-25 | andy-rnd `7870a44`, `0684e43` | the plan written in andy-rnd (§3, §4, §7, §8)                                         |
| 2026-11-25 | `99d5a70`                     | moved here; §0, §5 and §6 added                                                       |
| 2026-11-25 | `0a318bb`                     | §0 shipped / remaining; `objectivepro.html`; Assemblies published; §9 the port        |
| 2026-11-25 | `62cb91a`                     | ruled: Pro = v4, the Rust app and the web app                                         |
| 2026-11-25 | this commit                   | ruled: no BEAM legacy; S01 dashboard + masthead HUD; P0 rewritten; cold-start handoff |
