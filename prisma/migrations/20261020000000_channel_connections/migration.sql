-- A shop's authorised connection to a marketplace (docs/specs/marketplace-integration/channel-connectors,
-- TRD D2). Tokens are stored as server/shared/crypto.ts ciphertext. No data is dropped.

CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshToken" TEXT,
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "authorizedAt" TIMESTAMP(3),
    "connectedById" TEXT,
    "connectedAt" TIMESTAMP(3),
    "disconnectedById" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChannelConnection_state_check" CHECK ("state" IN ('CONNECTED', 'NEEDS_RECONNECT', 'DISCONNECTED')),
    -- A connected row always has something to act with; a disconnected one never does (Q4).
    CONSTRAINT "ChannelConnection_tokens_check" CHECK (
        ("state" = 'DISCONNECTED' AND "accessToken" IS NULL AND "refreshToken" IS NULL)
        OR ("state" <> 'DISCONNECTED' AND "refreshToken" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "ChannelConnection_orgId_channel_key" ON "ChannelConnection"("orgId", "channel");
CREATE INDEX "ChannelConnection_channel_state_idx" ON "ChannelConnection"("channel", "state");

-- One shop per marketplace account (parent decision Q8, TRD D9): two simultaneous connects of the
-- same Amazon seller cannot both commit. Partial, so a disconnected row never blocks a new shop.
CREATE UNIQUE INDEX "ChannelConnection_one_shop_per_account" ON "ChannelConnection"("channel", "externalAccountId")
    WHERE "state" <> 'DISCONNECTED' AND "externalAccountId" IS NOT NULL;

ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChannelConnection" ADD CONSTRAINT "ChannelConnection_disconnectedById_fkey" FOREIGN KEY ("disconnectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
