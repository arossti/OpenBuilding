/**
 * LegacyAdapter.js - Bridge Between Legacy StateManager and New MultiModelEngine
 *
 * Part of the Multi-Model Architecture refactoring (Phase 4, Task 4.1)
 * See: docs/REFACTORING_PLAN.md
 *
 * Allows gradual migration by making the new computation system accessible
 * via the existing StateManager API. Existing code continues to work while
 * gaining incremental computation benefits.
 *
 * Key translations:
 * - Legacy field IDs (d_85, ref_d_85) ↔ Semantic paths (envelope.roof.rsi)
 * - ref_ prefix → Reference model access
 * - StateManager.getValue/setValue → MultiModelState/Engine
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};

  // ============================================================================
  // LEGACY ADAPTER FACTORY
  // ============================================================================

  /**
   * Create a legacy adapter that bridges old API to new system
   * @param {Object} options
   * @param {Object} options.state - MultiModelState instance
   * @param {Object} options.engine - MultiModelEngine instance
   * @param {Object} [options.graph] - ComputationGraph for ID translation
   * @param {Object} [options.registry] - FieldRegistry for ID translation (fallback)
   * @returns {LegacyAdapter}
   */
  function createLegacyAdapter(options = {}) {
    const state = options.state;
    const engine = options.engine;
    const graph = options.graph;
    const registry = options.registry || window.TEUI.FieldRegistry;

    if (!state) {
      throw new Error("MultiModelState required");
    }

    if (!engine) {
      throw new Error("MultiModelEngine required");
    }

    // Build lookup maps from graph input nodes
    const legacyToSemantic = new Map();
    const semanticToLegacy = new Map();

    if (graph) {
      const inputIds = graph.getAllInputIds ? graph.getAllInputIds() : [];
      for (const semanticPath of inputIds) {
        const inputNode = graph.getInput(semanticPath);
        if (inputNode?.legacyId) {
          legacyToSemantic.set(inputNode.legacyId, semanticPath);
          semanticToLegacy.set(semanticPath, inputNode.legacyId);
        }
      }
      console.log(`[LegacyAdapter] Built translation maps: ${legacyToSemantic.size} mappings`);
    }

    // Store original StateManager for restoration
    let originalStateManager = null;
    let isInstalled = false;

    // Write tracking (no batching — synchronous writes to graph)

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Parse a field ID to extract ref prefix and base ID
     * @param {string} fieldId
     * @returns {{isRef: boolean, baseId: string}}
     */
    function parseFieldId(fieldId) {
      const isRef = fieldId.startsWith("ref_");
      const baseId = isRef ? fieldId.slice(4) : fieldId;
      return { isRef, baseId };
    }

    /**
     * Convert legacy field ID to semantic path
     * @param {string} fieldId - Legacy ID (d_85) or semantic path
     * @returns {string|null}
     */
    function toSemanticPath(fieldId) {
      if (!fieldId) return null;

      // Already a semantic path?
      if (fieldId.includes(".")) {
        return fieldId;
      }

      // Use graph-based translation (don't use registry - causes recursion)
      if (legacyToSemantic.has(fieldId)) {
        return legacyToSemantic.get(fieldId);
      }

      // Return null if not found (will trigger fallback to original StateManager)
      return null;
    }

    /**
     * Convert semantic path to legacy field ID
     * @param {string} semanticPath
     * @returns {string|null}
     */
    function toLegacyId(semanticPath) {
      if (!semanticPath) return null;

      // Already a legacy ID?
      if (!semanticPath.includes(".")) {
        return semanticPath;
      }

      // Use graph-based translation (don't use registry - causes recursion)
      if (semanticToLegacy.has(semanticPath)) {
        return semanticToLegacy.get(semanticPath);
      }

      return null;
    }

    /**
     * Get the reference model ID
     * @returns {string|null}
     */
    function getReferenceModelId() {
      const models = state.getAllModels();
      const refModel = models.find(m => m.modelType === "reference");
      return refModel?.id || null;
    }

    /**
     * Get the target (active) model ID
     * @returns {string|null}
     */
    function getTargetModelId() {
      return state.getActiveModelId();
    }

    /**
     * Write a value directly to MultiModelState (synchronous, no batching).
     * @param {boolean} isRef
     * @param {string} semanticPath
     * @param {*} value
     */
    function writeToGraph(isRef, semanticPath, value) {
      const modelId = isRef ? getReferenceModelId() : getTargetModelId();
      if (modelId) {
        state.setValueForModel(modelId, semanticPath, value);
      }
    }

    // ========================================================================
    // PUBLIC API (StateManager-compatible)
    // ========================================================================

    const adapter = {
      // ======================================================================
      // VALUE ACCESS (StateManager.getValue compatible)
      // ======================================================================

      /**
       * Get value for a field
       * Compatible with StateManager.getValue(fieldId)
       * @param {string} fieldId - Legacy ID (d_85, ref_d_85) or semantic path
       * @returns {*}
       */
      getValue(fieldId) {
        const { isRef, baseId } = parseFieldId(fieldId);

        // For ref_* fields, always read from reference model under the BASE path.
        // The reference.* prefixed path is a target-model concept for compliance inputs.
        // For non-ref fields, read from target model under the direct semantic path.
        let value;
        if (isRef) {
          const basePath = toSemanticPath(baseId);
          if (basePath && basePath.includes(".")) {
            const refModelId = getReferenceModelId();
            if (refModelId) {
              value = state.getValueForModel(refModelId, basePath);
            }
          }
        } else {
          const semanticPath = toSemanticPath(fieldId);
          if (semanticPath && semanticPath.includes(".")) {
            value = state.getValue(semanticPath);
          }
        }

        // Fall back to original StateManager if new system returns undefined/null
        if (value === undefined || value === null) {
          if (originalStateManager?._original_getValue) {
            return originalStateManager._original_getValue.call(originalStateManager, fieldId);
          }
        }

        return value;
      },

      /**
       * Get values for multiple fields
       * @param {string[]} fieldIds
       * @returns {Object}
       */
      getValues(fieldIds) {
        const result = {};
        for (const fieldId of fieldIds) {
          result[fieldId] = this.getValue(fieldId);
        }
        return result;
      },

      // ======================================================================
      // VALUE UPDATES (StateManager.setValue compatible)
      // ======================================================================

      /**
       * Set value for a field
       * Compatible with StateManager.setValue(fieldId, value, state)
       * @param {string} fieldId - Legacy ID or semantic path
       * @param {*} value
       * @param {string} [valueState] - Ignored (legacy parameter)
       */
      setValue(fieldId, value, valueState) {
        const { isRef, baseId } = parseFieldId(fieldId);

        // Look up semantic paths:
        // - refPrefixedPath: ref_f_85 → reference.transmissionLoss.roof.rsi (compliance input path)
        // - basePath: f_85 → transmissionLoss.roof.rsi (base computation path)
        const refPrefixedPath = isRef ? toSemanticPath(fieldId) : null;
        const basePath = toSemanticPath(isRef ? baseId : fieldId);

        if (!refPrefixedPath && !basePath) {
          if (originalStateManager?._original_setValue) {
            return originalStateManager._original_setValue.call(originalStateManager, fieldId, value, valueState);
          }
          console.warn(`[LegacyAdapter] Unknown field: ${fieldId}`);
          return;
        }

        // DUAL-WRITE: Write to MultiModelState (synchronous)
        if (isRef) {
          // ref_* fields need writes to BOTH models:
          // 1. Target model under reference.* path (compliance comparison input)
          if (refPrefixedPath) {
            const targetModelId = getTargetModelId();
            if (targetModelId) {
              state.setValueForModel(targetModelId, refPrefixedPath, value);
            }
          }
          // 2. Reference model under base path (reference-side computation)
          if (basePath) {
            const refModelId = getReferenceModelId();
            if (refModelId) {
              state.setValueForModel(refModelId, basePath, value);
            }
          }
        } else {
          writeToGraph(false, basePath, value);
        }

        // DUAL-WRITE: Also write to original StateManager (for backward compatibility)
        if (originalStateManager?._original_setValue) {
          originalStateManager._original_setValue.call(originalStateManager, fieldId, value, valueState);
        }
      },

      /**
       * Set multiple values at once
       * @param {Object} values - Map of fieldId -> value
       */
      setValues(values) {
        for (const [fieldId, value] of Object.entries(values)) {
          this.setValue(fieldId, value);
        }
      },

      // ======================================================================
      // MODEL ACCESS
      // ======================================================================

      /**
       * Get active model ID
       * @returns {string}
       */
      getActiveModelId() {
        return state.getActiveModelId();
      },

      /**
       * Get reference model ID
       * @returns {string|null}
       */
      getReferenceModelId() {
        return getReferenceModelId();
      },

      /**
       * Check if in reference mode
       * @returns {boolean}
       */
      isReferenceMode() {
        const activeModel = state.getActiveModel();
        return activeModel?.modelType === "reference";
      },

      // ======================================================================
      // FIELD TRANSLATION
      // ======================================================================

      /**
       * Convert legacy ID to semantic path
       * @param {string} legacyId
       * @returns {string|null}
       */
      toSemanticPath,

      /**
       * Convert semantic path to legacy ID
       * @param {string} semanticPath
       * @returns {string|null}
       */
      toLegacyId,

      // ======================================================================
      // INSTALLATION
      // ======================================================================

      /**
       * Install adapter, replacing StateManager methods
       */
      install() {
        if (isInstalled) {
          console.warn("[LegacyAdapter] Already installed");
          return;
        }

        originalStateManager = window.TEUI?.StateManager;

        if (originalStateManager) {
          // Store original methods
          originalStateManager._original_getValue = originalStateManager.getValue;
          originalStateManager._original_setValue = originalStateManager.setValue;

          // Replace with adapter methods
          originalStateManager.getValue = this.getValue.bind(this);
          originalStateManager.setValue = this.setValue.bind(this);

          isInstalled = true;
          console.log("[LegacyAdapter] Installed - StateManager methods replaced");
        } else {
          console.warn("[LegacyAdapter] StateManager not found, creating standalone");
          window.TEUI = window.TEUI || {};
          window.TEUI.StateManager = {
            getValue: this.getValue.bind(this),
            setValue: this.setValue.bind(this)
          };
          isInstalled = true;
        }
      },

      /**
       * Uninstall adapter, restoring original StateManager
       */
      uninstall() {
        if (!isInstalled) {
          console.warn("[LegacyAdapter] Not installed");
          return;
        }

        if (originalStateManager) {
          // Restore original methods
          if (originalStateManager._original_getValue) {
            originalStateManager.getValue = originalStateManager._original_getValue;
            delete originalStateManager._original_getValue;
          }
          if (originalStateManager._original_setValue) {
            originalStateManager.setValue = originalStateManager._original_setValue;
            delete originalStateManager._original_setValue;
          }
        }

        isInstalled = false;
        console.log("[LegacyAdapter] Uninstalled - Original StateManager restored");
      },

      /**
       * Check if adapter is installed
       * @returns {boolean}
       */
      isInstalled() {
        return isInstalled;
      },

      // ======================================================================
      // DEBUGGING
      // ======================================================================

      /**
       * Debug output
       */
      debug() {
        console.group("[LegacyAdapter] Debug");
        console.log("Installed:", isInstalled);
        console.log("Writes: synchronous (no batching)");
        console.log("Target model:", getTargetModelId());
        console.log("Reference model:", getReferenceModelId());
        console.log("State stats:", state.getStats());
        console.groupEnd();
      },

      // ======================================================================
      // DIRECT ACCESS (for advanced usage)
      // ======================================================================

      /**
       * Get direct access to MultiModelState
       * @returns {MultiModelState}
       */
      getState() {
        return state;
      },

      /**
       * Get direct access to MultiModelEngine
       * @returns {MultiModelEngine}
       */
      getEngine() {
        return engine;
      },

      /**
       * Get direct access to FieldRegistry
       * @returns {FieldRegistry}
       */
      getRegistry() {
        return registry;
      },

    };

    return adapter;
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.TEUI.LegacyAdapter = {
    create: createLegacyAdapter
  };

  console.log("[LegacyAdapter] Module loaded");
})();
