import { prisma } from "@server/shared/prisma";
import { appUrl } from "@server/shared/app-url";
import { decryptSecret, encryptSecret, needsReencryption } from "@server/shared/crypto";
import { uniqueViolationFields } from "@server/shared/constraint";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { CHANNEL, CHANNEL_LABELS, type Channel } from "@server/shared/channels";
import { NotFoundError } from "@server/shared/domain-error";
import { orgChannelService } from "@server/listing/org-channel.service";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";

import { isOpen } from "./channel-availability";
import {
  CARD_STATE,
  CONNECT_RESULT,
  CONNECTION_ERROR,
  CONNECTION_STATE,
  MARKETPLACE_CHANNELS,
  READ_STALL_MS,
  READ_STATE,
  isMarketplaceChannel,
  type CardState,
  type ChannelAttentionDTO,
  type ChannelCardDTO,
  type ChannelsOverviewDTO,
  type ConnectResult,
  type ConnectStart,
  type ChannelReadDTO,
  type ConnectionError,
  type MarketplaceChannel,
  type ReadError,
  type ReadState,
} from "./channel-connection.types";
import { channelConnectionRepository, type ConnectionRow, type SealedGrant } from "./channel-connection.repository";
import { CONNECT_PURPOSE, signConnectState, verifyConnectState, type ConnectState } from "./connect-state";
import { MarketplaceAuthError, MarketplaceUnavailableError, type TokenGrant } from "./providers/marketplace-provider";
import { providerFor } from "./providers";
import { channelListingRepository } from "./channel-listing.repository";
import { listingReadSpec } from "./listing-read.job";
import type { StockSyncState } from "./channel-stock.types";

/**
 * A shop's connections to the marketplaces (channel-connectors). The only public surface of the
 * domain (D1): it answers cards and outcomes, never a credential.
 */

const DAY_MS = 86_400_000;
/** Amazon asks the shop to re-approve 365 days after consent; we warn 30 days ahead (Q10). */
const AMAZON_REAPPROVAL_DAYS = 365;
const RENEWAL_WARNING_DAYS = 30;
/** Renew an access token this close to expiry rather than use it (D8). */
const ACCESS_TOKEN_MARGIN_MS = 5 * 60_000;
/** Flipkart's refresh token is renewed when this little of it remains (D7). */
const REFRESH_RENEWAL_DAYS = 30;

const FEEDS: readonly Channel[] = [CHANNEL.GOOGLE, CHANNEL.META];

const callbackUrl = (channel: MarketplaceChannel) => `${appUrl()}/api/channels/${channel}/callback`;

const nameOf = (person: { name: string | null; email: string | null } | null) =>
  person ? (person.name ?? person.email ?? null) : null;

function reapproveBy(row: ConnectionRow): Date | null {
  if (row.channel !== CHANNEL.AMAZON || !row.authorizedAt) return null;
  return new Date(row.authorizedAt.getTime() + AMAZON_REAPPROVAL_DAYS * DAY_MS);
}

function seal(grant: TokenGrant): SealedGrant {
  return {
    accessToken: encryptSecret(grant.accessToken),
    accessTokenExpiresAt: grant.accessTokenExpiresAt,
    refreshToken: encryptSecret(grant.refreshToken),
    refreshTokenExpiresAt: grant.refreshTokenExpiresAt,
  };
}

const asReason = (error: MarketplaceAuthError): ConnectionError =>
  error.reason === "expired"
    ? CONNECTION_ERROR.EXPIRED
    : error.reason === "revoked"
      ? CONNECTION_ERROR.REVOKED
      : CONNECTION_ERROR.REJECTED;

function readOf(row: ConnectionRow): ChannelReadDTO | null {
  if (!row.readState) return null;
  return {
    state: row.readState as ReadState,
    total: row.readTotal,
    done: row.readDone,
    startedAt: row.readStartedAt?.toISOString() ?? null,
    finishedAt: row.readFinishedAt?.toISOString() ?? null,
    error: (row.readErrorCode as ReadError | null) ?? null,
    stalled: isStalled(row),
  };
}

/** Running, but silent long enough that its worker is presumed gone (channel-import D3). */
export function isStalled(row: { readState: string | null; readTouchedAt: Date | null }, now = Date.now()): boolean {
  return row.readState === READ_STATE.RUNNING && (!row.readTouchedAt || now - row.readTouchedAt.getTime() > READ_STALL_MS);
}

function marketplaceCard(
  channel: MarketplaceChannel,
  row: ConnectionRow | undefined,
  liveCount: number,
  now: Date,
  listings: { total: number; linked: number; toSettle: number } | null,
): ChannelCardDTO {
  const provider = providerFor(channel);
  const live = row !== undefined && row.state !== CONNECTION_STATE.DISCONNECTED;
  const due = row ? reapproveBy(row) : null;

  let state: CardState;
  if (row?.state === CONNECTION_STATE.NEEDS_RECONNECT) state = CARD_STATE.NEEDS_RECONNECT;
  else if (live && due && due.getTime() - now.getTime() <= RENEWAL_WARNING_DAYS * DAY_MS) state = CARD_STATE.RENEWAL_DUE;
  else if (live) state = CARD_STATE.CONNECTED;
  else if (!isOpen(channel) || !provider.configured()) state = CARD_STATE.UNAVAILABLE;
  else if (provider.connectionCap !== null && liveCount >= provider.connectionCap) state = CARD_STATE.FULL;
  else state = CARD_STATE.NOT_CONNECTED;

  return {
    channel,
    label: CHANNEL_LABELS[channel],
    state,
    connectedBy: nameOf(row?.connectedBy ?? null),
    connectedAt: row?.connectedAt?.toISOString() ?? null,
    disconnectedBy: row?.state === CONNECTION_STATE.DISCONNECTED ? nameOf(row.disconnectedBy) : null,
    disconnectedAt: row?.state === CONNECTION_STATE.DISCONNECTED ? (row.disconnectedAt?.toISOString() ?? null) : null,
    lastCheckedAt: live ? (row?.lastCheckedAt?.toISOString() ?? null) : null,
    stale: live && (!row?.lastCheckedAt || now.getTime() - row.lastCheckedAt.getTime() > DAY_MS),
    reapproveBy: live && due ? due.toISOString() : null,
    read: live && row ? readOf(row) : null,
    listings: live ? listings : null,
    // A refused account (channel-import Q10) says why even after it was disconnected.
    reason:
      row?.state === CONNECTION_STATE.NEEDS_RECONNECT ||
      (row?.state === CONNECTION_STATE.DISCONNECTED && row.lastErrorCode === CONNECTION_ERROR.OTHER_SHOP)
        ? (row.lastErrorCode as ConnectionError | null)
        : null,
    stockSync: live && row ? (row.stockSync as StockSyncState) : null,
  };
}

function plainCard(channel: Channel, state: CardState): ChannelCardDTO {
  return {
    channel,
    label: CHANNEL_LABELS[channel],
    state,
    connectedBy: null,
    connectedAt: null,
    disconnectedBy: null,
    disconnectedAt: null,
    lastCheckedAt: null,
    stale: false,
    read: null,
    listings: null,
    reapproveBy: null,
    reason: null,
    stockSync: null,
  };
}

export const channelConnectionService = {
  /** Every card on the Channels page, in display order, and what the dashboard should raise. */
  async overview(orgId: string, now = new Date()): Promise<ChannelsOverviewDTO> {
    const [rows, choices, counts] = await Promise.all([
      channelConnectionRepository.forOrg(orgId),
      orgChannelService.list(orgId),
      Promise.all(MARKETPLACE_CHANNELS.map((channel) => channelConnectionRepository.countLive(channel))),
    ]);
    const byChannel = new Map(rows.map((row) => [row.channel, row]));
    const enabled = new Set(choices.filter((choice) => choice.enabled).map((choice) => choice.channel));

    const listingCounts = await Promise.all(
      MARKETPLACE_CHANNELS.map(async (channel) => {
        const row = byChannel.get(channel);
        if (!row || row.state === CONNECTION_STATE.DISCONNECTED) return null;
        const { total, linked, toSettle } = await channelListingRepository.counts(row.id);
        return { total, linked, toSettle };
      }),
    );
    const marketplaces = MARKETPLACE_CHANNELS.map((channel, i) =>
      marketplaceCard(channel, byChannel.get(channel), counts[i], now, listingCounts[i]),
    );
    const cards = [
      plainCard(CHANNEL.STORE, CARD_STATE.ALWAYS_ON),
      ...marketplaces,
      ...FEEDS.map((channel) => plainCard(channel, enabled.has(channel) ? CARD_STATE.FEED_ON : CARD_STATE.FEED_OFF)),
    ];
    const attention: ChannelAttentionDTO[] = marketplaces.flatMap((card) =>
      card.state === CARD_STATE.RENEWAL_DUE || card.state === CARD_STATE.NEEDS_RECONNECT
        ? [{ channel: card.channel as MarketplaceChannel, label: card.label, state: card.state, reapproveBy: card.reapproveBy }]
        : [],
    );
    return { cards, attention };
  },

  /** Begin a connect, reconnect or renewal: off to the marketplace, or straight back (D5). */
  async startConnect(orgId: string, userId: string, channel: string): Promise<ConnectStart> {
    if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
    const provider = providerFor(channel);
    if (!isOpen(channel) || !provider.configured()) return { result: CONNECT_RESULT.UNAVAILABLE };

    const existing = await channelConnectionRepository.find(orgId, channel);
    const live = existing !== null && existing.state !== CONNECTION_STATE.DISCONNECTED;
    if (!live && provider.connectionCap !== null) {
      if ((await channelConnectionRepository.countLive(channel)) >= provider.connectionCap) {
        return { result: CONNECT_RESULT.FULL };
      }
    }

    const state = signConnectState({
      orgId,
      userId,
      channel,
      purpose: live ? CONNECT_PURPOSE.RECONNECT : CONNECT_PURPOSE.CONNECT,
    });
    return { redirectTo: provider.consentUrl(state, callbackUrl(channel)) };
  },

  /**
   * Read the `state` a marketplace sent back, before anything else is trusted. The route checks the
   * signed-in member against it, then calls `completeConnect`.
   */
  readReturn(channel: string, params: URLSearchParams) {
    if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
    const consent = providerFor(channel).readReturn(params);
    return { consent, check: verifyConnectState(consent.state) };
  },

  /** Finish a connect whose `state` verified and whose member the route has confirmed (R1–R3). */
  async completeConnect(
    state: ConnectState,
    consent: { code: string | null; state: string | null; declined: boolean; externalAccountId: string | null },
    now = new Date(),
  ): Promise<ConnectResult> {
    const { orgId, userId, channel, purpose } = state;
    if (consent.declined || !consent.code) return CONNECT_RESULT.CANCELLED;
    const provider = providerFor(channel);

    let grant: TokenGrant;
    try {
      grant = await provider.exchange(consent.code, callbackUrl(channel), consent.state);
      await provider.check(grant.accessToken);
    } catch (error) {
      if (error instanceof MarketplaceAuthError) return CONNECT_RESULT.EXPIRED;
      if (error instanceof MarketplaceUnavailableError) return CONNECT_RESULT.UNREACHABLE;
      throw error;
    }

    const existing = await channelConnectionRepository.find(orgId, channel);
    // Switching accounts is disconnect, then connect (Q8). Flipkart names no account, so it cannot tell.
    if (
      purpose === CONNECT_PURPOSE.RECONNECT &&
      existing?.externalAccountId &&
      consent.externalAccountId &&
      existing.externalAccountId !== consent.externalAccountId
    ) {
      return CONNECT_RESULT.DIFFERENT_ACCOUNT;
    }
    if (
      consent.externalAccountId &&
      (await channelConnectionRepository.liveElsewhere(channel, consent.externalAccountId, orgId))
    ) {
      return CONNECT_RESULT.OTHER_SHOP;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const { id } = await channelConnectionRepository.connect(tx, {
          orgId,
          channel,
          // Flipkart's consent names no account; a reconnect keeps the one its reads learned, so a
          // read can still tell a different account (channel-import D6). A fresh connect starts clean.
          externalAccountId:
            consent.externalAccountId ??
            (purpose === CONNECT_PURPOSE.RECONNECT ? (existing?.externalAccountId ?? null) : null),
          grant: seal(grant),
          userId,
          now,
        });
        await orgChannelService.setIn(tx, orgId, channel, true);
        // Connecting reads the shop's listings straight away (channel-import R1).
        await enqueue(tx, listingReadSpec, { connectionId: id, orgId });
        await recordAdminActionIn(tx, {
          adminId: userId,
          action: purpose === CONNECT_PURPOSE.RECONNECT ? "channel.reconnect" : "channel.connect",
          resource: "ChannelConnection",
          resourceId: id,
          metadata: { orgId, channel },
        });
      });
    } catch (error) {
      // Two shops consenting with one account at the same moment: the partial unique index decides.
      if (uniqueViolationFields(error) !== null) return CONNECT_RESULT.OTHER_SHOP;
      throw error;
    }
    return CONNECT_RESULT.CONNECTED;
  },

  /** Stop acting for the shop on this marketplace (R7). The listings there are left as they are. */
  async disconnect(orgId: string, userId: string, channel: string, now = new Date()): Promise<void> {
    if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
    await prisma.$transaction(async (tx) => {
      const done = await channelConnectionRepository.disconnect(tx, orgId, channel, userId, now);
      if (!done) throw new NotFoundError("Connection");
      await orgChannelService.setIn(tx, orgId, channel, false);
      await recordAdminActionIn(tx, {
        adminId: userId,
        action: "channel.disconnect",
        resource: "ChannelConnection",
        resourceId: done.id,
        metadata: { orgId, channel },
      });
    });
  },

  /**
   * A read found the account already connected to another shop (channel-import D6): the newcomer is
   * disconnected and its channel turned off, as a disconnect would, with the reason kept for the card.
   */
  async refuseOtherShop(connectionId: string, orgId: string, channel: MarketplaceChannel, now = new Date()): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await channelConnectionRepository.refuseOtherShop(tx, connectionId, CONNECTION_ERROR.OTHER_SHOP, now);
      await orgChannelService.setIn(tx, orgId, channel, false);
    });
  },

  /**
   * A still-valid access token from a row already read, or null when it must be renewed, which only
   * `accessToken` does, under its lock. Lets a batch read many connections' tokens in one query.
   */
  unexpiredAccessToken(row: { accessToken: string | null; accessTokenExpiresAt: Date | null }, now = new Date()): string | null {
    if (!row.accessToken || !row.accessTokenExpiresAt) return null;
    if (row.accessTokenExpiresAt.getTime() - now.getTime() <= ACCESS_TOKEN_MARGIN_MS) return null;
    return decryptSecret(row.accessToken);
  },

  /**
   * A batch's token source for a connection read with its sealed token: the stored one while it is
   * fresh, judged at each call; the locked renewal only when it is about to lapse, and once per batch.
   */
  tokenSource(row: { id: string; accessToken: string | null; accessTokenExpiresAt: Date | null }): () => Promise<string> {
    let renewed: string | null = null;
    return async () => renewed ?? this.unexpiredAccessToken(row) ?? (renewed = await this.accessToken(row.id));
  },

  /**
   * A valid access token for one connection, renewed first if it is about to lapse (D8). Inside
   * the domain only: later subfeatures call marketplace verbs through here, never with a token.
   */
  async accessToken(connectionId: string, now = new Date()): Promise<string> {
    return await prisma.$transaction(
      async (tx) => {
        const row = await channelConnectionRepository.lockSecrets(tx, connectionId);
        if (!row || row.state !== CONNECTION_STATE.CONNECTED || !row.refreshToken || !row.accessToken) {
          throw new NotFoundError("Connection");
        }
        if (row.accessTokenExpiresAt && row.accessTokenExpiresAt.getTime() - now.getTime() > ACCESS_TOKEN_MARGIN_MS) {
          return decryptSecret(row.accessToken);
        }
        const grant = await providerFor(row.channel as MarketplaceChannel).renew(decryptSecret(row.refreshToken));
        await channelConnectionRepository.saveGrant(tx, row.id, seal(grant));
        return grant.accessToken;
      },
      { timeout: 20_000 },
    );
  },

  /** "Check now", and the daily health check: one cheap read, recorded (Q13, D7). */
  async check(orgId: string, channel: string, now = new Date()): Promise<"ok" | "needs_reconnect" | "unreachable"> {
    if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
    const row = await channelConnectionRepository.secretsFor(orgId, channel);
    if (!row || row.state !== CONNECTION_STATE.CONNECTED) throw new NotFoundError("Connection");
    return await this.checkConnection(row.id, channel, now);
  },

  async checkConnection(id: string, channel: MarketplaceChannel, now = new Date()) {
    try {
      const token = await this.accessToken(id, now);
      await providerFor(channel).check(token);
      await channelConnectionRepository.markChecked(id, now);
      return "ok" as const;
    } catch (error) {
      if (error instanceof MarketplaceAuthError) {
        await channelConnectionRepository.markNeedsReconnect(id, asReason(error), now);
        return "needs_reconnect" as const;
      }
      if (error instanceof MarketplaceUnavailableError) return "unreachable" as const;
      throw error;
    }
  },

  /**
   * The daily job's pass over every live connection (D7): health check, Flipkart renewal ahead of
   * its 180-day lapse, and re-sealing under the current key. Suspended shops are skipped (Q11).
   */
  async maintain(isSuspended: (orgId: string) => Promise<boolean>, now = new Date()) {
    const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, failed: 0 };
    for (const row of await channelConnectionRepository.live()) {
      try {
        await this.maintainOne(row, isSuspended, summary, now);
      } catch (error) {
        // One bad row must not stop every other shop's renewal; the id is enough to find it.
        summary.failed++;
        console.error("[channels] maintain failed for connection", row.id, error instanceof Error ? error.name : "error");
      }
    }
    return summary;
  },

  async maintainOne(
    row: Awaited<ReturnType<typeof channelConnectionRepository.live>>[number],
    isSuspended: (orgId: string) => Promise<boolean>,
    summary: { checked: number; renewed: number; resealed: number; needsReconnect: number; unreachable: number; skipped: number },
    now: Date,
  ) {
    {
      if (await isSuspended(row.orgId)) {
        summary.skipped++;
        return;
      }
      const channel = row.channel as MarketplaceChannel;
      if (row.state !== CONNECTION_STATE.CONNECTED) return;

      if (
        row.refreshTokenExpiresAt &&
        row.refreshTokenExpiresAt.getTime() - now.getTime() < REFRESH_RENEWAL_DAYS * DAY_MS
      ) {
        try {
          await prisma.$transaction(async (tx) => {
            const locked = await channelConnectionRepository.lockSecrets(tx, row.id);
            if (!locked?.refreshToken) return;
            const grant = await providerFor(channel).renew(decryptSecret(locked.refreshToken));
            await channelConnectionRepository.saveGrant(tx, row.id, seal(grant));
          }, { timeout: 20_000 });
          summary.renewed++;
        } catch (error) {
          if (error instanceof MarketplaceAuthError) {
            await channelConnectionRepository.markNeedsReconnect(row.id, asReason(error), now);
            summary.needsReconnect++;
            return;
          }
          if (!(error instanceof MarketplaceUnavailableError)) throw error;
        }
      }

      const outcome = await this.checkConnection(row.id, channel, now);
      if (outcome === "ok") summary.checked++;
      else if (outcome === "needs_reconnect") summary.needsReconnect++;
      else summary.unreachable++;

      // Under the row lock, so a renewal racing this pass is never overwritten with older tokens.
      const resealed = await prisma.$transaction(async (tx) => {
        const locked = await channelConnectionRepository.lockSecrets(tx, row.id);
        if (!locked?.refreshToken || !needsReencryption(locked.refreshToken)) return false;
        await channelConnectionRepository.reseal(tx, row.id, {
          accessToken: locked.accessToken ? encryptSecret(decryptSecret(locked.accessToken)) : null,
          refreshToken: encryptSecret(decryptSecret(locked.refreshToken)),
        });
        return true;
      });
      if (resealed) summary.resealed++;
    }
  },
};
