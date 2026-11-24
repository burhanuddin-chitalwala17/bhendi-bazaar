import { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";

import {
  CONNECTION_STATE,
  READ_ERROR,
  READ_STALL_MS,
  READ_STATE,
  MARKETPLACE_CHANNELS,
  type ConnectionChannel,
  type ConnectionError,
  type MarketplaceChannel,
  type ReadError,
} from "./channel-connection.types";
import type { SocialPlatform } from "./social/types";
import { STOCK_SYNC, type StockProblem, type StockSyncState } from "./channel-stock.types";

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
  readState: string | null;
  readTotal: number | null;
  readDone: number | null;
  readStartedAt: Date | null;
  readFinishedAt: Date | null;
  readTouchedAt: Date | null;
  readErrorCode: string | null;
  /** inventory-sync D6: off, on or paused, and its times. */
  stockSync: string;
  stockSyncChangedAt: Date | null;
  stockProblem: string | null;
  stockSentAt: Date | null;
  stockCheckedAt: Date | null;
  ordersCursor: string | null;
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
  readState: true,
  readTotal: true,
  readDone: true,
  readStartedAt: true,
  readFinishedAt: true,
  readTouchedAt: true,
  readErrorCode: true,
  stockSync: true,
  stockSyncChangedAt: true,
  stockProblem: true,
  stockSentAt: true,
  stockCheckedAt: true,
  ordersCursor: true,
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

/** What an order check needs of a connection: its state, where to read from, and its sealed token. */
export interface OrdersCheckRow {
  id: string;
  orgId: string;
  channel: string;
  state: string;
  externalAccountId: string | null;
  stockSync: string;
  stockSyncChangedAt: Date | null;
  ordersCursor: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
}

/** The passes over every shop that call a marketplace read these only; a social row has no marketplace provider. */
const MARKETPLACES: string[] = [...MARKETPLACE_CHANNELS];

export const channelConnectionRepository = {
  async forOrg(orgId: string): Promise<ConnectionRow[]> {
    return await prisma.channelConnection.findMany({ where: { orgId }, select: ROW });
  },

  async byId(id: string): Promise<ConnectionRow | null> {
    return await prisma.channelConnection.findUnique({ where: { id }, select: ROW });
  },

  async find(orgId: string, channel: ConnectionChannel, db: ConnectionDb = prisma): Promise<ConnectionRow | null> {
    return await db.channelConnection.findUnique({
      where: { orgId_channel: { orgId, channel } },
      select: ROW,
    });
  },

  /** Another shop's live connection to this marketplace account, if any (D9). */
  async liveElsewhere(
    channel: ConnectionChannel,
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

  /**
   * A social connection (connect-instagram D1): one sealed long-lived token, no refresh token. The
   * caller holds the row lock and has checked the account; the unique index refuses a second shop.
   */
  async connectSocial(
    db: ConnectionDb,
    input: { orgId: string; channel: SocialPlatform; externalAccountId: string; accessToken: string; accessTokenExpiresAt: Date | null; userId: string; now: Date },
  ): Promise<{ id: string }> {
    const data = {
      state: CONNECTION_STATE.CONNECTED,
      externalAccountId: input.externalAccountId,
      accessToken: input.accessToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      refreshToken: null,
      refreshTokenExpiresAt: null,
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

  /**
   * Serialises connects for one shop and channel until the transaction ends: an advisory lock, since
   * on a first connect there is no row yet for `FOR UPDATE` to hold.
   */
  async lockFor(db: ConnectionDb, orgId: string, channel: ConnectionChannel): Promise<void> {
    await db.$queryRaw`SELECT 1 AS "held" FROM pg_advisory_xact_lock(hashtext(${`channel-connect:${orgId}:${channel}`}))`;
  },

  /** Retire the connection: tokens gone, who and when kept (Q4). */
  async disconnect(
    db: ConnectionDb,
    orgId: string,
    channel: ConnectionChannel,
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

  async secretsFor(orgId: string, channel: ConnectionChannel): Promise<SecretRow | null> {
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

  /** A social connection's renewed or re-sealed token and its expiry, in one update. Call under `lockSecrets`. */
  async saveSocialToken(db: ConnectionDb, id: string, sealed: { accessToken: string; accessTokenExpiresAt: Date | null }): Promise<void> {
    await db.channelConnection.update({ where: { id }, data: sealed, select: { id: true } });
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

  /**
   * Stock sync's switch (inventory-sync D6, Q4). Turning on starts the order check from `ordersFrom`,
   * so sales from before sync, already counted by the shop, are not taken again.
   */
  async setStockSync(
    db: Pick<typeof prisma, "channelConnection">,
    id: string,
    orgId: string,
    state: StockSyncState,
    now: Date,
    ordersFrom?: string,
  ): Promise<boolean> {
    const result = await db.channelConnection.updateMany({
      where: { id, orgId },
      data: { stockSync: state, stockSyncChangedAt: now, stockProblem: null, ...(ordersFrom ? { ordersCursor: ordersFrom } : {}) },
    });
    return result.count === 1;
  },

  /**
   * Claim every connection due an order check, in one statement (inventory-sync Q23, Q26): sync on
   * and none checked in the last `gapMs`. Returns what each check needs, sealed token included, so
   * a run's reads cost the same for one shop or thousands. A second chain finds none and stops.
   */
  async claimDueOrdersChecks(now: Date, gapMs: number): Promise<OrdersCheckRow[]> {
    return await prisma.$queryRaw<OrdersCheckRow[]>`
      UPDATE "ChannelConnection" SET "ordersCheckedAt" = ${now}
      WHERE "state" = ${CONNECTION_STATE.CONNECTED} AND "stockSync" = ${STOCK_SYNC.ON}
        AND ("ordersCheckedAt" IS NULL OR "ordersCheckedAt" < ${new Date(now.getTime() - gapMs)})
      RETURNING "id", "orgId", "channel", "state", "externalAccountId", "stockSync", "stockSyncChangedAt",
        "ordersCursor", "accessToken", "accessTokenExpiresAt"`;
  },

  /**
   * Every moved cursor of a run, in one statement (inventory-sync Q26). Compare-and-set on the cursor
   * the run read, and only while sync is on: sync turned off or on mid-run keeps the cursor it wrote.
   */
  async setOrdersCursors(updates: ReadonlyArray<{ id: string; cursor: string; from: string | null }>): Promise<void> {
    if (updates.length === 0) return;
    const values = Prisma.join(updates.map((u) => Prisma.sql`(${u.id}::text, ${u.cursor}::text, ${u.from}::text)`));
    await prisma.$executeRaw`
      UPDATE "ChannelConnection" AS c SET "ordersCursor" = v.cursor
      FROM (VALUES ${values}) AS v(id, cursor, prior)
      WHERE c."id" = v.id AND c."ordersCursor" IS NOT DISTINCT FROM v.prior AND c."stockSync" = ${STOCK_SYNC.ON}`;
  },

  /** What one order check needs of its connection, in one read (inventory-sync D4). */
  async forOrders(id: string): Promise<OrdersCheckRow | null> {
    return await prisma.channelConnection.findUnique({
      where: { id },
      select: {
        id: true, orgId: true, channel: true, state: true, externalAccountId: true, stockSync: true,
        stockSyncChangedAt: true, ordersCursor: true, accessToken: true, accessTokenExpiresAt: true,
      },
    });
  },

  /** Several connections with their sealed tokens, in one read: a batched check's half of `forOrders`. */
  async withTokens(ids: readonly string[]): Promise<OrdersCheckRow[]> {
    if (ids.length === 0) return [];
    return await prisma.channelConnection.findMany({
      where: { id: { in: [...ids] } },
      select: {
        id: true, orgId: true, channel: true, state: true, externalAccountId: true, stockSync: true,
        stockSyncChangedAt: true, ordersCursor: true, accessToken: true, accessTokenExpiresAt: true,
      },
    });
  },

  /** Every connected marketplace account with its sealed token, in one statement: the daily problems look (marketplace-publish Q23). */
  /** Every connected (org, channel), no secrets (setup-requests D5: the daily category raise). */
  async connectedOrgs(): Promise<Array<{ orgId: string; channel: string }>> {
    return await prisma.channelConnection.findMany({ where: { state: CONNECTION_STATE.CONNECTED, channel: { in: MARKETPLACES } }, select: { orgId: true, channel: true } });
  },

  async connectedWithTokens(): Promise<OrdersCheckRow[]> {
    return await prisma.channelConnection.findMany({
      where: { state: CONNECTION_STATE.CONNECTED, channel: { in: MARKETPLACES } },
      select: {
        id: true, orgId: true, channel: true, state: true, externalAccountId: true, stockSync: true,
        stockSyncChangedAt: true, ordersCursor: true, accessToken: true, accessTokenExpiresAt: true,
      },
    });
  },

  /** The last problem a send met, or null once one goes (D7). */
  async setStockProblem(db: Pick<typeof prisma, "channelConnection">, id: string, problem: StockProblem | null): Promise<void> {
    await db.channelConnection.updateMany({ where: { id, stockProblem: problem === null ? { not: null } : { not: problem } }, data: { stockProblem: problem } });
  },

  /** Connections with stock sync on, for the order check and the daily check (inventory-sync D4, D5). */
  async syncedConnections(): Promise<Array<{ id: string; orgId: string }>> {
    return await prisma.channelConnection.findMany({ where: { state: CONNECTION_STATE.CONNECTED, stockSync: STOCK_SYNC.ON }, select: { id: true, orgId: true } });
  },

  async touchStock(db: Pick<typeof prisma, "channelConnection">, id: string, field: "stockSentAt" | "stockCheckedAt", now: Date): Promise<void> {
    await db.channelConnection.updateMany({ where: { id }, data: { [field]: now } });
  },

  /** Conditional, so a disconnect that landed mid-check is never turned back into a live row. */
  async markNeedsReconnect(id: string, reason: ConnectionError, now: Date): Promise<void> {
    await prisma.channelConnection.updateMany({
      where: { id, state: CONNECTION_STATE.CONNECTED },
      data: { state: CONNECTION_STATE.NEEDS_RECONNECT, lastErrorCode: reason, lastErrorAt: now },
    });
  },

  /**
   * A platform's notice that our app was removed (meta-foundation D6): conditional on the notice
   * being newer than the connection, so one delayed past a reconnect never undoes it.
   */
  async markRemoved(id: string, reason: ConnectionError, noticeAt: Date): Promise<number> {
    const { count } = await prisma.channelConnection.updateMany({
      where: { id, state: CONNECTION_STATE.CONNECTED, OR: [{ connectedAt: null }, { connectedAt: { lt: noticeAt } }] },
      data: { state: CONNECTION_STATE.NEEDS_RECONNECT, lastErrorCode: reason, lastErrorAt: noticeAt },
    });
    return count;
  },

  /**
   * Claim the listing read (channel-import D3): only when no read is running, or the running one has
   * been silent past `READ_STALL_MS`. The count is the verdict; a second job finds 0 and exits.
   */
  async claimRead(id: string, now: Date): Promise<boolean> {
    const silent = new Date(now.getTime() - READ_STALL_MS);
    const result = await prisma.channelConnection.updateMany({
      where: {
        id,
        state: CONNECTION_STATE.CONNECTED,
        OR: [{ readState: null }, { readState: { not: READ_STATE.RUNNING } }, { readTouchedAt: { lt: silent } }],
      },
      data: {
        readState: READ_STATE.RUNNING,
        readTotal: null,
        readDone: 0,
        readStartedAt: now,
        readFinishedAt: null,
        readTouchedAt: now,
        readErrorCode: null,
      },
    });
    return result.count === 1;
  },

  async touchRead(id: string, progress: { total?: number | null; done: number }, now: Date): Promise<void> {
    await prisma.channelConnection.updateMany({
      where: { id, readState: READ_STATE.RUNNING },
      data: { ...(progress.total !== undefined ? { readTotal: progress.total } : {}), readDone: progress.done, readTouchedAt: now },
    });
  },

  /** A read is still alive while it waits on a marketplace (a report being built, a long page walk). */
  async heartbeatRead(id: string, now: Date): Promise<void> {
    await prisma.channelConnection.updateMany({ where: { id, readState: READ_STATE.RUNNING }, data: { readTouchedAt: now } });
  },

  async finishRead(id: string, done: number, now: Date): Promise<void> {
    await prisma.channelConnection.updateMany({
      where: { id, readState: READ_STATE.RUNNING },
      data: { readState: READ_STATE.DONE, readDone: done, readTotal: done, readFinishedAt: now, readTouchedAt: now },
    });
  },

  async stopRead(id: string, error: ReadError, now: Date): Promise<void> {
    await prisma.channelConnection.updateMany({
      where: { id, readState: READ_STATE.RUNNING },
      data: { readState: READ_STATE.STOPPED, readErrorCode: error, readTouchedAt: now },
    });
  },

  /** The read state of one connection, and what the read job needs to act. */
  /** What deciding whether sync may start needs (inventory-sync Q28). */
  async syncOf(id: string) {
    return await prisma.channelConnection.findUnique({ where: { id }, select: { id: true, orgId: true, state: true, stockSync: true } });
  },

  async forRead(id: string) {
    return await prisma.channelConnection.findUnique({
      where: { id },
      select: { id: true, orgId: true, channel: true, state: true, externalAccountId: true, readStartedAt: true },
    });
  },

  /** Record the account id a read learned (Flipkart's account id, D6). The partial unique index decides a clash. */
  async setExternalAccountId(id: string, externalAccountId: string): Promise<void> {
    await prisma.channelConnection.update({ where: { id }, data: { externalAccountId }, select: { id: true } });
  },

  /** End a connection whose account belongs to another shop (D6): tokens gone, the reason kept. */
  async refuseOtherShop(db: ConnectionDb, id: string, reason: ConnectionError, now: Date): Promise<void> {
    await db.channelConnection.update({
      where: { id },
      data: {
        state: CONNECTION_STATE.DISCONNECTED,
        accessToken: null,
        accessTokenExpiresAt: null,
        refreshToken: null,
        refreshTokenExpiresAt: null,
        disconnectedAt: now,
        lastErrorCode: reason,
        lastErrorAt: now,
        readState: READ_STATE.STOPPED,
        readErrorCode: READ_ERROR.OTHER_SHOP,
      },
      select: { id: true },
    });
  },

  /**
   * The live social connections an event may belong to, by any id Meta routes by: the Instagram
   * account, the WhatsApp phone number or account (meta-foundation D3). One query per delivery.
   */
  async socialRoutes(
    channel: string,
    ids: readonly string[],
  ): Promise<Array<{ id: string; orgId: string; externalAccountId: string | null; externalPhoneId: string | null; externalBusinessId: string | null }>> {
    if (ids.length === 0) return [];
    const list = [...ids];
    return await prisma.channelConnection.findMany({
      where: {
        channel,
        state: { not: CONNECTION_STATE.DISCONNECTED },
        OR: [{ externalAccountId: { in: list } }, { externalPhoneId: { in: list } }, { externalBusinessId: { in: list } }],
      },
      select: { id: true, orgId: true, externalAccountId: true, externalPhoneId: true, externalBusinessId: true },
    });
  },

  /** Every connected account on one social platform with its sealed token: that platform's daily pass (connect-instagram D2). */
  async liveSocial(channel: SocialPlatform): Promise<SecretRow[]> {
    return await prisma.channelConnection.findMany({ where: { channel, state: CONNECTION_STATE.CONNECTED }, select: SECRETS });
  },

  /** Every marketplace connection that still holds tokens, for the daily job (D7); social ones have their own pass. */
  async live(): Promise<SecretRow[]> {
    return await prisma.channelConnection.findMany({
      where: { state: { not: CONNECTION_STATE.DISCONNECTED }, channel: { in: MARKETPLACES } },
      select: SECRETS,
    });
  },
};
