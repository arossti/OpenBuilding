/**
 * PDF-Parser — Scale Manager
 *
 * Three scale states per page:
 *   1. PENDING  — auto-detected from title block, unconfirmed (amber ?)
 *   2. ACCEPTED — user accepted a ratio via Check Scale (yellow ✓) — area math works
 *   3. VERIFIED — empirical two-point calibration (green ✓) — highest confidence
 *
 * For ACCEPTED: we derive pdfUnitsPerMetre from the ratio using a best-guess
 * page-unit assumption. Not perfect, but good enough to work with.
 *
 * For VERIFIED: pdfUnitsPerMetre is measured empirically. Gold standard.
 */

import { UNITS } from "./config.mjs";

var _calibrations = {};

// State constants
export var STATE = {
  NONE: "none",
  PENDING: "pending",
  ACCEPTED: "accepted",
  VERIFIED: "verified"
};

/* ── Auto-detection (from sheet classifier) ───────────── */

export function setPending(pageNum, ratio, raw) {
  var cal = _calibrations[pageNum];
  if (cal && (cal.state === STATE.ACCEPTED || cal.state === STATE.VERIFIED)) return;
  _calibrations[pageNum] = {
    state: STATE.PENDING,
    ratio: ratio,
    ratioLabel: raw || "1:" + ratio,
    pdfUnitsPerMetre: null
  };
}

/* ── User accepts a ratio (provisional) ───────────────── */

export function accept(pageNum, ratio) {
  // Derive a theoretical pdfUnitsPerMetre from the ratio.
  // We don't know the PDF unit system, so we estimate from the page dimensions.
  // This uses the "PDF points" assumption (1 pt = 1/72 inch = 0.3528mm).
  // May be off by a constant factor, but enables working with approximate areas.
  // User can verify later with empirical calibration for exact values.
  var mmPerPdfUnit = 25.4 / 72; // standard PDF point assumption
  var realMmPerPdfUnit = mmPerPdfUnit * ratio;
  var realMPerPdfUnit = realMmPerPdfUnit / 1000;
  var pdfUnitsPerMetre = 1 / realMPerPdfUnit;

  _calibrations[pageNum] = {
    state: STATE.ACCEPTED,
    ratio: ratio,
    ratioLabel: "1:" + ratio,
    pdfUnitsPerMetre: pdfUnitsPerMetre,
    source: "accepted"
  };

  console.log(
    "[ScaleManager] Page " +
      pageNum +
      " ACCEPTED 1:" +
      ratio +
      " (theoretical: " +
      pdfUnitsPerMetre.toFixed(2) +
      " units/m)"
  );
}

/* ── Empirical two-point calibration (verified) ───────── */

export function calibrate(pageNum, p1, p2, realDistance, unit, meta) {
  var dx = p2.x - p1.x;
  var dy = p2.y - p1.y;
  var pdfDistance = Math.sqrt(dx * dx + dy * dy);
  var realMetres = realDistance * UNITS[unit].toM;
  var pdfUnitsPerMetre = pdfDistance / realMetres;

  _calibrations[pageNum] = {
    state: STATE.VERIFIED,
    ratio: (meta && meta.ratio) || (_calibrations[pageNum] && _calibrations[pageNum].ratio) || null,
    ratioLabel: (meta && meta.raw) || (_calibrations[pageNum] && _calibrations[pageNum].ratioLabel) || "calibrated",
    pdfUnitsPerMetre: pdfUnitsPerMetre,
    source: "verified",
    refPoints: [p1, p2],
    refDistance: realDistance,
    refUnit: unit
  };

  console.log(
    "[ScaleManager] Page " +
      pageNum +
      " VERIFIED: " +
      pdfDistance.toFixed(1) +
      " PDF units = " +
      realDistance +
      " " +
      unit +
      " → " +
      pdfUnitsPerMetre.toFixed(2) +
      " units/m"
  );
}

/* ── Conversion (works for ACCEPTED and VERIFIED) ─────── */

export function pdfToMetres(pageNum, pdfDistance) {
  var cal = _calibrations[pageNum];
  if (!cal || !cal.pdfUnitsPerMetre) return null;
  return pdfDistance / cal.pdfUnitsPerMetre;
}

export function pdfAreaToM2(pageNum, pdfArea) {
  var cal = _calibrations[pageNum];
  if (!cal || !cal.pdfUnitsPerMetre) return null;
  var ppm = cal.pdfUnitsPerMetre;
  return pdfArea / (ppm * ppm);
}

/* ── State queries ────────────────────────────────────── */

export function getState(pageNum) {
  var cal = _calibrations[pageNum];
  return cal ? cal.state : STATE.NONE;
}

export function isCalibrated(pageNum) {
  var state = getState(pageNum);
  return state === STATE.ACCEPTED || state === STATE.VERIFIED;
}

export function isVerified(pageNum) {
  return getState(pageNum) === STATE.VERIFIED;
}

export function isPending(pageNum) {
  return getState(pageNum) === STATE.PENDING;
}

export function getRatio(pageNum) {
  var cal = _calibrations[pageNum];
  return cal ? cal.ratio : null;
}

export function getRatioLabel(pageNum) {
  var cal = _calibrations[pageNum];
  return cal ? cal.ratioLabel : null;
}

export function getCalibration(pageNum) {
  return _calibrations[pageNum] || null;
}

export function reset() {
  _calibrations = {};
}
