/**
 * Regression: `payment.failed` once flipped an order to a terminal status, which
 * removed it from the reconcile sweep's worklist and made it ineligible for
 * expireAndRestock — the reserved stock leaked permanently. A failed attempt must
 * leave the order sweepable (the buyer may retry; the sweep expires and restocks).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const orderUpdateMany = vi.fn();
const orderFindMany = vi.fn();
const shipmentFindMany = vi.fn();
const stockUpsert = vi.fn();

const tx = {
  order: { updateMany: orderUpdateMany },
  shipment: { findMany: shipmentFindMany },
  productStock: { upsert: stockUpsert, findFirst: vi.fn() },
};

vi.mock("@server/shared/prisma", () => ({
  prisma: {
    order: {
      updateMany: (args: unknown) => orderUpdateMany(args),
      findMany: (args: unknown) => orderFindMany(args),
    },
    $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  },
  toJsonColumn: (value: unknown) => value,
}));

vi.mock("@server/promotions/promotion.service", () => ({
  promotionService: { releaseForOrder: vi.fn() },
}));

const { orderRepository } = await import("@server/checkout/order.repository");

beforeEach(() => {
  orderUpdateMany.mockReset();
  orderFindMany.mockReset();
  shipmentFindMany.mockReset();
});

describe("markPaymentFailed", () => {
  it("records the failed attempt without leaving pending_payment", async () => {
    orderUpdateMany.mockResolvedValue({ count: 1 });
    await orderRepository.markPaymentFailed("order-1");

    const call = orderUpdateMany.mock.calls[0][0];
    expect(call.data).toEqual({ paymentStatus: "failed" });
    expect(call.data.status).toBeUndefined();
  });

  it("never overwrites a captured payment or an expired order", async () => {
    orderUpdateMany.mockResolvedValue({ count: 0 });
    await orderRepository.markPaymentFailed("order-1");

    const call = orderUpdateMany.mock.calls[0][0];
    expect(call.where.NOT).toEqual(
      expect.arrayContaining([{ paymentStatus: "paid" }, { status: "expired" }])
    );
  });
});

describe("findStuckPendingOrders", () => {
  it("includes failed attempts in the sweep worklist", async () => {
    orderFindMany.mockResolvedValue([]);
    await orderRepository.findStuckPendingOrders(new Date());

    const where = orderFindMany.mock.calls[0][0].where;
    expect(where.paymentStatus).toEqual({ in: ["pending", "failed"] });
  });
});

describe("expireAndRestock", () => {
  it("expires and restocks legacy orders stranded in status failed", async () => {
    orderUpdateMany.mockResolvedValue({ count: 1 });
    shipmentFindMany.mockResolvedValue([
      {
        orgAddressId: "loc-1",
        items: [{ quantity: 2, orderItem: { productId: "prod-1" } }],
      },
    ]);

    const result = await orderRepository.expireAndRestock("order-1");

    expect(result).toBe(true);
    const guard = orderUpdateMany.mock.calls[0][0].where;
    expect(guard.status).toEqual({ in: ["pending_payment", "failed"] });
    expect(guard.NOT).toEqual({ paymentStatus: "paid" });
    expect(stockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { quantity: { increment: 2 } },
      })
    );
  });

  it("releases nothing when the order was already confirmed or expired", async () => {
    orderUpdateMany.mockResolvedValue({ count: 0 });

    const result = await orderRepository.expireAndRestock("order-1");

    expect(result).toBe(false);
    expect(shipmentFindMany).not.toHaveBeenCalled();
    expect(stockUpsert).not.toHaveBeenCalled();
  });
});
