/**
 * PDF-Parser — Configuration & Constants
 */

export var VERSION = "0.1.0";
export var STEP = 1;

/* ── Rendering ────────────────────────────────────────── */

export var DEFAULT_DPI = 150;
export var MEASURE_DPI = 300;
export var THUMB_WIDTH = 180;
export var SNAP_RADIUS_PX = 8;

/* ── Sheet classification prefixes ────────────────────── */

export var SHEET_PREFIXES = {
  "A0": "general",
  "A1": "site",
  "A2": "plan",
  "A3": "plan",
  "A4": "elevation",
  "A5": "section",
  "A6": "detail",
  "A7": "interior",
  "A8": "schedule",
  "A9": "3d",
  "S":  "structural",
  "M":  "mechanical",
  "E":  "electrical",
  "P":  "plumbing"
};

/* ── Scale patterns (regex) ───────────────────────────── */

export var SCALE_PATTERNS = [
  { regex: /[Ss]cale[\s:]*1\s*:\s*(\d+)/,          type: "metric",   extract: function(m) { return parseInt(m[1], 10); } },
  { regex: /\b1\s*:\s*(\d+)\b/,                     type: "metric",   extract: function(m) { return parseInt(m[1], 10); } },
  { regex: /(\d+)\/(\d+)"\s*=\s*1'-0"/,             type: "imperial", extract: function(m) { return 12 * parseInt(m[2], 10) / parseInt(m[1], 10); } },
  { regex: /\bN\.?T\.?S\.?\b|NOT\s+TO\s+SCALE/i,   type: "nts",      extract: function()  { return null; } }
];

/* ── Polygon colours ──────────────────────────────────── */

export var POLY_COLORS = [
  "#e63946", "#457b9d", "#2a9d8f", "#e9c46a",
  "#f4a261", "#264653", "#a8dadc", "#6a0572"
];

/* ── Unit conversion ──────────────────────────────────── */

export var UNITS = {
  m:  { label: "metres",       toM: 1 },
  mm: { label: "millimetres",  toM: 0.001 },
  ft: { label: "feet",         toM: 0.3048 },
  in: { label: "inches",       toM: 0.0254 }
};

export var M2_TO_FT2 = 10.7639;

/* ── Common drawing scales ────────────────────────────── */

export var METRIC_SCALES = [
  { label: "1:1",    ratio: 1 },
  { label: "1:2",    ratio: 2 },
  { label: "1:5",    ratio: 5 },
  { label: "1:10",   ratio: 10 },
  { label: "1:20",   ratio: 20 },
  { label: "1:25",   ratio: 25 },
  { label: "1:48",   ratio: 48 },
  { label: "1:50",   ratio: 50 },
  { label: "1:75",   ratio: 75 },
  { label: "1:100",  ratio: 100 },
  { label: "1:125",  ratio: 125 },
  { label: "1:150",  ratio: 150 },
  { label: "1:200",  ratio: 200 },
  { label: "1:250",  ratio: 250 },
  { label: "1:500",  ratio: 500 },
  { label: "1:1000", ratio: 1000 }
];

export var IMPERIAL_SCALES = [
  { label: '1" = 1\' (1:12)',     ratio: 12 },
  { label: '3/4" = 1\' (1:16)',   ratio: 16 },
  { label: '1/2" = 1\' (1:24)',   ratio: 24 },
  { label: '3/8" = 1\' (1:32)',   ratio: 32 },
  { label: '1/4" = 1\' (1:48)',   ratio: 48 },
  { label: '3/16" = 1\' (1:64)',  ratio: 64 },
  { label: '1/8" = 1\' (1:96)',   ratio: 96 },
  { label: '3/32" = 1\' (1:128)', ratio: 128 },
  { label: '1/16" = 1\' (1:192)', ratio: 192 }
];

/* ── Classification enum ──────────────────────────────── */

export var CLASS = {
  PLAN:       "plan",
  SECTION:    "section",
  ELEVATION:  "elevation",
  SCHEDULE:   "schedule",
  DETAIL:     "detail",
  SITE:       "site",
  GENERAL:    "general",
  STRUCTURAL: "structural",
  OTHER:      "other"
};
