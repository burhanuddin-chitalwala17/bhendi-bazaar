/**
 * Shiprocket Response Mapper
 * 
 * Maps Shiprocket API responses to our common shipping types
 */

import type { ShippingRate } from "../../domain";
import type { ShiprocketCourierRate } from "./shiprocket.types";
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
