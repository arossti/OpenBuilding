/**
 * PDF-Parser — Schedule / Table Extraction
 */

import * as Loader from "./pdf-loader.mjs";

export function extractTable(textItems, options) {
  options = options || {};
  var rowTol = options.rowTolerance || 3;
  var colTol = options.colTolerance || 10;
  if (textItems.length === 0) return [];

  var sorted = textItems.slice().sort(function (a, b) {
    if (Math.abs(a.y - b.y) > rowTol) return a.y - b.y;
    return a.x - b.x;
  });

  var rows = [],
    currentRow = [sorted[0]];
  for (var i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentRow[0].y) <= rowTol) {
      currentRow.push(sorted[i]);
    } else {
      rows.push(currentRow);
      currentRow = [sorted[i]];
    }
  }
  rows.push(currentRow);

  return rows.map(function (row) {
    row.sort(function (a, b) {
      return a.x - b.x;
    });
    var cells = [],
      currentCell = row[0].str;
    var lastRight = row[0].x + (row[0].width || 0);
    for (var j = 1; j < row.length; j++) {
      if (row[j].x - lastRight > colTol) {
        cells.push(currentCell.trim());
        currentCell = row[j].str;
      } else {
        currentCell += " " + row[j].str;
      }
      lastRight = row[j].x + (row[j].width || 0);
    }
    cells.push(currentCell.trim());
    return cells;
  });
}

export function findRoomSchedule(pageNum) {
  return Loader.getTextContent(pageNum).then(function (textItems) {
    var table = extractTable(textItems);
    var headerIdx = -1,
      roomCol = -1,
      areaCol = -1,
      numCol = -1;

    for (var r = 0; r < table.length; r++) {
      for (var c = 0; c < table[r].length; c++) {
        var cell = table[r][c].toLowerCase();
        if (cell === "room" || cell === "room name") {
          roomCol = c;
          headerIdx = r;
        }
        if (cell === "area" || /area\s*\(m/.test(cell)) {
          areaCol = c;
        }
        if (cell === "#" || cell === "no." || cell === "num") {
          numCol = c;
        }
      }
      if (headerIdx >= 0) break;
    }

    if (headerIdx < 0 || roomCol < 0) return null;

    var rooms = [];
    for (var dr = headerIdx + 1; dr < table.length; dr++) {
      var row = table[dr];
      if (!row[roomCol] || row[roomCol].trim() === "") continue;
      if (/total|gross|net/i.test(row[roomCol])) break;
      rooms.push({
        num: numCol >= 0 && row[numCol] ? parseInt(row[numCol], 10) : null,
        name: row[roomCol] ? row[roomCol].trim() : "",
        area: areaCol >= 0 && row[areaCol] ? parseFloat(row[areaCol]) : null
      });
    }
    return rooms.length > 0 ? rooms : null;
  });
}

export function findRoomScheduleInDocument() {
  var pageCount = Loader.getPageCount();
  function checkPage(p) {
    if (p > pageCount) return Promise.resolve(null);
    return findRoomSchedule(p).then(function (rooms) {
      if (rooms) return { pageNum: p, rooms: rooms };
      return checkPage(p + 1);
    });
  }
  return checkPage(1);
}
