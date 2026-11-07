import type { Prisma } from "@prisma/client";

import { CHANNEL_LABELS } from "@server/shared/channels";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import { productService } from "@server/catalog/product.service";
import { listingBuildService } from "@server/listing/listing-build.service";
import { GAP_REASON, type BuildGap } from "@server/listing/field-map.types";
import { channelReadinessService } from "@server/listing/channel-readiness.service";
import { orgListingDefaultsService } from "@server/listing/org-listing-defaults.service";
import { productFamilyService } from "@server/listing/product-family.service";
import { FACT_DECLARATIONS, type FactKey } from "@server/listing/listing-facts";

import { isMarketplaceChannel, type MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionRepository } from "./channel-connection.repository";
import { channelConnectionService } from "./channel-connection.service";
import { channelListingRepository } from "./channel-listing.repository";
import { pickTheme, skuFor } from "./listing-create";
import { marketplacePhotoUrls } from "./listing-photos-out";
import { enqueueListingCheck, LISTING_CHECK_AFTER_SECONDS, LISTING_CHECK_EVERY_SECONDS } from "./listing-publish.job";
import { complaintIssues, handOverComplaints } from "./listing-complaints";
import { computeListing, listingStatus, masterValues, parseOverrides, parseSent } from "./listing-plan";
import { platformListingRepository, type PlatformListingRow } from "./platform-listing.repository";
import { CREATE_MODE, PUBLISH_STATE, type CreateMode, type ListingIssue, type ReviewListingDTO } from "./platform-listing.types";
import { providerFor } from "./providers";
import { MarketplaceAuthError, MarketplaceUnavailableError } from "./providers/marketplace-provider";
import type { CreateListingInput, PageMatch } from "./providers/publish";

/**
 * Putting a product, or a family, on a marketplace (marketplace-publish D6, D7, D8): looking for its
 * page first, the draft, Amazon's check-only answer, the create, and linking what was made.
 */

type Product = Awaited<ReturnType<typeof productService.forListing>>[number];
type Tx = Prisma.TransactionClient;

async function connectionOf(orgId: string, channel: string) {
  if (!isMarketplaceChannel(channel)) throw new NotFoundError("Channel");
  const connection = await channelConnectionRepository.find(orgId, channel);
  if (!connection) throw new NotFoundError("Connection");
  return { connection, channel };
}

async function productOf(orgId: string, productId: string, db?: Tx): Promise<Product> {
  const [product] = await productService.forListing(orgId, [productId], db);
  if (!product) throw new NotFoundError("Product");
  return product;
}

/** Where a product lists on a marketplace, and the facts that marketplace still needs (Q10). */
async function readinessOf(orgId: string, product: Product, channel: MarketplaceChannel) {
  const verdicts = await channelReadinessService.forProduct(orgId, { productType: product.productType, kind: product.kind, facts: product.facts });
  const report = verdicts.find((v) => v.channel === channel)?.report;
  const stillNeeds = (report?.problems ?? []).flatMap((p) => (p.problem === "missingFact" ? [FACT_DECLARATIONS[p.fact as FactKey]?.label ?? p.fact] : []));
  return { theirCategory: report?.theirCategory ?? null, stillNeeds };
}

/** Everything a create sends for one product (D8): its listing, its mapped facts, the brand and shop's compliance. */
type BuiltInput = CreateListingInput & { gaps: BuildGap[] };

/** What a create is built from on its listing row. */
type CreateRow = Pick<PlatformListingRow, "overrides" | "sku" | "createMode" | "marketplaceType" | "targetExternalId">;

async function inputFor(orgId: string, row: CreateRow, product: Product, channel: MarketplaceChannel, family: CreateListingInput["family"]): Promise<BuiltInput> {
  const rules = providerFor(channel).listingRules;
  const values = computeListing(masterValues(product), parseOverrides(row.overrides, product.media));
  const defaults = await orgListingDefaultsService.get(orgId);
  const hsn = defaults.taxCodes.find((t) => t.categoryId === product.categoryId)?.taxCode ?? null;
  const sku = row.sku ?? skuFor(product);
  let fields: CreateListingInput["fields"] = [];
  let gaps: BuildGap[] = [];
  let typeSchema: unknown = null;
  if (row.createMode === CREATE_MODE.NEW && row.marketplaceType) {
    // Built from the product and the field maps every time it is sent (listing-model/field-maps R5).
    const { built, schemas } = await listingBuildService.build(channel, [{
      channelType: row.marketplaceType,
      product: {
        id: product.id, name: values.title, sku, description: values.description, brand: product.brand?.name ?? null,
        weightKg: product.weight, barcode: product.barcode, productType: product.productType, kind: product.kind,
        facts: product.facts, measurements: product.measurements, hsn,
      },
    }]);
    fields = built.get(product.id)?.fields ?? [];
    gaps = built.get(product.id)?.gaps ?? [];
    typeSchema = schemas.get(`${channel}:${row.marketplaceType}`) ?? null;
  }
  return {
    sku,
    mode: (row.createMode as CreateMode | null) ?? CREATE_MODE.NEW,
    targetExternalId: row.targetExternalId,
    marketplaceType: row.marketplaceType,
    family,
    title: values.title,
    price: values.price,
    mrpPaise: product.mrpPaise,
    photoUrls: await marketplacePhotoUrls(orgId, product.media, values.photos, rules.photo.formats),
    features: values.features,
    description: values.description,
    // Generic goes out with no barcode: Amazon's unbranded route takes the exemption, never a code (Q35).
    barcode: defaults.amazonGeneric ? null : product.barcode,
    brand: product.brand?.name ?? null,
    generic: defaults.amazonGeneric,
    quantity: product.archivedAt ? 0 : product.stockLocations.reduce((n, s) => n + s.quantity, 0),
    fields,
    gaps,
    typeSchema,
    compliance: {
      countryOfOrigin: product.brand?.countryOfOrigin ?? defaults.countryOfOrigin,
      manufacturer: product.brand?.manufacturer ?? null,
      packer: product.brand?.packerOrImporter ?? null,
      importer: product.brand?.packerOrImporter ?? null,
      hsn,
    },
  };
}

/**
 * What the maps could not fill, kept on the listing as warnings so nothing is left out unseen
 * (listing-model/field-maps Q6); a required one Amazon names itself as an error.
 */
function gapWarnings(gaps: readonly BuildGap[], channel: MarketplaceChannel): ListingIssue[] {
  const label = CHANNEL_LABELS[channel];
  return gaps.map((g) => ({
    code: `gap_${g.reason}`,
    severity: "warning" as const,
    field: null,
    attribute: g.field,
    message: g.reason === GAP_REASON.NO_MATCH
      ? `${label} has no match for "${g.answer}" in ${g.label}, so it was left out.`
      : g.reason === GAP_REASON.DEVELOPER ? `${g.label} needs a question we don't ask yet; it's with our team.`
      : `${g.label} wasn't sent: ${g.reason === GAP_REASON.UNMAPPED ? "we don't fill it yet" : "this product doesn't say"}.`,
  }));
}

const checkAt = (from: Date) => new Date(from.getTime() + LISTING_CHECK_AFTER_SECONDS[0] * 1000);

/** A family's theme, read from the marketplace's schema for its type (D7). */
async function themeFor(orgId: string, connection: { id: string; externalAccountId: string | null }, channel: MarketplaceChannel, familyId: string, marketplaceType: string | null): Promise<string | null> {
  if (!marketplaceType) return null;
  const family = await productFamilyService.byId(orgId, familyId);
  const themes = await providerFor(channel).variationThemes(() => channelConnectionService.accessToken(connection.id), connection.externalAccountId, marketplaceType);
  return pickTheme(family.variantAxis, themes);
}

export const listingCreateService = {
  /** What "Put on Amazon" opens with (ux.md): the product, and its family when it has one (Q11). */
  async startInfo(orgId: string, productId: string, channelName: string) {
    const { channel } = await connectionOf(orgId, channelName);
    const product = await productOf(orgId, productId);
    const family = product.familyId ? await productFamilyService.byId(orgId, product.familyId) : null;
    const members = product.familyId ? (await productService.familyMembers(orgId, product.familyId)).length : 0;
    return {
      channel,
      label: CHANNEL_LABELS[channel],
      productId,
      productName: product.name,
      canCreate: providerFor(channel).listingRules.canCreate,
      family: family ? { id: family.id, name: family.name, members, axis: family.variantAxis.join(" and ") || "items" } : null,
    };
  },

  /** Pages already on the marketplace for a product, by barcode then name (D6). */
  async findPages(orgId: string, productId: string, channelName: string): Promise<PageMatch[]> {
    const { connection, channel } = await connectionOf(orgId, channelName);
    const product = await productOf(orgId, productId);
    return await providerFor(channel).findPages(() => channelConnectionService.accessToken(connection.id), connection.externalAccountId, { barcode: product.barcode, keywords: product.name });
  },

  /** A draft listing for a product not yet on the marketplace (Q7): on a page found, or a new one. */
  async startDraft(orgId: string, productId: string, channelName: string, input: { mode: CreateMode; targetExternalId: string | null }): Promise<{ id: string }> {
    const { connection, channel } = await connectionOf(orgId, channelName);
    if (!providerFor(channel).listingRules.canCreate) throw new ConflictError(`${CHANNEL_LABELS[channel]} products are made in its own seller hub.`);
    const product = await productOf(orgId, productId);
    const [mirror] = await channelListingRepository.mirrorsFor(connection.id, [productId]);
    if (mirror) throw new ConflictError(`This product is already on ${CHANNEL_LABELS[channel]}.`);
    const { theirCategory } = await readinessOf(orgId, product, channel);
    const row = await platformListingRepository.createDraft({
      orgId, channel, connectionId: connection.id, productId, familyId: null,
      createMode: input.mode, targetExternalId: input.mode === CREATE_MODE.OFFER ? input.targetExternalId : null,
      marketplaceType: theirCategory, sku: skuFor(product),
    });
    return { id: row.id };
  },

  /** The family's own page and a draft for every member (Q11, D7). */
  async startFamily(orgId: string, familyId: string, channelName: string): Promise<{ id: string; members: number }> {
    const { connection, channel } = await connectionOf(orgId, channelName);
    if (!providerFor(channel).listingRules.canCreate) throw new ConflictError(`${CHANNEL_LABELS[channel]} products are made in its own seller hub.`);
    const members = await productService.familyMembers(orgId, familyId);
    if (members.length === 0) throw new NotFoundError("Family");
    const first = await productOf(orgId, members[0].id);
    const { theirCategory } = await readinessOf(orgId, first, channel);
    const parent = await platformListingRepository.createDraft({
      orgId, channel, connectionId: connection.id, productId: null, familyId,
      createMode: CREATE_MODE.NEW, targetExternalId: null, marketplaceType: theirCategory, sku: `FAM-${familyId.slice(-10).toUpperCase()}`,
    });
    const linked = new Set((await channelListingRepository.mirrorsFor(connection.id, members.map((m) => m.id))).map((m) => m.productId));
    for (const member of members.filter((m) => !linked.has(m.id))) {
      await platformListingRepository.createDraft({
        orgId, channel, connectionId: connection.id, productId: member.id, familyId: null,
        createMode: CREATE_MODE.NEW, targetExternalId: null, marketplaceType: theirCategory, sku: skuFor(member),
      });
    }
    return { id: parent.id, members: members.length };
  },

  /** What a draft screen adds: how it will be made, and what the marketplace still needs (ux.md "Put on Amazon"). */
  async draftInfo(orgId: string, row: PlatformListingRow, product: Product, channel: MarketplaceChannel) {
    const { stillNeeds } = row.createMode === CREATE_MODE.NEW ? await readinessOf(orgId, product, channel) : { stillNeeds: [] };
    return { mode: (row.createMode as CreateMode | null) ?? CREATE_MODE.NEW, targetExternalId: row.targetExternalId, marketplaceType: row.marketplaceType, stillNeeds };
  },

  /** A family's page on the review: a create of its title (Q11). */
  async familyReview(orgId: string, row: PlatformListingRow): Promise<ReviewListingDTO | null> {
    if (!row.familyId || row.sent !== null && row.publishState === PUBLISH_STATE.IDLE) return null;
    const family = await productFamilyService.byId(orgId, row.familyId);
    const status = listingStatus({ onMarketplace: row.sent !== null, publishState: row.publishState, waiting: row.sent ? 0 : 1, issues: Array.isArray(row.issues) ? row.issues.length : 0, listed: true, publishedAt: row.publishedAt, checkedAt: row.checkedAt, nextCheckAt: row.nextCheckAt });
    if (row.sent !== null && row.publishState === PUBLISH_STATE.IDLE) return null;
    return { id: row.id, version: row.version, productId: null, name: family.name, status, creating: true, changes: [{ field: "title", from: null, to: family.name, big: false }] };
  },

  /**
   * The create (D6, D7, Q9): a new page goes to Amazon's check-only mode first and is created only when
   * no error came back; a member waits until its family's page is made. Accepted: checked like an edit.
   */
  async send(row: PlatformListingRow): Promise<string> {
    const connection = await channelConnectionRepository.byId(row.connectionId);
    if (!connection || !isMarketplaceChannel(connection.channel)) return "skipped";
    const channel = connection.channel;
    const provider = providerFor(channel);
    const token = () => channelConnectionService.accessToken(connection.id);
    const now = new Date();
    let input: BuiltInput;
    try {
      if (row.familyId) {
        const family = await productFamilyService.byId(row.orgId, row.familyId);
        const members = await productService.familyMembers(row.orgId, row.familyId);
        const first = await productOf(row.orgId, members[0].id);
        const theme = await themeFor(row.orgId, connection, channel, row.familyId, row.marketplaceType);
        if (!theme) return await this.refuse(row, [{ code: "no_theme", message: `${CHANNEL_LABELS[channel]} has no way to group this family's ${family.variantAxis.join(" and ") || "items"} for its type.`, severity: "error", field: null }]);
        input = { ...(await inputFor(row.orgId, row, first, channel, { role: "parent", theme })), title: family.name, description: family.description ?? first.description };
      } else {
        if (!row.productId) return "skipped";
        const product = await productOf(row.orgId, row.productId);
        let family: CreateListingInput["family"] = null;
        if (product.familyId && row.createMode === CREATE_MODE.NEW) {
          const parent = await platformListingRepository.forFamily(connection.id, product.familyId);
          if (parent) {
            // A member waits for its family's page while that is being sent (D7); a page not on its way is the shop's to publish first.
            if (parent.sent === null && parent.publishState === PUBLISH_STATE.SENT) throw new MarketplaceUnavailableError(null);
            if (parent.sent === null) return await this.refuse(row, [{ code: "no_parent", message: "Publish the family's page first; its colours and sizes go up under it.", severity: "error", field: null }]);
            const theme = await themeFor(row.orgId, connection, channel, product.familyId, row.marketplaceType);
            if (theme && parent.sku) family = { role: "child", parentSku: parent.sku, theme };
          }
        }
        input = await inputFor(row.orgId, row, product, channel, family);
      }
      if (input.mode === CREATE_MODE.NEW) {
        const preview = await provider.createListing(token, connection.externalAccountId, input, { preview: true });
        if (preview.issues.some((i) => i.severity === "error")) return await this.refuse(row, preview.issues);
      }
      const answer = await provider.createListing(token, connection.externalAccountId, input, { preview: false });
      if (answer.issues.some((i) => i.severity === "error")) return await this.refuse(row, answer.issues);
      // A family's page exists once accepted, so its members may follow; a product's fields stay pending until a look confirms them (D3).
      const sent = row.familyId ? { title: input.title } : null;
      await platformListingRepository.recordAnswer(row.id, { sent, publishState: PUBLISH_STATE.CHECKING, issues: [...answer.issues, ...gapWarnings(input.gaps, channel)], nextCheckAt: checkAt(now), checkCount: 0, keepPending: true }, now, prisma, [PUBLISH_STATE.SENT]);
      await enqueueListingCheck(prisma, LISTING_CHECK_EVERY_SECONDS);
      return PUBLISH_STATE.CHECKING;
    } catch (error) {
      if (error instanceof MarketplaceUnavailableError) throw error;
      const issue: ListingIssue = error instanceof MarketplaceAuthError
        ? { code: "reconnect", message: `${CHANNEL_LABELS[channel]} turned our access down. Reconnect it on the Channels page, then publish again.`, severity: "error", field: null }
        : { code: "failed", message: "This listing could not be sent. Try again.", severity: "error", field: null };
      console.error(`[channels] create of listing ${row.id} failed: ${error instanceof Error ? error.name : "error"}`);
      return await this.refuse(row, [issue]);
    }
  },

  /**
   * What Amazon's check-only mode says of a product as a new listing of a type, built from the field maps
   * (listing-model/field-maps R7, Q5). Nothing is created or stored: the proof run's one call.
   */
  async checkOnly(orgId: string, productId: string, channelName: string, marketplaceType: string): Promise<{ issues: ListingIssue[]; gaps: BuildGap[] }> {
    const { connection, channel } = await connectionOf(orgId, channelName);
    const product = await productOf(orgId, productId);
    const input = await inputFor(orgId, { overrides: null, sku: null, createMode: CREATE_MODE.NEW, marketplaceType, targetExternalId: null }, product, channel, null);
    const answer = await providerFor(channel).createListing(() => channelConnectionService.accessToken(connection.id), connection.externalAccountId, input, { preview: true });
    return { issues: answer.issues, gaps: input.gaps };
  },

  async refuse(row: PlatformListingRow, issues: ListingIssue[]): Promise<string> {
    await platformListingRepository.recordAnswer(row.id, { sent: null, publishState: PUBLISH_STATE.ATTENTION, issues, nextCheckAt: null }, new Date(), prisma, [PUBLISH_STATE.SENT]);
    // What only we can fix becomes a ticket without the shop asking (setup-requests Q5).
    if (row.productId) await handOverComplaints([{ orgId: row.orgId, productId: row.productId, channel: row.channel, productType: null, kind: null, theirCategory: row.marketplaceType, issues: complaintIssues(issues) }]);
    return PUBLISH_STATE.ATTENTION;
  },

  /** What a create made: the mirror row, linked to its product, so stock sync and reads take it up (D6). */
  async linkCreated(row: PlatformListingRow): Promise<void> {
    if (!row.productId || !row.sku) return;
    const product = await productOf(row.orgId, row.productId);
    const mirror = await channelListingRepository.createLinked({
      connectionId: row.connectionId, orgId: row.orgId, channel: row.channel, sku: row.sku, productId: row.productId,
      title: parseSent(row.sent)?.title ?? parseOverrides(row.pending).title ?? product.name,
      pricePaise: parseSent(row.sent)?.price ?? parseOverrides(row.pending).price ?? product.price,
      externalId: row.createMode === CREATE_MODE.OFFER ? row.targetExternalId : null,
    });
    await platformListingRepository.attachMirror(row.id, mirror.id);
  },
};
