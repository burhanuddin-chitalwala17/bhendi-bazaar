/**
 * getDashboardStats was consolidated from 15 queries to 9 by moving aggregation
 * into the database (PR-72): revenue windows became aggregate._sum instead of
 * fetching every order row, five status counts became one groupBy, and three
 * product queries became one row-set. Same numbers, different computation — so
 * this test recomputes every widget figure the *old* way, query by query, and
 * pins equality against the consolidated implementation over the seeded data.
 *
 * Needs the seeded local database; skips anywhere else.
 */
import "dotenv/config";
import { describe, it, expect } from "vitest";

const dbUrl = process.env.DATABASE_URL ?? "";
const isLocalDb = (() => {
  try {
    const url = new URL(dbUrl);
    return (
      ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/bhendi_bazaar_dev"
    );
  } catch {
    return false;
  }
})();

describe.skipIf(!isLocalDb)("dashboard stats equivalence (local seeded db)", () => {
  it("consolidated stats equal the per-query originals", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { adminDashboardRepository } = await import("@server/analytics/dashboard.repository");

    const stats = await adminDashboardRepository.getDashboardStats();

    // The original implementation's date windows, computed the same way
    // (including the deliberate now-mutation of setHours).
    const now = new Date();
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueOldWay = async (gte: Date) => {
      const rows = await prisma.order.findMany({
        where: { createdAt: { gte } },
        select: { grandTotal: true },
      });
      return { sum: rows.reduce((s, o) => s + (o.grandTotal || 0), 0), count: rows.length };
    };

    const [today, week, month, year] = await Promise.all([
      revenueOldWay(startOfToday),
      revenueOldWay(startOfWeek),
      revenueOldWay(startOfMonth),
      revenueOldWay(startOfYear),
    ]);
    expect(stats.revenue).toEqual({
      today: today.sum,
      week: week.sum,
      month: month.sum,
      year: year.sum,
    });
    expect(stats.orders.todayCount).toBe(today.count);

    const [total, processing, packed, shipped, delivered] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "processing" } }),
      prisma.order.count({ where: { status: "packed" } }),
      prisma.order.count({ where: { status: "shipped" } }),
      prisma.order.count({ where: { status: "delivered" } }),
    ]);
    expect(stats.orders).toMatchObject({ total, processing, packed, shipped, delivered });

    const [productTotal, withStock, outOfStock] = await Promise.all([
      prisma.product.count(),
      prisma.product.findMany({
        where: { stockLocations: { some: { quantity: { gt: 0 } } } },
        select: { stockLocations: { select: { quantity: true } }, lowStockThreshold: true },
      }),
      prisma.product.count({ where: { stockLocations: { none: { quantity: { gt: 0 } } } } }),
    ]);
    const lowStock = withStock.filter(
      (p) => p.stockLocations.reduce((s, r) => s + r.quantity, 0) <= p.lowStockThreshold
    ).length;
    expect(stats.products).toEqual({ total: productTotal, lowStock, outOfStock });

    const [userTotal, active, fresh] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastActiveAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    ]);
    expect(stats.customers).toEqual({ total: userTotal, active, new: fresh });
  }, 30000);
});
