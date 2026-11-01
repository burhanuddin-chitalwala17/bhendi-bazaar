-- storefront-themes U2: a shop's published look and the one before it (D1, D11; Q4, Q19, Q31). Additive; no backfill.
-- AlterTable
ALTER TABLE "OrgProfile" ADD COLUMN     "lookPublishedAt" TIMESTAMP(3),
ADD COLUMN     "lookPublishedByUserId" TEXT,
ADD COLUMN     "lookVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paletteKey" TEXT,
ADD COLUMN     "previousLookUntil" TIMESTAMP(3),
ADD COLUMN     "previousPaletteKey" TEXT,
ADD COLUMN     "previousThemeKey" TEXT,
ADD COLUMN     "themeKey" TEXT;

-- AddForeignKey
ALTER TABLE "OrgProfile" ADD CONSTRAINT "OrgProfile_lookPublishedByUserId_fkey" FOREIGN KEY ("lookPublishedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "OrgProfile_lookPublishedByUserId_idx" ON "OrgProfile"("lookPublishedByUserId");
