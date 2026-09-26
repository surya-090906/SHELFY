-- AlterTable
ALTER TABLE "delivery_orders" ADD COLUMN     "contact" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "delivery_address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "operation_type" TEXT NOT NULL DEFAULT 'Delivery',
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "responsible" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "schedule_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "warehouse_id" INTEGER;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "short_code" TEXT NOT NULL DEFAULT 'Stock';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "per_unit_cost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "receipts" ADD COLUMN     "contact" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "responsible" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "schedule_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "warehouse_id" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "login_id" TEXT;

-- AlterTable
ALTER TABLE "warehouses" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "short_code" TEXT;

-- CreateTable
CREATE TABLE "reference_counters" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reference_counters_pkey" PRIMARY KEY ("key")
);

-- Preserve the original installation and backfill new identities.
UPDATE "users" SET "login_id" = CASE WHEN email = 'manager@stocksense.com' THEN 'manager' WHEN email = 'staff@stocksense.com' THEN 'staff01' ELSE 'user' || lpad(id::text, 6, '0') END;
UPDATE "warehouses" SET "short_code" = CASE WHEN id = (SELECT min(id) FROM warehouses) THEN 'WH' ELSE 'WH' || id END;
UPDATE "locations" SET "short_code" = 'Stock' || id;
UPDATE "receipts" r SET warehouse_id = COALESCE((SELECT l.warehouse_id FROM receipt_items i JOIN locations l ON l.id = i.location_id WHERE i.receipt_id = r.id ORDER BY i.id LIMIT 1), (SELECT min(id) FROM warehouses)), contact = supplier_name, responsible = COALESCE((SELECT name FROM users WHERE id = r.created_by), ''), schedule_date = created_at;
UPDATE "delivery_orders" d SET warehouse_id = COALESCE((SELECT l.warehouse_id FROM delivery_items i JOIN locations l ON l.id = i.location_id WHERE i.delivery_order_id = d.id ORDER BY i.id LIMIT 1), (SELECT min(id) FROM warehouses)), contact = customer_ref, responsible = COALESCE((SELECT name FROM users WHERE id = d.created_by), ''), schedule_date = created_at;
UPDATE "receipts" r SET reference = w.short_code || '/IN/' || lpad(r.id::text, greatest(4, length(r.id::text)), '0') FROM warehouses w WHERE w.id = r.warehouse_id;
UPDATE "delivery_orders" d SET reference = w.short_code || '/OUT/' || lpad(d.id::text, greatest(4, length(d.id::text)), '0') FROM warehouses w WHERE w.id = d.warehouse_id;
UPDATE "receipts" SET status = 'ready' WHERE status = 'waiting';
INSERT INTO reference_counters (key, value) SELECT warehouse_id || '/IN', max(id) FROM receipts GROUP BY warehouse_id;
INSERT INTO reference_counters (key, value) SELECT warehouse_id || '/OUT', max(id) FROM delivery_orders GROUP BY warehouse_id;
ALTER TABLE users ALTER COLUMN login_id SET NOT NULL;
ALTER TABLE warehouses ALTER COLUMN short_code SET NOT NULL;
ALTER TABLE receipts ALTER COLUMN reference SET NOT NULL, ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE delivery_orders ALTER COLUMN reference SET NOT NULL, ALTER COLUMN warehouse_id SET NOT NULL;

-- Enforce append-only history even if a future code path attempts an update/delete.
CREATE FUNCTION reject_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'stock_ledger is immutable; record a compensating adjustment'; END;
$$;
CREATE TRIGGER stock_ledger_immutable BEFORE UPDATE OR DELETE ON stock_ledger FOR EACH ROW EXECUTE FUNCTION reject_ledger_mutation();
ALTER TABLE stock_ledger ADD CONSTRAINT ledger_finite CHECK (quantity_delta NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8));
ALTER TABLE receipts ADD CONSTRAINT receipt_status CHECK (status <> 'waiting');
ALTER TABLE receipt_items ADD CONSTRAINT receipt_positive CHECK (quantity_expected > 0 AND quantity_expected < 'Infinity'::float8);
ALTER TABLE delivery_items ADD CONSTRAINT delivery_positive CHECK (quantity > 0 AND quantity < 'Infinity'::float8);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_orders_reference_key" ON "delivery_orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_reference_key" ON "receipts"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "users_login_id_key" ON "users"("login_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_short_code_key" ON "warehouses"("short_code");
