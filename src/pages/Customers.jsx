import { useMemo, useState } from "react";
import { ArrowLeft, HandCoins, IdentificationCard, MagnifyingGlass, MapPin, PencilSimple, Phone, Plus, UsersThree } from "@phosphor-icons/react";
import { useStore } from "../lib/store.jsx";
import { fmtDateTime, money, qtyText } from "../lib/format.js";
import Badge from "../components/ui/Badge.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import ConfirmButton from "../components/ui/ConfirmButton.jsx";
import CustomerForm from "../components/customers/CustomerForm.jsx";
import PaymentForm from "../components/customers/PaymentForm.jsx";

function Detail({ customer, balance, sales, payments, onBack, onEdit, onPay, onDelete }) {
  const history = useMemo(() => {
    const s = sales.filter((x) => x.customerId === customer.id).map((x) => ({ kind: "sale", date: x.date, data: x }));
    const p = payments.filter((x) => x.customerId === customer.id).map((x) => ({ kind: "payment", date: x.date, data: x }));
    return [...s, ...p].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [sales, payments, customer.id]);

  return (
    <section className="space-y-5">
      <button type="button" className="btn-ghost h-12 md:hidden" onClick={onBack}><ArrowLeft size={20} weight="bold" />Volver</button>

      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight">{customer.name}</h2>
            {customer.dni && <p className="mt-1 flex items-center gap-2 font-mono text-base text-zinc-700 dark:text-zinc-300"><IdentificationCard size={18} weight="bold" />DNI: {customer.dni}</p>}
            {customer.phone && <p className="mt-1 flex items-center gap-2 font-mono text-base"><Phone size={18} weight="bold" /><a href={`tel:${customer.phone}`} className="underline underline-offset-4">{customer.phone}</a></p>}
            {customer.address && <p className="mt-1 flex items-center gap-2 text-base"><MapPin size={18} weight="bold" />{customer.address}</p>}
          </div>
          <button type="button" className="btn-icon" aria-label="Editar cliente" onClick={onEdit}><PencilSimple size={22} weight="bold" /></button>
        </div>

        <div className="rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Saldo pendiente</p>
          <p className="font-mono text-4xl font-bold tracking-tight">{money(Math.max(balance, 0))}</p>
          {balance < 0 && <p className="mt-1 text-sm font-semibold">Saldo a favor: {money(-balance)}</p>}
        </div>

        <div className="flex gap-3">
          <button type="button" className="btn-primary h-16 flex-1 text-lg" disabled={balance <= 0} onClick={onPay}>
            <HandCoins size={24} weight="bold" />Registrar pago
          </button>
          <ConfirmButton className="!h-16" label="Eliminar cliente" disabled={balance > 0} onConfirm={onDelete} />
        </div>
        {balance > 0 && <p className="text-sm text-zinc-700 dark:text-zinc-300">Para eliminar al cliente primero cancelá su deuda.</p>}
      </div>

      <h3 className="text-lg font-bold tracking-tight">Historial</h3>
      {history.length === 0 ? (
        <p className="card text-center font-semibold">Este cliente todavía no tiene movimientos.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {history.map((h) => (
            <li key={h.data.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                {h.kind === "sale" ? (
                  <>
                    <p className="font-bold">Compra ({h.data.method})</p>
                    <p className="text-sm text-zinc-700 dark:text-zinc-300">{h.data.items.map((i) => `${i.name} ${qtyText(i.qty, i.unit)}`).join(", ")}</p>
                  </>
                ) : (
                  <p className="font-bold">Pago recibido ({h.data.method})</p>
                )}
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{fmtDateTime(h.date)}</p>
              </div>
              <p className="shrink-0 font-mono text-lg font-bold">
                {h.kind === "payment" ? "-" : h.data.method === "Fiado" ? "+" : ""}{money(h.kind === "sale" ? h.data.total : h.data.amount)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Customers() {
  const { customers, balances, sales, payments, saveCustomer, deleteCustomer, addPayment, notify } = useStore();
  const [query, setQuery] = useState("");
  const [onlyDebtors, setOnlyDebtors] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null); // null | "new" | customer
  const [paying, setPaying] = useState(false);

  const debtorCount = useMemo(() => {
    return customers.filter((c) => (balances[c.id] || 0) > 0).length;
  }, [customers, balances]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...customers]
      .filter((c) => {
        if (onlyDebtors && !((balances[c.id] || 0) > 0)) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.dni && c.dni.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (balances[b.id] || 0) - (balances[a.id] || 0) || a.name.localeCompare(b.name, "es"));
  }, [customers, query, balances, onlyDebtors]);

  const selected = customers.find((c) => c.id === selectedId);
  const owed = Object.values(balances).reduce((a, b) => a + Math.max(0, b), 0);

  return (
    <div className="grid gap-6 md:grid-cols-[22rem_minmax(0,1fr)]">
      <section className={"space-y-4 " + (selected ? "hidden md:block" : "")}>
        <div className="card">
          <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Total en cuentas corrientes</p>
          <p className="font-mono text-3xl font-bold tracking-tight">{money(owed)}</p>
        </div>
        <button type="button" className="btn-primary h-16 w-full text-lg" onClick={() => setForm("new")}><Plus size={24} weight="bold" />Nuevo cliente</button>
        <div className="relative">
          <MagnifyingGlass size={22} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-400" />
          <input className="field pl-12" type="search" placeholder="Buscar por nombre, DNI o teléfono" aria-label="Buscar cliente" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOnlyDebtors(false)}
            className={"flex-1 rounded-2xl py-2.5 px-3 text-sm font-bold border-2 transition active:scale-[0.98] " +
              (!onlyDebtors
                ? "border-accent-500 bg-accent-400/20 text-zinc-950 dark:text-zinc-50"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400")}
          >
            Todos ({customers.length})
          </button>
          <button
            type="button"
            onClick={() => setOnlyDebtors(true)}
            className={"flex-1 rounded-2xl py-2.5 px-3 text-sm font-bold border-2 transition active:scale-[0.98] " +
              (onlyDebtors
                ? "border-amber-500 bg-amber-500 text-zinc-950 font-extrabold shadow-sm"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-amber-700 dark:text-amber-400 hover:border-amber-400")}
          >
            Con deuda ({debtorCount})
          </button>
        </div>

        {customers.length === 0 ? (
          <EmptyState icon={UsersThree} title="Sin clientes" text="Cargá a tus clientes de confianza para anotar fiados y ver su historial." />
        ) : list.length === 0 ? (
          <p className="card text-center font-semibold">
            {onlyDebtors ? "No hay clientes con saldo pendiente." : "Nadie coincide con la búsqueda."}
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((c) => {
              const b = balances[c.id] || 0;
              const on = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button type="button" onClick={() => setSelectedId(c.id)} aria-current={on ? "true" : undefined}
                    className={"flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border-2 p-4 text-left transition active:scale-[0.98] " +
                      (on ? "border-accent-500 bg-accent-400/15" : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600")}>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold">{c.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {c.dni && <span className="font-mono">DNI: {c.dni}</span>}
                        {c.phone && <span className="font-mono">{c.phone}</span>}
                      </div>
                    </div>
                    {b > 0 ? <Badge tone="debt">{money(b)}</Badge> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className={selected ? "" : "hidden md:block"}>
        {selected ? (
          <Detail customer={selected} balance={balances[selected.id] || 0} sales={sales} payments={payments}
            onBack={() => setSelectedId(null)} onEdit={() => setForm(selected)} onPay={() => setPaying(true)}
            onDelete={() => { deleteCustomer(selected.id); setSelectedId(null); notify("Cliente eliminado"); }} />
        ) : (
          <EmptyState icon={UsersThree} title="Elegí un cliente" text="Vas a ver su saldo, sus compras y podés registrar pagos." />
        )}
      </div>

      {form && <CustomerForm customer={form === "new" ? null : form} onClose={() => setForm(null)}
        onSave={(c) => { saveCustomer(c); setForm(null); setSelectedId(c.id); notify("Cliente guardado"); }} />}
      {paying && selected && <PaymentForm customer={selected} balance={balances[selected.id] || 0} onClose={() => setPaying(false)}
        onSave={(p) => { addPayment(p); setPaying(false); notify(`Pago registrado: ${money(p.amount)}`); }} />}
    </div>
  );
}
