-- AlterEnum
ALTER TYPE "MediaAssetKind" ADD VALUE 'VIDEO';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "MediaAssetState" ADD VALUE 'PROCESSING' AFTER 'PENDING';
ALTER TYPE "MediaAssetState" ADD VALUE 'FAILED' AFTER 'READY';

-- AlterEnum
ALTER TYPE "MediaKind" ADD VALUE 'VIDEO';

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "failureReason" TEXT;
