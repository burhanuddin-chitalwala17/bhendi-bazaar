/**
 * Server-side Order Repository
 *
 * This repository handles all database operations for orders.
 * It uses Prisma to interact with the PostgreSQL database.
 */

import { prisma, toJsonColumn } from "@server/shared/prisma";
import type { ShipmentItem } from "@server/checkout/order.types";
import { Order } from "@prisma/client";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";

/**
 * Order lines live in OrderItem/ShipmentItem rows (order-and-cart-lines), but the
 * wire keeps its flat items array. This include + mapper pair is how every read in
 * this domain rebuilds it: display fields from the product join (Restrict guarantees
 * the row), `price` = the unit price actually paid (TRD D2).
 */
export const SHIPMENT_LINES_INCLUDE = {
  items: {
    include: {
      orderItem: {
        include: {
          product: { select: { name: true, slug: true, thumbnail: true } },
        },
      },
    },
  },
} as const;

interface ShipmentLineRow {
  quantity: number;
  orderItem: {
    productId: string;
    unitPrice: number;
    size: string | null;
    color: string | null;
    product: { name: string; slug: string; thumbnail: string };
  };
}

export function toWireShipmentItems(rows: ShipmentLineRow[]): ShipmentItem[] {
  return rows.map((row) => ({
    productId: row.orderItem.productId,
    productName: row.orderItem.product.name,
    productSlug: row.orderItem.product.slug,
    thumbnail: row.orderItem.product.thumbnail,
    price: row.orderItem.unitPrice,
    quantity: row.quantity,
    size: row.orderItem.size ?? undefined,
    color: row.orderItem.color ?? undefined,
  }));
}

/** Swap row relations for the wire array, and keep the legacy blob off the wire. */
export function withWireItems<
  S extends { legacyItems?: unknown; items: ShipmentLineRow[] },
  O extends { shipments: S[] }
>(order: O) {
  return {
    ...order,
    shipments: order.shipments.map(({ legacyItems: _legacy, items, ...shipment }) => ({
      ...shipment,
      items: toWireShipmentItems(items),
    })),
  };
}

/**
 * Helper to generate order code
 */
function generateOrderCode(): string {
  const code = `BB-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  return code;
}

/**
 * Helper to calculate estimated delivery date
 */
function calculateEstimatedDelivery(): string {
  const deliveryDate = new Date();
  deliveryDate.setDate(deliveryDate.getDate() + 3); // 3 days from now
  return deliveryDate.toISOString();
}


export class OrderRepository {
  /**
   * List all orders for a user
   */
  async listByUserId(userId: string) {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        shipments: { include: SHIPMENT_LINES_INCLUDE },
      },
    });

    return orders.map(withWireItems);
  }

  /**
   * Find order by ID
   */
  async findById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shipments: { include: SHIPMENT_LINES_INCLUDE },
      },
    });

    if (!order) {
      return null;
    }

    return withWireItems(order);
  }

  /**
   * Find order by code (for guest lookup)
   */
  async findByCode(code: string) {
    const order = await prisma.order.findUnique({
      where: { code },
    });

    if (!order) {
      return null;
    }

    return order;
  }

  /**
   * The single write path to `paymentStatus: "paid"` (ADR-0005). A conditional
   * update, not read-then-write: two confirmations racing (webhook and browser
   * return) resolve at the database — exactly one wins, the other sees count 0 and
   * re-reads to find out why.
   */
  async confirmPaid(orderId: string, paymentId: string): Promise<boolean> {
    const result = await prisma.order.updateMany({
      // Not paid, and not expired: an expired order's stock is already released, so
      // a late capture is refused here and refunded manually rather than confirming
      // an order the store may no longer be able to fulfil.
      where: { id: orderId, NOT: [{ paymentStatus: "paid" }, { status: "expired" }] },
      data: {
        paymentStatus: "paid",
        status: "confirmed",
        paymentId,
      },
    });
    return result.count === 1;
  }

  /**
   * Orders stuck pending past the threshold, with a gateway order to ask about —
   * the reconciliation sweep's worklist (payment-confirmation D7). Capped: the sweep
   * runs often, so a long tail drains over several runs rather than one slow one.
   */
  async findStuckPendingOrders(olderThan: Date, limit = 20) {
    return prisma.order.findMany({
      where: {
        paymentStatus: "pending",
        gatewayOrderId: { not: null },
        createdAt: { lt: olderThan },
      },
      select: { id: true, gatewayOrderId: true, grandTotal: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  /**
   * Abandon a stale pending order and put its stock back (inventory-reservation R4).
   *
   * The expiry is conditional on the order still being pending, so it cannot race a
   * confirmation into releasing stock for a paid order — one of the two conditional
   * writes wins at the database, never both. Restock is a plain increment: the guard
   * exists to stop stock going below zero, and additions cannot.
   */
  async expireAndRestock(orderId: string): Promise<boolean> {
    return await prisma.$transaction(async (tx) => {
      const expired = await tx.order.updateMany({
        where: { id: orderId, status: "pending_payment", NOT: { paymentStatus: "paid" } },
        data: { status: "expired" },
      });
      if (expired.count === 0) return false;

      // Stock goes back where it came from: each parcel's rows, at the location the
      // allocation persisted on it (stock-locations D6). Legacy shipments predating
      // the cutover carry no location — their lines fall back to the product's
      // largest current row, loudly, rather than vanishing.
      const shipments = await tx.shipment.findMany({
        where: { orderId },
        select: {
          orgAddressId: true,
          items: { select: { quantity: true, orderItem: { select: { productId: true } } } },
        },
      });
      for (const shipment of shipments) {
        for (const item of shipment.items) {
          const productId = item.orderItem.productId;
          let target = shipment.orgAddressId;
          if (!target) {
            const fallback = await tx.productStock.findFirst({
              where: { productId },
              orderBy: { quantity: "desc" },
              select: { orgAddressId: true },
            });
            if (!fallback) {
              console.warn(
                `[expireAndRestock] no stock row to restore ${item.quantity} of ${productId} (legacy shipment, no location) — correct manually`
              );
              continue;
            }
            target = fallback.orgAddressId;
          }
          await tx.productStock.upsert({
            where: { productId_orgAddressId: { productId, orgAddressId: target } },
            update: { quantity: { increment: item.quantity } },
            create: { productId, orgAddressId: target, quantity: item.quantity },
          });
        }
      }
      return true;
    });
  }

  /** Links the order to the gateway order created to charge it (payment-confirmation). */
  async attachGatewayOrder(orderId: string, gatewayOrderId: string): Promise<void> {
    await prisma.order.update({ where: { id: orderId }, data: { gatewayOrderId } });
  }

  /** Failure never overwrites success: a captured payment beats a late failure signal. */
  async markPaymentFailed(orderId: string): Promise<boolean> {
    const result = await prisma.order.updateMany({
      where: { id: orderId, NOT: { paymentStatus: "paid" } },
      data: { paymentStatus: "failed", status: "failed" },
    });
    return result.count === 1;
  }


  /**
   * Cancel an order and restore stock
   */
  // async cancel(orderId: string): Promise<boolean> {
  //   const result = await prisma.$transaction(async (tx) => {
  //     // Get order to restore stock
  //     const existingOrder = await tx.order.findUnique({
  //       where: { id: orderId },
  //     });

  //     if (!existingOrder) {
  //       throw new NotFoundError("Order not found");
  //     }

  //     // Only restore stock if order is in a cancellable state
  //     const cancellableStatuses = ["processing", "packed"];
  //     if (!cancellableStatuses.includes(existingOrder.status)) {
  //       throw new Error(
  //         `Cannot cancel order with status: ${existingOrder.status}`
  //       );
  //     }

  //     // Update order status to cancelled
  //     const order = await tx.order.update({
  //       where: { id: orderId },
  //       data: { status: "cancelled" },
  //     });

  //     // Restore stock for each item
  //     for (const item of items) {
  //       await tx.product.update({
  //         where: { id: item.productId },
  //         data: {
  //           stock: {
  //             increment: item.quantity,
  //           },
  //         },
  //       });
  //     }

  //     return order;
  //   });

  //   return {
  //     id: result.id,
  //     code: result.code,
  //     userId: result.userId ?? undefined,
  //     items: normalizeItems(result.items),
  //     totals: normalizeTotals(result.totals),
  //     status: result.status as OrderStatus,
  //     address: normalizeAddress(result.address),
  //     notes: result.notes ?? undefined,
  //     placedAt: result.createdAt.toISOString(),
  //     estimatedDelivery: result.estimatedDelivery?.toISOString(),
  //     paymentMethod: result.paymentMethod as PaymentMethod | undefined,
  //     paymentStatus: result.paymentStatus as PaymentStatus | undefined,
  //     paymentId: result.paymentId ?? undefined,
  //   };
  // }

  /**
   * Delete an order (admin only)
   */
  async delete(orderId: string): Promise<void> {
    await prisma.order.delete({
      where: { id: orderId },
    });
  }
}

export const orderRepository = new OrderRepository();
