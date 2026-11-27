// f280-summary.html: the heat loss and gain calculation summary (CSA F280-12 Cl. 7.1 a); Annex D, Table E.1).
//
// OBJECTIVE's S21 builds the sheet for the model on screen (src/core/F280Summary.js build()) and leaves it in
// localStorage; this page draws it and the browser prints it (Andy 2026-11-26: "use the browser's print
// functionality, no fancy add-ons"). It reads one key and calculates nothing. Every value is written as text.

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
    return sheet && sheet.version === 1 && Array.isArray(sheet.groups) ? sheet : null;
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
    el("h2", "fs-title", "Heat loss and gain calculation summary"),
    el(
      "p",
      "fs-sub",
      "The input data of CSA F280-12 Annex D (Figure D.1) and Table E.1, as OBJECTIVE 4.0 holds them. Field numbers are Table E.1's."
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
