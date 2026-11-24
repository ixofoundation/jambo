/**
 * The on-phone outbox: one IndexedDB database with two stores.
 *
 *  - `files`:  photos and videos picked while offline, waiting to upload.
 *  - `claims`: claims submitted while offline, waiting to send.
 *
 * IndexedDB, not localStorage: it holds files (Blobs), and localStorage is
 * capped at ~5MB. See docs/pwa.md, "Offline claims".
 */

const DB_NAME = 'jambo-outbox';
const DB_VERSION = 1;
export const FILES = 'files';
export const CLAIMS = 'claims';

let dbPromise: Promise<IDBDatabase> | null = null;

export function isOutboxAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function open(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(CLAIMS)) db.createObjectStore(CLAIMS, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function put<T>(store: string, value: T): Promise<void> {
  const db = await open();
  await done(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function get<T>(store: string, id: string): Promise<T | undefined> {
  const db = await open();
  return done<T | undefined>(db.transaction(store, 'readonly').objectStore(store).get(id));
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await open();
  return done<T[]>(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function remove(store: string, id: string): Promise<void> {
  const db = await open();
  await done(db.transaction(store, 'readwrite').objectStore(store).delete(id));
}

/** Logout: everything goes. */
export async function clearAll(): Promise<void> {
  if (!isOutboxAvailable()) return;
  const db = await open();
  await Promise.all([FILES, CLAIMS].map((s) => done(db.transaction(s, 'readwrite').objectStore(s).clear())));
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/** Ask the browser not to clear this storage when the phone runs low on space. Best effort. */
export function askToKeepStorage(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* not supported */
  }
}
