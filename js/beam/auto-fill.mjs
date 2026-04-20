// auto-fill.mjs
// PROJECT-tab → assembly-tab quantity bridge.
//
// When a user types a dimension into PROJECT (e.g. dim_foundation_slab_floor_area
// = 110.4 m²), every material row in the F&S "CONCRETE SLABS" group's qty input
// fills with that value as VALUE_STATES.DERIVED.
//
// Precedence — only USER_MODIFIED on the F&S row is sticky. The bridge
// overrides IMPORTED, DERIVED, CALCULATED, and null. This matches the
// stated state model:
//
//   USER_MODIFIED  >  everything else
//   (a fresh import / sample-load can still overwrite USER_MODIFIED via
//    explicit setValue from the loader — IMPORTED's "win" comes from
//    being chronologically latest, not from a precedence rule.)
//
// Practical effect after Load Sample: changing a PROJECT area pushes the
// new value into every related F&S row, even those the sample had marked
// IMPORTED. Only rows the user hand-edited stay put.
//
// Mapping table is keyed off the parsed group `name` (column A in the BEAM
// CSV banner row), case-insensitive. Group names that don't appear here have
// no PROJECT auto-fill — qty stays at user input or 0.
//
// Add new mappings here as Phase 4 tabs land.

import { StateManager } from "../shared/state-manager.mjs";
import { codeToDomKey } from "./assembly-csv-parser.mjs";
import { refreshFootingsSlabsTab } from "./footings-slabs-tab.mjs";

const VS = StateManager.VALUE_STATES;

// PROJECT field id → array of F&S group names whose per-row qty should mirror it.
//
// Group names match the F&S CSV column-A banners (case- and whitespace-
// insensitive — see findGroup). When porting Phase 4 tabs, add new entries
// keyed by the same PROJECT field id (or new dim_* fields) and the relevant
// per-tab group names.
//
// Excluded by design (groups have their own group-config quantity field
// instead of a PROJECT auto-fill source):
//   - METAL PILE FOUNDATIONS / TIMBER PILE FOUNDATION (own TOTAL LENGTH /
//     TOTAL VOLUME at group banner)
//   - REBAR FOR CONTINUOUS FOOTINGS / COLUMN FOOTINGS / SLABS
//     (own TOTAL REBAR LENGTH at group banner)
const PROJECT_TO_FS_GROUPS = {
  dim_continuous_footings_volume: ["CONTINUOUS CONCRETE FOOTINGS"],
  dim_columns_piers_pads_volume: ["CONCRETE COLUMN PADS & PIERS"],
  dim_foundation_slab_floor_area: [
    "CONCRETE SLABS",
    "EARTHEN FLOOR SYSTEMS",
    "REINFORCING MESH FOR SLAB",
    "SUB-SLAB INSULATION",
    "BARRIERS AND MEMBRANES",
    "BASEMENT FLOORING",
    "AGGREGATE BASE"
  ]
};

let registered = false;
let cachedParsedFs = null;

function findGroup(parsedFs, groupName) {
  if (!parsedFs) return null;
  // CSV banner names sometimes carry trailing whitespace ("EARTHEN FLOOR
  // SYSTEMS  "). Trim both sides before comparing so the mapping table can
  // use clean labels.
  const target = groupName.trim().toUpperCase();
  return parsedFs.groups.find((g) => g.name && g.name.trim().toUpperCase() === target) || null;
}

function applyOneSource(parsedFs, projectKey, value) {
  const targets = PROJECT_TO_FS_GROUPS[projectKey];
  if (!targets) return false;
  const num = StateManager.parseNumeric(value, 0);
  const writeVal = num > 0 ? String(num) : "";
  let touched = false;

  StateManager.muteListeners();
  try {
    for (const groupName of targets) {
      const group = findGroup(parsedFs, groupName);
      if (!group) continue;
      for (const sub of group.subgroups) {
        for (const m of sub.materials) {
          // Per-row state key — shared codeToDomKey() helper (the same one
          // F&S uses when binding inputs) keeps both sides in sync. If you
          // change the key shape, only the helper has to move.
          const fId = `fs_${codeToDomKey(m)}_qty`;
          const st = StateManager.getFieldState(fId);
          // Only user-typed values are sticky. Bridge overrides IMPORTED
          // (sample-loaded) + DERIVED + CALCULATED + null.
          if (st === VS.USER_MODIFIED) continue;
          StateManager.setValue(fId, writeVal, VS.DERIVED);
          touched = true;
        }
      }
    }
  } finally {
    StateManager.unmuteListeners();
  }
  return touched;
}

// Register once. Subsequent calls (from re-wiring after a CSV reparse) replace
// the cached parsedFs — listeners stay attached and use the new reference.
export function registerProjectToFsBridge(parsedFs) {
  cachedParsedFs = parsedFs;
  if (registered) {
    // Re-sync against new parsedFs without re-registering listeners.
    syncProjectToFsBridge();
    return;
  }
  registered = true;

  for (const projectKey of Object.keys(PROJECT_TO_FS_GROUPS)) {
    StateManager.addListener(projectKey, (newValue) => {
      const touched = applyOneSource(cachedParsedFs, projectKey, newValue);
      if (touched) refreshFootingsSlabsTab();
    });
  }
  syncProjectToFsBridge();
}

// Walk every PROJECT source key and push current values to F&S targets.
// Used on init, after sample-load, and after F&S Reset.
export function syncProjectToFsBridge() {
  if (!cachedParsedFs) return;
  let touched = false;
  for (const projectKey of Object.keys(PROJECT_TO_FS_GROUPS)) {
    const v = StateManager.getValue(projectKey);
    if (v === null || v === "") continue;
    if (applyOneSource(cachedParsedFs, projectKey, v)) touched = true;
  }
  if (touched) refreshFootingsSlabsTab();
}
