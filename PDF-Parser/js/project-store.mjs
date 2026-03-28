/**
 * PDF-Parser — Project Data Store
 */

import { VERSION } from "./config.mjs";
import * as PolygonTool from "./polygon-tool.mjs";

var _project = _emptyProject();

function _emptyProject() {
  return {
    version: VERSION, fileName: "", createdAt: null, updatedAt: null,
    pageCount: 0, pages: [],
    scheduleData: { rooms: null }, volumes: []
  };
}

export function initFromPdf(fileName, pageCount) {
  _project = _emptyProject();
  _project.fileName = fileName;
  _project.pageCount = pageCount;
  _project.createdAt = new Date().toISOString();
  _project.pages = [];
  for (var i = 0; i < pageCount; i++) {
    _project.pages.push({
      pageNum: i + 1, sheetId: null, sheetTitle: null,
      classification: null, scale: null, polygons: []
    });
  }
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
    page.polygons = polygons.map(function(p) {
      return {
        id: p.id, label: p.label, vertices: p.vertices.slice(), closed: p.closed,
        type: p.type || "area", mode: p.mode || "net"
      };
    });
    _touch();
  }
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
      source:           calData.source,
      ratio:            calData.ratio,
      ratioLabel:       calData.ratioLabel,
      confirmed:        calData.confirmed,
      refPoints:        calData.refPoints || null,
      refDistance:       calData.refDistance || null,
      refUnit:          calData.refUnit || null
    };
    _touch();
  }
}

/**
 * Get saved calibration for a page (from loaded project).
 */
export function getCalibration(pageNum) {
  var page = _project.pages[pageNum - 1];
  return (page && page.calibration) ? page.calibration : null;
}

export function setRoomSchedule(rooms) { _project.scheduleData.rooms = rooms; _touch(); }

function _touch() { _project.updatedAt = new Date().toISOString(); }

export function toJSON() { return JSON.stringify(_project, null, 2); }
export function fromJSON(jsonStr) { _project = JSON.parse(jsonStr); }

export function measurementsToCSV() {
  var lines = ["Sheet,Label,Type,Mode,Area (m\u00B2),Area (ft\u00B2),Perimeter (m)"];
  for (var i = 0; i < _project.pages.length; i++) {
    var page = _project.pages[i];
    var sheetLabel = page.sheetId || ("Page " + page.pageNum);
    var measurements = PolygonTool.getAllMeasurements(page.pageNum);
    var grossM2 = 0, grossFt2 = 0, winNetM2 = 0, winNetFt2 = 0, winAddM2 = 0, winAddFt2 = 0;
    var hasAreas = false, hasWindows = false;

    for (var m = 0; m < measurements.length; m++) {
      var meas = measurements[m];
      var type = meas.type || "area";
      var mode = type === "window" ? (meas.mode || "net") : "";
      lines.push([
        sheetLabel, '"' + meas.label + '"', type, mode,
        meas.areaM2 !== null ? meas.areaM2.toFixed(2) : "",
        meas.areaFt2 !== null ? meas.areaFt2.toFixed(2) : "",
        meas.perimeterM !== null ? meas.perimeterM.toFixed(2) : ""
      ].join(","));

      if (meas.areaM2 !== null) {
        if (type === "window") {
          hasWindows = true;
          if (meas.mode === "add") { winAddM2 += meas.areaM2; winAddFt2 += meas.areaFt2; }
          else { winNetM2 += meas.areaM2; winNetFt2 += meas.areaFt2; }
        } else {
          hasAreas = true;
          grossM2 += meas.areaM2; grossFt2 += meas.areaFt2;
        }
      }
    }

    // Summary rows per page
    if (hasAreas || hasWindows) {
      if (hasAreas) lines.push([sheetLabel, "GROSS TOTAL", "", "", grossM2.toFixed(2), grossFt2.toFixed(2), ""].join(","));
      if (hasWindows) lines.push([sheetLabel, "WINDOW NET", "", "", (-winNetM2 + winAddM2).toFixed(2), (-winNetFt2 + winAddFt2).toFixed(2), ""].join(","));
      var netM2 = grossM2 - winNetM2 + winAddM2;
      var netFt2 = grossFt2 - winNetFt2 + winAddFt2;
      lines.push([sheetLabel, "NET TOTAL", "", "", netM2.toFixed(2), netFt2.toFixed(2), ""].join(","));
    }
  }
  return lines.join("\n");
}

export function download(content, fileName, mimeType) {
  var blob = new Blob([content], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

export function getProject() { return _project; }
export function getPage(pageNum) { return _project.pages[pageNum - 1] || null; }
export function reset() { _project = _emptyProject(); }
