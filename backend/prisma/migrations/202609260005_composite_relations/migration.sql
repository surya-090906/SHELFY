-- Composite tenant foreign keys are now described in Prisma itself.
-- Remove the redundant original single-column foreign keys. Company foreign
-- keys and the tenant-aware constraints from migration 004 remain intact.
DO $$ DECLARE c RECORD; BEGIN
 FOR c IN SELECT con.conname,src.relname FROM pg_constraint con
 JOIN pg_class src ON src.oid=con.conrelid JOIN pg_class dest ON dest.oid=con.confrelid
 JOIN pg_namespace ns ON ns.oid=src.relnamespace
 WHERE con.contype='f' AND array_length(con.conkey,1)=1
 AND ns.nspname=current_schema() AND dest.relname IN ('users','categories','products','warehouses','locations','receipts','delivery_orders','transfers')
 LOOP EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',c.relname,c.conname); END LOOP;
END $$;
