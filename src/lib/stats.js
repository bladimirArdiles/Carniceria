import { dayKey, monthKey, weekStartKey } from "./format.js";

const pad = (n) => String(n).padStart(2, "0");

export function summarize(sales, balances, filteredSales = null) {
  const targetSales = filteredSales ?? sales;
  const today = dayKey();
  const todays = sales.filter((s) => dayKey(s.date) === today);
  const sum = (l) => l.reduce((a, s) => a + s.total, 0);
  const kilos = (l) => l.reduce((a, s) => a + s.items.filter((i) => i.unit === "kg").reduce((b, i) => b + i.qty, 0), 0);

  // Cobrado en el período por método: el fiado no es dinero ingresado
  const byMethod = {};
  targetSales.forEach((s) => {
    byMethod[s.method] = (byMethod[s.method] || 0) + s.total;
  });

  const top = {};
  targetSales.forEach((s) =>
    s.items.forEach((i) => {
      const t = (top[i.productId] ||= { name: i.name, unit: i.unit, qty: 0, revenue: 0 });
      t.qty += i.qty;
      t.revenue += i.total;
    })
  );

  const periodTotal = sum(targetSales);
  const periodCount = targetSales.length;

  return {
    todayTotal: sum(todays),
    todayCount: todays.length,
    todayKilos: kilos(todays),
    periodTotal,
    periodCount,
    periodKilos: kilos(targetSales),
    periodAvg: periodCount > 0 ? Math.round(periodTotal / periodCount) : 0,
    monthTotal: periodTotal,
    monthCount: periodCount,
    pending: Object.values(balances).reduce((a, b) => a + Math.max(0, b), 0),
    byMethod,
    top: Object.values(top).sort((a, b) => b.revenue - a.revenue).slice(0, 6),
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
    const s = new Date(startDate + "T00:00:00");
    const e = new Date(endDate + "T00:00:00");
    const diffDays = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;

    if (diffDays <= 31) {
      let cur = new Date(s);
      while (cur <= e) {
        buckets.set(dayKey(cur), 0);
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      let cur = new Date(s);
      while (cur <= e) {
        buckets.set(weekStartKey(cur), 0);
        cur.setDate(cur.getDate() + 7);
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

    if (!buckets.has(key)) return;
    const v = metric === "money" ? s.total : s.items.filter((i) => i.unit === "kg").reduce((a, i) => a + i.qty, 0);
    buckets.set(key, buckets.get(key) + v);
  });

  return [...buckets].map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));
}
