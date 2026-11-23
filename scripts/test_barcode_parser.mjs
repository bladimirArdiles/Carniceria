/**
 * test_barcode_parser.mjs
 * Test suite para validar el motor de balanzas EAN-13 y códigos de retail.
 */

import { parseBarcode, isValidEan13Checksum, generateScaleBarcode } from "../src/lib/barcodeParser.js";

console.log("=======================================================");
console.log("⚖️ TEST SUITE: MOTOR DE LECTURA DE BALANZA (EAN-13)");
console.log("=======================================================");

const mockProducts = [
  { id: "p-asado", name: "Asado de tira", price: 14000, plu: 12, unit: "kg" },
  { id: "p-vacio", name: "Vacío", price: 16000, plu: 15, unit: "kg" },
  { id: "p-carbon", name: "Bolsa Carbón 4kg", price: 3500, barcode: "7791234567890", unit: "u" },
];

// Test 1: Validación matemática de Checksum EAN-13
const validCode = generateScaleBarcode(12, 1500, "weight"); // PLU 12, 1.500 kg
console.log("  Código generado:", validCode);
if (isValidEan13Checksum(validCode)) {
  console.log("  ✅ [PASS] Checksum EAN-13 matemáticamente válido.");
} else {
  console.error("  ❌ [FAIL] Error en algoritmo de checksum.");
  process.exit(1);
}

// Test 2: Decodificación correcta de corte pesable (Asado, 1.500 kg)
const parsedWeight = parseBarcode(validCode, mockProducts, { scaleMode: "weight" });
if (parsedWeight.success && parsedWeight.product.id === "p-asado" && parsedWeight.qty === 1.5 && parsedWeight.total === 21000) {
  console.log(`  ✅ [PASS] Decodificación exitosa: ${parsedWeight.message}`);
} else {
  console.error("  ❌ [FAIL] Error al parsear código de peso:", parsedWeight);
  process.exit(1);
}

// Test 3: Código de barras de balanza en modo importe ($5.000)
const priceCode = generateScaleBarcode(12, 5000, "price");
const parsedPrice = parseBarcode(priceCode, mockProducts, { scaleMode: "price" });
if (parsedPrice.success && parsedPrice.total === 5000 && parsedPrice.qty > 0) {
  console.log(`  ✅ [PASS] Decodificación por importe exitosa: ${parsedPrice.message}`);
} else {
  console.error("  ❌ [FAIL] Error en modo importe:", parsedPrice);
  process.exit(1);
}

// Test 4: Manejo de Excepción - PLU no encontrado
const unknownPluCode = generateScaleBarcode(99, 1200, "weight");
const parsedUnknown = parseBarcode(unknownPluCode, mockProducts);
if (!parsedUnknown.success && parsedUnknown.error.includes("PLU #99 no encontrado")) {
  console.log("  ✅ [PASS] Excepción controlada: Rechaza correctamente PLU no asignado.");
} else {
  console.error("  ❌ [FAIL] Debería haber fallado por PLU desconocido:", parsedUnknown);
  process.exit(1);
}

// Test 5: Manejo de Excepción - Dígito verificador corrupto
const corruptCode = validCode.slice(0, 12) + (validCode[12] === "9" ? "0" : "9");
const parsedCorrupt = parseBarcode(corruptCode, mockProducts);
if (!parsedCorrupt.success && parsedCorrupt.error.includes("Dígito verificador corrupto")) {
  console.log("  ✅ [PASS] Excepción controlada: Rechaza etiqueta con lectura corrupta o sucia.");
} else {
  console.error("  ❌ [FAIL] Debería haber fallado por checksum corrupto:", parsedCorrupt);
  process.exit(1);
}

// Test 6: Producto de almacén (Carbón)
const parsedDirect = parseBarcode("7791234567890", mockProducts);
if (parsedDirect.success && parsedDirect.product.id === "p-carbon" && parsedDirect.qty === 1) {
  console.log(`  ✅ [PASS] Producto directo escaneado exitosamente: ${parsedDirect.message}`);
} else {
  console.error("  ❌ [FAIL] Error con producto de código directo:", parsedDirect);
  process.exit(1);
}

console.log("=======================================================");
console.log("🎉 TODAS LAS PRUEBAS DE BALANZA PASARON EXITOSAMENTE.");
console.log("=======================================================");
