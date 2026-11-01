import type { Prisma } from "@prisma/client";
import { parcelNoticeContext } from "@server/shipping/shipment-status.service";
import { PARCEL_ACTOR, SHIPMENT_STATUS, type ParcelActor, type ShipmentStatus } from "@server/shipping/domain/shipping.types";
import { noticeService } from "@server/notifications/notice.service";
import { NOTICE_KIND, type NoticeKind, type ParcelNoticeInput } from "@server/notifications/notice.types";
import { isoDay } from "@server/shared/india-time";
import { buyerEmailOf } from "@server/checkout/buyer-contact";

type Parcel = NonNullable<Awaited<ReturnType<typeof parcelNoticeContext>>>;

/** One notice about `parcel`, carrying its booking as it now stands. */
function noticeOf(parcel: Parcel, kind: NoticeKind, since: Date, extra: Partial<ParcelNoticeInput> = {}): ParcelNoticeInput {
  return {
    shipmentId: parcel.id,
    kind,
    orderId: parcel.order.id,
    orderCode: parcel.order.code,
    parcelCode: parcel.code,
    orgId: parcel.orgId,
    city: parcel.fromCity,
    since,
    booking: {
      courierName: parcel.courierName,
      trackingNumber: parcel.trackingNumber,
      trackingUrl: parcel.trackingUrl,
      pickupDate: parcel.pickupDate ? isoDay(parcel.pickupDate) : null,
      estimatedDelivery: parcel.estimatedDelivery ? isoDay(parcel.estimatedDelivery) : null,
    },
    ...extra,
  };
}

/**
 * What a parcel move earns, run only by the move that won (order-fulfilment Approach), on its
 * transaction. Each effect carries its own unique key as a backstop, so a replay writes nothing.
 * Later units add the cancel give-backs here.
 */
export async function onParcelMoved(
  move: { shipmentId: string; to: ShipmentStatus; actor: ParcelActor; at: Date },
  tx: Prisma.TransactionClient,
): Promise<void> {
  // The shop's "ready" is the admin's cue to book (R4); an admin walking a parcel there is booking it already.
  const readied = move.to === SHIPMENT_STATUS.READY_FOR_PICKUP && move.actor === PARCEL_ACTOR.SHOP;
  const booked = move.to === SHIPMENT_STATUS.PICKUP_BOOKED;
  const pickedUp = move.to === SHIPMENT_STATUS.PICKED_UP;
  if (!readied && !booked && !pickedUp) return;

  const parcel = await parcelNoticeContext(move.shipmentId, tx);
  if (!parcel) return;
  if (readied) await noticeService.write(noticeOf(parcel, NOTICE_KIND.READY, move.at), tx);
  if (pickedUp) await noticeService.write(noticeOf(parcel, NOTICE_KIND.PICKED_UP, move.at), tx);
  if (booked) {
    // R6: the buyer hears the dates and the tracking link; the shop the date and where the label is.
    const buyerEmail = await buyerEmailOf(parcel.order.id, tx);
    await noticeService.write(noticeOf(parcel, NOTICE_KIND.BOOKED_BUYER, move.at, { buyerEmail }), tx);
    await noticeService.write(noticeOf(parcel, NOTICE_KIND.BOOKED_SHOP, move.at), tx);
  }
}

/**
 * A booked date changed (D11): the shop emailed once per change, keyed by its timeline row; the
 * buyer only when the delivery day moved, since a pickup day alone changes nothing they see.
 */
export async function onPickupMoved(
  change: { shipmentId: string; eventId: string; at: Date; etaChanged: boolean },
  tx: Prisma.TransactionClient,
): Promise<void> {
  const parcel = await parcelNoticeContext(change.shipmentId, tx);
  if (!parcel) return;
  await noticeService.write(noticeOf(parcel, NOTICE_KIND.PICKUP_MOVED_SHOP, change.at, { ref: change.eventId }), tx);
  if (!change.etaChanged) return;
  const buyerEmail = await buyerEmailOf(parcel.order.id, tx);
  await noticeService.write(
    noticeOf(parcel, NOTICE_KIND.PICKUP_MOVED_BUYER, change.at, { ref: change.eventId, buyerEmail }),
    tx,
  );
}
