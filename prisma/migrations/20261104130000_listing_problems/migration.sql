-- marketplace-publish Q23: what the marketplace says stops or limits a listing, from the daily look.
-- Adds columns; drops nothing. Reads by connection use the (connectionId, sku) unique index.
ALTER TABLE "ChannelListing" ADD COLUMN "problems" JSONB;
ALTER TABLE "ChannelListing" ADD COLUMN "problemsSince" TIMESTAMP(3);
ALTER TABLE "ChannelListing" ADD COLUMN "suppressed" BOOLEAN NOT NULL DEFAULT false;
