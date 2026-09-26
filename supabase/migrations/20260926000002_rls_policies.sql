-- ==============================================================================
-- Shelfy: Multi-Tenant Inventory Management System (Supabase + Clerk)
-- Migration 002: Row Level Security (RLS) Policies
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reference_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. Companies Policies
-- Pre-auth: anyone can read active companies for the select dropdown
-- Authenticated: can read their own company
-- ------------------------------------------------------------------------------
CREATE POLICY "public_can_read_active_companies"
ON public.companies
FOR SELECT
USING (is_active = true);

CREATE POLICY "tenant_can_manage_own_company"
ON public.companies
FOR ALL
TO authenticated
USING (id = (auth.jwt() ->> 'org_id') AND (auth.jwt() ->> 'org_role') = 'org:admin')
WITH CHECK (id = (auth.jwt() ->> 'org_id') AND (auth.jwt() ->> 'org_role') = 'org:admin');

-- ------------------------------------------------------------------------------
-- 2. OTP Codes (Security Primitive)
-- Strictly accessible only via service-role key (Server Actions)
-- NO policies for public or authenticated roles = fully blocked by default!
-- ------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------
-- 3. Super Admins
-- Only readable by authenticated users whose Clerk ID matches super_admins
-- ------------------------------------------------------------------------------
CREATE POLICY "super_admins_read_self"
ON public.super_admins
FOR SELECT
TO authenticated
USING (clerk_user_id = auth.jwt() ->> 'sub');

-- ------------------------------------------------------------------------------
-- 4. Warehouses & Locations
-- Scoped to auth.jwt() ->> 'org_id'
-- ------------------------------------------------------------------------------
CREATE POLICY "tenant_isolation_warehouses"
ON public.warehouses
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY "tenant_isolation_locations"
ON public.locations
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

-- ------------------------------------------------------------------------------
-- 5. Categories & Products
-- ------------------------------------------------------------------------------
CREATE POLICY "tenant_isolation_categories"
ON public.categories
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY "tenant_isolation_products"
ON public.products
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

-- ------------------------------------------------------------------------------
-- 6. Reference Counters
-- ------------------------------------------------------------------------------
CREATE POLICY "tenant_isolation_reference_counters"
ON public.reference_counters
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

-- ------------------------------------------------------------------------------
-- 7. Receipts & Receipt Lines
-- ------------------------------------------------------------------------------
CREATE POLICY "tenant_isolation_receipts"
ON public.receipts
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY "tenant_isolation_receipt_lines"
ON public.receipt_lines
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

-- ------------------------------------------------------------------------------
-- 8. Delivery Orders & Delivery Lines
-- ------------------------------------------------------------------------------
CREATE POLICY "tenant_isolation_delivery_orders"
ON public.delivery_orders
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY "tenant_isolation_delivery_lines"
ON public.delivery_lines
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

-- ------------------------------------------------------------------------------
-- 9. Transfers & Transfer Lines
-- ------------------------------------------------------------------------------
CREATE POLICY "tenant_isolation_transfers"
ON public.transfers
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY "tenant_isolation_transfer_lines"
ON public.transfer_lines
FOR ALL
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'))
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

-- ------------------------------------------------------------------------------
-- 10. Immutable Stock Ledger
-- ------------------------------------------------------------------------------
CREATE POLICY "tenant_isolation_stock_ledger_select"
ON public.stock_ledger
FOR SELECT
TO authenticated
USING (company_id = (auth.jwt() ->> 'org_id'));

CREATE POLICY "tenant_isolation_stock_ledger_insert"
ON public.stock_ledger
FOR INSERT
TO authenticated
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

-- ------------------------------------------------------------------------------
-- 11. Audit Logs (Manager / org:admin Only for viewing)
-- ------------------------------------------------------------------------------
CREATE POLICY "manager_only_audit_logs_select"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    company_id = (auth.jwt() ->> 'org_id')
    AND (auth.jwt() ->> 'org_role') = 'org:admin'
);

CREATE POLICY "tenant_audit_logs_insert"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (company_id = (auth.jwt() ->> 'org_id'));

-- ------------------------------------------------------------------------------
-- 12. Helper Functions: Atomic Sequential Document Reference Generator
-- Allocates sequential refs like WH/IN/0001, WH/OUT/0001, WH/INT/0001
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_document_reference(
    p_company_id TEXT,
    p_doc_type TEXT,
    p_warehouse_code TEXT DEFAULT 'WH'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seq INT;
    v_ref TEXT;
BEGIN
    INSERT INTO public.reference_counters (company_id, doc_type, current_val)
    VALUES (p_company_id, p_doc_type, 1)
    ON CONFLICT (company_id, doc_type)
    DO UPDATE SET current_val = public.reference_counters.current_val + 1
    RETURNING current_val INTO v_seq;

    v_ref := p_warehouse_code || '/' || p_doc_type || '/' || LPAD(v_seq::TEXT, 4, '0');
    RETURN v_ref;
END;
$$;
