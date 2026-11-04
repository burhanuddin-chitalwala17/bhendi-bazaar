import { formatCurrency as rupees } from "@/lib/format";
import { PARCEL_ACTOR, SHIPMENT_STATUS, type ParcelActor } from "@server/shipping/domain/shipping.types";
import type { RefundCause } from "@server/payments/refund.types";

/** order-fulfilment ux.md "admin refunds" and the copy deck; the build-time changes are Q38, awaiting the owner's re-sign. */
export const REFUNDS_COPY = {
  title: "Refunds",
  empty: "No refunds owed.",
  owed: (paise: number) => `${rupees(paise)} owed`,
  startedLine: (day: string, gatewayRefundId: string) => `Started ${day} · ${gatewayRefundId}`,
  owedFor: (days: number) => `Owed for ${days} days`,
  open: (paise: number) => `Refund ${rupees(paise)}`,
  // {UPI / card} is not stored (Order.paymentMethod is "razorpay"), so the sheet names the way it was paid (added at build, unit 6).
  confirmIntro: (paise: number) => `Refund ${rupees(paise)} to the way the buyer paid? This can't be undone.`,
  confirm: (paise: number) => `Refund ${rupees(paise)}`,
  keep: "Not now",
  refunding: "Refunding…",
  success: (paise: number) => `Refund of ${rupees(paise)} started. Buyer emailed.`,
  unconfirmed: "We couldn't confirm the refund. Check Razorpay before trying again.",
  refused: (reason: string) => `Razorpay says: ${reason.replace(/\.$/, "")}. Check the payment in Razorpay before trying again.`,
  openRazorpay: "Open in Razorpay",
  tryAgain: "Try again",
  previous: "Previous",
  next: "Next",
};

const CANCELLED_BY: Record<ParcelActor, string> = {
  [PARCEL_ACTOR.SHOP]: "cancelled by shop",
  [PARCEL_ACTOR.BUYER]: "cancelled by buyer",
  [PARCEL_ACTOR.ADMIN]: "cancelled by us",
  [PARCEL_ACTOR.COURIER]: "cancelled",
  [PARCEL_ACTOR.SYSTEM]: "cancelled",
};

/** Why it is owed (Q25): "cancelled by shop", "lost", "damaged", "returned". */
export function causeLabel(cause: RefundCause, cancelledBy: ParcelActor | null): string {
  if (cause === SHIPMENT_STATUS.CANCELLED) return cancelledBy ? CANCELLED_BY[cancelledBy] : "cancelled";
  if (cause === SHIPMENT_STATUS.RTO_DELIVERED) return "returned";
  return cause === SHIPMENT_STATUS.LOST ? "lost" : "damaged";
}

/** The payment in Razorpay's dashboard, where the admin checks before trying again. */
export const razorpayPaymentUrl = (paymentId: string | null) =>
  paymentId ? `https://dashboard.razorpay.com/app/payments/${encodeURIComponent(paymentId)}` : "https://dashboard.razorpay.com/app/refunds";
