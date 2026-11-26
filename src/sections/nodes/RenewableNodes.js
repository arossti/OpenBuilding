/**
 * RenewableNodes.js - Renewable Energy (Section 06)
 *
 * Onsite and offsite renewable energy tracking:
 * - d_43: Onsite subtotal (PV + Wind + EV removal)
 * - i_43: Offsite subtotal (WWS + reserved)
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};
  window.TEUI.ComputationNodes = window.TEUI.ComputationNodes || {};

  function register(graph) {
    const inputs = [
      { id: "renewable.pv", legacyId: "d_44", section: "S06", classification: "C", label: "Photovoltaics (kWh/yr)", defaultValue: 0 },
      { id: "renewable.wind", legacyId: "d_45", section: "S06", classification: "C", label: "Wind (kWh/yr)", defaultValue: 0 },
      { id: "renewable.evRemoval", legacyId: "d_46", section: "S06", classification: "C", label: "EV Charging Removal (kWh/yr)", defaultValue: 0 },
      { id: "renewable.wws", legacyId: "i_44", section: "S06", classification: "C", label: "WWS Electricity (kWh/yr)", defaultValue: 0 },
      { id: "renewable.reserved", legacyId: "i_46", section: "S06", classification: "C", label: "Reserved (kWh/yr)", defaultValue: 0 },
      { id: "renewable.greenGas", legacyId: "k_45", section: "S06", classification: "C", label: "Green Gas (m³/yr)", defaultValue: 0 },
      { id: "renewable.exteriorLoads", legacyId: "m_43", section: "S06", classification: "C", label: "Exterior/Site Loads (kWh/yr)", defaultValue: 0 },
    ];

    graph.registerInputs(inputs);

    // d_43 = d_44 + d_45 + d_46 + i_46
    graph.registerNode({
      id: "renewable.onsiteTotal",
      legacyId: "d_43",
      section: "S06",
      classification: "C",
      dependencies: ["renewable.pv", "renewable.wind", "renewable.evRemoval", "renewable.reserved"],
      label: "Onsite Renewables Total (kWh/yr)",
      compute: (inputs) => {
        const pv = parseFloat(inputs["renewable.pv"]) || 0;
        const wind = parseFloat(inputs["renewable.wind"]) || 0;
        const ev = parseFloat(inputs["renewable.evRemoval"]) || 0;
        const reserved = parseFloat(inputs["renewable.reserved"]) || 0;
        return pv + wind + ev + reserved;
      },
    });

    // i_43 = i_44 + i_46
    graph.registerNode({
      id: "renewable.offsiteTotal",
      legacyId: "i_43",
      section: "S06",
      classification: "C",
      dependencies: ["renewable.wws", "renewable.reserved"],
      label: "Offsite Renewables Total (kWh/yr)",
      compute: (inputs) => {
        const wws = parseFloat(inputs["renewable.wws"]) || 0;
        const reserved = parseFloat(inputs["renewable.reserved"]) || 0;
        return wws + reserved;
      },
    });

    // i_45 = k_45 * 10.3321 (green gas energy conversion)
    graph.registerNode({
      id: "renewable.greenGasEnergy",
      legacyId: "i_45",
      section: "S06",
      classification: "C",
      dependencies: ["renewable.greenGas"],
      label: "Green Gas Energy (kWh/yr)",
      compute: (inputs) => {
        const gas = parseFloat(inputs["renewable.greenGas"]) || 0;
        return gas * 10.3321;
      },
    });

    console.log("[RenewableNodes] Registered", inputs.length, "inputs");
  }

  window.TEUI.ComputationNodes.Renewable = { register };
  console.log("[RenewableNodes] Module loaded");
})();
