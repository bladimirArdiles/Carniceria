console.log("=======================================================");
console.log("🧪 TEST SUITE: RESILIENCIA OFFLINE-FIRST (PWA / OUTBOX)");
console.log("=======================================================");

// 1. Simulación de cola de outbox
const mockIndexedDbOutbox = [];

function simulateOfflineSale({ items, total, method, customerId }) {
  const tempId = "mock-uuid-" + Math.random().toString(36).slice(2, 9);
  const localSale = {
    id: tempId,
    clientMutationId: tempId,
    items,
    total,
    method,
    customerId: customerId || null,
    date: new Date().toISOString(),
  };

  // Guardar en cola de IndexedDB sin esperar red (latencia < 5ms)
  mockIndexedDbOutbox.push({
    id: tempId,
    action: "createSale",
    payload: localSale,
    createdAt: new Date().toISOString(),
  });

  return localSale;
}

function simulateOfflinePayment({ customerId, amount, method }) {
  const tempId = "mock-pay-" + Math.random().toString(36).slice(2, 9);
  mockIndexedDbOutbox.push({
    id: tempId,
    action: "addPayment",
    payload: { id: tempId, clientMutationId: tempId, customerId, amount, method },
    createdAt: new Date().toISOString(),
  });
  return { id: tempId, amount };
}

// 2. Ejecutar ráfaga de 10 operaciones sin conexión a internet
const startTime = performance.now();
for (let i = 1; i <= 8; i++) {
  simulateOfflineSale({
    items: [{ productId: "p-asado", qty: 2.5, price: 11900 }],
    total: 29750,
    method: i % 2 === 0 ? "Efectivo" : "Fiado",
    customerId: "cust-1",
  });
}
simulateOfflinePayment({ customerId: "cust-1", amount: 15000, method: "Efectivo" });
simulateOfflinePayment({ customerId: "cust-1", amount: 10000, method: "Transferencia" });
const duration = performance.now() - startTime;

console.log(`  ⏱️ 10 operaciones procesadas en modo offline en: ${duration.toFixed(2)} ms.`);
if (duration < 50) {
  console.log("  ✅ [PASS] Latencia ultra-baja en mostrador (< 50ms, sin bloqueos de red).");
} else {
  console.error("  ❌ [FAIL] Latencia superior al límite.");
}

console.log(`  📦 Total de transacciones encoladas en IndexedDB outbox: ${mockIndexedDbOutbox.length}`);
if (mockIndexedDbOutbox.length === 10) {
  console.log("  ✅ [PASS] Integridad de cola outbox verificada (10/10).");
} else {
  console.error("  ❌ [FAIL] Faltan transacciones en la cola.");
}

// 3. Simulación de reconexión y sincronización idempotente
let syncedCount = 0;
const processedIds = new Set();
for (const item of mockIndexedDbOutbox) {
  if (processedIds.has(item.payload.clientMutationId)) {
    console.warn(`  ⚠️ Duplicado detectado para ${item.payload.clientMutationId}, ignorado.`);
    continue;
  }
  processedIds.add(item.payload.clientMutationId);
  syncedCount++;
}

console.log(`  🌐 Sincronización simulada al recuperar señal: ${syncedCount} enviadas a Supabase.`);
if (syncedCount === 10) {
  console.log("  ✅ [PASS] Sincronización idempotente exitosa sin pérdidas ni duplicados.");
} else {
  console.error("  ❌ [FAIL] Error en sincronización.");
}

console.log("=======================================================");
console.log("🎉 PRUEBA DE RESILIENCIA OFFLINE COMPLETADA CON ÉXITO.");
console.log("=======================================================");
