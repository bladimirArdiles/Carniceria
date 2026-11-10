import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { STORAGE_KEYS, useIndexedCollection } from "./storage.js";
import { idbClear } from "./idb.js";
import { SEED_PRODUCTS, getProductCategory, round3, uid } from "./format.js";
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
  const [products, setProducts] = useIndexedCollection("products", []);
  const [customers, setCustomers] = useIndexedCollection("customers", []);
  const [sales, setSales] = useIndexedCollection("sales", []);
  const [payments, setPayments] = useIndexedCollection("payments", []);
  const [movements, setMovements] = useIndexedCollection("movements", []);
  const [cashMovements, setCashMovements] = useIndexedCollection("cash_movements", []);
  const [suppliers, setSuppliers] = useIndexedCollection("suppliers", []);
  const [supplierPurchases, setSupplierPurchases] = useIndexedCollection("supplier_purchases", []);
  const [supplierPayments, setSupplierPayments] = useIndexedCollection("supplier_payments", []);
  const [outbox, setOutbox] = useIndexedCollection("sync_outbox", []);
  const [toast, setToast] = useState(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncStatus, setSyncStatus] = useState(
    !isSupabaseConfigured
      ? "local"
      : typeof navigator !== "undefined" && !navigator.onLine
      ? "offline"
      : "syncing"
  ); // "local" | "syncing" | "synced" | "error" | "offline"
  const isFlushingRef = useRef(false);

  const notify = useCallback((message) => {
    setToast({ message, id: uid() });
    setTimeout(() => setToast((t) => (t && t.message === message ? null : t)), 3200);
  }, []);

  // Procesa y vacía la cola de operaciones pendientes cuando hay conexión a internet
  const flushOutbox = useCallback(async () => {
    if (!isSupabaseConfigured || isFlushingRef.current) return { successCount: 0, remainingCount: 0 };
    if (typeof navigator !== "undefined" && !navigator.onLine) return { successCount: 0, remainingCount: outbox.length };
    if (!outbox || outbox.length === 0) return { successCount: 0, remainingCount: 0 };

    isFlushingRef.current = true;
    try {
      const remaining = [];
      let successCount = 0;
      let lastError = null;

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
          } else if (item.action === "addCashMovement") {
            await supabaseService.addCashMovement(item.payload);
          } else if (item.action === "saveSupplier") {
            await supabaseService.saveSupplier(item.payload);
          } else if (item.action === "addSupplierPurchase") {
            await supabaseService.addSupplierPurchase(item.payload);
          } else if (item.action === "addSupplierPayment") {
            await supabaseService.addSupplierPayment(item.payload);
          }
          successCount++;
        } catch (itemErr) {
          lastError = itemErr;
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
        const [prods, custs, supps, suppPurchs, suppPymts] = await Promise.all([
          supabaseService.getProducts(),
          supabaseService.getCustomers(),
          supabaseService.getSuppliers(),
          supabaseService.getSupplierPurchases(),
          supabaseService.getSupplierPayments(),
        ]);
        if (prods?.length) setProducts(prods);
        if (custs?.length) setCustomers(custs);
        if (supps?.length) setSuppliers(supps);
        if (suppPurchs?.length) setSupplierPurchases(suppPurchs);
        if (suppPymts?.length) setSupplierPayments(suppPymts);
      } else if (remaining.length > 0 && lastError) {
        notify(`Aviso: ${remaining.length} op. en cola (${parseDatabaseError(lastError)})`);
      }
      return { successCount, remainingCount: remaining.length, lastError };
    } catch (err) {
      console.error("Error en flushOutbox:", err);
      return { successCount: 0, remainingCount: outbox.length, lastError: err };
    } finally {
      isFlushingRef.current = false;
    }
  }, [isSupabaseConfigured, outbox, notify, setOutbox, setSales, setProducts, setCustomers, setSuppliers, setSupplierPurchases, setSupplierPayments]);

  // Detector de conexión de red automático (Online / Offline)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus("syncing");
      notify("🌐 Conexión restablecida. Sincronizando cola de operaciones...");
      flushOutbox().then(() => {
        setSyncStatus("synced");
      }).catch(() => {
        setSyncStatus("error");
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus("offline");
      notify("📡 Sin conexión a internet. Operando en modo local seguro.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flushOutbox, notify]);

  // Sincronización inicial y carga desde Supabase (PostgreSQL)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    async function initSupabase() {
      // Si el navegador está offline al iniciar, no esperar timeout de red
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        if (isMounted) {
          setIsOnline(false);
          setSyncStatus("offline");
          notify("Iniciando en modo offline. Los datos se cargarán desde el almacenamiento local.");
        }
        return;
      }

      try {
        setSyncStatus("syncing");
        await supabaseService.seedCatalogIfEmpty();

        const [prods, custs, sls, pymts, movs, cashMovs, supps, suppPurchs, suppPymts] = await Promise.all([
          supabaseService.getProducts(),
          supabaseService.getCustomers(),
          supabaseService.getSales(),
          supabaseService.getPayments(),
          supabaseService.getMovements(),
          supabaseService.getCashMovements(),
          supabaseService.getSuppliers(),
          supabaseService.getSupplierPurchases(),
          supabaseService.getSupplierPayments(),
        ]);

        if (isMounted) {
          setProducts(prods || []);
          setCustomers(custs || []);
          setSales(sls || []);
          setPayments(pymts || []);
          setMovements(movs || []);
          setCashMovements(cashMovs || []);
          setSuppliers(supps || []);
          setSupplierPurchases(suppPurchs || []);
          setSupplierPayments(suppPymts || []);
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

  /* Saldos normalizados de clientes: lectura O(1) indexada sin recalcular decenas de miles de ventas */
  const balances = useMemo(() => {
    const b = {};
    for (const c of customers) {
      b[c.id] = Number(c.balance || 0);
    }
    return b;
  }, [customers]);

  const actions = {
    async completeSale({ items, customerId, method, tendered, change, overrideCreditLimit = false }) {
      try {
        // Validación de Dominio y Negocio
        const { validTotal, validTendered } = validateSaleData({
          items,
          method,
          customerId,
          tendered,
        });

        // Verificación estricta de cupo de fiado y riesgo crediticio
        if (method === "Fiado" && customerId) {
          const cust = customers.find((c) => c.id === customerId);
          if (cust && cust.allowCredit === false && !overrideCreditLimit) {
            throw new ValidationError("Este cliente tiene las ventas a fiado inhabilitadas. Requiere autorización de supervisor.");
          }
          const creditLimit = Number(cust?.creditLimit || 0);
          const currentDebt = Number(cust?.balance || 0);
          if (creditLimit > 0 && (currentDebt + validTotal) > creditLimit && !overrideCreditLimit) {
            throw new ValidationError(
              `Límite de fiado superado ($${creditLimit.toLocaleString("es-AR")}). Deuda: $${currentDebt.toLocaleString("es-AR")}, Venta: $${validTotal.toLocaleString("es-AR")}. Requiere clave de supervisor.`
            );
          }
        }

        const tempId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uid();
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

        const isOffline = !isOnline || (typeof navigator !== "undefined" && !navigator.onLine);

        if (isSupabaseConfigured && !isOffline) {
          try {
            const dbSale = await supabaseService.createSale({
              items,
              customerId,
              method,
              tendered: localSale.tendered,
              change: localSale.change,
              clientMutationId: tempId,
              overrideCreditLimit,
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
                payload: { ...localSale, id: tempId, clientMutationId: tempId, overrideCreditLimit },
                createdAt: new Date().toISOString(),
              },
            ]);
            notify(`Venta guardada localmente y en cola (${parsed})`);
          }
        } else if (isSupabaseConfigured && isOffline) {
          setOutbox((prev) => [
            ...prev,
            {
              id: uid(),
              action: "createSale",
              payload: { ...localSale, id: tempId, clientMutationId: tempId, overrideCreditLimit },
              createdAt: new Date().toISOString(),
            },
          ]);
          notify("Venta guardada en mostrador (Modo offline)");
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

        // Preservación contable: no eliminar físicamente el registro para auditoría
        setSales((p) =>
          p.map((s) =>
            s.id === id
              ? { ...s, status: "voided", voidedAt: new Date().toISOString() }
              : s
          )
        );
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

        const isOffline = !isOnline || (typeof navigator !== "undefined" && !navigator.onLine);

        if (isSupabaseConfigured && !isOffline) {
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
        } else if (isSupabaseConfigured && isOffline) {
          setOutbox((prev) => [
            ...prev,
            { id: uid(), action: "voidSale", payload: { id }, createdAt: new Date().toISOString() },
          ]);
          notify("Anulación guardada en mostrador (Modo offline)");
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
        const movId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uid();
        const newMov = {
          id: movId,
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

        const isOffline = !isOnline || (typeof navigator !== "undefined" && !navigator.onLine);

        if (isSupabaseConfigured && !isOffline) {
          try {
            await supabaseService.addMovement({
              productId,
              type,
              qty: cleanQty,
              note: newMov.note,
              cost: cleanCost,
              clientMutationId: newMov.id,
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
                payload: { productId, type, qty: cleanQty, note: newMov.note, cost: cleanCost, clientMutationId: newMov.id },
                createdAt: new Date().toISOString(),
              },
            ]);
            notify("Movimiento guardado localmente (" + parseDatabaseError(err) + ")");
          }
        } else if (isSupabaseConfigured && isOffline) {
          setOutbox((prev) => [
            ...prev,
            {
              id: uid(),
              action: "addMovement",
              payload: { productId, type, qty: cleanQty, note: newMov.note, cost: cleanCost, clientMutationId: newMov.id },
              createdAt: new Date().toISOString(),
            },
          ]);
          notify("Movimiento de stock guardado en mostrador (Modo offline)");
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

    async bulkUpdatePrices({ categoryName = "Todas", type = "percentage", value = 0, roundTo = 10, targetField = "price" }) {
      const numVal = Number(value);
      if (isNaN(numVal) || numVal === 0) {
        throw new ValidationError("El valor de ajuste debe ser un número distinto de cero.");
      }

      if (isSupabaseConfigured) {
        try {
          const res = await supabaseService.bulkUpdatePrices({
            categoryName,
            type,
            value: numVal,
            roundTo: Number(roundTo),
            targetField,
          });

          // Recargar catálogo actualizado desde la base de datos
          const prods = await supabaseService.getProducts();
          if (prods && prods.length > 0) {
            setProducts(prods);
          }
          notify(`Precios actualizados en base de datos: ${res?.updatedCount || 0} cortes modificados.`);
          return res;
        } catch (err) {
          console.error("Error en rpc_bulk_update_prices:", err);
          const msg = parseDatabaseError(err);
          notify(`Error al actualizar precios: ${msg}`);
          throw err;
        }
      } else {
        // Fallback local en memoria / IndexedDB para modo offline
        const factor = Number(roundTo) > 1 ? Number(roundTo) : 1;
        const calcNew = (current) => {
          let v = type === "percentage" ? current * (1 + numVal / 100) : current + numVal;
          v = Math.round(v / factor) * factor;
          return Math.max(v, targetField === "cost" ? 0 : 1);
        };

        let count = 0;
        setProducts((prev) =>
          prev.map((p) => {
            const pCat = getProductCategory(p);
            const matches = categoryName === "Todas" || pCat.toLowerCase() === categoryName.toLowerCase();
            if (!matches) return p;

            count++;
            const newPrice = targetField === "cost" ? p.price : calcNew(p.price);
            const newCost = targetField === "price" ? p.cost : calcNew(p.cost || 0);
            return {
              ...p,
              price: newPrice,
              cost: newCost,
            };
          })
        );
        notify(`Precios actualizados localmente: ${count} cortes modificados.`);
        return { success: true, updatedCount: count };
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

        const localPaymentId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uid();
        const localP = {
          id: localPaymentId,
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

        const isOffline = !isOnline || (typeof navigator !== "undefined" && !navigator.onLine);

        if (isSupabaseConfigured && !isOffline) {
          try {
            const dbPayment = await supabaseService.addPayment({
              customerId,
              amount: validAmount,
              method: localP.method,
              clientMutationId: localP.id,
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
                payload: { customerId, amount: validAmount, method: localP.method, clientMutationId: localP.id },
                createdAt: new Date().toISOString(),
              },
            ]);
            notify("Cobro guardado localmente (" + parseDatabaseError(err) + ")");
          }
        } else if (isSupabaseConfigured && isOffline) {
          setOutbox((prev) => [
            ...prev,
            {
              id: uid(),
              action: "addPayment",
              payload: { customerId, amount: validAmount, method: localP.method, clientMutationId: localP.id },
              createdAt: new Date().toISOString(),
            },
          ]);
          notify("Cobro guardado en mostrador (Modo offline)");
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
            const fetchedMap = new Map(fetched.map((s) => [s.id, s]));
            const updated = prev.map((s) => fetchedMap.get(s.id) || s);
            const prevIds = new Set(prev.map((s) => s.id));
            const additions = fetched.filter((s) => !prevIds.has(s.id));
            return [...updated, ...additions].sort((a, b) => (a.date < b.date ? 1 : -1));
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
        return { success: false };
      }
      try {
        setSyncStatus("syncing");
        notify("Sincronizando con Supabase...");
        await flushOutbox();
        const [prods, custs, sls, pymts, movs, supps, suppPurchs, suppPymts] = await Promise.all([
          supabaseService.getProducts(),
          supabaseService.getCustomers(),
          supabaseService.getSales(),
          supabaseService.getPayments(),
          supabaseService.getMovements(),
          supabaseService.getSuppliers(),
          supabaseService.getSupplierPurchases(),
          supabaseService.getSupplierPayments(),
        ]);
        if (prods?.length) setProducts(prods);
        if (custs?.length) setCustomers(custs);
        if (sls?.length) setSales(sls);
        if (pymts?.length) setPayments(pymts);
        if (movs?.length) setMovements(movs);
        if (supps?.length) setSuppliers(supps);
        if (suppPurchs?.length) setSupplierPurchases(suppPurchs);
        if (suppPymts?.length) setSupplierPayments(suppPymts);
        setSyncStatus("synced");
        notify("Base de datos sincronizada con éxito");
        return { success: true };
      } catch (err) {
        setSyncStatus("error");
        notify("Error al sincronizar: " + (err.message || "Fallo de conexión"));
        return { success: false, error: err };
      }
    },

    async syncAllLocalToSupabase() {
      if (!isSupabaseConfigured) {
        notify("Configurá tu VITE_SUPABASE_ANON_KEY en el archivo .env primero");
        return { success: false };
      }
      try {
        setSyncStatus("syncing");
        notify("Subiendo y respaldando datos locales en Supabase...");

        // 1. Procesar cualquier mutación en cola primero
        await flushOutbox();

        // 2. Subir productos locales a Supabase
        let prodsUploaded = 0;
        for (const p of products) {
          try {
            await supabaseService.saveProduct(p);
            prodsUploaded++;
          } catch (e) {
            console.warn("Fallo al subir producto local:", p.name, e);
          }
        }

        // 3. Subir clientes locales a Supabase
        let custsUploaded = 0;
        for (const c of customers) {
          try {
            await supabaseService.saveCustomer(c);
            custsUploaded++;
          } catch (e) {
            console.warn("Fallo al subir cliente local:", c.name, e);
          }
        }

        // 4. Subir proveedores locales a Supabase
        let suppsUploaded = 0;
        for (const s of suppliers) {
          try {
            await supabaseService.saveSupplier(s);
            suppsUploaded++;
          } catch (e) {
            console.warn("Fallo al subir proveedor local:", s.name, e);
          }
        }

        // 5. Subir pagos a proveedores locales
        for (const pay of supplierPayments) {
          try {
            await supabaseService.addSupplierPayment(pay);
          } catch (e) {
            console.warn("Fallo al subir pago a proveedor local:", e);
          }
        }

        // 6. Subir movimientos de caja locales
        for (const cm of cashMovements) {
          try {
            await supabaseService.addCashMovement(cm);
          } catch (e) {
            console.warn("Fallo al subir movimiento de caja local:", e);
          }
        }

        // 7. Descargar datos consolidados
        const [prods, custs, supps, suppPurchs, suppPymts, sls, pymts, movs] = await Promise.all([
          supabaseService.getProducts(),
          supabaseService.getCustomers(),
          supabaseService.getSuppliers(),
          supabaseService.getSupplierPurchases(),
          supabaseService.getSupplierPayments(),
          supabaseService.getSales(),
          supabaseService.getPayments(),
          supabaseService.getMovements(),
        ]);

        if (prods?.length) setProducts(prods);
        if (custs?.length) setCustomers(custs);
        if (supps?.length) setSuppliers(supps);
        if (suppPurchs?.length) setSupplierPurchases(suppPurchs);
        if (suppPymts?.length) setSupplierPayments(suppPymts);
        if (sls?.length) setSales(sls);
        if (pymts?.length) setPayments(pymts);
        if (movs?.length) setMovements(movs);

        setSyncStatus("synced");
        notify(`✅ Sincronización exitosa: ${custsUploaded} clientes, ${prodsUploaded} cortes y proveedores respaldados.`);
        return { success: true };
      } catch (err) {
        setSyncStatus("error");
        notify("Error al subir datos locales: " + (err.message || "Fallo de conexión"));
        return { success: false, error: err };
      }
    },

    clearOutbox() {
      setOutbox([]);
      notify("Cola de sincronización vaciada.");
    },

    async resetLocalDatabase() {
      try {
        setProducts([]);
        setCustomers([]);
        setSales([]);
        setPayments([]);
        setMovements([]);
        setCashMovements([]);
        setSuppliers([]);
        setSupplierPurchases([]);
        setSupplierPayments([]);
        setOutbox([]);
        await idbClear();
        notify("✨ Sistema y almacenamiento local reiniciados como nuevo.");
      } catch (e) {
        console.error("Error al reiniciar datos locales:", e);
      }
    },

    async addCashMovement({ type, category, amount, note }) {
      try {
        const cleanAmount = parsePositiveNumber(amount, "El importe del movimiento de caja");
        const cleanType = type === "ingreso" ? "ingreso" : "egreso";
        const localId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uid();
        const newMov = {
          id: localId,
          date: new Date().toISOString(),
          type: cleanType,
          category: category || "Varios",
          amount: cleanAmount,
          note: (note || "").trim(),
        };

        setCashMovements((prev) => [newMov, ...prev]);

        const isOffline = !isOnline || (typeof navigator !== "undefined" && !navigator.onLine);

        if (isSupabaseConfigured && !isOffline) {
          try {
            const dbMov = await supabaseService.addCashMovement({
              type: cleanType,
              category: newMov.category,
              amount: cleanAmount,
              note: newMov.note,
              clientMutationId: localId,
            });
            if (dbMov) {
              setCashMovements((prev) => prev.map((x) => (x.id === localId ? dbMov : x)));
            }
          } catch (err) {
            console.error("Error al registrar movimiento de caja en Supabase:", err);
            setOutbox((prev) => [
              ...prev,
              {
                id: uid(),
                action: "addCashMovement",
                payload: { type: cleanType, category: newMov.category, amount: cleanAmount, note: newMov.note, clientMutationId: localId },
                createdAt: new Date().toISOString(),
              },
            ]);
            notify("Movimiento de caja guardado localmente");
          }
        } else if (isSupabaseConfigured && isOffline) {
          setOutbox((prev) => [
            ...prev,
            {
              id: uid(),
              action: "addCashMovement",
              payload: { type: cleanType, category: newMov.category, amount: cleanAmount, note: newMov.note, clientMutationId: localId },
              createdAt: new Date().toISOString(),
            },
          ]);
          notify("Movimiento de caja guardado en mostrador (Modo offline)");
        }
        notify(cleanType === "egreso" ? `Retiro registrado: -$${cleanAmount.toLocaleString("es-AR")}` : `Ingreso registrado: +$${cleanAmount.toLocaleString("es-AR")}`);
        return newMov;
      } catch (err) {
        const msg = err instanceof ValidationError ? err.message : parseDatabaseError(err);
        notify(msg);
        throw err;
      }
    },

    exportAll() {
      return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), products, customers, sales, payments, movements, cashMovements });
    },

    importAll(json) {
      const d = JSON.parse(json);
      if (!Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error("Archivo de respaldo no válido");
      setProducts(d.products);
      setCustomers(d.customers || []);
      setSales(d.sales);
      setPayments(d.payments || []);
      setMovements(d.movements || []);
      setCashMovements(d.cashMovements || []);
      setSuppliers(d.suppliers || []);
      setSupplierPurchases(d.supplierPurchases || []);
      setSupplierPayments(d.supplierPayments || []);
    },

    async saveSupplier(supp) {
      if (!supp.name || !supp.name.trim()) {
        throw new ValidationError("El nombre del proveedor es obligatorio.");
      }
      const localSupp = {
        id: supp.id || uid(),
        name: supp.name.trim(),
        cuitDni: (supp.cuitDni || "").trim(),
        phone: (supp.phone || "").trim(),
        category: supp.category || "Frigorífico",
        notes: (supp.notes || "").trim(),
        balance: supp.balance || 0,
        createdAt: supp.createdAt || new Date().toISOString(),
      };

      setSuppliers((prev) =>
        prev.some((x) => x.id === localSupp.id)
          ? prev.map((x) => (x.id === localSupp.id ? { ...x, ...localSupp } : x))
          : [...prev, localSupp]
      );

      const isOffline = !isOnline || (typeof navigator !== "undefined" && !navigator.onLine);
      if (isSupabaseConfigured && !isOffline) {
        try {
          const res = await supabaseService.saveSupplier(localSupp);
          if (res?.id) {
            setSuppliers((prev) => prev.map((x) => (x.id === localSupp.id ? { ...x, id: res.id } : x)));
          }
          notify("Proveedor guardado en la base de datos");
        } catch (err) {
          console.error("Error al guardar proveedor en Supabase:", err);
          setOutbox((prev) => [
            ...prev,
            { id: uid(), action: "saveSupplier", payload: localSupp, createdAt: new Date().toISOString() },
          ]);
          notify("Proveedor guardado localmente (" + parseDatabaseError(err) + ")");
        }
      } else if (isSupabaseConfigured && isOffline) {
        setOutbox((prev) => [
          ...prev,
          { id: uid(), action: "saveSupplier", payload: localSupp, createdAt: new Date().toISOString() },
        ]);
        notify("Proveedor guardado en modo offline");
      } else {
        notify("Proveedor guardado exitosamente");
      }
      return localSupp;
    },

    async deleteSupplier(id) {
      if (!id) return;
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      if (isSupabaseConfigured) {
        try {
          await supabaseService.deleteSupplier(id);
        } catch (err) {
          console.error("Error al eliminar proveedor:", err);
        }
      }
      notify("Proveedor eliminado");
    },

    async addSupplierPurchase({ supplierId, invoiceNumber, total, paidAmount, method, notes }) {
      const numTotal = Number(total);
      if (isNaN(numTotal) || numTotal <= 0) {
        throw new ValidationError("El importe total de la compra debe ser mayor a 0.");
      }
      const numPaid = Number(paidAmount || 0);
      if (numPaid < 0 || numPaid > numTotal) {
        throw new ValidationError("El pago no puede ser negativo ni superar el total.");
      }

      const localId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uid();
      const unpaid = numTotal - numPaid;
      const status = numPaid === numTotal ? "paid" : numPaid > 0 ? "partial" : "pending";

      const localPurchase = {
        id: localId,
        supplierId,
        invoiceNumber: (invoiceNumber || "").trim(),
        total: numTotal,
        paidAmount: numPaid,
        status,
        date: new Date().toISOString(),
        notes: (notes || "").trim(),
        clientMutationId: localId,
      };

      setSupplierPurchases((prev) => [localPurchase, ...prev]);

      // Incrementar saldo deudor con el proveedor
      if (unpaid > 0) {
        setSuppliers((prev) =>
          prev.map((s) => (s.id === supplierId ? { ...s, balance: (s.balance || 0) + unpaid } : s))
        );
      }

      // Si hubo pago inicial, registrarlo
      if (numPaid > 0) {
        const payId = uid();
        setSupplierPayments((prev) => [
          {
            id: payId,
            supplierId,
            purchaseId: localId,
            amount: numPaid,
            method: method || "Efectivo",
            date: new Date().toISOString(),
            notes: `Pago inicial factura ${localPurchase.invoiceNumber || "S/N"}`,
            clientMutationId: payId,
          },
          ...prev,
        ]);

        if (method === "Efectivo") {
          const supp = suppliers.find((s) => s.id === supplierId);
          setCashMovements((prev) => [
            {
              id: uid(),
              date: new Date().toISOString(),
              type: "egreso",
              category: "Proveedores",
              amount: numPaid,
              note: `Pago compra ${supp?.name || "Proveedor"} (Fact: ${localPurchase.invoiceNumber || "S/N"})`,
            },
            ...prev,
          ]);
        }
      }

      const isOffline = !isOnline || (typeof navigator !== "undefined" && !navigator.onLine);
      if (isSupabaseConfigured && !isOffline) {
        try {
          await supabaseService.addSupplierPurchase({
            supplierId,
            invoiceNumber: localPurchase.invoiceNumber,
            total: numTotal,
            paidAmount: numPaid,
            method: method || "Efectivo",
            notes: localPurchase.notes,
            clientMutationId: localId,
          });
          const [supps, purchs] = await Promise.all([
            supabaseService.getSuppliers(),
            supabaseService.getSupplierPurchases(),
          ]);
          if (supps.length) setSuppliers(supps);
          if (purchs.length) setSupplierPurchases(purchs);
        } catch (err) {
          console.error("Error al registrar compra en Supabase:", err);
          setOutbox((prev) => [
            ...prev,
            { id: uid(), action: "addSupplierPurchase", payload: { ...localPurchase, method: method || "Efectivo" }, createdAt: new Date().toISOString() },
          ]);
          notify("Compra guardada localmente (" + parseDatabaseError(err) + ")");
        }
      } else if (isSupabaseConfigured && isOffline) {
        setOutbox((prev) => [
          ...prev,
          { id: uid(), action: "addSupplierPurchase", payload: { ...localPurchase, method: method || "Efectivo" }, createdAt: new Date().toISOString() },
        ]);
        notify("Compra registrada en modo offline");
      }
      notify("Compra a proveedor registrada correctamente");
      return localPurchase;
    },

    async addSupplierPayment({ supplierId, purchaseId, amount, method, notes }) {
      const numAmt = Number(amount);
      if (isNaN(numAmt) || numAmt <= 0) {
        throw new ValidationError("El importe del pago debe ser mayor a 0.");
      }

      const localId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : uid();
      const localPay = {
        id: localId,
        supplierId,
        purchaseId: purchaseId || null,
        amount: numAmt,
        method: method || "Efectivo",
        date: new Date().toISOString(),
        notes: (notes || "").trim(),
        clientMutationId: localId,
      };

      setSupplierPayments((prev) => [localPay, ...prev]);

      // Disminuir saldo adeudado
      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplierId ? { ...s, balance: Math.max(0, (s.balance || 0) - numAmt) } : s))
      );

      // Si fue en efectivo, registrar egreso de caja
      if (method === "Efectivo") {
        const supp = suppliers.find((s) => s.id === supplierId);
        setCashMovements((prev) => [
          {
            id: uid(),
            date: new Date().toISOString(),
            type: "egreso",
            category: "Proveedores",
            amount: numAmt,
            note: `Pago a proveedor: ${supp?.name || "Proveedor"} (${localPay.notes || ""})`,
          },
          ...prev,
        ]);
      }

      const isOffline = !isOnline || (typeof navigator !== "undefined" && !navigator.onLine);
      if (isSupabaseConfigured && !isOffline) {
        try {
          await supabaseService.addSupplierPayment({
            supplierId,
            purchaseId,
            amount: numAmt,
            method: localPay.method,
            notes: localPay.notes,
            clientMutationId: localId,
          });
          const [supps, pymts] = await Promise.all([
            supabaseService.getSuppliers(),
            supabaseService.getSupplierPayments(),
          ]);
          if (supps.length) setSuppliers(supps);
          if (pymts.length) setSupplierPayments(pymts);
        } catch (err) {
          console.error("Error al registrar pago en Supabase:", err);
          setOutbox((prev) => [
            ...prev,
            { id: uid(), action: "addSupplierPayment", payload: localPay, createdAt: new Date().toISOString() },
          ]);
          notify("Pago guardado localmente (" + parseDatabaseError(err) + ")");
        }
      } else if (isSupabaseConfigured && isOffline) {
        setOutbox((prev) => [
          ...prev,
          { id: uid(), action: "addSupplierPayment", payload: localPay, createdAt: new Date().toISOString() },
        ]);
        notify("Pago guardado en modo offline");
      }
      notify(`Pago a proveedor registrado: -$${numAmt.toLocaleString("es-AR")}`);
      return localPay;
    },
  };

  const value = {
    products,
    customers,
    sales,
    payments,
    movements,
    cashMovements,
    suppliers,
    supplierPurchases,
    supplierPayments,
    balances,
    outbox,
    outboxCount: outbox ? outbox.length : 0,
    flushOutbox,
    isOnline,
    toast,
    notify,
    syncStatus,
    isSupabaseConfigured,
    getAuditLogs: (limit) => supabaseService.getAuditLogs(limit),
    ...actions,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { STORAGE_KEYS };
