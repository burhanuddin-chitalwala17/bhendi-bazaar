import { prisma } from "@server/shared/prisma";
import { CHANNEL_LABELS } from "@server/shared/channels";
import { enqueue, enqueueLater } from "@server/shared/jobs/jobs.enqueue";
import { productService } from "@server/catalog/product.service";

import type { MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionRepository, type OrdersCheckRow } from "./channel-connection.repository";
import { channelConnectionService } from "./channel-connection.service";
import { channelListingRepository } from "./channel-listing.repository";
import { computeListing, masterValues, parseOverrides, parseSent, snapshot, toWholeRupees } from "./listing-plan";
import { checkListingsSpec, LISTING_CHECK_AFTER_SECONDS, LISTING_CHECK_EVERY_SECONDS, publishListingSpec } from "./listing-publish.job";
import { listingCreateService } from "./listing-create.service";
import { platformListingRepository, type PlatformListingRow } from "./platform-listing.repository";
import { connectionFor, statusOf } from "./platform-listing.service";
import {
  LISTING_FIELD,
  PUBLISH_STATE,
  type ListingField,
  type ListingIssue,
  type ListingOverrides,
  type ListingRules,
  type ListingValues,
  type PublishResultDTO,
  type ReviewChangeDTO,
  type ReviewDTO,
  type ReviewListingDTO,
  type ReviewValue,
} from "./platform-listing.types";
import { providerFor } from "./providers";
import { MarketplaceAuthError, MarketplaceUnavailableError } from "./providers/marketplace-provider";
import type { PublishChanges } from "./providers/publish";

/**
 * Sending a listing's reviewed changes and following each until the marketplace answers
 * (marketplace-publish): the review, the claim, the send under a lock per listing, and the checks.
 */

type Product = Awaited<ReturnType<typeof productService.forListing>>[number];

const BIG_CHANGE = 0.3;
const issuesOf = (raw: unknown): ListingIssue[] => (Array.isArray(raw) ? (raw as ListingIssue[]) : []);

/** Photo ids as the addresses a marketplace fetches, in order, leaving out a format it refuses (channel-listings Q11). */
export function photoUrls(product: Product, ids: readonly string[], rules: ListingRules): string[] {
  return ids.flatMap((id) => {
    const media = product.media.find((m) => m.id === id);
    if (!media) return [];
    const mime = media.asset?.mimeType;
    if (mime && rules.photo.formats.length > 0 && !rules.photo.formats.includes(mime)) return [];
    return [media.ref];
  });
}

const display = (field: ListingField, value: ListingValues[ListingField], product: Product, rules: ListingRules): ReviewValue =>
  field === LISTING_FIELD.PHOTOS ? photoUrls(product, value as string[], rules) : (value as ReviewValue);

function changesOf(row: PlatformListingRow, product: Product, rules: ListingRules, waiting: ListingField[], values: ListingValues): ReviewChangeDTO[] {
  const sent = parseSent(row.sent);
  return waiting.map((field) => {
    const from = sent?.[field];
    const big =
      field === LISTING_FIELD.PRICE && typeof from === "number" && from > 0 && Math.abs(values.price - from) / from > BIG_CHANGE;
    return { field, from: from === undefined ? null : display(field, from, product, rules), to: display(field, values[field], product, rules), big };
  });
}

/** The send's fields as a provider takes them: only what is pending, photos as addresses (D2). */
function changesFor(pending: ListingOverrides, product: Product, rules: ListingRules): PublishChanges {
  return {
    ...(pending.title !== undefined ? { title: pending.title } : {}),
    ...(pending.price !== undefined ? { price: pending.price } : {}),
    ...(pending.photos !== undefined ? { photoUrls: photoUrls(product, pending.photos, rules) } : {}),
    ...(pending.features !== undefined ? { features: pending.features } : {}),
    ...(pending.description !== undefined ? { description: pending.description } : {}),
    ...(pending.listed !== undefined ? { listed: pending.listed } : {}),
    mrpPaise: product.mrpPaise,
  };
}

const pick = (values: ListingOverrides, fields: readonly ListingField[]): ListingOverrides =>
  Object.fromEntries(fields.filter((f) => values[f] !== undefined).map((f) => [f, values[f]])) as ListingOverrides;

const checkAt = (count: number, from: Date) => {
  const after = LISTING_CHECK_AFTER_SECONDS[count];
  return after === undefined ? null : new Date(from.getTime() + after * 1000);
};

/** A send still "Sent" after the queue's retries (about 15 minutes) is one it gave up on. */
const STUCK_AFTER_MS = 3_600_000;

function failureIssue(error: unknown, channel: MarketplaceChannel): ListingIssue {
  return error instanceof MarketplaceAuthError
    ? { code: "reconnect", message: `${CHANNEL_LABELS[channel]} turned our access down. Reconnect it on the Channels page, then publish again.`, severity: "error", field: null }
    : { code: "failed", message: "This change could not be sent. Try again.", severity: "error", field: null };
}

async function refuse(id: string, issue: ListingIssue, now: Date): Promise<void> {
  await platformListingRepository.recordAnswer(id, { sent: null, publishState: PUBLISH_STATE.ATTENTION, issues: [issue], nextCheckAt: null }, now, prisma, [PUBLISH_STATE.SENT]);
}

/** A look that could not be made still counts (D5): refused access asks to reconnect; otherwise the next look, or "hasn't answered". */
async function missedLook(id: string, error: unknown, now: Date): Promise<void> {
  const orgId = await platformListingRepository.orgOf(id);
  const row = orgId ? await platformListingRepository.find(id, orgId) : null;
  if (!row || row.publishState !== PUBLISH_STATE.CHECKING) return;
  if (error instanceof MarketplaceAuthError) {
    const issue = failureIssue(error, row.channel as MarketplaceChannel);
    await platformListingRepository.recordAnswer(id, { sent: null, publishState: PUBLISH_STATE.ATTENTION, issues: [issue], nextCheckAt: null, checkCount: row.checkCount + 1, keepPending: false }, now, prisma, [PUBLISH_STATE.CHECKING]);
    return;
  }
  const count = row.checkCount + 1;
  const next = checkAt(count, row.publishedAt ?? now);
  await platformListingRepository.recordAnswer(id, { sent: null, publishState: next ? PUBLISH_STATE.CHECKING : PUBLISH_STATE.UNANSWERED, issues: [], nextCheckAt: next, checkCount: count, keepPending: true }, now, prisma, [PUBLISH_STATE.CHECKING]);
}

async function startChecks(): Promise<void> {
  await enqueueLater(prisma, checkListingsSpec, {}, { afterSeconds: LISTING_CHECK_EVERY_SECONDS, onePerSeconds: LISTING_CHECK_EVERY_SECONDS });
}

/**
 * A connection's token for a batch of looks: the one the read already holds while it is fresh, judged
 * at each call; the locked renewal only when it is about to lapse, and once per batch (as Q26 does for
 * the order check). An unreadable stored token throws inside the look, so it is that listing's failure.
 */
function tokenFor(connection: OrdersCheckRow): () => Promise<string> {
  let renewed: string | null = null;
  return async () =>
    renewed ?? channelConnectionService.unexpiredAccessToken(connection) ?? (renewed = await channelConnectionService.accessToken(connection.id));
}

/** The marketplace SKU of each listing that has none of its own, one read per connection. Keyed `connection:product`. */
async function mirrorSkus(rows: readonly PlatformListingRow[]): Promise<Map<string, string>> {
  const byConnection = new Map<string, string[]>();
  for (const row of rows) byConnection.set(row.connectionId, [...(byConnection.get(row.connectionId) ?? []), row.productId as string]);
  const skus = new Map<string, string>();
  for (const [connectionId, productIds] of byConnection) {
    for (const mirror of await channelListingRepository.mirrorsFor(connectionId, productIds)) {
      const key = `${connectionId}:${mirror.productId}`;
      if (mirror.productId && !skus.has(key)) skus.set(key, mirror.sku);
    }
  }
  return skus;
}

/**
 * One look (D5). A complaint ends the wait: what it names stays waiting, the rest is sent. Found clean
 * at the second look, everything pending is confirmed sent. Not found by the last look: "hasn't answered".
 */
async function lookAt(row: PlatformListingRow, connection: OrdersCheckRow | null, token: (() => Promise<string>) | null, now: Date, sku: string | null): Promise<void> {
  if (!connection || !token || !sku) return await missedLook(row.id, null, now);
  const provider = providerFor(connection.channel as MarketplaceChannel);
  const answer = await provider.listingStatus(token, connection.externalAccountId, { sku, externalId: null, marketplaceType: row.marketplaceType });
  const count = row.checkCount + 1;
  const errors = answer.issues.filter((i) => i.severity === "error");
  const pending = parseOverrides(row.pending);
  const sent = parseSent(row.sent) ?? {};
  const title = pending.title ?? sent.title;
  const showing = answer.found && answer.showing.title && title && answer.showing.title !== title ? { title: answer.showing.title, mainImageUrl: null } : null;
  const done = errors.length > 0 || (answer.found && count >= 2);
  const next = done ? null : checkAt(count, row.publishedAt ?? now);
  const state = errors.length > 0 ? PUBLISH_STATE.ATTENTION : done ? PUBLISH_STATE.IDLE : next ? PUBLISH_STATE.CHECKING : PUBLISH_STATE.UNANSWERED;
  const refused = new Set(errors.map((i) => i.field));
  const confirmed = !done ? null : refused.has(null) ? (Object.keys(sent).length ? sent : null) : { ...sent, ...pick(pending, (Object.keys(pending) as ListingField[]).filter((f) => !refused.has(f))) };
  await platformListingRepository.recordAnswer(row.id, { sent: confirmed, publishState: state, issues: answer.issues, nextCheckAt: next, checkCount: count, live: answer.live, showing, keepPending: !done }, now, prisma, [PUBLISH_STATE.CHECKING]);
  if (done && answer.found && errors.length === 0 && row.channelListingId === null) await listingCreateService.linkCreated({ ...row, sent: confirmed });
}

export const listingPublishService = {
  /** Every listing with changes waiting on one marketplace, or one listing, old against new (R1, R2). */
  async review(orgId: string, channelName: string, listingId?: string): Promise<ReviewDTO> {
    const { connection, channel } = await connectionFor(orgId, channelName);
    const rules = providerFor(channel).listingRules;
    const all = listingId ? [await platformListingRepository.find(listingId, orgId)].filter((r): r is PlatformListingRow => r !== null && r.connectionId === connection.id) : await platformListingRepository.onConnection(connection.id);
    const rows = all.filter((r) => r.productId !== null || r.familyId !== null);
    const products = await productService.forListing(orgId, rows.map((r) => r.productId).filter((id): id is string => id !== null));
    const listings: ReviewListingDTO[] = [];
    for (const row of rows) {
      if (row.familyId) {
        const family = await listingCreateService.familyReview(orgId, row);
        if (family) listings.push(family);
        continue;
      }
      const product = products.find((p) => p.id === row.productId);
      if (!product) continue;
      const { status, values, waiting } = statusOf(row, product, rules);
      const creating = row.channelListingId === null;
      if (waiting.length === 0) continue;
      listings.push({ id: row.id, version: row.version, productId: product.id, name: product.name, status, creating, changes: changesOf(row, product, rules, waiting, values) });
    }
    return { channel, label: CHANNEL_LABELS[channel], listings, totalChanges: listings.reduce((n, l) => n + l.changes.length, 0) };
  },

  /**
   * Publish what was reviewed (D3): each listing only at the version the review showed and only the
   * fields the shop kept; one moved since is refused. The send is enqueued in the same transaction.
   */
  async publish(orgId: string, channelName: string, items: ReadonlyArray<{ id: string; version: number; fields: ListingField[] }>): Promise<PublishResultDTO> {
    const { connection, channel } = await connectionFor(orgId, channelName);
    const rules = providerFor(channel).listingRules;
    const refused: string[] = [];
    let sent = 0;
    for (const item of items) {
      const ok = await prisma.$transaction(async (tx) => {
        const row = await platformListingRepository.find(item.id, orgId, tx);
        if (!row || row.connectionId !== connection.id) return false;
        let pending: ListingOverrides = {};
        if (row.productId) {
          const [product] = await productService.forListing(orgId, [row.productId], tx);
          if (!product) return false;
          const values = computeListing(masterValues(product), parseOverrides(row.overrides));
          pending = pick(snapshot(values, rules.writable), item.fields.filter((f) => rules.writable.includes(f)));
          // What a whole-rupee marketplace will hold, so what is recorded as sent is what it shows (channel-listings Q13).
          if (rules.wholeRupees && pending.price !== undefined) pending.price = toWholeRupees(pending.price);
          if (Object.keys(pending).length === 0 && row.channelListingId !== null) return false;
        }
        const claimed = await platformListingRepository.claimPublish(row.id, orgId, item.version, pending, new Date(), tx);
        if (!claimed) return false;
        await enqueue(tx, publishListingSpec, { listingId: row.id, orgId });
        return true;
      });
      if (ok) sent++;
      else refused.push(item.id);
    }
    return { sent, refused };
  },

  /**
   * The send (D3, D4). SENT is the claim: the marketplace is called outside any transaction, and the
   * answer is recorded only while the listing is still SENT, so a retry after a lost write sends the
   * same patch again and nothing else. A busy marketplace throws so the queue retries with the listing
   * still "Sent" (the daily pass ends one the queue gave up on); every other outcome is recorded.
   */
  async send(listingId: string): Promise<{ state: string }> {
    const orgId = await platformListingRepository.orgOf(listingId);
    const row = orgId ? await platformListingRepository.find(listingId, orgId) : null;
    if (!row || row.publishState !== PUBLISH_STATE.SENT) return { state: "skipped" };
    if (row.channelListingId === null) return { state: await listingCreateService.send(row) };
    const now = new Date();
    const connection = await channelConnectionRepository.byId(row.connectionId);
    const channel = connection?.channel as MarketplaceChannel | undefined;
    const [product] = row.productId ? await productService.forListing(row.orgId, [row.productId]) : [];
    const [mirror] = connection && row.productId ? await channelListingRepository.mirrorsFor(connection.id, [row.productId]) : [];
    if (!connection || !channel || !product || !mirror) {
      const label = channel ? CHANNEL_LABELS[channel] : "the marketplace";
      await refuse(row.id, { code: "gone", message: `This listing is no longer on ${label}. Read again on the Listings page, then publish.`, severity: "error", field: null }, now);
      return { state: PUBLISH_STATE.ATTENTION };
    }
    const provider = providerFor(channel);
    const pending = parseOverrides(row.pending);
    try {
      const answer = await provider.publishListing(
        () => channelConnectionService.accessToken(connection.id),
        connection.externalAccountId,
        { sku: mirror.sku, externalId: mirror.externalId, marketplaceType: row.marketplaceType ?? (mirror.attributes as { type?: string } | null)?.type ?? null },
        changesFor(pending, product, provider.listingRules),
      );
      const failed = answer.issues.some((i) => i.severity === "error");
      // Amazon decides later: what it took stays pending until a look confirms it (D3, publish A2).
      if (answer.decidesLater && !failed) {
        await platformListingRepository.recordAnswer(row.id, { sent: null, publishState: PUBLISH_STATE.CHECKING, issues: answer.issues, nextCheckAt: checkAt(0, now), checkCount: 0, keepPending: true }, now, prisma, [PUBLISH_STATE.SENT]);
        await startChecks();
        return { state: PUBLISH_STATE.CHECKING };
      }
      const accepted = { ...(parseSent(row.sent) ?? {}), ...pick(pending, answer.accepted) };
      const state = failed ? PUBLISH_STATE.ATTENTION : PUBLISH_STATE.IDLE;
      await platformListingRepository.recordAnswer(row.id, { sent: accepted, publishState: state, issues: answer.issues, nextCheckAt: null, checkCount: 0, live: accepted.listed ?? true }, now, prisma, [PUBLISH_STATE.SENT]);
      return { state };
    } catch (error) {
      if (error instanceof MarketplaceUnavailableError) throw error;
      console.error(`[channels] publish of listing ${row.id} failed: ${error instanceof Error ? error.name : "error"}`);
      await refuse(row.id, failureIssue(error, channel), now);
      return { state: PUBLISH_STATE.ATTENTION };
    }
  },

  /**
   * The answer check (D5, Q5, Q22): listings whose next look is due are claimed, read with their
   * connections in two statements whatever their number, and each asked of its marketplace. A look that
   * cannot be made still counts, so a listing always reaches an end and the chain always stops. The next
   * run is enqueued for when the next look falls due, and only while something still waits.
   */
  async checkDue(enqueueNext: (afterSeconds: number) => Promise<unknown>): Promise<number> {
    const now = new Date();
    const ids = await platformListingRepository.claimDueChecks(now, new Date(now.getTime() + 600_000));
    const rows = (await platformListingRepository.claimedRows(ids)).filter((row) => row.publishState === PUBLISH_STATE.CHECKING);
    const connections = new Map(
      (await channelConnectionRepository.withTokens([...new Set(rows.map((row) => row.connectionId))])).map((c) => [c.id, c]),
    );
    const skus = await mirrorSkus(rows.filter((row) => row.sku === null && row.productId !== null && connections.has(row.connectionId)));
    const tokens = new Map<string, () => Promise<string>>();
    for (const row of rows) {
      const connection = connections.get(row.connectionId) ?? null;
      if (connection && !tokens.has(connection.id)) tokens.set(connection.id, tokenFor(connection));
      try {
        const sku = row.sku ?? (row.productId ? skus.get(`${row.connectionId}:${row.productId}`) ?? null : null);
        await lookAt(row, connection, connection ? tokens.get(connection.id)! : null, now, sku);
      } catch (error) {
        console.error(`[channels] listing check ${row.id} failed: ${error instanceof Error ? error.name : "error"}`);
        await missedLook(row.id, error, now);
      }
    }
    const due = await platformListingRepository.nextDueAt();
    if (due) await enqueueNext(Math.max(LISTING_CHECK_EVERY_SECONDS, Math.ceil((due.getTime() - Date.now()) / 1000)));
    return ids.length;
  },

  /** One look at one listing, read on its own (a single look outside the batched check). */
  async check(listingId: string, now = new Date()): Promise<void> {
    const orgId = await platformListingRepository.orgOf(listingId);
    const row = orgId ? await platformListingRepository.find(listingId, orgId) : null;
    if (!row || row.publishState !== PUBLISH_STATE.CHECKING) return;
    const [connection] = await channelConnectionRepository.withTokens([row.connectionId]);
    const sku = row.sku ?? (row.productId && connection ? (await channelListingRepository.mirrorsFor(connection.id, [row.productId]))[0]?.sku ?? null : null);
    await lookAt(row, connection ?? null, connection ? tokenFor(connection) : null, now, sku);
  },

  /** The daily pass (D5): sends the queue gave up on wait for the shop; anything still waiting gets a look. */
  async daily(): Promise<void> {
    const now = new Date();
    await platformListingRepository.expireStuckSends(new Date(now.getTime() - STUCK_AFTER_MS), { code: "busy", message: "The marketplace stayed busy and this change was not sent. Try again.", severity: "error", field: null }, now);
    await platformListingRepository.dueAllWaiting(now);
    await enqueue(prisma, checkListingsSpec, {});
  },
};
