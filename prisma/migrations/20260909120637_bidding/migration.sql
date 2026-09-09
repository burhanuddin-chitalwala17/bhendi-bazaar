-- CreateEnum
CREATE TYPE "BiddingStatus" AS ENUM ('OPEN', 'CANCELLED', 'SOLD', 'UNSOLD');

-- CreateTable
CREATE TABLE "BiddingEvent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "size" TEXT,
    "color" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "startingBidPaise" INTEGER NOT NULL,
    "maxIncreasePaise" INTEGER NOT NULL,
    "quickBidsPaise" INTEGER[],
    "referencePricePaise" INTEGER NOT NULL,
    "status" "BiddingStatus" NOT NULL DEFAULT 'OPEN',
    "highestBidPaise" INTEGER,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "soldBidId" TEXT,
    "soldAmountPaise" INTEGER,
    "soldReason" TEXT,
    "settledAt" TIMESTAMP(3),
    "settledById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiddingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "guestPhone" TEXT,
    "guestEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BiddingEvent_slug_key" ON "BiddingEvent"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BiddingEvent_soldBidId_key" ON "BiddingEvent"("soldBidId");

-- CreateIndex
CREATE INDEX "BiddingEvent_status_productId_idx" ON "BiddingEvent"("status", "productId");

-- CreateIndex
CREATE INDEX "BiddingEvent_status_endAt_idx" ON "BiddingEvent"("status", "endAt");

-- CreateIndex
CREATE INDEX "BiddingEvent_orgId_status_idx" ON "BiddingEvent"("orgId", "status");

-- CreateIndex
CREATE INDEX "Bid_eventId_amountPaise_idx" ON "Bid"("eventId", "amountPaise" DESC);

-- CreateIndex
CREATE INDEX "Bid_userId_idx" ON "Bid"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Bid_eventId_amountPaise_key" ON "Bid"("eventId", "amountPaise");

-- AddForeignKey
ALTER TABLE "BiddingEvent" ADD CONSTRAINT "BiddingEvent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiddingEvent" ADD CONSTRAINT "BiddingEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiddingEvent" ADD CONSTRAINT "BiddingEvent_soldBidId_fkey" FOREIGN KEY ("soldBidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiddingEvent" ADD CONSTRAINT "BiddingEvent_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiddingEvent" ADD CONSTRAINT "BiddingEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BiddingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Constraints the schema language cannot express (bidding D4/D6, spec R7/R40).
-- ─────────────────────────────────────────────────────────────────────────────

-- A product is under at most one live event, as a database fact rather than an
-- application check: two simultaneous creations cannot both succeed, and nothing has
-- to be written onto Product to enforce it (bidding D4, spec R7/R32).
CREATE UNIQUE INDEX "BiddingEvent_one_open_per_product"
  ON "BiddingEvent" ("productId")
  WHERE "status" = 'OPEN';

-- A window that ends before it starts would derive as permanently finished, so it is
-- refused at the boundary rather than handled downstream.
ALTER TABLE "BiddingEvent"
  ADD CONSTRAINT "BiddingEvent_window_ordered"
  CHECK ("endAt" > "startAt");

-- Money is integer paise and an auction of nothing is not an auction (ADR-0004).
-- `maxIncreasePaise` must admit at least one raise, or no bid could ever be placed.
ALTER TABLE "BiddingEvent"
  ADD CONSTRAINT "BiddingEvent_amounts_positive"
  CHECK (
    "startingBidPaise" > 0
    AND "maxIncreasePaise" > 0
    AND "referencePricePaise" >= 0
    AND ("highestBidPaise" IS NULL OR "highestBidPaise" >= "startingBidPaise")
    AND "bidCount" >= 0
  );

-- A recorded sale is complete or it is not a sale: the winning bid and the amount the
-- org is owed arrive together, and no other outcome may carry them (spec R40/R42).
ALTER TABLE "BiddingEvent"
  ADD CONSTRAINT "BiddingEvent_sale_complete"
  CHECK (
    ("status" = 'SOLD' AND "soldBidId" IS NOT NULL AND "soldAmountPaise" IS NOT NULL AND "soldAmountPaise" > 0)
    OR ("status" <> 'SOLD' AND "soldBidId" IS NULL AND "soldAmountPaise" IS NULL)
  );

-- Every bid is attributable to someone. A signed-in bidder is a user reference; a guest
-- is a name and a number. Email stays optional by decision (spec R22/R22a).
ALTER TABLE "Bid"
  ADD CONSTRAINT "Bid_attributable"
  CHECK (
    "userId" IS NOT NULL
    OR ("guestName" IS NOT NULL AND "guestPhone" IS NOT NULL)
  );

ALTER TABLE "Bid"
  ADD CONSTRAINT "Bid_amount_positive"
  CHECK ("amountPaise" > 0);
