/**
 * ModelSelector.js - Model Selection UI Component
 *
 * Part of the Multi-Model Architecture refactoring (Phase 4, Task 4.2)
 * See: docs/REFACTORING_PLAN.md
 *
 * Provides UI for selecting and managing multiple building models:
 * - Dropdown/tabs for switching between models
 * - Visual indicators for model type (target, reference, variant)
 * - Model creation/removal controls
 * - Integrates with MultiModelState
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};

  // ============================================================================
  // MODEL SELECTOR FACTORY
  // ============================================================================

  /**
   * Create a model selector UI component
   * @param {Object} options
   * @param {Object} options.state - MultiModelState instance
   * @param {HTMLElement} [options.container] - Container element (or ID)
   * @param {string} [options.mode] - 'dropdown' | 'tabs' | 'pills' (default: 'dropdown')
   * @param {Function} [options.onModelChange] - Callback when model changes
   * @returns {ModelSelector}
   */
  function createModelSelector(options = {}) {
    const state = options.state;
    const mode = options.mode || "dropdown";
    let container = options.container;
    const onModelChange = options.onModelChange;

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

    // ========================================================================
    // STYLE DEFINITIONS
    // ========================================================================

    const styles = {
      container: `
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `,
      label: `
        font-size: 13px;
        font-weight: 500;
        color: #666;
      `,
      dropdown: `
        padding: 6px 28px 6px 10px;
        font-size: 13px;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: white url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E") no-repeat right 8px center;
        cursor: pointer;
        min-width: 140px;
        appearance: none;
      `,
      tabs: `
        display: flex;
        gap: 0;
        border: 1px solid #ccc;
        border-radius: 4px;
        overflow: hidden;
      `,
      tab: `
        padding: 6px 14px;
        font-size: 13px;
        border: none;
        border-right: 1px solid #ccc;
        background: #f5f5f5;
        cursor: pointer;
        transition: background 0.15s;
      `,
      tabActive: `
        background: #2563eb;
        color: white;
      `,
      tabLast: `
        border-right: none;
      `,
      pills: `
        display: flex;
        gap: 6px;
      `,
      pill: `
        padding: 4px 12px;
        font-size: 12px;
        border: 1px solid #ccc;
        border-radius: 16px;
        background: white;
        cursor: pointer;
        transition: all 0.15s;
      `,
      pillActive: `
        background: #2563eb;
        color: white;
        border-color: #2563eb;
      `,
      modelBadge: `
        display: inline-block;
        padding: 2px 6px;
        font-size: 10px;
        border-radius: 3px;
        margin-left: 6px;
        text-transform: uppercase;
        font-weight: 600;
      `,
      targetBadge: `background: #dcfce7; color: #166534;`,
      referenceBadge: `background: #dbeafe; color: #1e40af;`,
      variantBadge: `background: #fef3c7; color: #92400e;`
    };

    // ========================================================================
    // HELPER FUNCTIONS
    // ========================================================================

    /**
     * Get badge style for model type
     * @param {string} modelType
     * @returns {string}
     */
    function getBadgeStyle(modelType) {
      switch (modelType) {
        case "target":
          return styles.targetBadge;
        case "reference":
          return styles.referenceBadge;
        case "variant":
          return styles.variantBadge;
        default:
          return "";
      }
    }

    /**
     * Get short label for model type
     * @param {string} modelType
     * @returns {string}
     */
    function getTypeLabel(modelType) {
      switch (modelType) {
        case "target":
          return "T";
        case "reference":
          return "R";
        case "variant":
          return "V";
        default:
          return "";
      }
    }

    /**
     * Handle model selection change
     * @param {string} modelId
     */
    function handleModelChange(modelId) {
      if (modelId === state.getActiveModelId()) {
        return; // No change
      }

      state.setActiveModel(modelId);

      if (onModelChange) {
        const model = state.getModel(modelId);
        onModelChange(modelId, model);
      }
    }

    // ========================================================================
    // RENDER FUNCTIONS
    // ========================================================================

    /**
     * Render dropdown mode
     * @returns {HTMLElement}
     */
    function renderDropdown() {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = styles.container;

      const label = document.createElement("label");
      label.style.cssText = styles.label;
      label.textContent = "Model:";
      wrapper.appendChild(label);

      const select = document.createElement("select");
      select.style.cssText = styles.dropdown;
      select.setAttribute("aria-label", "Select building model");

      const models = state.getAllModels();
      const activeId = state.getActiveModelId();

      for (const model of models) {
        const option = document.createElement("option");
        option.value = model.id;
        option.textContent = `${model.label} (${getTypeLabel(model.modelType)})`;
        option.selected = model.id === activeId;
        select.appendChild(option);
      }

      select.addEventListener("change", () => {
        handleModelChange(select.value);
      });

      wrapper.appendChild(select);
      return wrapper;
    }

    /**
     * Render tabs mode
     * @returns {HTMLElement}
     */
    function renderTabs() {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = styles.container;

      const tabsContainer = document.createElement("div");
      tabsContainer.style.cssText = styles.tabs;
      tabsContainer.setAttribute("role", "tablist");

      const models = state.getAllModels();
      const activeId = state.getActiveModelId();

      models.forEach((model, index) => {
        const tab = document.createElement("button");
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", model.id === activeId);
        tab.dataset.modelId = model.id;

        let tabStyle = styles.tab;
        if (model.id === activeId) {
          tabStyle += styles.tabActive;
        }
        if (index === models.length - 1) {
          tabStyle += styles.tabLast;
        }
        tab.style.cssText = tabStyle;

        tab.innerHTML = `${model.label}<span style="${styles.modelBadge}${getBadgeStyle(model.modelType)}">${getTypeLabel(model.modelType)}</span>`;

        tab.addEventListener("click", () => {
          handleModelChange(model.id);
        });

        tabsContainer.appendChild(tab);
      });

      wrapper.appendChild(tabsContainer);
      return wrapper;
    }

    /**
     * Render pills mode
     * @returns {HTMLElement}
     */
    function renderPills() {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = styles.container;

      const label = document.createElement("span");
      label.style.cssText = styles.label;
      label.textContent = "Model:";
      wrapper.appendChild(label);

      const pillsContainer = document.createElement("div");
      pillsContainer.style.cssText = styles.pills;

      const models = state.getAllModels();
      const activeId = state.getActiveModelId();

      for (const model of models) {
        const pill = document.createElement("button");
        pill.dataset.modelId = model.id;

        let pillStyle = styles.pill;
        if (model.id === activeId) {
          pillStyle += styles.pillActive;
        }
        pill.style.cssText = pillStyle;

        pill.textContent = model.label;

        pill.addEventListener("click", () => {
          handleModelChange(model.id);
        });

        pillsContainer.appendChild(pill);
      }

      wrapper.appendChild(pillsContainer);
      return wrapper;
    }

    /**
     * Render based on mode
     * @returns {HTMLElement}
     */
    function render() {
      switch (mode) {
        case "tabs":
          return renderTabs();
        case "pills":
          return renderPills();
        case "dropdown":
        default:
          return renderDropdown();
      }
    }

    /**
     * Update the UI (re-render)
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

    const selector = {
      /**
       * Mount the selector to a container
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
            event.type === "modelAdded" ||
            event.type === "modelRemoved" ||
            event.type === "activeModelChanged"
          ) {
            update();
          }
        });

        console.log("[ModelSelector] Mounted in", mode, "mode");
      },

      /**
       * Unmount the selector
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
       * Get the DOM element
       * @returns {HTMLElement|null}
       */
      getElement() {
        return element;
      },

      /**
       * Force update
       */
      update,

      /**
       * Get current mode
       * @returns {string}
       */
      getMode() {
        return mode;
      },

      /**
       * Select a model programmatically
       * @param {string} modelId
       */
      selectModel(modelId) {
        handleModelChange(modelId);
      },

      /**
       * Get selected model ID
       * @returns {string|null}
       */
      getSelectedModelId() {
        return state.getActiveModelId();
      },

      /**
       * Get selected model metadata
       * @returns {Object|undefined}
       */
      getSelectedModel() {
        return state.getActiveModel();
      }
    };

    // Auto-mount if container provided
    if (container) {
      selector.mount(container);
    }

    return selector;
  }

  // ============================================================================
  // EXPORT
  // ============================================================================

  window.TEUI.ModelSelector = {
    create: createModelSelector
  };

  console.log("[ModelSelector] Module loaded");
})();
