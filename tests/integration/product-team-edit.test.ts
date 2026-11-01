/**
 * The Bhendi Bazaar team fixing a shop's product (product-form D11, D12; spec R10, R11, A7): one
 * audit entry with the reason and each field's before and after, the team's mark on the product,
 * the org always the product's, a save that stands when the trail fails, and an archived product
 * refused until it is restored.
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("product team edit (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let productTeamService: typeof import("@server/catalog/product-team.service").productTeamService;
  let productsService: typeof import("@server/catalog/admin.product.service").productsService;
  let adminLogRepository: typeof import("@server/shared/audit/audit.repository").adminLogRepository;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;
  let adminId: string;
  let otherOrgId: string;
  const ids: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ productTeamService } = await import("@server/catalog/product-team.service"));
    ({ productsService } = await import("@server/catalog/admin.product.service"));
    ({ adminLogRepository } = await import("@server/shared/audit/audit.repository"));
    fixtures = await ensureFixtures();
    adminId = (
      await prisma.user.upsert({
        where: { email: "product-team-admin@fixtures.test" },
        update: {},
        create: { name: "Asma Admin", email: "product-team-admin@fixtures.test" },
        select: { id: true },
      })
    ).id;
    otherOrgId = (
      await prisma.org.upsert({
        where: { code: "TEAMX" },
        update: {},
        create: { code: "TEAMX", handle: "team-edit-other", name: "Other Shop", email: "team-edit-other@fixtures.test" },
        select: { id: true },
      })
    ).id;
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    if (!prisma) return;
    await prisma.adminLog.deleteMany({ where: { resourceId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  });

  const payload = (change: { price?: number; name?: string; orgId?: string } = {}) => ({
    name: change.name ?? `Team test ${Date.now().toString(36)}`,
    description: "Created by tests/integration/product-team-edit.test.ts",
    price: change.price ?? 2499,
    categoryId: fixtures.categoryId,
    weight: 0.6,
    media: [{ kind: "IMAGE" as const, ref: "https://placehold.co/600x600", isThumbnail: true }],
    stockLocations: [{ orgAddressId: fixtures.orgAddressId, quantity: 5 }],
    reason: "Shop asked to fix the price",
  });

  /** The team's edit form, opened at version 0 over a product holding 5. */
  const edit = (change: { price?: number; name?: string } = {}) => ({
    ...payload(change),
    stockLocations: [{ orgAddressId: fixtures.orgAddressId, quantity: 5, seenQuantity: 5 }],
    seenVersion: 0,
  });

  async function aShopProduct() {
    const { reason: _reason, ...data } = payload();
    const created = await productsService.createProduct({ ...data, orgId: fixtures.orgId });
    ids.push(created.id);
    return created.id;
  }

  const entries = (id: string) =>
    prisma.adminLog.findMany({ where: { resource: "Product", resourceId: id }, orderBy: { createdAt: "asc" } });

  it("a team edit leaves one entry with the reason and money first, and marks the product (A7)", async () => {
    const id = await aShopProduct();
    await productTeamService.update(id, edit({ price: 2299, name: "Fixed name" }), adminId);

    const [entry, ...more] = await entries(id);
    expect(more).toEqual([]);
    expect(entry).toMatchObject({ adminId, action: "PRODUCT_TEAM_UPDATED" });
    const metadata = entry.metadata as { orgId: string; reason: string; changes: Array<{ field: string; before: unknown; after: unknown }> };
    expect(metadata.orgId).toBe(fixtures.orgId);
    expect(metadata.reason).toBe("Shop asked to fix the price");
    expect(metadata.changes[0]).toEqual({ field: "price", before: 249_900, after: 229_900 });
    expect(metadata.changes.map((change) => change.field)).toContain("name");

    const row = await prisma.product.findUniqueOrThrow({ where: { id }, select: { teamEditedAt: true, lastEditedById: true, version: true } });
    expect(row.teamEditedAt).not.toBeNull();
    expect(row).toMatchObject({ lastEditedById: adminId, version: 1 });
  });

  it("the org is the product's: a body naming another shop moves nothing there", async () => {
    const id = await aShopProduct();
    const body = { ...edit(), orgId: otherOrgId } as Parameters<typeof productTeamService.update>[1];
    await productTeamService.update(id, body, adminId);
    expect((await prisma.product.findUniqueOrThrow({ where: { id }, select: { orgId: true } })).orgId).toBe(fixtures.orgId);
  });

  it("saves when the audit trail fails (ADR-0021)", async () => {
    const id = await aShopProduct();
    vi.spyOn(adminLogRepository, "createLog").mockRejectedValue(new Error("audit down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await productTeamService.update(id, edit({ price: 1999 }), adminId);
    expect((await prisma.product.findUniqueOrThrow({ where: { id }, select: { price: true } })).price).toBe(199_900);
    expect(await entries(id)).toEqual([]);
  });

  it("an archived product is refused with Restore, and edits once restored", async () => {
    const id = await aShopProduct();
    await productsService.archiveProduct(id, { orgId: fixtures.orgId, userId: fixtures.userId });
    await expect(productTeamService.update(id, edit({ price: 1999 }), adminId)).rejects.toMatchObject({
      name: "ConflictError",
      message: "This product is archived. Restore it to edit.",
    });
    expect((await prisma.product.findUniqueOrThrow({ where: { id }, select: { price: true } })).price).toBe(249_900);

    await productTeamService.restore(id, adminId);
    await productTeamService.update(id, edit({ price: 1999 }), adminId);
    expect((await prisma.product.findUniqueOrThrow({ where: { id }, select: { price: true, archivedAt: true } }))).toEqual({
      price: 199_900,
      archivedAt: null,
    });
  });

  it("a team create is the shop's product, marked as the team's, with one entry (R10, R11)", async () => {
    const product = await productTeamService.create(fixtures.orgId, payload({ name: `Team made ${Date.now().toString(36)}` }), adminId);
    ids.push(product.id);
    const row = await prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: { orgId: true, teamEditedAt: true } });
    expect(row.orgId).toBe(fixtures.orgId);
    expect(row.teamEditedAt).not.toBeNull();
    const [entry, ...more] = await entries(product.id);
    expect(more).toEqual([]);
    expect(entry).toMatchObject({ action: "PRODUCT_TEAM_CREATED", adminId });
    expect((entry.metadata as { changes: Array<{ field: string; before: unknown }> }).changes[0]).toEqual({
      field: "price",
      before: null,
      after: 249_900,
    });
  });
});
