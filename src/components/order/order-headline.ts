import { ORDER_STATUS, type OrderStatus } from "@server/checkout/order.types";
import { ORDER_HEADLINE_COPY } from "@/components/order/order-copy";

export interface OrderHeadline {
  title: string;
  description: string;
}

const PLACED: OrderHeadline = {
  title: ORDER_HEADLINE_COPY.placedTitle,
  description: ORDER_HEADLINE_COPY.placedBody,
};

/** The page is reopened for weeks after checkout, so its headline follows the order, not the moment it was placed. */
const HEADLINES: Record<OrderStatus, OrderHeadline> = {
  [ORDER_STATUS.PENDING_PAYMENT]: {
    title: ORDER_HEADLINE_COPY.pendingTitle,
    description: ORDER_HEADLINE_COPY.pendingBody,
  },
  [ORDER_STATUS.FAILED]: {
    title: ORDER_HEADLINE_COPY.failedTitle,
    description: ORDER_HEADLINE_COPY.failedBody,
  },
  [ORDER_STATUS.EXPIRED]: {
    title: ORDER_HEADLINE_COPY.expiredTitle,
    description: ORDER_HEADLINE_COPY.expiredBody,
  },
  [ORDER_STATUS.CONFIRMED]: PLACED,
  [ORDER_STATUS.PROCESSING]: PLACED,
  [ORDER_STATUS.PACKED]: PLACED,
  [ORDER_STATUS.SHIPPED]: {
    title: ORDER_HEADLINE_COPY.shippedTitle,
    description: ORDER_HEADLINE_COPY.shippedBody,
  },
  [ORDER_STATUS.DELIVERED]: {
    title: ORDER_HEADLINE_COPY.deliveredTitle,
    description: ORDER_HEADLINE_COPY.deliveredBody,
  },
  [ORDER_STATUS.CANCELLED]: {
    title: ORDER_HEADLINE_COPY.cancelledTitle,
    description: ORDER_HEADLINE_COPY.cancelledBody,
  },
};

export function orderHeadline(status: string): OrderHeadline {
  return HEADLINES[status as OrderStatus] ?? PLACED;
}
