import { prisma } from "@server/shared/prisma";
import { enqueue, enqueueLater, type EnqueueTx } from "@server/shared/jobs/jobs.enqueue";
import { pushStockSpec } from "@server/shared/jobs/push-stock.job";
import { CHANNEL_LABELS } from "@server/shared/channels";
import { DomainError, NotFoundError } from "@server/shared/domain-error";
import { productService } from "@server/catalog/product.service";

import { CONNECTION_STATE, isMarketplaceChannel, type MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionRepository } from "./channel-connection.repository";
import { channelConnectionService } from "./channel-connection.service";
import { channelListingRepository } from "./channel-listing.repository";
import { channelLocationRepository } from "./channel-location.repository";
import { storedRead } from "./channel-facts.service";
import { STOCK_ATTENTION, STOCK_PROBLEM, STOCK_SYNC, type StockProblem, type StockAttentionDTO, type StockSyncSectionDTO, type StockSyncState } from "./channel-stock.types";
import { providerFor } from "./providers";
import { MarketplaceAuthError, MarketplaceUnavailableError } from "./providers/marketplace-provider";
import type { ListingStock, StockListingRef } from "./providers/stock";
import { countsFor, lastSent, sameCounts } from "./stock-plan";
import { stockCorrectionRepository } from "./stock-correction.repository";
import { checkOrdersSpec, ORDERS_CHECK_EVERY_SECONDS } from "./stock-checks.job";

/**
 * One stock figure per product, on every connected marketplace (inventory-sync): the push each stock
 * change enqueues, the switch and its preview, and the section that says where sync stands.
 */

type Locations = Awaited<ReturnType<typeof channelLocationRepository.forConnection>>;

const ref = (l: { sku: string; externalId: string | null; attributes: unknown }): StockListingRef => ({
  sku: l.sku,
  externalId: l.externalId,
  marketplaceType: storedRead(l.attributes)?.type ?? null,
});

/**
 * The owner must match before anything is sent (Q16): a live location with no match, one matched to a
 * shop location since closed, or none read yet, which is not the same as all matched.
 */
const unmatched = (locations: Locations) =>
  !locations.some((l) => l.goneAt === null) || locations.some((l) => l.goneAt === null && ((!l.orgAddressId && !l.notUsed) || l.closed));

const live = (l: { channel: string; connection: { state: string; stockSync: string } }) =>
  isMarketplaceChannel(l.channel) && l.connection.state === CONNECTION_STATE.CONNECTED && l.connection.stockSync === STOCK_SYNC.ON;

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 86_400_000;

/** Listings still waiting for their first send since sync went on: "Sending… 40 of 120". */
function sendingOf(state: string, listings: ReadonlyArray<{ stockSent: unknown }>): { sent: number; total: number } | null {
  if (state !== STOCK_SYNC.ON) return null;
  const waiting = listings.filter((l) => l.stockSent === null).length;
  return waiting === 0 ? null : { sent: listings.length - waiting, total: listings.length };
}

/** Listings whose last send the marketplace turned down, named on the section. */
const refusedOf = (listings: ReadonlyArray<{ stockSent: unknown }>) => listings.filter((l) => lastSent(l.stockSent).refused).length;

async function connectionOf(orgId: string, channel: string) {
  if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
  const connection = await channelConnectionRepository.find(orgId, channel);
  if (!connection) throw new NotFoundError("Connection");
  return { connection, channel: channel as MarketplaceChannel };
}

/**
 * Sync on, every linked product sent from scratch, and the order check started from now, so sales from
 * before sync are not taken again (Q24).
 */
async function start(connectionId: string, orgId: string): Promise<void> {
  await channelListingRepository.resetStockSent(connectionId);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    if (!(await channelConnectionRepository.setStockSync(tx, connectionId, orgId, STOCK_SYNC.ON, now, now.toISOString()))) throw new NotFoundError("Connection");
    await channelStockService.pushAllIn(tx, connectionId);
    await enqueueLater(tx, checkOrdersSpec, {}, { afterSeconds: 0, onePerSeconds: ORDERS_CHECK_EVERY_SECONDS });
  });
}

export const channelStockService = {
  /**
   * Send a product's count to every listing linked to it on a connection with sync on (D3). Under a
   * lock per product, with what was last sent read inside it, so two changes in quick succession send
   * in order and the last send is the count now; a send of the counts already there is skipped. A
   * busy marketplace throws, so the queue retries; a refused listing is recorded and the others still go.
   */
  async push(productId: string): Promise<{ sent: number }> {
    if (!(await channelListingRepository.linkedForPush(productId)).some(live)) return { sent: 0 };
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`stock:${productId}`}))`;
        const [listings, product] = await Promise.all([channelListingRepository.linkedForPush(productId, tx), productService.stockForPush(productId, tx)]);
        if (!product) return { sent: 0 };
        let sent = 0;
        for (const l of listings.filter(live)) {
          const counts = countsFor(await channelLocationRepository.forConnection(l.connectionId, tx), { archived: product.archivedAt !== null, stock: product.stockLocations });
          if (!counts) continue;
          const last = lastSent(l.stockSent);
          if (last.held) continue;
          const provider = providerFor(l.channel as MarketplaceChannel);
          const token = () => channelConnectionService.accessToken(l.connectionId);
          const now = new Date();
          try {
            // Before a listing's first send, ask whether the marketplace stocks it itself (FBA, Q5).
            if (!last.counts) {
              const theirs = await provider.readStock(token, l.connection.externalAccountId, ref(l));
              if (theirs.heldByMarketplace) {
                await channelListingRepository.recordStockSent(l.id, { heldByMarketplace: true }, now, tx);
                continue;
              }
              // Already showing our count: record it as sent, with no write to the marketplace.
              if (sameCounts(theirs.counts, counts)) {
                await channelListingRepository.recordStockSent(l.id, { counts }, now, tx);
                continue;
              }
            }
            if (sameCounts(last.counts, counts)) continue;
            await provider.setStock(token, l.connection.externalAccountId, ref(l), counts);
          } catch (error) {
            if (error instanceof MarketplaceUnavailableError) {
              // Outside the transaction, which this throw rolls back: the section says we keep trying.
              await channelConnectionRepository.setStockProblem(prisma, l.connectionId, STOCK_PROBLEM.BUSY);
              throw error;
            }
            if (error instanceof MarketplaceAuthError) await channelConnectionRepository.setStockProblem(tx, l.connectionId, STOCK_PROBLEM.REFUSED);
            // This listing alone was turned down: it stops reading "sending" and is named instead.
            else await channelListingRepository.recordStockSent(l.id, { refused: true }, now, tx);
            console.error(`[channels] stock push for listing ${l.id} failed: ${error instanceof MarketplaceAuthError ? "access refused" : error instanceof Error ? error.name : "error"}`);
            continue;
          }
          await channelListingRepository.recordStockSent(l.id, { counts }, now, tx);
          await channelConnectionRepository.touchStock(tx, l.connectionId, "stockSentAt", now);
          await channelConnectionRepository.setStockProblem(tx, l.connectionId, null);
          sent++;
        }
        return { sent };
      },
      { timeout: 60_000 },
    );
  },

  /**
   * A stock change, fanned out (inventory-sync D2, Q27): a push job for each product a live listing
   * would send, none for the rest. The push is unchanged: its lock, its skip of counts already sent,
   * its retry when a marketplace is busy, and a sold-out product going first (Q19).
   */
  async pushChanged(products: ReadonlyArray<{ productId: string; soldOut: boolean }>): Promise<number> {
    const live = await channelListingRepository.productsToPush(products.map((p) => p.productId));
    const toPush = products.filter((p) => live.has(p.productId));
    if (toPush.length === 0) return 0;
    await prisma.$transaction(async (tx) => {
      for (const p of toPush) await enqueue(tx, pushStockSpec, { productId: p.productId, soldOut: p.soldOut });
    });
    return toPush.length;
  },

  /** Every linked product on a connection sent again, after sync goes on or locations are matched (D3, Q16). */
  async pushAllIn(tx: EnqueueTx, connectionId: string): Promise<void> {
    const products = new Set((await channelListingRepository.linkedOn(connectionId)).map((l) => l.productId!));
    for (const productId of products) await enqueue(tx, pushStockSpec, { productId, soldOut: false });
  },

  /**
   * The daily check (D5, Q9): every linked listing's counts there against what we last sent; a
   * difference was made by hand there, so it is recorded and the listing sent again through the push,
   * under its lock, with the count as it is then.
   */
  async dailyCheck(connectionId: string): Promise<{ checked: number; corrected: number }> {
    const connection = await channelConnectionRepository.forRead(connectionId);
    if (!connection || !isMarketplaceChannel(connection.channel)) return { checked: 0, corrected: 0 };
    const full = await channelConnectionRepository.find(connection.orgId, connection.channel);
    if (!full || full.state !== CONNECTION_STATE.CONNECTED || full.stockSync !== STOCK_SYNC.ON) return { checked: 0, corrected: 0 };
    const listings = await channelListingRepository.linkedOn(connectionId);
    const provider = providerFor(connection.channel);
    const token = () => channelConnectionService.accessToken(connectionId);
    let checked = 0;
    let corrected = 0;
    for (const l of listings) {
      const last = lastSent(l.stockSent);
      // Not sent yet (a push is due) or stocked by the marketplace: nothing of ours to compare.
      if (last.held || !last.counts) continue;
      let theirs: ListingStock;
      try {
        theirs = await provider.readStock(token, connection.externalAccountId, ref(l));
      } catch (error) {
        if (error instanceof MarketplaceUnavailableError) throw error;
        continue;
      }
      checked++;
      if (theirs.heldByMarketplace) {
        await channelListingRepository.recordStockSent(l.id, { heldByMarketplace: true }, new Date());
        continue;
      }
      if (sameCounts(theirs.counts, last.counts)) continue;
      await channelListingRepository.forgetStockSent(l.id);
      await this.push(l.productId!);
      await stockCorrectionRepository.record({
        connectionId,
        orgId: connection.orgId,
        listingId: l.id,
        title: l.product?.name ?? l.title ?? l.sku,
        theirs: theirs.counts.reduce((n, c) => n + c.quantity, 0),
        ours: last.counts.reduce((n, c) => n + c.quantity, 0),
      });
      corrected++;
    }
    await channelConnectionRepository.touchStock(prisma, connectionId, "stockCheckedAt", new Date());
    return { checked, corrected };
  },

  async dailyCheckAll(): Promise<number> {
    const ids = await channelConnectionRepository.syncedConnections();
    for (const id of ids) {
      try {
        await this.dailyCheck(id);
      } catch (error) {
        console.error(`[channels] daily stock check for ${id} failed: ${error instanceof Error ? error.name : "error"}`);
      }
    }
    return ids.length;
  },

  /**
   * Sync starts on its own (Q28, superseding Q4): connecting means keeping the marketplace's counts
   * ours, so once every location is matched a connection still off is turned on. Paused stays paused.
   */
  async startIfReady(connectionId: string): Promise<boolean> {
    const connection = await channelConnectionRepository.syncOf(connectionId);
    if (!connection || connection.state !== CONNECTION_STATE.CONNECTED || connection.stockSync !== STOCK_SYNC.OFF) return false;
    if (unmatched(await channelLocationRepository.forConnection(connectionId))) return false;
    await start(connection.id, connection.orgId);
    return true;
  },

  /** "Turn back on" after a pause, from the Channels card: every linked product sent from scratch. */
  async turnOn(orgId: string, channelName: string): Promise<void> {
    const { connection } = await connectionOf(orgId, channelName);
    if (unmatched(await channelLocationRepository.forConnection(connection.id))) {
      throw new DomainError("Match your locations before stock can be sent.", { status: 409, field: "locations" });
    }
    await start(connection.id, orgId);
  },

  /** Pause, from the Channels card (Q28): nothing is sent until the shop turns it back on. */
  async pause(orgId: string, channelName: string): Promise<void> {
    const { connection } = await connectionOf(orgId, channelName);
    if (!(await channelConnectionRepository.setStockSync(prisma, connection.id, orgId, STOCK_SYNC.PAUSED, new Date()))) throw new NotFoundError("Connection");
  },

  /**
   * What Home flags (Q28): sync waiting on a location match, else listings our sends put out of stock
   * that the marketplace last showed in stock. A warning, never a gate (ADR-0053).
   */
  async attention(orgId: string): Promise<StockAttentionDTO | null> {
    const connections = (await channelConnectionRepository.forOrg(orgId)).filter(
      (c) => isMarketplaceChannel(c.channel) && c.state === CONNECTION_STATE.CONNECTED && c.stockSync !== STOCK_SYNC.PAUSED,
    );
    const zeroed: StockAttentionDTO[] = [];
    for (const c of connections) {
      const channel = c.channel as MarketplaceChannel;
      const locations = await channelLocationRepository.forConnection(c.id);
      if (locations.some((l) => l.goneAt === null) && unmatched(locations)) return { channel, label: CHANNEL_LABELS[channel], kind: STOCK_ATTENTION.MATCH, count: 0 };
      if (c.stockSync !== STOCK_SYNC.ON) continue;
      const count = (await channelListingRepository.sentAfterRead(c.id)).filter((l) => {
        const last = lastSent(l.stockSent);
        return !last.held && last.counts !== null && last.counts.every((x) => x.quantity === 0);
      }).length;
      if (count > 0) zeroed.push({ channel, label: CHANNEL_LABELS[channel], kind: STOCK_ATTENTION.OUT_OF_STOCK, count });
    }
    return zeroed[0] ?? null;
  },

  /** Where sync stands for one marketplace (ux.md "Stock sync section"). */
  async section(orgId: string, channelName: string): Promise<StockSyncSectionDTO> {
    const { connection, channel } = await connectionOf(orgId, channelName);
    // "Today" is the shop's day in India, whatever the server's clock zone.
    const today = new Date(Math.floor((Date.now() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS);
    const [locations, listings, corrections] = await Promise.all([
      channelLocationRepository.forConnection(connection.id),
      channelListingRepository.linkedOn(connection.id),
      stockCorrectionRepository.since(connection.id, today),
    ]);
    const fresh = locations.find((l) => l.goneAt === null && !l.orgAddressId && !l.notUsed && locations.some((o) => o.matchedAt !== null));
    return {
      channel,
      label: CHANNEL_LABELS[channel],
      state: connection.stockSync as StockSyncState,
      needsReconnect: connection.state === CONNECTION_STATE.NEEDS_RECONNECT,
      problem: (connection.stockProblem as StockProblem | null) ?? null,
      sending: sendingOf(connection.stockSync, listings),
      refused: connection.stockSync === STOCK_SYNC.ON ? refusedOf(listings) : 0,
      locationsToMatch: unmatched(locations),
      locationsRead: locations.some((l) => l.goneAt === null),
      newLocation: fresh ? { name: fresh.name, pincode: fresh.pincode } : null,
      sentAt: connection.stockSentAt?.toISOString() ?? null,
      checkedAt: connection.stockCheckedAt?.toISOString() ?? null,
      allHeldByMarketplace: listings.length > 0 && listings.every((l) => lastSent(l.stockSent).held),
      corrections: corrections.map((c) => ({ title: c.title, theirs: c.theirs, ours: c.ours, at: c.correctedAt.toISOString() })),
    };
  },
};
