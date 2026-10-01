-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "familyId" TEXT;

-- CreateTable
CREATE TABLE "ProductFamily" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productType" TEXT,
    "facts" JSONB,
    "measurements" JSONB,
    "variantAxis" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductFamily_orgId_idx" ON "ProductFamily"("orgId");

-- CreateIndex
CREATE INDEX "ProductFamily_orgId_retiredAt_idx" ON "ProductFamily"("orgId", "retiredAt");

-- CreateIndex
CREATE INDEX "Product_familyId_idx" ON "Product"("familyId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductFamily" ADD CONSTRAINT "ProductFamily_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
