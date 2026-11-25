/**
 * types.js - Core Type Definitions for Incremental Computation System
 *
 * Part of the Multi-Model Architecture refactoring (Phase 1, Task 1.1)
 * See: docs/REFACTORING_PLAN.md
 *
 * This module defines JSDoc types for the computation graph system that will
 * enable incremental reactive computation - only recalculating affected nodes
 * when values change.
 */
(function () {
  "use strict";

  // Ensure TEUI namespace exists
  window.TEUI = window.TEUI || {};

  // ============================================================================
  // TYPE DEFINITIONS (JSDoc for IDE IntelliSense)
  // ============================================================================

  /**
   * Semantic path to a field (replaces cell references like d_135)
   * @typedef {string} FieldPath
   * @example 'envelope.roof.rsiValue'
   * @example 'energy.heating.load'
   * @example 'climate.location.province'
   */

  /**
   * Unique identifier for a model
   * @typedef {string} ModelId
   * @example 'model-1'
   * @example 'target-v1'
   * @example 'ref-obc-sb12'
   */

  /**
   * Field classification for shared vs model-specific behavior
   * @typedef {'G' | 'C' | 'A'} FieldClassification
   * G = Geometry (shared across related models) - e.g., floor area, volume
   * C = Code/Performance (model-specific) - e.g., RSI values, equipment efficiency
   * A = All other (model-specific) - e.g., labels, metadata
   */

  /**
   * A computation node represents a calculable value in the dependency graph
   * @template T
   * @typedef {Object} ComputationNode
   * @property {FieldPath} id - Unique identifier (semantic path)
   * @property {string} legacyId - Original cell reference (d_135) for migration
   * @property {FieldPath[]} dependencies - What this node needs to compute
   * @property {function(Object<FieldPath, *>): T} compute - Pure computation function
   * @property {FieldClassification} classification - G, C, or A
   * @property {string} [section] - Which section owns this node (S03, S13, etc.)
   * @property {boolean} [converges] - True if needs iterative convergence
   * @property {number} [tolerance] - Convergence tolerance if converges=true
   * @property {number} [maxIterations] - Max iterations for convergence
   * @property {string} [unit] - Unit of measurement (m², kWh, etc.)
   * @property {string} [label] - Human-readable label
   */

  /**
   * Input node (user-editable, not computed)
   * @template T
   * @typedef {Object} InputNode
   * @property {FieldPath} id - Unique identifier (semantic path)
   * @property {string} legacyId - Original cell reference
   * @property {T} defaultValue - Default value
   * @property {FieldClassification} classification - G, C, or A
   * @property {function(T): boolean} [validate] - Validation function
   * @property {string} [section] - Which section owns this node
   * @property {string} [unit] - Unit of measurement
   * @property {string} [label] - Human-readable label
   */

  /**
   * Current values of all nodes
   * @typedef {Map<FieldPath, *>} ComputationState
   */

  /**
   * Multi-model state structure - separates shared (G) fields from model-specific fields
   * @typedef {Object} MultiModelState
   * @property {ComputationState} shared - G-fields shared by all models
   * @property {Map<ModelId, ComputationState>} models - Per-model C-fields + computed values
   */

  /**
   * Computation graph structure
   * @typedef {Object} ComputationGraph
   * @property {Map<FieldPath, ComputationNode>} nodes - All computation nodes
   * @property {Map<FieldPath, InputNode>} inputs - All input nodes
   * @property {Object} edges - Adjacency lists for traversal
   * @property {Map<FieldPath, Set<FieldPath>>} edges.downstream - What depends on each node
   * @property {Map<FieldPath, Set<FieldPath>>} edges.upstream - What each node depends on
   */

  /**
   * Model metadata (not computation values)
   * @typedef {Object} ModelMetadata
   * @property {ModelId} id - Unique identifier
   * @property {string} label - Display name
   * @property {'target' | 'reference' | 'variant'} modelType - Type of model
   * @property {ModelId} [parentId] - Parent model if this is a variant
   * @property {number} createdAt - Creation timestamp
   * @property {string} [standard] - Building code standard (for reference models)
   */

  /**
   * Result of incremental recomputation
   * @typedef {Object} RecomputeResult
   * @property {ComputationState} state - New state after computation
   * @property {FieldPath[]} computed - Which nodes were recomputed
   * @property {number} iterations - Convergence iterations (if any)
   * @property {number} timeMs - Computation time in milliseconds
   */

  /**
   * Field definition for registration (used by FieldRegistry)
   * @typedef {Object} FieldDefinition
   * @property {string} legacyId - Original cell reference (d_135)
   * @property {string} semanticPath - New semantic path
   * @property {FieldClassification} classification - G, C, or A
   * @property {string} section - Section ID (S03, S13, etc.)
   * @property {string} label - Human-readable label
   * @property {string} [unit] - Unit of measurement
   * @property {*} [defaultValue] - Default value
   */

  // ============================================================================
  // RUNTIME TYPE UTILITIES
  // ============================================================================

  /**
   * Runtime type checking and validation utilities
   */
  const ComputationTypes = {
    /**
     * Check if an object is a valid ComputationNode
     * @param {*} obj - Object to check
     * @returns {boolean}
     */
    isComputationNode(obj) {
      return (
        obj &&
        typeof obj === "object" &&
        typeof obj.id === "string" &&
        typeof obj.compute === "function" &&
        Array.isArray(obj.dependencies)
      );
    },

    /**
     * Check if an object is a valid InputNode
     * @param {*} obj - Object to check
     * @returns {boolean}
     */
    isInputNode(obj) {
      return (
        obj &&
        typeof obj === "object" &&
        typeof obj.id === "string" &&
        "defaultValue" in obj &&
        !("compute" in obj)
      );
    },

    /**
     * Check if a classification is valid
     * @param {*} classification - Value to check
     * @returns {boolean}
     */
    isValidClassification(classification) {
      return ["G", "C", "A"].includes(classification);
    },

    /**
     * Check if a model type is valid
     * @param {*} modelType - Value to check
     * @returns {boolean}
     */
    isValidModelType(modelType) {
      return ["target", "reference", "variant"].includes(modelType);
    },

    /**
     * Validate a ComputationNode and return errors
     * @param {*} node - Node to validate
     * @returns {string[]} Array of error messages (empty if valid)
     */
    validateComputationNode(node) {
      const errors = [];

      if (!node || typeof node !== "object") {
        errors.push("Node must be an object");
        return errors;
      }

      if (typeof node.id !== "string" || !node.id) {
        errors.push("Node must have a non-empty string id");
      }

      if (typeof node.compute !== "function") {
        errors.push("Node must have a compute function");
      }

      if (!Array.isArray(node.dependencies)) {
        errors.push("Node must have a dependencies array");
      }

      if (node.classification && !this.isValidClassification(node.classification)) {
        errors.push(`Invalid classification: ${node.classification}`);
      }

      if (node.converges) {
        if (typeof node.tolerance !== "number" || node.tolerance <= 0) {
          errors.push("Convergent nodes must have a positive tolerance");
        }
        if (typeof node.maxIterations !== "number" || node.maxIterations < 1) {
          errors.push("Convergent nodes must have maxIterations >= 1");
        }
      }

      return errors;
    },

    /**
     * Validate an InputNode and return errors
     * @param {*} node - Node to validate
     * @returns {string[]} Array of error messages (empty if valid)
     */
    validateInputNode(node) {
      const errors = [];

      if (!node || typeof node !== "object") {
        errors.push("Input node must be an object");
        return errors;
      }

      if (typeof node.id !== "string" || !node.id) {
        errors.push("Input node must have a non-empty string id");
      }

      if (!("defaultValue" in node)) {
        errors.push("Input node must have a defaultValue");
      }

      if (node.classification && !this.isValidClassification(node.classification)) {
        errors.push(`Invalid classification: ${node.classification}`);
      }

      if (node.validate && typeof node.validate !== "function") {
        errors.push("validate must be a function if provided");
      }

      return errors;
    },

    /**
     * Create a semantic path from components
     * @param {...string} parts - Path components
     * @returns {FieldPath}
     * @example createPath('envelope', 'roof', 'rsiValue') => 'envelope.roof.rsiValue'
     */
    createPath(...parts) {
      return parts.filter(Boolean).join(".");
    },

    /**
     * Parse a semantic path into components
     * @param {FieldPath} path - Semantic path
     * @returns {string[]}
     * @example parsePath('envelope.roof.rsiValue') => ['envelope', 'roof', 'rsiValue']
     */
    parsePath(path) {
      return path.split(".");
    },

    /**
     * Get the section from a semantic path
     * @param {FieldPath} path - Semantic path
     * @returns {string} First component of the path
     * @example getSection('envelope.roof.rsiValue') => 'envelope'
     */
    getSection(path) {
      return this.parsePath(path)[0];
    },

    /**
     * Check if a path matches a pattern (supports wildcards)
     * @param {FieldPath} path - Path to check
     * @param {string} pattern - Pattern with optional * wildcards
     * @returns {boolean}
     * @example matchesPattern('envelope.roof.rsiValue', 'envelope.*') => true
     */
    matchesPattern(path, pattern) {
      const regex = new RegExp(
        "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]+") + "$"
      );
      return regex.test(path);
    }
  };

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.TEUI.ComputationTypes = ComputationTypes;

  // Log initialization
  console.log("[ComputationTypes] Type definitions loaded");
})();
