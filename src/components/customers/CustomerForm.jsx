import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import Modal from "../ui/Modal.jsx";
import { uid } from "../../lib/format.js";

export default function CustomerForm({ customer, onSave, onClose }) {
  const [f, setF] = useState({
    name: customer?.name || "",
    dni: customer?.dni || "",
    phone: customer?.phone || "",
    address: customer?.address || "",
  });
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (!f.name.trim()) return setError("Escribí el nombre del cliente.");
    const cleanDni = f.dni ? f.dni.trim().replace(/[^\d]/g, "") : "";
    if (f.dni && cleanDni.length < 6) {
      return setError("El DNI debe tener al menos 6 dígitos numéricos.");
    }
    const cleanPhone = f.phone ? f.phone.trim().replace(/[^\d+ -]/g, "") : "";
    onSave({
      id: customer?.id || uid(),
      name: f.name.trim(),
      dni: cleanDni || "",
      phone: cleanPhone,
      address: f.address.trim(),
    });
  };

  return (
    <Modal title={customer ? "Editar cliente" : "Nuevo cliente"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div>
          <label className="label" htmlFor="cf-name">Nombre</label>
          <input id="cf-name" className="field" value={f.name} onChange={set("name")} autoComplete="off" />
        </div>
        <div>
          <label className="label" htmlFor="cf-dni">DNI</label>
          <input
            id="cf-dni"
            className="field font-mono"
            type="text"
            inputMode="numeric"
            placeholder="Ej. 35123456"
            value={f.dni}
            onChange={set("dni")}
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor="cf-phone">Teléfono</label>
          <input id="cf-phone" className="field" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="label" htmlFor="cf-address">Dirección</label>
          <input id="cf-address" className="field" value={f.address} onChange={set("address")} autoComplete="off" />
        </div>
        {error && <p role="alert" className="text-sm font-bold text-red-700 dark:text-red-400">{error}</p>}
        <button type="submit" className="btn-primary h-16 w-full text-lg"><Check size={24} weight="bold" />Guardar cliente</button>
      </form>
    </Modal>
  );
}
