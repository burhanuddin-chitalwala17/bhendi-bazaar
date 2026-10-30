/**
 * One courier vocabulary per table, all mapping into ours
 * ([shipment-lifecycle](../../../docs/specs/shipment-lifecycle/spec.md)).
 *
 * This is the adapter that makes a second and third courier a table rather than a rewrite. Its
 * one rule: **an unmapped status is reported, never guessed.** The previous version inferred one
 * from substrings and fell back to `pending`, which is how a lost parcel looks healthy for a
 * week — a wrong status is worse than an unknown one, because only the unknown one gets looked
 * at.
 */

import { SHIPMENT_STATUS, type ShipmentStatus } from "../domain/shipping.types";

const { PACKING, PICKED_UP, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERY_FAILED, DELIVERED,
        RTO_IN_TRANSIT, RTO_DELIVERED, CANCELLED, LOST, DAMAGED } = SHIPMENT_STATUS;

/**
 * Courier status → ours. Keys are matched case-insensitively and with separators normalised, so
 * `Out For Delivery`, `out_for_delivery` and `OUT-FOR-DELIVERY` are one entry rather than three.
 */
const STATUS_MAPPINGS: Record<string, Record<string, ShipmentStatus>> = {
  shiprocket: {
    "pending": PACKING,
    "awaiting pickup": PACKING,
    "pickup scheduled": PACKING,
    "pickup complete": PICKED_UP,
    "pickup generated": PACKING,
    "in transit": IN_TRANSIT,
    "shipped": IN_TRANSIT,
    "out for delivery": OUT_FOR_DELIVERY,
    "delivered": DELIVERED,
    // A courier attempt that failed. Shiprocket raises a non-delivery report between attempts;
    // both mean the same thing to us, and neither is terminal.
    "undelivered": DELIVERY_FAILED,
    "ndr": DELIVERY_FAILED,
    "cancelled": CANCELLED,
    "canceled": CANCELLED,
    // The return leg. Shiprocket reports it in detail; we keep only "coming back" and "back",
    // and the raw wording stays on the row.
    "rto initiated": RTO_IN_TRANSIT,
    "rto in transit": RTO_IN_TRANSIT,
    "rto ofd": RTO_IN_TRANSIT,
    "rto ndr": RTO_IN_TRANSIT,
    "rto": RTO_IN_TRANSIT,
    "rto delivered": RTO_DELIVERED,
    "rto acknowledged": RTO_DELIVERED,
    "lost": LOST,
    "damaged": DAMAGED,
  },

  delhivery: {
    "pending": PACKING,
    "manifested": PACKING,
    "pickup scheduled": PACKING,
    "not picked": PACKING,
    "dispatched": PICKED_UP,
    "in transit": IN_TRANSIT,
    "out for delivery": OUT_FOR_DELIVERY,
    "delivered": DELIVERED,
    "undelivered": DELIVERY_FAILED,
    "cancelled": CANCELLED,
    "canceled": CANCELLED,
    "rto": RTO_IN_TRANSIT,
    "rto in transit": RTO_IN_TRANSIT,
    "rto delivered": RTO_DELIVERED,
    "lost": LOST,
    "damaged": DAMAGED,
  },

  // Not connected yet. The table is written because the point of an adapter is that adding a
  // courier is a table, and an empty one would not prove that.
  maruti: {
    "booked": PACKING,
    "pickup pending": PACKING,
    "picked up": PICKED_UP,
    "in transit": IN_TRANSIT,
    "reached destination": IN_TRANSIT,
    "out for delivery": OUT_FOR_DELIVERY,
    "delivered": DELIVERED,
    "delivery attempted": DELIVERY_FAILED,
    "cancelled": CANCELLED,
    "return in transit": RTO_IN_TRANSIT,
    "returned to origin": RTO_DELIVERED,
    "lost": LOST,
    "damaged": DAMAGED,
  },
};

/** `Out For Delivery`, `out_for_delivery` and `OUT-FOR-DELIVERY` are the same key. */
const normaliseKey = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

export interface NormalisedStatus {
  /** Our status, or null when this courier said something nobody has mapped. */
  status: ShipmentStatus | null;
  /** The courier's own wording, always kept — it is the evidence for adding a mapping. */
  raw: string;
  provider: string;
}

/**
 * Map a courier's status to ours, or report that we cannot.
 *
 * Returns `null` rather than a guess (spec R8, trd D9): the caller leaves the shipment where it
 * is, keeps the raw wording, and surfaces it. An unmapped status is a table entry somebody needs
 * to add, and it can only become one if it is visible.
 */
export function normalizeShipmentStatus(provider: string, providerStatus: string): NormalisedStatus {
  const table = STATUS_MAPPINGS[provider.trim().toLowerCase()];
  return {
    status: table?.[normaliseKey(providerStatus)] ?? null,
    raw: providerStatus,
    provider,
  };
}

/** Which couriers this adapter knows, for the admin console and for tests. */
export const MAPPED_PROVIDERS = Object.keys(STATUS_MAPPINGS);

export function getStatusLabel(status: ShipmentStatus): string {
  const labels: Record<ShipmentStatus, string> = {
    packing: "Packing",
    ready_for_pickup: "Ready for Pickup",
    pickup_booked: "Pickup Booked",
    picked_up: "Picked Up",
    in_transit: "In Transit",
    out_for_delivery: "Out for Delivery",
    delivery_failed: "Delivery Attempted",
    delivered: "Delivered",
    rto_in_transit: "Returning to Shop",
    rto_delivered: "Returned to Shop",
    cancelled: "Cancelled",
    lost: "Lost in Transit",
    damaged: "Damaged in Transit",
  };
  return labels[status] ?? status;
}
