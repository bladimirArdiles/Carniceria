import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarBlank,
  ChartBar,
  CircleNotch,
  Coins,
  CreditCard,
  DownloadSimple,
  FileCsv,
  Funnel,
  Printer,
  Receipt,
  ShieldCheck,
  TrendDown,
  TrendUp,
  UploadSimple,
  Wallet,
  X,
} from "@phosphor-icons/react";
import { useStore } from "../lib/store.jsx";
import { buildSeries, summarize } from "../lib/stats.js";
import { ALL_PAYMENT_METHODS, dayKey, fmtDateTime, fmtDay, fmtMonth, money, num, qtyText } from "../lib/format.js";
import LineChart from "../components/ui/LineChart.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ConfirmButton from "../components/ui/ConfirmButton.jsx";
import Modal from "../components/ui/Modal.jsx";
import CashClosingModal from "../components/reports/CashClosingModal.jsx";
import ReceiptModal from "../components/pos/ReceiptModal.jsx";

const MONTHS = [
  { value: "all", label: "Todos los meses" },
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

function Metric({ label, value, hint }) {
  return (
    <div className="card">
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{label}</p>
      <p className="mt-1 font-mono text-3xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{hint}</p>}
    </div>
  );
}

export default function Reports() {
  const {
    sales,
    balances,
    customers,
    payments,
    cashMovements,
    products,
    supplierPayments,
    getAuditLogs,
    voidSale,
    saveCashClosing,
    loadSalesRange,
    exportAll,
    importAll,
    notify,
  } = useStore();

  const [reportTab, setReportTab] = useState("commercial"); // "commercial" | "financial"

  const now = new Date();
  const todayStr = dayKey(now);
  const currentYearStr = String(now.getFullYear());
  const currentMonthStr = String(now.getMonth() + 1);

  // Modo de fecha: "day" | "month" | "range" | "all"
  const [dateMode, setDateMode] = useState("day");
  const [filterYear, setFilterYear] = useState(currentYearStr);
  const [filterMonth, setFilterMonth] = useState(currentMonthStr);
  const [exactDate, setExactDate] = useState(todayStr);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return dayKey(d);
  });
  const [endDate, setEndDate] = useState(todayStr);

  // Filtro por método de pago: "all" | "Efectivo" | "Transferencia" | "Tarjeta" | "Fiado"
  const [filterMethod, setFilterMethod] = useState("all");

  const [range, setRange] = useState("day");
  const [metric, setMetric] = useState("money");
  const [visibleSalesCount, setVisibleSalesCount] = useState(10);
  const fileRef = useRef(null);

  // Modales: Cierre de Caja Z, Reimpresión y Bitácora de Auditoría
  const [showCashClosing, setShowCashClosing] = useState(false);
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  const availableYears = useMemo(() => {
    const years = new Set(sales.map((s) => new Date(s.date).getFullYear()));
    years.add(now.getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [sales, now]);

  // Carga bajo demanda de ventas históricas desde Supabase cuando se cambian los filtros
  useEffect(() => {
    if (typeof loadSalesRange !== "function") return;
    if (dateMode === "range" && startDate && endDate) {
      loadSalesRange({ startDate, endDate });
    } else if (dateMode === "day" && exactDate) {
      loadSalesRange({ startDate: exactDate, endDate: exactDate });
    } else if (dateMode === "month" && filterYear !== "all" && filterMonth !== "all") {
      const y = Number(filterYear);
      const m = Number(filterMonth);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      loadSalesRange({ startDate: start, endDate: end });
    }
  }, [dateMode, startDate, endDate, exactDate, filterYear, filterMonth, loadSalesRange]);

  // Filtrado integral por fecha y método de pago con cálculo estricto en hora local
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (!s || s.status === "voided") return false;

      // Filtro por método de pago
      if (filterMethod !== "all" && s.method !== filterMethod) return false;

      // Filtro por fecha usando fecha local estricta
      const saleDay = dayKey(s.date);
      if (dateMode === "day") {
        if (exactDate && saleDay !== exactDate) return false;
      } else if (dateMode === "range") {
        if (startDate && saleDay < startDate) return false;
        if (endDate && saleDay > endDate) return false;
      } else if (dateMode === "month") {
        const d = new Date(s.date);
        if (filterYear !== "all" && String(d.getFullYear()) !== filterYear) return false;
        if (filterMonth !== "all" && String(d.getMonth() + 1) !== filterMonth) return false;
      }
      return true;
    });
  }, [sales, filterMethod, dateMode, exactDate, startDate, endDate, filterYear, filterMonth]);

  // Pagos reales cobrados filtrados estrictamente por el mismo período
  const filteredPayments = useMemo(() => {
    return (payments || []).filter((p) => {
      if (!p) return false;
      const pDay = dayKey(p.date || p.created_at);
      if (dateMode === "day") {
        if (exactDate && pDay !== exactDate) return false;
      } else if (dateMode === "range") {
        if (startDate && pDay < startDate) return false;
        if (endDate && pDay > endDate) return false;
      } else if (dateMode === "month") {
        const d = new Date(p.date || p.created_at);
        if (filterYear !== "all" && String(d.getFullYear()) !== filterYear) return false;
        if (filterMonth !== "all" && String(d.getMonth() + 1) !== filterMonth) return false;
      }
      return true;
    });
  }, [payments, dateMode, exactDate, startDate, endDate, filterYear, filterMonth]);

  // Movimientos y egresos de caja filtrados estrictamente por el período
  const filteredCashMovements = useMemo(() => {
    return (cashMovements || []).filter((m) => {
      if (!m) return false;
      const mDay = dayKey(m.date || m.created_at);
      if (dateMode === "day") {
        if (exactDate && mDay !== exactDate) return false;
      } else if (dateMode === "range") {
        if (startDate && mDay < startDate) return false;
        if (endDate && mDay > endDate) return false;
      } else if (dateMode === "month") {
        const d = new Date(m.date || m.created_at);
        if (filterYear !== "all" && String(d.getFullYear()) !== filterYear) return false;
        if (filterMonth !== "all" && String(d.getMonth() + 1) !== filterMonth) return false;
      }
      return true;
    });
  }, [cashMovements, dateMode, exactDate, startDate, endDate, filterYear, filterMonth]);

  // Pagos a proveedores filtrados estrictamente por el período
  const filteredSupplierPayments = useMemo(() => {
    return (supplierPayments || []).filter((p) => {
      if (!p) return false;
      const pDay = dayKey(p.date || p.createdAt);
      if (dateMode === "day") {
        if (exactDate && pDay !== exactDate) return false;
      } else if (dateMode === "range") {
        if (startDate && pDay < startDate) return false;
        if (endDate && pDay > endDate) return false;
      } else if (dateMode === "month") {
        const d = new Date(p.date || p.createdAt);
        if (filterYear !== "all" && String(d.getFullYear()) !== filterYear) return false;
        if (filterMonth !== "all" && String(d.getMonth() + 1) !== filterMonth) return false;
      }
      return true;
    });
  }, [supplierPayments, dateMode, exactDate, startDate, endDate, filterYear, filterMonth]);

  // Etiqueta legible del período
  const periodLabel = useMemo(() => {
    if (dateMode === "day") {
      if (exactDate === todayStr) return "Hoy (" + fmtDay(exactDate) + ")";
      return fmtDay(exactDate);
    }
    if (dateMode === "range") {
      return `${fmtDay(startDate)} al ${fmtDay(endDate)}`;
    }
    if (dateMode === "month") {
      const mObj = MONTHS.find((m) => m.value === filterMonth);
      const mName = mObj ? mObj.label : "";
      if (filterYear !== "all" && filterMonth !== "all") {
        return `${mName} ${filterYear}`;
      }
      if (filterYear !== "all" && filterMonth === "all") {
        return `Año ${filterYear}`;
      }
      if (filterYear === "all" && filterMonth !== "all") {
        return `${mName} (histórico)`;
      }
      return "Todo el historial";
    }
    return "Todo el historial";
  }, [dateMode, exactDate, startDate, endDate, filterYear, filterMonth, todayStr]);

  const filterSummary = useMemo(() => {
    return filterMethod !== "all" ? `${periodLabel} • ${filterMethod}` : periodLabel;
  }, [periodLabel, filterMethod]);

  const s = useMemo(
    () =>
      summarize(sales, balances, filteredSales, {
        products,
        cashMovements: filteredCashMovements,
        supplierPayments: filteredSupplierPayments,
      }),
    [sales, balances, filteredSales, products, filteredCashMovements, filteredSupplierPayments]
  );

  const filterOptions = useMemo(() => ({
    mode: dateMode,
    year: filterYear,
    month: filterMonth,
    exactDate,
    startDate,
    endDate,
  }), [dateMode, filterYear, filterMonth, exactDate, startDate, endDate]);

  const series = useMemo(() => buildSeries(filteredSales, range, metric, filterOptions), [filteredSales, range, metric, filterOptions]);
  const sortedSales = useMemo(() => [...filteredSales].sort((a, b) => (a.date < b.date ? 1 : -1)), [filteredSales]);
  const visibleSales = useMemo(() => sortedSales.slice(0, visibleSalesCount), [sortedSales, visibleSalesCount]);

  const customerName = (id) => customers.find((c) => c.id === id)?.name;
  const topMax = s.top[0]?.revenue || 1;

  const rangeOptions = dateMode === "day"
    ? [{ value: "day", label: "Por hora" }]
    : dateMode === "month" && filterMonth === "all"
    ? [{ value: "month", label: "Por mes" }, { value: "week", label: "Por semana" }]
    : [{ value: "day", label: "Por día" }, { value: "week", label: "Por semana" }];

  const download = () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `respaldo-carniceria-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify("Respaldo descargado");
  };

  const upload = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try { importAll(String(r.result)); notify("Respaldo restaurado"); } catch (err) { notify(err.message || "No se pudo leer el archivo"); }
    };
    r.readAsText(file);
  };

  // Exportar ventas a planilla CSV / Excel con codificación UTF-8 BOM
  const exportSalesCSV = () => {
    if (!filteredSales.length) {
      notify("No hay ventas para exportar con los filtros actuales");
      return;
    }

    const headers = [
      "Fecha y Hora",
      "Nro Ticket / ID",
      "Cliente",
      "DNI Cliente",
      "Metodo de Pago",
      "Cortes / Detalle",
      "Kilos Totales",
      "Total Venta ($)",
    ];

    let grandTotalRevenue = 0;
    let grandTotalKilos = 0;

    const rows = filteredSales.map((s) => {
      const client = customers.find((c) => c.id === s.customerId);
      const itemsSummary = (s.items || [])
        .map((i) => `${i.name} (${num(i.qty)} ${i.unit})`)
        .join(" + ");
      const totalKilos = (s.items || [])
        .filter((i) => i.unit === "kg")
        .reduce((acc, i) => acc + Number(i.qty || 0), 0);

      grandTotalRevenue += Number(s.total || 0);
      grandTotalKilos += totalKilos;

      const ticketRef = s.ticketNumber ? `#${s.ticketNumber}` : (s.id ? s.id.slice(0, 8) : "-");

      return [
        `"${fmtDateTime(s.date)}"`,
        `"${ticketRef}"`,
        `"${client ? client.name.replace(/"/g, '""') : "Mostrador"}"`,
        `"${client?.dni || ""}"`,
        `"${s.method}"`,
        `"${itemsSummary.replace(/"/g, '""')}"`,
        `"${num(Math.round(totalKilos * 1000) / 1000)}"`,
        Math.round(s.total),
      ];
    });

    // Fila final de totales exactos
    rows.push([
      `"TOTALES (${periodLabel})"`,
      `"${filteredSales.length} ventas"`,
      `""`,
      `""`,
      `""`,
      `""`,
      `"${num(Math.round(grandTotalKilos * 1000) / 1000)}"`,
      Math.round(grandTotalRevenue),
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const safeDate = dateMode === "day" ? exactDate : periodLabel.replace(/[^\w\d-_]/g, "_");
    link.setAttribute("download", `ventas-carniceria-${safeDate}.csv`);
    link.click();
    URL.revokeObjectURL(url);
    notify("Planilla de ventas descargada en formato Excel");
  };

  const reprintSale = (sale) => {
    const customer = customers.find((c) => c.id === sale.customerId);
    setSelectedSaleForReceipt({
      ...sale,
      customer,
      tendered: sale.tendered || sale.total,
      change: sale.change || 0,
      newBalance: 0,
    });
  };

  const handleOpenAudit = async () => {
    setShowAuditModal(true);
    setIsLoadingAudit(true);
    try {
      const logs = await getAuditLogs(50);
      setAuditLogs(logs || []);
    } catch {
      setAuditLogs([]);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Botones de acción principales: Cierre de Caja Z, Exportar CSV y Auditoría */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setShowCashClosing(true)}
          className="btn-primary h-16 text-base font-bold shadow-md flex items-center justify-center gap-2"
        >
          <Receipt size={22} weight="bold" />
          <span>Cierre de Caja (Reporte Z)</span>
        </button>
        <button
          type="button"
          onClick={exportSalesCSV}
          disabled={!filteredSales.length}
          className="btn-ghost h-16 text-base font-bold flex items-center justify-center gap-2"
        >
          <FileCsv size={22} weight="bold" />
          <span>Exportar a Excel (CSV)</span>
        </button>
        <button
          type="button"
          onClick={handleOpenAudit}
          className="btn-ghost h-16 text-base font-bold flex items-center justify-center gap-2"
        >
          <ShieldCheck size={22} weight="bold" className="text-accent-600 dark:text-accent-400" />
          <span>Bitácora de Auditoría</span>
        </button>
      </div>

      {/* Panel de Filtros: Fecha y Método de Pago */}
      <section aria-label="Filtros de estadísticas" className="card space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-400/20 text-accent-700 dark:text-accent-400">
              <Funnel size={24} weight="bold" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Filtros de estadísticas</h2>
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                Mostrando: <span className="font-bold text-accent-700 dark:text-accent-400">{filterSummary}</span>
              </p>
            </div>
          </div>

          {(filterMethod !== "all" || dateMode !== "month" || filterYear !== currentYearStr || filterMonth !== currentMonthStr) && (
            <button
              type="button"
              onClick={() => {
                setDateMode("month");
                setFilterYear(currentYearStr);
                setFilterMonth(currentMonthStr);
                setFilterMethod("all");
                setExactDate(todayStr);
                setRange("day");
              }}
              className="inline-flex items-center gap-1.5 self-start text-xs font-bold text-accent-700 hover:underline dark:text-accent-400 sm:self-auto"
            >
              <X size={14} weight="bold" />
              Restablecer filtros
            </button>
          )}
        </div>

        {/* Accesos rápidos de período */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Accesos directos:</span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setDateMode("day");
                setExactDate(todayStr);
                setRange("day");
              }}
              className={"rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 " +
                (dateMode === "day" && exactDate === todayStr
                  ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-300")}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date(now);
                d.setDate(d.getDate() - 1);
                setDateMode("day");
                setExactDate(dayKey(d));
                setRange("day");
              }}
              className={"rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 " +
                (dateMode === "day" && exactDate !== todayStr
                  ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-300")}
            >
              Ayer
            </button>
            <button
              type="button"
              onClick={() => {
                setDateMode("month");
                setFilterYear(currentYearStr);
                setFilterMonth(currentMonthStr);
                setRange("day");
              }}
              className={"rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 " +
                (dateMode === "month" && filterYear === currentYearStr && filterMonth === currentMonthStr
                  ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-300")}
            >
              Este mes
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date(now);
                d.setDate(d.getDate() - 7);
                setDateMode("range");
                setStartDate(dayKey(d));
                setEndDate(todayStr);
                setRange("day");
              }}
              className={"rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 " +
                (dateMode === "range"
                  ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-300")}
            >
              Últimos 7 días
            </button>
            <button
              type="button"
              onClick={() => {
                setDateMode("all");
                setRange("month");
              }}
              className={"rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 " +
                (dateMode === "all"
                  ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                  : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-850 dark:text-zinc-300")}
            >
              Todo el historial
            </button>
          </div>
        </div>

        {/* Tipo de filtro de fecha */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Período:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "month", label: "Por Mes / Año" },
                { id: "day", label: "Día específico" },
                { id: "range", label: "Rango de fechas" },
                { id: "all", label: "Todo el historial" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setDateMode(m.id);
                    if (m.id === "day") setRange("day");
                  }}
                  className={"rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 " +
                    (dateMode === m.id
                      ? "bg-accent-500 text-zinc-950 shadow-sm"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700")}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controles específicos del período */}
          <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/60">
            {dateMode === "month" && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-36 flex-1 sm:flex-initial">
                  <label className="label mb-1 text-xs" htmlFor="filter-month">Mes</label>
                  <select
                    id="filter-month"
                    className="field h-11 py-1"
                    value={filterMonth}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFilterMonth(val);
                      if (val === "all" && range === "day") setRange("month");
                      if (val !== "all" && range === "month") setRange("day");
                    }}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div className="min-w-32 flex-1 sm:flex-initial">
                  <label className="label mb-1 text-xs" htmlFor="filter-year">Año</label>
                  <select
                    id="filter-year"
                    className="field h-11 py-1"
                    value={filterYear}
                    onChange={(e) => setFilterYear(e.target.value)}
                  >
                    <option value="all">Todos los años</option>
                    {availableYears.map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>

                {!(filterYear === currentYearStr && filterMonth === currentMonthStr) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterYear(currentYearStr);
                      setFilterMonth(currentMonthStr);
                      setRange("day");
                    }}
                    className="btn-ghost h-11 text-xs font-bold"
                  >
                    Mes actual
                  </button>
                )}
              </div>
            )}

            {dateMode === "day" && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-44 flex-1 sm:flex-initial">
                  <label className="label mb-1 text-xs" htmlFor="exact-date">Elegir fecha</label>
                  <input
                    id="exact-date"
                    type="date"
                    className="field h-11 py-1 font-mono text-sm"
                    value={exactDate}
                    onChange={(e) => setExactDate(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExactDate(todayStr)}
                    className={"btn-ghost h-11 text-xs font-bold " + (exactDate === todayStr ? "bg-accent-400/20 text-accent-700 dark:text-accent-400" : "")}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(now);
                      d.setDate(d.getDate() - 1);
                      setExactDate(dayKey(d));
                    }}
                    className="btn-ghost h-11 text-xs font-bold"
                  >
                    Ayer
                  </button>
                </div>
              </div>
            )}

            {dateMode === "range" && (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-36 flex-1 sm:flex-initial">
                  <label className="label mb-1 text-xs" htmlFor="start-date">Desde</label>
                  <input
                    id="start-date"
                    type="date"
                    className="field h-11 py-1 font-mono text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="min-w-36 flex-1 sm:flex-initial">
                  <label className="label mb-1 text-xs" htmlFor="end-date">Hasta</label>
                  <input
                    id="end-date"
                    type="date"
                    className="field h-11 py-1 font-mono text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(now);
                      d.setDate(d.getDate() - 7);
                      setStartDate(dayKey(d));
                      setEndDate(todayStr);
                    }}
                    className="btn-ghost h-11 text-xs font-bold"
                  >
                    Últimos 7 días
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(now);
                      d.setDate(d.getDate() - 30);
                      setStartDate(dayKey(d));
                      setEndDate(todayStr);
                    }}
                    className="btn-ghost h-11 text-xs font-bold"
                  >
                    Últimos 30 días
                  </button>
                </div>
              </div>
            )}

            {dateMode === "all" && (
              <p className="py-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                Analizando todas las ventas registradas históricamente.
              </p>
            )}
          </div>
        </div>

        {/* Filtro por Método de Pago */}
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Método de pago:</span>
          <div className="flex flex-wrap gap-1.5">
            {["all", ...ALL_PAYMENT_METHODS].map((met) => {
              const active = filterMethod === met;
              const label = met === "all" ? "Todos los métodos" : met;
              return (
                <button
                  key={met}
                  type="button"
                  onClick={() => setFilterMethod(met)}
                  className={"rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 " +
                    (active
                      ? "bg-accent-500 text-zinc-950 shadow-sm"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-500")}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Selector de Vista: Comercial vs Financiera / Margen del Dueño */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <div className="flex rounded-2xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          <button
            type="button"
            onClick={() => setReportTab("commercial")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition active:scale-95 ${
              reportTab === "commercial"
                ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            <ChartBar size={16} weight="bold" />
            Vista Comercial (Ventas)
          </button>
          <button
            type="button"
            onClick={() => setReportTab("financial")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition active:scale-95 ${
              reportTab === "financial"
                ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            <Coins size={16} weight="bold" />
            Gastos y Margen del Dueño
          </button>
        </div>

        {reportTab === "financial" && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 shadow-sm">
            <TrendUp size={16} weight="bold" />
            <span>Margen Neto: {s.netMarginPct}% sobre facturación</span>
          </div>
        )}
      </div>

      {/* Tarjetas de métricas del período */}
      {reportTab === "commercial" ? (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Metric label="Ventas de hoy" value={money(s.todayTotal)} hint={`${s.todayCount} ${s.todayCount === 1 ? "venta" : "ventas"}`} />
          <Metric
            label={`Ventas (${periodLabel})`}
            value={money(s.periodTotal)}
            hint={`${s.periodCount} ${s.periodCount === 1 ? "venta" : "ventas"}${filterMethod !== "all" ? ` por ${filterMethod}` : ""}`}
          />
          <Metric
            label={`Kilos vendidos (${periodLabel})`}
            value={`${num(s.periodKilos)} kg`}
            hint={s.periodAvg > 0 ? `Ticket prom. ${money(s.periodAvg)}` : undefined}
          />
          <Metric label="Fiado por cobrar" value={money(s.pending)} hint="Saldo total adeudado" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className="card">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Facturación bruta ({periodLabel})</p>
              <p className="mt-1 font-mono text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">
                {money(s.periodTotal)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">{s.periodCount} ventas registradas</p>
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Gastos totales carnicería</p>
              <p className="mt-1 font-mono text-2xl font-black tracking-tight text-red-600 dark:text-red-400">
                -{money(s.periodExpenses)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {Object.keys(s.expensesByCategory).length} rubros operativos
              </p>
            </div>

            <div className="card">
              <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Costo de mercadería (CMV)</p>
              <p className="mt-1 font-mono text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                -{money(s.periodCost)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Margen Bruto: {money(s.grossProfit)} ({s.grossMarginPct}%)
              </p>
            </div>

            <div className={`card ${
              s.netProfit >= 0
                ? "border-emerald-500/40 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-950/20"
                : "border-red-500/40 bg-red-50/40 dark:border-red-500/30 dark:bg-red-950/20"
            }`}>
              <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">🏆 Ganancia Neta Real (Dueño)</p>
              <p className={`mt-1 font-mono text-2xl font-black tracking-tight ${
                s.netProfit >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
              }`}>
                {money(s.netProfit)}
              </p>
              <p className="mt-1 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                Margen Neto: {s.netMarginPct}% en mano
              </p>
            </div>
          </div>

          {/* Desglose de Gastos Operativos y Fórmula de Rendimiento */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Panel de Desglose de Gastos */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
                <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Wallet size={16} weight="bold" className="text-red-500" />
                  Desglose de Gastos de la Carnicería ({periodLabel})
                </h3>
                <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                  Total: -{money(s.periodExpenses)}
                </span>
              </div>

              {Object.keys(s.expensesByCategory).length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-500">
                  No se registraron egresos de caja ni gastos en este período.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(s.expensesByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([cat, amount]) => {
                      const pct = s.periodExpenses > 0 ? Math.round((amount / s.periodExpenses) * 100) : 0;
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold">
                            <span className="text-zinc-700 dark:text-zinc-300">{cat}</span>
                            <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                              {money(amount)} <span className="font-normal text-zinc-400 text-[10px]">({pct}%)</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div
                              className="h-full bg-red-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Panel de Ecuación Financiera de Utilidad */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm space-y-3">
              <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5 border-b border-zinc-200 pb-2 dark:border-zinc-800">
                <Coins size={16} weight="bold" className="text-emerald-500" />
                Cálculo de Utilidad Neta Real del Dueño
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-850">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">(+) Facturación Bruta:</span>
                  <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">{money(s.periodTotal)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-850">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">(-) Costo Mercadería (CMV gancho):</span>
                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">-{money(s.periodCost)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 font-bold">
                  <span className="text-zinc-700 dark:text-zinc-300">(=) Utilidad Bruta Comercial:</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100">{money(s.grossProfit)}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 dark:bg-zinc-850">
                  <span className="font-semibold text-zinc-600 dark:text-zinc-400">(-) Gastos Operativos de Carnicería:</span>
                  <span className="font-mono font-bold text-red-600 dark:text-red-400">-{money(s.periodExpenses)}</span>
                </div>
                <div className={`flex items-center justify-between p-2.5 rounded-xl border font-bold text-sm ${
                  s.netProfit >= 0
                    ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
                    : "border-red-500/40 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200"
                }`}>
                  <span>(=) Ganancia Neta Real en Mano:</span>
                  <span className="font-mono text-base font-black">{money(s.netProfit)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfica y Productos / Medios de pago */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight">Evolución de ventas</h2>
            {filterMethod !== "all" && (
              <span className="rounded-md bg-accent-400/20 px-2 py-0.5 text-xs font-bold text-accent-700 dark:text-accent-400">
                Solo {filterMethod}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {dateMode !== "day" && <Segmented value={range} onChange={setRange} options={rangeOptions} />}
            <Segmented value={metric} onChange={setMetric} options={[{ value: "money", label: "Ingresos" }, { value: "kg", label: "Kilos" }]} />
          </div>

          <LineChart
            points={series}
            formatValue={(v) => (metric === "money" ? money(v) : `${num(v)} kg`)}
            formatTick={(v) => (metric === "money" && v >= 1000 ? `${num(v / 1000)}k` : num(v))}
            formatX={(d) => {
              if (dateMode === "day") return d;
              if (range === "month") return fmtMonth(d);
              if (range === "day") return fmtDay(d);
              return `Sem. ${fmtDay(d)}`;
            }}
          />
        </section>

        <div className="space-y-6">
          <section className="card space-y-3">
            <h2 className="text-lg font-bold tracking-tight">Productos más vendidos ({periodLabel})</h2>
            {s.top.length === 0 ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">Todavía no hay ventas en este período con los filtros aplicados.</p>
            ) : (
              <ol className="space-y-3">
                {s.top.map((t, i) => (
                  <li key={t.name}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-bold">{i + 1}. {t.name}</p>
                      <p className="shrink-0 font-mono text-sm font-bold">{money(t.revenue)}</p>
                    </div>
                    <div className="mt-1 flex items-center gap-3">
                      <span className="h-2 rounded-2xl bg-accent-500" style={{ width: `${Math.max(6, (t.revenue / topMax) * 70)}%` }} />
                      <span className="font-mono text-sm text-zinc-700 dark:text-zinc-300">{qtyText(t.qty, t.unit)}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="text-lg font-bold tracking-tight">Caja por forma de pago ({periodLabel})</h2>
            {Object.keys(s.byMethod).length === 0 ? (
              <p className="text-sm text-zinc-700 dark:text-zinc-300">Sin ventas en este período.</p>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {Object.entries(s.byMethod).map(([m, v]) => (
                  <li key={m} className={"flex justify-between py-2 " + (filterMethod === m ? "font-bold text-accent-700 dark:text-accent-400" : "")}>
                    <span className="font-semibold">{m === "Fiado" ? "Fiado (no cobrado)" : m}</span>
                    <span className="font-mono font-bold">{money(v)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Listado de ventas del período */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">
            Ventas ({filterSummary})
          </h2>
          {sortedSales.length > 0 && (
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {sortedSales.length} {sortedSales.length === 1 ? "venta registrada" : "ventas registradas"}
            </span>
          )}
        </div>

        {sortedSales.length === 0 ? (
          <EmptyState icon={ChartBar} title="Sin ventas con estos filtros" text="No se registraron ventas para la fecha y método de pago seleccionados." />
        ) : (
          <div className="space-y-3">
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {visibleSales.map((v) => (
                <li key={v.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{v.items.map((i) => `${i.name} ${qtyText(i.qty, i.unit)}`).join(", ")}</p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">
                      {fmtDateTime(v.date)} | <span className="font-semibold text-accent-700 dark:text-accent-400">{v.method}</span> | {customerName(v.customerId) || "Mostrador"}
                    </p>
                  </div>
                  <p className="font-mono text-lg font-bold">{money(v.total)}</p>
                  <button
                    type="button"
                    title="Ver ticket térmico y reimprimir"
                    onClick={() => reprintSale(v)}
                    className="btn-icon h-10 w-10 text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    <Printer size={18} weight="bold" />
                  </button>
                  <ConfirmButton label="Anular venta y devolver stock" onConfirm={() => { voidSale(v.id); notify("Venta anulada, stock devuelto"); }} />
                </li>
              ))}
            </ul>

            {sortedSales.length > visibleSales.length && (
              <button
                type="button"
                className="btn-ghost h-12 w-full text-sm font-bold"
                onClick={() => setVisibleSalesCount((prev) => prev + 15)}
              >
                Ver más ventas ({sortedSales.length - visibleSales.length} restantes)
              </button>
            )}
          </div>
        )}
      </section>

      {/* Copia de seguridad */}
      <section className="card space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Copia de seguridad</h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">Tus datos viven solo en este navegador. Descargá un respaldo seguido y guardalo en otro lugar.</p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Elegir archivo de respaldo" onChange={upload} />
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" className="btn-ghost" onClick={download}><DownloadSimple size={22} weight="bold" />Descargar respaldo</button>
          <button type="button" className="btn-ghost" onClick={() => fileRef.current.click()}><UploadSimple size={22} weight="bold" />Restaurar respaldo</button>
        </div>
      </section>

      {/* Modal de Cierre de Caja Z con cálculo estricto de egresos */}
      {showCashClosing && (
        <CashClosingModal
          sales={filteredSales}
          payments={filteredPayments}
          cashMovements={filteredCashMovements}
          dateLabel={periodLabel}
          onClose={() => setShowCashClosing(false)}
          onSaveClosing={saveCashClosing}
        />
      )}

      {/* Modal de Reimpresión de Comprobante / Ticket */}
      {selectedSaleForReceipt && (
        <ReceiptModal
          sale={selectedSaleForReceipt}
          onClose={() => setSelectedSaleForReceipt(null)}
        />
      )}

      {/* Modal de Bitácora de Auditoría Antifraude */}
      {showAuditModal && (
        <Modal
          title="Bitácora de Auditoría y Trazabilidad (Inmutable)"
          onClose={() => setShowAuditModal(false)}
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Registro inalterable de operaciones críticas: ventas, anulaciones, movimientos de stock, cobros y salidas de caja.
            </p>

            {isLoadingAudit ? (
              <div className="flex h-48 items-center justify-center">
                <CircleNotch size={28} weight="bold" className="animate-spin text-accent-600" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm font-semibold text-zinc-500 dark:border-zinc-800">
                No hay registros de auditoría aún o la base de datos está operando en modo local.
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
                {auditLogs.map((log) => {
                  const isVoid = log.action === "VOID_SALE";
                  const isSale = log.action === "CREATE_SALE";
                  const isCash = log.action === "CASH_EXPENSE" || log.action === "CASH_INFLOW";
                  const isPayment = log.action === "CUSTOMER_PAYMENT";
                  const isStock = log.action === "STOCK_MOVEMENT";

                  return (
                    <div key={log.id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                            isVoid
                              ? "bg-red-500/20 text-red-800 dark:text-red-300"
                              : isSale
                              ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                              : isCash
                              ? "bg-amber-500/20 text-amber-800 dark:text-amber-300"
                              : "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-500">
                          {fmtDateTime(log.created_at)}
                        </span>
                      </div>
                      <p className="font-mono text-zinc-700 dark:text-zinc-300 break-all">
                        {typeof log.details === "object" ? JSON.stringify(log.details) : log.details}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
