/**
 * Clases de Error Personalizadas del Sistema
 */
export class AppError extends Error {
  constructor(message, code = "APP_ERROR", details = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, "VALIDATION_ERROR", { field });
    this.name = "ValidationError";
    this.field = field;
  }
}

export class AuthError extends AppError {
  constructor(message, details = null) {
    super(message, "AUTH_ERROR", details);
    this.name = "AuthError";
  }
}

export class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, "DATABASE_ERROR", originalError);
    this.name = "DatabaseError";
  }
}

/**
 * Traduce errores de PostgreSQL / Supabase a mensajes comprensibles para el usuario
 */
export function parseDatabaseError(error) {
  if (!error) return "Ocurrió un error inesperado.";
  if (typeof error === "string") return error;

  // Códigos estándar PostgreSQL
  switch (error.code) {
    case "23505": // unique_violation
      if (error.message?.includes("dni")) return "Ya existe un cliente registrado con ese número de DNI.";
      if (error.message?.includes("name")) return "Ya existe un registro con ese nombre.";
      return "Ya existe un registro con esos datos únicos.";
    case "23503": // foreign_key_violation
      return "No se puede completar la operación porque el registro relacionado no existe o fue eliminado.";
    case "23514": // check_violation
      return "Los valores ingresados no cumplen con las reglas del sistema (por ejemplo, importes negativos).";
    case "42501": // insufficient_privilege / RLS
      return "Permisos insuficientes o sesión expirada para realizar esta acción.";
    case "PGRST116":
      return "No se encontró el registro solicitado.";
    default:
      return error.message || "Error al procesar la solicitud en la base de datos.";
  }
}

/**
 * Validador estricto de números positivos
 */
export function parsePositiveNumber(value, fieldName = "El valor") {
  if (value === null || value === undefined || value === "") {
    throw new ValidationError(`${fieldName} es obligatorio.`, fieldName);
  }
  const clean = String(value).trim().replace(",", ".");
  const num = parseFloat(clean);
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} debe ser un número válido.`, fieldName);
  }
  if (num <= 0) {
    throw new ValidationError(`${fieldName} debe ser mayor a cero.`, fieldName);
  }
  return num;
}

/**
 * Validador de números no negativos (>= 0)
 */
export function parseNonNegativeNumber(value, fieldName = "El valor") {
  if (value === null || value === undefined || value === "") return 0;
  const clean = String(value).trim().replace(",", ".");
  const num = parseFloat(clean);
  if (isNaN(num)) {
    throw new ValidationError(`${fieldName} debe ser un número válido.`, fieldName);
  }
  if (num < 0) {
    throw new ValidationError(`${fieldName} no puede ser un número negativo.`, fieldName);
  }
  return num;
}

/**
 * Constantes de seguridad contra desbordamiento numérico
 */
export const MAX_SAFE_PRICE = 50_000_000;   // Máximo $50 millones por precio unitario
export const MAX_SAFE_WEIGHT = 5_000;        // Máximo 5.000 kg por pesaje o corte
export const MAX_SAFE_TOTAL = 100_000_000;   // Máximo $100 millones por ticket de venta

/**
 * Validaciones de Negocio para Ventas
 */
export function validateSaleData({ items, method, customerId, tendered }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("El ticket no puede estar vacío. Agregá al menos un corte.");
  }

  const validMethods = ["Efectivo", "Transferencia", "Tarjeta", "Fiado"];
  if (!validMethods.includes(method)) {
    throw new ValidationError(`Método de pago no válido: ${method}.`);
  }

  if (method === "Fiado" && !customerId) {
    throw new ValidationError("Para vender a Fiado es obligatorio seleccionar un cliente.");
  }

  let total = 0;
  items.forEach((item, index) => {
    if (!item.name?.trim()) {
      throw new ValidationError(`El corte en posición #${index + 1} no tiene nombre válido.`);
    }
    const qty = parseFloat(item.qty);
    if (isNaN(qty) || qty <= 0) {
      throw new ValidationError(`La cantidad de "${item.name}" debe ser mayor a 0 (recibido: ${item.qty}).`);
    }
    if (qty > MAX_SAFE_WEIGHT) {
      throw new ValidationError(`La cantidad de "${item.name}" (${qty} kg) supera el límite de seguridad (máx. 5.000 kg).`);
    }
    const price = parseFloat(item.price);
    if (isNaN(price) || price <= 0) {
      throw new ValidationError(`El precio de "${item.name}" debe ser mayor a 0.`);
    }
    if (price > MAX_SAFE_PRICE) {
      throw new ValidationError(`El precio de "${item.name}" supera el límite permitido.`);
    }
    const lineTot = Math.round(qty * price);
    total += lineTot;
  });

  if (total <= 0) {
    throw new ValidationError("El importe total de la venta debe ser mayor a $0.");
  }

  if (total > MAX_SAFE_TOTAL) {
    throw new ValidationError("El total de la venta supera el límite de seguridad permitido ($100.000.000).");
  }

  const cleanTendered = parseNonNegativeNumber(tendered, "El importe abonado");
  if (cleanTendered > MAX_SAFE_TOTAL) {
    throw new ValidationError("El importe entregado supera el límite de seguridad.");
  }

  return {
    validTotal: total,
    validTendered: cleanTendered,
  };
}

/**
 * Validaciones de Negocio para Cobranzas de Fiados
 */
export function validatePaymentData({ customerId, amount, method, balance }) {
  if (!customerId) {
    throw new ValidationError("Es obligatorio seleccionar un cliente para registrar el cobro.");
  }
  const cleanAmount = parsePositiveNumber(amount, "El monto a pagar");

  if (cleanAmount > MAX_SAFE_TOTAL) {
    throw new ValidationError("El importe del cobro supera el límite de seguridad ($100.000.000).");
  }

  const validMethods = ["Efectivo", "Transferencia", "Tarjeta"];
  if (method && !validMethods.includes(method)) {
    throw new ValidationError("El medio de cobro seleccionado no es válido.");
  }

  if (typeof balance === "number" && balance > 0 && cleanAmount > balance) {
    throw new ValidationError(`El monto ($${cleanAmount.toLocaleString("es-AR")}) supera la deuda actual ($${balance.toLocaleString("es-AR")}).`);
  }

  return {
    validAmount: Math.round(cleanAmount),
  };
}

/**
 * Validaciones de Negocio para Movimientos de Stock
 */
export function validateMovementData({ productId, type, qty, cost, currentStock }) {
  if (!productId) {
    throw new ValidationError("Es obligatorio seleccionar un producto o corte.");
  }

  const validTypes = ["compra", "merma", "ajuste"];
  if (!validTypes.includes(type)) {
    throw new ValidationError("Tipo de movimiento no válido.");
  }

  const cleanQty = type === "ajuste"
    ? parseNonNegativeNumber(qty, "El stock contado en balanza")
    : parsePositiveNumber(qty, "La cantidad del movimiento");

  if (cleanQty > MAX_SAFE_WEIGHT) {
    throw new ValidationError(`La cantidad del movimiento (${cleanQty} kg) supera el límite de seguridad permitido (máx. 5.000 kg).`);
  }

  const cleanCost = parseNonNegativeNumber(cost, "El costo total");
  if (cleanCost > MAX_SAFE_TOTAL) {
    throw new ValidationError("El costo del movimiento supera el límite de seguridad ($100.000.000).");
  }

  if (type === "merma" && typeof currentStock === "number" && cleanQty > currentStock) {
    throw new ValidationError(
      `La cantidad de merma (${cleanQty}) supera el stock registrado (${currentStock}). Revisá el pesaje.`
    );
  }

  return {
    cleanQty,
    cleanCost,
  };
}

/**
 * Validaciones de Negocio para Productos
 */
export function validateProductData({ name, price, minStock, unit }) {
  if (!name || !name.trim()) {
    throw new ValidationError("El nombre del producto no puede estar vacío.", "name");
  }
  const cleanPrice = parsePositiveNumber(price, "El precio de venta");
  if (cleanPrice > MAX_SAFE_PRICE) {
    throw new ValidationError("El precio del corte supera el límite de seguridad permitido ($50.000.000).", "price");
  }

  const cleanMinStock = parseNonNegativeNumber(minStock, "El stock mínimo de alerta");
  if (cleanMinStock > MAX_SAFE_WEIGHT) {
    throw new ValidationError("El stock de alerta supera el límite de seguridad permitido (máx. 5.000 kg).", "minStock");
  }

  if (unit !== "kg" && unit !== "u") {
    throw new ValidationError("La unidad de medida debe ser 'kg' o 'u'.", "unit");
  }

  return {
    cleanName: name.trim(),
    cleanPrice: Math.round(cleanPrice),
    cleanMinStock,
    cleanUnit: unit,
  };
}

/**
 * Validaciones de Negocio para Clientes
 */
export function validateCustomerData({ name, dni, phone, address }) {
  if (!name || !name.trim()) {
    throw new ValidationError("El nombre del cliente es obligatorio.", "name");
  }

  let cleanDni = dni ? String(dni).trim().replace(/[^\d]/g, "") : null;
  if (cleanDni && cleanDni.length < 6) {
    throw new ValidationError("El número de DNI debe contener al menos 6 dígitos numéricos.", "dni");
  }

  return {
    cleanName: name.trim(),
    cleanDni,
    cleanPhone: phone ? String(phone).trim() : "",
    cleanAddress: address ? String(address).trim() : "",
  };
}

