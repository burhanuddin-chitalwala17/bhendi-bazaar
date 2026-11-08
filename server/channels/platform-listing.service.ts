import { CHANNEL_LABELS } from "@server/shared/channels";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { productService } from "@server/catalog/product.service";
import { channelMapRepository } from "@server/listing/channel-map.repository";
import { orgListingDefaultsService } from "@server/listing/org-listing-defaults.service";
import { FACT_DECLARATIONS, type FactKey } from "@server/listing/listing-facts";

import { CONNECTION_STATE, isMarketplaceChannel, type MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionRepository } from "./channel-connection.repository";
import { channelListingRepository } from "./channel-listing.repository";
import { storedRead } from "./channel-facts.service";
import {
  complainedFields,
  computeListing,
  fixesOf,
  type FactFor,
  listingStatus,
  masterValues,
  ownFields,
  parseOverrides,
  parseSent,
  seedOverrides,
  snapshot,
  toWholeRupees,
  waitingFields,
} from "./listing-plan";
import { platformListingRepository, type PlatformListingRow } from "./platform-listing.repository";
import {
  ISSUE_NEED,
  type ListingIssue,
  type ListingField,
  type ListingOverrides,
  type ListingPhotoDTO,
  type ListingRules,
  type ListingScreenDTO,
  type ListingStatusDTO,
  type ListingValues,
  type ProductListingSummaryDTO,
  type TheirValuesDTO,
} from "./platform-listing.types";
import { providerFor } from "./providers";
import { listingCreateService } from "./listing-create.service";
import { complaintIssues, type ListingComplaint } from "./listing-complaints";
import { genericFor } from "./generic-brand";

/**
 * Each product's listing on each connected marketplace (channel-listings): made with what is live,
 * computed from the product, saved as only what differs. Publishing it is listing-publish.service.
 */

type Product = Awaited<ReturnType<typeof productService.forListing>>[number];
type Mirror = Awaited<ReturnType<typeof channelListingRepository.mirrorsFor>>[number];
type Connection = NonNullable<Awaited<ReturnType<typeof channelConnectionRepository.find>>>;

export async function connectionFor(orgId: string, channel: string): Promise<{ connection: Connection; channel: MarketplaceChannel }> {
  if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
  const connection = await channelConnectionRepository.find(orgId, channel);
  if (!connection) throw new NotFoundError("Connection");
  return { connection, channel };
}

/** What the marketplace shows now, from the mirror and its stored read (Q9). */
export function theirsOf(channel: MarketplaceChannel, mirror: Mirror | undefined): TheirValuesDTO {
  if (!mirror) return { title: null, price: null, features: null, description: null, readAt: null };
  const read = storedRead(mirror.attributes);
  const fromRead = read ? providerFor(channel).theirsFromRead(read) : {};
  return {
    title: mirror.title,
    price: mirror.pricePaise,
    features: fromRead.features ?? null,
    description: fromRead.description ?? null,
    readAt: (mirror.attributesReadAt ?? mirror.lastSeenAt).toISOString(),
  };
}

const known = (theirs: TheirValuesDTO): Partial<ListingValues> => ({
  ...(theirs.title ? { title: theirs.title } : {}),
  ...(theirs.price ? { price: theirs.price } : {}),
  ...(theirs.features ? { features: theirs.features } : {}),
  ...(theirs.description ? { description: theirs.description } : {}),
});

/** Only the fields this marketplace takes, from a set of values. */
const writableOnly = (values: Partial<ListingValues>, rules: ListingRules): ListingOverrides =>
  Object.fromEntries(Object.entries(values).filter(([f]) => rules.writable.includes(f as never))) as ListingOverrides;

/**
 * Make a row for each linked product that has none, with what is live (D3): the marketplace's copy
 * kept wherever it differs, and `sent` as the computed listing, so nothing waits.
 */
export async function ensure(orgId: string, connection: Connection, channel: MarketplaceChannel, productIds: readonly string[]): Promise<void> {
  if (productIds.length === 0) return;
  const [products, mirrors, rows] = await Promise.all([
    productService.forListing(orgId, productIds),
    channelListingRepository.mirrorsFor(connection.id, productIds),
    platformListingRepository.forProducts(connection.id, productIds),
  ]);
  const has = new Set(rows.map((r) => r.productId));
  // A draft the marketplace now has (a create, or a product made in Seller Hub and read): link its mirror.
  for (const row of rows) {
    const mirror = row.channelListingId === null ? mirrors.find((m) => m.productId === row.productId) : undefined;
    if (mirror) await platformListingRepository.attachMirror(row.id, mirror.id);
  }
  const rules = providerFor(channel).listingRules;
  const seeds = products.flatMap((product) => {
    const mirror = mirrors.find((m) => m.productId === product.id);
    if (!mirror || has.has(product.id)) return [];
    const master = masterValues(product);
    const overrides = seedOverrides(master, writableOnly(known(theirsOf(channel, mirror)), rules));
    return [{
      orgId,
      channel,
      connectionId: connection.id,
      productId: product.id,
      channelListingId: mirror.id,
      overrides,
      sent: snapshot(computeListing(master, overrides), rules.writable),
    }];
  });
  await platformListingRepository.seed(seeds, new Date());
}

const issuesOf = (raw: unknown): ListingIssue[] => (Array.isArray(raw) ? (raw as ListingIssue[]) : []);

/** Where a row stands, against its product (publish Q4). */
export function statusOf(row: PlatformListingRow, product: Product, rules: ListingRules, resend: readonly ListingField[] = []): { status: ListingStatusDTO; values: ListingValues; waiting: ReturnType<typeof waitingFields> } {
  const computed = computeListing(masterValues(product), parseOverrides(row.overrides, product.media));
  // A whole-rupee marketplace holds the rounded price, so that is what is compared and sent (channel-listings Q13).
  const values = rules.wholeRupees ? { ...computed, price: toWholeRupees(computed.price) } : computed;
  const sent = parseSent(row.sent, product.media);
  // Only once on the marketplace: a draft has nothing there to complain of.
  const waiting = waitingFields(values, sent, rules.writable, row.channelListingId !== null ? resend : []);
  return {
    values,
    waiting,
    status: listingStatus({
      onMarketplace: row.channelListingId !== null,
      publishState: row.publishState,
      waiting: waiting.length,
      issues: issuesOf(row.issues).length,
      listed: sent?.listed ?? true,
      publishedAt: row.publishedAt,
      checkedAt: row.checkedAt,
      nextCheckAt: row.nextCheckAt,
    }),
  };
}

function photosOf(product: Product, rules: ListingRules): ListingPhotoDTO[] {
  return product.media.map((m) => {
    const small = rules.photo.minPx !== null && m.asset?.width && m.asset.height ? Math.max(m.asset.width, m.asset.height) < rules.photo.minPx : false;
    // A format the marketplace refuses is converted at the send (listing-photos-out), so it warns of size only.
    // A photo with no stored asset cannot be converted and goes only where its format is taken.
    const format = !m.assetId && rules.photo.formats.length > 0 && !!m.asset?.mimeType && !rules.photo.formats.includes(m.asset.mimeType);
    return { id: m.ref, url: m.ref, width: m.asset?.width ?? null, height: m.asset?.height ?? null, warning: format ? "format" : small ? "small" : null };
  });
}

async function productOf(orgId: string, productId: string): Promise<Product> {
  const [product] = await productService.forListing(orgId, [productId]);
  if (!product) throw new NotFoundError("Product");
  return product;
}

/**
 * Which fact a complained-of attribute is, read from the mapping only when a complaint needs it (Q24).
 * A live listing has no draft type, so every publishing type of the product's type is searched.
 */
async function factsFor(channel: MarketplaceChannel, product: Product, theirCategory: string | null, issues: readonly ListingIssue[]): Promise<FactFor> {
  const none: FactFor = () => null;
  if (!product.productType || !issues.some((i) => i.attribute && i.field === null && !i.need)) return none;
  const { attributes } = await channelMapRepository.registersFor({ channels: [channel], productTypes: [product.productType], lists: [] });
  return (attribute) => {
    const row = attributes.find((a) => (!theirCategory || a.theirCategory === theirCategory) && a.theirAttribute.split(".")[0] === attribute);
    if (!row) return null;
    const entry = (product.facts as Record<string, { value?: unknown } | undefined> | null)?.[row.fact];
    const answered = entry?.value !== undefined && entry.value !== null && entry.value !== "";
    return { label: FACT_DECLARATIONS[row.fact as FactKey]?.label ?? row.fact, answered };
  };
}

/** A send's own answer is the newer word; with none, the daily look's complaint shows on the same fields (Q23). */
function shownIssues(row: { issues: unknown }, mirror: { problems: unknown; problemsSince: Date | null } | undefined): ListingIssue[] {
  const daily = mirror?.problemsSince != null && issuesOf(mirror.problems).length > 0;
  return issuesOf(row.issues).length > 0 || !daily ? issuesOf(row.issues) : issuesOf(mirror!.problems);
}

export const platformListingService = {
  /** The listing screen (ux.md), made with what is live the first time it opens (D3). */
  async screen(orgId: string, productId: string, channelName: string): Promise<ListingScreenDTO> {
    const { connection, channel } = await connectionFor(orgId, channelName);
    const product = await productOf(orgId, productId);
    await ensure(orgId, connection, channel, [productId]);
    const [[row], [mirror]] = await Promise.all([
      platformListingRepository.forProducts(connection.id, [productId]),
      channelListingRepository.mirrorsFor(connection.id, [productId]),
    ]);
    if (!row) throw new NotFoundError("Listing");
    const rules = providerFor(channel).listingRules;
    // Registered on Amazon or listed as Generic is the brand's own (listing-model Q10); a brandless product keeps the shop's.
    const generic = rules.genericBrand && (await genericFor(orgId, product.brand, (await orgListingDefaultsService.get(orgId)).amazonGeneric));
    const overrides = parseOverrides(row.overrides, product.media);
    const daily = mirror?.problemsSince != null && issuesOf(mirror.problems).length > 0;
    const { status, values, waiting } = statusOf(row, product, rules, daily ? complainedFields(mirror!.problems) : []);
    const issues = shownIssues(row, mirror);
    return {
      id: row.id,
      version: row.version,
      channel,
      label: CHANNEL_LABELS[channel],
      productId,
      productName: product.name,
      externalId: mirror?.externalId ?? row.targetExternalId,
      values,
      own: ownFields(overrides),
      product: masterValues(product),
      theirs: theirsOf(channel, mirror),
      rules,
      photos: photosOf(product, rules),
      locked: {
        mrpPaise: product.mrpPaise,
        barcode: product.barcode,
        brand: product.brand?.name ?? null,
        stock: product.stockLocations.reduce((sum, s) => sum + s.quantity, 0),
      },
      generic,
      status,
      waitingFields: waiting,
      issues,
      // Listing as Generic, the brand's own name is not asked: its maker and packer still are (Q35).
      ...fixesOf(generic ? issues.filter((i) => i.need !== ISSUE_NEED.BRAND_NAME) : issues, product.mrpPaise !== null, await factsFor(channel, product, row.marketplaceType, issues)),
      marketplaceProblems: issuesOf(row.issues).length === 0 && daily ? { suppressed: mirror!.suppressed } : null,
      showing: (row.showing as ListingScreenDTO["showing"]) ?? null,
      draft: row.channelListingId === null && row.createMode ? await listingCreateService.draftInfo(orgId, row, product, channel) : null,
    };
  },

  /**
   * What the listing screen shows as errors, in the shape requests reads (setup-requests Q36): the
   * shop's "Raise a request" hands over exactly what it sees, never a list from the browser.
   */
  async complaint(orgId: string, productId: string, channelName: string): Promise<ListingComplaint | null> {
    const { connection, channel } = await connectionFor(orgId, channelName);
    await productOf(orgId, productId);
    const [[row], [mirror]] = await Promise.all([
      platformListingRepository.forProducts(connection.id, [productId]),
      channelListingRepository.mirrorsFor(connection.id, [productId]),
    ]);
    if (!row) throw new NotFoundError("Listing");
    const issues = complaintIssues(shownIssues(row, mirror));
    if (issues.length === 0) return null;
    return { orgId, productId, channel, productType: null, kind: null, theirCategory: row.marketplaceType, issues };
  },

  /**
   * Save the listing's own values (R1, R2, D4): a field absent is the product's. Fields the
   * marketplace cannot take and photos the product does not have are dropped. Compared on the
   * version the screen opened at; a stale save is refused with the conflict copy.
   */
  async save(orgId: string, productId: string, channelName: string, input: { seenVersion: number; overrides: ListingOverrides }): Promise<{ version: number; waiting: number }> {
    const { connection, channel } = await connectionFor(orgId, channelName);
    const product = await productOf(orgId, productId);
    const [row] = await platformListingRepository.forProducts(connection.id, [productId]);
    if (!row) throw new NotFoundError("Listing");
    const rules = providerFor(channel).listingRules;
    const own = writableOnly(input.overrides, rules);
    if (own.photos) own.photos = own.photos.filter((ref) => product.media.some((m) => m.ref === ref));
    if (own.photos?.length === 0) delete own.photos;
    const saved = await platformListingRepository.saveOverrides(row.id, orgId, input.seenVersion, own);
    if (!saved) throw new ConflictError("This listing changed since you opened it. Reload to see it; your text is kept below.");
    const values = computeListing(masterValues(product), own);
    return { version: input.seenVersion + 1, waiting: waitingFields(values, parseSent(row.sent, product.media), rules.writable).length };
  },

  /** Each connected marketplace on the product's On marketplaces block (ux.md). */
  async summaries(orgId: string, productId: string): Promise<ProductListingSummaryDTO[]> {
    const connections = (await channelConnectionRepository.forOrg(orgId)).filter((c) => isMarketplaceChannel(c.channel) && c.state !== CONNECTION_STATE.DISCONNECTED);
    if (connections.length === 0) return [];
    const product = await productOf(orgId, productId);
    const out: ProductListingSummaryDTO[] = [];
    for (const connection of connections) {
      const channel = connection.channel as MarketplaceChannel;
      await ensure(orgId, connection, channel, [productId]);
      const [row] = await platformListingRepository.forProducts(connection.id, [productId]);
      const rules = providerFor(channel).listingRules;
      out.push({ channel, status: row ? statusOf(row, product, rules).status : null, canCreate: rules.canCreate });
    }
    return out;
  },

  /** The daily pass over every live connection (D3). */
  async ensureForAll(): Promise<number> {
    let made = 0;
    for (const connection of await channelConnectionRepository.live()) made += await this.ensureForConnection(connection.id);
    return made;
  },

  /** Rows for every linked listing on a connection that has none (D3): the maintain pass and a finished read. */
  async ensureForConnection(connectionId: string): Promise<number> {
    const connection = await channelConnectionRepository.byId(connectionId);
    if (!connection || !isMarketplaceChannel(connection.channel)) return 0;
    const linked = await channelListingRepository.linkedWithoutPlatformListing(connectionId);
    const ids = [...new Set(linked.map((l) => l.productId).filter((id): id is string => id !== null))];
    const channel = connection.channel;
    for (let i = 0; i < ids.length; i += 100) await ensure(connection.orgId, connection, channel, ids.slice(i, i + 100));
    return ids.length;
  },
};

