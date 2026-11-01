import type { Prisma } from "@prisma/client";

import {
  SHIPMENT_STATUS,
  SHIPMENT_STATUS_EFFECTS,
  alreadyMessage,
  canTransition,
  isShipmentStatus,
  type ParcelActor,
  type ShipmentStatus,
} from "@server/shipping/domain/shipping.types";
import { ConflictError } from "@server/shared/domain-error";
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
  /** The row holds a value outside the vocabulary; nothing can move it until a person looks. */
  | { kind: "off-list"; current: string }
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

/**
 * Move a shipment, if the move is legal, on the caller's transaction (order-fulfilment D2).
 *
 * The caller is checkout's fulfilment service, which holds the order's row lock, so two moves on
 * one order run one after the other. A transition that is not in the table is **ignored rather
 * than rejected**: couriers retry and arrive late, and applying a stale event would walk the parcel
 * backwards. The write is still conditional on the status read, as a backstop to the lock.
 */
export async function applyStatus(
  shipmentId: string,
  to: ShipmentStatus,
  by: { actor: ParcelActor; reason?: string; raw?: string },
  tx: Prisma.TransactionClient,
): Promise<TransitionOutcome> {
  const shipment = await shipmentRepository.findStatus(shipmentId, tx);
  if (!shipment) return { kind: "not-found" };

  if (!isShipmentStatus(shipment.status)) {
    console.warn(`[shipping] shipment ${shipmentId} holds off-list status "${shipment.status}"; move to ${to} refused`);
    return { kind: "off-list", current: shipment.status };
  }
  const from = shipment.status;
  if (from === to) return { kind: "ignored", current: from, reason: "same-status" };
  if (!canTransition(from, to)) return { kind: "ignored", current: from, reason: "not-allowed" };

  const moved = await shipmentRepository.recordTransition(
    shipmentId,
    from,
    {
      status: to,
      // The courier's own wording is kept whether or not we mapped it: it is the evidence for
      // adding a mapping, and the only record of what they actually said.
      ...(by.raw ? { shipmentStatus: by.raw } : {}),
      ...(to === SHIPMENT_STATUS.DELIVERED ? { deliveredAt: new Date() } : {}),
    },
    tx,
  );
  if (!moved) {
    const now = await shipmentRepository.findStatus(shipmentId, tx);
    throw new ConflictError(alreadyMessage((now?.status ?? to) as ShipmentStatus));
  }

  await shipmentRepository.recordEvent(
    { shipmentId, fromStatus: from, toStatus: to, actor: by.actor, reason: by.reason ?? null, courierWording: by.raw ?? null },
    tx,
  );

  const effects = SHIPMENT_STATUS_EFFECTS[to];
  // The status change and its consequences are one transaction: a parcel recorded as returned
  // while its units stayed decremented is inventory the shop has and cannot sell.
  if (effects.restocks) await restock(shipmentId, tx);

  if (effects.settlement === "reverse") {
    // The org is credited at payment and settlement claims whatever is unsettled, so a returned
    // sale stays claimable until this mirror entry. No refund here: a person presses that button.
    const { ledgerService } = await import("@server/payouts/ledger.service");
    const scope = await shipmentRepository.reversalScope(shipmentId, tx);
    if (scope) await ledgerService.reverseShipment({ shipmentId, ...scope }, `Parcel ${to}`, tx);
  }

  return { kind: "moved", from, to };
}

/** Which order and shop a parcel belongs to — what the caller locks and scopes by. Never changes. */
export async function parcelRefs(shipmentId: string): Promise<{ orderId: string; orgId: string } | null> {
  const row = await shipmentRepository.findStatus(shipmentId);
  return row ? { orderId: row.orderId, orgId: row.orgId } : null;
}

/** The parcel's code, shop, origin and order, for a notice written on the caller's transaction. */
export async function parcelNoticeContext(shipmentId: string, tx: Prisma.TransactionClient) {
  return await shipmentRepository.noticeContext(shipmentId, tx);
}

/** Who last moved the parcel into `status`, and when; null if it never was. */
export async function lastMoveInto(shipmentId: string, status: ShipmentStatus) {
  return await shipmentRepository.lastMoveInto(shipmentId, status);
}

/**
 * Parcels still being packed on orders in `paidStatus` (checkout's constant, passed in so shipping
 * holds no payment vocabulary), paid in (`paidAfter`, `paidBefore`], with no `noticeKind` notice
 * when one is named.
 */
export async function parcelsAwaitingPacking(
  window: { paidStatus: string; paidBefore: Date; paidAfter: Date | null; orgId?: string; shipmentId?: string },
  noticeKind: string | null,
  limit: number,
) {
  return await shipmentRepository.listPackingPaidBefore(SHIPMENT_STATUS.PACKING, window.paidStatus, window, noticeKind, limit);
}

/** How many parcels `parcelsAwaitingPacking` would find with no cap and no notice filter. */
export async function countParcelsAwaitingPacking(window: { paidStatus: string; paidBefore: Date; paidAfter: Date | null; orgId?: string }) {
  return await shipmentRepository.countPackingPaidBefore(SHIPMENT_STATUS.PACKING, window.paidStatus, window);
}

/** Parcels ready since at least `readyBefore` and still unbooked, with no `noticeKind` notice. */
export async function parcelsReadySince(readyBefore: Date, noticeKind: string, limit: number) {
  return await shipmentRepository.listReadyBefore(SHIPMENT_STATUS.READY_FOR_PICKUP, readyBefore, noticeKind, limit);
}

/** Every parcel status of an order, on the caller's transaction — the input to its summary. */
export async function parcelStatusesOf(orderId: string, tx: Prisma.TransactionClient): Promise<ShipmentStatus[]> {
  return (await shipmentRepository.listStatusesForOrder(orderId, tx)).map((s) => s.status as ShipmentStatus);
}

export type CourierReading =
  | { kind: "mapped"; status: ShipmentStatus; raw: string }
  | Extract<TransitionOutcome, { kind: "unmapped" | "not-found" }>;

/**
 * What a courier just told us, in our vocabulary. An unmapped status leaves the shipment where it
 * is and keeps the wording: a wrong status is worse than an unknown one, because only the unknown
 * one gets looked at.
 */
export async function readCourierStatus(
  shipmentId: string,
  provider: string,
  providerStatus: string,
): Promise<CourierReading> {
  const { status, raw } = normalizeShipmentStatus(provider, providerStatus);
  if (status !== null) return { kind: "mapped", status, raw };

  const shipment = await shipmentRepository.findStatus(shipmentId);
  if (!shipment) return { kind: "not-found" };
  await shipmentRepository.recordProviderWording(shipmentId, raw);
  console.warn(`[shipping] unmapped ${provider} status "${raw}" on shipment ${shipmentId}`);
  return { kind: "unmapped", current: shipment.status as ShipmentStatus, raw };
}

/**
 * A new order's parcels, on the order's own transaction — checkout reaches shipping here rather
 * than through its repository (ADR-0033). Born `packing`, the table's first state (order-fulfilment D3).
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

/** What this status means for stock, money and settlement — one answer, read from one table. */
export const effectsOf = (status: ShipmentStatus) => SHIPMENT_STATUS_EFFECTS[status];
