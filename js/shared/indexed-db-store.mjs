// indexed-db-store.mjs
// Shared IndexedDB persistence for cross-tab workflows. PDF-Parser writes
// projects + PDF blobs; BEAMweb reads them to flow polygon takeoffs into
// PROJECT dimensions. One origin = one database; both apps open the same
// instance and see the same records.
//
// Two object stores:
//   - parser-projects: { uuid, pdfFileName, pdfPageCount, projectJson, updatedAt }
//       Full PDF-Parser ProjectStore JSON, indexed by uuid.
//   - parser-pdfs:     { uuid, blob }
//       The original PDF bytes so a returning user doesn't re-drop the file.
//       Separated from the project store because Blob payloads are large and
//       BEAMweb only needs the project metadata, not the bytes.
//
// All calls are Promises. Errors bubble; callers handle (typically by falling
// back to cold-start behaviour — IndexedDB isn't load-bearing for the happy
// path, it's session persistence.

const DB_NAME = "bfca-openbuilding";
const DB_VERSION = 1;
const STORE_PROJECTS = "parser-projects";
const STORE_PDFS = "parser-pdfs";

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
