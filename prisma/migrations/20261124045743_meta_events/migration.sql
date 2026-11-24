-- social-selling meta-foundation unit 2 (ADR-0084): Meta's webhook events stored once, and the daily
-- counts of those dropped. Additive only: two nullable connection columns and two new tables; no DROP.
-- AlterTable
ALTER TABLE "ChannelConnection" ADD COLUMN     "externalBusinessId" TEXT,
ADD COLUMN     "externalPhoneId" TEXT;

-- CreateTable
CREATE TABLE "MetaEvent" (
    "id" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "sealedPayload" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "MetaEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaUnroutedCount" (
    "day" DATE NOT NULL,
    "product" TEXT NOT NULL,
    "unrouted" INTEGER NOT NULL DEFAULT 0,
    "badSignature" INTEGER NOT NULL DEFAULT 0,
    "previousSecret" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MetaUnroutedCount_pkey" PRIMARY KEY ("day","product")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaEvent_dedupeKey_key" ON "MetaEvent"("dedupeKey");


-- CreateIndex
CREATE INDEX "MetaEvent_receivedAt_idx" ON "MetaEvent"("receivedAt");



-- AddForeignKey
ALTER TABLE "MetaEvent" ADD CONSTRAINT "MetaEvent_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The drain reads only pending events, per connection, in occurrence order (ADR-0084).
CREATE INDEX "MetaEvent_pending_idx" ON "MetaEvent"("connectionId", "occurredAt", "id") WHERE "state" = 'PENDING';

-- One live shop per WhatsApp number and per WhatsApp business account, as for an Instagram account
-- ("ChannelConnection_one_shop_per_account"): an event routed by either id can belong to one shop only.
CREATE UNIQUE INDEX "ChannelConnection_one_shop_per_phone" ON "ChannelConnection"("channel", "externalPhoneId")
    WHERE "state" <> 'DISCONNECTED' AND "externalPhoneId" IS NOT NULL;
CREATE UNIQUE INDEX "ChannelConnection_one_shop_per_business" ON "ChannelConnection"("channel", "externalBusinessId")
    WHERE "state" <> 'DISCONNECTED' AND "externalBusinessId" IS NOT NULL;
