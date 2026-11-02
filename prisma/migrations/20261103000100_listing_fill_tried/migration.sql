-- marketplace-facts Q36 review: when a fill was last queued for a listing never read, so a read that
-- keeps failing is retried weekly rather than daily. Adds a column; drops nothing.
ALTER TABLE "ChannelListing" ADD COLUMN "attributesTriedAt" TIMESTAMP(3);
