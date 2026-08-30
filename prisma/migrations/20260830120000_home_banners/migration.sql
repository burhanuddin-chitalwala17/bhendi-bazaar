-- CreateEnum
CREATE TYPE "BannerActionVariant" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateTable
CREATE TABLE "Banner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "eyebrow" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BannerAction" (
    "id" TEXT NOT NULL,
    "bannerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "variant" "BannerActionVariant" NOT NULL DEFAULT 'PRIMARY',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BannerAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Banner_isActive_order_idx" ON "Banner"("isActive", "order");

-- CreateIndex
CREATE INDEX "BannerAction_bannerId_order_idx" ON "BannerAction"("bannerId", "order");

-- AddForeignKey
-- Cascade: an action carries no money and no attribution, and has no meaning apart
-- from its banner (ADR-0020 draws the line here, not at every foreign key).
ALTER TABLE "BannerAction" ADD CONSTRAINT "BannerAction_bannerId_fkey" FOREIGN KEY ("bannerId") REFERENCES "Banner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
