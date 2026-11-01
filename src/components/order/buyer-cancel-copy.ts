import { formatCurrency as rupees } from "@/lib/format";

/** order-fulfilment ux.md "buyer order" and "buyer cancel sheet", exactly as signed off. */

export const BUYER_CANCEL_COPY = {
  cancelOrder: "Cancel order",
  cancelItems: "Cancel these items",
  title: "Cancel order",
  intro: (paise: number) => `Cancel this order? You'll get ${rupees(paise)} back to the way you paid.`,
  introFrom: (shop: string, paise: number) => `Cancel the items from ${shop}? You'll get ${rupees(paise)} back.`,
  confirm: "Yes, cancel",
  cancelling: "Cancelling…",
  keep: "Keep order",
  success: "Order cancelled.",
  /** "Refused: cancel after ready", tapped on a parcel the page already shows packed. */
  afterReady: "This parcel is packed and waiting for the courier. To stop it, contact us.",
  contactUs: "Contact us",
  refundOnItsWay: (paise: number) => `Cancelled. Refund of ${rupees(paise)} is on its way. We'll email you when it starts.`,
  refundStarted: (paise: number, day: string) => `Refund of ${rupees(paise)} started ${day}. It reaches your account in 5–7 working days.`,
  couponBack: (code: string) => `Your ${code} coupon can be used again.`,
} as const;
