/**
 * ForestryNodes.js - Wood Emissions Offset (Section 08)
 *
 * d_60: Wood offset (MT/yr) used in S04 Row 32 emissions calculations
 *
 * Legacy calculation derived from Section04.js:
 *   k_31 = d_31 * 150 (wood volume * emissions factor)
 *   d_60 = k_31 / 1000 (if d_31 > 0, else 0)
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
    // Input: Wood volume from S04 Row 31
    const inputs = [
      {
        id: "forestry.woodVolume",
        legacyId: "d_31",
        section: "S04",
        classification: "G",
        label: "Wood Volume (m³/yr)",
        defaultValue: 0
      },
    ];

    graph.registerInputs(inputs);

    // Annual wood offset (d_60) - used to offset emissions in S04
    // This is subtracted from emissions totals in Row 32
    // k_31 (wood emissions) is registered in EmissionsNodes as emissions.target.wood
    graph.registerNode({
      id: "forestry.annualOffset",
      legacyId: "d_60",
      section: "S08",
      classification: "C",
      dependencies: ["forestry.woodVolume", "emissions.target.wood"],
      label: "Annual Wood Offset (MT CO2/yr)",
      compute: (inputs) => {
        const volume = parseNum(inputs["forestry.woodVolume"]);
        const emissions = parseNum(inputs["emissions.target.wood"]);
        // d_60 = k_31 / 1000 (if d_31 > 0)
        return volume > 0 ? emissions / 1000 : 0;
      },
    });

    console.log("[ForestryNodes] Registered", inputs.length, "inputs");
  }

  window.TEUI.ComputationNodes.Forestry = { register };
  console.log("[ForestryNodes] Module loaded");
})();
