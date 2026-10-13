/**
 * Admin Dashboard Repository
 * Handles database operations for dashboard statistics
 */

import { prisma } from "@server/shared/prisma";
import { AVAILABLE } from "@server/catalog/product.visibility";
import { VISIBLE_ORDER_WHERE } from "@server/checkout/order.types";
import type {
  DashboardStats,
  RecentActivity,
} from "@server/analytics/dashboard.types";

export class AdminDashboardRepository {
  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();

    // Calculate date ranges
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Aggregation happens in the database, not JS: the previous shape fetched
    // every order row in each window to sum one column, and asked five separate
    // counts for what one GROUP BY answers (billed-operations work, PR-72).
    const revenueWindow = (gte: Date) =>
      prisma.order.aggregate({
        // Abandoned checkouts are not business and are not counted here
        // (checkout-abandonment R4).
        where: { ...VISIBLE_ORDER_WHERE, createdAt: { gte } },
        _sum: { grandTotal: true },
        _count: true,
      });

    const [
      todayTotals,
      weekTotals,
      monthTotals,
      yearTotals,
      ordersByStatus,
      // One read of (threshold, quantities) answers total, low-stock and
      // out-of-stock together — "stock ≤ its own threshold" compares an aggregate
      // to a column, which Prisma cannot express as a filter.
      productRows,
      userStats,
    ] = await Promise.all([
      revenueWindow(startOfToday),
      revenueWindow(startOfWeek),
      revenueWindow(startOfMonth),
      revenueWindow(startOfYear),
      prisma.order.groupBy({ by: ["status"], where: VISIBLE_ORDER_WHERE, _count: true }),
      prisma.product.findMany({
        // Sellable inventory only (ADR-0029 D12); the order and revenue aggregates
        // beside this one are history and keep archived products.
        where: AVAILABLE,
        select: {
          stockLocations: { select: { quantity: true } },
          lowStockThreshold: true,
        },
      }),
      Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: { lastActiveAt: { gte: thirtyDaysAgo } },
        }),
        prisma.user.count({
          where: { createdAt: { gte: startOfMonth } },
        }),
      ]),
    ]);

    const statusCount = (status: string) =>
      ordersByStatus.find((group) => group.status === status)?._count ?? 0;

    const stockTotals = productRows.map((product) => ({
      total: product.stockLocations.reduce((sum, row) => sum + row.quantity, 0),
      threshold: product.lowStockThreshold,
    }));

    return {
      revenue: {
        today: todayTotals._sum.grandTotal ?? 0,
        week: weekTotals._sum.grandTotal ?? 0,
        month: monthTotals._sum.grandTotal ?? 0,
        year: yearTotals._sum.grandTotal ?? 0,
      },
      orders: {
        total: ordersByStatus.reduce((sum, group) => sum + group._count, 0),
        processing: statusCount("processing"),
        packed: statusCount("packed"),
        shipped: statusCount("shipped"),
        delivered: statusCount("delivered"),
        todayCount: todayTotals._count,
      },
      products: {
        total: productRows.length,
        lowStock: stockTotals.filter((p) => p.total > 0 && p.total <= p.threshold).length,
        outOfStock: stockTotals.filter((p) => p.total === 0).length,
      },
      customers: {
        total: userStats[0],
        active: userStats[1],
        new: userStats[2],
      },
    };
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    // Get recent orders
    const recentOrders = await prisma.order.findMany({
      relationLoadStrategy: "join",
      where: VISIBLE_ORDER_WHERE,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    // Get recent reviews
    const recentReviews = await prisma.review.findMany({
      relationLoadStrategy: "join",
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: { name: true },
        },
      },
    });

    // Get recent users
    const recentUsers = await prisma.user.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      // The activity feed needs three fields; the unselected row carries the
      // password hash, which has no business leaving the table for a feed.
      select: { id: true, name: true, email: true, createdAt: true },
    });

    // Combine and sort
    const activities: RecentActivity[] = [
      ...recentOrders.map((order) => ({
        id: order.id,
        type: "order" as const,
        title: `New order ${order.code}`,
        description: `Order placed by ${order.user?.name || "Guest"}`,
        timestamp: order.createdAt,
        metadata: { orderId: order.id, code: order.code },
      })),
      ...recentReviews.map((review) => ({
        id: review.id,
        type: "review" as const,
        title: `New review for ${review.product.name}`,
        description: `${review.rating}★ by ${review.userName}`,
        timestamp: review.createdAt,
        metadata: { reviewId: review.id, productId: review.productId },
      })),
      ...recentUsers.map((user) => ({
        id: user.id,
        type: "user" as const,
        title: "New user registered",
        description: user.name || user.email || "Unknown user",
        timestamp: user.createdAt,
        metadata: { userId: user.id },
      })),
    ];

    return activities
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

}

export const adminDashboardRepository = new AdminDashboardRepository();


