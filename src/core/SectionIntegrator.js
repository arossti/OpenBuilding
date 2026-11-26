/**
 * SectionIntegrator.js
 *
 * Handles cross-section integration that isn't part of the ComputationGraph:
 * - Startup seed values for SM (before graph init)
 * - d_14 dropdown → Section01 presentation toggle
 */

window.TEUI = window.TEUI || {};

TEUI.SectionIntegrator = (function () {
  function initialize() {
    document.addEventListener("teui-rendering-complete", function () {
      ensureCorrectTEUIValues();
      setupSection01Listeners();
    });
  }

  /**
   * Seed default values in SM before graph computes them.
   * These prevent NaN display on first render.
   */
  function ensureCorrectTEUIValues() {
    const SM = window.TEUI.StateManager;
    if (!SM) return;

    const defaults = {
      f_32: "132938.00",
      j_32: "132763.65",
      h_15: "1427.20",
    };

    for (const [field, value] of Object.entries(defaults)) {
      if (SM.getValue(field) === null) {
        SM.setValue(field, value, SM.VALUE_STATES.DEFAULT);
      }
    }
  }

  /**
   * d_14 dropdown (Energy Input Type) toggles Section01's display variant.
   */
  function setupSection01Listeners() {
    const dropdown = document.querySelector('select[data-field-id="d_14"]');
    if (dropdown) {
      dropdown.addEventListener("change", function () {
        if (window.TEUI.DOMBridge?.stampAll) window.TEUI.DOMBridge.stampAll();
        if (window.TEUI.SectionModules?.sect01?.postStamp) {
          window.TEUI.SectionModules.sect01.postStamp();
        }
      });
    }
  }

  return {
    initialize: initialize,
  };
})();
