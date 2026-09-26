ALTER TABLE "users" ADD COLUMN "clerk_user_id" TEXT;
CREATE UNIQUE INDEX "users_tenant_id_clerk_user_id_key" ON "users"("tenant_id", "clerk_user_id");
