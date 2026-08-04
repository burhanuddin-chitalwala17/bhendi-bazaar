/**
 * Shipping Rates API
 * POST /api/shipping/rates
 * 
 * Get available shipping rates for delivery to a pincode.
 * Uses all enabled shipping providers and returns rates from each.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  initializeShippingModule,
  shippingOrchestrator,
} from "@server/shipping";
import { z } from "zod";
import { postalCodeSchema } from "@/lib/validation/schemas/common.schemas";

// Validation schema
const getRatesSchema = z.object({
  fromPincode: postalCodeSchema,
  toPincode: postalCodeSchema,
  weight: z.number().min(0.1).max(500).optional(),
  cod: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // ✅ Defensive check: ensure shipping is initialized
    if (shippingOrchestrator.getProviderCount() === 0) {
      console.warn("⚠️ Shipping not initialized, initializing now...");
      await initializeShippingModule();

      // If still no providers after init, return error
      if (shippingOrchestrator.getProviderCount() === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "No shipping providers available. Please check server configuration.",
          },
          { status: 503 }
        );
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const validated = getRatesSchema.parse(body);

    // Build rate request
    const rateRequest = {
      fromPincode: validated.fromPincode,
      toPincode: validated.toPincode,
      cod: validated.cod,
      weight: validated.weight,
    };

    // Get best rates using two-step filtering
    const response = await shippingOrchestrator.getRatesFromAllProviders(
      rateRequest,
      { useCache: false }
    );
    // console.log("response", response);

    if (!response.success || !response.rates || response.rates.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No shipping options available for this location",
        },
        { status: 404 }
      );
    }

    // Return best rates (one per delivery day group)
    return NextResponse.json({
      success: true,
      rates: response.rates, // Array of best rates (one per delivery day)
      defaultRate: response.rates[0], // First one is fastest/cheapest
      fromPincode: response.fromPincode,
      toPincode: response.toPincode,
      metadata: response.metadata,
    });
  } catch (error) {
    console.error("Get shipping rates error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get shipping rates",
      },
      { status: 500 }
    );
  }
}
