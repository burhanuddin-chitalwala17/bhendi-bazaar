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
import { priceLines, assembleOrderTotals, type PricedLine } from "@server/checkout/pricing";
import { promotionService } from "@server/promotions/promotion.service";
import { allocateAcrossOrgs, reservationPlan } from "@server/checkout/allocation";
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

    // What each organisation earned, recorded now that the money is real
    // (org-payouts D5). Idempotent per (order, org), so a replayed confirmation
    // cannot pay an organisation twice.
    //
    // A failure here must not unwind a confirmed payment — the gateway has already
    // taken the money, so refusing to confirm an order over a bookkeeping row is the
    // worse outcome. It therefore does not throw.
    //
    // What that leaves is a gap, and a gap living only in a log line is one nobody
    // finds. So the omission is queryable: `paidOrdersMissingEntries` returns exactly
    // these orders, the nightly reconcile sweep writes them, and the payout console
    // shows the count. The log is a breadcrumb, not the safety net.
    try {
      const { ledgerService } = await import("@server/payouts/ledger.service");
      await ledgerService.recordSale(orderId);
    } catch (error) {
      console.error(
        `[onPaymentConfirmed] ledger entry not written for order ${orderId} — the reconcile sweep will pick it up`,
        error
      );
    }

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
            price: true, weight: true, orgId: true,
            sizes: true, colors: true,
            // Offers target categories and resolve commission rates by ancestry, so
            // the line needs to know where in the tree it sits (ADR-0019).
            categoryId: true,
          },
        });
        const products = new Map(productRows.map((row) => [row.id, row]));

        // Merge duplicate variant lines across the client's parcel groups: pricing
        // and OrderItems are per line; the allocation below decides parcels afresh.
        const mergedLines = new Map<string, { productId: string; quantity: number; size?: string; color?: string }>();
        for (const group of input.shippingGroups) {
          for (const item of group.items) {
            const key = `${item.productId}::${item.size ?? ""}::${item.color ?? ""}`;
            const existing = mergedLines.get(key);
            if (existing) existing.quantity += item.quantity;
            else mergedLines.set(key, { ...item });
          }
        }
        const requestedLines = [...mergedLines.values()];
        const { lines: pricedLines, itemsTotal } = priceLines(requestedLines, products);

        // Offers, decided from persisted rows inside this transaction and at one
        // instant, so the preview and the charge are priced from the same moment
        // (ADR-0018). The request contributed a coupon *code* and nothing else: the
        // amount is computed here (Invariant 1, ADR-0002).
        const now = new Date();
        const discountableLines = pricedLines.map((line) => {
          const product = products.get(line.productId) as NonNullable<ReturnType<typeof products.get>>;
          return {
            key: `${line.productId}::${line.size ?? ""}::${line.color ?? ""}`,
            productId: line.productId,
            orgId: product.orgId,
            categoryId: product.categoryId,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
          };
        });
        // Also claims any coupon use with a conditional write, so a limited coupon
        // cannot be oversold by concurrent checkouts (promotions D11, ADR-0007).
        const discounts = await promotionService.applyToOrder(discountableLines, {
          code: input.couponCode,
          // A per-buyer limit needs an identity to count against; a guest order has
          // none, and the engine refuses such a code rather than exempting it.
          userId: input.userId ?? null,
          now,
          tx,
        });
        const discountByKey = new Map(discounts.lines.map((line) => [line.key, line]));

        // Where the stock actually is (active locations only): the same pure
        // allocation the checkout preview ran, now against the rows this transaction
        // will decrement — the decision is made here and persisted, never recomputed
        // later (stock-locations D6).
        const stockRows = await tx.productStock.findMany({
          where: {
            productId: { in: productIds },
            quantity: { gt: 0 },
            orgAddress: { isActive: true },
          },
          select: {
            productId: true,
            orgAddressId: true,
            quantity: true,
            orgAddress: {
              select: {
                orgId: true,
                address: { select: { pincode: true, city: true, state: true } },
              },
            },
          },
        });
        const locationInfo = new Map(stockRows.map((row) => [row.orgAddressId, row.orgAddress]));
        const locationPincodes = new Map(
          [...locationInfo.entries()].map(([id, info]) => [id, info.address.pincode])
        );
        const productNames = new Map(productRows.map((row) => [row.id, row.name]));

        // Allocate per org — a parcel's org is its location's org by construction,
        // which is what used to be the priceGroupItems ownership check. Same function
        // as the checkout preview, now against rows this transaction decrements.
        const productOrgs = new Map(productRows.map((row) => [row.id, row.orgId]));
        const parcels = allocateAcrossOrgs(
          requestedLines,
          productOrgs,
          stockRows,
          locationPincodes,
          input.address.pincode,
          productNames
        );

        // Match the customer's chosen rate to each allocated parcel by location
        // (groupId = orgAddressId since the allocate preview). A parcel without a
        // quoted group means availability moved since the preview — refuse rather
        // than ship a parcel nobody priced.
        const groupsByLocation = new Map(input.shippingGroups.map((g) => [g.groupId, g]));
        const pricedByKey = new Map(
          pricedLines.map((line) => [`${line.productId}::${line.size ?? ""}::${line.color ?? ""}`, line])
        );
        const plans = parcels.map((parcel) => {
          const group = groupsByLocation.get(parcel.orgAddressId);
          if (!group) {
            throw new ConflictError(
              "Availability changed while you were checking out. Please review your order and try again."
            );
          }
          const lines = parcel.lines.map((line) => ({
            ...(pricedByKey.get(`${line.productId}::${line.size ?? ""}::${line.color ?? ""}`) as PricedLine),
            quantity: line.quantity,
          }));
          const weight = lines.reduce(
            (sum, line) => sum + ((products.get(line.productId)?.weight ?? 0) * line.quantity),
            0
          );
          const parcelItemsTotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
          return {
            orgAddressId: parcel.orgAddressId,
            location: locationInfo.get(parcel.orgAddressId) as NonNullable<ReturnType<typeof locationInfo.get>>,
            rate: group.selectedRate,
            parcel,
            lines,
            weight,
            parcelItemsTotal,
          };
        });

        const totals = assembleOrderTotals(
          plans.map((plan) => ({ itemsTotal: plan.parcelItemsTotal, shippingRate: plan.rate.rate })),
          discounts.totalDiscountPaise
        );

        // R5: the customer confirms the number they saw. A mismatch means prices
        // changed mid-session — refuse rather than silently charge something else.
        if (totals.grandTotal !== input.displayedGrandTotal) {
          throw new ConflictError(
            "Prices changed while you were checking out. Please review your order and try again."
          );
        }

        // Reserve stock where it actually sits: the availability check IS the where
        // clause of the write (Invariant 6, ADR-0007), re-pointed from Product.stock
        // to the allocated (product, location) row (stock-locations TRD D7). Rows are
        // merged and sorted by reservationPlan so concurrent orders lock in the same
        // sequence; count === 0 rolls the whole order back.
        for (const { productId, orgAddressId, quantity } of reservationPlan(parcels)) {
          const reserved = await tx.productStock.updateMany({
            where: { productId, orgAddressId, quantity: { gte: quantity } },
            data: { quantity: { decrement: quantity } },
          });
          if (reserved.count === 0) {
            const name = productNames.get(productId) ?? "An item in your order";
            throw new ConflictError(
              `"${name}" just sold at its location while you were checking out. Please try again.`
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

        // 2. One shipment per allocated parcel (NO provider calls yet). The location
        // is persisted on the row (D6) and its address is snapshotted (D5): editing
        // the location later must not rewrite where this parcel came from. Pincode,
        // city and state all come from ONE location row — the mismatch where a
        // parcel carried one location's pincode beside another's city is no longer
        // expressible.
        const createdShipments = [] as Array<{ shipment: Awaited<ReturnType<typeof tx.shipment.create>>; lines: typeof plans[number]["lines"] }>;
        for (const [index, plan] of plans.entries()) {
          const shipment = await tx.shipment.create({
            data: {
              code: `${order.code}-SH${index + 1}`,
              orderId: order.id,
              orgId: plan.location.orgId,
              orgAddressId: plan.orgAddressId,
              fromPincode: plan.location.address.pincode,
              fromCity: plan.location.address.city,
              fromState: plan.location.address.state,
              shippingCost: plan.rate.rate,
              shippingProviderId: plan.rate.providerId,
              courierName: plan.rate.courierName,
              packageWeight: plan.weight,
              status: "pending", // Pending until fulfillment
              shippingMeta: {
                courierCode: plan.rate.courierCode,
                providerName: plan.rate.providerName,
                mode: plan.rate.mode,
                etd: plan.rate.etd,
                estimatedDays: plan.rate.estimatedDays,
              },
            },
          });
          createdShipments.push({ shipment, lines: plan.lines });
        }

        // One OrderItem per priced line; each parcel's ShipmentItem points at it, so
        // a line split across two locations stays linked to the one thing the
        // customer ordered (order-and-cart-lines R5 — exercised for the first time).
        //
        // `thumbnail` is frozen here beside `unitPrice`, from the same catalogue read
        // (product-video R17/D19): an org that later changes the product's cover
        // must not change what a completed order looks like. `pricedLines` already
        // carries it from the catalogue precisely so a client-sent one cannot become
        // history — this persists that value instead of re-deriving it on every read.
        const orderItemIdByKey = new Map<string, string>();
        for (const line of pricedLines) {
          const key = `${line.productId}::${line.size ?? ""}::${line.color ?? ""}`;
          const share = discountByKey.get(key);
          const created = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              thumbnail: line.thumbnail,
              size: line.size ?? null,
              color: line.color ?? null,
              // This line's allocated share, and the part of it the org bore. Both
              // are persisted rather than re-derived, because the ledger's commission
              // base is per line and the catalogue will have moved by settlement time
              // (ADR-0019, org-payouts D4c).
              discountPaise: share?.buyerDiscountPaise ?? 0,
              orgFundedPaise: share?.orgFundedPaise ?? 0,
            },
          });
          orderItemIdByKey.set(key, created.id);
        }

        // One attribution row per offer per organisation, carrying who funded what.
        // A database check asserts the two halves sum to the buyer's discount, so no
        // settlement can later be computed from a split that does not reconcile.
        for (const attribution of discounts.attributions) {
          await tx.orderDiscount.create({
            data: {
              orderId: order.id,
              promotionId: attribution.promotionId,
              orgId: attribution.orgId,
              labelSnapshot: attribution.labelSnapshot,
              codeSnapshot: attribution.codeSnapshot,
              buyerDiscountPaise: attribution.buyerDiscountPaise,
              orgFundedPaise: attribution.orgFundedPaise,
              platformFundedPaise: attribution.platformFundedPaise,
            },
          });
        }
        for (const { shipment, lines } of createdShipments) {
          for (const line of lines) {
            await tx.shipmentItem.create({
              data: {
                shipmentId: shipment.id,
                orderItemId: orderItemIdByKey.get(
                  `${line.productId}::${line.size ?? ""}::${line.color ?? ""}`
                ) as string,
                quantity: line.quantity,
              },
            });
          }
        }

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

