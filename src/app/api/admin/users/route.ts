/**
 * Admin Users API Routes
 * GET /api/admin/users - List users with filters
 * 
 * Query params: search, platformRole, isBlocked, page, limit, sortBy, sortOrder
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminUserService } from "@server/identity/admin.user.service";
import type { UserListFilters } from "@server/identity/admin.user.types";
import { platformRoleSchema } from "@/lib/validation/schemas/common.schemas";
import { toErrorResponse } from "@/lib/api-error-response";

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { searchParams } = new URL(request.url);
    const platformRoleParam = searchParams.get("platformRole");

    const filters: UserListFilters = {
      search: searchParams.get("search") || undefined,
      platformRole: platformRoleParam ? platformRoleSchema.parse(platformRoleParam) : undefined,
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
    return toErrorResponse(error, "Could not fetch users:");
  }
}


