import { useEffect, useMemo, useRef, useState } from "react";
import { Bank, CreditCard, HandCoins, MagnifyingGlass, Money, Receipt, Trash, User, X } from "@phosphor-icons/react";
import Segmented from "../ui/Segmented.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { money, qtyText } from "../../lib/format.js";

export default function Ticket({ lines, customers, balances, customerId, setCustomerId, method, setMethod, onEdit, onRemove, onClear, onCharge }) {
  const [tendered, setTendered] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const comboboxRef = useRef(null);

  const total = lines.reduce((s, l) => s + l.total, 0);
  const given = parseFloat(String(tendered).replace(",", ".")) || 0;
  const change = given - total;

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const customerBalance = selectedCustomer ? (balances[selectedCustomer.id] || 0) : 0;

  const changeCustomer = (id) => {
    setCustomerId(id);
    if (!id && method === "Fiado") setMethod("Efectivo");
  };

  const charge = () => {
    onCharge({
      tendered: given > 0 ? given : total,
      change: Math.max(0, change),
    });
    setTendered("");
    setCustomerQuery("");
  };

  // Cierra el combobox al hacer clic afuera
  useEffect(() => {
    const handleOutside = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const filteredCustomersList = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          (c.dni && c.dni.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q))
        );
      })
      .slice(0, 10);
  }, [customers, customerQuery]);

  return (
    <section aria-label="Ticket de venta" className="card flex flex-col gap-5 md:sticky md:top-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Ticket</h2>
        {lines.length > 0 && (
          <button type="button" onClick={onClear} className="inline-flex h-11 items-center gap-2 rounded-2xl px-3 text-sm font-bold text-zinc-800 hover:bg-zinc-100 active:scale-95 dark:text-zinc-200 dark:hover:bg-zinc-800">
            <Trash size={18} weight="bold" />Vaciar
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <EmptyState icon={Receipt} title="Ticket vacío" text="Toca un producto para empezar la venta." />
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {lines.map((l) => (
            <li key={l.productId} className="flex items-center gap-2 py-2">
              <button type="button" onClick={() => onEdit(l)} className="min-h-14 min-w-0 flex-1 rounded-2xl px-2 text-left transition active:scale-[0.98] hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label={`Cambiar cantidad de ${l.name}`}>
                <p className="truncate font-bold">{l.name}</p>
                <p className="font-mono text-sm text-zinc-700 dark:text-zinc-300">{qtyText(l.qty, l.unit)} x {money(l.price)}</p>
              </button>
              <p className="font-mono text-lg font-bold">{money(l.total)}</p>
              <button type="button" className="btn-icon" aria-label={`Quitar ${l.name}`} onClick={() => onRemove(l.productId)}>
                <X size={20} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Combobox Unificado de Cliente (Ley de Jakob y Fitts) */}
      <div ref={comboboxRef} className="space-y-2">
        <label className="label mb-0" htmlFor="customer-combobox">Cliente</label>

        {selectedCustomer ? (
          /* Tarjeta de cliente seleccionado */
          <div className="rounded-2xl border-2 border-accent-400/50 bg-accent-400/10 p-3.5 dark:border-accent-500/30 dark:bg-accent-950/20">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <User size={18} weight="bold" className="text-accent-700 dark:text-accent-400" />
                  <p className="truncate text-base font-bold text-zinc-950 dark:text-zinc-50">
                    {selectedCustomer.name}
                  </p>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                  {selectedCustomer.dni && <span>DNI: {selectedCustomer.dni}</span>}
                  {selectedCustomer.phone && <span>Tel: {selectedCustomer.phone}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => changeCustomer("")}
                className="btn-icon size-9 rounded-xl text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                title="Cambiar cliente"
                aria-label="Quitar cliente seleccionado"
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            {/* Aviso de deuda pendiente */}
            {customerBalance > 0 && (
              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <span>Saldo adeudado:</span>
                <span className="font-mono text-sm">{money(customerBalance)}</span>
              </div>
            )}
          </div>
        ) : (
          /* Input de búsqueda rápida con lista flotante */
          <div className="relative">
            <div className="relative">
              <MagnifyingGlass size={18} weight="bold" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                id="customer-combobox"
                type="search"
                placeholder="Buscar cliente por nombre o DNI..."
                value={customerQuery}
                onChange={(e) => {
                  setCustomerQuery(e.target.value);
                  setIsCustomerDropdownOpen(true);
                }}
                onFocus={() => setIsCustomerDropdownOpen(true)}
                className="field h-12 pl-10 pr-9 text-sm"
                autoComplete="off"
              />
              {customerQuery && (
                <button
                  type="button"
                  onClick={() => setCustomerQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  aria-label="Borrar texto de cliente"
                >
                  <X size={15} weight="bold" />
                </button>
              )}
            </div>

            {/* Menú flotante interactivo */}
            {isCustomerDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    changeCustomer("");
                    setIsCustomerDropdownOpen(false);
                    setCustomerQuery("");
                  }}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  <span>Cliente general / Mostrador</span>
                </button>

                {filteredCustomersList.map((c) => {
                  const debt = balances[c.id] || 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        changeCustomer(c.id);
                        setIsCustomerDropdownOpen(false);
                        setCustomerQuery("");
                      }}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-accent-400/15"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-sm font-bold text-zinc-950 dark:text-zinc-50">{c.name}</p>
                        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
                          {c.dni ? `DNI: ${c.dni}` : ""}{c.dni && c.phone ? " · " : ""}{c.phone || ""}
                        </p>
                      </div>
                      {debt > 0 && (
                        <span className="shrink-0 rounded-lg bg-amber-100 px-2 py-0.5 font-mono text-xs font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          Debe {money(debt)}
                        </span>
                      )}
                    </button>
                  );
                })}

                {filteredCustomersList.length === 0 && (
                  <p className="px-3 py-2 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    No hay clientes con "{customerQuery}"
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Segmented label="Forma de pago" cols={2} value={method} onChange={setMethod} options={[
        { value: "Efectivo", label: "Efectivo", icon: Money },
        { value: "Transferencia", label: "Transfer.", icon: Bank },
        { value: "Tarjeta", label: "Tarjeta", icon: CreditCard },
        { value: "Fiado", label: customerId ? "Fiado" : "Fiado (elegí cliente)", icon: HandCoins, disabled: !customerId },
      ]} />

      {/* Proyección de deuda para ventas fiadas */}
      {method === "Fiado" && customerId && total > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-3 text-xs dark:border-amber-900/60 dark:bg-amber-950/30">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Saldo anterior: <span className="font-mono font-bold">{money(customerBalance)}</span> + Esta compra: <span className="font-mono font-bold">{money(total)}</span>
          </p>
          <p className="mt-1 font-bold text-amber-950 dark:text-amber-100">
            Nuevo saldo adeudado: <span className="font-mono text-sm">{money(customerBalance + total)}</span>
          </p>
        </div>
      )}

      {method === "Efectivo" && lines.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="label mb-0" htmlFor="tendered">Paga con</label>
            {tendered && (
              <button
                type="button"
                onClick={() => setTendered("")}
                className="text-xs font-semibold text-accent-700 hover:underline dark:text-accent-400"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="relative">
            <input
              id="tendered"
              className="field font-mono text-xl font-bold"
              inputMode="decimal"
              placeholder={`Ej: ${total || "0"}`}
              value={tendered}
              onChange={(e) => setTendered(e.target.value.replace(/[^\d.,]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && lines.length > 0) {
                  e.preventDefault();
                  charge();
                }
              }}
            />
          </div>

          {/* Atajos de billetes rápidos (Ley de Fitts) */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => setTendered(String(total))}
              className={`rounded-xl py-2 px-1 text-center font-mono text-xs font-bold transition active:scale-95 ${
                given === total
                  ? "bg-accent-500 text-zinc-950 font-extrabold shadow-sm"
                  : "border border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              Exacto
            </button>
            {[5000, 10000, 20000].map((bill) => (
              <button
                key={bill}
                type="button"
                onClick={() => setTendered(String(bill))}
                className={`rounded-xl py-2 px-1 text-center font-mono text-xs font-bold transition active:scale-95 ${
                  given === bill
                    ? "bg-accent-500 text-zinc-950 font-extrabold shadow-sm"
                    : "border border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                ${bill >= 1000 ? `${bill / 1000}k` : bill}
              </button>
            ))}
          </div>

          {/* Visor de vuelto gigante de alta visibilidad */}
          {given > 0 && (
            <div
              className={`rounded-2xl border-2 p-3 text-center transition-all ${
                change < 0
                  ? "border-red-400 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                  : "border-emerald-500/40 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-100"
              }`}
            >
              <span className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                {change < 0 ? "Faltan para completar el pago" : "Vuelto al cliente"}
              </span>
              <span className="mt-0.5 block font-mono text-3xl font-black tracking-tight">
                {change < 0 ? money(-change) : money(change)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-lg font-bold">Total</span>
          <span className="font-mono text-4xl font-bold tracking-tight">{money(total)}</span>
        </div>
        <button
          type="button"
          id="btn-cobrar"
          className="btn-primary h-20 w-full text-xl shadow-md flex items-center justify-center gap-2"
          disabled={!lines.length}
          onClick={charge}
        >
          <span>{method === "Fiado" ? "Anotar en cuenta" : "Cobrar"} {total > 0 && money(total)}</span>
          <kbd className="hidden lg:inline-flex items-center rounded-lg bg-zinc-950/20 px-2 py-0.5 text-xs font-mono font-bold text-zinc-950">
            F2
          </kbd>
        </button>
      </div>
    </section>
  );
}
