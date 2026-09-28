-- AlterTable
ALTER TABLE "OrgProfile" ADD COLUMN     "hiddenSections" JSONB,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "ownerPhotoAssetId" TEXT,
ADD COLUMN     "ownerPhotoUrl" TEXT,
ADD COLUMN     "ownerQuote" TEXT,
ADD COLUMN     "ownerRole" TEXT,
ADD COLUMN     "pillars" JSONB;

-- AddForeignKey
ALTER TABLE "OrgProfile" ADD CONSTRAINT "OrgProfile_ownerPhotoAssetId_fkey" FOREIGN KEY ("ownerPhotoAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
