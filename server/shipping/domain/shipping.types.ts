/**
 * Core Shipping Domain Types
 *
 * These types define the core data structures used throughout the shipping module.
 * They represent addresses, packages, rates, shipments, and tracking information.
 */

export type ShipmentStatus =
  | "pending"
  | "created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "returned"
  | "failed";

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
// BOOKING
// ============================================================================

export interface CreateShipmentOrderItem {
  name: string;
  sku: string;
  units: number;
  sellingPrice: number; // paise
}

export interface CreateShipmentRequest {
  /** Sent as the provider's own order id on every attempt — the idempotency key
   *  that keeps a retried booking from creating a second parcel (D5). */
  shipmentCode: string;
  orderDate: Date;
  /** Must match a pickup location already registered in the provider's own
   *  account — our database having the address is not sufficient. */
  pickupLocationName: string;
  courierCode: string;
  paymentMethod: "prepaid" | "cod";
  subTotalPaise: number;
  weightKg: number;
  dimensions?: { length: number; width: number; height: number };
  billing: {
    customerName: string;
    address: string;
    address2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
    email?: string;
    phone: string;
  };
  items: CreateShipmentOrderItem[];
}

export interface CreateShipmentResult {
  success: boolean;
  awb?: string;
  trackingUrl?: string;
  courierName?: string;
  providerOrderId?: string;
  providerShipmentId?: string;
  error?: string;
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
