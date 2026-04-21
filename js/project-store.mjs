/**
 * PDF-Parser — Project Data Store
 */

import { VERSION } from "./config.mjs";
import * as PolygonTool from "./polygon-tool.mjs";
import * as IDB from "./shared/indexed-db-store.mjs";

var _project = _emptyProject();
var _saveTimer = null;
var _autosaveEnabled = true;

function _emptyProject() {
  return {
    uuid: null,
    version: VERSION,
    fileName: "",
    createdAt: null,
    updatedAt: null,
    pageCount: 0,
    pages: [],
    scheduleData: { rooms: null },
    volumes: [],
    // Project-level geometry params (wall height, roof pitch, etc.). Entered
    // in the Parser sidebar; consumed by BEAMweb's bridge aggregator as a
    // fallback when its own StateManager param_* fields are blank.
    params: {}
  };
}

export function initFromPdf(fileName, pageCount) {
  _project = _emptyProject();
  _project.uuid = IDB.generateUUID();
  _project.fileName = fileName;
  _project.pageCount = pageCount;
  _project.createdAt = new Date().toISOString();
  _project.pages = [];
  for (var i = 0; i < pageCount; i++) {
    _project.pages.push({
      pageNum: i + 1,
      sheetId: null,
      sheetTitle: null,
      classification: null,
      scale: null,
      polygons: [],
      rulers: []
    });
  }
  _touch();
}

export function setClassifications(classResults) {
  for (var i = 0; i < classResults.length; i++) {
    var cr = classResults[i];
    var page = _project.pages[cr.pageNum - 1];
    if (page) {
      page.sheetId = cr.sheetId;
      page.sheetTitle = cr.sheetTitle;
      page.classification = cr.classification;
      page.scale = cr.scale;
    }
  }
  _touch();
}

export function savePolygons(pageNum, polygons) {
  var page = _project.pages[pageNum - 1];
  if (page) {
    // Sheet metadata denormalized onto each polygon so downstream consumers
    // (BEAMweb) don't have to join back to the page record. Page-level
    // classification is authoritative; polygon's own sheet_id/sheet_class
    // fields are only used as a fallback when the page isn't classified yet.
    var pageSheetId = page.sheetId || null;
    var pageSheetClass = page.classification || null;
    page.polygons = polygons.map(function (p) {
      return {
        id: p.id,
        label: p.label,
        vertices: p.vertices.slice(),
        closed: p.closed,
        type: p.type || "area",
        mode: p.mode || "net",
        component: p.component || null,
        depth_m: p.depth_m != null ? p.depth_m : null,
        sheet_id: pageSheetId || p.sheet_id || null,
        sheet_class: pageSheetClass || p.sheet_class || null,
        assembly_preset: p.assembly_preset || null
      };
    });
    _touch();
  }
}

export function saveRulers(pageNum, rulers) {
  var page = _project.pages[pageNum - 1];
  if (page) {
    page.rulers = (rulers || []).map(function (r) {
      return { id: r.id, p1: r.p1, p2: r.p2, pdfLength: r.pdfLength, lengthM: r.lengthM };
    });
    _touch();
  }
}

export function getRulers(pageNum) {
  var page = _project.pages[pageNum - 1];
  return page && page.rulers ? page.rulers : [];
}

/**
 * Save scale calibration data for a page.
 * @param {number} pageNum
 * @param {Object} calData — from ScaleManager.getCalibration()
 */
export function saveCalibration(pageNum, calData) {
  var page = _project.pages[pageNum - 1];
  if (page && calData) {
    page.calibration = {
      pdfUnitsPerMetre: calData.pdfUnitsPerMetre,
      source: calData.source,
      ratio: calData.ratio,
      ratioLabel: calData.ratioLabel,
      confirmed: calData.confirmed,
      refPoints: calData.refPoints || null,
      refDistance: calData.refDistance || null,
      refUnit: calData.refUnit || null
    };
    _touch();
  }
}

/**
 * Get saved calibration for a page (from loaded project).
 */
export function getCalibration(pageNum) {
  var page = _project.pages[pageNum - 1];
  return page && page.calibration ? page.calibration : null;
}

export function setRoomSchedule(rooms) {
  _project.scheduleData.rooms = rooms;
  _touch();
}

function _touch() {
  _project.updatedAt = new Date().toISOString();
  _scheduleAutosave();
}

// Debounced write to IndexedDB. BEAMweb reads this record (in a separate tab)
// to flow polygon takeoffs into PROJECT dimensions, so "autosave" is also
// "cross-tab handoff". 500ms matches the typing debounce pattern elsewhere.
function _scheduleAutosave() {
  if (!_autosaveEnabled) return;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_persistToIDB, 500);
}

function _persistToIDB() {
  if (!_project.uuid) return;
  IDB.putProject({
    uuid: _project.uuid,
    pdfFileName: _project.fileName,
    pdfPageCount: _project.pageCount,
    projectJson: _project,
    updatedAt: _project.updatedAt
  }).catch(function (err) {
    console.warn("[ProjectStore] IndexedDB autosave failed:", err);
  });
}

export function getActiveUuid() {
  return _project.uuid || null;
}

// Restore flows (IndexedDB hydrate, JSON import) mutate ProjectStore many times
// before the final state is known. Pausing autosave avoids writing transient
// intermediate records to IndexedDB; resumeAutosave schedules a single
// consolidated write at the end.
export function pauseAutosave() {
  _autosaveEnabled = false;
}

export function resumeAutosave() {
  _autosaveEnabled = true;
  _scheduleAutosave();
}

// Replaces the in-memory project with a saved record (e.g. from IndexedDB
// restore or JSON import). Suppresses autosave during the replacement so
// we don't ping-pong a fresh write on top of what we just loaded.
export function restoreProject(projectJson) {
  _autosaveEnabled = false;
  _project = projectJson;
  if (!_project.uuid) _project.uuid = IDB.generateUUID();
  _autosaveEnabled = true;
}

// Stash the PDF bytes alongside the project so a returning user doesn't
// have to re-drop the file. Called by app.mjs after loadPdf succeeds.
export function setPdfBytes(blob) {
  if (!_project.uuid) return Promise.resolve();
  return IDB.putPdfBytes(_project.uuid, blob);
}

export function setParam(key, value) {
  if (!_project.params) _project.params = {};
  if (value === null || value === undefined || value === "") {
    delete _project.params[key];
  } else {
    _project.params[key] = value;
  }
  _touch();
}

export function getParam(key) {
  return _project.params ? _project.params[key] : undefined;
}

export function getAllParams() {
  return _project.params ? Object.assign({}, _project.params) : {};
}

export function toJSON() {
  return JSON.stringify(_project, null, 2);
}
export function fromJSON(jsonStr) {
  _project = JSON.parse(jsonStr);
}

export function measurementsToCSV() {
  var lines = [
    "Sheet,Label,Type,Tag,Preset,Mode,Gross (m\u00B2),Net (m\u00B2),Gross (ft\u00B2),Net (ft\u00B2),Length/Perim (m)"
  ];
  for (var i = 0; i < _project.pages.length; i++) {
    var page = _project.pages[i];
    var sheetLabel = page.sheetId || "Page " + page.pageNum;
    var assoc = PolygonTool.buildAssociationMap(page.pageNum);
    var grossTotalM2 = 0,
      netTotalM2 = 0,
      grossTotalFt2 = 0,
      netTotalFt2 = 0;
    var hasData = false;

    // Walls with associated windows
    for (var w = 0; w < assoc.walls.length; w++) {
      var wall = assoc.walls[w];
      var wm = wall.measurement;
      hasData = true;

      // Compute net for this wall
      var wallNetM2 = wm.areaM2;
      var wallNetFt2 = wm.areaFt2;
      if (wm.areaM2 !== null) {
        for (var c = 0; c < wall.children.length; c++) {
          var ch = wall.children[c].measurement;
          if (ch.areaM2 !== null) {
            if (ch.mode !== "add") {
              wallNetM2 -= ch.areaM2;
              wallNetFt2 -= ch.areaFt2;
            } else {
              wallNetM2 += ch.areaM2;
              wallNetFt2 += ch.areaFt2;
            }
          }
        }
        grossTotalM2 += wm.areaM2;
        grossTotalFt2 += wm.areaFt2;
        netTotalM2 += wallNetM2;
        netTotalFt2 += wallNetFt2;
      }

      lines.push(
        [
          sheetLabel,
          '"' + wm.label + '"',
          "area",
          wm.component || "",
          wm.assembly_preset || "",
          "",
          wm.areaM2 !== null ? wm.areaM2.toFixed(2) : "",
          wallNetM2 !== null ? wallNetM2.toFixed(2) : "",
          wm.areaFt2 !== null ? wm.areaFt2.toFixed(2) : "",
          wallNetFt2 !== null ? wallNetFt2.toFixed(2) : "",
          wm.perimeterM !== null ? wm.perimeterM.toFixed(2) : ""
        ].join(",")
      );

      // Child windows indented
      for (var cw = 0; cw < wall.children.length; cw++) {
        var cm = wall.children[cw].measurement;
        lines.push(
          [
            sheetLabel,
            '"  ' + cm.label + '"',
            "window",
            cm.component || "window_opening",
            cm.assembly_preset || "",
            cm.mode || "net",
            cm.areaM2 !== null ? cm.areaM2.toFixed(2) : "",
            "",
            cm.areaFt2 !== null ? cm.areaFt2.toFixed(2) : "",
            "",
            cm.perimeterM !== null ? cm.perimeterM.toFixed(2) : ""
          ].join(",")
        );
      }
    }

    // Orphan windows
    for (var o = 0; o < assoc.orphanWindows.length; o++) {
      var om = assoc.orphanWindows[o].measurement;
      hasData = true;
      lines.push(
        [
          sheetLabel,
          '"' + om.label + ' (unassociated)"',
          "window",
          om.component || "window_opening",
          om.assembly_preset || "",
          om.mode || "net",
          om.areaM2 !== null ? om.areaM2.toFixed(2) : "",
          "",
          om.areaFt2 !== null ? om.areaFt2.toFixed(2) : "",
          "",
          om.perimeterM !== null ? om.perimeterM.toFixed(2) : ""
        ].join(",")
      );
    }

    // Polylines — linear features; length goes in the shared Length/Perim column.
    var allMeas = PolygonTool.getAllMeasurements(page.pageNum);
    for (var pm2 = 0; pm2 < allMeas.length; pm2++) {
      if (allMeas[pm2].type !== "polyline") continue;
      var pm = allMeas[pm2];
      hasData = true;
      lines.push(
        [
          sheetLabel,
          '"' + pm.label + '"',
          "polyline",
          pm.component || "",
          pm.assembly_preset || "",
          "",
          "",
          "",
          "",
          "",
          pm.lengthM !== null ? pm.lengthM.toFixed(2) : ""
        ].join(",")
      );
    }

    // Summary rows — area totals only (polylines don't contribute to area).
    if (hasData) {
      lines.push(
        [sheetLabel, "GROSS TOTAL", "", "", "", "", grossTotalM2.toFixed(2), "", grossTotalFt2.toFixed(2), "", ""].join(
          ","
        )
      );
      lines.push(
        [sheetLabel, "NET TOTAL", "", "", "", "", "", netTotalM2.toFixed(2), "", netTotalFt2.toFixed(2), ""].join(",")
      );
    }
  }
  return lines.join("\n");
}

export function download(content, fileName, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function getProject() {
  return _project;
}
export function getPage(pageNum) {
  return _project.pages[pageNum - 1] || null;
}
export function reset() {
  _project = _emptyProject();
}
