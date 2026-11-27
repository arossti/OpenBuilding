// f280-summary.html: the heat loss and gain calculation summary (CSA F280-12 Cl. 7.1 a); Annex D, Table E.1).
//
// OBJECTIVE's S21 builds the sheet for the model on screen (src/core/F280Summary.js build()) and leaves it in
// localStorage; this page draws it and the browser prints it (Andy 2026-11-26: "use the browser's print
// functionality, no fancy add-ons"). It reads one key and calculates nothing. Every value is written as text.
//
// Two parts (Andy 2026-11-27: "mirror the sample report page as CSA formatted it, and then append any extra
// pages needed so we do not diverge so far from what building officials are used to receiving"):
//   1. the summary sheet, one page, laid out as Annex D's Figure D.1 is: the same blocks in the same places,
//      the same labels, a line left empty where nothing was entered;
//   2. the supplement: the same fields with where each is entered, the further inputs, the schedules, the loads.

const KEY = "objective.f280.summary";

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
};

function read() {
  try {
    const sheet = JSON.parse(localStorage.getItem(KEY) || "null");
    return sheet && sheet.version === 2 && Array.isArray(sheet.groups) ? sheet : null;
  } catch {
    return null;
  }
}

/** A field's value cell: the value; "not entered" for a field left empty; "not carried" with what is held instead. */
function valueCell(field) {
  const td = el("td", `fs-value fs-${field.state}`);
  if (field.state === "held") td.append(el("span", "fs-held-text", field.value || field.note));
  else if (field.state === "blank") td.append(el("span", "fs-tag", "not entered"));
  else if (field.state === "none") td.append(el("span", "fs-tag fs-tag-none", "not carried"));
  if (field.note && !(field.state === "held" && !field.value)) td.append(el("span", "fs-note", field.note));
  return td;
}

function fieldTable(fields, { numbered }) {
  const table = el("table", "fs-table");
  const body = el("tbody");
  fields.forEach((field, i) => {
    // The sheet's style lines this model does not need are one row ("32 – 34  Styles B – D"), not a row each
    if (field.state === "unused") {
      if (fields[i - 1]?.state === "unused") return;
      let last = i;
      while (fields[last + 1]?.state === "unused") last++;
      const end = fields[last];
      const tr = el("tr", "fs-row fs-row-unused");
      tr.append(
        el("td", "fs-no", last > i ? `${field.no}\u2013${end.no}` : String(field.no)),
        el("td", "fs-name", last > i ? `${field.name} \u2013 ${end.name.replace("Style ", "")}` : field.name),
        el("td", "fs-value fs-unused", "not needed by this model"),
        el("td", "fs-from", "")
      );
      body.append(tr);
      return;
    }
    const tr = el("tr", `fs-row fs-row-${field.state}`);
    if (numbered) tr.append(el("td", "fs-no", field.no === null ? "" : String(field.no)));
    tr.append(el("td", "fs-name", field.name), valueCell(field), el("td", "fs-from", field.from));
    body.append(tr);
  });
  table.append(body);
  return table;
}

/** A titled block. A short one (up to ten rows) stays on one sheet; a long one may run over. */
function section(title, ...content) {
  const rows = content.reduce((n, node) => n + node.querySelectorAll("tbody tr").length, 0);
  const wrap = el("section", rows <= 10 ? "fs-section fs-keep" : "fs-section");
  wrap.append(el("h3", "fs-group", title), ...content);
  return wrap;
}

function gridTable(columns, rows) {
  const table = el("table", "fs-table fs-grid");
  const head = el("tr");
  columns.forEach(([label, , cls]) => head.append(el("th", cls || "", label)));
  const thead = el("thead");
  thead.append(head);
  const body = el("tbody");
  rows.forEach((row) => {
    const tr = el("tr");
    columns.forEach(([, key, cls]) => tr.append(el("td", cls || "", row[key] ?? "")));
    body.append(tr);
  });
  table.append(thead, body);
  return table;
}

// ---- Part 1: the summary sheet, as Figure D.1 lays it out --------------------------------------------------

/** What a field puts on the form's line: its short text, nothing where nothing was entered. */
function formText(field) {
  if (!field) return "";
  if (field.state === "held") return field.short ?? (field.value || field.note);
  if (field.state === "none") return field.short || "not carried";
  return "";
}

/** One box of the form: its label and its line. span is its width in twelfths of the sheet. */
function box(label, text, span, cls = "") {
  const cell = el("div", `ff-box ${cls}`.trim());
  cell.style.gridColumn = `span ${span}`;
  cell.append(el("span", "ff-label", label), el("span", "ff-text", text));
  return cell;
}
function band(title, span = 12) {
  const cell = el("div", "ff-band", title);
  cell.style.gridColumn = `span ${span}`;
  return cell;
}

function drawForm(sheet, when) {
  const form = document.getElementById("fs-form");
  form.replaceChildren();
  form.hidden = false;
  const fields = sheet.groups.flatMap((g) => g.fields);
  const byNo = Object.fromEntries(fields.filter((f) => f.no !== null).map((f) => [f.no, f]));
  const t = (no) => formText(byNo[no]);
  // A group with more styles than the form has lines: its last line says so, the schedule has them all
  const style = (no) => {
    const group = sheet.groups.find((g) => g.fields.some((f) => f.no === no));
    const extra = group.fields.filter((f) => f.no === null).length;
    const last = Math.max(...group.fields.filter((f) => f.no !== null).map((f) => f.no));
    return no === last && extra > 0 ? `${t(no)} (+ ${extra} more: see the schedule)` : t(no);
  };
  const grid = el("div", "ff-grid");
  const add = (...cells) => grid.append(...cells);

  const title = el("div", "ff-title");
  title.style.gridColumn = "span 12";
  title.append(
    el("span", "ff-title-text", "Heat loss and gain calculation summary sheet"),
    el("span", "ff-title-form", "CSA-F280-M12 Standard Form No. 1")
  );
  add(title);

  const issued = el("div", "ff-box ff-issued");
  issued.style.gridColumn = "span 10";
  const line = el("div", "ff-issued-line");
  line.append(el("span", "ff-label", "These documents issued for the use of"), el("span", "ff-text", t(1)));
  issued.append(
    line,
    el(
      "div",
      "ff-label",
      "and may not be used by any other persons without authorization. Documents for permit and/or construction are signed in red."
    )
  );
  add(issued, box("Project no.", t(2), 2, "ff-stack"));

  add(band("Building location"));
  add(box("Model:", t(3), 6), box("Site:", t(6), 6));
  add(box("Address:", t(4), 6), box("Lot:", t(7), 6));
  add(box("City and Province:", t(5), 6), box("Postal code:", t(8), 6));

  add(band("Calculations based on"));
  add(box("Dimensional information based on:", t(9), 12));
  add(box("Attachment:", t(10), 6), box("Front facing:", t(16), 4), box("Assumed?", t(17), 2));
  add(box("No. of stories:", t(11), 6), box("Air tightness:", t(18), 4), box("Assumed?", t(19), 2));
  add(box("Weather location:", t(12), 4), box("Ventilated?", t(13), 2), box("Wind exposure:", t(20), 6));
  add(box("HRV?", t(14), 6), box("Internal shading:", t(21), 4), box("Occupants:", t(22), 2));
  const units = el("div", "ff-box");
  units.style.gridColumn = "span 6";
  units.append(el("span", "ff-label", "Units:"), el("span", "ff-text ff-units", "\u2610 Imperial   \u2612 Metric"));
  add(box("Recovery %:", t(15), 6), units);

  add(band("Heating design conditions", 6), band("Cooling design conditions", 6));
  add(
    box("Outdoor temp:", t(24), 2),
    box("Indoor temp:", t(25), 2),
    box("Mean soil temp:", t(26), 2),
    box("Outdoor temp:", t(27), 2),
    box("Indoor temp:", t(28), 2),
    box("Latitude:", t(29), 2)
  );

  add(band("Above grade walls", 6), band("Below grade walls", 6));
  ["A", "B", "C", "D"].forEach((letter, i) =>
    add(box(`Style ${letter}:`, style(31 + i), 6), box(`Style ${letter}:`, style(35 + i), 6))
  );
  // Left: floors on soil, exposed floors, windows. Right: ceilings, doors, skylights. Row for row as the figure.
  const S = (letter, no) => box(`Style ${letter}:`, style(no), 6);
  add(band("Floors on soil", 6), band("Ceilings", 6));
  add(S("A", 39), S("A", 41));
  add(S("B", 40), S("B", 42));
  add(band("Exposed floors", 6), S("C", 43));
  add(S("A", 44), band("Doors", 6));
  add(S("B", 45), S("A", 46));
  add(band("Windows", 6), S("B", 47));
  add(S("A", 49), S("C", 48));
  add(S("B", 50), band("Skylights", 6));
  add(S("C", 51), S("A", 53));
  add(S("D", 52), S("B", 54));

  add(box("Attached documents:", t(55), 12, "ff-tall"));
  add(box("Notes:", t(56), 12, "ff-tall"));

  const by = el("div", "ff-by");
  by.style.gridColumn = "span 6";
  by.append(el("div", "ff-band", "Calculations performed by"));
  [
    ["Name:", 57],
    ["Company:", 58],
    ["Address:", 59],
    ["City and Province:", 60],
    ["Postal code:", 61],
    ["Telephone:", 62],
    ["Fax:", 63],
    ["E-mail:", 64]
  ].forEach(([label, no]) => {
    const row = el("div", "ff-box");
    row.append(el("span", "ff-label", label), el("span", "ff-text", t(no)));
    by.append(row);
  });
  const stamp = el("div", "ff-stamp");
  stamp.style.gridColumn = "span 6";
  const held = (name) => sheet.qualification.find((q) => q.name === name && q.state === "held")?.value;
  const qualification = [held("Qualification"), held("Qualification number")].filter(Boolean).join(" \u00b7 ");
  stamp.append(
    el(
      "div",
      "ff-stamp-box",
      "Designer\u2019s logo, qualification/certification stamp/label, signature, BCIN qualification attestation, etc. to appear in this area"
    )
  );
  if (qualification && qualification !== "Other") stamp.append(el("div", "ff-stamp-held", qualification));
  add(by, stamp);

  form.append(grid);
  form.append(
    el(
      "p",
      "ff-foot",
      `Laid out as CSA F280-12 Annex D, Figure D.1. Produced ${when} by OBJECTIVE 4.0, from the ${sheet.model} model${sheet.project ? ` of \u201c${sheet.project}\u201d` : ""}. A line is empty where nothing was entered. The supplement that follows gives where each value is entered, the further inputs, the schedules of envelope rows and openings, and the design loads.`
    )
  );
}

// ---- Part 2: the supplement -----------------------------------------------------------------------------

function draw(sheet) {
  const root = document.getElementById("fs-sheet");
  root.replaceChildren();

  const printed = new Date(sheet.builtAt);
  const when = Number.isNaN(printed.getTime())
    ? ""
    : printed.toLocaleString("en-CA", { dateStyle: "long", timeStyle: "short" });

  const head = el("header", "fs-head");
  const titles = el("div", "fs-head-titles");
  titles.append(
    el("h2", "fs-title", "Supplement to the summary sheet"),
    el(
      "p",
      "fs-sub",
      "The summary sheet's fields as OBJECTIVE 4.0 holds them, each with where it is entered. Field numbers are those of CSA F280-12 Table E.1."
    )
  );
  const facts = el("dl", "fs-facts");
  [
    ["Project", sheet.project || "(no project name)"],
    ["Model", sheet.model],
    ["F280 Mode", sheet.mode],
    ["Built", when]
  ].forEach(([k, v]) => facts.append(el("dt", "", k), el("dd", "", v)));
  head.append(titles, facts);
  root.append(head);
  drawForm(sheet, when);

  const c = sheet.counts;
  root.append(
    el(
      "p",
      "fs-count",
      `${c.fields} fields: ${c.held} with a value, ${c.blank} not entered, ${c.none} not carried by OBJECTIVE, ${c.unused} style lines not needed by this model.`
    )
  );
  if (sheet.mode !== "On") {
    root.append(
      el(
        "p",
        "fs-warn",
        "F280 Mode is Off for this model. The design loads below are still F280's own; the annual figures elsewhere in OBJECTIVE are not."
      )
    );
  }

  sheet.groups.forEach((group) => root.append(section(group.title, fieldTable(group.fields, { numbered: true }))));
  root.append(section("Qualification", fieldTable(sheet.qualification, { numbered: false })));
  root.append(section("Further inputs the calculation used", fieldTable(sheet.further, { numbered: false })));

  root.append(
    section(
      "Schedule: envelope rows",
      gridTable(
        [
          ["Row", "id"],
          ["Element", "element"],
          ["Facing", "facing"],
          ["Area m²", "area", "fs-num"],
          ["RSI m²·K/W", "rsi", "fs-num"],
          ["U W/m²·K", "u", "fs-num"],
          ["Assembly", "assembly"]
        ],
        sheet.schedule.opaque
      ),
      el("p", "fs-foot", "A wall row that hosts openings shows its gross area; OBJECTIVE nets it.")
    )
  );
  root.append(
    section(
      "Schedule: doors, windows and skylights",
      gridTable(
        [
          ["Row", "id"],
          ["Kind", "kind"],
          ["Host", "host"],
          ["Facing", "facing"],
          ["W × H × count, m", "size"],
          ["Area m²", "area", "fs-num"],
          ["U W/m²·K", "u", "fs-num"],
          ["SHGC", "shgc", "fs-num"],
          ["Overhang depth / above head, m", "overhang", "fs-num"],
          ["Shading %", "shading", "fs-num"],
          ["Product", "assembly"]
        ],
        sheet.schedule.openings
      ),
      el(
        "p",
        "fs-foot",
        "Shading % is each row's summer shading (S10), the value in effect: an overhang's by Annex A, or the one typed."
      )
    )
  );
  root.append(section("Design loads", fieldTable(sheet.results, { numbered: false })));

  root.append(
    el(
      "p",
      "fs-foot",
      'The field names are those of CSA F280-12 Annex D and Table E.1; the layout and every other word are OBJECTIVE\'s. "Not entered" is a field OBJECTIVE has that was left empty. "Not carried" is a field OBJECTIVE does not hold, with what it holds instead.'
    )
  );

  document.getElementById("fs-bar-sub").textContent = `${sheet.project || "OBJECTIVE 4.0"} · ${sheet.model} model`;
  document.title = `${sheet.project || "OBJECTIVE 4.0"} — F280 calculation summary (${sheet.model})`;
}

const sheet = read();
if (sheet) draw(sheet);
document.getElementById("fs-print").addEventListener("click", () => window.print());
// S21 pressed "Open the sheet" again with this tab still open: show the new one
window.addEventListener("storage", (e) => {
  if (e.key !== KEY) return;
  const next = read();
  if (next) draw(next);
});
