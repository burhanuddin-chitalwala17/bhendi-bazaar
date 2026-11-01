/**
 * checkout-abandonment R4/R5: an abandoned checkout is kept in full and shown to
 * nobody — not the admin console, not the org panel, not the buyer's own order list,
 * and not the figures that report what the store sold.
 *
 * Asserted on the `where` each query builds rather than through a database, because
 * the defect being guarded against is a query that simply forgets the predicate.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn().mockResolvedValue([]);
const findFirst = vi.fn().mockResolvedValue(null);
const count = vi.fn().mockResolvedValue(0);
const aggregate = vi.fn().mockResolvedValue({ _sum: { grandTotal: 0 }, _count: 0 });
const groupBy = vi.fn().mockResolvedValue([]);
const updateMany = vi.fn().mockResolvedValue({ count: 0 });

vi.mock("@server/shared/prisma", () => ({
  prisma: {
    order: {
      findMany: (a: unknown) => findMany(a),
      findFirst: (a: unknown) => findFirst(a),
      findUnique: (a: unknown) => findFirst(a),
      count: (a: unknown) => count(a),
      aggregate: (a: unknown) => aggregate(a),
      groupBy: (a: unknown) => groupBy(a),
      updateMany: (a: unknown) => updateMany(a),
    },
    product: { findMany: vi.fn().mockResolvedValue([]) },
    user: { count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn(),
  },
  toJsonColumn: (v: unknown) => v,
}));

vi.mock("@server/promotions/promotion.service", () => ({
  promotionService: { releaseForOrder: vi.fn() },
}));

const { ORDER_STATUS } = await import("@server/checkout/order.types");
const { orderRepository } = await import("@server/checkout/order.repository");
const { adminOrderRepository } = await import("@server/checkout/admin.order.repository");

/** True when this `where` carries the visibility predicate, however it is nested. */
function excludesExpired(where: unknown): boolean {
  return JSON.stringify(where ?? {}).includes('"not":"expired"');
}

/**
 * True when this `where` cannot match an expired order at all — either because it
 * carries the predicate, or because it already pins `status` to something else.
 * A count of `packed` orders needs no predicate; a count of *all* orders does.
 */
function cannotMatchExpired(where: { status?: unknown } | undefined): boolean {
  if (excludesExpired(where)) return true;
  return typeof where?.status === "string" && where.status !== "expired";
}

beforeEach(() => vi.clearAllMocks());

describe("the buyer's own order list", () => {
  it("hides their abandoned attempts (R5)", async () => {
    await orderRepository.listByUserId("user-1");
    expect(excludesExpired(findMany.mock.calls[0][0].where)).toBe(true);
  });
});

describe("the admin console", () => {
  it("excludes abandoned checkouts from the order list", async () => {
    await adminOrderRepository.getOrders({});
    expect(excludesExpired(findMany.mock.calls[0][0].where)).toBe(true);
  });

  it("cannot reach one by filtering for it explicitly", async () => {
    // The predicate is combined with AND, so a `status` filter narrows within the
    // visible set instead of replacing it.
    await adminOrderRepository.getOrders({ status: ORDER_STATUS.EXPIRED });
    const where = findMany.mock.calls[0][0].where;
    expect(excludesExpired(where)).toBe(true);
    expect(where.status).toBe(ORDER_STATUS.EXPIRED);
  });

  it("does not return one by direct id", async () => {
    await adminOrderRepository.getOrderById("order-1");
    expect(excludesExpired(findFirst.mock.calls[0][0].where)).toBe(true);
  });

  it("does not count one in any dashboard figure", async () => {
    await adminOrderRepository.getOrderStats();
    for (const call of [...count.mock.calls, ...findMany.mock.calls]) {
      expect(cannotMatchExpired(call[0]?.where)).toBe(true);
    }
    // The unfiltered total and the revenue sums are the ones that needed the
    // predicate, and the ones that used to report abandoned checkouts as business.
    expect(count.mock.calls.filter((c) => excludesExpired(c[0]?.where))).toHaveLength(1);
    expect(findMany.mock.calls.every((c) => excludesExpired(c[0]?.where))).toBe(true);
  });
});

describe("the org panel", () => {
  it("excludes abandoned checkouts from an org's order list", async () => {
    await adminOrderRepository.listShopOrders("org-1", ["packing"], { page: 1, limit: 20, oldestFirst: true });
    expect(excludesExpired(findMany.mock.calls[0][0].where)).toBe(true);
  });

  it("does not return one to an org by direct id", async () => {
    await adminOrderRepository.getShopOrder("order-1", "org-1");
    expect(excludesExpired(findFirst.mock.calls[0][0].where)).toBe(true);
  });
});

describe("the sweep", () => {
  it("still finds them — it exists to (the one deliberate exemption)", async () => {
    await orderRepository.findStuckPendingOrders(new Date());
    const where = findMany.mock.calls[0][0].where;
    expect(excludesExpired(where)).toBe(false);
    expect(where.status.in).toContain(ORDER_STATUS.PENDING_PAYMENT);
  });

  it("finds holds on a named product for a blocked checkout", async () => {
    await orderRepository.findAbandonableHoldsForProducts(["p1"], new Date());
    const where = findMany.mock.calls[0][0].where;
    expect(where.items.some.productId.in).toEqual(["p1"]);
    expect(where.NOT).toEqual({ paymentStatus: "paid" });
  });
});
