-- seller-profile PR 1 (spec R1/R2, trd D1/D4): the public face of an organisation moves off `Org`
-- onto `OrgProfile`, the private listing context gets `OrgListingDefaults`, and brands become a table.
-- Order matters and is the reason this file is hand-arranged rather than generated: create the new
-- tables, copy every org's values across, then drop the old columns. Prisma's generated script drops
-- first, which would have thrown away every storefront's copy.

-- CreateTable
CREATE TABLE "OrgProfile" (
    "orgId" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "heroUrl" TEXT,
    "accent" TEXT,
    "deliveryPolicy" TEXT,
    "returnsPolicy" TEXT,
    "story" TEXT,
    "location" TEXT,
    "social" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgProfile_pkey" PRIMARY KEY ("orgId")
);

-- CreateTable
CREATE TABLE "OrgListingDefaults" (
    "orgId" TEXT NOT NULL,
    "countryOfOrigin" TEXT,
    "taxRateBps" INTEGER,
    "taxCodeByCategory" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgListingDefaults_pkey" PRIMARY KEY ("orgId")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "packerOrImporter" TEXT,
    "countryOfOrigin" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Brand_orgId_idx" ON "Brand"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_orgId_name_key" ON "Brand"("orgId", "name");

-- AddForeignKey
ALTER TABLE "OrgProfile" ADD CONSTRAINT "OrgProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgListingDefaults" ADD CONSTRAINT "OrgListingDefaults_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One row per existing org on each one-to-one table, so no read path has to handle an absent
-- profile (trd D4). The moved values travel with the profile row.
INSERT INTO "OrgProfile" ("orgId", "tagline", "description", "logoUrl", "heroUrl", "accent", "deliveryPolicy", "returnsPolicy", "createdAt", "updatedAt")
SELECT "id", "tagline", "description", "logoUrl", "heroUrl", "accent", "deliveryPolicy", "returnsPolicy", now(), now()
FROM "Org";

INSERT INTO "OrgListingDefaults" ("orgId", "createdAt", "updatedAt")
SELECT "id", now(), now()
FROM "Org";

-- Only now, with every value copied.
-- AlterTable
ALTER TABLE "Org" DROP COLUMN "accent",
DROP COLUMN "deliveryPolicy",
DROP COLUMN "description",
DROP COLUMN "heroUrl",
DROP COLUMN "logoUrl",
DROP COLUMN "returnsPolicy",
DROP COLUMN "tagline";
