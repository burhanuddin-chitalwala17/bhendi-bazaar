/**
 * PUT /api/admin/payment-details — where shops send a top-up: UPI id, QR code, bank account
 * (ai-images/shop-credits R11, Q35). Shown to every shop on its credit sheet exactly as saved.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { paymentDetailsSchema } from "@/lib/validation/schemas/credit.schema";
import { creditService } from "@server/payouts/credit.service";

export async function PUT(request: NextRequest) {
  try {
    const adminId = await requirePlatformAdminId();
    const details = paymentDetailsSchema.parse(await request.json());
    await creditService.savePaymentDetails(details, adminId);
    return NextResponse.json(await creditService.paymentDetails());
  } catch (error) {
    return toErrorResponse(error, "Could not save the payment details");
  }
}
