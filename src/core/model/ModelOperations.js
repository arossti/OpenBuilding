/**
 * ModelOperations.js - High-Level Model Operations
 *
 * Part of the Multi-Model Architecture refactoring (Phase 3, Task 3.4)
 * See: docs/REFACTORING_PLAN.md
 *
 * Provides high-level operations for working with models:
 * - Create new models (target, reference, variant)
 * - Clone models with state
 * - Compare models
 * - Model lifecycle management
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};

  // ============================================================================
  // MODEL OPERATIONS FACTORY
  // ============================================================================

  /**
   * Create model operations helper
   * @param {Object} options
   * @param {Object} options.state - MultiModelState instance
   * @param {Object} options.engine - MultiModelEngine instance
   * @param {Object} [options.registry] - FieldRegistry instance
   * @returns {ModelOperations}
   */
  function createModelOperations(options = {}) {
    const state = options.state;
    const engine = options.engine;
    const registry = options.registry || window.TEUI.FieldRegistry;
    const ModelMetadata = window.TEUI.ModelMetadata;

    if (!state) {
      throw new Error("MultiModelState required");
    }

    if (!engine) {
      throw new Error("MultiModelEngine required");
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    return {
      // ======================================================================
      // MODEL CREATION
      // ======================================================================

      /**
       * Create a new target model
       * @param {string} label - Model name
       * @param {Object|Map} [initialValues] - Initial field values
       * @returns {ModelMetadata}
       */
      createTarget(label, initialValues = {}) {
        const metadata = ModelMetadata.createTarget(label);
        state.addModel(metadata, initialValues);

        // Compute all nodes for the new model
        engine.computeAllForModel(metadata.id);

        console.log(`[ModelOperations] Created target model: ${label}`);
        return metadata;
      },

      /**
       * Create a new reference model (building code baseline)
       * @param {string} standard - Building code standard (e.g., 'OBC SB-10')
       * @param {Object|Map} [codeValues] - Code-minimum values
       * @returns {ModelMetadata}
       */
      createReference(standard, codeValues = {}) {
        const metadata = ModelMetadata.createReference(standard);
        state.addModel(metadata, codeValues);

        // Compute all nodes for the new model
        engine.computeAllForModel(metadata.id);

        console.log(`[ModelOperations] Created reference model: ${standard}`);
        return metadata;
      },

      /**
       * Create a variant (copy) of an existing model
       * @param {string} sourceModelId - Model to copy
       * @param {string} label - Name for the variant
       * @returns {ModelMetadata}
       */
      createVariant(sourceModelId, label) {
        const sourceModel = state.getModel(sourceModelId);
        if (!sourceModel) {
          throw new Error(`Source model ${sourceModelId} not found`);
        }

        // Create variant metadata
        const metadata = ModelMetadata.createVariant(sourceModel, label);

        // Copy model-specific state from source
        const sourceState = state.getModelSpecificState(sourceModelId);
        state.addModel(metadata, sourceState);

        console.log(`[ModelOperations] Created variant "${label}" from "${sourceModel.label}"`);
        return metadata;
      },

      // ======================================================================
      // MODEL CLONING
      // ======================================================================

      /**
       * Clone a model with all its state
       * @param {string} sourceModelId - Model to clone
       * @param {string} newLabel - Name for the clone
       * @param {Object} [options]
       * @param {boolean} [options.asVariant=true] - Create as variant (tracks parent)
       * @returns {ModelMetadata}
       */
      cloneModel(sourceModelId, newLabel, options = {}) {
        const { asVariant = true } = options;

        if (asVariant) {
          return this.createVariant(sourceModelId, newLabel);
        }

        // Create as independent target
        const sourceState = state.getModelSpecificState(sourceModelId);
        return this.createTarget(newLabel, sourceState);
      },

      /**
       * Clone a model and apply modifications
       * @param {string} sourceModelId - Model to clone
       * @param {string} newLabel - Name for the clone
       * @param {Object|Map} modifications - Values to change
       * @returns {ModelMetadata}
       */
      cloneWithModifications(sourceModelId, newLabel, modifications) {
        const metadata = this.createVariant(sourceModelId, newLabel);

        // Apply modifications
        engine.onBatchChange(modifications, metadata.id);

        return metadata;
      },

      // ======================================================================
      // MODEL COMPARISON
      // ======================================================================

      /**
       * Compare two models
       * @param {string} modelId1
       * @param {string} modelId2
       * @param {Object} [options]
       * @param {string[]} [options.fields] - Specific fields to compare
       * @param {boolean} [options.includeComputed=true] - Include computed values
       * @returns {Object} - Comparison result
       */
      compareModels(modelId1, modelId2, options = {}) {
        const { fields, includeComputed = true } = options;

        const model1 = state.getModel(modelId1);
        const model2 = state.getModel(modelId2);

        if (!model1 || !model2) {
          throw new Error("Both models must exist");
        }

        // Use engine's compare function
        const comparison = engine.compareModels(modelId1, modelId2, fields);

        // Add metadata
        return {
          ...comparison,
          model1Label: model1.label,
          model2Label: model2.label,
          model1Type: model1.modelType,
          model2Type: model2.modelType
        };
      },

      /**
       * Compare a target model against its reference
       * @param {string} targetModelId
       * @param {string} referenceModelId
       * @returns {Object} - Comparison with compliance info
       */
      compareTargetToReference(targetModelId, referenceModelId) {
        const comparison = this.compareModels(targetModelId, referenceModelId);

        // Add compliance analysis for key metrics
        const keyMetrics = [
          "energy.teui",
          "energy.tedi",
          "energy.teli"
        ];

        const compliance = {};
        for (const metric of keyMetrics) {
          const targetVal = state.getValueForModel(targetModelId, metric);
          const refVal = state.getValueForModel(referenceModelId, metric);

          if (typeof targetVal === "number" && typeof refVal === "number" && refVal > 0) {
            compliance[metric] = {
              target: targetVal,
              reference: refVal,
              difference: targetVal - refVal,
              percentDiff: ((targetVal - refVal) / refVal * 100).toFixed(1),
              passes: targetVal <= refVal
            };
          }
        }

        return {
          ...comparison,
          compliance
        };
      },

      /**
       * Get summary of differences between models
       * @param {string} modelId1
       * @param {string} modelId2
       * @returns {Object} - Summary of differences
       */
      getDifferenceSummary(modelId1, modelId2) {
        const comparison = this.compareModels(modelId1, modelId2);

        // Categorize differences by section
        const bySection = {};
        for (const diff of comparison.differences) {
          const section = diff.fieldPath.split(".")[0];
          if (!bySection[section]) {
            bySection[section] = [];
          }
          bySection[section].push(diff);
        }

        // Find significant numeric differences
        const significantDiffs = comparison.differences.filter(diff => {
          if (typeof diff.model1 === "number" && typeof diff.model2 === "number") {
            const avg = (Math.abs(diff.model1) + Math.abs(diff.model2)) / 2;
            if (avg > 0) {
              const pctDiff = Math.abs(diff.model1 - diff.model2) / avg * 100;
              return pctDiff > 5; // More than 5% difference
            }
          }
          return diff.model1 !== diff.model2;
        });

        return {
          totalDifferences: comparison.diffCount,
          totalSame: comparison.sameCount,
          bySection,
          significantDifferences: significantDiffs
        };
      },

      // ======================================================================
      // MODEL LIFECYCLE
      // ======================================================================

      /**
       * Delete a model
       * @param {string} modelId
       */
      deleteModel(modelId) {
        const model = state.getModel(modelId);
        if (!model) {
          console.warn(`[ModelOperations] Model ${modelId} not found`);
          return;
        }

        // Check for variants that depend on this model
        const variants = state.getAllModels().filter(m =>
          m.parentId === modelId
        );

        if (variants.length > 0) {
          console.warn(`[ModelOperations] Model has ${variants.length} variants that will become orphaned`);
        }

        state.removeModel(modelId);
        console.log(`[ModelOperations] Deleted model: ${model.label}`);
      },

      /**
       * Rename a model
       * @param {string} modelId
       * @param {string} newLabel
       */
      renameModel(modelId, newLabel) {
        const model = state.getModel(modelId);
        if (!model) {
          throw new Error(`Model ${modelId} not found`);
        }

        // Create new metadata with updated label (immutable update)
        const updatedMetadata = Object.freeze({
          ...model,
          label: newLabel
        });

        // Re-add model (this is a workaround since metadata is frozen)
        const modelState = state.getModelSpecificState(modelId);
        state.removeModel(modelId);
        state.addModel(updatedMetadata, modelState);

        console.log(`[ModelOperations] Renamed model to: ${newLabel}`);
      },

      // ======================================================================
      // MODEL QUERIES
      // ======================================================================

      /**
       * Get all target models
       * @returns {ModelMetadata[]}
       */
      getTargets() {
        return state.getAllModels().filter(m => ModelMetadata.isTarget(m));
      },

      /**
       * Get all reference models
       * @returns {ModelMetadata[]}
       */
      getReferences() {
        return state.getAllModels().filter(m => ModelMetadata.isReference(m));
      },

      /**
       * Get all variants of a model
       * @param {string} parentModelId
       * @returns {ModelMetadata[]}
       */
      getVariants(parentModelId) {
        return state.getAllModels().filter(m => m.parentId === parentModelId);
      },

      /**
       * Get model lineage (parent chain)
       * @param {string} modelId
       * @returns {ModelMetadata[]}
       */
      getLineage(modelId) {
        const lineage = [];
        let current = state.getModel(modelId);

        while (current) {
          lineage.push(current);
          current = current.parentId ? state.getModel(current.parentId) : null;
        }

        return lineage;
      },

      // ======================================================================
      // BATCH OPERATIONS
      // ======================================================================

      /**
       * Apply same change to multiple models
       * @param {string[]} modelIds
       * @param {string} fieldPath
       * @param {*} value
       */
      applyToMultiple(modelIds, fieldPath, value) {
        for (const modelId of modelIds) {
          engine.onValueChange(fieldPath, value, modelId);
        }
      },

      /**
       * Reset a model to its parent's values
       * @param {string} modelId
       */
      resetToParent(modelId) {
        const model = state.getModel(modelId);
        if (!model || !model.parentId) {
          throw new Error("Model has no parent to reset to");
        }

        const parentState = state.getModelSpecificState(model.parentId);
        state.initializeModelState(modelId, parentState);

        // Recompute all nodes
        engine.computeAllForModel(modelId);

        console.log(`[ModelOperations] Reset ${model.label} to parent values`);
      },

      // ======================================================================
      // UTILITIES
      // ======================================================================

      /**
       * Get display name for a model
       * @param {string} modelId
       * @returns {string}
       */
      getDisplayName(modelId) {
        const model = state.getModel(modelId);
        return model ? ModelMetadata.getDisplayName(model) : "Unknown";
      },

      /**
       * Export model for sharing
       * @param {string} modelId
       * @returns {Object}
       */
      exportModel(modelId) {
        const model = state.getModel(modelId);
        if (!model) {
          throw new Error(`Model ${modelId} not found`);
        }

        return {
          metadata: { ...model },
          sharedState: Object.fromEntries(state.getSharedState()),
          modelState: Object.fromEntries(state.getModelSpecificState(modelId)),
          exportedAt: Date.now()
        };
      },

      /**
       * Import a model from export
       * @param {Object} exported
       * @param {string} [newLabel] - Optional new label
       * @returns {ModelMetadata}
       */
      importModel(exported, newLabel) {
        // Create new metadata (new ID, optionally new label)
        const metadata = ModelMetadata.create({
          label: newLabel || exported.metadata.label,
          modelType: exported.metadata.modelType,
          standard: exported.metadata.standard,
          description: `Imported from ${exported.metadata.label}`
        });

        // Add model with state
        state.addModel(metadata, exported.modelState);

        // Apply shared state if needed
        for (const [key, value] of Object.entries(exported.sharedState)) {
          if (state.isSharedField(key)) {
            state.setSharedValue(key, value);
          }
        }

        // Recompute
        engine.computeAllForModel(metadata.id);

        console.log(`[ModelOperations] Imported model: ${metadata.label}`);
        return metadata;
      }
    };
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.TEUI.ModelOperations = {
    create: createModelOperations
  };

  console.log("[ModelOperations] Module loaded");
})();
