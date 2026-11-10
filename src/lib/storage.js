import { useEffect, useRef, useState } from "react";
import { idbGet, idbSet, purgeSensitiveLocalStorage } from "./idb.js";

const PREFIX = "ca:";

export const STORAGE_KEYS = [
  "products",
  "customers",
  "sales",
  "payments",
  "movements",
  "sync_outbox",
  "cash_movements",
  "suppliers",
  "supplier_purchases",
  "supplier_payments",
];

// Limpieza automática inmediata de datos comerciales o sensibles residuales de localStorage
if (typeof window !== "undefined") {
  purgeSensitiveLocalStorage();
}

/**
 * Hook de almacenamiento estrictamente reservado para preferencias cosméticas de UI
 * (ej: tema visual 'dark' | 'light').
 * NUNCA debe utilizarse para credenciales, clientes, inventario ni dinero.
 */
export function useStored(key, initial) {
  // Solo se permiten claves cosméticas explícitas en localStorage
  const ALLOWED_LOCAL_KEYS = ["theme"];
  if (!ALLOWED_LOCAL_KEYS.includes(key)) {
    console.warn(`[Seguridad] Se bloqueó el intento de guardar clave no cosmética en localStorage: "${key}".`);
  }

  const [value, setValue] = useState(() => {
    try {
      if (!ALLOWED_LOCAL_KEYS.includes(key)) return initial;
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      if (!ALLOWED_LOCAL_KEYS.includes(key)) return;
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Ignorar fallos de cuota para preferencias cosméticas
    }
  }, [key, value]);

  return [value, setValue];
}

/**
 * Hook de almacenamiento asíncrono en IndexedDB (sandbox seguro del navegador)
 * para operar como réplica offline/local sin contaminar localStorage.
 */
export function useIndexedCollection(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [isLoaded, setIsLoaded] = useState(false);
  const debounceTimerRef = useRef(null);

  // Carga asíncrona exclusiva desde IndexedDB al montar
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
