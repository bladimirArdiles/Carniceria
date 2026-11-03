import { useState } from "react";
import { Check, Minus, Plus, Scales } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import Segmented from "../ui/Segmented.jsx";
import { num, round3 } from "../../lib/format.js";

const TYPES = [
  { value: "compra", label: "Compra", icon: Plus },
  { value: "merma", label: "Merma", icon: Minus },
  { value: "ajuste", label: "Conteo", icon: Scales },
];

export default function MovementForm({ products, productId, type: initialType, onSave, onClose }) {
  const [pid, setPid] = useState(productId || products[0]?.id || "");
  const [type, setType] = useState(initialType || "compra");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [cost, setCost] = useState("");
  const [error, setError] = useState("");

  const product = products.find((p) => p.id === pid);
  const q = parseFloat(String(qty).replace(",", "."));
  const unit = product?.unit === "kg" ? "kg" : "u";
  const delta = !product || isNaN(q) ? null : type === "compra" ? q : type === "merma" ? -q : round3(q - product.stock);
  const result = product && delta !== null ? round3(product.stock + delta) : null;

  const submit = (e) => {
    e.preventDefault();
    if (!product) return setError("Elegí un producto.");
    if (isNaN(q) || q < 0 || (type !== "ajuste" && q === 0)) return setError("Ingresá una cantidad válida.");
    if (type === "merma" && q > product.stock) return setError("La merma no puede superar el stock actual.");
    onSave({ productId: pid, type, qty: q, note: note.trim(), cost: parseFloat(String(cost).replace(",", ".")) || 0 });
  };

  return (
    <Modal title="Movimiento de stock" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <label className="label" htmlFor="mv-prod">Producto</label>
          <select id="mv-prod" className="field" value={pid} onChange={(e) => setPid(e.target.value)}>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({num(p.stock)} {p.unit === "kg" ? "kg" : "u"})</option>)}
          </select>
        </div>

        <Segmented label="Tipo" value={type} onChange={setType} options={TYPES} />

        <div>
          <label className="label" htmlFor="mv-qty">
            {type === "ajuste" ? `Stock contado (${unit})` : type === "compra" ? `Cantidad recibida (${unit})` : `Cantidad perdida (${unit})`}
          </label>
          <input id="mv-qty" className="field font-mono text-xl font-bold" inputMode="decimal" placeholder="0" value={qty}
            onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ""))} />
          {result !== null && <p className="mt-2 font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">Stock resultante: {num(result)} {unit}</p>}
        </div>

        {type === "compra" && (
          <div>
            <label className="label" htmlFor="mv-cost">Costo total pagado (opcional)</label>
            <input id="mv-cost" className="field font-mono" inputMode="decimal" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
        )}

        <div>
          <label className="label" htmlFor="mv-note">{type === "compra" ? "Proveedor o nota" : "Motivo"}</label>
          <input id="mv-note" className="field" placeholder={type === "compra" ? "Ej: Frigorífico del norte" : type === "merma" ? "Ej: Recorte, vencimiento" : "Ej: Conteo de cierre"} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {error && <p role="alert" className="text-sm font-bold text-red-700 dark:text-red-400">{error}</p>}
        <button type="submit" className="btn-primary h-16 w-full text-lg"><Check size={24} weight="bold" />Guardar movimiento</button>
      </form>
    </Modal>
  );
}

