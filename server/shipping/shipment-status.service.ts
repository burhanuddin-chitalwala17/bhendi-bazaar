import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

import {
  SHIPMENT_STATUS,
  SHIPMENT_STATUS_EFFECTS,
  canTransition,
  type ShipmentStatus,
} from "@server/shipping/domain/shipping.types";
import { normalizeShipmentStatus } from "@server/shipping/utils/statusNormalizer";
import { shipmentRepository } from "@server/shipping/repositories/shipment.repository";
import { stockService } from "@server/catalog/stock.service";

/**
 * The only thing that writes `Shipment.status`
 * ([shipment-lifecycle](../../docs/specs/shipment-lifecycle/trd.md) D12).
 *
 * Two route handlers used to write it directly with string literals — one of them a value the
 * type did not even contain — which is how the column came to hold three vocabularies at once.
 * Routing both through here is what makes the transition table, the raw-wording capture and the
 * effects lookup unavoidable rather than optional.
 */

export type TransitionOutcome =
  /** Applied and persisted. */
  | { kind: "moved"; from: ShipmentStatus; to: ShipmentStatus }
  /** The courier repeated itself, or reported something we have already passed. Not an error. */
  | { kind: "ignored"; current: ShipmentStatus; reason: "same-status" | "not-allowed" }
  /** This courier said something nobody has mapped. Recorded, never guessed at. */
  | { kind: "unmapped"; current: ShipmentStatus; raw: string }
  | { kind: "not-found" };


/**
 * Return this parcel's units to the location they were reserved from.
 *
 * Guarded and idempotent in the same shape as the reservation that took them
 * ([ADR-0007](../../docs/adr/0007-conditional-stock-decrement.md)): `restockedAt` is claimed
 * conditionally here — the Shipment write is shipping's — and only a successful claim asks
 * catalog to move the units, on the same `tx`. A courier repeating a terminal event credits nothing.
 *
 * `LOST` and `DAMAGED` never reach here — those units are gone, and crediting them back invents
 * inventory. The effects table is what decides.
 */
async function restock(shipmentId: string, tx: Prisma.TransactionClient): Promise<void> {
  const claimed = await shipmentRepository.claimRestock(shipmentId, tx);
  if (!claimed) return; // already restocked by an earlier event
  await stockService.restockShipment(shipmentId, tx);
}

async function currentStatus(shipmentId: string) {
  return shipmentRepository.findStatus(shipmentId);
}

/**
 * Move a shipment, if the move is legal.
 *
 * A transition that is not in the table is **ignored rather than rejected**. Couriers retry
 * webhooks and occasionally deliver them late, so a `in_transit` arriving after `delivered` is
 * the normal case, not a fault — and applying it would walk the parcel backwards.
 */
export async function applyStatus(
  shipmentId: string,
  to: ShipmentStatus,
  raw?: string,
): Promise<TransitionOutcome> {
  const shipment = await currentStatus(shipmentId);
  if (!shipment) return { kind: "not-found" };

  const from = shipment.status as ShipmentStatus;
  if (from === to) return { kind: "ignored", current: from, reason: "same-status" };
  if (!canTransition(from, to)) return { kind: "ignored", current: from, reason: "not-allowed" };

  const effects = SHIPMENT_STATUS_EFFECTS[to];

  // The status change and its consequences are one transaction: a parcel recorded as returned
  // while its units stayed decremented is inventory the shop has and cannot sell.
  await prisma.$transaction(async (tx) => {
    await shipmentRepository.recordTransition(
      shipmentId,
      {
        status: to,
        // The courier's own wording is kept whether or not we mapped it: it is the evidence for
        // adding a mapping, and the only record of what they actually said.
        ...(raw ? { shipmentStatus: raw } : {}),
        ...(to === SHIPMENT_STATUS.DELIVERED ? { deliveredAt: new Date() } : {}),
      },
      tx,
    );

    if (effects.restocks) await restock(shipmentId, tx);

    if (effects.settlement === "reverse") {
      // The org is credited at payment, not at delivery, and settlement is a manual claim over
      // whatever is unsettled — so between a return and a payout there is a real window where an
      // entry for returned goods is claimable. The mirror entry closes it.
      //
      // Deliberately no refund: a gateway refund is irreversible, so the entitlement is recorded
      // and a human presses the button (owner's decision, 2026-09-24).
      const { ledgerService } = await import("@server/payouts/ledger.service");
      const scope = await shipmentRepository.reversalScope(shipmentId, tx);
      if (scope) await ledgerService.reverseShipment({ shipmentId, ...scope }, `Parcel ${to}`, tx);
    }
  });

  return { kind: "moved", from, to };
}

/**
 * Apply what a courier just told us, in its own words.
 *
 * An unmapped status leaves the shipment exactly where it is and says so. Guessing — which the
 * old normalizer did, by matching substrings and defaulting to `pending` — is how a lost parcel
 * looks healthy for a week: a wrong status is worse than an unknown one, because only the
 * unknown one gets looked at.
 */
export async function applyProviderStatus(
  shipmentId: string,
  provider: string,
  providerStatus: string,
): Promise<TransitionOutcome> {
  const { status, raw } = normalizeShipmentStatus(provider, providerStatus);

  if (status === null) {
    const shipment = await currentStatus(shipmentId);
    if (!shipment) return { kind: "not-found" };
    // Keep the wording even though the status does not move — it is what an operator needs to
    // see to add the table entry.
    await shipmentRepository.recordProviderWording(shipmentId, raw);
    console.warn(`[shipping] unmapped ${provider} status "${raw}" on shipment ${shipmentId}`);
    return { kind: "unmapped", current: shipment.status as ShipmentStatus, raw };
  }

  return applyStatus(shipmentId, status, raw);
}

/**
 * A new order's parcels, on the order's own transaction — checkout reaches shipping here rather
 * than through its repository (ADR-0033). Born `pending`, outside the transition table like booking.
 */
export async function createShipmentForOrder(
  data: Parameters<typeof shipmentRepository.createForOrder>[0],
  tx: Prisma.TransactionClient,
) {
  return await shipmentRepository.createForOrder(data, tx);
}

export async function createShipmentItemsForOrder(
  rows: Parameters<typeof shipmentRepository.createItemsForOrder>[0],
  tx: Prisma.TransactionClient,
): Promise<void> {
  await shipmentRepository.createItemsForOrder(rows, tx);
}

/** The carrier accepted the parcel. Bypasses the transition table, as the booking path always has. */
export async function recordBooking(
  shipmentId: string,
  booking: { trackingNumber?: string; trackingUrl?: string },
): Promise<void> {
  await shipmentRepository.markBooked(shipmentId, booking);
}

/** Booking failed and needs a human; `shippingMeta` carries why. */
export async function recordBookingFailure(
  shipmentId: string,
  shippingMeta: Prisma.InputJsonValue,
): Promise<void> {
  await shipmentRepository.markBookingFailed(shipmentId, shippingMeta);
}

/** What this status means for stock, money and settlement — one answer, read from one table. */
export const effectsOf = (status: ShipmentStatus) => SHIPMENT_STATUS_EFFECTS[status];
