/**
 * 4012-Section11.js
 * Refactored Transmission Losses (Section 11) module for TEUI Calculator 4.012
 */

// Ensure namespace exists
window.TEUI = window.TEUI || {};
window.TEUI.SectionModules = window.TEUI.SectionModules || {};

// Section 11: Transmission Losses Module
window.TEUI.SectionModules.sect11 = (function () {
  //==========================================================================
  // CONFIGURATION
  //==========================================================================

  //==========================================================================
  // ✅ S10-S11 AREA SYNC: Guard flags and state variables (CRASH PREVENTION)
  //==========================================================================
  let isS11Initialized = false; // Prevents sync before initialization completes
  let isSyncingFromS10 = false; // Prevents recursion in sync function
  let syncTimeout = null; // For debouncing rapid sync calls
  let isInitializationPhase = true; // ✅ FIX: Disable DUAL-STATE SYNC after initialization
  let isImportActive = false; // ✅ FIX: Allow DUAL-STATE SYNC during import (set by FileHandler)

  // componentTypes removed — graph handles all indicator calculations

  //==========================================================================
  // ✅ S10-S11 AREA SYNC: Field mapping (RESTORED from Sept 2025 removal)
  //==========================================================================
  const areaSourceMap = {
    d_88: "d_73", // S11 Doors → S10 Doors
    d_89: "d_74", // S11 Window North → S10 Window North
    d_90: "d_75", // S11 Window East → S10 Window East
    d_91: "d_76", // S11 Window South → S10 Window South
    d_92: "d_77", // S11 Window West → S10 Window West
    d_93: "d_78", // S11 Skylights → S10 Skylights
  };

  // componentConfig removed — graph handles all component row calculations

  // List of all editable fields in this section
  const editableFields = [
    "d_85",
    "f_85",
    "d_86",
    "f_86",
    "d_87",
    "f_87", // Air-facing RSI inputs
    "d_88", // Door area (now editable like row 85)
    "g_88",
    "d_89", // Window North area (now editable like row 85)
    "g_89",
    "d_90", // Window East area (now editable like row 85)
    "g_90",
    "d_91", // Window South area (now editable like row 85)
    "g_91",
    "d_92", // Window West area (now editable like row 85)
    "g_92",
    "d_93", // Skylight area (now editable like row 85)
    "g_93", // Window/Door U-value inputs
    "d_94",
    "f_94",
    "d_95",
    "f_95", // Ground-facing RSI inputs
    "d_96", // Interior Floor Area
    "d_97", // Thermal Bridge Penalty slider
  ];

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

  //==========================================================================
  // LAYOUT DEFINITION (sectionRows)
  //==========================================================================
  const sectionRows = {
    header: {
      id: "11-ID",
      rowId: "11-ID",
      label: "Transmission Losses Units",
      cells: {
        c: { content: "", classes: ["section-subheader"] },
        d: {
          content: "Areas (m²)",
          classes: ["section-subheader", "align-center"],
        },
        e: {
          content: "Rimp (ft²·°F·hr/Btu)",
          classes: ["section-subheader", "align-center"],
        },
        f: {
          content: "RSI (K·m²/W)",
          classes: ["section-subheader", "align-center"],
        },
        g: {
          content: "U-Value (W/m²·K)",
          classes: ["section-subheader", "align-center"],
        },
        h: {
          content: "% of Ae & Ag",
          classes: ["section-subheader", "align-center"],
        },
        i: {
          content: "Heatloss\n(kWh/heating)",
          classes: ["section-subheader", "align-center"],
        },
        j: {
          content: "Heatloss (%)",
          classes: ["section-subheader", "align-center"],
        },
        k: {
          content: "Heatgain\n(kWh/cooling)",
          classes: ["section-subheader", "align-center"],
        },
        l: {
          content: "Heatgain (%)",
          classes: ["section-subheader", "align-center"],
        },
        m: {
          content: "Reference",
          classes: ["section-subheader", "align-center"],
        }, // Updated label
        n: {
          content: "Status",
          classes: ["section-subheader", "align-center"],
        }, // Updated label
        o: {
          content: "Surface (°C)",
          classes: ["section-subheader", "align-center"],
        },
      },
    },
    85: {
      id: "B.4",
      rowId: "B.4",
      label: "Roof",
      cells: {
        c: { label: "Roof" },
        d: {
          fieldId: "d_85",
          semanticPath: "envelope.roof.area",
          type: "editable",
          value: "1411.52",
          label: "Roof: Area m²",
        },
        e: {
          fieldId: "e_85",
          semanticPath: "envelope.roof.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_85"],
          label: "Roof: R-Value Imperial",
        },
        f: {
          fieldId: "f_85",
          semanticPath: "envelope.roof.rsiValue",
          type: "editable",
          value: "9.35",
          label: "Roof: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_85",
          semanticPath: "envelope.roof.uValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_85"],
          label: "Roof: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_85",
          semanticPath: "envelope.roof.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_85", "d_101"],
          classes: ["text-air-facing"],
          label: "Roof: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_85",
          semanticPath: "envelope.roof.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_85", "d_20", "f_85"],
          label: "Roof: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_85",
          semanticPath: "envelope.roof.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_85", "i_98"],
          label: "Roof: Heat Loss %",
        },
        k: {
          fieldId: "k_85",
          semanticPath: "envelope.roof.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_85", "d_21", "f_85"],
          label: "Roof: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_85",
          semanticPath: "envelope.roof.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_85", "k_98"],
          label: "Roof: Heat Gain %",
        },
        m: {
          fieldId: "m_85",
          semanticPath: "envelope.roof.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["f_85", "t_85"],
          label: "Roof: Reference Compliance Ratio",
        },
        n: { fieldId: "n_85", semanticPath: "envelope.roof.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_85",
          semanticPath: "envelope.roof.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_85", "g_85", "h_23", "d_25"],
          label: "Roof: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    86: {
      id: "B.5",
      rowId: "B.5",
      label: "Walls Above Grade (less its hosted openings)",
      cells: {
        c: { label: "Walls Above Grade (less its hosted openings)" },
        d: {
          fieldId: "d_86",
          semanticPath: "envelope.wallsAbove.area",
          type: "editable",
          value: "705.27",
          label: "Walls Above Grade: Area m²",
        },
        e: {
          fieldId: "e_86",
          semanticPath: "envelope.wallsAbove.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_86"],
          label: "Walls Above Grade: R-Value Imperial",
        },
        f: {
          fieldId: "f_86",
          semanticPath: "envelope.wallsAbove.rsiValue",
          type: "editable",
          value: "6.69",
          label: "Walls Above Grade: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_86",
          semanticPath: "envelope.wallsAbove.uValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_86"],
          label: "Walls Above Grade: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_86",
          semanticPath: "envelope.wallsAbove.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_86", "d_101"],
          classes: ["text-air-facing"],
          label: "Walls Above Grade: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_86",
          semanticPath: "envelope.wallsAbove.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_86", "d_20", "f_86"],
          label: "Walls Above Grade: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_86",
          semanticPath: "envelope.wallsAbove.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_86", "i_98"],
          label: "Walls Above Grade: Heat Loss %",
        },
        k: {
          fieldId: "k_86",
          semanticPath: "envelope.wallsAbove.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_86", "d_21", "f_86"],
          label: "Walls Above Grade: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_86",
          semanticPath: "envelope.wallsAbove.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_86", "k_98"],
          label: "Walls Above Grade: Heat Gain %",
        },
        m: {
          fieldId: "m_86",
          semanticPath: "envelope.wallsAbove.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["f_86", "t_86"],
          label: "Walls Above Grade: Reference Compliance Ratio",
        },
        n: { fieldId: "n_86", semanticPath: "envelope.wallsAbove.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_86",
          semanticPath: "envelope.wallsAbove.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_86", "g_86", "h_23", "d_25"],
          label: "Walls Above Grade: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    87: {
      id: "B.6",
      rowId: "B.6",
      label: "Floor Exposed",
      cells: {
        c: { label: "Floor Exposed" },
        d: {
          fieldId: "d_87",
          semanticPath: "envelope.floorExposed.area",
          type: "editable",
          value: "0.00",
          label: "Floor Exposed: Area m²",
        },
        e: {
          fieldId: "e_87",
          semanticPath: "envelope.floorExposed.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_87"],
          label: "Floor Exposed: R-Value Imperial",
        },
        f: {
          fieldId: "f_87",
          semanticPath: "envelope.floorExposed.rsiValue",
          type: "editable",
          value: "9.52",
          label: "Floor Exposed: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_87",
          semanticPath: "envelope.floorExposed.uValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_87"],
          label: "Floor Exposed: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_87",
          semanticPath: "envelope.floorExposed.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_87", "d_101"],
          classes: ["text-air-facing"],
          label: "Floor Exposed: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_87",
          semanticPath: "envelope.floorExposed.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_87", "d_20", "f_87"],
          label: "Floor Exposed: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_87",
          semanticPath: "envelope.floorExposed.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_87", "i_98"],
          label: "Floor Exposed: Heat Loss %",
        },
        k: {
          fieldId: "k_87",
          semanticPath: "envelope.floorExposed.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_87", "d_21", "f_87"],
          label: "Floor Exposed: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_87",
          semanticPath: "envelope.floorExposed.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_87", "k_98"],
          label: "Floor Exposed: Heat Gain %",
        },
        m: {
          fieldId: "m_87",
          semanticPath: "envelope.floorExposed.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["f_87", "t_87"],
          label: "Floor Exposed: Reference Compliance Ratio",
        },
        n: { fieldId: "n_87", semanticPath: "envelope.floorExposed.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_87",
          semanticPath: "envelope.floorExposed.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_87", "g_87", "h_23", "d_25"],
          label: "Floor Exposed: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    88: {
      id: "B.7.0",
      rowId: "B.7.0",
      label: "Door",
      cells: {
        c: { label: "Door" },
        d: {
          fieldId: "d_88",
          semanticPath: "envelope.doors.area",
          type: "calculated",
          value: "",
          dependencies: ["d_73"],
          label: "S11: Doors: Area m²",
        }, // ✅ S10-S11 AREA SYNC: Will sync from S10 d_73
        e: {
          fieldId: "e_88",
          semanticPath: "envelope.doors.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_88"],
          label: "Doors: R-Value Imperial",
        },
        f: {
          fieldId: "f_88",
          semanticPath: "envelope.doors.rsiValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["g_88"],
          label: "Doors: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_88",
          semanticPath: "envelope.doors.uValue",
          type: "editable",
          value: "1.990",
          label: "Doors: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_88",
          semanticPath: "envelope.doors.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_88", "d_101"],
          classes: ["text-air-facing"],
          label: "Doors: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_88",
          semanticPath: "envelope.doors.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_88", "d_20", "f_88"],
          label: "Doors: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_88",
          semanticPath: "envelope.doors.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_88", "i_98"],
          label: "Doors: Heat Loss %",
        },
        k: {
          fieldId: "k_88",
          semanticPath: "envelope.doors.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_88", "d_21", "f_88"],
          label: "Doors: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_88",
          semanticPath: "envelope.doors.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_88", "k_98"],
          label: "Doors: Heat Gain %",
        },
        m: {
          fieldId: "m_88",
          semanticPath: "envelope.doors.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["t_88", "g_88"],
          label: "Doors: Reference Compliance Ratio",
        },
        n: { fieldId: "n_88", semanticPath: "envelope.doors.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_88",
          semanticPath: "envelope.doors.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_88", "g_88", "h_23", "d_25"],
          label: "Doors: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    89: {
      id: "B.8.1",
      rowId: "B.8.1",
      label: "Window",
      cells: {
        c: { label: "Window" },
        d: {
          fieldId: "d_89",
          semanticPath: "envelope.windowNorth.area",
          type: "calculated",
          value: "",
          dependencies: ["d_74"],
          label: "S11: Window Area North: Area m²",
        }, // ✅ S10-S11 AREA SYNC: Will sync from S10 d_74
        e: {
          fieldId: "e_89",
          semanticPath: "envelope.windowNorth.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_89"],
          label: "Window Area North: R-Value Imperial",
        },
        f: {
          fieldId: "f_89",
          semanticPath: "envelope.windowNorth.rsiValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["g_89"],
          label: "Window Area North: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_89",
          semanticPath: "envelope.windowNorth.uValue",
          type: "editable",
          value: "1.420",
          label: "Window Area North: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_89",
          semanticPath: "envelope.windowNorth.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_89", "d_101"],
          classes: ["text-air-facing"],
          label: "Window Area North: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_89",
          semanticPath: "envelope.windowNorth.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_89", "d_20", "f_89"],
          label: "Window Area North: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_89",
          semanticPath: "envelope.windowNorth.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_89", "i_98"],
          label: "Window Area North: Heat Loss %",
        },
        k: {
          fieldId: "k_89",
          semanticPath: "envelope.windowNorth.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_89", "d_21", "f_89"],
          label: "Window Area North: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_89",
          semanticPath: "envelope.windowNorth.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_89", "k_98"],
          label: "Window Area North: Heat Gain %",
        },
        m: {
          fieldId: "m_89",
          semanticPath: "envelope.windowNorth.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["t_89", "g_89"],
          label: "Window Area North: Reference Compliance Ratio",
        },
        n: { fieldId: "n_89", semanticPath: "envelope.windowNorth.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_89",
          semanticPath: "envelope.windowNorth.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_89", "g_89", "h_23", "d_25"],
          label: "Window North: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    90: {
      id: "B.8.2",
      rowId: "B.8.2",
      label: "Window",
      cells: {
        c: { label: "Window" },
        d: {
          fieldId: "d_90",
          semanticPath: "envelope.windowEast.area",
          type: "calculated",
          value: "",
          dependencies: ["d_75"],
          label: "S11: Window Area East: Area m²",
        }, // ✅ S10-S11 AREA SYNC: Will sync from S10 d_75
        e: {
          fieldId: "e_90",
          semanticPath: "envelope.windowEast.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_90"],
          label: "Window Area East: R-Value Imperial",
        },
        f: {
          fieldId: "f_90",
          semanticPath: "envelope.windowEast.rsiValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["g_90"],
          label: "Window Area East: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_90",
          semanticPath: "envelope.windowEast.uValue",
          type: "editable",
          value: "1.420",
          label: "Window Area East: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_90",
          semanticPath: "envelope.windowEast.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_90", "d_101"],
          classes: ["text-air-facing"],
          label: "Window Area East: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_90",
          semanticPath: "envelope.windowEast.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_90", "d_20", "f_90"],
          label: "Window Area East: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_90",
          semanticPath: "envelope.windowEast.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_90", "i_98"],
          label: "Window Area East: Heat Loss %",
        },
        k: {
          fieldId: "k_90",
          semanticPath: "envelope.windowEast.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_90", "d_21", "f_90"],
          label: "Window Area East: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_90",
          semanticPath: "envelope.windowEast.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_90", "k_98"],
          label: "Window Area East: Heat Gain %",
        },
        m: {
          fieldId: "m_90",
          semanticPath: "envelope.windowEast.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["t_90", "g_90"],
          label: "Window Area East: Reference Compliance Ratio",
        },
        n: { fieldId: "n_90", semanticPath: "envelope.windowEast.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_90",
          semanticPath: "envelope.windowEast.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_90", "g_90", "h_23", "d_25"],
          label: "Window East: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    91: {
      id: "B.8.3",
      rowId: "B.8.3",
      label: "Window",
      cells: {
        c: { label: "Window" },
        d: {
          fieldId: "d_91",
          semanticPath: "envelope.windowSouth.area",
          type: "calculated",
          value: "",
          dependencies: ["d_76"],
          label: "S11: Window Area South: Area m²",
        }, // ✅ S10-S11 AREA SYNC: Will sync from S10 d_76
        e: {
          fieldId: "e_91",
          semanticPath: "envelope.windowSouth.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_91"],
          label: "Window Area South: R-Value Imperial",
        },
        f: {
          fieldId: "f_91",
          semanticPath: "envelope.windowSouth.rsiValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["g_91"],
          label: "Window Area South: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_91",
          semanticPath: "envelope.windowSouth.uValue",
          type: "editable",
          value: "1.420",
          label: "Window Area South: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_91",
          semanticPath: "envelope.windowSouth.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_91", "d_101"],
          classes: ["text-air-facing"],
          label: "Window Area South: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_91",
          semanticPath: "envelope.windowSouth.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_91", "d_20", "f_91"],
          label: "Window Area South: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_91",
          semanticPath: "envelope.windowSouth.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_91", "i_98"],
          label: "Window Area South: Heat Loss %",
        },
        k: {
          fieldId: "k_91",
          semanticPath: "envelope.windowSouth.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_91", "d_21", "f_91"],
          label: "Window Area South: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_91",
          semanticPath: "envelope.windowSouth.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_91", "k_98"],
          label: "Window Area South: Heat Gain %",
        },
        m: {
          fieldId: "m_91",
          semanticPath: "envelope.windowSouth.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["t_91", "g_91"],
          label: "Window Area South: Reference Compliance Ratio",
        },
        n: { fieldId: "n_91", semanticPath: "envelope.windowSouth.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_91",
          semanticPath: "envelope.windowSouth.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_91", "g_91", "h_23", "d_25"],
          label: "Window South: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    92: {
      id: "B.8.4",
      rowId: "B.8.4",
      label: "Window",
      cells: {
        c: { label: "Window" },
        d: {
          fieldId: "d_92",
          semanticPath: "envelope.windowWest.area",
          type: "calculated",
          value: "",
          dependencies: ["d_77"],
          label: "S11: Window Area West: Area m²",
        }, // ✅ S10-S11 AREA SYNC: Will sync from S10 d_77
        e: {
          fieldId: "e_92",
          semanticPath: "envelope.windowWest.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_92"],
          label: "Window Area West: R-Value Imperial",
        },
        f: {
          fieldId: "f_92",
          semanticPath: "envelope.windowWest.rsiValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["g_92"],
          label: "Window Area West: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_92",
          semanticPath: "envelope.windowWest.uValue",
          type: "editable",
          value: "1.420",
          label: "Window Area West: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_92",
          semanticPath: "envelope.windowWest.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_92", "d_101"],
          classes: ["text-air-facing"],
          label: "Window Area West: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_92",
          semanticPath: "envelope.windowWest.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_92", "d_20", "f_92"],
          label: "Window Area West: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_92",
          semanticPath: "envelope.windowWest.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_92", "i_98"],
          label: "Window Area West: Heat Loss %",
        },
        k: {
          fieldId: "k_92",
          semanticPath: "envelope.windowWest.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_92", "d_21", "f_92"],
          label: "Window Area West: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_92",
          semanticPath: "envelope.windowWest.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_92", "k_98"],
          label: "Window Area West: Heat Gain %",
        },
        m: {
          fieldId: "m_92",
          semanticPath: "envelope.windowWest.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["t_92", "g_92"],
          label: "Window Area West: Reference Compliance Ratio",
        },
        n: { fieldId: "n_92", semanticPath: "envelope.windowWest.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_92",
          semanticPath: "envelope.windowWest.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_92", "g_92", "h_23", "d_25"],
          label: "Window West: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    93: {
      id: "B.8.5",
      rowId: "B.8.5",
      label: "Skylights",
      cells: {
        c: { label: "Skylights" },
        d: {
          fieldId: "d_93",
          semanticPath: "envelope.skylight.area",
          type: "calculated",
          value: "",
          dependencies: ["d_78"],
          label: "S11: Skylights: Area m²",
        }, // ✅ S10-S11 AREA SYNC: Will sync from S10 d_78
        e: {
          fieldId: "e_93",
          semanticPath: "envelope.skylight.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_93"],
          label: "Skylights: R-Value Imperial",
        },
        f: {
          fieldId: "f_93",
          semanticPath: "envelope.skylight.rsiValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["g_93"],
          label: "Skylights: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_93",
          semanticPath: "envelope.skylight.uValue",
          type: "editable",
          value: "1.420",
          label: "Skylights: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_93",
          semanticPath: "envelope.skylight.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_93", "d_101"],
          classes: ["text-air-facing"],
          label: "Skylights: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_93",
          semanticPath: "envelope.skylight.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_93", "d_20", "f_93"],
          label: "Skylights: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_93",
          semanticPath: "envelope.skylight.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_93", "i_98"],
          label: "Skylights: Heat Loss %",
        },
        k: {
          fieldId: "k_93",
          semanticPath: "envelope.skylight.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_93", "d_21", "f_93"],
          label: "Skylights: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_93",
          semanticPath: "envelope.skylight.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_93", "k_98"],
          label: "Skylights: Heat Gain %",
        },
        m: {
          fieldId: "m_93",
          semanticPath: "envelope.skylight.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["t_93", "g_93"],
          label: "Skylights: Reference Compliance Ratio",
        },
        n: { fieldId: "n_93", semanticPath: "envelope.skylight.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_93",
          semanticPath: "envelope.skylight.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_93", "g_93", "h_23", "d_25"],
          label: "Skylights: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    94: {
      id: "B.9",
      rowId: "B.9",
      label: "Walls Below Grade (Conditioned Space)",
      cells: {
        c: { label: "Walls Below Grade (Conditioned Space)" },
        d: {
          fieldId: "d_94",
          semanticPath: "envelope.wallsBelow.area",
          type: "editable",
          value: "0.00",
          label: "Walls Below Grade: Area m²",
        },
        e: {
          fieldId: "e_94",
          semanticPath: "envelope.wallsBelow.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_94"],
          label: "Walls Below Grade: R-Value Imperial",
        },
        f: {
          fieldId: "f_94",
          semanticPath: "envelope.wallsBelow.rsiValue",
          type: "editable",
          value: "4.00",
          label: "Walls Below Grade: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_94",
          semanticPath: "envelope.wallsBelow.uValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_94"],
          label: "Walls Below Grade: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_94",
          semanticPath: "envelope.wallsBelow.percentOfEnvelope",
          type: "calculated",
          value: "0%",
          dependencies: ["d_94", "d_102"],
          classes: ["text-ground-facing"],
          label: "Walls Below Grade: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_94",
          semanticPath: "envelope.wallsBelow.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_94", "d_22", "f_94"],
          label: "Walls Below Grade: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_94",
          semanticPath: "envelope.wallsBelow.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_94", "i_98"],
          label: "Walls Below Grade: Heat Loss %",
        },
        k: {
          fieldId: "k_94",
          semanticPath: "envelope.wallsBelow.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["i_21", "d_94", "h_22", "f_94"],
          label: "Walls Below Grade: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_94",
          semanticPath: "envelope.wallsBelow.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_94", "k_98"],
          label: "Walls Below Grade: Heat Gain %",
        },
        m: {
          fieldId: "m_94",
          semanticPath: "envelope.wallsBelow.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["f_94", "t_94"],
          label: "Walls Below Grade: Reference Compliance Ratio",
        },
        n: { fieldId: "n_94", semanticPath: "envelope.wallsBelow.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_94",
          semanticPath: "envelope.wallsBelow.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_94", "g_94", "h_23"],
          label: "Walls Below Grade: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    95: {
      id: "B.10",
      rowId: "B.10",
      label: "Floor Slab (Conditioned Space)",
      cells: {
        c: { label: "Floor Slab (Conditioned Space)" },
        d: {
          fieldId: "d_95",
          semanticPath: "envelope.slab.area",
          type: "editable",
          value: "1100.92",
          label: "Floor Slab: Area m²",
        },
        e: {
          fieldId: "e_95",
          semanticPath: "envelope.slab.rValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_95"],
          label: "Floor Slab: R-Value Imperial",
        },
        f: {
          fieldId: "f_95",
          semanticPath: "envelope.slab.rsiValue",
          type: "editable",
          value: "3.70",
          label: "Floor Slab: RSI Value K·m²/W",
        },
        g: {
          fieldId: "g_95",
          semanticPath: "envelope.slab.uValue",
          type: "calculated",
          value: "0.00",
          dependencies: ["f_95"],
          label: "Floor Slab: U-Value W/m²·K",
        },
        h: {
          fieldId: "h_95",
          semanticPath: "envelope.slab.percentOfEnvelope",
          type: "calculated",
          value: "100%",
          dependencies: ["d_95", "d_102"],
          classes: ["text-ground-facing"],
          label: "Floor Slab: % of Total Envelope Area",
        },
        i: {
          fieldId: "i_95",
          semanticPath: "envelope.slab.heatLoss",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_95", "d_22", "f_95"],
          label: "Floor Slab: Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_95",
          semanticPath: "envelope.slab.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_95", "i_98"],
          label: "Floor Slab: Heat Loss %",
        },
        k: {
          fieldId: "k_95",
          semanticPath: "envelope.slab.heatGain",
          type: "calculated",
          value: "0.00",
          dependencies: ["i_21", "d_95", "h_22", "f_95"],
          label: "Floor Slab: Heat Gain kWh/Cooling Season",
        },
        l: {
          fieldId: "l_95",
          semanticPath: "envelope.slab.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_95", "k_98"],
          label: "Floor Slab: Heat Gain %",
        },
        m: {
          fieldId: "m_95",
          semanticPath: "envelope.slab.complianceRatio",
          type: "calculated",
          value: "0%",
          dependencies: ["f_95", "t_95"],
          label: "Floor Slab: Reference Compliance Ratio",
        },
        n: { fieldId: "n_95", semanticPath: "envelope.slab.complianceStatus", type: "calculated", value: "✓" },
        o: {
          fieldId: "o_95",
          semanticPath: "envelope.slab.surfaceTemperature",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_95", "g_95", "h_23"],
          label: "Floor Slab: Interior Surface Temperature °C",
          tooltip: true,
        },
      },
    },
    96: {
      id: "B.11",
      rowId: "B.11",
      label: "B.11 Interior Floors (incl. garages)",
      cells: {
        c: { label: "B.11 Interior Floors (incl. garages)" },
        d: {
          fieldId: "d_96",
          semanticPath: "envelope.interiorFloors.area",
          type: "editable",
          value: "29.70",
          tooltip: true,
          label: "Interior Floors: Area m²",
        },
        e: { content: "-" },
        f: { content: "-" },
        g: { content: "-" },
        h: { content: "-" },
        i: { content: "-" },
        j: { content: "-" },
        k: { content: "-" },
        l: { content: "-" },
        m: {},
        n: {},
        o: {},
      },
    },
    97: {
      id: "B.12",
      rowId: "B.12",
      label: "Thermal Bridge Penalty %",
      cells: {
        c: { label: "Thermal Bridge Penalty (%)" },
        d: {
          fieldId: "d_97",
          semanticPath: "envelope.thermalBridge.penaltyFactor",
          type: "percentage", // Changed from editable to percentage
          value: "20", // Default value 20%
          min: 5, // **** CHANGED: Set min to 5 ****
          max: 100, // Max 100%
          step: 5, // Step 5%
          label: "Thermal Bridge Penalty: Factor %",
          section: "envelope",
          tooltip: true, // TB Penalty
        },
        e: { fieldId: "e_97", semanticPath: "envelope.thermalBridge.penaltyDecimal", type: "calculated", value: "0.200" }, // Placeholder for decimal equivalent
        f: { content: "0.00", classes: ["label-prefix"] },
        i: {
          fieldId: "i_97",
          semanticPath: "envelope.thermalBridge.heatLoss",
          type: "calculated",
          value: "0.00",
          section: "envelope",
          dependencies: ["i_98", "d_97"],
          label: "TB Penalty Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_97",
          semanticPath: "envelope.thermalBridge.heatLossPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["i_97", "i_98"],
          label: "Combined Total Envelope TB Penalty Heat Loss %",
        },
        k: {
          fieldId: "k_97",
          semanticPath: "envelope.thermalBridge.heatGain",
          type: "calculated",
          value: "0.00",
          section: "envelope",
          dependencies: ["h_21", "k_98", "d_97"],
          label: "TB Penalty Cooling Season Heat Gain kWh",
        },
        l: {
          fieldId: "l_97",
          semanticPath: "envelope.thermalBridge.heatGainPercent",
          type: "calculated",
          value: "0%",
          dependencies: ["k_97", "k_98"],
          label: "Combined TB Penalty Cooling Season Heat Gain %",
        },
        m: {
          fieldId: "m_97",
          semanticPath: "envelope.thermalBridge.costImpact",
          type: "calculated",
          value: "0%",
          dependencies: ["i_97", "l_12", "k_97"],
          label: "Penalty Cost Impact",
        },
        n: { fieldId: "n_97", semanticPath: "envelope.thermalBridge.complianceStatus", type: "calculated", value: "✓" },
      },
    },
    98: {
      id: "ET",
      rowId: "ET",
      label: "ET",
      cells: {
        c: { label: "Envelope Totals" },
        d: {
          fieldId: "d_98",
          semanticPath: "envelope.total.area",
          type: "calculated",
          value: "0.00",
          dependencies: [
            "d_85",
            "d_86",
            "d_87",
            "d_88",
            "d_89",
            "d_90",
            "d_91",
            "d_92",
            "d_93",
            "d_94",
            "d_95",
          ],
          label: "Total Envelope Area m²",
        },
        e: {
          fieldId: "e_98",
          semanticPath: "envelope.total.avgRValueImperial",
          type: "calculated",
          value: "0.00",
          dependencies: ["d_94", "d_95", "g_101", "g_102"],
          label: "Avg. R-Value Imperial",
        },
        f: {},
        g: {},
        h: {
          fieldId: "h_98",
          semanticPath: "envelope.total.percentOfEnvelope",
          type: "calculated",
          value: "100%",
          dependencies: [
            "h_85",
            "h_86",
            "h_87",
            "h_88",
            "h_89",
            "h_90",
            "h_91",
            "h_92",
            "h_93",
          ],
          label: "Total % of Envelope",
        },
        i: {
          fieldId: "i_98",
          semanticPath: "envelope.total.heatLoss",
          type: "calculated",
          value: "0.00",
          section: "envelope",
          dependencies: [
            "i_85",
            "i_86",
            "i_87",
            "i_88",
            "i_89",
            "i_90",
            "i_91",
            "i_92",
            "i_93",
            "i_94",
            "i_95",
          ],
          label: "Total Heat Loss kWh/yr",
        },
        j: {
          fieldId: "j_98",
          semanticPath: "envelope.total.heatLossPercent",
          type: "calculated",
          value: "100%",
          tooltip: true,
          dependencies: [
            "j_85",
            "j_86",
            "j_87",
            "j_88",
            "j_89",
            "j_90",
            "j_91",
            "j_92",
            "j_93",
            "j_94",
            "j_95",
          ],
          label: "Total Heat Loss %",
        },
        k: {
          fieldId: "k_98",
          semanticPath: "envelope.total.heatGain",
          type: "calculated",
          value: "0.00",
          section: "envelope",
          dependencies: [
            "k_85",
            "k_86",
            "k_87",
            "k_88",
            "k_89",
            "k_90",
            "k_91",
            "k_92",
            "k_93",
            "k_94",
            "k_95",
          ],
          label: "Total Heat Gain kWh",
        },
        l: {
          fieldId: "l_98",
          semanticPath: "envelope.total.heatGainPercent",
          type: "calculated",
          value: "100%",
          tooltip: true,
          dependencies: [
            "l_85",
            "l_86",
            "l_87",
            "l_88",
            "l_89",
            "l_90",
            "l_91",
            "l_92",
            "l_93",
            "l_94",
            "l_95",
          ],
          label: "Total Heat Gain %",
        },
        m: {},
        n: {},
      },
    },
  };

  // The openings' twins after the first (Openings.js; Andy 2026-11-20: "If a window row is created in
  // S10, S11 needs to ape it"): door rows B.7.2-B.7.4 take row 88's shape, window rows B.8.6-B.8.12
  // row 89's - the area S10's (calculated), the U-value their own. Shown and hidden with their S10 row.
  const OPENINGS = window.TEUI.Openings;
  // Every door / window row's hosting fields (Andy 2026-11-24): its HOST (ch_, the S11 row whose wall or
  // roof it sits in) and QUANTITY (dq_), placed beside its name after render (installOpeningControls), and
  // its W and H in the L and H columns: W x H x quantity given, they set the row's S10 area
  const openingCells = o => ({
    ch: {
      fieldId: `ch_${o.s11}`,
      type: "dropdown",
      dropdownId: `dd_ch_${o.s11}`,
      value: "",
      options: [{ value: "", name: "No host" }, ...OPENINGS.OPAQUE.map(r => ({ value: r.s11, name: OPENINGS.s11RowId(r) }))],
      label: `${OPENINGS.s11RowId(o)}: Host (the wall or roof it sits in)`,
    },
    dq: {
      fieldId: `dq_${o.s11}`,
      type: "dropdown",
      dropdownId: `dd_dq_${o.s11}`,
      value: "1",
      options: Array.from({ length: 50 }, (_, i) => ({ value: String(i + 1), name: `× ${i + 1}` })),
      label: `${OPENINGS.s11RowId(o)}: Quantity`,
    },
    // an empty one says what it takes, "W" and "H" (Andy 2026-11-25: "where are we supposed to input window dimensions?")
    dl: { fieldId: `dl_${o.s11}`, type: "editable", value: "", classes: ["user-input", "opaque-lh", "opening-w"], label: `${OPENINGS.s11RowId(o)}: Width m` },
    dh: { fieldId: `dh_${o.s11}`, type: "editable", value: "", classes: ["user-input", "opaque-lh", "opening-h"], label: `${OPENINGS.s11RowId(o)}: Height m` },
    // a window's overhang (F280 Annex A), typed beside its S10 row's name; defined here so a file carries it
    ...(o.kind === "door"
      ? {}
      : {
          eh: { fieldId: `eh_${o.s10}`, type: "editable", value: "", label: `${OPENINGS.s10RowId(o)}: Overhang above the head m` },
          ed: { fieldId: `ed_${o.s10}`, type: "editable", value: "", label: `${OPENINGS.s10RowId(o)}: Overhang depth m` },
        }),
  });
  OPENINGS.ALL.filter(o => !OPENINGS.isSlot(o)).forEach(o => Object.assign(sectionRows[o.s11].cells, openingCells(o)));
  OPENINGS.SLOTS.forEach(o => {
    const door = o.kind === "door";
    const base = door ? "88" : "89";
    const row = OPENINGS.cloneRow(sectionRows[base], base, o.s11, {
      id: OPENINGS.s11RowId(o),
      label: door ? "Door" : "Window",
      pathFrom: door ? "doors" : "windowNorth",
      pathTo: o.id,
      textPattern: door ? /\bDoors?\b/g : /\bWindow( Area)? North\b/g,
      textTo: door ? `Door ${OPENINGS.s11RowId(o)}` : `Window ${OPENINGS.s11RowId(o)}`,
    });
    row.cells.d.dependencies = [`d_${o.s10}`]; // its area is its S10 row's
    Object.assign(row.cells, openingCells(o));
    sectionRows[o.s11] = row;
    areaSourceMap[`d_${o.s11}`] = `d_${o.s10}`;
    editableFields.push(`g_${o.s11}`);
  });

  // ------------------------------------------------------------------------------------------------
  // The OPAQUE rows (Openings.js; Andy 2026-11-20): above grade B.4-B.6 and 9 more, below grade B.9-B.10
  // and 4 more. Each row's label cell is its TYPE (above: Roof / Wall / Exposed floor; below: Wall /
  // Slab); an above-grade row also holds a FACING (cf_, shown beside the type for a wall); L and H (dl_,
  // dh_) sit in two narrow columns left of the area: both given, the area is L x H; either blank, the area
  // is typed, as every file before them did.
  // ------------------------------------------------------------------------------------------------
  const TYPE_NAMES = {
    roof: "Roof",
    walls: "Wall above grade (less its hosted openings)",
    exposedFloor: "Exposed floor",
    wallsBelowGrade: "Wall below grade (conditioned)",
    slabOnGrade: "Slab (conditioned)",
  };
  const OPAQUE_PATHS = { 85: "roof", 86: "wallsAbove", 87: "floorExposed", 94: "wallsBelow", 95: "slab" };
  const opaqueCells = (o, facing) => {
    const types = o.group === "above" ? OPENINGS.ABOVE_TYPES : OPENINGS.BELOW_TYPES;
    // c, the description cell, holds the type's name; FieldManager renders no field there, so the type
    // (ct) and the facing (cf) are fields without a column, their dropdowns placed in it after render
    // (installOpaqueControls)
    const cells = {
      c: { label: TYPE_NAMES[o.type] },
      ct: {
        fieldId: `c_${o.s11}`,
        type: "dropdown",
        dropdownId: `dd_c_${o.s11}`,
        value: o.type,
        options: types.map(t => ({ value: t, name: TYPE_NAMES[t] })),
        classes: ["opaque-type"],
        label: `${OPENINGS.s11RowId(o)}: Element Type`,
      },
      dl: { fieldId: `dl_${o.s11}`, type: "editable", value: "", classes: ["user-input", "opaque-lh"], label: `${OPENINGS.s11RowId(o)}: Length m` },
      dh: { fieldId: `dh_${o.s11}`, type: "editable", value: "", classes: ["user-input", "opaque-lh"], label: `${OPENINGS.s11RowId(o)}: Height m` },
    };
    // not a column: S11 places it beside the type (installOpaqueControls); a field all the same
    if (o.group === "above")
      cells.cf = {
        fieldId: `cf_${o.s11}`,
        type: "dropdown",
        dropdownId: `dd_cf_${o.s11}`,
        value: facing,
        options: OPENINGS.FACINGS.map(f => ({ value: f, name: f })),
        label: `${OPENINGS.s11RowId(o)}: Wall Facing`,
      };
    return cells;
  };
  // the first rows: their own cells, plus the type, facing and L / H; B.5 faces Average (the compass
  // mean every wall took before, so no file's result moves)
  OPENINGS.OPAQUE.filter(o => !OPENINGS.isSlot(o)).forEach(o => {
    Object.assign(sectionRows[o.s11].cells, opaqueCells(o, "Average"));
  });
  // the rows after them, cloned from B.5 (above) or B.9 (below): a new row is a wall, facing North
  OPENINGS.OPAQUE_SLOTS.forEach(o => {
    const base = o.group === "above" ? "86" : "94";
    const row = OPENINGS.cloneRow(sectionRows[base], base, o.s11, {
      id: OPENINGS.s11RowId(o),
      label: TYPE_NAMES[o.type],
      pathFrom: OPAQUE_PATHS[base],
      pathTo: o.id,
      textPattern: o.group === "above" ? /Walls Above Grade/g : /Walls Below Grade/g,
      textTo: `Element ${OPENINGS.s11RowId(o)}`,
    });
    Object.assign(row.cells, opaqueCells(o, "North"));
    sectionRows[o.s11] = row;
    editableFields.push(`d_${o.s11}`, `f_${o.s11}`);
  });
  [...OPENINGS.OPAQUE, ...OPENINGS.ALL].forEach(o => editableFields.push(`dl_${o.s11}`, `dh_${o.s11}`));

  // L and H under the Areas heading, in the width B.12's slider already gives the column (Andy
  // 2026-11-20: "that whitespace under 'Areas'"); the slider spans all three
  Object.assign(sectionRows.header.cells, {
    dl: { content: "L or W (m)", classes: ["section-subheader", "align-center"] }, // a wall's length, an opening's width
    dh: { content: "× H (m)", classes: ["section-subheader", "align-center"] },
  });
  sectionRows[97].cells.dl = { ...sectionRows[97].cells.d, span: 3 };
  delete sectionRows[97].cells.d;

  // The rows in order: each group's rows together (object keys put 87a after every number)
  const ROW_ORDER = [
    "header",
    ...OPENINGS.ABOVE.map(o => o.s11),
    ...OPENINGS.DOORS.map(o => o.s11),
    ...OPENINGS.WINDOWS.map(o => o.s11),
    ...OPENINGS.BELOW.map(o => o.s11),
    ...Object.keys(sectionRows).filter(k => !isNaN(Number(k)) && Number(k) > 95),
  ];

  //==========================================================================
  // ACCESSOR METHODS
  //==========================================================================

  function getFields() {
    const fields = {};
    Object.values(sectionRows).forEach(row => {
      if (!row.cells) return;
      Object.values(row.cells).forEach(cell => {
        if (cell.fieldId && cell.type) {
          // Copy all relevant properties from the cell definition
          fields[cell.fieldId] = {
            ...cell, // Spread operator to copy all properties
            defaultValue: cell.value, // Keep defaultValue mapping for consistency
          };
          // Remove original value key if necessary, as it's mapped to defaultValue
          // delete fields[cell.fieldId].value;
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
    ROW_ORDER.forEach(key => {
      if (sectionRows[key]) layoutRows.push(createLayoutRow(sectionRows[key]));
    });
    return { rows: layoutRows };
  }

  function createLayoutRow(row) {
    const rowDef = { id: row.id, cells: [{}, {}] };
    const columns = [
      "c",
      "dl", // L m, an opaque row's length (Andy 2026-11-20: L x H = Area)
      "dh", // H m, its height
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
      "o", // Surface Temperature (condensation risk feature)
    ];
    columns.forEach(col => {
      const cell = row.cells?.[col] ? { ...row.cells[col] } : {};
      if (col === "c" && !cell.label && row.label) cell.label = row.label;
      // Only remove properties confirmed unnecessary for rendering
      delete cell.section;
      delete cell.dependencies;
      delete cell.getOptions;
      rowDef.cells.push(cell);
    });
    return rowDef;
  }

  //==========================================================================
  // HELPER FUNCTIONS (Refactored for Self-Contained State Module)
  //==========================================================================

  // getNumericValue, getGlobalNumericValue, getFieldValue, setCalculatedValue removed — graph computes

  /**
   * Formats a number according to the project's display rules.
   * Handles specific formats like percentages, currency, W/m2.
   * @param {number} value - The number to format.
   * @param {string} [format='number'] - The type of format.
   * @returns {string} The formatted number as a string.
   */
  function formatNumber(value, format = "number") {
    if (value === null || value === undefined || isNaN(value)) {
      // Return 0 or 0% based on expected format
      return format === "percent" ? "0%" : format === "W/m2" ? "0.000" : "0.00";
    }

    const num = Number(value);

    if (format === "percent") {
      // Multiply decimal by 100, then format to 2 decimal places and add %
      return (
        (num * 100).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) + "%"
      );
    } else if (format === "W/m2") {
      // U-Values (3 decimals)
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
    } else {
      // Default: kWh, RSI, Rimp, Area etc. (2 decimals)
      return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }

  // setElementClass, setIndicatorClass removed — graph handles indicator styling

  //==========================================================================
  // ✅ S10-S11 AREA SYNC FUNCTIONS (CRASH-SAFE with all safeguards)
  //==========================================================================

  /**
   * Syncs window/door area values from S10 into S11
   * Respects current calculation mode (Target vs Reference)
   * CRITICAL: Only reads from S10, never writes back
   */
  function syncAreasFromS10() {
    // GUARD 1: Block if S11 not yet initialized
    if (!isS11Initialized) {
      console.warn("[S11 Area Sync] Blocked - S11 not initialized yet");
      return;
    }

    // GUARD 2: Prevent recursion
    if (isSyncingFromS10) {
      console.warn("[S11 Area Sync] Blocked - sync already in progress");
      return;
    }

    isSyncingFromS10 = true;

    try {
      const isRef = window.TEUI.ReferenceToggle?.isReferenceMode();
      const currentMode = isRef ? "reference" : "target";

      // Detect if this is initial/import sync requiring dual-state population
      // Check if ref areas in StateManager are unpopulated
      const refArea_d88 = window.TEUI.StateManager?.getValue("ref_d_88");
      const stateManager_refArea =
        window.TEUI.StateManager.getValue("ref_d_73");

      const needsDualSync =
        (isInitializationPhase || isImportActive) &&
        currentMode === "target" &&
        (refArea_d88 === undefined || refArea_d88 !== stateManager_refArea);

      if (needsDualSync) {
        console.log(
          `[S11 Area Sync] DUAL-STATE SYNC - populating BOTH Target and Reference states`
        );
        console.log(
          `[S11 Area Sync] Reason: ref_d_88=${refArea_d88}, ref_d_73 in StateManager=${stateManager_refArea}`
        );
      } else {
        console.log(`[S11 Area Sync] Starting sync in ${currentMode} mode`);
      }

      // PERFORMANCE: Batch state updates to prevent listener cascade
      const targetUpdates = [];
      const refUpdates = [];
      const domUpdates = [];

      Object.entries(areaSourceMap).forEach(([s11Field, s10Field]) => {
        // Determine source fields
        const targetSourceField = s10Field;
        const refSourceField = `ref_${s10Field}`;

        // Read from S10 via global StateManager
        const targetValue =
          window.TEUI.StateManager.getValue(targetSourceField);
        const refValue = window.TEUI.StateManager.getValue(refSourceField);

        // During dual-state sync, populate BOTH states
        if (needsDualSync) {
          // Queue Target state update
          if (targetValue !== null && targetValue !== undefined) {
            targetUpdates.push({ field: s11Field, value: targetValue });
          }

          // Queue Reference state update (ensures ref areas available for first calc)
          if (refValue !== null && refValue !== undefined) {
            refUpdates.push({ field: s11Field, value: refValue });
          }

          // Queue DOM update with Target value (we're in Target mode)
          domUpdates.push({ field: s11Field, value: targetValue });
        } else {
          // Normal mode-aware sync
          const sourceFieldId =
            currentMode === "reference" ? refSourceField : targetSourceField;
          const areaValue = window.TEUI.StateManager.getValue(sourceFieldId);

          if (areaValue !== null && areaValue !== undefined) {
            // Queue state update — write to appropriate SM key
            if (currentMode === "target") {
              targetUpdates.push({ field: s11Field, value: areaValue });
            } else {
              refUpdates.push({ field: s11Field, value: areaValue });
            }

            // Queue DOM update
            domUpdates.push({ field: s11Field, value: areaValue });
          } else {
            console.warn(
              `[S11 Area Sync] ${sourceFieldId} is null/undefined, skipping ${s11Field}`
            );
          }
        }
      });

      // PERFORMANCE: Apply all state updates via StateManager
      console.log(
        `[S11 Area Sync] Applying ${targetUpdates.length} target updates, ${refUpdates.length} reference updates`
      );

      targetUpdates.forEach(({ field, value }) => {
        window.TEUI.StateManager.setValue(field, value, "calculated");
      });

      refUpdates.forEach(({ field, value }) => {
        window.TEUI.StateManager.setValue(`ref_${field}`, value, "calculated");
      });

      // PERFORMANCE: Update DOM elements directly
      domUpdates.forEach(({ field, value }) => {
        const formattedValue = formatNumber(value, "number");
        const element = document.querySelector(`[data-field-id="${field}"]`);
        if (element) {
          element.textContent = formattedValue;
          element.classList.toggle("negative-value", value < 0);
        }
      });

      // Graph handles recalculation via dependency chain
      console.log("[S11 Area Sync] Sync completed successfully");
    } catch (error) {
      console.error("[S11 Area Sync] ❌ CRITICAL ERROR during sync:");
      console.error("[S11 Area Sync] Error message:", error.message);
      console.error("[S11 Area Sync] Error stack:", error.stack);
      console.error("[S11 Area Sync] Full error object:", error);
    } finally {
      isSyncingFromS10 = false;
    }
  }

  /**
   * Debounced version of syncAreasFromS10 to prevent rapid-fire syncs
   * Waits 50ms after last change before executing sync
   */
  function debouncedSyncAreasFromS10() {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      syncAreasFromS10();
    }, 50);
  }

  /**
   * Setup listeners for S10 area field changes
   * CRITICAL: All listeners start COMMENTED OUT for incremental testing
   * GUARD: Only fires if mode matches and S11 is initialized
   */
  function setupS10AreaListeners() {
    const s10AreaFields = ["d_73", "d_74", "d_75", "d_76", "d_77", "d_78"];

    console.log("[S11] Setting up S10 area listeners...");

    // ✅ ENABLED: All listeners active with guards
    // Listen for Target mode changes
    s10AreaFields.forEach(fieldId => {
      window.TEUI.StateManager.addListener(fieldId, newValue => {
        // GUARD: Only fire if Target mode active
        if (window.TEUI.ReferenceToggle?.isReferenceMode()) return;
        // GUARD: Only fire if S11 initialized
        if (!isS11Initialized) return;

        console.log(
          `[S11 Listener] ${fieldId} changed to ${newValue} (Target mode)`
        );
        debouncedSyncAreasFromS10();
      });
    });

    // Listen for Reference mode changes
    s10AreaFields.forEach(fieldId => {
      window.TEUI.StateManager.addListener(`ref_${fieldId}`, newValue => {
        // ✅ MODE GUARD REMOVED: In dual-state architecture, sections have independent modes.
        // S12 can be in Reference mode while S11 is in Target mode. When S12 publishes
        // ref_i_103, S10 fires and publishes ref_d_73-78. S11 must respond regardless of
        // its current mode - the dual-engine architecture ensures both engines run anyway.
        // GUARD: Only fire if S11 initialized
        if (!isS11Initialized) return;

        console.log(
          `[S11 Listener] ref_${fieldId} changed to ${newValue} (Reference mode)`
        );
        debouncedSyncAreasFromS10();
      });
    });

    console.log("[S11] ✅ S10 area listeners registered for both modes");
  }

  // Legacy helpers removed — graph computes surface temperatures + condensation risk (cr_85-cr_95)
  //==========================================================================
  // EVENT HANDLING & INITIALIZATION
  //==========================================================================

  /**
   * TODO: Optimize initial calculation flow.
   * The current sequence involves rendering with defaults (often "0.00"),
   * then running calculateAll which updates the values, causing a visual "flash".
   * This flash was previously resolved in the ORDERING refactor branch but was
   * re-introduced with the dual-engine reference system. It is a minor glitch but a known one.
   * Future improvements could involve:
   * - Calculating values *before* initial render.
   * - Using placeholders ("---") instead of "0.00" as defaults.
   * - Optimizing the calculateAll sequence itself.
   * For now, the flash is accepted as known behavior.
   */
  function handleFieldBlur(_event) {
    const fieldElement = this;
    const currentFieldId = fieldElement.getAttribute("data-field-id");
    if (!currentFieldId) return;

    // An opaque row's L or H: blank is "not given" (the area stays typed), never 0; both given, the
    // area is their product
    const lh = /^d[lh]_(\d+[a-z]*)$/.exec(currentFieldId);
    if (lh) {
      const v = numOrBlank(fieldElement.textContent.trim());
      fieldElement.textContent = v ? formatNumber(v, "number") : "";
      setModeValue(currentFieldId, v ? String(v) : "", "user-modified");
      applyLengthHeight(lh[1]);
      return;
    }

    let valueStr = fieldElement.textContent.trim().replace(/,/g, "");
    let displayValue = "0.00";
    let rawValueToStore = "0";

    let numValue = window.TEUI.parseNumeric(valueStr, NaN);

    if (!isNaN(numValue)) {
      // Successfully parsed a number
      rawValueToStore = numValue.toString(); // Store the raw number string *first* for all valid number cases

      // Apply specific formatting based on field type
      if (currentFieldId === "d_97") {
        // Thermal Bridge Penalty (%)
        // Convert input number to decimal (assume input "20" means 20% -> 0.2)
        let decimalValue = numValue / 100;
        // Clamp the DECIMAL value between 0 and 1
        decimalValue = Math.max(0, Math.min(1, decimalValue));
        rawValueToStore = decimalValue.toString(); // Overwrite with clamped decimal value for storage
        displayValue = formatNumber(decimalValue * 100, "number"); // Display as number 0-100, not percentage string
      } else if (currentFieldId.startsWith("g_")) {
        // U-Value (3 decimals)
        displayValue = formatNumber(numValue, "W/m2"); // Use specific format
      } else {
        // Default: Area (d_), RSI (f_) - 2 decimals
        displayValue = formatNumber(numValue, "number");
      }
    } else {
      // Handle invalid input (set to 0 or 0%)
      if (currentFieldId === "d_97") {
        displayValue = "0%";
        rawValueToStore = "0"; // Store 0 for invalid TBP
      } else if (currentFieldId.startsWith("g_")) {
        displayValue = formatNumber(0, "W/m2");
        rawValueToStore = "0";
      } else {
        displayValue = formatNumber(0, "number");
        rawValueToStore = "0";
      }
    }
    fieldElement.textContent = displayValue;

    // Store value via mode-aware helper.
    setModeValue(currentFieldId, rawValueToStore, "user-modified");
    // Graph handles recalculation via dependency chain
  }

  function initializeEventHandlers() {
    editableFields.forEach(fieldId => {
      const field = document.querySelector(`[data-field-id="${fieldId}"]`);
      // Attach listeners only to fields actually found and marked as editable
      if (field?.classList.contains("editable")) {
        if (!field.hasEditableListeners) {
          // Prevent adding multiple listeners
          field.addEventListener("keydown", e => {
            if (e.key === "Enter") {
              e.preventDefault();
              field.blur();
            }
          });
          field.addEventListener("blur", handleFieldBlur.bind(field)); // Ensure 'this' context
          field.addEventListener("focus", () => field.classList.add("editing"));
          field.addEventListener("focusout", () =>
            field.classList.remove("editing")
          );
          field.hasEditableListeners = true; // Mark as listener attached
        }
      }
      // Removed console.warn for missing/non-editable fields
    });

    // *** ADDED: Specific listener for d_97 slider ***
    const d97Slider = document.querySelector(
      'input[type="range"][data-field-id="d_97"]'
    );
    if (d97Slider) {
      if (!d97Slider.hasSliderListener) {
        // Prevent adding multiple listeners
        // LIVE FEEDBACK: Update StateManager + immediate calculations for responsive UI
        d97Slider.addEventListener("input", function () {
          const percentageValue = parseFloat(this.value);
          if (isNaN(percentageValue)) return;

          // Update the display span
          const displaySpan = this.parentElement.querySelector(".slider-value");
          if (displaySpan) {
            displaySpan.textContent = percentageValue.toFixed(0) + "%";
          }

          // Store via mode-aware helper (handles both state and StateManager sync)
          const src = "user-modified";
          setModeValue("d_97", percentageValue.toString(), src);
          const mode = window.TEUI.ReferenceToggle?.isReferenceMode() ? "reference" : "target";
          console.log(
            `[S11] Slider input d_97=${percentageValue} (localMode=${mode})`
          );
          // Graph handles recalculation via dependency chain
        });

        // ARCHITECTURAL COMPLIANCE: Final change event relies on StateManager dependency chain
        d97Slider.addEventListener("change", function () {
          const percentageValue = parseFloat(this.value);
          if (isNaN(percentageValue)) return;

          // Final value goes through mode-aware helper - handles state and dependency chain
          const src = "user-modified";
          setModeValue("d_97", percentageValue.toString(), src);
          const mode = window.TEUI.ReferenceToggle?.isReferenceMode() ? "reference" : "target";
          console.log(
            `[S11] Slider change d_97=${percentageValue} (localMode=${mode})`
          );
          // Graph handles recalculation via dependency chain
        });

        d97Slider.hasSliderListener = true; // Mark as listener attached
      }
    } else {
      console.warn("Slider for d_97 not found during initialization.");
    }
    // *** END ADDED ***

    // Graph handles cross-section computation (climate, capacitance, thermal bridge)
    // via wildcard listener. S10→S11 area sync kept (below) for field ID bridging.

    // ✅ S10-S11 AREA SYNC: Setup listeners for S10 area changes (commented out initially)
    setupS10AreaListeners();
  }

  //==========================================================================
  // THE OPAQUE ROWS' CONTROLS (type, facing, L x H) - see the block after sectionRows
  //==========================================================================

  const numOrBlank = v => {
    const n = window.TEUI.parseNumeric(String(v ?? "").replace(/,/g, ""), NaN);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  /**
   * Each opaque row's type dropdown, and an above-grade row's facing beside it, in its description cell
   * (fields without a column: FieldManager renders none in column C). The selects carry their field IDs,
   * so a stamp (FieldManager.updateFieldDisplay) finds them as it finds any dropdown.
   */
  function installOpaqueControls() {
    const makeSelect = (fieldId, cls, title, options) => {
      const select = document.createElement("select");
      select.className = `form-select ${cls}`;
      select.setAttribute("data-field-id", fieldId);
      select.setAttribute("data-dropdown-id", `dd_${fieldId}`);
      select.title = title;
      options.forEach(([value, name]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = name;
        select.appendChild(option);
      });
      return select;
    };
    OPENINGS.OPAQUE.forEach(o => {
      const cell = document.querySelector(`tr[data-id="${OPENINGS.s11RowId(o)}"] td.description-cell`);
      if (!cell || cell.querySelector("select")) return;
      const types = o.group === "above" ? OPENINGS.ABOVE_TYPES : OPENINGS.BELOW_TYPES;
      cell.textContent = "";
      cell.classList.add("opaque-description");
      cell.appendChild(
        makeSelect(`c_${o.s11}`, "opaque-type", "Element type", types.map(t => [t, TYPE_NAMES[t]]))
      );
      if (o.group === "above")
        cell.appendChild(
          makeSelect(
            `cf_${o.s11}`,
            "opaque-facing",
            "Wall facing (F280 Table 3, the cooling calculation's solar)",
            OPENINGS.FACINGS.map(f => [f, OPENINGS.SHORT[f]])
          )
        );
    });
    // The door / window rows: host and quantity beside the name
    OPENINGS.ALL.forEach(o => {
      const cell = document.querySelector(`tr[data-id="${OPENINGS.s11RowId(o)}"] td.description-cell`);
      if (!cell || cell.querySelector("select")) return;
      cell.classList.add("opaque-description");
      cell.appendChild(makeSelect(`ch_${o.s11}`, "opening-host", "Host: the wall or roof this opening sits in", [["", "No host"]]));
      cell.appendChild(
        makeSelect(`dq_${o.s11}`, "opening-qty", "Quantity: identical openings", Array.from({ length: 50 }, (_, i) => [String(i + 1), `× ${i + 1}`]))
      );
    });
    // A wall's (or a roof's) + : an opening born in it (Andy 2026-11-24: up to ten windows in one wall);
    // a hosted row's - takes it out again
    OPENINGS.OPAQUE.forEach(o => {
      const cell = document.querySelector(`tr[data-id="${OPENINGS.s11RowId(o)}"] td.description-cell`);
      if (!cell || cell.querySelector(".host-add")) return;
      const span = document.createElement("span");
      span.className = "host-add";
      ["window", "door"].forEach(kind => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "host-add-btn";
        b.dataset.host = o.s11;
        b.dataset.kind = kind;
        b.textContent = `+ ${kind}`;
        span.appendChild(b);
      });
      cell.appendChild(span);
    });
    OPENINGS.ALL.forEach(o => {
      const cell = document.querySelector(`tr[data-id="${OPENINGS.s11RowId(o)}"] td.description-cell`);
      if (!cell || cell.querySelector(".host-remove-btn")) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "host-remove-btn";
      b.dataset.opening = o.s11;
      b.textContent = "−";
      cell.appendChild(b);
    });
    // A window's overhang in S10, beside its name: H above the head, D projected (F280 Annex A)
    OPENINGS.ALL.forEach(o => {
      if (o.kind === "door") return;
      const cell = document.querySelector(`tr[data-id="${OPENINGS.s10RowId(o)}"] td.description-cell`);
      if (!cell || cell.querySelector(".overhang")) return;
      const span = document.createElement("span");
      span.className = "overhang";
      span.title =
        "Overhang (CSA F280 Annex A): H its height above the window's head, D the depth of the shading or soffit, in m. " +
        "With D and the window's H (S11) given, it sets the Summer Shading % (the shaded fraction of the glass). " +
        "In F280's letters, our H is its D and our D its O. The window's own W x H are in S11.";
      // one microtext caption over two narrow boxes, each saying its letter while empty, as S11's W and H do
      // (Andy 2026-11-25: width is at a premium; the hover spells each out)
      const lead = document.createElement("span");
      lead.className = "overhang-lead";
      lead.textContent = "Overhang";
      span.appendChild(lead);
      const pair = document.createElement("span");
      pair.className = "overhang-pair";
      [
        ["eh", "H", "Height above window head, m"],
        ["ed", "D", "Depth of shading or soffit, projected from the wall, m"],
      ].forEach(([col, letter, meaning]) => {
        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "decimal";
        input.className = "overhang-input";
        input.placeholder = letter;
        input.title = meaning;
        input.dataset.overhang = `${col}_${o.s10}`;
        input.setAttribute("aria-label", meaning);
        pair.appendChild(input);
      });
      span.appendChild(pair);
      cell.appendChild(span);
    });
    const s10 = document.getElementById("envelopeRadiantGains");
    if (s10 && !s10.hasOverhangListener) {
      s10.addEventListener("change", e => {
        const field = e.target?.dataset?.overhang;
        if (!field) return;
        const v = numOrBlank(e.target.value);
        setModeValue(field, v === null ? "" : String(v), "user-modified");
        const o = OPENINGS.ALL.find(r => r.s10 === field.split("_")[1]);
        if (o) applyOverhang(o);
        refreshOpaqueRows();
      });
      s10.hasOverhangListener = true;
    }
    // the latitude (S03's city) or a window's facing moves its overhang's figure
    const SM = window.TEUI.StateManager;
    if (SM?.addListener && !installOpaqueControls.overhangListeners) {
      const again = () => {
        OPENINGS.ALL.forEach(applyOverhang);
        refreshOpaqueRows();
      };
      ["d_19", "h_19", "ref_d_19", "ref_h_19"].forEach(id => SM.addListener(id, again));
      OPENINGS.ALL.filter(o => o.kind !== "door").forEach(o =>
        [`e_${o.s10}`, `ref_e_${o.s10}`].forEach(id =>
          SM.addListener(id, () => {
            applyOverhang(o);
            refreshOpeningRows(window.TEUI.ReferenceToggle?.isReferenceMode() ? "ref_" : "");
          })
        )
      );
      installOpaqueControls.overhangListeners = true;
    }
    const section = document.getElementById("envelopeTransmissionLosses");
    if (section && !section.hasHostButtons) {
      section.addEventListener("click", e => {
        const prefix = window.TEUI.ReferenceToggle?.isReferenceMode() ? "ref_" : "";
        const addBtn = e.target.closest?.(".host-add-btn");
        if (addBtn) {
          const o = OPENINGS.add(addBtn.dataset.kind === "door" ? "doors" : "windows", { host: addBtn.dataset.host, prefix });
          if (o) applyOpeningGeometry(o.s11);
          refreshOpaqueRows();
          // the new row's width is the next thing to type
          if (o) document.querySelector(`td[data-field-id="dl_${o.s11}"]`)?.focus();
          return;
        }
        const removeBtn = e.target.closest?.(".host-remove-btn");
        if (removeBtn) {
          const o = OPENINGS.ALL.find(r => r.s11 === removeBtn.dataset.opening);
          if (o) OPENINGS.takeOut(o, prefix);
          refreshOpaqueRows();
        }
      });
      section.hasHostButtons = true;
    }
    if (section && !section.hasOpaqueListener) {
      section.addEventListener("change", e => {
        const id = e.target?.getAttribute?.("data-field-id") || "";
        if (e.target.tagName !== "SELECT" || !/^(c|cf|ch|dq)_\d+[a-z]*$/.test(id)) return;
        setModeValue(id, e.target.value, "user-modified");
        const s11 = id.split("_")[1];
        if (/^(ch|dq)_/.test(id)) applyOpeningGeometry(s11);
        // a wall's type or facing moves the openings it hosts with it
        else OPENINGS.ALL.filter(o => getModeValue(`ch_${o.s11}`) === s11).forEach(o => applyOpeningGeometry(o.s11));
        refreshOpaqueRows();
      });
      section.hasOpaqueListener = true;
    }
    refreshOpaqueRows();
  }

  /**
   * A door / window row's geometry (Andy 2026-11-24, S11 feeds S10), in the model on screen:
   *   - W x H x quantity given: its S10 area;
   *   - hosted: its S10 orientation is its host's - a wall's facing, a roof's "Skylight"; a wall below
   *     grade (no facing) leaves the row's own.
   * Its host's area nets it (TransmissionLossNodes, transmissionLoss.<row>.area).
   */
  function applyOpeningGeometry(s11) {
    const o = OPENINGS.ALL.find(r => String(r.s11) === String(s11));
    if (!o) return;
    const W = numOrBlank(getModeValue(`dl_${o.s11}`));
    const H = numOrBlank(getModeValue(`dh_${o.s11}`));
    const Q = numOrBlank(getModeValue(`dq_${o.s11}`)) || 1;
    if (W && H) setModeValue(`d_${o.s10}`, String(+(W * H * Q).toFixed(4)), "user-modified");
    const host = OPENINGS.OPAQUE.find(r => String(r.s11) === String(getModeValue(`ch_${o.s11}`) || ""));
    if (host) {
      const prefix = window.TEUI.ReferenceToggle?.isReferenceMode() ? "ref_" : "";
      const type = OPENINGS.typeOf(host, prefix);
      const facing = type === "roof" ? "Skylight" : type === "walls" ? getModeValue(`cf_${host.s11}`) || (OPENINGS.isSlot(host) ? "North" : "Average") : null;
      if (facing && getModeValue(`e_${o.s10}`) !== facing) setModeValue(`e_${o.s10}`, facing, "user-modified");
    }
    applyOverhang(o);
  }

  /** The figure a window's overhang gives its summer slider in the model on screen, or null (the slider is the user's). */
  function overhangPercent(o) {
    if (o.kind === "door") return null;
    const city = window.TEUI.F280Weather?.lookup(getModeValue("d_19"), getModeValue("h_19"));
    return OPENINGS.overhangShading({
      facing: getModeValue(`e_${o.s10}`),
      lat: city?.lat,
      depth: numOrBlank(getModeValue(`ed_${o.s10}`)),
      above: numOrBlank(getModeValue(`eh_${o.s10}`)),
      windowHeight: numOrBlank(getModeValue(`dh_${o.s11}`)),
    });
  }

  /** A window's overhang (F280 Annex A) sets its S10 Summer Shading %, the plain shaded fraction of its glass. */
  function applyOverhang(o) {
    const pct = overhangPercent(o);
    if (pct === null) return;
    const value = String(+pct.toFixed(2));
    if (String(getModeValue(`h_${o.s10}`)) !== value) setModeValue(`h_${o.s10}`, value, "user-modified");
  }

  /** L and H given: the area is their product (in the model on screen); a door / window row's W x H x quantity. */
  function applyLengthHeight(s11) {
    if (OPENINGS.ALL.some(r => String(r.s11) === String(s11))) {
      applyOpeningGeometry(s11);
      refreshOpaqueRows();
      return;
    }
    const L = numOrBlank(getModeValue(`dl_${s11}`));
    const H = numOrBlank(getModeValue(`dh_${s11}`));
    if (L && H) setModeValue(`d_${s11}`, String(+(L * H).toFixed(4)), "user-modified");
    refreshOpaqueRows();
  }

  /**
   * The rows as the model on screen holds them: the type and facing chosen; the facing shown for a wall
   * only; L and H stamped (they are not graph inputs, so no stamp reaches them); the area typed unless L
   * and H give it; and each row numbered by its type, in table order (B.5, then B.5.2 ...).
   */
  function refreshOpaqueRows() {
    const prefix = window.TEUI.ReferenceToggle?.isReferenceMode() ? "ref_" : "";
    const ids = OPENINGS.opaqueIds(prefix);
    OPENINGS.OPAQUE.forEach(o => {
      const type = OPENINGS.typeOf(o, prefix);
      const typeSelect = document.querySelector(`select[data-field-id="c_${o.s11}"]`);
      if (typeSelect && typeSelect.value !== type) typeSelect.value = type;
      const facing = document.querySelector(`select[data-field-id="cf_${o.s11}"]`);
      if (facing) {
        const value = getModeValue(`cf_${o.s11}`);
        if (value && facing.value !== value) facing.value = value;
        facing.style.display = type === "walls" ? "" : "none";
      }
      // its + : a wall takes a window or a door, a roof a skylight; a floor or a slab nothing
      const hostAdd = document.querySelector(`tr[data-id="${OPENINGS.s11RowId(o)}"] .host-add`);
      if (hostAdd) {
        const canHost = ["walls", "wallsBelowGrade", "roof"].includes(type);
        hostAdd.style.display = canHost ? "" : "none";
        hostAdd.querySelectorAll(".host-add-btn").forEach(b => {
          const door = b.dataset.kind === "door";
          const group = door ? "doors" : "windows";
          // written only when it changes: a refresh under the pointer (a W cell's blur on this very click)
          // must not replace the text being clicked, or WebKit drops the click
          const set = (key, value) => {
            if (b[key] !== value) b[key] = value;
          };
          b.style.display = door && type === "roof" ? "none" : "";
          set("textContent", door ? "+ door" : type === "roof" ? "+ skylight" : "+ window");
          set("disabled", !OPENINGS.nextFree(group));
          set(
            "title",
            b.disabled
              ? `Every ${door ? "door" : "window"} row is in use`
              : `A new ${door ? "door" : type === "roof" ? "skylight" : "window"} row in ${ids[o.s11] || TYPE_NAMES[type]}: give it W × H`
          );
        });
      }
      const L = numOrBlank(getModeValue(`dl_${o.s11}`));
      const H = numOrBlank(getModeValue(`dh_${o.s11}`));
      ["dl", "dh"].forEach(col => {
        const td = document.querySelector(`td[data-field-id="${col}_${o.s11}"]`);
        if (td && document.activeElement !== td) {
          const v = col === "dl" ? L : H;
          td.textContent = v ? formatNumber(v, "number") : "";
        }
      });
      const area = document.querySelector(`td[data-field-id="d_${o.s11}"]`);
      if (area) {
        const fromLH = !!(L && H);
        area.contentEditable = fromLH ? "false" : "true";
        area.classList.toggle("opaque-area-from-lh", fromLH);
        // the area as entered, and net of the openings it hosts (the area every calculation reads)
        const hosted = OPENINGS.ALL.filter(r => String(getModeValue(`ch_${r.s11}`) || "") === String(o.s11));
        const entered = numOrBlank(getModeValue(`d_${o.s11}`)) || 0;
        const net = entered - hosted.reduce((sum, r) => sum + (numOrBlank(getModeValue(`d_${r.s10}`)) || 0), 0);
        const netText = !hosted.length
          ? ""
          : net < 0
            ? `its ${hosted.length} hosted opening${hosted.length > 1 ? "s" : ""} exceed it: no area (Unavailable)`
            : `net of its ${hosted.length} hosted opening${hosted.length > 1 ? "s" : ""}: ${formatNumber(net, "number")} m²`;
        area.title = [fromLH ? "L × H (clear L or H to type the area)" : "", netText].filter(Boolean).join("; ");
        area.classList.toggle("opaque-area-hosts", hosted.length > 0);
        // and on the row itself, beside its name: what every calculation reads
        const desc = document.querySelector(`tr[data-id="${OPENINGS.s11RowId(o)}"] td.description-cell`);
        if (desc) {
          let badge = desc.querySelector(".opaque-net");
          if (!badge) {
            badge = document.createElement("span");
            badge.className = "opaque-net";
            desc.appendChild(badge);
          }
          badge.textContent = !hosted.length ? "" : net < 0 ? "net: Unavailable" : `net ${formatNumber(net, "number")} m²`;
          badge.title = netText;
        }
      }
      const idCell = document.querySelector(`tr[data-id="${OPENINGS.s11RowId(o)}"]`)?.children[1];
      if (idCell && ids[o.s11]) idCell.textContent = ids[o.s11];
    });
    refreshOpeningRows(prefix);
  }

  /**
   * The door / window rows as the model on screen holds them: each host dropdown lists the opaque rows
   * shown, named as S11 names them ("B.5.2 Wall above grade · N"); host, quantity, W and H stamped; and
   * in S10, the area is W x H x quantity when they are given and the orientation the host's when hosted
   * (neither typable there then).
   */
  function refreshOpeningRows(prefix) {
    const ids = OPENINGS.opaqueIds(prefix);
    // a host is a wall (above or below grade) or a roof: an exposed floor or a slab holds no opening
    const shownOpaque = OPENINGS.OPAQUE.filter(r => OPENINGS.isShown(r) && ["walls", "wallsBelowGrade", "roof"].includes(OPENINGS.typeOf(r, prefix)));
    // a door sits in a wall, never a roof (Andy 2026-11-25)
    const doorHosts = shownOpaque.filter(r => OPENINGS.typeOf(r, prefix) !== "roof");
    OPENINGS.ALL.forEach(o => {
      const host = String(getModeValue(`ch_${o.s11}`) || "");
      const hostSelect = document.querySelector(`select[data-field-id="ch_${o.s11}"]`);
      if (hostSelect) {
        const options = [["", "No host"], ...(o.kind === "door" ? doorHosts : shownOpaque).map(r => [String(r.s11), OPENINGS.opaqueName(r, prefix)])];
        if (host && !options.some(([v]) => v === host)) options.push([host, `${host} (hidden row)`]);
        const want = JSON.stringify(options);
        if (hostSelect.dataset.options !== want) {
          hostSelect.textContent = "";
          options.forEach(([value, name]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = name;
            hostSelect.appendChild(option);
          });
          hostSelect.dataset.options = want;
        }
        if (hostSelect.value !== host) hostSelect.value = host;
      }
      const qty = document.querySelector(`select[data-field-id="dq_${o.s11}"]`);
      const q = String(numOrBlank(getModeValue(`dq_${o.s11}`)) || 1);
      if (qty && qty.value !== q) qty.value = q;
      const W = numOrBlank(getModeValue(`dl_${o.s11}`));
      const H = numOrBlank(getModeValue(`dh_${o.s11}`));
      ["dl", "dh"].forEach(col => {
        const td = document.querySelector(`td[data-field-id="${col}_${o.s11}"]`);
        if (td && document.activeElement !== td) {
          const v = col === "dl" ? W : H;
          td.textContent = v ? formatNumber(v, "number") : "";
        }
      });
      const s10Area = document.querySelector(`td[data-field-id="d_${o.s10}"]`);
      if (s10Area) {
        const fromWH = !!(W && H);
        s10Area.contentEditable = fromWH ? "false" : "true";
        s10Area.classList.toggle("opaque-area-from-lh", fromWH);
        s10Area.title = fromWH ? `W × H × quantity, from S11 ${OPENINGS.s11RowId(o)} (clear W or H there to type the area)` : "";
      }
      const hostRow = host && OPENINGS.OPAQUE.find(r => String(r.s11) === host);
      const removeBtn = document.querySelector(`tr[data-id="${OPENINGS.s11RowId(o)}"] .host-remove-btn`);
      if (removeBtn) {
        removeBtn.style.display = hostRow ? "" : "none";
        removeBtn.title = hostRow ? `Take this ${o.kind === "door" ? "door" : "opening"} out of ${ids[host] || host} (its host, W, H, quantity and area cleared, in this model)` : "";
      }
      // S10 says where it sits: "in B.5.2"
      const s10Desc = document.querySelector(`tr[data-id="${OPENINGS.s10RowId(o)}"] td.description-cell`);
      if (s10Desc) {
        let note = s10Desc.querySelector(".opening-host-note");
        if (hostRow && !note) {
          note = document.createElement("span");
          note.className = "opening-host-note";
          s10Desc.appendChild(note);
        }
        if (note) {
          note.textContent = hostRow ? `in ${ids[host] || host}` : "";
          note.title = hostRow ? `Hosted in S11 ${OPENINGS.opaqueName(hostRow, prefix)}` : "";
        }
      }
      // its overhang: H and D as held (not on a skylight: Annex A has no row for it); while they give a
      // figure, the summer slider shows it and is not draggable
      const overhangSpan = document.querySelector(`tr[data-id="${OPENINGS.s10RowId(o)}"] .overhang`);
      if (overhangSpan) overhangSpan.style.display = getModeValue(`e_${o.s10}`) === "Skylight" ? "none" : "";
      document.querySelectorAll(`tr[data-id="${OPENINGS.s10RowId(o)}"] .overhang-input`).forEach(input => {
        if (document.activeElement === input) return;
        const v = numOrBlank(getModeValue(input.dataset.overhang));
        input.value = v ? String(v) : "";
      });
      const slider = document.querySelector(`input[type="range"][data-field-id="h_${o.s10}"]`);
      if (slider) {
        const pct = overhangPercent(o);
        const fromOverhang = pct !== null;
        slider.disabled = fromOverhang;
        slider.title = fromOverhang ? `From its overhang (F280 Annex A): ${pct.toFixed(1)} % of the glass shaded. Clear D to set it by hand.` : "";
        if (fromOverhang) {
          const held = getModeValue(`h_${o.s10}`);
          const def = window.TEUI.FieldManager?.getField?.(`h_${o.s10}`);
          if (def && String(slider.value) !== String(Math.round(parseFloat(held)))) window.TEUI.FieldManager.updateFieldDisplay(`h_${o.s10}`, String(held), def);
        }
      }
      const orientation = document.querySelector(`select[data-field-id="e_${o.s10}"]`);
      if (orientation) {
        const fromHost = !!hostRow && ["walls", "roof"].includes(OPENINGS.typeOf(hostRow, prefix));
        orientation.disabled = fromHost;
        // the host set it through the StateManager, which stamps no dropdown: show what it holds
        const held = getModeValue(`e_${o.s10}`);
        if (fromHost && held && orientation.value !== held) orientation.value = held;
        orientation.title = fromHost ? `From its host, S11 ${OPENINGS.opaqueName(hostRow, prefix)}` : "";
      }
    });
    arrangeRows(prefix);
  }

  /**
   * Each wall's and roof's openings indented UNDER it (Andy 2026-11-24), in the model on screen; the rest
   * stay in their own groups, doors then windows. A group's +/- sit on its first row left in the group.
   * A row is moved only when it is out of place, so a cell being typed into keeps its focus.
   */
  function arrangeRows(prefix) {
    const tr = o => document.querySelector(`tr[data-id="${OPENINGS.s11RowId(o)}"]`);
    const hostOf = o => {
      const h = String(getModeValue(`ch_${o.s11}`) || "");
      const row = h && OPENINGS.OPAQUE.find(r => String(r.s11) === h);
      return row && OPENINGS.isShown(row) ? row : null;
    };
    const openings = [...OPENINGS.DOORS, ...OPENINGS.WINDOWS];
    const under = r => openings.filter(o => hostOf(o) === r);
    const order = [
      ...OPENINGS.ABOVE.flatMap(r => [r, ...under(r)]),
      ...openings.filter(o => !hostOf(o)),
      ...OPENINGS.BELOW.flatMap(r => [r, ...under(r)]),
    ];
    const rows = order.map(tr);
    if (rows.some(r => !r)) return;
    let prev = rows[0].previousElementSibling;
    rows.forEach(row => {
      if (prev && prev.nextElementSibling !== row) prev.after(row);
      prev = row;
    });
    openings.forEach(o => tr(o).classList.toggle("opening-hosted", !!hostOf(o)));
    ["doors", "windows"].forEach(group => {
      const controls = document.querySelector(`.openings-controls[data-section="s11"][data-group="${group}"]`);
      if (!controls) return;
      const g = OPENINGS.GROUPS[group].rows;
      const home = g.find(o => OPENINGS.isShown(o) && !hostOf(o)) || g[0];
      const cell = tr(home).firstElementChild;
      if (controls.parentElement !== cell) {
        controls.parentElement.classList.remove("expandable-row-trigger");
        cell.classList.add("expandable-row-trigger");
        cell.appendChild(controls);
      }
    });
  }

  function onSectionRendered() {
    console.log("S11: Section rendered.");

    // Initialize event handlers for this section
    initializeEventHandlers();

    // S10-S11 AREA SYNC: Mark S11 as initialized (CRITICAL for crash prevention)
    isS11Initialized = true;
    console.log(
      "[S11 Area Sync] S11 initialization complete - sync functions now enabled"
    );

    // Graph handles initial calculations via dependency chain
    isInitializationPhase = false;

    // The openings' twins show and hide with their S10 rows; S11's +/- do the same as S10's
    OPENINGS.installControls("S11");
    installOpaqueControls();
    document.addEventListener("teui-openings-changed", () => {
      OPENINGS.applyVisibility("S11");
      refreshOpaqueRows();
    });

    // Apply validation tooltips to fields
    if (window.TEUI.TooltipManager && window.TEUI.TooltipManager.initialized) {
      setTimeout(() => {
        window.TEUI.TooltipManager.applyTooltipsToSection(sectionRows);
      }, 300);
    }
  }

  // referenceHandler removed — graph handles reference model

  //==========================================================================
  // PUBLIC API
  //==========================================================================
  return {
    getFields,
    getDropdownOptions,
    getLayout,
    initializeEventHandlers,
    onSectionRendered,
    // After each stamp: an opening's twin shows when its S10 row does
    postStamp: () => {
      OPENINGS.applyVisibility("S11");
      refreshOpaqueRows();
    },
    // S10 area sync for FileHandler post-import call
    syncAreasFromS10: syncAreasFromS10,

    // ✅ FIX (Nov 2): Expose import flag control for FileHandler
    setImportActive: active => {
      isImportActive = active;
      console.log(
        `[S11 Area Sync] Import phase ${active ? "STARTED" : "ENDED"} - Dual-state sync ${active ? "ENABLED" : "DISABLED"}`
      );
    },
  };
})();

