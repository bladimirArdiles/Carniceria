/**
 * Capa de Persistencia Local Segura en IndexedDB para Terminal POS
 * 
 * Cumplimiento de directiva:
 * - NINGÚN dato de negocio sensible ni transaccional se guarda en localStorage.
 * - IndexedDB opera como réplica aislada en el sandbox del navegador.
 * - Si IndexedDB no está disponible, se mantiene en memoria volátil de sesión.
 */

const DB_NAME = "carniceria_pos_db";
const DB_VERSION = 1;
const STORE_NAME = "collections";

let dbInstance = null;
let dbPromise = null;
const memoryFallback = new Map();

/**
 * Purgado preventivo de cualquier residuo comercial o de autenticación en localStorage
 */
export function purgeSensitiveLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return;
  const SENSITIVE_KEYS = [
    "ca:products",
    "ca:customers",
    "ca:sales",
    "ca:payments",
    "ca:movements",
    "ca:sync_outbox",
    "ca:auth-session",
    "ca:auth_user",
    "ca:cash_movements",
    "ca:suppliers",
    "ca:supplier_purchases",
    "ca:supplier_payments",
  ];
  try {
    for (const k of SENSITIVE_KEYS) {
      if (localStorage.getItem(k) !== null) {
        localStorage.removeItem(k);
      }
    }
  } catch (e) {
    console.warn("No se pudo purgar localStorage sensible:", e);
  }
}

function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return resolve(null);
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (err) => {
        console.warn("IndexedDB no disponible, operando en memoria:", err);
        resolve(null);
      };
    } catch (e) {
      console.warn("Excepción al inicializar IndexedDB:", e);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Obtiene una colección almacenada en IndexedDB (sin tocar localStorage)
 */
export async function idbGet(key, defaultValue = null) {
  try {
    const db = await openDatabase();
    if (!db) {
      return memoryFallback.has(key) ? memoryFallback.get(key) : defaultValue;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = () => {
          if (req.result !== undefined && req.result !== null) {
            resolve(req.result);
          } else {
            resolve(defaultValue);
          }
        };

        req.onerror = () => resolve(defaultValue);
      } catch {
        resolve(defaultValue);
      }
    });
  } catch {
    return defaultValue;
  }
}

/**
 * Guarda una colección en IndexedDB (sin tocar localStorage)
 */
export async function idbSet(key, value) {
  try {
    const db = await openDatabase();
    if (!db) {
      memoryFallback.set(key, value);
      return true;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch (err) {
    console.warn(`Error al escribir en IndexedDB [${key}]:`, err);
    memoryFallback.set(key, value);
  }
}

/**
 * Elimina una clave de IndexedDB
 */
export async function idbDelete(key) {
  try {
    memoryFallback.delete(key);
    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {}
}

/**
 * Limpia la base de datos local
 */
export async function idbClear() {
  try {
    memoryFallback.clear();
    const db = await openDatabase();
    if (!db) return;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {}
}
