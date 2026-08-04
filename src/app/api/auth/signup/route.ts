import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@server/shared/prisma";
import { hash } from "bcryptjs";
import {
  authRateLimit,
  getClientIp,
  formatTimeRemaining,
} from "@/lib/rate-limit";
import { validateRequest } from "@/lib/validation/utils";
import { signupSchema } from "@/lib/validation/schemas/auth.schemas";
import { emailService } from "@server/notifications/email.service";

export async function POST(request: NextRequest) {
  // Rate limit check
  const ip = getClientIp(request);
  const { success, limit, remaining, reset } = await authRateLimit.limit(ip);

  if (!success) {
    const timeRemaining = reset - Date.now();
    return NextResponse.json(
      {
        error: `Too many signup attempts. Please try again in ${formatTimeRemaining(
          timeRemaining
        )}.`,
        retryAfter: Math.ceil(timeRemaining / 1000),
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
          "Retry-After": Math.ceil(timeRemaining / 1000).toString(),
        },
      }
    );
  }

  // Validate request body
  const validation = await validateRequest(request, signupSchema);

  if ("error" in validation) {
    return validation.error;
  }

  const { email, password, name, mobile } = validation.data;

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, mobile ? { mobile } : undefined].filter(Boolean) as any,
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email or mobile already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        mobile,
        passwordHash,
        isEmailVerified: false, // Explicitly set to false
        profile: {
          create: {
            addresses: [],
          },
        },
      },
    });

    // Send verification email
    if (email) {
      try {
        await emailService.sendVerificationEmail(user.id, email);
        console.log(`✅ Verification email sent to ${email}`);
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Don't fail signup if email fails
      }
    }

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        message:
          "Account created! Please check your email to verify your account.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
