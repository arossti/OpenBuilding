// html-utils.mjs
// App-agnostic HTML helpers used by any module that templates markup
// via string concatenation. Consolidated from four near-identical copies
// (`esc` in beam/project-tab.mjs + beam/footings-slabs-tab.mjs;
// `escapeHtml` in beamweb.mjs + database.mjs) that had drifted in null-
// handling but not in output.
//
// Canonical export name is `esc` (short, predominant in beam/* modules).

const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

// Escape the five HTML-significant characters. Accepts any value; null
// and undefined both render as empty string (matches the prior behaviour
// of both the `esc` and `escapeHtml` variants).
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);
}
