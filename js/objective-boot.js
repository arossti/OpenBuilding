/**
 * objective-boot.js — OBJECTIVE's start-up on objectivepro.html, in place of V3's
 * src/core/init.js (which is V3 page chrome: its tabs, buttons and modals).
 *
 * Kept from init.js, in its order and timing:
 *  - On DOMContentLoaded: StateManager, a second FieldManager render (the first is
 *    FieldManager.js's own listener; objective4.mjs has already moved each V3 .section
 *    into its S-panel), SectionIntegrator, ReferenceManager, ReferenceToggle, and the
 *    input styling (editing-intent / user-modified).
 *  - +500 ms: the computation graph initialises, the LegacyAdapter is enabled, and a
 *    wildcard StateManager listener recomputes on every input change.
 *  - +1500 ms: the default case study loads, as V3 does on start-up.
 * Classic script (V3's modules are classic scripts on window.TEUI).
 */
(function () {
  "use strict";
  var DEFAULT_CASE = "src/template/case-studies/01-assembly-obc-sb10.csv";

  function wireGraph() {
    var T = window.TEUI;
    var CI = T && T.ComputationIntegration;
    if (!CI) return;
    T.USE_COMPUTATION_GRAPH = true;
    if (!CI.initialize({ enableLogging: false, autoSync: true })) return;
    CI.enableAdapter();
    var SM = T.StateManager;
    if (!SM) return;
    var recomputing = false;
    var lookup = null;
    function legacyLookup() {
      if (lookup) return lookup;
      var graph = CI.getGraph();
      if (!graph) return null;
      lookup = new Map();
      (graph.getAllInputIds ? graph.getAllInputIds() : []).forEach(function (id) {
        var inp = graph.getInput(id);
        if (inp && inp.legacyId) lookup.set(inp.legacyId, id);
      });
      return lookup;
    }
    var EDITABLE_COMPUTED = { d_21: true };
    SM.addListener("*", function (newValue, oldValue, fieldId) {
      if (recomputing || !CI.isInitialized()) return;
      var baseId = fieldId.indexOf("ref_") === 0 ? fieldId.slice(4) : fieldId;
      var map = legacyLookup();
      if (!(map && map.get(baseId)) && !EDITABLE_COMPUTED[baseId]) return;
      recomputing = true;
      try {
        CI.recomputeForInput(fieldId);
      } finally {
        recomputing = false;
      }
    });
  }

  function loadDefaultCase() {
    fetch(DEFAULT_CASE)
      .then(function (r) {
        return r.ok ? r.text() : null;
      })
      .then(function (csv) {
        if (csv && window.TEUI.FileHandler) window.TEUI.FileHandler.processImportedCSV(csv);
      })
      .catch(function (e) {
        console.warn("[OBJECTIVE] default case study did not load:", e);
      });
  }

  // A user input field carries "editing-intent" while focused and "user-modified"
  // once its value changes (V3: grey italic default → blue entered value).
  function wireInputStyling() {
    var SEL = '[contenteditable="true"].user-input, input.user-input';
    document.addEventListener(
      "focus",
      function (e) {
        var f = e.target;
        if (!f.matches || !f.matches(SEL)) return;
        f.classList.add("editing-intent");
        f.dataset.originalValue = f.textContent || f.value || "";
      },
      true
    );
    document.addEventListener(
      "blur",
      function (e) {
        var f = e.target;
        if (!f.matches || !f.matches(SEL)) return;
        f.classList.remove("editing-intent");
        var now = f.textContent || f.value || "";
        if (now !== (f.dataset.originalValue || "") && now.trim() !== "") f.classList.add("user-modified");
        else if (now.trim() === "") f.classList.remove("user-modified");
      },
      true
    );
  }

  document.addEventListener("DOMContentLoaded", function () {
    var T = window.TEUI;
    if (!T || !T.StateManager || !T.FieldManager) {
      console.error("[OBJECTIVE] core modules missing");
      return;
    }
    // init.js's sequence (FieldManager.js's own DOMContentLoaded listener has
    // already rendered once; V3 renders again here, so do we).
    T.StateManager.initialize();
    T.FieldManager.renderAllSections();
    if (T.SectionIntegrator) T.SectionIntegrator.initialize();
    if (T.ReferenceValues && T.ReferenceManager) T.ReferenceManager.initialize();
    if (T.ReferenceToggle) T.ReferenceToggle.initialize();
    wireInputStyling();
    setTimeout(wireGraph, 500);
    setTimeout(loadDefaultCase, 1500);
  });
})();
