/**
 * The decision half of payment confirmation (ADR-0005), pure so every branch is
 * testable without a database. The caller verified the signature already — this
 * decides what a verified signal *means* against the persisted order. Neither the
 * browser return nor the webhook is trusted more than the other, because neither is
 * trusted at all: these checks are what confer trust, not the caller.
 */

export interface OrderPaymentState {
  paymentStatus: string | null;
  /** The confirmed payment id, if any — the idempotency key (trd.md D2). */
  paymentId: string | null;
  grandTotal: number; // paise
  gatewayOrderId: string | null;
}

export interface IncomingConfirmation {
  paymentId: string;
  gatewayOrderId: string;
  /** Present on the webhook (entity.amount, paise); absent on the browser return. */
  amount?: number;
}

export type ConfirmationDecision =
  | { kind: "confirm" }
  | { kind: "already-confirmed" } // same payment again: succeed, run no side effects
  | { kind: "reject"; reason: string };

export function decideConfirmation(
  order: OrderPaymentState,
  incoming: IncomingConfirmation
): ConfirmationDecision {
  // A retry of the SAME payment is success with nothing to do; a DIFFERENT payment
  // against a paid order is an incident, not idempotency (D2 distinguishes the two).
  if (order.paymentStatus === "paid") {
    return order.paymentId === incoming.paymentId
      ? { kind: "already-confirmed" }
      : { kind: "reject", reason: "Order is already paid by a different payment" };
  }

  // The gateway order was created by us with amount = grandTotal, and the id was
  // persisted at creation. A signal for some other gateway order proves nothing
  // about this order.
  if (!order.gatewayOrderId || order.gatewayOrderId !== incoming.gatewayOrderId) {
    return { kind: "reject", reason: "Payment does not belong to this order" };
  }

  // The webhook carries the captured amount; it must equal what the store is owed.
  // In either direction — an overpayment is as unaccountable as an underpayment.
  if (incoming.amount !== undefined && incoming.amount !== order.grandTotal) {
    return { kind: "reject", reason: "Payment amount does not match the order total" };
  }

  return { kind: "confirm" };
}
