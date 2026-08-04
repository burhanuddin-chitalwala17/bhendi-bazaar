// src/app/api/auth/verify-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { emailService } from "@server/notifications/email.service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/?verification=error&message=Invalid verification link", request.url)
    );
  }

  const result = await emailService.verifyEmail(token);

  if (result.success) {
    return NextResponse.redirect(
      new URL("/?verification=success", request.url)
    );
  } else {
    return NextResponse.redirect(
      new URL(`/?verification=error&message=${encodeURIComponent(result.error || "Verification failed")}`, request.url)
    );
  }
}