import { prisma } from "@server/shared/prisma";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { orderRepository } from "@server/checkout/order.repository";
import { summariseParcels } from "@server/checkout/parcel-summary";
import { PAYMENT_STATUS } from "@server/checkout/order.types";
import {
  applyStatus,
  parcelOrderId,
  parcelStatusesOf,
  type TransitionOutcome,
} from "@server/shipping/shipment-status.service";
import {
  SHIPMENT_STATUS,
  alreadyMessage,
  offListMessage,
  type ParcelActor,
  type ShipmentStatus,
} from "@server/shipping/domain/shipping.types";

export const UNPAID_CANCEL_MESSAGE = "Only a paid parcel can be cancelled. An unpaid order expires on its own.";

export interface MoveOptions {
  actor: ParcelActor;
  reason?: string;
  /** The courier's own wording, kept on the parcel and its timeline row. */
  raw?: string;
  /**
   * A person pressed a button: a repeat or a move the table refuses is a `ConflictError` with
   * where the parcel stands. A courier's stale or repeated event is ignored instead (shipment-lifecycle R9).
   */
  refuse?: boolean;
}

/**
 * The one way a parcel moves (order-fulfilment D2, D4). One transaction: lock the order, move the
 * parcel through shipping's single writer, then write the order's status as its parcels summarise.
 * The lock makes moves on one order take turns, so a repeated "delivered" applies once (A5).
 */
export async function moveParcel(
  shipmentId: string,
  to: ShipmentStatus,
  options: MoveOptions,
): Promise<TransitionOutcome> {
  const orderId = await parcelOrderId(shipmentId);
  if (!orderId) return { kind: "not-found" };

  const outcome = await prisma.$transaction(async (tx) => {
    const order = await orderRepository.lockForParcelMove(orderId, tx);
    // An unpaid order only expires (Q9): cancelling its parcel here would restock it, and
    // `expireAndRestock` would restock the same units again.
    if (to === SHIPMENT_STATUS.CANCELLED && order?.paymentStatus !== PAYMENT_STATUS.PAID) {
      throw new ConflictError(UNPAID_CANCEL_MESSAGE);
    }
    const moved = await applyStatus(shipmentId, to, options, tx);
    if (moved.kind !== "moved") return moved;

    const summary = summariseParcels(await parcelStatusesOf(orderId, tx));
    if (summary) await orderRepository.syncSummary(orderId, summary, tx);
    return moved;
  });

  if (outcome.kind === "off-list") throw new ConflictError(offListMessage(outcome.current));
  if (options.refuse && outcome.kind === "ignored") throw new ConflictError(alreadyMessage(outcome.current));
  if (options.refuse && outcome.kind === "not-found") throw new NotFoundError("Parcel not found");
  return outcome;
}
