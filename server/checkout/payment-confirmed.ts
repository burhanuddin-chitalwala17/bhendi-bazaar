import { orderRepository } from "@server/checkout/order.repository";
import type { OrderEmailView } from "@server/notifications/templates/purchaseConfirmationEmail";
import { NOTIFICATION_TYPE } from "@server/notifications/in-app.types";

/**
 * What happens once an order's money is real.
 *
 * Reached exactly once per order, because the caller is the conditional transition that flips
 * `paymentStatus` (payment-confirmation D3) — not whichever route happened to notice.
 *
 * Its own module because it is where three other domains meet: the ledger records what each org
 * earned, identity supplies a recipient when the address has none, and notifications sends the
 * confirmation. Leaving it inside `order.service.ts` made those three reasons for the order
 * service to change, which is what
 * [ADR-0036](../../docs/adr/0036-a-files-reasons-to-change-are-a-decision.md) is about. The
 * imports stay deferred: none of this is on the path of creating an order.
 *
 * **Nothing here may throw.** The gateway has already taken the money, so refusing to confirm an
 * order over a bookkeeping row or an unsent email is the worse outcome. Fulfilment is
 * deliberately *not* triggered here either: booking is a placeholder until
 * [shipping-fulfilment](../../docs/specs/shipping-fulfilment/), and a failed booking must never
 * look like a failed payment.
 */
export async function onPaymentConfirmed(orderId: string): Promise<void> {
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

  // Deliberately nothing here for the wishlist: a purchase does not clear a wish.
  // Only the heart removes a saved product, so someone who bought one as a gift
  // still has theirs saved, and a cancelled order needs nothing put back.

  if (order.userId) {
    const { inAppNotificationService } = await import("@server/notifications/in-app.service");
    inAppNotificationService
      .notifyUser({
        userId: order.userId,
        title: "Order Confirmed!",
        message: `Your order #${order.code} has been placed successfully.`,
        type: NOTIFICATION_TYPE.ORDER_UPDATE,
        link: `/order/${order.id}`,
      })
      .catch((err) => console.error("[onPaymentConfirmed] failed in-app notification:", err));
  }

  const deliveryAddress = order.address as OrderEmailView["address"] | null;
  // The address book's email is per-address and usually left blank (it isn't asked
  // for at checkout, only when adding an address). Falling back to the account's
  // login email is why a signed-in buyer gets this at all — without it, this branch
  // was reached almost never, only for guests, who fill email in explicitly.
  let recipientEmail = deliveryAddress?.email ?? null;
  if (!recipientEmail && order.userId) {
    const { profileService } = await import("@server/identity/profile.service");
    recipientEmail = await profileService.findLoginEmail(order.userId);
  }

  if (deliveryAddress && recipientEmail) {
    const lineItems: OrderEmailView["items"] = [];
    for (const shipment of order.shipments) {
      for (const item of shipment.items) {
        lineItems.push({
          name: item.productName,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: item.price * item.quantity,
          size: item.size,
          color: item.color,
        });
      }
    }

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
          items: lineItems,
          itemsTotal: order.itemsTotal,
          discount: order.discount,
          grandTotal: order.grandTotal,
          address: deliveryAddress,
          shipments: order.shipments.map((s) => ({
            estimatedDelivery: s.estimatedDelivery?.toISOString(),
          })),
        },
        recipientEmail
      )
      .catch((error) => {
        console.error("Failed to send purchase confirmation email:", error);
        // Email failure must not unwind a confirmed payment.
      });
  } else if (!recipientEmail) {
    // Order creation requires an email for guests and falls back to the account
    // email for logged-in buyers, so this should be unreachable in practice — if
    // it fires, something upstream (e.g. an account with no email) let an order
    // through with no way to notify the buyer.
    console.error(
      `[onPaymentConfirmed] order ${order.code} has no resolvable email — confirmation not sent`
    );
  }
}
