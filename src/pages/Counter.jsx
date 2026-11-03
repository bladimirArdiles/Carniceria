import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useStore } from "../lib/store.jsx";
import { DEFAULT_CATEGORIES, lineTotal, money, num } from "../lib/format.js";
import Badge, { stockLabel, stockTone } from "../components/ui/Badge.jsx";
import QtyDialog from "../components/pos/QtyDialog.jsx";
import Ticket from "../components/pos/Ticket.jsx";

// Función para obtener la categoría con deducción inteligente para productos existentes
export const getProductCategory = (p) => {
  if (p?.category && p.category.trim()) return p.category.trim();
  const n = (p?.name || "").toLowerCase();
  if (n.includes("pollo")) return "Pollo";
  if (n.includes("cerdo") || n.includes("pechito") || n.includes("bondiola")) return "Cerdo";
  if (n.includes("chorizo") || n.includes("morcilla") || n.includes("salchicha")) return "Embutidos";
  if (n.includes("chinchulin") || n.includes("molleja") || n.includes("higado") || n.includes("rinon")) return "Achuras";
  return "Vaca";
};

export default function Counter() {
  const { products, customers, balances, completeSale, notify } = useStore();
  const [lines, setLines] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [dialog, setDialog] = useState(null); // { product, initial }
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState("Efectivo");

  // Lista de categorías: "Todas" + Vaca, Cerdo, Pollo, Achuras, Embutidos + cualquier otra creada
  const categories = useMemo(() => {
    const existing = new Set();
    products.forEach((p) => {
      existing.add(getProductCategory(p));
    });
    const standard = ["Todas", "Vaca", "Cerdo", "Pollo", "Achuras", "Embutidos"];
    const extras = Array.from(existing).filter((c) => !standard.includes(c));
    return [...standard, ...extras];
  }, [products]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...products]
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (selectedCategory !== "Todas") {
          const cat = getProductCategory(p);
          if (cat.toLowerCase() !== selectedCategory.toLowerCase()) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [products, query, selectedCategory]);

  const setQty = (product, qty, replace) => {
    setLines((prev) => {
      const cur = prev.find((l) => l.productId === product.id);
      const finalQty = cur && !replace ? Math.round((cur.qty + qty) * 1000) / 1000 : qty;
      const line = { productId: product.id, name: product.name, unit: product.unit, price: product.price, qty: finalQty, total: lineTotal(finalQty, product.price) };
      return cur ? prev.map((l) => (l.productId === product.id ? line : l)) : [...prev, line];
    });
  };

  const onConfirm = (qty) => {
    setQty(dialog.product, qty, dialog.replace);
    setDialog(null);
  };

  const charge = () => {
    const sale = completeSale({ items: lines, customerId, method });
    notify(method === "Fiado" ? `Anotado en cuenta: ${money(sale.total)}` : `Venta cobrada: ${money(sale.total)}`);
    setLines([]);
    setCustomerId("");
    setMethod("Efectivo");
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
      <section aria-label="Productos" className="space-y-4">
        {/* Buscador de producto */}
        <div className="relative">
          <MagnifyingGlass size={22} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-400" />
          <input className="field pl-12" type="search" placeholder="Buscar producto" aria-label="Buscar producto" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {/* Barra horizontal de categorías (Siempre visible) */}
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar por categoría">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(cat)}
                className={"shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-95 " +
                  (active
                    ? "bg-accent-500 text-zinc-950 shadow-md font-extrabold"
                    : "border-2 border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600")}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {shown.length === 0 ? (
          <p className="card text-center font-semibold">
            {selectedCategory !== "Todas"
              ? `No hay productos en la categoría "${selectedCategory}".`
              : "No hay productos con ese nombre."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {shown.map((p) => {
              const tone = stockTone(p);
              const inTicket = lines.find((l) => l.productId === p.id);
              const catName = getProductCategory(p);
              return (
                <button key={p.id} type="button" onClick={() => setDialog({ product: p })}
                  className={"flex min-h-32 flex-col justify-between gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.97] " +
                    (inTicket ? "border-accent-500 bg-accent-400/15" : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600")}>
                  <div>
                    <span className="mb-1 inline-block rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {catName}
                    </span>
                    <p className="text-xl font-bold leading-tight">{p.name}</p>
                    <p className="mt-1 font-mono text-base font-semibold text-zinc-700 dark:text-zinc-300">{money(p.price)} / {p.unit === "kg" ? "kg" : "u"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {tone !== "ok" ? <Badge tone={tone}>{stockLabel[tone]}</Badge> : <span className="font-mono text-sm font-semibold text-zinc-700 dark:text-zinc-300">{num(p.stock)} {p.unit === "kg" ? "kg" : "u"}</span>}
                    {inTicket && <span className="font-mono text-sm font-bold">En ticket: {num(inTicket.qty)}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <Ticket lines={lines} customers={customers} balances={balances} customerId={customerId} setCustomerId={setCustomerId}
        method={method} setMethod={setMethod}
        onEdit={(l) => setDialog({ product: products.find((p) => p.id === l.productId) || { id: l.productId, name: l.name, unit: l.unit, price: l.price, stock: 0 }, initial: l.qty, replace: true })}
        onRemove={(id) => setLines((p) => p.filter((l) => l.productId !== id))}
        onClear={() => setLines([])} onCharge={charge} />

      {dialog && <QtyDialog product={dialog.product} initial={dialog.initial} onConfirm={onConfirm} onClose={() => setDialog(null)} />}
    </div>
  );
}
