import { useState } from "react";
import { Bank, Check, Money } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import Segmented from "../ui/Segmented.jsx";
import { money } from "../../lib/format.js";

export default function PaymentForm({ customer, balance, onSave, onClose }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [error, setError] = useState("");
  const value = parseFloat(String(amount).replace(",", "."));

  const submit = (e) => {
    e.preventDefault();
    if (!(value > 0)) return setError("Ingresá un monto mayor a 0.");
    if (value > balance) return setError(`El pago supera la deuda (${money(balance)}).`);
    onSave({ customerId: customer.id, amount: Math.round(value), method });
  };

  return (
    <Modal title={`Pago de ${customer.name}`} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-5" noValidate>
        <p className="rounded-2xl bg-zinc-100 p-4 text-lg font-bold dark:bg-zinc-800">
          Debe <span className="font-mono">{money(balance)}</span>
        </p>
        <div>
          <label className="label" htmlFor="pay-amount">Monto a pagar</label>
          <input id="pay-amount" className="field font-mono text-2xl font-bold" inputMode="decimal" placeholder="0" value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} />
          <button type="button" className="btn-ghost mt-2 h-12 w-full" onClick={() => setAmount(String(balance))}>Pagar todo ({money(balance)})</button>
        </div>
        <Segmented label="Forma de pago" value={method} onChange={setMethod} options={[
          { value: "Efectivo", label: "Efectivo", icon: Money },
          { value: "Transferencia", label: "Transfer.", icon: Bank },
        ]} />
        {error && <p role="alert" className="text-sm font-bold text-red-700 dark:text-red-400">{error}</p>}
        <button type="submit" className="btn-primary h-16 w-full text-lg"><Check size={24} weight="bold" />Registrar pago</button>
      </form>
    </Modal>
  );
}
