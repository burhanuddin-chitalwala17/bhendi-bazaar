-- Rename Seller to Org.
--
-- Written by hand. Prisma generates a renamed model as DROP TABLE + CREATE TABLE,
-- which would destroy every vendor row along with the products and shipments
-- referencing them. Every statement below is a rename: no data moves.
--
-- Postgres does not rename a table's indexes or constraints when the table is
-- renamed, so each is renamed explicitly to keep the names Prisma expects and
-- leave no drift.

ALTER TABLE "Seller" RENAME TO "Org";

ALTER TABLE "Org" RENAME CONSTRAINT "Seller_pkey" TO "Org_pkey";
ALTER INDEX "Seller_code_key" RENAME TO "Org_code_key";
ALTER INDEX "Seller_email_idx" RENAME TO "Org_email_idx";
ALTER INDEX "Seller_isActive_idx" RENAME TO "Org_isActive_idx";
ALTER INDEX "Seller_code_idx" RENAME TO "Org_code_idx";
ALTER INDEX "Seller_defaultPincode_idx" RENAME TO "Org_defaultPincode_idx";

ALTER TABLE "Product" RENAME COLUMN "sellerId" TO "orgId";
ALTER TABLE "Product" RENAME CONSTRAINT "Product_sellerId_fkey" TO "Product_orgId_fkey";
ALTER INDEX "Product_sellerId_idx" RENAME TO "Product_orgId_idx";

ALTER TABLE "Shipment" RENAME COLUMN "sellerId" TO "orgId";
ALTER TABLE "Shipment" RENAME CONSTRAINT "Shipment_sellerId_fkey" TO "Shipment_orgId_fkey";
ALTER INDEX "Shipment_sellerId_idx" RENAME TO "Shipment_orgId_idx";
