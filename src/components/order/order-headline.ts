import { ORDER_STATUS, type OrderStatus } from "@server/checkout/order.types";

export interface OrderHeadline {
  title: string;
  description: string;
}

const PLACED: OrderHeadline = {
  title: "Thank you — your order is confirmed",
  description: "We'll keep this page up to date as your parcels move.",
};

/** The page is reopened for weeks after checkout, so its headline follows the order, not the moment it was placed. */
const HEADLINES: Record<OrderStatus, OrderHeadline> = {
  [ORDER_STATUS.PENDING_PAYMENT]: {
    title: "Waiting for your payment",
    description: "Your items are held while the payment completes.",
  },
  [ORDER_STATUS.FAILED]: {
    title: "Your payment didn't go through",
    description: "Nothing was charged. You can try again from your cart.",
  },
  [ORDER_STATUS.EXPIRED]: {
    title: "This checkout has expired",
    description: "It wasn't paid in time, so the items were released. Nothing was charged.",
  },
  [ORDER_STATUS.CONFIRMED]: PLACED,
  [ORDER_STATUS.PROCESSING]: PLACED,
  [ORDER_STATUS.PACKED]: PLACED,
  [ORDER_STATUS.SHIPPED]: {
    title: "Your order is on its way",
    description: "Track each parcel below.",
  },
  [ORDER_STATUS.DELIVERED]: {
    title: "Delivered",
    description: "We hope you love it.",
  },
  [ORDER_STATUS.CANCELLED]: {
    title: "This order was cancelled",
    description: "Any refund due is shown below.",
  },
};

export function orderHeadline(status: string): OrderHeadline {
  return HEADLINES[status as OrderStatus] ?? PLACED;
}
