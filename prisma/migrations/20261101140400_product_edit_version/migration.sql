-- product-form unit 4: a save is a compare-and-set on the product's version (docs/specs/own-store/product-form/trd.md D6, D7).
-- Additive only, no backfill: every existing product starts at version 0 with no editor recorded.

ALTER TABLE "Product" ADD COLUMN "lastEditedAt" TIMESTAMP(3),
ADD COLUMN "lastEditedById" TEXT,
ADD COLUMN "teamEditedAt" TIMESTAMP(3),
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Product" ADD CONSTRAINT "Product_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
