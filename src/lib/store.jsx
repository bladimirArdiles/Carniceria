import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS, useStored } from "./storage.js";
import { SEED_PRODUCTS, round3, uid } from "./format.js";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [products, setProducts] = useStored("products", SEED_PRODUCTS);
  const [customers, setCustomers] = useStored("customers", []);
  const [sales, setSales] = useStored("sales", []);
  const [payments, setPayments] = useStored("payments", []);
  const [movements, setMovements] = useStored("movements", []);
  const [toast, setToast] = useState(null);

  // Asegurar que productos existentes en localStorage reciban categoría si no la tenían
  useEffect(() => {
    let needsUpdate = false;
    const seedMap = new Map(SEED_PRODUCTS.map((s) => [s.id, s.category]));
    const updated = products.map((p) => {
      if (p.category) return p;
      needsUpdate = true;
      const seedCat = seedMap.get(p.id);
      if (seedCat) return { ...p, category: seedCat };
      const n = (p.name || "").toLowerCase();
      let cat = "Vaca";
      if (n.includes("pollo")) cat = "Pollo";
      else if (n.includes("cerdo") || n.includes("pechito") || n.includes("bondiola")) cat = "Cerdo";
      else if (n.includes("chorizo") || n.includes("morcilla") || n.includes("salchicha")) cat = "Embutidos";
      else if (n.includes("chinchulin") || n.includes("molleja") || n.includes("higado") || n.includes("rinon")) cat = "Achuras";
      return { ...p, category: cat };
    });
    if (needsUpdate) {
      setProducts(updated);
    }
  }, [products, setProducts]);

  const notify = useCallback((message) => {
    setToast({ message, id: uid() });
    setTimeout(() => setToast((t) => (t && t.message === message ? null : t)), 3200);
  }, []);

  const shiftStock = (items, sign) =>
    setProducts((prev) =>
      prev.map((p) => {
        const hit = items.filter((i) => i.productId === p.id);
        if (!hit.length) return p;
        return { ...p, stock: round3(p.stock + sign * hit.reduce((s, i) => s + i.qty, 0)) };
      })
    );

  /* Deuda de cada cliente = ventas fiadas - pagos recibidos */
  const balances = useMemo(() => {
    const b = {};
    sales.forEach((s) => {
      if (s.method === "Fiado" && s.customerId) b[s.customerId] = (b[s.customerId] || 0) + s.total;
    });
    payments.forEach((p) => {
      b[p.customerId] = (b[p.customerId] || 0) - p.amount;
    });
    return b;
  }, [sales, payments]);

  const actions = {
    completeSale({ items, customerId, method }) {
      const total = items.reduce((s, i) => s + i.total, 0);
      const sale = { id: uid(), date: new Date().toISOString(), items, total, method, customerId: customerId || null };
      setSales((p) => [...p, sale]);
      shiftStock(items, -1);
      return sale;
    },
    voidSale(id) {
      const sale = sales.find((s) => s.id === id);
      if (!sale) return;
      setSales((p) => p.filter((s) => s.id !== id));
      shiftStock(sale.items, +1);
    },
    addMovement({ productId, type, qty, note, cost }) {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      const delta = type === "compra" ? qty : type === "merma" ? -qty : round3(qty - product.stock);
      setProducts((p) => p.map((x) => (x.id === productId ? { ...x, stock: round3(x.stock + delta) } : x)));
      setMovements((p) => [
        ...p,
        { id: uid(), date: new Date().toISOString(), productId, productName: product.name, unit: product.unit, type, delta, note: note || "", cost: cost || 0 },
      ]);
    },
    saveProduct(prod) {
      setProducts((p) => (p.some((x) => x.id === prod.id) ? p.map((x) => (x.id === prod.id ? { ...x, ...prod } : x)) : [...p, prod]));
    },
    deleteProduct(id) {
      setProducts((p) => p.filter((x) => x.id !== id));
    },
    saveCustomer(c) {
      setCustomers((p) => (p.some((x) => x.id === c.id) ? p.map((x) => (x.id === c.id ? c : x)) : [...p, c]));
    },
    deleteCustomer(id) {
      setCustomers((p) => p.filter((x) => x.id !== id));
    },
    addPayment({ customerId, amount, method }) {
      setPayments((p) => [...p, { id: uid(), date: new Date().toISOString(), customerId, amount, method }]);
    },
    exportAll() {
      return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), products, customers, sales, payments, movements });
    },
    importAll(json) {
      const d = JSON.parse(json);
      if (!Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error("Archivo de respaldo no válido");
      setProducts(d.products);
      setCustomers(d.customers || []);
      setSales(d.sales);
      setPayments(d.payments || []);
      setMovements(d.movements || []);
    },
  };

  const value = { products, customers, sales, payments, movements, balances, toast, notify, ...actions };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { STORAGE_KEYS };
