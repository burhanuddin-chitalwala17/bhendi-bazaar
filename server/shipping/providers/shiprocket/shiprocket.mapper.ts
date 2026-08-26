/**
 * Shiprocket Response Mapper
 *
 * Maps Shiprocket API responses to our common shipping types,
 * and our requests to Shiprocket's shape.
 */

import type { ShippingRate, CreateShipmentRequest } from "../../domain";
import type { ShiprocketCourierRate, ShiprocketCreateOrderRequest } from "./shiprocket.types";
import { DEFAULT_PACKAGE_DIMENSIONS, SHIPROCKET_CONFIG } from "./shiprocket.config";
import { rupeesToPaise } from "@server/shared/money";

export function mapShiprocketRateToShippingRate(
  courier: ShiprocketCourierRate,
  providerId: string
): ShippingRate {
  const estimatedDays = Number(courier.estimated_delivery_days) || 3;
  const mode = courier.is_surface ? "surface" : "air";

  return {
    // Provider info
    providerId,
    providerName: "Shiprocket",

    // Courier info
    courierName: courier.courier_name,
    courierCode: courier.id.toString(),

    // Pricing
    // Shiprocket quotes rupees; everything past this mapper is paise (Invariant 3).
    rate: rupeesToPaise(Number(courier.rate)),

    // Delivery info
    estimatedDays,
    etd: courier.etd,

    // Availability & mode
    available: courier.blocked === 0,
    mode,

    // Features
    features: {
      cod: courier.cod === 1,
      tracking: courier.realtime_tracking === "Real Time",
      insurance: false, // Shiprocket doesn't include this in rate response
      hyperlocal: courier.is_hyperlocal,
    },

    // Performance metrics
    performance: {
      rating: courier.rating,
      deliveryPerformance: courier.delivery_performance,
      pickupPerformance: courier.pickup_performance,
    },

    // Weight constraints
    constraints: {
      minWeight: courier.min_weight,
      maxWeight: parseFloat(courier.surface_max_weight || "0") || undefined,
      chargeWeight: courier.charge_weight,
    },

    // Additional charges
    // Also rupees from Shiprocket — every amount leaves this mapper as paise.
    charges: {
      freight: rupeesToPaise(Number(courier.freight_charge) || 0),
      cod: rupeesToPaise(Number(courier.cod_charges) || 0),
      coverage: rupeesToPaise(Number(courier.coverage_charges) || 0),
      rto: rupeesToPaise(Number(courier.rto_charges) || 0),
    },

    // Metadata
    metadata: {
      courierId: courier.id,
      courierCompanyId: courier.courier_company_id,
      isHyperlocal: courier.is_hyperlocal,
      isSurface: courier.is_surface,
      isCustomRate: courier.is_custom_rate === 1,
      zone: courier.zone,
      cutoffTime: courier.cutoff_time,
      realtimeTracking: courier.realtime_tracking,
      podAvailable: courier.pod_available,
    },
  };
}

/**
 * Our booking request → Shiprocket's adhoc order create shape. Pure and
 * network-free so it is testable without mocking auth or fetch (D2).
 */
export function buildShiprocketOrderPayload(
  request: CreateShipmentRequest
): ShiprocketCreateOrderRequest {
  // Our domain calls the middle dimension "width"; Shiprocket calls it "breadth".
  const dimensions = request.dimensions
    ? { length: request.dimensions.length, breadth: request.dimensions.width, height: request.dimensions.height }
    : DEFAULT_PACKAGE_DIMENSIONS;
  const [firstName, ...restName] = request.billing.customerName.trim().split(/\s+/);

  return {
    // The same shipment code on every attempt is the idempotency key (D5): a
    // retried call reaches Shiprocket with an order_id it has already seen,
    // which it rejects rather than silently booking a second parcel.
    order_id: request.shipmentCode,
    order_date: request.orderDate.toISOString().slice(0, 19).replace("T", " "),
    pickup_location: request.pickupLocationName,
    billing_customer_name: firstName || request.billing.customerName,
    billing_last_name: restName.join(" "),
    billing_address: request.billing.address,
    billing_address_2: request.billing.address2,
    billing_city: request.billing.city,
    billing_pincode: request.billing.pincode,
    billing_state: request.billing.state,
    billing_country: request.billing.country,
    billing_email: request.billing.email || SHIPROCKET_CONFIG.FALLBACK_ORDER_EMAIL,
    billing_phone: request.billing.phone,
    shipping_is_billing: true,
    order_items: request.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      units: item.units,
      // Shiprocket wants rupees; every amount up to this call is paise (Invariant 3).
      selling_price: item.sellingPrice / 100,
    })),
    payment_method: request.paymentMethod === "cod" ? "COD" : "Prepaid",
    sub_total: request.subTotalPaise / 100,
    length: dimensions.length,
    breadth: dimensions.breadth,
    height: dimensions.height,
    weight: request.weightKg,
  };
}
