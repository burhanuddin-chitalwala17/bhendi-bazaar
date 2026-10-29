import { NextRequest, NextResponse } from "next/server";
import { accountService } from "@server/identity/account.service";
import { hash } from "bcryptjs";
import { limitRequest } from "@/lib/rate-limit";
import { validateRequest } from "@/lib/validation/utils";
import { signupSchema } from "@/lib/validation/schemas/auth.schemas";
import { emailService } from "@server/notifications/email.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(request: NextRequest) {
  const limited = await limitRequest(request, "POST /api/auth/signup");
  if (limited) return limited;

  // Validate request body
  const validation = await validateRequest(request, signupSchema);

  if ("error" in validation) {
    return validation.error;
  }

  const { email, password, name, mobile } = validation.data;

  try {
    // Email alone identifies an account. A phone may back any number of them (ADR-0024).
    const existingUser = await accountService.findIdByEmail(email);

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 },
      );
    }

    const passwordHash = await hash(password, 10);

    const user = await accountService.createPasswordAccount({ name, email, mobile, passwordHash });

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
      { status: 201 },
    );
  } catch (error) {
    return toErrorResponse(error, "Something went wrong");
  }
}
