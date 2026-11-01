/**
 * The team's bulk upload for a shop (own-store/bulk-sheet R9, A6; D10, D11): one audit entry for
 * the whole upload, every product marked as the team's, a shop's own upload clearing the mark and
 * moving the version, an import that stands when the trail fails, a bad row creating nothing, and
 * a deactivated shop refused.
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const PREFIX = "bulk-team-test-";
const BLOB = "https://test.public.blob.vercel-storage.com/products/x/y/z.jpg";

describe.skipIf(!isDisposableDb)("bulk sheet for a shop, by the team (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let bulkTeamService: typeof import("@server/catalog/bulk/bulk-team.service").bulkTeamService;
  let createProducts: typeof import("@server/catalog/bulk/bulk-product.service").createProducts;
  let adminLogRepository: typeof import("@server/shared/audit/audit.repository").adminLogRepository;
  let BULK_TEAM_ACTION: typeof import("@server/catalog/bulk/bulk.types").BULK_TEAM_ACTION;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;
  let adminId: string;
  let locationName: string;
  let closedOrgId: string;
  let blockedOrgId: string;
  let promotionService: typeof import("@server/promotions/promotion.service").promotionService;

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ bulkTeamService } = await import("@server/catalog/bulk/bulk-team.service"));
    ({ createProducts } = await import("@server/catalog/bulk/bulk-product.service"));
    ({ adminLogRepository } = await import("@server/shared/audit/audit.repository"));
    ({ BULK_TEAM_ACTION } = await import("@server/catalog/bulk/bulk.types"));
    ({ promotionService } = await import("@server/promotions/promotion.service"));
    fixtures = await ensureFixtures();
    adminId = (
      await prisma.user.upsert({
        where: { email: "bulk-team-admin@fixtures.test" },
        update: {},
        create: { name: "Asma Admin", email: "bulk-team-admin@fixtures.test" },
        select: { id: true },
      })
    ).id;
    locationName = (await prisma.orgAddress.findUniqueOrThrow({ where: { id: fixtures.orgAddressId }, select: { name: true } })).name;
    closedOrgId = (
      await prisma.org.upsert({
        where: { code: "BULKTEAMX" },
        update: { isActive: false },
        create: { code: "BULKTEAMX", handle: "bulk-team-closed", name: "Closed Shop", email: "bulk-team-closed@fixtures.test", isActive: false },
        select: { id: true },
      })
    ).id;
    blockedOrgId = (
      await prisma.org.upsert({
        where: { code: "BULKTEAMB" },
        update: { isActive: true, isBlocked: true },
        create: { code: "BULKTEAMB", handle: "bulk-team-blocked", name: "Blocked Shop", email: "bulk-team-blocked@fixtures.test", isActive: true, isBlocked: true },
        select: { id: true },
      })
    ).id;
  });

  afterEach(() => vi.restoreAllMocks());

  afterAll(async () => {
    if (!prisma) return;
    await prisma.adminLog.deleteMany({ where: { action: BULK_TEAM_ACTION.UPLOADED, resourceId: { in: [fixtures.orgId, closedOrgId, blockedOrgId] } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  const row = (name: string, extra: { sku?: string; price?: number; salePrice?: number } = {}, rowNumber = 5) => ({
    rowNumber,
    tab: "Other",
    row: {
      name: `${PREFIX}${name}`,
      description: "Created by tests/integration/bulk-sheet-team.test.ts",
      price: extra.price ?? 250,
      categorySlug: fixtures.categorySlug,
      ...(extra.sku ? { sku: extra.sku } : {}),
      ...(extra.salePrice ? { salePrice: extra.salePrice } : {}),
      weight: 0.5,
      factLabels: {},
      measurements: {},
      tags: [],
      // One photo per row, named by row: one shared name would match every row's file.
      images: [`${name}.jpg`],
      stock: { [locationName]: 3 },
      imageUrls: { [`${name}.jpg`]: BLOB },
    },
  });

  const entriesFor = (orgId: string) =>
    prisma.adminLog.findMany({ where: { action: BULK_TEAM_ACTION.UPLOADED, resource: "Org", resourceId: orgId } });

  it("A6 — 40 rows for a shop leave one audit entry naming 40, and 40 products marked as the team's", async () => {
    const run = Date.now().toString(36);
    const before = (await entriesFor(fixtures.orgId)).length;
    const rows = Array.from({ length: 40 }, (_, i) => row(`a6-${run}-${i}`, {}, i + 5));
    const result = await bulkTeamService.create(fixtures.orgId, rows, { reason: "Shop emailed its sheet", fileName: "noor.xlsx" }, adminId);
    expect(result).toEqual({ ok: true, created: 40, updated: 0 });

    const entries = await entriesFor(fixtures.orgId);
    expect(entries).toHaveLength(before + 1);
    const metadata = entries.at(-1)!.metadata as Record<string, unknown>;
    expect(metadata).toMatchObject({ orgId: fixtures.orgId, reason: "Shop emailed its sheet", fileName: "noor.xlsx", created: 40, updated: 0 });
    expect(entries.at(-1)!.adminId).toBe(adminId);

    const products = await prisma.product.findMany({
      where: { name: { startsWith: `${PREFIX}a6-${run}-` } },
      select: { id: true, orgId: true, teamEditedAt: true, lastEditedById: true },
    });
    expect(products).toHaveLength(40);
    expect([...(metadata.productIds as string[])].sort()).toEqual(products.map((p) => p.id).sort());
    for (const product of products) {
      expect(product.orgId).toBe(fixtures.orgId);
      expect(product.teamEditedAt).not.toBeNull();
      expect(product.lastEditedById).toBe(adminId);
    }
  });

  it("D10 — the shop's own upload over a team-marked product clears the mark, names the shop's editor and moves the version", async () => {
    const sku = `${PREFIX}d10-${Date.now().toString(36)}`;
    await bulkTeamService.create(fixtures.orgId, [row("d10", { sku })], { reason: "Shop asked us to add it" }, adminId);
    const marked = await prisma.product.findFirstOrThrow({ where: { sku, orgId: fixtures.orgId }, select: { id: true, version: true, teamEditedAt: true } });
    expect(marked.teamEditedAt).not.toBeNull();

    const result = await createProducts(fixtures.orgId, [row("d10-fixed", { sku, price: 300 })], { userId: fixtures.userId, team: false });
    expect(result).toMatchObject({ created: 0, updated: 1, productIds: [marked.id] });
    const after = await prisma.product.findUniqueOrThrow({ where: { id: marked.id }, select: { version: true, teamEditedAt: true, lastEditedById: true } });
    expect(after.version).toBe(marked.version + 1);
    expect(after.teamEditedAt).toBeNull();
    expect(after.lastEditedById).toBe(fixtures.userId);
  });

  it("a team update over a product marks it and moves the version", async () => {
    const sku = `${PREFIX}upd-${Date.now().toString(36)}`;
    await createProducts(fixtures.orgId, [row("upd", { sku })], { userId: fixtures.userId, team: false });
    const before = await prisma.product.findFirstOrThrow({ where: { sku, orgId: fixtures.orgId }, select: { id: true, version: true, teamEditedAt: true } });
    expect(before.teamEditedAt).toBeNull();
    const result = await bulkTeamService.create(fixtures.orgId, [row("upd-team", { sku })], { reason: "Price fix" }, adminId);
    expect(result).toEqual({ ok: true, created: 0, updated: 1 });
    const after = await prisma.product.findUniqueOrThrow({ where: { id: before.id }, select: { version: true, teamEditedAt: true } });
    expect(after.version).toBe(before.version + 1);
    expect(after.teamEditedAt).not.toBeNull();
  });

  it("imports when the audit trail fails (ADR-0021)", async () => {
    vi.spyOn(adminLogRepository, "createLog").mockRejectedValue(new Error("audit down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const name = `audit-down-${Date.now().toString(36)}`;
    const result = await bulkTeamService.create(fixtures.orgId, [row(name)], { reason: "Shop emailed its sheet" }, adminId);
    expect(result).toEqual({ ok: true, created: 1, updated: 0 });
    expect(await prisma.product.count({ where: { name: `${PREFIX}${name}` } })).toBe(1);
  });

  it("Q17 — a failed sale-price write after the import still leaves the one audit entry", async () => {
    vi.spyOn(promotionService, "setProductMarkdown").mockRejectedValue(new Error("markdown down"));
    const before = (await entriesFor(fixtures.orgId)).length;
    const name = `md-down-${Date.now().toString(36)}`;
    await expect(
      bulkTeamService.create(fixtures.orgId, [row(name, { salePrice: 200 })], { reason: "Shop emailed its sheet" }, adminId),
    ).rejects.toMatchObject({ status: 500 });
    const product = await prisma.product.findFirstOrThrow({ where: { name: `${PREFIX}${name}` }, select: { id: true, teamEditedAt: true } });
    expect(product.teamEditedAt).not.toBeNull();
    const entries = await entriesFor(fixtures.orgId);
    expect(entries).toHaveLength(before + 1);
    expect(entries.filter((e) => (e.metadata as { productIds: string[] }).productIds.includes(product.id))).toHaveLength(1);
  });

  it("Q19 — one bad row creates nothing and writes no entry", async () => {
    const before = (await entriesFor(fixtures.orgId)).length;
    const run = Date.now().toString(36);
    const bad = row(`q19-bad-${run}`, {}, 6);
    bad.row.categorySlug = "no-such-category-anywhere";
    const result = await bulkTeamService.create(fixtures.orgId, [row(`q19-good-${run}`), bad], { reason: "Shop emailed its sheet" }, adminId);
    expect(result.ok).toBe(false);
    expect(await prisma.product.count({ where: { name: { startsWith: `${PREFIX}q19-` } } })).toBe(0);
    expect(await entriesFor(fixtures.orgId)).toHaveLength(before);
  });

  it("a deactivated shop is refused with ux.md's copy, and nothing is created", async () => {
    const name = `closed-${Date.now().toString(36)}`;
    await expect(bulkTeamService.create(closedOrgId, [row(name)], { reason: "Shop emailed its sheet" }, adminId)).rejects.toMatchObject({
      message: "Closed Shop is deactivated. Reactivate it to add products.",
    });
    expect(await prisma.product.count({ where: { name: `${PREFIX}${name}` } })).toBe(0);
  });

  it("D11 — an active but blocked shop is refused too, and nothing is created", async () => {
    const name = `blocked-${Date.now().toString(36)}`;
    await expect(bulkTeamService.create(blockedOrgId, [row(name)], { reason: "Shop emailed its sheet" }, adminId)).rejects.toMatchObject({
      message: "Blocked Shop is deactivated. Reactivate it to add products.",
    });
    expect(await prisma.product.count({ where: { name: `${PREFIX}${name}` } })).toBe(0);
  });

  it("an unknown shop is a 404, for every admin bulk route", async () => {
    await expect(bulkTeamService.shop("no-such-org")).rejects.toMatchObject({ status: 404 });
  });
});
