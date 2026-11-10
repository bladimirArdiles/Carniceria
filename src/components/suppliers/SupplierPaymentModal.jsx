import { useState } from "react";
import { Check, Info } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { money } from "../../lib/format.js";

const METHODS = ["Efectivo", "Transferencia", "Cheque"];

export default function SupplierPaymentModal({ suppliers = [], preselectedSupplierId, onSave, onClose }) {
  const [supplierId, setSupplierId] = useState(preselectedSupplierId || suppliers[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);
  const currentBalance = Number(selectedSupplier?.balance || 0);
  const numAmt = parseFloat(String(amount).replace(",", ".")) || 0;

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!supplierId) return setError("Seleccioná un proveedor.");
    if (!(numAmt > 0)) return setError("Ingresá un importe de pago válido mayor a $0.");

    setLoading(true);
    try {
      await onSave({
        supplierId,
        amount: Math.round(numAmt),
        method,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Error al registrar el pago.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Registrar Pago a Proveedor / Frigorífico" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="label" htmlFor="pay-supp">
            Proveedor / Frigorífico
          </label>
          <select
            id="pay-supp"
            className="field font-bold"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.category}) — Saldo adeudado: {money(s.balance || 0)}
              </option>
            ))}
          </select>
        </div>

        {/* Resumen de deuda */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-850/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-zinc-500">Deuda actual acumulada:</p>
            <p className="font-mono text-xl font-black text-amber-600 dark:text-amber-400">
              {money(currentBalance)}
            </p>
          </div>
          {currentBalance > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(currentBalance))}
              className="rounded-xl border border-amber-500/40 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition active:scale-95 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300"
            >
              Liquidar deuda total
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pay-amount">
              Monto a abonar ($)
            </label>
            <input
              id="pay-amount"
              type="number"
              step="1"
              className="field font-mono text-xl font-bold"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="pay-method">
              Medio de pago
            </label>
            <select
              id="pay-method"
              className="field font-bold"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {numAmt > 0 && method === "Efectivo" && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50/70 p-2.5 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <Info size={16} weight="bold" className="shrink-0" />
            <span>Este pago en efectivo se asentará como egreso de mostrador para el arqueo del día.</span>
          </div>
        )}

        <div>
          <label className="label" htmlFor="pay-notes">
            Comprobante / N° Transacción / Cheque
          </label>
          <input
            id="pay-notes"
            className="field text-sm"
            placeholder="Ej: Transf. N° 894123 Banco Galicia / Cheque diferido 15 días"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-2.5 pt-2">
          <button type="button" className="btn-ghost flex-1 font-bold" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex-1 font-bold shadow-md" disabled={loading || !(numAmt > 0)}>
            <Check size={18} weight="bold" />
            {loading ? "Registrando..." : "Confirmar Pago"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
