import { NextRequest, NextResponse } from "next/server";
import { passwordService } from "@server/identity/password.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { resetPasswordSchema } from "@/lib/validation/schemas/auth.schemas";

export async function POST(request: NextRequest) {
  try {
    const { token, password, confirmPassword } = resetPasswordSchema.parse(await request.json());

    // Validation
    // Validate password strength
    const validation = passwordService.validatePassword(password);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Reset password
    const result = await passwordService.resetPassword(token, password);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    return toErrorResponse(error, "Could not reset password");
  }
}