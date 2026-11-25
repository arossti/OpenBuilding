/**
 * 4012-Section14.js
 * TEDI & TELI (Section 14) module for TEUI Calculator 4.011 (this file shows as uncommitted, but it works betetr than the committed one so commit THIS to over-write the committed one)
 *
 * This file contains field definitions, layout templates, and rendering logic
 * specific to the TEDI & TELI section.
 *
 * Follows the consolidated declarative approach where field definitions
 * are integrated directly into the layout structure.
 */

// Ensure namespace exists
window.TEUI = window.TEUI || {};
window.TEUI.SectionModules = window.TEUI.SectionModules || {};

// Section 14: TEDI & TELI Module
window.TEUI.SectionModules.sect14 = (function () {
  // TargetState/ReferenceState/ModeManager removed — graph + SM is the single source of truth.

  window.TEUI.sect14 = window.TEUI.sect14 || {};

  //==========================================================================
  // CONSOLIDATED FIELD DEFINITIONS AND LAYOUT (Update Defaults)
  //==========================================================================

  // Define rows with integrated field definitions
  const sectionRows = {
    // SECTION HEADER
    header: {
      id: "14-ID",
      rowId: "14-ID",
      label: "TEDI & TELI Units",
      cells: {
        c: {
          content: "SECTION 14. TEDI & TELI Targeted",
          classes: ["section-header"],
        },
        d: { content: "kWh/yr", classes: ["section-subheader", "text-center"] },
        e: { content: "E", classes: ["section-subheader"] },
        f: { content: "F", classes: ["section-subheader"] },
        g: { content: "G", classes: ["section-subheader"] },
        h: {
          content: "kWh/m²/yr",
          classes: ["section-subheader", "text-center"],
        },
        i: { content: "I", classes: ["section-subheader"] },
        j: { content: "J", classes: ["section-subheader"] },
        k: { content: "K", classes: ["section-subheader"] },
        l: { content: "L", classes: ["section-subheader"] },
        m: { content: "kWh/yr", classes: ["section-subheader", "text-center"] },
        n: { content: "N", classes: ["section-subheader"] },
      },
    },

    // Row 127: T.4.0 TED Targeted / T.4.1 TEDI
    127: {
      id: "T.4.0",
      rowId: "127",
      label: "TED Targeted",
      cells: {
        c: { label: "TED Targeted" },
        d: {
          fieldId: "d_127",
          semanticPath: "tediSummary.ted.targeted",
          type: "calculated",
          value: "0.00",
          label: "TED Targeted: kWh/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        e: { content: "" },
        f: {
          content: "T.4.1",
          classes: ["label-prefix", "text-right", "no-wrap"],
        },
        g: { content: "TEDI", classes: ["label-main", "text-left", "no-wrap"] },
        h: {
          fieldId: "h_127",
          semanticPath: "tediSummary.tedi.targeted",
          type: "calculated",
          value: "0.00",
          label: "TEDI: kWh/m²/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        i: { content: "" },
        j: { content: "" },
        k: {
          content: "T.4.1 Includes V.5 Net Vent'l. & T.7.3 CEDI Ae Losses",
          classes: ["label-prefix", "text-left", "no-wrap"],
        },
        l: { content: "" },
        m: { content: "" },
        n: { content: "" },
      },
    },

    // Row 128: T.4.2 TED Envelope / T.4.3 TEDI (Excludes Ventilation)
    128: {
      id: "T.4.2",
      rowId: "128",
      label: "TED Envelope (Excludes Ventilation)",
      cells: {
        c: { label: "TED Envelope (Excludes Ventilation)" },
        d: {
          fieldId: "d_128",
          semanticPath: "tediSummary.ted.envelope",
          type: "calculated",
          value: "0.00",
          label: "TED Envelope (Excludes Ventilation): kWh/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        e: { content: "" },
        f: {
          content: "T.4.3",
          classes: ["label-prefix", "text-right", "no-wrap"],
        },
        g: {
          content: "TEDI (Excludes Ventilation)",
          classes: ["label-main", "text-left", "no-wrap"],
        },
        h: {
          fieldId: "h_128",
          semanticPath: "tediSummary.tedi.envelope",
          type: "calculated",
          value: "0.00",
          label: "TEDI (Excludes Ventilation): kWh/m²/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        i: { content: "" },
        j: { content: "" },
        k: { content: "" },
        l: { content: "" },
        m: { content: "" },
        n: { content: "" },
      },
    },

    // Row 129: T.4.4 CED Cooling Load Unmitigated / T.4.5 CEDI Unmitigated
    129: {
      id: "T.4.4",
      rowId: "129",
      label: "CED Cooling Load Unmitigated",
      cells: {
        c: { label: "CED Cooling Load Unmitigated" },
        d: {
          fieldId: "d_129",
          semanticPath: "tediSummary.ced.unmitigated",
          type: "calculated",
          value: "0.00",
          label: "CED Cooling Load Unmitigated: kWh/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        e: { content: "" },
        f: {
          content: "T.4.5",
          classes: ["label-prefix", "text-right", "no-wrap"],
        },
        g: {
          content: "CEDI Unmitigated",
          classes: ["label-main", "text-left", "no-wrap"],
        },
        h: {
          fieldId: "h_129",
          semanticPath: "tediSummary.cedi.unmitigated",
          type: "calculated",
          value: "0.00",
          label: "CEDI Unmitigated: kWh/m²/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        i: { content: "" },
        j: {
          content: "T.5.2",
          classes: ["label-prefix", "text-left", "no-wrap"],
        },
        k: {
          content: "less Free Cool. & Vent. Exhaust",
          classes: ["label-prefix", "text-left", "no-wrap"],
        },
        l: { content: "" },
        m: {
          fieldId: "m_129",
          semanticPath: "energy.ced.mitigated",
          type: "calculated",
          value: "0.00",
          label: "CED Mitigated: kWh/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        n: { content: "" },
      },
    },

    // Row 130: T.4.6 CEDI Cooling Load (W/m2) / T.4.7 CEDI Mitigated (W/m2)
    130: {
      id: "T.4.6",
      rowId: "130",
      label: "CEDI Cooling Load",
      cells: {
        c: { label: "CEDI Cooling Load" },
        d: {
          fieldId: "d_130",
          semanticPath: "tediSummary.cedi.loadUnmitigated",
          type: "calculated",
          value: "0.00",
          label: "CEDI Cooling Load Unmitigated: W/m²",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        e: { content: "W/m²", classes: ["unit-text"] },
        f: {
          content: "T.4.7",
          classes: ["label-prefix", "text-right", "no-wrap"],
        },
        g: {
          content: "CEDI Mitigated",
          classes: ["label-main", "text-left", "no-wrap"],
        },
        h: {
          fieldId: "h_130",
          semanticPath: "tediSummary.cedi.mitigated",
          type: "calculated",
          value: "0.00",
          label: "CEDI Mitigated: W/m²",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        i: { content: "W/m²", classes: ["unit-text"] },
        j: { content: "" },
        k: { content: "" },
        l: { content: "" },
        m: { content: "" },
        n: { content: "" },
      },
    },

    // Row 131: T.5.1 TEL Total Envelope Heatloss / T.5.2 TELI
    131: {
      id: "T.5.1",
      rowId: "131",
      label: "TEL Total Envelope Heatloss",
      cells: {
        c: { label: "TEL Total Envelope Heatloss" },
        d: {
          fieldId: "d_131",
          semanticPath: "tediSummary.tel.total",
          type: "calculated",
          value: "0.00",
          label: "TEL Total Envelope Heatloss: kWh/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        e: { content: "" },
        f: {
          content: "T.5.2",
          classes: ["label-prefix", "text-right", "no-wrap"],
        },
        g: { content: "TELI", classes: ["label-main", "text-left", "no-wrap"] },
        h: {
          fieldId: "h_131",
          semanticPath: "tediSummary.teli.value",
          type: "calculated",
          value: "0.00",
          label: "TELI: kWh/m²/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        i: { content: "" },
        j: {
          content: "T.5.2",
          classes: ["label-prefix", "text-left", "no-wrap"],
        },
        k: {
          content: "TELI/TEDI Ratio (used for costs)",
          classes: ["label-main", "text-left", "no-wrap"],
        },
        l: { content: "" },
        m: {
          fieldId: "m_131",
          semanticPath: "tediSummary.teliTediRatio",
          type: "calculated",
          value: "0.00",
          label: "TELI/TEDI Ratio",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        n: { content: "" },
      },
    },

    // Row 132: T.5.3 CEG Cooling Envelope Heatgain / T.5.4 CEGI
    132: {
      id: "T.5.3",
      rowId: "132",
      label: "CEG Cooling Envelope Heatgain",
      cells: {
        c: { label: "CEG Cooling Envelope Heatgain" },
        d: {
          fieldId: "d_132",
          semanticPath: "tediSummary.ceg.total",
          type: "calculated",
          value: "0.00",
          label: "CEG Cooling Envelope Heatgain: kWh/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        e: { content: "" },
        f: {
          content: "T.5.4",
          classes: ["label-prefix", "text-right", "no-wrap"],
        },
        g: { content: "CEGI", classes: ["label-main", "text-left", "no-wrap"] },
        h: {
          fieldId: "h_132",
          semanticPath: "tediSummary.cegi.value",
          type: "calculated",
          value: "0.00",
          label: "CEGI: kWh/m²/yr",
          classes: ["calculated-value"],
          section: "tediSummary",
        },
        i: { content: "" },
        j: { content: "" },
        k: { content: "" },
        l: { content: "" },
        m: { content: "" },
        n: { content: "" },
      },
    },
  };

  //==========================================================================
  // ACCESSOR METHODS TO EXTRACT FIELDS AND LAYOUT (Unchanged)
  //==========================================================================

  /**
   * Extract field definitions from the integrated layout
   * This method is required for compatibility with the FieldManager
   */
  function getFields() {
    const fields = {};

    // Extract field definitions from all rows except the header
    Object.entries(sectionRows).forEach(([rowKey, row]) => {
      if (rowKey === "header") return; // Skip the header row
      if (!row.cells) return;

      // Process each cell in the row
      Object.entries(row.cells).forEach(([colKey, cell]) => {
        if (cell.fieldId && cell.type) {
          // Create field definition with all relevant properties
          fields[cell.fieldId] = {
            type: cell.type,
            label: cell.label || row.label,
            defaultValue: cell.value || "",
            section: cell.section || "tediSummary",
            semanticPath: cell.semanticPath || null, // Phase 5: Include semantic path
          };

          // Copy additional field properties if they exist
          if (cell.dropdownId)
            fields[cell.fieldId].dropdownId = cell.dropdownId;
          if (cell.options) fields[cell.fieldId].options = cell.options;
          if (cell.getOptions)
            fields[cell.fieldId].getOptions = cell.getOptions;
          if (cell.dependencies)
            fields[cell.fieldId].dependencies = cell.dependencies;
          if (cell.min !== undefined) fields[cell.fieldId].min = cell.min;
          if (cell.max !== undefined) fields[cell.fieldId].max = cell.max;
          if (cell.step !== undefined) fields[cell.fieldId].step = cell.step;
        }
      });
    });

    return fields;
  }

  /**
   * Extract dropdown options from the integrated layout
   * Required for backward compatibility
   */
  function getDropdownOptions() {
    const options = {};

    // Extract dropdown options from all cells with dropdownId
    Object.values(sectionRows).forEach(row => {
      if (!row.cells) return;

      Object.values(row.cells).forEach(cell => {
        if (cell.dropdownId && cell.options) {
          options[cell.dropdownId] = cell.options;
        }
      });
    });

    return options;
  }

  /**
   * Generate layout from integrated row definitions
   * This converts our compact definition to the format expected by the renderer
   */
  function getLayout() {
    // IMPORTANT: To ensure the header appears first, we process the rows in
    // a specific order: header first, then all other rows

    // Start with an empty array for rows
    const layoutRows = [];

    // First add the header row if it exists
    if (sectionRows["header"]) {
      layoutRows.push(createLayoutRow(sectionRows["header"]));
    }

    // Then add all other rows in their original order, excluding the header
    Object.entries(sectionRows).forEach(([key, row]) => {
      if (key !== "header") {
        layoutRows.push(createLayoutRow(row));
      }
    });

    return { rows: layoutRows };
  }

  /**
   * Helper function to convert a row definition to the layout format
   * This function handles the conversion of column C cells for proper row labels
   */
  function createLayoutRow(row) {
    // Create standard row structure
    const rowDef = {
      id: row.id,
      cells: [
        {}, // Empty column A
        {}, // ID column B (auto-populated)
      ],
    };

    // Add cells C through N based on the row definition
    const columns = [
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "k",
      "l",
      "m",
      "n",
    ];

    // For each column, add the cell definition if it exists in the row
    columns.forEach(col => {
      if (row.cells && row.cells[col]) {
        // Create a simplified cell definition for the renderer
        // without the extra field properties
        const cell = { ...row.cells[col] };

        // Special handling for column C to support both label patterns
        if (col === "c") {
          // If using content+type pattern, convert to label pattern
          if (cell.type === "label" && cell.content && !cell.label) {
            cell.label = cell.content;
            delete cell.type; // Not needed for rendering
            delete cell.content; // Not needed once we have label
          }
          // If neither label nor content exists, use row's label as fallback
          else if (!cell.label && !cell.content && row.label) {
            cell.label = row.label;
          }
        }

        // Remove field-specific properties that aren't needed for rendering
        delete cell.getOptions;
        delete cell.section;
        delete cell.dependencies; // Renderer doesn't need these

        rowDef.cells.push(cell);
      } else {
        // Add empty cell if not defined
        // Special handling for column C - use row's label if available
        if (col === "c" && !row.cells?.c && row.label) {
          rowDef.cells.push({ label: row.label });
        } else {
          // Otherwise add empty cell
          rowDef.cells.push({});
        }
      }
    });

    return rowDef;
  }

  /**
   * Register all field dependencies with the StateManager
   */
  function registerDependencies() {
    /* graph computes */
  }

  //==========================================================================
  // EVENT HANDLING AND INITIALIZATION
  //==========================================================================

  /**
   * Initialize event handlers for this section
   * Sets up listeners for changes in dependency values from other sections.
   */
  function initializeEventHandlers() {
    if (!window.TEUI.StateManager) return;
    const sm = window.TEUI.StateManager;

    // All computational SM listeners removed — graph handles dependency tracking
  }

  /**
   * Called when section is rendered
   */
  function onSectionRendered() {
    console.log("S14: Section rendered.");

    // Initialize event handlers
    initializeEventHandlers();

    console.log("S14: Initialization complete.");
  }

  //==========================================================================
  // PUBLIC API
  //==========================================================================

  return {
    // Field definitions and layout - REQUIRED
    getFields: getFields,
    getDropdownOptions: getDropdownOptions,
    getLayout: getLayout,

    // Event handling and initialization - REQUIRED
    initializeEventHandlers: initializeEventHandlers,
    onSectionRendered: onSectionRendered,
  };
})();

// Event listeners removed in ORDERING branch

// Add an initialized flag to prevent multiple runs
if (
  window.TEUI &&
  window.TEUI.SectionModules &&
  window.TEUI.SectionModules.sect14
) {
  window.TEUI.SectionModules.sect14.initialized = false;
}
