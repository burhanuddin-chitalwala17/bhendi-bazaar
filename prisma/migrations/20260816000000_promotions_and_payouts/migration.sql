-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('PLATFORM', 'ORG');

-- CreateEnum
CREATE TYPE "PromotionTrigger" AS ENUM ('AUTOMATIC', 'CODE');

-- CreateEnum
CREATE TYPE "PromotionValueType" AS ENUM ('PERCENT', 'AMOUNT_OFF', 'FIXED_PRICE');

-- CreateEnum
CREATE TYPE "LedgerEntryKind" AS ENUM ('SALE', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerEntryState" AS ENUM ('DRAFT', 'SETTLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "commissionBps" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "maxDiscountBps" INTEGER NOT NULL DEFAULT 5000;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "discountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "orgFundedPaise" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scope" "PromotionScope" NOT NULL,
    "orgId" TEXT,
    "trigger" "PromotionTrigger" NOT NULL,
    "code" TEXT,
    "valueType" "PromotionValueType" NOT NULL,
    "percentBps" INTEGER,
    "amountOffPaise" INTEGER,
    "fixedPricePaise" INTEGER,
    "maxDiscountPaise" INTEGER,
    "minSubtotalPaise" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "usageLimit" INTEGER,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionTarget" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "categoryId" TEXT,
    "productId" TEXT,

    CONSTRAINT "PromotionTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDiscount" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "labelSnapshot" TEXT NOT NULL,
    "codeSnapshot" TEXT,
    "buyerDiscountPaise" INTEGER NOT NULL,
    "orgFundedPaise" INTEGER NOT NULL,
    "platformFundedPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgCommissionRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgCommissionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgLedgerEntry" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "orderId" TEXT,
    "kind" "LedgerEntryKind" NOT NULL DEFAULT 'SALE',
    "state" "LedgerEntryState" NOT NULL DEFAULT 'DRAFT',
    "grossItemsPaise" INTEGER NOT NULL,
    "orgFundedDiscountPaise" INTEGER NOT NULL,
    "platformFundedDiscountPaise" INTEGER NOT NULL,
    "commissionBasePaise" INTEGER NOT NULL,
    "commissionPaise" INTEGER NOT NULL,
    "payablePaise" INTEGER NOT NULL,
    "isNegativeMargin" BOOLEAN NOT NULL DEFAULT false,
    "isManuallyEdited" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "note" TEXT,
    "settlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgLedgerEntryLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "basePaise" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "commissionPaise" INTEGER NOT NULL,

    CONSTRAINT "OrgLedgerEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_isActive_startsAt_endsAt_idx" ON "Promotion"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "Promotion_scope_orgId_idx" ON "Promotion"("scope", "orgId");

-- CreateIndex
CREATE INDEX "Promotion_trigger_idx" ON "Promotion"("trigger");

-- CreateIndex
CREATE INDEX "PromotionTarget_categoryId_idx" ON "PromotionTarget"("categoryId");

-- CreateIndex
CREATE INDEX "PromotionTarget_productId_idx" ON "PromotionTarget"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionTarget_promotionId_categoryId_key" ON "PromotionTarget"("promotionId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionTarget_promotionId_productId_key" ON "PromotionTarget"("promotionId", "productId");

-- CreateIndex
CREATE INDEX "OrderDiscount_promotionId_idx" ON "OrderDiscount"("promotionId");

-- CreateIndex
CREATE INDEX "OrderDiscount_orgId_idx" ON "OrderDiscount"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderDiscount_orderId_promotionId_orgId_key" ON "OrderDiscount"("orderId", "promotionId", "orgId");

-- CreateIndex
CREATE INDEX "OrgCommissionRule_orgId_idx" ON "OrgCommissionRule"("orgId");

-- CreateIndex
CREATE INDEX "OrgCommissionRule_categoryId_idx" ON "OrgCommissionRule"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgCommissionRule_orgId_categoryId_key" ON "OrgCommissionRule"("orgId", "categoryId");

-- CreateIndex
CREATE INDEX "OrgLedgerEntry_orgId_deletedAt_idx" ON "OrgLedgerEntry"("orgId", "deletedAt");

-- CreateIndex
CREATE INDEX "OrgLedgerEntry_settlementId_idx" ON "OrgLedgerEntry"("settlementId");

-- CreateIndex
CREATE INDEX "OrgLedgerEntry_isNegativeMargin_idx" ON "OrgLedgerEntry"("isNegativeMargin");

-- CreateIndex
CREATE UNIQUE INDEX "OrgLedgerEntry_orderId_orgId_kind_key" ON "OrgLedgerEntry"("orderId", "orgId", "kind");

-- CreateIndex
CREATE INDEX "OrgLedgerEntryLine_entryId_idx" ON "OrgLedgerEntryLine"("entryId");

-- CreateIndex
CREATE INDEX "OrgLedgerEntryLine_orderItemId_idx" ON "OrgLedgerEntryLine"("orderItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_code_key" ON "Settlement"("code");

-- CreateIndex
CREATE INDEX "Settlement_orgId_status_idx" ON "Settlement"("orgId", "status");

-- CreateIndex
CREATE INDEX "Settlement_code_idx" ON "Settlement"("code");

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgCommissionRule" ADD CONSTRAINT "OrgCommissionRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgCommissionRule" ADD CONSTRAINT "OrgCommissionRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgLedgerEntry" ADD CONSTRAINT "OrgLedgerEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgLedgerEntry" ADD CONSTRAINT "OrgLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgLedgerEntry" ADD CONSTRAINT "OrgLedgerEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "Settlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgLedgerEntryLine" ADD CONSTRAINT "OrgLedgerEntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "OrgLedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgLedgerEntryLine" ADD CONSTRAINT "OrgLedgerEntryLine_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- Constraints the Prisma schema language cannot express (same approach as
-- product_media's cover rules). These are the invariants the engine relies on, so
-- they belong in the database rather than only in a service.
-- ─────────────────────────────────────────────────────────────────────────────

-- An offer's funding scope and its org must agree: org-scoped iff it names an org.
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_scope_org_agree"
  CHECK (("scope" = 'ORG') = ("orgId" IS NOT NULL));

-- A code exists iff the offer is unlocked by one.
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_trigger_code_agree"
  CHECK (("trigger" = 'CODE') = ("code" IS NOT NULL));

-- Exactly the value field its type uses, and nothing else.
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_value_matches_type"
  CHECK (
    ("valueType" = 'PERCENT'     AND "percentBps"      IS NOT NULL AND "percentBps" > 0 AND "percentBps" <= 10000
                                 AND "amountOffPaise"  IS NULL AND "fixedPricePaise" IS NULL)
 OR ("valueType" = 'AMOUNT_OFF'  AND "amountOffPaise"  IS NOT NULL AND "amountOffPaise" > 0
                                 AND "percentBps"      IS NULL AND "fixedPricePaise" IS NULL)
 OR ("valueType" = 'FIXED_PRICE' AND "fixedPricePaise" IS NOT NULL AND "fixedPricePaise" >= 0
                                 AND "percentBps"      IS NULL AND "amountOffPaise"  IS NULL)
  );

-- Every offer is time-boxed, and a window that ends before it starts is not one.
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_window_ordered"
  CHECK ("endsAt" > "startsAt");

-- Basket-level conditions belong to coupons: a product page cannot know the basket.
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_automatic_has_no_basket_condition"
  CHECK ("trigger" = 'CODE' OR ("minSubtotalPaise" = 0 AND "maxDiscountPaise" IS NULL));

-- A target narrows by exactly one dimension. Zero target rows on a promotion means
-- "everything in scope"; a row that names nothing would be a silent widening.
ALTER TABLE "PromotionTarget" ADD CONSTRAINT "PromotionTarget_exactly_one_dimension"
  CHECK (num_nonnulls("categoryId", "productId") = 1);

-- The funding split must reconcile to what the buyer actually received. This is the
-- constraint the whole settlement path leans on (ADR-0019).
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_funding_reconciles"
  CHECK ("orgFundedPaise" + "platformFundedPaise" = "buyerDiscountPaise");

ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_funding_non_negative"
  CHECK ("orgFundedPaise" >= 0 AND "platformFundedPaise" >= 0 AND "buyerDiscountPaise" >= 0);

-- A line's allocated share, and the part of it the org bore, cannot exceed each other.
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_discount_split_sane"
  CHECK ("discountPaise" >= 0 AND "orgFundedPaise" >= 0 AND "orgFundedPaise" <= "discountPaise");

-- Rates are basis points, and a negative or >100% commission is not a rate.
ALTER TABLE "OrgCommissionRule" ADD CONSTRAINT "OrgCommissionRule_rate_is_bps"
  CHECK ("rateBps" >= 0 AND "rateBps" <= 10000);

ALTER TABLE "OrgLedgerEntryLine" ADD CONSTRAINT "OrgLedgerEntryLine_rate_is_bps"
  CHECK ("rateBps" >= 0 AND "rateBps" <= 10000);

-- The commission base is the org's goods less what the org itself funded — never
-- what the buyer paid (org-payouts D2).
ALTER TABLE "OrgLedgerEntry" ADD CONSTRAINT "OrgLedgerEntry_base_excludes_platform_funding"
  CHECK ("commissionBasePaise" = "grossItemsPaise" - "orgFundedDiscountPaise");

-- A paid settlement records a transfer that happened: it has a date.
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_paid_has_date"
  CHECK ("status" <> 'PAID' OR "paidAt" IS NOT NULL);
