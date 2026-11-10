import { useMemo, useState } from "react";
import {
  ArrowsClockwise,
  Check,
  Percent,
  CurrencyDollar,
  TrendUp,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { getProductCategory, money } from "../../lib/format.js";

const QUICK_PERCENTAGES = [5, 8, 10, 15, 20, -5];
const QUICK_FIXED = [500, 1000, 1500, 2000, -500];

export default function BulkPriceModal({ products, categories, onConfirm, onClose }) {
  const [categoryName, setCategoryName] = useState("Todas");
  const [type, setType] = useState("percentage"); // "percentage" | "fixed"
  const [value, setValue] = useState("10");
  const [roundTo, setRoundTo] = useState(10); // 1, 10, 50, 100
  const [targetField, setTargetField] = useState("price"); // "price" | "cost" | "both"
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const numVal = parseFloat(String(value).replace(",", ".")) || 0;

  // Filtrar productos afectados
  const affectedProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryName === "Todas") return true;
      const cat = getProductCategory(p);
      return cat.toLowerCase() === categoryName.toLowerCase();
    });
  }, [products, categoryName]);

  // Función de cálculo para simulación
  const simulateNewValue = (currentVal) => {
    const factor = roundTo > 1 ? roundTo : 1;
    let res = type === "percentage" ? currentVal * (1 + numVal / 100) : currentVal + numVal;
    res = Math.round(res / factor) * factor;
    return Math.max(res, targetField === "cost" ? 0 : 1);
  };

  // Simulación en tiempo real de cambios
  const previewList = useMemo(() => {
    return affectedProducts.map((p) => {
      const oldPrice = p.price || 0;
      const newPrice = targetField === "cost" ? oldPrice : simulateNewValue(oldPrice);
      const diffPrice = newPrice - oldPrice;

      const oldCost = p.cost || 0;
      const newCost = targetField === "price" ? oldCost : simulateNewValue(oldCost);
      const diffCost = newCost - oldCost;

      return {
        id: p.id,
        name: p.name,
        category: getProductCategory(p),
        oldPrice,
        newPrice,
        diffPrice,
        oldCost,
        newCost,
        diffCost,
      };
    });
  }, [affectedProducts, numVal, type, roundTo, targetField]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!numVal || numVal === 0) {
      setError("Ingresá un valor de ajuste distinto de cero.");
      return;
    }

    if (affectedProducts.length === 0) {
      setError("No hay cortes en la categoría seleccionada.");
      return;
    }

    setLoading(true);
    try {
      await onConfirm({
        categoryName,
        type,
        value: numVal,
        roundTo,
        targetField,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Error al aplicar actualización masiva.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Actualización Masiva de Precios" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* Banner informativo de arquitectura */}
        <div className="rounded-xl border border-sky-500/30 bg-sky-50/60 p-3 text-xs text-sky-900 dark:border-sky-500/20 dark:bg-sky-950/30 dark:text-sky-200">
          <p className="font-bold flex items-center gap-1.5">
            <TrendUp size={16} weight="bold" />
            Actualización atómica en base de datos
          </p>
          <p className="mt-0.5 opacity-90">
            Aplica cambios en bloque mediante transacción protegida en Supabase con registro inmutable en auditoría.
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-50 p-3 text-sm font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-300">
            <WarningCircle size={18} weight="bold" className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Categoría a modificar */}
        <div>
          <label className="label" htmlFor="bulk-category">
            Categoría a modificar
          </label>
          <select
            id="bulk-category"
            className="field font-bold"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          >
            {categories.map((c) => {
              const count = products.filter(
                (p) => c === "Todas" || getProductCategory(p).toLowerCase() === c.toLowerCase()
              ).length;
              return (
                <option key={c} value={c}>
                  {c === "Todas" ? "Todas las categorías" : c} ({count} cortes)
                </option>
              );
            })}
          </select>
        </div>

        {/* 2. Campo a impactar */}
        <div>
          <label className="label">Campo a actualizar</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "price", label: "Precio Venta" },
              { id: "cost", label: "Costo Gancho" },
              { id: "both", label: "Ambos" },
            ].map((f) => {
              const active = targetField === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTargetField(f.id)}
                  className={`rounded-xl border-2 py-2 text-xs font-bold transition active:scale-95 ${
                    active
                      ? "border-accent-500 bg-accent-500 text-zinc-950 shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Tipo de ajuste: Porcentaje vs Fijo */}
        <div>
          <label className="label">Modo de ajuste</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setType("percentage");
                if (Math.abs(numVal) > 100) setValue("10");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-bold transition active:scale-95 ${
                type === "percentage"
                  ? "border-accent-500 bg-accent-500 text-zinc-950 shadow-sm"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              }`}
            >
              <Percent size={18} weight="bold" />
              Porcentaje (%)
            </button>
            <button
              type="button"
              onClick={() => {
                setType("fixed");
                if (Math.abs(numVal) <= 30) setValue("500");
              }}
              className={`flex items-center justify-center gap-1.5 rounded-xl border-2 py-2.5 text-sm font-bold transition active:scale-95 ${
                type === "fixed"
                  ? "border-accent-500 bg-accent-500 text-zinc-950 shadow-sm"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              }`}
            >
              <CurrencyDollar size={18} weight="bold" />
              Monto Fijo ($)
            </button>
          </div>
        </div>

        {/* 4. Valor del ajuste */}
        <div>
          <label className="label" htmlFor="bulk-value">
            {type === "percentage" ? "Porcentaje de variación (%)" : "Importe de variación ($)"}
          </label>
          <div className="relative">
            <input
              id="bulk-value"
              type="number"
              step={type === "percentage" ? "0.5" : "10"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="field font-mono text-xl font-bold pr-12 text-zinc-950 dark:text-zinc-50"
              placeholder={type === "percentage" ? "Ej: 10 para +10%" : "Ej: 500 para +$500"}
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-zinc-400">
              {type === "percentage" ? "%" : "$"}
            </span>
          </div>

          {/* Botones de un toque rápido */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(type === "percentage" ? QUICK_PERCENTAGES : QUICK_FIXED).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setValue(String(q))}
                className={`rounded-lg border px-2.5 py-1 text-xs font-mono font-bold transition active:scale-95 ${
                  numVal === q
                    ? "border-accent-500 bg-accent-500 text-zinc-950"
                    : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {q > 0 ? `+${q}` : q}
                {type === "percentage" ? "%" : "$"}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Regla de Redondeo para Mostrador */}
        <div>
          <label className="label">Redondeo comercial para agilidad en caja</label>
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: 10, label: "A $10", desc: "Recomendado" },
              { val: 50, label: "A $50", desc: "Billetes $50" },
              { val: 100, label: "A $100", desc: "Billetes $100" },
              { val: 1, label: "Exacto", desc: "Sin redondeo" },
            ].map((r) => {
              const active = roundTo === r.val;
              return (
                <button
                  key={r.val}
                  type="button"
                  onClick={() => setRoundTo(r.val)}
                  className={`flex flex-col items-center justify-center rounded-xl border-2 py-2 text-xs font-bold transition active:scale-95 ${
                    active
                      ? "border-accent-500 bg-accent-500 text-zinc-950 shadow-sm"
                      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <span className="font-mono text-sm">{r.label}</span>
                  <span className="text-[10px] font-normal opacity-75">{r.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 6. VISTA PREVIA EN TIEMPO REAL */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label mb-0">Vista previa de simulación</span>
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {affectedProducts.length} cortes afectados
            </span>
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/50">
            {previewList.length === 0 ? (
              <p className="py-4 text-center text-zinc-500">No hay cortes que coincidan con la categoría.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-left font-bold text-zinc-500 dark:border-zinc-800">
                    <th className="pb-1.5 pl-1">Corte</th>
                    <th className="pb-1.5 text-right font-mono">Actual</th>
                    <th className="pb-1.5 text-right font-mono">Nuevo</th>
                    <th className="pb-1.5 pr-1 text-right font-mono">Dif.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                  {previewList.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30">
                      <td className="py-1.5 pl-1 font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </td>
                      <td className="py-1.5 text-right font-mono text-zinc-500">
                        {money(item.oldPrice)}
                      </td>
                      <td className="py-1.5 text-right font-mono font-bold text-zinc-950 dark:text-zinc-50">
                        {money(item.newPrice)}
                      </td>
                      <td
                        className={`py-1.5 pr-1 text-right font-mono font-bold ${
                          item.diffPrice > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : item.diffPrice < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-zinc-400"
                        }`}
                      >
                        {item.diffPrice > 0 ? `+${money(item.diffPrice)}` : money(item.diffPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Acciones del formulario */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            className="btn-ghost flex-1 font-bold"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary flex-1 font-bold shadow-md"
            disabled={loading || affectedProducts.length === 0 || numVal === 0}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <ArrowsClockwise size={18} className="animate-spin" />
                Actualizando base de datos...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Check size={18} weight="bold" />
                Aplicar a {affectedProducts.length} cortes
              </span>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
