/**
 * Core Shipping Domain Types
 *
 * These types define the core data structures used throughout the shipping module.
 * They represent addresses, packages, rates, shipments, and tracking information.
 */

/**
 * Where a parcel is — the one vocabulary every courier's own maps into
 * ([shipment-lifecycle](../../../docs/specs/shipment-lifecycle/spec.md)).
 *
 * A parcel has **two journeys, not one**: it goes out, and when that fails it comes back. The
 * return leg is two states rather than a mirror of the forward one, because the only distinction
 * that changes what we do is *has it arrived* — that is when stock returns and a refund is owed.
 * Finer courier wording (`rto_ofd`, `rto_ndr`) is kept verbatim in `Shipment.shipmentStatus` and
 * the event log, not in a column decisions branch on.
 */
export const SHIPMENT_STATUS = {
  /** Accepted, being packed at the origin. Nothing has moved yet. */
  PACKING: "packing",
  /** The shop has packed it and is waiting for the admin to book a courier (order-fulfilment D1). */
  READY_FOR_PICKUP: "ready_for_pickup",
  /** A courier is booked for a date; nobody has collected it yet. */
  PICKUP_BOOKED: "pickup_booked",
  /** Handed to the courier. From here the only way back is a return, never a cancellation. */
  PICKED_UP: "picked_up",
  IN_TRANSIT: "in_transit",
  OUT_FOR_DELIVERY: "out_for_delivery",
  /**
   * An attempt failed. **Not terminal** — in India a courier typically tries three times and
   * raises a non-delivery report between attempts, so this is the normal case and the parcel
   * goes back to `OUT_FOR_DELIVERY` on the next one.
   */
  DELIVERY_FAILED: "delivery_failed",
  DELIVERED: "delivered",

  /** The return leg: on its way back to the origin, and arrived. */
  RTO_IN_TRANSIT: "rto_in_transit",
  RTO_DELIVERED: "rto_delivered",

  /** Called off before the courier collected it. */
  CANCELLED: "cancelled",
  LOST: "lost",
  DAMAGED: "damaged",
} as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS)[keyof typeof SHIPMENT_STATUS];

/**
 * What each state is called to a person.
 *
 * Keyed by the union, so a new state cannot be added without the compiler asking what to call
 * it — the alternative is every screen inventing its own wording, which is how `packing` came
 * to read "Pending" in one place and "Processing" in another.
 */
export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  [SHIPMENT_STATUS.PACKING]: "Packing",
  [SHIPMENT_STATUS.READY_FOR_PICKUP]: "Ready for pickup",
  [SHIPMENT_STATUS.PICKUP_BOOKED]: "Pickup booked",
  [SHIPMENT_STATUS.PICKED_UP]: "Picked up",
  [SHIPMENT_STATUS.IN_TRANSIT]: "In transit",
  [SHIPMENT_STATUS.OUT_FOR_DELIVERY]: "Out for delivery",
  [SHIPMENT_STATUS.DELIVERY_FAILED]: "Delivery attempt failed",
  [SHIPMENT_STATUS.DELIVERED]: "Delivered",
  [SHIPMENT_STATUS.RTO_IN_TRANSIT]: "Returning to shop",
  [SHIPMENT_STATUS.RTO_DELIVERED]: "Returned to shop",
  [SHIPMENT_STATUS.CANCELLED]: "Cancelled",
  [SHIPMENT_STATUS.LOST]: "Lost in transit",
  [SHIPMENT_STATUS.DAMAGED]: "Damaged in transit",
};

/**
 * What each state means for stock, for the buyer's money, and for what the org is owed.
 *
 * Declared beside the states on purpose: "what does this status cost" must not be answerable
 * only by reading four call sites. Nothing here *performs* any of it — this is the table the
 * acting code reads, so there is one answer rather than one per caller.
 *
 * `LOST` and `DAMAGED` deliberately do **not** restock: those units are gone, and crediting them
 * back invents inventory. They are written off against the courier claim instead.
 */
export interface StatusEffects {
  /** Return the reserved units to the location they came from. */
  restocks: boolean;
  /** The buyer is owed their money back. Entitlement only — `payments` still owns the write. */
  refundOwed: boolean;
  /** What the organisation's ledger should show for this sale. */
  settlement: "credit" | "reverse" | "unchanged";
  /** No further transition is possible from here. */
  terminal: boolean;
}

export const SHIPMENT_STATUS_EFFECTS: Record<ShipmentStatus, StatusEffects> = {
  packing:           { restocks: false, refundOwed: false, settlement: "unchanged", terminal: false },
  ready_for_pickup:  { restocks: false, refundOwed: false, settlement: "unchanged", terminal: false },
  pickup_booked:     { restocks: false, refundOwed: false, settlement: "unchanged", terminal: false },
  picked_up:         { restocks: false, refundOwed: false, settlement: "unchanged", terminal: false },
  in_transit:        { restocks: false, refundOwed: false, settlement: "unchanged", terminal: false },
  out_for_delivery:  { restocks: false, refundOwed: false, settlement: "unchanged", terminal: false },
  delivery_failed:   { restocks: false, refundOwed: false, settlement: "unchanged", terminal: false },
  delivered:         { restocks: false, refundOwed: false, settlement: "credit",    terminal: true  },
  rto_in_transit:    { restocks: false, refundOwed: false, settlement: "unchanged", terminal: false },
  rto_delivered:     { restocks: true,  refundOwed: true,  settlement: "reverse",   terminal: true  },
  cancelled:         { restocks: true,  refundOwed: true,  settlement: "reverse",   terminal: true  },
  lost:              { restocks: false, refundOwed: true,  settlement: "reverse",   terminal: true  },
  damaged:           { restocks: false, refundOwed: true,  settlement: "reverse",   terminal: true  },
};

/**
 * Which moves are legal. **The table is the guard**, which is what gives "cancel only before
 * pickup" and "never move backwards" from one mechanism rather than two scattered checks.
 *
 * A courier event naming a state we have already passed is therefore ignored rather than
 * applied — the common case with retried and out-of-order webhooks, not an error.
 */
export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  // Hand booking (own-store Q18) has two waits; picked_up comes only after a booking, and
  // cancellation only before the courier collects (order-fulfilment D1).
  packing:          ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["pickup_booked", "cancelled"],
  pickup_booked:    ["picked_up", "cancelled"],
  picked_up:        ["in_transit", "rto_in_transit", "lost", "damaged"],
  in_transit:       ["out_for_delivery", "rto_in_transit", "lost", "damaged"],
  out_for_delivery: ["delivered", "delivery_failed", "lost", "damaged"],
  // Back out for another attempt, or give up and start the journey home.
  delivery_failed:  ["out_for_delivery", "rto_in_transit", "lost", "damaged"],
  rto_in_transit:   ["rto_delivered", "lost", "damaged"],
  delivered:        [],
  rto_delivered:    [],
  cancelled:        [],
  lost:             [],
  damaged:          [],
};

/** ux.md's "Stale" copy: a person's move refused because the parcel has already moved on. */
export const alreadyMessage = (current: ShipmentStatus) =>
  `This parcel is already ${(SHIPMENT_STATUS_LABELS[current] ?? current).toLowerCase()}.`;

/** Who moves a parcel, as the timeline records it (order-fulfilment D5). */
export const PARCEL_ACTOR = {
  BUYER: "buyer",
  SHOP: "shop",
  ADMIN: "admin",
  COURIER: "courier",
  SYSTEM: "system",
} as const;

export type ParcelActor = (typeof PARCEL_ACTOR)[keyof typeof PARCEL_ACTOR];

/**
 * Where each person may cancel from (order-fulfilment Q9): buyer and shop until the parcel is
 * marked ready, the admin until it is collected. Each list sits inside the transition table.
 */
export const CANCELLABLE_FROM: Record<"buyer" | "shop" | "admin", readonly ShipmentStatus[]> = {
  buyer: [SHIPMENT_STATUS.PACKING],
  shop: [SHIPMENT_STATUS.PACKING],
  admin: [SHIPMENT_STATUS.PACKING, SHIPMENT_STATUS.READY_FOR_PICKUP, SHIPMENT_STATUS.PICKUP_BOOKED],
};

/** Whether this move is allowed. A repeat of the current state is a no-op, not a failure. */
export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return from === to || (SHIPMENT_TRANSITIONS[from]?.includes(to) ?? false);
}

/** Whether a stored value is in the vocabulary. A row outside it has no transitions at all. */
export function isShipmentStatus(value: string): value is ShipmentStatus {
  return Object.prototype.hasOwnProperty.call(SHIPMENT_TRANSITIONS, value);
}

/** Said when a parcel holds a status outside the vocabulary: refused, never guessed past. */
export const offListMessage = (current: string) =>
  `This parcel has a status we don't recognise ("${current}"). Ask the admin to check it.`;

// ============================================================================
// PROVIDER CONNECTION
// ============================================================================

/**
 * Connection request body (discriminated union)
 */

export interface ConnectionRequestBody {
  type: "email_password" | "api_key" | "oauth";
  email?: string;
  password?: string;
}

/**
 * Result of connecting a provider account
 */
export interface ProviderConnectionResult {
  success: boolean;
  error?: string;
  token?: string;
  tokenExpiresAt?: Date;
  lastAuthAt?: Date;
  accountInfo?: Record<string, string | number>;
}

// ============================================================================
// RATE CALCULATION
// ============================================================================

export interface GetShippingRatesRequest {
  fromPincode: string; // Warehouse pincode
  toPincode: string; // Customer pincode
  weight?: number;
  cod?: boolean;
}

export interface GetShippingRatesResponse {
  success: boolean;
  fromPincode: string;
  toPincode: string;
  rates: ShippingRate[];
  metadata?: {
    totalOptions: number;
    deliveryDays: number[];
    priceRange: {
      min: number;
      max: number;
    };
  };
}

export interface ShippingRate {
  // Provider info
  providerId: string;
  providerName: string; // "Shiprocket"

  // Courier info
  courierName: string; // "Delhivery Surface"
  courierCode?: string; // Provider's internal courier code (e.g., "459245934")

  // Pricing
  rate: number; // Shipping cost in INR

  // Delivery info
  estimatedDays: number; // Estimated delivery days
  etd?: string; // Estimated delivery date string (e.g., "Jul 01, 2024")

  // Availability & mode
  available: boolean; // Whether this rate is available (not blocked)
  mode: string; // "surface" | "air" | "express" (delivery mode)

  // Features (for UI badges/filters)
  features?: {
    cod?: boolean; // Cash on delivery support
    tracking?: boolean; // Real-time tracking
    insurance?: boolean; // Insurance coverage
    hyperlocal?: boolean; // Same-day/hyperlocal delivery
  };

  // Performance metrics (useful for recommendation)
  performance?: {
    rating?: number; // Courier rating (0-5)
    deliveryPerformance?: number; // Delivery success rate
    pickupPerformance?: number; // Pickup reliability
  };

  // Weight & dimension constraints
  constraints?: {
    minWeight?: number; // Minimum weight in kg
    maxWeight?: number; // Maximum weight in kg
    chargeWeight?: number; // Actual charged weight
  };

  // Additional charges (transparency)
  charges?: {
    freight?: number; // Base freight charge
    cod?: number; // COD charges
    coverage?: number; // Coverage/insurance charges
    rto?: number; // Return charges
  };

  // Provider-specific data (for internal use)
  metadata?: {
    courierId?: number; // Shiprocket courier ID
    courierCompanyId?: number; // Shiprocket company ID
    isHyperlocal?: boolean;
    isSurface?: boolean;
    isCustomRate?: boolean;
    zone?: string; // Shipping zone (z_a, z_b, etc.)
    cutoffTime?: string; // Last pickup time
    realtimeTracking?: string;
    podAvailable?: string; // Proof of delivery
  };
}

// ============================================================================
// WEBHOOK
// ============================================================================

export interface WebhookEvent {
  orderId?: string;
  trackingNumber: string;
  status: string;
  rawPayload?: any;
}

// ============================================================================
// RATE CACHING
// ============================================================================

export interface CachedRate {
  providerId: string;
  fromPincode: string;
  toPincode: string;
  weight: number;
  mode: string;
  rate: number;
  courierName: string;
  estimatedDays: number;
  metadata?: any;
  expiresAt: Date;
}
