import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";
import { fromIsoDay } from "@server/shared/india-time";
import { moveParcel } from "@server/checkout/fulfilment.service";
import { onEtaChanged } from "@server/checkout/parcel-moved";
import { readCourierStatus, replaceEstimatedDelivery } from "@server/shipping/shipment-status.service";
import { recordCourierConflict } from "@server/shipping/courier-conflict.service";
import { trackingService } from "@server/shipping/tracking.service";
import { COURIER_CONFLICT_KIND, PARCEL_ACTOR, SHIPMENT_STATUS } from "@server/shipping/domain/shipping.types";

export interface CourierUpdate {
  provider: string;
  awb: string;
  /** The courier's status, in its own words. */
  wording: string;
  /** The courier's delivery estimate as an India day, "YYYY-MM-DD", when it sent one. */
  etd: string | null;
  payload: Prisma.InputJsonValue;
}

export type CourierUpdateResult = { kind: "moved" | "ignored" | "unmapped" | "conflict" };

/**
 * One authenticated courier update (order-fulfilment D10, R8, R9). The parcel moves through the
 * one guarded command, so a repeat is a no-op (A5). An AWB no parcel carries, or a move on a
 * cancelled parcel, lands on the admin's conflict list (A13). A thrown error is the caller's 500.
 */
export async function receiveCourierUpdate(update: CourierUpdate): Promise<CourierUpdateResult> {
  const parcel = await trackingService.findShipmentByTrackingNumber(update.awb);
  if (!parcel) {
    await recordCourierConflict({
      kind: COURIER_CONFLICT_KIND.UNKNOWN_AWB, provider: update.provider, awb: update.awb,
      shipment: null, courierWording: update.wording, payload: update.payload,
    });
    return { kind: "conflict" };
  }

  const reading = await readCourierStatus(parcel.id, update.provider, update.wording);
  const outcome =
    reading.kind === "mapped"
      ? await moveParcel(parcel.id, reading.status, { actor: PARCEL_ACTOR.COURIER, raw: reading.raw })
      : reading;

  // Decided from what the locked move found, not from a read before it: the admin's cancel may win by a moment.
  const echoesCancel = reading.kind === "mapped" && reading.status === SHIPMENT_STATUS.CANCELLED;
  if ("current" in outcome && outcome.current === SHIPMENT_STATUS.CANCELLED && !echoesCancel) {
    await recordCourierConflict({
      kind: COURIER_CONFLICT_KIND.CANCELLED_PARCEL, provider: update.provider, awb: update.awb,
      shipment: { id: parcel.id, code: parcel.code }, courierWording: update.wording, payload: update.payload,
    });
    return { kind: "conflict" };
  }

  if (update.etd) await takeCourierEta(parcel.id, update.etd, update.wording);
  await logReceived(parcel, update, outcome.kind);
  return { kind: outcome.kind === "moved" ? "moved" : outcome.kind === "unmapped" ? "unmapped" : "ignored" };
}

/** A courier ETD that differs replaces ours and emails the buyer once (Q6). */
async function takeCourierEta(shipmentId: string, etd: string, wording: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const changed = await replaceEstimatedDelivery(shipmentId, fromIsoDay(etd), wording, tx);
    if (changed) await onEtaChanged({ shipmentId, eventId: changed.eventId, at: new Date() }, tx);
  });
}

async function logReceived(parcel: { id: string; orderId: string }, update: CourierUpdate, result: string): Promise<void> {
  const provider = await trackingService.configuredProvider(update.provider);
  if (!provider) return;
  await trackingService.logWebhookReceived({
    orderId: parcel.orderId,
    shipmentId: parcel.id,
    providerId: provider.id,
    response: update.payload,
    metadata: { trackingNumber: update.awb, status: result, providerStatus: update.wording },
  });
}
