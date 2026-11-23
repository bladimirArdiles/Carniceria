import { useEffect, useRef } from "react";

/**
 * useBarcodeScanner - Hook para captura pasiva y ultrarrápida de escáneres de código de barras.
 * 
 * Principio físico del hardware de escáner USB / Bluetooth:
 * Un lector de código de barras emula un teclado (HID).
 * Dispara los 13 dígitos seguidos a velocidades menores a 25-40 milisegundos entre caracteres,
 * terminando con una tecla 'Enter'.
 * 
 * Este hook:
 * 1. Mide el delta de tiempo entre pulsaciones.
 * 2. Si detecta la ráfaga de alta velocidad (< 45ms), captura el búfer y previene
 *    que se escriba accidentalmente en inputs de texto donde el cajero estuviese buscando.
 * 3. Al recibir 'Enter', despacha el código completo al callback `onScan`.
 * 
 * @param {Function} onScan - Callback invocado con la cadena decodificada
 * @param {Object} options - Configuración de tiempos y estado
 * @param {boolean} options.enabled - Habilitar o suspender la escucha
 * @param {number} options.maxIntervalMs - Umbral máximo entre caracteres para considerarse escáner (default: 45ms)
 * @param {number} options.minBarcodeLen - Longitud mínima esperada (default: 4)
 */
export function useBarcodeScanner(onScan, { enabled = true, maxIntervalMs = 45, minBarcodeLen = 4 } = {}) {
  const bufferRef = useRef("");
  const lastTimeRef = useRef(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      try {
        const now = Date.now();
        const diff = now - lastTimeRef.current;
        lastTimeRef.current = now;

        // Si la tecla es Enter, verificar si el búfer acumulado corresponde a un escaneo
        if (e.key === "Enter") {
          const barcode = bufferRef.current.trim();
          bufferRef.current = "";

          if (barcode.length >= minBarcodeLen) {
            // Prevenir acción de submit o enter en formularios
            e.preventDefault();
            e.stopPropagation();

            if (typeof onScanRef.current === "function") {
              onScanRef.current(barcode);
            }
          }
          return;
        }

        // Si pasó más tiempo que el umbral del escáner (ej: el usuario está escribiendo despacio a mano)
        if (diff > maxIntervalMs) {
          // Reiniciar búfer con el nuevo carácter
          bufferRef.current = e.key.length === 1 ? e.key : "";
          return;
        }

        // Es una ráfaga rápida (escáner): acumular
        if (e.key.length === 1) {
          bufferRef.current += e.key;

          // Si el búfer ya supera 3 caracteres en ráfaga rápida y el usuario estaba en un input,
          // prevenir que los dígitos del código de barras se mezclen en el texto de búsqueda
          if (bufferRef.current.length >= 3) {
            const activeEl = document.activeElement;
            const isTypingField = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");
            if (isTypingField && activeEl.type === "search") {
              e.preventDefault();
            }
          }
        }
      } catch (err) {
        console.error("Excepción en useBarcodeScanner:", err);
        bufferRef.current = "";
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [enabled, maxIntervalMs, minBarcodeLen]);
}
