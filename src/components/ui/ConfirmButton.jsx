import { useEffect, useState } from "react";
import { Trash } from "@phosphor-icons/react";

/* Doble toque para acciones destructivas: evita errores en el mostrador */
export default function ConfirmButton({ onConfirm, label = "Eliminar", text, disabled, className = "" }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={
        "inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl border-2 px-4 text-sm font-bold transition active:scale-95 disabled:opacity-40 " +
        (armed
          ? "border-red-600 bg-red-600 text-white"
          : "border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800") +
        " " + className
      }
    >
      <Trash size={20} weight="bold" />
      {armed ? "Confirmar" : text}
    </button>
  );
}
