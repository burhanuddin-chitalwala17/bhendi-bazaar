import { formatCurrency } from "@/lib/format";
/**
 * Client-side Shipping Domain Types
 * 
 * These types are used on the client-side (components, hooks, API responses).
 * They represent what customers see and interact with in the UI.
 */


/**
 * Shipping rate option shown at checkout
 */

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


/**
 * Request to get shipping rates
 */
export interface GetShippingRatesRequest {
  fromPincode: string;
  toPincode: string;
  weight?: number;
  cod?: boolean;
}

/**
 * Response with available shipping rates
 */
export interface GetShippingRatesResponse {
  success: boolean;
  rates: ShippingRate[];
  defaultRate?: ShippingRate;
  fromPincode: string;
  toPincode: string;
  metadata?: {
    totalOptions: number;
    deliveryDays: number[];
    priceRange: {
      min: number;
      max: number;
    };
  };
}

/**
 * Format shipping cost for display
 */
export function formatShippingCost(costPaise: number): string {
  if (costPaise === 0) return "FREE";
  return formatCurrency(costPaise);
}

/**
 * Format estimated delivery
 */
export function formatEstimatedDelivery(days: number): string {
  if (days === 0) return "Same day";
  if (days === 1) return "Tomorrow";
  if (days === 2) return "In 2 days";
  return `In ${days} days`;
}

/**
 * Represents a group of items shipping from the same origin
 */
export interface ShippingGroup {
  // Unique identifier for this group
  groupId: string; // e.g., "SEL-001-400001" (orgId-pincode)

  // Origin details
  orgId: string;
  orgName: string;
  orgCode: string;
  fromPincode: string;
  fromCity: string;
  fromState: string;

  // Items in this group
  items: any[]; // CartItem[] - using any to avoid circular dependency

  // Calculated shipping info
  totalWeight: number; // in kg
  itemsTotal: number;  // sum of item prices

  // Available rates
  rates: ShippingRate[];
  selectedRate: ShippingRate | null;

  // Fetching state
  isLoading: boolean;
  error: string | null;
  serviceable: boolean;
}

/**
 * Multi-group shipping state
 */
export interface MultiShippingState {
  groups: ShippingGroup[];
  totalShippingCost: number;
  isAllGroupsReady: boolean; // All groups have rates & selection
  isLoading: boolean;
}

