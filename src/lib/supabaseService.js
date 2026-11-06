import { isSupabaseConfigured, supabase } from "./supabase.js";
import { DEFAULT_CATEGORIES, SEED_PRODUCTS, round3 } from "./format.js";

const isUUID = (str) =>
  typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());

/**
 * Servicio de sincronización y persistencia con Supabase (PostgreSQL)
 */
export const supabaseService = {
  // ==========================================================================
  // CATEGORÍAS Y PRODUCTOS
  // ==========================================================================
  async getCategories() {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async ensureCategories() {
    if (!isSupabaseConfigured) return [];
    let { data, error } = await supabase.from("categories").select("*");
    if (error) {
      console.error("Error al consultar categorías:", error);
      return [];
    }
    if (!data || data.length === 0) {
      const rows = DEFAULT_CATEGORIES.map((name) => ({ name }));
      const { data: inserted, error: insErr } = await supabase.from("categories").insert(rows).select();
      if (insErr) {
        console.error("Error al sembrar categorías iniciales:", insErr);
        return [];
      }
      return inserted || [];
    }
    return data;
  },

  async getProducts() {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from("products")
      .select("*, categories(id, name)")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    return (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.categories?.name || "Vaca",
      categoryId: p.category_id,
      unit: p.unit,
      price: Number(p.price),
      cost: Number(p.cost || 0),
      stock: Number(p.stock || 0),
      minStock: Number(p.min_stock || 0),
    }));
  },

  async saveProduct(p) {
    if (!isSupabaseConfigured) return null;

    // Obtener o asegurar la categoría
    const categories = await this.ensureCategories();
    let cat = categories.find((c) => c.name.toLowerCase() === (p.category || "Vaca").toLowerCase());

    if (!cat && categories.length > 0) {
      cat = categories[0];
    } else if (!cat) {
      const { data: newCat, error: catError } = await supabase
        .from("categories")
        .insert({ name: p.category || "Vaca" })
        .select()
        .single();
      if (catError) throw catError;
      cat = newCat;
    }

    const payload = {
      name: p.name.trim(),
      category_id: cat.id,
      unit: p.unit || "kg",
      price: p.price,
      cost: p.cost || 0,
      min_stock: p.minStock || 0,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (isUUID(p.id)) {
      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", p.id)
        .select("*, categories(id, name)")
        .single();

      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        category: data.categories?.name || p.category,
        categoryId: data.category_id,
        unit: data.unit,
        price: Number(data.price),
        cost: Number(data.cost || 0),
        stock: Number(data.stock || 0),
        minStock: Number(data.min_stock || 0),
      };
    } else {
      payload.stock = p.stock || 0;
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select("*, categories(id, name)")
        .single();

      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        category: data.categories?.name || p.category,
        categoryId: data.category_id,
        unit: data.unit,
        price: Number(data.price),
        cost: Number(data.cost || 0),
        stock: Number(data.stock || 0),
        minStock: Number(data.min_stock || 0),
      };
    }
  },

  async deleteProduct(id) {
    if (!isSupabaseConfigured) return;
    if (!isUUID(id)) return;
    const { error } = await supabase
      .from("products")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;
  },

  // ==========================================================================
  // CLIENTES Y CUENTAS CORRIENTES
  // ==========================================================================
  async getCustomers() {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;

    return (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      dni: c.dni || "",
      phone: c.phone || "",
      address: c.address || "",
      balance: Number(c.balance || 0),
      creditLimit: Number(c.credit_limit || 0),
    }));
  },

  async saveCustomer(c) {
    if (!isSupabaseConfigured) return null;

    const payload = {
      name: c.name.trim(),
      dni: c.dni?.trim() || null,
      phone: c.phone?.trim() || null,
      address: c.address?.trim() || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (isUUID(c.id)) {
      const { data, error } = await supabase
        .from("customers")
        .update(payload)
        .eq("id", c.id)
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        dni: data.dni || "",
        phone: data.phone || "",
        address: data.address || "",
        balance: Number(data.balance || 0),
        creditLimit: Number(data.credit_limit || 0),
      };
    } else {
      const { data, error } = await supabase
        .from("customers")
        .insert({ ...payload, balance: 0 })
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        dni: data.dni || "",
        phone: data.phone || "",
        address: data.address || "",
        balance: Number(data.balance || 0),
        creditLimit: Number(data.credit_limit || 0),
      };
    }
  },

  async deleteCustomer(id) {
    if (!isSupabaseConfigured) return;
    if (!isUUID(id)) return;
    const { error } = await supabase
      .from("customers")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;
  },

  async addPayment({ customerId, amount, method }) {
    if (!isSupabaseConfigured) return null;

    // Si el customerId no es UUID, buscamos en DB por nombre o dni
    let validCustomerId = customerId;
    if (!isUUID(validCustomerId)) {
      const custs = await this.getCustomers();
      const found = custs.find((c) => c.id === customerId);
      if (found && isUUID(found.id)) validCustomerId = found.id;
      else return null;
    }

    const { data, error } = await supabase
      .from("customer_payments")
      .insert({
        customer_id: validCustomerId,
        amount,
        method: method || "Efectivo",
      })
      .select()
      .single();

    if (error) throw error;

    // Actualizar el saldo del cliente en Supabase para mantener consistencia
    try {
      const { data: cust } = await supabase
        .from("customers")
        .select("balance")
        .eq("id", validCustomerId)
        .single();
      if (cust) {
        const newBal = Math.max(0, Number(cust.balance || 0) - Number(amount));
        await supabase
          .from("customers")
          .update({ balance: newBal, updated_at: new Date().toISOString() })
          .eq("id", validCustomerId);
      }
    } catch (e) {
      console.warn("No se pudo actualizar balance de cliente tras cobro:", e);
    }

    return {
      id: data.id,
      date: data.created_at,
      customerId: data.customer_id,
      amount: Number(data.amount),
      method: data.method,
    };
  },

  async getPayments() {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from("customer_payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((p) => ({
      id: p.id,
      date: p.created_at,
      customerId: p.customer_id,
      amount: Number(p.amount),
      method: p.method,
    }));
  },

  // ==========================================================================
  // VENTAS Y TICKETS DE MOSTRADOR
  // ==========================================================================
  async getSales(options = {}) {
    if (!isSupabaseConfigured) return [];
    const { limit = 250, startDate = null, endDate = null } = options;

    let query = supabase
      .from("sales")
      .select("*, sale_items(*)")
      .eq("status", "completed")
      .order("created_at", { ascending: false });

    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      const endFormatted = endDate.includes("T") ? endDate : `${endDate}T23:59:59.999Z`;
      query = query.lte("created_at", endFormatted);
    }
    if (limit && !startDate && !endDate) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((s) => ({
      id: s.id,
      ticketNumber: s.ticket_number,
      date: s.created_at,
      customerId: s.customer_id,
      method: s.method,
      total: Number(s.total),
      tendered: Number(s.tendered || 0),
      change: Number(s.change_returned || 0),
      items: (s.sale_items || []).map((i) => ({
        productId: i.product_id,
        name: i.product_name,
        unit: i.unit,
        price: Number(i.unit_price),
        qty: Number(i.quantity),
        total: Number(i.total_price),
      })),
    }));
  },

  async createSale({ items, customerId, method, tendered, change }) {
    if (!isSupabaseConfigured) return null;

    const total = items.reduce((s, i) => s + i.total, 0);

    // Resolver customer_id si es necesario
    let validCustomerId = null;
    if (isUUID(customerId)) {
      validCustomerId = customerId;
    } else if (customerId) {
      const custs = await this.getCustomers();
      const match = custs.find((c) => c.id === customerId);
      if (match && isUUID(match.id)) validCustomerId = match.id;
    }

    // 1. Intentar transacción atómica mediante RPC en PostgreSQL
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc("rpc_process_sale", {
        p_customer_id: validCustomerId,
        p_method: method || "Efectivo",
        p_items: items,
        p_tendered: tendered || total,
        p_change: change || 0,
      });

      if (!rpcError && rpcResult?.id) {
        return {
          id: rpcResult.id,
          ticketNumber: rpcResult.ticketNumber,
          date: new Date().toISOString(),
          customerId: validCustomerId,
          method: method || "Efectivo",
          total: Number(rpcResult.total || total),
          tendered: Number(rpcResult.tendered || total),
          change: Number(rpcResult.change || 0),
          items,
        };
      }
    } catch {
      // Si la función RPC no existe en la BD, continúa con el fallback
    }

    // 2. Fallback REST estándar
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        customer_id: validCustomerId,
        method: method || "Efectivo",
        subtotal: total,
        total,
        tendered: tendered || total,
        change_returned: change || 0,
        status: "completed",
      })
      .select()
      .single();

    if (saleError) throw saleError;

    // Solo si algún corte no tiene UUID consultamos catálogo (evita N+1 query en cada venta)
    let prodMapByName = null;
    const hasNonUuid = items.some((i) => !isUUID(i.productId));
    if (hasNonUuid) {
      const dbProducts = await this.getProducts();
      prodMapByName = new Map(dbProducts.map((p) => [p.name.toLowerCase(), p.id]));
    }

    // Insertar líneas del ticket con UUID válido
    const itemsPayload = items
      .map((i) => {
        let finalProdId = i.productId;
        if (!isUUID(finalProdId) && prodMapByName) {
          finalProdId = prodMapByName.get(i.name.toLowerCase());
        }
        return {
          sale_id: sale.id,
          product_id: finalProdId,
          product_name: i.name,
          unit: i.unit,
          unit_price: i.price,
          quantity: i.qty,
          total_price: i.total,
        };
      })
      .filter((i) => isUUID(i.product_id));

    if (itemsPayload.length > 0) {
      const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(itemsPayload);

      if (itemsError) throw itemsError;

      // Descontar stock de cada corte en Supabase
      for (const it of itemsPayload) {
        try {
          const { data: prod } = await supabase
            .from("products")
            .select("stock")
            .eq("id", it.product_id)
            .single();
          if (prod) {
            const newStock = round3(Number(prod.stock || 0) - it.quantity);
            await supabase
              .from("products")
              .update({ stock: newStock, updated_at: new Date().toISOString() })
              .eq("id", it.product_id);
          }
        } catch (e) {
          console.warn("No se pudo descontar stock de corte en Supabase:", e);
        }
      }
    }

    // Si fue venta a Fiado, actualizar saldo adeudado del cliente en Supabase
    if (method === "Fiado" && validCustomerId) {
      try {
        const { data: cust } = await supabase
          .from("customers")
          .select("balance")
          .eq("id", validCustomerId)
          .single();
        if (cust) {
          const newBalance = Number(cust.balance || 0) + total;
          await supabase
            .from("customers")
            .update({ balance: newBalance, updated_at: new Date().toISOString() })
            .eq("id", validCustomerId);
        }
      } catch (e) {
        console.warn("No se pudo actualizar balance de cliente en Supabase:", e);
      }
    }

    return {
      id: sale.id,
      ticketNumber: sale.ticket_number,
      date: sale.created_at,
      customerId: sale.customer_id,
      method: sale.method,
      total: Number(sale.total),
      tendered: Number(sale.tendered),
      change: Number(sale.change_returned),
      items,
    };
  },

  async voidSale(saleId) {
    if (!isSupabaseConfigured) return;
    if (!isUUID(saleId)) return;

    // 1. Intentar anulación atómica vía RPC en PostgreSQL
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("rpc_void_sale", {
        p_sale_id: saleId,
      });
      if (!rpcErr && rpcRes?.success) return;
    } catch {}

    // 2. Fallback REST
    const { data: sale } = await supabase
      .from("sales")
      .select("*, sale_items(*)")
      .eq("id", saleId)
      .single();

    if (!sale) return;
    if (sale.status === "voided") {
      // Venta ya anulada previamente: abortar para evitar doble reversión de stock y saldo
      return;
    }

    const { error } = await supabase
      .from("sales")
      .update({
        status: "voided",
        voided_at: new Date().toISOString(),
      })
      .eq("id", saleId);

    if (error) throw error;

    if (sale) {
      // Revertir el stock de cada corte
      for (const item of sale.sale_items || []) {
        if (isUUID(item.product_id)) {
          try {
            const { data: prod } = await supabase
              .from("products")
              .select("stock")
              .eq("id", item.product_id)
              .single();
            if (prod) {
              const restoredStock = round3(Number(prod.stock || 0) + Number(item.quantity || 0));
              await supabase
                .from("products")
                .update({ stock: restoredStock, updated_at: new Date().toISOString() })
                .eq("id", item.product_id);
            }
          } catch {}
        }
      }

      // Revertir saldo adeudado del cliente si fue Fiado
      if (sale.method === "Fiado" && isUUID(sale.customer_id)) {
        try {
          const { data: cust } = await supabase
            .from("customers")
            .select("balance")
            .eq("id", sale.customer_id)
            .single();
          if (cust) {
            const restoredBalance = Math.max(0, Number(cust.balance || 0) - Number(sale.total || 0));
            await supabase
              .from("customers")
              .update({ balance: restoredBalance, updated_at: new Date().toISOString() })
              .eq("id", sale.customer_id);
          }
        } catch {}
      }
    }
  },

  // ==========================================================================
  // INVENTARIO Y MOVIMIENTOS
  // ==========================================================================
  async getMovements() {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from("inventory_movements")
      .select("*, products(name, unit)")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return (data || []).map((m) => ({
      id: m.id,
      date: m.created_at,
      productId: m.product_id,
      productName: m.products?.name || "Corte",
      unit: m.products?.unit || "kg",
      type: m.type,
      delta: Number(m.delta),
      note: m.note || "",
      cost: Number(m.total_cost || 0),
    }));
  },

  async addMovement({ productId, type, qty, note, cost }) {
    if (!isSupabaseConfigured) return null;

    let validPid = productId;
    if (!isUUID(validPid)) {
      const dbProducts = await this.getProducts();
      const match = dbProducts.find((p) => p.id === productId || p.name.toLowerCase() === (note || "").toLowerCase());
      if (match && isUUID(match.id)) validPid = match.id;
      else return null;
    }

    // 1. Intentar movimiento atómico vía RPC en PostgreSQL con bloqueo de fila (FOR UPDATE)
    try {
      const { data: rpcMov, error: rpcErr } = await supabase.rpc("rpc_add_inventory_movement", {
        p_product_id: validPid,
        p_type: type,
        p_qty: qty,
        p_cost: cost || 0,
        p_note: note || "",
      });

      if (!rpcErr && rpcMov?.id) {
        return {
          id: rpcMov.id,
          date: new Date().toISOString(),
          productId: validPid,
          type,
          delta: Number(rpcMov.delta),
          cost: Number(cost || 0),
          note: note || "",
        };
      }
    } catch {}

    // 2. Fallback REST
    const { data: prod, error: prodErr } = await supabase
      .from("products")
      .select("stock, unit")
      .eq("id", validPid)
      .single();

    if (prodErr) throw prodErr;

    const prevStock = Number(prod.stock || 0);
    const delta = type === "compra" ? qty : type === "merma" ? -qty : round3(qty - prevStock);
    const newStock = round3(prevStock + delta);

    const { error: updErr } = await supabase
      .from("products")
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", validPid);

    if (updErr) throw updErr;

    const { data: mov, error: movErr } = await supabase
      .from("inventory_movements")
      .insert({
        product_id: validPid,
        type,
        delta,
        previous_stock: prevStock,
        resulting_stock: newStock,
        total_cost: cost || 0,
        note: note || "",
      })
      .select()
      .single();

    if (movErr) throw movErr;
    return mov;
  },

  // ==========================================================================
  // CIERRES DE CAJA (REPORTE Z)
  // ==========================================================================
  async saveCashClosing(closingData) {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from("cash_closings")
      .insert(closingData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==========================================================================
  // SEMBRADO INICIAL (Migrar catálogo inicial a Supabase si está vacío)
  // ==========================================================================
  async seedCatalogIfEmpty() {
    if (!isSupabaseConfigured) return;
    try {
      const categories = await this.ensureCategories();
      const prods = await this.getProducts();
      if (prods.length === 0 && categories.length > 0) {
        const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
        const defaultCatId = categories[0].id;

        const seedRows = SEED_PRODUCTS.map((p) => ({
          name: p.name,
          category_id: catMap.get((p.category || "").toLowerCase()) || defaultCatId,
          unit: p.unit || "kg",
          price: p.price,
          stock: p.stock,
          min_stock: p.minStock,
          is_active: true,
        }));

        const { error } = await supabase.from("products").insert(seedRows);
        if (error) console.error("Error al sembrar cortes iniciales:", error);
      }
    } catch (e) {
      console.warn("No se pudo sembrar el catálogo en Supabase:", e);
    }
  },
};


