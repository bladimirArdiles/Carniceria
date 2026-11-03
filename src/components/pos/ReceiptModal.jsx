import { useEffect } from "react";
import { CheckCircle, HandCoins, Money, Printer, ShareNetwork, WhatsappLogo, X } from "@phosphor-icons/react";
import { fmtDateTime, money, qtyText } from "../../lib/format.js";

export default function ReceiptModal({ sale, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!sale) return null;

  const isCash = sale.method === "Efectivo";
  const isFiado = sale.method === "Fiado";
  const hasChange = isCash && sale.change > 0;

  const handlePrint = () => {
    window.print();
  };

  const generateWhatsappText = () => {
    const linesText = sale.items
      .map((i) => `• ${i.name} (${qtyText(i.qty, i.unit)}): ${money(i.total)}`)
      .join("\n");

    const text =
      `🥩 *CARNICERÍA - COMPROBANTE DE COMPRA*\n` +
      `📅 Fecha: ${fmtDateTime(sale.date)}\n` +
      `👤 Cliente: ${sale.customer?.name || "Consumidor Final"}\n` +
      (sale.customer?.dni ? `🪪 DNI: ${sale.customer.dni}\n` : "") +
      `--------------------------------\n` +
      `${linesText}\n` +
      `--------------------------------\n` +
      `💰 *TOTAL: ${money(sale.total)}*\n` +
      `💳 Pago: ${sale.method}` +
      (isCash && sale.tendered > sale.total ? ` (Pagó con ${money(sale.tendered)} - Vuelto: ${money(sale.change)})` : "") +
      (isFiado && sale.newBalance ? `\n⚠️ Saldo pendiente total: ${money(sale.newBalance)}` : "") +
      `\n\n¡Muchas gracias por su compra!`;

    const phone = sale.customer?.phone ? sale.customer.phone.replace(/[^\d]/g, "") : "";
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;

    window.open(url, "_blank");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-zinc-950/75 p-4 backdrop-blur-md"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comprobante de venta"
        className="animate-fade-in-up relative my-auto w-full max-w-md overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {/* Encabezado modal */}
        <div className="flex items-center justify-between border-b border-zinc-100 p-5 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={26} weight="fill" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                {isFiado ? "Venta anotada en cuenta" : "Venta cobrada con éxito"}
              </h2>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Ticket #{sale.id.slice(-6).toUpperCase()}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-icon size-10"
            aria-label="Cerrar comprobante"
            onClick={onClose}
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Tarjeta hero de vuelto o saldo (Peak-End Rule) */}
          {isCash ? (
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/70 p-4 text-center dark:border-emerald-500/20 dark:bg-emerald-950/30">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                {hasChange ? "Vuelto a entregar al cliente" : "Monto exacto cobrado"}
              </p>
              <p className="mt-1 font-mono text-4xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400 sm:text-5xl">
                {money(sale.change || 0)}
              </p>
              {sale.tendered > 0 && (
                <p className="mt-1 font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                  Pagó con {money(sale.tendered)} (Total: {money(sale.total)})
                </p>
              )}
            </div>
          ) : isFiado ? (
            <div className="rounded-2xl border-2 border-amber-500/30 bg-amber-50/70 p-4 text-center dark:border-amber-500/20 dark:bg-amber-950/30">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Anotado a {sale.customer?.name || "Cliente"}
              </p>
              <p className="mt-1 font-mono text-3xl font-extrabold tracking-tight text-amber-700 dark:text-amber-400">
                {money(sale.total)}
              </p>
              <p className="mt-1 font-mono text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                Deuda total acumulada: <span className="font-bold">{money(sale.newBalance || 0)}</span>
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-center dark:border-zinc-800 dark:bg-zinc-800/50">
              <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                Cobrado mediante <span className="font-semibold text-zinc-900 dark:text-zinc-100">{sale.method}</span>
              </p>
              <p className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
                {money(sale.total)}
              </p>
            </div>
          )}

          {/* Ticket térmico físico simulado (imprimible) */}
          <div
            id="receipt-print"
            className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 font-mono text-xs text-zinc-800 shadow-inner dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-200"
          >
            <div className="border-b border-dashed border-zinc-300 pb-2.5 text-center dark:border-zinc-700">
              <h3 className="font-sans text-base font-black tracking-tight text-zinc-950 dark:text-zinc-50">
                CARNICERÍA
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Sistema de Mostrador</p>
              <p className="mt-1 text-[11px]">{fmtDateTime(sale.date)}</p>
            </div>

            <div className="py-2 border-b border-dashed border-zinc-300 dark:border-zinc-700 text-[11px] space-y-0.5">
              <p>
                <span className="font-bold">Cliente:</span> {sale.customer?.name || "Consumidor Final"}
              </p>
              {sale.customer?.dni && (
                <p>
                  <span className="font-bold">DNI:</span> {sale.customer.dni}
                </p>
              )}
              <p>
                <span className="font-bold">Pago:</span> {sale.method}
              </p>
            </div>

            {/* Lista de productos */}
            <div className="divide-y divide-zinc-200 py-2 dark:divide-zinc-800">
              {sale.items.map((item, idx) => (
                <div key={idx} className="flex items-start justify-between py-1 text-[11px]">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate font-semibold">{item.name}</p>
                    <p className="text-zinc-500 dark:text-zinc-400">
                      {qtyText(item.qty, item.unit)} x {money(item.price)}
                    </p>
                  </div>
                  <span className="font-bold">{money(item.total)}</span>
                </div>
              ))}
            </div>

            <div className="border-t-2 border-dashed border-zinc-300 pt-2 text-[12px] dark:border-zinc-700">
              <div className="flex justify-between font-black text-sm text-zinc-950 dark:text-zinc-50">
                <span>TOTAL:</span>
                <span>{money(sale.total)}</span>
              </div>
              {isCash && sale.tendered > 0 && (
                <div className="mt-1 space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-300">
                  <div className="flex justify-between">
                    <span>Abona con:</span>
                    <span>{money(sale.tendered)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-zinc-950 dark:text-zinc-50">
                    <span>Vuelto:</span>
                    <span>{money(sale.change)}</span>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-3 text-center text-[10px] text-zinc-500 dark:text-zinc-400">
              ¡Gracias por su compra!
            </p>
          </div>

          {/* Botones de acción táctiles (Fitts's Law) */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handlePrint}
              className="btn-ghost h-12 text-xs font-bold"
            >
              <Printer size={18} weight="bold" />
              Imprimir ticket
            </button>
            <button
              type="button"
              onClick={generateWhatsappText}
              className="btn-ghost h-12 text-xs font-bold text-emerald-700 hover:border-emerald-500 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              <WhatsappLogo size={18} weight="bold" />
              WhatsApp
            </button>
          </div>

          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="btn-primary h-14 w-full text-base font-bold shadow-lg active:scale-[0.98]"
          >
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  );
}

