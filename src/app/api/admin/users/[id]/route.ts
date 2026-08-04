/**
 * Admin Single User API Routes
 * GET /api/admin/users/[id] - Get user details
 * PATCH /api/admin/users/[id] - Update user
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminUserService } from "@server/identity/admin.user.service";
import type { UpdateUserInput } from "@server/identity/admin.user.types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const user = await adminUserService.getUserById(id);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to fetch user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to fetch user",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateUserInput;

    const user = await adminUserService.updateUser(id, session.user.id, body);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update user",
      },
      { status: 400 }
    );
  }
}


