/**
 * Revenue counted an unpaid or failed checkout as money until the sweep expired it. Both figures
 * are platform-wide, so this asserts the change its own orders make, not absolute sums.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { isDisposableDb } from "../helpers/test-db";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";

describe.skipIf(!isDisposableDb)("admin revenue (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orders: typeof import("@server/checkout/admin.order.repository").adminOrderRepository;
  let dashboard: typeof import("@server/analytics/dashboard.repository").adminDashboardRepository;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  const orderIds: string[] = [];
  let ordersBefore: Awaited<ReturnType<typeof orders.getOrderStats>>;
  let dashboardBefore: Awaited<ReturnType<typeof dashboard.getDashboardStats>>;

  const order = async (n: number, status: string, paymentStatus: string, grandTotal: number) => {
    const row = await prisma.order.create({
      data: { code: `REV${stamp}-${n}`, address: {}, status, paymentStatus, grandTotal },
      select: { id: true },
    });
    orderIds.push(row.id);
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ adminOrderRepository: orders } = await import("@server/checkout/admin.order.repository"));
    ({ adminDashboardRepository: dashboard } = await import("@server/analytics/dashboard.repository"));
    ordersBefore = await orders.getOrderStats();
    dashboardBefore = await dashboard.getDashboardStats();

    await order(1, ORDER_STATUS.CONFIRMED, PAYMENT_STATUS.PAID, 100_00);
    await order(2, ORDER_STATUS.PENDING_PAYMENT, PAYMENT_STATUS.PENDING, 220_72);
    await order(3, ORDER_STATUS.PENDING_PAYMENT, PAYMENT_STATUS.FAILED, 330_00);
    await order(4, ORDER_STATUS.CANCELLED, PAYMENT_STATUS.PAID, 440_00);
    await order(5, ORDER_STATUS.EXPIRED, PAYMENT_STATUS.PENDING, 550_00);
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
  });

  it("order stats count only the paid order as revenue, this month and in total", async () => {
    const after = await orders.getOrderStats();
    expect(after.totalRevenue - ordersBefore.totalRevenue).toBe(100_00);
    expect(after.revenueThisMonth - ordersBefore.revenueThisMonth).toBe(100_00);
  });

  it("the dashboard counts only the paid order in every window", async () => {
    const after = await dashboard.getDashboardStats();
    for (const window of ["today", "week", "month", "year"] as const) {
      expect(after.revenue[window] - dashboardBefore.revenue[window]).toBe(100_00);
    }
  });

  it("the average order value is whole paise, over paid orders", async () => {
    const after = await orders.getOrderStats();
    expect(Number.isInteger(after.averageOrderValue)).toBe(true);
  });
});
