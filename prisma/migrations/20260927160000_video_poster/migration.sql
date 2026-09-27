-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "posterAssetId" TEXT;

-- CreateIndex
CREATE INDEX "MediaAsset_posterAssetId_idx" ON "MediaAsset"("posterAssetId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_posterAssetId_fkey" FOREIGN KEY ("posterAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
