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
import {
  resolvePageNumber,
  resolvePageSize,
  resolveSortBy,
  resolveSortOrder,
} from "@server/shared/pagination";

/** The columns this listing may be ordered by — the same set users filters declare. */
const SORTABLE = ["createdAt", "lastActiveAt", "totalSpent"] as const;

export async function GET(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { searchParams } = new URL(request.url);
    const platformRoleParam = searchParams.get("platformRole");

    const filters: UserListFilters = {
      search: searchParams.get("search") || undefined,
      platformRole: platformRoleParam
        ? platformRoleSchema.parse(platformRoleParam)
        : undefined,
      isBlocked:
        searchParams.get("isBlocked") === "true"
          ? true
          : searchParams.get("isBlocked") === "false"
            ? false
            : undefined,
      page: resolvePageNumber(searchParams.get("page")),
      limit: resolvePageSize(searchParams.get("limit")),
      sortBy: resolveSortBy(searchParams.get("sortBy"), SORTABLE, "createdAt"),
      sortOrder: resolveSortOrder(searchParams.get("sortOrder"), "desc"),
    };

    const result = await adminUserService.getUsers(filters);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch users:");
  }
}
