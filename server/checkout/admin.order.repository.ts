/**
 * Admin Order Repository
 * Handles database operations for order management
 */

import { prisma } from "@server/shared/prisma";
import type {
  OrderListFilters,
  UpdateOrderStatusInput,
  OrderStats,
} from "@server/checkout/admin.order.types";
import { boolean } from "zod";

export class AdminOrderRepository {
  /**
   * Get paginated list of orders with filters
   */
  async getOrders(filters: OrderListFilters) {
    const {
      search,
      status,
      paymentStatus,
      dateFrom,
      dateTo,
      minAmount,
      maxAmount,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // Note: For amount filtering, we'd need to use raw SQL or post-filter
    // since totals is stored as JSON

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          shipments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);


    // Post-filter by amount
    if (minAmount !== undefined || maxAmount !== undefined) {
      orders.filter((order) => {
        const total = order.grandTotal || 0;
        if (minAmount !== undefined && total < minAmount) return false;
        if (maxAmount !== undefined && total > maxAmount) return false;
        return true;
      });
    }

    return { orders, total };
  }

  /**
   * Get single order by ID
   */
  async getOrderById(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        shipments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) return null;

    return order;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: string,
    data: UpdateOrderStatusInput
  ) {
    const updateData: any = {};

    if (data.status) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.estimatedDelivery)
      updateData.estimatedDelivery = new Date(data.estimatedDelivery);

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return true;
  }

  /**
   * Get order statistics
   */
  async getOrderStats(): Promise<OrderStats> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [
      totalOrders,
      processingOrders,
      packedOrders,
      shippedOrders,
      deliveredOrders,
      allOrders,
      monthOrders,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: "processing" } }),
      prisma.order.count({ where: { status: "packed" } }),
      prisma.order.count({ where: { status: "shipped" } }),
      prisma.order.count({ where: { status: "delivered" } }),
      prisma.order.findMany({
        select: { grandTotal: true },
      }),
      prisma.order.findMany({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
        select: { grandTotal: true },
      }),
    ]);

    const totalRevenue = allOrders.reduce((sum, order) => {
      return sum + (order.grandTotal || 0);
    }, 0);

    const revenueThisMonth = monthOrders.reduce((sum, order) => {
      return sum + (order.grandTotal || 0);
    }, 0);

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalOrders,
      processingOrders,
      packedOrders,
      shippedOrders,
      deliveredOrders,
      totalRevenue,
      revenueThisMonth,
      averageOrderValue,
    };
  }

  /**
   * Bulk update order status
   */
  async bulkUpdateStatus(
    orderIds: string[],
    status: string
  ): Promise<number> {
    const result = await prisma.order.updateMany({
      where: {
        id: {
          in: orderIds,
        },
      },
      data: {
        status,
      },
    });

    return result.count;
  }
}

export const adminOrderRepository = new AdminOrderRepository();


