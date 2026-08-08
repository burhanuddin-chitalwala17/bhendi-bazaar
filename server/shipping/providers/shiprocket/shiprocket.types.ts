/**
 * Shiprocket API Types
 * 
 * Type definitions for Shiprocket API v2 requests and responses.
 * Based on official Shiprocket API documentation: https://apidocs.shiprocket.in
 */

export interface PackageDimensions {
  length: number;
  breadth: number;
  height: number;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export interface ShiprocketAuthRequest {
  email: string;
  password: string;
}

export interface ShiprocketAuthResponse {
  token: string;
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company_id: number;
}

// ============================================================================
// SERVICEABILITY
// ============================================================================
import type { GetShippingRatesRequest } from "../../domain/shipping.types";

export interface GetShippingRatesRequestShiprocket
  extends GetShippingRatesRequest {
  weight: number; // in kg
  cod: boolean;
}

// ============================================================================
// WEBHOOK
// ============================================================================

/** One courier entry in the serviceability (rate) response — the fields we read. */
export interface ShiprocketCourierRate {
  id: number;
  courier_company_id: number;
  courier_name: string;
  rate: number | string; // rupees; converted to paise at the mapper
  estimated_delivery_days: number | string;
  etd: string;
  blocked: number;
  cod: number;
  is_surface: boolean;
  is_hyperlocal: boolean;
  is_custom_rate: number;
  realtime_tracking: string;
  rating: number;
  delivery_performance: number;
  pickup_performance: number;
  min_weight: number;
  charge_weight: number;
  surface_max_weight?: string;
  freight_charge: number;
  cod_charges: number;
  coverage_charges: number;
  rto_charges: number;
  zone: string;
  cutoff_time: string;
  pod_available: string;
}

export interface ShiprocketWebhookPayload {
  awb: string;
  courier_company_id: number;
  courier_name: string;
  current_status: string;
  delivered_date: string | null;
  delivered_to: string | null;
  destination: string;
  etd: string;
  order_id: string;
  pickup_date: string | null;
  scans: Array<{
    date: string;
    activity: string;
    location: string;
  }>;
  shipment_id: number;
  shipment_status: string;
  shipment_status_id: number;
  origin: string;
}

// ============================================================================
// COMMON TYPES
// ============================================================================

export interface ShiprocketErrorResponse {
  status_code: number;
  message: string;
  errors?: Record<string, string[]>;
}

// ============================================================================
// SHIPROCKET STATUS CODES
// ============================================================================

export enum ShiprocketStatusCode {
  NEW = 1,
  PICKED_UP = 2,
  IN_TRANSIT = 3,
  OUT_FOR_DELIVERY = 4,
  DELIVERED = 5,
  CANCELLED = 6,
  RTO_INITIATED = 7,
  RTO_IN_TRANSIT = 8,
  RTO_DELIVERED = 9,
  LOST = 10,
  DAMAGED = 11,
  PICKUP_PENDING = 12,
  PICKUP_SCHEDULED = 13,
  MANIFESTED = 14,
  NOT_PICKED_UP = 15,
  PICKUP_EXCEPTION = 16,
  UNDELIVERED = 17,
  DELAYED = 18,
  PARTIAL_DELIVERED = 19,
  DESTROYED = 20,
  CONTACT_CUSTOMER_CARE = 21,
  OUT_FOR_PICKUP = 22,
  SHIPMENT_BOOKED = 23,
}
