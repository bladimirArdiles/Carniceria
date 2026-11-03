import { useMemo, useState } from "react";
import { ArrowLeft, HandCoins, IdentificationCard, MagnifyingGlass, MapPin, PencilSimple, Phone, Plus, UsersThree, WhatsappLogo, X } from "@phosphor-icons/react";
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

  const cleanPhone = (customer.phone || "").replace(/[^\d]/g, "");
  const waMessage = `Hola ${customer.name}! Te escribimos de la carnicería para recordarte que tenés un saldo pendiente en tu cuenta de ${money(balance)}. Podés pasar a abonarlo en el local o consultarnos por alias para transferencia. ¡Muchas gracias!`;
  const waUrl = `https://wa.me/${cleanPhone.startsWith("54") ? cleanPhone : "549" + cleanPhone}?text=${encodeURIComponent(waMessage)}`;

  return (
    <section className="space-y-5">
      <button type="button" className="btn-ghost h-12 md:hidden" onClick={onBack}>
        <ArrowLeft size={20} weight="bold" />Volver a la lista
      </button>

      <div className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight">{customer.name}</h2>
            {customer.dni && (
              <p className="mt-1 flex items-center gap-2 font-mono text-base text-zinc-700 dark:text-zinc-300">
                <IdentificationCard size={18} weight="bold" />DNI: {customer.dni}
              </p>
            )}
            {customer.phone && (
              <p className="mt-1 flex items-center gap-2 font-mono text-base">
                <Phone size={18} weight="bold" />
                <a href={`tel:${customer.phone}`} className="underline underline-offset-4">{customer.phone}</a>
              </p>
            )}
            {customer.address && (
              <p className="mt-1 flex items-center gap-2 text-base text-zinc-700 dark:text-zinc-300">
                <MapPin size={18} weight="bold" />{customer.address}
              </p>
            )}
          </div>
          <button type="button" className="btn-icon" aria-label="Editar cliente" onClick={onEdit}>
            <PencilSimple size={22} weight="bold" />
          </button>
        </div>

        {/* Tarjeta de estado de cuenta y semáforo de deuda */}
        <div
          className={`rounded-2xl border-2 p-4 transition-all ${
            balance > 25000
              ? "border-red-500/40 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/30"
              : balance > 0
              ? "border-amber-500/40 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/30"
              : "border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
              Saldo adeudado
            </p>
            {balance > 25000 && (
              <span className="rounded-lg bg-red-600 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
                Deuda alta
              </span>
            )}
          </div>
          <p className="font-mono text-4xl font-extrabold tracking-tight mt-1">
            {money(Math.max(balance, 0))}
          </p>
          {balance < 0 && (
            <p className="mt-1 text-sm font-bold text-sky-700 dark:text-sky-300">
              Saldo a favor del cliente: {money(-balance)}
            </p>
          )}
          {balance === 0 && (
            <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Cuenta al día sin saldos pendientes.
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            className="btn-primary h-16 flex-1 text-lg shadow-md"
            disabled={balance <= 0}
            onClick={onPay}
          >
            <HandCoins size={24} weight="bold" />
            Registrar pago
          </button>
          <ConfirmButton
            className="!h-16"
            label="Eliminar cliente"
            disabled={balance > 0}
            onConfirm={onDelete}
          />
        </div>

        {/* Botón directo de recordatorio por WhatsApp */}
        {balance > 0 && customer.phone ? (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50 px-4 text-sm font-bold text-emerald-800 transition hover:bg-emerald-100 active:scale-95 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
          >
            <WhatsappLogo size={22} weight="bold" />
            Recordar saldo por WhatsApp
          </a>
        ) : balance > 0 ? (
          <p className="text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
            💡 Podés editar al cliente para cargar su teléfono y enviarle recordatorios de cobro por WhatsApp.
          </p>
        ) : null}

        {balance > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Para eliminar al cliente primero cancelá su deuda.
          </p>
        )}
      </div>

      <h3 className="text-lg font-bold tracking-tight">Historial de Compras y Pagos</h3>
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
                  <p className="font-bold text-emerald-700 dark:text-emerald-400">Pago recibido ({h.data.method})</p>
                )}
                <p className="text-sm text-zinc-700 dark:text-zinc-300">{fmtDateTime(h.date)}</p>
              </div>
              <p className={"shrink-0 font-mono text-lg font-bold " + (h.kind === "payment" ? "text-emerald-700 dark:text-emerald-400" : "")}>
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
  const [filterTab, setFilterTab] = useState("all"); // "all" | "debt" | "clean"
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null); // null | "new" | customer
  const [payingCustomer, setPayingCustomer] = useState(null); // null | customer

  const debtorCount = useMemo(() => {
    return customers.filter((c) => (balances[c.id] || 0) > 0).length;
  }, [customers, balances]);

  const cleanCount = useMemo(() => {
    return customers.filter((c) => (balances[c.id] || 0) <= 0).length;
  }, [customers, balances]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...customers]
      .filter((c) => {
        const bal = balances[c.id] || 0;
        if (filterTab === "debt" && bal <= 0) return false;
        if (filterTab === "clean" && bal > 0) return false;
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.dni && c.dni.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (balances[b.id] || 0) - (balances[a.id] || 0) || a.name.localeCompare(b.name, "es"));
  }, [customers, query, balances, filterTab]);

  const selected = customers.find((c) => c.id === selectedId);
  const owed = Object.values(balances).reduce((a, b) => a + Math.max(0, b), 0);

  return (
    <div className="grid gap-6 md:grid-cols-[22rem_minmax(0,1fr)]">
      <section className={"space-y-4 " + (selected ? "hidden md:block" : "")}>
        {/* Métricas destacadas de cuentas corrientes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Total en fiados</p>
            <p className="font-mono text-2xl font-black tracking-tight mt-1 text-zinc-950 dark:text-zinc-50">{money(owed)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Con deuda activa</p>
            <p className="font-mono text-2xl font-black tracking-tight mt-1 text-amber-700 dark:text-amber-400">
              {debtorCount} <span className="text-xs font-normal text-zinc-500">/ {customers.length}</span>
            </p>
          </div>
        </div>

        <button type="button" className="btn-primary h-16 w-full text-lg shadow-md" onClick={() => setForm("new")}>
          <Plus size={24} weight="bold" />Nuevo cliente
        </button>

        {/* Buscador de cliente con botón de limpiar */}
        <div className="relative">
          <MagnifyingGlass size={22} weight="bold" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 dark:text-zinc-400" />
          <input
            className="field pl-12 pr-10"
            type="search"
            placeholder="Buscar por nombre, DNI o teléfono"
            aria-label="Buscar cliente"
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

        {/* Selector de pestañas: Todos / Con deuda / Al día */}
        <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Filtrar por estado de deuda">
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === "all"}
            onClick={() => setFilterTab("all")}
            className={"rounded-2xl py-2 px-1 text-xs font-bold border-2 transition active:scale-95 text-center " +
              (filterTab === "all"
                ? "border-accent-500 bg-accent-400/20 text-zinc-950 dark:text-zinc-50 font-extrabold"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400")}
          >
            Todos ({customers.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === "debt"}
            onClick={() => setFilterTab("debt")}
            className={"rounded-2xl py-2 px-1 text-xs font-bold border-2 transition active:scale-95 text-center " +
              (filterTab === "debt"
                ? "border-amber-500 bg-amber-500 text-zinc-950 font-extrabold shadow-sm"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-amber-700 dark:text-amber-400 hover:border-amber-400")}
          >
            Con deuda ({debtorCount})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filterTab === "clean"}
            onClick={() => setFilterTab("clean")}
            className={"rounded-2xl py-2 px-1 text-xs font-bold border-2 transition active:scale-95 text-center " +
              (filterTab === "clean"
                ? "border-emerald-500 bg-emerald-500 text-zinc-950 font-extrabold shadow-sm"
                : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900 text-emerald-700 dark:text-emerald-400 hover:border-emerald-400")}
          >
            Al día ({cleanCount})
          </button>
        </div>

        {customers.length === 0 ? (
          <EmptyState icon={UsersThree} title="Sin clientes" text="Cargá a tus clientes de confianza para anotar fiados y ver su historial." />
        ) : list.length === 0 ? (
          <p className="card text-center font-semibold">
            {filterTab === "debt"
              ? "No hay clientes con saldo pendiente."
              : filterTab === "clean"
              ? "No hay clientes al día."
              : "Nadie coincide con la búsqueda."}
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((c) => {
              const b = balances[c.id] || 0;
              const on = c.id === selectedId;
              return (
                <li key={c.id}>
                  <div
                    onClick={() => setSelectedId(c.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedId(c.id)}
                    className={"flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border-2 p-3.5 text-left transition cursor-pointer active:scale-[0.98] " +
                      (on ? "border-accent-500 bg-accent-400/15" : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600")}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold">{c.name}</p>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {c.dni && <span className="font-mono">DNI: {c.dni}</span>}
                        {c.phone && <span className="font-mono">{c.phone}</span>}
                      </div>
                    </div>

                    {/* Semáforo de saldo y botón de cobro rápido */}
                    <div className="flex items-center gap-2 shrink-0">
                      {b > 0 ? (
                        <>
                          <Badge
                            tone="debt"
                            className={
                              b > 25000
                                ? "font-extrabold !border-red-500 !text-red-700 dark:!text-red-400 !bg-red-50 dark:!bg-red-950/40"
                                : ""
                            }
                          >
                            {b > 25000 ? `⚠️ ${money(b)}` : money(b)}
                          </Badge>
                          <button
                            type="button"
                            title={`Cobrar fiado a ${c.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayingCustomer(c);
                            }}
                            className="btn-icon h-9 w-9 text-accent-700 hover:bg-accent-500/20 active:scale-90 dark:text-accent-400"
                          >
                            <HandCoins size={19} weight="bold" />
                          </button>
                        </>
                      ) : b === 0 ? (
                        <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          Al día
                        </span>
                      ) : (
                        <span className="rounded-lg bg-sky-500/10 px-2 py-1 text-xs font-bold text-sky-700 dark:text-sky-400">
                          A favor {money(-b)}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Detalle del cliente seleccionado */}
      <div className={selected ? "" : "hidden md:block"}>
        {selected ? (
          <Detail
            customer={selected}
            balance={balances[selected.id] || 0}
            sales={sales}
            payments={payments}
            onBack={() => setSelectedId(null)}
            onEdit={() => setForm(selected)}
            onPay={() => setPayingCustomer(selected)}
            onDelete={() => {
              deleteCustomer(selected.id);
              setSelectedId(null);
              notify("Cliente eliminado");
            }}
          />
        ) : (
          <EmptyState
            icon={UsersThree}
            title="Elegí un cliente"
            text="Vas a ver su saldo deudor, historial de compras, pagos y enviar recordatorios por WhatsApp."
          />
        )}
      </div>

      {form && (
        <CustomerForm
          customer={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSave={(c) => {
            saveCustomer(c);
            setForm(null);
            setSelectedId(c.id);
            notify("Cliente guardado");
          }}
        />
      )}

      {payingCustomer && (
        <PaymentForm
          customer={payingCustomer}
          balance={balances[payingCustomer.id] || 0}
          onClose={() => setPayingCustomer(null)}
          onSave={(p) => {
            addPayment(p);
            setPayingCustomer(null);
            notify(`Pago registrado: ${money(p.amount)}`);
          }}
        />
      )}
    </div>
  );
}
