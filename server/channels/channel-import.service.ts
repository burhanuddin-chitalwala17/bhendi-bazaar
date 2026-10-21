import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { uniqueViolationFields } from "@server/shared/constraint";
import { CHANNEL, CHANNEL_LABELS } from "@server/shared/channels";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { productService } from "@server/catalog/product.service";

import {
  CONNECTION_ERROR,
  CONNECTION_STATE,
  READ_ERROR,
  isMarketplaceChannel,
  type ChannelListingDTO,
  type ChannelListingDetailDTO,
  type ChannelListingsPageDTO,
  type ChannelReadDTO,
  type LinkSource,
  type ListingStatus,
  type MarketplaceChannel,
  type ProductMarketplaceLinkDTO,
  type ReadError,
  type ReadState,
} from "./channel-connection.types";
import { channelConnectionRepository } from "./channel-connection.repository";
import { channelConnectionService, isStalled } from "./channel-connection.service";
import { channelListingRepository, type ListingFilter, type ListingRow } from "./channel-listing.repository";
import { indexBySkuKey, productForListing, skuKey } from "./listing-match";
import { listingReadSpec } from "./listing-read.job";
import { MarketplaceAuthError, MarketplaceUnavailableError } from "./providers/marketplace-provider";
import { providerFor } from "./providers";

/**
 * Reading a shop's marketplace listings into its inbox and linking them by SKU (channel-import).
 * Nothing is written to a marketplace and no product is created (Q2).
 */

/** A read that must stop without retrying: the account belongs elsewhere, or is not the one connected. */
class ReadRefused extends Error {
  constructor(readonly code: ReadError) {
    super(`Listing read refused (${code})`);
    this.name = "ReadRefused";
  }
}

const toDto = (row: ListingRow): ChannelListingDTO => ({
  id: row.id,
  sku: row.sku,
  externalId: row.externalId,
  title: row.title,
  imageUrl: row.imageUrl,
  status: row.status as ListingStatus | null,
  pricePaise: row.pricePaise,
  quantity: row.quantity,
  parentSku: row.parentSku,
  parentTitle: row.parentTitle,
  variationAxis: row.variationAxis,
  product: row.product
    ? { id: row.product.id, name: row.product.name, sku: row.product.sku, archived: row.product.archivedAt !== null }
    : null,
  linkSource: row.linkSource as LinkSource | null,
  unlinkedByOwner: row.unlinkedAt !== null,
  gone: row.goneAt !== null,
});

async function connectionFor(orgId: string, channel: string) {
  if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
  const row = await channelConnectionRepository.find(orgId, channel);
  if (!row) throw new NotFoundError("Connection");
  return { row, channel };
}

export const channelImportService = {
  /** "Read again" (R2): queue a read; the job claims it, so a second tap does nothing extra (D3). */
  async requestRead(orgId: string, channel: string): Promise<void> {
    const { row } = await connectionFor(orgId, channel);
    if (row.state !== CONNECTION_STATE.CONNECTED) throw new ConflictError("Reconnect this marketplace before reading its listings.");
    await prisma.$transaction(async (tx) => {
      await enqueue(tx, listingReadSpec, { connectionId: row.id, orgId });
    });
  },

  /** The worker's read of one connection (D3–D9). Returns what it did, for the job's log line. */
  async runRead(connectionId: string, now = new Date()) {
    const startedAt = now;
    if (!(await channelConnectionRepository.claimRead(connectionId, startedAt))) return { claimed: false as const };
    const connection = await channelConnectionRepository.forRead(connectionId);
    if (!connection || !isMarketplaceChannel(connection.channel)) return { claimed: false as const };
    const channel = connection.channel;
    const target = { id: connection.id, orgId: connection.orgId, channel };

    const products = await productService.listWithSku(connection.orgId);
    const bySkuKey = indexBySkuKey(products);
    let seen = 0;
    let linked = 0;

    try {
      await providerFor(channel).readListings(
        () => channelConnectionService.accessToken(connectionId),
        connection.externalAccountId,
        {
          alive: () => channelConnectionRepository.heartbeatRead(connectionId, new Date()),
          account: async (accountId) => {
            if (connection.externalAccountId === accountId) return;
            // Amazon's id is known from consent; this path is Flipkart's first read (Q10).
            if (connection.externalAccountId && connection.externalAccountId !== accountId) {
              throw new ReadRefused(READ_ERROR.DIFFERENT_ACCOUNT);
            }
            try {
              await channelConnectionRepository.setExternalAccountId(connectionId, accountId);
            } catch (error) {
              if (uniqueViolationFields(error) !== null) throw new ReadRefused(READ_ERROR.OTHER_SHOP);
              throw error;
            }
          },
          batch: async (rows, progress) => {
            await channelListingRepository.upsertSeen(target, rows, startedAt);
            seen += rows.length;
            if (rows.length > 0) {
              const keys = [...new Set(rows.map((row) => row.skuKey))];
              const candidates = await channelListingRepository.linkable(connectionId, keys);
              const links = candidates.flatMap((row) => {
                const productId = productForListing({ skuKey: row.skuKey, productId: null, unlinkedAt: null }, bySkuKey);
                return productId ? [{ id: row.id, productId }] : [];
              });
              linked += await channelListingRepository.linkBySku(links, new Date());
            }
            await channelConnectionRepository.touchRead(connectionId, progress, new Date());
          },
        },
      );
    } catch (error) {
      const at = new Date();
      if (error instanceof ReadRefused) {
        if (error.code === READ_ERROR.OTHER_SHOP) {
          await channelConnectionService.refuseOtherShop(connectionId, connection.orgId, channel, at);
        } else {
          await channelConnectionRepository.stopRead(connectionId, error.code, at);
        }
        return { claimed: true as const, stopped: error.code };
      }
      if (error instanceof MarketplaceAuthError) {
        await channelConnectionRepository.stopRead(connectionId, READ_ERROR.AUTH, at);
        await channelConnectionRepository.markNeedsReconnect(
          connectionId,
          error.reason === "expired" ? CONNECTION_ERROR.EXPIRED : error.reason === "revoked" ? CONNECTION_ERROR.REVOKED : CONNECTION_ERROR.REJECTED,
          at,
        );
        return { claimed: true as const, stopped: READ_ERROR.AUTH };
      }
      if (error instanceof MarketplaceUnavailableError) {
        // The job's own retries resume it; rows already read stay, and nothing is marked gone (D8, D9).
        await channelConnectionRepository.stopRead(connectionId, READ_ERROR.BUSY, at);
        throw error;
      }
      await channelConnectionRepository.stopRead(connectionId, READ_ERROR.BUSY, at);
      throw error;
    }

    const at = new Date();
    const gone = await channelListingRepository.markGone(connectionId, startedAt, at);
    await channelConnectionRepository.finishRead(connectionId, seen, at);
    return { claimed: true as const, seen, linked, gone };
  },

  /** The Listings page (ux.md): one marketplace's rows, a tab, a search, a page of fifty. */
  async listingsPage(
    orgId: string,
    channel: string,
    filter: ListingFilter,
    search: string | null,
    pages: number,
  ): Promise<ChannelListingsPageDTO> {
    const { row, channel: marketplace } = await connectionFor(orgId, channel);
    const [counts, listing] = await Promise.all([
      channelListingRepository.tabCounts(row.id),
      channelListingRepository.page(row.id, filter, search?.trim() || null, Math.min(Math.max(1, pages), 40)),
    ]);
    const read: ChannelReadDTO = {
      state: (row.readState as ReadState | null) ?? null,
      total: row.readTotal,
      done: row.readDone,
      startedAt: row.readStartedAt?.toISOString() ?? null,
      finishedAt: row.readFinishedAt?.toISOString() ?? null,
      error: (row.readErrorCode as ReadError | null) ?? null,
      stalled: isStalled(row),
    };
    return {
      channel: marketplace,
      label: CHANNEL_LABELS[marketplace],
      connected: row.state === CONNECTION_STATE.CONNECTED,
      read,
      counts: { linked: counts.linked, notLinked: counts.notLinked },
      listings: listing.rows.map(toDto),
      hasMore: listing.hasMore,
    };
  },

  async listing(orgId: string, id: string): Promise<ChannelListingDTO> {
    const row = await channelListingRepository.find(id, orgId);
    if (!row) throw new NotFoundError("Listing");
    return toDto(row);
  },

  /** One listing beside the product's own values, for the details panel (Q17). Null when not this shop's. */
  async detail(orgId: string, id: string): Promise<ChannelListingDetailDTO | null> {
    const row = await channelListingRepository.find(id, orgId);
    if (!row) return null;
    const product = row.productId ? await productService.compareFacts(orgId, row.productId) : null;
    let linkBackTo: ChannelListingDetailDTO["linkBackTo"] = null;
    if (!row.productId && row.unlinkedAt) {
      const match = (await productService.listWithSku(orgId)).find((p) => p.sku && skuKey(p.sku) === row.skuKey);
      linkBackTo = match ? { id: match.id, name: match.name } : null;
    }
    return { listing: toDto(row), product, linkBackTo };
  },

  /** The owner unlinks (Q5): back to Not linked, and never linked again by a read. */
  async unlink(orgId: string, userId: string, id: string): Promise<void> {
    if (!(await channelListingRepository.unlink(id, orgId, userId, new Date()))) throw new NotFoundError("Linked listing");
  },

  /** Restore the SKU match the owner removed (Q16), and only that one. */
  async linkBack(orgId: string, id: string): Promise<ChannelListingDTO> {
    const row = await channelListingRepository.find(id, orgId);
    if (!row || !row.unlinkedAt) throw new NotFoundError("Unlinked listing");
    const productId = indexBySkuKey(await productService.listWithSku(orgId)).get(skuKey(row.sku));
    if (!productId) throw new ConflictError("No product here has this SKU any more, so there is nothing to link back to.");
    await channelListingRepository.linkBack(id, orgId, productId, new Date());
    return await this.listing(orgId, id);
  },

  /** A product's "On marketplaces" block (R11): every connected marketplace, linked or not. */
  async linksForProduct(orgId: string, productId: string): Promise<ProductMarketplaceLinkDTO[]> {
    const [connections, rows] = await Promise.all([
      channelConnectionRepository.forOrg(orgId),
      channelListingRepository.forProduct(orgId, productId),
    ]);
    return connections
      .filter((c) => c.state !== CONNECTION_STATE.DISCONNECTED && isMarketplaceChannel(c.channel))
      .sort((a, b) => (a.channel === CHANNEL.AMAZON ? -1 : b.channel === CHANNEL.AMAZON ? 1 : 0))
      .map((c) => {
        const channel = c.channel as MarketplaceChannel;
        const row = rows.find((r) => r.connectionId === c.id);
        return {
          channel,
          label: CHANNEL_LABELS[channel],
          needsReconnect: c.state === CONNECTION_STATE.NEEDS_RECONNECT,
          listing: row
            ? {
                id: row.id,
                externalId: row.externalId,
                status: row.status as ListingStatus | null,
                pricePaise: row.pricePaise,
                quantity: row.quantity,
                gone: row.goneAt !== null,
              }
            : null,
        };
      });
  },
};
