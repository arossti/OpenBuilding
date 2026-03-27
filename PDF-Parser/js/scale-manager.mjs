/**
 * PDF-Parser — Scale Manager
 *
 * All calibrations are empirical: pdfUnitsPerMetre is always derived
 * from measuring a known reference in PDF coordinates.
 * Never converts theoretically from scale ratio + assumed PDF unit system.
 */

import { UNITS } from "./config.mjs";

var _calibrations = {};  // keyed by pageNum

/**
 * Store an empirical calibration from two points + a known real-world distance.
 * This is the gold standard — used by both manual calibration (C tool)
 * and the "Check Scale" verification flow.
 *
 * @param {number} pageNum
 * @param {Object} p1 — {x, y} in PDF coordinates
 * @param {Object} p2 — {x, y} in PDF coordinates
 * @param {number} realDistance — real-world distance between p1 and p2
 * @param {string} unit — "m", "mm", "ft", "in"
 * @param {Object} meta — optional metadata {ratio, source, raw}
 */
export function calibrate(pageNum, p1, p2, realDistance, unit, meta) {
  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;
  var pdfDistance = Math.sqrt(dx * dx + dy * dy);
  var realMetres = realDistance * UNITS[unit].toM;
  var pdfUnitsPerMetre = pdfDistance / realMetres;

  _calibrations[pageNum] = {
    pdfUnitsPerMetre: pdfUnitsPerMetre,
    source:           (meta && meta.source) || "manual",
    ratio:            (meta && meta.ratio) || null,
    ratioLabel:       (meta && meta.raw) || null,
    refPoints:        [p1, p2],
    refDistance:       realDistance,
    refUnit:          unit,
    confirmed:        true
  };

  console.log("[ScaleManager] Page " + pageNum + " calibrated: " +
    pdfDistance.toFixed(1) + " PDF units = " + realDistance + " " + unit +
    " → " + pdfUnitsPerMetre.toFixed(2) + " units/m" +
    (meta && meta.ratio ? " (ratio 1:" + meta.ratio + ")" : ""));
}

/**
 * Set a "pending" scale from auto-detection (unconfirmed).
 * This stores the detected ratio but does NOT enable area calculation.
 * The user must confirm via Check Scale before measurements work.
 */
export function setPending(pageNum, ratio, raw) {
  if (_calibrations[pageNum] && _calibrations[pageNum].confirmed) return; // don't overwrite confirmed
  _calibrations[pageNum] = {
    pdfUnitsPerMetre: null,   // NOT calibrated yet
    source:           "auto-pending",
    ratio:            ratio,
    ratioLabel:       raw || ("1:" + ratio),
    confirmed:        false
  };
}

/**
 * Convert a distance in PDF units to real-world metres.
 * Returns null if page is not calibrated (confirmed).
 */
export function pdfToMetres(pageNum, pdfDistance) {
  var cal = _calibrations[pageNum];
  if (!cal || !cal.confirmed || !cal.pdfUnitsPerMetre) return null;
  return pdfDistance / cal.pdfUnitsPerMetre;
}

/**
 * Convert an area in PDF units² to real-world m².
 * Returns null if page is not calibrated (confirmed).
 */
export function pdfAreaToM2(pageNum, pdfArea) {
  var cal = _calibrations[pageNum];
  if (!cal || !cal.confirmed || !cal.pdfUnitsPerMetre) return null;
  var ppm = cal.pdfUnitsPerMetre;
  return pdfArea / (ppm * ppm);
}

/**
 * Check if a page has a confirmed (empirical) calibration.
 */
export function isCalibrated(pageNum) {
  var cal = _calibrations[pageNum];
  return cal && cal.confirmed && cal.pdfUnitsPerMetre !== null;
}

/**
 * Check if a page has a pending (unconfirmed) scale detection.
 */
export function isPending(pageNum) {
  var cal = _calibrations[pageNum];
  return cal && !cal.confirmed;
}

/**
 * Get the detected/confirmed ratio for a page (for display).
 */
export function getRatio(pageNum) {
  var cal = _calibrations[pageNum];
  return cal ? cal.ratio : null;
}

/**
 * Get the ratio label (e.g., "1:48", "Scale: 1:48") for display.
 */
export function getRatioLabel(pageNum) {
  var cal = _calibrations[pageNum];
  return cal ? cal.ratioLabel : null;
}

/**
 * Get full calibration data for a page.
 */
export function getCalibration(pageNum) {
  return _calibrations[pageNum] || null;
}

export function reset() { _calibrations = {}; }
