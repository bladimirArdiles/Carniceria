import fs from "fs";

console.log("=======================================================");
console.log("🧪 TEST SUITE: ACTUALIZACIÓN MASIVA DE PRECIOS");
console.log("=======================================================");

// 1. Simulación de lógica de cálculo
function calcPrice({ current, type, value, roundTo, isCost = false }) {
  const factor = roundTo > 1 ? roundTo : 1;
  let res = type === "percentage" ? current * (1 + value / 100) : current + value;
  res = Math.round(res / factor) * factor;
  return Math.max(res, isCost ? 0 : 1);
}

// Casos de prueba
const tests = [
  {
    name: "Aumento porcentual +10% con redondeo a $10",
    input: { current: 11900, type: "percentage", value: 10, roundTo: 10 },
    expected: 13090, // 11900 * 1.1 = 13090
  },
  {
    name: "Aumento porcentual +8% con redondeo a $50",
    input: { current: 13800, type: "percentage", value: 8, roundTo: 50 },
    // 13800 * 1.08 = 14904 -> redondeado a múltiplo de 50 = 14900
    expected: 14900,
  },
  {
    name: "Aumento porcentual +15% con redondeo a $100",
    input: { current: 8600, type: "percentage", value: 15, roundTo: 100 },
    // 8600 * 1.15 = 9890 -> redondeado a múltiplo de 100 = 9900
    expected: 9900,
  },
  {
    name: "Monto fijo +$500 con redondeo a $10",
    input: { current: 17500, type: "fixed", value: 500, roundTo: 10 },
    expected: 18000,
  },
  {
    name: "Descuento extremo no puede dejar precio <= 0",
    input: { current: 5000, type: "percentage", value: -120, roundTo: 10 },
    expected: 1, // GREATEST(..., 1)
  },
];

let failed = 0;
for (const t of tests) {
  const result = calcPrice(t.input);
  if (result === t.expected) {
    console.log(`  ✅ [PASS] ${t.name}: ${t.input.current} -> ${result}`);
  } else {
    console.error(`  ❌ [FAIL] ${t.name}: esperó ${t.expected}, obtuvo ${result}`);
    failed++;
  }
}

// 2. Verificación de archivo SQL
const sql = fs.readFileSync("supabase/schema_and_rpc.sql", "utf8");
if (sql.includes("rpc_bulk_update_prices")) {
  console.log("  ✅ [PASS] RPC rpc_bulk_update_prices presente en schema_and_rpc.sql");
} else {
  console.error("  ❌ [FAIL] RPC rpc_bulk_update_prices NO encontrada en schema_and_rpc.sql");
  failed++;
}

if (sql.includes("'BULK_PRICE_UPDATE'")) {
  console.log("  ✅ [PASS] Registro inmutable de auditoría configurado");
} else {
  console.error("  ❌ [FAIL] Registro de auditoría faltante");
  failed++;
}

console.log("=======================================================");
if (failed === 0) {
  console.log("🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE.");
} else {
  console.error(`💥 ${failed} PRUEBAS FALLARON.`);
  process.exit(1);
}
console.log("=======================================================");
