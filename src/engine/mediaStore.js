/**
 * Durable media store (IndexedDB).
 *
 * Imported files live only as blob: URLs for the session — those die on reload.
 * We stash the original File/Blob here keyed by the media id so a saved or
 * autosaved project can rehydrate fresh blob URLs on the next launch.
 *
 * Everything degrades gracefully: if IndexedDB is unavailable or a transaction
 * fails, the helpers resolve to null/false and the app behaves exactly as it did
 * before (session-only media).
 */

const DB_NAME = 'cinecutpro';
const STORE = 'media';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // Don't cache a rejected promise — let a later call retry.
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function runTx(mode, fn) {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result;
        try {
          result = fn(store);
        } catch (e) {
          reject(e);
          return;
        }
        tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      })
  );
}

/** Persist a Blob/File under `id`. Resolves true on success, false otherwise. */
export async function putMedia(id, blob) {
  try {
    await runTx('readwrite', (store) => store.put(blob, id));
    return true;
  } catch (_) {
    return false;
  }
}

/** Fetch the stored Blob for `id`, or null if absent/unavailable. */
export async function getMedia(id) {
  try {
    const blob = await runTx('readonly', (store) => store.get(id));
    return blob ?? null;
  } catch (_) {
    return null;
  }
}

/** Remove a single media blob. */
export async function deleteMedia(id) {
  try {
    await runTx('readwrite', (store) => store.delete(id));
    return true;
  } catch (_) {
    return false;
  }
}

/** Drop every stored blob (used by "New project"). */
export async function clearMedia() {
  try {
    await runTx('readwrite', (store) => store.clear());
    return true;
  } catch (_) {
    return false;
  }
}
