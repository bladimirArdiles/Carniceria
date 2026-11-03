import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

export default function Modal({ title, onClose, children, size = "md" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-zinc-950/70 md:items-center md:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          "max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl border border-zinc-200 bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] dark:border-zinc-800 dark:bg-zinc-900 md:rounded-2xl " +
          (size === "sm" ? "md:max-w-sm" : "md:max-w-lg")
        }
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <button type="button" className="btn-icon" aria-label="Cerrar" onClick={onClose}>
            <X size={22} weight="bold" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
