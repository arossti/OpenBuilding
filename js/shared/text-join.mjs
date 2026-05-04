/**
 * Shared text-join logic for pdf.js getTextContent() output.
 *
 * Both the browser EPD-Parser (js/epdparser.mjs) and the Node harness
 * (schema/scripts/test-epd-extract.mjs) use this to convert raw pdf.js
 * text items into the spatially-joined per-page text strings that
 * js/epd/extract.mjs then consumes.
 *
 * Why shared: browser pdfjs (full UI build) and Node pdfjs-dist/legacy
 * tokenise the same PDF differently — full pdfjs fragments composite
 * tokens like "-953.23" → ["-", "953.23"] and "2.27E-06" → ["2.27E",
 * "-", "06"] (touching, < 1.5px gap). Node keeps them as single items.
 * Without a shared joiner, the harness silently uses different text
 * input than the browser, and any regex bug that depends on browser-
 * specific fragmentation goes undetected.
 *
 * Item shape (input):
 *   { str: string, x: number, y: number, width?: number, height?: number }
 *   x, y are in canvas-coordinate space (y already inverted from PDF
 *   bottom-origin to top-origin). width is the rendered width of the
 *   item — required for the implicit-space gating heuristic; if absent,
 *   the joiner falls back to inserting space whenever neither side
 *   carries explicit whitespace (legacy behaviour).
 *
 * Implicit-space heuristic:
 *   - Items on the same line (Δy ≤ 3px) sorted by x.
 *   - Between adjacent items, insert a space ONLY when the visible
 *     x-gap (item.x − (prev.x + prev.width)) exceeds 1.5px AND neither
 *     side already carries whitespace. pdf.js emits explicit space items
 *     wherever a real visible space appears, so most word boundaries are
 *     handled by those. The implicit-space rule is defensive against
 *     non-standard typography (justified text where the inter-word space
 *     is rendered as a positional offset).
 *   - Touching fragments (gap < 1.5px) — the negative-sign of a number,
 *     the exponent of scientific notation — are concatenated directly,
 *     preserving the composite token.
 */

const Y_TOLERANCE = 3;
const GAP_THRESHOLD_PX = 1.5;

export function itemsToLines(items) {
  if (!items || items.length === 0) return "";
  const sorted = items.slice().sort((a, b) => a.y - b.y);
  const lines = [];
  let curr = [];
  let cy = null;
  for (const it of sorted) {
    if (cy === null || it.y - cy > Y_TOLERANCE) {
      if (curr.length) lines.push(flushLine(curr));
      curr = [it];
      cy = it.y;
    } else {
      curr.push(it);
    }
  }
  if (curr.length) lines.push(flushLine(curr));
  return lines.join("\n");
}

export function flushLine(line) {
  line.sort((a, b) => a.x - b.x);
  let out = "";
  let prev = null;
  for (const item of line) {
    const s = item.str;
    if (out.length && prev) {
      const prevRight = prev.x + (prev.width || 0);
      const gap = item.x - prevRight;
      const hasOwnWs = /\s$/.test(out) || /^\s/.test(s);
      // Width-aware path: insert implicit space only when there's a real
      // visible gap. Width-absent path (legacy): insert space whenever
      // neither side has whitespace, matching pre-rev-3 behaviour for
      // callers that haven't migrated to providing item.width.
      const widthAware = "width" in item && item.width != null;
      if (widthAware) {
        if (!hasOwnWs && gap > GAP_THRESHOLD_PX) out += " ";
      } else {
        if (!hasOwnWs) out += " ";
      }
    }
    out += s;
    prev = item;
  }
  return out;
}
