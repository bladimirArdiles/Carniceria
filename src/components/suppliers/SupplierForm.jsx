import { useState } from "react";
import { Check, Trash } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import ConfirmButton from "../ui/ConfirmButton.jsx";

const CATEGORIES = ["Frigorífico", "Hacienda", "Pollería", "Insumos", "Servicios", "Otros"];

export default function SupplierForm({ supplier, onSave, onDelete, onClose }) {
  const [name, setName] = useState(supplier?.name || "");
  const [cuitDni, setCuitDni] = useState(supplier?.cuitDni || "");
  const [phone, setPhone] = useState(supplier?.phone || "");
  const [category, setCategory] = useState(supplier?.category || "Frigorífico");
  const [notes, setNotes] = useState(supplier?.notes || "");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Escribí el nombre del proveedor o distribuidor.");

    const newId = supplier?.id || (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : undefined);
    onSave({
      id: newId,
      name: name.trim(),
      cuitDni: cuitDni.trim(),
      phone: phone.trim(),
      category,
      notes: notes.trim(),
    });
  };

  return (
    <Modal title={supplier ? "Editar Proveedor" : "Nuevo Proveedor"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-50 p-3 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div>
          <label className="label" htmlFor="supp-name">
            Nombre / Razón Social
          </label>
          <input
            id="supp-name"
            className="field font-bold"
            placeholder="Ej: Frigorífico San José / Avícola del Sur"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="supp-category">
              Categoría / Rubro
            </label>
            <select
              id="supp-category"
              className="field font-semibold"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="supp-cuit">
              CUIT / DNI
            </label>
            <input
              id="supp-cuit"
              className="field font-mono"
              placeholder="Ej: 30-71234567-8"
              value={cuitDni}
              onChange={(e) => setCuitDni(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="supp-phone">
            Teléfono de contacto / Pedidos
          </label>
          <input
            id="supp-phone"
            type="tel"
            className="field font-mono"
            placeholder="Ej: 11 4567-8900"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="supp-notes">
            Notas / Condiciones comerciales
          </label>
          <textarea
            id="supp-notes"
            className="field min-h-20 text-sm"
            placeholder="Días de entrega, plazos de pago (ej: 7 días fecha factura)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex gap-2.5 pt-2">
          {supplier && onDelete && (
            <ConfirmButton
              type="button"
              className="btn-danger flex-1 font-bold"
              confirmText="¿Confirmar baja?"
              onConfirm={() => onDelete(supplier.id)}
            >
              <Trash size={18} weight="bold" />
              Dar de baja
            </ConfirmButton>
          )}
          <button type="button" className="btn-ghost flex-1 font-bold" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary flex-1 font-bold shadow-md">
            <Check size={18} weight="bold" />
            Guardar
          </button>
        </div>
      </form>
    </Modal>
  );
}
