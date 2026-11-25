import { prisma } from "@server/shared/prisma";

import { CONNECTION_STATE } from "./channel-connection.types";
import { MARKETPLACES, SECRETS, type OrdersCheckRow, type SecretRow } from "./channel-connection.repository";
import { STOCK_SYNC } from "./channel-stock.types";
import type { SocialPlatform } from "./social/types";

/**
 * Read-only `ChannelConnection` projections for passes over many shops and for routing Meta's events.
 * Every write stays in `channel-connection.repository.ts`, the table's one writer (Invariant 5).
 */
export const connectionPassesRepository = {
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

  /** Connections with stock sync on, for the order check and the daily check (inventory-sync D4, D5). */
  async syncedConnections(): Promise<Array<{ id: string; orgId: string }>> {
    return await prisma.channelConnection.findMany({ where: { state: CONNECTION_STATE.CONNECTED, stockSync: STOCK_SYNC.ON }, select: { id: true, orgId: true } });
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

};
