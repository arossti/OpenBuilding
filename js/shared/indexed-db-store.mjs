// indexed-db-store.mjs
// Shared IndexedDB persistence for cross-tab workflows. PDF-Parser writes
// projects + PDF blobs; BEAMweb reads them to flow polygon takeoffs into
// PROJECT dimensions. EPD-Parser writes pending material-record changes;
// the Database viewer reads them and applies Trust / Trust + Verify decisions.
// One origin = one database; both apps open the same instance and see the same records.
//
// Three object stores:
//   - parser-projects: { uuid, pdfFileName, pdfPageCount, projectJson, updatedAt }
//       Full PDF-Parser ProjectStore JSON, indexed by uuid.
//   - parser-pdfs:     { uuid, blob }
//       The original PDF bytes so a returning user doesn't re-drop the file.
//   - epd-pending-changes: { source_file, state, candidate_record, audit_meta, ... }
//       EPD-Parser candidate records keyed by EPD source filename. state is
//       "draft" (still being edited) or "captured" (ready for Trust). The DB
//       viewer queries state == "captured".
//
// All calls are Promises. Errors bubble; callers handle (typically by falling
// back to cold-start behaviour — IndexedDB isn't load-bearing for the happy
// path, it's session persistence.

const DB_NAME = "bfca-openbuilding";
const DB_VERSION = 2;
const STORE_PROJECTS = "parser-projects";
const STORE_PDFS = "parser-pdfs";
const STORE_EPD_PENDING = "epd-pending-changes";

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available in this environment"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: "uuid" });
      }
      if (!db.objectStoreNames.contains(STORE_PDFS)) {
        db.createObjectStore(STORE_PDFS, { keyPath: "uuid" });
      }
      if (!db.objectStoreNames.contains(STORE_EPD_PENDING)) {
        // Keyed by EPD source filename — re-dropping the same file updates
        // the existing draft rather than spawning a duplicate.
        db.createObjectStore(STORE_EPD_PENDING, { keyPath: "source_file" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function awaitReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(storeName, mode) {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function putProject(record) {
  if (!record || !record.uuid) throw new Error("putProject: record.uuid required");
  record.updatedAt = record.updatedAt || new Date().toISOString();
  const s = await store(STORE_PROJECTS, "readwrite");
  await awaitReq(s.put(record));
  return record;
}

export async function getProject(uuid) {
  const s = await store(STORE_PROJECTS, "readonly");
  return awaitReq(s.get(uuid));
}

export async function listProjects() {
  const s = await store(STORE_PROJECTS, "readonly");
  const all = (await awaitReq(s.getAll())) || [];
  // Newest first — consumers usually want the most recently-touched project.
  all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  return all;
}

export async function deleteProject(uuid) {
  const p = await store(STORE_PROJECTS, "readwrite");
  await awaitReq(p.delete(uuid));
  const b = await store(STORE_PDFS, "readwrite");
  await awaitReq(b.delete(uuid));
}

export async function putPdfBytes(uuid, blob) {
  if (!uuid) throw new Error("putPdfBytes: uuid required");
  const s = await store(STORE_PDFS, "readwrite");
  await awaitReq(s.put({ uuid, blob }));
}

export async function getPdfBytes(uuid) {
  const s = await store(STORE_PDFS, "readonly");
  const rec = await awaitReq(s.get(uuid));
  return rec ? rec.blob : null;
}

/* ── EPD-Parser pending-changes API ──────────────────────────────────
   Cross-tab queue feeding the Database viewer. Producer: EPD-Parser
   (auto-saves drafts; Capture promotes draft → captured). Consumer:
   Database viewer (Trust / Trust + Verify on captured rows). */

export async function putPending(record) {
  if (!record || !record.source_file) {
    throw new Error("putPending: record.source_file required");
  }
  record.updated_at = new Date().toISOString();
  if (!record.created_at) record.created_at = record.updated_at;
  const s = await store(STORE_EPD_PENDING, "readwrite");
  await awaitReq(s.put(record));
  return record;
}

export async function getPending(sourceFile) {
  const s = await store(STORE_EPD_PENDING, "readonly");
  return awaitReq(s.get(sourceFile));
}

export async function listPending(filter) {
  const s = await store(STORE_EPD_PENDING, "readonly");
  const all = (await awaitReq(s.getAll())) || [];
  const filtered = filter ? all.filter(filter) : all;
  filtered.sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));
  return filtered;
}

export async function listCapturedPending() {
  return listPending((r) => r.state === "captured");
}

export async function deletePending(sourceFile) {
  const s = await store(STORE_EPD_PENDING, "readwrite");
  await awaitReq(s.delete(sourceFile));
}

export function generateUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  // Non-cryptographic fallback — fine for local record keys where collision
  // probability across a single user's sessions is negligible.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
