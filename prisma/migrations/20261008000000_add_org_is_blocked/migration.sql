-- AlterTable
ALTER TABLE "Org" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Org_isBlocked_idx" ON "Org"("isBlocked");
