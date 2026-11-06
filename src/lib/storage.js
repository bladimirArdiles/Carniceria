import { useEffect, useRef, useState } from "react";
import { idbGet, idbSet } from "./idb.js";

const PREFIX = "ca:";

export const STORAGE_KEYS = ["products", "customers", "sales", "payments", "movements", "sync_outbox"];

/**
 * Hook de almacenamiento síncrono en localStorage para configuraciones ligeras (tema, sesión)
 */
export function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      window.dispatchEvent(new CustomEvent("ca:storage-full"));
    }
  }, [key, value]);

  return [value, setValue];
}

/**
 * Hook de almacenamiento asíncrono en IndexedDB para colecciones de alto volumen
 * (productos, ventas, clientes, pagos, movimientos)
 * - Carga asíncrona sin bloquear renderizado inicial.
 * - Escritura diferida (debounced) para no impactar la fluidez táctil del mostrador.
 * - Sin límite de 5MB.
 */
export function useIndexedCollection(key, initialValue) {
  // Intentar lectura sincrónica de caché inmediata si existe
  const [value, setValue] = useState(() => {
    try {
      const legacy = localStorage.getItem(PREFIX + key);
      return legacy ? JSON.parse(legacy) : initialValue;
    } catch {
      return initialValue;
    }
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const debounceTimerRef = useRef(null);

  // Carga asíncrona desde IndexedDB al montar
  useEffect(() => {
    let isMounted = true;
    async function loadFromIndexedDB() {
      try {
        const stored = await idbGet(key, initialValue);
        if (isMounted && stored !== undefined && stored !== null) {
          setValue(stored);
          setIsLoaded(true);
        }
      } catch (err) {
        console.warn(`Error al leer colección ${key} de IndexedDB:`, err);
        if (isMounted) setIsLoaded(true);
      }
    }
    loadFromIndexedDB();
    return () => {
      isMounted = false;
    };
  }, [key]);

  // Persistencia diferida hacia IndexedDB tras modificaciones
  useEffect(() => {
    if (!isLoaded) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      idbSet(key, value);
    }, 250);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [key, value, isLoaded]);

  return [value, setValue, isLoaded];
}
