-- family-merge Q21: "Not one item" on a suggested group is remembered on its listings, so the
-- suggestion does not come back. Adds a column only; drops nothing.

ALTER TABLE "ChannelListing" ADD COLUMN "familyHintDismissedAt" TIMESTAMP(3);
