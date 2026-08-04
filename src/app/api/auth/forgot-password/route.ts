import { NextRequest, NextResponse } from "next/server";
import { passwordService } from "@server/identity/password.service";
import {
  authRateLimit,
  getClientIp,
  formatTimeRemaining,
} from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limit
  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await authRateLimit.limit(ip);

  if (!success) {
    const timeRemaining = reset - Date.now();
    return NextResponse.json(
      {
        error: `Too many requests. Please try again in ${formatTimeRemaining(
          timeRemaining
        )}.`,
        retryAfter: Math.ceil(timeRemaining / 1000),
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Request password reset
    const result = await passwordService.requestPasswordReset(email);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Always return success (don't reveal if email exists)
    return NextResponse.json({
      message:
        "If an account exists with this email, you will receive a password reset link shortly.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}