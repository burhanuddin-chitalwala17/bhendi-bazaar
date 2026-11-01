import { apiRequest } from "@/lib/api-client";
import type { RefundStartOutcome } from "@server/payments/refund.types";

/** The admin's refund commands (order-fulfilment D17). */
export const refundsApiClient = {
  /** No body: the amount is the row's, owed by the server (Invariant 1). */
  start(refundId: string): Promise<Exclude<RefundStartOutcome, { kind: "already" }>> {
    return apiRequest(`/api/admin/refunds/${refundId}/start`, { method: "POST" });
  },
};
