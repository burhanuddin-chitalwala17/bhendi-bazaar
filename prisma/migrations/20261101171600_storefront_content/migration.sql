-- storefront-themes U6 (D13): the themed page's editor content, and the slots a photo's use is read from (ADR-0058). Additive only.
-- CreateEnum
CREATE TYPE "StorefrontSlotKind" AS ENUM ('HERO', 'COLLECTION');

-- AlterTable
ALTER TABLE "OrgProfile" ADD COLUMN     "claims" JSONB,
ADD COLUMN     "contentEditedByUserId" TEXT,
ADD COLUMN     "heroLine" TEXT,
ADD COLUMN     "openingHours" JSONB,
ADD COLUMN     "storefrontHiddenSections" JSONB;

-- CreateTable
CREATE TABLE "OrgStorefrontSlot" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "StorefrontSlotKind" NOT NULL,
    "position" INTEGER NOT NULL,
    "categoryId" TEXT,
    "assetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgStorefrontSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgStorefrontSlot_categoryId_idx" ON "OrgStorefrontSlot"("categoryId");

-- CreateIndex
CREATE INDEX "OrgStorefrontSlot_assetId_idx" ON "OrgStorefrontSlot"("assetId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgStorefrontSlot_orgId_kind_position_key" ON "OrgStorefrontSlot"("orgId", "kind", "position");

-- CreateIndex
CREATE INDEX "OrgProfile_contentEditedByUserId_idx" ON "OrgProfile"("contentEditedByUserId");

-- AddForeignKey
ALTER TABLE "OrgProfile" ADD CONSTRAINT "OrgProfile_contentEditedByUserId_fkey" FOREIGN KEY ("contentEditedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgStorefrontSlot" ADD CONSTRAINT "OrgStorefrontSlot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgStorefrontSlot" ADD CONSTRAINT "OrgStorefrontSlot_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgStorefrontSlot" ADD CONSTRAINT "OrgStorefrontSlot_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

