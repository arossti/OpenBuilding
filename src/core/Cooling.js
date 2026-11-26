/**
 * Cooling.js - DEPRECATED
 *
 * Cooling calculations are now handled by CoolingNodes.js in the ComputationGraph.
 * This module is kept only for backwards compatibility - all methods are no-ops.
 *
 * CoolingNodes.js implements:
 * - cooling.latentLoadFactor (h_124)
 * - cooling.freeCoolingLimit (i_71)
 * - cooling.daysActiveCooling (m_124)
 * - And other cooling-related calculations
 */

window.TEUI = window.TEUI || {};

window.TEUI.CoolingCalculations = {
  // All methods are no-ops - CoolingNodes.js handles calculations
  initialize: function() {
    console.log("[Cooling] Deprecated - calculations handled by CoolingNodes.js");
  },

  calculateAll: function(mode) {
    // No-op - graph handles this
  },

  calculateStage1: function(mode) {
    // No-op - graph handles this
  },

  calculateStage2: function(mode) {
    // No-op - graph handles this
  },

  // Getters return values from StateManager (set by CoolingNodes.js via sync)
  getLatentLoadFactor: function(mode = "target") {
    const prefix = mode === "reference" ? "ref_" : "";
    return parseFloat(window.TEUI?.StateManager?.getValue(prefix + "h_124")) || 1;
  },

  getFreeCoolingLimit: function(mode = "target") {
    const prefix = mode === "reference" ? "ref_" : "";
    return parseFloat(window.TEUI?.StateManager?.getValue(prefix + "i_71")) || 0;
  },

  getDaysActiveCooling: function(mode = "target") {
    const prefix = mode === "reference" ? "ref_" : "";
    return parseFloat(window.TEUI?.StateManager?.getValue(prefix + "m_124")) || 0;
  },

  getWetBulbTemperature: function(mode = "target") {
    // Wet bulb not stored in StateManager - return 0
    return 0;
  },

  recalculate: function(mode) {
    // No-op - graph handles this
  },

  getDebugInfo: function(mode = "target") {
    return { mode, deprecated: true, message: "Use CoolingNodes.js" };
  },

  getAllStates: function() {
    return { deprecated: true, message: "Use CoolingNodes.js" };
  }
};

console.log("[Cooling] Module loaded (deprecated - see CoolingNodes.js)");
