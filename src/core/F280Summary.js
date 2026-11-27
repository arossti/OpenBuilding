/**
 * F280Summary.js - the heat loss and gain calculation summary a software report must carry (CSA F280-12
 * Cl. 7.1 a): "a list of the input data contained in the Heat loss and gain calculation summary sheet shown in
 * Annex D"; Cl. 8.3.2 a) - b): the verification agent reviews the report against Annex D and Table E.1).
 *
 * build() lists every field of the sheet - Table E.1 numbers them 1 to 64; Figure D.1 holds the same fields but
 * the summer daily range - for the MODEL ON SCREEN (Target or Reference), each with the value OBJECTIVE holds and
 * the place it is entered. A field OBJECTIVE has but the user left empty is "blank"; a field OBJECTIVE does not
 * carry is "none", with what it holds instead: the report says so, it never invents a value.
 *
 * After the sheet's own fields: the further inputs the calculation used, the envelope's rows and openings (the
 * sheet's "window and door schedule"), and the design loads with their terms.
 *
 * open() hands the sheet to f280-summary.html in a new tab, which the browser prints (Andy 2026-11-26: "a
 * popup/modal or open in a new tab and use the browser's print functionality, no fancy add-ons"). The field
 * NAMES are the Standard's; the layout and every other word are ours.
 *
 * Nothing here calculates: every number is read from the graph or the state as the sections show it.
 */
(function () {
  window.TEUI = window.TEUI || {};

  const KEY = "objective.f280.summary";
  const PAGE = "f280-summary.html";
  const R_PER_RSI = 5.678; // F280-12's own conversion (its "Conversion Factors" table)

  const num = v => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : NaN;
  };
  const has = v => v !== null && v !== undefined && String(v).trim() !== "";
  const fix = (v, dp = 2) =>
    Number.isFinite(num(v))
      ? num(v).toLocaleString("en-CA", { minimumFractionDigits: dp, maximumFractionDigits: dp })
      : "";
  const trim = (v, dp = 2) =>
    Number.isFinite(num(v)) ? num(v).toLocaleString("en-CA", { maximumFractionDigits: dp }) : "";
  const withUnit = (v, unit, dp = 2) => (Number.isFinite(num(v)) ? `${trim(v, dp)} ${unit}` : "");
  const parse = v => {
    try {
      return typeof v === "string" && v ? JSON.parse(v) : v || null;
    } catch (_) {
      return null;
    }
  };

  /** The model on screen: its graph values (node), its inputs by field id (inp), its stored-only keys (stored). */
  function reader() {
    const T = window.TEUI;
    const ci = T.ComputationIntegration;
    const state = ci?.isInitialized?.() ? ci.getState() : null;
    const modelId = ci?.getOnScreenModelId?.() || state?.getActiveModelId?.();
    const reference = !!T.ReferenceToggle?.isReferenceMode?.();
    const prefix = reference ? "ref_" : "";
    const node = path => (state && modelId ? state.getValueForModel(modelId, path) : undefined);
    const stored = id => T.StateManager?.getValue(prefix + id);
    const inp = id => {
      const path = T.FieldRegistry?.toSemantic?.(id);
      const v = path ? node(path) : undefined;
      return has(v) ? v : stored(id);
    };
    return { T, node, inp, stored, prefix, reference };
  }

  // A field of the sheet. state: "held" (a value), "blank" (ours to hold, left empty), "none" (not carried).
  const field = (no, name, value, from, note) => ({
    no,
    name,
    value: has(value) ? String(value) : "",
    from,
    note: note || "",
    state: has(value) ? "held" : "blank",
  });
  const none = (no, name, instead, from) => ({ no, name, value: "", from: from || "", note: instead, state: "none" });

  const letter = i => String.fromCharCode(65 + i);
  const yesNo = v => (v === true || v === "Yes" || v === "true" ? "Yes" : v === false || v === "No" || v === "false" ? "No" : v);

  /**
   * One element type's "styles": its rows grouped by construction (the same RSI and the same applied assembly).
   * numbers: Table E.1's field numbers for this group's styles, in order; a model with more styles than the
   * sheet has lines lists them all, the extra ones without a number.
   */
  function styles(group, numbers, rows, describe, empty) {
    const byKey = new Map();
    rows.forEach(row => {
      if (!byKey.has(row.key)) byKey.set(row.key, []);
      byKey.get(row.key).push(row);
    });
    const fields = [...byKey.values()].map((members, i) =>
      field(numbers[i] ?? null, `Style ${letter(i)}`, describe(members), members[0].from)
    );
    // the sheet's remaining lines stay on the report, empty, so its field count is the Standard's
    for (let i = fields.length; i < numbers.length; i++) {
      fields.push({
        no: numbers[i],
        name: `Style ${letter(i)}`,
        value: "",
        from: "",
        note: i === 0 ? empty : "",
        state: i === 0 ? "held" : "unused",
      });
    }
    return { title: group, fields };
  }

  const rsiText = rsi => (rsi > 0 ? `RSI ${fix(rsi, 2)} (R-${fix(rsi * R_PER_RSI, 1)})` : "RSI not entered");
  const uText = u => (u > 0 ? `U ${fix(u, 3)} W/m²·K (RSI ${fix(1 / u, 2)})` : "U not entered");
  const areaText = members => `${fix(members.reduce((sum, m) => sum + m.area, 0), 2)} m²`;

  function build() {
    const r = reader();
    const { T, node, inp, stored, prefix } = r;
    const O = T.Openings;
    const A = T.Aim2Data || {};
    const province = inp("d_19");
    const city = inp("h_19");
    const weather = T.F280Weather?.lookup(province, city) || null;
    const aim2 = node("airTightness.aim2");
    const aim2Ok = aim2 && !aim2.error;
    const basesimp = node("ground.basesimp");
    const mode = inp("f280_mode") === "On" ? "On" : "Off";

    // ---- the envelope's rows -------------------------------------------------------------------
    const opaqueIds = O.opaqueIds(prefix);
    const opaque = O.OPAQUE.map(o => {
      const type = O.typeOf(o, prefix);
      const link = parse(stored(`ca_${o.s11}`));
      const rsi = num(inp(`f_${o.s11}`));
      const facing = type === "walls" ? stored(`cf_${o.s11}`) || (O.isSlot(o) ? "North" : "Average") : "";
      return {
        o,
        type,
        id: opaqueIds[o.s11] || O.TYPES[type].b,
        label: O.TYPES[type].label,
        facing,
        area: num(inp(`d_${o.s11}`)) || 0,
        rsi: rsi > 0 ? rsi : 0,
        assembly: link?.name || "",
        key: `${rsi > 0 ? rsi.toFixed(3) : "0"}|${link?.name || ""}`,
        from: "S11",
      };
    }).filter(row => row.area > 0);
    const idOfHost = Object.fromEntries(opaque.map(row => [String(row.o.s11), row.id]));

    const openings = O.ALL.map(o => {
      const link = parse(stored(`ca_${o.s11}`));
      const u = num(inp(`g_${o.s11}`));
      const shgc = num(inp(`f_${o.s10}`));
      const facing = node(`radiantGains.row${o.s10}.orientation`) || inp(`e_${o.s10}`) || "";
      const host = stored(`ch_${o.s11}`);
      const kind = o.kind === "door" ? "door" : o.kind === "skylight" || facing === "Skylight" ? "skylight" : "window";
      return {
        o,
        kind,
        id: o.kind === "door" ? `G.7.${o.n}` : `G.8.${o.n}`,
        facing,
        host: has(host) ? idOfHost[String(host)] || `row ${host}` : "",
        width: num(stored(`dl_${o.s11}`)),
        height: num(stored(`dh_${o.s11}`)),
        quantity: num(stored(`dq_${o.s11}`)),
        area: num(inp(`d_${o.s10}`)) || 0,
        u: u > 0 ? u : 0,
        shgc: Number.isFinite(shgc) ? shgc : NaN,
        overhang: num(stored(`ed_${o.s10}`)),
        above: num(stored(`eh_${o.s10}`)),
        shading: num(inp(`h_${o.s10}`)),
        assembly: link?.name || "",
        key:
          o.kind === "door"
            ? `${u > 0 ? u.toFixed(3) : "0"}|${link?.name || ""}`
            : `${u > 0 ? u.toFixed(3) : "0"}|${Number.isFinite(shgc) ? shgc.toFixed(2) : ""}|${link?.name || ""}`,
        from: "S10 / S11",
      };
    }).filter(row => row.area > 0);

    const rowsOf = type => opaque.filter(row => row.type === type);
    const describeOpaque = extra => members => {
      const m = members[0];
      const where =
        m.type === "walls"
          ? members.map(x => `${x.id} ${O.SHORT[x.facing] || x.facing}`).join(", ")
          : members.map(x => x.id).join(", ");
      return [m.assembly, rsiText(m.rsi), areaText(members), where, extra].filter(Boolean).join(" · ");
    };
    const describeOpening = members => {
      const m = members[0];
      const count = members.reduce((sum, x) => sum + (x.quantity > 0 ? x.quantity : 1), 0);
      const parts = [m.assembly, uText(m.u)];
      if (m.kind !== "door" && Number.isFinite(m.shgc)) parts.push(`SHGC ${fix(m.shgc, 2)}`);
      parts.push(areaText(members), `${count} ${m.kind}${count === 1 ? "" : "s"} (${members.map(x => x.id).join(", ")})`);
      return parts.filter(Boolean).join(" · ");
    };
    const foundation =
      basesimp && !basesimp.error && basesimp.configuration ? `BASESIMP ${basesimp.configuration} (S03 G.4.4)` : "";

    // ---- the sheet's fields, in Table E.1's order ----------------------------------------------
    const stories = inp("d_103");
    const foundationType = inp("g_112d");
    const ventRate = num(node("ventilation.volumetricRate"));
    const recoveryType = inp("e_118");
    const sre = num(inp("d_118"));
    const atre = num(inp("l_123"));
    const tightness = inp("g_111");
    const ach50 = num(node("airTightness.ach50Target"));
    const terrain = A.terrain?.[num(inp("d_112b")) - 1]?.name;
    const wallShield = A.shielding?.[num(inp("d_112c")) - 1]?.name;
    const flueShield = A.shielding?.[num(inp("g_112c")) - 1]?.name;
    const projectCity = inp("f280_proj_city");
    const facing = inp("f280_front_facing");
    const recorded = v => (has(v) && v !== "Not recorded" ? v : "");

    const groups = [
      {
        title: "The documents",
        fields: [
          field(1, "Drawings issued for", inp("f280_issued_for"), "S21 F.41"),
          field(2, "Project number", inp("f280_proj_num"), "S21 F.1"),
        ],
      },
      {
        title: "Building location",
        fields: [
          field(3, "Model", inp("h_14"), "S02 S.2 Project Name"),
          field(4, "Address", inp("f280_address"), "S21 F.42"),
          has(projectCity)
            ? field(5, "City and Province", projectCity, "S21 F.43")
            : field(
                5,
                "City and Province",
                [city, province].filter(has).join(", "),
                "S03 L.1.1",
                "the weather location, S21 F.43 being empty"
              ),
          field(6, "Site", inp("f280_site"), "S21 F.44"),
          field(7, "Lot", inp("f280_lot"), "S21 F.45"),
          field(8, "Postal code", inp("f280_postal"), "S21 F.46"),
        ],
      },
      {
        title: "Calculations based on",
        fields: [
          field(9, "Dimensional information based on", inp("f280_dims_src"), "S21 F.47"),
          field(10, "Attachment", inp("d_112d"), "S12 B.19.9 House Type"),
          field(
            11,
            "Number of stories",
            has(stories) ? `${stories}${has(foundationType) ? ` + foundation: ${foundationType}` : ""}` : "",
            "S12 B.18.3, B.19.10"
          ),
          field(
            12,
            "Weather location",
            [city, province].filter(has).join(", "),
            "S03 L.1.1",
            weather ? `F280's weather table: ${weather.city}` : "not a location in F280's weather table"
          ),
          field(13, "Ventilated?", ventRate > 0 ? `Included, ${trim(ventRate, 2)} L/s` : "Not included", "S13 V.1.6"),
          field(
            14,
            "HRV?",
            sre > 0 || atre > 0 ? `Yes, ${recoveryType || "HRV"}` : "No heat recovery",
            "S13 V.1.1",
            "the unit's make and model are not carried"
          ),
          field(
            15,
            "Recovery %",
            Number.isFinite(atre) ? `${trim(atre, 1)} % in the design loads` : "",
            "S13 V.3.3 ATRE",
            Number.isFinite(sre) ? `the annual figures use the SRE, ${trim(sre, 1)} % (S13 V.1.1)` : ""
          ),
          field(16, "Front facing", recorded(facing), "S21 F.48", "a record: each wall's facing is its S11 row's"),
          field(17, "Assumed? (front facing)", recorded(inp("f280_facing_assumed")), "S21 F.49"),
          field(
            18,
            "Air tightness",
            [
              has(tightness) ? `AIM-2 ${tightness}` : "",
              ach50 > 0 ? `${trim(ach50, 2)} ACH50` : "",
              aim2Ok && aim2.design?.ela > 0 ? `ELA ${trim(aim2.design.ela, 0)} cm² at 10 Pa` : "",
            ]
              .filter(Boolean)
              .join(" · "),
            "S12 B.18.2, B.19.2, B.19.3",
            "F280-12's own method (AIM-2, Cl. 5.2.3), not an HRAI category"
          ),
          field(19, "Assumed? (air tightness)", recorded(inp("f280_tight_assumed")), "S21 F.50"),
          field(
            20,
            "Wind exposure",
            [
              has(terrain) ? `site terrain: ${terrain}` : "",
              has(wallShield) ? `walls: ${wallShield}` : "",
              has(flueShield) ? `flue: ${flueShield}` : "",
            ]
              .filter(Boolean)
              .join(" · "),
            "S12 B.19.5, B.19.7, B.19.8",
            "AIM-2's terrain and shielding classes"
          ),
          none(
            21,
            "Internal shading",
            "OBJECTIVE holds no interior-shading category. Each window's summer shading % (the schedule below) is its one shading input: an overhang sets it by Annex A, otherwise it is typed.",
            "S10 summer shading %"
          ),
          field(22, "Occupants", trim(inp("d_63"), 1), "S09 G.1.1"),
          field(23, "Units", "Metric (SI)", "fixed", "OBJECTIVE calculates and reports in SI"),
        ],
      },
      {
        title: "Heating design conditions",
        fields: [
          field(24, "Outdoor temperature", withUnit(node("climate.temperature.coldest"), "°C", 1), "S03 L.3.1"),
          field(25, "Indoor temperature", withUnit(node("climate.heating.obcSetpoint"), "°C", 1), "S03 L.3.1"),
          field(26, "Mean soil temperature", withUnit(node("ground.basesimp.deepGround"), "°C", 1), "S03 G.4.8", "F280's deep ground temperature for the location"),
        ],
      },
      {
        title: "Cooling design conditions",
        fields: [
          field(27, "Outdoor temperature", withUnit(node("climate.temperature.hottest"), "°C", 1), "S03 L.3.2"),
          field(28, "Indoor temperature", withUnit(node("climate.cooling.setpoint"), "°C", 1), "S03 L.3.2"),
          field(29, "Latitude", weather ? `${trim(weather.lat, 2)}° N` : "", "F280's weather table", "used for Annex A's shading"),
          field(30, "Summer mean daily temperature range", weather ? withUnit(weather.summerRange, "°C", 1) : "", "F280's weather table", "Table E.1 only; Figure D.1 has no such line"),
        ],
      },
      styles("Above grade walls", [31, 32, 33, 34], rowsOf("walls"), describeOpaque(""), "none in this model"),
      styles("Below grade walls", [35, 36, 37, 38], rowsOf("wallsBelowGrade"), describeOpaque(foundation), "none in this model"),
      styles("Floors on soil", [39, 40], rowsOf("slabOnGrade"), describeOpaque(foundation), "none in this model"),
      styles("Ceilings", [41, 42, 43], rowsOf("roof"), describeOpaque(""), "none in this model"),
      styles("Exposed floors", [44, 45], rowsOf("exposedFloor"), describeOpaque(""), "none in this model"),
      styles("Doors", [46, 47, 48], openings.filter(x => x.kind === "door"), describeOpening, "none in this model"),
      styles("Windows", [49, 50, 51, 52], openings.filter(x => x.kind === "window"), describeOpening, "none in this model"),
      styles("Skylights", [53, 54], openings.filter(x => x.kind === "skylight"), describeOpening, "none in this model"),
      {
        title: "Attachments and notes",
        fields: [
          field(55, "Attached documents", inp("f280_attached"), "S21 F.51"),
          field(56, "Notes", inp("f280_notes"), "S21 F.52"),
        ],
      },
      {
        title: "Calculations performed by",
        fields: [
          field(57, "Name", inp("f280_dsgn_name"), "S21 F.34"),
          field(58, "Company", inp("f280_dsgn_co"), "S21 F.35"),
          field(59, "Address", inp("f280_dsgn_addr"), "S21 F.53"),
          field(60, "City and Province", inp("f280_dsgn_city"), "S21 F.54"),
          field(61, "Postal code", inp("f280_dsgn_postal"), "S21 F.55"),
          field(62, "Telephone", inp("f280_dsgn_phone"), "S21 F.56"),
          field(63, "Fax", inp("f280_dsgn_fax"), "S21 F.57"),
          field(64, "E-mail", inp("f280_dsgn_email"), "S21 F.58"),
        ],
      },
    ];

    // ---- the qualification the sheet leaves room for (its stamp area) ---------------------------
    const certType = inp("f280_cert_type");
    const qualification = [
      field(null, "Qualification", certType, "S21 F.36"),
      field(null, "Qualification number", inp("f280_cert_num"), "S21 F.37"),
      field(null, "Responsibility declared", yesNo(inp("f280_attest")), "S21 F.39"),
      field(null, "Code reference", inp("f280_code_ref"), "S21 F.3"),
    ];

    // ---- what else the calculation used ----------------------------------------------------------
    const further = [
      field(null, "F280 Mode", mode, "S21 F.00"),
      field(null, "Conditioned floor area", withUnit(inp("h_15"), "m²", 2), "S02 S.3"),
      field(null, "Conditioned volume", withUnit(inp("d_105"), "m³", 1), "S12 B.13"),
      field(
        null,
        "Highest ceiling above grade",
        aim2Ok ? withUnit(aim2.inputs?.ceilingHeight, "m", 2) : "",
        "S12 B.19.4",
        aim2Ok && aim2.derived?.ceilingHeightFrom ? `from: ${aim2.derived.ceilingHeightFrom}` : ""
      ),
      field(null, "Weather station terrain", A.terrain?.[num(inp("g_112b")) - 1]?.name, "S12 B.19.6"),
      field(null, "Ventilation balance", inp("d_112e"), "S12 B.19.11"),
      field(null, "Flue diameter", withUnit(inp("g_112e"), "mm", 0), "S12 B.19.12"),
      field(null, "Natural air leakage, heating design", aim2Ok ? withUnit(node("aim2.heatingRate"), "AC/H", 4) : "", "S12 B.19.13"),
      field(null, "Natural air leakage, cooling design", aim2Ok ? withUnit(node("aim2.coolingRate"), "AC/H", 4) : "", "S12 B.19.14"),
      field(null, "Foundation configuration", basesimp && !basesimp.error ? basesimp.configuration : "", "S03 G.4.4"),
      // a slab on grade has no depth: BASESIMP does not read it, so the report does not list it
      ...(basesimp && !basesimp.error && basesimp.slab ? [] : [field(null, "Depth below grade", withUnit(inp("d_26"), "m", 2), "S03 G.4.5")]),
      field(null, "Exposed perimeter", withUnit(inp("h_26"), "m", 2), "S03 G.4.5"),
      field(null, "Soil conductivity", withUnit(inp("l_26"), "W/m·K", 2), "S03 G.4.5"),
      field(null, "Water table depth", withUnit(inp("d_26b"), "m", 1), "S03 G.4.8"),
    ];

    // ---- the schedule: every envelope row and opening in use -------------------------------------
    const schedule = {
      opaque: opaque.map(row => ({
        id: row.id,
        element: row.label,
        facing: row.facing ? O.SHORT[row.facing] || row.facing : "",
        area: fix(row.area, 2),
        rsi: row.rsi > 0 ? fix(row.rsi, 2) : "",
        u: row.rsi > 0 ? fix(1 / row.rsi, 3) : "",
        assembly: row.assembly,
      })),
      openings: openings.map(row => ({
        id: row.id,
        kind: row.kind,
        host: row.host,
        facing: row.facing ? O.SHORT[row.facing] || row.facing : "",
        size:
          row.width > 0 && row.height > 0
            ? `${fix(row.width, 2)} × ${fix(row.height, 2)}${row.quantity > 1 ? ` × ${trim(row.quantity, 0)}` : ""}`
            : "",
        area: fix(row.area, 2),
        u: row.u > 0 ? fix(row.u, 3) : "",
        shgc: row.kind !== "door" && Number.isFinite(row.shgc) ? fix(row.shgc, 2) : "",
        overhang:
          row.overhang > 0 ? `${fix(row.overhang, 2)} / ${Number.isFinite(row.above) ? fix(row.above, 2) : ""}` : "",
        shading: Number.isFinite(row.shading) ? trim(row.shading, 1) : "",
        assembly: row.assembly,
      })),
    };

    // ---- the design loads, as S21 and S15 show them ------------------------------------------------
    const watts = path => {
      const v = node(path);
      return Number.isFinite(num(v)) ? `${trim(v, 0)} W` : has(v) ? String(v) : "";
    };
    const results = [
      field(null, "Envelope heat loss", watts("f280.peakEnvelopeHeatLoss"), "S21 F.27"),
      field(null, "Air leakage heat loss", watts("f280.peakInfiltrationHeatLoss"), "S21 F.28"),
      field(null, "Ventilation heat loss", watts("f280.peakVentilationHeatLoss"), "S21 F.29"),
      field(null, "Total design heat loss", watts("f280.totalDesignHeatLoss"), "S21 F.30"),
      field(null, "Total sensible heat gain", watts("f280.totalSensibleHeatGain"), "S15 T.6.11"),
      field(
        null,
        "Nominal heat gain, sensible × latent multiplier",
        watts("f280.s15.nominalHeatGain"),
        "S15 T.6.12",
        Number.isFinite(num(node("f280.s15.latentMultiplier")))
          ? `multiplier ${fix(node("f280.s15.latentMultiplier"), 2)} (Cl. 6.3.1)`
          : ""
      ),
      field(null, "Nominal cooling capacity", watts("f280.nominalCoolingCapacity"), "S21 F.31", "the sensible gain plus the design latent load"),
    ];

    const all = groups.flatMap(g => g.fields);
    return {
      version: 1,
      model: r.reference ? "Reference" : "Target",
      project: has(inp("h_14")) ? String(inp("h_14")) : "",
      mode,
      builtAt: new Date().toISOString(),
      groups,
      qualification,
      further,
      schedule,
      results,
      counts: {
        fields: all.filter(f => f.no !== null).length,
        held: all.filter(f => f.no !== null && f.state === "held").length,
        blank: all.filter(f => f.no !== null && f.state === "blank").length,
        unused: all.filter(f => f.no !== null && f.state === "unused").length,
        none: all.filter(f => f.no !== null && f.state === "none").length,
      },
    };
  }

  /** Build the sheet for the model on screen and open it in its own tab; the browser prints it. */
  function open() {
    const sheet = build();
    try {
      localStorage.setItem(KEY, JSON.stringify(sheet));
    } catch (_) {
      /* a browser that refuses storage: the page says it has nothing to show */
    }
    window.open(PAGE, "_blank");
    return sheet;
  }

  window.TEUI.F280Summary = Object.freeze({ build, open, KEY, PAGE });
})();
