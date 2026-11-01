import type { Prisma } from "@prisma/client";
import { parcelNoticeContext } from "@server/shipping/shipment-status.service";
import { PARCEL_ACTOR, SHIPMENT_STATUS, type ParcelActor, type ShipmentStatus } from "@server/shipping/domain/shipping.types";
import { noticeService } from "@server/notifications/notice.service";
import { NOTICE_KIND } from "@server/notifications/notice.types";

/**
 * What a parcel move earns, run only by the move that won (order-fulfilment Approach), on its
 * transaction. Each effect carries its own unique key as a backstop, so a replay writes nothing.
 * Unit 2 adds the "ready to book" notice; later units add the cancel give-backs here.
 */
export async function onParcelMoved(
  move: { shipmentId: string; to: ShipmentStatus; actor: ParcelActor; at: Date },
  tx: Prisma.TransactionClient,
): Promise<void> {
  // The shop's "ready" is the admin's cue to book (R4); an admin walking a parcel there is booking it already.
  if (move.to === SHIPMENT_STATUS.READY_FOR_PICKUP && move.actor === PARCEL_ACTOR.SHOP) {
    const parcel = await parcelNoticeContext(move.shipmentId, tx);
    if (!parcel) return;
    await noticeService.write(
      {
        shipmentId: parcel.id,
        kind: NOTICE_KIND.READY,
        orderId: parcel.order.id,
        orderCode: parcel.order.code,
        parcelCode: parcel.code,
        orgId: parcel.orgId,
        city: parcel.fromCity,
        since: move.at,
      },
      tx,
    );
  }
}
