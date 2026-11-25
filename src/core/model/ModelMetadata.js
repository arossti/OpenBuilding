/**
 * ModelMetadata.js - Model Identity and Relationship Management
 *
 * Part of the Multi-Model Architecture refactoring (Phase 3, Task 3.1)
 * See: docs/REFACTORING_PLAN.md
 *
 * Manages model identity, types, and relationships between models.
 * Models can be:
 * - target: The primary design being optimized
 * - reference: Building code baseline for comparison
 * - variant: A copy of another model for exploration
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};

  // ============================================================================
  // ID GENERATION
  // ============================================================================

  let nextId = 1;

  /**
   * Generate a unique model ID
   * @returns {string}
   */
  function generateId() {
    return `model-${nextId++}`;
  }

  /**
   * Reset ID counter (for testing)
   */
  function resetIdCounter() {
    nextId = 1;
  }

  // ============================================================================
  // MODEL TYPES
  // ============================================================================

  /**
   * Valid model types
   * @type {readonly string[]}
   */
  const MODEL_TYPES = Object.freeze(["target", "reference", "variant"]);

  /**
   * Check if a model type is valid
   * @param {string} type
   * @returns {boolean}
   */
  function isValidModelType(type) {
    return MODEL_TYPES.includes(type);
  }

  // ============================================================================
  // METADATA CREATION
  // ============================================================================

  /**
   * Create model metadata
   * @param {Object} config
   * @param {string} [config.id] - Optional ID (auto-generated if not provided)
   * @param {string} [config.label] - Human-readable label
   * @param {'target'|'reference'|'variant'} [config.modelType='target']
   * @param {string|null} [config.parentId] - Parent model ID (for variants)
   * @param {string|null} [config.standard] - Building code standard (for references)
   * @param {string|null} [config.description] - Optional description
   * @returns {ModelMetadata}
   */
  function createModelMetadata(config = {}) {
    const modelType = config.modelType || "target";

    if (!isValidModelType(modelType)) {
      throw new Error(`Invalid model type: ${modelType}. Must be one of: ${MODEL_TYPES.join(", ")}`);
    }

    // Variants must have a parent
    if (modelType === "variant" && !config.parentId) {
      throw new Error("Variant models must have a parentId");
    }

    // References should have a standard
    if (modelType === "reference" && !config.standard) {
      console.warn("[ModelMetadata] Reference model created without standard");
    }

    return Object.freeze({
      id: config.id || generateId(),
      label: config.label || "Unnamed Model",
      modelType,
      parentId: config.parentId || null,
      standard: config.standard || null,
      description: config.description || null,
      createdAt: Date.now()
    });
  }

  /**
   * Create a target model (primary design)
   * @param {string} label
   * @param {string} [description]
   * @returns {ModelMetadata}
   */
  function createTargetModel(label, description) {
    return createModelMetadata({
      label,
      modelType: "target",
      description
    });
  }

  /**
   * Create a reference model (building code baseline)
   * @param {string} standard - e.g., 'OBC SB-10', 'OBC SB-12 3.1.1.2.C4'
   * @param {string} [label] - Optional custom label (defaults to standard)
   * @returns {ModelMetadata}
   */
  function createReferenceModel(standard, label) {
    return createModelMetadata({
      label: label || standard,
      modelType: "reference",
      standard,
      description: `Reference model for ${standard}`
    });
  }

  /**
   * Create a variant model (copy for exploration)
   * @param {ModelMetadata} parent - Parent model
   * @param {string} label
   * @param {string} [description]
   * @returns {ModelMetadata}
   */
  function createVariant(parent, label, description) {
    if (!parent || !parent.id) {
      throw new Error("Parent model required for variant");
    }

    return createModelMetadata({
      label,
      modelType: "variant",
      parentId: parent.id,
      description: description || `Variant of ${parent.label}`
    });
  }

  // ============================================================================
  // METADATA UTILITIES
  // ============================================================================

  /**
   * Check if model is a target
   * @param {ModelMetadata} model
   * @returns {boolean}
   */
  function isTarget(model) {
    return model?.modelType === "target";
  }

  /**
   * Check if model is a reference
   * @param {ModelMetadata} model
   * @returns {boolean}
   */
  function isReference(model) {
    return model?.modelType === "reference";
  }

  /**
   * Check if model is a variant
   * @param {ModelMetadata} model
   * @returns {boolean}
   */
  function isVariant(model) {
    return model?.modelType === "variant";
  }

  /**
   * Get display name for a model
   * @param {ModelMetadata} model
   * @returns {string}
   */
  function getDisplayName(model) {
    if (!model) return "Unknown";

    if (model.modelType === "reference" && model.standard) {
      return `[REF] ${model.standard}`;
    }

    if (model.modelType === "variant") {
      return `${model.label} (variant)`;
    }

    return model.label;
  }

  /**
   * Validate model metadata structure
   * @param {*} metadata
   * @returns {string[]} - Array of validation errors (empty if valid)
   */
  function validateMetadata(metadata) {
    const errors = [];

    if (!metadata || typeof metadata !== "object") {
      errors.push("Metadata must be an object");
      return errors;
    }

    if (typeof metadata.id !== "string" || !metadata.id) {
      errors.push("Metadata must have a non-empty string id");
    }

    if (typeof metadata.label !== "string") {
      errors.push("Metadata must have a string label");
    }

    if (!isValidModelType(metadata.modelType)) {
      errors.push(`Invalid modelType: ${metadata.modelType}`);
    }

    if (metadata.modelType === "variant" && !metadata.parentId) {
      errors.push("Variant models must have a parentId");
    }

    return errors;
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.TEUI.ModelMetadata = {
    // Creation
    create: createModelMetadata,
    createTarget: createTargetModel,
    createReference: createReferenceModel,
    createVariant,

    // Type checks
    isTarget,
    isReference,
    isVariant,
    isValidModelType,

    // Utilities
    getDisplayName,
    validate: validateMetadata,

    // Constants
    MODEL_TYPES,

    // Testing
    _resetIdCounter: resetIdCounter
  };

  console.log("[ModelMetadata] Module loaded");
})();
