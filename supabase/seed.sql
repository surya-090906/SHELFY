-- ==============================================================================
-- Shelfy: Multi-Tenant Inventory Management System (Supabase + Clerk)
-- Seed Data: Demo Companies, Warehouses, Locations & Products
-- ==============================================================================

-- 1. Demo Companies (mirrored from Clerk Organizations)
INSERT INTO public.companies (id, name, short_code, is_active)
VALUES 
    ('org_apex_global', 'Apex Global Logistics', 'APEX', true),
    ('org_omni_retail', 'Omni Retail Warehousing', 'OMNI', true)
ON CONFLICT (id) DO UPDATE 
SET name = EXCLUDED.name, short_code = EXCLUDED.short_code;

-- 2. Warehouses
INSERT INTO public.warehouses (id, company_id, name, code, address, is_active)
VALUES
    ('c1111111-1111-1111-1111-111111111111', 'org_apex_global', 'Apex Central Hub', 'WH', '100 Logistics Blvd, Chicago, IL', true),
    ('c2222222-2222-2222-2222-222222222222', 'org_omni_retail', 'Omni Distribution Depot', 'WH', '500 Commerce Way, Dallas, TX', true)
ON CONFLICT (company_id, code) DO NOTHING;

-- 3. Stock Locations
INSERT INTO public.locations (id, company_id, warehouse_id, name, code, is_default)
VALUES
    ('d1111111-1111-1111-1111-111111111111', 'org_apex_global', 'c1111111-1111-1111-1111-111111111111', 'Primary Stock Bay', 'STOCK', true),
    ('d2222222-2222-2222-2222-222222222222', 'org_omni_retail', 'c2222222-2222-2222-2222-222222222222', 'Omni Main Racks', 'STOCK', true)
ON CONFLICT (warehouse_id, code) DO NOTHING;

-- 4. Product Categories
INSERT INTO public.categories (id, company_id, name, description)
VALUES
    ('e1111111-1111-1111-1111-111111111111', 'org_apex_global', 'Warehouse Equipment', 'Heavy storage and transport equipment'),
    ('e2222222-2222-2222-2222-222222222222', 'org_apex_global', 'Industrial Valves', 'High pressure liquid and gas valves'),
    ('e3333333-3333-3333-3333-333333333333', 'org_omni_retail', 'Packaging & Shipping', 'Boxes, strapping and packing supplies')
ON CONFLICT (company_id, name) DO NOTHING;

-- 5. Products
INSERT INTO public.products (id, company_id, category_id, name, sku, barcode, description, uom, per_unit_cost, reorder_threshold)
VALUES
    ('f1111111-1111-1111-1111-111111111111', 'org_apex_global', 'e1111111-1111-1111-1111-111111111111', 'Heavy Duty Steel Pallet', 'PALLET-HD-01', '890123456789', 'Industrial heavy load steel pallet', 'Units', 145.00, 15),
    ('f2222222-2222-2222-2222-222222222222', 'org_apex_global', 'e2222222-2222-2222-2222-222222222222', 'Pneumatic Control Valve 2"', 'VALVE-PN-02', '890987654321', 'High pressure pneumatic regulator valve', 'Units', 320.50, 10),
    ('f3333333-3333-3333-3333-333333333333', 'org_apex_global', 'e1111111-1111-1111-1111-111111111111', 'Nylon Conveyor Belt Roll 50m', 'BELT-NY-50', '890554433221', 'Reinforced rubber-nylon conveyor belt', 'Rolls', 890.00, 5),
    ('f4444444-4444-4444-4444-444444444444', 'org_omni_retail', 'e3333333-3333-3333-3333-333333333333', 'Double-Walled Shipping Box XL', 'BOX-DW-XL', '890667788990', 'Corrugated heavy duty shipping cartons', 'Boxes', 4.50, 100)
ON CONFLICT (company_id, sku) DO NOTHING;

-- 6. Initial Stock Movements in Ledger
INSERT INTO public.stock_ledger (company_id, product_id, location_id, quantity_change, movement_type, reference, created_by)
VALUES
    ('org_apex_global', 'f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 42, 'adjustment', 'INIT-STOCK', 'system'),
    ('org_apex_global', 'f2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 4, 'adjustment', 'INIT-STOCK', 'system'),
    ('org_omni_retail', 'f4444444-4444-4444-4444-444444444444', 'd2222222-2222-2222-2222-222222222222', 250, 'adjustment', 'INIT-STOCK', 'system');
