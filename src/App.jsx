import { useEffect, useMemo, useState } from "react";
import {
  ArrowsClockwise,
  CashRegister,
  ChartBar,
  CloudCheck,
  CloudSlash,
  HardDrives,
  Moon,
  Package,
  ShieldCheck,
  SignOut,
  Sun,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { StoreProvider, useStore } from "./lib/store.jsx";
import { useStored } from "./lib/storage.js";
import { fmtLongDate } from "./lib/format.js";
import { authService } from "./lib/authService.js";
import Counter from "./pages/Counter.jsx";
import Stock from "./pages/Stock.jsx";
import Customers from "./pages/Customers.jsx";
import Reports from "./pages/Reports.jsx";
import Login from "./pages/Login.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";

const ALL_TABS = [
  { id: "counter", label: "Mostrador", title: "Mostrador", icon: CashRegister, Page: Counter, roles: ["admin", "cajero", "stock"] },
  { id: "stock", label: "Stock", title: "Stock e inventario", icon: Package, Page: Stock, roles: ["admin", "stock"] },
  { id: "customers", label: "Clientes", title: "Clientes y fiados", icon: UsersThree, Page: Customers, roles: ["admin", "cajero"] },
  { id: "reports", label: "Reportes", title: "Reportes de venta y Cierre Z", icon: ChartBar, Page: Reports, roles: ["admin"] },
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
  const userRole = currentUser?.rawRole || (currentUser?.role === "Administrador" ? "admin" : currentUser?.role === "Encargado de Stock" ? "stock" : "cajero");
  const availableTabs = useMemo(() => {
    return ALL_TABS.filter((t) => t.roles.includes(userRole));
  }, [userRole]);

  const [tab, setTab] = useState(availableTabs[0]?.id || "counter");
  const [full, setFull] = useState(false);
  const { syncStatus, syncWithSupabase, isSupabaseConfigured } = useStore();

  useEffect(() => {
    if (!availableTabs.some((t) => t.id === tab)) {
      setTab(availableTabs[0]?.id || "counter");
    }
  }, [availableTabs, tab]);

  useEffect(() => {
    const h = () => setFull(true);
    window.addEventListener("ca:storage-full", h);
    return () => window.removeEventListener("ca:storage-full", h);
  }, []);

  const current = availableTabs.find((t) => t.id === tab) || availableTabs[0];
  const Page = current.Page;

  return (
    <div className="min-h-[100dvh] md:pl-24">
      <aside className="fixed inset-y-0 left-0 hidden w-24 flex-col items-center gap-2 border-r border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-900 md:flex">
        {availableTabs.map(({ id, label, icon: Icon }) => {
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
            {/* Indicador de Estado y Conexión a Supabase */}
            <button
              type="button"
              onClick={syncWithSupabase}
              title={
                syncStatus === "synced"
                  ? "Conectado a Supabase PostgreSQL (Clic para forzar sincronización)"
                  : syncStatus === "syncing"
                  ? "Sincronizando datos con Supabase..."
                  : syncStatus === "error"
                  ? "Error de conexión con Supabase (Clic para reintentar)"
                  : "Modo almacenamiento local"
              }
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition active:scale-95 ${
                syncStatus === "synced"
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : syncStatus === "syncing"
                  ? "border-amber-500/30 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-300"
                  : syncStatus === "error"
                  ? "border-red-500/30 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-950/40 dark:text-red-300"
                  : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
              }`}
            >
              {syncStatus === "synced" && (
                <>
                  <CloudCheck size={16} weight="bold" />
                  <span className="hidden sm:inline">Supabase BD</span>
                </>
              )}
              {syncStatus === "syncing" && (
                <>
                  <ArrowsClockwise size={16} weight="bold" className="animate-spin" />
                  <span className="hidden sm:inline">Sincronizando...</span>
                </>
              )}
              {syncStatus === "error" && (
                <>
                  <CloudSlash size={16} weight="bold" />
                  <span className="hidden sm:inline">Reconectar</span>
                </>
              )}
              {syncStatus === "local" && (
                <>
                  <HardDrives size={16} weight="bold" />
                  <span className="hidden sm:inline">Modo local</span>
                </>
              )}
            </button>

            {/* Perfil del Operador y Rol */}
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="capitalize text-zinc-900 dark:text-zinc-100 max-w-[100px] truncate sm:max-w-none">
                {currentUser?.username || "Operador"}
              </span>
              <span className="rounded-lg bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {currentUser?.role || (userRole === "admin" ? "Administrador" : userRole === "stock" ? "Stock" : "Cajero")}
              </span>
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

        <main>
          <ErrorBoundary key={tab}>
            <Page />
          </ErrorBoundary>
        </main>
      </div>

      <nav aria-label="Secciones" className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-zinc-800 dark:bg-zinc-950 md:hidden">
        <ul className={`grid gap-1 p-2 ${availableTabs.length === 2 ? "grid-cols-2" : availableTabs.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
          {availableTabs.map(({ id, label, icon: Icon }) => {
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

  // Verificación y sincronización de sesión al cargar la app con refresco reactivo de tokens
  useEffect(() => {
    async function syncAuth() {
      try {
        const session = await authService.getCurrentSession();
        if (session) {
          setCurrentUser(session);
        }
      } catch (err) {
        console.warn("No se pudo restaurar la sesión:", err);
      }
    }
    syncAuth();

    const unsubscribe = authService.onAuthStateChange((user) => {
      setCurrentUser(user);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [setCurrentUser]);

  useEffect(() => {
    const dark = theme ? theme === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  }, [theme]);

  const isDark = () => document.documentElement.classList.contains("dark");
  const toggleTheme = () => setTheme(isDark() ? "light" : "dark");

  const handleLogout = async () => {
    await authService.signOut();
    setCurrentUser(null);
  };

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
      onLogout={handleLogout}
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
