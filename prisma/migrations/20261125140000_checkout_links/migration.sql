-- checkout-links unit 1 (D1, D3): a link holding products and quantities, never a price to charge;
-- the per-cart claim that makes a second open add nothing; and the cart line's mark of the link it
-- came from. Adds only; nothing is dropped.
-- CreateEnum
CREATE TYPE "CheckoutLinkSource" AS ENUM ('INBOX_ORDER', 'AUTOMATIC', 'CAMPAIGN');

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "fromLinkId" TEXT;

-- CreateTable
CREATE TABLE "CheckoutLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "source" "CheckoutLinkSource" NOT NULL,
    "sourceRef" TEXT,
    "displayPricesPaise" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckoutLinkOpen" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "cartKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutLinkOpen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutLink_token_key" ON "CheckoutLink"("token");

-- CreateIndex
CREATE INDEX "CheckoutLink_orgId_idx" ON "CheckoutLink"("orgId");

-- CreateIndex
CREATE INDEX "CartItem_fromLinkId_idx" ON "CartItem"("fromLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutLinkOpen_linkId_cartKey_key" ON "CheckoutLinkOpen"("linkId", "cartKey");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_fromLinkId_fkey" FOREIGN KEY ("fromLinkId") REFERENCES "CheckoutLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutLink" ADD CONSTRAINT "CheckoutLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutLink" ADD CONSTRAINT "CheckoutLink_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutLinkOpen" ADD CONSTRAINT "CheckoutLinkOpen_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "CheckoutLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

