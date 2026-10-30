-- inventory-sync D3, D6, Q4: the stock sync switch and its times per connection, and the counts last
-- sent per listing. Adds columns only; drops nothing.

ALTER TABLE "ChannelConnection"
    ADD COLUMN "stockSync" TEXT NOT NULL DEFAULT 'off',
    ADD COLUMN "stockSyncChangedAt" TIMESTAMP(3),
    ADD COLUMN "stockSentAt" TIMESTAMP(3),
    ADD COLUMN "stockCheckedAt" TIMESTAMP(3),
    ADD COLUMN "ordersCursor" TEXT,
    ADD CONSTRAINT "ChannelConnection_stock_sync_check" CHECK ("stockSync" IN ('off', 'on', 'paused'));

ALTER TABLE "ChannelListing"
    ADD COLUMN "stockSent" JSONB,
    ADD COLUMN "stockSentAt" TIMESTAMP(3);
