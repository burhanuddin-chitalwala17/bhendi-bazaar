/**
 * Admin Order Repository
 * Handles database operations for order management
 */

import { prisma } from "@server/shared/prisma";
import { Prisma } from "@prisma/client";
import type {
  OrderListFilters,
  UpdateOrderStatusInput,
  OrderStats,
} from "@server/checkout/admin.order.types";

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

    const where: Prisma.OrderWhereInput = {};

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
    const updateData: Prisma.OrderUpdateInput = {};

    if (data.status) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    // estimatedDelivery is a Shipment column, not an Order one — the write that used to
    // sit here threw at runtime whenever a date was supplied, hidden by `any`.

    await prisma.order.update({
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

  /**
   * Orders visible to one org: those with a shipment from it, carrying only that org's
   * shipments. The `include` filter is the scope — a cross-vendor basket's other parcels
   * never leave the database. Read-only; an org mutates its shipments, never the order.
   */
  async getOrdersForOrg(orgId: string, page = 1, limit = 20) {
    const where = { shipments: { some: { orgId } } };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          id: true,
          code: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          address: true,
          shipments: {
            where: { orgId },
            select: { id: true, code: true, status: true, items: true, shippingCost: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);
    return { orders, total, page, limit };
  }

  /** One order, only if this org has a shipment in it — otherwise null (not-found, never forbidden). */
  async getOrderForOrg(orderId: string, orgId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, shipments: { some: { orgId } } },
      select: {
        id: true,
        code: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        address: true,
        notes: true,
        shipments: {
          where: { orgId },
          select: {
            id: true,
            code: true,
            status: true,
            items: true,
            shippingCost: true,
            courierName: true,
            trackingNumber: true,
            trackingUrl: true,
            fromPincode: true,
            fromCity: true,
          },
        },
      },
    });
  }
}

export const adminOrderRepository = new AdminOrderRepository();


