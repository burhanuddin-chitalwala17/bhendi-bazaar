-- image-slots (trd D2, D8): a phone version beside each banner and storefront photo, and how each
-- picture is framed. Additive only: three nullable columns per table, foreign keys, one backfill.

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "imageFraming" JSONB,
ADD COLUMN     "phoneImageAssetId" TEXT,
ADD COLUMN     "phoneImageUrl" TEXT;

-- AlterTable
ALTER TABLE "OrgBanner" ADD COLUMN     "imageFraming" JSONB,
ADD COLUMN     "phoneImageAssetId" TEXT,
ADD COLUMN     "phoneImageUrl" TEXT;

-- AlterTable
ALTER TABLE "OrgStorefrontSlot" ADD COLUMN     "imageFraming" JSONB,
ADD COLUMN     "phoneAssetId" TEXT;

-- CreateIndex
CREATE INDEX "OrgStorefrontSlot_phoneAssetId_idx" ON "OrgStorefrontSlot"("phoneAssetId");

-- AddForeignKey
ALTER TABLE "OrgStorefrontSlot" ADD CONSTRAINT "OrgStorefrontSlot_phoneAssetId_fkey" FOREIGN KEY ("phoneAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgBanner" ADD CONSTRAINT "OrgBanner_phoneImageAssetId_fkey" FOREIGN KEY ("phoneImageAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_phoneImageAssetId_fkey" FOREIGN KEY ("phoneImageAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill (D8): every picture saved before this framed as it always rendered — cover, centred, with
-- phones shown the same picture around its centre. `tests/unit/image-framing.test.ts` parses this
-- literal with the stored schema, so the two cannot drift.
UPDATE "Banner" SET "imageFraming" = '{"desktop":{"fit":"crop","crop":null,"sourceWidth":null,"sourceHeight":null,"fill":null,"position":{"x":0.5,"y":0.5}},"phone":null,"phoneFocus":{"x":0.5,"y":0.5}}'::jsonb
WHERE "imageUrl" IS NOT NULL AND "imageFraming" IS NULL;

UPDATE "OrgBanner" SET "imageFraming" = '{"desktop":{"fit":"crop","crop":null,"sourceWidth":null,"sourceHeight":null,"fill":null,"position":{"x":0.5,"y":0.5}},"phone":null,"phoneFocus":{"x":0.5,"y":0.5}}'::jsonb
WHERE "imageUrl" IS NOT NULL AND "imageFraming" IS NULL;

UPDATE "OrgStorefrontSlot" SET "imageFraming" = '{"desktop":{"fit":"crop","crop":null,"sourceWidth":null,"sourceHeight":null,"fill":null,"position":{"x":0.5,"y":0.5}},"phone":null,"phoneFocus":{"x":0.5,"y":0.5}}'::jsonb
WHERE "assetId" IS NOT NULL AND "imageFraming" IS NULL;
