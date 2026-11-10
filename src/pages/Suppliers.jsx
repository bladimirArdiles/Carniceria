import { useMemo, useState } from "react";
import {
  AddressBook,
  ArrowsClockwise,
  CreditCard,
  MagnifyingGlass,
  Money,
  PencilSimple,
  Phone,
  Plus,
  Receipt,
  Trash,
  Truck,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useStore } from "../lib/store.jsx";
import { fmtDateTime, money } from "../lib/format.js";
import EmptyState from "../components/ui/EmptyState.jsx";
import SupplierForm from "../components/suppliers/SupplierForm.jsx";
import SupplierPurchaseModal from "../components/suppliers/SupplierPurchaseModal.jsx";
import SupplierPaymentModal from "../components/suppliers/SupplierPaymentModal.jsx";

const CATEGORIES = ["Todas", "Frigorífico", "Hacienda", "Pollería", "Insumos", "Servicios"];

export default function Suppliers() {
  const {
    suppliers,
    supplierPurchases,
    supplierPayments,
    saveSupplier,
    deleteSupplier,
    addSupplierPurchase,
    addSupplierPayment,
  } = useStore();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [activeTab, setActiveTab] = useState("suppliers"); // "suppliers" | "history"

  // Modales
  const [editingSupplier, setEditingSupplier] = useState(null); // null | "new" | supplier
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSupplierForAction, setSelectedSupplierForAction] = useState(null);

  const [historyType, setHistoryType] = useState("all"); // "all" | "payments" | "purchases"
  const [historySupplierFilter, setHistorySupplierFilter] = useState("all");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLimit, setHistoryLimit] = useState(100);

  // Totales generales
  const totalDebt = useMemo(() => {
    return suppliers.reduce((acc, s) => acc + Number(s.balance || 0), 0);
  }, [suppliers]);

  const totalPurchased = useMemo(() => {
    return supplierPurchases.reduce((acc, p) => acc + Number(p.total || 0), 0);
  }, [supplierPurchases]);

  const totalPaid = useMemo(() => {
    return supplierPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  }, [supplierPayments]);

  // Filtrado de proveedores
  const filteredSuppliers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers
      .filter((s) => {
        if (q && !s.name.toLowerCase().includes(q) && !(s.cuitDni || "").includes(q)) return false;
        if (selectedCategory !== "Todas" && s.category !== selectedCategory) return false;
        return true;
      })
      .sort((a, b) => (b.balance || 0) - (a.balance || 0));
  }, [suppliers, query, selectedCategory]);

  // Filtrado de Pagos a Proveedores
  const filteredPayments = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return (supplierPayments || [])
      .filter((p) => {
        if (!p) return false;
        if (historySupplierFilter !== "all" && p.supplierId !== historySupplierFilter) return false;
        if (q) {
          const supp = suppliers.find((s) => s.id === p.supplierId);
          const suppName = (supp?.name || p.supplierName || "").toLowerCase();
          const notes = (p.notes || "").toLowerCase();
          const method = (p.method || "").toLowerCase();
          const amt = String(p.amount || "");
          if (!suppName.includes(q) && !notes.includes(q) && !method.includes(q) && !amt.includes(q)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
  }, [supplierPayments, historySupplierFilter, historyQuery, suppliers]);

  // Filtrado de Compras / Facturas
  const filteredPurchases = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    return (supplierPurchases || [])
      .filter((p) => {
        if (!p) return false;
        if (historySupplierFilter !== "all" && p.supplierId !== historySupplierFilter) return false;
        if (q) {
          const supp = suppliers.find((s) => s.id === p.supplierId);
          const suppName = (supp?.name || p.supplierName || "").toLowerCase();
          const inv = (p.invoiceNumber || "").toLowerCase();
          const notes = (p.notes || "").toLowerCase();
          if (!suppName.includes(q) && !inv.includes(q) && !notes.includes(q)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0));
  }, [supplierPurchases, historySupplierFilter, historyQuery, suppliers]);

  return (
    <div className="space-y-6">
      {/* KPIs de Cuentas por Pagar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Deuda total a proveedores</p>
          <p className="font-mono text-2xl font-black tracking-tight mt-1 text-red-600 dark:text-red-400">
            {money(totalDebt)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Compras acumuladas</p>
          <p className="font-mono text-2xl font-black tracking-tight mt-1 text-zinc-950 dark:text-zinc-50">
            {money(totalPurchased)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Pagos realizados</p>
          <p className="font-mono text-2xl font-black tracking-tight mt-1 text-emerald-600 dark:text-emerald-400">
            {money(totalPaid)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Proveedores en cartera</p>
          <p className="font-mono text-2xl font-black tracking-tight mt-1 text-zinc-950 dark:text-zinc-50">
            {suppliers.length} <span className="text-xs font-normal text-zinc-500">cuentas</span>
          </p>
        </div>
      </div>

      {/* Botones de acción principales */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          className="btn-primary h-16 text-base font-bold shadow-md"
          onClick={() => {
            setSelectedSupplierForAction(null);
            setPurchaseModalOpen(true);
          }}
          disabled={!suppliers.length}
        >
          <Receipt size={22} weight="bold" />
          Registrar compra / factura
        </button>
        <button
          type="button"
          className="flex h-16 items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/60 px-3 text-base font-bold text-emerald-900 transition hover:bg-emerald-100/70 active:scale-95 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200 shadow-sm"
          onClick={() => {
            setSelectedSupplierForAction(null);
            setPaymentModalOpen(true);
          }}
          disabled={!suppliers.length}
        >
          <CreditCard size={22} weight="bold" className="text-emerald-600 dark:text-emerald-400" />
          Pagar a proveedor
        </button>
        <button
          type="button"
          className="btn-ghost h-16 text-base font-bold"
          onClick={() => setEditingSupplier("new")}
        >
          <Plus size={22} weight="bold" />
          Nuevo proveedor
        </button>
      </div>

      {/* Selector de Pestaña: Proveedores vs Historial */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setActiveTab("suppliers")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition ${
            activeTab === "suppliers"
              ? "border-accent-500 text-accent-700 dark:text-accent-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Proveedores y Cuentas por Pagar ({suppliers.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`pb-3 px-4 text-sm font-bold border-b-2 transition ${
            activeTab === "history"
              ? "border-accent-500 text-accent-700 dark:text-accent-400"
              : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          }`}
        >
          Historial de Facturas y Pagos ({supplierPurchases.length + supplierPayments.length})
        </button>
      </div>

      {activeTab === "suppliers" && (
        <div className="space-y-4">
          {/* Buscador de proveedor */}
          <div className="relative">
            <MagnifyingGlass
              size={22}
              weight="bold"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              className="field pl-12 pr-10"
              type="search"
              placeholder="Buscar proveedor por nombre o CUIT..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X size={16} weight="bold" />
              </button>
            )}
          </div>

          {/* Categorías */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-bold transition active:scale-95 ${
                    active
                      ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                      : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Listado de proveedores */}
          {!suppliers.length ? (
            <EmptyState
              icon={Truck}
              title="Sin proveedores registrados"
              text="Agregá frigoríficos o distribuidores para llevar el control de tus compras y cuentas por pagar."
            />
          ) : filteredSuppliers.length === 0 ? (
            <p className="card text-center font-semibold text-zinc-500">
              No hay proveedores que coincidan con la búsqueda.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
              {filteredSuppliers.map((supp) => {
                const bal = Number(supp.balance || 0);
                return (
                  <li
                    key={supp.id}
                    className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50 transition"
                  >
                    <div className="min-w-0 flex-1 basis-56">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                          {supp.name}
                        </p>
                        <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {supp.category}
                        </span>
                        {supp.cuitDni && (
                          <span className="font-mono text-xs text-zinc-400">
                            CUIT: {supp.cuitDni}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                        {supp.phone && (
                          <a
                            href={`tel:${supp.phone}`}
                            className="flex items-center gap-1 font-mono hover:text-accent-600 transition"
                          >
                            <Phone size={14} />
                            {supp.phone}
                          </a>
                        )}
                        {supp.notes && <span>• {supp.notes}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                          Deuda pendiente
                        </p>
                        <p
                          className={`font-mono text-2xl font-black tracking-tight ${
                            bal > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {money(bal)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="Registrar compra a este proveedor"
                          onClick={() => {
                            setSelectedSupplierForAction(supp.id);
                            setPurchaseModalOpen(true);
                          }}
                          className="flex h-11 items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-100 px-3 text-xs font-bold text-zinc-800 transition hover:bg-zinc-200 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                        >
                          <Receipt size={16} weight="bold" />
                          <span className="hidden sm:inline">Comprar</span>
                        </button>

                        <button
                          type="button"
                          title="Registrar pago a este proveedor"
                          onClick={() => {
                            setSelectedSupplierForAction(supp.id);
                            setPaymentModalOpen(true);
                          }}
                          className="flex h-11 items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-95 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                        >
                          <CreditCard size={16} weight="bold" />
                          <span className="hidden sm:inline">Pagar</span>
                        </button>

                        <button
                          type="button"
                          title="Editar datos del proveedor"
                          onClick={() => setEditingSupplier(supp)}
                          className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          <PencilSimple size={18} weight="bold" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Historial de Compras y Pagos */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* Barra de Filtros y Búsqueda en Historial */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Selector de Tipo: Todos / Solo Pagos / Solo Compras */}
            <div className="flex gap-1.5 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setHistoryType("all")}
                className={`rounded-xl px-3 py-1.5 transition ${
                  historyType === "all"
                    ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-zinc-50 font-extrabold"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                Todos ({supplierPayments.length + supplierPurchases.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryType("payments")}
                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 transition ${
                  historyType === "payments"
                    ? "bg-emerald-600 text-white shadow-sm font-extrabold"
                    : "text-zinc-600 hover:text-emerald-700 dark:text-zinc-400 dark:hover:text-emerald-400"
                }`}
              >
                <CreditCard size={14} weight="bold" />
                Pagos Realizados ({supplierPayments.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryType("purchases")}
                className={`flex items-center gap-1 rounded-xl px-3 py-1.5 transition ${
                  historyType === "purchases"
                    ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                <Receipt size={14} weight="bold" />
                Compras ({supplierPurchases.length})
              </button>
            </div>

            {/* Filtro por Proveedor específico */}
            <div className="flex items-center gap-2">
              <select
                className="field text-xs font-bold py-1.5 max-w-xs"
                value={historySupplierFilter}
                onChange={(e) => setHistorySupplierFilter(e.target.value)}
              >
                <option value="all">Todos los proveedores</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Buscador de texto en Historial */}
          <div className="relative">
            <MagnifyingGlass
              size={18}
              weight="bold"
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
            />
            <input
              className="field pl-10 pr-9 text-xs"
              type="search"
              placeholder="Buscar en historial por proveedor, n° de factura, recibo o notas..."
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
            />
            {historyQuery && (
              <button
                type="button"
                onClick={() => setHistoryQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-700"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>

          {/* 1. SECCIÓN: HISTORIAL DE PAGOS A PROVEEDORES */}
          {(historyType === "all" || historyType === "payments") && (
            <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-emerald-50/30 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
                    <CreditCard size={16} weight="bold" />
                  </div>
                  <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50">
                    Historial de Pagos Realizados a Proveedores
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
                    {filteredPayments.length} pagos
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Total: {money(filteredPayments.reduce((s, p) => s + Number(p.amount || 0), 0))}
                  </span>
                </div>
              </div>

              {filteredPayments.length === 0 ? (
                <div className="p-8 text-center">
                  <CreditCard size={36} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                  <p className="text-sm font-semibold text-zinc-500">
                    No hay pagos a proveedores registrados{historyQuery || historySupplierFilter !== "all" ? " con los filtros aplicados" : " todavía"}.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                  {filteredPayments.slice(0, historyLimit).map((p) => {
                    const supp = suppliers.find((s) => s.id === p.supplierId);
                    const purchase = p.purchaseId ? supplierPurchases.find((pur) => pur.id === p.purchaseId) : null;
                    return (
                      <li
                        key={p.id}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-zinc-50/60 dark:hover:bg-zinc-850/60 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-zinc-950 dark:text-zinc-50">
                              {supp?.name || p.supplierName || "Proveedor"}
                            </span>
                            {supp?.category && (
                              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                {supp.category}
                              </span>
                            )}
                            <span className="rounded-md bg-emerald-100/80 px-2 py-0.5 text-[11px] font-bold text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300">
                              {p.method || "Efectivo"}
                            </span>
                            {purchase?.invoiceNumber && (
                              <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded dark:bg-zinc-800">
                                Factura: {purchase.invoiceNumber}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                            <span>{fmtDateTime(p.date || p.createdAt)}</span>
                            {p.notes && (
                              <span className="text-zinc-700 dark:text-zinc-300 italic">
                                • {p.notes}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-mono text-base font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                            -{money(p.amount)}
                          </p>
                          <span className="text-[10px] uppercase font-bold text-emerald-700/70 dark:text-emerald-400/70">
                            Cancelación de deuda
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {filteredPayments.length > historyLimit && (
                <div className="p-3 text-center border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850">
                  <button
                    type="button"
                    onClick={() => setHistoryLimit((l) => l + 100)}
                    className="text-xs font-bold text-accent-600 hover:underline"
                  >
                    Mostrar más pagos ({filteredPayments.length - historyLimit} restantes)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 2. SECCIÓN: HISTORIAL DE COMPRAS / FACTURAS */}
          {(historyType === "all" || historyType === "purchases") && (
            <div className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-zinc-50/50 dark:bg-zinc-850/50">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs">
                    <Receipt size={16} weight="bold" />
                  </div>
                  <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50">
                    Historial de Compras y Facturas Recibidas
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-500">
                    {filteredPurchases.length} registradas
                  </span>
                  <span className="font-mono text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Total: {money(filteredPurchases.reduce((s, p) => s + Number(p.total || 0), 0))}
                  </span>
                </div>
              </div>

              {filteredPurchases.length === 0 ? (
                <div className="p-8 text-center">
                  <Receipt size={36} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                  <p className="text-sm font-semibold text-zinc-500">
                    No hay compras registradas{historyQuery || historySupplierFilter !== "all" ? " con los filtros aplicados" : " todavía"}.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                  {filteredPurchases.slice(0, historyLimit).map((p) => {
                    const supp = suppliers.find((s) => s.id === p.supplierId);
                    return (
                      <li
                        key={p.id}
                        className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                              {supp?.name || p.supplierName || "Proveedor"}
                            </span>
                            {p.invoiceNumber && (
                              <span className="font-mono text-xs rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800 font-semibold">
                                {p.invoiceNumber}
                              </span>
                            )}
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                p.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : p.status === "partial"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                              }`}
                            >
                              {p.status === "paid" ? "Pagado" : p.status === "partial" ? "Pago Parcial" : "Pendiente"}
                            </span>
                          </div>
                          <p className="text-zinc-400 mt-0.5">
                            {fmtDateTime(p.date || p.createdAt)} {p.notes ? `• ${p.notes}` : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-base font-bold text-zinc-950 dark:text-zinc-50">
                            {money(p.total)}
                          </p>
                          {p.paidAmount < p.total && (
                            <p className="font-mono text-[11px] text-amber-600 dark:text-amber-400">
                              Resta: {money(p.total - p.paidAmount)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {filteredPurchases.length > historyLimit && (
                <div className="p-3 text-center border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850">
                  <button
                    type="button"
                    onClick={() => setHistoryLimit((l) => l + 100)}
                    className="text-xs font-bold text-accent-600 hover:underline"
                  >
                    Mostrar más compras ({filteredPurchases.length - historyLimit} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      {editingSupplier && (
        <SupplierForm
          supplier={editingSupplier === "new" ? null : editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSave={async (s) => {
            await saveSupplier(s);
            setEditingSupplier(null);
          }}
          onDelete={async (id) => {
            await deleteSupplier(id);
            setEditingSupplier(null);
          }}
        />
      )}

      {purchaseModalOpen && (
        <SupplierPurchaseModal
          suppliers={suppliers}
          preselectedSupplierId={selectedSupplierForAction}
          onSave={addSupplierPurchase}
          onClose={() => {
            setPurchaseModalOpen(false);
            setSelectedSupplierForAction(null);
          }}
        />
      )}

      {paymentModalOpen && (
        <SupplierPaymentModal
          suppliers={suppliers}
          preselectedSupplierId={selectedSupplierForAction}
          onSave={addSupplierPayment}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedSupplierForAction(null);
          }}
        />
      )}
    </div>
  );
}
