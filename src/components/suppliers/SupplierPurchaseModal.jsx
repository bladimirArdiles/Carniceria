import { useState } from "react";
import { Check, Info, Money, Receipt } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { money } from "../../lib/format.js";

const METHODS = ["Efectivo", "Transferencia", "Cheque"];

export default function SupplierPurchaseModal({ suppliers = [], preselectedSupplierId, onSave, onClose }) {
  const [supplierId, setSupplierId] = useState(preselectedSupplierId || suppliers[0]?.id || "");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [total, setTotal] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const numTotal = parseFloat(String(total).replace(",", ".")) || 0;
  const numPaid = parseFloat(String(paidAmount).replace(",", ".")) || 0;
  const debt = Math.max(0, numTotal - numPaid);

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (!supplierId) return setError("Seleccioná un proveedor.");
    if (!(numTotal > 0)) return setError("Ingresá un importe total válido para la compra.");
    if (numPaid < 0) return setError("El pago no puede ser negativo.");
    if (numPaid > numTotal) return setError("El pago no puede superar el total de la compra.");

    setLoading(true);
    try {
      await onSave({
        supplierId,
        invoiceNumber: invoiceNumber.trim(),
        total: Math.round(numTotal),
        paidAmount: Math.round(numPaid),
        method,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err.message || "Error al registrar la compra.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Registrar Factura / Remito de Proveedor" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="label" htmlFor="pur-supp">
            Proveedor / Frigorífico
          </label>
          <select
            id="pur-supp"
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pur-invoice">
              N° Factura / Remito
            </label>
            <input
              id="pur-invoice"
              className="field font-mono font-bold"
              placeholder="Ej: FC-0004-1289"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="pur-total">
              Importe Total ($)
            </label>
            <input
              id="pur-total"
              type="number"
              step="1"
              className="field font-mono text-lg font-bold"
              placeholder="Ej: 450000"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
            />
          </div>
        </div>

        {/* Pago inicial y método */}
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-850/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              Condición de Pago
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setPaidAmount("0")}
                className={`rounded-lg px-2 py-0.5 text-xs font-bold transition ${
                  numPaid === 0
                    ? "bg-amber-500 text-zinc-950 font-extrabold"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                100% a Crédito
              </button>
              <button
                type="button"
                onClick={() => setPaidAmount(String(numTotal || ""))}
                className={`rounded-lg px-2 py-0.5 text-xs font-bold transition ${
                  numPaid > 0 && numPaid === numTotal
                    ? "bg-emerald-500 text-zinc-950 font-extrabold"
                    : "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                Pago Contado
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs" htmlFor="pur-paid">
                Monto abonado hoy ($)
              </label>
              <input
                id="pur-paid"
                type="number"
                step="1"
                className="field font-mono text-base font-bold"
                placeholder="0 si queda a pagar"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="label text-xs" htmlFor="pur-method">
                Medio de pago
              </label>
              <select
                id="pur-method"
                className="field font-bold"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={numPaid <= 0}
              >
                {METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {numPaid > 0 && method === "Efectivo" && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <Info size={16} weight="bold" className="shrink-0" />
              <span>Se registrará automáticamente como egreso de mostrador para el arqueo del día.</span>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-zinc-200 pt-2 text-xs font-bold dark:border-zinc-700">
            <span className="text-zinc-500">Saldo que pasa a cuenta corriente:</span>
            <span className={`font-mono text-sm ${debt > 0 ? "text-amber-600 dark:text-amber-400 font-extrabold" : "text-emerald-600 dark:text-emerald-400"}`}>
              {money(debt)}
            </span>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="pur-notes">
            Detalle de mercadería / Hacienda
          </label>
          <input
            id="pur-notes"
            className="field text-sm"
            placeholder="Ej: 3 medias reses vacunas (330 kg) + 2 cajones de pollo..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-2.5 pt-2">
          <button type="button" className="btn-ghost flex-1 font-bold" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex-1 font-bold shadow-md" disabled={loading || !(numTotal > 0)}>
            <Check size={18} weight="bold" />
            {loading ? "Registrando..." : "Guardar Compra"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
