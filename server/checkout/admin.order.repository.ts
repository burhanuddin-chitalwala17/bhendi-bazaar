/**
 * Admin Order Repository — the console's reads on the order aggregate. Read-only since
 * 2026-10-04: the status and notes writes it carried went to `order.repository.ts`, so `Order`
 * has one writing repository (Invariant 5); `tests/unit/one-repository.test.ts` holds it there.
 */

import { prisma } from "@server/shared/prisma";
import {
  SHIPMENT_LINES_INCLUDE,
  toWireShipmentItems,
  withWireItems,
} from "@server/checkout/order.repository";
import { Prisma } from "@prisma/client";
import { ORDER_STATUS, PAYMENT_STATUS, VISIBLE_ORDER_WHERE } from "@server/checkout/order.types";
import type {
  AdminOrderDetail,
  OrderAddressSnapshot,
  OrderListFilters,
  OrderStats,
} from "@server/checkout/admin.order.types";
import type { ShipmentStatus } from "@server/shipping/domain/shipping.types";

/**
 * The sort keys the API offers, mapped to the columns they actually name.
 *
 * `total` is the one that differs, and it threw: `OrderListFilters` has declared it since
 * 2026-08-04 while the column is `grandTotal`, so `?sortBy=total` reached Prisma as an unknown
 * argument. It survived because the route cast the query string with `as any` and nothing ever
 * asked for that sort in a test — the cast made an invalid key look like a valid one all the way
 * down. A map rather than a rename, because the API's vocabulary need not be the column's.
 */
const SORT_COLUMNS: Record<string, string> = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  total: "grandTotal",
};

/**
 * Read the address a `Json` column holds.
 *
 * A cast would not make it a shape — the column is whatever was written to it, including from
 * releases that wrote a different one. Every field is read defensively and a non-object becomes
 * `null`, so a malformed snapshot renders blanks instead of throwing on `.city` mid-page.
 */
function toAddressSnapshot(value: unknown): OrderAddressSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const text = (key: string) => (typeof row[key] === "string" ? (row[key] as string) : "");
  const optional = (key: string) =>
    typeof row[key] === "string" && row[key] ? (row[key] as string) : undefined;

  return {
    fullName: text("fullName"),
    mobile: text("mobile"),
    email: optional("email"),
    addressLine1: text("addressLine1"),
    addressLine2: optional("addressLine2"),
    landmark: optional("landmark"),
    city: text("city"),
    state: text("state"),
    pincode: text("pincode"),
    country: text("country"),
  };
}

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

    // Abandoned checkouts are invisible here (checkout-abandonment R4). Combined with
    // AND rather than assigned, so an explicit `status` filter narrows within the
    // visible set instead of replacing the predicate.
    const where: Prisma.OrderWhereInput = { AND: [VISIBLE_ORDER_WHERE] };

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
        relationLoadStrategy: "join",
        where,
        skip,
        take: limit,
        orderBy: { [SORT_COLUMNS[sortBy]]: sortOrder },
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          shipments: {
            orderBy: { createdAt: 'asc' },
            include: SHIPMENT_LINES_INCLUDE,
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

    return { orders: orders.map(withWireItems), total };
  }

  /**
   * Get single order by ID
   */
  async getOrderById(id: string): Promise<AdminOrderDetail | null> {
    const order = await prisma.order.findFirst({
      relationLoadStrategy: "join",
      where: { id, ...VISIBLE_ORDER_WHERE },
      include: {
        shipments: {
          orderBy: { createdAt: 'asc' },
          include: SHIPMENT_LINES_INCLUDE,
        },
      },
    });

    if (!order) return null;

    return {
      id: order.id,
      code: order.code,
      status: order.status,
      paymentStatus: order.paymentStatus ?? PAYMENT_STATUS.PENDING,
      paymentMethod: order.paymentMethod,
      paymentId: order.paymentId,
      address: toAddressSnapshot(order.address),
      itemsTotal: order.itemsTotal,
      shippingTotal: order.shippingTotal,
      discount: order.discount,
      grandTotal: order.grandTotal,
      createdAt: order.createdAt,
      shipments: order.shipments.map((shipment) => ({
        id: shipment.id,
        code: shipment.code,
        status: shipment.status as ShipmentStatus,
        fromCity: shipment.fromCity,
        fromState: shipment.fromState,
        packageWeight: shipment.packageWeight,
        shippingCost: shipment.shippingCost,
        courierName: shipment.courierName,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl,
        items: toWireShipmentItems(shipment.items),
      })),
    };
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
      // Every figure on this dashboard excludes abandoned checkouts: counting them
      // would report business that did not happen (checkout-abandonment R4).
      prisma.order.count({ where: VISIBLE_ORDER_WHERE }),
      prisma.order.count({ where: { status: ORDER_STATUS.PROCESSING } }),
      prisma.order.count({ where: { status: ORDER_STATUS.PACKED } }),
      prisma.order.count({ where: { status: ORDER_STATUS.SHIPPED } }),
      prisma.order.count({ where: { status: ORDER_STATUS.DELIVERED } }),
      prisma.order.findMany({
        where: VISIBLE_ORDER_WHERE,
        select: { grandTotal: true },
      }),
      prisma.order.findMany({
        where: {
          ...VISIBLE_ORDER_WHERE,
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
   * Orders visible to one org: those with a shipment from it, carrying only that org's
   * shipments. The `include` filter is the scope — a cross-vendor basket's other parcels
   * never leave the database. Read-only; an org mutates its shipments, never the order.
   */
  async getOrdersForOrg(orgId: string, page = 1, limit = 20) {
    const where = { ...VISIBLE_ORDER_WHERE, shipments: { some: { orgId } } };
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
            select: {
              id: true,
              code: true,
              status: true,
              shippingCost: true,
              items: SHIPMENT_LINES_INCLUDE.items,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        // Order + its org-scoped shipments + their lines in one LATERAL JOIN rather
        // than a statement per nested relation (matches the storefront order reads).
        relationLoadStrategy: "join",
      }),
      prisma.order.count({ where }),
    ]);
    return {
      orders: orders.map((order) => ({
        ...order,
        shipments: order.shipments.map((s) => ({ ...s, items: toWireShipmentItems(s.items) })),
      })),
      total,
      page,
      limit,
    };
  }

  /** One order, only if this org has a shipment in it — otherwise null (not-found, never forbidden). */
  async getOrderForOrg(orderId: string, orgId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, ...VISIBLE_ORDER_WHERE, shipments: { some: { orgId } } },
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
            shippingCost: true,
            courierName: true,
            trackingNumber: true,
            trackingUrl: true,
            fromPincode: true,
            fromCity: true,
            items: SHIPMENT_LINES_INCLUDE.items,
          },
        },
      },
      relationLoadStrategy: "join",
    });
    if (!order) return null;
    return {
      ...order,
      shipments: order.shipments.map((s) => ({ ...s, items: toWireShipmentItems(s.items) })),
    };
  }
}

export const adminOrderRepository = new AdminOrderRepository();


