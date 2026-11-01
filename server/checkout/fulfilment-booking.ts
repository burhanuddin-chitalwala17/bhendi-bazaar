import { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { calendarDay, fromIsoDay, indiaTime } from "@server/shared/india-time";
import { moveParcel } from "@server/checkout/fulfilment.service";
import { onPickupMoved } from "@server/checkout/parcel-moved";
import {
  bookingOf,
  lastBookingChange,
  lastMoveInto,
  movePickupDates,
  parcelHoldingAwb,
} from "@server/shipping/shipment-status.service";
import { PARCEL_ACTOR, SHIPMENT_STATUS, alreadyMessage, type ShipmentStatus } from "@server/shipping/domain/shipping.types";

/** Refusals, exactly as order-fulfilment ux.md "admin book pickup" and "admin change pickup date" word them. */
export const BOOKING_REFUSALS = {
  notReady: "The shop hasn't marked this parcel ready yet.",
  awbTaken: (code: string) => `This AWB is already on ${code}.`,
  buyerCancelled: "The buyer cancelled this parcel. Cancel it on Shiprocket too.",
  cancelled: "This parcel was cancelled.",
  pickedUp: "The courier already picked this up.",
  alreadyBooked: (name: string, at: Date) => `Already booked by ${name} at ${indiaTime(at)}.`,
  changed: (day: Date, name: string, at: Date) => `Changed to ${calendarDay(day)} by ${name} at ${indiaTime(at)}.`,
} as const;

/** What the booking route has parsed (`bookingSchema`); days are "YYYY-MM-DD" in India. */
export interface BookingInput {
  pickupDate: string;
  estimatedDelivery: string;
  courierName: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
}

/** What the date-change route has parsed (`pickupDateChangeSchema`). */
export interface PickupDateChangeInput {
  pickupDate: string;
  estimatedDelivery: string;
  seenPickupDate: string;
}

const PARCEL_NOT_FOUND = "Parcel not found";
const SOMEONE = "another admin";
const PICKED_UP_OR_LATER: readonly ShipmentStatus[] = [
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

const isAwbClash = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

async function awbTaken(trackingNumber: string, shipmentId: string): Promise<ConflictError | null> {
  const holder = await parcelHoldingAwb(trackingNumber, shipmentId);
  return holder ? new ConflictError(BOOKING_REFUSALS.awbTaken(holder.code), { field: "trackingNumber" }) : null;
}

/**
 * The admin books a ready parcel by hand (order-fulfilment D11, R5, R6, A3): one move into
 * `pickup_booked` carrying the booking, so neither exists without the other; the move's effects
 * email buyer and shop. The AWB's partial unique index decides a clash, even between two admins
 * at once; the parcel already holding it is then read only to name it.
 */
export async function bookPickup(shipmentId: string, input: BookingInput, admin: { name: string | null }): Promise<void> {
  let outcome: Awaited<ReturnType<typeof moveParcel>>;
  try {
    outcome = await moveParcel(shipmentId, SHIPMENT_STATUS.PICKUP_BOOKED, {
      actor: PARCEL_ACTOR.ADMIN,
      actorName: admin.name ?? undefined,
      booking: {
        pickupDate: fromIsoDay(input.pickupDate),
        estimatedDelivery: fromIsoDay(input.estimatedDelivery),
        courierName: input.courierName,
        trackingNumber: input.trackingNumber,
        trackingUrl: input.trackingUrl,
        labelUrl: input.labelUrl,
      },
    });
  } catch (error) {
    if (isAwbClash(error)) throw (await awbTaken(input.trackingNumber, shipmentId)) ?? error;
    throw error;
  }
  if (outcome.kind === "moved") return;
  // moveParcel has already refused an off-list status by name.
  if (outcome.kind === "not-found" || outcome.kind === "off-list") throw new NotFoundError(PARCEL_NOT_FOUND);

  // Refused — read only to say why, never to decide.
  const current = outcome.current;
  if (current === SHIPMENT_STATUS.PACKING) throw new ConflictError(BOOKING_REFUSALS.notReady);
  if (current === SHIPMENT_STATUS.CANCELLED) {
    const cancel = await lastMoveInto(shipmentId, SHIPMENT_STATUS.CANCELLED);
    throw new ConflictError(cancel?.actor === PARCEL_ACTOR.BUYER ? BOOKING_REFUSALS.buyerCancelled : BOOKING_REFUSALS.cancelled);
  }
  if (current === SHIPMENT_STATUS.PICKUP_BOOKED) {
    const { booked } = await lastBookingChange(shipmentId);
    throw new ConflictError(BOOKING_REFUSALS.alreadyBooked(booked?.actorName ?? SOMEONE, booked?.createdAt ?? new Date()));
  }
  throw new ConflictError(alreadyMessage(current));
}

/**
 * Move a booked parcel's dates (D11): compare-and-set on the pickup date the admin saw, one
 * `pickup_moved` timeline row, the shop emailed, and the buyer too when the delivery day moved — one transaction.
 */
export async function changePickupDates(shipmentId: string, input: PickupDateChangeInput, admin: { name: string | null }): Promise<void> {
  const changed = await prisma.$transaction(async (tx) => {
    const outcome = await movePickupDates(
      shipmentId,
      fromIsoDay(input.seenPickupDate),
      { pickupDate: fromIsoDay(input.pickupDate), estimatedDelivery: fromIsoDay(input.estimatedDelivery) },
      { actorName: admin.name ?? SOMEONE },
      tx,
    );
    // Saving the dates as booked changes nothing, so it tells no one.
    if (outcome?.kind === "moved") {
      await onPickupMoved({ shipmentId, eventId: outcome.eventId, at: new Date(), etaChanged: outcome.etaChanged }, tx);
    }
    return outcome !== null;
  });
  if (changed) return;

  const parcel = await bookingOf(shipmentId);
  if (!parcel) throw new NotFoundError(PARCEL_NOT_FOUND);
  const status = parcel.status as ShipmentStatus;
  if (status === SHIPMENT_STATUS.CANCELLED) throw new ConflictError(BOOKING_REFUSALS.cancelled);
  if (PICKED_UP_OR_LATER.includes(status)) throw new ConflictError(BOOKING_REFUSALS.pickedUp);
  if (status === SHIPMENT_STATUS.PICKUP_BOOKED && parcel.pickupDate) {
    const { moved, booked } = await lastBookingChange(shipmentId);
    const last = moved ?? booked;
    throw new ConflictError(BOOKING_REFUSALS.changed(parcel.pickupDate, last?.actorName ?? SOMEONE, last?.createdAt ?? new Date()));
  }
  throw new ConflictError(alreadyMessage(status));
}

/** "Mark picked up" when the courier sends nothing (Q4): the same move a courier update makes. */
export async function markPickedUp(shipmentId: string, admin: { name: string | null }): Promise<void> {
  const outcome = await moveParcel(shipmentId, SHIPMENT_STATUS.PICKED_UP, { actor: PARCEL_ACTOR.ADMIN, actorName: admin.name ?? undefined });
  if (outcome.kind === "moved") return;
  // moveParcel has already refused an off-list status by name.
  if (outcome.kind === "not-found" || outcome.kind === "off-list") throw new NotFoundError(PARCEL_NOT_FOUND);
  const current = outcome.current;
  if (current === SHIPMENT_STATUS.CANCELLED) throw new ConflictError(BOOKING_REFUSALS.cancelled);
  if (PICKED_UP_OR_LATER.includes(current)) throw new ConflictError(BOOKING_REFUSALS.pickedUp);
  throw new ConflictError(alreadyMessage(current));
}

/**
 * The label link, for a signed-in member of the parcel's own shop, only while the pickup is
 * booked (D7, Q26). Any other parcel, shop or state is not-found: the label prints the address.
 */
export async function labelLinkFor(shipmentId: string, orgId: string): Promise<{ link: string; code: string }> {
  const parcel = await bookingOf(shipmentId);
  if (!parcel || parcel.orgId !== orgId || parcel.status !== SHIPMENT_STATUS.PICKUP_BOOKED || !parcel.labelUrl) {
    throw new NotFoundError("Label not found");
  }
  return { link: parcel.labelUrl, code: parcel.code };
}
