-- ============================================================================
-- SUITE TRANSACCIONAL Y ARQUITECTURA DE BASE DE DATOS (POSTGRESQL / SUPABASE)
-- Sistema Integral de Gestión para Carnicería
-- ============================================================================

-- 1. EXTENSIÓN UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA DE AUDITORÍA ANTIFRAUDE (INMUTABLE)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_name, entity_id);

-- 2.1 TABLA DE MOVIMIENTOS Y GASTOS DE CAJA (EGRESOS / RETIROS / INGRESO DE CAMBIO)
CREATE TABLE IF NOT EXISTS public.cash_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('egreso', 'ingreso')),
    category TEXT NOT NULL DEFAULT 'Varios',
    amount NUMERIC NOT NULL CHECK (amount > 0),
    note TEXT DEFAULT '',
    user_id UUID,
    client_mutation_id UUID UNIQUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_date ON public.cash_movements (created_at DESC);

-- 2.2 TABLA DE PROVEEDORES (FRIGORÍFICOS, HACIENDA, DISTRIBUIDORES)
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    cuit_dni TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    category TEXT DEFAULT 'Frigorífico',
    balance NUMERIC NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON public.suppliers (is_active);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers (name);

-- 2.3 TABLA DE COMPRAS / FACTURAS DE PROVEEDORES
CREATE TABLE IF NOT EXISTS public.supplier_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    invoice_number TEXT DEFAULT '',
    date TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    total NUMERIC NOT NULL CHECK (total > 0),
    paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
    notes TEXT DEFAULT '',
    client_mutation_id UUID UNIQUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supplier_purchases_supplier ON public.supplier_purchases (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_purchases_date ON public.supplier_purchases (date DESC);

-- 2.4 TABLA DE PAGOS REALIZADOS A PROVEEDORES (CUENTAS POR PAGAR)
CREATE TABLE IF NOT EXISTS public.supplier_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
    purchase_id UUID REFERENCES public.supplier_purchases(id),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    method TEXT NOT NULL DEFAULT 'Efectivo',
    date TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    notes TEXT DEFAULT '',
    client_mutation_id UUID UNIQUE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON public.supplier_payments (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON public.supplier_payments (date DESC);

-- 2.5 TABLA DE CIERRES DE CAJA (ARQUEOS DIARIOS / CIERRES Z)
CREATE TABLE IF NOT EXISTS public.cash_closings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    total_sales NUMERIC NOT NULL DEFAULT 0,
    cash_in_drawer NUMERIC NOT NULL DEFAULT 0,
    cash_difference NUMERIC NOT NULL DEFAULT 0,
    sales_count INTEGER NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- 2.6 TABLA DE PERFILES DE USUARIOS / EMPLEADOS (ROLES Y PERMISOS)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'cajero' CHECK (role IN ('admin', 'cajero', 'stock')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Trigger automático para crear perfil cuando un usuario se registra en Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (id, username, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Operador'),
        COALESCE(NEW.raw_user_meta_data->>'role', 'cajero')
    )
    ON CONFLICT (id) DO UPDATE SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. ASEGURAR CAMPOS DE IDEMPOTENCIA Y ESTADO EN TABLAS PRINCIPALES
DO $$
BEGIN
    -- client_mutation_id y estados en sales
    ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS client_mutation_id UUID UNIQUE;
    ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS ticket_number BIGSERIAL;
    ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS void_reason TEXT;
    ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS voided_by UUID;
    ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;

    -- campos en customers
    ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0;
    ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;
    ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS allow_credit BOOLEAN DEFAULT true;
    ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

    -- client_mutation_id en tablas auxiliares
    ALTER TABLE IF EXISTS public.customer_payments ADD COLUMN IF NOT EXISTS client_mutation_id UUID UNIQUE;
    ALTER TABLE IF EXISTS public.inventory_movements ADD COLUMN IF NOT EXISTS client_mutation_id UUID UNIQUE;
    ALTER TABLE IF EXISTS public.cash_movements ADD COLUMN IF NOT EXISTS client_mutation_id UUID UNIQUE;

    -- columnas en supplier_purchases
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS client_mutation_id UUID UNIQUE;

    -- columnas en supplier_payments
    ALTER TABLE IF EXISTS public.supplier_payments ADD COLUMN IF NOT EXISTS purchase_id UUID;
    ALTER TABLE IF EXISTS public.supplier_payments ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
    ALTER TABLE IF EXISTS public.supplier_payments ADD COLUMN IF NOT EXISTS client_mutation_id UUID UNIQUE;
END $$;

-- 4. SECUENCIA ATÓMICA DE NÚMERO DE TICKET SI NO ES BIGSERIAL
CREATE SEQUENCE IF NOT EXISTS public.ticket_number_seq START WITH 10001;

-- 5. HABILITAR ROW LEVEL SECURITY (RLS) Y POLÍTICAS PERMISIVAS PARA LA TERMINAL
DO $$
DECLARE
    t TEXT;
    tables TEXT[] := ARRAY[
        'categories', 'products', 'customers', 'sales', 'sale_items', 
        'customer_payments', 'inventory_movements', 'cash_movements', 
        'suppliers', 'supplier_purchases', 'supplier_payments', 
        'cash_closings', 'audit_logs', 'profiles'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(t) || ' ENABLE ROW LEVEL SECURITY;';
            EXECUTE 'DROP POLICY IF EXISTS "allow_all_ops_' || t || '" ON public.' || quote_ident(t) || ';';
            EXECUTE 'CREATE POLICY "allow_all_ops_' || t || '" ON public.' || quote_ident(t) || ' FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);';
        END IF;
    END LOOP;
END $$;

-- 6. CONFIRMAR USUARIOS PREVIOS EN SUPABASE AUTH
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    confirmed_at = COALESCE(confirmed_at, NOW())
WHERE email_confirmed_at IS NULL;

-- ============================================================================
-- 6. PROCEDIMIENTO RPC: PROCESAR VENTA ATÓMICA CON ROW-LOCKING (rpc_process_sale)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_process_sale(
    p_customer_id UUID DEFAULT NULL,
    p_method TEXT DEFAULT 'Efectivo',
    p_items JSONB DEFAULT '[]'::jsonb,
    p_tendered NUMERIC DEFAULT NULL,
    p_change NUMERIC DEFAULT 0,
    p_client_mutation_id UUID DEFAULT NULL,
    p_override_credit_limit BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id UUID;
    v_ticket_num BIGINT;
    v_total NUMERIC := 0;
    v_item RECORD;
    v_prod_stock NUMERIC;
    v_prod_name TEXT;
    v_prod_price NUMERIC;
    v_prod_unit TEXT;
    v_line_total NUMERIC;
    v_cust_balance NUMERIC;
    v_credit_limit NUMERIC;
    v_allow_credit BOOLEAN := TRUE;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_current_user_id UUID := auth.uid();
BEGIN
    -- A. Verificación de Idempotencia: si ya existe por corte de red, devolver la existente
    IF p_client_mutation_id IS NOT NULL THEN
        SELECT id, ticket_number, total, tendered, change_returned, created_at
        INTO v_sale_id, v_ticket_num, v_total, p_tendered, p_change, v_now
        FROM public.sales
        WHERE client_mutation_id = p_client_mutation_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'id', v_sale_id,
                'ticketNumber', v_ticket_num,
                'total', v_total,
                'tendered', p_tendered,
                'change', p_change,
                'date', v_now,
                'isIdempotentReplay', true
            );
        END IF;
    END IF;

    -- B. Validación de Entrada
    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El ticket no puede estar vacío.' USING ERRCODE = '20001';
    END IF;

    IF p_method = 'Fiado' AND p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Para ventas a Fiado es obligatorio asignar un cliente.' USING ERRCODE = '20002';
    END IF;

    -- C. Calcular total y validar ítems
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        productId UUID,
        qty NUMERIC,
        price NUMERIC,
        name TEXT,
        unit TEXT
    )
    LOOP
        IF v_item.qty IS NULL OR v_item.qty <= 0 THEN
            RAISE EXCEPTION 'Cantidad inválida para producto %: %', v_item.name, v_item.qty USING ERRCODE = '20003';
        END IF;

        IF v_item.price IS NULL OR v_item.price <= 0 THEN
            RAISE EXCEPTION 'Precio inválido para producto %: %', v_item.name, v_item.price USING ERRCODE = '20004';
        END IF;

        v_line_total := ROUND(v_item.qty * v_item.price);
        v_total := v_total + v_line_total;
    END LOOP;

    IF v_total <= 0 THEN
        RAISE EXCEPTION 'El importe total de la venta debe ser mayor a 0.' USING ERRCODE = '20005';
    END IF;

    IF p_tendered IS NULL OR p_tendered <= 0 THEN
        p_tendered := v_total;
    END IF;

    -- D. Generar número de ticket seguro
    v_ticket_num := nextval('public.ticket_number_seq');

    -- E. Insertar cabecera de venta
    INSERT INTO public.sales (
        customer_id,
        method,
        subtotal,
        total,
        tendered,
        change_returned,
        status,
        ticket_number,
        client_mutation_id,
        created_at
    ) VALUES (
        p_customer_id,
        p_method,
        v_total,
        v_total,
        p_tendered,
        p_change,
        'completed',
        v_ticket_num,
        p_client_mutation_id,
        v_now
    ) RETURNING id INTO v_sale_id;

    -- F. Insertar ítems y descontar stock con BLOQUEO DE FILA (FOR UPDATE)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        productId UUID,
        qty NUMERIC,
        price NUMERIC,
        name TEXT,
        unit TEXT
    )
    LOOP
        v_line_total := ROUND(v_item.qty * v_item.price);

        -- Bloquear fila del producto para evitar carreras concurrentes de stock
        SELECT stock, name, unit, price INTO v_prod_stock, v_prod_name, v_prod_unit, v_prod_price
        FROM public.products
        WHERE id = v_item.productId
        FOR UPDATE;

        IF FOUND THEN
            -- Descontar stock con precisión de 3 decimales (gramos)
            UPDATE public.products
            SET stock = ROUND((stock - v_item.qty)::numeric, 3),
                updated_at = v_now
            WHERE id = v_item.productId;

            -- Insertar detalle de venta
            INSERT INTO public.sale_items (
                sale_id,
                product_id,
                product_name,
                unit,
                unit_price,
                quantity,
                total_price,
                created_at
            ) VALUES (
                v_sale_id,
                v_item.productId,
                COALESCE(v_prod_name, v_item.name),
                COALESCE(v_prod_unit, v_item.unit, 'kg'),
                v_item.price,
                v_item.qty,
                v_line_total,
                v_now
            );
        ELSE
            -- Si no está en catálogo como UUID, insertar ítem como texto libre
            INSERT INTO public.sale_items (
                sale_id,
                product_name,
                unit,
                unit_price,
                quantity,
                total_price,
                created_at
            ) VALUES (
                v_sale_id,
                v_item.name,
                COALESCE(v_item.unit, 'kg'),
                v_item.price,
                v_item.qty,
                v_line_total,
                v_now
            );
        END IF;
    END LOOP;

    -- G. Si la venta es Fiado, validar límite de crédito y actualizar balance del cliente con BLOQUEO DE FILA
    IF p_method = 'Fiado' AND p_customer_id IS NOT NULL THEN
        SELECT balance, credit_limit, COALESCE(allow_credit, true) INTO v_cust_balance, v_credit_limit, v_allow_credit
        FROM public.customers
        WHERE id = p_customer_id
        FOR UPDATE;

        IF FOUND THEN
            -- Validación de fiado permitido
            IF v_allow_credit = false AND NOT p_override_credit_limit THEN
                RAISE EXCEPTION 'Este cliente tiene las ventas a fiado inhabilitadas. Requiere autorización de supervisor.'
                    USING ERRCODE = '20051';
            END IF;

            -- Control estricto de límite de crédito comercial
            IF COALESCE(v_credit_limit, 0) > 0 
               AND (COALESCE(v_cust_balance, 0) + v_total) > v_credit_limit 
               AND NOT p_override_credit_limit THEN
                RAISE EXCEPTION 'Límite de fiado excedido (Límite: $%, Deuda actual: $%, Venta: $%). Requiere autorización de supervisor.',
                    v_credit_limit, COALESCE(v_cust_balance, 0), v_total
                    USING ERRCODE = '20050';
            END IF;

            UPDATE public.customers
            SET balance = ROUND((COALESCE(balance, 0) + v_total)::numeric, 2),
                updated_at = v_now
            WHERE id = p_customer_id;
        END IF;
    END IF;

    -- H. Registrar Asiento de Auditoría Inmutable
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details
    ) VALUES (
        v_current_user_id,
        'CREATE_SALE',
        'sales',
        v_sale_id,
        jsonb_build_object(
            'ticketNumber', v_ticket_num,
            'total', v_total,
            'method', p_method,
            'customerId', p_customer_id,
            'itemCount', jsonb_array_length(p_items)
        )
    );

    RETURN jsonb_build_object(
        'id', v_sale_id,
        'ticketNumber', v_ticket_num,
        'total', v_total,
        'tendered', p_tendered,
        'change', p_change,
        'date', v_now
    );
END;
$$;

-- ============================================================================
-- 6. PROCEDIMIENTO RPC: ANULACIÓN ATÓMICA DE VENTA (rpc_void_sale)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_void_sale(
    p_sale_id UUID,
    p_reason TEXT DEFAULT 'Anulación solicitada en mostrador'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale RECORD;
    v_item RECORD;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_current_user_id UUID := auth.uid();
BEGIN
    -- Bloquear la venta para evitar dobles anulaciones
    SELECT * INTO v_sale
    FROM public.sales
    WHERE id = p_sale_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta % no encontrada.', p_sale_id USING ERRCODE = '20010';
    END IF;

    IF v_sale.status = 'voided' THEN
        RETURN jsonb_build_object(
            'success', true,
            'alreadyVoided', true,
            'saleId', p_sale_id
        );
    END IF;

    -- 1. Marcar como anulada (NUNCA BORRAR FÍSICAMENTE)
    UPDATE public.sales
    SET status = 'voided',
        voided_at = v_now,
        void_reason = p_reason,
        voided_by = v_current_user_id
    WHERE id = p_sale_id;

    -- 2. Devolver stock de cada corte involucrado
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
    LOOP
        IF v_item.product_id IS NOT NULL THEN
            UPDATE public.products
            SET stock = ROUND((stock + v_item.quantity)::numeric, 3),
                updated_at = v_now
            WHERE id = v_item.product_id;
        END IF;
    END LOOP;

    -- 3. Si era fiado, revertir deuda del cliente
    IF v_sale.method = 'Fiado' AND v_sale.customer_id IS NOT NULL THEN
        UPDATE public.customers
        SET balance = GREATEST(0, ROUND((COALESCE(balance, 0) - v_sale.total)::numeric, 2)),
            updated_at = v_now
        WHERE id = v_sale.customer_id;
    END IF;

    -- 4. Registrar auditoría antifraude
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details
    ) VALUES (
        v_current_user_id,
        'VOID_SALE',
        'sales',
        p_sale_id,
        jsonb_build_object(
            'ticketNumber', v_sale.ticket_number,
            'totalReversed', v_sale.total,
            'method', v_sale.method,
            'reason', p_reason
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'saleId', p_sale_id,
        'voidedAt', v_now
    );
END;
$$;

-- ============================================================================
-- 7. PROCEDIMIENTO RPC: REGISTRO DE MOVIMIENTO DE STOCK (rpc_add_inventory_movement)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_add_inventory_movement(
    p_product_id UUID,
    p_type TEXT,
    p_qty NUMERIC,
    p_cost NUMERIC DEFAULT 0,
    p_note TEXT DEFAULT '',
    p_client_mutation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev_stock NUMERIC;
    v_delta NUMERIC;
    v_new_stock NUMERIC;
    v_mov_id UUID;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_current_user_id UUID := auth.uid();
BEGIN
    IF p_qty IS NULL OR p_qty < 0 THEN
        RAISE EXCEPTION 'La cantidad no puede ser negativa.' USING ERRCODE = '20020';
    END IF;

    -- Bloquear producto
    SELECT stock INTO v_prev_stock
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto no encontrado.' USING ERRCODE = '20021';
    END IF;

    v_prev_stock := COALESCE(v_prev_stock, 0);

    IF p_type = 'compra' THEN
        v_delta := p_qty;
    ELSIF p_type = 'merma' THEN
        v_delta := -p_qty;
    ELSIF p_type = 'ajuste' THEN
        v_delta := ROUND((p_qty - v_prev_stock)::numeric, 3);
    ELSE
        RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_type USING ERRCODE = '20022';
    END IF;

    v_new_stock := ROUND((v_prev_stock + v_delta)::numeric, 3);

    -- Actualizar stock en catálogo
    UPDATE public.products
    SET stock = v_new_stock,
        updated_at = v_now
    WHERE id = p_product_id;

    -- Insertar en historial de movimientos
    INSERT INTO public.inventory_movements (
        product_id,
        type,
        delta,
        previous_stock,
        resulting_stock,
        total_cost,
        note,
        client_mutation_id,
        created_at
    ) VALUES (
        p_product_id,
        p_type,
        v_delta,
        v_prev_stock,
        v_new_stock,
        COALESCE(p_cost, 0),
        p_note,
        p_client_mutation_id,
        v_now
    ) RETURNING id INTO v_mov_id;

    -- Auditoría
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details
    ) VALUES (
        v_current_user_id,
        'STOCK_MOVEMENT',
        'inventory_movements',
        v_mov_id,
        jsonb_build_object(
            'productId', p_product_id,
            'type', p_type,
            'delta', v_delta,
            'previousStock', v_prev_stock,
            'resultingStock', v_new_stock
        )
    );

    RETURN jsonb_build_object(
        'id', v_mov_id,
        'productId', p_product_id,
        'type', p_type,
        'delta', v_delta,
        'resultingStock', v_new_stock,
        'createdAt', v_now
    );
END;
$$;

-- ============================================================================
-- 8. PROCEDIMIENTO RPC: REGISTRO DE COBRO A CLIENTE (rpc_add_payment)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_add_payment(
    p_customer_id UUID,
    p_amount NUMERIC,
    p_method TEXT DEFAULT 'Efectivo',
    p_client_mutation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_prev_balance NUMERIC;
    v_new_balance NUMERIC;
    v_payment_id UUID;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_current_user_id UUID := auth.uid();
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El importe de pago debe ser mayor a 0.' USING ERRCODE = '20030';
    END IF;

    -- Bloquear cliente
    SELECT balance INTO v_prev_balance
    FROM public.customers
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cliente no encontrado.' USING ERRCODE = '20031';
    END IF;

    v_prev_balance := COALESCE(v_prev_balance, 0);
    v_new_balance := GREATEST(0, ROUND((v_prev_balance - p_amount)::numeric, 2));

    -- Actualizar balance del cliente
    UPDATE public.customers
    SET balance = v_new_balance,
        updated_at = v_now
    WHERE id = p_customer_id;

    -- Insertar pago
    INSERT INTO public.customer_payments (
        customer_id,
        amount,
        method,
        client_mutation_id,
        created_at
    ) VALUES (
        p_customer_id,
        p_amount,
        COALESCE(p_method, 'Efectivo'),
        p_client_mutation_id,
        v_now
    ) RETURNING id INTO v_payment_id;

    -- Auditoría
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details
    ) VALUES (
        v_current_user_id,
        'CUSTOMER_PAYMENT',
        'customer_payments',
        v_payment_id,
        jsonb_build_object(
            'customerId', p_customer_id,
            'amount', p_amount,
            'previousBalance', v_prev_balance,
            'newBalance', v_new_balance
        )
    );

    RETURN jsonb_build_object(
        'id', v_payment_id,
        'customerId', p_customer_id,
        'amount', p_amount,
        'method', p_method,
        'newBalance', v_new_balance,
        'date', v_now
    );
END;
$$;

-- ============================================================================
-- 9. PROCEDIMIENTO RPC: REGISTRO DE MOVIMIENTOS/EGRESOS DE CAJA (rpc_add_cash_movement)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_add_cash_movement(
    p_type TEXT,
    p_category TEXT DEFAULT 'Varios',
    p_amount NUMERIC DEFAULT NULL,
    p_note TEXT DEFAULT '',
    p_client_mutation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_mov_id UUID;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_current_user_id UUID := auth.uid();
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El importe debe ser mayor a 0.' USING ERRCODE = '20040';
    END IF;

    IF p_type NOT IN ('egreso', 'ingreso') THEN
        RAISE EXCEPTION 'Tipo de movimiento inválido: %', p_type USING ERRCODE = '20041';
    END IF;

    -- Idempotencia preventiva ante microcortes
    IF p_client_mutation_id IS NOT NULL THEN
        SELECT id, created_at INTO v_mov_id, v_now
        FROM public.cash_movements
        WHERE client_mutation_id = p_client_mutation_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'id', v_mov_id,
                'type', p_type,
                'category', p_category,
                'amount', p_amount,
                'note', p_note,
                'createdAt', v_now,
                'isIdempotentReplay', true
            );
        END IF;
    END IF;

    INSERT INTO public.cash_movements (
        type,
        category,
        amount,
        note,
        user_id,
        client_mutation_id,
        created_at
    ) VALUES (
        p_type,
        COALESCE(p_category, 'Varios'),
        p_amount,
        COALESCE(p_note, ''),
        v_current_user_id,
        p_client_mutation_id,
        v_now
    ) RETURNING id INTO v_mov_id;

    -- Asiento de Auditoría Inmutable
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details
    ) VALUES (
        v_current_user_id,
        CASE WHEN p_type = 'egreso' THEN 'CASH_EXPENSE' ELSE 'CASH_INFLOW' END,
        'cash_movements',
        v_mov_id,
        jsonb_build_object(
            'type', p_type,
            'category', p_category,
            'amount', p_amount,
            'note', p_note
        )
    );

    RETURN jsonb_build_object(
        'id', v_mov_id,
        'type', p_type,
        'category', p_category,
        'amount', p_amount,
        'note', p_note,
        'createdAt', v_now
    );
END;
$$;

-- ============================================================================
-- 10. PROCEDIMIENTO RPC: LECTURA SEGURA DE BITÁCORA DE AUDITORÍA (rpc_get_audit_logs)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_audit_logs(p_limit INT DEFAULT 60)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    action TEXT,
    entity_name TEXT,
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT a.id, a.user_id, a.action, a.entity_name, a.entity_id, a.details, a.created_at
    FROM public.audit_logs a
    ORDER BY a.created_at DESC
    LIMIT p_limit;
END;
$$;

-- ============================================================================
-- 12. PROCEDIMIENTO RPC: ACTUALIZACIÓN MASIVA DE PRECIOS CON ROW LOCKING Y AUDITORÍA
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rpc_bulk_update_prices(
    p_category_name TEXT DEFAULT 'Todas',
    p_type TEXT DEFAULT 'percentage',     -- 'percentage' o 'fixed'
    p_value NUMERIC DEFAULT 0,            -- ej: 10 para +10%, 500 para +$500
    p_round_to INTEGER DEFAULT 10,        -- 1, 10, 50, 100
    p_target_field TEXT DEFAULT 'price'    -- 'price', 'cost', 'both'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INTEGER := 0;
    v_prod RECORD;
    v_new_price NUMERIC;
    v_new_cost NUMERIC;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_current_user_id UUID := auth.uid();
    v_round_factor NUMERIC;
    v_audit_details JSONB;
    v_changes JSONB := '[]'::jsonb;
BEGIN
    -- 1. Validaciones
    IF p_value = 0 THEN
        RAISE EXCEPTION 'El valor de ajuste no puede ser cero.' USING ERRCODE = '20060';
    END IF;

    IF p_type NOT IN ('percentage', 'fixed') THEN
        RAISE EXCEPTION 'Tipo de ajuste inválido: %. Debe ser "percentage" o "fixed".', p_type USING ERRCODE = '20061';
    END IF;

    IF p_target_field NOT IN ('price', 'cost', 'both') THEN
        RAISE EXCEPTION 'Campo objetivo inválido: %. Debe ser "price", "cost" o "both".', p_target_field USING ERRCODE = '20062';
    END IF;

    v_round_factor := CASE 
        WHEN p_round_to > 1 THEN p_round_to::numeric 
        ELSE 1.0 
    END;

    -- 2. Iterar y actualizar con FOR UPDATE
    FOR v_prod IN (
        SELECT p.id, p.name, p.price, p.cost, COALESCE(c.name, 'Vaca') AS cat_name
        FROM public.products p
        LEFT JOIN public.categories c ON p.category_id = c.id
        WHERE p.is_active = true
          AND (p_category_name IS NULL OR p_category_name = 'Todas' OR LOWER(COALESCE(c.name, 'Vaca')) = LOWER(p_category_name))
        FOR UPDATE OF p
    ) LOOP
        v_new_price := v_prod.price;
        v_new_cost := v_prod.cost;

        -- Calcular precio
        IF p_target_field IN ('price', 'both') THEN
            IF p_type = 'percentage' THEN
                v_new_price := v_prod.price * (1.0 + (p_value / 100.0));
            ELSE
                v_new_price := v_prod.price + p_value;
            END IF;
            v_new_price := ROUND(v_new_price / v_round_factor) * v_round_factor;
            IF v_new_price < 1 THEN
                v_new_price := 1;
            END IF;
        END IF;

        -- Calcular costo
        IF p_target_field IN ('cost', 'both') THEN
            IF p_type = 'percentage' THEN
                v_new_cost := v_prod.cost * (1.0 + (p_value / 100.0));
            ELSE
                v_new_cost := v_prod.cost + p_value;
            END IF;
            v_new_cost := ROUND(v_new_cost / v_round_factor) * v_round_factor;
            IF v_new_cost < 0 THEN
                v_new_cost := 0;
            END IF;
        END IF;

        -- Aplicar actualización
        UPDATE public.products
        SET price = v_new_price,
            cost = v_new_cost,
            updated_at = v_now
        WHERE id = v_prod.id;

        v_updated_count := v_updated_count + 1;

        -- Registrar cambio individual para detalle de auditoría (hasta 50 cortes)
        IF v_updated_count <= 50 THEN
            v_changes := v_changes || jsonb_build_object(
                'id', v_prod.id,
                'name', v_prod.name,
                'oldPrice', v_prod.price,
                'newPrice', v_new_price,
                'oldCost', v_prod.cost,
                'newCost', v_new_cost
            );
        END IF;
    END LOOP;

    -- 3. Asiento de Auditoría Inmutable
    v_audit_details := jsonb_build_object(
        'category', p_category_name,
        'type', p_type,
        'value', p_value,
        'roundTo', p_round_to,
        'targetField', p_target_field,
        'updatedCount', v_updated_count,
        'sampleChanges', v_changes
    );

    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        details,
        created_at
    ) VALUES (
        v_current_user_id,
        'BULK_PRICE_UPDATE',
        'products',
        v_audit_details,
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'updatedCount', v_updated_count,
        'category', p_category_name,
        'type', p_type,
        'value', p_value,
        'roundTo', p_round_to
    );
END;
$$;

-- ============================================================================
-- 13. PROCEDIMIENTOS RPC: MÓDULO DE PROVEEDORES Y CUENTAS POR PAGAR
-- ============================================================================

-- 13.1 Guardar o Actualizar Proveedor
CREATE OR REPLACE FUNCTION public.rpc_save_supplier(
    p_name TEXT,
    p_cuit_dni TEXT DEFAULT '',
    p_phone TEXT DEFAULT '',
    p_category TEXT DEFAULT 'Frigorífico',
    p_notes TEXT DEFAULT '',
    p_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID := p_id;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_current_user_id UUID := auth.uid();
BEGIN
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'El nombre del proveedor es obligatorio.' USING ERRCODE = '20070';
    END IF;

    IF v_id IS NOT NULL THEN
        UPDATE public.suppliers
        SET name = TRIM(p_name),
            cuit_dni = TRIM(COALESCE(p_cuit_dni, '')),
            phone = TRIM(COALESCE(p_phone, '')),
            category = COALESCE(p_category, 'Frigorífico'),
            notes = TRIM(COALESCE(p_notes, '')),
            updated_at = v_now
        WHERE id = v_id;
    ELSE
        INSERT INTO public.suppliers (
            name,
            cuit_dni,
            phone,
            category,
            notes,
            created_at,
            updated_at
        ) VALUES (
            TRIM(p_name),
            TRIM(COALESCE(p_cuit_dni, '')),
            TRIM(COALESCE(p_phone, '')),
            COALESCE(p_category, 'Frigorífico'),
            TRIM(COALESCE(p_notes, '')),
            v_now,
            v_now
        ) RETURNING id INTO v_id;
    END IF;

    -- Auditoría
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_current_user_id,
        'SAVE_SUPPLIER',
        'suppliers',
        v_id,
        jsonb_build_object('name', p_name, 'category', p_category),
        v_now
    );

    RETURN jsonb_build_object('id', v_id, 'name', p_name, 'success', true);
END;
$$;

-- 13.2 Registrar Compra / Factura de Proveedor (Cuentas por Pagar)
CREATE OR REPLACE FUNCTION public.rpc_add_supplier_purchase(
    p_supplier_id UUID,
    p_invoice_number TEXT DEFAULT '',
    p_total NUMERIC DEFAULT 0,
    p_paid_amount NUMERIC DEFAULT 0,
    p_method TEXT DEFAULT 'Efectivo',
    p_notes TEXT DEFAULT '',
    p_client_mutation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_purchase_id UUID;
    v_supplier RECORD;
    v_unpaid NUMERIC;
    v_status TEXT;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_current_user_id UUID := auth.uid();
BEGIN
    -- Idempotencia preventiva ante microcortes
    IF p_client_mutation_id IS NOT NULL THEN
        SELECT id, created_at INTO v_purchase_id, v_now
        FROM public.supplier_purchases
        WHERE client_mutation_id = p_client_mutation_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'id', v_purchase_id,
                'total', p_total,
                'paidAmount', p_paid_amount,
                'createdAt', v_now,
                'isIdempotentReplay', true
            );
        END IF;
    END IF;

    IF p_total IS NULL OR p_total <= 0 THEN
        RAISE EXCEPTION 'El total de la compra debe ser mayor a 0.' USING ERRCODE = '20071';
    END IF;

    IF p_paid_amount IS NULL OR p_paid_amount < 0 THEN
        p_paid_amount := 0;
    END IF;

    IF p_paid_amount > p_total THEN
        RAISE EXCEPTION 'El pago inicial no puede superar el total de la compra.' USING ERRCODE = '20072';
    END IF;

    -- Bloquear proveedor para evitar inconsistencias de deuda
    SELECT * INTO v_supplier
    FROM public.suppliers
    WHERE id = p_supplier_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proveedor no encontrado.' USING ERRCODE = '20073';
    END IF;

    v_unpaid := p_total - p_paid_amount;
    v_status := CASE 
        WHEN p_paid_amount = p_total THEN 'paid'
        WHEN p_paid_amount > 0 THEN 'partial'
        ELSE 'pending'
    END;

    -- Insertar factura / compra
    INSERT INTO public.supplier_purchases (
        supplier_id,
        invoice_number,
        date,
        total,
        paid_amount,
        status,
        notes,
        client_mutation_id,
        created_at
    ) VALUES (
        p_supplier_id,
        TRIM(COALESCE(p_invoice_number, '')),
        v_now,
        p_total,
        p_paid_amount,
        v_status,
        TRIM(COALESCE(p_notes, '')),
        p_client_mutation_id,
        v_now
    ) RETURNING id INTO v_purchase_id;

    -- Si queda deuda pendiente, actualizar saldo deudor
    IF v_unpaid > 0 THEN
        UPDATE public.suppliers
        SET balance = ROUND((balance + v_unpaid)::numeric, 2),
            updated_at = v_now
        WHERE id = p_supplier_id;
    END IF;

    -- Si hubo pago inicial, registrarlo en pagos a proveedores
    IF p_paid_amount > 0 THEN
        INSERT INTO public.supplier_payments (
            supplier_id,
            purchase_id,
            amount,
            method,
            date,
            notes,
            created_at
        ) VALUES (
            p_supplier_id,
            v_purchase_id,
            p_paid_amount,
            p_method,
            v_now,
            'Pago inicial factura ' || COALESCE(p_invoice_number, 'S/N'),
            v_now
        );

        -- Si fue en efectivo de mostrador, registrar egreso de caja para arqueo
        IF p_method = 'Efectivo' THEN
            INSERT INTO public.cash_movements (
                type,
                category,
                amount,
                note,
                user_id,
                created_at
            ) VALUES (
                'egreso',
                'Proveedores',
                p_paid_amount,
                'Pago inicial a ' || v_supplier.name || ' (Fact: ' || COALESCE(p_invoice_number, 'S/N') || ')',
                v_current_user_id,
                v_now
            );
        END IF;
    END IF;

    -- Auditoría
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_current_user_id,
        'ADD_SUPPLIER_PURCHASE',
        'supplier_purchases',
        v_purchase_id,
        jsonb_build_object(
            'supplierName', v_supplier.name,
            'total', p_total,
            'paidAmount', p_paid_amount,
            'unpaidDebt', v_unpaid,
            'invoice', p_invoice_number
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'id', v_purchase_id,
        'total', p_total,
        'paidAmount', p_paid_amount,
        'unpaid', v_unpaid,
        'status', v_status,
        'createdAt', v_now
    );
END;
$$;

-- 13.3 Registrar Pago a Proveedor (Cancelación de Deuda)
CREATE OR REPLACE FUNCTION public.rpc_add_supplier_payment(
    p_supplier_id UUID,
    p_purchase_id UUID DEFAULT NULL,
    p_amount NUMERIC DEFAULT 0,
    p_method TEXT DEFAULT 'Efectivo',
    p_notes TEXT DEFAULT '',
    p_client_mutation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_payment_id UUID;
    v_supplier RECORD;
    v_now TIMESTAMPTZ := TIMEZONE('utc', NOW());
    v_current_user_id UUID := auth.uid();
BEGIN
    -- Idempotencia
    IF p_client_mutation_id IS NOT NULL THEN
        SELECT id, created_at INTO v_payment_id, v_now
        FROM public.supplier_payments
        WHERE client_mutation_id = p_client_mutation_id;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'id', v_payment_id,
                'amount', p_amount,
                'createdAt', v_now,
                'isIdempotentReplay', true
            );
        END IF;
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'El monto del pago debe ser mayor a 0.' USING ERRCODE = '20074';
    END IF;

    -- Bloquear proveedor
    SELECT * INTO v_supplier
    FROM public.suppliers
    WHERE id = p_supplier_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Proveedor no encontrado.' USING ERRCODE = '20075';
    END IF;

    -- Registrar pago
    INSERT INTO public.supplier_payments (
        supplier_id,
        purchase_id,
        amount,
        method,
        date,
        notes,
        client_mutation_id,
        created_at
    ) VALUES (
        p_supplier_id,
        p_purchase_id,
        p_amount,
        p_method,
        v_now,
        TRIM(COALESCE(p_notes, '')),
        p_client_mutation_id,
        v_now
    ) RETURNING id INTO v_payment_id;

    -- Disminuir saldo adeudado al proveedor
    UPDATE public.suppliers
    SET balance = ROUND(GREATEST(balance - p_amount, 0)::numeric, 2),
        updated_at = v_now
    WHERE id = p_supplier_id;

    -- Si se pagó una compra específica, actualizar su saldo
    IF p_purchase_id IS NOT NULL THEN
        UPDATE public.supplier_purchases
        SET paid_amount = ROUND((paid_amount + p_amount)::numeric, 2),
            status = CASE 
                WHEN (paid_amount + p_amount) >= total THEN 'paid'
                ELSE 'partial'
            END
        WHERE id = p_purchase_id;
    END IF;

    -- Si el pago se realizó en efectivo, registrar el egreso en caja
    IF p_method = 'Efectivo' THEN
        INSERT INTO public.cash_movements (
            type,
            category,
            amount,
            note,
            user_id,
            created_at
        ) VALUES (
            'egreso',
            'Proveedores',
            p_amount,
            'Pago deuda a ' || v_supplier.name || ' (' || COALESCE(p_notes, '') || ')',
            v_current_user_id,
            v_now
        );
    END IF;

    -- Auditoría
    INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_name,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_current_user_id,
        'ADD_SUPPLIER_PAYMENT',
        'supplier_payments',
        v_payment_id,
        jsonb_build_object(
            'supplierName', v_supplier.name,
            'amount', p_amount,
            'method', p_method,
            'previousBalance', v_supplier.balance,
            'newBalance', GREATEST(v_supplier.balance - p_amount, 0)
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'id', v_payment_id,
        'supplierId', p_supplier_id,
        'amount', p_amount,
        'createdAt', v_now
    );
END;
$$;

-- Permisos de ejecución para usuarios autenticados y clave pública (asigna a la firma exacta registrada)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname IN (
            'rpc_process_sale',
            'rpc_void_sale',
            'rpc_add_inventory_movement',
            'rpc_add_payment',
            'rpc_add_cash_movement',
            'rpc_get_audit_logs',
            'rpc_bulk_update_prices',
            'rpc_save_supplier',
            'rpc_add_supplier_purchase',
            'rpc_add_supplier_payment'
        )
        AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_signature || ' TO anon, authenticated, service_role;';
    END LOOP;
END $$;
