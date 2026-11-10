-- ============================================================================
-- SEED DATA REALISTA: CARNICERÍA EN TUCUMÁN, ARGENTINA
-- Moneda: Pesos Argentinos (ARS) | Cortes y frigoríficos reales de la zona
-- ============================================================================

-- 1. CATEGORÍAS TÍPICAS DE CARNICERÍA
INSERT INTO public.categories (id, name) VALUES
    ('11111111-1111-1111-1111-111111111001', 'Vaca'),
    ('11111111-1111-1111-1111-111111111002', 'Cerdo'),
    ('11111111-1111-1111-1111-111111111003', 'Pollo'),
    ('11111111-1111-1111-1111-111111111004', 'Achuras y Menudencias'),
    ('11111111-1111-1111-1111-111111111005', 'Embutidos y Elaborados')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. CORTES Y PRODUCTOS REALES CON PRECIOS Y COSTOS DE TUCUMÁN
INSERT INTO public.products (id, name, category_id, price, cost, stock, unit, is_active) VALUES
    -- Vaca (Cortes tradicionales para asado y milanesas tucumanas)
    ('22222222-2222-2222-2222-222222222001', 'Costilla de Novillo', '11111111-1111-1111-1111-111111111001', 8900.00, 6800.00, 45.500, 'kg', true),
    ('22222222-2222-2222-2222-222222222002', 'Vacío Especial', '11111111-1111-1111-1111-111111111001', 9400.00, 7200.00, 28.200, 'kg', true),
    ('22222222-2222-2222-2222-222222222003', 'Matambre de Vaca', '11111111-1111-1111-1111-111111111001', 9200.00, 7000.00, 15.000, 'kg', true),
    ('22222222-2222-2222-2222-222222222004', 'Bola de Lomo (Milanesa)', '11111111-1111-1111-1111-111111111001', 8500.00, 6500.00, 32.000, 'kg', true),
    ('22222222-2222-2222-2222-222222222005', 'Carne Molida Especial', '11111111-1111-1111-1111-111111111001', 5800.00, 4200.00, 18.500, 'kg', true),
    ('22222222-2222-2222-2222-222222222006', 'Sobaco / Aguja (Guiso/Empanada)', '11111111-1111-1111-1111-111111111001', 6100.00, 4600.00, 22.000, 'kg', true),
    -- Cerdo
    ('22222222-2222-2222-2222-222222222007', 'Pechito de Cerdo', '11111111-1111-1111-1111-111111111002', 6400.00, 4800.00, 30.000, 'kg', true),
    ('22222222-2222-2222-2222-222222222008', 'Bondiola de Cerdo', '11111111-1111-1111-1111-111111111002', 7800.00, 5900.00, 12.300, 'kg', true),
    -- Pollo
    ('22222222-2222-2222-2222-222222222009', 'Pollo Entero Fresco', '11111111-1111-1111-1111-111111111003', 2900.00, 2150.00, 50.000, 'kg', true),
    ('22222222-2222-2222-2222-222222222010', 'Pechuga / Suprema de Pollo', '11111111-1111-1111-1111-111111111003', 6200.00, 4600.00, 25.000, 'kg', true),
    -- Achuras y Embutidos
    ('22222222-2222-2222-2222-222222222011', 'Chinchulines Seleccionados', '11111111-1111-1111-1111-111111111004', 3800.00, 2600.00, 14.000, 'kg', true),
    ('22222222-2222-2222-2222-222222222012', 'Chorizo Criollo Casero', '11111111-1111-1111-1111-111111111005', 5200.00, 3500.00, 35.000, 'kg', true),
    ('22222222-2222-2222-2222-222222222013', 'Morcilla Bombón', '11111111-1111-1111-1111-111111111005', 4200.00, 2800.00, 16.000, 'kg', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    cost = EXCLUDED.cost,
    stock = EXCLUDED.stock;

-- 3. CLIENTES HABITUALES (Comercios gastronómicos y vecinos de Tucumán con fiado)
INSERT INTO public.customers (id, name, phone, address, credit_limit, balance, allow_credit, is_active) VALUES
    ('33333333-3333-3333-3333-333333333001', 'Sanguchería El 10 (Yerba Buena)', '381-4251122', 'Av. Aconquija 1820, Yerba Buena', 250000.00, 85000.00, true, true),
    ('33333333-3333-3333-3333-333333333002', 'Parrilla La Querencia (San Miguel)', '381-4309988', 'Av. Mate de Luna 2840, SMT', 400000.00, 142000.00, true, true),
    ('33333333-3333-3333-3333-333333333003', 'Rotisería San Cayetano', '381-4552233', 'San Martín 650, Banda del Río Salí', 150000.00, 34000.00, true, true),
    ('33333333-3333-3333-3333-333333333004', 'Doña Carmen Jaldo (Vecina Barrio Sur)', '381-5123456', 'General Paz 420, SMT', 60000.00, 0.00, true, true),
    ('33333333-3333-3333-3333-333333333005', 'Restaurante El Portal de Tucumán', '381-4887711', '24 de Septiembre 550, SMT', 500000.00, 0.00, true, true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    credit_limit = EXCLUDED.credit_limit,
    balance = EXCLUDED.balance,
    allow_credit = EXCLUDED.allow_credit;

-- 4. PROVEEDORES / FRIGORÍFICOS DE LA REGIÓN
INSERT INTO public.suppliers (id, name, cuit_dni, phone, category, balance, notes, is_active) VALUES
    ('44444444-4444-4444-4444-444444444001', 'Frigorífico San Javier S.A.', '30-68945231-8', '381-4771100', 'Frigorífico', 450000.00, 'Entrega medias reses los martes y jueves por la mañana.', true),
    ('44444444-4444-4444-4444-444444444002', 'Avícola Santa Ana (Tucumán)', '30-71029384-5', '381-4923344', 'Pollería Mayorista', 120000.00, 'Reparto de cajones de pollo lunes y viernes.', true),
    ('44444444-4444-4444-4444-444444444003', 'Chacinados del Norte (Famaillá)', '30-65481239-2', '3863-412200', 'Chacinados', 0.00, 'Chorizos secos, salamines y morcillas artesanales.', true),
    ('44444444-4444-4444-4444-444444444004', 'Distribuidora Papelera & Envoltorios Norte', '20-24158963-3', '381-4360099', 'Insumos / Envases', 0.00, 'Bolsas camiseta, bandejas de polifán y film para empaque.', true)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    balance = EXCLUDED.balance,
    category = EXCLUDED.category;
