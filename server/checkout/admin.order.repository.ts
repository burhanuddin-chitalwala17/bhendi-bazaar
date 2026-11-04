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
import { calendarDay, isoDay } from "@server/shared/india-time";
import { toShopBuyer, type ShopOrderView, type ShopParcelView } from "@server/checkout/shop-parcel.types";

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

  /** How many visible orders sit in each status: one grouped count, for the console's tab counts. */
  async countByStatus(): Promise<Record<string, number>> {
    const rows = await prisma.order.groupBy({ by: ["status"], where: VISIBLE_ORDER_WHERE, _count: { _all: true } });
    return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
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
        pickupDate: shipment.pickupDate ? isoDay(shipment.pickupDate) : null,
        pickupDay: shipment.pickupDate ? calendarDay(shipment.pickupDate) : null,
        estimatedDelivery: shipment.estimatedDelivery ? isoDay(shipment.estimatedDelivery) : null,
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
      // Revenue leaves out wholly cancelled orders (order-fulfilment D4).
      prisma.order.findMany({
        where: { ...VISIBLE_ORDER_WHERE, NOT: { status: ORDER_STATUS.CANCELLED } },
        select: { grandTotal: true },
      }),
      prisma.order.findMany({
        where: {
          ...VISIBLE_ORDER_WHERE,
          NOT: { status: ORDER_STATUS.CANCELLED },
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
   * One shop's parcels on paid orders, by tab (order-fulfilment D7; ux.md "Shop orders"): an
   * order appears when it has a parcel of this org in `statuses`, with only those parcels. The
   * address is selected for the trim in `toShopBuyer` and never leaves this module whole.
   */
  async listShopOrders(
    orgId: string,
    statuses: readonly string[],
    options: { page: number; limit: number; search?: string; oldestFirst: boolean },
  ) {
    const shipmentWhere = { orgId, status: { in: [...statuses] } };
    const where: Prisma.OrderWhereInput = {
      ...VISIBLE_ORDER_WHERE,
      paymentStatus: PAYMENT_STATUS.PAID,
      shipments: { some: shipmentWhere },
      ...(options.search ? { code: { contains: options.search, mode: "insensitive" as const } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        select: {
          ...SHOP_ORDER_SELECT,
          shipments: { ...SHOP_ORDER_SELECT.shipments, where: { orgId } },
        },
        orderBy: [{ paidAt: options.oldestFirst ? "asc" : "desc" }, { createdAt: options.oldestFirst ? "asc" : "desc" }],
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        relationLoadStrategy: "join",
      }),
      prisma.order.count({ where }),
    ]);
    return { rows: rows.map((row) => toShopOrderView(row, new Set(statuses))), total };
  }

  /** One paid order, only if this org has a parcel in it — otherwise null (not-found, never forbidden). */
  async getShopOrder(orderId: string, orgId: string) {
    const row = await prisma.order.findFirst({
      where: { id: orderId, ...VISIBLE_ORDER_WHERE, paymentStatus: PAYMENT_STATUS.PAID, shipments: { some: { orgId } } },
      select: { ...SHOP_ORDER_SELECT, shipments: { ...SHOP_ORDER_SELECT.shipments, where: { orgId } } },
      relationLoadStrategy: "join",
    });
    return row ? toShopOrderView(row, null) : null;
  }
}

/** What a shop read selects. `address` only for the trim; `phone`, street and email never reach the view. */
const SHOP_ORDER_SELECT = {
  id: true,
  code: true,
  paidAt: true,
  address: true,
  shipments: {
    orderBy: { code: "asc" as const },
    select: {
      id: true,
      code: true,
      status: true,
      shippingCost: true,
      courierName: true,
      trackingNumber: true,
      pickupDate: true,
      items: SHIPMENT_LINES_INCLUDE.items,
    },
  },
} satisfies Prisma.OrderSelect;

type ShopOrderRow = Prisma.OrderGetPayload<{ select: typeof SHOP_ORDER_SELECT }>;

/**
 * Exported for tests. The query already scopes parcels to the org; `only` narrows to a tab's
 * states, while "Parcel 1 of 2" still counts every parcel of this shop in the order.
 */
export function toShopOrderView(row: ShopOrderRow, only: Set<string> | null): ShopOrderView {
  const buyer = toShopBuyer(row.address);
  const paidAt = row.paidAt ? row.paidAt.toISOString() : null;
  const parcels: ShopParcelView[] = row.shipments.map((s, i) => {
    const items = toWireShipmentItems(s.items);
    return {
      id: s.id,
      code: s.code,
      status: s.status as ShipmentStatus,
      orderId: row.id,
      orderCode: row.code,
      paidAt,
      buyer,
      items,
      parcelValue: items.reduce((sum, item) => sum + (item.salePrice ?? item.price) * item.quantity, 0),
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      shippingCost: s.shippingCost,
      courierName: s.courierName,
      trackingNumber: s.trackingNumber,
      pickupDay: s.pickupDate ? calendarDay(s.pickupDate) : null,
      position: i + 1,
      ofCount: row.shipments.length,
    };
  });
  return { id: row.id, code: row.code, paidAt, buyer, parcels: only ? parcels.filter((p) => only.has(p.status)) : parcels };
}

export const adminOrderRepository = new AdminOrderRepository();


