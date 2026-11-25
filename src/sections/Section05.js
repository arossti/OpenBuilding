/**
 * 4012-Section05.js
 * CO2e Emissions (Section 5) - Lifetime Emissions Intensity
 *
 */

// Ensure namespace exists
window.TEUI = window.TEUI || {};
window.TEUI.SectionModules = window.TEUI.SectionModules || {};

// Section 5: CO2e Emissions Module
window.TEUI.SectionModules.sect05 = (function () {
  // TargetState/ReferenceState/ModeManager removed — graph + SM is the single source of truth.

  function getModeValue(fieldId) {
    const isRef = window.TEUI.ReferenceToggle?.isReferenceMode();
    return window.TEUI.StateManager?.getValue(isRef ? `ref_${fieldId}` : fieldId);
  }

  function setModeValue(fieldId, value, source = "user-modified") {
    const isRef = window.TEUI.ReferenceToggle?.isReferenceMode();
    const key = isRef ? `ref_${fieldId}` : fieldId;
    if (window.TEUI.StateManager?.setValue) {
      window.TEUI.StateManager.setValue(key, value, source);
    }
  }

  window.TEUI.sect05 = window.TEUI.sect05 || {};

  //==========================================================================
  // FIELD DEFINITIONS AND LAYOUT
  //==========================================================================

  // Define rows with integrated field definitions
  const sectionRows = {
    // ALWAYS PUT UNIT SUBHEADER FIRST - this ensures it appears at the top of the section
    header: {
      id: "05-ID",
      rowId: "05-ID",
      label: "Emissions Units Header",
      cells: {
        c: { content: "C", classes: ["section-subheader"] },
        d: { content: "Metric Tons (MT)", classes: ["section-subheader"] },
        e: { content: "E", classes: ["section-subheader"] },
        f: { content: "F", classes: ["section-subheader"] },
        g: { content: "kgCO2e/m2/yr", classes: ["section-subheader"] },
        h: { content: "", classes: ["section-subheader", "spacer"] },
        i: {
          content: "kgCO2e/m2*Service Life",
          classes: ["section-subheader"],
        },
        j: { content: "J", classes: ["section-subheader"] },
        k: { content: "K", classes: ["section-subheader"] },
        l: { content: "L", classes: ["section-subheader"] },
        m: { content: "M", classes: ["section-subheader"] },
        n: { content: "N", classes: ["section-subheader"] },
      },
    },

    // Row 38: E.1.2 GHGI Operational (B6) Emissions/yr
    38: {
      id: "E.1.2",
      rowId: "E.1.2",
      label: "GHGI Operational (B6) Emissions/yr",
      cells: {
        c: { content: "GHGI Operational (B6) Emissions/yr", type: "label" },
        d: {
          fieldId: "d_38",
          semanticPath: "emissions.operational.total",
          type: "calculated",
          value: "0.00",
          section: "emissions",
          label: "GHGI Operational (B6) Emissions: MT CO2e/yr",
        },
        e: { content: "MT CO2e/yr" }, // Unit for d_38
        f: { content: "E.1.4", classes: ["label-prefix"] }, // Label for i_38 based on Excel G38 position
        g: {
          fieldId: "g_38", // Annual kgCO2e/m2 - This value should appear in this column per app screenshot
          semanticPath: "emissions.operational.intensity",
          type: "calculated",
          value: "0.00",
          section: "emissions",
          label: "GHGI Annual (B6) Intensity: kgCO2e/m²/yr",
        },
        h: { content: "" }, // Unit for g_38 removed, now spacer
        i: {
          fieldId: "i_38", // Lifetime kgCO2e/m2 (g_38 * h_13) - This value appears in Excel I38
          semanticPath: "emissions.operational.lifetime",
          type: "calculated",
          value: "0.00",
          section: "emissions",
          label: "GHGI Lifetime (B6) Intensity: kgCO2e/m²",
        },
        j: {
          // Changed from calculated field to static text label, matching Excel J38
          content: "(B6 Annual Emissions * Service Life)",
          classes: ["descriptive-text", "text-center"], // Added text-center for potential better fit
        },
        k: { content: "" }, // Previously "(Lifetime Emissions)", now covered by j_38 label
        l: { content: "", classes: ["spacer"] },
        m: {
          fieldId: "m_38",
          semanticPath: "emissions.operational.complianceRatio",
          type: "calculated",
          value: "N/A",
          section: "emissions",
          dependencies: [], // Currently returns hardcoded "N/A" or "100%"
          label: "Operational (B6) Compliance: %",
        },
        n: {
          fieldId: "n_38",
          semanticPath: "emissions.operational.complianceStatus",
          type: "calculated",
          value: "✓",
          section: "emissions",
          dependencies: ["m_38"],
          label: "Operational Compliance Status",
        },
      },
    },

    // Row 39: E.3.1 Typology-Based Carbon Intensity (A1-3)
    39: {
      id: "E.3.1",
      rowId: "E.3.1",
      label: "Typology-Based Carbon Intensity (A1-3)",
      cells: {
        c: { content: "Typology-Based Carbon Intensity (A1-3)", type: "label" },
        d: {
          fieldId: "d_39",
          semanticPath: "emissions.typology",
          type: "dropdown",
          dropdownId: "dd_d_39",
          label: "Typology Selection",
          value: "Pt.3 Mass Timber",
          section: "emissions",
          tooltip: true, // Building Typology
          options: [
            { value: "Pt.9 Res. Stick Frame", name: "Pt.9 Res. Stick Frame" },
            { value: "Pt.9 Small Mass Timber", name: "Pt.9 Small Mass Timber" },
            { value: "Pt.3 Mass Timber", name: "Pt.3 Mass Timber" },
            { value: "Pt.3 Concrete", name: "Pt.3 Concrete" },
            { value: "Pt.3 Steel", name: "Pt.3 Steel" },
            { value: "Pt.3 Office", name: "Pt.3 Office" },
            { value: "Modelled Value", name: "Modelled Value" },
          ],
        },
        e: { content: "", classes: ["spacer"] }, // Spacer
        f: { content: "E.3.2", classes: ["label-prefix"] },
        g: { content: "Typology-Based Cap", classes: ["label-main"] },
        h: { content: "", classes: ["spacer"] }, // Spacer for alignment before value in col I
        i: {
          fieldId: "i_39", // Value displayed in Column I
          semanticPath: "emissions.typologyCap",
          type: "calculated",
          value: "350.00",
          section: "emissions",
          dependencies: ["d_39"],
          conditionalDeps: ["i_41"], // Only read when d_39="Modelled Value"
          label: "Typology-Based Cap (A1-3): kgCO2e/m²",
        },
        j: { content: "" }, // Unit for i_39 removed, now spacer
        k: { content: "", classes: ["spacer"] }, // Spacer
        l: { content: "", classes: ["spacer"] },
        m: {
          fieldId: "m_39",
          semanticPath: "emissions.typology.complianceRatio",
          type: "calculated",
          value: "N/A",
          section: "emissions",
          dependencies: ["i_39", "ref_i_39"], // Target / Reference ratio
          label: "Typology (A1-3) Compliance: %",
        },
        n: {
          fieldId: "n_39",
          semanticPath: "emissions.typology.complianceStatus",
          type: "calculated",
          value: "✓",
          section: "emissions",
          dependencies: ["m_39"],
          label: "Typology Compliance Status",
        },
      },
    },

    // Row 40: E.3.3 Total Embedded Carbon Emitted (A1-3)
    40: {
      id: "E.3.3",
      rowId: "E.3.3",
      label: "Total Embedded Carbon Emitted (A1-3)",
      cells: {
        c: { content: "Total Embedded Carbon Emitted (A1-3)", type: "label" },
        d: {
          fieldId: "d_40",
          semanticPath: "emissions.embodied.total",
          type: "calculated",
          value: "0.00",
          section: "emissions",
          dependencies: ["i_41", "d_106"],
          label: "Total Embedded Carbon (A1-3): MT CO2e",
        },
        e: { content: "MT CO2e/Service Life" },
        f: { content: "S.4", classes: ["label-prefix"] },
        g: { content: "Embodied Carbon Target", classes: ["label-main"] },
        h: { content: "", classes: ["spacer"] },
        i: {
          fieldId: "i_40", // Value displayed in Column I
          semanticPath: "emissions.embodied.target",
          type: "calculated",
          value: "0.00",
          section: "emissions",
          dependencies: ["d_16"],
          label: "Embodied Carbon Target (A1-3): kgCO2e/m²",
        },
        j: { content: "" }, // Unit for i_40 removed, now spacer
        k: { content: "", classes: ["spacer"] },
        l: { content: "", classes: ["spacer"] },
        m: {
          fieldId: "m_40",
          semanticPath: "emissions.embodied.complianceRatio",
          type: "calculated",
          value: "N/A",
          section: "emissions",
          dependencies: ["d_40", "ref_d_40"], // Target / Reference ratio
          label: "Embedded (A1-3) Compliance: %",
        },
        n: {
          fieldId: "n_40",
          semanticPath: "emissions.embodied.complianceStatus",
          type: "calculated",
          value: "✓",
          section: "emissions",
          dependencies: ["m_40"],
          label: "Embedded Compliance Status",
        },
      },
    },

    // Row 41: E.1.3 Lifetime Avoided (B6) Emissions
    41: {
      id: "E.1.3",
      rowId: "E.1.3",
      label: "Lifetime Avoided (B6) Emissions",
      cells: {
        c: { content: "Lifetime Avoided (B6) Emissions", type: "label" },
        d: {
          fieldId: "d_41",
          semanticPath: "emissions.avoided.lifetime",
          type: "calculated",
          value: "0.00",
          section: "emissions",
          dependencies: ["ref_d_38", "d_38", "h_13"], // ref_d_38 is a placeholder concept
          label: "Lifetime Avoided (B6) Emissions: MT CO2e",
        },
        e: { content: "MT CO2e" },
        f: { content: "E.3.4", classes: ["label-prefix"] },
        g: { content: "Modelled Value (A1-3)", classes: ["label-main"] },
        h: { content: "", classes: ["spacer"] },
        i: {
          fieldId: "i_41",
          semanticPath: "emissions.embodied.modelledValue",
          type: "editable", // Target: user-editable, Reference: calculated (ghosted)
          value: "345.82",
          section: "emissions",
          classes: ["user-input"],
          tooltip: true, // Externally Defined Value
          label: "User Modelled Embodied Carbon (A1-3): kgCO2e/m²",
          // ✅ IMPLEMENTED (Oct 1, 2025): Reference mode i_41 = i_39 (typology-based cap)
          // Target mode: User-defined modelled value (345.82 default)
          // Reference mode: Calculated from typology (Steel/Mass Timber/Concrete)
          // Field automatically ghosts in Reference mode (updateCalculatedDisplayValues)
        },
        l: { content: "", classes: ["spacer"] },
        m: {
          fieldId: "m_41",
          semanticPath: "emissions.modelled.complianceRatio",
          type: "calculated",
          value: "N/A",
          section: "emissions",
          dependencies: ["i_41", "ref_i_41"], // Target / Reference ratio
          label: "Modelled (A1-3) Compliance: %",
        },
        n: {
          fieldId: "n_41",
          semanticPath: "emissions.modelled.complianceStatus",
          type: "calculated",
          value: "✓",
          section: "emissions",
          dependencies: ["m_41"],
          label: "Modelled Compliance Status",
        },
      },
    },
  };

  //==========================================================================
  // EVENT HANDLING AND CALCULATIONS
  //==========================================================================

  //==========================================================================
  // LAYOUT GENERATION (Essential for Rendering)
  //==========================================================================

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

        // Remove field-specific properties that aren't needed for rendering
        delete cell.getOptions;
        delete cell.section;
        delete cell.dependencies;

        rowDef.cells.push(cell);
      } else {
        // Add empty cell if not defined
        rowDef.cells.push({});
      }
    });

    return rowDef;
  }

  //==========================================================================
  // FIELD MANAGER INTEGRATION (Essential for FieldManager)
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
            label: cell.label || cell.content || row.label,
            defaultValue: cell.value || "",
            section: cell.section || "emissions",
          };

          // Copy additional field properties if they exist
          if (cell.semanticPath)
            fields[cell.fieldId].semanticPath = cell.semanticPath; // Phase 5: Include semantic path
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

  //==========================================================================
  // DUAL-ENGINE CALCULATIONS (Clean Pattern A)
  //==========================================================================

  //==========================================================================
  // EVENT HANDLERS
  //==========================================================================

  /**
   * Initialize all event handlers for this section
   */
  function initializeEventHandlers() {
    // 1. Event handler for the Typology dropdown
    const typologyDropdown = document.querySelector(
      '[data-field-id="d_39"], [data-dropdown-id="dd_d_39"]'
    );
    if (typologyDropdown) {
      typologyDropdown.addEventListener("change", e => {
        const typology = e.target.value;
        setModeValue("d_39", typology, "user-modified");
      });
    } else {
      console.warn(
        `⚠️ [S05] Typology dropdown not found! Selector: [data-field-id="d_39"], [data-dropdown-id="dd_d_39"]`
      );
    }

    // 2. Event handlers for editable fields
    const editableFields = ["i_41"];
    editableFields.forEach(fieldId => {
      const field = document.querySelector(`[data-field-id="${fieldId}"]`);
      if (field && !field.hasEditableListeners) {
        // ✅ CRITICAL: Prevent newlines on Enter key (copy from S04/S08/S09 pattern)
        field.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            e.preventDefault(); // Prevent adding a newline
            field.blur(); // Remove focus to trigger the blur event
          }
        });

        field.addEventListener("blur", () => {
          const newValue = field.textContent.trim();
          // ✅ CLEAN: Update via setModeValue
          setModeValue(fieldId, newValue, "user-modified");
        });
        field.hasEditableListeners = true;
      }
    });

    // 3. Domain-logic StateManager listeners
    if (window.TEUI.StateManager) {
      // Graph handles cross-section computation via wildcard listener.
      // Only keep domain-logic side effects (carbon target auto-set).

      // S05→S02 RELATIONSHIP: Listen for Carbon Standard changes and update d_16
      const updateCarbonTarget = fieldId => {
        const isReference = fieldId === "ref_d_15";
        const d_15_value = window.TEUI.StateManager.getValue(fieldId);
        let d_16_value;

        // TGS4 Tier 2/3: adopted caps by occupancy category
        if (d_15_value === "TGS4 Tier 2" || d_15_value === "TGS4 Tier 3") {
          const occField = isReference ? "ref_d_12" : "d_12";
          const storField = isReference ? "ref_d_16_storeys" : "d_16_storeys";
          const occupancy = window.TEUI.StateManager.getValue(occField) || "A-Assembly";
          const storeys = parseFloat(window.TEUI.StateManager.getValue(storField) || "2") || 2;
          const category = window.TEUI.ComputationNodes.BuildingInfo.getTGS4Category(occupancy, storeys);
          const cap = window.TEUI.ComputationNodes.BuildingInfo.TGS4_CAPS[category]?.[d_15_value];
          d_16_value = cap ?? "N/A";
        } else if (d_15_value === "TGS4") {
          // "Typical Values": backward compat, let Section02 handle via i_39 typology path
          return;
        } else {
          // All other standards: use CARBON_TARGETS lookup
          const fixedTarget = window.TEUI.ComputationNodes.BuildingInfo.CARBON_TARGETS[d_15_value];
          if (fixedTarget !== null && fixedTarget !== undefined) {
            d_16_value = fixedTarget;
          } else if (d_15_value === "Self Reported") {
            d_16_value = window.TEUI.StateManager.getValue(isReference ? "ref_i_41" : "i_41");
          } else {
            d_16_value = "N/A";
          }
        }

        // Update S02's d_16 field
        const targetField = isReference ? "ref_d_16" : "d_16";
        window.TEUI.StateManager.setValue(
          targetField,
          d_16_value,
          "calculated"
        );
        console.log(
          `[S05→S02] Updated ${targetField} = ${d_16_value} based on ${fieldId} = ${d_15_value}`
        );
      };

      // d_15/ref_d_15 listeners removed — the graph's EmissionsNodes
      // handles embodied carbon target (d_16/ref_d_16) computation.
    }
  }

  /**
   * Called when the section is rendered
   * This is a good place to initialize values and run initial calculations
   */
  function onSectionRendered() {
    // console.log("S05: Pattern A initialization starting...");

    // Initialize event handlers
    initializeEventHandlers();

    // 7. Apply validation tooltips to fields
    if (window.TEUI.TooltipManager && window.TEUI.TooltipManager.initialized) {
      setTimeout(() => {
        window.TEUI.TooltipManager.applyTooltipsToSection(sectionRows);
      }, 300);
    }

    // console.log("S05: Pattern A initialization complete.");
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
