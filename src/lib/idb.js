/**
 * Capa de Persistencia Offline en IndexedDB para Terminal POS y Carnicería
 * 
 * Ventajas sobre localStorage:
 * - Capacidad de almacenamiento de gigabytes (sin límite de 5MB).
 * - Escritura asíncrona sin bloquear el hilo de ejecución principal ni la UI táctil.
 * - Soporte nativo de objetos estructurados sin sobrecarga de JSON.stringify masivo.
 * - Migración automática transparente desde localStorage al iniciar.
 */

const DB_NAME = "carniceria_pos_db";
const DB_VERSION = 1;
const STORE_NAME = "collections";

let dbInstance = null;
let dbPromise = null;

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
        console.warn("No se pudo inicializar IndexedDB, operando con memoria local:", err);
        resolve(null);
      };
    } catch (e) {
      console.warn("Excepción al abrir IndexedDB:", e);
      resolve(null);
    }
  });

  return dbPromise;
}

/**
 * Obtiene una colección almacenada en IndexedDB con fallback y migración desde localStorage
 */
export async function idbGet(key, defaultValue = null) {
  try {
    const db = await openDatabase();
    if (!db) {
      const raw = localStorage.getItem("ca:" + key);
      return raw ? JSON.parse(raw) : defaultValue;
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
            // Migración automática: si no está en IndexedDB, buscar en localStorage
            try {
              const legacyRaw = localStorage.getItem("ca:" + key);
              if (legacyRaw) {
                const parsed = JSON.parse(legacyRaw);
                idbSet(key, parsed); // Guardar en IndexedDB para próximas lecturas
                return resolve(parsed);
              }
            } catch {
              // Ignorar errores de parseo
            }
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
 * Guarda una colección en IndexedDB de forma asíncrona
 */
export async function idbSet(key, value) {
  try {
    const db = await openDatabase();
    if (!db) {
      try {
        localStorage.setItem("ca:" + key, JSON.stringify(value));
      } catch {
        window.dispatchEvent(new CustomEvent("ca:storage-full"));
      }
      return;
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
  }
}

/**
 * Elimina una clave de IndexedDB
 */
export async function idbDelete(key) {
  try {
    const db = await openDatabase();
    if (!db) {
      localStorage.removeItem("ca:" + key);
      return;
    }
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
 * Limpia todas las colecciones locales
 */
export async function idbClear() {
  try {
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

