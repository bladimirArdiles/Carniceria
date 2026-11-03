import { useMemo, useState } from "react";
import { MagnifyingGlass, Minus, Package, PencilSimple, Plus, Scales, Truck, Warning, X } from "@phosphor-icons/react";
import { useStore } from "../lib/store.jsx";
import { fmtDateTime, getProductCategory, money, num } from "../lib/format.js";
import Badge, { stockLabel, stockTone } from "../components/ui/Badge.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import MovementForm from "../components/stock/MovementForm.jsx";
import ProductForm from "../components/stock/ProductForm.jsx";

const TYPE_CONFIG = {
  compra: { label: "Ingreso / Compra", tone: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" },
  merma: { label: "Merma / Recorte", tone: "bg-red-500/15 text-red-800 dark:text-red-300" },
  ajuste: { label: "Conteo Balanza", tone: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200" },
};

export default function Stock() {
  const { products, movements, addMovement, saveProduct, deleteProduct, notify } = useStore();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [movement, setMovement] = useState(null); // { productId?, type? }
  const [editing, setEditing] = useState(null); // null | "new" | product

  const lowCount = useMemo(() => products.filter((p) => stockTone(p) !== "ok").length, [products]);

  const totalStockValue = useMemo(() => {
    return products.reduce((acc, p) => acc + ((p.stock || 0) * (p.price || 0)), 0);
  }, [products]);

  // Lista de categorías para la barra horizontal
  const categories = useMemo(() => {
    const existing = new Set();
    products.forEach((p) => {
      existing.add(getProductCategory(p));
    });
    const standard = ["Todas", ...(lowCount > 0 ? ["⚠️ Alertas"] : []), "Vaca", "Cerdo", "Pollo", "Achuras", "Embutidos"];
    const extras = Array.from(existing).filter((c) => !standard.includes(c));
    return [...standard, ...extras];
  }, [products, lowCount]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...products]
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (selectedCategory === "⚠️ Alertas") {
          return stockTone(p) !== "ok";
        }
        if (selectedCategory !== "Todas") {
          const cat = getProductCategory(p);
          if (cat.toLowerCase() !== selectedCategory.toLowerCase()) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [products, query, selectedCategory]);

  const recent = [...movements].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Resumen KPI de Stock e Inventario */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Valor total en mostrador</p>
          <p className="font-mono text-2xl font-black tracking-tight mt-1 text-zinc-950 dark:text-zinc-50">
            {money(totalStockValue)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Cortes en catálogo</p>
          <p className="font-mono text-2xl font-black tracking-tight mt-1 text-zinc-950 dark:text-zinc-50">
            {products.length} <span className="text-xs font-normal text-zinc-500">cortes</span>
          </p>
        </div>
        <div
          onClick={() => setSelectedCategory("⚠️ Alertas")}
          className={`card col-span-2 sm:col-span-1 p-4 cursor-pointer transition active:scale-95 ${
            lowCount > 0
              ? "border-amber-400/80 bg-amber-50/50 dark:border-amber-700/50 dark:bg-amber-950/20"
              : ""
          }`}
        >
          <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Alertas de reposición</p>
          <p className={`font-mono text-2xl font-black tracking-tight mt-1 ${lowCount > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"}`}>
            {lowCount > 0 ? `⚠️ ${lowCount} cortes` : "Stock OK ✓"}
          </p>
        </div>
      </div>

      {/* Botones de acción principales */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="btn-primary h-16 text-lg shadow-md"
          onClick={() => setMovement({})}
          disabled={!products.length}
        >
          <Truck size={24} weight="bold" />
          Ingresar stock o registrar merma
        </button>
        <button
          type="button"
          className="btn-ghost h-16 text-lg font-bold"
          onClick={() => setEditing("new")}
        >
          <Plus size={24} weight="bold" />
          Nuevo corte / producto
        </button>
      </div>

      {/* Buscador de corte con botón de limpiar */}
      <div className="relative">
        <MagnifyingGlass
          size={22}
          weight="bold"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-400"
        />
        <input
          className="field pl-12 pr-10"
          type="search"
          placeholder="Buscar corte o producto..."
          aria-label="Buscar producto"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            aria-label="Limpiar búsqueda"
          >
            <X size={16} weight="bold" />
          </button>
        )}
      </div>

      {/* Barra horizontal de categorías */}
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
              className={
                "shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-95 " +
                (active
                  ? "bg-accent-500 text-zinc-950 shadow-md font-extrabold"
                  : "border-2 border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600")
              }
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Listado de cortes y control ergonómico */}
      {!products.length ? (
        <EmptyState icon={Package} title="Sin productos" text="Agregá tu primer corte para empezar a vender." />
      ) : list.length === 0 ? (
        <p className="card text-center font-semibold">
          {selectedCategory === "⚠️ Alertas"
            ? "¡Excelente! No hay cortes con stock crítico ni agotado."
            : "No hay productos que coincidan con la búsqueda."}
        </p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
          {list.map((p) => {
            const tone = stockTone(p);
            const cat = getProductCategory(p);
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-zinc-50/50 dark:hover:bg-zinc-850/50 transition">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold tracking-tight">{p.name}</p>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {cat}
                    </span>
                    {tone !== "ok" && <Badge tone={tone}>{stockLabel[tone]}</Badge>}
                  </div>
                  <p className="mt-1 font-mono text-sm text-zinc-600 dark:text-zinc-400">
                    {money(p.price)} por {p.unit === "kg" ? "kg" : "u"}
                    <span className="mx-1.5 text-zinc-400">•</span>
                    Mínimo: {num(p.minStock)} {p.unit}
                    <span className="mx-1.5 text-zinc-400">•</span>
                    Valor en stock: {money((p.stock || 0) * (p.price || 0))}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-mono text-2xl font-black tracking-tight text-zinc-950 dark:text-zinc-50">
                      {num(p.stock)}{" "}
                      <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                        {p.unit === "kg" ? "kg" : "u"}
                      </span>
                    </p>
                  </div>

                  {/* Botones de acción táctiles y ergonómicos */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title={`Ingresar compra o media res de ${p.name}`}
                      onClick={() => setMovement({ productId: p.id, type: "compra" })}
                      className="flex h-11 items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-95 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <Plus size={16} weight="bold" />
                      <span className="hidden sm:inline">Ingreso</span>
                    </button>
                    <button
                      type="button"
                      title={`Registrar merma o desposte de ${p.name}`}
                      onClick={() => setMovement({ productId: p.id, type: "merma" })}
                      className="flex h-11 items-center gap-1 rounded-xl border border-amber-500/40 bg-amber-50 px-3 text-xs font-bold text-amber-800 transition hover:bg-amber-100 active:scale-95 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300"
                    >
                      <Minus size={16} weight="bold" />
                      <span className="hidden sm:inline">Merma</span>
                    </button>
                    <button
                      type="button"
                      className="btn-icon h-11 w-11"
                      aria-label={`Editar ${p.name}`}
                      title="Editar datos del corte"
                      onClick={() => setEditing(p)}
                    >
                      <PencilSimple size={18} weight="bold" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Historial de últimos movimientos */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Últimos movimientos de stock</h2>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Últimos {recent.length} registros</span>
          </div>

          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 shadow-sm">
            {recent.map((m) => {
              const cfg = TYPE_CONFIG[m.type] || TYPE_CONFIG.ajuste;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold">{m.productName}</p>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${cfg.tone}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                      {fmtDateTime(m.date)}
                      {m.note ? ` • ${m.note}` : ""}
                      {m.cost ? ` • Costo: ${money(m.cost)}` : ""}
                    </p>
                  </div>
                  <p className={"shrink-0 font-mono text-lg font-bold " + (m.delta < 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
                    {m.delta > 0 ? "+" : ""}{num(m.delta)} {m.unit === "kg" ? "kg" : "u"}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {movement && (
        <MovementForm
          products={products}
          productId={movement.productId}
          type={movement.type}
          onClose={() => setMovement(null)}
          onSave={(m) => {
            addMovement(m);
            setMovement(null);
            notify("Movimiento de stock registrado");
          }}
        />
      )}

      {editing && (
        <ProductForm
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            saveProduct(p);
            setEditing(null);
            notify("Corte guardado correctamente");
          }}
          onDelete={(id) => {
            deleteProduct(id);
            setEditing(null);
            notify("Corte eliminado");
          }}
        />
      )}
    </div>
  );
}
