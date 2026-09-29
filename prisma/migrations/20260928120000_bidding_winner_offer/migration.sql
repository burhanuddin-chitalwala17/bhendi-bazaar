-- winner-offer (docs/specs/bidding/winner-offer/, ADR-0041)

-- CreateEnum
CREATE TYPE "BidOfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'LAPSED', 'SKIPPED', 'WITHDRAWN', 'PAID');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BID_OFFER';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "bidOfferId" TEXT;

-- AlterTable
ALTER TABLE "BiddingEvent" ADD COLUMN     "claimWindowHours" INTEGER;

-- CreateTable
CREATE TABLE "BidOffer" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" "BidOfferStatus" NOT NULL,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "emailSentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BidOffer_tokenHash_key" ON "BidOffer"("tokenHash");

-- CreateIndex
CREATE INDEX "BidOffer_status_expiresAt_idx" ON "BidOffer"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "BidOffer_bidId_idx" ON "BidOffer"("bidId");

-- CreateIndex
CREATE UNIQUE INDEX "BidOffer_eventId_sequence_key" ON "BidOffer"("eventId", "sequence");

-- CreateIndex
CREATE INDEX "Order_bidOfferId_idx" ON "Order"("bidOfferId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_bidOfferId_fkey" FOREIGN KEY ("bidOfferId") REFERENCES "BidOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidOffer" ADD CONSTRAINT "BidOffer_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "BiddingEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidOffer" ADD CONSTRAINT "BidOffer_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidOffer" ADD CONSTRAINT "BidOffer_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- One open offer per event (winner-offer D1, R2). The end-of-auction job and the hourly
-- sweep can both try to open the first offer; this index is what makes one of them lose.
CREATE UNIQUE INDEX "BidOffer_one_open_per_event"
  ON "BidOffer"("eventId")
  WHERE "status" IN ('OFFERED', 'ACCEPTED');

-- A skipped offer was never made, so it has no deadline and no link; every other offer
-- has a deadline. The link's hash arrives when the email job sends it (winner-offer R5, D9).
ALTER TABLE "BidOffer"
  ADD CONSTRAINT "BidOffer_skipped_has_no_deadline"
  CHECK (
    ("status" = 'SKIPPED' AND "tokenHash" IS NULL AND "expiresAt" IS NULL)
    OR ("status" <> 'SKIPPED' AND "expiresAt" IS NOT NULL)
  );

ALTER TABLE "BidOffer"
  ADD CONSTRAINT "BidOffer_sequence_positive"
  CHECK ("sequence" > 0);

ALTER TABLE "BiddingEvent"
  ADD CONSTRAINT "BiddingEvent_claim_window_positive"
  CHECK ("claimWindowHours" IS NULL OR "claimWindowHours" > 0);
