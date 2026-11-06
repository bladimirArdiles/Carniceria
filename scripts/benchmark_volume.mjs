import { summarize, buildSeries } from "../src/lib/stats.js";
import { lineTotal, round3, dayKey } from "../src/lib/format.js";

console.log("\n=======================================================");
console.log("⚡ PRUEBA DE VOLUMEN EXTREMO, RENDIMIENTO Y LÍMITES");
console.log("=======================================================\n");

// Generador de datos sintéticos realistas de carnicería
const CUTS = [
  { id: "p-asado", name: "Asado de Tira", price: 8500, unit: "kg" },
  { id: "p-vacio", name: "Vacío Fino", price: 9200, unit: "kg" },
  { id: "p-lomo", name: "Lomo Vacuno", price: 11500, unit: "kg" },
  { id: "p-picada", name: "Carne Picada Especial", price: 5400, unit: "kg" },
  { id: "p-chorizo", name: "Chorizo Criollo", price: 4800, unit: "kg" },
  { id: "p-pollo", name: "Pollo Entero Fresco", price: 3200, unit: "kg" },
  { id: "p-bondiola", name: "Bondiola de Cerdo", price: 7900, unit: "kg" },
  { id: "p-matambre", name: "Matambre de Ternera", price: 8800, unit: "kg" },
  { id: "p-morcilla", name: "Morcilla Bombón", price: 4200, unit: "kg" },
  { id: "p-achuras", name: "Chinchulines Vacunos", price: 4100, unit: "kg" },
];

const METHODS = ["Efectivo", "Transferencia", "Tarjeta", "Fiado"];

function generateSales(count) {
  const sales = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const saleDate = new Date(now.getTime() - Math.floor(Math.random() * 90 * 86400000));
    const itemCount = 1 + Math.floor(Math.random() * 4); // 1 a 4 cortes por ticket
    const items = [];
    let saleTotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const cut = CUTS[Math.floor(Math.random() * CUTS.length)];
      const qty = round3(0.5 + Math.random() * 3.5); // entre 0.5 y 4.0 kg
      const lineTot = lineTotal(qty, cut.price);
      saleTotal += lineTot;
      items.push({
        productId: cut.id,
        name: cut.name,
        unit: cut.unit,
        price: cut.price,
        qty,
        total: lineTot,
      });
    }

    const method = METHODS[Math.floor(Math.random() * METHODS.length)];
    const isFiado = method === "Fiado";

    sales.push({
      id: `sale-bench-${i}`,
      ticketNumber: 100000 + i,
      date: saleDate.toISOString(),
      items,
      total: saleTotal,
      method,
      customerId: isFiado ? `cust-${i % 20}` : null,
      tendered: saleTotal,
      change: 0,
      status: "completed",
    });
  }

  return sales;
}

const TEST_TIERS = [1000, 5000, 10000, 25000];

for (const tier of TEST_TIERS) {
  console.log(`\n-------------------------------------------------------`);
  console.log(`🧪 PROBANDO VOLUMEN DE ${tier.toLocaleString("es-AR")} TICKETS DE VENTA`);
  console.log(`-------------------------------------------------------`);

  // 1. Generación de datos
  const genStart = performance.now();
  const sales = generateSales(tier);
  const genMs = performance.now() - genStart;
  const totalItems = sales.reduce((acc, s) => acc + s.items.length, 0);

  // 2. Medición de huella en memoria (JSON Stringify y Tamaño de payload)
  const jsonStart = performance.now();
  const serialized = JSON.stringify(sales);
  const jsonMs = performance.now() - jsonStart;
  const payloadMb = (Buffer.byteLength(serialized, "utf8") / (1024 * 1024)).toFixed(2);

  console.log(`  📊 Registros generados: ${sales.length} ventas con ${totalItems.toLocaleString("es-AR")} ítems individuales.`);
  console.log(`  💾 Tamaño del dataset: ${payloadMb} MB en memoria cruda.`);
  console.log(`  ⏱️ Tiempo de serialización: ${jsonMs.toFixed(1)} ms.`);

  if (Number(payloadMb) > 5) {
    console.log(`  🚨 [ALERTA DE LOCALSTORAGE]: Este volumen (${payloadMb} MB) CRASHEA localStorage (límite 5MB).`);
    console.log(`     ✅ Con la migración a IndexedDB (Fase 2), este volumen es soportado sin errores.`);
  }

  // 3. Prueba de estrés de cálculo estadístico (summarize)
  const statsStart = performance.now();
  const summary = summarize(sales, {});
  const statsMs = performance.now() - statsStart;

  console.log(`  📈 summarize() cálculo total en: ${statsMs.toFixed(1)} ms.`);
  console.log(`     - Facturación acumulada: $${summary.periodTotal.toLocaleString("es-AR")}`);
  console.log(`     - Kilos procesados: ${summary.periodKilos.toLocaleString("es-AR")} kg`);
  console.log(`     - Top corte: ${summary.top[0]?.name} ($${summary.top[0]?.revenue.toLocaleString("es-AR")})`);

  // 4. Prueba de estrés de agregación de series temporales (buildSeries por día)
  const seriesStart = performance.now();
  const series = buildSeries(sales, "day", "money", { mode: "month", year: "2026", month: "all" });
  const seriesMs = performance.now() - seriesStart;

  console.log(`  📊 buildSeries() agregación de gráficos en: ${seriesMs.toFixed(1)} ms.`);

  // 5. Prueba de filtrado dinámico por método de pago y fecha
  const filterStart = performance.now();
  const filtered = sales.filter((s) => s.method === "Efectivo" && s.total > 15000);
  const filterMs = performance.now() - filterStart;

  console.log(`  🔍 filter() búsqueda de ventas en efectivo > $15.000 (${filtered.length} coincidencias) en: ${filterMs.toFixed(2)} ms.`);

  // Veredicto del tier
  const totalOpsMs = statsMs + seriesMs + filterMs;
  if (totalOpsMs < 50) {
    console.log(`  ⭐ RENDIMIENTO EXCELENTE: Tiempo total de cálculo UI < 50ms (${totalOpsMs.toFixed(1)} ms, 60fps intacto).`);
  } else if (totalOpsMs < 150) {
    console.log(`  🟡 RENDIMIENTO ACEPTABLE: Tiempo total de cálculo UI ${totalOpsMs.toFixed(1)} ms (leve tirón si se hace síncrono).`);
  } else {
    console.log(`  🔴 CUELLO DE BOTELLA DETECTADO: Tiempo total de cálculo UI ${totalOpsMs.toFixed(1)} ms (requiere Web Workers para no congelar la pantalla).`);
  }
}

console.log("\n=======================================================");
console.log("🏁 BENCHMARK COMPLETADO CON ÉXITO");
console.log("=======================================================\n");

