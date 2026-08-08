/**
 * Admin Single User API Routes
 * GET /api/admin/users/[id] - Get user details
 * PATCH /api/admin/users/[id] - Update user
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminUserService } from "@server/identity/admin.user.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { updateUserSchema } from "@/lib/validation/schemas/admin.schemas";


export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const body = updateUserSchema.parse(await request.json());

    const user = await adminUserService.updateUser(id, session.user.id, body);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    return toErrorResponse(error, "Could not update user:");
  }
}


