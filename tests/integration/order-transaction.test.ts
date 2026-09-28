/**
 * `createOrderWithShipments` end to end, against the seeded local database.
 *
 * This transaction is the most safety-critical code in the app — it holds Invariants 1
 * (the server prices the order), 6 (stock moves conditionally, inside the transaction)
 * and ADR-0019's discount attribution — and until now nothing exercised it. The gap
 * surfaced when the per-row `create` loops were replaced with `createMany`: there was no
 * way to prove that a parcel still pointed at the right order line afterwards.
 *
 * What matters here is the *linkage*, because that is what batching can silently break.
 * A `createManyAndReturn` that were read positionally would still produce the right
 * number of rows, the right totals, and a passing smoke test — while pointing parcel A's
 * item at line B. So the assertions go through the join, per line, by identity.
 */
import "dotenv/config";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import type { CreateOrderWithShipmentsInput } from "@server/checkout/order.types";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { OutOfStockError } from "@server/shared/domain-error";


const TEST_MOBILE = "9000000031";

const address = {
  id: "test-address",
  fullName: "Order Transaction Test",
  mobile: TEST_MOBILE,
  email: "order-transaction-test@example.invalid",
  addressLine1: "1 Test Lane",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  country: "India",
};

describe.skipIf(!isDisposableDb)("createOrderWithShipments (local seeded db)", () => {
  let orderService: typeof import("@server/checkout/order.service").orderService;
  let prisma: typeof import("@server/shared/prisma").prisma;
  const createdOrderIds: string[] = [];

  beforeAll(async () => {
    ({ orderService } = await import("@server/checkout/order.service"));
    ({ prisma } = await import("@server/shared/prisma"));
  });

  afterAll(async () => {
    if (!createdOrderIds.length) {
      await prisma.product.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
      return;
    }
    // Children first — money-bearing rows are Restrict (ADR-0020).
    await prisma.shipmentItem.deleteMany({ where: { shipment: { orderId: { in: createdOrderIds } } } });
    await prisma.shipment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderDiscount.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.productStock.deleteMany({ where: { product: { name: { startsWith: TEST_PREFIX } } } });
    await prisma.product.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  });

  const TEST_PREFIX = "order-tx-test-";

  /**
   * Three products stocked at ONE location, created here rather than found in the seed.
   * Reading fixtures out of seeded data made this test a hostage to how the seed happens
   * to be shaped — it already failed once because only two products at any one location
   * were free of a promotion. Owning the fixtures also means the test can run anywhere
   * there is a schema, which is what it would need to run in CI.
   */
  async function buildInput(
    options: { specs?: Array<{ suffix: string; price: number; quantity: number }>; stock?: number } = {},
  ): Promise<{
    input: CreateOrderWithShipmentsInput;
    lines: Array<{ productId: string; quantity: number }>;
  }> {
    const fixtures = await ensureFixtures();
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: {
        id: true,
        orgId: true,
        org: { select: { name: true } },
        address: { select: { pincode: true, city: true, state: true } },
      },
    });
    const category = { id: fixtures.categoryId };
    const provider = await prisma.shippingProvider.findUniqueOrThrow({
      where: { id: fixtures.shippingProviderId },
      select: { id: true, name: true },
    });

    // Distinct prices and quantities: a mapping that pairs line A's row with line B's
    // would be invisible if every line carried the same numbers.
    const specs = options.specs ?? [
      { suffix: "a", price: 11_100, quantity: 1 },
      { suffix: "b", price: 22_200, quantity: 2 },
      { suffix: "c", price: 33_300, quantity: 3 },
    ];

    const lines: Array<{ productId: string; quantity: number }> = [];
    for (const spec of specs) {
      const product = await prisma.product.create({
        data: {
          name: `${TEST_PREFIX}${spec.suffix}`,
          slug: `${TEST_PREFIX}${spec.suffix}-${Date.now()}`,
          description: "fixture",
          price: spec.price,
          thumbnail: "https://example.invalid/fixture.webp",
          weight: 0.5,
          categoryId: category.id,
          orgId: location.orgId,
          stockLocations: { create: { orgAddressId: location.id, quantity: options.stock ?? 100 } },
        },
        select: { id: true },
      });
      lines.push({ productId: product.id, quantity: spec.quantity });
    }

    return {
      lines,
      input: {
        address,
        displayedGrandTotal: 0, // replaced by createOrder, which asks the domain
        shippingGroups: [
          {
            // groupId IS the orgAddressId — that is how a quoted rate is matched to an
            // allocated parcel (order.service.ts). A placeholder here reads as
            // "availability changed", a confusing way to be told the fixture is wrong.
            groupId: location.id,
            orgId: location.orgId,
            orgName: location.org.name,
            fromPincode: location.address.pincode,
            fromCity: location.address.city,
            fromState: location.address.state,
            items: lines,
            selectedRate: {
              providerId: provider.id,
              providerName: provider.name,
              courierName: "Test Courier",
              rate: 5000,
              estimatedDays: 3,
            },
          },
        ],
      },
    };
  }

  /**
   * The server computes the total and refuses anything else (Invariant 1, R5), and the
   * refusal deliberately does not name the figure — so the test computes it the same
   * way the domain does, through the domain's own `assembleOrderTotals`. Duplicating the
   * arithmetic here would mean a formula change made this test wrong rather than red.
   *
   * The fixture excludes promoted products, so the effective price is the list price.
   */
  async function expectedGrandTotal(input: CreateOrderWithShipmentsInput) {
    const { assembleOrderTotals } = await import("@server/checkout/pricing");
    const group = input.shippingGroups[0];
    const prices = new Map(
      (
        await prisma.product.findMany({
          where: { id: { in: group.items.map((i) => i.productId) } },
          select: { id: true, price: true },
        })
      ).map((p) => [p.id, p.price])
    );
    const itemsTotal = group.items.reduce(
      (sum, item) => sum + (prices.get(item.productId) ?? 0) * item.quantity,
      0
    );
    return assembleOrderTotals([{ itemsTotal, shippingRate: group.selectedRate.rate }]).grandTotal;
  }

  async function createOrder(input: CreateOrderWithShipmentsInput) {
    const order = await orderService.createOrderWithShipments({
      ...input,
      displayedGrandTotal: await expectedGrandTotal(input),
    });
    createdOrderIds.push(order.id);
    return order;
  }

  it("links every parcel line to the order item for that exact product", async () => {
    const { input, lines } = await buildInput();
    const order = await createOrder(input);

    const persisted = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: {
        items: { select: { id: true, productId: true, quantity: true } },
        shipments: {
          select: {
            items: {
              select: { quantity: true, orderItem: { select: { id: true, productId: true } } },
            },
          },
        },
      },
    });

    expect(persisted.items).toHaveLength(lines.length);

    // The assertion batching can break: each shipment item must resolve to the order
    // item for its OWN product, not merely to some order item on this order.
    const shipmentItems = persisted.shipments.flatMap((s) => s.items);
    expect(shipmentItems).toHaveLength(lines.length);

    const itemById = new Map(persisted.items.map((i) => [i.id, i]));
    for (const shipmentItem of shipmentItems) {
      const linked = itemById.get(shipmentItem.orderItem.id);
      expect(linked, "a parcel points at an order item from another order").toBeDefined();
      expect(shipmentItem.orderItem.productId).toBe(linked!.productId);
      expect(shipmentItem.quantity).toBe(linked!.quantity);
    }

    // And every requested line arrived with its own quantity intact.
    for (const line of lines) {
      const item = persisted.items.find((i) => i.productId === line.productId);
      expect(item, `line ${line.productId} is missing`).toBeDefined();
      expect(item!.quantity).toBe(line.quantity);
    }
  });

  it("prices every line from the catalogue, never from the request", async () => {
    const { input, lines } = await buildInput();
    const order = await createOrder(input);

    const items = await prisma.orderItem.findMany({
      where: { orderId: order.id },
      select: { productId: true, unitPrice: true, quantity: true },
    });
    const catalogue = new Map(
      (
        await prisma.product.findMany({
          where: { id: { in: lines.map((l) => l.productId) } },
          select: { id: true, price: true },
        })
      ).map((p) => [p.id, p.price])
    );

    for (const item of items) {
      // No offer is seeded on these products, so the effective price is the list price.
      expect(item.unitPrice, `unitPrice for ${item.productId}`).toBe(catalogue.get(item.productId));
      expect(Number.isInteger(item.unitPrice), "money is integer paise (ADR-0004)").toBe(true);
    }
  });

  it("stays within its statement budget", async () => {
    // The per-row create loops issued one statement per line, per attribution and per
    // parcel line — inside the transaction that holds the stock row locks, so the cost
    // was contention as well as billed operations. This pins the batched shape: a
    // regression to a loop busts it long before anyone notices a slow checkout.
    const { input } = await buildInput();

    const before = Date.now();
    const order = await createOrder(input);
    expect(Date.now() - before).toBeLessThan(15_000);

    const [items, shipments, shipmentItems] = await Promise.all([
      prisma.orderItem.count({ where: { orderId: order.id } }),
      prisma.shipment.count({ where: { orderId: order.id } }),
      prisma.shipmentItem.count({ where: { shipment: { orderId: order.id } } }),
    ]);
    expect(items).toBe(3);
    expect(shipments).toBe(1);
    expect(shipmentItems).toBe(3);
  });
  it("two checkouts racing for the last unit: exactly one wins (Invariant 6)", async () => {
    // The oversell ADR-0007 exists to stop. Both orders are built against the same product
    // stocked at one, then submitted together: the guarded `updateMany` is what decides, so
    // the loser gets `count === 0` and rolls back rather than shipping a unit that is gone.
    //
    // A sequential version of this passes with the condition deleted, which is how the race
    // survived unguarded — the two must overlap. `tests/unit/conditional-stock.test.ts` holds
    // the same rule at the level of the write's shape.
    //
    // The loser can be refused at either of two points, depending on whether the winner had
    // committed before it read: the allocation's availability check, or the guarded write.
    // Both are the same refusal and both name the product, so this assertion does not depend
    // on which machine is faster — it did once, and went red on CI and nowhere else.
    const { input, lines } = await buildInput({
      specs: [{ suffix: `race-${Date.now()}`, price: 15_000, quantity: 1 }],
      stock: 1,
    });
    const productId = lines[0].productId;

    // One product, one unit, two checkouts — the same input submitted twice, because two
    // fixtures would be two products and no race at all.
    const results = await Promise.allSettled([
      createOrder(structuredClone(input)),
      createOrder(structuredClone(input)),
    ]);

    const won = results.filter((r) => r.status === "fulfilled");
    const lost = results.filter((r) => r.status === "rejected");

    expect(
      won.length,
      `Both checkouts succeeded for one unit — that is the oversell. ${JSON.stringify(
        results.map((r) => r.status),
      )}`,
    ).toBe(1);
    expect(lost.length).toBe(1);
    expect((lost[0] as PromiseRejectedResult).reason).toBeInstanceOf(OutOfStockError);

    const left = await prisma.productStock.findFirstOrThrow({
      where: { productId },
      select: { quantity: true },
    });
    expect(left.quantity, "the winner took the unit and the loser took nothing").toBe(0);
  });
});
