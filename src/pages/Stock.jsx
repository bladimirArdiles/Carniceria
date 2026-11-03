import { useMemo, useState } from "react";
import { MagnifyingGlass, Minus, Package, PencilSimple, Plus, Truck } from "@phosphor-icons/react";
import { useStore } from "../lib/store.jsx";
import { fmtDateTime, money, num } from "../lib/format.js";
import Badge, { stockLabel, stockTone } from "../components/ui/Badge.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import MovementForm from "../components/stock/MovementForm.jsx";
import ProductForm from "../components/stock/ProductForm.jsx";

const TYPE_LABEL = { compra: "Compra", merma: "Merma", ajuste: "Conteo" };

export default function Stock() {
  const { products, movements, addMovement, saveProduct, deleteProduct, notify } = useStore();
  const [query, setQuery] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);
  const [movement, setMovement] = useState(null); // { productId?, type? }
  const [editing, setEditing] = useState(null); // null | "new" | product

  const lowCount = products.filter((p) => stockTone(p) !== "ok").length;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...products]
      .filter((p) => (!q || p.name.toLowerCase().includes(q)) && (!onlyLow || stockTone(p) !== "ok"))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [products, query, onlyLow]);

  const recent = [...movements].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-primary h-16 text-lg" onClick={() => setMovement({})} disabled={!products.length}>
          <Truck size={24} weight="bold" />Ingresar stock o registrar merma
        </button>
        <button type="button" className="btn-ghost h-16 text-lg" onClick={() => setEditing("new")}>
          <Plus size={24} weight="bold" />Nuevo producto
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlass size={22} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-400" />
          <input className="field pl-12" type="search" placeholder="Buscar producto" aria-label="Buscar producto" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button type="button" aria-pressed={onlyLow} onClick={() => setOnlyLow(!onlyLow)}
          className={"inline-flex h-14 items-center justify-center rounded-2xl border-2 px-5 font-bold transition active:scale-95 " + (onlyLow ? "border-accent-400 bg-accent-400 text-zinc-950" : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900")}>
          Solo alertas ({lowCount})
        </button>
      </div>

      {!products.length ? (
        <EmptyState icon={Package} title="Sin productos" text="Agregá tu primer corte para empezar a vender." />
      ) : list.length === 0 ? (
        <p className="card text-center font-semibold">No hay productos para mostrar.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {list.map((p) => {
            const tone = stockTone(p);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold">{p.name}</p>
                    {p.category && (
                      <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {p.category}
                      </span>
                    )}
                    {tone !== "ok" && <Badge tone={tone}>{stockLabel[tone]}</Badge>}
                  </div>
                  <p className="font-mono text-sm text-zinc-700 dark:text-zinc-300">{money(p.price)} por {p.unit === "kg" ? "kg" : "unidad"} | mínimo {num(p.minStock)}</p>
                </div>
                <p className="font-mono text-2xl font-bold">{num(p.stock)} <span className="text-base font-semibold text-zinc-700 dark:text-zinc-300">{p.unit === "kg" ? "kg" : "u"}</span></p>
                <div className="flex gap-2">
                  <button type="button" className="btn-icon" aria-label={`Ingresar stock de ${p.name}`} onClick={() => setMovement({ productId: p.id, type: "compra" })}><Plus size={22} weight="bold" /></button>
                  <button type="button" className="btn-icon" aria-label={`Registrar merma de ${p.name}`} onClick={() => setMovement({ productId: p.id, type: "merma" })}><Minus size={22} weight="bold" /></button>
                  <button type="button" className="btn-icon" aria-label={`Editar ${p.name}`} onClick={() => setEditing(p)}><PencilSimple size={22} weight="bold" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold tracking-tight">Últimos movimientos</h2>
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {recent.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-bold">{m.productName} <span className="font-medium text-zinc-700 dark:text-zinc-300">({TYPE_LABEL[m.type]})</span></p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{fmtDateTime(m.date)}{m.note ? `, ${m.note}` : ""}{m.cost ? `, costo ${money(m.cost)}` : ""}</p>
                </div>
                <p className={"shrink-0 font-mono text-lg font-bold " + (m.delta < 0 ? "text-red-700 dark:text-red-400" : "")}>
                  {m.delta > 0 ? "+" : ""}{num(m.delta)} {m.unit === "kg" ? "kg" : "u"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {movement && (
        <MovementForm products={products} productId={movement.productId} type={movement.type}
          onClose={() => setMovement(null)}
          onSave={(m) => { addMovement(m); setMovement(null); notify("Movimiento de stock guardado"); }} />
      )}
      {editing && (
        <ProductForm product={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSave={(p) => { saveProduct(p); setEditing(null); notify("Producto guardado"); }}
          onDelete={(id) => { deleteProduct(id); setEditing(null); notify("Producto eliminado"); }} />
      )}
    </div>
  );
}
