/**
 * The Builders inside OBJECTIVE (schema/schema.md §10, B2 – B4).
 *
 * An S11 row's ID cell is a button. An opaque row (B.4, B.5, B.9, B.10 and the rows + adds) opens the Assembly
 * Builder in a popup, alone in its frame, at the library group that fits the row's type; a door, window or
 * skylight row (B.7, B.8) opens the Opening Builder at its class. Apply Selected there posts one message; this
 * module writes the value into the row as a user entry (an assembly's effective RSI into f_<row>, an opening's
 * whole-window U into g_<row>) and the row remembers what was applied (ca_<row>, saved with the project by
 * Openings.addedFields).
 *
 * THE BUILDER COMPUTES, OBJECTIVE RECEIVES: no RSI, U or carbon figure is derived from layers here.
 *
 * REFERENCE AND TARGET ARE INDEPENDENT (Andy 2026-11-26: "a user can and may set a different assembly in the
 * Reference model or the Target as a comparison"): everything here reads and writes THE MODEL ON SCREEN, V3's
 * own ref_ prefix (Section11.js getModeValue). A row has one assembly per model; S05's E.3.5 is each model's
 * own. Copy from Target carries the Target's assembly across wherever it carried the Target's value.
 */

// S11's element type (c_<row>) → the Assembly Builder's library group (the name prefix)
const GROUP_OF = { roof: "Ra", walls: "Wa", exposedFloor: "Fa", wallsBelowGrade: "Wg", slabOnGrade: "Fg" };
// a door / window / skylight row → the Opening Builder's class
const CLASS_OF = { door: "Door", window: "Window", skylight: "Skylight" };
const SECTION = "envelopeTransmissionLosses";

const T = () => window.TEUI || {};
const isOpaque = (o) => o.kind === "opaque";
// every row with a Builder: the opaque rows, then the doors, windows and skylights
const builderRows = () => {
  const O = T().Openings;
  return O ? [...O.OPAQUE, ...O.ALL] : [];
};
const rowOf = (tr) => {
  const O = T().Openings;
  return (O && tr && builderRows().find((o) => O.s11RowId(o) === tr.dataset.id)) || null;
};
// the row's typed input, which Apply writes: an opaque row's RSI, an opening's U-value
const valueField = (o) => `${isOpaque(o) ? "f" : "g"}_${o.s11}`;
const linkValue = (o, link) => (isOpaque(o) ? link.rsi : link.u);
const builderName = (o) => (isOpaque(o) ? "Assembly Builder" : "Opening Builder");
const isReference = () => !!T().ReferenceToggle?.isReferenceMode?.();
// the model on screen: "" for the Target, "ref_" for the Reference (V3's StateManager prefix)
const pre = () => (isReference() ? "ref_" : "");
const getM = (id, p = pre()) => T().StateManager.getValue(p + id);
const setM = (id, value, p = pre()) => T().StateManager.setValue(p + id, value, "user-modified");

// What Apply left on a row, or null. An assembly: { id, name, group, method, rsi, eci, bio, t, edited };
// an opening: { id, name, cls, u, basis ("certified" | "computed"), uw_computed, uw_certified, w, h, edited }
function linkOf(s11, p = pre()) {
  try {
    return JSON.parse(getM(`ca_${s11}`, p) || "null");
  } catch {
    return null;
  }
}
const sameRsi = (a, b) => Number.isFinite(+a) && Number.isFinite(+b) && Math.abs(+a - +b) < 5e-5;

// ── The popup: one frame, the Builder alone in it ─────────────────────
let openRow = null;
function modal() {
  let el = document.getElementById("op-builder-modal");
  if (el) return el;
  el = document.createElement("div");
  el.id = "op-builder-modal";
  el.hidden = true;
  el.innerHTML = `<div class="op-builder-frame" role="dialog" aria-modal="true" aria-label="Builder">
      <iframe title="Builder"></iframe>
    </div>`;
  el.addEventListener("click", (e) => {
    if (e.target === el) closeBuilder();
  });
  document.body.appendChild(el);
  return el;
}
function openBuilder(o) {
  const group = isOpaque(o) ? GROUP_OF[getM(`c_${o.s11}`) || o.type] || "Wa" : CLASS_OF[o.kind] || "Window";
  const link = linkOf(o.s11);
  const q = new window.URLSearchParams({ embed: "1", group });
  if (link && link.id) q.set("pick", link.id);
  openRow = o;
  const el = modal();
  const frame = el.querySelector("iframe");
  frame.title = builderName(o);
  frame.src = `builders/${isOpaque(o) ? "assembly" : "opening"}-builder.html?${q}`;
  el.hidden = false;
}
function closeBuilder() {
  const el = document.getElementById("op-builder-modal");
  if (!el) return;
  el.hidden = true;
  el.querySelector("iframe").src = "about:blank";
  openRow = null;
}

// ── Apply Selected: the Builder's number into the row, as a user entry ─
function onMessage(e) {
  // Accepted from this site only, and only while the popup is open. The sender is NOT checked against the
  // frame's window: WebKit reports this page as the source of the Builder's cancel (measured 2026-11-26).
  if (e.origin !== location.origin || !openRow || !e.data) return;
  if (e.data.type === "ob-builder-cancel") return closeBuilder();
  if (e.data.type !== "ob-builder-apply") return;
  const m = e.data;
  let link, value;
  if (m.kind === "assembly" && isOpaque(openRow)) {
    if (!Number.isFinite(m.rsi_eff) || m.rsi_eff <= 0) return;
    value = +m.rsi_eff.toFixed(2); // as the Builder shows it, and as V3 stores a typed RSI
    link = {
      id: m.id,
      name: m.name,
      group: m.group,
      method: m.rsi_method,
      rsi: value,
      eci: +(+m.eci_kgco2e_m2).toFixed(3),
      bio: +(+m.bio_kgco2e_m2).toFixed(3),
      t: m.thickness_mm,
      edited: !!m.edited
    };
  } else if (m.kind === "opening" && !isOpaque(openRow)) {
    // The certificate's own Uw where the product has one; else the Builder's computed Uw (its frame is a
    // solid first pass). The row says which.
    const certified = Number.isFinite(m.uw_certified) && m.uw_certified > 0;
    const u = certified ? m.uw_certified : m.uw_computed;
    if (!Number.isFinite(u) || u <= 0) return;
    value = +u.toFixed(3);
    link = {
      id: m.id,
      name: m.name,
      cls: m.cls,
      u: value,
      basis: certified ? "certified" : "computed",
      uw_computed: +(+m.uw_computed).toFixed(3),
      uw_certified: certified ? m.uw_certified : null,
      w: m.w_mm,
      h: m.h_mm,
      edited: !!m.edited
    };
  } else return;
  // the link first: a link whose value is the one being written is kept
  setM(`ca_${openRow.s11}`, JSON.stringify(link));
  setM(valueField(openRow), value.toFixed(isOpaque(openRow) ? 2 : 3));
  if (T().Calculator?.calculateAll) T().Calculator.calculateAll();
  closeBuilder();
  decorate();
}

// ── The rows: the ID cell is the button, the assembly's name sits by the type ─
function decorate() {
  const O = T().Openings;
  if (!O) return;
  for (const o of builderRows()) {
    const tr = document.querySelector(`#${SECTION} tr[data-id="${O.s11RowId(o)}"]`);
    if (!tr) continue;
    const idCell = tr.querySelector("td.id-cell");
    const link = linkOf(o.s11);
    if (idCell) {
      idCell.classList.add("op-asm-btn");
      idCell.classList.toggle("op-asm-linked", !!link);
      idCell.setAttribute("role", "button");
      idCell.tabIndex = 0;
      const what = !link
        ? ""
        : isOpaque(o)
          ? `RSI ${link.rsi} by ${String(link.method).toUpperCase()}`
          : `Uw ${link.u} (${link.basis})`;
      const title = link
        ? `${link.name}${link.edited ? " (edited)" : ""} · ${what} · open the ${builderName(o)}`
        : `Choose this row's ${isOpaque(o) ? "assembly" : "product"} in the ${builderName(o)}`;
      if (idCell.title !== title) idCell.title = title;
    }
    const desc = tr.querySelector("td.description-cell");
    if (!desc) continue;
    let chip = desc.querySelector(".op-asm-name");
    const text = link ? `${link.name}${link.edited ? " (edited)" : ""}` : "";
    if (!text) {
      if (chip) chip.remove();
      continue;
    }
    if (!chip) {
      chip = document.createElement("span");
      chip.className = "op-asm-name";
      desc.appendChild(chip);
    }
    if (chip.textContent !== text) {
      chip.textContent = text;
      chip.title = text;
    }
    fitChip(chip);
  }
  renderCarbon();
}

// The name takes only the room its row has: S11's table is laid out to fit its card (a 1440 px window), and a
// wall row already holds its type, facing and + buttons. The full name is the ID's tooltip.
const CHIP_MAX = 150;
function fitChip(chip) {
  const table = chip.closest("table");
  const card = document.getElementById(SECTION);
  if (!table || !card || !card.getClientRects().length) return;
  chip.style.display = "";
  chip.style.maxWidth = `${CHIP_MAX}px`;
  const over = table.getBoundingClientRect().right - card.getBoundingClientRect().right;
  if (over <= 0.5) return;
  const room = Math.floor(chip.getBoundingClientRect().width - over);
  if (room >= 40) chip.style.maxWidth = `${room}px`;
  else chip.style.display = "none";
}

// ── B5: S05's embodied carbon from the applied assemblies ─────────────
// A row of its own under E.3.4 (Andy 2026-11-26: "a new field in S05 that holds this running tally and sum when
// done... so it does not interfere with current behaviour and defaults"): Σ (assembly carbon intensity × the
// row's net area) over S11's opaque rows, as MT CO2e and per m² of the floor area S05's own E.3.3 divides by
// (d_106). A RUNNING TALLY while some rows in use have no assembly, THE SUM when every one has. It is read by
// nothing: E.3.4's typed value and E.3.2's choice stand as they were. Fossil A1-A3, as the Builder's ECI.
const CARBON_ROW = "E.3.5";
const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
function tallyCarbon() {
  const O = T().Openings;
  let kg = 0;
  let inUse = 0;
  let covered = 0;
  for (const o of O.OPAQUE) {
    // the area every calculation reads: as entered, net of the openings the row hosts (Section11.js)
    const hosted = O.ALL.filter((r) => String(getM(`ch_${r.s11}`) || "") === String(o.s11));
    const net = num(getM(`d_${o.s11}`)) - hosted.reduce((sum, r) => sum + num(getM(`d_${r.s10}`)), 0);
    if (!(net > 0)) continue;
    inUse++;
    const link = linkOf(o.s11);
    if (!link || !Number.isFinite(link.eci)) continue;
    covered++;
    kg += link.eci * net;
  }
  const floor = num(getM("d_106")) || num(getM("d_106", ""));
  return { kg, inUse, covered, perM2: floor > 0 ? kg / floor : null };
}
function renderCarbon() {
  const anchor = document.querySelector('#emissions [data-field-id="i_41"]');
  const after = anchor && anchor.closest("tr");
  if (!after || !T().Openings || !T().StateManager) return;
  let tr = after.parentNode.querySelector(`tr[data-id="${CARBON_ROW}"]`);
  if (!tr) {
    tr = document.createElement("tr");
    tr.dataset.id = CARBON_ROW;
    tr.className = "op-carbon-row";
    tr.innerHTML = `<td class="col-a"></td><td class="col-b id-cell"></td>
      <td class="col-c description-cell">Embodied Carbon of Applied Assemblies (A1-3)</td>
      <td class="col-d calculated-value" data-op-field="asm_carbon_total"></td><td class="col-e">MT CO2e</td>
      <td class="col-f label-prefix">${CARBON_ROW}</td><td class="col-g label-main">From S11's Assemblies (A1-3)</td>
      <td class="col-h"></td><td class="col-i calculated-value" data-op-field="asm_carbon_intensity"></td>
      <td class="col-j" colspan="5" data-op-field="asm_carbon_status"></td>`;
    tr.title =
      "Σ (assembly embodied carbon × the row's net area) over S11's opaque rows, fossil A1-A3, as the Assembly " +
      "Builder gives it. Shown beside E.3.4; nothing reads it.";
    after.after(tr);
  }
  const set = (field, text) => {
    const el = tr.querySelector(`[data-op-field="${field}"]`);
    if (el.textContent !== text) el.textContent = text;
  };
  const t = tallyCarbon();
  const fmt = (n, d) => n.toLocaleString("en-CA", { minimumFractionDigits: d, maximumFractionDigits: d });
  set("asm_carbon_total", t.covered ? fmt(t.kg / 1000, 2) : "\u2014");
  set("asm_carbon_intensity", t.covered && t.perM2 !== null ? fmt(t.perM2, 2) : "\u2014");
  const rows = `${t.covered} of ${t.inUse} opaque row${t.inUse === 1 ? "" : "s"}`;
  set(
    "asm_carbon_status",
    !t.covered
      ? "no assembly applied in S11 yet"
      : t.covered < t.inUse
        ? `kgCO2e/m\u00b2 · running tally: ${rows}`
        : `kgCO2e/m\u00b2 · sum: all ${t.inUse} opaque row${t.inUse === 1 ? "" : "s"}`
  );
  tr.classList.toggle("op-carbon-complete", t.covered > 0 && t.covered === t.inUse);
}

function followMirror() {
  for (const o of builderRows()) {
    const refValue = getM(valueField(o), "ref_");
    const target = linkOf(o.s11, "");
    const ref = linkOf(o.s11, "ref_");
    if (target && sameRsi(refValue, linkValue(o, target))) setM(`ca_${o.s11}`, JSON.stringify(target), "ref_");
    else if (ref && !sameRsi(refValue, linkValue(o, ref))) setM(`ca_${o.s11}`, "", "ref_");
  }
  decorate();
}

function onActivate(e) {
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  const cell = e.target.closest && e.target.closest(`#${SECTION} td.id-cell.op-asm-btn`);
  if (!cell) return;
  const o = rowOf(cell.closest("tr"));
  if (!o) return;
  e.preventDefault();
  openBuilder(o);
}

export function initBuilders() {
  window.addEventListener("message", onMessage);
  document.addEventListener("click", onActivate);
  document.addEventListener("keydown", onActivate);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openRow) closeBuilder();
  });
  const start = () => {
    const SM = T().StateManager;
    const host = document.getElementById(SECTION);
    if (!SM || !SM.addListener || !host || !builderRows().length) return setTimeout(start, 300);
    // An RSI or a U typed by hand is not the Builder's: the typed value wins and the row forgets what was applied.
    // Read when the cell is left, after V3's own handler has stored the entry (its edit does not notify
    // a StateManager listener).
    host.addEventListener("focusout", (e) => {
      const cell = e.target.closest && e.target.closest('td[data-field-id^="f_"], td[data-field-id^="g_"]');
      const o = cell && rowOf(cell.closest("tr"));
      if (!o || cell.dataset.fieldId !== valueField(o)) return;
      const p = pre(); // the model the cell was typed in
      setTimeout(() => {
        const link = linkOf(o.s11, p);
        if (!link || sameRsi(getM(valueField(o), p), linkValue(o, link))) return;
        setM(`ca_${o.s11}`, "", p);
        decorate();
      }, 0);
    });
    for (const o of builderRows()) {
      SM.addListener(`ca_${o.s11}`, decorate);
      SM.addListener(`ref_ca_${o.s11}`, decorate);
    }
    // Copy from Target (V3's mirror: the fields FieldManager lists, so not ca_): where it carried the Target's
    // value into the Reference, the Target's assembly goes with it; a Reference row whose value is no longer its
    // assembly's forgets it.
    for (const id of ["mirrorGeometryBtn", "mirrorGeometryPlusCodeBtn", "mirrorAllInputsBtn"]) {
      document.getElementById(id)?.addEventListener("click", () => setTimeout(followMirror, 400));
    }
    // V3 re-renders S11's rows (a second render at start-up, + and −, a type change): keep them decorated
    let queued = false;
    new window.MutationObserver(() => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(() => {
        queued = false;
        decorate();
      });
    }).observe(host, { childList: true, subtree: true });
    // S05's row follows: V3 re-renders S05 too, an area edit restamps S11 (seen above), the model on screen changes
    const s05 = document.getElementById("emissions");
    if (s05) new window.MutationObserver(() => renderCarbon()).observe(s05, { childList: true, subtree: true });
    // the model on screen changed: each row shows that model's own assembly
    new window.MutationObserver(() => decorate()).observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });
    host.addEventListener("focusout", () => setTimeout(renderCarbon, 50));
    decorate();
  };
  start();
}
