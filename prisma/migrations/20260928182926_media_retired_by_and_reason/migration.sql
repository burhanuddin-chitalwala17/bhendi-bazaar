-- CreateEnum
CREATE TYPE "MediaRetiredBy" AS ENUM ('ORG', 'PLATFORM');

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "retiredBy" "MediaRetiredBy",
ADD COLUMN     "retiredReason" TEXT;
