import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatus, type PaymentStatus } from "@server/checkout/order.types";
import type { StatusTone } from "@/components/shared/badges/StatusBadge";
import { SHIPMENT_STATUS, SHIPMENT_STATUS_EFFECTS, type ShipmentStatus } from "@server/shipping/domain/shipping.types";
import { ORDER_STATUS_COPY } from "@/components/order/console/console-copy";

interface Chip {
  label: string;
  tone: StatusTone;
}

/** An order's state as the console says it: one word and one tone per status (StatusBadge). */
const ORDER_CHIP: Record<OrderStatus, Chip> = {
  [ORDER_STATUS.PENDING_PAYMENT]: { label: ORDER_STATUS_COPY.pendingPayment, tone: "warning" },
  [ORDER_STATUS.CONFIRMED]: { label: ORDER_STATUS_COPY.confirmed, tone: "info" },
  [ORDER_STATUS.PROCESSING]: { label: ORDER_STATUS_COPY.processing, tone: "info" },
  [ORDER_STATUS.PACKED]: { label: ORDER_STATUS_COPY.packed, tone: "info" },
  [ORDER_STATUS.SHIPPED]: { label: ORDER_STATUS_COPY.shipped, tone: "info" },
  [ORDER_STATUS.DELIVERED]: { label: ORDER_STATUS_COPY.delivered, tone: "success" },
  [ORDER_STATUS.CANCELLED]: { label: ORDER_STATUS_COPY.cancelled, tone: "neutral" },
  [ORDER_STATUS.FAILED]: { label: ORDER_STATUS_COPY.failed, tone: "destructive" },
  [ORDER_STATUS.EXPIRED]: { label: ORDER_STATUS_COPY.expired, tone: "neutral" },
};

const PAYMENT_CHIP: Record<PaymentStatus, Chip> = {
  [PAYMENT_STATUS.PENDING]: { label: ORDER_STATUS_COPY.unpaid, tone: "warning" },
  [PAYMENT_STATUS.PAID]: { label: ORDER_STATUS_COPY.paid, tone: "success" },
  [PAYMENT_STATUS.FAILED]: { label: ORDER_STATUS_COPY.paymentFailed, tone: "destructive" },
  [PAYMENT_STATUS.REFUNDED]: { label: ORDER_STATUS_COPY.refunded, tone: "neutral" },
};

export function orderChip(status: string): Chip {
  return ORDER_CHIP[status as OrderStatus] ?? { label: status, tone: "neutral" };
}

export function paymentChip(status: string | null): Chip {
  return PAYMENT_CHIP[(status ?? PAYMENT_STATUS.PENDING) as PaymentStatus] ?? { label: status ?? "", tone: "neutral" };
}

/** The console's order tabs: a status filter each, in the order an order moves (admin canvas). */
export const ORDER_TABS = [
  { key: "all", label: ORDER_STATUS_COPY.all, status: null },
  { key: ORDER_STATUS.PENDING_PAYMENT, label: ORDER_STATUS_COPY.pendingPayment, status: ORDER_STATUS.PENDING_PAYMENT },
  { key: ORDER_STATUS.CONFIRMED, label: ORDER_STATUS_COPY.confirmed, status: ORDER_STATUS.CONFIRMED },
  { key: ORDER_STATUS.SHIPPED, label: ORDER_STATUS_COPY.shipped, status: ORDER_STATUS.SHIPPED },
  { key: ORDER_STATUS.DELIVERED, label: ORDER_STATUS_COPY.delivered, status: ORDER_STATUS.DELIVERED },
  { key: ORDER_STATUS.CANCELLED, label: ORDER_STATUS_COPY.cancelled, status: ORDER_STATUS.CANCELLED },
] as const;

/**
 * A parcel's tone. It follows the effects table, not a list of names: a state that owes the buyer
 * money is the one an operator must notice, and a new state gets its colour by describing its cost.
 */
export function parcelTone(status: ShipmentStatus): StatusTone {
  if (status === SHIPMENT_STATUS.DELIVERED) return "success";
  if (SHIPMENT_STATUS_EFFECTS[status]?.refundOwed) return "destructive";
  if (status === SHIPMENT_STATUS.PACKING) return "warning";
  return "info";
}
