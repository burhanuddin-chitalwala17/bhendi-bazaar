/**
 * Admin User Block/Unblock API Route
 * POST /api/admin/users/[id]/block - Block or unblock user
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminUserService } from "@server/identity/admin.user.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { blockUserSchema } from "@/lib/validation/schemas/admin.schemas";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const { isBlocked } = blockUserSchema.parse(await request.json());

    const user = await adminUserService.toggleBlockUser(
      id,
      session.user.id,
      isBlocked,
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return toErrorResponse(error, "Could not update user status:");
  }
}
