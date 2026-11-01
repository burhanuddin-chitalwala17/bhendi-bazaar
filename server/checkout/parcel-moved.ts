import type { Prisma } from "@prisma/client";
import { parcelNoticeContext, parcelsWithLines } from "@server/shipping/shipment-status.service";
import { giveBack, type GivenBack } from "@server/checkout/cancel-give-back";
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
 * `orderNowCancelled` is true only for the move whose summary took the order to cancelled (D13).
 */
export async function onParcelMoved(
  move: { shipmentId: string; to: ShipmentStatus; actor: ParcelActor; at: Date; orderNowCancelled?: boolean },
  tx: Prisma.TransactionClient,
): Promise<GivenBack | null> {
  if (move.to === SHIPMENT_STATUS.CANCELLED) {
    const parcel = await parcelNoticeContext(move.shipmentId, tx);
    if (!parcel) return null;
    const given = await giveBack(
      { id: parcel.id, code: parcel.code, orgId: parcel.orgId, orderId: parcel.order.id },
      { byShop: move.actor === PARCEL_ACTOR.SHOP, orderNowCancelled: move.orderNowCancelled ?? false },
      await parcelsWithLines(parcel.order.id, tx),
      tx,
    );
    const cancel = { cancelledBy: move.actor, ...given };
    const buyerEmail = await buyerEmailOf(parcel.order.id, tx);
    await noticeService.write(noticeOf(parcel, NOTICE_KIND.CANCELLED_BUYER, move.at, { buyerEmail, cancel }), tx);
    await noticeService.write(noticeOf(parcel, NOTICE_KIND.CANCELLED_SHOP, move.at, { cancel }), tx);
    return given;
  }

  // The shop's "ready" is the admin's cue to book (R4); an admin walking a parcel there is booking it already.
  const readied = move.to === SHIPMENT_STATUS.READY_FOR_PICKUP && move.actor === PARCEL_ACTOR.SHOP;
  const booked = move.to === SHIPMENT_STATUS.PICKUP_BOOKED;
  const pickedUp = move.to === SHIPMENT_STATUS.PICKED_UP;
  const delivered = move.to === SHIPMENT_STATUS.DELIVERED;
  if (!readied && !booked && !pickedUp && !delivered) return null;

  const parcel = await parcelNoticeContext(move.shipmentId, tx);
  if (!parcel) return null;
  if (readied) await noticeService.write(noticeOf(parcel, NOTICE_KIND.READY, move.at), tx);
  if (pickedUp) await noticeService.write(noticeOf(parcel, NOTICE_KIND.PICKED_UP, move.at), tx);
  if (delivered) {
    const buyerEmail = await buyerEmailOf(parcel.order.id, tx);
    await noticeService.write(noticeOf(parcel, NOTICE_KIND.DELIVERED, move.at, { buyerEmail }), tx);
  }
  if (booked) {
    // R6: the buyer hears the dates and the tracking link; the shop the date and where the label is.
    const buyerEmail = await buyerEmailOf(parcel.order.id, tx);
    await noticeService.write(noticeOf(parcel, NOTICE_KIND.BOOKED_BUYER, move.at, { buyerEmail }), tx);
    await noticeService.write(noticeOf(parcel, NOTICE_KIND.BOOKED_SHOP, move.at), tx);
  }
  return null;
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

/** The courier's ETA replaced ours (D10, Q6): the buyer is emailed once per change, keyed by its timeline row. */
export async function onEtaChanged(
  change: { shipmentId: string; eventId: string; at: Date },
  tx: Prisma.TransactionClient,
): Promise<void> {
  const parcel = await parcelNoticeContext(change.shipmentId, tx);
  if (!parcel) return;
  const buyerEmail = await buyerEmailOf(parcel.order.id, tx);
  await noticeService.write(
    noticeOf(parcel, NOTICE_KIND.ETA_CHANGED_BUYER, change.at, { ref: change.eventId, buyerEmail }),
    tx,
  );
}
