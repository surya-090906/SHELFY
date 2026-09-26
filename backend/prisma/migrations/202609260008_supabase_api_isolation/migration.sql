-- Shelfy uses its tenant-scoped backend, never Supabase's browser Data API.
-- Supabase's built-in API roles must not bypass that backend's access checks.
DO $$
DECLARE target_table RECORD; api_role TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    FOR target_table IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema()
      AND tablename IN ('companies','users','categories','warehouses','locations','products','receipts','receipt_items','delivery_orders','delivery_items','transfers','transfer_items','adjustments','stock_ledger','audit_logs','invites','otp_codes','refresh_sessions','reference_counters')
    LOOP
      EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', current_schema(), target_table.tablename);
      FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
          EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I', current_schema(), target_table.tablename, api_role);
        END IF;
      END LOOP;
    END LOOP;
  END IF;
END $$;
