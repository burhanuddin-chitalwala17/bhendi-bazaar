/**
 * The preview equals the charge, a beaten coupon steps aside, and the database refuses an
 * impossible discount (offers-hardening R6–R8, D8–D10). Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import type { CreateOrderWithShipmentsInput } from "@server/checkout/order.types";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { billableWeightKg } from "@server/shipping/billable-weight";
import { signRateQuote } from "@server/shipping/rate-quote.service";

vi.mock("next-auth", () => ({ getServerSession: async () => null }));
vi.mock("@/lib/auth-config", () => ({ authOptions: {} }));

const PREFIX = "offers-u3-";
const PRICE = 100_000; // ₹1,000
const SHIPPING = 5_000;
const WEIGHT_KG = 0.5;

describe.skipIf(!isDisposableDb)("offers: preview, beaten coupon, database checks", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orderService: typeof import("@server/checkout/order.service").orderService;
  let quoteRoute: typeof import("@/app/api/checkout/promotions/quote/route");
  const orderIds: string[] = [];
  const promotionIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orderService } = await import("@server/checkout/order.service"));
    quoteRoute = await import("@/app/api/checkout/promotions/quote/route");
  });

  afterAll(async () => {
    const inOrders = { orderId: { in: orderIds } };
    await prisma.shipmentItem.deleteMany({ where: { shipment: inOrders } });
    await prisma.shipment.deleteMany({ where: inOrders });
    await prisma.orderDiscount.deleteMany({ where: inOrders });
    await prisma.orderItem.deleteMany({ where: inOrders });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.promotionTarget.deleteMany({ where: { promotionId: { in: promotionIds } } });
    // Raw inserts are ids with the prefix: if a check is missing, the "refused" row exists.
    await prisma.promotion.deleteMany({ where: { OR: [{ id: { in: promotionIds } }, { id: { startsWith: PREFIX } }] } });
    await prisma.productStock.deleteMany({ where: { product: { name: { startsWith: PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const window = () => ({ startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000) });

  async function aProduct() {
    const fixtures = await ensureFixtures();
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { orgId: true, org: { select: { name: true } }, address: { select: { pincode: true, city: true, state: true } } },
    });
    const name = unique();
    const product = await prisma.product.create({
      data: {
        name, slug: name, description: "fixture", price: PRICE, weight: WEIGHT_KG,
        thumbnail: "https://example.invalid/x.webp", categoryId: fixtures.categoryId, orgId: location.orgId,
        stockLocations: { create: { orgAddressId: fixtures.orgAddressId, quantity: 100 } },
      },
      select: { id: true },
    });
    return { productId: product.id, fixtures, location };
  }

  /** A platform offer aimed at this one product, so no seeded offer competes with it. */
  async function anOffer(productId: string, data: Record<string, unknown>) {
    const promotion = await prisma.promotion.create({
      data: {
        label: "U3 offer", scope: "PLATFORM", ...window(),
        targets: { create: [{ productId }] },
        ...data,
      } as Parameters<typeof prisma.promotion.create>[0]["data"],
      select: { id: true },
    });
    promotionIds.push(promotion.id);
    return promotion.id;
  }

  async function checkout(
    basket: Awaited<ReturnType<typeof aProduct>>,
    items: Array<{ productId: string; quantity: number }>,
    displayedGrandTotal: number,
    extra: Partial<CreateOrderWithShipmentsInput> = {},
  ) {
    const { fixtures, location } = basket;
    const units = items.reduce((sum, i) => sum + i.quantity, 0);
    const input: CreateOrderWithShipmentsInput = {
      address: {
        id: "u3-address", fullName: "U3 Buyer", mobile: "9000000033",
        email: "u3@example.invalid", addressLine1: "1 Offer Lane", city: "Mumbai",
        state: "Maharashtra", pincode: "400001", country: "India",
      },
      displayedGrandTotal,
      shippingGroups: [{
        groupId: fixtures.orgAddressId,
        orgId: location.orgId,
        orgName: location.org.name,
        fromPincode: location.address.pincode,
        fromCity: location.address.city,
        fromState: location.address.state,
        items,
        selectedRate: {
          quote: signRateQuote(
            { providerId: fixtures.shippingProviderId, providerName: "Fixture Carrier", courierName: "Test Courier",
              rate: SHIPPING, estimatedDays: 3, mode: "surface" },
            { fromPincode: location.address.pincode, toPincode: "400001", billableWeightKg: billableWeightKg(WEIGHT_KG * units) },
          ),
        },
      }],
      ...extra,
    };
    const order = await orderService.createOrderWithShipments(input);
    orderIds.push(order.id);
    return order;
  }

  async function chargedDiscount(orderId: string) {
    const items = await prisma.orderItem.findMany({ where: { orderId }, select: { discountPaise: true } });
    return items.reduce((sum, i) => sum + i.discountPaise, 0);
  }

  it("the same item as two lines: the preview's discount equals the charged one (spec A7)", async () => {
    const basket = await aProduct();
    await anOffer(basket.productId, { trigger: "AUTOMATIC", valueType: "PERCENT", percentBps: 1000 });
    const items = [
      { productId: basket.productId, quantity: 1 },
      { productId: basket.productId, quantity: 5 },
    ];

    const response = await quoteRoute.POST(
      new NextRequest("http://localhost/api/checkout/promotions/quote", {
        method: "POST",
        body: JSON.stringify({ items }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(200);
    const preview = (await response.json()) as { totalDiscountPaise: number };

    const order = await checkout(basket, items, PRICE * 6 + SHIPPING - 60_000);
    expect(preview.totalDiscountPaise).toBe(60_000);
    expect(await chargedDiscount(order.id)).toBe(preview.totalDiscountPaise);
  });

  it("a coupon overtaken by a better automatic offer is set aside, unclaimed (spec A8)", async () => {
    const basket = await aProduct();
    const code = unique().toUpperCase();
    const couponId = await anOffer(basket.productId, {
      trigger: "CODE", code, valueType: "PERCENT", percentBps: 500, usageLimit: 10,
    });
    // Goes live after the buyer applied the code, before they pay.
    await anOffer(basket.productId, { trigger: "AUTOMATIC", valueType: "PERCENT", percentBps: 2000 });
    const user = await prisma.user.create({
      data: { name: "U3 Buyer", email: `${unique()}@example.invalid` }, select: { id: true },
    });
    userIds.push(user.id);

    // The re-quoted review shows the better price; the browser still carries the code.
    const order = await checkout(basket, [{ productId: basket.productId, quantity: 1 }], PRICE + SHIPPING - 20_000, {
      couponCode: code, userId: user.id,
    });

    expect(await chargedDiscount(order.id)).toBe(20_000);
    const coupon = await prisma.promotion.findUniqueOrThrow({ where: { id: couponId }, select: { usageCount: true } });
    expect(coupon.usageCount).toBe(0);
    expect(await prisma.orderDiscount.count({ where: { orderId: order.id, promotionId: couponId } })).toBe(0);
  });

  describe("the database refuses an impossible offer or line (spec A9)", () => {
    let couponId: string;
    let orderItemId: string;

    beforeAll(async () => {
      const basket = await aProduct();
      couponId = await anOffer(basket.productId, {
        trigger: "CODE", code: unique().toUpperCase(), valueType: "AMOUNT_OFF", amountOffPaise: 1_000,
      });
      const order = await checkout(basket, [{ productId: basket.productId, quantity: 2 }], PRICE * 2 + SHIPPING);
      orderItemId = (await prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id }, select: { id: true } })).id;
    });

    it("a 150% offer (spec A9)", async () => {
      await expect(prisma.$executeRawUnsafe(
        `INSERT INTO "Promotion" (id, label, scope, trigger, "valueType", "percentBps", "startsAt", "endsAt", "updatedAt")
         VALUES ($1, 'bad', 'PLATFORM', 'AUTOMATIC', 'PERCENT', 15000, now(), now() + interval '1 day', now())`,
        `${unique()}-pct`,
      )).rejects.toThrow(/Promotion_value_matches_type/);
    });

    it("a zero sale price (spec A9)", async () => {
      await expect(prisma.$executeRawUnsafe(
        `INSERT INTO "Promotion" (id, label, scope, trigger, "valueType", "fixedPricePaise", "startsAt", "endsAt", "updatedAt")
         VALUES ($1, 'bad', 'PLATFORM', 'AUTOMATIC', 'FIXED_PRICE', 0, now(), now() + interval '1 day', now())`,
        `${unique()}-fixed`,
      )).rejects.toThrow(/Promotion_fixed_price_positive/);
    });

    it.each([
      ['"usageCount" = -1', "Promotion_usage_sane"],
      ['"usageLimit" = 0', "Promotion_usage_sane"],
      ['"perUserLimit" = 0', "Promotion_usage_sane"],
      ['"maxDiscountPaise" = 0', "Promotion_cap_positive"],
      ['"minSubtotalPaise" = -1', "Promotion_min_subtotal_non_negative"],
    ])("an offer with %s (spec A9)", async (assignment, constraint) => {
      await expect(prisma.$executeRawUnsafe(`UPDATE "Promotion" SET ${assignment} WHERE id = $1`, couponId))
        .rejects.toThrow(new RegExp(constraint));
    });

    it("a line discount above the line's value (spec A9)", async () => {
      await expect(prisma.$executeRawUnsafe(
        `UPDATE "OrderItem" SET "discountPaise" = "unitPrice" * quantity + 1 WHERE id = $1`, orderItemId,
      )).rejects.toThrow(/OrderItem_discount_within_line/);
    });

    it("an org share above the line's discount (spec A9)", async () => {
      await expect(prisma.$executeRawUnsafe(
        `UPDATE "OrderItem" SET "orgFundedPaise" = "discountPaise" + 1 WHERE id = $1`, orderItemId,
      )).rejects.toThrow(/OrderItem_discount_split_sane/);
    });
  });
});
