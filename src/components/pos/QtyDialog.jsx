import { useState } from "react";
import { Backspace, Check } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { lineTotal, money, num } from "../../lib/format.js";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

/* Teclado numerico grande para pantallas tactiles */
export default function QtyDialog({ product, initial, onConfirm, onClose }) {
  const isKg = product.unit === "kg";
  const [text, setText] = useState(initial ? String(initial) : "");
  const qty = parseFloat(text) || 0;
  const chips = isKg ? [0.25, 0.5, 1, 2] : [1, 2, 6, 12];

  const press = (k) => {
    if (k === "del") return setText((t) => t.slice(0, -1));
    if (k === ".") {
      if (!isKg || text.includes(".")) return;
      return setText((t) => (t ? t + "." : "0."));
    }
    if (text.includes(".") && text.split(".")[1].length >= 3) return;
    if (text.length >= 6) return;
    setText((t) => (t === "0" ? k : t + k));
  };

  const over = qty > product.stock;

  return (
    <Modal title={product.name} onClose={onClose} size="sm">
      <div className="space-y-4">
        <div className="rounded-2xl bg-zinc-100 p-4 text-right dark:bg-zinc-800">
          <p className="font-mono text-5xl font-bold tracking-tight">
            {text ? text.replace(".", ",") : "0"}
            <span className="ml-2 text-2xl font-semibold text-zinc-700 dark:text-zinc-300">{isKg ? "kg" : "u"}</span>
          </p>
          <p className="mt-1 font-mono text-lg font-semibold text-zinc-700 dark:text-zinc-300">
            {money(lineTotal(qty, product.price))} <span className="text-sm">a {money(product.price)} por {isKg ? "kg" : "unidad"}</span>
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {chips.map((c) => (
            <button key={c} type="button" onClick={() => setText(String(c))} className="btn-ghost h-12 px-0 text-sm font-bold">
              {isKg && c < 1 ? `${c * 1000} g` : `${num(c)} ${isKg ? "kg" : "u"}`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button key={k} type="button" onClick={() => press(k)} disabled={k === "." && !isKg}
              aria-label={k === "del" ? "Borrar" : k === "." ? "Coma decimal" : k}
              className="btn-ghost h-16 px-0 font-mono text-2xl font-bold">
              {k === "del" ? <Backspace size={26} weight="bold" /> : k === "." ? "," : k}
            </button>
          ))}
        </div>

        {over && qty > 0 && (
          <p role="alert" className="rounded-2xl border-2 border-red-600 p-3 text-sm font-semibold text-red-700 dark:text-red-400">
            Supera el stock registrado ({num(product.stock)} {isKg ? "kg" : "u"}). Podés venderlo igual y ajustar el stock después.
          </p>
        )}

        <button type="button" className="btn-primary h-16 w-full text-lg" disabled={qty <= 0}
          onClick={() => onConfirm(Math.round(qty * 1000) / 1000)}>
          <Check size={24} weight="bold" />
          {initial ? "Guardar cantidad" : "Agregar al ticket"}
        </button>
      </div>
    </Modal>
  );
}
