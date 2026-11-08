/**
 * Filling a product from its marketplace listing against a real schema (marketplace-facts D5–D7).
 * The marketplace is a fake provider; the mapping rows are test-owned (an Amazon type no reference
 * row names). Under test: only empty answers fill, an edit made meanwhile wins, the details land
 * on the product, its brand and the shop's defaults only where empty, and a settle queues the fill.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NO_DETAILS, type ListingAttributes } from "@server/channels/providers/listing-read";
import { isDisposableDb, ensureFixtures, setAnswers, answersOf } from "../helpers/test-db";

const fake = vi.hoisted(() => {
  const state: { read: unknown } = { read: null };
  const provider = {
    configured: () => true,
    listingAttributes: async () => state.read,
    listingDetail: async () => ({ title: "From the marketplace", description: "Long", photoUrls: ["https://m.media-amazon.com/main.jpg"] }),
  };
  return { state, provider };
});

vi.mock("@server/channels/providers", () => ({ providerFor: () => fake.provider }));
vi.mock("@server/catalog/media-import.service", () => ({ mediaImportService: { fromUrl: async () => "https://store.example/main.jpg" } }));

const TYPE = "BBTEST_RUG";

describe.skipIf(!isDisposableDb)("filling a product from its marketplace listing (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let facts: typeof import("@server/channels/channel-facts.service").channelFactsService;
  let products: typeof import("@server/catalog/product.service").productService;
  let orgId: string;
  let userId: string;
  let categoryId: string;
  let locationId: string;
  let connectionId: string;
  const stamp = Date.now();

  const read = (over: Partial<ListingAttributes> = {}): ListingAttributes => ({
    type: TYPE,
    attributes: { color: ["Green"], material: ["Silk-like satin weave"], care_instructions: ["Hand wash"], number_of_items: ["2"] },
    details: { ...NO_DETAILS, weightKg: 1, mrpPaise: 145_000, hsn: "63049291", brand: "Generic", manufacturer: "Niqab Boutique", countryOfOrigin: "IN" },
    ...over,
  });

  const product = async ({ facts: given, measurements, ...extra }: Record<string, unknown> = {}) => {
    const row = await prisma.product.create({
      data: {
        name: `Mat ${stamp}`,
        slug: `mf-${stamp}-${Math.random().toString(36).slice(2, 8)}`,
        description: "A mat",
        price: 99_900,
        categoryId,
        thumbnail: "/brand/bhendi-bazaar.png",
        orgId,
        productType: "prayer-mat",
        ...extra,
      },
      select: { id: true },
    });
    if (given || measurements) await setAnswers(row.id, { facts: given, measurements, weight: extra.weight as number | undefined });
    return row;
  };

  const linked = async (productId: string) =>
    prisma.channelListing.create({
      data: { connectionId, orgId, channel: "amazon", sku: `MF-${stamp}-${productId}`, skuKey: `mf-${stamp}-${productId}`, productId, linkSource: "OWNER", linkedAt: new Date(), lastSeenAt: new Date() },
      select: { id: true },
    });

  const cleanup = async () => {
    await prisma.channelListing.deleteMany({ where: { orgId } });
    await prisma.product.deleteMany({ where: { orgId, name: `Mat ${stamp}` } });
    await prisma.product.deleteMany({ where: { orgId, sku: { startsWith: `MF-${stamp}` } } });
    await prisma.brand.deleteMany({ where: { orgId, name: { startsWith: `BBT ${stamp}` } } });
    await prisma.orgListingDefaults.deleteMany({ where: { orgId } });
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelFactsService: facts } = await import("@server/channels/channel-facts.service"));
    ({ productService: products } = await import("@server/catalog/product.service"));
    ({ orgId, userId, categoryId, orgAddressId: locationId } = await ensureFixtures());
    await prisma.channelListing.deleteMany({ where: { orgId } });
    await prisma.channelConnection.deleteMany({ where: { orgId } });
    connectionId = (await prisma.channelConnection.create({ data: { orgId, channel: "amazon", state: "CONNECTED", externalAccountId: `A-${stamp}`, refreshToken: "sealed-test" }, select: { id: true } })).id;
    await prisma.channelCategoryMap.deleteMany({ where: { channel: "amazon", theirCategory: TYPE } });
    await prisma.channelAttributeMap.deleteMany({ where: { channel: "amazon", theirCategory: TYPE } });
    await prisma.channelCategoryMap.create({ data: { channel: "amazon", productType: "prayer-mat", kind: null, theirCategory: TYPE, fit: "EXACT", publishes: false, checkedOn: new Date() } });
    await prisma.channelAttributeMap.createMany({
      data: [
        ["colour", "color"],
        ["material", "material"],
        ["care", "care_instructions"],
        ["packQuantity", "number_of_items"],
      ].map(([fact, theirAttribute]) => ({ channel: "amazon", theirCategory: TYPE, fact, theirAttribute, checkedOn: new Date() })),
    });
  });

  beforeEach(async () => {
    await cleanup();
    fake.state.read = read();
  });

  afterAll(async () => {
    // A step above can throw before its category is removed; sweep this suite's own by slug, so a
    // failed run never leaves a top-level category on the dev Home (as twelve runs once did).
    await prisma.category.deleteMany({ where: { OR: [{ slug: { startsWith: "mf-q35-" } }, { slug: { startsWith: "mf-mats-" } }], products: { none: {} }, children: { none: {} } } });
    await cleanup();
    await prisma.channelConnection.deleteMany({ where: { orgId } });
    await prisma.channelCategoryMap.deleteMany({ where: { channel: "amazon", theirCategory: TYPE } });
    await prisma.channelAttributeMap.deleteMany({ where: { channel: "amazon", theirCategory: TYPE } });
  });

  it("fills only empty facts, marked from the marketplace with its words, and asks the rest (spec A1, A2)", async () => {
    const { id } = await product({ facts: { care: { value: "Dry clean", origin: "product" } } });
    const listing = await linked(id);
    const outcome = await facts.run({ orgId, listingId: listing.id });

    expect(outcome).toMatchObject({ outcome: "filled", facts: 2, questions: 1 });
    const row = { ...(await prisma.product.findUniqueOrThrow({ where: { id }, select: { weight: true, mrpPaise: true } })), facts: (await answersOf(id)).facts };
    expect(row.facts).toMatchObject({
      colour: { value: "green", origin: "marketplace", source: { channel: "amazon", value: "Green" } },
      packQuantity: { value: 2, origin: "marketplace" },
      care: { value: "Dry clean", origin: "product" },
    });
    expect(row.facts).not.toHaveProperty("material");
    expect(row).toMatchObject({ weight: 1, mrpPaise: 145_000 });
    const stored = await prisma.channelListing.findUniqueOrThrow({ where: { id: listing.id }, select: { attributes: true, attributesReadAt: true } });
    expect(stored.attributesReadAt).toBeInstanceOf(Date);
    expect((stored.attributes as unknown as ListingAttributes).type).toBe(TYPE);
  });

  it("keeps what the shop set meanwhile: an answer, a real weight, an MRP (D7)", async () => {
    const { id } = await product({ weight: 1.2, mrpPaise: 99_900, facts: { colour: { value: "red", origin: "product" } } });
    const filled = await products.fillFromMarketplace(orgId, id, {
      facts: { colour: { value: "green", origin: "marketplace", source: { channel: "amazon", value: "Green", readAt: "2026-10-25" } } },
      measurements: {},
      weightKg: 1,
      mrpPaise: 145_000,
      brandId: null,
    });
    expect(filled).toEqual({ facts: [], measurements: [], weight: false, mrp: false, brand: false });
    const row = { ...(await prisma.product.findUniqueOrThrow({ where: { id }, select: { weight: true, mrpPaise: true } })), facts: (await answersOf(id)).facts };
    expect(row).toMatchObject({ weight: 1.2, mrpPaise: 99_900, facts: { colour: { value: "red", origin: "product" } } });
  });

  it("keeps both when a fill and the shop's answer land at the same moment (D7, row lock)", async () => {
    const ids = await Promise.all(Array.from({ length: 12 }, () => product().then((p) => p.id)));
    await Promise.all(
      ids.flatMap((id) => [
        products.fillFromMarketplace(orgId, id, {
          facts: { colour: { value: "green", origin: "marketplace", source: { channel: "amazon", value: "Green", readAt: "2026-10-25" } } },
          measurements: {},
          weightKg: null,
          mrpPaise: null,
          brandId: null,
        }),
        products.setMarketplaceAnswer(orgId, id, "facts", "material", { value: "cotton", origin: "product" }, false),
      ]),
    );
    const rows = await Promise.all(ids.map((pid) => answersOf(pid)));
    for (const row of rows) expect(Object.keys(row.facts as object).sort()).toEqual(["colour", "material"]);
  });

  it("gives a Generic listing the default brand, fills only its empty label fields, and makes no brand (Q29)", async () => {
    const brand = await prisma.brand.create({ data: { orgId, name: `BBT ${stamp} House`, isDefault: true, packerOrImporter: "Kept packer" }, select: { id: true } });
    await prisma.brand.updateMany({ where: { orgId, NOT: { id: brand.id } }, data: { isDefault: false } });
    const before = await prisma.brand.count({ where: { orgId } });
    fake.state.read = read({ details: { ...read().details, packer: "Marketplace packer" } });
    const { id } = await product();
    await facts.run({ orgId, listingId: (await linked(id)).id });

    expect((await prisma.product.findUniqueOrThrow({ where: { id }, select: { brandId: true } })).brandId).toBe(brand.id);
    expect(await prisma.brand.findUniqueOrThrow({ where: { id: brand.id }, select: { manufacturer: true, packerOrImporter: true, countryOfOrigin: true } })).toEqual({
      manufacturer: "Niqab Boutique",
      packerOrImporter: "Kept packer",
      countryOfOrigin: "IN",
    });
    expect(await prisma.brand.count({ where: { orgId } })).toBe(before);
  });

  it("puts the HSN on the category's tax code only when it has none (Q21)", async () => {
    const { id } = await product();
    await facts.run({ orgId, listingId: (await linked(id)).id });
    const codes = async () => (await prisma.orgListingDefaults.findUniqueOrThrow({ where: { orgId } })).taxCodeByCategory as Record<string, string>;
    expect((await codes())[categoryId]).toBe("63049291");

    fake.state.read = read({ details: { ...read().details, hsn: "11111111" } });
    const other = await product();
    await facts.run({ orgId, listingId: (await linked(other.id)).id });
    expect((await codes())[categoryId]).toBe("63049291");
  });

  it("fills nothing and says nothing went wrong when the marketplace shares no answers (spec A5)", async () => {
    fake.state.read = { type: null, attributes: {}, details: NO_DETAILS };
    const { id } = await product();
    const outcome = await facts.run({ orgId, listingId: (await linked(id)).id });
    expect(outcome).toMatchObject({ outcome: "filled", facts: 0, questions: 0, details: [] });
  });

  it("queues the fill in the transaction that makes a product from a listing (spec A4)", async () => {
    const listing = await prisma.channelListing.create({
      data: { connectionId, orgId, channel: "amazon", sku: `MF-${stamp}-new`, skuKey: `mf-${stamp}-new`, title: "New mat", status: "LIVE", lastSeenAt: new Date() },
      select: { id: true },
    });
    const { channelSettleService } = await import("@server/channels/channel-settle.service");
    await channelSettleService.settle(orgId, userId, {
      listingIds: [listing.id],
      name: `Mat ${stamp}`,
      description: "A mat",
      photosFrom: listing.id,
      sku: `MF-${stamp}-new`,
      pricePaise: 99_900,
      categoryId,
      stock: [{ locationId, quantity: 1 }],
    });
    const { JOBS_QUEUE, JOBS_SCHEMA } = await import("@server/shared/jobs/jobs.config");
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'channels.fill-facts' AND data->'payload'->>'listingId' = $2`,
      JOBS_QUEUE,
      listing.id,
    );
    expect(Number(rows[0].n)).toBe(1);
    await prisma.$executeRawUnsafe(`DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'listingId' = $2`, JOBS_QUEUE, listing.id);
  });

  it("fills once every listing linked by its SKU that was never read, and never one already read (Q36)", async () => {
    const { JOBS_QUEUE, JOBS_SCHEMA } = await import("@server/shared/jobs/jobs.config");
    const { channelFactsService } = await import("@server/channels/channel-facts.service");
    const { id: unreadProduct } = await product();
    const { id: readProduct } = await product();
    const unread = await linked(unreadProduct);
    const read = await linked(readProduct);
    await prisma.channelListing.update({ where: { id: read.id }, data: { attributesReadAt: new Date() } });
    await channelFactsService.fillUnread(connectionId);
    const queued = async (listingId: string) =>
      Number((await prisma.$queryRawUnsafe<{ n: bigint }[]>(
        `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'channels.fill-facts' AND data->'payload'->>'listingId' = $2`,
        JOBS_QUEUE,
        listingId,
      ))[0].n);
    expect(await queued(unread.id)).toBe(1);
    expect(await queued(read.id)).toBe(0);
    // "Read again" and the same day's pass queue it once between them; a failing read waits a week.
    await channelFactsService.fillUnread(connectionId);
    expect(await queued(unread.id)).toBe(1);
    for (const id of [unread.id, read.id]) await prisma.$executeRawUnsafe(`DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'listingId' = $2`, JOBS_QUEUE, id);
  });

  describe("the card and its commands (D6, D8)", () => {
    const filledOnce = async () => {
      const { id } = await product();
      const listing = await linked(id);
      await facts.run({ orgId, listingId: listing.id });
      return { id, listingId: listing.id };
    };

    it("shows what Amazon filled and asks the rest, from the stored read (spec A1, A2)", async () => {
      const { id } = await filledOnce();
      const [card] = await facts.cards(orgId, id);
      expect(card).toMatchObject({ state: "ready", marketplaceType: TYPE });
      expect(card.filled.find((f) => f.fact === "colour")).toMatchObject({ value: "Green", said: "Green", changed: false });
      expect(card.questions.map((q) => q.fact)).toEqual(["material"]);
    });

    it("answers a question once; a second answer is told what the shop answered (ux.md Owner answered meanwhile)", async () => {
      const { id, listingId } = await filledOnce();
      await facts.change(orgId, listingId, { action: "answer", fact: "material", value: "cotton" });
      const row = await answersOf(id);
      expect((row.facts as Record<string, unknown>).material).toMatchObject({ value: "cotton", origin: "marketplace", source: { chosen: true } });
      await expect(facts.change(orgId, listingId, { action: "answer", fact: "material", value: "silk" })).rejects.toThrow(/You already answered this: Cotton\. Nothing was changed\./);
    });

    it("keeps Amazon's words when the shop changes an answer, and Reset brings Amazon's back (spec A7, Q31)", async () => {
      const { id, listingId } = await filledOnce();
      await facts.change(orgId, listingId, { action: "change", fact: "colour", value: "red" });
      let [card] = await facts.cards(orgId, id);
      expect(card.filled.find((f) => f.fact === "colour")).toMatchObject({ value: "Red", said: "Green", changed: true });
      await facts.change(orgId, listingId, { action: "reset", fact: "colour" });
      [card] = await facts.cards(orgId, id);
      expect(card.filled.find((f) => f.fact === "colour")).toMatchObject({ value: "Green", changed: false });
    });

    it("skips a question for now, and can ask it again (D6)", async () => {
      const { id, listingId } = await filledOnce();
      await facts.change(orgId, listingId, { action: "skip", fact: "material", skipped: true });
      expect((await facts.cards(orgId, id))[0]).toMatchObject({ questions: [], skipped: [{ fact: "material" }] });
      await facts.change(orgId, listingId, { action: "skip", fact: "material", skipped: false });
      expect((await facts.cards(orgId, id))[0].questions.map((q) => q.fact)).toEqual(["material"]);
    });

    it("asks an untyped product's category, and filling follows the choice (spec A3, Q25)", async () => {
      const { id } = await product({ productType: null });
      const listing = await linked(id);
      await facts.run({ orgId, listingId: listing.id });
      expect((await answersOf(id)).facts).toEqual({});
      const category = await prisma.category.create({
        data: { slug: `mf-mats-${stamp}`, name: `Mats ${stamp}`, description: "", heroImage: "/brand/bhendi-bazaar.png", productType: "prayer-mat" },
        select: { id: true },
      });
      try {
        const [card] = await facts.cards(orgId, id);
        expect(card.state).toBe("category_to_confirm");
        expect(card.types[0].categories.map((c) => c.id)).toContain(category.id);
        await facts.change(orgId, listing.id, { action: "category", categoryId: category.id });
      const row = { ...(await prisma.product.findUniqueOrThrow({ where: { id }, select: { productType: true, categoryId: true } })), facts: (await answersOf(id)).facts };
      expect(row).toMatchObject({ productType: "prayer-mat", categoryId: category.id });
        expect(row.facts).toHaveProperty("colour");
      } finally {
        await prisma.channelListing.deleteMany({ where: { productId: id } });
        await prisma.product.deleteMany({ where: { id } });
        await prisma.category.deleteMany({ where: { id: category.id } });
      }
    });
  });

  describe("a listing no type of ours fits (Q6, D9, D10)", () => {
    it("parks with its reason, shows waiting for a type, and Bring back clears the reason", async () => {
      const { channelImportService } = await import("@server/channels/channel-import.service");
      const listing = await prisma.channelListing.create({
        data: { connectionId, orgId, channel: "amazon", sku: `MF-${stamp}-park`, skuKey: `mf-${stamp}-park`, title: "Shoes", lastSeenAt: new Date(), attributes: { type: "SHOES", attributes: {}, details: { ...NO_DETAILS } } as never },
        select: { id: true },
      });
      await channelImportService.leaveOff(orgId, userId, listing.id, "no_type");
      const page = await channelImportService.listingsPage(orgId, "amazon", "leftOff", null, 1);
      expect(page.listings.find((l) => l.id === listing.id)?.waitingForType).toEqual({ marketplaceType: "SHOES" });

      await channelImportService.bringBack(orgId, listing.id);
      expect(await prisma.channelListing.findUniqueOrThrow({ where: { id: listing.id }, select: { leftOffAt: true, leftOffReason: true } })).toEqual({ leftOffAt: null, leftOffReason: null });
    });

    it("refuses a reason on a listing that is not left off, in the database", async () => {
      await expect(
        prisma.channelListing.create({
          data: { connectionId, orgId, channel: "amazon", sku: `MF-${stamp}-bad`, skuKey: `mf-${stamp}-bad`, lastSeenAt: new Date(), leftOffReason: "no_type" },
        }),
      ).rejects.toThrow(/left_off_reason_check/);
    });

    it("saves the page's facts with the product: the clear ones and only valid answers (Q35)", async () => {
      const { channelSettleService } = await import("@server/channels/channel-settle.service");
      const category = await prisma.category.create({
        data: { slug: `mf-q35-${stamp}`, name: `Mats Q35 ${stamp}`, description: "", heroImage: "/brand/bhendi-bazaar.png", productType: "prayer-mat" },
        select: { id: true },
      });
      const listing = await prisma.channelListing.create({
        data: { connectionId, orgId, channel: "amazon", sku: `MF-${stamp}-q35`, skuKey: `mf-${stamp}-q35`, title: "Mat", status: "LIVE", lastSeenAt: new Date() },
        select: { id: true },
      });
      try {
        const detail = await channelSettleService.page(orgId, listing.id, null);
        const shown = detail?.facts?.byType["prayer-mat"];
        expect(detail?.facts?.typeOfCategory[category.id]).toBe("prayer-mat");
        expect(shown?.fills.map((f) => f.fact)).toEqual(expect.arrayContaining(["colour", "packQuantity"]));
        expect(shown?.questions.map((q) => q.fact)).toEqual(["material"]);

        // An answer to a fact that is not asked (colour, care) is kept out, whatever the browser sends.
        const result = await channelSettleService.settle(orgId, userId, {
          listingIds: [listing.id],
          name: `Mat ${stamp}`,
          description: "A mat",
          photosFrom: listing.id,
          sku: `MF-${stamp}-q35`,
          pricePaise: 99_900,
          categoryId: category.id,
          stock: [{ locationId, quantity: 1 }],
          answers: { material: "cotton", colour: "red", care: "anything" },
        });
        const row = await answersOf(result.productId);
        expect(row.facts).toMatchObject({
          colour: { value: "green", origin: "marketplace" },
          material: { value: "cotton", origin: "marketplace", source: { chosen: true } },
          care: { value: "hand-wash", origin: "marketplace" },
        });
      } finally {
        const { JOBS_QUEUE, JOBS_SCHEMA } = await import("@server/shared/jobs/jobs.config");
        await prisma.$executeRawUnsafe(`DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'listingId' = $2`, JOBS_QUEUE, listing.id);
        const linkedTo = (await prisma.channelListing.findUniqueOrThrow({ where: { id: listing.id }, select: { productId: true } })).productId;
        await prisma.channelListing.deleteMany({ where: { id: listing.id } });
        if (linkedTo) await prisma.product.deleteMany({ where: { id: linkedTo } });
        await prisma.category.deleteMany({ where: { id: category.id } });
      }
    });

    it("matching saves the page's facts only into the product's empty ones (Q35)", async () => {
      const { channelSettleService } = await import("@server/channels/channel-settle.service");
      const { id } = await product({ sku: `MF-${stamp}-match`, facts: { colour: { value: "red", origin: "product" } } });
      const listing = await prisma.channelListing.create({
        data: { connectionId, orgId, channel: "amazon", sku: `MF-${stamp}-match-l`, skuKey: `mf-${stamp}-match-l`, title: "Mat", status: "LIVE", lastSeenAt: new Date() },
        select: { id: true },
      });
      const detail = await channelSettleService.page(orgId, listing.id, id);
      expect(detail?.facts).toMatchObject({ matching: true, fixedType: "prayer-mat" });
      expect(detail?.facts?.byType["prayer-mat"].fills.map((f) => f.fact)).not.toContain("colour");
      await channelSettleService.settle(orgId, userId, { listingIds: [listing.id], productId: id, stock: [], answers: { material: "cotton" } });
      const row = await answersOf(id);
      expect(row.facts).toMatchObject({ colour: { value: "red", origin: "product" }, material: { value: "cotton", origin: "marketplace" } });
      const { JOBS_QUEUE, JOBS_SCHEMA } = await import("@server/shared/jobs/jobs.config");
      await prisma.$executeRawUnsafe(`DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'listingId' = $2`, JOBS_QUEUE, listing.id);
    });

    it("keeps an answer only when it is one of ours for a fact still asked (Q35)", async () => {
      const row = { channel: "amazon", attributes: read(), attributesReadAt: new Date() };
      const target = { productType: "prayer-mat", facts: null, measurements: null };
      expect((await facts.settleFill(row, orgId, target, { material: "not-a-material" }))?.facts).not.toHaveProperty("material");
      expect((await facts.settleFill(row, orgId, target, { material: "cotton" }))?.facts.material).toMatchObject({ value: "cotton" });
      const answered = { ...target, facts: { material: { value: "silk", origin: "product" } } };
      expect((await facts.settleFill(row, orgId, answered, { material: "cotton" }))?.facts).not.toHaveProperty("material");
    });

    it("starts the Settle page on the mapped type's question, and stores the read (D9)", async () => {
      const { channelSettleService } = await import("@server/channels/channel-settle.service");
      const listing = await prisma.channelListing.create({
        data: { connectionId, orgId, channel: "amazon", sku: `MF-${stamp}-settle`, skuKey: `mf-${stamp}-settle`, title: "Mat", lastSeenAt: new Date() },
        select: { id: true },
      });
      const detail = await channelSettleService.page(orgId, listing.id, null);
      expect(detail?.type).toMatchObject({ kind: "mapped", marketplaceType: TYPE, types: [{ key: "prayer-mat" }] });
      expect((await prisma.channelListing.findUniqueOrThrow({ where: { id: listing.id }, select: { attributesReadAt: true } })).attributesReadAt).toBeInstanceOf(Date);

      fake.state.read = read({ type: "BBTEST_NOTHING" });
      expect((await channelSettleService.page(orgId, listing.id, null))?.type).toMatchObject({ kind: "none", marketplaceType: "BBTEST_NOTHING" });
    });
  });
});
