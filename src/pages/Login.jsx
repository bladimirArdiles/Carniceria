import { useEffect, useState } from "react";
import { CheckCircle, CircleNotch, Eye, EyeSlash, Knife, LockKey, Moon, ShieldWarning, SignIn, Sun, User, WarningCircle } from "@phosphor-icons/react";
import { authService } from "../lib/authService.js";

export default function Login({ onLogin, theme, onToggleTheme }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("idle"); // "idle" | "loading" | "success" | "error"
  const [errorMessage, setErrorMessage] = useState("");
  const [shake, setShake] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  // Contador de bloqueo regresivo contra ataques de fuerza bruta
  useEffect(() => {
    if (lockoutTimer <= 0) return;
    const interval = setInterval(() => {
      setLockoutTimer((t) => (t > 1 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (lockoutTimer > 0) {
      setErrorMessage(`Terminal bloqueada por seguridad. Esperá ${lockoutTimer}s.`);
      triggerShake();
      return;
    }

    const u = username.trim();
    const p = password.trim();

    if (!u) {
      setErrorMessage("Por favor, ingresá tu usuario o correo.");
      setStatus("error");
      triggerShake();
      return;
    }

    if (!p) {
      setErrorMessage("Por favor, ingresá tu contraseña.");
      setStatus("error");
      triggerShake();
      return;
    }

    setStatus("loading");

    try {
      const session = await authService.signIn({ identifier: u, password: p });
      setStatus("success");
      setFailedAttempts(0);
      setLockoutTimer(0);
      setTimeout(() => {
        onLogin(session);
      }, 450);
    } catch (err) {
      setStatus("error");
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);

      if (nextFailures >= 5) {
        setLockoutTimer(30);
        setErrorMessage("Demasiados intentos fallidos. Terminal bloqueada por 30 segundos.");
      } else {
        setErrorMessage(err.message || "Usuario o contraseña inválidos.");
      }
      triggerShake();
    }
  };

  const handleQuickFill = (user, pass) => {
    setUsername(user);
    setPassword(pass);
    setErrorMessage("");
    setStatus("idle");
  };

  return (
    <div className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden px-4 py-8">
      {/* Atmósfera viva de fondo: esferas con animación suave sin saturación artificial */}
      <div
        aria-hidden="true"
        className="animate-float-slow pointer-events-none absolute -left-20 -top-20 h-80 w-80 rounded-full bg-accent-400/20 blur-3xl filter dark:bg-accent-500/10 md:h-96 md:w-96"
      />
      <div
        aria-hidden="true"
        className="animate-float-reverse pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-zinc-300/40 blur-3xl filter dark:bg-zinc-800/40 md:h-96 md:w-96"
      />

      {/* Botón de tema en esquina superior */}
      <div className="animate-fade-in-up absolute right-4 top-4 z-20 md:right-8 md:top-8">
        <button
          type="button"
          className="btn-icon shadow-sm"
          aria-label="Cambiar tema claro u oscuro"
          onClick={onToggleTheme}
        >
          <Sun size={20} weight="bold" className="hidden dark:block" />
          <Moon size={20} weight="bold" className="dark:hidden" />
        </button>
      </div>

      {/* Tarjeta de Login principal con profundidad de vidrio y animación */}
      <div
        className={`animate-fade-in-up relative z-10 w-full max-w-md rounded-3xl border border-zinc-200/80 bg-white/90 p-6 shadow-2xl backdrop-blur-xl transition-all duration-300 dark:border-zinc-800/80 dark:bg-zinc-900/90 sm:p-8 ${
          shake ? "animate-shake" : ""
        }`}
      >
        {/* Cabecera / Identidad */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-400 text-zinc-950 shadow-md transition-transform duration-300 hover:scale-105">
            <Knife size={32} weight="bold" />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-400 opacity-60"></span>
              <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-accent-500 dark:border-zinc-900"></span>
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
            Carnicería
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Ingreso al sistema de mostrador e inventario
          </p>
        </div>

        {/* Mensaje de error animado */}
        {errorMessage && (
          <div
            role="alert"
            className="animate-fade-in-up mb-5 flex items-center gap-3 rounded-2xl border border-red-300 bg-red-50 p-3.5 text-sm font-semibold text-red-900 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200"
          >
            <WarningCircle size={20} weight="bold" className="shrink-0 text-red-600 dark:text-red-400" />
            <p className="flex-1">{errorMessage}</p>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Campo Usuario */}
          <div>
            <label className="label" htmlFor="login-usuario">
              Usuario
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors duration-200 peer-focus:text-accent-500 dark:text-zinc-500">
                <User size={20} weight="bold" />
              </div>
              <input
                id="login-usuario"
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="Ingresá tu usuario"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                disabled={status === "loading" || status === "success"}
                className="field pl-12 font-medium"
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div>
            <label className="label" htmlFor="login-password">
              Contraseña
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 transition-colors duration-200 dark:text-zinc-500">
                <LockKey size={20} weight="bold" />
              </div>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Ingresá tu clave"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                disabled={status === "loading" || status === "success"}
                className="field pl-12 pr-12 font-medium"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-zinc-400 transition-colors hover:text-zinc-800 active:scale-95 dark:text-zinc-500 dark:hover:text-zinc-200"
              >
                {showPassword ? <EyeSlash size={20} weight="bold" /> : <Eye size={20} weight="bold" />}
              </button>
            </div>
          </div>

          {/* Botón Submit interactivo */}
          <button
            type="submit"
            disabled={status === "loading" || status === "success" || lockoutTimer > 0}
            className={`btn-primary mt-2 h-14 w-full text-base font-bold shadow-md transition-all duration-200 ${
              lockoutTimer > 0 ? "opacity-50 cursor-not-allowed bg-zinc-600" : ""
            }`}
          >
            {lockoutTimer > 0 ? (
              <span className="flex items-center gap-2 text-zinc-300">
                <ShieldWarning size={20} weight="bold" />
                Bloqueado ({lockoutTimer}s)
              </span>
            ) : status === "loading" ? (
              <span className="flex items-center gap-2">
                <CircleNotch size={20} weight="bold" className="animate-spin" />
                Ingresando...
              </span>
            ) : status === "success" ? (
              <span className="flex items-center gap-2 text-emerald-950">
                <CheckCircle size={22} weight="fill" />
                ¡Bienvenido!
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <SignIn size={20} weight="bold" />
                Iniciar sesión
              </span>
            )}
          </button>
        </form>

        {/* Accesos rápidos para el personal (1 clic para rellenar) */}
        <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Perfiles rápidos de acceso
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickFill("cajero", "1234")}
              className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-xs font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 active:scale-95 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span>Cajero</span>
              <span className="mt-0.5 font-mono text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                1234
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("stock", "1234")}
              className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-xs font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 active:scale-95 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span>Stock</span>
              <span className="mt-0.5 font-mono text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                1234
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickFill("admin", "1234")}
              className="flex flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-zinc-50 p-2 text-xs font-bold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 active:scale-95 dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <span>Admin</span>
              <span className="mt-0.5 font-mono text-[10px] font-normal text-zinc-500 dark:text-zinc-400">
                1234
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

