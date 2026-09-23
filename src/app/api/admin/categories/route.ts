/**
 * Admin Categories API Routes
 * GET /api/admin/categories - List categories
 * POST /api/admin/categories - Create new category
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminCategoryService } from "@server/catalog/admin.category.service";
import type {
  CategoryListFilters,
  CreateCategoryInput,
} from "@server/catalog/admin.category.types";
import { toErrorResponse } from "@/lib/api-error-response";
import {
  resolvePageNumber,
  resolvePageSize,
  resolveSortBy,
  resolveSortOrder,
} from "@server/shared/pagination";
import { categoryFormSchema } from "@/lib/validation/schemas/category.schema";

/** The columns this listing may be ordered by — the same set categories filters declare. */
const SORTABLE = ["order", "name", "createdAt"] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const { searchParams } = new URL(request.url);

    const filters: CategoryListFilters = {
      search: searchParams.get("search") || undefined,
      page: resolvePageNumber(searchParams.get("page")),
      limit: resolvePageSize(searchParams.get("limit")),
      sortBy: resolveSortBy(searchParams.get("sortBy"), SORTABLE, "order"),
      sortOrder: resolveSortOrder(searchParams.get("sortOrder"), "asc"),
    };

    const result = await adminCategoryService.getCategories(filters);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "Could not fetch categories");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const body = categoryFormSchema.parse(await request.json());
    const category = await adminCategoryService.createCategory(
      session.user.id,
      body,
    );

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create category");
  }
}
