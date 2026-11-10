import { summarize } from "../src/lib/stats.js";

console.log("=======================================================");
console.log("🧪 TEST SUITE: PROVEEDORES, GASTOS Y MARGEN NETO DEL DUEÑO");
console.log("=======================================================");

// 1. Simulación de ventas con costo de reposición
const mockSales = [
  {
    id: "sale-1",
    date: new Date().toISOString(),
    status: "completed",
    total: 35000,
    method: "Efectivo",
    items: [
      { productId: "p-asado", name: "Asado", qty: 2.0, price: 12000, cost: 8500, unit: "kg" }, // Ingreso: $24.000, Costo: $17.000
      { productId: "p-vacio", name: "Vacío", qty: 1.0, price: 11000, cost: 8000, unit: "kg" }, // Ingreso: $11.000, Costo: $8.000
    ],
  },
  {
    id: "sale-2",
    date: new Date().toISOString(),
    status: "completed",
    total: 15000,
    method: "Tarjeta",
    items: [
      { productId: "p-picada", name: "Picada", qty: 2.0, price: 7500, cost: 5000, unit: "kg" }, // Ingreso: $15.000, Costo: $10.000
    ],
  },
];

// Facturación total esperada = 35.000 + 15.000 = $50.000
// Costo de mercadería (CMV) esperado = 17.000 + 8.000 + 10.000 = $35.000
// Margen Bruto comercial = 50.000 - 35.000 = $15.000 (30%)

// 2. Simulación de gastos operativos de la carnicería
const mockCashMovements = [
  { id: "cm-1", type: "egreso", category: "Alquiler", amount: 4000 },
  { id: "cm-2", type: "egreso", category: "Servicios", amount: 2000 },
  { id: "cm-3", type: "egreso", category: "Insumos", amount: 1500 },
];
// Gastos operativos totales = 4.000 + 2.000 + 1.500 = $7.500

// 3. Simulación de pagos a proveedores
const mockSupplierPayments = [
  { id: "sp-1", amount: 25000, method: "Transferencia" },
];

const summary = summarize(mockSales, {}, mockSales, {
  products: [],
  cashMovements: mockCashMovements,
  supplierPayments: mockSupplierPayments,
});

console.log("  📊 Facturación Bruta calculada:", summary.periodTotal);
console.log("  🥩 Costo de Mercadería (CMV):", summary.periodCost);
console.log("  📈 Margen Bruto Comercial:", summary.grossProfit, `(${summary.grossMarginPct}%)`);
console.log("  💸 Gastos Totales de Carnicería:", summary.periodExpenses);
console.log("  🏆 Ganancia Neta Real del Dueño:", summary.netProfit, `(${summary.netMarginPct}%)`);
console.log("  📑 Desglose de Gastos:", summary.expensesByCategory);

// Verificaciones
let failed = 0;
if (summary.periodTotal === 50000) {
  console.log("  ✅ [PASS] Facturación bruta correcta: $50.000");
} else {
  console.error("  ❌ [FAIL] Error en facturación:", summary.periodTotal);
  failed++;
}

if (summary.periodCost === 35000) {
  console.log("  ✅ [PASS] CMV gancho correcto: $35.000");
} else {
  console.error("  ❌ [FAIL] Error en CMV:", summary.periodCost);
  failed++;
}

if (summary.grossProfit === 15000) {
  console.log("  ✅ [PASS] Utilidad bruta correcta: $15.000");
} else {
  console.error("  ❌ [FAIL] Error en utilidad bruta:", summary.grossProfit);
  failed++;
}

if (summary.periodExpenses === 7500) {
  console.log("  ✅ [PASS] Gastos operativos correctos: $7.500");
} else {
  console.error("  ❌ [FAIL] Error en gastos:", summary.periodExpenses);
  failed++;
}

// Ganancia neta real = 15.000 (margen bruto) - 7.500 (gastos) = $7.500
if (summary.netProfit === 7500) {
  console.log("  ✅ [PASS] Ganancia Neta Real del Dueño correcta: $7.500 (15% neto en bolsillo)");
} else {
  console.error("  ❌ [FAIL] Error en ganancia neta:", summary.netProfit);
  failed++;
}

console.log("=======================================================");
if (failed === 0) {
  console.log("🎉 TODAS LAS PRUEBAS FINANCIERAS PASARON EXITOSAMENTE.");
} else {
  console.error(`💥 ${failed} PRUEBAS FALLARON.`);
  process.exit(1);
}
console.log("=======================================================");
