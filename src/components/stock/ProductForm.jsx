import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import Segmented from "../ui/Segmented.jsx";
import ConfirmButton from "../ui/ConfirmButton.jsx";
import { DEFAULT_CATEGORIES, uid } from "../../lib/format.js";

export default function ProductForm({ product, onSave, onDelete, onClose }) {
  const [name, setName] = useState(product?.name || "");
  const [category, setCategory] = useState(product?.category || "Vaca");
  const [unit, setUnit] = useState(product?.unit || "kg");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [minStock, setMinStock] = useState(product ? String(product.minStock) : "5");
  const [stock, setStock] = useState("0");
  const [error, setError] = useState("");

  const toNum = (v) => parseFloat(String(v).replace(",", "."));

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Escribí el nombre del producto.");
    const p = toNum(price);
    if (!(p > 0)) return setError("Ingresá un precio mayor a $0.");
    const ms = toNum(minStock);
    if (isNaN(ms) || ms < 0) return setError("El stock mínimo de alerta no puede ser negativo.");
    const st = toNum(stock);
    if (isNaN(st) || st < 0) return setError("El stock inicial no puede ser negativo.");

    onSave({
      id: product?.id || uid(),
      name: name.trim(),
      category: category.trim() || "Otros",
      unit,
      price: Math.round(p),
      minStock: ms,
      ...(product ? {} : { stock: st }),
    });
  };

  return (
    <Modal title={product ? "Editar producto" : "Nuevo producto"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <label className="label" htmlFor="pf-name">Nombre</label>
          <input id="pf-name" className="field" placeholder="Ej: Costilla" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="label" htmlFor="pf-category">Categoría (vaca, cerdo, pollo, etc.)</label>
          <input
            id="pf-category"
            list="pf-category-list"
            className="field"
            placeholder="Ej: Vaca, Cerdo, Pollo..."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            autoComplete="off"
          />
          <datalist id="pf-category-list">
            {DEFAULT_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} />
            ))}
          </datalist>

          {/* Chips rápidos */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DEFAULT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={"rounded-xl px-2.5 py-1 text-xs font-bold transition " +
                  (category.toLowerCase() === cat.toLowerCase()
                    ? "bg-accent-500 text-zinc-950"
                    : "border border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700")}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <Segmented label="Se vende por" value={unit} onChange={setUnit} options={[{ value: "kg", label: "Kilos" }, { value: "u", label: "Unidades" }]} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="pf-price">Precio por {unit === "kg" ? "kg" : "unidad"}</label>
            <input id="pf-price" className="field font-mono font-bold" inputMode="numeric" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
          <div>
            <label className="label" htmlFor="pf-min">Alerta de stock bajo</label>
            <input id="pf-min" className="field font-mono font-bold" inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
        </div>
        {!product && (
          <div>
            <label className="label" htmlFor="pf-stock">Stock inicial ({unit === "kg" ? "kg" : "u"})</label>
            <input id="pf-stock" className="field font-mono font-bold" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value.replace(/[^\d.,]/g, ""))} />
          </div>
        )}
        {error && <p role="alert" className="text-sm font-bold text-red-700 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          {product && <ConfirmButton className="!h-16" label="Eliminar producto" onConfirm={() => onDelete(product.id)} />}
          <button type="submit" className="btn-primary h-16 flex-1 text-lg"><Check size={24} weight="bold" />Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
