import { CheckCircle, Warning, WarningOctagon } from "@phosphor-icons/react";

const TONES = {
  ok: { cls: "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100", Icon: CheckCircle },
  low: { cls: "bg-accent-400 text-zinc-950", Icon: Warning },
  out: { cls: "bg-red-600 text-white", Icon: WarningOctagon },
  debt: { cls: "bg-zinc-950 text-white dark:bg-zinc-50 dark:text-zinc-950", Icon: Warning },
};

/* Icono + texto: la alerta nunca depende solo del color */
export default function Badge({ tone = "ok", children }) {
  const { cls, Icon } = TONES[tone];
  return (
    <span className={"inline-flex items-center gap-1 rounded-2xl px-2.5 py-1 text-xs font-bold " + cls}>
      <Icon size={14} weight="bold" />
      {children}
    </span>
  );
}

export function stockTone(p) {
  if (p.stock <= 0) return "out";
  if (p.stock <= p.minStock) return "low";
  return "ok";
}
export const stockLabel = { out: "Sin stock", low: "Stock bajo", ok: "Disponible" };
