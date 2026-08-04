// src/app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { emailService } from "@server/notifications/email.service";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await emailService.resendVerificationEmail((session.user as any).id);
    return NextResponse.json({
      message: "Verification email sent successfully",
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Failed to send verification email" 
      },
      { status: 400 }
    );
  }
}