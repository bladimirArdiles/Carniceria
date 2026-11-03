import { useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, MagnifyingGlass, Receipt, X } from "@phosphor-icons/react";
import { useStore } from "../lib/store.jsx";
import { DEFAULT_CATEGORIES, lineTotal, money, num } from "../lib/format.js";
import Badge, { stockLabel, stockTone } from "../components/ui/Badge.jsx";
import Modal from "../components/ui/Modal.jsx";
import QtyDialog from "../components/pos/QtyDialog.jsx";
import Ticket from "../components/pos/Ticket.jsx";
import ReceiptModal from "../components/pos/ReceiptModal.jsx";

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
  const { products, customers, balances, sales, completeSale, notify } = useStore();
  const [lines, setLines] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("⭐ Frecuentes");
  const [dialog, setDialog] = useState(null); // { product, initial }
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState("Efectivo");
  const [completedSale, setCompletedSale] = useState(null);

  // Estados de Fase 3: Atajos de teclado y experiencia mobile
  const searchInputRef = useRef(null);
  const [isMobileTicketOpen, setIsMobileTicketOpen] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Cortes frecuentes / más vendidos (calculados dinámicamente o cortes clave)
  const frequentProductIds = useMemo(() => {
    const counts = {};
    (sales || []).forEach((s) => {
      s.items?.forEach((item) => {
        counts[item.productId] = (counts[item.productId] || 0) + item.qty;
      });
    });
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    const defaults = ["p-asado", "p-picada", "p-vacio", "p-pollo", "p-chorizo", "p-bife"];
    const merged = Array.from(new Set([...sorted, ...defaults]));
    return new Set(merged.slice(0, 6));
  }, [sales]);

  // Lista de categorías: "⭐ Frecuentes" primero, luego "Todas", "Vaca", "Cerdo", etc.
  const categories = useMemo(() => {
    const existing = new Set();
    products.forEach((p) => {
      existing.add(getProductCategory(p));
    });
    const standard = ["⭐ Frecuentes", "Todas", "Vaca", "Cerdo", "Pollo", "Achuras", "Embutidos"];
    const extras = Array.from(existing).filter((c) => !standard.includes(c));
    return [...standard, ...extras];
  }, [products]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...products]
      .filter((p) => {
        if (q && !p.name.toLowerCase().includes(q)) return false;
        if (selectedCategory === "⭐ Frecuentes") {
          return frequentProductIds.has(p.id);
        }
        if (selectedCategory !== "Todas") {
          const cat = getProductCategory(p);
          if (cat.toLowerCase() !== selectedCategory.toLowerCase()) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (selectedCategory === "⭐ Frecuentes") return 0;
        return a.name.localeCompare(b.name, "es");
      });
  }, [products, query, selectedCategory, frequentProductIds]);

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

  const charge = ({ tendered, change } = {}) => {
    const sale = completeSale({ items: lines, customerId, method });
    const customer = customers.find((c) => c.id === customerId);
    setCompletedSale({
      ...sale,
      customer,
      tendered: tendered || sale.total,
      change: change || 0,
      newBalance: customerId
        ? (balances[customerId] || 0) + (method === "Fiado" ? sale.total : 0)
        : 0,
    });
    setLines([]);
    setCustomerId("");
    setMethod("Efectivo");
    setIsMobileTicketOpen(false);
  };

  // Atajos de teclado globales (F4/Slash para búsqueda, F2 para cobro, Escape)
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT");

      // F4 o '/' para buscar producto rápidamente
      if (e.key === "F4" || (!isInputFocused && e.key === "/" && !dialog && !completedSale && !showShortcutsModal)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // F2 para ir al cobro o abrir ticket mobile
      if (e.key === "F2") {
        e.preventDefault();
        if (lines.length > 0) {
          if (window.innerWidth < 768) {
            setIsMobileTicketOpen(true);
          } else {
            const tenderedInput = document.getElementById("tendered");
            if (tenderedInput) {
              tenderedInput.focus();
              tenderedInput.select();
            } else {
              document.getElementById("btn-cobrar")?.focus();
            }
          }
        }
        return;
      }

      // Escape para cerrar ticket mobile, modal de atajos o limpiar búsqueda
      if (e.key === "Escape") {
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (isMobileTicketOpen) {
          setIsMobileTicketOpen(false);
        } else if (query) {
          setQuery("");
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, [dialog, completedSale, showShortcutsModal, isMobileTicketOpen, query, lines.length]);

  const ticketTotal = useMemo(() => lines.reduce((s, l) => s + l.total, 0), [lines]);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
      <section aria-label="Productos" className="space-y-4">
        {/* Buscador de producto y botón de atajos */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={22}
              weight="bold"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-400"
            />
            <input
              ref={searchInputRef}
              className="field pl-12 pr-10"
              type="search"
              placeholder="Buscar producto o corte... (o presiona /)"
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
          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white px-3.5 text-xs font-bold text-zinc-700 transition hover:border-zinc-400 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600"
            title="Ver atajos de teclado (F2, F4, Esc)"
          >
            <Keyboard size={18} weight="bold" />
            <span className="hidden sm:inline">Atajos</span>
          </button>
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
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {catName}
                      </span>
                      {frequentProductIds.has(p.id) && (
                        <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700 dark:text-amber-400">
                          ⭐ Más pedido
                        </span>
                      )}
                    </div>
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

      {/* Ticket en Desktop (columna lateral derecha fijada) */}
      <aside className="hidden md:block">
        <Ticket
          lines={lines}
          customers={customers}
          balances={balances}
          customerId={customerId}
          setCustomerId={setCustomerId}
          method={method}
          setMethod={setMethod}
          onEdit={(l) =>
            setDialog({
              product: products.find((p) => p.id === l.productId) || {
                id: l.productId,
                name: l.name,
                unit: l.unit,
                price: l.price,
                stock: 0,
              },
              initial: l.qty,
              replace: true,
            })
          }
          onRemove={(id) => setLines((p) => p.filter((l) => l.productId !== id))}
          onClear={() => setLines([])}
          onCharge={charge}
        />
      </aside>

      {/* Barra flotante en Mobile cuando hay cortes en el ticket */}
      {lines.length > 0 && !isMobileTicketOpen && (
        <aside
          aria-label="Resumen rápido de ticket móvil"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] inset-x-3 z-20 md:hidden"
        >
          <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-accent-400 bg-zinc-950 p-3.5 text-white shadow-2xl dark:border-accent-500">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="flex h-2 w-2 rounded-full bg-accent-400 animate-pulse" />
                <p className="text-xs font-semibold text-zinc-400">
                  {lines.length} {lines.length === 1 ? "corte" : "cortes"} en ticket
                </p>
              </div>
              <p className="truncate font-mono text-xl font-black text-accent-400">
                {money(ticketTotal)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsMobileTicketOpen(true)}
              className="btn-primary h-12 px-5 text-sm font-extrabold shadow-lg flex items-center gap-2"
            >
              <span>Ver ticket / Cobrar</span>
              <Receipt size={18} weight="bold" />
            </button>
          </div>
        </aside>
      )}

      {/* Modal / Drawer en pantalla completa para Ticket en Mobile */}
      {isMobileTicketOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ticket de venta móvil"
          className="fixed inset-0 z-40 flex flex-col justify-end bg-zinc-950/70 p-0 backdrop-blur-sm md:hidden"
        >
          <div className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl border-t border-zinc-200 bg-white p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={22} weight="bold" className="text-accent-500" />
                <h2 className="text-lg font-black tracking-tight">Ticket de Mostrador</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileTicketOpen(false)}
                className="btn-ghost h-9 px-3 text-xs font-bold flex items-center gap-1.5"
              >
                <X size={16} weight="bold" />
                Seguir pesando
              </button>
            </div>

            <Ticket
              lines={lines}
              customers={customers}
              balances={balances}
              customerId={customerId}
              setCustomerId={setCustomerId}
              method={method}
              setMethod={setMethod}
              onEdit={(l) => {
                setIsMobileTicketOpen(false);
                setDialog({
                  product: products.find((p) => p.id === l.productId) || {
                    id: l.productId,
                    name: l.name,
                    unit: l.unit,
                    price: l.price,
                    stock: 0,
                  },
                  initial: l.qty,
                  replace: true,
                });
              }}
              onRemove={(id) => setLines((p) => p.filter((l) => l.productId !== id))}
              onClear={() => {
                setLines([]);
                setIsMobileTicketOpen(false);
              }}
              onCharge={charge}
            />
          </div>
        </div>
      )}

      {/* Diálogo de ayuda de Atajos de Teclado */}
      {showShortcutsModal && (
        <Modal title="Atajos de Teclado (Mostrador POS)" onClose={() => setShowShortcutsModal(false)} size="sm">
          <div className="space-y-4">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Diseñado para operar a máxima velocidad con teclado físico, numpad o balanza conectada:
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-zinc-100 p-2.5 dark:bg-zinc-800">
                <span className="text-sm font-semibold">Buscar corte</span>
                <div className="flex items-center gap-1">
                  <kbd className="rounded-lg border border-zinc-300 bg-white px-2 py-1 font-mono text-xs font-bold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">F4</kbd>
                  <span className="text-xs text-zinc-500">o</span>
                  <kbd className="rounded-lg border border-zinc-300 bg-white px-2 py-1 font-mono text-xs font-bold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">/</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-zinc-100 p-2.5 dark:bg-zinc-800">
                <span className="text-sm font-semibold">Cobrar / Ver ticket</span>
                <kbd className="rounded-lg border border-zinc-300 bg-white px-2 py-1 font-mono text-xs font-bold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">F2</kbd>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-zinc-100 p-2.5 dark:bg-zinc-800">
                <span className="text-sm font-semibold">Confirmar pesaje / corte</span>
                <kbd className="rounded-lg border border-zinc-300 bg-white px-2 py-1 font-mono text-xs font-bold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">Enter ↵</kbd>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-zinc-100 p-2.5 dark:bg-zinc-800">
                <span className="text-sm font-semibold">Cerrar diálogo / Cancelar</span>
                <kbd className="rounded-lg border border-zinc-300 bg-white px-2 py-1 font-mono text-xs font-bold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">Esc</kbd>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-zinc-100 p-2.5 dark:bg-zinc-800">
                <span className="text-sm font-semibold">Teclado numérico / Numpad</span>
                <kbd className="rounded-lg border border-zinc-300 bg-white px-2 py-1 font-mono text-xs font-bold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">0 - 9 / ,</kbd>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowShortcutsModal(false)}
              className="btn-primary mt-2 h-12 w-full text-sm font-bold"
            >
              Entendido
            </button>
          </div>
        </Modal>
      )}

      {dialog && <QtyDialog product={dialog.product} initial={dialog.initial} onConfirm={onConfirm} onClose={() => setDialog(null)} />}
      {completedSale && <ReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)} />}
    </div>
  );
}
