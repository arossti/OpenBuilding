/**
 * The Builders inside OBJECTIVE (schema/schema.md §10, B2 + B3).
 *
 * An opaque S11 row's ID cell (B.4, B.5, B.9, B.10 and the rows + adds) is a button: it opens the Assembly
 * Builder in a popup, alone in its frame, at the library group that fits the row's type. Apply Selected there
 * posts one message; this module writes the assembly's effective RSI into the row as a user entry and the row
 * remembers its assembly (ca_<row>, saved with the project by Openings.addedFields).
 *
 * THE BUILDER COMPUTES, OBJECTIVE RECEIVES: no RSI or carbon figure is derived from layers here.
 */

const BUILDER_URL = "builders/assembly-builder.html";
// S11's element type (c_<row>) → the Assembly Builder's library group (the name prefix)
const GROUP_OF = { roof: "Ra", walls: "Wa", exposedFloor: "Fa", wallsBelowGrade: "Wg", slabOnGrade: "Fg" };
const SECTION = "envelopeTransmissionLosses";

const T = () => window.TEUI || {};
const opaqueRows = () => (T().Openings && T().Openings.OPAQUE) || [];
const rowOf = (tr) => {
  const O = T().Openings;
  return (O && tr && opaqueRows().find((o) => O.s11RowId(o) === tr.dataset.id)) || null;
};
const isReference = () => !!T().ReferenceToggle?.isReferenceMode?.();

// A row's assembly, as Apply left it: { id, name, group, method, rsi, eci, bio, t, edited } or null
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
  el.innerHTML = `<div class="op-builder-frame" role="dialog" aria-modal="true" aria-label="Assembly Builder">
      <iframe title="Assembly Builder"></iframe>
    </div>`;
  el.addEventListener("click", (e) => {
    if (e.target === el) closeBuilder();
  });
  document.body.appendChild(el);
  return el;
}
function openBuilder(o) {
  const SM = T().StateManager;
  const type = SM.getValue(`c_${o.s11}`) || o.type;
  const link = linkOf(o.s11);
  const q = new window.URLSearchParams({ embed: "1", group: GROUP_OF[type] || "Wa" });
  if (link && link.id) q.set("pick", link.id);
  openRow = o;
  const el = modal();
  el.querySelector("iframe").src = `${BUILDER_URL}?${q}`;
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
  if (e.data.type !== "ob-builder-apply" || e.data.kind !== "assembly") return;
  const m = e.data;
  if (!Number.isFinite(m.rsi_eff) || m.rsi_eff <= 0) return;
  const SM = T().StateManager;
  const rsi = +m.rsi_eff.toFixed(4);
  const link = {
    id: m.id,
    name: m.name,
    group: m.group,
    method: m.rsi_method,
    rsi,
    eci: +(+m.eci_kgco2e_m2).toFixed(3),
    bio: +(+m.bio_kgco2e_m2).toFixed(3),
    t: m.thickness_mm,
    edited: !!m.edited
  };
  // the link first: the RSI listener below keeps a link whose RSI is the one being written
  SM.setValue(`ca_${openRow.s11}`, JSON.stringify(link), "user-modified");
  SM.setValue(`f_${openRow.s11}`, String(rsi), "user-modified");
  if (T().Calculator?.calculateAll) T().Calculator.calculateAll();
  closeBuilder();
  decorate();
}

// ── The rows: the ID cell is the button, the assembly's name sits by the type ─
function decorate() {
  const O = T().Openings;
  if (!O) return;
  for (const o of opaqueRows()) {
    const tr = document.querySelector(`#${SECTION} tr[data-id="${O.s11RowId(o)}"]`);
    if (!tr) continue;
    const idCell = tr.querySelector("td.id-cell");
    const link = linkOf(o.s11);
    if (idCell) {
      idCell.classList.add("op-asm-btn");
      idCell.classList.toggle("op-asm-linked", !!link);
      idCell.setAttribute("role", "button");
      idCell.tabIndex = 0;
      const title = link
        ? `${link.name}${link.edited ? " (edited)" : ""} · RSI ${link.rsi} by ${String(link.method).toUpperCase()} · open the Assembly Builder`
        : "Choose this row's assembly in the Assembly Builder";
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
    if (!SM || !SM.addListener || !host || !opaqueRows().length) return setTimeout(start, 300);
    // An RSI typed by hand is not the assembly's: the typed value wins and the row forgets its assembly.
    // Read when the cell is left, after V3's own handler has stored the entry (its edit does not notify
    // a StateManager listener).
    host.addEventListener("focusout", (e) => {
      const cell = e.target.closest && e.target.closest('td[data-field-id^="f_"]');
      const o = cell && rowOf(cell.closest("tr"));
      if (!o || isReference()) return;
      setTimeout(() => {
        const link = linkOf(o.s11);
        if (!link || sameRsi(SM.getValue(`f_${o.s11}`), link.rsi)) return;
        SM.setValue(`ca_${o.s11}`, "", "user-modified");
        decorate();
      }, 0);
    });
    for (const o of opaqueRows()) SM.addListener(`ca_${o.s11}`, decorate);
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
