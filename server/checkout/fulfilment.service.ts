import { prisma } from "@server/shared/prisma";
import { indiaDay } from "@server/shared/india-time";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { orderRepository } from "@server/checkout/order.repository";
import { summariseParcels } from "@server/checkout/parcel-summary";
import { onParcelMoved } from "@server/checkout/parcel-moved";
import type { GivenBack } from "@server/checkout/cancel-give-back";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";
import { promotionService } from "@server/promotions/promotion.service";
import { cancelledBeforeReadyMessage } from "@server/checkout/shop-parcel.types";
import {
  applyStatus,
  lastMoveInto,
  parcelRefs,
  parcelStatusesOf,
  type TransitionOutcome,
} from "@server/shipping/shipment-status.service";
import {
  PARCEL_ACTOR,
  SHIPMENT_STATUS,
  alreadyMessage,
  offListMessage,
  type ParcelActor,
  type ParcelBooking,
  type ShipmentStatus,
} from "@server/shipping/domain/shipping.types";

export const UNPAID_CANCEL_MESSAGE = "Only a paid parcel can be cancelled. An unpaid order expires on its own.";
const PARCEL_NOT_FOUND = "Parcel not found";

/** A move's outcome; a cancel that won also says what it gave back (D12). */
export type MoveOutcome = TransitionOutcome & { given?: GivenBack };

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
  /** Only a paid order's parcel may move; any other answers not-found (order-fulfilment D6). */
  paidOnly?: boolean;
  /** The staff member's name, kept on the timeline row for "Already booked by {name}" (D11). */
  actorName?: string;
  /** The hand booking, written with the move into `pickup_booked` (D11). */
  booking?: ParcelBooking;
  /** The states this person may move it from (CANCELLABLE_FROM, Q9), checked under the order lock. */
  onlyFrom?: readonly ShipmentStatus[];
}

/**
 * The one way a parcel moves (order-fulfilment D2, D4). One transaction: lock the order, move the
 * parcel through shipping's single writer, write the order's status as its parcels summarise, then
 * run what the move earns (`onParcelMoved`) — only for the move that won.
 * The lock makes moves on one order take turns, so a repeated "delivered" applies once (A5).
 */
export async function moveParcel(
  shipmentId: string,
  to: ShipmentStatus,
  options: MoveOptions,
): Promise<MoveOutcome> {
  const refs = await parcelRefs(shipmentId);
  if (!refs) {
    if (options.refuse) throw new NotFoundError(PARCEL_NOT_FOUND);
    return { kind: "not-found" };
  }
  const { orderId } = refs;

  const outcome = await prisma.$transaction(async (tx) => {
    const order = await orderRepository.lockForParcelMove(orderId, tx);
    const paid = order?.paymentStatus === PAYMENT_STATUS.PAID;
    if (options.paidOnly && !paid) throw new NotFoundError(PARCEL_NOT_FOUND);
    // An unpaid order only expires (Q9): cancelling its parcel here would restock it, and
    // `expireAndRestock` would restock the same units again.
    if (to === SHIPMENT_STATUS.CANCELLED && !paid) throw new ConflictError(UNPAID_CANCEL_MESSAGE);
    // A cancel releases offer budget after its restock; checkout and expiry take Promotion before
    // stock, so the cancel takes it first too (D2).
    if (to === SHIPMENT_STATUS.CANCELLED) await promotionService.lockForOrder(orderId, tx);
    const moved = await applyStatus(shipmentId, to, options, tx);
    if (moved.kind !== "moved") return moved;

    const summary = summariseParcels(await parcelStatusesOf(orderId, tx));
    const summaryMoved = summary ? await orderRepository.syncSummary(orderId, summary, tx) : false;
    const orderNowCancelled = summaryMoved && summary === ORDER_STATUS.CANCELLED;
    const given = await onParcelMoved({ shipmentId, to, actor: options.actor, at: new Date(), orderNowCancelled }, tx);
    return given ? { ...moved, given } : moved;
  });

  if (outcome.kind === "off-list") throw new ConflictError(offListMessage(outcome.current));
  if (options.refuse && outcome.kind === "ignored") throw new ConflictError(alreadyMessage(outcome.current));
  if (options.refuse && outcome.kind === "not-found") throw new NotFoundError(PARCEL_NOT_FOUND);
  return outcome;
}

const CANCELLED_BY: Partial<Record<ParcelActor, string>> = {
  [PARCEL_ACTOR.BUYER]: "the buyer",
  [PARCEL_ACTOR.SHOP]: "you",
  [PARCEL_ACTOR.ADMIN]: "us",
};


/**
 * The shop marks its own parcel ready (order-fulfilment D6, spec R3, A1). Scoped twice: a parcel of
 * another shop, or of an unpaid order, is not-found — whether it exists is not this caller's business.
 */
export async function markParcelReady(shipmentId: string, orgId: string): Promise<void> {
  const refs = await parcelRefs(shipmentId);
  if (!refs || refs.orgId !== orgId) throw new NotFoundError(PARCEL_NOT_FOUND);

  const outcome = await moveParcel(shipmentId, SHIPMENT_STATUS.READY_FOR_PICKUP, {
    actor: PARCEL_ACTOR.SHOP,
    paidOnly: true,
  });
  if (outcome.kind === "moved") return;
  if (outcome.kind === "ignored" && outcome.current === SHIPMENT_STATUS.CANCELLED) {
    // Read only to say why, never to decide.
    const cancel = await lastMoveInto(shipmentId, SHIPMENT_STATUS.CANCELLED);
    throw new ConflictError(
      cancelledBeforeReadyMessage(
        CANCELLED_BY[(cancel?.actor ?? "") as ParcelActor] ?? "us",
        indiaDay(cancel?.createdAt ?? new Date()),
      ),
    );
  }
  if (outcome.kind === "ignored" || outcome.kind === "unmapped") throw new ConflictError(alreadyMessage(outcome.current));
  throw new NotFoundError(PARCEL_NOT_FOUND);
}
