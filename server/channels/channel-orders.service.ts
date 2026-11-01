import { prisma } from "@server/shared/prisma";
import { CHANNEL_LABELS } from "@server/shared/channels";
import { stockService } from "@server/catalog/stock.service";

import { CONNECTION_STATE, isMarketplaceChannel, type MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionRepository, type OrdersCheckRow } from "./channel-connection.repository";
import { channelConnectionService } from "./channel-connection.service";
import { channelListingRepository } from "./channel-listing.repository";
import { channelLocationRepository } from "./channel-location.repository";
import { STOCK_SYNC, type MarketplaceOrderDTO, type OrderLineState } from "./channel-stock.types";
import { marketplaceOrderRepository } from "./marketplace-order.repository";
import { providerFor } from "./providers";
import { MarketplaceAuthError } from "./providers/marketplace-provider";
import { ORDER_LINE_STATE, type MarketplaceOrderLine } from "./providers/stock";
import { ORDERS_CHECK_GAP_MS } from "./stock-checks.job";

/**
 * Sales on a marketplace, brought in by the ten-minute safety net (inventory-sync D4, D8, Q26):
 * each line recorded once, its stock taken from the matched location (never below zero; the rest
 * flagged oversold, Q7), a cancellation before dispatch put back once (Q8). The stock change then
 * goes to the other marketplaces through the push its stock command enqueues (D2).
 */
const CURSOR_REFRESH_MS = 60 * 60_000;
/** Marketplace reads in flight at once: each shop has its own rate limit, so this only spares the worker. */
export const READ_CONCURRENCY = 4;

type Outcome = { lines: number; taken: number; oversold: number; restocked: number };
type Read = { row: OrdersCheckRow & { channel: MarketplaceChannel }; lines: MarketplaceOrderLine[]; cursor: string };

const empty = (): Outcome => ({ lines: 0, taken: 0, oversold: 0, restocked: 0 });

/** Run `work` over `items`, at most `limit` at a time. */
async function inBatches<T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
}

export const channelOrdersService = {
  /** One connection's check, as the batch runs it: a marketplace failure is logged, not thrown. */
  async check(connectionId: string): Promise<Outcome> {
    const row = await channelConnectionRepository.forOrders(connectionId);
    return row ? ((await this.checkMany([row])).get(connectionId) ?? empty()) : empty();
  },

  /**
   * Every claimed connection's orders, at a database cost that does not grow with the number of
   * shops (Q26): marketplace reads per shop, then one read of the lines already recorded, a
   * transaction only per line that is new or moved, and one write of every moved cursor.
   */
  async checkMany(rows: readonly OrdersCheckRow[]): Promise<Map<string, Outcome>> {
    const outcomes = new Map<string, Outcome>();
    const live = rows.filter(
      (r): r is Read["row"] => isMarketplaceChannel(r.channel) && r.state === CONNECTION_STATE.CONNECTED && r.stockSync === STOCK_SYNC.ON,
    );

    const reads: Read[] = [];
    await inBatches(live, READ_CONCURRENCY, async (row) => {
      // The claim already holds the token, judged again on every call; only an expiring one takes the
      // locked renewal, and a renewed one serves the rest of this shop's read.
      let renewed: string | null = null;
      const token = async () =>
        renewed ?? channelConnectionService.unexpiredAccessToken(row) ?? (renewed = await channelConnectionService.accessToken(row.id));
      try {
        const page = await providerFor(row.channel).readOrders(token, row.externalAccountId, row.ordersCursor);
        reads.push({ row, lines: page.lines, cursor: page.cursor });
      } catch (error) {
        // One shop's failure is that shop's, an unreadable stored token included: its cursor stays,
        // so its next check reads the same span.
        const why = error instanceof MarketplaceAuthError ? "access refused" : error instanceof Error ? error.name : "error";
        console.error(`[channels] order check for ${row.id} failed: ${why}`);
      }
    });

    // A marketplace reports every order still waiting on every check: only a line that is new, or
    // whose state moved, is worth a transaction (Q23).
    const known = await marketplaceOrderRepository.knownForMany(
      new Map(reads.map((r) => [r.row.id, [...new Set(r.lines.map((l) => l.orderId))]])),
    );
    const cursors: { id: string; cursor: string; from: string | null }[] = [];
    for (const read of reads) {
      const mine = known.filter((k) => k.connectionId === read.row.id);
      const changed = read.lines.filter((line) => {
        const row = mine.find((k) => k.orderId === line.orderId && k.lineId === line.lineId);
        return !row || (row.state !== line.state && row.state !== ORDER_LINE_STATE.CANCELLED);
      });
      try {
        outcomes.set(read.row.id, await this.apply(read.row, changed));
      } catch (error) {
        console.error(`[channels] order lines for ${read.row.id} failed: ${error instanceof Error ? error.name : "error"}`);
        continue;
      }
      // A cursor moves when something came in, or hourly, so a quiet check writes nothing.
      const stale = !read.row.ordersCursor || Date.parse(read.cursor) - Date.parse(read.row.ordersCursor) > CURSOR_REFRESH_MS;
      if (read.cursor !== read.row.ordersCursor && (changed.length > 0 || stale)) cursors.push({ id: read.row.id, cursor: read.cursor, from: read.row.ordersCursor });
    }
    if (cursors.length > 0) await channelConnectionRepository.setOrdersCursors(cursors);
    return outcomes;
  },

  /** The new or moved lines of one connection: a transaction each, so cost follows real orders. */
  async apply(connection: Read["row"], changed: readonly MarketplaceOrderLine[]): Promise<Outcome> {
    const outcome = empty();
    if (changed.length === 0) return outcome;
    const connectionId = connection.id;
    const [locations, listings] = await Promise.all([
      channelLocationRepository.forConnection(connectionId),
      channelListingRepository.bySkus(connectionId, [...new Set(changed.map((l) => l.sku))]),
    ]);
    const fallback = locations.find((l) => l.goneAt === null && l.orgAddressId)?.orgAddressId ?? null;

    for (const line of changed) {
      outcome.lines++;
      const listing = listings.find((l) => l.sku === line.sku) ?? null;
      const matched = locations.find((l) => l.externalId === line.locationExternalId && l.orgAddressId);
      const orgAddressId = matched?.orgAddressId ?? fallback;
      const beforeSync = connection.stockSyncChangedAt !== null && line.orderedAt < connection.stockSyncChangedAt;
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
    return outcome;
  },

  /**
   * The safety net's run (Q23, Q26): claim every connection due, and only if one was, enqueue the
   * next run before checking, so a failure here never stops the chain. A run that claims none stops it.
   */
  async checkDue(next: () => Promise<unknown>): Promise<number> {
    const due = await channelConnectionRepository.claimDueOrdersChecks(new Date(), ORDERS_CHECK_GAP_MS);
    if (due.length === 0) return 0;
    await next();
    await this.checkMany(due);
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
