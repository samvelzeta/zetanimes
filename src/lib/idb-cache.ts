import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "zetanime-cache";
const STORE = "anime-catalog";
const VERSION = 1;

interface Entry<T> {
  key: string;
  value: T;
  expiresAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "key" });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Guarda un objeto en IndexedDB con TTL.
 * Por defecto 1h para emisión, 7 días para finalizados.
 */
export async function idbSet<T>(key: string, value: T, ttlMs = 60 * 60 * 1000) {
  try {
    const db = await getDB();
    const entry: Entry<T> = { key, value, expiresAt: Date.now() + ttlMs };
    await db.put(STORE, entry);
  } catch (err) {
    console.warn("[idb] set fail", err);
  }
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await getDB();
    const entry = (await db.get(STORE, key)) as Entry<T> | undefined;
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      await db.delete(STORE, key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export async function idbDelete(key: string) {
  try {
    const db = await getDB();
    await db.delete(STORE, key);
  } catch {}
}

export async function idbClear() {
  try {
    const db = await getDB();
    await db.clear(STORE);
  } catch {}
}
