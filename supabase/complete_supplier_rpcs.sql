-- ============================================================================
-- PARTE FINAL: FUNCIONES PARA MÓDULO DE PROVEEDORES Y PERMISOS DE EJECUCIÓN
-- Ejecuta este script en Supabase -> SQL Editor (en una pestaña limpia / "New Query")
-- ============================================================================

-- 1. Guardar o Actualizar Proveedor
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

-- 2. Registrar Compra / Factura de Proveedor (Cuentas por Pagar)
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

-- 3. Registrar Pago a Proveedor (Cancelación de Deuda)
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

-- 4. Permisos de ejecución para usuarios autenticados y clave pública
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
