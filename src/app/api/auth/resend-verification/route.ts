// src/app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/admin-auth";
import { emailService } from "@server/notifications/email.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    await emailService.resendVerificationEmail(session.user.id);
    return NextResponse.json({
      message: "Verification email sent successfully",
    });
  } catch (error) {
    return toErrorResponse(error, "Could not send the verification email");
  }
}
