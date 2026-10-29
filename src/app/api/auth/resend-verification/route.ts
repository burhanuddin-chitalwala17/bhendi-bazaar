// src/app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from "next/server";
import { limitRequest } from "@/lib/rate-limit";
import { requireSession } from "@/lib/admin-auth";
import { emailService } from "@server/notifications/email.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const limited = await limitRequest(request, "POST /api/auth/resend-verification", { userId: session.user.id });
    if (limited) return limited;
    await emailService.resendVerificationEmail(session.user.id);
    return NextResponse.json({
      message: "Verification email sent successfully",
    });
  } catch (error) {
    return toErrorResponse(error, "Could not send the verification email");
  }
}
