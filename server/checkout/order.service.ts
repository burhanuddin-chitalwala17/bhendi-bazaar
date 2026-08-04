/**
 * Server-side Order Service
 *
 * This service encapsulates all business logic related to orders.
 * It acts as an intermediary between API routes and the repository layer.
 * 
 * Updated: Supports multi-origin shipping with separate shipments
 */

import { orderRepository } from "@server/checkout/order.repository";
import { prisma } from "@server/shared/prisma";
import { retryWithBackoff, NonRetryableError } from "@server/shared/retry";
import { createShipmentWithProvider } from "@server/shipping/providers/_placeholder/mock.booking";
import type {
  CreateOrderInput,
  UpdateOrderInput,
  CreateOrderWithShipmentsInput,
  ServerOrderWithShipments,
} from "@server/checkout/order.types";
import { Order } from "@prisma/client";
import { isValidPincode, PINCODE_MESSAGE } from "@server/shared/pincode";

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
      throw new Error("Order not found");
    }

    // If userId is provided, verify ownership
    if (userId && order.userId && order.userId !== userId) {
      throw new Error("Unauthorized: Order does not belong to user");
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
   * Create a new order with validation
   */
  async createOrder(input: CreateOrderInput): Promise<boolean> {
    // Validate input
    this.validateCreateOrderInput(input);

    try {
      await orderRepository.create(input);
      return true;
    } catch (error) {
      console.error("Failed to create order:", error);
      return false;
    }
  }

  /**
   * Update an existing order
   */
  async updateOrder(
    orderId: string,
    input: UpdateOrderInput,
    userId?: string
  ): Promise<boolean> {
    // First, get the order to verify ownership
    const existingOrder = await this.getOrderById(orderId, userId);

    if (!existingOrder) {
      throw new Error("Order not found");
    }

    // Check if payment status is changing to "paid"
    const isPaymentCompleted =
      input.paymentStatus === "paid" && existingOrder.paymentStatus !== "paid";

    // Update the order
    const updated = await orderRepository.update(orderId, input);

    if (!updated) {
      throw new Error("Failed to update order");
    }

    // Send purchase confirmation email when payment is completed
    if (isPaymentCompleted && existingOrder.address && (existingOrder.address as any).email) {
      const { emailService } = await import("@server/notifications/email.service");

      emailService
        .sendPurchaseConfirmationEmail(existingOrder, (existingOrder.address as any).email)
        .catch((error) => {
          console.error("Failed to send purchase confirmation email:", error);
          // Don't throw - email failure shouldn't block order update
        });
    }

    return updated;
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


        // 1. Create the main order (pending payment)
        const order = await tx.order.create({
          data: {
            code: orderCode,
            userId: input.userId || null,
            address: input.address as any,
            notes: input.notes,
            itemsTotal: input.totals.itemsTotal,
            shippingTotal: input.totals.shippingTotal,
            discount: input.totals.discount,
            grandTotal: input.totals.grandTotal,
            paymentMethod: input.paymentMethod,
            paymentStatus: input.paymentStatus || "pending",
            status: "pending_payment", // Order is pending until payment
          },
        });

        // 2. Create shipments for each group (NO provider calls yet)
        const createdShipments = await Promise.all(
          input.shippingGroups.map(async (group, index) => {
            const shipmentCode = `${order.code}-SH${index + 1}`;

            console.log(`📦 Creating Shipment ${index + 1}/${input.shippingGroups.length}: ${shipmentCode}`);

            // Create the shipment record (pending state)
            const shipment = await tx.shipment.create({
              data: {
                code: shipmentCode,
                orderId: order.id,
                items: group.items as any,
                sellerId: group.sellerId,
                fromPincode: group.fromPincode,
                fromCity: group.fromCity,
                fromState: group.fromState,
                shippingCost: group.selectedRate.rate,
                shippingProviderId: group.selectedRate.providerId,
                courierName: group.selectedRate.courierName,
                packageWeight: group.totalWeight,
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
            return shipment;
          })
        );

        // Return order with shipments in the expected format
        return {
          ...order,
          shipments: createdShipments.map(s => ({
            id: s.id,
            code: s.code,
            orderId: s.orderId,
            items: s.items as any,
            sellerId: s.sellerId,
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
      throw new Error(`Order not found: ${orderId}`);
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
                courierCode: (shipment.shippingMeta as any)?.courierCode,
                weight: shipment.packageWeight!,
                fromPincode: shipment.fromPincode,
                toPincode: (order.address as any).pincode,
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
            shippingMeta: {
              ...(shipment.shippingMeta as any),
              fulfillmentError: errorMessage,
              requiresManualIntervention: true,
              failedAt: new Date().toISOString(),
            } as any,
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
      throw new Error("Order must contain at least one shipping group");
    }

    for (const group of input.shippingGroups) {
      // Validate items in group
      if (!group.items || group.items.length === 0) {
        throw new Error(`Shipping group ${group.groupId} has no items`);
      }

      for (const item of group.items) {
        if (!item.productId || !item.productName) {
          throw new Error("Invalid item data: missing required fields");
        }
        if (item.quantity <= 0) {
          throw new Error("Item quantity must be greater than 0");
        }
        if (item.price < 0) {
          throw new Error("Item price cannot be negative");
        }
      }

      // Validate shipping rate selection
      if (!group.selectedRate) {
        throw new Error(`Shipping group ${group.groupId} has no selected rate`);
      }

      if (!group.selectedRate.providerId || !group.selectedRate.courierName) {
        throw new Error(`Invalid shipping rate for group ${group.groupId}`);
      }

      if (group.selectedRate.rate < 0) {
        throw new Error("Shipping rate cannot be negative");
      }
    }

    // Validate totals
    if (!input.totals) {
      throw new Error("Order totals are required");
    }

    if (input.totals.grandTotal <= 0) {
      throw new Error("Order total must be greater than 0");
    }

    // Validate address
    if (!input.address) {
      throw new Error("Shipping address is required");
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
      throw new Error("Address is missing required fields");
    }

    // Validate phone format
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(mobile)) {
      throw new Error("Phone number must be 10 digits");
    }

    // Validate postal code
    if (!isValidPincode(pincode)) {
      throw new Error(PINCODE_MESSAGE);
    }
  }

  /**
   * Validate order creation input
   */
  private validateCreateOrderInput(input: CreateOrderInput): void {
    // Validate items
    if (!input.items || input.items.length === 0) {
      throw new Error("Order must contain at least one item");
    }

    for (const item of input.items) {
      if (!item.productId || !item.productName || !item.thumbnail) {
        throw new Error("Invalid item data: missing required fields");
      }
      if (item.quantity <= 0) {
        throw new Error("Item quantity must be greater than 0");
      }
      if (item.price < 0) {
        throw new Error("Item price cannot be negative");
      }
    }

    // Validate totals
    if (!input.itemsTotal || !input.shippingTotal || !input.discount || !input.grandTotal) {
      throw new Error("Order totals are required");
    }
    if (input.itemsTotal + input.shippingTotal - input.discount <= 0) {
      throw new Error("Order total must be greater than 0");
    }

    // Validate address
    if (!input.address) {
      throw new Error("Shipping address is required");
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
      throw new Error("Address is missing required fields");
    }

    // Validate phone format (basic validation)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(mobile)) {
      throw new Error("Phone number must be 10 digits");
    }

    // Validate postal code (basic validation)
    if (!isValidPincode(pincode)) {
      throw new Error(PINCODE_MESSAGE);
    }
  }
}

export const orderService = new OrderService();

