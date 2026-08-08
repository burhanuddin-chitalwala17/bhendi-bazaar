/**
 * Admin Dashboard Repository
 * Handles database operations for dashboard statistics
 */

import { prisma } from "@server/shared/prisma";
import type {
  DashboardStats,
  RecentActivity,
  TopProduct,
  RevenueChart,
} from "@server/analytics/dashboard.types";
import { ProductFlag } from "@server/catalog/product.flags";

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

    // Get all orders with date filters
    const [
      todayOrders,
      weekOrders,
      monthOrders,
      yearOrders,
      allOrders,
      orderStatuses,
      productStats,
      userStats,
    ] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: startOfToday } },
        select: { grandTotal: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: startOfWeek } },
        select: { grandTotal: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: startOfMonth } },
        select: { grandTotal: true },
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: startOfYear } },
        select: { grandTotal: true },
      }),
      prisma.order.count(),
      Promise.all([
        prisma.order.count({ where: { status: "processing" } }),
        prisma.order.count({ where: { status: "packed" } }),
        prisma.order.count({ where: { status: "shipped" } }),
        prisma.order.count({ where: { status: "delivered" } }),
      ]),
      Promise.all([
        prisma.product.count(),
        prisma.product.findMany({
          where: { stockLocations: { some: { quantity: { gt: 0 } } } },
          select: {
            stockLocations: { select: { quantity: true } },
            lowStockThreshold: true,
          },
        }),
        prisma.product.count({ where: { stockLocations: { none: { quantity: { gt: 0 } } } } }),
      ]),
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

    // Calculate revenues
    const revenueToday = todayOrders.reduce(
      (sum, o) => sum + (o.grandTotal || 0),
      0
    );
    const revenueWeek = weekOrders.reduce(
      (sum, o) => sum + (o.grandTotal || 0),
      0
    );
    const revenueMonth = monthOrders.reduce(
      (sum, o) => sum + (o.grandTotal || 0),
      0
    );
    const revenueYear = yearOrders.reduce(
      (sum, o) => sum + (o.grandTotal || 0),
      0
    );

    return {
      revenue: {
        today: revenueToday,
        week: revenueWeek,
        month: revenueMonth,
        year: revenueYear,
      },
      orders: {
        total: allOrders,
        processing: orderStatuses[0],
        packed: orderStatuses[1],
        shipped: orderStatuses[2],
        delivered: orderStatuses[3],
        todayCount: todayOrders.length,
      },
      products: {
        total: productStats[0],
        lowStock: productStats[1].filter(
          (p) =>
            p.stockLocations.reduce((sum, row) => sum + row.quantity, 0) <= p.lowStockThreshold
        )
          .length,
        outOfStock: productStats[2],
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

  /**
   * Get top selling products
   */
  async getTopProducts(limit: number = 5): Promise<TopProduct[]> {
    // This would require order item parsing from JSON
    // For now, return featured products as placeholder
    const products = await prisma.product.findMany({
      where: { flags: { has: ProductFlag.FEATURED } },
      take: limit,
      orderBy: { reviewsCount: "desc" },
      select: {
        id: true,
        name: true,
        thumbnail: true,
        price: true,
      },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      thumbnail: p.thumbnail,
      salesCount: 0, // Would need to calculate from orders
      revenue: 0, // Would need to calculate from orders
    }));
  }

  /**
   * Get revenue chart data
   */
  async getRevenueChart(days: number = 30): Promise<RevenueChart[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        createdAt: true,
        grandTotal: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Group by date
    const chartData: Record<string, { revenue: number; orders: number }> = {};

    orders.forEach((order) => {
      const date = order.createdAt.toISOString().split("T")[0];
      if (!chartData[date]) {
        chartData[date] = { revenue: 0, orders: 0 };
      }
      chartData[date].revenue += order.grandTotal || 0;
      chartData[date].orders += 1;
    });

    // Convert to array
    return Object.entries(chartData).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      orders: data.orders,
    }));
  }
}

export const adminDashboardRepository = new AdminDashboardRepository();


