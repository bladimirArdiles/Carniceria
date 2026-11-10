import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, CurrencyDollar, Money, Receipt, WarningCircle, X } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { money } from "../../lib/format.js";

const EXPENSE_CATEGORIES = [
  "Proveedores",
  "Insumos y Bolsas",
  "Retiro de Dueño",
  "Flete / Reparto",
  "Limpieza / Mantenimiento",
  "Varios",
];

const INFLOW_CATEGORIES = [
  "Fondo de Cambio Inicial",
  "Aporte de Efectivo",
  "Varios",
];

export default function CashMovementModal({ onClose, onSave }) {
  const [type, setType] = useState("egreso"); // "egreso" | "ingreso"
  const [category, setCategory] = useState("Proveedores");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const numAmount = parseFloat(String(amount).replace(",", ".")) || 0;

  const categories = type === "egreso" ? EXPENSE_CATEGORIES : INFLOW_CATEGORIES;

  const quickAmounts = type === "egreso" ? [5000, 10000, 20000, 50000] : [10000, 20000, 50000, 100000];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (numAmount <= 0) {
      setError("Ingresá un importe mayor a $0.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        type,
        category,
        amount: numAmount,
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Error al registrar movimiento de caja.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={type === "egreso" ? "Registrar Salida de Dinero (Gasto / Retiro)" : "Ingresar Dinero a Caja (Fondo de Cambio)"}
      onClose={onClose}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Selector de Tipo */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => {
              setType("egreso");
              setCategory("Proveedores");
            }}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              type === "egreso"
                ? "bg-red-600 text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            <ArrowUpRight size={18} weight="bold" />
            Salida / Egreso
          </button>
          <button
            type="button"
            onClick={() => {
              setType("ingreso");
              setCategory("Fondo de Cambio Inicial");
            }}
            className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              type === "ingreso"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            <ArrowDownLeft size={18} weight="bold" />
            Ingreso / Fondo
          </button>
        </div>

        {/* Importe con display gigante */}
        <div>
          <label className="label" htmlFor="cash-amount">Importe en efectivo</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-2xl font-bold text-zinc-400">
              $
            </span>
            <input
              id="cash-amount"
              type="text"
              inputMode="decimal"
              className="field pl-9 font-mono text-3xl font-extrabold"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
              autoFocus
            />
          </div>

          {/* Chips de importe rápido */}
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {quickAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(String(q))}
                className="btn-ghost h-10 px-0 font-mono text-xs font-bold"
              >
                ${q >= 1000 ? `${q / 1000}k` : q}
              </button>
            ))}
          </div>
        </div>

        {/* Categoría */}
        <div>
          <label className="label" htmlFor="cash-category">Concepto o Destino</label>
          <select
            id="cash-category"
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Detalle o Nota */}
        <div>
          <label className="label" htmlFor="cash-note">
            Detalle adicional <span className="text-zinc-400 font-normal">(opcional)</span>
          </label>
          <input
            id="cash-note"
            type="text"
            className="field"
            placeholder={type === "egreso" ? "Ej: Repartidor de carbón / 5 bolsas" : "Ej: Cambio inicial turno mañana"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-800 dark:bg-red-950/40 dark:text-red-300">
            <WarningCircle size={18} weight="bold" className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Botón Guardar */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || numAmount <= 0}
            className={`btn-primary h-14 w-full text-base font-bold shadow-md flex items-center justify-center gap-2 ${
              type === "egreso" ? "!bg-red-600 !text-white hover:!bg-red-700" : "!bg-emerald-600 !text-white hover:!bg-emerald-700"
            }`}
          >
            <Check size={20} weight="bold" />
            <span>
              {isSubmitting
                ? "Registrando..."
                : type === "egreso"
                ? `Registrar Retiro (-${money(numAmount)})`
                : `Registrar Ingreso (+${money(numAmount)})`}
            </span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

