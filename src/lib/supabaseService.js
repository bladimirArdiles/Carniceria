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
      plu: p.plu !== undefined && p.plu !== null ? Number(p.plu) : null,
      barcode: p.barcode || null,
    }));
  },

  async saveProduct(p) {
    if (!isSupabaseConfigured) return null;

    // Obtener o asegurar la categoría
    const categories = await this.ensureCategories();
    const reqCatName = (p.category || "").trim().toLowerCase();
    
    // Búsqueda inteligente: exacto, o por contención (ej: 'achuras' coincide con 'Achuras y Menudencias' si no hay otra)
    let cat = categories.find((c) => c.name.toLowerCase() === reqCatName);
    if (!cat && reqCatName) {
      cat = categories.find((c) => c.name.toLowerCase().includes(reqCatName) || reqCatName.includes(c.name.toLowerCase()));
    }

    if (!cat && reqCatName) {
      const { data: newCat, error: catError } = await supabase
        .from("categories")
        .insert({ name: p.category.trim() })
        .select()
        .single();
      if (!catError && newCat) {
        cat = newCat;
      }
    }

    if (!cat && categories.length > 0) {
      cat = categories.find((c) => c.name.toLowerCase() === "vaca") || categories[0];
    }

    const payload = {
      name: p.name.trim(),
      category_id: cat.id,
      unit: p.unit || "kg",
      price: Number(p.price),
      cost: Number(p.cost || 0),
      stock: Number(p.stock || 0),
      min_stock: Number(p.minStock || 0),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (p.plu !== undefined) {
      payload.plu = p.plu !== null && p.plu !== "" ? Number(p.plu) : null;
    }
    if (p.barcode !== undefined) {
      payload.barcode = p.barcode ? String(p.barcode).trim() : null;
    }

    if (isUUID(p.id)) {
      payload.id = p.id;
    }

    // Intentar upsert con columnas completas (si la tabla ya tiene plu/barcode)
    // Si la tabla en Supabase aún no tiene esas columnas, hacer fallback sin ellas para que nunca falle el guardado
    let savedData = null;
    try {
      const { data, error } = await supabase
        .from("products")
        .upsert(payload, { onConflict: "id" })
        .select("*, categories(id, name)")
        .single();
      if (!error && data) {
        savedData = data;
      } else if (error) {
        throw error;
      }
    } catch (upsertErr) {
      if (upsertErr.message?.includes("column") || upsertErr.code === "PGRST204" || upsertErr.code === "42703") {
        delete payload.plu;
        delete payload.barcode;
        const { data: fbData, error: fbErr } = await supabase
          .from("products")
          .upsert(payload, { onConflict: "id" })
          .select("*, categories(id, name)")
          .single();
        if (fbErr) throw fbErr;
        savedData = fbData;
      } else {
        throw upsertErr;
      }
    }

    return {
      id: savedData.id,
      name: savedData.name,
      category: savedData.categories?.name || p.category,
      categoryId: savedData.category_id,
      unit: savedData.unit,
      price: Number(savedData.price),
      cost: Number(savedData.cost || 0),
      stock: Number(savedData.stock || 0),
      minStock: Number(savedData.min_stock || 0),
      plu: savedData.plu !== undefined && savedData.plu !== null ? Number(savedData.plu) : p.plu || null,
      barcode: savedData.barcode || p.barcode || null,
    };
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

  async bulkUpdatePrices({ categoryName = "Todas", type = "percentage", value = 0, roundTo = 10, targetField = "price" }) {
    if (!isSupabaseConfigured) {
      return { success: false, offline: true };
    }

    const { data, error } = await supabase.rpc("rpc_bulk_update_prices", {
      p_category_name: categoryName,
      p_type: type,
      p_value: Number(value),
      p_round_to: Number(roundTo),
      p_target_field: targetField,
    });

    if (error) throw error;
    return data;
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
      allowCredit: c.allow_credit !== false,
    }));
  },

  async saveCustomer(c) {
    if (!isSupabaseConfigured) return null;

    const payload = {
      name: c.name.trim(),
      dni: c.dni?.trim() || null,
      phone: c.phone?.trim() || null,
      address: c.address?.trim() || null,
      credit_limit: Number(c.creditLimit || 0),
      allow_credit: c.allowCredit !== false,
      balance: Number(c.balance || 0),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    if (isUUID(c.id)) {
      payload.id = c.id;
    }

    const { data, error } = await supabase
      .from("customers")
      .upsert(payload, { onConflict: "id" })
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
      allowCredit: data.allow_credit !== false,
    };
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

  async addPayment({ customerId, amount, method, clientMutationId }) {
    if (!isSupabaseConfigured) return null;

    // Si el customerId no es UUID, buscamos en DB por nombre o dni
    let validCustomerId = customerId;
    if (!isUUID(validCustomerId)) {
      const custs = await this.getCustomers();
      const found = custs.find((c) => c.id === customerId);
      if (found && isUUID(found.id)) validCustomerId = found.id;
      else return null;
    }

    // 1. Intentar cobro atómico vía RPC en PostgreSQL con bloqueo de fila
    try {
      const { data: rpcPay, error: rpcErr } = await supabase.rpc("rpc_add_payment", {
        p_customer_id: validCustomerId,
        p_amount: amount,
        p_method: method || "Efectivo",
        p_client_mutation_id: isUUID(clientMutationId) ? clientMutationId : null,
      });

      if (!rpcErr && rpcPay?.id) {
        return {
          id: rpcPay.id,
          date: rpcPay.date || new Date().toISOString(),
          customerId: validCustomerId,
          amount: Number(rpcPay.amount),
          method: rpcPay.method,
          newBalance: Number(rpcPay.newBalance),
        };
      }
    } catch (e) {
      console.warn("Fallo RPC add_payment, continuando a fallback:", e);
    }

    const { data, error } = await supabase
      .from("customer_payments")
      .insert({
        customer_id: validCustomerId,
        amount,
        method: method || "Efectivo",
        client_mutation_id: clientMutationId || null,
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
      const startIso = startDate.includes("T") ? startDate : new Date(`${startDate}T00:00:00`).toISOString();
      query = query.gte("created_at", startIso);
    }
    if (endDate) {
      const endIso = endDate.includes("T") ? endDate : new Date(`${endDate}T23:59:59.999`).toISOString();
      query = query.lte("created_at", endIso);
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
        total: Number(i.total_price != null ? i.total_price : Math.round(Number(i.quantity) * Number(i.unit_price))),
      })),
    }));
  },

  async createSale({ items, customerId, method, tendered, change, clientMutationId, overrideCreditLimit = false }) {
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

    // 1. Intentar transacción atómica mediante RPC en PostgreSQL con Row Locking
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc("rpc_process_sale", {
        p_customer_id: validCustomerId,
        p_method: method || "Efectivo",
        p_items: items,
        p_tendered: tendered || total,
        p_change: change || 0,
        p_client_mutation_id: isUUID(clientMutationId) ? clientMutationId : null,
        p_override_credit_limit: Boolean(overrideCreditLimit),
      });

      if (rpcError) throw rpcError;

      if (rpcResult?.id) {
        return {
          id: rpcResult.id,
          ticketNumber: rpcResult.ticketNumber,
          date: rpcResult.date || new Date().toISOString(),
          customerId: validCustomerId,
          method: method || "Efectivo",
          total: Number(rpcResult.total || total),
          tendered: Number(rpcResult.tendered || total),
          change: Number(rpcResult.change || 0),
          items,
        };
      }
    } catch (rpcErr) {
      // Si fue un error de negocio (límite de fiado o validación), relanzarlo
      if (rpcErr.message && (rpcErr.message.includes("Límite de fiado") || rpcErr.code === "20050")) {
        throw rpcErr;
      }
      console.warn("Fallo RPC rpc_process_sale, evaluando fallback REST:", rpcErr);
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
        client_mutation_id: clientMutationId || null,
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

  async voidSale(saleId, reason = "Anulación desde mostrador") {
    if (!isSupabaseConfigured) return;
    if (!isUUID(saleId)) return;

    // 1. Intentar anulación atómica vía RPC en PostgreSQL
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc("rpc_void_sale", {
        p_sale_id: saleId,
        p_reason: reason,
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

  async addMovement({ productId, type, qty, note, cost, clientMutationId }) {
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
        p_client_mutation_id: isUUID(clientMutationId) ? clientMutationId : null,
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
        client_mutation_id: clientMutationId || null,
      })
      .select()
      .single();

    if (movErr) throw movErr;
    return mov;
  },

  // ==========================================================================
  // CIERRES DE CAJA (REPORTE Z) Y MOVIMIENTOS DE CAJA
  // ==========================================================================
  async getCashMovements(options = {}) {
    if (!isSupabaseConfigured) return [];
    const { limit = 100 } = options;
    const { data, error } = await supabase
      .from("cash_movements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.warn("No se pudieron cargar movimientos de caja:", error);
      return [];
    }

    return (data || []).map((m) => ({
      id: m.id,
      date: m.created_at,
      type: m.type,
      category: m.category,
      amount: Number(m.amount),
      note: m.note || "",
    }));
  },

  async addCashMovement({ type, category, amount, note, clientMutationId }) {
    if (!isSupabaseConfigured) return null;

    // 1. Intentar registrar vía RPC atómico en PostgreSQL
    try {
      const { data: rpcMov, error: rpcErr } = await supabase.rpc("rpc_add_cash_movement", {
        p_type: type,
        p_category: category || "Varios",
        p_amount: amount,
        p_note: note || "",
        p_client_mutation_id: isUUID(clientMutationId) ? clientMutationId : null,
      });

      if (!rpcErr && rpcMov?.id) {
        return {
          id: rpcMov.id,
          date: rpcMov.createdAt || new Date().toISOString(),
          type: rpcMov.type,
          category: rpcMov.category,
          amount: Number(rpcMov.amount),
          note: rpcMov.note || "",
        };
      }
    } catch {}

    // 2. Fallback REST
    const { data, error } = await supabase
      .from("cash_movements")
      .insert({
        type,
        category: category || "Varios",
        amount,
        note: note || "",
        client_mutation_id: clientMutationId || null,
      })
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      date: data.created_at,
      type: data.type,
      category: data.category,
      amount: Number(data.amount),
      note: data.note || "",
    };
  },

  async getAuditLogs(limit = 50) {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase.rpc("rpc_get_audit_logs", { p_limit: limit });
      if (!error && data) return data;
    } catch {}

    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  },

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
  // PROVEEDORES Y CUENTAS POR PAGAR
  // ==========================================================================
  async getSuppliers() {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) throw error;
    return (data || []).map((s) => ({
      id: s.id,
      name: s.name,
      cuitDni: s.cuit_dni,
      phone: s.phone,
      category: s.category,
      balance: Number(s.balance || 0),
      notes: s.notes,
      createdAt: s.created_at,
    }));
  },

  async saveSupplier({ name, cuitDni, phone, category, notes, id }) {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.rpc("rpc_save_supplier", {
        p_name: name.trim(),
        p_cuit_dni: cuitDni || "",
        p_phone: phone || "",
        p_category: category || "Frigorífico",
        p_notes: notes || "",
        p_id: isUUID(id) ? id : null,
      });

      if (!error && data) return data;
      if (error && error.code !== "PGRST202" && !error.message?.includes("Could not find the function")) {
        throw error;
      }
    } catch (rpcErr) {
      console.warn("Fallo RPC rpc_save_supplier, ejecutando fallback REST:", rpcErr);
    }

    const payload = {
      name: name.trim(),
      cuit_dni: (cuitDni || "").trim(),
      phone: (phone || "").trim(),
      category: category || "Frigorífico",
      notes: (notes || "").trim(),
      updated_at: new Date().toISOString(),
    };
    if (isUUID(id)) payload.id = id;

    const { data, error } = await supabase
      .from("suppliers")
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getSupplierPurchases() {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from("supplier_purchases")
        .select("*, suppliers(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((p) => ({
        id: p.id,
        supplierId: p.supplier_id,
        supplierName: p.suppliers?.name || "Proveedor",
        invoiceNumber: p.invoice_number,
        date: p.date || p.created_at,
        total: Number(p.total || 0),
        paidAmount: Number(p.paid_amount || 0),
        status: p.status || "pending",
        notes: p.notes,
        clientMutationId: p.client_mutation_id,
        createdAt: p.created_at,
      }));
    } catch (err) {
      console.warn("Fallo al obtener compras a proveedores:", err);
      return [];
    }
  },

  async addSupplierPurchase({ supplierId, invoiceNumber, total, paidAmount, method, notes, clientMutationId }) {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.rpc("rpc_add_supplier_purchase", {
        p_supplier_id: supplierId,
        p_invoice_number: invoiceNumber || "",
        p_total: Number(total),
        p_paid_amount: Number(paidAmount || 0),
        p_method: method || "Efectivo",
        p_notes: notes || "",
        p_client_mutation_id: isUUID(clientMutationId) ? clientMutationId : null,
      });

      if (!error && data) return data;
      if (error && error.code !== "PGRST202" && !error.message?.includes("Could not find the function")) {
        throw error;
      }
    } catch (rpcErr) {
      console.warn("Fallo RPC rpc_add_supplier_purchase, ejecutando fallback REST:", rpcErr);
    }

    // Fallback REST directo
    const nowIso = new Date().toISOString();
    const purchasePayload = {
      supplier_id: supplierId,
      invoice_number: (invoiceNumber || "").trim(),
      total: Number(total),
      paid_amount: Number(paidAmount || 0),
      status: Number(paidAmount || 0) >= Number(total) ? "paid" : Number(paidAmount || 0) > 0 ? "partial" : "pending",
      notes: (notes || "").trim(),
      created_at: nowIso,
    };
    if (isUUID(clientMutationId)) purchasePayload.client_mutation_id = clientMutationId;

    const { data: purchase, error: pErr } = await supabase
      .from("supplier_purchases")
      .insert(purchasePayload)
      .select()
      .single();

    if (pErr) throw pErr;

    // Actualizar balance del proveedor
    const unpaid = Math.max(0, Number(total) - Number(paidAmount || 0));
    if (unpaid > 0) {
      try {
        const { data: supp } = await supabase.from("suppliers").select("balance").eq("id", supplierId).single();
        if (supp) {
          const newBal = Number(supp.balance || 0) + unpaid;
          await supabase.from("suppliers").update({ balance: newBal, updated_at: nowIso }).eq("id", supplierId);
        }
      } catch (e) {
        console.warn("No se pudo actualizar balance de proveedor:", e);
      }
    }

    // Si hubo pago inicial, registrarlo en supplier_payments
    if (Number(paidAmount) > 0) {
      try {
        await supabase.from("supplier_payments").insert({
          supplier_id: supplierId,
          purchase_id: purchase.id,
          amount: Number(paidAmount),
          method: method || "Efectivo",
          notes: "Pago inicial factura " + (invoiceNumber || "S/N"),
          created_at: nowIso,
        });
      } catch (e) {
        console.warn("No se pudo asentar pago inicial en Supabase:", e);
      }
    }

    return purchase;
  },

  async getSupplierPayments() {
    if (!isSupabaseConfigured) return [];
    try {
      const { data, error } = await supabase
        .from("supplier_payments")
        .select("*, suppliers(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((p) => ({
        id: p.id,
        supplierId: p.supplier_id,
        supplierName: p.suppliers?.name || "Proveedor",
        purchaseId: p.purchase_id,
        amount: Number(p.amount || 0),
        method: p.method || "Efectivo",
        date: p.date || p.created_at,
        notes: p.notes,
        clientMutationId: p.client_mutation_id,
        createdAt: p.created_at,
      }));
    } catch (err) {
      console.warn("Fallo al obtener pagos a proveedores:", err);
      return [];
    }
  },

  async addSupplierPayment({ supplierId, purchaseId, amount, method, notes, clientMutationId }) {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.rpc("rpc_add_supplier_payment", {
        p_supplier_id: supplierId,
        p_purchase_id: isUUID(purchaseId) ? purchaseId : null,
        p_amount: Number(amount),
        p_method: method || "Efectivo",
        p_notes: notes || "",
        p_client_mutation_id: isUUID(clientMutationId) ? clientMutationId : null,
      });

      if (!error && data) return data;
      if (error && error.code !== "PGRST202" && !error.message?.includes("Could not find the function")) {
        throw error;
      }
    } catch (rpcErr) {
      console.warn("Fallo RPC rpc_add_supplier_payment, ejecutando fallback REST:", rpcErr);
    }

    // Fallback REST directo
    const nowIso = new Date().toISOString();
    const payPayload = {
      supplier_id: supplierId,
      amount: Number(amount),
      method: method || "Efectivo",
      notes: (notes || "").trim(),
      created_at: nowIso,
    };
    if (isUUID(purchaseId)) payPayload.purchase_id = purchaseId;
    if (isUUID(clientMutationId)) payPayload.client_mutation_id = clientMutationId;

    const { data: payment, error: pErr } = await supabase
      .from("supplier_payments")
      .insert(payPayload)
      .select()
      .single();

    if (pErr) throw pErr;

    // Disminuir saldo adeudado al proveedor
    try {
      const { data: supp } = await supabase.from("suppliers").select("balance").eq("id", supplierId).single();
      if (supp) {
        const newBal = Math.max(0, Number(supp.balance || 0) - Number(amount));
        await supabase.from("suppliers").update({ balance: newBal, updated_at: nowIso }).eq("id", supplierId);
      }
    } catch (e) {
      console.warn("No se pudo descontar saldo de proveedor en Supabase:", e);
    }

    return payment;
  },

  async deleteSupplier(id) {
    if (!isSupabaseConfigured) return;
    if (!isUUID(id)) return;
    const { error } = await supabase
      .from("suppliers")
      .update({ is_active: false })
      .eq("id", id);

    if (error) throw error;
  },

  // ==========================================================================
  // SEMBRADO INICIAL
  // ==========================================================================
  async seedCatalogIfEmpty() {
    if (!isSupabaseConfigured) return;
    try {
      // Asegura las categorías estructurales indispensables para clasificar cortes
      await this.ensureCategories();
    } catch (e) {
      console.warn("No se pudieron verificar las categorías en Supabase:", e);
    }
  },
};


