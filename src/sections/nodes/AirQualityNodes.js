/**
 * AirQualityNodes.js - Indoor Air Quality (Section 08)
 *
 * Radon, CO2, TVOC targets and compliance checks.
 * Humidity range validation (heating + cooling seasons).
 *
 * d_60 (wood offset) is handled by ForestryNodes.js.
 * i_59 (cooling season RH) is registered in CoolingNodes.js.
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};
  window.TEUI.ComputationNodes = window.TEUI.ComputationNodes || {};

  function parseNum(value, defaultVal = 0) {
    if (value === null || value === undefined || value === "N/A") return defaultVal;
    const num = parseFloat(String(value).replace(/,/g, ""));
    return isNaN(num) ? defaultVal : num;
  }

  function register(graph) {
    // ========================================================================
    // INPUTS - User-editable air quality targets
    // ========================================================================
    const inputs = [
      { id: "airQuality.radon.target", legacyId: "d_56", section: "S08", classification: "A", label: "Radon Target (Bq/m³)", defaultValue: 50 },
      { id: "airQuality.co2.target", legacyId: "d_57", section: "S08", classification: "A", label: "CO2 Target (ppm)", defaultValue: 550 },
      { id: "airQuality.tvoc.target", legacyId: "d_58", section: "S08", classification: "A", label: "TVOC Target (ppm)", defaultValue: 100 },
      { id: "airQuality.humidity.heatingTarget", legacyId: "d_59", section: "S08", classification: "A", label: "RH Heating Season (%)", defaultValue: 45 },
      // i_59 (cooling season RH) is already registered in CoolingNodes.js as building.indoorRH
    ];

    graph.registerInputs(inputs);

    // ========================================================================
    // COMPUTED: Guidance limits (constant values for DOM display)
    // ========================================================================
    graph.registerNode({
      id: "airQuality.radon.limit",
      legacyId: "k_56",
      section: "S08",
      classification: "C",
      dependencies: [],
      label: "Radon Guidance Limit (Bq/m³)",
      compute: () => 150,
    });

    graph.registerNode({
      id: "airQuality.co2.limit",
      legacyId: "k_57",
      section: "S08",
      classification: "C",
      dependencies: [],
      label: "CO2 Guidance Limit (ppm)",
      compute: () => 1000,
    });

    graph.registerNode({
      id: "airQuality.tvoc.limit",
      legacyId: "k_58",
      section: "S08",
      classification: "C",
      dependencies: [],
      label: "TVOC Guidance Limit (ppm)",
      compute: () => 400,
    });

    // ========================================================================
    // COMPUTED: Compliance ratios (target / limit)
    // ========================================================================
    graph.registerNode({
      id: "airQuality.radon.compliance",
      legacyId: "m_56",
      section: "S08",
      classification: "C",
      dependencies: ["airQuality.radon.target", "airQuality.radon.limit"],
      label: "Radon Compliance (%)",
      compute: (inputs) => {
        const target = parseNum(inputs["airQuality.radon.target"], 50);
        const limit = parseNum(inputs["airQuality.radon.limit"], 150);
        return limit > 0 ? (target / limit) * 100 : 0;
      },
    });

    graph.registerNode({
      id: "airQuality.co2.compliance",
      legacyId: "m_57",
      section: "S08",
      classification: "C",
      dependencies: ["airQuality.co2.target", "airQuality.co2.limit"],
      label: "CO2 Compliance (%)",
      compute: (inputs) => {
        const target = parseNum(inputs["airQuality.co2.target"], 550);
        const limit = parseNum(inputs["airQuality.co2.limit"], 1000);
        return limit > 0 ? (target / limit) * 100 : 0;
      },
    });

    graph.registerNode({
      id: "airQuality.tvoc.compliance",
      legacyId: "m_58",
      section: "S08",
      classification: "C",
      dependencies: ["airQuality.tvoc.target", "airQuality.tvoc.limit"],
      label: "TVOC Compliance (%)",
      compute: (inputs) => {
        const target = parseNum(inputs["airQuality.tvoc.target"], 100);
        const limit = parseNum(inputs["airQuality.tvoc.limit"], 400);
        return limit > 0 ? (target / limit) * 100 : 0;
      },
    });

    graph.registerNode({
      id: "airQuality.humidity.range",
      legacyId: "m_59",
      section: "S08",
      classification: "C",
      dependencies: [],
      label: "Acceptable RH Range",
      compute: () => "30-60%",
    });

    // ========================================================================
    // COMPUTED: Pass/fail status indicators
    // ========================================================================
    graph.registerNode({
      id: "airQuality.radon.status",
      legacyId: "n_56",
      section: "S08",
      classification: "C",
      dependencies: ["airQuality.radon.compliance"],
      label: "Radon Status",
      compute: (inputs) => {
        const pct = parseNum(inputs["airQuality.radon.compliance"], 0);
        return pct <= 100 ? "✓" : "✗";
      },
    });

    graph.registerNode({
      id: "airQuality.co2.status",
      legacyId: "n_57",
      section: "S08",
      classification: "C",
      dependencies: ["airQuality.co2.compliance"],
      label: "CO2 Status",
      compute: (inputs) => {
        const pct = parseNum(inputs["airQuality.co2.compliance"], 0);
        return pct <= 100 ? "✓" : "✗";
      },
    });

    graph.registerNode({
      id: "airQuality.tvoc.status",
      legacyId: "n_58",
      section: "S08",
      classification: "C",
      dependencies: ["airQuality.tvoc.compliance"],
      label: "TVOC Status",
      compute: (inputs) => {
        const pct = parseNum(inputs["airQuality.tvoc.compliance"], 0);
        return pct <= 100 ? "✓" : "✗";
      },
    });

    graph.registerNode({
      id: "airQuality.humidity.status",
      legacyId: "n_59",
      section: "S08",
      classification: "C",
      dependencies: ["airQuality.humidity.heatingTarget", "building.indoorRH"],
      label: "Humidity Status",
      compute: (inputs) => {
        const heating = parseNum(inputs["airQuality.humidity.heatingTarget"], 45);
        const cooling = parseNum(inputs["building.indoorRH"], 45);
        const inRange = heating >= 30 && heating <= 60 && cooling >= 30 && cooling <= 60;
        return inRange ? "✓" : "✗";
      },
    });

    // k_59: Acceptable RH range guidance value (constant)
    graph.registerNode({
      id: "airQuality.humidity.guidanceRange",
      legacyId: "k_59",
      section: "S08",
      classification: "C",
      dependencies: [],
      label: "Acceptable RH Guidance Range",
      compute: () => "30-60",
    });

    console.log("[AirQualityNodes] Registered", inputs.length, "inputs and 12 nodes");
  }

  window.TEUI.ComputationNodes.AirQuality = { register };
  console.log("[AirQualityNodes] Module loaded");
})();
