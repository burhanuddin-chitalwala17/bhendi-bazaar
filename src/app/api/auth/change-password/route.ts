import { NextRequest, NextResponse } from "next/server";
import { limitRequest } from "@/lib/rate-limit";
import { requireSession } from "@/lib/admin-auth";
import { passwordService } from "@server/identity/password.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { changePasswordSchema } from "@/lib/validation/schemas/auth.schemas";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const limited = await limitRequest(request, "POST /api/auth/change-password", { userId: session.user.id });
    if (limited) return limited;

    const { currentPassword, newPassword, confirmPassword } =
      changePasswordSchema.parse(await request.json());

    // Validation
    // Validate password strength
    const validation = passwordService.validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Change password
    const result = await passwordService.changePassword(
      session.user.id,
      currentPassword,
      newPassword,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      message: "Password changed successfully",
    });
  } catch (error) {
    return toErrorResponse(error, "Could not change password");
  }
}
