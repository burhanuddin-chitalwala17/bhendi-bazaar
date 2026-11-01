import { ConflictError } from "@server/shared/domain-error";
import { listResourceActions, recordAdminAction } from "@server/shared/audit/audit.service";
import { refundService } from "@server/payments/refund.service";
import type { RefundStartOutcome } from "@server/payments/refund.types";
import { orderRepository } from "@server/checkout/order.repository";
import { onRefundStarted } from "@server/checkout/parcel-moved";

/** The audit action a press of "Refund ₹{x}" records; its metadata names who pressed. */
export const REFUND_START_ACTION = "REFUND_START";

/** ux.md "admin refunds" Refused. */
export const alreadyStartedMessage = (name: string) => `Already started by ${name}.`;

/** Who pressed it last, for the refusal's wording only — never what decides it (ADR-0021). */
async function whoStarted(refundId: string): Promise<string> {
  const [latest] = await listResourceActions("Refund", refundId, [REFUND_START_ACTION]);
  const by = (latest?.metadata as { by?: unknown } | null)?.by;
  return typeof by === "string" && by ? by : "another admin";
}

/**
 * The admin's "Refund ₹{x}" (order-fulfilment D17, R14, A9): payments talks to the gateway and
 * moves the row; checkout supplies the order's payment and writes the buyer's email with the start.
 */
export async function startRefund(
  refundId: string,
  admin: { id: string; name: string | null },
): Promise<Exclude<RefundStartOutcome, { kind: "already" }>> {
  const outcome = await refundService.start(refundId, {
    paymentOf: (orderId) => orderRepository.gatewayPaymentOf(orderId),
    onClaimed: () =>
      recordAdminAction({ adminId: admin.id, action: REFUND_START_ACTION, resource: "Refund", resourceId: refundId, metadata: { by: admin.name ?? "staff" } }),
    onStarted: (row, tx) => onRefundStarted({ ...row, at: new Date() }, tx),
  });
  if (outcome.kind === "already") throw new ConflictError(alreadyStartedMessage(await whoStarted(refundId)));
  return outcome;
}
