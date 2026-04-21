// dependency-graph.mjs
// Skeleton BEAMweb dependency-graph renderer. Interface-compatible with
// OBJECTIVE's 4011-Dependency.js so the full D3 + dagre port drops in
// with minimal glue when the BEAMweb.md §8 migration trigger fires.
//
// Today this stub:
//   - Reads StateManager.exportDependencyGraph() and renders a text
//     summary (architecture + field-edge counts) inside the tab body.
//   - Exposes the same `initialize()` + `render()` shape that
//     OBJECTIVE's DependencyGraph class exposes. Porting the D3 render
//     path from OBJECTIVE is a mostly-mechanical substitution once
//     the migration runs.
//
// Method signatures kept verbatim where practical:
//   constructor(containerSelector)
//   initialize()  → boolean
//   setupSvg()
//   createFilterControls(parent)
//   createInfoPanel(parent)
//   render()
//   toggleLegend()  (stub)
//   resetView()     (stub)
//   toggleFullscreen()  (stub)
//
// Full D3 rendering, force/dagre layout switching, node highlighting,
// and fullscreen floating info panels all live inside `render()`.
// Until the port lands, `render()` draws the architecture + edge
// totals so developers can verify the pipe end-to-end.

import { StateManager } from "../shared/state-manager.mjs";

const DEFAULT_CONTAINER =
  "#bw-depgraph .bw-depgraph-container";

export class DependencyGraph {
  constructor(containerSelector) {
    this.containerSelector = containerSelector || DEFAULT_CONTAINER;
    this.data = null;
    this.layout = "dagre"; // matches OBJECTIVE default
    this.infoPanel = null;
    this.legendVisible = false;
  }

  // Pull graph data from StateManager. Returns true on success so
  // callers can short-circuit the rest of the pipeline on failure —
  // OBJECTIVE's Dependency.js uses the same boolean contract.
  initialize() {
    try {
      this.data = StateManager.exportDependencyGraph({
        mode: "target",
        includeArchitectural: true
      });
      return !!this.data;
    } catch (err) {
      console.error("[DependencyGraph] initialize failed:", err);
      this._showErrorMessage(`Initialization failed: ${err.message}`);
      return false;
    }
  }

  setupSvg() {
    // No-op in the stub. The full port instantiates a d3 selection,
    // zoom behaviour, arrowhead marker, and a `g.graph-content` group
    // inside the container — see OBJECTIVE Dependency.js setupSvg().
  }

  createFilterControls(parentElement) {
    if (!parentElement) return;
    const existing = parentElement.querySelector(".dependency-graph-controls");
    if (existing) existing.remove();

    const wrap = document.createElement("div");
    wrap.className = "dependency-graph-controls";

    const activate = document.createElement("button");
    activate.id = "bwDepActivateBtn";
    activate.className = "btn btn-primary btn-sm";
    activate.textContent = "Refresh snapshot";
    activate.addEventListener("click", () => {
      if (this.initialize()) this.render();
    });

    const note = document.createElement("span");
    note.className = "bw-depgraph-note";
    note.textContent =
      "Stub renderer — see BEAMweb.md §8 for the full D3/dagre port trigger.";

    wrap.appendChild(activate);
    wrap.appendChild(note);
    parentElement.appendChild(wrap);
  }

  createInfoPanel(parentElement) {
    if (!parentElement) return;
    const existing = parentElement.querySelector(".dependency-info-panel");
    if (existing) existing.remove();

    const panel = document.createElement("div");
    panel.className = "dependency-info-panel alert alert-secondary";
    panel.style.display = "none";

    const title = document.createElement("h6");
    title.className = "info-title";
    title.textContent = "Field Information";

    const value = document.createElement("p");
    value.className = "info-value";
    const deps = document.createElement("p");
    deps.className = "info-dependencies";
    const dependents = document.createElement("p");
    dependents.className = "info-dependents";

    panel.appendChild(title);
    panel.appendChild(value);
    panel.appendChild(deps);
    panel.appendChild(dependents);
    parentElement.prepend(panel);
    this.infoPanel = panel;
  }

  render() {
    const container = document.querySelector(this.containerSelector);
    if (!container) return;
    if (!this.data) this.initialize();
    const { nodes, links, meta } = this.data || { nodes: [], links: [], meta: {} };

    container.innerHTML = this._renderSnapshotHtml(nodes, links, meta);
  }

  toggleLegend() {
    this.legendVisible = !this.legendVisible;
    // Full port swaps the legend element's display; stub just tracks state.
  }

  resetView() {
    // Full port calls `d3.zoomIdentity` + fitGraphToContainer(). Stub no-op.
  }

  toggleFullscreen() {
    // Full port requests fullscreen on the SVG wrapper + clones controls.
    // Stub no-op.
  }

  // ── internals ─────────────────────────────────────────

  _renderSnapshotHtml(nodes, links, meta) {
    const archNodes = nodes.filter(n => n.type === "module");
    const fieldNodes = nodes.filter(n => n.type === "field");
    const archLinks = links.filter(l => l.dependencyMode === "architectural");
    const fieldLinks = links.filter(l => l.dependencyMode !== "architectural");

    const archByLayer = {};
    for (const node of archNodes) {
      const layer = node.architecturalLayer || "Other";
      if (!archByLayer[layer]) archByLayer[layer] = [];
      archByLayer[layer].push(node);
    }

    const layerOrder = ["Foundation", "Coordination", "Application"];
    const layerBlocks = layerOrder
      .filter(layer => archByLayer[layer])
      .map(layer => {
        const items = archByLayer[layer]
          .map(
            node =>
              `<li><strong>${escapeHtml(node.label || node.id)}</strong>${
                node.description ? ` — <span class="bw-depgraph-desc">${escapeHtml(node.description)}</span>` : ""
              }</li>`
          )
          .join("");
        return `
          <div class="bw-depgraph-layer bw-depgraph-layer-${layer.toLowerCase()}">
            <h6>${escapeHtml(layer)}</h6>
            <ul>${items}</ul>
          </div>`;
      })
      .join("");

    const generatedAt = meta && meta.generatedAt ? new Date(meta.generatedAt).toLocaleString() : "—";

    return `
      <div class="bw-depgraph-snapshot">
        <div class="bw-depgraph-stats">
          <div><span class="bw-depgraph-stat-label">Architecture nodes</span><strong>${archNodes.length}</strong></div>
          <div><span class="bw-depgraph-stat-label">Architecture edges</span><strong>${archLinks.length}</strong></div>
          <div><span class="bw-depgraph-stat-label">Field nodes</span><strong>${fieldNodes.length}</strong></div>
          <div><span class="bw-depgraph-stat-label">Field edges</span><strong>${fieldLinks.length}</strong></div>
          <div><span class="bw-depgraph-stat-label">Snapshot</span><strong>${escapeHtml(generatedAt)}</strong></div>
        </div>
        <div class="bw-depgraph-layers">${layerBlocks}</div>
        ${fieldLinks.length === 0
          ? `<p class="bw-depgraph-empty">No field-level dependencies registered yet. They light up when <code>auto-fill.mjs</code>'s PROJECT→F&amp;S listeners get rewritten as <code>StateManager.registerDependency()</code> edges (BEAMweb.md §8 migration).</p>`
          : `<p class="bw-depgraph-empty">${fieldLinks.length} field edges registered. Full graph port will render them via d3 + dagre.</p>`}
      </div>`;
  }

  _showErrorMessage(message) {
    const container = document.querySelector(this.containerSelector);
    if (container) container.innerHTML = `<div class="alert alert-danger">${escapeHtml(message)}</div>`;
  }
}

function escapeHtml(input) {
  const str = input == null ? "" : String(input);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
