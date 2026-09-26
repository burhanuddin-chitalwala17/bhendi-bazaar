
-- CreateEnum
CREATE TYPE "MediaAssetKind" AS ENUM ('IMAGE', 'VIDEO_EMBED');

-- CreateEnum
CREATE TYPE "MediaAssetSource" AS ENUM ('UPLOAD', 'DERIVED', 'EMBED');

-- CreateEnum
CREATE TYPE "MediaAssetState" AS ENUM ('PENDING', 'READY', 'RETIRED');

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "heroAssetId" TEXT;

-- AlterTable
ALTER TABLE "ProductMedia" ADD COLUMN     "assetId" TEXT;

-- AlterTable
ALTER TABLE "OrgProfile" ADD COLUMN     "heroAssetId" TEXT,
ADD COLUMN     "logoAssetId" TEXT;

-- AlterTable
ALTER TABLE "OrgBanner" ADD COLUMN     "imageAssetId" TEXT;

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "imageAssetId" TEXT;

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "ref" TEXT NOT NULL,
    "objectKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "mimeType" TEXT,
    "orgId" TEXT,
    "uploaderId" TEXT,
    "source" "MediaAssetSource" NOT NULL,
    "derivedFromId" TEXT,
    "transform" JSONB,
    "state" "MediaAssetState" NOT NULL DEFAULT 'PENDING',
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_objectKey_key" ON "MediaAsset"("objectKey");

-- CreateIndex
CREATE INDEX "MediaAsset_orgId_state_idx" ON "MediaAsset"("orgId", "state");

-- CreateIndex
CREATE INDEX "MediaAsset_ref_idx" ON "MediaAsset"("ref");

-- CreateIndex
CREATE INDEX "MediaAsset_derivedFromId_idx" ON "MediaAsset"("derivedFromId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_derivedFromId_fkey" FOREIGN KEY ("derivedFromId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_heroAssetId_fkey" FOREIGN KEY ("heroAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgProfile" ADD CONSTRAINT "OrgProfile_logoAssetId_fkey" FOREIGN KEY ("logoAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgProfile" ADD CONSTRAINT "OrgProfile_heroAssetId_fkey" FOREIGN KEY ("heroAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgBanner" ADD CONSTRAINT "OrgBanner_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

