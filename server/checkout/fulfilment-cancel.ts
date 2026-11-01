import { prisma } from "@server/shared/prisma";
import { indiaMoment } from "@server/shared/india-time";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { moveParcel } from "@server/checkout/fulfilment.service";
import { orderRepository } from "@server/checkout/order.repository";
import { CANCEL_REFUSAL, type CancelResult } from "@server/checkout/parcel-cancel.types";
import { bookingOf, lastMoveInto, parcelRefs, parcelsWithLines } from "@server/shipping/shipment-status.service";
import { parcelShares, refundOwedPaise } from "@server/checkout/parcel-shares";
import {
  CANCELLABLE_FROM,
  PARCEL_ACTOR,
  SHIPMENT_STATUS,
  alreadyMessage,
  type ParcelActor,
  type ShipmentStatus,
} from "@server/shipping/domain/shipping.types";

const PARCEL_NOT_FOUND = "Parcel not found";

/** Who is cancelling, and what scopes them: the shop to its own parcels, the buyer to their own order. */
export type CancelBy =
  | { actor: typeof PARCEL_ACTOR.SHOP; orgId: string }
  | { actor: typeof PARCEL_ACTOR.BUYER; userId: string; orderId: string }
  | { actor: typeof PARCEL_ACTOR.ADMIN; name: string | null };

const ADMIN_NAMES: Partial<Record<ParcelActor, string>> = {
  [PARCEL_ACTOR.BUYER]: "the buyer",
  [PARCEL_ACTOR.SHOP]: "the shop",
  [PARCEL_ACTOR.ADMIN]: "us",
};

/** Once the courier has it, only a return brings it back (ux.md admin cancel sheet "Refused: picked up first"). */
const PAST_PICKUP: readonly ShipmentStatus[] = [
  SHIPMENT_STATUS.PICKED_UP,
  SHIPMENT_STATUS.IN_TRANSIT,
  SHIPMENT_STATUS.OUT_FOR_DELIVERY,
  SHIPMENT_STATUS.DELIVERY_FAILED,
  SHIPMENT_STATUS.DELIVERED,
  SHIPMENT_STATUS.RTO_IN_TRANSIT,
  SHIPMENT_STATUS.RTO_DELIVERED,
  SHIPMENT_STATUS.LOST,
  SHIPMENT_STATUS.DAMAGED,
];

/** The scope check: a parcel this caller may not see is not-found, whether or not it exists. */
async function assertInScope(shipmentId: string, by: CancelBy): Promise<void> {
  const refs = await parcelRefs(shipmentId);
  if (!refs) throw new NotFoundError(PARCEL_NOT_FOUND);
  if (by.actor === PARCEL_ACTOR.SHOP && refs.orgId !== by.orgId) throw new NotFoundError(PARCEL_NOT_FOUND);
  if (by.actor === PARCEL_ACTOR.BUYER) {
    if (refs.orderId !== by.orderId) throw new NotFoundError(PARCEL_NOT_FOUND);
    const owner = await orderRepository.contactOf(refs.orderId, prisma);
    // Identity and ownership are two conditions: a guest order has no owner to match (Q31).
    if (!owner?.userId || owner.userId !== by.userId) throw new NotFoundError(PARCEL_NOT_FOUND);
  }
}

/** Why the cancel did not apply, in the words this person's sheet shows (ux.md). Read only to explain. */
async function refusal(shipmentId: string, current: ShipmentStatus, by: CancelBy): Promise<ConflictError> {
  if (current === SHIPMENT_STATUS.CANCELLED) {
    const cancel = await lastMoveInto(shipmentId, SHIPMENT_STATUS.CANCELLED);
    const who = (cancel?.actor ?? "") as ParcelActor;
    if (by.actor === PARCEL_ACTOR.BUYER) return new ConflictError(CANCEL_REFUSAL.buyerAlready);
    if (by.actor === PARCEL_ACTOR.SHOP) {
      return new ConflictError(who === PARCEL_ACTOR.BUYER ? CANCEL_REFUSAL.shopBuyerFirst : alreadyMessage(current));
    }
    return new ConflictError(CANCEL_REFUSAL.adminAlready(ADMIN_NAMES[who] ?? "us", indiaMoment(cancel?.createdAt ?? new Date())));
  }
  if (by.actor === PARCEL_ACTOR.SHOP && !PAST_PICKUP.includes(current)) return new ConflictError(CANCEL_REFUSAL.shopMarkedReady);
  if (by.actor === PARCEL_ACTOR.BUYER && !PAST_PICKUP.includes(current)) return new ConflictError(CANCEL_REFUSAL.buyerShopPacked);
  if (by.actor === PARCEL_ACTOR.ADMIN && PAST_PICKUP.includes(current)) {
    const pickedUp = await lastMoveInto(shipmentId, SHIPMENT_STATUS.PICKED_UP);
    return new ConflictError(CANCEL_REFUSAL.adminPickedUp(indiaMoment(pickedUp?.createdAt ?? new Date())));
  }
  return new ConflictError(alreadyMessage(current));
}

/**
 * Cancel one paid parcel (order-fulfilment D12, R10–R12): one command behind the buyer's, the
 * shop's and the admin's routes. Where each may cancel from is `CANCELLABLE_FROM`, checked in the
 * locked move, so a cancel racing a "ready" or a pickup loses cleanly (Q28). Restock and reversal
 * happen in the move; `parcel-moved.ts` gives the rest back. An unpaid order is refused (Q9).
 */
export async function cancelParcel(shipmentId: string, by: CancelBy, reason: string | undefined): Promise<CancelResult> {
  await assertInScope(shipmentId, by);

  const outcome = await moveParcel(shipmentId, SHIPMENT_STATUS.CANCELLED, {
    actor: by.actor,
    reason,
    onlyFrom: CANCELLABLE_FROM[by.actor],
    ...(by.actor === PARCEL_ACTOR.ADMIN && by.name ? { actorName: by.name } : {}),
  });
  if (outcome.kind === "ignored" || outcome.kind === "unmapped") throw await refusal(shipmentId, outcome.current, by);
  if (outcome.kind !== "moved") throw new NotFoundError(PARCEL_NOT_FOUND);

  // The AWB is read after commit only to remind the admin to cancel it on Shiprocket (Q28).
  const booking = await bookingOf(shipmentId);
  return {
    feePaise: outcome.given?.feePaise ?? 0,
    refundPaise: outcome.given?.refundPaise ?? 0,
    awb: booking?.trackingNumber ?? null,
  };
}

/**
 * What cancelling each parcel would refund now, for the buyer's sheet ("You'll get ₹1,240 back"):
 * the same rule the cancel writes with (Q11), read outside its lock — a preview, never a charge.
 */
export async function refundPreview(orderId: string, alreadyOwedPaise: number): Promise<Record<string, number>> {
  const [parcels, basis] = await Promise.all([parcelsWithLines(orderId, prisma), orderRepository.refundBasis(orderId, prisma)]);
  if (!basis) return {};
  const shares = parcelShares(basis.items.map((l) => ({ ...l, orderItemId: l.id })), parcels);
  return Object.fromEntries(
    parcels.map((p) => [
      p.id,
      refundOwedPaise({
        netItemsPaise: shares.get(p.id)?.netItemsPaise ?? 0,
        shippingCost: p.shippingCost,
        grandTotal: basis.grandTotal,
        alreadyOwedPaise,
      }),
    ]),
  );
}
