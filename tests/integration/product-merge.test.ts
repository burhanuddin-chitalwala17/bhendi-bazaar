/**
 * Settling marketplace listings against a real schema (product-merge). The marketplaces are a fake
 * provider and the photo copy a fake; under test is what we store and decide: every listing linked
 * or none, one product from two taps, a SKU in use refused by name, stock that moved refused, a
 * left-off listing never linked by a read, one listing per marketplace per product.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

const fake = vi.hoisted(() => {
  const state = { photos: ["https://m.media-amazon.com/main.jpg", "https://m.media-amazon.com/pt01.jpg"], copyFails: false, detailFails: false };
  const provider = {
    configured: () => true,
    listingDetail: async () => {
      if (state.detailFails) throw new Error("marketplace down");
      return { title: "From the marketplace", description: "Long description", photoUrls: state.photos };
    },
  };
  let n = 0;
  const mediaImport = {
    fromUrl: async (_org: string, _user: string | null, url: string) => {
      if (state.copyFails) throw new Error("copy failed");
      return `https://store.example/${++n}-${url.split("/").pop()}`;
    },
  };
  return { state, provider, mediaImport };
});

vi.mock("@server/channels/providers", () => ({ providerFor: () => fake.provider }));
vi.mock("@server/catalog/media-import.service", () => ({ mediaImportService: fake.mediaImport }));

describe.skipIf(!isDisposableDb)("settling marketplace listings (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let settle: typeof import("@server/channels/channel-settle.service").channelSettleService;
  let imports: typeof import("@server/channels/channel-import.service").channelImportService;
  let listings: typeof import("@server/channels/channel-listing.repository").channelListingRepository;
  let orgId: string;
  let userId: string;
  let categoryId: string;
  let locationId: string;
  let amazon: string;
  let flipkart: string;
  const stamp = Date.now();

  const listing = (connectionId: string, channel: string, sku: string, extra: Record<string, unknown> = {}) =>
    prisma.channelListing.create({
      data: {
        connectionId,
        orgId,
        channel,
        sku,
        skuKey: sku.toLowerCase(),
        title: `Title ${sku}`,
        status: "LIVE",
        pricePaise: 189_900,
        quantity: 5,
        lastSeenAt: new Date(),
        ...extra,
      },
      select: { id: true },
    });

  const newProduct = (ids: string[], sku: string) => ({
    listingIds: ids,
    name: `Merged ${sku}`,
    description: "Long description",
    photosFrom: ids[0],
    sku,
    pricePaise: 184_900,
    categoryId,
    stock: [{ locationId, quantity: 3 }],
  });

  const cleanup = async () => {
    const products = await prisma.product.findMany({ where: { orgId, sku: { startsWith: `PM-${stamp}` } }, select: { id: true } });
    await prisma.channelListing.deleteMany({ where: { orgId } });
    await prisma.product.deleteMany({ where: { id: { in: products.map((p) => p.id) } } });
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelSettleService: settle } = await import("@server/channels/channel-settle.service"));
    ({ channelImportService: imports } = await import("@server/channels/channel-import.service"));
    ({ channelListingRepository: listings } = await import("@server/channels/channel-listing.repository"));
    let fixtures;
    ({ orgId, userId, categoryId, orgAddressId: locationId } = (fixtures = await ensureFixtures()));
    void fixtures;
    await prisma.channelListing.deleteMany({ where: { orgId } });
    await prisma.channelConnection.deleteMany({ where: { orgId } });
    amazon = (await prisma.channelConnection.create({ data: { orgId, channel: "amazon", state: "CONNECTED", externalAccountId: `A-${stamp}`, refreshToken: "sealed-test" }, select: { id: true } })).id;
    flipkart = (await prisma.channelConnection.create({ data: { orgId, channel: "flipkart", state: "CONNECTED", refreshToken: "sealed-test" }, select: { id: true } })).id;
  });

  beforeEach(async () => {
    await cleanup();
    Object.assign(fake.state, {
      photos: ["https://m.media-amazon.com/main.jpg", "https://m.media-amazon.com/pt01.jpg"],
      copyFails: false,
      detailFails: false,
    });
  });

  afterAll(async () => {
    await cleanup();
    await prisma.channelConnection.deleteMany({ where: { orgId } });
  });

  it("adds one product linked to both marketplaces' listings, with the main photo and the stock entered (spec A1, A3)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-1`);
    const f = await listing(flipkart, "flipkart", `pm-${stamp}-1-fk`);
    const result = await settle.settle(orgId, userId, newProduct([a.id, f.id], `PM-${stamp}-1`));

    const product = await prisma.product.findUniqueOrThrow({
      where: { id: result.productId },
      select: { name: true, sku: true, price: true, thumbnail: true, archivedAt: true, stockLocations: { select: { quantity: true } } },
    });
    expect(product).toMatchObject({ name: `Merged PM-${stamp}-1`, sku: `PM-${stamp}-1`, price: 184_900, archivedAt: null });
    expect(product.thumbnail).toMatch(/^https:\/\/store\.example\/.*main\.jpg$/);
    expect(product.stockLocations).toEqual([{ quantity: 3 }]);
    const linked = await prisma.channelListing.findMany({ where: { id: { in: [a.id, f.id] } }, select: { productId: true, linkSource: true } });
    expect(linked).toEqual([
      { productId: result.productId, linkSource: "OWNER" },
      { productId: result.productId, linkSource: "OWNER" },
    ]);
  });

  it("makes one product from two taps at once; the second is told and writes nothing (spec A5)", async () => {
    // Different SKUs, so only the conditional link can stop the second: the listing is already taken.
    const a = await listing(amazon, "amazon", `PM-${stamp}-2`);
    const f = await listing(flipkart, "flipkart", `PM-${stamp}-2-fk`);
    const outcomes = await Promise.allSettled([
      settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-2`)),
      settle.settle(orgId, userId, { ...newProduct([f.id, a.id], `PM-${stamp}-2-fk`), photosFrom: f.id, uploadedPhoto: undefined }),
    ]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.product.count({ where: { orgId, sku: { startsWith: `PM-${stamp}-2` } } })).toBe(1);
  });

  it("refuses a SKU another product holds, naming it, and writes nothing", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-3`);
    const b = await listing(flipkart, "flipkart", `PM-${stamp}-3`);
    await settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-3`));
    await expect(settle.settle(orgId, userId, newProduct([b.id], `PM-${stamp}-3`))).rejects.toThrow(
      new RegExp(`SKU PM-${stamp}-3 is already used by Merged PM-${stamp}-3`),
    );
    expect((await prisma.channelListing.findUniqueOrThrow({ where: { id: b.id } })).productId).toBeNull();
  });

  it("goes on the Archived shelf when nothing being settled is live, unless asked (Q12)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-4`, { status: "INACTIVE" });
    const result = await settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-4`));
    expect(result.archived).toBe(true);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: result.productId } })).archivedAt).not.toBeNull();
  });

  it("writes nothing when the main photo cannot be copied (Q29)", async () => {
    fake.state.copyFails = true;
    const a = await listing(amazon, "amazon", `PM-${stamp}-5`);
    await expect(settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-5`))).rejects.toThrow(/Couldn't copy .* main photo/);
    expect(await prisma.product.count({ where: { orgId, sku: `PM-${stamp}-5` } })).toBe(0);
  });

  it("a match changes only what was chosen, and refuses stock that moved meanwhile (spec A2, Q28)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-6`);
    const made = await settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-6`));
    const f = await listing(flipkart, "flipkart", `PM-${stamp}-6-fk`);

    await expect(
      settle.settle(orgId, userId, { listingIds: [f.id], productId: made.productId, stock: [{ locationId, quantity: 9, seenQuantity: 2 }] }),
    ).rejects.toThrow(/changed while you were here/);
    expect((await prisma.channelListing.findUniqueOrThrow({ where: { id: f.id } })).productId).toBeNull();

    await settle.settle(orgId, userId, { listingIds: [f.id], productId: made.productId, stock: [{ locationId, quantity: 7, seenQuantity: 3 }] });
    const after = await prisma.product.findUniqueOrThrow({
      where: { id: made.productId },
      select: { name: true, description: true, stockLocations: { select: { quantity: true } } },
    });
    expect(after).toMatchObject({ name: `Merged PM-${stamp}-6`, description: "Long description", stockLocations: [{ quantity: 7 }] });
  });

  it("links one listing per marketplace per product (Q22)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-7`);
    const made = await settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-7`));
    const second = await listing(amazon, "amazon", `PM-${stamp}-7-dup`);
    await expect(
      settle.settle(orgId, userId, { listingIds: [second.id], productId: made.productId, stock: [{ locationId, quantity: 3, seenQuantity: 3 }] }),
    ).rejects.toThrow(/already linked to another Amazon listing/);
  });

  it("leaves a listing off the to-do, keeps a read from linking it, and brings it back (spec A4, Q9)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-8`);
    await imports.leaveOff(orgId, userId, a.id);
    expect(await listings.tabCounts(amazon)).toMatchObject({ notLinked: 0, leftOff: 1 });
    expect(await listings.linkable(amazon, [`pm-${stamp}-8`])).toEqual([]);
    await imports.bringBack(orgId, a.id);
    expect(await listings.tabCounts(amazon)).toMatchObject({ notLinked: 1, leftOff: 0 });
    expect(await listings.linkable(amazon, [`pm-${stamp}-8`])).toHaveLength(1);
  });

  it("copies the rest of the photos in the background and counts them (D6)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-9`);
    const made = await settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-9`));
    const outcome = await settle.copyPhotos({ orgId, listingId: a.id, productId: made.productId, mode: "append", skipFirst: true });
    expect(outcome).toEqual({ done: 1, failed: 0 });
    const media = await prisma.productMedia.findMany({ where: { productId: made.productId }, orderBy: { position: "asc" }, select: { ref: true, isThumbnail: true } });
    expect(media.map((m) => [m.ref.split("-").pop(), m.isThumbnail])).toEqual([
      ["main.jpg", true],
      ["pt01.jpg", false],
    ]);
    expect(await prisma.channelListing.findUniqueOrThrow({ where: { id: a.id }, select: { photoTotal: true, photoDone: true, photoFailed: true } })).toEqual({
      photoTotal: 1,
      photoDone: 1,
      photoFailed: 0,
    });
  });

  it("two identical taps make one product, and the second is told the listing was just linked (spec A5, D4)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-10`);
    const outcomes = await Promise.allSettled([
      settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-10`)),
      settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-10`)),
    ]);
    const refused = outcomes.filter((o): o is PromiseRejectedResult => o.status === "rejected");
    expect(refused).toHaveLength(1);
    expect(String(refused[0].reason)).toMatch(/This listing was just linked to Merged PM-.*-10\. Nothing was changed\./);
    expect(await prisma.product.count({ where: { orgId, sku: `PM-${stamp}-10` } })).toBe(1);
  });

  it("refuses a stock location that is not the shop's, on a match as on an add", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-11`);
    const made = await settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-11`));
    const f = await listing(flipkart, "flipkart", `PM-${stamp}-11-fk`);
    await expect(
      settle.settle(orgId, userId, { listingIds: [f.id], productId: made.productId, stock: [{ locationId: "someone-elses-location", quantity: 4 }] }),
    ).rejects.toThrow(/does not belong to this organisation/);
  });

  it("counts every photo failed when the marketplace will not say what they are, so Try again shows (D6)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-12`);
    const made = await settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-12`));
    fake.state.detailFails = true;
    await expect(settle.copyPhotos({ orgId, listingId: a.id, productId: made.productId, mode: "append", skipFirst: true })).rejects.toThrow(/marketplace down/);
    const row = await prisma.channelListing.findUniqueOrThrow({ where: { id: a.id }, select: { photoTotal: true, photoDone: true, photoFailed: true } });
    expect((row.photoDone ?? 0) + (row.photoFailed ?? 0)).toBeGreaterThanOrEqual(row.photoTotal ?? 0);
    expect(row.photoFailed).toBeGreaterThan(0);
  });

  it("Try again on a match's photos replaces the gallery as the first copy would (D6)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-13`);
    const made = await settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-13`));
    const f = await listing(flipkart, "flipkart", `PM-${stamp}-13-fk`);
    // A match that takes the Flipkart side's photos records a replacing copy; the first one fails.
    fake.state.copyFails = true;
    await prisma.channelListing.update({ where: { id: a.id }, data: { productId: null, linkSource: null, linkedAt: null } });
    await settle.settle(orgId, userId, {
      listingIds: [a.id],
      productId: made.productId,
      photosFrom: a.id,
      stock: [{ locationId, quantity: 3, seenQuantity: 3 }],
    });
    void f;
    await settle.copyPhotos({ orgId, listingId: a.id, productId: made.productId, mode: "replace", skipFirst: false });
    expect((await prisma.channelListing.findUniqueOrThrow({ where: { id: a.id } })).photoMode).toBe("replace");
    fake.state.copyFails = false;
    await settle.retryPhotos(orgId, a.id);
    const job = await prisma.$queryRaw<Array<{ data: { payload: { mode: string } } }>>`
      SELECT data FROM pgboss.job WHERE data->>'type' = 'channels.copy-listing-photos' AND data->'payload'->>'listingId' = ${a.id}
      ORDER BY created_on DESC LIMIT 1`;
    expect(job[0].data.payload.mode).toBe("replace");
  });

  it("the database itself refuses a second listing on one marketplace for a product (Q22, D8)", async () => {
    const a = await listing(amazon, "amazon", `PM-${stamp}-14`);
    const made = await settle.settle(orgId, userId, newProduct([a.id], `PM-${stamp}-14`));
    const dup = await listing(amazon, "amazon", `PM-${stamp}-14-dup`);
    await expect(
      prisma.$transaction((tx) => listings.settleLink(tx, [dup.id], orgId, made.productId, new Date())),
    ).rejects.toThrow(/Unique constraint|unique/i);
    // A read linking by SKU skips the row the index refuses rather than failing its batch.
    expect(await listings.linkBySku([{ id: dup.id, productId: made.productId }], new Date())).toBe(0);
  });
});
