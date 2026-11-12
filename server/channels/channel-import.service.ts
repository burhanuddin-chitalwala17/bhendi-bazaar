import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { uniqueViolationFields } from "@server/shared/constraint";
import { CHANNEL, CHANNEL_LABELS } from "@server/shared/channels";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { productService } from "@server/catalog/product.service";

import {
  LEFT_OFF_REASON,
  GROUP_STATE,
  type ListingGroupDTO,
  type LeftOffReason,
  CONNECTION_ERROR,
  CONNECTION_STATE,
  READ_ERROR,
  isMarketplaceChannel,
  type ChannelListingDTO,
  type ChannelListingDetailDTO,
  type ListingSuggestionDTO,
  SUGGESTION_KIND,
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
import { indexBySkuKey, mostSimilar, productForListing, skuKey, suggestGroups } from "./listing-match";
import { listingReadSpec } from "./listing-read.job";
import { channelLocationService } from "./channel-location.service";
import { marketplaceOrderRepository } from "./marketplace-order.repository";
import { STOCK_SYNC } from "./channel-stock.types";
import { lastSent } from "./stock-plan";
import { MarketplaceAuthError, MarketplaceRequestError, MarketplaceUnavailableError } from "./providers/marketplace-provider";
import { providerFor } from "./providers";
import { channelPlan } from "./channel-plan";

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

const toDto = (row: ListingRow, suggestion: ListingSuggestionDTO | null = null, marketplaceType: string | null = null): ChannelListingDTO => ({
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
  leftOff: row.leftOffAt !== null,
  waitingForType:
    row.leftOffAt !== null && row.leftOffReason === LEFT_OFF_REASON.NO_TYPE
      ? { marketplaceType: marketplaceType ?? "" }
      : null,
  gone: row.goneAt !== null,
  suggestion,
  photos:
    row.photoTotal !== null ? { total: row.photoTotal, done: row.photoDone ?? 0, failed: row.photoFailed ?? 0 } : null,
  problems: problemsOf(row),
});

/** The daily look's complaint, as the row's one line: its first sentence and how many more (Q23). */
function problemsOf(row: ListingRow): ChannelListingDTO["problems"] {
  const issues = Array.isArray(row.problems) ? (row.problems as Array<{ message?: unknown }>) : [];
  const first = issues.find((i) => typeof i.message === "string")?.message as string | undefined;
  return first ? { suppressed: row.suppressed, first, count: issues.length } : null;
}

/** What each variation group's header offers (family-merge D6): settle, make, add, or see its family. */
async function groupsOf(connectionId: string, rows: readonly ListingRow[]): Promise<Record<string, ListingGroupDTO>> {
  const parents = [...new Set(rows.map((r) => r.parentSku).filter((p): p is string => !!p))];
  const members = await channelListingRepository.groupsFor(connectionId, parents);
  const out: Record<string, ListingGroupDTO> = {};
  for (const parent of parents) {
    const mine = members.filter((m) => m.parentSku === parent);
    if (mine.length < 2) continue;
    const settled = mine.filter((m) => m.productId).length;
    const inFamily = mine.find((m) => m.product?.family);
    const family = inFamily?.product?.family ? { ...inFamily.product.family, productId: inFamily.productId! } : null;
    const outside = family ? mine.filter((m) => m.product?.familyId !== family.id).length : 0;
    const state =
      family ? (outside > 0 ? GROUP_STATE.ADD : GROUP_STATE.FAMILY) : settled === mine.length ? GROUP_STATE.MAKE : GROUP_STATE.SETTLE;
    out[parent] = { state, listingIds: mine.map((m) => m.id), total: mine.length, settled, family, outside };
  }
  return out;
}

/** The hint on each unsettled row (product-merge D3, Q24): the same SKU elsewhere first, then a similar name. */
async function suggestionsFor(orgId: string, connectionId: string, rows: readonly ListingRow[]) {
  const open = rows.filter((row) => !row.product && !row.leftOffAt && !row.goneAt);
  const out = new Map<string, ListingSuggestionDTO>();
  if (open.length === 0) return out;
  const [elsewhere, products] = await Promise.all([
    channelListingRepository.unsettledElsewhere(orgId, connectionId),
    productService.listForMatching(orgId),
  ]);
  const elsewhereBySku = new Map(elsewhere.map((row) => [row.skuKey, row]));
  for (const row of open) {
    const twin = elsewhereBySku.get(row.skuKey);
    if (twin && isMarketplaceChannel(twin.channel)) {
      out.set(row.id, { kind: SUGGESTION_KIND.SAME_SKU, text: CHANNEL_LABELS[twin.channel] });
      continue;
    }
    const [best] = row.title ? mostSimilar(row.title, products, 1) : [];
    if (best) out.set(row.id, { kind: SUGGESTION_KIND.SIMILAR_NAME, text: best.name });
  }
  return out;
}

/** Where a connection's listing read has got to, as the page and its progress poll both show it. */
function toReadDTO(row: Awaited<ReturnType<typeof connectionFor>>["row"]): ChannelReadDTO {
  return {
    state: (row.readState as ReadState | null) ?? null,
    total: row.readTotal,
    done: row.readDone,
    startedAt: row.readStartedAt?.toISOString() ?? null,
    finishedAt: row.readFinishedAt?.toISOString() ?? null,
    error: (row.readErrorCode as ReadError | null) ?? null,
    stalled: isStalled(row),
  };
}

async function connectionFor(orgId: string, channel: string) {
  if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
  const row = await channelConnectionRepository.find(orgId, channel);
  if (!row) throw new NotFoundError("Connection");
  return { row, channel };
}

export const channelImportService = {
  /**
   * Just the read's progress, for the listings page to poll while a read runs: one row, where a
   * re-render of the page re-ran every read on it every four seconds.
   */
  async readProgress(orgId: string, channel: string): Promise<ChannelReadDTO> {
    const { row } = await connectionFor(orgId, channel);
    return toReadDTO(row);
  },

  /** "Read again" (R2): queue a read; the job claims it, so a second tap does nothing extra (D3). */
  async requestRead(orgId: string, channel: string): Promise<void> {
    await channelPlan.assert(orgId);
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
      if (error instanceof MarketplaceRequestError) {
        // Not retried: the same request is refused the same way. The step and status go to the job log.
        await channelConnectionRepository.stopRead(connectionId, READ_ERROR.NOT_ALLOWED, at);
        return { claimed: true as const, stopped: READ_ERROR.NOT_ALLOWED, step: error.step, status: error.status };
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
    // Locations ride along with each read (inventory-sync Q15); a failure here never fails the read.
    await channelLocationService.refresh(connectionId, at).catch((error: unknown) => {
      console.error(`[channels] location read failed for ${connectionId}: ${error instanceof Error ? error.name : "error"}`);
    });
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
    const suggestions = filter === "notLinked" ? await suggestionsFor(orgId, row.id, listing.rows) : new Map<string, ListingSuggestionDTO>();
    const parked = listing.rows.filter((r) => r.leftOffReason === LEFT_OFF_REASON.NO_TYPE).map((r) => r.id);
    const types = await channelListingRepository.marketplaceTypes(parked);
    const [groups, anyFamily, ungrouped] = await Promise.all([
      groupsOf(row.id, listing.rows),
      channelListingRepository.anyInFamily(row.id),
      filter === "notLinked" && !search ? channelListingRepository.ungroupedUnsettled(row.id) : Promise.resolve([]),
    ]);
    // A few at a time: suggestions are a nudge, not a second to-do list (family-merge Q5).
    const sameItem = suggestGroups(ungrouped)
      .slice(0, 3)
      .map((g) => ({ listingIds: g.map((r) => r.id), titles: g.map((r) => r.title ?? r.sku) }));
    const read = toReadDTO(row);
    return {
      channel: marketplace,
      label: CHANNEL_LABELS[marketplace],
      connected: row.state === CONNECTION_STATE.CONNECTED,
      read,
      counts,
      showingLeftOff: filter === "leftOff",
      showingProblems: filter === "problems",
      listings: listing.rows.map((r) => toDto(r, suggestions.get(r.id) ?? null, types.get(r.id) ?? null)),
      hasMore: listing.hasMore,
      groups,
      firstFamily: !anyFamily,
      sameItem,
    };
  },

  /** The owner leaves an unsettled listing off Bhendi Bazaar (product-merge Q9). */
  async leaveOff(orgId: string, userId: string, id: string, reason: LeftOffReason | null = null): Promise<void> {
    await channelPlan.assert(orgId);
    if (!(await channelListingRepository.leaveOff(id, orgId, userId, new Date(), reason))) throw new NotFoundError("Unsettled listing");
  },

  /** "Not one item" on a suggested group (family-merge Q21). */
  async dismissFamilyHint(orgId: string, listingIds: readonly string[]): Promise<void> {
    await channelPlan.assert(orgId);
    if ((await channelListingRepository.dismissFamilyHint(listingIds, orgId, new Date())) === 0) throw new NotFoundError("Listing");
  },

  /** Back to the to-do (Q9). */
  async bringBack(orgId: string, id: string): Promise<void> {
    await channelPlan.assert(orgId);
    if (!(await channelListingRepository.bringBack(id, orgId))) throw new NotFoundError("Left-off listing");
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
    await channelPlan.assert(orgId);
    if (!(await channelListingRepository.unlink(id, orgId, userId, new Date()))) throw new NotFoundError("Linked listing");
  },

  /** Restore the SKU match the owner removed (Q16), and only that one. */
  async linkBack(orgId: string, id: string): Promise<ChannelListingDTO> {
    await channelPlan.assert(orgId);
    const row = await channelListingRepository.find(id, orgId);
    if (!row || !row.unlinkedAt) throw new NotFoundError("Unlinked listing");
    const productId = indexBySkuKey(await productService.listWithSku(orgId)).get(skuKey(row.sku));
    if (!productId) throw new ConflictError("No product here has this SKU any more, so there is nothing to link back to.");
    try {
      if (!(await channelListingRepository.linkBack(id, orgId, productId, new Date()))) throw new NotFoundError("Unlinked listing");
    } catch (error) {
      // One listing per marketplace per product (product-merge Q22): settled to another meanwhile.
      if (uniqueViolationFields(error) !== null) {
        throw new ConflictError("That product is already linked to another listing on this marketplace. Unlink that one first.");
      }
      throw error;
    }
    return await this.listing(orgId, id);
  },

  /** A product's "On marketplaces" block (R11): every connected marketplace, linked or not. */
  async linksForProduct(orgId: string, productId: string): Promise<ProductMarketplaceLinkDTO[]> {
    const [connections, rows, oversold] = await Promise.all([
      channelConnectionRepository.forOrg(orgId),
      channelListingRepository.forProduct(orgId, productId),
      marketplaceOrderRepository.latestOversold(productId),
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
                linkSource: row.linkSource as LinkSource | null,
                photos:
                  row.photoTotal !== null
                    ? { total: row.photoTotal, done: row.photoDone ?? 0, failed: row.photoFailed ?? 0 }
                    : null,
                stock:
                  c.stockSync === STOCK_SYNC.ON
                    ? {
                        sent: lastSent(row.stockSent).counts?.reduce((n, x) => n + x.quantity, 0) ?? null,
                        heldByMarketplace: lastSent(row.stockSent).held,
                        sentAt: row.stockSentAt?.toISOString() ?? null,
                        oversold: oversold && oversold.channel === channel ? { orderId: oversold.orderId } : null,
                      }
                    : null,
              }
            : null,
        };
      });
  },
};
