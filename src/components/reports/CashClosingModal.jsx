import { useMemo, useState } from "react";
import { Check, CheckCircle, CurrencyDollar, Money, Printer, Scales, Warning, WarningCircle, X } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { fmtDateTime, fmtLongDate, money, num } from "../../lib/format.js";

export default function CashClosingModal({ sales, payments, dateLabel, onClose }) {
  const [countedCash, setCountedCash] = useState("");

  // Cálculos de caja y ventas
  const stats = useMemo(() => {
    let cashSales = 0;
    let transferSales = 0;
    let cardSales = 0;
    let creditSales = 0;
    let totalKilos = 0;

    sales.forEach((s) => {
      if (s.method === "Efectivo") cashSales += s.total;
      else if (s.method === "Transferencia") transferSales += s.total;
      else if (s.method === "Tarjeta") cardSales += s.total;
      else if (s.method === "Fiado") creditSales += s.total;

      s.items?.forEach((i) => {
        if (i.unit === "kg") totalKilos += i.qty;
      });
    });

    let cashPayments = 0;
    let transferPayments = 0;

    (payments || []).forEach((p) => {
      if (p.method === "Efectivo") cashPayments += p.amount;
      else if (p.method === "Transferencia") transferPayments += p.amount;
    });

    const expectedCash = cashSales + cashPayments;
    const totalLiquid = expectedCash + transferSales + transferPayments + cardSales;
    const totalSales = cashSales + transferSales + cardSales + creditSales;

    return {
      cashSales,
      transferSales,
      cardSales,
      creditSales,
      cashPayments,
      transferPayments,
      expectedCash,
      totalLiquid,
      totalSales,
      totalKilos,
      ticketCount: sales.length,
      avgTicket: sales.length > 0 ? Math.round(totalSales / sales.length) : 0,
    };
  }, [sales, payments]);

  const physicalCash = parseFloat(String(countedCash).replace(",", ".")) || 0;
  const cashDifference = countedCash !== "" ? physicalCash - stats.expectedCash : null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal title="Cierre de Caja Diario (Reporte Z)" onClose={onClose} size="md">
      <div className="space-y-5">
        {/* Encabezado descriptivo */}
        <div className="flex items-center justify-between rounded-2xl bg-zinc-100 p-4 dark:bg-zinc-800">
          <div>
            <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Período de arqueo</p>
            <p className="text-lg font-bold text-zinc-950 dark:text-zinc-50">{dateLabel || fmtLongDate()}</p>
          </div>
          <span className="rounded-xl bg-accent-500/20 px-3 py-1 font-mono text-xs font-black text-accent-800 dark:text-accent-300">
            Z-REPORT
          </span>
        </div>

        {/* Resumen de Efectivo y Arqueo de Gaveta */}
        <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
              <Money size={20} weight="bold" className="text-emerald-600 dark:text-emerald-400" />
              Efectivo esperado en gaveta
            </span>
            <span className="font-mono text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {money(stats.expectedCash)}
            </span>
          </div>

          <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
            <div className="flex justify-between">
              <span>Efectivo por ventas mostrador:</span>
              <span className="font-mono font-semibold">{money(stats.cashSales)}</span>
            </div>
            {stats.cashPayments > 0 && (
              <div className="flex justify-between">
                <span>Efectivo cobrado de fiados:</span>
                <span className="font-mono font-semibold">+{money(stats.cashPayments)}</span>
              </div>
            )}
          </div>

          {/* Input de conteo físico */}
          <div className="pt-2">
            <label className="label text-xs" htmlFor="counted-cash">
              ¿Cuánto dinero físico contaste en la caja?
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xl font-bold text-zinc-400">
                $
              </span>
              <input
                id="counted-cash"
                className="field pl-9 font-mono text-2xl font-bold"
                inputMode="decimal"
                placeholder={`Ej: ${stats.expectedCash}`}
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value.replace(/[^\d.,]/g, ""))}
              />
            </div>
          </div>

          {/* Resultado del arqueo */}
          {cashDifference !== null && (
            <div
              className={`rounded-xl p-3 text-center transition-all ${
                cashDifference === 0
                  ? "bg-emerald-50 text-emerald-950 border border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : cashDifference > 0
                  ? "bg-sky-50 text-sky-950 border border-sky-400 dark:bg-sky-950/40 dark:text-sky-200"
                  : "bg-red-50 text-red-950 border border-red-400 dark:bg-red-950/40 dark:text-red-200"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {cashDifference === 0 ? (
                  <>
                    <CheckCircle size={20} weight="fill" className="text-emerald-600" />
                    <span className="font-bold text-sm">¡Caja exacta! No hay diferencias.</span>
                  </>
                ) : cashDifference > 0 ? (
                  <>
                    <CurrencyDollar size={20} weight="bold" className="text-sky-600" />
                    <span className="font-bold text-sm">
                      Sobrante de caja: <strong className="font-mono text-base">+{money(cashDifference)}</strong>
                    </span>
                  </>
                ) : (
                  <>
                    <WarningCircle size={20} weight="fill" className="text-red-600" />
                    <span className="font-bold text-sm">
                      Faltante de caja: <strong className="font-mono text-base">-{money(-cashDifference)}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desglose por método de pago */}
        <div className="rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-800/60 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
            Resumen total por medio de pago
          </p>
          <div className="divide-y divide-zinc-200 text-sm dark:divide-zinc-700/60">
            <div className="flex justify-between py-1.5">
              <span>Efectivo cobrado total:</span>
              <span className="font-mono font-bold">{money(stats.expectedCash)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span>Transferencias / QR:</span>
              <span className="font-mono font-bold">{money(stats.transferSales + stats.transferPayments)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span>Tarjetas débito / crédito:</span>
              <span className="font-mono font-bold">{money(stats.cardSales)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-amber-700 dark:text-amber-400">
              <span>Fiados emitidos (a cobrar):</span>
              <span className="font-mono font-bold">{money(stats.creditSales)}</span>
            </div>
            <div className="flex justify-between pt-2 text-base font-extrabold text-zinc-950 dark:text-zinc-50">
              <span>Total dinero ingresado (caja + banco):</span>
              <span className="font-mono text-lg text-accent-700 dark:text-accent-400">
                {money(stats.totalLiquid)}
              </span>
            </div>
          </div>
        </div>

        {/* Estadísticas de operaciones */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold text-zinc-500">Tickets</p>
            <p className="font-mono text-lg font-bold">{stats.ticketCount}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold text-zinc-500">Kilos vendidos</p>
            <p className="font-mono text-lg font-bold">{num(stats.totalKilos)} kg</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-semibold text-zinc-500">Ticket promedio</p>
            <p className="font-mono text-lg font-bold">{money(stats.avgTicket)}</p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handlePrint}
            className="btn-primary h-14 flex-1 text-base shadow-md flex items-center justify-center gap-2"
          >
            <Printer size={22} weight="bold" />
            <span>Imprimir Cierre Z</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost h-14 px-6 text-sm font-bold"
          >
            Cerrar
          </button>
        </div>

        {/* Sección térmica oculta en pantalla, visible al imprimir con @media print */}
        <div className="hidden print:block font-mono text-xs text-black p-4 space-y-2">
          <div className="text-center border-b pb-2">
            <p className="text-base font-black">CARNICERÍA TRADICIONAL</p>
            <p className="text-sm font-bold">CIERRE DE CAJA (REPORTE Z)</p>
            <p>{fmtDateTime(new Date().toISOString())}</p>
            <p>Período: {dateLabel}</p>
          </div>
          <div className="space-y-1 border-b py-2">
            <div className="flex justify-between"><span>Efectivo Mostrador:</span><span>{money(stats.cashSales)}</span></div>
            {stats.cashPayments > 0 && <div className="flex justify-between"><span>Cobro Fiado Efectivo:</span><span>+{money(stats.cashPayments)}</span></div>}
            <div className="flex justify-between font-bold"><span>Total Efectivo Esperado:</span><span>{money(stats.expectedCash)}</span></div>
            {countedCash !== "" && (
              <>
                <div className="flex justify-between"><span>Efectivo Contado:</span><span>{money(physicalCash)}</span></div>
                <div className="flex justify-between font-bold"><span>Diferencia de Caja:</span><span>{cashDifference >= 0 ? `+${money(cashDifference)}` : money(cashDifference)}</span></div>
              </>
            )}
          </div>
          <div className="space-y-1 border-b py-2">
            <div className="flex justify-between"><span>Transferencias:</span><span>{money(stats.transferSales + stats.transferPayments)}</span></div>
            <div className="flex justify-between"><span>Tarjetas:</span><span>{money(stats.cardSales)}</span></div>
            <div className="flex justify-between"><span>Fiados Emitidos:</span><span>{money(stats.creditSales)}</span></div>
            <div className="flex justify-between font-bold text-sm pt-1"><span>TOTAL DINERO LÍQUIDO:</span><span>{money(stats.totalLiquid)}</span></div>
          </div>
          <div className="pt-2 text-center text-[10px]">
            <p>Tickets emitidos: {stats.ticketCount} | Kilos despachados: {num(stats.totalKilos)} kg</p>
            <p className="mt-8 border-t pt-1">Firma del Cajero / Responsable</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

