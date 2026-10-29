/**
 * The platform funds a discount on the product's lowest list price in the last 30 days
 * (offers-hardening R5, D7, own-store Q21). The history is written by a trigger, so it holds
 * for every writer of `Product.price`. Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { CreateOrderWithShipmentsInput } from "@server/checkout/order.types";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { billableWeightKg } from "@server/shipping/billable-weight";
import { signRateQuote } from "@server/shipping/rate-quote.service";
import { FUNDING_BASIS_DAYS } from "@server/promotions/promotion.types";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));

const PREFIX = "offers-u6-";
const SHIPPING = 5_000;
const WEIGHT_KG = 0.5;
const windowStart = () => new Date(Date.now() - FUNDING_BASIS_DAYS * 24 * 60 * 60 * 1000);

describe.skipIf(!isDisposableDb)("offers: the platform funds on the 30-day lowest price", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orderService: typeof import("@server/checkout/order.service").orderService;
  let productService: typeof import("@server/catalog/product.service").productService;
  let adminPromotionService: typeof import("@server/promotions/admin.promotion.service").adminPromotionService;
  let promotionService: typeof import("@server/promotions/promotion.service").promotionService;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;
  const orderIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orderService } = await import("@server/checkout/order.service"));
    ({ productService } = await import("@server/catalog/product.service"));
    ({ adminPromotionService } = await import("@server/promotions/admin.promotion.service"));
    ({ promotionService } = await import("@server/promotions/promotion.service"));
    fixtures = await ensureFixtures();
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
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  async function aProduct(price: number) {
    const name = unique();
    return await prisma.product.create({
      data: {
        name, slug: name, description: "fixture", price, weight: WEIGHT_KG,
        thumbnail: "https://example.invalid/x.webp", categoryId: fixtures.categoryId, orgId: fixtures.orgId,
        stockLocations: { create: { orgAddressId: fixtures.orgAddressId, quantity: 100 } },
      },
      select: { id: true, price: true },
    });
  }

  const history = (productId: string) =>
    prisma.productPriceHistory.findMany({ where: { productId }, orderBy: { id: "asc" } });

  /** Moves every history row of this product back by `days`, as if it had been priced then. */
  const age = (productId: string, days: number) =>
    prisma.$executeRaw`UPDATE "ProductPriceHistory" SET "recordedAt" = "recordedAt" - make_interval(days => ${days}) WHERE "productId" = ${productId}`;

  const reprice = (id: string, price: number) => prisma.product.update({ where: { id }, data: { price } });

  describe("the trigger (offers-hardening D7)", () => {
    it("writes a row on insert and on a price change, and none on any other edit", async () => {
      const product = await aProduct(100_000);
      expect((await history(product.id)).map((h) => h.pricePaise)).toEqual([100_000]);
      await prisma.product.update({ where: { id: product.id }, data: { description: "edited" } });
      await reprice(product.id, 100_000);
      expect(await history(product.id)).toHaveLength(1);
      await reprice(product.id, 150_000);
      expect((await history(product.id)).map((h) => h.pricePaise)).toEqual([100_000, 150_000]);
    });
  });

  describe("lowestListPrices (offers-hardening D7)", () => {
    it("counts the price in force when the window opened, not only prices set inside it", async () => {
      const product = await aProduct(100_000);
      await age(product.id, FUNDING_BASIS_DAYS + 10); // ₹1,000 since before the window — in force when the window opened
      await reprice(product.id, 150_000);
      expect((await productService.lowestListPrices([product.id], windowStart())).get(product.id)).toBe(100_000);
    });

    it("forgets a price replaced before the window opened", async () => {
      const product = await aProduct(80_000);
      await reprice(product.id, 100_000);
      await age(product.id, FUNDING_BASIS_DAYS + 10); // ₹800 then ₹1,000, both before the window
      await reprice(product.id, 150_000);
      expect((await productService.lowestListPrices([product.id], windowStart())).get(product.id)).toBe(100_000);
    });

    it("a dip inside the window counts, and today's price bounds it; many products in one read", async () => {
      const dipped = await aProduct(100_000);
      await reprice(dipped.id, 90_000);
      await reprice(dipped.id, 120_000);
      const cut = await aProduct(100_000);
      await reprice(cut.id, 70_000);
      const lowest = await productService.lowestListPrices([dipped.id, cut.id], windowStart());
      expect(lowest.get(dipped.id)).toBe(90_000);
      expect(lowest.get(cut.id)).toBe(70_000);
    });
  });

  /** A 20% platform offer on this product, saved as the admin form saves it. */
  const platform20 = (productId: string) =>
    adminPromotionService.create(
      {
        label: unique(), trigger: "AUTOMATIC", valueType: "PERCENT", percent: 20,
        startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000),
        isActive: true, categoryIds: [], productIds: [productId], confirmLoss: "CONFIRM LOSS", budget: 1000,
      },
      { scope: "PLATFORM", userId: fixtures.userId },
    );

  /** ₹1,000 for the whole window, then ₹1,500. */
  async function aRaisedProduct() {
    const product = await aProduct(100_000);
    await age(product.id, FUNDING_BASIS_DAYS + 1);
    await reprice(product.id, 150_000);
    return product;
  }

  async function checkout(productId: string, displayedItemsTotal: number) {
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { org: { select: { name: true } }, address: { select: { pincode: true, city: true, state: true } } },
    });
    const input: CreateOrderWithShipmentsInput = {
      address: {
        id: "u6-address", fullName: "U6 Buyer", mobile: "9000000066", email: "u6@example.invalid",
        addressLine1: "1 Basis Lane", city: "Mumbai", state: "Maharashtra", pincode: "400001", country: "India",
      },
      displayedGrandTotal: displayedItemsTotal + SHIPPING,
      shippingGroups: [{
        groupId: fixtures.orgAddressId, orgId: fixtures.orgId, orgName: location.org.name,
        fromPincode: location.address.pincode, fromCity: location.address.city, fromState: location.address.state,
        items: [{ productId, quantity: 1 }],
        selectedRate: {
          quote: signRateQuote(
            { providerId: fixtures.shippingProviderId, providerName: "Fixture Carrier", courierName: "Test Courier",
              rate: SHIPPING, estimatedDays: 3, mode: "surface" },
            { fromPincode: location.address.pincode, toPincode: "400001", billableWeightKg: billableWeightKg(WEIGHT_KG) },
          ),
        },
      }],
    };
    const order = await orderService.createOrderWithShipments(input);
    orderIds.push(order.id);
    return order;
  }

  it("₹1,000 for 30 days, raised to ₹1,500, 20% platform offer: buyer pays ₹1,200, platform ₹200, shop ₹100 (spec A6)", async () => {
    const product = await aRaisedProduct();
    const offer = await platform20(product.id);
    const order = await checkout(product.id, 120_000);

    const saved = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { grandTotal: true, items: { select: { orgFundedPaise: true, discountPaise: true } } },
    });
    expect(saved.grandTotal).toBe(120_000 + SHIPPING);
    expect(saved.items).toEqual([{ orgFundedPaise: 10_000, discountPaise: 30_000 }]);
    const split = await prisma.orderDiscount.findMany({
      where: { orderId: order.id },
      select: { promotionId: true, buyerDiscountPaise: true, platformFundedPaise: true, orgFundedPaise: true, budgetChargedPaise: true },
    });
    expect(split).toEqual([
      { promotionId: offer.id, buyerDiscountPaise: 30_000, platformFundedPaise: 20_000, orgFundedPaise: 10_000, budgetChargedPaise: 20_000 },
    ]);
  });

  it("whether an offer fits its budget is decided on the shown price, as the review decides it (spec A6, ADR-0018)", async () => {
    const product = await aRaisedProduct();
    const offer = await platform20(product.id);
    // ₹250 left: the basis share (₹200) would fit, the shown-price share (₹300) does not.
    await prisma.promotion.update({ where: { id: offer.id }, data: { platformSpentPaise: 75_000 } });
    const preview = await promotionService.quote([{
      key: `${product.id}::`, productId: product.id, orgId: fixtures.orgId,
      categoryId: fixtures.categoryId, unitPrice: 150_000, quantity: 1,
    }]);
    expect(preview.totalDiscountPaise).toBe(0);
    const order = await checkout(product.id, 150_000);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).grandTotal).toBe(150_000 + SHIPPING);
    expect((await prisma.promotion.findUniqueOrThrow({ where: { id: offer.id } })).platformSpentPaise).toBe(75_000);
  });
});
