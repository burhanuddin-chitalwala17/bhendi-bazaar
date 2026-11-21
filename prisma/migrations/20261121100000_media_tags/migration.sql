-- ai-images/media-tags D1, D4: a closed set of tags on each library image, and Product on every shop image a product's gallery uses.
-- Additive. Images no product uses, and platform images (orgId null), stay untagged (ai-images Q22).
-- CreateEnum
CREATE TYPE "MediaTag" AS ENUM ('PRODUCT', 'REFERENCE');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "tags" "MediaTag"[] DEFAULT ARRAY[]::"MediaTag"[];

-- CreateIndex
CREATE INDEX "MediaAsset_tags_idx" ON "MediaAsset" USING GIN ("tags");


-- Backfill (D4): Product on every shop image a gallery row links.
UPDATE "MediaAsset" SET "tags" = ARRAY['PRODUCT']::"MediaTag"[]
WHERE "orgId" IS NOT NULL
  AND "id" IN (SELECT DISTINCT "assetId" FROM "ProductMedia" WHERE "assetId" IS NOT NULL AND "kind" = 'IMAGE');
