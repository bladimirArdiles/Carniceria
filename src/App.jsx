import { lazy, Suspense, useEffect, useMemo, useState } from "react";
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
  Truck,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react";
import { StoreProvider, useStore } from "./lib/store.jsx";
import { useStored } from "./lib/storage.js";
import { fmtLongDate } from "./lib/format.js";
import { authService } from "./lib/authService.js";
import Counter from "./pages/Counter.jsx";
import Login from "./pages/Login.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import SyncQueueModal from "./components/layout/SyncQueueModal.jsx";

// Code splitting dinámico: carga diferida para módulos secundarios pesados
const Stock = lazy(() => import("./pages/Stock.jsx"));
const Customers = lazy(() => import("./pages/Customers.jsx"));
const Suppliers = lazy(() => import("./pages/Suppliers.jsx"));
const Reports = lazy(() => import("./pages/Reports.jsx"));

const ALL_TABS = [
  { id: "counter", label: "Mostrador", title: "Mostrador", icon: CashRegister, Page: Counter, roles: ["admin", "cajero", "stock"] },
  { id: "stock", label: "Stock", title: "Stock e inventario", icon: Package, Page: Stock, roles: ["admin", "stock"] },
  { id: "customers", label: "Clientes", title: "Clientes y fiados", icon: UsersThree, Page: Customers, roles: ["admin", "cajero"] },
  { id: "suppliers", label: "Proveedores", title: "Proveedores y Cuentas por Pagar", icon: Truck, Page: Suppliers, roles: ["admin"] },
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
  const [queueModalOpen, setQueueModalOpen] = useState(false);
  const {
    syncStatus,
    syncWithSupabase,
    syncAllLocalToSupabase,
    clearOutbox,
    resetLocalDatabase,
    isSupabaseConfigured,
    outbox,
    outboxCount,
    isOnline,
    flushOutbox,
  } = useStore();

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
          <a
            href="https://www.instagram.com/bladimirardiles/"
            target="_blank"
            rel="noopener noreferrer"
            title="Desarrollado por Bladimir Ardiles"
            className="flex flex-col items-center justify-center p-2 text-center text-[10px] font-semibold text-zinc-400 transition hover:text-accent-500 dark:text-zinc-500 dark:hover:text-accent-400"
          >
            <span>© 2026</span>
            <span className="underline underline-offset-2">B. Ardiles</span>
          </a>
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
            {/* Si hay operaciones pendientes en cola, botón de sincronización offline */}
            {outboxCount > 0 && (
              <button
                type="button"
                onClick={() => setQueueModalOpen(true)}
                title="Ver cola de operaciones pendientes de sincronización"
                className="flex items-center gap-1.5 rounded-2xl border border-amber-500/40 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 transition active:scale-95 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <CloudSlash size={16} weight="bold" className="text-amber-600 dark:text-amber-400" />
                <span>{outboxCount} en cola</span>
              </button>
            )}

            {/* Indicador de Estado y Conexión a Supabase */}
            <button
              type="button"
              onClick={() => setQueueModalOpen(true)}
              title="Panel de sincronización con Supabase (Clic para abrir)"
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition active:scale-95 ${
                !isOnline || syncStatus === "offline"
                  ? "border-amber-500/40 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200"
                  : syncStatus === "synced"
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : syncStatus === "syncing"
                  ? "border-amber-500/30 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-950/40 dark:text-amber-300"
                  : syncStatus === "error"
                  ? "border-red-500/30 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-950/40 dark:text-red-300"
                  : "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
              }`}
            >
              {(!isOnline || syncStatus === "offline") && (
                <>
                  <CloudSlash size={16} weight="bold" />
                  <span className="hidden sm:inline">Offline</span>
                </>
              )}
              {isOnline && syncStatus === "synced" && (
                <>
                  <CloudCheck size={16} weight="bold" />
                  <span className="hidden sm:inline">Supabase BD</span>
                </>
              )}
              {isOnline && syncStatus === "syncing" && (
                <>
                  <ArrowsClockwise size={16} weight="bold" className="animate-spin" />
                  <span className="hidden sm:inline">Sincronizando...</span>
                </>
              )}
              {isOnline && syncStatus === "error" && (
                <>
                  <CloudSlash size={16} weight="bold" />
                  <span className="hidden sm:inline">Reconectar</span>
                </>
              )}
              {isOnline && syncStatus === "local" && (
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
            <Suspense
              fallback={
                <div className="flex min-h-[30vh] items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="size-8 animate-spin rounded-full border-4 border-zinc-200 border-t-accent-500 dark:border-zinc-800 dark:border-t-accent-400" />
                    <p className="text-xs font-semibold text-zinc-500">Cargando...</p>
                  </div>
                </div>
              }
            >
              <Page />
            </Suspense>
          </ErrorBoundary>
        </main>

        <footer className="mt-12 mb-6 border-t border-zinc-200/80 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-800/80 dark:text-zinc-400">
          <p>
            © {new Date().getFullYear()} Carnicería - Mostrador &bull; Desarrollado por{" "}
            <a
              href="https://www.instagram.com/bladimirardiles/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-zinc-800 underline decoration-accent-500 underline-offset-4 transition hover:text-accent-600 dark:text-zinc-200 dark:hover:text-accent-400"
            >
              Bladimir Ardiles
            </a>
          </p>
        </footer>
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

      {queueModalOpen && (
        <SyncQueueModal
          outbox={outbox}
          isOnline={isOnline}
          onSync={flushOutbox}
          onSyncAll={syncAllLocalToSupabase}
          onClearQueue={clearOutbox}
          onResetLocal={resetLocalDatabase}
          onClose={() => setQueueModalOpen(false)}
        />
      )}
    </div>
  );
}

function MainApp() {
  const [theme, setTheme] = useStored("theme", null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

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
      } finally {
        setIsAuthChecking(false);
      }
    }
    syncAuth();

    const unsubscribe = authService.onAuthStateChange((user) => {
      setCurrentUser(user);
      setIsAuthChecking(false);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

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

  if (isAuthChecking) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-zinc-200 border-t-accent-500 dark:border-zinc-800 dark:border-t-accent-400" />
          <p className="text-sm font-semibold text-zinc-500">Iniciando sistema...</p>
        </div>
      </div>
    );
  }

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
