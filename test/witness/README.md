# test/witness — the probes run before each merge of OBJECTIVE 4.0 (2026-11-26)

Playwright scripts, kept as they were run. Not deployed (the Pages workflow copies named folders only) and not
linted. Playwright itself is installed in andy-rnd, so point `NODE_PATH` at it; WebKit is the installed browser,
and the print PDF in `onepage.cjs` uses the machine's own Chrome (`channel: "chrome"`).

Serve first (both die on reboot):

    python3 schema/scripts/nocache-serve.py 8831          # this repo; the scripts expect port 8831
    (cd ../andy-rnd && node test/static-server.cjs 8791)  # V3, for the parity comparison

Run from this repo's root; `<out>` is any folder for screenshots:

    export NODE_PATH=../andy-rnd/node_modules
    node test/witness/parity.cjs http://localhost:8831/objectivepro.html http://localhost:8791/index.html
    node test/witness/onepage.cjs <out>            # sidebar anchors, + / − for all, Reference, print PDF
    node test/witness/builders-assembly.cjs <out>  # §10 B2 + B3: B.9, B.10, B.5; save, type over, reload
    node test/witness/builders-opening.cjs <out>   # §10 B4: B.8.1, B.7.0, B.8.5
    node test/witness/builders-carbon.cjs <out>    # §10 B5: S05's E.3.5 against a hand sum
    node test/witness/builders-reference.cjs <out> # a row's assembly per model: Reference / Target independence
    node test/witness/s19-reference.cjs <out>      # S19's roof type, aspect and windows per model
    node test/witness/host-per-model.cjs           # Trust's 4-opening write: the Reference still computes
    node test/witness/display-format.cjs           # typed numbers across a model switch; S21's rounding
    ../andy-rnd/node_modules/.bin/playwright test --config=test/witness/v3-reference/pw.config.cjs
    node test/witness/garage-facing.cjs            # a wall to an attached garage: the Garage facing
    node test/witness/f280-run.cjs <case inputs dir> <out dir> --annexj ../andy-rnd/test/fixtures/f280-annex-j.json
    node test/witness/f280-summary.cjs <out>       # S21's calculation summary sheet (F280 Annex D / Table E.1)
    node test/witness/easy-expert.cjs <out>        # Easy / Expert: the pill, the Cell IDs, Help; no column letters

What each must show:

- `parity.cjs`: `2146 / 2146` on each of the 16 Load Sample cases, then `ALL MATCH` (about 4 minutes).
- The `builders-*` scripts print one line per step; the values to expect are in `schema/schema.md` §10 (B3, B4,
  B5 "Witnessed"). Their `reference click opens:` line reads `true` since 2026-11-26: the Builders work in both
  models.
- `builders-reference.cjs <out>`: Reference / Target independence. A timber wall and a certified window in the
  Target, a concrete wall and an aluminium window in the Reference, on the same rows: each model shows its own
  name, value and S05 E.3.5; another project clears both; the saved file brings both back; a U typed in the
  Reference clears the Reference's product only; Copy from Target → All Inputs carries the Target's across.
- A page opened fresh shows the launch modal once; the scripts set `objective4DisclaimerSeen` to skip it.
- `s19-reference.cjs <out>`: `target drawing unchanged: true | target controls unchanged: true` after the
  Reference takes a hip roof, aspect 2 and hidden windows, then `reload returns both drawings: true true`.
- `v3-reference/`: andy-rnd's `ghostedReference`, `referenceDefaults` and `hoverOnScreenModel` specs, changed
  only to open this page (wait for the graph, expand every section, load the 02 sample V3 auto-loads):
  `8 passed`.
- `host-per-model.cjs`: after Trust's write the Reference reads 190.1 with no hosts, the Target 82.8 and
  m_10 `49%` (it read `Unavailable`); the reloaded file shows the same; Copy from Target → All Inputs gives
  the Reference the Target's four hosts.
- `garage-facing.cjs`: 14 lines of `ok`, then `ALL OK`. A West wall with a window and a door turns to the
  Garage facing: the F280 design loss does not move, the window's solar goes to zero in F280's design solar,
  S10's annual gain and the ISO 52016 cooling, the wall and its door take F280 Table 3's shaded row (checked
  by hand in the script), the hover is the NBC note, the Reference does not move, the saved file returns it.
- `f280-run.cjs`: the qualified operator's run (CSA F280-12 Cl. 8.2) of the verification agent's case files.
  It opens each file of `<case inputs dir>/run_list.csv` in a fresh context, as the page's Open does, and writes
  `<out dir>/f280-results.json` and `.csv`: design heat loss and nominal gain with their terms, for the Target
  and the Reference (a variant file's Reference row is the base case), every field of the file against what the
  page holds, and every hosted opening against its wall and overhang. **The case files, the Annex J fixture and
  the results are private (values derived from CSA F280-12): keep all three outside this public repository.**
  The script holds none of them. `--only <regex>` runs some cases, `--jobs <n>` sets the parallel contexts.
- `display-format.cjs`: `Target changed by a round trip: 0 | Reference: 0` and `long decimals shown: 0` on the
  default project and on case 03 (F280); S04's bill reads `132,938.00`, S21's wall U `0.149`.
- `f280-summary.cjs <out>`: `ALL PASS`. The sheet lists Table E.1's 64 fields in order, each with a value, not
  entered, not carried (one: the interior shading) or not needed; its values are the sections' own; S21's
  record is per model and moves no design load; the saved file brings both models' record back as typed
  ("496 Fake Street" and "0402-96" whole); F280 Mode Off hides the record and the button; the button opens
  `f280-summary.html` in its own tab, whose first page is the summary sheet laid out as Annex D's Figure D.1
  (thirteen blocks, one printed page) ahead of the supplement. With `<out>` it also writes the print PDF by the
  machine's Chrome.
- `easy-expert.cjs <out>`: 45 lines of `ok`, then `ALL OK`. A first launch is in Easy (the class `op-easy` on
  `<html>`), the pill follows Copy from Target, no header cell's caption is its own column's letter in either
  view while row IDs, one-letter units (W, m) and named captions stay. Easy shows no Cell ID but S11's Builder
  buttons and S10's opening rows; Expert shows all of them in one style, the ID column's; no row draws its own
  ID twice; print shows the IDs in Easy too. Every number is right-justified (more than 400 on the default
  project, none left or centred), typed words are left-justified, a caption over numbers is right-justified.
  Help is on in Easy and off in Expert at first (a field's popover opens, with a dark title, or does not), and
  each view keeps its own setting across a reload. Expert shows the same values, the same cells and the same
  saved file (the view and the help setting are not in the file); the view survives a reload and New, and does
  not move the model on screen. S02's prices of gas, propane, wood and oil show only while S.2 is at Utility
  Bills, in both views and per model, and electricity's always. No ID names two different things, the numbers
  of 2026-11-27 are where they were put, and the Reference shows the Target's IDs. With `<out>` it writes three
  pictures of the button row.
