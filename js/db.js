/* db.js — tiny promise wrapper over IndexedDB. Local-first: sightings,
   species, and settings live here and survive refresh/offline. */

const DB_NAME = 'field-journal';
const DB_VERSION = 1;
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('sightings')) {
        const s = db.createObjectStore('sightings', { keyPath: 'id' });
        s.createIndex('byDate', 'dateISO');
        s.createIndex('bySpecies', 'speciesKey');
      }
      if (!db.objectStoreNames.contains('species')) {
        db.createObjectStore('species', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'k' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    const out = fn(os);
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

function reqToPromise(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export const db = {
  put: (store, val) => tx(store, 'readwrite', os => os.put(val)),
  get: (store, key) => reqToPromise(store, 'readonly', os => os.get(key)),
  del: (store, key) => tx(store, 'readwrite', os => os.delete(key)),
  all: (store) => reqToPromise(store, 'readonly', os => os.getAll()),
  clear: (store) => tx(store, 'readwrite', os => os.clear()),
  metaGet: async (k, fallback = null) => {
    const row = await reqToPromise('meta', 'readonly', os => os.get(k));
    return row ? row.v : fallback;
  },
  metaSet: (k, v) => tx('meta', 'readwrite', os => os.put({ k, v })),
};

export function newId() {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
