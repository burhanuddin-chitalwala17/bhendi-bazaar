/**
 * Admin User Block/Unblock API Route
 * POST /api/admin/users/[id]/block - Block or unblock user
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminUserService } from "@server/identity/admin.user.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = await request.json();
    const isBlocked = body.isBlocked === true;

    const user = await adminUserService.toggleBlockUser(
      id,
      session.user.id,
      isBlocked
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to update user status:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update user status",
      },
      { status: 400 }
    );
  }
}


