/**
 * Server-side Order Repository
 *
 * This repository handles all database operations for orders.
 * It uses Prisma to interact with the PostgreSQL database.
 */

import { prisma, toJsonColumn } from "@server/shared/prisma";
import type {
  CreateOrderInput,
} from "@server/checkout/order.types";
import { Order } from "@prisma/client";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";

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
  async listByUserId(userId: string): Promise<Order[]> {
    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        shipments: true,
      },
    });

    return orders;
  }

  /**
   * Find order by ID
   */
  async findById(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        shipments: true,
      },
    });

    if (!order) {
      return null;
    }

    return order;
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
   * Create a new order with automatic stock deduction
   */
  async create(input: CreateOrderInput): Promise<boolean> {
    // Use Prisma transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Validate and check stock availability for all items
      for (const item of input.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, name: true },
        });

        if (!product) {
          throw new NotFoundError(`Product not found: ${item.productId}`);
        }

        if (product.stock < item.quantity) {
          throw new ConflictError(`Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${item.quantity}`);
        }
      }

      // Step 2: Generate code
      const code = generateOrderCode();

      // Step 4: Create the order
      const order = await tx.order.create({
        data: {
          code,
          userId: input.userId ?? null,
          itemsTotal: input.itemsTotal,
          shippingTotal: input.shippingTotal,
          discount: input.discount,
          grandTotal: input.grandTotal,
          status: "processing",
          address: toJsonColumn(input.address),
          notes: input.notes ?? null,
          paymentMethod: input.paymentMethod ?? null,
          paymentStatus: input.paymentStatus ?? "pending",
          paymentId: input.paymentId ?? null,
        },
      });

      // Step 5: Decrement stock for each item
      for (const item of input.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      return order;
    });

    // Return normalized order
    return true;
  }

  /**
   * Update an existing order
   */
  /**
   * The single write path to `paymentStatus: "paid"` (ADR-0005). A conditional
   * update, not read-then-write: two confirmations racing (webhook and browser
   * return) resolve at the database — exactly one wins, the other sees count 0 and
   * re-reads to find out why.
   */
  async confirmPaid(orderId: string, paymentId: string): Promise<boolean> {
    const result = await prisma.order.updateMany({
      where: { id: orderId, NOT: { paymentStatus: "paid" } },
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
