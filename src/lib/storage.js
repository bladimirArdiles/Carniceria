import { useEffect, useState } from "react";

const PREFIX = "ca:";

export const STORAGE_KEYS = ["products", "customers", "sales", "payments", "movements"];

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
