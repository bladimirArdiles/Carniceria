import { useMemo, useState } from "react";
import { Bank, Check, CheckCircle, Money, WarningCircle } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import Segmented from "../ui/Segmented.jsx";
import { money } from "../../lib/format.js";

export default function PaymentForm({ customer, balance, onSave, onClose }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [error, setError] = useState("");
  const value = parseFloat(String(amount).replace(",", ".")) || 0;

  // Cálculo de nuevo saldo proyectado en tiempo real
  const remaining = Math.round(balance - value);

  // Chips de montos rápidos según la deuda
  const chips = useMemo(() => {
    const list = [];
    if (balance > 0) {
      list.push({ label: `Pagar todo (${money(balance)})`, val: balance });
      if (balance >= 6000) {
        const half = Math.round(balance / 2);
        list.push({ label: `50% (${money(half)})`, val: half });
      }
      [5000, 10000, 20000, 50000].forEach((b) => {
        if (b < balance && !list.some((item) => item.val === b)) {
          list.push({ label: `$${b >= 1000 ? `${b / 1000}k` : b}`, val: b });
        }
      });
    }
    return list.slice(0, 4);
  }, [balance]);

  const submit = (e) => {
    if (e) e.preventDefault();
    if (!(value > 0)) return setError("Ingresá un monto mayor a 0.");
    if (value > balance) return setError(`El pago supera la deuda (${money(balance)}).`);
    onSave({ customerId: customer.id, amount: Math.round(value), method });
  };

  return (
    <Modal title={`Cobro de Fiado: ${customer.name}`} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* Banner de deuda actual */}
        <div className="flex items-center justify-between rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
          <div>
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Saldo pendiente</p>
            <p className="font-mono text-3xl font-extrabold text-zinc-950 dark:text-zinc-50">{money(balance)}</p>
          </div>
          <span className="rounded-xl bg-amber-400/20 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-300">
            Cuenta corriente
          </span>
        </div>

        {/* Campo de monto con atajos */}
        <div>
          <label className="label" htmlFor="pay-amount">Monto abonado por el cliente</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xl font-bold text-zinc-400">
              $
            </span>
            <input
              id="pay-amount"
              className="field pl-9 font-mono text-2xl font-bold"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setError("");
                setAmount(e.target.value.replace(/[^\d.,]/g, ""));
              }}
              autoFocus
            />
          </div>

          {/* Chips de monto rápido */}
          {chips.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {chips.map((c) => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => {
                    setError("");
                    setAmount(String(c.val));
                  }}
                  className={`rounded-xl py-2 px-2 text-center text-xs font-bold transition active:scale-95 ${
                    value === c.val
                      ? "bg-accent-500 text-zinc-950 font-extrabold shadow-sm"
                      : "border border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Proyección de nuevo saldo en tiempo real */}
        {value > 0 && value <= balance && (
          <div
            className={`rounded-2xl border-2 p-3 text-center transition-all ${
              remaining === 0
                ? "border-emerald-500/40 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800/80 dark:text-zinc-100"
            }`}
          >
            {remaining === 0 ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle size={20} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
                <span className="font-bold text-sm text-emerald-800 dark:text-emerald-300">
                  ¡Deuda saldada por completo! Saldo restante: $0
                </span>
              </div>
            ) : (
              <div className="text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">Saldo que quedará pendiente: </span>
                <span className="font-mono text-base font-black text-amber-700 dark:text-amber-400">
                  {money(remaining)}
                </span>
              </div>
            )}
          </div>
        )}

        <Segmented
          label="Medio de cobro"
          value={method}
          onChange={setMethod}
          options={[
            { value: "Efectivo", label: "Efectivo", icon: Money },
            { value: "Transferencia", label: "Transfer.", icon: Bank },
          ]}
        />

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-400">
            <WarningCircle size={20} weight="bold" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn-primary h-16 w-full text-lg shadow-md" disabled={value <= 0}>
          <Check size={24} weight="bold" />
          Registrar cobro {value > 0 && money(Math.min(value, balance))}
        </button>
      </form>
    </Modal>
  );
}
