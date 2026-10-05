/**
 * Server-side Order Repository
 *
 * This repository handles all database operations for orders.
 * It uses Prisma to interact with the PostgreSQL database.
 */

import { prisma, toJsonColumn } from "@server/shared/prisma";
import { ORDER_STATUS, VISIBLE_ORDER_WHERE, PAYMENT_STATUS } from "@server/checkout/order.types";
import type { ShipmentItem } from "@server/checkout/order.types";
import { Order } from "@prisma/client";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { promotionService } from "@server/promotions/promotion.service";

/**
 * Order lines live in OrderItem/ShipmentItem rows (order-and-cart-lines), but the
 * wire keeps its flat items array. This include + mapper pair is how every read in
 * this domain rebuilds it: display fields from the product join (Restrict guarantees
 * the row), `price` = the unit price actually paid (TRD D2), and `thumbnail` = the
 * picture as it stood at purchase (product-video R17).
 */
// Nested lists are explicitly ordered: under relationLoadStrategy "join" an
// unordered nested list comes back in arbitrary order, and these are displayed.
export const SHIPMENT_LINES_INCLUDE = {
  items: {
    orderBy: { id: "asc" as const },
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
    thumbnail: string | null;
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
    // The snapshot wins. Falling back to the live product covers only rows written
    // before the column existed — the backfill filled those, so this is for orders
    // created in the window between migrating and deploying (product-video D19).
    thumbnail: row.orderItem.thumbnail ?? row.orderItem.product.thumbnail,
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
      relationLoadStrategy: "join",
      // The buyer does not see their own abandoned checkouts either: three attempts
      // at one purchase is one order, not three (checkout-abandonment R5).
      where: { userId, ...VISIBLE_ORDER_WHERE },
      orderBy: { createdAt: "desc" },
      include: {
        shipments: { orderBy: { code: "asc" as const }, include: SHIPMENT_LINES_INCLUDE },
      },
    });

    return orders.map(withWireItems);
  }

  /**
   * Which of these products this user has actually bought and paid for.
   *
   * The only question catalog asks of checkout (product-reviews R4, trd.md D8): the
   * **Verified purchase** mark is awarded from order history, so a reviewer can neither
   * claim it nor decline it. Paid only, and `VISIBLE_ORDER_WHERE` so an abandoned hold
   * on the same product awards nothing. Batched by product id to keep the question off
   * the per-row path. `"paid"` is the literal the rest of this domain uses for the
   * column documented at `prisma/schema.prisma:432`.
   */
  async purchasedProductIds(userId: string, productIds: string[]): Promise<string[]> {
    if (productIds.length === 0) return [];
    const rows = await prisma.orderItem.findMany({
      where: {
        productId: { in: productIds },
        order: { userId, paymentStatus: PAYMENT_STATUS.PAID, ...VISIBLE_ORDER_WHERE },
      },
      select: { productId: true },
      distinct: ["productId"],
    });
    return rows.map((row) => row.productId);
  }

  /**
   * Paid orders carrying at least one of this org's products — the shop's "orders fulfilled"
   * (brand-page R4, D2). Counted as orders, so a basket with three of the org's lines is one.
   * `VISIBLE_ORDER_WHERE` because the predicate is the rule, even though paid and expired are
   * mutually exclusive by construction (`confirmPaid`).
   */
  async countPaidForOrg(orgId: string): Promise<number> {
    return prisma.order.count({
      where: {
        paymentStatus: PAYMENT_STATUS.PAID,
        ...VISIBLE_ORDER_WHERE,
        items: { some: { product: { orgId } } },
      },
    });
  }

  /**
   * Find order by ID
   */
  async findById(orderId: string) {
    const order = await prisma.order.findUnique({
      relationLoadStrategy: "join",
      where: { id: orderId },
      include: {
        shipments: { orderBy: { code: "asc" as const }, include: SHIPMENT_LINES_INCLUDE },
      },
    });

    if (!order) {
      return null;
    }

    return withWireItems(order);
  }

  /**
   * Find order by code, for the unauthenticated guest-tracking lookup — the API
   * route takes no session, so anyone who has (or guesses) the code reaches this.
   * Returns a projection, not the raw row (checkout/CLAUDE.md "Order lookup returns
   * a projection"): userId, notes and gateway ids are dropped, and the address is
   * reduced to its geography — the name/phone/email/street-level fields are for the
   * order's owner only, not for anyone who merely knows its code.
   */
  async findByCode(code: string) {
    const order = await prisma.order.findUnique({
      relationLoadStrategy: "join",
      where: { code },
      select: {
        id: true,
        code: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        itemsTotal: true,
        shippingTotal: true,
        discount: true,
        grandTotal: true,
        createdAt: true,
        updatedAt: true,
        address: true,
        shipments: { orderBy: { code: "asc" as const }, include: SHIPMENT_LINES_INCLUDE },
      },
    });

    if (!order) {
      return null;
    }

    const rawAddress = order.address as
      | { city?: string; state?: string; pincode?: string; country?: string }
      | null;

    return {
      ...withWireItems(order),
      address: rawAddress
        ? {
            city: rawAddress.city,
            state: rawAddress.state,
            pincode: rawAddress.pincode,
            country: rawAddress.country,
          }
        : null,
    };
  }

  /**
   * The single write path to `paymentStatus: PAYMENT_STATUS.PAID` (ADR-0005). A conditional
   * update, not read-then-write: two confirmations racing (webhook and browser
   * return) resolve at the database — exactly one wins, the other sees count 0 and
   * re-reads to find out why.
   */
  async confirmPaid(orderId: string, paymentId: string): Promise<boolean> {
    const result = await prisma.order.updateMany({
      // Not paid, and not expired: an expired order's stock is already released, so
      // a late capture is refused here and refunded manually rather than confirming
      // an order the store may no longer be able to fulfil.
      where: { id: orderId, NOT: [{ paymentStatus: PAYMENT_STATUS.PAID }, { status: ORDER_STATUS.EXPIRED }] },
      data: {
        paymentStatus: PAYMENT_STATUS.PAID,
        status: ORDER_STATUS.CONFIRMED,
        paymentId,
      },
    });
    return result.count === 1;
  }

  /**
   * Orders stuck unpaid past the threshold — the sweep's worklist
   * (payment-confirmation D7). Capped: a long tail drains over several runs rather
   * than one slow one.
   *
   * No longer requires a gateway order. That filter was right when the sweep's only
   * question was "did the gateway capture this", but these rows are also holding
   * stock, and an order that never reached a gateway is one that certainly was not
   * paid for — the clearest release there is (checkout-abandonment D1).
   */
  async findStuckPendingOrders(olderThan: Date, limit = 20) {
    return prisma.order.findMany({
      where: {
        // "failed" is a failed *attempt*, not a dead order — the buyer may have
        // retried and a capture may exist, so the sweep must ask about these too.
        paymentStatus: { in: ["pending", "failed"] },
        status: { in: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.FAILED] },
        createdAt: { lt: olderThan },
      },
      select: { id: true, gatewayOrderId: true, grandTotal: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  /**
   * Unpaid orders past the hold window sitting on one of these products — the
   * worklist for a checkout that was just refused (checkout-abandonment D4). Capped
   * hard: this runs inside a buyer's request and each row costs a gateway call, and
   * releasing the few in their way is enough to let them through.
   */
  async findAbandonableHoldsForProducts(
    productIds: readonly string[],
    olderThan: Date,
    limit = 5
  ) {
    return prisma.order.findMany({
      where: {
        status: { in: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.FAILED] },
        NOT: { paymentStatus: PAYMENT_STATUS.PAID },
        createdAt: { lt: olderThan },
        items: { some: { productId: { in: [...productIds] } } },
      },
      select: { id: true },
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
        // status "failed" is legacy data: markPaymentFailed once set it terminally,
        // stranding the stock — those rows are healed here the same way.
        where: {
          id: orderId,
          status: { in: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.FAILED] },
          NOT: { paymentStatus: PAYMENT_STATUS.PAID },
        },
        data: { status: ORDER_STATUS.EXPIRED },
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

      // A coupon claim is held exactly like stock, so it comes back in the same
      // transaction (promotions D11). Releasing it afterwards would leave a window
      // where a "first 100" coupon had been spent by an order that no longer exists.
      // Promotions' own surface does the work — this passes it the transaction so
      // both releases commit or neither does.
      await promotionService.releaseForOrder(orderId, tx);

      return true;
    });
  }

  /**
   * Paid orders that produced no ledger entry (org-payouts D5).
   *
   * Recording an entry deliberately cannot fail a payment, which leaves the
   * possibility of a gap. A gap in a log line is one nobody finds, so it is a query.
   */
  async findPaidWithoutLedgerEntries(limit = 200): Promise<string[]> {
    const orders = await prisma.order.findMany({
      where: { paymentStatus: PAYMENT_STATUS.PAID, ledgerEntries: { none: {} } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return orders.map((order) => order.id);
  }

  /** The same question as a count — an unbounded list would be loaded to be measured. */
  async countPaidWithoutLedgerEntries(): Promise<number> {
    return await prisma.order.count({
      where: { paymentStatus: PAYMENT_STATUS.PAID, ledgerEntries: { none: {} } },
    });
  }

  /** Links the order to the gateway order created to charge it (payment-confirmation). */
  async attachGatewayOrder(orderId: string, gatewayOrderId: string): Promise<void> {
    await prisma.order.update({ where: { id: orderId }, data: { gatewayOrderId } });
  }

  /**
   * Record a failed payment attempt. Failure never overwrites success (a captured
   * payment beats a late failure signal), and the order deliberately stays
   * `pending_payment`: the gateway fires payment.failed per attempt and the buyer may
   * still retry, so the reservation holds until the sweep expires it. A terminal
   * status here once removed the order from every restock path (inventory-reservation R4).
   */
  async markPaymentFailed(orderId: string): Promise<boolean> {
    const result = await prisma.order.updateMany({
      where: { id: orderId, NOT: [{ paymentStatus: PAYMENT_STATUS.PAID }, { status: ORDER_STATUS.EXPIRED }] },
      data: { paymentStatus: PAYMENT_STATUS.FAILED },
    });
    return result.count === 1;
  }

  /** The order with its raw shipment rows, as booking needs them (no wire mapping). */
  async findForFulfilment(orderId: string) {
    return prisma.order.findUnique({
      relationLoadStrategy: "join",
      where: { id: orderId },
      include: { shipments: true },
    });
  }

  async recordFulfilmentStatus(orderId: string, status: string): Promise<void> {
    await prisma.order.update({
      where: { id: orderId },
      data: { status, updatedAt: new Date() },
    });
  }

  async markDelivered(orderId: string): Promise<void> {
    await prisma.order.update({
      where: { id: orderId },
      data: { status: ORDER_STATUS.DELIVERED },
    });
  }


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
