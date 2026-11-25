/**
 * SpaceHeatingNodes.js - Space Heating System (Section 13)
 *
 * Space heating fuel type, efficiency, and energy calculations
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};
  window.TEUI.ComputationNodes = window.TEUI.ComputationNodes || {};

  const FUEL_FACTORS = {
    "Electricity": { unit: "kWh", factor: 1 },
    "Gas": { unit: "m³", factor: 10.3321 },
    "Propane": { unit: "L", factor: 7.0833 },
    "Oil": { unit: "L", factor: 10.7444 },
    "Heatpump": { unit: "kWh", factor: 1 },
    "Wood": { unit: "kg", factor: 4.5 },
  };

  function register(graph) {
    // NOTE: All S13 inputs are registered in MechanicalNodes.
    // This module uses mechanical.* paths for those inputs.

    // Space heating energy from envelope heat loss
    graph.registerNode({
      id: "spaceHeating.annualDemand",
      section: "S13",
      classification: "C",
      dependencies: ["envelope.total.heatLoss"],
      label: "Space Heating Demand (kWh/yr)",
      compute: (inputs) => {
        // Heat loss from envelope is the heating demand
        return parseFloat(inputs["envelope.total.heatLoss"]) || 0;
      },
    });

    // Primary heating fuel consumption
    graph.registerNode({
      id: "spaceHeating.primaryFuelConsumption",
      section: "S13",
      classification: "C",
      dependencies: ["spaceHeating.annualDemand", "mechanical.heating.copHeat", "mechanical.heating.afue", "mechanical.heating.systemType"],
      label: "Primary Heating Fuel Consumption",
      compute: (inputs) => {
        const demand = parseFloat(inputs["spaceHeating.annualDemand"]) || 0;
        const systemType = inputs["mechanical.heating.systemType"] || "Gas";
        const factor = FUEL_FACTORS[systemType]?.factor || 1;

        // Get efficiency based on system type
        let efficiency;
        if (systemType === "Heatpump") {
          efficiency = parseFloat(inputs["mechanical.heating.copHeat"]) || 1;
        } else {
          efficiency = parseFloat(inputs["mechanical.heating.afue"]) || 0.95;
        }

        const energyIn = efficiency > 0 ? demand / efficiency : demand;
        return factor !== 1 ? energyIn / factor : energyIn;
      },
    });

    // Is heat pump (for COP logic)
    graph.registerNode({
      id: "spaceHeating.isHeatPump",
      section: "S13",
      classification: "C",
      dependencies: ["mechanical.heating.systemType"],
      label: "Is Heat Pump System",
      compute: (inputs) => {
        const type = inputs["mechanical.heating.systemType"] || "";
        return type === "Heatpump";
      },
    });

    console.log("[SpaceHeatingNodes] Registered space heating computed nodes");
  }

  window.TEUI.ComputationNodes.SpaceHeating = { register, FUEL_FACTORS };
  console.log("[SpaceHeatingNodes] Module loaded");
})();
