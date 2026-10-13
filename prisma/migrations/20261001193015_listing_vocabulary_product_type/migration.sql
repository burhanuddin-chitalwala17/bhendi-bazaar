-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "productType" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "facts" JSONB,
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "measurements" JSONB,
ADD COLUMN     "productType" TEXT;

-- CreateTable
CREATE TABLE "ListingValue" (
    "id" TEXT NOT NULL,
    "list" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "productTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "orgId" TEXT,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingValue_list_idx" ON "ListingValue"("list");

-- CreateIndex
CREATE INDEX "ListingValue_orgId_idx" ON "ListingValue"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingValue_list_key_orgId_key" ON "ListingValue"("list", "key", "orgId");

-- CreateIndex
CREATE INDEX "Product_productType_idx" ON "Product"("productType");

-- AddForeignKey
ALTER TABLE "ListingValue" ADD CONSTRAINT "ListingValue_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A unique index does not constrain rows whose column is NULL, so the index above lets two
-- platform-provided answers (orgId IS NULL) share a list and key. Postgres expresses the rule
-- this project actually wants as a partial index, which Prisma's schema language cannot declare —
-- so it lives here, and `tests/unit/listing-value-uniqueness.test.ts` is what keeps it honest.
CREATE UNIQUE INDEX "ListingValue_list_key_platform_key"
  ON "ListingValue" ("list", "key")
  WHERE "orgId" IS NULL;
