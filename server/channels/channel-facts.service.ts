import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { CHANNEL_LABELS } from "@server/shared/channels";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { productService } from "@server/catalog/product.service";
import { brandService } from "@server/catalog/brand.service";
import type { MarketplaceEntry, MarketplaceFill } from "@server/catalog/admin.product.types";
import { channelMapService } from "@server/listing/channel-map.service";
import { orgListingDefaultsService } from "@server/listing/org-listing-defaults.service";
import { storedFactSchema } from "@server/listing/listing-facts";

import { CONNECTION_STATE, isMarketplaceChannel, type MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionService } from "./channel-connection.service";
import { channelListingRepository } from "./channel-listing.repository";
import { channelConnectionRepository } from "./channel-connection.repository";
import { SAID_MAX, mappingIsStale, planFill, typeFor, type FillPlan } from "./fact-fill";
import {
  FACTS_STATE,
  type FillNowOutcome,
  type MarketplaceFactRowDTO,
  type MarketplaceFactsChange,
  type ProductMarketplaceFactsDTO,
  type SettleFactsDTO,
  type SettleTypeDTO,
  type SettleTypeFactsDTO,
  type TypeChoiceDTO,
} from "./channel-facts.types";
import { listingFactsSpec, type ListingFactsPayload } from "./listing-facts.job";
import { providerFor } from "./providers";
import { MarketplaceAuthError, MarketplaceUnavailableError } from "./providers/marketplace-provider";
import type { ListingAttributes } from "./providers/listing-read";

/**
 * Filling a product from its linked marketplace listings (marketplace-facts): the read stored on
 * the listing, then one fill, the same for every marketplace. Every write fills only what is still
 * empty, so nothing the shop set is ever replaced.
 */

type FactsRow = Awaited<ReturnType<typeof channelListingRepository.forFacts>>[number];
type ProductFacts = NonNullable<Awaited<ReturnType<typeof productService.marketplaceFacts>>>;
type FillTypeView = NonNullable<Awaited<ReturnType<typeof channelMapService.typeForFill>>>;
type StoredEntry = { value: string | number | boolean; origin: string; source?: { channel: string; value: string; readAt: string; chosen?: boolean } };

const entriesOf = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, StoredEntry | undefined>) : {});

/** Our answer as the shop reads it: a list answer by its label, a measurement with its unit. */
function shown(value: StoredEntry["value"], fact: { list?: string } | undefined, unit: string | undefined, type: FillTypeView): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (unit) return `${value} ${unit}`;
  const label = fact?.list ? type.lists[fact.list]?.find((o) => o.key === value)?.label : undefined;
  return label ?? String(value);
}

export interface FillOutcome {
  outcome: "filled" | "reconnect" | "not_linked";
  facts?: number;
  measurements?: number;
  questions?: number;
  details?: string[];
}

/** The stored read, defensively: anything else reads as nothing read. */
export function storedRead(value: unknown): ListingAttributes | null {
  if (!value || typeof value !== "object") return null;
  const read = value as Partial<ListingAttributes>;
  return read.attributes && read.details ? (read as ListingAttributes) : null;
}

const entry = (channel: string, value: string | number | boolean, said: string, readAt: string): MarketplaceEntry => ({
  value,
  origin: "marketplace",
  source: { channel, value: said.slice(0, SAID_MAX), readAt },
});

/** Only entries the stored schema accepts are written: one it refuses would read the whole column as empty (ADR-0051). */
const parsed = (entries: Array<[string, MarketplaceEntry]>) =>
  Object.fromEntries(entries.filter(([, e]) => storedFactSchema.safeParse(e).success));

export const channelFactsService = {
  /** Fill each listing's product after a settle or a "Fill from" tap, on the worker (Q3, D7). */
  async enqueueIn(tx: Prisma.TransactionClient, orgId: string, listingIds: readonly string[]): Promise<void> {
    for (const listingId of listingIds) {
      const payload: ListingFactsPayload = { orgId, listingId };
      await enqueue(tx, listingFactsSpec, payload);
    }
  },

  /**
   * One fill for every linked listing on a connection never read (Q36): links made by SKU never pass
   * the Settle page, so without this their products never learn a colour. Each fill writes only what
   * is empty; the read is the same one "Fill from" makes.
   */
  async fillUnread(connectionId: string): Promise<number> {
    const connection = await channelConnectionRepository.byId(connectionId);
    if (!connection || connection.state !== CONNECTION_STATE.CONNECTED) return 0;
    const now = new Date();
    const ids = await channelListingRepository.linkedUnread(connectionId, now);
    if (ids.length === 0) return 0;
    await channelListingRepository.markFillTried(ids, now);
    await this.enqueue(connection.orgId, ids);
    return ids.length;
  },

  /**
   * What each product's marketplace listings wrote for one fact, as evidence beside a picker
   * (readiness-fix Q6): never an answer, never pre-picked (parent Q42).
   */
  async saidFor(orgId: string, productIds: readonly string[], fact: string): Promise<Record<string, { channel: string; said: string }>> {
    if (productIds.length === 0) return {};
    const reads = await channelListingRepository.readsFor(orgId, productIds);
    const out: Record<string, { channel: string; said: string }> = {};
    const mappings = new Map<string, Awaited<ReturnType<typeof channelMapService.forFill>>>();
    for (const row of reads) {
      if (!row.productId || out[row.productId] || !isMarketplaceChannel(row.channel)) continue;
      const read = storedRead(row.attributes);
      if (!read?.type) continue;
      if (!mappings.has(row.channel)) mappings.set(row.channel, await channelMapService.forFill(row.channel));
      const attribute = mappings.get(row.channel)!.attributes.find((a) => a.theirCategory === read.type && a.fact === fact)?.theirAttribute;
      const said = attribute ? read.attributes[attribute]?.[0] : undefined;
      if (said) out[row.productId] = { channel: row.channel, said: said.slice(0, 80) };
    }
    return out;
  },

  /** The daily pass over every live connection (Q36). */
  async fillUnreadAll(): Promise<number> {
    let queued = 0;
    for (const connection of await channelConnectionRepository.live()) queued += await this.fillUnread(connection.id);
    return queued;
  },

  async enqueue(orgId: string, listingIds: readonly string[]): Promise<void> {
    await prisma.$transaction(async (tx) => this.enqueueIn(tx, orgId, listingIds));
  },

  /** The worker's job: read the listing now, store it, fill its product. A busy marketplace throws, so the queue retries. */
  async run(payload: ListingFactsPayload): Promise<FillOutcome> {
    const [row] = await channelListingRepository.forFacts(payload.orgId, { id: payload.listingId });
    if (!row?.productId || !isMarketplaceChannel(row.channel)) return { outcome: "not_linked" };
    if (row.connection.state !== CONNECTION_STATE.CONNECTED) return { outcome: "reconnect" };
    let read: ListingAttributes;
    try {
      read = await providerFor(row.channel).listingAttributes(
        () => channelConnectionService.accessToken(row.connectionId),
        row.connection.externalAccountId,
        { sku: row.sku, externalId: row.externalId },
      );
    } catch (error) {
      // A refused credential will not come right on a retry; the connection card already says reconnect.
      if (error instanceof MarketplaceAuthError) return { outcome: "reconnect" };
      throw error;
    }
    const readAt = new Date();
    await channelListingRepository.saveAttributes(row.id, read, readAt);
    return await this.fill(row, read, readAt);
  },

  /** What one listing's read fills on its product (D5): facts and measurements, then the details where they live (Q21). */
  async fill(row: FactsRow, read: ListingAttributes, readAt: Date): Promise<FillOutcome> {
    const channel = row.channel as MarketplaceChannel;
    const product = await productService.marketplaceFacts(row.orgId, row.productId!);
    if (!product) return { outcome: "not_linked" };
    const plan = await this.plan(row, read, product);
    const at = readAt.toISOString();
    const { details } = read;

    const brand = await brandService.fillFromMarketplace(row.orgId, product.brandId, {
      brand: details.brand,
      manufacturer: details.manufacturer,
      packerOrImporter: details.importer ?? details.packer,
      countryOfOrigin: details.countryOfOrigin,
    });
    const filled = await productService.fillFromMarketplace(row.orgId, product.id, {
      facts: parsed(plan.facts.map((f) => [f.key, entry(channel, f.value, f.said, at)])),
      measurements: parsed(plan.measurements.map((m) => [m.key, entry(channel, m.value, m.said, at)])),
      weightKg: details.weightKg,
      mrpPaise: details.mrpPaise,
      brandId: brand.brandId,
    });
    const hsn = details.hsn ? await orgListingDefaultsService.fillTaxCode(row.orgId, product.categoryId, details.hsn) : false;

    return {
      outcome: "filled",
      facts: filled?.facts.length ?? 0,
      measurements: filled?.measurements.length ?? 0,
      questions: plan.questions.length,
      details: [
        ...(filled?.weight ? ["weight"] : []),
        ...(filled?.mrp ? ["mrp"] : []),
        ...(filled?.brand ? ["brand"] : []),
        ...(hsn ? ["hsn"] : []),
        ...brand.filled,
      ],
    };
  },

  /** The fill's plan for one listing and product, from the stored read and today's mapping (D6). */
  async plan(
    row: Pick<FactsRow, "channel" | "orgId" | "attributeSkips">,
    read: ListingAttributes,
    product: NonNullable<Awaited<ReturnType<typeof productService.marketplaceFacts>>>,
  ): Promise<FillPlan> {
    const [mapping, type] = await Promise.all([
      channelMapService.forFill(row.channel as MarketplaceChannel),
      product.productType ? channelMapService.typeForFill(product.productType, row.orgId) : Promise.resolve(null),
    ]);
    return planFill({
      read,
      mapping,
      product: {
        productType: product.productType,
        facts: (product.facts ?? {}) as Record<string, { value: unknown }>,
        measurements: (product.measurements ?? {}) as Record<string, { value: unknown }>,
      },
      type,
      lists: type?.lists ?? {},
      skips: row.attributeSkips,
    });
  },

  /**
   * What the Settle page asks and fills (D9, Q35): the listing read now and stored, its marketplace
   * type mapped back to ours, and its facts planned for every type, so choosing a category shows
   * them at once. Matching plans only the product's own type and empty facts. Nulls when the
   * marketplace cannot be read; the page still opens.
   */
  async readNow(row: { id: string; channel: string; connectionId: string; sku: string; externalId: string | null; connection: { externalAccountId: string | null } }): Promise<ListingAttributes | null> {
    if (!isMarketplaceChannel(row.channel)) return null;
    try {
      const read = await providerFor(row.channel).listingAttributes(
        () => channelConnectionService.accessToken(row.connectionId),
        row.connection.externalAccountId,
        { sku: row.sku, externalId: row.externalId },
      );
      await channelListingRepository.saveAttributes(row.id, read, new Date());
      return read;
    } catch {
      return null;
    }
  },

  /** The Settle page's questions from a read; anything that fails here costs the section, never the page. */
  async settlePlan(
    row: { channel: string },
    orgId: string,
    product: { productType: string | null; facts: unknown; measurements: unknown } | null,
    read: ListingAttributes | null,
  ): Promise<{ type: SettleTypeDTO | null; facts: SettleFactsDTO | null }> {
    if (!read || !isMarketplaceChannel(row.channel)) return { type: null, facts: null };
    try {
      return await this.settleRead(row.channel, orgId, product, read);
    } catch (error) {
      console.error("[Settle] marketplace facts plan failed:", error);
      return { type: null, facts: null };
    }
  },

  async settleRead(
    channel: MarketplaceChannel,
    orgId: string,
    product: { productType: string | null; facts: unknown; measurements: unknown } | null,
    read: ListingAttributes,
  ): Promise<{ type: SettleTypeDTO | null; facts: SettleFactsDTO | null }> {
    const row = { channel };
    const [mapping, choices] = await Promise.all([channelMapService.forFill(row.channel), channelMapService.typeChoices()]);
    const keys = product ? (product.productType ? [product.productType] : []) : choices.map((c) => c.key);
    const views = await Promise.all(keys.map((key) => channelMapService.typeForFill(key, orgId)));
    const byType: Record<string, SettleTypeFactsDTO> = {};
    views.forEach((view, index) => {
      if (!view) return;
      const plan = planFill({
        read,
        mapping,
        product: { productType: keys[index], facts: entriesOf(product?.facts), measurements: entriesOf(product?.measurements) },
        type: view,
        lists: view.lists,
        skips: [],
      });
      const labelOf = (fact: string) => view.facts.find((f) => f.key === fact)?.label ?? fact;
      byType[keys[index]] = {
        fills: plan.facts.map((f) => ({
          fact: f.key,
          label: labelOf(f.key),
          value: shown(f.value, view.facts.find((x) => x.key === f.key), undefined, view),
        })),
        questions: plan.questions.map((q) => ({ fact: q.fact, label: labelOf(q.fact), said: q.said, options: q.options })),
        noMapping: plan.oldestCheck === null,
      };
    });
    const facts: SettleFactsDTO = {
      typeOfCategory: Object.fromEntries(choices.flatMap((c) => c.categories.map((cat) => [cat.id, c.key]))),
      byType,
      matching: product !== null,
      fixedType: product?.productType ?? null,
      saysNothing: !read.type && Object.keys(read.attributes).length === 0,
    };
    if (product || !read.type) return { type: null, facts };
    const outcome = typeFor({ productType: null, facts: {}, measurements: {} }, read.type, mapping);
    const type: SettleTypeDTO =
      outcome.kind === "mapped"
        ? { kind: "mapped", marketplaceType: read.type, types: choices.filter((c) => c.key === outcome.productType) }
        : outcome.kind === "choose"
          ? { kind: "choose", marketplaceType: read.type, types: choices.filter((c) => outcome.productTypes.includes(c.key)) }
          : { kind: "none", marketplaceType: read.type, types: choices };
    return { type, facts };
  },

  /**
   * What a settle writes from the Settle page (Q35): re-planned from the listing's stored read for
   * the type being saved, never from the browser; each answer is kept only when the fact is still
   * asked and the answer is one of ours for it. Empty when the listing was never read.
   */
  async settleFill(
    row: { channel: string; attributes: unknown; attributesReadAt: Date | null },
    orgId: string,
    target: { productType: string | null; facts: unknown; measurements: unknown } | { categoryId: string },
    answers: Readonly<Record<string, string>>,
  ): Promise<MarketplaceFill | null> {
    // A matched product carries its own type (and a categoryId too), so the shape is told by `productType`.
    const product =
      !("productType" in target)
        ? {
            productType: (await channelMapService.typeChoices()).find((c) => c.categories.some((cat) => cat.id === target.categoryId))?.key ?? null,
            facts: null,
            measurements: null,
          }
        : target;
    const read = storedRead(row.attributes);
    if (!read || !product.productType || !isMarketplaceChannel(row.channel)) return null;
    const [mapping, view] = await Promise.all([channelMapService.forFill(row.channel), channelMapService.typeForFill(product.productType, orgId)]);
    if (!view) return null;
    const plan = planFill({
      read,
      mapping,
      product: { productType: product.productType, facts: entriesOf(product.facts), measurements: entriesOf(product.measurements) },
      type: view,
      lists: view.lists,
      skips: [],
    });
    const at = (row.attributesReadAt ?? new Date()).toISOString();
    const channel = row.channel;
    const chosen = plan.questions.flatMap((q): Array<[string, MarketplaceEntry]> => {
      const key = answers[q.fact];
      const list = view.facts.find((f) => f.key === q.fact)?.list;
      // Any of our answers to that fact, not only the ones suggested first.
      if (!key || !list || !(view.lists[list] ?? []).some((o) => o.key === key)) return [];
      return [[q.fact, { ...entry(channel, key, q.said, at), source: { channel, value: q.said.slice(0, SAID_MAX), readAt: at, chosen: true } }]];
    });
    return {
      facts: parsed([...plan.facts.map((f): [string, MarketplaceEntry] => [f.key, entry(channel, f.value, f.said, at)]), ...chosen]),
      measurements: parsed(plan.measurements.map((m): [string, MarketplaceEntry] => [m.key, entry(channel, m.value, m.said, at)])),
      weightKg: null,
      mrpPaise: null,
      brandId: null,
    };
  },

  /** One card per linked listing on the product page (ux.md "Facts from Amazon card"), computed from the stored read (D6). */
  async cards(orgId: string, productId: string): Promise<ProductMarketplaceFactsDTO[]> {
    const rows = (await channelListingRepository.forFacts(orgId, { productId })).filter((r) => isMarketplaceChannel(r.channel) && !r.goneAt);
    if (rows.length === 0) return [];
    const product = await productService.marketplaceFacts(orgId, productId);
    if (!product) return [];
    const [type, choices] = await Promise.all([
      product.productType ? channelMapService.typeForFill(product.productType, orgId) : Promise.resolve(null),
      channelMapService.typeChoices(),
    ]);
    return await Promise.all(rows.map((row) => this.card(row, product, type, choices)));
  },

  async card(row: FactsRow, product: ProductFacts, type: FillTypeView | null, choices: TypeChoiceDTO[]): Promise<ProductMarketplaceFactsDTO> {
    const channel = row.channel as MarketplaceChannel;
    const read = storedRead(row.attributes);
    const card: ProductMarketplaceFactsDTO = {
      listingId: row.id,
      channel,
      label: CHANNEL_LABELS[channel],
      sku: row.sku,
      title: row.title,
      state: FACTS_STATE.READY,
      readAt: row.attributesReadAt?.toISOString() ?? null,
      marketplaceType: read?.type ?? null,
      filled: type ? this.filledRows(channel, product, type) : [],
      questions: [],
      skipped: [],
      staleCheckedOn: null,
      types: [],
    };
    if (row.connection.state !== CONNECTION_STATE.CONNECTED) return { ...card, state: FACTS_STATE.RECONNECT };
    if (!read) return { ...card, state: FACTS_STATE.NOT_READ };
    // Planned without the skips, so a skipped question can be listed to ask again.
    const plan = await this.plan({ ...row, attributeSkips: [] }, read, product);
    const saysNothing = !read.type && Object.keys(read.attributes).length === 0;

    if (plan.type.kind !== "own") {
      const pick = (keys: string[]) => choices.filter((c) => keys.includes(c.key));
      if (plan.type.kind === "mapped") return { ...card, state: FACTS_STATE.CATEGORY_TO_CONFIRM, types: pick([plan.type.productType]) };
      if (plan.type.kind === "choose") return { ...card, state: FACTS_STATE.TYPE_TO_CONFIRM, types: pick(plan.type.productTypes) };
      if (plan.type.kind === "none") return { ...card, state: FACTS_STATE.NO_MATCHING_TYPE, types: choices };
      return { ...card, state: saysNothing ? FACTS_STATE.NO_ANSWERS : FACTS_STATE.NO_TYPE };
    }
    if (saysNothing) return { ...card, state: FACTS_STATE.NO_ANSWERS };
    const labelOf = (fact: string) => type?.facts.find((f) => f.key === fact)?.label ?? fact;
    if (plan.oldestCheck === null) return { ...card, state: FACTS_STATE.NO_MAPPING };
    return {
      ...card,
      questions: plan.questions
        .filter((q) => !row.attributeSkips.includes(q.fact))
        .map((q) => ({ fact: q.fact, label: labelOf(q.fact), said: q.said, options: q.options })),
      skipped: plan.questions.filter((q) => row.attributeSkips.includes(q.fact)).map((q) => ({ fact: q.fact, label: labelOf(q.fact) })),
      staleCheckedOn: mappingIsStale(plan.oldestCheck) ? plan.oldestCheck.toISOString() : null,
    };
  },

  /** Every answer this marketplace filled, or once filled and the shop since changed (Q7, Q31). */
  filledRows(channel: string, product: ProductFacts, type: FillTypeView): MarketplaceFactRowDTO[] {
    const rows: MarketplaceFactRowDTO[] = [];
    const facts = entriesOf(product.facts);
    for (const fact of type.facts) {
      const entry = facts[fact.key];
      if (!entry?.source || entry.source.channel !== channel) continue;
      rows.push({
        fact: fact.key,
        column: "facts",
        label: fact.label,
        value: shown(entry.value, fact, undefined, type),
        said: entry.source.value,
        chosen: entry.source.chosen === true,
        changed: entry.origin !== "marketplace",
        options: fact.list ? (type.lists[fact.list] ?? []) : [],
      });
    }
    const measurements = entriesOf(product.measurements);
    for (const measure of type.measures) {
      const entry = measurements[measure.key];
      if (!entry?.source || entry.source.channel !== channel) continue;
      rows.push({
        fact: measure.key,
        column: "measurements",
        label: measure.label,
        value: shown(entry.value, undefined, measure.unit, type),
        said: entry.source.value,
        chosen: false,
        changed: entry.origin !== "marketplace",
        options: [],
      });
    }
    return rows;
  },

  /** "Fill from {marketplace}": read now, in the request, so the card can say busy or reconnect at once (Q32). */
  async fillNow(orgId: string, listingId: string): Promise<FillNowOutcome> {
    try {
      return (await this.run({ orgId, listingId })).outcome;
    } catch (error) {
      if (error instanceof MarketplaceUnavailableError) return "busy";
      throw error;
    }
  },

  /** The card's commands (D8). Each changes one thing, through its aggregate's repository. */
  async change(orgId: string, listingId: string, change: MarketplaceFactsChange): Promise<{ outcome?: FillNowOutcome }> {
    if (change.action === "fill") return { outcome: await this.fillNow(orgId, listingId) };
    const [row] = await channelListingRepository.forFacts(orgId, { id: listingId });
    if (!row?.productId) throw new NotFoundError("Linked listing");
    if (change.action === "skip") {
      await channelListingRepository.setSkip(row.id, orgId, change.fact, change.skipped);
      return {};
    }
    const product = await productService.marketplaceFacts(orgId, row.productId);
    if (!product) throw new NotFoundError("Product");
    const read = storedRead(row.attributes);
    const readAt = row.attributesReadAt ?? new Date();

    if (change.action === "category") {
      const choices = await channelMapService.typeChoices();
      const owner = choices.find((c) => c.categories.some((cat) => cat.id === change.categoryId));
      if (!owner) throw new DomainError("Pick one of the categories shown.", { status: 400, field: "categoryId" });
      await productService.setCategoryFromMarketplace(orgId, product.id, change.categoryId, owner.key);
      // Now typed, the stored read fills its facts at once; nothing is asked of the marketplace again.
      if (read) await this.fill(row, read, readAt);
      return {};
    }

    const type = product.productType ? await channelMapService.typeForFill(product.productType, orgId) : null;
    if (!type || !read) throw new DomainError("Nothing to fill on this product yet.", { status: 409 });
    const channel = row.channel as MarketplaceChannel;
    const at = readAt.toISOString();

    if (change.action === "reset") {
      const column = type.measures.some((m) => m.key === change.fact) ? "measurements" : "facts";
      const without = { ...product, [column]: { ...entriesOf(product[column]), [change.fact]: undefined } };
      const plan = await this.plan(row, read, without);
      const fresh = [...plan.facts, ...plan.measurements].find((f) => f.key === change.fact);
      const asked = plan.questions.some((q) => q.fact === change.fact);
      if (!fresh && !asked) throw new DomainError(`${CHANNEL_LABELS[channel]} has no answer for this any more. Nothing was changed.`, { status: 409 });
      // An answer that has to be chosen goes back to being asked.
      await productService.setMarketplaceAnswer(orgId, product.id, column, change.fact, fresh ? entry(channel, fresh.value, fresh.said, at) : null, false);
      return {};
    }

    const fact = type.facts.find((f) => f.key === change.fact);
    const options = fact?.list ? (type.lists[fact.list] ?? []) : [];
    const picked = options.find((o) => o.key === change.value);
    if (!fact || !picked) throw new DomainError("Pick one of the answers shown.", { status: 400, field: "value" });
    const before = entriesOf(product.facts)[fact.key];

    if (change.action === "change") {
      // The shop's own answer now; the marketplace's words stay beside it (Q31).
      await productService.setMarketplaceAnswer(orgId, product.id, "facts", fact.key, { value: picked.key, origin: "product", ...(before?.source ? { source: before.source } : {}) }, false);
      return {};
    }
    const question = (await this.plan(row, read, product)).questions.find((q) => q.fact === fact.key);
    const said = (question?.said ?? before?.source?.value ?? "").slice(0, SAID_MAX);
    const saved = await productService.setMarketplaceAnswer(orgId, product.id, "facts", fact.key, { ...entry(channel, picked.key, said, at), source: { channel, value: said, readAt: at, chosen: true } }, true);
    if (saved && !saved.saved) {
      const current = options.find((o) => o.key === saved.current)?.label ?? String(saved.current);
      throw new ConflictError(`You already answered this: ${current}. Nothing was changed.`, { field: "value" });
    }
    return {};
  },
};
