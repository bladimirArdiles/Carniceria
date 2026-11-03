import { useEffect, useState } from "react";
import { CashRegister, ChartBar, Moon, Package, SignOut, Sun, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { StoreProvider, useStore } from "./lib/store.jsx";
import { useStored } from "./lib/storage.js";
import { fmtLongDate } from "./lib/format.js";
import Counter from "./pages/Counter.jsx";
import Stock from "./pages/Stock.jsx";
import Customers from "./pages/Customers.jsx";
import Reports from "./pages/Reports.jsx";
import Login from "./pages/Login.jsx";

const TABS = [
  { id: "counter", label: "Mostrador", title: "Mostrador", icon: CashRegister, Page: Counter },
  { id: "stock", label: "Stock", title: "Stock e inventario", icon: Package, Page: Stock },
  { id: "customers", label: "Clientes", title: "Clientes y fiados", icon: UsersThree, Page: Customers },
  { id: "reports", label: "Reportes", title: "Reportes de venta", icon: ChartBar, Page: Reports },
];

function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div role="status" className="fixed inset-x-4 bottom-28 z-50 mx-auto max-w-md rounded-2xl bg-zinc-950 px-5 py-4 text-center text-base font-bold text-white shadow-lg dark:bg-zinc-50 dark:text-zinc-950 md:bottom-8">
      {toast.message}
    </div>
  );
}

function Shell({ currentUser, onLogout, onToggleTheme, isDark }) {
  const [tab, setTab] = useState("counter");
  const [full, setFull] = useState(false);

  useEffect(() => {
    const h = () => setFull(true);
    window.addEventListener("ca:storage-full", h);
    return () => window.removeEventListener("ca:storage-full", h);
  }, []);

  const current = TABS.find((t) => t.id === tab);
  const Page = current.Page;

  return (
    <div className="min-h-[100dvh] md:pl-24">
      <aside className="fixed inset-y-0 left-0 hidden w-24 flex-col items-center gap-2 border-r border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        {TABS.map(({ id, label, icon: Icon }) => {
          const on = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} aria-current={on ? "page" : undefined}
              className={"flex h-20 w-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition active:scale-95 " + (on ? "bg-accent-400 text-zinc-950" : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800")}>
              <Icon size={28} weight={on ? "fill" : "bold"} />{label}
            </button>
          );
        })}

        <div className="mt-auto flex flex-col items-center gap-2">
          <button
            onClick={onLogout}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="flex h-14 w-[4.5rem] flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold text-zinc-600 transition hover:bg-zinc-100 active:scale-95 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            <SignOut size={22} weight="bold" />
            Salir
          </button>
        </div>
      </aside>

      <div className="mx-auto max-w-7xl px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] md:px-8 md:pb-10">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{current.title}</h1>
            <p className="text-sm font-medium capitalize text-zinc-700 dark:text-zinc-300">{fmtLongDate()}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="capitalize text-zinc-800 dark:text-zinc-200">{currentUser?.username || "Operador"}</span>
            </div>
            <button className="btn-icon" aria-label="Cambiar tema" onClick={onToggleTheme}>
              <Sun size={22} weight="bold" className="hidden dark:block" />
              <Moon size={22} weight="bold" className="dark:hidden" />
            </button>
            <button
              className="btn-icon md:hidden"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              onClick={onLogout}
            >
              <SignOut size={20} weight="bold" />
            </button>
          </div>
        </header>

        {full && (
          <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border-2 border-red-600 bg-red-50 p-4 text-sm font-semibold text-red-900 dark:bg-red-950 dark:text-red-200">
            <WarningCircle size={22} weight="bold" className="shrink-0" />
            <p>El almacenamiento del navegador está lleno. Descargá un respaldo desde Reportes y no sigas cargando datos hasta liberar espacio.</p>
          </div>
        )}

        <main><Page /></main>
      </div>

      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
        <ul className="grid grid-cols-4 gap-1 p-2">
          {TABS.map(({ id, label, icon: Icon }) => {
            const on = tab === id;
            return (
              <li key={id}>
                <button onClick={() => setTab(id)} aria-current={on ? "page" : undefined}
                  className={"flex h-16 w-full flex-col items-center justify-center gap-1 rounded-2xl text-xs font-bold transition active:scale-95 " + (on ? "bg-accent-400 text-zinc-950" : "text-zinc-800 dark:text-zinc-200")}>
                  <Icon size={24} weight={on ? "fill" : "bold"} />{label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <Toast />
    </div>
  );
}

function MainApp() {
  const [theme, setTheme] = useStored("theme", null);
  const [currentUser, setCurrentUser] = useStored("auth_user", null);

  useEffect(() => {
    const dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  }, [theme]);

  const isDark = () => document.documentElement.classList.contains("dark");
  const toggleTheme = () => setTheme(isDark() ? "light" : "dark");

  if (!currentUser) {
    return (
      <Login
        onLogin={(user) => setCurrentUser(user)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
  }

  return (
    <Shell
      currentUser={currentUser}
      onLogout={() => setCurrentUser(null)}
      onToggleTheme={toggleTheme}
      isDark={isDark}
    />
  );
}

export default function App() {
  return (
    <StoreProvider>
      <MainApp />
    </StoreProvider>
  );
}
