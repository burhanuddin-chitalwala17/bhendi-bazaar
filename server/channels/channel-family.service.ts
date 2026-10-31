import { prisma } from "@server/shared/prisma";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { CHANNEL_LABELS } from "@server/shared/channels";
import { uniqueViolationFields } from "@server/shared/constraint";
import { ConflictError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { orgAddressService } from "@server/catalog/org.address.service";
import { productService } from "@server/catalog/product.service";
import { productsService } from "@server/catalog/admin.product.service";
import { mediaImportService } from "@server/catalog/media-import.service";
import { DEFAULT_WEIGHT_KG, type MarketplaceEntry, type MarketplaceFill } from "@server/catalog/admin.product.types";
import { channelMapService } from "@server/listing/channel-map.service";
import { productFamilyService } from "@server/listing/product-family.service";

import { LISTING_STATUS, isMarketplaceChannel, type ListingStatus, type MarketplaceChannel } from "./channel-connection.types";
import { channelConnectionService } from "./channel-connection.service";
import { channelListingRepository } from "./channel-listing.repository";
import { channelFactsService, storedRead } from "./channel-facts.service";
import type { SettleTypeDTO } from "./channel-facts.types";
import {
  FAMILY_MAX_MEMBERS,
  type FamilyMemberDTO,
  type FamilyPageDTO,
  type FamilySettleInput,
  type FamilySettleResultDTO,
  type FamilyTypePlanDTO,
  type FamilyValueDTO,
} from "./channel-family.types";
import { typeFor } from "./fact-fill";
import { copyablePhotos } from "./listing-photos";
import { PHOTO_COPY_MODE, listingPhotosSpec, type ListingPhotosPayload } from "./listing-photos.job";
import { skuKey } from "./listing-match";
import { planFamily, type FamilyPlan, type MemberValue, type SharedFill } from "./family-plan";
import { providerFor } from "./providers";
import type { ListingAttributes } from "./providers/listing-read";

/**
 * One family from several marketplace listings (family-merge): the page's live read and plan.
 * The save is in the same service, below. Nothing is written to a marketplace (Q14).
 */

type FamilyRow = Awaited<ReturnType<typeof channelListingRepository.forFamily>>[number];
type TypeView = NonNullable<Awaited<ReturnType<typeof channelMapService.typeForFill>>>;

/** Reads at most this many listings at once, inside Amazon's five a second per shop. */
const READ_CONCURRENCY = 2;

async function inBatches<T, R>(items: readonly T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(work))));
  return out;
}

/** An axis value as the shop reads it: a list answer by its label, a measurement with its unit. */
export function displayValue(value: MemberValue["value"], axis: string, view: TypeView): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const measure = view.measures.find((m) => m.key === axis);
  if (measure) return `${value} ${measure.unit}`;
  const list = view.facts.find((f) => f.key === axis)?.list;
  return (list ? view.lists[list]?.find((o) => o.key === value)?.label : undefined) ?? String(value);
}

function labelOf(attr: string, view: TypeView): string {
  return view.facts.find((f) => f.key === attr)?.label ?? view.measures.find((m) => m.key === attr)?.label ?? attr;
}

export function planDto(plan: FamilyPlan, view: TypeView): FamilyTypePlanDTO {
  const value = (v: MemberValue, axis: string): FamilyValueDTO => ({ value: v.value, display: displayValue(v.value, axis, view), from: v.from });
  return {
    label: view.label,
    axes: plan.axes.map((key) => ({ key, label: labelOf(key, view), added: plan.added.includes(key), unit: view.measures.find((m) => m.key === key)?.unit })),
    members: plan.members.map((m) => ({
      listingId: m.key,
      values: Object.fromEntries(Object.entries(m.values).map(([axis, v]) => [axis, value(v, axis)])),
      questions: m.questions.map((q) => ({ fact: q.fact, label: labelOf(q.fact, view), said: q.said, options: q.options })),
    })),
    shared: [...plan.shared.facts, ...plan.shared.measurements].map((f) => ({ fact: f.key, label: labelOf(f.key, view), value: displayValue(f.value, f.key, view) })),
    sharedQuestions: plan.sharedQuestions.map((q) => ({ fact: q.fact, label: labelOf(q.fact, view), said: q.said, options: q.options })),
    duplicates: plan.duplicates,
  };
}

export const channelFamilyService = {
  /** The listings a page or a save names, checked: this shop's, one connection, none left off (Q23). */
  async rows(orgId: string, listingIds: readonly string[]): Promise<FamilyRow[]> {
    const ids = [...new Set(listingIds)];
    // In the order the shop listed them, never the database's sort, which varies by its collation.
    const found = new Map((await channelListingRepository.forFamily(ids, orgId)).map((r) => [r.id, r]));
    const rows = ids.flatMap((id) => found.get(id) ?? []);
    if (rows.length !== ids.length || rows.length === 0) throw new NotFoundError("Listing");
    if (new Set(rows.map((r) => r.connectionId)).size > 1) {
      throw new DomainError("Pick listings from one marketplace for a family.", { status: 400, field: "listingIds" });
    }
    if (rows.some((r) => r.leftOffAt)) {
      throw new DomainError("One of these listings is left off Bhendi Bazaar. Bring it back first.", { status: 400, field: "listingIds" });
    }
    return rows;
  },

  /** Each member's read: live, stored on the listing, or the last stored one when the marketplace fails (D2). */
  async reads(rows: readonly FamilyRow[]): Promise<Map<string, { read: ListingAttributes | null; failed: boolean }>> {
    type Read = { read: ListingAttributes | null; failed: boolean };
    const entries = await inBatches(rows, READ_CONCURRENCY, async (row): Promise<[string, Read]> => {
      if (!isMarketplaceChannel(row.channel)) return [row.id, { read: storedRead(row.attributes), failed: true }];
      try {
        const read = await providerFor(row.channel).listingAttributes(
          () => channelConnectionService.accessToken(row.connectionId),
          row.connection.externalAccountId,
          { sku: row.sku, externalId: row.externalId },
        );
        await channelListingRepository.saveAttributes(row.id, read, new Date());
        return [row.id, { read, failed: false }];
      } catch {
        return [row.id, { read: storedRead(row.attributes), failed: true }];
      }
    });
    return new Map(entries);
  },

  /** The family's starting name and description: Amazon's parent, else the first member (Q2, Q10). */
  async parentText(rows: readonly FamilyRow[]): Promise<{ name: string; description: string }> {
    const first = rows[0];
    const fallback = { name: first.parentTitle ?? first.title ?? first.sku, description: "" };
    if (!first.parentSku || !isMarketplaceChannel(first.channel)) return fallback;
    try {
      const parent = await providerFor(first.channel).listingDetail(
        () => channelConnectionService.accessToken(first.connectionId),
        first.connection.externalAccountId,
        { sku: first.parentSku, externalId: null },
      );
      return { name: parent.title ?? fallback.name, description: parent.description ?? "" };
    } catch {
      return fallback;
    }
  },

  /** The family page (ux.md "Family page"): the first 30 listings read live and planned for every type. */
  async page(orgId: string, listingIds: readonly string[]): Promise<FamilyPageDTO | null> {
    let all: FamilyRow[];
    try {
      all = await this.rows(orgId, listingIds);
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
    // A family some of these already belong to is the one being added to (Q20); its members are
    // context, and only listings outside it fill the page's 30 (Q19's leftovers).
    const familyId = all.map((r) => r.product?.familyId).find((id): id is string => !!id) ?? null;
    const family = familyId ? await productFamilyService.byId(orgId, familyId).catch(() => null) : null;
    const rows = all.filter((r) => !family || r.product?.familyId !== family.id).slice(0, FAMILY_MAX_MEMBERS);
    if (rows.length === 0) return null;
    const channel = rows[0].channel as MarketplaceChannel;
    const [reads, text, locations, mapping, choices, existing] = await Promise.all([
      this.reads(rows),
      this.parentText(rows),
      orgAddressService.listLocations(orgId),
      channelMapService.forFill(channel),
      channelMapService.typeChoices(),
      family ? productService.familyMembers(orgId, family.id) : Promise.resolve([]),
    ]);

    // Every type is planned, so the category the owner picks shows its facts at once (Q35's pattern).
    const typeKeys = family?.productType ? [family.productType] : choices.map((c) => c.key);
    const views = await Promise.all(typeKeys.map((key) => channelMapService.typeForFill(key, orgId)));
    const byType: Record<string, FamilyTypePlanDTO> = {};
    views.forEach((view, index) => {
      if (!view) return;
      const plan = planFamily({
        members: rows.map((r) => ({ key: r.id, read: reads.get(r.id)?.read ?? null, existing: r.product ? { facts: r.product.facts, measurements: r.product.measurements } : null })),
        context: existing.map((p) => ({ key: `product:${p.id}`, read: null, existing: { facts: p.facts, measurements: p.measurements } })),
        mapping,
        productType: typeKeys[index],
        type: view,
        lists: view.lists,
        typeAxes: family?.variantAxis ?? view.variantAxis,
      });
      byType[typeKeys[index]] = planDto(plan, view);
    });

    const firstType = rows.map((r) => reads.get(r.id)?.read?.type).find((t): t is string => !!t) ?? null;
    let type: SettleTypeDTO | null = null;
    if (!family && firstType) {
      const outcome = typeFor({ productType: null, facts: {}, measurements: {} }, firstType, mapping);
      type =
        outcome.kind === "mapped"
          ? { kind: "mapped", marketplaceType: firstType, types: choices.filter((c) => c.key === outcome.productType) }
          : outcome.kind === "choose"
            ? { kind: "choose", marketplaceType: firstType, types: choices.filter((c) => outcome.productTypes.includes(c.key)) }
            : { kind: "none", marketplaceType: firstType, types: choices };
    }
    const typed = type?.kind === "mapped" && type.types[0]?.categories.length === 1 ? type.types[0].categories[0].id : null;

    const members: FamilyMemberDTO[] = rows.map((r) => ({
      listingId: r.id,
      sku: r.sku,
      externalId: r.externalId,
      title: r.title,
      imageUrl: r.imageUrl,
      status: r.status as ListingStatus | null,
      live: r.status === LISTING_STATUS.LIVE && r.goneAt === null,
      pricePaise: r.pricePaise,
      quantity: r.quantity,
      readFailed: reads.get(r.id)?.failed ?? true,
      product: r.product
        ? {
            id: r.product.id,
            name: r.product.name,
            sku: r.product.sku,
            pricePaise: r.product.price,
            archived: r.product.archivedAt !== null,
            family: r.product.family && r.product.family.id !== family?.id ? r.product.family : null,
          }
        : null,
    }));

    return {
      channel,
      label: CHANNEL_LABELS[channel],
      family: family ? { id: family.id, name: family.name, productType: family.productType, memberCount: existing.length, members: existing.map((p) => p.name) } : null,
      name: family?.name ?? text.name,
      description: family?.description ?? text.description,
      members,
      more: all.filter((r) => !family || r.product?.familyId !== family.id).length - rows.length,
      type,
      defaultCategoryId: typed,
      typeOfCategory: Object.fromEntries(choices.flatMap((c) => c.categories.map((cat) => [cat.id, c.key]))),
      byType,
      locations: locations.filter((l) => l.isActive).map((l) => ({ id: l.id, name: l.name })),
    };
  },

  /**
   * "Make family of n" (D3): re-planned here from the stored reads, refused before anything is
   * written when two members look the same, one is unanswered, a SKU is taken or a product sits in
   * another family; then one transaction makes the family and every member, or nothing.
   */
  async settle(orgId: string, userId: string, input: FamilySettleInput): Promise<FamilySettleResultDTO> {
    const chosen = new Map(input.members.map((m) => [m.listingId, m]));
    const included = input.listingIds.filter((id) => chosen.get(id)?.include !== false).slice(0, FAMILY_MAX_MEMBERS);
    if (included.length < 2 && !input.familyId) throw new DomainError("A family needs at least two members.", { status: 400, field: "members" });
    // The family being added to, and its members: context for axes and duplicates (Q20).
    const family = input.familyId ? await productFamilyService.byId(orgId, input.familyId) : null;
    const existing = family ? await productService.familyMembers(orgId, family.id) : [];
    const rows = (await this.rows(orgId, included)).filter((r) => !family || r.product?.familyId !== family.id);
    if (rows.length === 0) throw new DomainError("These listings are already in the family.", { status: 400, field: "listingIds" });
    const channel = rows[0].channel as MarketplaceChannel;
    const label = CHANNEL_LABELS[channel];

    // One category, so one type, for every member (Q12, Q17): the chosen one, or the family's.
    const NO_TYPE = "Pick a category with a product type. Without one, members can't be told apart.";
    const choices = await channelMapService.typeChoices();
    const typeOfCategory = (id: string | null | undefined) => (id ? (choices.find((c) => c.categories.some((cat) => cat.id === id))?.key ?? null) : null);
    const categoryId = input.categoryId ?? existing[0]?.categoryId ?? rows.find((r) => r.product)?.product?.categoryId ?? null;
    const productType = family?.productType ?? typeOfCategory(categoryId);
    if (!productType || !categoryId || typeOfCategory(categoryId) !== productType) {
      throw new DomainError(NO_TYPE, { status: 400, field: "categoryId" });
    }
    const view = await channelMapService.typeForFill(productType, orgId);
    if (!view) throw new DomainError(NO_TYPE, { status: 400, field: "categoryId" });
    // A product of another type would be asked other questions than its siblings (ADR-0043 D2).
    const misfit = rows.find((r) => r.product?.productType && r.product.productType !== productType);
    if (misfit) {
      throw new ConflictError(`${misfit.product!.name} is a different kind of product from this family. Change its category first, or leave it out.`, { field: "members" });
    }

    // A product in another family moves only when the owner said so (Q11).
    for (const row of rows) {
      const other = row.product?.family && row.product.family.id !== family?.id ? row.product.family : null;
      if (other && !chosen.get(row.id)?.move) {
        throw new ConflictError(`${row.product!.name} is in family ${other.name}. Choose Move here, or leave it out.`, { field: "members" });
      }
    }

    // Planned again here, from what was read: the browser's values never decide (D3).
    const mapping = await channelMapService.forFill(channel);
    const plan = planFamily({
      members: rows.map((r) => ({ key: r.id, read: storedRead(r.attributes), existing: r.product ? { facts: r.product.facts, measurements: r.product.measurements } : null })),
      context: existing.map((p) => ({ key: `product:${p.id}`, read: null, existing: { facts: p.facts, measurements: p.measurements } })),
      mapping,
      productType,
      type: view,
      lists: view.lists,
      typeAxes: family?.variantAxis ?? view.variantAxis,
      answers: input.answers,
      removed: input.removedAxes.filter((a) => !(family?.variantAxis ?? view.variantAxis).includes(a)),
    });
    const nameOf = (id: string) => rows.find((r) => r.id === id)?.sku ?? existing.find((p) => `product:${p.id}` === id)?.sku ?? id;
    if (plan.axes.length === 0) throw new DomainError(NO_TYPE, { status: 400, field: "categoryId" });
    if (plan.axes.length > 6) {
      throw new DomainError("A family can vary by at most 6 things. Remove one, or leave a member out.", { status: 400, field: "members" });
    }
    const missing = plan.missing[0];
    if (missing) {
      const ask = plan.members.find((m) => m.key === missing.key)?.questions.find((q) => q.fact === missing.axis);
      const what = labelOf(missing.axis, view).toLowerCase();
      throw new DomainError(`Give each member its ${what}: ${ask?.said || `SKU ${nameOf(missing.key)}`} is not answered.`, { status: 400, field: "members" });
    }
    const dup = plan.duplicates[0];
    if (dup) {
      const values = plan.members.find((m) => m.key === dup[0] || m.key === dup[1])!.values;
      const words = plan.axes.map((a) => displayValue(values[a].value, a, view)).join(" · ");
      throw new DomainError(`Two members are ${words}: SKU ${nameOf(dup[0])} and ${nameOf(dup[1])}. Change one, or leave one out.`, { status: 400, field: "members" });
    }
    // A shared fact left unanswered does not block: the product card asks it later (marketplace-facts).

    // New members: SKU, price and stock, checked before anything is written.
    const fresh = rows.filter((r) => !r.product);
    const taken = await productService.listForMatching(orgId);
    const seen = new Set<string>();
    const planned = fresh.map((r) => {
      const m = chosen.get(r.id);
      const sku = (m?.sku ?? r.sku).trim();
      const pricePaise = m?.pricePaise ?? r.pricePaise;
      if (!sku) throw new DomainError(`Give SKU ${r.sku} a SKU.`, { status: 400, field: "members" });
      if (!pricePaise || pricePaise <= 0) throw new DomainError(`Give ${r.title ?? r.sku} a price.`, { status: 400, field: "members" });
      const owner = taken.find((p) => p.sku !== null && skuKey(p.sku) === skuKey(sku));
      if (owner) throw new ConflictError(`SKU ${owner.sku} is already used by ${owner.name}. Pick another SKU.`, { field: "members" });
      if (seen.has(skuKey(sku))) throw new ConflictError(`Two members have SKU ${sku}. Pick another SKU for one.`, { field: "members" });
      seen.add(skuKey(sku));
      return { row: r, sku, pricePaise, stock: m?.stock ?? [] };
    });
    const owned = new Set((await orgAddressService.listLocations(orgId)).map((l) => l.id));
    if (planned.some((p) => p.stock.some((s) => !owned.has(s.locationId)))) {
      throw new DomainError("One of the chosen pickup locations does not belong to this organisation", { status: 400, field: "members" });
    }

    // Main photos first, four at a time; one that fails names its member and saves nothing (D5).
    const photos = new Map<string, string[]>();
    const mains = new Map<string, string>();
    await inBatches(planned, 4, async (p) => {
      let urls: string[] = [];
      try {
        urls = copyablePhotos((await providerFor(channel).listingDetail(
          () => channelConnectionService.accessToken(p.row.connectionId),
          p.row.connection.externalAccountId,
          { sku: p.row.sku, externalId: p.row.externalId },
        )).photoUrls);
      } catch {
        urls = p.row.imageUrl ? copyablePhotos([p.row.imageUrl]) : [];
      }
      if (urls.length === 0) throw new DomainError(`Couldn't copy ${p.row.title ?? p.row.sku}'s main photo from ${label}. Try again, or leave it out.`, { status: 502, field: "members" });
      const main = await mediaImportService.fromUrl(orgId, userId, urls[0]).catch(() => {
        throw new DomainError(`Couldn't copy ${p.row.title ?? p.row.sku}'s main photo from ${label}. Try again, or leave it out.`, { status: 502, field: "members" });
      });
      mains.set(p.row.id, main);
      photos.set(p.row.id, urls.slice(1));
    });

    const readAt = (r: FamilyRow) => (r.attributesReadAt ?? new Date()).toISOString();
    const entry = (r: FamilyRow, origin: MarketplaceEntry["origin"], value: MarketplaceEntry["value"], said: string | null): MarketplaceEntry =>
      origin === "family" ? { value, origin } : { value, origin, source: { channel, value: (said ?? "").slice(0, 500), readAt: readAt(r) } };
    const now = new Date();
    const held = (value: unknown) =>
      Object.entries(value && typeof value === "object" ? (value as Record<string, { value?: unknown }>) : {}).flatMap(([key, e]) =>
        typeof e?.value === "string" || typeof e?.value === "number" || typeof e?.value === "boolean" ? [{ key, value: e.value }] : [],
      );
    const familyShared = { facts: held(family?.facts), measurements: held(family?.measurements) };

    const result = await prisma.$transaction(
      async (tx) => {
        // The listings first, in one order, so two saves of one group queue rather than cross (D3).
        const order = [...rows].sort((a, b) => a.id.localeCompare(b.id));
        if ((await channelListingRepository.lockForFamily(tx, order.map((r) => ({ id: r.id, productId: r.productId })), orgId)) !== rows.length) {
          throw new ConflictError("Some of these listings were just settled. Nothing was changed.", { field: "listingIds" });
        }
        const first = rows[0];
        // A fact the shop typed on a product is the shop's, not the listing's (ADR-0051).
        const own = (f: SharedFill) => (f.fromListing ? entry(first, "marketplace", f.value, f.said) : { value: f.value, origin: "product" as const });
        const sharedFacts = Object.fromEntries(plan.shared.facts.map((f) => [f.key, own(f)]));
        const sharedMeasures = Object.fromEntries(plan.shared.measurements.map((f) => [f.key, own(f)]));
        const target = family
          ? family
          : await productFamilyService.createFromMarketplaceIn(tx, {
              orgId,
              name: input.name,
              description: input.description.trim() || null,
              productType,
              variantAxis: plan.axes,
              facts: sharedFacts,
              measurements: sharedMeasures,
            });
        if (family) await productFamilyService.addAxesIn(tx, orgId, family.id, plan.axes);

        for (const member of plan.members) {
          const row = rows.find((r) => r.id === member.key)!;
          let productId: string;
          if (row.product) {
            const from = row.product.familyId && row.product.familyId !== target.id ? row.product.familyId : null;
            if (row.product.familyId !== target.id && !(await productService.setFamilyIn(tx, orgId, row.product.id, target.id, from))) {
              throw new ConflictError(`${row.product.name} changed while you were here. Nothing was changed.`, { field: "members" });
            }
            productId = row.product.id;
          } else {
            const p = planned.find((x) => x.row.id === row.id)!;
            const created = await productsService.createForListingIn(
              tx,
              {
                name: (row.title ?? `${input.name} ${Object.values(member.values).map((v) => String(v.value)).join(" ")}`).slice(0, 250),
                description: input.description,
                price: p.pricePaise,
                orgId,
                categoryId,
                media: [{ kind: "IMAGE", ref: mains.get(row.id)!, isThumbnail: true }],
                stockLocations: p.stock.map((s) => ({ orgAddressId: s.locationId, quantity: s.quantity })),
                sku: p.sku,
                weight: DEFAULT_WEIGHT_KG,
                familyId: target.id,
              },
              // A member whose listing is not on sale there is kept off sale here too (Q24).
              !(row.status === LISTING_STATUS.LIVE && row.goneAt === null),
            );
            productId = created.id;
            let linked: number;
            try {
              linked = await channelListingRepository.settleLink(tx, [row.id], orgId, productId, now);
            } catch (error) {
              if (uniqueViolationFields(error) !== null) throw new ConflictError("Some of these listings were just settled. Nothing was changed.", { field: "listingIds" });
              throw error;
            }
            if (linked !== 1) throw new ConflictError("Some of these listings were just settled. Nothing was changed.", { field: "listingIds" });
            const rest = photos.get(row.id) ?? [];
            if (rest.length > 0) {
              await channelListingRepository.startPhotoCopy(tx, row.id, rest.length, PHOTO_COPY_MODE.APPEND, now);
              const payload: ListingPhotosPayload = { orgId, listingId: row.id, productId, mode: PHOTO_COPY_MODE.APPEND, skipFirst: true };
              await enqueue(tx, listingPhotosSpec, payload);
            }
          }
          // Facts where they belong (D4): shared ones marked as the family's, the member's own as the marketplace's.
          // What a member inherits is what its family holds: the family's own facts when adding (D4).
          const inherited = family ? familyShared.facts : plan.shared.facts;
          const inheritedMeasures = family ? familyShared.measurements : plan.shared.measurements;
          const fill: MarketplaceFill = {
            facts: {
              ...Object.fromEntries(inherited.map((f) => [f.key, entry(row, "family", f.value, null)])),
              ...Object.fromEntries(member.facts.map((f) => [f.key, entry(row, "marketplace", f.value, f.said)])),
              ...Object.fromEntries(Object.entries(member.values).filter(([axis]) => !view.measures.some((m) => m.key === axis)).map(([axis, v]) => [axis, entry(row, "marketplace", v.value, v.said)])),
            },
            measurements: {
              ...Object.fromEntries(inheritedMeasures.map((f) => [f.key, entry(row, "family", f.value, null)])),
              ...Object.fromEntries(member.measurements.map((f) => [f.key, entry(row, "marketplace", f.value, f.said)])),
              ...Object.fromEntries(Object.entries(member.values).filter(([axis]) => view.measures.some((m) => m.key === axis)).map(([axis, v]) => [axis, entry(row, "marketplace", v.value, v.said)])),
            },
            weightKg: null,
            mrpPaise: null,
            brandId: null,
          };
          await productService.fillFromMarketplace(orgId, productId, fill, tx);
        }
        // Each listing then fills its details on the worker, as a single settle does (marketplace-facts D7).
        await channelFactsService.enqueueIn(tx, orgId, rows.map((r) => r.id));
        return { familyId: target.id, familyName: family?.name ?? input.name.trim() };
      },
      { timeout: 60_000 },
    );

    const axis = labelOf(plan.axes[0], view).toLowerCase();
    return { ...result, members: plan.members.length, axisWord: plan.members.length === 1 ? axis : `${axis}s` };
  },
};
