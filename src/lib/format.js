export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const moneyFmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });

export const money = (n) => moneyFmt.format(Math.round(n || 0));
export const num = (n) => numFmt.format(n || 0);
export const qtyText = (n, unit) => `${num(n)} ${unit === "kg" ? "kg" : "u"}`;
export const round3 = (n) => Math.round(n * 1000) / 1000;
export const lineTotal = (qty, price) => Math.round(qty * price);

const pad = (n) => String(n).padStart(2, "0");

export const dayKey = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
};
export const monthKey = (d = new Date()) => dayKey(d).slice(0, 7);

export const weekStartKey = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return dayKey(x);
};

export const fmtDay = (key) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(key + "T00:00:00"));

export const fmtMonth = (key) => {
  const [y, m] = key.split("-");
  return new Intl.DateTimeFormat("es-AR", { month: "short", year: "2-digit" }).format(new Date(Number(y), Number(m) - 1, 1));
};

export const fmtDateTime = (iso) =>
  new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const fmtLongDate = (d = new Date()) =>
  new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(d);

export const DEFAULT_CATEGORIES = ["Vaca", "Cerdo", "Pollo", "Achuras", "Embutidos", "Elaborados", "Otros"];

export const SEED_PRODUCTS = [
  { id: "p-asado", name: "Asado", category: "Vaca", unit: "kg", price: 11900, stock: 38.5, minStock: 10 },
  { id: "p-vacio", name: "Vacío", category: "Vaca", unit: "kg", price: 13800, stock: 22.4, minStock: 8 },
  { id: "p-lomo", name: "Lomo", category: "Vaca", unit: "kg", price: 17500, stock: 9.2, minStock: 6 },
  { id: "p-polvo", name: "Polvo", category: "Vaca", unit: "kg", price: 9400, stock: 14.7, minStock: 6 },
  { id: "p-chorizo", name: "Chorizo", category: "Embutidos", unit: "u", price: 1350, stock: 64, minStock: 20 },
  { id: "p-bife", name: "Bife de chorizo", category: "Vaca", unit: "kg", price: 15200, stock: 12.8, minStock: 5 },
  { id: "p-entrana", name: "Entraña", category: "Vaca", unit: "kg", price: 16400, stock: 7.3, minStock: 4 },
  { id: "p-matambre", name: "Matambre", category: "Vaca", unit: "kg", price: 12700, stock: 3.1, minStock: 5 },
  { id: "p-picada", name: "Carne picada", category: "Vaca", unit: "kg", price: 8600, stock: 26.9, minStock: 10 },
  { id: "p-pollo", name: "Pollo entero", category: "Pollo", unit: "u", price: 7800, stock: 18, minStock: 6 },
  { id: "p-morcilla", name: "Morcilla", category: "Embutidos", unit: "u", price: 1100, stock: 0, minStock: 12 },
];

export const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta"];
export const ALL_PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta", "Fiado"];
