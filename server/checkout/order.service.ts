/**
 * Server-side Order Service
 *
 * This service encapsulates all business logic related to orders.
 * It acts as an intermediary between API routes and the repository layer.
 * 
 * Updated: Supports multi-origin shipping with separate shipments
 */

import { orderRepository } from "@server/checkout/order.repository";
import { prisma, toJsonColumn } from "@server/shared/prisma";
import { retryWithBackoff, NonRetryableError } from "@server/shared/retry";
import { createShipmentWithProvider } from "@server/shipping/providers/_placeholder/mock.booking";
import type {
  CreateOrderWithShipmentsInput,
  ServerOrderWithShipments,
} from "@server/checkout/order.types";
import { Order } from "@prisma/client";
import { isValidPincode, PINCODE_MESSAGE } from "@server/shared/pincode";
import { priceGroupItems, assembleOrderTotals } from "@server/checkout/pricing";
import { aggregateReservation } from "@server/checkout/reservation";
import type { OrderEmailView } from "@server/notifications/templates/purchaseConfirmationEmail";
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from "@server/shared/domain-error";

export class OrderService {
  /**
   * Get all orders for a user
   */
  async getOrdersByUserId(userId: string): Promise<Order[]> {
    return await orderRepository.listByUserId(userId);
  }

  /**
   * Get a single order by ID
   * Validates that the order belongs to the user (if userId provided)
   */
  async getOrderById(
    orderId: string,
    userId?: string
  ) {
    const order = await orderRepository.findById(orderId);

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    // If userId is provided, verify ownership
    if (userId && order.userId && order.userId !== userId) {
      throw new ForbiddenError("Unauthorized: Order does not belong to user");
    }

    return order;
  }

  /**
   * Lookup order by code (for guest orders)
   * This allows guests to track their order using the order code
   */
  async lookupOrderByCode(code: string): Promise<Order | null> {
    return await orderRepository.findByCode(code);
  }



  /**
   * Side effects of an order becoming paid — reached exactly once per order, because
   * the caller is the conditional transition (payment-confirmation D3). The
   * confirmation email moves here from updateOrder, where it fired on whoever
   * happened to write the status. Fulfilment is deliberately NOT triggered here:
   * booking is a placeholder until shipping-fulfilment, and a failed booking must
   * never look like a failed payment.
   */
  async onPaymentConfirmed(orderId: string): Promise<void> {
    const order = await orderRepository.findById(orderId);
    if (!order) return;

    const deliveryAddress = order.address as OrderEmailView["address"] | null;
    if (deliveryAddress?.email) {
      const { emailService } = await import("@server/notifications/email.service");
      emailService
        .sendPurchaseConfirmationEmail(
          {
            id: order.id,
            code: order.code,
            status: order.status,
            paymentStatus: order.paymentStatus,
            createdAt: order.createdAt,
            notes: order.notes,
            itemsTotal: order.itemsTotal,
            discount: order.discount,
            grandTotal: order.grandTotal,
            address: deliveryAddress,
            shipments: order.shipments.map((s) => ({
              estimatedDelivery: s.estimatedDelivery?.toISOString(),
            })),
          },
          deliveryAddress.email
        )
        .catch((error) => {
          console.error("Failed to send purchase confirmation email:", error);
          // Email failure must not unwind a confirmed payment.
        });
    }
  }

  /**
   * Delete an order (admin only)
   */
  async deleteOrder(orderId: string): Promise<void> {
    await orderRepository.delete(orderId);
  }

  /**
   * Create a new order with multiple shipments
   * 
   * Flow:
   * 1. Validate input
   * 2. Create Order record (status: pending_payment)
   * 3. Create Shipment records (status: pending)
   * 4. Return order with shipments
   * 
   * Note: Provider integration (AWB, pickup) happens AFTER payment
   * via fulfillOrder() method
   */
  async createOrderWithShipments(
    input: CreateOrderWithShipmentsInput
  ): Promise<ServerOrderWithShipments> {
    // Validate input
    this.validateCreateOrderWithShipmentsInput(input);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Generate unique order code
        const orderCode = await this.generateOrderCode();

        // Price everything from the catalogue, inside this transaction, so the price
        // used for the total is the price checked against the catalogue (Invariant 1,
        // trd.md). The request contributed product ids and quantities; nothing more.
        const productIds = [
          ...new Set(input.shippingGroups.flatMap((g) => g.items.map((i) => i.productId))),
        ];
        const productRows = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true, name: true, slug: true, thumbnail: true,
            price: true, salePrice: true, weight: true, orgId: true,
            sizes: true, colors: true,
          },
        });
        const products = new Map(productRows.map((row) => [row.id, row]));

        const pricedGroups = input.shippingGroups.map((group) => ({
          group,
          pricing: priceGroupItems(group.items, products, group.orgId),
        }));

        const totals = assembleOrderTotals(
          pricedGroups.map(({ group, pricing }) => ({
            itemsTotal: pricing.itemsTotal,
            shippingRate: group.selectedRate.rate,
          }))
        );

        // R5: the customer confirms the number they saw. A mismatch means prices
        // changed mid-session — refuse rather than silently charge something else.
        if (totals.grandTotal !== input.displayedGrandTotal) {
          throw new ConflictError(
            "Prices changed while you were checking out. Please review your order and try again."
          );
        }

        // Reserve stock: the availability check IS the where clause of the write
        // (Invariant 6, ADR-0007) — there is no interval in which two checkouts can
        // both believe the last unit is theirs. count === 0 means unavailable, and
        // the throw rolls back the whole transaction: no order without its stock
        // movement, no stock movement without its order (R2).
        for (const { productId, quantity } of aggregateReservation(input.shippingGroups)) {
          const reserved = await tx.product.updateMany({
            where: { id: productId, stock: { gte: quantity } },
            data: { stock: { decrement: quantity } },
          });
          if (reserved.count === 0) {
            // Post-failure read is for the message only — the guard already decided.
            const row = await tx.product.findUnique({
              where: { id: productId },
              select: { name: true, stock: true },
            });
            const name = row?.name ?? "An item in your order";
            throw new ConflictError(
              row && row.stock > 0
                ? `Only ${row.stock} left of "${name}" — you asked for ${quantity}. Please adjust your cart.`
                : `"${name}" is out of stock. Please remove it from your cart.`
            );
          }
        }

        // R6: the bought items leave the cart in the same transaction, so a closed
        // tab cannot leave a cart that has already been purchased.
        if (input.userId) {
          await tx.cart.deleteMany({ where: { userId: input.userId } });
        }

        // 1. Create the main order (pending payment)
        const order = await tx.order.create({
          data: {
            code: orderCode,
            userId: input.userId || null,
            address: toJsonColumn(input.address),
            notes: input.notes,
            itemsTotal: totals.itemsTotal,
            shippingTotal: totals.shippingTotal,
            discount: totals.discount,
            grandTotal: totals.grandTotal,
            paymentMethod: input.paymentMethod,
            // Never from the request: payment state has exactly one writer (Invariant 2).
            paymentStatus: "pending",
            status: "pending_payment", // Order is pending until payment
          },
        });

        // 2. Create shipments for each group (NO provider calls yet)
        const createdShipments = await Promise.all(
          pricedGroups.map(async ({ group, pricing }, index) => {
            const shipmentCode = `${order.code}-SH${index + 1}`;

            // Create the shipment record (pending state)
            const shipment = await tx.shipment.create({
              data: {
                code: shipmentCode,
                orderId: order.id,
                orgId: group.orgId,
                fromPincode: group.fromPincode,
                fromCity: group.fromCity,
                fromState: group.fromState,
                shippingCost: group.selectedRate.rate,
                shippingProviderId: group.selectedRate.providerId,
                courierName: group.selectedRate.courierName,
                packageWeight: pricing.totalWeight,
                status: "pending", // Pending until fulfillment
                shippingMeta: {
                  courierCode: group.selectedRate.courierCode,
                  providerName: group.selectedRate.providerName,
                  mode: group.selectedRate.mode,
                  etd: group.selectedRate.etd,
                  estimatedDays: group.selectedRate.estimatedDays,
                },
              },
            });
            // One OrderItem per server-priced line, its ShipmentItem 1:1 (TRD D1) —
            // a split into more parcels is expressible later without a new shape.
            // Names and prices came from the catalogue row, not the request.
            for (const line of pricing.items) {
              await tx.orderItem.create({
                data: {
                  orderId: order.id,
                  productId: line.productId,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  size: line.size ?? null,
                  color: line.color ?? null,
                  shipmentItems: {
                    create: [{ shipmentId: shipment.id, quantity: line.quantity }],
                  },
                },
              });
            }

            return { shipment, lines: pricing.items };
          })
        );

        // Return order with shipments in the expected format. Line shape matches
        // what reads rebuild from rows: price = the unit price actually paid (D2).
        return {
          ...order,
          shipments: createdShipments.map(({ shipment: s, lines }) => ({
            id: s.id,
            code: s.code,
            orderId: s.orderId,
            items: lines.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              productSlug: line.productSlug,
              thumbnail: line.thumbnail,
              price: line.unitPrice,
              quantity: line.quantity,
              size: line.size,
              color: line.color,
            })),
            orgId: s.orgId,
            fromPincode: s.fromPincode,
            fromCity: s.fromCity,
            fromState: s.fromState,
            shippingCost: s.shippingCost,
            shippingProviderId: s.shippingProviderId || undefined,
            courierName: s.courierName || undefined,
            trackingNumber: s.trackingNumber || undefined,
            trackingUrl: s.trackingUrl || undefined,
            status: s.status,
            estimatedDelivery: s.estimatedDelivery?.toISOString(),
            createdAt: s.createdAt.toISOString(),
          })),
        } as ServerOrderWithShipments;
      });

      return result;
    } catch (error) {
      console.error("Failed to create order with shipments:", error);
      throw error;
    }
  }

  /**
   * Fulfill order after successful payment
   * 
   * This method is called AFTER payment confirmation to:
   * 1. Create shipments with shipping providers
   * 2. Generate AWB numbers
   * 3. Schedule pickups
   * 4. Update shipment tracking info
   * 
   * Uses retry logic for resilience against provider API failures
   */
  async fulfillOrder(orderId: string): Promise<void> {
    // Get order with shipments
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { shipments: true },
    });

    if (!order) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    // Verify payment is confirmed
    if (order.paymentStatus !== "paid") {
      throw new NonRetryableError(
        `Cannot fulfill order ${order.code}: Payment not confirmed (status: ${order.paymentStatus})`
      );
    }

    const fulfillmentResults = {
      successful: [] as string[],
      failed: [] as { shipmentId: string; code: string; error: string }[],
    };

    // Process each shipment
    for (const shipment of order.shipments) {
      try {
        // Call provider API with retry logic
        const providerResult = await retryWithBackoff(
          async () => {
            return await createShipmentWithProvider(
              shipment.id,
              shipment.shippingProviderId!,
              {
                courierCode: (shipment.shippingMeta as { courierCode?: string } | null)?.courierCode,
                weight: shipment.packageWeight!,
                fromPincode: shipment.fromPincode,
                toPincode: (order.address as { pincode: string }).pincode,
              }
            );
          },
          {
            maxRetries: 3,
            baseDelay: 1000,
            exponentialBackoff: true,
            onRetry: (error, attempt) => {
              console.log(`   ⚠️  Retry ${attempt}/3: ${error.message}`);
            },
          }
        );

        // Update shipment with tracking info
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            trackingNumber: providerResult.awb,
            trackingUrl: providerResult.trackingUrl,
            status: "confirmed", // Now confirmed with provider
            updatedAt: new Date(),
          },
        });

        fulfillmentResults.successful.push(shipment.code);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        fulfillmentResults.failed.push({
          shipmentId: shipment.id,
          code: shipment.code,
          error: errorMessage,
        });

        // Update shipment to failed state (requires manual intervention)
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            status: "failed",
            shippingMeta: toJsonColumn({
              ...(shipment.shippingMeta as Record<string, unknown> | null),
              fulfillmentError: errorMessage,
              requiresManualIntervention: true,
              failedAt: new Date().toISOString(),
            }),
            updatedAt: new Date(),
          },
        });
      }
    }

    // Update order status based on fulfillment results
    let finalOrderStatus: string;

    if (fulfillmentResults.failed.length === 0) {
      // All shipments fulfilled successfully
      finalOrderStatus = "confirmed";
    } else if (fulfillmentResults.successful.length === 0) {
      // All shipments failed
      finalOrderStatus = "fulfillment_failed";
    } else {
      // Partial fulfillment
      finalOrderStatus = "partially_fulfilled";
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: finalOrderStatus,
        updatedAt: new Date(),
      },
    });

    // If there are failures, log them for monitoring/alerting
    if (fulfillmentResults.failed.length > 0) {
      fulfillmentResults.failed.forEach(f => {
        console.error(`   - ${f.code}: ${f.error}`);
      });
    }
  }

  /**
   * Generate a unique order code
   */
  private async generateOrderCode(): Promise<string> {
    // Format: BB-NNNN (e.g., BB-1001)
    const latestOrder = await prisma.order.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { code: true },
    });

    let nextNumber = 1001;
    if (latestOrder && latestOrder.code) {
      const match = latestOrder.code.match(/BB-(\d+)/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }

    return `BB-${nextNumber}`;
  }

  /**
   * Validate order with shipments input
   */
  private validateCreateOrderWithShipmentsInput(
    input: CreateOrderWithShipmentsInput
  ): void {
    // Validate shipping groups
    if (!input.shippingGroups || input.shippingGroups.length === 0) {
      throw new DomainError("Order must contain at least one shipping group");
    }

    for (const group of input.shippingGroups) {
      // Validate items in group
      if (!group.items || group.items.length === 0) {
        throw new DomainError(`Shipping group ${group.groupId} has no items`);
      }

      for (const item of group.items) {
        if (!item.productId) {
          throw new DomainError("Invalid item data: missing product");
        }
        if (item.quantity <= 0) {
          throw new DomainError("Item quantity must be greater than 0");
        }
        // No price check: items arrive unpriced and are priced from the catalogue.
      }

      // Validate shipping rate selection
      if (!group.selectedRate) {
        throw new DomainError(`Shipping group ${group.groupId} has no selected rate`);
      }

      if (!group.selectedRate.providerId || !group.selectedRate.courierName) {
        throw new DomainError(`Invalid shipping rate for group ${group.groupId}`);
      }

      if (group.selectedRate.rate < 0) {
        throw new DomainError("Shipping rate cannot be negative");
      }
    }

    // Validate address
    if (!input.address) {
      throw new DomainError("Shipping address is required");
    }

    const { fullName, mobile, addressLine1, city, state, pincode, country } =
      input.address;

    if (
      !fullName ||
      !mobile ||
      !addressLine1 ||
      !city ||
      !state ||
      !pincode ||
      !country
    ) {
      throw new DomainError("Address is missing required fields");
    }

    // Validate phone format
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(mobile)) {
      throw new DomainError("Phone number must be 10 digits");
    }

    // Validate postal code
    if (!isValidPincode(pincode)) {
      throw new Error(PINCODE_MESSAGE);
    }
  }

}

export const orderService = new OrderService();

