/**
 * MultiModelState.js - Multi-Model State Management
 *
 * Part of the Multi-Model Architecture refactoring (Phase 3, Task 3.2)
 * See: docs/REFACTORING_PLAN.md
 *
 * Manages state for multiple building models with G/C field separation:
 * - G-fields (Geometry): Shared across all related models
 * - C-fields (Code/Performance): Model-specific values
 * - A-fields (All other): Model-specific values
 *
 * When a G-field changes, all models are affected.
 * When a C/A-field changes, only the specific model is affected.
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};

  // ============================================================================
  // MULTI-MODEL STATE FACTORY
  // ============================================================================

  /**
   * Create a multi-model state manager
   * @param {Object} [options]
   * @param {Object} [options.registry] - FieldRegistry for classification lookup
   * @returns {MultiModelStateManager}
   */
  function createMultiModelState(options = {}) {
    const registry = options.registry || window.TEUI.FieldRegistry;

    // Shared state (G-fields) - same across all models
    let sharedState = new Map();

    // Per-model states (C/A-fields + computed values)
    const modelStates = new Map();

    // Model metadata
    const models = new Map();

    // Active model for UI interactions
    let activeModelId = null;

    // Change listeners
    const listeners = new Set();

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /** @type {Map<string, 'G'|'C'|'A'>} Cache for field classification results */
    const classificationCache = new Map();

    /**
     * Get field classification (G, C, or A)
     * Uses pattern matching to avoid circular dependency with FieldRegistry.
     * Results are cached — the classification rules are static.
     * @param {string} fieldPath
     * @returns {'G'|'C'|'A'}
     */
    function getClassification(fieldPath) {
      const cached = classificationCache.get(fieldPath);
      if (cached) return cached;

      let result;

      // G-fields: Geometry and location data (shared across models)
      // Climate data is geographic - shared between Target and Reference models
      if (
        fieldPath.startsWith("geometry.") ||
        fieldPath.startsWith("climate.location.") ||
        fieldPath.startsWith("climate.heating.") ||
        fieldPath.startsWith("climate.cooling.") ||
        fieldPath === "climate.timeframe" ||
        fieldPath === "climate.coolingDays"
      ) {
        result = "G";
      }
      // C-fields: Code/performance values (model-specific)
      // Most envelope, mechanical, and energy fields are C
      else if (
        fieldPath.startsWith("envelope.") ||
        fieldPath.startsWith("mechanical.") ||
        fieldPath.startsWith("energy.") ||
        fieldPath.startsWith("internal.")
      ) {
        result = "C";
      } else {
        // Default: A-fields (model-specific metadata)
        result = "A";
      }

      classificationCache.set(fieldPath, result);
      return result;
    }

    /**
     * Check if field is shared (G-field)
     * @param {string} fieldPath
     * @returns {boolean}
     */
    function isSharedField(fieldPath) {
      return getClassification(fieldPath) === "G";
    }

    /**
     * Notify listeners of state changes
     * @param {Object} event
     */
    function notifyListeners(event) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (e) {
          console.error("[MultiModelState] Listener error:", e);
        }
      }
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    return {
      // ======================================================================
      // MODEL MANAGEMENT
      // ======================================================================

      /**
       * Add a new model
       * @param {ModelMetadata} metadata
       * @param {Map|Object} [initialState] - Optional initial C/A-field values
       */
      addModel(metadata, initialState = new Map()) {
        if (!metadata || !metadata.id) {
          throw new Error("Model metadata with id required");
        }

        if (models.has(metadata.id)) {
          throw new Error(`Model ${metadata.id} already exists`);
        }

        models.set(metadata.id, metadata);

        // Convert object to Map if needed
        const stateMap = initialState instanceof Map
          ? new Map(initialState)
          : new Map(Object.entries(initialState));

        modelStates.set(metadata.id, stateMap);

        // First model becomes active by default
        if (!activeModelId) {
          activeModelId = metadata.id;
        }

        notifyListeners({
          type: "modelAdded",
          modelId: metadata.id,
          metadata
        });

        console.log(`[MultiModelState] Added model: ${metadata.label} (${metadata.id})`);
      },

      /**
       * Remove a model
       * @param {string} modelId
       */
      removeModel(modelId) {
        if (!models.has(modelId)) {
          console.warn(`[MultiModelState] Model ${modelId} not found`);
          return;
        }

        const metadata = models.get(modelId);
        models.delete(modelId);
        modelStates.delete(modelId);

        // Switch active model if needed
        if (activeModelId === modelId) {
          activeModelId = models.keys().next().value || null;
        }

        notifyListeners({
          type: "modelRemoved",
          modelId,
          metadata
        });

        console.log(`[MultiModelState] Removed model: ${modelId}`);
      },

      /**
       * Get model metadata
       * @param {string} modelId
       * @returns {ModelMetadata|undefined}
       */
      getModel(modelId) {
        return models.get(modelId);
      },

      /**
       * Get all models
       * @returns {ModelMetadata[]}
       */
      getAllModels() {
        return Array.from(models.values());
      },

      /**
       * Get model IDs
       * @returns {string[]}
       */
      getModelIds() {
        return Array.from(models.keys());
      },

      /**
       * Get model count
       * @returns {number}
       */
      getModelCount() {
        return models.size;
      },

      /**
       * Check if model exists
       * @param {string} modelId
       * @returns {boolean}
       */
      hasModel(modelId) {
        return models.has(modelId);
      },

      // ======================================================================
      // ACTIVE MODEL
      // ======================================================================

      /**
       * Set active model
       * @param {string} modelId
       */
      setActiveModel(modelId) {
        if (!models.has(modelId)) {
          throw new Error(`Model ${modelId} not found`);
        }

        const previousId = activeModelId;
        activeModelId = modelId;

        notifyListeners({
          type: "activeModelChanged",
          previousModelId: previousId,
          modelId
        });
      },

      /**
       * Get active model ID
       * @returns {string|null}
       */
      getActiveModelId() {
        return activeModelId;
      },

      /**
       * Get active model metadata
       * @returns {ModelMetadata|undefined}
       */
      getActiveModel() {
        return activeModelId ? models.get(activeModelId) : undefined;
      },

      // ======================================================================
      // VALUE ACCESS
      // ======================================================================

      /**
       * Get value for a field (from active model)
       * @param {string} fieldPath
       * @returns {*}
       */
      getValue(fieldPath) {
        return this.getValueForModel(activeModelId, fieldPath);
      },

      /**
       * Get value for a specific model
       * @param {string} modelId
       * @param {string} fieldPath
       * @returns {*}
       */
      getValueForModel(modelId, fieldPath) {
        // Check model-specific state first — allows per-model G-field overrides
        // (e.g., Reference city stays "Alexandria" while Target city changes)
        const modelState = modelStates.get(modelId);
        const modelValue = modelState?.get(fieldPath);
        if (modelValue !== undefined) {
          return modelValue;
        }

        // Fall back to shared state for G-fields (initial defaults before
        // populateReferenceModel writes per-model copies)
        if (isSharedField(fieldPath)) {
          return sharedState.get(fieldPath);
        }

        return undefined;
      },

      /**
       * Get shared state value (G-field)
       * @param {string} fieldPath
       * @returns {*}
       */
      getSharedValue(fieldPath) {
        return sharedState.get(fieldPath);
      },

      /**
       * Get complete state for a model (merged shared + model-specific)
       * @param {string} modelId
       * @returns {Map}
       */
      getFullStateForModel(modelId) {
        const merged = new Map(sharedState);
        const modelState = modelStates.get(modelId);

        if (modelState) {
          for (const [key, value] of modelState) {
            merged.set(key, value);
          }
        }

        return merged;
      },

      /**
       * Get only model-specific state (C/A-fields)
       * @param {string} modelId
       * @returns {Map}
       */
      getModelSpecificState(modelId) {
        return modelStates.get(modelId) || new Map();
      },

      /**
       * Get shared state (G-fields)
       * @returns {Map}
       */
      getSharedState() {
        return new Map(sharedState);
      },

      // ======================================================================
      // VALUE UPDATES
      // ======================================================================

      /**
       * Set value for a field (on active model)
       * @param {string} fieldPath
       * @param {*} value
       * @returns {string[]} - List of affected model IDs
       */
      setValue(fieldPath, value) {
        return this.setValueForModel(activeModelId, fieldPath, value);
      },

      /**
       * Set value for a specific model
       * @param {string} modelId
       * @param {string} fieldPath
       * @param {*} value
       * @returns {string[]} - List of affected model IDs
       */
      setValueForModel(modelId, fieldPath, value) {
        const previousValue = this.getValueForModel(modelId, fieldPath);

        // Always write to model-specific state for per-model independence
        // (e.g., Target city can differ from Reference city)
        const modelState = modelStates.get(modelId);
        if (modelState) {
          modelState.set(fieldPath, value);
        }

        // Also update shared state for G-fields (backward compat: export, comparison)
        if (isSharedField(fieldPath)) {
          sharedState.set(fieldPath, value);
        }

        const affectedModels = [modelId];

        notifyListeners({
          type: "valueChanged",
          fieldPath,
          value,
          previousValue,
          modelId,
          affectedModels,
          isShared: isSharedField(fieldPath)
        });

        return affectedModels;
      },

      /**
       * Set multiple values at once
       * @param {Object|Map} changes - Map or object of fieldPath -> value
       * @returns {Set<string>} - Set of affected model IDs
       */
      setValues(changes) {
        const affected = new Set();
        const entries = changes instanceof Map
          ? changes.entries()
          : Object.entries(changes);

        for (const [fieldPath, value] of entries) {
          const modelIds = this.setValue(fieldPath, value);
          modelIds.forEach(id => affected.add(id));
        }

        return affected;
      },

      /**
       * Set shared value directly (G-field)
       * @param {string} fieldPath
       * @param {*} value
       * @returns {string[]} - All model IDs (all affected)
       */
      setSharedValue(fieldPath, value) {
        sharedState.set(fieldPath, value);
        const affectedModels = Array.from(models.keys());

        notifyListeners({
          type: "valueChanged",
          fieldPath,
          value,
          affectedModels,
          isShared: true
        });

        return affectedModels;
      },

      /**
       * Set value for a specific model without notification or previous-value lookup.
       * Used during bulk computation passes where listeners would cause overhead.
       * @param {string} modelId
       * @param {string} fieldPath
       * @param {*} value
       */
      setValueForModelDirect(modelId, fieldPath, value) {
        // Always write to model-specific state for per-model independence
        const modelState = modelStates.get(modelId);
        if (modelState) {
          modelState.set(fieldPath, value);
        }
        // Also update shared state for G-fields (backward compat)
        if (isSharedField(fieldPath)) {
          sharedState.set(fieldPath, value);
        }
      },

      // ======================================================================
      // BATCH OPERATIONS
      // ======================================================================

      /**
       * Initialize model state from an object
       * @param {string} modelId
       * @param {Object|Map} state
       */
      initializeModelState(modelId, state) {
        if (!models.has(modelId)) {
          throw new Error(`Model ${modelId} not found`);
        }

        const entries = state instanceof Map
          ? Array.from(state.entries())
          : Object.entries(state);

        for (const [fieldPath, value] of entries) {
          // Always write to model-specific state for per-model independence
          modelStates.get(modelId).set(fieldPath, value);
          // Also update shared state for G-fields (backward compat)
          if (isSharedField(fieldPath)) {
            sharedState.set(fieldPath, value);
          }
        }
      },

      /**
       * Clear all state for a model (keeps metadata)
       * @param {string} modelId
       */
      clearModelState(modelId) {
        if (modelStates.has(modelId)) {
          modelStates.set(modelId, new Map());
        }
      },

      /**
       * Clear shared state
       */
      clearSharedState() {
        sharedState = new Map();
      },

      // ======================================================================
      // CHANGE LISTENERS
      // ======================================================================

      /**
       * Add a change listener
       * @param {Function} listener - Called with event object
       * @returns {Function} - Unsubscribe function
       */
      addListener(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },

      /**
       * Remove a change listener
       * @param {Function} listener
       */
      removeListener(listener) {
        listeners.delete(listener);
      },

      // ======================================================================
      // SERIALIZATION
      // ======================================================================

      /**
       * Export full state for persistence
       * @returns {Object}
       */
      exportState() {
        const modelsExport = {};
        for (const [id, state] of modelStates) {
          modelsExport[id] = Object.fromEntries(state);
        }

        return {
          shared: Object.fromEntries(sharedState),
          models: modelsExport,
          metadata: Object.fromEntries(
            Array.from(models).map(([id, meta]) => [id, { ...meta }])
          ),
          activeModelId
        };
      },

      /**
       * Import state from persistence
       * @param {Object} exported
       */
      importState(exported) {
        // Clear existing state
        sharedState = new Map(Object.entries(exported.shared || {}));
        models.clear();
        modelStates.clear();

        // Import metadata
        for (const [id, meta] of Object.entries(exported.metadata || {})) {
          models.set(id, Object.freeze(meta));
        }

        // Import model states
        for (const [id, state] of Object.entries(exported.models || {})) {
          modelStates.set(id, new Map(Object.entries(state)));
        }

        // Set active model
        activeModelId = exported.activeModelId || models.keys().next().value || null;

        notifyListeners({
          type: "stateImported"
        });
      },

      // ======================================================================
      // UTILITIES
      // ======================================================================

      /**
       * Check if a field is shared (G-field)
       * @param {string} fieldPath
       * @returns {boolean}
       */
      isSharedField,

      /**
       * Get field classification
       * @param {string} fieldPath
       * @returns {'G'|'C'|'A'}
       */
      getClassification,

      /**
       * Get statistics
       * @returns {Object}
       */
      getStats() {
        let totalModelFields = 0;
        for (const state of modelStates.values()) {
          totalModelFields += state.size;
        }

        return {
          modelCount: models.size,
          sharedFieldCount: sharedState.size,
          totalModelFields,
          activeModelId
        };
      },

      /**
       * Debug output
       */
      debug() {
        console.group("[MultiModelState] Debug");
        console.log("Active Model:", activeModelId);
        console.log("Models:", Array.from(models.values()));
        console.log("Shared State:", Object.fromEntries(sharedState));
        console.log("Model States:");
        for (const [id, state] of modelStates) {
          console.log(`  ${id}:`, Object.fromEntries(state));
        }
        console.groupEnd();
      }
    };
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.TEUI.MultiModelState = {
    create: createMultiModelState
  };

  console.log("[MultiModelState] Module loaded");
})();
