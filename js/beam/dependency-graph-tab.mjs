// dependency-graph-tab.mjs
// Thin tab module mirroring OBJECTIVE's Section17.js shape. Owns the
// HTML skeleton (controls wrapper + info wrapper + graph container)
// and delegates rendering to the DependencyGraph class in
// ./dependency-graph.mjs.
//
// Sits dormant until the user opens the tab; activation clicks
// lazy-instantiate the DependencyGraph, which in turn reads
// StateManager.exportDependencyGraph() and renders the stub snapshot.
// When the §8 migration lands, this file stays put — only
// DependencyGraph.render() gets replaced with the ported D3 logic.

import { DependencyGraph } from "./dependency-graph.mjs";

let graphInstance = null;

export function renderDependencyGraphPanel() {
  // OBJECTIVE wraps the graph inside three sibling containers: a
  // controls wrapper, an info wrapper, and the SVG container. Same
  // structure here so the CSS (ported from OBJECTIVE styles.css)
  // lines up 1:1.
  return `
    <div id="bw-depgraph" class="bw-depgraph">
      <div class="bw-depgraph-intro">
        <h3>Dependency Graph</h3>
        <p>
          Stub view of the BEAMweb state architecture — Foundation modules
          (state + storage), Coordination modules (bridges + orchestration),
          and Application tabs. The full D3 + dagre visualiser ports from
          OBJECTIVE when we hit the migration trigger in
          <code>BEAMweb.md §8</code>.
        </p>
      </div>
      <div class="dependency-graph-controls-wrapper mb-3"></div>
      <div class="dependency-graph-info-wrapper mb-3"></div>
      <div class="bw-depgraph-container">
        <p class="bw-depgraph-empty">Click <strong>Activate Graph</strong> to render the current snapshot.</p>
      </div>
      <div class="bw-depgraph-actions">
        <button class="beam-action-btn primary" id="bwDepTabActivateBtn">
          Activate Graph
        </button>
      </div>
    </div>
  `;
}

export function wireDependencyGraphTab() {
  const activateBtn = document.getElementById("bwDepTabActivateBtn");
  if (!activateBtn) return;
  activateBtn.addEventListener("click", () => {
    if (!graphInstance) {
      graphInstance = new DependencyGraph("#bw-depgraph .bw-depgraph-container");
      const controlsWrap = document.querySelector(
        "#bw-depgraph .dependency-graph-controls-wrapper"
      );
      const infoWrap = document.querySelector(
        "#bw-depgraph .dependency-graph-info-wrapper"
      );
      if (controlsWrap) graphInstance.createFilterControls(controlsWrap);
      if (infoWrap) graphInstance.createInfoPanel(infoWrap);
    }
    if (graphInstance.initialize()) {
      graphInstance.render();
      activateBtn.textContent = "Refresh Graph";
    }
  });
}

// Section17-style no-ops so the FieldManager-equivalent pattern can
// register this tab without blowing up. BEAMweb uses a simpler tab
// model than OBJECTIVE's FieldManager, so these hooks are scaffolding
// for the day a richer pattern is introduced.
export function getFields() {
  return {};
}
export function getLayout() {
  return { rows: [] };
}
