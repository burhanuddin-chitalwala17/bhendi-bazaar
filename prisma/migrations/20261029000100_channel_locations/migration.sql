-- inventory-sync D1, Q15, Q16: each marketplace pickup location of a connected account, and the
-- shop's own location it stands for, or "not used". Adds a table only; drops nothing.

CREATE TABLE "ChannelLocation" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pincode" TEXT,
    "orgAddressId" TEXT,
    "notUsed" BOOLEAN NOT NULL DEFAULT false,
    "matchedAt" TIMESTAMP(3),
    "firstSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "goneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChannelLocation_pkey" PRIMARY KEY ("id"),
    -- A location is matched to one of ours or marked not used, never both.
    CONSTRAINT "ChannelLocation_match_check" CHECK (NOT ("notUsed" AND "orgAddressId" IS NOT NULL))
);

CREATE UNIQUE INDEX "ChannelLocation_connectionId_externalId_key" ON "ChannelLocation"("connectionId", "externalId");
CREATE INDEX "ChannelLocation_orgId_idx" ON "ChannelLocation"("orgId");
CREATE INDEX "ChannelLocation_orgAddressId_idx" ON "ChannelLocation"("orgAddressId");

ALTER TABLE "ChannelLocation" ADD CONSTRAINT "ChannelLocation_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "ChannelConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelLocation" ADD CONSTRAINT "ChannelLocation_orgAddressId_fkey" FOREIGN KEY ("orgAddressId") REFERENCES "OrgAddress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
