/**
 * Admin Users API Routes
 * GET /api/admin/users - List users with filters
 * 
 * Query params: search, role, isBlocked, page, limit, sortBy, sortOrder
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminUserService } from "@server/identity/admin.user.service";
import type { UserListFilters } from "@server/identity/admin.user.types";

export async function GET(request: NextRequest) {
  const session = await verifyAdminSession();
  if (session instanceof NextResponse) return session;

  try {
    const { searchParams } = new URL(request.url);

    const filters: UserListFilters = {
      search: searchParams.get("search") || undefined,
      role: searchParams.get("role") || undefined,
      isBlocked:
        searchParams.get("isBlocked") === "true"
          ? true
          : searchParams.get("isBlocked") === "false"
          ? false
          : undefined,
      page: parseInt(searchParams.get("page") || "1"),
      limit: parseInt(searchParams.get("limit") || "20"),
      sortBy: (searchParams.get("sortBy") as any) || "createdAt",
      sortOrder: (searchParams.get("sortOrder") as any) || "desc",
    };

    const result = await adminUserService.getUsers(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch users",
      },
      { status: 500 }
    );
  }
}


