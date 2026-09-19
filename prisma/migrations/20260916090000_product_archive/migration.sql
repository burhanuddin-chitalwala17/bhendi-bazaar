-- A product leaves sale by archiving, never by deletion (ADR-0026).
--
-- Nullable with no default, so every existing row is on sale and no backfill is
-- needed: absence of a timestamp is the on-sale state.
ALTER TABLE "Product" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- The org portal's default list is "this org, not archived".
CREATE INDEX "Product_orgId_archivedAt_idx" ON "Product"("orgId", "archivedAt");
