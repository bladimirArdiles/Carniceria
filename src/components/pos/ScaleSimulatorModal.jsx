import { useState } from "react";
import { Barcode, Play, X, Info } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { generateScaleBarcode } from "../../lib/barcodeParser.js";

export default function ScaleSimulatorModal({ products = [], onSimulateScan, onClose }) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const [grams, setGrams] = useState("1250");
  const [scaleMode, setScaleMode] = useState("weight"); // "weight" | "price"
  const [customBarcode, setCustomBarcode] = useState("");

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const plu = selectedProduct?.plu || 1;

  const generatedBarcode = generateScaleBarcode(plu, parseFloat(grams) || 0, scaleMode);

  const handleSimulateGenerated = () => {
    onSimulateScan(generatedBarcode);
    onClose();
  };

  const handleSimulateCustom = (e) => {
    e.preventDefault();
    if (!customBarcode.trim()) return;
    onSimulateScan(customBarcode.trim());
    onClose();
  };

  return (
    <Modal title="Simulador de Balanza y Escáner de Códigos" onClose={onClose} size="md">
      <div className="space-y-5">
        <div className="rounded-2xl bg-amber-500/10 p-3.5 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
          <Info size={20} className="shrink-0 text-amber-600 mt-0.5" />
          <p>
            Herramienta de pruebas: simula el disparo láser de una balanza comercial (Systel, Kretz, Toledo) sin requerir hardware físico conectado.
          </p>
        </div>

        {/* Generador EAN-13 de Balanza */}
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 space-y-4 bg-zinc-50/50 dark:bg-zinc-850/50">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Barcode size={20} weight="bold" className="text-accent-600" />
            Generar Etiqueta de Balanza EAN-13
          </h3>

          <div>
            <label className="label text-xs">Corte a Pesar</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="field text-sm"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.plu ? `(PLU #${p.plu})` : "(Sin PLU)"} - ${p.price}/kg
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs">Modo Balanza</label>
              <select
                value={scaleMode}
                onChange={(e) => setScaleMode(e.target.value)}
                className="field text-sm"
              >
                <option value="weight">Peso (Gramos en código)</option>
                <option value="price">Importe ($ en código)</option>
              </select>
            </div>
            <div>
              <label className="label text-xs">
                {scaleMode === "weight" ? "Peso en Gramos (g)" : "Importe Total ($)"}
              </label>
              <input
                type="number"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                className="field font-mono font-bold text-sm"
                placeholder="Ej: 1500"
              />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">Código EAN-13 resultante:</span>
              <span className="font-mono text-base font-black tracking-widest text-zinc-900 dark:text-zinc-100">
                {generatedBarcode}
              </span>
            </div>
            <button
              type="button"
              onClick={handleSimulateGenerated}
              className="btn-primary h-10 px-4 text-xs font-bold flex items-center gap-1.5"
            >
              <Play size={16} weight="bold" />
              Simular Escaneo
            </button>
          </div>
        </div>

        {/* Probar Código Manual Directo */}
        <form onSubmit={handleSimulateCustom} className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <label className="label text-xs">O ingresar cualquier código de barras manual</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customBarcode}
              onChange={(e) => setCustomBarcode(e.target.value)}
              placeholder="Ej: 2000012015007 o 7791234567890"
              className="field font-mono text-sm flex-1"
            />
            <button
              type="submit"
              className="btn-ghost h-12 px-4 text-xs font-bold shrink-0"
            >
              Probar
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
