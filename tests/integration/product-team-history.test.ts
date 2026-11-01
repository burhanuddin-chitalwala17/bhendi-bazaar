/**
 * The shop's view of the team's edits (product-form R12, A7, D13; Q14, Q23): the history reads the
 * team's saves on its product, newest first, money first, with the reason and without the admin;
 * the mark is on the list row and counted on Home until the shop next saves.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("product team history (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let productTeamService: typeof import("@server/catalog/product-team.service").productTeamService;
  let productsService: typeof import("@server/catalog/admin.product.service").productsService;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;
  let adminId: string;
  let orgId: string;
  let orgAddressId: string;
  const ids: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ productTeamService } = await import("@server/catalog/product-team.service"));
    ({ productsService } = await import("@server/catalog/admin.product.service"));
    fixtures = await ensureFixtures();
    adminId = (
      await prisma.user.upsert({
        where: { email: "product-team-history-admin@fixtures.test" },
        update: {},
        create: { name: "Asma Admin", email: "product-team-history-admin@fixtures.test" },
        select: { id: true },
      })
    ).id;
    // Its own shop, so Home's count is not moved by any other suite's products.
    orgId = (
      await prisma.org.upsert({
        where: { code: "TEAMH" },
        update: {},
        create: { code: "TEAMH", handle: "team-history-shop", name: "Team History Shop", email: "team-history@example.invalid", profile: { create: {} }, listingDefaults: { create: {} } },
        select: { id: true },
      })
    ).id;
    orgAddressId = (
      (await prisma.orgAddress.findFirst({ where: { orgId, isActive: true }, select: { id: true } })) ??
      (await prisma.orgAddress.create({
        data: {
          org: { connect: { id: orgId } },
          address: { create: { addressLine1: "2 Fixture Road", city: "Mumbai", state: "Maharashtra", pincode: "400001" } },
          name: "History shelf",
          contactName: "Fixture",
          contactPhone: "9999999999",
          isActive: true,
        },
        select: { id: true },
      }))
    ).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.adminLog.deleteMany({ where: { resourceId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  });

  const fields = (price = 2499) => ({
    name: `History test ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    description: "Created by tests/integration/product-team-history.test.ts",
    price,
    categoryId: fixtures.categoryId,
    weight: 0.6,
    media: [{ kind: "IMAGE" as const, ref: "https://placehold.co/600x600", isThumbnail: true }],
  });
  const atVersion = (seenVersion: number, price: number, name: string) => ({
    ...fields(price),
    name,
    stockLocations: [{ orgAddressId, quantity: 5, seenQuantity: 5 }],
    seenVersion,
  });

  async function aShopProduct() {
    const created = await productsService.createProduct({ ...fields(), stockLocations: [{ orgAddressId, quantity: 5 }], orgId });
    ids.push(created.id);
    return created;
  }

  it("the shop reads the team's save: reason, money first, no admin (A7, Q14)", async () => {
    const product = await aShopProduct();
    await productTeamService.update(product.id, { ...atVersion(0, 2299, product.name), reason: "Shop asked to fix the price" }, adminId);
    await productTeamService.update(product.id, { ...atVersion(1, 2199, product.name), reason: "Second fix" }, adminId);

    const history = await productTeamService.history(product.id, orgId);
    expect(history.map((edit) => edit.reason)).toEqual(["Second fix", "Shop asked to fix the price"]);
    expect(history[1].changes).toEqual([{ field: "price", before: 249_900, after: 229_900 }]);
    expect(history[1].created).toBe(false);
    // Mutation-tested: spreading the stored entry into the DTO puts adminId on the wire.
    expect(Object.keys(history[0]).sort()).toEqual(["at", "changes", "created", "id", "reason"]);
    expect(JSON.stringify(history)).not.toContain(adminId);
  });

  it("another shop reads nothing of this product's history", async () => {
    const product = await aShopProduct();
    await productTeamService.update(product.id, { ...atVersion(0, 2299, product.name), reason: "Fix for this shop" }, adminId);
    expect(await productTeamService.history(product.id, fixtures.otherOrgId)).toEqual([]);
  });

  it("the shop's archive and restore entries are not the team's history", async () => {
    const product = await aShopProduct();
    await productsService.archiveProduct(product.id, { orgId, userId: fixtures.userId });
    await productsService.restoreProduct(product.id, { orgId, userId: fixtures.userId });
    expect(await productTeamService.history(product.id, orgId)).toEqual([]);
  });

  it("Home counts the marked products, opens the one, and the shop's save clears it (Q23, ux Stale)", async () => {
    // The earlier cases (and any interrupted run) marked products here; Home counts from a clean shop.
    await prisma.product.updateMany({ where: { orgId }, data: { teamEditedAt: null } });
    const first = await aShopProduct();
    expect(await productTeamService.teamEditedSummary(orgId)).toEqual({ count: 0, productId: null });

    await productTeamService.update(first.id, { ...atVersion(0, 2299, first.name), reason: "Price fix" }, adminId);
    expect(await productTeamService.teamEditedSummary(orgId)).toEqual({ count: 1, productId: first.id });

    const second = await aShopProduct();
    await productTeamService.update(second.id, { ...atVersion(0, 2299, second.name), reason: "Price fix" }, adminId);
    expect(await productTeamService.teamEditedSummary(orgId)).toEqual({ count: 2, productId: null });

    const listed = await productsService.getProducts({ orgId, page: 1, limit: 50 });
    expect(listed.products.find((row) => row.id === first.id)?.teamEditedAt).toBeInstanceOf(Date);

    // The shop saves its own product: the mark goes, the history stays (Q14).
    await productsService.updateProduct(first.id, { ...atVersion(1, 2299, first.name), orgId }, { userId: fixtures.userId, team: false });
    expect(await productTeamService.teamEditedSummary(orgId)).toEqual({ count: 1, productId: second.id });
    expect(await productTeamService.history(first.id, orgId)).toHaveLength(1);

    // Archived since by the shop: acted on, so Home stops counting it.
    await productsService.archiveProduct(second.id, { orgId, userId: fixtures.userId });
    expect(await productTeamService.teamEditedSummary(orgId)).toEqual({ count: 0, productId: null });
  });
});
