const DB_NAME = 'gymTrackerDB';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('exercises')) {
        const ex = db.createObjectStore('exercises', { keyPath: 'id', autoIncrement: true });
        ex.createIndex('category', 'category');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date');
        s.createIndex('type', 'type');
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const DB = {
  async add(store, obj) {
    const s = await tx(store, 'readwrite');
    return wrap(s.add(obj));
  },
  async put(store, obj) {
    const s = await tx(store, 'readwrite');
    return wrap(s.put(obj));
  },
  async get(store, id) {
    const s = await tx(store, 'readonly');
    return wrap(s.get(id));
  },
  async delete(store, id) {
    const s = await tx(store, 'readwrite');
    return wrap(s.delete(id));
  },
  async all(store) {
    const s = await tx(store, 'readonly');
    return wrap(s.getAll());
  },
  async allByIndex(store, indexName, range) {
    const s = await tx(store, 'readonly');
    return wrap(s.index(indexName).getAll(range));
  },
};
