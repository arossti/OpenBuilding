/**
 * pcFinancials.js
 * Financial calculations for Parallel Coordinates (Section 18)
 *
 * PRO VERSION ONLY - This file should be excluded from Base version
 *
 * Calculates cost impact (CAD$) for each optimization axis
 * Architecture: Separate module that ParallelCoordinates.js conditionally uses
 *
 * TEUI Calculator 4.012
 */

window.TEUI = window.TEUI || {};

window.TEUI.pcFinancials = (function () {
  "use strict";

  const StateManager = window.TEUI.StateManager;

  /**
   * Helper function to get value from StateManager
   * @param {string} key - Field ID (e.g., 'j_51', 'ref_j_51')
   * @returns {number} Parsed float value or 0 if invalid
   */
  const getValue = key => {
    if (!StateManager) {
      console.warn("pcFinancials: StateManager not available");
      return 0;
    }
    const val = StateManager.getValue(key);

    // Strip currency formatting ($, commas) before parsing
    // Handles: "$0.1300", "$1,234.56", "12828.144"
    const cleanVal = typeof val === "string" ? val.replace(/[$,]/g, "") : val;

    const numVal = parseFloat(cleanVal);
    return typeof numVal === "number" && !isNaN(numVal) ? numVal : 0;
  };

  /**
   * Financial calculations per axis
   * Each axis has three functions: target(), reference(), savings()
   */
  const calculations = {
    /**
     * SHW% - Service Hot Water Efficiency
     * Cost = (Electric × Rate) + (Gas × Rate) + (Oil × Rate)
     * Handles all three fuel types - whichever is 0 contributes $0
     */
    shw_efficiency: {
      target: () => {
        const electricEnergy = getValue("k_51"); // Net SHW electric demand (kWh) - TARGET
        const electricRate = getValue("l_12"); // Electricity cost ($/kWh) - TARGET
        const gasEnergy = getValue("e_51"); // SHW gas energy (kWh) - TARGET
        const gasRate = getValue("l_13"); // Gas cost ($/kWh) - TARGET
        const oilVolume = getValue("k_54"); // SHW oil volume (litres) - TARGET
        const oilRate = getValue("l_16"); // Oil cost ($/litre) - TARGET

        return (
          electricEnergy * electricRate +
          gasEnergy * gasRate +
          oilVolume * oilRate
        );
      },
      reference: () => {
        const electricEnergy = getValue("ref_k_51"); // Net SHW electric demand (kWh) - REFERENCE
        const electricRate = getValue("ref_l_12"); // Electricity cost ($/kWh) - REFERENCE
        const gasEnergy = getValue("ref_e_51"); // SHW gas energy (kWh) - REFERENCE
        const gasRate = getValue("ref_l_13"); // Gas cost ($/kWh) - REFERENCE
        const oilVolume = getValue("ref_k_54"); // SHW oil volume (litres) - REFERENCE
        const oilRate = getValue("ref_l_16"); // Oil cost ($/litre) - REFERENCE

        return (
          electricEnergy * electricRate +
          gasEnergy * gasRate +
          oilVolume * oilRate
        );
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0; // Only show positive savings, $0 if cost increases
      },
    },

    /**
     * DWHR% - Drain Water Heat Recovery
     * Cost = SHW Cost × (DWHR% / 100)
     * Shows dollar value of energy RECOVERED by DWHR
     * If DWHR = 0%, recovery = $0 (no benefit)
     * If DWHR = 50%, recovery = 50% of SHW cost saved
     */
    dwhr_efficiency: {
      target: () => {
        // Get SHW cost (same calculation as shw_efficiency.target)
        const shwCost = calculations.shw_efficiency.target();

        // Get DWHR efficiency (stored as percentage: 0-100)
        const dwhrPercent = getValue("d_53"); // DWHR% - TARGET

        // Calculate recovery value: cost = SHW cost × (DWHR%/100)
        return shwCost * (dwhrPercent / 100);
      },
      reference: () => {
        // Get SHW cost (same calculation as shw_efficiency.reference)
        const shwCost = calculations.shw_efficiency.reference();

        // Get DWHR efficiency (stored as percentage: 0-100)
        const dwhrPercent = getValue("ref_d_53"); // DWHR% - REFERENCE

        // Calculate recovery value: cost = SHW cost × (DWHR%/100)
        return shwCost * (dwhrPercent / 100);
      },
      savings: function () {
        // For DWHR%, savings = additional recovery value in Target vs Reference
        // Higher DWHR% = more recovery = lower energy cost
        const targetRecovery = this.target();
        const refRecovery = this.reference();

        // If Target recovers more energy than Reference, show the additional savings
        const delta = targetRecovery - refRecovery;
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * nGains% - Net Useable Internal Gains
     * Cost = Value of avoided heating energy (kWh) in dollars
     * Higher nGains% = more avoided heating = more savings
     * No fuel detection needed - whichever fuel is 0 contributes $0
     */
    net_gains: {
      target: () => {
        const internalGains = getValue("i_80"); // Avoided heating (thermal kWh) - TARGET
        const heatingDemand = getValue("d_114"); // Total heating demand (kWh) - TARGET

        if (heatingDemand === 0) return 0; // No heating system

        // Get heating system fuel volume for oil (from Section 13)
        const oilHeatingL = getValue("f_115"); // Oil heating (litres) - TARGET

        // Get fuel rates (same as SHW%)
        const electricRate = getValue("l_12"); // $/kWh
        const gasRate = getValue("l_13"); // $/kWh
        const oilRate = getValue("l_16"); // $/litre

        // Calculate avoided cost based on heating fuel type (same pattern as SHW%)
        // Whichever fuel is 0 contributes $0
        const electricCost = internalGains * electricRate;
        const gasCost = internalGains * gasRate;

        // For oil: convert thermal kWh to litres, then apply rate
        // d_114 thermal kWh requires f_115 litres
        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = internalGains * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        // Sum all three (only one will be non-zero)
        return electricCost + gasCost + oilCost;
      },
      reference: () => {
        const internalGains = getValue("ref_i_80");
        const heatingDemand = getValue("ref_d_114");

        if (heatingDemand === 0) return 0;

        const oilHeatingL = getValue("ref_f_115");
        const electricRate = getValue("ref_l_12");
        const gasRate = getValue("ref_l_13");
        const oilRate = getValue("ref_l_16");

        const electricCost = internalGains * electricRate;
        const gasCost = internalGains * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = internalGains * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      savings: function () {
        // TODO: VERIFY LOGIC WITH ANDY (Nov 24 late evening discovery)
        // nGains% is percentage-based, not absolute
        // Same % but different heating demands = different dollar amounts
        // Example: Both 40% nGains, but Ref (lossy) avoids $31k, Target (efficient) avoids $29k
        // Question: Should savings be Ref - Target (showing cost of lower heating demand)?
        // Or should nGains% not have savings at all?
        // Current implementation: Target - Reference (reversed pattern)
        const delta = this.target() - this.reference();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * TB% - Thermal Bridging Penalty
     * Cost = Value of heat loss through thermal bridges (kWh) in dollars
     * Lower TB% = less heat loss = better performance
     * Uses same fuel cost calculation as nGains%
     */
    thermal_bridge: {
      target: () => {
        const thermalBridgingLoss = getValue("i_97"); // TB heat loss (thermal kWh) - TARGET
        const heatingDemand = getValue("d_114"); // Total heating demand (kWh) - TARGET

        if (heatingDemand === 0) return 0; // No heating system

        // Get heating system fuel volume for oil (from Section 13)
        const oilHeatingL = getValue("f_115"); // Oil heating (litres) - TARGET

        // Get fuel rates (same as SHW% and nGains%)
        const electricRate = getValue("l_12"); // $/kWh
        const gasRate = getValue("l_13"); // $/kWh
        const oilRate = getValue("l_16"); // $/litre

        // Calculate cost based on heating fuel type (same pattern as nGains%)
        // Whichever fuel is 0 contributes $0
        const electricCost = thermalBridgingLoss * electricRate;
        const gasCost = thermalBridgingLoss * gasRate;

        // For oil: convert thermal kWh to litres, then apply rate
        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = thermalBridgingLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        // Sum all three (only one will be non-zero)
        return electricCost + gasCost + oilCost;
      },
      reference: () => {
        const thermalBridgingLoss = getValue("ref_i_97");
        const heatingDemand = getValue("ref_d_114");

        if (heatingDemand === 0) return 0;

        const oilHeatingL = getValue("ref_f_115");
        const electricRate = getValue("ref_l_12");
        const gasRate = getValue("ref_l_13");
        const oilRate = getValue("ref_l_16");

        const electricCost = thermalBridgingLoss * electricRate;
        const gasCost = thermalBridgingLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = thermalBridgingLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      savings: function () {
        // TB% represents heat LOSS (cost), not benefit
        // Lower TB% = less cost = better, so use standard pattern (like SHW%)
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * Ag - Aggregate Ground U-value
     * Cost = Ground heat loss (i_102 kWh) × heating fuel rate
     * Lower Ag = less heat loss = better performance
     * Uses same fuel cost calculation as TB%
     */
    aggregate_ground_uvalue: {
      target: () => {
        const groundHeatLoss = getValue("i_102"); // Ground heat loss (thermal kWh) - TARGET
        const heatingDemand = getValue("d_114"); // Total heating demand (kWh) - TARGET

        if (heatingDemand === 0) return 0; // No heating system

        const oilHeatingL = getValue("f_115"); // Oil heating (litres) - TARGET
        const electricRate = getValue("l_12"); // $/kWh
        const gasRate = getValue("l_13"); // $/kWh
        const oilRate = getValue("l_16"); // $/litre

        const electricCost = groundHeatLoss * electricRate;
        const gasCost = groundHeatLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = groundHeatLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      reference: () => {
        const groundHeatLoss = getValue("ref_i_102");
        const heatingDemand = getValue("ref_d_114");

        if (heatingDemand === 0) return 0;

        const oilHeatingL = getValue("ref_f_115");
        const electricRate = getValue("ref_l_12");
        const gasRate = getValue("ref_l_13");
        const oilRate = getValue("ref_l_16");

        const electricCost = groundHeatLoss * electricRate;
        const gasCost = groundHeatLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = groundHeatLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * Ae - Aggregate Air U-value
     * Cost = Air heat loss (i_101 kWh) × heating fuel rate
     * Lower Ae = less heat loss = better performance
     * Uses same fuel cost calculation as TB%
     */
    aggregate_air_uvalue: {
      target: () => {
        const airHeatLoss = getValue("i_101"); // Air heat loss (thermal kWh) - TARGET
        const heatingDemand = getValue("d_114"); // Total heating demand (kWh) - TARGET

        if (heatingDemand === 0) return 0; // No heating system

        const oilHeatingL = getValue("f_115"); // Oil heating (litres) - TARGET
        const electricRate = getValue("l_12"); // $/kWh
        const gasRate = getValue("l_13"); // $/kWh
        const oilRate = getValue("l_16"); // $/litre

        const electricCost = airHeatLoss * electricRate;
        const gasCost = airHeatLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = airHeatLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      reference: () => {
        const airHeatLoss = getValue("ref_i_101");
        const heatingDemand = getValue("ref_d_114");

        if (heatingDemand === 0) return 0;

        const oilHeatingL = getValue("ref_f_115");
        const electricRate = getValue("ref_l_12");
        const gasRate = getValue("ref_l_13");
        const oilRate = getValue("ref_l_16");

        const electricCost = airHeatLoss * electricRate;
        const gasCost = airHeatLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = airHeatLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * ACH50 - Air Changes per Hour at 50Pa
     * Cost = Infiltration heat loss (i_103 kWh) × heating fuel rate
     * Lower ACH50 = less infiltration = better performance
     * Uses same fuel cost calculation as TB%
     */
    ach50: {
      target: () => {
        const infiltrationLoss = getValue("i_103"); // Infiltration heat loss (thermal kWh) - TARGET
        const heatingDemand = getValue("d_114"); // Total heating demand (kWh) - TARGET

        if (heatingDemand === 0) return 0; // No heating system

        const oilHeatingL = getValue("f_115"); // Oil heating (litres) - TARGET
        const electricRate = getValue("l_12"); // $/kWh
        const gasRate = getValue("l_13"); // $/kWh
        const oilRate = getValue("l_16"); // $/litre

        const electricCost = infiltrationLoss * electricRate;
        const gasCost = infiltrationLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = infiltrationLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      reference: () => {
        const infiltrationLoss = getValue("ref_i_103");
        const heatingDemand = getValue("ref_d_114");

        if (heatingDemand === 0) return 0;

        const oilHeatingL = getValue("ref_f_115");
        const electricRate = getValue("ref_l_12");
        const gasRate = getValue("ref_l_13");
        const oilRate = getValue("ref_l_16");

        const electricCost = infiltrationLoss * electricRate;
        const gasCost = infiltrationLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = infiltrationLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * WWR - Window-to-Wall Ratio
     * Cost = Sum of window heat loss (i_88 + i_89 + i_90 + i_91 + i_92 + i_93) × heating fuel rate
     * Lower WWR = less window area = less heat loss = better performance
     * Uses same fuel cost calculation as TB%
     */
    window_wall_ratio: {
      target: () => {
        // Sum of all window heat loss components (thermal kWh) - TARGET
        const windowHeatLoss =
          getValue("i_88") +
          getValue("i_89") +
          getValue("i_90") +
          getValue("i_91") +
          getValue("i_92") +
          getValue("i_93");

        const heatingDemand = getValue("d_114"); // Total heating demand (kWh) - TARGET

        if (heatingDemand === 0) return 0; // No heating system

        const oilHeatingL = getValue("f_115"); // Oil heating (litres) - TARGET
        const electricRate = getValue("l_12"); // $/kWh
        const gasRate = getValue("l_13"); // $/kWh
        const oilRate = getValue("l_16"); // $/litre

        const electricCost = windowHeatLoss * electricRate;
        const gasCost = windowHeatLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = windowHeatLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      reference: () => {
        const windowHeatLoss =
          getValue("ref_i_88") +
          getValue("ref_i_89") +
          getValue("ref_i_90") +
          getValue("ref_i_91") +
          getValue("ref_i_92") +
          getValue("ref_i_93");

        const heatingDemand = getValue("ref_d_114");

        if (heatingDemand === 0) return 0;

        const oilHeatingL = getValue("ref_f_115");
        const electricRate = getValue("ref_l_12");
        const gasRate = getValue("ref_l_13");
        const oilRate = getValue("ref_l_16");

        const electricCost = windowHeatLoss * electricRate;
        const gasCost = windowHeatLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = windowHeatLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * HEAT% - Heating System Efficiency
     * Cost = (Electric × Rate) + (Gas × Rate) + (Oil × Rate)
     * Same pattern as SHW% - handles all three fuel types
     * Higher HEAT% = more efficient = lower fuel consumption for same heat
     */
    heating_efficiency: {
      target: () => {
        const heatingDemand = getValue("d_114"); // Heating demand (kWh) - TARGET
        const electricRate = getValue("l_12"); // Electricity cost ($/kWh) - TARGET
        const gasVolume = getValue("h_115"); // Gas volume (m³) - TARGET
        const gasRate = getValue("l_13"); // Gas cost ($/m³) - TARGET
        const oilVolume = getValue("f_115"); // Oil volume (litres) - TARGET
        const oilRate = getValue("l_16"); // Oil cost ($/litre) - TARGET

        return (
          heatingDemand * electricRate +
          gasVolume * gasRate +
          oilVolume * oilRate
        );
      },
      reference: () => {
        const heatingDemand = getValue("ref_d_114");
        const electricRate = getValue("ref_l_12");
        const gasVolume = getValue("ref_h_115");
        const gasRate = getValue("ref_l_13");
        const oilVolume = getValue("ref_f_115");
        const oilRate = getValue("ref_l_16");

        return (
          heatingDemand * electricRate +
          gasVolume * gasRate +
          oilVolume * oilRate
        );
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * MVHR% - Mechanical Ventilation Heat Recovery
     * Cost = Ventilation heat loss (m_121 kWh) × heating fuel rate
     * Higher MVHR% = more recovery = less net heat loss = better performance
     * Uses same fuel cost calculation as TB%
     */
    mvhr_efficiency: {
      target: () => {
        const ventilationLoss = getValue("m_121"); // Net ventilation heat loss (thermal kWh) - TARGET
        const heatingDemand = getValue("d_114"); // Total heating demand (kWh) - TARGET

        if (heatingDemand === 0) return 0; // No heating system

        const oilHeatingL = getValue("f_115"); // Oil heating (litres) - TARGET
        const electricRate = getValue("l_12"); // $/kWh
        const gasRate = getValue("l_13"); // $/kWh
        const oilRate = getValue("l_16"); // $/litre

        const electricCost = ventilationLoss * electricRate;
        const gasCost = ventilationLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = ventilationLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      reference: () => {
        const ventilationLoss = getValue("ref_m_121");
        const heatingDemand = getValue("ref_d_114");

        if (heatingDemand === 0) return 0;

        const oilHeatingL = getValue("ref_f_115");
        const electricRate = getValue("ref_l_12");
        const gasRate = getValue("ref_l_13");
        const oilRate = getValue("ref_l_16");

        const electricCost = ventilationLoss * electricRate;
        const gasCost = ventilationLoss * gasRate;

        const oilLitresPerKWh =
          heatingDemand > 0 ? oilHeatingL / heatingDemand : 0;
        const oilLitres = ventilationLoss * oilLitresPerKWh;
        const oilCost = oilLitres * oilRate;

        return electricCost + gasCost + oilCost;
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * TEDI - Thermal Energy Demand Intensity
     * Cost = Heating fuel cost from Section 13
     * CRITICAL: Only use ONE fuel volume to avoid double-counting
     * - d_114 is ALWAYS calculated (thermal demand kWh) for all systems
     * - h_115 and f_115 are conditionally zero based on system type (d_113)
     * - Gas system: Use h_115 × l_13 ONLY (ignore d_114)
     * - Oil system: Use f_115 × l_16 ONLY (ignore d_114)
     * - Electric/Heatpump: Use d_114 × l_12 (h_115 and f_115 are zero)
     */
    tedi: {
      target: () => {
        const electricHeating = getValue("d_114") || 0; // Thermal demand (kWh) - TARGET
        const gasHeating = getValue("h_115") || 0; // Gas volume (m³) - TARGET
        const oilHeating = getValue("f_115") || 0; // Oil volume (litres) - TARGET

        const electricRate = getValue("l_12") || 0; // $/kWh
        const gasRate = getValue("l_13") || 0; // $/m³
        const oilRate = getValue("l_16") || 0; // $/litre

        // Only use the non-zero fuel volume to avoid double-counting
        if (gasHeating > 0) {
          return gasHeating * gasRate; // Gas system: m³ × $/m³
        } else if (oilHeating > 0) {
          return oilHeating * oilRate; // Oil system: litres × $/litre
        } else {
          return electricHeating * electricRate; // Electric/Heatpump: kWh × $/kWh
        }
      },
      reference: () => {
        const electricHeating = getValue("ref_d_114") || 0; // Thermal demand (kWh) - REFERENCE
        const gasHeating = getValue("ref_h_115") || 0; // Gas volume (m³) - REFERENCE
        const oilHeating = getValue("ref_f_115") || 0; // Oil volume (litres) - REFERENCE

        const electricRate = getValue("ref_l_12") || 0; // $/kWh
        const gasRate = getValue("ref_l_13") || 0; // $/m³
        const oilRate = getValue("ref_l_16") || 0; // $/litre

        // Only use the non-zero fuel volume to avoid double-counting
        if (gasHeating > 0) {
          return gasHeating * gasRate; // Gas system: m³ × $/m³
        } else if (oilHeating > 0) {
          return oilHeating * oilRate; // Oil system: litres × $/litre
        } else {
          return electricHeating * electricRate; // Electric/Heatpump: kWh × $/kWh
        }
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * TELI - Thermal Envelope Loss Intensity
     * Cost = TEDI cost × TELI/TEDI Ratio (m_131)
     *
     * Pro-rating approach:
     * - m_131 = TELI ÷ TEDI (calculated in Section 14)
     * - TELI cost = TEDI cost × m_131
     *
     * This automatically handles all fuel types (Gas, Oil, Electric/Heatpump)
     * by leveraging the TEDI cost calculation which already has conditional fuel logic
     */
    teli: {
      target: () => {
        const tediCost = calculations.tedi.target(); // TEDI cost (already handles all fuel types)
        const teliTediRatio = getValue("m_131") || 0; // TELI/TEDI ratio - TARGET

        return tediCost * teliTediRatio;
      },
      reference: () => {
        const tediCost = calculations.tedi.reference(); // TEDI cost (already handles all fuel types)
        const teliTediRatio = getValue("ref_m_131") || 0; // TELI/TEDI ratio - REFERENCE

        return tediCost * teliTediRatio;
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * GHGI - Greenhouse Gas Intensity
     * Returns kgCO2e/yr (not dollars) from k_32
     * The getValue() helper already strips $ formatting
     * This axis shows emissions, not financial cost
     */
    ghgi: {
      target: () => {
        const ghgEmissions = getValue("k_32"); // kgCO2e/yr - TARGET
        return ghgEmissions;
      },
      reference: () => {
        const ghgEmissions = getValue("ref_k_32"); // kgCO2e/yr - REFERENCE
        return ghgEmissions;
      },
      savings: function () {
        // Savings = emissions reduction (Reference - Target)
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },

    /**
     * TEUI - Total Energy Use Intensity
     * Cost = Sum of all fuel costs from Section 04
     * Handles mixed-fuel buildings (electricity, gas, propane, oil, wood)
     */
    teui: {
      target: () => {
        // Sum all fuel costs from S04 Target columns
        const electricEnergy = getValue("h_27") || 0; // Electricity (kWh/yr)
        const gasVolume = getValue("h_28") || 0; // Gas (m³/yr)
        const propaneVolume = getValue("h_29") || 0; // Propane (kg/yr)
        const oilVolume = getValue("h_30") || 0; // Oil (litres/yr)
        const woodVolume = getValue("h_31") || 0; // Wood (m³/yr)

        // Get energy prices from S01
        const electricRate = getValue("l_12") || 0; // $/kWh
        const gasRate = getValue("l_13") || 0; // $/m³
        const propaneRate = getValue("l_14") || 0; // $/kg
        const oilRate = getValue("l_16") || 0; // $/litre
        const woodRate = getValue("l_15") || 0; // $/m³

        return (
          electricEnergy * electricRate +
          gasVolume * gasRate +
          propaneVolume * propaneRate +
          oilVolume * oilRate +
          woodVolume * woodRate
        );
      },
      reference: () => {
        // Sum all fuel costs from S04 Reference columns
        const electricEnergy = getValue("ref_h_27") || 0; // Electricity (kWh/yr)
        const gasVolume = getValue("ref_h_28") || 0; // Gas (m³/yr)
        const propaneVolume = getValue("ref_h_29") || 0; // Propane (kg/yr)
        const oilVolume = getValue("ref_h_30") || 0; // Oil (litres/yr)
        const woodVolume = getValue("ref_h_31") || 0; // Wood (m³/yr)

        // Get energy prices from S01 Reference
        const electricRate = getValue("ref_l_12") || 0; // $/kWh
        const gasRate = getValue("ref_l_13") || 0; // $/m³
        const propaneRate = getValue("ref_l_14") || 0; // $/kg
        const oilRate = getValue("ref_l_16") || 0; // $/litre
        const woodRate = getValue("ref_l_15") || 0; // $/m³

        return (
          electricEnergy * electricRate +
          gasVolume * gasRate +
          propaneVolume * propaneRate +
          oilVolume * oilRate +
          woodVolume * woodRate
        );
      },
      savings: function () {
        const delta = this.reference() - this.target();
        return delta > 0 ? delta : 0;
      },
    },
  };

  /**
   * Public API: Calculate financial cost for a specific axis and mode
   * @param {string} axisId - Axis identifier (e.g., 'shw_efficiency')
   * @param {string} mode - Calculation mode: 'target', 'reference', or 'savings'
   * @returns {object} { cost: number } - Cost in CAD$
   */
  function calculateFinancials(axisId, mode = "target") {
    const calc = calculations[axisId];

    if (!calc) {
      console.warn(`pcFinancials: No calculation defined for axis "${axisId}"`);
      return { cost: 0 };
    }

    try {
      if (mode === "target") {
        return { cost: calc.target() };
      } else if (mode === "reference") {
        return { cost: calc.reference() };
      } else if (mode === "savings") {
        return { cost: calc.savings() };
      } else {
        console.warn(
          `pcFinancials: Invalid mode "${mode}". Use 'target', 'reference', or 'savings'.`
        );
        return { cost: 0 };
      }
    } catch (error) {
      console.error(
        `pcFinancials: Error calculating ${axisId} (${mode}):`,
        error
      );
      return { cost: 0 };
    }
  }

  // Public API
  return {
    calculateFinancials,
  };
})();
