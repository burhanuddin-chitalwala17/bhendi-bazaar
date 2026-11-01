/**
 * PUT /api/admin/settings/fulfilment — change the fee, ₹0–1,000 in whole rupees, compare-and-set on
 * the version the admin saw, audited (order-fulfilment D14, R12a, Q29).
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { fulfilmentFeeSchema } from "@/lib/validation/schemas/fulfilment-settings.schema";
import { fulfilmentSettingsService } from "@server/payouts/fulfilment-settings.service";

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const input = fulfilmentFeeSchema.parse(await request.json());
    const saved = await fulfilmentSettingsService.saveFee(input, { id: session.user.id, name: session.user.name ?? null });
    return NextResponse.json(saved);
  } catch (error) {
    return toErrorResponse(error, "Could not save the fee");
  }
}
