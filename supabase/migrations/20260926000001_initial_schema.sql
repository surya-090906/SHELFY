-- ==============================================================================
-- Shelfy: Multi-Tenant Inventory Management System (Supabase + Clerk)
-- Migration 001: Core Tables, Indexes & Extensions
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Companies (mirrors Clerk Organization: id = Clerk org_id)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY, -- Clerk Organization ID (e.g. org_2aB...)
    name TEXT NOT NULL,
    short_code TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public index for company select type-ahead
CREATE INDEX IF NOT EXISTS idx_companies_short_code ON public.companies(short_code);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON public.companies(is_active);

-- ------------------------------------------------------------------------------
-- 2. Super Admins (Platform Super Administrators)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. Custom OTP Codes (SERVICE-ROLE ONLY - NO PUBLIC/AUTHENTICATED ACCESS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('password_reset', 'signup_verification')),
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    used BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_codes_lookup 
    ON public.otp_codes(email, purpose, used, expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_codes_rate_limit 
    ON public.otp_codes(email, created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. Warehouses & Locations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warehouses_company_code UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_locations_warehouse_code UNIQUE (warehouse_id, code)
);

-- ------------------------------------------------------------------------------
-- 5. Categories & Products
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_categories_company_name UNIQUE (company_id, name)
);

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    barcode TEXT,
    description TEXT,
    uom TEXT NOT NULL DEFAULT 'Units',
    per_unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reorder_threshold INT NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_products_company_sku UNIQUE (company_id, sku)
);

-- ------------------------------------------------------------------------------
-- 6. Reference Counters (for Sequential Human-Readable Document References)
-- e.g. WH/IN/0001, WH/OUT/0001, WH/INT/0001
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reference_counters (
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL, -- 'IN', 'OUT', 'INT'
    current_val INT NOT NULL DEFAULT 0,
    PRIMARY KEY (company_id, doc_type)
);

-- ------------------------------------------------------------------------------
-- 7. Receipts (Inbound Operations: WH/IN/####)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    supplier_name TEXT,
    destination_location_id UUID NOT NULL REFERENCES public.locations(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'done', 'canceled')),
    notes TEXT,
    created_by TEXT NOT NULL, -- Clerk User ID
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_receipts_company_reference UNIQUE (company_id, reference)
);

CREATE TABLE IF NOT EXISTS public.receipt_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity_expected NUMERIC(12, 2) NOT NULL CHECK (quantity_expected > 0),
    quantity_received NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 8. Delivery Orders (Outbound Operations: WH/OUT/####)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    customer_name TEXT,
    source_location_id UUID NOT NULL REFERENCES public.locations(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'waiting', 'ready', 'done', 'canceled')),
    notes TEXT,
    created_by TEXT NOT NULL, -- Clerk User ID
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_delivery_orders_company_reference UNIQUE (company_id, reference)
);

CREATE TABLE IF NOT EXISTS public.delivery_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity_ordered NUMERIC(12, 2) NOT NULL CHECK (quantity_ordered > 0),
    quantity_delivered NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (quantity_delivered >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. Internal Transfers (WH/INT/####)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    source_location_id UUID NOT NULL REFERENCES public.locations(id),
    destination_location_id UUID NOT NULL REFERENCES public.locations(id),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'done', 'canceled')),
    notes TEXT,
    created_by TEXT NOT NULL, -- Clerk User ID
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_transfers_company_reference UNIQUE (company_id, reference)
);

CREATE TABLE IF NOT EXISTS public.transfer_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.transfers(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    quantity NUMERIC(12, 2) NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. Immutable Stock Ledger (Audit & Movements Record)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    location_id UUID NOT NULL REFERENCES public.locations(id),
    quantity_change NUMERIC(12, 2) NOT NULL, -- Positive for IN, Negative for OUT
    movement_type TEXT NOT NULL CHECK (movement_type IN ('receipt', 'delivery', 'transfer_out', 'transfer_in', 'adjustment')),
    reference TEXT NOT NULL,
    created_by TEXT, -- Clerk User ID
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_ledger_balance 
    ON public.stock_ledger(company_id, product_id, location_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_reference 
    ON public.stock_ledger(company_id, reference);

-- ------------------------------------------------------------------------------
-- 11. Audit Logs (Tenant-scoped & Super Admin Logs)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    clerk_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before JSONB,
    after JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_user ON public.admin_audit_logs(clerk_user_id, created_at DESC);
