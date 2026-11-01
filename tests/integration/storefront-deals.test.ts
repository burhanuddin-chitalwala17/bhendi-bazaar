/**
 * A shop's deals against a real schema (storefront-themes D10; R7, A3, A6; Q12, Q20). The section
 * lists only this shop's running automatic offers and the codes it ticked; the badge's price is
 * the one checkout quotes; a stopped offer leaves both on the next load.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const HOUR = 3_600_000;

describe.skipIf(!isDisposableDb)("storefront deals (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let promotionService: typeof import("@server/promotions/promotion.service").promotionService;
  let adminPromotionService: typeof import("@server/promotions/admin.promotion.service").adminPromotionService;
  let priceContext: typeof import("@server/promotions/price-context");
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const orgCode = `SD${stamp}`.slice(0, 12);
  let orgId: string;
  let otherOrgId: string;
  let categoryId: string;
  let product: { id: string; price: number; orgId: string; categoryId: string };
  const promotionIds: string[] = [];
  const ownIds: string[] = [];

  const offer = (overrides: Record<string, unknown> = {}) => ({
    label: "Diwali sale",
    trigger: "AUTOMATIC" as const,
    valueType: "PERCENT" as const,
    percent: 20,
    startsAt: new Date(Date.now() - HOUR),
    endsAt: new Date(Date.now() + 48 * HOUR),
    isActive: true,
    showOnStorefront: false,
    categoryIds: [] as string[],
    productIds: [product.id],
    ...overrides,
  });

  async function create(input: ReturnType<typeof offer>) {
    const row = await adminPromotionService.create(input as never, { scope: "ORG", orgId });
    promotionIds.push(row.id);
    ownIds.push(row.id);
    return row.id;
  }

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ promotionService } = await import("@server/promotions/promotion.service"));
    ({ adminPromotionService } = await import("@server/promotions/admin.promotion.service"));
    priceContext = await import("@server/promotions/price-context");
    const { orgRepository } = await import("@server/catalog/org.repository");
    const fixtures = await ensureFixtures();
    categoryId = fixtures.categoryId;
    otherOrgId = fixtures.otherOrgId;
    orgId = (
      await orgRepository.create({
        code: orgCode,
        handle: `deals-test-${stamp.toLowerCase()}`,
        name: `Deals Test ${stamp}`,
        email: `deals-${stamp.toLowerCase()}@example.invalid`,
        isActive: true,
      })
    ).id;
    product = await prisma.product.create({
      data: {
        name: `Deals ${stamp}`, slug: `deals-${stamp.toLowerCase()}`, description: "fixture", price: 100_000,
        thumbnail: "https://example.invalid/deals.webp", categoryId, orgId,
      },
      select: { id: true, price: true, orgId: true, categoryId: true },
    }) as typeof product;
  });

  afterAll(async () => {
    await prisma.promotionTarget.deleteMany({ where: { promotionId: { in: promotionIds } } });
    await prisma.promotion.deleteMany({ where: { id: { in: promotionIds } } });
    await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.org.delete({ where: { id: orgId } });
  });

  it("lists this shop's running automatic offers and only the codes it ticked (R7, Q20)", async () => {
    const automatic = await create(offer());
    const unticked = await create(offer({ label: "Quiet code", trigger: "CODE", code: `${orgCode}-QUIET` }));
    const ticked = await create(offer({ label: "Loud code", trigger: "CODE", code: `${orgCode}-LOUD`, showOnStorefront: true }));
    // Someone else's offer on someone else's goods: never on this shop's page.
    const theirs = await prisma.promotion.create({
      data: {
        label: "Their sale", scope: "ORG", orgId: otherOrgId, trigger: "AUTOMATIC", valueType: "PERCENT",
        percentBps: 1000, startsAt: new Date(Date.now() - HOUR), endsAt: new Date(Date.now() + HOUR),
      },
      select: { id: true },
    });
    promotionIds.push(theirs.id);

    const shown = await promotionService.storefrontOffers(orgId);
    expect(shown.map((o) => o.id).sort()).toEqual([automatic, ticked].sort());
    expect(shown.find((o) => o.id === ticked)?.code).toBe(`${orgCode}-LOUD`);
    expect(shown.find((o) => o.id === automatic)?.headline).toBe(`20% off · Deals ${stamp}`);
    expect(shown.map((o) => o.id)).not.toContain(unticked);
  });

  it("stores the tick only on a shop's code: an automatic offer that sends it stores false", async () => {
    const id = await create(offer({ label: "Auto with tick", showOnStorefront: true }));
    const row = await prisma.promotion.findUniqueOrThrow({ where: { id }, select: { showOnStorefront: true } });
    expect(row.showOnStorefront).toBe(false);
  });

  it("badges the price checkout quotes, and a stopped offer leaves card and badge (A3, A6)", async () => {
    const line = { key: `${product.id}::::`, productId: product.id, orgId, categoryId, unitPrice: product.price, quantity: 1 };
    const badge = priceContext.resolveProductPrice(product, await priceContext.loadPriceContext());
    const quote = await promotionService.quote([line]);
    expect(badge.offerPricePaise).toBeLessThan(product.price);
    expect(badge.offerPricePaise).toBe(product.price - quote.totalDiscountPaise);

    for (const id of ownIds) await adminPromotionService.deactivate(id, { scope: "ORG", orgId });
    expect(await promotionService.storefrontOffers(orgId)).toEqual([]);
    const after = priceContext.resolveProductPrice(product, await priceContext.loadPriceContext());
    const requote = await promotionService.quote([line]);
    expect(after.offerPricePaise).toBe(product.price - requote.totalDiscountPaise);
    expect(after.offerLabel).not.toBe("Diwali sale");
  });

  it("a platform-only offer puts nothing in the shop's deals strip; the shop's own offer does (R7, Q12)", async () => {
    const { productsRepository } = await import("@server/catalog/product.read.repository");
    const platform = await prisma.promotion.create({
      data: {
        label: "Platform sale", scope: "PLATFORM", trigger: "AUTOMATIC", valueType: "PERCENT", percentBps: 1000,
        startsAt: new Date(Date.now() - HOUR), endsAt: new Date(Date.now() + HOUR),
        targets: { create: [{ productId: product.id }] },
      },
      select: { id: true },
    });
    promotionIds.push(platform.id);
    const strip = async () =>
      (await productsRepository.getProducts({ orgId, offerOnly: true, ownOffersOnly: true })).map((p) => p?.id);

    const onOffer = await productsRepository.getProducts({ orgId, offerOnly: true });
    expect(onOffer.map((p) => p?.id)).toContain(product.id);
    expect(await strip()).toEqual([]);

    await create(offer({ label: "Own sale" }));
    expect(await strip()).toEqual([product.id]);
  });
});
