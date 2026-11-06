import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS, useIndexedCollection } from "./storage.js";
import { SEED_PRODUCTS, round3, uid } from "./format.js";
import { isSupabaseConfigured } from "./supabase.js";
import { supabaseService } from "./supabaseService.js";
import {
  AppError,
  ValidationError,
  DatabaseError,
  parseDatabaseError,
  validateSaleData,
  validatePaymentData,
  validateMovementData,
  validateProductData,
  validateCustomerData,
} from "./validation.js";

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [products, setProducts] = useIndexedCollection("products", SEED_PRODUCTS);
  const [customers, setCustomers] = useIndexedCollection("customers", []);
  const [sales, setSales] = useIndexedCollection("sales", []);
  const [payments, setPayments] = useIndexedCollection("payments", []);
  const [movements, setMovements] = useIndexedCollection("movements", []);
  const [outbox, setOutbox] = useIndexedCollection("sync_outbox", []);
  const [toast, setToast] = useState(null);
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? "syncing" : "local"); // "local" | "syncing" | "synced" | "error"
  const isFlushingRef = useRef(false);

  const notify = useCallback((message) => {
    setToast({ message, id: uid() });
    setTimeout(() => setToast((t) => (t && t.message === message ? null : t)), 3200);
  }, []);

  // Procesa y vacía la cola de operaciones pendientes cuando hay conexión a internet
  const flushOutbox = useCallback(async () => {
    if (!isSupabaseConfigured || isFlushingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!outbox || outbox.length === 0) return;

    isFlushingRef.current = true;
    try {
      const remaining = [];
      let successCount = 0;

      for (const item of outbox) {
        try {
          if (item.action === "createSale") {
            const dbSale = await supabaseService.createSale(item.payload);
            if (dbSale) {
              setSales((prev) => prev.map((s) => (s.id === item.payload.id ? dbSale : s)));
            }
          } else if (item.action === "voidSale") {
            await supabaseService.voidSale(item.payload.id);
          } else if (item.action === "addMovement") {
            await supabaseService.addMovement(item.payload);
          } else if (item.action === "saveProduct") {
            await supabaseService.saveProduct(item.payload);
          } else if (item.action === "saveCustomer") {
            await supabaseService.saveCustomer(item.payload);
          } else if (item.action === "addPayment") {
            await supabaseService.addPayment(item.payload);
          }
          successCount++;
        } catch (itemErr) {
          console.warn("Fallo temporal al sincronizar outbox:", itemErr);
          remaining.push(item);
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            const idx = outbox.indexOf(item);
            remaining.push(...outbox.slice(idx + 1));
            break;
          }
        }
      }

      setOutbox(remaining);
      if (successCount > 0) {
        notify(`Sincronización: ${successCount} operación(es) enviada(s) a Supabase`);
        const [prods, custs] = await Promise.all([
          supabaseService.getProducts(),
          supabaseService.getCustomers(),
        ]);
        if (prods?.length) setProducts(prods);
        if (custs?.length) setCustomers(custs);
      }
    } catch (err) {
      console.error("Error en flushOutbox:", err);
    } finally {
      isFlushingRef.current = false;
    }
  }, [isSupabaseConfigured, outbox, notify, setOutbox, setSales, setProducts, setCustomers]);

  // Detector de reconexión de red automático
  useEffect(() => {
    const handleOnline = () => {
      notify("Conexión restablecida. Sincronizando cola de operaciones...");
      flushOutbox();
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [flushOutbox, notify]);

  // Sincronización inicial y carga desde Supabase (PostgreSQL)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    async function initSupabase() {
      try {
        setSyncStatus("syncing");
        await supabaseService.seedCatalogIfEmpty();

        const [prods, custs, sls, pymts, movs] = await Promise.all([
          supabaseService.getProducts(),
          supabaseService.getCustomers(),
          supabaseService.getSales(),
          supabaseService.getPayments(),
          supabaseService.getMovements(),
        ]);

        if (isMounted) {
          if (prods && prods.length > 0) setProducts(prods);
          if (custs && custs.length > 0) setCustomers(custs);
          if (sls && sls.length > 0) setSales(sls);
          if (pymts && pymts.length > 0) setPayments(pymts);
          if (movs && movs.length > 0) setMovements(movs);
          setSyncStatus("synced");
        }
      } catch (err) {
        console.error("Error al sincronizar con Supabase:", err);
        if (isMounted) {
          setSyncStatus("error");
          notify("No se pudo conectar a Supabase. Operando con almacenamiento local.");
        }
      }
    }

    initSupabase();
    return () => {
      isMounted = false;
    };
  }, [notify, setProducts, setCustomers, setSales, setPayments, setMovements]);

  // Asegurar que productos existentes reciban categoría si no la tenían
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

  const shiftStock = (items, sign) =>
    setProducts((prev) =>
      prev.map((p) => {
        const hit = items.filter((i) => i.productId === p.id);
        if (!hit.length) return p;
        return { ...p, stock: round3(p.stock + sign * hit.reduce((s, i) => s + i.qty, 0)) };
      })
    );

  /* Deuda de cada cliente (obtenida del balance de BD o calculada con consistencia transaccional) */
  const balances = useMemo(() => {
    const b = {};
    customers.forEach((c) => {
      b[c.id] = Number(c.balance || 0);
    });

    const hasExplicitBalances = customers.some((c) => typeof c.balance === "number" && c.balance !== 0);
    if (!hasExplicitBalances) {
      sales.forEach((s) => {
        if (s.method === "Fiado" && s.customerId && s.status !== "voided") {
          b[s.customerId] = (b[s.customerId] || 0) + Number(s.total || 0);
        }
      });
      payments.forEach((p) => {
        if (p.customerId) {
          b[p.customerId] = (b[p.customerId] || 0) - Number(p.amount || 0);
        }
      });
    }

    Object.keys(b).forEach((id) => {
      if (b[id] < 0) b[id] = 0;
    });

    return b;
  }, [customers, sales, payments]);

  const actions = {
    async completeSale({ items, customerId, method, tendered, change }) {
      try {
        // Validación de Dominio y Negocio
        const { validTotal, validTendered } = validateSaleData({
          items,
          method,
          customerId,
          tendered,
        });

        const tempId = uid();
        const localSale = {
          id: tempId,
          date: new Date().toISOString(),
          items,
          total: validTotal,
          method,
          customerId: customerId || null,
          tendered: validTendered || validTotal,
          change: change && change >= 0 ? change : Math.max(0, (validTendered || validTotal) - validTotal),
        };

        setSales((p) => [localSale, ...p]);
        shiftStock(items, -1);

        // Si es Fiado, registrar incremento de deuda de forma optimista inmediata
        if (method === "Fiado" && customerId) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId ? { ...c, balance: (c.balance || 0) + validTotal } : c
            )
          );
        }

        if (isSupabaseConfigured) {
          try {
            const dbSale = await supabaseService.createSale({
              items,
              customerId,
              method,
              tendered: localSale.tendered,
              change: localSale.change,
            });
            if (dbSale) {
              setSales((prev) =>
                prev.map((s) => (s.id === tempId ? { ...s, id: dbSale.id, ticketNumber: dbSale.ticketNumber } : s))
              );
              if (method === "Fiado" && customerId) {
                const custs = await supabaseService.getCustomers();
                if (custs.length) setCustomers(custs);
              }
              return { ...localSale, id: dbSale.id, ticketNumber: dbSale.ticketNumber };
            }
          } catch (err) {
            console.error("Error al persistir venta en Supabase:", err);
            const parsed = parseDatabaseError(err);
            setOutbox((prev) => [
              ...prev,
              {
                id: uid(),
                action: "createSale",
                payload: { ...localSale, id: tempId },
                createdAt: new Date().toISOString(),
              },
            ]);
            notify(`Venta guardada localmente y en cola (${parsed})`);
          }
        }

        return localSale;
      } catch (err) {
        const msg = err instanceof ValidationError ? err.message : parseDatabaseError(err);
        notify(msg);
        throw err;
      }
    },

    async voidSale(id) {
      try {
        if (!id) throw new ValidationError("Identificador de venta no válido.");
        const sale = sales.find((s) => s.id === id);
        if (!sale) throw new ValidationError("No se encontró la venta a anular.");
        if (sale.status === "voided") {
          throw new ValidationError("Esta venta ya fue anulada previamente.");
        }

        setSales((p) => p.filter((s) => s.id !== id));
        shiftStock(sale.items, +1);

        // Si la venta anulada era a Fiado, restar la deuda del cliente de inmediato
        if (sale.method === "Fiado" && sale.customerId) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === sale.customerId
                ? { ...c, balance: Math.max(0, (c.balance || 0) - sale.total) }
                : c
            )
          );
        }

        if (isSupabaseConfigured) {
          try {
            await supabaseService.voidSale(id);
            const [prods, custs] = await Promise.all([
              supabaseService.getProducts(),
              supabaseService.getCustomers(),
            ]);
            if (prods.length) setProducts(prods);
            if (custs.length) setCustomers(custs);
          } catch (err) {
            console.error("Error al anular venta en Supabase:", err);
            setOutbox((prev) => [
              ...prev,
              { id: uid(), action: "voidSale", payload: { id }, createdAt: new Date().toISOString() },
            ]);
            notify("Venta anulada localmente (" + parseDatabaseError(err) + ")");
          }
        }
      } catch (err) {
        const msg = err instanceof ValidationError ? err.message : parseDatabaseError(err);
        notify(msg);
        throw err;
      }
    },

    async addMovement({ productId, type, qty, note, cost }) {
      try {
        const product = products.find((p) => p.id === productId);
        if (!product) throw new ValidationError("El corte o producto seleccionado no existe.");

        const { cleanQty, cleanCost } = validateMovementData({
          productId,
          type,
          qty,
          cost,
          currentStock: product.stock,
        });

        const delta = type === "compra" ? cleanQty : type === "merma" ? -cleanQty : round3(cleanQty - product.stock);
        setProducts((p) => p.map((x) => (x.id === productId ? { ...x, stock: round3(x.stock + delta) } : x)));
        const newMov = {
          id: uid(),
          date: new Date().toISOString(),
          productId,
          productName: product.name,
          unit: product.unit,
          type,
          delta,
          note: (note || "").trim(),
          cost: cleanCost,
        };
        setMovements((p) => [newMov, ...p]);

        if (isSupabaseConfigured) {
          try {
            await supabaseService.addMovement({
              productId,
              type,
              qty: cleanQty,
              note: newMov.note,
              cost: cleanCost,
            });
            const prods = await supabaseService.getProducts();
            if (prods.length) setProducts(prods);
          } catch (err) {
            console.error("Error al registrar movimiento en Supabase:", err);
            setOutbox((prev) => [
              ...prev,
              {
                id: uid(),
                action: "addMovement",
                payload: { productId, type, qty: cleanQty, note: newMov.note, cost: cleanCost },
                createdAt: new Date().toISOString(),
              },
            ]);
            notify("Movimiento guardado localmente (" + parseDatabaseError(err) + ")");
          }
        }
      } catch (err) {
        const msg = err instanceof ValidationError ? err.message : parseDatabaseError(err);
        notify(msg);
        throw err;
      }
    },

    async saveProduct(prod) {
      try {
        const { cleanName, cleanPrice, cleanMinStock, cleanUnit } = validateProductData({
          name: prod.name,
          price: prod.price,
          minStock: prod.minStock,
          unit: prod.unit,
        });

        const validatedProd = {
          ...prod,
          name: cleanName,
          price: cleanPrice,
          minStock: cleanMinStock,
          unit: cleanUnit,
          category: prod.category?.trim() || "Otros",
        };

        // Actualización optimista local
        setProducts((p) =>
          p.some((x) => x.id === validatedProd.id)
            ? p.map((x) => (x.id === validatedProd.id ? { ...x, ...validatedProd } : x))
            : [...p, validatedProd]
        );

        if (isSupabaseConfigured) {
          try {
            const saved = await supabaseService.saveProduct(validatedProd);
            if (saved) {
              setProducts((prev) => prev.map((x) => (x.id === validatedProd.id || x.name === saved.name ? saved : x)));
            }
          } catch (err) {
            console.error("Error al guardar producto en Supabase:", err);
            setOutbox((prev) => [
              ...prev,
              { id: uid(), action: "saveProduct", payload: validatedProd, createdAt: new Date().toISOString() },
            ]);
            notify("Producto guardado localmente (" + parseDatabaseError(err) + ")");
          }
        }
      } catch (err) {
        const msg = err instanceof ValidationError ? err.message : parseDatabaseError(err);
        notify(msg);
        throw err;
      }
    },

    async deleteProduct(id) {
      try {
        if (!id) throw new ValidationError("Identificador de producto no válido.");
        setProducts((p) => p.filter((x) => x.id !== id));

        if (isSupabaseConfigured) {
          try {
            await supabaseService.deleteProduct(id);
          } catch (err) {
            console.error("Error al eliminar producto en Supabase:", err);
            notify("Error al eliminar en Supabase: " + parseDatabaseError(err));
          }
        }
      } catch (err) {
        const msg = err instanceof ValidationError ? err.message : parseDatabaseError(err);
        notify(msg);
        throw err;
      }
    },

    async saveCustomer(c) {
      try {
        const { cleanName, cleanDni, cleanPhone, cleanAddress } = validateCustomerData({
          name: c.name,
          dni: c.dni,
          phone: c.phone,
          address: c.address,
        });

        const validatedCust = {
          ...c,
          name: cleanName,
          dni: cleanDni,
          phone: cleanPhone,
          address: cleanAddress,
        };

        setCustomers((p) =>
          p.some((x) => x.id === validatedCust.id)
            ? p.map((x) => (x.id === validatedCust.id ? validatedCust : x))
            : [...p, validatedCust]
        );

        if (isSupabaseConfigured) {
          try {
            const saved = await supabaseService.saveCustomer(validatedCust);
            if (saved) {
              setCustomers((prev) => prev.map((x) => (x.id === validatedCust.id || x.name === saved.name ? saved : x)));
            }
          } catch (err) {
            console.error("Error al guardar cliente en Supabase:", err);
            setOutbox((prev) => [
              ...prev,
              { id: uid(), action: "saveCustomer", payload: validatedCust, createdAt: new Date().toISOString() },
            ]);
            notify("Cliente guardado localmente (" + parseDatabaseError(err) + ")");
          }
        }
      } catch (err) {
        const msg = err instanceof ValidationError ? err.message : parseDatabaseError(err);
        notify(msg);
        throw err;
      }
    },

    async deleteCustomer(id) {
      try {
        if (!id) throw new ValidationError("Identificador de cliente no válido.");
        setCustomers((p) => p.filter((x) => x.id !== id));

        if (isSupabaseConfigured) {
          try {
            await supabaseService.deleteCustomer(id);
          } catch (err) {
            console.error("Error al eliminar cliente en Supabase:", err);
            notify("Error al eliminar en Supabase: " + parseDatabaseError(err));
          }
        }
      } catch (err) {
        const msg = err instanceof ValidationError ? err.message : parseDatabaseError(err);
        notify(msg);
        throw err;
      }
    },

    async addPayment({ customerId, amount, method }) {
      try {
        const currentBal = balances[customerId] || 0;
        const { validAmount } = validatePaymentData({
          customerId,
          amount,
          method,
          balance: currentBal,
        });

        const localP = {
          id: uid(),
          date: new Date().toISOString(),
          customerId,
          amount: validAmount,
          method: method || "Efectivo",
        };
        setPayments((p) => [localP, ...p]);

        // Reducir la deuda en el cliente de forma inmediata y optimista
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? { ...c, balance: Math.max(0, (c.balance || 0) - validAmount) }
              : c
          )
        );

        if (isSupabaseConfigured) {
          try {
            const dbPayment = await supabaseService.addPayment({
              customerId,
              amount: validAmount,
              method: localP.method,
            });
            if (dbPayment) {
              setPayments((prev) => prev.map((x) => (x.id === localP.id ? dbPayment : x)));
            }
            const custs = await supabaseService.getCustomers();
            if (custs.length) setCustomers(custs);
          } catch (err) {
            console.error("Error al registrar pago en Supabase:", err);
            setOutbox((prev) => [
              ...prev,
              {
                id: uid(),
                action: "addPayment",
                payload: { customerId, amount: validAmount, method: localP.method },
                createdAt: new Date().toISOString(),
              },
            ]);
            notify("Cobro guardado localmente (" + parseDatabaseError(err) + ")");
          }
        }
      } catch (err) {
        const msg = err instanceof ValidationError ? err.message : parseDatabaseError(err);
        notify(msg);
        throw err;
      }
    },

    async saveCashClosing(closingData) {
      if (isSupabaseConfigured) {
        try {
          await supabaseService.saveCashClosing(closingData);
          notify("Cierre de caja Z guardado en la base de datos");
        } catch (err) {
          console.error("Error al registrar cierre de caja en Supabase:", err);
          notify("Cierre Z registrado localmente");
        }
      } else {
        notify("Cierre de caja Z registrado exitosamente");
      }
    },

    async loadSalesRange({ startDate, endDate, limit } = {}) {
      if (!isSupabaseConfigured) return [];
      try {
        const fetched = await supabaseService.getSales({ startDate, endDate, limit });
        if (fetched && fetched.length > 0) {
          setSales((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const newSales = fetched.filter((s) => !existingIds.has(s.id));
            if (newSales.length === 0) return prev;
            return [...prev, ...newSales].sort((a, b) => (a.date < b.date ? 1 : -1));
          });
        }
        return fetched;
      } catch (err) {
        console.error("Error al cargar rango de ventas:", err);
        return [];
      }
    },

    async syncWithSupabase() {
      if (!isSupabaseConfigured) {
        notify("Configurá tu VITE_SUPABASE_ANON_KEY en el archivo .env primero");
        return;
      }
      try {
        setSyncStatus("syncing");
        notify("Sincronizando con Supabase...");
        await flushOutbox();
        const [prods, custs, sls, pymts, movs] = await Promise.all([
          supabaseService.getProducts(),
          supabaseService.getCustomers(),
          supabaseService.getSales(),
          supabaseService.getPayments(),
          supabaseService.getMovements(),
        ]);
        if (prods) setProducts(prods);
        if (custs) setCustomers(custs);
        if (sls) setSales(sls);
        if (pymts) setPayments(pymts);
        if (movs) setMovements(movs);
        setSyncStatus("synced");
        notify("Base de datos sincronizada con éxito");
      } catch (err) {
        setSyncStatus("error");
        notify("Error al sincronizar: " + (err.message || "Fallo de conexión"));
      }
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

  const value = {
    products,
    customers,
    sales,
    payments,
    movements,
    balances,
    outbox,
    outboxCount: outbox ? outbox.length : 0,
    flushOutbox,
    toast,
    notify,
    syncStatus,
    isSupabaseConfigured,
    ...actions,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { STORAGE_KEYS };
