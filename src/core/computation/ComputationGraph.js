/**
 * ComputationGraph.js - Dependency Graph for Incremental Computation
 *
 * Part of the Multi-Model Architecture refactoring (Phase 1, Task 1.2)
 * See: docs/REFACTORING_PLAN.md
 *
 * This module manages the dependency graph for incremental computation.
 * Key operations:
 * - getDownstream(nodeId): Find all nodes affected by a change
 * - getUpstream(nodeId): Find all dependencies of a node
 * - topologicalSort(nodeIds): Order nodes for safe computation
 *
 * Leverages patterns from existing StateManager.js dependency tracking.
 */
(function () {
  "use strict";

  // Ensure TEUI namespace exists
  window.TEUI = window.TEUI || {};

  /**
   * Create a new computation graph
   * @returns {ComputationGraph}
   */
  function createComputationGraph() {
    /** @type {Map<string, ComputationNode>} */
    const nodes = new Map();

    /** @type {Map<string, InputNode>} */
    const inputs = new Map();

    /** @type {Map<string, Set<string>>} What depends on this node */
    const downstream = new Map();

    /** @type {Map<string, Set<string>>} What this node depends on */
    const upstream = new Map();

    /** @type {string[]|null} Cached full computation order (invalidated on graph mutation) */
    let _cachedComputeOrder = null;

    return {
      // ========================================================================
      // REGISTRATION
      // ========================================================================

      /**
       * Register a computation node
       * @param {ComputationNode} node
       * @throws {Error} If node validation fails
       */
      registerNode(node) {
        // Validate using ComputationTypes if available
        if (window.TEUI.ComputationTypes) {
          const errors = window.TEUI.ComputationTypes.validateComputationNode(node);
          if (errors.length > 0) {
            throw new Error(`Invalid ComputationNode: ${errors.join(", ")}`);
          }
        }

        if (nodes.has(node.id)) {
          console.warn(`[ComputationGraph] Replacing existing node: ${node.id}`);
        }

        nodes.set(node.id, node);
        _cachedComputeOrder = null;

        // Initialize edge sets if not present
        if (!downstream.has(node.id)) {
          downstream.set(node.id, new Set());
        }
        if (!upstream.has(node.id)) {
          upstream.set(node.id, new Set());
        }

        // Build edges from dependencies
        upstream.set(node.id, new Set(node.dependencies));

        // Build reverse edges (downstream)
        for (const dep of node.dependencies) {
          if (!downstream.has(dep)) {
            downstream.set(dep, new Set());
          }
          downstream.get(dep).add(node.id);
        }
      },

      /**
       * Register an input node (user-editable, not computed)
       * @param {InputNode} input
       * @throws {Error} If input validation fails
       */
      registerInput(input) {
        // Validate using ComputationTypes if available
        if (window.TEUI.ComputationTypes) {
          const errors = window.TEUI.ComputationTypes.validateInputNode(input);
          if (errors.length > 0) {
            throw new Error(`Invalid InputNode: ${errors.join(", ")}`);
          }
        }

        inputs.set(input.id, input);

        // Initialize downstream set (inputs can have dependents)
        if (!downstream.has(input.id)) {
          downstream.set(input.id, new Set());
        }
      },

      /**
       * Register multiple computation nodes at once
       * @param {ComputationNode[]} nodeArray
       */
      registerNodes(nodeArray) {
        for (const node of nodeArray) {
          this.registerNode(node);
        }
      },

      /**
       * Register multiple input nodes at once
       * @param {InputNode[]} inputArray
       */
      registerInputs(inputArray) {
        for (const input of inputArray) {
          this.registerInput(input);
        }
      },

      /**
       * Remove a node from the graph
       * @param {string} nodeId
       */
      removeNode(nodeId) {
        // Remove from nodes or inputs
        nodes.delete(nodeId);
        inputs.delete(nodeId);
        _cachedComputeOrder = null;

        // Remove from all edge sets
        if (upstream.has(nodeId)) {
          // Remove this node from downstream sets of its dependencies
          for (const dep of upstream.get(nodeId)) {
            if (downstream.has(dep)) {
              downstream.get(dep).delete(nodeId);
            }
          }
          upstream.delete(nodeId);
        }

        if (downstream.has(nodeId)) {
          // Remove this node from upstream sets of its dependents
          for (const dependent of downstream.get(nodeId)) {
            if (upstream.has(dependent)) {
              upstream.get(dependent).delete(nodeId);
            }
          }
          downstream.delete(nodeId);
        }
      },

      // ========================================================================
      // QUERIES
      // ========================================================================

      /**
       * Get a computation node by ID
       * @param {string} nodeId
       * @returns {ComputationNode | undefined}
       */
      getNode(nodeId) {
        return nodes.get(nodeId);
      },

      /**
       * Get an input node by ID
       * @param {string} inputId
       * @returns {InputNode | undefined}
       */
      getInput(inputId) {
        return inputs.get(inputId);
      },

      /**
       * Check if a node exists (either computation or input)
       * @param {string} nodeId
       * @returns {boolean}
       */
      hasNode(nodeId) {
        return nodes.has(nodeId) || inputs.has(nodeId);
      },

      /**
       * Check if a node is a computation node
       * @param {string} nodeId
       * @returns {boolean}
       */
      isComputationNode(nodeId) {
        return nodes.has(nodeId);
      },

      /**
       * Check if a node is an input node
       * @param {string} nodeId
       * @returns {boolean}
       */
      isInputNode(nodeId) {
        return inputs.has(nodeId);
      },

      /**
       * Get all computation node IDs
       * @returns {string[]}
       */
      getAllNodeIds() {
        return [...nodes.keys()];
      },

      /**
       * Get all input node IDs
       * @returns {string[]}
       */
      getAllInputIds() {
        return [...inputs.keys()];
      },

      /**
       * Get all node IDs (both computation and input)
       * @returns {string[]}
       */
      getAllIds() {
        return [...nodes.keys(), ...inputs.keys()];
      },

      /**
       * Get nodes by section
       * @param {string} sectionId - Section ID (S03, S13, etc.)
       * @returns {ComputationNode[]}
       */
      getNodesBySection(sectionId) {
        return [...nodes.values()].filter((n) => n.section === sectionId);
      },

      /**
       * Get nodes by classification
       * @param {'G' | 'C' | 'A'} classification
       * @returns {ComputationNode[]}
       */
      getNodesByClassification(classification) {
        return [...nodes.values()].filter(
          (n) => n.classification === classification
        );
      },

      // ========================================================================
      // TRAVERSAL
      // ========================================================================

      /**
       * Get all nodes that depend on the given node (transitively)
       * Uses BFS to find all affected downstream nodes
       * @param {string} nodeId - Starting node
       * @returns {string[]} - All affected downstream nodes
       */
      getDownstream(nodeId) {
        const affected = new Set();
        const queue = [nodeId];

        while (queue.length > 0) {
          const current = queue.shift();
          const dependents = downstream.get(current);

          if (dependents) {
            for (const dep of dependents) {
              if (!affected.has(dep)) {
                affected.add(dep);
                queue.push(dep);
              }
            }
          }
        }

        return Array.from(affected);
      },

      /**
       * Get immediate downstream nodes (direct dependents only, not transitive)
       * @param {string} nodeId
       * @returns {string[]}
       */
      getImmediateDownstream(nodeId) {
        return Array.from(downstream.get(nodeId) || []);
      },

      /**
       * Get all nodes this node depends on (transitively)
       * @param {string} nodeId
       * @returns {string[]}
       */
      getUpstream(nodeId) {
        const deps = new Set();
        const queue = [nodeId];

        while (queue.length > 0) {
          const current = queue.shift();
          const dependencies = upstream.get(current);

          if (dependencies) {
            for (const dep of dependencies) {
              if (!deps.has(dep)) {
                deps.add(dep);
                queue.push(dep);
              }
            }
          }
        }

        return Array.from(deps);
      },

      /**
       * Get immediate upstream nodes (direct dependencies only, not transitive)
       * @param {string} nodeId
       * @returns {string[]}
       */
      getImmediateUpstream(nodeId) {
        return Array.from(upstream.get(nodeId) || []);
      },

      // ========================================================================
      // ORDERING
      // ========================================================================

      /**
       * Topologically sort a set of node IDs
       * Returns nodes in order such that dependencies come before dependents
       * Uses DFS-based topological sort (Kahn's algorithm)
       * @param {string[]} nodeIds - Nodes to sort
       * @returns {string[]} - Sorted node IDs
       */
      topologicalSort(nodeIds) {
        const nodeSet = new Set(nodeIds);
        const visited = new Set();
        const temp = new Set();
        const result = [];

        const visit = (nodeId) => {
          // Only sort requested nodes
          if (!nodeSet.has(nodeId)) return;

          // Circular dependency detection
          if (temp.has(nodeId)) {
            console.warn(
              `[ComputationGraph] Circular dependency detected at: ${nodeId}`
            );
            return;
          }

          // Already processed
          if (visited.has(nodeId)) return;

          temp.add(nodeId);

          // Visit dependencies first (upstream nodes)
          const deps = upstream.get(nodeId) || new Set();
          for (const dep of deps) {
            visit(dep);
          }

          temp.delete(nodeId);
          visited.add(nodeId);
          result.push(nodeId);
        };

        for (const nodeId of nodeIds) {
          visit(nodeId);
        }

        return result;
      },

      /**
       * Get full computation order (all computation nodes)
       * Cached after first call; invalidated by registerNode/removeNode.
       * @returns {string[]}
       */
      getFullComputationOrder() {
        if (!_cachedComputeOrder) {
          _cachedComputeOrder = this.topologicalSort(this.getAllNodeIds());
        }
        return _cachedComputeOrder;
      },

      // ========================================================================
      // ANALYSIS
      // ========================================================================

      /**
       * Find nodes that require convergence iteration
       * @returns {string[][]} - Groups of nodes that form convergence cycles
       */
      findConvergenceGroups() {
        const convergentNodes = [];

        for (const [id, node] of nodes) {
          if (node.converges) {
            convergentNodes.push(id);
          }
        }

        if (convergentNodes.length === 0) {
          return [];
        }

        // Group convergent nodes that share dependencies
        // Simplified grouping - nodes that are downstream of each other
        const groups = [];
        const processed = new Set();

        for (const nodeId of convergentNodes) {
          if (processed.has(nodeId)) continue;

          const group = [nodeId];
          processed.add(nodeId);

          // Find related convergent nodes (those in the same dependency cluster)
          const related = this.getDownstream(nodeId).filter(
            (id) => convergentNodes.includes(id) && !processed.has(id)
          );

          for (const relId of related) {
            group.push(relId);
            processed.add(relId);
          }

          if (group.length > 0) {
            groups.push(group);
          }
        }

        return groups;
      },

      /**
       * Detect circular dependencies in the graph
       * @returns {string[][]} Array of cycles found (each cycle is an array of node IDs)
       */
      detectCycles() {
        const cycles = [];
        const visited = new Set();
        const recStack = new Set();
        const path = [];

        const dfs = (nodeId) => {
          visited.add(nodeId);
          recStack.add(nodeId);
          path.push(nodeId);

          const deps = downstream.get(nodeId) || new Set();
          for (const dep of deps) {
            if (!visited.has(dep)) {
              const cycle = dfs(dep);
              if (cycle) return cycle;
            } else if (recStack.has(dep)) {
              // Found a cycle
              const cycleStart = path.indexOf(dep);
              const cycle = path.slice(cycleStart);
              cycle.push(dep); // Complete the cycle
              cycles.push(cycle);
            }
          }

          path.pop();
          recStack.delete(nodeId);
          return null;
        };

        // Check all nodes
        for (const nodeId of this.getAllIds()) {
          if (!visited.has(nodeId)) {
            dfs(nodeId);
          }
        }

        return cycles;
      },

      /**
       * Get statistics about the graph
       * @returns {Object}
       */
      getStats() {
        let totalEdges = 0;
        let maxDownstream = 0;
        let maxUpstream = 0;
        let convergentCount = 0;

        for (const deps of downstream.values()) {
          totalEdges += deps.size;
          maxDownstream = Math.max(maxDownstream, deps.size);
        }

        for (const deps of upstream.values()) {
          maxUpstream = Math.max(maxUpstream, deps.size);
        }

        for (const node of nodes.values()) {
          if (node.converges) convergentCount++;
        }

        // Count by classification
        const byClassification = { G: 0, C: 0, A: 0, unclassified: 0 };
        for (const node of nodes.values()) {
          if (node.classification in byClassification) {
            byClassification[node.classification]++;
          } else {
            byClassification.unclassified++;
          }
        }

        return {
          nodeCount: nodes.size,
          inputCount: inputs.size,
          totalCount: nodes.size + inputs.size,
          edgeCount: totalEdges,
          maxDownstream,
          maxUpstream,
          convergentNodes: convergentCount,
          avgDependencies:
            nodes.size > 0
              ? (totalEdges / nodes.size).toFixed(2)
              : 0,
          byClassification
        };
      },

      // ========================================================================
      // SERIALIZATION
      // ========================================================================

      /**
       * Export graph for visualization (compatible with existing Dependency.js and D3)
       * @returns {{nodes: Array, links: Array}}
       */
      exportForVisualization() {
        const vizNodes = [];
        const vizLinks = [];

        // Add computation nodes
        for (const [id, node] of nodes) {
          vizNodes.push({
            id,
            legacyId: node.legacyId,
            type: "computed",
            section: node.section,
            classification: node.classification,
            converges: node.converges || false,
            label: node.label || id
          });
        }

        // Add input nodes
        for (const [id, input] of inputs) {
          vizNodes.push({
            id,
            legacyId: input.legacyId,
            type: "input",
            section: input.section,
            classification: input.classification,
            label: input.label || id
          });
        }

        // Add links
        for (const [sourceId, targets] of downstream) {
          for (const targetId of targets) {
            vizLinks.push({
              source: sourceId,
              target: targetId
            });
          }
        }

        return { nodes: vizNodes, links: vizLinks };
      },

      /**
       * Export graph as JSON for persistence
       * @returns {Object}
       */
      toJSON() {
        return {
          nodes: Array.from(nodes.entries()).map(([id, node]) => ({
            ...node,
            id
          })),
          inputs: Array.from(inputs.entries()).map(([id, input]) => ({
            ...input,
            id
          }))
        };
      },

      // ========================================================================
      // DEBUGGING
      // ========================================================================

      /**
       * Print graph structure to console
       */
      debug() {
        console.group("[ComputationGraph] Debug Info");
        console.log("Stats:", this.getStats());
        console.log("Computation Nodes:", [...nodes.keys()]);
        console.log("Input Nodes:", [...inputs.keys()]);
        console.log("Convergence Groups:", this.findConvergenceGroups());

        const cycles = this.detectCycles();
        if (cycles.length > 0) {
          console.warn("Circular Dependencies:", cycles);
        }

        console.groupEnd();
      },

      /**
       * Trace the dependency path between two nodes
       * @param {string} fromId - Starting node
       * @param {string} toId - Target node
       * @returns {string[] | null} - Path from fromId to toId, or null if no path exists
       */
      tracePath(fromId, toId) {
        const visited = new Set();
        const queue = [[fromId]];

        while (queue.length > 0) {
          const path = queue.shift();
          const current = path[path.length - 1];

          if (current === toId) {
            return path;
          }

          if (visited.has(current)) continue;
          visited.add(current);

          const dependents = downstream.get(current) || new Set();
          for (const dep of dependents) {
            if (!visited.has(dep)) {
              queue.push([...path, dep]);
            }
          }
        }

        return null; // No path found
      }
    };
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.TEUI.createComputationGraph = createComputationGraph;

  // Also expose as ComputationGraph.create() for cleaner API
  window.TEUI.ComputationGraph = {
    create: createComputationGraph
  };

  // Log initialization
  console.log("[ComputationGraph] Module loaded");
})();
