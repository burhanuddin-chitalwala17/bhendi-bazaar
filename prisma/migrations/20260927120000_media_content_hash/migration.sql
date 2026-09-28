-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN "contentHash" TEXT;

-- CreateIndex
CREATE INDEX "MediaAsset_orgId_contentHash_idx" ON "MediaAsset"("orgId", "contentHash");
