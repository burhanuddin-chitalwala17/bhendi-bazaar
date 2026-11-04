import type { StatusTone } from "@/components/shared/badges/StatusBadge";

export type SettlementStatus = "PENDING" | "PAID" | "CANCELLED";

/** A settlement's state as a chip, the same on every screen that shows one. */
export const SETTLEMENT_STATUS_BADGE: Record<SettlementStatus, { tone: StatusTone; label: string }> = {
  PENDING: { tone: "warning", label: "Pending" },
  PAID: { tone: "success", label: "Paid" },
  CANCELLED: { tone: "neutral", label: "Cancelled" },
};
