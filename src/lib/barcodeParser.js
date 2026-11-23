/**
 * barcodeParser.js - Motor de Decodificación y Validación de Códigos de Balanza y Retail
 * 
 * Soporta:
 * 1. Balanzas comerciales de mostrador (Systel, Kretz, Toledo, Moretti, Hasar, Torrey, Dibal).
 *    Formato EAN-13 de 13 dígitos con prefijo '20':
 *    - Variante Peso (Por defecto): 20 + AAAAA (PLU 5 dígitos) + PPPPP (Gramos 5 dígitos) + C (Verificador)
 *    - Variante Importe: 20 + AAAAA (PLU 5 dígitos) + IIIII (Importe entero o centavos) + C (Verificador)
 * 2. Códigos de barra estándar de productos envasados (EAN-13, EAN-8, UPC-A, etc.).
 */

/**
 * Valida el dígito verificador estándar EAN-13 (Algoritmo Módulo 10 ponderado 1x / 3x).
 * 
 * @param {string} code13 - Cadena de 13 dígitos numéricos
 * @returns {boolean} true si el dígito de control es matemáticamente correcto
 */
export function isValidEan13Checksum(code13) {
  try {
    if (!code13 || typeof code13 !== "string" || code13.length !== 13 || !/^\d{13}$/.test(code13)) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(code13[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }

    const mod = sum % 10;
    const expectedCheck = mod === 0 ? 0 : 10 - mod;
    const actualCheck = parseInt(code13[12], 10);

    return expectedCheck === actualCheck;
  } catch (err) {
    console.error("Error al validar checksum EAN-13:", err);
    return false;
  }
}

/**
 * Genera un código de balanza EAN-13 simulado para pruebas de desarrollo.
 * 
 * @param {number|string} plu - Código numérico PLU (ej: 1, 12, 105)
 * @param {number} grams - Kilos/gramos (ej: 1.500 kg = 1500 g)
 * @param {string} mode - 'weight' (gramos) o 'price' (importe)
 * @returns {string} Código EAN-13 completo de 13 dígitos
 */
export function generateScaleBarcode(plu, grams, mode = "weight") {
  try {
    const safePlu = String(parseInt(plu, 10) || 1).padStart(5, "0").slice(-5);
    const safeVal = String(Math.round(grams || 0)).padStart(5, "0").slice(-5);
    const body = `20${safePlu}${safeVal}`;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(body[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const mod = sum % 10;
    const checkDigit = mod === 0 ? 0 : 10 - mod;

    return `${body}${checkDigit}`;
  } catch (err) {
    console.error("Error al generar código simulado de balanza:", err);
    return "2000001010007";
  }
}

/**
 * Parsea e interpreta una lectura de código de barras.
 * 
 * @param {string} rawBarcode - Cadena leída por el escáner
 * @param {Array} productsList - Lista actual de productos en el sistema
 * @param {Object} options - Opciones de configuración de balanza
 * @param {string} options.scaleMode - 'weight' (gramos en balanza) o 'price' (importe total en balanza)
 * @returns {Object} Resultado del parseo con { success, error, product, qty, total, type, plu }
 */
export function parseBarcode(rawBarcode, productsList = [], options = {}) {
  try {
    if (!rawBarcode || typeof rawBarcode !== "string") {
      return { success: false, error: "Lectura vacía o inválida del escáner." };
    }

    const clean = rawBarcode.trim().replace(/\D/g, ""); // Extraer estrictamente dígitos numéricos

    if (clean.length < 3) {
      return { success: false, error: "Código de barras demasiado corto." };
    }

    // 1. CASO BALANZA: EAN-13 de 13 dígitos que inicia con prefijo '20'
    if (clean.length === 13 && clean.startsWith("20")) {
      // Validar dígito verificador
      const isChecksumOk = isValidEan13Checksum(clean);
      if (!isChecksumOk) {
        return {
          success: false,
          error: `Dígito verificador corrupto en código de balanza (${clean}). Verifique la etiqueta.`,
        };
      }

      // Extraer campos
      // Prefijo: clean.slice(0, 2) === '20'
      const rawPlu = clean.slice(2, 7); // 5 dígitos de código de corte (PLU)
      const pluNum = parseInt(rawPlu, 10);
      const rawPayload = clean.slice(7, 12); // 5 dígitos de valor (peso o importe)
      const payloadNum = parseInt(rawPayload, 10);

      if (isNaN(pluNum) || pluNum <= 0) {
        return { success: false, error: "Código PLU de balanza inválido (0)." };
      }

      if (isNaN(payloadNum) || payloadNum <= 0) {
        return { success: false, error: "La balanza registró peso o importe en cero." };
      }

      // Buscar el producto en el catálogo por PLU o por coincidencia de barcode
      // Soporta:
      // a) product.plu === pluNum
      // b) product.barcode === String(pluNum) o product.barcode === rawPlu
      // c) Fallback: coincidencia por ID o índice si no tiene PLU explícito
      const product = productsList.find((p) => {
        if (!p || p.is_active === false) return false;
        if (p.plu !== undefined && p.plu !== null && Number(p.plu) === pluNum) return true;
        if (p.barcode && (p.barcode === String(pluNum) || p.barcode === rawPlu || p.barcode === clean)) return true;
        return false;
      });

      if (!product) {
        return {
          success: false,
          error: `Corte de balanza PLU #${pluNum} no encontrado en el sistema. Asígnelo en la sección de Stock.`,
          plu: pluNum,
        };
      }

      const scaleMode = options.scaleMode || "weight";

      if (scaleMode === "weight") {
        // En balanza estándar: 5 dígitos representan gramos (ej: 01500 = 1.500 kg)
        const qtyKg = Math.round((payloadNum / 1000) * 1000) / 1000;
        const total = Math.round(qtyKg * (product.price || 0));

        return {
          success: true,
          type: "scale_weight",
          product,
          plu: pluNum,
          qty: qtyKg,
          total,
          rawBarcode: clean,
          message: `${product.name}: ${qtyKg} kg ($${total.toLocaleString("es-AR")})`,
        };
      } else {
        // Modo importe: los 5 dígitos representan el importe total cobrado por la balanza
        const totalMoney = payloadNum;
        const pricePerUnit = product.price > 0 ? product.price : 1;
        const calculatedQty = Math.round((totalMoney / pricePerUnit) * 1000) / 1000;

        return {
          success: true,
          type: "scale_price",
          product,
          plu: pluNum,
          qty: calculatedQty,
          total: totalMoney,
          rawBarcode: clean,
          message: `${product.name}: $${totalMoney.toLocaleString("es-AR")} (${calculatedQty} kg)`,
        };
      }
    }

    // 2. CASO PRODUCTO ENVASADO O CÓDIGO DIRECTO (Carbón, vinos, condimentos, chimichurri)
    const directProduct = productsList.find((p) => {
      if (!p || p.is_active === false) return false;
      if (p.barcode && p.barcode.trim() === clean) return true;
      if (p.plu && String(p.plu) === clean) return true;
      return false;
    });

    if (directProduct) {
      const defaultQty = directProduct.unit === "kg" ? 1.0 : 1;
      const total = Math.round(defaultQty * (directProduct.price || 0));

      return {
        success: true,
        type: "direct_item",
        product: directProduct,
        qty: defaultQty,
        total,
        rawBarcode: clean,
        message: `${directProduct.name}: 1 ${directProduct.unit === "kg" ? "kg" : "unidad"}`,
      };
    }

    return {
      success: false,
      error: `Código de barras "${clean}" no reconocido ni asignado a ningún corte.`,
      rawBarcode: clean,
    };
  } catch (err) {
    console.error("Excepción inesperada en parseBarcode:", err);
    return {
      success: false,
      error: "Error interno al decodificar código de barras: " + (err.message || String(err)),
    };
  }
}

/**
 * Reproduce un tono de confirmación sonora usando Web Audio API.
 * Garantiza retroalimentación auditiva en el mostrador sin cargar archivos de audio externos.
 * 
 * @param {'success' | 'error'} type 
 */
export function playScannerBeep(type = "success") {
  try {
    if (typeof window === "undefined") return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "success") {
      // Tono agudo y limpio típico de caja registradora (1750 Hz por 70 ms)
      osc.type = "sine";
      osc.frequency.setValueAtTime(1750, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } else {
      // Tono grave doble de error (220 Hz / 160 Hz)
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (err) {
    // Si el navegador bloquea audio sin interacción previa, silenciar limpiamente
    console.warn("Web Audio API no disponible o bloqueado por el navegador:", err);
  }
}
