/**
 * Openings.js - the envelope's ROWS: S10's doors and windows with their S11 twins, and S11's opaque
 * elements (roofs, walls, floors; walls below grade, slabs).
 *
 * One list, read by both sections and by every node file that walks the rows (RadiantGains,
 * TransmissionLoss, Cooling, SectionCompliance, F280Compliance, VolumeMetrics), the Sankeys and the CSV.
 * Andy 2026-11-20: an element is a ROW with its own orientation and type, not a fixed label. A door or
 * window row added in S10 brings its twin in S11, which takes its area and holds its U-value; an opaque
 * row lives in S11 alone, its type chosen per row (above grade: Roof / Wall / Exposed floor; below grade:
 * Wall / Slab), a wall its facing, its area typed or L x H. The model carries every row (pre-built, as
 * the OBC Matrix's are); + shows a group's next row, - hides its last and takes it out of the
 * calculation (its area 0, in both models). A row with an area stays shown.
 *
 * The first rows keep the IDs files have always used (73-78 / 85-95), so every saved project reads as
 * before; the rows after them take a letter (73a, 78a, 87a, 95a ...).
 */
(function () {
  window.TEUI = window.TEUI || {};

  // ------------------------------------------------------------------------------------------------
  // The rows
  // ------------------------------------------------------------------------------------------------
  // A row's letter after its number: a ... z, then aa ... az (Andy 2026-11-24: up to 40 windows, 12 doors,
  // so a wall can host ten)
  const ABC = "abcdefghijklmnopqrstuvwxyz";
  const letters = n =>
    Array.from({ length: n }, (_, i) => (i < 26 ? ABC[i] : ABC[Math.floor(i / 26) - 1] + ABC[i % 26]));

  const DOORS = [
    { s10: "73", s11: "88", id: "doors", n: 1, kind: "door", group: "doors" },
    ...letters(11).map((l, i) => ({
      s10: `73${l}`,
      s11: `88${l}`,
      id: `door${2 + i}`,
      n: 2 + i,
      kind: "door",
      group: "doors",
    })),
  ];

  const WINDOWS = [
    {
      s10: "74",
      s11: "89",
      id: "windowNorth",
      n: 1,
      kind: "window",
      group: "windows",
    },
    {
      s10: "75",
      s11: "90",
      id: "windowEast",
      n: 2,
      kind: "window",
      group: "windows",
    },
    {
      s10: "76",
      s11: "91",
      id: "windowSouth",
      n: 3,
      kind: "window",
      group: "windows",
    },
    {
      s10: "77",
      s11: "92",
      id: "windowWest",
      n: 4,
      kind: "window",
      group: "windows",
    },
    {
      s10: "78",
      s11: "93",
      id: "skylights",
      n: 5,
      kind: "skylight",
      group: "windows",
    },
    ...letters(35).map((l, i) => ({
      s10: `78${l}`,
      s11: `93${l}`,
      id: `window${6 + i}`,
      n: 6 + i,
      kind: "window",
      group: "windows",
    })),
  ];

  /**
   * The opaque element types, each the B-number and the per-TYPE sum (TransmissionLossNodes registers
   * transmissionLoss.<type>.* as the sum over the rows of that type, so every reader of the old fixed
   * rows - BASESIMP, S12, S21, F280, Wombat's footprint - reads the type's total unchanged). film: the
   * inside surface resistance by the direction of heat flow (m2K/W); tilt: the cooling calculation's sky
   * view; base: the row whose field each standard's value is keyed by (ReferenceValues f_85 ...).
   */
  const TYPES = {
    roof: {
      b: "B.4",
      label: "Roof",
      grade: "above",
      film: 0.1,
      tilt: "roof",
      base: "85",
    },
    walls: {
      b: "B.5",
      label: "Wall above grade",
      grade: "above",
      film: 0.13,
      tilt: "wall",
      base: "86",
    },
    exposedFloor: {
      b: "B.6",
      label: "Exposed floor",
      grade: "above",
      film: 0.17,
      tilt: "floor",
      base: "87",
    },
    wallsBelowGrade: {
      b: "B.9",
      label: "Wall below grade",
      grade: "below",
      film: 0.13,
      tilt: "ground",
      base: "94",
    },
    slabOnGrade: {
      b: "B.10",
      label: "Slab",
      grade: "below",
      film: 0.17,
      tilt: "ground",
      base: "95",
    },
  };
  const ABOVE_TYPES = ["roof", "walls", "exposedFloor"];
  const BELOW_TYPES = ["wallsBelowGrade", "slabOnGrade"];

  // Above grade: B.4-B.6 and 9 rows after them (12, Andy 2026-11-20); below grade: B.9-B.10 and 4 (6).
  // A row after the first takes its group's commonest new element: a wall.
  const ABOVE = [
    { s11: "85", id: "opaque85", type: "roof", kind: "opaque", group: "above" },
    {
      s11: "86",
      id: "opaque86",
      type: "walls",
      kind: "opaque",
      group: "above",
    },
    {
      s11: "87",
      id: "opaque87",
      type: "exposedFloor",
      kind: "opaque",
      group: "above",
    },
    ...letters(9).map(l => ({
      s11: `87${l}`,
      id: `opaque87${l}`,
      type: "walls",
      kind: "opaque",
      group: "above",
    })),
  ];
  const BELOW = [
    {
      s11: "94",
      id: "opaque94",
      type: "wallsBelowGrade",
      kind: "opaque",
      group: "below",
    },
    {
      s11: "95",
      id: "opaque95",
      type: "slabOnGrade",
      kind: "opaque",
      group: "below",
    },
    ...letters(4).map(l => ({
      s11: `95${l}`,
      id: `opaque95${l}`,
      type: "wallsBelowGrade",
      kind: "opaque",
      group: "below",
    })),
  ];

  const ALL = [...DOORS, ...WINDOWS]; // the openings
  const OPAQUE = [...ABOVE, ...BELOW];

  // The rows every model has always shown; the rest wait for +
  const BASE = new Set([
    "73",
    "74",
    "75",
    "76",
    "77",
    "78",
    "85",
    "86",
    "87",
    "94",
    "95",
  ]);
  const isSlot = o => !BASE.has(o.s10 || o.s11);

  const GROUPS = {
    doors: { rows: DOORS, label: "door", sections: ["S10", "S11"] },
    windows: { rows: WINDOWS, label: "window", sections: ["S10", "S11"] },
    above: { rows: ABOVE, label: "above-grade element", sections: ["S11"] },
    below: { rows: BELOW, label: "below-grade element", sections: ["S11"] },
  };

  const s10RowId = o => (o.kind === "door" ? `G.7.${o.n}` : `G.8.${o.n}`);
  function s11RowId(o) {
    if (o.kind === "opaque") return isSlot(o) ? `B.${o.s11}` : TYPES[o.type].b;
    return o.kind === "door"
      ? o.n === 1
        ? "B.7.0"
        : `B.7.${o.n}`
      : `B.8.${o.n}`;
  }

  // The field holding a row's area: an opening's is its S10 row's, an opaque row's its own
  const areaField = o => (o.s10 ? `d_${o.s10}` : `d_${o.s11}`);

  // Short orientation names, for a label beside the row's number ("G.8.1 Window · N")
  const SHORT = {
    North: "N",
    NorthEast: "NE",
    East: "E",
    SouthEast: "SE",
    South: "S",
    SouthWest: "SW",
    West: "W",
    NorthWest: "NW",
    Average: "Avg",
    Skylight: "Sky",
  };
  const FACINGS = [
    "North",
    "NorthEast",
    "East",
    "SouthEast",
    "South",
    "SouthWest",
    "West",
    "NorthWest",
    "Average",
  ];

  // ------------------------------------------------------------------------------------------------
  // Which rows show: a slot row shows when + revealed it this session, or when it is IN USE in either model
  // (an area; a door / window also a host). A loaded project shows its own rows in use, and nothing else.
  // (Hosting, 2026-11-24: a wall's + takes any free row, so the rows shown need not be the first ones.)
  // ------------------------------------------------------------------------------------------------
  const revealed = { doors: new Set(), windows: new Set(), above: new Set(), below: new Set() };

  const num = v => {
    const n = parseFloat(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  function areaOf(o) {
    const SM = window.TEUI.StateManager;
    if (!SM) return 0;
    return Math.max(
      num(SM.getValue(areaField(o))),
      num(SM.getValue(`ref_${areaField(o)}`))
    );
  }

  const hostField = o => `ch_${o.s11}`;
  /** A row in use, in either model: an area, or (a door / window) a host. */
  function inUse(o) {
    return areaOf(o) > 0 || hosted(o);
  }

  /** A door / window row hosted in either model. */
  function hosted(o) {
    const SM = window.TEUI.StateManager;
    return !!o.s10 && !!(SM && (SM.getValue(hostField(o)) || SM.getValue(`ref_${hostField(o)}`)));
  }

  function isShown(o) {
    return !isSlot(o) || revealed[o.group].has(o.s11) || inUse(o);
  }

  /** How many of the group's slot rows show (0 = only the rows every model has). */
  function shownSlots(group) {
    return GROUPS[group].rows.filter(isSlot).filter(isShown).length;
  }

  /** The row + shows next: the first hidden one after the last shown, else the first hidden one (a gap). */
  function nextFree(group) {
    const slots = GROUPS[group].rows.filter(isSlot);
    let last = -1;
    slots.forEach((o, i) => {
      if (isShown(o)) last = i;
    });
    return slots.slice(last + 1).find(o => !isShown(o)) || slots.find(o => !isShown(o)) || null;
  }

  function notify() {
    document.dispatchEvent(new CustomEvent("teui-openings-changed"));
  }

  /** A project loaded: the rows shown are its own (those with an area), not the ones + revealed before. */
  function resetShown() {
    Object.values(revealed).forEach(set => set.clear());
  }

  /** An opaque row's type in a model ("" the Target, "ref_" the Reference): its stored choice, or its default. */
  function typeOf(o, prefix = "") {
    const stored = window.TEUI.StateManager?.getValue(`${prefix}c_${o.s11}`);
    return TYPES[stored] ? stored : o.type;
  }

  /**
   * Each shown opaque row's number in a model, by its type in table order: the first wall "B.5", the
   * next "B.5.2" (S11's ID column, the Sankeys' names). { s11: id }.
   */
  function opaqueIds(prefix = "") {
    const counts = {};
    const ids = {};
    OPAQUE.forEach(o => {
      if (!isShown(o)) return;
      const type = typeOf(o, prefix);
      counts[type] = (counts[type] || 0) + 1;
      ids[o.s11] =
        counts[type] === 1 ? TYPES[type].b : `${TYPES[type].b}.${counts[type]}`;
    });
    return ids;
  }

  /** An opaque row's name in a model: "B.5.2 Wall above grade · N" (a wall's facing), "B.4 Roof". */
  function opaqueName(o, prefix = "") {
    const type = typeOf(o, prefix);
    const facing =
      window.TEUI.StateManager?.getValue(`${prefix}cf_${o.s11}`) ||
      (isSlot(o) ? "North" : "Average");
    return `${opaqueIds(prefix)[o.s11] || TYPES[type].b} ${TYPES[type].label}${type === "walls" ? ` · ${SHORT[facing] || facing}` : ""}`;
  }

  /**
   * +: show the group's next row. An empty row starts as a copy of the nearest row above it of its own
   * kind, in both models, so a second window or wall is like the first until it is told otherwise:
   *   - a door / window: its SHGC and shading (S10) and its U-value (S11) - G.8.6 copies G.8.4, a window,
   *     not G.8.5's skylight; its area and orientation stay its own (0, North for a window);
   *   - an opaque row: the RSI of the nearest row above holding its type (a new wall copies B.5's).
   */
  function add(group, { host = null, prefix: hostPrefix = "" } = {}) {
    const rows = GROUPS[group].rows;
    const o = nextFree(group);
    if (!o) return null;
    const SM = window.TEUI.StateManager;
    const copied = new Set();
    if (SM && !(areaOf(o) > 0)) {
      ["", "ref_"].forEach(prefix => {
        const copy = (from, to) => {
          const value = SM.getValue(`${prefix}${from}`);
          if (value !== undefined && value !== null && value !== "") {
            SM.setValue(`${prefix}${to}`, value, "user-modified");
            copied.add(to);
          }
        };
        const before = rows.slice(0, rows.indexOf(o)).reverse();
        if (o.kind === "opaque") {
          const type = typeOf(o, prefix);
          const above = before.find(r => typeOf(r, prefix) === type);
          if (above) copy(`f_${above.s11}`, `f_${o.s11}`);
        } else {
          const above = before.find(r => r.kind === o.kind);
          if (!above) return;
          ["f", "g", "h"].forEach(col =>
            copy(`${col}_${above.s10}`, `${col}_${o.s10}`)
          );
          copy(`g_${above.s11}`, `g_${o.s11}`);
        }
      });
    }
    revealed[group].add(o.s11);
    // a wall's +: the row is born in its wall, in the model on screen (a host is per model, as its dropdown)
    if (host && SM) SM.setValue(`${hostPrefix}${hostField(o)}`, String(host), "user-modified");
    notify();
    // the copied fields, shown in the model on screen (the graph took them through the StateManager):
    // a typed number as the section formats it (a U-value 3 places, an RSI 2), a slider as its value
    const FM = window.TEUI.FieldManager;
    const prefix = window.TEUI.ReferenceToggle?.isReferenceMode() ? "ref_" : "";
    copied.forEach(id => {
      const def = FM?.getField?.(id);
      const value = SM?.getValue(`${prefix}${id}`);
      if (!def || value === undefined || value === null) return;
      const shown =
        def.type === "editable"
          ? window.TEUI.formatNumber(
              parseFloat(value),
              id.startsWith("g_") ? "number-3dp" : "number-2dp"
            )
          : String(value);
      FM.updateFieldDisplay(id, shown, def);
    });
    return o;
  }

  /** A row out of the calculation in one model: its area 0; L and H gone; a door / window's host and quantity too. */
  function clearRow(o, prefix) {
    const SM = window.TEUI.StateManager;
    if (!SM) return;
    SM.setValue(`${prefix}${areaField(o)}`, "0", "user-modified");
    SM.setValue(`${prefix}dl_${o.s11}`, "", "user-modified");
    SM.setValue(`${prefix}dh_${o.s11}`, "", "user-modified");
    if (o.s10) {
      SM.setValue(`${prefix}${hostField(o)}`, "", "user-modified");
      SM.setValue(`${prefix}dq_${o.s11}`, "", "user-modified");
    }
  }

  /**
   * -: hide the group's last shown row and take it out of the calculation, in both models. A hosted row is
   * its wall's to take out (its own -), never the group's.
   */
  function remove(group) {
    const o = GROUPS[group].rows.filter(isSlot).filter(isShown).filter(r => !hosted(r)).pop();
    if (!o) return;
    revealed[group].delete(o.s11);
    ["", "ref_"].forEach(prefix => clearRow(o, prefix));
    notify();
  }

  /**
   * A hosted row's -: the opening out of its wall, in the model on screen (a host is per model). A row
   * after the first hides unless the other model still uses it; a first row stays, empty, in its group.
   */
  function takeOut(o, prefix = "") {
    revealed[o.group].delete(o.s11);
    clearRow(o, prefix);
    notify();
  }

  /** Show or hide a section's rows to match (S10 or S11), and set its +/- buttons. */
  function applyVisibility(section) {
    const key = section === "S10" ? "s10" : "s11";
    const rowId = section === "S10" ? s10RowId : s11RowId;
    const rows = section === "S10" ? ALL : [...ALL, ...OPAQUE];
    rows.forEach(o => {
      document.querySelectorAll(`tr[data-id="${rowId(o)}"]`).forEach(tr => {
        tr.style.display = isShown(o) ? "" : "none";
      });
    });
    Object.keys(GROUPS).forEach(group => {
      const canAdd = !!nextFree(group);
      const canRemove = GROUPS[group].rows.some(r => isSlot(r) && isShown(r) && !hosted(r));
      document
        .querySelectorAll(
          `.openings-controls[data-section="${key}"][data-group="${group}"]`
        )
        .forEach(c => {
          const addBtn = c.querySelector(".expandable-add-btn");
          const removeBtn = c.querySelector(".expandable-remove-btn");
          // both always shown, so the control is plain to see (Andy 2026-11-25); greyed when they cannot act
          if (addBtn) addBtn.disabled = !canAdd;
          if (removeBtn) {
            removeBtn.disabled = !canRemove;
            removeBtn.title = canRemove
              ? `Remove the last ${GROUPS[group].label} row (its area leaves the calculation)`
              : `The first ${GROUPS[group].label} rows stay; a row + added can be removed`;
          }
        });
    });
  }

  /** The +/- controls, in the first cell of each group's first row (a section's own groups). */
  function installControls(section) {
    const key = section === "S10" ? "s10" : "s11";
    Object.entries(GROUPS).forEach(([group, g]) => {
      if (!g.sections.includes(section)) return;
      const trigger =
        section === "S10" ? s10RowId(g.rows[0]) : s11RowId(g.rows[0]);
      const tr = document.querySelector(`tr[data-id="${trigger}"]`);
      const cell = tr?.firstElementChild;
      if (!cell || cell.querySelector(".openings-controls")) return;
      cell.classList.add("expandable-row-trigger");
      cell.innerHTML =
        `<div class="expandable-controls openings-controls" data-section="${key}" data-group="${group}">` +
        `<button type="button" class="expandable-add-btn" title="Add a ${g.label} row">+</button>` +
        `<button type="button" class="expandable-remove-btn" title="Remove the last ${g.label} row (its area leaves the calculation)">−</button>` +
        `</div>`;
      cell
        .querySelector(".expandable-add-btn")
        .addEventListener("click", () => add(group));
      cell
        .querySelector(".expandable-remove-btn")
        .addEventListener("click", () => remove(group));
    });
    applyVisibility(section);
  }

  /**
   * Clone a row definition onto another row: every _<from> ID becomes _<to>, the semantic path's
   * component <pathFrom> becomes <pathTo>, and the field labels matching textPattern read textTo. The
   * copy starts empty: area and calculated cells 0, the orientation `orientation`.
   */
  function cloneRow(
    row,
    from,
    to,
    { id, label, pathFrom, pathTo, textPattern, textTo, orientation }
  ) {
    const json = JSON.stringify(row)
      .replace(new RegExp(`_${from}(?![0-9a-z])`, "g"), `_${to}`)
      .split(`.${pathFrom}.`)
      .join(`.${pathTo}.`)
      .replace(textPattern, textTo);
    const copy = JSON.parse(json);
    copy.id = copy.rowId = id;
    copy.label = label;
    if (!copy.cells.c?.fieldId) copy.cells.c = { label };
    Object.entries(copy.cells).forEach(([col, cell]) => {
      if (!cell || typeof cell !== "object" || !cell.fieldId) return;
      if (col === "d" || cell.type === "calculated")
        cell.value = col === "n" ? cell.value : "0.00";
      if (col === "e" && cell.type === "dropdown" && orientation)
        cell.value = orientation;
    });
    return copy;
  }

  /**
   * The standard's field for a Reference value (ComputationIntegration.populateReferenceModel, its
   * priority 2): an opaque row's RSI is the standard's for the type the row holds in the Reference -
   * a row turned to Roof takes the roof's minimum (f_85), whatever its own field. Other fields: as is.
   */
  function standardKeyFor(legacyId) {
    const m = /^f_(\d+[a-z]*)$/.exec(legacyId || "");
    const o = m && OPAQUE.find(r => r.s11 === m[1]);
    return o ? `f_${TYPES[typeOf(o, "ref_")].base}` : legacyId;
  }

  // ------------------------------------------------------------------------------------------------
  // A window's overhang (Andy 2026-11-24): CSA F280-12 Annex A, Figure A.1. Our H is the overhang's height
  // above the window's head and our D its projection from the wall (F280 calls these D and O, and its H is
  // the window's height). The shade line falls S = F x D below the overhang, so the shaded height is
  // S - H, at most the window's own; 0 when H > S. The summer % is that PLAIN fraction of the glass (W and
  // the quantity cancel). F by facing at latitude 40 / 45 / 50 / 55, interpolated, held at the ends.
  // N, NE and NW are not shaded (0). Average and Skylight have no row in Annex A: no figure, the slider
  // stays the user's.
  // ------------------------------------------------------------------------------------------------
  const ANNEX_A_LATS = [40, 45, 50, 55];
  const ANNEX_A_F = {
    East: [0.8, 0.8, 0.8, 0.8],
    West: [0.8, 0.8, 0.8, 0.8],
    SouthEast: [1.3, 1.1, 1.0, 0.9],
    SouthWest: [1.3, 1.1, 1.0, 0.9],
    South: [2.6, 2.0, 1.7, 1.4],
  };
  const ANNEX_A_UNSHADED = new Set(["North", "NorthEast", "NorthWest"]);

  /** Annex A's F for a facing at a latitude: 0 for N / NE / NW, null for a facing it has no row for. */
  function annexAFactor(facing, lat) {
    if (ANNEX_A_UNSHADED.has(facing)) return 0;
    const f = ANNEX_A_F[facing];
    if (!f || !Number.isFinite(lat)) return null;
    const x = Math.min(Math.max(lat, ANNEX_A_LATS[0]), ANNEX_A_LATS[3]);
    const i = Math.min(Math.floor((x - 40) / 5), 2);
    return f[i] + ((f[i + 1] - f[i]) * (x - ANNEX_A_LATS[i])) / 5;
  }

  /**
   * The summer shading % an overhang gives one window: { depth, above, windowHeight } in m, its facing and
   * the latitude. null when there is no figure to give (no depth, no window height, no latitude, a facing
   * Annex A has no row for): the slider is then the user's.
   */
  function overhangShading({ facing, lat, depth, above, windowHeight }) {
    if (!(depth > 0)) return null;
    const F = annexAFactor(facing, lat);
    if (F === null) return null;
    if (F === 0) return 0;
    if (!(windowHeight > 0)) return null;
    const shaded = Math.min(windowHeight, Math.max(0, F * depth - (above > 0 ? above : 0)));
    return (100 * shaded) / windowHeight;
  }

  /**
   * Every field the rows added (2026-11-20, hosting 2026-11-24): the house CSV carries them (FileHandler's
   * export list), and a project file without them resets them to their defaults in both models (its
   * added-fields reset):
   *   - a door / window row after the first: S10's area, orientation, SHGC, shading; S11's U-value;
   *   - every door / window row: its host (ch_, the S11 row whose wall or roof it sits in), its W and H
   *     (dl_, dh_, S11's L and H columns) and its quantity (dq_); a window also its overhang's H and D
   *     (eh_, ed_);
   *   - every opaque row: its type (c_), an above-grade row's facing (cf_), L and H (dl_, dh_); a row
   *     after the first also its area and RSI; its assembly (ca_, OBJECTIVE 4.0), when it has one.
   * { inUse: true } (the export): a door / window row after the first only when it is in use - an area
   * or a host in either model - so forty window rows do not make every file forty rows wide.
   */
  // a row's assembly or product, in either model (the Reference's is its own: ref_ca_<row>)
  const hasBuilderLink = o =>
    !!(window.TEUI.StateManager?.getValue(`ca_${o.s11}`) || window.TEUI.StateManager?.getValue(`ref_ca_${o.s11}`));
  function addedFields({ inUse: onlyInUse = false } = {}) {
    return [
      ...ALL.filter(o => !onlyInUse || !isSlot(o) || inUse(o)).flatMap(o => [
        ...(isSlot(o) ? [...["d", "e", "f", "g", "h"].map(col => `${col}_${o.s10}`), `g_${o.s11}`] : []),
        hostField(o),
        `dl_${o.s11}`,
        `dh_${o.s11}`,
        `dq_${o.s11}`,
        ...(o.kind === "door" ? [] : [`eh_${o.s10}`, `ed_${o.s10}`]),
        // its product, as the Opening Builder's Apply Selected left it (OBJECTIVE 4.0, schema.md §10 B4)
        ...(!onlyInUse || hasBuilderLink(o) ? [`ca_${o.s11}`] : []),
      ]),
      ...OPAQUE.flatMap(o => [
        `c_${o.s11}`,
        ...(o.group === "above" ? [`cf_${o.s11}`] : []),
        `dl_${o.s11}`,
        `dh_${o.s11}`,
        ...(isSlot(o) ? [`d_${o.s11}`, `f_${o.s11}`] : []),
        // its assembly, as the Assembly Builder's Apply Selected left it (OBJECTIVE 4.0, schema.md
        // §10 B3): saved only for a row that has one
        ...(!onlyInUse || hasBuilderLink(o) ? [`ca_${o.s11}`] : []),
      ]),
    ];
  }

  window.TEUI.Openings = Object.freeze({
    addedFields,
    DOORS,
    WINDOWS,
    ALL,
    SLOTS: ALL.filter(isSlot),
    ABOVE,
    BELOW,
    OPAQUE,
    OPAQUE_SLOTS: OPAQUE.filter(isSlot),
    TYPES,
    ABOVE_TYPES,
    BELOW_TYPES,
    FACINGS,
    GROUPS,
    SHORT,
    isSlot,
    s10RowId,
    s11RowId,
    typeOf,
    opaqueIds,
    opaqueName,
    shownSlots,
    isShown,
    inUse,
    hosted,
    nextFree,
    add,
    remove,
    takeOut,
    resetShown,
    applyVisibility,
    installControls,
    cloneRow,
    standardKeyFor,
    annexAFactor,
    overhangShading,
  });
})();
