import { useMemo, useState } from "react";
import { Bank, CreditCard, HandCoins, IdentificationCard, Money, Receipt, Trash, X } from "@phosphor-icons/react";
import Segmented from "../ui/Segmented.jsx";
import EmptyState from "../ui/EmptyState.jsx";
import { money, qtyText } from "../../lib/format.js";

export default function Ticket({ lines, customers, balances, customerId, setCustomerId, method, setMethod, onEdit, onRemove, onClear, onCharge }) {
  const [tendered, setTendered] = useState("");
  const [dniFilter, setDniFilter] = useState("");
  const total = lines.reduce((s, l) => s + l.total, 0);
  const given = parseFloat(String(tendered).replace(",", ".")) || 0;
  const change = given - total;

  const changeCustomer = (id) => {
    setCustomerId(id);
    if (!id && method === "Fiado") setMethod("Efectivo");
  };

  const charge = () => {
    onCharge();
    setTendered("");
    setDniFilter("");
  };

  const filteredCustomers = useMemo(() => {
    const q = dniFilter.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => (c.dni && c.dni.toLowerCase().includes(q)) || c.id === customerId);
  }, [customers, dniFilter, customerId]);

  const handleDniChange = (val) => {
    setDniFilter(val);
    const q = val.trim();
    if (q) {
      // Si hay coincidencia exacta o coincidencia única, lo selecciona automáticamente
      const exact = customers.find((c) => c.dni && c.dni.toLowerCase() === q.toLowerCase());
      if (exact) {
        changeCustomer(exact.id);
      } else {
        const matches = customers.filter((c) => c.dni && c.dni.toLowerCase().includes(q.toLowerCase()));
        if (matches.length === 1) {
          changeCustomer(matches[0].id);
        }
      }
    }
  };

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

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="label mb-0" htmlFor="dni-filter">Cliente</label>
          {dniFilter && (
            <button
              type="button"
              onClick={() => setDniFilter("")}
              className="text-xs font-semibold text-accent-700 hover:underline dark:text-accent-400"
            >
              Limpiar filtro DNI
            </button>
          )}
        </div>

        <div className="relative">
          <IdentificationCard size={20} weight="bold" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
          <input
            id="dni-filter"
            type="search"
            inputMode="numeric"
            placeholder="Filtrar cliente por DNI..."
            aria-label="Filtrar cliente por DNI"
            className="field pl-10 pr-9 font-mono text-sm"
            value={dniFilter}
            onChange={(e) => handleDniChange(e.target.value)}
          />
          {dniFilter && (
            <button
              type="button"
              onClick={() => setDniFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 dark:text-zinc-400"
              aria-label="Borrar búsqueda DNI"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>

        <select id="customer" className="field" value={customerId} onChange={(e) => changeCustomer(e.target.value)}>
          <option value="">Cliente general / Mostrador</option>
          {filteredCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.dni ? ` (DNI: ${c.dni})` : ""}{balances[c.id] > 0 ? ` (debe ${money(balances[c.id])})` : ""}
            </option>
          ))}
        </select>

        {dniFilter.trim() && filteredCustomers.filter((c) => c.dni && c.dni.toLowerCase().includes(dniFilter.trim().toLowerCase())).length === 0 && (
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            No se encontraron clientes con el DNI "{dniFilter}".
          </p>
        )}
      </div>

      <Segmented label="Forma de pago" cols={2} value={method} onChange={setMethod} options={[
        { value: "Efectivo", label: "Efectivo", icon: Money },
        { value: "Transferencia", label: "Transfer.", icon: Bank },
        { value: "Tarjeta", label: "Tarjeta", icon: CreditCard },
        { value: "Fiado", label: customerId ? "Fiado" : "Fiado (elegí cliente)", icon: HandCoins, disabled: !customerId },
      ]} />

      {method === "Efectivo" && lines.length > 0 && (
        <div>
          <label className="label" htmlFor="tendered">Paga con (opcional)</label>
          <input id="tendered" className="field font-mono text-lg font-semibold" inputMode="decimal" placeholder="0" value={tendered}
            onChange={(e) => setTendered(e.target.value.replace(/[^\d.,]/g, ""))} />
          {given > 0 && (
            <p className={"mt-2 font-mono text-lg font-bold " + (change < 0 ? "text-red-700 dark:text-red-400" : "")}>
              {change < 0 ? `Faltan ${money(-change)}` : `Vuelto: ${money(change)}`}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-lg font-bold">Total</span>
          <span className="font-mono text-4xl font-bold tracking-tight">{money(total)}</span>
        </div>
        <button type="button" className="btn-primary h-20 w-full text-xl" disabled={!lines.length} onClick={charge}>
          {method === "Fiado" ? "Anotar en cuenta" : "Cobrar"} {total > 0 && money(total)}
        </button>
      </div>
    </section>
  );
}
