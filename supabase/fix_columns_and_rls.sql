-- ============================================================================
-- SCRIPT DE AJUSTE FINAL: COLUMNAS FALTANTES, POLÍTICAS RLS Y LIMPIEZA
-- Ejecuta este script en Supabase -> SQL Editor (New query)
-- ============================================================================

-- 1. Asegurar columnas necesarias en compras y pagos de proveedores
DO $$
BEGIN
    -- Columnas en supplier_purchases
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS invoice_number TEXT DEFAULT '';
    ALTER TABLE IF EXISTS public.supplier_purchases ADD COLUMN IF NOT EXISTS client_mutation_id UUID UNIQUE;

    -- Columnas en supplier_payments
    ALTER TABLE IF EXISTS public.supplier_payments ADD COLUMN IF NOT EXISTS purchase_id UUID;
    ALTER TABLE IF EXISTS public.supplier_payments ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW());
    ALTER TABLE IF EXISTS public.supplier_payments ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
    ALTER TABLE IF EXISTS public.supplier_payments ADD COLUMN IF NOT EXISTS method TEXT DEFAULT 'Efectivo';
    ALTER TABLE IF EXISTS public.supplier_payments ADD COLUMN IF NOT EXISTS client_mutation_id UUID UNIQUE;

    -- Columnas en customers
    ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC DEFAULT 0;
    ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0;
    ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS allow_credit BOOLEAN DEFAULT true;
    ALTER TABLE IF EXISTS public.customers ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
END $$;

-- 2. Habilitar políticas RLS abiertas para la terminal de mostrador (anon y authenticated)
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

-- 3. Eliminar cualquier firma obsoleta de rpc_add_supplier_payment para evitar conflicto PostgREST PGRST203
DROP FUNCTION IF EXISTS public.rpc_add_supplier_payment(UUID, NUMERIC, TEXT, TEXT, BOOLEAN);

-- 4. Notificar a PostgREST para recargar el esquema de columnas de inmediato
NOTIFY pgrst, 'reload schema';
