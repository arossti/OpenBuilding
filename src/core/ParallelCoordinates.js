/**
 * ParallelCoordinates.js (Refactored - Nov 30, 2025)
 * Section 18 Interactive Parallel Coordinates Optimization Visualization
 *
 * Lightweight orchestrator that coordinates between:
 * - pcConfig.js: Axis configuration and data fetching
 * - pcRendering.js: D3 visualization and interaction
 * - pcOptimization.js: Optimization preset handlers
 * - pcFinancials.js: Financial calculations (optional Pro feature)
 *
 * Reduced from 3,199 lines to ~800 lines by extracting modules
 *
 * @agent NOVA - November 25, 2025
 * @refactored November 30, 2025 - Module extraction pattern
 */

// Ensure namespace exists
window.TEUI = window.TEUI || {};

window.TEUI.ParallelCoordinates = (function () {
  "use strict";

  // ══════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ══════════════════════════════════════════════════════════════════════

  const CONFIG = {
    // Layout
    graphHeightPercent: 0.55, // 55% for graph
    tableHeightPercent: 0.45, // 45% for table
    margin: {
      top: 60,
      right: 55,
      bottom: 20,
      left: 115,
    },

    // Financial settings
    roiTerm: 1, // Default ROI term in years

    // Visual styling
    colors: {
      target: "#007bff", // Blue
      reference: "#dc3545", // Red
      axisLine: "#ccc",
      axisText: "#333",
      gridLine: "#eee",
    },

    // Line styling
    lineWidth: 3,
    lineWidthHover: 4,
    lineOpacity: 0.9,
    lineOpacityHover: 1,

    // Animation
    transitionDuration: 300,

    // Container selectors
    containerSelector: ".parallel-coordinates-container",
    controlsSelector: ".parallel-coordinates-controls-wrapper",
    infoSelector: ".parallel-coordinates-info-wrapper",
  };

  // ══════════════════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════

  let currentData = null;
  let isFullscreen = false;
  let isActivated = false;

  // ══════════════════════════════════════════════════════════════════════
  // UI INITIALIZATION & CONTROLS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Initialize the parallel coordinates visualization
   */
  function initialize() {
    console.log("[ParallelCoordinates] Setting up initial state");

    const container = document.querySelector(CONFIG.containerSelector);
    const controlsWrapper = document.querySelector(CONFIG.controlsSelector);

    if (!container || !controlsWrapper) {
      console.warn("[ParallelCoordinates] Required containers not found");
      return;
    }

    createInitialControlsRow(controlsWrapper);
    createLoadingPlaceholder(container);

    console.log("[ParallelCoordinates] Initial state ready");
  }

  /**
   * Create initial controls row with activation button
   */
  function createInitialControlsRow(controlsWrapper) {
    controlsWrapper.innerHTML = "";

    const controlsContainer = document.createElement("div");
    controlsContainer.className = "parallel-coordinates-controls";

    const activateBtn = document.createElement("button");
    activateBtn.id = "s18ActivateBtn";
    activateBtn.className = "btn btn-primary btn-sm";
    activateBtn.innerHTML =
      '<i class="bi bi-shuffle"></i> Activate Optimization View';
    activateBtn.addEventListener("click", activateVisualization);

    const layoutContainer = document.createElement("div");

    const refreshBtn = document.createElement("button");
    refreshBtn.className = "btn btn-outline-secondary btn-sm";
    refreshBtn.title = "Refresh Data";
    refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    refreshBtn.disabled = true;

    const exportBtn = document.createElement("button");
    exportBtn.className = "btn btn-outline-secondary btn-sm";
    exportBtn.title = "Export as PNG";
    exportBtn.innerHTML = '<i class="bi bi-download"></i>';
    exportBtn.disabled = true;

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "btn btn-outline-secondary btn-sm";
    settingsBtn.title = "Settings";
    settingsBtn.innerHTML = '<i class="bi bi-gear"></i>';
    settingsBtn.disabled = true;

    const fullscreenBtn = document.createElement("button");
    fullscreenBtn.className = "btn btn-outline-secondary btn-sm";
    fullscreenBtn.title = "Toggle Fullscreen";
    fullscreenBtn.innerHTML = '<i class="bi bi-arrows-fullscreen"></i>';
    fullscreenBtn.disabled = true;

    layoutContainer.appendChild(refreshBtn);
    layoutContainer.appendChild(exportBtn);
    layoutContainer.appendChild(settingsBtn);
    layoutContainer.appendChild(fullscreenBtn);

    controlsContainer.appendChild(activateBtn);
    controlsContainer.appendChild(layoutContainer);

    controlsWrapper.appendChild(controlsContainer);
  }

  /**
   * Create loading placeholder message
   */
  function createLoadingPlaceholder(container) {
    const placeholder = document.createElement("div");
    placeholder.id = "s18LoadingPlaceholder";
    placeholder.className = "teui-loading-placeholder";
    placeholder.innerHTML =
      "<p>Click 'Activate Optimization View' to visualize optimization paths between Target and Reference configurations.</p>";

    container.innerHTML = "";
    container.appendChild(placeholder);
  }

  /**
   * Activate the visualization
   */
  function activateVisualization() {
    console.log("[ParallelCoordinates] Activating visualization");

    const container = document.querySelector(CONFIG.containerSelector);
    const placeholder = document.getElementById("s18LoadingPlaceholder");

    if (!container) return;

    container.classList.add("activated");

    if (placeholder) {
      placeholder.style.display = "none";
    }

    isActivated = true;
    initializeFullControls();
    refresh();
  }

  /**
   * Setup full control panel with enabled buttons
   */
  function initializeFullControls() {
    const controlsWrapper = document.querySelector(CONFIG.controlsSelector);
    if (!controlsWrapper) return;

    const existingControls = controlsWrapper.querySelector(
      ".parallel-coordinates-controls"
    );
    if (existingControls) {
      existingControls.remove();
    }

    const controlsContainer = document.createElement("div");
    controlsContainer.className = "parallel-coordinates-controls";

    // Main button (Refresh when activated)
    const mainBtn = document.createElement("button");
    mainBtn.id = "s18ActivateBtn";
    if (isActivated) {
      mainBtn.className = "btn btn-outline-secondary btn-sm";
      mainBtn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Refresh Graph';
      mainBtn.addEventListener("click", refresh);
    } else {
      mainBtn.className = "btn btn-primary btn-sm";
      mainBtn.innerHTML =
        '<i class="bi bi-shuffle"></i> Activate Optimization View';
      mainBtn.addEventListener("click", activateVisualization);
    }

    // Action buttons (only when activated)
    let restoreBaselineBtn,
      decarbonizeBtn,
      optimizeBtn,
      superOptimizeBtn,
      passivhausBtn;

    if (isActivated) {
      restoreBaselineBtn = document.createElement("button");
      restoreBaselineBtn.className = "btn btn-secondary btn-sm";
      restoreBaselineBtn.innerHTML = "Restore Baseline";
      restoreBaselineBtn.addEventListener("click", handleRestoreBaseline);

      decarbonizeBtn = document.createElement("button");
      decarbonizeBtn.className = "btn btn-success btn-sm pc-btn-decarbonize";
      decarbonizeBtn.innerHTML = "Decarbonize";
      decarbonizeBtn.addEventListener("click", handleDecarbonize);

      optimizeBtn = document.createElement("button");
      optimizeBtn.className = "btn btn-sm pc-btn-optimize";
      optimizeBtn.innerHTML = "Optimize";
      optimizeBtn.addEventListener("click", handleOptimize);

      superOptimizeBtn = document.createElement("button");
      superOptimizeBtn.className = "btn btn-sm pc-btn-super-optimize";
      superOptimizeBtn.innerHTML = "Super Optimize";
      superOptimizeBtn.addEventListener("click", handleSuperOptimize);

      passivhausBtn = document.createElement("button");
      passivhausBtn.className = "btn btn-sm pc-btn-passivhaus";
      passivhausBtn.innerHTML = "PassivHaus-ify";
      passivhausBtn.addEventListener("click", handlePassivHausIfy);

      // Apply tooltips
      const tooltipManager = window.TEUI?.TooltipManager;
      if (tooltipManager) {
        tooltipManager.applyTooltip(decarbonizeBtn, "s18_decarbonize");
        tooltipManager.applyTooltip(optimizeBtn, "s18_optimize");
        tooltipManager.applyTooltip(superOptimizeBtn, "s18_super_optimize");
        tooltipManager.applyTooltip(passivhausBtn, "s18_passivhaus");
      }
    }

    // Layout container for right-side buttons
    const layoutContainer = document.createElement("div");

    const refreshBtn = createButton(
      "bi-arrow-clockwise",
      "Refresh Data",
      refresh
    );
    const exportBtn = createButton("bi-download", "Export as PNG", exportToPNG);
    const settingsBtn = createButton("bi-gear", "Settings", showSettingsModal);

    // Feedback console
    const feedbackConsole = document.createElement("span");
    feedbackConsole.id = "s18-feedback-console";

    // Legend
    const legendContainer = document.createElement("div");
    legendContainer.className = "pc-legend-container";

    const lineLegendContainer = document.createElement("div");
    lineLegendContainer.className = "pc-line-legend";

    const targetLineLegend = document.createElement("div");
    targetLineLegend.className = "pc-legend-item";
    targetLineLegend.innerHTML = `
      <div style="width: 20px; height: 3px; background: ${CONFIG.colors.target};"></div>
      <span style="font-size: 12px; font-weight: 500; color: ${CONFIG.colors.target};">Target</span>
    `;

    const referenceLineLegend = document.createElement("div");
    referenceLineLegend.className = "pc-legend-item";
    referenceLineLegend.innerHTML = `
      <div style="width: 20px; height: 3px; background: ${CONFIG.colors.reference};"></div>
      <span style="font-size: 12px; font-weight: 500; color: ${CONFIG.colors.reference};">Reference</span>
    `;

    lineLegendContainer.appendChild(targetLineLegend);
    lineLegendContainer.appendChild(referenceLineLegend);

    const nodeLegendContainer = document.createElement("div");
    nodeLegendContainer.className = "pc-node-legend";

    const calculatedNodeLegend = document.createElement("div");
    calculatedNodeLegend.className = "pc-legend-item";
    calculatedNodeLegend.innerHTML = `
      <svg width="16" height="16" style="display: block;">
        <circle cx="8" cy="8" r="3" fill="${CONFIG.colors.target}" stroke="white" stroke-width="1"></circle>
      </svg>
      <span style="font-size: 12px; color: #666;">Calculated</span>
    `;

    const editableNodeLegend = document.createElement("div");
    editableNodeLegend.className = "pc-legend-item";
    editableNodeLegend.innerHTML = `
      <svg width="16" height="16" style="display: block;">
        <circle cx="8" cy="8" r="6" fill="${CONFIG.colors.target}" stroke="white" stroke-width="1.5"></circle>
      </svg>
      <span style="font-size: 12px; color: #666;">Editable</span>
    `;

    nodeLegendContainer.appendChild(calculatedNodeLegend);
    nodeLegendContainer.appendChild(editableNodeLegend);

    legendContainer.appendChild(lineLegendContainer);
    legendContainer.appendChild(nodeLegendContainer);

    const fullscreenBtn = createButton(
      "bi-arrows-fullscreen",
      "Toggle Fullscreen",
      toggleFullscreen
    );

    layoutContainer.appendChild(legendContainer);
    layoutContainer.appendChild(refreshBtn);
    layoutContainer.appendChild(exportBtn);
    layoutContainer.appendChild(settingsBtn);
    layoutContainer.appendChild(fullscreenBtn);

    // Inject feedback console into section header
    const sectionHeader = document.querySelector(
      "#parallelCoordinates .section-header"
    );
    if (
      sectionHeader &&
      !sectionHeader.querySelector("#s18-feedback-console")
    ) {
      sectionHeader.appendChild(feedbackConsole);
    }

    // Assemble controls
    controlsContainer.appendChild(mainBtn);

    if (
      isActivated &&
      restoreBaselineBtn &&
      decarbonizeBtn &&
      optimizeBtn &&
      superOptimizeBtn &&
      passivhausBtn
    ) {
      controlsContainer.appendChild(restoreBaselineBtn);
      controlsContainer.appendChild(decarbonizeBtn);
      controlsContainer.appendChild(optimizeBtn);
      controlsContainer.appendChild(superOptimizeBtn);
      controlsContainer.appendChild(passivhausBtn);
    }

    controlsContainer.appendChild(layoutContainer);
    controlsWrapper.appendChild(controlsContainer);
  }

  /**
   * Helper to create a button with icon
   */
  function createButton(iconClass, tooltip, clickHandler) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-outline-secondary btn-sm";
    btn.setAttribute("title", tooltip);
    btn.innerHTML = `<i class="bi ${iconClass}"></i>`;
    btn.addEventListener("click", clickHandler);
    return btn;
  }

  /**
   * Show settings modal for ROI Term
   */
  function showSettingsModal() {
    const backdrop = document.createElement("div");
    backdrop.className = "pc-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "pc-modal-dialog";

    const header = document.createElement("h5");
    header.textContent = "Financial Settings";
    header.className = "pc-modal-header";

    const label = document.createElement("label");
    label.textContent = "ROI Term (Years):";
    label.className = "pc-modal-label";

    const select = document.createElement("select");
    select.className = "form-select pc-modal-select";

    const terms = [1, 2, 3, 4, 5, 10, 15, 20, 30, 40, 50];
    terms.forEach(year => {
      const option = document.createElement("option");
      option.value = year;
      option.textContent = `${year} year${year > 1 ? "s" : ""}`;
      if (year === CONFIG.roiTerm) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    const btnContainer = document.createElement("div");
    btnContainer.className = "pc-modal-actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-outline-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => {
      document.body.removeChild(backdrop);
    });

    const applyBtn = document.createElement("button");
    applyBtn.className = "btn btn-primary";
    applyBtn.textContent = "Apply";
    applyBtn.addEventListener("click", () => {
      const newTerm = parseInt(select.value);
      CONFIG.roiTerm = newTerm;
      console.log(`[ParallelCoordinates] ROI Term updated to ${newTerm} years`);
      refresh();
      document.body.removeChild(backdrop);
    });

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(applyBtn);

    modal.appendChild(header);
    modal.appendChild(label);
    modal.appendChild(select);
    modal.appendChild(btnContainer);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    backdrop.addEventListener("click", e => {
      if (e.target === backdrop) {
        document.body.removeChild(backdrop);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // DATA MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Fetch current data from StateManager via pcConfig
   */
  function fetchData() {
    console.log("[ParallelCoordinates] Fetching data from StateManager");

    if (!window.TEUI.getParallelCoordinatesData) {
      console.error("[ParallelCoordinates] Config module not loaded");
      return null;
    }

    const data = window.TEUI.getParallelCoordinatesData();

    if (!data || !data.axes || data.axes.length === 0) {
      console.warn("[ParallelCoordinates] No valid data available");
      return null;
    }

    console.log(
      "[ParallelCoordinates] Fetched data for",
      data.axes.length,
      "axes"
    );
    return data;
  }

  // ══════════════════════════════════════════════════════════════════════
  // UTILITY FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Show feedback message in S18 console
   */
  function showFeedback(message, duration = 5000) {
    const console = document.getElementById("s18-feedback-console");
    if (!console) return;

    console.textContent = message;
    console.style.opacity = "1";

    setTimeout(() => {
      console.style.transition = "opacity 1s";
      console.style.opacity = "0";
      setTimeout(() => {
        console.textContent = "";
        console.style.opacity = "1";
        console.style.transition = "";
      }, 1000);
    }, duration);
  }

  /**
   * Show error message
   */
  function showErrorMessage(message) {
    const container = document.querySelector(CONFIG.containerSelector);
    if (!container) return;

    const errorDiv = document.createElement("div");
    errorDiv.className = "alert alert-warning";
    errorDiv.style.margin = "20px";
    errorDiv.innerHTML = `<strong>Warning:</strong> ${message}`;

    container.innerHTML = "";
    container.appendChild(errorDiv);
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDERING - Delegates to pcRendering.js module
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Main refresh function
   */
  function refresh() {
    console.log("[ParallelCoordinates] Refreshing visualization");

    currentData = fetchData();

    if (!currentData) {
      console.warn("[ParallelCoordinates] Cannot render - no data available");
      showErrorMessage(
        "No data available. Please ensure all required fields are calculated."
      );
      return;
    }

    // Delegate to rendering module
    if (!window.TEUI.PCRendering) {
      console.error("[ParallelCoordinates] Rendering module not loaded");
      return;
    }

    window.TEUI.PCRendering.renderGraph(currentData, CONFIG);
    window.TEUI.PCRendering.renderTable(currentData, CONFIG);
  }

  // ══════════════════════════════════════════════════════════════════════
  // EXPORT & FULLSCREEN
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Toggle fullscreen mode
   */
  function toggleFullscreen() {
    const section = document.getElementById("parallelCoordinates");
    if (!section) return;

    isFullscreen = !isFullscreen;
    section.classList.toggle("pc-fullscreen", isFullscreen);

    // Reset rendering cache and re-render
    window.TEUI.PCRendering?.resetCache();
    setTimeout(refresh, 100);

    console.log("[ParallelCoordinates] Fullscreen:", isFullscreen);
  }

  /**
   * Export visualization as PNG
   */
  function exportToPNG() {
    console.log("[ParallelCoordinates] Exporting to PNG...");

    const svgNode = document.querySelector(CONFIG.containerSelector + " svg");
    if (!svgNode) {
      alert("No graph to export");
      return;
    }

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgNode);

    const canvas = document.createElement("canvas");
    const bbox = svgNode.getBoundingClientRect();
    canvas.width = bbox.width;
    canvas.height = bbox.height;

    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = function () {
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(function (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "parallel-coordinates-optimization.png";
        a.click();
        URL.revokeObjectURL(url);
        console.log("[ParallelCoordinates] PNG export complete");
      });
    };

    img.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(svgString)));
  }

  // ══════════════════════════════════════════════════════════════════════
  // ACTION HANDLERS - Delegates to pcOptimization.js module
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Restore Baseline handler
   */
  function handleRestoreBaseline() {
    console.log("[ParallelCoordinates] Restore Baseline action triggered");

    if (window.TEUI?.StateManager?.resetTier1_UndoChanges) {
      window.TEUI.StateManager.resetTier1_UndoChanges();
      showFeedback("Baseline restored - reverted to imported data", 3000);

      setTimeout(() => {
        refresh();
        console.log(
          "[ParallelCoordinates] Graph auto-refreshed after baseline restore"
        );
      }, 200);
    } else {
      console.error(
        "[ParallelCoordinates] StateManager.resetTier1_UndoChanges not found"
      );
      showFeedback("Error: Reset function not available", 3000);
    }
  }

  /**
   * Decarbonize handler - delegates to pcOptimization module
   */
  function handleDecarbonize() {
    if (!window.TEUI.PCOptimization) {
      console.error("[ParallelCoordinates] Optimization module not loaded");
      return;
    }
    window.TEUI.PCOptimization.handleDecarbonize(showFeedback, refresh);
  }

  /**
   * Optimize handler - delegates to pcOptimization module
   */
  function handleOptimize() {
    if (!window.TEUI.PCOptimization) {
      console.error("[ParallelCoordinates] Optimization module not loaded");
      return;
    }
    window.TEUI.PCOptimization.handleOptimize(showFeedback, refresh);
  }

  /**
   * Super Optimize handler - delegates to pcOptimization module
   */
  function handleSuperOptimize() {
    if (!window.TEUI.PCOptimization) {
      console.error("[ParallelCoordinates] Optimization module not loaded");
      return;
    }
    window.TEUI.PCOptimization.handleSuperOptimize(showFeedback, refresh);
  }

  /**
   * PassivHaus-ify handler - delegates to pcOptimization module
   */
  function handlePassivHausIfy() {
    if (!window.TEUI.PCOptimization) {
      console.error("[ParallelCoordinates] Optimization module not loaded");
      return;
    }
    window.TEUI.PCOptimization.handlePassivHausIfy(showFeedback, refresh);
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════════════

  return {
    initialize: initialize,
    refresh: refresh,
    activate: activateVisualization,
    isActivated: () => isActivated,
  };
})();

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.TEUI.ParallelCoordinates.initialize();
  });
} else {
  window.TEUI.ParallelCoordinates.initialize();
}

console.log("[ParallelCoordinates] Module loaded (Refactored Nov 30, 2025)");
