/**
 * A once-per-customer code holds when one buyer checks out twice at once (offers-hardening R2, D3).
 *
 * The bug this exists for: the buyer's past redemptions were counted before any lock, so two
 * overlapping checkouts both counted zero and both spent a code meant for one use. A sequential
 * version passes without the lock — the two orders must overlap. Owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { CreateOrderWithShipmentsInput } from "@server/checkout/order.types";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { billableWeightKg } from "@server/shipping/billable-weight";
import { signRateQuote } from "@server/shipping/rate-quote.service";

const PREFIX = "per-user-race-";
const PRICE = 10_000;
const AMOUNT_OFF = 1_000;
const SHIPPING = 5_000;
const WEIGHT_KG = 0.5;
const ROUNDS = 4;

describe.skipIf(!isDisposableDb)("a once-per-customer code under simultaneous checkouts", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orderService: typeof import("@server/checkout/order.service").orderService;
  const orderIds: string[] = [];
  const promotionIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orderService } = await import("@server/checkout/order.service"));
  });

  afterAll(async () => {
    const inOrders = { orderId: { in: orderIds } };
    await prisma.shipmentItem.deleteMany({ where: { shipment: inOrders } });
    await prisma.shipment.deleteMany({ where: inOrders });
    await prisma.orderDiscount.deleteMany({ where: inOrders });
    await prisma.orderItem.deleteMany({ where: inOrders });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.promotion.deleteMany({ where: { id: { in: promotionIds } } });
    await prisma.productStock.deleteMany({ where: { product: { name: { startsWith: PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: PREFIX } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  async function aBuyer() {
    const user = await prisma.user.create({
      data: { name: "Race Buyer", email: `${unique()}@example.invalid` },
      select: { id: true },
    });
    userIds.push(user.id);
    return user.id;
  }

  async function aCode() {
    const code = unique().toUpperCase();
    const now = Date.now();
    const promotion = await prisma.promotion.create({
      data: {
        label: "Once per customer", scope: "PLATFORM", trigger: "CODE", code,
        valueType: "AMOUNT_OFF", amountOffPaise: AMOUNT_OFF, perUserLimit: 1,
        startsAt: new Date(now - 60_000), endsAt: new Date(now + 3_600_000),
      },
      select: { id: true },
    });
    promotionIds.push(promotion.id);
    return code;
  }

  async function aBasket() {
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
    const items = [{ productId: product.id, quantity: 1 }];
    const group = {
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
          { fromPincode: location.address.pincode, toPincode: "400001", billableWeightKg: billableWeightKg(WEIGHT_KG) },
        ),
      },
    };
    return { group };
  }

  async function checkout(basket: Awaited<ReturnType<typeof aBasket>>, code: string, userId: string) {
    const input: CreateOrderWithShipmentsInput = {
      userId,
      couponCode: code,
      address: {
        id: "race-address", fullName: "Race Buyer", mobile: "9000000032",
        email: "race@example.invalid", addressLine1: "1 Race Lane", city: "Mumbai",
        state: "Maharashtra", pincode: "400001", country: "India",
      },
      // What the review page showed: no other offer reaches the fixture category.
      displayedGrandTotal: PRICE + SHIPPING - AMOUNT_OFF,
      shippingGroups: [structuredClone(basket.group)],
    };
    const order = await orderService.createOrderWithShipments(input);
    orderIds.push(order.id);
    return order;
  }

  it("two checkouts by one buyer: one succeeds, the other is refused (spec A3)", async () => {
    for (let round = 0; round < ROUNDS; round++) {
      const [code, userId, basket] = await Promise.all([aCode(), aBuyer(), aBasket()]);

      const results = await Promise.allSettled([
        checkout(basket, code, userId),
        checkout(basket, code, userId),
      ]);

      const won = results.filter((r) => r.status === "fulfilled");
      const lost = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(won.length, `round ${round}: the code was spent ${won.length} times`).toBe(1);
      expect(lost[0].reason.message).toBe(`You have already used ${code}.`);
      const redemptions = await prisma.orderDiscount.count({ where: { promotion: { code }, order: { userId } } });
      expect(redemptions).toBe(1);
    }
  }, 60_000);

  it("another buyer can still use the code (spec A3)", async () => {
    const [code, first, second, basket] = await Promise.all([aCode(), aBuyer(), aBuyer(), aBasket()]);
    await checkout(basket, code, first);
    const order = await checkout(basket, code, second);
    expect(await prisma.orderDiscount.count({ where: { orderId: order.id, promotion: { code } } })).toBe(1);
  });
});
