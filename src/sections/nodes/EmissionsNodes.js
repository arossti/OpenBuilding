/**
 * EmissionsNodes.js - CO2e Emissions Calculations (S04/S05)
 *
 * Energy emissions from fuel consumption and lifetime carbon.
 *
 * Formulas derived from Section04.js and Section05.js:
 * - g_32 = g_27 + g_28 + g_29 + g_30 + g_31 - (d_60 * 1000) (Actual Emissions)
 * - k_32 = k_27 + k_28 + k_29 + k_30 + k_31 - (d_60 * 1000) (Target Emissions)
 * - h_8 = k_32 / h_15 (Target Annual Carbon from S01)
 * - g_38 = emissions / h_15 (Annual GHGI from S05)
 * - i_38 = g_38 * h_13 (Lifetime Operational from S05)
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};
  window.TEUI.ComputationNodes = window.TEUI.ComputationNodes || {};

  function parseNum(value, defaultVal = 0) {
    if (value === null || value === undefined || value === "N/A") return defaultVal;
    if (value === "Unavailable") return defaultVal;
    const num = parseFloat(String(value).replace(/,/g, ""));
    return isNaN(num) ? defaultVal : num;
  }

  function isUnavailable(value) {
    return value === "Unavailable" || value === "N/A";
  }

  function register(graph) {
    // ========================================================================
    // INPUTS - Individual row emissions (calculated by legacy system)
    // These are synced from StateManager for validation
    // ========================================================================
    const inputs = [
      // Raw inputs needed for actual energy/emissions computations
      // d_29: Propane actual usage (user utility bill input)
      { id: "energy.actual.propane.kg", legacyId: "d_29", section: "S04", classification: "A", label: "Total Propane Use (kg/yr)", defaultValue: 0 },
      // d_27, d_28, d_30 are registered in EnergyNodes as energy.raw.*
      // d_31 is registered in ForestryNodes as forestry.woodVolume
      // d_43, i_43 are computed in RenewableNodes

      // Emission factors (l_28 through l_31)
      // l_27 is a computed node (derived from province + year)
      { id: "emissions.factor.gas", legacyId: "l_28", section: "S04", classification: "C", label: "Gas Emission Factor (gCO2e/m³)", defaultValue: 1921 },
      { id: "emissions.factor.propane", legacyId: "l_29", section: "S04", classification: "C", label: "Propane Emission Factor (gCO2e/kg)", defaultValue: 2970 },
      { id: "emissions.factor.oil", legacyId: "l_30", section: "S04", classification: "C", label: "Oil Emission Factor (gCO2e/litre)", defaultValue: 2753 },
      { id: "emissions.factor.wood", legacyId: "l_31", section: "S04", classification: "C", label: "Wood Emission Factor (kgCO2e/m³)", defaultValue: 150 },

      // i_41: canonical input lives in BuildingInfoNodes (building.userModelledEmbodiedCarbon)
    ];

    graph.registerInputs(inputs);

    // Reporting year (needed for province-based emission factor lookup)
    graph.registerInput({
      id: "building.reportingYear",
      legacyId: "h_12",
      section: "S02",
      classification: "G",
      label: "Reporting Year",
      defaultValue: 2022,
    });

    // ========================================================================
    // COMPUTED: Electricity Emission Factor (l_27)
    // Province + year lookup matching Section04.js getElectricityEmissionFactor()
    // ========================================================================
    const GRID_INTENSITY_FACTORS = {
      ON: {
        2015: 46, 2016: 40, 2017: 18, 2018: 29, 2019: 29,
        2020: 36, 2021: 44, 2022: 51, 2023: 67, 2024: 71,
        2025: 75, 2026: 81, 2027: 124, 2028: 113, 2029: 113,
        2030: 106, 2031: 98, 2032: 67, 2033: 54, 2034: 48,
        2035: 44, 2036: 49, 2037: 50, 2038: 54, 2039: 65,
        2040: 50, 2041: 44, 2042: 34.58, 2043: 28.66, 2044: 19.66,
        2045: 17.32, 2046: 9.98, 2047: 4.94, 2048: 4.47, 2049: 3.23,
        2050: 2.77, default: 51,
      },
      QC: { default: 1 },
      BC: { default: 12 },
      AB: { default: 650 },
      SK: { default: 720 },
      MB: { default: 3 },
      NS: { default: 600 },
      NB: { default: 340 },
      NL: { default: 30 },
      PE: { default: 12 },
      NT: { default: 180 },
      YT: { default: 2 },
      NU: { default: 200 },
    };

    graph.registerNode({
      id: "emissions.factor.electricity",
      legacyId: "l_27",
      section: "S04",
      classification: "C",
      dependencies: ["climate.location.province", "building.reportingYear"],
      label: "Electricity Emission Factor (gCO2e/kWh)",
      compute: (inputs) => {
        const province = inputs["climate.location.province"] || "ON";
        const year = parseNum(inputs["building.reportingYear"], 2022);
        const provinceFactors = GRID_INTENSITY_FACTORS[province] || GRID_INTENSITY_FACTORS["ON"];
        return provinceFactors[year] || provinceFactors.default;
      },
    });

    // ========================================================================
    // TARGET VOLUMES (h_27..h_31) - intermediate values for DOM display
    // These are the raw volume/quantity values before kWh conversion
    // ========================================================================

    // h_27: Target total electricity = d_136 (total energy from S15)
    graph.registerNode({
      id: "energy.target.electricity.raw",
      legacyId: "h_27",
      section: "S04",
      classification: "C",
      dependencies: ["energy.total.all"],
      label: "Target Total Electricity (kWh/yr)",
      compute: (inputs) => parseNum(inputs["energy.total.all"], 0),
    });

    // h_28: Target gas volume = dual-fuel logic
    graph.registerNode({
      id: "energy.target.gas.volume",
      legacyId: "h_28",
      section: "S04",
      classification: "C",
      dependencies: [
        "mechanical.heating.systemType",
        "waterHeating.systemType",
        "waterHeating.gasVolume",
        "mechanical.heating.gasConsumption"
      ],
      label: "Target Gas Volume (m³/yr)",
      compute: (inputs) => {
        const spaceHeatingFuel = inputs["mechanical.heating.systemType"] || "";
        const waterHeatingFuel = inputs["waterHeating.systemType"] || "";
        const waterGasVolume = parseNum(inputs["waterHeating.gasVolume"], 0);
        const spaceGasVolume = parseNum(inputs["mechanical.heating.gasConsumption"], 0);

        if (spaceHeatingFuel === "Gas" && waterHeatingFuel === "Gas") return waterGasVolume + spaceGasVolume;
        if (waterHeatingFuel === "Gas") return waterGasVolume;
        if (spaceHeatingFuel === "Gas") return spaceGasVolume;
        return 0;
      },
    });

    // h_29: Target propane = d_29 (mirrors actual)
    graph.registerNode({
      id: "energy.target.propane.volume",
      legacyId: "h_29",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.propane.kg"],
      label: "Target Propane (kg/yr)",
      compute: (inputs) => parseNum(inputs["energy.actual.propane.kg"], 0),
    });

    // h_30: Target oil volume = dual-fuel logic
    graph.registerNode({
      id: "energy.target.oil.volume",
      legacyId: "h_30",
      section: "S04",
      classification: "C",
      dependencies: [
        "mechanical.heating.systemType",
        "waterHeating.systemType",
        "waterHeating.oilVolume",
        "mechanical.heating.oilConsumption"
      ],
      label: "Target Oil Volume (litres/yr)",
      compute: (inputs) => {
        const spaceHeatingFuel = inputs["mechanical.heating.systemType"] || "";
        const waterHeatingFuel = inputs["waterHeating.systemType"] || "";
        const waterOilVolume = parseNum(inputs["waterHeating.oilVolume"], 0);
        const spaceOilVolume = parseNum(inputs["mechanical.heating.oilConsumption"], 0);

        if (spaceHeatingFuel === "Oil" && waterHeatingFuel === "Oil") return waterOilVolume + spaceOilVolume;
        if (waterHeatingFuel === "Oil") return waterOilVolume;
        if (spaceHeatingFuel === "Oil") return spaceOilVolume;
        return 0;
      },
    });

    // h_31: Target wood = d_31 (mirrors actual)
    graph.registerNode({
      id: "energy.target.wood.volume",
      legacyId: "h_31",
      section: "S04",
      classification: "C",
      dependencies: ["forestry.woodVolume"],
      label: "Target Wood Volume (m³/yr)",
      compute: (inputs) => parseNum(inputs["forestry.woodVolume"], 0),
    });

    // ========================================================================
    // COMPUTED: Actual energy consumption (f_27..f_31)
    // Previously registered as inputs that read stale legacy values.
    // Now computed from raw bill inputs + unit conversions.
    // Formulas from Section04.js calculateRow27..calculateRow31.
    // ========================================================================

    // f_27: Net electricity = raw bills - onsite renewables - offsite renewables
    graph.registerNode({
      id: "energy.actual.electricity",
      legacyId: "f_27",
      section: "S04",
      classification: "C",
      dependencies: ["energy.raw.electricity", "renewable.onsiteTotal", "renewable.offsiteTotal"],
      label: "Actual Electricity (kWh/yr)",
      compute: (inputs) => {
        const d27 = parseNum(inputs["energy.raw.electricity"]);
        const d43 = parseNum(inputs["renewable.onsiteTotal"]);
        const i43 = parseNum(inputs["renewable.offsiteTotal"]);
        return d27 - d43 - i43;
      },
    });

    // f_28: Gas m³ → kWh (Section04.js line 1288: =D28*0.0373*277.7778)
    graph.registerNode({
      id: "energy.actual.gas",
      legacyId: "f_28",
      section: "S04",
      classification: "C",
      dependencies: ["energy.raw.gas"],
      label: "Actual Gas (kWh/yr)",
      compute: (inputs) => {
        const d28 = parseNum(inputs["energy.raw.gas"]);
        return d28 * 0.0373 * 277.7778;
      },
    });

    // f_29: Propane kg → kWh (Section04.js line 1299: =D29*14.019)
    graph.registerNode({
      id: "energy.actual.propane",
      legacyId: "f_29",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.propane.kg"],
      label: "Actual Propane (kWh/yr)",
      compute: (inputs) => {
        const d29 = parseNum(inputs["energy.actual.propane.kg"]);
        return d29 * 14.019;
      },
    });

    // f_30: Oil L → kWh (Section04.js line 1324: =D30*36.72*0.2777778)
    graph.registerNode({
      id: "energy.actual.oil",
      legacyId: "f_30",
      section: "S04",
      classification: "C",
      dependencies: ["energy.raw.oil"],
      label: "Actual Oil (kWh/yr)",
      compute: (inputs) => {
        const d30 = parseNum(inputs["energy.raw.oil"]);
        return d30 * 36.72 * 0.2777778;
      },
    });

    // f_31: Wood m³ → kWh (Section04.js line 1335: =D31*1000)
    graph.registerNode({
      id: "energy.actual.wood",
      legacyId: "f_31",
      section: "S04",
      classification: "C",
      dependencies: ["forestry.woodVolume"],
      label: "Actual Wood (kWh/yr)",
      compute: (inputs) => {
        const d31 = parseNum(inputs["forestry.woodVolume"]);
        return d31 * 1000;
      },
    });

    // ========================================================================
    // COMPUTED: Actual emissions (g_27..g_31)
    // g = raw_quantity × emission_factor / 1000
    // Formulas from Section04.js calculateRow27..calculateRow31.
    // ========================================================================

    // g_27: Electricity emissions = f_27 × l_27 / 1000
    graph.registerNode({
      id: "emissions.actual.electricity",
      legacyId: "g_27",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.electricity", "emissions.factor.electricity"],
      label: "Actual Electricity Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        const f27 = parseNum(inputs["energy.actual.electricity"]);
        const l27 = parseNum(inputs["emissions.factor.electricity"], 51);
        return (f27 * l27) / 1000;
      },
    });

    // g_28: Gas emissions = d_28 × l_28 / 1000 (Section04.js line 1289)
    graph.registerNode({
      id: "emissions.actual.gas",
      legacyId: "g_28",
      section: "S04",
      classification: "C",
      dependencies: ["energy.raw.gas", "emissions.factor.gas"],
      label: "Actual Gas Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        const d28 = parseNum(inputs["energy.raw.gas"]);
        const l28 = parseNum(inputs["emissions.factor.gas"], 1921);
        return (d28 * l28) / 1000;
      },
    });

    // g_29: Propane emissions = d_29 × l_29 / 1000 (Section04.js line 1300)
    graph.registerNode({
      id: "emissions.actual.propane",
      legacyId: "g_29",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.propane.kg", "emissions.factor.propane"],
      label: "Actual Propane Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        const d29 = parseNum(inputs["energy.actual.propane.kg"]);
        const l29 = parseNum(inputs["emissions.factor.propane"], 2970);
        return (d29 * l29) / 1000;
      },
    });

    // g_30: Oil emissions = d_30 × l_30 / 1000 (Section04.js line 1325)
    graph.registerNode({
      id: "emissions.actual.oil",
      legacyId: "g_30",
      section: "S04",
      classification: "C",
      dependencies: ["energy.raw.oil", "emissions.factor.oil"],
      label: "Actual Oil Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        const d30 = parseNum(inputs["energy.raw.oil"]);
        const l30 = parseNum(inputs["emissions.factor.oil"], 2753);
        return (d30 * l30) / 1000;
      },
    });

    // g_31: Wood emissions = d_31 × l_31 (Section04.js line 1336)
    graph.registerNode({
      id: "emissions.actual.wood",
      legacyId: "g_31",
      section: "S04",
      classification: "C",
      dependencies: ["forestry.woodVolume", "emissions.factor.wood"],
      label: "Actual Wood Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        const d31 = parseNum(inputs["forestry.woodVolume"]);
        const l31 = parseNum(inputs["emissions.factor.wood"], 150);
        return d31 * l31;
      },
    });

    // ========================================================================
    // TARGET ENERGY BY FUEL TYPE (j_27-j_31)
    // Previously registered as inputs, now computed nodes with proper dependencies
    // Section04.js lines 1206-1286
    // ========================================================================

    // j_27: Target Electricity = d_136 - d_43 - i_43
    // Total energy minus PV and wind/offsite renewables
    graph.registerNode({
      id: "energy.target.electricity",
      legacyId: "j_27",
      section: "S04",
      classification: "C",
      dependencies: [
        "energy.total.all",        // d_136
        "renewable.onsiteTotal",   // d_43 (PV generation)
        "renewable.offsiteTotal"   // i_43 (wind/offsite)
      ],
      label: "Target Electricity (kWh/yr)",
      compute: (inputs) => {
        // j_27 = h_27 - d_43 - i_43, where h_27 = d_136 (Section04.js line 1212)
        const d136 = parseNum(inputs["energy.total.all"], 0);
        const d43 = parseNum(inputs["renewable.onsiteTotal"], 0);
        const i43 = parseNum(inputs["renewable.offsiteTotal"], 0);
        return d136 - d43 - i43;
      },
    });

    // j_28: Target Gas = h_28 * 0.0373 * 277.7778 (volume to kWh)
    // h_28 = IF(AND(d_113="Gas", d_51="Gas"), e_51+h_115, IF(d_51="Gas", e_51, IF(d_113="Gas", h_115, 0)))
    graph.registerNode({
      id: "energy.target.gas",
      legacyId: "j_28",
      section: "S04",
      classification: "C",
      dependencies: [
        "mechanical.heating.systemType",    // d_113
        "waterHeating.systemType",          // d_51
        "waterHeating.gasVolume",           // e_51
        "mechanical.heating.gasConsumption" // h_115
      ],
      label: "Target Gas (kWh/yr)",
      compute: (inputs) => {
        // Section04.js lines 1220-1238
        const spaceHeatingFuel = inputs["mechanical.heating.systemType"] || "";
        const waterHeatingFuel = inputs["waterHeating.systemType"] || "";
        const waterGasVolume = parseNum(inputs["waterHeating.gasVolume"], 0);
        const spaceGasVolume = parseNum(inputs["mechanical.heating.gasConsumption"], 0);

        let h_28 = 0;
        if (spaceHeatingFuel === "Gas" && waterHeatingFuel === "Gas") {
          h_28 = waterGasVolume + spaceGasVolume;
        } else if (waterHeatingFuel === "Gas") {
          h_28 = waterGasVolume;
        } else if (spaceHeatingFuel === "Gas") {
          h_28 = spaceGasVolume;
        }

        // Convert m³ to kWh: h_28 * 0.0373 * 277.7778
        return h_28 * 0.0373 * 277.7778;
      },
    });

    // j_29: Target Propane = d_29 * 14.019 (kg to kWh)
    // Target mirrors actual for user-controlled fuel
    graph.registerNode({
      id: "energy.target.propane",
      legacyId: "j_29",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.propane.kg"], // d_29
      label: "Target Propane (kWh/yr)",
      compute: (inputs) => {
        // Section04.js line 1249: j_29 = h_29 * 14.019, where h_29 = d_29
        const d29 = parseNum(inputs["energy.actual.propane.kg"], 0);
        return d29 * 14.019;
      },
    });

    // j_30: Target Oil = h_30 * 36.72 * 0.2777778 (litres to kWh)
    // h_30 = IF(AND(d_113="Oil", d_51="Oil"), k_54+f_115, IF(d_51="Oil", k_54, IF(d_113="Oil", f_115, 0)))
    graph.registerNode({
      id: "energy.target.oil",
      legacyId: "j_30",
      section: "S04",
      classification: "C",
      dependencies: [
        "mechanical.heating.systemType",     // d_113
        "waterHeating.systemType",           // d_51
        "waterHeating.oilVolume",            // k_54
        "mechanical.heating.oilConsumption"  // f_115
      ],
      label: "Target Oil (kWh/yr)",
      compute: (inputs) => {
        // Section04.js lines 1256-1274
        const spaceHeatingFuel = inputs["mechanical.heating.systemType"] || "";
        const waterHeatingFuel = inputs["waterHeating.systemType"] || "";
        const waterOilVolume = parseNum(inputs["waterHeating.oilVolume"], 0);
        const spaceOilVolume = parseNum(inputs["mechanical.heating.oilConsumption"], 0);

        let h_30 = 0;
        if (spaceHeatingFuel === "Oil" && waterHeatingFuel === "Oil") {
          h_30 = waterOilVolume + spaceOilVolume;
        } else if (waterHeatingFuel === "Oil") {
          h_30 = waterOilVolume;
        } else if (spaceHeatingFuel === "Oil") {
          h_30 = spaceOilVolume;
        }

        // Convert litres to kWh: h_30 * 36.72 * 0.2777778
        return h_30 * 36.72 * 0.2777778;
      },
    });

    // j_31: Target Wood = d_31 * 1000 (m³ to kWh)
    // Target mirrors actual for user-controlled fuel
    graph.registerNode({
      id: "energy.target.wood",
      legacyId: "j_31",
      section: "S04",
      classification: "C",
      dependencies: ["forestry.woodVolume"], // d_31
      label: "Target Wood (kWh/yr)",
      compute: (inputs) => {
        // Section04.js line 1285: j_31 = h_31 * 1000, where h_31 = d_31
        const d31 = parseNum(inputs["forestry.woodVolume"], 0);
        return d31 * 1000;
      },
    });

    // Expose GRID_INTENSITY_FACTORS for external use (e.g., UI layer)
    window.TEUI.EmissionsFactors = window.TEUI.EmissionsFactors || {};
    window.TEUI.EmissionsFactors.GRID_INTENSITY = GRID_INTENSITY_FACTORS;

    // Helper function to get province-based electricity factor
    window.TEUI.EmissionsFactors.getElectricityFactor = function(province) {
      const factors = GRID_INTENSITY_FACTORS[province] || GRID_INTENSITY_FACTORS["ON"];
      return factors.default;
    };

    // ========================================================================
    // TARGET EMISSIONS BY FUEL TYPE (k_27-k_31)
    // Formulas: energy × emission_factor / 1000 (convert g to kg)
    // Section04.js lines 1213, 1239, 1250, 1275, 1286
    // ========================================================================

    // k_27: Target Electricity Emissions = j_27 × l_27 / 1000
    graph.registerNode({
      id: "emissions.target.electricity",
      legacyId: "k_27",
      section: "S04",
      classification: "C",
      dependencies: ["energy.target.electricity", "emissions.factor.electricity"],
      label: "Target Electricity Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        // Section04.js line 1213: k_27 = (h_27 - d_43 - i_43) * l_27 / 1000 = j_27 * l_27 / 1000
        const j27 = parseNum(inputs["energy.target.electricity"], 0);
        const l27 = parseNum(inputs["emissions.factor.electricity"], 51);
        return (j27 * l27) / 1000;
      },
    });

    // k_28: Target Gas Emissions = h_28 × l_28 / 1000
    // Note: Emissions calculated from VOLUME (h_28), not energy (j_28)
    graph.registerNode({
      id: "emissions.target.gas",
      legacyId: "k_28",
      section: "S04",
      classification: "C",
      dependencies: [
        "mechanical.heating.systemType",
        "waterHeating.systemType",
        "waterHeating.gasVolume",
        "mechanical.heating.gasConsumption",
        "emissions.factor.gas"
      ],
      label: "Target Gas Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        // Section04.js line 1239: k_28 = h_28 × 1921 / 1000
        // h_28 = combined gas volume from space heating + water heating
        const spaceHeatingFuel = inputs["mechanical.heating.systemType"] || "";
        const waterHeatingFuel = inputs["waterHeating.systemType"] || "";
        const waterGasVolume = parseNum(inputs["waterHeating.gasVolume"], 0);
        const spaceGasVolume = parseNum(inputs["mechanical.heating.gasConsumption"], 0);
        const l28 = parseNum(inputs["emissions.factor.gas"], 1921);

        let h_28 = 0;
        if (spaceHeatingFuel === "Gas" && waterHeatingFuel === "Gas") {
          h_28 = waterGasVolume + spaceGasVolume;
        } else if (waterHeatingFuel === "Gas") {
          h_28 = waterGasVolume;
        } else if (spaceHeatingFuel === "Gas") {
          h_28 = spaceGasVolume;
        }

        return (h_28 * l28) / 1000;
      },
    });

    // k_29: Target Propane Emissions = h_29 × l_29 / 1000
    // Note: h_29 = d_29 (target mirrors actual for user-controlled fuel)
    graph.registerNode({
      id: "emissions.target.propane",
      legacyId: "k_29",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.propane.kg", "emissions.factor.propane"],
      label: "Target Propane Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        // Section04.js line 1250: k_29 = h_29 × 2970 / 1000, where h_29 = d_29
        const d29 = parseNum(inputs["energy.actual.propane.kg"], 0);
        const l29 = parseNum(inputs["emissions.factor.propane"], 2970);
        return (d29 * l29) / 1000;
      },
    });

    // k_30: Target Oil Emissions = h_30 × l_30 / 1000
    // Note: Emissions calculated from VOLUME (h_30), not energy (j_30)
    graph.registerNode({
      id: "emissions.target.oil",
      legacyId: "k_30",
      section: "S04",
      classification: "C",
      dependencies: [
        "mechanical.heating.systemType",
        "waterHeating.systemType",
        "waterHeating.oilVolume",
        "mechanical.heating.oilConsumption",
        "emissions.factor.oil"
      ],
      label: "Target Oil Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        // Section04.js line 1275: k_30 = h_30 × 2753 / 1000
        // h_30 = combined oil volume from space heating + water heating
        const spaceHeatingFuel = inputs["mechanical.heating.systemType"] || "";
        const waterHeatingFuel = inputs["waterHeating.systemType"] || "";
        const waterOilVolume = parseNum(inputs["waterHeating.oilVolume"], 0);
        const spaceOilVolume = parseNum(inputs["mechanical.heating.oilConsumption"], 0);
        const l30 = parseNum(inputs["emissions.factor.oil"], 2753);

        let h_30 = 0;
        if (spaceHeatingFuel === "Oil" && waterHeatingFuel === "Oil") {
          h_30 = waterOilVolume + spaceOilVolume;
        } else if (waterHeatingFuel === "Oil") {
          h_30 = waterOilVolume;
        } else if (spaceHeatingFuel === "Oil") {
          h_30 = spaceOilVolume;
        }

        return (h_30 * l30) / 1000;
      },
    });

    // k_31: Target Wood Emissions = h_31 × l_31 (no /1000, factor already in kgCO2e)
    graph.registerNode({
      id: "emissions.target.wood",
      legacyId: "k_31",
      section: "S04",
      classification: "C",
      dependencies: ["forestry.woodVolume", "emissions.factor.wood"],
      label: "Target Wood Emissions (kg CO2e/yr)",
      compute: (inputs) => {
        // Section04.js line 1286: k_31 = h_31 × 150, where h_31 = d_31
        const d31 = parseNum(inputs["forestry.woodVolume"], 0);
        const l31 = parseNum(inputs["emissions.factor.wood"], 150);
        return d31 * l31;  // No /1000, l_31 already in kgCO2e/m³
      },
    });

    // ========================================================================
    // ROW 32 SUBTOTALS (Critical for S01 dashboard)
    // Section04.js lines 1323-1326
    // ========================================================================

    // Actual energy subtotal (f_32) = SUM(f_27:f_31)
    graph.registerNode({
      id: "energy.actual.total",
      legacyId: "f_32",
      section: "S04",
      classification: "C",
      dependencies: [
        "energy.actual.electricity",
        "energy.actual.gas",
        "energy.actual.propane",
        "energy.actual.oil",
        "energy.actual.wood"
      ],
      label: "Actual Energy Total (kWh/yr)",
      compute: (inputs) => {
        // f_32 = SUM(f_27:f_31) (Section04.js line 1323)
        const f27 = parseNum(inputs["energy.actual.electricity"]);
        const f28 = parseNum(inputs["energy.actual.gas"]);
        const f29 = parseNum(inputs["energy.actual.propane"]);
        const f30 = parseNum(inputs["energy.actual.oil"]);
        const f31 = parseNum(inputs["energy.actual.wood"]);
        return f27 + f28 + f29 + f30 + f31;
      },
    });

    // Actual emissions subtotal (g_32) = SUM(g_27:g_31) - (d_60 * 1000)
    graph.registerNode({
      id: "emissions.actual.subtotal",
      legacyId: "g_32",
      section: "S04",
      classification: "C",
      dependencies: [
        "emissions.actual.electricity",
        "emissions.actual.gas",
        "emissions.actual.propane",
        "emissions.actual.oil",
        "emissions.actual.wood",
        "forestry.annualOffset"
      ],
      label: "Actual Emissions Subtotal (kg CO2e/yr)",
      compute: (inputs) => {
        // g_32 = SUM(g_27:g_31) - (d_60 * 1000) (Section04.js line 1324)
        const g27 = parseNum(inputs["emissions.actual.electricity"]);
        const g28 = parseNum(inputs["emissions.actual.gas"]);
        const g29 = parseNum(inputs["emissions.actual.propane"]);
        const g30 = parseNum(inputs["emissions.actual.oil"]);
        const g31 = parseNum(inputs["emissions.actual.wood"]);
        const d60 = parseNum(inputs["forestry.annualOffset"]); // MT/yr
        return g27 + g28 + g29 + g30 + g31 - (d60 * 1000);
      },
    });

    // Target energy subtotal (j_32) = SUM(j_27:j_31)
    graph.registerNode({
      id: "energy.target.total",
      legacyId: "j_32",
      section: "S04",
      classification: "C",
      dependencies: [
        "energy.target.electricity",
        "energy.target.gas",
        "energy.target.propane",
        "energy.target.oil",
        "energy.target.wood"
      ],
      label: "Target Energy Total (kWh/yr)",
      compute: (inputs) => {
        // j_32 = SUM(j_27:j_31) (Section04.js line 1325)
        const j27 = parseNum(inputs["energy.target.electricity"]);
        const j28 = parseNum(inputs["energy.target.gas"]);
        const j29 = parseNum(inputs["energy.target.propane"]);
        const j30 = parseNum(inputs["energy.target.oil"]);
        const j31 = parseNum(inputs["energy.target.wood"]);
        return j27 + j28 + j29 + j30 + j31;
      },
    });

    // Target emissions subtotal (k_32) = SUM(k_27:k_31) - (d_60 * 1000)
    graph.registerNode({
      id: "emissions.target.subtotal",
      legacyId: "k_32",
      section: "S04",
      classification: "C",
      dependencies: [
        "emissions.target.electricity",
        "emissions.target.gas",
        "emissions.target.propane",
        "emissions.target.oil",
        "emissions.target.wood",
        "forestry.annualOffset"
      ],
      label: "Target Emissions Subtotal (kg CO2e/yr)",
      compute: (inputs) => {
        // k_32 = SUM(k_27:k_31) - (d_60 * 1000) (Section04.js line 1326)
        const k27 = parseNum(inputs["emissions.target.electricity"]);
        const k28 = parseNum(inputs["emissions.target.gas"]);
        const k29 = parseNum(inputs["emissions.target.propane"]);
        const k30 = parseNum(inputs["emissions.target.oil"]);
        const k31 = parseNum(inputs["emissions.target.wood"]);
        const d60 = parseNum(inputs["forestry.annualOffset"]); // MT/yr
        return k27 + k28 + k29 + k30 + k31 - (d60 * 1000);
      },
    });

    // ========================================================================
    // NOTE: h_8 and e_8 (Annual Carbon) are calculated in KeyValuesNodes.js
    // to avoid duplicate legacyId registrations
    // ========================================================================

    // ========================================================================
    // SECTION 05: GHGI Calculations
    // Section05.js lines 844-853
    // ========================================================================

    // Annual GHGI (g_38) = emissions / h_15
    graph.registerNode({
      id: "emissions.ghgi.annual",
      legacyId: "g_38",
      section: "S05",
      classification: "C",
      dependencies: ["emissions.target.subtotal", "building.conditionedFloorArea"],
      label: "Annual GHG Intensity (kg CO2e/m²/yr)",
      compute: (inputs) => {
        // g_38 = emissions / h_15 (Section05.js line 845)
        const emissions = parseNum(inputs["emissions.target.subtotal"]);
        const h15 = parseNum(inputs["building.conditionedFloorArea"], 1);
        return h15 > 0 ? emissions / h15 : 0;
      },
    });

    // Lifetime operational emissions (i_38) = g_38 * h_13
    graph.registerNode({
      id: "emissions.ghgi.lifetime",
      legacyId: "i_38",
      section: "S05",
      classification: "C",
      dependencies: ["emissions.ghgi.annual", "building.serviceLife"],
      label: "Lifetime Operational Emissions (kg CO2e/m²)",
      compute: (inputs) => {
        // i_38 = g_38 * h_13 (Section05.js line 892)
        const g38 = parseNum(inputs["emissions.ghgi.annual"]);
        const h13 = parseNum(inputs["building.serviceLife"], 50);
        return g38 * h13;
      },
    });

    // Total lifetime carbon (operational + embodied)
    graph.registerNode({
      id: "emissions.lifetime.total",
      section: "S05",
      classification: "C",
      dependencies: ["emissions.ghgi.lifetime", "building.userModelledEmbodiedCarbon"],
      label: "Total Lifetime Carbon (kg CO2e/m²)",
      compute: (inputs) => {
        const operational = parseNum(inputs["emissions.ghgi.lifetime"]);
        const embodied = parseNum(inputs["building.userModelledEmbodiedCarbon"]);
        return operational + embodied;
      },
    });

    // ========================================================================
    // S04 ROWS 33-36: Derived energy/emissions metrics
    // ========================================================================

    // l_33: Nuclear waste factor (user-editable input)
    graph.registerInput({
      id: "emissions.factor.nuclear",
      legacyId: "l_33",
      section: "S04",
      classification: "C",
      label: "Nuclear Waste Factor (g/kWh)",
      defaultValue: 0.0096,
    });

    // d_33: Actual Net Energy (GJ/yr) = (f_32 - d_43 - i_43) / 277.7777
    graph.registerNode({
      id: "energy.actual.netGJ",
      legacyId: "d_33",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.total", "renewable.onsiteTotal", "renewable.offsiteTotal"],
      label: "Actual Net Energy (GJ/yr)",
      compute: (inputs) => {
        const f32 = parseNum(inputs["energy.actual.total"]);
        const d43 = parseNum(inputs["renewable.onsiteTotal"]);
        const i43 = parseNum(inputs["renewable.offsiteTotal"]);
        return (f32 - d43 - i43) / 277.7777;
      },
    });

    // h_33: Target Net Energy (GJ/yr) = (j_32 - d_43 - i_43) / 277.7777
    graph.registerNode({
      id: "energy.target.netGJ",
      legacyId: "h_33",
      section: "S04",
      classification: "C",
      dependencies: ["energy.target.total", "renewable.onsiteTotal", "renewable.offsiteTotal"],
      label: "Target Net Energy (GJ/yr)",
      compute: (inputs) => {
        const j32 = parseNum(inputs["energy.target.total"]);
        const d43 = parseNum(inputs["renewable.onsiteTotal"]);
        const i43 = parseNum(inputs["renewable.offsiteTotal"]);
        return (j32 - d43 - i43) / 277.7777;
      },
    });

    // d_34: Actual Per Capita Energy (kWh/person)
    graph.registerNode({
      id: "energy.actual.perCapita",
      legacyId: "d_34",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.total", "occupancy.occupants"],
      label: "Actual Per Capita Energy (kWh/person)",
      compute: (inputs) => {
        const f32 = parseNum(inputs["energy.actual.total"]);
        const d63 = parseNum(inputs["occupancy.occupants"], 1);
        return d63 > 0 ? f32 / d63 : 0;
      },
    });

    // f_34: Actual Per Capita Energy (GJ/person)
    graph.registerNode({
      id: "energy.actual.perCapitaGJ",
      legacyId: "f_34",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.netGJ", "occupancy.occupants"],
      label: "Actual Per Capita Energy (GJ/person)",
      compute: (inputs) => {
        const d33 = parseNum(inputs["energy.actual.netGJ"]);
        const d63 = parseNum(inputs["occupancy.occupants"], 1);
        return d63 > 0 ? d33 / d63 : 0;
      },
    });

    // h_34: Target Per Capita Energy (kWh/person)
    graph.registerNode({
      id: "energy.target.perCapita",
      legacyId: "h_34",
      section: "S04",
      classification: "C",
      dependencies: ["energy.target.total", "occupancy.occupants"],
      label: "Target Per Capita Energy (kWh/person)",
      compute: (inputs) => {
        const j32 = parseNum(inputs["energy.target.total"]);
        const d63 = parseNum(inputs["occupancy.occupants"], 1);
        return d63 > 0 ? j32 / d63 : 0;
      },
    });

    // j_34: Target Per Capita Energy (GJ/person)
    graph.registerNode({
      id: "energy.target.perCapitaGJ",
      legacyId: "j_34",
      section: "S04",
      classification: "C",
      dependencies: ["energy.target.netGJ", "occupancy.occupants"],
      label: "Target Per Capita Energy (GJ/person)",
      compute: (inputs) => {
        const h33 = parseNum(inputs["energy.target.netGJ"]);
        const d63 = parseNum(inputs["occupancy.occupants"], 1);
        return d63 > 0 ? h33 / d63 : 0;
      },
    });

    // l_35: PER Factor (Primary Energy Renewable)
    // PHPP 10.6 Canada metric - weights energy end-uses
    graph.registerNode({
      id: "energy.perFactor",
      legacyId: "l_35",
      section: "S04",
      classification: "C",
      dependencies: [
        "building.referenceStandard",
        "energy.target.electricity", "energy.target.gas", "energy.target.propane",
        "energy.target.oil", "energy.target.wood",
        "spaceHeating.annualDemand", "cooling.annualDemand"
      ],
      label: "PER Factor",
      compute: (inputs) => {
        const standard = inputs["building.referenceStandard"] || "";
        if (!standard.toUpperCase().includes("PH")) return 1.0;

        const j27 = parseNum(inputs["energy.target.electricity"]);
        const j28 = parseNum(inputs["energy.target.gas"]);
        const j29 = parseNum(inputs["energy.target.propane"]);
        const j30 = parseNum(inputs["energy.target.oil"]);
        const j31 = parseNum(inputs["energy.target.wood"]);
        const d114 = parseNum(inputs["spaceHeating.annualDemand"]);
        const d117 = parseNum(inputs["cooling.annualDemand"]);

        const total = j27 + j28 + j29 + j30 + j31;
        if (total === 0) return 1.0;

        const otherHVAC = j27 - d114 - d117;
        const numerator = d114 * 1.5 + d117 * 1.2 + otherHVAC * 1.15 +
          j28 * 1.75 + j29 * 1.75 + j30 * 2.3 + j31 * 1.1;
        return numerator / total;
      },
    });

    // d_35: Primary Energy
    graph.registerNode({
      id: "energy.primary",
      legacyId: "d_35",
      section: "S04",
      classification: "C",
      dependencies: ["building.analysisMode", "energy.target.electricity", "energy.actual.electricity", "energy.perFactor"],
      label: "Primary Energy (kWh/yr)",
      compute: (inputs) => {
        const mode = inputs["building.analysisMode"] || "Utility Bills";
        const l35 = parseNum(inputs["energy.perFactor"], 1);
        return mode === "Targeted Use"
          ? parseNum(inputs["energy.target.electricity"]) * l35
          : parseNum(inputs["energy.actual.electricity"]) * l35;
      },
    });

    // f_35: Actual TEUI = f_32 / h_15
    graph.registerNode({
      id: "energy.actual.teui",
      legacyId: "f_35",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.total", "building.conditionedFloorArea"],
      label: "Actual TEUI (kWh/m²/yr)",
      compute: (inputs) => {
        const f32 = parseNum(inputs["energy.actual.total"]);
        const h15 = parseNum(inputs["building.conditionedFloorArea"], 1);
        return h15 > 0 ? f32 / h15 : 0;
      },
    });

    // j_35: Target TEUI = j_32 / h_15
    graph.registerNode({
      id: "energy.target.teui",
      legacyId: "j_35",
      section: "S04",
      classification: "C",
      dependencies: ["energy.target.total", "building.conditionedFloorArea"],
      label: "Target TEUI (kWh/m²/yr)",
      compute: (inputs) => {
        const j32 = parseNum(inputs["energy.target.total"]);
        const h15 = parseNum(inputs["building.conditionedFloorArea"], 1);
        return h15 > 0 ? j32 / h15 : 0;
      },
    });

    // l_34: High Level Nuclear Waste
    graph.registerNode({
      id: "emissions.nuclearWaste",
      legacyId: "l_34",
      section: "S04",
      classification: "C",
      dependencies: ["building.analysisMode", "energy.target.electricity", "energy.actual.electricity", "emissions.factor.nuclear"],
      label: "High Level Nuclear Waste (kg/yr)",
      compute: (inputs) => {
        const mode = inputs["building.analysisMode"] || "Utility Bills";
        const l33 = parseNum(inputs["emissions.factor.nuclear"], 0.0096);
        const electricity = mode === "Targeted Use"
          ? parseNum(inputs["energy.target.electricity"])
          : parseNum(inputs["energy.actual.electricity"]);
        return (electricity * l33) / 1000;
      },
    });

    // f_36: Actual PERI = (f_32/h_15) * l_35
    graph.registerNode({
      id: "energy.actual.peri",
      legacyId: "f_36",
      section: "S04",
      classification: "C",
      dependencies: ["energy.actual.teui", "energy.perFactor"],
      label: "Actual PERI (kWh/m²/yr)",
      compute: (inputs) => {
        return parseNum(inputs["energy.actual.teui"]) * parseNum(inputs["energy.perFactor"], 1);
      },
    });

    // j_36: Target PERI = (j_32/h_15) * l_35
    graph.registerNode({
      id: "energy.target.peri",
      legacyId: "j_36",
      section: "S04",
      classification: "C",
      dependencies: ["energy.target.teui", "energy.perFactor"],
      label: "Target PERI (kWh/m²/yr)",
      compute: (inputs) => {
        return parseNum(inputs["energy.target.teui"]) * parseNum(inputs["energy.perFactor"], 1);
      },
    });

    // ========================================================================
    // S05: Embodied Carbon fields
    // ========================================================================

    // d_38: Operational Emissions (MT CO2e/yr)
    graph.registerNode({
      id: "emissions.operational.mt",
      legacyId: "d_38",
      section: "S05",
      classification: "C",
      dependencies: ["emissions.target.subtotal"],
      label: "Operational Emissions (MT CO2e/yr)",
      compute: (inputs) => parseNum(inputs["emissions.target.subtotal"]) / 1000,
    });

    // i_40: Embodied Carbon Target (kgCO2e/m²) = d_16
    graph.registerNode({
      id: "emissions.embodiedTarget",
      legacyId: "i_40",
      section: "S05",
      classification: "C",
      dependencies: ["building.embodiedCarbonTarget"],
      label: "Embodied Carbon Target (kgCO2e/m²)",
      compute: (inputs) => {
        const val = inputs["building.embodiedCarbonTarget"];
        return val === "N/A" ? "N/A" : parseNum(val);
      },
    });

    // d_40: Total Embodied Carbon (MT CO2e) = i_41 × d_106 / 1000
    // d_106 (total floor area) will be graphed in Batch C
    graph.registerNode({
      id: "emissions.embodied.total",
      legacyId: "d_40",
      section: "S05",
      classification: "C",
      dependencies: ["building.userModelledEmbodiedCarbon", "geometry.totalFloorArea"],
      label: "Total Embodied Carbon (MT CO2e)",
      compute: (inputs) => {
        const i41 = parseNum(inputs["building.userModelledEmbodiedCarbon"]);
        const d106 = parseNum(inputs["geometry.totalFloorArea"]);
        return (i41 * d106) / 1000;
      },
    });

    // d_41: Lifetime Avoided Operational Emissions
    graph.registerNode({
      id: "emissions.avoidedLifetime",
      legacyId: "d_41",
      section: "S05",
      classification: "C",
      dependencies: ["emissions.operational.mt", "reference.emissions.operational.mt", "building.serviceLife"],
      label: "Lifetime Avoided Operational (MT CO2e)",
      compute: (inputs) => {
        const d38 = parseNum(inputs["emissions.operational.mt"]);
        const refD38 = parseNum(inputs["reference.emissions.operational.mt"]);
        const h13 = parseNum(inputs["building.serviceLife"], 50);
        return (refD38 - d38) * h13;
      },
    });

    // S05 compliance ratios (m_38-m_41, n_38-n_41)
    // These use reference.* inputs populated by cross-model sync (REF_OUTPUT_TO_TARGET_INPUT)
    // NOTE: reference.emissions.embodied (ref_i_39) is registered by KeyValuesNodes
    graph.registerInput({
      id: "reference.emissions.operational.mt",
      legacyId: "ref_d_38",
      section: "S05",
      classification: "C",
      label: "Reference Operational Emissions (MT CO2e/yr)",
      defaultValue: 0,
    });
    graph.registerInput({
      id: "reference.emissions.ghgi.annual",
      legacyId: "ref_g_38",
      section: "S05",
      classification: "C",
      label: "Reference GHGI (kgCO2e/m²/yr)",
      defaultValue: 0,
    });
    graph.registerInput({
      id: "reference.emissions.embodied.total",
      legacyId: "ref_d_40",
      section: "S05",
      classification: "C",
      label: "Reference Total Embodied (MT CO2e)",
      defaultValue: 0,
    });
    graph.registerInput({
      id: "reference.emissions.userModelled",
      legacyId: "ref_i_41",
      section: "S05",
      classification: "C",
      label: "Reference User Modelled EC (kgCO2e/m²)",
      defaultValue: 345.82,
    });

    // m_38: Operational compliance ratio
    graph.registerNode({
      id: "compliance.operational.ratio",
      legacyId: "m_38",
      section: "S05",
      classification: "C",
      dependencies: ["emissions.ghgi.annual", "reference.emissions.ghgi.annual"],
      label: "Operational Compliance Ratio",
      compute: (inputs) => {
        const target = parseNum(inputs["emissions.ghgi.annual"]);
        const ref = parseNum(inputs["reference.emissions.ghgi.annual"]);
        if (ref > 0) return Math.round((target / ref) * 100) + "%";
        return "100%";
      },
    });
    graph.registerNode({
      id: "compliance.operational.pass", legacyId: "n_38", section: "S05", classification: "C",
      dependencies: ["emissions.ghgi.annual", "reference.emissions.ghgi.annual"],
      label: "Operational Compliance Status",
      compute: (inputs) => {
        const t = parseNum(inputs["emissions.ghgi.annual"]);
        const r = parseNum(inputs["reference.emissions.ghgi.annual"]);
        return r > 0 && t / r <= 1.0 ? "✓" : "✗";
      },
    });

    // m_39: Typology compliance ratio
    graph.registerNode({
      id: "compliance.typology.ratio",
      legacyId: "m_39",
      section: "S05",
      classification: "C",
      dependencies: ["building.typologyEmbodiedCarbon", "reference.emissions.embodied"],
      label: "Typology Compliance Ratio",
      compute: (inputs) => {
        const target = parseNum(inputs["building.typologyEmbodiedCarbon"]);
        const ref = parseNum(inputs["reference.emissions.embodied"]);
        if (ref > 0) return Math.round((target / ref) * 100) + "%";
        return "100%";
      },
    });
    graph.registerNode({
      id: "compliance.typology.pass", legacyId: "n_39", section: "S05", classification: "C",
      dependencies: ["building.typologyEmbodiedCarbon", "reference.emissions.embodied"],
      label: "Typology Compliance Status",
      compute: (inputs) => {
        const t = parseNum(inputs["building.typologyEmbodiedCarbon"]);
        const r = parseNum(inputs["reference.emissions.embodied"]);
        return r > 0 && t / r <= 1.0 ? "✓" : "✗";
      },
    });

    // m_40: Embodied compliance ratio
    graph.registerNode({
      id: "compliance.embodied.ratio",
      legacyId: "m_40",
      section: "S05",
      classification: "C",
      dependencies: ["emissions.embodied.total", "reference.emissions.embodied.total"],
      label: "Embodied Compliance Ratio",
      compute: (inputs) => {
        const target = parseNum(inputs["emissions.embodied.total"]);
        const ref = parseNum(inputs["reference.emissions.embodied.total"]);
        if (ref > 0) return Math.round((target / ref) * 100) + "%";
        return "100%";
      },
    });
    graph.registerNode({
      id: "compliance.embodied.pass", legacyId: "n_40", section: "S05", classification: "C",
      dependencies: ["emissions.embodied.total", "reference.emissions.embodied.total"],
      label: "Embodied Compliance Status",
      compute: (inputs) => {
        const t = parseNum(inputs["emissions.embodied.total"]);
        const r = parseNum(inputs["reference.emissions.embodied.total"]);
        return r > 0 && t / r <= 1.0 ? "✓" : "✗";
      },
    });

    // m_41: User modelled compliance ratio
    graph.registerNode({
      id: "compliance.userModelled.ratio",
      legacyId: "m_41",
      section: "S05",
      classification: "C",
      dependencies: ["building.userModelledEmbodiedCarbon", "reference.emissions.userModelled"],
      label: "User Modelled Compliance Ratio",
      compute: (inputs) => {
        const target = parseNum(inputs["building.userModelledEmbodiedCarbon"]);
        const ref = parseNum(inputs["reference.emissions.userModelled"]);
        if (ref > 0) return Math.round((target / ref) * 100) + "%";
        return "100%";
      },
    });
    graph.registerNode({
      id: "compliance.userModelled.pass", legacyId: "n_41", section: "S05", classification: "C",
      dependencies: ["building.userModelledEmbodiedCarbon", "reference.emissions.userModelled"],
      label: "User Modelled Compliance Status",
      compute: (inputs) => {
        const t = parseNum(inputs["building.userModelledEmbodiedCarbon"]);
        const r = parseNum(inputs["reference.emissions.userModelled"]);
        return r > 0 && t / r <= 1.0 ? "✓" : "✗";
      },
    });

    console.log("[EmissionsNodes] Registered", inputs.length, "inputs");
  }

  window.TEUI.ComputationNodes.Emissions = { register };
  console.log("[EmissionsNodes] Module loaded");
})();
