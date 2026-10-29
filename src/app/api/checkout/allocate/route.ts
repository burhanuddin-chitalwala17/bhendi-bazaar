/**
 * POST /api/checkout/allocate — which parcels a basket becomes (stock-locations R5,
 * R10): the same pure allocation the order transaction runs, as a preview, so the
 * customer sees every parcel — each quoted from its own origin — before paying.
 *
 * The response names parcels and their contents, never how much stock sits where:
 * a per-location figure that reaches the browser has been disclosed whether or not
 * it is displayed (A9).
 */

import { NextRequest, NextResponse } from "next/server";
import { limitRequest } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { z } from "zod";
import { previewParcels } from "@server/checkout/parcel-preview.service";
import { quantitySchema } from "@/lib/validation/schemas/common.schemas";
import { PINCODE_PATTERN, PINCODE_MESSAGE } from "@server/shared/pincode";
import { toErrorResponse } from "@/lib/api-error-response";

const allocateSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: quantitySchema,
        size: z.string().trim().min(1).max(50).optional(),
        color: z.string().trim().min(1).max(50).optional(),
      }),
    )
    .min(1)
    .max(100),
  destinationPincode: z.string().regex(PINCODE_PATTERN, PINCODE_MESSAGE),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const limited = await limitRequest(request, "POST /api/checkout/allocate", { userId: session?.user?.id });
    if (limited) return limited;
    const body = allocateSchema.parse(await request.json());
    return NextResponse.json({
      groups: await previewParcels(body.items, body.destinationPincode),
    });
  } catch (error) {
    return toErrorResponse(error, "Could not plan your parcels");
  }
}
