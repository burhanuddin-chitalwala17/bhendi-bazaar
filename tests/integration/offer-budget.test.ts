/**
 * A platform offer that can cost more than commission needs a confirmation and a budget, and
 * spending never passes the budget (offers-hardening R4, D5, D6, own-store Q20). Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CreateOrderWithShipmentsInput } from "@server/checkout/order.types";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { billableWeightKg } from "@server/shipping/billable-weight";
import { signRateQuote } from "@server/shipping/rate-quote.service";

const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));
vi.mock("@/lib/admin-auth", () => ({
  requirePlatformAdmin: async () => ({ user: { id: session.userId } }),
  requirePlatformAdminId: async () => session.userId,
}));

const PREFIX = "offers-u5-";
const SHIPPING = 5_000;
const WEIGHT_KG = 0.5;
const ENDED = "That offer has just ended. Please review your total.";

describe.skipIf(!isDisposableDb)("offers: a platform offer's loss confirmation and budget", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orderService: typeof import("@server/checkout/order.service").orderService;
  let orderRepository: typeof import("@server/checkout/order.repository").orderRepository;
  let adminPromotionService: typeof import("@server/promotions/admin.promotion.service").adminPromotionService;
  let commercialTermsService: typeof import("@server/catalog/commercial-terms.service").commercialTermsService;
  let priceContext: typeof import("@server/promotions/price-context");
  let promotionService: typeof import("@server/promotions/promotion.service").promotionService;
  let promotionRepository: typeof import("@server/promotions/promotion.repository").promotionRepository;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;
  const orderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orderService } = await import("@server/checkout/order.service"));
    ({ orderRepository } = await import("@server/checkout/order.repository"));
    ({ adminPromotionService } = await import("@server/promotions/admin.promotion.service"));
    ({ commercialTermsService } = await import("@server/catalog/commercial-terms.service"));
    priceContext = await import("@server/promotions/price-context");
    ({ promotionService } = await import("@server/promotions/promotion.service"));
    ({ promotionRepository } = await import("@server/promotions/promotion.repository"));
    fixtures = await ensureFixtures();
    session.userId = fixtures.userId;
  });

  afterAll(async () => {
    const inOrders = { orderId: { in: orderIds } };
    await prisma.shipmentItem.deleteMany({ where: { shipment: inOrders } });
    await prisma.shipment.deleteMany({ where: inOrders });
    await prisma.orderDiscount.deleteMany({ where: inOrders });
    await prisma.orderItem.deleteMany({ where: inOrders });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    const ours = { product: { name: { startsWith: PREFIX } } };
    await prisma.promotionTarget.deleteMany({ where: { OR: [ours, { promotion: { label: { startsWith: PREFIX } } }] } });
    await prisma.promotion.deleteMany({ where: { label: { startsWith: PREFIX } } });
    await prisma.productStock.deleteMany({ where: ours });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.org.deleteMany({ where: { code: { startsWith: PREFIX.toUpperCase() } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const window = () => ({ startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000) });
  const thirtyPercent = (productIds: string[], extra: Record<string, unknown> = {}) => ({
    label: unique(), trigger: "AUTOMATIC" as const, valueType: "PERCENT" as const, percent: 30,
    ...window(), isActive: true, categoryIds: [], productIds, ...extra,
  });

  async function aProduct(price: number) {
    const name = unique();
    return await prisma.product.create({
      data: {
        name, slug: name, description: "fixture", price, weight: WEIGHT_KG,
        thumbnail: "https://example.invalid/x.webp", categoryId: fixtures.categoryId, orgId: fixtures.orgId,
        stockLocations: { create: { orgAddressId: fixtures.orgAddressId, quantity: 100 } },
      },
      select: { id: true, price: true, orgId: true, categoryId: true },
    });
  }

  /** A confirmed 30% offer with this budget, saved the way the admin form saves it. */
  async function aBudgetedOffer(productIds: string[], budgetRupees: number) {
    return await adminPromotionService.create(
      thirtyPercent(productIds, { confirmLoss: "CONFIRM LOSS", budget: budgetRupees }),
      { scope: "PLATFORM", userId: fixtures.userId },
    );
  }

  const spent = async (id: string) =>
    (await prisma.promotion.findUniqueOrThrow({ where: { id }, select: { platformSpentPaise: true } })).platformSpentPaise;

  async function checkout(product: { id: string; price: number }, quantity: number, discountBps = 3000) {
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { org: { select: { name: true } }, address: { select: { pincode: true, city: true, state: true } } },
    });
    const discount = Math.floor((product.price * discountBps) / 10_000) * quantity;
    const input: CreateOrderWithShipmentsInput = {
      address: {
        id: "u5-address", fullName: "U5 Buyer", mobile: "9000000055",
        email: "u5@example.invalid", addressLine1: "1 Budget Lane", city: "Mumbai",
        state: "Maharashtra", pincode: "400001", country: "India",
      },
      displayedGrandTotal: product.price * quantity - discount + SHIPPING,
      shippingGroups: [{
        groupId: fixtures.orgAddressId,
        orgId: fixtures.orgId,
        orgName: location.org.name,
        fromPincode: location.address.pincode,
        fromCity: location.address.city,
        fromState: location.address.state,
        items: [{ productId: product.id, quantity }],
        selectedRate: {
          quote: signRateQuote(
            { providerId: fixtures.shippingProviderId, providerName: "Fixture Carrier", courierName: "Test Courier",
              rate: SHIPPING, estimatedDays: 3, mode: "surface" },
            { fromPincode: location.address.pincode, toPincode: "400001",
              billableWeightKg: billableWeightKg(WEIGHT_KG * quantity) },
          ),
        },
      }],
    };
    const order = await orderService.createOrderWithShipments(input);
    orderIds.push(order.id);
    return order;
  }

  describe("saving (spec A5)", () => {
    it("the lowest commission in force is below 30%, so a 30% platform offer can lose (precondition)", async () => {
      expect(await commercialTermsService.lowestCommissionBps()).toBeLessThan(3000);
    });

    it("refuses a 30% platform offer without CONFIRM LOSS, with the form's words (spec A5)", async () => {
      const product = await aProduct(100_000);
      await expect(
        adminPromotionService.create(thirtyPercent([product.id], { budget: 1000 }), {
          scope: "PLATFORM", userId: fixtures.userId,
        }),
      ).rejects.toMatchObject({ message: "Type CONFIRM LOSS exactly.", field: "confirmLoss" });
    });

    it("refuses a confirmed loss with no budget (spec A5)", async () => {
      const product = await aProduct(100_000);
      await expect(
        adminPromotionService.create(thirtyPercent([product.id], { confirmLoss: "CONFIRM LOSS" }), {
          scope: "PLATFORM", userId: fixtures.userId,
        }),
      ).rejects.toMatchObject({ message: "Set a budget for an offer that can lose money.", field: "budget" });
    });

    it("saves with CONFIRM LOSS and ₹1,000, recording the session's admin and never the body's (spec A5)", async () => {
      const product = await aProduct(100_000);
      const { POST } = await import("@/app/api/admin/promotions/route");
      const response = await POST(new NextRequest("http://localhost/api/admin/promotions", {
        method: "POST",
        body: JSON.stringify({
          ...thirtyPercent([product.id], { confirmLoss: "CONFIRM LOSS", budget: 1000 }),
          lossConfirmedByUserId: "someone-else", platformSpentPaise: 99_999_999,
        }),
      }));
      expect(response.status).toBe(201);
      const { id } = (await response.json()) as { id: string };
      const saved = await prisma.promotion.findUniqueOrThrow({ where: { id } });
      expect(saved).toMatchObject({
        platformBudgetPaise: 100_000, platformSpentPaise: 0, lossConfirmedByUserId: fixtures.userId,
      });
      expect(saved.lossConfirmedAt).toBeInstanceOf(Date);
    });

    it("an edit keeps what was spent (spec A5)", async () => {
      const product = await aProduct(100_000);
      const offer = await aBudgetedOffer([product.id], 1000);
      await checkout(product, 1);
      await adminPromotionService.update(
        offer.id,
        thirtyPercent([product.id], { label: offer.label, confirmLoss: "CONFIRM LOSS", budget: 2000 }),
        { scope: "PLATFORM", userId: fixtures.userId },
      );
      expect(await spent(offer.id)).toBe(30_000);
    });
  });

  const tenPercent = (productIds: string[], extra: Record<string, unknown> = {}) =>
    thirtyPercent(productIds, { percent: 10, ...extra });
  const admin = { scope: "PLATFORM" as const, get userId() { return fixtures.userId; } };

  describe("what an order charged is what its expiry gives back (offers-hardening D5)", () => {
    it("a budget added while an unpaid order is in flight: its expiry releases nothing", async () => {
      const product = await aProduct(100_000);
      const offer = await adminPromotionService.create(tenPercent([product.id]), admin);
      const inFlight = await checkout(product, 1, 1000);
      await adminPromotionService.update(offer.id, tenPercent([product.id], { label: offer.label, budget: 1000 }), admin);
      await checkout(product, 1, 1000);
      expect(await spent(offer.id)).toBe(10_000);
      await orderRepository.expireAndRestock(inFlight.id);
      expect(await spent(offer.id)).toBe(10_000);
    });

    it("a budget cleared then set again: each order gives back only its own charge", async () => {
      const product = await aProduct(100_000);
      const offer = await adminPromotionService.create(tenPercent([product.id], { budget: 1000 }), admin);
      const charged = await checkout(product, 1, 1000);
      await adminPromotionService.update(offer.id, tenPercent([product.id], { label: offer.label }), admin);
      const free = await checkout(product, 1, 1000);
      await adminPromotionService.update(offer.id, tenPercent([product.id], { label: offer.label, budget: 1000 }), admin);
      expect(await spent(offer.id)).toBe(10_000);
      await orderRepository.expireAndRestock(free.id);
      expect(await spent(offer.id)).toBe(10_000);
      await orderRepository.expireAndRestock(charged.id);
      expect(await spent(offer.id)).toBe(0);
    });
  });

  describe("editing a confirmed offer (offers-hardening Q14)", () => {
    it("an edit the rule does not flag keeps the confirmation; each confirmation is audited", async () => {
      const product = await aProduct(100_000);
      const offer = await aBudgetedOffer([product.id], 1000);
      const audits = () => prisma.adminLog.count({ where: { resourceId: offer.id, action: "PROMOTION_LOSS_CONFIRMED" } });
      expect(await audits()).toBe(1);
      await adminPromotionService.update(offer.id, tenPercent([product.id], { label: offer.label, budget: 1000 }), admin);
      const kept = await prisma.promotion.findUniqueOrThrow({ where: { id: offer.id } });
      expect(kept.lossConfirmedByUserId).toBe(fixtures.userId);
      expect(kept.lossConfirmedAt).toEqual(offer.lossConfirmedAt);
      expect(await audits()).toBe(1);
      await adminPromotionService.update(
        offer.id, thirtyPercent([product.id], { label: offer.label, confirmLoss: "CONFIRM LOSS", budget: 1000 }), admin,
      );
      expect(await audits()).toBe(2);
    });

    it("a budget edit that races a spend is refused on the field, not as a fault", async () => {
      const product = await aProduct(100_000);
      const offer = await aBudgetedOffer([product.id], 1000);
      await checkout(product, 1);
      // The service read the spend before the order committed.
      const stale = vi.spyOn(promotionRepository, "findScoped").mockResolvedValueOnce({ id: offer.id, platformSpentPaise: 0 });
      await expect(
        adminPromotionService.update(
          offer.id, thirtyPercent([product.id], { label: offer.label, confirmLoss: "CONFIRM LOSS", budget: 100 }), admin,
        ),
      ).rejects.toMatchObject({ message: "This offer has already spent ₹300. Set a budget of at least that.", field: "budget" });
      stale.mockRestore();
    });

    it("the lowest rate counts only shops that can sell (offers-hardening Q2)", async () => {
      const before = await commercialTermsService.lowestCommissionBps();
      const code = `${PREFIX.toUpperCase()}${Date.now()}`;
      await prisma.org.create({ data: { code, handle: code.toLowerCase(), name: "Withdrawn", email: `${code.toLowerCase()}@example.invalid`, commissionBps: 100, isActive: false } });
      expect(await commercialTermsService.lowestCommissionBps()).toBe(before);
    });
  });

  describe("spending (spec A5)", () => {
    it("an offer that cannot afford the basket is left out of both the review and the order (offers-hardening Q4)", async () => {
      const product = await aProduct(100_000); // 30% = ₹300
      const offer = await aBudgetedOffer([product.id], 1000);
      await prisma.promotion.update({ where: { id: offer.id }, data: { platformSpentPaise: 95_000 } }); // ₹50 left
      const line = {
        key: `${product.id}::`, productId: product.id, orgId: product.orgId,
        categoryId: product.categoryId, unitPrice: product.price, quantity: 1,
      };
      const preview = await promotionService.quote([line]);
      expect(preview.attributions.some((a) => a.promotionId === offer.id)).toBe(false);
      expect(preview.totalDiscountPaise).toBe(0);
      await checkout(product, 1, 0);
      expect(await spent(offer.id)).toBe(95_000);
    });

    it("orders spend into the budget; the one that would pass it is refused and spends nothing; expiry gives back; a spent offer leaves the product page (spec A5)", async () => {
      const big = await aProduct(100_000); // 30% = ₹300
      const small = await aProduct(33_334); // 30% = ₹100
      const offer = await aBudgetedOffer([big.id, small.id], 1000);

      const first = await checkout(big, 3);
      expect(await spent(offer.id)).toBe(90_000);

      // ₹100 left cannot cover ₹300: the offer is out of the quote, so a total that still counts
      // it is stale and refused by the usual guard (ADR-0018), with nothing spent (Q4).
      const ordersBefore = await prisma.order.count({ where: { items: { some: { productId: big.id } } } });
      await expect(checkout(big, 1)).rejects.toMatchObject({ status: 409 });
      expect(await spent(offer.id)).toBe(90_000);
      expect(await prisma.order.count({ where: { items: { some: { productId: big.id } } } })).toBe(ordersBefore);

      expect(await orderRepository.expireAndRestock(first.id)).toBe(true);
      expect(await spent(offer.id)).toBe(0);

      await checkout(big, 3);
      // Still ₹100 left: the offer prices the page.
      expect(priceContext.resolveProductPrice(big, await priceContext.loadPriceContext()).offerPricePaise).toBe(70_000);
      await checkout(small, 1);
      expect(await spent(offer.id)).toBe(100_000);

      const shown = priceContext.resolveProductPrice(big, await priceContext.loadPriceContext());
      expect(shown.offerPricePaise).toBe(100_000);
      expect(shown.offerLabel).toBeNull();
    });

    it("two orders racing for the last of a budget: only one fits (spec A5)", async () => {
      for (let round = 0; round < 4; round++) {
        const product = await aProduct(100_000);
        const offer = await aBudgetedOffer([product.id], 300); // exactly one unit's ₹300
        const results = await Promise.allSettled([checkout(product, 1), checkout(product, 1)]);
        const won = results.filter((r) => r.status === "fulfilled");
        const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
        expect(won.length, `round ${round}: the budget was spent ${won.length} times`).toBe(1);
        expect(lost[0].reason.message).toBe(ENDED);
        expect(await spent(offer.id)).toBe(30_000);
      }
    }, 60_000);
  });
});
