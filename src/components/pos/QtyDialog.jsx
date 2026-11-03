import { useEffect, useMemo, useState } from "react";
import { Backspace, Check, CurrencyDollar, Keyboard, Scales } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { lineTotal, money, num, round3 } from "../../lib/format.js";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"];

/* Teclado numérico grande para pantallas táctiles con soporte de Pesaje Inverso y Teclado Físico/Numpad */
export default function QtyDialog({ product, initial, onConfirm, onClose }) {
  const isKg = product.unit === "kg";
  const [mode, setMode] = useState("weight"); // "weight" | "money"
  const [text, setText] = useState(initial ? String(initial) : "");
  const [moneyText, setMoneyText] = useState("");

  const weightQty = parseFloat(text) || 0;
  const moneyVal = parseFloat(moneyText) || 0;

  // En modo dinero, calcula los kilos equivalentes con 3 decimales
  const calculatedQty = useMemo(() => {
    if (mode === "money") {
      if (!product.price || moneyVal <= 0) return 0;
      return round3(moneyVal / product.price);
    }
    return weightQty;
  }, [mode, moneyVal, weightQty, product.price]);

  const finalTotal = useMemo(() => {
    if (mode === "money") {
      return Math.round(moneyVal);
    }
    return lineTotal(calculatedQty, product.price);
  }, [mode, moneyVal, calculatedQty, product.price]);

  const chips = isKg
    ? mode === "weight"
      ? [0.25, 0.5, 1, 2]
      : [2000, 5000, 10000, 15000]
    : [1, 2, 6, 12];

  const press = (k) => {
    if (mode === "weight") {
      if (k === "del") return setText((t) => t.slice(0, -1));
      if (k === "." || k === ",") {
        if (!isKg || text.includes(".")) return;
        return setText((t) => (t ? t + "." : "0."));
      }
      if (text.includes(".") && text.split(".")[1].length >= 3) return;
      if (text.length >= 6) return;
      setText((t) => (t === "0" ? k : t + k));
    } else {
      // Modo dinero (solo números enteros)
      if (k === "." || k === ",") return;
      if (k === "del") return setMoneyText((t) => t.slice(0, -1));
      if (moneyText.length >= 7) return;
      setMoneyText((t) => (t === "0" ? k : t + k));
    }
  };

  // Atajos de teclado físico / Numpad para balanzas y terminales táctiles
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        press(e.key);
      } else if (e.key === "." || e.key === ",") {
        e.preventDefault();
        press(".");
      } else if (e.key === "Backspace") {
        e.preventDefault();
        press("del");
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (calculatedQty > 0) {
          onConfirm(calculatedQty);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, text, moneyText, calculatedQty, isKg, onConfirm]);

  const handleChipClick = (c) => {
    if (mode === "weight") {
      setText(String(c));
    } else {
      setMoneyText(String(c));
    }
  };

  const over = calculatedQty > product.stock;

  return (
    <Modal title={product.name} onClose={onClose} size="sm">
      <div className="space-y-4">
        {/* Selector de modo: Por Peso vs Por Dinero (solo para cortes por kg) */}
        {isKg && (
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              type="button"
              onClick={() => {
                setMode("weight");
                if (calculatedQty > 0 && !text) setText(String(calculatedQty));
              }}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                mode === "weight"
                  ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              <Scales size={18} weight="bold" />
              Por Peso (kg)
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("money");
                if (finalTotal > 0 && !moneyText) setMoneyText(String(finalTotal));
              }}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-bold transition active:scale-95 ${
                mode === "money"
                  ? "bg-accent-500 text-zinc-950 shadow-sm font-extrabold"
                  : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              <CurrencyDollar size={18} weight="bold" />
              Por Dinero ($)
            </button>
          </div>
        )}

        {/* Visor de cálculo principal */}
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50 p-4 text-right dark:border-zinc-800 dark:bg-zinc-800/80">
          {mode === "weight" ? (
            <>
              <p className="font-mono text-5xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                {text ? text.replace(".", ",") : "0"}
                <span className="ml-2 text-2xl font-semibold text-zinc-600 dark:text-zinc-400">
                  {isKg ? "kg" : "u"}
                </span>
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-zinc-700 dark:text-zinc-300">
                {money(finalTotal)}{" "}
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  (a {money(product.price)} por {isKg ? "kg" : "unidad"})
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="font-mono text-5xl font-bold tracking-tight text-accent-700 dark:text-accent-400">
                {moneyText ? money(parseFloat(moneyText) || 0) : "$0"}
              </p>
              <p className="mt-1 font-mono text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Equivale a {num(calculatedQty)}{" "}
                <span className="text-sm font-semibold">{product.unit}</span>{" "}
                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400">
                  (a {money(product.price)}/{product.unit})
                </span>
              </p>
            </>
          )}
        </div>

        {/* Chips de acceso rápido */}
        <div className="grid grid-cols-4 gap-2">
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleChipClick(c)}
              className="btn-ghost h-12 px-0 text-sm font-bold"
            >
              {mode === "money"
                ? money(c)
                : isKg && c < 1
                ? `${c * 1000} g`
                : `${num(c)} ${isKg ? "kg" : "u"}`}
            </button>
          ))}
        </div>

        {/* Teclado numérico táctil */}
        <div className="grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              disabled={(k === "." && (!isKg || mode === "money"))}
              aria-label={k === "del" ? "Borrar" : k === "." ? "Coma decimal" : k}
              className="btn-ghost h-16 px-0 font-mono text-2xl font-bold disabled:opacity-30"
            >
              {k === "del" ? <Backspace size={26} weight="bold" /> : k === "." ? "," : k}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
          <Keyboard size={15} weight="bold" />
          <span>Teclado físico / Numpad y Enter activos</span>
        </div>

        {over && calculatedQty > 0 && (
          <p
            role="alert"
            className="rounded-2xl border-2 border-red-600 p-3 text-sm font-semibold text-red-700 dark:text-red-400"
          >
            Supera el stock registrado ({num(product.stock)} {product.unit}). Podés venderlo igual y ajustar el stock después.
          </p>
        )}

        <button
          type="button"
          className="btn-primary h-16 w-full text-lg shadow-md flex items-center justify-center gap-2"
          disabled={calculatedQty <= 0}
          onClick={() => onConfirm(calculatedQty)}
        >
          <Check size={24} weight="bold" />
          <span>{initial ? "Guardar cantidad" : "Agregar al ticket"}</span>
          <kbd className="hidden sm:inline-flex items-center rounded-lg bg-zinc-950/20 px-2 py-0.5 text-xs font-mono font-bold text-zinc-950">
            ↵ Enter
          </kbd>
        </button>
      </div>
    </Modal>
  );
}
