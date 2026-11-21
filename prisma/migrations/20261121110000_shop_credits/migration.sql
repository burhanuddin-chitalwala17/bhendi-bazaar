-- ai-images/shop-credits D2-D7: a shop's credit as append-only lines, the platform's margin and payment
-- details, and proof on a paid settlement. Additive. Every existing shop gets its starting credit (Q14).
-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'BANK_TRANSFER', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "CreditLineKind" AS ENUM ('GRANT', 'TOP_UP', 'CHARGE', 'ADJUSTMENT', 'REFUND', 'REVERSAL');

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "method" "PaymentMethod",
ADD COLUMN     "receiptRef" TEXT;

-- CreateTable
CREATE TABLE "CreditLine" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "CreditLineKind" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "providerCostPaise" INTEGER,
    "marginBps" INTEGER,
    "enhancementId" TEXT,
    "runKey" TEXT,
    "grantKey" TEXT,
    "method" "PaymentMethod",
    "reference" TEXT,
    "paidOn" DATE,
    "receiptRef" TEXT,
    "reversesId" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "marginBps" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgCreditPolicy" (
    "orgId" TEXT NOT NULL,
    "marginBps" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgCreditPolicy_pkey" PRIMARY KEY ("orgId")
);

-- CreateTable
CREATE TABLE "PlatformPaymentDetails" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "upiId" TEXT,
    "qrRef" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "ifsc" TEXT,
    "bankName" TEXT,
    "updatedByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformPaymentDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreditLine_runKey_key" ON "CreditLine"("runKey");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLine_grantKey_key" ON "CreditLine"("grantKey");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLine_reversesId_key" ON "CreditLine"("reversesId");

-- CreateIndex
CREATE INDEX "CreditLine_orgId_createdAt_idx" ON "CreditLine"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "CreditLine_enhancementId_idx" ON "CreditLine"("enhancementId");

-- AddForeignKey
ALTER TABLE "CreditLine" ADD CONSTRAINT "CreditLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLine" ADD CONSTRAINT "CreditLine_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "CreditLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgCreditPolicy" ADD CONSTRAINT "OrgCreditPolicy_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Starting credit (D3): ₹2,500 once for every shop that exists now. A shop made later is granted on
-- first read. `grantKey` is the org id, so running this twice, or alongside that, grants once.
INSERT INTO "CreditLine" ("id", "orgId", "kind", "amountPaise", "grantKey", "note", "createdAt")
SELECT 'grant_' || "id", "id", 'GRANT', 250000, "id", 'Starting credit', CURRENT_TIMESTAMP FROM "Org"
ON CONFLICT ("grantKey") DO NOTHING;
