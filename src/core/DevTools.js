/**
 * DevTools.js - Developer Tools for New Computation System Validation
 *
 * Provides UI controls for:
 * - Comparing old vs new computation systems
 * - Running the new system independently
 * - Debugging and diagnostics
 */
(function () {
  "use strict";

  window.TEUI = window.TEUI || {};

  /**
   * Initialize dev tools - attach event listeners
   */
  function initialize() {
    document.addEventListener('DOMContentLoaded', () => {
      const validateBtn = document.getElementById('validateSystemBtn');
      const detailedBtn = document.getElementById('detailedValidationBtn');
      const computeBtn = document.getElementById('computeSystemBtn');
      const debugBtn = document.getElementById('debugSystemBtn');

      if (validateBtn) {
        validateBtn.addEventListener('click', (e) => {
          e.preventDefault();
          runValidation();
        });
      }

      if (detailedBtn) {
        detailedBtn.addEventListener('click', (e) => {
          e.preventDefault();
          runDetailedValidation();
        });
      }

      if (computeBtn) {
        computeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          runNewSystem();
        });
      }

      if (debugBtn) {
        debugBtn.addEventListener('click', (e) => {
          e.preventDefault();
          showDebugInfo();
        });
      }

      console.log('[DevTools] Initialized');
    });
  }

  /**
   * Run validation comparing old vs new system
   */
  function runValidation() {
    console.group('[DevTools] Validation: Old vs New System');

    const StateManager = window.TEUI?.StateManager;
    if (!StateManager) {
      console.error('StateManager not available');
      alert('Error: StateManager not loaded');
      console.groupEnd();
      return;
    }

    try {
      const CI = window.TEUI.ComputationIntegration;
      if (!CI) {
        console.error('ComputationIntegration module not loaded');
        alert('Error: ComputationIntegration module not loaded');
        console.groupEnd();
        return;
      }

      if (!CI.isInitialized()) {
        console.log('Initializing new computation system...');
        const initResult = CI.initialize();
        if (!initResult) {
          console.error('Failed to initialize computation system');
          alert('Error: Failed to initialize computation system. Check console.');
          console.groupEnd();
          return;
        }
      }

      const graph = CI.getGraph();
      const state = CI.getState();
      const engine = CI.getEngine();

      if (!graph || !state || !engine) {
        console.error('Components not available', { graph: !!graph, state: !!state, engine: !!engine });
        alert('Error: Computation system components missing');
        console.groupEnd();
        return;
      }

      const targetId = state.getActiveModelId();
      if (!targetId) {
        console.error('No active model ID');
        alert('Error: No active model');
        console.groupEnd();
        return;
      }

      // Sync values from StateManager
      console.log('Syncing values from StateManager...');
      const inputIds = graph.getAllInputIds ? graph.getAllInputIds() : [];
      let syncCount = 0;

      for (const semanticPath of inputIds) {
        const inputNode = graph.getInput(semanticPath);
        const legacyId = inputNode?.legacyId;

        if (legacyId) {
          const value = StateManager.getValue(legacyId);
          if (value !== undefined && value !== null && value !== '') {
            state.setValueForModel(targetId, semanticPath, value);
            syncCount++;
          }
        }
      }
      console.log(`Synced ${syncCount} input values`);

      // Compute
      const computeStart = performance.now();
      const result = engine.computeAllForModel(targetId);
      const computeDuration = performance.now() - computeStart;

      console.log(`Computed ${result.computedNodes} nodes in ${computeDuration.toFixed(2)}ms`);

      // Build validation fields from graph's legacyId properties
      const VALIDATION_FIELDS = {};
      const allNodeIds = graph.getAllNodeIds ? graph.getAllNodeIds() : [];
      for (const nodeId of allNodeIds) {
        const node = graph.getNode(nodeId);
        if (node?.legacyId) {
          VALIDATION_FIELDS[nodeId] = node.legacyId;
        }
      }

      console.log(`Found ${Object.keys(VALIDATION_FIELDS).length} nodes with legacyId mappings`);

      // Compare values
      const comparisons = [];
      let matchCount = 0;
      let closeCount = 0;
      let mismatchCount = 0;
      let missingCount = 0;

      for (const [semanticPath, legacyId] of Object.entries(VALIDATION_FIELDS)) {
        const oldValue = StateManager.getValue(legacyId);
        const newValue = state.getValue(semanticPath);

        const comparison = { semanticPath, legacyId, oldValue, newValue, status: 'missing', diff: null };

        if (oldValue === undefined || oldValue === null || oldValue === '' || oldValue === 'N/A') {
          comparison.status = 'missing';
          missingCount++;
        } else if (newValue === undefined || newValue === null) {
          comparison.status = 'missing';
          missingCount++;
        } else {
          const oldNum = parseFloat(String(oldValue).replace(/,/g, ''));
          const newNum = parseFloat(String(newValue));

          if (isNaN(oldNum) || isNaN(newNum)) {
            if (String(oldValue) === String(newValue)) {
              comparison.status = 'match';
              matchCount++;
            } else {
              comparison.status = 'mismatch';
              mismatchCount++;
            }
          } else {
            const diff = Math.abs(oldNum - newNum);
            const relDiff = oldNum !== 0 ? (diff / Math.abs(oldNum)) * 100 : (diff === 0 ? 0 : 100);
            comparison.diff = relDiff;

            if (diff < 0.001 || relDiff < 0.01) {
              comparison.status = 'match';
              matchCount++;
            } else if (relDiff < 1) {
              comparison.status = 'close';
              closeCount++;
            } else {
              comparison.status = 'mismatch';
              mismatchCount++;
            }
          }
        }

        comparisons.push(comparison);
      }

      // Log results
      console.log('\n=== VALIDATION SUMMARY ===');
      console.log(`Fields compared: ${comparisons.length}`);
      console.log(`Exact matches: ${matchCount}`);
      console.log(`Close (<1%): ${closeCount}`);
      console.log(`Mismatches: ${mismatchCount}`);
      console.log(`Missing: ${missingCount}`);

      const mismatches = comparisons.filter(c => c.status === 'mismatch');
      if (mismatches.length > 0) {
        console.log('\n=== MISMATCHES ===');
        mismatches.forEach(m => {
          console.log(`${m.semanticPath} (${m.legacyId}): OLD=${m.oldValue} | NEW=${m.newValue} | DIFF=${m.diff?.toFixed(2) || 'N/A'}%`);
        });
      }

      alert(
        `Validation Complete\n\n` +
        `Fields compared: ${comparisons.length}\n` +
        `Exact matches: ${matchCount}\n` +
        `Close (<1%): ${closeCount}\n` +
        `Mismatches: ${mismatchCount}\n` +
        `Missing: ${missingCount}\n\n` +
        `Check browser console for details.`
      );

    } catch (e) {
      console.error('Validation failed:', e);
      alert('Validation error: ' + e.message);
    }

    console.groupEnd();
  }

  /**
   * Run detailed validation with categorized output
   */
  function runDetailedValidation() {
    console.group('[DevTools] Detailed Validation');

    const StateManager = window.TEUI?.StateManager;
    const CI = window.TEUI?.ComputationIntegration;

    if (!StateManager || !CI) {
      alert('Error: Required modules not loaded');
      console.groupEnd();
      return;
    }

    try {
      if (!CI.isInitialized()) {
        console.log('Attempting to initialize CI...');
        const initResult = CI.initialize();
        console.log('CI.initialize() returned:', initResult);
      }

      const graph = CI.getGraph();
      const state = CI.getState();
      const engine = CI.getEngine();

      console.log('After init - graph:', !!graph, 'state:', !!state, 'engine:', !!engine);

      if (!graph || !state || !engine) {
        alert('Error: Computation system not initialized. Check console.');
        console.groupEnd();
        return;
      }

      const targetId = state.getActiveModelId();
      console.log('targetId:', targetId);
      if (!targetId) {
        alert('Error: No active model');
        console.groupEnd();
        return;
      }

      // Sync inputs
      const inputIds = graph.getAllInputIds();
      for (const semanticPath of inputIds) {
        const inputNode = graph.getInput(semanticPath);
        const legacyId = inputNode?.legacyId;
        if (legacyId) {
          const value = StateManager.getValue(legacyId);
          if (value !== undefined && value !== null && value !== '') {
            state.setValueForModel(targetId, semanticPath, value);
          }
        }
      }

      // Compute
      engine.computeAllForModel(targetId);

      // Compare and categorize
      const results = { matches: [], close: [], mismatches: [], missing: [] };
      const allNodeIds = graph.getAllNodeIds();

      for (const nodeId of allNodeIds) {
        const node = graph.getNode(nodeId);
        if (!node?.legacyId) continue;

        const oldValue = StateManager.getValue(node.legacyId);
        const newValue = state.getValue(nodeId);

        if (oldValue === undefined || oldValue === null || oldValue === '' ||
            oldValue === 'N/A' || newValue === undefined || newValue === null) {
          results.missing.push({ nodeId, legacyId: node.legacyId, old: oldValue, new: newValue });
          continue;
        }

        const oldNum = parseFloat(String(oldValue).replace(/,/g, ''));
        const newNum = parseFloat(String(newValue));

        if (isNaN(oldNum) || isNaN(newNum)) {
          if (String(oldValue) === String(newValue)) {
            results.matches.push({ nodeId, legacyId: node.legacyId, old: oldValue, new: newValue });
          } else {
            results.mismatches.push({ nodeId, legacyId: node.legacyId, old: oldValue, new: newValue, diff: 'string' });
          }
        } else {
          const diff = Math.abs(oldNum - newNum);
          const relDiff = oldNum !== 0 ? (diff / Math.abs(oldNum)) * 100 : (diff === 0 ? 0 : 100);

          if (diff < 0.001 || relDiff < 0.01) {
            results.matches.push({ nodeId, legacyId: node.legacyId, old: oldValue, new: newValue });
          } else if (relDiff < 1) {
            results.close.push({ nodeId, legacyId: node.legacyId, old: oldNum, new: newNum, diff: relDiff.toFixed(2) + '%' });
          } else {
            results.mismatches.push({ nodeId, legacyId: node.legacyId, old: oldNum, new: newNum, diff: relDiff.toFixed(2) + '%' });
          }
        }
      }

      console.log('=== VALIDATION SUMMARY ===');
      console.log('Matches:', results.matches.length);
      console.log('Close (<1%):', results.close.length);
      console.log('Mismatches:', results.mismatches.length);
      console.log('Missing:', results.missing.length);

      console.log('\n=== MISMATCHES ===');
      results.mismatches.forEach(m => console.log(`${m.nodeId} (${m.legacyId}): OLD=${m.old} | NEW=${m.new} | DIFF=${m.diff}`));

      console.log('\n=== MISSING ===');
      results.missing.forEach(m => console.log(`${m.nodeId} (${m.legacyId}): OLD=${m.old} | NEW=${m.new}`));

      alert(
        `Detailed Validation Complete\n\n` +
        `Matches: ${results.matches.length}\n` +
        `Close (<1%): ${results.close.length}\n` +
        `Mismatches: ${results.mismatches.length}\n` +
        `Missing: ${results.missing.length}\n\n` +
        `Check browser console for details.`
      );

    } catch (e) {
      console.error('Detailed validation failed:', e);
      alert('Error: ' + e.message);
    }

    console.groupEnd();
  }

  /**
   * Run the new computation system independently
   */
  function runNewSystem() {
    console.group('[DevTools] Running New Computation System');

    try {
      const CI = window.TEUI?.ComputationIntegration;
      const StateManager = window.TEUI?.StateManager;

      if (!CI) {
        alert('Error: ComputationIntegration not loaded');
        console.groupEnd();
        return;
      }

      if (!CI.isInitialized()) {
        CI.initialize();
      }

      const graph = CI.getGraph();
      const state = CI.getState();
      const engine = CI.getEngine();

      if (!graph || !state || !engine) {
        alert('Error: Computation system not initialized');
        console.groupEnd();
        return;
      }

      const targetId = state.getActiveModelId();
      if (!targetId) {
        alert('Error: No active model');
        console.groupEnd();
        return;
      }

      // Sync from StateManager
      if (StateManager) {
        const inputIds = graph.getAllInputIds ? graph.getAllInputIds() : [];
        let syncCount = 0;

        for (const semanticPath of inputIds) {
          const inputNode = graph.getInput(semanticPath);
          const legacyId = inputNode?.legacyId;

          if (legacyId) {
            const value = StateManager.getValue(legacyId);
            if (value !== undefined && value !== null && value !== '') {
              state.setValueForModel(targetId, semanticPath, value);
              syncCount++;
            }
          }
        }
        console.log(`Synced ${syncCount} values from StateManager`);
      }

      // Compute
      const result = engine.computeAllForModel(targetId);

      console.log('=== COMPUTATION RESULTS ===');
      console.log(`Nodes computed: ${result.computedNodes}`);
      console.log(`Duration: ${result.duration.toFixed(2)}ms`);

      // Show key metrics
      console.log('\n=== KEY METRICS ===');
      console.log(`TEUI: ${state.getValue('energy.teui')?.toFixed(1) || 'N/A'} kWh/m²/yr`);
      console.log(`TEDI: ${state.getValue('energy.tedi')?.toFixed(1) || 'N/A'} kWh/m²/yr`);
      console.log(`GHGI: ${state.getValue('emissions.ghgi')?.toFixed(1) || 'N/A'} kgCO2e/m²/yr`);

      alert(
        `New System Computed\n\n` +
        `Nodes: ${result.computedNodes}\n` +
        `Duration: ${result.duration.toFixed(2)}ms\n\n` +
        `TEUI: ${state.getValue('energy.teui')?.toFixed(1) || 'N/A'} kWh/m²/yr\n` +
        `TEDI: ${state.getValue('energy.tedi')?.toFixed(1) || 'N/A'} kWh/m²/yr\n` +
        `GHGI: ${state.getValue('emissions.ghgi')?.toFixed(1) || 'N/A'} kgCO2e/m²/yr`
      );

    } catch (e) {
      console.error('Computation failed:', e);
      alert('Error: ' + e.message);
    }

    console.groupEnd();
  }

  /**
   * Show debug info about both systems
   */
  function showDebugInfo() {
    console.group('[DevTools] Debug Info');

    try {
      const CI = window.TEUI?.ComputationIntegration;
      const StateManager = window.TEUI?.StateManager;

      console.log('=== OLD SYSTEM (StateManager) ===');
      if (StateManager) {
        const values = StateManager.getAllValues ? StateManager.getAllValues() : {};
        console.log(`Total values: ${Object.keys(values).length}`);
      } else {
        console.log('Not available');
      }

      console.log('\n=== NEW SYSTEM ===');
      if (CI?.isInitialized()) {
        const stats = CI.getStats();
        console.log('Graph:', stats.graph);
        console.log('State:', stats.state);
        console.log('Engine:', stats.engine);
      } else {
        console.log('Not initialized');
      }

      alert(
        'Debug Info\n\n' +
        `StateManager: ${StateManager ? 'Available' : 'Not loaded'}\n` +
        `New System: ${CI?.isInitialized() ? 'Initialized' : 'Not initialized'}\n\n` +
        'Check browser console for details.'
      );

    } catch (e) {
      console.error('Debug failed:', e);
    }

    console.groupEnd();
  }

  // Auto-initialize
  initialize();

  // Export for manual use
  window.TEUI.DevTools = {
    runValidation,
    runDetailedValidation,
    runNewSystem,
    showDebugInfo
  };

  console.log('[DevTools] Module loaded');
})();
