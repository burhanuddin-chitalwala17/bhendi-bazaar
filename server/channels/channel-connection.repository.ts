import { prisma } from "@server/shared/prisma";

import { CONNECTION_STATE, type ConnectionError, type MarketplaceChannel } from "./channel-connection.types";

/**
 * The one way to reach `ChannelConnection` (Invariant 5). Tokens arrive and leave here already
 * encrypted; this module never sees plaintext. Every command takes the caller's client, so the
 * service can make a connection and the shop's channel choice commit together (D11).
 */

export type ConnectionDb = Pick<typeof prisma, "channelConnection" | "$queryRaw">;

const PEOPLE = {
  connectedBy: { select: { name: true, email: true } },
  disconnectedBy: { select: { name: true, email: true } },
} as const;

export interface ConnectionRow {
  id: string;
  orgId: string;
  channel: string;
  state: string;
  externalAccountId: string | null;
  authorizedAt: Date | null;
  connectedAt: Date | null;
  disconnectedAt: Date | null;
  lastCheckedAt: Date | null;
  lastErrorCode: string | null;
  connectedBy: { name: string | null; email: string | null } | null;
  disconnectedBy: { name: string | null; email: string | null } | null;
}

export interface SecretRow {
  id: string;
  orgId: string;
  channel: string;
  state: string;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshToken: string | null;
  refreshTokenExpiresAt: Date | null;
}

const ROW = {
  id: true,
  orgId: true,
  channel: true,
  state: true,
  externalAccountId: true,
  authorizedAt: true,
  connectedAt: true,
  disconnectedAt: true,
  lastCheckedAt: true,
  lastErrorCode: true,
  ...PEOPLE,
} as const;

const SECRETS = {
  id: true,
  orgId: true,
  channel: true,
  state: true,
  accessToken: true,
  accessTokenExpiresAt: true,
  refreshToken: true,
  refreshTokenExpiresAt: true,
} as const;

export interface SealedGrant {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date | null;
}

export const channelConnectionRepository = {
  async forOrg(orgId: string): Promise<ConnectionRow[]> {
    return await prisma.channelConnection.findMany({ where: { orgId }, select: ROW });
  },

  async find(orgId: string, channel: MarketplaceChannel, db: ConnectionDb = prisma): Promise<ConnectionRow | null> {
    return await db.channelConnection.findUnique({
      where: { orgId_channel: { orgId, channel } },
      select: ROW,
    });
  },

  /** Another shop's live connection to this marketplace account, if any (D9). */
  async liveElsewhere(
    channel: MarketplaceChannel,
    externalAccountId: string,
    orgId: string,
    db: ConnectionDb = prisma,
  ): Promise<boolean> {
    const found = await db.channelConnection.findFirst({
      where: { channel, externalAccountId, orgId: { not: orgId }, state: { not: CONNECTION_STATE.DISCONNECTED } },
      select: { id: true },
    });
    return found !== null;
  },

  /** Shops with a live connection to a marketplace, for its cap (R10). */
  async countLive(channel: MarketplaceChannel): Promise<number> {
    return await prisma.channelConnection.count({
      where: { channel, state: { not: CONNECTION_STATE.DISCONNECTED } },
    });
  },

  /** Create or revive the shop's connection with fresh consent. */
  async connect(
    db: ConnectionDb,
    input: {
      orgId: string;
      channel: MarketplaceChannel;
      externalAccountId: string | null;
      grant: SealedGrant;
      userId: string;
      now: Date;
    },
  ): Promise<{ id: string }> {
    const data = {
      state: CONNECTION_STATE.CONNECTED,
      externalAccountId: input.externalAccountId,
      ...input.grant,
      authorizedAt: input.now,
      connectedById: input.userId,
      connectedAt: input.now,
      lastCheckedAt: input.now,
      lastErrorCode: null,
      lastErrorAt: null,
    };
    return await db.channelConnection.upsert({
      where: { orgId_channel: { orgId: input.orgId, channel: input.channel } },
      create: { orgId: input.orgId, channel: input.channel, ...data },
      update: data,
      select: { id: true },
    });
  },

  /** Retire the connection: tokens gone, who and when kept (Q4). */
  async disconnect(
    db: ConnectionDb,
    orgId: string,
    channel: MarketplaceChannel,
    userId: string,
    now: Date,
  ): Promise<{ id: string } | null> {
    const existing = await db.channelConnection.findUnique({
      where: { orgId_channel: { orgId, channel } },
      select: { id: true },
    });
    if (!existing) return null;
    return await db.channelConnection.update({
      where: { id: existing.id },
      data: {
        state: CONNECTION_STATE.DISCONNECTED,
        accessToken: null,
        accessTokenExpiresAt: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        disconnectedById: userId,
        disconnectedAt: now,
      },
      select: { id: true },
    });
  },

  /**
   * The row with its sealed tokens, locked until the caller's transaction ends (D8): a second
   * renewal waits here, then sees the first one's tokens instead of spending the old refresh token.
   */
  async lockSecrets(db: ConnectionDb, id: string): Promise<SecretRow | null> {
    await db.$queryRaw`SELECT id FROM "ChannelConnection" WHERE id = ${id} FOR UPDATE`;
    return await db.channelConnection.findUnique({ where: { id }, select: SECRETS });
  },

  async secretsFor(orgId: string, channel: MarketplaceChannel): Promise<SecretRow | null> {
    return await prisma.channelConnection.findUnique({
      where: { orgId_channel: { orgId, channel } },
      select: SECRETS,
    });
  },

  /** A marketplace that does not restate the refresh token's lifetime keeps the one we had. */
  async saveGrant(db: ConnectionDb, id: string, grant: SealedGrant): Promise<void> {
    const { refreshTokenExpiresAt, ...rest } = grant;
    await db.channelConnection.update({
      where: { id },
      data: refreshTokenExpiresAt ? { ...rest, refreshTokenExpiresAt } : rest,
      select: { id: true },
    });
  },

  /** Re-seal stored tokens under the current key (D3), without renewing them. Call under `lockSecrets`. */
  async reseal(db: ConnectionDb, id: string, sealed: { accessToken: string | null; refreshToken: string }): Promise<void> {
    await db.channelConnection.update({ where: { id }, data: sealed, select: { id: true } });
  },

  async markChecked(id: string, now: Date): Promise<void> {
    await prisma.channelConnection.updateMany({
      where: { id, state: CONNECTION_STATE.CONNECTED },
      data: { lastCheckedAt: now, lastErrorCode: null, lastErrorAt: null },
    });
  },

  /** Conditional, so a disconnect that landed mid-check is never turned back into a live row. */
  async markNeedsReconnect(id: string, reason: ConnectionError, now: Date): Promise<void> {
    await prisma.channelConnection.updateMany({
      where: { id, state: CONNECTION_STATE.CONNECTED },
      data: { state: CONNECTION_STATE.NEEDS_RECONNECT, lastErrorCode: reason, lastErrorAt: now },
    });
  },

  /** Every connection that still holds tokens, for the daily job (D7). */
  async live(): Promise<SecretRow[]> {
    return await prisma.channelConnection.findMany({
      where: { state: { not: CONNECTION_STATE.DISCONNECTED } },
      select: SECRETS,
    });
  },
};
