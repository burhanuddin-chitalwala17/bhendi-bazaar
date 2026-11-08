/**
 * One family from several marketplace listings, against a real schema (family-merge D3–D5). The
 * marketplace and the photo copy are fakes; the mapping rows and the category are test-owned. Under
 * test: everything or nothing, one family from two taps, the refusals, existing products joining as
 * they are, and the browser's values never deciding.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { NO_DETAILS } from "@server/channels/providers/listing-read";
import { isDisposableDb, ensureFixtures, setAnswers, answersOf } from "../helpers/test-db";

const fake = vi.hoisted(() => {
  const state = { colours: {} as Record<string, string>, failPhotoFor: null as string | null };
  const provider = {
    configured: () => true,
    listingAttributes: async (_t: unknown, _a: unknown, listing: { sku: string }) => ({
      type: "BBTEST_PANTS",
      attributes: { color: [state.colours[listing.sku] ?? "Black"], material: ["Cotton"] },
      details: { weightKg: null, dimensionsCm: null, hsn: null, mrpPaise: null, countryOfOrigin: null, brand: null, manufacturer: null, packer: null, importer: null },
    }),
    listingDetail: async (_t: unknown, _a: unknown, listing: { sku: string }) => ({
      title: `Parent of ${listing.sku}`,
      description: "Shared description",
      photoUrls: listing.sku === state.failPhotoFor ? [] : [`https://m.media-amazon.com/${listing.sku}-main.jpg`, `https://m.media-amazon.com/${listing.sku}-2.jpg`],
    }),
  };
  let n = 0;
  return { state, provider, mediaImport: { fromUrl: async (_o: string, _u: string | null, url: string) => `https://store.example/${++n}-${url.split("/").pop()}` } };
});

vi.mock("@server/channels/providers", () => ({ providerFor: () => fake.provider }));
vi.mock("@server/catalog/media-import.service", () => ({ mediaImportService: fake.mediaImport }));

const TYPE = "BBTEST_PANTS";

describe.skipIf(!isDisposableDb)("making one family of marketplace listings (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let family: typeof import("@server/channels/channel-family.service").channelFamilyService;
  let orgId: string;
  let userId: string;
  let locationId: string;
  let connectionId: string;
  let categoryId: string;
  const stamp = Date.now();
  const sku = (s: string) => `FM-${stamp}-${s}`;

  const listing = (s: string, colour: string, extra: Record<string, unknown> = {}) => {
    fake.state.colours[sku(s)] = colour;
    return prisma.channelListing.create({
      data: { connectionId, orgId, channel: "amazon", sku: sku(s), skuKey: sku(s).toLowerCase(), title: `Floral trousers ${colour}`, status: "LIVE", pricePaise: 99_900, quantity: 3, parentSku: `FM-${stamp}-PARENT`, lastSeenAt: new Date(), ...extra },
      select: { id: true },
    });
  };
  const input = (ids: string[], more: Record<string, unknown> = {}) => ({
    listingIds: ids,
    name: `Floral trousers ${stamp}`,
    description: "Shared description",
    categoryId,
    removedAxes: [] as string[],
    answers: {},
    members: ids.map((id) => ({ listingId: id, include: true, move: false, stock: [{ locationId, quantity: 2 }] })),
    ...more,
  });
  const read = async (ids: string[]) => {
    await family.reads(await family.rows(orgId, ids));
  };

  const cleanup = async () => {
    const listings = await prisma.channelListing.findMany({ where: { orgId, sku: { startsWith: `FM-${stamp}` } }, select: { productId: true } });
    await prisma.channelListing.deleteMany({ where: { orgId, sku: { startsWith: `FM-${stamp}` } } });
    const ids = listings.map((l) => l.productId).filter((id): id is string => !!id);
    const products = await prisma.product.findMany({ where: { OR: [{ id: { in: ids } }, { sku: { startsWith: `FM-${stamp}` } }] }, select: { id: true, familyId: true } });
    await prisma.product.deleteMany({ where: { id: { in: products.map((p) => p.id) } } });
    await prisma.productFamily.deleteMany({ where: { orgId, name: { startsWith: "Floral trousers" } } });
    await prisma.productFamily.deleteMany({ where: { orgId, name: { startsWith: "Other family" } } });
    await prisma.category.deleteMany({ where: { slug: `fm-mats-${stamp}` } });
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ channelFamilyService: family } = await import("@server/channels/channel-family.service"));
    ({ orgId, userId, orgAddressId: locationId } = await ensureFixtures());
    await prisma.channelListing.deleteMany({ where: { orgId } });
    await prisma.channelConnection.deleteMany({ where: { orgId } });
    connectionId = (await prisma.channelConnection.create({ data: { orgId, channel: "amazon", state: "CONNECTED", externalAccountId: `A-${stamp}`, refreshToken: "sealed-test" }, select: { id: true } })).id;
    await prisma.channelCategoryMap.deleteMany({ where: { channel: "amazon", theirCategory: TYPE } });
    await prisma.channelAttributeMap.deleteMany({ where: { channel: "amazon", theirCategory: TYPE } });
    await prisma.channelCategoryMap.create({ data: { channel: "amazon", productType: "trousers", kind: null, theirCategory: TYPE, fit: "EXACT", publishes: false, checkedOn: new Date() } });
    await prisma.channelAttributeMap.createMany({
      data: [["colour", "color"], ["material", "material"]].map(([fact, theirAttribute]) => ({ channel: "amazon", theirCategory: TYPE, fact, theirAttribute, checkedOn: new Date() })),
    });
    categoryId = (await prisma.category.create({ data: { slug: `fm-trousers-${stamp}`, name: `Trousers ${stamp}`, description: "", heroImage: "/brand/bhendi-bazaar.png", productType: "trousers" }, select: { id: true } })).id;
  });

  beforeEach(async () => {
    await cleanup();
    fake.state.failPhotoFor = null;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.channelConnection.deleteMany({ where: { orgId } });
    await prisma.channelCategoryMap.deleteMany({ where: { channel: "amazon", theirCategory: TYPE } });
    await prisma.channelAttributeMap.deleteMany({ where: { channel: "amazon", theirCategory: TYPE } });
    await prisma.category.delete({ where: { id: categoryId } });
    const { JOBS_QUEUE, JOBS_SCHEMA } = await import("@server/shared/jobs/jobs.config");
    await prisma.$executeRawUnsafe(`DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'orgId' = $2 AND data->>'type' IN ('channels.fill-facts','channels.copy-listing-photos')`, JOBS_QUEUE, orgId);
  });

  it("makes one family of three colours in one save, each its own product, shared facts once (spec A1, A2)", async () => {
    const ids = [(await listing("BLK", "Black")).id, (await listing("RED", "Red")).id, (await listing("NVY", "Navy")).id];
    const page = await family.page(orgId, ids);
    expect(page?.name).toBe(`Parent of FM-${stamp}-PARENT`);
    expect(page?.byType.trousers.axes.map((a) => a.key)).toEqual(["colour"]);

    const result = await family.settle(orgId, userId, input(ids));
    expect(result).toMatchObject({ members: 3, axisWord: "colours" });
    const fam = await prisma.productFamily.findUniqueOrThrow({ where: { id: result.familyId }, select: { variantAxis: true, facts: true, products: { select: { id: true, sku: true, price: true } } } });
    expect(fam.variantAxis).toEqual(["colour"]);
    expect(fam.facts).toMatchObject({ material: { value: "cotton", origin: "marketplace" } });
    expect(fam.products.map((p) => p.sku).sort()).toEqual([sku("BLK"), sku("NVY"), sku("RED")]);
    const black = fam.products.find((p) => p.sku === sku("BLK"))!;
    expect((await answersOf(black.id)).facts).toMatchObject({ colour: { value: "black", origin: "marketplace" }, material: { value: "cotton", origin: "family" } });
    const linked = await prisma.channelListing.count({ where: { id: { in: ids }, productId: { not: null } } });
    expect(linked).toBe(3);
  });

  it("saves nothing when one member's main photo cannot be copied (D5)", async () => {
    const ids = [(await listing("A1", "Black")).id, (await listing("A2", "Red")).id];
    await read(ids);
    fake.state.failPhotoFor = sku("A2");
    await expect(family.settle(orgId, userId, input(ids))).rejects.toThrow(/Couldn't copy .*main photo/);
    expect(await prisma.productFamily.count({ where: { orgId, name: `Floral trousers ${stamp}` } })).toBe(0);
    expect(await prisma.product.count({ where: { sku: { startsWith: `FM-${stamp}` } } })).toBe(0);
  });

  it("refuses two members that look the same, naming both, and saves nothing (spec A5)", async () => {
    const ids = [(await listing("D1", "Black")).id, (await listing("D2", "black")).id];
    await read(ids);
    await expect(family.settle(orgId, userId, input(ids))).rejects.toThrow(new RegExp(`Two members are Black: SKU ${sku("D1")} and ${sku("D2")}`));
    expect(await prisma.product.count({ where: { sku: { startsWith: `FM-${stamp}` } } })).toBe(0);
  });

  it("makes one family from two taps at once; the other is told (D3)", async () => {
    const ids = [(await listing("C1", "Black")).id, (await listing("C2", "Red")).id];
    await read(ids);
    const outcomes = await Promise.allSettled([family.settle(orgId, userId, input(ids)), family.settle(orgId, userId, input(ids))]);
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.productFamily.count({ where: { orgId, name: `Floral trousers ${stamp}` } })).toBe(1);
  });

  it("groups products settled one by one, as they are, and moves one from another family only when asked (spec A3, A6, Q11)", async () => {
    const other = await prisma.productFamily.create({ data: { orgId, name: `Other family ${stamp}`, productType: "trousers", variantAxis: ["colour"] }, select: { id: true } });
    const p1 = await prisma.product.create({ data: { name: "Own black", slug: `fm-${stamp}-p1`, description: "", price: 120_000, categoryId, thumbnail: "/brand/bhendi-bazaar.png", orgId, sku: sku("P1"), productType: "trousers" }, select: { id: true } });
    await setAnswers(p1.id, { facts: { colour: { value: "black", origin: "product" } } });
    const p2 = await prisma.product.create({ data: { name: "Own red", slug: `fm-${stamp}-p2`, description: "", price: 120_000, categoryId, thumbnail: "/brand/bhendi-bazaar.png", orgId, sku: sku("P2"), productType: "trousers", familyId: other.id }, select: { id: true } });
    const ids = [
      (await listing("L1", "Navy", { productId: p1.id, linkSource: "OWNER", linkedAt: new Date() })).id,
      (await listing("L2", "Red", { productId: p2.id, linkSource: "OWNER", linkedAt: new Date() })).id,
    ];
    const { channelImportService } = await import("@server/channels/channel-import.service");
    // Settled one by one, in no family together yet: the header offers "Make one family" (spec A3).
    await prisma.product.update({ where: { id: p2.id }, data: { familyId: null } });
    expect((await channelImportService.listingsPage(orgId, "amazon", "linked", null, 1)).groups[`FM-${stamp}-PARENT`]).toMatchObject({ state: "make", total: 2, settled: 2 });
    await prisma.product.update({ where: { id: p2.id }, data: { familyId: other.id } });
    await read(ids);
    await expect(family.settle(orgId, userId, input(ids))).rejects.toThrow(/is in family Other family .*Choose Move here, or leave it out/);

    const moved = input(ids, { members: ids.map((id) => ({ listingId: id, include: true, move: true, stock: [] })) });
    const result = await family.settle(orgId, userId, moved);
    const rows = await prisma.product.findMany({ where: { id: { in: [p1.id, p2.id] } }, select: { id: true, familyId: true, price: true } });
    expect(rows.every((r) => r.familyId === result.familyId)).toBe(true);
    expect(rows.find((r) => r.id === p1.id)).toMatchObject({ price: 120_000 });
    expect((await answersOf(p1.id)).facts).toMatchObject({ colour: { value: "black", origin: "product" } });
    await prisma.product.update({ where: { id: p2.id }, data: { familyId: null } });
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p2.id }, select: { familyId: true } })).familyId).toBeNull();
  });

  it("refuses a member SKU another product holds, ignoring case (Q8, product-merge Q31)", async () => {
    await prisma.product.create({ data: { name: "Taken", slug: `fm-${stamp}-taken`, description: "", price: 1000, categoryId, thumbnail: "/brand/bhendi-bazaar.png", orgId, sku: sku("TAKEN") } });
    const ids = [(await listing("S1", "Black")).id, (await listing("S2", "Red")).id];
    await read(ids);
    const body = input(ids);
    body.members[0] = { ...body.members[0], sku: sku("taken").toLowerCase() } as never;
    await expect(family.settle(orgId, userId, body)).rejects.toThrow(/is already used by Taken/);
  });

  it("plans on the server: an answer that is not ours, or a fact the browser invents, decides nothing (D3)", async () => {
    fake.state.colours = {};
    const ids = [(await listing("Q1", "Black")).id, (await listing("Q2", "Inkish")).id];
    await read(ids);
    await expect(family.settle(orgId, userId, input(ids, { answers: { [ids[1]]: { colour: "not-a-colour" } } }))).rejects.toThrow(/Give each member its colour: Inkish is not answered/);
    const result = await family.settle(orgId, userId, input(ids, { answers: { [ids[1]]: { colour: "navy", material: "crepe" } } }));
    const navy = await prisma.product.findFirstOrThrow({ where: { familyId: result.familyId, sku: sku("Q2") }, select: { id: true } });
    expect((await answersOf(navy.id)).facts).toMatchObject({ colour: { value: "navy", source: { value: "Inkish" } }, material: { value: "cotton", origin: "family" } });
  });

  it("adds new listings to a family that exists (Q20)", async () => {
    const first = [(await listing("F1", "Black")).id, (await listing("F2", "Red")).id];
    await read(first);
    const made = await family.settle(orgId, userId, input(first));
    const later = [(await listing("F3", "Navy")).id];
    await read(later);
    const page = await family.page(orgId, [...first, ...later]);
    expect(page?.family?.id).toBe(made.familyId);
    await family.settle(orgId, userId, input([...first, ...later], { familyId: made.familyId }));
    expect(await prisma.product.count({ where: { familyId: made.familyId } })).toBe(3);
  });

  it("gives each group on the Listings page its one action: settle, make, add, then see (D6)", async () => {
    const { channelImportService } = await import("@server/channels/channel-import.service");
    const groupOf = async () => (await channelImportService.listingsPage(orgId, "amazon", "notLinked", null, 1)).groups[`FM-${stamp}-PARENT`]
      ?? (await channelImportService.listingsPage(orgId, "amazon", "linked", null, 1)).groups[`FM-${stamp}-PARENT`];
    const ids = [(await listing("G1", "Black")).id, (await listing("G2", "Red")).id];
    expect(await groupOf()).toMatchObject({ state: "settle", total: 2, settled: 0 });
    expect((await channelImportService.listingsPage(orgId, "amazon", "notLinked", null, 1)).firstFamily).toBe(true);

    await read(ids);
    const made = await family.settle(orgId, userId, input(ids));
    expect(await groupOf()).toMatchObject({ state: "family", family: { id: made.familyId } });

    await listing("G3", "Navy");
    expect(await groupOf()).toMatchObject({ state: "add", outside: 1 });
    expect((await channelImportService.listingsPage(orgId, "amazon", "notLinked", null, 1)).firstFamily).toBe(false);
  });

  it("refuses a category with no product type: members could not be told apart (Q17)", async () => {
    const { categoryId: untyped } = await ensureFixtures();
    const ids = [(await listing("T1", "Black")).id, (await listing("T2", "Red")).id];
    await read(ids);
    await expect(family.settle(orgId, userId, input(ids, { categoryId: untyped }))).rejects.toThrow(/Pick a category with a product type/);
  });

  it("suggests listings that look like one item until the owner says they are not (Q5, Q21)", async () => {
    const { channelImportService } = await import("@server/channels/channel-import.service");
    const a = await listing("HJB-PCH", "Peach", { parentSku: null, title: `Chiffon Hijab Peach ${stamp}` });
    const b = await listing("HJB-SGE", "Sage", { parentSku: null, title: `Chiffon Hijab Sage ${stamp}` });
    const suggested = async () => (await channelImportService.listingsPage(orgId, "amazon", "notLinked", null, 1)).sameItem.some((g) => g.listingIds.includes(a.id) && g.listingIds.includes(b.id));
    expect(await suggested()).toBe(true);
    await channelImportService.dismissFamilyHint(orgId, [a.id, b.id]);
    expect(await suggested()).toBe(false);
  });

  it("rolls back the members already made when a later one fails inside the transaction (D3)", async () => {
    const catalog = await import("@server/catalog/product.service");
    const p1 = await prisma.product.create({ data: { name: "Own navy", slug: `fm-${stamp}-rb`, description: "", price: 1000, categoryId, thumbnail: "/brand/bhendi-bazaar.png", orgId, sku: sku("RB"), productType: "trousers" }, select: { id: true } });
    const ids = [(await listing("R1", "Black")).id, (await listing("R2", "Red")).id, (await listing("R3", "Navy", { productId: p1.id, linkSource: "OWNER", linkedAt: new Date() })).id];
    await read(ids);
    const spy = vi.spyOn(catalog.productService, "setFamilyIn").mockResolvedValue(false);
    try {
      await expect(family.settle(orgId, userId, input(ids))).rejects.toThrow(/changed while you were here/);
    } finally {
      spy.mockRestore();
    }
    expect(await prisma.productFamily.count({ where: { orgId, name: `Floral trousers ${stamp}` } })).toBe(0);
    expect(await prisma.product.count({ where: { sku: { in: [sku("R1"), sku("R2")] } } })).toBe(0);
    expect(await prisma.channelListing.count({ where: { id: { in: ids.slice(0, 2) }, productId: { not: null } } })).toBe(0);
  });

  it("refuses a new member that matches one already in the family, naming it (Q8, Q20)", async () => {
    const first = [(await listing("E1", "Black")).id, (await listing("E2", "Red")).id];
    await read(first);
    const made = await family.settle(orgId, userId, input(first));
    const again = [(await listing("E3", "black")).id];
    await read(again);
    await expect(family.settle(orgId, userId, input(again, { familyId: made.familyId }))).rejects.toThrow(new RegExp(`Two members are Black: SKU ${sku("E3")} and ${sku("E1")}`));
  });

  it("shows only the listings outside the family when adding, so a group over 30 is added in parts (Q19)", async () => {
    const ids: string[] = [];
    const colours = ["black", "red", "navy", "blue", "olive"];
    for (let i = 0; i < 32; i++) ids.push((await listing(`B${String(i).padStart(2, "0")}`, `${colours[i % 5]}`, { title: `Floral trousers ${String(i).padStart(2, "0")}` })).id);
    const page = await family.page(orgId, ids);
    expect(page?.members).toHaveLength(30);
    expect(page?.more).toBe(2);
    const firstThirty = page!.members.map((m) => m.listingId);
    await prisma.product.createMany({
      data: firstThirty.map((_, i) => ({ name: `Own ${i}`, slug: `fm-${stamp}-own-${i}`, description: "", price: 1000, categoryId, thumbnail: "/brand/bhendi-bazaar.png", orgId, sku: sku(`OWN${i}`), productType: "trousers" })),
    });
    const fam = await prisma.productFamily.create({ data: { orgId, name: `Floral trousers ${stamp}`, productType: "trousers", variantAxis: ["colour"] }, select: { id: true } });
    const owns = await prisma.product.findMany({ where: { sku: { startsWith: sku("OWN") } }, select: { id: true } });
    for (let i = 0; i < 30; i++) {
      await prisma.product.update({ where: { id: owns[i].id }, data: { familyId: fam.id } });
      await prisma.channelListing.update({ where: { id: firstThirty[i] }, data: { productId: owns[i].id, linkSource: "OWNER", linkedAt: new Date() } });
    }
    const later = await family.page(orgId, ids);
    expect(later?.family?.id).toBe(fam.id);
    expect(later?.members.map((m) => m.listingId).sort()).toEqual(ids.filter((id) => !firstThirty.includes(id)).sort());
    expect(later?.more).toBe(0);
  });

  it("refuses a product of another type, and asks a member whose listing says nothing (ADR-0043 D2, Q18)", async () => {
    // A product's type is its category's (listing-model Q9), so the odd one sits in a prayer-mat category.
    const matCategory = await prisma.category.create({ data: { name: `Mats ${stamp}`, slug: `fm-mats-${stamp}`, description: "x", heroImage: "/x.jpg", productType: "prayer-mat" }, select: { id: true } });
    const odd = await prisma.product.create({ data: { name: "A prayer mat", slug: `fm-${stamp}-odd`, description: "", price: 1000, categoryId: matCategory.id, thumbnail: "/brand/bhendi-bazaar.png", orgId, sku: sku("ODD"), productType: "prayer-mat" }, select: { id: true } });
    const ids = [(await listing("M1", "Black")).id, (await listing("M2", "Red", { productId: odd.id, linkSource: "OWNER", linkedAt: new Date() })).id];
    await read(ids);
    await expect(family.settle(orgId, userId, input(ids))).rejects.toThrow(/A prayer mat is a different kind of product from this family\. Change its category first, or leave it out/);

    const silent = [(await listing("N1", "Black")).id, (await listing("N2", "")).id];
    await read(silent);
    await expect(family.settle(orgId, userId, input(silent))).rejects.toThrow(/Give each member its colour/);
    await family.settle(orgId, userId, input(silent, { answers: { [silent[1]]: { colour: "navy" } } }));
  });
});
