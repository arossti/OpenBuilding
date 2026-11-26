/**
 * 4012-Section06.js
 * Renewable Energy (Section 6) - Onsite/Offsite Energy Sources
 */

// Ensure namespace exists
window.TEUI = window.TEUI || {};
window.TEUI.SectionModules = window.TEUI.SectionModules || {};

// Section 6: Renewable Energy Module
window.TEUI.SectionModules.sect06 = (function () {
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

  window.TEUI.sect06 = window.TEUI.sect06 || {};

  //==========================================================================
  // FIELD DEFINITIONS AND LAYOUT
  //==========================================================================

  const sectionRows = {
    header: {
      id: "06-ID",
      rowId: "06-ID",
      label: "Renewable Energy Units",
      cells: {
        c: { content: "C", classes: ["section-subheader"] },
        d: { content: "kWh/yr", classes: ["section-subheader"] },
        e: { content: "E", classes: ["section-subheader"] },
        f: { content: "F", classes: ["section-subheader"] },
        g: { content: "G", classes: ["section-subheader"] },
        h: { content: "H", classes: ["section-subheader"] },
        i: { content: "kWh/yr", classes: ["section-subheader"] },
        j: { content: "J", classes: ["section-subheader"] },
        k: { content: "K", classes: ["section-subheader"] },
        l: { content: "L", classes: ["section-subheader"] },
        m: { content: "kWh/yr", classes: ["section-subheader"] },
        n: { content: "N", classes: ["section-subheader"] },
      },
    },
    43: {
      id: "R.1",
      rowId: "R.1",
      label: "Onsite Energy Subtotals",
      cells: {
        c: { label: "Onsite Energy Subtotals" },
        d: {
          fieldId: "d_43",
          semanticPath: "renewable.onsiteTotal",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_44", "d_45", "d_46", "i_46"],
          label: "Onsite Energy Subtotal: kWh/yr",
        },
        f: { content: "R.5", classes: ["label-prefix"] },
        g: { content: "Offsite Renewable (REC)", classes: ["label-main"] },
        h: {},
        i: {
          fieldId: "i_43",
          semanticPath: "renewable.offsiteTotal",
          type: "calculated",
          value: "0.00",
          dependencies: ["i_44", "i_46"],
          label: "Offsite Renewable (REC) Subtotal: kWh/yr",
        },
        j: { content: "P.5", classes: ["label-prefix"] },
        k: { content: "Exterior/Site/Other Loads", classes: ["label-main"] },
        m: {
          fieldId: "m_43",
          semanticPath: "renewable.exteriorLoads",
          type: "editable",
          value: "0.00",
          classes: ["user-input"],
          tooltip: true, // Default is 0
          label: "Exterior/Site/Other Loads: kWh/yr",
        },
      },
    },
    44: {
      id: "R.2",
      rowId: "R.2",
      label: "Photovoltaics",
      cells: {
        c: { label: "Photovoltaics" },
        d: {
          fieldId: "d_44",
          semanticPath: "renewable.pv",
          type: "editable",
          value: "0.00",
          classes: ["user-input"],
          tooltip: true, // Photovoltaics (no tooltip data available in TooltipManager)
          label: "Photovoltaics: kWh/yr",
        },
        f: { content: "R.6", classes: ["label-prefix"] },
        g: { content: "WWS Electricity", classes: ["label-main"] },
        h: {},
        i: {
          fieldId: "i_44",
          semanticPath: "renewable.wws",
          type: "editable",
          value: "0.00",
          classes: ["user-input"],
          tooltip: true, // WWS Electricity (no tooltip data available)
          label: "WWS Electricity (Offsite REC): kWh/yr",
        },
      },
    },
    45: {
      id: "R.3",
      rowId: "R.3",
      label: "Wind",
      cells: {
        c: { label: "Wind" },
        d: {
          fieldId: "d_45",
          semanticPath: "renewable.wind",
          type: "editable",
          value: "0.00",
          classes: ["user-input"],
          tooltip: true, // Wind (no tooltip data available)
          label: "Wind Energy: kWh/yr",
        },
        f: { content: "R.7", classes: ["label-prefix"] },
        g: { content: "Green Natural Gas", classes: ["label-main"] },
        h: {},
        i: {
          fieldId: "i_45",
          semanticPath: "renewable.greenGasEnergy",
          type: "calculated",
          value: "0.00",
          dependencies: ["k_45"],
          label: "Green Natural Gas (ekWh): kWh/yr",
        },
        j: { content: "ekWh/yr" },
        k: {
          fieldId: "k_45",
          semanticPath: "renewable.greenGas",
          type: "editable",
          value: "0.00",
          classes: ["user-input"],
          tooltip: true, // Green Natural Gas (no tooltip data available)
          label: "Green Natural Gas: m³",
        },
        l: { content: "m³" },
      },
    },
    46: {
      id: "R.4",
      rowId: "R.4",
      label: "Remove EV Charging from TEUI",
      cells: {
        c: { label: "Remove EV Charging from TEUI" },
        d: {
          fieldId: "d_46",
          semanticPath: "renewable.evRemoval",
          type: "editable",
          value: "0.00",
          classes: ["user-input"],
          tooltip: true, // Remove EV Charging (no tooltip data available)
          label: "Remove EV Charging from TEUI: kWh/yr",
        },
        f: { content: "R.8", classes: ["label-prefix"] },
        g: { content: "Reserved (other removals)", classes: ["label-main"] },
        h: {},
        i: {
          fieldId: "i_46",
          semanticPath: "renewable.reserved",
          type: "editable",
          value: "0.00",
          classes: ["user-input"],
          tooltip: true, // Reserved other removals (no tooltip data available)
          label: "Reserved Removals (Special Cases): kWh/yr",
        },
      },
    },
  };

  //==========================================================================
  // ACCESSOR METHODS (Standardized)
  //==========================================================================
  function getFields() {
    const fields = {};
    Object.values(sectionRows).forEach(row => {
      if (!row.cells) return;
      Object.values(row.cells).forEach(cell => {
        if (cell.fieldId) {
          fields[cell.fieldId] = {
            type: cell.type,
            label: cell.label || row.label,
            defaultValue: cell.value || "",
            section: "onSiteEnergy",
            semanticPath: cell.semanticPath || null, // Phase 5: Include semantic path for migration
          };
        }
      });
    });
    return fields;
  }

  function getDropdownOptions() {
    return {};
  }

  function getLayout() {
    const layoutRows = [];
    if (sectionRows["header"])
      layoutRows.push(createLayoutRow(sectionRows["header"]));
    Object.keys(sectionRows).forEach(key => {
      if (key !== "header") layoutRows.push(createLayoutRow(sectionRows[key]));
    });
    return { rows: layoutRows };
  }

  function createLayoutRow(row) {
    const rowDef = { id: row.id, cells: [{}, {}] };
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
    columns.forEach(col => {
      if (row.cells && row.cells[col]) {
        const cell = { ...row.cells[col] };
        if (col === "c" && !cell.label && row.label) cell.label = row.label;
        rowDef.cells.push(cell);
      } else {
        rowDef.cells.push({});
      }
    });
    return rowDef;
  }

  //==========================================================================
  // EVENT HANDLERS
  //==========================================================================

  /**
   * Initialize all event handlers for this section
   */
  function initializeEventHandlers() {
    // 1. Event handlers for editable fields (all renewable energy inputs)
    const editableFields = [
      "d_44", // Photovoltaics
      "d_45", // Wind
      "d_46", // Remove EV Charging
      "i_44", // WWS Electricity
      "i_46", // Reserved removals
      "k_45", // Green Natural Gas
      "m_43", // Exterior/Site loads
    ];

    editableFields.forEach(fieldId => {
      const field = document.querySelector(`[data-field-id="${fieldId}"]`);
      if (field && !field.hasEditableListeners) {
        // ✅ CRITICAL: Prevent newlines on Enter key (copy from S05 pattern)
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
  }

  /**
   * Called when the section is rendered
   * This is a good place to initialize values and run initial calculations
   */
  function onSectionRendered() {
    console.log("S06: Pattern A initialization starting...");

    // 1. Initialize event handlers
    initializeEventHandlers();

    // 7. Apply validation tooltips to fields
    if (window.TEUI.TooltipManager && window.TEUI.TooltipManager.initialized) {
      setTimeout(() => {
        window.TEUI.TooltipManager.applyTooltipsToSection(sectionRows);
      }, 300);
    }

    console.log("S06: Pattern A initialization complete.");
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
