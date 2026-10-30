import { prisma } from "@server/shared/prisma";
import { AVAILABLE } from "@server/catalog/product.visibility";
import { LIVE_PARCEL_WHERE, PAID_ORDER_WHERE as PAID_ORDER, PARCEL_WITH_SHOP } from "@server/checkout/order.types";

/**
 * The dashboard widgets' reads. Analytics is the documented read-only exception to
 * no-cross-domain-reads (CLAUDE.md), so it reads these tables itself — here, and only here.
 */
export const widgetsRepository = {
  /** Inventory and low stock are about what can be sold, so archived products are out
   *  (ADR-0029 D12). The revenue and order reads below keep them: they are about what happened. */
  productStockRows(orgId: string | null) {
    return prisma.product.findMany({
      where: { ...(orgId === null ? {} : { orgId }), ...AVAILABLE },
      select: { lowStockThreshold: true, stockLocations: { select: { quantity: true } } },
    });
  },

  paidOrderTotals() {
    return prisma.order.aggregate({
      where: PAID_ORDER,
      _sum: { grandTotal: true },
      _count: true,
    });
  },

  pendingParcelCount(orgId: string | null) {
    return prisma.shipment.count({
      where: {
        ...(orgId === null ? {} : { orgId }),
        status: { in: [...PARCEL_WITH_SHOP] },
        order: PAID_ORDER,
      },
    });
  },

  paidOrderCount(orgId: string | null) {
    return prisma.order.count({
      where: {
        ...PAID_ORDER,
        ...(orgId === null ? {} : { shipments: { some: { orgId } } }),
      },
    });
  },

  /** This org's parcel lines at the unit price actually paid; shipping is excluded (TRD D5). */
  paidLinesForOrg(orgId: string) {
    return prisma.shipmentItem.findMany({
      where: { shipment: { orgId, ...LIVE_PARCEL_WHERE, order: PAID_ORDER } },
      select: { quantity: true, orderItem: { select: { unitPrice: true } } },
    });
  },

  customerCount() {
    return prisma.user.count({ where: { platformRole: "USER" } });
  },
};
