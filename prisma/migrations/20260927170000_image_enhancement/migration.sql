-- CreateEnum
CREATE TYPE "EnhancementTool" AS ENUM ('CUTOUT', 'WHITE', 'STUDIO', 'SCENE', 'LIGHT', 'ENLARGE');

-- CreateEnum
CREATE TYPE "EnhancementState" AS ENUM ('REQUESTED', 'RUNNING', 'PROPOSED', 'ACCEPTED', 'DISCARDED', 'FAILED');

-- CreateTable
CREATE TABLE "Enhancement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requesterId" TEXT,
    "sourceAssetId" TEXT NOT NULL,
    "tool" "EnhancementTool" NOT NULL,
    "preset" TEXT,
    "provider" TEXT NOT NULL,
    "state" "EnhancementState" NOT NULL DEFAULT 'REQUESTED',
    "slot" TEXT,
    "proposalKey" TEXT,
    "resultAssetId" TEXT,
    "costPaise" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "proposedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "Enhancement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgEnhancementPolicy" (
    "orgId" TEXT NOT NULL,
    "monthlyAllowance" INTEGER NOT NULL,
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgEnhancementPolicy_pkey" PRIMARY KEY ("orgId")
);

-- CreateIndex
CREATE INDEX "Enhancement_orgId_createdAt_idx" ON "Enhancement"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Enhancement_orgId_state_idx" ON "Enhancement"("orgId", "state");

-- CreateIndex
CREATE INDEX "Enhancement_sourceAssetId_idx" ON "Enhancement"("sourceAssetId");

-- AddForeignKey
ALTER TABLE "Enhancement" ADD CONSTRAINT "Enhancement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enhancement" ADD CONSTRAINT "Enhancement_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enhancement" ADD CONSTRAINT "Enhancement_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "MediaAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enhancement" ADD CONSTRAINT "Enhancement_resultAssetId_fkey" FOREIGN KEY ("resultAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgEnhancementPolicy" ADD CONSTRAINT "OrgEnhancementPolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

