import { dayKey, monthKey, weekStartKey } from "./format.js";

const pad = (n) => String(n).padStart(2, "0");

export function summarize(sales, balances, filteredSales = null, extra = {}) {
  const targetSales = (filteredSales ?? sales).filter((s) => s && s.status !== "voided");
  const today = dayKey();
  const todays = sales.filter((s) => s && s.status !== "voided" && dayKey(s.date) === today);
  const sum = (l) => l.reduce((a, s) => a + Number(s.total || 0), 0);
  const kilos = (l) =>
    l.reduce(
      (a, s) =>
        a +
        (s.items || [])
          .filter((i) => i.unit === "kg")
          .reduce((b, i) => b + Number(i.qty || 0), 0),
      0
    );

  // Cobrado en el período por método: el fiado no es dinero ingresado
  const byMethod = {};
  targetSales.forEach((s) => {
    byMethod[s.method] = (byMethod[s.method] || 0) + Number(s.total || 0);
  });

  const top = {};
  targetSales.forEach((s) =>
    (s.items || []).forEach((i) => {
      const cleanName = (i.name || "Corte").trim();
      const key = cleanName.toLowerCase();
      const t = (top[key] ||= { name: cleanName, unit: i.unit || "kg", qty: 0, revenue: 0 });
      t.qty = Math.round((t.qty + Number(i.qty || 0)) * 1000) / 1000;
      t.revenue += Number(i.total || 0);
    })
  );

  const periodTotal = sum(targetSales);
  const periodCount = targetSales.length;

  // Cálculo de Costo de Mercadería Vendida (CMV) y Márgenes
  const prodCostMap = new Map((extra?.products || []).map((p) => [p.id, Number(p.cost || 0)]));
  let periodCost = 0;
  targetSales.forEach((s) => {
    (s.items || []).forEach((i) => {
      const unitCost = i.cost ? Number(i.cost) : prodCostMap.get(i.productId) || 0;
      periodCost += (Number(i.qty) || 0) * unitCost;
    });
  });

  // Gastos operativos y retiros de caja del período
  const expensesByCategory = {};
  let periodExpenses = 0;
  (extra?.cashMovements || []).forEach((m) => {
    if (m && m.type === "egreso") {
      const cat = (m.category || "Varios").trim();
      const amt = Number(m.amount || 0);
      expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
      periodExpenses += amt;
    }
  });

  // Pagos a proveedores en el período
  const periodSupplierPayments = (extra?.supplierPayments || []).reduce(
    (a, p) => a + Number(p.amount || 0),
    0
  );

  // Utilidad comercial y Ganancia Neta Real del Dueño
  const grossProfit = Math.max(0, periodTotal - periodCost);
  const netProfit = (periodCost > 0 ? (periodTotal - periodCost) : periodTotal) - periodExpenses;
  const grossMarginPct = periodTotal > 0 ? Math.round((grossProfit / periodTotal) * 100) : 0;
  const netMarginPct = periodTotal > 0 ? Math.round((netProfit / periodTotal) * 100) : 0;

  return {
    todayTotal: sum(todays),
    todayCount: todays.length,
    todayKilos: Math.round(kilos(todays) * 1000) / 1000,
    periodTotal,
    periodCount,
    periodKilos: Math.round(kilos(targetSales) * 1000) / 1000,
    periodAvg: periodCount > 0 ? Math.round(periodTotal / periodCount) : 0,
    monthTotal: periodTotal,
    monthCount: periodCount,
    pending: Object.values(balances || {}).reduce((a, b) => a + Math.max(0, Number(b || 0)), 0),
    byMethod,
    top: Object.values(top).sort((a, b) => b.revenue - a.revenue).slice(0, 6),
    // Métricas Financieras y Ganancia del Dueño
    periodCost: Math.round(periodCost),
    periodExpenses: Math.round(periodExpenses),
    periodSupplierPayments: Math.round(periodSupplierPayments),
    grossProfit: Math.round(grossProfit),
    netProfit: Math.round(netProfit),
    grossMarginPct,
    netMarginPct,
    expensesByCategory,
  };
}

/* Serie por hora, día, semana o mes, según filtros de fecha, en ingresos o kilos */
export function buildSeries(sales, range, metric, filterOptions = "all", legacyMonth = "all") {
  const buckets = new Map();
  const now = new Date();

  // Si filterOptions es un objeto
  const isObj = typeof filterOptions === "object" && filterOptions !== null;
  const mode = isObj ? filterOptions.mode : "month";
  const filterYear = isObj ? (filterOptions.year ?? "all") : filterOptions;
  const filterMonth = isObj ? (filterOptions.month ?? "all") : legacyMonth;
  const exactDate = isObj ? filterOptions.exactDate : null;
  const startDate = isObj ? filterOptions.startDate : null;
  const endDate = isObj ? filterOptions.endDate : null;

  if (mode === "day" && exactDate) {
    // Horas del día de 08:00 a 21:00
    for (let h = 8; h <= 21; h++) {
      buckets.set(`${pad(h)}:00`, 0);
    }
  } else if (mode === "range" && startDate && endDate) {
    const s = new Date(startDate.includes("T") ? startDate : `${startDate}T00:00:00`);
    const e = new Date(endDate.includes("T") ? endDate : `${endDate}T23:59:59`);
    if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
      const effectiveEnd = s > e ? s : e;
      const effectiveStart = s > e ? e : s;
      const diffDays = Math.round((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays <= 31) {
        let cur = new Date(effectiveStart);
        while (cur <= effectiveEnd) {
          buckets.set(dayKey(cur), 0);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        let cur = new Date(effectiveStart);
        while (cur <= effectiveEnd) {
          buckets.set(weekStartKey(cur), 0);
          cur.setDate(cur.getDate() + 7);
        }
      }
    }
  } else if (filterYear !== "all" && filterMonth !== "all") {
    const y = Number(filterYear);
    const m = Number(filterMonth);
    const daysInMonth = new Date(y, m, 0).getDate();

    if (range === "day") {
      for (let d = 1; d <= daysInMonth; d++) {
        buckets.set(`${y}-${pad(m)}-${pad(d)}`, 0);
      }
    } else {
      for (let d = 1; d <= daysInMonth; d++) {
        buckets.set(weekStartKey(new Date(y, m - 1, d)), 0);
      }
    }
  } else if (filterYear !== "all" && filterMonth === "all") {
    const y = Number(filterYear);
    if (range === "month") {
      for (let m = 1; m <= 12; m++) {
        buckets.set(`${y}-${pad(m)}`, 0);
      }
    } else if (range === "week") {
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      let cur = new Date(start);
      while (cur <= end) {
        buckets.set(weekStartKey(cur), 0);
        cur.setDate(cur.getDate() + 7);
      }
    } else {
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      let cur = new Date(start);
      while (cur <= end) {
        buckets.set(dayKey(cur), 0);
        cur.setDate(cur.getDate() + 1);
      }
    }
  } else if (filterYear === "all" && filterMonth !== "all") {
    const m = Number(filterMonth);
    const years = Array.from(new Set(sales.map((s) => new Date(s.date).getFullYear())));
    if (!years.length) years.push(now.getFullYear());
    years.sort((a, b) => a - b);
    for (const y of years) {
      buckets.set(`${y}-${pad(m)}`, 0);
    }
  } else {
    // Both "all"
    if (range === "month") {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.set(monthKey(d), 0);
      }
    } else if (range === "day") {
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        buckets.set(dayKey(d), 0);
      }
    } else {
      for (let i = 7; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i * 7);
        buckets.set(weekStartKey(d), 0);
      }
    }
  }

  if (buckets.size === 0) {
    buckets.set(dayKey(now), 0);
  }

  sales.forEach((s) => {
    if (!s || s.status === "voided") return;
    let key;
    if (mode === "day" && exactDate) {
      key = `${pad(new Date(s.date).getHours())}:00`;
    } else if (range === "day" || (mode === "range" && buckets.has(dayKey(s.date)))) {
      key = dayKey(s.date);
    } else if (range === "month") {
      key = monthKey(s.date);
    } else {
      key = weekStartKey(s.date);
    }

    if (!buckets.has(key)) {
      if (mode === "day" && exactDate) {
        buckets.set(key, 0);
      } else {
        return;
      }
    }
    const v = metric === "money" ? Number(s.total || 0) : (s.items || []).filter((i) => i.unit === "kg").reduce((a, i) => a + Number(i.qty || 0), 0);
    buckets.set(key, (buckets.get(key) || 0) + v);
  });

  const entries = [...buckets];
  if (mode === "day" && exactDate) {
    entries.sort((a, b) => a[0].localeCompare(b[0]));
  }

  return entries.map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));
}
