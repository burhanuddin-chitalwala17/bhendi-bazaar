import { prisma } from "@server/shared/prisma";
import { CHANNEL_LABELS } from "@server/shared/channels";
import { stockService } from "@server/catalog/stock.service";

import { CONNECTION_STATE, isMarketplaceChannel, type MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionRepository } from "./channel-connection.repository";
import { channelConnectionService } from "./channel-connection.service";
import { channelListingRepository } from "./channel-listing.repository";
import { channelLocationRepository } from "./channel-location.repository";
import { STOCK_SYNC, type MarketplaceOrderDTO, type OrderLineState } from "./channel-stock.types";
import { marketplaceOrderRepository } from "./marketplace-order.repository";
import { providerFor } from "./providers";
import { MarketplaceAuthError } from "./providers/marketplace-provider";
import { ORDER_LINE_STATE } from "./providers/stock";
import { ORDERS_CHECK_GAP_MS } from "./stock-checks.job";

/**
 * Sales on a marketplace, brought in by the five-minute check (inventory-sync D4, D8): each line
 * recorded once, its stock taken from the matched location (never below zero; the rest flagged
 * oversold, Q7), a cancellation before dispatch put back once (Q8). The stock change then goes to
 * the other marketplaces through the push its stock command enqueues (D2).
 */
const CURSOR_REFRESH_MS = 60 * 60_000;

export const channelOrdersService = {
  async check(connectionId: string): Promise<{ lines: number; taken: number; oversold: number; restocked: number }> {
    const outcome = { lines: 0, taken: 0, oversold: 0, restocked: 0 };
    const full = await channelConnectionRepository.forOrders(connectionId);
    if (!full || !isMarketplaceChannel(full.channel) || full.state !== CONNECTION_STATE.CONNECTED || full.stockSync !== STOCK_SYNC.ON) return outcome;
    const connection = { ...full, channel: full.channel as MarketplaceChannel };

    let page;
    try {
      page = await providerFor(connection.channel).readOrders(() => channelConnectionService.accessToken(connectionId), connection.externalAccountId, full.ordersCursor);
    } catch (error) {
      // A refused credential will not come right on a retry; the section says reconnect.
      if (error instanceof MarketplaceAuthError) return outcome;
      throw error;
    }
    // A marketplace reports every order still waiting on every check: only a line that is new, or
    // whose state moved, is worth a transaction (Q23).
    const known = await marketplaceOrderRepository.known(connectionId, [...new Set(page.lines.map((l) => l.orderId))]);
    const changed = page.lines.filter((line) => {
      const row = known.find((k) => k.orderId === line.orderId && k.lineId === line.lineId);
      return !row || (row.state !== line.state && row.state !== ORDER_LINE_STATE.CANCELLED);
    });
    const [locations, listings] = changed.length
      ? await Promise.all([
          channelLocationRepository.forConnection(connectionId),
          channelListingRepository.bySkus(connectionId, [...new Set(changed.map((l) => l.sku))]),
        ])
      : [[], []];
    const fallback = locations.find((l) => l.goneAt === null && l.orgAddressId)?.orgAddressId ?? null;

    for (const line of changed) {
      outcome.lines++;
      const listing = listings.find((l) => l.sku === line.sku) ?? null;
      const matched = locations.find((l) => l.externalId === line.locationExternalId && l.orgAddressId);
      const orgAddressId = matched?.orgAddressId ?? fallback;
      const beforeSync = full.stockSyncChangedAt !== null && line.orderedAt < full.stockSyncChangedAt;
      await prisma.$transaction(async (tx) => {
        const { row, created } = await marketplaceOrderRepository.claim(tx, {
          connectionId,
          orgId: connection.orgId,
          channel: connection.channel,
          line,
          listingId: listing?.id ?? null,
          productId: listing?.productId ?? null,
          orgAddressId,
          // An unmatched marketplace location still lands on one count, flagged (Q18).
          locationGuessed: !matched && orgAddressId !== null,
          beforeSync,
        });
        if (created) {
          // A line first seen shipped still takes stock (a check missed it); one sold before sync does not (Q24).
          if (!beforeSync && line.state !== ORDER_LINE_STATE.CANCELLED && row.productId && row.orgAddressId) {
            const taken = await stockService.takeUpTo(row.productId, row.orgAddressId, line.quantity, tx);
            await marketplaceOrderRepository.recordTaken(tx, row.id, taken, taken < line.quantity);
            outcome.taken += taken;
            if (taken < line.quantity) outcome.oversold++;
          }
          return;
        }
        if (line.state === ORDER_LINE_STATE.CANCELLED && row.state !== ORDER_LINE_STATE.CANCELLED) {
          if (row.productId && row.orgAddressId && (await marketplaceOrderRepository.claimRestock(tx, row.id, new Date()))) {
            await stockService.release([{ productId: row.productId, orgAddressId: row.orgAddressId, quantity: row.taken }], tx);
            outcome.restocked++;
          } else {
            await marketplaceOrderRepository.setState(tx, row.id, ORDER_LINE_STATE.CANCELLED);
          }
          return;
        }
        if (line.state !== row.state && row.state !== ORDER_LINE_STATE.CANCELLED) await marketplaceOrderRepository.setState(tx, row.id, line.state);
      });
    }
    // A cursor is written when it moves and something came in, or hourly, so a quiet check writes nothing.
    const stale = !full.ordersCursor || Date.parse(page.cursor) - Date.parse(full.ordersCursor) > CURSOR_REFRESH_MS;
    if (page.cursor !== full.ordersCursor && (changed.length > 0 || stale)) await channelConnectionRepository.setOrdersCursor(connectionId, page.cursor);
    return outcome;
  },

  /**
   * The order check's run (Q23): claim every connection due, and only if one was, enqueue the next
   * run before checking, so a failure here never stops the chain. A run that claims none stops it.
   */
  async checkDue(next: () => Promise<unknown>): Promise<number> {
    const due = await channelConnectionRepository.claimDueOrdersChecks(new Date(), ORDERS_CHECK_GAP_MS);
    if (due.length === 0) return 0;
    await next();
    for (const id of due) {
      try {
        await this.check(id);
      } catch (error) {
        console.error(`[channels] order check for ${id} failed: ${error instanceof Error ? error.name : "error"}`);
      }
    }
    return due.length;
  },

  /** The Marketplace orders tab (Q10): read-only, newest first. */
  async page(orgId: string, pages: number): Promise<{ orders: MarketplaceOrderDTO[]; hasMore: boolean }> {
    const { rows, hasMore } = await marketplaceOrderRepository.page(orgId, Math.min(Math.max(1, pages), 40));
    return {
      orders: rows.map((r) => ({
        id: r.id,
        channel: r.channel as MarketplaceChannel,
        label: isMarketplaceChannel(r.channel) ? CHANNEL_LABELS[r.channel] : r.channel,
        orderId: r.orderId,
        sku: r.sku,
        quantity: r.quantity,
        amountPaise: r.amountPaise,
        state: r.state as OrderLineState,
        oversold: r.oversold,
        locationGuessed: r.locationGuessed,
        beforeSync: r.beforeSync,
        unlinked: r.productId === null,
        orderedAt: r.orderedAt.toISOString(),
      })),
      hasMore,
    };
  },
};
