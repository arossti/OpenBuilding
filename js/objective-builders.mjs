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

// What Apply left on a row, or null. An assembly: { id, name, group, method, rsi, eci, bio, t, edited };
// an opening: { id, name, cls, u, basis ("certified" | "computed"), uw_computed, uw_certified, w, h, edited }
function linkOf(s11) {
  try {
    return JSON.parse(T().StateManager.getValue(`ca_${s11}`) || "null");
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
  const SM = T().StateManager;
  const group = isOpaque(o) ? GROUP_OF[SM.getValue(`c_${o.s11}`) || o.type] || "Wa" : CLASS_OF[o.kind] || "Window";
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
  const SM = T().StateManager;
  let link, value;
  if (m.kind === "assembly" && isOpaque(openRow)) {
    if (!Number.isFinite(m.rsi_eff) || m.rsi_eff <= 0) return;
    value = +m.rsi_eff.toFixed(4);
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
  SM.setValue(`ca_${openRow.s11}`, JSON.stringify(link), "user-modified");
  SM.setValue(valueField(openRow), String(value), "user-modified");
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

function onActivate(e) {
  if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
  const cell = e.target.closest && e.target.closest(`#${SECTION} td.id-cell.op-asm-btn`);
  if (!cell || isReference()) return; // the Reference's rows are the standard's
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
      if (!o || isReference() || cell.dataset.fieldId !== valueField(o)) return;
      setTimeout(() => {
        const link = linkOf(o.s11);
        if (!link || sameRsi(SM.getValue(valueField(o)), linkValue(o, link))) return;
        SM.setValue(`ca_${o.s11}`, "", "user-modified");
        decorate();
      }, 0);
    });
    for (const o of builderRows()) SM.addListener(`ca_${o.s11}`, decorate);
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
    decorate();
  };
  start();
}
