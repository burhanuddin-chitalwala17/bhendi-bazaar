import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatus, type PaymentStatus } from "@server/checkout/order.types";
import type { StatusTone } from "@/components/shared/badges/StatusBadge";

interface Chip {
  label: string;
  tone: StatusTone;
}

/** An order's state as the console says it: one word and one tone per status (StatusBadge). */
const ORDER_CHIP: Record<OrderStatus, Chip> = {
  [ORDER_STATUS.PENDING_PAYMENT]: { label: "Awaiting payment", tone: "warning" },
  [ORDER_STATUS.CONFIRMED]: { label: "Confirmed", tone: "info" },
  [ORDER_STATUS.PROCESSING]: { label: "Processing", tone: "info" },
  [ORDER_STATUS.PACKED]: { label: "Packed", tone: "info" },
  [ORDER_STATUS.SHIPPED]: { label: "On the way", tone: "info" },
  [ORDER_STATUS.DELIVERED]: { label: "Delivered", tone: "success" },
  [ORDER_STATUS.CANCELLED]: { label: "Cancelled", tone: "neutral" },
  [ORDER_STATUS.FAILED]: { label: "Payment failed", tone: "destructive" },
  [ORDER_STATUS.EXPIRED]: { label: "Expired", tone: "neutral" },
};

const PAYMENT_CHIP: Record<PaymentStatus, Chip> = {
  [PAYMENT_STATUS.PENDING]: { label: "Unpaid", tone: "warning" },
  [PAYMENT_STATUS.PAID]: { label: "Paid", tone: "success" },
  [PAYMENT_STATUS.FAILED]: { label: "Failed", tone: "destructive" },
  [PAYMENT_STATUS.REFUNDED]: { label: "Refunded", tone: "neutral" },
};

export function orderChip(status: string): Chip {
  return ORDER_CHIP[status as OrderStatus] ?? { label: status, tone: "neutral" };
}

export function paymentChip(status: string | null): Chip {
  return PAYMENT_CHIP[(status ?? PAYMENT_STATUS.PENDING) as PaymentStatus] ?? { label: status ?? "", tone: "neutral" };
}

/** The console's order tabs: a status filter each, in the order an order moves (admin canvas). */
export const ORDER_TABS = [
  { key: "all", label: "All", status: null },
  { key: ORDER_STATUS.PENDING_PAYMENT, label: "Awaiting payment", status: ORDER_STATUS.PENDING_PAYMENT },
  { key: ORDER_STATUS.CONFIRMED, label: "Confirmed", status: ORDER_STATUS.CONFIRMED },
  { key: ORDER_STATUS.SHIPPED, label: "On the way", status: ORDER_STATUS.SHIPPED },
  { key: ORDER_STATUS.DELIVERED, label: "Delivered", status: ORDER_STATUS.DELIVERED },
  { key: ORDER_STATUS.CANCELLED, label: "Cancelled", status: ORDER_STATUS.CANCELLED },
] as const;
