/**
 * Server-side Order Service
 *
 * This service encapsulates all business logic related to orders.
 * It acts as an intermediary between API routes and the repository layer.
 * 
 * Updated: Supports multi-origin shipping with separate shipments
 */

import { orderRepository } from "@server/checkout/order.repository";
import { generateOrderCode } from "@server/checkout/order-code";
import { prisma, toJsonColumn } from "@server/shared/prisma";
import { retryWithBackoff, NonRetryableError } from "@server/shared/retry";
import { createShipmentWithProvider } from "@server/shipping/providers/_placeholder/mock.booking";
import {
  createShipmentForOrder,
  createShipmentItemsForOrder,
  recordBooking,
  recordBookingFailure,
} from "@server/shipping/shipment-status.service";
import { billableWeightKg } from "@server/shipping/billable-weight";
import { verifyRateQuote } from "@server/shipping/rate-quote.service";
import type {
  CreateOrderWithShipmentsInput,
  ServerOrderWithShipments,
} from "@server/checkout/order.types";
import { Order, Prisma } from "@prisma/client";
import { isValidPincode, PINCODE_MESSAGE } from "@server/shared/pincode";
import { isValidPhone, PHONE_MESSAGE } from "@server/shared/phone";
import { priceLines, assembleOrderTotals, type PricedLine } from "@server/checkout/pricing";
import { applyOffersToBasket, lineKey } from "@server/checkout/basket-discounts";
import { allocateAcrossOrgs } from "@server/checkout/allocation";
import { assertLinesAreSaleable } from "@server/checkout/sale-gates";
import { catalogueFacts, reserveStock, stockOnHand } from "@server/checkout/reservation";
import { cartService } from "@server/cart/cart.service";
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from "@server/shared/domain-error";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";

/**
 * A `code` collision, which is the only reason to retry a whole order. With 30^8
 * possibilities this should never be seen; if it becomes common, the randomness is
 * broken and a silent retry loop would be the thing hiding it.
 */
function isDuplicateOrderCode(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    String(error.meta?.target ?? "").includes("code")
  );
}

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
  /**
   * Which of these products this user has bought — checkout's answer to catalog's one
   * question (product-reviews R4, trd.md D8).
   *
   * Exported here rather than letting catalog join `OrderItem` itself: analytics is the
   * documented exception to no-cross-domain-reads, and this is not analytics.
   */
  async hasPurchased(userId: string, productIds: string[]): Promise<Set<string>> {
    return new Set(await orderRepository.purchasedProductIds(userId, productIds));
  }

  /**
   * How many paid orders carried this org's goods — the brand page's "orders fulfilled"
   * (brand-page D2). On the service for the same reason as `hasPurchased`: catalog asks
   * checkout a question rather than joining `Order` itself (ADR-0033).
   */
  async paidOrderCountForOrg(orgId: string): Promise<number> {
    return await orderRepository.countPaidForOrg(orgId);
  }

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
   * This allows guests to track their order using the order code. Unauthenticated
   * by design, so the repository returns a projection rather than the raw row
   * (checkout/CLAUDE.md) — this return type follows that shape rather than the
   * full prisma `Order`.
   */
  async lookupOrderByCode(code: string): Promise<Awaited<ReturnType<typeof orderRepository.findByCode>>> {
    return await orderRepository.findByCode(code);
  }



  /**
   * Paid orders that produced no ledger entry, and how many there are (org-payouts D5).
   *
   * Exposed on the service because `payouts` needs to ask it and a repository is never another
   * domain's to call ([ADR-0033](../../docs/adr/0033-a-domain-is-reached-through-its-public-surface.md)).
   * The query lives in checkout because checkout owns `prisma.order` ([ADR-0003]) — the join to
   * `OrgLedgerEntry` does not make it a payouts query, it makes it a question payouts asks.
   *
   * Deliberately **not** filtered by `VISIBLE_ORDER_WHERE`: this is a sweep worklist, the
   * documented exemption in `order.types.ts`. It is also moot — `confirmPaid` refuses an expired
   * order and the release path refuses a paid one, so paid and expired are mutually exclusive by
   * construction.
   */
  async paidOrdersMissingLedgerEntries(limit = 200): Promise<string[]> {
    return await orderRepository.findPaidWithoutLedgerEntries(limit);
  }

  async countPaidOrdersMissingLedgerEntries(): Promise<number> {
    return await orderRepository.countPaidWithoutLedgerEntries();
  }

  /**
   * Side effects of an order becoming paid. The work lives in `payment-confirmed.ts`, which is
   * where the ledger, identity and notifications meet — three reasons to change that do not
   * belong to the order service.
   */
  async onPaymentConfirmed(orderId: string): Promise<void> {
    const { onPaymentConfirmed } = await import("@server/checkout/payment-confirmed");
    return onPaymentConfirmed(orderId);
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
    input: CreateOrderWithShipmentsInput,
    /** Internal: one retry is spent on a code collision (ADR-0025), never on anything else. */
    retriesLeft = 1
  ): Promise<ServerOrderWithShipments> {
    // Validate input
    this.validateCreateOrderWithShipmentsInput(input);

    try {
      const orderCode = generateOrderCode();
      const result = await prisma.$transaction(async (tx) => {

        // Price everything from the catalogue, inside this transaction, so the price
        // used for the total is the price checked against the catalogue (Invariant 1,
        // trd.md). The request contributed product ids and quantities; nothing more.
        const productIds = [
          ...new Set(input.shippingGroups.flatMap((g) => g.items.map((i) => i.productId))),
        ];
        const productRows = await catalogueFacts(productIds, tx);
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
        // `basket-discounts.ts` owns the shape translation and the coupon claim; see its header
        // for why both belong inside this transaction.
        const { discounts, discountByKey } = await applyOffersToBasket({
          pricedLines,
          products,
          couponCode: input.couponCode,
          userId: input.userId ?? null,
          now,
          tx,
        });

        // Where the stock actually is (active locations only): the same pure
        // allocation the checkout preview ran, now against the rows this transaction
        // will decrement — the decision is made here and persisted, never recomputed
        // later (stock-locations D6).
        const stockRows = await stockOnHand(productIds, tx);
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
          const location = locationInfo.get(parcel.orgAddressId) as NonNullable<ReturnType<typeof locationInfo.get>>;
          return {
            orgAddressId: parcel.orgAddressId,
            location,
            // The charge is what the server quoted for this origin, address and weight, read
            // from its own signature — never a figure the request carried (Invariant 1).
            rate: verifyRateQuote(group.selectedRate.quote, {
              fromPincode: location.address.pincode,
              toPincode: input.address.pincode,
              billableWeightKg: billableWeightKg(weight),
            }),
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
        // clause of the write (Invariant 6, ADR-0007), on the allocated (product,
        // location) rows (stock-locations TRD D7). A miss rolls the whole order back.
        await reserveStock(parcels, productNames, tx);

        // Deliberately **after** the reservation above — `sale-gates.ts` explains why the
        // lock ordering makes this the only race-safe point, and the only one that can
        // refuse at all.
        await assertLinesAreSaleable(productIds, now, tx);

        // R6: the bought lines leave the cart in the same transaction, so a closed
        // tab cannot leave a cart that has already been purchased. Only those lines —
        // Buy Now and a mid-checkout sign-in both leave others there (seamless-sign-in D12).
        if (input.userId) {
          await cartService.removeBoughtLinesIn(tx, input.userId, requestedLines);
        }

        // 1. Create the main order (pending payment)
        const order = await orderRepository.createInTransaction(
          {
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
            paymentStatus: PAYMENT_STATUS.PENDING,
            status: ORDER_STATUS.PENDING_PAYMENT,
          },
          tx,
        );

        // 2. One shipment per allocated parcel (NO provider calls yet). The location
        // is persisted on the row (D6) and its address is snapshotted (D5): editing
        // the location later must not rewrite where this parcel came from. Pincode,
        // city and state all come from ONE location row — the mismatch where a
        // parcel carried one location's pincode beside another's city is no longer
        // expressible.
        const createdShipments = [] as Array<{
          shipment: Awaited<ReturnType<typeof createShipmentForOrder>>;
          lines: typeof plans[number]["lines"];
        }>;
        for (const [index, plan] of plans.entries()) {
          const shipment = await createShipmentForOrder(
            {
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
            tx,
          );
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
        // Written in one statement rather than one per line. Every statement here is a
        // billed operation AND is held inside the transaction that already holds the
        // guarded stock decrement's row locks (ADR-0007), so the loop cost checkout
        // throughput as well as money. Measured on a six-line, one-parcel order: 28
        // statements before, 18 after — `OrderItem` 6 inserts to 1, `ShipmentItem` 6 to 1.
        // The saving grows with the basket; the lock is held for all of it.
        //
        // `createManyAndReturn` because the ids ARE needed below — but keyed off each
        // returned row's own fields, never its position, so nothing depends on the
        // driver returning rows in the order they were sent.
        const createdItems = await orderRepository.createLines(
          pricedLines.map((line) => {
            const share = discountByKey.get(lineKey(line));
            return {
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
            };
          }),
          tx,
        );

        const orderItemIdByKey = new Map(
          createdItems.map((item) => [lineKey(item), item.id])
        );

        // One attribution row per offer per organisation, carrying who funded what.
        // A database check asserts the two halves sum to the buyer's discount, so no
        // settlement can later be computed from a split that does not reconcile.
        await orderRepository.recordDiscountAttributions(
          discounts.attributions.map((attribution) => ({
            orderId: order.id,
            promotionId: attribution.promotionId,
            orgId: attribution.orgId,
            labelSnapshot: attribution.labelSnapshot,
            codeSnapshot: attribution.codeSnapshot,
            buyerDiscountPaise: attribution.buyerDiscountPaise,
            orgFundedPaise: attribution.orgFundedPaise,
            platformFundedPaise: attribution.platformFundedPaise,
          })),
          tx,
        );

        const shipmentItems = createdShipments.flatMap(({ shipment, lines }) =>
          lines.map((line) => ({
            shipmentId: shipment.id,
            // An absent id would mean a parcel referencing a line this order never
            // priced — an allocation bug, and silently writing null is how it would
            // reach settlement unnoticed.
            orderItemId: orderItemIdByKey.get(lineKey(line)) as string,
            quantity: line.quantity,
          }))
        );
        if (shipmentItems.some((item) => !item.orderItemId)) {
          throw new Error("Allocated a parcel line that has no priced order item");
        }
        await createShipmentItemsForOrder(shipmentItems, tx);

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
      if (isDuplicateOrderCode(error) && retriesLeft > 0) {
        // A fresh code, and the whole order again — nothing from the rolled-back
        // transaction survives to be reused.
        return this.createOrderWithShipments(input, retriesLeft - 1);
      }
      console.error("Failed to create order with shipments:", error);
      throw error;
    }
  }

  /** Every parcel has arrived. The caller (the carrier webhook) decides that from the shipment rows. */
  async markDelivered(orderId: string): Promise<void> {
    await orderRepository.markDelivered(orderId);
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
    const order = await orderRepository.findForFulfilment(orderId);

    if (!order) {
      throw new NotFoundError(`Order not found: ${orderId}`);
    }

    // Verify payment is confirmed
    if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
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
        await recordBooking(shipment.id, {
          trackingNumber: providerResult.awb,
          trackingUrl: providerResult.trackingUrl,
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
        await recordBookingFailure(
          shipment.id,
          toJsonColumn({
            ...(shipment.shippingMeta as Record<string, unknown> | null),
            fulfillmentError: errorMessage,
            requiresManualIntervention: true,
            failedAt: new Date().toISOString(),
          }),
        );
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

    await orderRepository.recordFulfilmentStatus(orderId, finalOrderStatus);

    // If there are failures, log them for monitoring/alerting
    if (fulfillmentResults.failed.length > 0) {
      fulfillmentResults.failed.forEach(f => {
        console.error(`   - ${f.code}: ${f.error}`);
      });
    }
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

      // What it charges is read from the quote's signature, inside the transaction.
      if (!group.selectedRate?.quote) {
        throw new DomainError(`Shipping group ${group.groupId} has no selected rate`);
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

    if (!isValidPhone(mobile)) {
      throw new DomainError(PHONE_MESSAGE);
    }

    // A logged-in buyer's confirmation email can fall back to their account email
    // (onPaymentConfirmed); a guest has no account to fall back to, so their address
    // is the only place it can come from — require it here rather than finding out
    // silently at payment-confirmation time that no email exists to send to.
    if (!input.userId && !input.address.email) {
      throw new DomainError("Email is required so we can send your order confirmation");
    }

    // Validate postal code
    if (!isValidPincode(pincode)) {
      throw new Error(PINCODE_MESSAGE);
    }
  }

}

export const orderService = new OrderService();

