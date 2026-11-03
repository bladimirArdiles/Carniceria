import { useMemo, useState } from "react";
import { ArrowRight, Check, CheckCircle, Minus, Plus, Scales, TrendUp, WarningCircle } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import Segmented from "../ui/Segmented.jsx";
import { money, num, round3 } from "../../lib/format.js";

const TYPES = [
  { value: "compra", label: "Ingreso / Compra", icon: Plus },
  { value: "merma", label: "Merma / Recorte", icon: Minus },
  { value: "ajuste", label: "Conteo Balanza", icon: Scales },
];

const MERMA_REASONS = [
  "Desgrase y limpieza",
  "Hueso y desposte",
  "Vencimiento o mal estado",
  "Consumo del personal",
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
  const costVal = parseFloat(String(cost).replace(",", ".")) || 0;

  const delta = !product || isNaN(q) ? null : type === "compra" ? q : type === "merma" ? -q : round3(q - product.stock);
  const result = product && delta !== null ? round3(product.stock + delta) : null;

  // Cálculo de costo unitario y margen bruto estimado en compras
  const unitCost = useMemo(() => {
    if (type !== "compra" || !costVal || !q || q <= 0) return null;
    return Math.round(costVal / q);
  }, [type, costVal, q]);

  const estimatedMargin = useMemo(() => {
    if (!unitCost || !product?.price || product.price <= 0) return null;
    const margin = ((product.price - unitCost) / product.price) * 100;
    return Math.round(margin);
  }, [unitCost, product?.price]);

  // Chips rápidos según tipo y unidad
  const chips = useMemo(() => {
    if (type === "compra") {
      return unit === "kg"
        ? [
            { label: "+10 kg", val: 10 },
            { label: "+20 kg (cajón)", val: 20 },
            { label: "+50 kg", val: 50 },
            { label: "+100 kg (media res)", val: 100 },
          ]
        : [
            { label: "+6 u", val: 6 },
            { label: "+12 u", val: 12 },
            { label: "+24 u", val: 24 },
            { label: "+50 u", val: 50 },
          ];
    }
    if (type === "merma") {
      return unit === "kg"
        ? [
            { label: "0,5 kg (grasa)", val: 0.5 },
            { label: "1 kg", val: 1 },
            { label: "2 kg", val: 2 },
            { label: "5 kg (hueso)", val: 5 },
          ]
        : [
            { label: "1 u", val: 1 },
            { label: "2 u", val: 2 },
            { label: "5 u", val: 5 },
          ];
    }
    return [];
  }, [type, unit]);

  const submit = (e) => {
    e.preventDefault();
    if (!product) return setError("Elegí un producto.");
    if (isNaN(q) || q < 0 || (type !== "ajuste" && q === 0)) return setError("Ingresá una cantidad válida.");
    if (type === "merma" && q > product.stock) return setError("La merma no puede superar el stock actual.");
    onSave({ productId: pid, type, qty: q, note: note.trim(), cost: costVal });
  };

  return (
    <Modal title="Movimiento de Stock" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {/* Selector de producto */}
        <div>
          <label className="label" htmlFor="mv-prod">Corte / Producto</label>
          <select id="mv-prod" className="field" value={pid} onChange={(e) => setPid(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Stock actual: {num(p.stock)} {p.unit === "kg" ? "kg" : "u"})
              </option>
            ))}
          </select>
        </div>

        <Segmented label="Tipo de operación" value={type} onChange={setType} options={TYPES} />

        {/* Input de cantidad con chips rápidos */}
        <div>
          <label className="label" htmlFor="mv-qty">
            {type === "ajuste"
              ? `Stock contado en balanza (${unit})`
              : type === "compra"
              ? `Cantidad recibida del frigorífico / proveedor (${unit})`
              : `Cantidad desechada / recortada (${unit})`}
          </label>
          <div className="relative">
            <input
              id="mv-qty"
              className="field font-mono text-2xl font-bold"
              inputMode="decimal"
              placeholder="0"
              value={qty}
              onChange={(e) => {
                setError("");
                setQty(e.target.value.replace(/[^\d.,]/g, ""));
              }}
              autoFocus
            />
          </div>

          {chips.length > 0 && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {chips.map((c) => (
                <button
                  key={c.val}
                  type="button"
                  onClick={() => {
                    setError("");
                    setQty(String(c.val));
                  }}
                  className={`rounded-xl py-2 px-1 text-center text-xs font-bold transition active:scale-95 ${
                    q === c.val
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

        {/* Previsualización del stock resultante */}
        {result !== null && (
          <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-850">
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Stock actual: </span>
              <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{num(product.stock)} {unit}</span>
            </div>
            <ArrowRight size={16} weight="bold" className="text-zinc-400" />
            <div>
              <span className="text-zinc-600 dark:text-zinc-400">Nuevo stock: </span>
              <span className="font-mono text-sm font-black text-zinc-950 dark:text-zinc-50">{num(result)} {unit}</span>
            </div>
            {type === "ajuste" && delta !== null && (
              <span
                className={`rounded-lg px-2 py-0.5 text-xs font-bold ${
                  delta > 0
                    ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                    : delta < 0
                    ? "bg-red-500/15 text-red-800 dark:text-red-300"
                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                {delta > 0 ? `+${num(delta)} Sobrante` : delta < 0 ? `${num(delta)} Faltante` : "Sin ajuste"}
              </span>
            )}
          </div>
        )}

        {/* Campos adicionales para compras (Costo y cálculo de margen) */}
        {type === "compra" && (
          <div className="space-y-3 rounded-2xl bg-zinc-100/70 p-3.5 dark:bg-zinc-800/60">
            <div>
              <label className="label" htmlFor="mv-cost">Costo total pagado al proveedor (opcional)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-zinc-400">
                  $
                </span>
                <input
                  id="mv-cost"
                  className="field pl-9 font-mono font-bold"
                  inputMode="decimal"
                  placeholder="Ej: 250000"
                  value={cost}
                  onChange={(e) => setCost(e.target.value.replace(/[^\d.,]/g, ""))}
                />
              </div>
            </div>

            {unitCost !== null && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-2 text-xs dark:border-zinc-700">
                <div>
                  <span className="text-zinc-600 dark:text-zinc-400">Costo unitario: </span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    {money(unitCost)}/{unit}
                  </span>
                </div>
                {estimatedMargin !== null && (
                  <div className="flex items-center gap-1 font-bold">
                    <TrendUp size={16} weight="bold" className={estimatedMargin >= 25 ? "text-emerald-600" : "text-amber-600"} />
                    <span className={estimatedMargin >= 25 ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}>
                      Margen estimado: ~{estimatedMargin}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Motivo o nota con sugerencias */}
        <div>
          <label className="label" htmlFor="mv-note">
            {type === "compra" ? "Proveedor o número de remito" : type === "merma" ? "Motivo del descarte / recorte" : "Nota de conteo"}
          </label>
          <input
            id="mv-note"
            className="field"
            placeholder={
              type === "compra"
                ? "Ej: Frigorífico Morteros, Remito #1420"
                : type === "merma"
                ? "Ej: Recorte de grasa, hueso, etc."
                : "Ej: Conteo físico balanza central"
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {type === "merma" && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {MERMA_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setNote(r)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    note === r
                      ? "bg-accent-500 text-zinc-950 font-bold"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-400">
            <WarningCircle size={20} weight="bold" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn-primary h-16 w-full text-lg shadow-md" disabled={isNaN(q) || q <= 0}>
          <Check size={24} weight="bold" />
          Guardar movimiento
        </button>
      </form>
    </Modal>
  );
}

