/**
 * ComparisonView.js - Model Comparison UI Component
 *
 * Part of the Multi-Model Architecture refactoring (Phase 4, Task 4.3)
 * See: docs/REFACTORING_PLAN.md
 *
 * Provides side-by-side comparison of building models:
 * - Shows differences between target and reference models
 * - Highlights better/worse performance metrics
 * - Displays delta values for numeric fields
 * - Can compare any two models
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};

  // ============================================================================
  // COMPARISON VIEW FACTORY
  // ============================================================================

  /**
   * Create a comparison view UI component
   * @param {Object} options
   * @param {Object} options.state - MultiModelState instance
   * @param {Object} [options.engine] - MultiModelEngine for computing comparisons
   * @param {Object} [options.registry] - FieldRegistry for field metadata
   * @param {HTMLElement|string} [options.container] - Container element
   * @param {Function} [options.formatValue] - Custom value formatter
   * @returns {ComparisonView}
   */
  function createComparisonView(options = {}) {
    const state = options.state;
    const engine = options.engine;
    const registry = options.registry || window.TEUI.FieldRegistry;
    let container = options.container;
    const formatValue = options.formatValue || defaultFormatValue;

    if (!state) {
      throw new Error("MultiModelState required");
    }

    // Resolve container
    if (typeof container === "string") {
      container = document.getElementById(container);
    }

    // Internal state
    let element = null;
    let unsubscribe = null;
    let leftModelId = null;
    let rightModelId = null;
    let fieldFilter = null; // Array of field paths to show, or null for all

    // ========================================================================
    // STYLE DEFINITIONS
    // ========================================================================

    const styles = {
      container: `
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        overflow: hidden;
        background: white;
      `,
      header: `
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        background: #f5f5f5;
        border-bottom: 1px solid #e0e0e0;
        font-weight: 600;
        font-size: 13px;
      `,
      headerCell: `
        padding: 10px 12px;
        text-align: center;
      `,
      headerLeft: `
        text-align: left;
        color: #666;
      `,
      row: `
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        border-bottom: 1px solid #f0f0f0;
        font-size: 13px;
      `,
      rowHover: `
        background: #fafafa;
      `,
      cell: `
        padding: 8px 12px;
        text-align: center;
      `,
      cellLabel: `
        text-align: left;
        color: #333;
        font-weight: 500;
      `,
      cellDiff: `
        font-size: 11px;
        color: #666;
      `,
      better: `
        background: #dcfce7;
        color: #166534;
      `,
      worse: `
        background: #fee2e2;
        color: #991b1b;
      `,
      same: `
        color: #666;
      `,
      delta: `
        font-size: 11px;
        margin-left: 4px;
      `,
      deltaPositive: `color: #dc2626;`,
      deltaNegative: `color: #16a34a;`,
      deltaZero: `color: #666;`,
      sectionHeader: `
        background: #f9fafb;
        padding: 8px 12px;
        font-weight: 600;
        color: #374151;
        border-bottom: 1px solid #e0e0e0;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      `,
      empty: `
        padding: 20px;
        text-align: center;
        color: #666;
        font-style: italic;
      `
    };

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Default value formatter
     * @param {*} value
     * @param {string} fieldPath
     * @returns {string}
     */
    function defaultFormatValue(value, fieldPath) {
      if (value === undefined || value === null) {
        return "—";
      }
      if (typeof value === "number") {
        // Format based on magnitude
        if (Math.abs(value) >= 1000) {
          return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
        }
        if (Math.abs(value) < 0.01 && value !== 0) {
          return value.toExponential(2);
        }
        return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
      }
      if (typeof value === "boolean") {
        return value ? "Yes" : "No";
      }
      return String(value);
    }

    /**
     * Get field label from registry or path
     * @param {string} fieldPath
     * @returns {string}
     */
    function getFieldLabel(fieldPath) {
      if (registry?.getFieldInfo) {
        const info = registry.getFieldInfo(fieldPath);
        if (info?.label) return info.label;
      }
      // Convert path to readable label
      const parts = fieldPath.split(".");
      const lastPart = parts[parts.length - 1];
      return lastPart
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
    }

    /**
     * Get field unit from registry
     * @param {string} fieldPath
     * @returns {string}
     */
    function getFieldUnit(fieldPath) {
      if (registry?.getFieldInfo) {
        const info = registry.getFieldInfo(fieldPath);
        if (info?.unit) return info.unit;
      }
      return "";
    }

    /**
     * Determine if lower values are better for a field
     * @param {string} fieldPath
     * @returns {boolean}
     */
    function isLowerBetter(fieldPath) {
      // Energy consumption, heat loss, costs - lower is better
      const lowerBetterPatterns = [
        "energy",
        "consumption",
        "demand",
        "loss",
        "cost",
        "ghg",
        "emission"
      ];
      const pathLower = fieldPath.toLowerCase();
      return lowerBetterPatterns.some((p) => pathLower.includes(p));
    }

    /**
     * Calculate delta between two values
     * @param {*} leftValue
     * @param {*} rightValue
     * @returns {{delta: number|null, percent: number|null}}
     */
    function calculateDelta(leftValue, rightValue) {
      if (
        typeof leftValue !== "number" ||
        typeof rightValue !== "number" ||
        isNaN(leftValue) ||
        isNaN(rightValue)
      ) {
        return { delta: null, percent: null };
      }

      const delta = leftValue - rightValue;
      const percent =
        rightValue !== 0 ? ((leftValue - rightValue) / rightValue) * 100 : null;

      return { delta, percent };
    }

    /**
     * Get all field paths from both models
     * @param {string} modelId1
     * @param {string} modelId2
     * @returns {string[]}
     */
    function getAllFieldPaths(modelId1, modelId2) {
      const paths = new Set();

      // Get shared fields
      const sharedState = state.getSharedState();
      for (const key of sharedState.keys()) {
        paths.add(key);
      }

      // Get model-specific fields
      const state1 = state.getModelSpecificState(modelId1);
      const state2 = state.getModelSpecificState(modelId2);

      for (const key of state1.keys()) {
        paths.add(key);
      }
      for (const key of state2.keys()) {
        paths.add(key);
      }

      return Array.from(paths).sort();
    }

    /**
     * Group fields by section
     * @param {string[]} fieldPaths
     * @returns {Map<string, string[]>}
     */
    function groupBySection(fieldPaths) {
      const groups = new Map();

      for (const path of fieldPaths) {
        const section = path.split(".")[0] || "other";
        if (!groups.has(section)) {
          groups.set(section, []);
        }
        groups.get(section).push(path);
      }

      return groups;
    }

    // ========================================================================
    // RENDER FUNCTIONS
    // ========================================================================

    /**
     * Render comparison row for a field
     * @param {string} fieldPath
     * @returns {HTMLElement}
     */
    function renderRow(fieldPath) {
      const leftValue = state.getValueForModel(leftModelId, fieldPath);
      const rightValue = state.getValueForModel(rightModelId, fieldPath);
      const { delta, percent } = calculateDelta(leftValue, rightValue);

      const row = document.createElement("div");
      row.style.cssText = styles.row;

      // Label cell
      const labelCell = document.createElement("div");
      labelCell.style.cssText = styles.cell + styles.cellLabel;
      const label = getFieldLabel(fieldPath);
      const unit = getFieldUnit(fieldPath);
      labelCell.textContent = label + (unit ? ` (${unit})` : "");
      labelCell.title = fieldPath;
      row.appendChild(labelCell);

      // Left value cell
      const leftCell = document.createElement("div");
      leftCell.style.cssText = styles.cell;

      const leftFormatted = formatValue(leftValue, fieldPath);
      leftCell.textContent = leftFormatted;

      // Apply styling based on comparison
      if (delta !== null && delta !== 0) {
        const lowerIsBetter = isLowerBetter(fieldPath);
        const leftIsBetter = lowerIsBetter ? delta < 0 : delta > 0;
        if (leftIsBetter) {
          leftCell.style.cssText += styles.better;
        } else {
          leftCell.style.cssText += styles.worse;
        }
      }

      row.appendChild(leftCell);

      // Right value cell (with delta)
      const rightCell = document.createElement("div");
      rightCell.style.cssText = styles.cell;

      const rightFormatted = formatValue(rightValue, fieldPath);
      rightCell.innerHTML = rightFormatted;

      if (delta !== null) {
        const deltaSpan = document.createElement("span");
        deltaSpan.style.cssText = styles.delta;

        if (delta === 0) {
          deltaSpan.style.cssText += styles.deltaZero;
          deltaSpan.textContent = "(=)";
        } else {
          const sign = delta > 0 ? "+" : "";
          const percentStr =
            percent !== null ? ` (${sign}${percent.toFixed(1)}%)` : "";
          deltaSpan.style.cssText +=
            delta > 0 ? styles.deltaPositive : styles.deltaNegative;
          deltaSpan.textContent = percentStr;
        }

        rightCell.appendChild(deltaSpan);
      }

      row.appendChild(rightCell);

      // Hover effect
      row.addEventListener("mouseenter", () => {
        row.style.background = "#fafafa";
      });
      row.addEventListener("mouseleave", () => {
        row.style.background = "";
      });

      return row;
    }

    /**
     * Render section header
     * @param {string} sectionName
     * @returns {HTMLElement}
     */
    function renderSectionHeader(sectionName) {
      const header = document.createElement("div");
      header.style.cssText = styles.sectionHeader;
      header.textContent =
        sectionName.charAt(0).toUpperCase() + sectionName.slice(1);
      return header;
    }

    /**
     * Render the full comparison view
     * @returns {HTMLElement}
     */
    function render() {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = styles.container;

      // Check if we have models to compare
      if (!leftModelId || !rightModelId) {
        const empty = document.createElement("div");
        empty.style.cssText = styles.empty;
        empty.textContent = "Select two models to compare";
        wrapper.appendChild(empty);
        return wrapper;
      }

      const leftModel = state.getModel(leftModelId);
      const rightModel = state.getModel(rightModelId);

      if (!leftModel || !rightModel) {
        const empty = document.createElement("div");
        empty.style.cssText = styles.empty;
        empty.textContent = "Selected models not found";
        wrapper.appendChild(empty);
        return wrapper;
      }

      // Header row
      const header = document.createElement("div");
      header.style.cssText = styles.header;

      const headerLabel = document.createElement("div");
      headerLabel.style.cssText = styles.headerCell + styles.headerLeft;
      headerLabel.textContent = "Field";
      header.appendChild(headerLabel);

      const headerLeft = document.createElement("div");
      headerLeft.style.cssText = styles.headerCell;
      headerLeft.textContent = leftModel.label;
      header.appendChild(headerLeft);

      const headerRight = document.createElement("div");
      headerRight.style.cssText = styles.headerCell;
      headerRight.textContent = rightModel.label;
      header.appendChild(headerRight);

      wrapper.appendChild(header);

      // Get field paths
      let fieldPaths = fieldFilter || getAllFieldPaths(leftModelId, rightModelId);

      // Group by section
      const grouped = groupBySection(fieldPaths);

      // Render sections
      for (const [section, paths] of grouped) {
        wrapper.appendChild(renderSectionHeader(section));
        for (const path of paths) {
          wrapper.appendChild(renderRow(path));
        }
      }

      return wrapper;
    }

    /**
     * Update the UI
     */
    function update() {
      if (!element || !element.parentNode) {
        return;
      }

      const parent = element.parentNode;
      const newElement = render();
      parent.replaceChild(newElement, element);
      element = newElement;
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    const view = {
      /**
       * Mount the view to a container
       * @param {HTMLElement|string} targetContainer
       */
      mount(targetContainer) {
        if (typeof targetContainer === "string") {
          targetContainer = document.getElementById(targetContainer);
        }

        if (!targetContainer) {
          throw new Error("Container element not found");
        }

        // Clean up previous mount
        this.unmount();

        // Render and append
        element = render();
        targetContainer.appendChild(element);

        // Subscribe to state changes
        unsubscribe = state.addListener((event) => {
          if (
            event.type === "valueChanged" ||
            event.type === "modelAdded" ||
            event.type === "modelRemoved"
          ) {
            update();
          }
        });

        console.log("[ComparisonView] Mounted");
      },

      /**
       * Unmount the view
       */
      unmount() {
        if (element && element.parentNode) {
          element.parentNode.removeChild(element);
        }
        element = null;

        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      },

      /**
       * Set models to compare
       * @param {string} leftId - Left model ID
       * @param {string} rightId - Right model ID
       */
      setModels(leftId, rightId) {
        leftModelId = leftId;
        rightModelId = rightId;
        update();
      },

      /**
       * Compare target to reference model
       */
      compareTargetToReference() {
        const models = state.getAllModels();
        const target = models.find((m) => m.modelType === "target");
        const reference = models.find((m) => m.modelType === "reference");

        if (target && reference) {
          this.setModels(target.id, reference.id);
        } else {
          console.warn(
            "[ComparisonView] Target or reference model not found"
          );
        }
      },

      /**
       * Set field filter
       * @param {string[]|null} paths - Array of field paths to show, or null for all
       */
      setFieldFilter(paths) {
        fieldFilter = paths;
        update();
      },

      /**
       * Get current comparison data
       * @returns {Object[]}
       */
      getComparisonData() {
        if (!leftModelId || !rightModelId) {
          return [];
        }

        const fieldPaths =
          fieldFilter || getAllFieldPaths(leftModelId, rightModelId);
        const data = [];

        for (const path of fieldPaths) {
          const leftValue = state.getValueForModel(leftModelId, path);
          const rightValue = state.getValueForModel(rightModelId, path);
          const { delta, percent } = calculateDelta(leftValue, rightValue);

          data.push({
            fieldPath: path,
            label: getFieldLabel(path),
            unit: getFieldUnit(path),
            leftValue,
            rightValue,
            delta,
            percent,
            isLowerBetter: isLowerBetter(path)
          });
        }

        return data;
      },

      /**
       * Export comparison as CSV
       * @returns {string}
       */
      exportCSV() {
        const data = this.getComparisonData();
        const leftModel = state.getModel(leftModelId);
        const rightModel = state.getModel(rightModelId);

        const headers = [
          "Field",
          leftModel?.label || "Left",
          rightModel?.label || "Right",
          "Delta",
          "Percent Change"
        ];

        const rows = data.map((row) => [
          row.label,
          row.leftValue ?? "",
          row.rightValue ?? "",
          row.delta ?? "",
          row.percent ? `${row.percent.toFixed(2)}%` : ""
        ]);

        return [headers, ...rows].map((row) => row.join(",")).join("\n");
      },

      /**
       * Get the DOM element
       * @returns {HTMLElement|null}
       */
      getElement() {
        return element;
      },

      /**
       * Force update
       */
      update
    };

    // Auto-mount if container provided
    if (container) {
      view.mount(container);
    }

    return view;
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.TEUI.ComparisonView = {
    create: createComparisonView
  };

  console.log("[ComparisonView] Module loaded");
})();
