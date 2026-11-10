import { useState } from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  CloudCheck,
  CloudSlash,
  Clock,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { fmtDateTime, money } from "../../lib/format.js";

const ACTION_LABELS = {
  createSale: { label: "Venta de Mostrador", color: "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40" },
  voidSale: { label: "Anulación de Venta", color: "text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950/40" },
  addMovement: { label: "Movimiento de Stock", color: "text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/40" },
  addPayment: { label: "Cobro de Cuenta Corriente", color: "text-purple-700 bg-purple-50 dark:text-purple-300 dark:bg-purple-950/40" },
  addCashMovement: { label: "Gasto / Movimiento de Caja", color: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40" },
  saveProduct: { label: "Actualización de Corte", color: "text-zinc-700 bg-zinc-50 dark:text-zinc-300 dark:bg-zinc-800" },
  saveCustomer: { label: "Alta / Edición de Cliente", color: "text-indigo-700 bg-indigo-50 dark:text-indigo-300 dark:bg-indigo-950/40" },
};

export default function SyncQueueModal({
  outbox = [],
  isOnline,
  onSync,
  onSyncAll,
  onClearQueue,
  onResetLocal,
  onClose,
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await onSync();
      if (res && res.remainingCount > 0 && res.lastError) {
        setSyncMessage({
          type: "error",
          text: `Quedaron ${res.remainingCount} operaciones sin subir: ${res.lastError.message || "Error de permisos/base de datos"}`,
        });
      } else if (res && res.successCount > 0) {
        setSyncMessage({
          type: "success",
          text: `¡Éxito! Se sincronizaron ${res.successCount} operaciones con Supabase.`,
        });
      }
    } catch (err) {
      setSyncMessage({
        type: "error",
        text: err.message || "Fallo al sincronizar la cola.",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncAllLocal = async () => {
    if (!onSyncAll) return;
    setSyncingAll(true);
    setSyncMessage(null);
    try {
      const res = await onSyncAll();
      if (res?.success) {
        setSyncMessage({
          type: "success",
          text: "¡Todos los datos locales (clientes, cortes, compras y pagos) se respaldaron en Supabase!",
        });
      } else {
        setSyncMessage({
          type: "error",
          text: res?.error?.message || "Ocurrió un error al subir los datos locales a Supabase.",
        });
      }
    } catch (err) {
      setSyncMessage({
        type: "error",
        text: err.message || "Fallo de conexión con Supabase.",
      });
    } finally {
      setSyncingAll(false);
    }
  };

  return (
    <Modal title="Sincronización con Supabase (Nube)" onClose={onClose}>
      <div className="space-y-4">
        {/* Banner de estado de red */}
        <div
          className={`flex items-center justify-between rounded-2xl border p-3.5 text-xs font-bold ${
            isOnline
              ? "border-emerald-500/30 bg-emerald-50/70 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-amber-500/30 bg-amber-50/70 text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {isOnline ? (
              <CloudCheck size={20} weight="bold" className="text-emerald-600 dark:text-emerald-400" />
            ) : (
              <CloudSlash size={20} weight="bold" className="text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <p className="font-extrabold">{isOnline ? "Conexión a Internet Activa" : "Modo Offline (Sin Conexión)"}</p>
              <p className="font-normal opacity-90">
                {isOnline
                  ? "Conectado al servidor Supabase PostgreSQL."
                  : "El mostrador sigue cobrando localmente. Se enviará al reconectar."}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-xl bg-white px-2.5 py-1 font-mono text-xs shadow-sm dark:bg-zinc-800">
            {outbox.length} en cola
          </span>
        </div>

        {/* Mensaje de resultado de sincronización */}
        {syncMessage && (
          <div
            className={`rounded-xl border p-3 text-xs font-semibold ${
              syncMessage.type === "success"
                ? "border-emerald-500/30 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                : "border-red-500/30 bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-200"
            }`}
          >
            {syncMessage.text}
          </div>
        )}

        {/* Listado de operaciones en cola */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Operaciones pendientes de envío ({outbox.length})
            </p>
            {outbox.length > 0 && onClearQueue && (
              <button
                type="button"
                onClick={onClearQueue}
                className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1"
              >
                <Trash size={12} />
                Descartar cola
              </button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {outbox.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 py-6 text-center text-zinc-500 dark:border-zinc-700">
                <CheckCircle size={32} weight="duotone" className="mx-auto mb-1 text-emerald-500" />
                <p className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Cola al día</p>
                <p className="text-xs">No hay operaciones de mostrador pendientes.</p>
              </div>
            ) : (
              outbox.map((item, idx) => {
                const meta = ACTION_LABELS[item.action] || { label: item.action, color: "text-zinc-700 bg-zinc-100" };
                const payload = item.payload || {};

                return (
                  <div
                    key={item.id || idx}
                    className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/50 p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`rounded-md px-2 py-0.5 font-bold ${meta.color}`}>
                          {meta.label}
                        </span>
                        {payload.total && (
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {money(payload.total)}
                          </span>
                        )}
                        {payload.amount && (
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            {money(payload.amount)}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {payload.items?.length
                          ? `${payload.items.length} cortes vendidos (${payload.method || "Efectivo"})`
                          : payload.productName
                          ? `Corte: ${payload.productName} (${payload.type})`
                          : payload.note || payload.category || `ID: ${String(item.id).slice(0, 8)}...`}
                      </p>

                      <p className="flex items-center gap-1 text-[10px] text-zinc-400">
                        <Clock size={12} />
                        {item.createdAt ? fmtDateTime(item.createdAt) : "Reciente"}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Acciones principales de Sincronización */}
        <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          {outbox.length > 0 && (
            <button
              type="button"
              className="btn-primary w-full h-12 font-bold shadow-md flex items-center justify-center gap-2"
              onClick={handleSyncNow}
              disabled={syncing || syncingAll || !isOnline}
            >
              {syncing ? (
                <>
                  <ArrowsClockwise size={18} className="animate-spin" />
                  <span>Enviando operaciones pendientes...</span>
                </>
              ) : (
                <>
                  <ArrowsClockwise size={18} weight="bold" />
                  <span>Sincronizar cola pendiente ({outbox.length})</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/70 px-4 text-xs font-bold text-emerald-900 transition hover:bg-emerald-100 active:scale-95 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200 shadow-sm"
            onClick={handleSyncAllLocal}
            disabled={syncing || syncingAll || !isOnline}
          >
            {syncingAll ? (
              <>
                <ArrowsClockwise size={18} className="animate-spin" />
                <span>Subiendo todos los datos locales a Supabase...</span>
              </>
            ) : (
              <>
                <CloudCheck size={18} weight="bold" className="text-emerald-600 dark:text-emerald-400" />
                <span>Subir / Respaldar todos los datos locales a Supabase</span>
              </>
            )}
          </button>

          {onResetLocal && (
            <button
              type="button"
              className="flex h-10 w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50/60 px-4 text-xs font-bold text-red-700 hover:bg-red-100 transition active:scale-95 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
              onClick={() => {
                if (window.confirm("¿Estás seguro de que deseas vaciar y reiniciar todos los datos locales? El programa quedará como nuevo de fábrica.")) {
                  onResetLocal();
                  onClose();
                }
              }}
            >
              <Trash size={16} weight="bold" />
              <span>Reiniciar programa a cero (borrar datos locales)</span>
            </button>
          )}

          <button
            type="button"
            className="btn-ghost w-full font-bold h-10 text-xs"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
