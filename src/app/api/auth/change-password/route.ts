import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { passwordService } from "@server/identity/password.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { changePasswordSchema } from "@/lib/validation/schemas/auth.schemas";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword, confirmPassword } = changePasswordSchema.parse(await request.json());

    // Validation
    // Validate password strength
    const validation = passwordService.validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Change password
    const result = await passwordService.changePassword(
      (session.user as any).id,
      currentPassword,
      newPassword
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